import { TestBed } from '@angular/core/testing';
import { HttpContext, HttpContextToken, provideHttpClient } from '@angular/common/http';
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

  // 13.11 item 4 / L9: post/put/delete forward an optional HttpContext through to HttpClient so
  // callers (HunterService, PlaybookService) can carry SUPPRESS_ERROR_TOAST on the outgoing
  // request without ApiService knowing what that token means.
  const TEST_TOKEN = new HttpContextToken<boolean>(() => false);

  it('forwards a context on post', () => {
    service.post('/api/hunters', { name: 'x' }, new HttpContext().set(TEST_TOKEN, true)).subscribe();
    const request = httpTestingController.expectOne('/api/hunters');
    expect(request.request.context.get(TEST_TOKEN)).toBe(true);
    request.flush({});
  });

  it('forwards a context on put', () => {
    service.put('/api/hunters/h1', { name: 'x' }, new HttpContext().set(TEST_TOKEN, true)).subscribe();
    const request = httpTestingController.expectOne('/api/hunters/h1');
    expect(request.request.context.get(TEST_TOKEN)).toBe(true);
    request.flush({});
  });

  it('forwards a context on delete', () => {
    service.delete('/api/playbooks/p1', new HttpContext().set(TEST_TOKEN, true)).subscribe();
    const request = httpTestingController.expectOne('/api/playbooks/p1');
    expect(request.request.context.get(TEST_TOKEN)).toBe(true);
    request.flush(null);
  });

  it('defaults post/put/delete to no context when none is given', () => {
    service.post('/api/hunters', {}).subscribe();
    const request = httpTestingController.expectOne('/api/hunters');
    expect(request.request.context.get(TEST_TOKEN)).toBe(false);
    request.flush({});
  });
});
