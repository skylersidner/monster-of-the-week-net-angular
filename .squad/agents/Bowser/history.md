## Learnings

### Phase 8a — Flat minion list API (2026-07-25)
- Extended `MinionListItemResponse` with `MonsterId` (Guid) and `MonsterName` (string) positional params after `Id`
- Updated `GetByMonsterIdAsync` in `MinionRepository` to pass `x.MonsterId` and `x.Monster.Name` — EF Core projects nav property in SELECT without explicit Include
- Added `GetAllAsync` to `IMinionRepository`, `MinionRepository`, `IMinionService`, `MinionService`
- Added `GET /api/minions` endpoint to `MinionsController` (returns flat list ordered by monster name, then minion name)
- `MonsterOfTheWeek.Api` project builds clean; 5 pre-existing test failures in `MonsterServiceTests` (FakeMonsterRepository / IMonsterRepository mismatch — unrelated to minion changes)

### AddMonsterArchetype feature (2026-08-01) — requested by Skyler Sidner
- Added `MonsterArchetype` entity to `DomainEntities.cs` (after `AdventureType`, before `Mystery`)
- Added `MonsterArchetypeId` (FK) and `MonsterArchetype` nav prop to `Monster` entity
- Added `DbSet<MonsterArchetype>` and full entity config in `MotwDbContext.cs`; added FK + relationship config to Monster block
- Added seeding block in `MotwDbInitializer.cs` (4 records: Heavy Hitter, Racer, Chaser, Shadow)
- Added `MonsterArchetypeResponse` and `CreateMonsterArchetypeRequest` records to `ApiContracts.cs`
- Updated `MonsterListItemResponse` to include `MonsterArchetypeResponse MonsterArchetype` (after MonsterType)
- Updated `MonsterDetailResponse` to include `MonsterArchetypeResponse MonsterArchetype` (after MonsterTypeName — kept bare fields to avoid breaking shape)
- Updated `UpsertMonsterRequest` to add `Guid? MonsterArchetypeId = null` (optional, defaults to Heavy Hitter in service layer)
- Added `MonsterArchetype.ToResponse()` extension in `ApiMappers.cs`
- Added `GetMonsterArchetypesAsync` / `AddMonsterArchetypeAsync` to `IReferenceRepository` + `ReferenceRepository`
- Added `GetMonsterArchetypesAsync` / `CreateMonsterArchetypeAsync` to `IReferenceService` + `ReferenceService`
- Added `GET /api/monster-archetypes` and `POST /api/monster-archetypes` endpoints to `ReferenceController`
- Added `MonsterArchetypeExistsAsync` to `IMonsterRepository` + `MonsterRepository`
- Updated `GetAllAsync` and `GetMonstersByMysteryIdAsync` projections to include archetype inline
- Updated `GetMonsterDetailAsync` to `.Include(x => x.MonsterArchetype)`
- Updated `MonsterService.CreateAsync` and `UpdateAsync` to validate + default archetype (Heavy Hitter UUID)
- Updated `ToDetailResponse` to pass `monster.MonsterArchetype.ToResponse()`
- Ran `dotnet ef migrations add AddMonsterArchetype`; manually fixed migration to: create table → InsertData → AddColumn with defaultValue = Heavy Hitter UUID → CreateIndex → AddForeignKey
- Also fixed pre-existing `FakeMonsterRepository` + `MonsterRepositoryTests` issues that were already broken (MysteryId removal, missing interface members)
- EF Core LINQ projections do NOT need explicit `.Include()` — navigations in `Select(...)` are automatically translated to SQL JOINs
- Solution build: green ✅

### Global Search Phase 1 — backend endpoints + ranking (2026-08-01) — requested by Skyler Sidner, design in docs/search/{architecture,phases,open-questions}.md
- New `Services/Search/` folder: `ISearchProvider`/`SearchMatchCandidate`/`SearchFieldWeight` (`ISearchProvider.cs`), `SearchTokenizer`/`SearchMatchTier` (tokenize + 4-tier predicates: Substring/BoundaryPrefix/StartsWith/Exact), 5 providers (Mystery/Monster/Minion/Location/Bystander), `ISearchService`/`SearchService`
- New `Controllers/SearchController.cs`: `GET /api/search/quick`, `GET /api/search`
- Added `SearchResultItemResponse`/`SearchResultDetailResponse`/`PagedSearchResultResponse` to `ApiContracts.cs`; `ToItemResponse()`/`ToDetailResponse()` + excerpt truncation helper in `ApiMappers.cs`
- Registered 5x `ISearchProvider` + `ISearchService` scoped in `Program.cs`
- **Deviation from architecture.md**: doc shows `EF.Functions.ILike` (Npgsql-only) chained `.Where()` clauses as the matching primitive. This repo's test convention (`MonsterRepositoryTests.cs`) runs repository-style tests against SQLite in-memory, not Npgsql — `EF.Functions.ILike` isn't translatable there. Went with: each provider does one unfiltered `.Select(x => new { Id, Name, <excerpt field> }).ToListAsync()` (cheap at this dataset's scale per the doc's own Section 1 reasoning), then `SearchTokenizer`'s tier predicates run as plain C# string comparisons in-memory. Fully portable across SQLite (tests) and Postgres (prod), and testable without a DB at all for the tier-matching logic itself.
- **Design addition not in the "illustrative" `SearchMatchCandidate` shape**: added an internal `ExcerptSource` (raw, untruncated) field to the record, populated by each provider (Hook??Concept for Mystery, Description for others) so `SearchService`/`ApiMappers` can build `Get`'s `excerpt` without a second DB round-trip or widening `ISearchProvider`'s interface (which the task pinned exactly). `GetQuick`'s mapper (`ToItemResponse`) just never reads it, satisfying "quick never computes excerpt."
- **Real bug caught only via manual curl against Postgres, not unit tests**: `SearchService.RankAsync` originally used `Task.WhenAll(providers.Select(p => p.SearchAsync(...)))`. All 5 providers share one scoped `MotwDbContext` (`AddDbContext` = scoped); EF Core's `DbContext` throws `InvalidOperationException` ("second operation started...") on concurrent async use of the same instance. Fixed to a sequential `foreach` + `await`. Unit tests with fake in-memory providers didn't catch this since `Task.FromResult` doesn't exercise real concurrency — **always manually smoke-test fan-out-to-multiple-providers-sharing-one-DbContext code against a real DB, not just xUnit with fakes**.
- **Backend enforces the 3-char minimum query length itself** (both endpoints return `[]`/empty page below it, or for empty/whitespace/dash-only queries), per the task's explicit spec. This contradicts architecture.md Section 2's closing note ("the backend does not reject short queries... the full results page URL must keep working if a user manually edits `?q=an`") — followed the task prompt since it repeated the requirement explicitly; flagged for Yoshi/Skyler in case that architecture.md note was meant to stand.
- Fixed a pre-existing (unrelated, already-broken-at-HEAD) compile error in `MonsterServiceTests.cs` line 23 — `UpsertMonsterRequest`'s `MonsterArchetypeId` is non-nullable `Guid`, test passed `null` (introduced in commit 6b035c2, never updated). One-line fix (`null` -> `Guid.NewGuid()`) was required just to get `dotnet build`/`dotnet test` running at all.
- Verified manually against real Postgres (`docker compose up -d postgres`, `dotnet run`): quick/full search, pagination across pages, tiered ranking (boundary-prefix beats substring), excerpt truncation (≤160 chars incl. trailing "…", word-boundary cut), below-min-length/empty/dash-only queries returning empty results — all correct.
- 39/39 tests green (4 pre-existing + 35 new Search tests), build clean with 0 warnings.
