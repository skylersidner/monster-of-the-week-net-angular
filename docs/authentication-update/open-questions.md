# Authentication & Authorization — Resolved Decisions

**Status: RESOLVED. All 16 original questions were answered by the project owner on 2026-08-08.
Two follow-ups (#18, #19) were opened by the correction to #7 and are also resolved — #18 confirmed
as recommended, #19 overridden. **Nothing in this document is still open.**

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
| 8 | **Super-admin bootstrap mechanism.** | ❌ **None — went against the recommendation.** No `Auth:SuperAdminEmails` allowlist, no config-seeded user, no auto-confirm. | **Owner's model:** register through the normal public flow, then insert the `SuperAdmin` row directly into `user_roles`. The role travels as a claim in the encrypted session cookie and is validated at the controller level by the `"SuperAdmin"` policy. `MotwDbInitializer` still seeds the three **role rows** so the `INSERT` has something to reference; it creates no users. **The propagation question this raises is now load-bearing and is answered explicitly in `architecture.md` §3:** role claims are baked into the cookie at sign-in, and `SecurityStampValidator` regenerates the principal from the database once per `ValidationInterval` — **30 minutes** per #11 — so a database role change takes effect within 30 minutes automatically, or immediately on sign-out/sign-in. Forcing immediate revocation means changing that user's `security_stamp`. **This is the only propagation path** — there is no per-request role lookup and no force-re-auth endpoint. **Boo review item.** |
| 9 | Open registration, or invite-gated? | ✅ **Open, as recommended**, with confirmation mail and rate limiting — **capped at 10 registrations per day, configurable.** | Config key `Auth:Registration:MaxPerDay` in `appsettings.json` (default `10`), bound via `Configure<RegistrationOptions>(...GetSection("Auth:Registration"))` and read through `IOptionsMonitor` inside the rate-limiter partitioner so it changes without a restart. **Global 24-hour fixed window, not per-IP.** *Re-derived after the #7 correction:* the original justification ("the only bound on usable account creation") died with the "not a gate" premise — an unconfirmed account is now inert. The standing and now primary justification is that the resource at risk is **outbound email quota and sender reputation**, which is a *global* resource, so a global limiter is the semantically correct shape; a per-IP cap doesn't bound it at all under distributed abuse. Same conclusion, different and better reasoning. **Accepted trade-off:** self-DoS is possible, contained because only registration uses this limiter — login, forgot-password, reset, and resend keep separate per-IP limits, so existing users are never blocked. `architecture.md` §7. |
| 10 | Password policy. | ✅ **12 characters, 4 unique, no composition rules, as recommended** (NIST SP 800-63B). | The optional Have I Been Pwned k-anonymity validator was not taken up. It remains a clean later addition — one `IPasswordValidator<AppUser>` implementation, no contract change. `architecture.md` §7. |
| 11 | Session lifetime and "Remember me". | ✅ **14-day sliding expiration, persistent cookie, no "Remember me" checkbox, 30-minute security-stamp revalidation — as recommended.** | The 30-minute interval is no longer only a security bound: under #8 it is **the mechanism by which a database role change reaches a live session**. Shortening it trades database reads for role-change freshness. `architecture.md` §1, §3. |
| 12 | Account deletion. | ✅ **None in v1, as recommended.** Owner FK is `ON DELETE RESTRICT`; deactivation via lockout covers "stop this person logging in." | Matters more under #8, where the owner is expected to operate on the `users` table by hand — a cascade would let one `DELETE` destroy every mystery, monster, minion, location, bystander, and sub-resource with no application code running. `data-ownership.md` §3. |
| 13 | **Ship the role-management UI, or defer it?** | ❌ **Ship it — but folded into the Data Admin section, not as a separate surface or a separate phase.** Super-admin only. | Was Phase 5; now part of **Phase 4**. Route stays `/data-admin` behind `adminMatch` (admin *or* super-admin can reach the page); the Users panel renders only when `isSuperAdmin()`, so a plain `Admin` sees the reference-type panels and nothing else. Backed by `GET /api/admin/users` + `PUT /api/admin/users/{id}/roles`, both `[Authorize(Policy = "SuperAdmin")]` — the panel visibility is cosmetic, the policy is the enforcement. Guard rails: can't demote yourself, can't demote the last super-admin. **The panel must state that a role change takes up to 30 minutes to reach a signed-in user** (#8/#11), or it reads as a bug. `architecture.md` §3. |
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
