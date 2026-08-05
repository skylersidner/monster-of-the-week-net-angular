import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

describe('MysteryCreateStore', () => {
  let store: MysteryCreateStore;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notificationService: { success: ReturnType<typeof vi.fn> };
  let mysteryService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsertCountdown: ReturnType<typeof vi.fn>;
  };
  let monsterService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createAttack: ReturnType<typeof vi.fn>;
    assignAttackWeaponTag: ReturnType<typeof vi.fn>;
    createPower: ReturnType<typeof vi.fn>;
    createWeakness: ReturnType<typeof vi.fn>;
    createArmor: ReturnType<typeof vi.fn>;
    deleteAttack: ReturnType<typeof vi.fn>;
    deletePower: ReturnType<typeof vi.fn>;
    deleteWeakness: ReturnType<typeof vi.fn>;
    deleteArmor: ReturnType<typeof vi.fn>;
  };
  let minionService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createAttack: ReturnType<typeof vi.fn>;
    deleteAttack: ReturnType<typeof vi.fn>;
    deletePower: ReturnType<typeof vi.fn>;
    deleteWeakness: ReturnType<typeof vi.fn>;
    deleteArmor: ReturnType<typeof vi.fn>;
  };
  let locationService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    unlinkFromMystery: ReturnType<typeof vi.fn>;
  };
  let bystanderService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    unlinkFromMystery: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    router = { navigate: vi.fn() };
    notificationService = { success: vi.fn() };
    mysteryService = {
      create: vi.fn(() => of({ id: 'mystery-1' })),
      update: vi.fn(() => of({ id: 'mystery-1' })),
      upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
    };
    monsterService = {
      create: vi.fn(() => of({ id: 'monster-1' })),
      update: vi.fn(() => of({ id: 'monster-1' })),
      createAttack: vi.fn(() => of({ id: 'attack-1' })),
      assignAttackWeaponTag: vi.fn(() => of({})),
      createPower: vi.fn(() => of({ id: 'power-1' })),
      createWeakness: vi.fn(() => of({ id: 'weakness-1' })),
      createArmor: vi.fn(() => of({ id: 'armor-1' })),
      deleteAttack: vi.fn(() => of(undefined)),
      deletePower: vi.fn(() => of(undefined)),
      deleteWeakness: vi.fn(() => of(undefined)),
      deleteArmor: vi.fn(() => of(undefined)),
    };
    minionService = {
      create: vi.fn(() => of({ id: 'minion-1' })),
      update: vi.fn(() => of({ id: 'minion-1' })),
      createAttack: vi.fn(() => of({ id: 'minion-attack-1' })),
      deleteAttack: vi.fn(() => of(undefined)),
      deletePower: vi.fn(() => of(undefined)),
      deleteWeakness: vi.fn(() => of(undefined)),
      deleteArmor: vi.fn(() => of(undefined)),
    };
    locationService = {
      create: vi.fn(() => of({ id: 'location-1' })),
      update: vi.fn(() => of({ id: 'location-1' })),
      unlinkFromMystery: vi.fn(() => of(undefined)),
    };
    bystanderService = {
      create: vi.fn(() => of({ id: 'bystander-1' })),
      update: vi.fn(() => of({ id: 'bystander-1' })),
      unlinkFromMystery: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
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

    expect(store.monsterAttacks()).toEqual([{ name: 'Claw Swipe', harm: 2, description: '', weaponTagIds: ['weapon-tag-1'] }]);
    expect(store.minionAttacks()).toEqual([{ name: 'Rusty Knife', harm: 1, description: '', weaponTagIds: [] }]);
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

    store.minionForm.setValue({
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
    store.addLocation();
    store.next();

    store.addBystanderForm.setValue({
      name: 'Father Hall',
      description: 'Last priest on site.',
      bystanderTypeId: 'bystander-type-1',
    });
    store.addBystander();
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
    store.currentStep.set(3);
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
    store.minionForm.setValue({
      name: 'Choir Thrall',
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.currentStep.set(1);
    store.next();

    store.addLocationForm.setValue({ name: 'Saint Brigid Chapel', description: '', locationTypeId: 'location-type-1' });
    store.addLocation();
    store.next();

    expect(store.locations()[0].id).toBe('location-1');

    // Walk backward through the tracker and submit each completed phase a second time.
    store.jumpToPhase(0);
    store.currentStep.set(3);
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
    expect(monsterService.createPower).toHaveBeenCalledTimes(2);
    expect(monsterService.deletePower).toHaveBeenCalledWith('monster-1', 'power-1');
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
    store.currentStep.set(3);
    store.next();

    store.currentPhase.set(2);
    store.currentStep.set(0);
    store.addLocationForm.setValue({ name: 'Saint Brigid Chapel', description: '', locationTypeId: 'location-type-1' });
    store.addLocation();
    store.next();

    store.jumpToPhase(2);
    store.removeLocation(0);
    store.next();

    expect(locationService.unlinkFromMystery).toHaveBeenCalledWith('mystery-1', 'location-1');
    expect(locationService.create).toHaveBeenCalledTimes(1);
  });

  it('requires a minion name only once the minion section has been started', () => {
    store.currentPhase.set(1);
    store.currentStep.set(1);

    expect(store.minionSectionStarted()).toBe(false);
    expect(store.minionNameRequired()).toBe(false);
    expect(store.minionNameMissing()).toBe(false);

    store.minionForm.controls.minionTypeId.setValue('minion-type-1');

    expect(store.minionSectionStarted()).toBe(true);
    expect(store.minionNameMissing()).toBe(true);

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(store.currentStep()).toBe(1);
    expect(store.minionForm.controls.name.touched).toBe(true);
    expect(minionService.create).not.toHaveBeenCalled();

    store.minionForm.controls.name.setValue('Choir Thrall');

    expect(store.minionNameMissing()).toBe(false);
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
      { name: 'Thick Hide', description: 'Tough skin', harmSoak: 2, isSpecial: false, specialDescription: '' },
    ]);
    expect(store.minionArmors()).toEqual([
      { name: 'Leather Vest', description: '', harmSoak: 1, isSpecial: true, specialDescription: 'Only protects vital organs' },
    ]);

    store.removeMonsterArmor(0);
    expect(store.monsterArmors()).toEqual([]);
    expect(store.minionArmors()).toEqual([
      { name: 'Leather Vest', description: '', harmSoak: 1, isSpecial: true, specialDescription: 'Only protects vital organs' },
    ]);
  });

  it('includes armor drafts in the submission collections', () => {
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

    const draftState = store.draftState();
    
    expect(draftState.collections.monsterArmors).toEqual([
      { name: 'Steel Plates', description: 'Reinforced armor', harmSoak: 3, isSpecial: false, specialDescription: '' },
    ]);
    expect(draftState.collections.minionArmors).toEqual([
      { name: 'Leather Vest', description: '', harmSoak: 1, isSpecial: true, specialDescription: 'Only vital organs' },
    ]);
  });
});
