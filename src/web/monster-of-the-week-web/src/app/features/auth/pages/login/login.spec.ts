import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/auth';
import { LoginPageComponent } from './login';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let httpTestingController: HttpTestingController;
  let router: Router;
  let authService: AuthService;
  // Mutable stub: ActivatedRouteSnapshot.queryParamMap is readonly on the real type, so the tests
  // that need a returnUrl swap the map through this object rather than assigning to the snapshot.
  let routeStub: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  function setQueryParams(params: Record<string, string>): void {
    routeStub.snapshot.queryParamMap = convertToParamMap(params);
  }

  beforeEach(async () => {
    routeStub = { snapshot: { queryParamMap: convertToParamMap({}) } };

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  function submit(email = 'test@local.dev', password = 'pw'): void {
    component.loginForm.setValue({ email, password });
    const form = (fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function errorText(): string {
    const region = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    return region?.textContent?.trim() ?? '';
  }

  it('is a real login form the browser and password managers can recognise', () => {
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector('#login-email') as HTMLInputElement;
    const password = element.querySelector('#login-password') as HTMLInputElement;

    expect(email.type).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('name')).toBe('email');
    expect(password.type).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(element.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('signs in and navigates to the dashboard', () => {
    submit();

    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ id: 'u1', email: 'test@local.dev' });
    fixture.detectChanges();

    expect(authService.isAuthenticated()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(errorText()).toBe('');
  });

  it('prefers the returnUrl query parameter', () => {
    setQueryParams({ returnUrl: '/monsters/abc' });

    submit();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/monsters/abc');
  });

  it('falls back to the url stashed by the proactive guard', () => {
    authService.stashRedirectUrl('/locations/xyz');

    submit();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/locations/xyz');
  });

  it('ignores an off-origin returnUrl', () => {
    setQueryParams({ returnUrl: '//evil.example' });

    submit();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the specific message for invalid credentials and does not navigate', () => {
    submit('test@local.dev', 'wrong');

    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ code: 'invalid_credentials' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(errorText()).toBe('Wrong email or password.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  /**
   * The finding this component exists to close: both interceptors skip /api/auth/, so this inline
   * region is the only error surface in the app for the login POST. Branch to nothing on anything
   * other than invalid_credentials and the submit button is completely inert when the API is down.
   * architecture.md section 3.4.
   */
  it('shows a generic message when the API is unreachable', () => {
    submit();

    httpTestingController
      .expectOne('/api/auth/login')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(errorText()).toContain("Couldn't sign you in");
    expect(component.isSubmitting()).toBe(false);
  });

  it('shows a generic message for a 500', () => {
    submit();

    httpTestingController
      .expectOne('/api/auth/login')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(errorText()).toContain("Couldn't sign you in");
  });

  it('shows a generic message for an unrecognised 400 code', () => {
    submit();

    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ code: 'something_new' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(errorText()).toContain("Couldn't sign you in");
  });

  it('clears a previous error when resubmitting', () => {
    submit('test@local.dev', 'wrong');
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ code: 'invalid_credentials' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(errorText()).not.toBe('');

    submit();
    expect(errorText()).toBe('');
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });
  });
});
