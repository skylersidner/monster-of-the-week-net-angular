import { Routes } from '@angular/router';
import { MonstersListComponent } from './pages/monsters-list/monsters-list';

export const MONSTERS_ROUTES: Routes = [
  { path: '', component: MonstersListComponent },
  {
    path: ':monsterId',
    loadComponent: () =>
      import('./pages/monster-detail/monster-detail').then((m) => m.MonsterDetailComponent),
  },
];
