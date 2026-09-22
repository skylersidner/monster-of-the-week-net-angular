# Mystery Entity Linking — Phase 5 Acceptance Criteria (5a and 5b)

**Prepared by:** Peach (Product Owner / Business Analyst)
**Status:** **Phase 5 criteria, for the pre-5a design review.** Six findings, all routed (§9). None blocks writing the tests for everything else.
**Date:** 2026-09-20

> Sibling to `docs/updates/mystery-entity-linking-acceptance.md`, which is Phase-4-scoped and stays that way. **Three reasons it is a sibling and not an extension:** 5a and 5b land separately and each must be judgeable on its own when it lands; the Phase 4 doc is now cited by architecture §3.2 as the origin of decisions 15 and 16, so it is a record as much as a checklist; and a second acceptance artifact keeps the three-voice ownership rule intact rather than adding a fourth. The Phase 4 doc's §6 line "monsters and minions — Phase 5" is discharged here.
>
> **Ownership, unchanged.** What the software must do to be accepted is mine; how it does it is `mystery-entity-linking.md` (Yoshi); how it looks and reads is `mystery-entity-linking-ux.md` (Rosalina). This document cites both and restates neither.

---

## 1. Scope, and what is already covered

**5a — sub-resource upsert, the derived dirty check, minions in the drain, the re-parent verb.** No roster; the monster phase keeps its single-monster shape. Implements decisions 8, 9, 17, 18.

**5b — the monster roster on top, monster linking, the minion monster-picker, and a monster becoming optional.** Implements decisions 2, 13, 19.

**Already shipped and tested — do not restate.**

| Shipped | What it already covers for Phase 5 |
|---|---|
| Phase 1 | The link verb for **all three** collections, monsters included, on the backend. `MonstersController`'s `PUT` and `DELETE` are green. 5b needs **no backend work and no new endpoint tests for monster linking** — the gap is two missing client methods in `core/monster.ts` (architecture §5.2). |
| Phase 3 | `ConfirmDeleteModalComponent`'s whole input contract — `usage`/`usageMessage`, unconditional `footnote` defaulting to `''`, `secondaryLabel` + `(secondary)`, asserted block order, initial focus on the least destructive control, `Escape`, focus restore. 5a and 5b choose bindings; they do not re-prove the modal. |
| Phase 4 | Attach, re-edit and the removal contract **as behaviours**, for two collections: AC-A1–A9, R1–R5, D1–D13 in the Phase 4 doc. Plus the `pendingRemovals` machinery, decision 15's wizard-scoped drain and decision 16's baseline predicate. **5b inherits all of it with the noun substituted**, so §4 below states only what is monster-specific and cites the Phase 4 id for the rest. |

The one genuinely new backend surface in Phase 5 is the re-parent verb (decision 18), and it gets its own criteria in §3.4.

---

## 2. The stories

**US-4 (5a).** *As a Keeper, I want the wizard to leave alone the parts of a monster or minion I didn't touch, so pressing Next doesn't quietly rewrite work I already did.*

**US-5 (5a).** *As a Keeper who has deleted a minion, I want that deletion to actually happen, however I leave the step.*

**US-6 (5b).** *As a Keeper, I want a mystery to be able to have several monsters, or none at all, because not every threat is a creature and some cases have more than one.*

**US-7 (5b).** *As a Keeper, I want to pull an existing monster into a mystery and have it arrive whole — its attacks, its powers, its minions — and leave whole.*

---

## 3. Phase 5a

### 3.1 Sub-resource upsert — the safety criteria

| # | Criterion |
|---|---|
| **5a-U1** | **Ids survive a phase transition.** Record the ids of a monster's attacks, powers, armors and weaknesses; press Next with nothing edited; re-read them. **Every id is unchanged.** This is the cheapest proof that delete-all/recreate-all is gone, it needs no request ledger, and it fails loudly on the most likely wrong implementation (see §9, H2). Run the same assertion for a minion's four collections. |
| **5a-U2** | **A submit with nothing edited issues no sub-resource writes at all** — no creates, no updates, no deletes, for either the monster or any minion. Yoshi's ledger assertion, and decision 9's whole point. |
| **5a-U3** | **Edit one attack's name and submit → exactly one write.** One `PUT` for that attack; nothing issued for the other attacks, for the powers, armors or weaknesses, or for the monster's minions. Per-row, not per-entity (architecture §5.4). |
| **5a-U4** | **Rename the monster and submit → the monster is written and its eight sub-resource collections are not.** The inverse of 5a-U3, and the case a per-entity dirty flag would get wrong. |
| **5a-U5** | **Add one attack → one create, nothing else. Remove one attack → one delete, nothing else.** The remaining three rows keep their ids. |
| **5a-U6** | **Edit a field and change it back, then submit → no write.** A derived baseline comparison gets this for free; a stored `edited` flag does not. This is the criterion that distinguishes the two mechanisms from the outside. |
| **5a-U7** | **Cancel a composer edit → no write.** Same distinction, via the other route architecture §5.4 names. |
| **5a-U8** | **Weapon tags diff.** Add a tag to an existing attack → one assign, no delete. Remove one → one remove, no assign. Leave them alone while editing the attack's name → neither. Today's path is assign-only, so "remove a tag and submit" is the regression that proves the diff exists. |
| **5a-U9** | **Two consecutive submits with nothing edited are identical and both no-ops.** Press Next, Back, Next. The second transition writes nothing and rotates no ids. This is the case that catches a baseline refreshed into a shape the drafts can no longer match (§9, H2) — it is reachable in **create mode**, with no edit mode and no attach in the story, so test it there. |

> **Expectation inversion, flagged because it will read as a contradiction.** In Phase 4, a no-op `PUT` of identical values is *expected and correct*, and the Phase 4 doc's AC-A6 says to assert the values rather than the absence of a request. **5a is where that flips for monsters and minions.** After 5a, "no writes when nothing changed" is the assertion. **Locations and Bystanders keep Phase 4's behaviour** — decision 9 is monsters-and-minions only — so AC-A6 stands unchanged for them and 5a must not "fix" it.

### 3.2 Hydration — the invariant, stated as an acceptance criterion

| # | Criterion |
|---|---|
| **5a-H1** | **The ID baseline and the drafts' ids are two halves of one fact.** For every path that populates a sub-resource baseline — edit-mode load, a successful phase-1 submit, and (in 5b) attach — the drafts produced by that same path carry the matching ids. The observable form: **after any of those paths, 5a-U1 and 5a-U2 hold.** Assert it at each entry point separately; a pass at one says nothing about the others, which is the entire history of this bug in this file. |
| **5a-H2** | **Applies to minions, not only monsters.** `loadEditData` fills each `MinionDraft`'s four `existing*Ids` while building that draft's four sub-resource arrays without ids, exactly as it does for the monster. The minion path is **not** the safe model here (§9, H1). Run 5a-U1 and 5a-U2 against a hydrated minion's attacks as a distinct case. |

### 3.3 Minions join the disposition drain (decision 17)

| # | Criterion |
|---|---|
| **5a-M1** | **The G1 sequence, on the minion roster.** Edit a mystery → Monsters → Minions → trash a persisted minion → confirm **Delete** → the card disappears → click the **Locations** bubble in the tracker → **Finish**. The minion is gone. This is the exact repro in architecture §10 and it is the reason decision 17 exists. |
| **5a-M2** | **Delete-only.** The minion modal offers `Cancel · Delete` and **never** a Detach. No `secondaryLabel` is bound on this call site under any draft state (UX §16.4). |
| **5a-M3** | **The predicate is `id !== null`, and that is correct here for the reason it was wrong elsewhere.** An unsaved minion gets a local discard with no API call; a persisted one records a `delete` disposition. Minions are never attached — there is no attach strip on the minion step — so `id` can only become non-null by being saved (UX §16.4). A test that a persisted minion dropped from the roster **is** recorded for deletion is the guard against the `membershipPersisted` misreading, which would silently stop deleting minions altogether. |
| **5a-M4** | **Deferral, same as every other collection.** Confirming removes the card and issues no request; abandoning the wizard applies nothing; re-adding is not possible (no attach), so the remove-then-re-attach pair does not arise for minions. |
| **5a-M5** | **No duplicate delete.** A confirmed minion deletion produces **one** `DELETE`, not one from the drain and a second from `saveMinionDrafts`'s own diff. This is the §7.7c hazard — the `idsToRemove` call at the minion site omits the `collection` argument today, so the drain-versus-diff exclusion silently does not apply. Toad's exact-call ledger is the oracle; a positive "it was deleted" assertion passes either way. |
| **5a-M6** | **The `collection` parameter is required.** Stated as an acceptance criterion because it is a compile-time guarantee standing in for a class of runtime bug: after 5a there is no call site of `idsToRemove` that omits it, and omitting it does not compile. |

### 3.4 The re-parent verb (decision 18) — new backend surface

| # | Criterion |
|---|---|
| **5a-P1** | `PUT /api/monsters/{monsterId}/minions/{minionId}` → **204**, and the minion is thereafter returned by `GET /api/monsters/{monsterId}/minions`. |
| **5a-P2** | **It moves, it does not add.** The previous parent no longer lists the minion. This is the semantic that differs from the membership verb it resembles, and it is the one a reader will get wrong by analogy (architecture §6.4). |
| **5a-P3** | Unknown monster → 404. Unknown minion → 404. Repeat of a successful re-parent → 204 and still exactly one parent. |
| **5a-P4** | **The minion's sub-resources travel with it.** Its attacks, powers, armors and weaknesses are unchanged in content and in id after a re-parent. |
| **5a-P5** | **Regression guard: a plain `PUT /api/minions/{id}` does not change the parent.** `UpsertMinionRequest` has no `MonsterId` and must not gain one (architecture §6.4). This is the criterion that pins the thing both documents wrongly assumed already worked. |
| **5a-P6** | **Accepted behaviour, asserted deliberately: a re-parent against a stale `monsterId` silently relocates the minion rather than failing.** Both verbs are idempotent and return 204 and they are not the same operation. There is no wizard path to this in 5a — the minion's parent is implicit while there is one monster — so the criterion is a documented property of the verb, not a user-facing flow. It becomes reachable in 5b, where the picker's options are the in-memory roster (§4.4). |

### 3.5 5a boundary

| # | Criterion |
|---|---|
| **5a-B1** | **No roster.** The monster phase still holds exactly one monster; `monsters[0]` truncation is unchanged and still drops monsters 2..N. Nothing in 5a makes a second monster reachable, and no test should assert one. |
| **5a-B2** | **A monster is still required in 5a.** Decision 19 is 5b. `validateCurrentStep`'s phase-1/step-0 block stays until the roster exists to replace it — the composer commit rule that replaces it does not exist yet. |
| **5a-B3** | **Locations and Bystanders are untouched.** Every Phase 4 criterion still passes unchanged, including AC-A6's "assert values, not absence of a request." |

---

## 4. Phase 5b

### 4.1 A monster is optional (decision 19)

| # | Criterion |
|---|---|
| **5b-O1** | **The proving case.** Create a mystery, press Next straight through the Monsters phase without touching anything, finish. The mystery saves, the detail page renders, and **no monster row was created.** A synthesised empty monster is the failure mode and it is invisible on the detail page, so assert the absence of the row, not the appearance of the page. |
| **5b-O2** | **Nothing is written for an empty roster.** The submit issues no monster create, no monster update, and no sub-resource calls — but it **does** still drain `pendingRemovals` and apply the roster diff, because an edit-mode revisit can legitimately arrive at an empty roster by removing the last monster. "No monster" must not mean "no submit." |
| **5b-O3** | **Remove the only monster from an existing mystery, finish, and the mystery survives with zero monsters.** The read surfaces already handle it (`mystery-detail`'s "No monsters."); this asserts the write side reaches that state. |
| **5b-O4** | **Field-level required survives; phase-level required goes.** An empty composer advances. A composer with only a name typed in **blocks**, marks the fields touched, and shows the phase's blocked-composer message — the standing commit rule, not a phase gate (UX §16.2). This pair must be tested together: deleting the `validateCurrentStep` branch and stripping the validators look the same from one test and are not the same change. |
| **5b-O5** | **The phase-1 tracker dot is not gated on monster count.** A mystery completed with zero monsters shows phase 1 as finished. In edit mode all four phases show as finished on load regardless of content (architecture §6.5) — which also changes the **locations and bystanders** dots for a mystery that has none, so assert those too; that is the part of decision 19 that reaches beyond monsters. |
| **5b-O6** | **Step 1 with zero monsters is a reachable, calm state.** The minion composer is suppressed, "Add a monster first — minions belong to a monster." renders in the ordinary empty-state treatment, and Next is **not** blocked (UX §16.5). |
| **5b-O7** | **The blurb carries the orientation and nothing else does.** The sentence legitimising zero monsters appears once, in `stepBlurb()['1-0']`. No confirmation on Finish, no "this mystery has no monster" band, no asterisk (UX §16.2, decision 4). Worth an explicit absence test for the same reason AC-R3 was. |

### 4.2 The monster roster

| # | Criterion |
|---|---|
| **5b-R1** | **Several monsters.** Author two monsters in one mystery; both are saved, both appear on the detail page, and both survive a wizard revisit. |
| **5b-R2** | **The truncation is fixed.** Open a mystery that already has more than one monster in the wizard: all of them hydrate. Today `monsters[0]` silently drops the rest — and because it is silent, this needs a mystery built with two monsters *outside* the wizard to test against. |
| **5b-R3** | **Attach, re-edit and remove behave as Phase 4 specified, with the noun substituted.** AC-A1–A9, R1–R5 and D1–D13 apply to monsters; they are not restated here. The monster-specific additions are 5b-R4 through 5b-R8 and §4.3. |
| **5b-R4** | **An attached monster arrives whole.** Attach an existing monster with 3 attacks, 2 powers and 2 minions. The roster card's counts, the composer's contents, and the minion roster all agree with the server, **before** the user does anything else. See §9 H3 — this is the criterion the design has no mechanism for yet. |
| **5b-R5** | **And leaves whole.** Press Next. Not one sub-resource was deleted or re-keyed, in this mystery or the one it came from. 5a is what makes this passable; this is the case that proves the ordering argument was right. |
| **5b-R6** | **Attach brings the minions** (decision 13), and adding a minion to an attached monster adds it in every mystery that uses that monster. |
| **5b-R7** | **Detach a monster → the monster and every one of its minions survive untouched** and remain in the other mysteries. Nothing is destroyed. |
| **5b-R8** | **Delete a monster → the modal lists its minions, and they cascade.** Exactly **one** `DELETE` is issued — for the monster. No separate deletes for the cascaded minions (architecture §7.7d). Ledger assertion; a positive "the minions are gone" check passes either way. |
| **5b-R9** | **The G1 sequence on the monster roster.** Trash a monster, confirm Delete, jump via the tracker, Finish. It is gone. |

### 4.3 The removal predicate, generalised

| # | Criterion |
|---|---|
| **5b-D1** | **Four collections, one rule, four right answers.** For each of `locations`, `bystanders`, `monsters` and `minions`, a draft that is persisted-for-removal records a disposition and an unpersisted one is a local discard. The predicate resolves against **that collection's own baseline** — asserted per collection, because the shipped dispatch is a two-branch ternary with no exhaustiveness check and a fourth member lands on the wrong baseline silently (§9, H5). |
| **5b-D2** | **An attached-this-session monster gets a plain Remove**, no Detach, no Delete, no API call — decision 16, which Phase 4 proved for two collections and 5b extends to the one where the destructive button is most consequential. |

### 4.4 The minion monster-picker

| # | Criterion |
|---|---|
| **5b-K1** | **One monster → no picker**, and the prose line names it. **Two or more → a picker as the composer's first field**, required, with the shipped error sentence. **Zero → 5b-O6.** (UX §6.) |
| **5b-K2** | **A minion authored against a monster that has no server id yet lands on the right monster.** Author two new monsters and a minion against the second, all in one session, and press Next: the minion belongs to the second monster. This is what `localKey` resolution exists for and it cannot be tested with hydrated monsters. |
| **5b-K3** | **Re-parenting works from the wizard.** Change a persisted minion's monster in the composer and submit: the minion moves, via the new verb, and its sub-resources move with it (5a-P2, 5a-P4). No confirmation dialog — it is a field edit (architecture §6.4). |
| **5b-K4** | **A minion cannot be saved without a monster**, and the roster cannot hold minions while it holds no monsters. Remove the last monster and its minions go with it. |

### 4.5 5b hygiene criteria — small, and each stands in for a silent failure

| # | Criterion |
|---|---|
| **5b-X1** | **No `track $index` remains on any roster or sub-resource list**, including the dossier's locations and bystanders lists, which have carried `localKey` since Phase 4. The bite: reverting one token to `$index` must fail a test. |
| **5b-X2** | **The dossier renders a roster, with an empty state**, and shows exactly one monster expanded — the one loaded in the composer (UX §5). |
| **5b-X3** | **The composer signals are named for their owner.** With two composers in the store, no unqualified `composerOpen`/`composerDirty`/`composerValid`/`editingDraftKey` remains. A naming criterion earns its place here only because the rename must happen *before* the second composer exists, and after that it is four files of churn in the riskiest phase. |

---

## 5. Accepted states — expected behaviour, not defects

Carried forward from the Phase 4 doc's S1–S5, which all still hold, plus three that are new in Phase 5.

| # | Expected behaviour |
|---|---|
| **S6** | **A re-parent against a stale monster id relocates rather than fails** (5a-P6). The two `PUT`s look alike and are not alike; this is the price of the 1:N shape. |
| **S7** | **Detaching a monster leaves its minions in every other mystery, including ones the user cannot see from here.** Adding a minion to a shared monster likewise adds it everywhere (decision 13). No warning copy anywhere (decision 4). |
| **S8** | **A mystery with no monster is a first-class, supported state**, not an incomplete one. It shows as complete in the tracker, saves, and renders. |

---

## 6. Explicitly out of scope for Phase 5

- **A monster attach affordance on the mystery detail page** — F1/F2.
- **Detach anywhere outside the wizard** — architecture §7.5. Unchanged.
- **The screen-reader announcement region and the roster button labels** — UX §8 items 2 and 3, follow-ups per Skyler's waiver (`cb1eae3`). **Phase 5 must not re-raise these as blockers.**
- **Mid-wizard persistence** — F4. Note that 5a must decide `draftState`'s fate (delete it or wire it to F4) rather than growing it; "grew it to four composers" is the only outcome that is definitely wrong (architecture §5.5).
- **Losing unsubmitted field edits on a tracker jump** — F9, deliberate. Only *confirmed removals* survive a jump, and the asymmetry is the point.

---

## 7. Definition of done

**5a is done when** 5a-U1–U9, 5a-H1–H2, 5a-M1–M6, 5a-P1–P6 and 5a-B1–B3 hold, and the Phase 4 criteria still pass unchanged for Locations and Bystanders.

**5b is done when** 5b-O1–O7, 5b-R1–R9, 5b-D1–D2, 5b-K1–K4 and 5b-X1–X3 hold, the Phase 4 criteria pass for monsters with the noun substituted, and S6–S8 have been observed and accepted rather than filed.

**Both are done when** the findings in §9 have each been resolved or explicitly deferred.

---

## 8. One note on test shape, because two of these criteria can pass while being wrong

**5a-U2, 5a-M5 and 5b-R8 are ledger assertions and cannot be replaced by outcome assertions.** "The minion was deleted" passes whether one delete or two were issued. "The content is preserved" passes whether ids were kept or rotated. The failures these criteria exist to catch are all *extra or duplicated writes that produce the right end state* — which is precisely the shape Toad's exact-call-ledger rule was written for, and Phase 5 is the phase it was written for.

Conversely **5a-U1 is deliberately not a ledger assertion**: comparing ids before and after needs no request interception, survives any refactor of how the calls are batched, and fails on the most likely wrong implementation of 5a. It is the cheapest high-value test in this document and it should be written first.

---

## 9. Findings — six, separated from the criteria above

Three come from reading `mystery-create.store.ts` and `core/models.ts` rather than the documents. As last time, neither document is wrong about any of them; both are silent.

### H1 — "Minions are already safe here and show what right looks like" is true of the minion row and false of the minion's sub-resources

Architecture §5.2 (rev 9) offers the minion path as the model for 5a. That holds for the **minion row**: `saveMinionDrafts` backfills `id` onto each draft alongside its baselines (`mystery-create.store.ts:1962-1979`), which is why the per-minion cycle has never had the Bug 2 shape.

**It does not hold one level down.** `loadEditData` sets each `MinionDraft`'s `existingAttackIds` / `existingPowerIds` / `existingWeaknessIds` / `existingArmorIds` from the fetched minion (`:1010-1013`) while building that draft's `attacks` / `powers` / `weaknesses` / `armors` **with no id** (`:995-1009`) — `AttackDraft` has no `id` field to put one in, exactly as on the monster side. And `saveMinionDrafts` deletes every baseline id and recreates the lot (`:1947-1953`), which is delete-all/recreate-all by another name.

So the minion sub-resource layer carries the **identical** hazard, and a reader told "copy the minion path" copies a path with the same defect. **Routed to Yoshi:** one corrected sentence in §5.2. The correction matters because 5a converts `saveThreatCollections` **and** `saveMinionCollections`, and the sentence currently implies only one of them needs care.

### H2 — The hazard state is re-created by every successful submit, and its consequence is not the one the docs state

Two corrections, and the second changes what Toad must assert.

**First: it is not only `loadEditData`.** `submitPhase1` refreshes `existingMonster*Ids` from the saved responses (`:1790-1793`) while `monsterAttacks()` and its three siblings still hold drafts with no id; `saveMinionDrafts`'s `tap` does the same per minion. So the state is reachable in **create mode** — author a monster with two attacks, Next, Back, Next — with no edit mode and no attach anywhere in the story. Architecture §5.2 describes it as an edit-mode-revisit hazard, which under-scopes where a test has to look.

**Second, and more useful: the likely consequence is churn, not destruction.** Under a 5a diff, the delete set is "baseline ids no draft claims" — all of them — and the create set is "drafts with `id === null`" — also all of them. Net: every row deleted and recreated, content preserved, **every key rotated, and the dirty check unable to fire for any hydrated content**, because no draft can ever match a baseline row. A 5a that ships this passes a content-preservation test and delivers neither of its two purposes.

Genuine destruction — outcome (ii), delete everything and create nothing — needs a path that fills the baseline and leaves the **drafts** empty. There is exactly one such path in the plan, and it is H3.

**Why this matters to the review rather than to Luigi alone:** the two things are caught by different tests. "No writes when nothing changed" (5a-U2) catches the churn; "the content is still there" does not. 5a-U1 — compare sub-resource ids across a phase transition — catches it with no request interception at all, and is the test I would write first. **Routed to Yoshi** for the scoping correction in §5.2, **and to Toad** as the reason 5a-U1 and 5a-U9 are phrased the way they are.

### H3 — Attaching a monster cannot populate a monster draft from what the picker gives it, and nobody has specified what happens in between

The attach picker's options are `MonsterListItemResponse[]` (`core/models.ts:191-205`), and it carries `attackCount`, `powerCount`, `armorCount`, `weaknessCount`, `minionCount` — **counts, not content, and no minions.** `loadAttachCatalogues` (`:840`) fetches `getAll()` for locations and bystanders today, and monsters would join it the same way.

So "attach an existing monster" cannot produce an editable, diffable `MonsterDraft` from the option it was picked from. It needs `monsterService.getById(id)` for the subtree **and** `minionService.getByMonster(id)` plus a `getById` per minion for the minions decision 13 says come with it — the 1 + 1 + N fan-out `loadEditData` already performs at `:934-945`.

That collides with a shipped interaction decision. UX §3 specifies attach as **commit-on-pick: the card appears immediately, no second click, no confirmation.** Three states follow that neither document specifies:

1. **Between the pick and the fetch landing** — what the roster card and the composer show.
2. **If the fetch fails** — the card is in the roster with counts from the list item, the baseline is empty, and the composer shows a monster with zero attacks while its own roster card says `Attacks: 4`. The card and the composer disagree about the same object, on the same screen.
3. **Pressing Next in state 2** — quiet, because an empty baseline and empty drafts diff to nothing, but the user is now editing a monster they can only see part of. **This is where outcome (ii) actually lives in this feature**, and it is reached by a natural implementation of a decision that is already made.

**Routed to Rosalina** (the pick-to-populated interaction, and the failure copy it needs) **and Yoshi** (whether attach-a-monster may be a 1 + 1 + N fetch, and whether a roster card may exist before its subtree does). **My product position, offered as input:** the card must not enter the roster until its subtree is in hand. A monster card that under-reports its own contents is the one display error in this feature that leads a user to destroy data by hand — they add back the attacks they think are missing, and now the shared monster has seven.

### H4 — Two removal rules don't compose when a minion's deletion outlives its monster

Architecture §7.7d: removing a monster records **one** disposition, for the monster, and drops its minion drafts locally. §7.7e: `applyPendingRemovals` drops any disposition whose id is in that collection's **current drafts**.

Now delete a minion (disposition recorded), then remove its **monster**. The minion's draft leaves the roster with its parent, so §7.7e no longer protects it and its own disposition stays live:

- **Monster disposition `delete`** — the FK cascade destroys the minion and the minion's own delete 404s, swallowed by rule 2. Survivable, but it is the duplicate-request sloppiness §7.7d exists to prevent, arriving through a door §7.7d doesn't watch.
- **Monster disposition `detach`** — the monster and its minions are supposed to survive untouched everywhere (§6.4, and the modal says so). But the pending minion deletion still drains, so **one minion is destroyed in every other mystery that uses that monster.** Two modals the user read in sequence now describe the same minion differently.

Traceable and arguably correct — a minion has no membership, so deleting one is global by nature — but unstated. **Routed to Yoshi.** A cheap resolution is available and is the same move §7.7e already makes: when a monster leaves the roster, drop its minions' dispositions too, extending "id is in the drafts" to "its parent left the roster." Drop, not skip, for §7.7e's stated reason.

### H5 — The removal predicate's dispatch is a silent-fallthrough shape, and Phase 5 doubles its inputs

`membershipPersisted` (`:1168-1175`) resolves its baseline with `collection === 'locations' ? existingLocationIds() : existingBystanderIds()`. A ternary has no exhaustiveness check, so the moment `'monsters'` and `'minions'` join `RemovalCollection`, **both resolve to the bystander baseline** — no compile error, no runtime error, just a predicate that answers the wrong question about the wrong collection, on the path that decides whether a destructive button appears.

Architecture §7.7b flags that the function is *misnamed* for minions and should be renamed. That is right and it is a different problem; renaming a function whose dispatch silently falls through leaves the fallthrough. **Routed to Luigi and Yoshi:** make it a `switch` with a `never` default or a keyed record, so the fourth collection cannot land on the wrong baseline. One line, and 5b-D1 exists to catch it if it is missed.

### H6 — Phase 1's drain is hostage to the monster save; phases 2 and 3's is not

`submitPhase1` nests `applyPendingRemovals` **inside** the monster save chain (`:1768-1800`), so a failed monster `PUT` or `POST` means the drain never runs. `submitPhase2` and `submitPhase3` put it in the `forkJoin` as a sibling (`:1828`), where it runs regardless.

Today that asymmetry is invisible. 5a makes it bite twice: a confirmed **minion** deletion becomes hostage to the monster save succeeding, and 5b's decision 19 makes "no monster at all" an ordinary state with no monster save to hang the drain off. Yoshi's §6.5 already requires the drain to move out for the empty-roster case; the point worth stating is that it should move out **unconditionally**, so phase 1 drains the way the other two do. Otherwise the empty-roster path and the populated-roster path have different drain semantics, which is a distinction no one will remember in six months.

**Routed to Yoshi** as a one-line addition to §6.5 point 2, and covered by 5b-O2.
