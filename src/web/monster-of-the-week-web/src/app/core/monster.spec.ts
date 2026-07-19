import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from './api';
import { MonsterService } from './monster';

describe('MonsterService', () => {
  let service: MonsterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: () => of([]),
            post: () => of({}),
            put: () => of({}),
            delete: () => of(void 0),
          },
        },
      ],
    });
    service = TestBed.inject(MonsterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
