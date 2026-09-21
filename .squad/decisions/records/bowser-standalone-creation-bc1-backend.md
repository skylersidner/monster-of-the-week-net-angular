# BC-1 — Mysteryless Bystander Create Endpoint (Backend)

**What:** Added `IBystanderService.CreateAsync(request, ct)` overload (no `mysteryId`) + `BystanderService` impl (mystery-scoped body minus `MysteryExistsAsync`/`LinkBystanderToMysteryAsync`, still validates `BystanderTypeExistsAsync`) + `BystandersController` `[HttpPost("api/bystanders")]` (coexists with `[HttpGet("api/bystanders")]` and the mystery-scoped `POST api/mysteries/{id}/bystanders` — same method name `Create`, legal C# overload, no ASP.NET route collision, same pattern as Monster's SC-1 / Location's LC-1) + Angular `BystanderService.createStandalone()`.

**Why:** Per `docs/updates/standalone-creation-phase4-bystanders.md` Resolved Decision 1 and BC-1 — direct mirror of Location's LC-1 / Monster's Phase 1 SC-1 for the identical M:N-to-Mystery relationship shape (Bystander↔Mystery via `MysteryBystander` bridge table, no required FK).

**Judgment calls / deviations:**
- `BystanderServiceTests.cs` did not exist yet (plan doc confirmed this) — created it from scratch, following `LocationServiceTests.cs`'s conventions exactly (test method names, `FakeBystanderRepository` structure, `ServiceResult` assertions).
- `FakeBystanderRepository` built stateful from the start (backing `List<Bystander>`, `AddBystanderAsync` appends + stamps a placeholder `BystanderType` nav object, `GetBystanderDetailAsync` looks up by id with fallback to a canned `Bystander`, `GetAllBystandersAsync` returns the backing list) — mirrors `FakeLocationRepository`'s stateful-from-the-start shape, no retrofit needed.
- No repository or migration changes — `AddBystanderAsync` was already unconditional, confirmed per the plan doc.
- No deviations from the plan doc's controller snippet — used it verbatim.

**Verification:** `dotnet build MonsterOfTheWeek.slnx` clean (0 warnings). `dotnet test MonsterOfTheWeek.slnx`: 102/102 passing (98 baseline + 4 new: bad-BystanderTypeId validation on both overloads, standalone-create-with-empty-MysteryIds, created-bystander-retrievable-via-GetByIdAsync-and-appears-in-GetAllAsync). No stale `dotnet run` process this time.

**Not started:** BC-2 (`BystanderFormComponent` extraction), BC-3 (`/bystanders/new` page/route/entry point), BC-4 (wire shared form into `bystander-detail.ts`) — all frontend, separate sub-phases. This was also the last of the four "standalone creation" domains' backend halves (Monster/Minion/Location/Bystander) — Minion never needed one (required FK, no gap).
