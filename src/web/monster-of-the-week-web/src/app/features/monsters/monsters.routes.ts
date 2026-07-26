import { Routes } from '@angular/router';
import { MonstersListComponent } from './pages/monsters-list/monsters-list';

export const MONSTERS_ROUTES: Routes = [
  { path: '', component: MonstersListComponent },
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
