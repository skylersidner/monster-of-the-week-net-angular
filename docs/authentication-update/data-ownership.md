# Data Ownership Model

Requirement #3: *"Bind user-specific data in the database to each logged-in user — currently all data
is global/unowned."*

This is the highest-risk part of the whole update. Everything else fails loudly when it's wrong
(you can't log in, you get a 403). Ownership fails **silently**: a missed filter shows one user
another user's data and nothing errors.

**Owner resolutions folded in (2026-08-08):** #3 (per-record ownership — §2), #4 (admins cannot see
other users' game data — §5), #5 (reference data stays global and admin-write, regression accepted —
§1), #12 (no account deletion in v1, owner FK `ON DELETE RESTRICT` — §3), #2 (production starts
empty; backfill the local database only — §6). All five confirmed the recommendation. The only edits
forced by *changed* resolutions are in §6, where the account-creation step now reflects resolution #8
(bootstrap by direct database manipulation, no configuration allowlist) and the corrected resolution
#7 (email confirmation is required before first login, so the local account must be confirmed before
it can be used).

---

## 1. Per-entity classification

All 31 entities in `Data/Entities/DomainEntities.cs`, classified. There are exactly four categories.

### Owned — gets an `owner_id` column (4 entities)

| Entity | Table | Why it owns rather than derives |
|---|---|---|
| `Mystery` | `mysteries` | Independently created (`POST /api/mysteries`), independently listed (`GET /api/mysteries`), no parent FK. |
| `Monster` | `monsters` | Has **no** `MysteryId` FK — only the M:N `MysteryMonster` bridge. A monster attached to zero mysteries is a fully-supported, deliberately-shipped state (Standalone Creation Phase 1). It cannot derive ownership from a parent because it may not have one. |
| `Location` | `locations` | Same shape: M:N to Mystery only, standalone creation shipped (Phase 3). |
| `Bystander` | `bystanders` | Same shape, standalone creation shipped (Phase 4). |

These four are exactly the app's aggregate roots. Add `IOwnedEntity { Guid OwnerId { get; set; } }`
alongside the existing `ITimestamped` interface in the same file, implemented by these four only.

### Derived — ownership resolved through a parent, no column (21 entities)

| Entity | Owner resolved via |
|---|---|
| `Minion` | `Monster.OwnerId` (required `MonsterId` FK, `OnDelete(Cascade)`) |
| `Countdown` | `Mystery.OwnerId` (1:1, unique index on `mystery_id`) |
| `MysteryCustomMove` | `Mystery.OwnerId` |
| `MonsterAttack`, `MonsterPower`, `MonsterArmor`, `MonsterWeakness`, `MonsterCustomMove` | `Monster.OwnerId` |
| `MonsterAttackWeaponTag` | `MonsterAttack.Monster.OwnerId` (two hops) |
| `MinionAttack`, `MinionPower`, `MinionArmor`, `MinionWeakness`, `MinionCustomMove` | `Minion.Monster.OwnerId` (two hops) |
| `MinionAttackWeaponTag` | `MinionAttack.Minion.Monster.OwnerId` (three hops) |
| `LocationCustomMove` | `Location.OwnerId` |
| `BystanderCustomMove` | `Bystander.OwnerId` |

**`Minion` is the one judgment call here.** It is a top-level *navigational* concept — it has its own
routes (`/minions`, `/minions/:minionId`), its own flat list endpoint (`GET /api/minions`), its own
create page — which makes it look like a fifth owned root. It isn't: `Minion.MonsterId` is a
**required** FK with cascade delete. A minion cannot exist without a monster, so it cannot have an
owner different from its monster's.

**Decision: derive, do not denormalise.** Denormalising `owner_id` onto `minions` would make the flat
`GET /api/minions` filter marginally cheaper (no join) but introduces a class of bug that cannot
otherwise exist: a minion whose `owner_id` disagrees with its monster's. At this data scale
(tens-to-hundreds of rows per table — see `.squad/agents/Yoshi/history.md`, global-search planning)
the join costs nothing measurable. **Trade-off accepted:** every minion query carries
`x.Monster.OwnerId == …` instead of `x.OwnerId == …`, and if minion re-parenting is ever added it
must revalidate ownership of the new parent.

### Bridge — no column, but needs an explicit cross-owner guard (3 entities)

`MysteryMonster`, `MysteryLocation`, `MysteryBystander`.

These have no owner of their own; both endpoints are owned rows. The vulnerability is **linking**:
`POST /api/mysteries/{mysteryId}/monsters` and the equivalent location/bystander routes let a caller
attach an entity to a mystery. If only one side is ownership-checked, a caller can attach *someone
else's* monster into *their own* mystery — and then read its full detail through
`GET /api/mysteries/{id}/monsters`, which is a legitimate, owner-passing query.

**Both sides must be verified as owned by the caller before any bridge row is written.** With the
query filters in §4 this happens naturally — `MysteryExistsAsync` and `MonsterExistsAsync` both
become owner-scoped — but it must be an explicit, tested requirement, not an emergent property
someone can accidentally remove.

### Reference / system — global, never owned (7 entities + Identity)

`AdventureType`, `MonsterArchetype`, `MonsterType`, `MinionType`, `LocationType`, `BystanderType`,
`WeaponTag`.

These are exactly the seven tables `MotwDbInitializer.SeedLookupTablesAsync` seeds and exactly the
seven `ReferenceController` writes to. They stay global: readable by every authenticated user,
writable only by `DataAdmin` (`architecture.md` §3).

New system tables introduced by this update — Identity's user/role/claim/login/token tables and the
Data Protection key ring — are system data, never owned, never exposed through the domain API.
`MotwDbInitializer` gains a step that seeds the three **role rows**, so that a `SuperAdmin`
assignment can be made by hand (`architecture.md` §3); it creates no users.

> **Resolution #5 — confirmed, regression accepted knowingly.** Global reference data means one
> user's newly-added "Poltergeist" monster type appears in every other user's dropdown, and — the
> part that actually bites — **ordinary users lose the ability to add reference types at all**, which
> they have today. The alternative (per-user custom types) is a materially larger change: `owner_id`
> on all seven tables plus a "global OR mine" union in every reference query. Not taken.

---

## 2. Per-record, not per-container

Resolution #3: **per-record on the four owned roots**, as recommended. No `Campaign`/container
concept.

Reasons, from the code:

- There is no container concept in the model today, and `Mystery` is not one. Monsters, locations,
  and bystanders relate to mysteries **many-to-many**, and the deliberate, shipped design is that
  they can belong to zero mysteries. A container that half your entities can sit outside of isn't a
  container.
- Introducing a `Campaign` entity would be a new domain concept with its own CRUD, its own
  navigation, its own migration of every existing row into a default campaign, and its own
  membership model. That is a product feature, not an auth implementation detail — and explicitly
  outside this update's stated scope.

**Where a container would earn its keep** is *sharing*: co-GMs, players with read access, or a
published-template library. `owner_id` is a clean stepping stone to all of those — a future
`campaign_id` or an ACL/membership table sits alongside it, and the query filter becomes
"owned by me OR shared with me" in one place rather than in 90 repository methods. Nothing in this
design has to be undone to get there.

---

## 3. Schema changes

```
mysteries    + owner_id  uuid  NOT NULL  REFERENCES users(id) ON DELETE RESTRICT
monsters     + owner_id  uuid  NOT NULL  REFERENCES users(id) ON DELETE RESTRICT
locations    + owner_id  uuid  NOT NULL  REFERENCES users(id) ON DELETE RESTRICT
bystanders   + owner_id  uuid  NOT NULL  REFERENCES users(id) ON DELETE RESTRICT

idx_mysteries_owner_id, idx_monsters_owner_id, idx_locations_owner_id, idx_bystanders_owner_id
```

Column naming follows the existing snake_case convention applied explicitly in `OnModelCreating`
(`HasColumnName("owner_id")`), and the index naming follows the `idx_minions_monster_id` precedent
already in `MotwDbContext`.

Indexes are not optional here even at small scale: **every single query against these tables will
carry the owner predicate**, so it's the most selective and most frequently used filter in the
system.

### Cascade behaviour on user deletion (resolution #12)

**`ON DELETE RESTRICT`, and no user-deletion endpoint in v1** — as recommended.

- `Cascade` from `users` would mean a single `DELETE FROM users` silently destroys every mystery,
  monster, minion, location, bystander, and all their sub-resources — and Postgres would do it
  without any application code running. That is a catastrophic-blast-radius default for an operation
  that will be performed rarely and manually. It matters more under resolution #8, where the owner
  is expected to operate on the `users` table by hand.
- `Restrict` makes the database refuse, which forces any future delete-account feature to be an
  explicit, transactional service that deletes the owned aggregates first (in dependency order) and
  then the user. That service can be written when it's actually needed.
- Deactivation (`LockoutEnd = DateTimeOffset.MaxValue`) covers the realistic case — "stop this person
  logging in" — without touching data at all. Note that, like a role change, deactivation only takes
  effect for an already-signed-in user at the next security-stamp validation (`architecture.md` §3).

---

## 4. Enforcement — EF Core global query filters

### The mechanism

An `ICurrentUser` abstraction (`Guid? UserId`, `bool IsAuthenticated`) backed by
`IHttpContextAccessor`, injected into `MotwDbContext`. Then, in `OnModelCreating`:

```csharp
modelBuilder.Entity<Mystery>()  .HasQueryFilter(x => x.OwnerId == currentUser.UserId);
modelBuilder.Entity<Monster>()  .HasQueryFilter(x => x.OwnerId == currentUser.UserId);
modelBuilder.Entity<Location>() .HasQueryFilter(x => x.OwnerId == currentUser.UserId);
modelBuilder.Entity<Bystander>().HasQueryFilter(x => x.OwnerId == currentUser.UserId);
modelBuilder.Entity<Minion>()   .HasQueryFilter(x => x.Monster.OwnerId == currentUser.UserId);
```

There is **no bypass expression** — resolution #4 confirmed that admins do not see other users' game
data, so the filter has exactly one form and no admin branch (§5).

### Why filters rather than `.Where()` in the repositories

The repository layer has **85 query methods** across five interfaces (`IMonsterRepository` 29,
`IMinionRepository` 26, `IBystanderRepository` 12, `ILocationRepository` 12, `IMysteryRepository` 6).
Adding an owner predicate to each by hand is 85 opportunities to forget one, and a forgotten one is
invisible — the endpoint keeps working, it just returns too much.

More decisively: **the five search providers don't go through the repositories at all.**
`MonsterSearchProvider`, `MinionSearchProvider`, `MysterySearchProvider`, `LocationSearchProvider`,
and `BystanderSearchProvider` each hold `MotwDbContext` directly and issue their own projections
(`dbContext.Monsters.AsNoTracking().Select(…)`). A repository-layer convention would miss global
search entirely, and global search returns names *and* snippets of description text from every
matching row — the worst possible thing to leak. A model-level query filter covers them for free,
with no change to any search file.

Query filters also apply automatically to `Include()`d navigations, to `Any()`/`Count()` existence
probes, and to `ExecuteDelete`/`ExecuteUpdate` — which is exactly the set of shapes this codebase
uses.

### Why the filter covers derived entities without needing filters of their own

Verified against the code: every sub-resource repository query is already parent-scoped
(`MonsterRepository` lines 110–210 — `Where(x => x.MonsterId == monsterId)`, and
`Where(x => x.Id == attackId && x.MonsterId == monsterId)` for single-item reads and deletes), and
every sub-resource service method that *reads a collection* or *creates* an item begins with a
parent-existence guard (`MonsterService.GetAttacksAsync`/`CreatePowerAsync` etc. all call
`MonsterExistsAsync(id)` first).

Once `Monsters` carries the query filter, `MonsterExistsAsync` returns `false` for another user's
monster — so those methods return `NotFound` before touching a child table. The chokepoint already
exists; the filter simply makes it owner-aware.

### The gap that must be closed by hand

The guard is **not** universal. Method counts: `MonsterService` 31 public methods / 19
`*ExistsAsync(` calls; `MinionService` 29/15; `LocationService` 12/7; `BystanderService` 12/7;
`MysteryService` 7/3. The unguarded methods are the update- and delete-by-child-id paths, which rely
on the repository's parent-scoped `Get…` returning `null` — e.g. `UpdateAttackAsync` calls
`GetAttackAsync(monsterId, attackId)` which filters on `x.Id == attackId && x.MonsterId ==
monsterId`. That is **parent-scoped but not owner-scoped**: a caller who knows both GUIDs can update
or delete another user's sub-resource.

**Required rule, mechanically checkable:** *every public service method that accepts a parent id must
begin with that parent's existence guard.* Adding the missing calls is one line each across roughly
30 methods, and it makes the whole sub-resource surface owner-safe through a single mechanism rather
than through 85 individually-correct queries.

### Consequences to handle

- **`MotwDbContextFactory`** constructs `MotwDbContext` directly with no DI (`Data/
  MotwDbContextFactory.cs`, line 26). Once the context takes `ICurrentUser`, this must pass a
  null-object implementation. Build-breaking if missed; trivial to fix.
- **No HTTP context** (startup, `MotwDbInitializer`, design-time migrations) ⇒ `UserId` is `null` ⇒
  the filter matches nothing. That's the safe default, and nothing in the current initializer touches
  owned entities (it seeds the seven lookup tables and, after Phase 0, the three role rows). It must
  stay that way.
- **EF warns about required navigations on filtered principals** — `Minion` requires `Monster`; if a
  `Monster` is filtered out, an `Include` of its minions is inconsistent. In practice unreachable
  here (you can't reach a filtered-out monster's minions) but the warning is emitted at model build
  and should be explicitly suppressed with a comment explaining why, not silenced blindly.
- **The filter must never be bypassed with `IgnoreQueryFilters()`** anywhere in domain code.
  Resolution #4 means no legitimate need exists today. If one appears later, it should be a single,
  named, policy-gated repository method, never an inline call.

### Assigning ownership on create

Services set `OwnerId = currentUser.UserId` when constructing a new entity — alongside the existing
`Name`/`Description` assignment in e.g. `MonsterService.CreateAsync`. `OwnerId` is **never** part of
any request DTO. Ownership is ambient, derived from the authenticated principal; a client-supplied
owner id would be an authorization bypass with extra steps.

A `SaveChanges` interceptor that stamps `OwnerId` on `Added` entries (mirroring the existing
`ApplyTimestamps()` hook in `MotwDbContext`) is an attractive alternative — it's automatic and
impossible to forget. It's **not** recommended, for one reason: it hides an authorization-relevant
assignment inside infrastructure, where a reviewer reading `CreateAsync` cannot see it. Timestamps
are cosmetic and belong in an interceptor; ownership is a security boundary and should be visible at
the call site. Roughly 8 create paths are affected (mystery, monster ×2 overloads, location ×2,
bystander ×2; minion is derived and needs none).

---

## 5. Admin visibility

Resolution #4: **admins and super-admins see only their own game data, exactly like everyone else.**
Confirmed as recommended.

The role system's purpose per requirements #4 and #5 is gating the **Data Admin section** — i.e.
reference-data management, plus (resolution #13) super-admin role assignment. Nothing in the
requirements asks for cross-user data browsing.

Keeping it that way means the query filter never needs a bypass expression, `IgnoreQueryFilters()`
never appears in domain code, and there is no code path that can accidentally widen. Adding an admin
bypass later is a contained change (a nullable "acting as" concept or an explicitly-named,
policy-gated repository); removing one after it exists is not.

**Trade-off accepted:** an admin cannot look at a user's mystery to help them debug a problem. The
mitigation, if that ever comes up, is direct database access by the owner — which is already the
operating model for role assignment under resolution #8, so it is consistent rather than an
exception.

---

## 6. Migrating the existing local data

Resolution #2: **production starts empty. Backfill the local database only**, so local development
keeps working with the owner's existing library.

The existing data has no owner and lives in the local `motw-postgres-data` Docker volume on the
owner's machine. It is not "production data" — production doesn't exist yet.

**Four steps, in this order:**

1. **Migration A** (Phase 2) adds `owner_id` as **nullable** with the FK and index. Existing rows get
   `NULL`. Nothing breaks; the app still runs unfiltered because the filters aren't wired yet.
2. **Create the owner's account.** Under resolution #8 there is no bootstrap mechanism — register
   through the normal enrollment flow against the local instance, then **confirm the address by
   following the link `LoggingEmailSender` writes to the console** (resolution #7: confirmation is
   required before first login), then assign `SuperAdmin` by hand:

   ```sql
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id FROM users u, roles r
   WHERE u.email = 'owner@example.com' AND r.name = 'SuperAdmin';
   ```

   (`architecture.md` §3 covers how that role reaches a live session.)

   If for any reason the confirmation link isn't available — the production case, where Resend may
   not be wired up yet — the documented break-glass is:

   ```sql
   UPDATE users SET email_confirmed = true WHERE email = 'owner@example.com';
   ```

3. **Backfill.** A one-time SQL script committed at
   `docs/seeds/backfill-owner-id.sql`, matching the existing precedent of
   `docs/seeds/reference-data-seed.sql` and `docs/seeds/the-quiet-seed.sql`:

   ```sql
   UPDATE mysteries  SET owner_id = (SELECT id FROM users WHERE email = :owner_email) WHERE owner_id IS NULL;
   UPDATE monsters   SET owner_id = (SELECT id FROM users WHERE email = :owner_email) WHERE owner_id IS NULL;
   UPDATE locations  SET owner_id = (SELECT id FROM users WHERE email = :owner_email) WHERE owner_id IS NULL;
   UPDATE bystanders SET owner_id = (SELECT id FROM users WHERE email = :owner_email) WHERE owner_id IS NULL;
   ```

   Idempotent (`WHERE owner_id IS NULL`), runnable repeatedly, and — critically — **not** application
   code. A backfill baked into `MotwDbInitializer` would run on every startup forever, in every
   environment, as a permanent piece of infrastructure serving a one-time need. Keep it a script.
4. **Migration B** flips the four columns to `NOT NULL`. It will fail loudly if step 3 was skipped,
   which is the desired behaviour.

Production is deployed fresh with no rows, so steps 2 and 3 are local-only. The first production
account is created the same way, minus the backfill: register, confirm (or apply the break-glass),
then `INSERT` the `SuperAdmin` row. This is a Phase 6 runbook item.

---

## 7. What breaks in the test suite

The API test project is entirely unit tests over hand-written fakes
(`FakeMonsterRepository` et al.) with no `WebApplicationFactory` and no
`Microsoft.AspNetCore.Mvc.Testing` reference. Those tests construct services directly and never touch
`MotwDbContext`, so **they mostly survive Phase 2 untouched** — which is precisely the problem:

**Fakes cannot prove ownership isolation.** A fake repository returns whatever it was told to; it has
no query filter and no `ICurrentUser`. The property that actually matters here — "user A's request
cannot reach user B's row" — is only observable end-to-end through the real DbContext and the real
authorization pipeline.

**This feature needs a test type this repo does not have yet.** Required in Phase 2: add
`Microsoft.AspNetCore.Mvc.Testing`, a `WebApplicationFactory` fixture with a stubbed `ICurrentUser`,
and a `Tests/Authorization/CrossOwnerAccessTests.cs` covering, per domain:

- list endpoints return only the caller's rows
- detail-by-id of another user's row returns 404 (not 403 — don't confirm existence)
- update/delete of another user's row returns 404
- **sub-resource** update/delete of another user's child row returns 404 (this is the gap in §4)
- linking another user's monster/location/bystander into your own mystery returns 404
- `GET /api/search?q=` and `GET /api/search/quick?q=` never return another user's row

The SQLite provider already referenced by the test project works with both Identity and query
filters, so no Postgres test container is required.
