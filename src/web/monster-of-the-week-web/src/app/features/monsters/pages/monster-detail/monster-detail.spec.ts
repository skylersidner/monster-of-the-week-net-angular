import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MonsterService } from '../../../../core/monster';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MonsterDetailComponent } from './monster-detail';

describe('MonsterDetailComponent', () => {
  let component: MonsterDetailComponent;
  let fixture: ComponentFixture<MonsterDetailComponent>;

  beforeEach(async () => {
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
                mysteryId: 'm1',
                name: 'Monster',
                description: null,
                harmCapacity: 7,
                monsterTypeId: null,
                monsterTypeName: null,
                minionTypeId: null,
                minionTypeName: null,
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
            deleteAttack: () => of(void 0),
            deletePower: () => of(void 0),
            deleteArmor: () => of(void 0),
            deleteWeakness: () => of(void 0),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getMonsterTypes: () => of([]),
            getMinionTypes: () => of([]),
            getWeaponTags: () => of([]),
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
});
