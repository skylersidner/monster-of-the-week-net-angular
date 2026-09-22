# Skill: Review Brief Surfaces

**Domain:** Review briefs, design review, acceptance criteria
**Applies to:** Any brief that asks someone to review a design, a phase plan, or a proposed change
**Confidence:** medium — derived from six review passes on one feature; the surfaces are measured, the transfer claim is argued (see "What this does not do")

---

## The line that goes in the brief

> **Check the payload, not just the entity. Design documents describe entities; contracts describe payloads, and that is where the silence concentrates.**

**And the verb matters more than the noun.** Name the file *and* the claim it has to settle:

- ❌ `Review the design for the attach flow.`
- ❌ `Read core/models.ts.`
- ✅ `Read core/models.ts and confirm the attach picker's option type carries what the draft needs.`

The middle form is the one that looks like compliance and produces nothing. A reviewer told to read a file will read it; a reviewer told what the file has to prove will *interrogate* it. The highest-yield instruction in the feature this came from was four words — *read the code, not the plan* — and it worked because the reviewer already had a question. Supply the question.

---

## The default surfaces

Start here, then add feature-specific ones. Derived from where 15 review findings actually came from, re-checked against the findings rather than from memory.

| # | Surface | Holds | Findings | Typical reviewer |
|---|---|---|---|---|
| 1 | `Contracts/ApiContracts.cs` and **the `Upsert*Request` records specifically** | What the API will actually *accept* — as opposed to what it returns | The re-parent gap: two design documents asserted a capability `UpsertMinionRequest` had no field for | Bowser |
| 2 | `core/models.ts` | What the client believes the API *returns* | 1 — and it reshaped the feature's central interaction before it was built | Peach |
| 3 | **The file the feature will modify most, and the templates that read it** | The old invariants the new design has to live with | **13** | Luigi |
| 4 | A running repro | Timing, ordering and concurrency, which reading cannot reach | the two production bugs; ~25 dead tests | Toad |

### Three corrections to the obvious version of this list

**Row 3 is not "the largest store or service file."** Size is a coincidence, not a selector. It happened to be true once — `mystery-create.store.ts` was both the feature's centre and the frontend's largest file — and following "largest" on the *next* feature sends the reviewer back to the same file regardless of what is being built. The selector is **what the feature writes into**, and it needs no judgement: every architecture document in `docs/updates/` carries a *"Files this touches"* section. Take row 3 from there.

**Row 3 includes templates, and the obvious version omits them.** Two of the fifteen came from `.html` files and neither was reachable from the store:

- a literal `Finish` in `mystery-create.html` contradicting copy a design document had written as *"continue to the next step"*
- four consumers of `monsterPreview()` in `mystery-create-dossier.html`, where the design named one

Both are the same question — **who else reads this?** — so they belong with row 3 rather than in a row of their own. A state file and its readers are one surface.

**Row 1 is the request records, not the contracts file.** `ApiContracts.cs` holds both directions. The response half overlaps row 2; the half that produced the sharpest finding in the feature is the `Upsert*Request` records, because that is where "can the API even express this?" is answered. Point at it precisely — the file is large enough that "read `ApiContracts.cs`" is not an instruction.

### Why row 2 is disproportionately valuable relative to its count

One finding, and it changed the design before anyone built it. **A design document describes an entity; a contract describes a payload, and the two diverge silently.** `MonsterListItemResponse` carries `attackCount`, `powerCount`, `minionCount` — counts, no collections, no minions. Both design documents described "attaching a monster" as if the picked object were the monster. It was a summary of one. That gap is invisible from either document and obvious from the type.

---

## The failure signal, made checkable by someone other than the author

The stated signal for dropping this practice is **"a review pass that produces only document-internal findings"** — that means the brief sent someone back to the documents.

That is only checkable if the report says where each finding came from. So:

> **Every review finding names the surface that produced it.** One parenthetical per finding, not a section.

Then the signal reads off the report in a single pass, by anyone, without knowing the feature: if no finding names a code surface, the brief failed. It also makes the surface list self-correcting — surfaces that never appear should be dropped, and surfaces that keep appearing unbidden should be added.

---

## What this does not do — read this before relying on it

**Naming a file converts a reviewer who would have read documents into one who opens a file. It does not make them ask a question the file answers.** That distinction is the whole of the honest case here.

The 50-to-4 ratio measures where findings were *found*. It does not measure what caused someone to look, and the causes were not "a brief named a file" — none of them was. In every case the reading was forced by a question the documents could not answer:

- *"When do removals actually apply?"* → had to know what `back()` and `jumpToPhase` do.
- *"What does the picker hand you?"* → had to know the option type.
- *"Do these three removal rules compose?"* → had to know what `idsToRemove` excludes.

**Acceptance criteria happen to force this, which is why this skill comes from that role.** A criterion states what will be observably true, and you cannot write one from a document that describes intent. Any brief whose deliverable is a *claim about behaviour* gets the same effect for free. Any brief whose deliverable is an *opinion about a design* will not, no matter how many files it names.

So: use the surfaces, and expect them to help a reviewer who already has a question. If a review is producing nothing, the missing ingredient is more likely the question than the file list.

---

## Project reference

Derived from the mystery-entity-linking review passes (Phases 4, 5, 5b), 2026-09-20/21.
Decision: `.squad/decisions/README.md` §1 — *"A review brief names a code artifact."*
Records: `.squad/decisions/records/koopa-review-briefs-name-a-code-artifact.md`, `.squad/decisions/records/peach-review-brief-default-surfaces.md`.
Plan: `docs/engineering-practice-improvements-plan.md` §5 (R3).
