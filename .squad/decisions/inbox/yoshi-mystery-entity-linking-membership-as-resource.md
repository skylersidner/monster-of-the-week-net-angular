# Mystery membership is its own resource; upsert-by-ID must reach the sub-resource layer

**Date:** 2026-09-19 (rev 2 — Skyler answered all seven open questions the same day)
**Author:** Yoshi (Architect)
**Status:** proposed — pending Skyler's review of `docs/updates/mystery-entity-linking.md` rev 2

## What

**Confirmed by Skyler:** shared M:N reuse is the model (editing reaches across mysteries, and that
is desired); build the full monster roster; create pages take a single `createStandalone` +
membership-`PUT` path; no cross-mystery warning copy anywhere; wizard hydration treats existing
links as authored; every entity is editable in the wizard; removal is a confirmed Detach / Delete
choice, with Detach shown only when the entity is linked to other mysteries.

**Architecture that follows:**

1. One idempotent verb per entity, no body, no new DTO, no migration:
   `PUT /api/mysteries/{mysteryId}/{monsters|locations|bystanders}/{id}` → 204 | 404.
   Explicitly **rejected**: `MysteryIds` on the three `Upsert*Request` records.
2. The three form components' `save` output becomes `{ core: Upsert*Request, mysteryIds: string[] }`.
   Hosting pages keep owning all API calls; the form components inject no service.
3. In `submitPhase2` / `submitPhase3`, fire the membership `PUT` **unconditionally for every draft
   with an `id`**. The `origin: 'authored' | 'attached'` flag proposed in rev 1 is **retracted**.
4. `AttackDraft` / `PowerDraft` / `WeaknessDraft` / `ArmorDraft` gain `id: string | null` and are
   diffed like `LocationDraft`, replacing the delete-all/recreate-all cycle in
   `saveThreatCollections` and `saveMinionDrafts`. (Scope increase — New Question 1.)
5. `MonsterDraft` gains a client-side `localKey`; `MinionDraft` gains `monsterKey` and the wizard's
   minion composer gains a monster picker over the roster.
6. Removal decisions are recorded in a `pendingRemovals` signal and applied at the phase transition,
   preserving the standing phase-transition submission model.

## Why

**The membership row already exists; only the verb is missing.** Phase 7
(`docs/phases/phase-7-many-to-many-mystery-relationships.md`, migration
`20260725194049_RemoveMysteryFKAddBridgeTables`) replaced the required `mystery_id` FK with three
bridge tables specifically so entities could be reused across mysteries.
`Link{Monster,Location,Bystander}ToMysteryAsync` already exist in the repositories and are called
only from the scoped `CreateAsync` overloads. `MysteryIds[]` is on six shipped DTOs and has never
been settable.

**`PUT` on the membership URI, because that URI already ships as the unlink `DELETE`.** Membership
is a resource; `PUT` asserts it exists, `DELETE` asserts it doesn't, both idempotent. Idempotency is
load-bearing here: item 3 fires these from `forkJoin` batches for every draft, without knowing or
caring whether the link already exists. `POST` to the collection is unavailable — it already means
*create a new entity here*, and a body-type overload is an ambiguous ASP.NET action match.

**Membership must not live in the entity's upsert body, on concrete evidence.**
`MysteryCreateStore.submitPhase2`/`submitPhase3` already call `update()` with payloads that would
carry no `mysteryIds`; whole-collection PUT semantics would unlink the entity from every mystery on
the next wizard save. House precedent agrees: a weapon tag attaches via `POST .../weapon-tags`, not
via a field on `UpsertMonsterAttackRequest`.

**Skyler's "has an ID → edit, no ID → create" rule is correct, and the code already obeys it at the
entity row.** That is why rev 1's `origin` flag is retracted: once cross-mystery propagation is
desired rather than feared, there is no reason to distinguish an attached draft from an authored
one, and the diff gets simpler. The rule is insufficient only at the two layers around the entity
row:

- **Above it:** the bridge row. `POST /api/mysteries/{id}/locations` links as a side effect of
  create; `PUT /api/locations/{id}` has no mystery in the URL and cannot link. So the update branch
  silently fails to attach. Hence item 3.
- **Below it:** `AttackDraft` and friends have no `id` at all (`mystery-create.store.ts:37-60`).
  `submitPhase1` deletes every ID in `existingMonster*Ids` and recreates all four collections from
  the drafts. If an attach hydrates the ID baselines but not the draft arrays — which is exactly
  what `loadEditData` does for the baselines — pressing Next **strips every attack, power, armor and
  weakness off the real monster row, in every mystery that uses it**, silently. If it hydrates both,
  every sub-resource re-keys on every Next. Hence item 4, which makes the first outcome structurally
  impossible. The backend PUTs already exist (`MonstersController.cs:70/104/120/136`); `MinionService`
  already has the matching Angular methods; `MonsterService` is missing all five.

**Minions need explicit pinning once there is a roster.** `Minion.MonsterId` is required and
non-nullable, and a monster authored in this session has no server ID until the phase transition —
so the minion must reference a client-side `localKey` resolved to a real `monsterId` after the
monsters save. It also means removal cascades: Detach leaves the monster and its minions untouched
(they merely stop appearing here, since they were only ever here through their monster), Delete
FK-cascades them everywhere. No re-parenting is offered, because silently moving a minion to a
different monster is a surprising mutation of a shared entity.

**Deferred removal keeps the standing submission decision intact.** Recording detach/delete choices
in `pendingRemovals` and applying them at the phase transition means abandoning the wizard destroys
nothing, at the cost of a "Delete" button that acts a click or two later.

## Not decided here

Seven new questions in §10 of the doc, chiefly: whether to approve the sub-resource upsert scope
increase (item 4), whether Detach should also appear when this is the entity's only mystery, and
whether removal should apply immediately rather than at the phase transition. All interaction and
visual design is Rosalina's, in `docs/updates/mystery-entity-linking-ux.md`.

---

## Rev 3 addendum (2026-09-19) — reconciliation with Rosalina's UX proposal

Three amendments after `docs/updates/mystery-entity-linking-ux.md` landed. None of them changes the
verb in §What; all three change draft state or sequencing.

**1. Dirty-tracking: derive it, don't store it.** Rosalina argued `origin` should be narrowed to
`origin` + `edited` ("an attached entity is never written unless explicitly edited this session")
rather than retracted. The concern is real but the stated reason is not the surviving one — Skyler
wants cross-mystery mutation, and writing identical values is not mutation. The surviving reason is
**write amplification**, and it only bites for monsters: under today's delete-all/recreate-all,
attaching a monster and pressing Next re-keys its entire sub-resource subtree.

So the two open questions are one question: **approving sub-resource upsert makes dirty-tracking
optional; declining it makes dirty-tracking load-bearing.** And when we do want it, the shape is a
**per-row comparison against a baseline snapshot taken at attach/hydrate time**, not a stored flag.
A stored `edited` desyncs (edit then revert stays dirty) and forces a rule someone must remember —
that a *cancelled* composer edit must not mark the draft edited — whereas a cancelled edit leaves
the draft equal to its baseline by construction. Per-row also beats per-entity, which would rewrite
all eight sub-resources because the user renamed the monster. `origin` stays retracted.

**2. Membership chips are not links.** Conceded to her §9.3; the recommendation had already been
dropped in rev 2 when the control moved inside the form's `FormGroup`. The decisive reason is
structural — a chip inside an editable multi-select is already a control, and making it also a
navigation target makes clicking it ambiguous. One correction to her reasoning: the app *does* now
have an unsaved-changes guard (`hunter-draft.guard.ts`, `hunters.routes.ts:15`, plus a
`beforeunload` listener at `hunter-create.ts:134`); what it lacks is one on the entity detail pages.
That upgrades the "Appears in: …" follow-up from needing a guard invented to having one to copy.

**3. Foundations move ahead of replication.** Her audit found the roster-plus-composer shape already
ships in full for minions (`mystery-create-monster-phase.html:148-372`). That makes the monster
*template* work a lift, but leaves the store work (the `submitPhase1` rewrite, `localKey` resolution,
sub-resource upsert, the `monsters[0]` fix) unchanged — cheaper UI, same state risk. The useful
consequence is ordering: the stable client key / `track $index` fix and the three shipped
accessibility defects in that roster both get four times more expensive once the pattern is copied
to three more phases, so they now form a foundations phase *before* the replication. It ships as a
standalone improvement to the minion roster that exists today and is blocked by no open question.

---

## Rev 4 addendum (2026-09-19) — all follow-ups answered; design closed

Skyler answered the seven follow-up questions the same day. Decisions 8–14 in
`docs/updates/mystery-entity-linking.md` §3.1. **Status: no architectural question remains open.**

**Approved:** sub-resource upsert by ID presence (8); dirty-tracking on top of it (9); Detach offered
whenever the entity exists in the catalog, with the modal stating how many other mysteries are
involved (10); the wizard fetches the mystery list to name them, no DTO change (11); removals apply
at the next phase transition (12); minion cascade and minions-follow-their-monster-on-attach (13);
and the Detach/Delete modal sweeps the non-wizard pages in the same change set (14).

**Two amendments this forces.**

**Dirty-tracking changed role, not mechanism.** Rev 3 framed it as the fallback that becomes
load-bearing if upsert were declined. Upsert was approved *and* dirty-tracking was asked for, so it
is now an affirmative requirement layered on top of a safe diff. That matters for how carefully it
has to be built: **with upsert in place, dirty-tracking is not what keeps the data safe — upsert is.**
A bug in the dirty check costs redundant no-op writes; a bug in the upsert diff costs data. The
mechanism is unchanged: the derived per-row baseline comparison, not a stored flag, not `origin`.

**The sweep is a disclosure upgrade, not a Detach upgrade — a boundary on decision 14 that neither
document anticipated.** Detach is `DELETE /api/mysteries/{mysteryId}/{collection}/{id}` and needs a
`mysteryId`. All four in-scope sweep targets (`locations-list`, `bystanders-list`, `monsters-list`,
`minions-list`) are **unscoped flat catalog routes** with no current mystery; the entity may belong
to three and the page knows none of them. The mystery-scoped detail routes
(`/mysteries/:mysteryId/locations/:locationId` and siblings) render the same components as the
unscoped ones and carry no delete affordance at all. So there is no non-wizard surface today where
Detach has a referent.

Resolution, by construction rather than preference: **outside the wizard the modal is Delete-only,
and the sweep delivers the `[items]` list and mystery names.** That is the half with the safety value
— after this feature the flat-list delete is the highest-consequence destructive action in the app
and today it says nothing about what it takes with it. `monsters-list.html:51` already assembles a
minion cascade list for the modal, so the pattern exists and only needs a second source merged in.
If Detach is wanted outside the wizard, its only coherent home is the mystery detail page's rosters,
paired with the attach affordance already queued for Phase 6 — that page knows which mystery it is.

**Phasing:** the sweep moves from Phase 6 into Phase 3, where the modal is already being hardened.
Phase 3 now runs parallel to Phase 4 rather than only ahead of it. No phase is gated on an open
question; Phases 1, 2 and 3 are mutually independent.

---

## Rev 5 addendum (2026-09-19) — Rosalina's questions answered; design closed end to end

Skyler answered Rosalina's remaining six the same day. Two reach this design.

**Her OQ8 — `CustomSelectComponent` `Escape`-closes-and-restores-focus is in scope**, and is written into
Phase 3 with Luigi owning and Toad verifying **on every surface that uses the control, not just the
new ones**. Recorded emphatically because it is pre-existing breakage and therefore exactly the kind
of item that gets dropped as "out of scope" mid-implementation. It is not: Skyler ruled on it
directly, and this feature makes that control the sole entry point to the attach picker and the
mystery multi-select. The control's remaining ARIA defects (`role="listbox"` over non-option
children, no `aria-activedescendant`, no arrow-key navigation) are **not** in scope.

**Her OQ10 — the mystery-detail remove affordance is punted**, with an explicit instruction to record
it for after the final phase. That is the item that would properly close §7.5: `/mysteries/:id` is
the only non-wizard surface with a mystery in context, so it is the only place Detach can ever mean
anything outside the wizard.

**Her OQ2 (collapse the composer after save) was the one interaction answer that could have reached
the store, and it does not.** Submit timing, the diff and `commitComposerIfValid` are all unaffected —
committing a draft into the roster has always been local, and submission still happens at the phase
transition. Two mechanical consequences only: Locations and Bystanders gain composer-open state they
lack today, and `MysteryCreateDraftState.composer` (`mystery-create.store.ts:171`) generalises from
one composer to four. Fold that rename in with `editingDraftIndex` -> `editingDraftKey` in Phase 3
rather than doing two passes over the same block.

**Structural change: rev 4's "Phase 6 — Follow-ups" is dissolved into a new §12.** It was a
deferred-work bucket wearing a phase's clothes, and Skyler's instruction gave the deferred work a
proper home. Phase 5 is now explicitly the final implementation phase; the retrospective becomes
Phase 6. Every item moved; nothing was dropped.

**Ownership rule agreed with Rosalina for the two follow-up lists:** architecture, API and data-shape
items live in `mystery-entity-linking.md` §12; interaction and visual items live in her matching
section. Each lists the other's items by title with a pointer and does not restate the reasoning.
One item is deliberately split across both — the unpaged `getAll()` threshold is the same trigger for
my paging item and her browse-panel item, so both record it and whoever hits it first pings the other.

**Status: every question raised in either document is decided.** Phases 1, 2 and 3 are mutually
independent and can start immediately.

---

## Rev 6 addendum (2026-09-19) — Boo's Phase 1 review: one correction, one gate, one follow-up

Verdict **ship as-is**. Full review at `boo-mystery-entity-linking-phase1-security-review.md`.

**Correction to §4.1: the link `PUT` and the unlink `DELETE` are NOT "both idempotent."** They are
idempotent in *effect*; they differ in *status code*. A repeated `PUT` is 204; a repeated `DELETE` is
**404**, because `UnlinkFromMysteryAsync` returns `deleted > 0` (`LocationService.cs:166-170` and its
twins) and the controller maps that to `NoContent() : NotFound()`. The claim was the defect, not the
code: `NoContent() : NotFound()` is the house pattern across **25** delete endpoints, so making unlink
alone return 204-always would leave it inconsistent with its own neighbours, and changing all 25 is
not this feature's business. The asymmetry stays.

**Client handling of the resulting replay, decided — two rules, both required:**

1. **Clear `pendingRemovals` on a successful phase submit.** This is the actual fix; it removes the
   replay in every case except a genuinely partial `forkJoin` failure.
2. **Treat 404 as success when applying a recorded disposition** — scoped to that path only, not to
   deletes app-wide. Semantically right rather than papered over: the user asked for "not in this
   mystery" or "does not exist," and 404 means the post-condition already holds. Keeping it narrow
   preserves 404-as-error for user-initiated deletes elsewhere, where it can mean a wrong id.

**Rejected: re-check before each removal.** Costs a GET per removal and only narrows the race rather
than closing it — a pre-check that still needs the 404 handler behind it is worse than the handler alone.

**The duplicate-key race moves from a Phase 1 note to a Phase 2 gate, bowser owning.** Acceptable in
Phase 1 because Phase 1 has no client and cannot reach it. Boo's fix, and the reason the two obvious
alternatives are worse than the current 500:

- **Not** blanket `catch (DbUpdateException) { return true; }` — it also swallows a *second, separate*
  TOCTOU in the same method, where the existence checks pass, the mystery or entity is deleted
  concurrently, and the insert fails on the **foreign key** rather than the PK. That returns 204 for a
  membership that does not exist, and §5.1 has the wizard trusting exactly that answer. A 500 is an
  honest failure; a false 204 is a silent lie the client then builds on.
- **Not** a `PostgresException { SqlState: "23505" }` filter — correct in production, untestable here,
  because the repository fixture is in-memory SQLite and throws `SqliteException`.
- **Do:** behind one insert-and-save repository method, catch `DbUpdateException` and **re-check
  `…LinkedToMysteryAsync`**. Present → the concurrent insert won, 204 is truthful. Absent → **rethrow**,
  it was not a duplicate. Detach the `Added` entry first so the abandoned insert cannot be retried by a
  later `SaveChanges` in the same request. Discriminates on whether the row actually exists rather than
  on a vendor error code, so it is provider-agnostic *and* exercisable under the existing fixture.

This promotes `LocationLinkedToMysteryAsync` / `BystanderLinkedToMysteryAsync` from an idempotency
convenience to load-bearing correctness.

**Follow-up F8 added:** `LinkToMysteryAsync` is the first write verb in this codebase that joins two
objects; every other write touches one. Not a defect today — per-user ownership is a deliberate,
documented exclusion (`docs/simple-authentication-update/architecture.md:601`). But if ownership ever
lands, this verb needs a **two-sided** check (the mystery *and* the entity), and the one-object guard
idiom every other service uses will silently under-check it.
