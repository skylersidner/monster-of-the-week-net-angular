### 2026-09-20: A baseline row and the draft it describes are created *and destroyed* in the same step — and the test for that is the drop edge, not the create edge
**By:** Toad (QA Tester)

**What:** Architecture §2 principle 5 is *every persisted, mutable draft field needs a baseline twin*. This is the half that is not stated and that 5b broke twice: **the twin has to appear and disappear with its draft.** A baseline written a statement earlier than the fetch that populates the draft, or cleared in one phase's submit but not in the drain that all four phases run, is the same defect as not having a twin at all — because `idsToRemove` computes *baseline − drafts − disposed* and reads "in the baseline, in no draft" as *the user removed it*.

So: wherever a pair is introduced, the acceptance test must exercise the **destroy/abandon** edge as well as the create edge, and must assert the **baseline** and not only the drafts.

**Why:**

- **Two live defects in 5b, both found only by testing the drop edge, both invisible to every existing assertion.**
  1. `clearDrainedRemovals` lost its minions arm in 5b on the reasoning that "a minion's disposition can only drain while its monster is still on the roster, where the submit's writeback rebuilds that monster's `existingMinionIds`." The first clause is true. The second is not: the drain is wizard-scoped (decision 15) and runs from all four `submitPhaseN`s, while `writeBackMinionDrafts` runs only from phase 1. Drain from phase 0, 2 or 3 and the id stays in the baseline with its disposition cleared — a blind second `DELETE` on the diff path, which has no 404 handler, so the next visit to Monsters cannot be left.
  2. `loadEditData` sets `existingMonsterIds` **before** the hydration it then fails on, in the same `switchMap`. J6's all-or-nothing therefore covers the drafts and not the baseline, and `5b-R7` asserts exactly the half that was implemented. The next phase-1 submit unlinks every monster from the mystery.
- **Both were written as deletions justified by a proof, and a deletion's proof is the thing worth checking.** The first is literally an absent code block with a paragraph explaining why it is safe. Neither had a test, because you cannot write a test for a line that is not there — which is the argument for testing the *invariant* (the baseline is empty when the drafts are) rather than the mechanism.
- **The claim was too wide, not wrong.** The instance it reasons from holds: drained from phase 1, the writeback does clear the baseline. That is why a control asserting the working instance belongs next to the failing ones — otherwise the failures read as a broken harness.
- **This is principle 6 (*a fix that removes a record also removes what that record was incidentally protecting*) with the arrow reversed.** Principle 6 is about removing a record; this is about removing the *removal* of one. Same composition failure, opposite direction, and rev 11 has only the first.

**The test shape, concretely.** For a `draft` / `baseline` pair, four cases rather than two:

| | assert |
|---|---|
| created together | the pair agrees after a submit — already standard |
| **abandoned together** | the load/attach that fails leaves *both* empty, not just the drafts |
| **drained from elsewhere** | every surface that can consume the pair, not the one that maintains it |
| control | the maintaining surface still does maintain it, so the three above are not a harness fault |

**Boundary.** This is for pairs where one side is *derived from the server* and the other is *what the user is editing*. A pair both sides of which are client-side has no divergence to find. The cost is roughly one extra test per pair, and both defects above were one test each.
