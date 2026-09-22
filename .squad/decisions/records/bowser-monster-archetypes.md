### 2026-08-01: Added monster_archetypes static lookup table
**By:** Bowser (Backend Developer / DevOps) — requested by Skyler Sidner  
**What:** Added `MonsterArchetype` as a new static lookup entity wired into `Monster` as a FK, following the same full-stack pattern as `AdventureType` → `Mystery`.

**Details:**
- New table: `monster_archetypes` (id, name, description) with 4 seed records: Heavy Hitter, Racer, Chaser, Shadow
- Default for all existing and new monsters: Heavy Hitter (`f47ac10b-58cc-4372-a567-0e02b2c3d401`)
- `UpsertMonsterRequest.MonsterArchetypeId` is optional (`Guid? = null`); service layer defaults to Heavy Hitter when null
- `MonsterListItemResponse` and `MonsterDetailResponse` both include the full `MonsterArchetypeResponse` object
- Reference endpoints: `GET /api/monster-archetypes`, `POST /api/monster-archetypes`
- EF migration `AddMonsterArchetype` handles schema + seed data with correct ordering (create table → seed → add FK column with default)

**Why:** Gives monsters a behavioral archetype dimension (how they act) separate from their type (what they are), enabling richer encounter design.
