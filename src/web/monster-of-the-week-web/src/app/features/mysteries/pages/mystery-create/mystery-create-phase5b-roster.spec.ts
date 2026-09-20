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
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **Phase 5b — the monster roster, decision 19, attach, and the J-cluster.**
 *
 * Same two oracles as 5a and for the same reason: every failure this phase exists to prevent is
 * either *an extra or duplicated write that produces the right end state* or *an id quietly
 * rotating*, and neither is visible to a content assertion. So the file asserts the complete sorted
 * multiset of calls, recorded at **subscribe** (`HttpClient` is cold, so a ledger written when the
 * service method is invoked over-counts a request that was built and dropped).
 *
 * The J-cluster gets the sharpest tests in here, because J1 is the only path in the design that
 * destroys data the user explicitly asked to keep:
 *
 * > Remove a monster that has persisted minions. Its drafts leave with it (§7.7d), its children's
 * > dispositions are dropped (§7.7f), and `idsToRemove` computes *baseline − drafts − disposed* —
 * > so before 5b those minions fell through to a blind `delete()` on the **diff** path, which has
 * > no 404 handler. Under detach that destroys them everywhere, which is the exact opposite of what
 * > the modal promises.
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

describe('Phase 5b — the monster roster', () => {
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

  // -------------------------------------------------------------------------------------------
  // §3 — Decision 19: a monster is no longer required
  // -------------------------------------------------------------------------------------------

  describe('decision 19 — a monster is optional', () => {
    beforeEach(() => startCreateMode());

    it('5b-O1/5b-O2: an untouched monster phase advances and creates no monster row', () => {
      store.next();
      store.next();

      // **Assert the absence of the row, not the appearance of the page** — a synthesised empty
      // monster is invisible on the detail page, which is why `5b-O1` is phrased this way. Before
      // 5b, `submitPhase1` called `create(mysteryId, monsterRequest)` unconditionally.
      expect(callsMatching(/^monster\./)).toEqual([]);
      expect(store.monsterDrafts()).toEqual([]);
      expect(store.currentPhase()).toBe(2);
    });

    it('5b-O2: an empty roster still drains and still runs the roster diff', () => {
      // An edit-mode revisit reaches an empty roster by *removing* the last monster, so "no
      // monster" must not mean "no submit".
      store['existingMonsterIds'].set(['monster-gone']);
      store.pendingRemovals.set([{ collection: 'monsters', id: 'monster-doomed', action: 'delete' }]);

      store.next();
      store.next();

      expect(callsMatching(/^monster\./)).toEqual([
        'monster.delete(monster-doomed)',
        'monster.unlink(mystery-1,monster-gone)',
      ]);
    });

    it('5b-O4: the field validators survive — a half-typed composer still blocks', () => {
      // The pair Rosalina §16.6 insists on. Stripping the validators *also* produces a wizard that
      // advances, so "Next advances on an empty roster" passes in the broken world too. This is the
      // other half: a started-but-invalid composer is refused and says so.
      store.monsterForm.controls.name.setValue('Half a monster');

      store.next();

      expect(store.currentStep()).toBe(0);
      expect(store.submitError()).toBe("Finish or clear the monster you're editing before continuing.");
      expect(store.monsterForm.controls.monsterTypeId.touched).toBe(true);
    });

    it('5b-O4: and a *valid* open composer is committed silently rather than blocking', () => {
      store.monsterForm.setValue({
        name: 'Maestro Vey',
        description: '',
        harmCapacity: 6,
        monsterTypeId: MONSTER_TYPE.id,
        monsterArchetypeId: ARCHETYPE.id,
      });

      store.next();

      expect(store.currentStep()).toBe(1);
      expect(store.monsterDrafts().map((draft) => draft.name)).toEqual(['Maestro Vey']);
    });

    it('5b-O6: the step-0 dot means "has content", read from the roster and never the composer', () => {
      // The retired predicate read the live form, so it lit on the first keystroke and went dark
      // again on Next — the flicker the sibling minion dot's comment already warned about.
      store.monsterForm.controls.name.setValue('Maestro Vey');
      expect(store.phaseStepComplete()[1][0]).toBe(false);

      authorMonster('Maestro Vey');
      expect(store.phaseStepComplete()[1][0]).toBe(true);
    });

    it('5b-O7: with no monsters the minion step is reachable, empty and not blocking', () => {
      store.currentStep.set(1);

      expect(store.minionComposerValid()).toBe(false);
      expect(store.next.bind(store)).not.toThrow();
      expect(store.currentPhase()).toBe(2);
    });

    it('5b-O8: the nudge appears once, in the blurb, and nowhere else', () => {
      store.currentStep.set(0);
      const blurb = store.stepBlurb();

      expect(blurb).toContain('or none, if the threat');
      expect(blurb).toContain('brings its minions with it');
      // No band, no asterisk, no confirmation — decision 4. The submit error stays null.
      expect(store.submitError()).toBeNull();
    });
  });

  describe('5b-O5: edit mode reports every phase finished, whatever the mystery contains', () => {
    it('does not recompute completeness from data presence', () => {
      startEditMode();

      // The mystery has no monsters, no locations and no bystanders. Before 5b the load overwrote
      // `init()`'s [true, true, true, true] with data presence, so all three read as unfinished —
      // which under decision 19 is simply wrong, and was always questionable for the other two.
      expect(store.phaseComplete()).toEqual([true, true, true, true]);
    });
  });

  // -------------------------------------------------------------------------------------------
  // §4 — The roster
  // -------------------------------------------------------------------------------------------

  describe('the roster', () => {
    beforeEach(() => startCreateMode());

    it('5b-R1: two authored monsters both save, each with its own membership', () => {
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');

      submitPhaseOne();

      expect(callsMatching(/^monster\.(create|link)/)).toEqual([
        'monster.create(mystery-1,' + monsterRequest('Maestro Vey') + ')',
        'monster.create(mystery-1,' + monsterRequest('The Hollow Man') + ')',
      ]);
      expect(store.monsterDrafts().map((draft) => draft.id)).toEqual(['created-monster-1', 'created-monster-2']);
    });

    it('5b-R3: editing one monster writes that monster only — nothing for its sibling', () => {
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');
      submitPhaseOne();

      store.editMonsterDraft(keyOf('The Hollow Man'));
      store.monsterAttackForm.setValue({ name: 'Grasp', harm: 2, description: '', weaponTagIds: [] });
      store.addMonsterAttack();

      sent.length = 0;
      submitPhaseOne();

      // Per row, against that row's own baseline. Before 5b the monster sub-resource diff read four
      // store-level signals, so it would have diffed both monsters against the composer's contents.
      expect(callsMatching(/Attack|Power|Weakness|Armor/)).toEqual([
        'monster.createAttack(created-monster-2,' + JSON.stringify({ name: 'Grasp', description: null, harm: 2 }) + ')',
      ]);
    });

    it('5a-U1 per row: a second submit rotates no ids on either monster', () => {
      authorMonster('Maestro Vey');
      store.editMonsterDraft(keyOf('Maestro Vey'));
      store.monsterAttackForm.setValue({ name: 'Baton', harm: 2, description: '', weaponTagIds: [] });
      store.addMonsterAttack();
      store.saveMonsterDraftToList();
      authorMonster('The Hollow Man');
      submitPhaseOne();

      const before = store.monsterDrafts().map((draft) => ({ id: draft.id, attacks: draft.attacks.map((a) => a.id) }));
      expect(before[0].attacks).toEqual(['m-attack-1']);

      sent.length = 0;
      submitPhaseOne();

      expect(store.monsterDrafts().map((draft) => ({ id: draft.id, attacks: draft.attacks.map((a) => a.id) }))).toEqual(
        before,
      );
      expect(callsMatching(/Attack|Power|Weakness|Armor/)).toEqual([]);
    });

    it('5b-R5: a minion authored against the *second* monster lands on it, before any id exists', () => {
      authorMonster('Maestro Vey');
      authorMonster('The Hollow Man');
      authorMinion('Choir Thrall', keyOf('The Hollow Man'));

      // Both monsters are unsaved at this point, so the draft can only carry a `localKey`. This is
      // what the `localKey → monsterId` resolution exists for and it cannot be tested with
      // hydrated monsters.
      expect(store.minionDrafts()[0].monsterKey).toBe(keyOf('The Hollow Man'));

      submitPhaseOne();

      expect(callsMatching(/^minion\.create/)).toEqual([
        'minion.create(created-monster-2,' + minionRequest('Choir Thrall') + ')',
      ]);
    });

    it('5b-R6: cancelling the composer leaves the roster alone and the next submit silent', () => {
      authorMonster('Maestro Vey');
      submitPhaseOne();

      store.editMonsterDraft(keyOf('Maestro Vey'));
      store.monsterForm.controls.name.setValue('Something else entirely');
      store.monsterAttackForm.setValue({ name: 'Discarded', harm: 9, description: '', weaponTagIds: [] });
      store.addMonsterAttack();
      store.cancelMonsterComposerEdit();

      expect(store.monsterDrafts()[0].name).toBe('Maestro Vey');
      expect(store.monsterDrafts()[0].attacks).toEqual([]);

      sent.length = 0;
      submitPhaseOne();

      expect(callsMatching(/Attack|Power|Weakness|Armor/)).toEqual([]);
    });
  });

  describe('5b-R2/5b-R7: edit-mode load', () => {
    it('5b-R2: hydrates every monster, not just the first', () => {
      catalogue = [catalogueMonster('mo-1', 'Alpha', ['mystery-1']), catalogueMonster('mo-2', 'Beta', ['mystery-1'])];
      monsterDetails.set('mo-1', detailMonster('mo-1', 'Alpha', ['mystery-1'], ['Claw']));
      monsterDetails.set('mo-2', detailMonster('mo-2', 'Beta', ['mystery-1'], ['Bite', 'Gore']));

      startEditMode();

      // The loss this fixes is silent, so the fixture is built outside the wizard: a mystery created
      // through the wizard could never have had a second monster to lose.
      expect(store.monsterDrafts().map((draft) => draft.name)).toEqual(['Alpha', 'Beta']);
      expect(store.monsterDrafts()[1].attacks.map((attack) => attack.name)).toEqual(['Bite', 'Gore']);
    });

    it('5b-R7: one failed hydration fails the whole load — no partial roster', () => {
      catalogue = [
        catalogueMonster('mo-1', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-2', 'Beta', ['mystery-1']),
        catalogueMonster('mo-3', 'Gamma', ['mystery-1']),
      ];
      monsterDetails.set('mo-1', detailMonster('mo-1', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-3', detailMonster('mo-3', 'Gamma', ['mystery-1']));
      failingMonsterDetail = 'mo-2';

      startEditMode();

      // J6 is a decision, not an inheritance: dropping the failed monster and opening with the rest
      // is the option that looks helpful and destroys data. `submitPhase1` diffs whatever is in the
      // roster, so Beta would sit there with a known id, an empty baseline and empty drafts — on a
      // monster the user never touched.
      expect(store.monsterDrafts()).toEqual([]);
      expect(store.submitError()).toBe('Could not load this mystery. Please try again.');
    });
  });

  // -------------------------------------------------------------------------------------------
  // §5 — Attach: hydrate, then commit
  // -------------------------------------------------------------------------------------------

  describe('attach', () => {
    beforeEach(() => {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-9'])];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-9'], ['Grasp', 'Whisper', 'Drown']));
      minionsByMonster.set('mo-9', [{ id: 'mi-1' }, { id: 'mi-2' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
      minionDetails.set('mi-2', detailMinion('mi-2', 'Pale Choir', 'mo-9'));
      startCreateMode();
      sent.length = 0;
    });

    it('5b-T1/5b-T7: an attached monster arrives whole, and Next re-keys nothing', () => {
      store.attachMonster('mo-9');

      expect(store.monsterDrafts().map((draft) => draft.name)).toEqual(['The Hollow Man']);
      expect(store.monsterDrafts()[0].attacks.map((attack) => attack.id)).toEqual([
        'mo-9-attack-1',
        'mo-9-attack-2',
        'mo-9-attack-3',
      ]);
      // 5b-T7: its minions come with it, parented to it.
      expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Grave-Wight', 'Pale Choir']);
      expect(store.minionDrafts().every((draft) => draft.monsterKey === store.monsterDrafts()[0].localKey)).toBe(true);

      const attackIdsBefore = store.monsterDrafts()[0].attacks.map((attack) => attack.id);
      sent.length = 0;
      submitPhaseOne();

      // **Not one sub-resource deleted or re-keyed** — here or in the mystery it came from.
      expect(callsMatching(/Attack|Power|Weakness|Armor/)).toEqual([]);
      expect(store.monsterDrafts()[0].attacks.map((attack) => attack.id)).toEqual(attackIdsBefore);
    });

    it('5b-T2: nothing enters the roster, the dossier or the picker until the subtree is in hand', () => {
      // The hydration is synchronous in this double, so the in-flight window is asserted from the
      // one place it is observable: a failed fetch, below. What is asserted here is the *exclusion*
      // rule every consumer depends on — §17.1's reasoning is that all four read a roster row.
      expect(store.monsterDrafts()).toEqual([]);
      expect(store.monsterPickerOptions()).toEqual([]);
      expect(store.attachableMonsters().map((item) => item.id)).toEqual(['mo-9']);

      store.attachMonster('mo-9');

      expect(store.monsterPickerOptions()).toEqual([
        { id: store.monsterDrafts()[0].localKey, name: 'The Hollow Man' },
      ]);
      // Success filters the option out of the strip.
      expect(store.attachableMonsters()).toEqual([]);
    });

    it('5b-T3: a failed *minion* fetch commits nothing at all, and the next submit touches no monster', () => {
      failingMinionDetail = 'mi-2';

      store.attachMonster('mo-9');

      // This is the one path in the design that produces genuine sub-resource destruction rather
      // than harmless churn: a monster admitted with a known id, an empty baseline and empty drafts.
      expect(store.monsterDrafts()).toEqual([]);
      expect(store.minionDrafts()).toEqual([]);
      expect(store.monsterAttachInFlight()).toBe(false);
      // Plain apostrophe, matching every other user-facing string in this app.
      expect(store.monsterAttachError()).toBe(`Couldn't load “The Hollow Man”. Try again.`);
      // Re-offered, so retry is simply picking it again — no separate retry affordance.
      expect(store.attachableMonsters().map((item) => item.id)).toEqual(['mo-9']);

      sent.length = 0;
      submitPhaseOne();

      expect(callsMatching(/^monster\./)).toEqual([]);
    });

    it('5b-T3: a failed *monster* fetch behaves identically — the two halves fail differently', () => {
      failingMonsterDetail = 'mo-9';

      store.attachMonster('mo-9');

      expect(store.monsterDrafts()).toEqual([]);
      expect(store.minionDrafts()).toEqual([]);
      expect(store.monsterAttachError()).toBe(`Couldn't load “The Hollow Man”. Try again.`);
    });

    it('5b-T4: a successful pick clears an error left by a previous failure', () => {
      failingMinionDetail = 'mi-2';
      store.attachMonster('mo-9');
      expect(store.monsterAttachError()).not.toBeNull();

      failingMinionDetail = null;
      store.attachMonster('mo-9');

      expect(store.monsterAttachError()).toBeNull();
      expect(store.monsterDrafts()).toHaveLength(1);
    });

    it('S10: the fan-out is 1 + 1 + N, once, per attach', () => {
      store.attachMonster('mo-9');

      expect(sent.filter((call) => /getById|getByMonster/.test(call))).toEqual([
        'monster.getById(mo-9)',
        'minion.getByMonster(mo-9)',
        'minion.getById(mi-1)',
        'minion.getById(mi-2)',
      ]);
    });

    it('5b-T6: the card counts come from the draft, and the catalogue row disagrees on purpose', () => {
      // The catalogue says `attackCount: 3, minionCount: 2` and the detail says three attacks and
      // two minions — they agree here, so the fixture is rigged to disagree to prove which is read.
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-9'], ['Grasp']));

      store.attachMonster('mo-9');

      expect(store.monsterDrafts()[0].attacks).toHaveLength(1);
      expect(catalogue[0].attackCount).toBe(3);
    });

    it('5b-M7: attaching a monster that is pending removal cancels the disposition', () => {
      store['existingMonsterIds'].set(['mo-9']);
      store.attachMonster('mo-9');
      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');
      expect(store.pendingRemovals()).toHaveLength(1);

      store.attachMonster('mo-9');

      expect(store.pendingRemovals()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------------
  // §6 — Removal and the cascade. The J-cluster lives here.
  // -------------------------------------------------------------------------------------------

  describe('removal', () => {
    /** An edit-mode mystery with one shared monster and two persisted minions under it. */
    function loadSharedMonsterWithMinions(): void {
      catalogue = [catalogueMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9'])];
      monsterDetails.set('mo-9', detailMonster('mo-9', 'The Hollow Man', ['mystery-1', 'mystery-9'], ['Grasp']));
      minionsByMonster.set('mo-9', [{ id: 'mi-1' }, { id: 'mi-2' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-9'));
      minionDetails.set('mi-2', detailMinion('mi-2', 'Pale Choir', 'mo-9'));
      startEditMode();
      sent.length = 0;
    }

    it('5b-M1: a monster in the phase baseline offers both dispositions', () => {
      loadSharedMonsterWithMinions();

      expect(store.persistedForRemoval('monsters', 'mo-9')).toBe(true);
    });

    it('5b-M1: one attached this session offers neither, though it already has an id', () => {
      catalogue = [catalogueMonster('mo-3', 'Newly Attached')];
      monsterDetails.set('mo-3', detailMonster('mo-3', 'Newly Attached'));
      startCreateMode();

      store.attachMonster('mo-3');

      // **This is where the destructive button would be most consequential**, which is why it gets
      // its own test rather than riding on the locations one: an attached entity has an id the
      // instant it is picked, and a monster Delete cascades its minions. Keying on `id` would offer
      // that to someone undoing a mis-click ten seconds old.
      expect(store.monsterDrafts()[0].id).toBe('mo-3');
      expect(store.persistedForRemoval('monsters', 'mo-3')).toBe(false);
    });

    it('5b-M4/J1 under DETACH: the minions are not deleted — that is what detach means', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'detach');
      submitPhaseOne();

      // The exact sequence J1 describes. Before 5b these minions were in `existingMinionIds`, out of
      // `minionDrafts()` (dropped with their parent) and out of the dispositions (dropped by §7.7f),
      // so they landed in `removedIds` and were destroyed **everywhere** by a blind delete on the
      // diff path — while the modal the user had just read promised detach leaves them alone.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
      expect(callsMatching(/^monster\./)).toEqual(['monster.unlink(mystery-1,mo-9)']);
    });

    it('5b-M3/5b-M4/J1 under DELETE: exactly one DELETE, for the monster, and none for the cascade', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');
      submitPhaseOne();

      // The FK cascade takes the minions, so a separate delete would 404 — on the diff path, which
      // has no handler — and fail the phase **non-deterministically**, since the drain and the
      // minion diff are concurrent `forkJoin` siblings. "The minions are gone" passes either way,
      // which is why this is a ledger assertion.
      expect(callsMatching(/delete/)).toEqual(['monster.delete(mo-9)']);
    });

    it('5b-M5/H4: delete a minion, then DETACH its monster, and the minion survives', () => {
      loadSharedMonsterWithMinions();

      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      expect(store.pendingRemovals()).toEqual([{ collection: 'minions', id: 'mi-1', action: 'delete' }]);

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'detach');
      submitPhaseOne();

      // The minion's draft left the roster *with its parent*, so "is it back in the drafts" no
      // longer finds it and the disposition would otherwise survive and drain — destroying that
      // minion in every other mystery.
      expect(callsMatching(/^minion\.delete/)).toEqual([]);
    });

    it('5b-M6: the G1 case — trash a monster, jump the tracker, finish, and it is gone', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');
      store.phaseComplete.set([true, true, true, true]);
      store.jumpToPhase(2);
      expect(store.currentPhase()).toBe(2);

      store.next();

      expect(callsMatching(/^monster\.delete/)).toEqual(['monster.delete(mo-9)']);
    });

    it('5b-M8: removing the last monster takes its minions off the roster', () => {
      loadSharedMonsterWithMinions();

      store.removeMonsterDraft(store.monsterDrafts()[0].localKey, 'delete');

      expect(store.monsterDrafts()).toEqual([]);
      expect(store.minionDrafts()).toEqual([]);
      // And the minion baseline went with the draft — J1's fix, observable as a predicate flip.
      expect(store.persistedForRemoval('minions', 'mi-1')).toBe(false);
    });

    it('J4/§7.7i: a minion re-parented onto the removed monster reverts to its baseline parent', () => {
      catalogue = [
        catalogueMonster('mo-a', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-b', 'Beta', ['mystery-1']),
      ];
      monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1']));
      minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
      startEditMode();
      sent.length = 0;

      const alpha = store.monsterDrafts().find((draft) => draft.id === 'mo-a')!;
      const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;

      // Move M from Alpha to Beta in the composer, then remove Beta.
      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(beta.localKey);
      store.saveMinionDraftToList();
      expect(store.minionDrafts()[0].monsterKey).toBe(beta.localKey);

      store.removeMonsterDraft(beta.localKey, 'delete');

      // **Synchronously**, so the roster re-renders with M under Alpha the instant Beta goes
      // (UX §18.4). Without this row the draft would leave with Beta, the minion would stay in
      // Alpha's baseline with no draft claiming it, and Alpha's own diff would delete it — J1 by
      // another route.
      expect(store.minionDrafts().map((draft) => draft.monsterKey)).toEqual([alpha.localKey]);

      submitPhaseOne();

      expect(callsMatching(/^minion\.(delete|move)/)).toEqual([]);
    });

    it('§7.7i: an *unsaved* minion pointed at the removed monster goes with it', () => {
      startCreateMode();
      authorMonster('Alpha');
      authorMonster('Beta');
      authorMinion('Choir Thrall', keyOf('Beta'));

      store.removeMonsterDraft(keyOf('Beta'), 'delete');

      // It never existed, so there is nothing to revert to. The accepted gap §6.4 names.
      expect(store.minionDrafts()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------------
  // §7 — The minion picker and re-parenting
  // -------------------------------------------------------------------------------------------

  describe('the minion picker and re-parenting', () => {
    function loadTwoMonstersOneMinion(): void {
      catalogue = [
        catalogueMonster('mo-a', 'Alpha', ['mystery-1']),
        catalogueMonster('mo-b', 'Beta', ['mystery-1']),
      ];
      monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1']));
      monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1']));
      minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
      minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
      startEditMode();
      sent.length = 0;
    }

    it('5b-K1: one monster answers for the composer; two or more leave it to the picker', () => {
      startCreateMode();
      authorMonster('Alpha');

      expect(store.soleMonsterKey()).toBe(keyOf('Alpha'));
      expect(store.effectiveMinionMonsterKey()).toBe(keyOf('Alpha'));

      authorMonster('Beta');

      expect(store.soleMonsterKey()).toBeNull();
      expect(store.effectiveMinionMonsterKey()).toBe('');
    });

    it('5b-K2/5b-R5: the picker offers the in-memory roster, including monsters with no id yet', () => {
      startCreateMode();
      authorMonster('Alpha');
      authorMonster('Beta');

      expect(store.monsterDrafts().every((draft) => draft.id === null)).toBe(true);
      expect(store.monsterPickerOptions()).toEqual([
        { id: keyOf('Alpha'), name: 'Alpha' },
        { id: keyOf('Beta'), name: 'Beta' },
      ]);
    });

    it('5b-K4: no re-parent fires when nothing moved', () => {
      loadTwoMonstersOneMinion();

      submitPhaseOne();

      // The criterion J2 exists for. Without a baseline parent the verb would fire once per
      // persisted minion per submit — of a verb that *moves*, and that against a stale id silently
      // relocates rather than failing.
      expect(callsMatching(/^minion\.move/)).toEqual([]);
    });

    it('5b-K3/5b-K6: changing the parent moves it, once, and the roster shows it before the submit', () => {
      loadTwoMonstersOneMinion();
      const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;

      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(beta.localKey);
      store.saveMinionDraftToList();

      // Committed to the draft, so the roster card reads the new parent immediately.
      expect(store.monsterNameForKey(store.minionDrafts()[0].monsterKey)).toBe('Beta');

      submitPhaseOne();

      expect(callsMatching(/^minion\.move/)).toEqual(['minion.move(mo-b,mi-1)']);
      // Its sub-resources moved with it, unchanged in content and in id.
      expect(store.minionDrafts()[0].attacks.map((attack) => attack.id)).toEqual(['mi-1-attack-1']);
      expect(callsMatching(/minion\.(create|delete)Attack/)).toEqual([]);
    });

    it('5b-K4: and the move does not fire again on the following submit', () => {
      loadTwoMonstersOneMinion();
      const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;
      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(beta.localKey);
      store.saveMinionDraftToList();
      submitPhaseOne();

      sent.length = 0;
      submitPhaseOne();

      expect(callsMatching(/^minion\.move/)).toEqual([]);
    });

    it('5b-K5: a minion cannot be committed without a monster', () => {
      startCreateMode();
      store.currentStep.set(1);
      store.minionForm.patchValue({ name: 'Orphan', minionTypeId: 'minion-type-1' });

      store.saveMinionDraftToList();

      expect(store.minionDrafts()).toEqual([]);
    });

    it('5b-K5: re-parenting onto a monster added this session resolves through its localKey', () => {
      loadTwoMonstersOneMinion();
      authorMonster('Gamma');
      const gamma = store.monsterDrafts().find((draft) => draft.name === 'Gamma')!;
      expect(gamma.id).toBeNull();

      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.monsterKey.setValue(gamma.localKey);
      store.saveMinionDraftToList();

      submitPhaseOne();

      expect(callsMatching(/^minion\.move/)).toEqual(['minion.move(created-monster-1,mi-1)']);
    });
  });

  // -------------------------------------------------------------------------------------------
  // §7.7i(1) — the operand asymmetry, which is the half that is easy to get wrong
  // -------------------------------------------------------------------------------------------

  it('§7.7i: a minion re-parented AWAY from a monster is not deleted by that monster’s diff', () => {
    catalogue = [catalogueMonster('mo-a', 'Alpha', ['mystery-1']), catalogueMonster('mo-b', 'Beta', ['mystery-1'])];
    monsterDetails.set('mo-a', detailMonster('mo-a', 'Alpha', ['mystery-1']));
    monsterDetails.set('mo-b', detailMonster('mo-b', 'Beta', ['mystery-1']));
    minionsByMonster.set('mo-a', [{ id: 'mi-1' }]);
    minionDetails.set('mi-1', detailMinion('mi-1', 'Grave-Wight', 'mo-a'));
    startEditMode();
    sent.length = 0;

    const beta = store.monsterDrafts().find((draft) => draft.id === 'mo-b')!;
    store.editMinionDraft(store.minionDrafts()[0].localKey);
    store.minionForm.controls.monsterKey.setValue(beta.localKey);
    store.saveMinionDraftToList();

    submitPhaseOne();

    // `removedIds(D) = D.existingMinionIds − *all* minion drafts − disposed`. Scoping the drafts
    // per-monster too would delete this minion: its id is in Alpha's baseline, and its draft now
    // carries Beta's `monsterKey`.
    expect(callsMatching(/^minion\.delete/)).toEqual([]);
    expect(callsMatching(/^minion\.move/)).toEqual(['minion.move(mo-b,mi-1)']);
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
