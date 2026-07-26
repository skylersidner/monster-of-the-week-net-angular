import { Routes } from '@angular/router';

export const BYSTANDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/bystanders-list/bystanders-list').then((m) => m.BystandersListComponent),
  },
  {
    path: ':bystanderId',
    loadComponent: () =>
      import('./pages/bystander-detail/bystander-detail').then((m) => m.BystanderDetailComponent),
  },
];
