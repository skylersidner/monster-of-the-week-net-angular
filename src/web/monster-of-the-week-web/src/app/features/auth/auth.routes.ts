import { Routes } from '@angular/router';

/**
 * Children of the anonymous shell.
 *
 * The empty-path redirect lives HERE, alongside the login route, not split across app.routes.ts —
 * keeping the pair in one file is what stops the empty-path child going missing, and without it a
 * logged-out visit to '/' or any unknown URL fails to route at all (shell 1 canMatch false ->
 * shell 2 has no matching child -> ** -> '' -> shell 2 again, and Angular throws NG04002).
 *
 * docs/simple-authentication-update/architecture.md section 3.1, phases.md Phase 2 step 10.
 */
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPageComponent),
  },
];
