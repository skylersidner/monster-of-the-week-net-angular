import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

import { AuthService, isSafeInternalUrl } from './auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('starts signed out', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  describe('initialize', () => {
    it('returns an observable so bootstrap can await it, and sets the user from /api/auth/me', () => {
      const user = { id: 'u1', email: 'test@local.dev' };
      let emitted: unknown = 'not-emitted';

      // The subscribe here IS the assertion that initialize() returns something awaitable rather
      // than void — provideAppInitializer only waits for a returned Promise/Observable.
      service.initialize().subscribe((value) => (emitted = value));

      httpTestingController.expectOne('/api/auth/me').flush(user);

      expect(emitted).toEqual(user);
      expect(service.user()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('resolves with null when signed out (200 with a literal JSON null body)', () => {
      let completed = false;
      service.initialize().subscribe({ complete: () => (completed = true) });

      httpTestingController.expectOne('/api/auth/me').flush(null);

      expect(service.user()).toBeNull();
      expect(completed).toBe(true);
    });

    it('resolves rather than rejects when the API is unreachable', () => {
      let errored = false;
      let completed = false;
      service.initialize().subscribe({
        error: () => (errored = true),
        complete: () => (completed = true),
      });

      httpTestingController
        .expectOne('/api/auth/me')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(errored).toBe(false);
      expect(completed).toBe(true);
      expect(service.user()).toBeNull();
    });
  });

  describe('login', () => {
    it('sets the user signal itself, via the pipe, before the caller sees the value', () => {
      const user = { id: 'u1', email: 'test@local.dev' };
      let userAtEmission: unknown = 'unset';

      service.login('test@local.dev', 'pw').subscribe(() => (userAtEmission = service.user()));

      const request = httpTestingController.expectOne('/api/auth/login');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ email: 'test@local.dev', password: 'pw' });
      request.flush(user);

      expect(userAtEmission).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('propagates failures untouched so the login component can render them', () => {
      let caught: any = null;
      service.login('test@local.dev', 'wrong').subscribe({ error: (e) => (caught = e) });

      httpTestingController
        .expectOne('/api/auth/login')
        .flush({ code: 'invalid_credentials' }, { status: 400, statusText: 'Bad Request' });

      expect(caught?.status).toBe(400);
      expect(service.user()).toBeNull();
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      service.login('test@local.dev', 'pw').subscribe();
      httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });
    });

    it('clears state and navigates on success', () => {
      service.logout();
      httpTestingController.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });

      expect(service.user()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    // The whole point of decision #14: POST /api/auth/logout is itself authenticated, so clicking
    // Sign out on an already-expired session returns 401 — and both interceptors skip /api/auth/,
    // so nothing else would handle it. Act on success only and Sign out silently does nothing in
    // exactly the situation it exists for.
    it('clears state and navigates on error too, so Sign out still works on an expired session', () => {
      service.logout();
      httpTestingController
        .expectOne('/api/auth/logout')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(service.user()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });
  });

  describe('redirect stash', () => {
    it('hands back the stashed url once, then forgets it', () => {
      service.stashRedirectUrl('/monsters/abc');

      expect(service.takeRedirectUrl()).toBe('/monsters/abc');
      expect(service.takeRedirectUrl()).toBeNull();
    });
  });
});

describe('isSafeInternalUrl', () => {
  it('accepts app-relative paths', () => {
    expect(isSafeInternalUrl('/dashboard')).toBe(true);
    expect(isSafeInternalUrl('/monsters/abc?x=1')).toBe(true);
  });

  it('rejects absent, absolute and protocol-relative urls', () => {
    expect(isSafeInternalUrl(null)).toBe(false);
    expect(isSafeInternalUrl('')).toBe(false);
    expect(isSafeInternalUrl('dashboard')).toBe(false);
    expect(isSafeInternalUrl('https://evil.example')).toBe(false);
    expect(isSafeInternalUrl('//evil.example')).toBe(false);
  });
});
