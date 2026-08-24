import { HttpRequest } from '@angular/common/http';

/**
 * Requests whose failures are handled entirely by whoever made them, and which no global error
 * interceptor should touch.
 *
 * Deliberately ONE predicate shared by both httpErrorInterceptor and authErrorInterceptor rather
 * than a copied `includes()` in each — two independent copies of an exemption list is exactly how
 * one of them goes stale. The name says what the list means, which is what makes sharing it
 * correct: adding an entry here suppresses both the generic toast *and* the 401 bounce, and those
 * are the right pair of behaviours for any caller that owns its own error rendering.
 *
 * Current entries:
 *  - /health/live      PageLayout's API-availability probe renders its own modal; it is also
 *                      [AllowAnonymous] server-side, so it cannot 401. If that AllowAnonymous were
 *                      ever missed, sharing this predicate is what stops the liveness probe
 *                      bouncing the user to /login.
 *  - /api/auth/        The auth pages own their error rendering completely. Login failures are 400
 *                      with a code and must reach LoginComponent intact; POST /api/auth/logout is
 *                      itself authenticated and 401s on an already-expired session, which
 *                      AuthService.logout()'s error path handles.
 *
 * docs/simple-authentication-update/architecture.md section 3.3.
 */
export function isSelfHandledRequest(request: HttpRequest<unknown>): boolean {
  const url = request.urlWithParams;
  return url.includes('/health/live') || url.includes('/api/auth/');
}
