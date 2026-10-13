# Domain Custom Moves — Architecture and Phased Plan

**Prepared by:** Yoshi (Architect)
**Requested by:** Skyler Sidner
**Date:** 2026-10-10
**Status:** Plan, structurally settled. **No application code has been written or modified as part of
producing this document.** Rosalina's UI pass follows, then Luigi and Bowser for implementation specifics.
§6 deliberately stops short of design.

**Authoring convention for this document, since four authors have now needed it.** Each author owns a
contiguous block of sections (§§0–12 Yoshi, §§13–15 Rosalina, §§16–25 Bowser, §§26–34 Luigi, §35 Yoshi) and
amends only their own; where you disagree with another author, say so in your own section rather than
editing theirs. **To prove you have not touched someone else's block, extract by section boundary and
`diff` — do not `cmp` a byte or line range.** A byte-range comparison is useless the moment you amend
anything in your own block, because every line number after it shifts and the comparison reports a
difference that is only your own legitimate edit. The working form:

```
awk '/^## 13\.1 /,/^# 35\. /' architecture.md | sed '$d' > now.md    # their block, from the current file
awk '/^## 13\.1 /,0'          previous.md                  > pre.md  # the same block, before your edits
diff pre.md now.md
```

**Grounding — read, not inferred from docs:** `Data/Entities/DomainEntities.cs`, `Data/MotwDbContext.cs`,
`Contracts/ApiContracts.cs`, `Contracts/ApiMappers.cs`, all ten `*Controller.cs` (plus a full inventory of
every route template and every entity-create endpoint in the API), all five `*Repository.cs` + interfaces,
all five `*Service.cs` + interfaces, `Services/ResourceImages/*`,
`Services/Search/{Monster,Minion}SearchProvider.cs`, `Program.cs`, the backend test tree, `core/models.ts`,
`core/{monster,minion,location,bystander,mystery,resource-images}.ts`, `monster-create.ts`, all five detail
pages and their specs, `shared/resource-images*`.

> **The shape, in four sentences.** Five per-domain custom-move tables collapse into one `custom_moves`
> table discriminated by `(OwnerType, OwnerId)`, following the `ResourceImage` precedent. Sixteen controller
> actions across four controllers collapse into **one `CustomMovesController` with four actions**, serving
> all five owner types through a parameterised route segment, with one backend service and one frontend
> client service. A custom move stays a **sub-resource with its own write calls** — it is never a field on
> an entity request, at create or at update, so the create pages stage moves locally and write them through
> the batch they already run for every other sub-resource (§2.10). Everything that exists today for custom
> moves is torn down and replaced (inventory: §9).
>
> The trade-off accepted is the one `ResourceImage` already accepted: no database-enforced referential
> integrity and no automatic cascade delete, replaced by service-layer ownership validation and explicit
> `DeleteAllForOwnerAsync` calls from the five delete flows. It is materially cheaper here than it was for
> images, because the mitigation code already exists and is already tested, and the rows being protected are
> two short strings rather than megabytes of `bytea`.

---

## 0. The ask

Make domain custom moves work — properly, editable, on all five domains (Mystery, Monster, Minion,
Location, Bystander), including at entity-creation time — on a unified data model and a unified API.

Three constraints from Skyler shape everything below.

**On the data.** *"Because there is zero meaningful data content (if there is any, it wasn't made by me and
is completely expendable) there's no chance of breaking anything until we get to the UI adjustments."* So:
no data migration, no backfill, no audit of existing rows. The old tables are **dropped**, not
emptied-and-copied.

**On the code.** *"I don't feel like the cost of maintaining 5 separate endpoints is worth the strong
simplicity of a single endpoint with some logical differences… In general, I prefer less code, simpler, even
if it means a bit more rework."* That is a standing preference, and §2.9 and §9 are written to it.

**On the write shape at create time.** *"I think I would rather follow convention in this case with the
custom moves. It does make more sense to not do this as a one-shot, since we are doing a series of
sub-resource calls."* §2.10 is written to it.

---

## 1. Current state, verified by reading source

### 1.1 Schema — five identical tables

`Data/Entities/DomainEntities.cs` declares five sibling entities: `MonsterCustomMove` (`:166`),
`LocationCustomMove` (`:200`), `BystanderCustomMove` (`:234`), `MysteryCustomMove` (`:244`),
`MinionCustomMove` (`:356`). Every one of them is exactly:

```
Id (Guid, init)  |  <Owner>Id (Guid)  |  Name (required string)  |  Description (string?)  |  <Owner> nav
```

Not "similar" — identical, including property order. Each parent carries an
`ICollection<...CustomMove> CustomMoves` nav (`:44`, `:98`, `:197`, `:231`, `:299`).

`MotwDbContext.cs` configures them at `:256`, `:296`, `:336`, `:347`, `:478`. Five near-copied blocks, each
mapping `name` at `HasMaxLength(255).IsRequired()`, each with a required FK to its parent.
Monster/Location/Bystander/Mystery rely on EF's default delete behaviour for a required FK (**Cascade**);
`MinionCustomMove` states `.OnDelete(DeleteBehavior.Cascade)` explicitly. Five implicit FK indexes exist as
a consequence.

**This is the fact that decides §2.** Compare the other sub-resources the per-domain convention exists for:
`MonsterAttack` carries `Harm` plus a weapon-tag bridge; `MonsterArmor` carries `HarmSoak`, `IsSpecial`,
`SpecialDescription`; `Minion` carries `HarmCapacity`. Those genuinely differ per domain. A custom move does
not. There is no per-domain content here to duplicate a table for.

### 1.2 API — four of five domains have full CRUD, with already-shared contracts

`CustomMoveResponse` (`ApiContracts.cs:21`) and `UpsertCustomMoveRequest` (`:167`) are **single records
shared by every domain** — there is no `MonsterCustomMoveResponse`. The wire contract has behaved as if
there were one concept since before this question was asked.

Sixteen custom-move endpoints exist, in the identical four-verb shape:

| Domain | Routes | Controller |
|---|---|---|
| Monsters | `GET/POST /api/monsters/{id}/custom-moves`, `PUT/DELETE .../{moveId}` | `MonstersController.cs:149-163` |
| Minions | same shape | `MinionsController.cs:153-167` |
| Locations | same shape | `LocationsController.cs:111-141` |
| Bystanders | same shape | `BystandersController.cs:106-136` |
| **Mysteries** | **none** | — |

Behind each: 4 service-interface methods (`IMonsterService.cs:40-43`, `IMinionService.cs:38-41`,
`ILocationService.cs:16-19`, `IBystanderService.cs:16-19`), 4 service implementations, 4 repository
interface methods and 4 implementations (`MonsterRepository.cs:247-260`, `MinionRepository.cs:192-205`,
`LocationRepository.cs:106-123`, `BystanderRepository.cs:105-122`). Four near-identical copies of the same
twelve methods, none of which has ever been called by the application (§1.4).

**Mysteries are the gap.** `MysteryCustomMove` rows are read (`MysteryRepository.cs:24`) and returned
(`MysteryService.cs:138`), so the data round-trips — but `IMysteryService` has no custom-move methods and
`MysteriesController` has no custom-move routes. Mystery custom moves are readable and permanently empty.

### 1.3 Custom moves are a sub-resource, never a field on an entity request — and the schema enforces it

Today no `Upsert{Domain}Request` carries custom moves, and that is correct under the standing decision
*"membership is its own resource, never a field on the entity. Never put membership in an `Upsert*Request`
body — whole-collection PUT semantics would unlink everything on the next save"*
(`yoshi-mystery-entity-linking-membership-as-resource.md`). §2.10 keeps it that way.

**The mechanical reason, verified, because it is stronger than the convention alone.** There are **eight**
entity-create endpoints across the five domains — not five — and **every one of them binds the same record
as its domain's `PUT`:**

| # | Route | Controller | Binds | Same record used by |
|---|---|---|---|---|
| 1 | `POST /api/monsters` | `MonstersController.cs:20` | `UpsertMonsterRequest` | `PUT` at `:52` |
| 2 | `POST /api/mysteries/{mysteryId}/monsters` | `MonstersController.cs:32` | `UpsertMonsterRequest` | ″ |
| 3 | `POST /api/monsters/{monsterId}/minions` | `MinionsController.cs:20` | `UpsertMinionRequest` | `PUT` at `:40` |
| 4 | `POST /api/locations` | `LocationsController.cs:53` | `UpsertLocationRequest` | `PUT` at `:82` |
| 5 | `POST /api/mysteries/{mysteryId}/locations` | `LocationsController.cs:33` | `UpsertLocationRequest` | ″ |
| 6 | `POST /api/bystanders` | `BystandersController.cs:48` | `UpsertBystanderRequest` | `PUT` at `:77` |
| 7 | `POST /api/mysteries/{mysteryId}/bystanders` | `BystandersController.cs:28` | `UpsertBystanderRequest` | ″ |
| 8 | `POST /api/mysteries` | `MysteriesController.cs:22` | `UpsertMysteryRequest` | `PUT` at `:39` |

The name says it: these are *upsert* records, shared by create and update. So a collection field added for
creation's benefit would land on the update path by construction — which is exactly the failure the standing
rule names. **Nothing in this plan touches any of those eight endpoints or any of those five records.**

The count is recorded because it is the correct denominator for any future estimate that touches entity
creation (§12 F2), and because "one create endpoint per domain" is wrong by 60%.

### 1.4 Frontend — entirely unwired, and the create pages already batch sub-resources

The types exist: `CustomMoveResponse` (`core/models.ts:102`), `UpsertCustomMoveRequest` (`:297`), and
`customMoves: CustomMoveResponse[]` on all five detail responses (`:168`, `:258`, `:377`, `:438`, `:474`).

**No client service calls `/custom-moves`.** Verified by grep across `core/` — `monster.ts`, `minion.ts`,
`location.ts`, `bystander.ts` and `mystery.ts` have methods for attacks, powers, armors, weaknesses, weapon
tags, memberships and countdowns, and nothing for custom moves. **All sixteen existing endpoints are
unreachable from the application.**

Rendering is two read-only, name-only lists — `location-detail.html:55` and `bystander-detail.html:55`,
both `<h3>Custom Moves</h3>` followed by an `@if/@else` over `move.name`. Monster, Minion and Mystery detail
pages have **no section at all**. `description` is rendered **nowhere**, on any page.

Every other `customMoves` reference in the whole web app is the literal fixture line `customMoves: []` in a
spec file. There are **zero** frontend assertions about custom-move behaviour.

**The create-page pattern custom moves will join — the single most important existing artifact for §2.10
and §6.3.** `monster-create.ts:267-300` POSTs the monster, then `switchMap`s into a `forkJoin` of:

- `saveSubResourceDrafts(monster.id)` (`:320-372`) — `runBatch` over attack drafts (each chaining its
  weapon-tag assignments), power drafts, armor drafts and weakness drafts; and
- `runBatch` over the membership `linkToMystery` calls.

`runBatch` (`:374-376`) short-circuits an empty draft array instead of firing an empty `forkJoin`. A failure
anywhere past the entity POST is caught into a `draftsFailed: true` flag (`:280`) rather than reaching the
error handler, and surfaces as *"Monster created, but some details may not have saved. Review them on the
monster page."* (`:290`) with navigation to the **flat** detail route rather than the mystery-scoped one
(`:305-313`) — because the scoped route would assert a membership no longer known to hold.

That is the shape a custom-move draft arm slots into: **one more `runBatch` arm inside an existing
`forkJoin`.**

### 1.5 Every route template in this API is a literal segment

Inventoried in full, because §2.9 depends on it: of the ~80 route templates across all ten controllers,
**every** path segment is a string literal except for id parameters (`{id:guid}`, `{moveId:guid}`,
`{mysteryId:guid}`, `{tagId:guid}`). There is no parameterised non-terminal segment anywhere, and no route
constraint beyond `:guid`. §2.9's owner segment would be the app's first — a deliberate first, in the same
way `.HasConversion<string>()` was for `ResourceImage`.

Nothing collides with it. The only existing templates of the shape `api/*/{id}/custom-moves` are the sixteen
being torn down.

### 1.6 The other "custom moves" — and why the two never converge

`docs/hunter-playbooks/custom-moves-ideation.md` and
`.squad/decisions/records/yoshi-hunter-playbooks-phase6-custom-moves-model.md` are about **hunter playbook
moves** (`BespokeSection.PlaybookMoveId`) and are unrelated to this work.

Stated once so nobody tries to merge them later: a playbook custom move is *catalogue* data, extracted from
the rulebook by a tooling pipeline, carrying pick structure, option sets, min/max selection and formatting
fidelity, and *selected from* by a hunter. A domain custom move is *user* data — a Keeper typing a name and
a paragraph for one monster. Different authors, different lifecycle, different shape, different write path.
The shared English phrase is a coincidence of game vocabulary. **They should not converge, and nothing in
this plan brings them closer together.**

### 1.7 A stale premise worth retiring

Phase 8 and Phase 9 both deferred custom-move editing UI on the stated grounds that the endpoints did not
exist — `docs/phases/phase-8-minions-ui-flow.md:217` and
`docs/phases/phase-9-bystanders-locations-ui-flow.md:496`. That premise was wrong when written: Phase 3
built monster/location/bystander custom-move CRUD (`docs/phases/phase-3-summary.md`) and minion CRUD landed
in `d1e8b25`. The deferral outlived its reason by two phases and the UI was never built. That is why the
current state is "sixteen working endpoints nothing calls."

---

## 2. The structural call

### 2.1 Recommendation

One table, one service, one controller, one client service, and the existing sub-resource write convention.

- A single `CustomMove` entity mapped to `custom_moves`, discriminated by `(OwnerType, OwnerId)`.
- A **new** `CustomMoveOwnerType` enum of five members (§2.8).
- A single `ICustomMoveService` owning validation, reads, writes and owner-delete cleanup.
- A single `CustomMovesController` with **four** actions covering all five owner types (§2.9).
- A single `core/custom-moves.ts` on the frontend (§2.9).
- Custom moves remain a sub-resource written through their own endpoints, at create time as well as after
  (§2.10). No entity request gains a `customMoves` field.
- `CustomMoveResponse` and `UpsertCustomMoveRequest` are unchanged — they were already shared.

### 2.2 Why one table — applying the test `resource-images` already set

`docs/resource-images/design.md` §1.3 set the test for when this codebase departs from per-domain
duplication: *"an image row is identical in every field regardless of which resource type owns it… There's
no per-domain content here to duplicate a table for."*

A custom-move row passes that test identically. `Id / OwnerId / Name / Description` is the whole row, on all
five.

Worth naming, because it is a correction to a doc that is otherwise the authority here: **§1.3's own
justification is factually wrong about custom moves.** It lists `LocationCustomMove`/`BystanderCustomMove`
alongside `MonsterAttack`/`MinionAttack` as examples of "genuinely different *data* per domain." Attacks
are. Custom moves are not — they are the one item on that list that fails its own counter-example. §1.3's
*decision* was right; its *reasoning* over-generalised by one case, and this is that case.

**The portable rule, which matters more than this instance:** the test is *"is the row field-for-field
identical across domains?"*, not *"does this codebase duplicate this kind of thing?"* Applied honestly, that
test says unify custom moves and says **do not** unify `MonsterAttack`/`MinionAttack` — they differ in
content. §2.11 keeps that visible, because this is the codebase's second such departure and the next person
will reasonably read it as a trend.

Three further facts make the moment unusually cheap:

1. **The contracts are already shared** (§1.2). Neither side of the custom-move contract moves, so the
   "a contract change is two artifacts" trap that bit resource-images four times running does not arise
   anywhere in this plan.
2. **The frontend is entirely unwired** (§1.4). Unifying now costs five client-service methods never
   written, instead of five rewrites plus their specs.
3. **Mystery parity, the reason this work exists, becomes a non-event.** Under five tables it would cost a
   fifth entity, a fifth context config, 4 repository interface methods, 4 implementations, 4 service
   interface methods, 4 implementations, a fifth mapper overload and 4 routes. Under this design it costs
   **one enum member and one route-segment string** — see §4.

### 2.3 What is actually given up: FK integrity and cascade delete

This is the whole cost, and it should not be soft-pedalled.

**Today:** all five FKs are required and cascade. Deleting a Monster, Minion, Location, Bystander or Mystery
removes its custom moves **at the database level, running no application code**. That is correct by
construction and impossible to forget.

**After:** `(OwnerType, OwnerId)` is not a foreign key — a discriminator-plus-id pair cannot reference five
tables. Nothing stops a `custom_moves` row naming an owner that does not exist, and nothing removes it when
the owner goes. Both halves move to the service layer:

- **Write side:** the owner must exist and be the type it claims to be, checked before insert. This is a
  relocation, not new work — every `CreateCustomMoveAsync` today already calls `{Domain}ExistsAsync` first,
  and under §2.10 every write (including the create-page batch) goes through that same checked path.
- **Delete side:** each of the five `DeleteAsync` flows calls `DeleteAllForOwnerAsync`.

**Why this is cheaper here than it was for images.** The mitigation is already written, already shipped, and
already under test. `MonsterService.DeleteAsync` (`:185`) is the codebase's first explicit transaction;
`MinionService.DeleteAsync` (`:142`), `LocationService.DeleteAsync` (`:126`) and
`BystanderService.DeleteAsync` (`:133`) each already open a transaction and already call
`resourceImageService.DeleteAllForOwnerAsync`. Adding a second cleanup call inside an existing transaction
is a one-line change per domain, in four methods that exist to do exactly this.

And the failure mode is far milder: an orphaned image row is megabytes of `bytea` that nothing will ever
reclaim; an orphaned custom-move row is a name and a paragraph. Still a bug, still worth a test per domain —
but the blast radius of getting it wrong is a slow text leak, not storage growth.

### 2.4 The Monster → Minion cascade trap — named, because it is the one that bites

`Minion.MonsterId` is `OnDelete(Cascade)` at the database level. Deleting a Monster removes its Minions
**without running any application code**, which means a naive "clean up the owner's custom moves then delete
the owner" would silently orphan every *Minion's* custom moves.

This is not hypothetical — it is precisely the bug resource-images Phase 3 found, and the reason
`MonsterService.DeleteAsync` reads minion ids *before* the monster delete rather than after. The fix is
therefore not new design: the existing `foreach (var minionId in minionIds)` loop gains one more call.

**The test consequence matters more than the code change.**
`MonsterMinionCascadeTests.DeletingAMonster_CascadesItsMinionsAndTheirSubResources` seeds a `MinionAttack`
and asserts it is gone. `MinionAttack` keeps its real FK and will keep cascading, so that test **would stay
green while the custom-move half silently leaked.** It must be extended to seed a minion custom move. This
is exactly the blind spot the standing decision *"a positive assertion cannot see a duplicate"*
(`toad-exact-call-ledger-over-positive-assertions.md`) warns about, one shape over: an assertion over the
sibling sub-resource that still works cannot see the one that stopped working.

### 2.5 Ownership validation

A straight copy of `ResourceImageService.OwnerExistsAsync` (`:207`) with a fifth arm:

```
CustomMoveOwnerType.Mystery   => dbContext.Mysteries.AnyAsync(...)
CustomMoveOwnerType.Monster   => dbContext.Monsters.AnyAsync(...)
CustomMoveOwnerType.Minion    => dbContext.Minions.AnyAsync(...)
CustomMoveOwnerType.Location  => dbContext.Locations.AnyAsync(...)
CustomMoveOwnerType.Bystander => dbContext.Bystanders.AnyAsync(...)
```

**This check is what makes the discriminator safe, and it is worth being precise about what it does and does
not buy — because a unified controller moves the owner type from "implied by which controller you reached"
to "a value in the request."**

- A mismatched pair (`Monster` + a Bystander's id) is rejected: the id is not in `Monsters`, so the write is
  a 404. It cannot create a row attached to nothing.
- A *correct but unintended* pair cannot be constructed accidentally, because the frontend builds every URL
  through one function with one owner-type → segment map (§2.9). There is no second code path that could
  disagree with it.
- The check is required **identically** under five controllers and under one. Today's
  `MonsterService.CreateCustomMoveAsync` already calls `MonsterExistsAsync` before inserting; nothing is
  being weakened, the same guard is being written once instead of four times.
- **Every write path goes through it, with no exemptions.** Because custom moves are always written against
  an owner that already exists (§2.10), there is no caller that needs to skip the check and no
  "trust me, I just created it" entry point.

**No ownership/IDOR dimension exists here.** Standing: no per-user data ownership in this app — no
`owner_id`, no `ICurrentUser`, no EF global query filters
(`docs/simple-authentication-update/architecture.md:601`), so cross-user access is a documented
non-finding. The current nested routes carry no authorization check beyond the app-wide session gate, and
neither will the unified one. **Nothing about this change alters the auth posture.**

Reads carry the same guarantee as today: every query is `Where(OwnerType == x && OwnerId == id)`, so a move
id belonging to one owner can never be read, updated or deleted through another owner's URL.

### 2.6 The nav property goes away — the real cost of the discriminator

`Monster.CustomMoves`, `Minion.CustomMoves`, `Location.CustomMoves`, `Bystander.CustomMoves` and
`Mystery.CustomMoves` cannot survive. EF cannot hang a navigation off a discriminated, FK-less column. That
reaches five live read paths:

- `MonsterRepository.GetMonsterDetailAsync` `.Include(x => x.CustomMoves)` (`:90`)
- `MinionRepository` (`:89`), `LocationRepository` (`:89`), `BystanderRepository` (`:89`)
- `MysteryRepository.GetMysteryDetailAsync` (`:24`) — **and this one has a tracked variant**
  (`asNoTracking: false`) used by the update path, so both branches need handling.

…and the five projection sites that read them (`MonsterService.cs:523`, `MinionService.cs:430`,
`LocationService.cs:240`, `BystanderService.cs:101`, `MysteryService.cs:138`).

**`customMoves` stays embedded in the five detail responses, fetched server-side.** Each domain service,
after loading its entity, calls `customMoveService.ListForProjectionAsync(ownerType, id)` and passes the
result into its existing private mapping method. Cost: **one extra query per detail page load, at five
sites.** At this app's data scale that is not a performance question; it is the honest price of the
discriminator, named here rather than discovered later.

Note this is orthogonal to §2.9: the detail projections call the *service*, never the controller.

### 2.7 Index and query shape

One index replaces the five implicit FK indexes:

```
HasIndex(e => new { e.OwnerType, e.OwnerId, e.Name })
    .HasDatabaseName("idx_custom_moves_owner_name")
```

`Name` is in the index because **all four existing repositories order by `Name`**
(`MonsterRepository.cs:248` and its three siblings), so the list read becomes an index seek rather than a
seek-then-sort. Same shape and reasoning as `idx_resource_images_owner_sort` (`MotwDbContext.cs`,
`ResourceImage` config at `:498`), which uses `SortOrder` for the same reason. Not unique — nothing says two
moves cannot share a name.

Table scale is trivially small; this is about matching the established shape, not about performance.

### 2.8 The enum: introduce `CustomMoveOwnerType`, do **not** extend `ResourceOwnerType`

> **SUPERSEDED 2026-10-12 by Skyler, in Phase 7's research —
> `docs/resource-images/endpoint-unification.md` §2.6.** The two enums become one five-member
> `DomainOwnerType`. The section below is left intact because it is the record of why there were two, and
> because its central fact is still true and is now what the replacement design has to encode explicitly:
> **`Mystery` has no `primary_image_id` column, FK or index, so the image-legal owner set really is
> narrower than the domain.** Under one enum that is carried by a declared `ImageOwnerTypes` set plus a
> bidirectional drift test, instead of by the type system. The reversal was deliberate and is argued on
> its own terms there; nothing in this section was found to be *wrong*, only outvoted. One thing it got
> factually wrong is corrected there too: a `Mystery` member would **not** have made the two enums
> identical — mystery images is a migration, not an enum edit.

**Do not extend `ResourceOwnerType`** (`DomainEntities.cs:372`) with a `Mystery` member. Skyler cut mystery
images from scope — *"I'm not anticipating a need for photos related to a mystery specifically"*
(`resource-images/phases.md`, 2026-10-04) — so `resource_images.owner_type` has no legal `Mystery` value.
Adding the member would make a value that is legal in the type system illegal in that table, and
`ResourceImageService.OwnerExistsAsync`'s `_ => throw new ArgumentOutOfRangeException` arm would become
**reachable**, surfacing as a 500 from a route that compiles fine. A latent crash is a worse cost than a
duplicated enum.

The name is also wrong: `ResourceOwnerType` is documented in-file as "the discriminator for
`ResourceImage.OwnerType`." Reusing it for a second feature makes it the discriminator for two things with
different member sets.

**Trade-off accepted:** two string-backed enums whose four Monster/Minion/Bystander/Location members
overlap. That is mild, visible duplication. The alternative I considered and rejected — one shared
`DomainOwnerType` with each feature validating which subset applies to it — replaces a duplicated five-line
enum with a per-feature "which members are legal for me" rule that someone must remember forever. That
rots; two honest enums do not.

**Generalisable:** when a discriminator enum's legal member set is narrower than the domain, a second
consumer with a wider set needs its own enum, not the shared one plus a per-feature legality rule.

Mapping follows the `ResourceImage` precedent exactly: `.HasConversion<string>().HasMaxLength(16)`
(`MotwDbContext.cs:506`). Longest member is `Bystander`, at 9 characters. String, not int, for readable raw
SQL.

### 2.9 One controller, four endpoints, one client service

**Sixteen actions across four controllers become four actions on one `CustomMovesController`** — and those
four actions are the *whole* write surface for custom moves. The owner type travels as a constrained route
segment:

```
GET    /api/{owner}/{ownerId:guid}/custom-moves
POST   /api/{owner}/{ownerId:guid}/custom-moves
PUT    /api/{owner}/{ownerId:guid}/custom-moves/{moveId:guid}
DELETE /api/{owner}/{ownerId:guid}/custom-moves/{moveId:guid}
```

`{owner}` is constrained to exactly the five legal segments —
`mysteries|monsters|minions|locations|bystanders` — and mapped to `CustomMoveOwnerType` by one dictionary in
the controller. An unknown segment never reaches application code; routing 404s it, exactly as a typo in a
literal segment does today. (Bowser's pick whether that is an inline `regex(...)` constraint or a small
`IRouteConstraint` class; the constraint is the one place the legal set is written down either way.) Per §1.5
this is the app's first parameterised non-terminal route segment, and nothing collides with it.

The frontend mirrors it exactly: **one `core/custom-moves.ts`**, with an `OWNER_SEGMENT` map and a
`customMovesPath(ownerType, ownerId)` builder — the same structure as `core/resource-images.ts`'s
`OWNER_SEGMENT` / `resourceImagesPath()`, which is already the worked example of a cross-domain client
service in this repo. Five per-domain client services are never written.

**All four methods set `SUPPRESS_ERROR_TOAST`**, mirroring `core/resource-images.ts:68-75`. Stated as a
requirement rather than left to "mirror resource-images," because the failure is silent in review and loud
in use: `httpErrorInterceptor` names the failing URL and GUID, so without the context token a raw
*"Request failed (500) for POST /api/monsters/…/custom-moves"* fires **beside** the feature's own hedged
caveat or inline message. Two toasts per failure, one of them useless. It is also the token most likely to
be deleted later as apparently-dead config — so the comment at the declaration should say what it prevents.
§14-R3 is the UI-side statement of the same requirement.

**Why the path stays nested rather than becoming a flat `/api/custom-moves`.**

1. **It costs nothing.** The controller unification — which is the whole point — is complete either way.
   Nested versus flat contributes zero lines of code in either direction, so take the shape with the better
   properties.
2. **Every other sub-resource in this app is addressed under its owner** — attacks, powers, armors,
   weaknesses, weapon tags, countdowns, images, memberships, minions. A flat `/api/custom-moves` would be
   the only sub-resource in the system addressable independently of the thing that owns it: a vocabulary
   every reader has to learn and every future sub-resource has to decide against.
3. **"List this owner's moves" stays a plain `GET` with no query string**, and `DELETE` stays addressed at a
   resource rather than at a filter.
4. **It keeps the client path builder a one-liner identical in shape to the one already in the repo.**

What it does **not** buy, stated so nobody relies on it: the nested path does not make the discriminator
un-forgeable. A client can construct `/api/monsters/{aBystanderId}/custom-moves` just as easily as it can put
a wrong `ownerType` in a body. §2.5's owner-existence check is what rejects that, and it is required either
way. The argument for nesting is consistency and ergonomics, not safety.

**On the five-controller alternative, and the resource-images precedent.** Preserving sixteen per-domain
actions would have been motivated purely by keeping the external contract unchanged — and a small diff is
only a virtue when the code being preserved has value. Here it has none: those sixteen actions are four
copies of the same four signatures that **nothing has ever called** (§1.4). Preserving them would be
permanent maintenance cost spent protecting dead code. Resource-images' §3 rule — *"not a new fifth
cross-cutting controller, to match how this app already organizes per-domain sub-resources"* — is therefore
set aside here deliberately, not overlooked, and custom moves are the cleaner case for it: all four actions
are identical JSON endpoints, whereas the image endpoints carry per-action
`[RequestSizeLimit]`/`[RequestFormLimits]`, a multipart `IFormFileCollection` binding, and `File(...)`
returns with cache headers. Phase 7 revisits the images case as research.

### 2.10 Creation follows the sub-resource convention: entity first, then the moves

**Decided (Skyler): custom moves are written through their own endpoints at create time, as a draft batch
after the entity POST — not inlined into the entity request.** His reason: *"I would rather follow
convention in this case with the custom moves. It does make more sense to not do this as a one-shot, since
we are doing a series of sub-resource calls."*

The strongest form of that argument, and the one this design rests on:

1. **Custom moves are the fifth of five sibling sub-resources, not a special case.** Monster and Minion each
   carry attacks, powers, armors, weaknesses *and* custom moves. Inlining only custom moves into the entity
   request would make the one structurally-identical member of that set the odd one out — four types written
   through `runBatch`, one written in the body. **The consistent design is the one where all five are
   written the same way**, and the existing batch is where the other four already live.
2. **It needs no new API surface at all.** Zero changes to the eight create endpoints (§1.3), zero new
   request records, zero new TypeScript request interfaces, no per-create transaction work — nothing on
   the backend.

   **On the client the cost is not uniform across the four create pages, and §13.1 item 3 is right to
   split it.** On `monster-create` and `minion-create` it is literally *one more `runBatch` arm* in an
   existing `forkJoin` (`monster-create.ts:320-373`) — roughly eight lines. On `location-create` and
   `bystander-create` there is no sub-resource machinery at all to extend: `location-create.ts:12-20`
   states in its own words that the page has *"no draft arrays, no batched sub-resource submit,"* and its
   post-create batch is memberships only (`:88-93`). There the draft list, the draft surface, the second
   `forkJoin` arm and the combined failure flag are all **first-of-kind**, and that class comment becomes
   false and must be rewritten. Four new things on two pages, not one line on four — budgeted in 5c/5d.
3. **It keeps the standing rule intact rather than testing its edge.** All eight create endpoints share
   their request record with their domain's `PUT` (§1.3), so a collection field added for creation would
   reach the update path by construction. Staying out of the body means the whole question never arises.
4. **One write path, one validation path, no exemptions.** Every custom-move insert — detail page, create
   page, wizard — is the same `POST /api/{owner}/{id}/custom-moves` through the same owner-checked service
   method (§2.5). There is no second entry point and no caller that skips a check because "the owner was
   just created in this transaction."

**The cost, accepted:** a create whose entity succeeds and whose moves do not leaves the entity created
without them. That state is **not new** and **not specific to custom moves** — it is the existing
`draftsFailed` condition (§1.4) that already covers attacks, powers, armors, weaknesses and membership
links on every create page in the app. Custom moves join an established failure mode rather than
introducing one, and the standing copy decision already governs it:

> *"An entity-then-batch write that partially fails is a success with a caveat, never an `error:`."*
> (`rosalina-partial-failure-copy-entity-linking.md`) — because routing it to `error:` leaves the user on a
> populated create form whose only control makes a duplicate.

That rule is load-bearing here. §6.3 is where it reaches Rosalina.

### 2.11 What this costs and what it removes

| | Today | After |
|---|---|---|
| Tables | 5 | 1 |
| Entities | 5 | 1 |
| Parent nav collections | 5 | 0 |
| `DbSet`s | 5 | 1 |
| Context config blocks | 5 | 1 |
| Repository interface methods | 16 | 0 |
| Repository implementations | 16 | 0 |
| `.Include(x => x.CustomMoves)` | 5 | 0 |
| Domain-service interface methods | 16 | 0 |
| Domain-service implementations | 16 | 0 |
| `ToResponse` mapper overloads | 5 | 1 |
| Controllers carrying custom-move CRUD | 4 | 1 |
| **Custom-move controller actions** | **16 (4 domains)** | **4 (5 domains)** |
| Entity-create endpoints touched | — | **0** |
| Entity request records touched | — | **0** |
| Cross-cutting backend service | 0 | 1 (6 methods) |
| Client services calling custom moves | 0 | 1 |
| Custom-move API contracts | 2 | 2 (unchanged) |

Repository methods go to zero because the shared service talks to `MotwDbContext` directly — the call
already made for `ResourceImageService` (`resource-images/phases.md` §1 item 4: *"no single repository owns
Monsters, Minions, Bystanders, and Locations"*), which applies with one more domain here. Consequence: this
service is tested against a SQLite-backed `MotwDbContext` like `ResourceImageServiceTests`, not against a
fake repository.

### 2.12 Reservations, logged rather than acted on

These do not change the recommendation. They are the honest other side.

1. **This is the codebase's second departure from per-domain duplication, and now it departs at the
   controller layer too.** One departure is a special case; two is a trend, and the next person will
   reasonably read it as licence to unify `MonsterAttack`/`MinionAttack`. **That unification would be
   wrong** — those rows differ in content. §2.2's test is the thing to carry forward, not the outcome.
2. **§2.10 is the *right* shape for the wizard, not a cost it pays — and the wizard's real cost is in the
   two domains §6 calls easy.** §13.8 challenged an earlier reading of this and is correct in its
   conclusion. The mechanism, though, is the one worth recording, because it is not the whole-collection
   churn §13.8 describes: a collection field was never going to reach `PUT` (§2.10.2 excludes it by
   construction, and §1.3 is why), so edit-mode re-save churn was not the hazard. The hazard inlining would
   have introduced is **a second baseline-construction site for one collection**. `applySubResourceDiff`
   (`features/mysteries/pages/mystery-create/sub-resource-diff.ts:65-104`) returns the new baseline in
   draft order — one site, already tested, used eight times. Inlining would have had the create path build
   that baseline from the create *response* instead, bypassing the diff on exactly one branch. That is
   precisely the shape of the standing rule *"a baseline and its draft are created and destroyed
   together"* (`toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md`), which this subsystem
   has already violated twice in production (`mystery-entity-linking.md` rev 12, BUG 1 and BUG 2 — one a
   baseline and draft *created* apart, the other *destroyed* apart). So two-step is the shape the wizard can
   already express with zero new discipline, and the sequencing §6.3 once called the hard case is
   `applySubResourceDiff`'s first `if`.

   **The real wizard cost, which the risk register now points at (R11):** phases 2 and 3 are single-stage
   `forkJoin`s with no per-row baseline, and the location/bystander attach stops being request-free because
   `CustomMoves` is on the detail response and not the list item (§6.5 rules out widening the list). Both
   are costs of *those phases never having carried a sub-resource before*. They would exist identically
   under either write shape, which is exactly why they are not a consequence of §2.10.
3. **The partial-failure copy does not change in wording, and two pages' copy is wrong before this starts.**
   Not a widening of one string: `location-create.ts:106` and `bystander-create.ts:106` say *"some of its
   mysteries"*, which becomes false by omission the moment a custom-move `POST` can fail in the same batch
   under the same flag. Those two converge on the shipped *"some details"* string that `monster-create.ts:290`
   and `minion-create.ts:335` already use — a correctness fix forced by this plan, not a tidy-up — and the
   surviving wording is kept verbatim. The four detail-page strings do **not** change, because a detail
   page's Save batches memberships only while the card writes per-row immediately and reports its own
   failures. §13.6.1's three rulings govern; Skyler has confirmed the wording stands.
4. **A parameterised owner segment moves "which owners support custom moves" out of the route table.**
   Swagger will show one templated route instead of five concrete ones, and the legal owner set lives in a
   route constraint rather than being readable from five `[HttpGet]` attributes. Mitigated by the constraint
   being the *single* source of truth — but it is a real, small loss of at-a-glance discoverability, and the
   one thing the five-controller shape did better.
5. **A single `custom_moves` table makes an undecided thing trivially easy.** Custom moves are
   *deliberately* excluded from search (`MonsterSearchProvider.cs:11`, `MinionSearchProvider.cs:11`,
   `docs/search/architecture.md` §3), with two tests asserting the exclusion (`SearchProvidersTests.cs:355`,
   `:485`). One table makes adding them a five-line change, which is exactly the condition under which
   someone does it without a decision. Ruled out of scope; the two tests are the guard.
6. **The real risk in this plan is not the schema or the controller — it is the wizard** (§6.3). The backend
   work is mechanical and has an oracle.

---

## 3. The target shape

### 3.1 Entity and context configuration

```
public enum CustomMoveOwnerType { Mystery, Monster, Minion, Location, Bystander }

public sealed class CustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public CustomMoveOwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
}
```

No nav property (§2.6). No `ITimestamped` — none of the five tables has timestamps today and nothing asks
for them. Table `custom_moves`; columns `id`, `owner_type` (string, max 16), `owner_id`, `name` (max 255,
required), `description`; index per §2.7. The entity and its enum live next to `ResourceImage` in
`DomainEntities.cs`, each commented with a pointer to the other and to §2.8, so "why are there two
owner-type enums" answers itself at the site.

### 3.2 `ICustomMoveService`

Modelled on `IResourceImageService`, smaller:

```
Task<ServiceResult<IReadOnlyList<CustomMoveResponse>>> ListAsync(owner, ownerId, ct);
Task<ServiceResult<CustomMoveResponse>>                CreateAsync(owner, ownerId, UpsertCustomMoveRequest, ct);
Task<ServiceResult<CustomMoveResponse>>                UpdateAsync(owner, ownerId, moveId, UpsertCustomMoveRequest, ct);
Task<bool>                                             DeleteAsync(owner, ownerId, moveId, ct);
Task<IReadOnlyList<CustomMoveResponse>>                ListForProjectionAsync(owner, ownerId, ct);
Task                                                   DeleteAllForOwnerAsync(owner, ownerId, ct);
```

Six methods, no batch variant and no owner-check exemption — every write is one move against an owner that
already exists (§2.10). `ListAsync` returns `NotFound` when the owner does not exist;
`ListForProjectionAsync` is the no-owner-check variant the five detail projections use (the owner has
demonstrably just been loaded). `Name` is trimmed and `Description` trimmed-or-null, matching every existing
implementation (`MonsterService.cs:482`). Ordering stays `OrderBy(Name)` — the behaviour all four existing
repositories already have, preserved so the switchover is a refactor with a working oracle. Registered in
`Program.cs` beside `AddScoped<IResourceImageService, ResourceImageService>()` (`:42`).

### 3.3 `CustomMovesController`

One file, four actions, no per-domain code:

```
[ApiController]
public sealed class CustomMovesController(ICustomMoveService customMoveService) : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, CustomMoveOwnerType> Owners = ...;

    [HttpGet("api/{owner:customMoveOwner}/{ownerId:guid}/custom-moves")]
    [HttpPost("api/{owner:customMoveOwner}/{ownerId:guid}/custom-moves")]
    [HttpPut("api/{owner:customMoveOwner}/{ownerId:guid}/custom-moves/{moveId:guid}")]
    [HttpDelete("api/{owner:customMoveOwner}/{ownerId:guid}/custom-moves/{moveId:guid}")]
}
```

`ToActionResult`/`NotFound` handling matches the existing convention. The five domain controllers lose their
custom-move actions entirely and gain nothing; `MysteriesController` never grows any; the eight create
endpoints (§1.3) are untouched.

### 3.4 Detail projections

Five sites (§2.6). Each domain service loads its entity, calls `ListForProjectionAsync`, and passes the
result into its existing private response-mapping method as a parameter instead of reading
`entity.CustomMoves`. The five `.Include(x => x.CustomMoves)` lines are deleted. Mystery's tracked read path
(`asNoTracking: false`) needs the same treatment on both branches.

### 3.5 Delete flows

| Domain | Change |
|---|---|
| Monster | Add `DeleteAllForOwnerAsync(Monster, id)` **and** one call inside the existing `foreach (minionId)` loop (§2.4). Transaction already present. |
| Minion | One call. Transaction already present. |
| Location | One call. Transaction already present. |
| Bystander | One call. Transaction already present. |
| **Mystery** | **New.** `MysteryService.DeleteAsync` (`:84`) has no transaction, and `IMysteryRepository` has **no `BeginTransactionAsync`** — the only one of the five that doesn't. Add it (copying `IMonsterRepository.cs:66-71`'s documented shape), wrap the delete, add the cleanup call. Deleting a Mystery cascades only its M:N bridge rows, so there is no nested-owner trap here. |

`MysteryServiceTests`' fake repository gains the transaction method; `NoOpDbContextTransaction.cs` already
exists for exactly this.

---

## 4. Mystery parity is no longer a phase

Worth stating on its own, because it changes the shape of §5.

Under a unified controller there is **no mystery-specific backend work to sequence.** The moment
`CustomMovesController` exists with `mysteries` in its owner constraint, Mystery has the same four endpoints
as everything else. What remains is three small items that belong with the other four domains, not after
them: the detail projection (§3.4), the delete-flow cleanup and its missing transaction (§3.5), and the enum
member.

So **the Mystery-last ordering dissolves on the backend and survives only on the frontend** — where it is
right, because the wizard is where the complexity actually is.

### 4.1 Consequence: an editable custom-moves card on `mystery-detail` needs no new endpoints

Decision 12 (§8.1) makes `mystery-detail` editable, and the preference attached to it was to write new
endpoints matching the other domains' CRUD rather than reach into wizard-only functionality. **That
preference is satisfied by construction, and its premise does not apply here — so no endpoints should be
added.** Stated plainly rather than built, because building to satisfy it would add a second way to write a
custom move:

- `GET/POST/PUT/DELETE /api/mysteries/{id}/custom-moves` are delivered by Phase 2's single
  `CustomMovesController` the moment `mysteries` is in the owner constraint. They do not merely *match* the
  other domains' pattern — they are the **same four actions**, the same service and the same validation,
  reached through a different route segment.
- `MysteryDetailResponse.customMoves` already exists and Phase 2 keeps it populated (§3.4), so the card
  hydrates from `mystery-detail`'s existing `forkJoin` with **zero new reads**.
- **There is nothing wizard-only to shoehorn.** `sub-resource-diff.ts` is wizard-local
  (`features/mysteries/pages/mystery-create/`, not `shared/`), but it is not an *endpoint* — it is a client
  helper the wizard uses to decide which of those same generic calls to make. The detail page calls them
  directly, per row, exactly as the other four detail pages will.

**So the lift is UI-only. Precisely, in `mystery-detail.ts`/`.html` — five additions and one deliberate
non-addition, as built:**

| | What | Size |
|---|---|---|
| 1 | An `activeMutation`/`isMutating` pair — the page has `isLoading` and no mutation state | Trivial; `location-detail.ts`'s is the shape |
| 2 | `NotificationService` injected — not currently on this page | Trivial, and per item 6 it is the *correct* failure surface, not a fallback |
| 3 | `ConfirmDeleteModalComponent` plus the closure-carrying page-owned `pendingDelete` record — the page's first modal, and the only new census entry in the whole plan (R12) | Real but bounded; `monster-detail.ts:75` is a literal copy source (§4.2) |
| 4 | **A `mysteryId` signal.** `ngOnInit` reads `params.get('id')` *inside* its pipe and discards it, so the page has no stored route id for a write to address | Trivial once seen, invisible until you try to write |
| 5 | **A targeted refetch.** The other four pages route custom-move writes through an existing `runAndRefresh`; this page has none, and re-running its four-arm `forkJoin` plus minion fan-out would be both wasteful and *wrong* — a failure in any unrelated arm would surface as a custom-move failure | The one addition that earns its own method |
| 6 | **No new inline error surface — and `errorMessage` must not be reused for write failures** | A deliberate *non*-addition, and the one that prevents a bug (R14) |

Items 4 and 5 are the two a reading of the component misses and building it finds: both are consequences of
the page never having had a write path at all, rather than of custom moves.

**Item 4 is the correction worth making to §14-R9's list.** `mystery-detail.html:6` places
`@else if (errorMessage())` **ahead of** the content branch, so setting it after a failed custom-move write
would unmount the whole page — replacing the mystery with a red line. That is the identical hazard
`location-detail.ts:134-135` documents and already solves: *"the membership caveat is a toast only;
`errorMessage` stays `null`"*, because that template orders its branches the same way. So `errorMessage`
stays load-and-entity-save only, custom-move failures go to the toast, and **mystery-detail needs three
additions rather than four.**

**Two gates this reaches that are invisible from the feature, named in R12 and R13.** Adding a custom-move
delete flow is not only component code: `shared/confirm-delete-modal.call-sites.spec.ts` pins every call
site as transcribed data and asserts an exact census, and `location-detail.ts:55-56` carries a standing
instruction that names this feature by name. Both are in §7.

**Placement:** the mystery *detail* card is the same work as 5a–5d and is blocked on nothing the wizard
needs, so it is its own sub-phase **5e**, and the wizard becomes **5f-0…5f-3** (§5). Mystery stays last
among the detail pages, per decision 7.

### 4.2 One confirm modal per page — already the shipped pattern, and no component work

Decision 14 settles that a detail page mounts **one** `<app-confirm-delete-modal>` carrying every delete
flow on it. Three things that decision does *not* cost, verified rather than assumed:

**1. No new component, and no modal consolidation.** The app has exactly two modal components:
`shared/confirm-delete-modal.component.ts` (18 uses) and `shared/image-upload-modal.component.ts` (4 uses).
The confirm modal is **already** the single flexible component the decision describes — ten inputs
(`visible`, `verb`, `itemName`, `confirmLabel`, `message`, `items`, `usage`, `usageMessage`, `footnote`,
`secondaryLabel`) and three outputs, with cancel + *optional* secondary + primary, so one-button and
two-button cases are one component today. The only other modal is an upload **form**, not a dialog variant.
**There is no "broad range of modal types" to collapse, so nothing downstream should read decision 14 as
authorising a modal-component refactor.**

**The standing intent, recorded because the component's name understates it.** Decision 14's phrasing is
*"only one 'confirm/inform' modal, and the image modal is a separate thing."* `confirm-delete-modal` is
therefore the app's **one confirm/inform dialog for every such case, whatever the verb** — image upload
stays its own component because it is a form, not a dialog variant. This is already how it ships rather
than an aspiration: five call sites pass a non-`Delete` verb today, and the component documents why —
`hunter-create.html:59-60` passes `verb="Switch to"` with `confirmLabel="Switch playbook"` (not a deletion
at all), `:71` passes `verb="Discard"`, and the four wizard roster call sites pass `verb="Remove"` because,
in the component's own words, *"dropping a draft card from the roster is not a deletion at confirm time."*

So **a future non-delete confirm belongs in this component, and a third component must not be added on the
grounds that this one says "delete".** One honest gap, so the claim is not overstated: the *inform* half is
not yet exercised — every current call site has a destructive primary styled `bg-danger`, so a
notification-only dialog would be the first and would want a non-danger primary. That is a small additive
change to this component if it ever arrives, not a reason for a new one. The name is the only thing that
sits oddly, and renaming is **not** part of this work — custom-move delete is a delete, so nothing here
needs it; §12 F4 carries it as a follow-up.

**2. The confirm modal needs no input widened for a custom-move row.** Its title renders
`{{ verb }} "{{ itemName }}"?`, and §13.3 specifies passing no `message` (so the `'This cannot be undone.'`
default applies, which is true on a detail page) and no `footnote`. So a custom-move call site binds
`visible` and `itemName` and nothing else — **the least demanding of all 18 existing call sites.** If any
later need arises it should be argued then; none exists now.

**3. "One per page" is not a union of variant types — it is a closure, and it already ships.**
`monster-detail.ts:75` and `minion-detail.ts:63` both hold

```
readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);
```

…and `monster-detail.html:296` states the intent in as many words: *"One modal for every delete on this
page, images included."* Five flows — attack, power, armor, weakness, image — already funnel through that
one element and one pending concept. Because the variant is carried as `perform: () => void`, the confirm
handler never branches on *which kind* of delete is pending; it calls `pending.perform()`. A discriminated
union of variant shapes would have required a `switch` at the confirm site, so this is the better shape and
the one to extend. Adding custom moves is one `requestDeleteCustomMove(id, name)` method setting
`{ label: name, perform: … }`.

**What it does cost** is confined to the two pages that do not have this yet: `location-detail` and
`bystander-detail` hold no page-level `pendingDelete` at all and bind the modal from
`imagesStore.pendingDelete()`. Migrating them is R13's item, and decision 14 makes that migration
**load-bearing rather than incidental — a closure-carrying page-owned pending record *is* the pattern
`location-detail.ts:55-56` instructs them to adopt on gaining a second delete flow.**

---

## 5. Phasing

Sequenced so the mechanical work is fully separated from anything a user can see, the single irreversible
step is isolated in a commit that changes nothing else, and the genuinely hard part (the mystery wizard)
comes last with a design pass and a re-evaluation in front of it. One commit per phase on a single feature
branch, matching the resource-images workflow.

### Phase 0 — Decide
This document plus Skyler's answers (§8). Then Rosalina's UI pass, then Luigi/Bowser.
**Gate:** §8 answered; decision record filed.

### Phase 1 — The table and the service, additive only *(Bowser)*
`CustomMove` + `CustomMoveOwnerType` + context config + a migration that **creates `custom_moves` and
touches nothing else**. `ICustomMoveService`/`CustomMoveService` + DI + SQLite-backed unit tests.
**Nothing calls it.** The five old tables still serve the sixteen old endpoints; zero behaviour change.
**Gate:** migration applies cleanly to a fresh real-Postgres database (the
`ResourceImageMigrationPostgresTests` gate, extended — it is the **only** test in the suite that runs real
migrations; everything else builds schema from the model via SQLite `EnsureCreatedAsync` and would never
notice a bad migration). Service tests green, including owner-existence and mismatched-owner cases.

### Phase 2 — The unified API, and the old endpoints removed *(Bowser)*
`CustomMovesController` with its four actions and owner constraint. The five detail projections re-point at
`ListForProjectionAsync` and lose their `.Include`s. All five delete flows gain their cleanup calls,
including the minion loop (§2.4) and Mystery's new transaction (§3.5). **The sixteen old controller actions
are deleted.** `MonsterMinionCascadeTests` extended per §2.4. The eight create endpoints and the five
`Upsert{Domain}Request` records are **untouched** (§1.3).

After this phase the five old entities, repositories and domain-service methods are still present but
**orphaned** — nothing calls them, everything compiles. Deliberate: it keeps the behaviour change and the
destruction in separate, separately-revertible commits.
**Gate:** all four verbs exercised against all five owner segments on a running server; an unknown owner
segment 404s at routing; the four previously-working domains behave as they did before (same bodies, same
status codes); `POST`/`PUT` entity bodies byte-identical to today; cleanup and cascade tests green per
domain.

### Phase 3 — Teardown *(Bowser)*
Pure deletion plus one migration. Removes: 5 entities, 5 nav collections, 5 `DbSet`s, 5 context config
blocks, 16 repository interface methods + 16 implementations, 16 domain-service interface methods + 16
implementations, 4 of the 5 `ToResponse` overloads, and the fake-repository members in four test files.
**The migration drops the five old tables.** No behaviour changes.
**Gate:** build and full suite green with nothing re-added; the drop migration applies on real Postgres;
`git diff --stat` is net-negative and contains no logic changes. This is the only irreversible commit in the
plan (§7 R4).

**— Everything above is invisible to the user. Everything below is Rosalina's and Luigi's. —**

### Phase 4 — Frontend plumbing and the shared card, no page wiring *(Luigi)*
`core/custom-moves.ts`: one service, `OWNER_SEGMENT` map, path builder, four methods, `SUPPRESS_ERROR_TOAST`
on all four (§2.9). `CustomMoveOwnerType` added to `models.ts`. Plus
`shared/custom-moves-card.component.{ts,html}` and its spec — per §13.7 the card is presentational with no
service dependency, so it is testable before any page uses it and belongs here rather than inside 5a.

**No shared diff primitive, deliberately.** `sub-resource-diff.ts` is wizard-local
(`features/mysteries/pages/mystery-create/sub-resource-diff.ts`) and stays there. It is the right engine for
the wizard and the wrong one everywhere else: the detail pages write immediately per row, and the create
pages write a batch once against an owner that has no prior state — neither has a hydrated baseline, which
is the only thing `applySubResourceDiff` exists to compare against.

**And there is a mechanical reason that is sturdier than that one, because it does not depend on anyone
agreeing about baselines:** the file imports `SubResourceIdentity` **from `mystery-create.store.ts`** — a
3,187-line store. Promoting the diff to `shared/` either drags that import with it or forces
`SubResourceIdentity` to move first. Nothing in Phases 4–5e should reach for it. The same applies to
`createDraftKey`, which lives behind a module-level counter in that store: the create pages need their own
key generator in `core/custom-moves.ts`, not a promotion of the wizard's, because a shared mutable counter
across two features that never co-mount couples their key sequences and those keys appear in wizard
failure output.
**Gate:** service unit tests covering all five owner segments and asserting the context token is set on each
method; card spec green.

### Phases 5a–5d — Four domains, detail **and** create, one per sub-phase *(Luigi)*
Monster (pilot), then Minion, then Location, then Bystander. Each sub-phase wires that domain's **detail
page** and its **create page** in one commit — folded together per domain for the same reason
resource-images folded detail and list together: it is the only way a domain is ever *finished*, and it puts
both halves of a pattern in front of the same reviewer at once.

**5a/5b** are the cheap pair: the create half is one more `runBatch` arm in an existing `forkJoin` (§2.10
item 2). **5c/5d** are not: they build their page's first draft list, first draft surface, first second
`forkJoin` arm and first combined failure flag, rewrite `location-create.ts:12-20`'s now-false class
comment, **replace** the two read-only blocks (`location-detail.html:55`, `bystander-detail.html:55`)
outright, converge the two *"some of its mysteries"* strings with their two specs (§2.12 item 3), and
**migrate location/bystander detail to the closure-carrying page-owned `pendingDelete` record** per the
standing instruction at `location-detail.ts:55-56` and decision 14 (R13, §4.2). Estimate 5c/5d above
5a/5b, not below.

**5a/5b add no modal element** — monster and minion detail already carry one modal for every delete on the
page, so custom moves are one `requestDeleteCustomMove` method there (§4.2 item 3).
**Gate per sub-phase:** detail CRUD and create-with-moves both exercised against the real dev server,
including a create whose move writes fail (must land on the caveat branch, never `error:`); the call-ledger
assertion in §10; **exactly one confirm modal mounted per page, with the custom-move delete routed through
it rather than a second element** (decision 14); that page's specs green. 5c/5d additionally: the migrated
pending record serves both image and custom-move deletes without the two disagreeing.

### Phase 5e — Mystery detail page *(Luigi)*
The fifth detail page, and the last of them, per decision 7. Scoped in §4.1: **no backend work, no new
endpoints, three component additions and one deliberate non-addition.** Separated from the wizard because it
shares nothing with it — same shared card, same per-row immediate writes, same host wiring as 5a–5d — and is
blocked on nothing 5f needs.
**Gate:** as 5a–5d, plus: a failed custom-move write leaves the page rendered and surfaces as a toast, with
`errorMessage` still `null` (§4.1 item 4); and the three overlay census specs updated for the page's first
modal — **the one new call site in the plan**, taking the census to 19 in 17 (R12).

### Phases 5f-0 – 5f-3b — The wizard *(Luigi)*
Rosalina's split, re-decided against the shipped code in **§35**. Four units became five: 5f-3 divides at
the seam between additive work and work that changes an interaction users already have. §2.12 item 2 is
where the cost actually sits: 5f-0 and 5f-3b, not sequencing.

**The order is load-bearing and is not a dependency chain** (§35.3). Only 5f-3 depends on 5f-0; 5f-1 is
phase 0 and 5f-2 is phase 1, which is already two-stage. 5f-0 must still go first because its entire gate
is *"both ledger specs pass unchanged"*, and 5f-1 amends six `currentStep.set(3)` call sites while 5f-2
extends the phase-5a id-survival oracle. Run either first and 5f-0 is checked against an oracle the
previous sub-phase edited. Same principle as Phase 1 being additive-only.

- **5f-0 — phases 2 and 3 get phase 1's shape.** Second stage, per-row baseline, id-and-baseline written
  back together, carrying phase 1's `index`-through-to-writeback rather than a positional match.
  **A provable no-op, under three conditions** (§35.2): both ledgers sort, so the gate proves *multiset*
  equality and gives up only sequence; no entity-level dirty check is adopted; and the diff emits on an
  empty collection, which it does because `batch` short-circuits to `of([])` — the one condition whose
  failure would be a **hang** rather than a diff. Same discipline as Phase 2/3's backend split.
- **5f-1 — the mystery's own moves.** Step `0-4` in `submitPhase0`'s existing post-id stage, as a `forkJoin`
  sibling of `upsertCountdown` rather than chained after it, plus the dossier block. The
  `set(3)` → `set(4)` sweep lands first as its own commit.
- **5f-2 — monster and minion composer panels.** Additive, with no new stage, sequencing or baseline
  discipline — but **~12 sites per owner, of which only two are protected by the compiler.** The commit
  carries that checklist literally rather than relying on memory.
- **5f-3a — location and bystander composer panels.** Additive, and the half that delivers the capability
  parity the scope cut was declined to protect. Leaves a stated interim: an *attached* existing location
  shows an empty panel while its real moves sit untouched on the server — display-incomplete and
  **provably non-destructive**, which its gate must pin rather than assume (§35.1).
- **5f-3b — the attach fetch and the two attach strips.** Last, and the only part of this whole plan that
  changes an interaction users already have. `attachLocation` (`mystery-create.store.ts:1547-1566`) builds
  a complete draft from the catalogue list item with zero HTTP calls today; once the draft needs
  `existingCustomMoves` it becomes a fetch, which reaches **80 call sites in four spec files** that fail
  with a `TypeError` inside the store rather than as a diff. Brings the spinner/disabled/local-error
  treatment and the `Next`-during-attach `[disabled]` term, which is a correctness fix and not polish.
  **If anything runs long, this is the unit to defer** — and splitting 5f-3 is what makes deferring it
  cost only the attached-location case instead of the whole capability (§35.1).

### Phase 6 — Cross-domain drift guard and polish *(Luigi, Toad)*
A five-domain parity spec modelled on `resource-images-four-domain-parity.spec.ts` — which exists precisely
because nothing in the type system makes independent per-page wirings agree, and which found a real
inconsistency the day it was written. **Covering create pages as well as detail pages**, since the draft arm
is added to five of them independently (§7 R5). Plus any genuinely cross-cutting copy or empty-state work.
**Gate:** the parity spec fails when any one of the five wirings is altered in isolation.

### Phase 7 — Research: unify the per-domain image endpoints *(Yoshi — research only, gated on Phase 6)*
**Research task, not an implementation.** Produces a document and a recommendation; writes no production
code and opens no branch.

Skyler, on learning that the image endpoints are duplicated per domain: *"we really should clean this up… it
makes a lot more sense to have it match this pattern instead… I agree that it's technically out of scope for
this work, but I would like it noted down and a reminder once this work is complete… add a phase at the end
to research this. Because the context is so similar, I think it would make sense to clean up the tech debt
alongside this work, but I don't want to get distracted in that solution until this custom move work is
done."*

**The target.** `ResourceImageService` is already a single cross-domain service, but its HTTP surface is
duplicated: six image actions on each of `MonstersController`, `MinionsController`, `BystandersController`
and `LocationsController` — **~24 actions** — each hard-coding its own `ResourceOwnerType`. The §2.9
treatment applies: one `ResourceImagesController` with six actions and a parameterised owner segment.

**What makes it harder than custom moves, and therefore worth researching rather than assuming:**

- The actions are **not** uniform. `POST` carries `[RequestSizeLimit]`/`[RequestFormLimits]` and binds a
  multipart `IFormFileCollection`; `GET .../file` and `GET .../thumbnail` set `Cache-Control` and return
  `File(...)` rather than a `ServiceResult`. Per-action attributes survive a move, but they need checking
  rather than assuming.
- Unlike custom moves, these endpoints are **shipped, working and user-facing** — `core/resource-images.ts`,
  `ResourceImagesStore`, three shared components and `shared/resource-images-four-domain-parity.spec.ts` all
  call them. This is a refactor with live consumers, which is the opposite of the condition that made the
  custom-move case cheap (§2.9).
- `resource-images/design.md` §3 explicitly chose per-domain controllers. Revisiting it means superseding a
  recorded design decision in writing, not quietly.
- **Mystery has no images today** and `ResourceOwnerType` has only four members. Skyler's own note:
  *"albeit, no image for the mystery, but an easy add later if it was desired."* So the research should say
  whether the owner constraint is four segments or five, and that is bound up with §2.8 — a fifth member
  would make `ResourceOwnerType` and `CustomMoveOwnerType` identical, at which point the two-enum decision
  is worth re-opening on purpose rather than by accident.

**Entry condition:** Phase 6 complete. **Exit:** a document in `docs/resource-images/` recommending
unify-or-leave, with its own phases if unify. Recorded as a standing follow-up in §12 so it survives this
document.

**Done, 2026-10-12 — `docs/resource-images/endpoint-unification.md`.** Recommends unifying (four commits,
backend-only, URLs byte-identical); three of the four "what makes it harder" bullets above did not survive
measurement, and the fourth — the enum convergence — was re-opened and **answered against this document's
§2.8**: see the amendment there.

---

## 6. The UI surface — scoped, not designed

**This section stops short of design.** It names what has to exist, what the backend is and is not agnostic
to, and what Rosalina is steering into — and leaves the choices to her.

### 6.1 What exists today, concretely

The phrase "consistent with the other domains" has three different referents in this app right now, which is
worth seeing before choosing one:

- **`monster-detail.html` and `minion-detail.html`** — four `<article class="bg-surface border border-default
  rounded-lg p-3">` cards (Attacks, Powers, Armors, Weaknesses), each a delete-per-row `<ul>` followed by an
  inline reactive add-form. **No custom-moves section at all.**
- **`location-detail.html:55` and `bystander-detail.html:55`** — a bare `<h3>Custom Moves</h3>` and `<ul>`
  below the edit form. No card, no form, read-only, name only.
- **`mystery-detail.html`** — neither pattern. Only linked-entity sections with uppercase, letter-spaced
  `<h3>`s. **No sub-resource panel of any kind.**

`description` is rendered **nowhere**, on any page.

The closest existing thing to what a custom move needs is the **Powers panel**
(`monster-detail.html:168-201`): a required Name input and a Description textarea, delete-per-row. A custom
move's fields are *exactly* a Power's fields.

The closest existing **cross-domain** pattern is `app-resource-images-card` + `ResourceImagesStore` +
`core/resource-images.ts` + `resource-images-four-domain-parity.spec.ts`: one component with an
`@Input({required: true}) ownerType`, one store, one service with a route-segment map, and a drift guard.
Here it would be five domains.

### 6.2 What has to exist afterwards

An authoring surface reaching all four verbs, rendering `description`, on **all five detail pages** and on
**all five create flows** (§6.3) — including the mystery wizard.

### 6.3 Create-time authoring — the staging flow, and the rule that governs its failure

**Settled: custom moves are staged client-side during creation and written through their own endpoints after
the entity exists** (§2.10). Concretely, for the four create pages:

1. The user adds moves to a local draft list — the same role `attackDrafts()`, `powerDrafts()`,
   `armorDrafts()` and `weaknessDrafts()` already play in `monster-create.ts`. Standing: sub-item lists use
   `signal<T[]>`, not FormArrays.
2. On submit, the entity is POSTed. Nothing about the entity request changes.
3. The returned id feeds a `runBatch` of one `POST /api/{owner}/{id}/custom-moves` per draft — **a new arm
   inside the `forkJoin` that already runs** `saveSubResourceDrafts()` and the membership links (§1.4).
   `runBatch` short-circuits an empty list, so a create with no moves fires no extra request at all.

**Where a partial failure lands, and the rule that is now load-bearing again.** A failure in that batch is
caught into `draftsFailed` rather than reaching the error handler, and the standing decision governs what
the user sees:

> *"An entity-then-batch write that partially fails is a success with a caveat, never an `error:`."*
> (`rosalina-partial-failure-copy-entity-linking.md`)

The reason, from that record: routing it to `error:` leaves the user on a populated create form whose only
control makes a duplicate. The existing behaviour is the hedged notification *"…some details may not have
saved. Review them on the monster page."* (`monster-create.ts:290`) plus navigation to the **flat** detail
route rather than the mystery-scoped one, because the scoped route would assert a membership no longer known
to hold.

**Two consequences, both now settled in §13.6:**

- **Two of the four pages' copy is wrong before this starts**, not merely narrow —
  `location-create.ts:106` and `bystander-create.ts:106` say *"some of its mysteries"*, which a custom-move
  failure under the same combined flag makes false by omission. They converge on the shipped *"some
  details"* string that monster and minion already use; the wording itself is unchanged, and the four
  detail-page strings are untouched because a detail page's Save batches memberships only. §13.6.1's three
  rulings govern, confirmed as decision 13.
- **The caveat branch sends the user to the detail page to fix it** — the same card, in the same place,
  with the same controls as the create surface they just left, which is what makes the bounce coherent
  rather than a dead end.

**In the mystery wizard, the sequencing is not the hard part.** A draft with no id creating and a draft with
an id updating is `applySubResourceDiff`'s first branch, not something anyone writes: the wizard already
resolves the entity id first and only then diffs each collection against a hydrated per-row baseline, across
eight existing collections. Custom moves drop into that engine without adaptation, and §2.9's
owner-parameterised client service makes this the first such adapter that needs no per-owner twin. What the
wizard *does* inherit: submission happens at phase transitions, not at the end; sub-item lists use
`signal<T[]>`, not FormArrays; a draft carrying an id must upsert rather than insert
(`mystery-entity-linking.md` §5.2, specifically about sub-resources); dirtiness is derived per row from a
hydrated baseline rather than stored as a flag; and a baseline and its draft are created and destroyed
together.

**It does not touch `pendingRemovals`.** That union is for roster *entities*, where a removal carries a
Detach-versus-Delete disposition and must survive an abandoned wizard. A sub-resource row removed in a
composer is deferred by construction — the control splices the draft array, and the server `DELETE` happens
at the next phase transition through the diff's delete bucket. Nothing is added to that type and nothing new
has to drain, which is the difference between touching cross-cutting wizard state and not touching it.

The real cost is in the two domains this section once called easy: phases 2 and 3 have no second stage and
no per-row baseline, and the location/bystander attach stops being request-free (§2.12 item 2, R11,
Phase 5f-3). Custom moves on the *mystery itself* remain the cheap case, because `submitPhase0` is already
an entity-then-id-dependent-sub-resource pipeline — that is how the countdown is written.

### 6.4 Answered by the design pass

All six questions this section raised are closed in §13, and the answers are what Phases 4–5f are now
written against. Kept here with their resolutions rather than deleted, because the *reason* each was a
question is what makes the answer checkable.

| Question | Resolution |
|---|---|
| Shared component or per-page markup? And how does it avoid looking foreign on pages with no sibling panels? | **One shared presentational `app-custom-moves-card`**, wearing the same `<article class="bg-surface border border-default rounded-lg p-3">` shell as the eight sibling panels, `app-resource-images-card`, *and* `mystery-detail`'s four linked-entity articles. The "does it travel" question had a shipped answer I had not used: that shell is already carried onto `location-detail` and `bystander-detail` by the images card. §13.2. |
| Which of §6.1's three treatments, applied to all five pages? | The card — chosen because it is the only one of the three already proven page-independent, not because it is the richest. The bare `<h3>`+`<ul>` cannot carry four verbs; a fifth grid cell has no referent on three of five pages. §13.2. |
| Create-time staging surface: same component or a sibling? | **Same component, no `mode` input.** Immediate-versus-staged is what the *host* does with the card's events — which is how the images card is already built. §13.4. |
| Partial-failure copy and the create→detail recovery path, designed together? | Yes, and the copy question turned out to be a correctness fix rather than a wording choice (§6.3, §13.6). |
| Wizard: mystery-level moves versus moves on composed entities — same surface? | **Different.** The mystery's own moves become wizard step `0-4`; composed entities get hand-written composer panels, not the shared card, because the `w-[42%]` column is a different density. The rule stated: *share across pages of the same density, copy across densities.* §13.5. |
| How `description` renders, and the empty state? | §13.3, including `whitespace-pre-wrap` — which also surfaced that the eight existing sibling panels collapse newlines today (flagged, not swept: §14 F-R3). |

Two corrections from that pass are folded into my sections rather than left to disagree: the create-page
batch is first-of-kind on two of four pages (§2.10 item 2), and `pendingRemovals` is not in the blast radius
(§6.3).

### 6.5 What the backend is agnostic to

Everything in §6.4. The only UI question that would have reached the API is a custom-move **count on list
rows**, and that is ruled out — so no list projection, list contract or TypeScript list interface changes
anywhere in this plan. The create endpoints and entity request records are untouched either way (§1.3).

**This sentence is the one §12 F5 would reverse**, and it is flagged here rather than only there because
this is where someone checks whether a list projection is in scope. The ruling stands for Phases 1–6;
Skyler has reserved a reconsideration for afterwards, on the grounds that putting `customMoves` on the
location and bystander list items would make the wizard's attach simpler. F5 records that it would in fact
**delete a sub-phase** rather than simplify one, along with the cost of doing so. **Nothing in 5f may be
designed in anticipation of it.**

---

## 7. Risks and sharp edges

| # | Risk | Mitigation |
|---|---|---|
| R1 | A future delete path forgets `DeleteAllForOwnerAsync` and orphans rows. | The call sits in the same five `DeleteAsync` methods that already make the identical call for images — a new path would have to miss two, not one. Plus a per-domain cleanup test. |
| R2 | The Monster→Minion DB cascade orphans minion moves, and the existing cascade test stays green. | §2.4. Extend `MonsterMinionCascadeTests` to seed a minion custom move. **This is the one that will actually happen if it is not written down.** |
| R3 | Two string-backed owner-type enums with overlapping members get confused. | §2.8. Name each for its feature, site them adjacently, cross-reference in comments. Never extend `ResourceOwnerType` with `Mystery` — and if Phase 7 adds a fifth member for images, re-open the two-enum decision deliberately. |
| R4 | Phase 3's migration drops five tables irreversibly; its down-migration recreates them empty. | Confirmed expendable. Isolated in a commit that changes nothing else, so the irreversible step reviews on its own. |
| R5 | **The create-page draft arm is added to five pages independently, and nothing makes the five agree** — a missing arm, a duplicated one, or one that skips `runBatch`'s empty short-circuit and fires an empty request. | Phase 6's parity spec covers **create** pages, not only detail pages. Plus the §10 call-ledger assertion per domain: for N staged moves, exactly N custom-move POSTs and no more. A positive `toContain` assertion cannot see a duplicate arm — the standing reason that ledger shape exists. |
| R6 | Someone "simplifies" the create flow later by moving `customMoves` into the entity request, reaching the `PUT` path by construction (§1.3). | The standing membership rule plus §1.3's verified table. Worth a comment at the `Upsert{Domain}Request` declarations naming why no collection lives there. |
| R7 | The owner route constraint drifts from the enum — a sixth owner type added to one and not the other. | The constraint and the controller's segment→enum dictionary are three lines apart in one file. A test asserting every `CustomMoveOwnerType` member has a reachable route is cheap and worth having. |
| R8 | SQLite builds test schema from the model; only one test runs real migrations. | Extend `ResourceImageMigrationPostgresTests`, or add its sibling, as the Phase 1 and Phase 3 gates. A migration bug is otherwise invisible until deploy. |
| R9 | Search quietly gains custom moves because one table makes it a five-line change. | §2.12 item 5. The two `SearchProvidersTests` exclusion tests are the guard; keep them, retargeted. |
| R10 | The extra detail-page query (§2.6) is five new round trips nobody budgeted. | Named here rather than discovered. Trivial at this scale, and orthogonal to the controller shape. |
| R11 | **The wizard's cost is in its two never-had-a-sub-resource phases and in the attach, not in sequencing — and it is now measured.** `submitPhase2`/`submitPhase3` are flat single-stage `forkJoin`s with no per-row baseline; refreshing ids without their baselines is the documented H2 hazard that makes every later submit delete and recreate the lot. The attach change reaches **80 call sites in four spec files**, failing with a `TypeError` inside the store rather than as a diff. And 5f-2's additive work is **~24 sites across the monster/minion pair, 10 of them unprotected by the compiler** — one of which (`monsterComposerDirty`) silently discards a composer holding only a custom move. | **5f-0** restructures both phases as a **provable no-op** under §35.2's three conditions; **5f-3b** isolates the attach so it is the deferrable unit without costing the capability (§35.1); **5f-2** carries its unprotected-site checklist in the commit. None of this is a §2.10 cost — it exists under either write shape (§2.12 item 2). |
| R12 | **`shared/confirm-delete-modal.call-sites.spec.ts` has two halves, and only one of them is a gate. The non-wizard half fails *silently* — which is the opposite of a spec that bites.** Its eleven non-wizard rows are transcribed data compared against themselves (`Object.keys(perTemplate)` and a `reduce` over the literal three lines above), so adding a call site leaves the suite **green** until someone edits the literal by hand. Measured in 5e: the new `mystery-detail` modal broke nothing. Its **wizard** rows *are* genuinely derived, from the rendering harness in `mystery-create-phase5b-monster-phase.spec.ts` — so the real failure risk is in **5f**, not 5a–5e. Arithmetic, for the record: every detail page already mounts exactly one confirm modal, so the four existing pages added zero elements and only `mystery-detail` added one — 19 in 17. | Treat it as **a literal to update, not a gate**, for anything touching the detail pages: the commit must edit the census by hand because nothing will remind it. Treat it as **a live gate for 5f**, where the wizard rows are derived and a composer or roster change can fail it for real. The three-spec overlay rule still stands and is why this got checked: `confirm-delete-modal.call-sites.spec.ts`, `escape-nesting.spec.ts` (`:112` pins that every detail page mounts the upload modal and one confirm modal as siblings), `custom-select-escape-surfaces.spec.ts`. |
| R13 | **`location-detail.ts:55-56` carries a standing instruction naming this feature by name** — *"If this page ever grows a second delete flow (Custom Moves is read-only here today), it should move to the page-owned pattern."* Those two pages hold **no** page-level `pendingDelete`; they bind the modal straight from `imagesStore.pendingDelete()`, which cannot also carry a custom-move row. | 5c/5d migrate both to the closure-carrying page-owned record `monster-detail.ts:75` and `minion-detail.ts:63` already ship (§4.2 item 3). **Decision 14 makes this load-bearing rather than incidental** — that record *is* the page-owned pattern the comment asks for. Monster and minion need no migration. Budgeted in 5c/5d, the expensive pair. |
| R14 | **Setting `errorMessage` on a failed write unmounts the page.** `mystery-detail.html:6` orders `@else if (errorMessage())` ahead of the content branch, as all five detail templates do. A custom-move failure wired to an inline error would replace the entity with a red line. | **Discharged.** Phase A made `errorMessage` **load-only** across the whole detail-page family — it was already live on two pages before this feature — and 5e built the fifth page's first write path with the rule in force. Both halves are pinned: a negative control setting `errorMessage` on a failed write fails exactly the two survival assertions, and a *load* failure still renders inline, so the branch now means exactly "this page could not be loaded". Nothing in 5f re-opens it; kept here because the hazard is a property of the template ordering, which has not changed. |

---

## 8. Decisions and open questions

### 8.1 Settled by Skyler, 2026-10-10

| # | Question | Answer |
|---|---|---|
| 1 | Drop the five old tables, no data migration? | **Confirmed.** *"I do not care about those tables or their data."* |
| 2 | `customMoves` embedded in detail responses, or client-fetched? | **Embedded, server-side fetch.** §2.6. |
| 3 | Authoring at create time, including the wizard? | **Yes, including the mystery wizard.** §6.3; Phases 5a–5d for the standalone create pages, 5f for the wizard, which stays gated on a re-evaluation. |
| 4 | Custom-move count on list rows? | **No.** No list projection or contract changes anywhere. |
| 5 | Mystery detail's custom-move surface? | **Consistent with the other domains** — which, per §6.1's three current treatments, means pick one and apply it to all five. Rosalina's pick. |
| 6 | Extend search to custom moves? | **No.** Possibly someday; out of scope. |
| 7 | Phase order? | **Mystery last** — most complex, and the only one that differs, *"particularly for the wizard."* Adopted; §4 explains why it now applies only to the frontend. |
| 8 | Five controllers or one? | **One**, with teardown of the existing per-domain endpoints. §2.9. |
| 9 | Nested path or flat `/api/custom-moves`? | **Nested**, served from the one controller. *"This is a strong solution and I agree with the reasoning."* §2.9. |
| 10 | Create-time write shape? | **Follow the sub-resource convention** — entity POST, then a draft batch of per-move writes. *"It does make more sense to not do this as a one-shot, since we are doing a series of sub-resource calls."* §2.10, with the cost it pushes into the wizard logged at §2.12 item 2. |
| 11 | Unify the duplicated per-domain image endpoints? | **Yes, eventually** — as a **terminal research phase** gated on this work finishing, not alongside it. Phase 7, with a standing follow-up in §12. |
| 12 | Should `mystery-detail` become editable (§15 Q1)? | **Yes.** *"I'm not sure the lift for this, but my hope is that it's mostly UI using existing backend, but I would rather write new endpoints that match the pattern of the CRUD for the other domains, than try to shoehorn in functionality that only exists in the mystery part of the wizard."* **It is UI-only, and no endpoints are added** — §4.1 scopes it: Phase 2's single controller already serves `/api/mysteries/{id}/custom-moves` as the same four actions the other domains use, and there is nothing wizard-only to shoehorn. Three component additions, one deliberate non-addition, two census gates. Phase **5e**. |
| 13 | Is the converged create-string wording acceptable as shipped (§15 Q2)? | **Yes** — *"the existing wording is fine."* §13.6.1's three rulings stand: the two *"some of its mysteries"* pages converge on the shipped *"some details"* string, the wording is unchanged, the four detail-page strings are untouched, and no third notification severity is added. |
| 14 | One confirm modal per detail page carrying every delete flow, or one element per flow? | **One per page.** *"One modal per page is actually much better… We should have a single modal component, abstract and flexible enough to handle functionality-specific cases. Wording can be as specific as needed, but we shouldn't have a broad range of modal types (one button, two button, confirm/cancel, etc.) so a single component should cover them, with flexibility for context."* §4.2 records what this costs — which is less than the question implied, because it is already the shipped pattern on two of the five pages. |

### 8.2 Open questions

**None blocking.** Nothing in this round surfaced a question that has to be answered before Rosalina's pass.

One item is deliberately *not* a question, recorded so the choice not to ask is visible: the create pages'
batch-plus-`draftsFailed` machinery is hand-rolled on each page and now carries a fifth sub-resource type
across five domains. Whether that pattern should be extracted or revisited as a unit is a real question, and
asking it now would widen this work's scope for no benefit to it. §12 F2 carries it.

---

## 9. Teardown inventory

Everything listed is **deleted**, not deprecated, across Phases 2 and 3.

**Database.** `monster_custom_moves`, `minion_custom_moves`, `location_custom_moves`,
`bystander_custom_moves`, `mystery_custom_moves` — dropped, with their five implicit FK indexes.

**Entities and context.** `MonsterCustomMove`, `MinionCustomMove`, `LocationCustomMove`,
`BystanderCustomMove`, `MysteryCustomMove`; the five `CustomMoves` nav collections on their parents; five
`DbSet`s; five `modelBuilder.Entity<...>` config blocks.

**Repositories.** 16 interface methods and 16 implementations across
`IMonsterRepository`/`MonsterRepository`, `IMinionRepository`/`MinionRepository`,
`ILocationRepository`/`LocationRepository`, `IBystanderRepository`/`BystanderRepository`; plus five
`.Include(x => x.CustomMoves)` lines.

**Services.** 16 interface methods and 16 implementations across `IMonsterService`/`MonsterService`,
`IMinionService`/`MinionService`, `ILocationService`/`LocationService`,
`IBystanderService`/`BystanderService`.

**Controllers.** 16 custom-move actions across `MonstersController`, `MinionsController`,
`LocationsController`, `BystandersController`. Those four controllers keep everything else, including their
create actions.

**Mappers.** 4 of the 5 `CustomMoveResponse ToResponse(...)` overloads (`ApiMappers.cs:97-107`, `:150`); one
remains, retargeted at `CustomMove`.

**Tests.** Fake-repository members in `BystanderServiceTests.cs:415-423`, `LocationServiceTests.cs:416-424`,
`MinionServiceTests.cs:312-320`, `MonsterServiceTests.cs:524-527`.

**Frontend.** Nothing to tear down — no client code exists (§1.4). The two read-only template blocks
(`location-detail.html:55`, `bystander-detail.html:55`) are replaced in Phases 5c/5d.

**Not touched at all, deliberately:** the eight entity-create endpoints and the five
`Upsert{Domain}Request` records (§1.3); `CustomMoveResponse` and `UpsertCustomMoveRequest`;
`MonsterServiceTests.cs:331-341`'s required-fields reflection table, which already asserts
`typeof(UpsertCustomMoveRequest)` carries its annotations and keeps guarding that unification did not
quietly relax validation; the two `SearchProvidersTests` exclusion tests (`:355`, `:485`), retargeted;
`MinionReparentApiHarness.cs:90` / `MinionReparentEndpointTests.cs:93`, retargeted — custom moves still
follow a reparented minion via `OwnerId`, so this is a free regression on the new shape.

---

## 10. Test impact

**New.** `CustomMoveServiceTests` (SQLite-backed, mirroring `ResourceImageServiceTests`);
`FakeCustomMoveService` with a `DeleteAllForOwnerCalls` ledger, mirroring `FakeResourceImageService.cs`;
per-domain owner-delete cleanup tests mirroring `MonsterImageCleanupTests.cs`; an endpoint test covering all
five owner segments plus the unknown-segment 404; the R7 route/enum agreement test; a migration gate.

**Extended.** `MonsterMinionCascadeTests.DeletingAMonster_CascadesItsMinionsAndTheirSubResources` must seed
a minion custom move (§2.4) — without it the test passes while the leak exists.

**Deleted / retargeted.** Per §9.

**Frontend — negligible today, and one assertion shape that matters later.** Every current reference is the
fixture line `customMoves: []` across ~20 spec files. **Zero** assertions. The fixtures keep compiling
untouched because `CustomMoveResponse` does not change.

New specs arrive with the UI in Phases 4–6 — plus **three existing overlay census specs that must be
updated in the same commit as each sub-phase** (R12), of which `confirm-delete-modal.call-sites.spec.ts` is
a hard count with per-call-site transcribed data, not a soft assertion. Also: the five-domain parity guard
(detail *and* create, per R5), and
per create page an **exact call ledger** — for N staged moves, the complete sorted multiset of requests
contains exactly N custom-move POSTs, and zero when the draft list is empty. That is the standing rule
*"assert the complete sorted multiset of calls wherever two code paths can reach one endpoint… a positive
assertion cannot see a duplicate, and a duplicate is the bug that lives in that blind spot"*
(`toad-exact-call-ledger-over-positive-assertions.md`) applied to exactly the hazard R5 names. A
partial-failure spec per page is the other half: the batch failing must produce the caveat branch, never
`error:`.

**Standing test decisions that apply.** A fake must mirror the real return semantics
(`toad-fake-repositories-must-mirror-real-return-semantics.md`) — `FakeCustomMoveService` must not return
hardcoded success where the real service returns `NotFound`. Query logic stays provider-agnostic because the
fixture is SQLite and production is Postgres (`bowser-search-phase1-backend.md`); nothing in this design
needs provider-specific SQL. And a baseline and its draft share one lifecycle
(`toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md`) — a Phase 5e concern, but the rule
the wizard work will be judged against.

---

## 11. Files this touches (estimate)

**Backend, Phases 1–3.** `Data/Entities/DomainEntities.cs` (−5 entities, −5 nav collections, +1 entity,
+1 enum) · `Data/MotwDbContext.cs` (−5 configs, −5 `DbSet`s, +1 config, +1 `DbSet`) · two migrations ·
`Controllers/CustomMovesController.cs` (new) · `Services/CustomMoves/ICustomMoveService.cs` +
`CustomMoveService.cs` (new) · a route-constraint registration in `Program.cs` plus one DI line ·
`Contracts/ApiMappers.cs` (5 overloads → 1) · `Contracts/ApiContracts.cs` (**unchanged**) · four
`*Controller.cs` (deletions only) · five `*Service.cs` and five `I*Service.cs` ·
four `*Repository.cs` and their interfaces · `IMysteryRepository.cs` + `MysteryRepository.cs`
(+`BeginTransactionAsync`) · `Services/Search/{Monster,Minion}SearchProvider.cs` (comment references only).

**Backend tests.** Four `*ServiceTests.cs` (fake deletions) · `MonsterMinionCascadeTests.cs` (extended) ·
`MinionReparentApiHarness.cs` + `MinionReparentEndpointTests.cs` (retargeted) · `SearchProvidersTests.cs`
(retargeted) · `MysteryServiceTests.cs` (fake repository) · the new files in §10.

**Frontend, Phases 4–5f.** `core/models.ts` (+`CustomMoveOwnerType`; `CustomMoveResponse` and the five
`customMoves` detail fields **unchanged**) · `core/custom-moves.ts` (new) ·
`shared/custom-moves-card.component.{ts,html}` + spec (new) · five detail pages and their components ·
four create pages and their components, of which **`location-create.ts`/`bystander-create.ts` gain their
first draft list and batch arm** and `location-create.ts:12-20`'s class comment becomes false and must be
rewritten · a five-domain parity spec covering detail **and** create · ~20 spec files **untouched**, because
`customMoves: []` keeps compiling.

**Three frontend consumers easy to miss, all verified:**

- **`mystery-create-dossier.html`** — the wizard's running account of what has been authored. Three blocks
  (the Mystery section, and the monster and minion composer previews). A collection absent from the dossier
  reads to the user as a collection that did not save (§14-R10).
- **`monster-create.html:32-35`** — *"Attacks, powers, armors and weaknesses added below are saved together
  with the monster when you press Create Monster."* The **only** place the staged-write model is explained
  to the user, and it goes stale the moment a fifth type appears below it. Its minion twin needs the same
  edit; location/bystander create need the sentence introduced.
- **The three overlay census specs** — `shared/confirm-delete-modal.call-sites.spec.ts` (hard count and
  per-call-site transcription), `shared/escape-nesting.spec.ts`, `shared/custom-select-escape-surfaces.spec.ts`.
  R12. These fail on a change that looks unrelated to them.

**Wizard, Phase 5f** (gated): `mystery-create.store.ts` (`submitPhase0`, `submitPhase2`, `submitPhase3`,
`saveThreatCollections`, `saveMinionCollections`, `writeBackMonsterDrafts`, `attachLocation`,
`attachBystander`, `phases`/`stepTitle`/`stepBlurb`/`phaseStepComplete`) · `hydrate-monster.ts` ·
`mystery-create-{mystery,monster,locations,bystanders}-phase.html` · `mystery-create.html` (the `Next`
disabled binding) · `mystery-create-dossier.html` · the existing ledger specs as 5f-0's gate.
`sub-resource-diff.ts` is **used, not moved** — it stays wizard-local (Phase 4).

---

## 12. Post-implementation follow-ups

Recorded here so they survive this document, per the `mystery-entity-linking.md` §12 convention. Each is
explicitly **out of scope** for Phases 1–6.

| # | Follow-up | Trigger |
|---|---|---|
| F1 | **Research unifying the ~24 duplicated per-domain image actions** into one `ResourceImagesController`. Skyler's standing request, including his note that Mystery has no image today and *"an easy add later if it was desired"* — which, if taken, would make `ResourceOwnerType` and `CustomMoveOwnerType` identical and is reason to re-open §2.8 on purpose. **Done, 2026-10-12 — `docs/resource-images/endpoint-unification.md`** (recommends unifying; §2.6 re-opens and closes the enum question, and corrects this row's premise — mystery images is a migration, not an enum edit). | **Phase 7** of this plan. Gated on Phase 6 completing. |
| F2 | **Revisit the create-page batch pattern as a unit.** `saveSubResourceDrafts` + `runBatch` + `draftsFailed` + the hedged copy is hand-rolled per create page, and after this work it carries five sub-resource types plus memberships across five domains. Worth asking whether it should be extracted into one primitive — the same question §2.9 asked about controllers, one layer up, and the natural companion to F1. | After Phase 6; F1 and F2 are one "cross-domain duplication" pass. |
| F3 | **Retire the two stale deferral notes** in `docs/phases/phase-8-minions-ui-flow.md:217` and `docs/phases/phase-9-bystanders-locations-ui-flow.md:496` (§1.7) — they defer this UI on a premise that was already false. | With Phase 6's record-keeping commit. |
| F4 | **Consider renaming `confirm-delete-modal` to match its actual role.** Decision 14 establishes it as the app's one confirm/inform dialog, and five call sites already pass a non-delete verb (`Switch to`, `Discard`, `Remove` ×4) — so the name is the only thing suggesting a second component might be needed for a non-delete case (§4.2). A rename touches 18 call sites, one component, three census specs and a decision record, all for zero behaviour change, so it wants its own small pass. **Explicitly not part of Phases 1–6**: custom-move delete is a delete. | On request, or the first time someone needs an inform-only dialog. |
| F5 | **Reconsider the no-widening ruling for `LocationListItemResponse` and `BystanderListItemResponse`.** Skyler, on being shown that the wizard's attach would have to fetch: *"I think the split for deferrable work is fine for now, but I want to circle back to this when the primary work phases are complete. I may have changed my mind about widening the list projection if it simplifies the means to display an attached location or bystander."* **Deferred, not open** — see the analysis below. 5f proceeds exactly as approved and **nothing in it should be designed in anticipation of this reversing.** | When Phases 1–6 are complete. Pairs with F1/F2 as the third item in a cross-domain cleanup pass. |


### F5 in full — because it is a bigger decision than "a convenience", and the cost side is real

Recorded here rather than in the table because the framing matters to the eventual call, and because this
is the entry a later reader will grep.

**It would not *simplify* the attach display. It would delete a sub-phase.** Verified against the code:
`attachLocation` (`mystery-create.store.ts:1547-1565`) builds a complete `LocationDraft` from the catalogue
list item with **zero HTTP calls**, synchronously, inside one signal update. The *only* reason 5f-3b exists
is that `CustomMoves` lives on `LocationDetailResponse` and not on `LocationListItemResponse`. Put it on the
list item and the attach stays exactly as it is today — which removes, in one change:

- the `list()` call on attach, for both locations and bystanders;
- `locationAttachInFlight` / `attachingLocationName` / `locationAttachError` and their bystander twins;
- the spinner / disabled / local-error treatment ported into two attach strips;
- the `Next`-disabled-during-attach term — which §30.5 correctly identifies as a **correctness** fix, not
  polish, because `next()` reads the roster synchronously;
- the new stub across **80 attach call sites in four spec files**, and the ~10 ledger entries that change;
- **and the interim state that made the 5f-3 split need a falsifier at all** (§35.1): with the moves on the
  list item, an attached location's panel is correct on arrival, so 5f-3a *is* the whole of 5f-3.

So the thing being weighed is not "a bit less UI work." It is **one of five wizard sub-phases ceasing to
exist, along with the only new in-flight state in the wizard and the only interaction-changing work left in
the plan.** That is the frame the decision should be made in.

**One consequence nobody has named, and it needs an answer in the same breath.** If 5f-3b disappears,
`CustomMoveService.list()` has **no caller anywhere**. It shipped in Phase 4 deliberately uncovered under
decision L-D3, on the explicit promise that 5f-3 would be its first real caller and its validation gate
(§27.2, §30.5). Widening the list projection retires that promise rather than keeping it — so the same pass
must either find `list()` a real caller or delete it. Shipping a method on a promise and then removing the
promise's only redeemer is how dead code becomes permanent.

**The cost side, stated honestly so the decision is real rather than foregone:**

1. **It is an uncapped collection of free text on a list route.** This is the strongest objection and the
   one that distinguishes it from the `PrimaryImageId` precedent. Images are capped at 10 per owner and the
   list carries a **single `Guid`**, never bytes. Custom moves have **no cap** (§2.7 deliberately declined
   a unique index, and nothing limits the count), and `description` is the field §14-R8 identifies as *"the
   type most likely to carry multi-line rules text."* So every location in the catalogue would ship its
   full moves, descriptions included, with no bound on either count or length.
2. **It is one endpoint with two consumers, and the wizard is the lesser of them.** The catalogue preload
   calls `locationService.getAll()` → `GET /api/locations` (`:1036-1045`) — **the same route the
   locations-list page uses** (`core/location.ts:15`). There is no wizard-only variant to widen. So the
   payload grows on a page a user visits to browse, in order to serve one wizard interaction. The honest
   version of the trade is *"make the browse route heavier so the wizard gets simpler."*
3. **It would reopen decision 4.** *"No custom-move count on list rows"* was ruled on the basis that a
   count requires a backend change. If the full array ships, `customMoves.length` is derivable client-side
   and the count becomes a pure display choice. That is not an argument either way, but it means decision 4
   stops being settled and §6.5's *"no list projection, list contract or TypeScript list interface changes
   anywhere in this plan"* is the sentence being reversed.
4. **Scope: two domains, not five — and the by-mystery variants stay out either way.** It is worth being
   exact, because "widen the list projection" sounds broader than it is. **Monster is not a candidate**:
   `hydrateMonsterDraft` (`:1120-1130`) fetches `getById` *plus* every minion's detail regardless, because
   a monster draft needs attacks, powers, armors and weaknesses — none of which are on any list item. So
   monster attach is irreducibly a fetch and widening its list would eliminate nothing. Minion and mystery
   are not attached from a catalogue at all. **The elimination applies to exactly location and bystander,
   which is exactly 5f-3b's scope.** And the four *by-mystery* list endpoints (`GET /api/mysteries/{id}/locations`
   and siblings) would **not** need widening — the wizard catalogue does not use them — which matters
   because resource-images already drew and tested that boundary
   (`ByMysteryVariantsStayOutOfScopeTests.cs`), and reopening it by accident would be a regression against
   a deliberate call.

**My read, for whenever this is picked up:** the deciding question is item 1 against the sub-phase
elimination. If a cap on custom moves per owner is acceptable (images took 10), the payload objection
mostly dissolves and widening becomes clearly right. Without a cap, the trade is a permanently unbounded
list payload against a one-time sub-phase, and permanent beats one-time. **So the real question to put to
Skyler at that point is not "widen the list?" but "cap custom moves per owner?"** — the first answer falls
out of the second. That reframing is the useful output of this entry, and it is why it is recorded now
rather than rediscovered later.

**Answered by Skyler, 2026-10-12 — item 1 does not hold, on a domain fact the code cannot show.** In his
words: *"custom moves are an exceptional object, not a typical one. Most entities will not have one, and it
will be incredibly unlikely to have two or more. This doesn't need a cap and will not increase the browser
load."* So the uncapped-collection objection is answered without a cap: the count is not merely bounded in
practice, it is **near zero for almost every row**, which is why no schema cap is wanted and why the
payload growth on `GET /api/locations` is nominal rather than unbounded-in-expectation. The reframing above
asked whether to cap custom moves per owner; the answer is **no cap, and none needed**, which collapses the
deciding question rather than answering it — item 1 was the only objection weighing against the sub-phase
elimination, and items 2–4 are scope and consequence rather than cost.

**This does not make F5 actionable yet.** It remains deferred by Skyler's own ruling until Phases 1–6 are
complete, and nothing in 5f may be designed in anticipation of it. What has changed is that the eventual
decision now looks likely to go in favour of widening, so whoever picks this up should expect to be
*implementing* it rather than re-arguing it — and should still answer the `list()`-has-no-caller
consequence above in the same pass, since that question is unaffected by the cardinality fact.

**One boundary worth recording for whoever picks up F1 or F2**, because it was derived here and will be
needed there: the standing rule *"never put a collection in an `Upsert*Request` body"* is mechanically
grounded in the fact that create and update **share** those records (§1.3). The sharper statement of the
underlying constraint is that **a whole-collection write is only safe when the collection is known to be
empty** — which is never true on an update path and is the reason the rule holds unconditionally for as long
as those records are shared.

---
---

# 13. The UI pass

**Prepared by:** Rosalina (Designer)
**Date:** 2026-10-10
**Status:** Design direction. **Appended to §§0–12, which are unchanged.** Where I think something above is
wrong I say so here (§13.8, §14) rather than editing it. No production code written or modified.

**Grounding — read this session, not inferred from §6.1:** all five `*-detail.html`; all four
`*-create.html` and their `.ts`; `mystery-create.html`, `mystery-create-mystery-phase.html`,
`mystery-create-monster-phase.html` + `.ts`, `mystery-create-locations-phase.html`,
`mystery-create-dossier.html`; `mystery-create.store.ts` (phases, `submitPhase0`–`submitPhase3`,
`saveMonsterDraft`, `saveThreatCollections`, `saveMinionCollections`, `attachLocation`, `attachMonster`,
`stepTitle`/`stepBlurb`/`phaseStepComplete`); `sub-resource-diff.ts`; `hydrate-monster.ts`;
`shared/resource-images-card.component.{html,ts}`; `shared/domain-icon.component.ts`;
`core/notifications.ts`; `core/http-error-interceptor.ts`; `core/resource-images.ts`; `app.config.ts`;
`Contracts/ApiContracts.cs` (the four list/detail record pairs); `styles.css` (`.action-btn`).

> **The pass, in five sentences.** One shared, presentational `app-custom-moves-card` wearing the
> `<article class="bg-surface border border-default rounded-lg p-3">` shell that `app-resource-images-card`
> already proved travels to all five pages, **full width rather than a fifth grid cell**, with row-level
> edit because `PUT` exists and no sibling panel has it. The same component serves the four standalone
> create pages with no `mode` input at all — immediate versus staged is what the *host* does with the card's
> events, which is already how the images card is built. In the wizard the card does **not** travel: the
> composers get a hand-written fifth panel matching their four neighbours, exactly as attacks/powers/armors/
> weaknesses are hand-written in all three of their surfaces today. The mystery's own moves become **step
> `0-4`**, written in `submitPhase0`'s existing post-id stage beside `upsertCountdown` — the precedent is
> already in that method. And the partial-failure story converges the four create pages on **one** string,
> because two of them currently say *"some of its mysteries"*, which custom moves make false by omission.

---

## 13.1 Three corrections to §6.1's inventory, before anything is designed on it

§6.1 is accurate as far as it goes. Three things it does not say change design decisions:

1. **No sibling sub-resource panel in this app has an edit affordance.** All four panels on
   `monster-detail.html` (`:116`, `:167`, `:203`, `:257`) and all four on `minion-detail.html` (`:60`,
   `:111`, `:147`, `:201`) are *add-form plus delete-per-row*. Custom moves have a `PUT` (§3.3), so row
   edit is **new on this page family**, not a copy of a local idiom. §13.3 decides it on its own merits
   rather than by appeal to consistency, because there is nothing to be consistent with.
2. **`mystery-detail.html` has no form, no mutation state, no error surface and no
   `<app-confirm-delete-modal>` — at all.** Its only control is the *Continue in wizard* link (`:14-21`).
   A custom-moves card there is the **first page-local write surface on that page**, which is a real cost
   and a product question (§15 Q1), not just markup.
3. **`location-create.html` and `bystander-create.html` have no sub-resource machinery whatsoever.**
   `location-create.ts:12-20` says so in its own words — *"Location has no interactive sub-resources… No
   draft arrays, no batched sub-resource submit"* — and its post-create batch is memberships only
   (`:88-93`). So §2.10's *"one more `runBatch` arm inside an existing `forkJoin`"* is true for Monster and
   Minion and **not** true for Location and Bystander: there the draft list, the draft panel, the
   `saveSubResourceDrafts` equivalent and the combined failure flag are all first-of-kind. Not hard, but it
   is four new things on two pages rather than one line on four.

A fourth item is a straight gain rather than a correction: §6.1 names the Powers panel as the closest
existing thing. It is closer than that. `UpsertCustomMoveRequest` (`ApiContracts.cs:167`) and
`UpsertMonsterPowerRequest` (`:166`) are **the same record with a different name**, and
`CustomMoveResponse` (`:21`) is `MonsterPowerResponse`'s shape. Every layout, validation and copy decision
a Power already made is transferable without adaptation.

---

## 13.2 The one treatment: a full-width card, on all five pages

**Recommendation.** One shared component, `app-custom-moves-card`, rendering

```
<article class="bg-surface border border-default rounded-lg p-3">
```

— the shell used by the eight sibling panels **and** by `app-resource-images-card`
(`resource-images-card.component.html:1`) **and** by `mystery-detail.html`'s four linked-entity articles
(`:84`, `:104`, `:125`, `:145`). It is laid out **full width, outside any grid**, on all five detail pages
and both of the create pages that get a card.

### Why this one of §6.1's three referents

The Monster/Minion card treatment wins, but **not** because it is the richest — because it is the only one
of the three that is already proven to be page-independent. `app-resource-images-card` is that proof: it is
one component with an `@Input({required:true}) ownerType`, it wears exactly this shell, and it ships today on
`monster-detail.html:30`, `minion-detail.html:25`, `location-detail.html:21` and `bystander-detail.html:21`
— i.e. **this shell has already been carried onto the two pages §6.1 describes as having "a bare `<h3>` and
`<ul>`"**, and nobody has called it foreign there. §6.4's question *"how does it sit next to Monster/Minion's
four hand-written panels without looking foreign"* has a shipped answer: identically, because it is the same
article shell they use. And on Mystery, which §6.4 flags as having no sibling panels, it is the same shell as
the four articles already on that page.

The other two referents fail a test the brief sets: *one treatment on all five pages*.

- **The bare `<h3>` + `<ul>`** (`location-detail.html:55-64`, `bystander-detail.html:55-64`) cannot carry
  four verbs. It has no header row to hang an action on, no card boundary to scope a form to, and it is
  visually indistinguishable from the page's own section headings — which is survivable for a read-only
  name list and not for an authoring surface. It also loses the one thing the card shell buys for free: a
  border that tells you where "this collection" starts and stops, on pages (`monster-detail`) that have five
  collections stacked.
- **A fifth cell in the four-panel grid** is the obvious move and it is wrong twice. `monster-detail.html:115`
  and `minion-detail.html:58` are `grid gap-4 grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1`. At
  `grid-cols-4` a fifth card is an orphan on its own row at two of three breakpoints — an alignment artifact
  that reads as a mistake. Going to `grid-cols-5` puts a **rules paragraph and its textarea into a ~230px
  column** at 1280px; the wizard has already demonstrated the failure mode at `w-[42%]`, where the
  sub-resource add-forms wrap. And decisively: **Location, Bystander and Mystery have no four-panel grid at
  all**, so a design whose shape is "grid cell" has no referent on three of the five pages. A card that is a
  grid child on two pages and a block on three is not one treatment; it is two treatments sharing a
  stylesheet.

Full width also earns its keep rather than just avoiding problems: it is the only width at which a name, a
multi-line description, and an action cluster fit on one row without the description wrapping under the
controls.

### Placement, per page, from one rule

The rule: **a custom move is an owned sub-resource, so the card sits with the page's other owned
sub-resources.**

| Page | Position | Grounding |
|---|---|---|
| `monster-detail` | Immediately **after** the four-panel grid (`:292`), last on the page | The grid *is* the owned sub-resources; the card joins the end of that run |
| `minion-detail` | Same, after `:58`'s grid | — |
| `location-detail` | **Exactly where the bare block is now** (`:55`), below `<app-location-form>` | That template's own comment at `:11-16` already states the decision: *"Custom Moves stays below the form as an owned sub-resource"* |
| `bystander-detail` | Same (`:55`), per the twin comment at `:11-16` | — |
| `mystery-detail` | After **Countdown** (`:81`), **above** the four linked-entity articles (`:83`) | Mystery has no owned sub-resources to sit beside, so the fallback is the principle `monster-detail.html:19-25` states for Images: *"this card is about the same record the title names, while every Minions row is an entity-link to a different record"* |

Note honestly that this makes the card **last** on monster/minion and **mid-page** on mystery. That is not
drift: `monster-detail` already puts its owned sub-resources below the Minions roster, so the two pages
disagree about roster-versus-sub-resource order *before* this work. I am matching each page's existing
answer rather than imposing one, and §14 R7 logs the consequence.

Replace, don't add beside: 5c/5d delete `location-detail.html:55-64` and `bystander-detail.html:55-64`
outright, as §5 already says.

---

## 13.3 The control surface

### Rows

```
<li class="flex items-start justify-between gap-3 border-b border-default py-[0.45rem] last:border-b-0">
```

— the exact row shell from `monster-detail.html:120` / `:171`. Inside: a `min-w-0` text block with
`<strong>{{ name }}</strong>` and the description below it; a `shrink-0` action cluster of **pencil then
trash**, both `.action-btn` (global, `styles.css:286-299`), `app-icon name="pencil"` / `"trash"`, `h-5 w-5`,
`[attr.aria-label]="'Edit ' + move.name"` and `'Remove ' + move.name`.

The `aria-label` carrying the move's name is not optional and is not a nicety: the shipped wizard roster
only has `title="Edit minion"`, which I logged on 2026-09-19 as unusable in a list of five identical
labels, and the fix landed there (`mystery-create-monster-phase.html:43`). Do not regress it here.

**Rows are tracked by a stable `key`, never `$index`** — a divergence from the four sibling create-page
panels (`monster-create.html:44`, `:97`, `:135`, `:191`), and it is required rather than preferred. The card
has a focus-restoring control (§13.3 "Edit"), and under index tracking Angular recycles the node, so the
restore target is still `isConnected` while belonging to a *different* row: focus lands on the wrong move
with no error anywhere. That is the §14.2(c) defect from the entity-linking work, one surface over. For
persisted rows the key is the move id; for staged rows it is a client key from the same
`createDraftKey()`-style generator the wizard drafts use (`mystery-create.store.ts:185`).

### Add

An always-visible form below the list, in the sibling add-form shell
(`grid gap-[0.6rem] mt-4 pt-3 border-t border-default`, `monster-detail.html:190`): required Name
(`maxlength="255"`, `<span class="text-danger">*</span>`, matching the contract's `MaxLength(255)`),
Description textarea, and one `bg-accent` submit reading **Add Custom Move**.

Two width calls, because full width changes the form's problem:

- Constrain the form to `max-w-[42rem]`. A single-line name input stretched to a 1400px line is the kind of
  thing that reads as a layout bug, and the field holds one short string.
- `rows="4"`, not the siblings' `rows="9"`. At full width a 4-row textarea holds more text than a 9-row one
  does in a quarter-width column; 9 rows at full width is a wall. Exact number is Luigi's to tune.

Do **not** copy `app-resource-images-card`'s empty state (`resource-images-card.component.html:20-42`): its
centred icon and *second* add button exist because its action lives in a modal and the empty state is
replacing a whole carousel. Here the add-form is permanently visible two inches below, so a second button
is a duplicate control. Keep the card's own domain icon out of it too — `app-domain-icon` handles Mystery
correctly (`domain-icon.component.ts:22-33`, `mystery → icon-nav-mysteries`), so it is *available*; it is
just not earning anything in a one-line empty state.

Empty-state copy via an `[emptyText]` input: default **"No custom moves yet."** (detail pages, matching
*"No images yet."*), and the create pages pass **"No custom moves added yet."** to match their four
neighbours' *"No attacks added yet."*. One input, both local consistencies satisfied, and the parity spec
pins which page passes which.

### Edit — the one genuinely new affordance

The pencil loads the row into the **same form**, which switches to an edit state: a heading that reads
`Editing "{{ name }}"`, the submit reading **Save Changes**, and a **Cancel** beside it. The edited row gets
`bg-accent-subtle border-accent` and an `EDITING` micro-label where its pencil was. One row editable at a
time.

That is not invented — it is `mystery-create-monster-phase.html:99-109` and `:256-263` verbatim, at a
different density. Which also means the shipped focus contract comes with it, and must:

- On pencil activation → move focus to the form's heading (`tabindex="-1"`, `focus({preventScroll:true})`
  inside `afterNextRender({write})`), exactly `mystery-create-monster-phase.ts:229-234`.
- On Save Changes or Cancel → restore focus to that row's pencil, which is why §13.3 insists on stable keys.

**Why edit at all, given no sibling has it.** Three reasons, in order of weight. (1) The data forces the
question: `PUT` exists and §6.2 requires reaching all four verbs, so the only alternative is delete-and-retype
— and a custom move is the one sub-resource whose body is a *paragraph of rules text*, which is exactly the
content you most want to fix rather than re-enter. (2) The recovery path depends on it: §6.3 sends a
partially-failed create to this card, and a card that can only add and delete cannot repair a move that
saved with a truncated description. (3) The pattern is already shipped one layer up in this same app, so it
costs no new vocabulary.

### Remove

Detail pages: `(removeRequested)` → the host's own `<app-confirm-delete-modal>` → `DELETE`. Pass **no**
`message`, so the component's `'This cannot be undone.'` default applies — on a detail page that sentence is
*true*, unlike in the wizard where `message=""` is deliberate
(`mystery-create-locations-phase.html:113-118`). Pass no `footnote`. `mystery-detail` has no modal today and
gains its first (§13.1 item 2).

Create pages and the wizard: remove is a local splice, no modal, nothing persisted.

**The glyph stays the trash `.action-btn--delete` in both modes**, not the create pages' `×`
(`monster-create.html:59-65`). One component must not change its glyph by mode, and the trash already means
"deferred removal" elsewhere in this app — the wizard roster uses `.action-btn--delete` for a removal that
does not reach the server until the next phase submit. The `×` idiom stays where it is and is not extended.

### `description` — rendered for the first time anywhere

`whitespace-pre-wrap`, inline, in full. No clamp, no disclosure.

```
<p class="text-muted text-[0.85rem] font-normal mt-[0.2rem] whitespace-pre-wrap">{{ move.description }}</p>
```

The base classes are the sibling description line (`monster-detail.html:131`, `:175`, `:211`, `:265`);
`whitespace-pre-wrap` is the addition, and the app already uses it for long user-entered prose
(`mystery-detail.html:31`, `:43`, `:55`).

- **No clamp.** A truncated body with no expander is a lie about the content, and adding an expander buys a
  control to hide two sentences. The eight sibling panels already render descriptions unclamped at a
  *quarter* of this width; at full width the case for clamping is weaker, not stronger. (The wizard's
  `line-clamp-2` on a roster card, `mystery-create-locations-phase.html:23`, is a different job: a summary
  row standing in for a record you open elsewhere.)
- **No disclosure.** This card is the authoring surface. Hiding what you wrote behind a click, on the screen
  where you write it, is the wrong default — and §6.5 rules out a count, so there is no summary figure that
  could stand in for the collapsed content.
- **`whitespace-pre-wrap` specifically**, because a custom move's body is mechanics with roll outcomes on
  their own lines (*"On a 10+…"* / *"On a 7–9…"*). Without it those collapse into one paragraph.

Which exposes a **pre-existing defect, flagged not swept**: the eight sibling description lines have no
`pre-wrap` either, so a power or weakness typed with newlines already renders collapsed today. §14 R8.

### Component contract

`app-custom-moves-card` is **presentational and has no `mode` input.** It takes `ownerType`, `rows`,
`editingKey`, `busy`, `emptyText`; it emits `(committed)` (`{ key: string | null, name, description }` —
`null` key means add), `(editRequested)`, `(editCancelled)`, `(removeRequested)`. It owns its two-state
form, its keys and its focus moves. It never calls a service.

**Immediate versus staged is therefore not a configuration — it is what the host does with the events**, and
that is exactly how `app-resource-images-card` is built (*"Presentational — it never touches a file"*,
`resource-images-card.component.ts:6-21`). A detail page turns `(committed)` into a `POST`/`PUT`; a create
page turns it into a `signal<T[]>` update. No branch inside the card, and nothing for the two modes to drift
apart on.

The one departure from the images card: this one owns a form. Justified — the images card's action is a
modal the host opens, whereas this is two fields that would otherwise be duplicated at nine call sites.

`busy` mirrors `[disabled]="isMutating()"` on the sibling panels and `[disabled]="imagesStore.isMutating()"`
on the images card.

**One free win from §2.9's "mirror `core/resource-images.ts`" instruction, worth making explicit so it is not
dropped:** that service sets `SUPPRESS_ERROR_TOAST` on every call via `inlineErrorContext()`
(`core/resource-images.ts:68-75`), because otherwise `httpErrorInterceptor:26-29` fires a raw
*"Request failed (500) for POST /api/monsters/{guid}/custom-moves"* toast at the user. `core/custom-moves.ts`
must do the same on all four methods. Without it, the hedged create-failure copy (§13.6) goes out alongside
a toast naming a GUID — the vague message and the ugly precise one, side by side. §14 R3 covers the four
existing sub-resource types, which have this defect today.

---

## 13.4 Create-time authoring on the four standalone pages

**The same card, `mode`-free, staged by the host.** Placement mirrors the detail page exactly: after the
four-panel grid on `monster-create.html:222` / its minion twin; as the page's only sub-resource card on
location/bystander create, below `<app-location-form>` / `<app-bystander-form>`.

That symmetry is the point, and it is the answer to the second half of §6.3's hand-off: **the create page
and the detail page are the same screen in the same place with the same controls**, so a user bounced from
one to the other by a partial failure arrives somewhere they have already learned.

Host wiring per page:

- `readonly customMoveDrafts = signal<CustomMoveDraft[]>([])` — `signal<T[]>`, not a `FormArray`, per the
  standing rule and the four existing composers.
- Monster/Minion: one more key in `saveSubResourceDrafts`'s `forkJoin`
  (`monster-create.ts:320-373`), `runBatch(drafts.map(d => customMoveService.create('Monster', id, …)))`.
  `runBatch`'s empty short-circuit (`:375-377`) means a create with no moves fires nothing.
- Location/Bystander: the draft list and the batch arm are **new structure**, not an addition to existing
  structure (§13.1 item 3). `location-create.ts:88-93`'s membership `runBatch` becomes a `forkJoin` of two
  arms, and `linksFailed` becomes one combined flag. The class comment at `:12-20` must be rewritten — it
  currently asserts the page has no sub-resources, which this makes false.

**One copy line that §6 does not mention and that will be missed.** `monster-create.html:32-35` reads
*"Attacks, powers, armors and weaknesses added below are saved together with the monster when you press
Create Monster."* That sentence is the only place the staged-write model is explained to the user, and it
goes stale the moment a fifth type appears below it. It must become **"Attacks, powers, armors, weaknesses
and custom moves added below are saved together with the monster when you press Create Monster."** — and
Location/Bystander create need the sentence introduced, in the same voice: **"Custom moves added below are
saved together with the location when you press Create Location."** Its minion twin needs the same edit.

---

## 13.5 The wizard

This is the section Skyler asked for, and the headline is that **the wizard is not the hard part §6.3 and
R11 take it to be — but the hard part is not where they put it either.** Both halves matter, so both are
argued.

### 13.5.1 What is already shipped, and why it changes the estimate

`sub-resource-diff.ts` is a **generic, owner-keyed sub-resource upsert engine**, already in the repo, already
tested, already used eight times. `SubResourceService<TDraft, TRequest, TResponse>` (`:23-48`) takes
`create(ownerId, request)`, `update(ownerId, id, request)`, `delete(ownerId, id)`, a `toRequest` and an
`isDirty`; `applySubResourceDiff` (`:65-104`) implements the four buckets — create, update-if-dirty,
**no-request-if-clean**, delete-what-no-draft-claims — and returns the new baseline in draft order.

`CustomMoveResponse`/`UpsertCustomMoveRequest` drop into it with **no adaptation at all**, because
`monsterPowerService` (`mystery-create.store.ts:3008-3016`) is already the adapter for a record of exactly
this shape:

```
toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
isDirty:   (draft, baseline) => draft.name.trim() !== baseline.name
                              || !sameNullableText(draft.description, baseline.description),
```

And because §2.9's client service is parameterised by owner type, this is the **first adapter in the codebase
that needs no per-owner twin**: one `customMoveService(ownerType)` factory replaces what would otherwise be
five copies of the six lines above. The unified endpoint makes the wizard *cheaper*, not just the controller.

So the sequencing §6.3 describes as the hard case — *"a brand-new composed entity's moves need the same
id-then-write sequencing as a re-edited one"* — is **already how the wizard writes every one of its eight
existing sub-resource collections.** `saveMonsterDraft` (`:2360-2388`) resolves the entity id first
(`create` when `draft.id === null`, `update` + `linkToMystery` otherwise) and only then `switchMap`s into
`saveThreatCollections`, which is pure `applySubResourceDiff`. A draft with no id creates; a draft with an id
and unchanged values sends nothing. The new-versus-re-edited distinction is not a branch anyone has to
write — it is `applySubResourceDiff`'s first `if`.

**One correction to §6.3's apparatus list.** It names `pendingRemovals` among the machinery custom moves
inherit. They do not touch it. `pendingRemovals` (`:567`, `PendingRemoval` at `:148`) is for roster
*entities*, where removal has a disposition (Detach vs Delete) and must survive an abandoned wizard. A
sub-resource row removed in a composer is already deferred by construction: the `×` splices the draft array,
and the server `DELETE` happens at the next phase transition through the diff's delete bucket. Nothing is
added to that union, and nothing new has to drain. This is the difference between touching a cross-cutting
type and not, so it is worth being exact about.

### 13.5.2 The mystery's own moves — step `0-4`

**Recommendation: a fifth step in phase 0, after Countdown.** Title *"What Moves Does This Mystery Have?"*;
blurb in the established `stepBlurb` voice, orienting rather than instructing, and giving zero a reason the
way `1-0` does (*"Most mysteries don't need any — add one when the mystery itself can act."*).

Mechanics, and this is the part that makes it cheap: `submitPhase0` (`:2250-2294`) **is already an
entity-then-id-dependent-sub-resource pipeline.** It saves the mystery, takes `mystery.id` in a `switchMap`,
and upserts the countdown against it — the countdown is a sub-resource written in a second call after the
mystery exists, which is the exact shape custom moves need. So the mystery's moves are one more entry
beside `upsertCountdown`, with `applySubResourceDiff(mysteryId, drafts, baseline, customMoveService('Mystery'))`,
and the baseline hydrates in edit mode from `MysteryDetailResponse.customMoves`, which decision 2 already
guarantees is on the response.

Why a step rather than a phase or a graft onto an existing step:

- Phase 0's four steps are the mystery's own fields; moves are the mystery's own sub-resource, so it belongs
  to that phase. A new phase would imply a new *kind* of thing and would renumber the tracker.
- The cost is data, not structure: `phases[0].steps`/`stepsArray` (`:388-393`), one `stepTitle` entry
  (`:942-951`), one `stepBlurb` entry, one `phaseStepComplete[0]` row (`:753-760`). The tracker renders
  per-step dots from that array already.
- `phaseStepComplete[0][4]` is `customMoveDrafts().length > 0` — **"has content"**, uniformly with all eight
  existing dots, per the J3 ruling. Not "visited", not "satisfied".
- Keep it **last** in the phase, after Countdown, so the three prose steps stay adjacent.

The surface is the wizard composer idiom (§13.5.3), not the detail card: it lives in the `w-[42%]` form
column.

**And the dossier.** `mystery-create-dossier.html:6-29` is the Mystery block; it must grow a Custom Moves
entry in the same `uppercase` label + `<ul class="text-primary text-sm leading-[1.6] mt-1 mb-0 pl-5">`
idiom the Powers block uses at `:117-129` (which already renders a description sub-line — copy it). The
dossier is the wizard's running account of what you have authored; a collection missing from it reads as a
collection that did not save. §11's file list does not mention the dossier and should.

### 13.5.3 Moves on entities composed inside the wizard

**The composers get a hand-written fifth panel, not the shared card.** Monster composer: a fifth
`<div class="border border-default rounded-lg mb-4 p-3">` after Armor (`mystery-create-monster-phase.html:221-254`),
`<h4 class="text-primary text-sm font-bold m-0 mb-3">Custom Moves</h4>`, rows with a `×` remove, and a
`flex flex-wrap items-center gap-2` form of a name input + a `rows="2"` textarea + an outline-accent
`+ Add`. Minion composer: identical, but `bg-surface-sunken rounded-lg mb-4 p-3` — **match the local
neighbour, not the other composer.** (The two composers genuinely differ in panel shell today; normalising
them is a separate cleanup and not this work's business.)

Why not the shared card here: the wizard column is `w-[42%]` and already scrolls, which is the binding
constraint on every layout call in it. Forcing the detail-page card into that column means either breaking it
or giving it a `density` input nobody can review. And the precedent is unambiguous — attacks, powers, armors
and weaknesses exist on the detail pages, the create pages **and** the wizard composers, and are hand-written
in all three. The rule to carry forward: **share across pages of the same density; copy across densities.**

**Add and remove only in the wizard panels — no row edit.** Its four neighbours have none, there is no room
for a second control cluster at that density, and adding it to one of five collections in the riskiest phase
is how 5e grows. The diff handles an edited-by-remove-and-re-add row correctly (delete + create). Accepted
inconsistency with the standalone create page, which does get edit because there the card is shared with the
detail pages where `PUT` requires it. Logged as a follow-up covering all five wizard collections at once
(§14 F-R1), not as a custom-move problem.

**Monster and minion are nearly free.** Per owner: one `customMoves: CustomMoveDraft[]` and one
`existingCustomMoves: CustomMoveResponse[]` on `MonsterDraft` (`:197-243`) / `MinionDraft` (`:244-302`); one
line in `toHydratedMonster`/`toMinionDraft` (`hydrate-monster.ts:54-61`, `:86-93`) reusing `toNamedDraft`
(`:108-117`) unchanged, because a custom move *is* a named draft; one entry in `saveThreatCollections`
(`:3082-3094`) and `saveMinionCollections` (`:3057-3072`); one `rekeyDrafts` line in
`writeBackMonsterDrafts` (`:2404-2412`) and its minion twin; one dossier block each; one composer panel
each. **No new stage, no new sequencing, no new baseline discipline** — the baseline-and-draft-share-one-
lifecycle rule is satisfied for free, because `toNamedDraft` takes the id from the very response object that
becomes the baseline row (`hydrate-monster.ts:32-41`'s whole point).

**Locations and bystanders are where the real work is**, and §6 treats them as the easy domains everywhere
(5c/5d are described as replacing a read-only block). In the wizard they are the expensive ones:

1. **`submitPhase2`/`submitPhase3` are flat single-stage `forkJoin`s** (`:2424-2474`, `:2476-2528`). Created
   rows' ids only exist when `created` resolves, so a wizard-authored location's moves cannot be written
   inside that `forkJoin` — the phase needs the **second stage** phase 1 already has
   (`rosterAndMinions$`, `:2333-2343`).
2. **Neither phase has a per-row baseline.** They carry `existingLocationIds`/`existingBystanderIds` at store
   level and backfill ids by *position* (`backfillDraftIds`, `:2891-2894`). A per-row
   `existingCustomMoves` arrives there for the first time — and with it the H2 hazard the monster path
   already documents at `:2335-2337`: refresh the ids without the baselines and every later submit deletes
   and recreates the lot.
3. **Attaching an existing location stops being request-free.** `attachLocation` (`:1547-1566`) builds a
   complete draft from the catalogue list item with **zero HTTP calls**, which works because
   `LocationListItemResponse` (`ApiContracts.cs:236-245`) carries everything `LocationDraft` needs.
   `CustomMoves` is on `LocationDetailResponse` (`:247-255`) and **not** on the list item — and §6.5
   explicitly rules out widening list projections. So attach becomes a `getById` fetch, exactly like the
   monster attach already is (`attachMonster`, `:1074`, `hydrateMonsterDraft`, `:1120`). Which means the
   **location and bystander attach strips must grow the monster strip's busy and error treatment** —
   `mystery-create-monster-phase.html:66-97` has a spinner branch, a disabled control showing the picked
   name and a local error line; `mystery-create-locations-phase.html:55-69` has none of that. And `Next`
   must be disabled during an in-flight attach, as it already is for monsters
   (`mystery-create.html:33`, `monsterAttachInFlight`).

   Two alternatives considered and rejected. *Add `customMoves` to the list projection* — contradicts §6.5,
   and ships N locations × their moves on every list fetch to serve one wizard interaction. *Show the panel
   only for wizard-authored locations* — produces two classes of roster row, which is precisely what the
   roster invariant refuses; a row that cannot be fully edited forces a what-if-incomplete branch into every
   consumer of that row.
4. **Their composers are flat forms.** `mystery-create-locations-phase.html:71-108` is one `<form>` with the
   Save/Cancel buttons *inside* it. A nested panel is first-of-kind there; follow the monster composer's
   arrangement (panels between `</form>` and the button row) rather than nesting a panel inside a form.

**Recommended sequencing for 5e, as a consequence.** Split it:

- **5e-0 — Phases 2 and 3 get phase 1's shape.** A pure restructure: second stage, per-row baseline,
  id-and-baseline written back together. With no custom moves wired yet the new diff runs over empty
  collections, `runBatch` short-circuits, and **no request changes** — so the existing exact-call-ledger
  specs (`mystery-create-phase5a-ledger.spec.ts`, `mystery-create-phase4-ledger.spec.ts`) are the gate, and
  they pass unchanged or the restructure is wrong. One reviewable commit with no behaviour to argue about.
- **5e-1 — The mystery's own moves.** Step `0-4`, `submitPhase0`, dossier block.
- **5e-2 — Monster and minion composer panels.** The additive list above.
- **5e-3 — Location and bystander composer panels, plus the two attach strips.** Last, because it is the
  only part that changes an interaction users already have.

### 13.5.4 Why I would not cut location/bystander moves from the wizard

The cheap scope cut is available and I am rejecting it. If the wizard's location composer cannot author
moves but `/locations/create` can, then a Keeper who builds a location *inside* the mystery silently loses
an affordance they have outside it — and the wizard is the primary authoring path for exactly those two
domains. Two surfaces for one entity with different capabilities is the asymmetry that generates "why
doesn't it work here?" questions forever. 5e-3 is real work; it is not avoidable work.

---

## 13.6 The partial-failure experience, end to end

### 13.6.1 The copy — and the string count is wrong before we start

§6.3 and §2.12 item 3 both describe the hedged copy as *one* string whose scope widens. **It is two
strings, and only one of them says "details":**

| Surface | Shipped string | Source |
|---|---|---|
| Monster create | *"Monster created, but some details may not have saved. Review them on the monster page."* | `monster-create.ts:290` |
| Minion create | *"Minion created, but some details…"* | `minion-create.ts:335` |
| **Location create** | *"Location created, but **some of its mysteries** may not have saved. Review them on the location page."* | `location-create.ts:106` |
| **Bystander create** | *"Bystander created, but **some of its mysteries**…"* | `bystander-create.ts:106` |
| All four details | *"{X} saved, but some of its mysteries may not have saved. Review them below and save again."* | `monster-detail.ts:234`, `minion`/`location-detail.ts:185`, `bystander-detail.ts:186` |

**Ruling 1 — the four create pages converge on the existing "some details" string, unchanged in wording.**

> **"{Entity} created, but some details may not have saved. Review them on the {entity} page."**

Not a style preference. *"Some of its mysteries"* becomes **false by omission** the instant a custom-move
`POST` can fail in the same batch — and under §2.10 it provably can, because custom moves join the same
`forkJoin` and `linksFailed` becomes one combined flag (§13.4). A user whose custom move failed and whose
memberships landed would be told to go and check their mysteries. That is a correctness fix forced by this
plan, not a tidy-up.

I am **not** rewording the surviving string, and the reason is the standing one: the hedge exists because
`forkJoin` reports that *one* call failed, never that all did, so any copy naming what failed is false the
moment two of three land. That information gap is unchanged by this work, so the hedge is unchanged. And
*"details"* is deliberately a **category** word rather than an enumeration — *"some of its mysteries,
attacks, powers, armors, weaknesses or custom moves"* grows with every sub-resource and goes stale silently.
"Details" was already right for four types; it is right for six.

Ships with: `location-create.spec.ts:327` and `bystander-create.spec.ts:327` assert the old strings verbatim
and change in the same commit. Copy does not land as a text-only edit.

**Ruling 2 — the four detail-page strings do not change.** The detail page's Save batches *memberships only*;
custom moves on a detail page are written by the card's own immediate per-row calls, which report their own
failures. Widening that copy would make the Save button's caveat claim something it did not do. This is the
boundary a "sweep the copy for custom moves" instinct gets wrong, so it is stated explicitly.

**Ruling 3 — still no warning severity.** `NotificationKind` is `'success' | 'error'` only
(`core/notifications.ts:3`). The caveat continues to spend `.error()`, as `monster-create` already does. Do
not add a third kind for this.

### 13.6.2 The recovery path

1. **The card is correct on arrival, with no extra request and no spinner.** `customMoves` is embedded in
   the detail response (decision 2), so the first paint of the card *is* server truth. That is the whole
   recovery mechanism, and it is the same ruling as the membership case: **"which ones failed?" is answered
   by re-rendering the control, not by a sentence.** Here it is cheaper than it was there — no refetch is
   even needed, because the user arrives by navigation.
2. **Nothing is carried over from the create page.** No draft hand-off through router state, no "re-add the
   3 that failed" banner, no diff. Rejected deliberately: it would put the user in front of two lists to
   reconcile, and the card's own add-form is already the retry control, sitting exactly where the toast
   said to look. The create→detail transition is the *same card in the same position*, which is what makes
   "review them on the monster page" an instruction rather than a riddle.
3. **Navigation stays on the flat route on the caveat branch** (`monster-create.ts:296`,
   `location-create.ts:114-116`), unchanged and for its existing reason.
4. **The toast survives the navigation.** `NotificationService` is root-provided, rendered by `app.html`, and
   dismissed on a 4000ms timer (`core/notifications.ts:16-17`) — not route-scoped. Already proven by the
   shipped monster-create path; noted because it is the kind of thing that looks fragile and is not.
5. **`SUPPRESS_ERROR_TOAST` on every custom-move call** (§13.3). Without it the hedged caveat arrives
   alongside *"Request failed (500) for POST /api/monsters/{guid}/custom-moves"* — the carefully vague
   message and the brutally precise one, in the same toast stack, 4 seconds apart.

### 13.6.3 The one thing I cannot fix cheaply, named

*"Review them on the monster page"* points at a card that is, on monster-detail, below the images card, the
Minions roster, the edit form and a four-panel grid. The user lands at the top of the route. This is
**pre-existing** — it has been true of attacks, powers, armors and weaknesses since those pages shipped —
and custom moves make it one type worse, not new. I am not inventing a scroll target for it: a fragment on
the card would not work today anyway, because `ROUTER_CONFIG` (`app.config.ts:19`) sets only
`canceledNavigationResolution` and there is no `withInMemoryScrolling`, so `anchorScrolling` is off. Logged
as §14 R6 with the fix named, so that if it is ever worth doing, nobody has to rediscover the router gap
first.

---

## 13.7 What this means for Phase 4, 5 and 6

Fits inside §5's phasing; no re-ordering proposed.

- **Phase 4** builds `core/custom-moves.ts` *and* `shared/custom-moves-card.component.{ts,html}` plus its
  spec. The card is presentational and has no service dependency, so it is testable before any page uses it
  and belongs in the plumbing phase rather than inside 5a.
- **5a–5d** each wire one domain's detail page and create page to the card. 5c/5d delete the two bare
  blocks. Location/bystander create build their first draft list and batch arm (§13.1 item 3).
- **5e** splits into 5e-0…5e-3 (§13.5.3).
- **Phase 6**'s parity spec gets cheaper than §5 assumes for the nine card call sites — one component, so
  the spec asserts `ownerType`, `emptyText` and event wiring per page rather than nine independent markup
  trees. It does **not** get cheaper for the wizard: those panels are hand-written per composer and need
  their own assertions, which the wizard's existing ledger specs are the right home for.
- **Phase 6** also owns the copy convergence of §13.6.1 if it has not already landed with 5c/5d. It should
  land with 5c/5d, since those are the pages whose string is wrong.

---

## 13.8 Where I disagree with §§2 and 6

Stated here rather than edited above, per the brief. One item is a disagreement; the rest are corrections of
fact already folded into §13.1, §13.5.1 and §13.6.1.

**§2.12 item 2 and R11 have the cost backwards for the wizard.** They say the sub-resource convention
*"makes the mystery wizard harder than inlining would have"*. For the wizard specifically I think the
opposite is true, and the evidence is that **the wizard has no one-shot path to begin with.** Every entity in
it is saved by create-or-update followed by a per-collection `applySubResourceDiff`, at a phase transition,
against a hydrated per-row baseline. Inlining `customMoves` into `UpsertMonsterRequest` would have given the
wizard a *second* write path for one of five sibling collections — and on an edit-mode re-save that body
would carry whole-collection semantics, deleting and recreating every custom move on every phase transition.
That is exactly the churn 5a existed to remove and exactly what `sub-resource-diff.ts:16-20` documents as
what it replaced. So two-step is not a cost the wizard pays; it is the only shape the wizard can use, and
§2.10's decision is *better* for 5e than the alternative, not worse.

**What the real wizard cost is, so the risk register points at the right thing.** Not sequencing, and not
monsters or minions. It is (a) phases 2 and 3 being single-stage with no per-row baseline, and (b) the
location/bystander attach becoming a fetch because the list DTOs do not carry `customMoves`. Both are costs
of *those phases never having had a sub-resource before*, not of the two-step decision — they would exist
identically under inlining, since a wizard-attached location's moves have to come from somewhere either way.
R11 should be re-pointed at 5e-0 and 5e-3.

**Two smaller factual corrections**, both already argued above: `pendingRemovals` is not in custom moves'
blast radius (§13.5.1), and the hedged create copy is two strings rather than one (§13.6.1).

Nothing here asks to reopen a decision in §8.1.

---

# 14. UI risks (Rosalina)

Numbered R1– to sit beside §7's R1–R11 without colliding; prefix is the section.

| # | Risk | Mitigation |
|---|---|---|
| 14-R1 | **The create-page copy is not uniform today**, and §6.3 assumes it is. A per-page edit that only touches custom moves leaves Location/Bystander saying *"some of its mysteries"* while a custom-move failure routes through the same flag — copy that is false by omission on an irreversible-feeling surface. | §13.6.1 Ruling 1. Converge all four create pages on the shipped *"some details"* string, with the two specs in the same commit. Phase 6's parity spec asserts the string, not just the call shape. |
| 14-R2 | **A `grid-cols-5` fifth panel** is the obvious implementation and puts a rules paragraph in a ~230px column, with an orphan card row at two breakpoints. | §13.2. Full width, outside the grid, on all five pages. The parity spec should assert the card is **not** a child of the four-panel grid. |
| 14-R3 | **The generic interceptor toast undercuts the hedged copy.** `httpErrorInterceptor:26-29` names the failing URL and GUID. | `core/custom-moves.ts` sets `SUPPRESS_ERROR_TOAST` on all four methods, mirroring `core/resource-images.ts:68-75` as §2.9 already instructs. The four existing create-batch sub-resource types have this defect today and are **not** swept here — logged as F-R2. |
| 14-R4 | **`track $index` copied from the sibling create panels** into a card that restores focus to a row control. Angular recycles the node, the restore target is `isConnected` but belongs to a different move, and focus lands on the wrong row **with no error**. | §13.3: stable keys in both modes — move id when persisted, client key when staged. |
| 14-R5 | **Wizard attach for locations/bystanders silently stops being request-free**, and the two attach strips have no busy or error state to show for it. A `Next` pressed mid-attach drops the attach. | §13.5.3 item 3. Port `mystery-create-monster-phase.html:66-97`'s spinner/disabled/error treatment to both strips and add them to `mystery-create.html:33`'s `[disabled]`. 5e-3. |
| 14-R6 | ***"Review them on the {entity} page"* points below the fold** on monster/minion detail. | Pre-existing, one type worse. Not fixed. If ever worth fixing, the fix is a fragment on the card **and** `withInMemoryScrolling({ anchorScrolling: 'enabled' })`, which `app.config.ts:19` does not configure today. |
| 14-R7 | **The card is last on monster/minion and mid-page on mystery**, which looks like drift. | It is each page's own existing answer to roster-versus-sub-resource order, which already disagree (§13.2). Stated in the doc so a reviewer does not "fix" one of them into inconsistency with its own page. |
| 14-R8 | **Description newlines collapse** in the eight sibling panels today (no `whitespace-pre-wrap`). Custom moves is the type most likely to carry multi-line rules text. | The card gets `pre-wrap` (§13.3). The eight siblings are **flagged, not swept** — F-R3. |
| 14-R9 | **`mystery-detail` becomes editable for the first time** and needs a mutation state, an inline error surface and its first confirm modal — none of which exist on that page. | §13.1 item 2, §15 Q1. Budget it into 5e rather than discovering it there. |
| 14-R10 | **The dossier silently under-reports.** A custom-moves collection absent from `mystery-create-dossier.html` reads to the user as a collection that did not save. | §13.5.2. Three blocks: the Mystery section, and the monster and minion composer previews. §11's file list should name the dossier. |

**Follow-ups (UI), out of scope for Phases 4–6:**

| # | Follow-up | Trigger |
|---|---|---|
| F-R1 | **Row edit for all five wizard composer collections.** Custom moves does not get it in the wizard precisely so it is not the odd one out; if anyone wants it, it should arrive for attacks, powers, armors, weaknesses and moves together. | On request. Pairs naturally with F2. |
| F-R2 | **`SUPPRESS_ERROR_TOAST` across the whole post-create draft batch**, so a failed attack `POST` stops showing a GUID-bearing URL next to a hedged caveat. Changes shipped behaviour on four existing types, so it is a decision, not a drive-by. | With F2 (§12), which revisits that batch as a unit. |
| F-R3 | **`whitespace-pre-wrap` on the eight sibling description lines.** Same defect, eight call sites, zero relation to this feature. | Any sweep of the detail pages. |

---

# 15. Open questions (Rosalina's)

Two. Neither blocks Phase 4 or 5a–5d; **Q1 blocks 5e-1's detail-page half**, not the wizard half.

**Q1 — Should `mystery-detail` become editable, or should mystery custom moves be wizard-only and read-only
there?** Decision 5 says *"consistent with the other domains"*, and on the other four the card is editable —
so read-only would be a second class of the same card, which is the thing I keep refusing. But
`mystery-detail` is today a purely read-only page whose single control sends you to the wizard, and making
it the one page with an in-place write surface is a product call, not a design detail (§14-R9 is its cost).

**My recommendation: make it editable**, for a reason that is about play rather than consistency — the
wizard is the *authoring* surface and the detail page is the *table* surface, and a custom move is precisely
the thing a Keeper improvises mid-session. Re-entering a four-phase wizard to add one move during a game is
the wrong shape. Countdown is the honest counter-example (displayed there, edited only in the wizard), which
is why this is a question rather than an assertion.

**Q2 — Is the wording of the converged create string acceptable as-is?** §13.6.1 keeps
*"{Entity} created, but some details may not have saved. Review them on the {entity} page."* verbatim and
only widens where it is used. The conservative choice is deliberate — the hedge is accuracy, not softness,
and the string is already shipped on two pages and asserted in two specs. Flagged only because §6.3 invited
a rewording and I am declining it; if Skyler wants a different voice, this is the moment, since four pages
and four specs change either way.

---
---

# 16. The backend implementation pass

**Prepared by:** Bowser (Backend / DevOps)
**Date:** 2026-10-10, amended in place 2026-10-11 with Skyler's three answers (§16.4), and again
2026-10-11 with what Phase 1 actually did
**Status:** Implementation specifics and gap-finding for Phases 1–3. **Appended to §§0–15, which are
unchanged.** Where I think something above is wrong I say so here (§16.3) rather than editing it. Work is
on branch **`custom-moves`**.

> **Phases 1, 2 and 3 are all landed. The backend rework is complete.** Six commits, in order:
>
> | | Commit | What |
> |---|---|---|
> | **1·1** | `619be92` | The 67-site factory extraction and the `PostgresCollection` rename — zero production files, the no-op half of §16.4 D1. |
> | **1·2** | `64e9826` | The entity, the enum, the context config, `20261011180029_AddCustomMoves`, `ICustomMoveService`/`CustomMoveService`, the DI and three harness registrations, `FakeCustomMoveService`, the tests — called by nothing. |
> | **2·1** | `d87974b` | The five owner-delete cleanups and Mystery's new transaction, with the per-domain cleanup tests and B11's four changes to `MonsterMinionCascadeTests`. Behaviour-neutral while `custom_moves` is empty. |
> | **2·2** | `52cc63b` | `CustomMovesController`, the seven projections re-pointed, the five `.Include`s and the sixteen old controller actions deleted. The atomic switchover. |
> | **3·1** | `84facbc` | The teardown: 5 entities, 5 nav collections, 5 `DbSet`s, 5 config blocks, 16+16 repository members, 16+16 service members, 5 of 6 mapper overloads, the four fake-repository member sets. Pure deletion. |
> | **3·2** | `81f5960` | `20261011214028_DropPerDomainCustomMoves`, **alone in its own commit** because R4 asks for the irreversible step to review on its own. |
>
> Backend **677 passed / 0 failed / 7 skipped / 684 total**, from a 615/0/4/619 baseline; frontend
> untouched at 1,497 / 108 files throughout all three phases. **The real-Postgres gate was run at every
> phase, not skipped** (B5), and Phase 2 was additionally exercised against the real `Program.cs` host.
>
> **The one thing to know before merging Phase 3:** `MigrateAsync()` runs at startup, so **merging
> `81f5960` and letting the host restart *is* the migration** (B6, B-R7). Skyler ruled the rows expendable
> twice, so that is intended — but see B6 for what it costs in the dev database specifically, which is one
> real authored row rather than nothing.
>
> **Where the work diverged from this plan**, all corrected in place rather than listed as a changelog:
> B1 (two factories in one file; the CS9113 suppression nothing here had anticipated, now §16.4 D4; the
> fake's return semantics, where B1 and §23 item 5 contradicted each other), B4 (measured, not
> estimated), §16.1 and §21.1 (measured), §16.3 B7 (its own six omissions were the complete set — §9's
> counts were all correct), and **§16.2, whose 404-body row was simply wrong** — see the correction there,
> which is the one thing in this document that a running server disagreed with.

**Grounding — read this session, not inherited from §§0–15.** Globbed the whole `src/` tree first
(173 `.cs` files, every directory) rather than trusting the inventory above. Read in full:
`Data/Entities/DomainEntities.cs`, `Data/MotwDbContext.cs`, `Data/MotwDbInitializer.cs`,
`Contracts/{ApiContracts,ApiMappers}.cs`, all five `*Service.cs` + `I*Service.cs`, all five `*Repository.cs`
+ interfaces, `Services/ResourceImages/*`, `Services/ServiceResults.cs`, `Program.cs`, both `.csproj`,
`20261005034116_AddResourceImages.cs`, the custom-move blocks of `20260719163240_InitialCreate.cs` and
`20260726000551_ExtractMinionsToOwnTable.cs`, all four `*ApiHarness.cs`, `MonsterMinionCascadeTests.cs`,
`MonsterImageCleanupTests.cs`, `MysteryServiceTests.cs`, `NoOpDbContextTransaction.cs`,
`FakeResourceImageService.cs`, `ResourceImageMigrationPostgresTests.cs`, `PostgresFactAttribute.cs`,
`ResourceImagePostgresCollection.cs`, `ListProjectionPrimaryImageAgreementTests.cs`,
`docker-compose.yml`, `README.md` §Testing, `.squad/agents/Bowser/history.md`, and both inbox decision
records.

**Also exercised, not read:** the running dev API on `http://localhost:5225` (every routing claim in §17
and §16.2 is a real response from it), its generated `/swagger/v1/swagger.json`, the backend test suite,
and a throwaway ASP.NET 10 project in the session scratchpad that proves the route-constraint mechanics
(§17.1). Nothing in the repo was changed to run any of it; the dev server was left running and the working
tree is byte-identical to how I found it.

> **The pass, in five sentences.** The structure in §§2–3 is right and I am not re-opening any of §8.1's
> fourteen decisions. The route shape works and its mechanics are now proven rather than assumed — an
> **anchored** inline `regex` constraint hoisted to one `const string`, not a registered `IRouteConstraint`,
> because the three endpoint harnesses build their own hosts and would never see a `ConstraintMap` entry.
> The single largest piece of work in Phases 1–3 is invisible in §§9–11: adding `ICustomMoveService` to the
> five domain services reaches **67 direct constructor call sites across seven test files, plus three test
> harnesses** where a missing DI registration is a request-time 500 rather than a build error. Two of the
> doc's gate wordings cannot be met as written — Phase 3's "net-negative `git diff --stat`" is impossible
> because each migration carries a ~3,000-line generated `.Designer.cs`, and the real-Postgres gate is
> skip-by-default and needs a named xUnit collection to be safe. And one one-argument detail will silently
> regress a shipped behaviour if nobody writes it down: the segment→enum dictionary **must** be
> `OrdinalIgnoreCase`, because `/api/MONSTERS/{id}/CUSTOM-MOVES` returns `200` today and the route
> constraint hands the action the caller's original casing.

---

## 16.1 Environment facts, verified

Stated first because several of §§17–22's specifics depend on a version, and the doc above names none.

| | Verified value | Where |
|---|---|---|
| TFM | `net10.0`, both projects | `MonsterOfTheWeek.Api.csproj`, `MonsterOfTheWeek.Api.Tests.csproj` |
| SDK in use | 10.0.400 (10.0.202 also installed; **no `global.json`**, so the highest wins) | `dotnet --list-sdks` |
| EF Core | 10.0.0 — `Microsoft.EntityFrameworkCore.Design` (API, `PrivateAssets=all`), `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.0, `Microsoft.EntityFrameworkCore.Sqlite` 10.0.0 (tests) | both `.csproj` |
| Provider | Postgres 18 in production and dev; SQLite in-memory in tests | `docker-compose.yml`, `Program.cs:27` |
| Swagger | Swashbuckle 9.0.6, `AddSwaggerGen()` with **no filters**, **Development-only** | `Program.cs:26`, `:179-183` |
| Naming | **No naming convention configured.** Every column is an explicit `.HasColumnName("snake_case")`; index names are `idx_<table>_<cols>`; EF-default `IX_`/`FK_`/`PK_` names survive from `InitialCreate` | `MotwDbContext.cs` throughout |
| Migrations | **Applied automatically at app startup** — `MotwDbInitializer.InitializeAsync` calls `Database.MigrateAsync()` | `MotwDbInitializer.cs:14`, called at `Program.cs:200` |
| Migration count | 17 applied, latest `20261005034116_AddResourceImages` | `Data/Migrations/` |
| `AsSplitQuery` | Used by `PlaybookRepository`/`HunterRepository` only, and `PlaybookRepository.cs:23` records the deliberate contrast: *"AsSplitQuery, unlike the Monster equivalents"* | grepped |
| Suite size | 619 backend tests before Phase 1, **640 after** (README still says 568 — drifted; not this work's business) | runs below |

**Baseline, run this session.** `README.md:58-75` forbids `dotnet test --artifacts-path`, and I hit the
trap it documents for the third time in this project: the dev server was holding
`bin/MonsterOfTheWeek.Api.dll`, so an in-tree build is impossible while it runs, and out of tree the suite
reports **184 failures out of 619** from `PickRuleTable.ApiProjectRoot()`'s upward walk — exactly the
mechanism and roughly the count the README predicts. Filtered to the twelve classes this work touches, out
of tree: **196 passed, 0 failed, 4 skipped.** The 4 skipped are the Postgres-gated ones (B5). So the
relevant baseline is green, and the full-suite figure above is a count, not a baseline claim.

**Re-measured at Phase 1, with nothing holding `bin/`: the full in-tree suite is green —
615 passed / 0 failed / 4 skipped / 619 total.** So the 184-failure figure above is purely an artifact of
building out of tree and says nothing about the suite; the only thing it is evidence for is B-R14, and
B-R14 is about the dev server, not about the tests. Stated because "184 failures out of 619" reads like a
standing fact in a document and is not one. Phase 1 ends at **634 / 0 / 6 / 640** — the 2 extra skips are
`CustomMoveMigrationPostgresTests`, which is the gate working as designed.

**A practical consequence for Phases 1–3, since every phase has a build gate:** you cannot build the API
while a `dotnet run` of it holds the output. Stop the dev server first. Do **not** reach for
`--artifacts-path` to work around it; that is the trap, and the README now says so.

---

## 16.2 What I proved against the running application

Every row is a real response from `http://localhost:5225` this session, authenticated with the dev cookie.
This is the evidence base for §17 and for the 404-versus-400 question.

| Request | Status | Body |
|---|---|---|
| `GET /api/monsters/{realId}/custom-moves` | `200` | `[]` |
| `GET /api/MONSTERS/{realId}/custom-moves` | `200` | `[]` |
| `GET /api/Monsters/{realId}/CUSTOM-MOVES` | `200` | `[]` |
| `GET /api/monsters/{unknownGuid}/custom-moves` | `404` | ~~empty~~ — **162-byte ProblemDetails; item 2 below has the correction and the controls** |
| `GET /api/monsters/not-a-guid/custom-moves` | `404` | empty |
| `GET /api/nonsense/{realId}/custom-moves` | `404` | **empty** |
| `GET /api/hunters/{realId}/custom-moves` | `404` | empty |
| any of the above, unauthenticated | `401` | — |

Three things fall out of this table, all load-bearing below.

1. **Route matching is case-insensitive, including the literal `custom-moves` segment.** That is shipped
   behaviour, reachable today, and §2.9's unified controller must preserve it. See B2.
2. **A bad owner segment and a missing owner are both `404`** — and the table's claim that they are
   *byte-identical* is **wrong, corrected by measurement at Phase 2**. Re-probed against the real
   `Program.cs` host, with two untouched routes as controls:

   | Request | Status | Body | Content-Type |
   |---|---|---|---|
   | `GET /api/monsters/{unknownGuid}/custom-moves` | `404` | **162 bytes** | `application/problem+json` |
   | `GET /api/monsters/{unknownGuid}` — *control, untouched* | `404` | 162 bytes | `application/problem+json` |
   | `GET /api/mysteries/{unknownGuid}` — *control, untouched* | `404` | 162 bytes | `application/problem+json` |
   | `GET /api/xmonstersx/{realId}/custom-moves` | `404` | **0 bytes** | *none* |
   | `GET /api/totally-made-up-path` — *control, catch-all* | `404` | 0 bytes | *none* |

   A controller's `NotFound()` produces a ProblemDetails body, because `Program.cs:23` registers
   `AddProblemDetails()`; the catch-all's `Results.NotFound()` produces nothing. The controls prove this
   is pre-existing and shared with every other 404 in the API, so **the original row was a measurement
   error in the planning pass, not a regression this work introduced** — and the correct statement is
   that the two are *indistinguishable by status code* and distinguishable by body.

   **Every conclusion below survives intact**, which is why this is a correction and not a reversal:
   **404 is still correct, and still the only answer available without inventing a response shape nothing
   else in this API uses.** If anything the real behaviour is better than the recorded one — a client
   reading only the status cannot tell a typo from a stale id, and a developer reading the body can.
   Recorded at this length because "byte-identical" is the kind of specific claim a later reader would
   build on. Returning 400 for an unknown segment
   would require letting the request reach application code, which costs exactly the route-table isolation
   the constraint exists to buy, and it would make a client typo louder than a client sending a stale id —
   the wrong way round, since the stale id is the case a user can actually cause.
3. **The consequence to hand to Luigi, named not decided:** a typo in `core/custom-moves.ts`'s
   `OWNER_SEGMENT` map is indistinguishable from "that owner does not exist", and with
   `SUPPRESS_ERROR_TOAST` on all four methods (§2.9) it is also silent. §5's Phase 4 gate already requires
   the service spec to assert all five segments by string. Keep that requirement; it is the only guard.

Swagger, from the running app's own document: **84 paths total, of which 8 path templates / 16 operations
are custom-move**, tagged `Monsters` / `Minions` / `Locations` / `Bystanders`, every path parameter
`string`/`uuid`, every `operationId` empty. §22 says what that becomes.

---

## 16.3 Gaps, ranked by what would actually bite

Ordered by cost-if-missed, not by section number. Each is verified; the recommendation is marked as mine.

### B1 — The five domain services' constructors reach 67 call sites and three self-hosting harnesses, and §§9–11 budget none of it. *(The biggest item in Phases 1–3.)*

`ICustomMoveService` has to become a constructor dependency of all five domain services — four for the
delete cleanup and the detail projection, `MysteryService` for both plus its new transaction. Grepped
exhaustively for `new {Monster,Minion,Location,Bystander,Mystery}Service(`:

| File | Sites | Named in §9/§11? |
|---|---|---|
| `Services/MonsterServiceTests.cs` | 18 | §11 names the file, for "fake deletions" only |
| `Services/BystanderServiceTests.cs` | 16 | ″ |
| `Services/LocationServiceTests.cs` | 16 | ″ |
| `Services/MinionServiceTests.cs` | 7 | ″ |
| `Services/MysteryServiceTests.cs` | 5 | §11 names it, for the fake repository only |
| `Services/MonsterImageCleanupTests.cs` | 3 | **no** |
| `Services/ResourceImages/ByMysteryVariantsStayOutOfScopeTests.cs` (`:96`, `:130`) | 2 | **no** |
| **Total** | **67** | — |

And three test harnesses build their **own** `WebApplication` — each says so in its own XML doc
(*"it is not `Program.cs`"*) — so none of them sees a DI registration added to `Program.cs`:

- `MysteryLinkApiHarness.cs:112-119` — which is what `MonsterMinionCascadeTests` runs on
- `MinionReparentApiHarness.cs:102-104`
- `ResourceImageApiHarness.cs:80-84`

All three already register `IResourceImageService` for exactly this reason, and `Program.cs:38-41` states
the failure mode in as many words: *"Missing this registration doesn't fail the build; it fails the first
request to any of those controllers."* **A harness missing `ICustomMoveService` is a 500 on the first
`DELETE /api/monsters/{id}` — so §2.4's whole point, the extended cascade test, would fail for the wrong
reason and read as a cascade bug.**

**Land the mechanical half in Phase 1, not Phase 2 — and in its own commit. Decided (Skyler, §16.4 D1).**
Phase 1 is additive and has nothing else to do, and this is behaviour-preserving — the same discipline §5
applies to 5f-0: separate the restructure from the behaviour it enables, so each reviews against a
different question.

**The split, and the one ordering constraint that decides it.** `FakeCustomMoveService` cannot be in the
first commit, because it implements an interface the second commit introduces, and a DI registration cannot
precede the type it registers. So the first commit must contain **only what needs no new type** — which is
exactly the 67-site part, and it is a cleaner no-op for it:

**Phase 1, commit 1 — extraction only. Zero new types.** *(Landed: `619be92`.)*

1. In each of the seven test files, replace the repeated construction with one private static factory.
   `MonsterServiceTests` already repeats an identical three-argument expression 18 times, so this is a
   net-negative diff on its own merits and would be worth doing if custom moves never happened.
2. Rename `ResourceImagePostgresCollection` → `PostgresCollection` (§16.4 D2): one `const`, the
   `[CollectionDefinition]`, and the two `[Collection]` attributes that reference it.

**Verification: suite green with zero test-name and zero assertion changes, and zero production files
touched.** That is the whole gate for this commit, and it is checkable by `git diff --stat` showing nothing
under `MonsterOfTheWeek.Api/`. **Met:** ten files, all under `MonsterOfTheWeek.Api.Tests/`, +144/−72, and
615/0/4/619 byte-identical to the baseline.

**Correction, found by writing it: seven files, eight factories.** The 67 counted correctly and every file
but one repeats a single character-identical expression. `ByMysteryVariantsStayOutOfScopeTests` is the
exception — its two sites construct **different services** (`LocationService` and `BystanderService`, one
each), so one factory cannot cover them and it has `CreateLocationService`/`CreateBystanderService`. "67
sites become 7 edits" is therefore **8**, which changes nothing about the argument and is worth fixing
because the number is the thing a reader checks.

**Phase 1, commit 2 — the feature.** *(Landed: `64e9826`.)* `CustomMove` + `CustomMoveOwnerType` + context
config + the migration + `ICustomMoveService`/`CustomMoveService` + `FakeCustomMoveService` + the
`Program.cs:42` registration + the three harness registrations + `CustomMoveServiceTests`.

Three things the plan for this commit did not have right:

1. **The unread dependency warns, and the plan had no answer for it.** `ICustomMoveService` becoming a
   constructor parameter of five services that do not read it until Phase 2 is the entire point of the
   split — and it is **CS9113, *"Parameter 'customMoveService' is unread"***, five times, on a primary
   constructor. Not a hypothetical: measured, five warnings, build otherwise clean. The choices were to
   tolerate five new warnings for a phase, to defer the parameter to Phase 2 (which would hand Phase 2 the
   constructor churn this split exists to remove, and leave the harness registrations unexercised), or to
   suppress. **Suppressed**, with a comment at each of the five naming the phase and saying that Phase 2
   deletes the *suppression*, not the parameter. It is the codebase's first hand-written `#pragma warning`
   — every other one is in generated migration code — so it is a new pattern and should not outlive Phase
   2. A bare warning would have been worse than a new pattern here: the obvious way to silence CS9113 is to
   delete the parameter, which is exactly the regression B-R1 is about.
   **Settled by Skyler, 2026-10-11, as §16.4 D4** — *"Keep the supression."* — so this is a ruling rather
   than my judgement call, and the removal obligation stands with it: **Phase 2 deletes the five
   suppressions, not the parameters.**
2. **`FakeCustomMoveService` should not mirror `FakeResourceImageService` "exactly".** That fake returns
   hardcoded success and empties because nothing exercises image behaviour through it. The same hardcoding
   here would make every Phase 2 round trip vacuous, which the standing rule
   (`toad-fake-repositories-must-mirror-real-return-semantics.md`) and §23 item 5 both already forbid — and
   §23 item 5 contradicted this bullet. §23 item 5 wins: the fake is **list-backed**, `List`/`Create`
   return `NotFound` unless an opt-in `OwnerExists` is set (mirroring the real service's check on exactly
   those two methods), and `Update`/`Delete` run the real `(OwnerType, OwnerId, Id)` predicate. The ledger
   idea survives; "exactly" does not.
3. **Five of the 67 call sites take the real service, not the fake.** The 62 in the five fake-repository
   files get `new FakeCustomMoveService()` inside their factory, so they stay one edit each.
   `MonsterImageCleanupTests`' three and `ByMysteryVariantsStayOutOfScopeTests`' two build real
   repositories over a real `MotwDbContext`, and B10 says the custom-move service must hold the **same
   context instance** or Phase 2's cleanup runs outside the transaction — silently, and green on SQLite. So
   those three factories take `ICustomMoveService` as a **parameter** and their five sites pass
   `new CustomMoveService(context)`, making the construction Phase 2 copies already correct. Cost: five
   call-site edits instead of three factory edits. Worth it at exactly the files B10 names.

Phase 2 then touches the test tree only where behaviour actually changed.

### B2 — The segment→enum dictionary must be case-insensitive, or Phase 2 silently regresses a shipped behaviour.

Proven at both ends:

- `GET /api/MONSTERS/{realId}/custom-moves` returns `200 []` today (§16.2).
- An anchored inline `regex` route constraint is **case-insensitive** and hands the action the **original**
  casing — `owner == "MONSTERS"`, not `"monsters"` (§17.1, proven in a scratch MVC controller).

So `Owners["MONSTERS"]` on a default `Dictionary<string, CustomMoveOwnerType>` throws
`KeyNotFoundException` → **500**, or yields a 404 if you `TryGetValue` — either way a URL that returns
`200` today stops working, and §5's Phase 2 gate (*"the four previously-working domains behave as they did
before"*) fails on a case nobody will think to test.

**Fix, one argument:** `new Dictionary<string, CustomMoveOwnerType>(StringComparer.OrdinalIgnoreCase)`. It
is invisible in review and it is the cheapest thing in this whole pass to get wrong, so it wants a comment
naming what it preserves and a mixed-case case in the endpoint matrix.

### B3 — §2.6 and §3.4 undercount the projection sites, undercount the queries, and over-describe Mystery's tracked branch.

Three corrections, all verified:

1. **Seven call sites, not five.** Monster (`MonsterService.cs:99`), Minion (`MinionService.cs:55`),
   Location (`LocationService.cs:94`), Bystander (`BystanderService.cs:88`, inline in `GetByIdAsync`) —
   one each. **Mystery has three**: `MysteryService.cs:29` (`GetByIdAsync`), `:55` (`CreateAsync`), `:81`
   (`UpdateAsync`), because Mystery is the one service whose `Create`/`Update` do **not** funnel their
   response through `GetByIdAsync`. The other four do (`MonsterService.cs:62`/`:92`/`:130`,
   `MinionService.cs:48`/`:77`, `LocationService.cs:64`/`:87`/`:118`,
   `BystanderService.cs:62`/`:84`/`:125`).

2. **The extra query is not "one per detail page load."** Because those four funnel through `GetByIdAsync`,
   the new `ListForProjectionAsync` call also runs on **every entity create and every entity update
   response** — `POST /api/monsters`, `POST /api/mysteries/{mysteryId}/monsters`, `PUT /api/monsters/{id}`
   and their siblings across all four domains. On a create the answer is provably empty.
   `MysteryService.CreateAsync` is the one place you can skip it honestly: the mystery was created three
   lines earlier and cannot have moves, so pass `[]` with a comment. The other four share one method and
   cannot skip it without splitting it — **don't split it**; the duplication cost is worse than one index
   seek returning zero rows. Named here so §2.6's honest accounting stays honest.

3. **"Both branches need handling" is wrong, and the fix is smaller than the doc thinks.**
   `MysteryRepository.GetMysteryDetailAsync` is **one** method with **one** `.Include(x => x.CustomMoves)`
   (`:24`) and an `asNoTracking` flag applied after it (`:30-33`). The only caller passing
   `asNoTracking: false` is `MysteryService.UpdateAsync:60`, which mutates six scalar fields and then
   **re-reads with `asNoTracking: true` at `:80`** for the response. The tracked read never projects custom
   moves. So: delete the one `.Include` line and add nothing to the tracked path.
   (`LocationRepository.GetLocationDetailAsync` and `GetBystanderDetailAsync` also carry an `asNoTracking`
   parameter, but grepped: **nothing ever passes `false`** to either. Dead branch, pre-existing, not this
   work's business.)

**And one benefit §2.6 does not claim, which partly offsets its cost.**
`MonsterRepository.GetMonsterDetailAsync` (`:78-91`) is a single query with **six** collection `Include`s
and no `AsSplitQuery` — `Mysteries`, `Attacks`→`WeaponTags`, `Powers`, `Armors`, `Weaknesses`,
`CustomMoves` — which EF renders as one cartesian-product join set. `PlaybookRepository.cs:23` records the
deliberate contrast. Dropping `CustomMoves` takes that query from six collections to five and strictly
reduces the rows returned. So the real trade is **+1 round trip, −1 collection join**, not a pure cost. At
this data scale neither matters; what matters is that the doc's framing is one-sided.

### B4 — Phase 3's "net-negative `git diff --stat`" gate cannot be met, for a mechanical reason.

Every EF migration carries a full model snapshot in its generated `*.Designer.cs`. Measured:
`20261005034116_AddResourceImages.Designer.cs` is **2,992 lines**; `MotwDbContextModelSnapshot.cs` is
**2,989**. So Phase 1 adds ~3,000 generated lines, and **Phase 3 adds another ~3,000** on top of its five
`DropTable` calls.

**Phase 1, measured rather than estimated:** `20261011180029_AddCustomMoves.Designer.cs` is **3,027
lines**, `MotwDbContextModelSnapshot.cs` grew by **35**, and the hand-written half of the commit is 42
lines of migration plus the entity, config, service and tests. So 3,027 of commit 2's 4,229 added lines —
**72%** — are one generated file nobody should read. The estimate was right; recording the number is what
makes the Phase 3 gate's restatement checkable instead of arguable.

**Restate the gate:** *net-negative excluding `Data/Migrations/*.Designer.cs` and
`MotwDbContextModelSnapshot.cs`, which are generated and must not be hand-edited.* Same for Phase 1's diff
expectation. Nothing else about the gate changes — the *hand-written* half of Phase 3 really is pure
deletion, and that is still the thing worth reviewing on its own.

### B5 — The real-Postgres gate is skip-by-default, and a new Postgres test class is unsafe unless it joins an existing xUnit collection.

Two separate facts, both verified:

- `PostgresFactAttribute` (`:23-31`) sets `Skip` in its constructor unless `MOTW_TEST_POSTGRES` is set. My
  filtered run reported **4 skipped** — those four. So `dotnet test` reports Phase 1's and Phase 3's gate
  as *Skipped*, never as failed. The gate is a **manual step**: `docker compose up -d postgres`, point
  `MOTW_TEST_POSTGRES` at a **throwaway** database (the tests `EnsureDeletedAsync` whatever the string
  names — never the dev `motw`), then `dotnet test --filter "Category=Postgres"`.

  **Phase 1's run happened, 2026-10-11.** `motw-postgres` (Postgres 18) was already up;
  `MOTW_TEST_POSTGRES` pointed at a throwaway `motw_custom_moves_phase1` — never the dev `motw`, which was
  verified still present afterwards — and `dotnet test --filter "Category=Postgres"` reported
  **6 passed / 0 failed / 0 skipped**: the four pre-existing plus
  `CustomMoveMigrationPostgresTests`' two. The throwaway database was dropped afterwards. The created
  table was then read back off the server with `\d custom_moves` and matches §21.1 column for column,
  including `owner_type character varying(16)` and no foreign keys. **This is the paragraph's whole point:
  the same command without the env var reports those two as *Skipped*, so "the gate passed" means nothing
  unless the run is recorded. It is recorded here.**

  **Phase 3's run happened, 2026-10-11, and this is the one the whole gate existed for** — the only thing
  anywhere that executes the drop against a real server. Throwaway `motw_custom_moves_phase3`:
  **7 passed / 0 failed / 0 skipped**. Afterwards, read off the server rather than inferred: exactly one
  custom-move table remains (`custom_moves`), and `__EFMigrationsHistory` holds 24 rows ending at
  `20261011214028_DropPerDomainCustomMoves`. The sibling class gained its third test as this item
  proposed; see §23 item 7 for the mutation test that shows the new test is the only thing that can see an
  *omitted* `DropTable`. Throwaway dropped; dev `motw` verified untouched and still un-migrated.

  **Phase 2's run happened too, 2026-10-11**, against a throwaway `motw_custom_moves_phase2`:
  **6 passed / 0 failed / 0 skipped**, dropped afterwards, dev `motw` verified still present. Phase 2
  adds no migration, so this is a regression check rather than a new gate — it proves the Phase 2 model
  changes (five `.Include`s removed, no entity touched) did not move the schema out from under the
  committed migration history. Worth running anyway for that reason, and cheap.

  **Skyler has confirmed the runs will happen (§16.4 D3), so both gates stand exactly as §5 writes them**
  and the cheaper `dotnet ef migrations script` snapshot fallback I offered is **withdrawn** — it would
  have proved the generated SQL and not the server's acceptance of it, which is the half that matters for
  the irreversible migration. **The command still belongs verbatim in both gates**, because confirming the
  intent does not change the default outcome: anyone who runs `dotnet test` without
  `MOTW_TEST_POSTGRES` set still sees *Skipped*, and a gate whose default reading is "skipped" is a gate
  that gets forgotten. Each phase's checklist should record the run, not just require it.
- `Data/ResourceImagePostgresCollection.cs:14-17` is
  `[CollectionDefinition(..., DisableParallelization = true)]`, and its comment records the bug it exists
  for: two Postgres-gated classes racing their own `EnsureDeletedAsync`/`MigrateAsync` against one database
  name *"corrupts each other's schema — caught directly: a second class's migration failed with a stray
  'column does not exist'."* **A new `CustomMoveMigrationPostgresTests` must carry the collection
  attribute** or it reproduces that bug. **Renamed to `PostgresCollection` in Phase 1 (§16.4 D2)**, so the
  attribute reads `[Collection(PostgresCollection.Name)]` from Phase 1's second commit onward — and the
  rename itself lands in the **first** commit, with the extraction, because it is test-only and
  behaviour-free.

**My recommendation on extend-versus-sibling:** a sibling class, not an extension of
`ResourceImageMigrationPostgresTests`. That class's three tests are about the image feature and its first
assertion is `applied.Contains("_AddResourceImages")`; bolting a custom-move assertion into it makes one
class the home of every future migration gate. A sibling with two tests — *the full history including
`_AddCustomMoves` applies to a fresh database*, and *`custom_moves` is queryable through the real model*
(`Assert.Equal(0, await context.CustomMoves.CountAsync())`, which is the assertion that catches a column
name or type mismatch that a row count on the table would not) — plus, at Phase 3, one more asserting the
five old tables are gone. Pattern copied verbatim from `ResourceImageMigrationPostgresTests:29-45`/`:49-67`.

### B6 — Migrations auto-apply at startup, so Phase 3's irreversible step is applied by *deploying*, not by a deliberate command.

`MotwDbInitializer.InitializeAsync` calls `Database.MigrateAsync()` (`:14`), and `Program.cs:200` calls it
on every boot. R4 says the drop is *"isolated in a commit that changes nothing else, so the irreversible
step reviews on its own"* — true of the commit, and the commit is the right unit. But there is **no
`dotnet ef database update` step and no human in the loop**: merging Phase 3 and letting the host restart
drops five tables. Three consequences:

- Say it in the Phase 3 gate, so whoever merges knows the merge *is* the migration.
- **Do not author the drop migration before Phase 3**, even though EF would order it correctly by
  timestamp. A drop migration sitting in the tree during Phase 2 is applied the next time anyone runs the
  dev server, while Phase 2's code still reads the five tables. The doc asks whether the drop is *safe to
  author now*: it is safe to author **in Phase 3 and only in Phase 3**, and the reason is this line, not
  the schema.
- Scaffold it, do not hand-write it, and scaffold it **after** deleting the five entities and their configs
  from the model — otherwise the snapshot diff is empty and you get an empty migration. Run
  `dotnet ef migrations add` from `src/api/MonsterOfTheWeek.Api`: the Tests project has no
  `Microsoft.EntityFrameworkCore.Design` reference and the API's is `PrivateAssets=all`, so the API project
  directory is the only place the tool resolves. `MotwDbContextFactory.cs` already exists for design time,
  so no connection string is needed to scaffold.

**Done exactly that way, and the two-commit split this forced is worth recording.** Because the migration
must be scaffolded *after* the model deletions, and because R4 wants the irreversible step isolated,
Phase 3 is **two** commits rather than §5's one: `84facbc` (pure deletion, fully revertible) then
`81f5960` (the migration, alone). The ordering is not a preference — the deletion has to precede the
scaffold or EF emits an empty migration, and that happens to produce exactly the isolation R4 asked for.
Second time in this plan that a commit split was forced by a mechanism rather than chosen for
reviewability: §16.4 D1's was forced by "a fake cannot precede its interface", and Phase 2's by route
precedence.

**One operational consequence, and it is the one to say out loud rather than file under "expendable".**
The decision that the rows are expendable was taken when the question was abstract. Measured at Phase 3,
dev `motw` held **one real `mystery_custom_moves` row** — *"Bring the Noise"* on *"The Quiet"*, a full move
with worked 10+/7–9/6- mechanics — and four empty tables. It is destroyed on the next host restart. That
does **not** change the decision (no data migration, no backfill: a standing ruling, confirmed twice), and
the row is cheap to re-enter through `POST /api/mysteries/{id}/custom-moves`. But "expendable" and "empty"
are different claims, and a teardown gate should report which one it is actually relying on.

### B7 — §9's teardown inventory, the checklist Phase 3 executes against, has six omissions.

I grepped the whole tree for `CustomMove|custom_move|custom-move` across `.cs`, `.ts`, `.html`, `.json` and
`.sql`. §9's **counts are all correct** — 5 entities, 5 nav collections, 5 `DbSet`s, 5 config blocks,
16 + 16 repository members, 16 + 16 service members, 5 `.Include`s, 5 `ToResponse` overloads (verified at
`ApiMappers.cs:97`, `:100`, `:103`, `:106`, `:150`), and the four fake-repository line ranges
(`MonsterServiceTests.cs:524-527`, `MinionServiceTests.cs:312-320`, `LocationServiceTests.cs:416-424`,
`BystanderServiceTests.cs:415-423`) are all exact. What is **missing from the file lists**:

1. **`Repositories/MysteryRepository.cs`** is not named under §9's *Repositories* bullet, which lists only
   the four. Mystery's `.Include(x => x.CustomMoves)` (`:24`) is inside §9's count of five, but its file is
   never named. Same for **`Services/MysteryService.cs`** under *Services* (`:138`).
2. **`Services/MonsterImageCleanupTests.cs`** — 3 constructor sites. Named nowhere.
3. **`Services/ResourceImages/ByMysteryVariantsStayOutOfScopeTests.cs`** — 2 constructor sites (`:96`,
   `:130`). Named nowhere.
4. **`Controllers/MysteryLinkApiHarness.cs`** and **`Controllers/ResourceImageApiHarness.cs`** — DI
   registrations. Named nowhere. (B1.)
5. **`Controllers/MinionReparentApiHarness.cs`** is named as "retargeted", which understates it: the
   retarget is a seed rewrite (`:51` declares `CustomMoveId`; the seed block constructs a
   `MinionCustomMove`) **and** a DI registration.
6. **`Data/Migrations/MotwDbContextModelSnapshot.cs`** — generated, but committed, and it changes in both
   migrations. Worth naming so B4's diff arithmetic is not a surprise.

Two comments that go stale and are in no list: `MinionServiceTests.cs:122` (*"UpsertCustomMoveRequest is
deliberately excluded here: it's the shared cross-domain DTO"* — the reason changes, the exclusion stays
right), and the two search-provider comments (`MonsterSearchProvider.cs:11-12`,
`MinionSearchProvider.cs:11-12`) which name `MonsterCustomMove` / `MinionCustomMove` as excluded types;
§11 names those two files, §9 does not.

**All six were the complete set, confirmed at Phase 3.** I re-ran the same tree-wide grep
(`CustomMove|custom_move|custom-move` across `.cs`, `.ts`, `.html`, `.json`, `.sql`, `.csproj`) before
deleting anything and again after, and nothing turned up beyond the six above and §9's own lists. §9's
counts were all correct the first time. **Two things worth adding for whoever does the next teardown of
this shape:**

- **Location and Bystander name their repository methods differently** —
  `GetLocationCustomMovesAsync` / `GetBystanderCustomMovesAsync`, against Monster's and Minion's
  `GetCustomMovesAsync`. A grep for one name finds only half of the sixteen. §9's *count* was right
  because it was derived from the interfaces; a grep-driven teardown would have stranded eight methods.
- **The post-deletion grep is the one that matters, and it should expect hits.** Everything it found was
  prose: comments that name a now-deleted type historically (the two search providers, the retargeted
  seeds, the harness seed note) and four controller pointers that said *"Phase 3 removes them"* in the
  future tense. Those four are the real find — a forward-looking comment is correct exactly until the
  phase it points at happens, and nothing fails when it goes stale.

**Clean, verified, nothing to do:** `MotwDbInitializer.cs`, `Data/Seed/*`, `MonsterRepositoryTests.cs`,
`MysteryLinkRepositoryTests.cs`, `HunterApiHarness.cs`, every `Hunter*`/`Playbook*`/`Bespoke*` file, and
`tools/pdf-extract/custom-moves-*.{html,json}` (hunter-playbook artifacts — §1.6's other custom move, not
in scope).

### B8 — §2.5's "every write goes through the owner check, with no exemptions" buys nothing on `PUT`/`DELETE` and costs a query each.

That sentence is not what the code does today and should not be what it does tomorrow.
`MonsterService.UpdateCustomMoveAsync` (`:487-504`) does **no** owner-existence check: it calls
`monsterRepository.GetCustomMoveAsync(id, moveId)`, whose predicate is
`x.Id == moveId && x.MonsterId == monsterId` (`MonsterRepository.cs:251`). `DeleteCustomMoveAsync` (`:506`)
is the same shape over `ExecuteDeleteAsync` (`:260`). All three siblings match.

Under the new shape the predicate becomes `(OwnerType, OwnerId, Id)`, which is **strictly stronger** than
owner-existence: it proves the owner exists *and* owns this move. Adding `OwnerExistsAsync` in front of it
is a second round trip that cannot change any status code — only a 404's message, and a 404 here has no
body (§16.2). §18 gives the shape.

### B9 — The two controller families disagree on error mapping today; for custom moves only, they happen to agree. Verified, because the Phase 2 gate depends on it.

`MonstersController` and `MinionsController` route custom moves through `ToActionResult` → `ToErrorResult`,
which maps `NotFound` → `NotFound()`, `Validation` → `BadRequest(new { message })`, everything else →
`BadRequest()`. `LocationsController:111-141` and `BystandersController:106-136` hand-roll
`result.IsSuccess ? Ok(result.Value) : NotFound()`, collapsing **every** error to 404. One controller can
only have one policy, so §5's *"the four previously-working domains behave as they did before (same bodies,
same status codes)"* is satisfiable only if no custom-move path can produce a non-`NotFound` error.

**It cannot.** Read all sixteen service implementations: every failure is `ServiceResult<T>.NotFound`.
Nothing returns `Validation` or `Conflict` (`ServiceResults.cs:30-43`). Request-shape validation is
`[ApiController]`'s automatic model-state 400 from `UpsertCustomMoveRequest`'s
`[param: Required, MaxLength(255)]` (`ApiContracts.cs:167`), which fires before the action runs and is
identical either way. **So the gate is met, and `ToErrorResult`'s policy is the one to adopt** — it is the
more correct of the two and it is what three of the five controllers already use.

Two more status facts the doc does not pin, both of which the new controller must preserve or the gate
fails: **all four `POST`s return `200 Ok`, not `201 Created`** (unlike `MonstersController.Create` at
`:20`, which uses `CreatedAtAction`), and **`DELETE` returns `204` on success and `404` on a miss**,
derived from `deleted > 0`.

One small cost: `ToActionResult`/`ToErrorResult` are **private per-controller duplicates** —
`MonstersController`, `MinionsController` and `MysteriesController` each have a copy; `LocationsController`
and `BystandersController` have none. There is no shared base class or extension method.
`CustomMovesController` needs a sixth copy (eleven lines) or two inline ternaries. I would copy them, to
match the three, and not start a `ControllerBase` subclass in a phase whose point is subtraction.

### B10 — `MysteryService` needs its transaction, and for a sharper reason than parity.

Verified exactly as §3.5 claims: `IMysteryRepository` (16 lines) has no `BeginTransactionAsync`; the other
four do, at `MonsterRepository.cs:265`, `MinionRepository.cs:210`, `LocationRepository.cs:152`,
`BystanderRepository.cs:151`, all one-liners delegating to `Database.BeginTransactionAsync`.
`MysteryService.DeleteAsync` (`:84-88`) is two lines with no transaction.

**The reason it needs one is not symmetry — it is that the four shipped flows clean up *before* deleting
the owner.** Follow that ordering without a transaction and a failure between the two steps leaves the
custom moves deleted and the mystery alive: **user data destroyed, not leaked.** That is a worse failure
than the orphan the cleanup exists to prevent. (Deleting owner-first would invert it to a harmless orphan
and need no transaction at all — but `MonsterService.DeleteAsync` *must* read minion ids before the delete,
so owner-first is not available as a uniform shape. Match the four.)

Specifics:

- `IMysteryRepository` + `MysteryRepository`: copy `IMonsterRepository.cs:66-71`'s documented shape and
  `MonsterRepository.cs:265-266`'s one-liner.
- `FakeMysteryRepository` (`MysteryServiceTests.cs:152-194`) gains one member returning
  `new NoOpDbContextTransaction()` — `internal sealed`, and already in the same namespace
  (`MonsterOfTheWeek.Api.Tests.Services`), so no `using` is needed. While in that file:
  `NoOpDbContextTransaction.cs:8`'s XML doc points at `ResourceImageOwnerDeleteCleanupTests`, **which does
  not exist** — the file is `MonsterImageCleanupTests.cs`. Fix the cross-reference in the same commit.
- **No nested-owner trap for Mystery, confirmed rather than assumed.** `DeleteMysteryAsync` is
  `ExecuteDeleteAsync` on `mysteries` (`MysteryRepository.cs:44-47`); the cascades reach the three bridge
  tables and `Countdown`, and `MysteryLinkRepositoryTests.DeletingAMystery_CascadesItsBridgeRows` already
  pins that. Monsters, locations and bystanders are M:N and survive, so they clean up their own moves on
  their own deletes. §3.5 is right.
- **A construction requirement for the new cleanup tests, easy to get wrong:** `ICustomMoveService` must
  receive the **same** `MotwDbContext` instance the repository holds, or `BeginTransactionAsync` opens a
  transaction on a different connection and the cleanup runs outside it — silently, and green on SQLite
  with a shared cache. DI guarantees it (`AddScoped`); a hand-constructed test guarantees it only by
  passing the same `context` object, which is what `MonsterImageCleanupTests.cs:43`/`:55-57` does. Copy
  that construction verbatim.

### B11 — `MonsterMinionCascadeTests` needs four changes, and §2.4 asks for one.

§2.4 and R2 are right about the mechanism, and I verified it: `SeedMinionAsync` (`:48-72`) seeds a
`MinionType`, a `Minion` and a `MinionAttack`;
`DeletingAMonster_CascadesItsMinionsAndTheirSubResources` asserts `Monsters`, `Minions` and `MinionAttacks`
are empty (`:106-108`). `MinionAttack.MinionId` keeps its real FK, so the test stays green while minion
custom moves orphan. Exactly what it needs:

1. **Seed two custom moves, not one** — one on `harness.MonsterId` and one on the minion. A monster-only
   seed passes under the naive fix (clean the owner, forget the minions), which is precisely the bug §2.4
   names.
2. **Assert both present before the `DELETE`.** The file already has a `// The premise, asserted` block
   (`:92-99`) for exactly this reason, in its own words: *"three `Assert.False`es on an empty table pass
   whether the cascade worked or the seed silently never landed, and the seed goes through a context that
   is not the one the API uses."* Extend that block; do not add a bare `Assert.False` at the bottom.
3. **Assert `await context.CustomMoves.CountAsync() == 0`, with a third owner whose moves must survive.**
   A count-to-zero is the ledger shape the standing rule asks for, and it also catches the opposite bug — a
   mis-wired `DeleteAllForOwnerAsync` that deletes a *third* owner's moves. To see that you need a second
   seeded monster with its own move; `MysteryLinkApiHarness` seeds only one monster, so seed the second
   locally in this test.
4. **`DetachingAMonsterFromOneMystery_LeavesItsMinionsAloneEverywhere` (`:122`) needs the complement**, and
   neither §2.4 nor R2 asks for it. That test asserts the minion and its attack survive a **detach**
   (`:142-143`). Without a custom-move half, a `DeleteAllForOwnerAsync` accidentally wired into the
   *unlink* path — a one-line mistake in a file where link and unlink sit four lines apart — deletes a
   monster's custom moves on every detach and no test sees it. The delete half and the detach half are the
   same two-sided fact the class's own XML doc is built around (*"one database fact and its complement"*);
   custom moves must appear on both sides.

Plus the harness DI registration from B1, without which all of this 500s.

### B12 — R7's drift guard can be made exhaustive and cheap; the version in the doc covers half the drift.

R7 proposes *"a test asserting every `CustomMoveOwnerType` member has a reachable route."* That catches the
route half. The **service** half — a sixth enum member added and `OwnerExistsAsync`'s `switch` arm
forgotten, so the `_ => throw new ArgumentOutOfRangeException` arm becomes live and surfaces as a 500 from
a route that compiles — is the exact hazard §2.8 argues the two-enum decision exists to prevent, and a
route test cannot see it. Three assertions in one class, each with one source of truth:

1. Every `Enum.GetValues<CustomMoveOwnerType>()` member is a **value** of the controller's segment
   dictionary. (Catches: member added, segment not.)
2. The dictionary's **keys** equal the alternation parsed out of the route template, read off the action's
   `[HttpGet]` attribute by reflection. (Catches: segment added to the dictionary and not to the regex —
   the drift that makes the route 404 while the code looks complete. This is what makes the one
   `const string` template the single literal; see §17.2.)
3. A `[Theory]` over every member calling `ListForProjectionAsync` against an **empty** SQLite context,
   asserting an empty list rather than a throw. (Catches the service half. Cheap: no seeding at all.)

This matters more than it looks, because I proved the enum is not self-protecting: in a minimal-API host on
.NET 10, `7` binds to a five-member enum **successfully**, yielding `(Owner)7` (§17.1). MVC's binder
rejects it, so the app is safe today — but the throwing arm is unreachable because of which binder is in
play, not because the type prevents it. Keep the arm, and guard it.

### B13 — Three smaller corrections, and one for Rosalina's citation.

- **§1.4 says "~20 spec files" carry `customMoves: []`.** Counted: **23** — and every occurrence is the
  literal fixture line. I grepped for `customMoves` excluding `customMoves: []` across all `*.spec.ts` and
  got **zero hits**, so §1.4's and §10's stronger claim ("zero frontend assertions") is exactly right; only
  the file count is off. Frontend is Luigi's; recorded so a later estimate uses 23.
- **§2.12 item 4 slightly overstates the Swagger loss.** Swagger is registered Development-only
  (`Program.cs:179-183`), so the discoverability cost is dev ergonomics and never reaches an API consumer.
  §22 gives the ~15-line cure if it ever bites.
- **§13.1 item 4's citation is off by one record, and the substance gets stronger.**
  `UpsertMonsterPowerRequest` is at `ApiContracts.cs:159`, not `:166`; `:166` is
  `UpsertMonsterWeaknessRequest`. Both are character-for-character identical to `UpsertCustomMoveRequest`
  (`:167`), and `MonsterPowerResponse` (`:128`) and `MonsterWeaknessResponse` (`:130`) are both identical to
  `CustomMoveResponse` (`:21`). So it is **three** identical upsert records and three identical response
  records, not two — which strengthens her point that every layout, validation and copy decision a Power
  already made transfers without adaptation.
- **One backend constraint for Rosalina and Luigi, named not decided:** `Description` has **no**
  server-side length limit. `UpsertCustomMoveRequest` carries `[MaxLength(255)]` on `Name` only, and
  `description` maps to Postgres `text`. So §13.3's `maxlength="255"` on the Name input is right, and a
  textarea with no `maxlength` is also right. If a description cap is ever wanted it is a contract change,
  which this plan budgets at zero (§2.1) — so it would have to be argued, not added.

---

## 16.4 Settled by Skyler, 2026-10-11 — the backend decisions

The same shape as §8.1, kept separate because these are answers to §25 rather than to §8. All three are
Skyler's; §25 keeps the reasoning each one was asked on, so the answer stays checkable.

| # | Question | Answer |
|---|---|---|
| D1 | Two commits inside Phase 1 — the 67-site constructor sweep separate from the entity/config/migration/service? | **Yes.** *"Two commits is fine."* B1 has the split and the one ordering constraint that decides which half goes first. The only deviation from §5's *"one commit per phase"*, and only in Phase 1. |
| D2 | Rename `ResourceImagePostgresCollection` → `PostgresCollection`? | **Yes.** *"Yes, renaming is fine."* The class, the `const Name` value (*"Resource Image Postgres tests"* → *"Postgres tests"*), the `[CollectionDefinition]`, and both `[Collection]` attributes. Lands in Phase 1's **first** commit — test-only, behaviour-free, and it means the new migration test is never written against the old name. |
| D3 | Will the manual real-Postgres run actually happen at Phase 1 and Phase 3? | **Yes.** *"We can run the migration during each phase it's needed in."* So §5's two gates stand as written, and the `dotnet ef migrations script` snapshot fallback is **withdrawn** (B5). The literal `MOTW_TEST_POSTGRES` command still goes in both gates — the default outcome is *Skipped* for anyone who does not set it, which is B5's point and is unchanged by the commitment to run it. **Phase 1's run happened, 2026-10-11: 6 passed / 0 failed / 0 skipped, recorded in B5. Phase 3's is still owed.** |
| D4 | Keep the five `#pragma warning disable CS9113` suppressions Phase 1 landed, or move the five constructor parameters to Phase 2 and carry no suppression? | **Keep the suppression.** *"Keep the supression. Go ahead with Phase 2."* (Skyler, 2026-10-11, after Phase 1 landed and reported it.) So the five parameters stay pre-landed and the Phase 1 → Phase 2 boundary is behaviour only, as D1 intended — **and the removal obligation is unchanged: Phase 2 deletes the five suppressions, not the parameters, because the parameters become read.** Asked because the suppression is the codebase's first hand-written `#pragma warning` and so is a new pattern rather than a free move; this answer makes it his call rather than mine. |

**Where these land, so nothing is recorded only here:** D1 in **B1** (the two-commit split) and **§23
item 1**; D2 in **B1**, **B5** and **B-R6**; D3 in **B5** and **B-R5**; D4 in **B1** (divergence 1) and
`.squad/decisions/inbox/bowser-phase1-unread-dependency-suppression.md`.

**What they did not shift.** Nothing in §§17–22 moves: the route constraint, the ownership-validation
distribution, the delete-flow and transaction work, the index, both migrations' contents and the enum are
all unaffected — D1 and D2 are about *how the work is committed and named*, and D3 confirms a gate rather
than changing one. The one genuinely new specific is the commit **ordering** constraint in B1, which only
became visible once "two commits" was real: `FakeCustomMoveService` implements an interface that does not
exist yet, so the first commit has to be the part that introduces no new types.

---

# 17. The route shape

## 17.1 What I proved, in a scratch project outside the repo

The doc calls the parameterised owner segment *"the app's first"* and leaves the constraint mechanism to me.
Rather than reason from memory I built a throwaway `dotnet new web` project in the session scratchpad —
**not** in this repo; nothing under `src/` was touched — with a real `[ApiController]` carrying the exact
proposed template plus the two alternatives, behind a real Kestrel host, on SDK 10.0.400 / `net10.0`.

| Probe | Request | Result |
|---|---|---|
| **A.** `[HttpGet]` on a `const string` template with an **anchored** inline regex `{owner:regex(^(mysteries\|monsters\|minions\|locations\|bystanders)$)}` | `/a/monsters/{guid}/custom-moves` | `200`, `owner == "monsters"` |
| | `/a/MONSTERS/{guid}/custom-moves` | `200`, **`owner == "MONSTERS"`** |
| | `/a/xmonstersx/{guid}/custom-moves` | `404` |
| | `/a/nonsense/{guid}/custom-moves` | `404` |
| **B.** the same, **unanchored** — `{owner:regex((mysteries\|monsters))}` | `/b/xmonstersx/{guid}/custom-moves` | **`200`, `owner == "xmonstersx"`** |
| **C.** bind the segment straight to the enum — `{owner}` + an `Owner owner` action parameter | `/c/Monster/{guid}/…` | `200` |
| | `/c/monster/{guid}/…` | `200` — the MVC binder is case-insensitive |
| | `/c/monsters/{guid}/…` | `400` |
| | `/c/7/{guid}/…` | `400` in MVC — but **`200`, `(Owner)7`, in a minimal-API host** |

Five conclusions, three of which I would have got wrong from memory:

1. **A `const string` route template works in `[HttpGet]`**, so the five legal segments are written once and
   all four actions share them. That is the whole reason B12's drift guard can be exhaustive.
2. **The anchors `^` and `$` are mandatory.** `RegexInlineRouteConstraint` matches with `IsMatch`, which is
   unanchored, so probe B accepts `xmonstersx`. Dropping the anchors is a silent widening that looks
   identical in review. **The easiest thing in §2.9 to get wrong.**
3. **The constraint is case-insensitive and does not normalise.** The action receives the caller's casing
   verbatim. That preserves today's behaviour (§16.2) and forces B2's `OrdinalIgnoreCase` dictionary.
4. **An unmatched segment is a routing 404 before any application code runs**, in a host with no catch-all
   at all — so §5's Phase 2 gate (*"an unknown owner segment 404s at routing"*) is checkable inside a
   harness and does not depend on `Program.cs:219`. In the real app the catch-all takes it and the answer is
   the same bare 404 authenticated, 401 anonymous; I verified both (§16.2).
5. **Binding the segment straight to the enum is rejected on wire shape, not on safety.** It would force
   singular segments (`/api/monster/…`), breaking the plural convention all ~80 existing templates follow,
   and it answers a bad segment with a `400` ProblemDetails instead of the 404 every other bad `/api` path
   gets. The numeric result is worth recording separately: MVC rejects `7`, minimal APIs accept it as
   `(Owner)7`. That is the concrete reason to keep `OwnerExistsAsync`'s throwing default arm **and** guard
   it (B12 assertion 3), rather than treating a five-member enum as five possible values.

## 17.2 Recommendation: an anchored inline `regex` in one `const string`. Not an `IRouteConstraint`.

```csharp
[ApiController]
public sealed class CustomMovesController(ICustomMoveService customMoveService) : ControllerBase
{
    // The legal owner segments, written down once. Anchored deliberately: the inline regex
    // constraint matches with IsMatch, which is unanchored, so without ^...$ the segment
    // "xmonstersx" matches "monsters" and reaches the dictionary below. Verified, not assumed —
    // architecture.md §17.1.
    //
    // A const string, so all four actions share one literal and CustomMoveOwnerRouteTests can
    // read it back off this attribute by reflection (§17.1 conclusion 1, B12 assertion 2).
    private const string OwnerSegment =
        "{owner:regex(^(mysteries|monsters|minions|locations|bystanders)$)}";

    private const string Collection = "api/" + OwnerSegment + "/{ownerId:guid}/custom-moves";
    private const string Item       = Collection + "/{moveId:guid}";

    // OrdinalIgnoreCase is load-bearing, not tidiness. Route matching is case-insensitive and the
    // constraint hands us the caller's own casing, so /api/MONSTERS/{id}/custom-moves — which
    // returns 200 on the shipped per-domain routes — arrives here as "MONSTERS". An ordinal
    // dictionary would throw, turning a working URL into a 500. architecture.md B2.
    private static readonly IReadOnlyDictionary<string, CustomMoveOwnerType> Owners =
        new Dictionary<string, CustomMoveOwnerType>(StringComparer.OrdinalIgnoreCase)
        {
            ["mysteries"]  = CustomMoveOwnerType.Mystery,
            ["monsters"]   = CustomMoveOwnerType.Monster,
            ["minions"]    = CustomMoveOwnerType.Minion,
            ["locations"]  = CustomMoveOwnerType.Location,
            ["bystanders"] = CustomMoveOwnerType.Bystander,
        };

    [HttpGet(Collection)]    // 200 | 404
    [HttpPost(Collection)]   // 200 | 404   -- 200, not 201: matches all sixteen actions it replaces
    [HttpPut(Item)]          // 200 | 404
    [HttpDelete(Item)]       // 204 | 404
}
```

**Why not a registered `IRouteConstraint`.** It is the better-looking option and it is the wrong one here,
for one verified reason: a named constraint lives in `RouteOptions.ConstraintMap`, which is configured on
the host — and **three of the four endpoint-test harnesses build their own `WebApplication`**
(`MysteryLinkApiHarness.cs:97-125`, `MinionReparentApiHarness.cs:97-110`,
`ResourceImageApiHarness.cs:75-91`; each says *"it is not `Program.cs`"* in its own doc) and would never see
it. The constraint would then silently not apply in every test that exercises these routes: the route would
still match, the unknown-segment gate would pass for the wrong reason, and the one thing the constraint
exists to prove would be untested. Mitigating that means a shared `AddTo(RouteOptions)` helper called from
`Program.cs` *and* every harness — four more forgettable call sites, to replace a literal in an attribute.
The inline regex has no registration, no host coupling, and is visible at the action.

**What the inline regex gives up, honestly.** The legal set is a string, so the compiler cannot relate it to
the enum. That is exactly what B12 assertion 2 closes, and parsing an alternation out of one `const string`
by reflection is a ten-line test. The `IRouteConstraint` version could have derived the set from
`Enum.GetValues` and made the drift impossible by construction — that is its one real advantage, and it is
worth less than four forgettable registrations.

**Rejected, recorded so it is visibly rejected:** no constraint at all, validating inside the action. It
would make `api/{owner}/{ownerId:guid}/custom-moves` match `/api/hunters/{guid}/custom-moves`,
`/api/anything/{guid}/custom-moves` and so on, and answer them with whatever the action chose instead of the
bare 404 that `Program.cs:219`'s catch-all deliberately gives every other unknown `/api` path — a comment at
that line calls the invariant load-bearing. The constraint is what keeps the invariant.

**One behaviour the doc does not mention and which does not change.** `Program.cs:219` is an `app.Map`,
which matches **every** HTTP method, and its own comment records the side effect: *"an unsupported method on
a real route (DELETE /api/mysteries) now lands here as 404/401 rather than 405."* So a `PATCH` to a
custom-move path is a 404 today and a 404 after. No regression, and no need to add a method constraint.

---

# 18. Ownership validation — the cheapest correct shape

**Follow `ResourceImageService.OwnerExistsAsync` (`:207-215`) literally, with a fifth arm, and keep the
throwing default.** Five `AnyAsync` arms on a primary key, one index lookup each. Nothing cheaper exists,
and nothing about a `UNION ALL` or a single dynamic query pays for itself at five arms.

**Where to diverge from the image service: which methods call it.** §2.5 says every write, with no
exemptions. That is one query more than correct on two of the four verbs (B8). The right distribution:

| Method | Owner check? | Why |
|---|---|---|
| `CreateAsync` | **Yes** | The only path where nothing else would catch a bogus owner. This is the relocation §2.3 describes, and it is what all four `Create*CustomMoveAsync` already do. |
| `ListAsync` | **Yes** | Only to keep today's behaviour: owner missing → `404`, owner present with no moves → `200 []`. Verified both against the dev server (§16.2). Without the check the two collapse into `200 []` and the Phase 2 gate fails. |
| `UpdateAsync` | **No** | The `(OwnerType, OwnerId, Id)` predicate is strictly stronger. Adding the check cannot change a status code — only a 404's message, and a 404 here has no body. |
| `DeleteAsync` | **No** | Same. `ExecuteDeleteAsync` returning 0 → `false` → `404`, exactly as `MonsterRepository.cs:260` does today. |
| `ListForProjectionAsync` | **No** | The owner was loaded two lines earlier. Already §3.2's intent. |
| `DeleteAllForOwnerAsync` | **No** | The owner is being deleted. Checking it would be checking whether the thing you are destroying exists. |

**Two of six, not six of six.** That is not a weakening of §2.5 — on `PUT` and `DELETE` the composite
predicate *is* the ownership check, and a better one, because it also rejects a move id belonging to a
*different* owner of the same type. §2.5's closing guarantee (*"a move id belonging to one owner can never
be read, updated or deleted through another owner's URL"*) is produced by the predicate, not by
`OwnerExistsAsync`.

**Where to follow `ResourceImageService` and where not.**

- **Follow it** on: the `switch`-expression shape and its arm order; `ExecuteDeleteAsync` for
  `DeleteAllForOwnerAsync` (`:135-143` — one statement, no tracking, participates in the ambient
  transaction); the `ServiceResult<T>.NotFound($"{ownerType} {ownerId} was not found.")` message shape
  (`:152`); `AsNoTracking()` on list reads (`:156`); and taking `MotwDbContext` directly rather than a
  repository, per §2.11's reasoning, which applies with one more domain.
- **Do not follow it on the return type.** `IResourceImageService` returns **entities**
  (`ServiceResult<IReadOnlyList<ResourceImage>>`) and lets the controller map, because its controller
  actions need raw bytes and `File(...)`. `ICustomMoveService` should return `CustomMoveResponse`, as §3.2
  proposes and as all four domain services already do (`MonsterService.cs:472`) — otherwise the five detail
  projections each call `.ToResponse()` themselves, which is five copies of the mapping §9 is collapsing to
  one. §3.2 says it is *"modelled on `IResourceImageService`"*; **this is the one place it should not be**,
  and saying so stops a reviewer "correcting" it.
- **Do not follow it on `UpdateAsync`'s mechanism.** Fetch tracked on the `(OwnerType, OwnerId, Id)`
  predicate, mutate, `SaveChangesAsync` — the shape all four existing implementations use
  (`MonsterService.cs:493-502`), and the one that can return the updated row. `ExecuteUpdateAsync` returns a
  count and would need a second read; the image service's only use of it (`:234`) is a one-column write
  with no response body.
- **Nothing to remember about timestamps — and say so.** `CustomMove` has no `ITimestamped` and no
  `CreatedAt`, so unlike `ResourceImage`, whose comment at `DomainEntities.cs:386-389` warns that
  `ApplyTimestamps()` will never touch it, there is no explicit assignment to forget. Worth one line of
  comment stating that there is nothing, so nobody adds `CreatedAt` later by analogy with images. None of
  the five existing tables has timestamps either; §3.1 is right.
- **Register it beside `Program.cs:42` and copy that block's last sentence verbatim.** *"Missing this
  registration doesn't fail the build; it fails the first request to any of those controllers."* True of
  this service for five controllers instead of four, and B1 is the proof that it needs saying again.

**Trimming.** `Name.Trim()` and `Description?.Trim()`, matching every existing implementation
(`MonsterService.cs:482`). Note what that does **not** do and has never done: a `Name` of `"   "` passes
`[Required]`, which only rejects null and empty, and trims to `""` — so a whitespace-only name persists as
an empty string. Pre-existing across all five sub-resource types, and
`MonsterServiceTests.cs:331-341`'s reflection table is the record of it being known. Not this work's
business, and **not** a reason to add validation that four shipped endpoints do not have.

---

# 19. Cascade cleanup, delete flows and transactions

Verified state of all five flows, then the exact change.

| Domain | Transaction today | Image cleanup today | Nested owner? |
|---|---|---|---|
| Monster | `MonsterService.cs:185` — the codebase's first | own, then `foreach (minionId)` (`:191-195`) | **Yes** — `Minion.MonsterId` is `OnDelete(Cascade)`, from `20260726000551` |
| Minion | `MinionService.cs:142` | own | No — its own doc says so (`:139-141`) |
| Location | `LocationService.cs:126` | own | No |
| Bystander | `BystanderService.cs:133` | own | No |
| **Mystery** | **none** (`:84-88`) | none | No — bridge rows and `Countdown` only |

**The change is one line per flow, two for Monster, plus a new transaction for Mystery.** Put the
custom-move cleanup **immediately after** the image cleanup in each method, inside the existing transaction,
and inside the existing `foreach (var minionId in minionIds)` loop for Monster — so that loop reads as
*"clean up everything this minion owns"* rather than becoming two loops over the same ids. The minion ids
must still be read before the monster delete, for the reason `MonsterService.cs:170-183`'s comment already
gives at length; nothing about that changes.

**Three test cases per domain, copied from the shape that already exists.** `MonsterImageCleanupTests.cs`
is the template and it has exactly the right three: *deletes the owner's own rows and its cascaded
children's* (`:23`), *no-op case still commits* (`:70`), *unknown owner returns false and commits an empty
transaction* (`:99`). The third is the one people skip and the one that catches a cleanup that throws on a
missing owner. Build them against a real SQLite `MotwDbContext` with the real repositories and the real
service, as that file does — a fake would be asserting the implementation against itself, which is its own
XML doc's stated reason (`:15-18`).

**The one new assertion shape worth insisting on.** For Monster, assert
`await context.CustomMoves.CountAsync() == 0` **with a second monster seeded whose moves must survive**.
`MonsterImageCleanupTests` gets away with a bare count-to-zero because its fixture has one monster; a
count-to-zero on a single-owner fixture cannot distinguish "cleaned up this owner" from "cleaned up
everything", and `DeleteAllForOwnerAsync` is precisely the method where a mis-wired predicate does the
latter. One extra seeded owner turns the cheapest assertion into a correct one.

**Mystery's transaction:** B10 has the reasoning and the four mechanical steps.

**Landed in `d87974b`, and the shape held exactly** — one line per flow, two for Monster (its own plus one
inside the existing `foreach (var minionId in minionIds)`, not a second loop), and Mystery's new
`BeginTransactionAsync`. Three things worth recording from doing it:

1. **The cleanup tests went to one new file, not into the four domains' existing test files.**
   `CustomMoves/OwnerDeleteCleanupTests` holds all five domains' three cases. The alternative — a case per
   domain in `Monster/Minion/Location/BystanderServiceTests` — would have split one fact across four
   files whose fakes cannot express it, since these tests need real repositories over one real context
   (B10). `MonsterImageCleanupTests` is the precedent for a cleanup living in its own file; this follows
   it rather than the per-domain convention.
2. **The surviving-owner assertion is a shared helper, deliberately.** `AssertOnlyTheSurvivorsMoveRemains`
   is called by every case, so B-R11's requirement cannot be satisfied in four cases and forgotten in the
   fifth. It asserts the survivor's name, owner type *and* owner id, not just a count of one.
3. **The Bystander case needed a second Bystander rather than the shared survivor.** Every other case's
   survivor is a Bystander, which cannot distinguish "filtered on `OwnerType` and forgot `OwnerId`" for
   the Bystander flow itself — that predicate would delete the survivor and pass nothing else. One case
   in the file therefore seeds two Bystanders of the same type. The general lesson: **a shared survivor
   of type X cannot guard the flow that deletes an X.**

---

# 20. Index and query shape

**One index, exactly as §2.7 proposes, and no second one.**

```
HasIndex(e => new { e.OwnerType, e.OwnerId, e.Name }).HasDatabaseName("idx_custom_moves_owner_name")
```

Verified fit: the name matches `idx_resource_images_owner_sort` (`MotwDbContext.cs:522-523`) and the
project's `idx_<table>_<cols>` convention; `Name` belongs in it because all four existing repositories order
by it (`MonsterRepository.cs:248`, `MinionRepository.cs:193`, `LocationRepository.cs:107`,
`BystanderRepository.cs:106`), so the list read is a seek that arrives already ordered; and it is correctly
**not** unique — none of the five existing tables has a unique constraint on name, and nothing says two
moves cannot share one.

It also serves `DeleteAllForOwnerAsync` and, as a two-column prefix, the `(OwnerType, OwnerId, Id)` lookups
in `UpdateAsync`/`DeleteAsync`. **Do not add a second index on `(OwnerType, OwnerId, Id)`** — at this
table's size the prefix seek plus a filter is free, and a second index is a write cost for nothing. Stated
because "the update path has no index" is the kind of thing a later reader adds without measuring; put that
sentence in the config comment, not only here.

**Five single-column FK indexes go, one three-column index arrives.**
`IX_monster_custom_moves_monster_id` and its four siblings (§21.2) are EF-default FK indexes from
`InitialCreate`, and they go with their tables.

**Column naming is not automatic.** There is no `UseSnakeCaseNamingConvention` anywhere; every column in
`MotwDbContext` carries an explicit `.HasColumnName` (see `:256-264` for `monster_custom_moves`). The new
config must spell out all five column names, or EF emits PascalCase columns and the migration bakes them in.

---

# 21. Migration mechanics

## 21.1 Phase 1 — `AddCustomMoves`

The generated shape, pinned against `20261005034116_AddResourceImages.cs:38-58` so it can be reviewed
against an existing file rather than against an idea:

```
custom_moves
  id           uuid                   not null   -- PK "PK_custom_moves"
  owner_type   character varying(16)  not null   -- HasConversion<string>().HasMaxLength(16)
  owner_id     uuid                   not null
  name         character varying(255) not null
  description  text                   null
idx_custom_moves_owner_name  on (owner_type, owner_id, name)
```

No foreign keys — that is §2.3's trade-off, and the config should carry the same kind of comment
`MotwDbContext.cs:490-497` already carries for `resource_images`, pointing at §2.3 and §2.8 so that both
"why is there no FK" and "why are there two owner-type enums" answer themselves at the site. §3.1 already
asks for the second; the first matters more, because it is the one a later reader would try to "fix".

`Down` is one `DropTable`. Nothing else belongs in this migration, and §5's *"creates `custom_moves` and
touches nothing else"* is achievable exactly — no existing table gains a column, unlike `AddResourceImages`,
which also added four `primary_image_id` columns.

**Scaffolded as `20261011180029_AddCustomMoves`, and the generated `Up` is the table above and nothing
else** — one `CreateTable` with those five columns and `PK_custom_moves`, one `CreateIndex` for
`idx_custom_moves_owner_name`, no `AddForeignKey`, and a one-call `Down`. Nothing was hand-edited. The
pinned shape earned its keep in the usual quiet way: it turned reviewing the scaffold into a comparison
rather than a judgement, and the thing it was really guarding — the five explicit `.HasColumnName` calls,
without which EF emits PascalCase columns and the migration bakes them in — is invisible in a generated
file that already looks right. Confirmed on the real server, not only in the file; see B5.

## 21.2 Phase 3 — `DropPerDomainCustomMoves`

Five `migrationBuilder.DropTable` calls take the primary keys, foreign keys and indexes with them, so the
`Up` is five lines. The exact names, read from the two migrations that created them
(`20260719163240_InitialCreate.cs:211-512`, `20260726000551_ExtractMinionsToOwnTable.cs:157-303`), so a
hand-check of the scaffolded output has something to compare against:

| Table | PK | FK | Index |
|---|---|---|---|
| `mystery_custom_moves` | `PK_mystery_custom_moves` | `FK_mystery_custom_moves_mysteries_mystery_id` | `IX_mystery_custom_moves_mystery_id` |
| `monster_custom_moves` | `PK_monster_custom_moves` | `FK_monster_custom_moves_monsters_monster_id` | `IX_monster_custom_moves_monster_id` |
| `minion_custom_moves` | `PK_minion_custom_moves` | `FK_minion_custom_moves_minions_minion_id` | `IX_minion_custom_moves_minion_id` |
| `location_custom_moves` | `PK_location_custom_moves` | `FK_location_custom_moves_locations_location_id` | `IX_location_custom_moves_location_id` |
| `bystander_custom_moves` | `PK_bystander_custom_moves` | `FK_bystander_custom_moves_bystanders_bystander_id` | `IX_bystander_custom_moves_bystander_id` |

Note the index prefix is `IX_`, not `idx_` — these predate the `idx_` convention, so a reviewer hunting for
`idx_` names will not find them and should not "fix" them.

The scaffolded `Down` recreates five empty tables. **Leave it exactly as generated.** Under decision 1 the
data is expendable, so a `Down` that restores structure and no rows is the correct and only possible answer,
and hand-editing it to throw would make the migration irreversible in a way EF's tooling does not expect.

**Is it safe to author now?** Safe to author **in Phase 3 and only in Phase 3** — B6. The constraint is not
EF's ordering, which is correct by timestamp, but `MigrateAsync()` at startup: a drop migration present in
the tree during Phase 2 is applied the next time anyone runs the dev server, against code that still reads
the five tables. Scaffold it after the entities and configs are deleted, from
`src/api/MonsterOfTheWeek.Api` (the only directory where the `Design` package resolves), and verify the
generated `Up` against the table above before committing.

---

# 22. The enum, the string conversion, and Swagger

**§2.8 is right and I am not re-opening it.** Verified the premise rather than inheriting it:
`ResourceOwnerType` (`DomainEntities.cs:372-378`) has exactly four members; its in-file comment says it is
the discriminator for `ResourceImage.OwnerType`; and `ResourceImageService`'s `OwnerExistsAsync`,
`GetExplicitPrimaryImageIdAsync` and `SetPrimaryImageIdAsync` (`:207`, `:217`, `:233`) each end in
`_ => throw new ArgumentOutOfRangeException`. Adding a `Mystery` member would make all three reachable from
a compiling route. The second enum is the cheaper mistake.

**The string conversion has exactly one precedent, and that precedent documents itself as a first.**
`MotwDbContext.cs:504-505` — *"This is a new pattern for this codebase — no other entity uses
`HasConversion` today — so it is a deliberate first, not an inherited convention."* Verified by grep:
`HasConversion` appears **once** in the whole model. So `custom_moves.owner_type` is the **second** such
column, and `.HasConversion<string>().HasMaxLength(16)` becomes a precedent rather than a first — which is
worth a word in the new config's comment, and worth **amending the old one**, because *"no other entity uses
HasConversion today"* goes false the moment this lands and will otherwise mislead the next reader at the one
site that exists to explain the choice. `Bystander` at 9 characters fits 16 comfortably; §2.8's arithmetic
is right.

**Swagger, measured.** Today: 8 custom-move path templates / 16 operations, tagged by domain controller
(§16.2). After Phase 2: **2 templates, 4 operations, tag `CustomMoves`**, with `owner` emitted as a plain
`string` path parameter and **no enum** — Swashbuckle cannot see a route constraint. §2.12 item 4 is
therefore accurate, with one correction: Swagger is Development-only (`Program.cs:179-183`), so this is a
developer-ergonomics loss, not an API-contract loss.

**Re-measured off the running app after Phase 2 landed, and the prediction holds exactly:**

```
/api/{owner}/{ownerId}/custom-moves            GET  POST     tags=CustomMoves  owner:string  ownerId:string/uuid
/api/{owner}/{ownerId}/custom-moves/{moveId}   PUT  DELETE   tags=CustomMoves  owner:string  ownerId:string/uuid  moveId:string/uuid
```

2 templates, 4 operations, tag `CustomMoves`, `owner` a plain `string` with **no `enum`** — so the
discoverability loss is real and is exactly the size stated. The whole document also went **84 → 78 path
templates**, which is `84 − 8 + 2` and is an independent check on §16.2's count of 8 being right.
**Recommendation unchanged: accept the loss, do not build the filter.** Measured rather than left as a
prediction because §16.2 had one row that a running server disagreed with, and a document that corrects a
measurement in one place should not leave an unverified number in another.

**If it ever bites, the cure is small and additive.** `AddSwaggerGen()` is registered bare at
`Program.cs:26` with **no filters of any kind** today, so a ~15-line `IOperationFilter` setting the `owner`
parameter's `Schema.Enum` from the same five strings would be the project's first filter.
**My recommendation: accept the loss in Phase 2 and do not build the filter.** Four operations with one
templated segment and a drift-guarded constraint is not a discoverability problem worth a new infrastructure
pattern in a phase whose point is subtraction. Recorded here so the option sits on the shelf rather than
being rediscovered.

---

# 23. Test strategy for Phases 1–3 — what §10 misses

§10's plan is sound. Six additions, in the order I would write them.

1. **The constructor sweep is Phase 1's first commit, on its own, and it is the bulk of the test-tree
   diff.** B1, §16.4 D1. **Commit 1:** one private factory per test file (67 sites → **8** factories across
   seven files; see B1's correction) plus the `PostgresCollection` rename (§16.4 D2) — **zero new types,
   zero production files**, so the gate is "suite green with no test-name and no assertion changes, and
   `git diff --stat` shows nothing under `MonsterOfTheWeek.Api/`". A provable no-op, the same discipline §5
   applies to 5f-0. **Commit 2:** `FakeCustomMoveService` with the ledger of
   `FakeResourceImageService.cs:17` but **not** its hardcoded returns (see item 5 and B1), the `Program.cs`
   registration, the three harness registrations, and one new argument through each factory. The order is
   forced, not stylistic: the fake implements an interface commit 2 introduces.
   **Both landed, `619be92` and `64e9826`, with both gates met;** the three places commit 2 diverged from
   this plan are in B1.
2. **`MonsterMinionCascadeTests` needs four changes, including the detach complement.** B11. §10 asks for
   the seed; the detach half, the before-assertion and the surviving-third-owner count are the parts that
   make it a guard rather than a decoration. **All four landed in `d87974b`**, and the detach test was
   renamed to `DetachingAMonsterFromOneMystery_LeavesItsMinionsAndCustomMovesAloneEverywhere` so the name
   carries the second fact rather than hiding it.
3. **The drift guard should be three assertions, not one.** B12 — route↔dictionary, dictionary↔template,
   and enum↔service `switch`. The third is the half R7 cannot see.
   **Landed as `CustomMoveOwnerDriftTests` in `52cc63b`, with one mechanical detail worth recording:** it
   reads the segment dictionary **by reflection** rather than by widening the field. There is **no
   `InternalsVisibleTo` anywhere in this solution** — grepped — so adding one would be a project-wide
   pattern for the benefit of one test, and a `public` dictionary on a controller is production surface
   existing only for a test. Same reasoning as D4's: prefer the test-local cost to the new project-wide
   pattern. Assertion 2's own regex reads the `^...$` back, so it fails on an unanchored template too —
   which it did, when I checked (item 7).
4. **The endpoint test must include a mixed-case segment.** B2. `/api/MONSTERS/{id}/custom-moves` → `200`
   is shipped behaviour and the unified controller is one dictionary comparer away from breaking it. Add it
   to the five-segment matrix rather than as a separate test — the matrix is where someone will look.
   **Landed in the matrix, three casings, and confirmed still `200` against the real host.**
5. **`CustomMoveServiceTests`, SQLite-backed, mirroring `ResourceImageServiceTests`**, and specifically
   covering the four cases that are *behaviour* rather than plumbing: owner missing → `NotFound` on `List`
   and `Create`; a mismatched pair (a Bystander's id with `OwnerType.Monster`) → `NotFound` on `Create`
   **and nothing inserted**; a move id belonging to owner A → `NotFound` through owner B's arguments on
   both `Update` and `Delete`, which is §2.5's closing guarantee and the predicate is the only thing
   producing it; and `OrderBy(Name)` preserved, because the switchover's whole claim to being a refactor is
   that the four existing orderings survive. `FakeCustomMoveService` must mirror those return semantics and
   **not** return hardcoded success where the real service returns `NotFound` —
   `toad-fake-repositories-must-mirror-real-return-semantics.md`, which §10 already cites.
   **Landed in `64e9826` with four cases this list did not ask for and should have:** one per enum member,
   because `OwnerExistsAsync` is a five-arm `switch` whose wrong arm compiles and whose `_ =>` arm throws;
   the owner-present-with-no-moves case, which is the *other* half of "owner missing → `NotFound`" and the
   only thing that makes that check worth its round trip; `DeleteAllForOwnerAsync` with three owners
   seeded and one cleaned, per B-R11; and the no-op cleanup for an owner with no moves, which is the case
   that catches a cleanup throwing on a missing owner and turning an ordinary Phase 2 delete into a 500.
   The drift guard (item 3) and the five-domain parity test (item 6) stayed out, as Phase 2 items guarding
   Phase 2 code.
6. **A five-domain *backend* parity test, with `ListProjectionPrimaryImageAgreementTests` as the model.**
   §10 and Phase 6 put the parity guard on the frontend only. There is an equivalent backend drift surface:
   five services, each independently calling `ListForProjectionAsync` with its own `CustomMoveOwnerType`
   literal, in a method nothing else cross-checks. A monster service passing `CustomMoveOwnerType.Minion`
   compiles, passes every monster test that does not seed a custom move, and returns the wrong rows. That
   is exactly the class of bug `ListProjectionPrimaryImageAgreementTests` was written for — its own doc
   calls itself *"Phase 4's guard against the two implementations drifting"* — and the shape transfers: seed
   one custom move per owner type against one SQLite context, call all five `GetByIdAsync`
   implementations, assert each detail response carries **its own** move and not another's. Five seeds, one
   context, one test. **This belongs in Phase 2, not Phase 6** — it guards backend code, and Phase 2 is
   where that code lands.
   **Landed as `DetailProjectionOwnerAgreementTests` in `52cc63b`**, with two refinements worth keeping.
   (a) Each move is **named for its owner** (*"Monster Move"*, *"Minion Move"*, …) rather than seeded
   anonymously, so a wrong literal reports *which* arm is wrong instead of only that a count is off.
   (b) It carries a second test for Mystery's `CreateAsync` returning `[]` and its `UpdateAsync` reading
   them back — because the `[]` shortcut (B3) is correct only as long as `CreateAsync` stays the last
   step, and nothing else in the suite would notice if it stopped being.
   **And one thing worth stating plainly: this guard protects against a bug the nav property made
   impossible.** Before Phase 2 a projection could not return another owner's rows; after it, one wrong
   enum literal does, and compiles. So this is not a guard the rework inherits — it is one the rework
   creates the need for, which is a real (small) cost of the single-table shape and should be counted as
   one rather than presented as free diligence.

7. **A seventh item, added at Phase 2 because it is the only reason items 3 and 4 are known to work:
   mutate the two load-bearing one-token details and watch the tests fail.** Both were applied to the
   real tree, measured, and reverted:

   | Mutation | What failed |
   |---|---|
   | `OrdinalIgnoreCase` → default comparer | **2 failures** — `MixedCaseSegments_StillResolve_AndStillWrite` at `MONSTERS/CUSTOM-MOVES` and at `Monsters/Custom-Moves` |
   | `^(…)$` → `(…)` (anchors removed) | **2 failures** — `UnknownOwnerSegment_Is404_AtRouting(segment: "xmonstersx")` *and* `TheDictionarysKeysAreExactlyTheSegmentsInTheRouteTemplate` |

   This is the item that turns B2, B-R2, B-R3 and B12 from assertions about the code into assertions about
   the tests. Both mutations **compile**, both are one token, and both are invisible in review — which is
   the entire argument of those four entries, and an argument that is worth nothing if the tests that
   discharge it have not been seen to fail. Thirty seconds each.

   **Done for Phase 3's five drop-table names too, and it found something the recommendation had not
   anticipated: the two ways to get a `DropTable` wrong have completely different blast radii.**

   | Mutation to `DropPerDomainCustomMoves.Up` | Failures |
   |---|---|
   | **Typo** one name (`monster_custom_moves` → `monster_custom_movez`) | **All 7** Postgres tests — every one replays the history on a fresh database, so `MigrateAsync()` throws at the server and takes the whole gate with it |
   | **Omit** one `DropTable` call entirely | **1 of 7.** The migration *succeeds*. The table quietly survives. Only `The_five_per_domain_custom_move_tables_are_gone` fails, with `Collection: ["monster_custom_moves"]` |

   **The second row is why B5's third test had to exist, and a typo check alone would have missed it.** A
   typo is loud because the server rejects it; an omission is silent because nothing rejects it — the
   migration is valid, it just does less than it claims. Before that test, nothing in the suite would ever
   have looked at whether the tables were actually gone, which is the one fact the whole commit is for.
   **Generalisable: for a destructive migration, test the post-state by name, not only that the migration
   applied.** "It ran" and "it did what it said" are different assertions, and only the first is free.

**One thing §10 gets exactly right and is worth not losing:** `MonsterServiceTests.cs:331-341`'s reflection
table over `UpsertCustomMoveRequest` keeps asserting the annotations through the unification, and
`MinionReparentEndpointTests.cs:93` becomes a free regression on the new shape — a reparented minion's moves
follow because `OwnerId` is unchanged, where today they follow because the FK is. Both verified. The
`MinionReparentApiHarness` seed rewrite and DI registration are the price (B7 item 5).

---

# 24. Backend risks (Bowser)

Numbered B-R to sit beside §7's R1–R14 and §14's 14-R1–14-R10 without colliding.

**Closed out at the end of Phase 3.** Each row now carries what discharged it, in italics, ahead of the
risk itself — so the table reads as a record rather than as a standing warning list, and so a row that is
*not* discharged is visible by its absence of a note. Of the fourteen: **eleven discharged**, one
(B-R8) was a "record the real surface" item and the surface is recorded, one (**B-R12**) is deliberately
still open because it is a prediction about a future reader rather than a task, and one (**B-R14**) is an
environment hazard that is never discharged, only avoided — it did not bite in any of the three phases.

| # | Risk | Mitigation |
|---|---|---|
| B-R1 | *(Discharged. Phase 1 landed the three registrations, and Phase 2's extended cascade test passed first time — the outcome this entry asked for.)* **A harness missing `ICustomMoveService` is a request-time 500, not a build error** — and the first test it breaks is §2.4's cascade test, which will read as a cascade bug. | B1. Land the registrations and the constructor sweep in **Phase 1**, suite green with no assertion changes, so Phase 2's diff is behaviour only. `Program.cs:38-41` already says why this failure mode is special; repeat the sentence. |
| B-R2 | *(Discharged, and the test seen to fail — §23 item 7.)* **An ordinal segment dictionary turns `/api/MONSTERS/{id}/custom-moves` from `200` into a 500.** Shipped, reachable, invisible in review. | B2. `StringComparer.OrdinalIgnoreCase`, a comment naming what it preserves, and a mixed-case case in the endpoint matrix. |
| B-R3 | *(Discharged, and the test seen to fail — §23 item 7, where the unanchored mutant broke the endpoint matrix **and** the drift guard.)* **An unanchored inline regex silently accepts `xmonstersx`** — proven, and identical-looking in review. | §17.1 probe B. The `^(...)$` anchors, plus the drift test, which parses the template back and therefore reads the anchors. |
| B-R4 | *(Discharged, and the arithmetic measured: excluding the two generated files, Phase 3 is +271/−500, net −229; including them, +3,093/−705, net +2,388 — unmeetable exactly as predicted. See B4.)* **Phase 3's diff gate is unmeetable as written**, so it will be waived in practice and stop gating anything. | B4. Restate as net-negative **excluding** `Data/Migrations/*.Designer.cs` and `MotwDbContextModelSnapshot.cs`. |
| B-R5 | *(Discharged. Run and recorded at all three phases — see B5. The default outcome is still *Skipped*, which is the point.)* **The real-Postgres gate reports *Skipped*, not *Failed*** — so a broken migration passes `dotnet test` and is found at deploy, which is the exact gap `PostgresFactAttribute` exists to avoid being silent about. **Confirming the intent to run it does not change the default outcome.** | B5, §16.4 D3. The runs are confirmed and §5's gates stand, so the fallback is withdrawn — but put the literal command in both gates (`docker compose up -d postgres`; `MOTW_TEST_POSTGRES` at a throwaway database; `dotnet test --filter "Category=Postgres"`) and have each phase's checklist **record** the run, not merely require it. |
| B-R6 | *(Discharged. `CustomMoveMigrationPostgresTests` carries `[Collection(PostgresCollection.Name)]` and now holds three tests, all inheriting it by living in the class.)* **A second Postgres-gated class outside the shared collection drops the other's database mid-run** — already caught once, per that file's own comment. | B5, §16.4 D2. `[Collection(PostgresCollection.Name)]` on the new class, after Phase 1's first commit renames it. |
| B-R7 | *(Discharged as far as a document can: it is in the Phase 3 gate, in `81f5960`'s commit message, and in this section's banner. The merge still is the migration.)* **Phase 3's drop is applied by deploying**, because `MigrateAsync()` runs at startup. Someone will read "isolated commit" as "not yet applied". | B6. Say it in the gate. Do not author the drop migration before Phase 3 — in the tree during Phase 2 it drops the tables on the next `dotnet run`. |
| B-R8 | *(Recorded as asked — the real surface is in the XML doc on `MonsterService.GetByIdAsync`, not only here, and `MysteryService.CreateAsync` passes `[]` with its reason at the site.)* **The extra projection query lands on sixteen create/update responses, not five detail loads**, so §2.6's budget is understated and the first person to profile will think something is wrong. | B3. Record the real surface. `MysteryService.CreateAsync` passes `[]`; the other four share `GetByIdAsync` and should not be split to save an empty index seek. |
| B-R9 | *(Discharged by `DetailProjectionOwnerAgreementTests`, `52cc63b`.)* **A domain service passes the wrong `CustomMoveOwnerType` literal.** Compiles; passes every test that does not seed a custom move; returns another owner's rows. | §23 item 6 — a five-domain backend parity test in Phase 2, modelled on `ListProjectionPrimaryImageAgreementTests`. |
| B-R10 | *(Discharged. `IMysteryRepository.BeginTransactionAsync` and the transaction landed in `d87974b`.)* **Without a transaction, Mystery's cleanup-then-delete destroys user data on a partial failure** rather than leaking a row — the opposite direction from the bug the cleanup exists to fix. | B10. Add `BeginTransactionAsync` to `IMysteryRepository`, matching the four. |
| B-R11 | *(Discharged. Every case in `OwnerDeleteCleanupTests` seeds a survivor through one shared helper, so it cannot be honoured in four cases and forgotten in the fifth — §19.)* **`DeleteAllForOwnerAsync` with a mis-wired predicate deletes every owner's moves**, and a count-to-zero assertion on a single-owner fixture cannot see it. | §19 — seed a second owner whose moves must survive, in every per-domain cleanup test. |
| B-R12 | *(Still open by design — it is a prediction about a future reader, not a task. The sentence is at the config site as asked.)* **A later reader adds an `(owner_type, owner_id, id)` index** because "the update path has no index". | §20 says explicitly not to, with the reason. Put that sentence in the config comment, not only in this doc. |
| B-R13 | *(Discharged in `64e9826`, both comments.)* **`MotwDbContext.cs:504-505`'s comment becomes false** the moment `custom_moves` lands — it says no other entity uses `HasConversion`. A stale comment at the one site that exists to explain a deliberate first. | §22. Amend both comments in Phase 1, in the same commit that adds the second conversion. |
| B-R14 | **The build cannot run while the dev server holds `bin/`**, and the documented workaround is the forbidden one. Third occurrence in this project, including the planning session. | `README.md:58-75`. Stop the dev server; never `--artifacts-path`. Reconfirmed at planning time: 184 failures out of 619, mechanism exactly as the README describes. **Not present at Phase 1** — nothing was listening and no `MonsterOfTheWeek.Api.exe` existed, so every build and run in Phase 1 was in-tree and clean. The 184 is an artifact of the workaround, not a property of the suite (§16.1). |

---

# 25. Questions — answered

**All three answered by Skyler, 2026-10-11. None was blocking; Phases 1–3 can start.** Recorded as
§16.4 D1–D3. The questions are kept with their reasoning rather than deleted, because the *reason* each was
a question is what makes the answer checkable — the convention §6.4 already uses.

**Q1 — Should Phase 1's constructor-and-registration sweep be its own commit?** §5 is one commit per phase.
B1's sweep is ~70 mechanical edits across ten test files with zero behaviour change, and it would dominate
Phase 1's diff and bury the entity, the config, the migration and the service. My recommendation was **two
commits inside Phase 1** — the sweep first, as a provable no-op, then the feature — the same argument §5
makes for splitting Phase 2 from Phase 3 and 5f-0 from 5f-1.

> **Answered: yes.** *"Two commits is fine. I've just moved to a new branch to support all of this
> ('custom-moves')."*

**What that forced, which the question had not anticipated.** With two commits real, the *order* stops
being a preference and becomes a constraint: `FakeCustomMoveService` implements `ICustomMoveService`, and
the `Program.cs` and harness registrations name a type that does not exist until the feature lands — so the
first commit can contain **only the part that introduces no new types**. That is exactly the 67-site
extraction, which makes it a stricter no-op than I had proposed (zero production files touched at all) and
turns commit 2's test-tree cost into seven one-argument edits. B1 carries the split; §23 item 1 carries the
two gates. This is the only deviation from §5's *"one commit per phase"* anywhere in Phases 1–3.

**Q2 — Rename `ResourceImagePostgresCollection` to a neutral `PostgresCollection` in Phase 1?** One
`const`, two attribute references, zero behaviour — and it stops a custom-move migration test having to
join a collection named *"Resource Image Postgres tests"*. The alternative was to join it with a comment
explaining the name: a smaller diff and a worse name.

> **Answered: yes.** *"Yes, renaming is fine."*

It lands in Phase 1's **first** commit rather than the second, for the same reason the extraction does:
test-only and behaviour-free, so it belongs in the commit whose gate is "nothing under
`MonsterOfTheWeek.Api/` changed". Doing it there also means the new `CustomMoveMigrationPostgresTests` is
never written against the old name and then edited (B5, B-R6). The `const Name` **value** changes with the
class — *"Resource Image Postgres tests"* → *"Postgres tests"* — since that string is the collection's
identity in test output, and leaving it would reproduce the exact confusion the rename removes.

**Q3 — Is the manual real-Postgres run actually going to happen at Phase 1 and Phase 3?** It is the only
gate in the plan that cannot be satisfied by `dotnet test`, the only thing that executes a migration
anywhere in this repo, and Phase 3's migration is the irreversible one. If the honest answer had been
"probably not", I would have proposed something cheaper — asserting each migration's generated SQL against
a committed snapshot via `dotnet ef migrations script`, which needs no server at all.

> **Answered: yes.** *"Yes, we can run the migration during each phase it's needed in."*

**So §5's Phase 1 and Phase 3 gates stand exactly as written, and the snapshot fallback is withdrawn.** I
am glad not to need it: `migrations script` would have proved the *generated SQL* and not the server's
acceptance of it, and for a migration that drops five tables the second is the half that matters.

**What this answer does not change, and B5 keeps saying so.** The commitment to run it does not alter the
default outcome: `PostgresFactAttribute:23-31` still sets `Skip` when `MOTW_TEST_POSTGRES` is unset, so a
plain `dotnet test` still reports both gates as *Skipped* rather than failed. The literal command therefore
still belongs in both gates, and each phase's checklist should **record** the run rather than merely
require it — a gate whose default reading is "skipped" is a gate that gets forgotten by the next person,
not by this one.

---
---

# 26. The frontend implementation pass

**Prepared by:** Luigi (Frontend)
**Date:** 2026-10-11
**Status:** Implementation specifics and gap-finding for Phases 4–6, plus **Phase A** (§34), which runs
ahead of Phase 1. **Appended to §§0–25, which are unchanged** — including Bowser's own 2026-10-11
amendment of §§16–25. Where I think something above is wrong I say so in §26.2 rather than editing it.
Skyler's four answers are recorded as §33.1 **L-D1–L-D4** and folded into the sections they govern. **No
production code written or modified, nothing committed.** The only file I touched in this repo is this one.

**Grounding — read this session, not inherited from §§0–25.** Globbed the whole repo tree first
(`src/`, `docs/`, `tools/`, `prototypes/`), then the whole `src/web/.../src/app` tree (106 spec files,
every feature directory), rather than trusting any inventory above. Read in full: `core/api.ts`,
`core/resource-images.ts`, `core/http-context-tokens.ts`, `core/self-handled-request.ts`,
`core/http-error-interceptor.ts`, `core/notifications.ts`, `core/monster.ts`, the custom-move and
owner-type regions of `core/models.ts`, `app.config.ts`; all five `*-detail.{ts,html}`; all four
`*-create.{ts,html}`; `monster-detail.spec.ts`, `location-detail.spec.ts`,
`location-detail.images.spec.ts`; `shared/resource-images-card.component.{ts,html}`,
`shared/resource-images.store.ts`, `shared/confirm-delete-modal.component.ts`,
`shared/confirm-delete-modal.call-sites.spec.ts`, `shared/escape-nesting.spec.ts`,
`shared/resource-images-four-domain-parity.spec.ts`, `shared/icons/icon.component.ts`,
`styles.css`'s `.action-btn` and breakpoint blocks; `sub-resource-diff.ts` in full;
`mystery-create.store.ts`'s drafts, previews, dirty checks, composer transfer sites, `next()`,
`submitPhase0`–`submitPhase3`, `saveMonsterDraft`, `writeBackMonsterDrafts`, `saveThreatCollections`,
`saveMinionCollections`, the four `monster*Service` adapters, `attachMonster`, `hydrateMonsterDraft`,
`attachLocation`, `removeLocationDraft`, `phases`, `stepTitle`, `currentSectionIcon`,
`phaseStepComplete`; `hydrate-monster.ts`; `mystery-create.html`,
`mystery-create-mystery-phase.html`, the composer and attach-strip regions of
`mystery-create-monster-phase.html` and `mystery-create-locations-phase.html`,
`mystery-create-dossier.html`; `mystery-create-phase4-ledger.spec.ts` and
`mystery-create-phase5a-ledger.spec.ts` (their ledger machinery and the tests 5f touches);
`.squad/agents/Luigi/history.md`; all three inbox decision records; `angular.json`, `package.json`.
Also read Angular 22's own `_module-chunk.mjs` to settle how `HttpClient` resolves in `TestBed`.

**Also run, not read:** the full frontend suite (§26.1). I started no dev server; two were already
listening when I arrived (§26.1).

> **The pass, in five sentences.** The structure in §§13–15 and the phasing in §5 are right and I am
> re-opening none of §8.1's fourteen decisions. The single largest unbudgeted item is that **R14's
> unmount hazard is not specific to `mystery-detail`** — all five detail templates put
> `@else if (errorMessage())` ahead of the content branch, and `monster-detail.ts`'s `runAndRefresh`
> sets `errorMessage` on every sub-resource failure, so the bug R14 describes as a *risk* for Mystery
> is **already live** on Monster and Minion, with that page's own spec proving the correct rule on a
> neighbouring code path. The second largest is that **`resource-images-four-domain-parity.spec.ts` is a
> fourth cross-cutting census guard** that R12 does not list and that R13's migration makes fail by
> construction, and **two shipped specs pin the read-only Custom Moves block as if its absence were
> required** — three spec changes in 5c/5d that §§9–11 name nowhere. Rosalina deliberately left me the
> card's event signatures: it is **five inputs and three outputs**, not her 5-and-4, because
> `editRequested`/`editCancelled` collapse into a two-way `[(editingKey)]` exactly as the carousel's
> `activeImageId` already does, which removes a handler from all nine call sites (L-D1). And the
> wizard's two "cheap" claims both need a number attached: 5f-0 **is** a provable no-op but only
> because both ledger specs sort their call lists, and 5f-2's "nearly free" monster/minion work touches
> twelve sites per owner of which **five are silent on omission** — including `monsterComposerDirty`,
> where the omission silently discards a composer holding only a custom move.
>
> **Sixth sentence, added once Skyler had answered (§33.1).** The unmount defect stops being a
> follow-up and becomes **Phase A** (§34): eight deleted lines across two methods on each of two pages,
> ahead of Phase 1 and depending on nothing in it — which also means 5a inherits a page family where the
> rule already holds, so the custom-move write pipeline is the normal case rather than a divergence
> needing a comment.

---

## 26.1 Baseline, verified

| | Verified value | How |
|---|---|---|
| Angular | 22.0.7, zoneless, TypeScript ~6.0.2, Vitest 4 via `@angular/build:unit-test` | `package.json`, `angular.json:82-84` |
| Frontend suite | **106 spec files, 1467 tests, 0 failures** | `npx ng test`, this session |
| `customMoves` in specs | **23 spec files, 31 occurrences, every one the literal `customMoves: []`** | grep; §26.2 L14 |
| Custom-move assertions | **zero** — grep for `customMoves` excluding `customMoves: []` across all `*.spec.ts` returns nothing | confirms §1.4 and §10 |
| Non-spec `customMoves` references | three: `core/models.ts`, `location-detail.html:55-64`, `bystander-detail.html:55-64` | grep |
| Card call sites after 5e | **nine** — five detail pages, four create pages (Rosalina's figure, confirmed) | — |
| Dev servers | `:4200` and `:5225` were **already listening** when this pass started — §16 says in as many words that the API was left up. I started neither. | `netstat` |

**On the suite being the oracle.** 1467 green is the number every frontend phase gate below is measured
against, and it is worth saying that the suite is fast enough to be used that way: 15.9s for the whole
thing. There is no reason for any sub-phase to run less than all of it.

**A `TestBed` fact that changes how the specs below are written, and which I checked in Angular's own
source rather than assuming.** `HttpClient`, `HttpHandler` and `HttpBackend` are all
`providedIn: 'root'` in Angular 22 (`@angular/common/fesm2022/_module-chunk.mjs:1346-1352`, `:1192-1199`,
`:1093-1100`), with `HttpBackend` defaulting to `FetchBackend`. So:

- **Injecting `CustomMoveService` into a detail page does *not* break a spec that fails to stub it.**
  There is no `NullInjectorError`; this is why `monster-detail.spec.ts` renders a page that injects
  `ResourceImagesStore` → `ResourceImageService` without providing either.
- **But an unstubbed call issues a real `fetch`** to a relative URL under jsdom, which rejects
  asynchronously. So the hazard is not a failure at construction, it is noise and flake at write time.
  Every spec that *exercises* the card must stub `CustomMoveService`; specs that only render it need not.
  That distinction is what keeps 5a–5e from touching all 23 fixture files.
- Note also that the app installs XHR implicitly (`provideHttpClient` with no `withFetch()`,
  `app.config.ts:24`) while a bare `TestBed` gets `FetchBackend`. Irrelevant here — no custom-move call
  needs upload progress — but it is the kind of difference that has bitten this feature's neighbour.

---

## 26.2 Gaps, ranked by what would actually bite

Ordered by cost-if-missed. Each is verified against the code; recommendations are marked as mine.

### L1 — R14's unmount hazard is not Mystery's. It is all five pages, and it is already live on two of them. *(The biggest item in Phases 4–6.)*

R14 and §4.1 item 4 present "setting `errorMessage` on a failed write unmounts the page" as a hazard
`mystery-detail` would newly introduce, mitigated by `location-detail.ts`'s precedent. Both halves are
true and the scope is wrong twice.

**Verified, by reading all five templates.** Every one of them opens with the same three-branch chain:

| Template | Lines | Branch order |
|---|---|---|
| `monster-detail.html` | `:4-8` | `isLoading` → **`errorMessage`** → `monster()` |
| `minion-detail.html` | `:4-8` | `isLoading` → **`errorMessage`** → `minion()` |
| `location-detail.html` | `:4-8` | `isLoading` → **`errorMessage`** → `location()` |
| `bystander-detail.html` | `:4-8` | `isLoading` → **`errorMessage`** → `bystander()` |
| `mystery-detail.html` | `:4-8` | `isLoading` → **`errorMessage`** → `mystery()` |

So the mechanism R14 names is a property of the page family, not of Mystery.

**And it is already reachable on Monster and Minion.** `monster-detail.ts`'s `runAndRefresh` (`:399`) is
the pipeline behind every power/armor/weakness create and every sub-resource delete on that page, and its
error arm is `this.errorMessage.set(errorMessage)` (`:425`). With `isLoading` false, that puts the second
branch in front of the content branch: **a failed "Delete power" replaces the whole monster with the line
"Unable to delete power."** `createAttack` (`:248`) has its own subscribe and does the same thing at
`:288`. `minion-detail.ts:345` and `:194` are the twins. (Derived from the branch order, which is
unambiguous — an `@if`/`@else if` chain renders its first match — and from the same mechanism R14 asserts
for Mystery. Not measured against a running app.)

This is not a guess about intent — the same page knows the rule and states it twice:

- `monster-detail.ts:460-464`, on the images section: *"an image failure stays inside the section rather
  than touching `errorMessage`, which would unmount the page."*
- `monster-detail.spec.ts:236-247`, `it('5b-L1: a membership failure is a success with a caveat, and the
  form stays mounted')`, asserting `errorMessage()` is `null` with the comment *"`errorMessage` would
  unmount the form, leaving nothing to retry into."*
- `location-detail.ts:135-137` states it a third time for the membership caveat, naming the custom-moves
  list among what gets unmounted.

Three independent records of the rule, and the four sibling sub-resource panels break it.

**My recommendation, and it is the one decision in this pass I would most resist being talked out of:**

1. **Custom-move writes never set `errorMessage`, on any of the five pages.** The failure surface is the
   toast, plus the card's own `busy` clearing. This is §4.1 item 4 generalised from one page to five —
   and generalising it is what makes the five hosts *identical*, which is the precondition for Phase 6's
   parity guard having anything to compare (§31.3).
2. **Do not reuse `runAndRefresh`.** Add a sibling — I would call it `runCustomMoveWrite` — that is
   `runAndRefresh` minus the two `errorMessage.set` lines, with a comment pointing at this section. A
   two-line divergence from a method three lines away is going to look like an oversight to a reviewer,
   so the comment is load-bearing, not decoration.
3. **Fix the pre-existing defect first, as a pre-step — decision L-D4, §34.** I originally proposed
   flagging it and leaving it as a follow-up, on the grounds that it changes shipped behaviour on four
   collections across two pages. **Skyler reversed that and I think he is right:** *"I do think we should
   fix this now; do it first as a pre-step to the first documented phase… The behavior change is not a
   big deal, and I would rather it be resolved for the upcoming work."* It becomes **Phase A** (§34),
   which runs ahead of Phase 1 and depends on nothing in this plan — it touches no custom-move code at
   all. The practical gain beyond correctness: 5a then *inherits* a page family where the rule already
   holds, so `runCustomMoveWrite` is the normal case rather than a two-line divergence anyone has to
   justify.
4. **Gate it.** The 5a gate should assert, per page, that a failed custom-move write leaves the entity
   heading rendered and `errorMessage()` `null`. §5's 5e gate already asks for exactly this on Mystery;
   it should ask on all five, and 5a is where the custom-move assertion gets written. Phase A has its own
   gate for the four existing collections (§34.2) — *"the behavior change is not a big deal"* is a scope
   ruling, not a waiver on verifying it.

**Why this ranks first.** Of everything in this pass it is the only item that is a *user-visible
loss-of-context bug* rather than a cost or a test edit: a Keeper mid-session who fails one custom-move
write loses the whole page they were reading from, and the only recovery is a reload. It is also now the
only item in my sections that has turned into work scheduled ahead of Phase 1.

### L2 — `resource-images-four-domain-parity.spec.ts` is a fourth cross-cutting census guard, and R13's migration makes it fail by construction.

R12's closing advice is *"this repo census-tests cross-cutting overlay behaviour in three specs… check
all three before estimating overlay work."* There is a fourth, it is not an overlay spec, and it is the
one R13 breaks.

`shared/resource-images-four-domain-parity.spec.ts:143-154` carries a table:

```
const DOMAINS: readonly Domain[] = [
  { ownerType: 'Monster',   component: MonsterDetailComponent,   modalOwner: 'page' },
  { ownerType: 'Minion',    component: MinionDetailComponent,    modalOwner: 'page' },
  { ownerType: 'Bystander', component: BystanderDetailComponent, modalOwner: 'store' },
  { ownerType: 'Location',  component: LocationDetailComponent,  modalOwner: 'store' },
];
```

and `:409-421`, `it('splits delete-modal ownership exactly as intended, and no page mixes the two')`,
asserts for the `'store'` rows that **`pendingDelete` is not a member of the component** and that
`requestDeleteImage` is **absent**. R13's 5c/5d migration adds both to both pages. The spec fails, and it
fails with "Location should NOT own pendingDelete" — a message that reads like a regression in the
*images* feature.

Three things change with it, in the same commit:

1. The `DOMAINS` table: two `'store'` → `'page'`.
2. The 13-line rationale comment at `:396-408`, which explains the asymmetry and ends with *"The
   deciding question, for a fifth domain or a future refactor: is there an existing pending-delete
   concept for a second one to be ambiguous with?"* After 5c/5d the answer is "yes, on all four", the
   asymmetry is gone, and the paragraph becomes a historical note. It should say so rather than
   being deleted — it is the record of why the two shapes ever existed.
3. The test's own name. "Splits delete-modal ownership exactly as intended" is no longer a split.

R12's own arithmetic is unaffected and correct — I checked it (L5 below). This is a different spec with a
different oracle: the census compares *rendered DOM*, which R13 genuinely does not change; this one
reflects over the *component instance*, which R13 changes on purpose.

**And the same mechanism makes a positive point for Phase 6**, worth having now: after 5c/5d all four
image-bearing pages own their `pendingDelete`, so the images parity spec's one documented asymmetry
disappears and that spec gets simpler, not more complex. R13 is a tidying of the images feature as a side
effect, which is an argument for it rather than a cost of it.

### L3 — Two shipped specs pin the read-only block as if it were required, and one shipped copy string changes without anyone saying so.

`location-detail.spec.ts:220-223` and `bystander-detail.spec.ts:220-223`:

```
it('leaves the read-only custom moves list rendering', () => {
  expect(fixture.nativeElement.textContent).toContain('Custom Moves');
  expect(fixture.nativeElement.textContent).toContain('No custom moves.');
});
```

Two separate problems, both landing in 5c/5d, both named in neither §9 ("**Frontend.** Nothing to tear
down"), §10 ("~20 spec files untouched") nor §11.

1. **The copy assertion fails.** `'No custom moves yet.'` — §13.3's detail-page default — does not
   *contain* `'No custom moves.'`. So replacing the block is a red test, and the red is a copy change
   nobody has flagged: §13.3 flags the *create*-page variant as a new string and treats the detail-page
   default as matching *"No images yet."*, without noting that **two pages ship `"No custom moves."`
   today and will visibly change**. Not an objection — "yet" is the better word and matches the images
   card — but it is a user-visible copy edit on shipped pages, and it belongs with §13.6's copy rulings
   rather than arriving as a test failure.
2. **The test name and intent are a liability of exactly the shape my own 6b work hit.** "Leaves the
   read-only custom moves list rendering" encodes a *current* state as a requirement; it passed happily
   while the feature was missing, and it would keep passing forever. The 5c/5d rewrite should replace it
   with an assertion about the card (rows render, the add form is present, `data-custom-moves-card` is
   there), not patch the string.

**Verified as surviving, so 5c/5d does not have to touch them:** `location-detail.images.spec.ts:113-118`
and its bystander twin assert
`expect(order).toEqual(['The Old Mill', 'Images', 'form', 'Custom Moves'])` over a
`'h2, h3, app-location-form'` selector. The card's header keeps an `<h3>Custom Moves</h3>` in the same
position, so those two pass **unchanged** — which is a small, real argument for the card's header being
a plain `<h3>` rather than anything richer.

### L4 — 5c/5d carry *two* state migrations, not one, and the second one is what makes Phase 6's guard possible.

R13 budgets the `pendingDelete` migration. There is a second, same two pages, same commit:

**`location-detail` and `bystander-detail` have no `isMutating`.** They have `isSaving = signal(false)`
(`location-detail.ts:38`, `bystander-detail.ts:39`), a boolean owned by the entity-form save. Monster and
Minion have `activeMutation = signal<string | null>(null)` plus
`isMutating = computed(() => activeMutation() !== null)` (`monster-detail.ts:68`/`:77`,
`minion-detail.ts:56`/`:70`).

That matters for two reasons, one cosmetic and one structural:

- **Cosmetic, but shipped-copy cosmetic:** `location-detail.html:42-44` renders
  `@if (isSaving()) { <p>Saving location...</p> }`. Bind the card's `[busy]` to `isSaving()` and reuse
  the flag for a custom-move write, and adding a custom move prints *"Saving location..."*.
- **Structural:** a five-domain parity guard that renders the card in a `busy` state (and it must — see
  §31.3) needs the same expression on all five pages. Two pages binding `isSaving()` and three binding
  `isMutating()` is a difference the guard cannot see (both resolve to `false`, then to `true`) and
  therefore cannot protect.

**My recommendation:** 5c/5d give `location-detail` and `bystander-detail` the
`activeMutation`/`isMutating` pair, keep `isSaving` for the entity form only, and bind the card's
`[busy]` to `isMutating()` on all five pages. That is one signal, one `computed` and one template
binding per page — small, and it is the difference between a parity guard with teeth and one without.

### L5 — After 5c/5d, three `ResourceImagesStore` methods have zero production callers.

Verified by grep: `requestDelete`, `confirmDelete` and `cancelDelete` have **exactly six production call
sites, all six inside `location-detail.html:73-79` and `bystander-detail.html`'s twin**. R13 removes all
six. The three methods, the `pendingDelete` signal they drive and the exported `PendingImageDelete`
interface (`resource-images.store.ts:16-20`) then survive only in 14 assertions in
`resource-images.store.spec.ts`.

**My recommendation: keep them, with a comment, and do not delete them in 5c/5d.** Deleting live
(if unused) code plus 14 assertions inside a feature commit mixes a subtraction into an addition, which
is precisely the separation §5 is built on. The wrapper is also still the *right* API for a future page
that has no modal of its own, and its own doc comment already explains when to choose it. One sentence
at the declaration — "no page uses this today; §26.2 L5" — stops the next reader either deleting it as
dead or adopting it against decision 14. §32 F-L2 carries the removal as an optional follow-up.

### L6 — "Monster and minion are nearly free" is right in kind and off by roughly 2× in size, and five of the per-owner sites are silent on omission.

§13.5.3's list is: one `customMoves` + one `existingCustomMoves` on `MonsterDraft`/`MinionDraft`; one line
in `toHydratedMonster`/`toMinionDraft`; one entry in `saveThreatCollections`/`saveMinionCollections`; one
`rekeyDrafts` line; one dossier block; one composer panel. Six items. The actual per-owner site list,
grepped:

| # | Site (monster; the minion twin is one noun over) | TS catches omission? |
|---|---|---|
| 1 | `MonsterDraft` gains `customMoves` + `existingCustomMoves` (`:197-243`) | n/a — the declaration |
| 2 | `monsterCustomMoves = signal<CustomMoveDraft[]>([])` beside `:427-430` | n/a |
| 3 | `monsterCustomMoveForm` + `addMonsterCustomMove`/`removeMonsterCustomMove`, in the `:1342-1394` idiom | n/a |
| 4 | `monsterComposerPreview()` `:801-804` — the dossier's source | **no** |
| 5 | `monsterComposerDirty()` `:918-921` | **no** |
| 6 | commit to draft, `:1808-1811`'s object literal | **yes** |
| 7 | `editMonsterDraft` `:1850-1853` | **no** |
| 8 | `resetMonsterComposer` `:1992-1995` | **no** |
| 9 | `writeBackMonsterDrafts`'s `rekeyDrafts` block `:2404-2412` | **no** |
| 10 | `toHydratedMonster` (`hydrate-monster.ts:54-61`) | **yes** |
| 11 | `saveThreatCollections` `:3082-3094` | no, but a missing diff is loud |
| 12 | the composer panel + the dossier block | n/a — markup |

So ~12 sites per owner, 24 across the pair, against §13.5.3's six — and the interesting number is not the
volume, it is that **only two of them are protected by the type system**. `MonsterDraft` is an interface
with required fields, so the two object-literal construction sites (6 and 10) will not compile without
the new fields. Items 4, 5, 7, 8 and 9 are expressions, not literals: adding a field to the interface
does not force a clause into a boolean, an entry into an inferred `computed` return, a `.set()` into a
loader, a clear into a reset, or a line into a spread-based writeback.

**Site 5 is a correctness item, not a volume item.** `monsterComposerDirty()` is read by
`collapseComposerIfUntouched` (via `attachMonster`, `:1093`) and by `next()`'s composer-commit rules. Omit
custom moves from it and a composer holding *only* a custom move counts as untouched — so attaching an
existing monster **silently discards it**. That is the same property
`mystery-create-phase4-ledger.spec.ts:479` already protects for locations
(`it('R5: a half-filled composer counts as dirty, not just a valid one')`), which is the model for the
assertion 5f-2 needs.

**Site 9 is the H2 shape.** Omit the `customMoves: rekeyDrafts(draft.customMoves, collections.customMoves)`
line and the ids never come back onto the drafts while `existingCustomMoves` does — so every later submit
deletes and recreates the lot, which is the hazard `:2327-2330`'s comment exists to warn about.

**Conclusion, stated so it is not read as an objection:** 5f-2 is still the low-risk sub-phase and still
needs no new sequencing, no new stage and no new baseline discipline — §13.5.3 is right about all three.
It is not "nearly free", and the five unprotected sites deserve to be a literal checklist in the commit
rather than a reader's memory. §30.4 gives the assertions.

### L7 — `toNamedDraft` is not reusable unchanged, and its key prefix is wrong for a card that restores focus.

§13.5.3 says the hydration line reuses `toNamedDraft` *"unchanged, because a custom move is a named
draft."* The claim about shape is exactly right; the word "unchanged" is not.
`hydrate-monster.ts:108-110` is typed

```
function toNamedDraft(row: MonsterPowerResponse | MinionPowerResponse | MonsterWeaknessResponse | MinionWeaknessResponse): PowerDraft & WeaknessDraft
```

`CustomMoveResponse` is structurally identical to all four but is not a member of that union, so passing
one is a compile error until the union gains a fifth arm. Trivial — one token — and it is the good kind of
friction, since the compiler is what tells you.

Second, smaller: `toNamedDraft` mints `createDraftKey('trait')` (`:111`), so a hydrated custom move's
`localKey` reads `trait-17`. Harmless in the wizard, where keys are opaque. Worth a `prefix` parameter
anyway, because a roster assertion that fails prints these keys, and five collections sharing one prefix
is the thing that makes such a failure unreadable. My call: add the parameter, default `'trait'`, pass
`'move'` for custom moves. One line, no behaviour change to the four existing callers.

### L8 — 5f-1's step `0-4` breaks six `currentStep.set(3)` call sites, in three spec files.

`next()` (`mystery-create.store.ts:1301-1309`) advances within a phase unless
`step === phases[phase].steps - 1`. Adding the mystery's own moves as step `0-4` takes
`phases[0].steps` from 4 to 5 (`:389`), so every spec that reaches phase 0's submit by setting the last
step stops submitting and advances instead. Grepped:

| File | Line(s) |
|---|---|
| `mystery-create.store.spec.ts` | `:257`, `:424`, `:454`, `:488` |
| `mystery-create-phase4-ledger.spec.ts` | `:327` |
| `mystery-create-phase4.store.spec.ts` | `:534` |

Six sites, three files, all mechanical (`set(3)` → `set(4)`), all **silent**: the test does not error, it
asserts against a ledger that is empty because nothing was submitted. Two of them are the G1 tracker-jump
drain tests, where "nothing was submitted" and "the drain fired zero times" look identical.

§11's wizard file list names `phases`/`stepTitle`/`stepBlurb`/`phaseStepComplete` and "the existing ledger
specs as 5f-0's gate", which is right for 5f-0 and silent about 5f-1. **Recommendation: make the
`set(3)` → `set(4)` sweep the first commit inside 5f-1, before the step exists**, so the two changes
review separately — the same reason 5f-0 exists at all.

Three other phase-0 consumers that need a new entry and would otherwise be silently empty:
`stepTitle` (`:939-953`), `stepBlurb`, and `phaseStepComplete[0]` (`:755-760`). A fourth,
`currentSectionIcon` (`:808-820`), needs **no** change — phase 0 falls through to `'mystery'`, which is
correct — so that one is a decision not to change rather than an omission. §13.5.2 names the first three.

### L9 — 5f-3's attach change reaches 80 call sites in four spec files, and they fail with a `TypeError`, not a diff.

`attachLocation` (`:1547-1566`) and `attachBystander` (`:1676`) are synchronous and issue no request.
§13.5.3 item 3 and 14-R5 are right that they must become a fetch. The test blast radius, grepped:

**80 `attachLocation`/`attachBystander` call sites**, in `mystery-create-phase4-ledger.spec.ts` (34),
`mystery-create-phase4.store.spec.ts` (31), `mystery-create-phase4.spec.ts` (14) and
`mystery-create-phase4-usage-unavailable.spec.ts` (1). **None of the four stubs
`LocationService.getById` or `BystanderService.getById`** — verified: `grep -c getById` is 0 in all four,
against 4–8 in each of the monster-era `phase5a`/`phase5b` files, which is itself the evidence that the
monster attach already fetches and these do not.

Two consequences:

1. **The failure mode is `undefined is not a function`, inside the store, on a line the test never
   mentions** — not an assertion diff. Eighty call sites' worth of that is a bad afternoon if it arrives
   unplanned.
2. **The ledger specs record attach-time calls.** `sent` is cleared once in `beforeEach`
   (`mystery-create-phase4-ledger.spec.ts:103`, `:177`) and never between `attachLocation(...)` and
   `next()`. So every ledger assertion in a test that attaches gains the new fetch. By inspection that is
   at least ten tests (A5/A6, A5-two, A2/G3, D9, the mixed roster, S2, S4, S5, S1, and the four R5 cases).

**And a correction to §13.5.3 item 3 that shrinks the change: the fetch should be `list()`, not
`getById()`.** The reason is precisely the one that section gives for needing a fetch at all —
`LocationListItemResponse` already carries *everything `LocationDraft` needs except the moves*
(`attachLocation:1554-1562` builds `id`, `name`, `description`, `locationTypeId`, `mysteryIds` from the
catalogue item). So:

- `customMoveService.list('Location', id)` fetches exactly the missing field, in one round trip, and
  **leaves the draft-construction expression intact** — only `existingCustomMoves` and `customMoves`
  are added to it.
- `locationService.getById(id)` is the same one round trip but re-sources five fields that today come
  from the catalogue snapshot, which weakens the premise of
  `mystery-create-phase4-ledger.spec.ts:386` (`it('S2: the submit writes back the values loaded at
  attach, clobbering an edit made elsewhere')`) — a state that file characterises deliberately, with the
  note *"asserted so the day it stops being acceptable, this test is the one that has to be changed on
  purpose."* 5f-3 should not be the phase that changes it by accident.
- It also means the four spec files gain a `CustomMoveService` stub rather than a `getById` on two
  entity services, which keeps the new stub in one shape across all four and makes the ledger entry read
  `customMoves.list(Location,loc-a)` — self-describing in a failure.

**On the failure branch, follow `attachMonster` but not its reasoning.** `attachMonster:1066-1072`
refuses to admit anything on a failed hydration because a known id with an empty baseline is *"the one
path in the design that produces genuine sub-resource destruction."* For a location that is overstated:
empty drafts against an empty baseline produce **zero** requests (`sub-resource-diff.ts:74-98`), so the
server keeps its moves and they are merely invisible in the wizard. Milder — but still wrong, and still
confusing in the way that generates bug reports ("I added a move and now there are four"), so the
conclusion is the same: admit nothing, show the strip's error, leave the location in
`attachableLocations` so retry is picking it again. Worth getting the reason right so nobody later
decides the mild case justifies a partial admit.

### L10 — 5f-0 *is* a provable no-op, and the proof rests on two conditions the doc does not state.

§5 and §13.5.3 both call 5f-0 behaviour-preserving, gated on `mystery-create-phase5a-ledger.spec.ts` and
`mystery-create-phase4-ledger.spec.ts` passing unchanged. I checked whether that survives contact with
the restructure. It does, under two conditions that need writing down because each is one edit away from
being false.

**Condition 1 — it holds only because both ledgers sort.** Giving `submitPhase2` phase 1's shape means
replacing one five-arm `forkJoin` (drained / unlinked / updated / linked / created,
`:2438-2461`) with a per-draft arm that does `update` **then** `link` for that draft. `forkJoin`
subscribes in source order, so today's wire order is all-updates-then-all-links and after the restructure
it is update(d1), link(d1), update(d2), link(d2)… **The request order changes.** It is invisible only
because `expectLedger` is

```
const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());
```

— `mystery-create-phase4-ledger.spec.ts:99`, `mystery-create-phase5a-ledger.spec.ts:63`, each with a
comment saying `forkJoin` gives no order worth asserting. That is the right call and it is also the
entire reason 5f-0 can claim to be a no-op. Say so in the gate, because "the ledgers pass unchanged"
reads like a stronger claim than it is.

**Condition 2 — 5f-0 must not adopt entity-level dirty checking.** Phase 1's per-row shape
(`saveMonsterDraft:2359-2387`) still writes **unconditionally**: `update` + `link` for every draft with an
id, no `isDirty` at the entity level. Phases 2 and 3 do the same today. The temptation during a
restructure that introduces `applySubResourceDiff` is to extend the diff upward to the entity; doing so
reduces request counts and fails
`mystery-create-phase4-ledger.spec.ts:404` (`it('S4: every persisted draft is written on every
transition, touched or not — three rows, six calls')`) and `:206` (A6, whose comment says in as many
words *"a no-op PUT of identical values is expected and correct in Phase 4, so the criterion is 'the
fields are what they were', never 'no PUT went out'"*). The dirty check belongs **only** inside
`applySubResourceDiff`, over the custom-move collection, where decision 9 already put it.

With those two conditions stated, the no-op claim is sound and 5f-0 is, as §5 says, the strongest single
idea in §13. What 5f-0 actually changes, precisely: a per-draft `saveLocationDraft(mysteryId, draft,
index)` returning `{ index, id }`; a `writeBackLocationDrafts(saved)` that sets ids **and**
`existingCustomMoves` in one update, replacing `backfillDraftIds`'s positional match (`:2891-2894`); the
same for bystanders. Nothing else.

### L11 — The owner-segment typo guard can be derived instead of transcribed, which is strictly better than the assertion §16.2 hands me.

§16.2 item 3 hands me this: a typo in `OWNER_SEGMENT` is indistinguishable from a missing owner (both a
bodiless 404, measured), `SUPPRESS_ERROR_TOAST` silences the diagnosis, and *"§5's Phase 4 gate already
requires the service spec to assert all five segments by string. Keep that requirement; it is the only
guard."*

> **Superseded in my favour, 2026-10-11 (Phase 4).** Bowser withdrew the byte-identical claim and I
> re-measured it first-hand during Phase 4's live probe. The two 404s **are** distinguishable:
>
> | Request | Status | Body | `Content-Type` |
> |---|---|---|---|
> | good segment, unknown owner id | 404 | **162 B** | `application/problem+json; charset=utf-8` |
> | bad segment, real owner id | 404 | **0 B** | *none* |
>
> A controller `NotFound()` goes through `AddProblemDetails()`; the route constraint rejects a bad
> segment before any application code runs and `Program.cs`'s `/api/{**rest}` catch-all answers a bare
> 404. **What that changes, and what it does not** — three things, because the answer is not simply
> "the problem is smaller":
>
> 1. **Correction A below is now wrong in the same direction Bowser's was, and I am correcting it
>    rather than quietly keeping the stronger framing.** A segment typo is **diagnosable** — not from
>    the UI, where it still surfaces only as the hedged caveat, but from the network tab in one look.
>    The create pages are still where it *hides*; it is no longer true that nothing can tell you why.
>    L-R4's severity drops accordingly.
> 2. **It makes the live probe strictly sharper, and that is the real win.** The discriminator becomes
>    *"did the request reach application code?"*, which is a **positive** signal about the segment
>    rather than an absence — and it works with a **bogus** owner id, so a probe needs no real data at
>    all. I still ran the probe with real owners (below), because a real id is the only thing that also
>    catches a segment that is legal but points at the *wrong* owner type; the bogus-id form is what I
>    would reach for in any later phase that just wants to re-confirm the map.
> 3. **It does not retire the derived guard**, and the reason is timing rather than strength: the probe
>    is a one-off manual check, and the derived assertions run in CI on every change, forever. They
>    protect against different things at different moments. Both stay.

**Two corrections and one better guard.**

**Correction A — "silent" is too strong, and where it *is* nearly silent is not where the gate looks.**
The write still fails and the host still reacts (and per the note above, "undiagnosable" in this table
should be read as "undiagnosable *from the UI*" — the response itself says which kind of 404 it is):

| Surface | What the user sees on a typo'd segment |
|---|---|
| Detail page | The host's own message — *"Unable to add custom move."* — as a toast. Visible, undiagnosable from the UI. |
| **Create page** | **The hedged caveat** (§13.6.1) and navigation to a detail page where the moves are simply absent. This is the one that hides: the entity saved, the copy is deliberately vague, and "some details may not have saved" is *true*. |
| Wizard | `handleSubmitError('Could not save locations. Please try again.')` in the footer band, and the phase does not advance. Loud, misattributed. |

So the exposure is concentrated on the four create pages, which is also the surface a unit spec asserting
five strings cannot reach. **Bowser agrees with this narrowing and left it to me to state here rather than
amending B2/§16.2**, so the two passes converge rather than disagreeing: his *"silent"* is about the
diagnosis, not about the failure, and the create pages are where the failure itself is quiet.

**Correction B — a spec that asserts five human-typed strings against five human-typed strings is the
shape `confirm-delete-modal.call-sites.spec.ts` already documents as rotten.** Its own note at
`:283-296`: *"a written-down N needs something derived to check it against, or it only ever records what
was true when it was written."* Five literals in a spec compared with five literals in a map is the same
trap one layer down.

**The better guard — and it needs no new source of truth, because four of the five segments are already
proven live by a shipped feature.** `core/resource-images.ts`'s `OWNER_SEGMENT` encodes `monsters`,
`minions`, `bystanders`, `locations`, and the images feature works in production, so those four strings
are **verified against the real route table by the running app**. `resourceImagesPath` is exported, so a
spec can derive them without exporting anything new:

```
for (const owner of ['Monster', 'Minion', 'Bystander', 'Location'] as const) {
  const fromImages = resourceImagesPath(owner, 'OID').split('/')[2];
  const fromMoves  = customMovesPath(owner, 'OID').split('/')[2];
  expect(fromMoves, `${owner}: segment disagrees with the shipped images segment`).toBe(fromImages);
}
```

and the fifth is derivable too, from `MysteryService`'s own shipped URL, through
`HttpTestingController` rather than a literal:

```
mysteryService.getMystery('OID').subscribe();
const base = http.expectOne(() => true).request.url;          // '/api/mysteries/OID', shipped and live
expect(customMovesPath('Mystery', 'OID')).toBe(`${base}/custom-moves`);
```

Zero transcribed segments, and every one of the five anchored to a string the running application already
depends on. This is the same "a relative invariant beats a recorded one" move the images drift guard
made, applied to a map instead of to markup.

**Keep the five literal assertions as well** — they document the contract legibly and they are what a
reader checks against Swagger. They are just not the guard.

**And add one thing the gate does not have: a live five-segment probe in Phase 4.** `core/custom-moves.ts`
exists and Phase 2's endpoints are live, so before five sub-phases are built on the map, hit
`GET /api/{segment}/{realId}/custom-moves` once per owner type with a **real** id and require `200`. A
real id is what separates "wrong segment" from "missing owner" — §16.2's table shows both are 404 with a
*bogus* id, and `200` vs `404` with a real one. Five curls, once, and it is the only oracle that tests the
client's map against the server's constraint rather than against another copy of itself.

### L12 — `mystery-detail` needs five additions, not three; and `escape-nesting.spec.ts` needs a word, not a row.

**The additions.** §4.1's table lists three (`isMutating`, `NotificationService`, the modal plus
`pendingDelete`) and one deliberate non-addition. Two more are unavoidable, and both are consequences of
the page never having written anything:

4. **A `mysteryId` signal.** `mystery-detail.ts:47-93` reads the route id inside the pipe
   (`params.get('id')`, `:52`) and **never stores it**. All four other detail pages hold their own
   entity-id state. Without the id there is nothing to address a `POST` or a refetch at.
5. **A targeted refetch.** The page's load is a four-arm `forkJoin` followed by a minion fan-out
   (`:59-81`). The other four pages refresh after a write through `service.getById(id)`; Mystery has no
   such method on the page. The right shape is a private `reloadMystery()` that calls
   **only** `mysteryService.getMystery(id)` and sets `this.mystery(...)` — the monsters, locations,
   bystanders and minions cannot change as a result of a custom-move write, so re-running those four arms
   would be wrong as well as wasteful.

Neither is hard. Both are the kind of thing that turns "three component additions" into an afternoon when
it was budgeted as an hour, which is what §4.1 exists to prevent.

**`escape-nesting.spec.ts` — R12 is wrong about what 5e makes true.** R12 says that spec *"pins that
every detail page mounts the upload modal and one confirm modal as siblings, which 5e makes true of a
fifth page."* It does not: mystery images are out of scope (§2.8 is built on that), so `mystery-detail`
gains a confirm modal and **no** upload modal. The spec's prose at `:111-117` — *"All four detail pages
render the upload modal and `<app-confirm-delete-modal>` as siblings, so this pairing is real markup
rather than a contrived fixture"* — stays true and needs one qualifier ("all four image-bearing detail
pages"), not a fifth case. Getting this right matters because the alternative reading invites someone to
put an upload modal on `mystery-detail` to satisfy a census.

**`custom-select-escape-surfaces.spec.ts` — no change, and that should be stated.** Its unit is
templates rendering `<app-custom-select>`; the card renders none. The two create pages that gain the card
already appear there through their forms. R12 is right to say check all three; the answer for this one is
"nothing", and recording that is what stops a well-meaning entry being added.

### L13 — The locations/bystanders composer panel needs no `<form>` restructure, and §13.5.3's arrangement advice would require one.

§13.5.3 item 4 says the locations composer is *"one `<form>` with the Save/Cancel buttons inside it. A
nested panel is first-of-kind there; follow the monster composer's arrangement (panels between `</form>`
and the button row)."* The diagnosis is exact — verified: `mystery-create-locations-phase.html:82` opens
`<form [formGroup]="store.addLocationForm">` and the button row sits inside it at `:97-105`, whereas
`mystery-create-monster-phase.html` closes its entity form at `:141` and then runs four sibling panels
`:143-254` before its button row at `:256-263`.

But the prescription means **moving a shipped composer's Save/Cancel row out of its form** — a structural
edit to the riskiest phase's markup, for a sub-resource panel.

**Cheaper and correct: drop the `<form>` element from the panel.** Angular's `FormGroupDirective` selector
is `[formGroup]`, which binds to any element, and the four existing sub-resource panels already use
`<button type="button" (click)="…">` rather than `ngSubmit` — so the `<form>` element in them is doing no
work. A custom-moves panel written as

```
<div class="border border-default rounded-lg mb-4 p-3">   <!-- bg-surface-sunken on the minion twin -->
  <h4 …>Custom Moves</h4>
  …rows with × …
  <div [formGroup]="store.locationCustomMoveForm" class="flex flex-wrap items-center gap-2 mt-2"> … </div>
</div>
```

sits **inside** the existing `<form>`, above the button row, with no nested form element, no
implicit-submit ambiguity and no edit to shipped markup. Cost, stated: a group of inputs with no `<form>`
of its own — which is the lesser of the two irregularities, and it is invisible to the user. Trade-off
accepted knowingly; if Rosalina prefers the restructure, it is her call and it is a bigger diff.

### L14 — Smaller corrections, verified.

- **§13.1 item 4's citation versus B13's.** Bowser is right. `grep -n` gives
  `UpsertMonsterPowerRequest` at `ApiContracts.cs:159`, `UpsertMonsterWeaknessRequest` at `:166`,
  `UpsertCustomMoveRequest` at `:167`, `CustomMoveResponse` at `:21`, `MonsterPowerResponse` at `:128`,
  `MonsterWeaknessResponse` at `:130`. All three upsert records and all three response records are
  character-identical modulo the name. Use B13's numbers.
- **§1.4's "~20 spec files" is 23.** Bowser's count is right; 31 occurrences across those 23, every one
  the literal `customMoves: []`, and zero assertions — so §1.4's and §10's *stronger* claims are exact
  and only the file count was off. §11's "~20 spec files **untouched**" should read 23, and should carry
  the exception L3 names: two of them change.
- **Yoshi's `runBatch` line number.** §1.4 cites `monster-create.ts:374-376`; it is `:375-377`.
  Rosalina's `:375-377` and `:320-373` are both right.
- **§13.3's row shell is not a transcription.** It gives
  `<li class="flex items-start justify-between gap-3 border-b border-default py-[0.45rem] last:border-b-0">`
  as *"the exact row shell from `monster-detail.html:120` / `:171`."* The shipped row at both lines has
  **no `gap-3`**, its text block is a bare `<div>` with **no `min-w-0`**, and its button carries no
  `shrink-0`. Her version is an improvement — and given this codebase's five-for-five `min-width: auto`
  record (documented in `styles.css`), `min-w-0` on the text block is required, not cosmetic. Use her
  classes; just do not expect to find them by copy-pasting from `:120`.
- **`monster-create.html`'s staged-write sentence is at `:31-34`,** not `:32-35`. The sentence text
  §13.4 quotes is exact, and so is the `:222` placement anchor (the grid's closing `</div>`).
- **`styles.css` has no base `.action-btn` rule** — only `:hover`, `--delete:hover`, `--edit:hover` and
  `:disabled` (`:286-300`). So every layout class has to be on the element, exactly as the shipped call
  sites do. A card that writes `class="action-btn action-btn--delete"` and stops renders an unstyled
  button that still *hovers* correctly, which is a nasty way to find out.
- **§13.3's edit-affordance citations are right in substance, slightly off in place.**
  `mystery-create-monster-phase.html:99-109` is the composer *heading* with its `tabindex="-1"` and
  `Editing “…”`; `:256-263` is the Cancel/Save-Changes row. The pencil-and-`Editing`-micro-label pattern
  she describes — the label rendered *where the pencil was* — is at `:35-55`, which she does not cite.
  All three are the right sources; the third is worth adding since it is the one the card copies most
  literally.
- **`mystery-detail`'s headings — settled, decision L-D2.** Every heading on that page is icon-prefixed:
  the three prose sections and Countdown through `app-mystery-section-icon` with
  `uppercase tracking-[0.05em]` (`mystery-detail.html:25-30` and siblings), the four linked-entity
  articles through the same component without the uppercase. The card's plain `<h3>Custom Moves</h3>` is
  therefore the only heading on that page with no icon. §13.2 settles the *shell* question for Mystery and
  does not raise this one; **Skyler's answer is the plain `<h3>`** — *"I agree that the h3 makes the most
  sense here. I can easily circle back and figure out an icon solution if it bothers me, but for now, the
  h3 is good."* So the card looks like the card on all five pages and the parity guard needs no exception.

  **What "circle back" would actually cost, recorded so a later icon is not blocked by a decision reading
  as permanent — and it is more than an attribute.** Three separate obstacles, all verified:
  1. **There is no custom-moves icon in any vocabulary.** `MysterySectionIconKind`
     (`features/mysteries/shared/mystery-section-icon.ts:4-11`) is a closed union of six domain kinds
     (`mystery`, `countdown`, `monster`, `minions`, `locations`, `bystanders`) plus the six
     `MysteryCountdownStageIconKind` members — twelve, with no custom-moves member. `IconComponent`'s
     `IconName` (eleven generic action/chrome glyphs) has none either, and `DomainIconComponent` is
     domains only. An icon means **new sprite art first**, which is a design task, not a markup one.
  2. **The component that draws those headings lives in the mysteries feature.**
     `app-mystery-section-icon` is at `features/mysteries/shared/`, so a `shared/` card importing it would
     make a shared component depend on a feature — the inversion `IconComponent`'s own doc comment exists
     to prevent (*"domain/nav and mystery-section icons are consumed through their own existing
     components… not through `IconComponent`"*).
  3. **The other four pages have no icon vocabulary on section headings at all.** Verified: every `<h3>`
     on monster-, minion-, location- and bystander-detail is bare, including
     `app-resource-images-card`'s own `<h3 class="m-0">Images</h3>`. So an icon on the custom-moves card
     would be the first on any of those four pages, and the choice would be between one page differing
     and five pages gaining a treatment nothing else on them has.

  None of that is an argument against ever doing it. It is the reason it is a design pass rather than a
  one-line follow-up, which is what "easily" would otherwise imply.
- **`app-domain-icon` could not be dropped into the card as-is anyway**: its `domain` input is typed to
  its own union and it hardcodes `h-5 w-5` on the inner svg (my 2026-10-04 note). §13.3 is right that it
  *handles* `mystery`; it would need a size escape to be used at `xl` the way the images card's empty
  state does. A fourth reason the plain `<h3>` is the cheap call.

---

# 27. `core/custom-moves.ts` — the exact shape

Mirrors `core/resource-images.ts` structurally, including the constructor-injection style (that file uses
`constructor(private readonly apiService: ApiService)`, and it is the file §2.9 names as the model, so
`inject()` would be a gratuitous divergence at the one place a reader will diff the two).

```ts
import { Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { CustomMoveOwnerType, CustomMoveResponse, UpsertCustomMoveRequest } from './models';

/**
 * Owner type → the unified controller's route segment (architecture.md §2.9). Five segments, one
 * map, one builder: there is no second place a URL for a custom move is constructed, which is what
 * §2.5 relies on when it says a correct-but-unintended owner pair cannot be built by accident.
 *
 * **A typo here is a bodiless 404 and SUPPRESS_ERROR_TOAST hides the diagnosis** (§16.2 item 3,
 * §26.2 L11). The guard is not this comment: it is `custom-moves.spec.ts`'s derivation of the four
 * shared segments from `resourceImagesPath` and of `mysteries` from `MysteryService`'s own URL.
 */
const OWNER_SEGMENT: Readonly<Record<CustomMoveOwnerType, string>> = {
  Mystery: 'mysteries',
  Monster: 'monsters',
  Minion: 'minions',
  Location: 'locations',
  Bystander: 'bystanders',
};

/** `/api/{segment}/{ownerId}/custom-moves` — rooted; `ApiService` adds the base URL. */
export function customMovesPath(ownerType: CustomMoveOwnerType, ownerId: string): string {
  return `/api/${OWNER_SEGMENT[ownerType]}/${ownerId}/custom-moves`;
}

/**
 * **Set on all four methods, and the token is not dead config.** Without it
 * `httpErrorInterceptor:26-29` fires `"Request failed (500) for POST /api/monsters/{guid}/custom-moves"`
 * beside the card's own inline message on a detail page, and beside the deliberately vague
 * "some details may not have saved" caveat on a create page (§13.6.2 item 5, 14-R3). Two toasts per
 * failure, one of them useless. Suppresses only that toast — a 401 still reaches
 * `authErrorInterceptor` (see `http-context-tokens.ts`).
 */
function inlineErrorContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
}

@Injectable({ providedIn: 'root' })
export class CustomMoveService {
  constructor(private readonly apiService: ApiService) {}

  list(ownerType: CustomMoveOwnerType, ownerId: string): Observable<CustomMoveResponse[]> {
    return this.apiService.get<CustomMoveResponse[]>(customMovesPath(ownerType, ownerId), inlineErrorContext());
  }

  create(
    ownerType: CustomMoveOwnerType,
    ownerId: string,
    request: UpsertCustomMoveRequest,
  ): Observable<CustomMoveResponse> {
    return this.apiService.post<UpsertCustomMoveRequest, CustomMoveResponse>(
      customMovesPath(ownerType, ownerId),
      request,
      inlineErrorContext(),
    );
  }

  update(
    ownerType: CustomMoveOwnerType,
    ownerId: string,
    moveId: string,
    request: UpsertCustomMoveRequest,
  ): Observable<CustomMoveResponse> {
    return this.apiService.put<UpsertCustomMoveRequest, CustomMoveResponse>(
      `${customMovesPath(ownerType, ownerId)}/${moveId}`,
      request,
      inlineErrorContext(),
    );
  }

  delete(ownerType: CustomMoveOwnerType, ownerId: string, moveId: string): Observable<void> {
    return this.apiService.delete(`${customMovesPath(ownerType, ownerId)}/${moveId}`, inlineErrorContext());
  }
}

/** Client identity for a staged move. See `CustomMoveRow.key` and 14-R4; §30.1 says why not the wizard's. */
let nextDraftKey = 0;
export function createCustomMoveDraftKey(): string {
  return `move-${++nextDraftKey}`;
}
```

Argument order is `(ownerType, ownerId, …)` throughout, matching `ResourceImageService` exactly — which
matters more than it looks, because `(ownerType, ownerId, moveId)` and `(ownerType, ownerId)` are three
and two `string`s with no type-level distinction between them, so the only protection against a
transposed pair is that every method in both services reads the same way.

## 27.1 The owner-segment typing, which is the one real design choice in this file

**`CustomMoveOwnerType` is a five-member string-literal union in `models.ts`, not an enum, and not an
extension of `ResourceOwnerType`.**

```ts
/** The five owner types a custom move can belong to. Same names as the API's `CustomMoveOwnerType`. */
export type CustomMoveOwnerType = 'Mystery' | 'Monster' | 'Minion' | 'Location' | 'Bystander';
```

- **A union, not a TS enum**, because `ResourceOwnerType` (`models.ts:976`) is one and the whole client
  has no TS `enum` anywhere. A union also makes `Record<CustomMoveOwnerType, string>` exhaustive at
  compile time: adding a sixth member without a segment is a type error at the map, which is the
  client-side half of R7's drift guard and is free.
- **Not `ResourceOwnerType | 'Mystery'`**, for the reason §2.8 gives one layer down: the two sets are
  equal by coincidence minus one member, and tying them makes a change to the images feature a change to
  this one. Two honest unions, sited adjacently in `models.ts` with a comment each pointing at the other
  and at §2.8 — the same treatment §3.1 asks for on the C# side.
- **Pleasant consequence, worth recording because it means no casts anywhere:** `ResourceOwnerType` is a
  strict subtype of `CustomMoveOwnerType`, so a page that already holds its own owner type as the
  four-member union can pass it straight into the card. No page needs both today (Mystery has no images),
  but nothing breaks if one ever does.
- `Readonly<Record<...>>` on the map, matching `resource-images.ts:28`. **Not exported** — the only legal
  consumer is `customMovesPath`, and exporting it invites a second URL construction site, which is the
  thing §2.5 says cannot exist.

## 27.2 `list()` ships in Phase 4 and is first exercised in 5f-3 — decision L-D3

**Settled (Skyler):** *"Yes, go ahead and ship the `list()` call in Phase 4, with the note that this is not
expected to function fully until 5f-3. Tests obviously won't be useful until then, either. We just need a
note to be sure to validate the functionality in 5f-3 and ensure tests have the correct coverage."*

**That note is written as a gate, not as a comment**, because a comment in a service file does not survive
seven sub-phases: **§30.5's 5f-3 gate does not close until `list()` is exercised by its real caller and
carries real coverage.** The Phase 4 gate (§27.3) says the opposite half out loud — that `list()` ships
deliberately uncovered beyond its URL/token row — so a reviewer reads the gap as a decision rather than an
oversight. Two gates, one in each direction, and neither depends on anyone remembering.

Worth asking out loud in the first place, because shipping a client method with no call site is exactly the
condition §1.7 diagnoses — sixteen endpoints nothing ever called. §2.9 settles four methods and I was not
going to reduce it to three, but it needed a real caller or it was the same mistake in miniature.

It has one, and it is the better of the two candidates: **the wizard's location/bystander attach**
(§26.2 L9). `list('Location', id)` fetches exactly the field `LocationListItemResponse` lacks, leaves
`attachLocation`'s draft-construction expression intact, and keeps S2's characterised staleness
characterised. `getById` would work and would quietly re-source five fields that today come from the
catalogue snapshot. So "not expected to function fully until 5f-3" is exact: between Phase 4 and 5f-3 the
method is correct by construction (same builder, same token, same `ApiService` call as its three
siblings) and simply unused.

It does **not** get a caller on the detail pages. See §29.1: the detail hosts refetch the *entity*, so the
card's rows stay single-sourced from `entity()!.customMoves`. I considered making the write pipeline
`write → list() → a page-level rows signal`, which is a cheaper request and would have made all five hosts
byte-identical; I am recommending against it, because it creates two sources for one collection
(`monster()!.customMoves` and `customMoves()`) that agree only by coincidence — the hazard
`mystery-create-monster-phase.html:22-28` already names in this repo, having been bitten by it once.
One source beats one fewer round trip.

## 27.3 Phase 4's gate, restated

§5's Phase 4 gate — *"service unit tests covering all five owner segments and asserting the context token
is set on each method"* — is right and insufficient. `core/resource-images.spec.ts:86-100` is the
precedent to copy for the token half (one `expectOne` per method, then a loop asserting
`request.context.get(SUPPRESS_ERROR_TOAST)` is `true`); extend it to a **4 × 5 table** so the assertion is
twenty requests, not four, and a segment typo cannot hide behind a method that happens to be checked with
a different owner. Then add §26.2 L11's two derived assertions and the five-segment live probe.

**And the gate says out loud that `list()` is deliberately uncovered beyond that table** (L-D3). It gets
its five rows in the 4 × 5 — URL, verb, token — because those are properties of the builder and are worth
pinning the moment the builder exists. It gets **no behavioural coverage**, because there is no behaviour
to cover until 5f-3 supplies its caller, and Skyler's answer is explicit that inventing some would not be
useful: *"Tests obviously won't be useful until then, either."* Writing a hollow "it calls `GET`" spec
would be worse than the gap — it would read as coverage. The matching half is §30.5's 5f-3 gate, which
does not close until the real caller and its coverage exist.

### What Phase 4 actually ran, 2026-10-11

Recorded because §27 was written before the backend existed, and a spec whose predictions were never
checked against the shipped thing is just a plan.

**Suite: 1497 → 1524 (109 files), `npm run typecheck` clean.** 27 new assertions: the 4 × 5 table (20), a
guard that the table really generates twenty, the three path tests, the status-code test, the
error-propagation test and the draft-key test.

**The derived guard, with its negative control — and the control found a real limit of the 4 × 5 table.**
Typo `minions` → `minionz` and **two** tests fail: the literal-path test and the derived agreement test.
Typo `mysteries` → `mystery` and the other two fail: the literal-path test and the `MysteryService`
derivation. So each of the two derived mechanisms catches its own segment independently. **But the 4 × 5
table does *not* fail in either case**, and that is worth stating plainly: it builds its expected URL from
`customMovesPath` itself, so it is self-consistent and structurally blind to a segment typo. It proves
verb, body and the context token — not the segment. The derived assertions are doing the segment work
alone, which is exactly why they exist and why five transcribed literals would not have been enough.

**The live probe: 18 checks, 0 failures, zero data footprint.** Run against the real `Program.cs` host on
scratch port 5399, signed in with the dev cookie. Three parts:

1. **All five segments against a real owner of that type → `200`**, and the *item* route
   (`.../custom-moves/{moveId}`) against a bogus move id → `404`, which reaches the controller and writes
   nothing. Ten checks. Real ids are what also catch a segment that is legal but points at the wrong
   owner type — `Minion: 'monsters'` would 404 here while a bogus-id probe could not tell.
2. **The 404 distinction, measured first-hand**: 162 B `application/problem+json` versus 0 B and no
   content-type, plus `xmonstersx` → 404 confirming the regex anchors hold on the real host and not only
   in Bowser's scratch project.
3. **The five segments were parsed out of `core/custom-moves.ts` by the probe script rather than typed
   into it**, so the probe tests the client's map and not the author's memory of it. A typo in the map
   produces a probe URL that fails.

**Footprint: nothing created, nothing to clean up.** Every request was a `GET` or a `PUT` at a
non-existent move id, so no write path ever completed. Audited afterwards anyway:
`SELECT count(*) FROM custom_moves` is **0**, no row matching `probe%`, and exactly one custom-move table
in `information_schema` — the five old ones are gone. No reference types created, so no `psql` cleanup was
needed. The API was stopped and `dotnet build` confirmed clean afterwards, so nothing holds `bin/`.

**One thing that differed from §27, and it is in the service's favour.** §27.2 argued `list()` earns its
place because the detail pages do not need it and 5f-3 does. That still holds — and the live probe turned
out to be a second, immediate use: it is the only verb that can validate a segment read-only. Not a reason
to keep the method on its own, but worth recording that the "ships unexercised" window is narrower in
practice than the doc implies: it is unexercised *by the application*, not unused.

# 28. `app-custom-moves-card` — the component contract

§13.3 leaves me the event signatures, the add-form grid and the textarea row count. Everything below is a
specification of what §13.3 and §13.4 already decided, except where it says "departure".

## 28.1 The contract

```ts
/** One row the card renders. The host maps its own type into this; the card knows neither. */
export interface CustomMoveRow {
  /** Stable identity: the server id on a detail page, a client draft key on a create page (14-R4). */
  key: string;
  name: string;
  description: string | null;
}

/** What a submit means. `key === null` is an add; anything else is an edit of that row. */
export interface CustomMoveCommit {
  key: string | null;
  /** Trimmed and non-empty — the card refuses to emit otherwise, so no host re-validates. */
  name: string;
  /** Trimmed, or null when blank. Matches `UpsertCustomMoveRequest` and every service's own trimming. */
  description: string | null;
}

@Component({
  selector: 'app-custom-moves-card',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './custom-moves-card.component.html',
  host: { class: 'block' },
})
export class CustomMovesCardComponent {
  @Input({ required: true }) ownerType!: CustomMoveOwnerType;

  /** Signal-backed: read by the form-population computed, not only by the template. */
  @Input() set rows(value: readonly CustomMoveRow[]) { … }
  /** Two-way. The host owns which row is open; the card asks. */
  @Input() set editingKey(value: string | null) { … }
  @Output() editingKeyChange = new EventEmitter<string | null>();
  /** Disables the whole surface while any mutation is in flight. */
  @Input() set busy(value: boolean) { … }
  @Input() emptyText = 'No custom moves yet.';

  @Output() committed = new EventEmitter<CustomMoveCommit>();
  /** The whole row, not the key: the detail host needs `name` for the modal, the create host `key`. */
  @Output() removeRequested = new EventEmitter<CustomMoveRow>();
}
```

### What 5a actually built, and the three places it differs from the above

Recorded in detail because four sub-phases are read against this one.

**1. One public method was needed that §28.1 did not foresee: `commitSucceeded()`.** The contract as
written has no way for the card to learn that a commit *landed*, and it cannot infer it — on a detail page
the rows come back from a refetch, and an unchanged `rows` is also exactly what a **failed** write leaves
behind. So the host calls `commitSucceeded()` on its success branch, which resets the form to the add state
and restores focus to the edited row's pencil; on failure it calls nothing, which is what keeps the user's
typing for a retry. The host holds the card as
`@ViewChild(CustomMovesCardComponent) private readonly customMovesCard?` — optional, because on a detail
page the card lives inside the template's `@if (monster())`.

Still five inputs and three outputs; this is a method, not a fourth output. The alternative considered and
rejected was having the card watch `rows` for a change and reset itself: it cannot distinguish "the write
landed" from "the refetch returned the same thing", so it would clear the form on a failed write — the one
behaviour this whole phase exists to avoid.

**2. The empty-state probe attribute is `data-custom-moves-empty`, not `data-empty-state`.**
`app-resource-images-card` already renders the bare name, and on all five detail pages the two cards are on
the same page — so an unscoped `[data-empty-state]` query matches **the images card first**. Found in the
browser; the card's own unit spec queries inside its own fixture, where no images card exists, so the
collision was *structurally invisible* to it. **The general rule, which matters beyond this attribute:
every probe hook on a shared card wants the component's name in it**, because shared cards co-habit. A
spec on `monster-detail` now pins it, so 5b–5e cannot reintroduce it.

**3. `editingKey`'s setter syncs the form**, which is what makes the two-way binding carry its weight: the
host sets its signal and the card's fields populate with no second input and no handler. `requestEdit`
sets the signal *and* emits, so the card is correct before the host echoes back — otherwise the form would
populate one change-detection cycle late.

### One correction to 14-R4, found by a negative control

Swapping `track row.key` for `track $index` failed **no test** in my first version of the card's spec — 56
assertions that did not protect the keying decision they were written beside. Chasing that produced two
things:

- **14-R4's stated mechanism does not apply to this implementation.** It warns that under index tracking
  the restore target is `isConnected` while belonging to a *different* row. True of a captured
  `ElementRef` or a positional lookup; `restoreFocusTo` resolves by `[data-move-key]`, which is a
  **binding**, so it cannot find the wrong move whatever the tracking strategy. That robustness is worth
  keeping and is the reason to prefer an attribute lookup over a held reference generally.
- **The real difference is node preservation, and it is observable.** Under index tracking a *shrinking*
  list recycles nodes and destroys the one holding focus; under key tracking the surviving row's node
  survives with its focus intact. A detail page hits exactly that on every post-delete refetch. There is
  now a test for it — focus a row's pencil, shrink `rows`, assert focus survived — and it is the only test
  that fails under `$index`.

**So `track row.key` stays required, for a different and narrower reason than 14-R4 gives.** Worth
correcting rather than leaving, because "the restore lands on the wrong row" would send the next person
looking for a bug that this implementation cannot have.

**Why a card-local `CustomMoveRow` rather than taking `CustomMoveResponse[]` directly.** A detail page
has `CustomMoveResponse[]`; a create page has drafts with no id. Making the card take the response type
would force the create pages to fabricate ids inside an object named `…Response` — which is precisely the
"a baseline and its draft" confusion this repo has been bitten by twice. A three-field view model costs
each host one `computed` of three lines and keeps the card ignorant of both.

**Five inputs, three outputs — settled, decision L-D1.** That is a departure from §13.3's five-and-four,
and it is a subtraction. `(editRequested)` and `(editCancelled)` collapse into the two-way
`[(editingKey)]`, exactly as `app-image-carousel`'s `[(activeImageId)]` already works on four pages.
Skyler: *"Yes, Luigi's three outputs. Overall, I prefer the two-way binding as a more straightforward
pattern."*

**The second sentence is wider than this component, and it should be read that way.** It is not "this card
may use a two-way binding"; it is a stated preference for the pattern, so **the next shared component with
a request-plus-cancel output pair should reach for `[(x)]` first and justify a pair rather than the
reverse.** Recorded here because an answer to a component question is where a general preference goes to
die. The in-repo citation is `app-image-carousel`'s `[(activeImageId)]` — not a new idiom being
introduced, an existing one being made the default. The one thing to keep checking per case is what the
host loses: a two-way binding cannot distinguish "opened" from "cancelled", so a host that needs to tell
them apart still wants the pair. Nothing in §13 needs that here, and the card's own focus-restore works
because it captures the outgoing key before writing `null`.

The host then writes

```html
<app-custom-moves-card … [(editingKey)]="editingMoveKey" />
```

and needs **no handler at all** for either event — against two handlers at nine call sites under the
four-output shape. What the host gives up is the ability to tell "pencil pressed" from "cancel pressed";
nothing in §13 asks it to, and the one thing a host must do on a successful write — clear the open row —
it does by setting its own signal to `null`.

**`rows`, `editingKey` and `busy` are signal-backed setter/getter pairs**, not plain fields: the card
populates its form from `rows.find(r => r.key === editingKey)` in a `computed`, and a plain `@Input` read
by a `computed` is the documented `mystery-select.component.ts` bug. `ownerType` and `emptyText` are
template-only, so plain decorator inputs are enough. This also matters for the card's own spec: in a
zoneless app a test host that sets a plain field and calls `detectChanges()` does **not** re-render, so
the host must bind signals regardless.

**`ownerType` has exactly one job, and it should be a rendered one.** Nothing in §13.3's design uses the
owner type — no icon, no copy variation. Rather than carry an unused required input, render it:

```html
<article class="bg-surface border border-default rounded-lg p-3"
         data-custom-moves-card
         [attr.data-owner-type]="ownerType">
```

That gives Phase 6's guard a value to assert **before** it normalises the owner token away — the exact
hole my Phase 7 negative control found in the images guard, where normalising `ownertype="X"` made "wired
to the wrong domain" invisible. The images card gets its `ownertype` attribute into the DOM only because
every call site happens to pass it as a *static* attribute; a binding would not appear at all. Rendering
it explicitly removes that dependency on an accident, and `data-custom-moves-card` mirrors
`data-images-card` as the guard's extraction anchor.

## 28.2 The answers §13.3 left open

**Textarea rows: keep `rows="4"`, and add `resize-y`.** The arithmetic, since §13.3 asked for a tuned
number rather than a guessed one. The add form is capped at `max-w-[42rem]` = 672px; at the app's base
size that is roughly 95–105 characters per line, so 4 rows shows ~400 characters. A full Monster of the
Week custom move — a trigger sentence plus 10+/7–9/miss outcomes — runs 250–350 characters, so four rows
holds a complete move with headroom. The siblings' `rows="9"` in a ~230–300px column shows a comparable
400–500 characters; at 672px it would show ~900, which is §13.3's "wall". `resize-y` is the in-repo answer
for a textarea that occasionally needs more
(`mystery-create-locations-phase.html:91`'s `min-h-[100px] resize-y`), and it beats raising the row count
for the rare long move. No `min-h` — `rows` already sets the floor.

**`max-w-[42rem]` goes on the `<form>`, not the `<article>`.** §13.3 says "constrain the form" and that is
right, but it is the sort of thing that gets applied one level up: the row list must stay full width, or
a name, a multi-line description and an action cluster stop fitting on one line, which was §13.2's whole
argument for full width.

**The add form's internal grid.** Keep the siblings' `grid gap-[0.6rem] mt-4 pt-3 border-t border-default`
(`monster-detail.html:190`) rather than inventing a two-column layout for the wider container. Two
reasons: a `<label class="grid font-medium gap-1">` wrapping its input is the idiom at all eight sibling
panels and both create pages, so a single-column stack is what a reader expects inside this shell; and a
two-column Name/Description row would put a one-line input beside a four-row textarea, which is worse at
672px than stacking. The width cap is what fixes the "input stretched to 1400px" problem; the grid does
not need to.

**Row markup.** §13.3's classes, with the three additions it introduced over the shipped row made
explicit because they are required rather than stylistic (§26.2 L14):

```html
<li class="flex items-start justify-between gap-3 border-b border-default py-[0.45rem] last:border-b-0">
  <div class="min-w-0">                       <!-- required: five-for-five min-width:auto record -->
    <strong>{{ row.name }}</strong>
    @if (row.description) {
      <p class="text-muted text-[0.85rem] font-normal mt-[0.2rem] whitespace-pre-wrap">{{ row.description }}</p>
    }
  </div>
  <div class="flex items-center shrink-0 gap-1">   <!-- pencil-then-trash, mystery-create-monster-phase.html:35-55 -->
```

with `@for (row of rows(); track row.key)` — **never `$index`** (14-R4), and the full `.action-btn`
class list on each button, since there is no base rule to inherit (§26.2 L14).

**What the card owns and what it refuses.** It owns its two-state form, its validation
(`Validators.required` on name, `maxlength="255"` on the input to match `[MaxLength(255)]`, no cap on the
textarea per B13), its trimming, its keys-as-given, and its two focus moves (to the form heading on
pencil, back to the row's pencil on save or cancel — `mystery-create-monster-phase.ts:229-234`'s
`afterNextRender({ write })` plus `focus({ preventScroll: true })`). It never injects
`CustomMoveService`, never holds a pending delete, never shows a modal, and has no `mode`. That last one
is §13.4's decision and it survives contact with the code: see §29.

**One accessibility detail §13.3 implies and does not state.** Because the edited row's pencil is
*replaced* by the `Editing` label (the `:35-55` pattern), the focus-restore target does not exist at the
moment Save or Cancel fires — it is re-created when `editingKey` clears. So the restore has to run in
`afterNextRender({ write })` *after* the key change, not in the handler, and it has to find the button by
`[data-move-key]` rather than holding an `ElementRef` captured before the swap. That is the same
"resolve anything positional eagerly, then act after the render" lesson the focus-trap extraction
produced, one surface over.

---

# 29. Host wiring — the asymmetry §13.4 does not spell out

The card has no `mode`, so the difference between immediate and staged lives entirely in two host-side
expressions. Written out, because "the host decides" is the kind of sentence that hides a fork.

| | Detail page (5a–5e) | Create page (5a–5d) |
|---|---|---|
| `[rows]` | `computed(() => entity()?.customMoves.map(toRow) ?? [])` | `computed(() => drafts().map(toRow))` |
| row `key` | the server id | `createCustomMoveDraftKey()`, minted on add |
| `(committed)` | `key === null` → `create(...)`; else `update(...)`; then refetch the entity | `key === null` → append to `drafts()`; else replace in place |
| `(removeRequested)` | set `pendingDelete`, open the page's one modal, `delete(...)` on confirm | splice `drafts()`; **no modal** |
| `[busy]` | `isMutating()` — on all five, after §26.2 L4's migration | `isSaving()` |
| `[emptyText]` | default, `"No custom moves yet."` | `"No custom moves added yet."` |
| failure | toast only; `errorMessage` untouched (§26.2 L1) | nothing — the batch's `draftsFailed` handles it at submit |

Two mappers of three lines each, no branch inside the card, and nothing for the two modes to drift apart
on. §13.4's claim holds.

## 29.1 Detail pages: the write pipeline

```ts
requestDeleteCustomMove(row: CustomMoveRow): void {
  this.pendingDelete.set({
    label: row.name,
    perform: () => this.runCustomMoveWrite(
      (id) => this.customMoveService.delete('Monster', id, row.key),
      'Unable to delete custom move.',
    ),
  });
}
```

— one method, `{ label, perform }`, no `footnote`, routed through the page's existing single
`<app-confirm-delete-modal>` exactly as §4.2 item 3 describes. `monster-detail.ts:325-333`
(`requestDeletePower`) is the literal copy source, and the confirm site needs no change at all because it
calls `pending.perform()` and never branches. §4.2 item 2 is confirmed against the component: with no
`message` and no `footnote`, a custom-move call site binds `visible` and `itemName` only, which is the
least demanding of all eighteen.

`runCustomMoveWrite` is `runAndRefresh` (`monster-detail.ts:399-428`) minus its two `errorMessage.set`
calls: operation → `switchMap(() => service.getById(id))` → set the entity → success toast; on error, an
error toast and `activeMutation.set(null)` **only**. See §26.2 L1 for why the two-line divergence from the
method next door is deliberate and needs a comment saying so.

On `mystery-detail` the same shape, with `reloadMystery()` (§26.2 L12 item 5) in place of `getById`.

**Deliberate non-additions on the detail pages**, so nobody "finishes" them: no inline error surface
(§4.1 item 4, now generalised to five pages); no `list()` call on load — `customMoves` is embedded in all
five detail responses and the first paint is server truth (decision 2, §13.6.2 item 1); no optimistic
local splice.

## 29.2 Create pages: the draft arm, and where location/bystander actually cost more

**Monster and minion.** One key in `saveSubResourceDrafts`'s `forkJoin` (`monster-create.ts:320-373`):

```ts
customMoves: this.runBatch(
  this.customMoveDrafts().map((move) =>
    this.customMoveService.create('Monster', monsterId, { name: move.name, description: move.description }),
  ),
),
```

plus `readonly customMoveDrafts = signal<CustomMoveDraft[]>([])` beside `:77-80`, plus the card in the
template after the grid's closing `</div>` at `monster-create.html:222`, plus §13.4's one-sentence copy
edit at `:31-34`. That is genuinely ~10 lines, and §2.10 item 2 is right about it.

The create-page draft type keeps `monster-create.ts:26-27`'s stated rule — **no `id` field**, because a
fresh create page has no baseline — so it is `{ key: string; name: string; description: string | null }`
and is deliberately *not* the wizard's `CustomMoveDraft extends SubResourceIdentity`. Two draft types
with the same three fields and different identity semantics is the existing situation for powers and
weaknesses (`monster-create.ts:35-38` versus `mystery-create.store.ts:81-84`), and it is correct for the
same reason.

**Location and bystander — and the cost is *not* where §13.1 item 3 puts most of it.** Its four
first-of-kind items are the draft list, the draft **surface**, the batch arm and the combined flag.
Verified: **the draft surface is free**, because the card owns its own form. `location-create.ts:23`
imports `[RouterLink, LocationFormComponent]` and the class comment at `:17-19` records that the page
deliberately shed `ReactiveFormsModule` and `FormBuilder`; the card brings its own, so the page gets an
authoring surface without re-acquiring either. Of the four, three are real:

1. `readonly customMoveDrafts = signal<CustomMoveDraft[]>([])` — new, trivial.
2. `:88-93`'s membership `runBatch` becomes a two-arm `forkJoin`, and `linksFailed` becomes one combined
   flag. This is the real one, and it is ~12 lines with two name changes rippling through `:91-116`.
3. The `:106` copy convergence, with `location-create.spec.ts:327` and `bystander-create.spec.ts:327`
   in the same commit (§13.6.1 Ruling 1).
4. The class comment at `:12-20` becomes false and must be rewritten.

So 5c/5d's create half is smaller than §13.1 item 3 implies, and its *detail* half is bigger than R13
implies (two state migrations, §26.2 L4, plus two spec rewrites, §26.2 L3, plus the images parity table,
§26.2 L2). §5's "estimate 5c/5d above 5a/5b" stands; the weight has moved from the create page to the
detail page.

**One thing to copy exactly and one not to.** Copy `runBatch`'s empty short-circuit — a create with no
moves must fire **no** request, which is the positive half of R5's ledger assertion. Do **not** copy the
create pages' `track $index` or their `×` glyph: §13.3 settles both, and the card is one component, so
there is nowhere for a per-mode glyph to live.

---

## 29.3 5a shipped, 2026-10-11 — what 5b copies verbatim and what it decides

**Results.** Suite 1524 → **1582** (112 files), typecheck clean, three negative controls with their
failure sets predicted in advance, and **39/39** browser checks on the first custom-move UI that has ever
existed. Zero data footprint after cleanup (`custom_moves` back to 0 rows, no `PHASE5A-` residue, 4
mysteries and 4 monsters intact).

**Phase A paid off exactly as predicted (§33.1's closing note).** Because the whole page family already
routes write failures to the toast, the custom-move pipeline is `runAndRefresh` **unchanged** — no
`runCustomMoveWrite` sibling, no two-line divergence, no comment explaining why it differs. The detail
host's three members are the entire immediate-write story.

### Copy verbatim

1. **The three detail-host members**, with the owner type and noun changed: `customMoveRows` (a
   `computed` over `entity()?.customMoves`), `editingCustomMoveKey`, `commitCustomMove`,
   `requestDeleteCustomMove`. The commit handler branches on `commit.key === null` for POST-vs-PUT and
   nothing else.
2. **`runAndRefresh` as the pipeline**, with `onSuccess` carrying `commitSucceeded()`. Do not invent a
   second write path.
3. **`requestDeleteCustomMove` extending the page's existing `pendingDelete`** — `{ label, perform }`, no
   `footnote`, no new modal element, no template change at the modal. 5b (minion) has the identical
   shape; 5c/5d do not, which is R13's migration and the reason they are the expensive pair.
4. **Both templates' card blocks**, including `[busy]="isMutating()"` on detail and `[busy]="isSaving()"`
   on create, and `emptyText` present on create and absent on detail.
5. **The three spec files' structure.** The detail spec's ledger records `getById` alongside the
   custom-move calls, which is what proves the refetch happens — without it a successful write could
   leave the list showing the pre-write state and nothing would notice.
6. **The `never calls list()` assertion.** It is the guard on decision 2: if it ever fails, someone has
   added a redundant fetch and "embedded in the detail response" has quietly stopped holding.

### Decide for itself

1. **Where the card goes on the page.** Monster puts it after the four-panel grid because that grid *is*
   the owned-sub-resource run. Minion is the same; Location/Bystander replace a bare block at a different
   position; Mystery is mid-page (§13.2's table). 14-R7 is the standing note that this looks like drift
   and is not.
2. **The `busy` expression.** Monster and Minion have `isMutating()`; Location and Bystander have only
   `isSaving()` and need §26.2 L4's migration first.
3. **Whether the create page's blurb is edited or introduced.** Minion edits an existing sentence like
   Monster did; Location and Bystander have no draft panels, so the sentence is new (§13.4).
4. **The copy convergence.** Monster needed none — it already said *"some details"*. 5c/5d must converge
   the two *"some of its mysteries"* strings **and** their two specs in the same commit (§13.6.1).

### Two things 5b should expect to be different from what it assumes

- **The empty-state attribute collision** (§28.1 item 2) exists on every detail page, because every one
  of them also mounts the images card. Nothing to do now that the attribute is namespaced — but any *new*
  probe hook added to the card in 5b–5e needs the same treatment, and a unit spec cannot see the problem.
- **Adding `CustomMoveService` to a host breaks no existing spec.** Confirmed again here: all 1524
  pre-existing tests passed untouched after wiring both monster pages, because Angular 22 root-provides
  the whole `HttpClient` chain (§26.1). Only specs that *exercise* the card need the stub, which is what
  keeps 5b–5e off the 23 fixture files.

## 29.4 5b shipped, 2026-10-11 — the handoff held, with one structural surprise

**Results.** Suite 1582 → **1612** (114 files), typecheck clean, three negative controls, **35/35**
browser checks **on the first run** — 5a's three Playwright rules transferred without a retry. Zero data
footprint (`custom_moves` 0 rows, no `PHASE5` residue, 4 mysteries / 4 monsters / 6 minions intact).

**Everything on §29.3's copy-verbatim list transferred unchanged**, which is the main thing worth
recording: the three detail-host members, `runAndRefresh` with `onSuccess`, the `pendingDelete`
extension, both template card blocks, and the three spec structures including the `getById` ledger entry
and the `never calls list()` guard. Nothing needed to diverge, and nothing on the decide-for-itself list
turned out to be a real decision — Minion matches Monster on placement, has `isMutating()` already, and
*edits* its create blurb rather than introducing it. **The pilot's shape was right.**

The only differences were this domain's own shape, not the feature's: a minion belongs to a **monster**
rather than to mysteries (so there is no `mysteryIds`, no `MysteryService` and no membership flow), its
type is a nested `minionType` object, and it is created under its parent at
`POST /api/monsters/{id}/minions` from a route-locked create page.

### The structural surprise, found by a control that under-fired

I predicted **3** failures from wiring the minion card as `ownerType="Monster"` and got **1** — the
rendered-attribute assertion, and nothing else. The reason is worth carrying into 5c–5e and Phase 6:

**The card's `ownerType` and the host's service owner type are two independent literals.** The card's is
presentational — it renders `data-owner-type` and nothing more; the *writes* take their owner from the
host's own `create('Minion', …)` in TypeScript. So a page can render one domain and write to another, and
neither literal guards the other. Confirmed by the converse control: changing the host's literal to
`'Monster'` failed **exactly 2** tests, both ledger assertions, and left the attribute test green.

So each half needs its own assertion, and 5a/5b have both: `data-owner-type` for the rendered half and
the exact-call ledger for the write half. **Phase 6's guard should not assume the attribute covers the
write path** — asserting `data-owner-type` per page proves the card is labelled right, not that the page
writes to the right owner.

### One process note for 5c/5d

I started 5b by `sed`-deriving the minion detail spec from the monster one, and threw it away. The rename
produced a duplicate `MinionService` import, a fixture with `minionArchetype`/`minionTypeId` fields
`MinionDetailResponse` does not have, a stub for a non-existent `getByMinion`, and a `MysteryService`
provider the page never injects. **The 2026-10-06 lesson generalises: a derived spec needs its *provider
list* and its *fixture shape* re-checked, not only its identifiers** — and 5c/5d diverge more from the
pilot than 5b did, so the temptation will be stronger and the payoff smaller. Write them.

---

## 29.5 5c shipped, 2026-10-11 — the first real divergence, and a principle worth more than the phase

**Results.** Suite 1612 → **1646** (116 files), typecheck clean, four negative controls, **33/33**
browser checks. Zero data footprint (`custom_moves` 0 rows, no `PHASE5` residue, 4 mysteries / 4
monsters / 6 minions / 20 locations intact).

### The design principle, which is the durable output of this sub-phase

R13's migration needed three assertions changed in a spec this phase was not scoped to touch, so it
hit the hard stop. Skyler authorised it with a reason that is wider than the page:

> *"It's always a difficult call on when to use a store versus component state management, but I
> think the call is correct. We now have a different object that needs to be managed, and if you're
> not careful, you will end up hooking into multiple stores, when it would just have been more
> straightforward to move the state management to the locus of control."*

**That is the general form of two rules this plan already had in narrower terms**: decision 14's
*"one confirm/inform modal per page"*, and the standing note `location-detail.ts` carried on its
`imagesStore` field (*"if this page ever grows a second delete flow… it should move to the
page-owned pattern"*). Both said the same thing about one page and one modal. Stated generally —
**a page that gains a second kind of object to manage is better served moving state to the locus of
control than hooking into multiple stores** — it also answers the question those two cannot: what to
do when there is a *third* object, or a store that is not the images store. Recorded at the
migration site (`location-detail.images.spec.ts`'s describe block) as well as here, because that is
where someone will be standing when they need it.

### What the five divergences actually cost

| | Cost vs. what I wrote |
|---|---|
| Replacing the read-only block | **As written.** And the claim I was told to re-verify held: `location-detail.images.spec.ts`'s placement assertion passes **untouched**, because the card keeps an `<h3>Custom Moves</h3>` at exactly the old block's position. Confirmed in the browser too. |
| `isSaving` → `activeMutation` | **More.** See below — it reached a spec outside the named set, and I kept an alias rather than edit it. |
| R13's `pendingDelete` migration | **More.** §26.2 L2 undercounted the specs it touches; see below. |
| Copy convergence | **As written.** One string, one spec assertion, both in the same commit. |
| Images parity table | **As written**, plus the rationale comment reframed from *split* to *converging*, with the `'store'` branch marked as kept-only-until-5d. |

**And one thing that cost *less*: §13.1 item 3's four first-of-kind items on this page are three.**
The draft list, the second `forkJoin` arm and the combined failure flag were all new — but **the
draft *surface* was free**, because `app-custom-moves-card` owns its own form. `location-create`
still needs no `ReactiveFormsModule` and no `FormBuilder`, which is the one thing its now-rewritten
class comment said that remains true.

### Correction to §26.2 L2: R13 touches three spec files per migrated page, not one

L2 named `resource-images-four-domain-parity.spec.ts` as the spec that *"reflects over the component
instance, which R13 changes on purpose"*, and was right that the confirm-modal census is unaffected
because it compares rendered DOM. What it missed is that **`location-detail.images.spec.ts` reflects
over the instance too** — in a `describe` block named for the ownership R13 inverts. Grepped in
full, the complete set is:

```
location-detail.images.spec.ts      :209 :217 :234   ← 5c
bystander-detail.images.spec.ts     :209 :217 :234   ← 5d inherits the identical three
resource-images-four-domain-parity  :412             ← the one L2 enumerated
```

So **5d meets a known three rather than discovering them.** Worth noting which half of that block
survives untouched: its other three tests (`:221`, `:238`, `:252`) read the *rendered dialog* rather
than the store, so they pass unchanged — R12's "rendered DOM is unaffected" observation is correct
for exactly half of it, which is why a grep for the *signal* and not for the feature was what found
the rest.

**There is no design that avoids this**, and the alternatives are worth recording so 5d does not
re-litigate: a second pending record for custom moves only means two pending-delete concepts on one
page (forbidden by decision 14, and it would add a census entry against R12); routing custom-move
deletes through the store's wrapper means widening `PendingImageDelete` — an image-shaped type — to
carry an unrelated row.

### Follow-up: collapse `location-detail`'s `isSaving` alias

`isSaving` is now `readonly isSaving = this.isMutating` — an alias, not state. It is kept because
**five assertions in two shipped specs outside this phase's scope read it**, and editing specs the
phase was not scoped to touch is what the hard stop exists to prevent.

Collapsing it touches **six places in those two files**: those five assertions plus one test *name*
(`it('image writes stay clear of the page's own isSaving')`). No behaviour change. The count came
from removing the alias and reading the compiler's list — a grep over-counted by including the test
name, which is the same "grep the number, not the assertion" trap one direction over. `bystander-detail`
will need the identical treatment in 5d, so the follow-up should do both pages at once.

### Negative controls, and what two of them taught

Four, and the two that mis-predicted were the informative ones:

| Control | Predicted | Actual |
|---|---|---|
| The new arm **replaces** the membership `runBatch` instead of joining it | 2 | **9** |
| Rebind the modal back to `imagesStore.pendingDelete()` | — | 8 (mislabelled by me as expect-to-pass; it is a planted break) |
| Does the store's `requestDelete`/`confirmDelete`/`cancelDelete` wrapper still have production callers? | still live | **3 callers, all `bystander-detail.html`** |
| Remove the `isSaving` alias | 6 refs | **7** (5 shipped + 2 mine) |

- **The first fired 4× wider than predicted, and that is reassuring rather than alarming.** Dropping
  the membership arm breaks four *pre-existing* `location-create.spec.ts` assertions — so the "one
  arm replaces the other" failure mode this page could uniquely have was **already** guarded before
  5c added its two-arm ledger. The new assertion is belt-and-braces, not the sole guard.
- **The third refines §26.2 L5's timing.** L5 says the store wrapper goes production-dead "after
  5c/5d". After 5c alone it has exactly three callers left, all in `bystander-detail.html` — so it is
  half-dead now and fully dead after 5d, which is when F-L2 becomes actionable.

### One check the browser could not make

**Both delete flows through the same page-owned modal** — no location in the dev database has an
image, so the image half was unreachable without uploading one and cleaning it up. It is covered at
the unit level by both specs: `location-detail.custom-moves.spec.ts` asserts the shared record and
`location-detail.images.spec.ts`'s rewritten block drives the image flow through
`component.pendingDelete()` against a seeded fixture. Recorded rather than silently skipped, because
"the modal serves two flows" is the whole point of the migration and a reader should know where it
is actually proven. **5d closed this** — see §29.6.

---

## 29.6 5d shipped, 2026-10-11 — inherit-rather-than-discover, measured

**Results.** Suite 1646 → **1680** (118 files), typecheck clean, **33/33** browser checks plus an
**11/11** follow-up run, and the card is now on all five detail pages and all four create pages —
**all nine call sites**. Zero data footprint after cleanup, with one incident worth recording below.

### The inherit-rather-than-discover claim, tested

§29.5 predicted 5d would meet known problems rather than find new ones. It did, exactly:

- **The authorised spec-edit set was the actual set.** Six failures appeared after the production
  change, and all six were pre-authorised: the parity spec, `bystander-create.spec.ts`'s copy, the
  three in `bystander-detail.images.spec.ts`, and `bystander-detail.spec.ts`'s read-only assertion.
  **No seventh shipped expectation needed changing**, so the hard stop never triggered.
- **The three images-spec assertions were character-identical to location's**, as forecast, and
  took the identical treatment.
- **`bystander-create` was first-of-kind for three items, not four** — 5c's correction to §13.1
  item 3 held on the second page, which is what makes it a correction rather than a one-off.

So the divergence 5c paid for was genuinely a one-time cost, not a per-page one.

### 5d retires the store-owned branch entirely

With Bystander migrated, **all four image-bearing pages own their `pendingDelete`**, so the parity
spec's `modalOwner` column is gone rather than converged — there is no longer a per-domain
difference to record. The `Domain` interface loses the field, the table loses the column, and the
test asserts a uniform property instead of a split.

**Confirmed by control rather than asserted:** renaming `ResourceImagesStore`'s
`requestDelete`/`confirmDelete`/`cancelDelete` produced compile errors in **exactly one file**,
`resource-images.store.spec.ts` — no page spec, no template. So the wrapper is now **fully
production-dead**, which is what §26.2 L5 forecast for "after 5c/5d" and what 5c's control measured
as half-dead (3 callers, all bystander). **F-L2 is now actionable**, and its scope is precisely:
three methods, the `pendingDelete` signal they drive, the exported `PendingImageDelete` interface,
and the assertions in that one spec.

### The `isSaving` alias, now on both pages

`bystander-detail` takes the same `readonly isSaving = this.isMutating` alias as `location-detail`,
for the same reason. **The follow-up should collapse both pages in one pass** — it is a rename with
no behaviour change, and splitting it across two commits would leave the codebase briefly
inconsistent for no gain. Deliberately not done here: 5d's authorised set did not include it, and
the whole point of the hard stop is that "while I'm in here" is not a scope argument.

### One process failure worth recording: a crashed probe leaves its footprint

The first run of the 5d browser script **timed out mid-run** and never reached its cleanup step,
orphaning one `PHASE5D-` bystander and its two staged custom moves. The second run passed and
cleaned up after itself, so the suite and the browser checks were all green while the database still
held residue.

**The prefix convention is what made it findable** — the audit query caught it immediately, and
bystanders reading 16 against the expected 15 was the tell. Cleaned up through `psql` in the order
the service does it (owned rows, then bridge rows, then the entity), since the API was already down.

**Two things to carry forward.** First, **the audit is not a formality** — it is the only thing that
catches a probe that died before its own cleanup, and "the checks all passed" is not evidence that
the database is clean. Second, a cleanup step at the *end* of a script only runs on the happy path;
anything that can crash before it should either clean up first or register the cleanup up front.

### What the derivation got wrong, again, and the sharper rule

5b ruled "write the specs, don't derive them". 5d is the first case where deriving was right —
`location-*` and `bystander-*` had become genuine structural twins — and the rename still left:

- every fixture **value** (`'The Old Mill'`, `'Lair'`, `'to collapse'`, `'lt1'`, `'l1'`), which
  typechecks perfectly against the bystander field names and is nonsense as data;
- **`'APP-LOCATION-FORM'`** — an all-caps literal matching neither a `Location`→`Bystander` nor a
  `location`→`bystander` substitution. **A case variant the identifier rename cannot see**, and the
  only one that actually failed a test rather than merely reading wrong. The same literal bit the
  browser script, in the same way, ten minutes later.
- the file header, which still said "Phase 5c" and claimed the file had been hand-written.

**So the rule sharpens rather than reverses: derive only between pages that are already twins, and
then re-check the literals, the case variants and the prose — the identifiers are the easy part.**

### The check 5c could not make, now made

**Both delete flows through the same page-owned modal, in a real browser.** 5c had to leave this at
unit level because no location in dev data has an image; exactly one bystander does, so 5d ran it:

```
PASS  page mounts exactly ONE confirm modal element
PASS  IMAGE delete opens that one modal, titled Delete "anna_quillen.png"?
PASS    and carries the image footnote only the image flow sets
PASS  CUSTOM-MOVE delete opens the SAME one modal, titled Delete "PHASE5D-Shared Modal Probe"?
PASS    and does NOT leak the image footnote
PASS    while still claiming permanence
```

That is decision 14 and the whole ownership migration demonstrated end to end: one element, two
object types, the right title and footnote for each, and no bleed between them. The image dialog was
cancelled rather than confirmed, so no image was touched.

---

## 29.7 5e shipped, 2026-10-11 — the ninth call site, and the gate that turned out not to bite

**Results.** Suite 1680 → **1700** (119 files), typecheck clean, two negative controls both matching
their predictions, **30/30** browser checks on the first run. Zero data footprint. **All five detail
pages and all four create pages now carry the card — nine of nine call sites, and §§5a–5e are
complete.**

### §4.1's list was three; L12 made it five; five is what it was

Confirmed by building it. The page had no mutation state, no notifications, no modal and no stored
route id — its only control was the *Continue in wizard* link. All five were needed:
`activeMutation`/`isMutating`; `NotificationService`; `ConfirmDeleteModalComponent` plus the
page-owned `pendingDelete` quartet; the **`mysteryId` signal**, because `ngOnInit` read
`params.get('id')` inside its pipe and discarded it; and a **targeted refetch**.

**Nothing beyond the five was needed**, which is worth recording because it is the first sub-phase
where the estimate was exactly right rather than over or under.

**The refetch is the one that deserved its own method.** The other four pages route custom-move
writes through their existing `runAndRefresh`; this page has none, so 5e added `runCustomMoveWrite`
— and it reloads **only the mystery**, not the page's four-arm `forkJoin` plus minion fan-out.
Monsters, locations, bystanders and minions cannot change because of a custom-move write, so
re-running those arms would be wasteful *and wrong*: a failure in any of them would surface as a
custom-move failure. Asserted, not just commented.

### The deliberate non-addition, demonstrated rather than reasoned

R14's constraint is that no new inline error surface appears on this page, because
`mystery-detail.html:6` orders `@else if (errorMessage())` ahead of the content branch. Phase A took
that hazard out of the other four; this page never had a write path, so 5e's only job was not to
introduce one.

Both halves are now pinned. **Negative control A** — setting `errorMessage` on a failed write —
failed **exactly 2** tests, as predicted, both the survival assertions. And the browser run showed
the positive form: a routed 500 leaves the title, the concept section, the card and the user's
typing in place, with the failure reported only as a toast. The complement is asserted too: a
*load* failure still renders inline, so `errorMessage` is not unused — it is load-only, which is
now true of all five pages and makes that branch mean exactly "this page could not be loaded".

### The census was this sub-phase's gate, and it does not bite. Measured.

R12 named `confirm-delete-modal.call-sites.spec.ts` as 5e's gate, warning it would *"fail on a change
that looks unrelated to it"*. **It did not fail at all.** The production change — a new modal element
on `mystery-detail.html` — left the entire suite green until I edited the literal by hand.

The reason is in that spec's own §8.8 note, one step further than it goes. Its two count assertions
are `Object.keys(perTemplate).toHaveLength(16)` and a `reduce` over the same literal — **facts about
the object three lines above them, compared against themselves**, which is precisely the rot §8.8
diagnoses. The fix recorded there ("the derived half now lives in
`mystery-create-phase5b-monster-phase.spec.ts`") only ever covered the **wizard** rows, because that
is where a rendering harness already existed. The ten — now eleven — non-wizard rows stayed
self-referential.

**Confirmed by control B, which I predicted would pass and did:** with the census left at 19-in-17,
*deleting* the modal element from the template failed **2 tests, both in
`mystery-detail.custom-moves.spec.ts`, and zero in the census**.

So the census's real value is the **transcribed per-call-site input sets** — which did their job here,
since mystery's entry is `name-only` and the one-element assertions are what caught the element
moving. What it cannot do is notice a template gaining or losing a call site.

**Where the detail pages are actually guarded:** each of the five asserts
`app-confirm-delete-modal` appears exactly once in its own `*.custom-moves.spec.ts`, derived from
rendered DOM. That is a real check, just distributed — it catches "this page grew a second element"
and cannot catch "a new page appeared with one". Recorded in the census spec itself, next to the
assertions that do not self-check, so the next reader is not misled the way R12 misled me.

**Follow-up F-L4: centralise the detail-page half of the census.** Render the five detail pages and
count their modals, the way `resource-images-four-domain-parity.spec.ts` already renders four of
them. Not done here because it needs a provider set for five pages — that spec's shape, not the
census file's — and because 5e's authorised edit set did not include building a new harness.

### The two adjacent specs, with L12's corrections holding

- **`escape-nesting.spec.ts` needed a qualifier, not a row.** R12 said 5e makes the
  upload-modal-plus-confirm-modal pairing true of a fifth page. It does not: **mystery has no
  images** (§2.8), so it gets a confirm modal and no upload modal, and the pairing this file tests
  does not exist there. Its "all four detail pages" now reads "all four **image-bearing** detail
  pages", with a note saying why there is no fifth case — because reading it the other way invites
  someone to add an upload modal to `mystery-detail` to satisfy a census.
- **`custom-select-escape-surfaces.spec.ts` needed nothing**, and that is stated here so nobody adds
  an entry: its unit is templates rendering `<app-custom-select>`, and the card renders none.

### Placement, which was mine to decide

**After Countdown, above the four linked-entity articles** — Rosalina's §13.2 position, adopted
because her *rule* is what generalises rather than because it was already written down. The other
four pages put the card below the form; this page has no form, so "below the form" has no referent.
Her fallback is the principle `monster-detail.html:19-25` states for Images: **this card is about the
same record the title names, while every row in the grid below is an entity-link to a different
record.** So the mystery's own content — concept, hook, overview, countdown, and now its moves —
comes first, and the links to other records follow. Verified in the browser as
`Overview | Countdown | CARD | Custom Moves`.

That leaves the card last on monster/minion and mid-page here, which 14-R7 already logs as not being
drift: each page keeps its own existing answer to roster-versus-sub-resource order.

**The plain `<h3>` (L-D2) is now visible in context**, and the browser run asserts both halves: the
card's heading carries no icon, *and* the page's other headings do — so the contrast is real rather
than theoretical. Skyler's note that he can circle back stands; §26.2 L14 prices it.

### The 5d cleanup lesson, applied

The browser script registers its cleanup **before anything that can fail**: a `sweep()` that deletes
every `PHASE5E-` move runs once up front and again in a `finally`, so a run that dies mid-way leaves
nothing behind and the next run starts clean regardless. 5d's incident — a timed-out run orphaning a
bystander while every check stayed green — is the reason. Both sweeps reported "nothing", which is
what a working version looks like.

## 29.8 5f-0 shipped, 2026-10-12 — the restructure, proved by an oracle that predates it

**Results.** Suite **1700 → 1700** (119 files), typecheck clean, **both ledger specs byte-unchanged**
(`git diff --stat -- '*ledger.spec.ts'` empty at the commit), two files touched, nothing backend, no
custom-move code of any kind. Three negative controls, all three predicted in both directions and all
three matching. One real behaviour difference found by the oracle mid-build and removed.

### The gate held, and it bit once before it held

The first working version failed **35 tests across four files, one of them the oracle itself.** Single
cause, and worth recording because it is the kind of difference that is invisible to reading:

`saveMonsterDraft` returns the **response's** id (`monster.id`), so copying its shape made the per-row
save return `location.id` from the `PUT` response. `backfillDraftIds` never did that — it left a
persisted draft's id alone and only filled in ids for the id-less ones. The ledger fakes answer
`update` with the sentinel `{ id: 'loc-updated' }`, so every persisted draft was re-keyed to
`loc-updated`/`bys-updated` the moment it was submitted, and every later assertion about *that row* —
dispositions, baselines, attach-picker contents — went with it.

In production the two ids agree, which is exactly why this one needed a measurement rather than a
reading. The shipped code keeps the id it PUT at:

```ts
const persistedId = draft.id;
const saved$ = persistedId !== null ? forkJoin({ … }).pipe(map(() => persistedId)) : create(…);
```

**This is the first time in 5a–5f that a fake's deliberately-distinct return value caught a real
difference**, and it is the standing `toad-fake-repositories-must-mirror-real-return-semantics` rule
pointing the other way: the fake does *not* mirror the real response here, on purpose, and that
non-mirroring is what made the difference observable. Both halves of that rule are about the fake
being *informative*, not about it being identical.

**`saveMonsterDraft` has the same property and nobody has checked it** — recorded as **F-L7**, not
fixed here. Phase 1 is out of 5f-0's scope and its own ledger is green, so changing it would be a
behaviour change smuggled into a no-op commit.

### The three conditions, two of them now measured rather than reasoned

§35.2 named three. All three held; two stopped being arguments.

**Condition 1 — the order changes and the oracle is blind to it.** §26.2 L10 and §35.2 both reason
this from `forkJoin`'s source-order subscription. I measured it instead, with a throwaway probe spec
run against both the old store and the new one on the same scenario (three persisted locations, second
submit):

| | wire order |
|---|---|
| before | `update:a, update:b, update:c, link:a, link:b, link:c` |
| after | `update:a, link:a, update:b, link:b, update:c, link:c` |

Same multiset, different sequence — Yoshi's framing exactly, now with the two sequences written down.
A second control swapped the two keys inside the per-row `forkJoin` (link before update): **predicted 0
failures, got 0**, which is the same claim from the other side.

**Condition 2 — the oracle does catch an entity-level dirty check.** Control: save only the drafts with
no id, the archetypal "don't write what hasn't changed, one level up" mistake. **Predicted 9 failures in
`mystery-create-phase4-ledger.spec.ts`, and named all nine in advance; got exactly those nine** — A5/A6,
A5-two, D9, D11, the mixed roster, S2, **S4**, the bystander-drain row, and D10·S3. (Plus 6 in
`mystery-create-phase4.store.spec.ts` and 1 in `mystery-create.store.spec.ts`, which I did not predict.)
§35.2 names S4 and A6 as the two that catch it; they do, and seven others do too.

**Condition 3 — the short-circuit is load-bearing, and it does *not* fail the way the doc says.** §35.2
says a bare `forkJoin([])` would turn an empty collection into "a hang… reported as a timeout rather
than as a diff." Control: replace the two new `runBatch` call sites with bare `forkJoin`. **Predicted at
least the G1 tracker-jump test, on its `pendingRemovals` assertion; got 10 failures including it** —
and **not one of them was a timeout.** The reason is worth having written down, because it makes the
hazard worse than advertised:

> `forkJoin` subscribes all of its sources before any of them answers, so **every request still goes
> out**. The ledger is complete and correct. What silently stops happening is everything in the
> subscriber: `clearDrainedRemovals`, the writeback, `advancePhase`. A request-level oracle sees
> nothing wrong, and the failures land on *state* assertions in other files — G1 bookkeeping, the
> attach picker, the minion baseline leaks — none of which name the actual fault.

`sub-resource-diff.ts`'s `batch` now carries that, measured, rather than the timeout prediction.

### Two deviations from §30.2, both forced

1. **`saveLocationRow`, not `saveLocationDraft`.** §30.2 names the per-row method `saveLocationDraft`
   and that name is already a **public** method — the composer commit at `:1472`, called from the
   locations phase component and from four specs including the oracle. The monsters path resolved the
   same collision by renaming the public one `saveMonsterDraftToList`; doing that here would edit
   `mystery-create-phase4-ledger.spec.ts:292`, which is the one thing 5f-0 may not do. **The gate chose
   the name.** Convergence is **F-L6**, for after the gate is discharged.
2. **The outer `forkJoin` stays flat** — `{ drained, unlinked, saved }`, not phase 1's nested
   `switchMap`. Phase 1 nests because minions cannot be saved until every monster has an id; locations
   and bystanders have no dependent second collection, so the nesting would move the writeback into an
   async step for nothing. The two-stage shape 5f-0 exists to create is *inside* the per-row save, which
   is where 5f-3a needs it; it was never the outer pipeline's shape.

### What is left behind for 5f-3a

One line in each per-row save:

```ts
// 5f-3a's seam: `switchMap` into the row's custom-move diff here, with the id in hand.
return saved$.pipe(map((id) => ({ index, id })));
```

…and `SavedFlatRow { index; id }`, one type for both rosters, which grows the custom-move baseline
field in 5f-3a. `backfillDraftIds` left with its last caller; `applySavedIds` replaces it, shared by
both writebacks, carrying the index phase 1 already carries.

**Nothing in the census moved**, because no template changed — the suite's green run includes it. §35.6
is right that the census's wizard rows are the live half for 5f; 5f-1 is where that bites, not here.

## 29.9 5f-1 shipped, 2026-10-12 — the new step, and the census blindness it exposed

**Results.** Suite 1700 → **1718** (121 files, two new), typecheck clean, **35/35** browser checks,
zero data footprint, nothing backend. Two commits as planned: the renumber (`476293b`) alone, then
the feature (`bdc823c`). Three negative controls, each predicted in both directions and each exact.

### The renumber: proved complete by a derivation, then by a runtime diff that found what it missed

§26.2 L8's six sites were right, and I re-derived them rather than trusting the number: a script
resolves the phase in scope for every `currentStep.set()` in every spec and asks whether the index is
that phase's **last** step — a question whose answer is the same before and after the renumber, so the
literal `3` appears nowhere in the method. It found exactly the six L8 names, and also the **nine**
phase-0 sites that are *not* submit triggers and must not move, which a `sed s/set(3)/set(4)/` would
have broken.

**That derivation was not sufficient, and the thing that proved it was a control.** The gate was "the
sweep must be provably complete, and a count is not evidence." So: make the silent failure loud. With
`next()`'s in-phase advance replaced by a `throw`, every test that *intends* to submit and no longer
does fails by name. Run it against the old code, run it against the new, compare the sets:

| | failing tests |
|---|---|
| before, phases[0].steps = 4 | **80** |
| after, steps = 5 + the renumber | **80**, byte-identical names |

Zero in either direction. But getting there took a second pass, because the first run of the full
suite after the feature failed **two** tests the derivation could not see: `mystery-create.store.spec.ts`'s
full-flow walk and `mystery-create-phase5b-baseline-leaks.spec.ts:451`, both of which reach phase 0's
submit by **calling `next()` once per step** rather than by setting the last index.

**That form could not have ridden in the renumber commit, and the asymmetry is the point.**
`set(3)` → `set(4)` is a no-op under four steps — step 4 is past the last one, so it still submits,
which is exactly why the renumber lands green on its own. An extra `next()` under four steps is *not*
a no-op: it submits phase 0 a second time. So the two forms genuinely belong in different commits, and
"the renumber is the whole of the sweep" was wrong — the renumber is the whole of the *index* form.

### The fakes, and the bar from 5f-0 applied twice

Hydrating `MysteryDetailResponse.customMoves` failed **37 tests across four files** on the first run.
One cause: five edit-mode `getMystery` fakes predate the field, and because they are untyped
`useValue` object literals **the compiler could not say so** — `mystery.customMoves.map` threw inside
`loadEditData`'s `switchMap` and the whole hydration reported as "could not load".

They gained `customMoves: []`. **No defensive `?? []` in the store**, deliberately: the field is
non-optional on the response and the API serialises `[]`, so tolerating its absence would mask a
backend regression — the inverse of the vacuous-fixture trap, and the same rule
(`toad-fake-repositories-must-mirror-real-return-semantics`) pointing at the production side.

**And `[]` everywhere would have left the whole path covered only by `of([])`**, which is §30.5 item
3's objection. So the new spec's fake does the other half properly:

- the created id is a **sentinel** (`srv-move-N`), never the draft key, so "the draft took the
  server's id" is observable rather than assumed;
- the name and description are **echoed**, because the real API returns the saved row and
  `applySubResourceDiff` makes that response the next baseline. A fake answering `{ name: '' }`
  would make every row read as dirty on the next submit, and `5f1-W4` ("a second submit sends
  nothing") would fail for a reason unrelated to the code.

### The confirm-modal census was the named risk, and the honest answer is "it could not have bitten"

R12's live half is the wizard, derived in `mystery-create-phase5b-monster-phase.spec.ts`. I read it
before trusting it, and it walks **four hard-coded coordinates** — `(1,0)`, `(1,1)`, `(2,0)`, `(3,0)`
— which is every step the wizard had *with a modal*, not every step the wizard had. **Phase 0 was
never visited at all.**

Measured rather than reasoned. Control: put a real `<app-confirm-delete-modal>` host into the new
step `0-4`.

| | predicted | actual |
|---|---|---|
| census as shipped | **0** failures — blind | **0** |
| census walking `store.phases` | **1** failure, naming `0-4` | **1**, naming `0-4` |

So 5f-1 added nothing the census needed to catch, *and* the census could not have caught it. The
derived half now enumerates `store.phases × stepsArray`, with an assertion that the walk was
exhaustive so nothing can pass vacuously. The claim is phrased as "these four coordinates have one
each and every other step has none" rather than as an exhaustive count map — so adding a **step**
does not fail that file for a reason unrelated to modals, while adding a **modal** anywhere does.

F-L4 still stands for the eleven non-wizard rows. This fixes the wizard half's coverage, not the
literal half's self-reference.

### Commit-on-advance: one addition beyond §30.3, and why it is not optional

§30.3 listed the data. Building it surfaced a behaviour question nobody had asked: **what happens to a
move that has been typed into the add form and not added when the user presses Next?**

The four panels this copies (Attacks, Powers, Weaknesses, Armor) **discard** — type a power, press
*Save Monster*, it is gone. I nearly inherited that and should not have, because the difference is
where the commit point sits. Those panels are one of five inside a composer whose own *Save Monster*
button is two inches away. **This panel is a whole step**, so `Next` is the only commit point there
is, and discarding would be exactly what §15.2 R5 refuses — *work outranks the tidiness rule*.

So step `0-4` gets the same three-way rule `next()` already applies to all four composers: empty →
proceed, valid → commit and proceed, started-but-invalid → block with its own message. The resulting
rule is coherent rather than a fourth inconsistency: **a panel inside a composer discards on the
composer's save; a panel that is itself a step commits on `Next`.**

**One real bug caught by its own test while writing it.** The first version asked
`mysteryCustomMoveForm.pristine`, and both commit-on-advance tests failed: `setValue` leaves a form
**pristine**, so the flag reports "untouched" on a form that is holding text. Its four siblings do not
use the flag either — `locationComposerDirty` (`:755`) and `minionComposerDirty` (`:913`) are
value-based computeds, and now so is this. The lesson is narrow and worth keeping: *in this codebase
"dirty" is a question about values, never about Angular's dirty flag.*

### The five-adapter table (§35.4), started at one on purpose

`customMoveSubResource(ownerType)` is in, and the owner-type literal lives in **one adjacent
declaration block** — `private readonly mysteryMoves = this.customMoveSubResource('Mystery')` — never
at a save site. The other four join *that block* as 5f-2 and 5f-3a arrive, not their call sites.
Declaring all five now would ship four unused fields whose shape depends on unscoped work; the
mechanism §35.4 asks for is "all adjacent, none inline", and that holds at one as it will at five.

§35.4's item 1 is in too, and it is the **only** guard on the write half: there is no `data-owner-type`
analogue in the wizard, so `5f1-W1` asserts the recorded owner type **through the real path builder**
(`customMovesPath(seen, id)` compared against `customMovesPath('Mystery', id)`) rather than against
the string `'mysteries'`. The ledger line deliberately omits the owner type, because a transcribed
`'Mystery'` matched against a transcribed `'Mystery'` cannot disagree.

### Two more controls, predicted by name

Run together, predicted **exactly two** failures and named both in advance: delete the dossier's
Custom Moves entry and drop the `'0-4'` `stepTitle` row. Got exactly `5f1-P3` and `5f1-S1`.

- The dossier one is 14-R10 measured: with the entry gone, the moves still save, every request
  assertion still passes, and **nothing but that one test notices**. It is the whole reason the panel
  spec exists as a second file rather than the store spec being the only coverage.
- The title one is why `5f1-S1` walks `phases` instead of asserting `stepTitle()` at `'0-4'`. A
  missing entry resolves to `''` and renders as a blank heading rather than erroring, and asserting
  the literal would prove only that someone wrote the same string twice.

`currentSectionIcon` needed **no** arm, as §30.3 said — phase 0 falls through to `'mystery'`. Recorded
as `5f1-S2`, asserted as a *contrast* (step 4 matches the phase icon, step 3 does not) so "we decided"
and "we forgot" stay distinguishable.

### The browser run, 35/35 first try after two probe fixes

Created `PHASE5F1-The Hollow Choir`, authored two moves, finished the wizard, read them back off the
detail page's shared card, then re-entered edit mode and walked phase 0 with `Next` five times to
confirm hydration. The checks that earned their place:

- **the fifth tracker dot**, read from step 3 rather than step 4 — the current dot carries `.active`,
  not `.complete`, so reading it in place would have asserted nothing about `phaseStepComplete`;
- **exactly two rows on the detail card, not four** — the H2 failure mode is a delete-and-recreate
  cycle, which looks identical until you count;
- **a revisit-and-advance writes no duplicates**, which is the same claim through the browser;
- the dossier in **both** modes, because the create-mode entry passing says nothing about hydration.

Two probe bugs, both mine and both worth recording. The wizard's eyebrow has no stable hook, so it is
read as `h1.previousElementSibling`. And `innerText` **applies `text-transform`** while `textContent`
does not — the dossier's label is `uppercase`, so the unit test's exact-case `textContent` match had
to become case-insensitive in the browser. The same string, two different right answers.

**Cleanup ran before anything that could fail and again in a `finally`** (the 5d rule). Pre-sweep
reported "nothing" on both runs; post-sweep removed the one mystery each time. Audited after: 4
mysteries / 4 monsters / 6 minions / 20 locations / 15 bystanders / 4 images / **0 custom_moves** —
byte-for-byte the state I started from, and `select … where name like 'PHASE%'` empty across five
tables.

**One thing exercised that nothing had exercised before**: deleting a mystery that *has* custom moves,
twice, through Bowser's Phase 2 transaction. 204 both times and `custom_moves` back to zero, so the
cascade is real rather than assumed.

### The one deviation I declined to make

`submitPhase0` chains the drain **after** the countdown, where phases 1, 2 and 3 all make it a
`forkJoin` sibling (H6, §7.7h). That is pre-existing. Adding the moves beside the countdown means one
more sibling whose failure strands a confirmed deletion, so the change *widens* an existing deviation
rather than introducing one — and promoting the drain to a sibling would be a behaviour change on the
failure path that 5f-1 did not ask for and **no spec pins** (nothing makes `upsertCountdown` fail
anywhere in the suite). Stated in the code and recorded as **F-L8** rather than made quietly.

## 29.10 5f-2 shipped, 2026-10-12 — the checklist was short by two, and wrong about two more

**Results.** Suite 1718 → **1738** (123 files, two new), typecheck clean, **48/48** browser checks,
zero data footprint, nothing backend. Six negative controls, each predicted in both directions, each
attributed to a single site.

### The sites, derived rather than read off the table

§26.2 L6's twelve rows were assembled by grepping for the feature. 5f-2 found them a different way,
and the difference is the finding: **the four existing sub-resource collections always travel
together, so any expression naming all four is a place a fifth belongs.** A script walks every
non-spec file in the wizard directory and reports every line naming an `armors` collection — the
last of the four in every one of these runs — together with whether a custom-move mention sits
within a short neighbourhood.

| | lines naming an armor collection, without a custom-move mention nearby |
|---|---|
| before | **95** |
| after | **13** |

The thirteen survivors are explicable and were checked one by one: six are the two Armor *panel
bodies* (armor-specific fields — Soak, Special — with the new panel immediately after each), one is
`toArmorDraft`, and six are the two armor *adapters*' service methods. None is a per-owner site.

**It found two sites the table does not list, and neither is a volume row:**

1. **The roster cards' count summaries — four places**, two templates (`mystery-create-monster-phase.html`
   and the dossier's matching roster entries). §17.2's comment is already explicit that every count
   there comes from the draft's own collections; what it does not say is that a *missing* collection
   reads as a zero. A monster whose only content is two custom moves rendered
   *"Attacks: 0 · Powers: 0 · Armors: 0 · Weaknesses: 0 · Minions: 0"* — an empty monster that is not
   empty. Now `· Moves: N`, before the Minions term on the monster card because Minions is the
   cross-step link and reads last.
2. **The minion removal modal's `[items]`** (`mystery-create-monster-phase.ts`). That list is a
   *promise about what the deletion will take* (§7.7i(3), UX §18.4), not a summary — so a minion
   holding only custom moves promised nothing and took them anyway. The monster modal needs **no**
   twin: its `[items]` is the minion cascade, not a sub-resource list. A decision, not an omission.

### And it is wrong about two of the five it calls silent

**The two previews are compiler-protected, not silent.** Control: strip `customMoves` from
`monsterComposerPreview` and `minionPreview` and nothing else. Predicted a compile failure; got **9
Angular-compiler errors, four of them naming `mystery-create-dossier.html` by line.**

L6's reasoning is that "adding a field to the interface does not force an entry into an inferred
`computed` return." True of the *interface*; false of the *consumer*. A `computed`'s return type is
inferred and that inference flows outward, so the moment the dossier reads `.customMoves` off it, the
omission is a type error. **The protection is conditional and worth stating as such**: it exists only
because the consumer was added in the same change. Add the preview key with no consumer and nothing
catches it — but then there is nothing to catch, which is the honest version of the claim.

So the genuinely silent set is **three per owner**, not five: `editMonsterDraft`,
`resetMonsterComposer`, `writeBackMonsterDrafts`, and their minion twins.

**§26.2 L7's prefix parameter is one line plus four arrows.** L7 says "no behaviour change to the four
existing callers". Adding the parameter made all four stop compiling, because `.map(toNamedDraft)`
hands the array index to the second parameter — `number` is not assignable to `string`, so TypeScript
refused. Had the parameter been untyped or widened it would have compiled and minted every hydrated
row's key as `0-1`, `1-2`… The compiler asked for the arrows, which is the good kind of friction, and
the lesson generalises: **never pass a function with an optional second parameter bare to `.map()`.**

### Proving the silent sites covered — per site, because a combined control lies

The gate was "the silent sites need proving, not listing." One combined strip was not enough, and the
reason is worth more than the result.

**The combined control under-reported.** Stripping every unprotected line at once failed 14 tests —
but `5f2-E2` (the minion pencil loads its moves) **passed**, because the reset omission masked the
edit omission: with `resetComposer` no longer clearing, the composer still held the move the pencil
was supposed to load, and the assertion read a stale value as a correct one. **Two omissions can
cancel, so a combined control measures their interaction rather than their coverage.**

Re-run per site:

| site | stripped alone → failing tests |
|---|---|
| `monsterComposerPreview` + `minionPreview` | **build failure**, 9 errors, 4 naming the dossier template |
| `monsterComposerDirty` / `minionComposerDirty` | `5f2-D1`, `D2`, `D3`, `D4` |
| `editMonsterDraft` + `editMinionDraft` | `5f2-E1`, **`E2`**, `R1`, `R3`, and `5a-U8` |
| `resetMonsterComposer` + `resetComposer` | `5f2-R1`, `R2`, `R3`, `E1` |
| `writeBackMonsterDrafts` | `5f2-W1`, `W2` |
| `writeBackMinionDrafts` | `5f2-W1` |
| the four count summaries | `5f2-C4` |
| `pendingRemoveItems` | `5f2-C5` ×2 |

Every site is covered by at least one test that fails by name when it is removed.

**`5a-U8` failing is the most interesting entry.** Stripping the edit loaders makes
`saveMonsterDraftToList` commit an empty `customMoves` onto a *hydrated* monster whose baseline still
holds the row — so the submit issues a `DELETE` for it. `mystery-create-phase5a-ledger.spec.ts` does
not stub `CustomMoveService`, which is root-provided, so that delete reaches a real `fetch`, fails,
and takes the whole submit with it; the attack id the test reads is then `null`. **That file is now
an implicit guard that the clean path issues no custom-move traffic at all** — effective, and
fragile in a way worth recording: the failure it produces is an opaque network error rather than a
diff. Stubbing it belongs with 5f-3's 80-call-site work, not here.

### `monsterComposerDirty`, the one that destroys work

Measured twice, with the fixture §30.4 asks for — a composer holding **only** a custom move, so it
cannot pass by accident:

- **Unit** (`5f2-D3`): add one move to an empty composer, attach an existing monster, and the
  composer stays open with its move. Omit the clause and `collapseComposerIfUntouched` fires,
  `next()`'s commit rule skips a closed composer, and the move is gone with no message and nothing
  on the wire.
- **Browser** (checks 43–47): the same flow against the dev server, in its own wizard so the roster
  count stays unambiguous. The composer survived the attach, the row survived, and the attached
  monster's own moves stayed separate.

### What the fake does, and why the hydrated fixtures grew a row

The bar from 5f-0, applied in both new specs: the created id is a sentinel (`srv-move-N`), never the
draft key, and the name and description are **echoed**, because `applySubResourceDiff` makes the
response the next baseline — a fake answering `{ name: '' }` would make every row read dirty on the
next submit and fail `5f2-W2` for a reason unrelated to the code.

The same reasoning drove the phase-5a change. §30.4 says extend the `5a-U1` oracle with a fifth
collection rather than write a parallel one, and that costs exactly **two** literal edits: the other
eight comparisons are snapshots, so they start asserting custom-move id survival for free. Its two
hydrated fixtures gained **one move apiece** — an empty collection still fails if the writeback drops
the field (`idsOf(undefined)` throws) but cannot catch the ids being *rotated*, which is the failure
5a exists to prevent.

### The shipped-spec edits, and the one that looks out of place

Five, and four of them are the two compiler-protected sites seen from the spec side:
`MonsterDraft`/`MinionDraft` are interfaces with required fields, so every hand-built fixture stopped
compiling and **the compiler named each file**. That includes
`shared/custom-select-escape-surfaces.spec.ts`, which 5e recorded as needing nothing for this work.
Both are true, and the distinction is worth keeping: *"needs nothing" was a claim about the Escape
behaviour it guards — no new `app-custom-select` surface, no new case, no new assertion. A shared
draft interface gaining required fields reaches every file that builds one by hand, wherever it
lives.* The diff there is two lines inside a `rosterMonster()` builder.

The fifth is the prescribed phase-5a oracle extension.

Two more detail fakes (`mystery-create.store.spec.ts`) gained `customMoves: []` for the same reason
5f-1's five did — untyped `useValue` literals the compiler cannot check against the response
interface. **No defensive `?? []` in `toHydratedMonster`**: the field is non-optional on the response
and the API serialises `[]`, so tolerating its absence would mask a backend regression.

### The browser run, 48/48 — after two probe bugs, both mine

Authored a monster and a minion inside the wizard, each with one custom move, read both back off
their detail pages, re-entered edit mode and finished the whole wizard again to confirm no
duplicates. Then a second wizard for the attach case.

The two bugs are worth recording because both produced *passing* checks:

1. **`app-custom-select` addressed by index.** The attach strip and the two type pickers are the same
   component, so `app-custom-select` first() was the *strip* — the probe attached a catalogue monster
   while meaning to pick a monster type, left the composer invalid, and four later checks read the
   wrong roster card. Every select is now addressed by its id (`#attach-monster`, `#monsterType`,
   `#monsterArchetype`, `#minionType`). **A control and the thing it controls can share a component.**
2. **An absence assertion against a collapsed panel.** "The composer was reset — no rows left behind"
   passed because saving a monster *collapses* the composer, so the panel was not rendered at all and
   the count was trivially zero. It now reopens a fresh composer first. **`count(x) === 0` is
   vacuous wherever the container can be absent** — the same shape as 5e's census blindness, one
   surface over.

**Cleanup ran before anything that could fail and again in a `finally`.** The sweep covers mysteries,
monsters **and** minions, which mattered: deleting the mystery detaches a wizard-authored monster
rather than deleting it, so the post-sweep removed the mystery *and* the monster separately. Audited
after: 4 mysteries / 4 monsters / 6 minions / 20 locations / 15 bystanders / 4 images / **0
custom_moves**, and `name like 'PHASE%'` empty across five tables — exactly the state the phase
started from.

## 29.11 F-L9 shipped early, 2026-10-12 — the stub was one file; the hazard was twenty-three

Pulled forward out of 5f-3b at Skyler's instruction, and his reason is sharper than the one I filed
it under. I recorded it as "effective as an implicit guard, opaque as a failure". The real problem is
that *effective* was conditional: **`CustomMoveService` is root-provided, so an unstubbed `TestBed`
resolves the real one, and the only thing stopping those requests is that nothing is listening on
:5225.** A dev server has been up during four of the last six sub-phases. `ng test` with one running
writes to dev `motw`.

**Commit `18f3753`.** Suite 1738 → **1741** (124 files), typecheck clean, **no production code
touched** (`git diff -- '*.ts' ':!*spec*'` empty).

### F-L9 named one file; deriving the set found twenty-three

A grep for the symptom finds the file that showed the symptom. The derivation asks the question
instead: *which specs can resolve the real service?* Both halves come from source, and both are now
a test (`shared/custom-moves-stubbed-everywhere.spec.ts`):

1. **The injector set, from the application.** Keyed on the **import**, because the wizard store
   writes `inject(CustomMoveService)` and all nine page components use constructor injection. My
   first rule matched only `inject(...)` — it found **one** class out of ten and passed its own
   sanity check, because the check was `length > 0`. A guard's non-vacuity assertion has to name
   something from each end of the range, not count.
2. **A fixed point over `providers:`**, for the transitive case:
   `mystery-create-g1-tracker-jump.spec.ts` mounts `MysteryCreateComponent`, which *provides*
   `MysteryCreateStore`, and so is at risk without ever naming an injector. My first expansion rule
   was "mentions a class already in the set" and went from 10 classes to **66** at-risk specs
   including every hunter spec in the app — a shared `IconComponent` connects anything to anything.
   Providing is the only edge worth walking.

Result: 16 page specs, the 7 wizard specs, and the images parity spec. All 23 now stub it.

### Two tiers, and the ledger tier is the one that answers the brief

- **The two exact-call-ledger files record into their existing `sent` array.** Their oracle is
  already "the complete multiset of calls this transition made", so routing custom-move calls there
  turns roughly forty `expectLedger([…])` assertions into assertions that no custom-move request
  went out — no new tests needed. Plus one named test, `F-L9: an untouched hydrated roster issues
  no custom-move traffic at all`, so the property has a name rather than only a side effect.
- **The other 21 refuse.** No complete ledger to hang the property on, and "this spec expects no
  custom-move traffic" is all they need to say.

### Proved wired, in both directions, because a missing stub looks exactly like a present one

| | measured |
|---|---|
| with the stub | `TestBed.inject(CustomMoveService).create(…)` **throws** — 2/2 probes passed |
| provider removed | it does not throw — **2 failures**, and the derived guard independently named both files |
| recording tier | making every custom move dirty put the stray calls in the ledger **by name** — 12 tests, all legible |

That last row is the implicit-to-explicit conversion, measured. The same class of stray traffic used
to surface as *a null attack id in a weapon-tag test*; it now surfaces as `move.update(...)`.

### The stub that refused the framework

The first version was a `Proxy` answering every property with a throwing function. Angular calls
`ngOnDestroy()` on every provider instance at teardown. **386 tests failed on one stub.** A stub that
refuses everything refuses the framework too; only the service's own four methods should throw. The
comment stays in the code because the next person reaching for a catch-all will reach for a `Proxy`.

---

## 29.12 5f-3a shipped, 2026-10-12 — the split's falsifier, applied and declined

**Results.** Suite 1741 → **1761** (126 files, two new), typecheck clean, **35/35** browser checks,
six per-site controls each predicted by name and each exact. Commit `e7ee48c`.

### The falsifier: applied, and it does not fire

§35.1 made the split conditional on one thing, and left it to me: *decline it if an attached
record's panel cannot be rendered honestly without the fetch.* **It can, so the split stands.**

The reason is that the draft already knows which case it is, and nothing had been reading it. A
location authored in this session has every move the wizard made; one that arrived by **attach** or
by **edit-mode hydration** came from a *list* route, which carries no `customMoves` at all. So
`customMovesLoaded` is a fact about provenance, not a new piece of state to maintain — and the panel
reads it:

> This location may already have custom moves of its own. They aren't shown here — anything you add
> is added to them.

…with the "No custom moves added yet." empty state standing down, because *that* is the claim it
cannot make. Asserted as a **contrast** (`5f3a-P2`): the caveat is present for an un-fetched row and
absent for an authored one. A line that always shows says nothing.

**It settles to `true` after a submit**, and that is the part worth stating: by then the diff's
result *is* the server's view of the row, so the caveat disappears at the moment it stops being
true. 5f-3b sets the flag at attach instead and deletes the line — one switch, not a rewrite.

### The gate, measured twice

§35.1's trace — empty drafts against an empty baseline, so `claimed` is empty, so `deletes` is
empty — is a claim about today's code. `5f3a-G1` makes it a claim about tomorrow's:

- **Unit**: attach, press `Next`, assert **no custom-move traffic at all**. Not merely "no delete":
  a stray `list` or `create` would be 5f-3b leaking in early, which is the other thing worth
  catching.
- **Browser**: a `PHASE5F3A-` location seeded with two real custom moves **through the API**, then
  attached, then `Next`. Both survived; the one added in the wizard joined them rather than
  replacing them; and a full edit-mode revisit still deleted none.

**The browser gate passed vacuously first, and the fix is the finding.** The probe attached the
*first* option in the catalogue — one of the twenty pre-existing dev locations — so "the seeded
location is untouched" was true for the uninteresting reason. The fixture has to be the thing under
test: attach **by name**. This is the non-vacuous-fixture discipline I have been applying to unit
fakes since 5f-0, failing in a browser probe.

### The site derivation transferred, and found nothing — which is also an answer

5f-2's method keyed on `armors`, the last of four collections that always travel together. Locations
and bystanders are flat leaf entities: they had **no** sub-resource collections, so there is no
sibling run to key on. The adaptation keys on the *composer's* own form and editing state, which is
what appears at every site a composer-held collection touches. It went **82 → 45**, and the 45 that
remain are roster-card highlight bindings and composer open/close plumbing — none holds a collection.

It surfaced nothing I had missed, where 5f-2's found two sites. That is not a failure of the method;
it is the method reporting the truth about a different shape of change. **For a domain gaining its
first collection, the compiler is the derivation** — the draft interfaces are required-field
interfaces, so every construction site stops compiling and names itself. The derivation earns its
keep where a *sibling* already exists to be compared against.

### Six controls, one group at a time, every prediction exact

5f-2's best finding was that a combined strip measures interaction rather than coverage — two
omissions cancelled and a stale value read as a correct one. So each group was stripped alone:

| group stripped | predicted | actual |
|---|---|---|
| the two `composerDirty` clauses | D1, D2, D3 | D1, D2, D3 |
| the two `editDraft` loaders | E1, R1, R2 | E1, R1, R2 |
| the two composer resets | E1, R1, R2, P4 | E1, R1, R2, P4 |
| the writeback's three fields | L1, W3 | L1, W3 |
| the panel's caveat line | P2 | P2 |
| the removal modal's item list | P5 | P5 |

**One thing the harness taught me**: the first run reported "(none)" for all six and looked like a
suite that noticed nothing. The reporter colours the word `FAIL`, so `^ FAIL ` never matched the raw
output — ANSI has to be stripped before parsing. *A control harness that cannot see failures reports
a perfectly safe codebase.*

### Two sites beyond the panel, both from 5f-2's habit of deriving

- **The removal modal's `[items]`**, the same promise gap 5f-2 found for minions — but **gated on
  not-persisted**, which the minion version does not need. A minion is never attached, so every
  removal there discards typed work. For an attached location the sentence would be false twice
  over: Detach deletes nothing, and the panel's own caveat says the wizard has not even seen the
  server's moves. Only an unsaved draft's moves are "what you typed".
- **The dossier's two name lists** gain a move count, per 14-R10. Deliberately *not* a count line on
  the roster cards: unlike the monster card, the location and bystander cards carry no counts at
  all, so adding one would be inventing a surface rather than completing one.

### A data incident the audit caught, and the sweep could not have

The post-run audit found **one orphaned `custom_moves` row** — `Mind the Rafters`, owned by
`Alton's Bend`, a pre-existing dev location. It came from the vacuous-attach run above: the probe
attached a real dev location and the wizard correctly wrote a move onto it.

**The sweep could not have found it, and the reason generalises.** Every sweep so far has keyed on a
`PHASE…` name prefix. That works while the run creates everything it touches. It fails the moment a
run writes a *sub-resource onto a pre-existing entity*, because the sub-resource's owner has no
prefix to find it by. What caught it was the entity-count audit — `custom_moves` reading 1 against an
expected 0 — which is the same shape as 5d's bystander count reading 16 against 15.

The rule to carry: **a prefix sweep covers what a run creates; only the count audit covers what a
run modifies.** Both, every time.

## 29.13 5f-3b shipped, 2026-10-12 — the last feature sub-phase, and `list()`'s promise comes due

**Results.** Suite 1761 → **1775** (128 files, two new), typecheck clean, **29/29** browser checks,
seven controls with a self-check in front of them. Commit `38074b5`. §§5f-0 … 5f-3b are complete;
only Phase 6's drift guard remains.

### `list()`'s gate, closed — all three items

Phase 4 shipped `CustomMoveService.list()` deliberately uncovered under L-D3, on Skyler's note:
*"we just need a note to be sure to validate the functionality in 5f-3 and ensure tests have the
correct coverage."* §30.5 turned that into three gate items. All three are now assertions:

1. **A real caller with a non-empty fixture.** `5f3b-F1` attaches and asserts the server's **two**
   rows land on the draft — names, descriptions (`null` → `''`), ids, and a distinct `localKey`
   each. An `of([])` answer would have made every one of those vacuous, which is exactly what
   `toad-fake-repositories-must-mirror-real-return-semantics` warns about and what §30.5 item 3
   names. The browser half seeds two real moves **through the API** and reads them back out of the
   panel.
2. **A failed `list()` admits nothing** (`5f3b-E1`): no row on the roster, the error local to the
   strip, `submitError` untouched, and retry is picking it again (`5f3b-E2`). A row whose move
   baseline is unknown is worse than no row — the next submit would diff against a lie.
3. **The owner type is derived, not transcribed** (`5f3b-F2`): `customMovesPath(seen, 'x')` compared
   against the builder's own answer for each domain, plus the two being different.

And `5f3b-F3` pins the choice §27.2 made: `list()` is called and `getById` does not exist on the
service stub at all. `getById` would re-read the whole row and quietly *repair* the page-load
staleness `phase4-ledger`'s S2 exists to characterise — a fix that would have looked like a bonus
and was really a silent change to what a shipped test means.

### The five ledger entries, and why each is a consequence

`mystery-create-phase4-ledger.spec.ts` is a file whose whole job is to be an unchanged oracle, so
each change wants stating. All five are the same cause — **attach now issues a request** — in the
five flows where the fetch is not cleared by an intervening `sent.length = 0`:

| test | why it changed |
|---|---|
| `A5/A6` | one attach, so one `move.list(Location,loc-a)` joins a ledger that claims to be complete |
| `A5` (two) | two attaches, two fetches |
| `A2/G3` | its expectation was `[]`; now `[move.list(loc-a)]` |
| `D9` | the re-attach that cancels a pending Delete fetches again |
| `S2` | one attach, and the comment now records that `list()` was chosen so S2 stays true |

**`A2/G3` is the one that deserved thought rather than an edit.** Its comment reads *"Not 'no
delete' — **nothing**."* The claim was never "no bytes on the wire"; it was that **no write** goes
out for an entity that never joined the mystery, because a stray unlink would 404 outside the
drain's rule-2 catch and fail the phase. A `GET` of the location's custom moves is not a write. The
comment now says so in those words, so the test still means what it meant.

None of the five is an accommodation: no assertion was weakened, and the complete-ledger property is
intact — `expectLedger` still compares the whole multiset.

### F-L9's stubs did need reworking, and that is how the phase announced itself

The brief said to verify rather than assume, and the answer is **yes, in one file**. F-L9's two
tiers behaved differently:

- The **recording** tier (the two ledger files) needed no change at all. The new call simply
  appeared in `sent`, which is what a recording stub is for.
- The **refusing** tier announced the change loudly: `mystery-create-phase4.store.spec.ts` failed
  **26 tests** naming `Unexpected CustomMoveService.list()` the moment attach started fetching.

**The fix is narrow on purpose: `list` answers, the three writes still refuse.** Softening the whole
stub would have thrown away the property F-L9 bought a day earlier — that file still fails loudly if
an attach ever starts *writing*. And `of([])` is right there and would be wrong as the only fixture
anywhere, which is why the comment says where the non-empty one lives.

The other two attach-driving specs (`phase4.spec.ts`, `phase4-usage-unavailable.spec.ts`) needed
nothing: they stub `ApiService`, so the root service's `list` already answered `of([])`.

### The `Next`-during-attach term, tested the way it would fail

§30.5 calls this a correctness fix and not polish, because `next()` reads the roster
**synchronously**: press it while the fetch is open and the phase submits a roster the pick has not
joined, with no error and nothing on the wire to notice.

So the test holds the fetch open with a `Subject`. **An `of()` stub resolves inside the `subscribe`
call, so the in-flight window never exists** — and a test written against one passes whether the
`[disabled]` term is present or absent. `5f3b-N1` asserts all three moments (enabled, disabled,
enabled again), and `5f3b-N2` pins that the window is real by asserting the roster is still empty
while the button is disabled. The control confirmed it: reverting the term to
`monsterAttachInFlight()` fails exactly `N1` and `N2`.

One small design note: the three domains' flags are read through a single `anyAttachInFlight()`
rather than three terms in the template. One place to be wrong instead of three, and it is the term
`Finish` reads too.

### 5f-3a's caveat inverted rather than disappeared

The brief anticipated one switch — set the flag at attach, delete the line. **Half of that is
right.** Setting it at attach is exactly the switch 5f-3a left. Deleting the line would have been
wrong, because `loadEditData` hydrates locations from `getByMystery` — *also* a list route with no
`CustomMoves` — so a revisited mystery's rows sit in precisely the position attach used to be in.
Deleting the line would make the panel claim completeness it does not have on that path.

So `5f3a-P2` inverts and keeps both arms live: the caveat is **gone** for an attached row (if it
still appeared, the panel would be hedging about something it knows) and **present** for a hydrated
one. Two live cases rather than one live and one retired. Per-row fetching on edit-mode load is a
different cost — N requests on a load that already fans out per monster — and is recorded as
**F-L10**.

### The controls, and the self-check that had to come first

5f-3a's harness reported "(none)" for all six groups and looked like a suite that noticed nothing.
So this one opens with **group 0: a deliberate failure, to prove the harness can see one.** It
earned its place immediately — group 0 also came back empty, and the cause was a *second* harness
bug, not the one I had already fixed: the `FAIL` line's captured text is `describe > test`, so the
id is inside it rather than at the start, and `(/…/.exec(s) ?? [s])[1]` is `undefined` on the
fallback branch. Without group 0 I would have read seven empty results as seven blind spots.

| group stripped alone | predicted | actual |
|---|---|---|
| 0. self-check (deliberate failure) | F1 | F1 |
| 1. the `Next`-during-attach term | N1, N2 | N1, N2 |
| 2. the strips' busy swap | S1 | S1 |
| 3. the strips' local error line | S2 | S2 |
| 4. the in-flight re-entrancy guard | B3 | B3 |
| 5. `customMovesLoaded: true` at attach | L1, L2, P2, F1 | G1, G2, L1, L2, P2 |
| 6. the fetched moves on the draft | G1, G3, E2, F1 | G1, G2, G3, E2, F1 |

Five exact. **Both misses fired wider than predicted, and in the same way**: I forgot that the
G-series assertions I had just rewritten in this session also check the flag and the fetched names.
Over-firing tells you about coverage you did not credit; under-firing tells you about coverage you
do not have. These were the first kind.

### The browser run, 29/29 — after a fourth-in-a-row probe bug

It shows the thing 5f-3a could not: a seeded location with two real server moves, attached by name,
with both rendered in the panel — the caveat gone, the empty state gone, the dossier counting two.
Then one removed and one added, submitted, and the end state read back off the API: the removal
landed, the survivor **kept its id** (not deleted and recreated), and a full edit-mode revisit
changed nothing.

**The probe bug is worth recording because it looked like four code failures.** I hard-coded which
of the two seeded moves the probe would remove; the server returned them in the other order, so the
probe removed the other one and four checks failed describing entirely correct behaviour. Capturing
the rendered order first and asserting against *that* is the fix. Four browser probes in a row have
now failed on an assumption about the environment rather than on the code: the first catalogue
option (5f-3a), a collapsed container (5f-2), a control sharing a component (5f-2), and now a
server-side ordering. **The probe is a test and deserves the same scepticism as one.**

### Dev data

Audited by **count and by content**, per the rule the 5f-3a incident produced: 4 mysteries / 4
monsters / 6 minions / 20 locations / 15 bystanders / 4 images / **0 custom_moves**, and a join of
`custom_moves` against both owner tables returning zero rows. Nothing written onto a pre-existing
entity this time; the probe attached by name throughout.


## 29.14 Phase 6 shipped, 2026-10-12 — the drift guard, and what it can see

**Results.** Suite 1775 → **1790** (129 files, one new), typecheck clean, nothing backend, no dev data
touched and no browser run — the guard is a spec and the polish is copy and docs. Commit `257ff08`.
**Twelve controls**, self-check first; nine exact, one stronger than predicted, one wider, one
build-refused.

### §31.3 was wrong about what a unit test can read, and correcting it changed the design

My own §31.3 states flatly that *"template source is genuinely unavailable to a unit test in this
project — `?raw` imports fail both statically and dynamically, and `import.meta.glob` hangs the
runner. Compare rendered DOM; do not plan on reading templates."*

**F-L9 measured that false a day earlier.** `custom-moves-stubbed-everywhere.spec.ts` globs every
`.ts` in the app with `{ query: '?raw' }` and runs in milliseconds. §31.3 is amended in place. There
is exactly one real constraint, and it is worth more than the retraction: **the call must be written
out in full at the call site**, because it is replaced at transform time. Hoisting it into a
`const glob = import.meta.glob` throws at module load and reports as **a suite with zero tests** —
which is the one failure mode a guard must never have, and the reason that sentence is now a comment
in both files that use it.

Correcting it changed the design, because it buys the half a DOM-parity spec cannot have.

### The two halves, and why the write half needed source

§29.4's discovery, measured by 5b's under-firing control: **a card's `ownerType` and its host's write
literal are two independent strings, and neither guards the other.** A page can render "Minion" and
write into the monster owner space, and no amount of rendered DOM can tell — the DOM contains the
label, not the destination.

So the guard checks both, and checks each against a **third** fact: the domain the file path
resolves to. That is what makes a *self-consistent* lie fail. Control 9 is exactly that case — the
monster detail page relabelled **and** rewritten to `Minion`, so the two halves agree with each other
and both disagree with where they live. It fails `6-C4`, `6-W1` and `6-W3`.

And it reaches the surface §31.3 did not count. **§31.3 says "nine call sites"; the guarded surface
is nine plus five.** The wizard's five owner literals have no card, so no `data-owner-type` exists to
check, and until now they were covered only by per-owner write assertions spread across the 5f-1,
5f-2, 5f-3a and 5f-3b specs — each proving its own site and saying nothing about the *set*. `6-W2`
asserts the set, the adjacency §35.4 asked for (five declarations on five consecutive lines, derived
from their offsets), and that the factory is called nowhere else.

### How it derives its five domains — and everything else

No list, no count a reader must maintain, no golden string:

| what | derived from | cross-checked against |
|---|---|---|
| the five domains | `CustomMoveOwnerType`'s union members | `OWNER_SEGMENT`'s keys |
| which domain owns a file | the domain name in the path, and **no other domain's** | `6-D2` asserts the mapping is unambiguous |
| the nine card call sites | templates containing the **element** | hosts importing the component |
| the expected call-site count | `DOMAINS.length * 2 - 1` | `6-C2` proves the shape that arithmetic encodes |
| the binding set | the first call site | the other eight must agree |
| the owner label | the element's `ownerType` literal | the path-derived domain |
| the write literal | `customMoveService.*('X'` in the host | the path-derived domain |
| the wizard's five | `customMoveSubResource('X')` declarations | the derived domain set |
| the create-page caveat | the first one found | the other three, domain noun normalised out |

**One exemption is derived rather than named.** The wizard store legitimately writes for all five
domains — that is the condition §35.4's adapter table exists for — so the one-domain-per-file rule
cannot apply to it. It identifies itself: *a file that declares `customMoveSubResource` is
multi-owner by construction.* `6-W2` checks its five literals exhaustively instead. A file name in
that position would have been the transcription the whole guard exists to avoid.

### Both of the guard's own first failures were a matcher counting prose

Worth recording as one lesson with two instances, because it will happen to the next person:

1. `app-custom-moves-card` appears in **13** templates and is *used* in **9**. The four wizard phase
   templates name it in comments explaining why they do **not** use it (§35.5). The opening angle
   bracket is the difference between a usage and a reference.
2. `customMoveSubResource(` appears **7** times in the wizard store for 5 declarations and 1
   definition. The seventh is the §35.4 comment explaining that it must never be called inline.

**A guard that reads source is reading prose too, and the prose in this codebase talks about the
code.** Comments are stripped before anything is counted, and both numbers are now right.

### The controls — twelve, self-check first

| group | predicted | actual |
|---|---|---|
| 0. self-check (deliberate failure) | `6-X1` | `6-X1` |
| 1. a sixth union member, map not updated | `6-D1` | **the compiler refused it** |
| 2. a domain loses its card call site | `6-C1`, `6-C2` | `6-C1`, `6-C2`, `6-C3` (+15 others) |
| 3. one call site drops a binding | `6-C3` | `6-C3` |
| 4. one call site labelled with another domain | `6-C4` | `6-C4` (+4) |
| 5. one host writes to another owner space | `6-W1`, `6-W3` | `6-W1`, `6-W3` (+1) |
| 6. a wizard adapter declared for the wrong owner | `6-W2` | `6-W2` (+1) |
| 7. a wizard adapter moved out of the block | `6-W2` | `6-W2` |
| 8. the factory called inline at a save site | `6-W2` | `6-W2` |
| 9. the card **and** the write both relabelled | `6-C4`, `6-W1`, `6-W3` | `6-C4`, `6-W1`, `6-W3` (+6) |
| 10. one create page words its caveat differently | `6-P1` | `6-P1` (+3) |
| 11. one create spec loses its sorted ledger | `6-P2` | `6-P2` |

**Group 1 is the most useful result and it is not a pass.** Adding a sixth member to
`CustomMoveOwnerType` without extending `OWNER_SEGMENT` **does not compile** — the map is
`Record<CustomMoveOwnerType, string>`, so a missing key is a build error. `6-D1` is therefore a
second line of defence, not the primary one, and the primary one is better. Said plainly because the
alternative is a reader believing the spec is what holds that invariant.

**Group 2 is the failure mode this phase exists to prevent**: the parity spec that passes when a
domain is missing. Removing the mystery detail page's card element fails in **three** places
(`6-C1`'s template/host asymmetry, `6-C2`'s per-domain coverage, `6-C3`'s derived count) plus fifteen
of that page's own tests. It cannot pass quietly.

### Polish: what I did, and what I left

**Done:**

- **14-R1's caveat assertion.** The *convergence* landed with 5c/5d — all four create pages already
  say *"some details may not have saved"* — and §13.7 said Phase 6 owns asserting it. `6-P1`
  compares the four **relatively**, with the domain noun normalised out, so rewording all four needs
  no edit and rewording one trips it. (And a normalisation bug of my own: the caveat names the domain
  *twice*, capitalised and lowercase, so lowercasing has to come before the split.)
- **R5's cross-domain half.** The duplicate-draft-arm hazard is already pinned per page by a sorted
  exact ledger; `6-P2` asserts that **all four** create specs carry one and count the POSTs, which is
  the assertion a duplicated arm actually trips and the one `toContain` cannot make.
- **F3.** The two stale deferral notes in `docs/phases/phase-8-minions-ui-flow.md` and
  `phase-9-bystanders-locations-ui-flow.md` are retired. Both deferred this UI *"pending API
  endpoints"* — a premise that was already false when they were written. Marked superseded with the
  old text quoted, rather than deleted, so a reader arriving from an external reference lands on
  what changed.

**Left, deliberately, and none of them is inseparable from the guard:** F-L4 (the census's eleven
self-referential rows), F-L6, F-L7, F-L8, F-L10, F-R1, F-R2/14-R3 (the double toast), F-R3, the
`isSaving` alias collapse, F-L2's now-dead store wrapper, and F5. **I checked F-L4 specifically**,
because it is the one closest to this phase's subject and the temptation was real: it is about
`ConfirmDeleteModalComponent`'s call-site census, a different component with a different guarded
property, and folding it in would have meant this guard growing a second subject. The right shape is
the one it already has — F-L4's fix is to render five detail pages and count modals, which is the
*images* parity spec's shape, not this one's.

---

## 29.15 What is guarded by a derivation, and what by a transcription

The thing a future reader most needs, and the honest version of it. "Derived" means the guard reads
the application and compares it against itself, so it keeps working when something new is added.
"Transcribed" means a human typed the expected answer and must retype it.

### Derived — these keep working when a sixth domain or a tenth call site arrives

- **The five owner types.** `CustomMoveOwnerType` against `OWNER_SEGMENT` (`6-D1`), and the compiler
  underneath both.
- **The route segments.** `core/custom-moves.spec.ts` derives four of the five from
  `resourceImagesPath`'s shipped map rather than re-typing them (§27.3), and `customMovesPath` is the
  only builder (`6-S1`).
- **The nine card call sites**, from the templates that render the element against the hosts that
  import it (`6-C1`), with per-domain coverage (`6-C2`) and a count that is arithmetic over the
  domain set (`6-C3`).
- **Every call site's binding set**, relative to the others (`6-C3`), with `emptyText`'s designed
  difference asserted rather than merely excluded.
- **Every owner label and every write literal**, each against the path-derived domain (`6-C4`,
  `6-W1`, `6-W3`) — so a self-consistent mislabelling fails.
- **The wizard's five owner literals**, their adjacency, and the absence of inline factory calls
  (`6-W2`).
- **Which specs may reach the real `CustomMoveService`**, from the application's own injector set
  (F-L9's guard) — the only reason a dev server being up no longer means `ng test` writes to dev.
- **The wizard's step titles and blurbs**, over `phases × stepsArray` (`5f1-S1`).
- **The wizard's confirm-modal count**, over `store.phases` rather than four hand-written
  coordinates (§29.9).
- **The four create pages' partial-failure caveat** (`6-P1`) and the presence of their exact ledgers
  (`6-P2`).

### Transcribed — someone must maintain these, and here is who notices first

- **`confirm-delete-modal.call-sites.spec.ts`'s eleven non-wizard rows.** Its two count assertions
  compare a literal against the object three lines above them, so **a new detail page's modal passes
  silently**. Measured in 5e: adding *and* removing a modal both left that file green. The wizard
  rows are derived; these are not. **F-L4**, and the single most likely place this feature rots.
- **Each page's own `data-owner-type` assertion** in its `.custom-moves-spec`. Nine transcriptions of
  nine literals — now backed by `6-C4`, which is the derived version, so these are a second line.
- **The exact-call ledgers' expected arrays.** Deliberately transcribed: that is what makes them
  oracles. They are maintained by failing loudly, which is the point — five of them were edited in
  5f-3b and each edit is recorded with its reason (§29.13).
- **The wizard's `phases[0].steps = 5`.** The step *count* is data; the specs that reach a submit by
  index were swept once (§29.9) and a seventh step would need the same sweep. The runtime control
  that proved the sweep complete is not a standing test.
- **`5f3a-P2`'s two arms.** The caveat's presence for hydration and absence for attach are asserted
  as a contrast, but *which* paths are un-fetched is knowledge in the test, not derived from the
  routes. **F-L10** closes the remaining gap; until then the test says what is true and does not
  know why.
- **The copy strings themselves.** `6-P1` makes the four agree; it does not know what they should
  say. A wrong-but-uniform caveat passes.

### The one-sentence version

**Everything about *shape* is derived — which domains exist, which pages render the card, which owner
each writes to, which bindings they share.** What remains transcribed is *content* (the words in a
caveat, the expected array in a ledger) and *one census* whose non-wizard half still compares itself
to itself. If this feature breaks quietly, it will break there.
---

# 30. The wizard, 5f-0 … 5f-3

§13.5 is right about the engine and I verified its central claim rather than taking it: the adapter really
does drop in.

## 30.1 `sub-resource-diff.ts` survives contact with the real code — and the owner type closes over, it does not travel

`SubResourceService<TDraft, TRequest, TResponse>` (`sub-resource-diff.ts:23-48`) declares
`create(ownerId, request)`, `update(ownerId, id, request)`, `delete(ownerId, id)` — **three arguments, no
owner type anywhere** — and bounds `TDraft extends SubResourceIdentity`
(`{ id: string | null; localKey: string }`) and `TResponse extends { id: string }`. `CustomMoveResponse`
satisfies the response bound; a `CustomMoveDraft extends SubResourceIdentity { name: string; description:
string }` satisfies the draft bound; and the owner type is supplied by a factory that closes over it:

```ts
private customMoveSubResource(ownerType: CustomMoveOwnerType):
    SubResourceService<CustomMoveDraft, UpsertCustomMoveRequest, CustomMoveResponse> {
  return {
    create: (id, request) => this.customMoves.create(ownerType, id, request),
    update: (id, moveId, request) => this.customMoves.update(ownerType, id, moveId, request),
    delete: (id, moveId) => this.customMoves.delete(ownerType, id, moveId),
    toRequest: (draft) => ({ name: draft.name, description: this.toNullable(draft.description) }),
    isDirty: (draft, baseline) =>
      draft.name.trim() !== baseline.name || !sameNullableText(draft.description, baseline.description),
  };
}
```

— byte-identical to `monsterPowerService` (`mystery-create.store.ts:3008-3016`) in the last two members,
which is §13.1 item 4's point made concrete. §13.5.1's claim that this is **the first adapter in the
codebase needing no per-owner twin** is correct: `monsterPowerService` and `minionPowerService` exist as a
pair solely because their service methods differ by domain, and here they do not. Five owners, one
factory, five closures. **No change to `sub-resource-diff.ts` at all** — not a line.

**And §5's "do not promote `sub-resource-diff.ts` to `shared/`" holds for a reason worth adding to it.**
Beyond "no baseline to compare against", the file imports `SubResourceIdentity` **from
`mystery-create.store.ts`** (`:4`) — a 3,187-line store. Promoting it either drags that import into
`shared/` or forces `SubResourceIdentity` to move first. Phase 4 should not go near it, and nor should
anything in 5a–5e; §5 is right and this is the mechanical reason, which is sturdier than the conceptual
one because it does not depend on anyone agreeing about baselines.

**One thing not to share either: `createDraftKey`.** It lives in `mystery-create.store.ts:185` behind a
module-level counter. The four standalone create pages need a key generator (14-R4), and it should be
`createCustomMoveDraftKey()` in `core/custom-moves.ts` (§27), *not* a promotion of the wizard's. Same
reasoning as `sub-resource-diff.ts`: a shared mutable counter across two features that never co-mount
buys nothing and couples their key sequences, which show up in wizard roster failure output.
The wizard keeps `createDraftKey('move')`. §32 F-L3 carries the convergence as a follow-up.

## 30.2 5f-0 — see §26.2 L10

Provable no-op, two stated conditions (the ledgers sort; no entity-level dirty check). What changes:
a per-draft `saveLocationDraft` with the entity write in stage one and `applySubResourceDiff` in stage
two, and a `writeBackLocationDrafts` that sets ids **and** baselines in one update, replacing
`backfillDraftIds`'s positional match. Same for bystanders. Gate: both ledger specs plus the full suite,
unchanged, **1467 → 1467**.

One detail to carry over from phase 1 rather than inventing: `saveMonsterDraft` passes an `index` through
to the writeback (`:2359`, `:2382`) precisely so the result can be matched to its draft slot without
depending on array position at resolve time. `backfillDraftIds` matches by position among the id-less
drafts, which is correct today only because nothing mutates the array between submit and resolve. Carry
the `index` approach forward; it is the same hazard class and it costs nothing.

## 30.3 5f-1 — step `0-4`

§13.5.2's mechanics are verified: `phases[0]` at `:389`, `stepTitle` at `:939-953`,
`phaseStepComplete[0]` at `:755-760`, `submitPhase0`'s post-id stage at `:2267-2285` where
`upsertCountdown` already sits — and it really is an entity-then-id-dependent-sub-resource pipeline
already, so her "one more entry beside `upsertCountdown`" is exact. Add:

- the `set(3)` → `set(4)` sweep **first, as its own commit** (§26.2 L8);
- a `@if (store.currentStep() === 4)` block in `mystery-create-mystery-phase.html` carrying the
  hand-written panel, in the same shape as that file's existing four step blocks;
- one `applySubResourceDiff(mysteryId, drafts, baseline, this.customMoveSubResource('Mystery'))` inside
  the existing `switchMap`, as a `forkJoin` sibling of `upsertCountdown` rather than chained after it
  (the countdown and the moves are independent writes against the same id; chaining would make a
  countdown failure hide a move failure);
- `mysteryCustomMoves` / `existingMysteryCustomMoves` at store level, the baseline hydrated from
  `MysteryDetailResponse.customMoves` in `loadEditData`;
- the dossier entry in the Mystery block (`mystery-create-dossier.html:5-29`, in the Powers block's
  label-plus-`<ul>` idiom at `:117-129`, which already renders a description sub-line — copy it);
- `phaseStepComplete[0][4] = customMoveDrafts().length > 0` — "has content", per J3.

`currentSectionIcon` (`:808-820`) needs **no** arm: phase 0 falls through to `'mystery'`, which is right.

## 30.4 5f-2 — the per-owner checklist, because five of its sites are silent on omission

§26.2 L6's twelve-row table **is** the 5f-2 work list, and the commit should carry it. The two the
compiler catches need no discipline. The five it does not — `monsterComposerPreview`,
`monsterComposerDirty`, `editMonsterDraft`, `resetMonsterComposer`, `writeBackMonsterDrafts` — each want
an assertion, and two of them already have a model in the suite:

- **composer-dirty:** `mystery-create-phase4-ledger.spec.ts:479`'s *"a half-filled composer counts as
  dirty, not just a valid one"*, retargeted at a composer holding only a custom move. Without it,
  attaching an existing monster silently discards the move.
- **writeback:** the `5a-U1`/`5a-U9` id-survival oracle in `mystery-create-phase5a-ledger.spec.ts`
  (`idsOf`/`monsterIds`, `:66-80`), extended with a fifth collection. That is the H2 guard and it needs
  no request interception at all, which is why that file calls it the better of its two oracles.
- **reset:** one assertion that a fresh composer opened after editing a monster with moves shows none.
  `resetMonsterComposer` omitting the clear leaks the previous monster's moves into the next one, which
  then get *written* to it on the next submit — the only one of the five with a data consequence rather
  than a display one.
- **preview:** a composer holding **only** a custom move appears in `monsterComposerPreview()`. Added in
  answer to Yoshi's §35.7 flag 1 — see §30.7, which says why this one is the least visible of the five
  and why the fixture has to hold *nothing else*.

## 30.5 5f-3 — the attach strips

§13.5.3 item 3 and 14-R5 are right; §26.2 L9 adds the three specifics: the fetch is `list()` rather than
`getById`, the blast radius is 80 call sites in four spec files that currently fail with a `TypeError`,
and the ledger entries in roughly ten tests change because `sent` is not reset between attach and
`next()`. Beyond that, the port from `attachMonster` is literal:
`locationAttachInFlight` / `attachingLocationName` / `locationAttachError` signals,
`mystery-create-monster-phase.html:65-97`'s spinner-plus-disabled-plus-local-error treatment into
`mystery-create-locations-phase.html:55-69` and its bystander twin, and
`mystery-create.html:33`'s `[disabled]="store.isSubmitting() || store.monsterAttachInFlight()"` gaining
two more terms.

Two things that are *not* in 14-R5 and matter:

- **`attachLocation` becomes asynchronous, and `next()` reads the roster synchronously.**
  `mystery-create.store.ts:1278-1282`'s comment is explicit that the composer commit must happen *in the
  same tick* as `submitPhase2` reads the drafts, for exactly this reason. With `of(...)` stubs the
  subscribe is still synchronous so the 80 spec call sites keep working, but in the browser a `Next`
  pressed during an in-flight attach would submit a roster without that location. That is what the
  `[disabled]` term closes, and it is the reason the term is a correctness fix rather than a polish item.
- **The composer panel itself needs no `<form>` restructure** — §26.2 L13.

### The 5f-3 gate, which carries L-D3's other half

**5f-3 does not close until `CustomMoveService.list()` is exercised by its real caller and carries real
coverage.** This is the structural form of Skyler's note on shipping `list()` early: *"We just need a note
to be sure to validate the functionality in 5f-3 and ensure tests have the correct coverage."* A comment
in `core/custom-moves.ts` would not survive Phases 4, 5a, 5b, 5c, 5d, 5e, 5f-0, 5f-1 and 5f-2 — nine
sub-phases between the method shipping and its caller arriving — so it is a gate instead, and §27.3's
Phase 4 gate states the matching half (that it ships deliberately uncovered, and why).

Concretely, three things, and the first is the only one that is really a gate rather than a test:

1. **Exercised against the dev server**, not only a stub: attach an existing location that *has* custom
   moves, confirm the roster card and the composer show them, press `Next`, and confirm the ledger shows
   **no** create or delete for those moves — a clean baseline is what proves the fetch landed in
   `existingCustomMoves` and not only in `customMoves`. Getting that wrong is the L-R6/H2 shape, and it
   is invisible to a stub that returns `[]`.
2. **A failed `list()` admits nothing** — the `attachMonster` rule, with §26.2 L9's corrected reasoning.
3. **The 80 call sites' `CustomMoveService` stub returns something non-empty in at least one test**, or
   the whole fetch path is covered only by `of([])` and the baseline-vs-drafts distinction never renders.
   My own 2026-10-06 lesson, one surface over: a parity or ledger assertion whose fixture is empty is a
   vacuous pass — and, as Yoshi points out (§35.7 flag 2), the standing decision
   `toad-fake-repositories-must-mirror-real-return-semantics`, which is the frame to cite rather than a
   local precaution. §30.7 adds the half 5f-0 measured: "non-empty" is the floor, and "distinguishable
   from what was sent" is the bar.

## 30.6 One thing I would ask 5f's re-evaluation to re-check

§13.5.4 declines the scope cut (no custom moves on wizard-authored locations/bystanders) and I agree with
the reasoning. But the honest sequencing consequence is that **5f-3 is the only sub-phase in this whole
plan that changes an interaction users already have**, and it is also the one with the largest test blast
radius (80 call sites) and the only new in-flight state in the wizard. If anything in Phases 4–6 runs long,
5f-3 is the piece to defer *as a unit* — 5f-0/5f-1/5f-2 stand alone and leave the wizard strictly better
than today. Worth saying now, because the natural thing to cut under pressure is the second half of 5f-3
(the attach strips' busy treatment), which is the half that makes it correct.

## 30.7 Yoshi's three flags (§35.7), answered

All three accepted. Two change a later sub-phase's work list; one is a line this section owed a reader
and did not have. Answered here, 5f-wide, rather than in the sub-phase that carries each, so that the
three are in one place and none of them depends on somebody re-reading §35.7 at the right moment.

### Flag 1 — `monsterComposerPreview()` gets an assertion. Accepted, into 5f-2's list.

§30.4 supplies assertions for composer-dirty, writeback and reset, and leaves site 4 — the dossier's
source — bare. Yoshi is right that this is the one whose omission is least visible, and the reason is
14-R10's own: *a collection missing from the dossier reads to the user as a collection that did not
save.* The other four fail as a wrong request or a lost draft; this one fails as a correct save the
user is told nothing about, on the surface whose entire job is to report what was authored.

**5f-2's list gains:** a composer holding **only** a custom move — no attacks, powers, weaknesses or
armors — appears in `monsterComposerPreview()`. "Only" matters: a preview that drops the custom-move
arm still renders a monster that has anything else, so a fixture with four other collections would
pass either way. That is twelve rows in §26.2 L6, not eleven, and the commit carries the table.

### Flag 2 — §30.5's gate item 3 is a standing decision and should say so. Accepted.

`.squad/decisions/records/toad-fake-repositories-must-mirror-real-return-semantics.md`. §30.5 item 3
("the 80 call sites' stub returns something non-empty in at least one test") was written as a local
precaution; it is an instance of the standing rule, and citing it puts it in the same frame as the
three other standing test decisions this plan already leans on.

**One qualification, from 5f-0.** The rule is about a fake being *informative*, and the two ways to
fail it are opposite. A hardcoded empty return makes every round-trip assertion vacuous — that is
item 3's case. A hardcoded return that is *indistinguishable from the input* does the same thing
quietly: the phase-4 ledger's `update` fake answers `{ id: 'loc-updated' }` precisely so that "the
row kept its own id" and "the row took the server's id" are different observations, and that
deliberate non-mirroring is what caught 5f-0's one real behaviour difference (§29.8). So when 5f-3b
writes its `list()` stub, "non-empty" is the floor and "distinguishable from what was sent" is the
bar.

### Flag 3 — three surfaces disagree about row edit, not two. Accepted, and it is stated here.

After 5a–5e, custom-move rows can be edited in place on **all five detail pages** and **all four
create pages**. §13.5.3 declines row edit in the wizard panels, on the grounds that the four
neighbouring composer panels have none, there is no room at `w-[42%]`, and 5f should not grow. That
call stands — I would not change it, and the density argument is reinforced rather than weakened by
§35.5's finding that the card cannot travel into the composers at all.

**But the shape of the inconsistency changed under it.** When §13.5.3 was written the comparison was
wizard-versus-detail. It is now wizard-versus-everything: nine shipped surfaces have row edit, five
wizard collections will not, and a user who authors a custom move in the wizard and wants to fix a
typo must leave the wizard to do it. That is the first bug report this feature will get, and it
should meet a documented decision rather than a silence.

**F-R1 is the right shape for the fix** — all five wizard collections in one pass, not one panel at a
time — and the right trigger is the first time someone asks, not a scheduled slot. Nothing in 5f
should be built in anticipation of it; the hand-written panels are the same amount of work either
way.

---

# 31. Frontend test strategy

§10's frontend paragraph is right about shape. Six additions, in the order I would write them.

## 31.1 Phase 4 — the service and the card, with a derived segment guard

`core/custom-moves.spec.ts`: a 4 × 5 method/owner table asserting URL, verb, body and
`SUPPRESS_ERROR_TOAST` on all twenty requests (`core/resource-images.spec.ts:86-100` is the shape); the
five literal paths; **and §26.2 L11's two derived assertions**, which are the half that cannot rot.

**`list()` gets its five rows in that table and nothing more** (L-D3, §27.3). URL, verb and token are
properties of the builder and are worth pinning the moment the builder exists; behaviour is not, because
there is none until 5f-3 supplies the caller. A spec asserting that `list()` issues a `GET` and returns
what the backend sent would read as coverage of a feature while covering only `ApiService`. The absence
is deliberate, it is stated in the gate, and §30.5's 5f-3 gate is what closes it.

`shared/custom-moves-card.component.spec.ts`: a zoneless signal-bound host (not plain fields) covering
the add/edit two-state form, `key`-not-`$index` tracking through a reorder, both focus moves, the `busy`
disable, the two `emptyText` values, and the add form refusing a blank or whitespace-only name. Note on
that last one: the server accepts a whitespace-only name today (`[Required]` rejects only null and
empty, and the service trims after validating — B13's closing note), so the card refusing it is a
client-side tightening of four shipped endpoints' behaviour *for this one type*. I think that is right —
a row rendering as an empty `<strong>` is a worse outcome than a blocked submit — but it should be a
stated decision rather than a side effect of `Validators.required`, which does not catch it either.
Flagged, not asked — it is a card-level call and I would make it; it is recorded here so that if someone
later finds a whitespace-only move in the database from another route, this is not read as the guard that
failed.

## 31.2 Per sub-phase, 5a–5e

Three specs per domain, and the first of them is the one §5's gate does not currently ask for on four of
the five pages:

1. **A failed write leaves the page mounted** — `errorMessage()` is `null`, the entity heading still
   renders, exactly one error toast. §26.2 L1. §5 asks for this in the 5e gate; it belongs in all five.
2. **An exact call ledger for the create page.** For N staged moves, the complete sorted multiset contains
   exactly N `customMoves.create(Owner,id,…)` entries and zero for an empty draft list — R5's hazard, in
   the shape `toad-exact-call-ledger-over-positive-assertions.md` requires. `monster-create.spec.ts`
   already stubs its services call-by-call, so this is an extension rather than a new harness. Record at
   **subscribe** via `defer()`, not at invocation, for the reason both wizard ledger files give.
3. **The partial-failure branch.** The custom-move batch failing produces the caveat notification and
   navigation to the **flat** route, never `error:` and never a populated form left on screen.

Plus, per sub-phase, the census and guard updates: 5c/5d the images parity table (§26.2 L2) and the two
read-only-block specs (§26.2 L3); 5e the confirm-modal census 18-in-16 → **19-in-17**. For that last
one, the number lives in four places in that file, not one: the `perTemplate` literal
(`:291-307`, gaining a `'mystery-detail.html': 1` row), the `it('there are 18 of them, in 16
templates…')` title and its two `expect`s (`:320-323`), the transcribed `untouched` row, and
`describe('the ten that must render byte-identically')` (`:332`) → eleven. My own 6c lesson, verbatim:
**grep the number, not just the assertion.** And the new transcribed row's input set is
`{ itemName: 'Chill of the Grave' }` — name-only, identical in shape to `mysteries-list.html:42`, which
is §4.2 item 2 confirmed against the component.

## 31.3 Phase 6 — the five-domain drift guard

Modelled on `shared/resource-images-four-domain-parity.spec.ts`, and four things carry across because they
were learned the hard way in it:

1. **A relative invariant, not a snapshot.** "The five agree with each other", no stored hash, no golden
   string. A consistent change to all five needs no edit here; only an inconsistent one trips it. This is
   the property that stopped the images guard from being regenerated-without-reading the first time it
   went red.
2. **Capture more than one state, and enumerate the inputs.** For each bound input, ask *"would its
   absence change this DOM?"* and add a state until the answer is yes. Here that means at least: `idle`,
   `populated` (rows render, so a missing `[rows]` diverges), `editing` (a row open, so a missing
   `[editingKey]` diverges), and `busy` (a mutation in flight, so a missing `[busy]` leaves controls
   enabled — this is the exact binding that survived an idle-only version of the images guard until a
   negative control caught it). §26.2 L4 is the reason the `busy` state is only *possible* if all five
   pages bind the same expression.
3. **Assert the owner type before normalising.** `[attr.data-owner-type]` (§28.1) is read and checked
   per page, then normalised. Any token you normalise away needs its own positive assertion first.
4. **Cover the create pages, per R5 — and the wizard's five literals, which are not call sites at all.**
   Nine card call sites plus five wizard owner literals: the literals have no card and therefore no
   `data-owner-type` to check, and before Phase 6 they were guarded only by per-owner write assertions
   spread across four spec files, each proving its own site and nothing about the set. Nine call sites, one component — so the guard asserts the *host
   wiring* (owner type, `emptyText`, which events are subscribed, and that the card is **not** a child of
   the four-panel grid per 14-R2), not nine markup trees. It cannot compare detail and create DOM to each
   other directly: the empty text differs by design and a create page has no modal. Two groups — five and
   four — each internally identical, plus a cross-group assertion that the *card subtree* matches once
   `emptyText` is normalised. That shape is what §13.7 means by "cheaper than §5 assumes", stated
   concretely.

**Source *is* readable, and planning around that was this section's one real error.** It said template
source was unavailable — that `?raw` imports fail and `import.meta.glob` hangs the runner. F-L9 measured
otherwise: `import.meta.glob('/src/app/**/*.{ts,html}', { query: '?raw', eager: true })` reads the whole
application in milliseconds. **One constraint, and it is sharp:** the call must be written out in full at
the call site, because it is replaced at transform time — hoisting it into a `const` throws at module load
and reports as *a suite with zero tests*, which is the one failure mode a guard must never have.

That matters because it buys the half rendered DOM cannot give: **the write literal**. §29.4's finding is
that a card's `ownerType` and its host's write literal are independent strings, so the DOM contains the
label and never the destination. Phase 6 therefore reads source, checks both halves, and checks each
against the domain the file path resolves to — a third independent fact, which is what makes a
self-consistent mislabelling fail too. §29.14 records what shipped.

**One negative control I would insist on, because it is the one that found a real hole last time:** wire
one page's card to another domain's owner type and confirm the guard fails. If it passes, the owner-type
assertion is running after normalisation.

## 31.4 What §10 and §11 get wrong or miss, on the frontend side

- §9's *"**Frontend.** Nothing to tear down — no client code exists"* is right about client code and wrong
  about tests: two spec assertions pin the read-only block (§26.2 L3).
- §10's "three existing overlay census specs" is four guards (§26.2 L2).
- §11's "~20 spec files **untouched**" is 23 files, of which two change.
- §11's frontend list should add: `shared/resource-images-four-domain-parity.spec.ts`;
  `location-detail.spec.ts` and `bystander-detail.spec.ts`; the six `currentStep.set(3)` sites in three
  wizard specs (§26.2 L8); the four spec files holding 80 attach call sites (§26.2 L9); and
  `hydrate-monster.ts`'s `toNamedDraft` union (§26.2 L7), which §11 names as a file but only for the
  hydration line.
- §11's wizard list is otherwise accurate and already includes the dossier that 14-R10 asked for, so
  14-R10's "§11's file list should name the dossier" is **already satisfied** by §11 as written —
  worth noting so nobody adds it twice.
- §10's *"the fixtures keep compiling untouched because `CustomMoveResponse` does not change"* is exactly
  right and is worth keeping in view: of the 23 fixture files, the ones that need a `CustomMoveService`
  stub are only those that *exercise* the card, which is a handful, not 23 (§26.1).

---

# 32. Frontend risks (Luigi)

Numbered L-R to sit beside §7's R1–R14, §14's 14-R1–14-R10 and §24's B-R1–B-R14.

| # | Risk | Mitigation |
|---|---|---|
| L-R1 | **A failed write unmounts the detail page.** All five templates order `@else if (errorMessage())` ahead of the content branch, and the obvious implementation — reuse `runAndRefresh` — sets it. **Already live for attacks/powers/armors/weaknesses on Monster and Minion**, so this is a current defect as well as a future risk. | §26.2 L1, and **Phase A (§34) now fixes the existing half ahead of Phase 1** (L-D4). Custom moves then inherit a page family where the rule already holds, so `runCustomMoveWrite` is the normal case rather than a divergence. Per-page gate assertion in 5a rather than only in 5e. |
| L-R2 | **R13's migration reds a spec that looks unrelated to custom moves**, with the message "Location should NOT own pendingDelete". | §26.2 L2. Update `resource-images-four-domain-parity.spec.ts`'s `DOMAINS` table, its rationale comment and its test name in the 5c/5d commit, never after. |
| L-R3 | **`SUPPRESS_ERROR_TOAST` is dropped from one of four methods** and nobody notices, because three toasts out of four look right. | §27.3's 4 × 5 table — twenty requests, not four. My own 2026-10-05 negative control for this exact token caught a dropped one; keep that control. |
| L-R4 | **A typo in `OWNER_SEGMENT` is a bodiless 404 with the diagnosis suppressed**, and it hides best on the create pages, where the hedged caveat is *true*. | §26.2 L11: derive four segments from `resourceImagesPath` and the fifth from `MysteryService`'s own URL, plus a one-off five-segment live probe with **real** owner ids in the Phase 4 gate. Literal assertions kept as documentation, not as the guard. |
| L-R5 | **`monsterComposerDirty` omits custom moves**, so attaching an existing monster silently discards a composer holding only a custom move. One of five 5f-2 sites the compiler cannot see. | §26.2 L6 / §30.4. The twelve-row table in the commit, plus a retarget of `mystery-create-phase4-ledger.spec.ts:479`'s half-filled-composer assertion. |
| L-R6 | **`writeBackMonsterDrafts` refreshes ids without the custom-move baseline** — the documented H2 shape, where every later submit deletes and recreates the collection. Compiles clean. | §30.4. Extend `5a-U1`/`5a-U9`'s id-survival oracle to a fifth collection; it needs no request interception. |
| L-R7 | **`resetMonsterComposer` omits the clear**, leaking the previous monster's moves into the next composer — where they are then *written* to the wrong monster. The one 5f-2 omission with a data consequence. | §30.4's third assertion. |
| L-R8 | **5f-1 silently stops submitting phase 0 in six tests**, which then assert against an empty ledger and pass or fail for the wrong reason. | §26.2 L8. Sweep `set(3)` → `set(4)` as the first commit inside 5f-1, before the step exists. |
| L-R9 | **5f-3 breaks 80 attach call sites with a `TypeError` from inside the store**, not an assertion diff. | §26.2 L9. Add the `CustomMoveService` stub to all four spec files first, as its own commit; use `list()` so the ledger entry is self-describing and the draft-construction path is untouched. |
| L-R10 | **5f-0 is called a no-op on a stronger claim than is true**, and someone extends the diff to the entity level during the restructure. | §26.2 L10. State both conditions in the gate; `mystery-create-phase4-ledger.spec.ts:404` (S4) and `:206` (A6) are the tests that catch the second. |
| L-R11 | **`track $index` copied from the create-page panels into a card that restores focus to a row control** — focus lands on the wrong move, with no error. | 14-R4, which is right and which I am re-listing only because the create pages' four panels are the nearest copy source and all four use `$index`. |
| L-R12 | **The card's `ownerType` is asserted only after normalisation**, so a page wired to the wrong domain passes the parity guard. Proven by negative control in the images guard. | §28.1's `[attr.data-owner-type]`, asserted before normalising, plus §31.3's negative control. |
| L-R13 | **Two shipped copy strings change without being in a copy ruling** — `"No custom moves."` → `"No custom moves yet."` on two detail pages, pinned by two specs. | §26.2 L3. Fold into §13.6's rulings rather than discovering it as a red test. |
| L-R14 | **An unstubbed `CustomMoveService` in a page spec issues a real `fetch`** under jsdom and rejects asynchronously — noise, and intermittent. Not a `NullInjectorError`, because the whole `HttpClient` chain is root-provided in Angular 22. | §26.1. Stub it in any spec that *exercises* the card; specs that only render it need nothing, which is what keeps 5a–5e off the other fixture files. |
| L-R15 | **The focus restore after Save/Cancel targets a button that does not exist yet**, because the edited row's pencil is replaced by the `Editing` label and only re-created once `editingKey` clears. Silent: focus stays on `<body>`. | §28.1's closing note — restore in `afterNextRender({ write })` after the key change, finding the button by `[data-move-key]` rather than a captured `ElementRef`. |
| L-R16 | **`list()` ships in Phase 4 and its validation note is forgotten.** L-D3 puts nine sub-phases between the method shipping and its only caller arriving, and the thing being deferred is *coverage* — which is exactly the kind of debt that is invisible in a green suite. A reviewer at 5f-3 has no reason to know a method has been waiting. | §30.5's gate, not a code comment: **5f-3 does not close until `list()` is exercised by its real caller with real coverage**, including one non-empty stub so the baseline-vs-drafts distinction actually renders. §27.3's Phase 4 gate states the matching half, so the gap reads as a decision at both ends. |
| L-R17 | **Phase A is read as part of this feature and gets deferred with it.** It touches no custom-move code, so it has no dependency on Phases 1–3 — but a reader skimming a custom-moves document will take anything in it as custom-moves work, and the first thing cut under pressure is a step whose connection to the goal is indirect. | §34's first line says it outright, and its gate is self-contained. If Phases 1–3 slip, Phase A should land anyway; it makes the four shipped detail pages correct on its own terms. |

**Follow-ups (frontend), out of scope for Phases 4–6:**

| # | Follow-up | Trigger |
|---|---|---|
| ~~F-L1~~ | **Withdrawn — it is scheduled work now, not a follow-up.** "Stop the four sibling sub-resource panels unmounting the page on a failed write" is **Phase A** (§34, L-D4), ahead of Phase 1. The number is kept as a withdrawn row rather than reused or deleted, so that a reader arriving from an external reference to F-L1 — a report, a commit message, a `.squad/` record — lands on where the work went instead of on a different follow-up wearing its number. Rosalina's **F-R3** (`whitespace-pre-wrap` on the same eight panels) is *not* absorbed by Phase A; §34.3 says why. | — |
| F-L2 | **Remove `ResourceImagesStore.requestDelete`/`confirmDelete`/`cancelDelete`** and `PendingImageDelete`, production-dead after 5c/5d (6 call sites, all in the two migrated templates), plus the 14 assertions that keep them alive. | After Phase 6, if nobody has found a page that wants the store-owned shape. §26.2 L5. |
| F-L3 | **`createDraftKey` as one shared primitive.** Two generators will exist after 5f (the wizard's and `core/custom-moves.ts`'s). Deliberate today for the reasons in §30.1; worth revisiting with F2, which revisits the create-page batch as a unit. | With §12 F2. |
| F-L4 | **Centralise the detail-page half of the confirm-modal census.** Its two count assertions compare a literal against itself and are blind to a template gaining or losing a call site — measured by control in 5e, where adding *and* removing a modal both left the file green (§29.7). The wizard rows are derived; the eleven non-wizard rows are not. Fix: render the five detail pages and count their modals, as `resource-images-four-domain-parity.spec.ts` already does for four of them. Needs a five-page provider set, which is that spec's shape rather than the census file's. | Any work on the census or the parity guard — and before a sixth detail page is ever added, since that is the case nothing currently catches. |
| F-L5 | **Collapse the `isSaving` aliases on `location-detail` and `bystander-detail`** into `isMutating`, in one pass across both pages. Five assertions plus one test name in two shipped specs per page, no behaviour change (§29.5, §29.6). | Any pass over those two pages. |
| F-L6 | **Converge the flat rosters' save-method names on the monsters path's.** The public composer commits are `saveLocationDraft`/`saveBystanderDraft`; the monsters twin is `saveMonsterDraftToList`, which is why phase 1's private per-row save could be `saveMonsterDraft` and 5f-0's had to be `saveLocationRow`/`saveBystanderRow`. Renaming the two public ones `…DraftToList` reaches 7 call sites across 4 spec files **including `mystery-create-phase4-ledger.spec.ts:292`**, which is why it could not happen inside 5f-0 (§29.8). Pure rename, no behaviour. | After 5f-0's gate is discharged — any pass over the wizard store. |
| F-L7 | **Decide whether `saveMonsterDraft` should keep the id it PUT at.** It returns the `PUT` response's `monster.id` and writes that onto the draft. In production the two agree; if they ever did not, a persisted monster draft would silently re-key mid-session and its baselines would stop matching — the §2.12-item-2 hazard class. 5f-0 took the other answer for locations and bystanders because `backfillDraftIds` had, and because the phase-4 ledger's fakes measure it (§29.8). Phase 1's ledger does not, so nothing says which answer it is on. One line plus one assertion. | Any pass over `submitPhase1`, and before 5f-2 extends the phase-5a oracle. |
| F-L8 | **Make phase 0's drain a `forkJoin` sibling, as phases 1–3 already do.** `submitPhase0` chains `applyPendingRemovals` *after* the countdown, so a failed countdown strands a confirmed deletion — H6 (§7.7h) says it should not, and the other three phases agree. Pre-existing; 5f-1 widened it by one sibling (the custom-move diff) rather than introducing it, and declined to fix it because it is a behaviour change on the failure path that nothing in the suite pins (no spec makes `upsertCountdown` fail). One line in `submitPhase0`, plus the failure-path test that does not currently exist. | Any pass over `submitPhase0`, or the first time a phase-0 failure is reported as a lost removal. |
| F-L10 | **Fetch custom moves for the locations and bystanders hydrated by edit-mode load.** `loadEditData` builds those drafts from `getByMystery`, a *list* route with no `CustomMoves` — the same gap 5f-3b closed for attach. So a revisited mystery's rows still show 5f-3a's "they aren't shown here" caveat, which is honest and display-incomplete. Closing it means N `list()` calls on a load that already fans out per monster, which is a real cost and a different decision from the one 5f-3b made. Nothing is destroyed either way: an empty baseline claims nothing (§29.12's gate still holds on that path). | Any pass over `loadEditData`, or the first time a Keeper reports that a revisited location's moves are missing. |
| ~~F-L9~~ | **Done, early — commit `18f3753`.** Skyler pulled it forward out of 5f-3b: an unstubbed root-provided `CustomMoveService` plus a dev server on :5225 is a unit test writing to dev `motw`, and a dev server has been up during four of the last six sub-phases. It named one file; deriving the set found **23**, and the derivation is now a test (`shared/custom-moves-stubbed-everywhere.spec.ts`). §29.11. The row is struck rather than deleted so an external reference lands on where the work went. |

---

# 33. Questions — answered

**All four answered by Skyler, 2026-10-11. None was blocking; Phase 4 and 5a could have started without
them.** Recorded as §33.1 L-D1–L-D4. The questions are kept with their reasoning rather than deleted,
because the *reason* each was a question is what makes the answer checkable — the convention §6.4, §15
and §25 already use.

## 33.1 Settled by Skyler, 2026-10-11 — the frontend decisions

The same shape as §8.1 and §16.4, kept separate because these are answers to §33 rather than to §8 or
§25. All four are Skyler's.

| # | Question | Answer |
|---|---|---|
| L-D1 | Card contract: five inputs and **three** outputs with a two-way `[(editingKey)]`, or §13.3's five-and-four? | **Three outputs.** *"Yes, Luigi's three outputs. Overall, I prefer the two-way binding as a more straightforward pattern."* The second sentence is a **general preference**, not a ruling on this card — §28.1 records it as such, so the next shared component with a request-plus-cancel pair does not re-litigate it. |
| L-D2 | Does the card's `<h3>` get `mystery-detail`'s section icon? | **No — plain `<h3>`.** *"I agree that the h3 makes the most sense here. I can easily circle back and figure out an icon solution if it bothers me, but for now, the h3 is good."* One treatment on five pages, no parity-guard exception. §26.2 L14 records what "circle back" would actually cost, so the door stays genuinely open. |
| L-D3 | Ship `list()` in Phase 4 with its only caller in 5f-3? | **Yes.** *"Yes, go ahead and ship the `list()` call in Phase 4, with the note that this is not expected to function fully until 5f-3. Tests obviously won't be useful until then, either. We just need a note to be sure to validate the functionality in 5f-3 and ensure tests have the correct coverage."* Written as **two gates** rather than a note: §27.3 (Phase 4: deliberately uncovered, and why) and §30.5 (5f-3 does not close until the real caller and its coverage exist). |
| L-D4 | Fix L1's existing unmount defect now, or leave it as follow-up F-L1? | **Now, as a pre-step.** *"I do think we should fix this now; do it first as a pre-step to the first documented phase; I just need to remember. The behavior change is not a big deal, and I would rather it be resolved for the upcoming work."* Becomes **Phase A** (§34), ahead of Phase 1 and independent of Phases 1–3. F-L1 is withdrawn (§32). |

**Where these land, so nothing is recorded only here:** L-D1 in **§28.1**; L-D2 in **§26.2 L14**; L-D3 in
**§27.2**, **§27.3**, **§30.5** and **L-R16**; L-D4 in **§26.2 L1 item 3**, **§34**, **L-R1**, **L-R17**
and §32's withdrawal of F-L1.

**What they did not shift.** Nothing in §§29–31 moves except the two `list()` coverage notes: the host
wiring, the create-page draft arm, 5f-0's two conditions, the 5f-2 checklist and the Phase 6 guard are all
unaffected. L-D1 removes two handlers from nine call sites and changes no structure. L-D2 is a decision to
change nothing. The only genuinely new work is **Phase A**, and it is work this plan would otherwise have
inherited as a defect in the pages it is about to build on.

**One thing L-D4 improves that the question did not anticipate.** I had argued for `runCustomMoveWrite` as
a *deliberate two-line divergence* from `runAndRefresh`, needing a comment so a reviewer would not read it
as an oversight (§26.2 L1 item 2). With Phase A landing first, there is no divergence to explain: the
whole page family already routes write failures to the toast, so the custom-move pipeline is the **normal**
case and `runAndRefresh` either absorbs it or disappears into it. That makes 5a's diff smaller and its
review simpler, which is a second argument for the ordering Skyler chose on other grounds.

---

## 33.2 The questions, with their reasoning

**Q1 — Does the card get five inputs and three outputs, or §13.3's five and four?** My recommendation was
the two-way `[(editingKey)]` (§28.1): it removes two handlers from nine call sites and it is the shipped
`app-image-carousel` idiom. It was a change to a contract Rosalina wrote, so it was hers to accept or
refuse, and the cost of refusing was small — two handlers per host, nothing structural.

> **Answered: three outputs, and a preference wider than the question.** *"Yes, Luigi's three outputs.
> Overall, I prefer the two-way binding as a more straightforward pattern."*

**Q2 — On `mystery-detail`, does the card's `<h3>` get that page's section icon?** Every other heading on
that page is icon-prefixed. Giving the card an icon on one page of five breaks "one treatment on five
pages" and the parity guard would have to permit it; giving it an icon on all five is uniform but adds a
header element §13.3 deliberately kept out, and `app-domain-icon` hardcodes `h-5 w-5` so it would need a
size escape. My recommendation was **neither — accept the plain `<h3>`** and let the card look like the
card everywhere. Asked because it is the one place §6.4's "does it look foreign" question survives
§13.2's answer.

> **Answered: plain `<h3>`, with the door left open.** *"I agree that the h3 makes the most sense here. I
> can easily circle back and figure out an icon solution if it bothers me, but for now, the h3 is good."*

**What that leaves to be careful about.** "Easily" is doing some work in that sentence, and §26.2 L14 now
spells out the three obstacles — no custom-moves glyph in any of the three icon vocabularies, the
mystery-section icon component living inside the mysteries feature, and the other four detail pages having
no icon on any section heading. None of them is a reason not to do it; together they make it a design pass
rather than an attribute. Recorded there so a later decision to add an icon starts from the real cost
instead of rediscovering it.

**Q3 — Is `list()` worth shipping for one wizard caller?** §27.2 argued yes, and that the caller is the
better of the two candidates for 5f-3's attach. But 5f is gated on a re-evaluation, so between Phase 4 and
5f-3 the method has no caller — the condition §1.7 diagnoses, in miniature. Dropping it would have been a
one-line change in Phase 4 with no other consequence, and 5f-3 could add it back.

> **Answered: ship it, and validate it where it lands.** *"Yes, go ahead and ship the `list()` call in
> Phase 4, with the note that this is not expected to function fully until 5f-3. Tests obviously won't be
> useful until then, either. We just need a note to be sure to validate the functionality in 5f-3 and
> ensure tests have the correct coverage."*

**Why the "note" is a gate and not a comment, which is the only part of this answer that needed a
decision from me.** The thing being deferred is *coverage*, and deferred coverage is invisible in a green
suite — there is nothing to trip over. Nine sub-phases separate the method from its caller, and a reviewer
arriving at 5f-3 has no reason to know a method has been waiting. So it is written at both ends: §27.3's
Phase 4 gate states that `list()` ships with builder-level assertions only and *why* inventing behavioural
coverage would be worse than the gap, and §30.5's 5f-3 gate states that the sub-phase does not close until
the real caller exercises it — against the dev server, with at least one non-empty stub, because an
`of([])` fixture makes the baseline-versus-drafts distinction unobservable. L-R16 is the risk; the two
gates are the mitigation.

**Q4 — Should L-R1's fix extend to the four sibling panels now, rather than as F-L1?** I had scoped custom
moves narrowly and left the pre-existing defect flagged, per my brief. But it is a live bug on two shipped
pages, the fix is two deleted lines per page, and 5a would be sitting in exactly that method with the
reasoning fresh. The argument against was that it changes shipped behaviour on eight collections and wants
its own verification; the argument for was that leaving two sub-resource types on one page disagreeing
about whether a failure unmounts the page is the kind of asymmetry that reads as an oversight forever.

> **Answered: fix it now, ahead of everything.** *"I do think we should fix this now; do it first as a
> pre-step to the first documented phase; I just need to remember. The behavior change is not a big deal,
> and I would rather it be resolved for the upcoming work."*

*"The behavior change is not a big deal"* is a ruling on **scope**, not a waiver on verification — §34.2
gives Phase A its own gate, and it is the smallest gate in the plan precisely because the change is
small. *"I just need to remember"* is the part §34 exists to make unnecessary: it is a numbered,
gated step with its own section, not a note.

---
---

# 34. Phase A — the detail-page unmount fix *(Luigi, before Phase 1)*

**This phase contains no custom-move code and depends on nothing in Phases 1–3.** It is in this document
because this document is where the defect was found, not because it is part of this feature. If Phases 1–3
slip, Phase A should land anyway: it makes four shipped detail pages correct on their own terms. L-R17 is
the risk of reading it the other way.

**Named `A` rather than `0`** because Phase 0 is already Decide, and because a letter makes it
unmistakable that this is not a renumbering of anything. It runs after Phase 0 (this document) and before
Phase 1 (the table and the service), and its position in the sequence is the whole of Skyler's answer:
*"do it first as a pre-step to the first documented phase."*

## 34.1 What it changes

**The defect, restated in one sentence:** the write pipelines on `monster-detail` and `minion-detail` set
`errorMessage` on failure, and those templates put `@else if (errorMessage())` (`:6`) ahead of the content
branch — so a failed write replaces the whole entity with a single red line, and the only recovery is a
page reload. §26.2 L1 has the full evidence, including the three places these two pages already state the
correct rule.

**It is two defect classes, and Skyler scoped both into this phase.** I originally scoped only the
sub-resource half and flagged the entity save as a finding (*"same mechanism, arguably worse
consequence"*); he took it: *"go ahead and fix the entity-save bug now."* The entity-save half is worse
rather than equivalent, and the reason is what the user loses — a failed `PUT` unmounts
`<app-monster-form>` **while it still holds their unsaved edits**, so the work is gone and not merely the
view. The sub-resource panels had already cleared their own add-form inputs on the way in. **Measured, not
argued:** the browser control (§34.2 item 2) showed the typed value `"All-Father Stillness EDITED"`
reduced to `null` with the form removed from the DOM.

**The exact diff, enumerated rather than described, because "the write paths" is three methods and not
one.** Each page has **eight** `errorMessage.set` sites; **two stay and six go**:

| Site | Monster | Minion | |
|---|---|---|---|
| load success — clear | `:147` | `:140` | **keep** |
| load failure — set | `:173` | `:160` | **keep** |
| `saveMonster`/`saveMinion` success — clear | `:229` | `:184` | **remove** |
| `saveMonster`/`saveMinion` failure — set | `:242` | `:188` | **remove** |
| `createAttack` success — clear | `:284` | `:230` | **remove** |
| `createAttack` failure — set | `:288` | `:234` | **remove** |
| `runAndRefresh` success — clear | `:420` | `:366` | **remove** |
| `runAndRefresh` failure — set | `:425` | `:371` | **remove** |

`createAttack` (`monster-detail.ts:248`, `minion-detail.ts:194`) has its own `subscribe` rather than going
through `runAndRefresh`, because an attack chains its weapon-tag assignments — so a fix that only touched
`runAndRefresh` would leave the one collection with the most moving parts still unmounting the page. That
is the single most likely way to get this phase wrong, which is why the table is here and why the gate is
per collection. The negative controls were designed against it and caught it: restoring `createAttack`'s
line alone fails **exactly one** test.

**Six lines per page, twelve in total, across three methods per page.** Nothing else outside tests, and
**zero added code lines** — every insertion in the diff is a comment.

**Why no new error surface had to be designed for either half, which is the only reason the entity save
was in scope at all.** All three methods already called `notificationService.error(...)` on the line
*after* the inline write, with the **identical string** — `runAndRefresh` passes its `errorMessage`
parameter to both, `createAttack` passes the literal to both, and the saves pass
*"Unable to save {entity} details."* to both. The inline write was duplication with a destructive side
effect, so removing it changes what the user *loses*, not what they are *told*.

**The invariant this ends on, which is the part worth keeping.** `errorMessage` is now written by the
**load path only** — verified, not assumed: exactly two `errorMessage.set` sites remain per page and both
are inside `ngOnInit` (`monster-detail.ts:124-176`, `minion-detail.ts:115-163`). So the branch that sits
ahead of the content branch and replaces the entire page now means **exactly** "this page could not
load", which is the only claim that branch position is correct for. Anything after a successful load
reports through a toast or its own inline element — the images section's `data-images-error` is the shape
to copy. That sentence is in all three method comments on both pages, because it is the rule a future
`errorMessage.set` on a write path would be breaking.

**One correction to my own reasoning, found by control.** I had justified removing the *success*-arm
clears as "deliberate rather than symmetry — they would otherwise clear a failed load." That is wrong:
they were **unreachable**. `errorMessage` is non-null only after a failed load, and in that state the
template renders the error branch, so there is no form and no panel from which to trigger a write that
would reach the clear. Restoring one fails **no** test, and no assertion could catch it — confirmed by
running exactly that control. They are removed so the load path is the *single* writer, which is a
property, not a bug fix. The component comments say so.

Two details that make this smaller than it sounds, both verified:

- **The toast already exists, in both methods.** Each error arm calls `notificationService.error(...)`
  immediately after setting `errorMessage`, with the **same string** — `runAndRefresh` passes its
  `errorMessage` parameter to both, and `createAttack` passes the literal `'Unable to add attack.'` to
  both. So the failure is already being reported through the correct surface; the inline write is pure
  duplication with a destructive side effect. Nothing new has to be designed for "what does the user see
  instead" — the answer is "the toast they were already getting".
- **The success-arm clear goes too, and that is not symmetry for its own sake.** With the error arm no
  longer setting `errorMessage`, a success-arm `errorMessage.set(null)` could only ever clear a value put
  there by the *load* path or by the entity save — and clearing a load failure because an unrelated
  sub-resource write succeeded is wrong. Leaving it in would be a subtler version of the same confusion.

**Scope boundary, stated so it does not creep.** `errorMessage` remains the surface for **load** failures
and for the **entity save** on all five pages. This phase changes only the sub-resource write paths on
`monster-detail` and `minion-detail`. `location-detail` and `bystander-detail` need no change here —
their only batched write already routes its caveat to a toast and keeps `errorMessage` `null`, with
`location-detail.ts:135-137` documenting why. `mystery-detail` has no write path yet; 5e builds it with
the rule already in force (§4.1 item 4).

**Two pages, two methods, four deleted lines.** That is the whole diff outside tests.

## 34.2 Gate

Small, because the change is small — but it exists, because *"the behavior change is not a big deal"* is a
scope ruling and not a waiver.

1. **Per page, per write path: a failed write leaves the page rendered.** Force each of the **nine** paths
   per page to fail — four creates, four deletes, and the entity save — and assert the entity heading is
   still in the DOM, `errorMessage()` is `null`, exactly one error toast fired, no success toast, and
   `isMutating()` cleared. `monster-detail.spec.ts:236-247` is the literal shape to copy: it already
   asserts precisely this for the *membership* path, which makes the new assertions read as the existing
   rule being extended rather than a new rule being invented. The entity-save cases additionally assert
   the **form element itself** survived, because that is what the bug destroyed.
   *Result: 18 table cases + 6 entity-save cases + 2 catch-all invariant tests, all green.*
2. **A negative control per page, with its failure set predicted in advance.** The whole phase is a
   deletion, and a deletion's test can pass for the wrong reason. "Some tests failed" proves much less
   than a predicted set, so each control names the set first. Five were run:
   - restore `createAttack`'s line (monster only) → **exactly 1** failure, the `own subscribe` row. The
     decisive one: it proves a fix applied only to `runAndRefresh` gets caught.
   - restore `runAndRefresh`'s line (minion only) → **exactly 8**, its 7 rows plus the modal test, monster
     file untouched — so the two spec files are independent.
   - restore the entity-save set (monster, then minion) → **exactly 3** each, the two save tests plus the
     catch-all, with the eight sub-resource rows unaffected.
   - restore a *success*-arm clear → **exactly 0**, as predicted. That is the §34.1 correction, and
     running the control is what turned a wrong justification into the right one.
   - *plus* two **browser** controls (not required by this item, added because §26.2 L1's claim was
     derived from template reading and never measured): the page really is replaced — `h2` → `null`,
     `p.text-danger` → the one message, form gone, and for the entity save the typed edit → `null`.
3. **The full suite green, 1467 → 1497**, with **no existing test's expectations edited**. Checked before
   touching anything, for both defect classes: no existing spec pins `errorMessage` non-null after a write
   failure on either page — all four pre-existing `errorMessage` assertions there are already
   `toBeNull()`, and **no existing spec drives `update()` to fail at all**. So nothing to report under
   this item and nothing to change. (`minions-list.spec.ts:213` asserts non-null, but that is the *list*
   page's entity delete and out of scope.)
4. **A dev-server check per page and per defect class**, because the symptom is visual and a unit test
   asserting "the heading is still there" is not the same as watching the page survive. Route a 500 at the
   write, confirm the entity is still on screen, the toast appeared, and no page-level red line replaced
   the content; for the entity save, **type an edit into the form first and confirm it is still there
   afterwards**. *Result: 34/34 checks across both pages, both pipelines and both defect classes.
   Intercepted requests never reach the API, so the check mutates no data.*

## 34.3 What is deliberately not in it

The entity save **was** on this list and is not any more — Skyler scoped it in (§34.1). What remains out:

- **`whitespace-pre-wrap` on the eight sibling description lines** (Rosalina's F-R3) touches the same
  eight panels on the same two pages and would ride along cheaply. It is **out of scope**: it is her
  follow-up, it is a rendering change rather than a correctness one, and bundling a visual change into a
  twelve-line behavioural fix is what makes a small gate stop being a gate. Noted because the overlap is
  obvious and someone will spot it.
- **Any change to the panels' or the form's *inline* error affordance.** They have none to remove — the
  inline surface they were using *was* `errorMessage`, which is the page's. So this phase removes a bug,
  not a feature, and there is no "where does the inline message go now" question to answer. Stated because
  the question gets asked about every change of this shape, and here it has no content: the toast was
  already firing the same string.
- **The double toast (14-R3 / F-R2), which this phase *confirmed* rather than fixed.** The browser checks
  showed every failed write producing **two** toasts — `httpErrorInterceptor`'s
  `"Request failed (500) for PUT /api/monsters/{guid}"` alongside the page's own
  `"Unable to save monster details."` Rosalina logged this as a present-day defect on the four existing
  sub-resource types and deliberately did not sweep it; it is now **observed, not inferred**, which
  strengthens §27's requirement that `core/custom-moves.ts` set `SUPPRESS_ERROR_TOAST` on all four
  methods. Still out of scope here: changing it is a decision about four shipped types (F-R2, with F2).
  Worth knowing that a *component* spec structurally cannot see this — stubbing the service bypasses the
  interceptor — so the unit assertions' "exactly one toast" is a claim about what the **component**
  reports, which is the right thing for them to assert and not the whole of what a user sees.
- **The other three detail pages.** `location-detail` and `bystander-detail` already route their only
  batched write's caveat to a toast and keep `errorMessage` `null` (`location-detail.ts:135-137` documents
  why), and `mystery-detail` has no write path until 5e, which builds it with the rule already in force.
  Phase A needed to touch neither, and the §26.2 L1 recommendation for all five pages is satisfied for
  three of them by their existing code.

---

# 35. The 5f re-evaluation *(Yoshi)*

The pass Skyler reserved when he answered Q3 — *"After her pass, I will likely have Yoshi re-evaluate the
solution based on how she wants to tackle this."* §13.5 is Rosalina's design, §26.2 L6–L10 and §30 are
Luigi's measured plan, and all of Phases A, 1–3, 4 and 5a–5e have shipped since §§0–12 were written. This
section re-decides 5f against what the code now is, amends my own §§0–12 where they are wrong, and says
where I disagree with the other three without editing their sections.

**What I verified first-hand rather than inheriting**, because three of the findings below turn on it:
`sub-resource-diff.ts:50-118` in full (including `batch`), `custom-moves-card.component.ts:20-140`
(`CustomMoveRow`, `CustomMoveCommit`, the input/output surface, `commitSucceeded`),
`mystery-create.store.ts:69` (`SubResourceIdentity`), `attachLocation` at `:1547-1566`, and the five
detail templates' modal counts anchored on `<`.

**Headline: the plan is sound and I am changing one thing.** 5f-0, 5f-1 and 5f-2 stand as written. **5f-3
should split in two**, because it currently bundles the only additive work left with the only
interaction-changing work left, and Luigi's own deferral analysis (§30.6) identifies the right unit to
defer at the wrong boundary. Everything else in §30 I would have Luigi build as he has written it.

---

## 35.1 Verdict on the decomposition: keep three, split the fourth

### What holds

**5f-0, 5f-1 and 5f-2 are the right three units** and I would not touch them. Each is independently
revertible, each has a different failure class, and each has a gate that discriminates. 5f-0 in particular
is the strongest idea in the whole plan and §35.2 strengthens rather than questions it.

### Why 5f-3 should become 5f-3a and 5f-3b

5f-3 as written contains two things with **different risk classes, different blast radii, and different
answers to "may this be deferred"**:

| | 5f-3a — composer panels for locations/bystanders | 5f-3b — the attach fetch and the strips |
|---|---|---|
| Nature | **Additive.** A new panel in two composers | **Changes an interaction users already have** |
| Spec blast radius | Its own new assertions | **80 call sites in 4 spec files**, failing with a `TypeError` inside the store, plus ~10 ledger entries |
| New state | None | `locationAttachInFlight` / `attachingLocationName` / `locationAttachError` ×2, and a new `[disabled]` term |
| Correctness exposure | Normal | The `Next`-during-attach race (§30.5), which is a correctness fix, not polish |
| Is it what §13.5.4 refuses to cut? | **Yes** — capability parity for wizard-authored locations | No — it is about *attached* locations |

**The argument is Luigi's own, one boundary over.** §30.6 says: *"If anything in Phases 4–6 runs long, 5f-3
is the piece to defer as a unit… the natural thing to cut under pressure is the second half of 5f-3 (the
attach strips' busy treatment), which is the half that makes it correct."* Both halves of that are right.
But deferring 5f-3 *as a unit* sacrifices the composer panels — and the composer panels are precisely what
§13.5.4 argues must not be sacrificed, because *"a Keeper who builds a location inside the mystery silently
loses an affordance they have outside it."* Deferring the unit throws away the thing the scope-cut argument
protects, in order to defer the thing that is actually expensive.

Split at the real seam and the deferrable unit becomes exactly the expensive, interaction-changing half,
while capability parity ships. That is the same move 5f-0 makes against 5f-3's own restructure, and the same
move Phase 1 made on the backend: **separate the thing that is additive from the thing that changes
behaviour, so each is reviewed against its own question.**

### The interim state 5f-3a leaves, which must be stated or the split is not safe

If 5f-3a ships without 5f-3b, `attachLocation` still builds its draft from the catalogue list item, so an
**attached existing** location arrives with `customMoves: []` *and* `existingCustomMoves: []`. Traced
through `applySubResourceDiff` (`:65-104`): `claimed` is empty, `baseline` is empty, so `deletes` is empty
and `saves` is empty. **No requests, and no data loss** — the location's real moves survive untouched on
the server. The user sees an empty panel on a location that has moves, and adding one creates a sixth
rather than editing one of five.

So the interim is **display-incomplete and non-destructive**, which is an acceptable state to ship through
and an unacceptable one to leave undocumented. Two requirements if the split is taken:

1. **5f-3a's gate must pin the non-destructive property**, not assume it: attach an existing location that
   has custom moves, press `Next`, assert the ledger contains **no** `DELETE` for them. That is one
   assertion and it converts "I reasoned it is safe" into "it is measured safe." It is also the same
   assertion 5f-3b needs inverted (§30.5 gate item 1 asserts no create *or* delete once the fetch lands),
   so it is written once and tightened once.
2. **5f-3a must not render the panel as authoritative.** Whatever Rosalina and Luigi choose here is theirs,
   but the architectural requirement is that an attached location's panel must not imply "this location has
   no moves" while the fetch is absent. If that cannot be expressed without the fetch, then 5f-3a and
   5f-3b are not separable and the split should be declined — **that is the test, and it is Luigi's to
   apply, not mine to assume.**

If either requirement is awkward in practice, keep 5f-3 whole. The split is a recommendation with a stated
falsifier, not a ruling.

### Approved, with a reconsideration reserved for afterwards

**Skyler took the split**, and the falsifier above remains Luigi's to apply when he builds it. He also
reserved a return to the decision that *creates* 5f-3b in the first place: *"I may have changed my mind
about widening the list projection if it simplifies the means to display an attached location or
bystander."*

**§12 F5 carries that in full, and the headline is that it would not simplify 5f-3b — it would delete
it.** `attachLocation` needs a fetch for exactly one reason: `CustomMoves` is on the detail response and
not the list item. Put it on the list item and the attach stays the synchronous zero-HTTP signal update it
is today, which removes the fetch, all three in-flight signals per domain, both strips' busy treatment, the
`Next`-disabled correctness term, the 80-call-site stub — **and the interim state that made this split need
a falsifier at all.** F5 also prices the other side, which is not small: an uncapped collection of free
text on a list route that the locations-list page shares with the wizard catalogue.

**It is deferred, not open.** 5f-3a and 5f-3b proceed as approved, and **nothing in 5f should be designed
in anticipation of this reversing** — a sub-phase built half-way toward a change that may not happen is
worse than either outcome.

---

## 35.2 5f-0's no-op is provable — under **three** conditions, and the third one I had to check

§26.2 L10 states two conditions and both are correct. There is a third, it is load-bearing, and it is
already satisfied — which is why it belongs in the gate as a *verified premise* rather than a risk.

**Condition 1 (Luigi's) — it holds only because both ledgers sort.** Verified: `expectLedger` is
`expect([...sent].sort()).toEqual([...expected].sort())` in both files. One thing worth adding to his
framing, because it makes the gate stronger than he claims rather than weaker: sorting two arrays and
comparing with `toEqual` is **multiset** equality, not set equality. Duplicates survive the sort. So the
gate does prove *request count* as well as request identity, and the only thing it gives up is
**sequence** — which is the right thing to give up here, because `PUT /api/locations/{id}` and
`PUT /api/mysteries/{m}/locations/{id}` are independent resources whose interleaving is unobservable.
State the equivalence the gate proves (same multiset, any order), not just "the ledgers sort."

**Condition 2 (Luigi's) — 5f-0 must not adopt entity-level dirty checking.** Correct, and the two specs he
names (`phase4-ledger.spec.ts:404` S4 and `:206` A6) are the right ones. Worth noting *why* this temptation
is strong and structural rather than careless: the restructure's whole purpose is to introduce
`applySubResourceDiff`, and a developer who has just internalised "don't write what hasn't changed" one
level down will reach for it one level up. The guard is that the dirty check lives **only** inside
`applySubResourceDiff`, over the custom-move collection, per decision 9.

**Condition 3 (mine, verified) — the diff must emit on an empty collection, and it does.** This is the one
that would have made 5f-0 *not* a no-op, because 5f-0's defining state is "the new diff runs over empty
collections." `forkJoin([])` completes **without emitting**, so a `switchMap` downstream of an empty diff
would never run and phase 2's submit would hang — a hang, not a failed assertion, and the ledger specs
would report it as a timeout rather than a diff. It does not happen: `applySubResourceDiff` returns
`forkJoin({ deleted: batch(deletes), saved: batch(saves) })`, a **dictionary** forkJoin with two
always-present keys, and `batch` (`sub-resource-diff.ts:116-118`) is
`requests.length > 0 ? forkJoin(requests) : of<T[]>([])`. Empty in, `of([])` out, emits synchronously.

So the trap is already closed, by the same `runBatch` pattern `monster-create.ts:375-377` uses on the create
pages. **Name it in 5f-0's gate as a premise anyway**, for the reason §16.2-style verification exists in
this doc at all: a later change to `batch` that "simplifies" the empty case to a bare `forkJoin` would turn
every empty sub-resource collection in the wizard into a hang, and nothing currently says that
short-circuit is load-bearing. One sentence in `batch`'s own comment is the cheaper half of the fix.

**With all three stated, the no-op claim is sound.** 5f-0 should ship exactly as §30.2 describes, including
carrying phase 1's `index`-through-to-writeback approach rather than `backfillDraftIds`' positional match.

---

## 35.3 The order is load-bearing, and the reason is the oracle — not a dependency

Worth stating because it looks like it could be relaxed. Only **5f-3** actually depends on 5f-0: phases 2
and 3 need the two-stage shape before a location can write a sub-resource. 5f-1 is phase 0 and 5f-2 is
phase 1, which is already two-stage. So on dependency alone the cheap sub-phases could go first.

**They should not, and 5f-0 must stay first.** 5f-0's entire gate is *"both ledger specs pass unchanged."*
That claim is only meaningful while the ledgers are the ones the current code produces. 5f-1 amends six
`currentStep.set(3)` call sites across three spec files (§26.2 L8) and 5f-2 adds a fifth collection to the
phase-5a id-survival oracle (§30.4). Run either first and 5f-0's gate degrades to "the ledgers pass
unchanged *as amended by the sub-phase that just changed them*" — an oracle that has been edited by the
person it is meant to check.

This is the same principle as Phase 1 being additive-only on the backend and as 5f-0's own existence: **do
the behaviour-preserving restructure while an unmodified oracle still exists to prove it preserved
behaviour.** Keep `5f-0 → 5f-1 → 5f-2 → 5f-3a → 5f-3b`.

---

## 35.4 Finding 1 needs a structural answer in the wizard, and it is not a test

§29.4's discovery — **the card's `ownerType` and the host's service owner type are two independent
literals, neither guarding the other** — is the most important thing the implementation learned, and in the
wizard it changes form rather than going away.

The card does not travel into the composers (§35.5), so the *presentational* literal is absent there. What
is present is worse: §30.1's factory is called **with an owner-type literal at each use site**, and those
use sites are spread across `submitPhase0`, `saveThreatCollections`, `saveMinionCollections`,
`saveLocationDraft` and `saveBystanderDraft` — five methods in a **3,187-line store**. A wrong literal
(`customMoveSubResource('Monster')` inside `saveMinionCollections`) is one token, compiles, and writes a
minion's moves into the monster owner space. Nothing reads them back on that page, so it is invisible until
someone opens the monster.

**On the detail and create pages this error class is bounded by construction** — there is one host, one
owner, one literal, and the exact-call ledger asserts the URL. In the wizard there are five owners in one
file, which is the condition under which "assert it per site" stops being sufficient on its own.

### Recommendation: five adjacent adapter fields, created once — never a factory call at a save site

```
private readonly mysteryMoves   = this.customMoveSubResource('Mystery');
private readonly monsterMoves   = this.customMoveSubResource('Monster');
private readonly minionMoves    = this.customMoveSubResource('Minion');
private readonly locationMoves  = this.customMoveSubResource('Location');
private readonly bystanderMoves = this.customMoveSubResource('Bystander');
```

…and every save site passes `this.minionMoves`, never `this.customMoveSubResource(...)`.

This does not remove the five literals — nothing can, the owner type genuinely is data. It does something
narrower and sufficient: **it collapses them from one-per-call-site scattered across five methods into five
adjacent declarations that read as a table.** A reviewer can check a five-line block against the five
collection names in one glance; they cannot check five literals a thousand lines apart. That is exactly the
move §2.9 made for routes (one constraint, not five `[HttpGet]` attributes), that `OWNER_SEGMENT` made for
route segments, and that §30.1's factory already half-makes by existing at all — this is the other half.

Two supporting requirements:

1. **A derived per-owner write assertion**, in the §27.3/L11 spirit rather than a transcribed one: for each
   of the five collections, drive the wizard path that saves it and assert the request URL's owner segment.
   Five assertions, one loop, and it fails on the exact mistake above. The `data-owner-type` analogue does
   not exist in the wizard, so this is the *only* guard on the write half — §29.4's closing warning
   (*"asserting `data-owner-type` per page proves the card is labelled right, not that the page writes to
   the right owner"*) applies here with no second line of defence.
2. **Phase 6's drift guard should not be assumed to cover the wizard.** §29.4 is right that the attribute
   does not cover the write path; in the wizard there is no attribute at all. Phase 6's five-domain parity
   spec covers the nine card call sites. The wizard's five owner literals need their own assertion, and
   §31.3's scope should be read as "nine call sites", not "five domains".

---

## 35.5 The card should **not** travel into the composers — and finding 3 is answering a different question

§13.5.3 declined to put the shared card in the wizard composers, on density: the `w-[42%]` column is a
different density, *"share across pages of the same density; copy across densities."* §29.5 then found that
**the draft surface is free** — the card owns its own form, so a host needs no `ReactiveFormsModule` and no
`FormBuilder` — which makes it fair to ask whether the density argument was the whole cost.

**It was not the whole cost, and the real one is decisive. Keep her call.** The reason is a type-level
mismatch the implementation created and nobody has yet named:

| | Identity model | Why |
|---|---|---|
| `CustomMoveRow` (`custom-moves-card.component.ts:27-33`) | **one** field — `key: string` | *"the server id on a detail page, a client draft key on a create page"* |
| `SubResourceIdentity` (`mystery-create.store.ts:69`) | **two** fields — `id: string \| null` and `localKey: string` | the diff needs both: `id` decides create-vs-update, `localKey` keeps the row stable across the transition where the id arrives |

`CustomMoveRow.key` **collapses** a distinction that *is* the wizard's algorithm. `applySubResourceDiff`'s
first branch is `draft.id === null → create`; its carried-forward branch exists so a clean row's key
survives a phase transition. A single opaque `key` cannot express "I am this row and I have no server id
yet," and from the type you cannot tell which kind of key you are holding.

So hosting the card in a composer requires one of two things, and both are worse than a hand-written panel:

- **Widen `CustomMoveRow` to carry both fields** — degrading the type for all **nine shipped call sites**
  that correctly need only one, to serve five that are not using the card.
- **Keep a parallel key→id map in the composer** — a second source of identity truth, in the one subsystem
  that has been bitten twice by baseline-and-draft divergence (`mystery-entity-linking.md` rev 12, BUG 1
  and BUG 2). That is the §2.12-item-2 hazard class exactly.

**So finding 3 is true and does not reach this decision.** It measures the cost of *hosting a form*; the
blocker is the cost of *reconciling two identity models*. The card's single-`key` model is the right
simplification for a surface that writes immediately or stages once, and the wrong one for a surface whose
rows are diffed against a baseline across phase transitions. Rosalina's conclusion stands on a sturdier
footing than density — and the general rule worth keeping is **share a component across surfaces that agree
about identity; copy across surfaces that do not.**

One consequence for §30.1's `CustomMoveDraft`: it must extend `SubResourceIdentity`, so it is *not*
`CustomMoveRow` with extra fields and no one should try to derive one from the other. They are two view
models of one wire type, which is the normal and correct outcome.

---

## 35.6 What is now wrong in my own §§0–12, and what I amended

Corrected in place, no changelog. Listed so the other authors can see what moved under them.

| Where | Was | Now |
|---|---|---|
| **R12** | The confirm-modal census *"will fail on a change that looks unrelated to it"*; named as 5e's gate. | **Inverted — this was wrong, and 5e measured it.** The eleven non-wizard rows are self-referential (`Object.keys(perTemplate)` compared against the literal three lines above), so a new call site **silently passes**. The gate is the opposite of what I wrote: not "expect a surprise failure" but "expect no failure, and update the literal by hand." The spec's derived half covers only the **wizard** rows, from `mystery-create-phase5b-monster-phase.spec.ts` — so for **5f** the warning is live and genuine. R12 now says both halves and points the live half at 5f. |
| **R14** | A live hazard for 5e: don't add an inline error surface to `mystery-detail`. | **Discharged.** Phase A made `errorMessage` load-only across all five detail pages and 5e built the fifth with the rule already in force, with both halves pinned by negative controls. Marked as closed by Phase A + 5e rather than left reading as pending work. |
| **§4.1** | Three component additions for `mystery-detail`, one deliberate non-addition. | **Five**, measured by 5e: `activeMutation`/`isMutating`, `NotificationService`, the modal plus page-owned `pendingDelete`, **a `mysteryId` signal** (`ngOnInit` read `params.get('id')` inside its pipe and discarded it), and **a targeted refetch** that reloads only the mystery. The non-addition held exactly. |
| **§5 Phase 4** | *"Do not promote `sub-resource-diff.ts` to `shared/`"* on the conceptual ground that the other surfaces have no baseline. | Kept, with Luigi's mechanical reason folded in because it is sturdier: the file imports `SubResourceIdentity` **from `mystery-create.store.ts`**, so promoting it drags a 3,187-line store into `shared/` or forces that type to move first. A reason that does not depend on anyone agreeing about baselines. |
| **§5 Phase 5f** | Four sub-phases. | Five, per §35.1, with the interim state and its falsifier stated. |
| **R11** | The wizard's cost is phases 2/3 and the attach, unquantified. | Same conclusion, now with the measured numbers (80 call sites in 4 spec files; 24 per-owner sites of which 10 are unprotected by the compiler) and a pointer to 5f-0's three conditions. |
| **§2.12 item 2** | Correct as amended last round. | Unchanged in substance; the reference to 5f-3 now reads 5f-3b, which is where the cost actually sits. |

**One thing in §§0–12 that I checked and left alone:** §2.9's `SUPPRESS_ERROR_TOAST` requirement. L11
re-measured the two 404s as distinguishable (162 B `problem+json` vs. 0 B bodiless), which weakens the
*diagnostic* argument I gave for it. The requirement stands on the other leg — two toasts per failure, one
of them naming a URL and a GUID beside a hedged caveat — and that leg is untouched. Noted rather than
amended, because the sentence I wrote is still true; it is just no longer the strongest reason.

---

## 35.7 Three things I would flag in §§13–34, without editing them

Boundary respected; these are for their authors.

1. **§30.4's five unprotected sites deserve one more than it gives.** It supplies assertions for
   composer-dirty, writeback and reset. `monsterComposerPreview()` (site 4, the dossier's source) has
   none — and 14-R10's own argument is that *"a collection missing from the dossier reads to the user as a
   collection that did not save."* A preview omission is silent in exactly the way the other four are, and
   the dossier is the surface whose whole job is to report what was authored. One assertion that a composer
   holding only a custom move appears in the preview would close it.

2. **§30.5's gate item 3 is right and understates its own precedent.** *"The 80 call sites' stub returns
   something non-empty in at least one test, or the whole fetch path is covered only by `of([])`"* is the
   standing rule *"a fake repository must mirror the real one's return semantics"*
   (`toad-fake-repositories-must-mirror-real-return-semantics.md`) — a hardcoded empty return makes every
   round-trip assertion vacuous. Citing the record would put it in the same frame as the three other
   standing test decisions this plan already leans on.

3. **§13.5.3's "no row edit in the wizard panels" is now a three-way inconsistency, not a two-way one.**
   Her reasoning (the four neighbours have none, no room at that density, don't grow 5f) is sound and I
   would not change the call. But after 5a–5e the detail *and* create surfaces both have row edit, so the
   wizard is the only place a custom move cannot be edited in place — and F-R1 covers it as "all five
   wizard collections at once," which is the right shape. Worth one line in §30 acknowledging it is three
   surfaces disagreeing rather than two, so the first bug report about it meets a documented decision.

---

## 35.8 Questions for Skyler

**One, and it is the only thing I would want answered before Luigi starts.**

**Q — Take the 5f-3 split, or keep 5f-3 whole?** (§35.1.) Splitting makes the deferrable-under-pressure
unit exactly the expensive half (the attach fetch, 80 spec call sites, the new in-flight state, the
`Next`-during-attach correctness fix) while shipping the capability parity §13.5.4 argues must not be cut.
The cost is one more sub-phase boundary and one interim state — an attached existing location shows an
empty moves panel while its real moves sit untouched on the server, which is display-incomplete and
provably non-destructive.

**My recommendation: split**, with 5f-3a's gate pinning the non-destructive property rather than reasoning
it. **Decline the split** if Luigi judges that an attached location's panel cannot be rendered honestly
without the fetch — that is §35.1's stated falsifier and it is his call, not mine.

> **Answered: the split is approved**, falsifier intact. Skyler also reserved a post-Phase-6 return to the
> list-projection ruling that makes 5f-3b necessary — recorded as **§12 F5**, cross-referenced at §6.5 and
> §35.1, and **deferred, not open**. The finding worth carrying out of it: widening the two list items
> would **delete** 5f-3b rather than simplify it, and would orphan `CustomMoveService.list()`, which
> shipped in Phase 4 under decision L-D3 on the promise that 5f-3 would be its first caller and gate. The
> question to put at that point is not *"widen the list?"* but **"cap custom moves per owner?"** — the
> first answer falls out of the second, because the only serious objection to widening is an uncapped
> collection of free text on a shared list route.

Everything else in §30 I would build as written. Nothing in Phases 1–3, 4 or 5a–5e needs revisiting.
