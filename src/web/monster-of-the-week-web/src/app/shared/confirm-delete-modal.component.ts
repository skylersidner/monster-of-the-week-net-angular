import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Injector,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';

/** Module-scoped so two instances on one page cannot collide on `aria-labelledby`. */
let nextInstanceId = 0;

/** What counts as a focus stop, for the trap and for the close-time fallback. */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The app's single confirmation dialog. Extended rather than forked, per
 * `docs/updates/mystery-entity-linking-ux.md` §7 — it has already absorbed `verb`,
 * `confirmLabel`, `items` and the footnote by this kind of extension, and a parallel dialog
 * would drift.
 *
 * **Render order, top to bottom:** title → `usageMessage` + `usage[]` → `message` + `items[]`
 * → `footnote` → buttons.
 *
 * **Why two lists.** A removal answers two different questions, and they cannot share one list
 * (§7.1): *where is this used* — which drives Detach vs. Delete — and *what gets destroyed with
 * it*, which drives Delete vs. Cancel. `items` keeps its shipped cascade meaning
 * (`monsters-list.html` has passed minion names through it since before this feature), so the
 * usage list is the new block and renders above it.
 */
@Component({
  selector: 'app-confirm-delete-modal',
  imports: [],
  templateUrl: './confirm-delete-modal.component.html',
})
export class ConfirmDeleteModalComponent {
  private readonly injector = inject(Injector);
  private readonly hostElement: ElementRef<HTMLElement> = inject(ElementRef);

  @Input() itemName: string = '';
  @Input() visible: boolean = false;
  @Input() message: string = 'This cannot be undone.';
  @Input() items: readonly string[] = [];

  /** Sentence introducing `usage`, e.g. "This bystander is used by 2 mysteries:". */
  @Input() usageMessage: string = '';
  /** Who else uses this entity — mystery names. Rendered above the `message`/`items` pair. */
  @Input() usage: readonly string[] = [];

  /** Action verb for the title and confirm button. Defaults to "Delete"; the mystery wizard passes
   * "Remove" because dropping a draft card from the roster is not a deletion at confirm time. */
  @Input() verb: string = 'Delete';

  /** The confirm button's label when the title's verb makes a poor button ("Switch to"); defaults to `verb`. */
  @Input() confirmLabel: string | null = null;

  /**
   * Closing line beneath both lists — permanence, and with a secondary action also button guidance.
   *
   * Renamed from `permanenceNote` and **now rendered unconditionally**. It used to sit inside the
   * `items.length > 0` branch, so it silently vanished whenever there was nothing to cascade —
   * which is the common case for a flat Location (§7.1).
   *
   * **Its default is `''`, not the old `'This cannot be undone.'`, and that is deliberate.** **Ten**
   * of the thirteen shipped call sites end up with that exact sentence as `message` and an empty
   * `items`, so keeping the old default while rendering unconditionally would print it twice on
   * each of them. Seven pass it explicitly; the other three — `mysteries-list`, `monster-detail`
   * and `minion-detail` — pass no `message` at all and inherit `message`'s own default, which is
   * the same sentence, and are the easy ones to miss. Callers that want a footnote now say so;
   * every existing call site renders exactly as it did before.
   */
  @Input() footnote: string = '';

  /**
   * Optional middle button — the wizard's `Detach`. Null on every call site that has no second
   * action, which is all of them outside the wizard: Detach means *remove from **this** mystery*,
   * and only the wizard has a current mystery to detach from (§7.2, §7.5).
   */
  @Input() secondaryLabel: string | null = null;

  @Output() confirmed = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly titleId = `confirm-delete-title-${++nextInstanceId}`;
  readonly descriptionId = `confirm-delete-description-${nextInstanceId}`;

  @ViewChild('dialog') private readonly dialog?: ElementRef<HTMLElement>;
  @ViewChild('cancelButton') private readonly cancelButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('secondaryButton') private readonly secondaryButton?: ElementRef<HTMLButtonElement>;

  /**
   * The last element **outside** this dialog to take focus. This is the opener, and it is tracked
   * as focus moves rather than sampled when `visible` flips.
   *
   * `monsters-list` is why. Its trash button is `[disabled]="isLoadingMinions()"` and its
   * `requestDelete` does a round trip for the minion cascade before opening the dialog. Chromium
   * moves `document.activeElement` to `<body>` when a focused button is disabled and does **not**
   * put it back when the button is re-enabled — so by the time the dialog opens, sampling
   * `activeElement` records `<body>` and the real opener is already lost.
   *
   * The "outside" half of the name is load-bearing: without it this would end up holding the
   * dialog's own Cancel button, which the dialog focuses on open, and closing would try to restore
   * focus to a control that no longer exists.
   */
  private lastFocusedOutside: HTMLElement | null = null;

  /**
   * Records focus movement outside the dialog. Cheap — one listener per instance, and pages render
   * one or two — and it is what makes the restore survive an opener that blurs between the click
   * and the open.
   */
  @HostListener('document:focusin', ['$event'])
  trackFocus(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === target.ownerDocument.body) {
      return;
    }

    if (this.dialog?.nativeElement.contains(target)) {
      return;
    }

    this.lastFocusedOutside = target;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['visible'];
    if (!change || change.previousValue === change.currentValue) {
      return;
    }

    if (change.currentValue) {
      // After the render, because the dialog's buttons do not exist until `visible` is true.
      afterNextRender({ write: () => this.focusLeastDestructive() }, { injector: this.injector });
      return;
    }

    this.restoreFocus();
  }

  onBackdropClick(): void {
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onSecondary(): void {
    this.secondary.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  /**
   * `Escape` cancels and `Tab` cycles within the dialog.
   *
   * **Bound on `document`, and it has to be.** This was on the backdrop element, which is only
   * reachable by events that bubble *up* from inside the dialog — and the dialog's own title,
   * message and padding are not focusable, so a single click on any of them drops
   * `document.activeElement` to `<body>`. A keydown raised on `<body>` never propagates down into
   * the backdrop, so `Escape` silently stopped working after one stray click, on every call site.
   *
   * **This does not cost the nesting property** (§8.7). `CustomSelectComponent.handleEscape` calls
   * `stopPropagation()` while the panel is open, which halts the event at the select's host — it
   * never reaches `document` either, so the first press still closes only the dropdown and the
   * second still closes the dialog.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.visible) {
      return;
    }

    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      this.cancelled.emit();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.activeElement();
    const inside = active !== null && (this.dialog?.nativeElement.contains(active) ?? false);

    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Initial focus lands on the **least destructive actionable** control — `Detach` when it is
   * present, otherwise `Cancel`. Never the confirm button (§8.6 item 5).
   */
  private focusLeastDestructive(): void {
    const target = this.secondaryButton?.nativeElement ?? this.cancelButton?.nativeElement;
    target?.focus({ preventScroll: true });
  }

  /**
   * On close, focus goes back to whatever opened the dialog — and when that is gone, to the
   * surrounding surface rather than to nowhere (§8 item 5's last clause).
   *
   * A confirmed delete usually removes the row, and with it the trash button that opened this. The
   * `isConnected` guard stops the crash; on its own it left focus on `<body>`, which is the same
   * orphaning defect the composer fix exists to prevent, one interaction later.
   */
  private restoreFocus(): void {
    const opener = this.lastFocusedOutside;
    this.lastFocusedOutside = null;

    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
      return;
    }

    this.focusSurroundingSurface();
  }

  /**
   * Falls back to the first focus stop in whatever contains this dialog — "the phase's first
   * focusable control" in §8 item 5's wording. Deliberately derived from the DOM rather than taken
   * as an input, so all thirteen call sites get it without passing anything: in the wizard it lands
   * on the roster the user was just in, and on a list page on that page's first control.
   */
  private focusSurroundingSurface(): void {
    const host = this.hostElement.nativeElement;
    const container = host.parentElement ?? host;

    const target = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
      (element) => !host.contains(element) && this.isFocusStop(element),
    );

    target?.focus({ preventScroll: true });
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog?.nativeElement;
    if (!root) {
      return [];
    }

    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) =>
      this.isFocusStop(element),
    );
  }

  private isFocusStop(element: HTMLElement): boolean {
    return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
  }

  private activeElement(): HTMLElement | null {
    const active = this.dialog?.nativeElement.ownerDocument?.activeElement ?? document.activeElement;
    return active instanceof HTMLElement ? active : null;
  }
}
