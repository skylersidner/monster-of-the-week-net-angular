# Domain Custom Moves — Anchored Inline Regex for the Owner Segment, and the Constructor Sweep Lands in Phase 1

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-10-10
**Status:** Recommended; appended as §§16–25 of `docs/domain-custom-moves/architecture.md`. Yoshi's §§0–12
and Rosalina's §§13–15 unchanged. **No production code written, no migration authored, nothing committed.**
Re-opens none of §8.1's fourteen decisions.

## What

Two calls, plus the corrections that produced them.

**1. `{owner}` is an *anchored* inline `regex` constraint hoisted to one `const string` on
`CustomMovesController`, not a registered `IRouteConstraint`, and the segment→enum dictionary is
`StringComparer.OrdinalIgnoreCase`.**

```csharp
private const string OwnerSegment =
    "{owner:regex(^(mysteries|monsters|minions|locations|bystanders)$)}";
private const string Collection = "api/" + OwnerSegment + "/{ownerId:guid}/custom-moves";
private const string Item       = Collection + "/{moveId:guid}";

private static readonly IReadOnlyDictionary<string, CustomMoveOwnerType> Owners =
    new Dictionary<string, CustomMoveOwnerType>(StringComparer.OrdinalIgnoreCase) { ... };
```

**2. The `ICustomMoveService` constructor-and-registration sweep lands in Phase 1, not Phase 2**, as a
provable no-op commit ahead of the feature.

## Why

**The constraint, not the registration — because three test harnesses build their own host.**
`MysteryLinkApiHarness.cs:97-125`, `MinionReparentApiHarness.cs:97-110` and
`ResourceImageApiHarness.cs:75-91` each call `WebApplication.CreateBuilder` and say so in their own XML
docs (*"it is not `Program.cs`"*). A named constraint lives in `RouteOptions.ConstraintMap`, configured on
the host, so **none of them would see it**: the route would still match, the unknown-segment 404 gate would
pass for the wrong reason, and the one thing the constraint exists to prove would be untested. Mitigating
that means a shared `AddTo(RouteOptions)` helper called from `Program.cs` *and* every harness — four more
forgettable call sites, to replace a literal in an attribute.

**The anchors are mandatory and I proved it rather than assuming it.** In a throwaway `dotnet new web`
project with a real `[ApiController]` on SDK 10.0.400: `RegexInlineRouteConstraint` matches with `IsMatch`,
which is **unanchored**, so `{owner:regex((mysteries|monsters))}` accepts `/b/xmonstersx/{guid}/custom-moves`
with `owner == "xmonstersx"`. Dropping `^...$` is a silent widening that looks identical in review.

**The `OrdinalIgnoreCase` dictionary preserves a shipped behaviour that nobody would think to test.**
Verified against the running dev API: `GET /api/MONSTERS/{realId}/CUSTOM-MOVES` returns `200 []` today.
Verified in the probe: the constraint is case-insensitive and hands the action the caller's **original**
casing (`owner == "MONSTERS"`). So an ordinal dictionary throws `KeyNotFoundException` → 500, and a URL
that works today stops working. One constructor argument, invisible in review, and the cheapest thing in
the whole plan to get wrong.

**Generalisable:** *when a route constraint replaces a literal segment, the parameter inherits the
literal's case-insensitive matching but not its case-normalised meaning — so anything that maps the value
must be case-insensitive too.*

**Binding the segment straight to the enum is rejected on wire shape, not on safety.** It would force
singular segments (`/api/monster/…`), breaking the plural convention all ~80 existing templates follow, and
it answers a bad segment with a `400` ProblemDetails instead of the bare 404 every other unknown `/api`
path gets from `Program.cs:219`'s catch-all. One probe result is worth keeping anyway, because it cuts
against intuition: **MVC's enum binder rejects `/c/7/…` with a 400, but a minimal-API host binds it
successfully as `(Owner)7`.** So a five-member enum is not five values, and
`OwnerExistsAsync`'s `_ => throw new ArgumentOutOfRangeException` arm is unreachable because of which
binder is in play, not because the type prevents it. Keep the arm and guard it.

**The sweep in Phase 1, because it is 67 call sites and three silent 500s.** `ICustomMoveService` becomes a
constructor dependency of all five domain services, which reaches `new {Monster,Minion,Location,Bystander,
Mystery}Service(` at **67 sites across seven test files** — including `MonsterImageCleanupTests.cs` (3) and
`ByMysteryVariantsStayOutOfScopeTests.cs` (2), which `architecture.md` §§9–11 name nowhere — plus the three
harness registrations above. `Program.cs:38-41` already records why the registration half is special:
*"Missing this registration doesn't fail the build; it fails the first request to any of those
controllers."* Left in Phase 2 it buries the entity, the config, the migration and the service under ~70
mechanical edits, and a missed harness registration makes §2.4's extended cascade test fail as a *cascade*
bug. Phase 1 is additive and has nothing else to do, and the sweep is behaviour-preserving — the same
discipline §5 applies to 5f-0.

## Consequences

- **Two gate wordings in §5 cannot be met as written.** Phase 3's *"net-negative `git diff --stat`"* is
  impossible: every migration carries a full model snapshot in its `.Designer.cs`
  (`20261005034116_AddResourceImages.Designer.cs` is 2,992 lines), so Phase 1 and Phase 3 each add ~3,000
  generated lines. Restate both as net-negative **excluding** `Data/Migrations/*.Designer.cs` and
  `MotwDbContextModelSnapshot.cs`.
- **The real-Postgres gate is skip-by-default.** `PostgresFactAttribute:23-31` sets `Skip` unless
  `MOTW_TEST_POSTGRES` is set, so `dotnet test` reports Phase 1's and Phase 3's gate as *Skipped*, never as
  failed. Both gates should carry the literal command. And a new Postgres-gated class **must** join
  `[Collection(ResourceImagePostgresCollection.Name)]` — that collection exists because two such classes
  racing `EnsureDeletedAsync` against one database name corrupted each other, caught for real.
- **Phase 3's irreversible step is applied by *deploying*.** `MotwDbInitializer.cs:14` calls
  `Database.MigrateAsync()` and `Program.cs:200` runs it on every boot. There is no
  `dotnet ef database update` step and no human in the loop. Corollary: **do not author the drop migration
  before Phase 3** — in the tree during Phase 2 it drops the five tables the next time anyone runs the dev
  server, against code that still reads them.
- **§2.5's "every write path, no exemptions" is one query too many on two verbs.** Today
  `UpdateCustomMoveAsync`/`DeleteCustomMoveAsync` do no owner-existence check; their
  `(owner, moveId)` predicate is the check, and under the new shape `(OwnerType, OwnerId, Id)` is
  *strictly stronger* than owner-existence. Owner check on `CreateAsync` and `ListAsync` only — two of six
  methods. That is not a weakening; §2.5's own closing guarantee is produced by the predicate.
- **The Phase 2 "same status codes" gate is satisfiable, and it was not obvious.** Monsters/Minions map
  custom-move errors through `ToActionResult`→`ToErrorResult` (`Validation` → 400); Locations/Bystanders
  hand-roll `IsSuccess ? Ok : NotFound`, collapsing everything to 404. One controller can only have one
  policy — but **no** custom-move service method on any of the four returns anything but `NotFound`, so the
  two policies are indistinguishable here. Adopt `ToErrorResult`. Preserve `POST` → **200, not 201** (all
  sixteen actions it replaces return `Ok`) and `DELETE` → 204 | 404.
- **§2.6 undercounts.** Seven projection call sites, not five — Mystery has three (`MysteryService.cs:29`,
  `:55`, `:81`), because it is the one service whose Create/Update do not funnel through `GetByIdAsync`.
  And the extra query lands on **every entity create and update response**, not only detail loads, because
  the other four do funnel. Offsetting benefit the doc does not claim:
  `MonsterRepository.GetMonsterDetailAsync` is a six-collection single query with no `AsSplitQuery`, so
  dropping `CustomMoves` takes it to five and reduces the rows returned. The trade is +1 round trip, −1
  collection join.
- **Mystery's transaction is needed for a sharper reason than parity.** The four shipped flows clean up
  *before* deleting the owner, so a non-transactional failure between the two steps destroys the mystery's
  custom moves while leaving the mystery alive — **data loss, not a leak**, which is worse than the orphan
  the cleanup exists to prevent.
- **`MonsterMinionCascadeTests` needs four changes, not one.** §2.4 asks for the minion custom-move seed;
  it also needs the before-assertion (the file's own `// The premise, asserted` block exists for exactly
  this), a count-to-zero with a **third owner whose moves must survive** (a single-owner fixture cannot
  distinguish "cleaned this owner" from "cleaned everything"), and the **detach complement** — a
  `DeleteAllForOwnerAsync` wired into the unlink path by mistake is invisible otherwise.
- **`MotwDbContext.cs:504-505`'s comment goes false** when `custom_moves` lands: it says no other entity
  uses `HasConversion`. Amend it in the same commit, at the one site that exists to explain the choice.
- **Swagger loses the five concrete routes as §2.12 item 4 says, but it is Development-only**
  (`Program.cs:179-183`) — dev ergonomics, not an API contract. Measured: 8 templates / 16 operations
  become 2 / 4 with `owner: string` and no enum. A ~15-line `IOperationFilter` would cure it; recommended
  **not** to build it, since `AddSwaggerGen()` has no filters today and this is a phase about subtraction.
- **One new test belongs in Phase 2 that §10 puts nowhere:** a five-domain *backend* parity test modelled on
  `ListProjectionPrimaryImageAgreementTests`. Five services each pass their own `CustomMoveOwnerType`
  literal into `ListForProjectionAsync`; a wrong one compiles, passes every test that does not seed a
  custom move, and returns another owner's rows.

## Settled by Skyler, 2026-10-11 — the three §25 questions

Recorded as §16.4 D1–D3 in `docs/domain-custom-moves/architecture.md`; §25 keeps each question's reasoning
so the answer stays checkable. Work is on branch `custom-moves`.

| # | Question | Answer |
|---|---|---|
| D1 | Two commits inside Phase 1 — the 67-site constructor sweep separate from the entity/config/migration/service? | **Yes.** *"Two commits is fine."* The only deviation from §5's one-commit-per-phase, and only in Phase 1. |
| D2 | Rename `ResourceImagePostgresCollection` → `PostgresCollection`? | **Yes.** *"Yes, renaming is fine."* Class, `const Name` value, `[CollectionDefinition]`, both `[Collection]` attributes. Lands in Phase 1's **first** commit. |
| D3 | Will the manual real-Postgres run happen at Phase 1 and Phase 3? | **Yes.** *"We can run the migration during each phase it's needed in."* §5's gates stand; the `dotnet ef migrations script` fallback is **withdrawn**. |

**The one thing the answers changed rather than confirmed, and it was not in the question.** With two
commits real, the order stopped being a preference and became a constraint: `FakeCustomMoveService`
implements `ICustomMoveService`, and the `Program.cs` and three harness registrations name a type that does
not exist until the feature lands — so **commit 1 can only contain what introduces no new types.** That is
exactly the 67-site extraction plus the D2 rename, which makes it a *stricter* no-op than I proposed (zero
production files touched, checkable by `git diff --stat`) and reduces commit 2's test-tree cost to seven
one-argument edits. **Generalisable: "split the mechanical half into its own commit" is only safe once you
check which half can compile alone — a fake or a DI registration cannot precede its interface.**

**D3 confirms the gate without changing its defect.** `PostgresFactAttribute:23-31` still sets `Skip` when
`MOTW_TEST_POSTGRES` is unset, so a plain `dotnet test` still reads *Skipped* rather than failed. The
literal command stays in both gates and each phase's checklist must **record** the run, not merely require
it. Withdrawing the `migrations script` fallback is a gain, not a concession: it would have proved the
generated SQL and not the server's acceptance of it, which is the half that matters for a migration that
drops five tables.
