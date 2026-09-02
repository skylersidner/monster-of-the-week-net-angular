import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';

@Component({
  selector: 'app-mystery-create-monster-phase',
  imports: [
    ReactiveFormsModule,
    ConfirmDeleteModalComponent,
    CustomSelectComponent,
    IconComponent,
    WeaponTagSelectComponent,
  ],
  templateUrl: './mystery-create-monster-phase.html',
})
export class MysteryCreateMonsterPhaseComponent {
  readonly store = inject(MysteryCreateStore);

  /**
   * Roster index awaiting removal confirmation. Confirm-on-remove is unconditional for minions
   * (Skyler, 2026-09-01) because a minion can take up to four sub-lists with it. This is view state
   * only, so it lives here rather than in the store — the same shape `minions-list`,
   * `bystanders-list` and `playbook-admin` already use.
   */
  readonly pendingRemoveIndex = signal<number | null>(null);

  private readonly pendingRemoveDraft = computed(() => {
    const index = this.pendingRemoveIndex();
    return index === null ? null : (this.store.minionDrafts()[index] ?? null);
  });

  readonly pendingRemoveName = computed(() => this.pendingRemoveDraft()?.name ?? '');

  /**
   * What goes with the minion being removed. These counts come from `minionDrafts()[index]` and
   * must NOT be read from `store.minionAttacks()`/etc. — those are the *composer's* collections, and
   * they belong to a different minion whenever the user removes a card they are not editing.
   */
  readonly pendingRemoveItems = computed<string[]>(() => {
    const draft = this.pendingRemoveDraft();
    if (!draft) {
      return [];
    }

    return (
      [
        [draft.attacks.length, 'attack'],
        [draft.powers.length, 'power'],
        [draft.weaknesses.length, 'weakness', 'weaknesses'],
        [draft.armors.length, 'armor'],
      ] as const
    )
      .filter(([count]) => count > 0)
      .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`);
  });

  /**
   * Removing a roster card is not a deletion at confirm time — it drops a draft, and only a minion
   * that was already saved (`id !== null`) turns into a real DELETE when the user continues. A
   * never-saved draft destroys nothing, so it gets no permanence warning.
   */
  readonly pendingRemoveNote = computed(() =>
    this.pendingRemoveDraft()?.id
      ? 'The minion will be deleted when you continue to the next step.'
      : '',
  );

  tagsForAttack(tagIds: string[]) {
    return this.store.weaponTags().filter((t) => tagIds.includes(t.id));
  }

  /** Badge copy for a roster card. Drafts carry a type ID, not the resolved type the list APIs return. */
  minionTypeLabel(minionTypeId: string): string {
    const type = this.store.minionTypes().find((item) => item.id === minionTypeId);
    if (!type) {
      return '';
    }

    return type.motivation ? `${type.name}: ${type.motivation}` : type.name;
  }

  requestRemoveMinion(index: number): void {
    this.pendingRemoveIndex.set(index);
  }

  onRemoveConfirmed(): void {
    const index = this.pendingRemoveIndex();
    this.pendingRemoveIndex.set(null);
    if (index === null) {
      return;
    }

    this.store.removeMinionDraft(index);
  }

  onRemoveCancelled(): void {
    this.pendingRemoveIndex.set(null);
  }
}
