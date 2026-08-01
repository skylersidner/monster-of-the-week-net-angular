import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { MinionService } from '../../../../core/minion';
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
                concept: 'A case file on the haunting.',
                hook: 'The hunters are called in.',
                overview: 'A vengeful spirit is escalating.',
                notes: null,
                adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
                countdown: {
                  day: 'A chill settles in.',
                  shadows: null,
                  sunset: null,
                  dusk: null,
                  nightfall: null,
                  midnight: 'The spirit manifests fully.',
                },
                monsterCount: 2,
                locationCount: 1,
                bystanderCount: 1,
                customMoves: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getByMystery: () =>
              of([
                {
                  id: 'monster-1',
                  mysteryIds: ['mystery-1'],
                  name: 'The Wailer',
                  description: null,
                  harmCapacity: 8,
                  monsterType: { id: 'monster-type-1', name: 'Ghost', motivation: 'Haunt and confuse' },
                  attackCount: 0,
                  powerCount: 0,
                  armorCount: 0,
                  weaknessCount: 0,
                  minionCount: 0,
                  createdAt: new Date().toISOString(),
                },
              ]),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getByMonster: () =>
              of([
                {
                  id: 'minion-1',
                  name: 'Echo Thrall',
                  description: null,
                  harmCapacity: 3,
                  minionType: { id: 'minion-type-1', name: 'Servant', motivation: 'control' },
                  attackCount: 0,
                  powerCount: 0,
                  armorCount: 0,
                  weaknessCount: 0,
                  createdAt: new Date().toISOString(),
                },
              ]),
          },
        },
        {
          provide: ApiService,
          useValue: {
            get: (url: string) =>
              of(
                url.includes('/locations')
                  ? [
                      {
                        id: 'location-1',
                        name: 'Bell Tower',
                        description: null,
                        mysteryIds: ['mystery-1'],
                        locationTypeId: 'location-type-1',
                        locationTypeName: 'Sanctum',
                      },
                    ]
                  : [
                      {
                        id: 'bystander-1',
                        name: 'Father Reed',
                        description: null,
                        mysteryIds: ['mystery-1'],
                        bystanderTypeId: 'bystander-type-1',
                        bystanderTypeName: 'Witness',
                      },
                    ]
              ),
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

  it('renders section icons across the mystery detail sections', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('app-mystery-section-icon').length).toBe(14);
    expect(element.querySelectorAll('.countdown-list app-mystery-section-icon').length).toBe(6);
    expect(element.textContent).toContain('The Wailer');
    expect(element.textContent).toContain('Echo Thrall');
    expect(element.textContent).toContain('Bell Tower');
    expect(element.textContent).toContain('Father Reed');
  });
});
