### 2026-08-08: Authentication, Authorization, and Data Ownership — Architecture (Design Written, Not Implemented)
**By:** Yoshi (Architect)

**What:** Designed and documented (in `docs/authentication-update/`) the full auth/authz architecture
for taking the app from local-only-and-unauthenticated to public-web. Key calls:

- **Mechanism: ASP.NET Core Identity + cookie authentication with hand-written API controllers.**
  Identity for the parts that must never be hand-rolled (PBKDF2 hashing, lockout state machine,
  `DataProtectorTokenProvider` for confirm/reset, user+role store); our own thin controllers so the
  HTTP surface matches the existing `Controllers → Services → Repositories → ServiceResult<T>`
  convention. **Rejected `MapIdentityApi<AppUser>()` because it has no logout endpoint** — a direct
  contradiction of the requirement that sign-out revoke the session. Rejected an external IdP (the
  requirement for a bare-bones in-app login page conflicts with a hosted redirect flow; a local user
  row is needed for `owner_id` FKs anyway). Rejected hand-rolling.
- **Hosting topology is part of the auth design, not deployment trivia: single origin.** The API
  serves the built Angular app. Makes the session cookie first-party (`SameSite=Lax`), removes CORS
  from production, and is required for Angular's built-in `withXsrfConfiguration` to work at all (it
  deliberately skips absolute cross-origin URLs). Accepted trade-off: SPA availability is coupled to
  the API's, and there's no CDN.
- **Data ownership: exactly four `owner_id` columns** — `mysteries`, `monsters`, `locations`,
  `bystanders`. All 31 entities classified into owned (4) / derived (21) / bridge (3) / reference (7).
  `Minion` derives from `Monster.OwnerId` rather than getting its own column: its `MonsterId` FK is
  required with cascade delete, so a divergent owner is a bug class that shouldn't be representable.
  Per-record, not per-"campaign" — Monsters/Locations/Bystanders are M:N to Mystery and can
  deliberately belong to zero mysteries, so Mystery isn't a container.
- **Enforcement: EF Core global query filters, not per-repository `.Where()` clauses.** The decisive
  reason isn't the 85 repository methods — it's that the five `ISearchProvider` implementations hold
  `MotwDbContext` directly and bypass repositories and services entirely, so a repository-layer
  convention would silently leak every search result.
- **Identified a real pre-existing gap the filter alone doesn't close:** ~30 service methods
  (update/delete-by-child-id) have no parent-existence guard and rely only on the repository's
  parent-scoped query. Parent-scoped is not owner-scoped. Enumerated as an explicit work item.
- **Authorization: named policies + a global fail-closed fallback policy**
  (`SetFallbackPolicy(RequireAuthenticatedUser)`) with an explicit `[AllowAnonymous]` list. With 107
  existing actions across six controllers, per-controller `[Authorize]` fails open on the next
  endpoint someone adds. `ReferenceController`'s seven POSTs gate to `DataAdmin`; its seven GETs stay
  open to any authenticated user or every create form in the app breaks.
- **`OwnerId` is set explicitly at the ~8 create call sites, not in a `SaveChanges` interceptor** —
  despite the existing `ApplyTimestamps()` precedent. Timestamps are cosmetic and belong in
  infrastructure; ownership is a security boundary and should be visible where a reviewer reads it.
- **Data Protection key persistence is Phase 0, not Phase 6** (Postgres-backed key ring). Losing the
  ring on restart fails silently as "users keep getting logged out."
- **Flagged a test-type gap:** the existing API suite is entirely unit tests over hand-written fakes,
  which structurally cannot prove ownership isolation. Phase 2 adds
  `Microsoft.AspNetCore.Mvc.Testing` + `CrossOwnerAccessTests`, including a search-endpoint case.

**Why:** Every requirement that constrained the choice pointed the same way — "session" plus "sign out
must actually revoke" rules out stateless bearer tokens; "bare-bones login page matching the current
design" rules out a hosted IdP; "ideal .NET patterns" rules out hand-rolling. The remaining design
freedom was spent on making the ownership enforcement impossible to forget rather than merely correct
today, because ownership is the only part of this feature whose failure is invisible.

**Docs:** `docs/authentication-update/README.md`, `architecture.md`, `data-ownership.md`,
`phases.md`, `open-questions.md`.

---

### 2026-08-08 (revision): All 16 Open Questions Resolved by Skyler — Three Changed the Design
**By:** Yoshi (Architect) — folded in same day

**What:** Thirteen resolutions confirmed the recommended default and were recorded as-is
(same-origin hosting, prod starts empty, per-record ownership, no admin cross-user visibility,
global admin-write reference data with the regression accepted knowingly, Resend + log-only local
sender, NIST password policy, 14-day sliding session with no "Remember me", no account deletion with
`ON DELETE RESTRICT`, env-vars + user-secrets, login never says *why* it failed, theme deferred).
Three went the other way and forced real design changes:

- **#7 — email confirmation is NOT a login gate.** `RequireConfirmedAccount`/`RequireConfirmedEmail`
  both stay `false`. A confirmation mail is still sent and still sets `EmailConfirmed`, but an
  unconfirmed account can sign in and use the app. Skyler read a mandatory confirmation step as 2FA
  and rejected it; their position is that credentials alone should be sufficient to log in. Wrote up
  five concrete consequences rather than a generic caveat, and — the one that actually changed
  another decision — **password reset must stay available to unconfirmed accounts**, because it is
  the *only* reclaim path for an address someone else registered. Also collapsed the login-failure
  enumeration set from four cases to three, since "unconfirmed" is no longer a failure reason.
- **#8 — no super-admin bootstrap mechanism at all.** Dropped the `Auth:SuperAdminEmails` allowlist
  entirely. Roles are assigned by direct `INSERT` into `user_roles`, carried as a claim in the
  encrypted cookie, validated by the `"SuperAdmin"` policy at the controller. `MotwDbInitializer`
  still seeds the three **role rows** (so the `INSERT` has something to reference) but creates no
  users. **The load-bearing addition was documenting the propagation path**, which this resolution
  makes the entire authorization-freshness story: `SecurityStampValidator` regenerates the principal
  from the database once per `ValidationInterval` (30 min, from #11), so a DB role change lands
  within 30 minutes automatically or immediately on re-login; forcing immediate revocation means
  changing the user's `security_stamp`. Wrote this up with its two operational consequences (a
  self-granted role won't appear until re-login; a revoked role persists up to 30 minutes) because
  both otherwise read as bugs.
- **#13 — role management ships *inside* the Data Admin section, super-admin only.** Folded the old
  standalone Phase 5 into Phase 4. Page stays behind `adminMatch` (admin or super-admin); the Users
  panel renders only on `isSuperAdmin()`. Retired the Phase 5 number rather than reusing it, so
  Phase 6 keeps its identity in existing references.
- **#9 — registration capped at 10/day, configurable.** Specified `Auth:Registration:MaxPerDay` in
  `appsettings.json`, bound via `Configure<RegistrationOptions>` and read through `IOptionsMonitor`
  *inside the rate-limiter partitioner* so it changes without a restart. Chose a **global 24h fixed
  window, not per-IP** (a per-IP cap of 10/day is useless against a distributed attacker, and "10 per
  day" reads as an absolute cap at this scale). Contained the self-DoS trade-off by keeping
  login/forgot/reset on separate per-IP limiters, so a burned registration budget never blocks
  existing users. This cap now carries more weight than intended, because under #7 every
  registration is an immediately usable account — it's the only bound on account creation.

**Ambiguity resolved myself:** Skyler's brief said "username + password" but enrollment, reset, and
the Profile view all key off email. Specified **email as the login identifier** (`RequireUniqueEmail`,
`UserName = Email`, `FindByEmailAsync`), on the concrete grounds that **there is no `username` field
anywhere in the codebase** — not in `ApiContracts.cs`, not in `core/models.ts`, not in any template —
and that the super-admin Users panel needs an identifier an operator can recognise when assigning a
role by hand. Flagged in three places for correction before Phase 1 ships the DTOs.

**Why:** The three overridden defaults were all legitimate product calls, so the job was implementing
them faithfully and making their costs visible rather than re-arguing them. The general move worth
repeating: when a stakeholder removes a safety mechanism (#7's confirmation gate, #8's bootstrap
config), find the mechanism that *now* has to carry the load and document it explicitly — here that
was password-reset-as-reclaim-path and security-stamp-revalidation-as-role-propagation, neither of
which was load-bearing in the original design.

**Process added:** a review gate at the top of both `README.md` and `phases.md` — **Boo, Luigi, and
Bowser must all sign off before Phase 0 begins**, with Boo's review explicitly scoped to the #7
unconfirmed-login trade-off and the #8 DB-role/claim-propagation path. Also added an explicit scope
statement (per-user ownership + authentication only) and moved the deferred `environment.ts` /
`angular.json` production-build work into Phase 6, where Skyler will run a separate focused analysis.

**Docs updated:** all five files in `docs/authentication-update/` — `open-questions.md` converted to
a resolved decision record (questions kept, resolutions and rationale recorded), plus propagation
into `README.md` (gate, scope, phase table), `architecture.md` (§1 login identifier, §3 role
assignment + propagation + Data Admin panel, §5 confirmation policy + trade-offs, §7 rate-limit
config), `data-ownership.md` (§6 bootstrap step), and `phases.md` (gate, 33 decisions, Phase 4
absorbs Phase 5, risk register, verification checklist).

---

### 2026-08-08 (correction): Resolution #7 Reverted to the Recommendation; Login Identifier Confirmed
**By:** Yoshi (Architect) — same day, third pass

**What:**
- **#7 corrected: email confirmation IS required before first login** (`RequireConfirmedAccount = true`).
  Skyler's first answer ("not a gate") was a misreading — they were rejecting an emailed code on
  *every* login as a second factor, not a one-time verification at enrollment. **Everything derived
  from the wrong premise was re-derived, not reverted by assumption**, because several of those
  consequences were consequences *of the premise* rather than of the design:
  - The five §5 trade-offs (squatting, forgot-password-as-reclaim-path, data transfer on reclaim,
    junk-account pressure landing on the rate limit, silent typo failure) were deleted outright. The
    gate doesn't mitigate those risks — it removes them from the threat model, which is a different
    claim and deserved different prose.
  - **Password reset for unconfirmed accounts: reversed to "blocked."** Its only justification had
    been "the reclaim path for a squatted address," which died with the premise. Re-decided on
    merits: resetting an unconfirmed account's password still leaves it unable to sign in, it's a
    free mail-sending oracle, and `MapIdentityApi`'s own `/forgotPassword` gates on
    `IsEmailConfirmedAsync` for exactly these reasons. Resend-confirmation is the correct path.
  - **Login enumeration: resolved as four cases, two responses** — the subtle one. Wrong password /
    no such account / locked out stay collapsed per #15; **correct password + unconfirmed gets a
    distinct response.** The exception is safe because it's reachable only *after* the password is
    proven, so it's not an unauthenticated oracle. Lockout deliberately stays collapsed because
    `PasswordSignInAsync` returns `LockedOut` from `PreSignInCheck`, before the password is checked —
    the distinguishing test throughout is "is the password verified before this branch is reached."
    Documented the implementation detail that makes it safe: `NotAllowed` is *also* returned
    pre-password-check, so it must be paired with an explicit `CheckPasswordAsync`; wiring
    `IsNotAllowed` straight through leaks the state for any password.
  - **Registration cap: same conclusion, new primary justification.** "The only bound on usable
    account creation" evaporated (unconfirmed accounts are now inert). Re-derived: the resource at
    risk is outbound email quota and sender reputation, which is a *global* resource, so a global
    limiter is the semantically correct shape. Kept 10/day global, configurable.
  - **Resend-confirmation moved from the Profile page to the unauthenticated side** — under the gate,
    an authenticated user is confirmed by definition, so a Profile affordance would be dead UI that
    can never render a meaningful state. `emailConfirmed` correspondingly dropped from
    `/api/auth/me`. New `[AllowAnonymous]` endpoint + `/resend-confirmation` route, with a per-account
    throttle on top of the per-IP limit (it's an anonymous mail-sender pointed at a caller-named
    address).
  - **New interaction found: #7 x #8.** The gate's real cost is an ordering hazard (broken email =>
    nobody can register, including the owner), and my original mitigation — auto-confirm for
    allowlisted super-admin emails — no longer exists because #8 removed the allowlist. Closed with
    `LoggingEmailSender` locally and a documented `UPDATE users SET email_confirmed = true`
    break-glass in production, sitting next to #8's `SuperAdmin` `INSERT` in the Phase 6 runbook.
  - **Boo's review items updated**: the unconfirmed-login trade-off is replaced by the login
    enumeration exception (plus its `CheckPasswordAsync` implementation detail) and the anonymous
    resend endpoint as a mail-amplification surface. #8's propagation path stays.
- **#17 confirmed by Skyler: email is the login identifier**, no separate username concept —
  "username" had been used loosely for the login identifier. Dropped the "correct me before Phase 1"
  hedge in all three places; recorded as settled.
- **Two new follow-ups recorded with recommended defaults** (`open-questions.md` #18, #19): the login
  page's distinct unconfirmed response as a deliberate exception to #15, and forgot-password's silent
  no-op for unconfirmed accounts. Neither blocks; both are user-visible and both touch a decision
  Skyler already made, so they're surfaced rather than buried.

**Why:** A reverted answer is not a flag flip when downstream reasoning was built on it. The failure
mode to avoid was leaving a half-reversed argument — prose that asserts the gate while still carrying
mitigations, justifications, and UI designed for its absence. Each derived decision was re-opened and
re-argued from the corrected premise; two kept their conclusion with new reasoning (registration cap,
login-never-says-why), two flipped (reset for unconfirmed, resend location), and one net-new
interaction surfaced (#7 x #8's lost bootstrap mitigation).

**Docs updated:** all five files in `docs/authentication-update/` — `architecture.md` (§1 login
identifier confirmed + §5 rewritten + §7 enumeration/rate-limit re-derived + §4/§6 resend relocation),
`open-questions.md` (#7 records both answers and the correction; #15/#17 updated; #18/#19 added),
`phases.md` (gate, 36 decisions, Phase 1/3/4 steps, risk register, checklist), `README.md` (gate,
remaining-decisions section), `data-ownership.md` (§6 account-creation step).
