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
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';
import { resolveMysteryNames, wizardMysteryUsageMessage, wizardRemovalFootnote } from '../../../../shared/mystery-usage';

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
  private readonly injector = inject(Injector);

  /**
   * The composer's heading. Only present while the composer is rendered, hence the optional
   * `ViewChild` — it is read inside `afterNextRender`, by which time the panel exists.
   */
  @ViewChild('composerHeading') private readonly composerHeading?: ElementRef<HTMLElement>;

  /**
   * The `+ Add Another Minion` button. Only present while the composer is *collapsed* — it and the
   * composer are the two arms of the same `@if`, which is exactly why focus has to be moved onto it
   * when the composer goes away.
   */
  @ViewChild('addAnotherButton') private readonly addAnotherButton?: ElementRef<HTMLButtonElement>;

  /** The monster composer's heading and its "+ Add Another Monster" twin — same focus contract as the minion pair. */
  @ViewChild('monsterComposerHeading') private readonly monsterComposerHeading?: ElementRef<HTMLElement>;
  @ViewChild('addAnotherMonsterButton') private readonly addAnotherMonsterButton?: ElementRef<HTMLButtonElement>;

  /** Commit-on-pick (§3): choosing an option starts the hydration, and the control resets. */
  readonly attachControl = new FormControl<string>('', { nonNullable: true });

  /** `localKey` of the monster roster card awaiting removal confirmation, or `null` when closed. */
  readonly pendingRemoveMonsterKey = signal<string | null>(null);

  private readonly pendingRemoveMonster = computed(() => {
    const key = this.pendingRemoveMonsterKey();
    return key === null ? null : (this.store.monsterDrafts().find((draft) => draft.localKey === key) ?? null);
  });

  readonly pendingRemoveMonsterName = computed(() => this.pendingRemoveMonster()?.name ?? '');

  /** The variant predicate, and it is the store's — the same one the submit diff asks (§7.1, decision 16). */
  private readonly monsterRemovePersisted = computed(() =>
    this.store.persistedForRemoval('monsters', this.pendingRemoveMonster()?.id ?? null),
  );

  /** How many *other* mysteries use this monster — from the draft's own `mysteryIds` (§15.1). */
  private readonly monsterOtherMysteryIds = computed<string[]>(() => {
    if (!this.monsterRemovePersisted()) {
      return [];
    }

    const currentMysteryId = this.store.mysteryId();
    return (this.pendingRemoveMonster()?.mysteryIds ?? []).filter((id) => id !== currentMysteryId);
  });

  /** Which mysteries, by name. Bullets render only when *every* id resolved (§15.1). */
  readonly monsterUsage = computed<string[]>(() => {
    const otherIds = this.monsterOtherMysteryIds();
    const names = resolveMysteryNames(otherIds, this.store.mysteries());
    return names.length === otherIds.length ? names : [];
  });

  private readonly monsterNamesResolved = computed(
    () => this.monsterUsage().length === this.monsterOtherMysteryIds().length,
  );

  readonly monsterUsageMessage = computed(() => {
    const draft = this.pendingRemoveMonster();
    if (!draft) {
      return '';
    }

    // (A1) authored here and never saved — nothing exists anywhere.
    if (draft.id === null) {
      return "This monster hasn't been saved yet. Removing it discards what you typed.";
    }

    // (A2) attached this session, not yet submitted. The monster is real and stays real; only a
    // membership that was never created goes away. Offering Delete here would let a user undoing a
    // mis-click destroy a catalogue monster — and its minions with it.
    if (!this.monsterRemovePersisted()) {
      return "This monster stays in your monsters list — it just won't be part of this mystery.";
    }

    return wizardMysteryUsageMessage('monster', this.monsterOtherMysteryIds().length, this.monsterNamesResolved());
  });

  /**
   * **The cascade list, and it reads the *baseline*, never the roster** (UX §18.4, §7.7i(3)).
   *
   * `[items]` is a promise about what deleting this monster will actually take, not a summary of
   * what the roster currently shows under it. A minion re-parented onto this monster during this
   * session was never persisted under it, so deletion does **not** take it — and listing it would
   * be a promise the cascade does not keep, which is the class of defect §16.4 ruled on. The
   * persisted children are exactly `MonsterDraft.existingMinionIds`, which is why J1's fix lands on
   * the field this needs.
   */
  readonly monsterCascadeItems = computed<string[]>(() => {
    const draft = this.pendingRemoveMonster();
    if (!draft || !this.monsterRemovePersisted()) {
      return [];
    }

    const byId = new Map(this.store.minionDrafts().map((minion) => [minion.id, minion.name]));
    return draft.existingMinionIds.map((minionId) => byId.get(minionId) ?? 'A minion');
  });

  /** The lead-in the cascade list needs, and nothing when there is no cascade. */
  readonly monsterCascadeMessage = computed(() =>
    this.monsterCascadeItems().length > 0 ? 'This will also delete the following minions:' : '',
  );

  readonly monsterFootnote = computed(() =>
    this.monsterRemovePersisted()
      ? wizardRemovalFootnote(
          'monster',
          this.monsterOtherMysteryIds().length > 0,
          this.store.deferredChangeTail(),
          // Attached to the Delete sentence only: detach leaves the minions alone, because they
          // travel with the monster rather than with the membership (UX §7.1, §18.3).
          this.monsterCascadeItems().length > 0 ? 'along with its minions' : '',
        )
      : '',
  );

  /** (B)/(C) get the three-button shape; (A1)/(A2) must leave both unset (§14.2b). */
  readonly monsterSecondaryLabel = computed(() => (this.monsterRemovePersisted() ? 'Detach' : null));
  readonly monsterConfirmLabel = computed(() => (this.monsterRemovePersisted() ? 'Delete' : null));

  constructor() {
    this.attachControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((monsterId) => {
      if (!monsterId) {
        return;
      }

      this.store.attachMonster(monsterId);
      this.attachControl.setValue('', { emitEvent: false });
    });
  }

  /** Badge copy for a roster card. Drafts carry a type ID, not the resolved type the list APIs return. */
  monsterTypeLabel(monsterTypeId: string): string {
    const type = this.store.monsterTypes().find((item) => item.id === monsterTypeId);
    if (!type) {
      return '';
    }

    return type.motivation ? `${type.name}: ${type.motivation}` : type.name;
  }

  /** The roster card's minion count — from the wizard's own drafts, never a list response's `minionCount`. */
  minionCountFor(monsterKey: string): number {
    return this.store.minionDrafts().filter((minion) => minion.monsterKey === monsterKey).length;
  }

  editMonster(key: string): void {
    if (this.store.editMonsterDraft(key)) {
      this.focusMonsterComposerHeading();
    }
  }

  startNewMonster(): void {
    if (this.store.startNewMonsterDraft()) {
      this.focusMonsterComposerHeading();
    }
  }

  saveMonster(): void {
    this.afterMonsterComposerCollapse(() => this.store.saveMonsterDraftToList());
  }

  cancelMonster(): void {
    this.afterMonsterComposerCollapse(() => this.store.cancelMonsterComposerEdit());
  }

  requestRemoveMonster(key: string): void {
    this.pendingRemoveMonsterKey.set(key);
  }

  onMonsterRemoveConfirmed(): void {
    this.resolveMonsterRemoval('delete');
  }

  onMonsterDetachConfirmed(): void {
    this.resolveMonsterRemoval('detach');
  }

  onMonsterRemoveCancelled(): void {
    this.pendingRemoveMonsterKey.set(null);
  }

  private resolveMonsterRemoval(action: 'detach' | 'delete'): void {
    const key = this.pendingRemoveMonsterKey();
    this.pendingRemoveMonsterKey.set(null);
    if (key === null) {
      return;
    }

    // The store records a disposition only when a persisted membership exists, so an (A1)/(A2)
    // removal is a local discard whichever button reached here.
    this.store.removeMonsterDraft(key, action);
  }

  private focusMonsterComposerHeading(): void {
    afterNextRender(
      { write: () => this.monsterComposerHeading?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }

  private afterMonsterComposerCollapse(action: () => void): void {
    const wasOpen = this.store.monsterComposerOpen();
    action();
    if (!wasOpen || this.store.monsterComposerOpen()) {
      return;
    }

    afterNextRender(
      { write: () => this.addAnotherMonsterButton?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }

  /**
   * `localKey` of the roster card awaiting removal confirmation. Confirm-on-remove is unconditional
   * for minions (Skyler, 2026-09-01) because a minion can take up to four sub-lists with it. This is
   * view state only, so it lives here rather than in the store — the same shape `minions-list`,
   * `bystanders-list` and `playbook-admin` already use.
   *
   * Keyed rather than indexed: the modal outlives the click that opened it, so a positional
   * reference could be pointing at a different minion by the time the user confirms.
   */
  readonly pendingRemoveKey = signal<string | null>(null);

  private readonly pendingRemoveDraft = computed(() => {
    const key = this.pendingRemoveKey();
    return key === null ? null : (this.store.minionDrafts().find((draft) => draft.localKey === key) ?? null);
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
   * **The minion predicate — `id !== null`, and deliberately not `persistedForRemoval`'s other
   * members** (§16.4, decision 16).
   *
   * §7.1 rejected `id !== null` for locations and bystanders because an *attached* entity has an id
   * the instant it is picked, so the test would offer permanent deletion to someone undoing a
   * mis-click. **Minions are never attached** — there is no attach strip on the minion step and
   * §2.5 says there never will be — so a minion's id can only become non-null by being saved. The
   * test that was dangerous there is the correct one here, for exactly the reason it was wrong
   * there.
   *
   * It is still routed through the store rather than written inline: `persistedForRemoval` is where
   * the three collections' answers live, its `'minions'` arm *is* `id !== null`, and the store asks
   * the same question again when it decides whether to record a pending removal. One implementation,
   * so the modal and the drain cannot disagree about what the user was shown.
   */
  readonly pendingRemovePersisted = computed(() =>
    this.store.persistedForRemoval('minions', this.pendingRemoveDraft()?.id ?? null),
  );

  /**
   * The cascade lead-in, which introduces the `items` list below it. Two variants, and both drop to
   * `''` when there is nothing to cascade — (E) with no sub-resources is title plus footnote, which
   * §16.4 rules is clear enough without filler.
   */
  readonly pendingRemoveMessage = computed(() => {
    const hasItems = this.pendingRemoveItems().length > 0;

    // (E) persisted — a real DELETE at submit. The title still says Remove; the button says Delete.
    if (this.pendingRemovePersisted()) {
      return hasItems ? 'Deleting it also removes:' : '';
    }

    // (A1-minion) never saved — nothing exists on the server, so nothing is destroyed but typing.
    return hasItems
      ? "This minion hasn't been saved yet. Removing it discards what you typed, including:"
      : "This minion hasn't been saved yet. Removing it discards what you typed.";
  });

  /**
   * Removing a roster card is not a deletion at confirm time — it drops a draft, and only a minion
   * that was already saved turns into a real DELETE when the user continues. A never-saved draft
   * destroys nothing, so it gets no permanence warning.
   *
   * The deferral clause is derived from `deferredChangeTail()` rather than written out (§15/G2):
   * phase 1 is never last today, so it always resolves to "when you continue to the next step" —
   * but this feature is reordering the phases, and a literal would go stale silently.
   */
  readonly pendingRemoveFootnote = computed(() =>
    this.pendingRemovePersisted() ? `The minion will be deleted ${this.store.deferredChangeTail()}.` : '',
  );

  /** (E) names the consequence on the button. (A1-minion) leaves it unset and reads "Remove". */
  readonly pendingRemoveConfirmLabel = computed(() => (this.pendingRemovePersisted() ? 'Delete' : null));

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

  /**
   * Pulls a roster card into the composer and takes focus with it.
   *
   * **This is the fix for the orphaned-focus defect (§8.6 item 1), and the orphaning is why it
   * cannot be done on the button itself.** Activating the pencil *unmounts the pencil* — the
   * template replaces it with the static `Editing` label — so the element that had focus stops
   * existing mid-interaction and the browser drops the user at `<body>`, at the top of the
   * document, at the exact moment the composer fills with their data. Moving focus to the composer
   * heading in `afterNextRender` lands it on text that reads "Editing “{name}”", which announces
   * the mode change with no `aria-live` needed and puts `Tab` one step from the first field.
   *
   * Focus only moves when the composer actually moved: `editMinionDraft` returns `false` when an
   * open composer holds work that cannot be committed, and in that case the pencil is still there
   * and still focused.
   */
  editDraft(key: string): void {
    if (this.store.editMinionDraft(key)) {
      this.focusComposerHeading();
    }
  }

  /**
   * "+ Add Another Minion". Same treatment and the same reason: this button is *replaced* by the
   * composer it opens, so without the focus move it orphans focus exactly as the pencil does.
   */
  startNewDraft(): void {
    if (this.store.startNewMinionDraft()) {
      this.focusComposerHeading();
    }
  }

  /**
   * Commits the composer from its own Save button, and follows the focus out.
   *
   * **The exit half of the focus contract `editDraft` opens (§8 item 6).** `Save Changes` /
   * `Save Minion` and `Cancel` **unmount themselves** when the composer collapses, exactly as the
   * pencil unmounts itself on the way in — so fixing only the entry left a keyboard user able to
   * get *into* the composer and not out of it. Focus moves to `+ Add Another Minion`, which
   * occupies the screen position the Save button just vacated.
   *
   * Guarded on the composer having actually collapsed: an invalid composer refuses to commit and
   * stays open, and in that case the button the user pressed is still there and still focused.
   */
  saveDraft(): void {
    this.afterComposerCollapse(() => this.store.saveMinionDraftToList());
  }

  /** Same contract as `saveDraft`, other verb. OQ2 gives both a single collapse path, not two. */
  cancelDraft(): void {
    this.afterComposerCollapse(() => this.store.cancelComposerEdit());
  }

  requestRemoveMinion(key: string): void {
    this.pendingRemoveKey.set(key);
  }

  onRemoveConfirmed(): void {
    const key = this.pendingRemoveKey();
    this.pendingRemoveKey.set(null);
    if (key === null) {
      return;
    }

    this.store.removeMinionDraft(key);
  }

  onRemoveCancelled(): void {
    this.pendingRemoveKey.set(null);
  }

  /** The `wizard-layout.ts:54-60` idiom: after the render, so the heading already reads the new mode. */
  private focusComposerHeading(): void {
    afterNextRender(
      { write: () => this.composerHeading?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }

  /**
   * Runs a composer action and, only if it actually closed the composer, follows the focus out.
   *
   * The guard is belt-and-braces rather than load-bearing today: `addAnotherButton` and the
   * composer are the two arms of one `@if`, so while the composer is open the `@ViewChild` is
   * undefined and the focus call is already a no-op. It is kept because that is an accident of the
   * current template, and "only move focus if the thing the user was standing on went away" is the
   * rule this method is for.
   */
  private afterComposerCollapse(action: () => void): void {
    const wasOpen = this.store.minionComposerOpen();
    action();
    if (!wasOpen || this.store.minionComposerOpen()) {
      return;
    }

    afterNextRender(
      { write: () => this.addAnotherButton?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }
}
