## Learnings

### 2026-08-15 — Authentication & Authorization Design Review (docs/authentication-update/)

Design-review only; no code or docs modified (owner wanted advisory output first).

- **`PreSignInCheck` ordering is the crux of the login-enumeration design.** `SignInManager.PasswordSignInAsync` → `CheckPasswordSignInAsync` → `PreSignInCheck` returns `NotAllowed` (CanSignIn/confirmation) **before** `LockedOut`, and both **before** the password is verified. Consequence the design missed: because `NotAllowed` short-circuits first, `AccessFailedCount` is never incremented for an unconfirmed account — so **unconfirmed accounts have zero lockout**, and the proposed `IsNotAllowed && CheckPasswordAsync(...)` snippet turns login into an unmetered password oracle for them. Correct sequence needs an explicit `IsLockedOutAsync` check plus `AccessFailedAsync`/`ResetAccessFailedCountAsync` around the `CheckPasswordAsync` call.
- **Security-stamp bump is NOT immediate revocation.** `SecurityStampValidator` compares `IssuedUtc` against `ValidationInterval` *before* touching the DB, so a stamp bump only takes effect at the next interval boundary (30 min here). Any doc/runbook claiming "force it immediately by changing security_stamp" is wrong. There is no immediate kill switch in a cookie-only, no-session-store design.
- **`options.Events = new CookieAuthenticationEvents { ... }` silently destroys `OnValidatePrincipal`** that `AddIdentityCookies()` wires to `SecurityStampValidator`. Mutate `options.Events.OnRedirectToLogin` instead. Failure mode: everything works, nothing ever revalidates.
- **ASP.NET antiforgery tokens are bound to the claims identity.** A token minted while anonymous fails after login ("meant for a different claims-based user"). Any SPA cookie-auth design must re-issue the XSRF cookie pair on login and logout. Not double-submit; not identity-agnostic.
- **EF global query filters do not cover child entity types queried at root.** Verified in this repo: `dbContext.MonsterAttacks/MonsterPowers/.../Countdowns/MysteryMonsters` are all queried directly and parent-scoped only. Filtering the 4 owned roots + `Minion` leaves ~24 entity types unprotected, defended only by hand-added service guards. `MysteryService.GetCountdownAsync` and `*Service.UnlinkFromMysteryAsync` have no guard at all — concrete cross-owner read/delete.
- Repo fact-check note: **there is no "link an existing entity to a mystery" endpoint** — `POST /api/mysteries/{id}/monsters` *creates* and links. The bridge risk is in `UnlinkFromMysteryAsync`, not a link path. `data-ownership.md` §1 and `phases.md` Phase 2 step 8 both describe a method (`LinkToMysteryAsync`) that does not exist.
- Timing side channels: PBKDF2 (~100ms, .NET 8+ 210k iters) dominates. Any branch that skips password hashing (no-such-user on login, already-registered on register, locked-out) is a loud timing oracle. Queued mail dispatch fixes the *mail* channel only.
- Repo state at review time: no auth packages, `OnModelCreating` has no `base` call, `appsettings.Development.json` committed with a real dev password, no `proxy.conf.json`, no `WebApplicationFactory`, 7 controller files (docs say "six domain controllers").

### 2026-09-19 — Mystery Entity Linking Phase 1 security review (the three membership PUTs)

Review only; no code changed. Branch `mystery-entity-linking-phase-1`, uncommitted.

- **Route-coverage claims must be proved by enumerating endpoint metadata, never by a 401 probe.**
  `AuthorizationPolicy.CombineAsync` falls back to the fallback policy when `authorizeData` is empty
  — *including when `context.GetEndpoint()` is null* — and this app additionally has
  `app.Map("/api/{**rest}")` (`Program.cs:213`) deliberately *not* `AllowAnonymous`. So **every**
  `/api/...` path 401s anonymously whether or not it routes anywhere. A 401 proves nothing about a
  route's existence or its coverage. The cheap conclusive method: a scratchpad `Microsoft.NET.Sdk.Web`
  project with a `ProjectReference` to the API csproj, `AddControllers()`, `app.MapControllers()`,
  then walk `((IEndpointRouteBuilder)app).DataSources.SelectMany(d => d.Endpoints)` and print
  `RoutePattern.RawText` + `GetMetadata<IAllowAnonymous>()` + `GetOrderedMetadata<IAuthorizeData>().Count`.
  No DB needed — Program.cs never runs. Resolving `EndpointDataSource` from DI instead returns 0
  endpoints (app data sources merge into the composite only at `app.Run`).
- Result at review time: **124 controller endpoints, exactly 2 carry `IAllowAnonymous`** —
  `api/auth/login` and `api/auth/me`. The `Program.cs:88` comment saying "107 existing controller
  actions" is stale. All six mystery-membership endpoints (3 PUT + 3 DELETE) are `allowAnon=False`,
  `authDataCount=0` → fallback policy applies.
- **This app has no ownership model at all and it is deliberate**: no `owner_id`/`UserId` on any
  domain entity, `docs/simple-authentication-update/architecture.md:601` — "No per-user data
  ownership. No `owner_id`, no `ICurrentUser`, no EF global query filters." There is no registration
  endpoint either (`AuthController` is login/logout/me). So IDOR findings on domain routes are
  non-findings; do not write them up as if a boundary were crossed.
- **`LinkToMysteryAsync` is the app's first write verb that joins *two* objects.** Every other write
  touches one. When per-user ownership lands it needs a **two-sided** check (mystery *and* entity),
  which the existing one-object guard idiom will not give it. Worth remembering as the shape, not a
  finding today.
- Check-then-insert race on the composite PK (`MotwDbContext.cs:334/344/354`) is real → 500 not 204.
  **Not a vulnerability**: prod is `UseExceptionHandler()` + `AddProblemDetails()`, generic 500, no
  stack trace, no SQL; the PK holds the data invariant. Both Phase 2 call sites already guard
  double-submit synchronously (`mystery-create.store.ts:1186` + `mystery-create.html:33`;
  `location-detail.ts:78` + `location-form.html:18`).
- **The provider-agnostic duplicate-insert guard is a re-check, not an exception sniff.** Catching
  `DbUpdateException` and testing `InnerException is PostgresException { SqlState: "23505" }` is
  untestable here — `MysteryLinkRepositoryTests.LinkFixture` runs **SQLite**, which throws
  `SqliteException`. Re-calling `…LinkedToMysteryAsync` inside the catch works on both providers and
  correctly distinguishes a duplicate PK (row now present → 204 is truthful) from a concurrent-delete
  FK violation (no row → rethrow → 500). A blanket `catch (DbUpdateException) { return true; }` is
  strictly worse than the 500 because it answers 204 for a membership that does not exist.
  Also detach the `Added` entry after swallowing, or a later `SaveChanges` in the same request retries it.
- `PUT` and `DELETE` on the identical membership URI are **not** status-symmetric, despite §4.1 of the
  design saying they mirror: re-`PUT` → 204, re-`DELETE` → 404 (`LocationService.cs:167-171`,
  `deleted > 0`). Matters for §7's `pendingRemovals` replay, not for security.
