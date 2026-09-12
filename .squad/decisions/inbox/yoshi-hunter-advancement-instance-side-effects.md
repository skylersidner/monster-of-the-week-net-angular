# Hunter Advancement — Improvement Effects Belong on the Instance, Not the Template

**By:** Yoshi (Architect)
**Date:** 2026-09-03
**Status:** **Proposed, not confirmed.** Ideation pass only — `docs/hunter-playbooks/hunter-advancement-ideation.md`. Rosalina reviews the workflow next; seven open questions (two blocking) go back to Skyler. No code, no data, and no existing doc changed.

## What

A design for tracking hunters as they level up: marking experience, taking improvements and advanced improvements, and having the app's creation-time validators keep working afterwards.

**Schema delta: one table.**

```
HunterImprovement
  HunterId, PlaybookImprovementId   -- composite PK, FK bridge (Restrict on the template side)
  TakenAt                            -- the "and when"; order is presentational only
  EffectKind?                        -- nullable enum; null for ~41% of lines, and that is correct
  EffectTargetId?                    -- polymorphic Guid, deliberately no FK
  EffectAmount                       -- default 1, signed
  Note?
```

**`PlaybookImprovement` stays flat and untyped.** All interpretation lives on the instance row, set by a human at pick time. Nothing on the server ever reads improvement text.

Derived, never stored: level-up count (= row count), the advanced-improvement unlock (= count >= 5), and the hunter's effective ratings (= stat array + rating-kind improvements).

Phased: **HA-1** = the table, the `PlaybookService` guard, a shared `HunterAllowance` object, seven no-target effect kinds (five ratings + `PlaybookMovePick` + `ForeignMovePick`), derived ratings on the response, and a dedicated `/hunters/:id/level-up` screen — 100% of lines recorded, 49% mechanically applied. **HA-2** = the three target-bearing kinds plus the cross-playbook move picker. **HA-3** = a two-line tail (The Hex, The Gumshoe).

## Why

**The central finding: `HunterService.Validate`'s entire first tier reads the playbook as if it were the hunter's rulebook, and after the first level-up it isn't.** All six of its ceilings — `MoveGrantCount`, "must be this playbook's move", `IsAdvanced`, gear `PickCount`, bespoke `MaxSelect`/`MaxInstances`, `HarmBoxCount` — are exactly the statements improvements exist to falsify. The generalization is not "add growth rules"; it is that every ceiling becomes `playbook value + what this hunter's improvements granted`. `architecture.md` Section 9's refuse/report test survives unchanged — only what "false" is computed against moves.

**Why the flat-untyped `PlaybookImprovement` decision holds, on a stronger argument than the original.** The original reason was about authoring (don't over-fit a taxonomy to three samples). The decisive reason is about consumption: **the sheet under-determines the effect on purpose for 255 of 525 lines.** "+1 to any rating" — which? "Take a move from another playbook" — which move? "Get a haven like the Expert has, with two options" — which two? A per-hunter effect record is required regardless, so typing the template would buy only a pre-filled default, cost a 525-row re-authoring pass over data that took four verification groups and eleven found errors to get right, and still have no correct value for The Hex's `Take another Hex move, or an additional Rote.` — one printed checkbox, two structurally different outcomes, chosen by the player. The default is recovered instead by a client-side-only heuristic covering ~49% of lines in about five lines of TypeScript, with an explicit boundary: if it ever moves server-side or gets persisted, the template has been typed by the back door.

**One allowance object, two consumers.** `HunterAllowance.For(playbook, improvements)` is read by both `Validate` and `HunterCompleteness`, for the same reason Follow-on 10b's `BespokeEngagement` is shared: two drifting implementations could call the same hunter over its maximum and under its minimum at once.

**Undo is a hard delete, and it is safe structurally rather than procedurally** — every consequence is derived from the surviving rows, so removing one returns the hunter to exactly what it was with no compensating edit. That is also the argument for one table doing both jobs: the sheet's checkbox column already *is* the history.

**One blocking, easy-to-miss dependency.** `PlaybookService.CheckRemovedChildrenAreUnusedAsync` names this feature as its own extension point ("Improvements ... stay freely removable because they still have no instance-side table; this method is the place to extend when they get one"). Without that ~8-line change, editing a playbook's improvements list silently deletes hunters' improvement history — the exact loss the full-history decision was bought to prevent.

## Rejected

- **Type `PlaybookImprovement`** — see above.
- **Snapshot the sheet at level-up** — contradicts Q4's live-link decision head-on.
- **Five derived-rating columns on `Hunter`** — a stored projection that can drift; would be the third case where this doc set chose "derived, never stored" and the first to break it.
- **Two tables (picks + audit log)** — the more complex reading of "full history"; one table is already both.
- **`POST /api/hunters/{id}/level-up`** — against the no-sub-resource-endpoints decision restated in four files. Revisit only if server-side atomicity ever matters.
- **Demote every ceiling from refuse to report once a hunter has any improvements** (the zero-model option, genuinely the smallest possible design) — removes the validators' teeth for exactly the oldest hunters, inverting Skyler's own framing, and cannot answer "why does this hunter have +2 Sharp", which is what the history table was chosen for.
- **Server-side text parsing** — brittle across six wording families already confirmed in this corpus, and it would put a parser in the refuse tier.

## Incidental finding, flagged not fixed

`Playbook.LevelingUpText` is truncated on **all 28** playbooks — every stored value stops at the colon and omits `"After you have leveled up five times, you qualify for advanced improvements in addition to these."` Verified: the sentence appears 28 times in the source PDF and in 0 of the 28 seeded values. It is the only place in the source where the advanced threshold is stated, and it is the exact text this feature's UI wants. Recommended as its own small Phase 8 data correction, not folded into this feature.

---

## Update — 2026-09-10: all seven questions resolved, four answers moved the design, one of my own claims was wrong

**Status: still Proposed. The one blocking item below was resolved by Skyler on 2026-09-11 — see the update at the end.** Skyler answered every open question and asked four of his own on Section 9. Doc revised throughout; new Sections 9.1–9.5 and 13.

**Four things changed rather than being confirmed:**

- **`ForeignMovePick` leaves HA-1 entirely.** Skyler wants foreign moves captured as free text for the first pass. Since no `HunterMove` row then points at a foreign move, `Validate`'s "belongs to this playbook" check needs **no change at all** and the allowance has nothing to spend. 53 lines — the third most common improvement — handled by one labelled field and no schema. Recorded a requirement for the later migration: capture **two fields (playbook, move name), not one sentence**.
- **`BasicMove` already exists.** Skyler said he had been "planning to add the basic moves as a static table." It was built in Phase 2 (`open-questions.md` Q2): entity, `basic_moves` table via migration `AddHunterPlaybooks`, `DbSet`, and a `BasicMoveResponse` contract **referenced by nothing**. It has no rows, no endpoint and no frontend use. Remaining work is content + a `GET`, not a schema decision. Also corrected his proposed bridge shape: **drop the `IsAdvanced` field** — every basic move belongs to every hunter, so a `false` row is indistinguishable from no row (the same argument `HunterCompleteness` already makes about extra tracks). `HunterAdvancedBasicMove (HunterId, BasicMoveId)`, composite key, no columns. Scheduled as HA-1b, gated on that content landing.
- **I was wrong about removal improvements.** I had written that a signed `BespokeSelect` amount "would fix `MinSelect` but break `MaxSelect`". That is only true if the amount shifts *one* bound. Shifting **both** solves it — the hunter has already removed the pick, so `-1` takes a 3/3 section to 2/2 against a hunter holding 2. No new enum member, no custom validator, no template typing; it falls out of HA-2 for free. Skyler's instinct ("may not be worth it") was right, but for a reason that was not the binding one.
- **One improvement per advancement becomes a client-side constraint**, replacing "nothing enforces this". Stated precisely: the screen constrains **cardinality, not cost** — nothing can verify five experience were earned, because the API cannot distinguish an advancement from an edit and a backfilled hunter never tracked experience.

**One premise of Skyler's corrected.** He asked whether rating maxima "will still be enforced during creation." They are not, and never have been: `Hunter` has no rating columns, ratings are an FK to a preset `PlaybookStatArrayOption`, and `Validate`'s only rating rule is an ownership check. An illegal rating is *unreachable* at creation, not rejected — advancement is the first mechanism in the app that can produce one. No guarantee is being relaxed. Section 9.1.

**One scope confusion of his separated.** His "cross-playbook imports → bridge from hunter to playbook move" conflates two problems. Taking a *move* from another playbook needs **no new table** (`HunterMove.PlaybookMoveId` has no playbook constraint; only `Validate` refuses it) and is settled by free text. Importing another playbook's *structure* — the Expert's haven, the Professional's Agency — is the actual open problem, and his "engines and mechanics" worry bites **harder** there, since a borrowed section's options are meaningful only via the lending playbook's moves. Recorded as research, blocking nothing.

## Resolved 2026-09-11 (was blocking): a contradiction with Rosalina's parallel pass

`docs/hunter-playbooks/hunter-display-design.md` (2026-09-03) and this doc disagree about **whether a recorded improvement can be removed at all**, and both quote Skyler:

- **OQ-1, 2026-09-10:** *"Hard delete, no trace."* — asked about improvements specifically; describes how removal behaves, which presumes it exists.
- **Her Q5b, 2026-09-03:** *"the ability to edit a hunter is a mistake… Hunter creation is a one-way exercise that cannot be adjusted after the fact"* — from which she dropped the per-improvement undo control entirely.

My read (recommended, not acted on): OQ-1 governs — later, improvement-specific, and "hard delete, no trace" is a strange answer about an undeletable thing. Her quote concerns *creation* data, and she already carves play state out of it on the same reasoning. **But I will not resolve a stakeholder's words against a stakeholder's words on my own authority, and the two readings build different screens.** Section 13.2.

**Two further items handed back:** her OQ-5 answer ("yes, a `Level n` chip on the list") is superseded by Skyler answering it himself a week later ("No… not at all") — flagged so she is not left holding a stale recommendation. And her corrected premise *"all 207 moves in the shipped seed carry `bespokeSections: []`"* is wrong: **220 moves, 13 with non-empty sections**, across nine playbooks (count corrected 2026-09-11; it was first recorded here as eight). It matters to both designs — her sheet would render nothing for them, and my HA-2 target picker would omit exactly the sections three improvements aim at. ~~Her *repeatable*-section correction is right and adopted: exactly one section corpus-wide (The Hex's Rotes), which is `BespokeInstance`'s only possible target.~~ *(Wrong — see the 2026-09-11 correction at the end.)*

---

## Update — 2026-09-11: the blocker resolved, and what the narrow reading of it does not cover

**What Skyler decided.** Asked which of his two answers governs, he chose the option labelled *"QQ-1 — improvements are removable (Yoshi's rec)"*, and said nothing else — nothing about the rest of Q5b. The design follows the narrow reading only: **creation picks stay locked (Q5b); advancement picks can be undone by hard delete with no trace (QQ-1).** It is not a general edit route. The remove control on each Advancement row stands.

**What that restores.** Undo is never a dead end. Removing an improvement clears any error the improvement caused, so Section 9's *"every tier-one violation is fixable by removing something"* holds, with the improvement as the thing removed.

**What it exposed, which I had wrong.** The doc claimed undo is exact because "every consequence of an improvement is derived, never stored." That holds only when nothing the improvement granted was spent. The move picked with a `Take another Chosen move` allowance is a stored `HunterMove`, and undo leaves it in place. The hunter is then over its move allowance, and under Rosalina's sheet — where one Luck click is a whole-hunter `PUT` that re-runs `Validate` — **it could not mark Luck or Harm** until the improvement was re-taken. HA-1 scope. With creation picks locked and nothing marking which move the advancement granted, "unpick a move" is not available.

**Two new open questions, neither blocking the design:**

- **OQ-8 (before HA-1 ships):** should undo remove the pick the improvement granted? Recommended: one nullable `HunterMove.GrantedByPlaybookImprovementId` with a composite FK to `HunterImprovement` and cascade delete, so undo removes exactly the granted move and never a creation pick — the only option that honours both rulings literally. PostgreSQL (verified as the provider) accepts a cascading composite key with one nullable column; not prototyped. Rejected: a which-move-to-drop dialog (bends Q5b, since it offers creation moves too), and refusing to undo a spent grant (makes undo unavailable exactly when it is wanted).
- **OQ-9 (before HA-2):** may the advancement screen remove or change a creation pick when the improvement says to (`Delete one of your Doom tags`, `Change your Task`, about 12 lines)? Recommended: yes, only as that improvement's own secondary pick, saved in the same `PUT` — matching the shape Skyler gave Rosalina, so 9.2's transient never occurs and no general edit route opens. Accepted cost: with hard delete and no trace, undoing such an improvement cannot restore the removed pick.

**Correction to my own earlier count:** the 13 moves carrying bespoke sections span **nine** playbooks — Changeling, Crooked, Forged, Gumshoe, Host, Professional, Searcher, Spell-Slinger, Visitor — not eight. The coordinator caught it; re-verified against the seed.

---

## Correction — 2026-09-11: three repeatable sections, not one

The claim above — and in the doc's 4.2 and 13.4 — that the Hex's Rotes is the only repeatable section is **wrong**. There are three:

| Section | Where it lives | Instances | Shape |
|---|---|---|---|
| The Hex's *Rotes* | playbook-level | 0 to unbounded | each entry picks 2 of 2 options |
| The Searcher's *Network* | inside the non-required move *Network* | 0 to 5 | free text, no options |
| The Spell-Slinger's *Arcane Reputation* | inside the non-required move *Arcane Reputation* | exactly 3 | free text, no options |

I scanned playbook-level sections only, and adopted Rosalina's first-pass figure without a move-level walk. She caught it in her reconciliation pass, the coordinator confirmed it with a recursive walk, and I re-ran it. The `HunterBespokeSectionInstance` entity comment named all three and was right.

**What it changes:**

- **`BespokeInstance`'s possible targets are three, but only the Hex's grows in the corpus** — no improvement adds a Network member or an organization. The line count (6) and "build it last" stand.
- **`Take another Rote.` shifts no ceiling.** Rotes has no maximum; null plus any amount must stay null in `HunterAllowance`. Its only effect is the raised minimum. The doc's §2 table had cited it as a ceiling-breaker; fixed there.
- **"Tested against one playbook" is withdrawn.** Rotes exercises neither a finite ceiling nor move gating. Tests need Arcane Reputation (exactly 3) and a case where the hunter does not hold the move.
- **Improvements do target sections inside moves**, but in the corpus only as `BespokeSelect` (the Gumshoe's Naked City, the Host's Defensive Adaptation, the Spell-Slinger's Tools and Techniques), and all three of those moves are required, so the effect always applies. The two move-level repeatable sections sit in non-required moves. **HA-2 picker recommendation:** playbook-level sections plus sections of moves the hunter holds. No server change — `playbook.BespokeSections` already loads move-level sections.

OQ-8 and OQ-9 are untouched by this correction; Skyler is choosing between my and Rosalina's recommendations for OQ-8.

---

## Resolved — 2026-09-11: OQ-8 and OQ-9, both with the recommended design

**OQ-8.** Asked what removing a spent move-granting improvement should do, Skyler chose the option labelled *"Remove the granted move automatically (Yoshi)"* over Rosalina's *"Ask which move goes"* and *"Block removal once used"*. **Decided:** `HunterMove.GrantedByPlaybookImprovementId` (nullable) records which improvement granted a move; removing the improvement removes exactly that move and never a creation pick. HA-1. Rosalina's Q6 raised the same problem and recommended the undo confirm ask which move goes, rejecting auto-dropping because the app would have to guess. That objection holds for anonymous `HunterMove` rows and does not apply once the grant is recorded; her option could also drop a creation pick, which Q5b locks.

**OQ-9.** Asked whether improvements that name a creation pick (`Delete one of your Doom tags`, about 12 lines) may change it, he chose *"Yes, as that improvement's own pick (Yoshi)"*. **Decided:** the advancement screen removes or swaps the named pick as that improvement's secondary pick, saved with it; nothing else is unlocked. HA-2. The catch shown in the option — undoing such an improvement cannot restore the removed pick — is accepted.

**Carried forward — first recorded as not separately confirmed, then decided by Skyler later on 2026-09-11 (see the update below):** the same grant column on `HunterBespokeSelection` and `HunterBespokeSectionInstance` for HA-2's bespoke grants follows from OQ-8, but the option he chose described moves only. ~~Confirm when HA-2 is planned.~~ **Constraint, from Rosalina (2026-09-11), now part of the decision:** OQ-9 swap-in picks are excluded — only allowance-type grants (`Take another Rote.`, `Take another Combat Magic pick.`) are recorded as granted. Recording a swap-in would make removing the improvement delete the new pick without restoring the old one.

**Known risks for early HA-1**, recorded in the doc's Section 8: the composite FK `(HunterId, GrantedByPlaybookImprovementId)` with cascade delete is unprototyped on PostgreSQL, and must be cascade rather than set-null (set-null would null `HunterId`, part of the primary key); and EF Core's move reconciliation could contradict the database cascade — the same table already has a documented fixup trap — so the service should remove granted moves explicitly, with the cascade as backstop.

---

## Update — later 2026-09-11: three more decisions from Skyler

**1. The grant column extends to bespoke picks (HA-2).** He chose *"Yes, same rule for bespoke picks"*: `GrantedByPlaybookImprovementId` on `HunterBespokeSelection` and `HunterBespokeSectionInstance`, so removing an improvement removes exactly what it granted. Rosalina's swap exclusion is part of the decision: picks swapped in by a change-a-pick improvement are never recorded as granted. The two HA-1 risks (untested composite FK on PostgreSQL, EF reconciliation) carry into both tables.

**2. `PATCH /hunters/{id}/state` for play counters.** He chose *"Add PATCH /hunters/{id}/state"*: Luck, Harm, Experience and extra tracks only; marking a box never runs the pick rules; Bowser's work, and the first exception to the Hunter-side "one request carries the whole hunter" convention. `open-questions.md` Q3 is Playbook-side and unaffected. For this design:
- Improvements stay on the whole-hunter `PUT` — they need the full `Validate` pass the `PATCH` exists to skip. The rejection of a level-up command endpoint stands.
- The Experience reset should ride in the same `PUT` as the improvement, so the two land together or not at all. This depends on Bowser keeping `Experience` in the `PUT` contract.
- The Luck-click lockout no longer occurs, but OQ-8's grant recording still stands: an over-allowance hunter is a false statement refused on any save that runs the rules.
- No name clash with anything in the advancement doc.

**3. No edit route; Name/Pronouns editable on the sheet.** He chose Rosalina's recommendation. It settles the doc's §13.5 dependency with no change to the advancement design. ~~Left open for Bowser and Rosalina: whether Name/Pronouns save via the `PATCH` or the `PUT`~~ — resolved in the update below.

**Also:** the `ValidateBespoke` move-level instance gap was fixed on 2026-09-11 (not yet committed) — a failing test from Toad and a fix from Bowser, approved by Skyler.

---

## Update — later still, 2026-09-11: labels and journals off the `PUT`; one new HA-1 requirement

**Name, Pronouns and journal entries save without the pick rules** (Skyler, on Rosalina's Q7), through a widened `PATCH` or a sibling endpoint — Bowser's call. With no edit route, **advancement is now the whole-hunter `PUT`'s only post-creation use**: taking an improvement (with its grant, any OQ-9 change and the Experience reset) and removing one. Improvements staying on the `PUT` is unchanged. The single-user clobber risk now covers more fields; whether the `PUT` stops carrying fields with their own save is Bowser's contract, but it must keep carrying improvements, their grants, the picks they change, and `Experience`.

**Journal entries are editable on the sheet** (Rosalina's Q4). Nothing changes in the advancement design. The Curse-Eater's journal and Corruption improvements (`…then clear it`, `Clear all corruption…`) are sheet actions with `EffectKind = null`, not OQ-9 secondary picks. The `PlaybookService` guard comment the doc quotes is stale for journals, which the method already guards; improvements remain the uncovered kind.

**New HA-1 requirement, from the `ValidateBespoke` fix:** eight grantable moves across six playbooks carry their own section. When removing an improvement removes such a move, the move's section answers must leave in the same save, and validation must see the state after they have gone. Otherwise the removal is refused. If the service removes granted moves itself, it must strip their answers before validating.

**Button copy** is "Advance" (Rosalina's Q5); the doc's UI copy already matched.
