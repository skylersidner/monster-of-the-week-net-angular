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
    const wasOpen = this.store.composerOpen();
    action();
    if (!wasOpen || this.store.composerOpen()) {
      return;
    }

    afterNextRender(
      { write: () => this.addAnotherButton?.nativeElement.focus({ preventScroll: true }) },
      { injector: this.injector },
    );
  }
}
