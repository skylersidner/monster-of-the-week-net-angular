import { Routes } from '@angular/router';
import { MinionsListComponent } from './pages/minions-list/minions-list';

export const MINIONS_ROUTES: Routes = [
  { path: '', component: MinionsListComponent },
  // Must stay ahead of the ':minionId' route below — Angular matches top-down, so a
  // literal 'new' registered after it would be swallowed as a minion id.
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/minion-create/minion-create').then((m) => m.MinionCreateComponent),
  },
  {
    path: ':minionId',
    loadComponent: () =>
      import('./pages/minion-detail/minion-detail').then((m) => m.MinionDetailComponent),
  },
];
