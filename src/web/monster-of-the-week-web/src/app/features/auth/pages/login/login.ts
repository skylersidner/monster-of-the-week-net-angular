import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService, isSafeInternalUrl } from '../../../../core/auth';
import { IconComponent } from '../../../../shared/icons/icon.component';

const GENERIC_ERROR = "Couldn't sign you in — the server didn't respond. Please try again.";
const INVALID_CREDENTIALS = 'Wrong email or password.';

@Component({
  selector: 'app-login-page',
  // IconComponent resolves <use href="#icon-spinner"> against the app-wide sprite, which lives on
  // App (app.html) rather than PageLayoutComponent precisely so the auth shell has it too.
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './login.html',
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  // No Validators.email: a malformed address simply matches no row, which is the same outcome by a
  // shorter path. type="email" on the input is for the mobile keyboard, not validation — Angular's
  // FormGroupDirective puts novalidate on the host form, so HTML5 constraint validation never
  // blocks submit.
  readonly loginForm = this.formBuilder.nonNullable.group({
    email: '',
    password: '',
  });

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(email, password).subscribe({
      // AuthService.login() has already set the user signal via tap. Navigating before the signal
      // is set would leave authenticatedMatch seeing null, and the user would be bounced straight
      // back to /login by their own successful login.
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl(this.resolveRedirectUrl());
      },
      // Renders for EVERY failure, not just invalid_credentials. Both error interceptors skip
      // /api/auth/ by design, so this inline region is the only error surface in the entire
      // application for the login POST — no toast, no modal, nothing else will report it. Branch to
      // nothing here and the submit button is completely inert whenever the API is down, which is a
      // silent failure on the one screen that exists to report failure.
      // docs/simple-authentication-update/architecture.md section 3.4.
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(toErrorMessage(error));
      },
    });
  }

  /**
   * returnUrl from the query string (set by authErrorInterceptor on a mid-session expiry), else the
   * URL stashed by authenticatedMatch (the proactive guard path, which cannot use a query
   * parameter), else the dashboard.
   */
  private resolveRedirectUrl(): string {
    const fromQuery = this.route.snapshot.queryParamMap.get('returnUrl');
    if (isSafeInternalUrl(fromQuery)) {
      return fromQuery;
    }

    const stashed = this.authService.takeRedirectUrl();
    return isSafeInternalUrl(stashed) ? stashed : '/dashboard';
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'invalid_credentials') {
      return INVALID_CREDENTIALS;
    }
  }

  return GENERIC_ERROR;
}
