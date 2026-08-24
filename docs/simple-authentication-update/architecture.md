# Simple Authentication — Architecture

Companion documents: `phases.md` (execution), `open-questions.md` (the decision record). The verified
starting-point inventory is in `README.md` and is dated **2026-08-18**.

**All four open questions were resolved by the owner on 2026-08-18 and are folded in below. Nothing in
this design is still open.** The login identifier is **email** (§1.2, §5); **Sign out is in scope**
(§3.4); **existing local data does not move to production** (§4.3); and the **24-hour sliding session
stands unchanged**, with its one consequence knowingly accepted (§1.5). The owner separately confirmed
**single-origin hosting** (§4.1) and that the **SPA shell is served to anyone**, with the Angular app
rendering its own login view — which turned the `MapFallbackToFile` finding from a flagged risk into a
worked fix (**§2.3**).

**Luigi's frontend review (2026-08-18) is folded in below.** Four blocking findings, all in §3 and all
the same shape — a requirement stated in one section whose wiring in another does not implement it:
the interceptor array is in the wrong order so the `401` toast fires anyway (**§3.3**); the two-shell
restructure orphans the icon sprite, the toast host and the API-availability modal, which all live
inside `page-layout.html` (**§3.5**, with the knock-on correction in **§2.2**); the login form has no
error path for anything other than `invalid_credentials`, so an API-down submit is completely inert
(**§3.4**); and `AuthService.initialize()` must *return* its observable, which the adjacent
`ThemeService` line it is told to copy does not (**§3.2**). Non-blocking findings are folded in beside
them and marked. The review's one scope question — how far to take the §3.5 move — went back to the
owner and was **answered the same day in favour of the recommendation** (`open-questions.md` #5, option
A: all three concerns hoisted to `App`). Nothing from the review is outstanding.

**Bowser's backend/DevOps review (2026-08-19) is folded in below.** Three blocking findings, all in
Phase 3, all the same shape as Luigi's — a mitigation stated in one place whose mechanism does not
deliver it. `UseForwardedHeaders` as specified is **inert behind any real proxy**, because
`KnownProxies`/`KnownNetworks` default to loopback only, so the exact redirect-loop and refused-cookie
failure it claims to prevent still happens (**§4.2 item 5**). **`app.UseRouting()` has to be added
explicitly** — `Program.cs` has no such call — or Phase 3 step 1's *"before routing"* is unfollowable,
`UseDefaultFiles` is dead code, and §2.3's diagnostic symptom for the fatal missing `AllowAnonymous` is
false (**§2.3**). And the `ng build` → `wwwroot` step **cannot be an MSBuild target inside
`dotnet publish`** without silently publishing no SPA at all (**§4.2 item 2**). Non-blocking corrections
are folded in beside them and marked — most consequentially that the CORS block **does not throw in
production and never could**, while the identical defect on the connection string does matter
(**§2.4**, **§4.2 item 6**). The review's one question — how the publish step is sequenced — went back
to the owner and was **resolved on 2026-08-23** against a comparison with the owner's already-deployed
`portfolio` app: `ng build` writes straight into `wwwroot` via `angular.json`'s `outputPath`, the
`.csproj` is untouched, and sequencing is a **repo-root multi-stage `Dockerfile` deployed to Railway**
— now this project's confirmed deployment shape (`open-questions.md` #6, **§4.2 items 2 and 2a**).
**Docker is for shipping only; the development loop is `ng serve` + the dev proxy — §4.4.** Nothing from
either review is outstanding.

**Scope:** a login that gates the app on the public web, for a single user, without foreclosing
`docs/authentication-update/`. Anything beyond that is out of scope — see `README.md`.

Throughout, **"the robust plan"** means `docs/authentication-update/`, and its decisions are cited by
number (`decision #N` from its `phases.md` Decisions table) or by section (`§N` of its
`architecture.md`).

---

## 1. Credential storage and session establishment

### 1.1 Mechanism — cookie authentication *without* Identity

**Chosen: `AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(...)`,
with hand-written login/logout/me actions and no Identity framework.**

The decisive facts:

- **Cookie authentication is in the shared framework.** `Microsoft.AspNetCore.Authentication.Cookies`
  ships inside the `Microsoft.AspNetCore.App` framework reference this project already has. This pass
  adds **zero authentication package references** — the only new package anywhere is
  `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` (§1.5), and that is needed under Identity
  too.
- **Everything Identity would supply is on the explicit not-wanted list.** `UserManager`,
  `SignInManager`, the PBKDF2 hasher, the lockout state machine, `DataProtectorTokenProvider`, the
  `RoleManager`, and eight new tables exist to serve password hashing, lockout, email confirmation,
  password reset, and role management. The owner ruled out all five. Taking Identity here means
  adopting a fourteen-column user table, a base-class change to `MotwDbContext`, a role store nobody
  reads, and a `PasswordHasher` deliberately bypassed — in exchange for nothing this pass uses.
- **It costs nothing at the boundary.** `AddCookie` and `AddIdentityCookies` produce the *same kind of
  artefact*: a Data-Protection-encrypted authentication ticket in a cookie, validated by the same
  `CookieAuthenticationHandler`. The Angular side cannot tell them apart, and neither can the
  `[Authorize]` pipeline. That is precisely why the migration in §5 is cheap.

**How this differs from the robust plan's §1 mechanism.** The robust plan chose *Identity services +
cookie authentication + hand-written controllers*. This pass keeps the second and third of those three
and drops the first. The parts of §1 that were about the **cookie** (the session-shape table, the
401/403 override, the revocation discussion, the "session is the cookie" property) apply here
unchanged; the parts that were about **Identity** (`PasswordSignInAsync`, security stamps,
`ValidationInterval`, `RequireConfirmedAccount`) do not exist yet. The robust plan's §1 rejections of
`MapIdentityApi<T>()` (no logout endpoint), of an external IdP, and of hand-rolled crypto all still
stand and are not re-argued here.

#### Alternatives considered

**A. ASP.NET Core Identity now, hashing now.** Rejected for this pass, not on the merits — it is the
right answer and it is where the robust plan goes. Rejected because it is the whole of that plan's
Phase 0 and most of its Phase 1, which is exactly the work the owner asked to defer, and because
Identity's password hasher makes the stated operating model (hand-insert a row over `psql`)
impossible without also building a hash-generation tool.

**B. Keep the bespoke table but hash with `Rfc2898DeriveBytes` (BCL, no package, ~10 lines).**
Rejected, and worth recording *why*, because it looks nearly free. It is nearly free in code and not
free in operation: the owner can no longer create or change a credential with a single `INSERT`, so
this pass would have to grow either a console tool or a temporary bootstrap endpoint — neither of
which survives into the robust plan. Reversible at any time; §6 names the trigger.

**C. HTTP Basic authentication (no login page, no session).** Rejected. It re-prompts through a
browser chrome dialog that cannot be styled, has no logout, sends the credential on every single
request, and produces nothing that carries forward — the Angular work would be thrown away entirely.

**D. A shared secret in an environment variable, no database table at all.** Rejected. It is
genuinely the smallest possible thing, but it has no user identity, so the robust plan's `owner_id`
work (its Phase 2) would have nothing to attach to and the migration would be a rewrite rather than a
replacement. The database row is what makes this a stepping stone instead of a detour.

### 1.2 Where the credentials live

New entity `Data/Entities/AppUser.cs` (its own file, not appended to `DomainEntities.cs` — the auth
boundary should be visible), new `DbSet<AppUser> Users`, mapped in `OnModelCreating` in the same
explicit style as the existing 31 configurations:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `Guid`, matching every other entity in the schema. |
| `email` | `text`, unique index | **The login identifier. Owner-settled 2026-08-18: "the email IS the username, always."** Aligned with the robust plan's decision #6/#17 from the start, so nothing about this field changes later. |
| `password` | `text` | **Plaintext, deliberately.** §6. |
| `created_at` | `timestamptz` | Informational only. **`AppUser` must *not* implement `ITimestamped`** — see the box below. |

Four columns. No `email_confirmed`, no `security_stamp`, no `lockout_end`, no roles.

> ### `AppUser` must not implement `ITimestamped`, and the `DbSet` should be `AppUsers`
>
> **Bowser's review, 2026-08-19 — two mechanical corrections, both one word, both cheaper now than later.**
>
> **1. Not `ITimestamped`.** This row previously read *"matches the existing `ITimestamped` convention."*
> `ITimestamped` (`Data/Entities/DomainEntities.cs:3–7`) declares **both** `CreatedAt` **and** a
> non-nullable `UpdatedAt`, and `MotwDbContext.ApplyTimestamps()` writes `entry.Entity.UpdatedAt`
> unconditionally for every `ITimestamped` entity on both `Added` and `Modified`. Implementing it here
> therefore forces a **fifth column** (`updated_at`) that this table has no use for, or — if the property
> is left unmapped — a write to a property EF does not persist. Neither is what §1.2 describes. `AppUser`
> is a plain POCO with `Guid Id`, `string Email`, `string Password`, `DateTimeOffset CreatedAt`.
>
> Consequence to carry into the runbook (`phases.md` Phase 3 step 7): with no `ITimestamped` hook and no
> `HasDefaultValueSql`, **the hand-written `INSERT` must supply `created_at` itself.** Give the column a
> `HasDefaultValueSql("now()")` in the mapping *or* show `created_at` in the runbook's `INSERT`. Leaving
> both out makes the one operation this whole design depends on fail with a NOT NULL violation.
>
> **2. `public DbSet<AppUser> AppUsers => Set<AppUser>();`, not `Users`.** Decision #2 chose `app_users`
> over `users` precisely to avoid a collision with the robust plan's Identity table — but `Users` is
> **exactly** the name that collides at the C# layer. `IdentityUserContext<TUser,…>`, which
> `IdentityDbContext<AppUser, AppRole, Guid>` derives from (robust plan decision #3), already declares
> `public virtual DbSet<TUser> Users { get; set; }`. A `DbSet<AppUser> Users` here hides it (CS0108) the
> moment the base class changes and has to be deleted as a distinct step. `AppUsers` matches the table
> name, matches the reasoning already recorded above, and makes that step disappear.

**Verified against the test project (Bowser, 2026-08-19), so `phases.md` Phase 0's "Watch for" can be
closed rather than carried:** both SQLite-backed test contexts (`MonsterRepositoryTests.cs:16–21` and
`SearchProvidersTests.cs:556–565`) construct `MotwDbContext` with `UseSqlite` + `EnsureCreatedAsync()`,
which creates **every table in the model** — so `app_users` and `data_protection_keys` materialise with
no test-project change at all. Two things would break that, so they are constraints rather than
discoveries: do **not** put `HasColumnType("timestamptz")` or any Npgsql-specific `HasDefaultValueSql`
on the mapping (no existing entity does — `created_at`/`updated_at` are bare `DateTimeOffset`
throughout; if a default is wanted for the hand-`INSERT` case above, `now()` is the one exception and it
must be paired with a check that the test suite still passes), and leave `DataProtectionKey`'s `int`
identity key alone (it is fine on both providers).

**There is no separate username concept anywhere** — not a column, not a DTO field, not a form control.
This matches the codebase as it stands (`grep -rn 'username' src/` still returns nothing) and matches
where the robust plan is going, which is what makes the login form, the DTOs, and `AuthService.login()`
carry forward untouched (§5.1).

**Lookup is case-insensitive.** The repository compares `u.Email.ToLower() == input.Trim().ToLower()`,
which EF Core translates to a SQL `lower()` comparison. This is one line and it is normalisation, not
validation — it exists because the credential row is typed by hand, and "I inserted `Skyler@…` and
typed `skyler@…`" is otherwise a baffling login failure with no error to read. The unique index is on
the stored value and therefore does not itself enforce case-insensitive uniqueness; irrelevant with
one row, and Identity's `NormalizedEmail` column solves it properly later.

Two naming decisions that exist purely to make §5 cheap:

- **The table is `app_users`, not `users`.** The robust plan's decision #5 maps Identity's user table
  to `users`. Using that name now would force the later migration to rename-and-widen a live table
  mid-flight. With `app_users`, Identity's `users` table is simply created alongside and `app_users`
  is dropped in the same migration — no collision, no rename.
- **The column is `password`, not `password_hash`.** A column named `password_hash` containing
  plaintext is a trap that outlives whoever created it: every future reader, including a security
  reviewer, will assume it is hashed. Name it what it is.

**`MotwDbInitializer` must not seed a user, ever.** It seeds lookup tables today and that is all it
should seed. A credential in committed code is a credential in git history. This also matches the
robust plan's decision #9 model, where the first privileged row is inserted by hand in the database.

### 1.3 The login flow

```
POST /api/auth/login   { "email": "...", "password": "..." }   [AllowAnonymous]
  → IUserRepository.FindByEmailAsync(email)          (case-insensitive)
  → IAuthService.VerifyCredentialsAsync(...) : ServiceResult<AuthenticatedUser>
  → controller builds ClaimsPrincipal and calls HttpContext.SignInAsync(...)
  → 200 { "id": "...", "email": "..." }   + Set-Cookie: motw.session=...
```

- **The service does not touch `HttpContext`.** `VerifyCredentialsAsync` is a pure
  `ServiceResult<T>`-returning method over a repository, exactly like every other service in this
  codebase, so it unit-tests against a hand-written fake the way `MonsterServiceTests` and friends
  already do. `SignInAsync` is an HTTP concern and stays in the controller. This is the same
  controller → service → repository → `ServiceResult<T>` split the rest of the API uses; there is no
  reason for auth to invent a second shape.
- **Claims issued:** `ClaimTypes.NameIdentifier` = `user.Id`, `ClaimTypes.Name` = `user.Email`.
  Neither is arbitrary. Identity's default `IdentityOptions.ClaimsIdentity.UserIdClaimType` is
  `ClaimTypes.NameIdentifier`, so anything that reads the current user id (notably the robust plan's
  Phase 2 `ICurrentUser`) reads the identical claim before and after the migration. And the robust
  plan sets `UserName = Email` at registration, so `ClaimTypes.Name` carries the email address on both
  sides too — the claim set is identical before and after, not merely similar.
- **Comparison is an ordinal `string.Equals`** on the plaintext — settled, not a preference. A
  constant-time comparison (`CryptographicOperations.FixedTimeEquals` over the UTF-8 bytes) is one line,
  and it is deliberately **not** used: with the password already at rest in plaintext it defends nothing
  that is not already lost, and shipping it would imply more safety than exists.
- **No `[Required]` attributes are needed on the request record.** `[ApiController]` already infers
  required for non-nullable reference-type properties, so a missing `email` or `password` returns a
  400 for free. Nothing further is added — in particular **no `[EmailAddress]` attribute and no
  `Validators.email`**: a malformed address simply fails to match a row, which is the same outcome by
  a shorter path, and this pass does no input validation.

`POST /api/auth/logout` (authenticated) calls `HttpContext.SignOutAsync(...)`, which deletes the
cookie, and returns 204.

`GET /api/auth/me` is `[AllowAnonymous]` and returns the user object when signed in and `null` when
not. It must **not** 401 — the Angular bootstrap probe (§3) calls it on every cold load, including for
a logged-out visitor, and a 401 there would fire an error toast on the login page. Same reasoning, and
same shape, as the robust plan's §3.

### 1.4 Failure shape — `400` with a code, not `401`

`POST /api/auth/login` returns **`400 { "code": "invalid_credentials" }`** on failure. `401` is
reserved API-wide for "you have no valid session" and is emitted only by the cookie handler's
`OnRedirectToLogin` override.

This is the robust plan's **decision #37**, adopted here unchanged, and it is load-bearing for the
same mechanical reason even though this pass has only one failure code:

- `authErrorInterceptor` (§3) treats `401` as "session gone" — it clears the auth signal, navigates to
  `/login`, and **swallows the error so no toast fires.** If login itself returned `401`, that branch
  would run for a wrong password: the user would be navigated to the page they are already on, the
  error would be discarded, and **the login form would show nothing at all.** A silent failure on the
  one screen that exists to report failure.
- `400` is also the zero-machinery option. `Services/ServiceResults.cs` defines `ServiceErrorType`
  with exactly two members (`NotFound`, `Validation`), and every controller maps
  `Validation → BadRequest(new { ... })`. A `401` would need a third enum member and a new arm in
  every existing switch.

As in the robust plan, this is paired with a **second, deliberately redundant defence**: both
interceptors skip requests under `/api/auth/` outright (§3). Either alone is one refactor away from
the silent failure above; both together is on purpose and should not be "cleaned up."

### 1.5 Session shape

Configured on `AddCookie`. **These values are copied verbatim from the robust plan's §1 table
(decision #27) so that nothing here is rewritten later.**

| Setting | Value | Reason |
|---|---|---|
| Cookie name | `motw.session` | Non-default, non-fingerprinting. Matches the robust plan. |
| `HttpOnly` | `true` | JavaScript never reads it. The SPA learns identity from `GET /api/auth/me`. |
| `SecurePolicy` | `Always` in Production, `SameAsRequest` in Development | Dev runs plain HTTP on `localhost:5225` (`launchSettings.json`, `http` profile). |
| `SameSite` | `Lax` | Viable *because* of the single-origin decision in §4. |
| `ExpireTimeSpan` | **24 hours — owner-confirmed 2026-08-18, unchanged** | Idle sessions end daily; active ones keep sliding. The conservative end of the range, deliberately: a longer window means a proportionally longer life for a copied cookie, which matters more here than in the robust plan because this pass has **no revocation mechanism at all** (§1.6). |
| `SlidingExpiration` | `true` | The owner is never logged out mid-session. No absolute cap — see below. |
| `IsPersistent` | `true`, unconditionally — no "Remember me" checkbox | Survives browser restart. One fewer control on a bare login page. |
| 401/403 behaviour | `OnRedirectToLogin` / `OnRedirectToAccessDenied` overridden to return bare `401`/`403` | The default handler issues a `302` to `/Account/Login`, which is wrong for an API and confusing for `HttpClient`. Mandatory, not optional. |

> **Write the 401/403 overrides as *mutation*, never as assignment — even though it is harmless
> today.**
>
> ```csharp
> options.Events.OnRedirectToLogin = ctx => { ... };        // do this
> options.Events = new CookieAuthenticationEvents { ... };  // not this
> ```
>
> With a bare `AddCookie` there is nothing pre-registered on `Events`, so the second form works fine
> right now. It becomes a **silent security hole at the exact moment Identity lands**:
> `AddIdentityCookies()` installs `OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync`,
> and replacing the `Events` object discards it — after which sessions are never revalidated, security
> stamps are never checked, and nothing errors. The robust plan's §1 carries a full warning about
> this. Writing it as mutation now costs nothing and means that migration is a no-op.

### 1.6 What this session does and does not revoke

**The cookie *is* the session.** There is no server-side session store, no security stamp, and no
per-request database read. That has three consequences worth stating plainly rather than discovering:

1. **Signing out ends the session for that browser only.** A cookie copied beforehand stays valid
   until its own expiry. The robust plan flagged this as a residual window mitigated by security-stamp
   revalidation; here there is no such mitigation, so the window is the full sliding lifetime.
2. **Changing the password in the database does not end existing sessions.** Nothing consults
   `app_users` after login.
3. **There is exactly one kill switch, and it works:** delete the rows in `data_protection_keys` and
   restart. The app generates a fresh key ring, every previously issued ticket becomes undecryptable,
   and every session everywhere ends at once. Changing the cookie name has the same effect. Worth
   writing into whatever runbook the deployment pass produces — it is the answer to "I think my
   password leaked."

For a single-user app this is an acceptable trade. It is listed in §5 as one of the behaviours that
*changes* when the robust plan lands.

**One expiry consequence, raised and accepted (2026-08-18).** This app has no draft persistence
anywhere — `MysteryCreateStore.init()` reads a route-snapshot `:id` once and there is no
`localStorage`/`sessionStorage` draft save — so a session lapsing with the mystery-create wizard open
loses whatever was typed into the current phase when the interceptor bounces to `/login`. The gap is
**pre-existing** (a plain browser reload loses the same work today, and has since the wizard shipped)
and is not introduced by this design; a session expiry simply adds a second way to reach it. The owner
has accepted it explicitly — *"what's lost is lost, and since I'm the only one using it, I'm aware of
it."* **No draft-persistence work should be proposed on the strength of this**; it is recorded so the
behaviour is not mistaken for a defect later.

### 1.7 Data Protection keys — do this in Phase 0, not at deployment

The cookie ticket is encrypted with ASP.NET Core Data Protection. By default the key ring is written
to a machine-local directory; in a container with no persistent volume that means **a fresh key ring
on every restart, and therefore every session invalidated on every deploy.** The symptom is "I keep
getting randomly logged out," which is an infuriating bug to diagnose and looks like an auth bug
rather than a configuration one.

**Persist the key ring to Postgres** via `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`:
`MotwDbContext` implements `IDataProtectionKeyContext`, a `data_protection_keys` table joins the
existing migration history, and `Program.cs` gains
`AddDataProtection().PersistKeysToDbContext<MotwDbContext>().SetApplicationName("MonsterOfTheWeek")`.

Chosen over a mounted key directory because Postgres is already there and already persistent, so this
removes an infrastructure decision from the deferred deployment pass rather than adding one. It is
also **exactly** the robust plan's decision #29, including the explicit application name, so it
carries forward as written. `SetApplicationName` matters: without it the key ring's purpose strings
are derived from the entry-assembly name, and a rename silently invalidates every cookie.

**Confirmed sound (Bowser, 2026-08-19), with one correction to how it is *verified*.** The mechanism
is right and the Phase 0 placement is right — `data_protection_keys` is also the **same table name the
robust plan's decision #5 uses**, so its Phase 0 step 4 becomes a no-op rather than a second,
conflicting definition. But the key ring is created **lazily, on the first `Protect`/`Unprotect`**, not
at startup. Phase 0 adds no consumer of a protector at all (cookie authentication arrives in Phase 1,
and there is no antiforgery in this pass), so **the table will be created empty and stay empty for the
whole of Phase 0.** Phase 0's stated check — *"`data_protection_keys` gains a row on first startup"* —
will therefore appear to fail, on a phase whose entire risk profile is "this fails silently." The
assertion belongs in Phase 1, after the first successful `POST /api/auth/login`, where it is also a
strictly better test: a row appearing there proves the *cookie ticket* protector is the DB-backed one,
which is the thing actually at stake. Corrected at `phases.md` Phase 0 and Phase 1.

Also worth recording because it removes a step someone will otherwise go looking for: `dotnet ef`
does **not** execute `Program.cs` in this repo — `Data/MotwDbContextFactory.cs` is an
`IDesignTimeDbContextFactory<MotwDbContext>`. So Phase 0's migration is unaffected by anything added to
`Program.cs`, and the factory's own `ASPNETCORE_ENVIRONMENT ?? "Development"` default is what makes the
`appsettings.json` change recommended in §4.2 item 6 safe for migrations.

---

## 2. API-side access gating

### 2.1 Fail closed, in three lines, touching zero controllers

```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
```

The fallback policy applies to **every endpoint that has no authorization metadata of its own** —
which today is all 107 actions across all 7 controllers, re-counted against the current tree
(Bystanders 12, Locations 12, Minions 29, Monsters 31, Mysteries 7, Reference 14, Search 2).
**No controller file is edited.** No `[Authorize]` attribute is added anywhere.

The alternative — decorating each controller with `[Authorize]` — fails open: any controller or
action added later without the attribute is silently public. This codebase demonstrably grows
endpoints incrementally (four standalone-creation phases and a five-phase validation initiative in the
last month alone), and this is the first pass where a missed endpoint is a public data leak rather
than a local inconvenience. Fail-open is not an acceptable default here.

This is the robust plan's §3 fail-closed call, adopted unchanged. **No roles, no policies, no
ownership** — the only question this pass asks is "authenticated or not."

### 2.2 The anonymous surface — four entries, one of which is fatal to miss

| Endpoint | Why | Consequence if missed |
|---|---|---|
| `POST /api/auth/login` | Obviously. | Nobody can ever log in. Loud. |
| `GET /api/auth/me` | Returns `null` for an anonymous caller; the Angular bootstrap calls it on every cold load. | An error toast on the login page on every visit, and the proactive guard path in §2.3 stops working. Loud but confusing. |
| `GET /health/live` | `Program.cs:65`; probed by `checkApiAvailability()` via `core/health.ts`. Chain `.AllowAnonymous()` onto `MapHealthChecks`. | A permanent "API unavailable" modal the moment the user signs in — and, once §3.5 lands, on the login page too. Also breaks any container/reverse-proxy liveness probe. |

> **Corrected 2026-08-18 (Luigi's review).** This row previously read *"a permanent 'API unavailable' modal
> for every logged-out visitor — i.e. covering the login page."* **That is not true as the rest of this
> document is written**, and the reason is §3.5: the probe fires only from
> `PageLayoutComponent.ngOnInit` (`page-layout.ts:44–46`), and a logged-out visitor never instantiates
> `PageLayoutComponent` once the two-shell structure lands — so `/health/live` is never called while
> logged out and the modal can never appear over the login page. The `[AllowAnonymous]` is still
> **required** (infrastructure probes, and the probe that fires the instant `PageLayoutComponent` mounts
> after login); only the stated symptom was wrong. §3.5 moves the probe so the original sentence becomes
> true again.
| **The SPA fallback** — `MapFallbackToFile("index.html")`, added in Phase 3 | It is an *endpoint*, so the fallback policy applies to it. §2.3 works the whole thing through. | **Unrecoverable bootstrap deadlock.** Deep links like `/dashboard` and `/login` return `401` before any HTML is served, so the browser never loads the app that would have let you log in. |

`POST /api/auth/logout` stays **authenticated**. Signing out with no session is a no-op; letting it
401 is the right outcome, and it matches the robust plan.

### 2.3 Serving the SPA shell anonymously while `/api/*` stays fail-closed

**Owner-confirmed premise (2026-08-18):** `index.html` should be served to anyone; the Angular app
boots and shows the login view itself when there is no session. An unauthenticated visitor being able
to fetch `index.html` and the JS bundles is **expected and accepted** — the shell contains no data and
no secrets, and every byte of game data comes from the gated API.

The whole problem is that ASP.NET Core serves the shell through **two different mechanisms with two
different authorization stories**, and only one of them is affected by the fallback policy.

| What serves it | Kind | Covers | Subject to the fallback policy? |
|---|---|---|---|
| `UseStaticFiles()` | **Middleware**, before `UseAuthorization` | `/main-A1B2.js`, `/styles-C3D4.css`, `/favicon.ico`, an explicit `/index.html` | **No.** It short-circuits the pipeline before authorization ever runs. |
| `UseDefaultFiles()` | **Middleware** | Rewrites `/` → `/index.html`, which `UseStaticFiles` then serves | **No**, for the same reason. |
| `MapFallbackToFile("index.html")` | **Endpoint** | Every deep link with no file extension: `/login`, `/dashboard`, `/monsters/{id}` | **Yes.** This is the one. |

This split is also why the bug, if it ships, presents as route-dependent rather than as a missing
attribute: **`/` keeps working while `/login` and every deep link return `401`** — *provided
`app.UseRouting()` is called explicitly, which it currently is not. See the box below; this is the
condition the symptom depends on and it is not satisfied today.*

#### The fix — three lines in `Program.cs`

```csharp
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();                                            // ← must be explicit; see the box below
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health/live").AllowAnonymous();

// Unknown /api paths must NOT fall through to the SPA shell.
app.Map("/api/{**rest}", () => Results.NotFound());          // no AllowAnonymous — see below
app.MapFallbackToFile("index.html").AllowAnonymous();        // the SPA shell, always reachable
```

> ### `app.UseRouting()` has to be added explicitly, or this section describes a pipeline that does not exist
>
> **Blocking finding, Bowser's review 2026-08-19.** Verified against the current tree: **`Program.cs`
> never calls `UseRouting()`.** It registers `UseExceptionHandler`, `UseCors`, `UseHttpsRedirection`,
> the Development-only Swagger block, and then `MapHealthChecks`/`MapControllers` (lines 50–66). That is
> legal and it works today — but *how* it works is the problem.
>
> When endpoints exist and `UseRouting()` was never called, `WebApplicationBuilder` inserts `UseRouting()`
> **at the very front of the pipeline**, ahead of every middleware the file registers, and `UseEndpoints()`
> at the very end. So routing runs **first**, not where §2.4's diagram puts it. Three consequences, none
> of which the design as written accounts for:
>
> - **`phases.md` Phase 3 step 1 says to put `UseDefaultFiles`/`UseStaticFiles` "before routing." As the
>   file stands that instruction cannot be followed** — there is no `UseRouting()` call to be before.
> - **`UseDefaultFiles()` becomes dead code.** Both `DefaultFilesMiddleware` and `StaticFileMiddleware`
>   begin by checking `context.GetEndpoint() == null` and pass straight through if an endpoint has already
>   been matched. `MapFallbackToFile`'s pattern is `{*path:nonfile}`, and a catch-all matches zero
>   segments, so **`/` matches the fallback endpoint.** With routing in front, `/` never reaches
>   `UseDefaultFiles`; it is served by the fallback endpoint instead. Same bytes, so nothing breaks — but
>   the line the design added does nothing.
> - **The diagnostic sentence above is false.** If the `.AllowAnonymous()` on the fallback is ever
>   dropped, `/` matches that same gated endpoint and **`/` returns `401` too.** The stated symptom —
>   *"`/` keeps working while `/login` and every deep link `401`"* — is the thing an implementer will use
>   to recognise this failure, and the risk register repeats it (*"Made worse by `/` still working, so it
>   reads as intermittent and route-dependent"*). Both are wrong without the explicit call.
>
> **The fix is one line with no behavioural risk: call `app.UseRouting()` at the position §2.4 already
> shows it** — after `UseStaticFiles`, before `UseAuthentication`. That converts the implicit
> front-loaded routing into the documented pipeline, makes `UseDefaultFiles` do its job, and makes the
> `/`-keeps-working symptom true again.
>
> **Why this is worth a line rather than a shrug:** the anonymous-asset guarantee in the table above
> holds either way (JS/CSS/`.ico` all have extensions, so `nonfile` rejects them, so no endpoint matches
> and the static-file middleware short-circuits before `UseAuthorization` — verified, not assumed). The
> cost of getting it wrong is not a broken deployment; it is that the **one** documented tell for the
> **one** failure this section calls *"unrecoverable bootstrap deadlock"* points at the wrong symptom.
> It also carries forward: the robust plan's §7 middleware order has the same gap for the same reason.

**`.AllowAnonymous()` on the fallback is the load-bearing line.** It attaches
`IAllowAnonymous` metadata to that one endpoint, which is exactly what suppresses the fallback policy
— per-endpoint, not globally. Nothing else changes: the 107 controller actions still have no
authorization metadata of their own, so they still inherit `RequireAuthenticatedUser`. The anonymous
surface grows by exactly one endpoint whose entire response body is a static HTML file.

**The `/api/{**rest}` catch-all is a second-order consequence worth closing.** `MapFallbackToFile`
registers a catch-all at `Order = int.MaxValue` with a `{*path:nonfile}` pattern, so a request to a
*misspelled* API path — `/api/mysteryes`, no file extension, matching no controller route — would
otherwise be handled by the fallback and answered with **`index.html` and a `200`**. That is the same
success-shaped-failure trap this document already documents for `/health/live` under `ng serve`
(§4.2), and it gets worse under single-origin hosting, where every frontend call is a relative path
that could silently fall through. The catch-all fixes it by route precedence: literal segments beat a
`{**rest}` catch-all, so real controller routes are unaffected, and a default-order endpoint beats the
`int.MaxValue` fallback, so unknown `/api` paths land here instead.
Deliberately **not** `AllowAnonymous` — an anonymous caller gets `401` and an authenticated one gets
`404`, which is both fail-closed and slightly less informative to a prober. **In scope, not optional:**
it is one line, and the failure it prevents is silent.

> **Precedence claim confirmed, not assumed (Bowser, 2026-08-19), plus one side effect worth stating.**
> Checked against every route template in the tree rather than in the abstract: `MonstersController`,
> `MinionsController`, `LocationsController`, `BystandersController` and `SearchController` put full
> templates on each action (`[HttpGet("api/monsters")]`, `[HttpGet("api/mysteries/{mysteryId:guid}/monsters")]`,
> `[HttpGet("api/search/quick")]`, …); `MysteriesController` is `[Route("api/mysteries")]`;
> `ReferenceController` is `[Route("api")]` plus literal action templates (`[HttpGet("adventure-types")]`
> → `api/adventure-types`). Every one is literal segments plus constrained parameters, and **both**
> outrank a `{**rest}` catch-all at every segment. In the other direction, `MapFallbackToFile` registers
> at `Order = int.MaxValue` and `Order` is compared before precedence, so a default-order endpoint beats
> it. The claim holds in both directions for all 107 actions.
>
> **The side effect:** `app.Map(pattern, handler)` maps **every HTTP method**, so a request to a real
> route with an unsupported method — `DELETE /api/mysteries`, say — no longer produces
> `405 Method Not Allowed`; the method-matching policy discards the controller candidate and the request
> lands on the catch-all as `404` (or `401` when anonymous). Harmless for this app, correct-by-default
> for a prober, and worth one line so it is not filed as a bug later.

Static assets keep their existing behaviour and need no attention: `{*path:nonfile}` means a request
for a missing `/foo.js` still `404`s from the static-file middleware rather than being handed
`index.html`.

#### Yes, the Angular guard is still required — the two mechanisms are complementary

The server now hands the shell to anyone who asks for `/dashboard`. Client-side gating is therefore
**not** redundant with the server gate; it is doing a different job, and the design needs both:

| | Proactive — `authenticatedMatch` (`canMatch`) | Reactive — `authErrorInterceptor` `401` branch |
|---|---|---|
| **Fires on** | Every navigation | Any API response that says the session is gone |
| **Knows because** | `AuthService.initialize()` already called `GET /api/auth/me` during `provideAppInitializer`, so auth state is populated **before the first route resolves** | The server told it, mid-session |
| **Catches** | A logged-out visitor deep-linking to `/dashboard` | A session that expires or is revoked while the app is open |
| **Cannot catch** | Expiry *after* the route activated — guards only run on navigation | The first navigation, because by then the damage is done |

Delete the guard and a logged-out visitor to `/dashboard` gets: the shell, `PageLayoutComponent`'s
full chrome (sidebar, header, search), a lazy-loaded dashboard chunk, a burst of API calls that all
`401`, **and then** a bounce to `/login`. A visible flash of the signed-in application, plus a lazy
feature bundle downloaded for nothing. With the guard, the route never activates: no chunk, no
request, no flash — the router picks the auth shell on the first try and lands on `/login` directly.
(`canMatch` on the parent gates **all nine** lazy entries under shell 1 — three `loadComponent`
(`dashboard`, `data-admin`, `settings`) and six `loadChildren` (`mysteries`, `monsters`, `minions`,
`bystanders`, `locations`, `search`) — re-counted against `app.routes.ts` on 2026-08-18. Earlier drafts
said "seven".)

Delete the interceptor instead and a session expiring mid-use leaves the user staring at a working-
looking app where every action fails silently.

**This is exactly the behaviour the owner described** — a dedicated login view that renders when no
session is detected *and* when the API returns 4xx. Those two halves are the two rows of the table
above. `GET /api/auth/me` being anonymous and returning `null` rather than `401` (§1.3) is what makes
the first row possible at all; if it `401`'d, the bootstrap probe would trip the interceptor's own
`401` branch during application startup.

### 2.4 Middleware order

```
UseForwardedHeaders          (Phase 3, production — before anything that reads scheme/host)
UseExceptionHandler
UseCors                      (Development only — see below)
UseHttpsRedirection          (Development only, from Phase 3 — §4.2 item 5a)
UseDefaultFiles / UseStaticFiles   (Phase 3)
UseRouting                   ← must be added explicitly (Phase 3); the file has no such call today
UseAuthentication            ← new, must precede UseAuthorization
UseAuthorization             ← new
MapControllers
MapHealthChecks("/health/live").AllowAnonymous()
Map("/api/{**rest}", NotFound)                  (Phase 3 — not anonymous, by design)
MapFallbackToFile("index.html").AllowAnonymous()  (Phase 3)
```

Note that `UseDefaultFiles`/`UseStaticFiles` sit **above** `UseAuthentication`. That is deliberate and
it is what makes the SPA's assets anonymous without any configuration — §2.3.

**`UseRouting` is on this list as a line to *write*, not as a line that exists** (Bowser, 2026-08-19).
`Program.cs` does not call it, and leaving it implicit silently relocates routing to the front of the
pipeline. §2.3's box works through why that matters.

`UseAuthentication` before `UseAuthorization` is not stylistic — without it the principal is
unpopulated when the policy runs and every request is anonymous, which fails closed and therefore
looks like "the cookie isn't working."

### CORS made Development-only — right change, wrong stated reason

**Make the whole CORS block — the `Cors:AllowedOrigins` read at `Program.cs:9–10`, `AddCors`, and
`UseCors` — conditional on `IsDevelopment()`.** Under the single-origin production topology CORS is not
needed at all. This is a real Phase 3 change to `Program.cs`, not a cleanup.

> **The justification previously given here was wrong (Bowser, 2026-08-19), and the risk register
> inherited it.** This section said *"`Program.cs:9–10` throws at startup when `Cors:AllowedOrigins` is
> missing … production must either carry a meaningless config value or the app will not boot,"* and the
> risk register rated it **High, loud**. **That throw is unreachable.** `Cors:AllowedOrigins` is
> committed in `appsettings.json`, and `dotnet publish` always ships `appsettings.json`, so the key is
> present in every deployment by construction. Grepped repo-wide: `Program.cs` is the **only** reader of
> that key, so nothing else depends on it either.
>
> What actually happens without this change is the quieter opposite: **production silently registers a
> CORS policy allowing `http://localhost:4200`**, with `AllowAnyHeader`/`AllowAnyMethod` and — importantly
> — **no `AllowCredentials`**, so the `motw.session` cookie is never in play. Low impact, not high; not
> loud, silent. The change is still worth making, on the honest grounds that a dev origin has no business
> being configured in production. **Severity downgraded to Low in the risk register, and the failure mode
> restated.**
>
> **The same defect exists on the connection string, and there it does matter** — see §4.2 item 6.
>
> **One mechanical note so this is not half-done:** the config read and `AddCors` sit *before*
> `builder.Build()` and must be guarded with **`builder.Environment.IsDevelopment()`**; `UseCors` sits
> after and uses **`app.Environment.IsDevelopment()`**. Guarding only the registration half leaves
> `UseCors("FrontendDev")` referring to a policy that no longer exists, which throws
> `InvalidOperationException` on the **first request** rather than at startup — a strictly worse failure
> than the one being removed.

### 2.5 What is *not* here

- **No per-user data ownership.** No `owner_id`, no `ICurrentUser`, no EF Core global query filters,
  no changes to the five `ISearchProvider` implementations, no `WebApplicationFactory` integration
  tests. That is the robust plan's Phase 2, it is high-risk, and it is explicitly out of scope. This
  pass takes no step toward it and no step away from it.
- **No role split on reference data.** All 7 `ReferenceController` GETs and all 7 POSTs simply require
  authentication. The robust plan's decision #16 later gates the POSTs to a `DataAdmin` policy while
  leaving the GETs open to any authenticated user; that is a pure addition on top of what ships here.
- **No rate limiting, lockout, antiforgery, or password policy.** Per the owner. §5 lists each as an
  addition rather than a change.

One consequence of adding no antiforgery: **`SameSite=Lax` is the only CSRF defence in this pass.** It
is a real one — it blocks the cookie on cross-site `POST`/`PUT`/`DELETE`, which is the primary vector
— and it is free, which is exactly the bar the owner set. It does not cover same-site attacks or
top-level `GET` navigation, and the robust plan's §7 three-layer defence is the answer to that.

---

## 3. Angular-side gating

### 3.1 Route structure — adopt the two-shell pattern now

```
''      → PageLayoutComponent   canMatch: [authenticatedMatch]   (the existing nine children, unchanged)
''      → AuthLayoutComponent    canMatch: [anonymousMatch]
           ├ ''  pathMatch: 'full' → redirectTo: 'login'
           └ login → LoginComponent
'**'    → redirectTo: ''
```

This is the robust plan's §6 structure with one child instead of six. **Recommended even though a
single login page does not obviously need a shell**, for four reasons:

1. **The problem it solves is structural, not proportional to the page count.** Shell 1's path is
   `''`, which prefix-matches *every* URL, so any single-route alternative still needs an
   empty-path landing route for the logged-out case and still needs its guard to return `false` rather
   than a `UrlTree`. Both are exactly the constraints the two-shell pattern already encodes.
2. **Both of those constraints have already been litigated once.** The empty-path child was a blocking
   finding in Luigi's review of the robust plan; the `UrlTree` alternative was analysed, declined, and
   the decline confirmed by the owner on 2026-08-15. Re-deriving the routing shape here would give
   both defects a second chance to appear.
3. **`canMatch`, not `canActivate`.** `canMatch` runs *before* the lazy `loadChildren`/`loadComponent`
   import, so an unauthenticated visitor never downloads any of shell 1's nine lazy entries. On a
   public deployment that is the difference between an anonymous visitor pulling the whole application
   and pulling a login page.
4. **The login page's chrome has to live somewhere.** Centred card on `bg-surface-sunken`, the `MOTW`
   badge, no sidebar, no header, no search, no user menu — built from the existing token layer
   (`docs/theming/theming-plan.md`), so no new design work. Inlining that into `LoginComponent` just
   means extracting it later.

   Three notes so the component is built to this repo's post-theming conventions rather than to the
   pattern it will be copied from (Luigi, 2026-08-18): **do not lift the `MOTW` badge's classes
   verbatim** — `page-layout.html:5` is `bg-white/20 text-white`, which reads only because it sits on
   `bg-sidebar-surface` (indigo); on `bg-surface-sunken` it is effectively invisible in light mode. Use
   `bg-accent text-on-accent`, both of which exist. **Create no `.scss` file** — components added since
   the Tailwind migration are utility-only; if one is created anyway it must be
   `@reference "…/styles.css"`, never `@reference "tailwindcss"`, which sees only Tailwind's default
   theme and fails the build on any `@apply` of a project token. And give the component
   `host: { class: 'block h-full' }`, matching `App` and `PageLayoutComponent` — without it the centred
   card has no height to centre within.

**Cost accepted:** one component file (~15 lines of template) that a strictly-one-page design does not
need.

**The guards return `false`, never a `UrlTree`.** Returning `false` is what lets the router fall
through to the sibling shell, and that fall-through *is* the pattern. Because shell 1 prefix-matches
everything, `authenticatedMatch` runs even for `/login`, and a `UrlTree` there would redirect
`/login` → `/login` until Angular's redirect limit throws. Recorded because collapsing the two-hop
bounce (`**` → `''` → `login`) looks like a harmless cleanup. Those are the same two hops the
signed-in app already takes to reach `/dashboard`.

**The existing `app.routes.spec.ts` keeps passing without modification** — both its tests use
`routes.find((route) => route.path === '')`, which returns the *first* `''` route, and
`PageLayoutComponent` stays first. Re-verified against the current file on 2026-08-18: it asserts the
`''` child redirects to `dashboard` and that the `data-admin` child exists, and adding `canMatch` to
shell 1 touches neither. Worth knowing, because it means the file is silently order-dependent and would
go red if the shells were ever reordered. Add a logged-out case rather than relying on it.

#### The proactive path cannot carry a `returnUrl`, and that is the pressure that breaks the `UrlTree` rule

**Luigi's review, 2026-08-18 — non-blocking but recorded deliberately.** §3.3 and §3.4 both talk about a
`returnUrl`, but **only `authErrorInterceptor` ever sets one.** The proactive path has no way to: a
`CanMatchFn` returning `false` cannot attach query parameters — attaching them requires returning a
`UrlTree`, which is the declined change that produces the infinite redirect above. So a logged-out deep
link to `/monsters/{id}` resolves `authenticatedMatch → false` → `**` → `''` → auth shell's `''` child →
`/login` **with no `returnUrl`**, and signing in lands on `/dashboard`. The deep link is silently lost.

This matters less for what it costs than for what it invites: someone will notice the lost deep link,
reach for a `UrlTree` to fix it, and reintroduce the redirect loop. Close it one of two ways, and say
which:

- **Recommended (~3 lines):** `authenticatedMatch` receives `segments`; before returning `false`, stash
  `'/' + segments.map((s) => s.path).join('/')` on `AuthService` — **skipping the case where that is
  `/login`** — and have `LoginComponent` prefer `route.snapshot.queryParamMap.get('returnUrl')`, then the
  stash, then `/dashboard`. No `UrlTree`, no query parameter, no loop.
- **Or:** state plainly that the proactive path always lands on `/dashboard` and that this is accepted.

Either is fine. Leaving it unstated is the option that goes wrong. **Whichever is chosen, constrain the
value before `navigateByUrl`:** accept it only if it starts with a single `/` and not `//`. Not
exploitable today (Angular's `UrlSerializer` cannot leave the origin), but it is one line and it is the
kind of thing that stops being free once there is a second consumer.

### 3.2 Auth state

`core/auth.ts`, `@Injectable({ providedIn: 'root' })`, mirroring `core/theme.ts`:

```ts
readonly user = signal<CurrentUser | null>(null);
readonly isAuthenticated = computed(() => this.user() !== null);
```

No `isAdmin`, no `isSuperAdmin` — there are no roles.

**There is no client-side token to persist.** The cookie is `HttpOnly`, so the SPA cannot read it and
the server is the only source of truth. The app therefore has to *ask* on boot:

```ts
provideAppInitializer(() => inject(AuthService).initialize())
```

placed alongside the existing `provideAppInitializer(() => inject(ThemeService).initialize())` line in
`app.config.ts:14`. `initialize()` calls **only** `GET /api/auth/me` and must **resolve, not reject,
on failure** — a network error means "not signed in," not "crash the bootstrap."

> ### `initialize()` must **return** the observable — the line it sits next to teaches the opposite
>
> **Blocking finding, Luigi's review 2026-08-18.** Every claim in §2.3's proactive-guard column depends
> on one thing: that `AuthService.initialize()`'s HTTP call has *completed* before the router's first
> navigation runs `authenticatedMatch`. That holds only if the initializer returns something Angular can
> await.
>
> ```ts
> initialize(): Observable<CurrentUser | null> { … }   // do this — bootstrap waits
> initialize(): void { this.api.get(…).subscribe(…); } // not this — bootstrap does not wait
> ```
>
> **`ThemeService.initialize()` returns `void`** (`core/theme.ts:66` — it is a synchronous
> `applyDomClass()`), and `provideAppInitializer` accepts `void` perfectly happily. So the adjacent line
> this section tells the implementer to copy is *exactly* the shape that breaks this. It compiles, it
> type-checks, and nothing errors.
>
> The failure: bootstrap does not wait, the router's initial navigation (registered as an
> `APP_BOOTSTRAP_LISTENER`, which runs after initializers resolve — this is what makes the ordering
> guarantee real) runs with `user() === null`, `authenticatedMatch` returns `false`, and **a signed-in
> owner is shown the login page on every cold load.** The `me` response then arrives and populates the
> signal, but nothing re-navigates, so the app sits on `/login` while authenticated. It presents as a
> cookie or session bug — the same misdiagnosis §1.7 warns about for Data Protection keys — and it is
> one keyword's difference.
>
> `initialize()` returns `this.api.get<CurrentUser | null>('/api/auth/me').pipe(tap((u) => this.user.set(u)), catchError(() => of(null)))`,
> and `provideAppInitializer` returns *that*. Named as a step in `phases.md` Phase 2 step 2/3 rather than
> left to whoever writes the method.

**`GET /api/auth/me` always resolving is exactly right, and needs no special handling beyond one
`catchError`.** Reviewed explicitly (Luigi, 2026-08-18): signed out → `200` with a JSON `null` body →
`user = null`; signed in → `200` with the user; API down or `500` → `catchError` → `user = null`. That
last branch is the only one worth stating, and it is correct rather than merely defensive: a session
that cannot be *verified* must be treated as no session. **Pin the signed-out response as `200` with a
literal JSON `null`, not `204`** — `HttpClient` yields `null` for both, so the frontend cannot tell, but
the `.http` file in `phases.md` Phase 1 step 7 is where the contract gets locked in and it should lock
in the one §1.3 actually specifies.

The robust plan's `initialize()` is a `forkJoin` of `/api/auth/csrf` and `/api/auth/me`. That second
call exists solely to seed the antiforgery cookie, and this pass has no antiforgery, so it is omitted.
§5 lists its addition as a one-line change to this method.

### 3.3 HTTP wiring

```ts
provideHttpClient(withInterceptors([
  credentialsInterceptor,
  httpErrorInterceptor,   // existing
  authErrorInterceptor,   // LAST — see the ordering note below, this is not a typo
]))
```

> ### The array is **request** order, so `authErrorInterceptor` must be **last**
>
> **Blocking finding, Luigi's review 2026-08-18. This corrects the order previously written here, and
> corrects the robust plan too** (`docs/authentication-update/architecture.md:961` has the identical
> array and the identical "so no toast fires" claim; fixing it here means the robust plan inherits the
> fix rather than shipping the bug twice).
>
> Angular builds the interceptor chain with `reduceRight` over the array, so `withInterceptors([A, B, C])`
> produces `A(next: B(next: C(next: backend)))`. **The array is the order requests travel outward-in.
> Error responses travel back the other way, so the *last* entry is the *first* to see an error.**
>
> With the previously specified order — `credentials, authError, httpError` — `httpErrorInterceptor` is
> innermost. A mid-session `401` on `GET /api/mysteries` therefore hits **`httpErrorInterceptor`'s
> `catchError` first**, which fires `Request failed (401) for GET /api/mysteries`, and only *then*
> reaches `authErrorInterceptor`, which swallows an error nobody is waiting for any more. The toast is
> already queued. The `401` branch's "swallow the error so no toast fires" is simply not what the code
> does.
>
> **This is currently masked, which is why it would survive a dev loop.** The toast host lives inside
> `page-layout.html` (§3.5) and that component is being torn down as the bounce to `/login` runs, so the
> toast renders nowhere. §3.5 moves the toast host to `App` — **at which point the bug becomes visible,
> as a pile of `Request failed (401)` toasts on the login page, one per in-flight request.** §3.5 and
> this finding must land together; fixing either alone is worse than fixing neither.
>
> **The fix is the array order, not a second exemption list.** With `authErrorInterceptor` innermost it
> swallows the `401` (returns `EMPTY`, so the stream completes without erroring) and
> `httpErrorInterceptor`'s `catchError` never runs. `credentialsInterceptor` only mutates the outgoing
> request, so its position is unchanged and it stays first. Everything `authErrorInterceptor` passes
> through — `400`, `404`, `500`, transport failures — still reaches `httpErrorInterceptor` exactly as
> today.
>
> Phrase the rule in the code comment as **"last in the array = first to see an error"**, because
> "ordered before `httpErrorInterceptor`" reads as the opposite of what is required and is how this got
> written backwards in the first place.

- **`credentialsInterceptor`** — clones every outgoing request with `withCredentials: true`. It must
  be an interceptor rather than four edits inside `ApiService`, because `HealthService`
  (`core/health.ts`) calls `HttpClient` directly and bypasses `ApiService` entirely — re-verified
  today.
  **Strictly unnecessary under a same-origin deployment** (same-origin requests carry cookies by
  default), and with the Phase 2 dev proxy both dev and production are same-origin. It ships anyway,
  as ~8 lines of insurance: this document deliberately does *not* make the infrastructure decisions,
  and if the deployment pass lands on sibling subdomains instead, this interceptor plus a credentialed
  CORS policy is exactly what makes the cookie flow. Discovering that at deploy time is far more
  expensive than eight lines now. It is also the robust plan's decision #33 verbatim.
- **`authErrorInterceptor`** — new, registered **last** in the array so it is the first to see an error
  response (see the ordering note above):
  - **First line: if the request URL is under `/api/auth/`, pass it straight through untouched.** The
    auth pages own their own error rendering completely. Written as code shape rather than as
    intention, because "the login endpoint's failures are handled by the login component" is not
    implementable as prose.
  - `401` → clear the `user` signal, `router.navigate(['/login'], { queryParams: { returnUrl } })`,
    and swallow the error so no toast fires. Per §1.4 this can only mean "your session is gone."
  - **Act only if `authService.user()` is currently non-null.** A page that mounts several requests at
    once produces a *burst* of `401`s on expiry, and without this guard each one clears the signal and
    calls `router.navigate(['/login'])` again — repeated cancelled navigations, N swallowed errors, and
    a `returnUrl` read from `router.url` that is `/login` by the second call. Reading the signal, acting
    once, and letting the rest fall through is two lines and makes `returnUrl` deterministic.
  - Everything else → pass through. **No `403` branch** — with no roles, the API never emits one. §5
    lists its addition. (When it is added: the `403` branch must **also** swallow after raising its
    notification, or the user gets both it and `httpErrorInterceptor`'s generic toast.)
- **`httpErrorInterceptor`** (existing, `core/http-error-interceptor.ts`) — needs the same
  `/api/auth/` exemption, in the same place its `/health/live` exemption already sits (line 8).
  Without it the login page renders its own inline "wrong email or password" message *and* a
  generic `Request failed (400) for POST /api/auth/login` toast underneath. **Extract the two
  exemptions as one shared predicate** used by both interceptors rather than copying an `includes()`
  into a second file — two independent copies of an exemption list is how one of them goes stale.
  Name it for what it means — `isSelfHandledRequest(req)`, the robust plan's name — because sharing it
  means a future addition to the list changes **both** the toast behaviour and the `401`-bounce
  behaviour, and only a name that says "the caller handles its own errors" makes that the right
  outcome. (It already is for both current entries: `/health/live` is `[AllowAnonymous]` so it cannot
  `401`, and if the `AllowAnonymous` were ever missed — the risk-register row — sharing the predicate is
  what stops the liveness probe bouncing the user to `/login`.)
  One pre-existing wart resolves itself here and should not be re-raised later as outstanding work: the
  toast currently interpolates the absolute URL (`… for GET http://localhost:5225/api/…`). Once
  `apiBaseUrl` is `''` (Phase 2 step 1) it reads `… for GET /api/mysteries`. Nothing to do.

### 3.4 Login page and Sign out

`features/auth/pages/login/` — auth is a domain vertical, so `features/`, not `pages/`. (The
established split, confirmed by `dashboard`/`data-admin`/`settings`: `pages/*` is for single
cross-cutting app-level views registered via direct `loadComponent`; `features/*` is for verticals
with their own routes.) A reactive form with an `email` control and a `password` control, a submit
button, and one inline error region. No "forgot password" link, no "register" link, no strength meter
— there is nothing for them to point at.

Use `type="email"` on the input. It is free and it is *not* validation: Angular's
`FormGroupDirective` puts `novalidate` on the host `<form>`, so HTML5 constraint validation never
blocks submission — the only effect is the correct keyboard on a phone, which matters for an app
whose whole point is being reachable from any machine.

On success: `AuthService.login()` sets the `user` signal (via `tap`, inside the service — the same
place `logout()` clears it, and what §5.1's "`AuthService.login()` carries forward untouched" claim
depends on), and the component then calls `router.navigateByUrl(returnUrl ?? '/dashboard')`. **That
order is load-bearing, not stylistic:** navigate first and `authenticatedMatch` still sees `null`, shell
1 does not match, and the user is bounced straight back to `/login` by their own successful login.

**Make the form password-manager-friendly.** A real `<form (ngSubmit)>` with a `type="submit"` button,
`name`/`id` on both inputs, `autocomplete="email"` on the first and `autocomplete="current-password"` on
the second. This is not polish: §6's *single non-optional* mitigation for the plaintext column is that
the password be unique to this app and randomly generated, which means the owner will be using a
password manager, which means the browser has to recognise this as a login form and offer to save and
autofill it. Free, carries forward verbatim, and it directly supports the control the entire risk
acceptance rests on. Give the inline error region `role="alert"` while there.

#### The login form's `error` path must render for *every* failure, not just `invalid_credentials`

**Blocking finding, Luigi's review 2026-08-18 — this is the exact mirror image of the `logout()` finding
below, and it comes from the same three decisions.** Both interceptors skip `/api/auth/` (§1.4, §3.3)
and, until §3.5 lands, the auth shell has no toast host at all. **`LoginComponent`'s inline error region
is therefore the only error surface in the entire application for the login POST.** Nothing else can
report it. That is correct and deliberate — and it means the component owns *all* of it, not just the
one case §1.4 designs a code for.

As previously written, this section specified "one inline error region" and §1.4 specified exactly one
failure code. Every other failure was unaccounted for:

| What happens | Status the component sees | As previously specified |
|---|---|---|
| Wrong email or password | `400 { "code": "invalid_credentials" }` | Inline message. Correct. |
| **API not running / dev proxy misconfigured** | `0` (transport failure) | **Nothing at all** |
| **Unhandled server fault** | `500` | **Nothing at all** |
| **`/api/auth/login` mistyped or unrouted** — caught by the `/api/{**rest}` catch-all (§2.3), which is deliberately *not* anonymous | `401` | **Nothing at all** |

In all three of the bottom rows the submit button is **completely inert**: no toast (both interceptors
skipped it), no modal (§3.5), no inline message, no navigation. A silent failure on the one screen that
exists to report failure — the same defect §1.4 exists to prevent, arriving by a different route.

**The rule:** the `error` handler renders the inline region for **every** error. `code ===
"invalid_credentials"` → "Wrong email or password." Anything else → a single generic fallback along the
lines of *"Couldn't sign you in — the server didn't respond. Try again."* Never branch to nothing.

This is not new ground. The robust plan already carries it — *"auth components must render the generic
message for any failure without a recognised `code`, since the rate limiter, antiforgery, and unhandled
faults all reach them too"* — as an adopted part of its decision #37. This pass kept every other part of
decision #37 and dropped this one. Restored.

Note the interaction with §3.5, and note that it does **not** make this optional. §3.5's hoist puts the
API-availability modal back in front of a logged-out visitor, which covers the *idle* API-down case — but
it does not cover this one. A login *submit* failing is not what the health probe watches, both
interceptors skip `/api/auth/` regardless of where the toast host lives, and the login component remains
the only error surface for that request either way. The two are complementary, exactly like the guard and
the interceptor in §2.3.

#### Sign out — in scope, owner-confirmed 2026-08-18

The dead `<a href="#">Sign out</a>` at `page-layout.html:111` becomes a `<button>` calling
`authService.logout()` → `POST /api/auth/logout` → clear the signal → `router.navigateByUrl('/login')`.

**Two distinct mechanisms end a session, and the design has both.** The owner's phrasing — *"we will
need it for when a session expires and it's easy enough to enable a UI button to expire it
manually/intentionally"* — spans both, so they are worth separating:

| | Automatic — a session lapses on its own | Manual — the Sign out button |
|---|---|---|
| **Trigger** | The next API call returns `401` | The user clicks |
| **Mechanism** | `authErrorInterceptor`'s `401` branch: clear the signal, bounce to `/login` | `AuthService.logout()` |
| **Server involvement** | None — the cookie is already gone or expired | `HttpContext.SignOutAsync` deletes the cookie |
| **Why it exists** | The user finds out when something else fails; there is nothing to click | An intentional end to a *live* session — what makes the app safe to use on a borrowed machine |

> **`logout()` must clear state and navigate from its `error` path as well as its `next` path**, and
> the reason is not defensive coding — it is a direct consequence of a decision made elsewhere in this
> document.
>
> `POST /api/auth/logout` is authenticated, so clicking Sign out on an **already-expired** session
> returns `401`. **Both** interceptors skip `/api/auth/` by design (§1.4, §3.3), so neither one handles
> it — no bounce, no toast, nothing. If `logout()` only acts on success, **Sign out silently does
> nothing in exactly the situation the owner named it for.** Subscribing with `next` and `error` doing
> the same two things is the whole fix, and it is a named step in `phases.md` rather than left to
> whoever writes the method.

**"Your profile" (`page-layout.html:104`) stays a dead link.** There is no profile page in this pass
and nothing for one to show. It is dead today; it is not this pass's job to fix. Likewise the
hardcoded `U` avatar initial.

Two mechanical notes on that one edit, since the file and line are named precisely: `page-layout.ts`
uses **constructor injection** (`page-layout.ts:39–42`), not `inject()`, so `AuthService` goes in as a
third constructor parameter rather than mixing two styles in one file; and `<a class="block …">` →
`<button>` needs `w-full text-left cursor-pointer` added to keep the menu item looking identical, plus
the sibling Settings link's `(click)="closeUserMenu()"` mirrored onto it.

### 3.5 Three app-wide concerns currently live inside shell 1 and have to move

**Blocking finding, Luigi's review 2026-08-18.** The two-shell restructure in §3.1 is right, and this is
the thing it breaks that nothing else in this document accounts for. Verified against the current tree:
`page-layout.html` is not only the signed-in chrome — it is also the **sole** host of three
application-wide concerns.

| In `page-layout.html` | Evidence | What happens once shell 2 exists |
|---|---|---|
| **`<app-icon-sprite />`** | `page-layout.html:2` — the only occurrence in the entire `src/` tree; `icon.component.ts:14` calls it "the app-wide icon sprite" | Any `<app-icon>` rendered on the auth shell resolves `<use href="#icon-…">` against a sprite that is not in the document. It renders **blank, with no error and no console warning.** The obvious first casualty is a `name="spinner"` on the login submit button — which is this app's established pattern (`page-layout.html:173`) |
| **The toast host** — `<aside aria-live="polite">` | `page-layout.html:130–150` | Anything raised via `NotificationService` while on the auth shell renders nowhere and is **auto-dismissed after 4 s** (`core/notifications.ts:16`), so it is gone before the user reaches a shell that could show it |
| **The API-availability probe and modal** | `checkApiAvailability()` in `PageLayoutComponent.ngOnInit` (`page-layout.ts:44–46`); modal at `page-layout.html:152–181` | The probe never runs while logged out, so §2.2's stated symptom is impossible (corrected there) **and the Phase 2 verification step that depends on it becomes unrunnable** — see below |

**The verification consequence is the sharp one.** `phases.md` Phase 2 lists *"stop the API and confirm
the 'API unavailable' modal actually appears — this is the check that catches a proxy missing the
`/health` rule."* After the restructure there is no sequence that produces it:

- API down, then load the app → `initialize()` resolves `null` → auth shell → no probe, no modal.
- API up, sign in, *then* stop the API → `PageLayoutComponent` is the shell; it is already mounted and
  `ngOnInit` has already run. Nothing re-probes. Navigating between features does not re-create it.

So the `/health` proxy rule — an inherited **blocking** finding from Luigi's review of the robust plan,
whose entire defining property is that it fails *silently* — would ship into this pass with its only
detector removed, in the very phase that introduces it.

**The fix — decided, not proposed: move all three from `PageLayoutComponent` to `App`.** This was
referred to the owner as the review's one scope question and **confirmed on 2026-08-18** —
*"I will take Luigi's recommendation; app root level is fine"* (`open-questions.md` #5, option A). The
two smaller variants that were on the table (sprite only; nothing moves) are **rejected**, not
fallbacks. `app.html` is a bare `<router-outlet />` and `app.ts` is an empty class, so this is a
template move plus one `ngOnInit`, not new design:

```html
<!-- app.html -->
<app-icon-sprite />
<router-outlet />
<aside aria-live="polite"> … the toast host, moved verbatim … </aside>
@if (isApiUnavailable()) { … the modal, moved verbatim … }
```

Why this and not something smaller:

- The sprite belongs at `App` **by its own documentation** — `icon.component.ts` already calls it
  app-wide. It currently sits in `page-layout.html` only because there has never been a second shell.
- It is strictly less work now than later. The robust plan lands the identical two-shell structure in
  its Phase 3 and hits the identical problem; *"where do toasts and the icon sprite live once there are
  two shells"* is one of the ten questions from Luigi's review of that plan still sitting
  undispositioned with the owner. **This answer resolves it by construction — the robust plan inherits
  the hoist already done, and that question can be closed there as answered here.**
- It removes the need for `AuthLayoutComponent` to import or duplicate any of the three.

**The whole diff, priced.** `page-layout.html` loses ~55 lines and `page-layout.ts` loses
`HealthService`, two signals and `checkApiAvailability()`. Three tests move out of `page-layout.spec.ts`
into a new `app.spec.ts` — *"shows queued notifications"*, *"shows API unavailable modal when initial
health check fails"*, and *"retries API health check and closes modal after success"*
(`page-layout.spec.ts:42, 108, 117`). Their `HealthService` mock and assertions transfer unchanged; only
the `TestBed` component changes. Nothing else in the suite touches them.

> **This lands together with the §3.3 interceptor-ordering fix. Not optional, and not conditional on
> anything.**
>
> The `401` toast bug is masked *today* precisely because the toast host sits inside the shell being torn
> down on the bounce to `/login` — a toast queued into a signal whose host has just been destroyed, then
> auto-dismissed after 4 s. **Hoisting the host to `App` removes that mask.** Ship this move against the
> old interceptor order and every session expiry paints the login page with a stack of
> `Request failed (401) for GET /api/…` toasts, one per in-flight request. §3.3 is already adopted as a
> blocking finding in its own right, so nothing about it was ever contingent on this section — but the
> dependency runs one way and it is worth stating so the two are never separated during implementation.

**What this restores.** With the probe on `App` it runs for logged-out visitors too, so §2.2's original
stated symptom becomes true again and the Phase 2 *"stop the API and confirm the modal appears"* check
becomes performable. That check is the only detector for the silent `/health` dev-proxy gap.

**§3.4's generic login-error fallback is still mandatory, and was never contingent on this.** It was
*additionally* justified as the minimum answer had this gone the other way, which is now moot — but both
interceptors skip `/api/auth/` by design, so the login component remains the only error surface for the
login POST regardless of where the toast host lives, and the API-unavailable modal does not fire on a
*submit* failure in any case.

---

## 4. Hosting — the minimum shape, and where this document stops

### 4.1 Single origin — confirmed by the owner (2026-08-18)

**This is settled, not a recommendation awaiting an answer.** It was raised as needing a decision now
rather than at deployment time because **the cookie design does not survive the wrong answer**:

| Shape | Cookie viability | CORS | Verdict |
|---|---|---|---|
| **Single origin** — the API serves the built SPA, API under `/api/*` | First-party, `SameSite=Lax`, no `Domain` attribute needed | Not needed in production at all | **Chosen** |
| Sibling subdomains — `app.example.com` + `api.example.com` | Works with `SameSite=Lax` + `Domain=.example.com` (same registrable domain ⇒ same site) | Required, with `AllowCredentials` and explicit origins | Viable but strictly more configuration, and it breaks Angular's built-in XSRF support that the robust plan's §7 depends on |
| Different registrable domains — e.g. a static host + a PaaS API | Requires `SameSite=None; Secure`, i.e. a **third-party cookie**, which browsers are actively restricting | Required | Not viable |

**Confirmed: single origin** — the robust plan's decision #2, adopted here for the same reasons and one
extra: deciding it later means deploying first into whatever shape the hosting provider makes easiest,
which is frequently the third row. The owner confirmed this direction on 2026-08-18, together with the
premise in §2.3 that the SPA shell is served to anyone and the login view is rendered by the Angular
app itself. Those two answers are consistent by construction: single-origin hosting is *what makes*
the shell and the API the same server, which is why one `AllowAnonymous` on one endpoint is the whole
of the fix.

**Trade-off accepted:** the SPA's availability is coupled to the API's — an API restart takes the UI
down with it — and there is no CDN in front of the static assets. For a single-user tool that is a
trivial cost against eliminating the entire cross-site-cookie problem class.

### 4.2 What that requires, concretely, in this repo

1. **`Program.cs`:** `app.UseDefaultFiles(); app.UseStaticFiles();` before routing, then
   `app.Map("/api/{**rest}", () => Results.NotFound());` and
   `app.MapFallbackToFile("index.html").AllowAnonymous();` after `MapControllers()`. **§2.3 works this
   through in full** — the `AllowAnonymous` is the line that makes the whole deployment function.
2. **`ng build` writes straight into `wwwroot`, and there is no copy step at all.** One key in
   `src/web/monster-of-the-week-web/angular.json`, under the `build` target's `options`:

   ```json
   "outputPath": { "base": "../../api/MonsterOfTheWeek.Api/wwwroot", "browser": "" }
   ```

   `"browser": ""` flattens away the builder's default `<base>/browser` subdirectory, so files land at
   `wwwroot/index.html` rather than `wwwroot/browser/index.html`. **`MonsterOfTheWeek.Api.csproj` is not
   touched** — the stock Web SDK `wwwroot/**` content glob does the rest.

   **The build output is never committed and never enters an image by accident.** `wwwroot/` does not
   exist yet and gets **two** ignore entries, both anchored:
   - `.gitignore` → `src/api/MonsterOfTheWeek.Api/wwwroot/`
   - `.dockerignore` → `src/api/MonsterOfTheWeek.Api/wwwroot/`, alongside `**/bin/`, `**/obj/`,
     `**/node_modules/`, `.git/`

   The second is not redundant with the first. `.gitignore` keeps built assets out of history;
   `.dockerignore` keeps a **stale local build** out of the image context, so what ships is always what
   the frontend stage just produced rather than whatever a developer last had on disk. `portfolio`
   carries exactly this `.dockerignore` entry for exactly this reason.

   **Sequencing is the Dockerfile** — a frontend stage runs `npm ci && npm run build` (writing into
   `wwwroot`), a backend stage runs `dotnet publish`, and the stage boundary is what guarantees the
   files exist before MSBuild evaluates the project. §4.4 covers the local loop, which does **not**
   involve Docker.

   Verified against the current build: `angular.json` sets no `outputPath` today, and
   `@angular/build:application` defaults to `dist/<project>/browser`; the `build` target has
   `"defaultConfiguration": "production"`, so a bare `ng build` already produces the hashed, budgeted
   output item 8 assumes.

   > #### Why this shape — the `portfolio` comparison, adopted
   >
   > **Resolved by the owner 2026-08-23** against `portfolio`, an already-deployed app of the owner's on
   > the same stack (Angular + ASP.NET Core 10 + Postgres, single origin) **deployed to Railway from a
   > repo-root multi-stage Dockerfile — which is now this project's confirmed deployment shape too.**
   > Full reasoning is `open-questions.md` #6.
   >
   > **What `portfolio` proves.** Its `Portfolio.Api.csproj` contains **zero** SPA-related MSBuild
   > targets — it is the same three-line Web SDK project shape this one has — and its `angular.json`
   > carries exactly the `outputPath` above. Publishing works purely on the stock glob, because
   > `npm run build` completes in an earlier Docker stage, in a separate process, before
   > `dotnet publish` is invoked. Its git history is the corroboration: Railway's Nixpacks auto-detection
   > was tried and abandoned (`dbba641 reconfiguring to use Dockerfile`) because it could build the .NET
   > project but not the combined Angular + .NET build. The Dockerfile is the thing that works.
   >
   > **What this replaces, and why the replaced version was wrong.** An earlier draft of this item
   > specified `ng build` to `dist/`, then a clear-and-copy into `wwwroot`, and offered *"`.csproj` or a
   > small script"* as equal options. The `.csproj` option, written the obvious way, produces a publish
   > output with **no SPA in it, silently**: the Web SDK globs `wwwroot/**` into the `Content` item group
   > at MSBuild **evaluation** time, before any target runs, so a target that *populates* `wwwroot`
   > during the build creates files that were never in that item group and are never published. No error,
   > no warning; the app deploys, `UseStaticFiles` finds nothing, and `MapFallbackToFile("index.html")`
   > `404`s every route including `/login`. That is the third member of the family this document already
   > tracks twice (`/health/live` under `ng serve`, unknown `/api` paths answered with HTML), and the one
   > that takes the deployment down completely. **Writing the output in place removes the whole class of
   > problem** — there is no target, so there is no target to mis-time.
   >
   > **The clear-before-copy step is gone too, and not because it stopped mattering.**
   > `@angular/build:application` sets `deleteOutputPath: true` by default, so each build wipes the
   > directory itself and `outputHashing: "all"` can no longer accumulate stale bundles. Confirm it on
   > the first run rather than trusting it. The consequence to respect: **once `outputPath` is `wwwroot`,
   > nothing else may ever live in `wwwroot`** — a build will delete it. Fine here, since the directory
   > does not exist yet and nothing else is planned for it.
   >
   > **`MonsterOfTheWeek.Api.csproj` stays empty of this, permanently.** Beyond the timing trap, an
   > MSBuild target here would drag the Angular build into `dotnet test`: `MonsterOfTheWeek.Api.Tests`
   > has a `ProjectReference` to `MonsterOfTheWeek.Api`, so anything bound to `Build` makes Node
   > (`>=26.5.0 <27`, per `package.json` `engines`) a hard requirement for running the test suite.
   > `portfolio` has no test project and so never had to discover this.
   >
   > **Pointing `outputPath` inside the API project does not disturb `ng serve`.**
   > `@angular/build:dev-server` builds **in memory** and never writes `outputPath`, so item 3 below and
   > every Phase 2 step are unaffected and this key can land in Phase 3 where it belongs. §4.4 has the
   > full dev-loop answer, including the one script this *does* change.

2a. **A repo-root `Dockerfile`, mirroring `portfolio`'s three stages.** Adapted for this repo's deeper
   layout and newer Node pin — the shape is `portfolio`'s, the specifics are not:

   ```dockerfile
   # Stage 1 — build the SPA straight into the API project's wwwroot
   FROM node:26-alpine AS frontend-build
   WORKDIR /src/web/monster-of-the-week-web
   COPY src/web/monster-of-the-week-web/package*.json ./
   RUN npm ci
   COPY src/web/monster-of-the-week-web/ ./
   RUN npm run build          # outputPath → /src/api/MonsterOfTheWeek.Api/wwwroot

   # Stage 2 — publish the API with wwwroot already populated
   FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
   WORKDIR /src
   COPY src/api/ ./api/
   COPY --from=frontend-build /src/api/MonsterOfTheWeek.Api/wwwroot ./api/MonsterOfTheWeek.Api/wwwroot
   RUN dotnet publish api/MonsterOfTheWeek.Api/MonsterOfTheWeek.Api.csproj -c Release -o /out

   # Stage 3 — runtime
   FROM mcr.microsoft.com/dotnet/aspnet:10.0
   WORKDIR /app
   COPY --from=backend-build /out ./
   CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} dotnet MonsterOfTheWeek.Api.dll"]
   ```

   Four adaptations that are **not** cosmetic, and one deliberate simplification:

   - **`node:26-alpine`, not `portfolio`'s `node:22-alpine`.** `.nvmrc` pins `26.5.0` and
     `package.json` declares `"engines": { "node": ">=26.5.0 <27" }`. Angular 22 needs it; Node 22
     will not do.
   - **`npm ci` requires the lockfile**, which exists (`src/web/monster-of-the-week-web/package-lock.json`,
     verified). Copying `package*.json` before the source is the layer-caching trick — dependency
     installs are only re-run when the manifests change.
   - **`ASPNETCORE_HTTP_PORTS=${PORT:-8080}`** — Railway assigns the port at runtime and the container
     must bind to it. `portfolio` learned this the hard way (`180cafb Updating Docker config to force
     correct port for Railway`).
   - **`dotnet publish` targets the API `.csproj` directly, never the solution.**
     `MonsterOfTheWeek.slnx` also contains `MonsterOfTheWeek.Api.Tests`, and publishing the solution
     would drag the test project — and its SQLite package — into the image.
   - **Simplification over `portfolio`:** its stage 1 does `COPY backend/ ../backend/` and stage 2
     copies the whole backend tree back out, purely so the relative `outputPath` resolves. That is not
     necessary — `ng build` creates the output directory itself, so stage 1 needs only the frontend, and
     stage 2 copies the API source fresh from context and takes **only `wwwroot`** from stage 1. The
     Node stage never carries C# source. Same result, smaller build context per stage.

   The Dockerfile is **in-repo and therefore in scope for Phase 3**; standing up the Railway project,
   its Postgres, its environment variables and its domain remain the separate infrastructure pass
   (§4.3).
3. **`environment.ts` → `apiBaseUrl: ''`**, plus a new `proxy.conf.json` forwarding **`/api` *and*
   `/health`** to `http://localhost:5225`, wired via a `proxyConfig` key in `angular.json`'s `serve`
   target — which **has no `options` block at all today**, so the step must create it.
   - `/health` is a separate rule because `/health/live` is not under `/api` on either side. Missing
     it is silent: `ng serve`'s history fallback answers the unproxied probe with `index.html` and a
     **200**, and `HealthService.getLiveness()` uses `responseType: 'text'`, so the probe *resolves*
     on a blob of HTML and the API-unavailable modal can never appear.
   - `core/api.spec.ts:30` asserts the absolute base URL `http://localhost:5225/health/live` and goes
     red the moment `apiBaseUrl` becomes `''`. Enumerated as a step, not discovered as a failing suite.
     (`core/health.spec.ts` asserts against `service.endpoint` and needs no change.)
4. **No `environment.prod.ts` and no `fileReplacements`.** With the dev proxy in place, `apiBaseUrl`
   is `''` in development *and* production, so there is nothing environment-specific left in the
   frontend to replace. The robust plan deferred both to its Phase 6; this pass finds they are simply
   not needed for a same-origin deployment. If a later pass introduces a genuinely
   environment-specific frontend value, that is when the seam should be created.
5. **`UseForwardedHeaders`**, configured for `XForwardedFor | XForwardedProto`, as the *first*
   middleware — if TLS is terminated by a reverse proxy or platform load balancer (which it will be),
   without this the app believes every request is plain HTTP: `UseHttpsRedirection` produces a
   redirect loop and `CookieSecurePolicy.Always` refuses to set the cookie at all. Both failures look
   like auth bugs.

   > #### `UseForwardedHeaders` as specified does not actually do this — `KnownProxies` defaults to loopback only
   >
   > **Blocking finding, Bowser's review 2026-08-19.** This item, `phases.md` Phase 3 step 3, and the risk
   > register row all present `ForwardedHeaders = XForwardedFor | XForwardedProto` as the mitigation.
   > **On its own it mitigates nothing on any mainstream host**, and the failure it leaves behind is
   > byte-for-byte the one described above.
   >
   > `ForwardedHeadersOptions` ships with `KnownNetworks = { ::1/128 }` and `KnownProxies = { ::1 }` —
   > **loopback only**. `ForwardedHeadersMiddleware` walks the forwarded entries and `break`s out of the
   > loop at the first hop whose address is not a known proxy or network, and **that check gates the
   > whole entry, so `X-Forwarded-Proto` is discarded along with `X-Forwarded-For`.** In a container
   > behind a platform load balancer, an nginx sidecar, Cloudflare, or anything else that is not
   > literally `::1`, zero entries are consumed: `Request.Scheme` stays `http`, `SecurePolicy.Always`
   > refuses to emit `motw.session`, and `UseHttpsRedirection` redirects forever. The checklist row
   > *"the first thing to check if login 'succeeds' but no cookie appears"* would point the reader at a
   > line that is already present and already not working.
   >
   > **The fix, alongside the `ForwardedHeaders` flags:**
   >
   > ```csharp
   > options.KnownNetworks.Clear();
   > options.KnownProxies.Clear();
   > ```
   >
   > This is not a workaround — it is exactly what the framework does for you under the
   > `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` shortcut, whose own source comment reads *"Only loopback
   > proxies are allowed by default. Clear that restriction because forwarders are being enabled by
   > explicit configuration."* (That shortcut is not usable here as-is: it sets
   > `XForwardedHost | XForwardedProto` and omits `XForwardedFor`.)
   >
   > **State the residual honestly rather than leaving it implicit.** With both lists cleared, any client
   > that can reach the app *directly*, bypassing the proxy, can assert its own `X-Forwarded-Proto`. The
   > only consequence for this app is that it would believe an insecure request was secure — no
   > authorization decision reads the scheme — and it is closed by the deployment requirement §4.3 already
   > carries: the app must not be publicly reachable except through its proxy. Once a host is chosen, the
   > tighter form is to put the proxy's actual address in `KnownProxies` instead; that is an infrastructure
   > -pass refinement, not a blocker here.
   >
   > **Production only, as already specified.** In Development there is no proxy and `SecurePolicy` is
   > `SameAsRequest`, so none of this applies.
   >
   > **Confirmed live-relevant by the Railway decision (2026-08-23), not hypothetical.** Railway
   > terminates TLS at its edge and forwards to the container over plain HTTP, and the edge's address is
   > not loopback. So this is the exact configuration in which the defaulted `KnownProxies` list silently
   > drops `X-Forwarded-Proto`. **`portfolio` does not have this problem and is not a counter-example:**
   > it has no `UseForwardedHeaders` at all, and gets away with it because it issues **no cookies**, so
   > nothing in it reads `Request.Scheme` for a security decision. This design's `SecurePolicy.Always`
   > does. Of the three blocking findings in this review, this is the one that would have bitten on the
   > very first Railway deploy.
   >
   > **Related and now settled: `UseHttpsRedirection` becomes Development-only**, matching `portfolio`
   > (`Program.cs:113–116`). See item 5a immediately below.
5a. **Make `UseHttpsRedirection()` Development-only.** Settled 2026-08-23 against Railway's own
   documentation and a live test of its edge, rather than by inference — `open-questions.md` #6 records
   the evidence and the one thing that could not be confirmed. Three findings, in descending order of
   how solid they are:

   - **Railway's edge is HTTPS-only, and already does this job one hop earlier.** Its public-networking
     specs state *"Inbound traffic must be TLS-encrypted"*, *"All traffic must be HTTPS and use TLS 1.2
     or above"*, and *"Plain HTTP GET requests will be redirected to HTTPS with a `301` response."*
     Confirmed live: `curl http://docs.railway.com/…` (itself a Railway-hosted domain) returns
     `301 Moved Permanently` with `content-length: 0` and `server: railway-hikari` — **the edge answers
     it; the request never reaches the container.** So an application-level redirect is not a fallback,
     it is dead code: no external client can present a plain-HTTP request to this app.
   - **After the `KnownProxies` fix, the middleware could never fire anyway.** The same specs table
     states that at Railway's edge **`X-Forwarded-Proto` *always* indicates `https`**. So once forwarded
     headers are honoured, `Request.IsHttps` is true for every real request and `UseHttpsRedirection`
     is a permanent no-op — which is also a useful independent confirmation that item 5's fix is the
     right one and sufficient.
   - **Inside the container it is inert regardless, because there is no HTTPS port to redirect to.**
     Kestrel binds HTTP only (`ASPNETCORE_HTTP_PORTS=${PORT}`; Railway's own ASP.NET Core guide
     prescribes the equivalent `ASPNETCORE_URLS=http://+:${PORT}`). `HttpsRedirectionMiddleware`
     resolves its target port from `HttpsRedirectionOptions.HttpsPort`, `ASPNETCORE_HTTPS_PORT`,
     `HTTPS_PORT`, or an `https://` address in `IServerAddressesFeature` — none of which exist here —
     then logs *"Failed to determine the https port for redirect."* once and calls `next` for every
     request thereafter.

   **So why remove it at all, if it is already inert?** Because the third point is the fragile one. The
   middleware is dormant *only* while no HTTPS port is configured, and configuring one is exactly the
   kind of thing someone does while debugging a TLS problem — `portfolio` itself sets
   `options.HttpsPort` from a config value (`Program.cs:12–19`). The moment it wakes up, it starts
   redirecting **Railway's deploy-time healthcheck**, which is the one client that plausibly arrives as
   plain HTTP with no `X-Forwarded-Proto`: Railway probes the container's `PORT` directly with the
   `Host: healthcheck.railway.app` header, and its docs say it *"will query the endpoint until it
   receives an HTTP `200` response"* — a literal `200`, with no documented redirect-following.
   Development-only turns a latent trap into an impossibility for one `if`, and costs nothing, because
   in Development `SecurePolicy` is `SameAsRequest` and there is no proxy.

   **Blast radius if it ever did bite, stated accurately:** Railway *"does not monitor the healthcheck
   endpoint after the deployment has gone live"* and it is explicitly **not** used for continuous
   monitoring. A redirected healthcheck therefore means **the new deployment never goes live** (it fails
   after the 300-second timeout, default) — it does not take a running app down. That is the safer of
   the two failure modes, and it is worth knowing so this is not over-weighted.

   > **One consequence of the healthcheck hostname worth pinning now.** Railway sends
   > `Host: healthcheck.railway.app`, and its docs warn that applications restricting hosts will fail
   > the check *"with status 400"*. ASP.NET Core's host-filtering reads `AllowedHosts` from
   > configuration, and `appsettings.json` currently has `"AllowedHosts": "*"`, so **this is safe
   > today** — but if `AllowedHosts` is ever tightened as a hardening step, `healthcheck.railway.app`
   > must be in the list or **every deploy silently stops going live.** Recorded because tightening
   > `AllowedHosts` looks like pure upside and this is the string that makes it not be.
6. **Configuration via environment variables** with the `__` separator —
   `ConnectionStrings__Postgres`, `ASPNETCORE_ENVIRONMENT=Production`. No secret belongs in
   `appsettings.json`; the committed `Postgres` connection string there is a local placeholder.

   > **The `?? throw` guard on that connection string never fires, for the same reason the CORS one
   > doesn't** (Bowser, 2026-08-19) — and unlike the CORS case, this one has teeth. `appsettings.json`
   > commits `ConnectionStrings:Postgres` = `Host=localhost;Port=5432;Database=motw;Username=motw_app;Password=motw_dev_password`,
   > and `dotnet publish` ships that file. So a production deploy that forgets to set
   > `ConnectionStrings__Postgres` does **not** fail with `"ConnectionStrings:Postgres must be
   > configured."` (`Program.cs:11–12`). It starts, resolves the local placeholder, and dies inside
   > `MotwDbInitializer.InitializeAsync`'s `MigrateAsync()` with a socket error against `localhost` —
   > a misleading message for a missing-configuration fault, on the one code path §4.3 notes takes the
   > app down on boot.
   >
   > **Equal-effort fix, while this step is already editing `appsettings.json`: move both the
   > `ConnectionStrings` and `Cors` blocks out of `appsettings.json` and into
   > `appsettings.Development.json`.** That file is only layered in when `ASPNETCORE_ENVIRONMENT=Development`,
   > so both `?? throw` guards start doing what they claim, and **no local placeholder ships to production
   > at all** — which is what item 6's own sentence already asks for.
   >
   > **Verified safe for migrations:** `Data/MotwDbContextFactory.cs` is an
   > `IDesignTimeDbContextFactory<MotwDbContext>` that defaults `ASPNETCORE_ENVIRONMENT` to
   > `"Development"` and layers `appsettings.{env}.json`, so `dotnet ef migrations add` (Phase 0 step 5)
   > keeps resolving the connection string with no change and no extra flag.
   >
   > **One pre-existing inconsistency noticed in passing, out of scope and not introduced here:**
   > `appsettings.Development.json` already sets `Password=change-me` while `docker-compose.yml` defaults
   > to `motw_dev_password`, so the two disagree today. Worth reconciling whenever these files are next
   > touched; not this pass's job.
7. **CORS made Development-only**, per §2.4.
8. **`index.html` must not be aggressively cached.** With `outputHashing: all` the JS/CSS filenames are
   content-hashed and safe to cache forever, but `index.html` is the file that names them — a stale
   copy points at bundles that no longer exist after a deploy. `UseStaticFiles` and
   `MapFallbackToFile` emit `ETag`/`Last-Modified` by default, which is adequate; the thing to avoid
   is adding a blanket `Cache-Control: max-age` later without excluding `index.html`.

**Two smaller confirmations, added after Bowser's review (2026-08-19), because both are the first thing
someone will ask:**

9. **`UseStaticFiles()` with no `wwwroot/` directory is safe — the dev loop does not break.** The
   `.gitignore` entry from Phase 3 step 5 guarantees that a fresh clone has no `wwwroot`, and Phase 3
   lands `UseStaticFiles` unconditionally. When the directory is absent, `IWebHostEnvironment`
   resolves `WebRootFileProvider` to a `NullFileProvider` rather than `null`, so the middleware
   registers, matches nothing, and passes through. `dotnet run` + `ng serve` keeps working exactly as it
   does in Phases 0–2. Nothing to do; recorded so it is not "fixed."
10. **Nothing outside `/api` is fail-closed, and that includes probe paths.** `{*path:nonfile}` means
    **any** extensionless non-`/api` path that is not a real endpoint gets `200 text/html` — `/health`
    (as opposed to `/health/live`), `/healthz`, `/ready`, anything. That is correct and required, since
    it is the same mechanism that serves deep links. But it means **a container or platform liveness
    probe aimed at a slightly wrong path passes forever while the app is broken** — the `/health`
    dev-proxy trap this document already tracks, one layer out and in production rather than in
    `ng serve`. The `/api/{**rest}` catch-all closes the `/api` half of this and deliberately does not
    close the other half. One line in the Phase 3 step 7 runbook note is the whole mitigation: **the
    probe path is `/health/live`, exactly, and a probe that returns HTML is misconfigured.**

### 4.3 What this document deliberately does not decide

**Hosting is now decided: Railway, from the repo-root Dockerfile in §4.2 item 2a** — owner-confirmed
2026-08-23, mirroring `portfolio`. That settles four of the six items this section used to list, and
the remaining infrastructure work is still a separate focused pass.

**Settled by the Railway decision:**

- **Runtime shape** — a single container built from the Dockerfile, deployed by Railway on push.
- **TLS and certificates** — Railway provisions and renews them at its edge. **`SecurePolicy.Always`
  means there is no working deployment without real TLS**, and this is what supplies it. It is also
  what makes §4.2 item 5's `KnownProxies` fix mandatory rather than precautionary.
- **CI/CD** — Railway builds from the connected branch; there is no GitHub Actions workflow to write.
  (`portfolio` has none either; its `.github/workflows/` is squad automation only.)
- **Where Postgres lives** — a Railway Postgres service, as in `portfolio`.

**Still open, and still genuinely needing the owner:**

- **Domain name**, and whether the app is served at a domain root or a subpath (`index.html` has
  `<base href="/">`, which assumes the root).
- **How the owner reaches the production database to insert the credential row** — a stated requirement
  of this design, so a hard dependency rather than a nice-to-have. Railway exposes a connection string
  and a web console; confirming that path works *before* Phase 3 ships is the actual task.
- **Backups** for that Postgres service.
- **The exact environment variables and where their values come from** — see the trap immediately below.

> #### Railway injects `DATABASE_URL` as a URI, and Npgsql cannot parse it
>
> **Raised 2026-08-23 on the strength of `portfolio`'s git history, not speculation.** Railway's
> Postgres addon exposes its connection string as `postgresql://user:pass@host:port/db`. **Npgsql
> expects `key=value` form and will not accept that URI** — `portfolio` hit this on its first deploy and
> carries a `NormalizeConnectionString` helper written specifically for it
> (`08a3388 adding normalization for DB connection string from Railway`), on the *same* Npgsql 10.0.0
> this project pins. `Program.cs` here has no equivalent, so `ConnectionStrings__Postgres` set naively
> to `${{Postgres.DATABASE_URL}}` fails at `MigrateAsync()` on boot.
>
> **Two ways out, and the cheaper one needs no code:**
>
> - **Recommended — compose the key=value string in Railway's variable editor**, using the addon's
>   individual variables:
>   `Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};Database=${{Postgres.PGDATABASE}};Username=${{Postgres.PGUSER}};Password=${{Postgres.PGPASSWORD}}`.
>   Zero application code, and it keeps `Program.cs` free of host-specific parsing.
> - **Or** port `portfolio`'s ~10-line normalizer, which is already written and proven.
>
> This is an **infrastructure-pass item with its answer pre-supplied**, not new Phase 3 work — recorded
> here so it is configured correctly the first time rather than diagnosed as a database outage.
>
> While configuring those variables: **`railway.toml` should set `healthcheckPath = "/health/live"`**,
> exactly. `portfolio`'s sets `/healthz`, which is its own path — copying it verbatim here would give
> Railway a probe that the SPA fallback answers with `200 text/html` **forever, even when the API is
> broken** (§4.2 item 10). This is the near-miss trap in its most concrete possible form.

**Explicitly *not* on that list: migrating existing local game data.** Resolved 2026-08-18 — it does not
need to reach production. The owner will recreate the handful of objects currently in the local
database by hand. Production starts with the seeded lookup tables only (adventure types, monster
archetypes, the four `*Type` tables, weapon tags), which `MotwDbInitializer` provides from first boot;
mysteries, monsters, minions, locations, and bystanders start empty. **This is a decision, not a gap.**
One fact worth carrying if the owner later reverses it: the robust plan's Phase 2 adds a `NOT NULL`
`owner_id` to four tables, after which importing unowned rows needs a backfill step — moving data
*before* that lands is materially simpler than moving it after.

One existing behaviour the infrastructure pass should know about rather than rediscover:
**`MotwDbInitializer.InitializeAsync` calls `Database.MigrateAsync()` on every startup**
(`Program.cs:59–63`). Migrations apply themselves on deploy, so there is no separate migration step to
design — and equally, a bad migration takes the app down on boot. Pre-existing, not introduced here,
and not re-decided here. **Under Railway this becomes concrete rather than theoretical:** every
container start runs the migrations, so a bad migration is a failed deploy rather than a corrupted one.
That is the better failure, and it needs no design — only awareness.

### 4.4 The local development loop — `ng serve`, and Docker is for shipping only

**Owner-confirmed 2026-08-23: Docker is not part of local development.** The rebuild-and-rerun cost of
`docker build` on every change is exactly the friction the container is *not* there to introduce. The
Dockerfile in §4.2 item 2a exists to produce a deployable image and for nothing else.

**The day-to-day loop is the one Phase 2 already designs, and it needs no new work:**

```
terminal 1:  docker compose up -d postgres     (already the setup today)
terminal 2:  dotnet run                        (API on http://localhost:5225)
terminal 3:  npm start                         (ng serve on http://localhost:4200, with the dev proxy)
```

Browse `http://localhost:4200`. That is the whole loop, and it satisfies "simple, no Docker, live
rebuild on change" fully:

- **It is the only loop with real hot-reload.** `@angular/build:dev-server` rebuilds the changed module
  and pushes it to the browser in well under a second, with component state preserved where it can be.
- **Authentication works end to end in it.** The dev proxy (Phase 2 step 1, forwarding `/api` **and**
  `/health`) makes the browser see a single origin, `http://localhost:4200`, so `Set-Cookie` is
  first-party, `SameSite=Lax` is satisfied, and `SecurePolicy` is `SameAsRequest` in Development so the
  cookie is issued over plain HTTP. Login, session, `401` bounce, Sign out — all exercisable here.
- **It exercises most of the API-side gating too**, including the fallback policy on all 107 controller
  actions and the `/api/{**rest}` catch-all, because the proxy forwards `/api/*` verbatim to the API.
- **`outputPath` pointing into the API project does not affect it.** The dev server builds in memory
  and never writes `outputPath`. Verified, and the reason this loop survives the §4.2 item 2 change
  untouched.

> #### Do not use `npm run watch` as the development loop
>
> `package.json`'s `"watch": "ng build --watch --configuration development"` is the obvious-looking
> candidate for "a watch," and it is the wrong tool here on both counts:
>
> - **It is worse at the job.** It performs a full (if incremental) build to disk on every change and
>   **does not refresh the browser** — there is no live-reload channel and no HMR. You get slower
>   feedback *and* a manual refresh. `ng serve` strictly dominates it for iterating.
> - **It is actively dangerous now that `outputPath` is `wwwroot`.** It writes an unoptimised, unhashed
>   *development* build into the exact directory the image ships from, and `deleteOutputPath` (default
>   `true`) **deletes the production build that was there first**. Nothing warns. The failure is a
>   development bundle shipped to production, or a confusing local state where `wwwroot` disagrees with
>   what was last built deliberately.
>
> It has no role in this design. The guard is §4.2 item 2's rule — the build immediately precedes the
> publish — plus the checklist assertion that published bundles are content-hashed. `phases.md` Phase 3
> step 7.

**There is one legitimate reason to run single-origin locally, and it is a check rather than a loop.**
`ng serve` cannot exercise `MapFallbackToFile`, its `.AllowAnonymous()`, `UseStaticFiles`, or deep-link
refresh, because the dev server answers those itself with its own history fallback. That is precisely
where the `AllowAnonymous` omission — the "unrecoverable bootstrap deadlock" of §2.3 — would hide. The
answer is **Phase 3's existing verification step**, which is a deliberate one-shot before shipping and
already written: `npm run build` once, stop `ng serve`, then `dotnet run` and browse
`http://localhost:5225`. **No Docker, no watch, no new tooling** — and no reason to want a
`dotnet watch` + `ng build --watch` variant of it, because it is something you run when you are about
to deploy, not while iterating.

> **Two things about that single-origin check that are easy to trip over, since it runs in Production
> mode locally.**
>
> - **`SecurePolicy.Always` over `http://localhost:5225`.** Chrome and Firefox both treat `localhost`
>   as a trustworthy origin and **do** accept `Secure` cookies over plain HTTP there, so signing in
>   works. Worth knowing rather than assuming: if a browser ever refuses, the login will fail in a way
>   that looks exactly like a cookie bug and is not one. Try another browser before debugging the app.
> - **`UseHttpsRedirection` is not in the pipeline in Production at all**, as of §4.2 item 5a, so it
>   cannot interfere with this check. (Even before that change it was inert here: under the `http`
>   launch profile no HTTPS port is resolvable, so the middleware logs *"Failed to determine the https
>   port for redirect"* and passes through. Under the `https` profile it *would* redirect — use the
>   `http` profile.)

---

## 5. Forward compatibility — the itemised list

### 5.1 Carries forward unchanged — written once, never rewritten

| Item | Where it lands in the robust plan |
|---|---|
| The whole cookie options block: name `motw.session`, `HttpOnly`, `SecurePolicy`, `SameSite=Lax`, 24h `ExpireTimeSpan`, `SlidingExpiration`, `IsPersistent`, no "Remember me" | §1 session-shape table / decision #27 |
| `OnRedirectToLogin` / `OnRedirectToAccessDenied` → bare 401/403, **written as mutation** | §1 |
| Data Protection persisted to Postgres + `SetApplicationName("MonsterOfTheWeek")` + the `data_protection_keys` table | Decision #29 (its Phase 0) |
| `MotwDbContext` implementing `IDataProtectionKeyContext` | Its Phase 0 step 4 |
| `SetFallbackPolicy(RequireAuthenticatedUser)` and the fail-closed argument | §3 / decision #7 |
| `[AllowAnonymous]` on `/health/live` and on the SPA fallback, plus the `/api/{**rest}` 404 catch-all | §3 |
| **Email as the sole login identifier** — the `LoginRequest`/`CurrentUserResponse` field, the login form control and label, `AuthService.login(email, …)`, `CurrentUser.email`, and the login component's spec | Decision #6 / resolution #17. Aligned from the start, so **the login screen and its contract are written once** |
| The issued claim set — `ClaimTypes.NameIdentifier` = id, `ClaimTypes.Name` = email | Identity produces the identical pair (`UserName = Email`) |
| Middleware order, **including the explicit `app.UseRouting()`** (§2.3) | §7. **Corrects** the robust plan too, whose §7 order also assumes a `UseRouting()` call that `Program.cs` does not make |
| Single-origin hosting: `UseDefaultFiles`/`UseStaticFiles`/`MapFallbackToFile`, CORS as Development-only | §2 / decision #2, its Phase 6 |
| **`angular.json`'s `outputPath` → `wwwroot` with `"browser": ""`, and a `.csproj` with no SPA targets in it** (§4.2 item 2) | Its Phase 6. The robust plan inherits a shape already proven on the owner's `portfolio` deployment |
| **The repo-root `Dockerfile`, `.dockerignore`, and Railway as the deployment target** (§4.2 item 2a, §4.3) | Its Phase 6, which defers hosting entirely. Nothing in the robust plan changes the image: it adds packages, tables and endpoints, all of which `dotnet publish` picks up unchanged |
| **`ng serve` + dev proxy as the only development loop; Docker for shipping only** (§4.4) | Its Phase 3 step 1 sets up the same proxy. The loop is unchanged by anything the robust plan adds |
| **`UseForwardedHeaders` with `KnownNetworks`/`KnownProxies` cleared** (§4.2 item 5) | Its Phase 6. **Corrects** the robust plan, which specifies the same flags with the same defaulted known-proxy list and claims the same mitigation |
| **`AppUser` as a plain POCO (not `ITimestamped`) exposed as `DbSet<AppUser> AppUsers`** (§1.2) | Its Phase 0. `AppUsers` avoids hiding `IdentityUserContext.Users` when the base class changes, so the cutover is a delete rather than a rename-then-delete |
| **`ConnectionStrings`/`Cors` moved out of `appsettings.json` into `appsettings.Development.json`** (§4.2 item 6) | Its Phase 6, which specifies environment-variable configuration and the same `__` separator. Makes both existing `?? throw` startup guards real |
| Dev proxy (`/api` **and** `/health`) + `apiBaseUrl: ''` | Its Phase 3 step 1 |
| `credentialsInterceptor` | Decision #33 |
| `/api/auth/*` → `400 { code }`, `401` reserved for "no session" | Decision #37 |
| The `/api/auth/` exemption in **both** interceptors, extracted as one shared predicate (`isSelfHandledRequest`) | §6 / decision #37 |
| **Interceptor array order — `authErrorInterceptor` last** (§3.3) | **Corrects** the robust plan's §6, which specifies the same array in the wrong order with the same "no toast fires" claim. The fix carries forward; the bug would otherwise have shipped twice |
| **The login component rendering a generic message for any unrecognised failure** (§3.4) | Already an adopted part of decision #37; restored here after being dropped |
| **`<app-icon-sprite />`, the toast host and the API-availability modal hosted on `App` rather than `PageLayoutComponent`** (§3.5) | Its Phase 3 lands the same two shells and hits the same problem. Answers one of the ten still-open questions from Luigi's review of that plan by construction |
| Two-shell routes, `canMatch` not `canActivate`, guards returning `false` not `UrlTree`, an empty-path child on **both** shells | §6 / decision #31 |
| `AuthLayoutComponent` and its chrome | §6 |
| `AuthService` signal shape + `provideAppInitializer` bootstrap, with `initialize()` **returning** the observable (§3.2) | Decision #32 |
| `GET /api/auth/me` anonymous, returning `null` when signed out | §3, §4 |
| `POST /api/auth/logout` and the `page-layout.html:111` Sign-out button rewire | §6 |
| `ClaimTypes.NameIdentifier` carrying the user id | Its Phase 2 `ICurrentUser` reads the same claim |
| Controller → service → repository → `ServiceResult<T>` for the auth endpoints | §1 |
| `features/auth/pages/login/` location | Decision #34 |

### 5.2 Changes when the robust plan is layered on

| What changes | Shape of the change |
|---|---|
| **The credential table** | `app_users` and the `AppUser` POCO are **deleted**; Identity's `users`, `roles`, `user_roles`, `user_claims`, `user_logins`, `user_tokens`, `role_claims` are created by a new migration. Distinct table names mean no collision and no rename. |
| **The plaintext password** | Not migrated. **With one user, the migration is "register again through the new flow, then drop `app_users`."** If there is more than one user by then, a one-off script reads each plaintext value and calls `UserManager.CreateAsync(user, plaintext)` — plaintext is the *one* storage format from which a rehash is possible without user involvement, which is the sole operational upside of this pass's trade-off. |
| **The auth registration call** | `AddAuthentication(...).AddCookie(...)` → `AddIdentityCore<AppUser>()...AddIdentityCookies()` + `ConfigureApplicationCookie(...)` to keep the `motw.session` name. The scheme name changes (`Cookies` → `Identity.Application`), which is invisible to the client. Every session in flight at that cutover ends; irrelevant on a branch. **This is the moment the `options.Events` replacement trap opens** — §1.5. |
| **`MotwDbContext`** | Base class `DbContext` → `IdentityDbContext<AppUser, AppRole, Guid>`, and **`OnModelCreating` gains `base.OnModelCreating(modelBuilder);` as its first statement** — it has none today (`MotwDbContext.cs:52`), and without it no Identity table is mapped. `IDataProtectionKeyContext` is already there from this pass. |
| **Credential verification** | Hand-written `string.Equals` → `SignInManager.PasswordSignInAsync`, paired with the explicit `CheckPasswordAsync` sequence the robust plan's §7 specifies (naively wiring `IsNotAllowed` leaks account state for *any* password). |
| **Revocation** | None → security-stamp revalidation on a 10-minute `ValidationInterval`, which also becomes the only path by which a database role change reaches a live session (its decision #10). |
| **CSRF** | `SameSite=Lax` alone → plus a globally registered `AutoValidateAntiforgeryTokenAttribute`, a new `GET /api/auth/csrf`, `withXsrfConfiguration` in `app.config.ts`, and `AuthService.initialize()` becoming a `forkJoin` of csrf + me with `catchError` on each inner stream. |
| **`authErrorInterceptor`** | Gains a `403` branch (surface one notification, do not sign out). |
| **`AuthService`** | Gains `isAdmin` / `isSuperAdmin` computed signals. |
| **`page-layout.ts`** | `navItems` becomes a `computed()` filtering the Data Admin entry on `isAdmin()`; the `U` avatar derives from the signed-in identity; "Your profile" gets a real `routerLink`. |
| **Routes** | The auth shell gains five children (`register`, `forgot-password`, `reset-password`, `resend-confirmation`, `confirm-email`); the `data-admin` child gains `canMatch: [adminMatch]`. Pure additions to an existing structure. |
| **Reference data** | The 7 `ReferenceController` POSTs gain `[Authorize(Policy = "DataAdmin")]`; the 7 GETs stay open to any authenticated user (its decision #16). Pure addition. |

### 5.3 Pure additions — nothing shipped here is in the way

Roles and policies; `owner_id` on the four owned roots, `ICurrentUser`, EF Core global query filters,
the ~30 missing service-layer parent guards, and the `WebApplicationFactory` integration tests (its
Phase 2); registration, email confirmation, password reset, `IEmailSender`/Resend; rate limiting and
lockout; password policy; the Profile page; the super-admin Users panel.

**Nothing in this design conflicts with any of them.** The one place this pass had taken a position the
robust plan decided differently — the login identifier — was raised as open question 1 and **resolved
on 2026-08-18 in favour of email**, so there is now no conflict anywhere between this design and
`docs/authentication-update/`. See `open-questions.md` #1.

---

## 6. The plaintext password — a deliberate, accepted risk

Stated plainly: **the owner's password is stored in the database in plaintext and compared in
plaintext.** This is not an oversight and not a shortcut that slipped through review. It is a direct
requirement of the operating model the owner asked for — create and change the credential with a
single hand-written `INSERT` over a database connection — and hashing is incompatible with that
without also building the hash-generation tool this pass exists to avoid.

**What is actually at risk.** The threat is *not* application compromise. An attacker who can read
`app_users` already has read access to the entire database, which is everything this app has. The real
exposure is **password reuse**: a database backup left in cloud storage, a `pg_dump` on a laptop, a
misconfigured Postgres port, or a hosting-provider incident hands an attacker a *working credential for
whatever else that password unlocks.*

**The one control that makes this acceptable, and it is not optional:**

> **The password must be unique to this app and used nowhere else.** Generate it randomly. This is the
> entire mitigation. Everything else on this list is hygiene.

Hygiene, in descending order of how easy it is to get wrong later:

- **Never seed a user from code.** `MotwDbInitializer` seeds lookup tables and must never seed a
  credential. A password in committed code is a password in git history forever.
- **Never log the login request body.** ASP.NET Core does not by default, but any request-logging
  middleware, verbose `Microsoft.AspNetCore` log level, or APM agent added later will — and this is
  the one endpoint where that matters.
- **Never echo the submitted password back** in a validation message or an exception.
- **TLS is a hard prerequisite, not hardening.** Plaintext at rest plus plaintext in transit is two
  failures, not one. §4.3.
- **Do not name the column `password_hash`.** §1.2.

**The upgrade trigger, stated as a condition rather than as "later":**

> The plaintext column is the **first** thing that changes when *either* of these becomes true:
> **(a)** a second person gets an account, or **(b)** the app starts holding anything the owner would
> mind losing or having read. Whichever comes first, it is no longer a single-user app with trusted
> database access, and the premise this decision rests on has expired.

Because plaintext is recoverable, that upgrade is genuinely cheap — §5.2's rehash script, or simply
re-registering. This is the one respect in which plaintext is easier to leave than any weaker-but-not-
plaintext scheme would have been.
