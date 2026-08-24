import { inject } from '@angular/core';
import { CanMatchFn, Route, UrlSegment } from '@angular/router';

import { AuthService } from './auth';

/**
 * Guards for the two-shell route structure in app.routes.ts.
 *
 * BOTH GUARDS RETURN A BOOLEAN AND MUST NEVER RETURN A UrlTree. Returning `false` is what lets the
 * router fall through to the sibling shell, and that fall-through *is* the pattern. Shell 1's path
 * is '', which prefix-matches every URL, so authenticatedMatch runs for /login too — a UrlTree
 * there cancels the navigation and redirects instead of trying siblings, so a logged-out visit to
 * /login would redirect to /login, re-enter this guard, and loop until Angular's redirect limit
 * throws. The two-hop bounce (** -> '' -> login) is deliberate; collapsing it looks like a harmless
 * cleanup and silently breaks logged-out routing.
 *
 * Analysed, declined, and confirmed by the project owner on 2026-08-15.
 * docs/simple-authentication-update/architecture.md section 3.1.
 *
 * canMatch, not canActivate: canMatch runs *before* the lazy loadChildren/loadComponent import, so
 * an unauthenticated visitor never downloads any of shell 1's nine lazy entries.
 */
export const authenticatedMatch: CanMatchFn = (_route: Route, segments: UrlSegment[]) => {
  const authService = inject(AuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  // A CanMatchFn returning false cannot attach query parameters (that needs a UrlTree — see
  // above), so the attempted URL is stashed on the service instead and LoginComponent reads it
  // back. Without this a logged-out deep link to /monsters/{id} would silently always land on
  // /dashboard after signing in.
  const attempted = '/' + segments.map((segment) => segment.path).join('/');
  if (attempted !== '/login' && attempted !== '/') {
    authService.stashRedirectUrl(attempted);
  }

  return false;
};

/** Keeps a signed-in user off the auth shell, so /login falls through to the app. */
export const anonymousMatch: CanMatchFn = () => !inject(AuthService).isAuthenticated();
