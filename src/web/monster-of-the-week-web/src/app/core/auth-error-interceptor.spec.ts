import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth';
import { authErrorInterceptor } from './auth-error-interceptor';
import { credentialsInterceptor } from './credentials-interceptor';
import { httpErrorInterceptor } from './http-error-interceptor';
import { NotificationService } from './notifications';

describe('authErrorInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authService: AuthService;
  let notificationService: NotificationService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Registered in the SAME order as app.config.ts, deliberately: this suite's whole value is
        // that it fails if that order is ever changed.
        provideHttpClient(
          withInterceptors([credentialsInterceptor, httpErrorInterceptor, authErrorInterceptor])
        ),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    notificationService = TestBed.inject(NotificationService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  function signIn(): void {
    authService.login('test@local.dev', 'pw').subscribe();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });
  }

  it('sends credentials on every request', () => {
    httpClient.get('/api/mysteries').subscribe();
    const request = httpTestingController.expectOne('/api/mysteries');

    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  /**
   * THE regression test for the interceptor registration order.
   *
   * Angular builds the chain with reduceRight, so the last entry in the array is the first to see
   * an error. If authErrorInterceptor is moved before httpErrorInterceptor, the 401 reaches the
   * generic reporter first and this assertion goes red — which is the only automated signal that
   * the order regressed. Nothing about the wrong order fails to compile.
   */
  it('swallows a 401 so no toast fires, and bounces to /login', () => {
    signIn();

    httpClient.get('/api/mysteries').subscribe({ error: () => {} });
    httpTestingController
      .expectOne('/api/mysteries')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(notificationService.notifications()).toHaveLength(0);
    expect(authService.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('navigates once for a burst of parallel 401s, and toasts none of them', () => {
    signIn();

    httpClient.get('/api/mysteries').subscribe({ error: () => {} });
    httpClient.get('/api/monsters').subscribe({ error: () => {} });
    httpClient.get('/api/locations').subscribe({ error: () => {} });

    for (const url of ['/api/mysteries', '/api/monsters', '/api/locations']) {
      httpTestingController.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(notificationService.notifications()).toHaveLength(0);
  });

  it('captures the current url as returnUrl', () => {
    signIn();
    vi.spyOn(router, 'url', 'get').mockReturnValue('/monsters/abc');

    httpClient.get('/api/monsters/abc').subscribe({ error: () => {} });
    httpTestingController
      .expectOne('/api/monsters/abc')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/monsters/abc' },
    });
  });

  it('passes non-401 errors through to the generic handler', () => {
    signIn();

    httpClient.get('/api/mysteries').subscribe({ error: () => {} });
    httpTestingController
      .expectOne('/api/mysteries')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(notificationService.notifications()).toHaveLength(1);
    expect(notificationService.notifications()[0].message).toContain('500');
  });

  // Both interceptors skip /api/auth/ by design: login failures must reach LoginComponent intact,
  // and logout's own 401 is handled by AuthService.logout()'s error path.
  it('leaves /api/auth/ failures entirely alone — no bounce, no toast', () => {
    signIn();

    let caught: any = null;
    httpClient.post('/api/auth/login', {}).subscribe({ error: (e) => (caught = e) });
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ code: 'invalid_credentials' }, { status: 400, statusText: 'Bad Request' });

    expect(caught?.status).toBe(400);
    expect(caught?.error?.code).toBe('invalid_credentials');
    expect(notificationService.notifications()).toHaveLength(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves the health probe alone, so a failed liveness check never bounces to /login', () => {
    signIn();

    httpClient.get('/health/live', { responseType: 'text' }).subscribe({ error: () => {} });
    httpTestingController
      .expectOne('/health/live')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(notificationService.notifications()).toHaveLength(0);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(authService.user()).not.toBeNull();
  });
});
