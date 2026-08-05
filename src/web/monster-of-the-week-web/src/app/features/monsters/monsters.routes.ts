import { Routes } from '@angular/router';
import { MonstersListComponent } from './pages/monsters-list/monsters-list';

export const MONSTERS_ROUTES: Routes = [
  { path: '', component: MonstersListComponent },
  // Must stay ahead of the ':monsterId' route below — Angular matches top-down, so a
  // literal 'new' registered after it would be swallowed as a monster id.
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/monster-create/monster-create').then((m) => m.MonsterCreateComponent),
  },
  {
    path: ':monsterId/minions/:minionId',
    loadComponent: () =>
      import('../minions/pages/minion-detail/minion-detail').then((m) => m.MinionDetailComponent),
  },
  {
    path: ':monsterId',
    loadComponent: () =>
      import('./pages/monster-detail/monster-detail').then((m) => m.MonsterDetailComponent),
  },
];
