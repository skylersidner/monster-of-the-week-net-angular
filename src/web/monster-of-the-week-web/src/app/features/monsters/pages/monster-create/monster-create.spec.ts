import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  MonsterArchetypeResponse,
  MonsterDetailResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertMonsterArmorRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterRequest,
  UpsertMonsterWeaknessRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MONSTERS_ROUTES } from '../../monsters.routes';
import { MonsterFormComponent } from '../../shared/monster-form/monster-form';
import { MonsterCreateComponent } from './monster-create';

describe('monsters route ordering', () => {
  it('registers the literal "new" route before the ":monsterId" catch-all', () => {
    const paths = MONSTERS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':monsterId'));
  });
});

const monsterTypes: TypeRefResponse[] = [{ id: 'monster-type-1', name: 'Beast', motivation: 'to feed' }];

const monsterArchetypes: MonsterArchetypeResponse[] = [
  { id: 'monster-archetype-1', name: 'Ghost', description: 'A restless spirit.' },
];

const weaponTags: WeaponTagRefResponse[] = [
  { id: 'tag-1', name: 'Messy', description: null },
  { id: 'tag-2', name: 'Forceful', description: null },
];

const mysteries: MysteryListItemResponse[] = [
  {
    id: 'mystery-1',
    name: 'The Fog',
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const createdMonster: MonsterDetailResponse = {
  id: 'new-monster-1',
  mysteryIds: [],
  name: 'Swamp Thing',
  description: null,
  harmCapacity: 4,
  monsterTypeId: 'monster-type-1',
  monsterTypeName: 'Beast',
  monsterArchetype: monsterArchetypes[0],
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

const validPayload: UpsertMonsterRequest = {
  name: 'Swamp Thing',
  description: null,
  harmCapacity: 4,
  monsterTypeId: 'monster-type-1',
  monsterArchetypeId: 'monster-archetype-1',
};

interface RecordedCalls {
  order: string[];
  create: { mysteryId: string; payload: UpsertMonsterRequest }[];
  createStandalone: UpsertMonsterRequest[];
  attacks: { monsterId: string; request: UpsertMonsterAttackRequest }[];
  powers: { monsterId: string; request: UpsertMonsterPowerRequest }[];
  armors: { monsterId: string; request: UpsertMonsterArmorRequest }[];
  weaknesses: { monsterId: string; request: UpsertMonsterWeaknessRequest }[];
  weaponTagAssignments: { monsterId: string; attackId: string; weaponTagId: string }[];
}

describe('MonsterCreateComponent', () => {
  let fixture: ComponentFixture<MonsterCreateComponent>;
  let component: MonsterCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];
  let failSubResources: boolean;

  beforeEach(async () => {
    calls = {
      order: [],
      create: [],
      createStandalone: [],
      attacks: [],
      powers: [],
      armors: [],
      weaknesses: [],
      weaponTagAssignments: [],
    };
    notifications = [];
    navigations = [];
    failSubResources = false;

    await TestBed.configureTestingModule({
      imports: [MonsterCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: MonsterService,
          useValue: {
            create: (mysteryId: string, payload: UpsertMonsterRequest) => {
              calls.order.push('create');
              calls.create.push({ mysteryId, payload });
              return of(createdMonster);
            },
            createStandalone: (payload: UpsertMonsterRequest) => {
              calls.order.push('createStandalone');
              calls.createStandalone.push(payload);
              return of(createdMonster);
            },
            createAttack: (monsterId: string, request: UpsertMonsterAttackRequest) => {
              calls.order.push('createAttack');
              calls.attacks.push({ monsterId, request });
              if (failSubResources) {
                return throwError(() => new Error('boom'));
              }
              return of({ id: `attack-${calls.attacks.length}` });
            },
            assignAttackWeaponTag: (monsterId: string, attackId: string, weaponTagId: string) => {
              calls.order.push('assignAttackWeaponTag');
              calls.weaponTagAssignments.push({ monsterId, attackId, weaponTagId });
              return of({});
            },
            createPower: (monsterId: string, request: UpsertMonsterPowerRequest) => {
              calls.order.push('createPower');
              calls.powers.push({ monsterId, request });
              return of({ id: 'power-1' });
            },
            createArmor: (monsterId: string, request: UpsertMonsterArmorRequest) => {
              calls.order.push('createArmor');
              calls.armors.push({ monsterId, request });
              return of({ id: 'armor-1' });
            },
            createWeakness: (monsterId: string, request: UpsertMonsterWeaknessRequest) => {
              calls.order.push('createWeakness');
              calls.weaknesses.push({ monsterId, request });
              return of({ id: 'weakness-1' });
            },
          },
        },
        {
          provide: MysteryService,
          useValue: { getMysteries: () => of(mysteries) },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getMonsterTypes: () => of(monsterTypes),
            getMonsterArchetypes: () => of(monsterArchetypes),
            getWeaponTags: () => of(weaponTags),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: (message: string) => notifications.push({ kind: 'success', message }),
            error: (message: string) => notifications.push({ kind: 'error', message }),
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((commands: readonly unknown[]) => {
      navigations.push([...commands]);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(MonsterCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): MonsterFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(MonsterFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as MonsterFormComponent;
  }

  function totalServiceCalls(): number {
    return calls.order.length;
  }

  function addOneOfEachDraft(): void {
    component.attackDraftForm.setValue({
      name: '  Claw  ',
      description: '  Rends flesh.  ',
      harm: 3,
      weaponTagIds: ['tag-1', 'tag-2'],
    });
    component.addAttackDraft();

    component.powerDraftForm.setValue({ name: 'Mist Form', description: '  ' });
    component.addPowerDraft();

    component.armorDraftForm.setValue({
      name: 'Bark Hide',
      description: 'Thick bark.',
      harmSoak: 2,
      isSpecial: true,
      specialDescription: 'Only against fire.',
    });
    component.addArmorDraft();

    component.weaknessDraftForm.setValue({ name: 'Fire', description: null });
    component.addWeaknessDraft();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads reference data and mysteries on init', () => {
    expect(component.monsterTypes()).toEqual(monsterTypes);
    expect(component.monsterArchetypes()).toEqual(monsterArchetypes);
    expect(component.weaponTags()).toEqual(weaponTags);
    expect(component.mysteries()).toEqual(mysteries);
  });

  it('renders the shared monster form in create mode with a Create Monster label', () => {
    const instance = sharedForm();
    expect(instance.monster).toBeNull();
    expect(instance.submitLabel).toBe('Create Monster');
  });

  it('adds drafts to local arrays without making any network calls', () => {
    addOneOfEachDraft();

    expect(component.attackDrafts()).toEqual([
      { name: 'Claw', description: 'Rends flesh.', harm: 3, weaponTagIds: ['tag-1', 'tag-2'] },
    ]);
    expect(component.powerDrafts()).toEqual([{ name: 'Mist Form', description: null }]);
    expect(component.armorDrafts()).toEqual([
      {
        name: 'Bark Hide',
        description: 'Thick bark.',
        harmSoak: 2,
        isSpecial: true,
        specialDescription: 'Only against fire.',
      },
    ]);
    expect(component.weaknessDrafts()).toEqual([{ name: 'Fire', description: null }]);

    expect(totalServiceCalls()).toBe(0);
  });

  it('resets each add-form after a draft is added', () => {
    addOneOfEachDraft();

    expect(component.attackDraftForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harm: 0,
      weaponTagIds: [],
    });
    expect(component.powerDraftForm.getRawValue()).toEqual({ name: '', description: '' });
    expect(component.weaknessDraftForm.getRawValue()).toEqual({ name: '', description: '' });
    expect(component.armorDraftForm.getRawValue()).toEqual({
      name: '',
      description: '',
      harmSoak: 0,
      isSpecial: false,
      specialDescription: '',
    });
  });

  it('does not add a draft when the add-form is invalid, and makes no network call', () => {
    component.attackDraftForm.setValue({ name: '   ', description: '', harm: 1, weaponTagIds: [] });
    component.attackDraftForm.controls.name.setValue('');
    component.addAttackDraft();

    expect(component.attackDrafts()).toEqual([]);
    expect(component.attackDraftForm.controls.name.touched).toBe(true);
    expect(totalServiceCalls()).toBe(0);
  });

  it('removing a draft before submit excludes it from the batch', () => {
    component.powerDraftForm.setValue({ name: 'Keep Me', description: null });
    component.addPowerDraft();
    component.powerDraftForm.setValue({ name: 'Drop Me', description: null });
    component.addPowerDraft();

    component.removePowerDraft(1);
    expect(component.powerDrafts()).toEqual([{ name: 'Keep Me', description: null }]);
    expect(totalServiceCalls()).toBe(0);

    component.onCreate(validPayload);

    expect(calls.powers).toEqual([
      { monsterId: 'new-monster-1', request: { name: 'Keep Me', description: null } },
    ]);
  });

  it('creates the monster first, then batches every drafted sub-resource against the new id', () => {
    addOneOfEachDraft();

    component.onCreate(validPayload);

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.order[0]).toBe('createStandalone');

    expect(calls.attacks).toEqual([
      { monsterId: 'new-monster-1', request: { name: 'Claw', description: 'Rends flesh.', harm: 3 } },
    ]);
    expect(calls.powers).toEqual([
      { monsterId: 'new-monster-1', request: { name: 'Mist Form', description: null } },
    ]);
    expect(calls.armors).toEqual([
      {
        monsterId: 'new-monster-1',
        request: {
          name: 'Bark Hide',
          description: 'Thick bark.',
          harmSoak: 2,
          isSpecial: true,
          specialDescription: 'Only against fire.',
        },
      },
    ]);
    expect(calls.weaknesses).toEqual([
      { monsterId: 'new-monster-1', request: { name: 'Fire', description: null } },
    ]);
  });

  it('assigns weapon tags after the drafted attack has been created', () => {
    addOneOfEachDraft();

    component.onCreate(validPayload);

    expect(calls.weaponTagAssignments).toEqual([
      { monsterId: 'new-monster-1', attackId: 'attack-1', weaponTagId: 'tag-1' },
      { monsterId: 'new-monster-1', attackId: 'attack-1', weaponTagId: 'tag-2' },
    ]);
    expect(calls.order.indexOf('createAttack')).toBeLessThan(calls.order.indexOf('assignAttackWeaponTag'));
  });

  it('makes no weapon-tag calls for an attack drafted without tags', () => {
    component.attackDraftForm.setValue({ name: 'Bite', description: null, harm: 1, weaponTagIds: [] });
    component.addAttackDraft();

    component.onCreate(validPayload);

    expect(calls.attacks.length).toBe(1);
    expect(calls.weaponTagAssignments).toEqual([]);
  });

  it('creates and navigates with no sub-resource calls when no drafts were added', () => {
    component.onCreate(validPayload);

    expect(calls.order).toEqual(['createStandalone']);
    expect(navigations).toEqual([['/monsters', 'new-monster-1']]);
    expect(notifications).toEqual([{ kind: 'success', message: 'Monster created.' }]);
  });

  it('uses createStandalone and the top-level detail route when the mystery picker is blank', () => {
    component.onCreate(validPayload);

    expect(calls.create).toEqual([]);
    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/monsters', 'new-monster-1']]);
  });

  it('uses the mystery-scoped create and detail route when a mystery is selected', () => {
    component.mysteryControl.setValue('mystery-1');

    component.onCreate(validPayload);

    expect(calls.createStandalone).toEqual([]);
    expect(calls.create).toEqual([{ mysteryId: 'mystery-1', payload: validPayload }]);
    expect(navigations).toEqual([['/mysteries', 'mystery-1', 'monsters', 'new-monster-1']]);
  });

  it('never reaches onCreate when the shared form is submitted with invalid core fields', () => {
    addOneOfEachDraft();

    const form = fixture.nativeElement.querySelector('app-monster-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(totalServiceCalls()).toBe(0);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.attackDrafts().length).toBe(1);
  });

  it('creates through the shared form output when the core fields are valid', () => {
    const instance = sharedForm();
    instance.monsterForm.setValue({
      name: 'Swamp Thing',
      description: '',
      harmCapacity: 4,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });

    const form = fixture.nativeElement.querySelector('app-monster-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.createStandalone).toEqual([validPayload]);
  });

  it('keeps the user on the page with an inline error when the initial create call fails', () => {
    const monsterService = TestBed.inject(MonsterService);
    vi.spyOn(monsterService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));
    addOneOfEachDraft();

    component.onCreate(validPayload);

    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create monster.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create monster.' }]);
    expect(component.attackDrafts().length).toBe(1);
    expect(component.powerDrafts().length).toBe(1);
    expect(component.armorDrafts().length).toBe(1);
    expect(component.weaknessDrafts().length).toBe(1);
  });

  it('requires specialDescription on the armor draft only while isSpecial is checked', () => {
    const specialDescription = component.armorDraftForm.controls.specialDescription;

    expect(specialDescription.validator).toBeNull();

    component.armorDraftForm.controls.isSpecial.setValue(true);
    specialDescription.setValue('');
    expect(specialDescription.valid).toBe(false);

    component.armorDraftForm.controls.isSpecial.setValue(false);
    expect(specialDescription.valid).toBe(true);
  });

  it('shows the Special Description asterisk only while Is Special is checked', () => {
    const armorArticle = Array.from(fixture.nativeElement.querySelectorAll('article')).find((article) =>
      (article as HTMLElement).textContent?.includes('Armors')
    ) as HTMLElement;
    const labels = Array.from(armorArticle.querySelectorAll('label')) as HTMLLabelElement[];
    const specialDescriptionLabel = labels.find((label) => label.textContent?.trim().startsWith('Special Description'));

    expect(specialDescriptionLabel?.querySelector('span.text-danger')).toBeNull();

    component.armorDraftForm.controls.isSpecial.setValue(true);
    fixture.detectChanges();

    expect(specialDescriptionLabel?.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
  });

  it('still navigates and warns when the sub-resource batch fails after the monster exists', () => {
    failSubResources = true;
    addOneOfEachDraft();

    component.onCreate(validPayload);

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/monsters', 'new-monster-1']]);
    expect(notifications).toEqual([
      {
        kind: 'error',
        message: 'Monster created, but some details may not have saved. Review them on the monster page.',
      },
    ]);
    expect(component.errorMessage()).toBeNull();
    expect(component.isSaving()).toBe(false);
  });
});
