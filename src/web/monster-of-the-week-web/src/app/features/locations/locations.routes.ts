import { Routes } from '@angular/router';

export const LOCATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/locations-list/locations-list').then((m) => m.LocationsListComponent),
  },
  {
    path: ':locationId',
    loadComponent: () =>
      import('./pages/location-detail/location-detail').then((m) => m.LocationDetailComponent),
  },
];
