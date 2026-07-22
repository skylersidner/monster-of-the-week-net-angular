import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
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
    upsertCountdown: ReturnType<typeof vi.fn>;
  };
  let monsterService: {
    create: ReturnType<typeof vi.fn>;
    createAttack: ReturnType<typeof vi.fn>;
    assignAttackWeaponTag: ReturnType<typeof vi.fn>;
    createPower: ReturnType<typeof vi.fn>;
    createWeakness: ReturnType<typeof vi.fn>;
  };
  let apiService: {
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    router = { navigate: vi.fn() };
    notificationService = { success: vi.fn() };
    mysteryService = {
      create: vi.fn(() => of({ id: 'mystery-1' })),
      upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
    };
    monsterService = {
      create: vi.fn()
        .mockReturnValueOnce(of({ id: 'monster-1' }))
        .mockReturnValueOnce(of({ id: 'minion-1' })),
      createAttack: vi.fn(() => of({ id: 'attack-1' })),
      assignAttackWeaponTag: vi.fn(() => of({})),
      createPower: vi.fn(() => of({ id: 'power-1' })),
      createWeakness: vi.fn(() => of({ id: 'weakness-1' })),
    };
    apiService = {
      post: vi.fn(() => of({})),
    };

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        {
          provide: ReferenceDataService,
          useValue: {
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
        { provide: ApiService, useValue: apiService },
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
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: 'Ghosts drown the choir loft in song.' });
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
    });
    expect(monsterService.create).toHaveBeenNthCalledWith(1, 'mystery-1', {
      name: 'Maestro Vey',
      description: 'A spectral conductor',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      minionTypeId: null,
    });
    expect(monsterService.createPower).toHaveBeenCalledWith('monster-1', {
      name: 'Shadow Step',
      description: 'Can slip through darkness',
    });
    expect(monsterService.createWeakness).toHaveBeenCalledWith('monster-1', {
      name: 'Silver',
      description: 'Silver seals the curse',
    });
    expect(monsterService.create).toHaveBeenNthCalledWith(2, 'mystery-1', {
      name: 'Choir Thrall',
      description: 'Possessed singer',
      harmCapacity: 3,
      monsterTypeId: null,
      minionTypeId: 'minion-type-1',
    });
    expect(monsterService.assignAttackWeaponTag).toHaveBeenCalledWith('monster-1', 'attack-1', 'weapon-tag-1');
    expect(apiService.post).toHaveBeenCalledWith('/api/mysteries/mystery-1/locations', {
      name: 'Saint Brigid Chapel',
      description: 'Dusty pews and broken stained glass.',
      locationTypeId: 'location-type-1',
    });
    expect(apiService.post).toHaveBeenCalledWith('/api/mysteries/mystery-1/bystanders', {
      name: 'Father Hall',
      description: 'Last priest on site.',
      bystanderTypeId: 'bystander-type-1',
    });
    expect(notificationService.success).toHaveBeenCalledWith('Mystery created!');
    expect(router.navigate).toHaveBeenCalledWith(['/mysteries', 'mystery-1']);
  });
});
