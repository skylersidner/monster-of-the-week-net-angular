import { Routes } from '@angular/router';
import { PageLayoutComponent } from './layout/page-layout/page-layout';

export const routes: Routes = [
  {
    path: '',
    component: PageLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mysteries' },
      {
        path: 'mysteries',
        loadChildren: () =>
          import('./features/mysteries/mysteries.routes').then((m) => m.MYSTERIES_ROUTES),
      },
      {
        path: 'health-status',
        loadComponent: () =>
          import('./pages/health-status/health-status').then((m) => m.HealthStatus),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
