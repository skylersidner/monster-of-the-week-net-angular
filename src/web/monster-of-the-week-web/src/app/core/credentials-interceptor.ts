import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Sends the session cookie with every request.
 *
 * Strictly unnecessary under the same-origin setup this app ships with — same-origin requests
 * carry cookies by default, and both the dev proxy and the production single-origin host make every
 * call same-origin. It ships anyway as ~5 lines of insurance: if a later deployment lands on
 * sibling subdomains instead, this plus a credentialed CORS policy is exactly what makes the cookie
 * flow, and discovering that at deploy time is far more expensive.
 *
 * It must be an interceptor rather than four edits inside ApiService, because HealthService
 * (core/health.ts) calls HttpClient directly and bypasses ApiService entirely.
 *
 * docs/simple-authentication-update/architecture.md section 3.3.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
