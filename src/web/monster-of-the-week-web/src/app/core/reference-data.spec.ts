import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from './api';
import { NameDescriptionTable, ReferenceTypeTable } from './models';
import { ReferenceDataService } from './reference-data';

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;
  let postPath = '';
  const getPaths: string[] = [];

  beforeEach(() => {
    postPath = '';
    getPaths.length = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: (path: string) => {
              getPaths.push(path);
              return of([]);
            },
            post: (path: string) => {
              postPath = path;
              return of({ id: 'type-1', name: 'Type Name', motivation: 'Motivation value' });
            },
          },
        },
      ],
    });
    service = TestBed.inject(ReferenceDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('routes create requests to the selected endpoint', () => {
    service
      .createType(ReferenceTypeTable.LocationTypes, {
        name: 'Crossroads',
        motivation: 'Tempts visitors to make dangerous choices.',
      })
      .subscribe();

    expect(postPath).toBe('/api/location-types');
  });

  it('routes weapon tag create requests to weapon-tags endpoint', () => {
    service
      .createWeaponTag({
        name: 'Messy',
        description: 'Causes brutal collateral damage.',
      })
      .subscribe();

    expect(postPath).toBe('/api/weapon-tags');
  });

  it('routes adventure type create requests to adventure-types endpoint', () => {
    service
      .createAdventureType({
        name: 'Mystery',
        description: 'A classic investigate-and-confront adventure.',
      })
      .subscribe();

    expect(postPath).toBe('/api/adventure-types');
  });

  it('routes monster archetype create requests to monster-archetypes endpoint', () => {
    service
      .createMonsterArchetype({
        name: 'Chaser',
        description: 'Hunts its prey relentlessly.',
      })
      .subscribe();

    expect(postPath).toBe('/api/monster-archetypes');
  });

  it('routes name + description creates by table', () => {
    const cases: readonly [NameDescriptionTable, string][] = [
      [ReferenceTypeTable.WeaponTags, '/api/weapon-tags'],
      [ReferenceTypeTable.AdventureTypes, '/api/adventure-types'],
      [ReferenceTypeTable.MonsterArchetypes, '/api/monster-archetypes'],
    ];

    for (const [table, expectedPath] of cases) {
      postPath = '';
      service.createNameDescription(table, { name: 'Sample', description: 'Sample description.' }).subscribe();
      expect(postPath).toBe(expectedPath);
    }
  });

  it('routes name + description lists by table', () => {
    const cases: readonly [NameDescriptionTable, string][] = [
      [ReferenceTypeTable.WeaponTags, '/api/weapon-tags'],
      [ReferenceTypeTable.AdventureTypes, '/api/adventure-types'],
      [ReferenceTypeTable.MonsterArchetypes, '/api/monster-archetypes'],
    ];

    for (const [table, expectedPath] of cases) {
      getPaths.length = 0;
      service.getNameDescriptionsByTable(table).subscribe();
      expect(getPaths).toEqual([expectedPath]);
    }
  });

  it('clears the cached list so the next read refetches after a create', () => {
    service.getAdventureTypes().subscribe();
    service.getAdventureTypes().subscribe();
    expect(getPaths).toEqual(['/api/adventure-types']);

    service.createAdventureType({ name: 'Mystery', description: 'A classic adventure.' }).subscribe();
    service.getAdventureTypes().subscribe();
    expect(getPaths).toEqual(['/api/adventure-types', '/api/adventure-types']);

    getPaths.length = 0;
    service.getMonsterArchetypes().subscribe();
    service.getMonsterArchetypes().subscribe();
    expect(getPaths).toEqual(['/api/monster-archetypes']);

    service.createMonsterArchetype({ name: 'Chaser', description: 'Hunts relentlessly.' }).subscribe();
    service.getMonsterArchetypes().subscribe();
    expect(getPaths).toEqual(['/api/monster-archetypes', '/api/monster-archetypes']);
  });
});
