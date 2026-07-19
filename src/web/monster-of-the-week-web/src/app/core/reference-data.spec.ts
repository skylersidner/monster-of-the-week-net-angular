import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from './api';
import { ReferenceDataService } from './reference-data';

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: () => of([]),
          },
        },
      ],
    });
    service = TestBed.inject(ReferenceDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
