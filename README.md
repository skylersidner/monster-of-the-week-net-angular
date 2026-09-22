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

## Testing

Two suites. Both must be green before a branch merges.

```bash
# Backend — 568 tests
dotnet test MonsterOfTheWeek.slnx

# Frontend — 1190 tests. Runs once and exits; there is no watch mode to escape from.
cd src/web/monster-of-the-week-web && npm test

# Frontend type check — the compiler, which `npm test` does not run for you
cd src/web/monster-of-the-week-web && npm run typecheck
```

`npm run typecheck` exists because **`tsc -p tsconfig.json` checks nothing.** The root config is
solution-style (`"files": []` plus project references), so it compiles zero files and exits 0 on a
tree with a real type error. Both halves of the script are load-bearing: `tsconfig.app.json` alone
does not see `.spec.ts` files and exits 0 on an error in one.

### Never pass `--artifacts-path` to `dotnet test`

It reports **184 failures out of 568 that have nothing to do with your change.** (The count is
every test that seeds a playbook, so it drifts as those are added — 184 and 185 have both been
seen. Recognise it by the mechanism below, not by the number.)

`PickRuleTable.ApiProjectRoot()` (`src/api/MonsterOfTheWeek.Api.Tests/Services/PickRuleTable.cs:129-141`)
locates the seed data by walking **up from the test assembly** looking for `MonsterOfTheWeek.slnx`.
`--artifacts-path` moves that assembly outside the repository, the walk runs off the top of the
drive, and every test that seeds a playbook dies on `Assert.NotNull() Failure: Value is null`.

No flag fixes this. If something is locking `bin/` — usually a stale `dotnet run` — stop that
process and build in the tree rather than redirecting the output.

> **This failure can disguise itself.** If any directory above the redirected output happens to
> contain a stray `MonsterOfTheWeek.slnx`, the walk stops there instead and you get
> `DirectoryNotFoundException` naming a `hunter-playbooks.json` under a scratch path. Same cause,
> different exception — so match on the mechanism, not on the message.

### Restoring a mutated file: reset its timestamp

Mutation testing here is manual — copy the file aside, break it, run the suite, restore, confirm
green. **The restore step has a trap that costs about an hour and presents as a flaky harness.**

`Copy-Item` preserves the *source's* `LastWriteTime`, so a restored file is **older** than the
assembly that was built from the mutant. MSBuild's incremental build compares exactly those two
timestamps, skips the rebuild, and the next `dotnet test` runs the mutant assembly against your
restored source. The failures look real and reproducible, the file reads correctly, `git status` is
clean, and a `cmp` or hash check passes — because every one of those proves the **bytes** and none
of them proves the **build**.

```powershell
$f   = "src/api/MonsterOfTheWeek.Api/Services/MinionService.cs"
$bak = "$env:TEMP/MinionService.cs.bak"

Copy-Item $f $bak                          # back up
# ...mutate $f, `dotnet test`, observe which tests die...
Copy-Item $bak $f                          # restore
(Get-Item $f).LastWriteTime = Get-Date     # REQUIRED — without this the mutant still runs
dotnet test MonsterOfTheWeek.slnx          # only now is the result meaningful
```

Measured on this tree: after the `Copy-Item` restore the suite still reported **5 failures** with
the file byte-identical to `HEAD` and `git status` clean; after the `LastWriteTime` reset,
**568/568**.

Only copy-restores are affected. A file written by an editor or a tool gets a fresh timestamp and
rebuilds normally, and the Angular tree is immune — vite rebuilds on content, not on mtime.

### Verify the verifier

Every command above is a verification step, and this repository has now shipped three that reported
success while doing nothing. **Each one must have a recorded negative control: make it fail on
purpose, and keep the result.** Run these at adoption, and again whenever one of the commands
changes.

| Command | Negative control | Result, 2026-09-21 |
|---|---|---|
| `dotnet build MonsterOfTheWeek.slnx` | add a C# file containing `int x = "str"` | `error CS0029`, `Build FAILED`, exit 1 |
| `dotnet test MonsterOfTheWeek.slnx` | delete the assignment in `MinionService.MoveToMonsterAsync` | 5 failed, 563 passed |
| `npm run typecheck` | add `export const x: number = 'str'` | `error TS2322`, exit 2 |
| `npm test` | add a spec asserting `expect(1).toBe(2)` | 1 failed, 1190 passed, exit 1 |

A verification command with no negative control is an assumption, not a check.

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
