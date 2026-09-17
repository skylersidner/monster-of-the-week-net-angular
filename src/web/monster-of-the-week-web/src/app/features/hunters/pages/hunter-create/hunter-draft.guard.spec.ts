import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/auth';
import { DiscardGuardedPage, hunterDraftGuard } from './hunter-draft.guard';

/** The discard guard's stand-aside rule (hunter-creation-wizard.md 13.8, 13.15 item 7; L11, L12). */
describe('hunterDraftGuard', () => {
  let authenticated: boolean;

  beforeEach(() => {
    authenticated = true;
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isAuthenticated: () => authenticated } }],
    });
  });

  const run = (page: DiscardGuardedPage): unknown =>
    TestBed.runInInjectionContext(() => hunterDraftGuard(page, {} as never, {} as never, {} as never));

  it('asks the page while signed in, and returns its answer', () => {
    const asking = of(false);
    const page: DiscardGuardedPage = { canLeave: vi.fn(() => asking) };

    expect(run(page)).toBe(asking);
    expect(page.canLeave).toHaveBeenCalledTimes(1);

    const clean: DiscardGuardedPage = { canLeave: () => true };
    expect(run(clean)).toBe(true);
  });

  it('stands aside once signed out, without asking: an expired session\'s login redirect, or a deliberate Sign out (L11)', () => {
    authenticated = false;
    const page: DiscardGuardedPage = { canLeave: vi.fn(() => of(false)) };

    expect(run(page)).toBe(true);
    expect(page.canLeave).not.toHaveBeenCalled();
  });
});
