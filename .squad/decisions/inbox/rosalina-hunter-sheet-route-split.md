# Hunter Display — Read-Only Sheet at `:id`, No Edit Route, Full-Bleed Multi-Region Layout

**By:** Rosalina (Designer)
**Date:** 2026-09-03 (revised same day against Skyler's answers to Q1–Q5; corrected 2026-09-11, see the Update at the end)
**Status: Proposed; every open question answered by Skyler.** Advisory pass only — `docs/hunter-playbooks/hunter-display-design.md`. No code changed. **Zero open questions.** Q1–Q7 were all resolved on 2026-09-11. One implementation choice is deliberately left to Bowser: whether the rule-free save for Name/Pronouns and journal entries is a widened `PATCH` or a sibling endpoint.

## What

**`/hunters/:id` becomes a read-only hunter sheet.** Confirmed by Skyler ("the split is good").

**Route set:**

| Route | What |
|---|---|
| `/hunters/:id` | the sheet — read-only *about the character* (except Name and Pronouns), live *for play state* (counters and the Curse-Eater's journal) |
| `/hunters/:id/advancement` | Skyler's route and shape (Q2): its own form, pick the improvement first, which may prompt a secondary pick. Not designed here, apart from one HA-2 step sketched in 10.4. |
| ~~`/hunters/:id/edit`~~ | **does not exist** — confirmed by Skyler 2026-09-11 (Q1) |

**Three kinds of change, only one of which is "editing a hunter":**

1. **Creation** — one-way, in the wizard, which ends with a full review screen before saving (confirmed, Q2). **Two narrow exceptions, both from Skyler on 2026-09-11:**
   - **Name and Pronouns** can be edited in place on the sheet. They are labels with no rules attached (Q2).
   - About 12 printed improvements tell you to delete or change a creation pick (`Delete one of your Doom tags`, `Change your Task to another option`). On `/advancement` they may do exactly that, as the improvement's own secondary pick, saved with it. Only the pick the line names can be changed (HA-2).
2. **Advancement** — taken on `/hunters/:id/advancement`. **Removable from the sheet's Advancement block** as a hard delete, no trace (Skyler, 2026-09-11). Removal also removes any move that improvement granted, which is recorded rather than guessed (Q6).
3. **Play state** — Luck, Harm, Experience and extra-track values, saved through `PATCH /hunters/{id}/state` (Skyler, Q3; Bowser's contract), and **the Curse-Eater's journal entries, added, edited and removed on the sheet** (Skyler, Q4). None of these saves runs the pick rules. They are not edits to the character; they're the marks you make on paper during a session. `HunterEntities.cs:83-90` already calls the counters *"mutable play state, not template data."*

The Luck/Harm/XP/extra-track boxes are the page's only click-to-mark values. They save with no explicit save button, fill optimistically, and on failure revert with an error toast. The page's other controls are explicit buttons from the app's existing vocabulary:
- `Advance`
- delete hunter
- the pencil beside the name (Name/Pronouns)
- the journal's `+ Add entry`, plus an edit and a remove icon on each entry
- a remove icon per improvement

Everything else is inert, and that is the visual message. **All sheet writes for one hunter go through one queue**, so they never overlap, whatever endpoint shape Bowser picks.

**Layout: full-bleed, no page container** (Skyler, Q3: *"I would prefer it continue to use the entire page width… I would see much more information on the screen at once"*). Full-width header + state strip, then a three-region grid — **Moves** (`xl:col-span-5`), ***`{playbook}` rules*** (`col-span-4`), **rail** (`col-span-3`: Gear, Look, History, Advancement) — collapsing to two regions at `md` and one below. Prose is measured **inside** its card (`max-w-[42rem]`), so extra width buys more columns, not longer lines; the Moves list goes two-up above 1900px. When a playbook has no playbook-level bespoke content (4 of 28) the spans re-promote to 8/4 rather than leaving a hole.

Bespoke rulesets branch on the **same four predicates the form already uses**, through **one section renderer** used both in region B and nested under a move in region A (13 moves carry a section). The tree case (38 of 49 sections: 27 playbook-level, 11 inside moves) becomes **grouped chip rows**: one row per engaged top-level option, with its picked leaves as chips. Unpicked options are never shown (confirmed, Q4). The two option-less repeatable sections (Searcher's Network, Spell-Slinger's Arcane Reputation) render as a plain `name — detail` list.

**API: reads need no change. Writes gain `PATCH /hunters/{id}/state` (Q3) and a rule-free save for Name/Pronouns and journal entries (Q7), either that `PATCH` widened or a sibling endpoint (Bowser's call).** **No new design token.**

## Why

- **There is no read-only view of a hunter anywhere in this app today.** `/hunters/:id` is the edit form. That is the actual gap.
- The app's precedent (monster/minion/mystery detail = content + form on one route) does not transfer: those forms are 4–8 fields; `hunter-form.ts` is 778 lines across eleven pickable sections. The form doesn't sit under the content, it displaces it.
- **`/edit` goes because Skyler ruled post-creation adjustment out** (Q5b: *"the ability to edit a hunter is a mistake… Hunter creation is a one-way exercise that cannot be adjusted after the fact"*), and confirmed it on 2026-09-11 (Q1). His 2026-09-11 answers carved out narrow exceptions:
  - recorded improvements are removable;
  - an improvement that names a creation pick may remove or swap that one pick;
  - Name and Pronouns are editable;
  - the Curse-Eater's journal entries are play state.

  Nothing else reopened, and **Look answers stay locked**. They are template picks, not free-text labels; the gap is cosmetic, and the wizard's review screen is where it gets caught. Play state survives on a different argument — the entity model already separates it from template data, and a character sheet you can't mark harm on is not a character sheet.
- **The Name/Pronouns pencil sits beside the name, not in the header's action cluster.** In the cluster, beside `Advance` and delete, a pencil would read as "edit hunter", which is exactly what was ruled out. The action cluster stays at two controls.
- **Delete is the only correction path for the rest of creation data**, so it stays, but demoted from today's labelled button to the standard icon-only `action-btn--delete`, because an always-visible destructive control at button weight on a page kept open at the table is the wrong risk.
- `HunterDetailResponse`'s own doc comment already anticipates this page and its client-side join (*"A future read-only hunter sheet can join the same way the form does"*), and `hunter-detail.ts` already `forkJoin`s the two requests. Zero API work for reads.
- Three orderings of the same object would be a defect. The sheet uses the order `HunterCompleteness` prints `Outstanding` in and the form prints its inputs, with one divergence: Luck/Harm/Experience promoted to the header — safe specifically because `HunterCompleteness` deliberately excludes all three from `Outstanding`.
- A read-only copy of the bespoke option tree renders every *un*taken option: The Chosen's five Fate picks would arrive inside ~30 rows.

## Rejected

- **A page-width container (`mx-auto max-w-[84rem]`)** — my own first-pass call, **reversed by Skyler (Q3)**. His diagnosis was right: single-column wastes most of a wide monitor when a hunter has this much content. The readability problem it was solving is handled by measuring prose inside its card instead.
- **View/edit toggle on one route** — state not in the URL, no deep link, ambiguous back button, no precedent here. (Moot now that `/edit` goes.)
- **Form under the sheet on one page** (the monster-detail shape) — every fact rendered twice at eleven sections deep.
- **Read-only option tree with disabled checkboxes** / **flat chip cloud** — the first shows what the hunter *isn't*; the second loses the category, which is the entire meaning of a Fate tag or a Combat Magic pick.
- **Auto-fit column packing** — reflows the region order, which is load-bearing.
- **Per-heading icons à la `mystery-detail`** — the sprite has no glyph for ratings/moves/gear/look/advancement; minting five is separate work.
- **A second primary button in the Advancement block** — one primary per page; the same button-weight collision already flagged in the mystery wizard.
- ~~**A per-improvement undo control**~~ — dropped with Q5b on 2026-09-03, **reinstated 2026-09-11** when Skyler chose OQ-1 ("improvements are removable"). No longer rejected.
- **A `Level n` chip on `hunters-list` rows** — my own answer to Yoshi's OQ-5, **superseded by Skyler 2026-09-10**: *"No, advancement count does not belong on the list page at all."*
- **Asking which move goes when a move-granting improvement is removed** — my own Q6 recommendation, **not chosen by Skyler 2026-09-11**. He chose Yoshi's recorded grant (OQ-8). My option would have offered moves picked at creation, bending Q5b. The recorded grant removes exactly the move that improvement granted.
- **Click-to-edit on the name itself** (no icon) — an invisible affordance on a page kept open at the table invites accidental edits, and it breaks "everything else is inert".
- **A whole-hunter `PUT` per counter click** — my original spec, **replaced by Skyler's choice of `PATCH /hunters/{id}/state` (Q3)**. Any rule failure elsewhere on the hunter would have blocked marking a box.
- **An add-only journal on the sheet** — my own Q4 design, **not chosen by Skyler 2026-09-11**. He chose add, edit and remove, treating entries as play state.
- **"Level up" as the button label** — my own call, **changed to "Advance" by Skyler 2026-09-11 (Q5)** to match the route and the screen.

## Premises in `docs/hunter-playbooks/` that had drifted, corrected against source

- **`/hunters/:id` is not a stub.** It is the edit page.
- ~~**Move-internal bespoke picks are unexercised** — "all 207 moves carry `bespokeSections: []`".~~ **Wrong, corrected 2026-09-11:** 220 moves, **13 with one section each, across nine playbooks**, five of them on Required moves. 207 was the count of empty move arrays, misread as the move total.

Also counted from the seed: **one** playbook-level bespoke section is repeatable (The Hex's Rotes), and **two more are inside moves** (The Searcher's Network, 0–5; The Spell-Slinger's Arcane Reputation, exactly 3), so three corpus-wide. The entity comment at `HunterEntities.cs:224-225` ("one Network member, one of the Spell-Slinger's three organizations") is **correct**. My 2026-09-03 version of this line said neither was repeatable, and that came from the same indent-scoped miscount.

## Consequences carried elsewhere

- **The wizard ends with a full review screen before saving** (confirmed, Q2). My further recommendation, not part of the option Skyler chose: make that step *the sheet itself*, rendered from the draft — one renderer, and what you approve is literally what you get.
- **`HunterFormComponent` loses its post-creation consumer.** If the wizard is standalone, the 778-line form and its 477-line template have no caller. Retire or absorb deliberately.
- ~~**A mis-recorded advancement has no fix path either**, which pushes a confirm step onto the advancement form.~~ **Corrected 2026-09-11:** it has a fix path (remove, then take it again). The advancement form's confirm stays as Yoshi's single consequence-labelled step, with no extra "are you sure" and no "cannot be undone" copy. It still matters because of the experience reset, which removing the improvement does not reverse.
- ~~**Removing a `+1 move` improvement while the extra move is held strands the hunter.**~~ **Resolved 2026-09-11 (Q6):** the grant is recorded (`HunterMove.GrantedByPlaybookImprovementId`), so removal takes that move with it. The remove confirm names the move.
- **Removing an improvement that deleted or swapped a creation pick cannot bring that pick back.** Hard delete records nothing about which pick it was, and creation picks can't be re-chosen. The remove confirm says so plainly (design doc 10.2).
- ~~**A typo in a hunter's name has no fix path.**~~ **Resolved 2026-09-11 (Q2):** Name and Pronouns are editable in place. A mistyped Look answer still has no fix path besides delete and rebuild. Accepted as cosmetic.
- ~~**One Luck click is a whole-hunter `PUT`.**~~ **Resolved 2026-09-11 (Q3):** `PATCH /hunters/{id}/state` for the four counters (Bowser). The sheet keeps a ~500ms coalescing debounce and one write queue per hunter.
- ~~**Open, Q7: which endpoint saves Name/Pronouns.**~~ **Resolved 2026-09-11 (Q7):** Name/Pronouns and journal entries use a save that skips the pick rules, either a widened `PATCH` or a sibling endpoint (Bowser's call). **Improvement removal is now the sheet's only whole-hunter `PUT`**, and pending counter writes flush before it.
- **Removing a journal entry doesn't change Corruption.** The confirm says so, mirroring the improvement removal's "experience isn't changed".

## Related

~~`hunter-advancement-ideation.md` OQ-5 (improvement count on the hunters *list*) was left to me. **Yes** — a `Level n` chip beside the existing playbook badge on `hunters-list` rows, suppressed at level 0 on the list but shown on the sheet.~~ **Superseded 2026-09-10:** Skyler answered OQ-5 directly, *"No, advancement count does not belong on the list page at all."* The sheet's own level chip was not part of that question and stays.

## Update — 2026-09-11

Corrections and decisions, no redesign:

1. **Improvements are removable.** Asked whether Yoshi's OQ-1 (*"Hard delete, no trace."*) or his own Q5b governs, Skyler picked *"QQ-1 — improvements are removable (Yoshi's rec)"*. Read narrowly: the per-improvement remove control and its confirm copy come back, and there is no edit route.
2. **No list chip.** Skyler's OQ-5 answer supersedes mine.
3. **Seed premise fixed.** 13 of 220 moves carry a bespoke section. The design now renders them under their move with the same section renderer as region B, and the two option-less repeatables get a plain list.
4. **Q6 resolved, not as I recommended.** Skyler chose *"Remove the granted move automatically (Yoshi)"*: the grant is recorded, so removal removes exactly that move and never a creation pick. The remove confirm lists the move by name.
5. **Improvements may change the creation pick they name** (Skyler chose *"Yes, as that improvement's own pick (Yoshi)"*). About 12 lines, HA-2. `/advancement` gets a secondary step limited to that one pick (design doc 10.4). Removing such an improvement can't restore the pick, and the confirm says so. Skyler also confirmed the grant column extends to HA-2 bespoke picks, with the swap-replacement exclusion (Yoshi recording).
6. **Q1 and Q2 resolved** (Skyler chose *"No edit route; Name/Pronouns editable (Rosalina)"*). There is no edit route. Name and Pronouns get an in-place edit beside the name, and the wizard ends in a full review screen. Look answers stay locked.
7. **Q3 resolved** (Skyler chose *"Add PATCH /hunters/{id}/state"*). The counters save through it, with optimistic fill, a coalescing debounce, and revert-plus-toast on failure.
8. **Q4 resolved, not as I recommended** (Skyler chose *"Add, edit and remove from the sheet"*). The journal gets inline add, edit and remove, one entry in edit mode at a time, with `ConfirmDeleteModalComponent` for removal. Scoped to journal entries only.
9. **Q5 resolved** (Skyler chose *"Change to "Advance""*). The header button, and the XP notice that points at it, now say "Advance".
10. **Q7 resolved** (Skyler chose *"A save that skips pick rules (Rosalina)"*). Name/Pronouns and journal entries save without the pick rules, through a widened `PATCH` or a sibling endpoint (Bowser's call). All sheet writes for a hunter share one queue. **No open questions remain.**
