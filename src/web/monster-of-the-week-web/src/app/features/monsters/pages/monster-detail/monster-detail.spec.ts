import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MonsterDetailResponse, UpsertMonsterRequest } from '../../../../core/models';
import { MonsterService } from '../../../../core/monster';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterFormComponent } from '../../shared/monster-form/monster-form';
import { MonsterDetailComponent } from './monster-detail';

const loadedMonster: MonsterDetailResponse = {
  id: 'mo1',
  mysteryIds: ['m1'],
  name: 'Monster',
  description: null,
  harmCapacity: 7,
  monsterTypeId: 'monster-type-1',
  monsterTypeName: null,
  monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

describe('MonsterDetailComponent', () => {
  let component: MonsterDetailComponent;
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let deleteAttackCalls = 0;
  let updateCalls: { monsterId: string; payload: UpsertMonsterRequest }[] = [];

  beforeEach(async () => {
    deleteAttackCalls = 0;
    updateCalls = [];
    await TestBed.configureTestingModule({
      imports: [MonsterDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mysteryId: 'm1', monsterId: 'mo1' })),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getById: () => of(loadedMonster),
            update: (monsterId: string, payload: UpsertMonsterRequest) => {
              updateCalls.push({ monsterId, payload });
              return of({ ...loadedMonster, ...payload, monsterArchetype: loadedMonster.monsterArchetype });
            },
            createAttack: () => of({ id: 'a1' }),
            assignAttackWeaponTag: () => of({}),
            createPower: () => of({}),
            createArmor: () => of({}),
            createWeakness: () => of({}),
            deleteAttack: () => {
              deleteAttackCalls += 1;
              return of(void 0);
            },
            deletePower: () => of(void 0),
            deleteArmor: () => of(void 0),
            deleteWeakness: () => of(void 0),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getMonsterTypes: () => of([]),
            getMonsterArchetypes: () => of([]),
            getWeaponTags: () => of([]),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getByMonster: () => of([]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {},
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): MonsterFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(MonsterFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as MonsterFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared monster form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-monster-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['monsterForm']).toBeUndefined();
  });

  it('passes the loaded monster and a Save Monster label down to the shared form', () => {
    const instance = sharedForm();
    expect(instance.monster).toBe(loadedMonster);
    expect(instance.submitLabel).toBe('Save Monster');
    expect(instance.monsterForm.getRawValue().name).toBe('Monster');
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.monsterForm.setValue({
      name: 'Renamed',
      description: '',
      harmCapacity: 9,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });

    const form = fixture.nativeElement.querySelector('app-monster-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        monsterId: 'mo1',
        payload: {
          name: 'Renamed',
          description: null,
          harmCapacity: 9,
          monsterTypeId: 'monster-type-1',
          monsterArchetypeId: 'monster-archetype-1',
        },
      },
    ]);
  });

  it('saves the monster when the shared form emits a payload', () => {
    const payload: UpsertMonsterRequest = {
      name: 'Renamed',
      description: 'Now with a description.',
      harmCapacity: 9,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    };

    component.saveMonster(payload);

    expect(updateCalls).toEqual([{ monsterId: 'mo1', payload }]);
    expect(component.monster()!.name).toBe('Renamed');
    expect(component.activeMutation()).toBeNull();
  });

  it('does not call update when no monster has been loaded', () => {
    component.monster.set(null);

    component.saveMonster({
      name: 'Renamed',
      description: null,
      harmCapacity: 9,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });

    expect(updateCalls).toEqual([]);
  });

  it('requires specialDescription on the armor form only while isSpecial is checked', () => {
    const specialDescription = component.armorForm.controls.specialDescription;

    expect(specialDescription.validator).toBeNull();

    component.armorForm.controls.isSpecial.setValue(true);
    specialDescription.setValue('');
    expect(specialDescription.valid).toBe(false);

    component.armorForm.controls.isSpecial.setValue(false);
    expect(specialDescription.valid).toBe(true);
  });

  it('shows the Special Description asterisk only while Is Special is checked', () => {
    const armorArticle = Array.from(fixture.nativeElement.querySelectorAll('article')).find((article) =>
      (article as HTMLElement).textContent?.includes('Armors')
    ) as HTMLElement;
    const labels = Array.from(armorArticle.querySelectorAll('label')) as HTMLLabelElement[];
    const specialDescriptionLabel = labels.find((label) => label.textContent?.trim().startsWith('Special Description'));

    expect(specialDescriptionLabel?.querySelector('span.text-danger')).toBeNull();

    component.armorForm.controls.isSpecial.setValue(true);
    fixture.detectChanges();

    expect(specialDescriptionLabel?.querySelector('span.text-danger')?.textContent?.trim()).toBe('*');
  });

  it('does not delete attack when cancelled', () => {
    component.requestDeleteAttack('attack-1', 'Test Attack');
    expect(component.pendingDelete()).not.toBeNull();
    component.onDeleteCancelled();
    expect(component.pendingDelete()).toBeNull();
    expect(deleteAttackCalls).toBe(0);
  });

  it('deletes attack when confirmed', () => {
    component.requestDeleteAttack('attack-1', 'Test Attack');
    component.onDeleteConfirmed();
    expect(deleteAttackCalls).toBe(1);
  });
});
