import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MysteryService } from './mystery';
import { ApiService } from './api';

class MockApiService {
  lastPath: string | null = null;

  get(path: string) {
    this.lastPath = path;
    return of([]);
  }
}

describe('MysteryService', () => {
  let service: MysteryService;
  let mockApiService: MockApiService;

  beforeEach(() => {
    mockApiService = new MockApiService();

    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: mockApiService }],
    });
    service = TestBed.inject(MysteryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request mystery list endpoint', () => {
    service.getMysteries().subscribe();
    expect(mockApiService.lastPath).toBe('/api/mysteries');
  });
});
