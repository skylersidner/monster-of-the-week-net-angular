import { Route } from '@angular/router';

import { routes } from './app.routes';
import { anonymousMatch, authenticatedMatch } from './core/auth-guards';

/**
 * NOTE: the two original tests below reach for the FIRST '' route via `.find()`. With two sibling
 * '' shells that is silently order-dependent — they pass because PageLayoutComponent stays first,
 * which is also what app.routes.ts requires. The logged-out cases select their shell by guard
 * instead, so they do not depend on ordering.
 */
describe('app routes', () => {
  const shells = routes.filter((route) => route.path === '');
  const appShell = shells.find((route) => route.canMatch?.includes(authenticatedMatch)) as Route;
  const authShell = shells.find((route) => route.canMatch?.includes(anonymousMatch)) as Route;

  it('redirects the root child route to dashboard', () => {
    const rootRoute = routes.find((route) => route.path === '');
    const defaultChildRoute = rootRoute?.children?.find((child) => child.path === '');

    expect(defaultChildRoute?.redirectTo).toBe('dashboard');
  });

  it('registers data admin route', () => {
    const rootRoute = routes.find((route) => route.path === '');
    const dataAdminRoute = rootRoute?.children?.find((child) => child.path === 'data-admin');

    expect(dataAdminRoute).toBeTruthy();
  });

  it('puts the authenticated shell first, which the second shell depends on', () => {
    expect(shells).toHaveLength(2);
    expect(shells[0]).toBe(appShell);
    expect(shells[1]).toBe(authShell);
  });

  it('guards the authenticated shell so no lazy feature chunk loads while signed out', () => {
    expect(appShell.canMatch).toEqual([authenticatedMatch]);

    const lazyChildren = (appShell.children ?? []).filter(
      (child) => child.loadChildren || child.loadComponent
    );
    expect(lazyChildren).toHaveLength(9);
  });

  it('registers an anonymous shell for the logged-out case', () => {
    expect(authShell).toBeTruthy();
    expect(authShell.canMatch).toEqual([anonymousMatch]);
    expect(authShell.loadChildren).toBeTruthy();
  });

  /**
   * Without an empty-path child on the auth shell, a logged-out '/' and every unknown URL fail to
   * route at all: shell 1 canMatch false -> shell 2 has no matching child -> ** -> '' -> shell 2
   * again, and Angular throws. This was a blocking finding on the robust plan; the assertion exists
   * so it cannot go missing a second time.
   */
  it('gives the auth shell an empty-path child that lands on login', async () => {
    const loader = authShell.loadChildren as () => Promise<Route[]>;
    const authRoutes = await loader();

    const emptyChild = authRoutes.find((route) => route.path === '');
    expect(emptyChild?.pathMatch).toBe('full');
    expect(emptyChild?.redirectTo).toBe('login');

    expect(authRoutes.find((route) => route.path === 'login')).toBeTruthy();
  });

  it('keeps the wildcard pointing at the root so both shells get a chance', () => {
    const wildcard = routes.find((route) => route.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });
});
