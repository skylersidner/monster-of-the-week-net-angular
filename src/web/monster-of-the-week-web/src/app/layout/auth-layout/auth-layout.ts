import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Chrome for the unauthenticated side of the app: a centred card, no sidebar, no header, no
 * search, no user menu.
 *
 * Adopted from the two-shell structure in docs/authentication-update/architecture.md section 6 even
 * though there is exactly one auth page today, because the routing problem it solves is structural
 * rather than proportional to the page count — see core/auth-guards.ts and app.routes.ts.
 *
 * The icon sprite, the toast host and the API-availability modal deliberately do NOT live here:
 * they are app-wide and sit on App (app.html), so both shells get them.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.html',
  host: { class: 'block h-full' },
})
export class AuthLayoutComponent {}
