# Standalone Creation SC-1 — Mysteryless Monster Create Endpoint

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-05

## What

Implemented SC-1 from `docs/updates/standalone-creation-phase1-monsters.md` (Resolved Decision 6): a second `CreateAsync` overload that creates a `Monster` with zero `MysteryMonster` links.

- `IMonsterService`: added `Task<ServiceResult<MonsterDetailResponse>> CreateAsync(UpsertMonsterRequest request, CancellationToken cancellationToken);` overload.
- `MonsterService.cs`: implemented — same body as the mystery-scoped overload minus `MysteryExistsAsync` and `LinkMonsterToMysteryAsync`. Still validates `MonsterTypeExistsAsync`/`MonsterArchetypeExistsAsync`.
- `MonstersController.cs`: added `[HttpPost("api/monsters")]` `Create(request, ct)` returning `CreatedAtAction(nameof(GetById), ...)`, matching the plan doc's exact snippet. Coexists with the existing `[HttpGet("api/monsters")]` and the mystery-scoped `[HttpPost("api/mysteries/{mysteryId:guid}/monsters")]` `Create(mysteryId, request, ct)` — legal C# method-name overload, no route collision.
- `src/web/monster-of-the-week-web/src/app/core/monster.ts`: added `createStandalone(request)` posting to `/api/monsters`, same shape as the existing `create(mysteryId, request)`.

## Test approach — deviation worth flagging

`MonsterServiceTests.cs`'s `FakeMonsterRepository` was previously stateless for `AddMonsterAsync`/`GetAllAsync`/`GetMonsterDetailAsync` (`GetAllAsync` always returned `[]`; `GetMonsterDetailAsync` always returned one canned `Monster` regardless of `id`). The plan's required coverage ("created monster is retrievable via `GetByIdAsync` and appears in `GetAllAsync`") can't be verified against a stateless fake. Made the fake minimally stateful: a backing `List<Monster>`, `AddMonsterAsync` appends (stamping placeholder `MonsterType`/`MonsterArchetype` nav objects since the real repository would have these populated after `SaveChangesAsync`+reload), `GetMonsterDetailAsync` looks up by id (falling back to the old canned object if not found, so it stays a no-op for tests that never call `AddMonsterAsync`), `GetAllAsync` projects the list to `MonsterListItemResponse` mirroring `MonsterRepository.GetAllAsync`'s real EF projection shape. Also added a `LinkMonsterToMysteryCalls` counter to assert the standalone path never links. Existing two tests untouched/still pass — this doesn't change their behavior since they never call `AddMonsterAsync`.

Added 4 tests: standalone create yields `MysteryIds: []` and 0 `LinkMonsterToMysteryCalls`; validation failure on bad `MonsterTypeId`; validation failure on bad `MonsterArchetypeId` (the plan only asked for one bad-ID case but the mystery-scoped overload's only existing test covers `MonsterTypeId`, so added the `MonsterArchetypeId` case too for symmetry); and a retrieval test (`GetByIdAsync` + membership in `GetAllAsync`).

## Verification

`dotnet build MonsterOfTheWeek.slnx`: 0 warnings, 0 errors. `dotnet test MonsterOfTheWeek.slnx`: 94/94 green (90 pre-existing + 4 new). Had to `Stop-Process` a stale `dotnet run` holding `MonsterOfTheWeek.Api.exe` locked before the first build attempt succeeded — same recurring gotcha noted in prior history entries for this repo.

No repository, migration, or other file changes — scope matched the plan doc exactly (`IMonsterService.cs`, `MonsterService.cs`, `MonstersController.cs`, `monster.ts`, `MonsterServiceTests.cs`).
