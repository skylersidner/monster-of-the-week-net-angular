import { Routes } from '@angular/router';
import { HuntersListComponent } from './pages/hunters-list/hunters-list';

/**
 * List only, by design (phases.md Phase 9). The list's links to `/hunters/new` and
 * `/hunters/{id}` are deliberately dead this phase — they fall through to the wildcard and
 * land back on the dashboard until Phase 10 registers those routes. Same list-before-create
 * sequencing the standalone-creation phases used.
 *
 * When 'new' is added it must go ahead of ':hunterId', for the reason MONSTERS_ROUTES already
 * documents: Angular matches top-down, so a literal path registered after a parameterised one
 * is swallowed by it.
 */
export const HUNTERS_ROUTES: Routes = [{ path: '', component: HuntersListComponent }];
