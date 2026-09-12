# Hunter Advancement — Ideation

**Status: ideation, 2026-09-03. Revised 2026-09-10 — all seven open questions answered by Skyler, plus four questions of his own on Section 9. Revised again 2026-09-11 — the one blocking question (13.2) resolved by Skyler; nothing in this document is blocked.** This is an architecture pass on tracking a Hunter as it gains experience and levels up, taking improvements and advanced improvements over time.

**What the 2026-09-10 round changed, beyond closing question marks.** Four answers moved real decisions rather than confirming them, and one of my own Section 9 bullets was simply wrong:

- **Foreign moves are free text for the first pass** (QQ-6), which *removes* `ForeignMovePick` from HA-1 entirely — the "belongs to this playbook" validator needs no relaxing at all, because no `HunterMove` row will point at a foreign move. HA-1 gets smaller.
- **`BasicMove` already exists as a real, migrated table** — Skyler said he had been "planning to add" it. It is created by migration `AddHunterPlaybooks`, has a `DbSet` and a `BasicMoveResponse` contract, and is empty and unexposed. What is left is content and a `GET`, not a schema decision. See 9.3.
- **I was wrong about removal improvements** (9.2). I wrote that a signed amount "would fix `MinSelect` but break `MaxSelect`". It does not, if it shifts *both* bounds — which is the obvious reading I failed to consider. The stale-`Outstanding` problem is solved in HA-2 for free, with no new enum member.
- **One improvement per advancement becomes a client-side constraint** (Skyler's fourth Section 9 question), replacing "nothing enforces this."

**What the 2026-09-11 round changed.** Skyler resolved 13.2 — the conflict between his OQ-1 answer and his Q5b answer to Rosalina — by choosing the option labelled *"QQ-1 — improvements are removable (Yoshi's rec)"*. He said nothing further. This doc designs to the narrow reading of that choice and nothing wider: **creation picks stay locked (Q5b holds); advancement picks can be undone, by hard delete, with no trace (QQ-1).** It is not a general edit route. Two consequences:

- **Undo is never a dead end.** Removing an improvement always clears any error that improvement caused, so Section 9's *"every tier-one violation is fixable by removing something"* holds again, with the improvement itself as the thing removed. 9.2's transient is recoverable on that basis.
- **Designing to that reading exposed a flaw in my own Section 6, and two things the reading does not cover.** Undo is only exact when nothing the improvement granted has been *spent*. A hunter who took `Take another Chosen move`, picked the move, then undid the improvement keeps the move and is over its allowance. Because a play-state click on Rosalina's read-only sheet is a whole-hunter `PUT` that re-runs `Validate`, **that hunter could not mark Luck or Harm** until the improvement was taken again. That is HA-1 scope. *(Later 2026-09-11: Skyler added `PATCH /hunters/{id}/state` for the play counters, which never runs the pick rules, so this particular lockout no longer occurs. The over-allowance behind it is still a false statement refused on any save that runs the rules, so OQ-8's fix still stands — see 7.1.)* Separately, removal and swap improvements (`Delete one of your Doom tags`, `Change your Task to another option`) can only be *carried out* by changing a creation pick. Both were raised as open questions — **OQ-8** and **OQ-9** — rather than assumed, and **both were resolved later the same day with the recommended design.** Undo now removes exactly the move an improvement granted, recorded by a new `HunterMove.GrantedByPlaybookImprovementId` column (HA-1). A removal or swap improvement makes its change as its own secondary pick, saved with the improvement (HA-2). The play-state trap is closed, and removal improvements can now actually be carried out.

Rosalina still reviews the *flow*; QQ-2 and QQ-5 were decided by Skyler directly and are no longer hers.

**Three things were decided before this pass and are designed to, not re-litigated:**

1. **Usage moment — between sessions, deliberate.** Skyler sits down after a game and updates hunters. This is not an at-the-table live tool. It buys room for a focused screen, careful reading, and an explicit confirm.
2. **Full history** — an append-only record of every improvement taken and when, so *"why does this hunter have +2 Sharp"* is answerable and undoing a mistaken pick is safe.
3. **The end-game is out of scope** — retirement, switching playbooks, and "become a new hunter" stay manual table events. Section 12 records the two places this design would paint into a corner if that changes, and what each would cost.

Prior decisions this design is built **with**, not around: hunters are live-linked to their playbook and never snapshotted (`open-questions.md` Q4); `PlaybookImprovement` is flat and untyped on purpose (`architecture.md` Section 2); partial hunters are savable and minimums are reported rather than enforced (`architecture.md` Section 9); one request carries the whole hunter, no sub-resource endpoints (`architecture.md` Section 8).

---

## 1. What the source actually says

Read directly from `Monster of the Week Revised Corrected.pdf` (pp. 118–121) and `Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf`, and cross-checked against the 28 authored playbooks in `src/api/MonsterOfTheWeek.Api/Data/Seed/hunter-playbooks.json`, which is this project's own verified transcription of the same pages.

**The advancement loop, verbatim from the rulebook:**

> You get an experience point whenever your roll totals six or less, or when a move tells you to. Mark your next experience box.
>
> Whenever you mark the fifth experience box on your playbook, you level up. Erase all five marks and choose an improvement from the list in your playbook. **Mark the improvements off as you take them: each can only be selected once.**
>
> Then you start collecting experience marks again, until you level up again when you get another five experience points.
>
> When you have leveled up five times, you can start choosing from the advanced improvements list as well.

Three facts fall straight out of that, and all three are structurally load-bearing:

- **Five experience boxes, universally.** `ExperienceBoxCount == 5` on all 28 authored playbooks — no variation to model.
- **A hunter's "level" is not a stored number.** It is the count of improvements taken. The advanced threshold is `count >= 5`. Both are derivable from a single table, which is the same "derived, never stored" discipline `architecture.md` Section 6.4 (bespoke engagement) and Section 9 (completeness) already established.
- **One printed checkbox = one takeable improvement, exactly once.** This is why every playbook prints `Take another [Playbook] move` **twice** and `Take a move from another playbook` **twice** — the repeat count is expressed by printing the line more than once, not by a "repeatable" property. Verified across all 28: 27 playbooks duplicate at least one line, and the Hex prints `Take another Rote.` three times. **The existing flat `PlaybookImprovement` table already encodes this correctly, one row per printed checkbox.** No repeatability schema is needed on the template.

### 1.1 What the 525 printed improvement lines actually ask for

All 28 playbooks, 284 regular + 241 advanced improvements, classified by *what state in this application they would have to touch*:

| Bucket | Lines | % | Example | Where it lands |
|---|---:|---:|---|---|
| Raise a rating | 146 | 28% | `Get +1 Sharp, max +3` / `Get +1 to any rating, max +3.` | **No home exists today** |
| Take another move from this playbook | 56 | 11% | `Take another Chosen move` | Breaks the `MoveGrantCount` ceiling |
| Take a move from another playbook | 53 | 10% | `Take a move from another playbook` | Refused today by `Validate` |
| Mark basic moves as advanced | 56 | 11% | `Mark two of the basic moves as advanced.` | **No home exists today** |
| End-game (retire / new type / second hunter) | 92 | 18% | `Retire this hunter to safety.` | Out of scope — record only |
| Restore a Luck mark | 27 | 5% | `Erase one used Luck mark from your playbook.` | Already possible (edit the counter) |
| Grow a bespoke ruleset | 28 | 5% | `Take another Combat Magic pick.` / `Take another Rote.` | Breaks `MaxSelect` / `MaxInstances` — except the Hex's Rote lines, which only raise a minimum, since Rotes has no maximum (4.2, corrected 2026-09-11) |
| Shrink or swap a bespoke pick | 12 | 2% | `Delete one of your Doom tags…` | Leaves a false `Outstanding` line |
| Import another playbook's structure | 10 | 2% | `Get a haven, like the Expert has, with two options` | **No home exists today** |
| Extend a track | 4 | <1% | `Add another harm box to your track, before Dying.` | Breaks the `HarmBoxCount` ceiling |
| Take an advanced playbook move | 1 | <1% | `Choose one advanced Hex move (see below).` | Refused today by `Validate` |
| Purely narrative / Keeper fiat | 40 | 8% | `Gain an ally` / `Your fame skyrockets…` | Nothing to store |

**The headline number: 214 of 525 lines (41%) have no mechanical consequence this application can or should represent** — end-game, narrative grants, basic-move marking, cross-playbook imports, and tag edits inside unstructured gear text. For those, *recording that the line was taken* is the entire feature, and it is worth the whole feature on its own.

### 1.2 One authoring gap found — declined by Skyler 2026-09-10, kept as record

`Playbook.LevelingUpText` is **truncated on all 28 playbooks**. Every stored value stops at the colon:

> `When you have filled all five experience boxes, you level up. Erase the marks and pick an improvement from the following list:`

The printed sheets continue with a second sentence that all 28 carry and none of them stored — verified by extraction (the sentence appears 28 times in the source PDF; `0 of 28` seeded values contain the words "five times"):

> `After you have leveled up five times, you qualify for advanced improvements in addition to these.`

That sentence is the **only** place the advanced-improvement threshold appears in the source material.

**Skyler's answer, 2026-09-10: "You can ignore this detail. We do not need the additional text at this time."** Closed as *declined*, not as *done* — the finding is left standing because the gap is a verified fact about the seeded data and someone will otherwise re-discover it and re-raise it. **One consequence, for 7.2 step 2:** the advanced-improvement lock needs wording of its own, because the source sentence it would naturally have quoted is not stored anywhere in the app.

---

## 2. The central finding

> **`HunterService.Validate`'s entire first tier reads the playbook as if it were the hunter's rulebook. After the first level-up, it isn't — and that is what leveling up *is*.**

`architecture.md` Section 9 drew the refuse/report line with a good test: refuse anything where *the stored row would assert something **false** about the playbook*; report anything that merely says the hunter is *unfinished*. Every rule currently in the refuse tier is a **ceiling read off the playbook**:

| Refused today | Which improvement makes it legal | Lines |
|---|---|---:|
| more than `MoveGrantCount` non-required move picks | `Take another [Playbook] move` | 56 |
| a move that isn't this playbook's | `Take a move from another playbook` | 53 |
| a move with `IsAdvanced` | `Choose one advanced Hex move` | 1 |
| more than a gear category's `PickCount` | `Pick a second resource item from the Envoy's gear options` | 1 |
| more than a bespoke section's `MaxSelect` / `MaxInstances` | `Take another Combat Magic pick.`, `Take another Show option.`, … — **not** `Take another Rote.`, which exceeds nothing because Rotes has no maximum (4.2, corrected 2026-09-11) | under 28 |
| a Harm value past `HarmBoxCount` | `Add another harm box to your track, before Dying.` | 1 |

Improvements exist *specifically* to falsify those six statements. So the work is not "add growth rules alongside the creation rules." It is: **every ceiling has to become `playbook value + what this hunter's improvements granted`.** Section 9's test survives intact — an over-picked hunter with no improvement granting the extra pick is still asserting something demonstrably false, and is still refused. What changes is what "false" is computed against.

Ratings are the one case where nothing breaks, because nothing exists: a hunter's ratings are *only* `Hunter.PlaybookStatArrayOptionId` pointing at five ints on a template row, and there is no place in the schema, the API contract, or the UI where a hunter's actual Charm/Cool/Sharp/Tough/Weird is a number. `architecture.md` Section 3 already flagged this in passing — *"Rating improvements gained later via leveling up… are a future concern this pass's schema doesn't address."* This is that future.

---

## 3. Domain model delta — one new table

```
HunterImprovement
  HunterId                 Guid   FK -> Hunter               (Cascade)   ┐ composite PK
  PlaybookImprovementId    Guid   FK -> PlaybookImprovement  (Restrict)  ┘
  TakenAt                  DateTimeOffset
  EffectKind               HunterImprovementEffect?   -- nullable; null = recorded only
  EffectTargetId           Guid?                      -- meaning set by EffectKind; no FK, see 3.4
  EffectAmount             int                        -- default 1, SIGNED; see 4.2 and 9.2
  ForeignMovePlaybook      string?                    -- the 53 "move from another playbook" lines, HA-1
  ForeignMoveName          string?                    -- two fields, not one sentence — see 4.2
  Note                     string?                    -- free text, e.g. "haven: library + panic room"
```

That is the core schema delta for the advancement feature itself: one new table, no column added to `Hunter`, nothing changed on any template table.

**Plus one column on an existing table, decided 2026-09-11 (OQ-8):** `HunterMove.GrantedByPlaybookImprovementId` (nullable Guid) records which improvement granted a move, so removing that improvement removes exactly that move. It is null for every move picked at creation. HA-1. See Section 6, and the HA-1 risks under Section 8.

**And the same column on two bespoke tables, decided 2026-09-11 for HA-2:** `HunterBespokeSelection.GrantedByPlaybookImprovementId` and `HunterBespokeSectionInstance.GrantedByPlaybookImprovementId`, recording picks and entries spent from an improvement's allowance. Picks swapped in by a change-a-pick improvement are excluded (OQ-9). See Section 8.

**One further table sits beside it but is not part of it.** `HunterAdvancedBasicMove (HunterId, BasicMoveId)` — composite key, no columns — covers `Mark two of the basic moves as advanced`, which is not an allowance and does not belong in this table's effect vocabulary. It is gated on separate work of Skyler's and is scheduled independently as HA-1b. See 9.3, where its shape is argued and the state of `BasicMove` is set out.

### 3.1 Why a composite key, and what it costs

`(HunterId, PlaybookImprovementId)` makes *"this hunter ticked the same printed checkbox twice"* impossible at the database level rather than something the service has to remember — which is exactly the rule the rulebook states (*"each can only be selected once"*) and exactly the justification `HunterEntities.cs` already gives for `HunterMove` and `HunterGearSelection`. It also makes this the fifth instance of a pattern that file already uses four times, rather than a new idiom.

Cost, stated plainly: if a line ever needs to be recorded twice for one hunter — a houserule, or a future end-game mechanic — **the composite key is the single thing to change**, and it is a migration. Same sentence `HunterLookSelection` already carries about its own key.

### 3.2 Why one table is both the state and the history

The playbook sheet's improvements column *is* the history: a checkbox once ticked stays ticked, in the order it was ticked. There is no separate "current improvements" projection to keep in step with a log, because the set of rows already is the current state. Splitting into picks + audit log would mean either replaying the log to know the state, or maintaining two representations that can disagree — real machinery, bought with nothing, in a single-user between-sessions tool.

**Order is presentational only.** No derived value depends on the order improvements were taken — `+1 Sharp` then `+1 to any rating (Sharp)` is the same hunter either way. So `TakenAt` alone is sufficient; there is no `SortOrder` column and nothing to renumber when a row is removed. `TakenAt` defaults to now and is user-editable, because Skyler will be recording a session that happened last Thursday.

### 3.3 The "level" is derived, in two ways, from this one table

- **Level-ups taken** = `HunterImprovement` row count.
- **Advanced improvements unlocked** = that count `>= 5`.

Neither is stored. A stored counter could be falsified by an undo, by a backfill, or by a playbook edit, and this doc set has now reached the same conclusion three times (Section 6.4 engagement, Section 9 completeness, here) — worth stating as the settled house rule it has become: **anything computable from the rows is computed from the rows.**

### 3.4 `EffectTargetId` deliberately carries no foreign key

Its referent depends on `EffectKind` — a `PlaybookGearCategory` for one kind, a `BespokeSection` for another, nothing at all for most. A polymorphic FK is not expressible, and three nullable typed FK columns to say one thing would be worse. The consequence is real and is handled in one place: **the allowance calculation ignores any effect whose target is not present in the hunter's current playbook**, rather than throwing. That single line is also what makes a future playbook switch (Section 12) a non-event instead of a crash.

---

## 4. How an improvement is applied — and why the template stays untyped

This is the crux, and it is where `PlaybookImprovement`'s flat-untyped decision gets stress-tested now that its consumer finally exists.

### 4.1 The decision holds — for a reason its original author didn't have

The original argument (`architecture.md` Section 2) was *"the variation is entirely in which text appears, never in structure, so semantic sub-typing would over-fit three samples."* That argument is about **authoring**, and after 28 playbooks it has held up. But it is no longer the strongest argument. The stronger one only becomes visible once you try to *consume* the rows:

> **Typing the template cannot answer the question leveling up actually asks, because the sheet under-determines the effect on purpose.**

- `Get +1 to any rating, max +3.` — *which* rating? Only the player knows, at the table.
- `Take a move from another playbook` — *which* move, from *which* of 27 other playbooks?
- `Get a haven, like the Expert has, with two options` — *which* two of the Expert's haven options?
- `You find a home. Pick one: …` (The Changeling) — an improvement with its own three-option pick list *inside* it, stored as `<ul><li>` markup.

For 255 of the 525 lines the effect is a *choice made per hunter*, not a property of the printed line. So a per-hunter effect record is required **regardless** of whether the template is typed. Typing the template would therefore buy exactly one thing: a pre-filled default. It would cost a 525-row re-authoring pass across data that took four verification groups and eleven found ordering/count errors to get right, plus a taxonomy that provably cannot express a real line already in the corpus:

> **The Hex: `Take another Hex move, or an additional Rote.`** — one printed checkbox, two structurally different mechanical outcomes, chosen by the player. A `Kind` column on the template has no correct value for that row.

**Recommendation: keep `PlaybookImprovement` exactly as it is — flat, untyped, one row per printed checkbox — and put all interpretation on the instance side, where the choice is being made anyway.** The pre-filled default that template typing would have bought is recovered for free by a client-side heuristic (4.4) that is never stored and never authoritative.

### 4.2 The effect vocabulary, phased

`EffectKind` is nullable, and **`null` is the expected value for 41% of lines**. It means *"recorded, with no consequence the app enforces"* — which is the honest answer for `Retire this hunter to safety.` and for `Gain an ally` alike.

**Phase HA-1 — six members, all `Amount = 1`, no target:**

| Kind | Meaning | Lines covered |
|---|---|---:|
| `RatingCharm` `RatingCool` `RatingSharp` `RatingTough` `RatingWeird` | +1 to that rating | 146 |
| `PlaybookMovePick` | +1 to the playbook-move allowance | 56 |

Ratings are five enum members rather than one kind plus a stat column because the five ratings are a closed set the game will never extend, and it removes a column.

**`ForeignMovePick` was dropped from HA-1 on 2026-09-10, and that is a simplification rather than a deferral.** Skyler's answer to OQ-6 was *"for the first pass, just have a text input to add which move they've chosen from another playbook."* Free text means **no `HunterMove` row ever points at a foreign move**, which means `Validate`'s "does not belong to playbook" check needs no relaxing at all and the allowance would have nothing to spend. 53 lines of corpus — the third most common improvement — are handled by one labelled text field and no schema. `ForeignMovePick` returns in HA-2 alongside the real picker. **One thing worth getting right now for the sake of that later pass: capture the answer as two fields (playbook, move name) rather than one sentence.** Migrating `"Haven, from the Expert"` into a `HunterMove` row is a lookup; migrating `"I took the Expert's haven thing"` is a judgement call, and there will be dozens.

**Phase HA-2 — four members, each needing a target or a picker in the UI:**

| Kind | Target | Lines |
|---|---|---:|
| `GearPick` | `PlaybookGearCategory` — shifts `PickCount` | 1 |
| `BespokeSelect` | `BespokeSection` — shifts `MinSelect` **and** `MaxSelect` | ~34 |
| `BespokeInstance` | `BespokeSection` — shifts `MinInstances` **and** `MaxInstances` | 6 |
| `ForeignMovePick` | none — +1 move allowed from another playbook | 53 |

**Two facts about the target space, counted from the seed on 2026-09-10 rather than estimated — the second of which was wrong, and is corrected below (2026-09-11).** There are **49 bespoke sections** in the corpus — 36 playbook-level and **13 attached to a Move** — of which 39 carry `MinSelect > 0`, matching `architecture.md` Section 9's own figures exactly. Two consequences for the picker:

- **The target list must include move-internal sections, not just playbook-level ones.** Several improvements aim squarely at them — `Gain another option from defensive adaptation` (the Host's *Defensive Adaptation*), `Add four additional or new contacts for your Naked City move` (the Gumshoe), `You may cross off another option from your Tools and Techniques` (the Spell-Slinger). A picker built from `PlaybookDetailResponse.BespokeSections` alone would silently omit all 13, and `architecture.md` 6.8 deliberately nests them under their Move so they are *not* in that collection.
- **`BespokeInstance` has three possible targets, and the corpus only ever grows one of them.** *(Corrected 2026-09-11. This bullet first said the Hex's Rotes was the only repeatable section in the corpus. Two more sit inside moves.)* Table and dated note directly below.

| Section | Where it lives | Instances | Shape of each entry | Improvements that grow it |
|---|---|---|---|---|
| The Hex's *Rotes* | playbook-level | 0 to unbounded (`MaxInstances` null) | picks 2 of 2 options | 6 lines, all the Hex's |
| The Searcher's *Network* | inside the move *Network* — not required | 0 to 5 | free text (`Member`), no options | none |
| The Spell-Slinger's *Arcane Reputation* | inside the move *Arcane Reputation* — not required | exactly 3 | free text (`Organization`), no options | none |

**Dated note, 2026-09-11 — what the correction changes.** I missed the two move-level sections because my repeatable-section scan read only playbook-level sections. I then adopted Rosalina's first-pass figure without running my own move-level walk — the same blind spot 13.4 faults her for. She caught it in her reconciliation pass; the coordinator confirmed it with a recursive walk of `hunter-playbooks.json`, and I re-ran it. The entity comment on `HunterBespokeSectionInstance` (*"a single Rote, one Network member, one of the Spell-Slinger's three organizations"*) was right all along and needs no change. Four consequences:

- **The picker's reach for `BespokeInstance` is three sections, but only the Hex's grows in the corpus.** No improvement adds a Network member or an organization, so the line count (6) and "build it last" both stand. The picker should still offer every repeatable section the hunter can use — playbook-level, and inside moves the hunter holds — because the effect is chosen per hunter, and a playbook authored later through the admin UI is not bound by today's corpus.
- **`Take another Rote.` shifts no ceiling.** Rotes has no maximum, and a null bound plus any amount must stay null in 5.1's allowance calculation, not be treated as zero. The only observable effect of `+1` on Rotes is the raised minimum: the hunter reads *"Rotes: 2 of 3 added."* until the rote is written. The refuse tier never saw a Rote count, so §2's table no longer cites that line as a ceiling-breaker.
- **"Tested against one playbook" no longer holds.** Rotes is the one repeatable section that exercises neither a finite ceiling nor move gating. `BespokeInstance` needs three test cases: Rotes for the unbounded maximum, Arcane Reputation (exactly 3) for a finite ceiling shifting, and either move-level section for a hunter who does not hold the move. No improvement targets the second or third, but they are the only real data that covers those paths.
- **Improvements can target sections inside moves — for both bespoke kinds, with one difference.** The three move-level sections improvements actually target are all `BespokeSelect` targets: the Gumshoe's *The Naked City* (4 of 34), the Host's *Defensive Adaptation* (1 of 6), the Spell-Slinger's *Tools and Techniques* (3 of 4). **All three moves are required**, so every hunter of those playbooks holds the move and the effect always applies. The two move-level *repeatable* sections sit inside moves that are **not** required, so an effect there applies only if the hunter took the move. Completeness already skips a move's sections when the move is not held (`HunterCompleteness.EvaluateBespoke`), and `ValidateSelectionScope` already refuses answers for them. **Recommendation for the HA-2 picker:** offer playbook-level sections plus the sections of moves the hunter holds, walking `moves[].bespokeSections` on the client. The server needs nothing new: `playbook.BespokeSections` already loads every section, move-level included.

**Outside this doc's scope, noticed in passing (described as found, before the fix):** `ValidateBespoke`'s instance loop checks that a section is repeatable and under its maximum, but not that the hunter holds the section's move. A named entry with no answers is therefore not refused there for a hunter without *Network* or *Arcane Reputation*; any entry with an answer is refused by `ValidateSelectionScope`. This is a creation-validator gap that predates advancement. **Fixed 2026-09-11 (not yet committed):** the instance loop now refuses an entry whose section belongs to a move the hunter has not taken.

**`EffectAmount` is signed, and the bespoke kinds shift both bounds rather than just the ceiling.** That single detail is what makes growth and removal the same mechanism instead of two: `+1` on `Take another Combat Magic pick.` raises the maximum *and* the minimum, so the hunter correctly reads *"1 of 3 picked"* until the pick is spent; `-1` on `Delete one of your Doom tags` lowers both, so the hunter stops being reported short of a requirement the rules just took away. An earlier version of this doc claimed those two directions were in conflict. They are not — see 9.2.

**Phase HA-3 — the two-line tail:** `AdvancedMovePick` (The Hex only) and `HarmBoxes` (The Gumshoe only). Two enum members, one line of corpus each. Worth doing eventually, never worth doing first.

**Deliberately never modelled**, and this is a decision rather than an omission:

- **`Erase one used Luck mark` (27 lines)** — not an allowance, a one-time counter edit the sheet supports through the play-state save. `EffectKind = null`; Skyler decrements Luck in the same sitting. Modelling it would need a "one-time effect already applied" flag, which is a whole second semantics for one gesture.
- **The Curse-Eater's journal and Corruption improvements (4 lines) — checked 2026-09-11, after Skyler made journal entries editable on the sheet.** `Make a consumed magic into a permanent custom move (with the group’s agreement), then clear it.` removes an entry from *Consumed Magic*, the only journal in the corpus. `Clear all corruption, without clearing consumed magics…` empties the *Corruption* track. Both are sheet actions, not OQ-9 secondary picks: a journal entry is play content rather than a creation pick, and Corruption is a counter. So `EffectKind = null`, `Note` records which magic became a custom move, and the change is its own save — no atomicity needed, since nothing enforces the link. One difference from delete-type improvements: removing the improvement cannot restore a cleared entry, but the player can re-add it on the sheet. The second line's other clause, that no new magics can be consumed until some are released, is a cap nothing in the schema models, and stays prose.
- **`Mark two of the basic moves as advanced` (56 lines)** — not an allowance at all. It is a per-hunter fact about a universal move, and it gets its own two-column bridge outside this enum. See 9.3.
- **Cross-playbook *structure* imports (10 lines)** — `Get a haven, like the Expert has, with two options` would mean a hunter holding bespoke answers against *another playbook's* sections. Needs research before a shape is chosen; `Note` records what was taken meanwhile. See 9.4.

### 4.3 What the app interprets vs. what Skyler records — stated as a single rule

> **The app never reads improvement text. It reads `EffectKind`, which a human set once, at the moment of taking the improvement.**

There is no parser anywhere on the server. That is not squeamishness — a parser in the refuse tier would be the worst possible place for one, and this corpus has already produced **six distinct wording families** for the six supposedly-universal advanced improvements (Phase 8 group 1 and group 2 each broke the previous group's "universal" check; one beat is absent entirely from The Forged; The Gumshoe and Hex print "*Make up* a second hunter"). Any parser strict enough to be trustworthy would already be wrong about this data.

### 4.4 The one place a heuristic is allowed

The advancement screen may pre-select `EffectKind` from the improvement's text — **client-side only, presentation only, always overridable, never persisted, never consulted by the server.** Scoped to three shapes whose wording is close to uniform across the corpus:

- `/^(get )?\+1 (charm|cool|sharp|tough|weird)/i` → that rating (146 lines)
- `/take another .* move/i` → `PlaybookMovePick` (56 lines)
- `/take a move from another playbook/i` → reveal the two-part foreign-move text fields (53 lines). **Not an `EffectKind` in HA-1** — there is no kind to pre-select, because free text replaced the allowance (4.2). In HA-2 the same match pre-selects `ForeignMovePick`.

That is ~49% of all printed lines pre-answered by about five lines of TypeScript. The boundary matters more than the heuristic: **if this ever moves server-side or gets persisted, the template has been typed by the back door** and 4.1's argument has been quietly reversed without anyone deciding to.

---

## 5. Validators — what breaks, and the shape of the generalization

### 5.1 One allowance object, two consumers

Do **not** scatter `+ sum(improvements…)` through `HunterService.Validate` and again through `HunterCompleteness.Evaluate`. This codebase has already been bitten by exactly that and wrote down the lesson (`architecture.md` Section 8, Follow-on 10b):

> *Both the refuse tier and the completeness tier now share one `BespokeEngagement` helper, because two implementations that drift could call the same hunter over its maximum and under its minimum at once.*

The identical hazard applies here, one level up. **Recommendation: a `HunterAllowance` value object, computed once from `(playbook, hunter.Improvements)` and read by both tiers** — the same shape and the same justification as `BespokeEngagement`, sitting beside it in `HunterCompleteness.cs` or its own file.

```
HunterAllowance.For(playbook, improvements) ->
  MovePicks            = playbook.MoveGrantCount + Σ PlaybookMovePick        -- HA-1
  Rating(stat)         = statArray[stat]      + Σ Rating{stat}               -- HA-1

  GearPickCount(cat)   = cat.PickCount        + Σ GearPick       where target == cat   -- HA-2
  MinSelect(section)   = section.MinSelect    + Σ BespokeSelect  where target == section
  MaxSelect(section)   = section.MaxSelect    + Σ BespokeSelect  where target == section
  MinInstances(sec)    = section.MinInstances + Σ BespokeInstance where target == sec
  MaxInstances(sec)    = section.MaxInstances + Σ BespokeInstance where target == sec
  ForeignMovePicks     = Σ ForeignMovePick                                             -- HA-2

  AdvancedMovePicks    = Σ AdvancedMovePick                                            -- HA-3
  HarmBoxes            = playbook.HarmBoxCount + Σ HarmBoxes                           -- HA-3
```

Every consumer that currently reads a playbook ceiling reads this instead. `GetByIdAsync` already fetches the playbook validation graph on every read, so this costs no additional round trip.

**Two things this shape has to get right, both easy to lose.** The bespoke bounds move **in pairs** — a `BespokeSelect` amount shifts `MinSelect` and `MaxSelect` together, which is what makes one signed field serve both growth and removal (4.2, 9.2). And **an effect whose `EffectTargetId` is not in the current playbook is skipped, not an error** (3.4), which is the one line that makes a future playbook switch survivable.

HA-1 only needs the first two rows. The rest are listed here because the object's *shape* should be settled once — adding a row later is a line; discovering later that both tiers grew their own copy is not.

### 5.2 Concrete changes in `HunterService.Validate`

| Today | Becomes | Still tier-1? |
|---|---|---|
| `move does not belong to playbook` → refuse | **unchanged in HA-1** — foreign moves are free text, so no `HunterMove` row is ever foreign (4.2). HA-2: foreign count `<= ForeignMovePicks` | **Yes** — still provably false when violated |
| `move.IsAdvanced` → refuse outright | advanced count `<= AdvancedMovePicks` | Yes |
| `chosenCount > MoveGrantCount` | `chosenCount > allowance.MovePicks` | Yes |
| `picked > category.PickCount` | `picked > allowance.GearPickCount(cat)` | Yes |
| bespoke `MaxSelect` / `MaxInstances` ceilings | the allowance equivalents | Yes |
| `CheckTrack("Harm", …, HarmBoxCount)` | `…, allowance.HarmBoxes` | Yes |
| *(nothing — ratings have no ceiling anywhere)* | still nothing; see Section 9 | n/a |

The `MoveGrantCount == 0` special case — *"0 is indistinguishable from an unauthored Moves section, so nothing may branch on it"* — must be preserved through the substitution. `0 + granted` must keep meaning "no stated ceiling", not "a ceiling of `granted`". Easy to lose in the edit; worth a test.

### 5.3 `HunterCompleteness` gets the same object, and one refusal

Minimums move with the allowance too, and that is correct: a hunter who took `Take another Chosen move` and has not yet spent it *should* read `Moves: 2 of 3 picked.` in `Outstanding`. Same substitution, same object.

**One thing that must not happen: "Experience is full — level up" does not belong in `Outstanding`.** Section 9 deliberately excluded Luck/Harm/Experience from completeness on the grounds that a missing value is indistinguishable from a real zero and no answer is being withheld. A full experience track is not a thing the hunter *owes its playbook*; it is an action that has become available. It belongs in the UI as an affordance (Section 7), not smeared into a list whose meaning is already settled. Predicting this because it is exactly the kind of thing a careful implementer adds without noticing the boundary they crossed.

### 5.4 The blocking one: `PlaybookService` must learn about improvements

`CheckRemovedChildrenAreUnusedAsync` refuses (`409`) any playbook edit that would delete a template row a hunter references. Its own doc comment names this feature as its extension point:

> *"Improvements, bespoke rows and journals stay freely removable because they still have no instance-side table; **this method is the place to extend when they get one**."*

`PlaybookImprovement` gets one here. *(Checked 2026-09-11: that comment is stale for bespoke rows and journals, which the method body already guards, journal fields included. Improvements remain the one kind it does not cover, which is what this subsection is about. Letting journal entries be edited on the sheet does not touch this template-side guard. The comment is worth correcting when improvements are added to the method.)* **Without this change, editing a playbook's improvements list silently deletes hunters' improvement history** — the precise loss the full-history decision was bought to prevent, arriving through a door nobody was watching. It is roughly eight lines (a kept-id set, a label `improvement "…"`, and the existing usage query), and it is not optional or deferrable.

---

## 6. Correcting mistakes, and undo

**Undo is a hard delete of one `HunterImprovement` row, and it is safe for a structural reason rather than a procedural one: every consequence of an improvement is derived, never stored.** Ratings, allowances, and the advanced-unlock threshold are all computed from the surviving rows on every read. Delete the row and the hunter is exactly, automatically, the hunter it was before — no compensating edit, no reversal record, nothing to get wrong.

**Corrected 2026-09-11: that last sentence holds only when nothing the improvement granted has been spent.** Ratings and allowances are derived. The move a player *picks* with a `PlaybookMovePick` allowance is not: it is an ordinary stored `HunterMove` row, and deleting the improvement leaves it in place. See the first bullet below, and OQ-8.

**Resolved 2026-09-11 (OQ-8): the grant is recorded, and removal takes it too.** `HunterMove.GrantedByPlaybookImprovementId` records which improvement granted a move. Removing the improvement removes exactly that move, and never one picked at creation. With that in place the sentence above is true again for moves: undo returns the hunter to what it was before the improvement was taken. HA-1.

**The exception is OQ-9's delete and swap improvements (HA-2).** Removing one restores its allowance, but it neither brings back a deleted pick nor reverts a swap: the deleted pick stays gone, and a swap-in pick stays, because a swap-in pick is never recorded as granted. See OQ-9.

Rows are **never edited in place**. Correcting a wrong effect is delete-then-re-add. That keeps the table append-only in shape (one row per event, written once) with no update path to reason about, and it means the only two verbs the UI needs are *take* and *remove*.

**Two consequences this does not clean up, deliberately:**

- Removing a `PlaybookMovePick` while the extra move is still picked leaves the hunter over its now-lower move allowance. That is a tier-1 violation, so it surfaces on the next save as a plain error. **As first written, the fix was "unpick a move". Since 2026-09-11 that is not available.** Creation picks are locked (Q5b), no edit route is planned, and nothing distinguishes the move the advancement granted from the moves chosen at creation — both are plain `HunterMove` rows. Worse, the next save is likely to be a Luck or Harm click on the read-only sheet, which Rosalina's design sends as a whole-hunter `PUT`. The hunter would be refused play-state marks until the improvement was re-taken. Not a dead end, since re-taking clears it, but a trap, and it is in HA-1. *(Later 2026-09-11: play-state clicks now go through `PATCH /hunters/{id}/state`, which skips the pick rules, so the refusal of Luck and Harm marks no longer happens. The hunter would still be refused on the next save that runs the rules — its next advancement, for one.)* **OQ-8** proposes making undo remove exactly what the improvement granted. **Resolved 2026-09-11: it does.** The trap described in this bullet does not exist in the decided design, because the granted move is removed in the same save as the improvement. The undo confirm should name the move that will go — "Removing this also removes the move it granted: *[move name]*" — as a statement, not a question, because there is nothing to choose. The exact copy is Rosalina's.
- A deleted row leaves no trace that it ever existed. **This is the one place my reading of "append-only" may be narrower than Skyler's** — see OQ-1. If a true tombstone is wanted it is one nullable `UndoneAt` column and a filter in the allowance query, cheap to add later; I am recommending against it because a single-user tool with a confirm dialog does not need to audit its own corrections, and every "why does this hunter have +2 Sharp" question is answered by the rows that *are* there.

---

## 7. API and Angular surface

### 7.1 API — extend the existing contract, add no endpoint

**Recommendation: `UpsertHunterRequest` gains an `Improvements` list; `HunterDetailResponse` gains `Improvements` and `Ratings`. No new controller, no new route, no sub-resource endpoint.**

```
HunterImprovementModel(
    Guid PlaybookImprovementId,
    DateTimeOffset TakenAt,
    HunterImprovementEffect? EffectKind,
    Guid? EffectTargetId,
    int EffectAmount,
    string? Note)

HunterDetailResponse += IReadOnlyList<HunterImprovementModel> Improvements
                     += HunterRatingsModel Ratings   // charm/cool/sharp/tough/weird, DERIVED
```

Why not a `POST /api/hunters/{id}/level-up` command endpoint, which is the obvious alternative for an action this distinct: *"one request carries the whole hunter, no sub-resource endpoints"* is a decision on file and is restated in four separate places (`HuntersController`, `HunterContracts`, `HunterService`, `PlaybookContracts`). Improvements are FK-bridge picks like the other five and reconcile through the existing `SyncKeyed` helper with a `(HunterId, PlaybookImprovementId)` key — the machinery is already written. The advancement screen still submits one `PUT`; it just happens to be a `PUT` whose diff is "one improvement added, experience reset to 0".

`HunterImprovementModel` also carries the two foreign-move text fields (4.2) — `ForeignMovePlaybook` and `ForeignMoveName`, both nullable, populated only for the 53 `Take a move from another playbook` lines. Two named fields rather than one because HA-2 has to migrate them into real `HunterMove` rows.

**How a granted move travels, following from OQ-8 (2026-09-11).** `HunterImprovementModel` also carries a nullable `GrantedPlaybookMoveId`: the move the player picked with this improvement's allowance. The server writes `HunterMove.GrantedByPlaybookImprovementId` from it. `PlaybookMoveIds` stays a plain list of ids, so the existing contract keeps its shape — the grant is a property of the improvement, not of the move list. When HA-2 turns foreign moves into real `HunterMove` rows, the same field records those grants too, with no further column.

**Play-state counters get their own endpoint — decided by Skyler 2026-09-11, and the first exception to this section's "add no endpoint".** He chose the option labelled **"Add PATCH /hunters/{id}/state"**; its description — option text, not his words — was *"A small endpoint for Luck, Harm, Experience and extra tracks only. Marking a box never runs the pick rules. It's the first exception to 'no sub-resource endpoints', and it's Bowser's work."* Its contract is Bowser's and is not defined here. What it means for this design:

- **Improvements still travel on the whole-hunter `PUT`, and this design keeps it that way.** An improvement is a rules-bearing change: it moves allowances, and it can carry a granted move or a swap. It needs exactly the full `Validate` pass the `PATCH` exists to skip — the reason the `PATCH` was added is the reason advancement must not use it. Section 10's rejection of a level-up command endpoint stands for the same reason.
- **The Experience reset rides in the same `PUT` as the improvement — recommended.** Taking an improvement and clearing experience should land together or not at all. Sent as a `PUT` plus a `PATCH`, a failure between the two leaves an improvement recorded with experience still full, or experience cleared with no improvement. During a backfill, where the reset is skipped, the `PUT` simply carries the current value. **Dependency for Bowser:** this needs the whole-hunter `PUT` to keep accepting `Experience` once the `PATCH` exists. If the `PUT` stops carrying the counters, the reset has to go through the `PATCH` and loses that atomicity. Worth settling when the endpoint is designed.
- **Scope of the exception: Hunter-side.** `open-questions.md` Q3 — no sub-resource endpoints — is about Playbook's child collections and is unaffected. The Hunter-side convention this departs from is `architecture.md` Section 8's "one request carries the whole hunter", restated in `HuntersController` and `HunterContracts`.
- **No name clash with anything in this doc.** API routes in this app carry the `api/` prefix, so the endpoint cannot collide with the client route `/hunters/:id/advancement`. "State" meant the same four kinds this doc calls play state; if Bowser widens the `PATCH` for labels and journals (below), the name covers more than that, which is his naming call.

**Widened later on 2026-09-11: Name, Pronouns and journal entries also save without the pick rules.** Skyler chose the option labelled **"A save that skips pick rules (Rosalina)"**; its description — option text, not his words — was *"Her lean. Name/Pronouns (and journal entries) save without running the pick rules, either through a widened PATCH or a sibling endpoint (Bowser's call). A rename can only fail because of the name itself. Journal saves still check their own fields."* Widened `PATCH` or sibling endpoint is Bowser's call and is not decided here. What it means for this design:

- **Advancement is now the whole-hunter `PUT`'s only post-creation use.** With no edit route, and counters, labels and journal entries all saved elsewhere, the `PUT` is left with the advancement screen taking an improvement — with its granted move, any OQ-9 change and the Experience reset — and the sheet removing one. The save that runs the pick rules and the save that changes them are now the same save.
- **The first bullet above is unchanged, and stronger.** Improvements stay on the `PUT` for the same reason labels and journals leave it: the `PUT` is where the pick rules run.
- **The dependency for Bowser widens.** The more fields that save elsewhere, the more a stale advancement `PUT` from another tab can overwrite a newer rename, journal edit or counter — the single-user clobber risk already accepted above, now covering more fields. Whether the `PUT` stops carrying fields that have their own save is Bowser's contract. This design needs it to carry improvements, their grants, the picks they change, and `Experience`.

**Trade-off accepted, stated plainly:** the server cannot distinguish an advancement from an ordinary edit, so nothing server-side can enforce "one improvement per five experience," and two browser tabs could clobber each other. Both are already true of every other field on this form, and there is one user. **Skyler's answer is to constrain this in the flow instead** (7.2, 9.5) — which is the right place for it, and worth being precise about what it buys: the screen limits how many improvements one visit can add, not whether the experience was earned. If server-side atomicity ever matters, a command endpoint is the answer and this is the decision to revisit.

`Ratings` is a genuine addition to the read model, not a convenience: **there is currently nowhere in the API, the models, or the UI where a hunter's actual Charm/Cool/Sharp/Tough/Weird is a number.** The form shows the five *arrays* as radio options and stops there.

### 7.2 Angular — a dedicated advancement screen, and a section on the detail page

**Decided (OQ-2): `/hunters/:id/advancement` as its own route, not a section bolted onto the edit form.** Skyler's own word for it is *advancement*, and this doc follows him rather than the rulebook's "level up" — the screen is used for backfilling as well as for actual level-ups, so the narrower name would have been wrong for half its traffic.

This is a departure from `architecture.md` Section 8, which rejected a second navigation step for hunter *creation*, so it needs its reason stated rather than assumed. Section 8's argument was that creation is one submit with no ordering dependency, and that hiding half of it behind a step would be the "silently reveal more UI after a hidden intermediate step" pattern the standalone-creation initiative already rejected. Neither applies here:

- **It is a different act with a different cadence.** Creating a hunter happens once. Leveling up happens after a session, deliberately, with a rulebook open — the usage moment Skyler described. A focused screen with room to read the full improvement text is what that moment wants.
- **The edit form is already at its limit.** `hunter-form.ts` is 778 lines and its template 477, covering ratings, moves, gear, looks, tracks, bespoke trees and journals. An improvement picker with a per-line effect editor is the thing that tips it, and Luigi's own decomposition record already treats "one page, several pickable sections, one submit" as having a ceiling.

**The flow, at the level Rosalina can react to:**

1. **Hunter detail page** gains an *Advancement* block: `Level 3 · 3 improvements taken`, the ordered list of improvements with their date, what each did (`Sharp +1`), and any note; plus a remove control per row. An **Advance** action, prominent when `experience === experienceBoxCount` and quietly available otherwise (Skyler will be backfilling hunters whose experience he never tracked — the action must not be gated on it).
2. **Advancement screen** shows the two printed lists as they appear on the sheet. Already-taken lines are visibly ticked and unselectable — that alone is a large part of the value, since the physical sheet's whole mechanism is "mark them off as you take them." The **advanced list is visibly present but locked below 5 level-ups**. Its explanatory line has to be written by us rather than quoted: the source's own sentence is missing from all 28 stored `LevelingUpText` values and Skyler has declined to add it (1.2).
3. **After the pick**, a small "what did this do?" step — shown *only* for lines whose kind isn't `null`, pre-selected by the 4.4 heuristic where it applies. A date (defaulting to today, editable) and an optional note.
4. **Confirm**, with the consequence in the button's own label: *"Take this improvement and clear 5 experience."*

**One improvement per trip through this screen — decided by Skyler 2026-09-10.** The flow allows exactly one improvement per visit and clears experience on confirm; taking two means going round again. **What this constrains is cardinality, not cost.** It cannot check that five experience were actually earned, because the API cannot distinguish a level-up from an ordinary edit (7.1) and because a backfilled hunter never had its experience tracked in the first place. Worth stating in those words so nobody later reads the screen as validating the experience track. Skyler's own note on the trade-off, accepted as his call: *"This has a downside of making back-filling a bit more onerous, but it's minor and keeps the advancement flow cleaner."*

**One detail this hands to Rosalina rather than settling:** clearing experience is right after a real level-up and wrong during a backfill, where it would erase marks the hunter legitimately holds. The cheapest honest shape is for the confirm step to *show* the reset and let it be skipped when experience is below full — but exactly how that reads is hers.

**The workflow risk, named for Rosalina rather than solved here:** step 3 is where this design can fail as a *product* even if it is right as a *model*. "Which rating?" is a natural question. "Which bespoke section does `Take another Rote.` raise?" is not a question a person wants at 11pm on a Sunday. Two things soften it and both are hers to judge: the escape hatch (**"just record it"** must be a first-class, one-click answer on every line, not a fallback buried behind a "no effect" option), and the wording — the step should read as *"anything I should change on the sheet?"* rather than as configuration.

**Decided against, 2026-09-10:** an improvement count badge on the hunter *list* rows. It is cheap here in a way `Outstanding` was not (a `COUNT`, not the full template graph), so Section 9's cost argument never applied — but Skyler answered OQ-5 directly: *"No, advancement count does not belong on the list page at all."* Not Rosalina's to reopen.

---

## 8. Phasing

| | Scope | Corpus covered | Why this order |
|---|---|---:|---|
| **HA-1** | `HunterImprovement` table + migration; `HunterMove.GrantedByPlaybookImprovementId`, so undo removes exactly the granted move (OQ-8); the `PlaybookService` guard (5.4); `HunterAllowance`; the six no-target effect kinds; derived `Ratings` on the response; the two-field foreign-move text capture; detail-page Advancement block; advancement screen | **100% recorded, 49% mechanically applied** | Delivers the whole feature for the 41% of lines that need nothing more, plus the two commonest mechanical kinds and free-text capture for the third. Nothing after this is required for the feature to be useful. |
| **HA-1b** | `HunterAdvancedBasicMove` bridge (9.3) — **gated on `basic_moves` having content and a `GET`** | +11% | Independent of everything else here, and the gate is Skyler's own separate work. Slots in wherever that lands; does not hold HA-1 up. |
| **HA-2** | `GearPick` / `BespokeSelect` / `BespokeInstance` with signed amounts and a section picker; the OQ-9 secondary pick, letting a removal or swap improvement change the pick it names in the same save; `GrantedByPlaybookImprovementId` on `HunterBespokeSelection` and `HunterBespokeSectionInstance`, excluding swap-in picks; `ForeignMovePick` + a real cross-playbook move picker, migrating HA-1's recorded text | +15% | Needs UI HA-1 doesn't (choosing a section, browsing 27 playbooks, choosing the pick an improvement removes), and closes the stale-`Outstanding` problem (9.2) as a side effect rather than as its own work. |
| **HA-3** | `AdvancedMovePick` (The Hex), `HarmBoxes` (The Gumshoe) | +0.4% | Two enum members, one line of corpus each. |

HA-1 alone is a coherent shipped feature. Everything after it is a strict addition with no rework — that is the property worth checking, and the design has it because the effect vocabulary is an open enum on the instance side, not a schema commitment. **The one migration anywhere in this plan is HA-2's**, turning HA-1's recorded foreign-move text into `HunterMove` rows, and 4.2 says how to make that cheap.

**The grant column extends to bespoke picks in HA-2 — decided by Skyler 2026-09-11.** *(First recorded here as unconfirmed, because OQ-8's option described moves only.)* HA-2's bespoke grants — a `BespokeSelect` or `BespokeInstance` allowance spent on an option or an entry — have the same undo problem, and the same mechanism solves it: `GrantedByPlaybookImprovementId` on `HunterBespokeSelection` and on `HunterBespokeSectionInstance`. The question put to him: *"You chose to record which move an improvement granted, so removing the improvement removes that move. HA-2 has improvements that grant bespoke picks instead, like 'Take another Rote', and they have the same undo problem. Should the same recording apply to those?"* He chose the option labelled **"Yes, same rule for bespoke picks"**; its description — option text, not his words — was *"The same column on the two bespoke pick tables, so removing the improvement removes exactly what it granted. Per Rosalina, picks swapped in by a change-a-pick improvement are excluded, so removal never leaves a section short."* **Rosalina's swap exclusion, directly below, is part of the decision** rather than a caveat on it.

**The swap exclusion, raised by Rosalina (2026-09-11) — part of the decision above.** An OQ-9 *swap* improvement removes one creation pick and puts a new one in its place. **The new pick must not be recorded as granted by that improvement.** If it were, removing the improvement would delete the new pick, still could not restore the old one (removal leaves no trace), and would leave the section a pick short with no way to re-pick under Q5b. So the column records only *allowance-type* grants — a pick or entry spent from an allowance the improvement added, such as `Take another Rote.` or `Take another Combat Magic pick.` Swap-in picks carry no grant and stay when the improvement is removed. Rosalina's swap confirm copy in her doc already assumes this (*"Your Task stays as it is now"*).

**Known risks — check these early in HA-1, before anything is built on them.**

- **The composite foreign key has not been prototyped.** `HunterMove.GrantedByPlaybookImprovementId` would reference `HunterImprovement`'s composite key `(HunterId, PlaybookImprovementId)` through `(HunterId, GrantedByPlaybookImprovementId)`, with cascade delete. The provider is PostgreSQL, whose default `MATCH SIMPLE` does not check a foreign key when any of its columns is null — which is what every creation-picked move needs. It is expected to work, but it is unverified, and it should be the first thing HA-1 builds and migrates. One specific trap to check: the delete action must be cascade, not set-null. On a composite key, PostgreSQL's set-null nulls every referencing column by default, including `HunterId`, which is part of `HunterMove`'s primary key.
- **EF Core may contradict the cascade in memory.** `HunterService.ApplyPicks` rebuilds the move set from the request's `PlaybookMoveIds`, and `architecture.md` Section 8 records a real trap on this exact table: navigation fixup silently restored a removed `HunterMove`, fixed by an explicit `RemoveRange`. If a client removes an improvement but still sends the granted move's id, the database cascade and the service's own reconciliation disagree about whether the move exists. **Recommendation:** the service removes granted moves explicitly when their improvement is removed, whatever `PlaybookMoveIds` says, following the existing `RemoveRange` idiom. The database cascade is then a backstop rather than the mechanism. Needs a test either way.
- **Both risks carry into HA-2's two bespoke tables (decided 2026-09-11).** The composite foreign key has the same shape, and set-null would null a non-nullable `HunterId` there too. `ApplyBespoke` reconciles selections and instances with the same kind of keyed sync, so the explicit-removal recommendation applies there as well. Checking the mechanism once, early in HA-1, covers both.
- **A granted move's own section answers must leave with it (added 2026-09-11).** Eight moves in the corpus are both grantable — not required, so `Take another [Playbook] move` can grant them — and carry a section of their own: the Changeling's *Force of Nature*, the Crooked's *Artifact* and *Deal with the Devil*, the Professional's *Mobility*, the Searcher's *Guardian* and *Network*, the Spell-Slinger's *Arcane Reputation*, and the Visitor's *Something Strange*. A hunter who spends an allowance on one then answers that section. Removing the improvement removes the move (OQ-8), but nothing links the answers to it — neither the grant column nor the cascade reaches them. `ValidateSelectionScope` already refused answers for a move the hunter does not hold, and the `ValidateBespoke` fix of 2026-09-11 now refuses entries too, so a removal that leaves them behind is refused outright. **Requirement:** the granted move and its section answers leave in the same save, and validation sees the state after they have gone. This constrains the explicit-removal recommendation above: if the service removes granted moves itself, it must remove their answers too, before validating, because `Validate` reads the request as sent. Whether the client omits them or the service strips them is an implementation choice.

---

## 9. Limitations and loose ends — revised 2026-09-10 against Skyler's four questions

Skyler asked about four of the five bullets this section originally carried. Two are now decisions rather than limitations, one was a mistake of mine, and one becomes a research item. Each is written out below rather than left as a line.

### 9.1 Rating maxima are unenforced — and never were enforced, including at creation

`max +2` vs `max +3` lives inside untyped `PlaybookImprovement.Text` and varies per line and per playbook (The Crooked caps some stats at +2 where The Chosen caps all five at +3). Nothing in the app will stop a hunter reaching Sharp +5. Skyler accepted this for advancement and asked: *"To be clear: this will still be enforced during creation, correct?"*

**No — and it never has been, because at creation there is nothing to enforce.** `Hunter` has no `Charm`/`Cool`/`Sharp`/`Tough`/`Weird` columns at all; ratings come solely from `Hunter.PlaybookStatArrayOptionId`, an FK to a preset `PlaybookStatArrayOption` row. `HunterService.Validate`'s only rating rule is *"Rating array X does not belong to playbook Y"* — an ownership check, not a bounds check. You cannot type a number at creation, so you cannot type an illegal one; the printed arrays are legal by authoring. **Advancement's rating boosts are the first mechanism in this application capable of producing a rating the playbook never printed**, which is why the ceiling question only appears now. There is no existing guarantee being relaxed here, and no regression against creation to worry about.

Worth knowing for a future reading of the rules: the rulebook's cap is absolute, not incremental — *"If your rating is already at (or above) the listed maximum, then don't select this improvement."* So the cap applies to the **total**, array included, and a hunter whose array already starts at the cap simply cannot take that line. That is exactly the judgement the printed text next to the checkbox is asking a human to make, and it is why 4.1's argument against parsing it holds.

### 9.2 Removal improvements — my earlier bullet was wrong, and the fix is free in HA-2

Skyler asked two things: what the conflict means in use, and whether such a hunter can be saved.

**It is never a save failure. The hunter saves, always.** `HunterCompleteness`'s own doc comment is unambiguous — *"Nothing in here ever rejects a save"* — and minimums live there by construction (`architecture.md` Section 9). Removal improvements only ever *lower* a count, and every tier-one rule is a ceiling or an ownership check, so a removal cannot trip one. The entire cost is **cosmetic**: a line in the hunter's "Still to finish" panel — *"Fate: 2 of 3 picked."* — that describes a requirement the rules just removed and that will never clear. Nothing is blocked, nothing is lost, and the sheet is correct; only the advice about it is stale. Verified against the sharpest available case, the Spell-Slinger's `You may cross off another option from your Tools and Techniques` (modelled as `MinSelect = MaxSelect = 3` with the *kept* options selected): dropping to 2 leaves `MaxSelect` satisfied and `MinSelect` short — reported, not refused.

**Skyler's instinct that a custom validator "may not be worth it" is right, but his reason is not the binding one, and my own stated reason was wrong.** He assumed the fix needs "more definitive typing" that isn't in the proposal. In fact HA-2 already carries exactly the typing required — `BespokeSelect` with a `BespokeSection` target and a signed `EffectAmount`. What I got wrong was claiming the fix could not work: I wrote that lowering `MinSelect` would fix the report while lowering `MaxSelect` would refuse the hunter's existing picks. **That is only true if the amount shifts one bound. If it shifts both — which is the obvious reading I failed to consider — the problem disappears**, because the hunter has *already removed* the pick the improvement told them to remove. `-1` takes a 3/3 section to 2/2 against a hunter holding 2. Both bounds satisfied, no stale line, no new enum member, no refusal.

The one transient it creates is the correct one: a user who ticks the improvement *before* removing the pick is momentarily at 3 picks against a maximum of 2, gets a plain tier-one error, and fixes it by removing the pick — which is what the improvement instructed. That is Section 9's own guarantee (*every tier-one violation is fixable by removing something*) doing its job, not a defect.

**Status 2026-09-11 — recoverable again, but not the way this paragraph describes.** Under the no-undo reading raised in 13.2, this transient had no way out: a user who ticked the improvement first could neither untick it nor edit the pick. With improvements removable (13.2, resolved), **the user is never stuck** — removing the improvement clears the error, so Section 9's guarantee holds with the improvement as the removed thing. What does *not* come back is the fix written above, "removing the pick". A Doom tag is a creation pick, and Q5b still locks those. Under the narrow reading, a removal improvement can be recorded and undone but never actually carried out. The obvious answer is for the advancement screen to remove the chosen pick as the improvement's own secondary pick, in the same `PUT`, so this transient never occurs at all. That goes beyond what Skyler decided, so it is **OQ-9**, not an assumption. HA-2 scope; HA-1 is unaffected.

**Resolved 2026-09-11 (OQ-9): the advancement screen carries out the removal.** A removal or swap improvement removes or swaps the pick it names as its own secondary pick, saved together with the improvement. Nothing else is unlocked. So the transient above never occurs — the improvement and its removal land in the same save — and the Doom tag is actually gone rather than merely reported short. The cost, accepted knowingly: because removal leaves no trace, undoing such an improvement cannot bring back the pick it removed. For a swap, undoing it also leaves the new pick in place, since a swap-in pick is never recorded as granted (OQ-9, after a point from Rosalina). Undo restores the allowance, not the pick. HA-2.

**So: accepted as a cosmetic wart in HA-1, closed for free in HA-2.** No custom validator, no template typing, no separate work item.

### 9.3 `Mark two of the basic moves as advanced` — the table Skyler is planning already exists

Skyler wrote: *"I have been planning to add the basic moves as a static table so they can be represented in the UI; once that's complete, this can easily be accomplished by a bridge table, a basic move Id, a hunter Id, and an 'isAdvanced' field."*

**The static table is already there.** `BasicMove` was decided as a real reference table on 2026-08-25 (`open-questions.md` Q2) and built during Phase 2. Concretely, as of this pass:

| | State |
|---|---|
| Entity | `BasicMove (Id, Name, DescriptionText, SortOrder)` — `PlaybookEntities.cs` |
| Table | `basic_moves`, created by migration `AddHunterPlaybooks` |
| `DbSet` | `MotwDbContext.BasicMoves`, configured with `ValueGeneratedNever()` |
| Contract | `BasicMoveResponse` exists in `PlaybookContracts.cs` — **and is referenced by nothing** |
| Endpoint | **None.** `ReferenceController` has seven routes; basic moves is not one of them |
| Seed | **None.** `SeedLookupTablesAsync` seeds seven lookup tables; `BasicMoves` is not among them |
| Frontend | **No reference anywhere** |

So the remaining work is **content plus a `GET`, not a schema decision** — the eight rows and one reference endpoint, which is a smaller job than "add a static table" implies. Flagging it because Skyler may be about to build something that is half-built already, and because a `BasicMoveResponse` record that nothing uses is easy to walk past.

**On the bridge shape, one correction: drop the `IsAdvanced` field.** The bridge would exist for exactly one reason — recording that a hunter marked a basic move as advanced. All eight basic moves belong to every hunter unconditionally, so there is no other fact a row could carry, and an `IsAdvanced = false` row would be indistinguishable from no row at all. That is precisely the argument `HunterCompleteness` already makes about extra tracks (*"a missing row is indistinguishable from one holding 0"*). **Recommended: `HunterAdvancedBasicMove (HunterId, BasicMoveId)`, composite key, no columns** — the row's existence is the fact, and the composite key makes double-marking impossible for free, matching the four bridges already in `HunterEntities.cs`.

**This is HA-1b (Section 8): independent of the rest of this design, gated on `basic_moves` having content and an endpoint, and it does not hold HA-1 up.** It is worth checking that gate before advancement work starts, because if Skyler lands the seed and endpoint first, 56 lines of corpus — the second most common advanced improvement — go from note-only to structured for about a day's work.

### 9.4 Cross-playbook imports — research item, and it is not the same thing as foreign moves

Skyler wrote: *"This feels like it should be doable with a bridge table that connects a hunter Id to a playbook move… Some playbook specific moves require engines and mechanics which only exist for that playbook, which could get messy."*

**His concern is exactly right and is aimed at the wrong target — there are two different problems here and they have different answers.**

- **Taking a *move* from another playbook** (53 lines) is the one his bridge describes, and it needs **no new table at all**: `HunterMove.PlaybookMoveId` is an FK to `PlaybookMove` globally, with no constraint tying it to the hunter's own playbook. The row already stores. Only `HunterService.Validate` refuses it. **Settled by QQ-6** — free text in HA-1, the real picker plus `ForeignMovePick` in HA-2 (4.2).
- **Importing another playbook's *structure*** (10 lines) is what this bullet was always about, and a move bridge does not touch it. `Get a haven, like the Expert has, with two options` means a hunter holding bespoke answers against a `BespokeSection` belonging to a playbook that is not theirs — which `HunterBespokeSelection` cannot express, because `Validate` scopes every selection to the hunter's own playbook's sections.

**And his "engines and mechanics" worry bites harder on the second than the first.** A borrowed *move* is mostly self-contained prose. A borrowed *section* is not: the Expert's haven options are meaningful only in terms of the Expert's own moves, so importing the section without the moves imports a list of labels whose rules live somewhere the hunter cannot reach. The Changeling's `You find a home` is the worst case in the corpus — one improvement whose three internal options each import a *different* playbook's structure (the Professional's Agency, the Initiate's Sect, the Expert's haven), with per-import counts.

**Recorded as needing research before a shape is settled, not as a deferred implementation.** It is not a blocker for HA-1 or HA-2: `Note` carries it meanwhile, which is the same answer as the other 41% of lines. The question research has to answer is narrow and worth writing down now — *does an imported section come with the moves that give it meaning, or is it a labelled list the player interprets themselves?* — because that is the fork, and it is a rules question before it is a schema one.

### 9.5 One improvement per advancement — now a client-side constraint

Originally listed as "nothing enforces one improvement per five experience, by construction." **Skyler decided the constraint belongs in the flow**, and it does: the advancement screen allows exactly one improvement per visit. Full reasoning and its limits are in 7.2 — in short, the screen constrains **cardinality**, not **cost**, because nothing can verify that five experience were genuinely earned. The backfilling friction is accepted as his call.

---

## 10. Rejected alternatives

**Type `PlaybookImprovement` — add `Kind`/`Target` columns to the template.** Rejected. Section 4.1 has the argument in full; the short version is that the sheet under-determines the effect for 255 of 525 lines *by design*, so a per-hunter effect record is needed either way; typing the template buys only a pre-filled default, costs a 525-row re-authoring pass over data that took four groups and eleven found errors to verify, and has no correct value for The Hex's `Take another Hex move, or an additional Rote.`

**Snapshot the hunter's sheet at level-up.** Rejected — head-on contradiction of `open-questions.md` Q4's live-link decision, and it would make a playbook correction stop reaching leveled hunters, which is the opposite of what Skyler asked for there.

**Store the derived ratings as five columns on `Hunter`.** Rejected. A stored projection of the improvement rows can drift from them, and an undo would have to remember to compensate. Sections 6.4 and 9 both already established "derived, never stored" for this exact shape; making the *third* such case the one that breaks the pattern would be the wrong place to stop.

**Two tables — current picks plus a separate audit log.** Rejected as the more complex reading of the full-history brief (3.2). The sheet's checkbox column is already both.

**A `POST /api/hunters/{id}/level-up` command endpoint.** Rejected against the no-sub-resource-endpoints decision (7.1), with the condition under which it should be revisited stated there. *(2026-09-11: Skyler has since made Hunter-side exceptions for saves that skip the pick rules — `PATCH /hunters/{id}/state` for the play counters, and Name, Pronouns and journal entries through a widened `PATCH` or a sibling endpoint. They do not reopen this: those saves exist to skip the pick rules, and advancement needs them. See 7.1.)*

**Demote every playbook-derived ceiling from refuse to report once a hunter has any improvements — no effect model at all.** Rejected, but recorded fairly because it is genuinely the smallest possible design and someone will propose it. It needs zero enum, zero target, zero UI step: one improvement taken and the hunter's ceilings simply stop being enforced. It fails on two counts. It removes the validators' teeth for exactly the hunters most likely to have accumulated errors — the old ones — which inverts Skyler's own framing ("the validators in place help hunter creation, I would *also* like to support hunters growing"). And it cannot answer *"why does this hunter have +2 Sharp"*, which is the thing the history table was chosen for in the first place; without a structured effect, that question is only answerable by reading English.

**Parse improvement text on the server at save time.** Rejected. Brittle across six wording families already confirmed in this corpus, and it would put a parser in the refuse tier — the one place where being wrong costs the user their work.

---

## 11. Interaction with existing decisions — a checklist

| Prior decision | Effect |
|---|---|
| Hunters live-linked, never snapshotted (Q4) | **Reinforced.** Improvements are FK bridges to `PlaybookImprovement` rows, like every other hunter-side pick. |
| `PlaybookImprovement` flat and untyped (§2) | **Honored, with a stronger argument than the original** (4.1). No change to the table. |
| Partial hunters savable; minimums reported (§9) | **Extended, not amended.** The refuse/report line is unchanged; what "false about the playbook" is computed against changes. |
| One request carries the whole hunter (§8) | **Honored by this design** — improvements, and the Experience reset that goes with them, travel on the whole-hunter `PUT` (7.1). **Skyler made Hunter-side exceptions on 2026-09-11 for saves that skip the pick rules:** `PATCH /hunters/{id}/state` for Luck, Harm, Experience and extra tracks, and Name, Pronouns and journal entries through a widened `PATCH` or a sibling endpoint — Bowser's call either way. After both, the `PUT`'s only post-creation use is advancement. `open-questions.md` Q3 is Playbook-side and unaffected. |
| Single-page form, no wizard (§8) | **Departed from, with reasons** (7.2), and confirmed by Skyler at OQ-2. Advancement is a separate act, not a hidden step of creation. |
| `BespokeEngagement` shared by both tiers (10b) | **Reused as precedent** for `HunterAllowance` (5.1). |
| `MoveGrantCount == 0` means "unauthored" (§3) | **Must survive the substitution** (5.2). Test it. |
| `CheckRemovedChildrenAreUnusedAsync` extension point | **Consumed.** Blocking (5.4). |
| `BasicMove` is a real reference table (`open-questions.md` Q2) | **Already built and still empty.** Table, `DbSet` and response contract exist; rows, endpoint and UI do not (9.3). |

---

## 12. Where this paints into a corner if the end-game comes back

Required by the brief, since the end-game is 92 of 525 lines and is currently record-only.

- **`Change this hunter to a new type` (~25 lines).** The API already accepts a changed `PlaybookId`; the form locks it. Under this design the hunter's existing `HunterImprovement` rows keep pointing at the *old* playbook's rows — nothing is lost, because the FK is `Restrict`. Effects survive too, since kinds are playbook-independent except `GearPick`/`BespokeSelect`/`BespokeInstance`, whose targets would dangle. **This is already handled**: 3.4's "ignore effects whose target isn't in the current playbook" rule turns the switch into a non-event rather than a crash. Cheap insurance, worth taking in HA-1 even though nothing needs it yet.
- **`Retire this hunter to safety` (~27 lines).** A `RetiredAt` column on `Hunter` plus a list filter. Purely additive; nothing here blocks it.
- **`Create a second hunter to play as well as this one` (~24 lines).** A self-referencing `Hunter` FK. Purely additive.
- **The one real corner is the composite key** (3.1). If the end-game — or a houserule — ever needs one printed line recorded twice for one hunter, that is a migration, not a code change. It is the single thing about this design that is not additively extensible, and it is being accepted in exchange for the rulebook's own "each can only be selected once" being enforced by the database rather than by remembering to check.

---

## 13. Reconciliation with `hunter-display-design.md` (Rosalina, 2026-09-03)

Rosalina's hunter-display pass landed in parallel with this one and overlaps it in four places. Three reconciled cleanly. The fourth was a real contradiction only Skyler could settle. **He settled it on 2026-09-11 (13.2), and nothing in this document is now blocked.**

### 13.1 The route agrees

She specifies `/hunters/:id/advancement`, attributed to Skyler directly, and leaves its shape to this doc. That is the same route 7.2 now names. No conflict.

### 13.2 Can a recorded improvement be removed at all? — RESOLVED 2026-09-11: yes

**RESOLVED 2026-09-11: QQ-1 governs; recorded improvements are removable.** The coordinator put the conflict to Skyler directly — *"Your QQ-1 (hard delete) and your Q5b to Rosalina (hunters can't be adjusted after the fact) conflict. Which governs?"* — and he chose the option labelled *"QQ-1 — improvements are removable (Yoshi's rec)"*. He said nothing further, and nothing about the rest of Q5b. **So this doc designs to the narrow reading and only that:** creation picks stay locked, as Q5b says; advancement picks can be undone by hard delete with no trace, as QQ-1 says. It does not bring back a general edit route. The remove control on each Advancement row (7.2 step 1) stands. Where the design needs more than that reading grants, it is raised as an open question (OQ-8, OQ-9) rather than assumed — both since resolved, the same day. The original analysis is kept below as the record.

**The two documents disagree, and both are quoting Skyler.**

- **This doc, OQ-1, 2026-09-10:** *"Hard delete, no trace."* Asked specifically about undoing an improvement; the answer describes *how* removal works, which presumes removal exists. Section 6 builds on it, and 7.2 step 1 puts a remove control on each row of the Advancement block.
- **Her doc, Q5b, 2026-09-03:** *"the ability to edit a hunter is a mistake… Hunter creation is a one-way exercise that cannot be adjusted after the fact."* From which she drew the reasonable inference that a per-improvement undo control is dropped and *"the block is now a log, not a list of removable picks"* — and then carried the consequence forward as *"a mis-recorded advancement has no fix path either, which pushes a confirm step onto the advancement form."*

**My read, offered as a recommendation and not acted on:** OQ-1 governs. It is a week later, it was asked about improvements specifically rather than about hunter editing in general, and "hard delete, no trace" is a strange answer to give about a thing that cannot be deleted. Her Q5b quote is about *creation* data — the picks and text that make the character — and she already carves play state out of it on the same reasoning; advancement is her own category 2, separate from both.

**But I will not resolve a stakeholder's words against a stakeholder's words on my own authority, and the two readings build different screens** — one has a remove control per improvement, the other does not. Skyler should say which. Noting also that under the no-undo reading, 9.2's self-correcting transient stops being self-correcting: a user who ticks an improvement before removing the pick it tells them to remove would have no way back.

*(2026-09-11: the no-undo reading was not chosen, so this no longer applies — the transient is recoverable by removing the improvement. 9.2's status note sets out what comes back and what does not.)*

### 13.3 OQ-5 — her answer is superseded, and she should know

Her doc closes with *"`hunter-advancement-ideation.md` OQ-5 (improvement count on the hunters list) was left to me. **Yes** — a `Level n` chip beside the existing playbook badge."* That was correct when written: OQ-5 was explicitly left to her. **Skyler then answered it himself on 2026-09-10: *"No, advancement count does not belong on the list page at all."*** His answer is later and direct, so it governs, and 7.2 records it that way. Flagged here rather than left for her to discover, since her own record still reads as an open recommendation.

### 13.4 One of her corrected premises is itself wrong, and it matters here

She lists as a corrected premise: *"Move-internal bespoke picks are unexercised. Schema and form both support them, but all 207 moves in the shipped seed carry `bespokeSections: []`."*

**Counted from the same seed: 220 moves, of which 13 carry a non-empty `bespokeSections`** — the Changeling's Force of Nature, the Crooked's Artifact and Deal with the Devil, the Forged's Partner, the Gumshoe's Naked City, the Host's Defensive Adaptation, the Professional's Mobility, the Searcher's First Encounter / Guardian / Network, the Spell-Slinger's Tools and Techniques / Arcane Reputation, and the Visitor's Something Strange. They are authored, and they are 13 of the 49 sections whose total she and `architecture.md` Section 9 both cite. ~~Her *repeatable-section* correction is right and I have adopted it (4.2): exactly one section corpus-wide is repeatable, The Hex's Rotes.~~ **Corrected 2026-09-11: that correction was wrong too, and I adopted it without checking.** Three sections are repeatable — the Hex's *Rotes*, plus the Searcher's *Network* and the Spell-Slinger's *Arcane Reputation*, both inside moves. I missed the two move-level ones with a playbook-level-only scan, which is exactly the blind spot this subsection faults. Rosalina caught it in her own reconciliation pass. Consequences are in 4.2's dated note.

This is not a nitpick about her doc — it lands on both designs. Her read-only sheet would render no move-internal content for the nine playbooks that have it, and **the HA-2 target picker would omit exactly the sections three improvements are aimed at** (4.2). Worth checking how she arrived at 207/0, because whatever produced it will produce it again.

### 13.5 No edit route has a consequence for this design

She recommends `/hunters/:id/edit` cease to exist, with `/hunters/:id` becoming a read-only sheet. If that lands, **Section 6's assumption that an over-allowance is "fixable by unpicking a move" needs somewhere to do the unpicking**, and so does 9.2's transient. Not an objection — her argument is sound and Skyler has confirmed the split — but the advancement screen may end up owning the small corrective interactions that the edit form used to absorb. That is a shape question for her flow pass, raised here so it is not discovered during implementation.

**2026-09-11:** with improvements removable and creation picks still locked, the corrective interactions do land on the advancement screen — and they are narrower than this paragraph feared. No general unpicking is needed if undo removes what the improvement granted (OQ-8) and a removal improvement carries out its own removal (OQ-9). Both were Skyler's questions, not flow decisions for Rosalina, and he resolved both the same day with the recommended design.

**Settled 2026-09-11: there is no edit route.** Asked what editing after creation should allow, Skyler chose the option labelled **"No edit route; Name/Pronouns editable (Rosalina)"**; its description — option text, not his words — was *"Her recommendation. No edit form. Name and Pronouns can be changed on the sheet because they're labels with no rules attached. The creation wizard also ends with a full review screen before saving."* The dependency this subsection raised is settled the way it assumed, and nothing in this design changes: creation picks were already treated as locked, and every corrective interaction advancement needs lives on the advancement screen (OQ-8, OQ-9) or in removing an improvement.

**Resolved 2026-09-11 (Rosalina's Q7) — was open for Bowser and Rosalina.** Name and Pronouns, and journal entries, which Skyler made editable on the sheet, save without running the pick rules, through a widened `PATCH` or a sibling endpoint — Bowser's call. A rename can now only fail because of the name itself. It does not affect advancement, apart from leaving advancement as the whole-hunter `PUT`'s only post-creation use (7.1). The consideration as first written: `architecture.md` Section 9's founding argument was that a hunter must never be unable to fix a typo in its name because some unrelated rule fails. The whole-hunter `PUT` runs every rule — the same reason the `PATCH` was added for counters — so routing Name/Pronouns through the `PUT` would bring that case back.

---

## Open questions — OQ-1 to OQ-7 resolved 2026-09-10; OQ-8 and OQ-9 opened and resolved 2026-09-11

**OQ-1 to OQ-7 answered by Skyler.** Each entry keeps the question as originally asked, so the record shows what was decided against, not only what was decided. Where an answer changed the design rather than confirming it, the change is named and linked.

**The blocking question raised by Rosalina's parallel pass — 13.2, whether improvements can be removed at all — was resolved on 2026-09-11: they can.** It was never numbered here because it was a disagreement between two of Skyler's own answers rather than a question of mine. Designing to the narrow reading of that resolution raised two new questions, **OQ-8** and **OQ-9**, at the end of this list. Both were answered later the same day. **No numbered question in this document is open**; 9.4's research item remains, and blocks nothing.

**OQ-1 — RESOLVED: hard delete, no trace. Briefly reopened by 13.2 on a different axis — *whether* removal exists at all — and confirmed on 2026-09-11: it does.**
*Asked: does "append-only" mean a removed improvement leaves a trace?* The design makes undo a hard delete, safe because every consequence is recomputed from the surviving rows (Section 6); the alternative was a nullable `UndoneAt` tombstone. Recommendation was hard delete, flagged specifically because "append-only" was Skyler's word and my reading of it might have been narrower than his. **Skyler: "Hard delete, no trace."** The narrower reading was right. `UndoneAt` remains a one-column addition if it ever matters. No design change.

**OQ-2 — RESOLVED: separate advancement screen.**
*Asked: a separate `/hunters/:id/level-up` screen, or a section of the existing hunter edit form?* Recommendation was separate — a different act with a different cadence, and `hunter-form.ts` is already 778 TS / 477 template lines across seven pickable sections. **Skyler: "Separate advancement screen."** Confirms 7.2, including its stated departure from `architecture.md` Section 8. Note the vocabulary: Skyler calls it the *advancement* screen, and 7.2 now follows him.

**OQ-3 — RESOLVED: unenforced, with a premise corrected.**
*Asked: rating maxima will be neither enforced nor shown — accept?* **Skyler: "Unenforced during advancement is good. To be clear: this will still be enforced during creation, correct?"** Accepted, but the follow-up rests on a premise that does not hold: **creation does not enforce rating maxima and never has**, because a hunter has no rating columns to bound — ratings are an FK to a preset array, so an illegal value is unreachable rather than rejected. Advancement is the first mechanism in the app that can produce a rating the playbook never printed. Written out in full as **9.1**, because "this was already enforced and you are relaxing it" and "this was never expressible and you are creating it" call for very different levels of care.

**OQ-4 — RESOLVED: small bridge, and the table it depends on already exists.**
*Asked: `Mark two of the basic moves as advanced` (56 lines) has nowhere to go — note-only for HA-1, with the bridge as its own follow-on?* **Skyler: "Yes, this recommendation is good. Keep it small as a bridge table."** Confirmed, with two corrections in **9.3**: `BasicMove` is **already a real, migrated table** with a `DbSet` and an unused response contract — it is missing only its eight rows and a `GET`, not a schema decision; and the `IsAdvanced` field Skyler proposed on the bridge should be dropped, since a `false` row is indistinguishable from no row. Scheduled as **HA-1b**, gated on that content and endpoint landing.

**OQ-5 — RESOLVED: no.**
*Asked: should a hunter's improvement count appear on the hunters list page? Deliberately left open for Rosalina.* **Skyler: "No, advancement count does not belong on the list page at all."** Decided directly, so it is no longer Rosalina's to open. 7.2 updated.

**OQ-6 — RESOLVED: free text, and HA-1 gets smaller as a result.**
*Asked: should the advancement screen offer moves from other playbooks in HA-1, given the picker means browsing 27 playbooks' move lists? Recommendation was allowance in HA-1, picker in HA-2.* **Skyler: "For the first pass, just have a text input to add which move they've chosen from another playbook. I will consider more complex options in the future, but do not need anything beyond a basic functionality for now."** This went further than the recommendation and improved it: with no `HunterMove` row pointing anywhere foreign, **`ForeignMovePick` leaves HA-1 entirely and `Validate`'s "belongs to this playbook" check needs no change at all** (4.2, 5.2). One request back, recorded rather than asked: capture the answer as **two fields — playbook, and move name — not one sentence**, because HA-2's migration into real `HunterMove` rows is a lookup in the first case and a judgement call in the second.

**OQ-7 — RESOLVED: declined.**
*Asked: fix the `LevelingUpText` truncation across all 28 playbooks as its own small Phase 8 data correction?* **Skyler: "You can ignore this detail. We do not need the additional text at this time."** Closed as declined. 1.2 keeps the finding, marked as such, so the verified data gap is not re-discovered and re-raised later. One knock-on: 7.2's advanced-improvement lock needs wording of our own rather than a quotation, since the sentence it would have quoted is not stored anywhere.

**OQ-8 — RESOLVED 2026-09-11: record the grant; removing the improvement removes exactly that move.**

**What Skyler was asked and chose.** The question put to him: *"A hunter took "Take another Chosen move", picked the extra move, and you now remove that improvement. The hunter holds one move more than allowed, and the server rejects every save until it's fixed, including Luck and Harm clicks. What should removal do?"* He chose the option labelled **"Remove the granted move automatically (Yoshi)"**. The description shown with it — option text, not his own words — was: *"The app records which move each improvement granted, which adds one column. Removing the improvement removes exactly that move, and never one picked at creation. It keeps both of your rulings intact. Rosalina rejected auto-dropping because the app would have to guess which move, but she hadn't seen Yoshi's design, and recording the grant removes the guess."* He was also shown, and did not choose, Rosalina's "Ask which move goes" and "Block removal once used".

**Rosalina's Q6 raised the same problem independently.** Her recommendation, Q6 (a), was that the undo confirm asks which move goes. She rejected dropping a move automatically because the app would have to guess which move to drop. That objection is right about the design she had in front of her, where every `HunterMove` is an interchangeable row and nothing records which one an improvement paid for. **It does not apply to a recorded grant:** `GrantedByPlaybookImprovementId` names the move, so there is nothing to guess. Her option also carried the cost this doc gave for (b) below: the question could drop a move picked at creation, which Q5b locks. She had not seen this design when she wrote Q6, and is updating her doc to match.

**Decided design: (a) below, in HA-1.** Two known risks — the untested composite foreign key on PostgreSQL, and EF Core's in-memory reconciliation — are under Section 8, to check early. *(Later 2026-09-11: the question as put to Skyler said the over-allowance would block Luck and Harm clicks. With `PATCH /hunters/{id}/state` added the same day it no longer would, but the decision does not rest on that: a hunter holding a move no improvement granted is a false statement, refused on every save that runs the rules.)* The question and options as originally written are kept as the record.

*Originally asked: When an improvement is undone, should the pick it granted be removed with it?*
Undo deletes one `HunterImprovement` row, and ratings and allowances recompute from what remains. But `Take another Chosen move` grants an *allowance*, and the move picked with it is an ordinary `HunterMove` row that undo leaves in place. The hunter is then over its move allowance, and every later whole-hunter `PUT` — including a Luck or Harm click on the read-only sheet — is refused until the improvement is taken again. Nothing in the data records which move the advancement granted, and creation picks are locked, so "unpick a move" is not available.
- **(a) Record what the improvement granted.** One nullable column on `HunterMove` (`GrantedByPlaybookImprovementId`), with a composite foreign key to `HunterImprovement` and cascade delete, so undo removes exactly the granted move and nothing else. It stays strictly inside the 13.2 ruling: only an advancement pick is ever removed. The database is PostgreSQL, which accepts a cascading composite key with one nullable column; not yet prototyped. HA-2's bespoke grants would need the same column on `HunterBespokeSelection` and `HunterBespokeSectionInstance`.
- **(b) No schema: the undo confirm asks which move to drop.** The resulting sheet is identical, since moves from one pool are interchangeable, but the dialog would offer moves chosen at creation too, which bends Q5b.
- **(c) Refuse to undo an improvement whose grant has been spent.** No schema and inside Q5b, but it makes undo unavailable exactly when it is most likely to be wanted.

**Recommendation: (a).** It costs one nullable column. It makes undo exact again, which is the property Section 6 claimed and did not have. And it is the only option that honours both of Skyler's rulings literally.

**OQ-9 — RESOLVED 2026-09-11: yes, as that improvement's own pick, and nothing else is unlocked.**

**What Skyler was asked and chose.** The question put to him: *"About 12 improvements tell you to change a pick made at creation (e.g. "Delete one of your Doom tags"), and those picks are otherwise locked. Should the level-up flow let those improvements make that change?"* He chose the option labelled **"Yes, as that improvement's own pick (Yoshi)"**. The description shown with it — option text, not his own words — was: *"The level-up screen lets that improvement remove or swap the named pick, saved together with the improvement. Nothing else is unlocked. The catch: because removal leaves no trace, undoing that improvement can't bring back the pick it removed."* The catch was in the description he chose, so it is recorded as accepted. **Decided design: HA-2.**

**What removing each kind of OQ-9 improvement does — made explicit 2026-09-11 after a point from Rosalina.**

- **Delete-type** (`Delete one of your Doom tags`): removing the improvement restores its allowance and nothing else. The deleted pick stays gone, and the section reads one short.
- **Swap-type** (`Change your Task to another option`): removing the improvement changes no pick. The new pick stays, and the old one stays gone.

**A swap-in pick is never recorded as granted by the improvement** — including under Section 8's extension of the grant column to bespoke picks, which Skyler decided later on 2026-09-11 with this exclusion as part of it. Otherwise removal would delete the new pick without restoring the old one, leaving the section short with no way to re-pick under Q5b. Rosalina raised this, and her swap confirm copy already assumes the new pick stays. She also noted the consequence for her delete-type confirm: because OQ-9 records nothing about the deleted pick, it can name the section that ends up short (*"Fate will be one Doom tag short"*) but not which tag was taken.

The question and reasoning as originally written are kept as the record.

*Originally asked: May the advancement screen remove or change a creation pick when the improvement itself says to?*
About 12 lines do this: `Delete one of your Doom tags`, `Remove one Unknown Heritage tag`, `Change your Task to another option`, `Change your Guide`, `Change some, or all, your dark side tags`, `You may cross off another option from your Tools and Techniques`. Carrying one out means removing or replacing a pick made at creation. The 13.2 ruling made improvements removable; it did not say whether an improvement may reach into creation picks. Without that, these improvements can be recorded and undone but never applied, and the hunter keeps a pick the rules removed.

**Recommendation: yes, but only as the improvement's own secondary pick.** The player picks `Delete one of your Doom tags`, the screen asks which one, and the removal saves in the same `PUT` as the improvement. That matches the shape Skyler gave Rosalina for this screen (*"pick the advancement first, which may prompt a secondary pick"*). It means 9.2's transient never occurs. And it opens no general edit route: the only creation picks ever changed are ones a printed improvement names. **One consequence to accept knowingly:** with hard delete and no trace, undoing such an improvement cannot restore the removed pick, because nothing records what it was. The allowance comes back, the hunter shows a genuine shortfall, and under Q5b there is no way to re-pick. I would accept that for a single-user tool. It is flagged because it is the one case where "hard delete, no trace" loses something the user might want back — and the fix, if wanted, is recording the removed option on the improvement row. *(2026-09-11: that same record is also what would let Rosalina's delete-type confirm name the tag rather than only the section. Recorded as part of what the accepted trade-off costs, not recommended — Skyler accepted the trade-off.)*

---

## Next

Rosalina reviews the **flow** in 7.2 — steps 1–4, the effect step's escape hatch, the experience-reset detail in a backfill, and the undo confirm on each Advancement row, which 13.2's resolution restores. **QQ-2 and QQ-5 are Skyler's calls and are not open to her**, OQ-5 having been decided against her recommendation after she wrote it (13.3). OQ-8 and OQ-9 are decided by Skyler: undo removes exactly the move an improvement granted, and a removal improvement makes its change as its own secondary pick. The flow presents both — naming the move that goes in the undo confirm, and asking for the pick to remove as part of taking the improvement.

**Nothing is blocked, and no numbered question is open.** 9.4's research question blocks nothing, and the two HA-1 risks under Section 8 are for early implementation, not for decision.
