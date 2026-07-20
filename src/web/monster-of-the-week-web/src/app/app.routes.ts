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
    ],
  },
  { path: '**', redirectTo: '' },
];
