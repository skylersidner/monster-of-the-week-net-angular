# Simple Authentication — Phased Implementation Plan

See `architecture.md` for the rationale behind every decision below; this document is the execution
breakdown. Format mirrors `docs/authentication-update/phases.md`.

**Status: design complete, not started. Frontend and backend reviews both done and closed; all six
questions resolved by the project owner.** The original four were settled in the design round on
2026-08-18. **Luigi's review of Phase 2 raised four blocking findings — all adopted and folded into
`architecture.md` and Phase 2's steps below — plus decisions #19 and #20, and one scope question
(`open-questions.md` #5) which the owner answered the same day in favour of the recommendation.**
**Bowser's review of Phases 0, 1 and 3 (2026-08-19) raised three further blocking findings — all in
Phase 3, all adopted and folded into `architecture.md` and Phase 3's steps below — plus ten non-blocking
corrections and one question (`open-questions.md` #6), resolved on 2026-08-23 against a comparison with
the owner's already-deployed `portfolio` app.** Nothing from either review is outstanding. No
application code has been written or modified.

Settled in that round: the login identifier is **email** (decision #4 — previously the one conflict
with the robust plan, now aligned); **Sign out is in scope** (decision #14); **existing local data does
not move to production** (decision #18); the **24-hour session stands unchanged** with its one
consequence knowingly accepted (decision #5); **single-origin hosting confirmed** (decision #12); and
the SPA shell is served to anyone with the Angular app rendering its own login view, which turns the
`MapFallbackToFile` risk into the worked fix in `architecture.md` §2.3 (decision #8).

> ## Review gate
>
> | Reviewer | Focus | Status |
> |---|---|---|
> | **Luigi** (Frontend Developer) | Phase 2 in full — the two-shell route restructure and `canMatch` guards, the three interceptors and the shared `/api/auth/` exemption predicate, `AuthService` signal design and the `provideAppInitializer` bootstrap, `logout()`'s error path (`architecture.md` §3.4), and the dev-proxy step including the `core/api.spec.ts` breakage. | **✅ Reviewed 2026-08-18 — four blocking findings, all adopted and folded into `architecture.md` §2.2/§3.2/§3.3/§3.4/§3.5 and the Phase 2 steps below. The one scope question referred to the owner (`open-questions.md` #5) was answered the same day in favour of the recommendation. Nothing outstanding.** |
> | **Bowser** (Backend Developer / DevOps) | Phases 0, 1 and 3 — the `AppUser`/`app_users` mapping and migration, `IDataProtectionKeyContext` against the SQLite test context, middleware order, the four `[AllowAnonymous]` opt-outs and the `/api/{**rest}` catch-all, the CORS-block conditional, and the `ng build` → `wwwroot` publish step. | ✅ **Complete, 2026-08-19. Three blocking findings, all in Phase 3, all adopted and folded into `architecture.md` §2.3/§4.2 and the Phase 3 steps below. The one question referred to the owner (`open-questions.md` #6) was resolved on 2026-08-23 against the `portfolio` comparison. Nothing outstanding.** |
> | **Boo** (Web Security Specialist) | **Optional and the owner's call.** `.squad/ceremonies.md` triggers `security-review` on "handles auth," which this does. If it runs, the two things worth his time are `architecture.md` §2.3 (the anonymous surface, and specifically the SPA fallback) and §6 (the plaintext trade-off, its threat model, and the upgrade trigger) — not the parts the owner has already excluded by instruction. | Not started |
>
> ### ✅ Luigi's review — four blocking findings, all adopted (2026-08-18)
>
> **Same shape as his review of the robust plan: nothing in the design was wrong, four things were
> unreachable, and three of the four fail silently.** All four are folded into `architecture.md` and
> into Phase 2's steps below, rather than left as a separate document.
>
> 1. **The interceptor array is in the wrong order, so the `401` toast fires anyway** (`architecture.md`
>    §3.3). Angular's chain is built with `reduceRight`, so the array is *request* order and the **last**
>    entry is the **first** to see an error response. With `credentials → authError → httpError`,
>    `httpErrorInterceptor` toasts `Request failed (401) …` before `authErrorInterceptor` swallows
>    anything. **Corrects the robust plan too**, which carries the identical array and the identical "so
>    no toast fires" claim.
> 2. **The two-shell restructure orphans three app-wide concerns** (`architecture.md` §3.5). The icon
>    sprite (`page-layout.html:2` — the only occurrence in `src/`), the toast host, and the
>    API-availability probe + modal all live inside `page-layout.html`. Consequence: `architecture.md`
>    §2.2's stated symptom for a missing `/health/live` `AllowAnonymous` becomes impossible (corrected
>    there), and Phase 2's *"stop the API and confirm the modal appears"* check — the **only** detector
>    for the silent `/health` proxy gap — becomes unrunnable. **Owner-confirmed 2026-08-18: all three
>    move up to `App`** (`open-questions.md` #5, option A — *"app root level is fine"*). Step 10b.
> 3. **The login form has no error path except `invalid_credentials`** (`architecture.md` §3.4). Both
>    interceptors skip `/api/auth/` and the auth shell has no toast host, so the component is the only
>    error surface in the app for the login POST — and an API-down, a `500`, or the `/api/{**rest}`
>    catch-all's `401` all produce a **completely inert submit button**. Exact mirror of decision #14's
>    `logout()` finding. The robust plan already carries the fix; this pass dropped it.
> 4. **`AuthService.initialize()` must *return* its observable** (`architecture.md` §3.2), or bootstrap
>    does not wait and every claim in §2.3's proactive-guard column is false. `ThemeService.initialize()`
>    — the adjacent line §3.2 says to copy — returns `void`, compiles fine, and produces "signed in, but
>    shown the login page on every cold load."
>
> **Findings 1 and 2 must land together, and with the owner's answer to #5 that is now unconditional.**
> The `401` toast bug is masked *today* only because the toast host sits in the shell being torn down on
> the bounce to `/login`. Hoisting the host to `App` removes the mask — so shipping the move against the
> old interceptor order turns an invisible bug into a stack of `Request failed (401)` toasts on the login
> page. Steps 6 and 10b are one unit.
>
> **Non-blocking**, all folded in place: the proactive guard path silently drops `returnUrl` and that gap
> is what invites the declined `UrlTree` "fix" (§3.1); `authErrorInterceptor` should act only once per
> expiry burst (§3.3); the `user` signal should be set inside `AuthService.login()`, not the component
> (§3.4); the login form needs `autocomplete`/`name` attributes because §6's whole mitigation presumes a
> password manager (§3.4); `AuthLayoutComponent` must not copy the sidebar's `MOTW` badge classes and
> must have no `.scss` (§3.1); step 9 vs step 10 must say which file holds the auth shell's empty-path
> child (step 10 below); "seven lazy feature bundles" is actually nine (§2.3); and
> `httpErrorInterceptor`'s absolute-URL-in-toast wart fixes itself once `apiBaseUrl` is `''` (§3.3).
>
> **Verified rather than assumed, against the current tree on 2026-08-18:** `core/api.spec.ts:30` does
> assert `http://localhost:5225/health/live` and does go red on `apiBaseUrl: ''`; `core/health.spec.ts`
> asserts `service.endpoint` and needs no change; `angular.json`'s `serve` target has no `options` block;
> `app.routes.spec.ts`'s two tests both use `.find(path === '')` and keep passing with `PageLayoutComponent`
> first; and the four-way navigation trace through the two shells (logged-out `/`, `/dashboard`, unknown
> URL; logged-in `/login`) terminates correctly in every case with the `**` wildcard unchanged.
>
> **The review's one scope question is resolved.** `open-questions.md` #5 — how far to take finding 2 —
> was answered by the owner on 2026-08-18 in favour of the recommendation (option A, the full move to
> `App`). Nothing from this review is outstanding; the gate is clear on Luigi's side.
>
> ### ✅ Bowser's review — three blocking findings, 2026-08-19
>
> **All three are in Phase 3, and all three have the same shape as Luigi's: nothing in the design is
> wrong, but three stated mitigations do not do what they say.** Two of the three fail silently. All are
> folded into `architecture.md` and Phase 3's steps below rather than kept separately; the audit trail is
> **`open-questions.md` → "Bowser review dispositions."**
>
> 1. **`UseForwardedHeaders` as specified is inert behind any real proxy** (`architecture.md` §4.2 item
>    5). `ForwardedHeadersOptions` defaults `KnownNetworks` to `{ ::1/128 }` and `KnownProxies` to
>    `{ ::1 }`, and the middleware discards the *entire* forwarded entry — `X-Forwarded-Proto` included —
>    at the first hop that is not a known proxy. Behind a container platform's load balancer, an nginx
>    sidecar, or Cloudflare, nothing is applied: `Request.Scheme` stays `http`, `SecurePolicy.Always`
>    refuses to emit `motw.session`, and `UseHttpsRedirection` loops. **That is precisely the failure this
>    step exists to prevent**, and the checklist's *"first thing to check if login 'succeeds' but no
>    cookie appears"* would point at a line that is present and not working. Fix:
>    `KnownNetworks.Clear(); KnownProxies.Clear();` — exactly what the framework's own
>    `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` shortcut does, for exactly this reason. **Corrects the
>    robust plan too**, which specifies the same flags and claims the same mitigation.
> 2. **`app.UseRouting()` must be added explicitly** (`architecture.md` §2.3). `Program.cs` never calls
>    it, so `WebApplicationBuilder` inserts routing at the **front** of the pipeline, ahead of every
>    middleware in the file. Consequences: Phase 3 step 1's *"before routing"* cannot be followed as
>    written; `UseDefaultFiles()` becomes dead code, because both it and `UseStaticFiles` no-op once an
>    endpoint is matched and `MapFallbackToFile`'s `{*path:nonfile}` **matches `/`**; and §2.3's
>    diagnostic symptom for a missing `.AllowAnonymous()` — *"`/` keeps working while every deep link
>    `401`s"*, repeated verbatim in the risk register — is **false**, because `/` would `401` as well. The
>    deployment still functions either way; what breaks is the only stated tell for the one failure this
>    design calls *"unrecoverable bootstrap deadlock."*
> 3. **The `ng build` → `wwwroot` step cannot be an MSBuild target inside `dotnet publish`**
>    (`architecture.md` §4.2 item 2). The Web SDK globs `wwwroot/**` into `Content` at **evaluation**
>    time, so a target that populates the directory during the build creates files that are never
>    published — **silently**. The app deploys with no SPA and `MapFallbackToFile` `404`s every route
>    including `/login`. Never bind it to `Build` either — the test project has a `ProjectReference` to
>    the API, so `dotnet test` would run a full Angular production build and require Node.
>    **Resolved by the owner 2026-08-23** (`open-questions.md` #6), against a comparison with the
>    owner's already-deployed `portfolio` app: **`ng build` writes straight into `wwwroot` via
>    `angular.json`'s `outputPath`**, the `.csproj` is untouched, and the two commands are sequenced by
>    hand for now. That removes the whole class of problem rather than working around it — there is no
>    target to mis-time — and it drops the copy and clear-before-copy steps entirely. Step 5 rewritten.
>
> **Non-blocking**, all folded in place: the CORS block **does not and cannot throw in production**
> (`appsettings.json` commits the key and `dotnet publish` ships it), so that risk row's "High, loud" was
> wrong — the real behaviour is a silently-registered `localhost:4200` policy, severity Low
> (`architecture.md` §2.4); **the identical defect on `ConnectionStrings:Postgres` does matter**, and the
> equal-effort fix is moving both blocks into `appsettings.Development.json`, which
> `MotwDbContextFactory` already handles for migrations (§4.2 item 6); `AppUser` must **not** implement
> `ITimestamped` — it would force a fifth column via `ApplyTimestamps()` — and the `DbSet` should be
> `AppUsers`, since `Users` is the one name that collides with `IdentityUserContext.Users` later (§1.2);
> Phase 0's *"`data_protection_keys` gains a row on first startup"* check **cannot pass in Phase 0**, the
> key ring being created lazily and Phase 0 having no protector consumer, so it moves to Phase 1 (§1.7);
> the `/api/{**rest}` catch-all also absorbs wrong-method requests, so `405` becomes `404`/`401` (§2.3);
> `UseStaticFiles` with no `wwwroot/` is safe, so the dev loop survives the `.gitignore` entry (§4.2 item
> 9); and a liveness probe on any *near-miss* path (`/health` rather than `/health/live`) gets
> `200 text/html` forever (§4.2 item 10).
>
> **Verified rather than assumed, against the current tree on 2026-08-19:** **107** actions across 7
> controllers and **zero** `[Authorize]`/`[AllowAnonymous]` anywhere in `Controllers/`; every route
> template is literal-plus-constrained-parameter, so the `/api/{**rest}` precedence claim holds in both
> directions for all of them; `MapHealthChecks` and `MapFallbackToFile` both return
> `IEndpointConventionBuilder`, so `.AllowAnonymous()` chains on both; **four** `[AllowAnonymous]` is
> genuinely the whole surface — Swagger needs no fifth, being Development-only middleware that
> short-circuits before `UseAuthorization`; both SQLite test contexts use `EnsureCreatedAsync()`, so
> `app_users` and `data_protection_keys` materialise with **no test-project change** (Phase 0's "Watch
> for" is closed, not carried); `Cors:AllowedOrigins` has exactly one reader repo-wide; `angular.json`
> defaults `ng build` to the `production` configuration and sets no `outputPath` today, so the
> then-documented `dist/monster-of-the-week-web/browser` was correct *(superseded 2026-08-23 — step 5
> now sets `outputPath` to `wwwroot` directly, so `dist/` is no longer used at all)*; and
> `data_protection_keys` is the **same** table
> name the robust plan's decision #5 uses, while `app_users` collides with none of its Identity tables —
> decision #2's whole premise confirmed.
>
> **The review's one question is resolved.** `open-questions.md` #6 — how the `ng build` → `wwwroot`
> step is sequenced — was answered by the owner on **2026-08-23**, after a comparison against
> `portfolio`, an already-deployed app of the owner's on the same stack. **`ng build` writes straight
> into `wwwroot` via `angular.json`'s `outputPath`, `MonsterOfTheWeek.Api.csproj` is untouched, and the
> sequencing is a repo-root multi-stage `Dockerfile` deployed to Railway** — `portfolio`'s shape,
> adopted with four non-cosmetic adaptations (Node 26, this repo's deeper paths, `$PORT` binding, and
> publishing the `.csproj` rather than the solution). Strictly simpler than either option originally
> priced, because with no MSBuild target there is nothing to mis-time. **Docker is for shipping only;
> the development loop stays `ng serve` + dev proxy** (`architecture.md` §4.4). Steps 5 and 7 rewritten;
> nothing from this review is outstanding.

**Phases 0–2 land on a feature branch. Nothing is publicly deployed until Phase 3 *and* the separate
infrastructure pass are both complete.** This removes one otherwise-artificial sequencing constraint:
the API becomes fail-closed at the end of Phase 1, well before the Angular app knows how to log in.
That is fine on a branch and would not be fine in production.

---

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | **Auth mechanism** | ASP.NET Core cookie authentication used **directly** — `AddAuthentication().AddCookie(...)` — with hand-written controllers and **no Identity framework**. Cookie auth is in the shared framework, so this adds zero auth packages; everything Identity supplies is on the explicit not-wanted list. `architecture.md` §1.1. |
| 2 | **Credential storage** | New `app_users` table: `id`, `email` (unique), `password` (**plaintext, deliberate**), `created_at`. Table named `app_users` not `users` so the robust plan's Identity `users` table has no collision; column named `password` not `password_hash` because it is not one. Lookup is case-insensitive (`lower()` on both sides) because the row is typed by hand. **The premise is confirmed** (Bowser, 2026-08-19): the robust plan's decision #5 maps Identity to `users`/`roles`/`user_roles`/… and `app_users` collides with none of them, while `data_protection_keys` is the *same* name in both plans, so that table is shared rather than duplicated. **Two mechanical corrections from the same review:** `AppUser` must **not** implement `ITimestamped` (its non-nullable `UpdatedAt` plus `ApplyTimestamps()` would force a fifth column), and the `DbSet` is **`AppUsers`, not `Users`** — `Users` is the one name that collides with `IdentityUserContext.Users` when the base class changes, i.e. the exact class of problem this decision exists to avoid. `architecture.md` §1.2. |
| 3 | **Credential creation** | By hand, over a database connection. **No seeding from code, ever.** No registration endpoint, no admin UI. |
| 4 | **Login identifier** *(owner-settled 2026-08-18)* | **Email — and only email.** "The email IS the username, always." There is no username column, DTO field, or form control anywhere. **Aligned with the robust plan's decision #6/#17 from the start**, so the login form, both DTOs, `AuthService.login()`, and the issued claim set all carry forward untouched. `open-questions.md` #1. |
| 5 | **Session lifetime** *(owner-confirmed 2026-08-18)* | Encrypted `HttpOnly` cookie, `motw.session`, `SameSite=Lax`, `Secure` in Production, **24h sliding — confirmed unchanged**, persistent, no "Remember me". Values copied verbatim from the robust plan's decision #27 so nothing is rewritten later. **Accepted consequence:** a session lapsing with the mystery-create wizard open loses the current phase's work, because the app has no draft persistence anywhere — pre-existing (a plain reload does the same today), explicitly accepted by the owner, and **not** something a later phase should design around. `architecture.md` §1.5, §1.6. |
| 6 | **Revocation** | None beyond deleting the browser's cookie. No security stamp, no session store. A copied cookie stays valid to its expiry; changing the password in the database does not end sessions. Kill switch: clear `data_protection_keys` and restart. `architecture.md` §1.6. |
| 7 | **Data Protection keys** | Persisted to Postgres via `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`, with `SetApplicationName("MonsterOfTheWeek")`. **Phase 0**, not the deployment phase — getting it wrong fails silently as "I keep getting logged out." Identical to the robust plan's decision #29. **Confirmed sound (Bowser, 2026-08-19), with one correction to how it is verified:** the key ring is created **lazily on first `Protect`/`Unprotect`**, and Phase 0 has no protector consumer, so `data_protection_keys` is legitimately **empty** for the whole of Phase 0. The "gains a row" assertion moves to Phase 1, after the first login. `architecture.md` §1.7. |
| 8 | **API gating, and how the SPA shell stays reachable** *(owner-confirmed 2026-08-18)* | One `SetFallbackPolicy(RequireAuthenticatedUser)`. Fails closed across all 107 existing actions with **zero controller edits**. Four `[AllowAnonymous]` opt-outs — `login`, `me`, `/health/live`, and **the SPA fallback endpoint**, the last of which is what lets an unauthenticated visitor load `index.html` and reach the login view. The owner has confirmed the shell and its bundles being publicly fetchable is expected and accepted. Plus an `/api/{**rest}` 404 catch-all, deliberately *not* anonymous, so API typos don't get answered with HTML and a `200`. No roles, no policies, no ownership. `architecture.md` §2.2–§2.3. |
| 9 | **Auth failure contract** | `POST /api/auth/login` failure → `400 { "code": "invalid_credentials" }`. `401` reserved API-wide for "no valid session." Both interceptors additionally skip `/api/auth/` — deliberately redundant. The robust plan's decision #37, adopted unchanged. `architecture.md` §1.4. |
| 10 | **Angular routes** | Two-shell pattern from the robust plan's §6, with one auth child. `canMatch` not `canActivate`; guards return `false` not a `UrlTree`; an empty-path child on **both** shells. `architecture.md` §3.1. |
| 11 | **Angular auth state** | `core/auth.ts` root service, `user` signal + `isAuthenticated` computed, seeded at bootstrap by `provideAppInitializer`, mirroring `ThemeService`. No `isAdmin`. No CSRF fetch (no antiforgery in this pass). **`initialize()` returns its observable so bootstrap actually waits — `ThemeService.initialize()` returns `void` and copying that shape silently defeats the whole proactive-guard design** (Luigi, 2026-08-18). `architecture.md` §3.2. |
| 12 | **Hosting topology** *(owner-confirmed 2026-08-18)* | **Single origin** — the API serves the built Angular app. Confirmed rather than deferred, because the cookie design does not survive the alternatives. The robust plan's decision #2. Consistent by construction with decision #8: single-origin is *what makes* the shell and the API the same server, which is why one `AllowAnonymous` is the whole fix. `architecture.md` §4.1. |
| 13 | **Frontend environment config** | `apiBaseUrl: ''` + a dev proxy covering `/api` **and** `/health`. **No `environment.prod.ts` and no `fileReplacements`** — with a same-origin deployment there is nothing environment-specific left to replace. `architecture.md` §4.2. |
| 14 | **Sign out** *(owner-confirmed 2026-08-18)* | **In scope.** `POST /api/auth/logout` plus wiring the already-dead link at `page-layout.html:111`. Two mechanisms end a session and both ship: `authErrorInterceptor`'s `401` branch handles a session lapsing on its own, and the button handles an intentional end to a live one. **`AuthService.logout()` must clear state and navigate from its `error` path too** — the endpoint is authenticated, so clicking it on an already-expired session returns `401`, and both interceptors skip `/api/auth/` by design, so nothing else will handle it. `architecture.md` §3.4. |
| 15 | **Deliberately absent** | No registration, no password reset, no roles, no `owner_id`, no rate limiting, no lockout, no password policy, no antiforgery, no profile page, no input validation beyond what `[ApiController]` already infers for free. |
| 16 | **Plaintext password** | Accepted, owner-directed risk. Mitigated by one non-optional control: the password must be unique to this app. Upgrade trigger stated as a condition, not as "later." `architecture.md` §6. |
| 17 | **Infrastructure** | Out of scope. Hosting provider, TLS, domain, secret storage, production Postgres, backups, CI/CD — separate focused pass, flagged the same way the robust plan flagged its Phase 6. `architecture.md` §4.3. |
| 18 | **Existing local game data** *(owner-settled 2026-08-18)* | **Does not reach production.** No migration step exists anywhere in this plan, and that is a decision rather than a gap — the owner will recreate the few objects by hand. Production starts with the seeded lookup tables only. If reversed later, moving data *before* the robust plan's `NOT NULL owner_id` migration is materially simpler than after. `architecture.md` §4.3, `open-questions.md` #3. |
| 19 | **Interceptor registration order** *(Luigi's review, 2026-08-18)* | **`credentials → httpError → authError`** — `authErrorInterceptor` **last**. Angular builds the chain with `reduceRight`, so the array is *request* order and errors propagate back through it in reverse; the last entry is the first to see an error response. Registered any earlier, `httpErrorInterceptor` toasts the `401` before `authErrorInterceptor` can swallow it. **This corrects the robust plan's §6, which specifies the same array in the wrong order with the same "so no toast fires" claim** — the fix carries forward rather than shipping the bug twice. `architecture.md` §3.3. |
| 20 | **Where app-wide shell concerns live** *(Luigi's review; owner-confirmed 2026-08-18)* | The icon sprite, the toast host, and the API-availability probe + modal move from `PageLayoutComponent` to **`App`** — *"I will take Luigi's recommendation; app root level is fine."* They are app-wide by nature (`icon.component.ts` already calls the sprite "app-wide") and only sat in `page-layout.html` because there has never been a second shell. Leaving them there gives the auth shell a blank-rendering sprite, a nowhere-toast, and no API-down signal — and removes the only detector for the silent `/health` proxy gap. `app.html` is a bare `<router-outlet />`, so the diff is a template move plus three relocated tests. The two smaller variants (sprite only; nothing moves) were considered and **rejected**. **Lands as one unit with decision #19** — the hoist is what unmasks the `401`-toast bug the old interceptor order causes. `architecture.md` §3.5, `open-questions.md` #5. |

---

## Phase 0 — Credential store and Data Protection keys

**Risk: Low-Medium.** Purely additive, no user-visible change, but it touches `MotwDbContext` and adds
a migration.

1. `MonsterOfTheWeek.Api.csproj`: add `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`
   (10.0.x, matching the existing EF/Npgsql pins). **This is the only new package in the whole plan** —
   cookie authentication itself needs none.
2. New `Data/Entities/AppUser.cs` — `Id`, `Email`, `Password`, `CreatedAt`. Its own file, not
   appended to `DomainEntities.cs`. **No `Username` property** — the email is the identifier
   (decision #4). **A plain POCO — it must *not* implement `ITimestamped`** (Bowser, 2026-08-19):
   `ITimestamped` declares a non-nullable `UpdatedAt` and `MotwDbContext.ApplyTimestamps()` writes it
   unconditionally, which forces a fifth column this table has no use for. `architecture.md` §1.2.
3. `MotwDbContext`: add `public DbSet<AppUser> AppUsers => Set<AppUser>();` — **`AppUsers`, not
   `Users`** (Bowser, 2026-08-19): `IdentityUserContext<TUser,…>` already declares
   `public virtual DbSet<TUser> Users`, so `Users` here is the one name that collides when the base
   class changes, which is the exact thing decision #2 exists to avoid. Then implement
   `IDataProtectionKeyContext` (`DbSet<DataProtectionKey> DataProtectionKeys`) and map both in
   `OnModelCreating` in the existing explicit style — `app_users` with a unique index on `email`,
   and `data_protection_keys`. **No `HasColumnType("timestamptz")` and no Npgsql-only
   `HasDefaultValueSql`** other than, optionally, `now()` on `created_at` — the SQLite test contexts
   build the same model. `architecture.md` §1.2.
4. `Program.cs`: `builder.Services.AddDataProtection()
   .PersistKeysToDbContext<MotwDbContext>().SetApplicationName("MonsterOfTheWeek");`
5. New migration `AddAppUsersAndDataProtectionKeys`.
6. New `Repositories/IUserRepository.cs` + `UserRepository.cs` — one method,
   `FindByEmailAsync(string email, CancellationToken)`, comparing `u.Email.ToLower()` against the
   trimmed, lowercased input so a hand-typed row's casing cannot cause a baffling login failure.
   Registered in `Program.cs` alongside the existing six repositories. It exists to match the
   codebase's layering and to give Phase 1's service test a fake to write against.

**Independently verifiable:** `dotnet ef migrations script` applies cleanly; the app starts;
`app_users` and `data_protection_keys` **exist** (both empty — see below); every existing endpoint
behaves exactly as before; the existing test suite passes unchanged.

> **Corrected 2026-08-19 (Bowser's review).** This previously read *"…and `data_protection_keys` gains a
> row on first startup."* **It will not, and that is correct behaviour.** The Data Protection key ring is
> created lazily on the first `Protect`/`Unprotect`; Phase 0 adds no consumer of a protector (cookie
> authentication arrives in Phase 1, and this pass has no antiforgery), so the table is created empty and
> stays empty for the whole phase. Following the old wording, an implementer would conclude Phase 0 had
> failed on the one phase whose entire risk profile is "this fails silently." **The row assertion moves
> to Phase 1**, after the first successful login — where it is also a strictly better test, because a
> row appearing there proves the *cookie ticket* protector is the DB-backed one. `architecture.md` §1.7.

**Watch for — closed, not carried (Bowser, 2026-08-19).** The concern was that the test project builds
`MotwDbContext` against SQLite and both new tables must materialise there. Verified: both SQLite
contexts (`MonsterRepositoryTests.cs:16–21`, `SearchProvidersTests.cs:556–565`) use
`EnsureCreatedAsync()`, which creates **every table in the model**, so both appear with **no
test-project change**. Still run `MonsterRepositoryTests` before moving on, but expect it green rather
than treating it as a risk. The only ways to break it are the mapping constraints named in step 3.

**Also note:** `dotnet ef` does **not** execute `Program.cs` here — `Data/MotwDbContextFactory.cs` is an
`IDesignTimeDbContextFactory<MotwDbContext>`. Step 5's migration is therefore unaffected by step 4.

---

## Phase 1 — Cookie session and fail-closed API

**Risk: Medium.** Ends with the API fail-closed and no way to log in from the browser yet.

1. `Contracts/AuthContracts.cs` — `LoginRequest(string Email, string Password)` and
   `CurrentUserResponse(Guid Id, string Email)`, as positional records matching `ApiContracts.cs`
   style. **No DataAnnotations** — `[ApiController]` already infers required for non-nullable
   reference types, and this pass adds no validation, including no `[EmailAddress]`.
2. `Services/IAuthService.cs` + `AuthService.cs` —
   `VerifyCredentialsAsync(string email, string password) : ServiceResult<CurrentUserResponse>`.
   No `HttpContext` dependency. Returns `ServiceResult.Validation("...")` on any failure, with one
   generic message — the controller maps it to the `invalid_credentials` code.
3. `Controllers/AuthController.cs`, `[ApiController] [Route("api/auth")]`:
   - `[HttpPost("login")] [AllowAnonymous]` — verify, build `ClaimsIdentity` with
     `ClaimTypes.NameIdentifier` = id and `ClaimTypes.Name` = email, `HttpContext.SignInAsync(...)` with
     `IsPersistent = true`, return `200` with the user. On failure return
     `BadRequest(new { code = "invalid_credentials" })` (decision #9).
   - `[HttpPost("logout")]` — authenticated. `HttpContext.SignOutAsync(...)`, `204`.
   - `[HttpGet("me")] [AllowAnonymous]` — returns the user from `User.Claims`, or `null`.
4. `Program.cs`: `AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(...)`
   with the full options block from `architecture.md` §1.5. **Write the `Events` overrides as
   mutation, not assignment** — harmless today, a silent security hole once Identity lands.
5. `Program.cs`: `AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder()
   .RequireAuthenticatedUser().Build());`
6. `Program.cs`: `app.UseAuthentication(); app.UseAuthorization();` between `UseHttpsRedirection()`
   and `MapControllers()`, and `.AllowAnonymous()` chained onto `app.MapHealthChecks("/health/live")`.
7. `MonsterOfTheWeek.Api.http`: replace the stale `weatherforecast` stub with login / me / logout
   requests plus one gated call (`GET /api/mysteries`). This exercises the whole thing before any
   Angular code exists, which is the cheapest possible place to find a cookie problem.
8. New `MonsterOfTheWeek.Api.Tests/Services/AuthServiceTests.cs` with a `FakeUserRepository`, matching
   the existing hand-written-fake pattern: correct credentials, wrong password, unknown email, and
   **correct credentials with the email in a different case**.

**Independently verifiable, from the `.http` file:** `GET /api/mysteries` with no cookie → `401` (not
a `302`); `POST /api/auth/login` with the hand-inserted row → `200` + a `Set-Cookie` carrying
`motw.session`, `HttpOnly`, `SameSite=Lax`; the same `GET /api/mysteries` with the cookie → `200`;
`GET /api/auth/me` → the user; `POST /api/auth/logout` → `204` and the next `GET /api/mysteries` →
`401`; `GET /health/live` → `200` with no cookie; a wrong password → `400 { "code":
"invalid_credentials" }`, **not** `401`.

**Plus the Data Protection check moved here from Phase 0** (Bowser, 2026-08-19): after that first
successful login, `SELECT count(*) FROM data_protection_keys` is **≥ 1**, and restarting the API leaves
the issued cookie still valid on the next `GET /api/mysteries`. The key ring is created lazily on first
use, so this is the earliest point at which it can be asserted — and it is the assertion that actually
matters, because it proves the *ticket* protector is the DB-backed one. `architecture.md` §1.7.

**Watch for:** the fallback policy now applies to Swagger-adjacent endpoints too. Swashbuckle's
`UseSwagger` is middleware and unaffected, but "Try it out" against a gated endpoint from the Swagger
UI will need a session cookie in the browser. Development-only; note it, do not work around it.

---

## Phase 2 — Angular login page and route guards

**Risk: Medium.** The first user-visible change, and the phase where the two silent failure modes
live.

1. **Same-origin dev loop first, before anything else.** `environment.ts` → `apiBaseUrl: ''`; new
   `proxy.conf.json` forwarding **`/api` *and* `/health`** to `http://localhost:5225`; **create** an
   `options` block on `angular.json`'s `serve` target (it has none) carrying `proxyConfig`. Update
   `core/api.spec.ts:30`, which asserts the absolute base URL and goes red immediately.
   `core/health.spec.ts` needs no change.
2. `core/auth.ts` — `AuthService`: `user` signal, `isAuthenticated` computed, `initialize()`
   (`GET /api/auth/me`, always resolves), `login(...)`, `logout()`. `core/models.ts` gains
   `CurrentUser`.
   **`initialize()` must be typed to return the observable, not `void`** — `.pipe(tap(u => this.user.set(u)), catchError(() => of(null)))`.
   Likewise `login()` sets the `user` signal itself, via `tap`, so the component only navigates.
   `architecture.md` §3.2, §3.4.
3. `app.config.ts` — add `provideAppInitializer(() => inject(AuthService).initialize())` next to the
   existing `ThemeService` line. **Return the result; do not subscribe and return `void`.** The
   adjacent `ThemeService.initialize()` returns `void` (`core/theme.ts:66`) and copying that shape
   compiles, does not make bootstrap wait, and shows a signed-in owner the login page on every cold
   load. `architecture.md` §3.2.
4. `core/credentials-interceptor.ts` — clone every request with `withCredentials: true`.
5. `core/auth-error-interceptor.ts` — the `/api/auth/` skip as its first statement; `401` → **only if
   `authService.user()` is currently non-null** → clear the signal, navigate to `/login` with
   `returnUrl`, swallow; everything else through. The non-null guard is what stops a burst of parallel
   `401`s producing N cancelled navigations and a `returnUrl` of `/login`. `architecture.md` §3.3.
6. `core/http-error-interceptor.ts` — extract the existing `/health/live` check and the new
   `/api/auth/` check into **one shared predicate**, `isSelfHandledRequest(req)`, used by both
   interceptors. Register all three in `app.config.ts` in the order
   **`credentials → httpError → authError`.**
   **`authErrorInterceptor` goes LAST, and that is not a typo.** Angular builds the chain with
   `reduceRight`, so the array is *request* order and errors propagate back through it in reverse — the
   last entry is the first to see an error response. Registered any earlier, `httpErrorInterceptor`
   fires `Request failed (401) …` before `authErrorInterceptor` gets the chance to swallow it, and the
   `401` branch's whole "no toast" property is lost. Put the rule in a code comment as *"last in the
   array = first to see an error."* `architecture.md` §3.3.
7. `core/auth-guards.ts` — `authenticatedMatch` and `anonymousMatch`, both `CanMatchFn`, both
   returning `boolean`. **Never a `UrlTree`** — add the one-line comment saying why, so it is not
   "optimised" later. Settle the `returnUrl` question here too (`architecture.md` §3.1): either
   `authenticatedMatch` stashes the attempted path on `AuthService` before returning `false` (skipping
   `/login`), or the docs state that the proactive path always lands on `/dashboard`. Do not leave it
   unstated — the lost deep link is exactly the itch that gets scratched with a `UrlTree`.
8. `layout/auth-layout/` — `AuthLayoutComponent`. Centred card on `bg-surface-sunken`, `MOTW` badge
   (`bg-accent text-on-accent`, **not** the sidebar's `bg-white/20 text-white`, which is invisible on
   `bg-surface-sunken`), `<router-outlet>`, `host: { class: 'block h-full' }`. Existing theme tokens
   only, **no `.scss` file**. `architecture.md` §3.1.
9. `features/auth/auth.routes.ts` + `features/auth/pages/login/` — reactive form with an `email`
   control (`type="email"`, `autocomplete="email"`, no `Validators.email`) and a `password` control
   (`autocomplete="current-password"`), `name`/`id` on both, a real `type="submit"` inside
   `<form (ngSubmit)>`, and one inline error region with `role="alert"`. The `autocomplete` attributes
   are not polish — §6's single non-optional mitigation assumes a password manager, which needs the
   browser to recognise this as a login form.
   **The `error` handler must render the inline region for every failure, not just
   `code === 'invalid_credentials'`** — anything else gets a generic "couldn't reach the server"
   message. Both interceptors skip `/api/auth/`, so this component is the only error surface in the
   app for this request; branching to nothing leaves the button inert when the API is down.
   `architecture.md` §3.4. On success `AuthService.login()` has already set the signal (step 2); the
   component navigates to `returnUrl ?? '/dashboard'` **after** that, never before.
10. `app.routes.ts` — add `canMatch: [authenticatedMatch]` to the existing `''` route (**leave it
    first**), then the second `''` shell with `canMatch: [anonymousMatch]`, whose children are
    `{ path: '', pathMatch: 'full', redirectTo: 'login' }` **and** `login`. The `**` wildcard is
    unchanged.
    **Decide explicitly whether those two children are inline here or inside `auth.routes.ts` behind a
    `loadChildren`, and keep them in the same file either way.** Step 9 creates `auth.routes.ts` and
    this step describes the children as if they were inline; splitting the empty-path redirect into one
    file and `login` into the other is precisely how the empty-path child — a blocking finding on the
    robust plan — goes missing a second time. With one auth page, inline in `app.routes.ts` is the
    simpler call.
10b. **Move `<app-icon-sprite />`, the toast host and the API-availability probe + modal from
    `PageLayoutComponent` to `App`** — owner-confirmed 2026-08-18 (`open-questions.md` #5, option A:
    *"app root level is fine"*). `app.html` is a bare `<router-outlet />` and `app.ts` is an empty
    class, so this is a template move plus one `ngOnInit`. `page-layout.ts` drops `HealthService`, the
    two signals and `checkApiAvailability()`; `page-layout.html` loses ~55 lines. Three tests move from
    `page-layout.spec.ts` (lines 42, 108, 117) to a new `app.spec.ts` with their mock and assertions
    unchanged — only the `TestBed` component changes.
    Without this the auth shell has no sprite (any `<app-icon>` renders blank, silently), no toast host,
    and no way to tell the user the API is down; and the *"stop the API and confirm the modal appears"*
    check below cannot be performed at all.
    **Land this together with step 6's ordering fix, never without it** — the `401` toast bug is masked
    today only because the toast host is inside the shell being torn down, so this step is what makes it
    visible. `architecture.md` §3.5.
11. `layout/page-layout/page-layout.html:111` — `<a href="#">Sign out</a>` → a `<button>` calling
    `logout()`. `page-layout.ts` injects `AuthService`. **Line 104 ("Your profile") stays dead.**
    **`AuthService.logout()` must clear the signal and navigate from its `error` handler as well as its
    `next` handler.** The endpoint is authenticated, so clicking Sign out on an already-expired session
    returns `401` — and both interceptors skip `/api/auth/` by design, so neither will handle it. Act
    on success only and Sign out silently does nothing in exactly the case it was asked for.
    `architecture.md` §3.4.
12. Specs: `auth.spec.ts`, `auth-guards.spec.ts`, `login.spec.ts`, `auth-error-interceptor.spec.ts`,
    new `app.spec.ts` (step 10b); extend `app.routes.spec.ts` with a logged-out case. Note that its two
    existing tests keep passing *only because* `.find(path === '')` returns the first `''` route and
    `PageLayoutComponent` stays first — re-verified 2026-08-18.
    **Two specs are worth writing specifically because they pin findings that fail silently:** an
    `auth-error-interceptor.spec.ts` case asserting that a `401` produces **zero** `NotificationService`
    entries (this is the only automated thing that catches the interceptor order regressing), and a
    `login.spec.ts` case flushing a transport failure / `500` and asserting the inline region is
    non-empty.

**Independently verifiable:** logged out, `/`, `/dashboard`, and `/does-not-exist` all land on
`/login` (not a router error); **no** feature chunk is requested before login (shell 1 gates nine lazy
entries — three `loadComponent`, six `loadChildren`); a wrong password shows the inline message and
**no toast**; **the API stopped, a login submit shows the generic inline message rather than doing
nothing**; a correct password lands on `/dashboard` with data; a reload stays signed in **without a
flash of the login page** (this is what catches `initialize()` not being awaited); Sign out returns to
`/login` and the back button does not restore the app; **expire the session (delete the cookie in
devtools), trigger any API call, and confirm the bounce to `/login` fires with no `Request failed (401)`
toast** — this is the check that catches the interceptor order; **stop the API while signed in and
confirm the "API unavailable" modal actually appears** — the check that catches a proxy missing the
`/health` rule, and performable at all only because step 10b moves the probe to `App`. **Run that last
one logged out too, on the login page** — that is the state the probe could never previously reach, and
it is the one step 10b exists to restore.

---

## Phase 3 — Single-origin hosting shape (in-repo only)

**Risk: Medium.** Small diff, but this is where the fatal `[AllowAnonymous]` omission lives and where
the proxy-header failures look like auth bugs.

1. `Program.cs`: `app.UseDefaultFiles(); app.UseStaticFiles();` then **`app.UseRouting();`** (see step
   1a — it does not exist today and "before routing" is otherwise unfollowable), and
   `app.MapFallbackToFile("index.html").AllowAnonymous();` after `MapControllers()`. **The
   `AllowAnonymous` is the single most important line in this phase** — without it every deep link,
   `/login` included, returns `401` before any HTML is served and the deployment is unusable.
   `architecture.md` §2.3 works the whole mechanism through.
1a. **Add `app.UseRouting()` explicitly, between `UseStaticFiles` and `UseAuthentication`.**
   **Blocking finding, Bowser 2026-08-19.** `Program.cs` has no `UseRouting()` call, so
   `WebApplicationBuilder` inserts routing at the **front** of the pipeline, ahead of everything the file
   registers. Three things follow, none of which the design accounted for: step 1's *"before routing"*
   describes a position that does not exist; `UseDefaultFiles()` never runs, because it and
   `UseStaticFiles` both no-op once an endpoint has been matched and `MapFallbackToFile`'s
   `{*path:nonfile}` **matches `/`**; and §2.3's diagnostic for a missing `.AllowAnonymous()` — *"`/`
   keeps working while every deep link `401`s"* — becomes **false**, since `/` would `401` too. One line,
   no behavioural risk, and it makes the documented pipeline the real one. `architecture.md` §2.3.
2. `Program.cs`: `app.Map("/api/{**rest}", () => Results.NotFound());` immediately **before** the
   fallback, and deliberately **not** `AllowAnonymous`. Without it, a misspelled API path falls
   through to the SPA fallback and is answered with `index.html` and a `200` — the same
   success-shaped-failure trap as the `/health/live` proxy gap, and more likely under single-origin
   hosting where every frontend call is a relative path. **In scope, not optional** — one line against
   a silent failure. `architecture.md` §2.3.
3. `Program.cs`: `UseForwardedHeaders` (`XForwardedFor | XForwardedProto`) as the first middleware,
   Production only — **and `options.KnownNetworks.Clear(); options.KnownProxies.Clear();` in the same
   options block.** **Blocking finding, Bowser 2026-08-19: without those two lines this step does
   nothing.** `ForwardedHeadersOptions` defaults to loopback-only (`KnownNetworks = { ::1/128 }`,
   `KnownProxies = { ::1 }`) and the middleware discards the whole forwarded entry — `X-Forwarded-Proto`
   included — at the first hop that is not a known proxy. Behind any real load balancer, sidecar or CDN
   the scheme is never applied, so `SecurePolicy.Always` refuses to emit `motw.session` and
   `UseHttpsRedirection` loops: **exactly the failure this step exists to prevent.** Clearing both lists
   is what the framework's own `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` shortcut does, for this
   reason. Residual, stated rather than hidden: a client reaching the app *directly* could then spoof the
   scheme — closed by the §4.3 requirement that the app is only reachable through its proxy, and
   tightened to a real `KnownProxies` entry once a host is chosen. `architecture.md` §4.2 item 5.
3a. `Program.cs`: **make `app.UseHttpsRedirection()` Development-only**, matching `portfolio`.
   *(Settled 2026-08-23 against Railway's documentation and a live test of its edge — `open-questions.md`
   #6 records the evidence.)* Three reasons, strongest first: **Railway's edge is HTTPS-only and already
   `301`s plain HTTP itself** (verified live — the edge answers with `content-length: 0`, so the request
   never reaches the container), so an app-level redirect is dead code, not a fallback; **Railway's edge
   sets `X-Forwarded-Proto: https` on every request**, so after step 3 the middleware could never fire
   anyway; and **inside the container Kestrel binds HTTP only**, so it cannot resolve a port to redirect
   *to* and passes everything through after one *"Failed to determine the https port for redirect"*
   warning. That third point is why this is worth doing rather than leaving: the middleware is dormant
   **only** while no HTTPS port is configured, and setting one is exactly what someone does while
   debugging TLS. If it ever woke up it would redirect **Railway's deploy-time healthcheck**, which
   probes the container's `PORT` directly and requires a literal `200`. One `if`; no cost, because
   Development uses `SameAsRequest` and has no proxy. `architecture.md` §4.2 item 5a.
4. `Program.cs`: make the entire CORS block — the `Cors:AllowedOrigins` read (lines 9–10), `AddCors`,
   and `UseCors` — conditional on `IsDevelopment()`. Note **two different environment objects**: the
   read and `AddCors` are before `builder.Build()` and need `builder.Environment.IsDevelopment()`;
   `UseCors` is after and needs `app.Environment.IsDevelopment()`. Guarding only the first half leaves
   `UseCors("FrontendDev")` pointing at a policy that no longer exists, which throws on the **first
   request** — worse than what is being removed.
   **Corrected premise (Bowser, 2026-08-19):** this step previously justified itself with *"the
   `Cors:AllowedOrigins` read currently throws at startup."* **It cannot.** `appsettings.json` commits
   the key and `dotnet publish` always ships that file, so the `?? throw` is unreachable; the real
   present-day behaviour is that production silently registers a policy allowing `http://localhost:4200`
   (no `AllowCredentials`, so the cookie is never in play). Still worth doing, on the honest grounds that
   a dev origin has no business in production. Risk-register severity downgraded accordingly.
   `architecture.md` §2.4.
5. **Point `ng build` straight at `wwwroot`, and add the Dockerfile that sequences it.**
   *(Owner-resolved 2026-08-23, `open-questions.md` #6. Deployment is **Railway from a repo-root
   Dockerfile**, mirroring `portfolio`.)* Four files, one of them edited and three of them new:
   - **`src/web/monster-of-the-week-web/angular.json`**, in the `build` target's `options`:
     `"outputPath": { "base": "../../api/MonsterOfTheWeek.Api/wwwroot", "browser": "" }`. The
     `"browser": ""` flattens away the builder's default `<base>/browser` subdirectory so files land at
     `wwwroot/index.html`, not `wwwroot/browser/index.html`.
   - **`.gitignore`**: add `src/api/MonsterOfTheWeek.Api/wwwroot/` (anchored). **The build is never
     committed.**
   - **`.dockerignore`** (new): `src/api/MonsterOfTheWeek.Api/wwwroot/`, plus `**/bin/`, `**/obj/`,
     `**/node_modules/`, `.git/`. **Not redundant with `.gitignore`** — this is what stops a *stale
     local build* being copied into the image context, so what ships is always what the frontend stage
     just produced. `portfolio` carries the same entry for the same reason.
   - **`Dockerfile`** (new, repo root): three stages — `node:26-alpine` runs `npm ci && npm run build`
     (writing into `wwwroot`), `mcr.microsoft.com/dotnet/sdk:10.0` runs `dotnet publish`, and
     `mcr.microsoft.com/dotnet/aspnet:10.0` is the runtime. **The stage boundary is the sequencing** —
     it is what guarantees `wwwroot` is populated before MSBuild evaluates the project. Full annotated
     Dockerfile in `architecture.md` §4.2 item 2a.
   - **`MonsterOfTheWeek.Api.csproj` is not touched at all.** The stock Web SDK `wwwroot/**` content
     glob publishes the output; there is no MSBuild target, so there is none to mis-time.

   **Four adaptations from `portfolio`'s Dockerfile that are not cosmetic** — do not copy it verbatim:
   **`node:26-alpine`, not `node:22-alpine`** (`.nvmrc` pins `26.5.0`, `engines` requires
   `>=26.5.0 <27`); the deeper `src/web/…` + `src/api/…` paths; `ASPNETCORE_HTTP_PORTS=${PORT:-8080}` in
   the runtime `CMD`, because Railway assigns the port; and **`dotnet publish` must target the API
   `.csproj`, never `MonsterOfTheWeek.slnx`**, which would drag `MonsterOfTheWeek.Api.Tests` and its
   SQLite package into the image.

   **Why not an MSBuild target — settled, not a preference.** The Web SDK globs `wwwroot/**` into
   `Content` at MSBuild *evaluation* time, so a target that populates the directory during the build
   produces files that are **never published, silently**: the app deploys with no SPA and
   `MapFallbackToFile("index.html")` `404`s every route including `/login`. Writing the output in place
   removes the entire class of problem. Independently, a target bound to `Build` would drag the Angular
   build into `dotnet test` via the test project's `ProjectReference`, making Node a requirement for
   running the suite.

   **No clear-before-build step is needed.** `@angular/build:application` sets `deleteOutputPath: true`
   by default, so each build wipes the directory and `outputHashing: "all"` cannot accumulate stale
   bundles. Confirm on the first run rather than trusting it. The constraint that comes with it:
   **nothing else may ever live in `wwwroot`** — a build deletes it.

   **Dev-loop impact, checked: none.** `@angular/build:dev-server` builds in memory and never writes
   `outputPath`, so `ng serve`, the dev proxy and `apiBaseUrl: ''` are all unaffected and Phase 2 step 1
   needs no change. **Docker is for shipping only and has no part in the local loop** —
   `architecture.md` §4.4. The one script that changes is `package.json`'s
   `"watch": "ng build --watch --configuration development"`, which now writes an unoptimised
   development build into `wwwroot` and deletes any production build there; **it should not be used as
   a development loop** (§4.4 explains why `ng serve` strictly dominates it).
6. `appsettings.json` documentation of the environment variables the deployment needs
   (`ConnectionStrings__Postgres`, `ASPNETCORE_ENVIRONMENT`). No secrets committed. Do **not** add a
   blanket `Cache-Control` for static files without excluding `index.html` — `architecture.md` §4.2
   item 8.
   **And while this file is open, move the `ConnectionStrings` and `Cors` blocks out of
   `appsettings.json` into `appsettings.Development.json`** (Bowser, 2026-08-19). Both `?? throw`
   startup guards in `Program.cs` are currently unreachable because the committed `appsettings.json`
   always supplies both values — so a production deploy that forgets `ConnectionStrings__Postgres` does
   **not** get *"ConnectionStrings:Postgres must be configured"*; it starts, resolves the committed
   `Host=localhost` placeholder, and dies inside `MigrateAsync()` with a socket error. Moving both
   blocks makes the guards real and ships no local placeholder at all, which is what this step's own
   "no secrets committed" line already asks for. Verified safe for migrations:
   `MotwDbContextFactory` defaults to `Development` and layers `appsettings.{env}.json` itself.
   `architecture.md` §4.2 item 6.
7. A short runbook note, wherever this repo keeps them, covering four things:
   - **How to insert the credential row** — **including `created_at`**, since `AppUser` is deliberately
     not `ITimestamped` and nothing else populates it (`architecture.md` §1.2).
   - **The development loop, stated once so nobody reaches for Docker:** `docker compose up -d postgres`,
     `dotnet run`, `npm start`, browse `http://localhost:4200`. **`docker build` is for shipping only
     and never part of iterating.** Do **not** use `npm run watch` as the dev loop — it has no
     hot-reload, does not refresh the browser, and writes a development build over `wwwroot`.
     `architecture.md` §4.4.
   - **How a deploy happens:** push to the Railway-connected branch; Railway builds the repo-root
     Dockerfile and restarts the service. Migrations apply themselves on startup
     (`MotwDbInitializer`), so a bad migration is a failed deploy rather than a manual step.
     **If publishing by hand instead** (for a local single-origin check, or a non-Railway target), it is
     two commands in order — `npm run build`, then `dotnet publish` on
     `src/api/MonsterOfTheWeek.Api/MonsterOfTheWeek.Api.csproj` — **and the build must immediately
     precede the publish**, never publishing on whatever happens to be sitting in `wwwroot`.
   - **The kill switch:** clear `data_protection_keys` and restart, which ends every session everywhere
     (`architecture.md` §1.6).
   - **The liveness probe path, which is `/health/live` exactly** — any near-miss (`/health`,
     `/healthz`) is answered by the SPA fallback with `200 text/html` and passes forever while the app
     is broken (`architecture.md` §4.2 item 10).

**Independently verifiable, entirely locally:** `dotnet run` with `ASPNETCORE_ENVIRONMENT=Production`
against the local database, then browse `http://localhost:5225` — **with `ng serve` not running** — and
get the login page, sign in, navigate, deep-link to `/monsters/{id}`, and hard-refresh on it. Then
**sign out and hard-refresh that same deep link**: it must serve the shell and land on `/login`, not
return `401`. Deep links exercise the fallback endpoint, which is the one `ng serve` never tests, and
the logged-out variant is the one that catches a missing `AllowAnonymous`.

**Two additions from Bowser's review (2026-08-19), both catching things `dotnet run` does not:**

- **Run `dotnet publish` and check the output directory actually contains `wwwroot/index.html` and
  content-hashed bundles**, then run the app *from the publish output* rather than from `bin/Debug`.
  `dotnet run` reads `wwwroot` straight off the source tree and will look perfect whatever the publish
  output contains, so this is the only check that catches either an empty `wwwroot` or a stale
  `npm run watch` development build being shipped (step 5).
- **`UseForwardedHeaders` cannot be verified locally without a proxy in front**, so verify it by
  reading rather than by running: confirm both `KnownNetworks.Clear()` and `KnownProxies.Clear()` are
  present. The first real deployment is otherwise where this is found, and it presents as "login
  succeeds but no cookie appears" (step 3).

**Not in this phase, and blocking a real deployment** *(reduced 2026-08-23 — hosting is now decided:
**Railway, from the repo-root Dockerfile in step 5**, which settles runtime shape, TLS, CI/CD, and
where Postgres lives)*: a **domain name**; **how the owner reaches the production database to insert
the credential row**, which is a hard dependency of this whole design; **backups**; and **the
environment variables and where their values come from**. `architecture.md` §4.3.
**`SecurePolicy.Always` means there is no working deployment without real TLS** — Railway's edge
supplies it, which is also what makes step 3's `KnownProxies` fix mandatory rather than precautionary.

**One Railway-specific trap with its answer already known, carried from `portfolio`:** Railway exposes
its Postgres connection string as a `postgresql://…` **URI**, and **Npgsql cannot parse that** —
`portfolio` hit it on first deploy and had to add a normalizer. Set `ConnectionStrings__Postgres` to a
composed key=value string in Railway's variable editor
(`Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};…`) rather than to `${{Postgres.DATABASE_URL}}`,
and no application code is needed. And set `railway.toml`'s `healthcheckPath` to **`/health/live`
exactly** — `portfolio`'s `/healthz` copied verbatim would be answered by the SPA fallback with
`200 text/html` forever, even with the API broken. `architecture.md` §4.3.

---

## Risk register

| Risk | Phase | Impact | Mitigation |
|---|---|---|---|
| **SPA fallback endpoint gated by the fallback policy** | 3 | **Critical** — deep links `401` before any HTML is served, so the login page is unreachable and the failure is unrecoverable from the browser. **Whether `/` still works is conditional on step 1a** — with the explicit `UseRouting()` it does (static-file *middleware* short-circuits before authorization) and the bug reads as route-dependent; without it, `/` matches the same gated fallback endpoint and `401`s too. *Corrected 2026-08-19: this row previously asserted the route-dependent symptom unconditionally* | `.AllowAnonymous()` chained onto `MapFallbackToFile`, worked through in `architecture.md` §2.3 and called out at the exact step. Verified by hard-refreshing a deep link **while logged out** in Phase 3 |
| **`app.UseRouting()` left implicit, so the pipeline is not the one the design describes** | 3 | Low functionally — the deployment works either way — but it **invalidates the only stated tell** for the Critical row above, makes `UseDefaultFiles()` dead code, and makes step 1's "before routing" unfollowable. The kind of thing that costs an hour at exactly the wrong moment | `app.UseRouting()` added explicitly between `UseStaticFiles` and `UseAuthentication` (step 1a). One line. `architecture.md` §2.3 |
| **`ng build` output populated into `wwwroot` by an MSBuild target, so `dotnet publish` ships no SPA** | 3 | **Critical and completely silent** — the Web SDK globs `wwwroot/**` into `Content` at *evaluation* time, so files created during the build are never published. The app deploys, starts, passes a health probe, and `404`s every route including `/login` | **Closed by construction (owner-resolved 2026-08-23):** `angular.json`'s `outputPath` writes into `wwwroot` directly and `MonsterOfTheWeek.Api.csproj` gains nothing, so there is no target to mis-time. The residual is ordering, not timing — `npm run build` must precede `dotnet publish` (steps 5 and 7). Verified by running the app **from the publish output**, not from `bin/`. `architecture.md` §4.2 item 2 |
| **`npm run watch` used as the dev loop, leaving a development build in `wwwroot`** | 3 | Medium — an unoptimised, unhashed bundle where a production one belongs, which serves fine and so looks like a working deploy. Introduced by pointing `outputPath` at `wwwroot`; `ng build --watch --configuration development` writes there and `deleteOutputPath` wipes the production build it replaces. **Largely defused by the Dockerfile** — the image is built in a clean context from a fresh `npm run build`, and `.dockerignore` excludes the local `wwwroot` — so the exposure is a hand-run `dotnet publish`, plus local confusion | `ng serve` named as *the* dev loop and `npm run watch` explicitly steered away from (`architecture.md` §4.4); `.dockerignore` excludes `wwwroot/` (step 5); the runbook rule that a hand-run build immediately precedes a hand-run publish (step 7); and a checklist assertion that published bundles are content-hashed |
| **`ConnectionStrings__Postgres` set to Railway's `DATABASE_URL`, which Npgsql cannot parse** | infra | High and loud, but easy to misread as a database outage — the app starts and dies inside `MigrateAsync()` with a connection-string parse or socket error on every boot | Compose a key=value string from the addon's individual variables in Railway's variable editor rather than using the URI; or port `portfolio`'s ~10-line normalizer, which is already written against the same Npgsql 10.0.0. Answer recorded before the fact rather than rediscovered. `architecture.md` §4.3 |
| **`railway.toml`'s `healthcheckPath` copied from `portfolio` as `/healthz`** | infra | Medium, **completely silent, and the worst possible instance of the near-miss trap** — the SPA fallback answers `/healthz` with `200 text/html`, so Railway's deploy healthcheck passes no matter how broken the API is | `healthcheckPath = "/health/live"`, exactly, and a probe that returns HTML is misconfigured. `architecture.md` §4.2 item 10, §4.3 |
| **`UseHttpsRedirection` left in the Production pipeline, then an HTTPS port gets configured later** | 3 | Low today, **latent** — the middleware is inert in the container because Kestrel binds HTTP only and no HTTPS port is resolvable. But setting `HttpsPort`/`ASPNETCORE_HTTPS_PORT` (a natural move while debugging TLS, and something `portfolio` itself does) wakes it up, after which it redirects **Railway's deploy-time healthcheck** — which probes the container's `PORT` directly and needs a literal `200`. Consequence is a **deploy that never goes live**, not an outage: Railway does not monitor the endpoint after go-live | `UseHttpsRedirection` made Development-only (step 3a). Railway's edge already `301`s plain HTTP itself and always sets `X-Forwarded-Proto: https`, so the middleware has no job in Production. `architecture.md` §4.2 item 5a |
| **`AllowedHosts` tightened later without adding `healthcheck.railway.app`** | infra | Medium, **silent, and it looks like a pure hardening win** — Railway sends `Host: healthcheck.railway.app`, and ASP.NET Core's host filtering answers a disallowed host with `400`, which Railway's own docs name as a healthcheck failure mode. Every subsequent deploy would stop going live | `appsettings.json` currently has `"AllowedHosts": "*"`, so this is safe as shipped. Recorded so that whoever tightens it knows the one string that must be in the list. `architecture.md` §4.2 item 5a |
| **Unknown `/api` paths answered with `index.html` and a `200`** | 3 | Medium, **completely silent** — an Angular call to a mistyped relative URL resolves successfully on a blob of HTML instead of erroring. Same shape as the `/health/live` proxy gap, and more reachable under single-origin hosting | The `/api/{**rest}` 404 catch-all at default order, which beats the `int.MaxValue` fallback while losing to every literal controller route (Phase 3 step 1b) |
| **The Angular `canMatch` guard treated as redundant now that the server serves the shell unconditionally** | 2 | Medium, cosmetic but very visible — a logged-out deep link renders `PageLayoutComponent`'s full chrome, lazy-loads a feature chunk, fires a burst of `401`s, and *then* bounces to `/login` | `architecture.md` §2.3's two-column table states what each mechanism catches that the other cannot; the "seven lazy chunks absent from the network tab before login" check in Phase 2 is what actually detects a missing guard |
| `/health/live` gated by the fallback policy | 1 | High — a permanent "API unavailable" modal over the login page for every logged-out visitor | `.AllowAnonymous()` on `MapHealthChecks`, enumerated in the four-item list |
| **Dev proxy misses `/health`, so the API-unavailable modal is silently dead** | 2 | Medium, **completely silent** — `ng serve`'s history fallback answers with `index.html` and a `200`, and `responseType: 'text'` resolves on it | The proxy forwards `/health` as well as `/api`; verified by stopping the API and confirming the modal appears. Inherited finding from Luigi's review of the robust plan. **That verification only exists because step 10b moves the probe to `App`** — see the row below |
| **Interceptors registered `credentials → authError → httpError`, so the `401` toast fires anyway** | 2 | Medium today and **self-masking** — the toast host is inside the shell being torn down, so it renders nowhere and the bug looks fixed. **Step 10b removes the mask**, so from this phase on it is a visible stack of `Request failed (401)` toasts on the login page, one per in-flight request | `authErrorInterceptor` registered **last**, because Angular's `reduceRight` chain makes the array request-order and the last entry the first to see an error. Code comment stating the rule; an interceptor spec asserting a `401` produces zero notifications (step 12). Steps 6 and 10b are one unit. `architecture.md` §3.3. **Corrects the same error in the robust plan** |
| **The icon sprite, the toast host and the health probe live inside `page-layout.html`, so the auth shell has none of them** | 2 | Medium-High, and **three separate silent failures**: `<app-icon>` on the auth shell renders blank with no error; toasts auto-dismiss after 4 s having rendered nowhere; and the API-unavailable modal can never appear for a logged-out visitor, which removes the only detector for the `/health` proxy gap above | Move all three to `App` (step 10b) — a template move into a file that is currently a bare `<router-outlet />`. **Owner-confirmed 2026-08-18** (`open-questions.md` #5, option A). Lands as one unit with the interceptor-ordering fix. `architecture.md` §3.5, §2.2 |
| **The login form is inert on any failure other than `invalid_credentials`** | 2 | Medium, **completely silent** — both interceptors skip `/api/auth/` and the auth shell has no toast host, so an API-down, a `500`, or the `/api/{**rest}` catch-all's `401` produce no toast, no modal, no message and no navigation. Exact mirror of the `logout()` row below | The `error` handler renders the inline region for **every** error, with a generic fallback for anything without a recognised `code` (step 9). Verified by stopping the API and submitting. `architecture.md` §3.4 |
| **`AuthService.initialize()` returns `void`, so bootstrap does not wait for `GET /api/auth/me`** | 2 | High — a signed-in owner is shown the login page on **every** cold load, and it reads as a cookie/session bug rather than a bootstrap one. Easy to write wrong because the adjacent `ThemeService.initialize()` line the design says to copy returns `void` and compiles fine | `initialize()` typed to return the observable and `provideAppInitializer` returning it (steps 2–3). Verified by the "reload stays signed in, with no flash of the login page" check. `architecture.md` §3.2 |
| The proactive guard path drops `returnUrl`, so a logged-out deep link always lands on `/dashboard` | 2 | Low on its own; the real risk is second-order — it is the itch that gets scratched by returning a `UrlTree`, which is the declined change that causes the infinite redirect two rows down | Settled explicitly at step 7: either a three-line stash on `AuthService`, or a stated acceptance. Not left unstated. `architecture.md` §3.1 |
| Data Protection keys not persisted | 0 | High, intermittent, hard to diagnose — reads as an auth bug | Persist to Postgres in Phase 0, not at deployment; `SetApplicationName` pinned. **Verified in Phase 1, not Phase 0** — the key ring is created lazily on first use and Phase 0 has no protector consumer, so the table is legitimately empty until the first login. Then restart the API mid-session and confirm the session survives. `architecture.md` §1.7 |
| **A dev CORS origin silently configured in production** | 3 | **Low** — a policy allowing `http://localhost:4200` with no `AllowCredentials`, so the cookie is never in play. *Severity corrected downward 2026-08-19: this row previously read "the app throws at startup ⇒ High, loud." **It cannot throw** — `appsettings.json` commits `Cors:AllowedOrigins` and `dotnet publish` always ships it, so the `?? throw` at `Program.cs:9–10` is unreachable* | Whole CORS block made Development-only, both halves (step 4). `architecture.md` §2.4 |
| **`ConnectionStrings__Postgres` unset in production ⇒ the app silently uses the committed local placeholder** | 3 | **Medium and misleading** — the `?? throw new InvalidOperationException("ConnectionStrings:Postgres must be configured.")` guard at `Program.cs:11–12` is unreachable for the same reason as the CORS one, so the failure surfaces as a socket error against `localhost` from inside `MigrateAsync()` rather than as the configuration error it is | Move the `ConnectionStrings` and `Cors` blocks from `appsettings.json` into `appsettings.Development.json` (step 6). Both guards become real and no placeholder ships. `MotwDbContextFactory` already defaults to `Development`, so migrations are unaffected. `architecture.md` §4.2 item 6 |
| **`UseForwardedHeaders` registered but left with its default loopback-only `KnownProxies`** | 3 | **High, and the mitigation looks present** — `ForwardedHeadersOptions` defaults to `KnownNetworks = { ::1/128 }` / `KnownProxies = { ::1 }`, and the middleware drops the entire forwarded entry (`X-Forwarded-Proto` included) at the first non-known hop. Behind any real proxy: `UseHttpsRedirection` loops and `SecurePolicy.Always` refuses to set the cookie, exactly as if the middleware were absent. *Row rewritten 2026-08-19 — it previously treated bare registration as sufficient* | `KnownNetworks.Clear(); KnownProxies.Clear();` alongside the `ForwardedHeaders` flags, Production only (step 3), tightened to a real proxy address once a host is chosen. The first thing to check if login "succeeds" but no cookie appears. `architecture.md` §4.2 item 5 |
| Login returns `401` instead of `400` | 1 / 2 | **Medium, completely silent** — `authErrorInterceptor` clears the session, navigates to the page the user is already on, and swallows the body, so the login form reports nothing | Decision #9's two redundant defences: the `400` contract *and* the `/api/auth/` skip in both interceptors. Verified explicitly in both phases |
| Auth shell has no empty-path child ⇒ logged-out `/` and every unknown URL fail to route | 2 | High, loud (`NG04014`), but only reachable while logged out — easy to miss in a dev loop that stays signed in | `{ path: '', pathMatch: 'full', redirectTo: 'login' }` as the auth shell's first child (step 10); a logged-out case added to `app.routes.spec.ts` |
| Guards changed to return a `UrlTree` as an "optimisation" | 2 | High — infinite redirect, because shell 1's `''` prefix-matches `/login` too | An in-code comment at the guard (step 7) plus `architecture.md` §3.1. Already analysed, declined, and confirmed by the owner on 2026-08-15 for the robust plan |
| `options.Events` written as assignment rather than mutation | 1 | **Zero today; high and completely silent later** — it discards `OnValidatePrincipal` the moment Identity lands, disabling security-stamp validation with no error | Written as mutation from the start (step 4), with the reason recorded inline |
| **Plaintext password recovered from a database backup and reused elsewhere** | ongoing | High, outside this app entirely | A password unique to this app, generated randomly. Never seeded from code, never logged, never echoed. TLS mandatory. `architecture.md` §6 |
| A copied cookie stays valid for its full lifetime; changing the password revokes nothing | ongoing | Medium, **accepted** | 24h sliding expiry, `HttpOnly` + `Secure` + `SameSite=Lax`. Kill switch: clear `data_protection_keys` and restart. `architecture.md` §1.6 |
| **`AuthService.logout()` acts only on success, so Sign out does nothing on an already-expired session** | 2 | Medium, **completely silent** — the button appears inert, in precisely the situation the owner asked for it. Both interceptors skip `/api/auth/`, so nothing else covers the `401` | `logout()` clears the signal and navigates from `error` as well as `next` (Phase 2 step 11, `architecture.md` §3.4). Verified by expiring or deleting the cookie in devtools and then clicking Sign out |
| **A session lapsing with the mystery-create wizard open loses the current phase's work** | ongoing | Low probability (sliding expiry, so it takes an overnight idle), **knowingly accepted by the owner** | None, deliberately. The gap is pre-existing — a plain browser reload does the same today — and the owner has accepted it explicitly. **Recorded so it is not mistaken for a defect later; no draft-persistence work should be proposed on the strength of this row.** `open-questions.md` #4 |
| `app.routes.spec.ts` passes only because `.find(path === '')` hits the first shell | 2 | Low, but a confusing red suite if the shells are ever reordered | Noted at step 12; the added logged-out case does not depend on ordering |
| `core/api.spec.ts` goes red the moment `apiBaseUrl` becomes `''` | 2 | Low | Enumerated as step 1, not discovered as a failing suite |

---

## Verification checklist

Run at the end of Phase 3, before anything is deployed.

- [ ] No auth NuGet package was added — the only new reference is
      `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`.
- [ ] No `[Authorize]` attribute exists anywhere; gating is the fallback policy alone.
- [ ] Exactly four things are `[AllowAnonymous]`: `login`, `me`, `/health/live`, the SPA fallback.
- [ ] **Logged out, `GET /login` and `GET /monsters/{id}` both return `200 text/html`** — the shell is
      reachable without a session, by design.
- [ ] Logged out, `GET /api/mysteryes` (deliberate typo) returns `401` — **not** `200` with HTML.
- [ ] Logged in, that same typo returns `404`.
- [ ] The login field is `email` end to end: `app_users.email`, `LoginRequest.Email`,
      `CurrentUserResponse.Email`, the form control, and `CurrentUser.email`. **No `username` appears
      anywhere in the codebase.**
- [ ] Logging in with the email in a different case than the stored row succeeds.
- [ ] Every one of the 107 existing actions returns `401` with no cookie — spot-check at least one per
      controller, including `GET /api/search/quick` and a `ReferenceController` GET.
- [ ] The `401` is a bare `401`, never a `302` to `/Account/Login`.
- [ ] Wrong password → `400 { "code": "invalid_credentials" }`, inline message on the page, **no
      toast**, and the page does not navigate.
- [ ] **With the API stopped, submitting the login form shows a generic inline message** — the button is
      not inert.
- [ ] **Expiring the session and then triggering any API call bounces to `/login` with no
      `Request failed (401)` toast** — catches the interceptor registration order.
- [ ] **A reload while signed in lands directly on the app, with no flash of the login page** — catches
      `initialize()` not being awaited by `provideAppInitializer`.
- [ ] The icon sprite renders on the login page (any `<app-icon>` there is visible, not blank).
- [ ] `GET /api/auth/me` returns `null`, not `401`, when signed out.
- [ ] `Set-Cookie` carries `motw.session`, `HttpOnly`, `SameSite=Lax`, and — under
      `ASPNETCORE_ENVIRONMENT=Production` — `Secure`.
- [ ] Restarting the API does not sign the user out (`data_protection_keys` has rows and they survive).
- [ ] Clearing `data_protection_keys` and restarting **does** sign the user out.
- [ ] Logged out, `/`, `/dashboard`, and an unknown URL all land on `/login`.
- [ ] Logged out, **no** feature chunk is requested (shell 1's `canMatch` gates all nine lazy entries —
      three `loadComponent`, six `loadChildren`).
- [ ] Stopping the API makes the "API unavailable" modal appear — in `ng serve` **and** in the
      single-origin build, **and both signed in and signed out** — the logged-out case is the one Phase 2
      step 10b exists to restore, and it is what verifies the `/health` proxy rule.
- [ ] Sign out returns to `/login`, and the browser back button does not restore the app.
- [ ] **Sign out still works when the session has already expired** — delete or expire the
      `motw.session` cookie in devtools, click Sign out, and confirm it lands on `/login` rather than
      appearing inert.
- [ ] Production-mode single-origin run serves the app on the API's own port with `ng serve` stopped,
      including a hard refresh on a deep link.
- [ ] `MotwDbInitializer` contains no credential and no user seeding.
- [ ] No environment variable, connection string, or password is committed.
- [ ] The existing API unit tests and Angular specs all pass.

**Added by Bowser's review, 2026-08-19 — each one pins a finding that otherwise fails silently:**

- [ ] **`app.UseRouting()` appears explicitly in `Program.cs`**, between `UseStaticFiles` and
      `UseAuthentication`. Without it the pipeline is not the one `architecture.md` §2.3/§2.4 describe.
- [ ] **`UseForwardedHeaders`'s options block contains `KnownNetworks.Clear()` *and*
      `KnownProxies.Clear()`**, not just the `ForwardedHeaders` flags. Read, not run — this cannot be
      reproduced locally, and its absence presents as "login succeeds but no cookie appears."
- [ ] **`dotnet publish` output contains `wwwroot/index.html` and the hashed bundles, and the app runs
      correctly *from that output***, not just from `bin/`. This is the check that catches an empty or
      stale `wwwroot` reaching the publish.
- [ ] **The bundles in the publish output are the *production* ones** — content-hashed filenames, not
      the unhashed output `npm run watch` would have left behind. Confirms `npm run build` ran
      immediately before `dotnet publish`.
- [ ] `MonsterOfTheWeek.Api.csproj` contains **no** SPA-related MSBuild target of any kind, and
      `dotnet test` still runs without Node installed.
- [ ] `angular.json`'s `outputPath` is `{ "base": "../../api/MonsterOfTheWeek.Api/wwwroot", "browser": "" }`
      and `ng build` produces `wwwroot/index.html`, **not** `wwwroot/browser/index.html`.
- [ ] `ng serve` and the dev proxy still work with `outputPath` pointing into the API project — the dev
      server builds in memory and never writes there.
- [ ] **`wwwroot/` appears in *both* `.gitignore` and `.dockerignore`**, anchored. `git status` is clean
      after a build, and `git ls-files` shows nothing under `wwwroot/`.
- [ ] `dotnet run` on a clean clone (no `wwwroot`) still starts.
- [ ] **`docker build` succeeds from a clean checkout and the resulting image serves the app** — sign in,
      navigate, hard-refresh a deep link, and hard-refresh it again signed out.
- [ ] **The image's `wwwroot` is the one the frontend stage built**, not a copy of the developer's local
      one — verify by deleting the local `wwwroot`, rebuilding the image, and confirming it still serves.
      This is what `.dockerignore` is for.
- [ ] The Dockerfile uses a **Node 26** base image (matching `.nvmrc`/`engines`), binds
      `ASPNETCORE_HTTP_PORTS` to `$PORT`, and runs `dotnet publish` against the **API `.csproj`**, not
      `MonsterOfTheWeek.slnx`.
- [ ] `railway.toml`'s `healthcheckPath` is **`/health/live`**, and hitting it returns JSON/plain text —
      **not** `text/html` from the SPA fallback.
- [ ] **`app.UseHttpsRedirection()` is inside the `IsDevelopment()` branch**, and no `HttpsPort` /
      `ASPNETCORE_HTTPS_PORT` / `HTTPS_PORT` is configured anywhere.
- [ ] `AllowedHosts` is still `"*"` — or, if it has been tightened, it includes
      **`healthcheck.railway.app`**, or every deploy will stop going live with a `400`.
- [ ] `ConnectionStrings__Postgres` is a **key=value** string, not a `postgresql://` URI.
- [ ] **No Docker is required for the development loop** — `docker compose up -d postgres`, `dotnet run`,
      `npm start` is sufficient, and editing a component hot-reloads without a rebuild.
- [ ] `appsettings.json` carries **no** `ConnectionStrings` and **no** `Cors` block; both live in
      `appsettings.Development.json`, and `dotnet ef migrations list` still works.
- [ ] `AppUser` does not implement `ITimestamped`, the `DbSet` is `AppUsers`, and the runbook's
      `INSERT` supplies `created_at` (or the column has a `now()` default).
- [ ] After the first login, `data_protection_keys` has ≥ 1 row — **and it is expected to be empty
      before that**, including for the whole of Phase 0.
- [ ] The documented liveness-probe path is `/health/live` exactly; `/health` returns
      `200 text/html` from the SPA fallback and must not be used as a probe.
