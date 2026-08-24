import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from './api';

describe('ApiService', () => {
  let service: ApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // apiBaseUrl is '' (same-origin: dev proxy in development, the API serving the app in
  // production), so toUrl() leaves an already-rooted path exactly as given.
  it('builds a same-origin relative url for GET calls', () => {
    service.get('/health/live').subscribe();

    const request = httpTestingController.expectOne('/health/live');
    expect(request.request.method).toBe('GET');
    request.flush('ok');
  });

  it('roots a path that does not start with a slash', () => {
    service.get('health/live').subscribe();

    const request = httpTestingController.expectOne('/health/live');
    expect(request.request.method).toBe('GET');
    request.flush('ok');
  });
});
