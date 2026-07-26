# Minion Table Extraction — Migration Plan

**Prepared by:** Yoshi (Architect)  
**Status:** Revised — pending implementation  
**Last updated:** 2026-07-25

---

## Background

Minions are currently stored as `Monster` records in the `monsters` table, distinguished only by having a `minion_type_id` FK set while `monster_type_id` is null. This is ambiguous, creates schema noise, and has become unworkable now that monsters can belong to multiple mysteries. This plan extracts minions into their own first-class table.

**Core model:** A minion belongs to exactly one monster. A monster can have many minions. When a monster is linked to a mystery, its minions come with it implicitly — there is no direct minion↔mystery relationship.

---

## Resolved Decisions

1. **Type fields are required in both forms.**  
   `monster_type_id` on the monster form and `minion_type_id` on the minion form are both NOT NULL at the DB level. The wizard must enforce selection of both type dropdowns. Monster type is always required. Minion type is required whenever the user provides a minion name.

2. **Single minion per monster in the wizard for now; multi-minion deferred.**  
   The schema supports many minions per monster, but the wizard will continue to present a single minion form. Multi-minion wizard support is in the deferred list.

---

## 1. Current State

- Minions live in the `monsters` table (`minion_type_id IS NOT NULL` = a minion record).
- `UpsertMonsterRequest` carries both `monsterTypeId` and `minionTypeId`.
- The mystery creation wizard (Phase 1, Step 1) saves the minion using the same `MonsterService.create(mysteryId, ...)` call as the monster, relying on `minionTypeId` to distinguish them.
- In edit mode, the store identifies the minion by `m.minionTypeId != null`.

---

## 2. New Database Schema

### New `minions` Table

```sql
CREATE TABLE minions (
    id              UUID PRIMARY KEY,
    monster_id      UUID NOT NULL,
    minion_type_id  UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    harm_capacity   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_minions_monster
        FOREIGN KEY (monster_id)
        REFERENCES monsters(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_minions_minion_type
        FOREIGN KEY (minion_type_id)
        REFERENCES minion_types(id)
);

CREATE INDEX idx_minions_monster_id     ON minions(monster_id);
CREATE INDEX idx_minions_minion_type_id ON minions(minion_type_id);
```

### New Minion Sub-Entity Tables

Each mirrors its monster counterpart, with `minion_id` instead of `monster_id`.

| Table | FK | Notes |
|---|---|---|
| `minion_attacks` | `minion_id` NOT NULL → `minions.id` CASCADE | |
| `minion_attack_weapon_tags` | composite PK (`minion_attack_id`, `weapon_tag_id`) | |
| `minion_powers` | `minion_id` NOT NULL → `minions.id` CASCADE | |
| `minion_armors` | `minion_id` NOT NULL → `minions.id` CASCADE | |
| `minion_weaknesses` | `minion_id` NOT NULL → `minions.id` CASCADE | |
| `minion_custom_moves` | `minion_id` NOT NULL → `minions.id` CASCADE | |

### Changes to `monsters` Table

```sql
-- Remove the minion column
ALTER TABLE monsters DROP COLUMN minion_type_id;

-- Enforce monster type (every monster must have a type)
ALTER TABLE monsters ALTER COLUMN monster_type_id SET NOT NULL;
```

### Relationship Summary

```
mysteries  ──< mystery_monsters >──  monsters ──< minions
                                     (1 monster)   (many minions)
```

Minions are implicitly "in" a mystery through their monster. There is no direct minion↔mystery FK or bridge table.

---

## 3. EF Core Migration — `ExtractMinionsToOwnTable`

### Up() Steps

1. Create `minions` table.
2. Create `minion_attacks`, `minion_attack_weapon_tags`, `minion_powers`, `minion_armors`, `minion_weaknesses`, `minion_custom_moves` tables.
3. **Data migration** (SQL within `migrationBuilder.Sql()`):
   ```sql
   -- a. Identify current minion records in monsters
   -- b. Insert into minions (monster_id comes from mystery_monsters lookup)
   INSERT INTO minions (id, monster_id, minion_type_id, name, description, harm_capacity, created_at, updated_at)
   SELECT m.id, mm.monster_id AS monster_id, m.minion_type_id, m.name, m.description, m.harm_capacity, m.created_at, m.updated_at
   FROM monsters m
   -- join to find which "pure" monster this minion belongs to in the same mystery
   JOIN mystery_monsters mm_minion ON mm_minion.monster_id = m.id
   JOIN mystery_monsters mm_pure   ON mm_pure.mystery_id = mm_minion.mystery_id
   JOIN monsters pure              ON pure.id = mm_pure.monster_id AND pure.minion_type_id IS NULL
   WHERE m.minion_type_id IS NOT NULL;

   -- c. Copy minion sub-entities into new tables
   INSERT INTO minion_attacks SELECT ... FROM monster_attacks WHERE monster_id IN (SELECT id FROM monsters WHERE minion_type_id IS NOT NULL);
   -- (repeat for powers, armors, weaknesses, custom_moves, attack_weapon_tags)

   -- d. Delete minion records from monster sub-entity tables
   DELETE FROM monster_attacks WHERE monster_id IN (SELECT id FROM monsters WHERE minion_type_id IS NOT NULL);
   -- (repeat for other sub-entity tables)

   -- e. Delete minion records from mystery_monsters bridge
   DELETE FROM mystery_monsters WHERE monster_id IN (SELECT id FROM monsters WHERE minion_type_id IS NOT NULL);

   -- f. Delete minion records from monsters
   DELETE FROM monsters WHERE minion_type_id IS NOT NULL;
   ```
4. Drop `minion_type_id` column from `monsters`.
5. Alter `monster_type_id` to `NOT NULL` on `monsters`.

### Down() Steps

Reverse all the above: restore `minion_type_id` column, re-insert minion records into `monsters` from `minions`, drop minion tables.

> ⚠️ **Note:** The data migration in Up() assumes each mystery has at most one "pure" monster and one minion — which is true for existing data. If that assumption is ever violated, the migration will need adjustment.

---

## 4. API Changes

### 4.1 Entity Classes

**New file:** `Data/Entities/MinionEntities.cs`

```csharp
public sealed class Minion : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }           // NOT NULL — required FK
    public Guid MinionTypeId { get; set; }        // NOT NULL — required FK
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmCapacity { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Monster Monster { get; set; } = null!;
    public MinionType MinionType { get; set; } = null!;
    public ICollection<MinionAttack> Attacks { get; set; } = [];
    public ICollection<MinionPower> Powers { get; set; } = [];
    public ICollection<MinionArmor> Armors { get; set; } = [];
    public ICollection<MinionWeakness> Weaknesses { get; set; } = [];
    public ICollection<MinionCustomMove> CustomMoves { get; set; } = [];
}

public sealed class MinionAttack
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int Harm { get; set; }
    public Minion Minion { get; set; } = null!;
    public ICollection<MinionAttackWeaponTag> MinionAttackWeaponTags { get; set; } = [];
}

public sealed class MinionAttackWeaponTag
{
    public Guid MinionAttackId { get; set; }
    public Guid WeaponTagId { get; set; }
    public MinionAttack MinionAttack { get; set; } = null!;
    public WeaponTag WeaponTag { get; set; } = null!;
}

public sealed class MinionPower
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Minion Minion { get; set; } = null!;
}

public sealed class MinionArmor
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmSoak { get; set; }
    public bool IsSpecial { get; set; }
    public string? SpecialDescription { get; set; }
    public Minion Minion { get; set; } = null!;
}

public sealed class MinionWeakness
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Minion Minion { get; set; } = null!;
}

public sealed class MinionCustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Minion Minion { get; set; } = null!;
}
```

**Changes to existing entities:**
- **`Monster`**: Remove `MinionTypeId` property and `MinionType` navigation. Add `ICollection<Minion> Minions { get; set; } = [];`.
- **`MinionType`**: Remove `ICollection<Monster> Monsters` navigation (replaced by `ICollection<Minion> Minions`).

### 4.2 DbContext

Add `DbSet<>` properties for all new entities. Update `OnModelCreating`:

```csharp
public DbSet<Minion> Minions => Set<Minion>();
public DbSet<MinionAttack> MinionAttacks => Set<MinionAttack>();
public DbSet<MinionAttackWeaponTag> MinionAttackWeaponTags => Set<MinionAttackWeaponTag>();
public DbSet<MinionPower> MinionPowers => Set<MinionPower>();
public DbSet<MinionArmor> MinionArmors => Set<MinionArmor>();
public DbSet<MinionWeakness> MinionWeaknesses => Set<MinionWeakness>();
public DbSet<MinionCustomMove> MinionCustomMoves => Set<MinionCustomMove>();
```

In `OnModelCreating`:
- Remove `minionTypeId` configuration from the `Monster` entity block.
- Add `monster_type_id` as required (non-nullable) in the `Monster` entity block.
- Add complete configuration for `Minion`, `MinionAttack`, `MinionAttackWeaponTag`, `MinionPower`, `MinionArmor`, `MinionWeakness`, `MinionCustomMove` — mirroring existing monster configuration patterns.

### 4.3 Repository

**New:** `Repositories/IMinionRepository.cs` and `Repositories/MinionRepository.cs`

Key methods (mirrors `IMonsterRepository` scoped to a `monsterId`):

```csharp
public interface IMinionRepository
{
    Task<bool> MonsterExistsAsync(Guid monsterId, CancellationToken ct);
    Task<bool> MinionExistsAsync(Guid id, CancellationToken ct);
    Task<bool> MinionTypeExistsAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<MinionListItemResponse>> GetByMonsterIdAsync(Guid monsterId, CancellationToken ct);
    Task<Minion?> GetDetailAsync(Guid id, CancellationToken ct);
    Task<Minion?> GetForUpdateAsync(Guid id, CancellationToken ct);
    Task AddAsync(Minion minion, CancellationToken ct);

    // Attacks
    Task<IReadOnlyList<MinionAttack>> GetAttacksAsync(Guid minionId, CancellationToken ct);
    Task<MinionAttack?> GetAttackAsync(Guid minionId, Guid attackId, bool includeTags, CancellationToken ct);
    Task AddAttackAsync(MinionAttack attack, CancellationToken ct);
    Task<int> DeleteAttackAsync(Guid minionId, Guid attackId, CancellationToken ct);
    Task<bool> AttackWeaponTagAssignedAsync(Guid attackId, Guid tagId, CancellationToken ct);
    Task AssignAttackWeaponTagAsync(MinionAttackWeaponTag value, CancellationToken ct);
    Task<int> RemoveAttackWeaponTagAsync(Guid attackId, Guid tagId, CancellationToken ct);

    // Powers, Armors, Weaknesses, CustomMoves — same CRUD pattern

    Task SaveChangesAsync(CancellationToken ct);
}
```

**Changes to `IMonsterRepository` / `MonsterRepository`:**
- Remove `MinionTypeExistsAsync` (belongs in `IMinionRepository`).
- Remove any queries that filter by `minion_type_id`.

### 4.4 Service

**New:** `Services/IMinionService.cs` and `Services/MinionService.cs`

```csharp
public interface IMinionService
{
    Task<ServiceResult<IReadOnlyList<MinionListItemResponse>>> GetByMonsterAsync(Guid monsterId, CancellationToken ct);
    Task<ServiceResult<MinionDetailResponse>> CreateAsync(Guid monsterId, UpsertMinionRequest request, CancellationToken ct);
    Task<MinionDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ServiceResult<MinionDetailResponse>> UpdateAsync(Guid id, UpsertMinionRequest request, CancellationToken ct);

    // Attack / Power / Armor / Weakness / CustomMove CRUD — same pattern as IMonsterService
}
```

**Changes to `IMonsterService` / `MonsterService`:**
- Remove the `minionTypeId` branch from `ValidateTypesAsync` (or equivalent validation).
- `UpsertMonsterRequest.monsterTypeId` is required — add server-side validation (400 if missing) and mark the field required in the `monsterForm` (`Validators.required`).

### 4.5 Contracts (DTOs)

**Add to `ApiContracts.cs`:**

```csharp
public sealed record MinionListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId,
    string MinionTypeName,
    int AttackCount,
    int PowerCount,
    int ArmorCount,
    int WeaknessCount,
    DateTimeOffset CreatedAt);

public sealed record MinionDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId,
    string MinionTypeName,
    IReadOnlyList<MinionAttackResponse> Attacks,
    IReadOnlyList<MinionPowerResponse> Powers,
    IReadOnlyList<MinionArmorResponse> Armors,
    IReadOnlyList<MinionWeaknessResponse> Weaknesses,
    IReadOnlyList<CustomMoveResponse> CustomMoves);

public sealed record UpsertMinionRequest(
    string Name,
    string? Description,
    int HarmCapacity,
    Guid MinionTypeId);     // non-nullable — required

public sealed record MinionAttackResponse(Guid Id, string Name, string? Description, int Harm, IReadOnlyList<WeaponTagRefResponse> WeaponTags);
public sealed record MinionPowerResponse(Guid Id, string Name, string? Description);
public sealed record MinionArmorResponse(Guid Id, string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record MinionWeaknessResponse(Guid Id, string Name, string? Description);
public sealed record UpsertMinionAttackRequest(string Name, string? Description, int Harm);
public sealed record UpsertMinionPowerRequest(string Name, string? Description);
public sealed record UpsertMinionArmorRequest(string Name, string? Description, int HarmSoak, bool IsSpecial, string? SpecialDescription);
public sealed record UpsertMinionWeaknessRequest(string Name, string? Description);
```

**Remove from existing contracts:**
- `minionTypeId` / `minionTypeName` from `MonsterListItemResponse` and `MonsterDetailResponse`.
- `minionTypeId` from `UpsertMonsterRequest`.

### 4.6 Mappers

Add `ToResponse()` extension methods in `ApiMappers.cs` for `Minion`, `MinionAttack`, `MinionPower`, `MinionArmor`, `MinionWeakness`, `MinionCustomMove` — mirroring the existing monster mapper extensions.

### 4.7 Controller

**New:** `Controllers/MinionsController.cs`

Routes scoped under the monster:

```
GET    api/monsters/{monsterId}/minions           → list minions for a monster
POST   api/monsters/{monsterId}/minions           → create minion for a monster
GET    api/minions/{id}                           → get minion detail
PUT    api/minions/{id}                           → update minion
GET    api/minions/{id}/attacks                   → list attacks
POST   api/minions/{id}/attacks                   → add attack
DELETE api/minions/{id}/attacks/{attackId}        → remove attack
POST   api/minions/{id}/attacks/{attackId}/tags   → assign weapon tag
DELETE api/minions/{id}/attacks/{attackId}/tags/{tagId}
GET    api/minions/{id}/powers                    → list powers
POST   api/minions/{id}/powers                    → add power
DELETE api/minions/{id}/powers/{powerId}
GET    api/minions/{id}/armors                    → list armors
POST   api/minions/{id}/armors                    → add armor
DELETE api/minions/{id}/armors/{armorId}
GET    api/minions/{id}/weaknesses                → list weaknesses
POST   api/minions/{id}/weaknesses                → add weakness
DELETE api/minions/{id}/weaknesses/{weaknessId}
GET    api/minions/{id}/custom-moves              → list custom moves
POST   api/minions/{id}/custom-moves              → add custom move
DELETE api/minions/{id}/custom-moves/{moveId}
```

**Changes to `MonstersController`:**
- Remove `minionTypeId` / `minionTypeName` from response serialization.
- Remove any minion-routing endpoints.

**Register services in `Program.cs`:**
```csharp
builder.Services.AddScoped<IMinionRepository, MinionRepository>();
builder.Services.AddScoped<IMinionService, MinionService>();
```

---

## 5. Angular UI Changes

### 5.1 Core Models (`core/models.ts`)

**Add:**

```typescript
export interface MinionListItemResponse {
  id: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  minionTypeId: string;       // non-nullable
  minionTypeName: string;
  attackCount: number;
  powerCount: number;
  armorCount: number;
  weaknessCount: number;
  createdAt: string;
}

export interface MinionDetailResponse {
  id: string;
  name: string;
  description: string | null;
  harmCapacity: number;
  minionTypeId: string;       // non-nullable
  minionTypeName: string;
  attacks: MinionAttackResponse[];
  powers: MinionPowerResponse[];
  armors: MinionArmorResponse[];
  weaknesses: MinionWeaknessResponse[];
  customMoves: CustomMoveResponse[];
}

export interface UpsertMinionRequest {
  name: string;
  description: string | null;
  harmCapacity: number;
  minionTypeId: string;       // non-nullable
}

export interface MinionAttackResponse {
  id: string;
  name: string;
  description: string | null;
  harm: number;
  weaponTags: WeaponTagRefResponse[];
}

export interface MinionPowerResponse   { id: string; name: string; description: string | null; }
export interface MinionArmorResponse   { id: string; name: string; description: string | null; harmSoak: number; isSpecial: boolean; specialDescription?: string | null; }
export interface MinionWeaknessResponse { id: string; name: string; description: string | null; }
```

**Remove from existing interfaces:**
- `minionTypeId` and `minionTypeName` from `MonsterListItemResponse` and `MonsterDetailResponse`.
- `minionTypeId` from `UpsertMonsterRequest`.

### 5.2 New `MinionService` (`core/minion.ts`)

```typescript
@Injectable({ providedIn: 'root' })
export class MinionService {
  private readonly api = inject(ApiService);

  getByMonster(monsterId: string): Observable<MinionListItemResponse[]> {
    return this.api.get<MinionListItemResponse[]>(`/api/monsters/${monsterId}/minions`);
  }

  create(monsterId: string, request: UpsertMinionRequest): Observable<MinionDetailResponse> {
    return this.api.post<UpsertMinionRequest, MinionDetailResponse>(
      `/api/monsters/${monsterId}/minions`, request
    );
  }

  getById(minionId: string): Observable<MinionDetailResponse> {
    return this.api.get<MinionDetailResponse>(`/api/minions/${minionId}`);
  }

  update(minionId: string, request: UpsertMinionRequest): Observable<MinionDetailResponse> {
    return this.api.put<UpsertMinionRequest, MinionDetailResponse>(`/api/minions/${minionId}`, request);
  }

  // Attack CRUD
  createAttack(minionId: string, req: UpsertMinionAttackRequest): Observable<MinionAttackResponse> { ... }
  deleteAttack(minionId: string, attackId: string): Observable<void> { ... }
  assignAttackTag(minionId: string, attackId: string, req: AssignWeaponTagRequest): Observable<void> { ... }
  removeAttackTag(minionId: string, attackId: string, tagId: string): Observable<void> { ... }

  // Power / Armor / Weakness / CustomMove CRUD — same pattern
}
```

### 5.3 `MonsterService` (`core/monster.ts`)

Remove minion-related methods (if any exist). Remove `minionTypeId` from any type guards or helpers.

### 5.4 Mystery Create Store (`mystery-create.store.ts`)

**Visual changes: none.** The wizard UI does not change.

**Logic changes:**

**`submitPhase1` — minion save:**

Currently saves the minion as a monster record:
```typescript
// OLD
this.monsterService.create(mysteryId, minionRequest)
```

Update to use the monster's ID (already available in the `switchMap`) and the new `MinionService`:
```typescript
// NEW
this.minionService.create(monster.id, minionRequest)
```

The full revised flow within `submitPhase1`:
1. Save/update the monster → get back `monster`.
2. Delete existing monster sub-entities and recreate them (unchanged).
3. If minion name is present, save/update the minion using `this.minionService.create(monster.id, ...)` or `this.minionService.update(editingMinionId, ...)`.
4. Delete and recreate minion sub-entities using `MinionService` attack/power/etc. methods.

**`loadEditData` — minion load:**

Currently finds the minion by `m.minionTypeId != null` in the monsters list. After migration, minions are fetched from a separate endpoint. Update the `forkJoin` to include:

```typescript
// After identifying pureMonster.id:
minions: pureMonster ? this.minionService.getByMonster(pureMonster.id) : of([])
```

Then populate `editingMinionId`, `minionForm`, and `minionAttacks` etc. from the first minion in the result (single-minion assumption preserved).

**Form validation — monster type:**

Add `Validators.required` to the `monsterTypeId` control on `monsterForm`. This is always required. The existing `validateCurrentStep()` check for `phase === 1 && step === 0` already calls `monsterForm.markAllAsTouched()` — the added validator will surface the error naturally.

**Form validation — minion type:**

Add conditional validation to `minionTypeId` in `submitPhase1`: if the minion name is non-empty but `minionTypeId` is empty, set a `submitError` and abort before calling `minionService.create`. The minion type dropdown should also show a required indicator in the template when a minion name has been entered.

**`editingMinionId` type:**

Currently `string | null` (tracking a monster ID). No type change needed; semantics just shift to tracking a real minion ID.

### 5.5 Monster Create / Edit Pages

Remove the `minionTypeId` field from any monster create/edit forms. Update the `UpsertMonsterRequest` calls to omit `minionTypeId`.

### 5.6 Deferred (Out of Scope for This Migration)

- Standalone minion detail page (`features/minions/pages/minion-detail/`)
- Minions list page (`features/minions/pages/minions-list/`)
- Left nav "Minions" link
- **Multi-minion support in the mystery creation wizard** — schema supports it; wizard UI currently allows one minion per monster only
- Displaying minions on the monster detail page

---

## 6. Out of Scope (Full List)

- Displaying minions on the monster details page (explicitly deferred by owner)
- Standalone minion detail page and left nav link (deferred)
- **Multi-minion wizard support** — schema-ready; deferred by owner for a follow-on story
- Minion-to-minion relationships
- Advanced minion filtering / search
- Bulk import
- Separate minion audit trail

---

## 7. Implementation Order

### Phase 1 — Database & EF Core (2–3 days)

1. Create new entity classes (`MinionEntities.cs`).
2. Update `MotwDbContext` (`DbSet` properties + `OnModelCreating` config).
3. Write EF Core migration `ExtractMinionsToOwnTable` (schema + data migration SQL).
4. Run migration against dev DB; verify data integrity.
5. Confirm `monster_type_id NOT NULL` enforcement.

### Phase 2 — API Layer (3–4 days, overlaps Phase 1)

1. Implement `IMinionRepository` / `MinionRepository`.
2. Implement `IMinionService` / `MinionService`.
3. Add minion DTOs to `ApiContracts.cs`.
4. Add minion mapper extensions to `ApiMappers.cs`.
5. Create `MinionsController`.
6. Remove minion fields from `MonstersController`, monster DTOs, `MonsterService`.
7. Register new services in `Program.cs`.
8. Test all endpoints.

### Phase 3 — Angular UI (2–3 days, starts after API contracts are stable)

1. Update `core/models.ts` (add minion types, remove minion fields from monster types).
2. Create `core/minion.ts` service.
3. Update `core/monster.ts` (remove minion methods/fields).
4. Update `mystery-create.store.ts` (`submitPhase1` and `loadEditData`).
5. Update monster create/edit forms (remove `minionTypeId` field).
6. Test full wizard flow: create mystery → set monster → set minion → verify correct API calls.
7. Test edit mode: load existing mystery, verify minion loads from `api/monsters/{id}/minions`.

### Phase 4 — Integration Testing (1–2 days)

1. End-to-end: create mystery with monster and minion → verify `minions` table populated, `monsters` table has no minion records.
2. Edit mode round-trip.
3. Monster deletion cascades to minions.
4. Verify `monster_type_id NOT NULL` enforced (attempt to create monster without type → expect 400/422).
5. Verify `minion_type_id` required in UI when minion name is provided.

### Parallelization

- Phases 1 and 2 can start in parallel once entity classes are drafted (Bowser can begin repository work while migration is being written).
- Phase 3 can start mocking against agreed contracts while Phase 2 is in progress (Luigi can build against an agreed contract shape before endpoints are live).
