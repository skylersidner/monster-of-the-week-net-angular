import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { HunterService } from '../../core/hunter';
import { PlaybookService } from '../../core/playbook';
import { HUNTERS_ROUTES } from './hunters.routes';
import { HunterCreateComponent } from './pages/hunter-create/hunter-create';

/** `/hunters/new` is the Hunter creation wizard (hunter-creation-wizard.md 7.7; Phase 7, F5). */
describe('HUNTERS_ROUTES', () => {
  it('routes "new" to the creation wizard, registered ahead of ":hunterId"', async () => {
    const paths = HUNTERS_ROUTES.map((route) => route.path);
    expect(paths.indexOf('new')).toBeGreaterThan(-1);
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':hunterId'));

    const loaded = await HUNTERS_ROUTES.find((route) => route.path === 'new')!.loadComponent!();
    expect(loaded).toBe(HunterCreateComponent);
  });

  it('renders the wizard, tracker and all, at /hunters/new', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'hunters', children: HUNTERS_ROUTES }]),
        { provide: PlaybookService, useValue: { getAll: () => of([]), getById: () => of(null) } },
        { provide: HunterService, useValue: { getAll: () => of([]) } },
      ],
    });

    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/hunters/new', HunterCreateComponent);

    expect(page).toBeInstanceOf(HunterCreateComponent);
    expect(harness.routeNativeElement?.querySelectorAll('.phase-bubble')).toHaveLength(8);
    expect(harness.routeNativeElement?.querySelector('app-hunter-form')).toBeNull();
  });
});
