import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MinionDetailResponse, UpsertMinionRequest } from '../../../../core/models';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MinionFormComponent } from '../../shared/minion-form/minion-form';
import { MinionDetailComponent } from './minion-detail';

const loadedMinion: MinionDetailResponse = {
  id: 'mn1',
  monsterId: 'mo1',
  monsterName: 'The Beast',
  name: 'Test Minion',
  description: null,
  harmCapacity: 3,
  minionType: { id: 'mt1', name: 'Torturer', motivation: 'dominate' },
  attacks: [],
  powers: [],
  armors: [],
  weaknesses: [],
  customMoves: [],
};

describe('MinionDetailComponent', () => {
  let component: MinionDetailComponent;
  let fixture: ComponentFixture<MinionDetailComponent>;
  let deleteAttackCalls = 0;
  let updateCalls: { minionId: string; payload: UpsertMinionRequest }[] = [];

  beforeEach(async () => {
    deleteAttackCalls = 0;
    updateCalls = [];
    await TestBed.configureTestingModule({
      imports: [MinionDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ minionId: 'mn1' })),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getById: () => of(loadedMinion),
            update: (minionId: string, payload: UpsertMinionRequest) => {
              updateCalls.push({ minionId, payload });
              return of({ ...loadedMinion, ...payload, minionType: loadedMinion.minionType });
            },
            createAttack: () => of({ id: 'a1', name: '', description: null, harm: 0, weaponTags: [] }),
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
            getMinionTypes: () => of([]),
            getWeaponTags: () => of([]),
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

    fixture = TestBed.createComponent(MinionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): MinionFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(MinionFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as MinionFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared minion form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-minion-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['minionForm']).toBeUndefined();
  });

  it('passes the loaded minion and a Save Minion label down to the shared form', () => {
    const instance = sharedForm();
    expect(component.minion()).not.toBeNull();
    expect(instance.minion).toBe(loadedMinion);
    expect(instance.submitLabel).toBe('Save Minion');
    expect(instance.minionForm.getRawValue().name).toBe('Test Minion');
    expect(instance.minionForm.getRawValue().harmCapacity).toBe(3);
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.minionForm.setValue({
      name: 'Renamed',
      description: '',
      harmCapacity: 5,
      minionTypeId: 'mt1',
    });

    const form = fixture.nativeElement.querySelector('app-minion-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        minionId: 'mn1',
        payload: {
          name: 'Renamed',
          description: null,
          harmCapacity: 5,
          minionTypeId: 'mt1',
        },
      },
    ]);
  });

  it('saves the minion when the shared form emits a payload', () => {
    const payload: UpsertMinionRequest = {
      name: 'Renamed',
      description: 'Now with a description.',
      harmCapacity: 5,
      minionTypeId: 'mt1',
    };

    component.saveMinion(payload);

    expect(updateCalls).toEqual([{ minionId: 'mn1', payload }]);
    expect(component.minion()!.name).toBe('Renamed');
    expect(component.activeMutation()).toBeNull();
  });

  it('does not call update when no minion has been loaded', () => {
    component.minion.set(null);

    component.saveMinion({
      name: 'Renamed',
      description: null,
      harmCapacity: 5,
      minionTypeId: 'mt1',
    });

    expect(updateCalls).toEqual([]);
  });

  it('does not delete attack when cancelled', () => {
    component.requestDeleteAttack('a1', 'Test Attack');
    expect(component.pendingDelete()).not.toBeNull();
    component.onDeleteCancelled();
    expect(component.pendingDelete()).toBeNull();
    expect(deleteAttackCalls).toBe(0);
  });

  it('deletes attack when confirmed', () => {
    component.requestDeleteAttack('a1', 'Test Attack');
    component.onDeleteConfirmed();
    expect(deleteAttackCalls).toBe(1);
  });
});
