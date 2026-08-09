# Authentication & Authorization — Phased Implementation Plan

See `architecture.md` for the rationale behind every decision below and `data-ownership.md` for the
ownership model; this document is the execution breakdown. Format mirrors `docs/search/phases.md`.

**Status: all 16 open questions resolved by the project owner (2026-08-08) and folded in, including
the same-day correction to #7 (email confirmation *is* a login gate). Two follow-ups also resolved:
**#18 confirmed as recommended, #19 overridden** (forgot-password on an unconfirmed account sends a
fresh confirmation link rather than nothing). Not started — awaiting the review gate below.**

> ## Gate — implementation may not begin until all three have reviewed
>
> | Reviewer | Focus |
> |---|---|
> | **Boo** (Web Security Specialist) | The whole design, and specifically: **the login-endpoint enumeration exception** — a correct-password-but-unconfirmed sign-in returns a *distinct* response, against the general rule in resolution #15, on the reasoning that the branch is only reachable after the password is proven (`architecture.md` §7, including the `NotAllowed` → `CheckPasswordAsync` detail that leaks the state for *any* password if wired naively, and the anonymous `resend-confirmation` endpoint as a mail-amplification surface); and **resolution #8** — no bootstrap mechanism, roles assigned by direct database manipulation, carried as a cookie claim, validated at the controller level, propagating to live sessions *only* via the 30-minute security-stamp revalidation (`architecture.md` §3); and **the outbound-mail throttle's key** — after the #19 override two endpoints produce `Confirmation` mail, so the throttle is keyed on `(purpose, userId)` rather than `(endpoint, userId)` to stop the two being alternated against one address (`architecture.md` §7). |
> | **Luigi** (Frontend Developer) | Phases 3 and 4 — the two-shell route restructure, `canMatch` guards, the three interceptors (including the requirement that `authErrorInterceptor` not genericise the login endpoint's own failures), `AuthService` signal design, the Profile page, and the `page-layout` user-menu/nav rework. |
> | **Bowser** (Backend Developer / DevOps) | Phases 0, 1, 2, and 6 — the `IdentityDbContext` base-class change and snake_case mapping, middleware order, the rate-limiter configuration binding and the per-account resend throttle, the query-filter mechanism and the ~30 missing service guards, and the deployment configuration. |
>
> This satisfies and extends the `security-review` ceremony in `.squad/ceremonies.md`.

**Scope:** make per-user data ownership possible, and add authentication. Anything beyond that is out
of scope — see `README.md`.

**Phases 0–4 are intended to land on a feature branch. Nothing is publicly deployed until Phase 6.**
This removes several otherwise-artificial sequencing constraints — most importantly, the API becomes
fail-closed at the end of Phase 1, well before the Angular app knows how to log in. That's fine on a
branch and would not be fine in production.

---

## Decisions

All resolved. `open-questions.md` holds the owner's answers to the 16 questions plus the two
follow-ups, with rationale for the two that went against the recommendation and for the one (#7) that
was answered and then corrected.

| # | Question | Decision |
|---|---|---|
| 1 | **Auth mechanism** | ASP.NET Core Identity + cookie authentication, with hand-written API controllers. Not `MapIdentityApi<T>()` (no logout endpoint — contradicts requirement #7), not an external IdP, not hand-rolled. `architecture.md` §1. |
| 2 | **Hosting topology** *(owner resolution #1)* | Single origin — the API serves the built Angular app. Makes the cookie first-party, removes CORS from production, and lets Angular's built-in XSRF support work. `architecture.md` §2. |
| 3 | **Identity in the existing DbContext, not a separate one** | `MotwDbContext : IdentityDbContext<AppUser, AppRole, Guid>`. A separate `AuthDbContext` would give bounded-context separation but EF cannot express a cross-context FK, and `owner_id → users.id` is wanted as a real constraint. One migration history. |
| 4 | **Key type** | `Guid` for `AppUser`/`AppRole` (`IdentityUser<Guid>`/`IdentityRole<Guid>`), matching every existing entity's `Guid Id`. Not the default `string`. |
| 5 | **Identity table naming** | Snake_case, mapped explicitly after `base.OnModelCreating(...)`: `users`, `roles`, `user_roles`, `user_claims`, `user_logins`, `user_tokens`, `role_claims`, `data_protection_keys`. Matches the existing convention (`monster_attack_weapon_tags` etc.). |
| 6 | **Login identifier** *(owner resolution #17 — confirmed)* | **Email**, not a separate username. `RequireUniqueEmail = true`, `UserName = Email` at registration, login resolves via `FindByEmailAsync`. The owner has confirmed email/password is the auth mechanism and that "username" was being used loosely for the login identifier; there is no `username` field anywhere in the codebase. Settled. `architecture.md` §1. |
| 7 | **Authorization expression** | Named policies (`"DataAdmin"`, `"SuperAdmin"`) registered once via `AddAuthorizationBuilder`, plus a **global fallback policy** of `RequireAuthenticatedUser`. No `[Authorize(Roles = "…")]` string literals. `architecture.md` §3. |
| 8 | **Roles** | `SuperAdmin`, `Admin`, `User`, persisted in Identity's role tables, **role rows** seeded by `MotwDbInitializer`. Constants in a `static class Roles`. |
| 9 | **Role assignment / bootstrap** *(owner resolution #8 — changed from recommendation)* | **No bootstrap mechanism.** No config allowlist, no seeded user. The owner registers normally, confirms their address, then a `SuperAdmin` row is inserted into `user_roles` **by hand in the database**. Ongoing assignment thereafter goes through the super-admin Users panel (#11). `architecture.md` §3. |
| 10 | **Role-change propagation to live sessions** *(follows from #9)* | Role claims live in the encrypted cookie. `SecurityStampValidator` regenerates the principal from the database once per `ValidationInterval` (**30 minutes**), so a database role change takes effect within 30 minutes automatically, or immediately on sign-out/sign-in. Forcing immediate revocation = change that user's `security_stamp`. **This is the only propagation path.** `architecture.md` §3. |
| 11 | **Role management UI** *(owner resolution #13 — changed from recommendation)* | Ships as a **super-admin-only panel inside the existing Data Admin page**, not as a separate surface or a separate phase. `GET /api/admin/users` + `PUT /api/admin/users/{id}/roles`, both `[Authorize(Policy = "SuperAdmin")]`. Guard rails: can't demote yourself, can't demote the last super-admin. **Phase 4.** |
| 12 | **Owned entities** *(owner resolution #3)* | Exactly four `owner_id` columns: `mysteries`, `monsters`, `locations`, `bystanders`. `Minion` derives via `Monster.OwnerId` — not denormalised. Per-record, no campaign/container. `data-ownership.md` §1–2. |
| 13 | **Ownership enforcement** | EF Core global query filters on the four roots + `Minion`, driven by an `ICurrentUser` injected into `MotwDbContext` — **not** per-repository `.Where()` clauses. Decisive reason: the five `ISearchProvider`s query the DbContext directly and would otherwise leak. `data-ownership.md` §4. |
| 14 | **Admin data visibility** *(owner resolution #4)* | Admins see only their own game data. No query-filter bypass exists anywhere; `IgnoreQueryFilters()` banned in domain code. `data-ownership.md` §5. |
| 15 | **Owner FK delete behaviour** *(owner resolution #12)* | `ON DELETE RESTRICT`, and no user-deletion endpoint in v1. Deactivation via lockout covers the realistic case. `data-ownership.md` §3. |
| 16 | **Reference data** *(owner resolution #5)* | Stays global. `ReferenceController` GETs open to any authenticated user (every form depends on them); POSTs gated to `DataAdmin`. **Accepted regression: ordinary users lose the ability to add reference types.** `architecture.md` §3. |
| 17 | **Existing local data** *(owner resolution #2)* | Nullable `owner_id` → committed one-time `docs/seeds/backfill-owner-id.sql` → `NOT NULL` migration. Backfill is a script, never startup code. Production starts empty; backfill is local-only. `data-ownership.md` §6. |
| 18 | **Email confirmation** *(owner resolution #7 — answered "no", then corrected to the recommendation)* | **Required before first login.** `RequireConfirmedAccount = true`. The account cannot sign in until the emailed link is followed. The first answer ("not a gate") was a misreading — the owner was rejecting an emailed code on *every* login, not a one-time verification at enrollment. Everything derived from that premise was **re-derived**, not patched: see #19 (reset for unconfirmed), #23 (login enumeration), #24 (registration cap). Cost carried: an ordering hazard on first deploy, closed by `LoggingEmailSender` locally and a documented `UPDATE users SET email_confirmed = true` break-glass in production. `architecture.md` §5. |
| 19 | **Password reset for unconfirmed accounts** *(follow-up #19 — **owner override**)* | **`forgot-password` sends a fresh *confirmation* link** (24h token) to an unconfirmed account, not a reset link and not nothing. The recommendation was a silent no-op; the owner overrode it because the silent success is a dead end — success message, no mail, no way to find out why. **Reset itself stays blocked:** no reset token is ever issued to an unconfirmed account and `reset-password` rejects one. Three constraints this carries: the 200 response is **byte-identical** across all three branches; the mail copy must explain why a reset request produced a confirmation link (five mandatory requirements, `architecture.md` §5); and the link lands on `/login` with a "still need to reset?" link rather than chaining into a reset form — chaining would make a 24h confirmation token act as a 24h reset token against a deliberate 1h reset lifetime. `architecture.md` §5. |
| 20 | **Resend-confirmation flow lives on the unauthenticated side** *(follows from #18)* | `POST /api/auth/resend-confirmation`, `[AllowAnonymous]`, always 200, sends only if the account exists and is unconfirmed. Reachable from a `/resend-confirmation` route and inline from the login page's unconfirmed response. **Not on the Profile page** — an authenticated user is confirmed by definition, so it would be dead UI. `emailConfirmed` is correspondingly dropped from `/api/auth/me`. `architecture.md` §4, §6. |
| 21 | **Token lifetimes** | Email confirmation 24h (default provider); password reset 1h (second, named `DataProtectorTokenProvider` with its own options — Identity's default lifespan is global per provider). An expired confirmation link is not a dead end; #20's resend issues a fresh one. |
| 22 | **Email delivery** *(owner resolution #6)* | `IEmailSender` abstraction, selected by `Email:Provider` configuration. `LoggingEmailSender` when running locally (zero external dependency); **`ResendEmailSender`** in production over Resend's HTTP API, with a verified sending domain (SPF + DKIM). Under #18 this is load-bearing: no email delivery means no new accounts. |
| 23 | **Login responses and account enumeration** *(owner resolution #15 + follow-up #18)* | Wrong password, nonexistent account, and locked-out collapse to one generic message. **Correct password + unconfirmed email returns a distinct `email_not_confirmed` response** with an inline resend action — safe because the branch is only reachable after the password is proven. **Implementation is load-bearing:** `NotAllowed` is returned pre-password-check, so it must be paired with an explicit `CheckPasswordAsync`; wiring `IsNotAllowed` straight through leaks the state for any password. **Boo's review item.** `architecture.md` §7. |
| 24 | **Registration cap** *(owner resolution #9)* | Open registration, capped at **10 registrations per day**, configurable via `Auth:Registration:MaxPerDay` in `appsettings.json`, bound through `IOptionsMonitor<RegistrationOptions>` inside the rate-limiter partitioner so it can change without a restart. Global (endpoint-wide) fixed 24h window, not per-IP — *re-derived* under #18: the resource at risk is outbound email quota and sender reputation, which is a global resource. `architecture.md` §7. |
| 25 | **Resend throttle** | `resend-confirmation` gets the per-IP `"auth"` limiter **plus** a per-account throttle (at most one resend per few minutes). It is anonymous and sends mail to a caller-named address; the per-IP limit alone doesn't stop mail-bombing from a rotating source. `architecture.md` §7. |
| 26 | **Password policy** *(owner resolution #10)* | 12-character minimum, 4 unique characters, no composition requirements (NIST SP 800-63B). HaveIBeenPwned validator not taken up; remains a clean later addition. |
| 27 | **Session lifetime** *(owner resolution #11)* | 14-day sliding expiration, persistent cookie, **no "Remember me" checkbox**, 30-minute security-stamp revalidation. |
| 28 | **CSRF** | Three layers, all required: `SameSite=Lax` cookie + globally-registered `AutoValidateAntiforgeryTokenAttribute` with `X-XSRF-TOKEN` header + strict credentialed CORS (development only). `architecture.md` §7. |
| 29 | **Data Protection keys** | Persisted to Postgres via `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` with an explicit application name. **Phase 0**, not Phase 6 — getting it wrong fails silently as "users keep getting logged out," which under decision #10 is indistinguishable at a glance from normal role-propagation behaviour. |
| 30 | **Secrets** *(owner resolution #14)* | Environment variables with the `__` separator in production; `dotnet user-secrets` locally. `Auth:Registration:MaxPerDay` is *not* a secret and stays a committed, overridable default in `appsettings.json`. |
| 31 | **Angular route guards** | `canMatch`, not `canActivate`, on both shells and on `data-admin` — so unauthenticated visitors never download the seven lazy feature bundles. |
| 32 | **Angular auth state** | Signals in a root `AuthService` (`user`, `isAuthenticated`, `isAdmin`, `isSuperAdmin`), seeded once at bootstrap by `provideAppInitializer` calling `GET /api/auth/me`. No client-side token storage — the cookie is `HttpOnly`, so the server is the only source of truth. Mirrors the existing `ThemeService.initialize()` wiring. |
| 33 | **`withCredentials`** | Set by a `credentialsInterceptor`, not inside `ApiService` — because `HealthService` (`core/health.ts`) calls `HttpClient` directly and bypasses `ApiService`. |
| 34 | **Profile page location** | `pages/profile/`, not `features/profile/` — matches the established split (`pages/*` = single cross-cutting app-level views registered via direct `loadComponent`; `features/*` = domain verticals with their own `*.routes.ts`). Auth pages *are* a domain vertical, so they go in `features/auth/`. |
| 35 | **Test strategy** | Phase 2 adds `Microsoft.AspNetCore.Mvc.Testing` + a `WebApplicationFactory` fixture + `CrossOwnerAccessTests`. The existing fake-based unit tests structurally cannot prove ownership isolation. `data-ownership.md` §7. |
| 36 | **Theme preference** *(owner resolution #16)* | No work. Stays in `localStorage` exactly as `core/theme.ts` implements it today. |

---

## Phase 0 — Identity foundations

**Risk: Medium.** No user-visible change, but it rewrites the DbContext base class and the model
snapshot.

1. `MonsterOfTheWeek.Api.csproj`: add `Microsoft.AspNetCore.Identity.EntityFrameworkCore` and
   `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` (both 10.0.x, matching the existing
   EF/Npgsql pins). Identity's core abstractions are already in the shared framework.
2. New `Data/Entities/AppUser.cs`, `AppRole.cs` — `IdentityUser<Guid>` / `IdentityRole<Guid>`, no
   extra properties yet.
3. New `Authorization/Roles.cs` — `SuperAdmin`, `Admin`, `User` constants.
4. `MotwDbContext` → `IdentityDbContext<AppUser, AppRole, Guid>`, implementing
   `IDataProtectionKeyContext`. **`OnModelCreating` must gain `base.OnModelCreating(modelBuilder);`
   as its first statement** — it currently has none (line 52). Then map all Identity tables plus
   `data_protection_keys` to snake_case names and columns, in the same explicit style as the other
   31 entity configurations.
5. `Program.cs`: `AddIdentityCore<AppUser>()` … `.AddRoles<AppRole>().AddEntityFrameworkStores<MotwDbContext>()
   .AddSignInManager().AddDefaultTokenProviders()`, plus the second named token provider for password
   reset (decision #21); `AddDataProtection().PersistKeysToDbContext<MotwDbContext>()
   .SetApplicationName("MonsterOfTheWeek")`.
6. `MotwDbInitializer`: new `SeedRolesAsync` step, same shape as the existing `SeedLookupTablesAsync`
   (`if (!await …AnyAsync()) { AddRange(…) }`). **Seeds the three role rows only — it creates no
   users and promotes nobody** (decision #9).
7. New migration `AddIdentity`.

**Independently verifiable:** `dotnet ef migrations script` applies cleanly; the app starts; the
three role rows exist in `roles`; every existing endpoint behaves exactly as before; the existing
test suite passes unchanged.

**Watch for:** the test project builds `MotwDbContext` against SQLite — Identity's tables must
materialise there too. Confirm the existing `MonsterRepositoryTests` still passes before moving on.

---

## Phase 1 — Auth endpoints, cookie session, and hardening

**Risk: Medium.** Ends with the API fail-closed.

1. `Contracts/AuthContracts.cs` — request/response records matching the existing
   `ApiContracts.cs` style (positional records, `[Required]`/`[StringLength]` DataAnnotations
   consistent with the five completed required-field-validation phases). Login takes `email`
   (decision #6). The login response carries a machine-readable failure code so the client can
   distinguish `email_not_confirmed` from the generic failure (decision #23).
2. `Services/IAuthService.cs` + `AuthService.cs` — register, login, logout, confirm-email,
   resend-confirmation, forgot-password, reset-password, change-password, get-current-user. Returns
   `ServiceResult<T>`, matching every other service in the project. Assigns the `User` role at
   registration; **no allowlist check, no auto-confirm, no promotion logic** (decision #9).
   - `Login` must use the `PasswordSignInAsync` → `IsNotAllowed` → `CheckPasswordAsync` sequence
     from `architecture.md` §7. **Do not wire `IsNotAllowed` straight through** (decision #23).
   - `ForgotPassword` branches on `IsEmailConfirmedAsync` (decision #19): confirmed → reset mail
     (1h token); unconfirmed → **confirmation** mail (24h token, no reset token); no account →
     nothing. **All three return the identical 200** — see the enumeration invariant in §5.
   - `ResendConfirmation` sends only for existing, unconfirmed accounts, and applies the per-account
     throttle (decision #25). That throttle is keyed on **`(purpose, userId)`**, so it shares one
     `Confirmation` budget with `ForgotPassword`'s unconfirmed branch — per-endpoint budgets could be
     alternated to double the rate against one address.
3. `Controllers/AuthController.cs` + `AccountController.cs` — thin, translating `ServiceResult<T>` to
   `ActionResult` exactly as the existing six controllers do. `architecture.md` §4 has the route
   table.
4. `Services/Email/IEmailSender.cs` + `LoggingEmailSender.cs`, selected by `Email:Provider`. The
   `ResendEmailSender` can be stubbed here and completed in Phase 6.
5. `Options/RegistrationOptions.cs` + `builder.Services.Configure<RegistrationOptions>(
   builder.Configuration.GetSection("Auth:Registration"))`, and the `MaxPerDay: 10` default added to
   `appsettings.json` (decision #24).
6. `Program.cs`:
   - `AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies()` with the cookie
     options from `architecture.md` §1, **including the `OnRedirectToLogin`/`OnRedirectToAccessDenied`
     overrides that return bare 401/403 instead of a 302.**
   - `Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.FromMinutes(30))`
     — load-bearing for role propagation (decision #10), not just a security knob.
   - `AddAuthorizationBuilder()` with the two policies and the fallback policy.
   - `AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN")` + global
     `AutoValidateAntiforgeryTokenAttribute`.
   - `AddRateLimiter` with the `"registration"` policy (global 24h window, limit from
     `IOptionsMonitor`) and the per-IP `"auth"` policy covering login, forgot-password,
     reset-password, and resend-confirmation.
   - Identity password/lockout/sign-in options — **including `RequireConfirmedAccount = true`**
     (decision #18) and `User.RequireUniqueEmail = true`.
   - Middleware reordered per `architecture.md` §7.
   - `[AllowAnonymous]` on the auth endpoints (including `resend-confirmation`) and `/health/live`.
7. `MonsterOfTheWeek.Api.http` — add the new routes (the file already documents the existing API),
   including the CSRF-then-login sequence so Phase 3 has a known-good reference.

**Independently verifiable:** register → **attempt to log in before confirming and get the distinct
`email_not_confirmed` response with the correct password, and the generic failure with a wrong one**
(decision #23 — this is the single most important behaviour to verify by hand here) → follow the
logged confirmation link → log in successfully → `GET /api/auth/me` returns `roles: ["User"]` and no
`emailConfirmed` field → every domain endpoint 401s without the cookie and 200s with it → logout →
the same endpoint 401s again. Then: `forgot-password` for an unconfirmed account returns 200 and
queues a **confirmation** mail, byte-identical to the response for a confirmed account and for an
address that doesn't exist; `resend-confirmation` draws on the same `Confirmation` budget. Then:
insert a `SuperAdmin` row by hand, sign out and
back in, confirm `/api/auth/me` reports the new role. All exercisable from the `.http` file before
any Angular work exists.

**Watch for:** the antiforgery filter will reject the auth `POST`s themselves unless
`GET /api/auth/csrf` is called first.

---

## Phase 2 — Data ownership

**Risk: HIGH.** The only phase whose failure mode is silent. Should run in its own branch and get a
dedicated review pass from Bowser and Boo.

1. `IOwnedEntity` in `DomainEntities.cs`; implemented by `Mystery`, `Monster`, `Location`,
   `Bystander`.
2. `Authorization/ICurrentUser.cs` + `HttpContextCurrentUser` + `NullCurrentUser`;
   `AddHttpContextAccessor()`.
3. `MotwDbContext` takes `ICurrentUser`; five `HasQueryFilter` calls
   (`data-ownership.md` §4); `owner_id` column mappings + indexes. **No admin bypass expression**
   (decision #14).
4. **`MotwDbContextFactory` must pass `NullCurrentUser`** — build-breaking otherwise
   (`Data/MotwDbContextFactory.cs` line 26).
5. Migration A: nullable `owner_id` + FK (`Restrict`) + index on all four tables.
6. Set `OwnerId` at the ~8 create call sites (`MysteryService.CreateAsync`,
   `MonsterService.CreateAsync` ×2 overloads, `LocationService.CreateAsync` ×2,
   `BystanderService.CreateAsync` ×2). Minions need none — derived.
7. **Close the sub-resource guard gap** (`data-ownership.md` §4): add the missing parent-existence
   guard to every service method that takes a parent id and currently relies only on the
   repository's parent-scoped query. Roughly 30 methods across the five services; one line each.
8. Verify the three bridge/link paths check **both** sides
   (`MonsterService.LinkToMysteryAsync` and the location/bystander equivalents).
9. `docs/seeds/backfill-owner-id.sql`; run it against the local database (`data-ownership.md` §6).
10. Migration B: `owner_id` → `NOT NULL`.
11. Test project: add `Microsoft.AspNetCore.Mvc.Testing`, a `WebApplicationFactory` fixture with a
    settable `ICurrentUser`, and `Tests/Authorization/CrossOwnerAccessTests.cs` per the checklist in
    `data-ownership.md` §7.

**Independently verifiable:** two seeded users; every assertion in the `CrossOwnerAccessTests`
checklist green, **including the search assertion** — global search is the highest-value regression
target here because it bypasses the repository layer entirely.

---

## Phase 3 — Angular auth shell

**Risk: Medium.** Restructures the top-level route table.

1. `core/auth.ts` — `AuthService` with the signals from `architecture.md` §6 (including
   `isSuperAdmin` for Phase 4's Users panel), plus
   `login`/`register`/`logout`/`forgotPassword`/`resetPassword`/`confirmEmail`/
   `resendConfirmation`/`refresh`.
2. `core/auth-models.ts` — request/response interfaces, matching `core/models.ts` conventions,
   including the login failure-code union.
3. `core/credentials-interceptor.ts`, `core/auth-error-interceptor.ts`. **The latter must not
   swallow or genericise the login endpoint's own failures** — the `email_not_confirmed` response
   has to reach the login component so it can render an inline resend link (decision #23).
4. `core/auth-guards.ts` — `authenticatedMatch`, `anonymousMatch`, `adminMatch` (`CanMatchFn`).
5. `layout/auth-layout/` — bare shell using the existing token utilities.
6. `features/auth/` pages: `login`, `register`, `forgot-password`, `reset-password`,
   **`resend-confirmation`**, `confirm-email`, with their own `auth.routes.ts`.
   - Registration success lands on `/login` with a "check your email to confirm your address before
     signing in" note. **No auto-sign-in** — there is nothing to sign into yet (decision #18).
   - The login page renders the `email_not_confirmed` case distinctly, with an inline resend action
     (decision #23). Under the #19 override this is no longer the *only* recovery path — an
     unconfirmed user who takes the forgot-password route now receives a usable link too.
   - `confirm-email` and `reset-password` must tolerate an already-signed-in visitor rather than
     being bounced by `anonymousMatch` (`architecture.md` §6).
   - No "Remember me" checkbox (decision #27). All other login failures show one generic message.
7. `app.routes.ts` — the two-shell structure from `architecture.md` §6.
8. `app.config.ts` — `withXsrfConfiguration`, the three interceptors in order, and the
   `AuthService.initialize()` app initializer next to the existing `ThemeService` one.
9. Specs: guards, `AuthService`, both new interceptors, the login component's two failure branches,
   plus updates to `app.routes.spec.ts`.

**Independently verifiable:** logged out, `/dashboard` redirects to `/login` and no feature chunk is
requested (check the network tab); registering then attempting to sign in shows the
confirm-your-email message with a working resend link; confirming then signing in lands on
`/dashboard`; a forced 401 mid-session bounces to `/login` with `returnUrl` preserved and produces no
error toast; a 403 shows one notification and does *not* sign the user out.

---

## Phase 4 — Profile, Sign out, Data Admin gating, and the super-admin Users panel

**Risk: Low.** Absorbs what was previously a separate Phase 5 (decision #11).

1. `pages/profile/` — email, role list, and a change-password reactive form. `hasSubmitted` signal +
   `markAllAsTouched()` pattern, matching `data-admin.ts`. **No `emailConfirmed` display and no
   resend affordance** — an authenticated user is confirmed by definition under decision #18, so
   both would be dead UI (decision #20).
2. `page-layout.html` line 104: `href="#"` → `routerLink="/profile"` + `closeUserMenu()`.
3. `page-layout.html` line 111: `href="#"` → a `<button>` calling `signOut()`.
4. `page-layout.ts`: inject `AuthService`; `signOut()`; avatar initial (line 100) derived from
   email; `navItems` becomes a `computed()` filtering `Data Admin` on `isAdmin()` — affects both the
   desktop nav (lines 7–31) and the mobile nav (lines 54–73), which share the array.
5. `app.routes.ts`: `canMatch: [adminMatch]` on `data-admin`; new `profile` route.
6. `ReferenceController`: `[Authorize(Policy = "DataAdmin")]` on the **seven POST actions only**.
7. **Users panel inside the Data Admin page** (decision #11): new
   `pages/data-admin/components/user-admin/`, rendered only when `isSuperAdmin()`, alongside the
   existing `weapon-tag-admin` panel and matching its plain-table style. Backed by
   `GET /api/admin/users` and `PUT /api/admin/users/{id}/roles`, both
   `[Authorize(Policy = "SuperAdmin")]`, in a new `Controllers/AdminUsersController.cs` +
   `Services/IUserAdminService.cs`.
   - Guard rails: a super-admin cannot remove their own `SuperAdmin` role; the last remaining
     super-admin cannot be demoted.
   - **The panel must tell the operator that a role change takes up to 30 minutes to reach a
     signed-in user, or applies immediately on their next sign-in** (decision #10). Without that
     line this reads as a bug the first time it's used.
8. `page-layout.spec.ts` / `data-admin.spec.ts` updates; new `user-admin.spec.ts`.

**Independently verifiable:** a non-admin sees no Data Admin nav item, cannot reach `/data-admin`,
and gets a 403 from a direct `POST /api/monster-types` — while reference-data **GET**s still work for
them, so every create form still populates. An `Admin` sees the reference-type panels but not the
Users panel, and `GET /api/admin/users` 403s for them. A `SuperAdmin` sees both.

---

## Phase 5 — retired

Role management folded into Phase 4 (decision #11). The number is retired rather than reused so that
Phase 6 keeps its identity in existing references.

---

## Phase 6 — Deployment configuration

**Risk: Medium-High.** Config only, but the failure modes are subtle and mostly invisible in
development.

> **The project owner will run a separate focused analysis and plan for this phase before deploying
> to production.** The items below are the known inputs to that analysis, not a finished plan.

1. `Program.cs`: serve the SPA (`UseDefaultFiles` + `UseStaticFiles` + `MapFallbackToFile`), scope
   the CORS policy to Development, add `UseHsts` and `UseForwardedHeaders` (with
   `KnownProxies`/`KnownNetworks` — required for the per-IP rate limiters to work) in Production.
2. **Deferred frontend build work, carried here rather than treated as current work:**
   `src/environments/environment.ts` hardcodes `http://localhost:5225`; there is **no** production
   environment file and **no** `fileReplacements` entry under
   `angular.json` → `build.configurations.production`. The app has never been built against a
   non-local API. Under the single-origin topology the production value is a relative `''`.
3. Production configuration via environment variables: `ConnectionStrings__Postgres`, `Email__*`,
   `App__PublicBaseUrl`, `AllowedHosts`. `Auth:Registration:MaxPerDay` stays in `appsettings.json`
   (not a secret) and can be overridden per environment.
4. Complete and wire `ResendEmailSender`; verify the sending domain (SPF + DKIM) and send a real test
   confirmation and reset mail. **Under decision #18 this gates account creation entirely** — it is
   not optional polish, and it should be verified before the URL is shared with anyone.
5. Build pipeline: `ng build --configuration production` output copied into the API's `wwwroot`.
6. **Runbook — first production account.** Register through the public flow, confirm the address
   (or apply the break-glass `UPDATE users SET email_confirmed = true …` if Resend isn't live yet),
   then `INSERT` the `SuperAdmin` row by hand (`data-ownership.md` §6). Under decision #9 this is the
   only way to create the first administrator, and it will be needed again on any fresh environment.
   Record the `security_stamp` reset procedure alongside it (decision #10).

**Independently verifiable:** a full register → confirm-by-real-email → sign in → change password →
forgot password → reset → sign in flow against the deployed instance, with the app restarted midway
to prove Data Protection key persistence works.

---

## Risk register

| Risk | Phase | Impact | Mitigation |
|---|---|---|---|
| A missed ownership filter leaks another user's data | 2 | **Critical, silent** | Query filters at the model level (not per-query); `CrossOwnerAccessTests` including a search-endpoint case; explicit ban on `IgnoreQueryFilters()` in domain code |
| Sub-resource update/delete by known GUID pair bypasses ownership | 2 | High, silent | The ~30 missing parent-existence guards are an explicit, enumerated work item — not an emergent property |
| **`IsNotAllowed` wired straight through, leaking "registered and unconfirmed" for any password** *(decision #23)* | 1 | Medium, silent enumeration oracle | The `CheckPasswordAsync` pairing is spelled out in `architecture.md` §7 and called out as a Phase 1 step. **Boo review item**; also the one behaviour Phase 1's manual verification leads with |
| **Anonymous `resend-confirmation` used to mail-bomb an address** *(decision #25)* | 1 | Medium | Per-IP limiter *plus* a per-account throttle; the per-IP limit alone doesn't stop a rotating source |
| **Email delivery broken on first deploy ⇒ nobody can register, including the owner** *(decision #18 × #9)* | 1 / 6 | High on first deploy, recoverable | `LoggingEmailSender` makes local dev independent of it; production has the documented `UPDATE users SET email_confirmed = true` break-glass next to the `SuperAdmin` `INSERT` |
| **Role change doesn't appear to take effect** *(decision #10)* | 1 / 4 | Medium, reads as a bug | 30-minute security-stamp revalidation is the only propagation path; the Users panel must say so, and "sign out and back in" is the documented immediate answer |
| **No administrator exists / super-admin locked out** *(decision #9)* | 1 / 6 | High, recoverable only with DB access | Direct `INSERT` into `user_roles` is the documented bootstrap; guard rails prevent demoting the last super-admin through the UI; runbook item in Phase 6 |
| **Confirmation mail sent from forgot-password reads as phishing** *(decision #19)* | 1 | Medium — user was primed to click a link they didn't request | The five mandatory copy requirements in `architecture.md` §5 exist for this; the mail must name the action the user took and explain why the link is a confirmation rather than a reset. Recommended wording provided. Verify the sent copy in Phase 1, not Phase 6 |
| **`Confirmation` mail budget alternated between two endpoints** *(decision #19 × #25)* | 1 | Medium, silent | Throttle keyed on `(purpose, userId)` rather than `(endpoint, userId)`, so one budget covers `register`, `resend-confirmation`, and `forgot-password`'s unconfirmed branch. **Boo review item** — a fourth mail-producing path added later without registering against the right purpose reopens it |
| Registration cap self-DoS — someone burns the day's 10 | 1 | Low | Only registration uses the global limiter; login/forgot/reset/resend keep separate per-IP limits, so existing users are never blocked. `MaxPerDay` is live-changeable via `IOptionsMonitor` |
| Data Protection keys not persisted | 0 / 6 | High, intermittent, hard to diagnose | Persist to Postgres in Phase 0; verify by restarting the app mid-session in Phase 6. Note the confusability with decision #10's normal behaviour |
| Cookie never reaches the API (SameSite / credentials / CORS) | 3 / 6 | High, blocks login entirely | Single-origin production topology; `credentialsInterceptor`; the Phase 1 `.http` file as a known-good non-browser reference |
| Antiforgery rejects every mutation | 1 / 3 | High | Global filter registered in Phase 1 and exercised from the `.http` file before any Angular code depends on it |
| Cookie handler 302s instead of 401ing | 1 | Medium, confusing | Explicit `OnRedirectToLogin`/`OnRedirectToAccessDenied` overrides, called out as mandatory |
| Reference-data GETs accidentally gated | 4 | High — breaks every create form | Gate the seven POSTs only; explicit non-admin verification step |
| `/health/live` gated by the fallback policy | 1 | Medium — permanent "API unavailable" modal for logged-out users | `[AllowAnonymous]`, explicitly listed |
| Signed-in user bounced off a stale confirmation/reset link by `anonymousMatch` | 3 | Low, annoying | Called out explicitly in Phase 3 step 6 and `architecture.md` §6 |
| `MotwDbContextFactory` breaks on the `ICurrentUser` dependency | 2 | Low — build break | Enumerated as a step |
| Existing local data orphaned by the `NOT NULL` migration | 2 | Medium, recoverable | Migration B fails loudly if the backfill was skipped; backfill script is idempotent |

---

## Verification checklist

- [ ] Every domain endpoint returns 401 without a session cookie
- [ ] `/health/live` returns 200 without a session cookie
- [ ] **An unconfirmed account cannot sign in** (decision #18)
- [ ] **Correct password + unconfirmed returns the distinct `email_not_confirmed` response; a *wrong* password on the same unconfirmed account returns the generic failure** (decision #23 — the enumeration-safety test)
- [ ] Following the confirmation link enables sign-in
- [ ] An expired confirmation link can be replaced via `/resend-confirmation`
- [ ] **Forgot-password on an unconfirmed account returns 200 and sends a *confirmation* mail**; the response is byte-identical to the confirmed-account and no-such-account cases (decision #19)
- [ ] **No password-reset token is issued to an unconfirmed account**, and `reset-password` rejects one (decision #19)
- [ ] The confirmation mail sent from forgot-password explains why it isn't a reset link (decision #19, `architecture.md` §5)
- [ ] Following that link lands on `/login` with a "still need to reset your password?" link — it does **not** drop into a reset form (decision #19)
- [ ] `resend-confirmation` is throttled per account, not just per IP (decision #25)
- [ ] **Alternating `resend-confirmation` and `forgot-password` against one unconfirmed address does not exceed the single `Confirmation` budget** (decision #19 × #25 — the alternation-bypass test)
- [ ] Reference-data GETs succeed for a plain `User`; reference-data POSTs return 403
- [ ] `/data-admin` is unreachable for a plain `User` and its lazy chunk is never fetched
- [ ] An `Admin` sees the reference panels but not the Users panel; `GET /api/admin/users` 403s for them
- [ ] A `SuperAdmin` cannot demote themselves, and cannot demote the last super-admin
- [ ] **A `SuperAdmin` row inserted directly into `user_roles` reaches a signed-in session within 30 minutes, and immediately on re-login** (decision #10)
- [ ] Register → confirm → sign in → sign out → the same session cookie no longer authenticates
- [ ] Change password → this session survives; a second browser's session dies within the security-stamp validation interval
- [ ] Forgot-password returns an identical response for a real and a nonexistent address
- [ ] Register returns an identical response for a new and an already-registered address
- [ ] Login returns an identical response for wrong-password, nonexistent, and locked-out (decision #23)
- [ ] The 11th registration in a 24-hour window is rejected; raising `Auth:Registration:MaxPerDay` takes effect without a restart
- [ ] A burned registration budget does not prevent existing users signing in or resetting passwords
- [ ] User A cannot read, update, or delete any of User B's mysteries, monsters, minions, locations, bystanders, **or any of their sub-resources**
- [ ] User A cannot link User B's monster/location/bystander into User A's mystery
- [ ] `GET /api/search?q=` and `GET /api/search/quick?q=` never return User B's rows to User A
- [ ] Six failed logins lock the account for 15 minutes without revealing lockout in the response
- [ ] Restarting the API does not sign existing users out
- [ ] All pre-existing API tests and all pre-existing Angular specs still pass
