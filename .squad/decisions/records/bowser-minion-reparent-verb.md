# The minion re-parent verb is a move, not a link, and it is shaped to say so

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-09-20
**Approved by:** Skyler, 2026-09-20 — *"We should build it now."*

## What

`PUT /api/monsters/{monsterId:guid}/minions/{id:guid}` → **204 | 404**, no body.

- `IMinionService.MoveToMonsterAsync(Guid monsterId, Guid id, CancellationToken)` + impl.
- One controller action, the house ternary: `? NoContent() : NotFound()`.
- **No repository change** — `MonsterExistsAsync`, `GetForUpdateAsync` and `SaveChangesAsync`
  already existed. No DTO, no migration, no existing endpoint touched.

Order inside the service, copied from the Phase 1 membership verb: monster exists → minion loads →
already on that monster (return success, write nothing) → assign + save.

**Explicitly rejected: `MonsterId` on `UpsertMinionRequest`.** Non-nullable would re-parent every
existing caller — `minion-form`, `minion-create`, `minion-detail` — to `Guid.Empty` and trip the
FK. `Guid?` with "null means leave alone" is PATCH semantics inside a PUT, which is the same
ambiguity that got `MysteryIds` rejected from the three `Upsert*Request` records, and it
contradicts the standing principle that a relationship is its own resource.

## Why

**Because it is a different verb from the one it looks like, and the code has to say so.** Mystery
membership is M:N across a bridge table: `PUT` *adds* a row and disturbs no other membership.
`Minion.MonsterId` is a required, non-nullable, single-valued FK: there is one row, it is updated
in place, and arriving at the new monster and leaving the old one are **the same event**. Both
verbs are idempotent and both return 204, so the resemblance is real and misleading. Hence the name
`MoveToMonsterAsync` rather than `LinkToMonsterAsync`, and an XML doc that states the distinction
at the point someone would otherwise copy the wrong assumption out of it.

**The duplicate-key guard does not transfer, and porting it would have been cargo cult.** No insert
means no composite primary key to violate, so there is nothing for a `DbUpdateException` re-check to
discriminate on. Two concurrent re-parents of the same minion are plain last-writer-wins on one row;
every ordering leaves the minion on a real monster, and none can produce the 500 the Phase 2 gate
existed to close. The FK-side TOCTOU survives — target monster deleted between the check and the
save — and still surfaces as a 500. That is the same call Phase 2 made deliberately: an honest
failure beats a false success, because the wizard trusts a 204.

**What made this necessary at all:** `docs/updates/mystery-entity-linking.md` §6.4 said re-parenting
was *"just a field edit"* and `mystery-entity-linking-ux.md` §6 said it was *"a `PUT` of
`MonsterId` at submit."* Neither existed. Without this endpoint, Phase 5b's minion composer would
have changed the picker, PUT the four fields it does have, received a **200**, and left the minion
on its old monster — a silent no-op of exactly the shape §5.1's Concern A describes one level up.

## Verified rather than assumed

- **Nothing caches a minion's parent.** `GetByMonsterIdAsync`/`GetAllAsync` project `x.MonsterId`
  and `x.Monster.Name` live; `MonsterListItemResponse.MinionCount` is `x.Minions.Count`;
  `MonsterDetailResponse` does not embed minions; `MinionSearchProvider` queries at request time and
  never reads the parent. A move is visible everywhere immediately.
- **Sub-resources travel by construction** — `MinionAttack.MinionId` and siblings hang off the
  minion, never off the monster.
- **The column is already indexed** — `MotwDbContext.cs:377`, `HasDatabaseName("idx_minions_monster_id")`.

## Verification

`dotnet build MonsterOfTheWeek.slnx` → Build succeeded, 0 errors, 1 pre-existing warning.
`dotnet test MonsterOfTheWeek.slnx` → **562/562** (548 baseline + 14 new: 4 service, 10 endpoint).

Three broken implementations bite-checked in a scratchpad copy, each refuted by distinct named
tests: no idempotency short-circuit; no monster-exists check; and no assignment at all — the silent
no-op, which fails four tests across both layers. The bite-check also caught one of my own tests
passing vacuously (a round-trip whose start state equalled its expected end state); it now asserts
the intermediate state.

Left uncommitted on `mystery-entity-linking-phase-1`.
