import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, UrlSegment, provideRouter } from '@angular/router';

import { AuthService } from './auth';
import { anonymousMatch, authenticatedMatch } from './auth-guards';

function segmentsFor(path: string): UrlSegment[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => new UrlSegment(part, {}));
}

/**
 * Invokes a CanMatchFn in an injection context.
 *
 * Angular 22's CanMatchFn takes a third `currentSnapshot` argument. Neither guard reads it (they
 * only need `segments`), so it is stubbed — declaring fewer parameters in the guard itself is
 * legal TypeScript, but the call site still has to supply all three.
 */
function runGuard(guard: CanMatchFn, path: string): unknown {
  return TestBed.runInInjectionContext(() =>
    guard({} as Route, segmentsFor(path), {} as never)
  );
}

describe('auth guards', () => {
  let authService: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    authService = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  function signIn(): void {
    authService.login('test@local.dev', 'pw').subscribe();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });
  }

  describe('authenticatedMatch', () => {
    it('matches when signed in', () => {
      signIn();
      expect(runGuard(authenticatedMatch, 'dashboard')).toBe(true);
    });

    // Returning `false` rather than a UrlTree is what lets the router fall through to the sibling
    // auth shell. A UrlTree cancels the navigation instead of trying siblings, and because shell 1
    // prefix-matches /login too, that would redirect /login -> /login until Angular's redirect
    // limit throws.
    it('returns false — never a UrlTree — when signed out', () => {
      expect(runGuard(authenticatedMatch, 'dashboard')).toBe(false);
    });

    it('stashes the attempted deep link so login can return to it', () => {
      runGuard(authenticatedMatch, 'monsters/abc');

      expect(authService.takeRedirectUrl()).toBe('/monsters/abc');
    });

    it('does not stash /login or the root', () => {
      runGuard(authenticatedMatch, 'login');
      expect(authService.takeRedirectUrl()).toBeNull();

      runGuard(authenticatedMatch, '');
      expect(authService.takeRedirectUrl()).toBeNull();
    });
  });

  describe('anonymousMatch', () => {
    it('matches when signed out', () => {
      expect(runGuard(anonymousMatch, 'login')).toBe(true);
    });

    it('does not match when signed in, so /login falls through to the app shell', () => {
      signIn();
      expect(runGuard(anonymousMatch, 'login')).toBe(false);
    });
  });
});
