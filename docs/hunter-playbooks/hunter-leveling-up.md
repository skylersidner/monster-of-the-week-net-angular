# Hunter Leveling Up: Marking Improvements

**Status: proposal for review, 2026-09-17. Nothing here is decided.** Written by Yoshi (Architect) at Skyler's request. Rosalina (UX), Luigi (frontend) and Bowser (backend) review it next. Skyler answers the questions in Section 13. Until then, every "recommend" in this doc is only a recommendation.

Skyler's request, verbatim:

> I completed the work for the Hunter creation wizard. Can you have an Yoshi evaluate the code as it stands with the wizard and figure out a solution for hunter advancement (or as the playbooks refer to it, "Leveling up"). I'm looking for a workflow that will allow me to mark an improvement (or advanced improvement) which will correlate with making updates to the hunter's data to match the improvement selected. Put these findings in a markdown document in /docs/hunter-playbooks and ask me any questions you come across. I'll be having Rosalina, Luigi, and Bowser evalutate the outcome and lend their own strengths to it before beginning the work.

Everything outside that quote is mine.

**About the earlier design.** Skyler withdrew a hunter advancement design on 2026-09-12. None of its decisions stand, and none are used here as precedent. This doc was worked out from the code on `main` (0988cad) and the two source PDFs. Where I reached a conclusion that looks like part of the withdrawn design, Appendix B says so and gives this doc's own reasons.

**Conventions.**
- **Fact** means I checked it in the code, the seed or a PDF, and I give the source.
- **Recommendation** or **inference** means it's my judgement.
- "Sheet p.N" is a page of `Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf`, as `pdftotext -f N -l N` numbers it.
- "Rulebook PDF p.N (printed p.M)" is `Monster of the Week Revised Corrected.pdf`. The PDF page is two more than the printed page number in the chapter this doc uses.

---

## 0. The recommendation in one screen

1. **A taken improvement is a record on the hunter.** It's a new `HunterImprovement` row that points at the playbook's own `PlaybookImprovement` row, like every other hunter pick. Its key is (hunter, improvement), so the database itself enforces the rulebook's "each can only be selected once".
2. **Improvement rows get structured effects.** A new `PlaybookImprovementEffect` child table says what an improvement does, for example "+1 Charm, max +3" or "one more pick in Symbiosis › Benefits". An improvement with no effects is a note, like "Gain an ally". This reverses `architecture.md` §2's "flat and untyped" call (Section 4.1 explains why).
3. **Most effects are worked out on read, not written into the hunter.** Ratings become the chosen rating line plus the improvements. Move budgets, pick ceilings and minimums, harm boxes, the advanced unlock and "retired" all come from the set of taken improvements. This follows the precedent the app already set three times: the live link to the playbook (§3), completeness (§9) and pick rules (§6.10). Only changes to play-state counters are written once, when the improvement is marked: clearing experience, erasing a Luck mark, clearing a track.
4. **The picks an improvement grants are made where picks already live.** "Take another Chosen move" raises the move budget by one. The existing completeness check then reports "Moves: 3 of 4 picked.", and the existing Moves section lets you tick the fourth. None of the pick tables change.
5. **Two new endpoints**, `POST` and `DELETE /api/hunters/{id}/improvements`. The whole-hunter `PUT` never carries improvements, because marking one is a command: it has preconditions over the stored hunter and side effects on other fields. `GET` gains an `advancement` block, worked out on read, that says which improvements are taken, available or unavailable, and why.
6. **The UI is a "Leveling up" card on the hunter page** (`/hunters/:hunterId`), laid out like the sheet's two checkbox lists. Picking an improvement opens a short confirm dialog that shows what will change. After confirming, the page reloads and takes you to the section where the new pick is made. No new route.
7. **Seven releases.** Recording and unlocking come first, and every improvement is usable as a note from that release. Then ratings, moves and Luck. Then bespoke and gear limits. Then moves from other playbooks, then havens borrowed from the Expert, then advanced basic moves, then retiring and changing playbook.

**The trade-off this accepts:** nothing records which pick an improvement paid for. Undoing an improvement can therefore be refused until you untick a pick yourself, and one-time counter changes aren't reversed. In exchange, the pick tables, the edit page's save and the wizard stay as they are, and every rule is computed in one place on the server.

---

## 1. What the rules say (facts)

### 1.1 Experience and level-ups

- **Marking experience.** "You get an experience point whenever your roll totals six or less, or when a move tells you to", plus end-of-session questions (rulebook PDF p.120, printed p.118). An optional first-edition variant marks it for highlighted ratings instead (PDF p.303, printed p.301). Either way, experience is marked in play; the app only needs the box count.
- **Leveling up.** "Whenever you mark the fifth experience box on your playbook, you level up. Erase all five marks and choose an improvement from the list in your playbook. **Mark the improvements off as you take them: each can only be selected once.**" (PDF p.120, printed p.118). Every sheet prints the same trigger: "When you have filled all five experience boxes, you level up. Erase the marks and pick an improvement…" (for example, sheet p.12, The Crooked).
- **Advanced improvements.** "When you have leveled up five times, you can start choosing from the advanced improvements list as well" (PDF p.120). "From now on, when you level up choose from either the basic or advanced improvement lists", and playbook-specific advanced improvements "are unlocked at the same time (after five level-ups)" (PDF p.122, printed p.120; PDF p.125, printed p.123). All 28 sheets print "After you have leveled up five times, you qualify for advanced improvements in addition to these" (checked on every Leveling Up page: sheet pp.2–26 even, 28, 32–58 even).
- **Duplicated lines are separate boxes.** A sheet that prints "Take another Crooked move" twice has two checkboxes (sheet p.12), so that improvement can be taken twice. Combined with "each can only be selected once", **the printed list is the whole repeat limit.** No separate "repeatable" flag is needed.

### 1.2 The improvement types the rulebook explains

Rulebook PDF pp.120–125 (printed pp.118–123) define these types. Where a detail affects the data, it's quoted.

| Type | What the rulebook says (abridged) |
|---|---|
| +1 to a rating (max +X) | "The maximum is a limit… If your rating is already at (or above) the listed maximum, then don't select this improvement." |
| Another move from your playbook | "Select another one of the moves from your playbook." |
| A move from another playbook | "Select a move from any other playbook that's available in your game (whether it's currently in use or not)." |
| Gain an ally or a team | One of six ally types, each with a motivation: subordinate, lieutenant, friend, bodyguard, confidante, backup. Name them, and decide their background and skills. |
| Gain a haven like the Expert has | "It will tell you how many options you can pick from the list in the Expert playbook." |
| Add an option to your haven | "Select a new haven option from the list in the Expert playbook… Don't bother taking this improvement if you don't have a haven!" |
| Spell-Slinger: another combat magic pick | "Pick a new combat magic option, either a new base or a new extra." |
| Spooky: change dark side tags | "You don't get to have any fewer, just change them around." |
| Advanced: +1 to any rating (max +3) | "+3 is the maximum for any rating." |
| Advanced: change to a new type | "Your ratings and history stay the same. You may change your name or look… For your old moves, check each one and decide (with the Keeper) if it is intrinsic… Then add new moves from your new playbook, as if you were creating a new hunter. Finally, you may or may not get the new gear, or keep your old gear." |
| Advanced: make a second hunter | "Make up the new hunter as normal, except for history." |
| Advanced: retire to safety | "Give your hunter to the Keeper to look after from now on… [they] might… count as an ally." |
| Advanced: erase one used Luck mark | "Erase a used Luck mark from your sheet." |
| Advanced: mark two basic moves as advanced | Each advanced basic move gains a 12+ result (listed on PDF p.124, printed p.122). |

The Luck track counts marks used, from "Okay" to "Doomed" (PDF p.115, printed p.113). So "erase a used Luck mark" means Luck goes down by 1.

### 1.3 What's printed across the 28 playbooks (facts, from the seed)

The seed at `src/api/MonsterOfTheWeek.Api/Data/Seed/hunter-playbooks.json` matches the sheets for every list I spot-checked against the PDF: The Crooked (p.12), The Forged (p.24), The Gumshoe (p.26), The Hex (p.28) and The Visitor (p.56).

- **525 improvement rows:** 284 basic and 241 advanced.
- **418 rows (80%) use one of nine wordings shared across playbooks:**

  | Wording | Rows |
  |---|---|
  | Get +1 {rating}, max +N | 118 |
  | Get +1 to any rating, max +3 | 28 |
  | Take another {playbook} move | 54 |
  | Take a move from another playbook | 53 |
  | Mark (another) two of the basic moves as advanced | 55 |
  | Change this hunter to a new type/playbook | 28 |
  | Create/Make up a second hunter | 28 |
  | Retire this hunter to safety | 27 |
  | Erase a used Luck mark / Get back one used Luck point | 27 |

- **107 rows are specific to their playbook.** Appendix A lists them all with a proposed effect.
- **Deviations worth knowing:**
  - The Gumshoe has no "Take a move from another playbook" (sheet p.26).
  - The Hex has only one, plus three "Take another Rote", two "Take another Hex move, or an additional Rote", and "Choose one advanced Hex move" (sheet p.28).
  - The Forged has only one "Mark two of the basic moves as advanced" (sheet p.24).
  - The Mundane has "Get back one used Luck point" twice as a basic improvement and twice more as an advanced one.
  - The Visitor's change-playbook and retire lines carry narrative prefixes (sheet p.56).
- **Source inconsistency.** The Chosen's sheet says "Delete one of your Doom tags, and (optionally) one of your Heroic tags" (sheet p.8). The rulebook says "(optionally) **change** one heroic tag" (PDF p.125, printed p.123). See LU12.
- **Hex rotes.** "You start out knowing up to one rote… You can learn more by taking improvements" (sheet p.29). The seed stores the Rotes section's `MaxInstances` as null, which means unlimited. See LU9.

---

## 2. What the app has today (facts)

**Playbook side**
- `PlaybookImprovement` is `(Id, PlaybookId, Text, IsAdvanced, SortOrder)`. Its doc comment says it's "Flat and untyped on purpose… semantic sub-typing… would over-fit the sample" (`Data/Entities/PlaybookEntities.cs`; `architecture.md` §2 "Improvements / Advanced Improvements", written from 3 pilot playbooks).
- `PlaybookMove.IsAdvanced` exists only for The Hex's two advanced moves, which are "reachable only through an advanced improvement" (`PlaybookEntities.cs`).
- `Playbook.LevelingUpText` stops before the "leveled up five times" sentence on all 28 playbooks (`hunter-creation-wizard.md` §8 Gap 4, still open under B10).
- `BasicMove` exists as an entity and table but has **no rows, no endpoint and no seed** (`PlaybookEntities.cs`, `MotwDbContext.cs`; Yoshi history 2026-09-12).

**Hunter side**
- **Ratings are a live FK to a rating line**, `Hunter.PlaybookStatArrayOptionId`, and there are no per-hunter rating columns (`Data/Entities/HunterEntities.cs`). `architecture.md` §3 names "+1 to a stat" as "a future concern this pass's schema doesn't address".
- Luck, Harm and Experience are plain ints, capped by the playbook's box counts in `HunterService.Validate` (`Services/HunterService.cs:339-341`).
- There is **no record of improvements at all.** `HunterRepository.GetPlaybookForValidationAsync` deliberately leaves `Improvements` out, because "there is still no hunter-side improvement table" (`Repositories/HunterRepository.cs:45-50`). `PlaybookService` keeps improvements "freely removable" for the same reason (`Services/PlaybookService.cs:151`).
- **Level-up picks are refused today, on purpose.** The whole-hunter save refuses:
  - moves from another playbook (`HunterService.cs:210-213`);
  - advanced moves (`:218-221`);
  - moves over `MoveGrantCount − Required` (`:237-250`);
  - bespoke and gear picks over their stored ceilings, and pick-rule violations (`:280-327`).

  Wizard Q10 ("Refuse, as designed", 2026-09-13) states the boundary: correctness is "judged against the limits a new hunter starts with… until hunters record improvements" (`HunterService.cs:302-309`; `architecture.md` §9 "Deliberate boundaries"). **This design is the "until".**
- The validation graph is **one playbook**. Nothing in `Validate`, `HunterCompleteness` or the repository can see another playbook's moves or sections.

**API**
- Hunters have no sub-resource endpoints by design: "one request carries the whole hunter" (`Controllers/HuntersController.cs` header).
- `POST /api/hunters/evaluate` checks an *unsaved* create request. It has no hunter id, and the edit page doesn't call it (Y14).

**Frontend**
- `/hunters/:hunterId` is the edit page. `HunterDetailComponent` hosts `HunterFormComponent`, which provides its own `HunterDraft` (`features/hunters/pages/hunter-detail/`, `shared/hunter-form/hunter-form.ts`).
- The wizard's step 7 shows `LevelingUpText` and both lists read-only (`pages/hunter-create/steps/hunter-improvements-step.*`).
- `HunterDraft` works out every limit from the playbook alone: `moveBudget`, `isGearLimitReached`, `lockedScopes`, `sectionProgress`, and the pick-rule `hasRoomFor` (`shared/hunter-draft.ts:116-284`, `shared/hunter-pick-rules.ts`).
- `HunterDraft.isDirty` only covers playbook, name and pronouns, which suits the wizard's leave guard but not an edit page (`hunter-draft.ts:165-168`).
- Anchors exist for gear categories, bespoke sections and Look, but not for Moves (`shared/sections/section-anchors.ts`).

---

## 3. Taxonomy: what an improvement does to a hunter

Ten effect kinds cover every one of the 525 rows. Kinds with no hunter data behind them are recorded with an optional note. The "How" column says whether the change is **derived** (computed on every read from the taken improvements) or **applied once** (written into a counter when the improvement is marked).

| Kind | Examples | Rows (approx.) | Change to hunter data | How |
|---|---|---|---|---|
| `rating` | "Get +1 Sharp, max +3"; "+1 to any rating, max +3" (rating chosen when marked); Monstrous "…you lose 1 Weird" (−1) | 147 | Effective rating = rating line + deltas | Derived |
| `moves` | "Take another Chosen move" (pool `playbook`); "Take a move from another playbook" (`otherPlaybook`); Hex "Choose one advanced Hex move" (`advanced`) | ~110 | Budget +1 in that pool; the pick is an ordinary `HunterMove` | Derived budget |
| `pickLimit` | Host "Take another benefit from Symbiosis" (divider +1); Envoy "Pick a second resource item" (gear category +1); Gumshoe "Add four… contacts for your Naked City move" (move section +4); Spell-Slinger "Take another Combat Magic pick" (pick rule +1); Chosen "Delete one of your Doom tags" (divider −1) | ~26 | Ceiling and minimum of the target move by Delta; picks stay in `HunterBespokeSelection` / `HunterGearSelection` | Derived; a negative delta also removes the chosen pick once |
| `entries` | Hex "Take another Rote", "Gain another two Rotes" | 4 (+2 as a choice) | A repeatable section's `MaxInstances` + Delta | Derived |
| `borrowSection` | "Get a haven, like the Expert has, with two options" (8 playbooks); Spooky "mystical library"; Changeling "find a home" (Agency, Sect or haven); Covenant "one type of contact as if from… naked city" | 11 | The hunter may answer another playbook's section, up to Delta picks, optionally with a fixed granted option | Derived |
| `track` | "Erase one used Luck mark" (luck −1); Curse-Eater "Clear all corruption" (reset); Pararomantic "Erase all the marks from the Relationship Status track" (reset); Gumshoe "Add another harm box" (harm boxes +1) | 31 | Luck or an extra track value lowered or reset; harm box count raised | Luck/reset **applied once**; harm boxes derived |
| `basicMoves` | "Mark two of the basic moves as advanced"; Changeling "Mark use magic… as advanced" (fixed move) | 56 | Advanced basic moves (new bridge), budget +Delta | Derived budget |
| `retire` | "Retire this hunter to safety" and 6 variants | 33 | Hunter counts as retired | Derived |
| `secondHunter` | "Create a second hunter…"; Host "symbiotic fission"; Covenant ally-hunter | 30 | None (note, plus a shortcut to the wizard) | — |
| `changePlaybook` | "Change this hunter to a new type" | 28 (+1 as a choice) | Playbook changes, with carry-over rules | Deferred (LU5) |
| *(no effect: note)* | "Gain an ally"; Crooked "Recover a stash of money"; "Change your Task to another option" | ~48 | None; optional free-text detail | — |

Two cross-cutting shapes:
- **Alternatives.** Six rows are "X or Y": The Hex ×2, the Changeling's home, the Pararomantic's gift, the Professional's resource, and the Interface's upgrade. The Forged's "either retire to safety or change playbooks" is a seventh. The player chooses when marking, and only the chosen alternative's effects apply.
- **Composites.** One row can carry several effects, for example the Monstrous's "Free yourself from the curse" (rating −1 Weird, plus a note) or the Interface's haven (borrow 2 options, grant Workshop, plus a note about the supercomputer).

---

## 4. Data model

### 4.1 Playbook side: `PlaybookImprovementEffect` (recommended)

Zero or more rows per `PlaybookImprovement`:

| Column | Type | Meaning |
|---|---|---|
| `Id` | Guid | |
| `ImprovementId` | Guid FK, Cascade | Owning improvement |
| `Kind` | string, check constraint | One of the ten kinds in Section 3 |
| `Choice` | int? | Null means the effect always applies; 0..n makes it one alternative |
| `ChoiceLabel` | string? | Plain text naming the alternative in the dialog ("Another Hex move", "Another Rote"). Printed where the sheet prints one; otherwise synthesised and flagged, as "One of Us" was |
| `Stat` | string? | `charm`, `cool`, `sharp`, `tough` or `weird`. Null on a `rating` effect means the player chooses |
| `Delta` | int? | +1, −1, +2, +4… (rating change, budget change, pick count, instance count, Luck change) |
| `Max` | int? | Rating cap (`rating` only) |
| `MovePool` | string? | `playbook`, `otherPlaybook` or `advanced` (`moves` only) |
| `BespokeSectionId` | Guid? | Target section (`pickLimit`, `entries`), or the borrowed section (`borrowSection`), which may belong to another playbook |
| `BespokeOptionId` | Guid? | Target category divider (`pickLimit`), or a fixed granted option (`borrowSection`, for the Spooky's Mystical Library) |
| `GearCategoryId` | Guid? | Target gear category (`pickLimit`) |
| `PickRuleId` | Guid? | Target pick rule (`pickLimit` extra pick) |
| `Track` | string? | `luck`, `harmBoxes` or `extra` (`track`) |
| `ExtraTrackId` | Guid? | When `Track = extra` |
| `Reset` | bool | `track`: set to 0 instead of applying Delta |
| `BasicMoveId` | Guid? | A fixed basic move (`basicMoves`) |
| `SortOrder` | int | |

A per-kind column table and its check constraints belong to Bowser's review (Section 9). The pick-rule tables already set the pattern: an exactly-one-target check, and service-level graph checks (`PickRuleEntities.cs`; `architecture.md` §6.10).

**Why this reverses `architecture.md` §2.** That call ("flat and untyped… would over-fit the sample") rested on two premises: the lists only needed to be *displayed*, and the variation lay "entirely in which text appears". The first premise no longer holds: the app now has to *apply* improvements. The second was measured on 3 playbooks. Across 28, 80% of rows use nine shared wordings with real mechanical meaning, which is the opposite of over-fitting. The flat table stays as it is; effects are an addition.

**Why an explicit `Kind`, when §6 bans discriminators on bespoke sections.** §6 derives a section's shape from which fields are filled because those shapes only change rendering, and the fields *are* the data. Here, the server runs different code per kind, and different kinds fill the same columns. A `track` −1 on Luck and a `rating` −1 on Weird both come down to "a target plus a delta". Reading the operation from which fields are null would be guesswork. Kinds go over the wire as strings, the way `HunterOutstandingArea` does, because `Program.cs` has no string-enum converter.

**Alternatives considered:**
- **A code-level catalogue** keyed by improvement id, with no schema. It needs no migration, but admin-created (Path B) playbooks would get no effects, effect definitions would sit in C# away from the data they describe, and the pick-rule precedent put rules in tables. Rejected.
- **Text only**, where improvements are just checkboxes and you edit everything by hand. That's cheap, but it doesn't "correlate with making updates to the hunter's data". It's also exactly what Phase 1 alone delivers, so it stays available as a stopping point (LU3).

### 4.2 Hunter side

**`HunterImprovement`** (new):

| Column | Notes |
|---|---|
| `HunterId`, `PlaybookImprovementId` | Composite PK. Makes "each can only be selected once" (rulebook p.118) impossible to break, the same way `HunterMove`'s key does for moves. FK to `PlaybookImprovement` is `Restrict`, like every hunter bridge |
| `Choice` | int? — which alternative, when the improvement has them |
| `Stat` | string? — the rating chosen for "+1 to any rating" |
| `Detail` | string?, `[MaxLength]` for Bowser to set — optional note: the ally's name and type, what the stash is, which contact became an ally |
| `SortOrder` | int — the order level-ups were taken, for display ("Level 3"). No rule depends on it (5.1) |
| `CreatedAt` | |

**`HunterAdvancedBasicMove(HunterId, BasicMoveId)`**, new, composite key. Needs the `BasicMove` table filled (LU8).

**Nothing else is new on the hunter:**
- **No rating columns.** Effective rating = rating line + Σ `rating` deltas of taken improvements. This keeps the live link intact (§3) and makes undo a row delete.
- **Moves from another playbook are ordinary `HunterMove` rows** pointing at another playbook's `PlaybookMove`. The FK is already `Restrict`, and `PlaybookService.CheckRemovedChildrenAreUnusedAsync` already counts hunter references by move id, whatever the playbook.
- **Borrowed-section answers are ordinary `HunterBespokeSelection` rows** whose `SectionId` belongs to another playbook.

### 4.3 One helper decides the adjustments

A new static `HunterAdvancement` class, in the style of `HunterCompleteness`, `PickRules` and `MovePicks`, turns (hunter, playbook, taken improvements with their effects) into a `HunterAdjustments` value:
- effective ratings;
- move budget deltas per pool;
- pick-limit deltas per target (section, divider, gear category, pick rule);
- `MaxInstances` deltas;
- borrowed sections, each with its pick count and any granted option;
- harm box delta;
- basic-move budget;
- level-up counts, the advanced unlock and `IsRetired`.

`Validate`, `HunterCompleteness`, the detail response and the mark/undo endpoints all read the same value. `MovePicks` and `BespokeEngagement` exist so that two tiers can't count differently; this helper exists for the same reason. The create path passes `HunterAdjustments.None`, so creation and `evaluate` behave exactly as today.

---

## 5. Rules enforcement

Section 9's line still holds. **Refuse** what would make stored data false, where every refusal can be fixed by removing something. **Report** what's merely unfinished.

### 5.1 Marking an improvement: refused when…

1. **The hunter already has it.** The composite key backs this up.
2. **It isn't on this hunter's playbook.** (Once LU5 is designed, improvements taken under a former playbook stay recorded; that's for Phase 7.)
3. **Experience isn't full**, meaning `Experience < ExperienceBoxCount` (LU1). Marking sets `Experience = 0` in the same save.
4. **It's advanced and the hunter has fewer than five basic improvements.** This is order-free: for any set of taken improvements, "advanced ones exist ⇒ at least five basic ones". Level-up *k* can only be advanced when *k* ≥ 6, and the first five must all be basic because nothing else is unlocked yet, so the two rules are equivalent. No stored order is needed.
5. **A `rating` effect can't apply.**
   - No rating line has been chosen yet: the cap can't be checked.
   - The effective rating is already at or above `Max`. The rulebook says "don't select this improvement" (p.118).
   - A needed `Stat` is missing.
6. **The chosen alternative is missing or invalid.**
7. **Luck erase with no Luck marked** (LU14).
8. **A pick-limit or entries effect targets something the hunter doesn't have.** Examples: "Add an option to your haven" with no haven, which the rulebook calls pointless (p.119); "Gain another option from defensive adaptation" without that move. A target counts as held when it's the hunter's own playbook section, the section of a move the hunter holds, or a borrowed section.
9. **A negative `pickLimit` has no pick named to remove, or the named pick isn't held** (LU11). When one is named, it's deleted in the same save.
10. **The kind isn't supported yet** in the current phase (Section 11). The status reads "unsupported" so the UI can say "Not supported yet".

On success, one `SaveChanges` inserts the `HunterImprovement`, clears experience, and applies the one-time effects: Luck −1, track resets, and removing named picks.

### 5.2 Undoing an improvement: refused when…

1. **Undoing it would leave advanced improvements with fewer than five basic ones.**
2. **The stored hunter wouldn't pass `Validate` under the reduced adjustments.** For example, you've already picked the fourth Chosen move, or the second haven option. This reuses `Validate` itself: map the stored hunter to a request, drop the improvement's adjustments, and run the check. The message is prefixed: *"To undo 'Take another Chosen move', first remove a pick: Playbook "The Chosen" allows 1 move pick besides its 2 granted moves, but 2 were made."*

Undo deletes the row and nothing else. Experience, Luck, reset tracks and removed picks are **not** restored, because play may have changed them since (LU2). The confirmation dialog says so.

### 5.3 Whole-hunter save (`PUT`) and completeness

- `UpdateAsync` loads the hunter's taken improvements and their effects, resolves `HunterAdjustments`, and passes them to `Validate` and `HunterCompleteness`. **The request contract doesn't change.**
- **Ceilings become base + delta:**
  - move budget per pool, including other-playbook and advanced moves;
  - gear `PickCount`;
  - section and divider `MaxSelect`;
  - `MaxInstances`;
  - pick-rule extra picks (5.4);
  - `HarmBoxCount`.

  A move from another playbook passes the "belongs to" check when an `otherPlaybook` budget covers it. The same goes for a borrowed section's answers.
- **Minimums become base + delta too.** That's what turns a newly marked improvement into a to-do: "Moves: 3 of 4 picked.", "Symbiosis — Benefits 2 of 3 picked." Borrowed sections report under area `rules`, with their own `SectionId`.
- **Two new refusals keep derived ratings honest:**
  - Changing `PlaybookStatArrayOptionId` is refused while any `rating` improvement is taken: *"Undo rating improvements before choosing a different rating line."* Without this, switching lines could push a rating past a cap that was checked when the improvement was marked. It's fixable by removal (undo), so §9's property holds.
  - Changing `PlaybookId` is refused while any improvement is taken, until LU5 is designed. Today the API accepts a playbook change even though the form locks it (`HunterContracts.cs`).
- **A playbook edit can still make a derived rating exceed its cap**, for example by raising a rating line. This isn't re-checked on unrelated saves: the same accepted live-link drift as `MoveGrantCount` today (Yoshi history 2026-09-12). Blocking would lock the hunter out.
- `HunterDetailResponse.Outstanding` stays a list of strings (wizard 12.8). `evaluate` stays creation-only.

### 5.4 Pick rules with extra picks (Bowser)

The Monstrous's "Take a natural attacks pick" and the Spell-Slinger's "Take another Combat Magic pick" target the two enumerated-alternative rules (`PlaybookPickRule`, seed). The rulebook: "either a new base or a new extra" (p.120).

**Proposed semantics for *k* extra picks on a rule:**
- **Ceiling.** Picks fit an alternative A when Σ over targets of max(0, picks − A.max) ≤ *k*.
- **Minimum.** Each target reaches A.min, and total picks ≥ Σ A.min + *k*.
- **Stored caps.** Each governed target's stored divider `MaxSelect` (S8) is raised by *k* too. Otherwise the Spell-Slinger's Bases cap of 3 would block a fourth base the rulebook allows.
- **Known approximation.** This lets a Monstrous take 1 Base + 2 Extras, while the sheet's "add an extra to it" arguably attaches each extra to a base. Stated here, not hidden.

The client's `hasRoomFor` in `hunter-pick-rules.ts` needs the same *k*. This settles what wizard Q10's "until hunters record improvements" left open (LU15).

---

## 6. API shape

**`POST /api/hunters/{id}/improvements`**

```
MarkImprovementRequest(
    Guid PlaybookImprovementId,
    int? Choice,
    string? Stat,                       // "charm" | "cool" | "sharp" | "tough" | "weird"
    [MaxLength] string? Detail,
    IReadOnlyList<Guid>? RemoveBespokeOptionIds)   // negative pickLimit only (LU11)
```

Returns `200 HunterDetailResponse`, re-read like `Create`/`Update`. `400 {message}` for any 5.1 refusal, `404` for an unknown hunter.

**`DELETE /api/hunters/{id}/improvements/{playbookImprovementId}`** returns `200 HunterDetailResponse`, `400 {message}` for a 5.2 refusal, or `404`.

**`HunterDetailResponse` gains `Advancement`**, worked out on every read and never stored, like `Outstanding`:

```
HunterAdvancementResponse(
    int LevelUps,                      // taken count
    int BasicTaken,
    bool AdvancedUnlocked,             // BasicTaken >= 5
    bool ReadyToLevelUp,               // Experience == ExperienceBoxCount
    bool IsRetired,
    HunterRatingsModel? Ratings,       // effective; null with no rating line
    IReadOnlyList<HunterImprovementModel> Taken,          // id, Choice, Stat, Detail, SortOrder
    IReadOnlyList<HunterImprovementStatusModel> Options,  // one per PlaybookImprovement:
                                                          //   Status "taken" | "available" | "locked" | "unavailable" | "unsupported", Reason?
    HunterLimitDeltasModel Limits)     // move pools, pick-limit and entries deltas by target,
                                       // borrowed sections, harm-box delta, basic-move budget
```

**The playbook contract gains `effects` on each improvement.** The admin form lists them read-only and leaves them out of saves, and "omitted means unchanged", exactly as `pickRules` did (F8a). `PlaybookService`:
- refuses (409) removing an improvement some hunter has taken;
- runs graph checks so an effect's target belongs where its kind requires. A borrowed section may belong to another playbook; every other target must be the owning playbook's own.

**`GET /api/playbooks/moves`** is new: every non-advanced move of every playbook, with `playbookId`, `playbookName` and the move's own sections. It's the picker for "a move from another playbook", and it gives the edit page the definitions of foreign moves a hunter already holds (Phase 4).

**Why a sub-resource here, when `HuntersController` says there are none.** That rule's stated reason is "nothing here with an independent lifecycle". Marking an improvement has its own lifecycle:
- It has **preconditions over stored state**: experience, the five-level-up unlock, caps against the stored ratings.
- It has **side effects on other fields**: clearing experience, erasing Luck, removing a pick.
- **The whole-hunter PUT replaces sets wholesale.** It can't express "I am spending this level-up", and carrying improvements in it would let any edit add one without spending experience.

Everything else about a hunter still goes through the one `PUT`, including the experience and Luck boxes themselves.

---

## 7. What gets reused, and what changes

| Existing piece | Role in leveling up | Change |
|---|---|---|
| `HunterService.Validate` | Checks the whole-hunter save against effective limits; also checks undo (5.2) | Takes `HunterAdjustments`; move and section lookups widen to held foreign rows |
| `HunterCompleteness.Evaluate` | Turns a marked improvement into "what to fill in next" | Takes `HunterAdjustments`; walks borrowed sections |
| `PickRules` + `PickRuleEvaluation` | Natural Attacks and Combat Magic extra picks | *k* extra picks per rule (5.4) |
| `MovePicks`, `BespokeEngagement` | Unchanged counting | Budget becomes base + pool delta |
| `BuildNewHunterAsync` / `evaluate` | Unchanged; creation has no improvements | Passes `HunterAdjustments.None` |
| Section 9's two-tier split | Mark/undo refusals are tier 1; new owed picks are tier 2 | None |
| `HunterDraft` | Edit page state | New `limits` signal fed from `advancement.limits`, read by `moveBudget`, `isGearLimitReached`, `gearHasRoom`, `lockedScopes`, `sectionProgress` and the pick-rule lookups; `ratings` shown from `advancement.ratings`; edit-page dirty tracking (Section 8). Wizard never sets `limits`, so the characterisation spec must pass unchanged |
| `HunterMovesSection` | New pick lands here | Budget from `limits`; "From other playbooks" group (Phase 4); "Advanced {playbook} moves" group when the advanced pool > 0 (The Hex); a section anchor |
| `HunterBespokeSection`, `BespokeOptionTree` | New picks land here | Ceilings from `limits`; borrowed sections render with a "from The Expert" label |
| `HunterGearSection` | Envoy's second resource | Ceiling from `limits` |
| `HunterRatingsSection` | Shows effective ratings | Line picker unchanged; "+1 from improvements" annotation; line locked while rating improvements exist (5.3) |
| `section-anchors.ts`, `scrollToAnchor` | Post-level-up "go to the new pick" | Add a Moves anchor |
| Wizard step 7 (`HunterImprovementsStep`) | Reference lists | Optional: reuse the new list component in a read-only mode |
| `WizardLayout`/`WizardTracker` | Not used | The flow is one dialog, not a multi-step wizard (8.4) |

---

## 8. UI flow (for Rosalina and Luigi)

### 8.1 Where

The flow lives on the hunter page `/hunters/:hunterId`, in a **"Leveling up" card** placed after the header and "Still to finish", before the form. It sits *outside* the `<form>`, because it saves through its own endpoint and must never submit the form.

### 8.2 The card

- **Summary line:** "Experience 5 of 5 · 3 level-ups · Advanced improvements unlock after 2 more", or "Advanced improvements unlocked", or "Retired".
- **Primary action "Level up":**
  - enabled when `advancement.readyToLevelUp` is true and an available improvement is selected;
  - disabled otherwise, with the reason as text: "Fill all 5 experience boxes first" or "Save or discard your changes first".
- **Two lists, "Improvements" and "Advanced improvements"**, in sheet order, one row per printed box:
  - **Taken:** a checked box, "Level 3", the detail text, the chosen rating or alternative if any, and an "Undo" text button.
  - **Available:** selectable (radio) only when ready to level up; otherwise plain text.
  - **Locked** (advanced before unlock): muted, "Unlocks after 5 level-ups".
  - **Unavailable:** muted, with the server's `reason` ("Charm is already +3", "Needs a haven first", "No Luck marked").
  - **Unsupported:** muted, "Not supported yet".
- **Below `md`:** the lists stack and each row's secondary text wraps under its label.

### 8.3 The level-up dialog

It opens when you press "Level up".

1. **Heading:** the improvement text.
2. **Inputs, only when the effects need them:**
   - Rating radio for "+1 to any rating", each option showing "Charm +1 → +2". Ratings at the cap are disabled with their reason.
   - Alternative radio, labelled by `ChoiceLabel`.
   - "Which one?" picker for a pick to remove (negative `pickLimit`).
   - Optional "Note" text field, labelled "Who are they?" for ally improvements, otherwise "Note".
3. **"What changes"**, a plain list worked out from the playbook's effect definitions. It's display only; the server decides.
   - "Experience 5 → 0"
   - "Charm +2 → +3"
   - "You can pick 1 more Chosen move"
   - "Luck marks 3 → 2"
   - "Symbiosis — Benefits: pick 1 more"
   - "Doom tag *Sacrifice* is removed"
   - "Nothing else on the sheet changes" (for notes)
4. **Confirm / Cancel.** Confirm posts. A refusal shows once, in the dialog. The mark and undo calls set the toast opt-out context token from wizard L9, so `httpErrorInterceptor` doesn't add a second message.

**After success:** close the dialog, show the toast "Leveled up: Take another Chosen move", and repopulate the page from the response. When the effect owes a pick, scroll to its section anchor (moves, bespoke section or gear category); the updated "Still to finish" card names the gap.

**Undo:** a confirm dialog, "Undo *Take another Chosen move*? Experience, Luck and removed picks are not given back." A refusal shows the server message ("first remove a pick: …").

### 8.4 Why a card and dialog rather than a level-up wizard

A level-up is one choice, at most one input, then at most one pick. That pick is best made in the section that already shows it, with the playbook's own text, limits and hints. A separate route would have to host those sections again, around a second `HunterDraft`, for a flow of one to two steps. The trade-off is that the page gets busier; Rosalina may prefer to collapse the lists behind the summary.

### 8.5 Frontend hazards (Luigi)

- **Unsaved edits.** A successful mark or undo repopulates the draft from the response and would discard unsaved form edits. The edit page needs real dirty tracking. One option is comparing `toRequest()` with the request built right after `populate`. "Level up" and "Undo" stay disabled while dirty. `HunterDraft.isDirty` means something else today (the wizard's leave guard), so this needs a new name, not a change to that one.
- **Limits come from two places.** The playbook gives base numbers and `advancement.limits` gives deltas. Every limit read in `HunterDraft` must add the delta: `moveBudget`, `isMoveLimitReached`, `isMovePickShort`, `isGearLimitReached`, `isGearPickShort`, `gearHasRoom`, `lockedScopes`, `sectionProgress`, `canAddInstance`, `hasRoomFor`. Missing one means a disabled checkbox the server would accept, or the reverse. A spec per read site, driven from one fixture, is the cheap guard.
- **Borrowed and foreign definitions** (Phases 4 and 5) aren't in the hunter's `PlaybookDetailResponse`. `allSections()` and `findBespokeOption` in the draft must include them, or `toRequest()` silently drops their answers.

---

## 9. Backend concerns (Bowser)

1. **Schema:**
   - Phase 1 adds `hunter_improvements`.
   - Phase 2 adds `playbook_improvement_effects`: an FK per target, check constraints per `Kind` (exactly the right columns set), and indexes on each target FK.
   - Phase 6 adds `hunter_advanced_basic_moves`.

   All FKs from hunter tables are `Restrict`. Effect-to-target FKs follow the pick-rule choice (Cascade plus service graph checks, `hunter-creation-wizard.md` 14.3.2), or `NoAction` if you'd rather the database guard it. Your call.
2. **Repository loads.**
   - The update, detail and mark paths need the playbook's `Improvements.Effects`, which `GetPlaybookForValidationAsync` excludes today.
   - Phases 4 and 5 need held and borrowed foreign rows. Proposed: a second query for the `PlaybookMove`s and `BespokeSection`s (with options) referenced by the request or the effects but not owned by the playbook. The alternative, loading every playbook, is ~28 graphs per save.
3. **Where validation looks things up.**
   - `ValidateBespoke`'s `sectionsById`/`optionsById`, and `takenMoveIds` for move sections, must include foreign moves' sections and borrowed sections.
   - `ValidateSelectionScope` then works unchanged.
4. **One transaction per mark:** insert the row, clear experience, apply the one-time effects, delete removed picks. Deletions go through the explicit `RemoveRange` path (`IHunterRepository.RemoveMovePicks` explains the fixup trap).
5. **Undo check (5.2).** Map the tracked hunter to an `UpsertHunterRequest` and run `Validate` with reduced adjustments. A small `ToRequest(Hunter)` mapper is new code, and it has to round-trip exactly (instances and journal entries included) or undo refuses things it shouldn't.
6. **Pick rules (5.4).** `PickRules.Evaluate` gains an extra-picks-per-rule input; `GearRefusal`, `BespokeRefusal`, `SectionLines` and the stored-cap raise must all use it. The test tables in wizard 12.9 grow a "+1 extra" column.
7. **Seed and export.** `PlaybookSeed` and `PlaybookSeedExporter` carry `effects`, and the re-export must stay byte-identical (the Phase 6 exit precedent). Effects reach existing databases through a guarded data migration by stable id, as `AddPickRules` did. The seed's `AnyAsync` guard stops a JSON-only change from reaching them.
8. **Contract enums as strings:** `Kind`, `MovePool`, `Track`, `Stat` and `Status`, matching `HunterOutstandingArea`.
9. **Tests:**
   - One seed-driven test per effect kind over every playbook using it, like `HunterMoveBudgetSeedTests`: marking applies, undo restores limits, and over-limit undo is refused.
   - The five-basic unlock at 4, 5 and 6.
   - A rating cap at and above max.
   - Luck at 0.
   - The rating-line lock.
   - Negative-tested one guard at a time, as the completeness work did.

---

## 10. Authoring and migration impact

- **Hunters in the database are test data.** No backfill, audit or migration of hunter rows. A wipe before Phase 1 is optional, and would need Skyler's confirmation as wizard Phase 0 did.
- **418 rows** get effects by rule from their wording (Section 1.3). A one-off classifier script in `tools/`, reviewed like the `tools/pdf-extract/*-review.html` passes, turns wording into effects. It emits the guarded migration's insert list and the updated seed JSON. Targets resolve by id: "Take another Chosen move" becomes pool `playbook`; "+1 Sharp, max +3" becomes `Stat`/`Max`.
- **107 playbook-specific rows** are authored by hand from Appendix A. The review table goes to Skyler for the ones Appendix A marks "check".
- **Seed corrections that ride along** (each needs Skyler's OK):
  - `LevelingUpText` gains the "leveled up five times" sentence on all 28 (Gap 4, sheet pages in 1.1).
  - The Hex's Rotes `MaxInstances` becomes 1 (LU9).
  - `BasicMove` is filled with 8 rows (LU8).
- **Admin form (Path B):** effects are read-only in the playbook form, and admin-created playbooks have none. Their improvements are notes until someone authors effects through the API. That's the same stance pick rules took.
- **Docs that change with the phase that makes them true:**
  - `architecture.md` §2 (the reversal), §3 (hunter tables), §6 (effects schema) and §9 (the Q10 boundary replaced);
  - `phases.md`;
  - `hunter-creation-wizard.md` 12.11 Q10 (a dated note);
  - the authoring skill `.claude/skills/hunter-playbook-authoring/` (author effects for new playbooks);
  - `README.md`, to link this doc.

---

## 11. Phasing

One release per phase, as in the wizard plan. Model choice by risk: Opus for Medium or High, Sonnet for Low. Estimates are left to Luigi and Bowser at review.

| Phase | Goal | Owners | Risk |
|---|---|---|---|
| **1** | Record and unlock | Bowser, Luigi; Toad | Medium |
| **2** | Ratings, moves in own playbook, Luck | Bowser, Luigi; Toad | **High** |
| **3** | Bespoke, gear and track limits | Bowser, Luigi; Toad | **High** |
| **4** | Moves from other playbooks | Bowser, Luigi; Toad | Medium |
| **5** | Borrowed sections (havens and homes) | Bowser, Luigi; Toad | **High** |
| **6** | Advanced basic moves | Bowser, Luigi | Low |
| **7** | Retire, second hunter, change playbook | Yoshi (design), Bowser, Luigi | Medium, then TBD |

**Phase 1: record and unlock.** `hunter_improvements`; `POST`/`DELETE`; the experience check and clear; once-only; the five-basic unlock; `advancement` with statuses. Every improvement is a note ("unsupported" is never used for notes). The card, dialog (note field only), undo, and edit-page dirty tracking. `PlaybookService` refuses to remove taken improvements.
- **Exit:** a Chosen can take five basics, then an advanced one; the sixth pick is refused before five; experience is cleared.
- **Stopping point:** if Skyler stops here, LU3 option B's edit-page relaxation is still needed, because extra moves are refused.

**Phase 2: ratings, own-playbook moves, Luck.** Effects schema and guarded data migration for `rating`, `moves` (pool `playbook`) and `track` (luck). `HunterAdvancement`, `HunterAdjustments` in `Validate` and completeness, the rating-line and playbook locks (5.3), `HunterDraft.limits`, effective ratings in the UI, and the "What changes" list.
- **Exit:** seed-driven tests over the 28 for those kinds.

**Phase 3: bespoke, gear and track limits.**
- `pickLimit` (sections, dividers, move sections, gear), `entries`, track resets and harm boxes, pick-rule extra picks (5.4), negative deltas with removal.
- The Hex Rotes seed fix (LU9).
- The Hex's `advanced` pool.

**Phase 4: moves from other playbooks.** Pool `otherPlaybook`, foreign-move validation load, `GET /api/playbooks/moves`, and the "From other playbooks" picker, including foreign move sections such as Naked City.

**Phase 5: borrowed sections.** `borrowSection` (8 havens, the Spooky library, the Changeling's home, the Covenant's contact), plus the later `pickLimit` rows that target a borrowed haven.

**Phase 6: advanced basic moves.** Fill `BasicMove` (LU8), add `hunter_advanced_basic_moves` and the picker.

**Phase 7: lifecycle.** `retire` (derived badge on the page and list; LU6), `secondHunter` (LU7), then a separate design pass for `changePlaybook` (LU5), built on Phases 4–5's support for rows from other playbooks.

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Phases 4 and 6 depend only on 2 and can move earlier. Every phase leaves the remaining kinds as "unsupported", so nothing half-applies.

---

## 12. Risks and trade-offs

| Risk / trade-off | Weight | Mitigation or acceptance |
|---|---|---|
| **No link from a pick to the improvement that paid for it.** Undo may be refused until a pick is removed, and the sheet can't say "this move came from level 4". | Medium | Accepted for simpler storage and one rule path. The refusal message names what to remove. If the UI needs the link later, a nullable id on the pick tables can be added then. |
| **Validation reaches across playbooks** (Phases 4–5): new load paths, and more ways for the lookup maps to miss a row. | High | Load only referenced foreign rows; seed-driven tests per kind; the two lookups are built once and shared by `Validate` and completeness. |
| **Pick-rule extra picks are an approximation** (5.4). | Medium | Stated; revisit if the table plays extras strictly as attached to bases. |
| **Limits come from two sources in the client.** | Medium | Server sends deltas; one fixture drives a spec per read site (8.5). |
| **Unsaved edits lost on level-up.** | Medium | Actions disabled while the form is dirty. |
| **Live-link drift:** an admin edit to an effect or rating line changes existing hunters' derived values, and caps aren't re-checked. | Low | Same accepted behaviour as the rest of §3; admin effects are read-only. |
| **One-time effects aren't reversed on undo.** | Low | Stated in the dialog; the counters stay editable on the page. |
| **Experience check is a speed bump:** the edit page can set experience to full. | Low | Accepted; single-user app, and the rule is there to guide, not to secure. |
| **Reversing §2's "untyped" decision** adds 10 kinds to maintain. | Low | 80% of rows use nine wordings; kinds are a closed list with a check constraint. |
| **Scope:** 7 phases for a rules feature. | Medium | Phase 1 is usable alone; LU3 lets Skyler stop after any phase. |

---

## 13. Open questions for Skyler

Numbered LU1–LU15 so they don't clash with the wizard doc's Q1–Q12.

**LU1. Does experience have to be full before you can mark an improvement?**
- A. Yes. Marking needs all experience boxes filled, and clears them in the same save.
- B. Yes by default, plus a "record an earlier level-up" option that skips the check and leaves experience alone, for a hunter who levelled up before being entered in the app.
- C. No. Marking an improvement never checks or changes experience; you manage the boxes yourself.

*Recommendation: A.* It's the printed rule (every sheet; rulebook p.118), and it's what makes "Level up" mean something. Hunters in the database are test data, so there's no backlog to enter. B can be added later without undoing anything.

**LU2. Can a marked improvement be undone?**
- A. Yes, any of them. Undo is refused if it would leave advanced improvements with fewer than five basic ones, or leave more picks than the hunter is then allowed (the message says what to remove first). Undo doesn't give back experience or reverse one-time changes such as an erased Luck mark, and the confirmation says so.
- B. Only the most recent improvement can be undone, with the same refusals.
- C. No undo. Like ink on the sheet, a marked improvement is permanent.

*Recommendation: A.* Misclicks will happen. Undoing any row is no harder to build than undoing the latest, because no rule depends on order (5.1).

**LU3. How far should the app go in applying improvements to the hunter's data?**
- A. All the way, in the seven phases of Section 11: ratings, moves and Luck; bespoke and gear pick limits; moves from other playbooks; havens borrowed from the Expert; advanced basic moves; then retiring and changing playbook. Improvements with nothing to apply (allies, a stash of money) are recorded with an optional note.
- B. Record only (Phase 1). Improvements are marked with the experience and unlock rules, and you make every data change yourself on the edit page, which would then have to stop refusing extra moves and picks.
- C. Apply only the nine wordings every playbook shares (ratings, moves, Luck, basic moves, retire and so on), and record every playbook-specific improvement as a note.

*Recommendation: A,* reviewed phase by phase. You can stop after any phase, and each phase leaves the kinds it hasn't reached as "not supported yet" rather than half-applied.

**LU4. "Take a move from another playbook": which moves can be picked?**
- A. Any move from any other playbook in the app except advanced moves, including moves another playbook grants automatically. A move's own picks come with it (for example the Gumshoe's Naked City contacts).
- B. As A, but not moves another playbook grants automatically.
- C. Don't link a real move. Write the move's name and text into the improvement's note.

*Recommendation: A.* The rulebook says "any other playbook that's available in your game" (p.119). Linking keeps the move's text and its own picks on the hunter.

**LU5. "Change this hunter to a new playbook": what should happen for now?**
- A. Show it, but keep it unavailable ("Not supported yet") until a later design pass after Phases 4 and 5.
- B. Let it be recorded as a note now, and change the playbook by hand later.
- C. Design the full change now, before any phase starts.

*Recommendation: A.* The rulebook keeps ratings and history, keeps some old moves, adds new ones, and leaves gear to judgement (p.121). Each of those collides with the live link: the rating line, looks, gear and bespoke picks all belong to the old playbook. Recording it without doing it leaves a hunter that says it changed playbook but didn't. Phases 4–5 build the support for rows from another playbook that this needs.

**LU6. What does "Retire this hunter to safety" do in the app?**
- A. The hunter shows a "Retired" badge on its page and in the hunters list, and stays editable.
- B. As A, and retired hunters are hidden from the list unless you choose to show them.
- C. As A, and a retired hunter becomes read-only.

*Recommendation: A.* A retired hunter goes to the Keeper and may count as an ally (p.121), so you'll still look them up. "Retired" comes from the improvement taken, so B or C can be added later with no data change.

**LU7. What does "Create a second hunter to play as well as this one" do?**
- A. Record it, and offer a "Create a hunter" link to the wizard. The two hunters aren't linked.
- B. Record it and store a link to the hunter you create, shown on both hunters' pages.

*Recommendation: A.* The app has no players, so there's nothing that "plays both" to connect. A link can be added later.

**LU8. "Mark two of the basic moves as advanced": how should the basic moves be stored?**
- A. Fill the existing, empty basic moves table with the eight basic moves and their 12+ results from the rulebook (PDF p.103 onward and p.124), and record which ones each hunter has advanced.
- B. Record the chosen move names as text in the improvement's note.

*Recommendation: A.* You decided on 2026-08-25 that basic moves are a real table, and this is the first feature that needs its rows. It also lets the Changeling's "Mark use magic… as advanced" name the move.

**LU9. The Hex's rotes: should the number be limited?**
- A. Yes. A Hex can have one rote, plus one per "Take another Rote" (or "…or an additional Rote") taken, plus two for "Gain another two Rotes". The Rotes section's stored maximum changes from unlimited to 1.
- B. No. Rotes stay unlimited, and the rote improvements are recorded as notes.

*Recommendation: A.* Sheet p.29: "You start out knowing up to one rote… You can learn more by taking improvements." The seed has no maximum today.

**LU10. Improvements that let you change earlier picks ("Change your Task to another option", "Change some, or all, your dark side tags", "Change your Guide"): what should they do?**
- A. Record them only. The edit page already lets you change any pick at any time, so there's nothing to unlock.
- B. Lock bespoke picks after creation, and unlock a section only when one of these improvements is taken.

*Recommendation: A.* B changes how the edit page works for every hunter, for rules the table usually settles by agreement.

**LU11. Improvements that delete a pick ("Delete one of your Doom tags", "Delete one dark side tag permanently", "Remove one Unknown Heritage tag", "cross off another option from your Tools and Techniques"): what should they do?**
- A. Ask which pick to remove, remove it, and lower that list's required count by one, so the hunter isn't reported as unfinished.
- B. Record them only. You untick the pick yourself, and the hunter shows that list as unfinished.

*Recommendation: A.* Without the lower count, the hunter would report as unfinished forever after following the rules.

**LU12. The Chosen's Heroic tag: which wording should the app follow?** The sheet says "Delete one of your Doom tags, and (optionally) one of your Heroic tags" (sheet p.8). The rulebook says "(optionally) change one heroic tag" (p.123).
- A. The sheet: the dialog lets you optionally remove one Heroic tag too, and lowers Heroic's count if you do.
- B. The rulebook: only the Doom tag is removed. Changing a Heroic tag is done on the edit page, as with LU10.

*Recommendation: A.* The sheets are the source every playbook in the app was built from, and the 2025 consolidated sheets are the newer print.

**LU13. The Pararomantic's "Gain a second Guide" (two Relationship Status tracks) and the Curse-Eater's "Make a consumed magic into a permanent custom move": model them, or record them as notes?**
- A. Notes for now. For the Curse-Eater, you delete the journal entry yourself and write the move into the note.
- B. Model them: a second Relationship Status track per hunter, and custom moves on hunters.

*Recommendation: A.* Each is one or two improvements on one playbook, and each needs a new kind of hunter data that nothing else uses yet.

**LU14. "Erase one used Luck mark" when no Luck is marked: what should happen?**
- A. It's unavailable, with the reason "No Luck marked".
- B. It can be taken and changes nothing.

*Recommendation: A.* The rulebook's advice for a rating already at its maximum is "don't select this improvement" (p.118), and the same reasoning applies.

**LU15. Extra Natural Attacks and Combat Magic picks: confirm the wizard Q10 follow-through.** In wizard Q10 you chose "Refuse, as designed", and the code says those picks wait "until hunters record improvements".
- A. Once "Take a natural attacks pick" or "Take another Combat Magic pick" is marked, the hunter may hold one more pick for each taken (a base or an extra/effect), and not before.
- B. Keep refusing them even after improvements are recorded.

*Recommendation: A.* It's what Q10 deferred to, and it matches the rulebook's "either a new base or a new extra" (p.120).

---

## Appendix A: the 107 playbook-specific improvements

"(A)" marks an advanced improvement. "check" marks a proposed effect that needs Skyler's eye during authoring. Anything not listed uses one of the nine shared wordings (Section 1.3).

| Playbook | Improvement (abridged) | Proposed effect |
|---|---|---|
| Action Scientist | Get a laboratory… | note |
| | Gain an ally team of action scientists | note |
| | (A) New interest: add a second area of study | `pickLimit` Area of Study +1 |
| Celebrity | Gain an ally group—an entourage | note |
| | Choose two topics of occult lore… +1 ongoing… fakelore | note |
| | (A) Retire this hunter to increased fame | `retire` |
| | (A) Your fame skyrockets… | note |
| Changeling | Gain an ally… | note |
| | Mark use magic (or your alternate Weird move) as advanced | `basicMoves` fixed Use Magic (check: alternate Weird moves aren't modelled) |
| | (A) Remove one Unknown Heritage tag | `pickLimit` Unknown Heritage −1, removal |
| | (A) Retires to a position of supernatural responsibility | `retire` |
| | (A) You find a home. Pick one: Agency / Sect / haven | choice: `borrowSection` Professional Agency (1 resource, 1 red tape) · Initiate Sect (1 good, 1 bad tradition) · Expert Haven 2 (check: per-divider counts) |
| Chosen | Gain an ally | note |
| | (A) Delete one of your Doom tags, and (optionally) one of your Heroic tags | `pickLimit` Fate › Doom −1, removal; optional Heroic −1 (LU12) |
| Covenant | You gain a second ally. Pick a different style | `pickLimit` Friendship › Type +1 and › Style +1 (check) |
| | Gain one type of contact as if from the Gumshoe's naked city move | `borrowSection` Gumshoe Naked City, 1 |
| | (A) Your Covenant now works twice per session | note |
| | (A) Create a hunter based on one of your allies… | `secondHunter` |
| Crooked | Gain an ally: one of your old crew | note |
| | Recover a stash of money… | note |
| Curse-Eater | Make a consumed magic into a permanent custom move… (basic and A) | note (LU13) |
| | Clear all corruption… (basic and A) | `track` Corruption reset |
| Divine | Gain a lesser divine being as an ally | note |
| | (A) Change your mission | note (LU10) |
| Envoy | Pick a second resource item from the Envoy's gear options | `pickLimit` gear "Resources (pick one)" +1 |
| | Your Overseers provide bodyguards… | note |
| | Change your Task to another option | note (LU10) |
| | (A) Pick a secondary Task as well as your first | `pickLimit` Task +1 |
| | (A) Change any or all of the Overseers' Values and Concerns | note (LU10) |
| Expert | Add an option to your haven (×2) | `pickLimit` Haven +1 |
| Flake | Get a haven, like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | Gain another option for your haven | `pickLimit` Expert Haven +1 (needs the borrowed haven) |
| Forged | Pick another benefit for your weapon form | `pickLimit` Dual Nature › Benefits +1 |
| | Count your current wielder as your partner… | note |
| | (A) Get a second partner | note (check: Partner move's own picks) |
| | (A) Wield yourself in weapon form… | note |
| | (A) Choose an advanced move you have… (×2) | note |
| | (A) Choose to be either human or weapon permanently… retire or change playbooks | choice: `retire` · `changePlaybook` |
| Gumshoe | Add another harm box to your track, before Dying | `track` harmBoxes +1 |
| | Get a haven (your office, perhaps), like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | Add four additional or new contacts for your Naked City move | `pickLimit` Naked City (move section) +4 |
| | (A) Turn one of your contacts into an ally | note |
| Hex | Take another Rote (×3) | `entries` Rotes +1 (LU9) |
| | Take another Hex move, or an additional Rote (×2) | choice: `moves` playbook +1 · `entries` Rotes +1 |
| | Take a Haven, like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | (A) Gain another two Rotes | `entries` Rotes +2 |
| | (A) Choose one advanced Hex move | `moves` advanced +1 |
| Host | Get a haven like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | Gain an ally… | note |
| | Take another benefit from Symbiosis (basic and A) | `pickLimit` Symbiosis › Benefits +1 |
| | Gain another option from defensive adaptation | `pickLimit` Defensive Adaptation (move section) +1 |
| | (A) Create a second hunter by symbiotic fission… | `secondHunter` |
| | (A) Add a third option to your haven | `pickLimit` Expert Haven +1 (needs the borrowed haven) |
| Initiate | Get command of your chapter of the Sect | note |
| | Get a Sect team under your command | note |
| | (A) Become the leader… of the whole Sect | note |
| Interface | Add, remove, or change three tags on gear (×2) | note (gear tags aren't modelled) |
| | (A) Retire as an uploaded consciousness… | `retire` |
| | (A) Get a haven like the Expert with workshop, supercomputer, and two other options | `borrowSection` Expert Haven 2 + granted Workshop; supercomputer as note (check) |
| | (A) Add an Upgrade or change a Fault | choice: `pickLimit` Integration › Upgrades +1 · note |
| | (A) Add the "integrated" and "blatant" tags… | note |
| | (A) Add the "retractable" tag… | note |
| Monstrous | Gain a haven, like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | Take a natural attacks pick | `pickLimit` pick rule Natural Attacks +1 (5.4, LU15) |
| | (A) Free yourself from the curse of your kind… you lose 1 Weird | `rating` Weird −1 + note |
| | (A) You turn evil (again). Retire this character… | `retire` |
| Pararomantic | Gain an ally | note |
| | (A) Take a second gift from your guide or add another property to an existing gift | choice: `pickLimit` Guide's Gift +1 · note |
| | (A) Change your Guide… | note (LU10) |
| | (A) Gain a second Guide… | note (LU13) |
| | (A) Erase all the marks from the Relationship Status track | `track` Relationship Status reset |
| Professional | Add a new resource tag for your Agency or change a red tape tag | choice: `pickLimit` Agency › Resources +1 · note |
| | Get command of an Agency team of monster hunters | note |
| | (A) Get some or all of the other players' hunters hired… | note |
| Searcher | Gain an ally | note |
| | Take a second first encounter move… | `pickLimit` First Encounter (move section) +1 |
| | (A) Resolve your first encounter… | note |
| Snoop | Gain an ally: one of your existing crew… | note |
| | Get a haven, like the Expert has, with one option plus a film lab and editing suite | `borrowSection` Expert Haven 1 + note |
| | (A) Make it big… | note |
| Spell-Slinger | Take another Combat Magic pick (basic and A) | `pickLimit` pick rule Combat Magic +1 (5.4, LU15) |
| | (A) You may cross off another option from your Tools and Techniques | `pickLimit` Tools and Techniques (move section) −1, removal (check: "cross off" read as needing one fewer) |
| Spooktacular | Gain an ally | note |
| | Take another Show option | `pickLimit` The Show +1 |
| | (A) Get your own traveling show… | note |
| Spooky | Change some, or all, your dark side tags | note (LU10) |
| | Get a mystical library, like the Expert's haven option | `borrowSection` Expert Haven 0 + granted Mystical Library |
| | (A) Delete one dark side tag permanently | `pickLimit` The Dark Side −1, removal |
| Visitor | Gain an ally: alien, local animal, or local friend | note |
| | Repair the vehicle that brought you here… | note |
| | (A) …Retire this hunter to safety, on Earth | `retire` |
| | (A) …Retire this hunter to safety back on your homeworld | `retire` |
| | (A) Establish official, friendly contact between Earth and your people | note |
| Wronged | Gain a haven, like the Expert has, with two options | `borrowSection` Expert Haven 2 |
| | Add one more option to your haven | `pickLimit` Expert Haven +1 (needs the borrowed haven) |
| | (A) You track down the specific monster(s) responsible… | note |
| | (A) Change the target of your vengeful rage. Pick a new monster breed… | note (LU10) |

---

## Appendix B: where this resembles the withdrawn design

The 2026-09-12 design was withdrawn and isn't cited as precedent anywhere above. Four conclusions here look like parts of it. Each was reached independently, for the reasons given:

- **A hunter-side table of taken improvements.** The withdrawn design had a `HunterImprovement` bridge. This doc also has one, because the rulebook says to "mark the improvements off" and "each can only be selected once" (p.118), and a composite key is how this codebase already makes a duplicate pick impossible (`HunterMove`). **It differs on the load-bearing point:** the withdrawn design linked picks back to improvements (`GrantedByPlaybookImprovementId`). This doc deliberately has no such link and derives limits instead (Section 0, trade-off; Section 12, first row).
- **Removable improvements.** Recommended here (LU2) because misclicks happen and order-free rules make undo cheap. It's put to Skyler as a question, not assumed.
- **A button that starts leveling up.** This doc's "Level up" action follows the sheet's own words ("you level up") and is gated on full experience. It's a card action on the existing page (Section 8), not a new route.
- **Not adopted:** a `PATCH /hunters/{id}/state` endpoint (experience and Luck stay on the whole-hunter `PUT`), a separate edit route, and any change to the creation wizard.
