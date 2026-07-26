import { Routes } from '@angular/router';
import { PageLayoutComponent } from './layout/page-layout/page-layout';

export const routes: Routes = [
  {
    path: '',
    component: PageLayoutComponent,
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
    ],
  },
  { path: '**', redirectTo: '' },
];
