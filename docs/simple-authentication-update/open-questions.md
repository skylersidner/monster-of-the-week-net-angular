# Simple Authentication — Resolved Decisions

**Status: RESOLVED. All six questions have been answered by the project owner.** #1–#5 on 2026-08-18 —
the original four in the design round, and #5, opened by Luigi's frontend review later the same day and
answered in the same round. **#6** was raised by Bowser's backend/DevOps review on 2026-08-19 and
answered on **2026-08-23**, after the owner supplied an already-deployed app of theirs (`portfolio`) as
reference material for the comparison. **Nothing in this document is still open.** See "Luigi review
dispositions" and "Bowser review dispositions" at the foot of this file.

This file was the pending-questions list; it is now the decision record. Every question is kept, with
the resolution and the reasoning recorded against it, so the *why* survives past the conversation that
produced it. `README.md`, `architecture.md`, and `phases.md` have been updated to match — this file is
the audit trail, not a second source of truth.

**Five of the six resolutions confirmed the recommendation. One did not** — #1 — and it changed the
design rather than just a constant. **#4 did not exist when the first draft was written**; it was
raised by the answers to #1–#3 and resolved in the same round. **#5 and #6 did not exist until the
design was reviewed**; #5 was opened by Luigi's frontend review and resolved the same day, and #6 by
Bowser's backend review. **#6's resolution confirmed the recommended option and then improved on it**,
because the reference app the owner supplied turned out to solve the same problem more simply than the
review had priced.

---

## Resolutions

| # | Question | **Resolution** | Against the recommendation? |
|---|---|---|---|
| 1 | Login identifier — `username` or `email`? | **Email, and only email.** | **Yes — overrode `username`.** |
| 2 | Is Sign out in scope for this pass? | **Yes, in scope.** | No — confirmed. |
| 3 | Does existing local game data need to reach production? | **No. Explicitly out of scope, deferred to the owner's discretion.** | N/A — no recommendation was offered. |
| 4 | Is a 24-hour sliding session long enough, given the app has no draft persistence? | **Yes, keep 24 hours unchanged.** The draft-loss consequence is knowingly accepted. | No — confirmed. |
| 5 | *(opened by Luigi's review, 2026-08-18)* How far do we take moving the icon sprite, toast host and API-availability modal out of `PageLayoutComponent`? | **Option A — the full move, to `App`.** *"I will take Luigi's recommendation; app root level is fine."* | No — confirmed. |
| 6 | *(opened by Bowser's review, 2026-08-19)* Does the `ng build` → `wwwroot` step live in a script run before `dotnet publish`, or in an MSBuild target so `dotnet publish` is self-sufficient? | **A, sharpened — `angular.json`'s `outputPath` writes straight into `wwwroot`, the `.csproj` is untouched, and the sequencing is a repo-root multi-stage `Dockerfile` deployed to Railway, mirroring `portfolio`. Docker for shipping only; `ng serve` + dev proxy stays the development loop.** Resolved 2026-08-23. | No — confirmed, and simplified beyond what was recommended. |

---

## 1. Login identifier — **RESOLVED: email** *(overrode the recommendation)*

> *"Email should be the decided field name and value being stored in the DB. The email IS the username,
> always."*

**The recommendation was `username`** — on the reasoning that the owner had asked for "username and
password," and that the robust plan's email decision was justified by enrollment, password-reset, and
Profile flows that do not exist in this pass.

**The override is the better call, and the reason is worth recording rather than just the outcome.**
The recommendation optimised for matching the words of the request; the owner optimised for *not
building the same screen twice.* `docs/authentication-update/` resolution #17 / decision #6 had already
settled on email, so choosing `username` here would have made this the **only** point of conflict
between the two designs — and every one of the four artefacts that would have had to change later
(`LoginRequest`, `CurrentUserResponse`, the login form control and label, `AuthService.login()`) sits on
the *contract* boundary, which is where churn is most expensive. **Weight a divergence by which layer
it lives in, not by how many lines it is.**

**What this changed in the design:**

- `app_users` column is `email` with a unique index, not `username` (`architecture.md` §1.2).
- `LoginRequest(string Email, string Password)`; `CurrentUserResponse(Guid Id, string Email)`.
- `IUserRepository.FindByEmailAsync`, comparing case-insensitively — the row is typed by hand, so
  "inserted `Skyler@…`, typed `skyler@…`" would otherwise be a login failure with nothing to read.
  Normalisation, not validation; it does not breach the no-validation instruction.
- The login form gets an `email` control with `type="email"` — free, and not validation either, because
  Angular's `FormGroupDirective` puts `novalidate` on the host form so HTML5 constraint validation
  never blocks submit. The only effect is the right keyboard on a phone.
- **No `[EmailAddress]` attribute and no `Validators.email`.** A malformed address simply matches no
  row — same outcome by a shorter path.
- **The forward-compatibility table lost a row and gained two.** `architecture.md` §5.2's "login
  identifier" row is deleted; §5.1 now carries the login contract, the login component, and the issued
  claim set (`ClaimTypes.Name` = email, which is what Identity produces too, since the robust plan sets
  `UserName = Email`) as carrying forward untouched.

**There is now no conflict anywhere between this design and `docs/authentication-update/`.**

---

## 2. Sign out — **RESOLVED: in scope** *(confirmed the recommendation)*

> *"Yes, Sign out is in scope. We will need it for when a session expires and it's easy enough to
> enable a UI button to do expire it manually/intentionally."*

Ships as designed: `POST /api/auth/logout` (~6 lines) plus wiring the already-present dead
`<a href="#">Sign out</a>` at `page-layout.html:111` to `AuthService.logout()`. It carries forward into
the robust plan unchanged.

**One clarification the owner's phrasing invites, now stated explicitly in `architecture.md` §3.4.**
"For when a session expires" and "a UI button to expire it manually" are **two different mechanisms**,
and both are in the design:

- **Automatic**, when a session lapses on its own — `authErrorInterceptor`'s `401` branch clears the
  auth signal and bounces to `/login`. No button involved. Nothing to click, because by definition the
  user finds out when something else fails.
- **Manual**, the Sign out button — an intentional end to a live session, which is what makes the app
  safe to use on a borrowed machine.

**And one implementation detail that is easy to get wrong, because the two mechanisms interact.**
`POST /api/auth/logout` is an authenticated endpoint, so clicking Sign out on an *already-expired*
session returns `401` — and **both** interceptors skip `/api/auth/` by design (`architecture.md` §1.4),
so neither one will handle it. That is correct, but it means `AuthService.logout()` **must clear the
signal and navigate from its `error` path as well as its `next` path**, or Sign out silently does
nothing in exactly the situation the owner named. Called out at `phases.md` Phase 2 step 11 rather than
left to whoever writes it.

---

## 3. Existing local game data — **RESOLVED: out of scope**

> *"Existing local data doesn't need to reach production. I can recreate what few objects are in the
> DB now, or come up with a migration plan later if I decide it's worth it."*

**No data-migration step exists anywhere in this plan, and that is a decision rather than a gap.**
Production starts with the seeded lookup tables only — `MotwDbInitializer.SeedLookupTablesAsync` runs on
every startup, so adventure types, monster archetypes, monster/minion/location/bystander types, and
weapon tags are all present from first boot. Mysteries, monsters, minions, locations, and bystanders
start empty and get recreated by hand.

**One fact worth carrying forward if the owner later decides it *is* worth it:** the robust plan's
Phase 2 adds a `NOT NULL` `owner_id` to four tables, after which importing unowned rows needs a backfill
step. Moving data *before* that lands is materially simpler than moving it after. Recorded in
`architecture.md` §4.3 as a note for the deferred infrastructure pass, not as an action item here.

---

## 4. Session lifetime — **RESOLVED: 24 hours, unchanged** *(confirmed the recommendation)*

> *"24 session is good. I'm unconcerned with draft persistence during mystery creation. What's lost is
> lost, and since I'm the only one using it, I'm aware of it."*

`ExpireTimeSpan` stays at **24 hours with `SlidingExpiration`**, copied verbatim from the robust plan's
decision #27 so it carries forward untouched. No configuration change, no code impact.

**The consequence is accepted, not absent, and it stays in the risk register on that basis.** This app
has no draft persistence anywhere — `MysteryCreateStore.init()` reads a route-snapshot `:id` once and
there is no `localStorage`/`sessionStorage` draft save — so a session lapsing with the create wizard
open loses whatever was typed into the current phase. That gap is **pre-existing** (a plain browser
reload loses the same work today, and has since the wizard shipped) and is not introduced by this
design; adding a session expiry simply adds a second way to trigger it. The owner is aware and has
accepted it, so it is **not** something for a later phase to design around — no draft-persistence work
should be proposed on the strength of this row.

The trade the other way is worth recording too: a longer window would mean a proportionally longer life
for a copied cookie, and that matters more here than in the robust plan because **this pass has no
revocation mechanism at all** (`architecture.md` §1.6). 24 hours is the conservative end of the range,
not an arbitrary default.

---

## 5. App-wide shell concerns — **RESOLVED: option A, the full move to `App`** *(confirmed the recommendation)*

> *"I will take Luigi's recommendation; app root level is fine."*

**Raised by Luigi's review on 2026-08-18 and resolved by the owner the same day.** It was not a design
question — it was a scope question, and the only one the review could not settle on its own, because it
was the largest single edit the review recommended and the only one touching a file Phase 2 does not
otherwise open.

**Decided: `<app-icon-sprite />`, the notification toast host, and the API-availability probe + modal
all move out of `PageLayoutComponent` and up to `App`.** `architecture.md` §3.5 and `phases.md`
decision #20 / Phase 2 step 10b now state this as settled rather than as a choice. Options B (sprite
only) and C (nothing moves) are recorded below as rejected, not as fallbacks.

**Two consequences of the answer, both already reflected in the docs and worth stating so neither gets
re-opened as a question:**

1. **The interceptor-ordering fix (`architecture.md` §3.3, decision #19) is not optional under this
   answer, and it is already unconditional.** It was adopted as a blocking finding in its own right, so
   nothing about it was ever contingent on this question — but the dependency runs one way and matters:
   the `401`-toast bug is masked *today* only because the toast host sits inside the shell being torn
   down on the bounce to `/login`. Hoisting the host to `App` removes the mask. Ship the move without
   the ordering fix and every session expiry paints the login page with a stack of
   `Request failed (401) for GET /api/…` toasts, one per in-flight request. **They land together, in
   Phase 2.**
2. **The generic login-error fallback (`architecture.md` §3.4) stays mandatory anyway.** It was
   *additionally* justified as the minimum answer if this question had gone the other way, and that
   framing is now moot — but the finding itself never depended on it. Both interceptors skip
   `/api/auth/` by design, so the login component remains the only error surface for the login POST
   regardless of where the toast host lives, and the API-unavailable modal does not fire on a *submit*
   failure in any case.

**What the answer restores.** With the probe on `App` it runs for logged-out visitors too, so
`architecture.md` §2.2's original stated symptom for a missing `/health/live` `[AllowAnonymous]` — a
permanent "API unavailable" modal covering the login page — becomes true again, and Phase 2's
*"stop the API and confirm the modal appears"* check becomes performable. That check is the **only**
detector for the silent `/health` dev-proxy gap, itself an inherited blocking finding from Luigi's
review of the robust plan, so this answer is what keeps that finding verifiable rather than merely
documented.

**And one thing it settles for the robust plan.** *"Where do toasts and the icon sprite live once there
are two shells"* is one of the ten questions from Luigi's review of `docs/authentication-update/` still
sitting undispositioned with the owner. This answer resolves it by construction — the robust plan lands
the identical two-shell structure in its Phase 3 and will inherit the hoist already done. **That
question can be closed there as answered here.**

---

The options as they were presented, kept for the record:

`architecture.md` §3.5 has the finding in full. Short version: three application-wide things live inside
`page-layout.html` because there has never been a second shell — `<app-icon-sprite />` (line 2, the only
occurrence in `src/`), the toast host (lines 130–150), and the API-availability probe + modal
(`page-layout.ts:44–46`, template lines 152–181). The moment the auth shell exists, the login page has
none of them: an `<app-icon>` there renders blank with no error, a toast renders nowhere and
auto-dismisses after 4 s, and the API-unavailable modal can never appear for a logged-out visitor —
which also removes the only detector for the silent `/health` dev-proxy gap that Phase 2 introduces.

**The recommendation is the full move: all three to `App`.** `app.html` is a bare `<router-outlet />`
and `app.ts` is an empty class, so it is a template move plus one `ngOnInit`. Three tests relocate from
`page-layout.spec.ts` (lines 42, 108, 117) into a new `app.spec.ts` with their mock and assertions
unchanged. The sprite belongs at `App` by its own documentation. And the robust plan lands the identical
two-shell structure in its Phase 3 and hits the identical problem — *"where do toasts and the icon
sprite live once there are two shells"* is one of the ten questions from Luigi's review of that plan
still sitting unanswered with the owner — so doing it here answers it by construction and costs less
than doing it later.

**The question was whether that is more than this pass should touch**, given the standing "minimum
necessary to ship" instruction — it was the largest single edit the frontend review recommended and the
only one changing a file Phase 2 does not otherwise open. **Answered: it is not too much. Option A.**

The three options as they were put, in decreasing size:

| Option | What ships | What is lost |
|---|---|---|
| **A — full move** ✅ **CHOSEN** | Sprite + toasts + health modal on `App` | Nothing. ~55 lines out of `page-layout.html`, three tests relocated |
| **B — sprite only** | `<app-icon-sprite />` on `App`; toasts and health modal stay in `PageLayoutComponent` | The login page still has no API-down signal; Phase 2's "stop the API, confirm the modal" check must be rewritten, and the `/health` proxy rule keeps no direct verification. **Rejected** |
| **C — nothing moves** | As originally designed | B's losses, plus: `AuthLayoutComponent` must import `IconSpriteComponent` itself, so the "one app-wide sprite" invariant quietly becomes two, and every future auth page inherits that. **Rejected** — the one option leaving a silent failure (a blank-rendering icon) rather than an accepted absence |

---

## 6. Where the `ng build` → `wwwroot` publish step lives — **RESOLVED: `outputPath` into `wwwroot`, sequenced by a Dockerfile on Railway** *(raised by Bowser's review 2026-08-19; resolved 2026-08-23)*

> **The decision:** point `angular.json`'s `outputPath` straight at `wwwroot` (with `"browser": ""` to
> flatten the subfolder), make **zero** changes to `MonsterOfTheWeek.Api.csproj`, and sequence the build
> with a **repo-root multi-stage `Dockerfile` deployed to Railway** — `portfolio`'s shape, adopted with
> four non-cosmetic adaptations. The build is never committed and never leaks into an image: `wwwroot/`
> is excluded by **both** `.gitignore` and `.dockerignore`. **Docker is for shipping only — the local
> development loop stays `ng serve` + the dev proxy, with no `docker build` in it.**

**Not a design question — a build/process question, and the only one Bowser's review could not resolve
on its own**, because the answer depended on a deployment decision `architecture.md` §4.3 has
deliberately deferred.

### What was asked

`phases.md` Phase 3 step 5 originally offered *"`.csproj` or a small script"* as equal options. They are
not equal: **the `.csproj` option, written the obvious way, fails silently.** The Web SDK globs
`wwwroot/**` into the `Content` item group at MSBuild *evaluation* time, so a target that *populates*
`wwwroot` during the build creates files that were never in that item group and are therefore never
published. The app deploys with no SPA at all, starts cleanly, passes a health probe, and `404`s every
route including `/login`. Two options were priced — **A**, a script run before `dotnet publish`
(recommended), and **B**, an MSBuild target adding files to `ResolvedFileToPublish` from
`AfterTargets="ComputeFilesToPublish"` so that `dotnet publish` alone is sufficient.

### How it was resolved — the `portfolio` comparison

The owner pointed at **`portfolio`**, an already-deployed app of theirs, as reference material. It was
examined read-only and it is genuinely the same stack: **Angular + ASP.NET Core 10 + Postgres, single
origin**, `Microsoft.NET.Sdk.Web`, `Npgsql.EntityFrameworkCore.PostgreSQL 10.0.0`, a `.slnx` holding
only the .NET project. It deploys to **Railway from a repo-root multi-stage `Dockerfile`** (its git
history shows Railway's Nixpacks auto-detection being abandoned for exactly this reason — it could build
the .NET project but not the combined Angular+.NET build).

**Two findings decided this:**

1. **`portfolio` is option A, not option B.** Its `Portfolio.Api.csproj` contains **zero** SPA-related
   MSBuild targets — the same three-line Web SDK shape this repo has. Publishing works purely on the
   stock glob, because `npm run build` completes in a separate process before `dotnet publish` is
   invoked; its Docker stage boundary is just the sequencing mechanism. That is direct confirmation of
   the finding: the working pattern is "populate `wwwroot` in a step that has fully finished before
   MSBuild evaluates the project."
2. **It does it better than option A as originally written.** `portfolio`'s `angular.json` carries
   `"outputPath": { "base": "../backend/Portfolio.Api/wwwroot", "browser": "" }`, so `ng build` writes
   *into* `wwwroot` and **there is no copy step at all.** That is strictly simpler: it removes the copy,
   removes the clear-before-copy step (the builder's `deleteOutputPath` defaults to `true`, so each
   build wipes the directory itself and `outputHashing: "all"` cannot accumulate stale bundles), and
   leaves the `.csproj` untouched — which is precisely what makes the MSBuild timing trap unreachable.

**The build mechanism transferred immediately. The sequencing followed once the owner confirmed
deployment.** An intermediate version of this resolution had the two commands run by hand, on the
grounds that this repo had no Dockerfile or CI to carry them. **The owner then confirmed the actual
plan — Railway with a Dockerfile, mirroring `portfolio`** — so that framing is superseded: the
container path is not hypothetical, and `portfolio`'s stage-boundary sequencing is adopted directly.
This is exactly the move the comparison said would be available at no rework, taken immediately rather
than later.

### The Dockerfile — `portfolio`'s shape, four adaptations that matter

Full annotated version in `architecture.md` §4.2 item 2a. Three stages: `node` builds the SPA into
`wwwroot`, `dotnet/sdk` publishes the API, `dotnet/aspnet` runs it. **Do not copy `portfolio`'s
verbatim:**

| Adaptation | Why |
|---|---|
| **`node:26-alpine`, not `node:22-alpine`** | `.nvmrc` pins `26.5.0` and `package.json` declares `"engines": { "node": ">=26.5.0 <27" }`. Angular 22 needs it; `portfolio` is on Angular 21 and Node 22 |
| **This repo's deeper paths** — `src/web/monster-of-the-week-web/` and `src/api/MonsterOfTheWeek.Api/` | `portfolio` is a flat `frontend/` + `backend/`. The relative `outputPath` becomes `../../api/MonsterOfTheWeek.Api/wwwroot` |
| **`ASPNETCORE_HTTP_PORTS=${PORT:-8080}` in the runtime `CMD`** | Railway assigns the port at runtime. `portfolio` learned this the hard way — `180cafb Updating Docker config to force correct port for Railway` |
| **`dotnet publish` targets the API `.csproj`, never `MonsterOfTheWeek.slnx`** | The solution also contains `MonsterOfTheWeek.Api.Tests`; publishing it would drag the test project and its SQLite package into the image. `portfolio` has no test project and never had to think about this |

One deliberate **simplification** over `portfolio`: its stage 1 copies the whole backend tree in
(`COPY backend/ ../backend/`) and stage 2 copies it back out, purely so the relative `outputPath`
resolves. That is unnecessary — `ng build` creates the output directory itself — so stage 1 here carries
only the frontend, and stage 2 takes **just `wwwroot`** from it. The Node stage never carries C# source.

### The build is never committed, and never leaks into an image

Two ignore entries, both anchored to `src/api/MonsterOfTheWeek.Api/wwwroot/`, and they do **different**
jobs:

- **`.gitignore`** keeps built assets out of git history.
- **`.dockerignore`** keeps a **stale local build** out of the image build context, so what ships is
  always what the frontend stage just produced rather than whatever a developer last had on disk.
  `portfolio` carries exactly this entry for exactly this reason — and, notably, **does not** gitignore
  its own `wwwroot` (verified with `git check-ignore`). That gap is not copied here.

This also largely defuses the `npm run watch` hazard below: the image is built in a clean context from a
fresh `npm run build`, so a stray local development build cannot reach production through the
Dockerfile. The residual exposure is a *hand-run* `dotnet publish`, plus local confusion.

### What `portfolio` is *not* a reference for

Worth recording, because the temptation to copy more of it will exist. **`portfolio` has no
authentication, no cookies, and its SPA makes no HTTP calls at all** — grepped for `HttpClient` and
`fetch(`, zero hits. Its "single origin" is really just "ASP.NET serves a static Angular bundle." It
therefore exercises none of the auth-side Phase 3 work: no fallback authorization policy, so no
`.AllowAnonymous()` on `MapFallbackToFile`; no `/api/{**rest}` catch-all; and **no `UseForwardedHeaders`
anywhere**, which it gets away with only because it has no `Secure` cookie to refuse and because it
inverts the usual pattern by calling `UseHttpsRedirection()` in *Development only*. None of that
transfers, and none of it weakens `architecture.md` §4.2 item 5 — this design's
`CookieSecurePolicy.Always` reads `Request.Scheme`, and `portfolio` has nothing analogous. **The Railway
confirmation makes that finding urgent rather than theoretical** — Railway terminates TLS at its edge
and forwards over plain HTTP from a non-loopback address, which is the exact configuration in which the
defaulted `KnownProxies` list silently discards `X-Forwarded-Proto`. Of the three blocking findings in
the review, that is the one that would have bitten on the very first deploy.

Two other things `portfolio` gets to ignore that this project cannot: its `railway.toml` sets
`healthcheckPath = "/healthz"`, which **must not** be copied (this app's path is `/health/live`, and a
near-miss is answered by the SPA fallback with `200 text/html` forever); and it does **not** gitignore
its own `wwwroot`, which this plan does and should keep doing.

### The local development loop — settled at the same time

**The owner confirmed 2026-08-23 that Docker is *not* wanted for local development**, the
rebuild-and-rerun cost of `docker build` per change being the explicit objection. Since "a watch" is
ambiguous between two very different loops, it is settled here rather than left to interpretation.
`architecture.md` **§4.4** carries it in full.

**`ng serve` + the dev proxy is *the* development loop, and it needs no new work** — it is already
Phase 2 step 1. `docker compose up -d postgres`, `dotnet run`, `npm start`, browse
`http://localhost:4200`. It is the only option with real hot-reload; authentication works end to end in
it, because the proxy makes the browser see one origin so the cookie is first-party and
`SecurePolicy=SameAsRequest` issues it over plain HTTP; and it exercises the fallback policy on all 107
controller actions plus the `/api/{**rest}` catch-all, since `/api/*` is forwarded verbatim.

**`npm run watch` is explicitly *not* the answer**, and it is worth being blunt because it is the
obvious-sounding candidate. It is **worse at the job** — a full build to disk per change with **no
browser refresh**, so slower feedback *and* a manual reload — and it is the one thing made **dangerous**
by this resolution, writing an unoptimised development build into `wwwroot` and deleting the production
build via `deleteOutputPath`. `ng serve` strictly dominates it. There is no scenario in this design
where reaching for it is correct.

**The genuine gap `ng serve` leaves is real but is a check, not a loop.** The dev server answers deep
links with its own history fallback, so it cannot exercise `MapFallbackToFile`, its `.AllowAnonymous()`,
or `UseStaticFiles` — which is exactly where §2.3's "unrecoverable bootstrap deadlock" would hide.
**That is already covered by Phase 3's existing verification step** (one-shot `npm run build`, stop
`ng serve`, `dotnet run`, browse `http://localhost:5225`, hard-refresh a deep link signed in *and* out).
It is deliberately a pre-ship check rather than a watch loop, needs no Docker and no new tooling, and
**a `dotnet watch` + `ng build --watch` variant of it was considered and rejected**: it would reintroduce
the `wwwroot`-clobbering hazard to buy live-reload for something you run when you are about to deploy,
not while iterating. Two footguns in that check are documented in §4.4 (a `Secure` cookie over
`http://localhost` — fine in Chrome and Firefox, which treat localhost as trustworthy — and using the
`http` launch profile so `UseHttpsRedirection` stays a no-op).

**Unchanged by all of this:** the build must **never** be bound to `Build`
(`MonsterOfTheWeek.Api.Tests` has a `ProjectReference` to the API, so every `dotnet test` would run a
full Angular production build and require Node `>=26.5.0 <27`). With no `.csproj` change at all, that is
true by construction rather than by discipline.

### What changed in the docs

- `phases.md` Phase 3 step 5 rewritten: the `outputPath` key, the `.gitignore` **and `.dockerignore`**
  entries, the new repo-root `Dockerfile`, and no `.csproj` change. The copy and clear-before-copy steps
  are gone entirely.
- `phases.md` Phase 3 step 7's runbook note now covers the **development loop** and **how a deploy
  happens** (push to the Railway-connected branch), with the two hand-run commands kept only for the
  local single-origin check.
- `phases.md` Phase 3's "not in this phase" list **reduced** — hosting, TLS, CI/CD and where Postgres
  lives are settled by the Railway decision; domain, database access for the credential row, backups
  and the environment variables remain.
- `architecture.md` §4.2 item 2 rewritten, **new item 2a** carrying the annotated Dockerfile, §4.2
  item 5 gains the Railway confirmation, §4.3 rewritten to separate settled from still-open, and
  **new §4.4** for the development loop.
- Risk register: the MSBuild-timing row is **closed by construction**; the `npm run watch` row is
  downgraded (the Dockerfile's clean context defuses most of it); two new Railway rows — the
  `DATABASE_URL` URI trap and the `healthcheckPath` near-miss.

### Follow-up, resolved 2026-08-23: `UseHttpsRedirection` becomes Development-only

This was left open as a small call for the owner, on **inferred** reasoning — that Railway's health
prober would reach the container without `X-Forwarded-Proto` and, not following redirects, would read a
`307` as unhealthy. The owner asked for that to be **verified rather than inferred** before it went in
as a decision. It was, against Railway's own documentation and a live test of its edge. **The
conclusion holds, but two of the three supporting facts turned out to be different from the inference,
and one could not be confirmed at all.**

**Verified — Railway's edge is HTTPS-only and already does this job one hop earlier.** Its
public-networking specs state *"Inbound traffic must be TLS-encrypted"*, *"All traffic must be HTTPS and
use TLS 1.2 or above"*, and *"Plain HTTP GET requests will be redirected to HTTPS with a `301`
response"* (POSTs to port 80 are converted to GETs). Confirmed live against a Railway-hosted domain:

```
$ curl -sS -D - -o /dev/null http://docs.railway.com/deployments/healthchecks
HTTP/1.1 301 Moved Permanently
location: https://docs.railway.com/deployments/healthchecks
content-length: 0
server: railway-hikari      x-railway-edge: den1
```

`content-length: 0` from `railway-hikari` — **the edge answers it; the container never sees the
request.** So this answers the third question outright: **no external client can present a plain-HTTP
request to the app**, and an application-level redirect is dead code rather than a safety net.

**Verified — the middleware could not fire even if it were reached.** The same specs table states that
at Railway's edge **`X-Forwarded-Proto` *always* indicates `https`**. Once `KnownProxies` is cleared
(§4.2 item 5), `Request.IsHttps` is true for every real request. That is also a useful independent
confirmation that the forwarded-headers fix is both correct and sufficient.

**Verified — inside the container it is inert regardless.** Kestrel binds HTTP only
(`ASPNETCORE_HTTP_PORTS=${PORT}`; Railway's own ASP.NET Core guide prescribes the equivalent
`ASPNETCORE_URLS=http://+:${PORT}` and notes .NET requires a Dockerfile because Railpack has no .NET
support). `HttpsRedirectionMiddleware` resolves its target port from `HttpsRedirectionOptions.HttpsPort`,
`ASPNETCORE_HTTPS_PORT`, `HTTPS_PORT`, or an `https://` server address — none present — then logs
*"Failed to determine the https port for redirect."* and calls `next` for everything.

**Verified, and it corrects the original framing — the healthcheck is deploy-time only.** Railway's
healthcheck docs say the endpoint is queried *"until it receives an HTTP `200` response"*, that
*"Railway does not monitor the healthcheck endpoint after the deployment has gone live"*, and that it is
explicitly ***not* used for continuous monitoring**. So the feared outcome is **"the new deployment
never goes live"** (failing after the default 300-second timeout), **not** "Railway thinks the running
app is down." That is the safer of the two failure modes and the risk should not be over-weighted.

**Could *not* be verified — whether the health prober sets `X-Forwarded-Proto`, or follows redirects.**
Railway's docs do not say. What they do say: the prober uses the hostname **`healthcheck.railway.app`**,
and it targets the port from the injected `PORT` variable — i.e. the container's own HTTP listener. The
`X-Forwarded-Proto: https` guarantee is stated specifically under **"Edge Traffic"**, and the prober
must reach the *pending* deployment, which the public edge cannot address by definition. Both point
toward a direct internal probe with no forwarded headers — **but that is reasoning, not documentation,
and it is stated here as such.** The requirement for a literal `200` is documented; redirect-following
behaviour is not mentioned either way.

**Recommendation, adopted: make it Development-only.** Not because the health-check risk is confirmed —
it is not — but because the three verified facts leave the middleware with **no job in Production at
all**, while the third one makes it a **latent trap**: it is dormant only while no HTTPS port is
configured, and configuring one is exactly what someone does while debugging TLS. `portfolio` itself
sets `options.HttpsPort` from config (`Program.cs:12–19`) and — precisely — calls
`UseHttpsRedirection()` in Development only. One `if` converts a dormant trap into an impossibility, at
zero cost, since Development uses `SameAsRequest` and has no proxy.

**Honest summary of confidence:** high that the change is correct and free; high that the redirect is
redundant on Railway; **moderate** on the specific health-check mechanism, which is why the change is
justified in the docs by redundancy and latency rather than by that mechanism.

> **One thing this verification turned up that is worth more than the original question.** Railway sends
> `Host: healthcheck.railway.app`, and its docs warn that applications restricting hosts fail the check
> *"with status 400"*. ASP.NET Core's host filtering reads `AllowedHosts`, and `appsettings.json`
> currently has `"AllowedHosts": "*"` — **safe as shipped**. But tightening `AllowedHosts` looks like
> pure hardening upside, and doing it without adding `healthcheck.railway.app` would **silently stop
> every deploy going live**. Folded into `architecture.md` §4.2 item 5a, the risk register, and the
> checklist.

---

## Decided by reasoning, not asked

Recorded so they are not re-litigated later as though they had been open:

- **No Identity framework in this pass.** Cookie authentication is in the shared framework and
  everything Identity adds is on the explicit not-wanted list. `architecture.md` §1.1, with four
  alternatives considered and why each was rejected.
- **`400 { code }` rather than `401` for login failure.** Not a semantics preference — a `401` is
  intercepted and swallowed by the session-expiry handler, so the login form would silently report
  nothing. `architecture.md` §1.4.
- **The two-shell route structure, even for one auth page.** The routing constraints it encodes are
  structural, not proportional to the page count, and both were already litigated once during Luigi's
  review of the robust plan. `architecture.md` §3.1.
- **The Angular `canMatch` guard is retained even though the server now serves the SPA shell
  unconditionally.** The guard and the `401` interceptor catch different things and neither substitutes
  for the other. `architecture.md` §2.3.
- **The `/api/{**rest}` 404 catch-all is in scope, not optional.** One line; without it a misspelled API
  path is answered with `index.html` and a `200`. `architecture.md` §2.3.
- **Plain ordinal string comparison for the password, not a constant-time compare.** With the value
  already at rest in plaintext, a timing-safe comparison defends nothing that is not already lost, and
  including it would imply more safety than exists. `architecture.md` §1.3.
- **Data Protection key persistence in Phase 0, not at deployment.** Getting it wrong fails silently as
  "I keep getting logged out." `architecture.md` §1.7.
- **Table named `app_users`, column named `password`.** Both chosen to make the later Identity migration
  a clean drop-and-replace rather than a rename, and to avoid a column whose name asserts a property it
  does not have. `architecture.md` §1.2.
- **No input validation, rate limiting, lockout, or antiforgery.** Per the owner's explicit instruction.
  `SameSite=Lax` is the only CSRF defence in this pass, and it is a real if partial one.
  `architecture.md` §2.5.
- **Plaintext password.** Owner-directed, with the threat model, the one non-optional control (a
  password unique to this app), and a stated upgrade trigger rather than an open-ended "later."
  `architecture.md` §6.

---

## Confirmed by the owner, alongside the original four resolutions

- **Single-origin hosting.** The API serves the built Angular app. `architecture.md` §4.1.
- **The SPA shell is served to anyone; the Angular app renders its own login view.** An unauthenticated
  visitor being able to fetch `index.html` and the JS bundles is expected and accepted. This turned the
  `MapFallbackToFile` finding from a flagged risk into the worked fix in `architecture.md` §2.3.

## Luigi review dispositions (2026-08-18)

**Complete — this records the frontend review of Phase 2 against the gate in `phases.md`. All four
blocking findings were adopted and are folded into `architecture.md` and `phases.md` in place, as the
robust plan's were, and the one question the review referred to the owner (#5 above) was answered the
same day in favour of the recommendation. Nothing from this review is outstanding.**

**Common shape, and it is the same one as his review of the robust plan: nothing in the design was
wrong — four things were unreachable, and three of the four fail silently.** Two of them are
interlocked, which is why they are numbered together.

### Adopted — blocking

| Finding | Disposition |
|---|---|
| **The interceptor array is in the wrong order, so the `401` toast fires anyway.** Angular builds the chain with `reduceRight`, so `withInterceptors([A, B, C])` yields `A(next: B(next: C(next: backend)))` — the array is *request* order and errors propagate back through it in reverse. With `credentials → authError → httpError`, `httpErrorInterceptor` is innermost and fires `Request failed (401) for GET /api/mysteries` **before** `authErrorInterceptor` sees the error. The `401` branch's "swallow the error so no toast fires" is not what the code does | Adopted as **decision #19**. Order becomes `credentials → httpError → authError`, with `authErrorInterceptor` **last** and a code comment phrasing the rule as *"last in the array = first to see an error"* — because "ordered before `httpErrorInterceptor`" reads as the opposite of what is required and is how this got written backwards. `credentialsInterceptor` only mutates the request, so it stays first. **This corrects `docs/authentication-update/architecture.md:961` too**, which carries the identical array and the identical claim; fixing it here means the robust plan inherits the fix instead of shipping the bug twice. `architecture.md` §3.3 |
| **The two-shell restructure orphans three app-wide concerns.** `<app-icon-sprite />` (`page-layout.html:2` — the only occurrence in `src/`; `icon.component.ts:14` calls it "the app-wide icon sprite"), the toast host (lines 130–150), and the API-availability probe + modal (`page-layout.ts:44–46`, template 152–181) all live inside shell 1. On the auth shell: any `<app-icon>` renders **blank with no error**; toasts render nowhere and auto-dismiss after 4 s; and the health probe never fires, which makes `architecture.md` §2.2's stated symptom impossible **and Phase 2's "stop the API and confirm the modal appears" check — the only detector for the silent `/health` proxy gap — unrunnable** | Adopted as **decision #20**. The *extent* was referred to the owner as question #5 above with A/B/C options priced, and **answered the same day: option A, the full move to `App`** — all three concerns hoisted out of `PageLayoutComponent`. `architecture.md` gains **§3.5** with the full finding and the diff cost (~55 lines out of `page-layout.html`, three tests relocated from `page-layout.spec.ts:42,108,117` into a new `app.spec.ts`); §2.2's incorrect consequence is corrected in place with a note saying it previously said otherwise; `phases.md` gains step 10b. **Must land with the ordering fix above** — the toast bug is masked today precisely because the toast host is inside the shell being torn down |
| **The login form has no error path except `invalid_credentials`.** Both interceptors skip `/api/auth/` (§1.4, §3.3) and the auth shell has no toast host, so `LoginComponent`'s inline region is the **only** error surface in the application for the login POST. §3.4 specified "one inline error region" and §1.4 specified one code; an API-down (`0`), a `500`, or the `/api/{**rest}` catch-all's `401` on a mistyped route all fell through to **nothing** — no toast, no modal, no message, no navigation. The exact mirror of decision #14's `logout()` finding, arriving from the same three decisions | Adopted as recommended. The `error` handler renders the inline region for **every** failure: the specific message for `code === "invalid_credentials"`, a generic "couldn't reach the server" for anything else. Folded into `architecture.md` §3.4 with the four-row table, `phases.md` Phase 2 step 9, the risk register, and the verification checklist. **Not new ground** — the robust plan already carries *"auth components must render the generic message for any failure without a recognised `code`"* as an adopted part of decision #37; this pass kept every other part of #37 and dropped this one |
| **`AuthService.initialize()` must *return* its observable.** Every claim in §2.3's proactive-guard column depends on the `me` call having completed before the router's first navigation, which holds only if the initializer returns something awaitable. **`ThemeService.initialize()` returns `void`** (`core/theme.ts:66`) — and §3.2 tells the implementer to place the auth line "alongside" it. A `void`-returning `initialize()` compiles, type-checks, and produces "signed in, but shown the login page on every cold load," which presents as a cookie bug | Adopted as recommended. `architecture.md` §3.2 gains the do/don't snippet, the `APP_BOOTSTRAP_LISTENER` reasoning for why the ordering guarantee is real when it *is* returned, and the failure trace; `phases.md` steps 2 and 3 name it; decision #11 amended; risk register and checklist gain the "reload stays signed in, with no flash of the login page" check |

### Adopted — non-blocking, folded in place

| Finding | Where |
|---|---|
| **The proactive guard path silently drops `returnUrl`** — a `CanMatchFn` returning `false` cannot attach query parameters, so a logged-out deep link always lands on `/dashboard`. The real risk is second-order: this is exactly the itch someone scratches with a `UrlTree`, which is the declined change that causes the infinite redirect | `architecture.md` §3.1 (three-line stash **or** a stated acceptance — but not left unstated), `phases.md` step 7, risk register. Includes a one-line `returnUrl` shape guard before `navigateByUrl` |
| `authErrorInterceptor` should act only once per expiry burst — otherwise N parallel `401`s each clear the signal and re-navigate, and `returnUrl` reads `/login` from the second call onward | `architecture.md` §3.3, `phases.md` step 5 |
| The `user` signal should be set inside `AuthService.login()` (via `tap`), not the component — which is also what §5.1's "`login()` carries forward untouched" depends on. Signal **before** navigation, or `authenticatedMatch` bounces the user back | `architecture.md` §3.4, `phases.md` steps 2 and 9 |
| The login form needs `autocomplete="email"` / `autocomplete="current-password"`, `name`/`id`, and a real `type="submit"`. Not polish: §6's *single non-optional* mitigation for the plaintext column presumes a randomly generated, app-unique password, i.e. a password manager, which needs the browser to recognise this as a login form | `architecture.md` §3.4, `phases.md` step 9 |
| `AuthLayoutComponent`: do **not** copy the sidebar's `MOTW` badge classes (`bg-white/20 text-white` is invisible on `bg-surface-sunken`); create **no** `.scss` (post-Tailwind-migration convention, and `@reference "tailwindcss"` fails the build on any project token); add `host: { class: 'block h-full' }` | `architecture.md` §3.1 |
| Steps 9 and 10 disagree about which file holds the auth shell's empty-path child. Splitting the `''` redirect and `login` across two files is how that child — a **blocking** finding on the robust plan — goes missing a second time | `phases.md` step 10 |
| Name the shared exemption predicate `isSelfHandledRequest`, because sharing it means a future entry changes both the toast behaviour and the `401`-bounce behaviour | `architecture.md` §3.3 |
| "The seven lazy feature bundles" is **nine** — three `loadComponent` and six `loadChildren` | `architecture.md` §2.3, §3.1, `phases.md` |
| `httpErrorInterceptor`'s absolute-URL-in-toast wart (an open item on the robust plan) resolves itself once `apiBaseUrl` is `''` — recorded so it is not re-raised as outstanding work | `architecture.md` §3.3 |
| `page-layout.ts` uses constructor injection, so `AuthService` goes in as a third constructor parameter; the `<a>` → `<button>` swap needs `w-full text-left cursor-pointer` and `(click)="closeUserMenu()"` to look and behave like its Settings sibling | `architecture.md` §3.4 |
| Pin `GET /api/auth/me`'s signed-out response as `200` with a JSON `null` body, not `204` — indistinguishable to `HttpClient`, but the `.http` file in Phase 1 step 7 is where the contract gets fixed | `architecture.md` §3.2 |

### Confirmed as correct, having been checked rather than assumed

- **`architecture.md` §2.3's argument that the Angular `canMatch` guard is still required** even though
  the server serves `index.html` unconditionally. **Agreed, and the reasoning holds as written.** The
  two mechanisms genuinely catch disjoint things, and the `APP_BOOTSTRAP_LISTENER` ordering that makes
  the proactive column true is real — *conditional on* `initialize()` being returned (blocking finding 4
  above). Deleting the guard would cost a visible flash of the signed-in chrome plus a lazy chunk and a
  burst of `401`s on every logged-out deep link.
- **Decision #14 / step 11 — `logout()` acting on both `next` and `error`. Agreed, and it is
  sufficient.** The reasoning chain is sound end to end: the endpoint is authenticated, both
  interceptors skip `/api/auth/` by design, so nothing else covers the `401`.
- **The question it raises about `login()` is *not* symmetric in the service — it is symmetric in the
  component**, and that is blocking finding 3 above. `login()` itself needs no error handling; the
  component does.
- **`initialize()` / `GET /api/auth/me` "always resolves" is exactly right and needs nothing further**
  beyond one `catchError` to `null`. The transport-failure branch is correct rather than merely
  defensive: a session that cannot be *verified* must be treated as no session.
- **Phase 2 step 1's ordering and its `core/api.spec.ts` claim.** Verified against the current file:
  `core/api.spec.ts:30` asserts `http://localhost:5225/health/live`, and `ApiService.baseUrl` becomes
  `''` under `apiBaseUrl: ''`, so it must become `expectOne('/health/live')`. `core/health.spec.ts`
  asserts `service.endpoint` and needs no change. `angular.json`'s `serve` target has no `options` block.
  All three claims accurate.
- **Decision #10 / step 10's two-shell shape, against the *current* `app.routes.ts`** (unchanged since
  the docs' verification pass: one `''` route with nine children plus `{ path: '**', redirectTo: '' }`).
  All four navigation cases traced and terminating correctly with the `**` wildcard unchanged:
  logged-out `/` → shell 2's `''` child → `/login`; logged-out `/dashboard` → shell 1 `false`, shell 2
  matches `''` but no child matches `dashboard`, so the router backtracks → `**` → `''` → `/login`;
  logged-out unknown URL, same path; **logged-in `/login`** → shell 1 matches with no `login` child →
  backtrack → shell 2's `anonymousMatch` `false` → `**` → `''` → `/dashboard`. And `app.routes.spec.ts`
  does keep passing unmodified for exactly the stated reason.
- **The `false`-not-`UrlTree` rule, the empty-path child on both shells, and the deliberate
  redundancy of the `400` contract plus the `/api/auth/` skip** — all reused correctly from the robust
  plan, with no divergence.

---

## Bowser review dispositions (2026-08-19)

**Complete — this records the backend/DevOps review of Phases 0, 1 and 3 against the gate in
`phases.md`. The one question it referred to the owner (#6 above) was resolved on 2026-08-23, so the
gate is clear on Bowser's side.** All three blocking findings are folded into `architecture.md` and
`phases.md` in place, as Luigi's and the robust plan's were.

**Common shape, and it is the same one as Luigi's: nothing in the design is wrong. Three stated
mitigations do not do what they say, and two of the three fail silently.** All three are in Phase 3.
Phases 0 and 1 are sound as designed and needed only mechanical corrections.

### Adopted — blocking

| Finding | Disposition |
|---|---|
| **`UseForwardedHeaders` as specified is inert behind any real proxy.** `ForwardedHeadersOptions` defaults `KnownNetworks` to `{ ::1/128 }` and `KnownProxies` to `{ ::1 }` — loopback only — and `ForwardedHeadersMiddleware` `break`s out of the entry loop at the first hop that is not a known proxy, which discards **`X-Forwarded-Proto` along with `X-Forwarded-For`**. Behind a platform load balancer, an nginx sidecar or a CDN, zero entries are consumed: `Request.Scheme` stays `http`, `CookieSecurePolicy.Always` refuses to emit `motw.session`, and `UseHttpsRedirection` loops. **That is exactly the failure `architecture.md` §4.2 item 5 says this step prevents**, and the checklist's *"first thing to check if login 'succeeds' but no cookie appears"* would send the reader to a line that is already present and already not working | Adopted as recommended: `KnownNetworks.Clear(); KnownProxies.Clear();` alongside the `ForwardedHeaders` flags, Production only. This is not a workaround — it is what the framework's own `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` shortcut does, whose source comment reads *"Only loopback proxies are allowed by default. Clear that restriction because forwarders are being enabled by explicit configuration."* (That shortcut is not usable as-is here: it sets `XForwardedHost \| XForwardedProto` and omits `XForwardedFor`.) Residual stated rather than hidden: with both lists cleared a client reaching the app directly could spoof the scheme — closed by §4.3's requirement that the app is only reachable through its proxy, and tightened to a real `KnownProxies` entry once a host is picked. **Corrects the robust plan too**, which carries the same flags and the same claim. `architecture.md` §4.2 item 5, `phases.md` Phase 3 step 3, risk register, checklist |
| **`app.UseRouting()` must be added explicitly.** `Program.cs` never calls it, so `WebApplicationBuilder` inserts routing at the **front** of the pipeline, ahead of every middleware the file registers. Three consequences the design did not account for: Phase 3 step 1's *"before routing"* names a position that does not exist; **`UseDefaultFiles()` becomes dead code**, because it and `StaticFileMiddleware` both begin with `context.GetEndpoint() == null` and `MapFallbackToFile`'s `{*path:nonfile}` **matches `/`** (a catch-all matches zero segments); and §2.3's diagnostic — *"`/` keeps working while `/login` and every deep link `401`"* — is **false**, since `/` matches that same gated endpoint | Adopted as recommended. One line, no behavioural risk, placed where §2.4's diagram already shows it. **The deployment works either way** — the anonymous-asset guarantee holds regardless, since JS/CSS/`.ico` all have extensions, so `nonfile` rejects them, no endpoint matches, and the static-file middleware short-circuits before `UseAuthorization` (verified, not assumed). What is actually lost without it is the **only stated tell** for the one failure §2.3 calls *"unrecoverable bootstrap deadlock."* `architecture.md` §2.3 gains the full box and §2.4's diagram is annotated; `phases.md` gains **step 1a**; the risk register's "made worse by `/` still working" clause is corrected in place with a note saying it previously said otherwise, and a new row added. **Carries forward** — the robust plan's §7 order has the same gap for the same reason |
| **The `ng build` → `wwwroot` step cannot be an MSBuild target inside `dotnet publish`.** The Web SDK globs `wwwroot/**` into `Content` at MSBuild *evaluation* time; a target that populates the directory during the build creates files that were not in that item group and **are never published**. No error, no warning — the app deploys with no SPA, `UseStaticFiles` finds nothing, and `MapFallbackToFile("index.html")` `404`s every route including `/login`. Third member of the family this plan already tracks twice (`/health/live` under `ng serve`; unknown `/api` paths answered with HTML), and the one that takes the deployment down completely | Adopted; the *shape* was referred to the owner as question #6 with both options priced, because it turned on a deferred §4.3 decision. **Resolved 2026-08-23 against the `portfolio` comparison, more simply than either option priced:** `angular.json`'s `outputPath` writes straight into `wwwroot` (`"browser": ""` to flatten the subfolder), `MonsterOfTheWeek.Api.csproj` is untouched, and the sequencing is a **repo-root multi-stage `Dockerfile` deployed to Railway** — `portfolio`'s shape, with four non-cosmetic adaptations (Node 26, this repo's deeper paths, `$PORT` binding, publishing the `.csproj` not the solution). **With no `.csproj` change there is no target to mis-time, so the finding is closed by construction** — and the copy and clear-before-copy steps disappear, the latter because `deleteOutputPath` defaults to `true`. "Never bind to `Build`" (`MonsterOfTheWeek.Api.Tests` has a `ProjectReference` to the API) likewise becomes true by construction. `phases.md` steps 5 and 7 rewritten, plus a `.dockerignore` entry so a stale local build cannot enter the image; risk-register row closed and replaced by a downgraded `npm run watch` row and two Railway rows; checklist gains image-level checks |

### Adopted — non-blocking, folded in place

| Finding | Where |
|---|---|
| **The CORS block does not and cannot throw in production.** `appsettings.json` commits `Cors:AllowedOrigins` and `dotnet publish` always ships that file, so the `?? throw` at `Program.cs:9–10` is unreachable. The real behaviour is a silently-registered `http://localhost:4200` policy with no `AllowCredentials`, so the cookie is never in play. The change is still right; the justification and the "High, loud" severity were not | `architecture.md` §2.4 (rewritten with the correct failure mode), `phases.md` step 4, risk register row rewritten and downgraded to Low |
| **The identical defect on `ConnectionStrings:Postgres` does matter.** Same unreachable guard, but a production deploy that forgets `ConnectionStrings__Postgres` then resolves the committed `Host=localhost` placeholder and dies inside `MigrateAsync()` with a socket error instead of the configuration error the guard promises. Equal-effort fix while step 6 is already editing the file: move both the `ConnectionStrings` and `Cors` blocks into `appsettings.Development.json`. Verified safe for migrations — `MotwDbContextFactory` defaults `ASPNETCORE_ENVIRONMENT` to `Development` and layers `appsettings.{env}.json` itself | `architecture.md` §4.2 item 6, `phases.md` step 6, new risk-register row, checklist |
| **`AppUser` must not implement `ITimestamped`.** `ITimestamped` declares a non-nullable `UpdatedAt` and `ApplyTimestamps()` writes it unconditionally, forcing a fifth column §1.2's four-column table does not want. Consequence for the runbook: nothing then populates `created_at`, so the hand-written `INSERT` must supply it or the column needs a `now()` default | `architecture.md` §1.2, `phases.md` Phase 0 step 2 and Phase 3 step 7, checklist |
| **The `DbSet` should be `AppUsers`, not `Users`.** `IdentityUserContext<TUser,…>` already declares `public virtual DbSet<TUser> Users`, so `Users` is precisely the name that collides (CS0108) when the base class changes — the exact class of problem decision #2 exists to prevent, one layer up from the table name it was reasoning about | `architecture.md` §1.2, `phases.md` Phase 0 step 3 and decision #2, checklist |
| **Phase 0's "`data_protection_keys` gains a row on first startup" cannot pass in Phase 0.** The key ring is created lazily on the first `Protect`/`Unprotect`, and Phase 0 adds no protector consumer, so the table is legitimately empty for the whole phase. Following the old wording, an implementer concludes Phase 0 failed — on the one phase whose entire risk profile is "this fails silently" | Assertion moved to Phase 1 (after the first login, where it also proves the *ticket* protector is the DB-backed one). `architecture.md` §1.7, `phases.md` Phase 0 + Phase 1 + decision #7, risk register, checklist |
| **The `/api/{**rest}` catch-all also absorbs wrong-method requests**, since `app.Map(pattern, handler)` maps every HTTP method. `DELETE /api/mysteries` stops returning `405 Method Not Allowed` and returns `404` (or `401` anonymous) | `architecture.md` §2.3 |
| **`UseStaticFiles()` with no `wwwroot/` directory is safe** — `WebRootFileProvider` falls back to a `NullFileProvider`, so a clean clone (where `wwwroot/` is gitignored) still starts. Recorded so it is not "fixed" | `architecture.md` §4.2 item 9, checklist |
| **Nothing outside `/api` is fail-closed, including probe paths.** `{*path:nonfile}` answers `/health`, `/healthz`, `/ready` with `200 text/html`, so a liveness probe aimed at a near-miss path passes forever while the app is broken — the `/health` proxy trap one layer out, in production | `architecture.md` §4.2 item 10, `phases.md` step 7 runbook note, checklist |
| **The CORS conditional needs two different environment objects** — `builder.Environment` for the read and `AddCors`, `app.Environment` for `UseCors`. Guarding only the first half leaves `UseCors("FrontendDev")` pointing at a policy that no longer exists, which throws on the first *request* rather than at startup | `architecture.md` §2.4, `phases.md` step 4 |
| **`dotnet ef` does not execute `Program.cs` in this repo** — `Data/MotwDbContextFactory.cs` is an `IDesignTimeDbContextFactory<MotwDbContext>`. Worth recording because it is what makes both the Phase 0 migration independent of Phase 0 step 4 and the `appsettings.json` move above safe | `architecture.md` §1.7, `phases.md` Phase 0 |
| **Phase 3 step 5 is the first thing in this repo that couples the .NET and Angular builds.** At review time there was no CI and no Dockerfile, and the Angular project is still not in `MonsterOfTheWeek.slnx` — which is why the coupling had to be designed rather than inherited. *Resolved by question #6: step 5 now adds the repo-root `Dockerfile` and `.dockerignore` that carry it, and the solution stays .NET-only (so `dotnet publish` must target the API `.csproj`, never the solution).* | `architecture.md` §4.2 items 2 and 2a, question #6 |

### Confirmed as correct, having been checked rather than assumed

- **Decision #8's "zero controller edits" and "exactly four `[AllowAnonymous]`."** Re-counted against
  the current tree: **107** `[Http*]` actions across 7 controllers (Bystanders 12, Locations 12,
  Minions 29, Monsters 31, Mysteries 7, Reference 14, Search 2), and **zero** `[Authorize]` or
  `[AllowAnonymous]` anywhere in `Controllers/`. `SetFallbackPolicy` covers all of them. Four is
  genuinely the whole anonymous surface — **Swagger needs no fifth entry**, being Development-only
  middleware (`UseSwagger`/`UseSwaggerUI`) that short-circuits before `UseAuthorization`. And
  `MapHealthChecks` and `MapFallbackToFile` both return `IEndpointConventionBuilder`, so
  `.AllowAnonymous()` chains onto both exactly as written.
- **The `/api/{**rest}` precedence claim, in both directions, against every route template in the
  tree.** `MonstersController`/`MinionsController`/`LocationsController`/`BystandersController`/
  `SearchController` put full templates on each action; `MysteriesController` is
  `[Route("api/mysteries")]`; `ReferenceController` is `[Route("api")]` plus literal action templates.
  Every one is literal segments plus constrained parameters, and both outrank a `{**rest}` catch-all at
  every segment. In the other direction, `Order` is compared before precedence, so a default-order
  endpoint beats `MapFallbackToFile`'s `Order = int.MaxValue`. **The claim holds for all 107 actions.**
- **Phase 0's "Watch for" against the SQLite test context — closed rather than carried.** Both
  contexts (`MonsterRepositoryTests.cs:16–21`, `SearchProvidersTests.cs:556–565`) use `UseSqlite` +
  `EnsureCreatedAsync()`, which creates every table in the model, so `app_users` and
  `data_protection_keys` materialise with **no test-project change at all**. The only ways to break it
  are Npgsql-specific mapping choices, now named as constraints in Phase 0 step 3.
- **Decision #2's collision premise.** The robust plan's decision #5 maps Identity to
  `users`/`roles`/`user_roles`/`user_claims`/`user_logins`/`user_tokens`/`role_claims` —
  `app_users` collides with none of them. Better than claimed, in fact: `data_protection_keys` is the
  **same** name in both plans and this pass creates it with the same mapping, so the robust plan's
  Phase 0 step 4 becomes a no-op rather than a conflicting second definition.
- **Decision #7 / §1.7's Data Protection design.** `PersistKeysToDbContext` + `SetApplicationName` is
  correct, the Phase 0 placement is correct, and the startup ordering is safe — `MigrateAsync()` creates
  the table during startup and the key ring is only touched on first use, which is later. Only the
  verification wording needed correcting.
- **§1.5's cookie options block against the robust plan's §1 session table, line by line.** `motw.session`,
  `HttpOnly`, `SecurePolicy` `Always`/`SameAsRequest`, `SameSite=Lax`, 24h `ExpireTimeSpan`,
  `SlidingExpiration`, `IsPersistent` with no "Remember me", and the bare-401/403 overrides written as
  **mutation** — all identical. The only row present there and absent here is
  `SecurityStampValidationInterval`, which is Identity-only and correctly omitted. **Nothing in the
  cookie configuration will be rewritten later.**
- **`Cors:AllowedOrigins` has exactly one reader repo-wide** (`Program.cs`), so making the block
  Development-only leaves no other consumer stranded.
- **The `ng build` output path.** `angular.json` sets no `outputPath` today and has
  `"defaultConfiguration": "production"`, so a bare `ng build` produces hashed, budgeted output at
  `dist/monster-of-the-week-web/browser`. *(The `dist/` half is superseded by question #6's resolution —
  `outputPath` now points at `wwwroot` — but the `defaultConfiguration: production` half still carries
  §4.2 item 8's assumption that a bare `ng build` is the hashed one.)*
- **The bare `401`.** `AddProblemDetails()` is registered but neither `UseStatusCodePages` nor anything
  else converts an authorization-middleware `401` into a body, so §1.5's "bare `401`, never a `302`"
  holds once `OnRedirectToLogin` is overridden.

---

## Out of scope by design, and still requiring the owner *before deployment*

Not open questions about this design — this design is complete — but the things that stand between it
and a live deployment. **The list shrank on 2026-08-23**, when the owner confirmed **Railway with a
Dockerfile** as the deployment shape: that settles hosting provider, runtime shape, TLS issuance and
renewal (Railway's edge), CI/CD (Railway builds from the connected branch), and where Postgres lives (a
Railway addon). The Dockerfile itself is in-repo and therefore in Phase 3, not deferred.

**What is left of the infrastructure pass:**

- **A domain name**, and whether the app is served at a root or a subpath (`index.html` has
  `<base href="/">`).
- **How the owner reaches the production database to insert the credential row.** A hard dependency of
  this whole design, not a nice-to-have — worth confirming the path works *before* Phase 3 ships.
- **Backups** for the Railway Postgres service.
- **The environment variables and their values** — with two answers already supplied so they are
  configured right the first time rather than diagnosed later: `ConnectionStrings__Postgres` must be a
  **key=value** string composed from the addon's individual variables, because **Npgsql cannot parse
  Railway's `postgresql://` `DATABASE_URL`** (`portfolio` hit this and carries a normalizer for it); and
  `railway.toml`'s `healthcheckPath` must be **`/health/live`** exactly, since a near-miss is answered
  by the SPA fallback with `200 text/html` forever. `architecture.md` §4.3.

**`SecurePolicy.Always` still means there is no working deployment without real TLS** — Railway supplies
it, which is also what makes `architecture.md` §4.2 item 5's `KnownProxies` fix mandatory rather than
precautionary.

**Also still outstanding:**

- **Whether Boo's `security-review` ceremony runs before implementation.** `.squad/ceremonies.md`
  triggers it on "handles auth," which this does. `phases.md` names the two things worth his time if it
  runs.

*(`UseHttpsRedirection` was on this list and is no longer — resolved 2026-08-23 in favour of
Development-only, verified against Railway's documentation and a live test of its edge. Question #6's
closing section records the evidence, including the one point that could not be confirmed.)*
