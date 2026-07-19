import { routes } from './app.routes';

describe('app routes', () => {
  it('redirects the root child route to dashboard', () => {
    const rootRoute = routes.find((route) => route.path === '');
    const defaultChildRoute = rootRoute?.children?.find((child) => child.path === '');

    expect(defaultChildRoute?.redirectTo).toBe('dashboard');
  });
});
