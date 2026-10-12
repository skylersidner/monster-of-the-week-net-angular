import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap, tap, throwError } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { CustomMoveService } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import {
  AdventureTypeResponse,
  BystanderListItemResponse,
  CustomMoveOwnerType,
  CustomMoveResponse,
  LocationListItemResponse,
  MonsterListItemResponse,
  MysteryListItemResponse,
  MinionArmorResponse,
  MinionAttackResponse,
  MinionDetailResponse,
  MinionPowerResponse,
  MinionWeaknessResponse,
  MonsterArchetypeResponse,
  MonsterArmorResponse,
  MonsterAttackResponse,
  MonsterPowerResponse,
  MonsterWeaknessResponse,
  TypeRefResponse,
  UpsertBystanderRequest,
  UpsertCustomMoveRequest,
  UpsertMinionArmorRequest,
  UpsertMinionAttackRequest,
  UpsertMinionPowerRequest,
  UpsertMinionWeaknessRequest,
  UpsertMonsterArmorRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterWeaknessRequest,
  UpsertCountdownRequest,
  UpsertLocationRequest,
  UpsertMinionRequest,
  UpsertMonsterRequest,
  UpsertMysteryRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import type { MysterySectionIconKind } from '../../shared/mystery-section-icon';
import { HydratedMonster, rekeyDrafts, toHydratedMonster } from './hydrate-monster';
import {
  SubResourceService,
  applySubResourceDiff,
  sameNullableText,
  sameWeaponTags,
  weaponTagOperations,
} from './sub-resource-diff';

/**
 * Identity for a sub-resource draft, carried by all four kinds.
 *
 * **`id` is what makes the diff an upsert** (decision 8): `null` means create, set means update, and
 * a baseline row that no draft claims means delete. Before 5a these arrays held no identity at all
 * and every submit deleted the lot and recreated it, re-keying every row.
 *
 * **`localKey` is what makes it addressable** (§5.4). `id` cannot do that job — an unsaved row has
 * none — and the array index was standing in for identity, which is the bug source Phase 3 removed
 * one level up. Minted at author and at hydration, never sent to the server.
 */
export interface SubResourceIdentity {
  id: string | null;
  localKey: string;
}

export interface AttackDraft extends SubResourceIdentity {
  name: string;
  harm: number;
  description: string;
  weaponTagIds: string[];
}

export interface PowerDraft extends SubResourceIdentity {
  name: string;
  description: string;
}

export interface WeaknessDraft extends SubResourceIdentity {
  name: string;
  description: string;
}

/**
 * A custom move staged in the wizard.
 *
 * **It extends `SubResourceIdentity` and is deliberately *not* `CustomMoveRow`** (§35.5): the
 * card's row type collapses identity into one opaque `key`, which is the right simplification for
 * a surface that writes immediately, and the wrong one here — the diff needs `id` to decide
 * create-versus-update and `localKey` to keep a clean row stable across the phase transition where
 * the id arrives. Two view models of one wire type; neither derives from the other.
 *
 * Structurally identical to `PowerDraft`, which is why `addNamedDraft` serves both. Named
 * separately because they are different collections, not because they differ in shape.
 */
export interface CustomMoveDraft extends SubResourceIdentity {
  name: string;
  description: string;
}

export interface ArmorDraft extends SubResourceIdentity {
  name: string;
  description: string;
  harmSoak: number;
  isSpecial: boolean;
  specialDescription: string;
}

export interface LocationDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  /** Stable client identity — see `MinionDraft.localKey`. Minted at author, attach and hydration. */
  localKey: string;
  name: string;
  description: string;
  locationTypeId: string;
  /**
   * The mysteries this entity belonged to when it was hydrated or attached. Read only by the
   * removal modal, to name the *other* mysteries a Delete would take it out of (§7.2). A page-load
   * snapshot, and accepted as such — S1 says staleness changes the wording and never the buttons.
   */
  mysteryIds: string[];
}

export interface BystanderDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  /** Stable client identity — see `MinionDraft.localKey`. Minted at author, attach and hydration. */
  localKey: string;
  name: string;
  description: string;
  bystanderTypeId: string;
  /** See `LocationDraft.mysteryIds`. */
  mysteryIds: string[];
}

/** Which catalogue a pending removal belongs to. Monsters and minions join in Phase 5. */
/**
 * The collections whose removals go through `pendingRemovals`. Monsters join in 5b.
 *
 * **Minions are here despite having no mystery membership** (decision 17). They have the identical
 * tracker-jump hole G1 described: `jumpToPhase` does not submit, so a confirmed minion deletion was
 * silently discarded. What they do *not* have is a disposition choice — see `PendingRemoval`.
 */
export type RemovalCollection = 'locations' | 'bystanders' | 'monsters' | 'minions';

/**
 * A removal the user confirmed through the modal, waiting for a phase submit to apply it
 * (decision 12 — nothing is destroyed until you continue).
 *
 * **Wizard-scoped, not per-phase** (decision 15, architecture §7.3.1). Scoping it to the phase that
 * recorded it is the natural implementation and it reintroduces Peach's G1: in edit mode
 * `jumpToPhase` sets the phase without submitting and `isPhaseAccessible` allows any phase, so
 * trashing a location, confirming **Delete**, clicking the Bystanders bubble and pressing Finish
 * would never submit phase 2 — and the confirmed deletion would silently not happen. A removal
 * names a collection, an id and a disposition; applying it never depended on which phase submits.
 */
export type PendingRemoval =
  | { collection: 'locations' | 'bystanders' | 'monsters'; id: string; action: 'detach' | 'delete' }
  /**
   * **Delete-only, and the type refuses `'detach'` rather than tolerating it.** A minion has no
   * mystery membership — `Minion.MonsterId` is a required FK — so there is nothing to detach from
   * and the modal never offers the button (UX §16.4). Encoding that here means a caller that
   * reaches for `'detach'` on a minion fails to compile instead of recording a disposition the
   * drain would have to decide what to do with.
   */
  | { collection: 'minions'; id: string; action: 'delete' };

/**
 * The wizard's minion harm-capacity default. Single-sourced because `minionComposerDirty()` treats
 * "harm capacity is no longer the default" as evidence the user started a minion — see §1.3 of
 * `docs/updates/multi-minion-support.md`. It deliberately differs from `MinionFormComponent`'s 0.
 */
export const MINION_DEFAULT_HARM_CAPACITY = 3;

/** The monster composer's default, single-sourced for the same reason — `monsterComposerDirty()`. */
export const MONSTER_DEFAULT_HARM_CAPACITY = 7;

/** Error-band copy when the open composer holds work that cannot be committed yet (Rosalina §1.4). */
const COMPOSER_BLOCKED_MESSAGE = "Finish or clear the minion you're editing before continuing.";

/** The same rule, per entity — UX §2.3 asks all four phases to behave identically here. */
const MONSTER_COMPOSER_BLOCKED_MESSAGE = "Finish or clear the monster you're editing before continuing.";
const LOCATION_COMPOSER_BLOCKED_MESSAGE = "Finish or clear the location you're editing before continuing.";
const BYSTANDER_COMPOSER_BLOCKED_MESSAGE = "Finish or clear the bystander you're editing before continuing.";
/** Step `0-4`'s add form. "Adding" rather than "editing" because that panel has no row edit (§13.5.3). */
const CUSTOM_MOVE_BLOCKED_MESSAGE = "Finish or clear the custom move you're adding before continuing.";

/**
 * Monotonic within a session, so a key is never reused even after the roster is cleared and
 * rehydrated. A counter rather than a UUID because the value never leaves the browser and a
 * readable key makes a failing roster assertion legible.
 */
let nextDraftKey = 0;

/** Mints a stable client key for a draft. See `MinionDraft.localKey`. */
export function createDraftKey(prefix = 'minion'): string {
  return `${prefix}-${++nextDraftKey}`;
}

/**
 * One monster on the wizard's roster (decision 2, §6.1). Replaces the single `monsterForm` +
 * `editingMonsterId` pair the wizard used until 5b.
 *
 * Everything below travels with the draft, and that is the point rather than a layout choice: a
 * monster that leaves the roster takes its baselines with it, so there is no separate bookkeeping
 * step that can be forgotten. §7.7i is that argument applied to `existingMinionIds`.
 */
export interface MonsterDraft {
  /** `null` until saved in this session, or hydrated/attached from an existing monster. */
  id: string | null;
  /** Stable client identity — see `MinionDraft.localKey`. Minted with `createDraftKey('monster')`. */
  localKey: string;
  name: string;
  description: string;
  harmCapacity: number;
  monsterTypeId: string;
  monsterArchetypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
  /** Per-draft sub-resource baseline. Responses, not ids — see `MinionDraft.existingAttacks`. */
  existingAttacks: MonsterAttackResponse[];
  existingPowers: MonsterPowerResponse[];
  existingWeaknesses: MonsterWeaknessResponse[];
  existingArmors: MonsterArmorResponse[];
  /**
   * **The persisted minions of *this* monster** (J1, §7.7i) — replacing the store-level flat
   * `existingMinionIds` the wizard carried until 5b.
   *
   * **This is what makes J1 unexpressible rather than fixed.** The flat signal made "removing a
   * monster must also forget its minions' baseline" a rule someone had to remember, and
   * `idsToRemove` computes *baseline − drafts − disposed*: a persisted minion of a removed monster
   * was in the baseline, out of the drafts (§7.7d dropped it) and out of the dispositions (§7.7f
   * dropped those) — so it fell through to a blind `delete()` on the diff path, which has no 404
   * handler. Under detach that destroys the minions everywhere, which is the exact opposite of what
   * the modal promises. Here the baseline leaves *with the draft*, because it is a field on it.
   *
   * It is also the correct source for the removal modal's cascade `[items]` (§7.7i(3), UX §18.4):
   * `[items]` is a promise about what deletion will take, and a minion re-parented onto this
   * monster this session was never persisted under it. The roster is the wrong source and the
   * difference is precisely that minion.
   */
  existingMinionIds: string[];
  /** See `LocationDraft.mysteryIds` — the other mysteries the removal modal names. */
  mysteryIds: string[];
}

/**
 * One minion under one of the roster's monsters. Unlike `LocationDraft`/`BystanderDraft` — flat leaf
 * entities where `id` was the whole story — a minion owns four sub-resource collections, so each
 * draft carries both its own collections **and** its own baseline of the rows the server last
 * returned for them. Those two halves are what `applySubResourceDiff` diffs, per minion.
 */
export interface MinionDraft {
  /** `null` until this draft has been saved at least once in this session (or hydrated from an existing mystery). */
  id: string | null;
  /**
   * Stable client-side identity, minted at creation *and* at hydration, never sent to the server
   * and never changed for the life of the draft (UX §10.2).
   *
   * This exists because `id` cannot do the job: a draft authored in this session has no server ID
   * until the phase transition saves it, so a roster of unsaved drafts has nothing to address rows
   * by. The array index was standing in for identity, and that is a bug source rather than a
   * shortcut — `removeMinionDraft` had to hand-adjust `editingDraftIndex` after every splice or
   * silently overwrite a bystanding draft. With a key, removal is a filter and nothing shifts.
   *
   * It is also what `@for` tracks, so removing one row no longer re-creates every row after it.
   */
  localKey: string;
  /**
   * **Which roster monster this minion points at now** (§6.4). A `localKey`, not a server id: a
   * monster authored in this session has no id until the phase transition saves it, so the draft
   * cannot hold one. `submitPhase1` resolves `localKey → monsterId` after the monsters are saved.
   */
  monsterKey: string;
  /**
   * **Which monster the *server* has this minion under**, as of the last submit or hydration;
   * `null` for a minion that has never been saved (J2, §6.4).
   *
   * Without it there is no way to ask "did the parent change?", so a re-parent would fire
   * unconditionally for every persisted minion on every submit — of a verb that **moves** and, aimed
   * at a stale id, silently relocates rather than failing. It also decides which minion drafts leave
   * with a removed monster (§7.7i): J1's fix needs it, so the two are not independent.
   *
   * It is the server **id** rather than a baseline `monsterKey` because keys are client-side and
   * hydration mints fresh ones, so comparing them across a load boundary is meaningless.
   */
  existingMonsterId: string | null;
  name: string;
  description: string;
  harmCapacity: number;
  minionTypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
  /**
   * **The baseline: the server responses themselves, not a list of ids** (§5.4).
   *
   * The ids come off these with `.map`, so the delete-detection the old `existing*Ids` arrays
   * existed for is unchanged — and the *value* comparison the dirty check needs (decision 9) comes
   * free in the same field, with no second array that could disagree with the first. That
   * disagreement is the Bug 2 shape this file has been bitten by twice.
   *
   * The weapon-tag diff needs these for a second reason: `MonsterAttackResponse.weaponTags` exists
   * only on the response, so "what did the server last have" is unanswerable from an id list.
   */
  existingAttacks: MinionAttackResponse[];
  existingPowers: MinionPowerResponse[];
  existingWeaknesses: MinionWeaknessResponse[];
  existingArmors: MinionArmorResponse[];
}

interface SavedThreatCollections {
  attacks: MonsterAttackResponse[];
  powers: MonsterPowerResponse[];
  weaknesses: MonsterWeaknessResponse[];
  armors: MonsterArmorResponse[];
}

/** One roster row's save result, carried back to `writeBackMonsterDrafts` by draft index. */
interface SavedMonster {
  index: number;
  id: string;
  collections: SavedThreatCollections;
}

/** The same, one level down, plus the parent the minion was actually saved against (J2). */
interface SavedMinion {
  index: number;
  minionId: string;
  monsterId: string;
  collections: SavedMinionCollections;
}

interface SavedMinionCollections {
  attacks: MinionAttackResponse[];
  powers: MinionPowerResponse[];
  weaknesses: MinionWeaknessResponse[];
  armors: MinionArmorResponse[];
}

/**
 * A locations/bystanders roster row's save result, carried back to its writeback by draft index.
 *
 * The flat twin of `SavedMonster`: one id and no collections — *yet*. 5f-3a adds the row's
 * custom-move baseline here, which is the whole reason phases 2 and 3 were given the per-row shape
 * in 5f-0. One type for both rosters, because the operation is identical and the draft type it is
 * written back onto is the only thing that differs.
 */
interface SavedFlatRow {
  index: number;
  id: string;
}

interface PhaseDefinition {
  index: number;
  name: string;
  icon: MysterySectionIconKind;
  steps: number;
  stepsArray: readonly number[];
}

type AttackFormGroup = FormGroup<{
  name: FormControl<string>;
  harm: FormControl<number>;
  description: FormControl<string | null>;
  weaponTagIds: FormControl<string[]>;
}>;

type NamedDraftFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
}>;

type LocationFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  locationTypeId: FormControl<string>;
}>;

type BystanderFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  bystanderTypeId: FormControl<string>;
}>;

type ArmorFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string | null>;
  harmSoak: FormControl<number>;
  isSpecial: FormControl<boolean>;
  specialDescription: FormControl<string | null>;
}>;

@Injectable()
export class MysteryCreateStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly mysteryService = inject(MysteryService);
  private readonly monsterService = inject(MonsterService);
  private readonly minionService = inject(MinionService);
  private readonly locationService = inject(LocationService);
  private readonly bystanderService = inject(BystanderService);
  private readonly customMoveService = inject(CustomMoveService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly notificationService = inject(NotificationService);

  private initialized = false;

  readonly phases: readonly PhaseDefinition[] = [
    // Step 4 is the mystery's own custom moves (5f-1). A fifth *step*, not a phase: phase 0 is
    // "the mystery's own fields" and a move is the mystery's own sub-resource, so it belongs here —
    // and a new phase would renumber the tracker and imply a new kind of thing. Last in the phase,
    // after Countdown, so the three prose steps stay adjacent.
    { index: 0, name: 'Mystery', icon: 'mystery', steps: 5, stepsArray: [0, 1, 2, 3, 4] },
    { index: 1, name: 'Monsters', icon: 'monster', steps: 2, stepsArray: [0, 1] },
    { index: 2, name: 'Locations', icon: 'locations', steps: 1, stepsArray: [0] },
    { index: 3, name: 'Bystanders', icon: 'bystanders', steps: 1, stepsArray: [0] },
  ];
  readonly lastPhaseIndex = this.phases.length - 1;

  readonly currentPhase = signal(0);

  /**
   * How the deferred-execution copy names the button that will apply the change (§7.1, G2).
   *
   * Bystanders is `lastPhaseIndex`, so its control reads **Finish**, not `Next →` — "continue to
   * the next step" names a step that does not exist there, and this sentence is the only thing
   * carrying the deferred-execution model to the user, so it cannot simply be dropped.
   *
   * **Derived, not hardcoded per phase component.** Locations is never last and Bystanders always
   * is, so each component could state its own — and that silently rots the first time a phase is
   * inserted, which Phase 5 does. One expression beats two strings that can go stale. Both the
   * removal modal's footnote and the minion phase's note read from here.
   */
  readonly deferredChangeTail = computed(() =>
    this.currentPhase() === this.lastPhaseIndex ? 'when you press Finish' : 'when you continue to the next step',
  );
  readonly currentStep = signal(0);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly mysteryId = signal<string | null>(null);
  readonly phaseComplete = signal([false, false, false, false]);

  readonly monsterTypes = signal<TypeRefResponse[]>([]);
  readonly monsterArchetypes = signal<MonsterArchetypeResponse[]>([]);
  readonly minionTypes = signal<TypeRefResponse[]>([]);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly weaponTags = signal<WeaponTagRefResponse[]>([]);
  readonly adventureTypes = signal<AdventureTypeResponse[]>([]);

  readonly monsterAttacks = signal<AttackDraft[]>([]);
  /**
   * The mystery's own custom moves — the drafts, and the server's view of them.
   *
   * The pair travels together everywhere it is written (H2, and BUG 2's principle 5): hydration
   * sets both from one response object, and the submit's writeback sets both from one diff result.
   * No path can set an id without recording the baseline it came from.
   */
  readonly mysteryCustomMoves = signal<CustomMoveDraft[]>([]);
  private readonly existingMysteryCustomMoves = signal<CustomMoveResponse[]>([]);

  readonly monsterPowers = signal<PowerDraft[]>([]);
  readonly monsterWeaknesses = signal<WeaknessDraft[]>([]);
  readonly monsterArmors = signal<ArmorDraft[]>([]);
  readonly minionAttacks = signal<AttackDraft[]>([]);
  readonly minionPowers = signal<PowerDraft[]>([]);
  readonly minionWeaknesses = signal<WeaknessDraft[]>([]);
  readonly minionArmors = signal<ArmorDraft[]>([]);
  readonly locations = signal<LocationDraft[]>([]);
  readonly bystanders = signal<BystanderDraft[]>([]);

  readonly isEditMode = signal(false);

  /** The monster roster. One entry per monster in this mystery, in creation order (no reordering). */
  readonly monsterDrafts = signal<MonsterDraft[]>([]);
  /** `localKey` of the roster card the monster composer is editing; `null` when authoring a new one. */
  readonly editingMonsterKey = signal<string | null>(null);
  /** Whether the monster composer panel is rendered. Same non-derivable invariant as `minionComposerOpen`. */
  readonly monsterComposerOpen = signal(true);

  /** The roster. One entry per minion across all of the mystery's monsters (§6.3 — flat, with a `monsterKey`). */
  readonly minionDrafts = signal<MinionDraft[]>([]);
  /**
   * `localKey` of the roster card the composer is editing, or `null` when composing a brand-new
   * minion. Replaces the former `editingDraftIndex`: a key survives every roster mutation, so the
   * "removal invalidates the pointer" hazard this used to carry cannot arise (UX §10.2).
   */
  readonly editingMinionKey = signal<string | null>(null);
  /**
   * Whether the composer panel is rendered. This is NOT derivable from `editingMinionKey`: "roster
   * non-empty, nothing being edited, collapsed" and "roster non-empty, user clicked + Add Another
   * Minion" both have `editingMinionKey() === null`. Nor from "the composer is non-empty" — that
   * would collapse the panel the user just opened. Invariant: `editingMinionKey() !== null` implies
   * `minionComposerOpen()`; every method that writes one writes the other.
   */
  readonly minionComposerOpen = signal(true);

  /**
   * **The minion baseline, flattened out of the roster** (J1, §7.7i). Derived, never maintained.
   *
   * Its only consumers are `persistedForRemoval('minions', …)` and the per-monster diff's "has this
   * minion been persisted anywhere" question. Because it is a `computed` over
   * `MonsterDraft.existingMinionIds`, a monster leaving the roster removes its minions from it in
   * the same instant and with no bookkeeping step — which is the whole of J1's fix. There is no
   * writable minion baseline left to fall out of step.
   */
  private readonly existingMinionIds = computed(() =>
    this.monsterDrafts().flatMap((draft) => draft.existingMinionIds),
  );
  /**
   * The memberships this mystery actually has on the server, as of the last successful submit.
   *
   * **This is the one fact the removal modal and the submit diff both key on**, and it is exposed
   * through `persistedForRemoval()` so there is exactly one implementation of the question (§7.1,
   * decision 16). `id !== null` is the intuitive predicate and it is the wrong one: an attached
   * entity has an id the instant it is picked, and no membership row until the phase submits — so
   * keying on the id offers **Delete** to a user undoing a mis-click ten seconds old.
   */
  private readonly existingLocationIds = signal<string[]>([]);
  private readonly existingBystanderIds = signal<string[]>([]);
  /** The monster memberships this mystery has on the server. The roster's own baseline (§7.1). */
  private readonly existingMonsterIds = signal<string[]>([]);

  /** `localKey` of the roster card each phase's composer is editing; `null` when authoring a new one. */
  readonly editingLocationKey = signal<string | null>(null);
  readonly editingBystanderKey = signal<string | null>(null);
  /** Whether each composer panel is rendered. Same non-derivable invariant as `minionComposerOpen`. */
  readonly locationComposerOpen = signal(true);
  readonly bystanderComposerOpen = signal(true);

  /** The catalogues the attach strips offer from, and the mystery names the removal modal needs. */
  private readonly catalogLocations = signal<LocationListItemResponse[]>([]);
  private readonly catalogBystanders = signal<BystanderListItemResponse[]>([]);
  private readonly catalogMonsters = signal<MonsterListItemResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  /**
   * **The attach strip's transient states, and they are monsters-only** (UX §17.1, §17.5).
   *
   * Locations and bystanders attach from data the list response already carries, so their pick is a
   * pure client-side transform with no request and therefore no busy or error state to have. A
   * monster needs `getById` + `getByMonster` + a `getById` per minion before its card has anything
   * real to show, so the feedback §3 was protecting moves into the control the user is looking at.
   *
   * `attachingMonsterName` is the *name*, not a boolean, because the busy label says which monster.
   */
  readonly attachingMonsterName = signal<string | null>(null);
  readonly monsterAttachError = signal<string | null>(null);
  /** `Next` is disabled while this is true (UX §17.3) — a deliberate pick must not silently evaporate. */
  readonly monsterAttachInFlight = computed(() => this.attachingMonsterName() !== null);

  /** Everything in the catalogue that is not already on the roster (A2). */
  readonly attachableLocations = computed(() => {
    const onRoster = new Set(this.locations().map((draft) => draft.id));
    return this.catalogLocations().filter((item) => !onRoster.has(item.id));
  });
  readonly attachableBystanders = computed(() => {
    const onRoster = new Set(this.bystanders().map((draft) => draft.id));
    return this.catalogBystanders().filter((item) => !onRoster.has(item.id));
  });
  readonly attachableMonsters = computed(() => {
    const onRoster = new Set(this.monsterDrafts().map((draft) => draft.id));
    return this.catalogMonsters().filter((item) => !onRoster.has(item.id));
  });
  /** A1/A3: an empty catalogue hides the strip entirely; a fully-attached one keeps it, with its empty state. */
  readonly locationCatalogEmpty = computed(() => this.catalogLocations().length === 0);
  readonly bystanderCatalogEmpty = computed(() => this.catalogBystanders().length === 0);
  readonly monsterCatalogEmpty = computed(() => this.catalogMonsters().length === 0);

  /**
   * The minion composer's parent picker (§6.4, UX §6). **Options are the in-memory roster, not the
   * monster catalogue**, and their *values are `localKey`s* — a monster authored this session has no
   * server id, so a control valued on ids could not offer it at all (`5b-K2`, `5b-R5`).
   */
  readonly monsterPickerOptions = computed(() =>
    this.monsterDrafts().map((draft) => ({ id: draft.localKey, name: draft.name.trim() || 'Untitled monster' })),
  );

  /**
   * The roster's single monster when there is exactly one, else `null` (UX §6's first row).
   *
   * Drives two things that must agree: the prose line the template renders instead of a picker, and
   * the value `resetComposer` puts in the control. `isMonsterLocked()`'s shipped behaviour, and it
   * keeps the common single-monster case at zero extra clicks.
   */
  readonly soleMonsterKey = computed(() => {
    const drafts = this.monsterDrafts();
    return drafts.length === 1 ? drafts[0].localKey : null;
  });
  readonly soleMonsterName = computed(() => {
    const drafts = this.monsterDrafts();
    return drafts.length === 1 ? drafts[0].name : '';
  });

  /** Which monster a minion roster card belongs to, by name (`5b-K6`). Reads `monsterKey`, so a pending move shows. */
  monsterNameForKey(monsterKey: string): string {
    return this.monsterDrafts().find((draft) => draft.localKey === monsterKey)?.name ?? '';
  }

  /** Confirmed removals waiting for any phase submit to apply them. See `PendingRemoval`. */
  readonly pendingRemovals = signal<PendingRemoval[]>([]);

  readonly conceptForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(1)]),
    concept: this.fb.control(''),
    adventureTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly hookForm = this.fb.group({
    hook: this.fb.control(''),
  });

  readonly overviewForm = this.fb.group({
    overview: this.fb.control(''),
  });

  readonly countdownForm = this.fb.group({
    day: this.fb.control(''),
    shadows: this.fb.control(''),
    sunset: this.fb.control(''),
    dusk: this.fb.control(''),
    nightfall: this.fb.control(''),
    midnight: this.fb.control(''),
  });

  readonly monsterForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmCapacity: this.fb.nonNullable.control(MONSTER_DEFAULT_HARM_CAPACITY, [Validators.required, Validators.min(0)]),
    monsterTypeId: this.fb.nonNullable.control('', [Validators.required]),
    monsterArchetypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly minionForm = this.fb.group({
    /**
     * **The parent picker's control, valued on the roster monster's `localKey`** (§6.4, UX §6).
     *
     * First field of the composer, not last: it is the minion's parent and every other field is
     * meaningless without it. With exactly one monster the template renders a prose line instead of
     * a control and the store fills this in — the validator still applies, so "a minion cannot be
     * saved without a monster" (`5b-K5`) holds on both branches.
     */
    monsterKey: this.fb.nonNullable.control('', [Validators.required]),
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmCapacity: this.fb.nonNullable.control(MINION_DEFAULT_HARM_CAPACITY, [Validators.required, Validators.min(0)]),
    minionTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly monsterAttackForm: AttackFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    description: this.fb.control(''),
    weaponTagIds: this.fb.nonNullable.control<string[]>([]),
  });

  readonly mysteryCustomMoveForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly monsterPowerForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly monsterWeaknessForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly minionAttackForm: AttackFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    harm: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    description: this.fb.control(''),
    weaponTagIds: this.fb.nonNullable.control<string[]>([]),
  });

  readonly minionPowerForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly minionWeaknessForm: NamedDraftFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
  });

  readonly monsterArmorForm: ArmorFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmSoak: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.fb.nonNullable.control(false),
    specialDescription: this.fb.control(''),
  });

  readonly minionArmorForm: ArmorFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    harmSoak: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    isSpecial: this.fb.nonNullable.control(false),
    specialDescription: this.fb.control(''),
  });

  readonly addLocationForm: LocationFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    locationTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly addBystanderForm: BystanderFormGroup = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.control(''),
    bystanderTypeId: this.fb.nonNullable.control('', [Validators.required]),
  });

  private readonly conceptValue = toSignal(this.conceptForm.valueChanges.pipe(startWith(this.conceptForm.getRawValue())));
  private readonly hookValue = toSignal(this.hookForm.valueChanges.pipe(startWith(this.hookForm.getRawValue())));
  private readonly overviewValue = toSignal(this.overviewForm.valueChanges.pipe(startWith(this.overviewForm.getRawValue())));
  private readonly countdownValue = toSignal(
    this.countdownForm.valueChanges.pipe(startWith(this.countdownForm.getRawValue()))
  );
  private readonly monsterValue = toSignal(this.monsterForm.valueChanges.pipe(startWith(this.monsterForm.getRawValue())));
  private readonly minionValue = toSignal(this.minionForm.valueChanges.pipe(startWith(this.minionForm.getRawValue())));

  private readonly locationValue = toSignal(
    this.addLocationForm.valueChanges.pipe(startWith(this.addLocationForm.getRawValue())),
  );
  private readonly bystanderValue = toSignal(
    this.addBystanderForm.valueChanges.pipe(startWith(this.addBystanderForm.getRawValue())),
  );

  /**
   * "The user has started something here." Deliberately wider than `form.valid`, for the same
   * reason `minionComposerDirty` is: a composer holding a name and no type must block `Next` rather than
   * be silently discarded. A type picked with no name counts too.
   */
  readonly locationComposerDirty = computed(() => {
    const value = this.locationValue();
    return (
      (value?.name ?? '').trim().length > 0 ||
      (value?.description ?? '').trim().length > 0 ||
      (value?.locationTypeId ?? '').length > 0
    );
  });
  readonly bystanderComposerDirty = computed(() => {
    const value = this.bystanderValue();
    return (
      (value?.name ?? '').trim().length > 0 ||
      (value?.description ?? '').trim().length > 0 ||
      (value?.bystanderTypeId ?? '').length > 0
    );
  });

  private readonly monsterAttackTagIds = toSignal(
    this.monsterAttackForm.controls.weaponTagIds.valueChanges.pipe(
      startWith(this.monsterAttackForm.controls.weaponTagIds.value)
    )
  );
  readonly selectedMonsterAttackTags = computed(() =>
    (this.monsterAttackTagIds() ?? [])
      .map((id) => this.weaponTags().find((t) => t.id === id))
      .filter((t): t is WeaponTagRefResponse => t !== undefined)
  );

  private readonly minionAttackTagIds = toSignal(
    this.minionAttackForm.controls.weaponTagIds.valueChanges.pipe(
      startWith(this.minionAttackForm.controls.weaponTagIds.value)
    )
  );
  readonly selectedMinionAttackTags = computed(() =>
    (this.minionAttackTagIds() ?? [])
      .map((id) => this.weaponTags().find((t) => t.id === id))
      .filter((t): t is WeaponTagRefResponse => t !== undefined)
  );

  readonly mysteryPreview = computed(() => ({
    name: this.conceptValue()?.name ?? '',
    concept: this.conceptValue()?.concept ?? '',
    adventureTypeName: this.adventureTypes().find((t) => t.id === (this.conceptValue()?.adventureTypeId ?? ''))?.name ?? '',
    hook: this.hookValue()?.hook ?? '',
    overview: this.overviewValue()?.overview ?? '',
    countdown: this.countdownValue(),
    // The dossier's source for the Mystery block. A collection missing from the dossier reads to
    // the user as a collection that did not save (14-R10), so it travels through the preview rather
    // than being read straight off the signal in the template.
    customMoves: this.mysteryCustomMoves(),
  }));

  readonly phaseStepComplete = computed<boolean[][]>(() => {
    const preview = this.mysteryPreview();
    const hasAnyCountdown = Object.values(preview.countdown ?? {}).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );

    return [
      // Phase 0 — Mystery (concept, hook, overview, countdown)
      [
        preview.name.trim().length > 0 && (this.conceptValue()?.adventureTypeId ?? '').length > 0,
        (preview.hook ?? '').trim().length > 0,
        (preview.overview ?? '').trim().length > 0,
        hasAnyCountdown,
        // "Has content", uniformly with the other eight dots (J3). Not "visited", not "satisfied" —
        // the step is optional and an empty collection still advances.
        this.mysteryCustomMoves().length > 0,
      ],
      // Phase 1 — Monsters (monster, minion)
      [
        // **The dot means "has content", uniformly across all eight** (J3, UX §18.2). Until 5b this
        // read `monsterPreview().name && monsterValue().monsterArchetypeId` — i.e. the *live
        // composer form*, which is exactly the flicker its sibling below warns about: lit on the
        // first keystroke, dark again on Next. So this consumer was replaced rather than re-pointed.
        //
        // Not to be confused with the phase *bubble*: §16.2's "don't gate phase 1 on monster count"
        // is about `phaseComplete`, and applying it here would produce a permanently lit dot.
        this.monsterDrafts().length > 0,
        // Lights when any minion is on the roster. Reads minionDrafts(), never the composer: an
        // uncommitted composer would flicker the dot on the first keystroke and drop it again on Next.
        // The step stays optional — an empty roster still advances.
        this.minionDrafts().length > 0,
      ],
      // Phase 2 — Locations
      [this.locations().length > 0],
      // Phase 3 — Bystanders
      [this.bystanders().length > 0],
    ];
  });

  /**
   * **The monster *composer's* own preview** (J5). Renamed from `monsterPreview` in 5b, because
   * under a roster "the monster" has no single referent and the old name invited exactly the
   * mistake `phaseStepComplete:601` had made: reading the live composer form as if it were saved
   * content. Its sole consumer is the dossier's one expanded entry — the row loaded in the
   * composer — which is the role `minionPreview` already plays one step over.
   */
  readonly monsterComposerPreview = computed(() => {
    const typeId = this.monsterValue()?.monsterTypeId ?? '';
    const type = this.monsterTypes().find((item) => item.id === typeId);
    const archetypeId = this.monsterValue()?.monsterArchetypeId ?? '';
    const archetype = this.monsterArchetypes().find((a) => a.id === archetypeId);
    return {
      name: this.monsterValue()?.name ?? '',
      description: this.monsterValue()?.description ?? '',
      harmCapacity: this.monsterValue()?.harmCapacity ?? 7,
      typeName: type?.name ?? '',
      archetypeName: archetype?.name ?? '',
      attacks: this.monsterAttacks(),
      powers: this.monsterPowers(),
      weaknesses: this.monsterWeaknesses(),
      armors: this.monsterArmors(),
    };
  });

  readonly currentSectionIcon = computed<MysterySectionIconKind>(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (phase === 0 && step === 3) {
      return 'countdown';
    }

    if (phase === 1 && step === 1) {
      return 'minions';
    }

    return this.phases[phase]?.icon ?? 'mystery';
  });

  readonly minionPreview = computed(() => {
    const typeId = this.minionValue()?.minionTypeId ?? '';
    const type = this.minionTypes().find((item) => item.id === typeId);
    return {
      name: this.minionValue()?.name ?? '',
      description: this.minionValue()?.description ?? '',
      harmCapacity: this.minionValue()?.harmCapacity ?? MINION_DEFAULT_HARM_CAPACITY,
      typeName: type?.name ?? '',
      attacks: this.minionAttacks(),
      powers: this.minionPowers(),
      weaknesses: this.minionWeaknesses(),
      armors: this.minionArmors(),
    };
  });

  /**
   * True once there is anything in the composer worth blocking `Next` over. Deliberately wider than
   * the `minionSectionStarted()` it replaces (§1.3, approved by Skyler 2026-09-01):
   *
   * - it includes **Name**, because the old computed's job was "is Name required?" and a name cannot
   *   make itself required — under the draft-list model a name-only composer is simply not in
   *   `minionDrafts()`, so `submitPhase1` would never see it and the typed name would vanish silently;
   * - it includes the **four sub-resource signals**, so a composer holding two attacks and no name
   *   blocks instead of discarding both;
   * - it includes `harmCapacity !== MINION_DEFAULT_HARM_CAPACITY`. Accepted consequence: nudging harm
   *   capacity alone marks the composer dirty and blocks `Next` until Name and Type are supplied.
   */
  readonly minionComposerDirty = computed(() => {
    const value = this.minionValue();
    if (!value) {
      return false;
    }

    return (
      (value.name ?? '').trim().length > 0 ||
      (value.description ?? '').trim().length > 0 ||
      (value.minionTypeId ?? '').length > 0 ||
      (value.harmCapacity ?? MINION_DEFAULT_HARM_CAPACITY) !== MINION_DEFAULT_HARM_CAPACITY ||
      this.minionAttacks().length > 0 ||
      this.minionPowers().length > 0 ||
      this.minionWeaknesses().length > 0 ||
      this.minionArmors().length > 0
    );
  });

  /**
   * **Which monster the composer's minion belongs to, resolved** (UX §6).
   *
   * With exactly one monster on the roster there is no picker and nothing to choose, so the store
   * answers and the template renders a prose line — `isMonsterLocked()`'s shipped behaviour. With
   * two or more the control is authoritative. With none the step is suppressed entirely and this is
   * `''`, which is what makes "a minion cannot be saved without a monster" (`5b-K5`) hold.
   *
   * Derived rather than written into the control on every roster change, because the roster can
   * change *while* the composer is open — attaching a second monster, or removing one — and a
   * stored copy would then name a monster that is no longer the answer.
   */
  readonly effectiveMinionMonsterKey = computed(() => this.soleMonsterKey() ?? this.minionValue()?.monsterKey ?? '');

  /** The three fields a minion cannot be saved without — including its parent (§6.4, `5b-K5`). */
  readonly minionComposerValid = computed(() => {
    const value = this.minionValue();
    if (!value) {
      return false;
    }

    return (
      (value.name ?? '').trim().length > 0 &&
      (value.minionTypeId ?? '').length > 0 &&
      this.effectiveMinionMonsterKey().length > 0
    );
  });

  /**
   * The monster composer's twin of `minionComposerDirty`, and it is what replaces
   * `validateCurrentStep`'s phase-1/step-0 hard block under decision 19 (§6.5).
   *
   * **The two changes are a pair and Peach tests them as one** (`5b-O4`, UX §16.6): dropping the
   * hard block makes an untouched composer advance, and *stripping the composer's validators* also
   * makes it advance. A single "Next advances on an empty roster" assertion passes in both the
   * correct world and the broken one. This computed is the half that keeps a half-typed monster
   * blocking, and the field validators on `monsterForm` are untouched.
   */
  readonly monsterComposerDirty = computed(() => {
    const value = this.monsterValue();
    if (!value) {
      return false;
    }

    return (
      (value.name ?? '').trim().length > 0 ||
      (value.description ?? '').trim().length > 0 ||
      (value.monsterTypeId ?? '').length > 0 ||
      (value.monsterArchetypeId ?? '').length > 0 ||
      (value.harmCapacity ?? MONSTER_DEFAULT_HARM_CAPACITY) !== MONSTER_DEFAULT_HARM_CAPACITY ||
      this.monsterAttacks().length > 0 ||
      this.monsterPowers().length > 0 ||
      this.monsterWeaknesses().length > 0 ||
      this.monsterArmors().length > 0
    );
  });

  /** The three fields a monster cannot be saved without. Archetype is the one the minion has no twin for. */
  readonly monsterComposerValid = computed(() => {
    const value = this.monsterValue();
    if (!value) {
      return false;
    }

    return (
      (value.name ?? '').trim().length > 0 &&
      (value.monsterTypeId ?? '').length > 0 &&
      (value.monsterArchetypeId ?? '').length > 0
    );
  });

  readonly stepTitle = computed(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();
    const titles: Record<string, string> = {
      '0-0': "What's the Core Idea?",
      '0-1': 'How Do the Hunters Get Involved?',
      '0-2': "What's Really Happening?",
      '0-3': "What Happens If the Hunters Don't Intervene?",
      '0-4': 'What Moves Does This Mystery Have?',
      '1-0': 'What Is the Threat?',
      '1-1': 'Who or What Serves the Monster?',
      '2-0': 'Where Does the Mystery Unfold?',
      '3-0': 'Who Else Is Caught Up in This?',
    };
    return titles[`${phase}-${step}`] ?? '';
  });

  readonly stepBlurb = computed(() => {
    const phase = this.currentPhase();
    const step = this.currentStep();
    const blurbs: Record<string, string> = {
      '0-0':
        "Every mystery starts with a concept—the one-sentence pitch that captures what's going wrong. Think of it as your elevator pitch: 'A vengeful ghost is drowning swimmers at the lake' or 'Teenagers are vanishing into a pocket dimension at the mall.' Keep it tight and evocative. This is the seed from which everything else grows.",
      '0-1':
        "The hook is the inciting incident—how this mystery crashes into your hunters' lives. Maybe someone they know goes missing, or strange phenomena make the news, or they're hired by a desperate local. This is the moment that pulls them from the ordinary world into the supernatural threat. Make it personal or urgent enough that walking away isn't an option.",
      '0-2':
        "The overview is your behind-the-scenes explanation—the full truth of what's going on, who's responsible, and why. Your hunters won't know this at the start; they'll piece it together through investigation. But you need the complete picture so you can answer their questions and improvise consistently.",
      '0-3':
        "The countdown is your mystery's doomsday clock—six escalating events that happen if the hunters don't stop it. Each stage represents the threat growing worse, more public, or more deadly. By Midnight, it's catastrophe. Describe what happens at each stage, not when—timing is flexible based on the hunters' actions.",
      // The imperatives describe the **composer** — "when you do add one, here's what to fill in"
      // — and the closing sentences describe the **phase** (UX §16.1). The volume guidance is the
      // same shape `2-0` and `3-0` already carry, and giving zero a reason is what keeps it a nudge
      // rather than a warning under decision 4 (§16.2). This is the *only* place the nudge appears:
      // no confirmation on Finish, no band, no asterisk (`5b-O8`).
      // Imperatives describe the panel; the closing sentence gives zero a reason, the way `1-0`
      // and `1-1` do. Orienting rather than instructing (UX §16.1) — a Keeper who has never needed
      // a custom move should read this and move on, not wonder what they have missed.
      '0-4':
        "Custom moves are rules that belong to this mystery itself—a roll the Keeper calls for, a special way the hunters can act here, a procedure the mystery imposes on everyone in it. Give each one a name and describe when it applies and what happens. Most mysteries don't need any—add one when the mystery itself can act.",
      '1-0':
        'This is your primary antagonist—the creature, entity, or force causing the mystery. Give it a name, describe what it is and how it manifests, and define its harm capacity. Choose a monster type, and list its attacks, powers, and weaknesses. Make it dangerous but defeatable. Most mysteries have one monster, though you can add several—or none, if the threat isn\'t a creature. A monster you attach brings its minions with it.',
      '1-1':
        'Minions are lesser threats that support the main monster—cultists, possessed victims, summoned creatures, or loyal servants. Use the same structure as the monster. Minions are optional — you can add as many as you need, or skip this step entirely.',
      '2-0':
        "Locations are the key places where clues, action, and danger converge—the abandoned asylum, the forest clearing, the victim's apartment, the monster's lair. Describe what hunters will find there and what makes it memorable. Most mysteries have 4–6 core locations.",
      '3-0':
        'Bystanders are the NPCs who populate your mystery—victims, witnesses, suspects, allies, or innocents in danger. Some will help the hunters, some will get in the way, and some are in mortal danger. Most mysteries have 5–10 bystanders.',
    };
    return blurbs[`${phase}-${step}`] ?? '';
  });

  readonly canGoBack = computed(() => !(this.currentPhase() === 0 && this.currentStep() === 0));

  init(mysteryId?: string): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (mysteryId) {
      this.isEditMode.set(true);
      this.mysteryId.set(mysteryId);
      this.phaseComplete.set([true, true, true, true]);
      this.loadEditData(mysteryId);
      this.loadAttachCatalogues();
    } else {
      this.loadReferenceData();
    }
  }

  private loadReferenceData(): void {
    forkJoin({
      adventureTypes: this.referenceDataService.getAdventureTypes(),
      monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      minionTypes: this.referenceDataService.getMinionTypes(),
      locationTypes: this.referenceDataService.getLocationTypes(),
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      weaponTags: this.referenceDataService.getWeaponTags(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ adventureTypes, monsterArchetypes, monsterTypes, minionTypes, locationTypes, bystanderTypes, weaponTags }) => {
        this.adventureTypes.set(adventureTypes);
        this.monsterArchetypes.set(monsterArchetypes);
        this.monsterTypes.set(monsterTypes);
        this.minionTypes.set(minionTypes);
        this.locationTypes.set(locationTypes);
        this.bystanderTypes.set(bystanderTypes);
        this.weaponTags.set(weaponTags);
      });

    this.loadAttachCatalogues();
  }

  /**
   * The attach strips' options and the removal modal's mystery names (decision 11).
   *
   * Loaded separately from the reference data, and each failure swallowed on its own: none of this
   * is page data. A catalogue that does not arrive hides its attach strip, which is the same state
   * as an empty catalogue and is already specified (§3); a mystery list that does not arrive costs
   * the removal modal its usage names and nothing else.
   */
  private loadAttachCatalogues(): void {
    this.locationService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (locations) => this.catalogLocations.set(locations), error: () => {} });

    this.bystanderService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (bystanders) => this.catalogBystanders.set(bystanders), error: () => {} });

    this.monsterService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (monsters) => this.catalogMonsters.set(monsters), error: () => {} });

    this.mysteryService
      .getMysteries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (mysteries) => this.mysteries.set(mysteries), error: () => {} });
  }

  /**
   * **Attach a monster: hydrate, then commit** (§6.6, UX §17.1, `5b-T1`–`5b-T6`).
   *
   * The one place in this feature where attach is not a pure client-side transform.
   * `MonsterListItemResponse` carries counts and no collections and no minions at all, so the object
   * the picker hands over cannot become a diffable draft: it takes `getById` + `getByMonster` +
   * a `getById` per minion — 1 + 1 + N — to build one.
   *
   * **Nothing enters the roster until the whole subtree is in hand.** A card admitted with a known
   * `id`, an empty baseline and empty drafts is the "baseline and drafts disagree" shape, and under
   * a *partial* failure — `getById` landed, the minion fetches did not — it is the one path in the
   * design that produces genuine sub-resource destruction rather than harmless churn. So the commit
   * is a single `update` at the end of a successful hydration, and the failure branch touches
   * nothing at all: no draft, no baseline, no membership, and the monster stays in
   * `attachableMonsters` so retry is simply picking it again.
   */
  attachMonster(monsterId: string): void {
    const item = this.catalogMonsters().find((candidate) => candidate.id === monsterId);
    if (!item || this.monsterDrafts().some((draft) => draft.id === monsterId) || this.monsterAttachInFlight()) {
      return;
    }

    this.attachingMonsterName.set(item.name);
    this.monsterAttachError.set(null);

    this.hydrateMonsterDraft(monsterId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ monster, minions }) => {
          this.attachingMonsterName.set(null);
          this.cancelPendingRemoval('monsters', monsterId);
          // One mutation each, after the data is in hand. The roster and the minion list move
          // together because a monster with its minions missing is the half-row this guards against.
          this.monsterDrafts.update((drafts) => [...drafts, monster]);
          this.minionDrafts.update((drafts) => [...drafts, ...minions]);
          this.collapseComposerIfUntouched(this.monsterComposerOpen, this.monsterComposerDirty());
        },
        error: () => {
          this.attachingMonsterName.set(null);
          // **Local to the control that failed** (UX §17.2), not the wizard's footer band — that
          // belongs to submit failures and sits a scroll away from the action that caused this.
          this.monsterAttachError.set(`Couldn't load “${item.name}”. Try again.`);
        },
      });
  }

  /**
   * **The one hydrator** (§6.6). Loads a monster and its minions in full, and hands back a shape in
   * which every draft's `id` and every baseline row come from the same response object.
   *
   * **How the invariant is enforced.** Not by a rule anyone has to follow: the broken state cannot
   * be expressed. `toHydratedMonster` builds `attacks` and `existingAttacks` from the same
   * `monster.attacks` array in the same expression, and likewise for the other three collections
   * and for each minion. A caller receives both or neither. The old code had two independent paths
   * — one patching drafts, one setting baselines — and H1, H2a and H3 were all the same bug: one
   * path ran and the other did not.
   *
   * The minion list endpoint returns list items, which do not carry the four sub-collections, so
   * each minion is re-fetched by id. That is the only reason this is two round trips deep.
   *
   * 5a's caller is edit-mode load. 5b adds attach, which needs exactly this and nothing else.
   */
  hydrateMonsterDraft(monsterId: string): Observable<HydratedMonster> {
    return forkJoin({
      monster: this.monsterService.getById(monsterId),
      minions: this.minionService.getByMonster(monsterId).pipe(
        switchMap((minions) =>
          minions.length > 0
            ? forkJoin(minions.map((minion) => this.minionService.getById(minion.id)))
            : of<MinionDetailResponse[]>([])
        )
      ),
    }).pipe(map(({ monster, minions }) => toHydratedMonster(monster, minions)));
  }

  private loadEditData(mysteryId: string): void {
    forkJoin({
      adventureTypes: this.referenceDataService.getAdventureTypes(),
      monsterArchetypes: this.referenceDataService.getMonsterArchetypes(),
      monsterTypes: this.referenceDataService.getMonsterTypes(),
      minionTypes: this.referenceDataService.getMinionTypes(),
      locationTypes: this.referenceDataService.getLocationTypes(),
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      weaponTags: this.referenceDataService.getWeaponTags(),
      mystery: this.mysteryService.getMystery(mysteryId),
      monsters: this.monsterService.getByMystery(mysteryId),
      locations: this.locationService.getByMystery(mysteryId),
      bystanders: this.bystanderService.getByMystery(mysteryId),
    })
      .pipe(
        switchMap(({ adventureTypes, monsterArchetypes, monsterTypes, minionTypes, locationTypes, bystanderTypes, weaponTags, mystery, monsters, locations, bystanders }) => {
          this.adventureTypes.set(adventureTypes);
          this.monsterArchetypes.set(monsterArchetypes);
          this.monsterTypes.set(monsterTypes);
          this.minionTypes.set(minionTypes);
          this.locationTypes.set(locationTypes);
          this.bystanderTypes.set(bystanderTypes);
          this.weaponTags.set(weaponTags);

          this.conceptForm.patchValue({ name: mystery.name, concept: mystery.concept ?? '', adventureTypeId: mystery.adventureType.id });
          this.hookForm.patchValue({ hook: mystery.hook ?? '' });
          this.overviewForm.patchValue({ overview: mystery.overview ?? '' });
          if (mystery.countdown) {
            this.countdownForm.patchValue({
              day: mystery.countdown.day ?? '',
              shadows: mystery.countdown.shadows ?? '',
              sunset: mystery.countdown.sunset ?? '',
              dusk: mystery.countdown.dusk ?? '',
              nightfall: mystery.countdown.nightfall ?? '',
              midnight: mystery.countdown.midnight ?? '',
            });
          }

          // **Both halves from one response object, in one step** (H2, BUG 2 principle 5). The
          // baseline cannot exist without the drafts it was built beside, so there is no window in
          // which `applySubResourceDiff` could see a populated baseline against an empty draft list
          // and delete the lot.
          this.mysteryCustomMoves.set(
            mystery.customMoves.map((move) => ({
              id: move.id,
              localKey: createDraftKey('move'),
              name: move.name,
              description: move.description ?? '',
            })),
          );
          this.existingMysteryCustomMoves.set(mystery.customMoves);

          this.existingLocationIds.set(locations.map((l) => l.id));
          this.locations.set(
            locations.map((l) => ({
              id: l.id,
              localKey: createDraftKey('location'),
              name: l.name,
              description: l.description ?? '',
              locationTypeId: l.locationTypeId,
              // Retained through hydration (§7.2) — the list response already carries it, and the
              // removal modal has no other source for "which other mysteries use this".
              mysteryIds: [...l.mysteryIds],
            }))
          );

          this.existingBystanderIds.set(bystanders.map((b) => b.id));
          this.bystanders.set(
            bystanders.map((b) => ({
              id: b.id,
              localKey: createDraftKey('bystander'),
              name: b.name,
              description: b.description ?? '',
              bystanderTypeId: b.bystanderTypeId,
              mysteryIds: [...b.mysteryIds],
            }))
          );

          // Edit mode opens on a populated roster, so both composers start collapsed (§2.3).
          this.locationComposerOpen.set(locations.length === 0);
          this.bystanderComposerOpen.set(bystanders.length === 0);

          // **`monsters[0]` is gone** (§6.1). The wizard hydrates the whole list; a mystery that
          // already had two monsters used to open showing one and silently drop the other.
          //
          // **The roster baseline is deliberately *not* written here** (BUG 2, rev 12). It used to
          // be, one statement above the `forkJoin` below that can fail — so a failed hydration left
          // `existingMonsterIds` fully populated against an empty roster, and `idsToRemove` cannot
          // tell "the user removed everything" from "nothing loaded". Advancing through Monsters
          // then unlinked **every** monster from the mystery, silently, reporting success. It is
          // written in `applyHydratedMonsters` instead, from the same entries the drafts come from.

          // **Decision 19 (§6.5): stop recomputing completeness from data presence in edit mode.**
          // `init()` already set `[true, true, true, true]`, and that is the truthful answer — the
          // mystery exists, so every phase has been through. The old `pureMonster != null` predicate
          // is simply wrong once a monster is optional, and `locations.length > 0` /
          // `bystanders.length > 0` were always questionable for the same reason: neither was ever
          // required either. `isPhaseAccessible` already returns true unconditionally in edit mode,
          // so this only changes which bubbles render as finished — and it makes them tell the truth.

          // §6.6: one hydrator, and attach is its second caller. It builds the baseline and the
          // drafts' ids from the same responses in the same step, so neither can exist without the
          // other — which is the whole of H1, H2a and H3.
          //
          // **All-or-nothing, and that is a decision rather than an accident of `forkJoin`** (J6,
          // §6.6). If one monster's hydration fails, the whole load fails. Dropping the failed
          // monster and opening with the rest is the option that looks helpful and destroys data:
          // `submitPhase1` diffs whatever is in the roster, so a monster that failed to load would
          // sit there with a known id, an empty baseline and empty drafts — on a monster the user
          // never touched.
          return monsters.length > 0
            ? forkJoin(monsters.map((monster) => this.hydrateMonsterDraft(monster.id)))
            : of<HydratedMonster[]>([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (hydrated: HydratedMonster[]) => this.applyHydratedMonsters(hydrated),
        error: () => this.submitError.set('Could not load this mystery. Please try again.'),
      });
  }

  /**
   * Commits a fully hydrated roster. Every entry is complete or none of them arrived, so there is
   * no partial state to reason about here — see `loadEditData`'s J6 note and `attachMonster`.
   *
   * Everything below is assignment. The construction that has to be right happens once, in
   * `toHydratedMonster`.
   */
  private applyHydratedMonsters(hydrated: HydratedMonster[]): void {
    this.monsterDrafts.set(hydrated.map((entry) => entry.monster));
    this.minionDrafts.set(hydrated.flatMap((entry) => entry.minions));
    // **The roster baseline is written here, with the drafts, from the same entries** (BUG 2,
    // principle 5). It used to be set in `loadEditData`, before the hydration `forkJoin` that can
    // fail — which made J6's all-or-nothing true of the drafts and false of the baseline.
    //
    // Clearing it in the error handler was the obvious alternative and it does not work, because
    // the window exists on the **success** path too: between that write and this subscribe the
    // baseline was set and the drafts were not, and `persistedForRemoval` reads the pair. Nothing
    // reads it in that gap today — and "nothing reads it today" is precisely the reasoning that
    // produced BUG 1. Moving the write removes the interval; clearing on error only shortens it.
    //
    // This is now the single success-path writer of both halves, which is the shape
    // `toHydratedMonster` already has one level down.
    this.existingMonsterIds.set(hydrated.map((entry) => entry.monster.id).filter((id): id is string => id !== null));

    // Edit mode opens on a populated roster, so both composers start collapsed (§2.3/§1.7).
    this.editingMonsterKey.set(null);
    this.monsterComposerOpen.set(this.monsterDrafts().length === 0);
    this.editingMinionKey.set(null);
    this.minionComposerOpen.set(this.minionDrafts().length === 0);
    this.resetComposer();
  }

  next(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    // Rosalina §1.4 / decision #13: an open composer is committed if it can be. This runs here —
    // synchronously, before submitCurrentPhase() — and NOT inside submitPhase1's pipe, so the
    // committed draft is in minionDrafts() by the time submitPhase1 reads it, in the same tick.
    // Burying the mutation inside the rxjs chain would put it after monsterSave$ resolves, in a
    // re-enterable async path — the exact shape of the Bug 2 defect class this file already fixed.
    if (this.currentPhase() === 1 && this.currentStep() === 0 && !this.commitMonsterComposerIfValid()) {
      return;
    }

    if (this.currentPhase() === 1 && this.currentStep() === 1 && !this.commitComposerIfValid()) {
      return;
    }

    // Step `0-4`'s add form, same rule — see `commitMysteryCustomMoveIfValid` for why this panel
    // commits on advance when its four neighbours inside the monster composer do not.
    if (this.currentPhase() === 0 && this.currentStep() === 4 && !this.commitMysteryCustomMoveIfValid()) {
      return;
    }

    // The same rule for the other two rosters (§5.3, R4). Valid but uncommitted → commit silently,
    // then submit; started but invalid → block with that phase's own message and issue nothing.
    if (this.currentPhase() === 2 && !this.commitLocationComposerIfValid()) {
      return;
    }

    if (this.currentPhase() === 3 && !this.commitBystanderComposerIfValid()) {
      return;
    }

    const phase = this.currentPhase();
    const step = this.currentStep();
    const stepsInPhase = this.phases[phase]?.steps ?? 0;
    if (step < stepsInPhase - 1) {
      this.currentStep.set(step + 1);
      return;
    }

    this.submitCurrentPhase();
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
      return;
    }

    if (this.currentPhase() > 0) {
      const previousPhase = this.currentPhase() - 1;
      this.currentPhase.set(previousPhase);
      this.currentStep.set(this.phases[previousPhase].steps - 1);
    }
  }

  jumpToPhase(phase: number): void {
    if (!this.isPhaseAccessible(phase)) {
      return;
    }

    this.currentPhase.set(phase);
    this.currentStep.set(0);
  }

  isPhaseAccessible(phase: number): boolean {
    if (this.isEditMode()) {
      return true;
    }
    return phase === this.currentPhase() || this.phaseComplete()[phase] === true;
  }

  addMonsterAttack(): void {
    this.addAttackDraft(this.monsterAttacks, this.monsterAttackForm, 'attack');
  }

  removeMonsterAttack(localKey: string): void {
    this.removeDraft(this.monsterAttacks, localKey);
  }

  addMysteryCustomMove(): void {
    this.addNamedDraft(this.mysteryCustomMoves, this.mysteryCustomMoveForm, 'move');
  }

  removeMysteryCustomMove(localKey: string): void {
    this.removeDraft(this.mysteryCustomMoves, localKey);
  }

  /**
   * **Commit-on-advance for step `0-4`'s add form** — the same three-way rule `next()` already
   * applies to the four composers: empty → proceed, valid → commit and proceed, started but
   * invalid → block and say so.
   *
   * This is an addition to §30.3's list and the reason needs stating, because the four *neighbour*
   * panels (Attacks, Powers, Weaknesses, Armor) deliberately do **not** do this — type a power,
   * press *Save Monster*, and it is discarded. The difference is where the commit point is. Those
   * panels sit inside a composer whose own *Save Monster* button is the commit, two inches away.
   * This panel **is** a whole step, so `Next` is the only commit point there is, and without this
   * rule a typed-but-unadded move vanishes with no message — the thing §15.2 R5 refuses ("work
   * outranks the tidiness rule"). So: a panel inside a composer discards on the composer's save; a
   * panel that is itself a step commits on `Next`.
   */
  commitMysteryCustomMoveIfValid(): boolean {
    // **Dirtiness is a question about the values, not about Angular's `dirty` flag** — the same
    // answer `locationComposerDirty` (`:755`) and `minionComposerDirty` (`:913`) give, and for the
    // same reason: `setValue` leaves a form `pristine`, so the flag reports "untouched" on a form
    // that is holding text. A negative control had both commit-on-advance tests failing on exactly
    // that before this was value-based.
    const name = (this.mysteryCustomMoveForm.controls.name.value ?? '').trim();
    const description = (this.mysteryCustomMoveForm.controls.description.value ?? '').trim();
    if (name.length === 0 && description.length === 0) {
      return true;
    }

    // Name is the only required field, so "started but invalid" is a description with no name.
    if (this.mysteryCustomMoveForm.invalid) {
      this.mysteryCustomMoveForm.markAllAsTouched();
      this.submitError.set(CUSTOM_MOVE_BLOCKED_MESSAGE);
      return false;
    }

    this.addMysteryCustomMove();
    return true;
  }

  addMonsterPower(): void {
    this.addNamedDraft(this.monsterPowers, this.monsterPowerForm, 'trait');
  }

  removeMonsterPower(localKey: string): void {
    this.removeDraft(this.monsterPowers, localKey);
  }

  addMonsterWeakness(): void {
    this.addNamedDraft(this.monsterWeaknesses, this.monsterWeaknessForm, 'trait');
  }

  removeMonsterWeakness(localKey: string): void {
    this.removeDraft(this.monsterWeaknesses, localKey);
  }

  addMinionAttack(): void {
    this.addAttackDraft(this.minionAttacks, this.minionAttackForm, 'attack');
  }

  removeMinionAttack(localKey: string): void {
    this.removeDraft(this.minionAttacks, localKey);
  }

  addMinionPower(): void {
    this.addNamedDraft(this.minionPowers, this.minionPowerForm, 'trait');
  }

  removeMinionPower(localKey: string): void {
    this.removeDraft(this.minionPowers, localKey);
  }

  addMinionWeakness(): void {
    this.addNamedDraft(this.minionWeaknesses, this.minionWeaknessForm, 'trait');
  }

  removeMinionWeakness(localKey: string): void {
    this.removeDraft(this.minionWeaknesses, localKey);
  }

  addMonsterArmor(): void {
    this.addArmorDraft(this.monsterArmors, this.monsterArmorForm, 'armor');
  }

  removeMonsterArmor(localKey: string): void {
    this.removeDraft(this.monsterArmors, localKey);
  }

  addMinionArmor(): void {
    this.addArmorDraft(this.minionArmors, this.minionArmorForm, 'armor');
  }

  removeMinionArmor(localKey: string): void {
    this.removeDraft(this.minionArmors, localKey);
  }

  // ---------------------------------------------------------------------------
  // Locations and Bystanders: roster + composer + attach + removal (Phase 4)
  //
  // The minion shape of §5.3, generalised. Everything below has a twin one entity over; the pair
  // is kept as two explicit copies rather than one generic helper because the forms, the services
  // and the signals are all distinctly typed, and a generic that erased that would be harder to
  // read than the duplication it removed (OQ9).
  // ---------------------------------------------------------------------------

  /**
   * **Would removing this draft change anything on the server?** The question the removal modal and
   * the submit diff both ask, answered once (§7.1, decision 16).
   *
   * Renamed from `membershipPersisted` (§7.7b), because the old name was a lie for one of its four
   * callers. For locations, bystanders and monsters the baseline holds **memberships**; for minions
   * it holds **rows**, since a minion has no mystery membership at all. Read literally, "is the
   * membership persisted" is false for every minion, which would classify every minion removal as a
   * local discard and silently stop deleting them. One name for two referents was the defect.
   *
   * Note what this is *not*: `id !== null`. That answers "does this entity exist", which is true the
   * moment an entity is attached — so keying on it offers **Delete** to a user undoing a mis-click.
   * For minions the two agree, because minions are never attached (UX §16.4) and an id can only
   * become non-null by being saved; the baseline form is used anyway, so all four collections
   * resolve the same way and no path can set an id without the baseline and diverge.
   *
   * **A `switch`, not a ternary** (§7.7g, H5). The shipped ternary resolved anything that was not
   * `'locations'` to the bystander baseline, so adding a member landed it on the wrong collection
   * with no compile error, on the path that decides whether a destructive button appears. The
   * exhaustive switch turns the fifth member into a build failure instead.
   */
  persistedForRemoval(collection: RemovalCollection, id: string | null): boolean {
    if (id === null) {
      return false;
    }

    switch (collection) {
      case 'locations':
        return this.existingLocationIds().includes(id);
      case 'bystanders':
        return this.existingBystanderIds().includes(id);
      case 'monsters':
        return this.existingMonsterIds().includes(id);
      case 'minions':
        // Flattened out of the roster's per-monster baselines (J1). A monster that has left the
        // roster has taken its children's ids with it, so this answers `false` for them the instant
        // it is removed — no clearing step, nothing to forget.
        return this.existingMinionIds().includes(id);
    }
  }

  /** Commit-on-advance for the locations composer — same three-way rule as the minion one. */
  commitLocationComposerIfValid(): boolean {
    if (!this.locationComposerOpen() || !this.locationComposerDirty()) {
      return true;
    }

    if (this.addLocationForm.invalid) {
      this.addLocationForm.markAllAsTouched();
      this.submitError.set(LOCATION_COMPOSER_BLOCKED_MESSAGE);
      return false;
    }

    this.saveLocationDraft();
    return true;
  }

  /** Commits the composer into the roster — replacing the edited slot, or appending a new location. */
  saveLocationDraft(): void {
    if (this.addLocationForm.invalid) {
      this.addLocationForm.markAllAsTouched();
      return;
    }

    const key = this.editingLocationKey();
    const existing = key !== null ? this.locations().find((item) => item.localKey === key) ?? null : null;

    const draft: LocationDraft = {
      id: existing?.id ?? null,
      localKey: existing?.localKey ?? createDraftKey('location'),
      name: this.addLocationForm.controls.name.value.trim(),
      description: this.addLocationForm.controls.description.value ?? '',
      locationTypeId: this.addLocationForm.controls.locationTypeId.value,
      mysteryIds: existing?.mysteryIds ?? [],
    };

    this.locations.update((items) =>
      existing !== null ? items.map((item) => (item.localKey === draft.localKey ? draft : item)) : [...items, draft],
    );

    this.resetLocationComposer();
    this.editingLocationKey.set(null);
    this.locationComposerOpen.set(this.locations().length === 0);
    this.submitError.set(null);
  }

  /** Loads a roster card back into the composer. Returns whether the composer actually moved. */
  editLocationDraft(key: string): boolean {
    if (!this.commitLocationComposerIfValid()) {
      return false;
    }

    const draft = this.locations().find((item) => item.localKey === key);
    if (!draft) {
      return false;
    }

    this.addLocationForm.reset({
      name: draft.name,
      description: draft.description,
      locationTypeId: draft.locationTypeId,
    });
    this.editingLocationKey.set(key);
    this.locationComposerOpen.set(true);
    return true;
  }

  /** "+ Add Another Location". Returns whether the composer opened. */
  startNewLocationDraft(): boolean {
    if (!this.commitLocationComposerIfValid()) {
      return false;
    }

    this.resetLocationComposer();
    this.editingLocationKey.set(null);
    this.locationComposerOpen.set(true);
    return true;
  }

  /** Abandons the composer's contents without touching the roster. No confirmation (R2). */
  cancelLocationComposer(): void {
    this.resetLocationComposer();
    this.editingLocationKey.set(null);
    this.locationComposerOpen.set(this.locations().length === 0);
  }

  /**
   * Appends a catalogue location to the roster (A2, A4). Local only — no request is issued, and
   * abandoning the wizard here leaves the mystery, the entity and their membership untouched.
   *
   * Re-attaching something with a pending removal cancels that removal (D9). This matters most for
   * the `delete` disposition: a cancelled deletion that still deletes is the worst outcome here.
   */
  attachLocation(locationId: string): void {
    const item = this.catalogLocations().find((candidate) => candidate.id === locationId);
    if (!item || this.locations().some((draft) => draft.id === locationId)) {
      return;
    }

    this.cancelPendingRemoval('locations', locationId);
    this.locations.update((items) => [
      ...items,
      {
        id: item.id,
        localKey: createDraftKey('location'),
        name: item.name,
        description: item.description ?? '',
        locationTypeId: item.locationTypeId,
        mysteryIds: [...item.mysteryIds],
      },
    ]);
    this.collapseComposerIfUntouched(this.locationComposerOpen, this.locationComposerDirty());
  }

  /**
   * Drops a roster card, and records the disposition when — and only when — a persisted membership
   * exists to dispose of. Nothing is sent now; the drain happens at the next phase submit (D5).
   */
  removeLocationDraft(key: string, action: 'detach' | 'delete'): void {
    const draft = this.locations().find((item) => item.localKey === key);
    if (!draft) {
      return;
    }

    if (this.persistedForRemoval('locations', draft.id)) {
      this.recordRemoval({ collection: 'locations', id: draft.id as string, action });
    }

    this.locations.update((items) => items.filter((item) => item.localKey !== key));

    if (this.editingLocationKey() === key) {
      this.resetLocationComposer();
      this.editingLocationKey.set(null);
      this.locationComposerOpen.set(this.locations().length === 0);
    }
  }

  private resetLocationComposer(): void {
    this.addLocationForm.reset({ name: '', description: '', locationTypeId: '' });
  }

  /** Bystanders: the same eight members, one noun over. */
  commitBystanderComposerIfValid(): boolean {
    if (!this.bystanderComposerOpen() || !this.bystanderComposerDirty()) {
      return true;
    }

    if (this.addBystanderForm.invalid) {
      this.addBystanderForm.markAllAsTouched();
      this.submitError.set(BYSTANDER_COMPOSER_BLOCKED_MESSAGE);
      return false;
    }

    this.saveBystanderDraft();
    return true;
  }

  saveBystanderDraft(): void {
    if (this.addBystanderForm.invalid) {
      this.addBystanderForm.markAllAsTouched();
      return;
    }

    const key = this.editingBystanderKey();
    const existing = key !== null ? this.bystanders().find((item) => item.localKey === key) ?? null : null;

    const draft: BystanderDraft = {
      id: existing?.id ?? null,
      localKey: existing?.localKey ?? createDraftKey('bystander'),
      name: this.addBystanderForm.controls.name.value.trim(),
      description: this.addBystanderForm.controls.description.value ?? '',
      bystanderTypeId: this.addBystanderForm.controls.bystanderTypeId.value,
      mysteryIds: existing?.mysteryIds ?? [],
    };

    this.bystanders.update((items) =>
      existing !== null ? items.map((item) => (item.localKey === draft.localKey ? draft : item)) : [...items, draft],
    );

    this.resetBystanderComposer();
    this.editingBystanderKey.set(null);
    this.bystanderComposerOpen.set(this.bystanders().length === 0);
    this.submitError.set(null);
  }

  editBystanderDraft(key: string): boolean {
    if (!this.commitBystanderComposerIfValid()) {
      return false;
    }

    const draft = this.bystanders().find((item) => item.localKey === key);
    if (!draft) {
      return false;
    }

    this.addBystanderForm.reset({
      name: draft.name,
      description: draft.description,
      bystanderTypeId: draft.bystanderTypeId,
    });
    this.editingBystanderKey.set(key);
    this.bystanderComposerOpen.set(true);
    return true;
  }

  startNewBystanderDraft(): boolean {
    if (!this.commitBystanderComposerIfValid()) {
      return false;
    }

    this.resetBystanderComposer();
    this.editingBystanderKey.set(null);
    this.bystanderComposerOpen.set(true);
    return true;
  }

  cancelBystanderComposer(): void {
    this.resetBystanderComposer();
    this.editingBystanderKey.set(null);
    this.bystanderComposerOpen.set(this.bystanders().length === 0);
  }

  attachBystander(bystanderId: string): void {
    const item = this.catalogBystanders().find((candidate) => candidate.id === bystanderId);
    if (!item || this.bystanders().some((draft) => draft.id === bystanderId)) {
      return;
    }

    this.cancelPendingRemoval('bystanders', bystanderId);
    this.bystanders.update((items) => [
      ...items,
      {
        id: item.id,
        localKey: createDraftKey('bystander'),
        name: item.name,
        description: item.description ?? '',
        bystanderTypeId: item.bystanderTypeId,
        mysteryIds: [...item.mysteryIds],
      },
    ]);
    this.collapseComposerIfUntouched(this.bystanderComposerOpen, this.bystanderComposerDirty());
  }

  /**
   * Attach re-derives composer-open — **but only when the composer holds nothing** (§15.2).
   *
   * §2.3 states the open/closed rule as a function of roster emptiness, so after an attach the
   * composer should collapse. Doing that unconditionally would silently discard typed contents in a
   * plausible flow — start typing "the old mill", realise you already made one, pick it from the
   * strip — and that breaks the rule the composer has followed since the minion work: **nothing
   * discards its contents implicitly.** That rule is why `commitComposerIfValid` exists instead of a
   * discard-confirmation modal.
   *
   * The dirtiness test is the one the composer already owns for deciding whether `Next` may
   * proceed, passed in rather than re-derived, so there is no second notion of "empty".
   *
   * **No focus move here, deliberately.** §8.6's contract fires when the *focused* element unmounts;
   * on this path focus is in the attach select and stays there, which is what you want when
   * attaching several in a row. The composer that collapses never had focus.
   */
  private collapseComposerIfUntouched(open: WritableSignal<boolean>, dirty: boolean): void {
    if (open() && !dirty) {
      open.set(false);
    }
  }

  removeBystanderDraft(key: string, action: 'detach' | 'delete'): void {
    const draft = this.bystanders().find((item) => item.localKey === key);
    if (!draft) {
      return;
    }

    if (this.persistedForRemoval('bystanders', draft.id)) {
      this.recordRemoval({ collection: 'bystanders', id: draft.id as string, action });
    }

    this.bystanders.update((items) => items.filter((item) => item.localKey !== key));

    if (this.editingBystanderKey() === key) {
      this.resetBystanderComposer();
      this.editingBystanderKey.set(null);
      this.bystanderComposerOpen.set(this.bystanders().length === 0);
    }
  }

  private resetBystanderComposer(): void {
    this.addBystanderForm.reset({ name: '', description: '', bystanderTypeId: '' });
  }

  private recordRemoval(removal: PendingRemoval): void {
    this.pendingRemovals.update((list) => [
      ...list.filter((item) => !(item.collection === removal.collection && item.id === removal.id)),
      removal,
    ]);
  }

  private cancelPendingRemoval(collection: RemovalCollection, id: string): void {
    this.pendingRemovals.update((list) =>
      list.filter((item) => !(item.collection === collection && item.id === id)),
    );
  }

  // ---------------------------------------------------------------------------
  // Minion roster + composer (§1.2, §1.4, §1.5 of docs/updates/multi-minion-support.md)
  // ---------------------------------------------------------------------------

  /**
   * Commits whatever is open in the composer, if it can be committed. One primitive, three callers
   * (`next()`, `editMinionDraft()`, `startNewMinionDraft()`), each of which must abort on `false`.
   *
   * @returns `true` when there was nothing to commit or the commit succeeded; `false` when the
   *          composer holds work that cannot be saved yet, in which case the caller must do nothing.
   */
  // ---------------------------------------------------------------------------
  // The monster roster and its composer (§6.1). Mirrors the shipped minion pair.
  // ---------------------------------------------------------------------------

  /** Same three-way rule as `Next`: empty → proceed, valid → commit silently, started-but-invalid → block. */
  commitMonsterComposerIfValid(): boolean {
    if (!this.monsterComposerOpen() || !this.monsterComposerDirty()) {
      return true;
    }

    if (!this.monsterComposerValid()) {
      this.monsterForm.markAllAsTouched();
      this.submitError.set(MONSTER_COMPOSER_BLOCKED_MESSAGE);
      return false;
    }

    this.saveMonsterDraftToList();
    return true;
  }

  /** Commits the composer into the roster — replacing the edited slot, or appending a new monster. */
  saveMonsterDraftToList(): void {
    if (!this.monsterComposerValid()) {
      this.monsterForm.markAllAsTouched();
      return;
    }

    const key = this.editingMonsterKey();
    const existing = key !== null ? (this.monsterDrafts().find((item) => item.localKey === key) ?? null) : null;

    const draft: MonsterDraft = {
      // Keep the server id, the four sub-resource baselines, the minion baseline and the membership
      // snapshot of the slot being edited. Losing any of them here is the H2 shape: the drafts and
      // the baseline would disagree, and the next submit would delete and recreate the lot.
      id: existing?.id ?? null,
      localKey: existing?.localKey ?? createDraftKey('monster'),
      name: this.monsterForm.controls.name.value.trim(),
      description: this.monsterForm.controls.description.value ?? '',
      harmCapacity: this.monsterForm.controls.harmCapacity.value,
      monsterTypeId: this.monsterForm.controls.monsterTypeId.value,
      monsterArchetypeId: this.monsterForm.controls.monsterArchetypeId.value,
      attacks: [...this.monsterAttacks()],
      powers: [...this.monsterPowers()],
      weaknesses: [...this.monsterWeaknesses()],
      armors: [...this.monsterArmors()],
      existingAttacks: existing?.existingAttacks ?? [],
      existingPowers: existing?.existingPowers ?? [],
      existingWeaknesses: existing?.existingWeaknesses ?? [],
      existingArmors: existing?.existingArmors ?? [],
      existingMinionIds: existing?.existingMinionIds ?? [],
      mysteryIds: existing?.mysteryIds ?? [],
    };

    this.monsterDrafts.update((drafts) =>
      existing !== null ? drafts.map((item) => (item.localKey === draft.localKey ? draft : item)) : [...drafts, draft],
    );

    this.resetMonsterComposer();
    this.editingMonsterKey.set(null);
    this.monsterComposerOpen.set(this.monsterDrafts().length === 0);
    this.submitError.set(null);
  }

  /** Pulls a roster card into the composer. Returns whether it opened, for the focus contract (§8.6). */
  editMonsterDraft(key: string): boolean {
    if (!this.commitMonsterComposerIfValid()) {
      return false;
    }

    // Read the draft *after* the commit: committing may have rewritten the card we are about to load.
    const draft = this.monsterDrafts().find((item) => item.localKey === key);
    if (!draft) {
      return false;
    }

    this.resetMonsterComposer();
    this.monsterForm.patchValue({
      name: draft.name,
      description: draft.description,
      harmCapacity: draft.harmCapacity,
      monsterTypeId: draft.monsterTypeId,
      monsterArchetypeId: draft.monsterArchetypeId,
    });
    this.monsterAttacks.set([...draft.attacks]);
    this.monsterPowers.set([...draft.powers]);
    this.monsterWeaknesses.set([...draft.weaknesses]);
    this.monsterArmors.set([...draft.armors]);

    this.editingMonsterKey.set(key);
    this.monsterComposerOpen.set(true);
    return true;
  }

  /** "+ Add Another Monster" — same commit rule as `Next`, then a blank composer. */
  startNewMonsterDraft(): boolean {
    if (!this.commitMonsterComposerIfValid()) {
      return false;
    }

    this.resetMonsterComposer();
    this.editingMonsterKey.set(null);
    this.monsterComposerOpen.set(true);
    return true;
  }

  /** Abandons the composer's contents without touching the roster (`5b-R6`). */
  cancelMonsterComposerEdit(): void {
    this.resetMonsterComposer();
    this.editingMonsterKey.set(null);
    this.monsterComposerOpen.set(this.monsterDrafts().length === 0);
  }

  /**
   * **Removes a monster from the roster, and settles what happens to its minions** (§7.7d/i).
   *
   * One disposition is recorded, for the monster. None for its children: under **delete** the FK
   * cascade destroys them, so a separate disposition would be a duplicate request; under **detach**
   * they must survive, which is what detach means and what the modal the user just read promised.
   *
   * The minion *baseline* needs no clearing step, because it lives on the draft being dropped
   * (`MonsterDraft.existingMinionIds`). That is J1's fix, and it is why this method has no "and also
   * forget these ids" line — there is nowhere for one to go.
   */
  removeMonsterDraft(key: string, action: 'detach' | 'delete'): void {
    const draft = this.monsterDrafts().find((item) => item.localKey === key);
    if (!draft) {
      return;
    }

    if (this.persistedForRemoval('monsters', draft.id)) {
      this.recordRemoval({ collection: 'monsters', id: draft.id as string, action });
    }

    this.monsterDrafts.update((drafts) => drafts.filter((item) => item.localKey !== key));
    this.minionDrafts.update((minions) => this.settleMinionsOfRemovedMonster(minions, draft));

    if (this.editingMonsterKey() === key) {
      this.resetMonsterComposer();
      this.editingMonsterKey.set(null);
      this.monsterComposerOpen.set(this.monsterDrafts().length === 0);
    }

    // The minion composer may have been editing a minion that just left with its monster, or may be
    // pointed at a monster that no longer exists. Either way it no longer describes anything.
    this.reconcileMinionComposerWithRoster();
  }

  /**
   * **Which minion drafts leave with a removed monster, and which revert** (§7.7i, J4).
   *
   * Three cases, and the third is the one that is easy to miss:
   *
   * - its **baseline parent is B** → dropped, with B. The server has it under B and B is going.
   * - **unsaved**, pointed at B → dropped. It never existed.
   * - baseline parent is **another roster monster**, with a pending move to B → **`monsterKey`
   *   reverts** to that monster.
   *
   * Without the third case the draft would leave with B while the minion stayed in A's baseline with
   * no draft claiming it — and A's own diff would then delete it. That is J1 by another route, and it
   * is why this decides on the *baseline* parent rather than on `monsterKey`.
   *
   * **The revert is synchronous**, so the roster re-renders with that minion under A the instant B is
   * removed (UX §18.4's display requirement). It is not deferred to the submit, and it cannot be: the
   * target of the pending move is precisely the thing going away.
   *
   * **Accepted gap, stated rather than engineered** (§6.4): an *unsaved* minion has no baseline
   * parent to revert to, so one authored under A, moved to B and orphaned by B's removal loses the
   * typing. The store has no record of where it was authored, and inventing one for a third-order
   * case is not worth the field.
   */
  private settleMinionsOfRemovedMonster(minions: MinionDraft[], removed: MonsterDraft): MinionDraft[] {
    const survivors: MinionDraft[] = [];

    for (const minion of minions) {
      if (minion.monsterKey !== removed.localKey) {
        survivors.push(minion);
        continue;
      }

      const baselineHome =
        minion.existingMonsterId === null || minion.existingMonsterId === removed.id
          ? null
          : (this.monsterDrafts().find((candidate) => candidate.id === minion.existingMonsterId) ?? null);

      if (baselineHome !== null) {
        survivors.push({ ...minion, monsterKey: baselineHome.localKey });
      }
    }

    return survivors;
  }

  /**
   * Keeps the minion composer honest after the roster changes under it.
   *
   * Two states it can be left in: editing a minion that left with its monster, or holding a
   * `monsterKey` that no longer names a roster row. Both are the composer describing something that
   * does not exist, so it is reset rather than silently re-pointed at an arbitrary monster.
   */
  private reconcileMinionComposerWithRoster(): void {
    const editingKey = this.editingMinionKey();
    const editedStillPresent =
      editingKey === null || this.minionDrafts().some((draft) => draft.localKey === editingKey);
    const parentKey = this.effectiveMinionMonsterKey();
    const parentStillPresent =
      parentKey === '' || this.monsterDrafts().some((draft) => draft.localKey === parentKey);

    if (editedStillPresent && parentStillPresent) {
      return;
    }

    this.resetComposer();
    this.editingMinionKey.set(null);
    this.minionComposerOpen.set(this.minionDrafts().length === 0);
  }

  /** Clears the monster composer: core fields, the four sub-resource lists, and the four add-forms. */
  private resetMonsterComposer(): void {
    this.monsterForm.reset({
      name: '',
      description: '',
      harmCapacity: MONSTER_DEFAULT_HARM_CAPACITY,
      monsterTypeId: '',
      monsterArchetypeId: '',
    });
    this.monsterAttacks.set([]);
    this.monsterPowers.set([]);
    this.monsterWeaknesses.set([]);
    this.monsterArmors.set([]);
    this.monsterAttackForm.reset({ name: '', harm: 0, description: '', weaponTagIds: [] });
    this.monsterPowerForm.reset({ name: '', description: '' });
    this.monsterWeaknessForm.reset({ name: '', description: '' });
    this.monsterArmorForm.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' });
  }

  commitComposerIfValid(): boolean {
    if (!this.minionComposerOpen() || !this.minionComposerDirty()) {
      return true;
    }

    if (!this.minionComposerValid()) {
      // Same message all three callers surface, so the pencil / + Add Another Minion clicks are not
      // silent no-ops — they show the wizard's error band, not just the inline field errors.
      this.minionForm.markAllAsTouched();
      this.submitError.set(COMPOSER_BLOCKED_MESSAGE);
      return false;
    }

    this.saveMinionDraftToList();
    return true;
  }

  /** Commits the composer into the roster — replacing the edited slot, or appending a new minion. */
  saveMinionDraftToList(): void {
    if (!this.minionComposerValid()) {
      this.minionForm.markAllAsTouched();
      return;
    }

    const key = this.editingMinionKey();
    const existing = key !== null ? this.minionDrafts().find((item) => item.localKey === key) ?? null : null;

    const draft: MinionDraft = {
      // Keep the server ID and the sub-resource baselines of the slot being edited: submitPhase1
      // needs them to update rather than duplicate, and to delete the right children first.
      id: existing?.id ?? null,
      // Keep the edited card's key so the roster row keeps its identity; mint one for a new draft.
      localKey: existing?.localKey ?? createDraftKey(),
      // The picker's value — where the minion points *now*. The re-parent is a field edit, so this
      // is committed to the draft here and the roster shows it immediately (`5b-K6`); the verb
      // fires at submit, and only if this resolves to something other than the baseline below.
      monsterKey: this.effectiveMinionMonsterKey(),
      // J2: carried through untouched. It is the server's answer, and only a submit changes it.
      existingMonsterId: existing?.existingMonsterId ?? null,
      name: this.minionForm.controls.name.value.trim(),
      description: this.minionForm.controls.description.value ?? '',
      harmCapacity: this.minionForm.controls.harmCapacity.value,
      minionTypeId: this.minionForm.controls.minionTypeId.value,
      attacks: [...this.minionAttacks()],
      powers: [...this.minionPowers()],
      weaknesses: [...this.minionWeaknesses()],
      armors: [...this.minionArmors()],
      existingAttacks: existing?.existingAttacks ?? [],
      existingPowers: existing?.existingPowers ?? [],
      existingWeaknesses: existing?.existingWeaknesses ?? [],
      existingArmors: existing?.existingArmors ?? [],
    };

    this.minionDrafts.update((drafts) =>
      existing !== null ? drafts.map((item) => (item.localKey === draft.localKey ? draft : item)) : [...drafts, draft]
    );

    this.resetComposer();
    this.editingMinionKey.set(null);
    // Invariant: editingMinionKey() !== null implies minionComposerOpen(). Collapse to
    // "+ Add Another Minion" now that the roster has something in it.
    this.minionComposerOpen.set(this.minionDrafts().length === 0);
    this.submitError.set(null);
  }

  /**
   * Loads a roster card back into the composer — core fields and all four sub-resource lists.
   *
   * Returns whether the composer actually changed. A blocked commit (`commitComposerIfValid()`
   * returning `false`) or an unknown key leaves the composer where it was, and the caller must not
   * move focus in that case — see `MysteryCreateMonsterPhaseComponent.editDraft`.
   */
  editMinionDraft(key: string): boolean {
    if (!this.commitComposerIfValid()) {
      return false;
    }

    // Read the draft *after* the commit: committing may have rewritten the card we are about to
    // load. Keys make that safe to do by lookup rather than by position.
    const draft = this.minionDrafts().find((item) => item.localKey === key);
    if (!draft) {
      return false;
    }

    this.resetComposer();
    this.minionForm.patchValue({
      monsterKey: draft.monsterKey,
      name: draft.name,
      description: draft.description,
      harmCapacity: draft.harmCapacity,
      minionTypeId: draft.minionTypeId,
    });
    this.minionAttacks.set([...draft.attacks]);
    this.minionPowers.set([...draft.powers]);
    this.minionWeaknesses.set([...draft.weaknesses]);
    this.minionArmors.set([...draft.armors]);

    this.editingMinionKey.set(key);
    this.minionComposerOpen.set(true);
    return true;
  }

  /**
   * "+ Add Another Minion" — same commit rule as `Next`, then a blank composer. Returns whether
   * the composer opened, for the same focus reason as `editMinionDraft`.
   */
  startNewMinionDraft(): boolean {
    if (!this.commitComposerIfValid()) {
      return false;
    }

    this.resetComposer();
    this.editingMinionKey.set(null);
    this.minionComposerOpen.set(true);
    return true;
  }

  /** Abandons the composer's contents without touching the roster. */
  cancelComposerEdit(): void {
    this.resetComposer();
    this.editingMinionKey.set(null);
    this.minionComposerOpen.set(this.minionDrafts().length === 0);
  }

  /**
   * Removes a roster card. The draft's `id` (if any) is NOT deleted here — the real
   * `DELETE /api/minions/{id}` fires in `submitPhase1`'s diff, exactly like location/bystander
   * unlinking. Consequence, recorded rather than rediscovered: removing a previously-saved minion
   * and then abandoning the wizard leaves it on the server.
   */
  removeMinionDraft(key: string): void {
    const draft = this.minionDrafts().find((item) => item.localKey === key);
    if (!draft) {
      return;
    }

    // Decision 17: minions join the disposition drain, so a confirmed deletion survives a tracker
    // jump instead of being silently discarded (§10's repro, G1 one step over). Delete-only — the
    // `PendingRemoval` union will not carry `'detach'` for a minion.
    if (this.persistedForRemoval('minions', draft.id)) {
      this.recordRemoval({ collection: 'minions', id: draft.id as string, action: 'delete' });
    }

    this.minionDrafts.update((drafts) => drafts.filter((item) => item.localKey !== key));

    // `editingMinionKey` is an identity, not a position, so removing a *different* card cannot
    // invalidate it and there is nothing to re-index. The whole "editing > index, decrement"
    // adjustment this method used to carry — and the silent wrong-minion overwrite it existed to
    // prevent — is gone by construction (UX §10.2). The one case left is the real one: the card
    // being edited is the card that was removed.
    if (this.editingMinionKey() !== key) {
      return;
    }

    this.resetComposer();
    this.editingMinionKey.set(null);
    this.minionComposerOpen.set(this.minionDrafts().length === 0);
  }

  /** Clears the composer: core fields, the four sub-resource lists, and the four inline add-forms. */
  private resetComposer(): void {
    this.minionForm.reset({
      // Blank with two or more monsters, so the picker starts unset and its required validator
      // does its job. With exactly one, `effectiveMinionMonsterKey()` answers regardless of what is
      // in here, and the picker is not rendered at all.
      monsterKey: this.soleMonsterKey() ?? '',
      name: '',
      description: '',
      harmCapacity: MINION_DEFAULT_HARM_CAPACITY,
      minionTypeId: '',
    });
    this.minionAttacks.set([]);
    this.minionPowers.set([]);
    this.minionWeaknesses.set([]);
    this.minionArmors.set([]);
    this.minionAttackForm.reset({ name: '', harm: 0, description: '', weaponTagIds: [] });
    this.minionPowerForm.reset({ name: '', description: '' });
    this.minionWeaknessForm.reset({ name: '', description: '' });
    this.minionArmorForm.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' });
  }

  private validateCurrentStep(): boolean {
    const phase = this.currentPhase();
    const step = this.currentStep();

    if (phase === 0 && step === 0 && this.conceptForm.invalid) {
      this.conceptForm.markAllAsTouched();
      return false;
    }

    // **Decision 19 (§6.5): the phase-level hard block is gone.**
    //
    // What used to be here was `if (phase === 1 && step === 0 && this.monsterForm.invalid) block`,
    // which made a monster mandatory. Under a roster the phase's validity is a property of the
    // roster, not of one form — and a mystery may legitimately have no monster at all, because not
    // every threat is a creature.
    //
    // **Nothing replaces it here**, and that is deliberate: `next()` calls
    // `commitMonsterComposerIfValid()` immediately after this, which already refuses a
    // started-but-invalid composer and sets the same message. A branch here would be a second copy
    // of the same rule — which is exactly what phases 2 and 3 already decline to carry, for the
    // reason the note below gives. A negative control confirmed the duplicate was unobservable.
    //
    // The composer's own field validators are untouched, and that pairing is load-bearing (UX
    // §16.6): stripping them would *also* produce a wizard that advances on an empty roster, so
    // `5b-O4` tests both halves — an untouched composer advances, a half-typed one still blocks.

    if (phase === 1 && step === 1) {
      // Three-way classification of the open composer: empty -> proceed; valid -> commit and
      // proceed (see next()); started but invalid -> block, so the work isn't silently discarded.
      if (this.minionComposerOpen() && this.minionComposerDirty() && !this.minionComposerValid()) {
        this.minionForm.markAllAsTouched();
        this.submitError.set(COMPOSER_BLOCKED_MESSAGE);
        return false;
      }

      this.submitError.set(null);
    }

    // Phases 2 and 3 deliberately have no branch here. The minion phase carries one *and* the
    // matching `commitComposerIfValid()` call in `next()`, and for a single-step phase the pair is
    // redundant: both set the same message and both refuse. The commit rule is the one that has to
    // exist — it is what commits a valid composer — so the blocked case lives with it rather than
    // being stated twice. A negative control confirmed the duplicate was unobservable.

    return true;
  }

  private submitCurrentPhase(): void {
    this.isSubmitting.set(true);
    this.submitError.set(null);

    switch (this.currentPhase()) {
      case 0:
        this.submitPhase0();
        break;
      case 1:
        this.submitPhase1();
        break;
      case 2:
        this.submitPhase2();
        break;
      case 3:
        this.submitPhase3();
        break;
    }
  }

  private submitPhase0(): void {
    const mysteryRequest: UpsertMysteryRequest = {
      name: this.conceptForm.controls.name.value.trim(),
      concept: this.toNullable(this.conceptForm.controls.concept.value),
      hook: this.toNullable(this.hookForm.controls.hook.value),
      overview: this.toNullable(this.overviewForm.controls.overview.value),
      notes: null,
      adventureTypeId: this.conceptForm.controls.adventureTypeId.value,
    };

    const existingId = this.mysteryId();
    const save$ = existingId
      ? this.mysteryService.update(existingId, mysteryRequest)
      : this.mysteryService.create(mysteryRequest);

    save$
      .pipe(
        switchMap((mystery) => {
          this.mysteryId.set(mystery.id);

          const countdownRequest: UpsertCountdownRequest = {
            day: this.toNullable(this.countdownForm.controls.day.value),
            shadows: this.toNullable(this.countdownForm.controls.shadows.value),
            sunset: this.toNullable(this.countdownForm.controls.sunset.value),
            dusk: this.toNullable(this.countdownForm.controls.dusk.value),
            nightfall: this.toNullable(this.countdownForm.controls.nightfall.value),
            midnight: this.toNullable(this.countdownForm.controls.midnight.value),
          };

          // **The moves are a `forkJoin` sibling of the countdown, not chained after it** (§30.3).
          // Both are sub-resources of the same id and neither depends on the other; chaining would
          // make a countdown failure hide a move failure, and the reverse. This is the shape §13.5.2
          // predicted — `submitPhase0` was already an entity-then-id-dependent-sub-resource
          // pipeline, so the moves are one more entry beside `upsertCountdown` rather than a new
          // stage.
          //
          // **The drain stays chained after both, and that is pre-existing rather than chosen.**
          // H6 (§7.7h) says the drain should be a `forkJoin` sibling so a failed save cannot
          // strand a confirmed deletion, and phases 1, 2 and 3 all do that. Phase 0 does not, and
          // did not before this change — adding the moves beside the countdown means one more
          // sibling whose failure strands the drain. Promoting it here is a behaviour change on the
          // failure path that nothing in 5f-1 asked for and no spec pins, so it is recorded as
          // **F-L8** instead of made quietly.
          return forkJoin({
            countdown: this.mysteryService.upsertCountdown(mystery.id, countdownRequest),
            moves: applySubResourceDiff(
              mystery.id,
              this.mysteryCustomMoves(),
              this.existingMysteryCustomMoves(),
              this.mysteryMoves,
            ),
          }).pipe(
            switchMap(({ moves }) => {
              // Ids onto the drafts **and** the new baseline, from the one diff result, in one step
              // (H2) — the same discipline `writeBackMonsterDrafts` follows one phase over.
              this.writeBackMysteryCustomMoves(moves);
              // Every phase drains, including this one (decision 15). Reachable in edit mode: trash
              // a location, confirm Delete, jump back to the Mystery phase on the tracker, press
              // Next.
              return this.applyPendingRemovals(mystery.id);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (drained) => {
          this.clearDrainedRemovals(drained);
          this.advancePhase();
        },
        error: () => this.handleSubmitError('Could not save mystery. Please try again.'),
      });
  }

  /**
   * **Phase 1 as a roster diff** (§6.1): roster diff → sub-resource diff per monster → minion diff,
   * with the disposition drain as a sibling.
   *
   * Three things this is deliberately not:
   *
   * 1. **It does not synthesise a monster from an empty composer.** Until 5b this called
   *    `monsterService.create(mysteryId, monsterRequest)` unconditionally, so an untouched phase
   *    would have written an empty monster row — invisible on the detail page, which is exactly why
   *    `5b-O1` asserts the absence of the row rather than the appearance of the page.
   * 2. **An empty roster still submits.** The drain runs and the roster diff runs, because an
   *    edit-mode revisit reaches an empty roster by *removing* the last monster (`5b-O2`).
   * 3. **The drain is a `forkJoin` sibling, not a link in the save chain** (H6, §7.7h), so a failed
   *    monster save cannot strand a confirmed deletion.
   */
  private submitPhase1(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save monster. Please try again.');
      return;
    }

    const drafts = this.monsterDrafts();

    // `pendingRemovals` is authoritative; this is the consistency check (§7.3). Anything with a
    // recorded disposition is excluded, so a confirmed Delete does not also fire a blind unlink.
    const unlinked$ = this.runBatch(
      this.idsToRemove(this.existingMonsterIds(), drafts, 'monsters').map((monsterId) =>
        this.monsterService.unlinkFromMystery(mysteryId, monsterId),
      ),
    );

    const savedRoster$ =
      drafts.length === 0
        ? of<SavedMonster[]>([])
        : forkJoin(drafts.map((draft, index) => this.saveMonsterDraft(mysteryId, draft, index)));

    const rosterAndMinions$ = forkJoin({ unlinked: unlinked$, saved: savedRoster$ }).pipe(
      switchMap(({ saved }) => {
        // The saved rows become each draft's new baseline **and** are re-keyed onto its drafts in
        // the same step. Refreshing one without the other is H2: the drafts could never match the
        // baseline again, so every subsequent submit would delete and recreate the lot.
        this.writeBackMonsterDrafts(saved);
        // Minions come after, because `monsterKey → monsterId` is only resolvable once every
        // monster authored in this session has an id (§6.3, `5b-R5`).
        return this.saveMinionDrafts();
      }),
    );

    forkJoin({
      saved: rosterAndMinions$,
      drained: this.applyPendingRemovals(mysteryId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ drained }) => {
          this.clearDrainedRemovals(drained);
          this.advancePhase();
        },
        error: () => this.handleSubmitError('Could not save monster. Please try again.'),
      });
  }

  /** One roster row: the monster itself, its membership, and its four sub-resource collections. */
  private saveMonsterDraft(mysteryId: string, draft: MonsterDraft, index: number): Observable<SavedMonster> {
    const request: UpsertMonsterRequest = {
      name: draft.name,
      description: this.toNullable(draft.description),
      harmCapacity: draft.harmCapacity,
      monsterTypeId: draft.monsterTypeId,
      monsterArchetypeId: draft.monsterArchetypeId,
    };

    // §5.1 Concern A, one level up from the locations path: `update` carries no mystery in its URL,
    // so without the membership PUT an attached monster has its fields written and is never added
    // to the mystery — a silent no-op that makes the whole feature look like it works. `create`
    // needs no such call: its URL is mystery-scoped and the row is created attached.
    const save$ =
      draft.id !== null
        ? forkJoin({
            monster: this.monsterService.update(draft.id, request),
            linked: this.monsterService.linkToMystery(mysteryId, draft.id),
          }).pipe(map(({ monster }) => monster))
        : this.monsterService.create(mysteryId, request);

    return save$.pipe(
      switchMap((monster) =>
        this.saveThreatCollections(monster.id, draft).pipe(
          map((collections) => ({ index, id: monster.id, collections })),
        ),
      ),
    );
  }

  /** Ids and baselines back onto the roster, from the same saved rows, in one step. */
  private writeBackMonsterDrafts(saved: SavedMonster[]): void {
    if (saved.length === 0) {
      return;
    }

    this.monsterDrafts.update((drafts) => {
      const next = [...drafts];
      for (const { index, id, collections } of saved) {
        const draft = next[index];
        if (!draft) {
          continue;
        }

        next[index] = {
          ...draft,
          id,
          attacks: rekeyDrafts(draft.attacks, collections.attacks),
          powers: rekeyDrafts(draft.powers, collections.powers),
          weaknesses: rekeyDrafts(draft.weaknesses, collections.weaknesses),
          armors: rekeyDrafts(draft.armors, collections.armors),
          existingAttacks: collections.attacks,
          existingPowers: collections.powers,
          existingWeaknesses: collections.weaknesses,
          existingArmors: collections.armors,
        };
      }
      return next;
    });

    // The roster baseline: every monster now on the roster has a persisted membership.
    this.existingMonsterIds.set(this.savedDraftIds(this.monsterDrafts()));
  }

  /**
   * **Phase 2 in phase 1's per-row shape** (5f-0).
   *
   * Behaviour-preserving by construction. The same five request groups go out; they are only
   * *reassociated*, from "all the updates, then all the links" into one `update`+`link` pair per
   * draft. `forkJoin` subscribes in source order, so the **wire order** changes and nothing else
   * does — which is observable only to an oracle that asserts sequence, and neither ledger spec
   * does: `expectLedger` is `expect([...sent].sort()).toEqual([...expected].sort())`, which is
   * **multiset** equality. Same calls, same multiplicity, any order. Sequence is the one thing
   * given up, and `PUT /api/locations/{id}` and `PUT /api/mysteries/{m}/locations/{id}` are
   * independent resources whose interleaving is unobservable.
   *
   * **There is no entity-level dirty check here and there must not be one.** Every draft with an id
   * is written unconditionally, exactly as before. The temptation is structural rather than
   * careless — this shape exists so that `applySubResourceDiff` can hang off stage two, and a
   * reader who has just internalised "don't write what hasn't changed" one level down will reach
   * for it one level up. `S4` ("three rows, six calls") and `A6` are the tests that say no; the
   * dirty check lives only inside `applySubResourceDiff`, over a sub-resource collection, where
   * decision 9 put it.
   *
   * **The shape is the point, not the saving.** `saveLocationRow` now has a stage that runs with the
   * location's own id in hand, which is where its custom-move diff goes in 5f-3a. Deliberately
   * empty here: 5f-0 ships no custom-move code at all, so that "the ledgers pass unchanged" is a
   * claim about a restructure and nothing else.
   *
   * Two deviations from phase 1's literal shape, both deliberate:
   *
   * 1. **The outer `forkJoin` stays flat.** `submitPhase1` nests `{ unlinked, saved }` inside a
   *    `switchMap` because minions cannot be saved until every monster has an id. Locations have no
   *    dependent second collection, so the nesting would buy nothing and would move the writeback
   *    into an async step for no reason.
   * 2. **`saveLocationRow`, not `saveLocationDraft`.** That name is taken by the public composer
   *    commit (`:1472`), and the symmetric fix — renaming it `saveLocationDraftToList`, as the
   *    monsters path did — would edit `mystery-create-phase4-ledger.spec.ts`, which is 5f-0's
   *    oracle. The rename is a follow-up for after this gate is discharged (F-L6).
   */
  private submitPhase2(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save locations. Please try again.');
      return;
    }

    const drafts = this.locations();

    // `pendingRemovals` is authoritative; this is the consistency check (§7.3). Anything with a
    // recorded disposition is excluded, so a confirmed Delete does not also fire a blind unlink.
    const unlinked$ = this.runBatch(
      this.idsToRemove(this.existingLocationIds(), drafts, 'locations').map((locationId) =>
        this.locationService.unlinkFromMystery(mysteryId, locationId),
      ),
    );

    // `runBatch`'s empty short-circuit is load-bearing on this path, not a tidiness: an empty
    // roster must still *emit* so the subscriber runs, and a bare `forkJoin([])` completes without
    // emitting. See the same note on `batch` in `sub-resource-diff.ts`.
    const saved$ = this.runBatch(drafts.map((draft, index) => this.saveLocationRow(mysteryId, draft, index)));

    forkJoin({
      // The drain is a `forkJoin` sibling, not a link in the save chain (H6, §7.7h), so a failed
      // location save cannot strand a confirmed deletion.
      drained: this.applyPendingRemovals(mysteryId),
      unlinked: unlinked$,
      saved: saved$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ saved, drained }) => {
          this.clearDrainedRemovals(drained);
          this.writeBackLocationDrafts(saved);
          this.advancePhase();
        },
        error: () => this.handleSubmitError('Could not save locations. Please try again.'),
      });
  }

  /**
   * One locations roster row: the location itself and its membership.
   *
   * The `index` is carried through to the writeback rather than the result being matched by
   * position at resolve time — phase 1's approach (`saveMonsterDraft:2360`), and the reason
   * `backfillDraftIds` is gone. That helper paired create responses against the id-less drafts *in
   * order*, which is correct only while nothing mutates the array between submit and resolve. The
   * index costs nothing and does not depend on that holding.
   */
  private saveLocationRow(mysteryId: string, draft: LocationDraft, index: number): Observable<SavedFlatRow> {
    const request: UpsertLocationRequest = {
      name: draft.name,
      description: this.toNullable(draft.description),
      locationTypeId: draft.locationTypeId,
    };

    // §5.1 Concern A, the same one the monsters path states: `update` carries no mystery in its
    // URL, so without the membership PUT an attached location has its fields written and is never
    // added to the mystery — a silent no-op that makes the whole feature look like it works. Fired
    // for every draft with an id, unconditionally: the verb is idempotent in effect, so no branch
    // is needed or wanted. `create` needs no such call — its URL is mystery-scoped and the row is
    // created attached.
    //
    // **The row keeps the id we PUT at — it is not re-read from the response.** The ledger fakes
    // answer `update` with a sentinel ('loc-updated'), and adopting it re-keys a persisted draft
    // off whatever the server echoed. In production the two agree, so this is invisible until
    // they do not; it is still a behaviour change, and 5f-0 must not make one. (`saveMonsterDraft`
    // does take the response id — the same observation, one phase over, recorded as F-L7.)
    const persistedId = draft.id;
    const saved$ =
      persistedId !== null
        ? forkJoin({
            location: this.locationService.update(persistedId, request),
            linked: this.locationService.linkToMystery(mysteryId, persistedId),
          }).pipe(map(() => persistedId))
        : this.locationService.create(mysteryId, request).pipe(map((location) => location.id));

    // 5f-3a's seam: `switchMap` into the row's custom-move diff here, with the id in hand.
    return saved$.pipe(map((id) => ({ index, id })));
  }

  /** Ids back onto the locations roster by draft index, and the membership baseline, in one step. */
  private writeBackLocationDrafts(saved: SavedFlatRow[]): void {
    this.locations.update((drafts) => this.applySavedIds(drafts, saved));
    // Unconditional, including when nothing was saved: emptying the roster by removing its last
    // location has to clear the baseline too, or the next submit's `idsToRemove` re-fires it.
    this.existingLocationIds.set(this.savedDraftIds(this.locations()));
  }

  private submitPhase3(): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      this.handleSubmitError('Could not save bystanders. Please try again.');
      return;
    }

    const drafts = this.bystanders();

    const unlinked$ = this.runBatch(
      this.idsToRemove(this.existingBystanderIds(), drafts, 'bystanders').map((bystanderId) =>
        this.bystanderService.unlinkFromMystery(mysteryId, bystanderId),
      ),
    );

    const saved$ = this.runBatch(drafts.map((draft, index) => this.saveBystanderRow(mysteryId, draft, index)));

    forkJoin({
      drained: this.applyPendingRemovals(mysteryId),
      unlinked: unlinked$,
      saved: saved$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ saved, drained }) => {
          this.clearDrainedRemovals(drained);
          this.writeBackBystanderDrafts(saved);

          this.isSubmitting.set(false);
          this.notificationService.success(this.isEditMode() ? 'Mystery updated!' : 'Mystery created!');
          this.router.navigate(['/mysteries', mysteryId]);
        },
        error: () => this.handleSubmitError('Could not save bystanders. Please try again.'),
      });
  }

  /** One bystanders roster row — see the locations twin for Concern A and for the carried `index`. */
  private saveBystanderRow(mysteryId: string, draft: BystanderDraft, index: number): Observable<SavedFlatRow> {
    const request: UpsertBystanderRequest = {
      name: draft.name,
      description: this.toNullable(draft.description),
      bystanderTypeId: draft.bystanderTypeId,
    };

    const persistedId = draft.id;
    const saved$ =
      persistedId !== null
        ? forkJoin({
            bystander: this.bystanderService.update(persistedId, request),
            linked: this.bystanderService.linkToMystery(mysteryId, persistedId),
          }).pipe(map(() => persistedId))
        : this.bystanderService.create(mysteryId, request).pipe(map((bystander) => bystander.id));

    // 5f-3a's seam, and the id rule — see the locations twin.
    return saved$.pipe(map((id) => ({ index, id })));
  }

  /** See `writeBackLocationDrafts`. */
  private writeBackBystanderDrafts(saved: SavedFlatRow[]): void {
    this.bystanders.update((drafts) => this.applySavedIds(drafts, saved));
    this.existingBystanderIds.set(this.savedDraftIds(this.bystanders()));
  }

  /**
   * The id half of a flat roster's writeback, shared by locations and bystanders because they are
   * the same operation on two draft types. Rows the save did not cover are left alone — which is
   * only reachable if the array shrank mid-flight, and is the case `backfillDraftIds`' positional
   * match got wrong.
   */
  private applySavedIds<T extends { id: string | null }>(drafts: T[], saved: SavedFlatRow[]): T[] {
    if (saved.length === 0) {
      return drafts;
    }

    const next = [...drafts];
    for (const { index, id } of saved) {
      const draft = next[index];
      if (draft) {
        next[index] = { ...draft, id };
      }
    }
    return next;
  }

  /**
   * The minion diff, across the whole roster.
   *
   * **The baseline is per-monster and the drafts operand is global** (§7.7i, and it is the half that
   * is easy to get wrong): `removedIds(D) = D.existingMinionIds − all minion drafts − disposed`.
   * Scoping the drafts per-monster too would delete a minion **re-parented away from D** — its id is
   * in D's baseline, and its draft now carries another monster's `monsterKey`.
   *
   * J1 is closed upstream of this function rather than inside it. A removed monster took its
   * `existingMinionIds` with it, so its children are no longer in *any* baseline here, and the blind
   * `delete()` that used to fire for them on this path — the path with no 404 handler — has nothing
   * to iterate over.
   */
  private saveMinionDrafts(): Observable<unknown> {
    const drafts = this.minionDrafts();
    const monsters = this.monsterDrafts();
    const monsterIdFor = (monsterKey: string): string | null =>
      monsters.find((monster) => monster.localKey === monsterKey)?.id ?? null;

    const toRequest = (draft: MinionDraft): UpsertMinionRequest => ({
      name: draft.name,
      description: this.toNullable(draft.description),
      harmCapacity: draft.harmCapacity,
      minionTypeId: draft.minionTypeId,
    });

    // `'minions'` is passed, and the parameter is required (§7.7c): a confirmed minion deletion is
    // drain-borne, so this diff must not fire a second `DELETE` for the same row. That second copy
    // is not on the drain path and has no 404 handler, so it would fail the phase.
    const removedIds = monsters.flatMap((monster) => this.idsToRemove(monster.existingMinionIds, drafts, 'minions'));

    return this.runBatch(removedIds.map((minionId) => this.minionService.delete(minionId))).pipe(
      switchMap(() =>
        this.runBatch(
          drafts.map((draft, index) => this.saveOneMinion(draft, index, monsterIdFor(draft.monsterKey))),
        ),
      ),
      tap((results) => this.writeBackMinionDrafts(drafts, results)),
    );
  }

  /** One minion: its own row, its re-parent if the parent actually changed, then its four collections. */
  private saveOneMinion(draft: MinionDraft, index: number, monsterId: string | null): Observable<SavedMinion | null> {
    // A minion cannot exist without a monster (`Minion.MonsterId` is a required FK), and the
    // composer's `monsterKey` validator is what normally guarantees one. This is the belt-and-braces
    // arm: skip rather than invent a parent, so a roster/draft disagreement cannot create an orphan.
    if (monsterId === null) {
      return of(null);
    }

    const request: UpsertMinionRequest = {
      name: draft.name,
      description: this.toNullable(draft.description),
      harmCapacity: draft.harmCapacity,
      minionTypeId: draft.minionTypeId,
    };

    const save$ =
      draft.id !== null ? this.minionService.update(draft.id, request) : this.minionService.create(monsterId, request);

    return save$.pipe(
      switchMap((minion) =>
        this.reparentIfMoved(draft, minion.id, monsterId).pipe(
          switchMap(() =>
            this.saveMinionCollections(minion.id, draft).pipe(
              map((collections) => ({ index, minionId: minion.id, monsterId, collections })),
            ),
          ),
        ),
      ),
    );
  }

  /**
   * **The re-parent, and it fires only when the parent actually changed** (J2, `5b-K4`).
   *
   * `UpsertMinionRequest` carries no `MonsterId` and `UpdateAsync` never sets one, so the plain
   * update cannot move a minion — that is what decision 18's dedicated verb is for. Comparing
   * against `existingMonsterId` rather than firing unconditionally matters for a reason beyond N
   * no-op writes per Next: this verb **moves**, and against a stale id it silently relocates a
   * minion rather than failing. Issuing it only on a real change keeps the blast radius equal to
   * the user's actual intent.
   *
   * A newly created minion needs no move — `create(monsterId, …)` parented it correctly — and its
   * `existingMonsterId` is `null`, which this treats as "nothing to move from".
   */
  private reparentIfMoved(draft: MinionDraft, minionId: string, monsterId: string): Observable<unknown> {
    const moved = draft.id !== null && draft.existingMonsterId !== null && draft.existingMonsterId !== monsterId;
    return moved ? this.minionService.moveToMonster(monsterId, minionId) : of(undefined);
  }

  /**
   * Ids, parents and baselines back onto the minion drafts — and the per-monster minion baseline
   * rebuilt from the same saved state, so `MonsterDraft.existingMinionIds` reflects where each
   * minion now actually lives (which is what makes the *next* submit's diff correct).
   */
  private writeBackMinionDrafts(drafts: MinionDraft[], results: (SavedMinion | null)[]): void {
    const saved = [...drafts];
    for (const result of results) {
      if (result === null) {
        continue;
      }

      const { index, minionId, monsterId, collections } = result;
      const draft = saved[index];
      saved[index] = {
        ...draft,
        id: minionId,
        // J2: the server's parent is now the one we just saved against.
        existingMonsterId: monsterId,
        attacks: rekeyDrafts(draft.attacks, collections.attacks),
        powers: rekeyDrafts(draft.powers, collections.powers),
        weaknesses: rekeyDrafts(draft.weaknesses, collections.weaknesses),
        armors: rekeyDrafts(draft.armors, collections.armors),
        existingAttacks: collections.attacks,
        existingPowers: collections.powers,
        existingWeaknesses: collections.weaknesses,
        existingArmors: collections.armors,
      };
    }

    this.minionDrafts.set(saved);
    this.monsterDrafts.update((monsters) =>
      monsters.map((monster) => ({
        ...monster,
        existingMinionIds: saved
          .filter((minion) => minion.monsterKey === monster.localKey && minion.id !== null)
          .map((minion) => minion.id as string),
      })),
    );
  }
  /**
   * Baseline ids no longer claimed by any draft.
   *
   * **`pendingRemovals` is authoritative and this is the consistency check** (§7.3), so anything
   * that collection has a recorded disposition for is excluded here. Without that exclusion a
   * confirmed **Delete** would also fire this path's blind `unlinkFromMystery` in the same
   * `forkJoin` — two calls for one removal, racing, with the unlink liable to 404 against the row
   * the delete just destroyed and fail the whole phase.
   *
   * **`drafts` is the whole collection, even when `savedIds` is one owner's baseline** (§7.7i). The
   * minion caller passes one monster's `existingMinionIds` and *all* minion drafts: scoping both
   * sides per-monster would delete a minion re-parented away from that monster, whose id is in its
   * old owner's baseline and whose draft now carries a different `monsterKey`.
   */
  private idsToRemove(
    savedIds: string[],
    drafts: { id: string | null }[],
    // **Required since 5a** (§7.7c). It was optional, and an omitted argument filtered the
    // disposition set on `undefined` — matching nothing, so the drain-versus-diff exclusion
    // silently did not apply. The minion call site omitted it, which was harmless only while
    // `'minions'` was not a `RemovalCollection`. Decision 17 closed that window, so the parameter
    // closes with it: omitting it no longer compiles.
    collection: RemovalCollection,
  ): string[] {
    const disposed = new Set(
      this.pendingRemovals()
        .filter((removal) => removal.collection === collection)
        .map((removal) => removal.id),
    );

    return savedIds.filter((savedId) => !disposed.has(savedId) && !drafts.some((draft) => draft.id === savedId));
  }

  /**
   * Applies every confirmed removal, whichever phase recorded it (decision 15). Folded into *every*
   * `submitPhaseN`'s batch, which is what closes G1: an edit-mode tracker jump out of Locations
   * still leaves the disposition recorded, and the next phase the user submits applies it.
   *
   * Emits what it drained, so the caller can do the bookkeeping in `clearDrainedRemovals`.
   */
  private applyPendingRemovals(mysteryId: string): Observable<PendingRemoval[]> {
    // Discard anything that is no longer this drain's business *before* anything is sent (§7.7e/f).
    this.pendingRemovals.update((list) => list.filter((removal) => this.stillTheRostersBusiness(removal)));

    const drained = this.pendingRemovals();
    if (drained.length === 0) {
      return of<PendingRemoval[]>([]);
    }

    return this.runBatch(drained.map((removal) => this.removalRequest(mysteryId, removal))).pipe(
      map(() => drained),
    );
  }

  /**
   * **"Is this disposition still the roster's business?"** — stated as intent rather than as a
   * lookup, because the lookup is not the rule (§7.7e/f).
   *
   * Two ways it stops being so:
   *
   * 1. **The row is back on the roster.** Re-attaching cancels the removal (D9). Previously that
   *    was an invariant maintained by hand in every attach method, which also left the drain racing
   *    a concurrent link against the same bridge row. Here it is one place, so a future
   *    `attachMonster` that forgets `cancelPendingRemoval` is harmless rather than a race.
   * 2. **Its parent left the roster.** Delete a minion, then remove its monster: the minion's draft
   *    leaves with its parent, so (1) no longer finds it and the disposition survives. Under a
   *    monster **detach** it would then destroy that minion in every other mystery — while the
   *    modal the user just read promised detach leaves minions alone. Under **delete** the FK
   *    cascade already handles the children, so a separate delete is the duplicate request §7.7d
   *    exists to prevent.
   *
   * **Dropped, not skipped.** A skipped disposition stays in the list and fires on a later submit,
   * which converts a race into a delayed-action bug that is much harder to find.
   */
  private stillTheRostersBusiness(removal: PendingRemoval): boolean {
    switch (removal.collection) {
      case 'locations':
        return !this.locations().some((draft) => draft.id === removal.id);
      case 'bystanders':
        return !this.bystanders().some((draft) => draft.id === removal.id);
      case 'monsters':
        return !this.monsterDrafts().some((draft) => draft.id === removal.id);
      case 'minions':
        // **A child whose parent has left the roster is not the roster's business** (§7.7f, H4).
        // Delete a minion, then remove its monster: the minion's draft leaves with its parent, so
        // "is it back in the drafts" no longer finds it and the disposition would survive. Under a
        // monster *detach* that would destroy the minion in every other mystery, while the modal
        // the user read promised detach leaves minions alone. Under *delete* the FK cascade has
        // already taken it, so the request is a duplicate.
        return (
          this.monsterDrafts().some((monster) => monster.existingMinionIds.includes(removal.id)) &&
          !this.minionDrafts().some((draft) => draft.id === removal.id)
        );
    }
  }

  private removalRequest(mysteryId: string, removal: PendingRemoval): Observable<unknown> {
    // A `switch`, for the reason §7.7g gives about `persistedForRemoval`: dispatch over this union
    // decides whether a row is destroyed or merely unlinked, and a ternary chain resolves a newly
    // added member to whichever arm happens to be last, with no compile error.
    const request = ((): Observable<unknown> => {
      switch (removal.collection) {
        case 'locations':
          return removal.action === 'delete'
            ? this.locationService.delete(removal.id)
            : this.locationService.unlinkFromMystery(mysteryId, removal.id);
        case 'bystanders':
          return removal.action === 'delete'
            ? this.bystanderService.delete(removal.id)
            : this.bystanderService.unlinkFromMystery(mysteryId, removal.id);
        case 'monsters':
          // Delete FK-cascades the minions (decision 13) — which is why no separate minion
          // disposition is ever recorded for them, and why exactly one DELETE goes out (`5b-M3`).
          return removal.action === 'delete'
            ? this.monsterService.delete(removal.id)
            : this.monsterService.unlinkFromMystery(mysteryId, removal.id);
        case 'minions':
          // Delete-only, and `removal.action` is narrowed to `'delete'` by the union itself
          // (decision 17): a minion has no mystery membership, so there is nothing to detach.
          return this.minionService.delete(removal.id);
      }
    })();

    // §7.3 rule 2, and *only* here. A 404 on this path means the post-condition the user asked for
    // already holds — "this is not in this mystery", or "this does not exist" — which is exactly
    // what a replayed disposition after a partial fan-out failure looks like. The rule is scoped to
    // the removal path on purpose: a 404 on the *link* path means the opposite (the thing being
    // linked is gone), and mapping that to success would report a membership never created.
    return request.pipe(catchError((error) => (this.isNotFound(error) ? of(undefined) : throwError(() => error))));
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  /**
   * Bookkeeping after a drain lands. Three consumers of one step:
   *
   * 1. **Clear what this submit drained**, not the whole list — the list is wizard-scoped now, and
   *    a concurrent record is not this submit's to discard (rule 1, as corrected by decision 15).
   * 2. **Drop the id from the owning collection's baseline.** Otherwise that phase's own
   *    `idsToRemove()` later sees an id in the baseline and not in the drafts and fires a second
   *    removal. Harmless — rule 2 swallows the 404 — but it is a duplicate request from sloppy
   *    state, and `pendingRemovals` is meant to be authoritative with `idsToRemove()` as the check.
   * 3. **Drop a deleted entity from the cached attach options** (§7.6): the picker's options are a
   *    page-load snapshot, so without this a `Back` re-offers something that no longer exists and
   *    attaching it fails the whole phase on a 404 that rule 2 deliberately does not cover.
   */
  private clearDrainedRemovals(drained: PendingRemoval[]): void {
    if (drained.length === 0) {
      return;
    }

    const key = (removal: PendingRemoval): string => `${removal.collection}:${removal.id}`;
    const drainedKeys = new Set(drained.map(key));
    this.pendingRemovals.update((list) => list.filter((removal) => !drainedKeys.has(key(removal))));

    const idsFor = (collection: RemovalCollection, action?: 'detach' | 'delete'): Set<string> =>
      new Set(
        drained
          .filter((removal) => removal.collection === collection && (!action || removal.action === action))
          .map((removal) => removal.id),
      );

    const removedLocations = idsFor('locations');
    if (removedLocations.size > 0) {
      this.existingLocationIds.update((ids) => ids.filter((id) => !removedLocations.has(id)));
    }

    const removedBystanders = idsFor('bystanders');
    if (removedBystanders.size > 0) {
      this.existingBystanderIds.update((ids) => ids.filter((id) => !removedBystanders.has(id)));
    }

    const deletedLocations = idsFor('locations', 'delete');
    if (deletedLocations.size > 0) {
      this.catalogLocations.update((items) => items.filter((item) => !deletedLocations.has(item.id)));
    }

    const deletedBystanders = idsFor('bystanders', 'delete');
    if (deletedBystanders.size > 0) {
      this.catalogBystanders.update((items) => items.filter((item) => !deletedBystanders.has(item.id)));
    }

    const removedMonsters = idsFor('monsters');
    if (removedMonsters.size > 0) {
      this.existingMonsterIds.update((ids) => ids.filter((id) => !removedMonsters.has(id)));
    }

    const deletedMonsters = idsFor('monsters', 'delete');
    if (deletedMonsters.size > 0) {
      this.catalogMonsters.update((items) => items.filter((item) => !deletedMonsters.has(item.id)));
    }

    /**
     * **The minions arm, walking the roster** (BUG 1, §7.7j).
     *
     * 5a pruned a flat `existingMinionIds` signal here. When J1 moved that baseline onto
     * `MonsterDraft` this arm was **deleted** rather than relocated, on the justification that "the
     * only way a minion's disposition drains is if its monster is still on the roster — in which
     * case the id is dropped by the submit's writeback."
     *
     * **The first clause holds; the second does not.** `applyPendingRemovals` runs from all four
     * `submitPhaseN` (decision 15, which is what closed G1); `writeBackMinionDrafts` runs from one,
     * inside `submitPhase1`. Drain a minion deletion from phase 0, 2 or 3 and the id stays in its
     * monster's baseline with its disposition now cleared — which is exactly *baseline − drafts −
     * disposed* leaving it in `removedIds`, a blind second `DELETE` on the diff path, the one with
     * no 404 handler. The phase then fails and **the user cannot leave the Monsters step**, with no
     * amount of retrying helping, because nothing ever clears the stale entry.
     *
     * It belongs here and not in `stillTheRostersBusiness`: that decides *which* dispositions drain;
     * this is bookkeeping after one succeeds, which is consumer 2's documented job. Fusing the two
     * is how §7.7 produced (e), (f) and (i).
     */
    const removedMinions = idsFor('minions');
    if (removedMinions.size > 0) {
      this.monsterDrafts.update((drafts) =>
        drafts.map((draft) =>
          draft.existingMinionIds.some((id) => removedMinions.has(id))
            ? { ...draft, existingMinionIds: draft.existingMinionIds.filter((id) => !removedMinions.has(id)) }
            : draft,
        ),
      );
    }
  }

  private savedDraftIds(drafts: { id: string | null }[]): string[] {
    return drafts.map((draft) => draft.id).filter((id): id is string => id !== null);
  }

  /**
   * The four sub-resource adapters for a minion. Each one is the small amount that differs between
   * collections; everything else lives in `applySubResourceDiff`.
   */
  /**
   * The custom-move adapter, parameterised by owner type — **the first adapter in this file that
   * needs no per-owner twin** (§13.5.1). `monsterPowerService` and `minionPowerService` exist as a
   * pair only because their service methods differ by domain; `CustomMoveService`'s do not, so one
   * factory and a closure per owner is the whole of it. The last two members are byte-identical to
   * `monsterPowerService`'s, which is §13.1 item 4 made concrete.
   */
  private customMoveSubResource(
    ownerType: CustomMoveOwnerType,
  ): SubResourceService<CustomMoveDraft, UpsertCustomMoveRequest, CustomMoveResponse> {
    return {
      create: (id, request) => this.customMoveService.create(ownerType, id, request),
      update: (id, moveId, request) => this.customMoveService.update(ownerType, id, moveId, request),
      delete: (id, moveId) => this.customMoveService.delete(ownerType, id, moveId),
      toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
      isDirty: (draft, baseline) =>
        draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
    };
  }

  /**
   * **The owner-type literals live here, adjacent, and never at a save site** (§35.4).
   *
   * The wizard will end up with five owners in one 3,000-line file, and
   * `customMoveSubResource('Monster')` written inside `saveMinionCollections` is one token, compiles,
   * and writes a minion's moves into the monster owner space — invisible until someone opens the
   * monster. Collapsing the literals into a block that reads as a table is the fix that works: a
   * reviewer can check five adjacent lines against five collection names in one glance, and cannot
   * check five literals a thousand lines apart. Same move `OWNER_SEGMENT` makes in
   * `core/custom-moves.ts`.
   *
   * **One field so far, by design.** The other four join *this block* as 5f-2 and 5f-3a arrive —
   * not their save sites. Declaring them now would ship four unused fields whose shape depends on
   * work that has not been scoped yet; the mechanism the recommendation asks for is "all five
   * adjacent, none inline", and that holds at one as it will at five.
   */
  private readonly mysteryMoves = this.customMoveSubResource('Mystery');

  /** Ids onto the drafts and the new baseline, from the same diff result (H2). */
  private writeBackMysteryCustomMoves(saved: CustomMoveResponse[]): void {
    this.mysteryCustomMoves.update((drafts) => rekeyDrafts(drafts, saved));
    this.existingMysteryCustomMoves.set(saved);
  }

  private readonly minionAttackService: SubResourceService<AttackDraft, UpsertMinionAttackRequest, MinionAttackResponse> = {
    create: (id, request) => this.minionService.createAttack(id, request),
    update: (id, attackId, request) => this.minionService.updateAttack(id, attackId, request),
    delete: (id, attackId) => this.minionService.deleteAttack(id, attackId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description), harm: draft.harm }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name ||
      draft.harm !== baseline.harm ||
      !sameNullableText(draft.description, baseline.description) ||
      !sameWeaponTags(draft.weaponTagIds, baseline.weaponTags),
    afterSave: (minionId, saved, draft, baseline) =>
      this.runBatch(
        weaponTagOperations(
          draft.weaponTagIds,
          baseline?.weaponTags ?? null,
          (tagId) => this.minionService.assignAttackWeaponTag(minionId, saved.id, tagId),
          (tagId) => this.minionService.removeAttackWeaponTag(minionId, saved.id, tagId),
        ),
      ).pipe(map(() => ({ ...saved, weaponTags: this.weaponTagRefs(draft.weaponTagIds) }))),
  };

  private readonly minionPowerService: SubResourceService<PowerDraft, UpsertMinionPowerRequest, MinionPowerResponse> = {
    create: (id, request) => this.minionService.createPower(id, request),
    update: (id, powerId, request) => this.minionService.updatePower(id, powerId, request),
    delete: (id, powerId) => this.minionService.deletePower(id, powerId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
  };

  private readonly minionWeaknessService: SubResourceService<
    WeaknessDraft,
    UpsertMinionWeaknessRequest,
    MinionWeaknessResponse
  > = {
    create: (id, request) => this.minionService.createWeakness(id, request),
    update: (id, weaknessId, request) => this.minionService.updateWeakness(id, weaknessId, request),
    delete: (id, weaknessId) => this.minionService.deleteWeakness(id, weaknessId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
  };

  private readonly minionArmorService: SubResourceService<ArmorDraft, UpsertMinionArmorRequest, MinionArmorResponse> = {
    create: (id, request) => this.minionService.createArmor(id, request),
    update: (id, armorId, request) => this.minionService.updateArmor(id, armorId, request),
    delete: (id, armorId) => this.minionService.deleteArmor(id, armorId),
    toRequest: (draft) => ({
      name: draft.name,
      description: this.toNullable(draft.description),
      harmSoak: draft.harmSoak,
      isSpecial: draft.isSpecial,
      specialDescription: this.toNullable(draft.specialDescription),
    }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name ||
      draft.harmSoak !== baseline.harmSoak ||
      draft.isSpecial !== baseline.isSpecial ||
      !sameNullableText(draft.description, baseline.description) ||
      !sameNullableText(draft.specialDescription, baseline.specialDescription),
  };

  /** The same four, for a monster. Identical shape, different service and request types. */
  private readonly monsterAttackService: SubResourceService<
    AttackDraft,
    UpsertMonsterAttackRequest,
    MonsterAttackResponse
  > = {
    create: (id, request) => this.monsterService.createAttack(id, request),
    update: (id, attackId, request) => this.monsterService.updateAttack(id, attackId, request),
    delete: (id, attackId) => this.monsterService.deleteAttack(id, attackId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description), harm: draft.harm }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name ||
      draft.harm !== baseline.harm ||
      !sameNullableText(draft.description, baseline.description) ||
      !sameWeaponTags(draft.weaponTagIds, baseline.weaponTags),
    afterSave: (monsterId, saved, draft, baseline) =>
      this.runBatch(
        weaponTagOperations(
          draft.weaponTagIds,
          baseline?.weaponTags ?? null,
          (tagId) => this.monsterService.assignAttackWeaponTag(monsterId, saved.id, tagId),
          (tagId) => this.monsterService.removeAttackWeaponTag(monsterId, saved.id, tagId),
        ),
      ).pipe(map(() => ({ ...saved, weaponTags: this.weaponTagRefs(draft.weaponTagIds) }))),
  };

  /**
   * The tag set the server holds for an attack once `afterSave`'s operations have landed — i.e. the
   * draft's own selection, resolved against the reference catalogue.
   *
   * This is the baseline half of `5a-U8`. `POST /attacks` answers before any tag is assigned, so
   * without this a newly tagged attack would be reported dirty on every later submit and the wizard
   * would re-PUT it and re-assign the same tag on every phase transition — the churn 5a exists to
   * remove, surviving inside the one collection that has a follow-up call.
   */
  private weaponTagRefs(weaponTagIds: readonly string[]): WeaponTagRefResponse[] {
    const catalogue = this.weaponTags();
    return weaponTagIds
      .map((id) => catalogue.find((tag) => tag.id === id))
      .filter((tag): tag is WeaponTagRefResponse => tag !== undefined);
  }

  private readonly monsterPowerService: SubResourceService<PowerDraft, UpsertMonsterPowerRequest, MonsterPowerResponse> =
    {
      create: (id, request) => this.monsterService.createPower(id, request),
      update: (id, powerId, request) => this.monsterService.updatePower(id, powerId, request),
      delete: (id, powerId) => this.monsterService.deletePower(id, powerId),
      toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
      isDirty: (draft, baseline) =>
        draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
    };

  private readonly monsterWeaknessService: SubResourceService<
    WeaknessDraft,
    UpsertMonsterWeaknessRequest,
    MonsterWeaknessResponse
  > = {
    create: (id, request) => this.monsterService.createWeakness(id, request),
    update: (id, weaknessId, request) => this.monsterService.updateWeakness(id, weaknessId, request),
    delete: (id, weaknessId) => this.monsterService.deleteWeakness(id, weaknessId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
  };

  private readonly monsterArmorService: SubResourceService<ArmorDraft, UpsertMonsterArmorRequest, MonsterArmorResponse> =
    {
      create: (id, request) => this.monsterService.createArmor(id, request),
      update: (id, armorId, request) => this.monsterService.updateArmor(id, armorId, request),
      delete: (id, armorId) => this.monsterService.deleteArmor(id, armorId),
      toRequest: (draft) => ({
        name: draft.name,
        description: this.toNullable(draft.description),
        harmSoak: draft.harmSoak,
        isSpecial: draft.isSpecial,
        specialDescription: this.toNullable(draft.specialDescription),
      }),
      isDirty: (draft, baseline) =>
        draft.name.trim() !== baseline.name ||
        draft.harmSoak !== baseline.harmSoak ||
        draft.isSpecial !== baseline.isSpecial ||
        !sameNullableText(draft.description, baseline.description) ||
        !sameNullableText(draft.specialDescription, baseline.specialDescription),
    };

  /**
   * One minion's four collections, diffed against that minion's own baseline (decision 8).
   *
   * Was a delete-all/recreate-all cycle. The returned collections are the new baseline, which the
   * caller stores back onto the draft — so a row nobody touched keeps the id it already had.
   */
  private saveMinionCollections(
    minionId: string,
    draft: MinionDraft,
  ): Observable<SavedMinionCollections> {
    return forkJoin({
      attacks: applySubResourceDiff(minionId, draft.attacks, draft.existingAttacks, this.minionAttackService),
      powers: applySubResourceDiff(minionId, draft.powers, draft.existingPowers, this.minionPowerService),
      weaknesses: applySubResourceDiff(
        minionId,
        draft.weaknesses,
        draft.existingWeaknesses,
        this.minionWeaknessService,
      ),
      armors: applySubResourceDiff(minionId, draft.armors, draft.existingArmors, this.minionArmorService),
    });
  }

  /** The monster's four collections, same diff, same contract. */
  /**
   * **One monster's four collections, diffed against *that monster's* own baseline** (`5b-R3`).
   *
   * Until 5b this read four store-level signals — the single-monster shape — so under a roster it
   * would have diffed every monster against whichever monster was last in the composer. It now has
   * the shape the minion path already had: state in, per owner.
   */
  private saveThreatCollections(monsterId: string, draft: MonsterDraft): Observable<SavedThreatCollections> {
    return forkJoin({
      attacks: applySubResourceDiff(monsterId, draft.attacks, draft.existingAttacks, this.monsterAttackService),
      powers: applySubResourceDiff(monsterId, draft.powers, draft.existingPowers, this.monsterPowerService),
      weaknesses: applySubResourceDiff(
        monsterId,
        draft.weaknesses,
        draft.existingWeaknesses,
        this.monsterWeaknessService,
      ),
      armors: applySubResourceDiff(monsterId, draft.armors, draft.existingArmors, this.monsterArmorService),
    });
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }

  private advancePhase(): void {
    this.isSubmitting.set(false);
    this.submitError.set(null);
    this.phaseComplete.update((phases) => phases.map((complete, index) => (index === this.currentPhase() ? true : complete)));
    this.currentPhase.update((phase) => phase + 1);
    this.currentStep.set(0);
  }

  private handleSubmitError(message: string): void {
    this.submitError.set(message);
    this.isSubmitting.set(false);
  }

  private addAttackDraft(target: WritableSignal<AttackDraft[]>, form: AttackFormGroup, prefix: string): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        id: null,
        localKey: createDraftKey(prefix),
        name: form.controls.name.value.trim(),
        harm: form.controls.harm.value,
        description: form.controls.description.value ?? '',
        weaponTagIds: [...(form.controls.weaponTagIds.value ?? [])],
      },
    ]);
    form.reset({ name: '', harm: 0, description: '', weaponTagIds: [] });
  }

  private addNamedDraft(
    target: WritableSignal<PowerDraft[] | WeaknessDraft[] | CustomMoveDraft[]>,
    form: NamedDraftFormGroup,
    prefix: string,
  ): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        id: null,
        localKey: createDraftKey(prefix),
        name: form.controls.name.value.trim(),
        description: form.controls.description.value ?? '',
      },
    ]);
    form.reset({ name: '', description: '' });
  }

  /**
   * Drops a sub-resource draft **by its stable key**, not by position (§5.4).
   *
   * Index-based removal was the shape Phase 3 removed one level up: it addresses a row by where it
   * happens to be, which is a different thing from which row it is. An unsaved row has no `id`, so
   * `localKey` is the only identity available for the whole set.
   */
  private removeDraft<T extends SubResourceIdentity>(target: WritableSignal<T[]>, localKey: string): void {
    target.update((items) => items.filter((item) => item.localKey !== localKey));
  }

  private addArmorDraft(target: WritableSignal<ArmorDraft[]>, form: ArmorFormGroup, prefix: string): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    target.update((items) => [
      ...items,
      {
        id: null,
        localKey: createDraftKey(prefix),
        name: form.controls.name.value.trim(),
        description: form.controls.description.value ?? '',
        harmSoak: form.controls.harmSoak.value,
        isSpecial: form.controls.isSpecial.value,
        specialDescription: form.controls.specialDescription.value ?? '',
      },
    ]);
    form.reset({ name: '', description: '', harmSoak: 0, isSpecial: false, specialDescription: '' });
  }

  private toNullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
