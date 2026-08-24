import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, throwError } from 'rxjs';

import { AuthService } from './auth';
import { isSelfHandledRequest } from './self-handled-request';

/**
 * Reacts to a session that has gone away mid-use.
 *
 * This is the *reactive* half of the app's gating; authenticatedMatch (core/auth-guards.ts) is the
 * proactive half. Neither substitutes for the other: the guard only runs on navigation, so it
 * cannot catch an expiry after a route has activated, and this interceptor only fires once a
 * request has already failed, so it cannot catch the first navigation.
 *
 * MUST be registered LAST in withInterceptors(). See the note in app.config.ts.
 *
 * docs/simple-authentication-update/architecture.md section 3.3.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  // First statement, deliberately: the auth endpoints own their own error rendering completely.
  // Written as code shape rather than as intention, because "the login endpoint's failures are
  // handled by the login component" is not implementable as prose.
  if (isSelfHandledRequest(req)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // 401 is reserved API-wide for "you have no valid session" (decision #9), and /api/auth/ is
      // already exempt above, so reaching here can only mean the session is gone. Every one of
      // these is swallowed so no toast fires — a generic "Request failed (401)" would be noise on
      // top of a bounce that already tells the user what happened.
      //
      // Only the FIRST one navigates. A page that mounts several requests at once produces a burst
      // of 401s on expiry; without the isAuthenticated() guard each would clear the signal and call
      // router.navigate again, giving repeated cancelled navigations and a returnUrl of '/login'
      // read back from the second call onward.
      if (authService.isAuthenticated()) {
        const returnUrl = router.url;
        authService.clear();
        void router.navigate(['/login'], {
          queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : {},
        });
      }

      return EMPTY;
    })
  );
};
