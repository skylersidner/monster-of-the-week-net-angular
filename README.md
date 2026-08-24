# monster-of-the-week-net-angular

Phase 1 foundation for a .NET API + Angular web app with local Postgres groundwork.

## Project structure

- `src/api/MonsterOfTheWeek.Api` - ASP.NET Core API foundation (`net10.0`)
- `src/web/monster-of-the-week-web` - Angular app foundation (Angular 22)
- `docker-compose.yml` - Local Postgres container

## Local development quick start

1. (Optional) Copy `.env.example` to `.env` and adjust credentials.
2. Start Postgres:
   - `docker compose up -d postgres`
3. Start API:
   - `dotnet run --project src/api/MonsterOfTheWeek.Api`
4. Start Angular app:
   - `cd src/web/monster-of-the-week-web`
   - `npm start`
5. Open `http://localhost:4200` and verify the health-status page reports API liveness.

**This is the whole development loop. `docker build` is for shipping only and is never part of
iterating.** `ng serve` gives hot reload and the dev proxy makes it single-origin so the session
cookie works.

> **Do not use `npm run watch` as a development loop.** It has no hot reload, does not refresh the
> browser, and — now that `outputPath` points at the API's `wwwroot` — it overwrites the production
> build with an unoptimised development one. `ng serve` strictly dominates it.

> **If you delete `src/api/MonsterOfTheWeek.Api/wwwroot`, run `dotnet clean` (or delete `obj/` and
> `bin/`) as well.** The Web SDK records `wwwroot` as a content root in the generated static-web-assets
> manifest, and that manifest is read inside `WebApplication.CreateBuilder(...)` — so a leftover
> manifest pointing at a directory you just removed makes the app fail to start with
> `System.IO.DirectoryNotFoundException`, before any application code runs. A genuine fresh clone is
> unaffected; this only bites if you delete the directory after having built with it present.

## Operations runbook

### Creating the login credential

There is no registration endpoint and no seeding from code, by design — the credential row is only
ever created by hand over a direct database connection. **`created_at` must be supplied explicitly**:
`AppUser` deliberately does not implement `ITimestamped`, so nothing else populates it.

```sql
INSERT INTO app_users (id, email, password, created_at)
VALUES (gen_random_uuid(), 'you@example.com', 'a-password-unique-to-this-app', now());
```

Locally: `docker exec -it motw-postgres psql -U motw_app -d motw`.

> The password is stored and compared **in plaintext** — a deliberate, accepted trade-off for a
> single-user app. It is survivable only if the password is unique to this app and used nowhere
> else. See `docs/simple-authentication-update/architecture.md` §6.

### Deploying

Push to the Railway-connected branch. Railway builds the repo-root `Dockerfile` and restarts the
service. **Migrations apply themselves on startup** (`MotwDbInitializer` calls `MigrateAsync()`), so
there is no separate migration step — and a bad migration is a failed deploy rather than a manual
recovery.

**Publishing by hand** (a local single-origin check, or a non-Railway target) is two commands, and
the order matters — never publish whatever happens to be sitting in `wwwroot`:

```bash
cd src/web/monster-of-the-week-web && npm run build
dotnet publish src/api/MonsterOfTheWeek.Api/MonsterOfTheWeek.Api.csproj -c Release -o <out>
```

### The liveness probe path is `/health/live`, exactly

Any near-miss — `/health`, `/healthz` — matches no endpoint and is therefore answered by the SPA
fallback with `200 text/html`, so the probe passes **forever, even with the API completely broken**.
A health probe that returns HTML is misconfigured.

### Kill switch — ending every session everywhere

There is no server-side session store and no revocation mechanism: a copied cookie stays valid until
it expires, and changing the password does not end existing sessions. The one kill switch is to
discard the Data Protection key ring, which makes every previously issued cookie undecryptable:

```sql
DELETE FROM data_protection_keys;
```

Then restart the app; it generates a fresh key ring on startup. This is the answer to "I think my
password leaked."
