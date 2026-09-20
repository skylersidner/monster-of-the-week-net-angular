import {
  Component,
  ElementRef,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MysteryCreateStore } from './mystery-create.store';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { resolveMysteryNames, wizardMysteryUsageMessage, wizardRemovalFootnote } from '../../../../shared/mystery-usage';

/**
 * The Bystanders step, generalised from the shipped minion shape (UX §2): a roster of summary cards,
 * an attach strip, then one composer — in that order, which §14.2(c) makes load-bearing for focus
 * as well as for reading, because the modal's close-time fallback focuses the first control in this
 * component's root.
 *
 * A deliberate copy of the locations phase with the noun changed (OQ9).
 */
@Component({
  selector: 'app-mystery-create-bystanders-phase',
  imports: [ReactiveFormsModule, CustomSelectComponent, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './mystery-create-bystanders-phase.html',
})
export class MysteryCreateBystandersPhaseComponent {
  readonly store = inject(MysteryCreateStore);
  private readonly injector = inject(Injector);

  @ViewChild('composerHeading') private readonly composerHeading?: ElementRef<HTMLElement>;
  @ViewChild('addAnotherButton') private readonly addAnotherButton?: ElementRef<HTMLButtonElement>;

  /** Commit-on-pick (§3): choosing an option attaches immediately and the control resets. */
  readonly attachControl = new FormControl<string>('', { nonNullable: true });

  /** `localKey` of the card awaiting removal confirmation, or `null` when the modal is closed. */
  readonly pendingRemoveKey = signal<string | null>(null);

  private readonly pendingRemoveDraft = computed(() => {
    const key = this.pendingRemoveKey();
    return key === null ? null : (this.store.bystanders().find((draft) => draft.localKey === key) ?? null);
  });

  readonly pendingRemoveName = computed(() => this.pendingRemoveDraft()?.name ?? '');

  /**
   * **The variant predicate (§7.1, decision 16), and it is the store's, not a second copy.**
   *
   * `id !== null` is the intuitive test and the dangerous one: an attached entity has an id the
   * instant it is picked, so keying on it would offer **Delete** — permanent catalogue destruction
   * — to someone undoing a mis-click. What the modal needs is "does a persisted membership exist",
   * which is the same question `submitPhase3`'s diff asks of the same baseline signal.
   */
  readonly pendingRemovePersisted = computed(() =>
    this.store.persistedForRemoval('bystanders', this.pendingRemoveDraft()?.id ?? null),
  );

  /**
   * **How many** other mysteries use this entity — from the draft's own `mysteryIds`, which is
   * populated at attach or hydrate and does not depend on the mystery lookup at all (§15.1).
   *
   * This is the number the Detach-vs-Delete decision is actually made from, and it is always
   * available. Deriving it from the resolved *names* conflated "no other mysteries" with "no names
   * resolved" and made a failed lookup assert the opposite of the truth.
   */
  private readonly pendingRemoveOtherIds = computed<string[]>(() => {
    if (!this.pendingRemovePersisted()) {
      return [];
    }

    const currentMysteryId = this.store.mysteryId();
    return (this.pendingRemoveDraft()?.mysteryIds ?? []).filter((id) => id !== currentMysteryId);
  });

  /**
   * **Which** mysteries, by name — supplementary, and the only part that can be missing. Bullets
   * render only when *every* id resolved, so the count in the sentence and the length of the list
   * can never disagree; a partial resolution takes the names-missing wording instead of quietly
   * showing fewer bullets than the sentence promised.
   */
  readonly pendingRemoveUsage = computed<string[]>(() => {
    const otherIds = this.pendingRemoveOtherIds();
    const names = resolveMysteryNames(otherIds, this.store.mysteries());
    return names.length === otherIds.length ? names : [];
  });

  private readonly pendingRemoveNamesResolved = computed(
    () => this.pendingRemoveUsage().length === this.pendingRemoveOtherIds().length,
  );

  readonly pendingRemoveUsageMessage = computed(() => {
    const draft = this.pendingRemoveDraft();
    if (!draft) {
      return '';
    }

    // (A1) authored here and never saved — nothing exists anywhere.
    if (draft.id === null) {
      return "This bystander hasn't been saved yet. Removing it discards what you typed.";
    }

    // (A2) attached this session, not yet submitted. The entity is real and stays real; only a
    // membership that was never created goes away. The sentence does the work the missing Detach
    // button would have done — and note (A1)'s wording is *wrong* here, because nothing was typed.
    if (!this.pendingRemovePersisted()) {
      return "This bystander stays in your bystanders list — it just won't be part of this mystery.";
    }

    return wizardMysteryUsageMessage(
      'bystander',
      this.pendingRemoveOtherIds().length,
      this.pendingRemoveNamesResolved(),
    );
  });

  /** Keyed on the count, not on the names — the footnote followed the sentence into (B) otherwise. */
  readonly pendingRemoveFootnote = computed(() =>
    this.pendingRemovePersisted()
      ? wizardRemovalFootnote('bystander', this.pendingRemoveOtherIds().length > 0, this.store.deferredChangeTail())
      : '',
  );

  /** (B)/(C) get the three-button shape; (A1)/(A2) must leave both unset (§14.2b). */
  readonly pendingRemoveSecondaryLabel = computed(() => (this.pendingRemovePersisted() ? 'Detach' : null));
  readonly pendingRemoveConfirmLabel = computed(() => (this.pendingRemovePersisted() ? 'Delete' : null));

  constructor() {
    this.attachControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((bystanderId) => {
      if (!bystanderId) {
        return;
      }

      this.store.attachBystander(bystanderId);
      this.attachControl.setValue('', { emitEvent: false });
    });
  }

  /** Badge copy for a roster card. Drafts carry a type ID, not the resolved type the list APIs return. */
  bystanderTypeLabel(bystanderTypeId: string): string {
    const type = this.store.bystanderTypes().find((item) => item.id === bystanderTypeId);
    if (!type) {
      return '';
    }

    return type.motivation ? `${type.name}: ${type.motivation}` : type.name;
  }

  /** Pulls a card into the composer and takes focus with it — the pencil unmounts itself (§8 item 1). */
  editDraft(key: string): void {
    if (this.store.editBystanderDraft(key)) {
      this.focusComposerHeading();
    }
  }

  startNewDraft(): void {
    if (this.store.startNewBystanderDraft()) {
      this.focusComposerHeading();
    }
  }

  /** Save and Cancel unmount their own buttons when the composer collapses (§8 item 6). */
  saveDraft(): void {
    this.afterComposerCollapse(() => this.store.saveBystanderDraft());
  }

  cancelDraft(): void {
    this.afterComposerCollapse(() => this.store.cancelBystanderComposer());
  }

  requestRemove(key: string): void {
    this.pendingRemoveKey.set(key);
  }

  /** The destructive button: **Delete** on (B)/(C), plain **Remove** on (A1)/(A2). */
  onRemoveConfirmed(): void {
    this.resolveRemoval('delete');
  }

  onDetachConfirmed(): void {
    this.resolveRemoval('detach');
  }

  onRemoveCancelled(): void {
    this.pendingRemoveKey.set(null);
  }

  private resolveRemoval(action: 'detach' | 'delete'): void {
    const key = this.pendingRemoveKey();
    this.pendingRemoveKey.set(null);
    if (key === null) {
      return;
    }

    // The store records a disposition only when a persisted membership exists, so an (A1)/(A2)
    // removal is a local discard whichever button reached here.
    this.store.removeBystanderDraft(key, action);
  }

  private focusComposerHeading(): void {
    afterNextRender(
      { write: () => this.composerHeading?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }

  private afterComposerCollapse(action: () => void): void {
    const wasOpen = this.store.bystanderComposerOpen();
    action();
    if (!wasOpen || this.store.bystanderComposerOpen()) {
      return;
    }

    afterNextRender(
      { write: () => this.addAnotherButton?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }
}
