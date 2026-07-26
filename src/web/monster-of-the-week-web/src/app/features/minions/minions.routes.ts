import { Routes } from '@angular/router';
import { MinionsListComponent } from './pages/minions-list/minions-list';

export const MINIONS_ROUTES: Routes = [
  { path: '', component: MinionsListComponent },
  {
    path: ':minionId',
    loadComponent: () =>
      import('./pages/minion-detail/minion-detail').then((m) => m.MinionDetailComponent),
  },
];
