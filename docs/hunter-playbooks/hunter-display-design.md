# Hunter Display — Design Recommendation

**By:** Rosalina (Designer)
**Date:** 2026-09-03 (revised same day against Skyler's answers to Q1–Q5; corrected 2026-09-11, see the second table below)
**Status: advisory recommendation, not implemented.** No application code was changed by this pass. Skyler's brief: *"come up with a way to display a created hunter's information"*, ahead of the creation wizard, with room made for a level-up/advancement system that is being considered but not built.

**What this is not.** It is not the creation wizard (Section 12 lists where a display call constrains it, and stops there), and it is not the advancement form (Skyler has named its route and its shape; Section 10 designs only the sheet's hand-off to it).

### Skyler's answers, and what each moved

| | Answer | Effect on this design |
|---|---|---|
| Q1 | *"The split is good."* | `/hunters/:id` becomes a read-only sheet. Confirmed. |
| Q2 | *"design the advancement as a separate route (call it `/hunters/:id/advancement`)"* — its own form, pick the advancement first, which may prompt a secondary pick. | Section 10 is now a hand-off, not a flow. |
| Q3 | *"I would prefer it continue to use the entire page width… single column is wasting a lot of space… I would see much more information on the screen at once."* | **Reverses my `max-w-[84rem]` call.** Section 5 is rewritten as a full-bleed three-region grid. |
| Q4 | *"Showing what the hunter picked is perfect."* | Section 8 confirmed unchanged. |
| Q5a | *"Ship app-authored copy now."* | Confirmed. |
| Q5b | *"the ability to edit a hunter is a mistake… Hunter creation is a one-way exercise that cannot be adjusted after the fact."* | **The largest change.** Section 2 is rewritten; undo and the confirm-dialog copy are gone; the header's action set is rebuilt. *(Undo reinstated 2026-09-11, see below.)* |

### Corrections since, and what each moved (2026-09-11)

| | Decision or correction | Effect on this design |
|---|---|---|
| Removal | Asked whether Yoshi's OQ-1 (*"Hard delete, no trace."*) or Q5b governs, Skyler picked the option *"QQ-1 — improvements are removable (Yoshi's rec)"*. | **Narrow.** A recorded improvement can be removed, as a hard delete that leaves no trace. The per-improvement remove control and its confirm copy are back (10.2); 2.1 and 2.2 restated; the advancement form's confirm step re-argued (2.2). **Nothing else in Q5b reopened**: no `/edit` route, creation data stays locked. One new question, Q6 (resolved below). |
| Q6: granted move | Skyler chose *"Remove the granted move automatically (Yoshi)"* over my recommendation to ask which move goes. The grant is recorded (`HunterMove.GrantedByPlaybookImprovementId`), so removal removes exactly that move and never a creation pick. | Q6 marked resolved, with my options kept as the record. 10.2's confirm names the granted move rather than offering a choice. 2.2 updated. |
| Creation-pick improvements | Skyler chose *"Yes, as that improvement's own pick (Yoshi)"* for the ~12 improvements that delete or change a creation pick (e.g. `Delete one of your Doom tags`). | The single narrow exception to locked creation picks (2.1). New 10.4 sketches the HA-2 secondary step on `/advancement`, limited to the one pick the line names. 10.2's confirm says removing such an improvement doesn't bring the pick back. |
| Q1 + Q2: editing after creation | Asked as one question, Skyler chose the option labelled *"No edit route; Name/Pronouns editable (Rosalina)"*. As described to him (not his words): no edit form; Name and Pronouns can be changed on the sheet because they're labels with no rules attached; the creation wizard ends with a full review screen before saving. | **Q1 resolved:** no `/hunters/:id/edit`, the strong reading confirmed. **Q2 resolved:** both (a) and (b). Name and Pronouns get an in-place edit in the header (Section 4), and the wizard's review step is confirmed (12.3). **Look answers stay locked.** They weren't part of the question; 2.2 says why that's a small gap, not a real one. The header's right-hand action cluster is unchanged. |
| Q3: counter saves | Skyler chose the option labelled *"Add PATCH /hunters/{id}/state"*. As described to him: a small endpoint for Luck, Harm, Experience and extra tracks only, so marking a box never runs the pick rules; the first exception to "no sub-resource endpoints"; Bowser's work. | **Q3 resolved.** 2.3's counter save spec rewritten: optimistic fill, a coalescing debounce kept for a different reason, flush before navigation or any whole-hunter save, and revert-plus-toast on failure. The contract is Bowser's and isn't specified here. §0's "zero API changes" is now true of reads only. Which endpoint saves Name/Pronouns was left open as Question 7, resolved below. |
| Q4: journal | Skyler chose the option labelled *"Add, edit and remove from the sheet"*, not my add-only design. As described to him (not his words): treat journal entries like play-state marks; changes the sheet's rule that things are only added, never changed, for this one playbook. | **Q4 resolved against my recommendation.** 8.3 now specifies inline add, edit and remove on the Curse-Eater's journal rows, with `ConfirmDeleteModalComponent` for removal. Scoped to journal entries: nothing else on the sheet gains edit or remove. 1, 2.1 and 2.3 updated. |
| Q5: button copy | Skyler chose the option labelled *"Change to "Advance""*. As described to him: consistent with the `/advancement` route and whatever the screen calls itself. | **The header button reads `Advance`** everywhere this doc shows or specifies it (Section 4's mockups and spec, 2.3, 8.3, 10.2). The XP track's notice changes to match the button it points at (*"Ready to advance"*), confirmed by Skyler 2026-09-11 (option *"Keep "Ready to advance""*). The rulebook's "level up" stays in explanatory text about the rules. |
| Q7: label and journal saves | Asked together with Q4, Skyler chose the option labelled *"A save that skips pick rules (Rosalina)"*. As described to him: Name/Pronouns and journal entries save without running the pick rules, through a widened `PATCH` or a sibling endpoint (Bowser's call); a rename can only fail because of the name itself; journal saves still check their own fields. | **Q7 resolved.** Section 4's failure copy and 8.3's journal saves assume that save; the endpoint shape is not chosen here. 2.3's flush rule re-checked: removing an improvement is now the sheet's only whole-hunter `PUT`, and all sheet writes for one hunter go through one queue, whichever shape Bowser picks. **No open questions remain.** |
| List chip | Skyler answered Yoshi's OQ-5 himself (2026-09-10): *"No, advancement count does not belong on the list page at all."* | **My 10.3 answer is withdrawn.** No `Level n` chip on `hunters-list`. The sheet's own level chip (Section 4) was not part of that question and stays. |
| Seed premise | Premise 2 was wrong. **220 moves, 13 with a non-empty `bespokeSections`, across nine playbooks**, not "all 207 empty". The same miscount hid **two more repeatable sections**, both inside moves. | Premise 2 and 0.1 corrected, with the cause. New 7.1 gives move-internal sections a real treatment using Section 8's renderer; Section 8's counts now cover all 49 sections. No layout change. |

---

## 0. What was verified, and two premises that had drifted

Everything below is grounded in current source read on 2026-09-03, not in the docs' descriptions of it. Two things a reader of `docs/hunter-playbooks/` would get wrong:

1. **`/hunters/:id` is not a stub — it *is* the edit form.** `hunter-detail.html` is 59 lines: a back link, a name/badge header, a delete button, the `Outstanding` block, and `<app-hunter-form>`. **There is no read-only view of a hunter anywhere in this application today.** That is the actual gap this design fills.
2. **Move-internal bespoke picks are real content.** *(Corrected 2026-09-11. This premise originally claimed the opposite: "all 207 moves carry `"bespokeSections": []`".)* `hunter-form.html:94-99,127-132` renders `moveSectionsFor(move)` against `PlaybookMoveResponse.BespokeSections`, and in the shipped seed (`Data/Seed/hunter-playbooks.json`) **13 of 220 moves carry one section each, across nine playbooks**: The Changeling (Force of Nature), The Crooked (Artifact, Deal with the Devil), The Forged (Partner), The Gumshoe (The Naked City), The Host (Defensive Adaptation), The Professional (Mobility), The Searcher (First Encounter, Guardian, Network), The Spell-Slinger (Tools and Techniques, Arcane Reputation), The Visitor (Something Strange). **Five of them sit on a Required move** (Partner, The Naked City, Defensive Adaptation, First Encounter, Tools and Techniques), so every hunter of those five playbooks has one. Section 7.1 designs for them.

   *How the wrong number happened, so it doesn't happen again.* 207 is exactly the number of lines matching `"bespokeSections": []` at the move indent. I counted that pattern and took the result as the number of moves, without counting moves separately. A non-empty array puts its `[` at the end of a line and continues on the next, so a one-line grep for `[]` can never match one. That method could only ever report "all empty". The same habit of counting at one fixed indent caused a second error: I counted `minInstances` only at the playbook-section level, and missed the two repeatable sections one level deeper, inside moves. The check that catches both is to count the total with a key every row has (`"required":` at the move indent gives 220), count the subset separately, and confirm the parts add up (207 empty + 13 non-empty = 220).

**One finding that removes work.** `HunterDetailResponse`'s own doc comment already anticipates this page:

> *"Picks come back as bare id lists rather than expanded rows… A future read-only hunter sheet can join the same way the form does."* — `HunterContracts.cs:36-41`

`hunter-detail.ts:48-51` already `forkJoin`s hunter + playbooks, and `HunterFormComponent` already fetches the full `PlaybookDetailResponse` itself. **The sheet's reads need zero API changes** — same two-request pattern, same client-side join. *(Its writes gained one endpoint on 2026-09-11: Skyler resolved Question 3 with `PATCH /hunters/{id}/state` for the four counters, which is Bowser's contract.)*

*(Tooling note for the record: the two source PDFs could not be read in this session — the Read tool needs poppler, which isn't installed, and no shell was available. The corpus analysis below is grounded in `hunter-playbooks.json`, this project's own verified transcription of the same pages and the data the app actually holds. The rulebook's advancement text is quoted verbatim in `hunter-advancement-ideation.md` §1.)*

### 0.1 The corpus, counted from the seed rather than from the catalogue

| | Count | Why it matters to layout |
|---|---:|---|
| Playbooks | 28 | — |
| `luckBoxCount` / `harmBoxCount` | **7 on all 28** | A literal 7-box track fits at 320px. Boxes, not "3 of 7". |
| `experienceBoxCount` | 5 on all 28 | The level-up trigger is a 5-box row. |
| `moveGrantCount` | 2–4 | A hunter shows ~3–7 moves total (picks + required). |
| Moves (template rows) | **220**: 13 carry one bespoke section, 207 carry none | See premise 2 (corrected 2026-09-11). |
| Improvements | **525** | Never all shown on the sheet — Section 10. |
| Playbook-level bespoke sections | **36, across 24 playbooks** | **4 playbooks have none at all.** |
| …of which repeatable | **1** (The Hex's Rotes, `minInstances: 0`) | The only repeatable at playbook level. Corpus-wide there are 3; see the move-level rows. |
| …of which fixed grants (zero options) | **7** | Pure rules text, no answer area. |
| …of which whole-section free text | **1** (The Gumshoe's `freeTextLabel: "Your Code"`) | — |
| Move-level bespoke sections | **13, across 9 playbooks**, one per move, 5 on Required moves | Rendered under their move in region A (7.1), never in region B. |
| …of which option trees | **11** (9 flat; The Forged's Partner and The Professional's Mobility are categorised) | Same grouped chip rows as region B. |
| …of which repeatable | **2**: The Searcher's Network (`0–5`, `freeTextLabel: "Member"`) and The Spell-Slinger's Arcane Reputation (exactly 3, `"Organization"`), **both with zero options** | Repeat-instance presentation serves **three** playbooks, not one, and two of the three are name-plus-text lists rather than option trees (7.1). |
| Bespoke journals | **1** (The Curse-Eater's Consumed Magic) | A table, and only ever one. |
| Extra tracks | **2** (Curse-Eater Corruption, Pararomantic Relationship Status) | — |
| Look categories | 77 (~2.75/playbook) | Small. |
| Gear categories | 73 (~2.6/playbook) | Small. |

**How wide the variance actually is, in the two directions that matter for layout:**

- **The Mundane, The Celebrity, The Flake, The Searcher** have *zero* playbook-level bespoke sections, no extra track, no journal. Their sheet is Ratings + Moves + Gear + Look + tracks + history. The playbook-rules region must **vanish**, not render as an empty card — and in a multi-column layout it must not leave a hole either (Section 5.2). *(The Searcher is not free of bespoke content, though. Three of its moves carry a section, one of them the Required First Encounter, and those render under their moves in region A, 7.1.)*
- **The Chosen** has one section (`Fate`) that is `minSelect: 3 / maxSelect: 3` over three nested categories, each with its own count — `How You Found Out` (pick 1 of 7), `Heroic` (pick 2), `Doom` (pick 2). Five picked leaves under three headings, from a tree three levels deep.
- **The Crooked** (Background / Heat / Underworld), **The Envoy** (Task / Secret Wisdom / Overseers), **The Monstrous** (Monster Breed / Curses / Natural Attacks) and **The Pararomantic** (Guide's Gift / Bond Abuse / Fate of Your Love, *plus* an extra track) each carry three sections.
- **The Curse-Eater** is the only playbook needing a bespoke section, an extra track, *and* a journal on one sheet.

That spread — 0 to 3 playbook-level sections, one journal in the whole corpus, one repeatable section at playbook level (three counting moves) — is why the recommendation is **a fixed region order of individually optional blocks**, not a fixed dashboard.

---

## 1. The recommendation in one paragraph

**`/hunters/:id` becomes a read-only sheet.** It is read-only *about the character* and live *about the session* — the only values it lets you touch are the marks you'd make on paper mid-game (Luck, Harm, Experience, extra tracks), plus, since 2026-09-11, the hunter's two labels, Name and Pronouns, and the Curse-Eater's journal entries. Everything else is settled at creation and changes only through `/hunters/:id/advancement`. The page is **full-bleed**: a full-width identity + state header, then a three-region grid at `xl` — **Moves**, ***`{playbook}` rules***, and a **rail** (Gear, Look, History, Advancement) — collapsing to two regions at `md` and one below. Prose is held to a readable measure inside its own card rather than by capping the page, so extra viewport width buys more columns, not longer lines.

---

## 2. The route set, and the tension between Q1 and Q5b

Skyler approved the read-only/edit split (Q1) and then said editing a hunter is a mistake (Q5b). Those cannot both survive intact. Here is the reading I recommend, stated as an explicit assumption because it is mine and not his.

### 2.1 The distinction Skyler collapsed, named plainly

He read *"undo an improvement"* as *"edit a hunter."* In my design they were separate — undo meant removing one row from the advancement history, not opening the sheet's fields. On 2026-09-03 I designed to his rule and dropped both. **On 2026-09-11 he separated them himself.** Asked whether Yoshi's OQ-1 (*"Hard delete, no trace."*) or Q5b governs, he picked *"QQ-1 — improvements are removable (Yoshi's rec)"*. So removing a recorded improvement is back, and editing a hunter is still out. That answer reaches no further: it does not bring back an edit route. In the same round he approved one narrow reach into creation data. An improvement whose printed text tells you to delete or change a creation pick may do exactly that, to that one pick, as its own secondary pick on `/advancement` (10.4). Nothing else set at creation is unlocked. The collapse also hid a third thing that must survive, and the entity model already draws the line for us:

> *"Mutable play state, not template data. These are the counters a player marks during a session, so they live on the instance as plain ints."* — `HunterEntities.cs:83-90`, on `Luck` / `Harm` / `Experience`

So there are **three kinds of change**, and only one of them is "editing a hunter":

| | What | Where it happens |
|---|---|---|
| **Creation** | Name, pronouns, playbook, rating array, moves, gear, look, bespoke answers, history | The wizard, ending in a full review screen (confirmed, Question 2). **One-way. No correction path**, with two narrow exceptions from Skyler on 2026-09-11: **Name and Pronouns**, editable in place on the sheet (Section 4), and a creation pick an improvement's printed text names, changed as that improvement's own pick (10.4). |
| **Advancement** | Improvements, and everything they unlock | Taken on `/hunters/:id/advancement`. **Removed** from the sheet's Advancement block (10.2), as a hard delete with no trace, per Skyler 2026-09-11. Removal also removes the move that improvement granted, if any (Q6). |
| **Play state** | Luck, Harm, Experience, extra track values; the Curse-Eater's journal entries (since 2026-09-11, Question 4) | **The sheet itself.** Not an edit to the character — the marks you make on paper during a session. Counters are clicked; journal entries are added, edited and removed inline (8.3). |

### 2.2 Recommended route set

| Route | What it is |
|---|---|
| `/hunters` | list (unchanged) |
| `/hunters/new` | the wizard, when it lands (today: `hunter-create`) |
| `/hunters/:id` | **the sheet.** Read-only about the character; live for play state. |
| `/hunters/:id/advancement` | Skyler's route, per Q2. Not designed here. |
| ~~`/hunters/:id/edit`~~ | **Does not exist.** Confirmed by Skyler 2026-09-11 (Question 1). |

**So the "split" now means something narrower than in my first pass: not *sheet here, form there*, but *the form has no post-creation role at all*.** `HunterFormComponent` becomes wizard-only, and if the wizard is built as its own thing, the form's last consumer disappears with it. That's a hand-off note, not a design call.

**The remedy for a mis-created hunter is delete and re-create.** That makes the delete affordance *more* important under this rule, not less — it is the only correction path for anything set at creation. (Since 2026-09-11 advancement has its own: removing the improvement. That never touches creation data. It removes only the improvement and any move it granted, and it can't restore a creation pick an improvement deleted, 10.2.) It stays on the sheet, as the icon-only `action-btn action-btn--delete` + existing `ConfirmDeleteModalComponent`.

**Consequences worth seeing before committing**, none of which I'd design around unilaterally:

- ~~**A typo in a hunter's name has no fix path.**~~ **Resolved 2026-09-11 (Question 2):** Name and Pronouns are editable in place on the sheet (Section 4), and the wizard ends in a full review screen (12.3). **A Look line answered with the wrong word still has no fix path** except deleting and rebuilding, which for a leveled hunter destroys its advancement history. Skyler's option named Name and Pronouns only, so Looks stay locked. **The gap is small, and I'm not raising it as a question.**
  - No Look answer has rules attached, so a wrong one costs an inaccurate description, never a wrong roll.
  - The now-confirmed review screen is where it gets caught.
  - The line Skyler drew is principled. Name and Pronouns are free text with no template behind them. A Look answer is a pick from the playbook's Look options (an option, or `freeformText` against a category), so changing one is re-picking, which is what Q5b locked.
  - If it bites in play, that's a new question for Skyler, not an extension of the Name/Pronouns pencil.
- **A mis-recorded advancement *does* have a fix path** *(corrected 2026-09-11)*: remove it from the sheet's Advancement block and take it again. The first version of this bullet said it had none, and used that to push a confirm step onto the advancement form as the only guard. **That argument is gone, so the confirm step gets lighter. It does not disappear.** Yoshi's 7.2 step 4 already has the right shape: one confirm, with the consequence in the button's own label (*"Take this improvement and clear 5 experience."*). Keep exactly that. Don't stack an "are you sure?" modal on top, and don't use "this cannot be undone" copy anywhere on `/advancement`, because now it can be. The confirm still earns its place for the one part removal does **not** reverse, the experience reset: Experience is a plain play-state int (`HunterEntities.cs:83-90`), not derived from improvement rows. How that reset reads during a backfill is still the flow pass's question (ideation 7.2).
- **Removing one kind of improvement could have left a hunter that won't save** *(resolved 2026-09-11)*. Taking back a `+1 move` improvement while the extra move was still picked would have put the hunter over its move allowance, with nowhere to unpick it. Skyler chose Yoshi's recorded grant (Question 6), so removal takes that move with it and the hunter stays within its allowance.

### 2.3 Play state on the sheet — what it looks like

The Luck / Harm / Experience / extra-track boxes in the header are `<button>`s, not decoration. Click box *n* to set the value to *n*; click the box that is already the current value to step back to *n−1* (standard tracker behaviour, and the only way to un-mark). `aria-label` per box (`"Mark Luck 4 of 7"`). No explicit save button.

**How counter marks save** *(rewritten 2026-09-11. Skyler resolved Question 3 with `PATCH /hunters/{id}/state` for these four counter kinds only. The contract is Bowser's and isn't specified here.)*

- **Optimistic.** The box fills or empties on click, before any request goes out. A Harm mark that waits on a round-trip would feel broken at the table.
- **The ~500ms debounce stays, for a different reason.** It used to avoid re-sending the whole hunter on every click, and the `PATCH` removes that cost. It still earns its place because a burst of clicks (a misclick and its correction, or stepping Luck back two boxes) would otherwise become several writes whose responses can land out of order, leaving the server a step behind the screen. **One trailing ~500ms timer per hunter, shared by all counters**, sends the burst's final values as one request. Clicks made while that request is in flight start the next burst instead of a parallel request, so one hunter's writes never overlap.
- **Flush immediately, without waiting, when something is about to depend on the value:** on `Advance` (the advancement screen reads Experience), on leaving the route, and before any other write the sheet sends. *(Re-checked 2026-09-11 against Question 7.)* Name/Pronouns and journal saves now skip the pick rules and stay off the whole-hunter `PUT` (Section 4, 8.3), so **the only `PUT` left on the sheet is removing an improvement** (10.2). That `PUT` carries counter values too, so letting it race a pending `PATCH` could still write stale marks back. For label and journal saves the flush is about order, not overwriting: **all of the sheet's writes for one hunter go through one queue and never overlap.** That holds whether Bowser widens the `PATCH` or adds a sibling endpoint, so the sheet doesn't depend on his choice.
- **What a failure looks like now.** A counter save can no longer fail because of a pick rule elsewhere on the hunter; that failure mode is gone. What's left is transient (offline, server error) or terminal (the hunter was deleted elsewhere).
  - **Revert, then say so.** The boxes in the failed burst return to the last values the server confirmed, animated by the boxes' existing `transition-colors` so the change is visible. Then `NotificationService.error` shows one self-contained line: *"Couldn't save Harm. It's back to 2."* If the burst touched more than one counter: *"Couldn't save your marks. The tracks are back to what was last saved."* The toast is message-only and auto-dismisses after 4s (`core/notifications.ts`), so there's no Retry button to design. Trying again means clicking the box again.
  - **No inline error state.** No red outline, no disabled boxes, no "unsaved" badge. The reverted boxes *are* the honest state, and the next click just works once the connection is back.
  - **Hunter gone:** *"This hunter no longer exists."*, then route to `/hunters`.

Everything else about the character is inert. There is no hover affordance and no focus ring on any other block — the visual message is *these seven boxes are the only live things here*, which is exactly the printed sheet's own message. The page's other controls are *actions*, not live values, and each one is an explicit button from the app's existing vocabulary, never a click-anywhere field: `Advance`, the delete icon, the pencil beside the name that opens the Name/Pronouns edit (Section 4, since 2026-09-11), the journal's `+ Add entry` plus an edit and a remove icon on each entry (8.3, since 2026-09-11), and a remove icon on each Advancement row (10.2).

**Two hand-off notes:**

- ~~**A single Luck click is a full-hunter `PUT`.**~~ **Resolved 2026-09-11 (Question 3).** Counters save through `PATCH /hunters/{id}/state`, which is Bowser's work. The whole-hunter `PUT` remains only as the save path for removing an improvement (10.2), which is why the flush rule above still covers it.
- **The Curse-Eater's journal is play state** *(resolved 2026-09-11, Question 4, against my add-only design)*. `HunterJournalEntry`'s own comment says *"the content is invented during play"* (`HunterEntities.cs:294-298`). I had put only **adding** on the sheet; Skyler chose add, edit **and** remove, treating entries like play-state marks. The spec is in 8.3. It affects one playbook, and it's scoped to journal entries, not a general edit control.

---

## 3. Reading order — one order, three consumers

`HunterCompleteness.Evaluate`'s doc comment states the rule this design adopts wholesale:

> *"Outstanding items in the order the sheet prints them, so the list reads as a walk down the page."* — `HunterCompleteness.cs:33-35`

The form prints the same walk. **The sheet must use it too.** Three orderings for the same object would be a defect, not a style difference. In a multi-column layout the order becomes *DOM order*, which is also the single-column order and the screen-reader order.

| # | Block | Region | Condition |
|---|---|---|---|
| 1 | Identity (name, pronouns, playbook, level) | Header | always |
| 2 | Ratings | Header (state strip) | `statArrayOptions.length > 0` |
| 3 | Luck / Harm / Experience | Header (state strip) — **live** | always |
| 4 | Extra tracks | Header (state strip) — **live** | `extraTracks.length > 0` (2 playbooks) |
| 5 | Outstanding | Full width, under header | `outstanding.length > 0` |
| 6 | Moves, each with its own bespoke section nested beneath it when it has one | Region A | always (sections: 13 moves across 9 playbooks, 7.1) |
| 7 | *`{playbook.name}` rules* (bespoke) | Region B | `bespokeSections.length > 0` (24 of 28) |
| 8 | Journal | Region B | `bespokeJournals.length > 0` (1 of 28) |
| 9 | Gear | Region C (rail) | `gearCategories.length > 0` |
| 10 | Look | Region C (rail) | `lookCategories.length > 0` |
| 11 | History | Region C (rail) | `background` non-empty |
| 12 | Advancement | Region C (rail) | always |

**The one deliberate divergence from the form's order: Luck / Harm / Experience are promoted from position 7 to the header.** They are the only live values on the page, the printed sheet puts them top-right for that reason, and experience-full is what sends you to `/advancement`, so it must be adjacent to that button. Safe downstream: `HunterCompleteness` deliberately excludes all three from `Outstanding` (`HunterCompleteness.cs:96-104`), so no other consumer's order depends on where they sit.

---

## 4. The header — what is above the fold

`<main>` is the scroll container (`page-layout.html:129`, `flex-1 min-h-0 overflow-auto p-4`; `body` is `overflow: hidden`). "Above the fold" is the first viewport of `<main>`, and `sticky top-0` works inside it if the header is ever wanted pinned.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to hunters                                                                    │
│                                                                                      │
│ Marla Kesey   [The Chosen]  [Level 3]  [Ready to play]            [Advance]       🗑 │
│ she/her                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ CHARM  COOL  SHARP  TOUGH  WEIRD │ LUCK  ▣▣▣□□□□  3 of 7                          │ │
│ │  +1     +2    +2     -1     +1   │ HARM  ▣▣□│□□□□ 2 · unstable at 4               │ │
│ │             array+1              │ EXP   ▣▣▣▣▣    Ready to advance                │ │
│ │             adv. +1              │ CORRUPTION  Clean ▣▣□□□□ Corrupted             │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Line 1** reuses the shipped pattern verbatim — `hunter-detail.html:9-16` already renders `<h2>` + `bg-badge-playbook` + a conditional `bg-success` "Ready to play" chip on a `flex flex-wrap items-baseline gap-2` line. Keep it; add the level chip and, since 2026-09-11, the identity pencil.

- **Level chip:** `Level 3` — `bg-accent-subtle text-accent` with the existing badge geometry (`rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem]`). **No new token.** Both custom properties are defined in `:root` and `.dark`, and already pair on the header avatar button (`page-layout.html:94`). ~6.9:1 light, ~5.5:1 dark. Show `Level 0` too — an explicit zero is information; a missing chip is ambiguity.

**Editing Name and Pronouns in place** *(added 2026-09-11)*. Skyler resolved Questions 1 and 2 together: no edit route, but Name and Pronouns can be changed on the sheet, because they're labels with no rules attached. Look answers were not included and stay locked (2.2).

**Resting.** One icon button directly after the `<h2>`, before the playbook badge. It uses `action-btn action-btn--edit` with `app-icon name="pencil"`, the markup `mysteries-list.html:29-31` already uses, rendered as a `<button type="button">`. It gets `self-center` (the line is baseline-aligned), and `title` and `aria-label` both read "Edit name and pronouns".
- **One pencil for both fields.** They're one identity, and two pencils on two short lines is clutter.
- **Beside the name, not in the action cluster.** Next to `Advance` and delete, a pencil would read as "edit this hunter", exactly the whole-hunter edit Question 1 ruled out. Next to the name, it reads as editing the name.

**Editing.** The `<h2>` and the pronouns line swap in place for an inline `<form>`. The badges, the action cluster and the state strip stay put, and the tracks stay live.

```
│ [ Marla Kesey_____________ ]  [The Chosen]  [Level 3]  [Ready to play]    [Advance]    🗑 │
│ [ she/her____ ]  [ Save ]  Cancel                                                      │
```

- **Name input:** `aria-label="Name"`, `required`, autofocused with its text selected. It inherits the `<h2>`'s font size and weight so the line doesn't jump. Border and focus use the form's existing input classes (`border border-strong rounded-lg px-2 py-1 font-[inherit] focus:border-accent focus:outline-none focus:ring-focus`), with `flex-1 min-w-[12rem] max-w-[28rem]`.
- **Pronouns input** on line 2: same classes at that line's size, `placeholder="Pronouns"`, `max-w-[12rem]`. It appears even when the hunter has no pronouns yet, so they can be added, and it may be cleared: the field is optional (`HunterEntities.cs:61-64`).
- **Save** uses 8.3's outline button treatment in accent, never filled, because `Advance` stays the page's only filled control. **Cancel** is a plain text button (`bg-transparent border-0 text-secondary`). Both come after the pronouns input, so tab order runs name, pronouns, Save, Cancel.
- **Enter** saves and **Escape** cancels. Cancel restores the saved values and returns focus to the pencil.
- **Save is disabled** while the trimmed name is empty (the API requires one, `HunterContracts.cs:161`) or nothing has changed.
- **`max-sm`:** both inputs full width and stacked, with Save and Cancel on their own row.

**Saving.** Inputs and buttons are disabled and Save reads `Saving…`. No confirm dialog, since nothing is destroyed and Cancel exists.

**Success.** Back to the resting line with the new values and focus on the pencil. No success toast, because the changed name is the confirmation.

**Failure.** Stay in edit mode with the typed values intact, and show `NotificationService.error`: *"Couldn't save the name. Your changes are still here."* **Name and Pronouns save without running the pick rules** (Skyler, Question 7), through a widened `PATCH` or a sibling endpoint. That choice is Bowser's and isn't specified here. So a rename can only fail because of the name itself or a transient error, never an unrelated rule. When the server rejects the name, the toast carries its reason. Like every sheet write, the save waits its turn in the hunter's write queue (2.3).

**Action cluster — two controls, unchanged by the 2026-09-11 answers.** `/edit` is gone (confirmed, Question 1), and the Name/Pronouns pencil lives in the identity line, not here:

- **`Advance`** — the only filled `bg-accent` control on the page, `routerLink="/hunters/{id}/advancement"`. **Always enabled**, never gated on experience: Skyler will be backfilling hunters whose experience he never tracked. Readiness is communicated by the XP boxes beside it, not by the button's state.
  - *Wording (resolved 2026-09-11, Question 5):* the button reads **"Advance"**, matching the `/advancement` route and the screen it opens. My first version said "Level up", the rulebook's verb. The rulebook's phrase can still appear in explanatory text about the rules, but not as UI text.
- **Delete** — icon-only `action-btn action-btn--delete` + `app-icon name="trash"`, matching `hunters-list.html:25-32`. **Demoted from today's full-width labelled `Delete hunter` button.** Even though it is the sole correction path for the rest of creation data, an always-visible destructive control at button weight on a page you keep open at the table is the wrong risk; the confirm modal carries the label and the consequence.
- At `max-sm` the cluster is `Advance` full-width with the delete icon trailing on the same row.

**The state strip** is one card, `bg-surface border border-default rounded-lg p-3`, `grid gap-6 grid-cols-[auto_1fr] max-md:grid-cols-1` — ratings left, live tracks right, separated by `border-l border-default pl-6` on the right cell at `md`+.

*Rating pips* — `grid grid-cols-5 gap-4 text-center`:
```
<span class="text-[0.7rem] font-semibold tracking-[0.05em] uppercase text-secondary">Sharp</span>
<span class="text-2xl font-semibold tabular-nums">+2</span>
<small class="text-muted text-[0.72rem]">array +1 · adv. +1</small>   ← only when a delta exists
```
That third line is the display-side answer to *"why does this hunter have +2 Sharp"* and costs one conditional. Make the pip a scroll-anchor to the Advancement block when it renders. Reuse `formatStat()` from `hunter-form.ts` so the two surfaces sign numbers identically.

*Live box tracks* — actual boxes, because that is the sheet's own mechanism and 7 is small enough to be legible. Per box: `<button type="button" class="h-4 w-4 rounded-[0.2rem] border border-strong cursor-pointer transition-colors">`, filled = `bg-accent` (Luck, Experience, extra tracks) or `bg-danger` (Harm), empty = `bg-transparent hover:bg-surface-hover`.

- **Harm** gets a visible unstable marker: `border-l-2 border-danger` on the box at index `harmUnstableThreshold`. That value is in the contract and currently appears only as the words *"unstable at 4"* in a form label — this makes it something you can see.
- **Experience** at `experience === experienceBoxCount` fills accent and gains a `text-accent font-semibold text-[0.8rem]` "Ready to advance" line (it read "Ready to level up" until Question 5 renamed the button this notice points at; the change was confirmed by Skyler 2026-09-11). No animation, no new token. This is the *notification*; the header button is the *action*. They must not both be buttons.
- Extra tracks join the same stack using `startLabel` / `endLabel` / `boxCount`. `startLabel` is nullable — omit the leading label when null.

**Outstanding** keeps its current styling (`hunter-detail.html:32-41`, neutral `bg-surface`, never danger — it is informational and blocks nothing), spans full width under the header, with one change: cap it. `HunterCompleteness` can emit one line per unmet minimum *per instance* — a half-built Hex with three Rotes yields five or six. Show three, then a `<details>` "+n more". Note that under one-way creation an `Outstanding` line is now a **permanent** statement for anything the wizard didn't capture, not a to-do — worth the copy being "Not recorded" rather than "Still to finish". (Question 2's resolution doesn't change this. Only Name and Pronouns became editable, and the confirmed wizard review step is what keeps these lines rare.)

---

## 5. Layout — full-bleed, three regions, prose measured inside its column

**Q3 reversed my first-pass call.** No page container. The complaint was right: a single centred column at 1344px on a 2560px monitor wastes most of the screen, and a hunter has enough content to fill it. What must not happen is the *other* failure — 990px-wide lines of move description. So: **extra width buys more columns and wider cards, and the prose inside a card is measured independently.**

### 5.1 The grid

The app already has this idiom in two places — `monster-detail.html:56` (`grid gap-4 grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1`) and `mystery-detail.html:74` (auto-fit). Use the explicit-span form, because the region order is load-bearing (Section 3) and auto-fit reflows it.

```html
<section class="text-primary">
  … back link, header, state strip, Outstanding — all full width …

  <div class="grid gap-4 items-start md:grid-cols-2 xl:grid-cols-12">
    <!-- A · Moves -->
    <div class="grid gap-4 content-start md:col-span-2 xl:col-span-5"> … </div>
    <!-- B · {playbook} rules + journal -->
    <div class="grid gap-4 content-start md:col-span-1 xl:col-span-4"> … </div>
    <!-- C · rail: Gear, Look, History, Advancement -->
    <div class="grid gap-4 content-start md:col-span-1 xl:col-span-3
                [@media(min-width:1900px)]:grid-cols-1"> … </div>
  </div>
</section>
```

`items-start` + `content-start` is what stops a short region from stretching to a tall one's height — the single most common failure mode of a multi-column detail page.

Measured against real viewport widths (sidebar 112px, `<main>` padding 32px, gaps 32px):

| Viewport | A · Moves | B · Rules | C · Rail |
|---:|---:|---:|---:|
| 1200 | 440 | 352 | 264 |
| 1440 | 540 | 432 | 324 |
| 1920 | 727 | 581 | 436 |
| 2560 | 992 | 794 | 595 |

**Prose is measured inside its card, not by the page.** Every long-text element — move `descriptionText`, section `description` / `effectText`, History — carries `max-w-[42rem]` (672px). Below 1900px that's never reached and the card fills its column; above it the text stops growing while the card keeps its place in the grid. That is the direct answer to "hold prose to a readable measure inside its own column."

**And at ultra-wide, the Moves list goes two-up rather than getting taller**: `[@media(min-width:1900px)]:grid-cols-2` on the move list inside region A, each move its own card. At 2560 that's two ~480px columns of moves — genuinely more on screen, still readable. Below 1900px it's a single stack.

Breakpoints used are this project's own: `sm` = 540px and `xl` = **1200px** (overridden in `styles.css:31-32`), `md` = Tailwind's 768. The two `[@media(min-width:1900px)]` arbitrary variants are new; there's no `2xl` token here and I'd rather not mint one for two call sites.

### 5.2 The four playbooks with nothing in region B

The Mundane, Celebrity, Flake and Searcher have no playbook-level bespoke sections and no journal — region B renders nothing. In a 12-column grid that leaves a 4-column hole between Moves and the rail. (Move-level sections don't count toward this, because they render in region A. The Searcher, with three of them, still re-spans, and its wider Moves column is where they land.)

**Fix:** when region B is empty, promote the spans to `xl:col-span-8` (Moves) and `xl:col-span-4` (rail). One `[class.xl:col-span-8]` binding on each, keyed off `playbook.bespokeSections.length + playbook.bespokeJournals.length === 0`. Two bindings, no second template. Do not leave the hole and do not reorder — a Mundane sheet should read like a Chosen sheet minus one region, not like a different page.

### 5.3 Narrow widths

- **`md` (768–1199):** two columns. Moves spans both (full width — move prose is the thing that suffers first from a narrow column); rules and rail sit side by side beneath.
- **`< md` (768):** one column, in Section 3's DOM order. That is the printed sheet's own front-then-back reading, and Skyler confirmed single column is fine here.
- **`< sm` (540):** state strip stacks — rating pips stay a 5-across `grid-cols-5` (five short numbers; don't wrap them), live tracks move below. 7 boxes at `h-4 w-4` + `gap-1` ≈ 8rem, comfortable at 320px. Bespoke chip rows drop their label column to `grid-cols-1`, label above chips. The journal table becomes stacked pairs.
- No horizontal scroll anywhere; the journal is the only table and it has a stacked fallback rather than `overflow-x-auto`.

---

## 6. Cards, headings, and what vocabulary is being reused

`mystery-detail.html` holds this app's only read-only content vocabulary, and it is good. Reuse it exactly:

- **Card:** `bg-surface border border-default rounded-lg px-5 py-4` (`mystery-detail.html:15`).
- **Section heading:** `text-secondary text-[0.85rem] font-semibold tracking-[0.05em] m-0 mb-2 uppercase` (`mystery-detail.html:16`). This small-caps heading is what makes a read page look like a read page rather than a form — and with `/edit` gone it's now the *only* thing distinguishing the sheet's typography from the wizard's.
- **Prose:** `leading-[1.65] m-0 whitespace-pre-wrap` (`mystery-detail.html:22`) — History uses this verbatim, plus `max-w-[42rem]`.
- **Chip:** the weapon-tag chip, `bg-weapon-chip border border-weapon-chip-line rounded-full text-on-weapon-chip text-[0.75rem] leading-none px-[0.6rem] py-1` (`monster-detail.html:67`). Already dark-themed; already means *"a small tag belonging to this thing"*. This is the bespoke display's workhorse — Section 8.
- **Nesting:** `border-l-2 border-default pl-3` for anything subordinate — the option tree's existing divider treatment (`bespoke-option-tree.html:64`).
- **Row-level actions:** `action-btn` / `--delete` + `app-icon`, global in `styles.css:266-280`.

`mystery-detail` pairs each heading with an `app-mystery-section-icon`. **Don't do that here.** The sprite (`icon-sprite.component.ts`) has no glyph for ratings/moves/gear/look/advancement, and minting five is separate work with its own review. The uppercase heading carries the hierarchy alone; icons are additive later.

---

## 7. Moves — region A

- **Show only the moves this hunter has** (required + picked). Unpicked moves were the form's business and are now nobody's; the sheet says what the hunter *is*.
- **Fully expanded, never collapsed.** `moveGrantCount` 2–4 plus required moves is ~3–7 entries. Collapsing the one thing the page exists to show would be false economy — and at ≥1900px they go two-up rather than needing collapse.
- `descriptionText` carries a constrained HTML subset (`<i>`, `<b>`, `<ul><li>`) — render with `[innerHTML]`, as `hunter-form.html:90,123` already do. Wrap it in `max-w-[42rem]`.
- Required moves keep the shipped **"Always granted"** badge (`bg-badge-playbook text-on-badge-playbook`, `hunter-form.html:88`) — same words, same token, so the sheet and the wizard agree.
- **Move-internal bespoke answers nest under their move.** 13 moves across nine playbooks carry a section (premise 2, corrected 2026-09-11). Five of those are Required moves, so every Forged, Gumshoe, Host, Searcher and Spell-Slinger sheet shows at least one. Spec in 7.1.
- Advanced moves appear here only once a hunter can hold one, which today is impossible (`pickableMoves` excludes them) and becomes possible through advancement. Give them a second badge rather than a separate list — one move list, annotated.

Per move: `<strong>` name + badges on a `flex flex-wrap items-baseline gap-2` line, description below at `text-[0.9rem] leading-[1.6]`. Below 1900px, moves are rows in one card separated by `border-b border-default py-3 last:border-b-0` (`monster-detail.html:61`'s idiom); at ≥1900px each move is its own card in a two-column grid.

### 7.1 Move-internal sections — Section 8's renderer, a lighter frame *(added 2026-09-11)*

The form already uses **one** `#bespokeSection` template for both placements (`hunter-form.html:367-372`: *"the only difference between them is where they render"*). **The sheet should do the same.** Use one section renderer, branching on Section 8's four predicates, in both region B and under a move in region A. Only the frame changes.

- **Placement:** directly beneath the move's description, inside that move's row (or its own card at ≥1900px), wrapped in `border-l-2 border-default pl-3 mt-2`, Section 6's nesting treatment. Not the form's `ml-8` offset: a read view doesn't need a second frame inside a bordered row.
- **Heading:** omit it when `section.title === move.name`, which holds for all 13 today. A *Force of Nature* heading under the move *Force of Nature* says the same thing twice. If a title ever differs, show it at the chip-row label size (`text-[0.8rem] font-semibold text-secondary`), not as the uppercase card heading.
- **Visibility needs no extra check.** The sheet shows only moves the hunter has, which is exactly `moveSectionsFor`'s rule (required or picked, `hunter-form.ts:536-538`).
- **The 11 option trees** use 8.1's grouped chip rows. Nine are flat, so they render as one unlabelled chip row (*Force of Nature* → `( insect swarms )`). The Forged's Partner and The Professional's Mobility are categorised and get labelled rows (Partner → `Bonds  ( Telepathic link ) ( Locational awareness )`). Three of the trees have a `{{blank}}` leaf (The Changeling's *something else*, The Forged's Partner, The Visitor's *Something else (with the group's agreement)*), and 8.2's `withAnswer()` applies unchanged.
- **The 2 repeatables have no options.** The Searcher's Network (0–5) and The Spell-Slinger's Arcane Reputation (exactly 3) are each a list of names with a line of detail: `instance.name`, plus the free text under `freeTextLabel` (`Member` / `Organization`). Section 8's sub-card per instance is right for The Hex's Rotes, which each carry an option tree. It's too heavy for a name and a sentence nested inside a move row. Render a plain list instead: `<ul class="grid gap-1 m-0 p-0 list-none text-[0.9rem]">`, one `<li>` per instance, `<span class="font-semibold">name</span>` then ` — ` and the detail in `text-secondary`. Name fallback `Untitled`, zero instances `None.`, both Section 8's wording. The branch is *repeatable with no options*, not *repeatable inside a move*, so if one ever appears at playbook level it gets the same list.

```
Network
You may gain an ally group of others who had experiences similar to your first encounter…
  │ Dana Ruiz — ham-radio operator; logs every light over Route 9
  │ Pastor Hale — parish records back to 1840
  │ Detail up to five members with useful skills related to what happened to them…
```

- **`description`** (3 of the 13 have one: Network, Tools and Techniques, Arcane Reputation) renders under the answers, as in 8.1, `text-[0.85rem] text-muted max-w-[42rem]`. None of the 13 carry `effectText`.
- **No new status line.** An Arcane Reputation hunter with fewer than three organizations is already reported in `Outstanding`, so the list doesn't repeat it.

---

## 8. Bespoke rulesets — region B, and the one real invention

Confirmed unchanged by Q4: *"Showing what the hunter picked is perfect. No need to display unchosen content."*

**The structural rule: branch on the same four predicates the form already uses** (`hunter-form.html:396-471`), so the two surfaces can never disagree about what kind of thing a section is. The same renderer serves the 13 move-internal sections in region A (7.1). Counts below cover both placements.

| Predicate | Count in seed (playbook-level / in a move) | Display presentation |
|---|---:|---|
| `isFixedGrant` — zero options, no `freeTextLabel` | 7 / 0 | **Rules card.** Title, `description`, `effectText`. No answer area, and *not* the form's `"Always active — nothing to choose."` line: that exists to explain a missing checkbox, and there are no checkboxes here. On a read-only sheet the absence is the statement. |
| `freeTextLabel`, not repeatable | 1 / 0 (Gumshoe's Code) | Title, `freeTextLabel` as a muted label, the answer as prose. Unanswered → `Not recorded.` |
| repeatable (`min`/`maxInstances`) | **1 / 2** (Hex's Rotes; Searcher's Network, Spell-Slinger's Arcane Reputation) | A stack of sub-cards, one per `HunterBespokeSectionInstance`, headed by `instance.name` (fallback `Untitled`), each with its own chip rows. Zero instances → `None.` **When the section has no options (both move-level ones), a plain `name — detail` list instead (7.1).** |
| everything else — an option tree | 27 / 11 | **Grouped chip rows.** Below. |

### 8.1 Grouped chip rows — the recommendation

One row per **engaged** top-level option: label left, that branch's picked leaves as chips right. Never an unpicked option; never a checkbox.

The Chosen's Fate — three categories, five picked leaves, a three-level tree — becomes three lines:

```
FATE
  How You Found Out    ( Nightmares and visions )
  Heroic               ( Comfort/support )  ( Protect the innocent )
  Doom                 ( Doomed to fall in battle )  ( Betrayed by an ally )

  This is how your fate will unfold. It's okay to pick contradictory tags…
  Whenever you mark off a point of Luck, the Keeper will throw something from your fate at you.
```

Markup per row: `grid grid-cols-[minmax(7rem,auto)_1fr] gap-3 items-baseline max-sm:grid-cols-1`, label `text-[0.8rem] font-semibold text-secondary`, chips in `flex flex-wrap gap-[0.35rem]` using the weapon-tag chip classes.

Why this and not the alternatives:

- **A read-only copy of the option tree** (disabled checkboxes) renders every *un*taken option — The Chosen's five picks arrive inside ~30 rows. Ruled out by Q4 anyway.
- **A flat chip cloud** loses the category, and the category is the meaning: `Heroic` vs `Doom` is the entire content of a Fate tag; `Attack` vs `Effect` is the entire content of a Combat Magic pick.
- **The label column can be absent.** A flat section (leaves directly at top level, no dividers) collapses to one unlabelled chip row. Both shapes are in the corpus; the renderer handles both.
- **Depth beyond two levels flattens** — a third-level pick shows as a chip under its nearest labelled ancestor. Only Fate-shaped sections reach three levels and it reads correctly for them. Stated as a known simplification rather than left to be discovered.

Keep `section.effectText` beneath the rows, `text-[0.85rem] text-muted max-w-[42rem]`, `[innerHTML]` — it is the mechanical consequence and the reason the section is on the sheet.

### 8.2 The one genuinely new function: fill the blank, don't strip it

`bespoke-option-tree.ts:67-69`:
```ts
withoutBlank(text) { return (text ?? '').replace(/\{\{blank\}\}/g, ' ______ '); }
```

Right for the form — the blank sits next to the input that fills it. **Wrong for the sheet**: the hunter's answer lives in `freeformTitle` / `freeformText` and would simply not be shown. The Monstrous's write-your-own curses and natural attacks put a blank in *both* fields (`HunterEntities.cs:214-219`), so this is real content.

The sheet needs `withAnswer(template, answer)`: substitute the answer into the token, wrapped in `<span class="font-medium underline decoration-dotted underline-offset-2">` so the player's own words read as theirs inside the printed sentence; fall back to ` ______ ` only when the answer is empty. **New code, not a reuse.** Pure function, belongs beside `withoutBlank`.

Numeric leaves (`numericMin`/`numericMax` — one option corpus-wide, the Spooktacular's Infernal Favour) render as `Title · 3` appended to the chip, not as a separate control.

### 8.3 The journal — one playbook

The Curse-Eater's Consumed Magic is a repeating record with labelled fields. A real table: `<table class="w-full text-[0.85rem]">`, header from `journal.fields[].label` in `sortOrder`, one `<tr>` per `HunterJournalEntry` with `border-b border-default`. Zero entries → `No entries yet.` At `max-sm`, stacked `label: value` pairs, one card per entry.

**Add, edit and remove on the sheet** *(rewritten 2026-09-11. Skyler resolved Question 4 with add, edit and remove from the sheet, treating entries like play-state marks. My add-only design wasn't chosen.)* This is scoped to journal entries. The journal's title, description and field labels come from the playbook and are never editable, and no other block on the sheet gains these controls.

```
CONSUMED MAGIC   [ + Add entry ]
  Power                      Downside
  Hex-sight                  Can't cross running water                 ✎  🗑
  [ Stolen breath_______ ]   [ Nightmares every new moon_______ ]  [ Save ]  Cancel
```

- **`+ Add entry`** keeps the outline `bg-transparent border border-default rounded-lg text-[0.8rem] px-2 py-1` treatment the form already uses (`hunter-form.html:296-302`), beside the heading. It's never filled, since only `Advance` is. It appends a row in edit mode at the bottom of the table, with its first field focused.
- **Each row ends in an actions cell** (`w-0 whitespace-nowrap text-right`) holding the edit-plus-delete pair exactly as `mysteries-list.html:29-34` renders it: `action-btn action-btn--edit` with `pencil`, then `action-btn action-btn--delete` with `trash`. The accessible names use the entry's first field in `sortOrder` (`aria-label="Edit entry: Hex-sight"` / `"Remove entry: Hex-sight"`), falling back to `"Consumed Magic entry 3"` when that field is empty.
- **Editing** swaps that row's cells for inputs using the form's journal input classes (`hunter-form.html:315-317`), each with an `aria-label` of its field label. Save and Cancel sit in the actions cell and behave as in the Name/Pronouns edit (Section 4): Save uses 8.3's outline treatment in accent, Cancel is a text button, Enter saves, and Escape cancels and returns focus to the row's pencil.
- **Save is disabled** while every field is blank (an empty entry records nothing) or while nothing has changed. Cancel on a new, unsaved row removes that row.
- **Only one entry can be in edit mode at a time.** While a row is being added or edited, the other rows' icons and `+ Add entry` are disabled, using the existing `.action-btn:disabled` style (`styles.css:278-280`). That rules out two half-finished drafts, and any question about which one a save carries.
- **Saving, success and failure** work as in the Name/Pronouns edit. Inputs are disabled and Save reads `Saving…`. On success the row returns to resting, focus goes to its pencil, and there's no toast. On failure the row stays in edit mode with the typed values, and `NotificationService.error` shows *"Couldn't save the entry. Your changes are still here."* Per Question 7 these saves skip the pick rules and check only their own fields, so if the server rejects a field, the toast carries its reason.
- **Removing** opens the existing `ConfirmDeleteModalComponent`, **which fits without changes**: one item and no choice to make, the same shape as improvement removal (10.2).
  - `verb="Remove"`, and `itemName` is the same name as the aria-label, so the title reads *Remove "Hex-sight"?*
  - `message` carries both the consequence and the permanence, because `permanenceNote` only renders when `items` is set (`confirm-delete-modal.component.html:11-23`): *"Its Power and Downside are deleted. No record of it is kept, and Corruption isn't changed."*
  - The last clause mirrors 10.2's *"experience isn't changed"*. Consuming the magic is what marked Corruption, and deleting its record doesn't give those boxes back.
  - The row leaves the table once the save succeeds. If it fails, the row stays and the error toast shows.
- **Save path:** add, edit and remove all use the save that skips pick rules (Question 7). I read removal as a journal save. Whether that save is a widened `PATCH` or a sibling endpoint is Bowser's call, and this spec doesn't depend on it. Like every sheet write, these wait their turn in the hunter's write queue (2.3). There's no debounce: an entry is typed deliberately and saved explicitly, not marked with a click.
- **`max-sm`:** each entry is a stacked card, as before, with the icon pair at its bottom right. In edit mode the fields stack label-above-input, the form's own layout.

It is one playbook out of 28. Don't generalize; don't build a table component. Write the table.

---

## 9. Gear, Look, History — region C

**Gear.** One block per category: label as `text-[0.8rem] font-semibold text-secondary`, then picked options — `<strong>name</strong>` with `mechanicalText` beneath in `text-[0.85rem] text-muted`. Omit unpicked options and empty categories entirely.

**Look.** `PlaybookLookCategoryResponse` has **no per-category label** — only an optional `groupLabel` on the group (`PlaybookContracts.cs:73-78`). Per-category rows would be unlabelled and meaningless. Render as prose: per group, the group label then the answers joined with ` · `, resolving each `HunterLookSelectionModel` to its option's `text` or its `freeformText`. Two to three categories per playbook makes this one short paragraph. Unanswered lines simply absent.

**History.** `Hunter.Background` is free prose. `whitespace-pre-wrap leading-[1.65] max-w-[42rem]`, direct reuse of `mystery-detail.html:22`. Do **not** show `historyPromptsText` — it is authoring guidance and belongs in the wizard.

---

## 10. Advancement — the sheet's hand-off

Per Q2 this is its own form at `/hunters/:id/advancement`: pick the improvement first, which may then prompt a secondary pick, some of which (a move from another playbook) are substantial work. **Not designed here**, except for the one HA-2 step Skyler's 2026-09-11 answer creates: changing the creation pick an improvement names (10.4). What the sheet owes it is one button and one history block.

### 10.1 What the sheet's block assumes

Per improvement a hunter has taken:

1. **A link to the printed improvement line**, so its text renders. *(Without this: nothing works. Blocking.)*
2. **A date.** *(Without this: the right-hand column goes and it reads as an unordered list. Degrades cleanly.)*
3. **An optional structured effect** — enough to render `Sharp +1`. *(Without this: no effect chips, and the rating pips lose their `array +1 · adv. +1` sub-line. Degrades cleanly; still worth shipping.)*
4. **An optional free-text note.** *(Without this: the ~41% of lines with no mechanical consequence carry only their printed text. Degrades cleanly.)*

Stated as a *display requirement*, not an endorsement of any schema. Yoshi's document is being revisited in light of Q5b; if the record ends up different, only items 2–4 move.

**What the sheet does not assume:** that the count is stored (it renders `improvements.length`), that ordering is stored (sorts by date, falling back to insertion order), or that the advanced-unlock threshold is stored (compares the count to 5).

### 10.2 The block

Rail card, heading `ADVANCEMENT`:

```
ADVANCEMENT
Level 3 · 3 improvements taken

  Get +1 Sharp, max +3                    [Sharp +1]     12 Aug   🗑
  Take another Chosen move                [+1 move]      19 Aug   🗑
  Gain an ally                             recorded       2 Sep   🗑
  ──────────────────────────────────────────────────────────────────
  Advanced improvements unlock at 5 level-ups — 2 to go.
```

- **Oldest first.** The printed sheet's checkbox column reads top-down in the order it was ticked, and "how did this hunter get here" is a chronological question.
- **A remove control per row** *(reinstated 2026-09-11: Skyler chose OQ-1, so improvements are removable, as a hard delete with no trace)*. An icon-only `action-btn action-btn--delete` with `app-icon name="trash"`, `shrink-0`, after the date. It's the same row-action vocabulary as `hunters-list.html:25-32` and the sheet's own header delete. `aria-label="Remove improvement: {text}"`. Never a labelled button: the block is still read far more than it is corrected, and the confirm carries the words.
  - **Confirm** through the existing `ConfirmDeleteModalComponent`, with `verb="Remove"` (the precedent `confirm-delete-modal.component.ts:14-16` records for removals) and `itemName` set to the printed improvement text, so the title reads *Remove "Get +1 Sharp, max +3"?* The modal only renders `permanenceNote` when `items` is non-empty (`confirm-delete-modal.component.html:11-23`), so `message` has to carry both the consequence and the permanence, in one line chosen by effect kind:
    - rating kind: *"Sharp goes back to +1. No record of it is kept, and experience isn't changed."*
    - `PlaybookMovePick`, **extra move already picked**: `message` *"This also removes the move it granted:"*, `items` = the move's name, `permanenceNote` *"No record of either is kept, and experience isn't changed."* The recorded grant (Question 6) means the app knows exactly which move goes, so it names it instead of asking. That is the modal's own list shape, already used for a monster's minions (`monsters-list.html:50-51`), so no new dialog. HA-2's recorded bespoke grants (e.g. the extra pick from `Take another Combat Magic pick`) use the same shape, with the granted picks' titles as `items`.
    - `PlaybookMovePick`, **extra move not picked yet**: *"This hunter goes back to 2 move picks. No record of it is kept, and experience isn't changed."*
    - `null` kind: *"Nothing else on the sheet changes. No record of it is kept, and experience isn't changed."*
    - **An improvement that deleted or swapped a creation pick** (HA-2, 10.4). Removal can't restore that pick: hard delete keeps nothing, so the app doesn't know which pick it was, and creation picks can't be re-chosen. **This is the one removal that loses something the player may want back, so its message leads with the loss** and names the section, because the pick itself can't be named:
      - delete-type: *"The Doom tag this deleted won't come back, and the app can't tell you which one it was. Fate will be one Doom tag short. No record of the improvement is kept, and experience isn't changed."*
      - swap-type: *"Your Task stays as it is now. The one it replaced won't come back. No record of the improvement is kept, and experience isn't changed."*
  - *"No record of it is kept"* replaces the app-wide *"This cannot be undone."* It's literally true (*"Hard delete, no trace"*), and it names the one way this differs from rubbing out a tick on paper: the history line goes too. *"Experience isn't changed"* is there because Experience is a plain int, not derived from improvement rows, so removal doesn't give back boxes the advancement cleared. The tracker sits in the header if the player wants them back.
  - On confirm: one full-hunter `PUT` without that row, sent after any pending counter writes have flushed (2.3; counters themselves now save through `PATCH`). The row leaves the list and the level chip and rating pips recompute. Failure uses the existing error toast.
- **Effect chip vs. plain text is a deliberate honesty call.** A mechanical effect gets a chip (`bg-accent-subtle text-accent`, badge geometry). A recorded-only line gets *no chip* — `text-muted text-[0.8rem] italic` "recorded". Badging all 525 lines would imply enforcement the app doesn't do for the 41% where there's nothing to enforce.
- **No `Advance` button here.** One primary action, in the header. Two competing primaries on one page is the exact collision flagged in the mystery wizard (`.squad/agents/Rosalina/history.md`, 2026-08-31).
- **The locked-advanced line is app-authored copy** (Q5a: ship it now). The source sentence *"After you have leveled up five times, you qualify for advanced improvements in addition to these."* is missing from all 28 stored `levelingUpText` values (ideation doc §1.2, OQ-7). Swap to the real sentence once that data correction lands — quoting the playbook is strictly better than paraphrasing it.
- **Do not put the improvement *lists* on the sheet.** 284 regular + 241 advanced lines belong on `/advancement`. The sheet shows what was taken.

### 10.3 The list page — withdrawn *(superseded 2026-09-10)*

My first answer to Yoshi's OQ-5, which he had left to me, was a `Level n` chip on `hunters-list` rows. Skyler then answered it himself: *"No, advancement count does not belong on the list page at all."* **No level or improvement count appears on the list page**, and `hunters-list.html` needs no change for advancement. The sheet's own `Level n` chip (Section 4, including the explicit `Level 0`) was not part of that question and stays.

### 10.4 On `/advancement`: the creation-pick step (HA-2) *(added 2026-09-11)*

Skyler chose the option *"Yes, as that improvement's own pick (Yoshi)"* for the roughly 12 improvements whose printed text changes a creation pick. Yoshi's OQ-9 lists them, including `Delete one of your Doom tags`, `Remove one Unknown Heritage tag`, `Change your Task to another option`, `Change your Guide`, `Change some, or all, your dark side tags`, and `You may cross off another option from your Tools and Techniques`. The advancement form as a whole still isn't designed here. This is the one step in it that exists because of that answer, sketched at the level of 10.2.

**Where it sits.** For these lines it fills Yoshi's 7.2 step 3 (*"what did this do?"*), after the improvement is picked and before the single confirm. Nothing about the flow's order changes.

**What it shows: only the section the improvement names.** That section is the improvement's effect target, either playbook-level or inside a move (Tools and Techniques is on a Required move, 7.1). How the target gets resolved is Yoshi's effect step. This step can't change it: no section picker, no other section, no moves, no gear, no links out.

```
Delete one of your Doom tags

FATE · DOOM                                         choose 1 to delete
  ( Doomed to fall in battle )   ( Betrayed by an ally )  ← selected: struck through

  After this: Doom 1 of 1.

  [ Just record it ]     [ Take this improvement, delete "Betrayed by an ally", and clear 5 experience ]
```

- **Delete-type** (`Delete…`, `Remove…`, `cross off…`): the hunter's *current* picks in that section, in 8.1's chip style but as toggle buttons (`<button type="button" aria-pressed>`), since on this screen they act. A chip selected for deletion takes `line-through opacity-60`. Exactly as many as the line says can be selected, never more. No unpicked options appear, because deleting doesn't need them.
- **Swap-type** (`Change your Task…`, `Change your Guide`): two rows. **Now** shows the hunter's current pick(s); choose which to give up (preselected when there's only one). **Instead** shows the section's unpicked options, in the same chip style; choose the same number. A chosen replacement takes `bg-accent-subtle text-accent`, so the pair reads as a swap. This is the only place after creation that shows a hunter unpicked options, and only for this one section.
- **"Change some, or all"** is a swap where the player sets the count, from one up to all. The two rows must match, and the confirm stays disabled until they do.
- **The consequence goes in the confirm button's label**, following Yoshi's step 4 (*"Take this improvement, delete "Betrayed by an ally", and clear 5 experience."*). The label is the preview, so there's no separate diff panel. The muted `After this:` line (8.1's label style) just shows the section still meets its count.
- **"Just record it" stays first-class** (Yoshi 7.2). It records the line with no effect and leaves the pick as it is.
- **One save.** The improvement and the pick change go out in the same `PUT`, so there is never a moment where the improvement is taken and the pick still held.

**What keeps it from becoming an edit control:**
1. **The section is fixed by the improvement.** No picker inside this step, and no path from it to any other part of the hunter.
2. **The count is fixed by the line.** Delete exactly *n*, or swap *n* for *n*. There's no add and no open re-pick.
3. **It exists only while taking an improvement.** The sheet has no entry point to it and never links to it.
4. **Removing the improvement later doesn't reopen it.** The pick doesn't come back and nothing offers to re-pick it. 10.2's confirm says so before the player commits.

**One hand-off to Yoshi (a data-shape point, not a question for Skyler):** a swap's *replacement* pick should **not** be recorded as a grant. If it were, removing the swap improvement would delete the replacement *and* fail to restore the original, leaving the section a pick short with no way to re-pick. 10.2's swap copy (*"Your Task stays as it is now"*) assumes the replacement stays. *(Confirmed by Skyler 2026-09-11: the grant column extends to HA-2 bespoke picks, with this swap exclusion. Yoshi is recording it.)*

---

## 11. Themes

Every colour used is already defined in both `:root` and `.dark` in `styles.css`. **No new tokens.** The two pairings not previously used together both clear AA in both themes: `bg-accent-subtle`/`text-accent` on a chip (~6.9:1 light, ~5.5:1 dark), and `bg-danger` as a filled box on `bg-surface` (red-600 on white, red-400 on slate-900 — this is a fill, not text, so the relevant check is against the `border-strong` outline it replaces, which holds in both).

One thing to watch in implementation: the empty-box hover fill is `bg-surface-hover`, which is `gray-200` light / `slate-700` dark. On the state strip's `bg-surface` card that reads in both. It would *not* read on `bg-surface-raised` in dark mode (`slate-800` vs `slate-700` is a near-invisible step) — the same collision recorded in `.squad/agents/Rosalina/history.md` for the confirm modal's Cancel button. The state strip must stay on `bg-surface`.

---

## 12. Where a display decision constrains the wizard

Flagged, not designed.

1. **The wizard's step order should be Section 3's order.** The form, `Outstanding` and the sheet all agree; a wizard that disagrees would be the fourth ordering of the same object.
2. **The wizard must land on `/hunters/:id`.** With `/edit` gone, that is also the only place it *can* land.
3. **The wizard has no correction path behind it (Q5b) apart from Name and Pronouns, so it ends with a full review screen before saving.** *Confirmed by Skyler 2026-09-11, as part of Question 2's resolution.* My further recommendation, which wasn't part of the option he chose: make that screen *the sheet itself*, rendered from the draft, with a Confirm bar. One renderer, and the thing you approve is literally the thing you get.
4. **Four playbooks have no playbook-level bespoke sections, one has a journal, two have extra tracks.** The sheet handles this by omitting blocks and re-spanning the grid (5.2). The wizard must *skip steps*, not show empty ones — same conditional set, applied to navigation.
5. **`{{blank}}` should read identically in both.** The wizard shows the blank inline in the printed sentence; the sheet fills it in (8.2). The transition from authoring to reading should be a substitution, not a reformat.
6. **`gettingStartedText` and `introductionsText` are wizard content.** The sheet shows `description` and `effectText` because they are the hunter's live rules; it shows neither of those, which are authoring guidance and currently displayed nowhere.
7. **`HunterFormComponent` loses its post-creation consumer.** If the wizard is built standalone, the 778-line form and its 477-line template have no remaining caller. Retire or absorb deliberately rather than leaving it as a second, divergent authoring surface.

---

## 13. Summary of new vs. reused

**Reused verbatim:** the identity line + playbook/success badges (`hunter-detail.html:9-16`); `mystery-detail`'s card, uppercase section heading and prose treatments; `monster-detail`'s explicit-span column grid, bordered list-row, and weapon-tag chip; the global `action-btn` family with the `trash` and `pencil` icons (the edit-plus-delete pair as `mysteries-list.html:29-34` renders it, used beside the name and on journal rows); `ConfirmDeleteModalComponent` (for hunter delete and, with `verb="Remove"`, improvement and journal-entry removal); the form's journal input classes (`hunter-form.html:315-317`); `NotificationService` error toasts; the form's single section template, mirrored as one renderer for region B and move-internal sections; `formatStat()`; the form's outline `+ Add entry` button treatment; the form's predicate set for bespoke section kinds; `Outstanding`'s existing neutral styling.

**New, and deliberately so:** interactive box tracks for Luck / Harm / Experience / extra tracks, with the `harmUnstableThreshold` marker (Section 4, and the only live values on the page), saved optimistically through Skyler's `PATCH` with a coalescing debounce, flush rules, and revert-plus-toast on failure, and one write queue per hunter shared by every sheet save (2.3); the in-place Name/Pronouns edit behind a pencil beside the name (Section 4); the region re-span when a playbook has no bespoke content (5.2); two `[@media(min-width:1900px)]` arbitrary variants; the grouped-chip-row presentation of a bespoke tree (8.1); `withAnswer()` to fill `{{blank}}` instead of stripping it (8.2); the journal table with inline add, edit and remove, one entry in edit mode at a time (8.3); the Advancement log; the `name — detail` list for option-less repeatable sections (7.1); the per-effect-kind remove-improvement confirm copy (10.2), including naming the granted move in the modal's existing `items` list, and loss-first copy for improvements that changed a creation pick; the HA-2 creation-pick step on `/advancement`, limited to the one section and count the improvement names (10.4).

**Dropped since the first pass:** the `mx-auto max-w-[84rem]` page container (reversed by Q3); the `/hunters/:id/edit` route (Q5b); the labelled `Delete hunter` button, demoted to an icon; the `Level n` chip on `hunters-list` rows (Skyler answered OQ-5 himself, 2026-09-10); the whole-hunter `PUT` per counter click (replaced by `PATCH /hunters/{id}/state`, Question 3); the add-only journal (Question 4); the `Level up` button label, now `Advance` (Question 5).

**Reinstated 2026-09-11:** the per-improvement remove control and its confirm-dialog copy. Dropped on 2026-09-03 under Q5b, and brought back when Skyler chose OQ-1's "improvements are removable".

**New tokens required: none.**

---

## Open questions

**Q1 — RESOLVED 2026-09-11: no edit route.**
*As originally asked (blocking): does `/hunters/:id/edit` exist at all?*
You approved the read-only/edit split (Q1) and then said the ability to edit a hunter is a mistake (Q5b). I've assumed the strong reading: **there is no edit route**, `HunterFormComponent` becomes wizard-only, and the only values the sheet lets you touch are Luck, Harm, Experience and extra-track values (plus, since your 2026-09-11 answer, removing a recorded improvement, which I've read as not bringing an edit route back) — because those aren't edits to the character, they're the marks you make on paper during a session, and `HunterEntities.cs` already calls them *"mutable play state, not template data."* If you meant something narrower — say, an edit form that exists but is locked down to a few fields — the sheet's header and interaction model change and I should redo Section 2.

**Resolution.** Asked together with Q2, Skyler chose the option labelled *"No edit route; Name/Pronouns editable (Rosalina)"*. As that option was described to him (the description, not his words): no edit form; Name and Pronouns can be changed on the sheet because they're labels with no rules attached; the creation wizard ends with a full review screen before saving. **The strong reading is confirmed**, with one addition to what the sheet lets you change: Name and Pronouns (Section 4). Section 2 stands.

**Q2 — RESOLVED 2026-09-11: both (a) and (b).**
*As originally asked: one-way creation means a typo in a hunter's name has no fix path.*
Neither does a wrong pronoun, nor a Look line answered with the wrong word. The only remedy under the rule is deleting the hunter and rebuilding — which for a leveled hunter also destroys its advancement history. Two ways to soften it without reopening general editing: (a) exempt the two pure-label fields, Name and Pronouns, which have no mechanical consequence and can't invalidate a pick; or (b) accept it, and make the wizard's final step a full review screen (I'd recommend that regardless — see 12.3). I'd do both. Which do you want?

**Resolution.** Same answer as Q1: Name and Pronouns editable on the sheet (a), and a full review screen at the end of the wizard (b), matching "I'd do both". The Look line mentioned above wasn't in the question, so Look answers stay locked; 2.2 explains why that's a small gap. The in-place edit is specified in Section 4 and the review step in 12.3.

**Q3 — RESOLVED 2026-09-11: `PATCH /hunters/{id}/state`.**
*As originally asked: one Luck click is a whole-hunter `PUT`.*
`UpsertHunterRequest` carries the entire graph and there are deliberately no sub-resource endpoints. Marking a box therefore re-submits every move, gear pick, look answer and bespoke selection. It works — the sheet already holds all of it — and I've specced a ~500ms debounce so dragging across a track is one request. Flagging it because this is the first place the no-sub-resource-endpoints decision actually costs something, and if you'd rather have a small `PATCH /hunters/{id}/state` for the four counters, now is when to say so.

**Resolution.** Skyler chose the option labelled *"Add PATCH /hunters/{id}/state"*. As that option was described to him (the description, not his words): a small endpoint for Luck, Harm, Experience and extra tracks only, so marking a box never runs the pick rules; the first exception to "no sub-resource endpoints"; Bowser's work. 2.3 is rewritten to match: optimistic marks, the ~500ms debounce kept to coalesce bursts and keep writes in order, a flush before navigating or sending any whole-hunter `PUT`, and revert-plus-toast on failure. The endpoint contract isn't specified here. Which endpoint saves Name and Pronouns wasn't part of the option: Question 7.

**Q4 — RESOLVED 2026-09-11, against my recommendation: add, edit and remove from the sheet.**
*As originally asked: should the Curse-Eater's journal be add-able from the sheet?*
`HunterJournalEntry`'s own comment says its content is *"invented during play"*, which argues it belongs with the live things rather than with creation. I've put **adding** an entry on the sheet and left editing/removing off. Your 2026-09-11 answer made improvements removable but didn't mention journal entries, so I haven't extended it to them. It affects exactly one playbook. Is that the line you want, or should journal entries only be added through the advancement flow?

**Resolution.** Skyler chose the option labelled *"Add, edit and remove from the sheet"*, not the add-only line I'd drawn. As that option was described to him (the description, not his words): treat journal entries like play-state marks; it changes the sheet's rule that things are only added, never changed, for this one playbook. 8.3 now specifies inline add, edit and remove, with `ConfirmDeleteModalComponent` for removal. It's scoped to journal entries and gives nothing else on the sheet edit or remove.

**Q5 — RESOLVED 2026-09-11: the button reads "Advance".**
*As originally asked: the button says "Level up"; the route is `/advancement`.*
The rulebook's verb — and the thing a player actually says — is "level up", and a noun route with a verb button is normal. But you named the route deliberately, so if you'd rather the button read **"Advance"** for consistency with the URL and with whatever the form calls itself, say so and I'll change it.

**Resolution.** Skyler chose the option labelled *"Change to "Advance""*. As that option was described to him (the description, not his words): consistent with the `/advancement` route and whatever the screen calls itself. The header button, both header mockups and every spec reference now read `Advance` (Section 4, 2.3, 8.3, 10.2). The XP track's notice now reads "Ready to advance", so it names the button it points at. Skyler confirmed that change separately on 2026-09-11 (option *"Keep "Ready to advance""*, described as "Consistent with the button it points at."). The rulebook's "level up" stays only in explanatory text about the rules.

**Q6 — RESOLVED 2026-09-11, against my recommendation: removing the improvement removes the move it granted.**
*As originally asked: decide before the Advancement block's remove control ships. Removing a "take another move" improvement can leave a hunter that won't save.* Kept below as the record.
Improvements can now be removed, and there's still no edit route. For rating boosts and record-only lines that's clean, because everything recomputes. The exception is *Take another {playbook} move* (`PlaybookMovePick`). If the hunter has already picked the extra move, removing the improvement leaves them holding more moves than they're allowed, and `HunterService.Validate` refuses any save over the move allowance (`HunterService.cs:187-193`). Every save sends the whole hunter (2.3), so **every later Luck, Harm or Experience click on that hunter would fail too**, and with no `/edit` route there is nowhere to unpick the move. Yoshi's §6 expected this to be *"fixable by unpicking a move"*, which assumed the edit form still existed; his 13.5 raises the same gap. There are three ways out, and none of them brings back a general edit route:
- **(a) Removal asks which move goes.** When removing the improvement would put the hunter over its allowance, the confirm step lists the moves they picked and they choose one to drop. Both come out in the same save. The fix is limited to the damage the removal itself causes. It needs a small new dialog, because `ConfirmDeleteModalComponent` can list items but can't pick one.
- **(b) Block it.** The row's remove control is disabled while the extra move is held. Since nothing else can unpick a move, in practice this kind of improvement becomes permanent once its move is chosen.
- **(c) Cascade automatically.** The app drops a move itself. Not recommended: it would have to guess which one, and a wrong guess destroys a choice the player made.

I recommend **(a)**. It's the only option that keeps "improvements are removable" true for every improvement without reopening editing. Which do you want? The same question comes back in HA-2 for `BespokeSelect` / `BespokeInstance` (removal lowers a maximum below picks already made), and (a)'s shape would extend to those.

**Resolution (2026-09-11).** Skyler chose the option labelled *"Remove the granted move automatically (Yoshi)"*. That is Yoshi's OQ-8 (a), which he raised in parallel and which I hadn't seen when I wrote the options above. As that option was described to Skyler (the description, not his words): the app records which move each improvement granted, in one nullable column (`HunterMove.GrantedByPlaybookImprovementId`), and removing the improvement removes exactly that move, never one picked at creation.

**That answers my objection to (c).** I rejected automatic dropping because the app would have to guess which move. With the grant recorded, it doesn't guess. It also beats my (a) on my own terms: (a) would have listed moves chosen at creation as candidates, which bends Q5b's locked creation picks. The reasoning above stays as the record. It was sound without a grant column, and it's the wrong call with one. Consequences for this doc: 10.2's confirm names the granted move instead of offering a choice, and no new dialog is needed.

The same round also decided a related question from Yoshi (his OQ-9), which I hadn't raised here. About 12 improvements that tell you to delete or change a creation pick may do that on `/advancement`, as that improvement's own secondary pick. See 10.4, and 10.2 for the removal copy.

**Q7 — RESOLVED 2026-09-11: a save that skips the pick rules, for Name/Pronouns and journal entries.**
*As originally asked: which endpoint saves Name and Pronouns?*
The `PATCH /hunters/{id}/state` option you chose described only Luck, Harm, Experience and extra tracks, and the Name/Pronouns option didn't say how they save, so I haven't decided it. The sheet's design (Section 4) works either way, but the two answers behave differently for the player:
- **Through the whole-hunter `PUT`** (no new API). A rename re-runs every pick rule. A hunter with a rule failure somewhere else (the case Q3 was about) **couldn't be renamed** until that failure was cleared, which may not be possible from the sheet. The failure toast would need to show the server's reason, and the sheet would flush pending counter writes before sending (2.3).
- **Through a small endpoint that runs no pick rules** (the new `PATCH` widened, or a sibling). A rename could only fail for reasons about the name itself, such as leaving it empty. That's the same property you chose for the counters in Q3.

My lean is the second, for the same reason you gave the counters their own endpoint: a label shouldn't be blocked by a rule it has nothing to do with. But it's an API shape, so it's for you and Bowser to call. Which do you want?

**Resolution.** Asked together with Q4, because journal saves raised the same question, Skyler chose the option labelled *"A save that skips pick rules (Rosalina)"*. As that option was described to him (the description, not his words): Name/Pronouns and journal entries save without running the pick rules, through a widened `PATCH` or a sibling endpoint (Bowser's call); a rename can only fail because of the name itself; journal saves still check their own fields. **Which of those two shapes isn't chosen here.**
- Section 4's failure copy and 8.3's journal saves are written against this save.
- 2.3's flush rule was re-checked: the only whole-hunter `PUT` left on the sheet is removing an improvement, and every sheet write for one hunter goes through one queue, which holds for either shape.

**No open questions remain in this doc.**
