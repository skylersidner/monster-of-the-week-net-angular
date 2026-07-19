import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryDetailComponent } from './mystery-detail';
import { MysteryService } from '../../../../core/mystery';

describe('MysteryDetailComponent', () => {
  let component: MysteryDetailComponent;
  let fixture: ComponentFixture<MysteryDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysteryDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'mystery-1' })),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            getMystery: () =>
              of({
                id: 'mystery-1',
                name: 'Test mystery',
                concept: null,
                hook: null,
                overview: null,
                notes: null,
                countdown: null,
                monsterCount: 0,
                locationCount: 0,
                bystanderCount: 0,
                customMoves: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getByMystery: () => of([]),
          },
        },
        {
          provide: ApiService,
          useValue: {
            get: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
