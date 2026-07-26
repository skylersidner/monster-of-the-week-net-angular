import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MonsterService } from '../../../../core/monster';
import { MinionService } from '../../../../core/minion';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterDetailComponent } from './monster-detail';

describe('MonsterDetailComponent', () => {
  let component: MonsterDetailComponent;
  let fixture: ComponentFixture<MonsterDetailComponent>;
  let deleteAttackCalls = 0;

  beforeEach(async () => {
    deleteAttackCalls = 0;
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
            getById: () =>
              of({
                id: 'mo1',
                mysteryIds: ['m1'],
                name: 'Monster',
                description: null,
                harmCapacity: 7,
                monsterTypeId: 'monster-type-1',
                monsterTypeName: null,
                attacks: [],
                powers: [],
                armors: [],
                weaknesses: [],
                customMoves: [],
              }),
            update: () => of({}),
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

  it('should create', () => {
    expect(component).toBeTruthy();
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
