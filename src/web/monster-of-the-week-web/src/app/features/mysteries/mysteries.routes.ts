import { Routes } from '@angular/router';
import { MysteriesListComponent } from './pages/mysteries-list/mysteries-list';
import { MysteryDetailComponent } from './pages/mystery-detail/mystery-detail';

export const MYSTERIES_ROUTES: Routes = [
  { path: '', component: MysteriesListComponent },
  { path: ':id', component: MysteryDetailComponent },
];
