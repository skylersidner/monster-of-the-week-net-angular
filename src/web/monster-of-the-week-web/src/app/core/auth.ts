import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap } from 'rxjs';

import { ApiService } from './api';
import { CurrentUser, LoginRequest } from './models';

/**
 * Accepts only same-origin, app-relative paths as a post-login redirect target.
 *
 * Angular's UrlSerializer cannot leave the origin, so this is belt-and-braces rather than a live
 * hole — but returnUrl arrives from a query parameter, and one line now is cheaper than reasoning
 * about it again the next time something else starts consuming it. '//host' is the case worth
 * naming: it is protocol-relative in a browser even though it starts with a slash.
 */
export function isSafeInternalUrl(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

/**
 * Authentication state for the SPA.
 *
 * There is no client-side token to persist: the session cookie is HttpOnly, so the server is the
 * only source of truth and the app has to *ask* on boot via GET /api/auth/me. That probe is wired
 * up as an app initializer in app.config.ts.
 *
 * Mirrors ThemeService (core/theme.ts) in shape: a root-provided service exposing a writable
 * signal plus computed derivations. No isAdmin/isSuperAdmin — there are no roles in this pass.
 *
 * docs/simple-authentication-update/architecture.md section 3.2.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  private readonly currentUser = signal<CurrentUser | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * The URL a logged-out visitor was trying to reach, stashed by authenticatedMatch.
   *
   * A CanMatchFn returning `false` cannot attach query parameters — doing that needs a UrlTree,
   * which in the two-shell pattern causes an infinite redirect (architecture.md section 3.1). So the
   * proactive guard path records the attempted URL here instead, and LoginComponent reads it.
   */
  private pendingRedirectUrl: string | null = null;

  /**
   * Called once at bootstrap, from provideAppInitializer.
   *
   * MUST return the observable rather than subscribing internally and returning void: Angular only
   * waits for an initializer that hands back something awaitable, and the router's initial
   * navigation runs after initializers resolve. Return void and the first canMatch runs against a
   * null user, so a signed-in owner is shown the login page on every cold load — which reads as a
   * cookie bug rather than a bootstrap one. architecture.md section 3.2.
   *
   * Always resolves, never rejects. GET /api/auth/me is [AllowAnonymous] and answers 200 with a
   * literal JSON null when signed out; a transport failure or 5xx is also treated as "not signed
   * in", which is correct rather than merely defensive — a session that cannot be *verified* must
   * be treated as no session.
   */
  initialize(): Observable<CurrentUser | null> {
    return this.apiService.get<CurrentUser | null>('/api/auth/me').pipe(
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      })
    );
  }

  /**
   * Sets the user signal itself, via tap, so callers only navigate.
   *
   * Failures propagate untouched: both error interceptors skip /api/auth/ by design, so
   * LoginComponent is the only error surface in the app for this request and must render something
   * for every failure. architecture.md section 3.4.
   */
  login(email: string, password: string): Observable<CurrentUser> {
    return this.apiService
      .post<LoginRequest, CurrentUser>('/api/auth/login', { email, password })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  /**
   * Ends a live session.
   *
   * Clears state and navigates from the `error` path as well as the `next` path, and that is not
   * defensive coding — POST /api/auth/logout is itself authenticated, so clicking Sign out on an
   * already-expired session returns 401, and *both* interceptors skip /api/auth/ by design, so
   * nothing else would handle it. Act on success only and Sign out silently does nothing in exactly
   * the situation it exists for. architecture.md section 3.4 / decision #14.
   */
  logout(): void {
    this.apiService.post<null, void>('/api/auth/logout', null).subscribe({
      next: () => this.endSession(),
      error: () => this.endSession(),
    });
  }

  /** Clears auth state without a server round trip — used by authErrorInterceptor's 401 branch. */
  clear(): void {
    this.currentUser.set(null);
  }

  stashRedirectUrl(url: string): void {
    this.pendingRedirectUrl = url;
  }

  /** Reads and clears the stashed URL, so a stale deep link cannot resurface on a later login. */
  takeRedirectUrl(): string | null {
    const url = this.pendingRedirectUrl;
    this.pendingRedirectUrl = null;
    return url;
  }

  private endSession(): void {
    this.currentUser.set(null);
    this.pendingRedirectUrl = null;
    void this.router.navigateByUrl('/login');
  }
}
