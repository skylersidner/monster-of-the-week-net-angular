import { Routes } from '@angular/router';
import { anonymousMatch, authenticatedMatch } from './core/auth-guards';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout';
import { PageLayoutComponent } from './layout/page-layout/page-layout';

/**
 * Two shells, both at path ''.
 *
 * Shell 1 (authenticated) MUST stay first — the router tries these in order, and app.routes.spec.ts
 * has two tests that reach for the first '' route by `.find()`. Shell 1's '' prefix-matches every
 * URL, so authenticatedMatch runs for /login too; it returns false rather than a UrlTree, which is
 * what lets the router fall through to shell 2. See core/auth-guards.ts for why a UrlTree loops.
 *
 * Worked traces, logged out: '/dashboard' -> shell 1 canMatch false -> shell 2 matches '' but has
 * no 'dashboard' child -> router backtracks -> ** -> '' -> shell 2's empty-path child -> /login.
 * Logged in, '/login' -> shell 1 matches with no 'login' child -> backtrack -> shell 2's
 * anonymousMatch false -> ** -> '' -> '' child -> /dashboard.
 */
export const routes: Routes = [
  {
    path: '',
    component: PageLayoutComponent,
    canMatch: [authenticatedMatch],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'data-admin',
        loadComponent: () => import('./pages/data-admin/data-admin').then((m) => m.DataAdminPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPageComponent),
      },
      {
        path: 'mysteries',
        loadChildren: () =>
          import('./features/mysteries/mysteries.routes').then((m) => m.MYSTERIES_ROUTES),
      },
      {
        path: 'monsters',
        loadChildren: () =>
          import('./features/monsters/monsters.routes').then((m) => m.MONSTERS_ROUTES),
      },
      {
        path: 'minions',
        loadChildren: () =>
          import('./features/minions/minions.routes').then((m) => m.MINIONS_ROUTES),
      },
      {
        path: 'bystanders',
        loadChildren: () =>
          import('./features/bystanders/bystanders.routes').then((m) => m.BYSTANDERS_ROUTES),
      },
      {
        path: 'locations',
        loadChildren: () =>
          import('./features/locations/locations.routes').then((m) => m.LOCATIONS_ROUTES),
      },
      {
        path: 'hunters',
        loadChildren: () =>
          import('./features/hunters/hunters.routes').then((m) => m.HUNTERS_ROUTES),
      },
      {
        path: 'search',
        loadChildren: () =>
          import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES),
      },
    ],
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canMatch: [anonymousMatch],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
