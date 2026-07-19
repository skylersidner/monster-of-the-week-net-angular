import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { HealthService } from './health';

describe('HealthService', () => {
  let service: HealthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HealthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call liveness endpoint', () => {
    service.getLiveness().subscribe((response) => {
      expect(response).toBe('Healthy');
    });

    const request = httpTestingController.expectOne(service.endpoint);
    expect(request.request.method).toBe('GET');
    request.flush('Healthy');
  });
});
