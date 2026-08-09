# Authentication & Authorization — Architecture

Companion documents: `data-ownership.md` (requirement #3 in detail), `phases.md` (execution),
`open-questions.md` (the owner's resolutions, recorded).

**All 18 questions are resolved.** The original 16 were answered on 2026-08-08; two follow-ups (#18,
#19) opened by the correction to #7 were answered the same day. Three resolutions went against the
recommended default and changed the design: **#8** (no super-admin bootstrap mechanism; roles
assigned directly in the database — §3), **#13** (role management ships inside the Data Admin section
— §3), and **#19** (forgot-password on an unconfirmed account sends a *confirmation* link rather than
silently doing nothing — §5).

**Correction, same day:** resolution **#7** (email confirmation) was initially answered "not a login
gate," then corrected back to the recommended default — **confirmation *is* required before first
login**. The owner had read the question as proposing an emailed code on every sign-in, i.e. a second
factor; a one-time verification at enrollment is what they want. Everything derived from the
short-lived "not a gate" premise was **re-derived, not patched**. See §5, §7, and `open-questions.md`
#7.

**Scope:** make per-user data ownership possible, and add authentication. Anything beyond that is out
of scope — see `README.md`.

**This design is subject to a review gate: Boo, Luigi, and Bowser must all sign off before
implementation begins.** See `README.md`.

---

## 0. Verified starting point

Everything below is grounded in the current code, not in the docs. What was verified:

| Fact | Evidence |
|---|---|
| No authentication or authorization exists anywhere | No `[Authorize]`, no `AddAuthentication`, no auth package reference in `MonsterOfTheWeek.Api.csproj` (only EF Design, Npgsql, Swashbuckle). The only `Identity` hits in the repo are `NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns` in migration designers (unrelated — Postgres identity columns) and transitive shared-framework entries in `obj/`. |
| No Angular guards, no auth state, no login route | `app.routes.ts` has one top-level route (`PageLayoutComponent`) with nine children and a `**` redirect. No `canActivate`/`canMatch` anywhere. |
| The user menu's Profile and Sign out are dead links | `page-layout.html` lines 104 and 111: `<a … href="#">Your profile</a>` and `<a … href="#">Sign out</a>`. Only "Settings" has a real `routerLink`. Avatar is a hardcoded `U`. |
| **There is no username concept anywhere in the app** | No `username` field in `Contracts/ApiContracts.cs`, `core/models.ts`, or any template. Load-bearing for the login-identifier call in §1, which the owner has since confirmed. |
| **There is no background-work or queueing infrastructure** | No `BackgroundService`, no `IHostedService`, no channel/queue anywhere in the API project. Relevant to the mail-dispatch decision in §5. |
| `MotwDbContext.OnModelCreating` does not call `base.OnModelCreating` | `Data/MotwDbContext.cs` line 52. Relevant: switching the base class to `IdentityDbContext<…>` requires adding that call, or no Identity table is mapped. |
| Every sub-resource repository query is already parent-scoped | e.g. `MonsterRepository` lines 110–210: `Where(x => x.MonsterId == monsterId)` on attacks/powers/armors/weaknesses/custom-moves, and `Where(x => x.Id == attackId && x.MonsterId == monsterId)` for single-item reads/deletes. |
| Most, but **not all**, sub-resource service methods guard on parent existence | `MonsterService` has 31 public methods and 19 `*ExistsAsync(` guards; `MinionService` 29/15; `Location`/`Bystander` 12/7 each; `Mystery` 7/3. The unguarded ones are the update/delete-by-child-id paths that rely on the repository's parent-scoped `Get…` returning null. **Parent-scoped is not owner-scoped** — see `data-ownership.md` §4. |
| The five search providers query `MotwDbContext` directly, bypassing repositories and services | `Services/Search/*SearchProvider.cs` — e.g. `MonsterSearchProvider` does `dbContext.Monsters.AsNoTracking().Select(…)`. Any ownership enforcement that lives in the repository or service layer would silently miss global search. |
| `HealthService` uses `HttpClient` directly, not `ApiService` | `core/health.ts` — so `withCredentials` cannot be set in `ApiService`'s four methods alone; it needs an interceptor. |
| `environment.ts` hardcodes `http://localhost:5225` and there is **no** production environment file or `fileReplacements` entry | `src/environments/environment.ts`, `angular.json` `build.configurations.production` (budgets + `outputHashing` only). **Deferred to Phase 6** per the owner. |
| Test project is pure unit tests with hand-written fakes; no `WebApplicationFactory`, no `Microsoft.AspNetCore.Mvc.Testing` | `MonsterOfTheWeek.Api.Tests.csproj` — xunit, EF Sqlite, coverlet. Frontend is vitest + jsdom/playwright. |
| 107 controller actions across six domain controllers | `grep -c '\[Http' Controllers/*.cs` — 12/12/29/31/7/14/2. Load-bearing for the fail-closed argument in §3. |
| `ThemeService` already anticipates this feature | `core/theme.ts` lines 10–14: "swapping the backing store later (e.g. a per-user backend setting once auth exists) is a change confined to this file." Not acted on — resolution #16 defers it; theme stays in `localStorage`. |

---

## 1. Auth mechanism

### The requirements that actually constrain the choice

- **#1 "secure authentication flow with a session"** — the word *session* is used deliberately.
- **#7 "Sign out must actually revoke the session"** — revocation must be real, server-acknowledged,
  not "the client threw the token away."
- **#6 bare-bones login/enrollment landing page matching the current design** — the login UI is
  *ours*, rendered by our Angular app, styled with our existing Tailwind token layer.
- **#8 ideal .NET and Angular patterns** — don't hand-roll crypto; don't fight the framework.

### Options evaluated

**A. ASP.NET Core Identity + cookie authentication, hand-written API controllers. ← RECOMMENDED**

Identity supplies `UserManager`, `SignInManager`, `RoleManager`, the PBKDF2 password hasher, the
lockout state machine, and `DataProtectorTokenProvider` for email-confirmation and password-reset
tokens. Cookie authentication supplies the session. We write ~10 thin controller actions ourselves so
the HTTP surface, DTO records, and error shape match the existing
`Controllers/ → Services/ → Repositories/ → ServiceResult<T>` conventions exactly.

- Session is a real session: an encrypted, `HttpOnly`, `Secure`, `SameSite=Lax` cookie whose ticket
  the server issues and can invalidate.
- `SignInManager.SignOutAsync()` deletes the cookie. Combined with
  `SecurityStampValidatorOptions.ValidationInterval`, a security-stamp bump (which
  `ChangePasswordAsync` performs automatically) revokes *every other* session within the validation
  interval. That is genuine revocation, which is what #7 asks for.
- Login page is ours. No redirect, no hosted UI, no branding mismatch.
- Zero new infrastructure: Postgres and EF Core are already here. Identity's tables join the
  existing migration history.

**Trade-off accepted:** cookies mean CSRF is now a real threat that must be explicitly defended
against (§3, §7). Bearer tokens would not have that problem. We take that trade because the
alternatives to cookies are worse on revocation, and because a same-origin deployment (§2) plus
`SameSite=Lax` plus ASP.NET's antiforgery makes CSRF a solved, well-trodden problem rather than an
open one.

**B. Identity + `MapIdentityApi<AppUser>()` (bearer + refresh tokens). REJECTED.**

.NET 8+ ships a one-line endpoint group giving `/register`, `/login`, `/refresh`,
`/confirmEmail`, `/forgotPassword`, `/resetPassword`, `/manage/info`, `/manage/2fa`. Tempting.

Rejected because:
- **It has no logout endpoint.** This is a well-known, deliberate omission. The bearer tokens it
  issues are self-contained `AuthenticationToken`s protected by Data Protection; there is no
  server-side revocation list. "Sign out" would mean the client discarding the token, which fails
  requirement #7 outright.
- Its response contracts (`AccessTokenResponse`, its own validation-problem shapes) are fixed and
  do not match this codebase's DTO record conventions in `Contracts/ApiContracts.cs`.
- It exposes 2FA and recovery-code surface area that isn't wanted and can't be trimmed — and the
  owner has been explicit (in the clarification behind resolution #7) that they do not want anything
  that reads as a second factor.
- `?useCookies=true` gets you the cookie back, but then you're using half a feature and still have
  no logout.

Note where this design deliberately *diverges* from `MapIdentityApi`: its `/forgotPassword` silently
does nothing for an unconfirmed account. Resolution #19 overrode that behaviour here — we send a
confirmation link instead. §5 covers why, and why it stays enumeration-safe.

**C. External IdP — Entra External ID / Auth0 / Keycloak. REJECTED for v1.**

Genuinely attractive on paper: enrollment, password reset, email delivery, breach detection, and MFA
all become someone else's problem, and the outbound-email dependency (§5) disappears.

Rejected because:
- Requirement #6 asks for an in-app bare-bones login/enrollment page matching the current design. An
  IdP's value comes precisely from *owning* that page; using its embedded/hosted UI conflicts with
  the requirement, and using the resource-owner-password-credentials grant to keep our own form is
  deprecated and unsupported by most of them.
- You still need a local user row to hang `owner_id` foreign keys off (`data-ownership.md` §2), so
  you get a shadow-user table anyway — the "no user table" saving is illusory.
- Keycloak self-hosted is a second stateful container to run, back up, and upgrade. Auth0/Entra are
  free at this scale but add a vendor, an OIDC round-trip, tenant configuration, and a second place
  where roles could live — which conflicts directly with resolution #8's model of roles being a row
  in *our* database.
- The one thing it would buy us that we genuinely lack — deliverable transactional email — is
  solvable directly for less effort (§5).

Worth revisiting if the app ever wants social login, MFA, or SSO. The design below keeps that door
open: Identity's `AddAuthentication` pipeline accepts additional external schemes without touching
the ownership model.

**D. Hand-rolled auth. REJECTED.** Never write your own password hashing, token generation, or
lockout state machine when the framework ships an audited implementation. Not seriously considered;
listed for completeness because "we only need something simple" is the usual road into it.

### Login identifier: email — owner-confirmed

The brief originally said "username + password." **The owner has since confirmed that email/password
is the auth mechanism and that there is no separate username concept** — "username" was being used
loosely as a synonym for the login identifier. Settled, not pending.

This matches what the code already implies:

- Enrollment, password reset, and the Profile view (requirement #7: "showing the user's email
  address") are all keyed off email.
- **There is no `username` field anywhere in the codebase** — not in `Contracts/ApiContracts.cs`, not
  in `core/models.ts`, not in any template.
- The super-admin Users panel (§3) lists accounts; email is the identifier an operator can actually
  recognise, and it's the one they'll use when assigning a role by hand in the database.

Implementation: `Options.User.RequireUniqueEmail = true`; set `UserName = Email` at registration so
Identity's internals stay consistent; the login endpoint takes `email` and resolves via
`FindByEmailAsync`.

### Session shape

| Setting | Value | Reason |
|---|---|---|
| Cookie name | `motw.session` | Non-default, non-fingerprinting. |
| `HttpOnly` | `true` | JS never reads it; the SPA learns identity from `GET /api/auth/me`, not from the cookie. This is what makes XSS token theft impossible. |
| `SecurePolicy` | `Always` in Production, `SameAsRequest` in Development | Dev runs plain HTTP on `localhost:5225`. |
| `SameSite` | `Lax` | Viable *because* of the same-origin deployment decision in §2. Blocks the cookie on cross-site POST/PUT/DELETE, which is the primary CSRF vector. |
| `ExpireTimeSpan` | **14 days** (resolution #11) | |
| `SlidingExpiration` | `true` (resolution #11) | Active users are never logged out mid-session. |
| `IsPersistent` | `true`, unconditionally — **no "Remember me" checkbox** (resolution #11) | Survives browser restart. One fewer control on a bare-bones login page. |
| `SecurityStampValidationInterval` | **30 minutes** (resolution #11) | Upper bound on how long a revoked session stays usable — and, per resolution #8, **the only mechanism by which a database role change reaches a live session.** See §3. |
| 401/403 behaviour | `OnRedirectToLogin`/`OnRedirectToAccessDenied` overridden to return bare `401`/`403` | Default cookie handler issues a `302` to `/Account/Login`, which is wrong for an API and confusing for `HttpClient`. This override is mandatory, not optional. |

---

## 2. Hosting topology — the decision the cookie design rests on

Resolution #1: **single origin**, as recommended.

This is in scope per requirement #9: it materially determines cookie, CORS, and CSRF configuration.

Today the SPA is served by `ng serve` on `http://localhost:4200` and the API by Kestrel on
`http://localhost:5225`. Different **origins**, but the *same site* (`SameSite` is evaluated on the
registrable domain; port is irrelevant), so `SameSite=Lax` cookies already flow in development as
long as requests carry `withCredentials` and CORS allows credentials.

Production has three plausible shapes:

| Shape | Cookie viability | CORS | Angular built-in XSRF |
|---|---|---|---|
| **Single origin (chosen)** — API serves the built SPA (`UseDefaultFiles` + `UseStaticFiles` + `MapFallbackToFile("index.html")`), API under `/api/*` | First-party, `SameSite=Lax`, no `Domain` needed | **Not needed at all** | **Works** |
| Sibling subdomains — `app.example.com` + `api.example.com` | Works with `SameSite=Lax` and `Domain=.example.com` (same registrable domain ⇒ same-site) | Needed, with `AllowCredentials` + explicit origins | Broken — Angular's `HttpXsrfInterceptor` deliberately skips absolute URLs to other origins |
| Different registrable domains — e.g. Netlify + a PaaS API | Requires `SameSite=None; Secure`, i.e. a **third-party cookie**. Chrome/Safari/Firefox are actively restricting these | Needed, with `AllowCredentials` | Broken |

**Chosen: single origin — the API project serves the Angular build output.** One container, one
hostname, one TLS certificate, no CORS policy in production, first-party cookie, and Angular's
`withXsrfConfiguration` works without a custom interceptor.

**Trade-off accepted:** the SPA's availability is coupled to the API's — an API deploy or restart
takes the UI down with it — and there is no CDN in front of the static assets. For a single-GM tool
with a handful of users, both are irrelevant costs against eliminating the entire cross-site-cookie
problem class.

Development keeps the current two-server setup unchanged. This means **dev and prod differ in origin
topology**, which is worth stating plainly: the CORS policy and its `AllowCredentials` are
development-only configuration in the chosen shape.

**A second consequence, relevant to §5 and §7:** single-origin also implies **single-instance**. The
in-memory outbound-mail throttle (§7) is adequate precisely because of that, and would need to move
to the database or a distributed cache if the app ever scaled out.

**The frontend build consequence — `environment.ts`'s hardcoded `http://localhost:5225`, the missing
production environment file, and the missing `angular.json` `fileReplacements` entry — is deferred to
Phase 6**, where the owner will run a separate focused analysis before deploying. It is recorded in
`phases.md` under Phase 6 and is not current work.

---

## 3. Authorization model

### Roles, not claims, expressed through policies

Three roles: `SuperAdmin`, `Admin`, `User`. Stored in Identity's role tables. Role membership flows
into the cookie as `ClaimTypes.Role` claims automatically — which, per resolution #8, is the
mechanism the whole model rests on.

**Never write `[Authorize(Roles = "Admin,SuperAdmin")]`.** Register named policies once in
`Program.cs` and reference the policy name:

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("DataAdmin",  p => p.RequireRole(Roles.Admin, Roles.SuperAdmin))
    .AddPolicy("SuperAdmin", p => p.RequireRole(Roles.SuperAdmin))
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
```

Why policies over role strings: one place to change when "who counts as a data admin" changes, no
string-literal drift across controllers, and the policy names read as capabilities rather than as
org-chart positions. `Roles` is a `static class` of `const string` so the role names themselves are
never re-typed either.

`RequireRole` reads the role **claims on the principal in the cookie** — it does not hit the
database per request. That is the correct, conventional behaviour and it's fast, but it is exactly
why the propagation question below matters.

### Fail closed — the single most important structural call

`SetFallbackPolicy(RequireAuthenticatedUser)` makes **every** endpoint require authentication unless
it explicitly opts out with `[AllowAnonymous]`. The alternative (decorate each controller with
`[Authorize]`) fails open: any controller or action added later without the attribute is silently
public. With 6 domain controllers and 107 actions across them, and given this codebase's
demonstrated pattern of adding endpoints incrementally, fail-open is not an acceptable default.

Endpoints that must carry `[AllowAnonymous]`:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`,
  `POST /api/auth/reset-password`, `POST /api/auth/confirm-email`,
  `POST /api/auth/resend-confirmation`
- `GET /api/auth/csrf` (issues the antiforgery cookie before login)
- `GET /health/live` — **must** stay anonymous or `PageLayoutComponent`'s API-availability modal
  (`page-layout.ts` `checkApiAvailability()`) will show "API unavailable" to every logged-out user
- The SPA static-file fallback

`GET /api/auth/me` is `[AllowAnonymous]` and returns `null` when the caller isn't signed in — if it
401'd, the bootstrap probe (§6) would error-toast on every cold load for a logged-out user.

### Role assignment: direct database manipulation (resolution #8)

The owner rejected every bootstrap mechanism — no `Auth:SuperAdminEmails` allowlist, no
config-seeded user, no first-registered-user-wins. **The model is:**

1. The owner registers through the normal public enrollment flow like anyone else, and confirms
   their address (§5).
2. A `SuperAdmin` role assignment is made **directly in the database**:

   ```sql
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id FROM users u, roles r
   WHERE u.email = 'owner@example.com' AND r.name = 'SuperAdmin';
   ```

3. From then on, that super-admin assigns `Admin` (and `SuperAdmin`) to others through the Users
   panel in the Data Admin section (resolution #13, below). Direct SQL is the *bootstrap* path, not
   the ongoing one.

`MotwDbInitializer` still seeds the three **role rows** — the `roles` table must contain
`SuperAdmin`/`Admin`/`User` for the `INSERT` above to have anything to reference, and seeding them
follows the existing `SeedLookupTablesAsync` pattern exactly. It does **not** create or promote any
user.

**Interaction with resolution #7's confirmation gate:** step 1 requires working email delivery in
production. Locally this is free (`LoggingEmailSender` prints the link). In production, if Resend
isn't configured yet, the same manual step that grants the role also confirms the address —
`UPDATE users SET email_confirmed = true WHERE email = '…';` — which is the documented break-glass
and belongs in the Phase 6 runbook next to the `INSERT`. See §5.

`User` is assigned to every account at registration by `AuthService`. It carries no privilege the
fallback policy doesn't already grant; it exists so "authenticated" and "is a user of the app" stay
distinguishable if a `Pending`/`Suspended` state is ever wanted.

### How a database role change reaches a live session — the only propagation path

This is the part resolution #8 makes load-bearing, so it is stated explicitly rather than assumed.

Role claims are baked into the encrypted cookie **at sign-in**. Running the `INSERT` above does
nothing to a cookie that already exists. Propagation happens through exactly one mechanism:

**`SecurityStampValidator`, running on every request, but doing work only once per
`ValidationInterval` (30 minutes, resolution #11).** When the interval has elapsed since the ticket
was issued, it:

1. loads the user from the database,
2. compares the security stamp in the cookie against the stored one,
3. **if they match, regenerates the principal from the database** via
   `SignInManager.CreateUserPrincipalAsync` — which re-reads `user_roles` — then calls
   `context.ReplacePrincipal(...)` and sets `ShouldRenew = true`, reissuing the cookie,
4. if they don't match, rejects the principal and signs the user out.

So: **a role added or removed in the database takes effect for a signed-in user within 30 minutes,
automatically, with no restart and no action by the user.** Immediate effect requires the user to
sign out and back in.

Two consequences worth planning around:

- **The 30-minute window is now a functional characteristic, not just a security bound.** If the
  owner grants themselves `SuperAdmin` while already signed in, the Data Admin section will not
  appear until the interval turns over or they re-login. Signing out and back in is the documented
  answer; without it this reads as a bug.
- **Revoking a role is not instantaneous.** For up to 30 minutes a demoted admin keeps admin
  capability. To force it immediately, change that user's `security_stamp` in the database — the
  stamp mismatch path signs them out at the next validation check. That is the break-glass
  procedure and it belongs in the runbook.

**Flagged for Boo's review:** this is the entire authorization-propagation story. There is no
per-request database role check, no cache invalidation hook, and no admin-triggered "force re-auth"
endpoint. Shortening `ValidationInterval` trades database reads for freshness if 30 minutes proves
too slack.

### "Data Admin section = admin or super admin"

Two independent enforcements, both required:

1. **Server (authoritative).** `ReferenceController`'s seven `POST` actions get
   `[Authorize(Policy = "DataAdmin")]`. The seven `GET` actions **stay open to any authenticated
   user** — every create/edit form in the app (`monster-form`, `minion-form`, `location-form`,
   `bystander-form`, the mystery wizard, `weapon-tag-select`) loads reference data on init. Gating
   the GETs would break the entire app for non-admins.
2. **Client (cosmetic).** `canMatch: [adminMatch]` on the `data-admin` route so the lazy chunk is
   never even fetched, and the `Data Admin` entry in `PageLayoutComponent.navItems` is filtered out
   when `!authService.isAdmin()`.

**Resolution #5 confirmed, and the regression is accepted knowingly:** after this lands, ordinary
users can no longer create monster types, minion types, location types, bystander types, adventure
types, monster archetypes, or weapon tags. Today anyone can. Every non-admin's create form will be
limited to the seeded reference rows plus whatever an admin has added.

### Role management inside Data Admin (resolution #13)

Role management is **not** a separate surface. It ships as a **super-admin-only panel inside the
existing Data Admin page**, alongside the reference-type panels that are already there.

- Route: still `/data-admin`, still `canMatch: [adminMatch]` (admin *or* super-admin can reach the
  page). The Users panel itself renders only when `isSuperAdmin()`, so a plain `Admin` sees the
  reference-type panels and nothing else.
- Endpoints: `GET /api/admin/users` and `PUT /api/admin/users/{id}/roles`, both
  `[Authorize(Policy = "SuperAdmin")]`. The client-side panel visibility is cosmetic; the policy is
  the enforcement.
- Guard rails: a super-admin cannot remove their own `SuperAdmin` role, and the last remaining
  super-admin cannot be demoted — otherwise the app has no administrator and recovery is back to
  direct SQL.
- Shape: a list of accounts by email with role checkboxes, matching the existing
  `weapon-tag-admin` panel's plain-table style. No invitations, no account creation, no deletion —
  all out of scope.

This ships in **Phase 4**, not as a separate Phase 5.

---

## 4. API surface changes

New controllers, following the existing thin-controller convention (controllers translate
`ServiceResult<T>` to `ActionResult`; all logic in a service):

| Method | Route | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/auth/register` | Anonymous, rate-limited (§7) | Enumeration-safe: always returns the same 200 "check your email" body. Sends the confirmation mail; the account cannot sign in until the link is followed (§5) |
| `POST` | `/api/auth/login` | Anonymous, rate-limited | Email + password. `PasswordSignInAsync(…, lockoutOnFailure: true)`. Returns one generic failure for wrong-password / no-such-account / locked-out, and **one distinct response for correct-credentials-but-unconfirmed** — the deliberate narrow exception in §7 (resolution #18) |
| `POST` | `/api/auth/logout` | Authenticated | `SignOutAsync()` — deletes the cookie server-side |
| `GET` | `/api/auth/me` | Anonymous, returns `null` if not signed in | `{ id, email, roles: string[] }`. **No `emailConfirmed` field** — an authenticated user is confirmed by definition, so it would be dead data |
| `GET` | `/api/auth/csrf` | Anonymous | Issues the `XSRF-TOKEN` cookie for the login form |
| `POST` | `/api/auth/confirm-email` | Anonymous | `{ userId, token }` |
| `POST` | `/api/auth/resend-confirmation` | **Anonymous**, rate-limited + throttled | `{ email }`. Always 200. Only sends if the account exists and is unconfirmed. Shares the `Confirmation` mail budget with forgot-password's unconfirmed branch (§7) |
| `POST` | `/api/auth/forgot-password` | Anonymous, rate-limited + throttled | Always 200, **identical body in every case**. Confirmed account → password-reset mail. **Unconfirmed account → *confirmation* mail** (resolution #19). No such account → nothing (§5) |
| `POST` | `/api/auth/reset-password` | Anonymous, rate-limited | `{ userId, token, newPassword }` |
| `POST` | `/api/account/change-password` | Authenticated | `{ currentPassword, newPassword }`; `RefreshSignInAsync` afterwards so the caller's own session survives |
| `GET` | `/api/admin/users` | `SuperAdmin` | Phase 4, Data Admin Users panel |
| `PUT` | `/api/admin/users/{id}/roles` | `SuperAdmin` | Phase 4, Data Admin Users panel |

Existing controllers: **no route changes, no signature changes.** They inherit the fallback policy.
`ReferenceController`'s seven POSTs gain `[Authorize(Policy = "DataAdmin")]`. All ownership
filtering happens below the controller (see `data-ownership.md`), so no controller learns about
`ownerId` — that stays out of the HTTP contract entirely, which is the right boundary: ownership is
ambient, derived from the authenticated principal, and must never be client-supplied.

---

## 5. Enrollment and password reset

### Email confirmation is required before first login (resolution #7, as corrected)

**`SignInOptions.RequireConfirmedAccount = true`.** A confirmation email is sent at registration, and
**the account cannot sign in until the link is followed.** Identity's default `IUserConfirmation<T>`
resolves this to a check on `EmailConfirmed`, so no custom confirmation service is needed.

> **Correction history.** The owner's first answer set this to *not* a gate. That was a misreading —
> they were rejecting an emailed code on *every* login (a second factor), not a one-time verification
> at enrollment. Corrected the same day back to the original recommendation. Everything derived from
> the short-lived "not a gate" premise has been **re-derived, not patched**, because several of those
> consequences were consequences of the wrong premise and were wrong themselves. `open-questions.md`
> #7 carries the record.

**What the gate buys, and why it's the right default here:** the confirmation link is the only proof
that whoever registered controls the address. With the gate in place, registering under someone
else's address produces an account that can never be used — an inert row, not a usable identity.
That single property is what makes open self-registration (resolution #9) safe to expose publicly,
and it removes address-squatting, account-reclaim, and usable-junk-accounts from the threat model
entirely rather than mitigating them.

**The cost is an ordering hazard, and resolution #8 sharpens it.** If outbound email is broken,
nobody can complete registration — including the owner. The original design closed this with an
auto-confirm for allowlisted super-admin addresses, but resolution #8 removed the allowlist, so that
mitigation no longer exists. Two things resolve it, both consistent with #8's "operate on the
database by hand to bootstrap" model rather than being new mechanisms:

- **Local development is unaffected.** `LoggingEmailSender` writes the confirmation link to the
  console, so the flow completes with zero external dependencies.
- **Production has a documented break-glass.** The same manual step that grants the first
  `SuperAdmin` row (§3) also confirms the address, if Resend isn't wired up yet:

  ```sql
  UPDATE users SET email_confirmed = true WHERE email = 'owner@example.com';
  ```

  Phase 6 runbook item, next to the `INSERT`.

### The outbound email dependency

This is the one genuinely new external dependency the whole feature introduces, and the confirmation
gate makes it load-bearing rather than merely useful: **no email delivery means no new accounts.**

**Design:** an `IEmailSender` abstraction in the API with two implementations —

- `LoggingEmailSender` (**local development**, resolution #6): writes the subject and the full link
  to `ILogger`. Local dev keeps working with zero external dependencies and zero configuration,
  which matters because the existing local workflow (`docker compose up postgres` → `dotnet run` →
  `npm start`) has no outbound network dependency today and shouldn't gain one.
- **`ResendEmailSender` (production, resolution #6)** — Resend, on its free tier, over its HTTP API
  (no SMTP client, no MailKit dependency). Requires a verified sending domain with SPF and DKIM
  records. Deliverability is the whole point: a confirmation mail that lands in spam is now a
  blocked signup, not just an annoyance.

Selection is by configuration, not by `IWebHostEnvironment` checks scattered through the code — one
registration branch in `Program.cs` keyed on `Email:Provider` (`"Logging"` | `"Resend"`).

Configuration needed at deploy time: `Email:Provider`, `Email:ApiKey` (secret, resolution #14),
`Email:FromAddress`, `Email:FromName`, and `App:PublicBaseUrl` (used to build confirmation/reset
links — the API cannot infer this reliably from behind a reverse proxy).

**Mail dispatch happens off the request path.** A small `Channel<T>`-backed `BackgroundService`
(there is no background-work infrastructure in the project today — §0) accepts queued messages and
sends them. Two reasons, and the second is the load-bearing one:

1. The endpoint's latency stops depending on Resend's. A provider slowdown degrades mail delivery,
   not the API.
2. **It is what makes the "identical response in every case" property in the flows below actually
   hold.** If the provider call were awaited inline, a request that sends mail would be measurably
   slower than one that doesn't — and since "does mail get sent" correlates exactly with "does this
   account exist," that is a timing oracle for account enumeration. Queueing makes every branch do
   the same negligible amount of in-request work.

This is a modest side channel (statistical, needs many samples, reveals only registration status),
but the mitigation is ~40 lines and it is the difference between "identical response" being true and
being approximately true.

### Token lifetimes

Identity's default `DataProtectorTokenProvider` has a **single global 1-day lifespan** shared by
every purpose. Different purposes want different lifetimes, so register a second, named provider:

- **Email confirmation: 24 hours** (default provider). Long enough for someone who registers in the
  evening and checks mail the next day. An expired link is not a dead end — both the resend flow and
  forgot-password's unconfirmed branch issue a fresh one.
- **Password reset: 1 hour** (named provider with its own `DataProtectionTokenProviderOptions`).
  A reset token is a full account takeover if intercepted; keep the window short.

Both are single-use in effect because consuming them rotates the user's security stamp, which the
token is derived from.

**The gap between these two lifetimes is why resolution #19's flow does not chain into a reset** —
see "After following a confirmation link that came from forgot-password" below.

### Flows

**Enrollment**
1. `POST /api/auth/register { email, password }` → validate password policy → `CreateAsync` with
   `UserName = Email` → assign the `User` role → `GenerateEmailConfirmationTokenAsync` → queue mail
   with `{PublicBaseUrl}/confirm-email?userId=…&token=…`.
2. **If the email already exists, return the identical 200 response** and instead send a "someone
   tried to register with your address" mail to the existing account. Registration endpoints are the
   classic account-enumeration oracle; this closes it. (This is also what `MapIdentityApi` does.)
3. The client lands on `/login` with a "check your email to confirm your address before signing in"
   note. **No auto-sign-in** — there is nothing to sign into yet.
4. `/confirm-email` Angular page `POST`s to `/api/auth/confirm-email`, sets `EmailConfirmed`, and
   routes to `/login` with a success message. From here the account can sign in.

**Resend confirmation**
1. `POST /api/auth/resend-confirmation { email }` → always 200 → only sends if the account exists
   and is **unconfirmed**.
2. Reachable two ways from the unauthenticated shell: a `/resend-confirmation` route, and inline on
   the login page when a sign-in attempt returns the distinct "email not confirmed" response (§7).
3. **This endpoint is anonymous by necessity** — the only user who needs it is one who cannot sign
   in. See §6 for why it is not on the Profile page.
4. It sends `Confirmation`-purpose mail, so it consumes the same per-account budget as
   forgot-password's unconfirmed branch — see §7. This is not optional: two endpoints producing the
   same mail with separate budgets can be alternated to double the effective rate.

**Password reset — three branches, one response (resolution #19)**

`POST /api/auth/forgot-password { email }` **always returns the same 200 with the same body.** The
branch changes only which mail is queued:

| Server-side state | Mail queued | Token issued |
|---|---|---|
| No such account | none | none |
| Account exists, **confirmed** | password-reset mail → `{PublicBaseUrl}/reset-password?userId=…&token=…` | reset token, 1h |
| Account exists, **unconfirmed** | **confirmation mail** → `{PublicBaseUrl}/confirm-email?userId=…&token=…` | confirmation token, 24h — **no reset token** |

> **This is the design's single most important invariant and it must not be "helpfully" refined
> later: the caller cannot distinguish these three cases.** Same status, same body, same headers, and
> — via queued dispatch — the same timing. Differentiating any of them (a friendlier "we've sent you
> a confirmation link instead!" message, a different status for unknown addresses, an inline hint)
> converts this endpoint straight back into an account-enumeration oracle. The user learns which
> branch ran **from the mail they receive**, which is the only channel that already proves they
> control the address.

**Why the override is right, and what it does *not* change.** The previous design silently did
nothing for unconfirmed accounts, matching `MapIdentityApi`. The owner overrode it because the silent
success is a genuine dead end — the user gets a "check your email" message and no mail ever arrives,
with no way to discover why. Sending the confirmation link instead turns a dead end into a working
recovery path, at no cost to enumeration safety, because the response is unchanged.

**Reset itself remains blocked for unconfirmed accounts.** No password-reset token is ever issued to
an unconfirmed account, and `POST /api/auth/reset-password` still rejects one. The override changes
*which mail goes out*, not *whether an unconfirmed account can complete a password reset*. That
distinction is what keeps the confirmation gate meaningful.

**Mail copy for the unconfirmed branch — a requirement, not a nicety.** This user asked for a
password reset and receives a *confirmation* link they didn't ask for. Without an explanation that
reads as phishing, and it arrives at exactly the moment a user is primed to click a link in an email.
The mail must:

1. name the action the user actually took ("you asked to reset your password"),
2. explain why the link is a confirmation link rather than a reset link,
3. say what happens after they click,
4. carry the standard "if you didn't request this" line,
5. contain **no password-reset link** — no reset token exists.

Recommended copy (wording is the owner's to adjust; the five requirements above are not):

> **Subject:** Confirm your email address to reset your password
>
> You asked to reset your password for Monster of the Week.
>
> Before that's possible, this email address needs to be confirmed — it never was when the account
> was created.
>
> **[ Confirm your email address ]**
>
> Once it's confirmed you'll be able to sign in. If you still don't remember your password, request a
> reset again and we'll send you a reset link.
>
> If you didn't ask for this, you can ignore this email — nothing has changed, and nobody can use the
> account.

**After following a confirmation link that came from forgot-password.** The user's original goal was
a password reset, so there is a real choice here:

- **(a) Confirm → land on `/login`** with a success banner and a prominent "Still need to reset your
  password?" link to `/forgot-password`. ← **CHOSEN**
- (b) Confirm → immediately issue a password-reset token and drop the user into the reset form.

**(a), for a security reason rather than a simplicity one.** Option (b) makes `confirm-email`
conditionally mint a *password-reset* token, which means the 24-hour confirmation link becomes, in
effect, a 24-hour password-reset link. That directly undermines the deliberate 1-hour reset lifetime
above, and it does so precisely for the accounts that have already demonstrated weaker email hygiene.
It also requires carrying "this confirmation originated from a forgot-password request" through the
link as attacker-controllable state unless it's signed into the token — more surface for a
convenience win.

The cost of (a) is one extra round trip and one extra email for a user in an uncommon state. Since
they've just proven they control the mailbox, the second request is friction, not a barrier — and the
"Still need to reset your password?" link on the landing page makes it one click.

**Password change (requirement #7's profile form)**
`ChangePasswordAsync(user, current, new)` requires the current password — so a hijacked session
alone can't lock the real owner out. Then `RefreshSignInAsync(user)` reissues the caller's cookie
against the new security stamp, so *this* session survives and every *other* session is revoked.
That's the correct behaviour and it comes free.

---

## 6. Angular integration

### Route structure — two shells

Today `app.routes.ts` has exactly one top-level route: `PageLayoutComponent` at `''` with nine
children, plus `{ path: '**', redirectTo: '' }`. Add a second, sibling shell:

```
''                → PageLayoutComponent      canMatch: [authenticatedMatch]   (existing 9 children)
''                → AuthLayoutComponent      canMatch: [anonymousMatch]
                     ├ login
                     ├ register
                     ├ forgot-password
                     ├ reset-password
                     ├ resend-confirmation
                     └ confirm-email
'**'              → redirectTo: ''
```

- **`canMatch`, not `canActivate`.** `canMatch` runs *before* the lazy `loadChildren`/`loadComponent`
  import, so an unauthenticated visitor never downloads the mysteries/monsters/minions/locations/
  bystanders/search chunks at all. `canActivate` would fetch them and then deny. With seven lazy
  feature bundles this is a real difference, not a micro-optimisation.
- Two shells matching the same `''` path with complementary `canMatch` guards is the idiomatic
  Angular way to express "different chrome depending on auth state." The router tries them in order
  and takes the first that matches.
- `AuthLayoutComponent` is bare: centred card on `bg-surface-sunken`, the `MOTW` badge, no sidebar,
  no header, no search, no user menu — consistent with the existing token layer
  (`docs/theming/theming-plan.md`) so it matches the app without new design work.
- **`confirm-email` renders one of two success states**: the plain "your address is confirmed, sign
  in" case, and — for a confirmation that arrived via forgot-password — the same message plus a
  prominent "Still need to reset your password?" link to `/forgot-password` (§5). The component
  cannot know which case it is from the token, so the simplest honest approach is to **always show
  the reset link** on the confirmation success screen. It is useful to anyone who lands there and
  leaks nothing.
- `confirm-email` and `reset-password` must tolerate an **already-signed-in** visitor rather than
  being bounced by `anonymousMatch` — e.g. a confirmed user clicking a stale link from their inbox.
  Register them as guard-free routes, or exempt them from `anonymousMatch`'s redirect.
- `data-admin` child route gains `canMatch: [adminMatch]`.
- The `**` wildcard keeps redirecting to `''`; the two shells' guards then route the visitor to
  `/dashboard` or `/login` appropriately.

### Auth state — signals, mirroring `ThemeService`

`core/auth.ts`, `@Injectable({ providedIn: 'root' })`:

```ts
readonly user = signal<CurrentUser | null>(null);
readonly isAuthenticated = computed(() => this.user() !== null);
readonly isAdmin = computed(() => {
  const roles = this.user()?.roles ?? [];
  return roles.includes('Admin') || roles.includes('SuperAdmin');
});
readonly isSuperAdmin = computed(() => (this.user()?.roles ?? []).includes('SuperAdmin'));
```

`isSuperAdmin` exists for the Data Admin Users panel (resolution #13).

**There is no client-side token to persist.** The cookie is `HttpOnly`, so the SPA cannot read it;
the server is the only source of truth about who you are. That is a feature, not a limitation — it
removes the entire "where do we store the token / how do we avoid XSS exfiltration" question that a
bearer-token design would force.

The consequence is that the app must **ask** on boot:
`provideAppInitializer(() => inject(AuthService).initialize())`, which `GET`s `/api/auth/me` once and
populates the signal before the first route resolves. This mirrors the existing
`provideAppInitializer(() => inject(ThemeService).initialize())` line in `app.config.ts` exactly —
same pattern, same place, same reasoning. The initializer must resolve, not reject, on failure — a
network error means "not signed in," not "crash the bootstrap."

**Note the interaction with resolution #8's 30-minute propagation window:** `isAdmin()` is seeded
from the cookie's claims at bootstrap. A role granted in the database mid-session will not appear in
the UI until the security-stamp revalidation reissues the cookie *and* the app re-reads
`/api/auth/me` (i.e. a page reload). "Sign out and sign back in" is the reliable instruction, and it
should be what the Data Admin Users panel tells a super-admin after they change someone's roles.

`isAdmin()`/`isSuperAdmin()` are **UI-only**. Every capability they hide is independently enforced by
the server.

### HTTP wiring

`app.config.ts` becomes:

```ts
provideHttpClient(
  withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
  withInterceptors([credentialsInterceptor, authErrorInterceptor, httpErrorInterceptor])
)
```

- **`credentialsInterceptor`** — clones every outgoing request with `withCredentials: true`. It must
  be an interceptor rather than a change to `ApiService`'s four methods, because `HealthService`
  (`core/health.ts`) calls `HttpClient` directly and bypasses `ApiService` entirely.
- **`withXsrfConfiguration`** — Angular's built-in XSRF support reads the `XSRF-TOKEN` cookie and
  echoes it as `X-XSRF-TOKEN` on mutating requests. It deliberately skips absolute cross-origin
  URLs, which is another reason for the same-origin production topology (§2). In development, where
  the API is on a different origin, an `ng serve` proxy so dev is same-origin too is the simplest
  resolution; otherwise a small explicit interceptor is needed.
- **`authErrorInterceptor`** — new, ordered *before* `httpErrorInterceptor`:
  - `401` → clear `user` signal, `router.navigate(['/login'], { queryParams: { returnUrl } })`,
    and swallow the error so no toast fires.
  - `403` → surface a single "You don't have access to that" notification; do **not** sign out. This
    is the observable symptom of a role revoked mid-session (§3), so the message should be
    survivable rather than alarming.
  - **The login endpoint's own failures are handled by the login component, not here** — the
    distinct "email not confirmed" response (§7) needs to render an inline resend link, not a
    generic toast. The interceptor must not swallow or genericise it.
  - Everything else → pass through to the existing handler untouched.
- **`httpErrorInterceptor`** (existing, `core/http-error-interceptor.ts`) — needs one change beyond
  ordering: it currently toasts the full request URL
  (`Request failed (401) for GET http://localhost:5225/api/…`). For auth failures that's both ugly
  and a minor information leak into the UI. With `authErrorInterceptor` handling 401/403 first, the
  existing behaviour can otherwise stay as-is.

### Profile and Sign out (requirement #7)

`page-layout.html` lines 104 and 111 are currently `href="#"` dead links.

- **"Your profile"** → `routerLink="/profile"` + `(click)="closeUserMenu()"`, matching how the
  existing Settings link is already wired two lines below.
- **New `pages/profile/`** — not `features/profile/`. This follows the convention established in
  `.squad/agents/Yoshi/history.md` (theming planning) and confirmed by `dashboard`/`data-admin`/
  `settings`: `pages/*` is for single, cross-cutting, app-level views registered via direct
  `loadComponent` in `app.routes.ts`; `features/*` is for domain-vertical resources with their own
  `*.routes.ts` and `loadChildren`. Profile is the former.
  Content: read-only email, read-only role list, and a reactive-form change-password panel
  (current / new / confirm), styled with the existing token utilities.
  **No `emailConfirmed` display and no resend affordance** — under the confirmation gate every
  authenticated user is confirmed by definition, so both would be dead UI that can never render a
  meaningful state. The resend flow itself is still needed; it lives on the unauthenticated side
  (§5), which is the only side a user who needs it can reach.
- **"Sign out"** → becomes a `<button>`, not an `<a href>`, calling
  `authService.logout()` → `POST /api/auth/logout` → clear the `user` signal →
  `router.navigateByUrl('/login')`. The server deletes the cookie; the client state is cleared
  regardless of the response so a failed logout still ends the local session.
- The hardcoded `U` avatar initial (line 100) derives from the signed-in email.
- `navItems` in `page-layout.ts` becomes a `computed()` filtering the `Data Admin` entry on
  `isAdmin()`. It is currently a `readonly` array literal, so this is a small but real change to
  both the desktop nav (lines 7–31) and the mobile nav (lines 54–73), which iterate the same array.

### Testability

Guards are plain functions and `AuthService` is a signal-holding injectable, so both unit-test
cleanly under the existing vitest setup with a stubbed service — matching how `theme.spec.ts` and
`http-error-interceptor.spec.ts` already test this layer. The new specs needed are listed in
`phases.md`.

---

## 7. Security considerations

### CSRF — critical, because this is cookie auth

Layered, all three required:

1. **`SameSite=Lax`** on `motw.session`. Browsers won't attach it to cross-site `POST`/`PUT`/
   `DELETE`. This alone stops the classic form-post CSRF, and is viable only because of the
   same-origin topology (§2) — a cross-site deployment would force `SameSite=None`, which removes
   this layer entirely.
2. **ASP.NET Core antiforgery in SPA mode.** `AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN")`,
   a `GET /api/auth/csrf` action that writes the non-`HttpOnly` `XSRF-TOKEN` cookie, and a globally
   registered `AutoValidateAntiforgeryTokenAttribute` filter so every non-`GET`/`HEAD`/`OPTIONS`/
   `TRACE` action validates automatically. Global registration matters for the same fail-closed
   reason as the fallback policy: per-action `[ValidateAntiForgeryToken]` is one forgotten attribute
   away from a hole. Angular's `withXsrfConfiguration` supplies the header end.
3. **Strict CORS.** The existing `FrontendDev` policy uses `AllowAnyHeader().AllowAnyMethod()` with
   a configured origin list; it must gain `.AllowCredentials()` to work with cookies at all, and
   must never be widened to `AllowAnyOrigin` (which is illegal with credentials anyway). In the
   chosen production topology this policy is development-only.

### Password policy (resolution #10)

Identity's defaults (6 characters; requires digit, lowercase, uppercase, and non-alphanumeric) are
outdated. Adopted, following NIST SP 800-63B:

```
RequiredLength = 12
RequiredUniqueChars = 4
RequireDigit = false
RequireLowercase = false
RequireUppercase = false
RequireNonAlphanumeric = false
```

Length beats composition rules — composition rules push users toward `Password1!` and toward reuse.
The optional Have I Been Pwned k-anonymity validator was not taken up; it remains a clean later
addition (one `IPasswordValidator<AppUser>` implementation, no contract change).

### Lockout

`MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 15 minutes`, `AllowedForNewUsers = true`,
and `PasswordSignInAsync(..., lockoutOnFailure: true)`.

### Login responses and account enumeration — resolution #15, with one deliberate exception (#18)

This is the subtlest interaction in the design and it is resolved explicitly rather than left to the
implementer. **Owner-confirmed as resolution #18.**

Resolution #15 says the login response must never reveal *why* it failed. The confirmation gate
(resolution #7) introduces a fourth case — "correct credentials, but unconfirmed" — and collapsing
that one into the generic message produces a genuine dead end: the user typed the right password, is
told it's wrong, and has no way to learn that a confirmation link is waiting in their inbox.

**Resolution — four cases, two responses:**

| Case | Response |
|---|---|
| No such account | Generic: "invalid email or password" |
| Account exists, wrong password | Generic: "invalid email or password" |
| Account locked out | Generic: "invalid email or password" |
| **Correct password, email not confirmed** | **Distinct**: a machine-readable `email_not_confirmed` code, rendered as "confirm your email address to sign in" with an inline resend action |

**Why the exception does not reopen enumeration.** The three collapsed cases are *unauthenticated*
oracles: an attacker learns something by supplying an address alone. The exception is reachable
**only after supplying the correct password**, at which point the attacker has already demonstrated
far more than enumeration would tell them. Revealing "this account exists but is unconfirmed" to
someone who just proved they know its password gives away nothing new.

**Why lockout stays collapsed even though it looks similar.** `PasswordSignInAsync` returns
`LockedOut` from `PreSignInCheck` — *before* the password is validated. A lockout-revealing response
is therefore reachable with a *wrong* password, which makes it a true unauthenticated oracle. The
distinguishing test throughout is simply: *is the password verified before this branch is reached?*

**The implementation detail that makes this safe, and is easy to get wrong.**
`PasswordSignInAsync` also returns `NotAllowed` from `PreSignInCheck`, before the password is
checked. Wiring `SignInResult.IsNotAllowed` straight through to the distinct response would leak
"this address is registered and unconfirmed" for *any* password — turning it right back into an
unauthenticated oracle. The correct sequence:

```csharp
var result = await signInManager.PasswordSignInAsync(
    user, password, isPersistent: true, lockoutOnFailure: true);

if (result.IsNotAllowed && await userManager.CheckPasswordAsync(user, password))
    return EmailNotConfirmed();   // distinct response — password was proven first

if (!result.Succeeded)
    return GenericFailure();      // all three collapsed cases
```

This preserves `PasswordSignInAsync`'s lockout integration and reveals the unconfirmed state only to
a caller who supplied the correct password. **This is one of Boo's review items.**

**Trade-off accepted:** a genuinely locked-out user sees "invalid email or password" and may keep
retrying, extending their own lockout.

**Contrast with forgot-password (resolution #19).** Login gets an exception; forgot-password does
not. The reason is the same test: forgot-password never verifies a password, so *every* branch of it
is an unauthenticated oracle and all three must stay indistinguishable (§5).

### Rate limiting and outbound-mail throttling (resolutions #9, #19)

Two separate mechanisms doing two different jobs. Conflating them is the usual mistake.

**1. Request rate limiting** — .NET's built-in `AddRateLimiter`, keyed by IP or globally, protecting
the *endpoint*.

*Registration — the configurable cap.* Base value **10 registrations per day**, read from
configuration:

```json
// appsettings.json
"Auth": {
  "Registration": {
    "MaxPerDay": 10
  }
}
```

Bound as `builder.Services.Configure<RegistrationOptions>(builder.Configuration.GetSection("Auth:Registration"))`
and consumed by a named `"registration"` rate-limiter policy applied to `POST /api/auth/register`:
a **fixed window of 24 hours** with `PermitLimit` taken from `MaxPerDay`.

*Re-derived after the #7 correction, because the original justification no longer holds.* The
earlier draft argued this cap "carries more weight than it normally would, because every registration
produces an immediately usable account." Under the confirmation gate that is false — an unconfirmed
account is inert. Re-checking the choice from scratch:

- **Dropped justification:** "it is the only bound on usable account creation." Gone. The
  confirmation gate is now that bound, and it is a much stronger one.
- **Standing justification, now primary:** the resource genuinely at risk is **outbound email quota
  and sender reputation**, a *global* resource shared by every user. A global limiter is the
  semantically correct shape for protecting a global resource; a per-IP limiter does not bound it at
  all under distributed abuse — precisely the shape of abuse that would burn a sending reputation.
- **Conclusion unchanged:** global 24-hour fixed window, `MaxPerDay` default 10 as the owner set it.

**Trade-off accepted:** this is a self-DoS vector — someone burning the day's 10 blocks legitimate
registrations until the window rolls. Contained by the fact that *only registration* uses this
limiter: login, forgot-password, reset, and resend keep their own separate per-IP limits, so a burned
registration budget never stops existing users signing in or recovering their accounts. And
`MaxPerDay` is live-changeable (below), so the owner can raise it on a running instance.

**Read via `IOptionsMonitor<RegistrationOptions>` inside the policy's partitioner**, not once at
startup. The partitioner receives the `HttpContext` and can resolve the monitor from
`context.RequestServices`, so changing `MaxPerDay` in configuration takes effect without a restart.

*Other auth endpoints* keep a conventional per-IP limiter — roughly 10 requests per 5 minutes on
login, forgot-password, reset-password, and resend-confirmation — plus a generous global limiter.

**2. Per-account outbound-mail throttling — and the bypass resolution #19 opened.**

An IP-keyed limiter does not stop a rotating source from mail-bombing one *address*. So a second,
independent throttle sits in `AuthService`, immediately before any mail is queued.

**Key it on `(purpose, userId)` — not on `(endpoint, userId)`.** This is the specific gap resolution
#19 created and it is worth stating as the reason for the shape:

> After #19, **two endpoints can produce `Confirmation`-purpose mail**:
> `POST /api/auth/resend-confirmation`, and `POST /api/auth/forgot-password` when the account is
> unconfirmed. If each endpoint had its own throttle, an attacker could **alternate between them** to
> get double the intended rate against a single address. A single budget per (purpose, account),
> consumed by every path that produces that mail, closes it by construction.

```
MailPurpose.Confirmation   — consumed by: register, resend-confirmation, forgot-password (unconfirmed)
MailPurpose.PasswordReset  — consumed by: forgot-password (confirmed)
MailPurpose.RegisterNotice — consumed by: register (address-already-in-use notice)
```

Recommended limits per (purpose, account): a **5-minute cooldown** plus a **daily ceiling of 5**.

**Storage:** `IMemoryCache` behind an `IOutboundMailThrottle` abstraction. Adequate because the
chosen topology is single-origin and therefore single-instance (§2). Two honest caveats to record
rather than discover: the budget **resets on restart**, and it **does not work across instances** —
if the app ever scales out, this moves to the database or a distributed cache. The abstraction exists
so that is a one-implementation change.

**The throttle must never change the HTTP response.** A throttled forgot-password, resend, or
register still returns the identical 200. If a throttled request looked different, the throttle would
itself become an enumeration oracle ("this address is rate-limited, therefore it exists") — which
would give back exactly what §5's identical-response invariant is protecting.

**Behind a reverse proxy the IP-keyed limiters need `UseForwardedHeaders` with
`KnownProxies`/`KnownNetworks` set**, or every request appears to come from the proxy's IP and they
bucket the entire internet together. Deployment configuration item, not an afterthought.

**Flagged for Boo's review:** the (purpose, account) throttle is now a shared cross-endpoint
resource. Getting its key wrong — or adding a fourth mail-producing path later without registering
it against the right purpose — silently reopens the alternation bypass.

### Data Protection keys — the most commonly missed piece

The session cookie is encrypted with ASP.NET Data Protection keys. By default those keys live in the
local filesystem/user profile. On a container or PaaS host, **the key ring is lost on every restart
or redeploy**, which invalidates every session and — worse — produces intermittent, confusing
`CryptographicException`s on multi-instance deployments.

**Persist the key ring.** `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` storing keys in
the existing Postgres database (`PersistKeysToDbContext<MotwDbContext>()`), plus
`SetApplicationName("MonsterOfTheWeek")`. Postgres is already the durable store and this adds no new
infrastructure.

This belongs in **Phase 0**, not Phase 6. Getting it wrong doesn't fail loudly; it fails as "users
keep getting logged out and I don't know why" — which, under resolution #8, is indistinguishable at
a glance from the role-propagation behaviour in §3.

### Secrets management (resolution #14)

Today `appsettings.Development.json` contains a plaintext Postgres password and is committed. That's
tolerable for a local dev credential; it is not a model to extend.

- **Local dev:** `dotnet user-secrets` for anything new (`Email:ApiKey`). The `.env` /
  `.env.example` pattern already used by `docker-compose.yml` is the other acceptable local option.
- **Production:** environment variables with the `__` separator
  (`ConnectionStrings__Postgres`, `Email__ApiKey`, `App__PublicBaseUrl`).
  No production secret in any committed file.
- `appsettings.json`'s committed `"Password=change-me"` connection string should stay obviously
  fake, as it already is.
- `Auth:Registration:MaxPerDay` is **not** a secret and belongs in `appsettings.json` as a
  committed, overridable default.

### HTTPS / HSTS / hosts

`app.UseHttpsRedirection()` already exists. Add `app.UseHsts()` in Production (not in Development —
HSTS on `localhost` is sticky and painful to undo). Cookie `SecurePolicy = Always` in Production.
`AllowedHosts` is currently `"*"`; set it to the real hostname in production configuration.

### Middleware order

Order in `Program.cs` is load-bearing and easy to get subtly wrong. Target:

```
UseForwardedHeaders → UseExceptionHandler → UseHsts (prod) → UseHttpsRedirection
→ UseStaticFiles / UseDefaultFiles (prod SPA) → UseRouting → UseCors (dev)
→ UseRateLimiter → UseAuthentication → UseAuthorization
→ MapHealthChecks (anonymous) → MapControllers → MapFallbackToFile (prod SPA)
```

Two specifics worth stating because they're the usual mistakes: `UseAuthentication` must precede
`UseAuthorization`, and `UseCors` must precede both (a rejected preflight never reaches the auth
middleware, producing a "CORS error" in the browser console that is really an auth-order bug).

### Other

- Swagger is already Development-only (`Program.cs` lines 53–57). Keep it that way; a public Swagger
  UI on an authenticated API is an enumeration aid.
- `MotwDbContextFactory` (design-time) constructs `MotwDbContext` directly with no service provider.
  Once the context takes an `ICurrentUser` dependency for query filters, this factory must supply a
  null-object implementation. It's a one-line change but a build-breaking one if missed —
  `data-ownership.md` §4 covers it.
