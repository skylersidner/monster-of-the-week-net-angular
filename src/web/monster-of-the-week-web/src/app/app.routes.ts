import { Routes } from '@angular/router';
import { HealthStatus } from './pages/health-status/health-status';

export const routes: Routes = [
  { path: '', component: HealthStatus },
  { path: '**', redirectTo: '' },
];
