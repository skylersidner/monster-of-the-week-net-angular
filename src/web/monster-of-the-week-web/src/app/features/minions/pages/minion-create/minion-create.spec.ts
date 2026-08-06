import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  MinionDetailResponse,
  MonsterDetailResponse,
  MonsterListItemResponse,
  TypeRefResponse,
  UpsertMinionArmorRequest,
  UpsertMinionAttackRequest,
  UpsertMinionPowerRequest,
  UpsertMinionRequest,
  UpsertMinionWeaknessRequest,
  WeaponTagRefResponse,
} from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MONSTERS_ROUTES } from '../../../monsters/monsters.routes';
import { MINIONS_ROUTES } from '../../minions.routes';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { MinionFormComponent } from '../../shared/minion-form/minion-form';
import { MinionCreateComponent } from './minion-create';

describe('minion create route ordering', () => {
  it('registers the literal "new" route before the ":minionId" catch-all', () => {
    const paths = MINIONS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':minionId'));
  });

  it('registers ":monsterId/minions/new" before ":monsterId/minions/:minionId"', () => {
    const paths = MONSTERS_ROUTES.map((route) => route.path);

    expect(paths).toContain(':monsterId/minions/new');
    expect(paths.indexOf(':monsterId/minions/new')).toBeLessThan(
      paths.indexOf(':monsterId/minions/:minionId')
    );
  });
});

const minionTypes: TypeRefResponse[] = [{ id: 'minion-type-1', name: 'Thug', motivation: 'to hurt' }];

const weaponTags: WeaponTagRefResponse[] = [
  { id: 'tag-1', name: 'Messy', description: null },
  { id: 'tag-2', name: 'Forceful', description: null },
];

const monsters: MonsterListItemResponse[] = [
  {
    id: 'monster-1',
    mysteryIds: [],
    name: 'The Miller',
    description: null,
    harmCapacity: 4,
    monsterType: { id: 'monster-type-1', name: 'Beast', motivation: 'to feed' },
    monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: 'Restless.' },
    attackCount: 0,
    powerCount: 0,
    armorCount: 0,
    weaknessCount: 0,
    minionCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'monster-2',
    mysteryIds: [],
    name: 'The Warden',
    description: null,
    harmCapacity: 3,
    monsterType: { id: 'monster-type-1', name: 'Beast', motivation: 'to feed' },
    monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: 'Restless.' },
    attackCount: 0,
    powerCount: 0,
    armorCount: 0,
    weaknessCount: 0,
    minionCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const lockedMonster: MonsterDetailResponse = {
  id: 'monster-1',
  mysteryIds: [],
  name: 'The Miller',
  description: null,
  harmCapacity: 4,
  monsterTypeId: 'monster-type-1',
  monsterTypeName: 'Beast',
  monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: 'Restless.' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

const createdMinion: MinionDetailResponse = {
  id: 'new-minion-1',
  monsterId: 'monster-1',
  monsterName: 'The Miller',
  name: 'Cultist',
  description: null,
  harmCapacity: 2,
  minionType: minionTypes[0],
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

const validPayload: UpsertMinionRequest = {
  name: 'Cultist',
  description: null,
  harmCapacity: 2,
  minionTypeId: 'minion-type-1',
};

interface RecordedCalls {
  order: string[];
  create: { monsterId: string; payload: UpsertMinionRequest }[];
  attacks: { minionId: string; request: UpsertMinionAttackRequest }[];
  powers: { minionId: string; request: UpsertMinionPowerRequest }[];
  armors: { minionId: string; request: UpsertMinionArmorRequest }[];
  weaknesses: { minionId: string; request: UpsertMinionWeaknessRequest }[];
  weaponTagAssignments: { minionId: string; attackId: string; weaponTagId: string }[];
  monsterLookups: string[];
  monsterListLoads: number;
}

describe('MinionCreateComponent', () => {
  let fixture: ComponentFixture<MinionCreateComponent>;
  let component: MinionCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];
  let failSubResources: boolean;

  async function setup(routeMonsterId: string | null): Promise<void> {
    calls = {
      order: [],
      create: [],
      attacks: [],
      powers: [],
      armors: [],
      weaknesses: [],
      weaponTagAssignments: [],
      monsterLookups: [],
      monsterListLoads: 0,
    };
    notifications = [];
    navigations = [];
    failSubResources = false;

    const paramMap = new BehaviorSubject<ParamMap>(
      convertToParamMap(routeMonsterId ? { monsterId: routeMonsterId } : {})
    );

    await TestBed.configureTestingModule({
      imports: [MinionCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap.asObservable() } },
        {
          provide: MinionService,
          useValue: {
            create: (monsterId: string, payload: UpsertMinionRequest) => {
              calls.order.push('create');
              calls.create.push({ monsterId, payload });
              return of(createdMinion);
            },
            createAttack: (minionId: string, request: UpsertMinionAttackRequest) => {
              calls.order.push('createAttack');
              calls.attacks.push({ minionId, request });
              if (failSubResources) {
                return throwError(() => new Error('boom'));
              }
              return of({ id: `attack-${calls.attacks.length}` });
            },
            assignAttackWeaponTag: (minionId: string, attackId: string, weaponTagId: string) => {
              calls.order.push('assignAttackWeaponTag');
              calls.weaponTagAssignments.push({ minionId, attackId, weaponTagId });
              return of({});
            },
            createPower: (minionId: string, request: UpsertMinionPowerRequest) => {
              calls.order.push('createPower');
              calls.powers.push({ minionId, request });
              return of({ id: 'power-1' });
            },
            createArmor: (minionId: string, request: UpsertMinionArmorRequest) => {
              calls.order.push('createArmor');
              calls.armors.push({ minionId, request });
              return of({ id: 'armor-1' });
            },
            createWeakness: (minionId: string, request: UpsertMinionWeaknessRequest) => {
              calls.order.push('createWeakness');
              calls.weaknesses.push({ minionId, request });
              return of({ id: 'weakness-1' });
            },
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getById: (monsterId: string) => {
              calls.monsterLookups.push(monsterId);
              return of(lockedMonster);
            },
            getAll: () => {
              calls.monsterListLoads += 1;
              return of(monsters);
            },
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getMinionTypes: () => of(minionTypes),
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

    fixture = TestBed.createComponent(MinionCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function sharedForm(): MinionFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(MinionFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as MinionFormComponent;
  }

  /**
   * The page-level monster picker only. `MinionFormComponent` owns its own
   * `app-custom-select` (minion type) and `WeaponTagSelectComponent` wraps another one,
   * so a bare `By.directive` query would always find one and the "no dropdown when
   * locked" assertion would be vacuous.
   */
  function monsterDropdown(): CustomSelectComponent<MonsterListItemResponse> | null {
    const debugElement = fixture.debugElement
      .queryAll(By.directive(CustomSelectComponent))
      .find((candidate) => {
        const element = candidate.nativeElement as HTMLElement;
        return !element.closest('app-minion-form') && !element.closest('app-weapon-tag-select');
      });

    return debugElement
      ? (debugElement.componentInstance as CustomSelectComponent<MonsterListItemResponse>)
      : null;
  }

  function totalServiceCalls(): number {
    return calls.order.length;
  }

  function addOneOfEachDraft(): void {
    component.attackDraftForm.setValue({
      name: '  Claw  ',
      description: '  Rends flesh.  ',
      harm: 1,
      weaponTagIds: ['tag-1', 'tag-2'],
    });
    component.addAttackDraft();

    component.powerDraftForm.setValue({ name: 'Skitter', description: '  ' });
    component.addPowerDraft();

    component.armorDraftForm.setValue({
      name: 'Chitin',
      description: 'Hard shell.',
      harmSoak: 1,
      isSpecial: true,
      specialDescription: 'Only against blades.',
    });
    component.addArmorDraft();

    component.weaknessDraftForm.setValue({ name: 'Silver', description: null });
    component.addWeaknessDraft();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // --- Monster-locked entry point: /monsters/:monsterId/minions/new ------------

  describe('reached at /monsters/:monsterId/minions/new', () => {
    beforeEach(async () => {
      await setup('monster-1');
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('locks the monster from the route param and loads it for display only', () => {
      expect(component.isMonsterLocked()).toBe(true);
      expect(component.routeMonsterId()).toBe('monster-1');
      expect(component.lockedMonsterName()).toBe('The Miller');
      expect(calls.monsterLookups).toEqual(['monster-1']);
      expect(calls.monsterListLoads).toBe(0);
    });

    it('renders the locked monster label and no monster dropdown', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(text).toContain('Creating a minion for');
      expect(text).toContain('The Miller');
      expect(monsterDropdown()).toBeNull();
    });

    it('loads minion reference data either way', () => {
      expect(component.minionTypes()).toEqual(minionTypes);
      expect(component.weaponTags()).toEqual(weaponTags);
    });

    it('renders the shared minion form in create mode with a Create Minion label', () => {
      const instance = sharedForm();

      expect(instance.minion).toBeNull();
      expect(instance.submitLabel).toBe('Create Minion');
    });

    it('creates against the route monster without needing a dropdown selection', () => {
      component.onCreate(validPayload);

      expect(calls.create).toEqual([{ monsterId: 'monster-1', payload: validPayload }]);
      expect(navigations).toEqual([['/monsters', 'monster-1', 'minions', 'new-minion-1']]);
      expect(notifications).toEqual([{ kind: 'success', message: 'Minion created.' }]);
    });

    it('adds drafts to local arrays without making any network calls', () => {
      addOneOfEachDraft();

      expect(component.attackDrafts()).toEqual([
        { name: 'Claw', description: 'Rends flesh.', harm: 1, weaponTagIds: ['tag-1', 'tag-2'] },
      ]);
      expect(component.powerDrafts()).toEqual([{ name: 'Skitter', description: null }]);
      expect(component.armorDrafts()).toEqual([
        {
          name: 'Chitin',
          description: 'Hard shell.',
          harmSoak: 1,
          isSpecial: true,
          specialDescription: 'Only against blades.',
        },
      ]);
      expect(component.weaknessDrafts()).toEqual([{ name: 'Silver', description: null }]);

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
      component.attackDraftForm.setValue({ name: '', description: '', harm: 1, weaponTagIds: [] });
      component.addAttackDraft();

      expect(component.attackDrafts()).toEqual([]);
      expect(component.attackDraftForm.controls.name.touched).toBe(true);
      expect(totalServiceCalls()).toBe(0);
    });

    it('creates the minion first, then batches every drafted sub-resource against the new id', () => {
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(calls.order[0]).toBe('create');
      expect(calls.attacks).toEqual([
        { minionId: 'new-minion-1', request: { name: 'Claw', description: 'Rends flesh.', harm: 1 } },
      ]);
      expect(calls.powers).toEqual([
        { minionId: 'new-minion-1', request: { name: 'Skitter', description: null } },
      ]);
      expect(calls.armors).toEqual([
        {
          minionId: 'new-minion-1',
          request: {
            name: 'Chitin',
            description: 'Hard shell.',
            harmSoak: 1,
            isSpecial: true,
            specialDescription: 'Only against blades.',
          },
        },
      ]);
      expect(calls.weaknesses).toEqual([
        { minionId: 'new-minion-1', request: { name: 'Silver', description: null } },
      ]);
    });

    it('assigns weapon tags after the drafted attack has been created', () => {
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(calls.weaponTagAssignments).toEqual([
        { minionId: 'new-minion-1', attackId: 'attack-1', weaponTagId: 'tag-1' },
        { minionId: 'new-minion-1', attackId: 'attack-1', weaponTagId: 'tag-2' },
      ]);
      expect(calls.order.indexOf('createAttack')).toBeLessThan(
        calls.order.indexOf('assignAttackWeaponTag')
      );
    });

    it('makes no weapon-tag calls for an attack drafted without tags', () => {
      component.attackDraftForm.setValue({ name: 'Bite', description: null, harm: 1, weaponTagIds: [] });
      component.addAttackDraft();

      component.onCreate(validPayload);

      expect(calls.attacks.length).toBe(1);
      expect(calls.weaponTagAssignments).toEqual([]);
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
        { minionId: 'new-minion-1', request: { name: 'Keep Me', description: null } },
      ]);
    });

    it('creates with no sub-resource calls when no drafts were added', () => {
      component.onCreate(validPayload);

      expect(calls.order).toEqual(['create']);
    });

    it('never reaches onCreate when the shared form is submitted with invalid core fields', () => {
      addOneOfEachDraft();

      const form = fixture.nativeElement.querySelector('app-minion-form form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(totalServiceCalls()).toBe(0);
      expect(navigations).toEqual([]);
      expect(component.isSaving()).toBe(false);
      expect(component.attackDrafts().length).toBe(1);
    });

    it('creates through the shared form output when the core fields are valid', () => {
      const instance = sharedForm();
      instance.minionForm.setValue({
        name: 'Cultist',
        description: '',
        harmCapacity: 2,
        minionTypeId: 'minion-type-1',
      });

      const form = fixture.nativeElement.querySelector('app-minion-form form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(calls.create).toEqual([{ monsterId: 'monster-1', payload: validPayload }]);
    });

    it('keeps the user on the page with an inline error when the initial create call fails', () => {
      const minionService = TestBed.inject(MinionService);
      vi.spyOn(minionService, 'create').mockReturnValue(throwError(() => new Error('nope')));
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(navigations).toEqual([]);
      expect(component.isSaving()).toBe(false);
      expect(component.errorMessage()).toBe('Unable to create minion.');
      expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create minion.' }]);
      expect(component.attackDrafts().length).toBe(1);
      expect(component.powerDrafts().length).toBe(1);
      expect(component.armorDrafts().length).toBe(1);
      expect(component.weaknessDrafts().length).toBe(1);
    });

    it('still navigates and warns when the sub-resource batch fails after the minion exists', () => {
      failSubResources = true;
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(calls.create).toEqual([{ monsterId: 'monster-1', payload: validPayload }]);
      expect(navigations).toEqual([['/monsters', 'monster-1', 'minions', 'new-minion-1']]);
      expect(notifications).toEqual([
        {
          kind: 'error',
          message: 'Minion created, but some details may not have saved. Review them on the minion page.',
        },
      ]);
      expect(component.errorMessage()).toBeNull();
      expect(component.isSaving()).toBe(false);
    });
  });

  // --- Top-level entry point: /minions/new -------------------------------------

  describe('reached at /minions/new', () => {
    beforeEach(async () => {
      await setup(null);
    });

    it('loads every monster as dropdown options and looks up none individually', () => {
      expect(component.isMonsterLocked()).toBe(false);
      expect(component.routeMonsterId()).toBeNull();
      expect(component.monsters()).toEqual(monsters);
      expect(calls.monsterLookups).toEqual([]);
      expect(calls.monsterListLoads).toBe(1);
    });

    it('renders a required monster dropdown instead of a locked label', () => {
      const dropdown = monsterDropdown();

      expect(dropdown).not.toBeNull();
      expect(dropdown!.options).toEqual(monsters);
      expect(component.monsterControl.hasValidator(Validators.required)).toBe(true);
      expect(component.monsterControl.invalid).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
        'Creating a minion for'
      );
    });

    it('bails out with a validation error and makes no create call when no monster is selected', () => {
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(calls.create).toEqual([]);
      expect(totalServiceCalls()).toBe(0);
      expect(navigations).toEqual([]);
      expect(component.isSaving()).toBe(false);
      expect(component.monsterControl.touched).toBe(true);
      expect(component.errorMessage()).toBe('Choose which monster this minion belongs to.');

      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'A minion must belong to a monster.'
      );

      // The drafts and the core fields survive the bail-out.
      expect(component.attackDrafts().length).toBe(1);
      expect(component.powerDrafts().length).toBe(1);
    });

    it('creates against the selected monster and navigates to the monster-scoped detail route', () => {
      component.monsterControl.setValue('monster-2');

      component.onCreate(validPayload);

      expect(calls.create).toEqual([{ monsterId: 'monster-2', payload: validPayload }]);
      expect(navigations).toEqual([['/monsters', 'monster-2', 'minions', 'new-minion-1']]);
      expect(notifications).toEqual([{ kind: 'success', message: 'Minion created.' }]);
    });

    it('batches drafted sub-resources against the selected monster path too', () => {
      component.monsterControl.setValue('monster-2');
      addOneOfEachDraft();

      component.onCreate(validPayload);

      expect(calls.order[0]).toBe('create');
      expect(calls.attacks.length).toBe(1);
      expect(calls.powers.length).toBe(1);
      expect(calls.armors.length).toBe(1);
      expect(calls.weaknesses.length).toBe(1);
      expect(calls.weaponTagAssignments.length).toBe(2);
    });
  });
});
