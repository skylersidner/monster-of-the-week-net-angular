# Mystery Entity Linking Phase 1 — the membership PUT returns bool, and the duplicate-key race is deferred to Phase 2

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-09-19

## What

Implemented Phase 1 of `docs/updates/mystery-entity-linking.md` (§9): the link verb, backend only,
no UI, no migration, no DTO change.

```
PUT /api/mysteries/{mysteryId}/monsters/{id}     -> 204 | 404
PUT /api/mysteries/{mysteryId}/locations/{id}    -> 204 | 404
PUT /api/mysteries/{mysteryId}/bystanders/{id}   -> 204 | 404
```

Three implementation calls beyond what the design specified:

1. **`Task<bool> LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken)`, not
   `ServiceResult<T>`.** The verb has exactly two outcomes — it worked, or one of the two ids does
   not exist — and no request body means no validation failure to distinguish. `bool` is what the
   shipped `UnlinkFromMysteryAsync` returns, and the controller action is the same one-line ternary
   (`? NoContent() : NotFound()`). `ServiceResult` would have bought a message no caller reads.

2. **Existence checks precede the already-linked check.** Order is mystery-exists -> entity-exists
   -> already-linked (return true, no write) -> add + save. Cheapest-first would have put the
   already-linked `Any` first, but then a PUT naming a deleted mystery could return 204 off a stale
   bridge row instead of 404. Correctness of the 404 contract beats one saved query.

3. **The check-then-insert is deliberately not made atomic in Phase 1.** Two concurrent identical
   PUTs both pass `AnyAsync` and both insert; the second `SaveChangesAsync` throws
   `DbUpdateException` on the composite PK and the caller gets 500 rather than 204. **Deferred, not
   dismissed: this is a Phase 2 gate and it is mine.** See Why for the reason and for the specific
   shape the fix has to take.

Repository layer gained only `LocationLinkedToMysteryAsync` / `BystanderLinkedToMysteryAsync`
(`AnyAsync` over the bridge table). `MonsterLinkedToMysteryAsync` already existed from Phase 7 and
**had no production call site until now** — it was written speculatively and only the test fake
referenced it.

## Why

**The URI already ships as the unlink `DELETE`, so the whole change is a mirror, not a new shape.**
Every decision above resolves to "do what the DELETE does," which is why the diff is 16 files and
no new abstraction. Yoshi's §4.1 argument for `PUT` over `POST`-to-collection stands unchanged.

**Idempotency is load-bearing, not a nicety.** §5.1 fires this unconditionally from `forkJoin`
batches for every draft carrying an id, without knowing whether the link exists. A 409 on re-link
would break that caller by design, so the already-linked branch returns success and writes nothing
— verified by a test asserting the repository's link call count stays at 1 across two calls.

**On the race — corrected 2026-09-19 after Boo's review; the first version of this paragraph gave a
reason that does not survive contact with the code, and the wrong reason is the thing a future
reader inherits.** I had written that guarding it costs importing `Microsoft.EntityFrameworkCore`
into a service layer that knows only repository interfaces. **That cost is not real.** The same
paragraph then named the repository as the fix's proper home, and EF is already imported in all
three repository files — so the layering objection was answered by my own next sentence. Struck.

**The accurate reason is reachability.** Phase 1 ships with no client (§9: "Ships with no UI"), so
nothing can reach the race until Phase 2 wires `linkToMystery` into the Angular services.
**It is therefore a Phase 2 gate, and it is mine.** It is also a robustness defect rather than a
vulnerability: the composite PK still holds the data invariant, and production answers with a
generic `ProblemDetails` carrying no stack trace or SQL. Boo's review is the authority on that
classification — `.squad/decisions/records/boo-mystery-entity-linking-phase1-security-review.md`.
Yoshi is recording the gate itself in the design doc; this note does not restate it.

**What the fix has to be, because two obvious versions are worse than the 500 they replace.**
Recording the shape now so Phase 2 does not rediscover it:

- **Not a blanket `catch (DbUpdateException) { return true; }`.** There is a *second*, separate
  TOCTOU in the same method: the existence checks pass, the mystery or the entity is deleted
  concurrently, and the insert then fails on the **foreign key**, not the primary key. A blanket
  catch swallows that too and returns 204 for a membership that does not exist — and §5.1 has the
  wizard trusting exactly that answer. A 500 is an honest failure; a false 204 is a silent lie.
- **Not `when (ex.InnerException is PostgresException { SqlState: "23505" })`.** Correct against
  production and untestable here: `MysteryLinkRepositoryTests.LinkFixture` runs in-memory SQLite and
  throws `SqliteException`. A guard the only harness that can reach it cannot exercise is a guard
  nobody notices breaking.
- **Boo's version, which is the one to build:** in the repository, behind a single insert-and-save
  method, catch `DbUpdateException` and **re-check `…LinkedToMysteryAsync`**. Row now present → the
  concurrent insert won and 204 is truthful. Row absent → rethrow, because the failure was not a
  duplicate. Provider-agnostic, exercisable under the existing SQLite fixture, and it discriminates
  on whether the membership actually ended up existing rather than on a vendor error code. **Detach
  the `Added` entry before returning**, so the abandoned insert cannot be retried by a later
  `SaveChanges` in the same request.

`MysteryLinkRepositoryTests.DuplicateBridgeRow_ThrowsOnTheCompositeKey_RaceIsUnguarded` is Toad's
characterisation test for today's behaviour and is the one that flips when this lands.

**Still true and unchanged:** the trigger is narrow. The wizard's `forkJoin` batches issue one PUT
per *distinct* entity, so they contend on different rows and cannot produce this; it needs two
simultaneous PUTs of the same (mystery, entity) pair.

## Not decided here

Frontend `linkToMystery` on `core/{monster,location,bystander}.ts` is Phase 2. Decisions 8-14
(sub-resource upsert, dirty-tracking, the roster, `pendingRemovals`, the modal sweep) are Phases
3-5 and are untouched. No existing endpoint's behaviour changed.

**The duplicate-key guard is not implemented here and must not be** — Phase 2 owns it, and Toad is
running his suite against the current tree, including the characterisation test that asserts today's
unguarded behaviour. It lands with the same change set that gives the endpoint its first client.

## Verification

`dotnet build MonsterOfTheWeek.slnx` -> Build succeeded, 0 errors, 1 pre-existing warning
(`HunterServiceTests.cs(606,60)` CS8603, a file this change does not touch).
`dotnet test MonsterOfTheWeek.slnx` -> 454/454 passed (439 pre-existing + 15 new: link succeeds,
link is idempotent, unknown mystery, unknown entity, link/unlink round-trip, x3 entities).

Left uncommitted on `mystery-entity-linking-phase-1` for review.
