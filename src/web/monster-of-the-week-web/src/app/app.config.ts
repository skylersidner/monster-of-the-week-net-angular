import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from './core/auth';
import { authErrorInterceptor } from './core/auth-error-interceptor';
import { credentialsInterceptor } from './core/credentials-interceptor';
import { httpErrorInterceptor } from './core/http-error-interceptor';
import { ThemeService } from './core/theme';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([
        // ORDER IS LOAD-BEARING, and authErrorInterceptor going last is not a typo.
        //
        // Angular builds the chain with reduceRight, so [A, B, C] becomes
        // A(next: B(next: C(next: backend))). The array is REQUEST order; error responses travel
        // back through it in reverse, which means: LAST IN THE ARRAY = FIRST TO SEE AN ERROR.
        //
        // authErrorInterceptor therefore has to sit after httpErrorInterceptor to swallow a 401
        // before the generic toast fires. Put it any earlier and httpErrorInterceptor — being
        // innermost — enqueues "Request failed (401) for GET /api/..." first, and the 401 branch's
        // entire "no toast" property is lost while still looking correct in the source.
        //
        // credentialsInterceptor only mutates the outgoing request, so its position is unaffected.
        // architecture.md section 3.3 / decision #19.
        credentialsInterceptor,
        httpErrorInterceptor,
        authErrorInterceptor,
      ])
    ),
    provideRouter(routes),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    // RETURNS the observable — note the difference from the ThemeService line above, which returns
    // void because it is synchronous. Angular only waits for an initializer that hands back
    // something awaitable, and the router's initial navigation runs after initializers resolve.
    // Subscribe internally and return void here and the first canMatch runs against a null user, so
    // a signed-in user is shown the login page on every cold load. architecture.md section 3.2.
    provideAppInitializer(() => inject(AuthService).initialize())
  ]
};
