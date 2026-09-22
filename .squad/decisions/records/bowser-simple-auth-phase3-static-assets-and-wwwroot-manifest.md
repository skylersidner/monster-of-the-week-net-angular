### 2026-08-23: Phase 3 implemented — three corrections: obsolete `KnownNetworks`, missing static assets `401` rather than `404`, and a `wwwroot`-deletion startup trap

**By:** Bowser (Backend Developer / DevOps)
**Requested by:** Skyler Sidner — implement Phase 3 in-repo (no Railway deployment).

**What:**

1. **Phase 3 shipped as specified, steps 1–7.** `Program.cs` (forwarded headers with both lists cleared,
   Development-only CORS and `UseHttpsRedirection`, `UseDefaultFiles`/`UseStaticFiles`, an **explicit
   `UseRouting()`**, the `/api/{**rest}` catch-all, and `MapFallbackToFile("index.html").AllowAnonymous()`),
   `angular.json` `outputPath` → `wwwroot`, `.gitignore` + new `.dockerignore`, new repo-root `Dockerfile`
   and `railway.toml`, `ConnectionStrings`/`Cors` moved out of `appsettings.json`, and a runbook in the
   root `README.md`. **`MonsterOfTheWeek.Api.csproj` untouched.**

2. **`ForwardedHeadersOptions.KnownNetworks` is `[Obsolete]` in .NET 10 — used `KnownIPNetworks` instead.**
   The design and the Phase 3 checklist both say `KnownNetworks.Clear()`, which now emits `ASPDEPR005`.
   **Verified before substituting, because a wrong guess here is exactly the silent failure step 3
   exists to prevent:** a probe confirms the two properties are the *same underlying list* — clearing
   either leaves both at `Count 0`. So `KnownIPNetworks.Clear()` is the same fix under the current name,
   not a weaker one. An inline comment records this so the checklist item still reconciles.
   **Worth noting the warning was invisible locally** and only surfaced in the Docker build output,
   because my local build filter was matching on errors.

3. **A request for a *missing* static asset returns `401`, not the `404` §2.3 predicts.** §2.3 states
   *"a request for a missing `/foo.js` still `404`s from the static-file middleware rather than being
   handed `index.html`."* Verified: `/missing-asset.js` returns **`401`** anonymously (and `404` when
   authenticated). Mechanism is the one already recorded in the Phase 1 note: the static-file middleware
   passes through, `{*path:nonfile}` rejects the extension so no endpoint matches, and
   `AuthorizationMiddleware` applies the fallback policy to a **null endpoint**.

   **The load-bearing half of §2.3's guarantee is intact and was verified separately:** *existing* assets
   short-circuit in middleware before `UseAuthorization` and are served anonymously
   (`/main-OGLPIY6H.js` → `200` with no cookie). Only the missing-asset case differs, it is harmless,
   and it is consistent with the deliberate `401`-anonymous/`404`-authenticated shape already chosen for
   `/api/{**rest}`. **Left as-is** — "fixing" it would mean making the whole no-endpoint case anonymous,
   which weakens the fail-closed posture for nothing. Only the stated symptom needs correcting.

4. **New trap introduced by pointing `outputPath` at `wwwroot`: deleting `wwwroot` without clearing
   `obj/`/`bin/` makes the app fail to start.** The Web SDK records `wwwroot` as a content root in the
   generated static-web-assets manifest, which is read **inside `WebApplication.CreateBuilder(...)`** —
   so a stale manifest pointing at a removed directory throws
   `System.IO.DirectoryNotFoundException` from `PhysicalFileProvider`'s constructor, before a single line
   of application code runs, with a stack trace that names none of Phase 3's changes.

   **The checklist item itself passes:** on a *genuine* clean clone (no `wwwroot`, no `obj/`, no `bin/`)
   `dotnet run` starts normally — `/health/live` `200`, `/login` `404` because no SPA has been built yet,
   which is correct. The failure only occurs in the delete-after-building sequence, which is exactly what
   someone does when "cleaning up". **No code fix is possible** (the throw precedes `CreateBuilder`
   returning), so it is documented in the README runbook instead: delete `wwwroot` ⇒ also `dotnet clean`.

**Why:** (2) risked silently substituting a weaker API into the one mitigation whose whole point is that
its absence is invisible — so it was verified rather than assumed. (3) and (4) are both cases where the
documented symptom would send someone chasing the wrong thing: (3) reads as a broken static-file
pipeline, and (4) reads as a Phase 3 regression when it is a stale build artifact.

**Also flagged, not fixed — `appsettings.Development.json` still ships in the publish output.** Step 6's
goal was that "no local placeholder ships to production at all." The guard half works and was verified
live: with `ASPNETCORE_ENVIRONMENT=Production` and no `ConnectionStrings__Postgres`, startup now fails
with *"ConnectionStrings:Postgres must be configured."* rather than silently resolving a committed
`localhost` string. But `dotnet publish` ships **all** `appsettings.*.json`, so the Development file — and
its `Password=motw_dev_password` — is present in the image. It is inert (only layered when
`ASPNETCORE_ENVIRONMENT=Development`) and the value is a local Docker password already committed to git,
so this leaks nothing new. Closing it fully would be
`<Content Update="appsettings.Development.json" CopyToPublishDirectory="Never" />`, which has its own
cost (a publish output can then no longer be run in Development). **Left as an owner call rather than
decided unilaterally**, since the doc's claim is slightly stronger than what ships.

**One cosmetic container-log item for the infrastructure pass:** the `aspnet:10.0` runtime image logs
`Error: libgssapi_krb5.so.2: cannot open shared object file` at startup — Npgsql probing for GSSAPI on a
slim base image. **Purely cosmetic and confirmed so:** migrations ran, login succeeded, and data
endpoints returned rows through the container. It will look alarming in Railway's log view. One line in
the runtime stage (`apt-get install -y libgssapi-krb5-2`) silences it at the cost of image size; not
done here.
