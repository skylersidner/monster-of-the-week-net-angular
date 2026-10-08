import { Directive, ElementRef, HostListener, Injectable, Injector, Input, OnDestroy, afterNextRender, inject } from '@angular/core';

/**
 * What counts as a focus stop, for the trap and for the restore-time fallback.
 *
 * `a[href]`, not a bare `[href]`, and the narrowing is a fix rather than tidying: the broad form
 * also matched SVG `<use href="#icon-…">`, which is not focusable. Harmless in the confirm dialog,
 * which renders no icons, but the upload modal's in-flight state is a spinner and nothing else — so
 * the trap counted the `<use>` as its one focus stop, tried to focus an unfocusable node, and left
 * focus on `<body>` in exactly the state that most needs it contained.
 */
const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isFocusStop(element: HTMLElement): boolean {
  return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
}

/**
 * Remembers what had focus before an overlay opened, so the overlay can give it back on close.
 *
 * **It is a root service rather than part of the directive, and that is the load-bearing detail.**
 * The element to return to is often blurred *before* the overlay exists, so nothing scoped to the
 * open dialog can observe it. `monsters-list` is the real case: its trash button is
 * `[disabled]="isLoadingMinions()"` and `requestDelete` pre-fetches the minion cascade before
 * opening, so Chromium disables the focused button, drops `document.activeElement` to `<body>`, and
 * does not put it back on re-enable. Sampling `activeElement` at open time therefore records
 * `<body>` and the real opener is already lost — which is why this tracks focus continuously
 * instead.
 *
 * "Outside" is load-bearing too: without it this would end up holding the dialog's own initially
 * focused button, and closing would try to restore focus to a control that no longer exists.
 *
 * **It has to be alive before the overlay opens, so the overlay components inject it.** Angular
 * instantiates a root service on first injection; if that first injection were `FocusTrapDirective`
 * — created only when a dialog actually renders — the opener would already have been focused and
 * blurred by then and this would have seen nothing. `ConfirmDeleteModalComponent` and
 * `ImageUploadModalComponent` therefore inject it at construction, which is page-render time, even
 * though neither calls it. `monsters-list.focus.spec.ts` caught this during the extraction.
 */
@Injectable({ providedIn: 'root' })
export class FocusReturnTracker {
  private lastFocusedOutside: HTMLElement | null = null;

  constructor() {
    // One listener for the whole app, installed once. Overlays come and go; this does not.
    document.addEventListener('focusin', (event) => this.record(event), true);
  }

  private record(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === target.ownerDocument.body) {
      return;
    }

    // Anything inside an overlay is the overlay's own furniture, not what to return to.
    if (target.closest('[role="dialog"]')) {
      return;
    }

    this.lastFocusedOutside = target;
  }

  /** Hands back the remembered element and forgets it, so a second close cannot reuse a stale one. */
  take(): HTMLElement | null {
    const remembered = this.lastFocusedOutside;
    this.lastFocusedOutside = null;
    return remembered;
  }
}

/**
 * Keyboard focus containment for an overlay: initial focus on open, `Tab`/`Shift+Tab` cycling
 * within it, and focus returned to the opener on close.
 *
 * Extracted from `ConfirmDeleteModalComponent` (Skyler, 2026-10-08: *"have Luigi extract that to a
 * reusable directive … and apply it to this modal as well"*) and applied to
 * `ImageUploadModalComponent`, which had none. **Everything this carries forward was a bug found in
 * production use, so none of it is speculative:**
 *
 *  - the opener can be blurred before the overlay opens — see `FocusReturnTracker`;
 *  - the opener is frequently *gone* by close time, because a confirmed delete removes the row that
 *    held the trash button, hence the `isConnected` guard;
 *  - when it is gone, focus must land on the surrounding surface rather than `<body>`, which is the
 *    same orphaning defect one interaction later.
 *
 * **Apply it to the dialog element**, inside whatever `@if` renders it: the directive's lifetime is
 * the overlay's, so init means "opened" and destroy means "closed", with no `open` input to keep in
 * sync with the template that already decides it.
 *
 * Escape is deliberately *not* here. Each overlay does something different with it — cancel for the
 * confirm dialog, the discard-confirmation step for the upload modal — and the upload modal also
 * yields to a dialog stacked above it. Folding that in would have forced a strategy input for no
 * shared behaviour.
 */
@Directive({
  selector: '[appFocusTrap]',
  standalone: true,
  // `-1` so the dialog itself can hold focus: it is where focus parks when the overlay has no focus
  // stops of its own, which is a real state (see `onKeydown`).
  host: { tabindex: '-1' },
})
export class FocusTrapDirective implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly focusReturn = inject(FocusReturnTracker);

  /**
   * Where focus should land when the overlay opens. Defaults to the first focus stop inside it.
   *
   * A resolver rather than a selector, because the confirm dialog's answer is "the least
   * destructive *actionable* control" — `Detach` when present, else `Cancel`, never the confirm
   * button — which it expresses with `ViewChild` refs it already holds. Passing a function keeps
   * that logic in the component that understands it and leaves this directive with no opinion.
   */
  @Input('appFocusTrapInitial') initialFocus?: () => HTMLElement | null | undefined;

  /**
   * The surface to fall back into when the opener is gone. Defaults to the parent of the nearest
   * component host above this element, which is "whatever contains this overlay" — on a list page
   * that page's first control, in the wizard the roster the user was just in.
   */
  @Input('appFocusTrapReleaseScope') releaseScope?: HTMLElement | null;

  /**
   * The overlay's component host and the surface containing it, resolved while this element is
   * still attached and kept for close time.
   *
   * **Resolved eagerly because they cannot be resolved late.** `ngOnDestroy` runs while the `@if`
   * around the overlay is being torn down, and by then this element is detached — walking
   * `parentElement` finds nothing and the fallback silently leaves focus on `<body>`, which is the
   * exact defect the fallback exists to prevent. The component this was extracted from did not hit
   * it because it restored focus from `ngOnChanges`, before the teardown. Two of its specs caught
   * this during the extraction.
   */
  private cachedComponentHost: HTMLElement | null = null;
  private cachedReleaseScope: HTMLElement | null = null;
  private observer?: MutationObserver;

  constructor() {
    // After the render, because the overlay's controls do not exist until it is rendered — and
    // because this is the first point at which the element is reliably in the document.
    afterNextRender(
      {
        write: () => {
          this.cachedComponentHost = this.componentHost();
          this.cachedReleaseScope = this.releaseScope ?? this.cachedComponentHost?.parentElement ?? this.cachedComponentHost;
          this.focusInitial();
          this.watchForOrphanedFocus();
        },
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.restoreFocus();
  }

  /**
   * Re-homes focus when the overlay swaps out the control that had it.
   *
   * `ImageUploadModalComponent` needs this and the confirm dialog does not: its contents change
   * while it is open — staging, then the discard-confirmation footer swap, then the in-flight state
   * that renders no controls at all — and each swap destroys the focused button, which leaves
   * `document.activeElement` on `<body>` and focus effectively outside the overlay.
   *
   * Done by observation rather than by a `refocus()` method the component calls, deliberately: a
   * method has to be remembered at every new state, and this modal already has three and may grow
   * more. Watching makes a future state correct by default instead of correct-if-you-remember.
   *
   * No feedback loop: the response is to move focus, and moving focus does not mutate the DOM.
   */
  private watchForOrphanedFocus(): void {
    this.observer = new MutationObserver(() => {
      const active = this.activeElement();
      if (active && this.elementRef.nativeElement.contains(active)) {
        return;
      }

      this.focusInitial();
    });

    this.observer.observe(this.elementRef.nativeElement, { childList: true, subtree: true });
  }

  /**
   * `Tab` cycles within the overlay.
   *
   * On `document`, not on this element, and that is not incidental: a click on the overlay's own
   * non-focusable text (its title, its message, its padding) drops `document.activeElement` to
   * `<body>`, and a keydown raised there never propagates down into this element. Bound here, the
   * trap survives a stray click; bound locally it silently stopped working after one.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.focusableElements();

    // No focus stops at all — a real state, not a defensive branch: the upload modal replaces its
    // whole body with a spinner panel while a request is in flight, rendering no controls. The
    // press is swallowed and focus parked on the dialog, so it cannot leave for the page behind.
    // Returning early here (what the original did) let `Tab` escape the overlay entirely.
    if (focusable.length === 0) {
      event.preventDefault();
      this.elementRef.nativeElement.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.activeElement();
    const inside = active !== null && this.elementRef.nativeElement.contains(active);

    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusInitial(): void {
    const requested = this.initialFocus?.();
    const target = requested ?? this.focusableElements()[0] ?? this.elementRef.nativeElement;
    target.focus({ preventScroll: true });
  }

  private restoreFocus(): void {
    const opener = this.focusReturn.take();

    // A confirmed delete usually removes the row, and with it the control that opened this. The
    // guard stops the crash; the fallback below stops focus being left on `<body>`, which is the
    // same orphaning defect the restore exists to prevent.
    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
      return;
    }

    this.focusSurroundingSurface();
  }

  private focusSurroundingSurface(): void {
    const container = this.cachedReleaseScope;
    if (!container) {
      return;
    }

    const overlayRoot = this.cachedComponentHost ?? this.elementRef.nativeElement;
    const target = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
      (element) => !overlayRoot.contains(element) && isFocusStop(element),
    );

    target?.focus({ preventScroll: true });
  }

  /**
   * The overlay component's own host element — the nearest custom-element ancestor. Every Angular
   * component host is one, and the hyphen is what distinguishes it from the plain `div`s this
   * directive sits inside. Used to exclude the whole overlay from the fallback search and to find
   * the surface containing it, which is the behaviour the confirm dialog shipped with.
   */
  private componentHost(): HTMLElement | null {
    let current: HTMLElement | null = this.elementRef.nativeElement;
    while (current) {
      if (current.tagName.includes('-')) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(isFocusStop);
  }

  private activeElement(): HTMLElement | null {
    const active = this.elementRef.nativeElement.ownerDocument?.activeElement ?? document.activeElement;
    return active instanceof HTMLElement ? active : null;
  }
}
