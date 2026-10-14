# Domain Custom Moves — One Table, One Service, One Controller

**By:** Yoshi (Architect)
**Date:** 2026-10-10
**Status:** Recommended; Skyler's structural answers folded in the same day. Full read and phased plan:
`docs/domain-custom-moves/architecture.md`.

## What

Collapse the five per-domain custom-move tables (`MysteryCustomMove`, `MonsterCustomMove`,
`MinionCustomMove`, `LocationCustomMove`, `BystanderCustomMove`) into a single `CustomMove` entity on
`custom_moves`, discriminated by `(OwnerType, OwnerId)` — the `ResourceImage` pattern — **and collapse the
sixteen per-domain controller actions into one `CustomMovesController` with four actions**, plus one
backend service and one frontend client service. Everything that exists today for custom moves is torn
down and replaced (inventory: `architecture.md` §9).

Four sub-decisions ride with it:

1. **A new `CustomMoveOwnerType` enum**, five members including `Mystery`. **Do not** extend
   `ResourceOwnerType`. Skyler cut mystery images from scope, so `resource_images.owner_type` has no legal
   `Mystery` value; adding the member would make `ResourceImageService.OwnerExistsAsync`'s
   `_ => throw new ArgumentOutOfRangeException` arm reachable from a route that compiles — a latent 500 in
   exchange for avoiding a five-line duplicate enum.
2. **One controller, four actions, all five owner types**, via a route segment constrained to
   `mysteries|monsters|minions|locations|bystanders` and mapped to the enum by one dictionary. This is the
   app's first parameterised non-terminal route segment; every other segment in every route template is a
   literal, and nothing collides.
3. **The path stays nested** — `/api/{owner}/{ownerId}/custom-moves`, not a flat `/api/custom-moves`.
   The only refinement of Skyler's instruction rather than a literal adoption of it.
4. **`customMoves` stays embedded in the five detail responses**, fetched server-side, fed by a second
   service query rather than an EF `.Include` — the nav property cannot survive a discriminated FK-less
   column.
5. **Custom moves stay a sub-resource with their own write calls, at create time as well as after.** No
   entity request gains a `customMoves` field. Create pages stage moves locally and write them as one more
   `runBatch` arm in the post-create `forkJoin` they already run for every other sub-resource. Skyler's
   call: *"it does make more sense to not do this as a one-shot, since we are doing a series of
   sub-resource calls."*

Accepted trade-off: no database-enforced referential integrity and no automatic cascade delete. Ownership
is validated at the service layer on write; `DeleteAllForOwnerAsync` is called from all five delete flows,
including inside `MonsterService.DeleteAsync`'s existing minion-id loop.

## Why

**The test is whether the row is field-for-field identical across domains, not whether the codebase has a
per-domain convention.** `resource-images/design.md` §1.3 set that test and it is the right one — but its
own justification is factually wrong about custom moves. It lists
`LocationCustomMove`/`BystanderCustomMove` beside `MonsterAttack`/`MinionAttack` as examples of "genuinely
different data per domain." Attacks are (`Harm`, weapon tags); armors are (`HarmSoak`, `IsSpecial`); custom
moves are **not** — all five are `Id / OwnerId / Name / Description?`, identical down to property order.
Custom moves are the one item on §1.3's own list that fails its own counter-example.

**I had recommended keeping the five tables, and I was wrong, because I reasoned from the visible
convention rather than from the rows.** Carry the test forward, not the outcome: applied honestly it says
unify custom moves and says **do not** unify `MonsterAttack`/`MinionAttack`. This is the codebase's second
departure from per-domain duplication and the next person will read it as a trend.

**I also initially recommended keeping the five controllers and sixteen actions ("routes do not change"),
and Skyler was right to push back.** My reason was that an unchanged external contract is risk reduction,
following resource-images' explicit "no fifth cross-cutting controller" rule. **But a small diff is only a
virtue when the code being preserved has value, and here it had none** — those sixteen actions are five
copies of the same four signatures that *nothing has ever called*, since no client service calls
`/custom-moves` at all. Preserving them would have been permanent maintenance cost spent protecting dead
code. The generalisable form: *"minimal change" is a means, never a goal; price it against what the
preserved code is worth, which is sometimes zero.*

**Why nested rather than flat, with the trade-off stated.** The controller unification is complete either
way, so nested-versus-flat contributes zero lines in either direction — there is no simplicity being traded
away. Nested wins on consistency: every other sub-resource in this app (attacks, powers, armors,
weaknesses, weapon tags, countdowns, images, memberships, minions) is addressed under its owner, so a flat
route would be the only sub-resource addressable independently of the thing that owns it. It also keeps
"list this owner's moves" a plain GET with no query string. **What it does not buy:** un-forgeability. A
client can construct `/api/monsters/{aBystanderId}/custom-moves` as easily as it can put a wrong
`ownerType` in a body. The owner-existence check is what rejects that, and it is required either way — the
argument for nesting is ergonomics, not safety.

**Why creation follows the sub-resource convention, in its strongest form.** The decisive argument is not
"this is how we already do it" — it is that **custom moves are the fifth of five sibling sub-resources, not
a special case.** Monster and Minion each carry attacks, powers, armors, weaknesses *and* custom moves.
Inlining only custom moves into the entity request would make the one structurally-identical member of that
set the odd one out: four written through `runBatch`, one written in the body. The consistent design is the
one where all five are written the same way. Three supports:

- **Zero new API surface.** The eight create endpoints, the five `Upsert{Domain}Request` records, and the
  five TypeScript request interfaces are all untouched. The whole create-time story is one more `runBatch`
  arm in machinery that already exists — about eight lines per create page and nothing on the backend.
- **The standing rule is never tested at its edge.** Verified: all eight create endpoints share their
  request record with their domain's `PUT`, so a collection field added for creation's benefit would reach
  the update path by construction — exactly the failure *"never put membership in an `Upsert*Request`
  body"* names. Staying out of the body means the question never arises.
- **One write path, one validation path, no exemptions.** Every insert — detail page, create page, wizard —
  is the same `POST /api/{owner}/{id}/custom-moves` through the same owner-checked service method. No
  entry point skips the owner check because "the owner was just created in this transaction."

**The accepted cost is not new.** A create whose entity succeeds and whose move writes fail leaves the
entity without them — but that is the existing `draftsFailed` condition, already covering attacks, powers,
armors, weaknesses and membership links on every create page. Custom moves join an established failure mode
rather than introducing one, and the standing copy decision already governs it: *"an entity-then-batch write
that partially fails is a success with a caveat, never an `error:`"*
(`rosalina-partial-failure-copy-entity-linking.md`), because routing it to `error:` leaves the user on a
populated create form whose only control makes a duplicate.

**Why the discriminator's cascade cost is cheaper here than it was for images.** The mitigation already
exists and is tested. `MonsterService.DeleteAsync` is already the codebase's first explicit transaction,
already reads minion ids *before* the monster delete (the Monster→Minion cascade runs no application
code), and all four domain delete flows already call `DeleteAllForOwnerAsync` for images. One more call per
method. And the protected row is two strings, not megabytes of `bytea` — the failure mode is a slow text
leak, not unbounded storage.

**The one thing that will actually go wrong if it is not written down.**
`MonsterMinionCascadeTests.DeletingAMonster_CascadesItsMinionsAndTheirSubResources` seeds a `MinionAttack`,
which keeps its real FK and keeps cascading — so the test stays green while minion custom moves silently
orphan. It must be extended to seed a minion custom move. Same blind-spot shape as
`toad-exact-call-ledger-over-positive-assertions.md`, one step over: an assertion over the sibling
sub-resource that still works cannot see the one that stopped.

## Consequences

- **Mystery parity stops being a phase.** Once one controller serves five owner segments, Mystery has the
  same four endpoints as everything else. Skyler's "Mystery last" ordering therefore applies only to the
  frontend — which is where its complexity (the wizard) actually lives.
- **`CustomMovesController`'s four actions are the entire write surface** — no exception for creation, no
  second entry point, no owner-check exemption. The service is six methods.
- **The cost of the convention lands on the mystery wizard, and Phase 5e carries it.** Because moves are
  written after the entity exists, a *brand-new* wizard-composed entity's moves need the same id-then-write
  sequencing and baseline bookkeeping as a re-edited one — so both paths inherit the full apparatus:
  phase-transition submission, `signal<T[]>` not FormArrays, id-presence upsert
  (`mystery-entity-linking.md` §5.2, specifically about sub-resources), per-row derived dirtiness, baseline
  twins, `pendingRemovals`. Logged as a named reservation, not an objection. Phased last, gated on
  Rosalina's design plus a re-evaluation Skyler has already called for.
- **The partial-failure surface widens by one sub-resource type.** The hedged copy *"some details may not
  have saved"* now covers custom moves on all five create flows, and the caveat branch sends the user to
  the detail page — which is the surface Rosalina is designing. The failed-create recovery path and the
  custom-move surface are the same screen and should be designed together.
- **The unified controller makes `mystery-detail` editable for free, which resolved a product question
  without any backend work.** Skyler's preference was to add endpoints matching the other domains' CRUD
  rather than reach into wizard-only code — but Phase 2's single controller already serves
  `/api/mysteries/{id}/custom-moves` as the *same four actions*, and `MysteryDetailResponse.customMoves`
  already exists, so the lift is UI-only and adding endpoints would have created a second way to write a
  custom move. **Test a stated preference's premise before satisfying it.** (The adjacent trap:
  `sub-resource-diff.ts` genuinely *is* wizard-local, which makes the "wizard-only functionality" worry
  sound right — but it is a client helper for choosing which generic call to make, not an endpoint.)
- **Two-step is the shape the wizard can already express, not a cost it pays — and the mechanism matters.**
  Inlining would not have caused whole-collection `PUT` churn (the array was excluded from `PUT` by
  construction). It would have introduced **a second baseline-construction site for one collection**:
  `applySubResourceDiff` returns the new baseline in draft order, one site with eight users, and the create
  branch would have built it from the create response instead. That is
  `toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md` in the one subsystem that has
  violated it twice in production. The wizard's real cost is its two phases that never carried a
  sub-resource, which exist under either write shape.
- **A new drift surface: the draft arm is added to five create pages independently.** A missing arm, a
  duplicated one, or one that skips `runBatch`'s empty short-circuit are all invisible to a positive
  assertion. Phase 6's parity spec therefore covers create pages as well as detail pages, plus a per-page
  exact call ledger (N staged moves → exactly N POSTs; zero when empty), which is
  `toad-exact-call-ledger-over-positive-assertions.md` applied to precisely that hazard.
- `IMysteryRepository` is the only one of five without `BeginTransactionAsync`, and
  `MysteryService.DeleteAsync` the only delete flow without a transaction. Both are prerequisites.
- Each of the five detail-page loads gains one query. The discriminator's real price, named up front.
- Swagger shows one templated route instead of five concrete ones, and the legal owner set lives in a route
  constraint rather than in five `[HttpGet]` attributes. A small, real loss of at-a-glance discoverability —
  the one thing the five-controller shape did better. A test asserting every enum member has a reachable
  route is the cheap guard.
- A single table makes "add custom moves to search" a five-line change. Skyler has ruled it out of scope;
  the two `SearchProvidersTests` exclusion tests are the guard.
- Domain custom moves and hunter-playbook custom moves (`BespokeSection.PlaybookMoveId`) share a phrase and
  nothing else — catalogue data selected from, versus user data typed in. They should never converge.
- **A boundary worth recording even though nothing here depends on it**, because the next person touching
  entity creation will need it: *"never put a collection in an `Upsert*Request` body"* is mechanically
  grounded in create and update **sharing** those records. The sharper statement of the constraint is that
  **a whole-collection write is only safe when the collection is known to be empty** — never true on an
  update path, which is why the rule holds unconditionally for as long as those records are shared. Lives
  in the doc's §12 for whoever picks up the create-page follow-up.
- **Resource-images' own ~24 duplicated per-domain image actions sit on the same argument** and Skyler wants
  them cleaned up — as a **terminal research phase** gated on this work finishing, not alongside it
  (*"I don't want to get distracted in that solution until this custom move work is done"*). Recorded as
  Phase 7 plus a standing follow-up list in the doc's §12, following the `mystery-entity-linking.md` §12
  convention. Note the coupling: Skyler's aside that adding a Mystery image later would be easy means a
  fifth `ResourceOwnerType` member, at which point that enum and `CustomMoveOwnerType` become identical and
  the two-enum decision above is worth re-opening **on purpose** rather than by accident.
