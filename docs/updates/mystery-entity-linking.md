# Connecting Monsters, Locations and Bystanders to a Mystery — Architecture

**Prepared by:** Yoshi (Architect)
**Status:** **Revision 9 — three-stage review closed; Phase 5 fully specified.** Phases 1–4 committed and green (`72ebc5c`, `2814168`, `c9d554a`, `a063449`, `b47c3dc`, `cb1eae3`; 1053 frontend / 548 backend). Rev 8 was my pre-Phase-5 re-review; Bowser and Luigi reviewed after me and found real defects in it, now fixed. Skyler answered the three questions the review raised — **decisions 17, 18 and 19 (§3.3)**. Nothing is open (§10).
**Date:** 2026-09-20 (rev 9)

> **The one with reach beyond its own sentence is decision 19: a monster is no longer required to complete the wizard.** §6.5 works through what that changes on the write side, the tracker, and the read side. Read it before 5b.
>
> **Corrections to rev 8, all found by Luigi:** §6.1 contradicted §5.4 about `MonsterDraft`'s baselines — §5.4 was right, §6.1 is fixed. §5.2's hazard (ii) was framed as an attach problem; it is a hydration problem too, and the shipped code is already on the wrong side of it (§5.2). `draftState` is dead production code and must not be grown to four composers (§5.5). Phase 5a is **≈ Phase 4 in size, not half of it**, and 5b is larger (§9).

> Filed under `docs/updates/` alongside `docs/updates/multi-minion-support.md` and `docs/updates/standalone-creation-phase1-monsters.md`, which this work builds directly on. Supersedes nothing, and inherits nothing from the withdrawn hunter-advancement design.
>
> **Companion documents — three now, one per question.** `docs/updates/mystery-entity-linking-acceptance.md` (Peach) is **what it must do**; this document is **how it does it**; `docs/updates/mystery-entity-linking-ux.md` (Rosalina) is **how it looks**. Ownership is strict: acceptance criteria and expected behaviours are Peach's, architecture / API / data flow / phasing are mine, interaction and visual design are Rosalina's. Each cross-references the others by section and none restates another's reasoning. Her §13 ("Components Luigi should build on") is the authoritative build-on list; this document does not duplicate it.

### 0.1 Reconciliation with the UX doc

Three points needed resolving between the two documents. All three are settled here; none of them needs Skyler.

- **Her §10.1, dirty-tracking.** She was working from rev 1 and argues that "attached entities are editable" breaks `origin: 'attached'`, whose safety property was *never PUT this entity's fields*, so it should be narrowed to *never written unless explicitly edited this session*. I had already retracted `origin` outright. **Resolved in §5.4: her concern is real but its stated reason is not the surviving one, and the fix is neither a two-value `origin` nor a stored `edited` flag.**
- **Her §9.3, chips-as-links.** She disagrees with a recommendation rev 1 made and rev 2 already dropped. **Conceded and closed in §4.4 — her OQ6 can come off Skyler's list**, though her stated reason needs correcting.
- **Her §1 finding that the roster pattern already ships.** Folded into §6.1 and the phase plan; it re-sizes the monster work and, more usefully, re-*orders* it (§9).

Two independent convergences: **her OQ1 = my New Question 2** (offer Detach even when the entity is in no other mystery) and **her OQ7 = my New Question 3** (fetch the mystery list so the modal can name other mysteries rather than counting them). We reached both separately and agreed; **Skyler has since approved both, so her OQ1 and OQ7 are closed** and need no separate answer.

**Three further updates for Rosalina, following Skyler's answers of 2026-09-19:**

- **Her §10.1's conditional branch is resolved in the favourable direction and can be deleted.** She wrote the dirty-tracking requirement with an "if Skyler declines the upsert" fallback. He approved *both* halves — sub-resource upsert **and** dirty-tracking (decisions 8 and 9). So dirty-tracking is no longer a correctness guard standing in for a declined upsert; it is an affirmative requirement layered on top of one, and its job is write amplification, not data safety. The mechanism is the derived baseline diff in §5.4, not the `origin` + `edited` pair she proposed.
- **She was right on the modal sweep and I was wrong.** My New Question 7 argued for proving the three-button modal in the wizard first and sweeping the list pages afterwards; her §7.5 argued for the same change set, to avoid two modals that disagree. Skyler went with hers (decision 14). The sweep moves from Phase 6 into Phase 3 — see §7.5 for a consequence neither of us anticipated.
- **Copy nuance, hers to land:** his answer to NQ2 asks the modal to indicate *how many* other mysteries; his answer to NQ3 buys the ability to *name* them, which is what she recommended. These do not conflict — a named list conveys its own count — but the wording is a copy decision and belongs in her §7.1, not here.

---

## 0. The ask

Two surfaces, one capability:

1. From the **edit form** of a Monster, Location or Bystander, connect that object to a Mystery.
2. From the **Mystery wizard**, attach an **existing** Monster / Location / Bystander to the mystery being built.

Skyler's answers broadened this in three ways, all folded in below: the wizard must be able to **re-edit** any associated entity, not just append and remove (§5.3); removal must offer a **Detach / Delete** choice through a confirmation modal (§7); and with a monster roster in play, minions need an explicit **monster picker** (§6.4).

---

## 1. Current state (verified by reading current source, not docs)

The single most important finding is that **the many-to-many relationship this feature needs already exists and already ships.** `docs/phases/phase-7-many-to-many-mystery-relationships.md` converted Monster / Location / Bystander off a required `mystery_id` FK onto three bridge tables, explicitly so that "an entity (e.g., a recurring monster or a well-known location) [can] appear in more than one mystery." That migration (`20260725194049_RemoveMysteryFKAddBridgeTables`) is in `main`. So this is not a data-modelling project. It is a **missing-verb** project: the model can express the link, the API cannot create one except as a side effect of creation, and no UI exposes the plurality at all.

### 1.1 Database

| Concern | Where | Today |
|---|---|---|
| Mystery ↔ Monster | `DomainEntities.cs:251` `MysteryMonster` | M:N bridge, composite PK `(MysteryId, MonsterId)` |
| Mystery ↔ Location | `DomainEntities.cs:260` `MysteryLocation` | M:N bridge |
| Mystery ↔ Bystander | `DomainEntities.cs:269` `MysteryBystander` | M:N bridge |
| Monster → Minion | `DomainEntities.cs:293` `Minion.MonsterId` | 1:N, **required, non-nullable** FK, owned. Correct as-is |
| Cascade | Phase 7 doc | Deleting a Mystery drops its bridge rows, entities survive. Deleting an entity drops its bridge rows, mysteries survive. Deleting a Monster FK-cascades its Minions |

**No migration is required for any part of this feature.** That is worth saying loudly, because it collapses the risk profile of this work by a large factor.

### 1.2 API

| Verb | Route | Exists? |
|---|---|---|
| Create entity **and** link in one call | `POST /api/mysteries/{mysteryId}/monsters` (`MonstersController.cs:31`), `.../locations` (`LocationsController.cs:31`), `.../bystanders` (`BystandersController.cs:26`) | Yes |
| Create entity unattached | `POST /api/monsters` (`:18`), `POST /api/locations` (`:51`), `POST /api/bystanders` (`:46`) | Yes |
| **Link an existing entity to a mystery** | — | **No. This is the gap.** |
| Unlink | `DELETE /api/mysteries/{mysteryId}/{collection}/{id}` (`MonstersController.cs:53`, `LocationsController.cs:101`, `BystandersController.cs:96`) | Yes |
| Hard delete entity | `DELETE /api/monsters/{id}` etc. | Yes |
| Update a monster sub-resource | `PUT /api/monsters/{id}/attacks/{attackId}` (`MonstersController.cs:70`), `.../powers/{id}` (`:104`), `.../armors/{id}` (`:120`), `.../weaknesses/{id}` (`:136`) | **Yes on the server — but see §1.5, the Angular client never calls them** |

The repository layer is already ahead of the API: `LinkMonsterToMysteryAsync` (`MonsterRepository.cs:90`), `LinkLocationToMysteryAsync` (`LocationRepository.cs:30`), `LinkBystanderToMysteryAsync` (`BystanderRepository.cs:30`) all exist and are called today only from the scoped `CreateAsync` overloads. `MonsterRepository.cs:107` even has `MonsterLinkedToMysteryAsync` for the idempotency check. **The missing backend code is one service method and one controller action per entity.** Locations and Bystanders lack the `…LinkedToMysteryAsync` check; that is the only genuinely new repository code.

Contracts already carry the plural: `MonsterListItemResponse.MysteryIds` (`ApiContracts.cs:77`), `MonsterDetailResponse.MysteryIds` (`:103`), and the same on Location (`:198`, `:208`) and Bystander (`:220`, `:230`). **These fields are readable and have never been settable.** They are also, usefully, exactly the data the removal modal needs — see §7.2. `MysteryDetailResponse` (`:43`) carries only counts, not ID lists; the mystery detail page fetches its rosters from the three `GET /api/mysteries/{id}/…` endpoints instead (`mystery-detail.ts:60-64`).

### 1.3 Edit forms

There is no `/edit` route for these entities. **The detail page *is* the edit form** (`locations.routes.ts` `:locationId` → `LocationDetailComponent`, rendering `<app-location-form>` inline). Same shape for Monster and Bystander.

The three form components (`location-form.ts`, `bystander-form.ts`, `monster-form.ts`) are strictly presentational and identical in contract: they own a `FormGroup`, take the entity as an `@Input`, emit exactly one `save` event carrying an `Upsert…Request` (`location-form.ts:33`, `bystander-form.ts:34`, `monster-form.ts:34`), and — per the comment at the top of `location-form.ts` — "never call `LocationService` itself; the hosting page owns the create/update call." That boundary is good and this design keeps it.

**There is already a mystery picker — on the create pages only.** `location-create.ts:36`, `bystander-create.ts:36` and `monster-create.ts:85` each declare an identical `mysteryControl` rendered as a single-select `<app-custom-select>` labelled "Attach to Mystery (optional)", branching on submit between `create(mysteryId, payload)` and `createStandalone(payload)`. Copy-pasted three times, single-valued, and unchangeable after creation. Collapsing that triplication is most of the value of Phase 2.

### 1.4 The "pick an existing entity" UI pattern already in the app

- `shared/custom-select.component.ts` — a CVA select with `@Input() multiple` (`:21`), `@Input() searchable` (`:20`), configurable `optionValue`/`optionLabel`/`optionSubLabel` (`:25-27`). The primitive.
- `shared/weapon-tag-select.component.ts` — the multi-pick-existing idiom built on it: a `ControlValueAccessor` over `string[]` rendering chips above a `[multiple] [searchable]` custom-select. **The direct template for the component this feature needs.**
- `shared/confirm-delete-modal.component.ts` — already has `itemName`, `items`, `message`, `verb`, `confirmLabel`, `permanenceNote`. It has exactly **one** confirm output (`confirmed`), so the Detach/Delete pair needs a second action — see §7.3.

### 1.5 The Mystery wizard

`MysteryCreateComponent` + `MysteryCreateStore` (provided at the route component level). Four phases: Mystery(4 steps) / Monsters(2) / Locations(1) / Bystanders(1) (`mystery-create.store.ts:246-251`). Serves both `/mysteries/create` and `/mysteries/:id/edit`. Per the standing decision of 2026-07-21, submission happens **at phase transitions**, not at the end.

Three facts drive the whole of §5 and §6:

**(a) Locations and Bystanders already upsert by ID presence.** `LocationDraft` / `BystanderDraft` (`mystery-create.store.ts:62-76`) are `{ id: string | null, name, description, typeId }`, and `submitPhase2` (`:1303`) / `submitPhase3` (`:1344`) diff them: gone from the list → `unlinkFromMystery`; `id !== null` → `update`; `id === null` → `create(mysteryId, …)`. This is already Skyler's rule. It is missing only the link (§5.1).

**(b) The wizard assumes one monster per mystery.** There is no monster roster — a single `monsterForm`, a single `editingMonsterId`, and edit-mode hydration reads `const pureMonster = monsters[0] ?? null;` (`mystery-create.store.ts:736`), silently dropping monsters 2..N. Schema, API and `mystery-detail.html` all handle many. **Resolved: build the full roster (§3, decision 2).**

**(c) Sub-resources do NOT upsert by ID presence — they delete-all and recreate-all.** `AttackDraft` / `PowerDraft` / `WeaknessDraft` / `ArmorDraft` (`mystery-create.store.ts:37-60`) **have no `id` field at all.** `submitPhase1` (`:1244`) deletes every attack/power/armor/weakness named in `existingMonster*Ids` and then recreates the lot from the drafts via `saveThreatCollections` (`:1532`). `saveMinionDrafts` (`:1400-1425`) does the same thing per minion, against each draft's own `existingAttackIds`/etc. baseline. **This is the one place Skyler's upsert rule does not already hold, and it is the subject of §5.2.**

Asymmetry worth recording, because it inverts an earlier note in Yoshi's history: `MinionService` (Angular) now has the full set of sub-resource update methods (`updateAttack:59`, `updatePower:89`, `updateArmor:107`, `updateWeakness:125`, `removeAttackWeaponTag:78`). **`MonsterService` has none of them** — it has `createAttack`/`deleteAttack` and no `updateAttack`, despite `MonstersController` exposing every PUT. **Seven** Angular methods are missing on the monster side, not five — the five updaters plus `linkToMystery` and `unlinkFromMystery`, which `LocationService` and `BystanderService` both have and `MonsterService` does not. Corrected in rev 8; see §5.2.

---

## 2. Design principles this follows

1. **Membership is its own resource, not a field on the entity.** House precedent: a weapon tag attaches to an attack via `POST .../weapon-tags` and detaches via the matching `DELETE`, never via a field on `UpsertMonsterAttackRequest`.
2. **Keep the form components presentational.** Hosting pages own API calls.
3. **Upsert by ID presence, at every level.** Skyler's rule, applied consistently — including one level deeper than the code currently applies it (§5.2).
4. **Prefer generalising the shipped pattern over inventing one.** `WeaponTagSelectComponent` and the `LocationDraft` ID-diff are proven shapes; the new work is a second instance of each.

---

## 3. Decisions (confirmed by Skyler, 2026-09-19)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Shared reuse (M:N) is the model.** Editing an entity from any surface changes it in every mystery that references it, and that is desired. | No migration. `MysteryIds[]` stops being a read-only lie. The copy-on-attach and single-owner options are closed. |
| 2 | **Build the full monster roster (M3).** | The `monsters[0]` truncation is fixed. Monsters become consistent with locations and bystanders. Unblocks monster linking from the edit form. Drives §6 and the minion picker in §6.4. |
| 3 | **Create pages take the single code path:** always `createStandalone`, then membership `PUT`s. | Removes the triplicated `create(mysteryId,…)` / `createStandalone(…)` branch. Accepts a non-atomic two-round-trip create. |
| 4 | **No cross-mystery warning copy anywhere.** | §4.4 of rev 1 is deleted. Sharing is known and does not need narrating. The only place the app discloses other memberships is the removal modal (§7), where it changes what buttons appear. |
| 5 | **Wizard edit-mode hydration treats existing links as authored** — everything is editable. | Combined with decision 6, the `origin` flag proposed in rev 1 is unnecessary and has been **retracted entirely** (§5.1). |
| 6 | **Every entity is editable in the wizard**, including ones already associated. The wizard needs a re-edit affordance, not just append/remove. | §5.3. Visual treatment is Rosalina's; the architectural requirement is that a draft can be loaded back into the authoring form and committed to the same slot. |
| 7 | **Removal is a confirmed choice between Detach and Delete.** Delete always appears. | §7. Replaces rev 1's hard-delete question. Broadens scope, accepted. Superseded in part by decision 10. |

### 3.1 Second round (confirmed by Skyler, 2026-09-19, answering §10 of rev 3)

| # | Decision | Consequence |
|---|---|---|
| 8 | **Monster and minion sub-resources upsert by ID presence.** | `AttackDraft` / `PowerDraft` / `WeaknessDraft` / `ArmorDraft` gain `id: string | null`; `saveThreatCollections` and `saveMinionDrafts` stop deleting-all and recreating-all (§5.2). The silent-data-loss path is closed by construction. Costs Angular `MonsterService` methods and a weapon-tag assign/remove diff — **seven methods, not five; corrected in rev 8, see §5.2.** |
| 9 | **Dirty-tracking is in, on top of decision 8.** | Not a fallback for a declined upsert — an affirmative requirement. With upsert approved its job is **write amplification, not data safety**: it stops a roster of N monsters reissuing N identical subtrees of PUTs on every phase transition. Mechanism is the derived per-row baseline diff of §5.4 — *not* a stored `edited` flag and *not* `origin`. |
| 10 | **Detach is offered whenever the entity exists in the catalog**, not only when it is linked elsewhere; the modal states how many other mysteries are involved so the choice is informed. | Widens decision 7. Closes Rosalina's OQ1. See §7.5 — outside the wizard there is no current mystery, so this has a boundary. |
| 11 | **The wizard fetches the mystery list** to resolve membership IDs to names for the modal. | One `getMysteries()` added to the wizard's reference-data `forkJoin`. **No DTO change** — `mysteryIds: Guid[]` stays as it is on all six shipped contracts. Closes Rosalina's OQ7. |
| 12 | **Removals apply at the next phase transition, not on confirm.** | The standing 2026-07-21 phase-transition submission decision survives intact. Abandoning the wizard applies nothing. Needs the `pendingRemovals` disposition record (§7.3). |
| 13 | **Minion cascade confirmed.** Detach → monster and minions both survive untouched and merely stop appearing here. Delete → the monster's minions are FK-cascade-destroyed everywhere and the modal lists them. Attaching a monster always brings its minions. | §6.4 stands as written. Partly already shipped: `monsters-list.html:51` already passes `pendingDelete()?.minions ?? []` to the modal, so the cascade disclosure has a working precedent to copy. |
| 14 | **The Detach / Delete modal extends to the non-wizard list and detail pages in the same change set**, not as a later sweep. | Rosalina's §7.5 position; my New Question 7 argued the other way and lost. Moves the work from Phase 6 into Phase 3 (§9), where the modal is already being hardened. |

### 3.2 Third round (2026-09-20, from Peach's Phase 4 acceptance review)

Her criteria are at `docs/updates/mystery-entity-linking-acceptance.md`. Two of her gaps are architectural and are decided here; the third (G4) is recorded as expected behaviour in §7.6.

| # | Decision | Consequence |
|---|---|---|
| 15 | **`pendingRemovals` is wizard-scoped, not phase-scoped, and every phase submit drains the whole list.** | Closes G1 without touching `jumpToPhase`, `advancePhase` or tracker semantics. A confirmed removal survives an edit-mode tracker jump and is applied by whichever submit happens next. Decision 12's "abandoning applies nothing" is preserved exactly — a jump is no longer an abandon, and the code no longer has to tell them apart. §7.3. |
| 16 | **The removal variant keys on the phase's baseline, not on `id`.** | Closes G3. An entity attached this session but not yet submitted has an `id` but no persisted membership, so it is a **local discard** — no modal choice, no disposition, no API call. Removes the path where an accidental attach offered permanent destruction of a catalogue entity. Needs no new store state: the `existing*Ids` signals already are the predicate. §7.1. |

### 3.3 Fourth round (2026-09-20, closing the three-stage pre-Phase-5 review)

| # | Decision | Consequence |
|---|---|---|
| 17 | **Minions join the disposition drain.** | `'minions'` becomes a `RemovalCollection` member with a delete-only disposition. Closes the G1 hole on the minion roster — the one I failed to sweep when decision 15 closed it for two collections. Costs more than the store change I estimated: the minion modal today passes `verb="Remove"` with sub-resource counts and does not use the `confirmLabel`/disposition shape at all, so it needs `confirmLabel="Delete"` when persisted and **never** a `secondaryLabel` (a minion has no membership to detach). Real UI work; Rosalina is specifying it. §7.7. |
| 18 | **Minion re-parenting is built now, not deferred — as a dedicated verb.** | `PUT /api/monsters/{monsterId}/minions/{minionId}` → 204 \| 404. **Not** `MonsterId` on `UpsertMinionRequest`. Bowser is building it. §6.4. |
| 19 | **A monster is not required to complete the wizard.** | An empty monster roster must advance, and a mystery must be saveable with zero monsters. Reaches `validateCurrentStep`, `phaseComplete`, the tracker, `submitPhase1`, and the read side. The backend already permits `monsterCount: 0`. §6.5. |

---

## 4. Design — linking from the entity's own edit form

### 4.1 API: one new verb, three times

```
PUT    /api/mysteries/{mysteryId}/monsters/{monsterId}     → 204 | 404
PUT    /api/mysteries/{mysteryId}/locations/{locationId}   → 204 | 404
PUT    /api/mysteries/{mysteryId}/bystanders/{bystanderId} → 204 | 404
```

**Why `PUT` on the membership URI.** That exact URI already ships as the unlink `DELETE` (`MonstersController.cs:53`). `PUT` is its mirror: membership is a resource, `PUT` asserts it exists, `DELETE` asserts it doesn't. Re-linking an already-linked entity is a 204 no-op, never a 409 — which matters concretely, because §5.1 fires these unconditionally from `forkJoin` batches. `POST` to the collection is unavailable: `POST /api/mysteries/{id}/monsters` already means *create a new monster here*, and a body-type overload is an ambiguous ASP.NET action match.

> **Correction (rev 6, from Boo's Phase 1 security review).** Earlier revisions called the two verbs "both idempotent." **That is wrong as stated, and the error hides a real client bug.** They are idempotent in *effect* — the post-condition holds however many times you call them — but not in *status code*. A repeated `PUT` returns 204. A repeated `DELETE` returns **404**, because `UnlinkFromMysteryAsync` returns `deleted > 0` (`LocationService.cs:166-170` and its two twins) and the controller maps that to `NoContent() : NotFound()`.
>
> **The new `PUT` should not be made to match by weakening it, and the `DELETE` should not be changed to match either.** `NoContent() : NotFound()` is the house pattern across 25 delete endpoints in this codebase; making unlink alone return 204-always would leave it inconsistent with its immediate neighbours in the same controllers, and changing all 25 is not this feature's business. The asymmetry stays; the *claim* was the defect. §7.3 records how the client handles it.

Boo rates this zero security weight — it is pure Phase 3/4 correctness, and it is called out here rather than left for Luigi to hit at runtime.

`404` when either the mystery or the entity does not exist. **No request body, therefore no new DTO, no contract change.**

Service layer gains `LinkToMysteryAsync(Guid mysteryId, Guid id, CancellationToken)` on all three interfaces, mirroring the existing `UnlinkFromMysteryAsync`. Repository layer gains `LocationLinkedToMysteryAsync` / `BystanderLinkedToMysteryAsync`.

> **Considered and rejected:** adding `MysteryIds: Guid[]` to the three `Upsert…Request` records. It reads tidier, but `submitPhase2`/`submitPhase3` already call `update()` with payloads that would carry no `mysteryIds`, so whole-collection PUT semantics would unlink the entity from every mystery on the next wizard save. Rejected on that concrete basis.

### 4.2 A shared `MysterySelectComponent`

New: `src/web/monster-of-the-week-web/src/app/shared/mystery-select.component.ts` / `.html`, a near-copy of `WeaponTagSelectComponent` — `ControlValueAccessor` over `string[]`, `@Input() options: MysteryListItemResponse[]`, chips above a `[multiple] [searchable]` custom-select, `optionSubLabel` surfacing the adventure type. Replaces the three copy-pasted single-select pickers and serves the edit forms, the wizard, and anything later.

### 4.3 Wiring it into the three form components

Each gains one input and changes its `save` payload:

```ts
@Input() mysteries: MysteryListItemResponse[] = [];
// current membership is read off `location.mysteryIds` — already on the DTO

@Output() readonly save = new EventEmitter<LocationFormSubmit>();

export interface LocationFormSubmit {
  location: UpsertLocationRequest;   // unchanged shape
  mysteryIds: string[];              // the full desired set
}
```

The membership control lives inside the component's own `FormGroup`, so it participates in dirty/valid state and is committed by the form's single existing Save button. The component still makes no API calls.

Breaking change to three `save` outputs, six call sites (three detail pages, three create pages), all in this change set. Mechanical.

**Host behaviour on save (detail page):** `update(id, submit.location)`; then diff `submit.mysteryIds` against `entity.mysteryIds` — added → membership `PUT`, removed → membership `DELETE` — `forkJoin`ed via the existing `runBatch` idiom.

**Host behaviour on save (create page):** per decision 3, always `createStandalone(payload)` then membership `PUT`s for each selection. One code path for zero, one, or many mysteries. The scoped `POST /api/mysteries/{id}/…` endpoints stay on the API (the wizard uses them); they simply stop being the create page's path. Accepted trade-off: creation is two round-trips and non-atomic, so a failed link leaves an unattached entity — a valid, visible, recoverable state under decision 1, and consistent with how every wizard phase already saves.

**Note:** the detail pages must also load `mysteryService.getMysteries()` to populate the picker's options — the create pages already do.

### 4.4 Conceded: the membership chips are not links (her §9.3, her OQ6)

Rev 1 suggested the mystery chips be `.entity-link` anchors. Rev 2 dropped that when the control moved *inside* the form's `FormGroup`, and Rosalina independently argues against it. **Agreed, closed, and it does not need Skyler** — her OQ6 can come off his list. The decisive reason is structural rather than about guards: a chip inside an editable multi-select is *already* a control, and making it also a navigation target makes clicking it ambiguous. Membership chips display; the dropdown edits; neither navigates.

**One correction to her reasoning, because it affects the follow-up.** She writes that "this app has no unsaved-changes guard" anywhere. That is stale as of the hunter wizard: `features/hunters/pages/hunter-create/hunter-draft.guard.ts` is a `CanDeactivateFn` — its own comment calls it "the app's first `canDeactivate` guard" — registered at `hunters.routes.ts:15`, with a companion `window:beforeunload` `@HostListener` at `hunter-create.ts:134`. What is true is that **no guard exists on the location / bystander / monster detail pages**, which is what makes a link out of a dirty form unsafe *there*.

The practical difference is to the follow-up, not to this decision: a read-only "Appears in: …" line on these detail pages (her suggested safe alternative, and a real navigation gap — the mystery detail page links *to* entities and nothing links back) now has a shipped guard pattern to copy rather than needing one invented. Logged as a Phase 6 candidate, not proposed for v1.

---

## 5. Design — the wizard, for Locations and Bystanders

### 5.1 Answering Skyler's Q1 directly: is ID-presence upsert sufficient?

**For the entity's own row, yes — and the code already does it.** `submitPhase2`/`submitPhase3` already branch exactly as he described. Nothing needs to change there, and rev 1's `origin: 'authored' | 'attached'` flag is **retracted**: once "edits propagate everywhere" is desired rather than feared, there is no reason to distinguish an attached draft from an authored one, and the diff gets *simpler* than rev 1 proposed, not more complex.

**But the rule is not sufficient at the two layers around the entity row.** Two concerns, one small and one that can lose data.

**Concern A — the link is a second row, and no `PUT` touches it.** Create-and-link is one endpoint (`POST /api/mysteries/{id}/locations`), so the `id === null` branch links as a side effect. Update is a plain `PUT /api/locations/{id}` with no mystery in the URL, so the `id !== null` branch *cannot* link. Attach an existing location today and press Next: its fields get updated, and it is **not added to the mystery**. Silent no-op.

Fix is one line per phase, and it is cheap precisely because the new endpoint is idempotent: **fire the membership `PUT` for every draft with an `id`, unconditionally.** No flag, no branch, no knowledge of whether it was attached or hydrated. The revised diff:

| Draft state | Action |
|---|---|
| in baseline, gone from the list | removal — §7 |
| `id !== null` | `update(id, …)` **+ membership `PUT`** (no-op if already linked) |
| `id === null` | `createStandalone(…)` + membership `PUT`, or keep today's scoped `create(mysteryId, …)` |

**Concern B — the monster's sub-resources do not upsert, they delete-all and recreate-all.** This is the one I'd flag hardest, and it is where I owe the worked example. It does not apply to locations or bystanders (no sub-resources); it applies to monsters and minions, and therefore lands in §6.

**Residual, accepted:** the unconditional `update` means the wizard writes back the field values it loaded at page-open. If the entity were edited elsewhere in between, that is a lost update. Single-user tool, and already true today for edit-mode revisits — pre-existing, not introduced here, and not worth engineering against.

### 5.2 The worked example Skyler asked for — why sub-resources need the rule too

**Setup.** Monster **Gravewalker** exists: 3 attacks (one, "Grave Chill", tagged *magic* + *close*), 2 powers, 1 armor, 1 weakness. It is linked to Mystery A, "The Quiet". The user opens **Mystery B** in the wizard, reaches the monster phase, and attaches the existing Gravewalker.

Now press Next. `submitPhase1` runs: `update()` the monster row, then **delete every ID in `existingMonsterAttackIds()` / `…PowerIds()` / `…ArmorIds()` / `…WeaknessIds()`**, then `saveThreatCollections()` **creates all four collections fresh from the draft arrays**. Three ways the attach can hydrate, three outcomes:

- **(i) Hydrate the fields only** — set `editingMonsterId`, leave the draft arrays and the ID baselines empty. Next deletes nothing and creates nothing. Gravewalker is intact. But Mystery B's wizard shows a monster with **zero attacks and zero powers** while the mystery detail page (which re-fetches) shows all of them. Confusing, not destructive.
- **(ii) Hydrate the ID baselines but not the draft arrays.** This is the trap. Next deletes attacks A1, A2, A3, both powers, the armor and the weakness **from the real Gravewalker row**, then recreates nothing. Result: **Gravewalker is stripped bare, in Mystery A too.** No error, no warning, not recoverable.

> **Rev 9 — this is not an attach hazard. It is a hazard of any path that populates one side and not the other, and the shipped code is already on the wrong side of it.** Luigi's finding, and it is the sharpest single line in 5a.
>
> `loadEditData` sets `existingMonsterAttackIds` from the fetched monster (`mystery-create.store.ts:952`) and builds the `monsterAttacks` drafts **with no `id`** — because `AttackDraft` has no `id` field to put one in. Under delete-all/recreate-all that is harmless: the baseline is the delete list and the drafts are the create list, and both are used wholesale. **The moment 5a turns it into a diff, "baseline populated, draft ids absent" means every attack is in the delete set and none is in the update set — outcome (ii), on a plain edit-mode revisit, with no attach anywhere in the story.**
>
> So the invariant is not "attach must hydrate both." It is: **the ID baseline and the drafts' ids are two halves of one fact and must be written in the same place, every time.** Under §5.4's rev-8 shape that is enforced structurally rather than by discipline — once the baseline *is* the response array, the drafts are built from the same objects in the same step, and there is no way to populate one without the other.
>
> Minions are already safe here and show what right looks like: `saveMinionDrafts` backfills `id` onto each draft alongside refreshing its baseline, which is why the per-minion cycle has never had this bug. 5a's job is to make the monster path do what the minion path already does.
- **(iii) Hydrate both correctly.** Next deletes all seven sub-resources and recreates seven new ones with **new primary keys**, re-assigning "Grave Chill"'s weapon tags from `weaponTagIds`. Content is preserved. But every sub-resource row churns its ID on every single Next — and with a roster of N monsters, that is N monsters' worth of churn per phase transition, forever.

**So: his rule is right, and the honest answer is that the code obeys it at the monster row and not one level below.** The recommendation is therefore to *apply his own rule more consistently than the code does today*: give `AttackDraft` / `PowerDraft` / `WeaknessDraft` / `ArmorDraft` an `id: string | null` and diff them exactly like `LocationDraft` — `id === null` → create, `id !== null` → `PUT`, in the baseline but gone → delete. That makes outcome (ii) structurally impossible (nothing is deleted unless the user removed it) and eliminates (iii)'s churn.

The backend PUTs already exist (`MonstersController.cs:70/104/120/136`). `MinionService` (Angular) already has the matching methods. Weapon tags on an updated attack need a small assign/remove diff of their own rather than the current assign-only path.

#### `MonsterService` needs **seven** methods, not five — corrected in rev 8

Rev 3 counted the five sub-resource updaters and missed two. Toad found the others during the Phase 4 review, and I verified all seven against `core/monster.ts` at `b47c3dc`:

| Method | Why | Which half of Phase 5 |
|---|---|---|
| `updateAttack`, `updatePower`, `updateArmor`, `updateWeakness` | decision 8's upsert | 5b |
| `removeAttackWeaponTag` | the tag diff on an updated attack | 5b |
| **`linkToMystery`** | **attach an existing monster — there is no client method for it at all** | **5a** |
| **`unlinkFromMystery`** | **detach a monster from the roster — likewise absent** | **5a** |

The last two are the important correction. **Phase 1 shipped the link verb on the backend for all three collections** (`MonstersController.cs:53`, `LocationsController.cs:101`, `BystandersController.cs:96` — all three `HttpPut` routes exist and are green). **Phase 2 shipped the client half for two.** `LocationService` and `BystanderService` have `linkToMystery` *and* `unlinkFromMystery` (`location.ts:48,52`, `bystander.ts:48,52`); `MonsterService` has neither. That was correct at the time — Phase 2 deliberately excluded monsters (§6.2) — but it means the monster roster cannot attach or detach anything until both are added, and neither appears in rev 7's Phase 5 list.

Nothing is needed on the backend. The gap is entirely in `core/monster.ts`.

**This was a scope increase, and Skyler approved it (decision 8).** Worth keeping the rejected floor on record: had it been declined, the minimum would have been to make *"attach hydrates the full sub-resource graph and its ID baseline atomically, or sets neither"* a written invariant with a dedicated Toad test — because the codebase's own history says this class of bug lands here. The Bug 2 fix of 2026-08-04 was the same shape: an ID baseline populated on one path and not another. Upsert removes the invariant's reason to exist by making the delete list a *diff* rather than a *baseline*.

### 5.3 Re-edit (decision 6)

Today the locations and bystanders phases are append-and-remove only. Decision 6 requires loading a draft back into the authoring form and committing it to the same slot.

**The pattern already exists in this file** and should be reused rather than reinvented: the minion roster's `editingDraftIndex: signal<number | null>` (`mystery-create.store.ts:286`), with `saveMinionDraftToList()` / `editMinionDraft(index)` / `startNewMinionDraft()` / `cancelComposerEdit()` (`:1021-1113`). Per the standing decision of 2026-07-21 as amended, a single-slot form reinterpreted by an `editingDraftIndex` is the house shape for "N of a thing." Locations and bystanders get the same treatment, one index signal each, with the existing `addLocationForm` / `addBystanderForm` doing double duty as the edit form.

**Commit-on-advance rule.** The minion composer already defines this (`commitComposerIfValid()`, `:1003`): an open composer is committed if it can be, and the user is blocked with `COMPOSER_BLOCKED_MESSAGE` if it can't. Locations and bystanders should adopt the same rule so all four entity types behave identically when Next is pressed with a half-finished form open.

Consistency across the four types in both the store and the templates is what Skyler asked for and what makes the monster roster cheap — by then it is the fourth instance of one pattern, not a new one.

### 5.4 Resolving the dirty-tracking question (her §10.1)

Rosalina argues that `origin: 'attached'` must be narrowed rather than dropped, to *"an attached entity is never written unless the user explicitly edited it in this session,"* needing a third state (`origin` + `edited`). I retracted `origin` outright. Working through it:

**Under my model, does merely loading an attached entity into the composer and pressing Next reissue a PUT?** Yes — and more than that: **it reissues a PUT even if you never open the composer at all.** Attach a location, touch nothing, press Next, and `update(id, …)` fires with the values hydrated at attach time.

**But that is shipped behaviour, not something attach introduces.** `submitPhase2` today PUTs *every* draft with `id !== null` on *every* phase transition, whether the user touched it or not (`mystery-create.store.ts:1323-1327`) — so an edit-mode revisit already rewrites every location and bystander in the mystery on every Next. Attach does not create a new class of write; it extends an existing one to more rows. That is why her concern reads as sharper than it is: rev 1 had proposed `attached` = *never written*, which made the write look novel. It isn't.

**So her concern survives — but not for the reason she gives.** The stated reason, "attaching must never mutate the attached object," is dead: Skyler wants mutation, and mutation of identical values is not mutation. The surviving reasons are two, and only one of them bites:

- **Stale overwrite.** Values read at attach time are written back at Next; an edit made elsewhere in between is clobbered. Real, pre-existing, single-user tool, low. Not worth engineering against.
- **Write amplification — and this is the one that matters, and only for monsters.** For a flat Location or Bystander the unconditional write costs exactly one no-op PUT. For a monster it costs the *whole subtree*. Under today's delete-all/recreate-all (§5.2), attaching a monster and pressing Next without touching anything **deletes and recreates every one of its attacks, powers, armors and weaknesses, re-keying them all** — outcome (iii) of the worked example. With a roster of N monsters, that is N subtrees re-keyed per phase transition.

**Which means her concern is a symptom, and sub-resource upsert is the cure — and Skyler approved both (decisions 8 and 9).** That matters for how the two are understood, so state it plainly:

> With upsert in place, the unconditional write degrades to a handful of no-op PUTs of identical values, so **dirty-tracking is not what keeps the data safe — upsert is.** Dirty-tracking's job is write amplification: stopping a roster of N monsters from reissuing N identical subtrees of PUTs on every phase transition.

The distinction is worth keeping straight because it sets the bar for correctness. A bug in the dirty check costs redundant no-op writes. A bug in the upsert diff costs data. They are not equally dangerous, and Toad should weight them accordingly.

**And when we do want it, the right shape is neither a three-valued `origin` nor a stored `edited` flag.** Both store a fact that can desync from the data — most obviously, edit a field and change it back and the draft stays marked edited, and her own hardest caveat (a cancelled composer edit must *not* mark the draft edited) becomes a rule someone has to remember. **Derive it instead: snapshot the hydrated values onto the draft as a `baseline` at attach/load time, and at submit compare row-by-row.** A cancelled edit leaves the draft equal to its baseline by construction, so the caveat enforces itself. Per-row comparison is also strictly better than any per-entity flag, which would rewrite all eight sub-resources because the user renamed the monster.

This is the same derive-don't-store move that settled hunter completeness and pick rules, and it costs no new state machine — just a snapshot the drafts are already half-carrying in their `existing*Ids` baselines.

**Decided (decision 9):** build the derived per-row dirty check as part of the monster roster, where amplification is real. Skip it for Locations and Bystanders, where one no-op PUT per row does not justify a mechanism. `origin` stays retracted.

#### Rev 8 — Phases 2–4 gave this a better shape than rev 5 specified

Rev 5 said "snapshot the hydrated values onto the draft as a `baseline`," which reads as *adding* a field alongside the four `existing*Ids` arrays each `MinionDraft` already carries (`mystery-create.store.ts:129-138`). Having now read the shipped code, there is a cleaner move that costs less, not more:

> **Replace `existing*Ids: string[]` with `existing*: <Response>[]`.** The hydrated server responses *are* the baseline. The ID list is `.map(x => x.id)` off them, so the delete-detection the arrays exist for is unchanged, and the value comparison decision 9 needs comes free in the same field. Net change to `MinionDraft` is zero new fields, four retyped ones.

Two things this buys beyond tidiness. It keeps **one** baseline per collection rather than an ID baseline and a value baseline that can disagree — the failure mode where a row is in one and not the other is exactly the Bug 2 shape this file has already been bitten by twice. And it makes the weapon-tag diff tractable: `MonsterAttackResponse.weaponTags` is on the response and nowhere else, so comparing an updated attack's tags against what the server last returned needs the response object anyway.

**Also, and separately: the sub-resource drafts should gain `localKey`, not only `id`.** Rev 3's §5.2 asked for `id` alone, which is enough for upsert and not enough for anything else. Phase 3 learned this the hard way one level up, and the reasoning is written into the shipped code (`MinionDraft.localKey`): *"The array index was standing in for identity, and that is a bug source rather than a shortcut."* Sub-resource drafts are still exactly where the roster was before Phase 3 — `@for (attack of store.monsterAttacks(); track $index)` and `removeDraft(signal, index)` — and an unsaved row has `id: null`, so `id` cannot address it. `createDraftKey(prefix)` (`:141`) already exists and takes a prefix; `createDraftKey('attack')` is the whole cost.

This is a small scope addition to 5b and it is the difference between the diff being addressable and it being index-addressed under a roster that can reorder.

### 5.5 Store consequences of "collapse the composer after save" (Rosalina's OQ2, decided yes)

Checked against the store design, because it is the only one of her interaction answers that could have reached it. **It does not change submit timing, the diff, or `commitComposerIfValid`** — committing a draft into the roster has always been a local operation, and API submission still happens at the phase transition. Two small store-shape consequences, both mechanical:

- **Locations and Bystanders need composer-open state they do not have today.** Their add-form is unconditionally rendered; minions already have `composerOpen` (`mystery-create.store.ts:294`). Collapsing after save means two more instances of the same signal, which is what decision 6's consistency implies anyway.
- ~~**`MysteryCreateDraftState.composer` generalises from one composer to four.**~~ **Withdrawn in rev 9 — do not do this.** Luigi checked what actually consumes `draftState` and the answer is: one assertion in `mystery-create.store.spec.ts:940`. No template, no persistence, no route, no other reader. It is a `computed` that exists to be asserted against, which makes it **dead production code**, and rev 5 was proposing to quadruple it on the strength of a name.
  **Do one of two things in 5a, not a third:** wire it to **F4** (mid-wizard persistence), which is the job it was clearly shaped for and would make it live — or delete it and the assertion with it. Growing it to four composers is the only option that is definitely wrong, because it doubles the maintenance of something with no consumer at exactly the moment the store is hardest to change. My recommendation is delete; F4 can reintroduce a snapshot shaped to what persistence actually needs rather than to what the store happened to look like in July.

Also worth stating so it is not rediscovered: with the composer collapsing, `commitComposerIfValid` becomes *more* load-bearing, not less. A collapsed composer cannot hold uncommitted work, but a re-opened one can, and the rule ("an open composer is committed if it can be, and you're stopped if it can't") is what makes the roster safe to click around in. §5.3 already requires it for all four types.

---

## 6. Design — the monster roster (decision 2) and minions

### 6.1 Shape — and a re-sizing, courtesy of Rosalina's §1

Her audit found that `mystery-create-monster-phase.html:148-372` **already ships the entire roster-plus-composer shape** for minions: summary cards, pencil-to-edit, the `Editing` micro-label and accent-tinted source card, composer header modes, `Save Minion` / `Save Changes` / `Cancel`, and `ConfirmDeleteModalComponent` on remove. Her §13 maps every piece to a line number.

That changes the sizing of this work, though not in the direction it first appears. **The template work is a lift, not new construction. The store work is not.** What remains genuinely new in the monster phase: the `submitPhase1` rewrite from single-slot to roster diff; the sub-resource upsert conversion (§5.2); `localKey` / `monsterKey` resolution (§6.3–6.4); the `monsters[0]` fix; and five missing `MonsterService` methods. So: cheaper UI, unchanged state risk. It stays the highest-risk phase, and it stays on a feature branch.

The more useful consequence is to **ordering**, not sizing — see §9. Her §10.2 makes the point sharply: the stable client key and the `track` fix "should land before the roster is replicated three more times," and the same is true of the a11y defects in §8.6. Retrofitting either after three replications means touching all four phases twice. Both therefore move *earlier* than rev 2 had them, into a foundations phase of their own.

The monster phase becomes roster-plus-composer, mirroring the shipped minion roster. `MonsterDraft` replaces the single `monsterForm` + `editingMonsterId` pair:

```ts
export interface MonsterDraft {
  /** `null` until saved in this session or hydrated from an existing mystery. */
  id: string | null;
  /** Client-side stable key, generated at draft creation, never changes. See §6.4. */
  localKey: string;
  name: string;
  description: string;
  harmCapacity: number;
  monsterTypeId: string;
  monsterArchetypeId: string;
  attacks: AttackDraft[];
  powers: PowerDraft[];
  weaknesses: WeaknessDraft[];
  armors: ArmorDraft[];
}
```

> **Corrected in rev 9 — this sketch contradicted §5.4, and §5.4 is the one that is right.** Rev 3 wrote that `MonsterDraft` drops the four `existing*Ids` baselines "because §5.2's recommendation puts the ID on each sub-resource draft instead." That was true when the only job was delete-detection. It stopped being true in rev 8, when §5.4 changed the baseline from ids to **responses**: the dirty check needs *values*, and the weapon-tag diff needs `weaponTags`, which exists only on `MonsterAttackResponse` and nowhere on a draft. Ids on the drafts give you delete-detection and nothing else.
>
> **So `MonsterDraft` carries the four baselines after all, retyped:**
>
> ```ts
>   existingAttacks: MonsterAttackResponse[];
>   existingPowers: MonsterPowerResponse[];
>   existingWeaknesses: MonsterWeaknessResponse[];
>   existingArmors: MonsterArmorResponse[];
> ```
>
> `MinionDraft`'s four `existing*Ids: string[]` are retyped the same way in 5a. This is the same count of fields the shipped `MinionDraft` already has — the change is their type, not their number. Luigi caught the contradiction; two sections disagreeing about the central type of the riskiest phase is exactly the kind of thing a three-stage review is for.

`loadEditData` stops at `monsters[0]` and hydrates the full list. `submitPhase1` becomes: diff the roster (removal per §7, `id !== null` → update + membership `PUT`, `id === null` → create + link), then for each surviving monster run the sub-resource diff, then the minions.

### 6.2 Monster linking from the edit form

Enabled at this point and not before. Until the roster ships, attaching a second monster from `MonsterFormComponent` would make monsters 2..N invisible in the wizard — not destroyed (`submitPhase1` has no monster-unlink step today) but silently absent from the mystery's own editing surface. This is the one hard sequencing constraint in the plan; it is why §9 puts monster edit-form linking in Phase 4 rather than Phase 2.

### 6.3 `localKey` — why a second identifier

A minion must name its monster, but a monster authored in this session has **no server ID until the phase transition saves it**. So the minion cannot hold a `monsterId`; it holds the monster's client-side `localKey`, and `submitPhase1` resolves `localKey → monsterId` after the monsters are saved. The existing code already sequences monsters-then-minions via `switchMap`; it becomes a fan-out over a map rather than a single monster.

`localKey` is stable for the life of the draft and is never sent to the server. It is generated for hydrated monsters too, so there is exactly one addressing scheme.

> **Rev 8 — this shipped in Phase 3 and needs no new design.** `createDraftKey(prefix)` (`mystery-create.store.ts:141`) already mints keys and already takes a prefix, and `MinionDraft`, `LocationDraft` and `BystanderDraft` all carry `localKey` today. `MonsterDraft` uses `createDraftKey('monster')`; that is the entire cost of this section. The reasoning the shipped comment records is worth re-reading before 5b, because it is the same argument §5.4 now makes one level further down for the sub-resource drafts: *"The array index was standing in for identity, and that is a bug source rather than a shortcut."*
>
> **One thing this section left ambiguous, settled here: minions stay a flat array with a `monsterKey`, not a nested collection under `MonsterDraft`.** §6.1's `MonsterDraft` sketch lists the four sub-resource collections and deliberately does not list minions, but it never said why. The reason is that Rosalina's §5 keeps the two-step split (step 0 monsters, step 1 minions) — nesting the minion roster inside the monster composer would put a composer inside a composer at `md:w-[42%]`, which she rejected explicitly. A flat `minionDrafts()` filtered by `monsterKey` also keeps `existingMinionIds` and `saveMinionDrafts`'s diff working as one collection rather than N, which is what the drain and the ledger both want.

### 6.4 Minion → monster pinning (Skyler is right, §6.3 of rev 1 was wrong)

With one monster, `saveMinionDrafts(monster.id)` could pin implicitly. With a roster it cannot. `MinionDraft` gains `monsterKey: string`, and the wizard's minion composer gains a **monster picker over the current roster** — the same affordance `/monsters/:monsterId/minions/new` already has, sourced from the in-memory roster rather than an API call. Visual treatment is Rosalina's.

Two rules fall out of `Minion.MonsterId` being required and non-nullable:

- **A minion cannot exist without a monster.** The composer cannot save a minion with no `monsterKey`, and the roster cannot be empty while minions exist. If the user removes the last monster, its minions go with it — there is nowhere for them to land.
- **Removing a monster takes its minions.** Which is fine, and *means different things for Detach and Delete*:
  - **Detach** — the bridge row goes; the monster and every one of its minions survive untouched and remain visible in the other mysteries. Nothing is destroyed. The minions simply stop appearing here, because they were only ever here *through* their monster.
  - **Delete** — `DELETE /api/monsters/{id}` FK-cascades the minions. **They are destroyed, everywhere.** The removal modal must list them (`ConfirmDeleteModalComponent`'s `items` input exists for exactly this and is passed `[]` everywhere today).

  Reassigning orphaned minions to a different monster is deliberately *not* offered *on removal*: silently re-parenting a minion would be a surprising mutation of a shared entity. **Confirmed by decision 13.**

  > **Corrected 2026-09-20 — "just a field edit" was wrong, and the same sentence stood in Rosalina's §6.** `UpsertMinionRequest` carries no `MonsterId` and `MinionService.UpdateAsync` never sets one, so the field edit described here would have returned **200 and silently done nothing** — the §5.1 Concern A shape one level down, with the wizard's local state disagreeing with the server until something refetched. Neither author had reason to check the request record. Bowser found it during the pre-Phase-5 review and built a **dedicated verb** instead: `PUT /api/monsters/{monsterId}/minions/{id}` → 204 | 404, no body, no DTO change, no migration (decision 18). `MonsterId` on `UpsertMinionRequest` was rejected — that DTO is sent by three shipped pages, non-nullable would re-parent every caller to `Guid.Empty` and trip the FK, and `Guid?` meaning "leave alone" is PATCH semantics inside a PUT, which §2 principle 1 exists to avoid.
  >
  > **The two verbs look identical and are not.** Mystery membership is M:N, so its `PUT` **adds** a row. Minion→monster is a required 1:N, so this `PUT` **moves** one in place. Both are idempotent and both return 204 — but a re-parent issued against a stale `monsterId` silently *relocates* a minion rather than failing, which the membership verb cannot do. Bowser named the service method `MoveToMonsterAsync` rather than `LinkToMonsterAsync` for that reason, and its tests assert both ends of every move: the minion arrives under the target **and** leaves the origin.

Adding a new minion to an **attached** (shared) monster adds it to that monster in every mystery. That follows directly from decision 1 and needs no special handling — **confirmed by decision 13.**

#### Re-parenting is built now, as a dedicated verb (decision 18)

```
PUT /api/monsters/{monsterId}/minions/{minionId}   → 204 | 404
```

Bowser is building it. **Explicitly not** `MonsterId` on `UpsertMinionRequest` — Luigi's reasoning, which is right and which §2 principle 1 already implies. That DTO is sent by `minion-form`, `minion-create` and `minion-detail`; a non-nullable `MonsterId` would re-parent every existing caller to `Guid.Empty` and trip the FK, and a `Guid?` with "null means leave it alone" is PATCH semantics smuggled inside a PUT. This is the same argument that kept `MysteryIds` out of the three `Upsert…Request` records in §4.1: a field that half the callers do not know about, whose absence silently means something, is a foot-gun regardless of how tidy it reads.

**Bowser's semantic caveat, recorded because the two verbs look identical and are not.** Mystery membership is M:N, so `PUT /api/mysteries/{id}/locations/{id}` **adds** a row and leaves any others alone. Minion→monster is a required 1:N, so `PUT /api/monsters/{id}/minions/{id}` **moves** the minion — the previous parent loses it. Both are idempotent, both are 204, and they are not the same operation. Do not reason about one from the other; in particular, a replayed re-parent is safe but a re-parent issued against a stale `monsterId` silently relocates a minion rather than failing.

---

### 6.5 A monster is optional (decision 19) — what it reaches

Skyler's answer is one sentence with the widest blast radius in this feature: **an empty monster roster must advance, and a mystery must be saveable with zero monsters.** The backend already permits it (`monsterCount: 0` is a valid `MysteryListItemResponse`), so this is entirely a wizard change. Luigi had already established that `validateCurrentStep`'s hard block could not survive the roster unchanged; decision 19 means it does not merely change, it goes.

**Write side.**

1. **`validateCurrentStep` loses its phase-1/step-0 branch** (`mystery-create.store.ts:1656-1659`). `if (phase === 1 && step === 0 && this.monsterForm.invalid)` is the hard block, and under a roster the phase's validity is a property of the roster, not of one form. The composer's own three-way commit rule (§5.3) replaces it: an open composer holding invalid work still blocks, an empty one does not. That is the same rule the minion step at `:1661` already uses, so this is a deletion plus a generalisation, not new logic.
2. **`submitPhase1` must be a no-op-and-advance when the roster is empty** — drain `pendingRemovals`, apply the roster diff (which may still contain removals on an edit-mode revisit), and advance. It must not synthesise a monster from an empty form, which is what today's unconditional `monsterService.create(mysteryId, monsterRequest)` would do.
3. **Step 1 with zero monsters** is now reachable. Rosalina's §6 already specifies it: suppress the composer, show "Add a monster first — minions belong to a monster." Nothing to decide, but `validateCurrentStep` must not block there either — with no monsters there can be no minions (`Minion.MonsterId` is a required FK), so the step is trivially satisfied.

**The tracker, and what `phaseComplete` means now.**

`phaseComplete[1]` drives two things: the tracker's `finished`/`unreached` bubble, and `isPhaseAccessible` in create mode. With monsters optional, **"complete" has to mean "satisfied", not "has content"** — otherwise a mystery that legitimately has no monster shows a permanently unfinished phase.

- **Create mode already behaves correctly** once the hard block is removed: `advancePhase()` marks the current phase complete on submit, so pressing Next through an empty Monsters phase completes it.
- **Edit mode needs a small correction that is worth making anyway.** `init()` sets `phaseComplete` to `[true, true, true, true]`, and then `loadEditData` overwrites it with data presence — `pureMonster != null`, `locations.length > 0`, `bystanders.length > 0`. Under decision 19 the monster predicate is simply wrong, and the other two have always been questionable for the same reason: locations and bystanders were never required either. **Drop the data-presence recomputation in edit mode and let `init()`'s `[true, true, true, true]` stand.** Nothing else depends on it — `isPhaseAccessible` already returns `true` unconditionally in edit mode — so this only affects which bubbles render as finished, and it makes them tell the truth. Phase 0 remains the only genuinely required phase, enforced by `conceptForm`.

**Read side — better than it looks; check it, don't rebuild it.**

- **`mystery-detail` already handles zero monsters.** `@if (pureMonsters().length === 0) { <p>No monsters.</p> }`, and the minion fan-out already short-circuits on `monsters.length === 0`. No change.
- **The dossier's monster block is guarded by `store.monsterPreview().name`** (`mystery-create-dossier.html:56`), so an empty monster renders nothing today. That guard degenerates correctly, but it is guarding the *single-monster* shape; 5b replaces the block with the roster rendering Rosalina's §5 specifies (one Monsters section, one compact entry per draft, exactly one expanded), and that rendering needs its own empty state.
- **`monsterPreview()` itself becomes roster-shaped or goes.** It reads `monsterValue()` — the single `monsterForm` — and every one of its `?? ''` fallbacks exists to make an unfilled form render as blank. Under a roster it has no single subject.

**toad:** the case that proves decision 19 end to end is **create a mystery, press Next straight through the Monsters phase without touching anything, finish, and confirm the mystery saves with zero monsters and the detail page renders.** It should also confirm no monster row was created — a synthesised empty monster is the failure mode here, and it would be invisible on the detail page.

---

## 7. Design — removal: Detach or Delete (decision 7)

### 7.1 What the cases are — keyed on the baseline, not on `id` (decision 16)

**Peach's G3 question was "should the diff key on the baseline rather than on `id`?" The answer is yes, and it is not a close call.**

`id !== null` was the wrong predicate because it answers *"does this entity exist?"* when the question the modal actually needs answered is *"does this mystery's membership of it exist?"* Those came apart the moment attach existed: an attached entity has an `id` the instant it is picked, but its membership row is not created until the phase submits. Keying on `id` therefore offered a user who attached something by mistake a **Detach** that was a no-op against a membership that was never created (the absent-membership `DELETE`, 404, swallowed by §7.3 rule 2) and a **Delete** that permanently destroys a catalogue entity they only meant to un-attach. That is the most dangerous button in the feature, offered for the most trivial mistake in it.

The right predicate already exists in the store and needs no new state: **is this `id` in this phase's baseline** (`existingLocationIds` / `existingBystanderIds` / `existingMinionIds` at `mystery-create.store.ts:330-331` and siblings, plus the monster roster's equivalent in Phase 5). Those signals are set on edit-mode load and after every successful phase submit, which is exactly "memberships that are persisted for this mystery."

| Draft state | Offered | Meaning |
|---|---|---|
| `id === null` — authored here, never saved | **Remove** only | Pure in-memory discard. Nothing exists server-side. |
| `id !== null`, **not in baseline** — attached this session, not yet submitted | **Remove** only | ← **new.** The entity exists; *this membership does not.* Undoing an un-submitted attach is a local discard, so there is nothing to detach and nothing that warrants offering deletion. No modal choice, no disposition recorded, no API call. |
| `id !== null`, **in baseline**, linked only to this mystery | **Detach** + **Delete** (decision 10) | Detach leaves the entity in the catalog linked to nothing — a first-class state standalone creation already produces. Delete is `DELETE /api/{collection}/{id}`. |
| `id !== null`, **in baseline**, linked to other mysteries | **Detach** + **Delete** | Detach = `DELETE /api/mysteries/{mysteryId}/{collection}/{id}`. Delete = hard delete, removing it from **every** mystery. |

Two consequences worth naming:

- **This is §7.3's remove-then-re-attach pair in the other order**, and collapsing the new case into "local discard" makes both orders symmetric: neither an attach-then-remove nor a remove-then-re-attach leaves a disposition behind.
- **It shrinks §7.3 rule 2's exposure without retiring it.** The accidental-attach case was the main source of absent-membership detaches; rule 2 now covers only genuine partial-failure replay, which is still real.

A user who genuinely wants to destroy a catalogue entity they just attached can still do it from `/locations` and friends, which is where decision 14 put that capability. Losing it from this one gesture is the correct trade.

**Rosalina owns the copy for the new middle row** — variant (A)'s current sentence ("this hasn't been saved yet; removing it discards what you typed") is wrong for an attached entity, since nothing was typed. Flagged to her; the state model is settled here, the wording is hers.

### 7.2 Where "is it linked elsewhere?" comes from — no new API needed

`MysteryIds[]` is already on every list and detail response the wizard loads. `loadEditData` calls `locationService.getByMystery()` → `LocationListItemResponse[]`, which carries `mysteryIds` (`ApiContracts.cs:198`); the attach picker's options come from `getAll()`, same field. **The store's hydration mapping currently discards it.** Keeping it is a one-line change per entity type and answers the modal's question locally.

The caveat is that it is a page-load snapshot and can be stale. Tolerable: staleness can only change which buttons appear, and the destructive button is shown in every case.

**What the client does *not* have is mystery *names*** — `mysteryIds` is IDs only, so a modal saying "also used in *The Quiet*, *Dead Air*" needs a lookup. Cheapest route: add `mysteryService.getMysteries()` to the wizard's reference-data `forkJoin` (one call, already done on every create page, and needed anyway if the wizard ever shows membership). The alternative — enriching `mysteryIds: Guid[]` to a `MysteryRefResponse[]` across six shipped DTOs — is cleaner but is a breaking contract change for one modal. **Decision 11 took the fetch, so the six DTOs are untouched.** The same one call is added to the three swept list pages (§7.4).

### 7.3 Store and component changes

**`ConfirmDeleteModalComponent` needs a second action.** It has one `confirmed` output today. Adding an optional secondary — e.g. `@Input() secondaryLabel: string | null` plus `@Output() secondary` — keeps every existing call site working unchanged (all of them leave it null) and is a smaller change than a second modal component. Copy, button order and emphasis are Rosalina's.

**Removal decisions must be remembered until the phase transition.** Today `removeLocation(index)` just splices the array and the diff at Next *infers* an unlink from the baseline. Now the diff must know *which* of detach/delete the user picked, so the store needs a pending-removal record per phase:

```ts
readonly pendingRemovals = signal<{ id: string; action: 'detach' | 'delete' }[]>([]);
```

`idsToRemove()` (`mystery-create.store.ts:1455`) stops being the sole source of truth and becomes a consistency check against it. Re-attaching the same entity before pressing Next must cancel its pending removal.

**Replay and the 404 (from Boo's review — see the correction in §4.1).** A recorded disposition can be applied more than once, and a second detach of an already-unlinked membership returns 404, which the client's error path would treat as a failed phase submit. Three ways in: a partial `forkJoin` failure where some calls succeeded and the user presses Next again (the realistic one — partial failure of a fan-out batch is a known property of this wizard); the entity being unlinked from another surface in between, which Phase 3's list-page sweep makes more likely; and `pendingRemovals` simply not being cleared after a successful submit.

**Decided, two rules, both needed:**

1. **Clear `pendingRemovals` on a successful phase submit.** This is the actual fix — it removes the replay in every case except a genuinely partial failure. Without it the record survives and re-fires on every subsequent Next.
2. **When applying a recorded disposition, treat 404 as success.** This is the safety net for the partial-failure case, and it is semantically right rather than a papering-over: the user asked for "this is not in this mystery" (detach) or "this does not exist" (delete), and a 404 means that post-condition already holds. Scope it tightly — **only on the `pendingRemovals` application path, not to deletes generally.** A user-initiated delete elsewhere in the app that 404s is still an error worth surfacing, and a blanket client-wide rule would hide genuine wrong-id bugs.

**Rejected: re-checking membership before each removal.** It costs a GET per removal and does not close the race, only narrows it — the membership can still vanish between the check and the delete. A pre-check that still needs the 404 handler behind it is strictly worse than the 404 handler alone.

**toad:** the test is "make the first phase submit fail after some removals have landed, press Next again, confirm the phase completes." That is the case rule 1 does not cover and rule 2 exists for.

**Correction to rule 1 (decision 15):** clearing `pendingRemovals` on a successful phase submit is right, but it must clear *what that submit drained*, not the whole list — see below, the list is now wizard-scoped and a submit may be draining removals that originated in another phase.

### 7.3.1 `pendingRemovals` is wizard-scoped (decision 15) — closing Peach's G1

**The gap.** Decision 12 says removals apply at the next phase transition. That holds only if every exit from a phase *is* a transition, and in edit mode one isn't: `jumpToPhase` (`mystery-create.store.ts:900`) sets `currentPhase` directly and never submits, and `isPhaseAccessible` (`:909`) returns `true` unconditionally in edit mode. So: edit a mystery → Locations → trash a location → confirm **Delete** → click the Bystanders bubble → **Finish**, and phase 2 never submits. `Back → Next` is safe because it re-enters and re-submits; the tracker is the only hole.

**Why this is worse than the pre-existing bug it sits on.** Today's inferred unlink is lost through the same gesture, and unsubmitted *field* edits are lost too. But Phase 4 puts a confirmation dialog and the word **Delete** in front of it. Asking a user to confirm a destructive action, telling them it will happen, and then not doing it is a different category of defect from losing an edit they never confirmed. It is also the one failure mode that makes users stop trusting a confirmation dialog, which we need them to read.

**Decided: make the disposition record wizard-scoped and drain it on every phase submit.** `pendingRemovals` becomes a flat list of `{ collection, id, action }` that does not belong to a phase, and *every* `submitPhaseN` applies the whole of it as part of its batch. A removal names an entity, a collection and a disposition; applying it has never actually depended on which phase is submitting.

**Why this one and not the alternatives:**

- **Submit on jump** — the obvious fix, and the most invasive. `submitCurrentPhase()` succeeds into `advancePhase()` (`:1633`), which hard-increments `currentPhase`; making it land on an arbitrary target phase is a real refactor of the navigation core. It also makes a tracker click fire a full monster-and-minion save as a side effect, and lets `validateCurrentStep()` block navigation, turning the tracker into a trap. Large blast radius on shipped behaviour, to fix a narrow problem.
- **Block a jump while a disposition is pending** — cheap and hostile. "You cannot navigate because you deleted something" is a worse experience than the bug, and it fixes nothing else.
- **Apply on the final submit only** — closes the tracker hole but delays every removal to the end, which contradicts decision 12's copy ("take effect when you continue to the next step") and makes a mid-wizard abandon lose more than it does today.

Draining on every submit gets the same result as submit-on-jump with none of the navigation surgery, and it makes the shipped copy *more* true rather than less: the removal takes effect when you next continue, whichever phase you continue from.

**Bookkeeping Luigi must get right.** When a drained removal is applied, **also remove its id from that collection's baseline signal** (`existingLocationIds` and siblings). Otherwise the owning phase's own `idsToRemove()` diff will later see an id that is in the baseline and not in the drafts, and fire a second removal — harmless, because §7.3 rule 2 swallows the 404, but it is a duplicate request produced by sloppy state. This is the completion of what §7.3 already said: `pendingRemovals` is authoritative and `idsToRemove()` is the consistency check, not the source of truth.

**What this does not fix, deliberately.** An edit-mode tracker jump still discards unsubmitted *field* edits and newly authored drafts in the phase being left. That is pre-existing, unchanged, and out of scope — logged as **F9** in §12. The resulting asymmetry is intentional and defensible: a removal was confirmed through a modal that promised it would happen; a half-typed location never made that promise.

**Decision 12 is preserved exactly.** Abandoning the wizard still applies nothing. What changes is that a tracker jump is no longer an abandon — and the code no longer needs to tell the two apart, which is the part it could not do.

**This keeps the standing phase-transition submission decision intact** (decision 12), at the cost of a modal that says "Delete" and does not delete until Next — and of a user who abandons the wizard never having their deletion applied. The second property is a feature: nothing is destroyed until you advance. Rosalina carries the semantics in copy rather than mechanism (her §7.3).

**Applies to all four entity types**, monsters and minions included, with §6.4's cascade rules folded into the monster modal's `items` list.

### 7.4 The non-wizard sweep (decision 14)

The modal extends to the list and detail pages in the same change set. Twelve call sites use `ConfirmDeleteModalComponent` today; only four are in scope, because the rest delete things with no mystery membership (hunters, playbooks, mysteries themselves, and the minion deletes on `monster-detail` / `minion-detail`):

| Call site | Today | After |
|---|---|---|
| `locations-list.html:45` | `[items]="[]"` | mystery names |
| `bystanders-list.html:45` | `[items]="[]"` | mystery names |
| `monsters-list.html:51` | `[items]="pendingDelete()?.minions ?? []"` | minions **and** mystery names |
| `minions-list.html:51` | `[items]="[]"` | unchanged — a minion has no mystery membership |

`monsters-list` is the useful precedent here: it already assembles a cascade list for the modal, so the pattern for "name what goes with this delete" ships and only needs a second source merged in. Each page also gains `getMysteries()` to resolve IDs to names — the same one call decision 11 adds to the wizard.

### 7.5 A boundary on decision 10 that neither Rosalina nor I anticipated

**Detach needs a mystery to detach *from*, and outside the wizard there isn't one.** `DELETE /api/mysteries/{mysteryId}/{collection}/{id}` requires a `mysteryId`. In the wizard that is unambiguous — you are building mystery X. But every one of the four sweep targets is an **unscoped flat catalog route** (`/locations`, `/bystanders`, `/monsters`, `/minions`), where the entity may belong to three mysteries and the page knows about none of them. There is no referent, and a Detach button would have to mean either "detach from all," which nobody wants as a button, or "open a second picker inside a confirm dialog," which is more machinery than the situation deserves.

I checked whether any mystery-scoped route could offer it instead. The scoped detail routes (`/mysteries/:mysteryId/locations/:locationId` and siblings) render the same components as the unscoped ones and **carry no delete affordance at all** — `location-detail.html` has a back link, the form and the custom-moves list, and nothing else. So there is currently no non-wizard surface where Detach has a meaning.

**Resolution, by construction rather than preference: outside the wizard the modal is Delete-only, and the sweep is a *disclosure* upgrade — the `[items]` list and the mystery names — not a Detach upgrade.** That is the half with the real safety value anyway: after this feature the flat-list delete is the highest-consequence destructive action in the app, and today it says nothing at all about what it takes with it.

This narrows decision 14 slightly from its plain reading, so it is called out rather than folded in silently. If Skyler wants Detach reachable outside the wizard, the natural home is the mystery detail page's rosters, paired with the attach affordance already queued for Phase 6 — that page *does* know which mystery it is.

### 7.6 The attach picker's options go stale within a session (Peach's G4)

Recorded as expected behaviour rather than decided, because it needs no architectural choice. The picker's options are a page-load snapshot from `getAll()`, so an entity deleted earlier in the same session can still be offered after a `Back`. Picking it produces a membership `PUT` against a row that no longer exists, which 404s and fails the phase with its generic error band. Nothing is destroyed and nothing is silently wrong.

**§7.3 rule 2 deliberately does not cover the link path, and should not be extended to it.** A 404 on *detach* means the post-condition the user asked for already holds. A 404 on *link* means the thing being linked does not exist — the opposite of the requested post-condition. Mapping it to success would report a membership that was never created, and §5.1 has the wizard trusting exactly that answer. This is the same reasoning that rejected the blanket `DbUpdateException` catch in §9's Phase 2 gate: an honest failure beats a false success.

**Recommended cheap fix, Luigi's call per Peach:** when a `delete` disposition drains successfully, drop that id from the cached picker options as part of the same bookkeeping that already updates the baseline signal (§7.3.1). Three lines, exact, and it reuses a code path the drain needs anyway. The alternative — refetching `getAll()` on every phase entry — costs a round trip per navigation to fix a narrow case.

### 7.7 Generalising the removal machinery to a fourth collection (rev 8, for Phase 5)

Decision 15's machinery shipped in Phase 4 and generalises well, but not for free. Three things Phase 5 must get right, verified against `b47c3dc`.

**(a) `RemovalCollection` is `'locations' | 'bystanders'` today** (`mystery-create.store.ts:95`). **Both monsters and minions join it** — monsters because 5b builds monster removal with both dispositions, minions by decision 17. `'monsters'` carries both dispositions; `'minions'` carries `delete` only, because a minion has no membership to detach.

> **Decision 17 costs more than the "roughly a day" I estimated, and the extra is UI.** Luigi's finding: the minion phase's modal does not use the disposition shape at all today — it passes `verb="Remove"` and sub-resource counts in `[items]`. Joining the drain means `confirmLabel="Delete"` when the minion is persisted, and **never** a `secondaryLabel`. Rosalina is specifying it. Budget the minion modal as real UI work in 5a, not as a store change with a template following along.

**(b) `membershipPersisted()` generalises to monsters but is *misnamed* for minions.** Its implementation is "is this id in the collection's baseline" (`:1168`), which is the right question for all four. But its *meaning* differs: for locations, bystanders and monsters the baseline holds **memberships**; for minions, `existingMinionIds` holds **rows**, because a minion has no mystery membership at all (`Minion.MonsterId` is a required FK). A minion with an id and no membership is fully persisted; a location in the same position is not. Read literally, `membershipPersisted('minions', id)` would be false for every minion and decision 16 would classify all minion removals as local discards — which is wrong and would silently stop deleting minions. If minions join the type, **rename it** (`persistedForRemoval`, or similar) and document the two meanings. The predicate is right; the name is load-bearing and would mislead.

**(c) There is a silent trap in `idsToRemove`, and Phase 5 walks straight at it.** The signature is `idsToRemove(savedIds, drafts, collection?)` (`:1995`) and the `collection` parameter is **optional**. When it is omitted, the `disposed` set is built by filtering on `removal.collection === undefined`, which matches nothing — so the drain-versus-diff exclusion silently does not apply. The locations and bystanders call sites pass it (`:1830`, `:1882`). **The minion call site does not** (`:1935`), which is harmless today only because `'minions'` is not a `RemovalCollection`.

That is precisely the double-path hazard Toad's exact-call-ledger rule was written for (`.squad/decisions/inbox/toad-exact-call-ledger-over-positive-assertions.md`), and her analysis of why it is not survivable applies unchanged: *"A duplicate delete is survivable — the drain maps 404 to success. A duplicate unlink is not: the second copy comes from the diff, which is not on the drain path and has no `catchError`, so it 404s and fails the whole phase."*

**Make the parameter required as the first act of 5a**, not 5b — decision 17 puts a real `'minions'` member behind that call site immediately, so the window where the omission is harmless closes in 5a. It is a compile-time fix for a class of bug that is otherwise invisible until a fan-out an order of magnitude wider than Phase 4's produces a 404 nobody can place. Toad's rule that the ledger "is meant to carry into Phase 5" is the right call, and this is the specific thing it protects.

**(e) Harden the drain-versus-link same-row race structurally, not by discipline (rev 9).** Bowser found that `submitPhase2`'s `forkJoin` fires the drain, the diff-unlinks and the links **concurrently**, so a row that is both pending-removal and freshly-attached is a race. It is safe today only because every attach path calls `cancelPendingRemoval` first — an invariant maintained by hand at three call sites, and 5a/5b make it four and five.

Luigi's fix, which I endorse: **have `applyPendingRemovals` drop any disposition whose id is in that collection's current drafts.** Roughly three lines, it puts D9's semantics in one place instead of at every call site, and `attachMonster` forgetting the `cancelPendingRemoval` call becomes harmless rather than a race.

**Drop, not skip** — and the distinction is the whole point. A *skipped* disposition stays in `pendingRemovals` and fires on a later submit, which turns a race into a delayed-action bug that is far harder to find than the one it replaced. The invariant to state plainly: **a draft present in the roster and a disposition for that same id cannot both be live; the roster wins, and the disposition is discarded rather than deferred.**

**(d) Monster delete cascades minions — do not also record minion dispositions for them.** Decision 13 has `DELETE /api/monsters/{id}` FK-cascading its minions. If a monster's removal is drained with `action: 'delete'`, the database destroys its minions; recording separate `'minions'` dispositions for the same children would issue deletes for rows that are already gone. Harmless under §7.3 rule 2, but it is the duplicate-request sloppiness (c) exists to prevent. Removing a monster drops its minion drafts from the local roster and records **one** disposition, for the monster.

---

## 8. Risks and sharp edges

**8.1 The delete-all/recreate-all trap (§5.2, outcome ii).** The one path in this feature that can silently destroy data on a shared entity. Either fix it by making sub-resources upsert, or pin it with a named invariant and a test. Do not leave it implicit.

**8.2 Wizard revisits orphan shared entities.** Yoshi's history records that the unlink-then-recreate cycle leaves orphaned rows in the flat catalog on edit-mode revisits — pre-existing, deliberate, not introduced here. §5.1's unconditional-membership-`PUT` shape does not make it worse.

**8.3 No mid-wizard persistence.** `init()` reads the route `:id` once, with no localStorage draft; a reload mid-wizard loses `mysteryId` and can create a second unrelated Mystery. Unchanged by this work, but §7.3's deferred removals now also live in that volatile state.

**8.4 Unbounded picker option lists.** `getAll()` has no paging. Fine at current volumes, absorbed by the `searchable` custom-select for a long while. Monitor, don't pre-solve.


**8.5 Hunters are untouched.** No hunter entity gains or loses a mystery relationship here. Stated so that nobody infers otherwise from the wizard work.

**8.6 Replicating the roster replicates three shipped accessibility defects.** Rosalina's §8 identifies them in the minion roster that ships today, and the architectural point is that this feature is about to copy that roster to three more phases, so each defect multiplies by four:

1. **Focus is orphaned to `<body>` when a row is activated.** The pencil *unmounts itself* on click (it is replaced by the static `Editing` label), so a keyboard user is dropped at the top of the document at the exact moment the composer fills with their data. The fix is the idiom already shipped at `wizard-layout.ts:54-60`.
2. **Roster action buttons carry generic `title="Edit minion"`** — five identical accessible names in a five-row roster, from a fragile name source.
3. **`ConfirmDeleteModalComponent` has `role="dialog" aria-modal="true"` and nothing else** — no initial focus, no trap, no `Escape`, no focus restore, and a hardcoded `id="modal-title"`. This one is not merely replicated but *made worse* by this feature, which adds a third button and turns the dialog into a genuinely consequential three-way choice. Initial focus must land on the least destructive actionable control, never on Delete.

These are pre-existing, so nothing here is a regression — but "pre-existing" stops being a defence the moment we quadruple the surface. **§9 gives them their own phase, ahead of the replication**, rather than leaving them as a note in the UX doc for whoever gets there last. Fixing them first also means the fix ships as a standalone improvement to the minion roster that exists today.

**8.7 The wizard's client-side load fan-out is 29 calls, not 26 (rev 9).** Phase 4's `loadAttachCatalogues` added three. Luigi's framing is the one to keep: it is **three rounds**, not 29 sequential round trips — 14 parallel, then 6, then 9 — so the real exposure is the browser's six-connections-per-host limit splitting round three. **Budget it, do not pre-solve it.** Both he and Bowser flag that the proper fix is an expand-style endpoint, and nobody should take that on inside the risk-centre phase. Recorded so that a slow wizard load in 5b is recognised rather than diagnosed from scratch. F7's threshold is the trigger for revisiting.

---

## 9. Phasing

**No phase is gated on an open question any more.** Phases 1, 2 and 3 are fully independent of each other and can run in any order or in parallel; 4 depends on 3; 5 depends on 3 and 4.

Rev 3 moved two pieces of groundwork ahead of the roster replication — stable client keys (her §10.2) and the roster's accessibility defects (§8.6) — because both get four times more expensive once the pattern is copied to three more phases. Rev 4 adds the non-wizard modal sweep to that same phase, per decision 14.

Ceremony triggers per `.squad/ceremonies.md`: **design-review** (Rosalina, with Luigi + Peach) before Phases 2, 4 and 5 — her `mystery-entity-linking-ux.md` is the input to all three; **security-review** (Boo, with Bowser + Mario) before Phase 1 ships.

### Phase 0 — Decide — **complete**

Sixteen decisions recorded in §3, §3.1 and §3.2, filed to `.squad/decisions/inbox/`. No architectural question remains open (§10).

**peach:** acceptance criteria and expected behaviours are at **`docs/updates/mystery-entity-linking-acceptance.md`** — the third companion doc, and the authority on *what it must do*. Her Phase 4 review produced decisions 15 and 16 (§3.2) and the G4 behaviour note (§7.6). Read it alongside this document and Rosalina's before starting any phase.

**peach:** acceptance criteria for "connect an existing object to a mystery" on both surfaces, and for the Detach/Delete removal contract in §7.1.

### Phase 1 — The link verb (bowser, boo, toad)

Repositories: `LocationLinkedToMysteryAsync`, `BystanderLinkedToMysteryAsync`. Services: `LinkToMysteryAsync` ×3. Controllers: three `PUT` actions. No migration, no DTO change.

- **boo:** *(complete — reviewed 2026-09-19, verdict **ship as-is**; filed at `.squad/decisions/inbox/boo-mystery-entity-linking-phase1-security-review.md`).* The new routes inherit the global `RequireAuthenticatedUser` fallback policy (`Program.cs:91`). Two findings, neither blocking Phase 1: the §4.1 status-code correction, and the duplicate-key race below, which is a **Phase 2 gate**.
- **toad:** service tests beside `LocationServiceTests` / `BystanderServiceTests` / `MonsterServiceTests`: link succeeds; link is idempotent; unknown mystery → 404; unknown entity → 404; link/unlink round-trips.

Ships with no UI. Low risk, unblocked by every open question.

### Phase 2 — `MysterySelectComponent` + edit-form linking, Locations & Bystanders (rosalina → luigi, toad)

> **Gate — CLOSED 2026-09-19 (bowser).** Implemented as specified below. `dotnet test` 524 → 530, 0 failing.
>
> **One correction to this plan, found during implementation.** Toad's `InsertingABridgeRowForADeletedMystery_ThrowsOnTheForeignKey` does **not** guard against the blanket-catch alternative, though it was written expecting to: it calls the raw `Link…ToMysteryAsync` + `SaveChangesAsync`, which the guard never wraps, so it still passes green with a blanket `catch (DbUpdateException) { }` in place. It was kept — it pins the premise that the SQLite fixture really enforces foreign keys — and the tests that actually refute the alternative stage the deletion *first* and then call the guarded method: `LinkAndSave_ForAMysteryDeletedConcurrently_Rethrows` and `LinkAndSave_ForALocationDeletedConcurrently_Rethrows`. Both rejected alternatives were bite-checked in a scratchpad copy, and each is now refuted by distinct named tests. The renamed duplicate test is `ConcurrentDuplicateInsert_ReportsSuccess_AndLeavesExactlyOneRow`.
>
> **Two implementation calls worth carrying forward.** The add-only `Link…ToMysteryAsync` was *kept* alongside the new guarded method: the create-in-a-mystery path (`POST /api/mysteries/{id}/locations`) stages its bridge row beside the entity's own insert and must not save early, so only the link verb moved. And the detach happens on **both** the success and the rethrow path, before the re-check — the abandoned-insert hazard is identical either way.
>
> *Original gate, recorded for the reasoning.* The duplicate-key race on the membership composite PK, carried over from Phase 1. Boo's verdict: acceptable to ship in Phase 1 because Phase 1 has **no client and cannot reach it**; not acceptable once Phase 2 puts one in front of it. Two concurrent `PUT`s for the same membership both pass the `…LinkedToMysteryAsync` check, both insert, and the loser gets a 500.
>
> **Fix, as Boo specified it — and the two obvious implementations are both worse than the current 500, so take this one:**
>
> - **Not** a blanket `catch (DbUpdateException) { return true; }`. That also swallows a **second, separate TOCTOU in the same method**: the existence checks pass, the mystery or the entity is deleted concurrently, and the insert then fails on the **foreign key**, not the primary key. That path would return 204 for a membership that does not exist — and §5.1 has the wizard trusting exactly that answer. A 500 is an honest failure; a false 204 is a silent lie the client builds on.
> - **Not** a `PostgresException { SqlState: "23505" }` filter. Correct in production, but untestable here: the repository fixture runs in-memory SQLite and throws `SqliteException`, so the filter would never be exercised by a test.
> - **Do this:** in the repository, behind a single insert-and-save method, catch `DbUpdateException` and **re-check `…LinkedToMysteryAsync`**. Row now present → the concurrent insert won, and 204 is truthful. Row absent → **rethrow**, because it was not a duplicate. Detach the `Added` entry before returning, so the abandoned insert cannot be retried by a later `SaveChanges` in the same request.
>
> This discriminates on whether the membership actually ended up existing rather than on a vendor error code, which is why it is both provider-agnostic and exercisable under the existing SQLite fixture. Note that it makes `LocationLinkedToMysteryAsync` / `BystanderLinkedToMysteryAsync` — added in Phase 1 for the idempotency check — load-bearing for correctness too.
>
> **toad:** concurrent double-link returns 204 twice and leaves exactly one row; a link whose mystery is deleted concurrently still fails rather than reporting success. *Both are now covered at the repository level by Bowser's tests. Still outstanding for Toad: a genuinely concurrent HTTP pair — `MysteryLinkEndpointTests` exercises sequential idempotency end to end through the real repositories, but not two simultaneous `PUT`s.*

- **rosalina:** picker spec and its placement — her §9.1 puts it inside the form as its last field, replacing today's bolted-on external `mysteryControl`. No warning copy (decision 4); no chip links (§4.4).
- **luigi:** build `shared/mystery-select.component.ts`; wire into `LocationFormComponent` and `BystanderFormComponent`; change both `save` payloads to the `…FormSubmit` wrapper; update four call sites; create pages collapse to `createStandalone` + membership `PUT`s and lose their bespoke `mysteryControl`; detail pages load `getMysteries()`.
- **toad:** membership add / remove / both-in-one-save; survives reload; create path with zero, one and two mysteries selected.

Monsters excluded — §6.2. Unblocked by every open question.

### Phase 3 — The modal, hardened and swept (luigi, toad) — **enlarged in rev 4 by decision 14**

Rev 3 scoped this as "make the shipped roster pattern fit to be copied." Decision 14 adds the non-wizard sweep, which belongs here rather than at the end: it is modal work, it lands where the modal is already being hardened, and it puts disclosure on the app's highest-consequence delete early instead of last. Everything here gets four times more expensive if it lands after Phases 4 and 5.

- **luigi, foundations:** a stable per-draft client key assigned at creation and hydration, replacing `track $index` in the minion roster and becoming `editingDraftKey` (her §10.2 — `track $index` is used at `mystery-create-monster-phase.html:150` and in every sub-resource list, and is also the root of the documented index-shift hazard at `mystery-create.store.ts:1116-1122`); the three §8.6 accessibility fixes — focus move on composer activation via the `wizard-layout.ts:54-60` idiom, entity-bearing `aria-label`s on the roster action buttons, and real dialog behaviour on `ConfirmDeleteModalComponent` (initial focus on the least destructive control, trap, `Escape`, focus restore, unique title id); and the modal's optional secondary action, which all twelve existing call sites leave null.
- **luigi, sweep (§7.4):** `locations-list`, `bystanders-list` and `monsters-list` gain `getMysteries()` and populate `[items]` with the affected mystery names; `monsters-list` merges them with the minion list it already assembles. `minions-list` is unchanged. **No Detach button on any of them — see §7.5.**
- **luigi, `CustomSelectComponent` (her OQ8, decided in scope):** `Escape` closes the panel and restores focus to the trigger. This is pre-existing breakage, and it is **explicitly in scope — do not drop it as out-of-scope during implementation.** Skyler ruled on it directly. The justification is that this feature makes that control the sole entry point to a whole new capability (the attach picker and the mystery multi-select both run through it), so its keyboard trap stops being incidental. The *rest* of its ARIA problems — `role="listbox"` over children that are not `role="option"`, no `aria-activedescendant`, no arrow-key navigation — are **not** in scope and are logged in §12.
- **toad:** keyboard-only traversal of the minion roster end to end; screen-reader pass on the roster and the modal; **`Escape` from an open `CustomSelectComponent` panel returns focus to the trigger, verified on every surface that uses it, not just the new ones**; confirm none of the twelve existing `ConfirmDeleteModalComponent` call sites changed behaviour; confirm the three swept pages name every affected mystery.

Independently shippable, and **parallel to Phase 4 rather than gating it** — the sweep shares the modal with the wizard work but nothing else. Blocked by nothing.

### Phase 4 — Wizard: attach, re-edit, and removal, Locations & Bystanders (rosalina → luigi, toad)

Implements decisions 10, 11, 12, 15 and 16. Depends on Phase 3's modal. Acceptance criteria in Peach's doc.

- **rosalina:** attach affordance, re-edit affordance, and the Detach/Delete modal variants — all in `mystery-entity-linking-ux.md`. Note the new middle row in §7.1 needs copy she has not written yet.
- **luigi:** unconditional membership `PUT` in `submitPhase2`/`submitPhase3` (§5.1); roster + composer generalised from the minion shape to both phases, including `commitComposerIfValid` (§5.3); `mysteryIds` retained through hydration and carried onto drafts (§7.2, her §10.3); attach control excluding already-listed entities.
- **luigi — the three things most likely to be got wrong, all new in rev 7:**
  1. **`pendingRemovals` is wizard-scoped, not per-phase, and every `submitPhaseN` drains all of it** (§7.3.1, decision 15). Scoping it to a phase is the natural implementation and it reintroduces G1.
  2. **When a drained removal is applied, drop its id from the owning collection's baseline signal** (`existingLocationIds` and siblings) — and, if you take §7.6's cheap fix, from the cached picker options too. Same bookkeeping step, two consumers.
  3. **The removal variant keys on the baseline, not on `id`** (§7.1, decision 16). `id !== null` is the intuitive predicate and it is the wrong one: it offers **Delete** for an entity the user attached by mistake ten seconds ago.
- **toad:** load-bearing regressions are **"attach an existing location, press Next, confirm it is now linked"** and **"…confirm its own fields are unchanged if untouched."** Plus the two new gap tests: **G1 — edit a mystery, trash a location, confirm Delete, jump to Bystanders via the tracker, Finish, confirm the location is actually deleted**; and **G3 — attach an existing location, trash it before pressing Next, confirm no Delete button is offered and the catalogue entity survives.** Plus: re-edit a hydrated draft; Detach offered whenever `id` is in the baseline; Delete removes it from all mysteries; remove-then-re-attach cancels the pending removal; abandoning the wizard still applies nothing; and §7.6's stale-picker case failing loudly rather than silently.

### Phase 5 — **split in rev 8 into 5a then 5b, in that order**

> **This is the change Bowser and Luigi most need to read.** Rev 7 had Phase 5 as one block doing seven service methods, a monster roster, sub-resource upsert, a dirty check, `monsterKey` resolution, `RemovalCollection` growth, the `monsters[0]` fix and monster edit-form linking — on a feature branch, in the most entangled state in the app, against a fan-out an order of magnitude wider than Phase 4's. It is too much to review in one piece, and the pieces have a **dependency direction** that rev 7 did not exploit.

**The ordering argument.** §5.2's worked example is the whole reason decision 8 exists: under today's delete-all/recreate-all, attaching an existing monster and pressing Next re-keys its entire sub-resource subtree, and the natural-looking variant of that implementation strips it bare in every mystery. **So the roster cannot safely ship attach-an-existing-monster on top of the current sub-resource layer.** Put the safety fix first, on the simple single-monster structure that exists today, and build the roster on ground that is already safe. That is exactly the "foundations before replication" sequencing that made Phase 3 work, applied one level down.

#### Phase 5a — Sub-resource upsert, the dirty check, and minions in the drain (bowser/luigi, toad)

Implements decisions 8, 9, 17 and 18. **No roster.** The monster phase keeps its single-monster shape throughout; only the sub-resource layer and the minion removal path change.

> **Sizing, corrected in rev 9: 5a is ≈ Phase 4, not half of it.** Luigi's calibration, and he is right — eight draft arrays gaining `id` and `localKey`, eight baselines retyped, eight `track $index` loops and their index-based removals, two diff implementations, a weapon-tag sub-diff for two owners, the dirty check, the minion modal's disposition shape, and heavy spec churn. Nothing about "5a is the foundations half" should be read as "5a is the small half."

- **bowser:** the re-parent verb `PUT /api/monsters/{monsterId}/minions/{minionId}` (decision 18, §6.4). The only backend work in Phase 5.
- **bowser/luigi:** five `MonsterService` methods — `updateAttack`, `updatePower`, `updateArmor`, `updateWeakness`, `removeAttackWeaponTag` (§5.2). No backend work; those PUTs shipped long ago.
- **luigi, the sub-resource layer:** `AttackDraft` / `PowerDraft` / `WeaknessDraft` / `ArmorDraft` gain `id: string | null` **and `localKey`** (§5.4); `existing*Ids: string[]` become `existing*: <Response>[]` on `MinionDraft` and in the store (§5.4); `saveThreatCollections` and `saveMinionCollections` become diffs; the weapon-tag assign/remove diff; the derived per-row dirty check; the eight `track $index` loops move to `localKey` and their index-based removals become filters.
- **luigi, and this one is a requirement rather than a style note:** **the sub-resource diff must be a parameterised function over a small service adapter**, not inlined against `store.monsterAttacks()` and siblings. 5a writes it twice anyway — monster and minion — so the generic pays for itself inside 5a without appealing to 5b. And if it is inlined, 5b relocates the state it reads onto `MonsterDraft` and the whole thing is rewritten in the riskiest phase.
- **luigi, ordering within the phase:** **first act is making `idsToRemove`'s `collection` parameter required** (§7.7c) — decision 17 puts a real `'minions'` member behind that call site, so the window where omitting it is harmless closes here. Then `'minions'` joins `RemovalCollection`, the minion removal path moves onto `pendingRemovals`, and `membershipPersisted` is renamed (§7.7b).
- **luigi, the minion modal:** `confirmLabel="Delete"` when persisted, never a `secondaryLabel` (§7.7a). Rosalina is specifying it.
- **luigi, the race:** `applyPendingRemovals` drops dispositions whose id is in the current drafts (§7.7e).
- **luigi, `draftState`:** delete it, or wire it to F4. Do not grow it (§5.5).
- **toad:** carry the exact-call-ledger rule in — this is the phase it was written for. The load-bearing assertion is that a submit with **nothing edited issues no sub-resource writes at all**, which is both decision 9's whole point and the cheapest possible proof that the recreate-all is gone. Expect the existing Phase 1 ledgers to churn heavily; that churn is the feature.
  - **An expectation deliberately inverts here, and it will look like a contradiction if it isn't flagged.** Rosalina's §10.1 warns that in Phase 4 a no-op `PUT` of identical values is *expected and correct*, and that "confirm its own fields are unchanged if untouched" sits one paraphrase away from "confirm no `PUT` is issued" — which would wrongly red-flag a correct Phase 4 implementation. She is right about Phase 4. **5a is the phase where that flips**, because 5a is where the dirty check lands. After 5a, "no writes when nothing changed" is the assertion; before it, it is a false failure. The Location and Bystander paths keep Phase 4's behaviour either way — decision 9 is monsters-and-minions only (§5.4).

Ships independently and improves behaviour that is live today: sub-resources stop re-keying on every Next, whether or not anyone ever attaches a monster.

#### Phase 5b — The monster roster (rosalina → luigi, toad) — highest risk

Implements decisions 2, 13 and 19. Feature branch, per the precedent for wizard-touching work. Template work is a lift from the shipped minion roster (§6.1); the store work is not, which is why this stays the risk centre.

> **Sizing: 5b is larger than Phase 4.** Luigi's calibration. The roster is a lift; `submitPhase1`, the `monsterKey` resolution, decision 19's validation and completeness changes, and the dossier's roster rendering are not.

- **luigi, before the monster composer exists:** rename the four unprefixed composer signals — `composerOpen`, `composerDirty`, `composerValid`, `editingDraftKey` — to `minion…`. They are the minion composer's, and they read as the store's only composer right up until 5b adds a second one. Four files, mechanical, and it is not currently in anyone's estimate.
- **luigi, sweep:** `mystery-create-dossier.html:232,248` still `track $index` for locations and bystanders, which have carried `localKey` since Phase 4.
- **luigi, decision 19 (§6.5):** drop `validateCurrentStep`'s phase-1/step-0 branch; make `submitPhase1` a drain-and-advance on an empty roster without synthesising a monster; let `init()`'s `[true, true, true, true]` stand in edit mode instead of `loadEditData` recomputing from data presence; replace or retire `monsterPreview()`; give the dossier's roster rendering an empty state.

- **luigi, client gap:** `MonsterService.linkToMystery` and `unlinkFromMystery` — **absent today, and not in rev 7's list** (§5.2). Nothing is needed on the backend.
- **luigi:** `MonsterDraft` + roster (§6.1), using the shipped `createDraftKey('monster')` (§6.3); `existingMonsterIds` as the roster baseline; `'monsters'` added to `RemovalCollection`, with `membershipPersisted` renamed if §10's question goes the way I recommend (§7.7b); `MinionDraft.monsterKey` + the monster picker (§6.4); `loadEditData` past `monsters[0]` (`:925`); `submitPhase1` rewritten as roster diff → sub-resource diff → minion diff; monster linking in `MonsterFormComponent` (§6.2).
- **toad:** hardest cases — **attach an existing monster with 3 attacks and 2 minions into a mystery that already has a monster, press Next, and confirm not one sub-resource was deleted or re-keyed** (5a is what makes this passable); delete a monster and confirm its minions are listed in the modal and cascade *without a second delete being issued for them* (§7.7d); detach the same monster and confirm its minions survive; and the G1 case on the monster roster — trash a monster, confirm Delete, jump via the tracker, Finish.
- **peach:** her acceptance doc is scoped "out of scope for Phase 4" (§6 there) and does not cover the roster. **Phase 5b needs its own acceptance pass** before Luigi starts, on the same three-doc split.
- **rosalina:** §5 of her doc already specifies the monster roster. Per Skyler's waiver (`cb1eae3`), her §8 items 2 and 3 stay follow-ups — **Phase 5 must not re-raise the screen-reader announcement as a blocker.**

> **Phase 5b is the final implementation phase.** Rev 4 had a "Phase 6 — Follow-ups" that was a deferred-work bucket wearing a phase's clothes; rev 5 dissolved it into §12. Nothing was dropped — every item moved.

### Phase 6 — Retrospective (koopa)

The wizard store has now been extended five times. Worth asking whether phase-transition submission is still the right backbone or is accumulating special cases.

---

## 10. Open questions

**None.** Nineteen decisions across four rounds (§3, §3.1, §3.2, §3.3). The three questions the pre-Phase-5 review raised were answered on 2026-09-20 and are decisions 17, 18 and 19.

The question below is kept for its reasoning, which is still the argument for decision 17.

---

### Answered as decision 17 — minions and the removal drain

**Decision 15 closed the silent-discard hole for locations and bystanders. The identical hole is open for minions today, and nobody has noticed because minions were never in scope for the drain.**

Repro, against `b47c3dc`: edit a mystery → Monsters → Minions → trash a minion → confirm **Delete** → the card vanishes → click the Locations bubble in the tracker → **Finish**. Phase 1 never submits, `saveMinionDrafts` never runs its `idsToRemove` diff (`:1935`), and the minion is still there. That is Peach's G1 exactly, on a confirmed destructive action, one step away from the two phases where it was just fixed.

Monsters are not in question — Phase 5b builds monster removal with both dispositions, so decision 15 applies and `'monsters'` joins `RemovalCollection` regardless. **The question is whether minions join it too.**

- **Bring them in (recommended).** Adds `'minions'` to `RemovalCollection` with a delete-only disposition, routes minion removal through `pendingRemovals`, requires the `idsToRemove` fix at `:1935` (§7.7c) and the `membershipPersisted` rename (§7.7b). Roughly a day with tests. Closes the hole and makes all four collections behave identically.
- **Leave them.** Phase 5b is smaller. But it ships a wizard where trashing a **monster** survives a tracker jump and trashing a **minion** does not — on adjacent steps of the same phase, with the same modal, in the same session. That is a hard inconsistency to explain to a user who hits it, and a hard one to remember when someone next edits this file.

**Why this was his rather than mine:** it is a scope call on pre-existing behaviour, and he has taken every one of those. **Answered: bring them in** (decision 17). The cost was higher than I estimated — the minion modal needs real UI work, not just store plumbing (§7.7a) — and the work moved into 5a, where the `idsToRemove` fix it depends on now also lands.

### Everything else

**Nothing, in any of the three documents.**

Three rounds, all on 2026-09-19: seven questions answered in §3, seven follow-ups in §3.1, and Rosalina's remaining six answered against her doc. Three more were resolved between her and me without troubling Skyler — chip links on the edit form (§4.4), whether `origin` / `edited` draft state is needed (§5.4 — neither; derive it), and where the accessibility and stable-key work sits (§9).

Of her six, two reach this document and are folded in: **OQ8** (`CustomSelectComponent` gets `Escape`-closes-and-restores-focus, explicitly in Phase 3's scope — §9) and **OQ10** (the mystery-detail remove affordance is punted, with §12 as its durable home). **OQ2** was the only interaction answer that could have reached the store, and §5.5 records that it does not change submit timing, the diff, or `commitComposerIfValid` — only composer-open state and the shape of one serialisable block. OQ3, OQ4 and OQ5 are purely visual and touch nothing here.

**One thing was resolved by construction rather than asked, and is flagged in case Skyler reads it differently: §7.5.** Decision 14 extends the Detach / Delete modal to the non-wizard pages, but Detach needs a mystery to detach *from* and none of those pages has one. So outside the wizard the modal is Delete-only and the sweep delivers disclosure — the `[items]` list and the mystery names — rather than a Detach button. Only one answer is coherent given the route structure, which is why it is a consequence rather than a question, but it does narrow decision 14's plain reading. Her OQ10, now punted, is the item that would resolve it properly (§12, F1).


---

## 11. Files this touches (estimate)

**Phase 1 — backend:** `Repositories/I{Location,Bystander}Repository.cs` + impls; `Services/I{Monster,Location,Bystander}Service.cs` + impls; `Controllers/{Monsters,Locations,Bystanders}Controller.cs`; `Tests/Services/{Monster,Location,Bystander}ServiceTests.cs`. No migration, no `ApiContracts.cs` change.

**Phase 2 — frontend:** new `shared/mystery-select.component.ts`/`.html`; `core/{monster,location,bystander}.ts` gain `linkToMystery`; `{location,bystander}-form.ts`/`.html` + specs; `{location,bystander}-detail.ts`/`.html`; `{location,bystander}-create.ts`/`.html`.

**Phase 3 — frontend (foundations + sweep):** `shared/confirm-delete-modal.component.ts`/`.html` + spec (dialog behaviour, unique title id, optional secondary action); `mystery-create.store.ts` (stable draft key, `editingDraftKey` replacing `editingDraftIndex`, `removeMinionDraft` index-shift fix) + spec; `mystery-create-monster-phase.html`/`.ts` (`track` by key, `aria-label`s, focus move on composer activation); and for the sweep, `{locations,bystanders,monsters}-list.ts`/`.html` + specs (`getMysteries()`, populated `[items]`).

**Phase 4 — frontend:** `mystery-create.store.ts` (`submitPhase2`/`submitPhase3`, roster + composer state for two more entity types, `pendingRemovals`, hydration keeps `mysteryIds`, reference load gains `getMysteries()`) + spec; `mystery-create-{locations,bystanders}-phase.html`/`.ts`.

**Phase 5a — backend:** `Controllers/MinionsController.cs`, `Services/IMinionService.cs` + impl, `Repositories/IMinionRepository.cs` + impl, `Tests/Services/MinionServiceTests.cs` — the re-parent verb (decision 18). No migration.

**Phase 5a — frontend:** `core/monster.ts` (five sub-resource updaters); `core/minion.ts` (`reparent`); `mystery-create.store.ts` (the four sub-resource draft interfaces gain `id` + `localKey`; all eight `existing*Ids` → `existing*` responses; `saveThreatCollections`, `saveMinionCollections`, `saveMinionDrafts`; the parameterised diff + service adapter; `idsToRemove`'s `collection` becomes required; `'minions'` joins `RemovalCollection`; `membershipPersisted` renamed; `applyPendingRemovals` drops live-draft dispositions; `draftState` deleted or wired to F4) + spec; `mystery-create-monster-phase.html`/`.ts` (eight `track $index` → `localKey`, index-removals → filters, the minion modal's disposition shape); `mystery-create-dossier.html` (six sub-resource `track $index`); the Phase 1 and Phase 4 ledger specs churn.

**Phase 5b — frontend:** `core/monster.ts` (`linkToMystery`, `unlinkFromMystery`); `mystery-create.store.ts` (`MonsterDraft` + its four response baselines, `existingMonsterIds`, `'monsters'` in `RemovalCollection` + `removalRequest`, `MinionDraft.monsterKey`, `loadEditData` past `monsters[0]`, `submitPhase1`, `validateCurrentStep`, `phaseComplete` in edit mode, `monsterPreview` retired, the four `minion…` composer-signal renames) + spec; `mystery-create-monster-phase.html`/`.ts`; `mystery-create-dossier.html` (roster rendering + empty state; locations/bystanders `track $index` sweep); `monster-form`/`monster-detail`/`monster-create`.

Phase 3 also touches `shared/custom-select.component.ts`/`.html` + spec (`Escape` closes and restores focus, her OQ8).

---

## 12. Post-implementation follow-ups

Work deliberately deferred during design, collected here at Skyler's instruction (his answer to Rosalina's OQ10: *"Make note of it for things to follow up on after the final phase"*). **The final implementation phase is Phase 5.** Nothing in this list blocks any phase, and nothing in it has been agreed — it is a parking lot with reasons attached, not a backlog.

Rosalina's `mystery-entity-linking-ux.md` carries a matching section. **Ownership rule, agreed between us: architecture, API and data-shape items live here; interaction and visual items live in hers. Each document lists the other's items by title with a pointer, and neither restates the other's reasoning.**

### Owned by this document

| # | Item | Why it was deferred, and what it needs |
|---|---|---|
| **F1** | **Remove (Detach / Delete) affordance on the mystery detail page's asset lists** | Her OQ10, punted by Skyler. This is the item that closes §7.5's gap: `/mysteries/:id` is the **only** non-wizard surface that knows which mystery it is, so it is the only place Detach can ever be meaningful outside the wizard. Needs `MysteryDetailResponse` to carry ID lists instead of `MonsterCount` / `LocationCount` / `BystanderCount` (`ApiContracts.cs:43`), or the page to keep deriving rosters from the three `GET /api/mysteries/{id}/…` calls it already makes. Pairs naturally with F2 — do them together or the page grows an attach affordance with no matching detach. |
| **F2** | **Attach an existing entity from the mystery detail page** | Arguably the most natural home for the whole feature, and left out only because Skyler asked for the edit forms and the wizard. Same DTO question as F1. |
| **F3** | **"Attach a copy"** | Copy-on-attach semantics (Option C in rev 1's §3) offered *alongside* Attach rather than instead of it. Decision 1 (shared M:N reuse) deliberately keeps this reachable: under shared reuse it is one `POST` that duplicates a row plus a membership `PUT`. Worth revisiting if Skyler ever finds himself wanting a monster "like that one, but for this mystery." |
| **F4** | **Mid-wizard draft persistence** | §8.3. `init()` reads the route `:id` once with no localStorage draft, so a reload mid-wizard loses `mysteryId` and can create a second unrelated Mystery. Pre-existing and unchanged by this work, but the `pendingRemovals` dispositions (§7.3) now also live in that volatile state, which raises the cost of a lost session. |
| **F5** | **Orphaned rows on wizard revisits** | §8.2. The unlink-then-recreate cycle leaves orphans in the flat catalog on edit-mode revisits. Pre-existing and deliberate; decision 8's upsert conversion shrinks the blast radius but does not eliminate it. |
| **F6** | **Retire the scoped create endpoints** | After decision 3 the create pages no longer call `POST /api/mysteries/{id}/{locations,bystanders,monsters}`; only the wizard does. If Phase 4 moves the wizard to `createStandalone` + membership `PUT` as well, three endpoints become dead and could be removed. Deliberately *not* done inside this work — deleting endpoints while three phases are still landing on them is how you get a bad week. |
| **F7** | **Revisit the picker when catalog volumes grow** | §8.4. `getAll()` is unpaged and every picker in this design loads the full catalog. Fine now; the searchable select absorbs a lot. **This is the trigger condition for her browse-panel item (below) — same threshold, two responses:** paging is mine, the richer browse UI is hers. Whoever hits it first should ping the other. |
| **F8** | **Two-sided authorization for `LinkToMysteryAsync`, if per-user ownership ever lands** | From Boo's Phase 1 review. **Not a current defect** — there is no per-user ownership model, and that is a deliberate, documented exclusion (`docs/simple-authentication-update/architecture.md:601`: "No per-user data ownership. No `owner_id`, no `ICurrentUser`… explicitly out of scope"). The point is structural: `LinkToMysteryAsync` is **the first write verb in this codebase that joins two objects.** Every other write touches one, so every service's guard idiom is a one-object check — and that idiom will silently under-check here. A user permitted to edit mystery A but not monster B could link B into A, or the reverse, and a copy-pasted single-object guard would pass. Whoever implements ownership needs to know this verb wants the mystery **and** the entity checked. Recorded so it is not rediscovered by an audit. |
| **F9** | **An edit-mode tracker jump still discards unsubmitted field edits** | The other half of Peach's G1. Decision 15 makes confirmed *removals* survive a tracker jump; typed-but-unsubmitted field edits and newly authored drafts in the phase being left are still lost, exactly as they are today. Pre-existing, unchanged by this work, and deliberately left — see §7.3.1 for why the asymmetry is defensible (a removal was confirmed through a modal that promised it would happen; a half-typed location made no such promise). The real fixes are submit-on-jump — which needs `advancePhase` (`mystery-create.store.ts:1633`) to land on an arbitrary target rather than `phase + 1` — or a dirty-check guard on `jumpToPhase`. Both are navigation-core surgery and neither belongs inside this feature. Worth pairing with F4, since mid-wizard persistence addresses the same class of loss. |

### Owned by `mystery-entity-linking-ux.md`

Listed by title only; see her follow-ups section for the reasoning.

- **Remaining `CustomSelectComponent` ARIA work** — `role="listbox"` over children that are not `role="option"`, no `aria-activedescendant`, no arrow-key navigation. Only the `Escape` half of her OQ8 is in Phase 3; this is the rest. Flagged here because it is a shared component this feature leans on heavily, but the spec is hers.
- **Browse panel instead of a select** for attach, at higher catalog volumes — her §11. Paired with F7 above.
- **Read-only "Appears in: …" line** on entity detail pages — her §9.3, the safe alternative to the chip links both of us rejected (§4.4). Now has `hunterDraftGuard` as a shipped guard pattern to copy if it ever needs one.
- **Roster card and composer shell as literal shared Angular components** rather than four agreed copies — her OQ9, which she scoped as Luigi's call at build time rather than a design decision. If it goes the "four copies" way, this is where the consistency debt gets logged.
