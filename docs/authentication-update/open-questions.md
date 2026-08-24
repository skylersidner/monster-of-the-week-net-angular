# Authentication & Authorization — Resolved Decisions

**Status: RESOLVED. All 16 original questions were answered by the project owner on 2026-08-08.
Two follow-ups (#18, #19) were opened by the correction to #7 and are also resolved — #18 confirmed
as recommended, #19 overridden. **Nothing in this document is still open.** The one review
sub-recommendation that was referred to the owner — a proposed `UrlTree`-returning guard, declined by
Yoshi as self-defeating — was ruled on 2026-08-15: the decline stands and the reasoning is now
recorded in `architecture.md` §6. See the last row of "Luigi review dispositions."

This file was the pending-questions list; it is now the decision record. Every question is kept, with
the resolution and the reasoning recorded against it, so the *why* survives past the conversation
that produced it. The design in `architecture.md`, `data-ownership.md`, and `phases.md` has been
updated to match — this file is the audit trail, not a second source of truth.

**Fourteen of the sixteen resolutions confirmed the recommended default. Two did not** — #8 and #13 —
and those changed the design rather than just a constant.

**One resolution (#7) was answered, then corrected the same day.** It is recorded below with both the
first answer and the correction, deliberately, rather than rewritten to look as though it was always
settled — several downstream decisions were reasoned *from* the first answer and had to be
re-derived, and that history is the reason those re-derivations exist.

**#17** (login identifier) was an ambiguity in the original brief that I resolved and flagged; the
owner has since confirmed it.

---

## Resolutions

| # | Question | **Resolution** | Notes |
|---|---|---|---|
| 1 | Production hosting topology: same origin, or separate hosts? | ✅ **Same origin, as recommended.** The API serves the built SPA; API under `/api/*`. | The decision the whole cookie design rests on. Session cookie is first-party (`SameSite=Lax`), CORS disappears from production, and Angular's built-in XSRF support works (it deliberately skips absolute cross-origin URLs). Accepted trade-off: SPA availability couples to the API's, and no CDN. `architecture.md` §2. |
| 2 | Does the existing local game data move to production, or does production start empty? | ✅ **Production starts empty, as recommended.** Backfill the local database only. | Local library stays useful for development; production is a fresh deploy with no rows. `data-ownership.md` §6. |
| 3 | Ownership granularity: per-record, or a campaign container? | ✅ **Per-record, as recommended.** `owner_id` on `Mystery`, `Monster`, `Location`, `Bystander`. No campaign concept. | Monsters/locations/bystanders are M:N to Mystery and can deliberately belong to *zero* mysteries, so Mystery isn't a container. A `Campaign` entity would be a product feature, and is outside this update's scope. `owner_id` remains a clean stepping stone if sharing is ever wanted. `data-ownership.md` §2. |
| 4 | Can admins / super-admins see other users' game data? | ✅ **No, as recommended.** | Means the query filter has exactly one form and no admin branch; `IgnoreQueryFilters()` never appears in domain code, so there is no path that can accidentally widen. Consistent with #8's model of the owner operating directly on the database when they genuinely need to. `data-ownership.md` §5. |
| 5 | Reference data: global + admin-write, or per-user? | ✅ **Global + admin-write, as recommended — and the regression is accepted knowingly.** | **Ordinary users lose the ability to add reference types**, which they have today. Their create forms are limited to seeded rows plus whatever an admin adds. The owner accepted this explicitly rather than by omission. `architecture.md` §3, `data-ownership.md` §1. |
| 6 | Outbound email provider. | ✅ **Resend**, as recommended, with a log-only sender when running locally. | Free tier, HTTP API (no SMTP/MailKit), verified sending domain with SPF + DKIM. Provider chosen by an `Email:Provider` configuration value, not by scattered environment checks. Under the corrected #7 this dependency is **load-bearing**, not merely useful: no email delivery means no new accounts. `architecture.md` §5. |
| 7 | **Must users confirm their email before they can log in?** | ✅ **Yes — `RequireConfirmedAccount = true`.** *Answered "no" first, then corrected the same day back to the recommended default.* | **First answer:** not a gate — confirmation mail still sent, but an unconfirmed account could sign in. **Correction:** the owner had read the question as proposing an emailed code on *every* login, i.e. a second factor. A one-time verification at enrollment is what they want, and requiring it is fine. **Why the correction mattered more than a flag flip:** five "consequences" had been derived from the wrong premise (squatting, forgot-password-as-reclaim-path, data transfer on reclaim, junk-account pressure landing on the rate limit, silent typo failure) and were all consequences *of the wrong premise*. They are gone, not edited. Three downstream decisions were genuinely re-derived rather than reverted by assumption: password reset for unconfirmed accounts (#19), the login-failure enumeration set (#18), and the registration cap's justification (#9). **The one real cost the gate does carry:** an ordering hazard — broken email delivery means nobody can register, including the owner — sharpened by #8 removing the allowlist auto-confirm that originally mitigated it. Closed by `LoggingEmailSender` locally and a documented `UPDATE users SET email_confirmed = true` break-glass in production. `architecture.md` §5. |
| 8 | **Super-admin bootstrap mechanism.** | ❌ **None — went against the recommendation.** No `Auth:SuperAdminEmails` allowlist, no config-seeded user, no auto-confirm. | **Owner's model:** register through the normal public flow, then insert the `SuperAdmin` row directly into `user_roles`. The role travels as a claim in the encrypted session cookie and is validated at the controller level by the `"SuperAdmin"` policy. `MotwDbInitializer` still seeds the three **role rows** so the `INSERT` has something to reference; it creates no users. **The propagation question this raises is now load-bearing and is answered explicitly in `architecture.md` §3:** role claims are baked into the cookie at sign-in, and `SecurityStampValidator` regenerates the principal from the database once per `ValidationInterval` — **10 minutes** per #11 — so a database role change takes effect within 10 minutes automatically, or immediately on sign-out/sign-in. **This is the only propagation path** — there is no per-request role lookup and no force-re-auth endpoint. **⚠️ Corrected after Boo's review:** an earlier version of this row said changing `security_stamp` forces revocation *immediately*. It does not — the validator compares `IssuedUtc` against `ValidationInterval` before reading the database, so a stamp bump lands at the next boundary like everything else. It changes the *outcome* (session terminated rather than principal refreshed), not the *timing*. **There is no immediate revocation mechanism in this design**, and the owner has accepted that. Role assignment must nonetheless call `UpdateSecurityStampAsync(target)`, or a demoted super-admin keeps capability for the rest of the interval and can re-grant it to themselves. **Boo reviewed and agreed with this resolution.** |
| 9 | Open registration, or invite-gated? | ✅ **Open, as recommended**, with confirmation mail and rate limiting — **capped at 10 registrations per day, configurable.** | Config key `Auth:Registration:MaxPerDay` in `appsettings.json` (default `10`), bound via `Configure<RegistrationOptions>(...GetSection("Auth:Registration"))` and read through `IOptionsMonitor` inside the rate-limiter partitioner so it changes without a restart. **Global 24-hour fixed window, not per-IP.** *Re-derived after the #7 correction:* the original justification ("the only bound on usable account creation") died with the "not a gate" premise — an unconfirmed account is now inert. The standing and now primary justification is that the resource at risk is **outbound email quota and sender reputation**, which is a *global* resource, so a global limiter is the semantically correct shape; a per-IP cap doesn't bound it at all under distributed abuse. Same conclusion, different and better reasoning. **Accepted trade-off:** self-DoS is possible, contained because only registration uses this limiter — login, forgot-password, reset, and resend keep separate per-IP limits, so existing users are never blocked. `architecture.md` §7. |
| 10 | Password policy. | ✅ **12 characters, 4 unique, no composition rules, as recommended** (NIST SP 800-63B). | The optional Have I Been Pwned k-anonymity validator was not taken up. It remains a clean later addition — one `IPasswordValidator<AppUser>` implementation, no contract change. `architecture.md` §7. |
| 11 | Session lifetime and "Remember me". | ✅ **Persistent cookie, no "Remember me" checkbox — as recommended. Both time values revised after Boo's review: sliding expiration 14 days → 24 hours, security-stamp revalidation 30 → 10 minutes.** | The interval is not only a security bound: under #8 it is **the mechanism by which a database role change reaches a live session**, and it is also what keeps authenticated requests free of a database round trip. **Why 24 hours:** sliding expiration has no absolute cap, so a cookie used once per window never expires — the window is therefore the practical bound on a *stolen* cookie's life, and 14 days was too generous for a value doing that job. **Why 10 minutes:** at this scale the per-interval read is one indexed primary-key lookup, so the original cost argument for 30 minutes didn't hold, and 10 minutes materially shrinks both the stale-role and stale-session windows. `architecture.md` §1, §3. |
| 12 | Account deletion. | ✅ **None in v1, as recommended.** Owner FK is `ON DELETE RESTRICT`; deactivation via lockout covers "stop this person logging in." | Matters more under #8, where the owner is expected to operate on the `users` table by hand — a cascade would let one `DELETE` destroy every mystery, monster, minion, location, bystander, and sub-resource with no application code running. `data-ownership.md` §3. |
| 13 | **Ship the role-management UI, or defer it?** | ❌ **Ship it — but folded into the Data Admin section, not as a separate surface or a separate phase.** Super-admin only. | Was Phase 5; now part of **Phase 4**. Route stays `/data-admin` behind `adminMatch` (admin *or* super-admin can reach the page); the Users panel renders only when `isSuperAdmin()`, so a plain `Admin` sees the reference-type panels and nothing else. Backed by `GET /api/admin/users` + `PUT /api/admin/users/{id}/roles`, both `[Authorize(Policy = "SuperAdmin")]` — the panel visibility is cosmetic, the policy is the enforcement. Guard rails: can't demote yourself, can't demote the last super-admin. **The panel must state that a role change takes up to 10 minutes to reach a signed-in user** (#8/#11), or it reads as a bug. `architecture.md` §3. |
| 14 | Where do production secrets live? | ✅ **Environment variables (`__` separator) in production, `dotnet user-secrets` locally — as recommended.** | Note `Auth:Registration:MaxPerDay` is *not* a secret and stays a committed, overridable default in `appsettings.json`. `architecture.md` §7. |
| 15 | Should the login page say *why* a login failed? | ✅ **No, as recommended — with one deliberate exception introduced by the #7 correction.** | Wrong password, nonexistent account, and locked-out all collapse to one generic message; the distinction goes to the server log only. Restoring the confirmation gate reintroduces a fourth case — correct password, unconfirmed account — which gets a **distinct** response. Full reasoning in #18 below and `architecture.md` §7. **Accepted trade-off (unchanged):** a locked-out user sees "invalid email or password" and may keep retrying, extending their own lockout. |
| 16 | Per-user server-side theme preference? | ✅ **Deferred — no work in this update, as recommended.** Theme preference stays in `localStorage`, exactly as `core/theme.ts` implements it today. | `core/theme.ts` already documents the seam ("swapping the backing store later … is a change confined to this file"), so this stays a genuinely small later change if it's ever wanted. |
| 17 | **Login identifier: username or email?** *(ambiguity in the brief — resolved by me, since confirmed by the owner)* | ✅ **Email — owner-confirmed.** `RequireUniqueEmail = true`, `UserName = Email` at registration, login resolves via `FindByEmailAsync`. Settled, not pending. | The brief said "username + password"; the owner has confirmed that email/password is the auth mechanism and that there is no separate username concept — "username" was being used loosely as a synonym for the login identifier. This matches the code: enrollment, reset, and the Profile view (requirement #7: "showing the user's email address") all key off email, and **there is no `username` field anywhere in the codebase** — not in `Contracts/ApiContracts.cs`, not in `core/models.ts`, not in any template. `architecture.md` §1. |

---

## Follow-ups opened by the #7 correction

Both were surfaced to the owner rather than buried, because both are user-visible behaviour and both
touch a decision the owner had already made. **Both are now resolved:** #18 confirmed as recommended,
**#19 overridden.**

| # | Decision | Resolution | Why | Notes |
|---|---|---|---|---|
| 18 | **Does the login page tell a user with correct credentials that their email is unconfirmed?** This is an exception to #15 ("login never reveals why it failed"). | ✅ **Yes — owner-confirmed as recommended.** Return a distinct `email_not_confirmed` response with an inline resend link, while wrong-password / no-such-account / locked-out all stay collapsed into one generic message. | Collapsing this case too produces a genuine dead end: the user types the *right* password, is told it's wrong, and has no way to learn a confirmation link is sitting in their inbox. The exception doesn't reopen enumeration because it is reachable **only after the correct password is supplied** — at which point the caller has already proven more than enumeration would tell them. Lockout deliberately stays collapsed, because `PasswordSignInAsync` returns `LockedOut` *before* validating the password, making it a true unauthenticated oracle. The distinguishing test throughout: *is the password verified before this branch is reached?* **Implementation detail that makes it safe** (`architecture.md` §7): `NotAllowed` is also returned pre-password-check, so it must be paired with an explicit `CheckPasswordAsync` — wiring `IsNotAllowed` straight through would leak the state for *any* password. **Boo review item.** | Collapsing it restores a strictly uniform #15 at the cost of that dead end. If you want that, the mitigation is prominent "didn't get the confirmation email?" copy on the login page itself, shown unconditionally. |
| 19 | **Does forgot-password work for an unconfirmed account?** | ⚠️ **OWNER OVERRIDE — sends a fresh *confirmation* link.** The recommendation was "silently no-op"; the owner chose the friendlier alternative that had been flagged as the override path. `POST /api/auth/forgot-password` on an unconfirmed account queues a **confirmation** mail (24h token), not a reset mail. **No password-reset token is ever issued to an unconfirmed account**, and `reset-password` still rejects one — the override changes *which mail goes out*, not *whether an unconfirmed account can complete a reset*. | The recommendation's reasoning (wouldn't help / mail-sending oracle / matches `MapIdentityApi`) held on the security axis but lost on UX: a user who never confirmed picks "forgot password," sees a success message, and **no mail ever arrives, with no way to discover why**. That silent dead end was the deciding factor. Sending the confirmation link converts it into a working recovery path at **no cost to enumeration safety**, because the HTTP response is unchanged. | Three things this override required, all specified in `architecture.md` §5 and §7: **(1)** the response stays byte-identical across all three branches (no account / confirmed / unconfirmed) — the user learns which branch ran *only from the mail*, the one channel that already proves address control; **(2)** the mail copy must explain why a reset request produced a confirmation link, or it reads as phishing at exactly the moment a user is primed to click — five mandatory content requirements plus recommended wording; **(3)** the confirmation link lands on `/login` with a "still need to reset your password?" link rather than chaining into a reset form — chaining would make a 24h confirmation token function as a 24h reset token, undermining the deliberate 1h reset lifetime. **It also changed the mail throttle's key** — see the throttle entry below. |

---

## Decided by reasoning, not asked — recorded so they aren't re-litigated

These were real forks resolved from the code or the requirements rather than referred to the owner.
Flag any you disagree with, but they were never open questions:

- **`MapIdentityApi<T>()` is not used.** It has no logout endpoint, which directly contradicts
  requirement #7 ("Sign out must actually revoke the session"). Its 2FA/recovery-code surface is also
  fixed and can't be trimmed — relevant given the owner's explicit position that nothing should read
  as a second factor. Note its `/forgotPassword`
  gates outbound mail on `IsEmailConfirmedAsync`, sending nothing to an unconfirmed account. This
  design **deliberately diverges** there under the owner's #19 override, sending a fresh confirmation
  link instead. `architecture.md` §1, §5.
- **The outbound-mail throttle is keyed on `(purpose, userId)`, not `(endpoint, userId)`.** Forced by
  the #19 override: two endpoints can now produce `Confirmation`-purpose mail — `resend-confirmation`
  and `forgot-password` on an unconfirmed account. Per-endpoint budgets could be **alternated between
  to double the effective rate** against a single address. One budget per (purpose, account), consumed
  by every path that produces that mail, closes it by construction. **Boo review item**, because
  adding a fourth mail-producing path later without registering it against the right purpose silently
  reopens the bypass. `architecture.md` §7.
- **No external identity provider.** Requirement #6 asks for an in-app bare-bones login page
  matching the current design; an IdP's value comes from owning that page. You'd also still need a
  local user row for the `owner_id` foreign keys, so the "no user table" saving is illusory — and it
  would put roles in a second place, conflicting with resolution #8's model of roles being a row in
  our database. `architecture.md` §1.
- **The resend-confirmation flow lives on the unauthenticated side, not the Profile page.** Under the
  confirmation gate an authenticated user is confirmed by definition, so a Profile-page
  `emailConfirmed` display and resend affordance would be dead UI that can never render a meaningful
  state. `emailConfirmed` is correspondingly dropped from the `/api/auth/me` payload.
  `architecture.md` §4, §6.
- **`Minion` does not get its own `owner_id`.** Its `MonsterId` FK is required with cascade delete,
  so a minion cannot have an owner different from its monster's; denormalising would create a bug
  class that otherwise cannot exist. `data-ownership.md` §1.
- **Ownership is enforced by EF Core global query filters, not per-repository `.Where()` clauses.**
  The five `ISearchProvider` implementations query `MotwDbContext` directly and bypass the repository
  layer entirely — a repository-level convention would silently leak every search result, including
  description snippets. `data-ownership.md` §4.
- **`owner_id` never appears in any request DTO.** Ownership is ambient, derived from the
  authenticated principal. A client-supplied owner id is an authorization bypass with extra steps.
- **`OwnerId` is assigned explicitly at the ~8 create call sites, not in a `SaveChanges`
  interceptor** — despite the existing `ApplyTimestamps()` precedent. Timestamps are cosmetic and
  belong in infrastructure; ownership is a security boundary and should be visible where a reviewer
  reads it. `data-ownership.md` §4.
- **The authorization default is fail-closed** (`SetFallbackPolicy(RequireAuthenticatedUser)`), with
  an explicit `[AllowAnonymous]` list. With 107 existing actions across six controllers and a
  demonstrated pattern of adding endpoints incrementally, fail-open is not an acceptable default.
  `architecture.md` §3.
- **Data Protection keys are persisted to Postgres in Phase 0, not Phase 6.** Losing the key ring on
  restart fails silently as "users keep getting logged out" — which, under resolution #8, is
  indistinguishable at a glance from normal role-propagation behaviour. `architecture.md` §7.
- **~30 service methods are missing a parent-existence guard** and rely only on the repository's
  parent-scoped query. Parent-scoped is not owner-scoped: a caller who knows two GUIDs can update or
  delete another user's sub-resource. Enumerated as explicit Phase 2 work rather than left to emerge
  from the query filter. `data-ownership.md` §4.

---

## Boo review dispositions (2026-08-09)

Boo's security review is complete. **Verdict: the design is broadly sound — no finding changed its
shape.** He agreed with all four items the design flagged for him (the login enumeration exception,
the `(purpose, userId)` throttle key, the revocation-latency trade, and resolution #8's no-bootstrap
model), and confirmed that resolution #19 enables nothing unintended. He also verified the docs'
factual claims against the codebase, which is how the last three rows below were found.

### Adopted

| Finding | Disposition |
|---|---|
| The `IsNotAllowed` → `CheckPasswordAsync` snippet leaves unconfirmed accounts with **no brute-force lockout** and **bypasses an active lockout** (`NotAllowed` precedes both the lockout and password checks in `PreSignInCheck`) | Corrected sequence in `architecture.md` §7; Phase 1 step + risk-register row + checklist item |
| **PBKDF2 timing oracle** — skipping the hash on the no-such-account branch makes it 10–20× faster, so the enumeration invariant held only in the response body | Dummy `VerifyHashedPassword` on login's no-such-account and register's already-registered branches. `architecture.md` §7 |
| **`options.Events = new CookieAuthenticationEvents{…}` silently discards `OnValidatePrincipal`**, disabling security-stamp validation entirely while the app appears to work | Callout in `architecture.md` §1 and inline at Phase 1 step 6; behavioural checklist item |
| **Antiforgery tokens are bound to the claims identity**, so the first mutating request after login — including logout — fails validation | Login and logout re-issue the token pair via `GetAndStoreTokens`. `architecture.md` §7; Phase 1 step + `.http` verification |
| **Query filters on the roots alone leave derived and bridge types exposed** — three verified live examples, including `GET /api/mysteries/{other-id}/countdown` returning another user's data | Filters extended to every derived and bridge type. `data-ownership.md` §4; Phase 2 step 3. The ~30 parent guards demoted to defence in depth |
| **`LinkToMysteryAsync` does not exist**; the real bridge exposure is the *unlink* paths | `data-ownership.md` §1 corrected; Phase 2 step 8 now names the three `Unlink…` methods |
| **"A stamp bump forces revocation immediately" is false** — the validator checks `IssuedUtc` before reading the database, so it lands at the next boundary like everything else | Corrected in `architecture.md` §3 and `phases.md` decision #10. **There is no immediate revocation mechanism in this design**, stated plainly |
| Role assignment leaves a demoted super-admin able to **re-grant their own role** during the stale window | `PUT /api/admin/users/{id}/roles` calls `UpdateSecurityStampAsync(target)`; plus a one-line role-change audit log. `architecture.md` §3 |
| **`Email:Provider` could default to `Logging` in production**, writing live reset links to the application log | Fails closed: unrecognised/absent value throws at startup, `LoggingEmailSender` refused outside Development. `architecture.md` §5 |
| Mail throttle enforced in `AuthService` is a convention anyone can forget | Moved into the enqueue API — `purpose` and `userId` become required parameters, making unthrottled mail unrepresentable. `architecture.md` §7 |
| **Confirmation tokens are not single-use** (only reset tokens rotate the stamp); tokens travel in the query string and reach access logs | Claim corrected; tokens move to the **URL fragment** plus `history.replaceState`. `architecture.md` §5 |
| Test fixture stubs `ICurrentUser`, so it proves the filters but **nothing about the authorization pipeline** | Phase 2 gains a full-pipeline test and an **endpoint-inventory test** asserting every endpoint requires auth or is explicitly allowlisted |
| Misc: `ON CONFLICT DO NOTHING` on the bootstrap `INSERT` (composite PK); `X-Forwarded-For` becomes attacker-controlled if `KnownProxies` is emptied; the mail `BackgroundService` must not query owned entities (no `HttpContext` ⇒ filters match nothing, silently); Base64URL-encode tokens; drop the dev CORS policy rather than adding `AllowCredentials`; seven controllers, not six | All folded into the relevant sections |

### Declined by the owner

These are knowing trades, recorded so they are not re-litigated — and so the reasoning is visible if
the application's exposure ever changes.

| Recommendation | Decision and reasoning |
|---|---|
| **Response security headers** — CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`. Boo's argument: `HttpOnly` is the wrong bar, since XSS in a cookie-auth SPA doesn't need to *steal* the cookie — it rides along automatically | **Declined.** `HttpOnly` + `Secure` + `SameSite=Lax` is sufficient for a very limited-access private application. Note this makes the URL-fragment token change carry more weight, since `Referrer-Policy: no-referrer` is not available as a mitigation |
| **Registration cap changes** — per-IP limiter in front, sliding window instead of fixed, `429` instead of `503`. Boo's argument: one person can close public registration for 24 hours at zero cost | **Declined — non-issue.** The app is not publicly marketed; opening it up is a learning exercise, possibly for friends only. A registration-availability DoS has no meaningful victim here |
| **Global mail-quota cap** persisted in Postgres | **Declined** with the above. Per-account throttling is enough given a small known user base; aggregate Resend volume is not a realistic exposure |
| **"Sign out everywhere"** action on the Profile page (`UpdateSecurityStampAsync` + `RefreshSignInAsync`) | **Declined.** No immediate revocation mechanism is wanted. Consequence recorded in `architecture.md` §1: a password change is the only user-reachable revocation lever, and it isn't labelled as one |
| **`__Host-` cookie prefix** in production | Not adopted; single-origin with no `Domain` attribute already gives most of the benefit, and the dev/prod name divergence isn't worth it here |
| **`ValidationInterval` → 1 minute** (Boo's suggestion) | **Partially adopted at 10 minutes**, along with sliding expiration 14 days → 24 hours |

---

## Luigi review dispositions (2026-08-15)

**Partial — this records the four *blocking* findings Luigi raised against Phase 3, not a completed
review.** Luigi has not signed off; the gate in `phases.md` stays open. Three findings are adopted in
full and folded into `architecture.md` and `phases.md`; the fourth is adopted in substance with one
sub-recommendation referred to the owner.

Common shape worth naming, because it is the same shape as Boo's highest-severity items: **all four
are gaps between a requirement stated in one section and the wiring that would implement it in
another.** Nothing in the design was wrong; four things were unreachable. Two of the four fail
silently.

### Adopted

| Finding | Disposition |
|---|---|
| **Nothing fetches the CSRF token, so login is impossible as specified.** `architecture.md` §7 required `GET /api/auth/csrf` at bootstrap; §6's Angular wiring and every Phase 3 step omitted it. With the global `AutoValidateAntiforgeryTokenAttribute` and no `XSRF-TOKEN` cookie, Angular's `HttpXsrfInterceptor` attaches no header and **every auth POST — starting with login — is rejected** | Adopted as recommended. `AuthService.csrf()` added to Phase 3 step 2; `initialize()` now does `forkJoin([csrf$, me$])` with `catchError` on **each inner stream** so either can fail without taking the other or the bootstrap down (Phase 3 step 9, `architecture.md` §6). Order is irrelevant — both are anonymous `GET`s that don't change the identity — so they run in parallel. §7's callout now points at the two steps that implement it |
| **The auth shell has no `''` child**, so logged-out `/` and every unknown URL dead-end: shell 1 `canMatch` false → shell 2 has no matching child → `**` → `''` → shell 2 has no `''` child → `**` again, and Angular fails with "Cannot match any routes" / a possible-infinite-redirect error | Adopted as recommended, in part — see "Referred to the owner" for the other half. `{ path: '', pathMatch: 'full', redirectTo: 'login' }` is now the auth shell's first child, mirroring the `redirectTo: 'dashboard'` child `PageLayoutComponent` has carried at `app.routes.ts:9` since before this feature. `architecture.md` §6, Phase 3 step 8, decision #31 |
| **The dev proxy doesn't cover `/health/live`, and the failure is silent.** `HealthService.endpoint` resolves to `/health/live` under `apiBaseUrl: ''`, but the API maps it at the root (`Program.cs:65`), outside any `/api` rule. `ng serve`'s history fallback answers with `index.html` and a **200**, and `getLiveness()` uses `responseType: 'text'`, so the probe *succeeds* on a blob of HTML — `isApiUnavailable()` can never become true and the API-unavailable modal is dead from Phase 3 onward | Adopted: `proxy.conf.json` forwards **`/health` as well as `/api`**. Declined the alternative of moving the endpoint under `/api` — root `/health/live` is where container and reverse-proxy liveness probes conventionally look, and production is single-origin so nothing there needs the move; a second key in a development-only file is the cheaper half of that trade. Two verified adjacencies folded into the same step: `angular.json`'s `serve` target has **no `options` block**, so `proxyConfig` has nowhere to go and the object must be created; and `core/api.spec.ts:30` hardcodes `http://localhost:5225/health/live` and goes red the moment `apiBaseUrl` becomes `''`. All three facts added to `architecture.md` §0 |
| **`authErrorInterceptor`'s login exemption had no mechanism, and login's failure status was undefined anywhere in the design.** If login failed with `401` — the natural reading, and what a `ServiceResult` → `Unauthorized()` would produce — the interceptor's `401` branch fires first, clears the session, bounces to `/login`, and swallows the body, so `email_not_confirmed` never reaches the login component and **resolution #18 silently does not ship** | Adopted as recommended, and recorded as **decision #37** because it changes the API contract, not just the frontend. `/api/auth/*` failures are **`400` with `{ "code": … }`**; **`401` is reserved API-wide for "no valid session"** and is emitted only by the cookie handler's `OnRedirectToLogin` override; **and** the interceptor skips `/api/auth/` outright. Deliberately redundant, per Luigi — either alone is one refactor from reopening it. Two additions of mine, both strictly in the same direction: **`httpErrorInterceptor` needs the same exemption** (without it the login page renders its inline message *and* a generic toast underneath), extracted as one shared predicate rather than a copied `includes()`; and **auth components must render the generic message for any failure without a recognised `code`**, since the rate limiter (`429`/`503`), antiforgery (`400`, not ours), and unhandled faults (`500`) all reach them too. `architecture.md` §4 ("Failure shape on `/api/auth/*`"), §6, §7 |

**Also corrected while here, in the same vicinity:** `architecture.md` §2 stated that the whole
frontend-build consequence — including `environment.ts`'s hardcoded base URL — was deferred to
Phase 6, contradicting §0's row and Phase 3 step 1, which put `apiBaseUrl → ''` plus the dev proxy in
Phase 3. §2 now carries the two-phase split explicitly, and says that it previously said otherwise.

### Referred to the owner — not implemented

| Recommendation | Why it is not in the docs |
|---|---|
| **`authenticatedMatch` should return a `UrlTree` rather than `false`**, so the logged-out bounce is one hop instead of two | **Disagreed — it would create the infinite redirect it is meant to avoid, and it is unnecessary.** Shell 1's path is `''`, which prefix-matches *every* URL, so its `canMatch` runs first for `/login` too. Returning `false` is what lets the router fall through to the sibling auth shell — that fall-through *is* the two-shell pattern. A `UrlTree` cancels the navigation and redirects instead of trying siblings, so a logged-out visit to `/login` would redirect to `/login`, re-enter the same guard, and loop until Angular's redirect limit throws. The empty-path child alone fully resolves the finding: `**` → `''` → `login` terminates in two hops, and two hops of `redirectTo` is what the app already does when signed in. ✅ **Owner ruled 2026-08-15: agreed with the decline, and asked that the reasoning be recorded.** `architecture.md` §6 now carries a bullet stating that the guards must return `false` rather than a `UrlTree`, with the redirect-loop trace and a note that the two-hop bounce is deliberate — because collapsing it looks like a harmless cleanup and silently breaks logged-out routing. **Closed.** |
