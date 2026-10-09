import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject } from '@angular/core';

import { FocusReturnTracker, FocusTrapDirective } from './focus-trap.directive';

/** Module-scoped so two instances on one page cannot collide on `aria-labelledby`. */
let nextInstanceId = 0;

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
  imports: [FocusTrapDirective],
  templateUrl: './confirm-delete-modal.component.html',
})
export class ConfirmDeleteModalComponent {
  /** Injected, never called: it must be alive before this dialog opens. See its own doc comment. */
  private readonly focusReturn = inject(FocusReturnTracker);

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
   * of the shipped call sites end up with that exact sentence as `message` and an empty
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
  /**
   * Initial focus lands on the **least destructive actionable** control — `Detach` when it is
   * present, otherwise `Cancel`. Never the confirm button (§8.6 item 5).
   *
   * Handed to `appFocusTrap` as a resolver rather than reimplemented there: the directive has no
   * business knowing which of a dialog's buttons is the safe one, and this component already holds
   * the refs. An arrow property so `this` survives being passed as a function.
   */
  readonly resolveInitialFocus = (): HTMLElement | null =>
    this.secondaryButton?.nativeElement ?? this.cancelButton?.nativeElement ?? null;

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
    }

    // `Tab` containment is `appFocusTrap`'s, on the dialog element.
  }

  // Everything else that used to live here — tracking the opener through a `document:focusin`
  // listener, `Tab` containment, the `isConnected` guard and the surrounding-surface fallback — is
  // now `FocusTrapDirective`/`FocusReturnTracker`'s, unchanged in behaviour and shared with
  // `ImageUploadModalComponent`, which had no focus management at all (Skyler, 2026-10-08).
}
