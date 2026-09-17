import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  Router,
  RouterConfigOptions,
  provideRouter,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';

import { ROUTER_CONFIG } from './app.config';

@Component({ template: 'page' })
class PageComponent {}

/**
 * Browser Back with a guard that cancels (hunter-creation-wizard.md 13.8, 13.15 item 7; L12). The
 * wizard's discard guard is the app's only navigation-cancelling route, and these routes stand in
 * for it: the list, then the wizard, whose guard refuses until the player discards.
 *
 * The router defers each popstate with `setTimeout` and runs guards asynchronously, so every step
 * waits for the router's own event rather than a fixed number of ticks.
 */
describe('router config: a cancelled Back', () => {
  let leaveAllowed: boolean;
  let location: Location;
  let router: Router;

  async function openWizardFromList(options: RouterConfigOptions): Promise<void> {
    leaveAllowed = false;
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter(
          [
            { path: 'hunters', component: PageComponent },
            { path: 'hunters/new', component: PageComponent, canDeactivate: [() => leaveAllowed] },
          ],
          withRouterConfig(options)
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    location = TestBed.inject(Location);
    router = TestBed.inject(Router);
    // The app's bootstrap does this through initialNavigation(); the harness doesn't, and without it
    // the router never hears a popstate at all.
    router.setUpLocationChangeListener();
    await harness.navigateByUrl('/hunters');
    await harness.navigateByUrl('/hunters/new');
  }

  /** Presses Back and resolves with the router's answer to the popstate it causes. */
  function back(): Promise<RouterEvent> {
    const answer = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationCancel || e instanceof NavigationEnd)));
    location.back();
    return answer;
  }

  /** Lets deferred popstate handling run when no navigation is expected to follow. */
  async function idle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve));
    }
  }

  it('is resolved as computed, app-wide', () => {
    expect(ROUTER_CONFIG).toEqual({ canceledNavigationResolution: 'computed' });
  });

  it('keeps browser history in step, so a Back after discarding still reaches the page before the wizard', async () => {
    await openWizardFromList(ROUTER_CONFIG);

    expect(await back()).toBeInstanceOf(NavigationCancel);
    await idle();
    expect(router.url).toBe('/hunters/new');
    expect(location.path()).toBe('/hunters/new');

    // The player discards: the guard now lets them go, and one more Back gets there.
    leaveAllowed = true;
    expect(await back()).toBeInstanceOf(NavigationEnd);
    expect(router.url).toBe('/hunters');
    expect(location.path()).toBe('/hunters');
  });
  // Non-vacuous: with ROUTER_CONFIG set to 'replace', both cases above fail (checked by negative control).
});
