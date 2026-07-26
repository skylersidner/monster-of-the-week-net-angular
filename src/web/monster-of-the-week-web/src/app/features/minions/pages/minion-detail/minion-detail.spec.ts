import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MinionDetailComponent } from './minion-detail';

describe('MinionDetailComponent', () => {
  let component: MinionDetailComponent;
  let fixture: ComponentFixture<MinionDetailComponent>;
  let deleteAttackCalls = 0;

  beforeEach(async () => {
    deleteAttackCalls = 0;
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
            getById: () =>
              of({
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
              }),
            update: () => of({}),
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the minion and patches the form', () => {
    expect(component.minion()).not.toBeNull();
    expect(component.minionForm.controls.name.value).toBe('Test Minion');
    expect(component.minionForm.controls.harmCapacity.value).toBe(3);
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
