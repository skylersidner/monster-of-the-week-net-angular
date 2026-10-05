# Resource Images — Backend Review (Bowser)

**Reviewed:** `design.md` (Rosalina), `phases.md` (Yoshi), `thumbnail-and-primary-workflow.md` (Yoshi), against `src/api/MonsterOfTheWeek.Api/` as it stands on branch `resource-images`.
**Scope:** review only. No application code, no .NET edits, no commits.
**Settled decisions** (single `ResourceImage` table, `bytea`, nullable `PrimaryImageId`, 10×2 MB cap, WebP/JPG/PNG, `private` cache header, race accepted, Railway deferred, one commit per phase) are not re-opened, except where the code shows one is wrong. None is shown wrong below.

---

## Summary of verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | Thumbnail library | **ImageSharp**, conditional on Skyler confirming the Split License terms apply. Fallback: SkiaSharp with a Linux-container smoke test. |
| 2 | Request size limits | **Set explicitly**: `[RequestSizeLimit]` and `[RequestFormLimits]` at 24 MiB on the upload action, and the client must chunk drops to ≤10 files per request. |
| 3 | Id / FK / index conventions | **Agree on Id and the FK shape, with changes**: index names follow the `idx_` convention, add four FK indexes on the `PrimaryImageId` columns, `OwnerType` string conversion is not an existing convention and must be stated as new. |
| 4 | Projection sites and derivation | **Count is right (8). Mechanism is wrong for 4 of them.** Monster and Minion are SQL projections; Location and Bystander (×2 each) are in-memory projections over repository-loaded entity graphs, so a correlated subquery cannot be used there. Add a deterministic tie-break. |
| 5 | Migration strategy | **Agree, with additions.** Migrations run automatically at app startup via `MigrateAsync()`. Gate with `dotnet ef migrations has-pending-model-changes`. The migration is additive and reversible. |
| 6 | Test strategy | **Change.** Suite is SQLite + `EnsureCreatedAsync` and never runs migrations. Add an env-gated real-Postgres test class that runs `MigrateAsync()`. |
| 7 | phases.md corrections | See the list at the end. Most important: owner-delete leaves orphaned image bytes; decompression-bomb guard is missing; Phase 4 verification depends on Phase 3. |

---

## 1. Thumbnail library: ImageSharp vs SkiaSharp

**Recommendation: ImageSharp**, conditional on one check.

Reasoning, grounded in this repo:

- **Native-dependency risk is the deciding factor.** Skyler develops on Windows (`win32`, per the environment) and ships in `Dockerfile` on `mcr.microsoft.com/dotnet/aspnet:10.0` (Debian, glibc). SkiaSharp loads a per-RID native `libSkiaSharp` at runtime. A missing or mismatched native library fails with `DllNotFoundException` on the first upload, and the Windows dev box will not reproduce that. ImageSharp is pure managed C#, so the Windows test run and the Linux container exercise identical code paths. This is the single strongest argument.
- **Existing package set is entirely managed.** EF Core, Npgsql, DataProtection, Swashbuckle. Adding ImageSharp keeps the dependency graph managed-only. SkiaSharp would be the first native dependency in the API.
- **The conditional: licensing.** ImageSharp v3 uses the Six Labors Split License. As I understand the terms, it is free for open-source projects and for organisations under US$1M annual revenue, and paid otherwise. The verify step is to check current terms at sixlabors.com. This repo has **no LICENSE file** at its root, so it is not an open-source project. That leaves the revenue branch, which is a legal call for Skyler rather than something I can resolve. If Skyler does not accept it, use **SkiaSharp** (MIT), and in that case add a Linux container smoke test (build the image, upload one file through the real endpoint) before Phase 2 is marked done. Use the `SkiaSharp.NoDependencies` native-assets variant if the base image lacks the system libraries SkiaSharp expects; verify in the built image.
- **Use the library as the validator, not just the resizer.** `Image.Identify` reads only the header and gives width and height, which the design requires storing. Use it after the magic-byte check and before any full decode, and reject on failure. This gives a real decode check for corrupt files, which the magic-byte check cannot.

## 2. Request size limits

**Recommendation: set both attributes explicitly, at 24 MiB.**

- Kestrel's default `MaxRequestBodySize` is 30,000,000 bytes, and ASP.NET Core's default `MultipartBodyLengthLimit` is 128 MB. The worst case of 10 × 2 MiB = 20 MiB fits under the Kestrel default, so the current design works by accident of defaults. The phases doc is right that this should be stated.
- Apply `[RequestSizeLimit(24 * 1024 * 1024)]` and `[RequestFormLimits(MultipartBodyLengthLimit = 24 * 1024 * 1024)]` on the `POST .../images` action only. 4 MiB of headroom covers multipart overhead. `RequestSizeLimit` can raise the per-request limit above Kestrel's default, so it is the one that matters.
- **The gap this leaves:** a body over 24 MiB is refused by the framework with a 413 before the controller runs, so the per-file `{ uploaded, rejected }` contract and the CapExceeded partial-accept behaviour (design §7.4) never happen. Dropping 15 files at once would hit this. Resolve it on the client: the upload component sends at most `min(10 - currentCount, remaining)` files per request, chunked into sequential POSTs, and reports the aggregate. The server still enforces the cap itself, so a stale client is still correct.
- Define the size cap as **2 MiB (2,097,152 bytes)**. The design says "2 MB"; the value must be pinned in one constant and used by both the server check and the copy text.

## 3. Id, FK, and index conventions

**Id: agree.** Default-generated `Guid.NewGuid()`, no `ValueGeneratedNever()`. Matches `Monster`, `MonsterAttack`, `Minion*`, `Location*`, `Bystander*`. The `ConfigurePlaybooks` comment (`MotwDbContext.cs` ~line 480–507) confirms `ValueGeneratedNever()` is only needed where children are added to an already-tracked parent graph. `ResourceImage` rows are written by `DbSet<ResourceImage>.Add()` in a service, so default-generated is correct.

**FK: agree on the shape, with changes.**

- Use `entity.HasOne<ResourceImage>().WithMany().HasForeignKey(e => e.PrimaryImageId).OnDelete(DeleteBehavior.SetNull)` on each of the four owners. This matches the `Hunter` → `Playbook` pattern (`WithMany()` with no navigation), which is the existing precedent for a reference with no back-collection.
- **No cycle.** `ResourceImage` has no FK back to an owner, so the schema has no circular FK, and SQLite's `EnsureCreatedAsync` builds it without ordering issues.
- **Add FK indexes.** Postgres does not index referencing columns automatically, and this codebase indexes every FK column (`idx_minions_monster_id`, `idx_hunters_playbook_id`, …). Add `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`, `idx_bystanders_primary_image_id`, `idx_locations_primary_image_id`. SetNull on an image delete scans these columns otherwise.
- The phases doc does not state an explicit table name for `ResourceImage`. Use `resource_images`, and snake_case columns per the rest of `MotwDbContext.cs`.

**Index: change.**

- Phases §1 item 2 writes `HasIndex(e => new { e.OwnerType, e.OwnerId, e.SortOrder })` with no name. The codebase convention is always `.HasDatabaseName("idx_<table>_<cols>")`. Use `idx_resource_images_owner_sort`.
- The index is correct for derivation and the owner list. It is not unique, and it should stay non-unique (see §4, race).

**`OwnerType` as string: this is new, not existing.** Phases §1 Phase 1 says "matching how this codebase already prefers explicit string/enum discriminators." I grepped `MotwDbContext.cs`: there is no `HasConversion` anywhere, and no enum-typed column in the existing entities I checked. Either add `.HasConversion<string>()` and say so in the phase text as a first-of-its-kind decision, or store a `varchar(16)` written by the service. I recommend `HasConversion<string>()` with `HasMaxLength(16)`, since it keeps raw SQL readable.

**`CreatedAt`: a trap.** `ApplyTimestamps()` in `MotwDbContext.cs` (~line 1042) only touches `ITimestamped` entries. `ResourceImage` must not implement `ITimestamped` (the design rightly says it shouldn't need `UpdatedAt`), so `CreatedAt` must be set explicitly in `ResourceImageService` at construction. Otherwise it is `default(DateTimeOffset)`. Add a test that asserts `CreatedAt != default`.

## 4. Eight projection sites: count right, mechanism wrong for four

**Count: 8 is correct.** Confirmed by grepping `new (Monster|Minion|Location|Bystander)ListItemResponse(`:

| Owner | Site | How it is projected today |
|---|---|---|
| Monster | `MonsterRepository.GetAllAsync` | **SQL** — `Monsters.Select(...)` on `IQueryable` |
| Monster | `MonsterRepository.GetMonstersByMysteryIdAsync` | **SQL** |
| Minion | `MinionRepository.GetAllAsync` | **SQL** |
| Minion | `MinionRepository.GetByMonsterIdAsync` | **SQL** |
| Location | `LocationRepository.GetAllLocationsAsync` → `LocationService.GetAllAsync` | **In-memory** over `Include`d entities |
| Location | `LocationRepository.GetLocationsByMysteryIdAsync` → `LocationService.GetByMysteryAsync` | **In-memory** |
| Bystander | `BystanderRepository.GetAllBystandersAsync` → `BystanderService.GetAllAsync` | **In-memory** |
| Bystander | `BystanderRepository.GetBystandersByMysteryIdAsync` → `BystanderService.GetByMysteryAsync` | **In-memory** |

**The mechanism issue.** Phases §1 item 4 and the workflow doc §2.3 propose a correlated subquery in the projection. That works for the four SQL sites. It cannot be used in the four `LocationService`/`BystanderService` `.Select(...)` calls, because those run in memory after `ToListAsync`. Options, in order of preference:

1. **Convert the four Location/Bystander reads to SQL projections in the repositories**, matching Monster and Minion. This is the cleanest and removes the in-memory `.Select` duplication. It is a larger change than the phases doc implies, and it should be named as its own sub-task in Phase 4.
2. Keep the entity graph and add **one grouped query per list** in the repository: `ResourceImages.Where(o => o.OwnerType == X).GroupBy(i => i.OwnerId).Select(g => new { OwnerId = g.Key, Id = g.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Id).First() })`, then merge in memory with `PrimaryImageId ?? derived`. One extra query per list, not per row. Acceptable at this scale.

Do not do a per-row query in the in-memory `.Select`.

**The SQL form (Monster, Minion), if used:**

```csharp
PrimaryImageId = x.PrimaryImageId
    ?? dbContext.ResourceImages
        .Where(i => i.OwnerType == ResourceOwnerType.Monster && i.OwnerId == x.Id)
        .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
        .Select(i => (Guid?)i.Id)
        .FirstOrDefault()
```

- EF Core supports referencing a second `DbSet` inside a projection and correlating it to the outer row. There is no navigation, so the `OwnerId` correlation is explicit. I have not run the translation; Bowser's Phase 4 must check the generated SQL once with EF logging. Expected output is `COALESCE(primary_image_id, (SELECT ... ORDER BY sort_order, id LIMIT 1))`.
- **Add `.ThenBy(i => i.Id)`.** The race accepted in §3.3 can produce duplicate `SortOrder` values. Without a deterministic tie-break, the list and `GET .../images` can disagree on which image is derived primary, and the agreement test becomes flaky. Use the same ordering in `IResourceImageService`. This is a required change to the stated rule, not a style point.
- Postgres translation: the `(Guid?)` cast and `COALESCE` translate cleanly. I see no reason it would not, but the generated SQL must be read, not assumed.

## 5. Migration strategy

**How it works here.** `Program.cs` calls `MotwDbInitializer.InitializeAsync`, which calls `Database.MigrateAsync()` on every startup, before `MapControllers`. That means:

- Migrations **apply automatically when the app starts**, locally and on Railway. There is no separate migrate step to run.
- Migrations are created with `dotnet ef migrations add <Name>` using `MotwDbContextFactory` (design-time, reads `appsettings.json`). Creating a migration does not need a running database.
- Migration naming follows `AddPickRules`, `AddHunterBespokeAnswers`, etc. Use `AddResourceImages`.

**Phase 1 handling.** No special handling is needed:

- `resource_images` is a new table. The four `primary_image_id` columns are new, nullable, and have no default. Adding nullable columns with FKs to existing tables with rows is safe because every existing row gets NULL, which is the intended value.
- It is **additive and reversible**. `Down` drops the FKs, the columns, and the table. There is no data transform.
- Fresh local DB and existing DB behave identically. No data step is needed for hunter test data or any other table.

**Gate additions:**

- `dotnet ef migrations has-pending-model-changes` (EF Core 9+) returns clean after the migration is added. This is a stronger gate than "clean diff," which is a manual visual check.
- Start the app against an empty Postgres (`docker compose up -d postgres`, which already exists in the repo on port 5432) and confirm startup logs show the migration applied and the app serves `GET /api/monsters`.

**Note on the Postgres seed.** `PlaybookSeed` and the `Playbook` migrations contain Postgres-only SQL, and their comments say no automated test runs them. The same gap applies to the new migration (see §6). Do not treat the SQLite suite as evidence the migration works.

## 6. Test strategy

**What the suite uses today.** `MonsterOfTheWeek.Api.Tests` is **SQLite**, via `UseSqlite(connection)` plus `Database.EnsureCreatedAsync()` (`MonsterRepositoryTests.cs`, `MinionReparentApiHarness.cs`, `HunterApiHarness.cs`, `PlaybookSeedTests.cs`, and others). Three facts matter here:

1. **The suite never runs migrations.** `EnsureCreatedAsync` builds the schema from the model. The `AddPickRules` migration comment says so explicitly. So the Phase 1 migration is untested by anything in the suite.
2. **SQLite enforces FKs** when EF opens the connection, which I believe is EF's default for the SQLite provider. Verify rather than assume: add one assertion in the first SetNull test, `PRAGMA foreign_keys` returns 1. The SetNull test asserts `PrimaryImageId == null` after delete, so if enforcement were off it would fail rather than pass vacuously. The failing direction is safe.
3. **Postgres-specific behaviour is not covered:** `bytea` round-tripping, `COALESCE` and correlated-subquery SQL translation, `ON DELETE SET NULL` as Postgres executes it, and migration SQL.

**Recommendation, concrete:**

- **Keep SQLite** for all service and controller tests in Phases 2 and 3. It is the existing convention, it is fast, and it covers the logic.
- **Add one env-gated Postgres test class** (`ResourceImagePostgresTests`), tagged `[Trait("Category", "Postgres")]`. It runs only when `MOTW_TEST_POSTGRES` holds a connection string, and it is run locally with `dotnet test --filter "Category=Postgres"` against the compose Postgres. It:
  - runs `Database.MigrateAsync()` (the real migration path) on a fresh database;
  - asserts delete-the-primary clears `primary_image_id` on Postgres;
  - asserts the derivation projection returns the same id as `IResourceImageService` for each of the four cases in workflow §2.2;
  - writes one `bytea` round-trip and reads it back byte-identical.
- Do not add Testcontainers. It needs Docker on Windows, is a new package, and the compose Postgres already exists.
- This follows the earlier lesson in Bowser's history: an env-gated test must not pass silently when the env var is missing without saying so. Use a `Trait` filter, not an early `return`, so a Postgres run is a deliberate command.

**Phase 4 agreement test.** The workflow doc's agreement test (list `primaryImageId` == `isPrimary` from `GET .../images`) should compare against `IResourceImageService.ListAsync` instead of HTTP. That lets it run before Phase 3, see §7.

**Test-run warning.** Do not use `dotnet test --artifacts-path`. `PickRuleTable.ApiProjectRoot()` walks up from the test assembly and fails 184 unrelated tests under that flag (recorded in Bowser's history and the README Testing section). Run `dotnet test MonsterOfTheWeek.slnx` plainly.

**Fixture bytes.** Phases §3.5 is right. Use small committed fixture files under the test project, not base64 blobs inline, so the WebP fixture is inspectable. Add one truncated-file fixture for the "corrupt but right magic bytes" case.

## 7. Corrections to phases.md (backend phases 1–4)

1. **Owner-delete leaves orphaned image bytes (missing; highest priority).** `resource_images` has no FK to its owner, so deleting an owner orphans its image rows, and the `bytea` payloads are never reclaimed. The delete paths are `MonsterRepository.DeleteMonsterAsync`, `MinionRepository` (Minion delete), `LocationRepository`, and `BystanderRepository`, all `ExecuteDeleteAsync`. Worse, **deleting a Monster cascades to its Minions at the database level** (`OnDelete(Cascade)` on `Minion.MonsterId`), so the minions' images are orphaned by a path that runs no app code. Fix in Phase 2 or 3: each owner delete first deletes that owner's `resource_images` rows, and for a Monster also the rows of its minions, in one transaction. Add a test that deletes a monster with a minion and asserts no `resource_images` rows remain. This is also the first real transaction in the codebase; say so in the commit.
2. **Decompression-bomb guard (missing; security-adjacent).** A 2 MB PNG or WebP can declare a very large canvas, for example 16,000 × 16,000, which decodes to over 1 GB. Phase 2 must check `Identify` dimensions before any decode and reject above a cap (suggest 4096 × 4096 or a pixel-count limit), with a dedicated rejection reason. This is not in the `UnsupportedType`/`TooLarge`/`CapExceeded` enum in design §3. Add `UnreadableOrOversizedDimensions` or similar, and add copy to design §7.
3. **Phase 1 index and FK naming.** Replace the unnamed index with `idx_resource_images_owner_sort`. Add four `idx_<table>_primary_image_id` indexes. State `HasConversion<string>()` as new. State `CreatedAt` is set explicitly (not `ITimestamped`).
4. **Phase 2 derivation rule needs a tie-break.** Change "lowest `SortOrder`" to "lowest `SortOrder`, then lowest `Id`" in the one rule, and use it in both the service and the list projection.
5. **Phase 2 SetNull verification.** The text says SQLite "honours `ON DELETE SET NULL` under EF." Make it an assertion (`PRAGMA foreign_keys == 1`) and move the Postgres confirmation from "confirm once" to the env-gated test class in §6.
6. **Phase 3 request limits are underspecified.** Add the 24 MiB `RequestSizeLimit` and `RequestFormLimits` values, the 2 MiB constant, and the client-side chunking rule from §2 above. The phase currently says only "explicitly configured."
7. **Phase 3 missing registration.** `IResourceImageService` is not in the `Program.cs` DI list. Add `builder.Services.AddScoped<IResourceImageService, ResourceImageService>()`.
8. **Phase 4 is wrong about how the sites are projected.** Four of eight sites are in-memory over entity graphs (Location and Bystander, §4). Phase 4 must say the repository methods change, or use the grouped-query approach. It currently says "projection in the repositories and services," which hides the difference.
9. **Phase 4 depends on Phase 3 in practice.** Phase 4 is said to be independent of Phases 2 and 3, but its verification ("agreement test with `GET .../images` passes") needs Phase 3's HTTP endpoints. Either make the agreement test use `IResourceImageService` (depends on Phase 2 only), or reorder Phase 4 after Phase 3. I recommend the former, so the Phase 2→4 chain is the true dependency.
10. **Phase 1 gate.** Replace "clean `dotnet ef migrations add` diff" with `has-pending-model-changes` returning clean, and add the empty-Postgres startup check.
11. **Phase 1 test coverage.** Add the env-gated Postgres migration test (§6) to Phase 1's verification list. Currently nothing tests the migration itself.
12. **`PUT .../primary` does not bump `UpdatedAt`.** Minor. The primary change goes through `SaveChanges`, so `ApplyTimestamps` will bump it if the owner is loaded and modified. A `DB SetNull` on delete does not bump it. Decide whether `UpdatedAt` is meant to reflect primary changes; if not, say so.

---

## Notes on items I did not change

- **Race (design §3.3 / phases §3.3):** accepted as settled. The non-unique index stays non-unique. Making `(OwnerType, OwnerId, SortOrder)` unique would turn the race into a 500 on the second insert, which is worse than the soft outcome accepted. The tie-break in §4 handles the only read-side consequence.
- **Cache-Control `private`:** agree, per workflow §2.5.
- **Authorization:** the new endpoints sit under controllers without `[AllowAnonymous]`, so the global fallback policy applies. `<img src>` is same-origin and sends the session cookie. No new auth work needed.
- **Railway request size:** deferred per Skyler. Local limits are in scope (§2).
