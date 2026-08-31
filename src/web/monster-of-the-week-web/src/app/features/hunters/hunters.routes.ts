import { Routes } from '@angular/router';
import { HuntersListComponent } from './pages/hunters-list/hunters-list';

export const HUNTERS_ROUTES: Routes = [
  { path: '', component: HuntersListComponent },
  // Must stay ahead of the ':hunterId' route below — Angular matches top-down, so a literal
  // 'new' registered after it would be swallowed as a hunter id. Same gotcha MONSTERS_ROUTES
  // already documents.
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/hunter-create/hunter-create').then((m) => m.HunterCreateComponent),
  },
  {
    path: ':hunterId',
    loadComponent: () =>
      import('./pages/hunter-detail/hunter-detail').then((m) => m.HunterDetailComponent),
  },
];
