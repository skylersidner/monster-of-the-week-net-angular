## Learnings

### Phase 8a — Flat minion list API (2026-07-25)
- Extended `MinionListItemResponse` with `MonsterId` (Guid) and `MonsterName` (string) positional params after `Id`
- Updated `GetByMonsterIdAsync` in `MinionRepository` to pass `x.MonsterId` and `x.Monster.Name` — EF Core projects nav property in SELECT without explicit Include
- Added `GetAllAsync` to `IMinionRepository`, `MinionRepository`, `IMinionService`, `MinionService`
- Added `GET /api/minions` endpoint to `MinionsController` (returns flat list ordered by monster name, then minion name)
- `MonsterOfTheWeek.Api` project builds clean; 5 pre-existing test failures in `MonsterServiceTests` (FakeMonsterRepository / IMonsterRepository mismatch — unrelated to minion changes)
