# Simple Authentication — Minimal Public-Web Gate

Design docs for the **smallest thing that lets the owner deploy Monster of the Week to the public web
and be the only person who can get in.** One hand-inserted credential row, one login page, one cookie
session, and access control on both sides.

**Status: design complete; frontend and backend reviews both done and closed.** All six open questions
have been resolved by the project owner — #1–#5 on 2026-08-18, #6 on 2026-08-23 — and are folded into
these documents; `open-questions.md` is a resolved decision record, not a pending list. **Luigi's review
of Phase 2 raised four blocking findings — all adopted — plus decisions #19 and #20 and one scope
question (`open-questions.md` #5), which the owner answered the same day in favour of the
recommendation. Bowser's review of Phases 0, 1 and 3 (2026-08-19) raised three further blocking
findings — all in Phase 3, all adopted and folded in — plus ten non-blocking corrections and one
question (`open-questions.md` #6), resolved against a comparison with the owner's already-deployed
`portfolio` app.** Nothing from either round is outstanding. No application code has been written or
modified.

Settled in that round: the login identifier is **email** (which removes the only conflict this design
had with `docs/authentication-update/`); **Sign out is in scope**; **existing local game data does not
move to production** — the owner will recreate it by hand; and the **24-hour sliding session stands
unchanged**, with its one consequence (no draft persistence, so an overnight lapse mid-wizard loses the
current phase) knowingly accepted rather than designed around. The owner separately confirmed
**single-origin hosting** and that the **SPA shell is served to anyone**, with the Angular app rendering
its own login view — which turned the `MapFallbackToFile` fail-closed finding from a flagged risk into
a worked fix (`architecture.md` §2.3).

`phases.md` names the recommended reviewers and their focus. Nothing inside the design is open. What
stands between it and a live deployment is deliberately outside it: the remaining infrastructure work —
a domain, database access for the credential row, backups and the Railway environment variables
(`architecture.md` §4.3) — and, at the owner's discretion, Boo's `security-review` ceremony.

**The development loop does not involve Docker.** `docker compose up -d postgres`, `dotnet run`,
`npm start`, browse `http://localhost:4200` — `ng serve`'s hot reload, with the dev proxy making it
single-origin so the session cookie works. `docker build` is for shipping only. `architecture.md` §4.4.

> ## Review gate
>
> | Reviewer | Status |
> |---|---|
> | **Luigi** (Frontend Developer) — Phase 2 | ✅ **Complete, 2026-08-18. Four blocking findings, all adopted and folded in. The one scope question referred to the owner (`open-questions.md` #5) was answered the same day in favour of the recommendation. Nothing outstanding.** |
> | **Bowser** (Backend Developer / DevOps) — Phases 0, 1, 3 | ✅ **Complete, 2026-08-19. Three blocking findings, all in Phase 3, all adopted and folded in. The one question referred to the owner (`open-questions.md` #6) was resolved on 2026-08-23 against a comparison with the owner's already-deployed `portfolio` app. Nothing outstanding.** |
> | **Boo** (Web Security Specialist) | Optional, the owner's call |
>
> ### ✅ Luigi's review — four blocking findings, all adopted (2026-08-18)
>
> **Same shape as his review of the robust plan: nothing in the design was wrong, four things were
> unreachable, and three of the four fail silently.** All four are folded directly into
> `architecture.md` and `phases.md` rather than left as a separate document; the audit trail is
> **`open-questions.md` → "Luigi review dispositions."**
>
> - **The interceptor array was in the wrong order, so the `401` toast fires anyway.** Angular builds
>   the chain with `reduceRight`, so the array is *request* order and the **last** entry is the **first**
>   to see an error response — `httpErrorInterceptor` toasted before `authErrorInterceptor` could
>   swallow. Now **decision #19**: `credentials → httpError → authError`. **This corrects the robust
>   plan too**, which carries the identical array and the identical "so no toast fires" claim, so the
>   fix carries forward instead of the bug shipping twice. `architecture.md` §3.3.
> - **The two-shell restructure orphans three app-wide concerns** that live inside `page-layout.html`:
>   the icon sprite (the only occurrence in `src/`), the toast host, and the API-availability probe and
>   modal. On the auth shell an `<app-icon>` renders **blank with no error**, toasts render nowhere, and
>   §2.2's stated symptom for a missing `/health/live` `AllowAnonymous` becomes impossible — which also
>   removes the **only** detector for the silent `/health` dev-proxy gap Phase 2 introduces. Now
>   **decision #20** and new `architecture.md` **§3.5**. The extent went to the owner as question #5 and
>   was confirmed the same day — *"I will take Luigi's recommendation; app root level is fine"* — so
>   **all three move up to `App`** (Phase 2 step 10b), which also answers the same still-open question
>   on the robust plan by construction.
> - **The login form had no error path except `invalid_credentials`.** Both interceptors skip
>   `/api/auth/` and the auth shell has no toast host, so the component is the only error surface in
>   the app for the login POST — and an API-down, a `500`, or the `/api/{**rest}` catch-all's `401` all
>   produced a **completely inert submit button**. The exact mirror of decision #14's `logout()`
>   finding. The robust plan already carries the fix as part of decision #37; this pass had dropped it.
>   `architecture.md` §3.4.
> - **`AuthService.initialize()` must *return* its observable** or bootstrap does not wait and every
>   claim in §2.3's proactive-guard column is false. `ThemeService.initialize()` — the adjacent line
>   §3.2 says to copy — returns `void`, compiles fine, and produces "signed in, but shown the login
>   page on every cold load," which reads as a cookie bug. `architecture.md` §3.2.
>
> **Findings 1 and 2 land together, as one unit** — the toast bug is masked today only because the toast
> host sits inside the shell being torn down, and hoisting the host to `App` is exactly what removes the
> mask. With #5 answered as option A, the ordering fix is not merely recommended but load-bearing.
>
> Eleven non-blocking items are folded in beside them (the dropped `returnUrl` on the proactive guard
> path and why it is what invites the declined `UrlTree`; the `401` burst guard; where the `user` signal
> is set; password-manager attributes on the login form, which §6's whole mitigation quietly depends on;
> `AuthLayoutComponent` conventions; and a handful of corrections). **Confirmed as sound rather than
> assumed:** §2.3's argument that the `canMatch` guard is still required, decision #14's `logout()`
> error path, `GET /api/auth/me` "always resolves", step 1's `core/api.spec.ts` claim, and decision
> #10's two-shell shape traced through all four navigation cases against the current `app.routes.ts`.
>
> ### ✅ Bowser's review — three blocking findings, all adopted (2026-08-19)
>
> **Same shape again, and all three land in Phase 3: nothing in the design is wrong, but three stated
> mitigations do not do what they say, and two of the three fail silently.** Phases 0 and 1 are sound as
> designed and needed only mechanical corrections. All three are folded directly into `architecture.md`
> and `phases.md`; the audit trail is **`open-questions.md` → "Bowser review dispositions."**
>
> - **`UseForwardedHeaders` as specified is inert behind any real proxy.** `ForwardedHeadersOptions`
>   defaults `KnownProxies`/`KnownNetworks` to **loopback only**, and the middleware discards the whole
>   forwarded entry — `X-Forwarded-Proto` included — at the first hop that isn't one. Behind a load
>   balancer, sidecar or CDN nothing is applied, so `SecurePolicy.Always` refuses to emit `motw.session`
>   and `UseHttpsRedirection` loops: **precisely the failure this step exists to prevent**, with the
>   checklist pointing at a line that is present and not working. Fix is `KnownNetworks.Clear();
>   KnownProxies.Clear();` — what the framework's own `ASPNETCORE_FORWARDEDHEADERS_ENABLED` shortcut
>   does, for this reason. **Corrects the robust plan too.** `architecture.md` §4.2 item 5.
> - **`app.UseRouting()` has to be added explicitly.** `Program.cs` never calls it, so routing is
>   inserted at the *front* of the pipeline. Phase 3 step 1's "before routing" is then unfollowable,
>   `UseDefaultFiles()` is dead code (the fallback's `{*path:nonfile}` matches `/`, and both static-file
>   middlewares no-op once an endpoint is matched), and **§2.3's diagnostic for the fatal missing
>   `AllowAnonymous` — "`/` keeps working while every deep link `401`s" — is false.** The deployment
>   works either way; what is lost is the only stated tell for the one failure the design calls
>   *unrecoverable*. `architecture.md` §2.3.
> - **The `ng build` → `wwwroot` step cannot be an MSBuild target inside `dotnet publish`.** The Web SDK
>   globs `wwwroot/**` into `Content` at *evaluation* time, so files created during the build are never
>   published — silently. The app deploys with **no SPA**, starts, passes a health probe, and `404`s
>   every route including `/login`. **Resolved 2026-08-23** (`open-questions.md` #6) against a comparison
>   with the owner's already-deployed `portfolio` app: **`ng build` writes straight into `wwwroot` via
>   `angular.json`'s `outputPath`**, `MonsterOfTheWeek.Api.csproj` is untouched, and the sequencing is a
>   **repo-root multi-stage `Dockerfile` deployed to Railway**. With no MSBuild target there is nothing
>   to mis-time — the finding is closed by construction, and the copy and clear-before-copy steps
>   disappear with it. `architecture.md` §4.2 items 2 and 2a.
>
> **The review's one question is resolved, and it settled the deployment shape with it.**
> `open-questions.md` #6 — how the publish step is sequenced — was answered on 2026-08-23 after
> examining `portfolio`, an already-deployed app of the owner's on the same stack (Angular +
> ASP.NET Core 10 + Postgres, single origin, on Railway from a repo-root Dockerfile). Its `.csproj`
> carries **zero** SPA-related MSBuild targets and its `angular.json` writes `ng build` output straight
> into `wwwroot`; its Docker stage boundary is what sequences the two. **All of that is adopted here** —
> `outputPath` → `wwwroot`, an untouched `.csproj`, and **Railway + a repo-root multi-stage Dockerfile
> as the confirmed deployment**, with four non-cosmetic adaptations (Node 26 per `.nvmrc`, this repo's
> deeper paths, `$PORT` binding, and publishing the `.csproj` rather than the solution, which would drag
> the test project into the image). **Docker is for shipping only — the development loop stays
> `ng serve` + the dev proxy** (`architecture.md` §4.4).
>
> **Two things `portfolio` is not a reference for, and they matter.** It has **no auth, no cookies and
> an SPA that makes no HTTP calls at all**, so it never encounters the `AllowAnonymous` fallback, the
> `/api/{**rest}` catch-all, or forwarded headers — and the Railway confirmation makes that last one
> *urgent*: Railway terminates TLS at its edge and forwards over plain HTTP from a non-loopback address,
> which is exactly the case where the defaulted `KnownProxies` list silently drops `X-Forwarded-Proto`
> and `SecurePolicy.Always` then refuses to issue `motw.session`. Of the three blocking findings, that
> is the one that would have bitten on the first deploy. Two smaller Railway carry-overs *not* to copy
> verbatim: its `healthcheckPath = "/healthz"` (this app's is `/health/live`, and a near-miss is
> answered by the SPA fallback with `200 text/html`), and its `DATABASE_URL` handling — **Npgsql cannot
> parse Railway's `postgresql://` URI**, which `portfolio` discovered on its first deploy.
>
> **One follow-up call, verified rather than inferred and now settled (2026-08-23):**
> `UseHttpsRedirection` becomes **Development-only**, matching `portfolio`. Railway's edge is HTTPS-only
> and already `301`s plain HTTP itself — confirmed live, the edge answers with `content-length: 0` and
> the container never sees the request — and it always sets `X-Forwarded-Proto: https`, so the
> middleware has no job in Production. Inside the container it is inert anyway, since Kestrel binds HTTP
> only and there is no port to redirect *to*; that last point is precisely why it is worth removing
> rather than leaving, because it is dormant only until someone configures an HTTPS port. The
> health-check mechanism originally cited for this **could not be confirmed from Railway's docs** and the
> recommendation deliberately does not rest on it — see `open-questions.md` #6. A better finding fell
> out of the check: Railway probes with `Host: healthcheck.railway.app`, so **`AllowedHosts` must never
> be tightened without adding it**, or every deploy silently stops going live.
>
> Ten non-blocking items are folded in beside them — most consequentially that **the CORS block does not
> and cannot throw in production** (`appsettings.json` commits the key and `dotnet publish` ships it), so
> that risk row was mis-rated, while **the identical defect on the connection string does matter**;
> plus `AppUser` must not implement `ITimestamped`, the `DbSet` should be `AppUsers` (`Users` is the one
> name that collides with Identity later), and Phase 0's `data_protection_keys` check cannot pass in
> Phase 0 because the key ring is created lazily. **Confirmed as sound rather than assumed:** the 107
> actions and zero `[Authorize]`, "exactly four `[AllowAnonymous]`" with no hidden fifth for Swagger, the
> `/api/{**rest}` precedence claim against every route template in the tree, decision #2's no-collision
> premise against the robust plan's Identity table names, §1.5's cookie block line-by-line against the
> robust plan's, and Phase 0's SQLite "watch for" — which is satisfied for free by `EnsureCreatedAsync()`
> and is now closed rather than carried.

> **This is not a replacement for `docs/authentication-update/`.** That plan (Identity, roles,
> self-service registration, email confirmation, password reset, per-user `owner_id` ownership, a
> super-admin Users panel) is still the destination. This is a deliberately much smaller stepping
> stone to it, designed so that the later plan is layered *onto* this rather than *instead of* it.
> §5 of `architecture.md` itemises exactly what carries forward and what changes.

## Scope

**In scope:** verifying an email address and password against a row in the database, issuing a secure
`HttpOnly` cookie session, blocking unauthenticated API requests, blocking the UI when there is no
session, and the minimum hosting shape needed for that cookie to work on the public web.

**Explicitly out of scope, at the owner's direction:** self-service registration, an admin UI for the
credential table, password reset, password-strength rules, rate limiting, account lockout, CSRF
hardening beyond what is free, input validation and sanitisation, roles, and per-user data ownership.
This pass is about **access control, not input validation.**

**Also out of scope, and flagged rather than skipped:** the remaining infrastructure decisions.
*(Reduced 2026-08-23 — the owner confirmed **Railway, deployed from a repo-root Dockerfile**, which
settles hosting, runtime shape, TLS, CI/CD and where Postgres lives. The Dockerfile is in-repo and is
in Phase 3.)* Still outstanding: a domain name, how the owner reaches the production database to insert
the credential row, backups, and the environment variables.
This document works out the *application-side* hosting shape those decisions have to fit into (§4 of
`architecture.md`) and stops there. That is the same line `docs/authentication-update/` drew around
its Phase 6, for the same reason.

## Starting point — verified 2026-08-18, against the current tree

`docs/authentication-update/architecture.md` §0 inventoried this repo on 2026-08-08. Every claim
below was **re-verified against the code today**, not cited from that document.

| Fact | Evidence |
|---|---|
| Still zero authentication anywhere | `MonsterOfTheWeek.Api.csproj` references only EF Design, Npgsql, Swashbuckle. No `AddAuthentication`, no `[Authorize]`. The only `Identity` hits repo-wide are `NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns` in migration designers — Postgres identity columns, unrelated. |
| Still **107 controller actions across 7 controllers** | `grep -c '\[Http' Controllers/*.cs` → Bystanders 12, Locations 12, Minions 29, Monsters 31, Mysteries 7, Reference 14, Search 2. Unchanged from the 2026-08-08 count. |
| Still no Angular guard, no login route, no auth state | `app.routes.ts` has one top-level route (`PageLayoutComponent` at `''`) with nine children plus `{ path: '**', redirectTo: '' }`. No `canActivate`/`canMatch` anywhere in `src/app/**`. |
| The user menu's Profile and Sign out are still dead `href="#"` links | `page-layout.html` lines 104 and 111. Only "Settings" has a real `routerLink`. Avatar is still a hardcoded `U`. |
| There is still **no `username` field anywhere** in the codebase | `grep -rn 'username\|Username' src/` (excluding `node_modules`/`obj`) returns nothing. Consistent with the owner's ruling that the email *is* the username — this design introduces no username concept at any layer. |
| `environment.ts` still hardcodes `http://localhost:5225`; still **no** `proxy.conf.json`, **no** production environment file, **no** `fileReplacements` | `src/environments/` contains one file; `angular.json` `build.configurations.production` has only `budgets` + `outputHashing`. |
| `angular.json`'s `serve` target still has **no `options` block at all** | Only `builder`, `configurations`, `defaultConfiguration`. A `proxyConfig` key has nowhere to go — the step must *create* `options`. |
| `/health/live` is still outside `/api` on both sides | `Program.cs:65` `app.MapHealthChecks("/health/live")`; `core/health.ts:10` builds `` `${environment.apiBaseUrl}/health/live` ``. |
| `HealthService` still calls `HttpClient` directly, bypassing `ApiService` | `core/health.ts` — so `withCredentials` cannot be set in `ApiService`'s four methods alone. |
| `MotwDbContext.OnModelCreating` still does not call `base.OnModelCreating` | `Data/MotwDbContext.cs:52`. Harmless today; becomes mandatory the moment the class gains an Identity base. |
| `Program.cs` **throws at startup** if `Cors:AllowedOrigins` is absent | `Program.cs:9–10`. Real deployment trap under a single-origin production topology that does not need CORS at all. |
| The app is CSR-only, `<base href="/">`, output at `dist/monster-of-the-week-web/browser` | `main.ts` is a bare `bootstrapApplication`; `prerendered-routes.json` is `{"routes":{}}`; `angular.json` sets no `outputPath`. *(Starting state. Phase 3 step 5 sets `outputPath` to `wwwroot`, after which `dist/` is unused.)* |
| There is no `wwwroot/` in the API project | `ls src/api/MonsterOfTheWeek.Api/` — single-origin hosting has to create it. |
| `MotwDbInitializer.InitializeAsync` runs `Database.MigrateAsync()` on every startup | `Data/MotwDbInitializer.cs:10`. Migrations auto-apply on deploy; there is no separate migration step to design. |

## Documents

- **`architecture.md`** — the design. Credential storage and session establishment (and why
  cookie authentication is used **without** the Identity framework); API-side fail-closed gating;
  the Angular login page, shells and guards; the minimum hosting shape; the itemised
  forward-compatibility list; and the plaintext-password trade-off stated as an accepted risk.
- **`phases.md`** — four phases with file-level detail, risk levels, a risk register, and a
  verification checklist. Same format as `docs/authentication-update/phases.md`.
- **`open-questions.md`** — **all four original questions with the owner's resolution recorded against
  each**, the one that went against the recommendation and why the override was right, a "decided by
  reasoning, not asked" section so the calls that were never open don't get re-litigated, the two owner
  confirmations that shaped §2.3 and §4.1, **question #5 from Luigi's review with its resolution and the
  two rejected options, the still-open question #6 from Bowser's, and the "Luigi review dispositions"
  and "Bowser review dispositions" audit trails.** Kept as a decision record so the reasoning survives.
- **`dotnet-version-considerations.md`** — **reference material, not part of the design and not subject
  to the review gate.** A focused side-note written after Phase 0 landed, on whether the repo should move
  .NET version and what clearing Phase 0's NuGet audit warnings would actually involve. Headline: the
  audit warning and the real vulnerability are separate problems, and the package bump only fixes the
  cosmetic one — the ASP.NET Core runtime installed at the time (10.0.6) was inside the affected range of
  **CVE-2026-40372**, a CVSS 9.1 cookie-forging flaw in `Microsoft.AspNetCore.DataProtection`, patched in
  10.0.7. **✅ Acted on 2026-08-23: the development machine is now on SDK 10.0.400 / runtime 10.0.11 and
  the Data Protection key ring was rotated afterwards.** Still open: the package pins (deferred to the
  infrastructure pass) and pinning the Phase 3 Docker base image to `10.0.7`+, without which **production
  re-inherits the CVE regardless of the dev machine.** `net10.0` itself is current and should not move.

## Recommendation in one paragraph

Use **ASP.NET Core's cookie authentication handler directly — `AddAuthentication().AddCookie(...)` —
with no Identity framework at all.** Cookie authentication lives in the shared framework, so this adds
**zero NuGet package references**; Identity's value is entirely in the parts this pass explicitly does
not want (password hashing, lockout, token providers, a user/role store, registration). Credentials
live in a new four-column `app_users` table the owner inserts into by hand, keyed on **email** — the
email *is* the username, which aligns this design with the robust plan's own resolution #17 from the
start. Login is one hand-written
`AuthController` action that verifies the row and calls `HttpContext.SignInAsync`, issuing the same
`motw.session` cookie — same name, same flags, same 24-hour sliding lifetime — that
`docs/authentication-update/architecture.md` §1 already specified, so **the entire cookie configuration
the login contract, and the whole Angular side are written once and never rewritten.** Gate the API
with a single `SetFallbackPolicy(RequireAuthenticatedUser)` in `Program.cs`, which fails closed across
all 107 existing actions **without editing a single controller**; four endpoints opt out with
`[AllowAnonymous]`, one of which is the SPA fallback — that single line is what lets an unauthenticated
visitor load the shell and reach the login view at all (`architecture.md` §2.3). On the Angular side,
adopt the two-shell route structure from
`docs/authentication-update/architecture.md` §6 as designed — even with one auth page — because the
routing problem it solves is structural, not proportional to the page count, and because it was
already reviewed and ruled on once. **Single-origin hosting is confirmed** (the API serves the built
Angular app): cookies do not work cleanly across origins, and it is also what makes the shell and the
API the same server — which is why one `AllowAnonymous` on one endpoint is the whole of the fix above.

**Accepted trade-off:** the password is stored and compared in plaintext, so anyone who can read the
production database — including a stray `pg_dump` — learns it verbatim. This is a deliberate,
owner-accepted choice for a single-user app whose database access is already trusted, and it is
survivable **only if the password is unique to this app and used nowhere else.** `architecture.md` §6
states the threat model, the two things that must never happen, and the concrete trigger for
upgrading.

## Phase summary

| # | Phase | Risk |
|---|-------|------|
| 0 | **Credential store + Data Protection keys** — `AppUser` entity, `app_users` table, migration; `IDataProtectionKeyContext` on `MotwDbContext` and `PersistKeysToDbContext`. No endpoints, no gating, no user-visible change. | Low-Medium |
| 1 | **Cookie session + fail-closed API** — `AddAuthentication().AddCookie()`, `AuthController` (`login`/`logout`/`me`), `IAuthService`/`IUserRepository`, `SetFallbackPolicy`, the four `[AllowAnonymous]` opt-outs, middleware order, CORS made Development-only. Ends with the API fail-closed. | Medium |
| 2 | **Angular login + route guards** — dev proxy + `apiBaseUrl: ''` first, then `AuthService` signals, `authenticatedMatch`/`anonymousMatch`, `AuthLayoutComponent` + `LoginComponent`, `credentialsInterceptor` + `authErrorInterceptor`, the `/api/auth/` exemption in `httpErrorInterceptor`, **hoisting the icon sprite / toast host / API-availability modal to `App` (step 10b)**, and the Sign out wiring. | Medium |
| 3 | **Single-origin hosting shape** — `UseDefaultFiles`/`UseStaticFiles`/**an explicit `UseRouting()`**/`MapFallbackToFile(...).AllowAnonymous()`, the `/api/{**rest}` 404 catch-all, `UseForwardedHeaders` **with `KnownProxies`/`KnownNetworks` cleared**, production cookie/HTTPS config, environment-variable configuration (including moving the committed `ConnectionStrings`/`Cors` blocks into `appsettings.Development.json`), and the `ng build` → `wwwroot` publish step **as one `angular.json` `outputPath` key with no `.csproj` change, sequenced by a repo-root multi-stage `Dockerfile`** (plus a `.dockerignore`). **In-repo only** — **Railway is the confirmed host**, but standing up the project, its domain, its database access and its environment variables is a separate focused pass. | Medium |

Phases 0–2 land on a feature branch; **nothing is publicly deployed until Phase 3 and the separate
infrastructure pass are both done.** The API becomes fail-closed at the end of Phase 1, before the
Angular app knows how to log in — fine on a branch, not fine in production.
