import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller already renders the server's own error message — a rules
 * refusal such as a hunter create/update, or the admin playbook save/delete (13.11 item 4, L9).
 * Suppresses only `httpErrorInterceptor`'s generic "Request failed (...)" toast, so the caller's
 * own message is the only one shown.
 *
 * Deliberately NOT folded into `isSelfHandledRequest` (core/self-handled-request.ts): that
 * predicate also disables `authErrorInterceptor`'s 401 bounce, which these callers still need —
 * a stale hunter creation wizard should still be bounced to /login on an expired session, just
 * without a duplicate generic toast on top of whatever the caller renders.
 *
 * The 401 bounce is unaffected regardless: under the app's interceptor order (app.config.ts,
 * `luigi-interceptor-order-error-direction.md`), `authErrorInterceptor` is innermost and
 * swallows a 401 before it ever reaches `httpErrorInterceptor`'s catchError, so this token is
 * never even consulted on that path.
 */
export const SUPPRESS_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
