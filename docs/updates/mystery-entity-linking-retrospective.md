# Mystery Entity Linking — Retrospective

**Prepared by:** Koopa (Retrospective Analyst)
**Status:** **Phase 6 of the feature's own plan** (`mystery-entity-linking.md` §9). Sources read: the four feature documents, nineteen decision records in `.squad/decisions/inbox/`, seven agents' histories, and `git log c38b02a..68ea8c5` with full commit bodies. Every claim below is cited to one of those.
**Date:** 2026-09-21 · branch `mystery-entity-linking-phase-5b`

> Fourth companion document, following the convention Peach established for this feature: one file per document-with-a-named-author, not sections bolted onto someone else's. The other three are **what it must do** (Peach, three acceptance files), **how it does it** (Yoshi, `mystery-entity-linking.md`) and **how it looks** (Rosalina, `mystery-entity-linking-ux.md`). This one is **what it cost**.
>
> **A note on the ceremony roster.** `.squad/ceremonies.md` names Mario, Luigi, Bowser, Rosalina, Toad and Peach as participants. Yoshi wrote the architecture document and twelve revisions of it; Boo ran the security review that produced the duplicate-key guard's shape. Neither is on the roster. Mario is, and `.squad/agents/Mario/history.md` is empty — the Lead contributed nothing recorded to this feature and nothing broke. I read all seven contributors regardless; the roster should be corrected (§10b).

---

## 1. What shipped, in numbers

| | Before | After |
|---|---|---|
| Backend tests | 439 | 568 (+29%) |
| Frontend tests | 736 | 1190 (+62%) |
| `mystery-create.store.ts` | 1670 lines | 3187 lines (+91%) |
| Architecture doc | rev 1 | rev 12 |
| Decision records filed | — | 19 |

Ten commits, `c38b02a` (2026-09-19 19:49) through `68ea8c5` (2026-09-20 14:57). **The entire six-phase implementation — plus a security review, a design-review ceremony, a three-stage re-review, three acceptance passes and seven QA passes — ran inside nineteen hours of wall clock.** Whatever was expensive about this feature, it was not calendar time. It was review attention, and that is the thing worth examining.

Review density, for the same nineteen hours: 1 security review, 1 design-review ceremony, 1 three-stage pre-phase re-review, 3 acceptance passes, 7 QA passes, 12 document revisions, and **136 negative controls run by Luigi across six phases, of which 13 were MISSED on first attempt.**

---

## 2. What worked, and the evidence

### 2.1 Deliberately breaking the code was the highest-yield practice in the engagement

Three people did it three different ways — Toad's mutation recipe (`cp` to scratchpad, `perl -0pi -e`, `cmp` to prove byte-exact restore), Luigi's per-phase negative controls, Bowser's scratchpad `tar` bite-checks — and between them they found **roughly twenty-five distinct tests that could not fail**. Not gaps in coverage: tests that were green and meant nothing.

The instructive ones:

- **Three fake repositories hardcoded `Unlink…FromMysteryAsync => Task.FromResult(1)`**, so every round-trip assertion in Phase 1 was vacuous (Toad, Phase 1).
- **Fake repository predicates were written by copying the implementation's `Any(...)`**, so a transposed predicate agreed with itself and all fifteen of Bowser's service tests passed (Toad, Phase 1). Only real-SQLite repository tests killed that mutant.
- **`toContain` on a call ledger cannot see a duplicate**, and Phase 4 had already produced the bug that lives in that blind spot — D6's detach twin was unprotected, and a duplicate *unlink* is worse than a duplicate delete because the drain maps 404 to success and the diff does not (Toad, Phase 4).
- **Bowser's own `Put_LastWriterWins_WhenTheSameMinionIsMovedTwice` passed against an implementation that never moved anything**, because the minion starts on the origin monster and the test's final assertion expects it there. He caught it with his own bite-check (`ef28fd5`).
- **`Validators.required` stripped from all three monster composer controls survived all 1184 tests** (Toad, 5b). Decision 19 removed `validateCurrentStep`'s branch, `monsterForm.invalid` became read nowhere, and the surviving guard inherited a coverage obligation nobody re-tested.
- **`shared/confirm-delete-modal.call-sites.spec.ts` — 415 lines — compared three literal lines against themselves.** `expect(Object.keys(perTemplate)).toHaveLength(12)` and `…reduce(…)).toBe(13)` were both facts about the literals directly above them. It sat at 13-in-12 while Phase 4 added two call sites and 5b a third; the truth was 16 in 14. **That file provided zero coverage for two phases while green, and nobody who edited it noticed** (Toad, 5b).

Each of these would have shipped as false confidence. The practice caught them; nothing else could have.

### 2.2 Phasing optimised for independence, and foundations before replication

§9's stated property — *"No phase is gated on an open question"* — was treated as a design target for the phase boundaries, not as an outcome. It paid twice, at two scales:

- **Phase 3 was created at rev 3** and moved stable client keys and three shipped accessibility defects *ahead* of the roster replication, on the argument that both get four times more expensive once the pattern is copied to three more phases. It shipped as a standalone improvement to the minion roster that already existed.
- **Phase 5 was split into 5a then 5b at rev 8**, on the same reasoning one level down: the roster cannot safely ship attach-an-existing-monster on a delete-all/recreate-all sub-resource layer. 5a shipped value alone — sub-resources stopped re-keying on every Next regardless of attach.

The tactic behind both is worth naming, and Rosalina named it: *"naming the a11y defects as defects in the already-shipped roster (not as requirements of the new feature) is what got them scheduled ahead of everything and ungated from Skyler's answers."*

### 2.3 Structural fixes preferred over disciplinary ones, every time, with the choice stated

This is the single most-repeated technique in the record and it worked on every application:

- **`hydrateMonsterDraft` as the one construction site** built the drafts' ids and the baselines from the same response objects in the same expression. Three of Peach's findings "turned out to be that one bug — two independent paths building the same state, only one of which was correct" (`f8170eb`).
- **`MonsterDraft.existingMinionIds`** replaced a flat store-level signal, so removing a monster drops its minion baseline *because the baseline went with it* — "there is no bookkeeping step left to forget" (`68ea8c5`). The alternative was a third "also clear these ids" rule in a section that had already produced two failed disciplinary fixes.
- **The check moved inside `applyPendingRemovals`** rather than relying on every attach path calling `cancelPendingRemoval` first — an invariant held by hand at three call sites, becoming five. Yoshi: *"Three lines beats a convention."*
- **An exhaustive `switch` replaced a two-branch ternary** on a union about to grow, on the path deciding whether a destructive button appears. The ternary "would have silently resolved two new collections to the bystander baseline" (`f8170eb`).

### 2.4 Reviewers assigned by reading surface, not by layer

See §6. This is the mechanism the review chain actually ran on, and it was mostly accidental.

### 2.5 Commit messages that carry the reasoning

`68ea8c5` explains *why* a half-loaded roster card is the one path in the design that destroys sub-resources rather than merely re-keying them. `f8170eb` explains why the baseline must be what the server ended up holding rather than what the first call returned. **This retrospective was reconstructable almost entirely from `git log` plus `.squad/`, without reading the implementation.** That is a durable asset and it cost nothing extra to produce.

### 2.6 Losses and withdrawals recorded as loudly as wins

Yoshi recorded losing the sweep-sequencing argument to Rosalina and wrote *"Record losses in the decision file, not just wins."* Rosalina withdrew her own minion-predicate remedy — *"my diagnosis was right and my remedy attacked the symptom."* Bowser corrected his own stated reason for deferring the duplicate-key race — *"when the justification for deferring something is a cost, check that the cost survives the fix's own placement; mine was refuted by my next sentence."*

This is why the review chain worked. Being wrong out loud was cheap, so nobody defended a position through a review.

---

## 3. What was expensive

### 3.1 A defect class that took five instances and two namings

The class: **a baseline and its draft share one lifecycle — created together, destroyed together, written in one place** (§2 principle 5, as widened at rev 12).

| # | Instance | Found by | When |
|---|---|---|---|
| 1 | `loadEditData` fills `existing*Ids` while building drafts with no `id` (H1) | Peach | Phase 5 acceptance, rev 10 |
| 2 | `submitPhase1` recreates the same state on every successful submit (H2) | Peach | same pass |
| 3 | `MinionDraft` gains `monsterKey` and no baseline parent (J2) | Peach | 5b acceptance, rev 11 |
| 4 | The baseline is set before the hydration that can fail (BUG 2) | Toad | 5b QA, rev 12 |
| 5 | The bookkeeping that cleared the baseline was deleted while the baseline lived on (BUG 1) | Toad | same pass |

**Instances 1 and 2 arrived in the same review pass, before 5a was built.** Yoshi did generalise at that point — but he generalised the *hazard* (§5.2's "baseline populated, drafts not") rather than the *property of the pair*. The principle was added at instance three, and stated as **existence**: *every persisted mutable draft field needs a baseline twin*. That statement covers a missing twin and says nothing about a twin created at the wrong moment or destroyed at the wrong one — which is exactly what instances four and five were. Yoshi's own rev 12 note: *"A principle stated as existence when it was really lifecycle let two bugs through that it should have caught."*

**What the delay cost, concretely.** Instances 4 and 5 were found *after 5b was implemented and green at 1188 tests*, forcing a QA → ruling → fix round on a phase everyone considered done: two store fixes, an 842-line characterisation spec (`mystery-create-phase5b-baseline-leaks.spec.ts`), five more negative controls, and a thirteenth architecture revision. Instance 3 was found rather than derived, and Yoshi's own note is that *"J2, J4 and J1 are one change, not three"* — the field principle 5 would have demanded is the field that fixed three separate findings.

The two defects were not cosmetic. BUG 2 "unlinks every monster from the mystery — silently, reporting success." BUG 1 leaves the user unable to leave the Monsters phase.

**Actionable:** promote a recurring observation to a principle at the **second** instance, not the third, and state it as a lifecycle. Toad's check is the right one and it is one sentence: *does the statement cover the destroy edge as well as the create edge?*

### 3.2 Test vacuity was endemic, and the practice that caught it was not the default

Twenty-five instances (§2.1). Three people found them, using three different home-grown implementations of one idea, none of which is a project standard. The consequences of it being ad-hoc rather than default:

- **Coverage rotted silently.** The call-site census gave zero coverage for two phases. The Phase 3 Escape sweep *"had been edited to hold its counts in the two states where 5b's new ones don't render — passing while covering less"* (Toad). Both are the same shape: an assertion that counts, with the count written down.
- **Each implementation carried its own trap, and one of them cost an hour.** `Copy-Item` restores a mutant with the *source's* timestamp, so MSBuild skips the rebuild and the next `dotnet test` runs the mutant assembly. Toad: *"Cost an hour: a restored test failed consistently in the full run and passed whenever edited, which reads exactly like a flaky harness."* The `cmp`/hash check from his own Phase 1 recipe proves the bytes and says nothing about the build.
- **A verification step reported success while doing nothing.** `npx tsc --noEmit -p tsconfig.json` in the web app exits 0 on a tree with a real type error, because the root config is solution-style (`"files": []`, two references). Toad: *"Caught this while verifying 5a-M6 and it nearly gave the wrong answer."*

### 3.3 The corrections cluster in one place: contract shapes and counts

Six documented corrections, and **not one was a reasoning error.** Every one was a number or a contract shape stated from memory or from intent rather than re-derived at the moment of writing:

- *"Reparenting is just a field edit"* — Yoshi §6.4 and Rosalina §6, both. `UpsertMinionRequest` has no `MonsterId` and `MinionService.UpdateAsync` never sets one.
- *"Five `MonsterService` methods"* — written rev 3, repeated in three places through rev 7. The real number is seven.
- *"`[items]` is passed `[]` everywhere"* — `monsters-list.html:51` already passed minion names.
- *"Thirteen call sites"* / *"fourteen"* — counted off a `files_with_matches` grep, which counts files; a recount counted closing tags. Truth: thirteen elements in twelve templates, later sixteen in fourteen.
- *"Both idempotent"* — written three revisions running. Repeat `PUT` is 204; repeat `DELETE` is 404 (`LocationService.cs:166-170`).
- *"This app has no unsaved-changes guard"* — `hunter-draft.guard.ts` exists and its own comment calls it "the app's first."

Rosalina diagnosed her own instance correctly and it generalises to all six: *"I asserted an API shape from the operation I wanted rather than from the DTO."*

### 3.4 The friction items share one failure mode

| Item | Cost |
|---|---|
| `--artifacts-path` → 184/454 spurious failures (`PickRuleTable.ApiProjectRoot()`, `Services/PickRuleTable.cs:138`) | Recorded in Bowser's Phase 1 entry, repeated as a standing warning in all seven of Toad's entries, and **hit again by Bowser** during the reparent bite-check |
| `Copy-Item` preserves source mtime → MSBuild skips rebuild → mutant assembly runs | One hour, presenting as flakiness |
| `tsc -p tsconfig.json` checks nothing | Nearly produced a wrong verdict on 5a-M6 |
| Stale `dotnet run` locking the exe | Recurred "for the Nth time"; the PID found was two days old |
| `import.meta.glob` hangs the test run; `?raw` imports not found in bundle; `npx vitest run` fails at the CLI | Two abandoned approaches to asserting template source |

Individually small. **Together they are one thing: five of this project's build and verification steps fail silently or fail misleadingly.** That is the same failure mode as the vacuous tests — a green result that means nothing.

The `Copy-Item` item is the proof that it compounds: the mutation-testing practice that exists to defeat silent success was itself defeated by a silent success, and cost an hour being diagnosed as a flaky harness.

---

## 4. Rework actually caused — quantified

| Item | Specified | Corrected | Cost |
|---|---|---|---|
| `origin: 'authored' \| 'attached'` draft flag | arch rev 1 §5.1 | retracted rev 2 by one stakeholder answer; Rosalina argued to narrow it rev 3; resolved to a derived baseline diff | 3 doc revisions + 1 reconciliation round. **No code.** |
| Re-parenting is "just a field edit" | arch §6.4 rev 1 **and** UX §6 | Bowser, pre-Phase-5 backend review (rev 8) | **1 unplanned commit** (`ef28fd5`): a new backend verb, 14 tests, +224 / +103 doc lines, 1 stakeholder round (decision 18) |
| Removal variant table keyed on `id === null` | UX §7.1 | Peach (G3) → decision 16 | Doc only — caught before Phase 4 code existed |
| `MonsterDraft`'s four baselines dropped | arch §6.1 rev 3 | Luigi, three-stage review (rev 9) | Doc only — §5.4 and §6.1 had disagreed about the central type of the riskiest phase for five revisions |
| Phase 2 partial-failure strings + error routing | Luigi, Phase 2 | Rosalina §9.5, same day | **Real code rework**: create-page routing, detail-page refetch, 8 further negative controls |
| `validateCurrentStep` phase-1 branch | Luigi, 5b | his own negative control, NOT CAUGHT | Real code rework, small — deleted rather than fixed. The *same* redundancy had been found in phases 2 and 3 by the same technique in Phase 4 |
| BUG 1 + BUG 2 | Luigi, 5b | Toad, 5b QA | Fix-before-merge round: 2 store fixes, 842-line spec, 5 negative controls, 1 arch revision |
| Vacuous call-site census | Luigi, Phase 3 (415 lines) | Toad, 5b | Two phases of zero coverage from a green spec |

**Three items of real code rework. Five of doc rework, all caught by review before implementation.**

That is the cheap direction, and it is the single biggest thing this feature got right. But it got it right by **spending review, not by writing documents that were right the first time** — and the corrections cluster entirely in the one place §3.3 identifies.

---

## 5. Where findings actually came from

Counting substantive findings by the artifact that produced them:

**From reading code or running mutants (~50):** Peach's G1/G2/G3, H1–H6 and J1–J6 (fifteen, all from `mystery-create.store.ts`, `mystery-create.html` and `core/models.ts`); Bowser's reparent gap (`UpsertMinionRequest`); Boo's status-code asymmetry and endpoint-metadata enumeration; Toad's twenty-five vacuity findings plus BUG 1, BUG 2, the `monsters-list` focus bug and the Escape-on-backdrop bug; Luigi's `draftState` dead code, the stale `computed()` over a plain `@Input()`, the `afterSave` baseline poisoning and two redundant guards; Rosalina's "three quarters of it already ships," the `permanenceNote` render-branch bug, and the two progress indicators; Yoshi rev 8's `MonsterService` client gap, method-count rot and `idsToRemove` optional-parameter trap.

**From reading documents against each other (4):** §6.1 vs §5.4 disagreeing about `MonsterDraft`'s baselines; §16.2's "tracker dot" ruling bound to the wrong indicator (J3); the acceptance doc's scope line going stale; the two follow-up lists drifting into duplication.

**The brief's claim holds, and it is sharper than stated.** In the two cases Peach names, neither document was wrong — *both were silent*, and she said so twice in identical terms: *"Neither design doc was wrong; both were silent, and silence is invisible from inside the docs"* (Phase 4), and *"Design docs describe the new behaviour; the code holds the old invariant, and the gap between them is where every finding has come from"* (5b).

**Bowser's find is the case that settles it.** Two documents, by two competent authors, asserted a capability the API did not have. The documents *agreed with each other* — which is precisely why no amount of document review could have found it. Agreement between documents is not evidence.

**The uncomfortable conclusion:** 161KB of architecture document and 141KB of UX document produced four internal-consistency findings. The store file produced fifty. That does not mean the documents were wasted — they are why seven people worked one feature in nineteen hours without colliding, and why nineteen decisions were made without anything being re-litigated. But their value was **coordination and record, not defect discovery**, and briefs should stop treating them as a review surface.

Peach's own conclusion is the one to adopt as a standing instruction: **"Check the payload, not just the entity. Design docs describe entities; contracts describe payloads, and that is where the silence concentrates."**

---

## 6. The review chain: working, or evidence earlier stages failed?

The chain ran: Yoshi's self-scheduled re-review (rev 8) → Bowser → Luigi (rev 9) → Peach (rev 10) → Peach again (rev 11) → Toad (rev 12). Each stage found what the previous could not:

- **Bowser** found the reparent no-op — a C# request-record fact.
- **Luigi** found the §6.1/§5.4 contradiction and that `draftState` was dead code with one consumer, its own spec — frontend-internal facts.
- **Peach** found composition failures across rules, and claims that no honest test could assert.
- **Toad** found the same rules correct but *mis-timed and mis-scoped*, by writing the repro rather than reading the design.

Yoshi's own reading, rev 9: *"My own re-review had four real defects in it, all found by the two reviewers who came after me… I'd written rev 8 confidently enough that it would have gone straight into implementation."* And at rev 10: *"'reviewed' is not a scalar."*

**My verdict: the ceremony worked, but not by the mechanism its structure implies.** The stages are named architect → backend → frontend, which reads as a layer or seniority ordering. What actually varied was **the artifact each reviewer opens by habit.** Bowser opens `ApiContracts.cs`. Peach opens `core/models.ts` and the store. Luigi greps his own store for consumers. Toad writes the repro. Those four surfaces do not overlap, and the non-overlap is the entire yield.

The evidence that ordering was *not* the mechanism: **Peach's Phase 5 acceptance review found five defects in a document that had already been through the full three-stage chain.** If the chain worked by depth, a fourth pass should have found less. It found more, because it was the first pass whose method was "work out what a *wrong* implementation would look like to a test."

The honest counter-case: the chain is expensive, and there is a real question whether rev 8's four defects would have been cheaper to find by implementing and testing. The split the evidence supports: **review is worth it for a finding that reshapes a function; testing is worth it for a finding that mis-times one.** J1 was review-found and Peach's own note is that it *"should land in the design before Luigi rewrites `submitPhase1`, because it changes what that function must do rather than adding a test to it."* BUG 1 and BUG 2 were test-found, and were the two most dangerous defects in the feature.

**Actionable form:** not "have three stages," but **enumerate the artifacts that hold the truth for this feature and assign one reviewer per artifact.** For this feature that list was: the C# request records, `core/models.ts`, `mystery-create.store.ts`, and a running repro. Three stages happened to cover three of four; the fourth came last, and found the two bugs that would otherwise have shipped.

---

## 7. What Skyler's answers did — testing the "it got smaller" claim

Yoshi wrote at rev 5: *"Pattern across this whole engagement: every round of stakeholder answers made the design smaller, not bigger."*

**Against the record that is false, and the way it is false is the useful part.**

- **Round 1** (decisions 1–7) killed the `origin` flag — and added the **full monster roster** (decision 2, the largest single scope addition in the feature), a confirmed Detach/Delete modal (decision 7, whose own consequence column reads *"Broadens scope, accepted"*), and re-editability of every entity (decision 6).
- **Round 2** (8–14) added sub-resource upsert (seven new Angular service methods plus a weapon-tag diff), dirty-tracking *on top of it* (decision 9: *"Not a fallback… an affirmative requirement"*), Detach widened (10), a mystery-list fetch (11), and the modal sweep pulled earlier (14). Clearly bigger.
- **Round 3** (15–16) was corrections. Size-neutral.
- **Round 4** (17–19) added minions to the removal drain (17 — Yoshi: *"The cost was higher than I estimated"*), built the reparent verb now (18), and made a monster optional (19 — *"the widest-reaching single sentence"*).

**Scope grew in three of four rounds.** What shrank each time was a *mechanism Yoshi had designed in anticipation of an answer*: the `origin` flag, the three-way submit diff, the Detach sweep outside the wizard, the dirty-tracking fallback branch. Four mechanisms, all built to hedge a branch that had not been chosen, all discarded.

**What it implies about when to ask** is the opposite of what "smaller" suggests. It is not that asking shrinks the design. It is that **every mechanism designed before the answer arrived was thrown away, and one of them (`origin`) took three revisions and a peer disagreement to remove.** Meanwhile rev 1's §1 — the verified current-state audit, written entirely from source — survived every round unchanged and is still the most-cited section in the document.

**Actionable:** before a stakeholder round, ship the **facts and the question**, not a mechanism that would satisfy one branch of it. Yoshi's own operational version, written the same day, is the right one: *"Answer first, then re-derive — don't defend the previous revision's mechanism."*

---

## 8. What was luck

The brief asked what would not survive a less careful run. These five would not.

1. **Bowser's re-review found the reparent no-op only because its brief said to read code.** Yoshi's instruction was explicit: *"make its brief 'read the code, not the plan.'"* Had that stage been a document review, `UpsertMinionRequest` would not have been opened — Yoshi's own note is *"Neither author had reason to check the request record."* The alternative outcome is a shipped silent no-op: a 200 response, nothing written, local state disagreeing with the server until something refetched.

2. **BUG 2 was found by a QA pass on a phase that was already implemented and green at 1188 tests.** Nothing in the suite, the build, the type checker or the design documents would have caught it. The only thing that did was Toad choosing to test the *drop* edge of a pair. Skip that pass as "5b is done, tests are green," and the feature ships silent data loss on a failed edit-mode load.

3. **The vacuous call-site census survived two phases of edits to the very thing it claimed to cover.** It was found because Toad ran an independent census, not because the spec failed.

4. **`Validators.required` surviving 1184 tests** was a side effect of a correct deletion (decision 19 removed a redundant gate) that nobody connected to a coverage obligation. Found only by mutating the validators.

5. **Peach read `core/models.ts` on her own initiative.** H3 — `MonsterListItemResponse` carries counts and no minions — reshaped 5b's central interaction *before it was built*, and her own conclusion is *"`models.ts` was the single highest-yield file this pass."* Nothing in an acceptance-review brief says "read the DTOs." She did it three times and it yielded three times.

**The common thread: four of the five depended on one person choosing a reading surface nobody had assigned them.** That is not a process. It is a property of who was in the room, and it is the first thing that disappears under time pressure.

**One more, on the risk register.** §8 has eight entries. Two drove phases (8.1 → Phase 5a, 8.6 → Phase 3) and one (8.8) was written retrospectively. **None of the fifteen review findings — G1/G2/G3, H1–H6, J1–J6, BUG 1, BUG 2, the reparent gap — appears in it.** And even where §8.1 named the right class, it named it in a way that would have passed a wrong implementation: Peach's H2 is precisely that the hazard "reads as data loss" while the real outcome is churn, so *"a wrong implementation passes a content-preservation test."* A risk register that names classes without naming what a wrong implementation looks like to a test is a list, not a control.

---

## 9. The question Phase 6 was given

> *"The wizard store has now been extended five times. Worth asking whether phase-transition submission is still the right backbone or is accumulating special cases."* — §9

**The backbone is still right. What is straining is ownership, not timing.**

The evidence that the backbone held: decision 12 explicitly preserves the standing 2026-07-21 phase-transition submission decision, and decision 15 — the fix for Peach's G1 — was chosen *specifically* because it closed the hole *"without touching `jumpToPhase`, `advancePhase` or tracker semantics."* Widening a state's scope beat changing navigation, and it *"made the shipped copy more true"*: "changes take effect when you continue to the next step" now holds for any continue, from any phase. A backbone that absorbs a navigation defect by widening state rather than by growing a special case is working.

The evidence that ownership is straining:

- `mystery-create.store.ts` grew **1670 → 3187 lines in a single feature**, and it was already the largest file in the frontend.
- It now owns four rosters, four composers, eight baselines, one disposition queue and its drain, plus `clearDrainedRemovals`, `stillTheRostersBusiness`, `persistedForRemoval`, `deferredChangeTail`, `collapseComposerIfUntouched`, `effectiveMinionMonsterKey`, `localKey`, `monsterKey` and `existingMonsterId`.
- **§7.7 alone produced three composition failures** — (e)'s drop rule, (f)'s parent-child extension, and J1 — which is why principle 6 exists. One section of one design producing three instances of one bug class is the signature of a mechanism carrying more coupled state than its shape supports.
- F4 and F9 remain open and are now *more* expensive than they were: a reload mid-wizard can create a second unrelated Mystery, a tracker jump still discards unsubmitted field edits, and `pendingRemovals` now lives in that same volatile state (§8.3).

**The recommendation is not a rewrite.** It is to extract the roster / baseline / disposition machinery into one parameterised owner per collection, following the precedent this feature already set one level down. Luigi's reasoning for `sub-resource-diff.ts` transfers exactly: *"one parameterised function over a small service adapter, used eight times across two owners, because 5b relocates the state it reads onto the roster draft and an inlined version would be rewritten"* (`f8170eb`). The measurement that makes the case is Toad's: `mystery-create-locations-phase` and `mystery-create-bystanders-phase` are *"byte-identical modulo the noun"* — one line of template and two comments apart. That is Rosalina's OQ9, which she scoped as Luigi's build-time call and which both follow-up lists already flag as where the consistency debt gets logged.

---

## 10. Process findings outside the feature

**a) `.squad/decisions.md` has been abandoned.** It holds **4 entries, all dated 2026-07-21** (one amended 2026-09-14). `.squad/decisions/inbox/` holds **125 files**, nineteen of them from this feature. Any agent following the standing instruction to "check `decisions.md` for standing decisions" gets a two-month-old picture and misses every decision this feature made. The inbox is the real record and nothing drains it.

> **Done, 2026-09-21.** `decisions.md` was retired on Skyler's ruling and its four entries preserved verbatim at `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md`. `inbox/` is now `records/`, with a standing-decision index at `.squad/decisions/README.md`. **The finding above understated the problem:** the one time the inbox *was* drained, on 2026-07-25, it compressed **405 lines** of reasoning across **three** records into 29 and deleted all three — including one decision that then stayed invisible for two months, and one entire record that nothing cited, whose loss therefore produced no symptom at all. All three were recovered from git. Old paths in this paragraph are left as written, because they are what was observed.

**b) The retrospective roster is wrong for how work actually runs.** See the note at the head of this document. The roster should gain Yoshi and Boo; Mario's membership should be reconsidered on the evidence of an empty history file across a feature that shipped fine.

**c) `.squad/log/` and `.squad/orchestration-log/` are stale since 2026-07-26** — four files total. The agent histories and the commit messages took over that job and do it better. Either retire them or state what they are for.

---

## 11. Recommendations

### Worth doing first

Each is cheap, and each closes a failure mode that produced a real defect in this feature.

**R1 — Fix the three silently-succeeding verification steps.**
 (a) Add a root npm script that type-checks `tsconfig.app.json` **and** `tsconfig.spec.json`, and delete or repoint any `-p tsconfig.json` invocation. The root config is solution-style and exits 0 on a tree with a real type error.
 (b) Put the `--artifacts-path` prohibition **and its cause** (`PickRuleTable.ApiProjectRoot()`, `Services/PickRuleTable.cs:138`) somewhere a new contributor reads before running tests, not only in Toad's and Bowser's histories. It was hit at least three times across this feature, including once by the person who had documented it.
 (c) Any mutation restore on the C# tree must reset the file's `LastWriteTime`. `Copy-Item` preserves the source's timestamp, MSBuild skips the rebuild, and `dotnet test` then runs the mutant assembly. That cost an hour and presented as flakiness; the `cmp` check proves the bytes and says nothing about the build.

**R2 — Make "break it and name the test that fails" a required, counted step in every implementation phase.**
It already is one, informally: Luigi reported 136 negative controls with 13 MISSED, Toad ran mutants against every phase, Bowser bite-checked three broken implementations of the reparent verb. Write the count into the phase report template so that a phase report omitting it is visibly incomplete. The three sub-rules that earned their place here, all already filed as decisions:
- assert the **complete sorted multiset** of calls wherever two paths can reach one endpoint (`toad-exact-call-ledger-over-positive-assertions.md`) — a positive assertion cannot see a duplicate;
- **derive** any counting assertion's N rather than writing it down (§8.8) — a written-down count silently narrows every time the surface grows;
- test the **drop/abandon edge** of any baseline/draft pair, not only the create edge, and assert the **baseline** and not only the drafts (`toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md`).

**R3 — Every review brief names a code artifact, and the artifacts are enumerated per feature.**
Yoshi's "read the code, not the plan" is what found the gap two documents had asserted away. Peach's self-directed reading of `core/models.ts` was her highest-yield file on all three passes. Make the surface list explicit at phase-plan time — for this feature: the C# request records, `core/models.ts`, `mystery-create.store.ts`, and a running repro — and assign one reviewer per surface rather than one per layer.

**R4 — Drain `.squad/decisions/inbox/` into `.squad/decisions.md`, or retire `decisions.md`.**
125 versus 4 is not a backlog, it is a broken pointer, and the instruction to consult it is now actively misleading.

### Worth doing

**R5 — Promote a recurring observation to a principle at the second instance, and state it as a lifecycle.**
The baseline/draft class was named at instance three, stated as existence, and cost two production bugs before being widened at instance five. The check is one sentence: does the statement cover the destroy edge as well as the create edge?

**R6 — Extract the roster / baseline / disposition machinery per collection.** §9. This is Rosalina's OQ9 and it is already flagged as consistency debt in both follow-up lists; the case for it is now measured, not argued.

**R7 — Close F10; revisit F4 and F9 together.** `monsterTypeId` is required, asterisked, and is the one monster field with no inline error message — one line of template, and decision 19 removed the only other signal. F4 (no mid-wizard persistence) and F9 (a tracker jump discards unsubmitted edits) are the same class of loss and are now more expensive, because `pendingRemovals` lives in the same volatile state.

**R8 — Before a stakeholder round, ship the facts and the question, not a mechanism.** §7. Rev 1's source-verified current-state audit survived every round unchanged; rev 1's `origin` mechanism took three revisions and a peer disagreement to remove.

### Standing defaults for this project

Practices from this feature that should stop being per-feature choices:

- **Commit messages carry the reasoning, not the changelog.** `68ea8c5` and `f8170eb` are the models. This document was reconstructed almost entirely from `git log` plus `.squad/`.
- **Structural fixes over disciplinary ones, with the choice stated.** One construction site beats a rule held at five call sites; a baseline that lives on its draft beats an "also clear these ids" line. It collapsed H1/H2a/H2b/H3 into one bug and J1/J2/J4 into one field.
- **Exhaustive `switch`, never a ternary, for any dispatch on a union that can grow.** The ternary's failure mode is silence, and here it sat on the path deciding whether a destructive button appears.
- **Three-document ownership — what it must do / how it does it / how it looks — with a written ownership rule and cross-references by section number.** It scaled from two documents to three without friction precisely because the rule was written down before the third arrived.
- **Record losses and withdrawals in the decision file, not just wins.** Three people did it here, and it is why nobody defended a position through a review.
- **Foundations before replication.** Phase 3 and the 5a/5b split are the same move at two scales, and both shipped standalone value.
- **Check the payload, not just the entity.** Contracts describe payloads, and that is where the silence concentrates.
