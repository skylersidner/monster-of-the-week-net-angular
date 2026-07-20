import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from './api';
import { ReferenceTypeTable } from './models';
import { ReferenceDataService } from './reference-data';

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;
  let postPath = '';

  beforeEach(() => {
    postPath = '';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: () => of([]),
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
});
