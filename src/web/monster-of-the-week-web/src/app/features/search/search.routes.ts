import { Routes } from '@angular/router';

export const SEARCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/search-results/search-results').then((m) => m.SearchResultsComponent),
  },
];
