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

---

## Rev 7 addendum (2026-09-20) — Peach's Phase 4 acceptance review: decisions 15 and 16

Phases 1–3 shipped (`72ebc5c`, `2814168`, `c9d554a`, `a063449`). Peach's criteria are at
`docs/updates/mystery-entity-linking-acceptance.md`, now the third companion doc: **what it must do**
(hers) / **how it does it** (mine) / **how it looks** (Rosalina's).

**Decision 15 — `pendingRemovals` is wizard-scoped, and every phase submit drains all of it.**

Her G1: in edit mode, trash a location, confirm **Delete**, click a tracker bubble, Finish — phase 2
never submits and the location survives. `jumpToPhase` (`mystery-create.store.ts:900`) sets the phase
directly without submitting, and `isPhaseAccessible` (`:909`) returns `true` unconditionally in edit
mode. So decision 12's "removals apply at the next phase transition" held only because every exit was
assumed to be a transition, and the tracker isn't one. `Back -> Next` is safe; the tracker is the only hole.

The mechanism is pre-existing — today's inferred unlink is lost identically, as are unsubmitted field
edits — but Phase 4 puts a confirmation dialog and the word **Delete** in front of the same gesture.
Asking someone to confirm a destructive action, promising it will happen, and then not doing it is a
different category of defect, and it is the one that teaches users to stop reading confirmations.

Fix: make the disposition record wizard-scoped rather than phase-scoped, as a flat
`{ collection, id, action }` list, and have *every* `submitPhaseN` drain the whole thing. Applying a
removal never actually depended on which phase was submitting. Rejected: **submit-on-jump** (needs
`advancePhase` at `:1633` to land on an arbitrary target rather than `phase + 1`, makes a tracker click
fire a full monster-and-minion save, and lets `validateCurrentStep()` turn the tracker into a trap);
**blocking the jump** (hostile, and fixes nothing else); **apply-on-final-submit-only** (contradicts the
shipped "takes effect when you continue to the next step" copy and loses more on abandon).

Draining on every submit gets submit-on-jump's result with none of the navigation surgery, and makes
the shipped copy more true rather than less. **Decision 12 is preserved exactly** — abandoning still
applies nothing; what changed is that a tracker jump is no longer an abandon, which is precisely the
distinction the code could not draw.

Bookkeeping: a drained removal must also drop its id from the owning collection's baseline signal, or
the owning phase's `idsToRemove()` will later fire a duplicate removal (harmless — rule 2 swallows the
404 — but sloppy). This completes what §7.3 already asserted: `pendingRemovals` is authoritative and
`idsToRemove()` is the consistency check.

Not fixed, deliberately: a tracker jump still discards unsubmitted *field* edits (F9).

**Decision 16 — the removal variant keys on the phase's baseline, not on `id`.**

Her G3, and her question to me was the right one. `id !== null` answers *"does this entity exist?"*
when the modal needs *"does this mystery's membership of it exist?"* Those came apart the moment
attach existed: an attached entity has an `id` immediately, but no membership row until the phase
submits. So attaching by mistake and trashing it a second later offered **Detach** (a no-op against a
membership never created) and **Delete** (permanent destruction of a catalogue entity) — the most
dangerous button in the feature, for the most trivial mistake in it.

The right predicate needs no new state: **is this id in this phase's baseline** (`existingLocationIds`
and siblings, `:330-331`), which is set on edit-load and after each successful submit and therefore
means exactly "memberships persisted for this mystery." An attached-but-unsubmitted draft becomes a
**local discard** — no modal choice, no disposition, no API call.

This makes attach-then-remove and remove-then-re-attach symmetric (neither leaves a disposition), and
shrinks rule 2's exposure without retiring it. A user who genuinely wants to destroy a just-attached
catalogue entity can still do it from the list pages, which is where decision 14 put that capability.

**G4 recorded as expected behaviour (§7.6), not decided.** Stale picker options can re-offer a
session-deleted entity; the membership `PUT` 404s and fails the phase loudly. **Rule 2 must not be
extended to the link path**: a 404 on detach means the requested post-condition already holds, while a
404 on link means the opposite, and reporting success for a membership that was never created is the
same false-204 failure the Phase 2 gate rejects.

---

## Rev 8 addendum (2026-09-20) — pre-Phase-5 re-review against the committed code

The re-review §9 scheduled, read against `b47c3dc` rather than against the plan. Phases 1–4 green
(1053 frontend / 548 backend). Three corrections, one structural change, one question.

**Phase 5's scope was wrong in three places.**

1. **`MonsterService` needs seven methods, not five.** Rev 3 counted the five sub-resource updaters.
   Phase 1 shipped the link verb on the backend for **all three** collections
   (`MonstersController.cs:53` and its two twins); Phase 2 shipped the client half for **two**.
   `MonsterService` has neither `linkToMystery` nor `unlinkFromMystery` — so the monster roster
   cannot attach or detach anything. Correct at the time (Phase 2 deliberately excluded monsters),
   invisible since. No backend work.
2. **The sub-resource drafts need `localKey`, not just `id`.** Rev 3 asked for `id` alone, which
   serves upsert and nothing else. An unsaved row has `id: null`, so `id` cannot address it, and the
   four sub-resource lists are still `track $index` with index-based removal — exactly where the
   roster was before Phase 3. The shipped `MinionDraft.localKey` comment already argues this case one
   level up: *"The array index was standing in for identity, and that is a bug source rather than a
   shortcut."* `createDraftKey(prefix)` exists and takes a prefix.
3. **The dirty check has a cheaper shape than rev 5 specified.** Rev 5 said "snapshot the values
   onto the draft," which reads as a field *added* beside the four `existing*Ids` arrays. Better:
   **replace `existing*Ids: string[]` with `existing*: <Response>[]`.** The IDs are `.map(x => x.id)`
   off the responses, so delete-detection is unchanged and the value baseline comes free — zero new
   fields, four retyped ones. It also keeps one baseline per collection instead of an ID baseline and
   a value baseline that can disagree, which is the Bug 2 shape this file has been bitten by twice,
   and it makes the weapon-tag diff tractable since `weaponTags` lives only on the response.

**Structural change: Phase 5 splits into 5a then 5b.**

5a = sub-resource upsert + dirty check, **no roster**, on today's single-monster structure.
5b = the monster roster, built on top.

The ordering is forced by §5.2's own worked example: under delete-all/recreate-all, attaching an
existing monster re-keys its whole subtree and the natural-looking implementation strips it bare in
every mystery. **The roster cannot safely ship attach-an-existing-monster on the current
sub-resource layer.** Put the safety fix first, on the simpler structure, then build the roster on
ground that is already safe — the same foundations-before-replication sequencing that made Phase 3
work, one level down. 5a also ships value on its own: sub-resources stop re-keying on every Next
whether or not anyone attaches a monster.

**A silent trap Phase 5 walks straight at.** `idsToRemove(savedIds, drafts, collection?)`
(`:1995`) has an **optional** collection parameter; omitted, the drain-versus-diff exclusion filters
on `undefined` and matches nothing, so it silently does not apply. Locations and bystanders pass it;
**the minion call site at `:1935` does not**, harmless only because `'minions'` is not yet a
`RemovalCollection`. This is precisely the double-path hazard Toad's exact-call-ledger rule was
written for, and her analysis holds: a duplicate *delete* survives (the drain maps 404 to success), a
duplicate *unlink* does not (the diff path has no `catchError` and fails the phase).
**Make the parameter required as the first act of 5b** — a compile-time fix for a bug class that is
otherwise invisible until a much wider fan-out produces an unplaceable 404.

**`membershipPersisted` generalises to monsters but is misnamed for minions.** Its implementation is
"is this id in the collection's baseline," which is right for all four; its *meaning* differs, because
`existingMinionIds` holds rows, not memberships (`Minion.MonsterId` is a required FK). Read literally
it would classify every minion removal as a local discard and silently stop deleting minions. If
minions join the type, rename it.

**Question for Skyler (§10):** minions have the identical G1 hole — trash a minion, confirm Delete,
jump via the tracker, Finish, and it survives. Monsters must join `RemovalCollection` regardless.
Should minions? Recommended yes, on the adjacent-steps argument rather than severity: otherwise
trashing a monster survives a tracker jump and trashing a minion does not, on adjacent steps of the
same phase with the same modal.

**Also:** Peach's acceptance doc is explicitly Phase-4-scoped and does not cover the roster; 5b needs
its own acceptance pass. Skyler's screen-reader waiver (`cb1eae3`) is recorded in the 5b block so it
is not re-raised. G1–G4 are built or accepted and nothing in the new plan reopens them.

---

## Rev 9 addendum (2026-09-20) — three-stage review closed; decisions 17, 18, 19

Skyler answered the three questions the pre-Phase-5 review raised. Bowser and Luigi reviewed rev 8
after me and found four real defects in it; all are fixed.

**Decision 17 — minions join the disposition drain.** `'minions'` becomes a `RemovalCollection`
member, delete-only (no membership to detach). Closes the G1 hole I failed to sweep when decision 15
closed it for two collections. **My "roughly a day" estimate was wrong and the extra is UI:** the
minion modal passes `verb="Remove"` with sub-resource counts and does not use the disposition shape
at all, so it needs `confirmLabel="Delete"` when persisted and never a `secondaryLabel`. The work
lands in **5a**, not 5b, because the `idsToRemove` fix it depends on now also lands there.

**Decision 18 — minion re-parenting is built now, as a dedicated verb.**
`PUT /api/monsters/{monsterId}/minions/{minionId}` -> 204 | 404. **Not** `MonsterId` on
`UpsertMinionRequest`: that DTO is sent by three callers, a non-nullable field would re-parent every
one to `Guid.Empty` and trip the FK, and `Guid?` with "null means leave alone" is PATCH semantics
inside a PUT. Same argument that kept `MysteryIds` out of the three upsert records in S4.1.
**Bowser's caveat, recorded because the two verbs look identical and are not:** mystery membership is
M:N so `PUT` **adds**; minion->monster is a required 1:N so `PUT` **moves**. Both idempotent, both
204, different operations. A re-parent issued against a stale `monsterId` silently relocates rather
than failing.

**Decision 19 — a monster is no longer required to complete the wizard.** The widest-reaching
sentence in the feature. Write side: `validateCurrentStep` loses its phase-1/step-0 hard block (the
composer's three-way commit rule replaces it); `submitPhase1` becomes drain-and-advance on an empty
roster and must not synthesise a monster from an empty form; step 1 with zero monsters is now
reachable and trivially satisfied (`Minion.MonsterId` is a required FK, so no monsters means no
minions). Tracker: **"complete" now means "satisfied", not "has content"** — create mode is already
correct once the block goes, and edit mode should let `init()`'s `[true, true, true, true]` stand
instead of `loadEditData` recomputing from data presence, which was always questionable for
locations and bystanders and is simply wrong for monsters now. Read side is better than feared and
should be checked rather than rebuilt: `mystery-detail` already handles zero monsters and already
short-circuits the minion fan-out; the dossier's monster block is guarded by `monsterPreview().name`
so it degenerates correctly, but that guard protects the *single-monster* shape and 5b replaces the
block with roster rendering that needs its own empty state. `monsterPreview()` itself has no single
subject under a roster.

**Four corrections to rev 8, all Luigi's.**

1. **S6.1 contradicted S5.4 about `MonsterDraft`'s baselines.** S6.1 dropped the four baselines
   because draft ids would carry delete-detection; S5.4 had since changed the baseline to
   **responses**, because the dirty check needs values and the weapon-tag diff needs `weaponTags`,
   which lives only on `MonsterAttackResponse`. S5.4 is right. `MonsterDraft` carries
   `existingAttacks: MonsterAttackResponse[]` and its three siblings; `MinionDraft`'s four are
   retyped the same way. Same field count, different type.
2. **S5.2's hazard (ii) is broader than I framed it.** I wrote it as an attach hazard; it is a hazard
   of *any* path that populates the baseline and not the draft ids — and `loadEditData` is already
   one, setting `existingMonsterAttackIds` while building drafts with no `id` (there is no field for
   one). Harmless under delete-all/recreate-all; the moment 5a makes it a diff it deletes every
   attack and creates none, **on plain edit-mode revisit with no attach involved.** The invariant is
   not "attach must hydrate both" but "the baseline and the drafts' ids are two halves of one fact,"
   and S5.4's response-array shape enforces it structurally. Minions are already safe and show what
   right looks like.
3. **`draftState` is dead production code** — one consumer, a store-spec assertion. S5.5 proposed
   growing it "from one composer to four" on the strength of its name. Withdrawn: delete it, or wire
   it to F4 (mid-wizard persistence), which is the job it was shaped for. Growing it is the only
   definitely-wrong option.
4. **Sizing:** 5a is ~ Phase 4, not half of it; 5b is larger than Phase 4. Corrected in the plan so
   nobody reads 5a as the small half.

**New requirements folded into the phase blocks rather than left as advice:** the sub-resource diff
must be a parameterised function over a service adapter (5a writes it twice anyway, and inlining it
means 5b rewrites it in the risk-centre phase); `applyPendingRemovals` **drops** — not skips — any
disposition whose id is in the current drafts, which puts D9's semantics in one place instead of at
four-soon-five `cancelPendingRemoval` call sites (a skipped disposition lingers and fires later,
turning a race into a delayed-action bug); the four unprefixed composer signals get `minion` prefixes
before 5b adds a second composer; `mystery-create-dossier.html:232,248` still `track $index`.

**Recorded, not solved:** the wizard's client-side load is 29 calls in **three rounds** (14/6/9), so
the exposure is the browser's six-connection limit splitting round three, not 29 round trips. Budget
it; the expand-style endpoint that would fix it must not be attempted inside the risk-centre phase.

---

## Rev 10 addendum (2026-09-20) — Peach's Phase 5 acceptance review

Bowser's re-parent verb is committed (`ef28fd5`, backend 548 -> 562). Peach's Phase 5 criteria are at
`docs/updates/mystery-entity-linking-acceptance-phase-5.md`. Six findings; five corrections and one
design decision.

**H3, the one that reshapes 5b's central feature: attaching a monster is hydration, not selection.**

`MonsterListItemResponse` (`core/models.ts:191-205`) carries `attackCount`/`powerCount`/etc. and **no
minions**. So a picked option cannot become a diffable `MonsterDraft`: it needs `getById` +
`getByMonster` + a `getById` per minion — **1 + 1 + N**. This is a genuine divergence from the
locations/bystanders attach and it is forced by the data model, not chosen: `LocationListItemResponse`
already carries everything `LocationDraft` needs, so attaching a location is a pure client-side
transform with zero fetches. Rosalina should design monster attach knowing it diverges.

**Shape: factor `hydrateMonsterDraft(monsterId)` in 5a with two callers** — edit-mode load in 5a,
attach in 5b. This is the same fan-out `loadEditData` already performs, so it is not new machinery.
It also makes S5.2's invariant structural rather than disciplinary: the hydrator builds the baseline
(`existingAttacks: MonsterAttackResponse[]`) and the draft ids **from the same response objects in the
same step**, so no path can populate one without the other. H1, H2a and H2b are all fixed by having
exactly one place that constructs a hydrated draft.

**Hydrate, then commit.** I agree with Peach's position, and the architectural reason is stronger than
the UX one: **every draft in the roster must be fully hydrated and therefore diffable**, because
`submitPhase1` diffs whatever is in the roster. A card admitted with a known `id`, an empty baseline
and empty drafts is the exact "baseline and drafts disagree" shape 5a spends its budget eliminating
one level down — and under a *partial* failure it is the one path in the whole design that yields
genuine outcome (ii) rather than churn. So the pick is not the commit; the successful hydration is,
and a failed fetch commits nothing. No new endpoint — the fan-out is per-attach, not per-page-load,
and S8.7 already rules the expand endpoint out of the risk-centre phase.

**Five corrections.**

- **H1 — "minions are already safe" was half wrong.** True of the minion *row*
  (`saveMinionDrafts` backfills `draft.id`), false of its *sub-resources*: `loadEditData:1010-1013`
  fills the four `existing*Ids` while `:995-1009` builds drafts with no id, and
  `saveMinionDrafts:1947-1953` deletes-all/recreates-all. There is no correct path to copy; the
  sentence was inviting Luigi to copy the same defect.
- **H2a — not only `loadEditData`.** `submitPhase1:1790-1793` re-creates the state on every successful
  submit, so it is reachable in **create mode** via Next -> Back -> Next.
- **H2b — the consequence is churn, not destruction, and that defeats the obvious test.** Delete-set
  and create-set are both "all of them," so content survives and only keys rotate. **A wrong 5a passes
  a content-preservation test.** Assert key stability and dirty-check firing instead (Peach's
  `5a-U1`/`5a-U9`).
- **H4 — S7.7d and S7.7e do not compose.** Delete a minion, then remove its monster: the minion's
  draft leaves the roster with its parent, so (e)'s roster-membership test no longer finds its
  disposition, and under a monster **detach** it drains and destroys that minion in every other
  mystery — contradicting what the modal just promised. Fix: removing a monster drops pending
  `'minions'` dispositions for its children under **either** disposition (detach because they must
  survive, delete because the cascade already handles them). Generalised: **(e)'s test is "is this
  disposition still the roster's business," and a child whose parent has left is not.**
- **H5 — a one-line landmine.** `membershipPersisted:1173` is a two-branch ternary, so `'monsters'`
  and `'minions'` both silently resolve to the **bystander** baseline, with no compile error, on the
  path that decides whether a destructive button appears. Renaming does not fix dispatch. Use an
  **exhaustive `switch` over the closed union** so a fifth member fails at compile time; the ternary's
  failure mode is silence. Compounds with Rosalina's S16 ruling that minions need a separate predicate,
  so this is a restructuring rather than an extension. Her `id !== null` and `existingMinionIds()`
  agree in practice; I'd take the baseline form for consistency and because `id !== null` would
  diverge the moment a path sets an id without recording the baseline — the H2 class of bug, twice
  found. Flagged to her, not decided over her.
- **H6 — the drain must leave the monster save chain.** `submitPhase1:1768-1800` nests
  `applyPendingRemovals` in a `switchMap` where phases 2 and 3 drain as a `forkJoin` sibling. Harmless
  today; from 5a it is not, because decision 17 makes minion deletions drain-borne and a failed
  monster save would strand a confirmed deletion — G1 by another route. 5b removes that save entirely.
  Move it out unconditionally in 5a.

**Effect on the cut and sizing:** the 5a/5b cut holds and is slightly better for it. H3 moves the
hydrator into 5a (where it was needed for H1/H2 anyway) and leaves 5b with orchestration and states,
so 5a grows a little and 5b shrinks a little — in the right direction, since 5b is the risk centre.
