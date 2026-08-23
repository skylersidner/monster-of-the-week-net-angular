# Simple authentication — backend/DevOps review of Phases 0, 1 and 3

**Date:** 2026-08-19
**Author:** Bowser (Backend Developer / DevOps)
**Scope:** `docs/simple-authentication-update/` — the review gate `phases.md` assigns to this role.
Docs-only; no application code written or modified.

## What

Reviewed Phases 0, 1 and 3 and folded findings directly into `architecture.md`, `phases.md` and
`open-questions.md`, matching how Luigi's review and the robust plan's reviews are recorded.

**Three blocking findings, all in Phase 3, all adopted:**

1. **`UseForwardedHeaders` as specified is inert behind any real proxy.** `ForwardedHeadersOptions`
   defaults `KnownNetworks` to `{ ::1/128 }` and `KnownProxies` to `{ ::1 }`, and the middleware
   discards the entire forwarded entry — `X-Forwarded-Proto` included — at the first hop that is not a
   known proxy. Behind a load balancer, sidecar or CDN, `Request.Scheme` stays `http`,
   `CookieSecurePolicy.Always` refuses to emit `motw.session`, and `UseHttpsRedirection` loops: exactly
   the failure the step exists to prevent. Fix: `KnownNetworks.Clear(); KnownProxies.Clear();` —
   what the framework's own `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` shortcut does, for this reason.
   **Corrects `docs/authentication-update/` too**, which carries the same flags and the same claim.
2. **`app.UseRouting()` must be added explicitly.** `Program.cs` has no such call, so
   `WebApplicationBuilder` inserts routing at the front of the pipeline. Phase 3 step 1's "before
   routing" then names a position that does not exist, `UseDefaultFiles()` becomes dead code (the
   fallback's `{*path:nonfile}` matches `/`, and both static-file middlewares no-op once an endpoint is
   matched), and `architecture.md` §2.3's diagnostic for a missing `.AllowAnonymous()` — "`/` keeps
   working while every deep link `401`s" — is false. Deployment works either way; the loss is the only
   stated tell for the failure the design calls unrecoverable.
3. **The `ng build` → `wwwroot` step cannot be an MSBuild target inside `dotnet publish`.** The Web SDK
   globs `wwwroot/**` into `Content` at MSBuild *evaluation* time, so files created during the build are
   never published — silently. The app deploys with no SPA and `404`s every route including `/login`.
   Run it as a step before `dotnet publish`, or add the files to `ResolvedFileToPublish` from
   `AfterTargets="ComputeFilesToPublish"`. Never bind it to `Build` — the test project has a
   `ProjectReference` to the API.

**Ten non-blocking corrections**, most consequentially: the CORS block **does not and cannot throw in
production** (`appsettings.json` commits the key and `dotnet publish` ships it), so that risk row was
mis-rated High/loud when the real behaviour is a silently-registered `localhost:4200` policy; but the
identical unreachable-guard defect on `ConnectionStrings:Postgres` does matter, and the equal-effort fix
is moving both blocks into `appsettings.Development.json`. Also: `AppUser` must not implement
`ITimestamped`; the `DbSet` should be `AppUsers` not `Users`; Phase 0's `data_protection_keys` check
cannot pass in Phase 0.

**One question to the owner** — `open-questions.md` #6: script vs MSBuild target for the publish
coupling. **Resolved 2026-08-23, and more simply than either option priced.** The owner supplied
`portfolio` — an already-deployed app of theirs on the same stack (Angular + ASP.NET Core 10 + Postgres,
single origin, Railway, repo-root multi-stage Dockerfile) — as reference material. Examined read-only.
Two findings decided it: its `Portfolio.Api.csproj` carries **zero** SPA MSBuild targets, confirming
that the working pattern is "finish the SPA build before MSBuild evaluates the project"; and its
`angular.json` sets `outputPath` to `../backend/Portfolio.Api/wwwroot` with `"browser": ""`, so
`ng build` writes *into* `wwwroot` and there is no copy step at all.

**Adopted:** `outputPath` → `../../api/MonsterOfTheWeek.Api/wwwroot` with `"browser": ""`, no `.csproj`
change, `.gitignore` entry kept, and `npm run build` → `dotnet publish` sequenced by hand for now
(there is no CI or Dockerfile here to carry the sequencing, which is the one part of `portfolio`'s
pattern that did **not** transfer). Forward-compatible by construction: adopting Docker-stage
sequencing later changes only *what runs the two commands in order*, at no rework. This closes the
blocking finding by construction — with no target, there is nothing to mis-time — and drops both the
copy and the clear-before-copy step (`deleteOutputPath` defaults to `true`).

**Recorded alongside it:** `portfolio` has no auth, no cookies, and an SPA that makes no HTTP calls, so
it is **not** a reference for the rest of Phase 3 — no fallback policy, no `AllowAnonymous` on the
fallback, no `/api/{**rest}` catch-all, and no `UseForwardedHeaders` (it avoids needing one by having no
`Secure` cookie and calling `UseHttpsRedirection()` in Development only). It does not weaken finding 1.

## Why

Every blocking finding is a mitigation that is *stated* but does not *work*, which is the same shape as
the findings this project's reviews have caught before and the shape the owner's "don't create rework"
instruction is most exposed to: the cost is not in the design, it is in a deployment day spent
debugging a symptom the docs describe incorrectly. Two of the three fail silently.

The non-blocking items were kept narrow deliberately. Nothing on the owner's explicit out-of-scope list
(hashing, rate limiting, lockout, CSRF, roles, validation) is raised. Everything raised is either a
genuine defect in Phases 0/1/3 as designed, or a change that is free now and avoids real work later.

**Forward-compatibility spot-checks that hold**, verified rather than assumed: `app_users` collides
with none of the robust plan's Identity table names (`users`, `roles`, `user_roles`, …), and
`data_protection_keys` is the *same* name in both plans, so the robust plan's Phase 0 step 4 becomes a
no-op; §1.5's cookie block matches the robust plan's session table line for line, with only the
Identity-only `SecurityStampValidationInterval` absent; `SetFallbackPolicy` is its decision #7 verbatim
and its named policies are pure additions. Two of the corrections above (`UseRouting`, forwarded-header
known-proxies) also correct the robust plan, so the fixes carry forward rather than the bugs shipping
twice.
