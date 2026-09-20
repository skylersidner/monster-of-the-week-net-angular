# Mystery Entity Linking — Phase 5b Acceptance Criteria

**Prepared by:** Peach (Product Owner / Business Analyst)
**Status:** **5b criteria, for the pre-5b pass architecture §9 asks for.** Six findings (§13). **One of them — J1 — should land in the design before Luigi rewrites `submitPhase1`**, because it changes what that function must do rather than adding a test to it. None needs Skyler.
**Date:** 2026-09-20 · branch `mystery-entity-linking-phase-5b`

> Third acceptance artifact, after `mystery-entity-linking-acceptance.md` (Phase 4) and `mystery-entity-linking-acceptance-phase-5.md` (5a + a first sketch of 5b). **This supersedes §4 of the Phase 5 doc**, which was written before the roster's shape was settled and is a fifth of the size 5b needs. §3 of that doc — the 5a criteria — stands as shipped and verified and is not restated here.
>
> Ownership unchanged: what must be true is mine, how it is built is Yoshi's, how it looks and reads is Rosalina's.

---

## 1. Scope, and what is already covered

5b ships the monster roster, decision 19, monster attach, the minion monster-picker, monster linking on the standalone form, and two sweeps.

**Already shipped — do not restate.**

| Shipped | What it covers for 5b |
|---|---|
| **5a** (`f8170eb`) | The per-row sub-resource diff and the dirty check, for monsters and minions; `hydrateMonsterDraft`, whose second caller is 5b's attach; `'minions'` on the removal drain; the re-parent verb, wire-tested; `idsToRemove`'s required `collection`; `persistedForRemoval`'s exhaustive switch; the drain moved out of the monster save chain. **5b adds no new sub-resource behaviour** — criteria `5a-U1…U9` remain the oracle for it and must still pass per roster row. |
| Phase 1 | The monster link and unlink verbs on the backend. 5b needs no backend work; the gap is two client methods. |
| Phase 4 | Attach, re-edit and removal **as behaviours** (AC-A1–A9, R1–R5, D1–D13). 5b inherits them with the noun substituted; §5 and §6 below state only what is monster-specific. |
| Phase 3 | The modal's whole input contract. 5b chooses bindings; it does not re-prove the modal. |

---

## 2. The stories

**US-6.** *As a Keeper, I want a mystery to be able to have several monsters, or none at all, because not every threat is a creature and some cases have more than one.*

**US-7.** *As a Keeper, I want to pull an existing monster into a mystery and have it arrive whole — its attacks, its powers, its minions — and leave whole.*

**US-8.** *As a Keeper with two monsters, I want to say which one a minion belongs to, and change my mind later without losing it.*

---

## 3. Decision 19 — a monster is no longer required

| # | Criterion |
|---|---|
| **5b-O1** | **The proving case.** Create a mystery, press Next through both monster steps without touching anything, finish. The mystery saves, the detail page renders, and **no monster row exists**. Assert the absence of the row, not the appearance of the page — a synthesised empty monster is invisible on the detail page, which is the whole reason this case is named. |
| **5b-O2** | **No monster, but still a submit.** An empty roster issues no monster create, no monster update and no sub-resource calls — and **still drains `pendingRemovals` and still applies the roster diff.** An edit-mode revisit can legitimately reach an empty roster by removing the last monster, so "no monster" must not mean "no submit." |
| **5b-O3** | **Remove the only monster from an existing mystery, finish, and the mystery survives with zero monsters**, rendering "No monsters." on the detail page. |
| **5b-O4** | **Field-level required survives; phase-level required goes — tested as a pair.** An untouched composer advances. A composer with only a name typed **blocks**, marks the fields touched, and shows the blocked-composer message. Rosalina's §16.6 gives the reason the pair is necessary rather than tidy: stripping the validators also produces a wizard that advances, so a single "Next advances on an empty roster" assertion passes in both the correct world and the broken one. |
| **5b-O5** | **The phase-1 bubble is not gated on monster count.** A mystery completed with zero monsters shows phase 1 finished. In edit mode all four phase bubbles show finished on load regardless of content — which also changes the **locations and bystanders** bubbles for a mystery that has none, so assert those too. That is the part of decision 19 that reaches past monsters, and it is the part most likely to be left half-done. |
| **5b-O6** | **The step-0 dot has a defined meaning under a roster** and it is not the retired single-monster predicate. See J3 — this criterion is written against whatever §6.5 decides; today the code reads `monsterPreview()?.name`, which has no roster referent. |
| **5b-O7** | **Step 1 with zero monsters is a calm, reachable state.** The minion composer is suppressed, "Add a monster first — minions belong to a monster." renders in the ordinary empty-state treatment, and **Next is not blocked**. |
| **5b-O8** | **The nudge appears once**, in the step blurb, and nowhere else. No confirmation on Finish, no "this mystery has no monster" band, no asterisk (decision 4, UX §16.2). An explicit absence test, for the same reason AC-R3 was. |

---

## 4. The monster roster

| # | Criterion |
|---|---|
| **5b-R1** | **Several monsters.** Author two in one mystery; both save, both appear on the detail page, both survive a wizard revisit with their sub-resources intact. |
| **5b-R2** | **The truncation is fixed.** Open a mystery that already has more than one monster: all of them hydrate. Because today's loss is silent, the fixture must be built **outside** the wizard — a mystery created through the wizard can never have had a second monster to lose. |
| **5b-R3** | **Every roster row diffs against its own baseline.** Two monsters, edit one attack on the second: exactly one write, and nothing at all for the first monster or for any minion. `5a-U1…U9` per row, not once for the phase — the monster sub-resource diff currently reads four store-level signals and must become per-draft, the shape the minion path already has. |
| **5b-R4** | **Re-edit works on any row** — authored or attached, saved or not — loads into the composer, marks the row, and saves back into the same slot without producing a second card. AC-R1–R5 with the noun substituted. |
| **5b-R5** | **A monster authored in this session and a minion pointing at it both land correctly.** Author two new monsters and a minion against the second, all before the first submit: the minion belongs to the second monster. This is what `localKey → monsterId` resolution exists for and it cannot be tested with hydrated monsters. |
| **5b-R6** | **The roster survives a composer cancel.** Open a row, change its attacks, cancel: the roster row is unchanged and the next submit writes nothing (`5a-U7`, now with a roster between the composer and the draft). |
| **5b-R7** | **Edit-mode load is all-or-nothing.** If one monster's hydration fails in an N-monster mystery, the wizard does not open with a partial roster. Same invariant as attach (§5), for the same reason — see J6. |

---

## 5. Attach — hydrate, then commit

The invariant both documents now carry: **the roster contains only complete drafts, and the submit diff will never see a partially-loaded monster.**

| # | Criterion |
|---|---|
| **5b-T1** | **The named case.** Attach an existing monster with 3 attacks and 2 minions into a mystery that already has one, press Next, and **not one sub-resource is deleted or re-keyed** — in this mystery or in the one the monster came from. |
| **5b-T2** | **Nothing enters the roster until the whole subtree has arrived.** During the fetch there is no roster card, no dossier entry, and the monster is not offered as a minion's parent. Assert the roster, the dossier and the picker, not just the roster — §17.1's reasoning is that all four consumers depend on completeness, so all four are where a half-row would show. |
| **5b-T3** | **The failure case, and it is the sharpest test in the phase.** Make the **minion** fetch fail on an attach: the roster is unchanged, no baseline is written, the picker is re-enabled and still offers that monster, and **pressing Next afterwards touches no monster at all.** This is the one path in the design that produces genuine sub-resource destruction rather than harmless churn, and it is invisible until it destroys something. Test the `getById` failure too — the two halves of the `forkJoin` fail differently and only one of them is named in the plan. |
| **5b-T4** | **The busy state lives in the strip.** Picking disables the control, shows the picked name and a spinner; success resets it to the placeholder and filters the option out; failure resets and re-enables it with an inline error that the next successful pick clears. No wizard footer band for this (UX §17.1–17.2). |
| **5b-T5** | **`Next` is disabled while an attach is in flight** (UX §17.3), so a deliberate pick cannot silently evaporate. One more condition on a control that already has the behaviour. |
| **5b-T6** | **The card's counts come from the draft's own collections, never from `MonsterListItemResponse`'s `attackCount`/…** (UX §17.2). The bite: a card reading `Attacks: 4` beside a composer showing none must not be reachable by *any* path, including future ones. Derive-from-one-source is the criterion; the current absence of the bug is not. |
| **5b-T7** | **Attach brings the minions** (decision 13), and they appear on the minion step parented to that monster. |
| **5b-T8** | **Adding a minion to an attached monster adds it in every mystery that uses that monster.** No warning copy (decision 4). |
| **5b-T9** | **Attach is monsters-only in its divergence.** The locations and bystanders strips gain no busy or error state — they have no fetch, and a state that cannot trigger is dead code (UX §17.5). Assert that those two phases still attach with zero requests. |

---

## 6. Removal — monsters, and the cascade

| # | Criterion |
|---|---|
| **5b-M1** | **Both dispositions, keyed on the baseline.** A monster in `existingMonsterIds` offers `Cancel · Detach · Delete`; one attached this session and not yet submitted offers **Remove** only, with no API call (decision 16). The second is where the destructive button would be most consequential, so it gets its own test rather than riding on the locations one. |
| **5b-M2** | **Detach → the monster and every one of its minions survive**, here and in every other mystery. Verify the minions from the *other* mystery, not from this wizard. |
| **5b-M3** | **Delete → the modal lists the minions, and they cascade.** Exactly **one** `DELETE` is issued, for the monster. No separate deletes for the cascaded children, from the drain **or from the minion diff** (§7.7d, and J1). Ledger assertion; "the minions are gone" passes either way. |
| **5b-M4** | **J1's sequence, and it is a correctness criterion rather than a hygiene one.** Remove a monster that has persisted minions, under **each** disposition, and press Next. Under detach the minions still exist; under delete the phase completes without a stray 404. Today's rules produce the opposite of both — see J1. |
| **5b-M5** | **H4's sequence.** Delete a minion, then **detach** its monster, then Next: the minion still exists. The modal promised detach leaves minions untouched, and this is the sequence where that promise was reachable and false. |
| **5b-M6** | **The G1 case on the monster roster.** Trash a monster, confirm Delete, jump via the tracker, Finish. It is gone. |
| **5b-M7** | **Remove-then-re-attach cancels the disposition**, asserted for Delete specifically (AC-D9 with the noun substituted). |
| **5b-M8** | **Removing the last monster takes its minions off the roster**, and the minion step then shows 5b-O7's empty state rather than orphaned cards. |

---

## 7. The minion picker and re-parenting

| # | Criterion |
|---|---|
| **5b-K1** | **One monster → no picker**, prose line names it. **Two or more → a picker as the composer's first field**, required, with the shipped error sentence. **Zero → 5b-O7.** |
| **5b-K2** | **The picker's options are the in-memory roster**, including monsters with no server id yet (5b-R5). |
| **5b-K3** | **Re-parenting works from the wizard**: change a persisted minion's monster and submit — it moves, via `moveToMonster`, and its sub-resources move with it unchanged in content and id. No confirmation dialog; it is a field edit. |
| **5b-K4** | **A re-parent fires only when the parent actually changed.** Submitting with nothing edited issues **no** `moveToMonster` calls. This is the criterion J2 exists for; it is unimplementable as the draft is currently specified. |
| **5b-K5** | **A minion cannot be saved without a monster**, and re-parenting onto a monster added this session resolves correctly (the `localKey` path again, now on the update side rather than the create side). |
| **5b-K6** | **The minion roster shows which monster each minion belongs to**, and it updates when a re-parent is committed to the draft — before the submit, not after. |

---

## 8. Monster linking on the standalone form

| # | Criterion |
|---|---|
| **5b-L1** | `MonsterFormComponent` gains the mystery multi-select, and its detail and create pages behave exactly as the Location and Bystander ones have since Phase 2 — membership add, remove, both in one save, the post-save refetch, the hedged partial-failure copy, and the create path with zero, one and two mysteries selected. **These are Phase 2's criteria with the noun substituted**; the only thing 5b adds is that they now apply to monsters. |
| **5b-L2** | **A monster attached from its own detail page is visible in that mystery's wizard.** This is the sequencing constraint §6.2 exists for — it is the reason monster linking waited for the roster, and it is the one assertion that proves the wait was the right call. |

---

## 9. Sweeps and hygiene

| # | Criterion |
|---|---|
| **5b-X1** | **No `track $index` remains anywhere in the wizard**, including `mystery-create-dossier.html:232,248`. Bite: reverting one token fails a test. |
| **5b-X2** | **The four composer signals are renamed `minion…` before a second composer exists.** A naming criterion earns a place here only because doing it after is four files of churn in the riskiest phase. |
| **5b-X3** | **The dossier renders a monster roster with an empty state**, one compact entry per draft, exactly one expanded — the one in the composer. |
| **5b-X4** | **`monsterPreview()` is retired at every consumer, not just the dossier's section guard** — see J5. |

---

## 10. Accepted states

Phase 4's S1–S5 and Phase 5's S6–S8 all still hold. Two more:

| # | Expected behaviour |
|---|---|
| **S9** | **Edit-mode load fans out with the roster.** `hydrateMonsterDraft` is 1 + 1 + N per monster, so a three-monster mystery with two minions each is twelve requests before the wizard paints, on top of the base load. No paging exists anywhere in this app (F7) and none is being added. This is the first place a single page load's request count scales with user content; it is accepted, and it is stated so it is not rediscovered as a regression. |
| **S10** | **A monster attach costs five requests for a three-minion monster, once, per attach.** Deliberate reuse of the shipped path rather than a new expand-style endpoint (§6.6, §8.7). |

---

## 11. Out of scope

- Attach or detach from the mystery detail page — F1/F2.
- Detach anywhere outside the wizard — §7.5, unchanged.
- The screen-reader announcement region and roster button labels — UX §8 items 2 and 3, follow-ups under Skyler's waiver. **5b must not re-raise them as blockers.**
- An expand-style `GET /api/monsters/{id}` returning minions — §8.7.
- Losing unsubmitted field edits on a tracker jump — F9, deliberate.

---

## 12. Definition of done

5b is done when §§3–9 hold; `5a-U1…U9` still pass per roster row; Phase 2's criteria pass for monsters (5b-L1); Phase 4's criteria pass for monsters with the noun substituted; S9 and S10 are observed and accepted; and §13's findings are each resolved or explicitly deferred.

---

## 13. Findings — six, separated from the criteria

**None of these needs Skyler.** All six are internal correctness or consistency questions with no product choice inside them. §13.4 is the closest call and §13.4 says why it still isn't one.

### J1 — Removing a monster makes the minion diff destroy its minions. This should be fixed in the design before `submitPhase1` is rewritten.

Three rules that are each correct on their own:

- **§7.7d** — removing a monster drops its minion drafts from the local roster and records **one** disposition, for the monster.
- **§7.7f** — `applyPendingRemovals` drops every pending `'minions'` disposition whose parent left the roster.
- **`idsToRemove`** (`mystery-create.store.ts:1975-1992`) — delete set = baseline ids, minus ids in the drafts, minus ids with a recorded disposition.

Compose them. A persisted minion whose monster is removed is **in `existingMinionIds`** ✓, **not in `minionDrafts()`** ✓ (dropped with its parent by §7.7d), and **has no disposition** ✓ (dropped by §7.7f). So it lands in `removedIds` at `:1914` and `saveMinionDrafts` fires a blind `minionService.delete(minionId)` for it.

**That path has no 404 handler.** `removalRequest`'s `catchError` (`:2074`) is scoped to the drain — deliberately, and §7.3 rule 2 says so. The diff is a different path.

Two outcomes, both bad, and the second is worse than a bug:

- **Monster detached** — the minions are **actually destroyed, everywhere.** Detach's entire meaning is that the monster and its minions survive (§6.4), and the modal says so in as many words. The user reads a promise and the code does the opposite.
- **Monster deleted** — the FK cascade already destroyed them, so the blind delete 404s and **fails the whole phase**. Non-deterministically: the drain and the minion diff are concurrent `forkJoin` siblings (`:1772-1775`), so which one gets there first varies.

**The root cause is worth stating precisely, because it makes the fix obvious and because it is a pattern.** §7.7f was the right fix for the disposition path — but dropping the disposition *removes the only thing that was excluding that id from the diff*. The fix opened the second door. `idsToRemove`'s exclusion set and `stillTheRostersBusiness`'s drop rule are the same fact expressed in two places, and they now disagree.

**The missing rule, and it already exists one level over:** when a monster leaves the roster, its minions' ids must leave `existingMinionIds` too. That is exactly the baseline bookkeeping `clearDrainedRemovals` already performs for drained removals (`:2086`, consumer 2 — *"drop the id from the owning collection's baseline, otherwise that phase's own `idsToRemove()` later sees an id in the baseline and not in the drafts and fires a second removal"*). The drop path needs the same step the drain path has. **→ Yoshi**, and it belongs in §7.7 before Luigi writes the roster diff, because it changes what `submitPhase1` does rather than adding a test to it.

### J2 — `MinionDraft` has no baseline parent, so "did the parent change?" cannot be asked

§6.4 gives `MinionDraft` a `monsterKey` and nothing else. `MinionDraft` today (`:190-213`) carries no parent field of any kind, and `existingMinionIds` is ids only. So after 5b there is still no record of **which monster a minion belonged to when it was loaded or last saved** — only which one it points at now.

That leaves two implementable options, and one of them is a trap:

- **Fire `moveToMonster` unconditionally for every persisted minion on every submit.** It works. But Bowser's caveat (§6.4) is that this verb **moves** rather than adds, and a call against a stale id *silently relocates a minion rather than failing*. Issuing it N times per submit maximises exposure to any `localKey → monsterId` resolution bug and converts what should be a visible consequence of a user action into a background write. It is also N no-op writes per Next, in the phase that just spent its whole budget removing exactly that.
- **Fire it only when the parent changed** — which needs the baseline this type does not have.

**Recommendation, as input:** `MinionDraft` carries the parent it was hydrated or last saved with, written in the same step as `id` and the four sub-resource baselines — the structural move §5.2's invariant already established for everything else on this draft. Then `5b-K4` is implementable and the re-parent verb is called only when a re-parent was actually asked for. **→ Yoshi**, a one-field addition to §6.4's type.

### J3 — Two completeness mechanisms, and §6.5 discusses only one

`phaseComplete` — the phase bubble and create-mode accessibility — is what §6.5 analyses, correctly.

`phaseStepComplete` (`:585-611`) is a different thing: the per-**step** dots. Its phase-1 step-0 entry (`:601`) reads `monsterPreview()?.name` and `monsterValue()?.monsterArchetypeId`, and **both of those are the single-monster shape being retired.** Nobody has said what that dot means under a roster.

The consistent answer looks obvious — `monsterDrafts().length > 0`, matching the minion, location and bystander entries, which are all "lights when the roster is non-empty" for collections that are all optional. Note that UX §16.2's *"do not gate the phase-1 tracker dot on monster count"* is about the **phase bubble**, and reading it as covering the step dot would produce a dot that is permanently lit. That is precisely the conflation worth preventing, which is why this is written down rather than left to be inferred. **→ Yoshi, with Rosalina to confirm the step dot reads as content-presence rather than as required-ness.**

### J4 — "Removing a monster takes its minions" silently doesn't hold for a minion re-parented onto it this session

Re-parent minion M from monster A to monster B in the composer, then remove B, then Next. M's draft leaves the roster with B. Under J1's fix it is not deleted, and its disposition (if any) is dropped. But **the re-parent was never submitted either** — removals and edits both apply at the phase transition, and M left the roster before it got there. So on the server M is still parented to **A**, alive and back where it started.

§6.4 states "removing a monster takes its minions" as a rule. It holds for minions the monster actually owns on the server, and not for ones this session moved onto it. That is defensible — removal operates on server truth — but it is unstated, and the plain reading of the rule predicts the opposite.

**This is the finding closest to needing Skyler, and it still doesn't**, because both candidate behaviours are coherent and the difference is invisible except in a sequence a user is unlikely to perform deliberately. What it needs is for the criterion to assert the **actual** outcome rather than the rule's plain reading, so the first person to hit it doesn't file it as a bug. **→ Yoshi**, one clarifying sentence in §6.4.

### J5 — `monsterPreview()` has four consumers, and §6.5 names one

§6.5 says the dossier's monster block is guarded by `monsterPreview().name` (`mystery-create-dossier.html:56`). It is also the source of that block's **contents** — `mystery-create-dossier.html:75, 83, 96, 109` render the monster's attacks, powers, weaknesses and armors from `store.monsterPreview().attacks` and siblings — and it is read by `phaseStepComplete:601` (J3). Retiring it is four consumers and two files, not a guard. Cheap to say now, irritating to discover mid-phase. **→ Yoshi**, an accuracy fix to §6.5's read-side bullet.

### J6 — Edit-mode hydration now fans out per monster, with no error isolation

`hydrateMonsterDraft` is 1 + 1 + N. `loadEditData` calls it once today; in 5b it calls it once per monster, inside the load that already `forkJoin`s eleven keys. A three-monster mystery with two minions each is twelve requests before the wizard paints.

The volume is accepted (S9, F7). **The error behaviour is the part worth deciding rather than inheriting:** a single `forkJoin` over N hydrations means one failed `getById` on the third monster fails the entire edit-mode load, and the user cannot open the mystery at all. The alternative — hydrate what you can and open with a partial roster — is **wrong** and must not be chosen, for exactly the reason §17.4 gives about attach: a roster that is missing a monster is a roster whose diff will treat "nothing" as the user's intent, and the mystery's own edit surface is the worst possible place for that.

So the recommendation is to keep all-or-nothing and **say so**, rather than leave it as an accident of using `forkJoin`. `5b-R7` asserts it. **→ Yoshi**, one sentence in §6.6 extending the hydrate-then-commit invariant from attach to edit-mode load, where it is currently only implied.
