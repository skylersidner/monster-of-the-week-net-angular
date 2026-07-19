import { Routes } from '@angular/router';
import { MysteriesListComponent } from './pages/mysteries-list/mysteries-list';
import { MysteryDetailComponent } from './pages/mystery-detail/mystery-detail';

export const MYSTERIES_ROUTES: Routes = [
  { path: '', component: MysteriesListComponent },
  {
    path: ':mysteryId/monsters/:monsterId',
    loadComponent: () =>
      import('../monsters/pages/monster-detail/monster-detail').then((m) => m.MonsterDetailComponent),
  },
  {
    path: ':mysteryId/locations/:locationId',
    loadComponent: () =>
      import('../locations/pages/location-detail/location-detail').then((m) => m.LocationDetailComponent),
  },
  {
    path: ':mysteryId/bystanders/:bystanderId',
    loadComponent: () =>
      import('../bystanders/pages/bystander-detail/bystander-detail').then((m) => m.BystanderDetailComponent),
  },
  { path: ':id', component: MysteryDetailComponent },
];
