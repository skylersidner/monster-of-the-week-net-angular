# LC-1 — Mysteryless Location Create Endpoint (Backend)

**What:** Added `ILocationService.CreateAsync(request, ct)` overload (no `mysteryId`) + `LocationService` impl (mystery-scoped body minus `MysteryExistsAsync`/`LinkLocationToMysteryAsync`, still validates `LocationTypeExistsAsync`) + `LocationsController` `[HttpPost("api/locations")]` (coexists with `[HttpGet("api/locations")]` and the mystery-scoped `POST api/mysteries/{id}/locations` — same method name `Create`, legal C# overload, no ASP.NET route collision, same pattern as Monster's SC-1) + Angular `LocationService.createStandalone()`.

**Why:** Per `docs/updates/standalone-creation-phase3-locations.md` Resolved Decision 1 and LC-1 — direct mirror of Monster's Phase 1 SC-1 for the identical M:N-to-Mystery relationship shape (Location↔Mystery via `MysteryLocation` bridge table, no required FK).

**Judgment calls / deviations:**
- `LocationServiceTests.cs` did not exist yet (plan doc flagged this as unverified) — created it from scratch, following `MonsterServiceTests.cs`'s conventions exactly (test method names, `FakeLocationRepository` structure, `ServiceResult` assertions).
- `FakeLocationRepository` was built stateful from the start (backing `List<Location>`, `AddLocationAsync` appends + stamps a placeholder `LocationType` nav object, `GetLocationDetailAsync` looks up by id with fallback to a canned `Location`, `GetAllLocationsAsync` returns the backing list) — same fix Monster's SC-1 needed to retrofit into an already-stateless fake. Built it stateful the first time since there was no existing stateless version to work around.
- No repository or migration changes — `AddLocationAsync` was already unconditional, confirmed per the plan doc.

**Verification:** `dotnet build MonsterOfTheWeek.slnx` clean (0 warnings). `dotnet test MonsterOfTheWeek.slnx`: 98/98 passing (94 baseline + 4 new: bad-LocationTypeId validation on both overloads, standalone-create-with-empty-MysteryIds, created-location-retrievable-via-GetByIdAsync-and-appears-in-GetAllAsync).

**Not started:** LC-2 (`LocationFormComponent` extraction), LC-3 (`/locations/new` page/route/entry point), LC-4 (wire shared form into `location-detail.ts`) — all frontend, separate sub-phases.
