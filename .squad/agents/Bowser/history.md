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
