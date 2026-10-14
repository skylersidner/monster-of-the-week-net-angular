import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { CustomMoveService } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **Phase 5a — the sub-resource upsert diff, as an exact request ledger.**
 *
 * Peach's framing, and it is the reason this file exists rather than a set of content assertions:
 * a *wrong* 5a passes a content-preservation test. Delete-all/recreate-all preserves every name,
 * every harm value and every description; what it does not preserve is the row's identity, and it
 * issues a storm of writes to achieve nothing. So the two oracles here are
 *
 * 1. **ids across a phase transition** (`5a-U1`, `5a-U9`) — no request interception at all, and it
 *    fails loudly on the most likely wrong implementation; and
 * 2. **the complete sorted multiset of calls** (`5a-U2`–`5a-U8`, `5a-M5`) — because every failure
 *    5a exists to prevent is an *extra or duplicated write that produces the right end state*, and
 *    `toContain` cannot see one.
 *
 * **Recorded at subscribe, not at invocation.** `HttpClient` is cold, so a ledger written when the
 * service method is called over-counts a request that was built and dropped. `defer()` moves the
 * record to the honest moment. Same rule as `mystery-create-phase4-ledger.spec.ts`.
 *
 * **Create mode is the default here, deliberately.** `5a-U9` names it: the Next → Back → Next
 * hazard needs no edit mode and no attach, and testing it in create mode is what proves the
 * post-submit writeback keeps the drafts and the baseline in step. Edit-mode hydration gets its
 * own block for `5a-H1`/`5a-H2`.
 */

const WEAPON_TAGS = [
  { id: 'tag-bladed', name: 'Bladed', description: '' },
  { id: 'tag-slow', name: 'Slow', description: '' },
];

/**
 * **The membership PUT fires for every roster monster that has an id** (§5.1 Concern A, one level
 * up from the locations path): `update` carries no mystery in its URL, so without it an *attached*
 * monster would have its fields written and never join the mystery. Idempotent in effect, so it is
 * unconditional rather than branched — which is why it appears in every ledger below.
 */
const MONSTER_LINK = 'monster.link(mystery-1,monster-1)';

const tagRef = (id: string) => WEAPON_TAGS.find((tag) => tag.id === id)!;

describe('Phase 5a — the sub-resource diff, by exact request ledger', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let monsterService: Record<string, ReturnType<typeof vi.fn>>;
  let minionService: Record<string, ReturnType<typeof vi.fn>>;

  /**
   * `[a, b]` and `[b, a]` are the same batch — `forkJoin` gives no order guarantee worth
   * asserting — so both sides are sorted. **Multiplicity is not sorted away**, which is the point:
   * a duplicate stays a second element and still fails the comparison.
   */
  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());

  /** Ids of a collection, in draft order. The `5a-U1` oracle. */
  const idsOf = (drafts: readonly { id: string | null }[]): (string | null)[] => drafts.map((draft) => draft.id);

  /**
   * **Per roster row, not per phase** (5b). Until the roster existed these read four store-level
   * signals; they are now the *draft's* collections, which is what makes `5a-U1`—`5a-U9` mean
   * "this monster's ids survived" rather than "the composer's did".
   */
  const monsterIds = (index = 0) => {
    const draft = store.monsterDrafts()[index];
    return {
      attacks: idsOf(draft.attacks),
      powers: idsOf(draft.powers),
      weaknesses: idsOf(draft.weaknesses),
      armors: idsOf(draft.armors),
      // **The fifth collection, added in 5f-2** (§30.4). This is where the writeback's silent site
      // is caught: omit `customMoves: rekeyDrafts(...)` from `writeBackMonsterDrafts` and the ids
      // never come back onto the drafts while the baseline moves on without them, so every later
      // submit deletes and recreates the lot. Extending the helper rather than adding a separate
      // one is what makes the eight snapshot comparisons below assert it too, for free.
      customMoves: idsOf(draft.customMoves),
    };
  };

  const minionIds = () => {
    const draft = store.minionDrafts()[0];
    return {
      id: draft.id,
      attacks: idsOf(draft.attacks),
      powers: idsOf(draft.powers),
      weaknesses: idsOf(draft.weaknesses),
      armors: idsOf(draft.armors),
      customMoves: idsOf(draft.customMoves),
    };
  };

  beforeEach(() => {
    sent = [];

    const describeArg = (arg: unknown): string =>
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg);

    const record = <T>(name: string, result: (...args: never[]) => T) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          sent.push(`${name}(${args.map(describeArg).join(',')})`);
          return of(result(...(args as never[])));
        }),
      );

    /**
     * Sub-resource doubles **echo the request into the response**, which is not incidental.
     * The diff compares a draft against the response that became its baseline; a double returning a
     * bare `{ id }` reports every row as changed on the next pass and would manufacture exactly the
     * churn this file is asserting the absence of. A stub that cannot represent "unchanged" cannot
     * test a diff.
     *
     * Each create also mints a **fresh** id: a double returning one fixed id makes two rows
     * indistinguishable to the diff, which would let a genuine mis-identification pass.
     */
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

    monsterService = {
      ...subResourceDoubles('monster', 'm'),
      create: record('monster.create', () => ({ id: 'monster-1' })),
      update: record('monster.update', () => ({ id: 'monster-1' })),
      delete: record('monster.delete', () => undefined),
      linkToMystery: record('monster.link', () => undefined),
      unlinkFromMystery: record('monster.unlink', () => undefined),
      getAll: vi.fn(() => of([])),
      getByMystery: vi.fn(() => of([])),
      getById: vi.fn(() => of(null)),
    };
    minionService = {
      ...subResourceDoubles('minion', 'n'),
      create: record('minion.create', () => ({ id: 'minion-1' })),
      update: record('minion.update', () => ({ id: 'minion-1' })),
      delete: record('minion.delete', () => undefined),
      moveToMonster: record('minion.move', () => undefined),
      getByMonster: vi.fn(() => of([])),
      getById: vi.fn(() => of(null)),
    };

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        /**
         * **F-L9 — recorded, not refused.** `CustomMoveService` is `providedIn: 'root'`, so
         * without a stub the real one resolves and a stray call becomes a real HTTP request:
         * refused today only because nothing is listening on :5225, and a write against dev the
         * moment something is. Recording it into `sent` is strictly better than silencing it —
         * every exact ledger in this file now also asserts that the clean path issues no
         * custom-move traffic, which is the property 5f-2 found this file was enforcing by
         * accident, through a failed `fetch` that surfaced as a null attack id.
         */
        {
          provide: CustomMoveService,
          useValue: {
            list: record('move.list', () => []),
            create: record('move.create', () => ({ id: 'move-unexpected', name: '', description: null })),
            update: record('move.update', () => ({ id: 'move-unexpected', name: '', description: null })),
            delete: record('move.delete', () => undefined),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
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
            getMysteries: vi.fn(() => of([{ id: 'mystery-1', name: 'The Hollow Choir' }])),
          },
        },
        { provide: MonsterService, useValue: monsterService },
        { provide: MinionService, useValue: minionService },
        { provide: LocationService, useValue: { getAll: vi.fn(() => of([])), getByMystery: vi.fn(() => of([])) } },
        { provide: BystanderService, useValue: { getAll: vi.fn(() => of([])), getByMystery: vi.fn(() => of([])) } },
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of(WEAPON_TAGS),
          },
        },
      ],
    });
  });

  // -----------------------------------------------------------------------------------------
  // Create mode: the wizard's own path from an empty monster to a saved one and back again.
  // -----------------------------------------------------------------------------------------

  /** Puts the wizard on the monster phase with a filled composer and nothing submitted yet. */
  function startCreateMode(): void {
    store = TestBed.inject(MysteryCreateStore);
    store.init();
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
    store.monsterForm.setValue({
      name: 'Maestro Vey',
      description: 'A conductor of drowned voices.',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
  }

  /** Commits the composer into the roster, as `Next` off step 0 does. */
  function commitMonster(): void {
    store.saveMonsterDraftToList();
  }

  function addMonsterCollections(): void {
    store.monsterAttackForm.setValue({ name: 'Baton Lash', harm: 2, description: '', weaponTagIds: ['tag-bladed'] });
    store.addMonsterAttack();
    store.monsterPowerForm.setValue({ name: 'Shadow Step', description: 'Steps between echoes.' });
    store.addMonsterPower();
    store.monsterWeaknessForm.setValue({ name: 'Silence', description: '' });
    store.addMonsterWeakness();
    store.monsterArmorForm.setValue({
      name: 'Bone Plate',
      description: '',
      harmSoak: 2,
      isSpecial: false,
      specialDescription: '',
    });
    store.addMonsterArmor();
  }

  function addMinionWithCollections(): void {
    store.currentStep.set(1);
    // One monster on the roster, so the composer needs no picker and the store answers for it.
    store.minionForm.patchValue({ monsterKey: store.monsterDrafts()[0].localKey });
    store.minionForm.patchValue({
      name: 'Choir Thrall',
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.minionAttackForm.setValue({ name: 'Jagged Hymn', harm: 1, description: '', weaponTagIds: [] });
    store.addMinionAttack();
    store.minionPowerForm.setValue({ name: 'Keening', description: '' });
    store.addMinionPower();
    store.saveMinionDraftToList();
  }

  /**
   * Submits phase 1 and puts the wizard back on it, as the tracker's Back would.
   *
   * It walks **both** steps, because that is the user's path and because step 0's `Next` is what
   * commits the monster composer into the roster. A test that mutated the composer and jumped
   * straight to the submit would be asserting against a draft the store never saw.
   */
  function submitPhaseOne(): void {
    store.currentPhase.set(1);
    store.currentStep.set(0);
    store.next();
    store.next();
    store.currentPhase.set(1);
    store.currentStep.set(1);
  }

  /** Pulls the roster's first monster back into the composer, as the pencil does. */
  function openRosterMonster(index = 0): void {
    store.currentStep.set(0);
    store.editMonsterDraft(store.monsterDrafts()[index].localKey);
  }

  describe('create mode, Next → Back → Next', () => {
    beforeEach(() => {
      startCreateMode();
      addMonsterCollections();
      commitMonster();
      addMinionWithCollections();
      submitPhaseOne();
    });

    it('5a-U1: ids survive a phase transition, for the monster and for a minion', () => {
      const before = { monster: monsterIds(), minion: minionIds() };

      // Every id is real: nothing is left null after the first submit, which is the half of H2 that
      // makes the comparison below meaningful rather than "null equals null".
      expect(Object.values(before.monster).flat()).not.toContain(null);
      expect(before.minion.id).toBe('minion-1');

      sent.length = 0;
      submitPhaseOne();

      expect(monsterIds()).toEqual(before.monster);
      expect(minionIds()).toEqual(before.minion);
    });

    it('5a-U2: a submit with nothing edited issues no sub-resource writes at all', () => {
      sent.length = 0;
      submitPhaseOne();

      // The monster and the minion are still PUT — their own fields are diffed one level up, which
      // is Phase 4's rule and out of 5a's scope. Nothing below them moves.
      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
    });

    it('5a-U9: two consecutive no-op submits are identical, and neither rotates an id', () => {
      sent.length = 0;
      submitPhaseOne();
      const first = [...sent].sort();
      const afterFirst = { monster: monsterIds(), minion: minionIds() };

      sent.length = 0;
      submitPhaseOne();

      expect([...sent].sort()).toEqual(first);
      expect(monsterIds()).toEqual(afterFirst.monster);
      expect(minionIds()).toEqual(afterFirst.minion);
    });

    it('5a-U3: editing one attack name sends exactly one PUT, and nothing else below the monster', () => {
      openRosterMonster();
      const attack = store.monsterAttacks()[0];
      const powerIdBefore = store.monsterPowers()[0].id;
      store.monsterAttacks.update((drafts) => drafts.map((draft) => ({ ...draft, name: 'Baton Crack' })));

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
        `monster.updateAttack(monster-1,${attack.id},` +
          JSON.stringify({ name: 'Baton Crack', description: null, harm: 2 }) +
          ')',
      ]);
      // Per row, not per entity: the attack's own id is untouched and its siblings never moved.
      // Read from the **roster draft**, not the composer, which is empty once the row is committed.
      expect(monsterIds().attacks).toEqual([attack.id]);
      expect(monsterIds().powers).toEqual([powerIdBefore]);
    });

    it('5a-U4: renaming the monster writes the monster and none of its eight collections', () => {
      openRosterMonster();
      store.monsterForm.controls.name.setValue('Maestro Veyle');

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest('Maestro Veyle') + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
    });

    it('5a-U5: adding one power sends one create; removing one power sends one delete', () => {
      openRosterMonster();
      store.monsterPowerForm.setValue({ name: 'Drowned Chorus', description: '' });
      store.addMonsterPower();
      const survivingId = store.monsterPowers()[0].id;

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
        'monster.createPower(monster-1,' + JSON.stringify({ name: 'Drowned Chorus', description: null }) + ')',
      ]);
      expect(monsterIds().powers[0]).toBe(survivingId);

      // Back into the composer to take one out again — the roster row is the draft now.
      openRosterMonster();
      const doomed = store.monsterPowers()[1];
      store.removeMonsterPower(doomed.localKey);

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
        `monster.deletePower(monster-1,${doomed.id})`,
      ]);
      expect(monsterIds().powers).toEqual([survivingId]);
    });

    it('5a-U6: editing a field and changing it back issues no write', () => {
      openRosterMonster();
      store.monsterPowers.update((drafts) => drafts.map((draft) => ({ ...draft, name: 'Shadow Stride' })));
      store.monsterPowers.update((drafts) => drafts.map((draft) => ({ ...draft, name: 'Shadow Step' })));

      sent.length = 0;
      submitPhaseOne();

      // A stored `edited` flag is still set at this point. A baseline comparison is not.
      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
    });

    it('5a-U7: a cancelled composer edit issues no write', () => {
      store.editMinionDraft(store.minionDrafts()[0].localKey);
      store.minionForm.controls.name.setValue('Choir Thrall the Second');
      store.minionAttackForm.setValue({ name: 'Discarded', harm: 9, description: '', weaponTagIds: [] });
      store.addMinionAttack();
      store.cancelComposerEdit();

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
    });

    /**
     * **`5a-H1` tested as a claim rather than as an instance.** (Toad, 5a review.)
     *
     * `5a-U1`/`5a-U2`/`5a-U9` prove the baseline and the drafts still agree after an *idle*
     * submit. They say nothing about the submits that actually write — and those are precisely the
     * ones that rebuild a baseline out of a server response. A create answers with the row it just
     * made, an update with the row it just changed, and either can come back in a shape the drafts
     * can no longer match. That is H2 with one more step in front of it, and no content assertion
     * can see it.
     *
     * So the shape below is: perform each kind of write, submit, and then submit **again**. The
     * second submit must be silent and must rotate nothing, for every write path rather than only
     * the idle one.
     *
     * **Why the whole ledger and not just the absence of sub-resource calls.** `monster.update` and
     * `minion.update` are required to be *present*, so a `next()` that silently declined to submit
     * fails here rather than passing quietly. That is the same vacuity that nearly let the `5a-M1`
     * G1 test pass for the wrong reason, and an absence assertion is exactly where it hides.
     */
    const expectTheNextSubmitToBeSilent = (): void => {
      const before = { monster: monsterIds(), minion: minionIds() };

      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
      expect(monsterIds()).toEqual(before.monster);
      expect(minionIds()).toEqual(before.minion);
    };

    it('5a-H1: a created row settles — the create response becomes a baseline its draft matches', () => {
      openRosterMonster();
      store.monsterPowerForm.setValue({ name: 'Drowned Chorus', description: '' });
      store.addMonsterPower();
      submitPhaseOne();

      expectTheNextSubmitToBeSilent();
    });

    it('5a-H1: an updated row settles — so does the response to a PUT', () => {
      openRosterMonster();
      store.monsterPowers.update((drafts) => drafts.map((draft) => ({ ...draft, name: 'Shadow Stride' })));
      submitPhaseOne();

      expectTheNextSubmitToBeSilent();
    });

    it('5a-H1: a deleted row settles, and the survivor is untouched', () => {
      openRosterMonster();
      store.monsterPowerForm.setValue({ name: 'Drowned Chorus', description: '' });
      store.addMonsterPower();
      submitPhaseOne();
      const survivor = monsterIds().powers[0];

      openRosterMonster();
      store.removeMonsterPower(store.monsterPowers()[1].localKey);
      submitPhaseOne();

      expect(monsterIds().powers).toEqual([survivor]);
      expectTheNextSubmitToBeSilent();
    });

    /**
     * **The `afterSave` correction, as the churn it prevents rather than as a return type.**
     *
     * `POST /attacks` answers *before* its weapon tags are assigned, so the create response holds
     * `weaponTags: []` against a draft that has one. If the follow-up did not report what it had
     * just assigned, `isDirty` would call this attack changed on every later submit and the wizard
     * would re-`PUT` it and re-assign the same tag on every phase transition — for ever. The
     * second submit is where that shows up; the first looks perfect either way.
     */
    it('5a-H1/5a-U8: a newly created *tagged* attack settles, though its create answered untagged', () => {
      openRosterMonster();
      store.monsterAttackForm.setValue({ name: 'Downbeat', harm: 3, description: '', weaponTagIds: ['tag-slow'] });
      store.addMonsterAttack();

      sent.length = 0;
      submitPhaseOne();

      // Positive control: the create and its follow-up assign did go out on this submit. Read from
      // the roster draft — the composer emptied when the row was committed.
      const created = { id: monsterIds().attacks[1] };
      expect(sent.filter((call) => call.includes('Tag('))).toEqual([
        'monster.assignTag(monster-1,' + created.id + ',tag-slow)',
      ]);

      expectTheNextSubmitToBeSilent();
    });

    /** The same hazard on the update path: a `PUT` answers untagged too. */
    it('5a-H1/5a-U8: an attack whose tags changed settles', () => {
      openRosterMonster();
      store.monsterAttacks.update((drafts) => drafts.map((draft) => ({ ...draft, weaponTagIds: ['tag-slow'] })));

      sent.length = 0;
      submitPhaseOne();

      const attack = { id: monsterIds().attacks[0] };
      expect([...sent].filter((call) => call.includes('Tag(')).sort()).toEqual([
        'monster.assignTag(monster-1,' + attack.id + ',tag-slow)',
        'monster.removeTag(monster-1,' + attack.id + ',tag-bladed)',
      ]);

      expectTheNextSubmitToBeSilent();
    });

    describe('5a-U8: the weapon-tag sub-diff', () => {
      it('adding a tag to an existing attack sends one assign and no remove', () => {
        openRosterMonster();
        const attack = store.monsterAttacks()[0];
        store.monsterAttacks.update((drafts) =>
          drafts.map((draft) => ({ ...draft, weaponTagIds: ['tag-bladed', 'tag-slow'] })),
        );

        sent.length = 0;
        submitPhaseOne();

        expect(sent.filter((call) => call.includes('Tag('))).toEqual([
          `monster.assignTag(monster-1,${attack.id},tag-slow)`,
        ]);
      });

      it('removing a tag sends one remove and no assign — the half that never shipped', () => {
        openRosterMonster();
        const attack = store.monsterAttacks()[0];
        store.monsterAttacks.update((drafts) => drafts.map((draft) => ({ ...draft, weaponTagIds: [] })));

        sent.length = 0;
        submitPhaseOne();

        expect(sent.filter((call) => call.includes('Tag('))).toEqual([
          `monster.removeTag(monster-1,${attack.id},tag-bladed)`,
        ]);
      });

      it('editing the name while leaving the tags alone sends neither', () => {
        openRosterMonster();
        store.monsterAttacks.update((drafts) => drafts.map((draft) => ({ ...draft, name: 'Baton Crack' })));

        sent.length = 0;
        submitPhaseOne();

        expect(sent.filter((call) => call.includes('Tag('))).toEqual([]);
      });
    });
  });

  // -----------------------------------------------------------------------------------------
  // 5a-H1 / 5a-H2: the other entry point that populates a baseline.
  // -----------------------------------------------------------------------------------------

  describe('edit-mode hydration', () => {
    const attackResponse = {
      id: 'm-attack-9',
      name: 'Baton Lash',
      description: null,
      harm: 2,
      weaponTags: [tagRef('tag-bladed')],
    };

    beforeEach(() => {
      monsterService['getByMystery'] = vi.fn(() =>
        of([{ id: 'monster-1', name: 'Maestro Vey', mysteryIds: ['mystery-1'] }]),
      );
      monsterService['getById'] = vi.fn(() =>
        of({
          id: 'monster-1',
          mysteryIds: ['mystery-1'],
          name: 'Maestro Vey',
          description: 'A conductor of drowned voices.',
          harmCapacity: 8,
          monsterTypeId: 'monster-type-1',
          monsterTypeName: 'Beast',
          monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
          attacks: [attackResponse],
          powers: [{ id: 'm-power-9', name: 'Shadow Step', description: 'Steps between echoes.' }],
          armors: [
            {
              id: 'm-armor-9',
              name: 'Bone Plate',
              description: null,
              harmSoak: 2,
              isSpecial: false,
              specialDescription: null,
            },
          ],
          weaknesses: [{ id: 'm-weakness-9', name: 'Silence', description: null }],
          // **Non-empty on purpose.** An empty collection still fails the oracle if the writeback
          // drops the field (`idsOf(undefined)` throws), but it cannot catch the ids being
          // *rotated* — which is the failure 5a exists to prevent. One row makes both observable.
          customMoves: [{ id: 'm-move-9', name: 'Conduct the Dead', description: 'Roll +Weird.' }],
        }),
      );
      minionService['getByMonster'] = vi.fn(() => of([{ id: 'minion-1', monsterId: 'monster-1' }]));
      minionService['getById'] = vi.fn(() =>
        of({
          id: 'minion-1',
          monsterId: 'monster-1',
          monsterName: 'Maestro Vey',
          name: 'Choir Thrall',
          description: null,
          harmCapacity: 3,
          minionType: { id: 'minion-type-1', name: 'Cultist', motivation: '' },
          attacks: [{ id: 'n-attack-9', name: 'Jagged Hymn', description: null, harm: 1, weaponTags: [] }],
          powers: [{ id: 'n-power-9', name: 'Keening', description: null }],
          armors: [],
          weaknesses: [],
          customMoves: [{ id: 'n-move-9', name: 'Join the Chorus', description: null }],
        }),
      );

      store = TestBed.inject(MysteryCreateStore);
      store.init('mystery-1');
      sent.length = 0;
    });

    it('5a-H1: the hydrator gives the drafts the ids of the rows it made the baseline from', () => {
      expect(monsterIds()).toEqual({
        attacks: ['m-attack-9'],
        powers: ['m-power-9'],
        weaknesses: ['m-weakness-9'],
        armors: ['m-armor-9'],
        customMoves: ['m-move-9'],
      });
    });

    it('5a-H2: and the same one level down, on a hydrated minion', () => {
      expect(minionIds()).toEqual({
        id: 'minion-1',
        attacks: ['n-attack-9'],
        powers: ['n-power-9'],
        weaknesses: [],
        armors: [],
        customMoves: ['n-move-9'],
      });
    });

    /**
     * **Positive control for the two absence assertions that follow.** (Toad, 5a review.)
     *
     * `next()` returns without submitting whenever `validateCurrentStep()` refuses, and a wizard
     * that never submitted is indistinguishable from one that submitted and wrote nothing — so
     * "no sub-resource writes" is a tautology unless something requires the submit to have
     * happened. This is the `5a-M1` near-miss in its general form, and an absence assertion is
     * where it hides. The full ledger makes the two entity updates mandatory.
     */
    it('5a-H1: the hydrated submit really is a submit', () => {
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
    });

    /**
     * **F-L9, said out loud.** This file was already enforcing this property, by accident and
     * illegibly: `CustomMoveService` is root-provided, nothing stubbed it, so a stray custom-move
     * request reached a real `fetch`, failed, and took the whole submit with it. 5f-2 hit that
     * while controlling the writeback and the symptom was a **null attack id in a weapon-tag
     * test** — three layers from the cause.
     *
     * The stub now records into `sent` instead of refusing, which turns every `expectLedger([…])`
     * above and below into an assertion that no custom-move request went out — `5a-H1` three lines
     * up already is one. This test exists so the property has a name rather than only a side
     * effect, and so it keeps holding on the path that matters most: a hydrated monster **and** a
     * hydrated minion that each carry a custom move, submitted without anyone touching them.
     *
     * Decision 9's clean branch is what makes it true: an unchanged row is carried forward from
     * the baseline with no request at all.
     */
    it('F-L9: an untouched hydrated roster issues no custom-move traffic at all', () => {
      // Non-vacuous: there really are moves on both rows, from the hydration fixtures.
      expect(store.monsterDrafts()[0].customMoves.map((move) => move.id)).toEqual(['m-move-9']);
      expect(store.minionDrafts()[0].customMoves.map((move) => move.id)).toEqual(['n-move-9']);

      submitPhaseOne();

      expect(sent.filter((call) => call.startsWith('move.'))).toEqual([]);
    });

    /**
     * **The edit-mode half of the `afterSave` correction, which create mode does not stand in for.**
     *
     * Mutating `afterSave` to drop the tags it had just assigned killed nine create-mode tests and
     * not one edit-mode test, so this gap was real rather than theoretical. It is also a different
     * case and not a re-run: the collection already holds a hydrated row, so the create response is
     * merged into a **non-empty** baseline, and the new row has to settle without disturbing it.
     */
    it('5a-U8 (edit mode): a tagged attack added to a hydrated monster settles after one submit', () => {
      openRosterMonster();
      store.monsterAttackForm.setValue({ name: 'Downbeat', harm: 3, description: '', weaponTagIds: ['tag-slow'] });
      store.addMonsterAttack();

      submitPhaseOne();

      const created = { id: monsterIds().attacks[1] };
      expect(sent.filter((call) => call.includes('Tag('))).toEqual([
        'monster.assignTag(monster-1,' + created.id + ',tag-slow)',
      ]);
      // The hydrated row is still itself; the new one has a real id of its own.
      expect(monsterIds().attacks).toEqual(['m-attack-9', created.id]);

      const before = monsterIds();
      sent.length = 0;
      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
      ]);
      expect(monsterIds()).toEqual(before);
    });

    /**
     * **`5a-H2` one level down, as behaviour rather than as ids.** Luigi's `5a-H2` asserts the
     * hydrated minion's drafts carry ids; these assert the diff then *uses* them — a per-row `PUT`
     * and a per-row `DELETE` against a hydrated minion, which is the case §5.2's H1 correction says
     * had no safe model to copy.
     */
    it('5a-H2/5a-U3: editing a hydrated minion attack sends exactly one PUT, and nothing else', () => {
      store.minionDrafts.update((drafts) =>
        drafts.map((draft) => ({
          ...draft,
          attacks: draft.attacks.map((attack) => ({ ...attack, name: 'Jagged Descant' })),
        })),
      );

      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
        'minion.updateAttack(minion-1,n-attack-9,' +
          JSON.stringify({ name: 'Jagged Descant', description: null, harm: 1 }) +
          ')',
      ]);
      expect(minionIds().attacks).toEqual(['n-attack-9']);
      expect(minionIds().powers).toEqual(['n-power-9']);
    });

    it('5a-H2/5a-U5: removing a hydrated minion power sends one DELETE and leaves its attack alone', () => {
      store.minionDrafts.update((drafts) => drafts.map((draft) => ({ ...draft, powers: [] })));

      submitPhaseOne();

      expectLedger([
        'monster.update(monster-1,' + monsterRequest() + ')',
        MONSTER_LINK,
        'minion.update(minion-1,' + minionRequest() + ')',
        'minion.deletePower(minion-1,n-power-9)',
      ]);
      expect(minionIds().attacks).toEqual(['n-attack-9']);
      expect(minionIds().powers).toEqual([]);
    });

    it('5a-H1/5a-U2: submitting a freshly hydrated monster writes nothing below the monster', () => {
      submitPhaseOne();

      expect(sent.filter((call) => /Attack|Power|Weakness|Armor|Tag/.test(call))).toEqual([]);
    });

    it('5a-H1/5a-U1: and rotates no ids', () => {
      const before = { monster: monsterIds(), minion: minionIds() };

      submitPhaseOne();

      expect(monsterIds()).toEqual(before.monster);
      expect(minionIds()).toEqual(before.minion);
    });
  });

  // -----------------------------------------------------------------------------------------
  // 5a-M: minions on the disposition drain.
  // -----------------------------------------------------------------------------------------

  describe('minion removal on the drain', () => {
    beforeEach(() => {
      startCreateMode();
      commitMonster();
      addMinionWithCollections();
      submitPhaseOne();
      sent.length = 0;
    });

    it('5a-M3: removing a persisted minion records a delete disposition and issues nothing yet', () => {
      const draft = store.minionDrafts()[0];
      expect(store.persistedForRemoval('minions', draft.id)).toBe(true);

      store.removeMinionDraft(draft.localKey);

      expect(store.minionDrafts()).toEqual([]);
      // 5a-M4: deferral. The card is gone; the wire is silent until the phase is submitted.
      expectLedger([]);
    });

    it('5a-M3: removing a never-saved minion is a local discard with no disposition at all', () => {
      store.minionForm.patchValue({ name: 'Unsaved', description: '', harmCapacity: 2, minionTypeId: 'minion-type-1' });
      store.saveMinionDraftToList();
      const draft = store.minionDrafts().find((item) => item.name === 'Unsaved')!;
      expect(store.persistedForRemoval('minions', draft.id)).toBe(false);

      store.removeMinionDraft(draft.localKey);

      sent.length = 0;
      submitPhaseOne();

      expect(sent.filter((call) => call.startsWith('minion.delete'))).toEqual([]);
    });

    it('5a-M1/5a-M5: a confirmed deletion produces exactly one DELETE, from the drain and not the diff', () => {
      const draft = store.minionDrafts()[0];
      store.removeMinionDraft(draft.localKey);

      submitPhaseOne();

      // The §7.7c hazard in its exact form: `saveMinionDrafts`'s own `idsToRemove` would fire a
      // second `DELETE /api/minions/minion-1` for the same intention, racing the drain's copy — and
      // only the drain's copy maps 404 to success, so the duplicate fails the whole phase.
      expect(sent.filter((call) => call.startsWith('minion.delete'))).toEqual(['minion.delete(minion-1)']);
    });

    it('5a-M1: the G1 repro -- the deletion drains from a *later* phase, never re-entering phase 1', () => {
      const draft = store.minionDrafts()[0];
      store.removeMinionDraft(draft.localKey);

      // Architecture section 10's exact sequence, and the reason decision 17 exists: trash a
      // persisted minion, then click a later tracker bubble and finish from there. Phase 1 is never
      // submitted again, so `saveMinionDrafts`'s own diff never runs. If the deletion is not on the
      // drain it is simply lost, and the minion the user deleted is still there.
      store.phaseComplete.set([true, true, true, true]);
      store.jumpToPhase(2);
      expect(store.currentPhase()).toBe(2);

      store.next();

      expect(sent.filter((call) => call.startsWith('minion.'))).toEqual(['minion.delete(minion-1)']);
    });

    it('5a-M5: the disposition is cleared once drained, so a later submit does not delete again', () => {
      store.removeMinionDraft(store.minionDrafts()[0].localKey);
      submitPhaseOne();

      sent.length = 0;
      submitPhaseOne();

      expect(sent.filter((call) => call.startsWith('minion.delete'))).toEqual([]);
    });
  });

  // The payloads `submitPhase1` actually builds, spelled out rather than probed, so a field dropped
  // in hydration fails as a diff instead of as a silently narrower object.
  function monsterRequest(name = 'Maestro Vey'): string {
    return JSON.stringify({
      name,
      description: 'A conductor of drowned voices.',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
  }

  function minionRequest(): string {
    return JSON.stringify({
      name: 'Choir Thrall',
      description: null,
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
  }
});
