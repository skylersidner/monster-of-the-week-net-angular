# Engineering Practice Improvements — Implementation Plan

**Prepared by:** Yoshi (Architect)
**Status:** **All six settled. Three implemented, two adopted and pending, one abandoned; R6 deferred.** **R1, R3 and R4 are done** (`56f237f`, `a60a30f`). **R2 is abandoned** — see §4, and note carefully what survives it. **R9 and R10 are adopted** as of 2026-09-21, and his reasons for wanting them differ from mine in ways that change how they should be written (§6, §7). **R6 is not funded**, with a revisit trigger and an evidence pack (§9).
**Date:** 2026-09-21 (rev 3)

> **Two things to read if you read nothing else.** R2's abandonment removes the *counted deliverable*, not the practice and not the three targeting rules (§4). And R10 has a **second consumer nobody planned for** — Skyler, choosing which model runs which phase — which changes what the register has to be legible to (§7).

> **Source.** This plans the four change recommendations in `docs/updates/mystery-entity-linking-retrospective.md` (Koopa), plus two items its supporting findings support more strongly than its recommendation list does. I have re-verified every claim I am planning against rather than taking the retrospective's word for it; where I disagree with Koopa I say so and why.
>
> **Reading this cold.** You do not need to have followed the mystery-entity-linking feature. The short version: one feature shipped in nineteen hours across seven contributors and six review passes, and the review passes found fifty defects by reading code against four by reading documents. Roughly twenty-five already-green tests were found to be incapable of failing. Five build and verification steps were found to report success while doing nothing. This plan is about those two facts.

---

## 1. The one-paragraph case

Every item below closes the same failure mode: **a green result that means nothing.** A type-check that checks no files, a test suite that cannot fail, a risk register that names a hazard a wrong implementation would pass, a count written down rather than derived. The feature that prompted this found each of those by accident — by one person choosing a reading surface nobody had assigned them. Four of the retrospective's five "this was luck" items are that same shape. The plan's purpose is to convert as much of that luck into process as is worth paying for, **and to make each piece droppable** if it turns out not to be.

**On cost discipline.** Four of these six are one-off fixes with no ongoing tax. Two are permanent changes to how every future phase runs, and those two carry the most argument below. A practice nobody can drop is worse than one nobody adopts, so every item has an explicit un-adoption route and a signal that should trigger it.

---

## 2. Verdict on Koopa's four, before the plans

| Koopa | My verdict | Skyler's decision |
|---|---|---|
| **R1** Fix three silently-succeeding verification steps | **Adopt, first.** Strongest item in the set: cheapest, most certain, zero ongoing tax. Add a fourth instance and a detector. | **Done** (`56f237f`). |
| **R2** Make "break it and name the test that fails" a **counted** deliverable | **Adopt the practice, reject the metric.** The count is not merely gameable, it is **inversely informative**. | **Abandoned** — *"I was also dubious about this and Yoshi's pushback feels like the right call."* He had independent reservations before reading mine. **§4 records what survives.** |
| **R3** Every review brief names a code artifact | **Adopt, and promote it above R2.** Highest-leverage item Koopa lists, on his own evidence. Needs a *default* surface list. | **Done** (`56f237f`). |
| **R4** Drain `.squad/decisions/inbox/` | **Adopt the goal, reject "drain".** ~15 promotions and a rename, not 126 migrations. | **Done** (`a60a30f`), and he went further than the plan proposed: **`decisions.md` is retired outright**, not kept as an index. Koopa owned it. |

**Two items I added**, both from the retrospective's findings rather than its recommendation list, and both implicating my own work. **Both adopted 2026-09-21, and in both cases his reason differs from mine in a way that changes how they should be written:**

- **R9** — ship the facts and the question, not a mechanism. He supplied the boundary I was missing (*decide the mundane*), reframed the purpose as **explicit intent**, and gave usable feedback on the questions themselves. §6.
- **R10** — every risk-register entry carries a falsifier. He wants it as a **per-phase risk gauge for choosing which model runs which phase** — a second consumer I had not planned for, which changes what the register must be legible to. §7.

**Where everything stands:** R1, R3 and R4 are implemented (`56f237f`, `a60a30f`). R9 and R10 are adopted and unstarted. R2 is abandoned (§4). R6 is deferred with an evidence pack (§9).

---

## 3. R1 — Fix the verification steps that report success while doing nothing

**Done — `56f237f`.** Planned against the tree at `68ea8c5`; the implementation notes inline below record what verification changed about the claims.

### What specifically changes

**(a) The type-check checks nothing.** `src/web/monster-of-the-week-web/tsconfig.json` is solution-style — `"files": []` with references to `tsconfig.app.json` and `tsconfig.spec.json`. `tsc -p tsconfig.json` therefore compiles zero files and exits 0 on a tree with a real type error. **`package.json` has no `typecheck` script at all** (it has `ng`, `start`, `build`, `watch`, `test`), so there is nothing to repoint — this is an addition, not a fix:

```json
"typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit"
```

> **Implemented and verified 2026-09-21, with the value claim narrowed by what the verification found.** Both halves were confirmed to fail on a deliberate `TS2322` (exit 2, file and line reported) and the old `tsc -p tsconfig.json` confirmed to exit **0** on the same two trees. But Luigi checked what the existing commands already cover rather than assuming, and the honest claim is narrower than "it catches what nothing else does":
>
> - **App-side it is fully redundant with `ng build`.** He expected an unimported file to slip past the bundler and probed it — a file nothing imports still failed the production build, because `ng build` type-checks the whole `tsconfig.app.json` include set rather than what the entry point reaches.
> - **Spec-side `ng build` exits 0** (specs are excluded from that config) **but `ng test` does catch it**, as a build failure before any test runs. So the gap is *between* the two commands, not beyond them.
>
> What it is actually worth, stated so nobody oversells it later: one command answers "does this tree type-check", where today that takes two with different failure vocabularies; it runs in seconds with no bundler, jsdom or test execution; and **it still works when the suite cannot start** — a spec-tree type error surfaces from `ng test` as a *build* failure, which makes "the tests are broken" and "the types are broken" indistinguishable from its output. The concrete risk it closes is a developer running `ng build` before pushing and getting a green build on a broken spec tree.
>
> **Nothing in this repo runs either suite automatically** — no `.github/workflows/`, no installed git hooks, no task runner, and the `Dockerfile` is ship-only and runs no tests. So there is no existing automation this would naturally join, and it was deliberately not wired anywhere.

**(b) `--artifacts-path` produces 184 spurious failures.** `PickRuleTable.ApiProjectRoot()` (`src/api/MonsterOfTheWeek.Api.Tests/Services/PickRuleTable.cs:132-141`) walks up from `AppContext.BaseDirectory` looking for `MonsterOfTheWeek.slnx`; redirecting artifacts moves the assembly outside the tree and the walk fails. Koopa asks for this to live "somewhere a new contributor reads before running tests." **That place does not exist** — `README.md` documents no test commands whatever. So (b) is really: add a Testing section to `README.md` covering how to run both suites, with the prohibition and its cause stated there.

**(c) Mutation restores silently run the mutant.** `Copy-Item` preserves the *source's* `LastWriteTime`, so MSBuild skips the rebuild and the next `dotnet test` executes the mutant assembly. Any documented mutation recipe on the C# tree must `(Get-Item $f).LastWriteTime = Get-Date` after restoring. The existing `cmp`/hash check proves the bytes and says nothing about the build — which is why this presented as flakiness and cost an hour.

**(d) — mine, not Koopa's. A detector, so this is not a list of three.** All three are instances of one class, and the class will recur. Add a `verify-the-verifier` step to the Testing section: **each verification command must have a recorded negative control** — break a type, confirm `typecheck` fails; break a test, confirm the suite fails. Run at adoption, and again whenever a verification command changes. Five minutes, and it is the only thing here that generalises.

### Ownership, cost, success, un-adoption

- **Owner:** Luigi for (a), Bowser for (b) and (c), either for (d).
- **Cost:** under half a day total. No ongoing tax.
- **How we would know it worked:** introduce a deliberate type error and confirm `npm run typecheck` fails; run `dotnet test --artifacts-path` once and confirm the README's warning matches what happens; restore a mutant and confirm the rebuild occurs.
- **Un-adopting:** not applicable in any meaningful sense — these are corrections to broken tools, not practices. The only reversible piece is (d), which is one line in a README.

---

## 4. R2 — **Abandoned.** What that does and does not remove

**Decided 2026-09-21: not adopted in any form.** Skyler: *"Abandon R2. I was also dubious about this and Yoshi's pushback feels like the right call."* He had independent reservations before reading the argument below, which is worth recording — this was a convergence, not a persuasion.

### What is gone, and what is not

The proposal was to make "break it and name the test that fails" a **counted, required phase-report deliverable.** That is what was abandoned. Read literally and no further:

| | Status |
|---|---|
| A **required, counted** negative-control deliverable in the phase report | **Abandoned.** Do not re-introduce it as a "recommended" section either — that is the same tax with a softer name. |
| The **practice** of deliberately breaking code and naming the test that fails | **Unchanged and voluntary.** It found ~25 dead tests and both production bugs in this feature. Nobody was asked to do it then, and nobody is being asked now. |
| The **three targeting rules** (below) | **Retained as standing decisions, in their own right.** They are filed as decision records and earned their place on evidence. They were never part of the metric and do not fall with it. |
| The **misses-and-resolutions** framing | **Retained as the shape to reach for *if* this is ever revisited.** Not adopted; recorded so a revisit does not start from the count again. |

**This distinction is the main hazard in this revision.** "R2 is abandoned" read carelessly deletes three rules that are the actual yield, and leaves the count as the thing anyone remembers proposing.

### The three targeting rules — retained, and where they live

These tell you *where to aim* a negative control. They are the durable part and each is already a filed decision:

1. **Assert the complete sorted multiset of calls wherever two code paths can reach one endpoint** — `.squad/decisions/inbox/toad-exact-call-ledger-over-positive-assertions.md`. A positive assertion cannot see a duplicate, and in this feature a duplicate *unlink* failed a whole phase where a duplicate delete was survivable.
2. **Derive any counting assertion's N; never write it down.** A written count silently narrows every time the surface grows. Two instances here: a call-site census sat at 13-in-12 while the truth became 16-in-14, and an Escape-key sweep held its counts in exactly the two states where the new controls do not render.
3. **Test the drop edge of any baseline/draft pair, and assert the baseline, not only the drafts** — `.squad/decisions/inbox/toad-a-baseline-and-its-draft-are-created-and-destroyed-together.md`. This is the rule that would have caught both production bugs.

**Note for whoever runs R4:** these three are among the ~15 cross-cutting decisions that should be promoted, and they matter *more* now that R2 is abandoned, because the promoted record is the only place they will be visible.

### Why the count was the wrong deliverable — recorded so it is not re-proposed

This is the part worth keeping in a year, when someone reasonably suggests counting negative controls again.

The number reported for this feature was **136 negative controls, 13 MISSED.**

**The informative number is 13, and it is informative in the direction opposite to the one a target would push.** A control that *fails as expected* tells you a test you already trusted still works — near-zero information. A control that is **MISSED**, where the suite stays green against broken code, is the finding. Thirteen misses in 136 is evidence the controls were aimed where coverage was genuinely uncertain. **A phase reporting 200 controls and zero misses would score better on the count and be worth less**, because zero misses is the signature of mutations chosen where the author already knew the answer.

So the count is not neutral-but-gameable. **It is inversely informative: optimising it drives mutation selection away from uncertainty, which is the only place the practice pays.**

A second objection stands independently. The count measures *effort*, and effort was never the scarce thing — nineteen hours of wall clock produced 136 controls with nobody being asked. What was scarce was **knowing where to aim**, which the three rules supply and a number does not.

### If it is ever revisited

Reach for **misses, not counts**: *"for each mutation the suite did not catch: what was mutated, what should have failed, what was done about it,"* with "no misses" treated as a claim requiring justification rather than a score.

And know the exit before adopting: **Stryker** (.NET and JS) does mutation testing mechanically and removes the judgement entirely. Not worth adopting now — a much heavier commitment than the problem currently justifies, and the hand-run version is finding things. But it is the tool-shaped replacement, and a practice with a known exit is safer to adopt than one without.

### The evidence the practice is worth keeping voluntarily

It found roughly twenty-five green tests that could not fail, including three fake repositories that hardcoded their return value, a 415-line call-site census comparing three literal lines against themselves, and `Validators.required` strippable from three controls without a single one of 1184 tests noticing. Nothing else in the engagement could have found any of those. That is not in question.


---

## 5. R3 — Every review brief names a code artifact

**Done — `56f237f`.** With R2 abandoned, this was the only process change of the four, and on Koopa's own numbers it is the highest-leverage item in the set: findings came from code over documents at roughly **50 to 4**, and four of his five "this was luck" items were one person choosing a reading surface nobody had assigned.

The sharpest supporting evidence is not the ratio. It is that **in every case where a document was wrong, the documents agreed with each other.** Two competent authors both asserted a re-parent capability the API did not have; the request record said otherwise and neither author had reason to open it. Document review cannot find that class at any depth, because agreement between documents is not evidence.

### What specifically changes

**Every review brief names the artifact to open.** Not "review the design for X" but "read `ApiContracts.cs` and confirm the payloads support X." The instruction that produced the highest-yield pass in the feature was four words: *read the code, not the plan.*

**And the surfaces are enumerated at phase-plan time, with a default list** — this is my addition. Koopa says enumerate per feature, which is right but invites each feature to re-derive it from nothing. The default for this codebase, derived from where the fifty findings actually came from:

| Surface | Holds | Typical reviewer |
|---|---|---|
| `Contracts/ApiContracts.cs` + the request records | What the API will actually accept | Bowser |
| `core/models.ts` | What the client believes the API returns | Peach — her own note: *"the single highest-yield file this pass"*, and she read it unprompted three times |
| The feature's largest store or service file | The old invariants the new design has to live with | Luigi |
| A running repro | Timing and scope, which reading cannot reach | Toad |

**One line goes in the brief template**, Peach's, because it names the gap rather than the surface: **"Check the payload, not just the entity. Design docs describe entities; contracts describe payloads, and that is where the silence concentrates."**

### Ownership, cost, success, un-adoption

- **Owner:** whoever writes review briefs — in practice Mario or the agent scheduling the review. Peach owns the default surface list, since three of the four entries came from her passes.
- **Cost:** zero marginal. It changes the wording of briefs that are already being written.
- **How we would know it worked:** findings keep arriving from the assigned surfaces rather than from whoever happened to look. **The failure signal is a review pass that produces only document-internal findings** — that means the brief sent someone to the documents again.
- **Un-adopting:** stop naming artifacts. Nothing else depends on it.

---

## 6. R9 — Ship the facts and the question, not a mechanism

**Adopted 2026-09-21.** Koopa's R8, promoted. It implicates my own work and he is right.

> **Skyler's reasoning, which supplies the boundary this item was missing and reframes its purpose.** Three things from his answer, each changing how the rule should be applied.
>
> **1. The boundary is "mundane versus consequential", not "decide versus ask."** His words: *"Obviously everything can't be a question. Some of the benefit an agent brings to the table is assumption and decision about the mundane or obvious."* As written below the item could be read as licence to escalate everything, and that reading is wrong. **Deciding the mundane is the job.** `origin` was not a mundane call — it was a mechanism encoding an unanswered *ownership* question, which is as consequential as this feature had. So the rule is: **decide the mundane; do not build a mechanism for the consequential thing you have not asked about yet.** The failure mode is not "assumed too much", it is "built a hedge instead of asking."
>
> **2. The goal is explicit intent, not merely avoided waste.** *"Some recent reading I've done encourages a focus on 'explicit intent' to ensure that the agent can make decisions based on a strong understanding of the goal and the ideas surrounding the goal."* That is a better statement of the item's purpose than mine. I justified shipping facts + options + consequences as *avoiding thrown-away mechanisms* — a cost argument. His is a capability argument: **a decision made against stated intent is one the agent can then extend correctly without asking again.** This is why the *facts* half is mandatory rather than decorative. It also predicts something my version does not: the more of the surrounding intent a stakeholder answer carries, the fewer follow-up rounds it needs. Decision 19 ("a monster is not required") is the example — one sentence of intent, and §6.5 of the architecture document derived the validation, tracker and read-side consequences without a second round.
>
> **3. Question hygiene — his feedback on the questions themselves, taken at face value.** *"I have found the questions to be relatively solid, although some do seem more intricate and archaic (though that's possibly just because of lack of experience on my part)."* He discounts it; I would not. Some of the twenty questions were more intricate than they needed to be, and the pattern is identifiable: **the count-versus-names copy question and the predicate-shape questions were implementation detail dressed as stakeholder decisions.** Whether a modal names other mysteries or counts them is a product question; whether the predicate reads a baseline or an `id` is not, and putting the second to him spent a round of his attention on something I should have decided and recorded.
>
> **The companion rule: a question put to him should be one where his answer changes what gets built, stated in the product's terms rather than the mechanism's.** If the honest phrasing requires naming a store signal, it is probably mine to decide. That is his feedback, not an invention, and it is the natural other half of "decide the mundane."

### The correction, taken straight

I wrote at rev 5 of the architecture document: *"every round of stakeholder answers made the design smaller, not bigger."* Koopa checked it against the nineteen decisions and it is **false**. Round 1 added the full monster roster — the single largest scope item in the feature — plus a confirmed Detach/Delete modal whose own consequence column reads *"Broadens scope, accepted"*, plus re-editability of every entity. Round 2 added sub-resource upsert, seven service methods, and dirty-tracking on top of it. Round 4 added minions to the removal drain, built the re-parent verb, and made a monster optional. **Scope grew in three of four rounds.** I did not check before writing it, which is the same failure as every other correction in §3.3 of the retrospective — a claim stated from impression rather than re-derived.

What actually shrank each round was **a mechanism I had designed in anticipation of an answer**: the `origin` flag, the three-way submit diff, the Detach sweep outside the wizard, the dirty-tracking fallback branch. Four of them, all hedging a branch nobody had chosen, all discarded.

### Why this is the highest-leverage item, and it is a controlled comparison

Rev 1 of the architecture document contained two things written the same day by the same person:

- **§1, a source-verified current-state audit.** Survived twelve revisions unchanged and is the most-cited section in the document.
- **§5.1's `origin: 'authored' | 'attached'` flag**, designed to be correct under either answer to an unasked ownership question. Took **three revisions and a peer disagreement** to remove, and Rosalina spent a review round arguing to narrow it before it was dropped entirely.

Same author, same document, same day. The difference is that one was facts and the other was a mechanism presuming an answer.

### What specifically changes, in a form that is checkable

Before a stakeholder round, the deliverable is: **the verified facts that constrain the answer, the options, and the consequence of each.** No type, field, branch or flag whose only purpose is to be correct under either branch.

**The tell, and it is mechanical enough to self-apply:** *does any new type, field or branch in this revision exist only because a question is unanswered?* If yes, delete it and write the question instead. `origin` would have failed that check on the day it was written.

### Ownership, cost, success, un-adoption

- **Owner:** me, and anyone else writing a design document ahead of a stakeholder decision.
- **Cost:** negative. It removes work rather than adding it — four mechanisms in this feature would not have been built.
- **How we would know it worked:** design revisions that follow a stakeholder answer get shorter rather than longer, and no revision spends its budget removing something the previous one added.
- **Un-adopting:** it is a habit, not a mechanism; there is nothing to remove. **The over-application guard is Skyler's, and it is better than the one I first wrote.** Mine was "the facts are still mandatory" — true but weak, since a document can carry facts and still escalate everything. His is the sharper test: **is this call mundane or consequential?** A design document that turns mundane calls into questions has failed in the opposite direction, and *"some of the benefit an agent brings is assumption and decision about the mundane"* is the standard to measure against. The watch signal is a rising question count per revision with a falling rate of answers that change anything.

---

## 7. R10 — Every risk-register entry carries a falsifier

**Adopted 2026-09-21.** New, and not in Koopa's recommendation list, though his §8 finding is what produced it. This also implicates my own work.

> **His reason for wanting it is not mine, and it is load-bearing enough to change the requirements.** *"I actually really like the risk proposal, as it's the best way to get a fast high-level gauge for which work will have the most impact and risk for issues. It also empowers me to tweak the agent model on a per-phase basis, so I can scope higher risk actions to more thoughtful modeling."*
>
> **So the register has a second consumer I did not plan for: Skyler, deciding which model runs which phase.** A standing memory already records a model-by-risk policy — Opus for medium and high risk phases, Sonnet for low — so this is an existing practice the register would *feed* rather than a new one it creates. That is a stronger position than the one I argued from, and it survives R2's abandonment intact.
>
> **What the second consumer changes, concretely:**
>
> | | My version | What his use needs |
> |---|---|---|
> | Audience | Toad, turning a falsifier into a mutation target | **Also Skyler, before a phase starts**, deciding where to spend capability |
> | Granularity | Per risk, unordered | **Comparable across phases** — at minimum each entry tagged with the phase it lands in, so a phase's risk can be read off without reconstructing it |
> | The falsifier's job | Tell a tester what to mutate | **Also convey severity to a non-implementer.** "A wrong implementation passes a content-preservation test" tells Toad where to aim *and* tells Skyler this one is silent, which is the property that should buy a better model |
> | Register shape | A list at the back of the document | **Readable before the work, not after it.** A register that is only legible to its author does not serve a per-phase staffing decision |
>
> The practical addition is small: **tag each entry with its phase, and write the falsifier so that its severity is visible in the sentence** — silent versus loud, recoverable versus not. Both bugs that shipped to QA in this feature were silent, and that is exactly the distinction a staffing decision turns on.

### The finding

The architecture document's §8 risk register has eight entries. Two drove phases and one was written retrospectively. **None of the fifteen review findings appears in it** — not G1, G2 or G3; not H1 through H6; not J1 through J6; not either production bug; not the re-parent gap.

The damning part is not the miss rate. It is the one entry that named the right class and still would not have helped. §8.1 named the delete-all/recreate-all trap correctly. Peach's H2 then showed that a wrong implementation of it produces **churn rather than destruction** — content survives, keys rotate — so *"a wrong implementation passes a content-preservation test,"* which is precisely the test the risk as written would have prompted someone to write.

**A risk register that names classes without naming what a wrong implementation looks like to a test is a list, not a control.** I wrote that register, and it was decoration.

### What specifically changes

Every risk entry gains one sentence: **"a wrong implementation of this would look like ___ to a test."** If that sentence cannot be written, the risk is not understood well enough to be listed, and listing it creates false comfort.

**And the register becomes the input to R2's mutation plan**, which is where the two items compose. §8.1's falsifier — *"content survives and every key rotates, so assert key stability, not content preservation"* — is exactly a mutation target. A risk register that feeds the mutation checklist is doing work; one that sits at the back of a document is not.

### Ownership, cost, success, un-adoption

- **Owner:** me, for architecture documents. **Two consumers, not one:** Skyler reads it before a phase to decide model-by-risk; Toad reads the falsifiers as mutation targets.
- **Cost:** one sentence plus a phase tag per entry. The sentence is hard to write, which is the point. Expect the register to get *shorter*, because entries that cannot carry a falsifier should be deleted.
- **On the justification that R2's abandonment weakened — stated plainly rather than left standing.** I originally argued this item on two legs: the falsifier makes a risk *checkable*, and the register *feeds the mutation plan*. **The second leg is gone**: with R2 abandoned there is no mandated mutation plan for it to feed. It is not worthless — Toad still runs mutations voluntarily and a falsifier is still the best targeting input he could be handed — but it is no longer a process hand-off. **The item now rests on the first leg plus Skyler's per-phase model gauge**, and the gauge is the stronger of the two, because it has a user who will notice if the register is bad.
- **How we would know it worked:** two signals, one per consumer. The next feature's review findings intersect its register at all; and Skyler can read a phase's risk off it without asking a question. **Zero intersection twice running means delete the register rather than fix it.**
- **Un-adopting:** stop requiring the sentence, or delete the register. **I would rather delete a register than keep a decorative one** — the current one was worse than nothing, because it looked like coverage. The one caution on deletion now: it has a second consumer, so retiring it silently would remove an input to a staffing decision. Say so if it goes.

---

## 8. R4 — It is a broken pointer, not a backlog

**Done — implemented by Koopa in `a60a30f`.**

**Skyler went one step further than this plan proposed.** The plan recommended keeping `decisions.md` as a short index; he answered the §10 question directly — *"Yes, retire decisions.md, rename records for Koopa"* — so **`decisions.md` does not survive.** That was listed here as a defensible simpler end state and it is the one chosen: a single searchable archive beats an index that has to be maintained to stay honest, and the index's whole failure mode was that nobody maintained it.

The sections below are the reasoning that produced the scope; the executable form is in "What specifically changes", **as amended for retirement**.

### What is actually wrong

Verified: `.squad/decisions/inbox/` holds **126 files**; `.squad/decisions.md` holds **4 entries**, all dated 2026-07-21. The standing instruction to consult `decisions.md` for standing decisions therefore returns a two-month-old picture and misses every decision this feature made.

But the two files are not the same content at different maturities, and treating them as a queue is the error. They are **an index and an archive**:

- `decisions.md` should be the short, current, read-in-one-sitting list of decisions an agent must not silently contradict.
- The inbox is the detailed record *with the reasoning*, which is what made this retrospective reconstructable.

"Draining" 126 detailed records into a summary file would destroy the reasoning and produce a document nobody reads. **Most of those 126 should never be promoted** — they are feature-local implementation notes, correctly archived.

> **Executed 2026-09-21 (Koopa). Your diagnosis was right and the evidence is stronger than either of us had.** The drain you rejected *already ran once*: on 2026-07-25 (`986e52d`) it compressed **three** records totalling **405 lines** into the **29 lines** of `decisions.md` and **deleted all three**, dropping the decision *"the minion step is optional"* entirely — which then stayed invisible through the multi-minion work and through decision 19 of the entity-linking feature, the same question one step over. All three were recovered from git and are back in `records/`; three citations that had pointed at nothing since July now resolve. **Corrected 2026-09-21 after review:** my first pass reported two records and 335 lines, because it enumerated the deletion set by filename pattern rather than by the commit. The third — `luigi-armor-support.md`, 70 lines — was cited by nothing, so its destruction had produced no symptom whatsoever and no dead-link check could have found it.
>
> Per Skyler's §10 item 4 ruling, `decisions.md` did not survive as an index. The index is now `.squad/decisions/README.md`, inside the directory it indexes. **20 decisions promoted, not ~15** — the gap is that three of them were separate decisions inside one recovered record, and one standing decision (no per-user data ownership) lives in a document rather than a record. Six records are listed as *not judged* rather than guessed at. Old paths in this section are left as written, because `inbox/` is what you analysed.

### The four readings, and their failure modes

| Reading | Cost | Failure mode |
|---|---|---|
| **Promote the standing ones, archive the rest** ← recommended | ~15 entries | Judgement: someone decides what is still standing. Mitigated by *when in doubt, do not promote* — the archive stays searchable. |
| Summarise all 126 | Days | Produces a long document nobody reads, and loses the reasoning that made the records valuable. |
| Index all 126 | Hours | A 126-line index is not more readable than 126 files. Solves nothing. |
| Discard | Minutes | Destroys the record this retrospective was built from. Rejected. |

### What specifically changes

1. **Rename `.squad/decisions/inbox/` to `.squad/decisions/records/`.** "Inbox" implies a queue with an obligation nobody is meeting; the directory is an archive and should say so. This alone removes most of the perceived debt.
2. **Retire `.squad/decisions.md`** and repoint every standing instruction that tells an agent to consult it at `records/` instead. The four entries it holds are all from 2026-07-21; check each is either still represented in `records/` or worth writing there before the file goes.
3. **Mark the cross-cutting, still-standing decisions so they are findable** — with `decisions.md` gone, this is now the load-bearing step rather than a promotion into an index. **The three R2 targeting rules are in this set and matter more than before**, because `records/` is the only place they will be visible (§4). The rest of the ~15: baseline-and-draft-share-one-lifecycle; structural fixes over disciplinary ones; exhaustive `switch` over a ternary for any growable union; the three-document ownership split; commit messages carry reasoning; plus a handful from before this feature. Whether that marking is a naming convention, a front-matter field or a `README.md` in `records/` is Koopa's call — he is the one who will have read them all.
4. **Mark superseded records** rather than deleting them — this feature has several, including my own `origin` flag.

### Ownership, cost, success, un-adoption

- **Owner:** Koopa — he has just read all nineteen of this feature's records and seven agent histories, and is the only one with the context to judge what is still standing at low cost. **In flight now, which is the right timing: in a month this is a much more expensive job.**
- **Cost:** half a day for the curation pass, minutes for the rename and the retirement.
- **How we would know it worked:** an agent following the standing instruction lands somewhere current. Concretely: a reader looking for "what must I not contradict?" finds the answer in `records/` without being sent to a two-month-old file first.
- **Un-adopting:** not meaningfully reversible, and does not need to be — this removes a pointer that was actively misleading rather than adding a practice. If the archive later proves too flat to navigate, the fix is an index *generated* from `records/` rather than maintained by hand, which is the version that would not have rotted.

---

## 9. Not planned here, and why

- **Koopa's R5** (promote a recurring observation to a principle at the second instance) — agreed, but it is advice to design-document authors, not a change with an owner and a cost. It is already recorded in my own history and in principle 5's rev-12 widening. Nothing to schedule.
- **Koopa's R7** (close F10, revisit F4/F9) — already tracked as follow-ups in `mystery-entity-linking.md` §12. Prioritising them is Peach's call.

### R6 — the store extraction: **not funded**, with a revisit trigger

**Decided 2026-09-21.** Skyler: *"I don't think we need to do this. Make a note of it where appropriate and if we identify cases in the future where this would have helped us identify or solve a problem, we can revisit."*

So this is a deferral with an **evidential trigger**, not a rejection, and the note has to be written so that the trigger is recognisable when it fires. The trigger, stated plainly:

> **A future problem that extracting the roster / baseline / disposition machinery would have prevented, or made cheaper to find.** Concretely, that looks like: another instance of the baseline/draft lifecycle class in `mystery-create.store.ts`; another composition failure between removal rules; or a new collection added to the wizard that requires the same five mechanisms to be re-implemented by hand.

**The evidence already on the record, so that a future instance is the second data point rather than the first.** This is the part that matters — without it, whoever hits the next problem argues from one case.

- `mystery-create.store.ts` grew **1670 → 3187 lines in a single feature**, and was already the largest file in the frontend.
- It now owns **four rosters, four composers, eight baselines, one disposition queue and its drain**, plus `clearDrainedRemovals`, `stillTheRostersBusiness`, `persistedForRemoval`, `deferredChangeTail`, `collapseComposerIfUntouched`, `effectiveMinionMonsterKey`, `localKey`, `monsterKey` and `existingMonsterId`.
- **§7.7 of the architecture document alone produced three composition failures** — (e)'s drop rule, (f)'s parent-child extension, and J1. One section of one design producing three instances of one bug class is the signature Koopa identified.
- **The two Phase 4 phase components are byte-identical modulo the noun** (Toad's measurement): `mystery-create-locations-phase` and `mystery-create-bystanders-phase` differ by one line of template and two comments.
- The precedent for the shape already exists one level down and worked: `sub-resource-diff.ts`, one parameterised function over a small service adapter, used eight times across two owners.

**Where this lives durably:** it is already Rosalina's OQ9 and is flagged as consistency debt in both follow-up lists in `mystery-entity-linking.md` §12. This section is the evidence pack; §12 is the tracker. Whoever revisits should not need to reconstruct either.
- **Koopa's §10c** (stale `.squad/log/` and `orchestration-log/`) — four files, untouched since 2026-07-26. Fold into R4's pass while Koopa is in `.squad/` anyway: retire them, or state what they are for.

---

## 10. The four calls put to Skyler — answered 2026-09-21

All four are settled. Recorded with his reasoning, because in two cases the reasoning is more durable than the decision.

1. **Whether R2 becomes required or recommended.** → **Neither. Abandoned.** *"I was also dubious about this and Yoshi's pushback feels like the right call."* The independent reservation is the part worth keeping: this was two people arriving at the same place, not one being talked out of a position. §4 records what survives it.
2. **Whether to fund R6 — the store extraction.** → **Not now, revisit on evidence.** §9 holds the trigger and the evidence pack.
3. **The ceremony roster.** → **No change needed, and not a concern.** His reasoning, recorded as an **observation rather than an action item**, because it describes how this project actually runs: *"It's incredibly rare for me to find a use for Mario; Yoshi is used almost every single time I implement a feature and the only exception is when I'm seeking design from Rosalina first; Boo is helpful, but only when I need him, and he wasn't necessary for this. The roster listing just missed when anticipating my needs for this feature."*
   The useful generalisation for anyone assembling a review chain later: **the roster is a default guess at who is needed, not a description of who works.** Koopa's §10b read a mismatch between the two as a defect in the roster; Skyler's answer is that the mismatch is expected and cheap, because he picks per feature. **Nothing to do.**
4. **Whether `decisions.md` survives.** → **It does not.** *"Yes, retire decisions.md, rename records for Koopa."* §8 is rewritten accordingly — this went further than the plan recommended, and the simpler answer is the better one.

**R9 and R10, raised by me rather than asked of him, were adopted the same day.** Both answers came with a rationale different from the one I argued, and in both cases his is the more useful one for deciding *how* to apply the item — R9's mundane-versus-consequential boundary and R10's per-phase model gauge. §6 and §7 record them. **Nothing in this plan is now undecided.**

---

## 11. Where this stands

### Done

| Item | Owner | Commit |
|---|---|---|
| **R4** — `inbox/` → `records/`, `decisions.md` retired, standing decisions marked | Koopa | `a60a30f` |
| **R1** — the silent verification steps fixed, detector added | Luigi, Bowser | `56f237f` |
| **R3** — briefs name an artifact; default surface list | Peach, brief authors | `56f237f` |

Both commit bodies carry reasoning worth reading if either item is ever revisited. `a60a30f`'s is the more interesting: it found that **draining the inbox into the index had already been tried** — `986e52d`, 2026-07-25, compressed three records totalling 405 lines into 29 lines and deleted the sources, dropping one decision outright, which then stayed invisible through two features. That is a stronger argument against "drain" than the one §8 makes from cost, and it was discovered by implementing rather than planning.

### Adopted, not started

| Item | Owner | Cost | Ongoing tax |
|---|---|---|---|
| **R9** — facts and the question, not a mechanism (§6) | Yoshi | negative — it removes work | none; a habit |
| **R10** — falsifier per risk entry, phase-tagged (§7) | Yoshi writes, Skyler and Toad read | one sentence + a tag per entry | small, and it should make the register *shorter* |

Neither has a first-use date, because both attach to the next architecture document rather than to a task. **R9 applies from the first design document written after this**; R10 from the first risk register.

### Not doing

| Item | Decision |
|---|---|
| **R2** — counted negative-control deliverable | **Abandoned.** The practice stays voluntary; the three targeting rules stay as standing decisions (§4). |
| **R6** — extract the roster/baseline/disposition machinery | **Not funded.** Revisit trigger and evidence pack in §9. |
