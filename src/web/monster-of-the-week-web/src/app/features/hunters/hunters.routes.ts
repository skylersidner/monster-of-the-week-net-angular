import { Routes } from '@angular/router';
import { hunterDraftGuard } from './pages/hunter-create/hunter-draft.guard';
import { HuntersListComponent } from './pages/hunters-list/hunters-list';

export const HUNTERS_ROUTES: Routes = [
  { path: '', component: HuntersListComponent },
  // Must stay ahead of the ':hunterId' route below — Angular matches top-down, so a literal
  // 'new' registered after it would be swallowed as a hunter id. Same gotcha MONSTERS_ROUTES
  // already documents. Since Phase 7 'new' is the Hunter creation wizard (hunter-creation-wizard.md).
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/hunter-create/hunter-create').then((m) => m.HunterCreateComponent),
    // Leaving a dirty draft asks first (7.5, L12). The guard file imports no component, so the wizard stays lazy.
    canDeactivate: [hunterDraftGuard],
  },
  {
    path: ':hunterId',
    loadComponent: () =>
      import('./pages/hunter-detail/hunter-detail').then((m) => m.HunterDetailComponent),
  },
];
