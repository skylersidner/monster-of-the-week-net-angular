import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MONSTER_DEFAULT_HARM_CAPACITY, MysteryCreateStore } from './mystery-create.store';

/**
 * **Phase 5b, QA pass — the places a baseline outlives the drafts it was built with.**
 *
 * Harness and doubles are `mystery-create-phase5b-roster.spec.ts`'s, deliberately unchanged, so the
 * results here are comparable with Luigi's line by line. Same two oracles as 5a and for the same
 * reason: every failure this phase exists to prevent is either *an extra or duplicated write that
 * produces the right end state* or *an id quietly rotating*, and neither is visible to a content
 * assertion. Calls are recorded at **subscribe** (`HttpClient` is cold, so a ledger written when the
 * service method is invoked over-counts a request that was built and dropped).
 *
 * §2 principle 5, as widened in rev 12: **a baseline and its draft share one lifecycle — created
 * together, destroyed together, written in one place.** `toHydratedMonster` makes that structural
 * for the four sub-resource collections and for `existingMinionIds`. Two places in 5b separated
 * them, both were reachable, and both are fixed:
 *
 * 1. **Destroyed apart (BUG 1, §7.7j).** `applyPendingRemovals` runs from all four submits;
 *    `writeBackMinionDrafts`, which rebuilds `MonsterDraft.existingMinionIds`, runs only from
 *    phase 1. `clearDrainedRemovals`' minions arm was what covered the gap, and moving the baseline
 *    onto `MonsterDraft` deleted it instead of relocating it. **Restored, walking the roster.**
 * 2. **Created apart (BUG 2, §6.6).** `loadEditData` wrote `existingMonsterIds` before the
 *    hydration it then fails on, so J6's all-or-nothing covered the drafts and not the baseline —
 *    and `idsToRemove` reads the pair. **The write moved into `applyHydratedMonsters`**, which is
 *    the single success-path writer of both halves.
 *
 * The rest of the file is the criteria that were covered at a weaker assertion than they state:
 * `5b-M4` under both dispositions, decision 19's surviving gate, and `5a-U1` on a second roster row.
 *
 * **The two blocks below began as characterisation tests and now assert the fixed behaviour.** Each
 * is still paired with a control that fails for a different reason, so neither can be read as a
 * broken harness — and each destructive assertion is an empty ledger rather than a display fact,
 * because a display assertion is what let the §7.7i case hide.
 */

const MONSTER_TYPE = { id: 'monster-type-1', name: 'Beast', motivation: '' };
const ARCHETYPE = { id: 'monster-archetype-1', name: 'Ghost', description: '' };

/** A catalogue row, which carries counts and no collections — which is why attach must fetch. */
const catalogueMonster = (id: string, name: string, mysteryIds: string[] = []) => ({
  id,
  mysteryIds,
  name,
  description: null,
  harmCapacity: 6,
  monsterType: MONSTER_TYPE,
  monsterArchetype: ARCHETYPE,
  attackCount: 3,
  powerCount: 1,
  armorCount: 0,
  weaknessCount: 0,
  minionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
});

const detailMonster = (id: string, name: string, mysteryIds: string[] = [], attackNames: string[] = []) => ({
  id,
  mysteryIds,
  name,
  description: null,
  harmCapacity: 6,
  monsterTypeId: MONSTER_TYPE.id,
  monsterTypeName: MONSTER_TYPE.name,
  monsterArchetype: ARCHETYPE,
  attacks: attackNames.map((attackName, index) => ({
    id: `${id}-attack-${index + 1}`,
    name: attackName,
    description: null,
    harm: 2,
    weaponTags: [],
  })),
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
});

const detailMinion = (id: string, name: string, monsterId: string) => ({
  id,
  monsterId,
  monsterName: 'owner',
  name,
  description: null,
  harmCapacity: 3,
  minionType: { id: 'minion-type-1', name: 'Cultist', motivation: '' },
  attacks: [{ id: `${id}-attack-1`, name: 'Bite', description: null, harm: 1, weaponTags: [] }],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
});

describe('Phase 5b — baselines that outlive their drafts', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let monsterService: Record<string, ReturnType<typeof vi.fn>>;
  let minionService: Record<string, ReturnType<typeof vi.fn>>;
  let locationService: Record<string, ReturnType<typeof vi.fn>>;

  /** Sorted, so batch order is not asserted — but multiplicity is, which is the point. */
  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());
  const callsMatching = (pattern: RegExp): string[] => sent.filter((call) => pattern.test(call)).sort();

  /** Catalogue and hydration fixtures, reassignable per test. */
  let catalogue: ReturnType<typeof catalogueMonster>[];
  let monsterDetails: Map<string, ReturnType<typeof detailMonster>>;
  let minionsByMonster: Map<string, { id: string }[]>;
  let minionDetails: Map<string, ReturnType<typeof detailMinion>>;
  let failingMonsterDetail: string | null;
  let failingMinionDetail: string | null;

  beforeEach(() => {
    sent = [];
    catalogue = [];
    monsterDetails = new Map();
    minionsByMonster = new Map();
    minionDetails = new Map();
    failingMonsterDetail = null;
    failingMinionDetail = null;

    const describeArg = (arg: unknown): string =>
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg);

    const record = <T>(name: string, result: (...args: never[]) => T) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          sent.push(`${name}(${args.map(describeArg).join(',')})`);
          return of(result(...(args as never[])));
        }),
      );

    /** Echoes the request into the response, so a row can be "unchanged" on the next pass (5a). */
    const echoCreate = (name: string, idPrefix: string) => {
      let next = 0;
      return record(name, (_ownerId: never, request: never) => ({
        id: `${idPrefix}-${++next}`,
        weaponTags: [],
        ...(request as object),
      }));
    };
    const echoUpdate = (name: string) =>
      record(name, (_ownerId: never, rowId: never, request: never) => ({
        id: rowId as unknown as string,
        weaponTags: [],
        ...(request as object),
      }));

    const subResourceDoubles = (prefix: string, idPrefix: string) => ({
      createAttack: echoCreate(`${prefix}.createAttack`, `${idPrefix}-attack`),
      updateAttack: echoUpdate(`${prefix}.updateAttack`),
      deleteAttack: record(`${prefix}.deleteAttack`, () => undefined),
      assignAttackWeaponTag: record(`${prefix}.assignTag`, () => ({})),
      removeAttackWeaponTag: record(`${prefix}.removeTag`, () => undefined),
      createPower: echoCreate(`${prefix}.createPower`, `${idPrefix}-power`),
      updatePower: echoUpdate(`${prefix}.updatePower`),
      deletePower: record(`${prefix}.deletePower`, () => undefined),
      createWeakness: echoCreate(`${prefix}.createWeakness`, `${idPrefix}-weakness`),
      updateWeakness: echoUpdate(`${prefix}.updateWeakness`),
      deleteWeakness: record(`${prefix}.deleteWeakness`, () => undefined),
      createArmor: echoCreate(`${prefix}.createArmor`, `${idPrefix}-armor`),
      updateArmor: echoUpdate(`${prefix}.updateArmor`),
      deleteArmor: record(`${prefix}.deleteArmor`, () => undefined),
    });

    let createdMonsters = 0;
    let createdMinions = 0;

    monsterService = {
      ...subResourceDoubles('monster', 'm'),
      create: record('monster.create', () => ({ id: `created-monster-${++createdMonsters}` })),
      update: record('monster.update', (monsterId: never) => ({ id: monsterId as unknown as string })),
      delete: record('monster.delete', () => undefined),
      linkToMystery: record('monster.link', () => undefined),
      unlinkFromMystery: record('monster.unlink', () => undefined),
      getAll: vi.fn(() => defer(() => of(catalogue))),
      getByMystery: vi.fn(() => defer(() => of(catalogue.filter((item) => item.mysteryIds.includes('mystery-1'))))),
      getById: vi.fn((monsterId: string) =>
        defer(() => {
          sent.push(`monster.getById(${monsterId})`);
          return failingMonsterDetail === monsterId
            ? throwError(() => new Error('boom'))
            : of(monsterDetails.get(monsterId));
        }),
      ),
    };
    minionService = {
      ...subResourceDoubles('minion', 'n'),
      create: record('minion.create', () => ({ id: `created-minion-${++createdMinions}` })),
      update: record('minion.update', (minionId: never) => ({ id: minionId as unknown as string })),
      delete: record('minion.delete', () => undefined),
      moveToMonster: record('minion.move', () => undefined),
      getByMonster: vi.fn((monsterId: string) =>
        defer(() => {
          sent.push(`minion.getByMonster(${monsterId})`);
          return of(minionsByMonster.get(monsterId) ?? []);
        }),
      ),
      getById: vi.fn((minionId: string) =>
        defer(() => {
          sent.push(`minion.getById(${minionId})`);
          return failingMinionDetail === minionId
            ? throwError(() => new Error('boom'))
            : of(minionDetails.get(minionId));
        }),
      ),
    };
    locationService = {
      getAll: vi.fn(() => of([])),
      getByMystery: vi.fn(() => of([])),
      create: record('location.create', () => ({ id: 'location-1' })),
      update: record('location.update', () => ({ id: 'location-1' })),
      linkToMystery: record('location.link', () => undefined),
      unlinkFromMystery: record('location.unlink', () => undefined),
      delete: record('location.delete', () => undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: MysteryService,
          useValue: {
            create: vi.fn(() => of({ id: 'mystery-1' })),
            update: vi.fn(() => of({ id: 'mystery-1' })),
            upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
            getMystery: vi.fn(() =>
              of({
                id: 'mystery-1',
                name: 'The Hollow Choir',
                concept: null,
                hook: null,
                overview: null,
                countdown: null,
                adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
                customMoves: [],
              }),
            ),
            getMysteries: vi.fn(() =>
              of([
                { id: 'mystery-1', name: 'The Hollow Choir' },
                { id: 'mystery-9', name: 'Dust Bowl Nights' },
              ]),
            ),
          },
        },
        { provide: MonsterService, useValue: monsterService },
        { provide: MinionService, useValue: minionService },
        { provide: LocationService, useValue: locationService },
        { provide: BystanderService, useValue: { getAll: vi.fn(() => of([])), getByMystery: vi.fn(() => of([])) } },
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([ARCHETYPE]),
            getMonsterTypes: () => of([MONSTER_TYPE]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([]),
          },
        },
      ],
    });
  });

  // -------------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------------

  function startCreateMode(): void {
    store = TestBed.inject(MysteryCreateStore);
    store.init();
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
  }

  function startEditMode(): void {
    store = TestBed.inject(MysteryCreateStore);
    store.init('mystery-1');
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
  }

  /** Fills the composer and commits it into the roster, as `Next` off step 0 does. */
  function authorMonster(name: string): void {
    store.currentStep.set(0);
    store.monsterForm.setValue({
      name,
      description: '',
      harmCapacity: 6,
      monsterTypeId: MONSTER_TYPE.id,
      monsterArchetypeId: ARCHETYPE.id,
    });
    store.saveMonsterDraftToList();
  }

  function authorMinion(name: string, monsterKey: string): void {
    store.currentStep.set(1);
    store.minionForm.patchValue({
      monsterKey,
      name,
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.saveMinionDraftToList();
  }

  /** Walks both steps of phase 1 and returns to it, as Next → Back would. */
  function submitPhaseOne(): void {
    store.currentPhase.set(1);
    store.currentStep.set(0);
    store.next();
    store.next();
    store.currentPhase.set(1);
    store.currentStep.set(0);
  }

  const keyOf = (name: string): string =>
    store.monsterDrafts().find((draft) => draft.name === name)?.localKey ?? `no monster named ${name}`;

  /** Submits phase 1 **without** putting the wizard back on it, so the advance is observable. */
  function submitPhaseOneAndStay(): void {
    store.currentPhase.set(1);
    store.currentStep.set(0);
    store.next();
    store.next();
  }

  /** Edit mode: one shared monster, two persisted minions under it. */
  function loadSharedMonsterWithMinions(): void {
    catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9'])];
    monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9'], ['Grasp']));
    minionsByMonster.set('mo-9', [{ id: 'mi-1' }, { id: 'mi-2' }]);
    minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
    minionDetails.set('mi-2', detailMinion('mi-2', 'Pale Choir', 'mo-9'));
    startEditMode();
    sent.length = 0;
  }

  // -------------------------------------------------------------------------------------------
  // **BUG 1 (fixed, rev 12) — the minion baseline after a drain from a phase other than 1.**
  //
  // J1's proof is a *deletion*: `clearDrainedRemovals` had a minions arm in 5a and has none in 5b.
  // The claim justifying the deletion, recorded at `mystery-create.store.ts:2846`, is that "the only
  // way a minion's disposition drains is if its monster is still on the roster — in which case the
  // id is dropped from that draft's `existingMinionIds` by the submit's writeback."
  //
  // The first clause is true: `stillTheRostersBusiness('minions', …)` requires a roster monster
  // whose baseline holds the id. **The second is not.** The drain is wizard-scoped (decision 15), so
  // `applyPendingRemovals` runs from all four `submitPhaseN`s — but `writeBackMinionDrafts` runs
  // only from phase 1. Drain a minion disposition from phase 0, 2 or 3 and the id is still in its
  // monster's `existingMinionIds` with its disposition now cleared, which is exactly *baseline −
  // drafts − disposed* leaving it in `removedIds`: a blind second `DELETE` on the diff path, the one
  // with no 404 handler. It is J1's own composition failure, re-entered through the one door the fix
  // left open.
  //
  // **These were characterisation tests and are now assertions** (§7.7j). The fix is the minions arm
  // restored in `clearDrainedRemovals`, walking the roster — bookkeeping after a successful drain,
  // which is that function's documented consumer 2, and deliberately not `stillTheRostersBusiness`.
  // -------------------------------------------------------------------------------------------

  describe('BUG 1, fixed: the minion baseline after a drain from another phase', () => {
    it('drains from phase 2, then deletes the same minion a second time from phase 1', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      expect(store.pendingRemovals()).toEqual([{ collection: 'minions', id: 'mi-1', action: 'delete' }]);

      // G1's own sequence, which decision 15 exists to serve: trash a minion, click a later tracker
      // bubble, finish from there. `5a-M1`'s G1 test stops here; the user does not.
      store.jumpToPhase(2);
      expect(store.currentPhase()).toBe(2);
      store.next();
      expect(callsMatching(/^minion\.delete/)).toEqual(['minion.delete(mi-1)']);
      expect(store.pendingRemovals()).toEqual([]);

      sent.length = 0;
      submitPhaseOneAndStay();

      // The drain already destroyed mi-1 and its disposition is gone, so a second copy would have
      // nothing left to protect it — `removalRequest`'s 404 → success mapping is drain-only and
      // deliberately so, and this one would come from `saveMinionDrafts`'s `idsToRemove`.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
    });

    it('and the second delete is a 404 that fails the whole phase', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      store.jumpToPhase(2);
      store.next();

      // From here on the row is gone on the server, which is what the drain just did. Only now is
      // the double-delete's real cost visible: the ledger assertion above looks survivable, and the
      // 404 arrives after the call is recorded.
      minionService['delete'] = vi.fn((minionId: string) =>
        defer(() => {
          sent.push(`minion.delete(${minionId})`);
          return throwError(() => new HttpErrorResponse({ status: 404 }));
        }),
      );

      sent.length = 0;
      submitPhaseOneAndStay();

      // The user deleted a minion, finished the mystery from a later phase, came back to Monsters,
      // and can leave it again. No second delete is issued, so the 404 rigged above is never
      // provoked — which is the whole point: the destructive assertion is the empty ledger, and the
      // phase-state pair is what makes the *user-visible* cost of getting it wrong legible.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
      expect(store.submitError()).toBeNull();
      expect(store.currentPhase()).toBe(2);
    });

    it('because the monster it belonged to still claims it in its baseline', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      store.jumpToPhase(2);
      store.next();

      // The state assertion behind the ledger one, so a fix is checkable at its source rather than
      // only through its effect. `clearDrainedRemovals`'s consumer 2 is "drop the id from the owning
      // collection's baseline"; for a minion that owner is a `MonsterDraft`, and nothing does it.
      //
      expect(store.monsterDrafts()[0].existingMinionIds).toEqual(['mi-2']);
      expect(store.persistedForRemoval('minions', 'mi-1')).toBe(false);
    });

    it('and the same from phase 0, which drains too (decision 15)', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      store.jumpToPhase(0);
      // Five `next()`, one per step in the Mystery phase — the fifth is the custom-move step added
      // in 5f-1. Walking the phase rather than jumping to its last step is the form the renumber
      // commit could not cover: an extra `next()` is not a no-op under the old step count.
      store.next();
      store.next();
      store.next();
      store.next();
      store.next();
      expect(callsMatching(/^minion\.delete/)).toEqual(['minion.delete(mi-1)']);

      sent.length = 0;
      submitPhaseOneAndStay();

      // Stated separately from the phase-2 case because the fix is at the drain's own bookkeeping
      // and not at one phase's submit — three of the four phases reach here.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
    });

    it('control: drained from phase 1 itself, the writeback does clear it and nothing repeats', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      submitPhaseOneAndStay();
      expect(callsMatching(/^minion\.delete/)).toEqual(['minion.delete(mi-1)']);

      sent.length = 0;
      submitPhaseOneAndStay();

      // The instance J1's note reasons from, and it holds. It is the *claim* that is too wide, so
      // this control is what stops the three above from reading as a broken harness.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
      expect(store.monsterDrafts()[0].existingMinionIds).toEqual(['mi-2']);
    });
  });

  // -------------------------------------------------------------------------------------------
  // **BUG 2 (fixed, rev 12) — a failed edit-mode hydration left the monster baseline behind.**
  //
  // The third way into a roster whose diff reads "nothing" as the user's intent, and neither the
  // plan nor the implementation names it. §6.6/J6 makes edit-mode hydration all-or-nothing and
  // `5b-R7` asserts the *drafts* half of it. But `loadEditData` sets `existingMonsterIds` inside the
  // same `switchMap`, **before** the hydration it then fails on (`mystery-create.store.ts:1216`,
  // ahead of the `forkJoin` at `:1229`). The failure therefore leaves the baseline fully populated
  // against an empty roster.
  //
  // That is not a partial roster, it is the *total* version of one, and `idsToRemove` cannot tell
  // the difference: `baseline − drafts − disposed` is every monster in the mystery. This is the one
  // shape §6.6 calls non-negotiable — "a roster that is missing a monster is a roster whose diff
  // will treat *nothing* as the user's intent" — reached without any half-hydrated card existing.
  // -------------------------------------------------------------------------------------------

  describe('BUG 2, fixed: a failed edit-mode hydration', () => {
    function loadWithOneFailure(): void {
      catalogue = [
        catalogueMonster('mo-1', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-2', 'Beta', ['mystery-1']),
        catalogueMonster('mo-3', 'Gamma', ['mystery-1']),
      ];
      monsterDetails.set('mo-1', detailMonster('mo-1', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-3', detailMonster('mo-3', 'Gamma', ['mystery-1']));
      failingMonsterDetail = 'mo-2';
      startEditMode();
      sent.length = 0;
    }

    it('keeps the monster baseline though it dropped every draft', () => {
      loadWithOneFailure();

      // `5b-R7` asserts this line and stops.
      expect(store.monsterDrafts()).toEqual([]);

      // A draft and its baseline row are created together or not at all (§5.2, principle 5). The
      // write moved out of `loadEditData` and into `applyHydratedMonsters`, which is the single
      // success-path writer of both, so J6's atomicity now covers the whole state rather than half.
      expect(store.persistedForRemoval('monsters', 'mo-1')).toBe(false);
      expect(store.persistedForRemoval('monsters', 'mo-2')).toBe(false);
      expect(store.persistedForRemoval('monsters', 'mo-3')).toBe(false);
    });

    it('so the next phase-1 submit unlinks every monster from the mystery', () => {
      loadWithOneFailure();

      // Nothing bars this. `isPhaseAccessible` is unconditionally true in edit mode, the wizard is
      // still mounted and mostly populated — the concept form, the locations and the bystanders all
      // loaded — so "the load failed" is not what the screen looks like. The monster roster reads
      // as empty, which since decision 19 is a perfectly legitimate state.
      store.jumpToPhase(1);
      submitPhaseOneAndStay();

      // Three unlinks here would be the diff acting on an intention the user never expressed: the
      // mystery would lose every monster it had, silently, with the phase reporting success.
      // `unlinkFromMystery` is not on the drain, so there would be no disposition to inspect
      // afterwards and nothing in the UI that named a monster to begin with.
      //
      // The assertion is `/^monster\./` rather than `/^monster\.unlink/` on purpose: with the
      // baseline no longer populated there is also nothing to update or link, so the whole monster
      // surface must be silent. A narrower pattern would pass if the diff merely changed its mind
      // about *which* destructive call to make.
      expect(callsMatching(/^monster\./)).toEqual([]);
    });

    it('control: when every hydration succeeds the same submit unlinks nothing', () => {
      catalogue = [catalogueMonster('mo-1', 'Alpha', ['mystery-1']), catalogueMonster('mo-3', 'Gamma', ['mystery-1'])];
      monsterDetails.set('mo-1', detailMonster('mo-1', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-3', detailMonster('mo-3', 'Gamma', ['mystery-1']));
      startEditMode();
      sent.length = 0;

      store.jumpToPhase(1);
      submitPhaseOneAndStay();

      expect(callsMatching(/^monster\.unlink/)).toEqual([]);
      expect(callsMatching(/^monster\.update/)).toHaveLength(2);
    });

    /**
     * **The window itself, on the success path — which is what rules out the error-handler fix.**
     *
     * Clearing `existingMonsterIds` in `loadEditData`'s error handler passes every other assertion
     * in this block, because nothing reads the baseline between the write and the subscribe *today*.
     * Yoshi's ruling turns that down anyway: "nothing reads it today" is exactly the reasoning that
     * produced BUG 1, and moving the write removes the interval where clearing on error only
     * shortens it.
     *
     * A negative control confirmed the point: re-instating the early write *plus* an error-handler
     * clear was NOT caught by anything here. So the invariant needs an oracle of its own, and the
     * only honest one is a consumer standing inside the gap. This probe reads
     * `persistedForRemoval` from within the second monster's `getById` — a moment that exists on
     * the success path, with one draft's fetch resolved and none of them applied.
     *
     * The assertion is "at no point during the load is the baseline non-empty while the roster is",
     * which is principle 5's *written in one place* stated as something observable.
     */
    it('the baseline is never populated while the roster is empty, even mid-load', () => {
      catalogue = [catalogueMonster('mo-1', 'Alpha', ['mystery-1']), catalogueMonster('mo-3', 'Gamma', ['mystery-1'])];
      monsterDetails.set('mo-1', detailMonster('mo-1', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-3', detailMonster('mo-3', 'Gamma', ['mystery-1']));

      const observed: { baseline: boolean; roster: number }[] = [];
      const realGetById = monsterService['getById'] as unknown as (id: string) => Observable<unknown>;
      monsterService['getById'] = vi.fn((monsterId: string) =>
        defer(() => {
          // Sampled at subscribe, inside the hydration fan-out, before anything is applied.
          observed.push({
            baseline:
              store.persistedForRemoval('monsters', 'mo-1') || store.persistedForRemoval('monsters', 'mo-3'),
            roster: store.monsterDrafts().length,
          });
          return realGetById(monsterId);
        }),
      );

      startEditMode();

      expect(observed.length).toBeGreaterThan(0);
      for (const sample of observed) {
        expect(sample).toEqual({ baseline: false, roster: 0 });
      }
      // …and both halves land together at the end.
      expect(store.monsterDrafts()).toHaveLength(2);
      expect(store.persistedForRemoval('monsters', 'mo-1')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------------------------
  // The J-cluster, at the assertions the criteria state rather than the ones a fix happens to make.
  // -------------------------------------------------------------------------------------------

  describe('5b-M4, at full strength', () => {
    it('under DETACH the persisted minions are not written at all — not moved, not re-keyed', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'detach');
      submitPhaseOneAndStay();

      // Rosalina's assertion is that detach leaves the minions *existing and belonging to that
      // monster*. "No delete" is only the first third of that: `moveToMonster` **moves**, so a
      // stray re-parent would leave them existing and belonging to something else, and a
      // delete-and-recreate of their sub-resources would leave them existing with rotated ids.
      // A whole-namespace ledger is one expression for all three.
      expect(callsMatching(/^minion\./)).toEqual([]);
      expect(callsMatching(/^monster\./)).toEqual(['monster.unlink(mystery-1,mo-9)']);
    });

    it('§7.7i third case: the revert’s *destructive* half, asserted past the display one', () => {
      catalogue = [catalogueMonster('mo-a', 'Alpha', ['mystery-1']), catalogueMonster('mo-b', 'Beta', ['mystery-1'])];
      monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1']));
      minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
      startEditMode();
      const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;

      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(beta.localKey);
      store.saveMinionDraftToList();
      store.removeMonsterDraft(beta.localKey, 'delete');

      sent.length = 0;
      submitPhaseOneAndStay();

      // The J4 test states both halves, but its synchronous `monsterKey` assertion comes first, so
      // a mutant that drops the third case short-circuits there and this half is never reached. It
      // is the half that destroys data: without the revert, mi-1 leaves the roster with Beta while
      // staying in **Alpha's** `existingMinionIds` — *baseline − drafts − disposed* then deletes it
      // from the one monster that is still here. Asserted from a clean ledger so it stands alone.
      expect(callsMatching(/^minion\./)).toEqual([`minion.update(mi-1,${minionRequest('Grave-Wight')})`]);
    });

    it('under DELETE the phase actually completes — no stray 404, and the wizard moved on', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');
      submitPhaseOneAndStay();

      expect(callsMatching(/delete/)).toEqual(['monster.delete(mo-9)']);
      // The half a ledger cannot see. `5b-M4` says "the phase completes without a stray 404", and a
      // failed submit leaves the ledger identical — the 404 arrives *after* the calls are recorded.
      // Every helper in this file that returns the wizard to phase 1 erases this evidence.
      expect(store.submitError()).toBeNull();
      expect(store.isSubmitting()).toBe(false);
      expect(store.currentPhase()).toBe(2);
      expect(store.phaseComplete()[1]).toBe(true);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Decision 19: the deleted `validateCurrentStep` branch, checked rather than trusted.
  //
  // The branch went because `next()` calls `commitMonsterComposerIfValid()` immediately after and
  // refuses the same case with the same message. That is only safe if **every** path that advances
  // out of phase 1 step 0 goes through that call. `submitCurrentPhase()` has exactly one caller and
  // `next()` gates it; these pin the behaviour so a future second caller fails here.
  // -------------------------------------------------------------------------------------------

  describe('the surviving composer rule is the only gate, and it holds', () => {
    beforeEach(() => {
      startCreateMode();
      // A started-but-invalid composer: a name and nothing else, which is `5b-O4`'s exact case.
      store.monsterForm.patchValue({ name: 'Half-typed' });
    });

    it('blocks the step advance, so the submit is never reached', () => {
      store.next();

      expect(store.currentStep()).toBe(0);
      expect(store.submitError()).toBe("Finish or clear the monster you're editing before continuing.");
      expect(sent).toEqual([]);
    });

    it('blocks again on a second press rather than letting the second one through', () => {
      store.next();
      store.next();

      // The shape worth excluding: a gate that sets an error and then clears it, so the user's
      // reflexive second click advances. `5b-O4` presses once.
      expect(store.currentStep()).toBe(0);
      expect(sent).toEqual([]);
    });

    it('marks the three required controls touched AND invalid — §16.6’s other half', () => {
      // A composer started on the *description* instead, so all three required fields are empty at
      // once. `monsterComposerDirty` counts description, so this still blocks.
      store.monsterForm.patchValue({ name: '', description: 'A conductor of drowned voices.' });

      store.next();
      expect(store.currentStep()).toBe(0);

      // **The half of `5b-O4`'s pair that nothing else reaches.** Since decision 19 removed
      // `validateCurrentStep`'s branch, `monsterForm.invalid` is read nowhere in the store — the
      // gate is entirely `monsterComposerValid()`, a separate expression over the same three
      // fields. So stripping `Validators.required` off `name`, `monsterTypeId` and
      // `monsterArchetypeId` leaves every behavioural test passing and silently removes the inline
      // "Name is required" / "Archetype is required" errors, which are the only thing telling the
      // user *which* field the band is about. Measured: that mutant survives all 1184 tests.
      //
      // `touched` is what `markAllAsTouched()` does and `invalid` is what the validators do; the
      // template needs both, so both are asserted here.
      for (const control of [
        store.monsterForm.controls.name,
        store.monsterForm.controls.monsterTypeId,
        store.monsterForm.controls.monsterArchetypeId,
      ]) {
        expect(control.touched).toBe(true);
        expect(control.invalid).toBe(true);
      }
    });

    it('and the two other callers of the same rule refuse too', () => {
      expect(store.startNewMonsterDraft()).toBe(false);
      expect(store.editMonsterDraft('anything')).toBe(false);
      expect(store.monsterDrafts()).toEqual([]);
    });

    it('while a composer holding nothing at all advances, which is the pair 5b-O4 needs', () => {
      // `monsterComposerDirty` is value-based rather than `form.dirty`, and one of its disjuncts is
      // `harmCapacity !== MONSTER_DEFAULT_HARM_CAPACITY`. Resetting to any other number leaves the
      // composer empty and dirty at once, so the reset has to use the store's own default.
      store.monsterForm.reset({
        name: '',
        description: '',
        harmCapacity: MONSTER_DEFAULT_HARM_CAPACITY,
        monsterTypeId: '',
        monsterArchetypeId: '',
      });

      store.next();

      expect(store.currentStep()).toBe(1);
      expect(store.submitError()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------------------------
  // `5a-U1…U9` per roster row, on the second row as well as the first.
  // -------------------------------------------------------------------------------------------

  describe('5a-U1 per row, with two monsters on the roster', () => {
    function loadTwoHydratedMonsters(): void {
      catalogue = [
        catalogueMonster('mo-a', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-b', 'Beta', ['mystery-1']),
      ];
      monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1'], ['Claw', 'Bite']));
      monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1'], ['Gore']));
      minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
      minionsByMonster.set('mo-b', [{ id: 'mi-2' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
      minionDetails.set('mi-2', detailMinion('mi-2', 'Pale Choir', 'mo-b'));
      startEditMode();
      sent.length = 0;
    }

    const attackIds = (index: number) => store.monsterDrafts()[index].attacks.map((attack) => attack.id);
    const minionAttackIds = (index: number) => store.minionDrafts()[index].attacks.map((attack) => attack.id);

    it('a no-op submit rotates no id on either monster, or on either monster’s minion', () => {
      loadTwoHydratedMonsters();

      submitPhaseOneAndStay();

      expect(attackIds(0)).toEqual(['mo-a-attack-1', 'mo-a-attack-2']);
      expect(attackIds(1)).toEqual(['mo-b-attack-1']);
      expect(minionAttackIds(0)).toEqual(['mi-1-attack-1']);
      expect(minionAttackIds(1)).toEqual(['mi-2-attack-1']);
    });

    it('and writes nothing below either monster — the positive half being the updates and links', () => {
      loadTwoHydratedMonsters();

      submitPhaseOneAndStay();

      // Absence assertions alone pass when the submit silently refused, so the whole ledger is the
      // expression: the four updates and two links are *required* to be present.
      expectLedger([
        `monster.update(mo-a,${monsterRequest('Alpha')})`,
        `monster.update(mo-b,${monsterRequest('Beta')})`,
        'monster.link(mystery-1,mo-a)',
        'monster.link(mystery-1,mo-b)',
        `minion.update(mi-1,${minionRequest('Grave-Wight')})`,
        `minion.update(mi-2,${minionRequest('Pale Choir')})`,
      ]);
    });

    it('editing the second monster’s attack writes that attack and nothing on the first', () => {
      loadTwoHydratedMonsters();

      store.editMonsterDraft(store.monsterDrafts()[1].localKey);
      store.monsterAttacks.update((attacks) => attacks.map((attack) => ({ ...attack, name: 'Gore, harder' })));
      store.saveMonsterDraftToList();

      sent.length = 0;
      submitPhaseOneAndStay();

      expect(callsMatching(/Attack/)).toEqual([
        `monster.updateAttack(mo-b,mo-b-attack-1,${JSON.stringify({ name: 'Gore, harder', description: null, harm: 2 })})`,
      ]);
      expect(attackIds(0)).toEqual(['mo-a-attack-1', 'mo-a-attack-2']);
    });
  });

  // The payloads the store actually builds, spelled out rather than probed.
  function monsterRequest(name: string): string {
    return JSON.stringify({
      name,
      description: null,
      harmCapacity: 6,
      monsterTypeId: MONSTER_TYPE.id,
      monsterArchetypeId: ARCHETYPE.id,
    });
  }

  function minionRequest(name: string): string {
    return JSON.stringify({ name, description: null, harmCapacity: 3, minionTypeId: 'minion-type-1' });
  }
});
