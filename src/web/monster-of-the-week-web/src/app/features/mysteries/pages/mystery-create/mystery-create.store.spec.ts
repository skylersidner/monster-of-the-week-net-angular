import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * The attach strips' catalogues. `location-1` / `bystander-1` deliberately match the ids the
 * create mocks hand back, so a draft authored here and one attached from the catalogue are the same
 * entity — which is what makes the "re-attach cancels a pending removal" case expressible.
 */
const catalogLocations = [
  {
    id: 'location-1',
    mysteryIds: ['mystery-1', 'mystery-9'],
    name: 'Saint Brigid Chapel',
    description: 'Dusty pews.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'location-2',
    mysteryIds: [],
    name: 'The Old Mill',
    description: '',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const catalogBystanders = [
  {
    id: 'bystander-1',
    mysteryIds: ['mystery-1'],
    name: 'Father Hall',
    description: 'Last priest on site.',
    bystanderTypeId: 'bystander-type-1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const catalogMysteries = [
  {
    id: 'mystery-1',
    name: 'The Hollow Choir',
    concept: null,
    hook: null,
    adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mystery-9',
    name: 'Dust Bowl Nights',
    concept: null,
    hook: null,
    adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('MysteryCreateStore', () => {
  let store: MysteryCreateStore;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notificationService: { success: ReturnType<typeof vi.fn> };
  let mysteryService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsertCountdown: ReturnType<typeof vi.fn>;
    getMysteries: ReturnType<typeof vi.fn>;
  };
  /**
   * Every sub-resource verb the 5a diff can reach, monster and minion alike.
   *
   * Declared as one alias rather than listed twice because a *missing* double is the failure mode
   * that matters: the diff calls `updatePower` on a changed row, and a stub without it throws a
   * `TypeError` inside the rxjs chain, which the store swallows into a generic submit error. The
   * test then fails on some unrelated later assertion and points at the wrong thing.
   */
  type SubResourceMocks = Record<
    | 'createAttack'
    | 'updateAttack'
    | 'deleteAttack'
    | 'assignAttackWeaponTag'
    | 'removeAttackWeaponTag'
    | 'createPower'
    | 'updatePower'
    | 'deletePower'
    | 'createWeakness'
    | 'updateWeakness'
    | 'deleteWeakness'
    | 'createArmor'
    | 'updateArmor'
    | 'deleteArmor',
    ReturnType<typeof vi.fn>
  >;

  let monsterService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    linkToMystery: ReturnType<typeof vi.fn>;
    unlinkFromMystery: ReturnType<typeof vi.fn>;
  } & SubResourceMocks;
  let minionService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    moveToMonster: ReturnType<typeof vi.fn>;
  } & SubResourceMocks;
  let locationService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    unlinkFromMystery: ReturnType<typeof vi.fn>;
    linkToMystery: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let bystanderService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    unlinkFromMystery: ReturnType<typeof vi.fn>;
    linkToMystery: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    router = { navigate: vi.fn() };
    notificationService = { success: vi.fn() };
    mysteryService = {
      create: vi.fn(() => of({ id: 'mystery-1' })),
      update: vi.fn(() => of({ id: 'mystery-1' })),
      upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
      getMysteries: vi.fn(() => of(catalogMysteries)),
    };
    /**
     * **The sub-resource doubles echo the request back.** Before 5a they returned a bare `{ id }`,
     * which was enough when every submit deleted and recreated the lot. The diff compares a draft
     * against the response that became its baseline, so a response with no `name` reads as "changed"
     * on the next pass and the double would manufacture the exact churn 5a exists to remove.
     */
    const echo = (id: string) => vi.fn((_ownerId: string, request: unknown) => of({ id, weaponTags: [], ...(request as object) }));
    const echoUpdate = (id: string) =>
      vi.fn((_ownerId: string, _id: string, request: unknown) => of({ id, weaponTags: [], ...(request as object) }));

    monsterService = {
      getAll: vi.fn(() => of([])),
      create: vi.fn(() => of({ id: 'monster-1' })),
      update: vi.fn(() => of({ id: 'monster-1' })),
      delete: vi.fn(() => of(undefined)),
      linkToMystery: vi.fn(() => of(undefined)),
      unlinkFromMystery: vi.fn(() => of(undefined)),
      createAttack: echo('attack-1'),
      updateAttack: echoUpdate('attack-1'),
      assignAttackWeaponTag: vi.fn(() => of({})),
      removeAttackWeaponTag: vi.fn(() => of(undefined)),
      createPower: echo('power-1'),
      updatePower: echoUpdate('power-1'),
      createWeakness: echo('weakness-1'),
      updateWeakness: echoUpdate('weakness-1'),
      createArmor: echo('armor-1'),
      updateArmor: echoUpdate('armor-1'),
      deleteAttack: vi.fn(() => of(undefined)),
      deletePower: vi.fn(() => of(undefined)),
      deleteWeakness: vi.fn(() => of(undefined)),
      deleteArmor: vi.fn(() => of(undefined)),
    };
    minionService = {
      create: vi.fn(() => of({ id: 'minion-1' })),
      update: vi.fn(() => of({ id: 'minion-1' })),
      delete: vi.fn(() => of(undefined)),
      moveToMonster: vi.fn(() => of(undefined)),
      createAttack: echo('minion-attack-1'),
      updateAttack: echoUpdate('minion-attack-1'),
      assignAttackWeaponTag: vi.fn(() => of({})),
      removeAttackWeaponTag: vi.fn(() => of(undefined)),
      createPower: echo('minion-power-1'),
      updatePower: echoUpdate('minion-power-1'),
      createWeakness: echo('minion-weakness-1'),
      updateWeakness: echoUpdate('minion-weakness-1'),
      createArmor: echo('minion-armor-1'),
      updateArmor: echoUpdate('minion-armor-1'),
      deleteAttack: vi.fn(() => of(undefined)),
      deletePower: vi.fn(() => of(undefined)),
      deleteWeakness: vi.fn(() => of(undefined)),
      deleteArmor: vi.fn(() => of(undefined)),
    };
    locationService = {
      create: vi.fn(() => of({ id: 'location-1' })),
      update: vi.fn(() => of({ id: 'location-1' })),
      unlinkFromMystery: vi.fn(() => of(undefined)),
      linkToMystery: vi.fn(() => of(undefined)),
      delete: vi.fn(() => of(undefined)),
      getAll: vi.fn(() => of(catalogLocations)),
    };
    bystanderService = {
      create: vi.fn(() => of({ id: 'bystander-1' })),
      update: vi.fn(() => of({ id: 'bystander-1' })),
      unlinkFromMystery: vi.fn(() => of(undefined)),
      linkToMystery: vi.fn(() => of(undefined)),
      delete: vi.fn(() => of(undefined)),
      getAll: vi.fn(() => of(catalogBystanders)),
    };

    TestBed.configureTestingModule({
      providers: [
        /**
         * **F-L9.** `CustomMoveService` is `providedIn: 'root'`, so without this the real one
         * resolves and any stray call becomes a real HTTP request — refused today only because
         * nothing is listening on :5225, and a write against dev the moment something is. This
         * spec drives no custom-move traffic, so the stub says so by throwing.
         */
        {
          provide: CustomMoveService,
          useValue: (() => {
            // Only the service's own four methods. A catch-all `Proxy` refuses `ngOnDestroy()` too,
            // which Angular calls on every provider instance at teardown — 386 tests, one stub.
            const refuse = (method: string) => () => {
              throw new Error(`Unexpected CustomMoveService.${method}() — this spec expects no custom-move traffic.`);
            };
            return { list: refuse('list'), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
        MysteryCreateStore,
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([{ id: 'weapon-tag-1', name: 'Bladed', description: '' }]),
          },
        },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notificationService },
        { provide: MysteryService, useValue: mysteryService },
        { provide: MonsterService, useValue: monsterService },
        { provide: MinionService, useValue: minionService },
        { provide: LocationService, useValue: locationService },
        { provide: BystanderService, useValue: bystanderService },
      ],
    });

    store = TestBed.inject(MysteryCreateStore);
    store.init();
  });

  /** Walks the wizard to phase 1 / step 1 (the minion step) with a saved mystery and a valid monster. */
  function advanceToMinionStep(): void {
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: '', adventureTypeId: 'adventure-type-1' });
    store.currentStep.set(4);
    store.next();

    store.monsterForm.setValue({
      name: 'Maestro Vey',
      description: '',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
    // 5b: `Next` off step 0 commits the composer into the roster. A minion cannot be saved without a
    // monster to belong to, so the roster has to have one before the minion step means anything.
    store.currentStep.set(0);
    store.next();
  }

  function fillComposer(name: string, minionTypeId = 'minion-type-1'): void {
    store.minionForm.patchValue({ name, description: '', harmCapacity: 3, minionTypeId });
  }

  /**
   * The roster is addressed by `localKey` now, not by position. Read the key at a position at the
   * moment the test means it — capturing it *before* a removal is the whole point, and is what
   * makes "the pointer survives the splice" assertable at all.
   */
  function keyAt(index: number): string {
    return store.minionDrafts()[index].localKey;
  }

  it('loads reference data on init', () => {
    expect(store.monsterTypes()).toEqual([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]);
    expect(store.minionTypes()).toEqual([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]);
    expect(store.locationTypes()).toEqual([{ id: 'location-type-1', name: 'Lair', motivation: '' }]);
    expect(store.bystanderTypes()).toEqual([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]);
    expect(store.weaponTags()).toEqual([{ id: 'weapon-tag-1', name: 'Bladed', description: '' }]);
  });

  it('keeps monster and minion draft forms independent', () => {
    store.monsterAttackForm.setValue({ name: 'Claw Swipe', harm: 2, description: '', weaponTagIds: ['weapon-tag-1'] });
    store.addMonsterAttack();

    store.minionAttackForm.setValue({ name: 'Rusty Knife', harm: 1, description: '', weaponTagIds: [] });
    store.addMinionAttack();

    expect(store.monsterAttacks()).toEqual([
      expect.objectContaining({ id: null, name: 'Claw Swipe', harm: 2, description: '', weaponTagIds: ['weapon-tag-1'] }),
    ]);
    expect(store.minionAttacks()).toEqual([
      expect.objectContaining({ id: null, name: 'Rusty Knife', harm: 1, description: '', weaponTagIds: [] }),
    ]);
    expect(store.monsterAttackForm.controls.name.value).toBe('');
    expect(store.minionAttackForm.controls.name.value).toBe('');
  });

  it('submits the full flow and routes to the created mystery', () => {
    store.conceptForm.setValue({
      name: 'The Hollow Choir',
      concept: 'Ghosts drown the choir loft in song.',
      adventureTypeId: 'adventure-type-1',
    });
    store.next();
    store.hookForm.setValue({ hook: 'The hunters are called to a midnight rehearsal.' });
    store.next();
    store.overviewForm.setValue({ overview: 'A dead conductor is using the choir to open a gate.' });
    store.next();
    store.countdownForm.setValue({
      day: 'A new song starts on its own.',
      shadows: '',
      sunset: '',
      dusk: '',
      nightfall: '',
      midnight: 'The gate opens above the chapel.',
    });
    store.next();

    // Step `0-4`, the mystery's own custom moves — left empty here on purpose. An empty collection
    // must still advance, and the diff must still emit (a bare `forkJoin([])` would not), so this
    // walk is where "the new step does not break the old flow" is asserted. The non-empty path has
    // its own spec, because a staged move means real `CustomMoveService` traffic to fake.
    store.next();

    store.monsterForm.setValue({
      name: 'Maestro Vey',
      description: 'A spectral conductor',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
    store.monsterAttackForm.setValue({ name: 'Shattering Note', harm: 3, description: '', weaponTagIds: ['weapon-tag-1'] });
    store.addMonsterAttack();
    store.monsterPowerForm.setValue({ name: 'Shadow Step', description: 'Can slip through darkness' });
    store.addMonsterPower();
    store.monsterWeaknessForm.setValue({ name: 'Silver', description: 'Silver seals the curse' });
    store.addMonsterWeakness();
    store.next();

    store.minionForm.patchValue({
      name: 'Choir Thrall',
      description: 'Possessed singer',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.minionAttackForm.setValue({ name: 'Jagged Hymn', harm: 1, description: '', weaponTagIds: [] });
    store.addMinionAttack();
    store.next();

    store.addLocationForm.setValue({
      name: 'Saint Brigid Chapel',
      description: 'Dusty pews and broken stained glass.',
      locationTypeId: 'location-type-1',
    });
    store.saveLocationDraft();
    store.next();

    store.addBystanderForm.setValue({
      name: 'Father Hall',
      description: 'Last priest on site.',
      bystanderTypeId: 'bystander-type-1',
    });
    store.saveBystanderDraft();
    store.next();

    expect(mysteryService.create).toHaveBeenCalledWith({
      name: 'The Hollow Choir',
      concept: 'Ghosts drown the choir loft in song.',
      hook: 'The hunters are called to a midnight rehearsal.',
      overview: 'A dead conductor is using the choir to open a gate.',
      notes: null,
      adventureTypeId: 'adventure-type-1',
    });
    expect(monsterService.create).toHaveBeenCalledWith('mystery-1', {
      name: 'Maestro Vey',
      description: 'A spectral conductor',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
    expect(monsterService.createPower).toHaveBeenCalledWith('monster-1', {
      name: 'Shadow Step',
      description: 'Can slip through darkness',
    });
    expect(monsterService.createWeakness).toHaveBeenCalledWith('monster-1', {
      name: 'Silver',
      description: 'Silver seals the curse',
    });
    expect(minionService.create).toHaveBeenCalledWith('monster-1', {
      name: 'Choir Thrall',
      description: 'Possessed singer',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    expect(minionService.createAttack).toHaveBeenCalledWith('minion-1', {
      name: 'Jagged Hymn',
      harm: 1,
      description: null,
    });
    expect(monsterService.assignAttackWeaponTag).toHaveBeenCalledWith('monster-1', 'attack-1', 'weapon-tag-1');
    expect(locationService.create).toHaveBeenCalledWith('mystery-1', {
      name: 'Saint Brigid Chapel',
      description: 'Dusty pews and broken stained glass.',
      locationTypeId: 'location-type-1',
    });
    expect(bystanderService.create).toHaveBeenCalledWith('mystery-1', {
      name: 'Father Hall',
      description: 'Last priest on site.',
      bystanderTypeId: 'bystander-type-1',
    });
    expect(notificationService.success).toHaveBeenCalledWith('Mystery created!');
    expect(router.navigate).toHaveBeenCalledWith(['/mysteries', 'mystery-1']);
  });

  it('updates instead of duplicating when completed phases are revisited', () => {
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: '', adventureTypeId: 'adventure-type-1' });
    store.currentStep.set(4);
    store.next();

    store.monsterForm.setValue({
      name: 'Maestro Vey',
      description: '',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
    store.monsterPowerForm.setValue({ name: 'Shadow Step', description: '' });
    store.addMonsterPower();
    // 5b: step 0's Next commits the composer into the roster; step 1's submits the phase.
    store.next();
    store.minionForm.patchValue({
      name: 'Choir Thrall',
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.next();

    store.addLocationForm.setValue({ name: 'Saint Brigid Chapel', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    store.next();

    expect(store.locations()[0].id).toBe('location-1');

    // Walk backward through the tracker and submit each completed phase a second time.
    store.jumpToPhase(0);
    store.currentStep.set(4);
    store.next();

    store.jumpToPhase(1);
    store.currentStep.set(1);
    store.next();

    store.jumpToPhase(2);
    store.next();

    expect(mysteryService.create).toHaveBeenCalledTimes(1);
    expect(mysteryService.update).toHaveBeenCalledTimes(1);
    expect(monsterService.create).toHaveBeenCalledTimes(1);
    expect(monsterService.update).toHaveBeenCalledTimes(1);
    expect(minionService.create).toHaveBeenCalledTimes(1);
    expect(minionService.update).toHaveBeenCalledTimes(1);
    // **5a: the untouched power costs nothing on the revisit.** This used to assert two creates
    // and a delete — the delete-all/recreate-all cycle, which rotated the row's id on every phase
    // transition. One create, no update (the values match the baseline), no delete.
    expect(monsterService.createPower).toHaveBeenCalledTimes(1);
    expect(monsterService.updatePower).not.toHaveBeenCalled();
    expect(monsterService.deletePower).not.toHaveBeenCalled();
    expect(store.monsterDrafts()[0].powers[0].id).toBe('power-1');
    expect(locationService.create).toHaveBeenCalledTimes(1);
    expect(locationService.update).toHaveBeenCalledWith('location-1', {
      name: 'Saint Brigid Chapel',
      description: null,
      locationTypeId: 'location-type-1',
    });
    expect(locationService.unlinkFromMystery).not.toHaveBeenCalled();
  });

  it('unlinks a location that was removed after it had been saved', () => {
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: '', adventureTypeId: 'adventure-type-1' });
    store.currentStep.set(4);
    store.next();

    store.currentPhase.set(2);
    store.currentStep.set(0);
    store.addLocationForm.setValue({ name: 'Saint Brigid Chapel', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
    store.next();

    store.jumpToPhase(2);
    store.removeLocationDraft(store.locations()[0].localKey, 'detach');
    store.next();

    expect(locationService.unlinkFromMystery).toHaveBeenCalledWith('mystery-1', 'location-1');
    expect(locationService.create).toHaveBeenCalledTimes(1);
  });

  it('advances past the minion step with an empty composer and creates nothing', () => {
    advanceToMinionStep();

    expect(store.minionComposerDirty()).toBe(false);

    store.next();

    expect(store.currentPhase()).toBe(2);
    expect(store.minionDrafts()).toEqual([]);
    expect(minionService.create).not.toHaveBeenCalled();
  });

  it('auto-commits a valid open composer on Next and submits it in the same tick', () => {
    advanceToMinionStep();
    fillComposer('Choir Thrall');

    expect(store.minionDrafts()).toHaveLength(0);

    store.next();

    // The commit must be visible to submitPhase1 synchronously, not deferred into its pipe.
    expect(store.minionDrafts()).toHaveLength(1);
    expect(store.minionDrafts()[0].id).toBe('minion-1');
    expect(minionService.create).toHaveBeenCalledWith('monster-1', {
      name: 'Choir Thrall',
      description: null,
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    expect(store.currentPhase()).toBe(2);
  });

  it('blocks Next when the composer has a name but no type', () => {
    advanceToMinionStep();
    store.minionForm.controls.name.setValue('Choir Thrall');

    expect(store.minionComposerDirty()).toBe(true);
    expect(store.minionComposerValid()).toBe(false);

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(store.currentStep()).toBe(1);
    expect(store.minionForm.controls.name.touched).toBe(true);
    expect(store.submitError()).toBe("Finish or clear the minion you're editing before continuing.");
    expect(minionService.create).not.toHaveBeenCalled();
  });

  it('blocks Next when the composer holds sub-resources but no name', () => {
    advanceToMinionStep();
    store.minionAttackForm.setValue({ name: 'Jagged Hymn', harm: 1, description: '', weaponTagIds: [] });
    store.addMinionAttack();

    expect(store.minionComposerDirty()).toBe(true);
    expect(store.minionComposerValid()).toBe(false);

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(store.minionAttacks()).toHaveLength(1);
    expect(minionService.create).not.toHaveBeenCalled();
  });

  it('blocks Next when only harm capacity was touched', () => {
    // The widened dirty-check (SS1.3, approved 2026-09-01) is deliberately stricter than the old
    // one: harm capacity defaults to 3, so moving it off the default alone counts as started work.
    advanceToMinionStep();
    store.minionForm.controls.harmCapacity.setValue(5);

    expect(store.minionComposerDirty()).toBe(true);

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(minionService.create).not.toHaveBeenCalled();
  });

  it('lights the minion step-tracker dot from the roster, not the composer', () => {
    advanceToMinionStep();

    fillComposer('Choir Thrall');
    expect(store.phaseStepComplete()[1][1]).toBe(false);

    store.saveMinionDraftToList();
    expect(store.phaseStepComplete()[1][1]).toBe(true);
  });

  it('opens the composer only when the roster is empty or the user asks for it', () => {
    advanceToMinionStep();

    expect(store.minionComposerOpen()).toBe(true);

    fillComposer('Alpha');
    store.saveMinionDraftToList();
    expect(store.minionComposerOpen()).toBe(false);
    expect(store.editingMinionKey()).toBeNull();

    // "Collapsed" and "open on a blank new draft" both have editingMinionKey() === null.
    store.startNewMinionDraft();
    expect(store.minionComposerOpen()).toBe(true);
    expect(store.editingMinionKey()).toBeNull();

    store.editMinionDraft(keyAt(0));
    expect(store.minionComposerOpen()).toBe(true);
    expect(store.editingMinionKey()).toBe(keyAt(0));

    store.cancelComposerEdit();
    expect(store.minionComposerOpen()).toBe(false);
  });

  it('round-trips a roster draft through the composer, sub-resources included', () => {
    advanceToMinionStep();

    fillComposer('Choir Thrall');
    store.minionAttackForm.setValue({ name: 'Jagged Hymn', harm: 1, description: '', weaponTagIds: [] });
    store.addMinionAttack();
    store.minionArmorForm.setValue({
      name: 'Robes',
      description: '',
      harmSoak: 1,
      isSpecial: false,
      specialDescription: '',
    });
    store.addMinionArmor();
    store.saveMinionDraftToList();

    expect(store.minionAttacks()).toEqual([]);

    store.editMinionDraft(keyAt(0));

    expect(store.minionForm.controls.name.value).toBe('Choir Thrall');
    expect(store.minionForm.controls.minionTypeId.value).toBe('minion-type-1');
    expect(store.minionAttacks()).toEqual([
      expect.objectContaining({ id: null, name: 'Jagged Hymn', harm: 1, description: '', weaponTagIds: [] }),
    ]);
    expect(store.minionArmors()).toHaveLength(1);

    store.minionForm.controls.description.setValue('Possessed singer');
    store.saveMinionDraftToList();

    expect(store.minionDrafts()).toHaveLength(1);
    expect(store.minionDrafts()[0].description).toBe('Possessed singer');
    expect(store.minionDrafts()[0].attacks).toHaveLength(1);
  });

  it('creates every roster minion with its own sub-resources', () => {
    minionService.create = vi.fn((_monsterId: string, request: { name: string }) =>
      of({ id: 'minion-' + request.name.toLowerCase() })
    );

    advanceToMinionStep();

    fillComposer('Alpha');
    store.minionPowerForm.setValue({ name: 'Howl', description: '' });
    store.addMinionPower();
    store.saveMinionDraftToList();

    store.startNewMinionDraft();
    fillComposer('Beta');
    store.minionWeaknessForm.setValue({ name: 'Salt', description: '' });
    store.addMinionWeakness();
    store.saveMinionDraftToList();

    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Alpha', 'Beta']);

    store.next();

    expect(minionService.create).toHaveBeenCalledTimes(2);
    expect(minionService.createPower).toHaveBeenCalledTimes(1);
    expect(minionService.createPower).toHaveBeenCalledWith('minion-alpha', { name: 'Howl', description: null });
    expect(minionService.createWeakness).toHaveBeenCalledTimes(1);
    expect(minionService.createWeakness).toHaveBeenCalledWith('minion-beta', { name: 'Salt', description: null });
    expect(store.minionDrafts().map((draft) => draft.id)).toEqual(['minion-alpha', 'minion-beta']);
  });

  it('hard-deletes a previously saved minion that was removed before the next submit', () => {
    advanceToMinionStep();
    fillComposer('Choir Thrall');
    store.next();

    expect(minionService.create).toHaveBeenCalledTimes(1);

    store.jumpToPhase(1);
    store.currentStep.set(1);
    store.removeMinionDraft(keyAt(0));
    store.next();

    expect(minionService.delete).toHaveBeenCalledWith('minion-1');
    expect(minionService.update).not.toHaveBeenCalled();
    expect(minionService.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the composer pointed at the same minion when an earlier roster card is removed', () => {
    // SS1.5(2). The hazard is unchanged and is still what this test protects: remove a card that
    // sits *before* the one being edited, and the next save must still write to the card the user
    // is looking at, not to a bystander.
    //
    // What changed is the mechanism. `editingMinionKey` is an identity rather than a position, so
    // the splice cannot invalidate it and `removeMinionDraft` no longer has to decrement anything.
    // The assertion is therefore "the pointer is *the same value* afterwards", where it used to be
    // "the pointer was correctly adjusted".
    advanceToMinionStep();

    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      store.startNewMinionDraft();
      fillComposer(name);
      store.saveMinionDraftToList();
    }

    const alphaKey = keyAt(0);
    const gammaKey = keyAt(2);

    store.editMinionDraft(gammaKey);
    expect(store.editingMinionKey()).toBe(gammaKey);

    store.removeMinionDraft(alphaKey);

    expect(store.editingMinionKey()).toBe(gammaKey);
    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Beta', 'Gamma']);
    // Gamma has moved from index 2 to index 1 and its key has not moved at all.
    expect(keyAt(1)).toBe(gammaKey);

    store.minionForm.controls.description.setValue('Edited in place');
    store.saveMinionDraftToList();

    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Beta', 'Gamma']);
    expect(store.minionDrafts()[1].description).toBe('Edited in place');
    expect(store.minionDrafts()[0].description).toBe('');
  });

  it('mints a key for every minion hydrated from an existing mystery, not just for authored ones', () => {
    // Edit mode is the other way drafts get onto the roster, and a hydrated draft with no key would
    // give `@for` duplicate track values and leave the pencil unable to address a row at all. One
    // addressing scheme, whichever door the card came in through.
    const minions = [
      { id: 'minion-a', name: 'Alpha' },
      { id: 'minion-b', name: 'Beta' },
    ];
    const detail = (id: string, name: string) => ({
      id,
      name,
      description: null,
      harmCapacity: 3,
      minionType: { id: 'minion-type-1', name: 'Cultist', motivation: '' },
      attacks: [],
      powers: [],
      weaknesses: [],
      armors: [],
      customMoves: [],
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        /**
         * **F-L9.** `CustomMoveService` is `providedIn: 'root'`, so without this the real one
         * resolves and any stray call becomes a real HTTP request — refused today only because
         * nothing is listening on :5225, and a write against dev the moment something is. This
         * spec drives no custom-move traffic, so the stub says so by throwing.
         */
        {
          provide: CustomMoveService,
          useValue: (() => {
            // Only the service's own four methods. A catch-all `Proxy` refuses `ngOnDestroy()` too,
            // which Angular calls on every provider instance at teardown — 386 tests, one stub.
            const refuse = (method: string) => () => {
              throw new Error(`Unexpected CustomMoveService.${method}() — this spec expects no custom-move traffic.`);
            };
            return { list: refuse('list'), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
        MysteryCreateStore,
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([{ id: 'weapon-tag-1', name: 'Bladed', description: '' }]),
          },
        },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notificationService },
        {
          provide: MysteryService,
          useValue: {
            ...mysteryService,
            getMystery: () =>
              of({
                id: 'mystery-1',
                name: 'The Hollow Choir',
                concept: null,
                hook: null,
                overview: null,
                adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
                countdown: null,
                customMoves: [],
              }),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            ...monsterService,
            linkToMystery: () => of(undefined),
            unlinkFromMystery: () => of(undefined),
            getByMystery: () => of([{ id: 'monster-1' }]),
            getById: () =>
              of({
                id: 'monster-1',
                name: 'Maestro Vey',
                description: null,
                harmCapacity: 8,
                monsterTypeId: 'monster-type-1',
                monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
                attacks: [],
                powers: [],
                weaknesses: [],
                armors: [],
                customMoves: [],
              }),
          },
        },
        {
          provide: MinionService,
          useValue: {
            ...minionService,
            moveToMonster: () => of(undefined),
            getByMonster: () => of(minions),
            getById: (id: string) => of(detail(id, minions.find((m) => m.id === id)!.name)),
          },
        },
        { provide: LocationService, useValue: { ...locationService, getByMystery: () => of([]) } },
        { provide: BystanderService, useValue: { ...bystanderService, getByMystery: () => of([]) } },
      ],
    });

    const editStore = TestBed.inject(MysteryCreateStore);
    editStore.init('mystery-1');

    const keys = editStore.minionDrafts().map((draft) => draft.localKey);
    expect(editStore.minionDrafts().map((draft) => draft.name)).toEqual(['Alpha', 'Beta']);
    expect(keys.every((key) => key.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(2);

    // And the keys address the roster: the pencil works on a hydrated card.
    expect(editStore.editMinionDraft(keys[1])).toBe(true);
    expect(editStore.editingMinionKey()).toBe(keys[1]);
    expect(editStore.minionForm.controls.name.value).toBe('Beta');
  });

  it('gives every roster card a distinct key that survives an edit round trip', () => {
    advanceToMinionStep();

    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      store.startNewMinionDraft();
      fillComposer(name);
      store.saveMinionDraftToList();
    }

    const keys = store.minionDrafts().map((draft) => draft.localKey);
    expect(new Set(keys).size).toBe(3);

    // Editing a card and saving it back must reuse its key, or `@for` would treat the row as a
    // different row and the composer pointer would dangle mid-edit.
    store.editMinionDraft(keys[1]);
    store.minionForm.controls.description.setValue('Rewritten');
    store.saveMinionDraftToList();

    expect(store.minionDrafts().map((draft) => draft.localKey)).toEqual(keys);
    expect(store.minionDrafts()[1].description).toBe('Rewritten');
  });

  it('makes the pencil and + Add Another Minion no-ops while the composer is invalid', () => {
    // commitComposerIfValid() has three call sites, and all three must abort the same way.
    advanceToMinionStep();
    fillComposer('Alpha');
    store.saveMinionDraftToList();

    store.startNewMinionDraft();
    store.minionForm.controls.description.setValue('Half-typed second minion');

    store.editMinionDraft(keyAt(0));
    expect(store.editingMinionKey()).toBeNull();
    expect(store.minionForm.controls.description.value).toBe('Half-typed second minion');
    expect(store.submitError()).toBe("Finish or clear the minion you're editing before continuing.");

    store.startNewMinionDraft();
    expect(store.minionForm.controls.description.value).toBe('Half-typed second minion');
    expect(store.minionDrafts()).toHaveLength(1);
  });

  it('clears the composer when the roster card being edited is removed', () => {
    advanceToMinionStep();

    for (const name of ['Alpha', 'Beta']) {
      store.startNewMinionDraft();
      fillComposer(name);
      store.saveMinionDraftToList();
    }

    const betaKey = keyAt(1);
    store.editMinionDraft(betaKey);
    store.removeMinionDraft(betaKey);

    expect(store.editingMinionKey()).toBeNull();
    expect(store.minionForm.controls.name.value).toBe('');
    expect(store.minionForm.controls.harmCapacity.value).toBe(3);
    expect(store.minionComposerOpen()).toBe(false);
    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Alpha']);
  });

  it('leaves the composer pointer alone when a card after it is removed', () => {
    advanceToMinionStep();

    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      store.startNewMinionDraft();
      fillComposer(name);
      store.saveMinionDraftToList();
    }

    const alphaKey = keyAt(0);
    store.editMinionDraft(alphaKey);
    store.removeMinionDraft(keyAt(2));

    expect(store.editingMinionKey()).toBe(alphaKey);
    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Alpha', 'Beta']);
  });

  it('ignores a removal for a key that is not on the roster', () => {
    advanceToMinionStep();

    for (const name of ['Alpha', 'Beta']) {
      store.startNewMinionDraft();
      fillComposer(name);
      store.saveMinionDraftToList();
    }

    const alphaKey = keyAt(0);
    store.editMinionDraft(alphaKey);

    store.removeMinionDraft('minion-does-not-exist');

    expect(store.minionDrafts().map((draft) => draft.name)).toEqual(['Alpha', 'Beta']);
    expect(store.editingMinionKey()).toBe(alphaKey);
  });

  it('refuses to load a roster card whose key is unknown, and says so to its caller', () => {
    advanceToMinionStep();
    fillComposer('Alpha');
    store.saveMinionDraftToList();

    expect(store.editMinionDraft('minion-does-not-exist')).toBe(false);
    expect(store.editingMinionKey()).toBeNull();
  });

  it('adds and removes armor drafts independently for monster and minion', () => {
    store.monsterArmorForm.setValue({
      name: 'Thick Hide',
      description: 'Tough skin',
      harmSoak: 2,
      isSpecial: false,
      specialDescription: '',
    });
    store.addMonsterArmor();

    store.minionArmorForm.setValue({
      name: 'Leather Vest',
      description: '',
      harmSoak: 1,
      isSpecial: true,
      specialDescription: 'Only protects vital organs',
    });
    store.addMinionArmor();

    expect(store.monsterArmors()).toEqual([
      expect.objectContaining({
        id: null,
        name: 'Thick Hide',
        description: 'Tough skin',
        harmSoak: 2,
        isSpecial: false,
        specialDescription: '',
      }),
    ]);
    expect(store.minionArmors()).toEqual([
      expect.objectContaining({
        id: null,
        name: 'Leather Vest',
        description: '',
        harmSoak: 1,
        isSpecial: true,
        specialDescription: 'Only protects vital organs',
      }),
    ]);

    // Addressed by key, not index (5a). The index was standing in for identity.
    store.removeMonsterArmor(store.monsterArmors()[0].localKey);
    expect(store.monsterArmors()).toEqual([]);
    expect(store.minionArmors()).toEqual([
      expect.objectContaining({ name: 'Leather Vest', harmSoak: 1, isSpecial: true }),
    ]);
  });

  it('keeps monster and minion armor drafts in their own collections', () => {
    store.monsterArmorForm.setValue({
      name: 'Steel Plates',
      description: 'Reinforced armor',
      harmSoak: 3,
      isSpecial: false,
      specialDescription: '',
    });
    store.addMonsterArmor();

    store.minionArmorForm.setValue({
      name: 'Leather Vest',
      description: '',
      harmSoak: 1,
      isSpecial: true,
      specialDescription: 'Only vital organs',
    });
    store.addMinionArmor();

    expect(store.monsterArmors()).toEqual([
      expect.objectContaining({ name: 'Steel Plates', harmSoak: 3, specialDescription: '' }),
    ]);
    expect(store.minionArmors()).toEqual([
      expect.objectContaining({ name: 'Leather Vest', harmSoak: 1, specialDescription: 'Only vital organs' }),
    ]);
    expect(store.minionDrafts()).toEqual([]);
    expect(store.minionComposerOpen()).toBe(true);
    expect(store.editingMinionKey()).toBeNull();
  });
});
