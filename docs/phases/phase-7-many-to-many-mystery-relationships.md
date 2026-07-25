# Phase 7 — Many-to-Many Mystery Relationships

## Summary

Convert Monster, Location, and Bystander from a single required `mystery_id` FK to many-to-many relationships via bridge tables. This allows entities to be reused across multiple mysteries.

## Problem

Previously, every Monster, Location, and Bystander was tightly coupled to exactly one Mystery via a required `mystery_id` foreign key column. This prevented an entity (e.g., a recurring monster or a well-known location) from appearing in more than one mystery.

## Solution

Replace the direct FK with three bridge tables:

| Bridge Table | Columns | PK |
|---|---|---|
| `mystery_monsters` | `mystery_id`, `monster_id` | composite |
| `mystery_locations` | `mystery_id`, `location_id` | composite |
| `mystery_bystanders` | `mystery_id`, `bystander_id` | composite |

Cascade behavior: deleting a Mystery removes its bridge records (entity persists). Deleting an entity removes its bridge records (mystery persists).

## Data Impact

- Entity table data (monsters, locations, bystanders and all child tables) is **dropped** via migration — no data preservation required.
- Reference table data (monster_types, minion_types, location_types, bystander_types, weapon_tags) is **preserved**.

## API Behaviour Changes

| Before | After |
|---|---|
| `DELETE /api/monsters/{id}` — hard deletes the entity | Removed |
| *(no route)* | `DELETE /api/mysteries/{mysteryId}/monsters/{id}` — **unlinks** entity from mystery (entity persists) |
| `MonsterListItemResponse.MysteryId: Guid` | `MonsterListItemResponse.MysteryIds: Guid[]` |
| `MonsterDetailResponse.MysteryId: Guid` | `MonsterDetailResponse.MysteryIds: Guid[]` |
| Same changes apply to Location and Bystander responses | |

## Files Changed

- `src/api/.../Data/Entities/DomainEntities.cs` — new join entities; removed `MysteryId` FK from Monster/Location/Bystander
- `src/api/.../Data/MotwDbContext.cs` — new DbSets; updated Fluent API config
- `src/api/.../Data/Migrations/` — migration `RemoveMysteryFKAddBridgeTables`
- `src/api/.../Repositories/I*Repository.cs` — added Link/Unlink methods; updated list queries
- `src/api/.../Repositories/*Repository.cs` — implementations updated
- `src/api/.../Services/I*Service.cs` — `DeleteAsync` replaced with `UnlinkFromMysteryAsync`
- `src/api/.../Services/*Service.cs` — create flow: add entity then create bridge record
- `src/api/.../Contracts/ApiContracts.cs` — DTO changes
- `src/api/.../Contracts/ApiMappers.cs` — mapping updates
- `src/api/.../Controllers/MonstersController.cs` — new unlink route
- `src/api/.../Controllers/LocationsController.cs` — new unlink route
- `src/api/.../Controllers/BystandersController.cs` — new unlink route
- `docs/seeds/the-quiet-seed.sql` — updated to use bridge tables
