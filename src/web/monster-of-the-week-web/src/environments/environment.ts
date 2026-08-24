// Empty base URL: every API call is a relative, same-origin path. In development that works
// because proxy.conf.json forwards /api and /health to the API; in production the API serves the
// built app from its own origin. There is deliberately no environment.prod.ts and no
// fileReplacements — with a same-origin deployment there is nothing environment-specific left to
// replace. docs/simple-authentication-update/architecture.md section 4.2.
export const environment = {
  apiBaseUrl: '',
};
