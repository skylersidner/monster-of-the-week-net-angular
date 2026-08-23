# Authentication & Authorization Update

Design docs for adding authentication, self-service enrollment, per-user data ownership, and a
three-tier role system to Monster of the Week, ahead of putting the app on the public web.

**Status: design complete. All 16 open questions were resolved by the project owner on 2026-08-08
and are folded into these documents — `open-questions.md` is now a resolved decision record, not a
pending list. No application code has been written or modified as part of producing these docs.**

**Two follow-up questions (#18, #19) were opened by the correction to #7 and are also resolved —
#18 confirmed as recommended, #19 overridden by the owner.** See "Resolved follow-ups" below.
**There are no open questions remaining**, and no review item is outstanding with the owner — the one
sub-recommendation that was referred back (a `UrlTree`-returning guard) was ruled on 2026-08-15 and
the decline stands, with the reasoning recorded in `architecture.md` §6.

> ## Review gate — implementation may not begin until all three sign off
>
> **Boo** (Web Security Specialist), **Luigi** (Frontend Developer), and **Bowser** (Backend
> Developer / DevOps) must each review this plan before Phase 0 starts.
>
> ### ⏳ Luigi's review — four blocking findings resolved (2026-08-15); his non-blocking findings and 10 questions are still with the owner
>
> **All four were gaps between a requirement stated in one section and the wiring that would
> implement it in another — nothing in the design was wrong, four things were unreachable, and two of
> them fail silently.** Adopted: `AuthService.initialize()` now fetches the CSRF token alongside
> `/api/auth/me` (without it *nothing* fetched it and login was impossible as specified); the auth
> shell gains an empty-path child (without it logged-out `/` and every unknown URL failed to route at
> all); the dev proxy forwards `/health` as well as `/api` (without it `ng serve` answers the
> liveness probe with `index.html` and a 200, so the API-unavailable modal is silently dead); and
> **new decision #37** — `/api/auth/*` failures return `400` with a `code`, `401` is reserved for
> "your session is gone," and both error interceptors skip `/api/auth/` — without which
> `authErrorInterceptor` would have swallowed the login failure and **resolution #18 would silently
> not have shipped**. One sub-recommendation (`authenticatedMatch` returning a `UrlTree`) was
> **declined** — it would create the infinite redirect it was meant to avoid — and the owner
> confirmed the decline on 2026-08-15. See **`open-questions.md` → "Luigi review dispositions"**.
>
> **Still open from Luigi's review:** his non-blocking findings (8 rework items, several convention
> notes) and **10 questions for the owner**, covering among other things the mid-session-expiry
> experience, whether the app auto-refreshes auth state, where toasts and the icon sprite live once
> there are two shells, and whether non-admins get any acknowledgement that reference data became
> admin-only (resolution #5). **These have not been dispositioned. Bowser is also still outstanding.**
>
> ### ✅ Boo's review is complete (2026-08-09)
>
> **Verdict: broadly sound. No finding changed the design's shape.** Boo agreed with all four flagged
> items below and confirmed resolution #19 enables nothing unintended. His findings are folded into
> these documents; **`open-questions.md` → "Boo review dispositions"** records what was adopted and
> the five recommendations the owner declined (response security headers, registration-cap changes, a
> global mail-quota cap, "sign out everywhere", and the `__Host-` prefix), each with reasoning.
>
> The highest-severity items he found, none of which were in the original four: `options.Events`
> replacement silently disabling security-stamp validation; antiforgery tokens being identity-bound so
> every write fails after login; query filters on the roots alone leaving child and bridge entities
> exposed (three verified live examples); and the login snippet leaving unconfirmed accounts with no
> brute-force lockout.
>
> The four items originally flagged for him, all confirmed sound:
>
> - **The login endpoint's account-enumeration exception.** Restoring the email-confirmation gate
>   (resolution #7) reintroduces a "correct password, unconfirmed account" case. This design returns
>   a **distinct** response for it, against the general rule in resolution #15 that login never says
>   why it failed — on the reasoning that the branch is reachable only *after* the correct password
>   is supplied, so it is not an unauthenticated oracle. `architecture.md` §7 works this through,
>   including the `PasswordSignInAsync` → `NotAllowed` → `CheckPasswordAsync` implementation detail
>   that is easy to get wrong and would leak the state for *any* password. It also covers the
>   anonymous `resend-confirmation` endpoint as an outbound-mail amplification surface.
> - **The outbound-mail throttle's key, after the #19 override.** Forgot-password on an unconfirmed
>   account now sends a confirmation mail, so **two endpoints produce the same mail**. The throttle is
>   keyed on `(purpose, userId)` rather than `(endpoint, userId)` specifically so the two cannot be
>   alternated to double the rate against one address. Adding a fourth mail-producing path later
>   without registering it against the right purpose silently reopens the bypass. `architecture.md` §7.
> - **Revocation is not instant, by design.** There is no session store — the encrypted cookie *is*
>   the session. Sign-out ends the session server-side, but a cookie **copied beforehand** stays valid
>   until its own expiry; the only true kill switch is bumping `security_stamp`, which sign-out
>   deliberately does not do (it would log the user out on every device). Review whether that residual
>   window is acceptable given `HttpOnly` + `Secure` + `SameSite=Lax` + HSTS. `architecture.md` §1.
> - **Resolution #8 — there is no super-admin bootstrap mechanism.** The first super-admin role is
>   assigned by direct database manipulation. The role travels as a claim inside the encrypted
>   session cookie and is validated at the controller level. `architecture.md` §3 documents how a
>   role changed in the database reaches a live session, which is now the *only* propagation path.
>
> This satisfies — and extends — the `security-review` ceremony defined in `.squad/ceremonies.md`,
> which triggers here on all three of its stated conditions.

## Scope

**The focus of this update is to make separate per-user data ownership possible, and to add
authentication. Anything beyond that is out of scope.**

Deliberately out of scope: MFA/2FA, social or SSO login, sharing/collaboration features, a
campaign-or-container concept, per-user reference data, self-service account deletion, audit
logging, and per-user server-side theme storage (theme preference stays in `localStorage` exactly as
it is today — resolution #16).

## Starting point

The app today has **zero** authentication or authorization anywhere: no `[Authorize]` attribute, no
`Microsoft.AspNetCore.Authentication.*` package reference, no Angular guard, no login UI, and every
row in every table is globally visible and globally writable. This is a from-scratch design, not a
retrofit onto a partial implementation.

## Documents

- **`architecture.md`** — the design itself. Auth mechanism decision (ASP.NET Core Identity + cookie
  session) with the rejected alternatives and why; the hosting-topology decision that the cookie
  design depends on; the authorization model (roles vs. claims vs. policies, fallback policy,
  database-assigned roles and how they propagate); enrollment/password-reset flows including the
  outbound email dependency and the confirmation gate; the Angular integration (shells, guards,
  signal-based auth state, interceptors, 401/403 handling, Profile/Sign-out rework); and the
  security considerations (CSRF, password policy, lockout, the login-enumeration exception, rate
  limiting, Data Protection keys, secrets, HTTPS/HSTS, CORS).
- **`data-ownership.md`** — requirement #3 in full. A per-entity classification of all 31 entities
  into owned / derived / bridge / reference, the enforcement mechanism (EF Core global query filters
  plus a verified service-layer chokepoint), the migration path for the existing unowned local data,
  cascade behaviour on user deletion, and the admin-visibility decision.
- **`phases.md`** — the phased implementation plan in this repo's standard phase-doc format: the
  review gate, resolved decisions, the phases with file-level detail, risk register, and a
  verification checklist. Includes the test-strategy gap this feature exposes.
- **`open-questions.md`** — **all 16 questions with the owner's resolution recorded against each**,
  plus the two follow-ups the #7 correction opened. Kept as a decision record so the reasoning
  survives.

## Recommendation in one paragraph

Use **ASP.NET Core Identity with cookie authentication and hand-written API controllers** — Identity
for the parts you must never hand-roll (password hashing, lockout, email-confirmation and
password-reset token providers, the user/role store), hand-written controllers for the HTTP surface
so it matches this codebase's existing controller → service → repository → `ServiceResult<T>`
conventions. Reject `MapIdentityApi<T>()`: it has **no logout endpoint**, which directly contradicts
requirement #7. Reject an external IdP: the requirement for a bare-bones in-app login page matching
the current design conflicts with a hosted redirect flow, and it adds an ops dependency a single-GM
hobby app does not need. **Serve the built Angular app from the API host so the cookie is
first-party** — this removes CORS entirely, makes `SameSite=Lax` viable, and lets Angular's built-in
XSRF support work (it only attaches the CSRF header on same-origin requests). Bind data to users
with an `owner_id` column on exactly **four** entities (`Mystery`, `Monster`, `Location`,
`Bystander`), enforced by **EF Core global query filters** rather than per-query `.Where()` clauses,
because the query filter also covers the five `ISearchProvider` implementations that query
`MotwDbContext` directly and would otherwise be a silent cross-user leak.

**Accepted trade-off:** a single-origin deployment couples the SPA's availability to the API's (an
API restart takes the UI down, and there is no CDN in front of the static assets). For an app with
one owner and a handful of users that is a good trade for eliminating the entire class of
cross-site-cookie, CORS-credentials, and third-party-cookie-deprecation problems.

## Resolved follow-ups

Everything from the original 16 is settled. The correction to #7 (email confirmation is a login gate
after all) opened two follow-ups, **both now resolved by the owner:**

- **#18 — CONFIRMED as recommended.** The login page tells a user with correct credentials that their
  email is unconfirmed — a deliberate exception to "login never reveals why it failed" (#15). Safe
  because the branch is reachable only *after* the password is proven; collapsing it would produce a
  dead end where a user typing the right password is told it's wrong. `open-questions.md` #18,
  `architecture.md` §7.
- **#19 — OVERRIDDEN.** The recommendation was for forgot-password to silently do nothing for an
  unconfirmed account. The owner chose the friendlier alternative: it now sends a **fresh confirmation
  link** instead, because the silent success was a dead end — success message, no mail, no way to
  discover why. Enumeration safety is unaffected; the response is byte-identical across all three
  branches, and the user learns which branch ran only from the mail. **Reset itself stays blocked** —
  no reset token is ever issued to an unconfirmed account. `open-questions.md` #19,
  `architecture.md` §5.

## Phase summary

| # | Phase | Risk |
|---|-------|------|
| 0 | Identity foundations — `AppUser`/`AppRole`, `MotwDbContext : IdentityDbContext<...>`, snake_case table mapping, migration, Data Protection key persistence, role-row seeding. No endpoints, no gating. | Medium |
| 1 | Auth endpoints + cookie session — register/login/logout/me, confirm-email, resend-confirmation, forgot/reset password, change password; `IEmailSender` with a log-only local implementation; password policy, lockout, rate limiting, antiforgery; global fallback authorization policy. | Medium |
| 2 | **Data ownership** — `owner_id` on the four owned roots, `ICurrentUser`, global query filters, ownership assignment on create, cross-owner link guards, backfill, NOT NULL migration. | **High** |
| 3 | Angular auth shell — **same-origin dev loop first** (`proxy.conf.json` forwarding **`/api` *and* `/health`** + `apiBaseUrl: ''`, without which Angular's XSRF interceptor skips the cross-origin API and auth cannot be tested locally), then unauthenticated `AuthLayoutComponent` + login/register/forgot/reset/resend/confirm pages **plus an empty-path child redirecting to `login`**, `AuthService` (signals, with a `csrf` + `me` bootstrap), `credentialsInterceptor`, `authErrorInterceptor`, `authGuard` via `canMatch`. | Medium |
| 4 | Profile + user menu rework + Data Admin gating **+ the super-admin Users panel** — `/profile` page, real Sign out, `adminGuard`, nav-item hiding, `[Authorize(Policy = "DataAdmin")]` on reference-data writes, and role management as a super-admin-only panel inside the existing Data Admin page (resolution #13). | Low |
| 5 | *(no longer a standalone phase — role management folded into Phase 4 by resolution #13; the number is retired rather than reused so Phase 6 keeps its identity in existing references)* | — |
| 6 | Deployment configuration — single-origin hosting, cookie/CORS/HSTS/forwarded-headers config, secret storage, the real Resend email sender, and the **remaining** frontend build work (`environment.prod.ts` + `angular.json` `fileReplacements` + the `ng build` → `wwwroot` publish step; the dev-loop half moved up to Phase 3). **The owner will do a separate focused analysis and plan for this phase before deploying.** | Medium-High |

Phases 0–4 are intended to land on a feature branch; **nothing is publicly deployed until Phase 6.**
That removes a lot of otherwise-artificial sequencing constraints (e.g. the API is briefly
fail-closed before the Angular app knows how to log in, which is fine on a branch and would not be
fine in production).
