# Minion Whole-Entity Delete (Backend)

**What:** Added `IMinionRepository.DeleteMinionAsync(id, ct)` / `MinionRepository` impl (`dbContext.Minions.Where(x => x.Id == id).ExecuteDeleteAsync(ct)`) + `IMinionService.DeleteAsync(id, ct)` / `MinionService` impl (`> 0`) + `MinionsController` `[HttpDelete("api/minions/{id:guid}")]` — exact mirror of `BystanderRepository.DeleteBystanderAsync` / `BystanderService.DeleteAsync` / `BystandersController.Delete`. Also created `MinionServiceTests.cs` (did not exist previously) with 1 validation test + 2 delete tests.

**Why:** Minions previously only supported deleting sub-resources (attacks/powers/armors/weaknesses/custom moves), not the minion itself — inconsistent with Bystander and Location, which already have full delete. Requested to close that gap.

**Judgment calls / deviations:**
- Verified FK cascade delete before implementing, since `ExecuteDeleteAsync` bypasses EF's in-memory cascade tracking and issues a raw `DELETE` against the `minions` row directly. Migration `20260726000551_ExtractMinionsToOwnTable.cs` configures `onDelete: ReferentialAction.Cascade` on every Minion child table's FK (`minion_armors`, `minion_attacks`, `minion_custom_moves`, `minion_powers`, `minion_weaknesses` → `minions`; `minion_attack_weapon_tags` → `minion_attacks` transitively). Confirmed this is enforced at the database level, so no explicit child-deletion loop or new migration was needed — `ExecuteDeleteAsync(minion)` alone is sufficient and safe.
- `MinionServiceTests.cs`'s `FakeMinionRepository` implements the full (large, ~30-member) `IMinionRepository` interface with stub/no-op returns for every member not exercised by the new tests, following `BystanderServiceTests`/`LocationServiceTests`'s fake conventions.

**Verification:** Build clean (0 warnings). 105/105 tests passing (102 pre-existing + 3 new: MinionType-not-found validation, delete-returns-true-when-row-deleted, delete-returns-false-when-zero-rows-affected). Build/test output redirected to a scratch dir (`-o <path>`) to route around a locked `bin/` folder from a running `dotnet run` dev server, rather than killing the user's process.

**Not touched:** Frontend (`src/web/...`) — handled separately in parallel per task instructions.
