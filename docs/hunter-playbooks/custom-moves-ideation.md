# Hunter Playbooks — Phase 6 Custom Moves: Census and Modeling Proposal (Ideation, Not Locked)

**Status: first pass, 2026-08-30. This is a working-through for Skyler to react to, not a spec to rubber-stamp** — same posture `phase5-bespoke-ideation.md` opened with. The census below is real and verified; the modeling proposal in Section 3 is a recommendation with one genuinely open scope question (Section 4, Q1) that materially changes how much of it applies.

**Filename note**: topic-named (`custom-moves-ideation.md`), not phase-numbered, deliberately — `phase5-bespoke-ideation.md` bakes in a number, and phases were just renumbered on 2026-08-29 (old 6–9 → 7–10). Keeping new filenames topic-named avoids the same fragility recurring. Its role is exactly parallel to the Phase 5 ideation doc.

## 1. Method — how this census was done, and what it does and doesn't cover

Every one of the 28 playbooks' Moves sections was extracted from the source PDF (`pdftotext -raw`, all 58 pages, Moves block isolated per playbook) and **read in full** — not sampled, and not limited to the Move-internal-pick instances already flagged across `bespoke-ruleset-catalogue.md`. That existing list was treated as a seed, exactly as `phases.md` Phase 6 warned it should be, and the census confirms the warning was warranted (Section 2.6).

Two systematic greps were run across all 28 extracted Moves blocks as a cross-check against the full read, so the creation-time inventory below isn't just "what I noticed while reading": one for pick/choose-count signals, one for free-text authoring signals (`name them`, `detail`, `describe`, `define`, `decide if`).

**Coverage claim, stated precisely**: the creation-time-pick inventory (2.1) and the free-text inventory (2.3) are intended as **exhaustive** — full read plus targeted grep, cross-checked. The in-play inventory (2.2) is a **full read but not separately grep-verified**, because whether it's in scope at all is itself the open question (Q1); if Skyler puts it in scope, it should get the same exhaustive treatment before any modeling is finalized.

## 2. What the census found

### 2.0 The grant-shape layer is confirmed unchanged — Phase 2's model needs nothing

Every playbook's Moves section opens with a grant sentence ("You get all the basic moves, plus N [Playbook] moves"), optionally naming Required moves, then a pick pool. All 28 fit `Playbook.MoveGrantCount` + `PlaybookMove.Required` exactly, with no exceptions found. Counts range 2–4 granted; Required moves range 0–2. **No change needed to the Phase 2 Moves container model, and this phase should not revisit it** — matching the scope boundary `phases.md` Phase 6 already states.

### 2.1 Creation-time picks inside Moves — the core Phase 6 content (14 moves, 11 playbooks)

These are permanent, character-creation-time selections embedded inside an individual Move's own text. This is the population the phase exists for.

| Playbook | Move | Req? | Pick shape | Presentation |
|---|---|---|---|---|
| Changeling | Force of Nature | optional | 1 of 3 + open-ended slot | inline: "Choose its type: lightning, insect swarms, magical blades, or something else" |
| Crooked | **Artifact** | optional | 1 of 5 | inline, each `Name (mechanical text)` |
| Crooked | **Deal with the Devil** | optional | **1–2 of 5 (a real range)** | inline, bare labels, one with mechanical text |
| Forged | Partner | Required | **2 categories**: Bonds 2 of 5, Burdens 1 of 6 | bulleted; each category has its own `Something else: ______` slot |
| Gumshoe | The Naked City | Required | 4 of 34 | inline, bare labels; escape hatch stated in the *instruction*, not as an option row |
| Host | Defensive Adaptation | Required | 1 of 6 | bulleted, each `Name: mechanical text` |
| Monstrous | **Something Borrowed** | optional | **computed option set** | "Take a move from a hunter playbook that is not currently in play" |
| Pararomantic | Supernatural Guide | Required | **binary** | inline: "Choose if your relationship is secret or not" |
| Professional | Mobility | optional | **2 categories**: Good 2 of 14, Bad 1 of 8 | inline, **semicolon**-separated |
| Searcher | First Encounter | Required | 1 of 7 | bulleted, `Name: description`; "take the associated move" |
| Searcher | **Guardian** | optional | 1 of 5 | inline: "Their look is one of: …" |
| Spell-Slinger | Tools and Techniques | Required | **inverted — "Cross off one; you'll need the rest"** | bulleted, `Name: description` |
| Spell-Slinger | **Practitioner** | optional | **2 from an externally-defined list** | "Choose two effects available to you under `use magic`" — the option set lives on a *basic move*, not printed here |
| Visitor | Something Strange | optional | 1 of 5 | bulleted, incl. "Something else (with the group's agreement):" |

**Bolded rows are new findings this census surfaced** — not previously flagged anywhere in `bespoke-ruleset-catalogue.md`.

Notable structural facts:
- **Both category-pair cases (Forged's Partner, Professional's Mobility) are structurally identical to a bespoke Section with two mandatory nested categories**, each carrying its own independent pick count. This is the single strongest signal for the modeling recommendation in Section 3.
- **Ranges occur** (Crooked's "one or two things") — same `MinSelect < MaxSelect` shape The Visitor's Expatriation established for bespoke Sections.
- **Presentation varies independently of structure**: bulleted lists, comma-separated inline runs, and semicolon-separated inline runs all encode the same underlying pick. Presentation should not drive modeling.
- **Three distinct "open slot" conventions**, all meaning the same thing: a real `Something else: ______` option row (Forged), a labeled option with no printed blank (Visitor), and an escape hatch stated only in the instruction prose (Gumshoe). The first two map to `{{blank}}` cleanly; the third has no option row to attach a token to (see Q3).

### 2.2 In-play menus — a much larger population, and the reason Q1 exists

These look structurally similar to 2.1 but are **not** character-creation picks: the player (or sometimes the Keeper) chooses fresh from the list *every time the move triggers during play*. Read across all 28, they fall into four sub-shapes:

- **Roll-result-gated pick count** — the count itself varies by outcome ("On a 10+ pick three, on a 7-9 pick one"). Found on Action Scientist (Doors of Perception), Celebrity (Fakelore), Changeling (Force of Nature's "Extras"), Gumshoe (Jessica Jones Entry — three tiers including a *miss* tier that still grants a pick; Hacker with a Dragon Tattoo), Interface (Technomancer, Virus Whisperer). **This is a shape the bespoke model has no equivalent for at all** — `MinSelect`/`MaxSelect` are static.
- **Roll-outcome-embedded single pick** — "On a 7-9, choose one: X, Y, Z", usually inline. Found on Curse-Eater (Ropes of Fate), Expert (It Wasn't As Bad As It Looked), Flake (Often Overlooked), Mundane (Trust Me — **chosen by the Keeper, not the player**), Pararomantic (Spirit Touched), Professional (Medic), Spell-Slinger (Could've Been Worse), Spooktacular (Put On A Show), Wronged (DIY Surgery).
- **Hold-spend menus** — "hold N … spend your hold to:" + a list. Found on Flake (Connect the Dots), Gumshoe ("Just one more thing"), Hex (Cast the Bones), Initiate (Fortunes), Mundane (What Could Go Wrong?), Pararomantic (Bonding Time, Monster Empathy), Spooky (Tune In, Jinx).
- **Additive question/effect lists** — a permanent *expansion* of a base move's own option pool ("you may ask these as well as the usual questions"). Found on Changeling (Faerie Gossip — **two of its three questions contain `{{blank}}`**), Curse-Eater (Curse Whispers, Reach), Envoy (Too Much Has Been Lost), Host (Open Your Mind), Interface (Expert Troll), Spell-Slinger (Forensic Divination), Spooktacular (The Game Is Fixed), Spooky (Hex), Visitor (Taste of Home — **chosen by the other hunter**).

Roughly 35 moves carry one of these. **This population is 2–3× the size of the creation-time population**, which is why "are these in scope" is the question that most changes this phase's size.

Also worth noting explicitly, since it's the thing most likely to cause a miscategorization later: **ordinary PbtA roll-outcome branching (10+/7-9/miss consequence text with no choice) is a third, much larger category that is neither of the above** and needs no modeling beyond the existing `<ul>/<li>` HTML subset. The Wronged's DIY Surgery was the case that first forced this distinction to be stated (`bespoke-ruleset-catalogue.md` `## The Wronged`); the census confirms the majority of bulleted lists inside Moves are exactly this.

### 2.3 Free-text authoring inside Moves (10 moves, 7 playbooks)

Content a player writes freely, with no enumerated option list at all:

| Playbook | Move | What's authored |
|---|---|---|
| Crooked | Made | Name the gang; describe how its operations tie to your background |
| Forged | Partner | Choose another hunter **or** create an ally (an entity reference, not text) |
| Initiate | Mentor | Name them |
| Initiate | Apprentice | Name them |
| Monstrous | Shapeshifter | Decide one form or several; detail them |
| Pararomantic | Supernatural Guide | Determine creature kind; say what power it has |
| Searcher | Guardian | Define them and their powers *(combined with the 1-of-5 look pick in 2.1)* |
| Searcher | Network | **Detail up to five members** — bounded, repeatable free text |
| Spell-Slinger | Arcane Reputation | **Pick three organizations** — free text ×3, no list printed |
| Spell-Slinger | Enchanted Clothing | Pick an article of clothing |

Two of these (Searcher's Network, Spell-Slinger's Arcane Reputation) are **bounded-repeatable free text** — N independent free-text entries — which is neither `FreeTextLabel` (exactly one value) nor `BespokeJournal` (unbounded, multi-field) as currently defined. See Q3.

Also recurring here: **illustrative examples that must not be mistaken for options.** Changeling's Inhuman Talent ("perhaps plants, ice, illusions, or summer"), Hex's Cast the Bones ("tarot, casting the runes, reading entrails, or something like that"), Initiate's Sacred Oath ("e.g. speech, … alcohol, lying, sex, etc"). These are prose, not pick-lists — the same distinction Gumshoe Code's "Example Codes" already forced at the bespoke level.

### 2.4 Computed option sets — options defined by reference, not by literal rows (5 moves)

- Monstrous / **Something Borrowed** — "a move from a hunter playbook that is not currently in play" (creation-time, permanent).
- Spell-Slinger / **Practitioner** — "two effects available to you under `use magic`" (creation-time; option set lives on a *basic move*).
- Celebrity / But I Play One on TV — "a move from any not-in-use playbook, or an alternate Weird move" (in-play, once per session).
- Pararomantic / Do As The Supernatural Do — "an unnatural move from your Guide's playbook" (in-play/situational).
- Pararomantic / Bonding Time — one hold-spend option is "use a Pararomantic move you haven't picked" (**self-referential** — the option set is this same playbook's own unpicked moves).

(The bespoke layer has one more: Spooktacular's Supernatural Creatures, already catalogued.) See Q2.

### 2.5 Two systematic extraction findings, verified via the pipeline

**(a) In-move option lists never carry a font-derived title signal.** Verified on both an inline case (Crooked page 11) and a bulleted case (Host page 31): the Move's *own name* is bold (`WarnockPro-Bold`), and **every option name inside the move is regular weight** — "Protective amulet", "Lucky charm", "Silk threads", "Acid spray" are all `WarnockPro-Regular`. The playbook's typography spends its bold on the Move name and has nothing left to mark option titles with.

Direct consequence for authoring: **every `Title`/`DescriptionText` split for an in-move option will be delimiter-derived (colon or parenthesis), never font-confirmed** — the lower-confidence provenance already flagged for Forged's Benefits and Pararomantic's Guide's Gift, but here it's not an exception, it's the rule for this entire content class. Worth stating as a standing expectation before authoring starts rather than rediscovering it per-playbook.

**(b) Presentation is not a reliable structural signal inside Moves.** The same pick structure appears bulleted (Host, Visitor, Forged, Searcher), comma-separated inline (Crooked, Changeling, Searcher's Guardian, Gumshoe), and semicolon-separated inline (Professional). Any extraction tooling keyed on bullet glyphs — which is what `extract-moves.mjs` currently keys on — will silently miss the inline cases entirely. This is a real, concrete tooling gap for whoever runs Phase 6's extraction, not just an authoring note.

### 2.6 The seed-vs-census warning was correct, concretely

`phases.md` Phase 6 flagged that the existing trap list was found opportunistically and that Chosen/Crooked/Divine had never been checked. Confirmed: **The Crooked has two creation-time in-move picks (Artifact, Deal with the Devil), neither previously flagged anywhere** — and Crooked is one of the three pilot playbooks Phase 4 authors first. Three further new instances turned up on already-walked playbooks (Changeling's Force of Nature, Searcher's Guardian, Spell-Slinger's Practitioner), plus Monstrous's Something Borrowed and Pararomantic's Supernatural Guide binary. That's **7 of 14 creation-time instances new to this census** — the prior list was exactly half complete. (Chosen and Divine are genuinely clean, checked directly.)

## 3. Recommended model

### 3.1 The architecture fork, re-derived — and my own earlier framing of it was wrong

`phases.md` Phase 6 names the expected fork as: reuse `BespokeOption` directly via a nullable `PlaybookMoveId` FK (**A**), or build a parallel `PlaybookMoveOption` table (**B**). Having now read the real content, **both are the wrong attachment point**, and I want to say that plainly rather than pick the better of two options I framed before doing the census.

The deciding evidence is Forged's Partner and Professional's Mobility: each is **two named categories under one Move, each category with its own independent pick count**. Under option A, those categories would have to be top-level `BespokeOption` rows with `PlaybookMoveId` set — but then "how many of my direct categories are mandatory" has nowhere to live, because that field is `BespokeSection.MinSelect`, one level up. Option A would need a new field invented immediately to express something the existing schema already expresses perfectly well one level higher.

**Recommendation — option C: a nullable `BespokeSection.PlaybookMoveId`.**

```
BespokeSection
  Id, PlaybookId
  PlaybookMoveId (nullable FK -> PlaybookMove)   -- NEW: null = a playbook-level bespoke ruleset (all existing rows);
                                                 --      set  = this Section's pick-structure lives inside that Move
  Title, Description, EffectText, FreeTextLabel
  MinSelect, MaxSelect, MinInstances, MaxInstances
```

That is the **entire schema delta** — one nullable FK, one table, zero changes to `BespokeOption`, zero changes to any instance-side table, zero new tables.

**Why this is the right attachment point:**
- **It reuses all of Section 6, not half of it.** A Move's internal structure gets `Description`/`EffectText`, Section-level `MinSelect`/`MaxSelect`, `FreeTextLabel`, `MinInstances`/`MaxInstances`, the whole recursive `BespokeOption` tree with `NumericMin`/`NumericMax`, `{{blank}}`, the constrained HTML subset, and the derived-engagement rule — all unchanged, all already validated against 28 playbooks. This is exactly the "same kind of modeling we're doing for the bespoke rulesets" Skyler asked about, taken literally rather than approximately.
- **Every 2.1 shape maps with no new concepts.** Single-category picks (Host, Visitor, Searcher, Crooked ×2, Changeling, Guardian) → a Section with `MinSelect`/`MaxSelect` and flat options. Category pairs (Forged, Professional) → the mandatory-multi-category umbrella shape (`MinSelect == MaxSelect == 2`, each category option carrying its own counts) already proven by Fate/Combat Magic/Expatriation. Ranges (Crooked's 1–2) → `MinSelect=1, MaxSelect=2`. Open slots → `{{blank}}`. Binary (Pararomantic) → a 1-of-2 Section.
- **The instance side needs nothing.** `HunterBespokeSelection.BespokeOptionId` already points at a `BespokeOption`; that option's Section now happens to belong to a Move. No new bridge, no new column, no discriminator.
- **It preserves the "shape emerges from populated fields" philosophy** rather than adding a discriminator — `PlaybookMoveId` populated *is* the signal.

**The trade-off it accepts, stated plainly**: `BespokeSection` becomes polymorphic in its owner — a Section belongs to a Playbook *and optionally* to one of that Playbook's Moves. Any query that assumes "all Sections for playbook X are top-level rulesets" must now filter `PlaybookMoveId IS NULL`. That's a real (small) ongoing cost paid at every read site, in exchange for not duplicating a validated 4-table apparatus. I judge it clearly worth it; the alternative (option B) duplicates `BespokeSection`, `BespokeOption`, and both instance-side tables to model content that is structurally identical.

`PlaybookId` deliberately stays on the row even when `PlaybookMoveId` is set (it's derivable through the Move, but keeping it makes "give me everything for this playbook" a single flat query and matches how `HunterBespokeSectionInstance.SectionId` is already stored directly rather than derived transitively).

### 3.2 What still has no home (dependent on Q1/Q2/Q3)

Under the recommendation above, **2.1 is fully modeled and 2.0 needs nothing.** Genuinely unresolved:
- **2.2 in-play menus** — no home; roll-result-gated counts in particular have no equivalent concept in the schema at all. Q1.
- **2.4 computed option sets** — no home; the option list isn't literal rows. Q2.
- **2.3 bounded-repeatable free text** (2 instances) — partial home; needs `FreeTextLabel` + `MinInstances`/`MaxInstances` combined, which is a valid-but-never-exercised combination. Q3.

## 4. Questions for Skyler

**Q1 — the big one: are in-play menus in scope for modeling, or do they stay prose?** (Section 2.2, ~35 moves.)

These are lists a player chooses from *repeatedly during play*, not at character creation — "spend your hold to ask one of these questions," "on a 10+ pick three effects." Two paths:

- **(a) Leave them as prose** inside `PlaybookMove.DescriptionText`, using the existing `<ul>/<li>` HTML subset. They render as a readable list on the Hunter sheet; nothing is tracked. **Zero new schema.** This is what Phase 5 effectively assumed by excluding all Move content.
- **(b) Model them as real option rows**, so the app could render them as interactive controls and potentially track selections/hold-spends during play.

**My recommendation is (a), leaving in-play menus as prose, for this phase.** Reasoning: the app's current scope (per `architecture.md` Section 8 and Phase 10) is Hunter *creation and editing* — a character sheet, not a live play-session tracker. Nothing else in the design tracks in-play state (holds aren't modeled, roll outcomes aren't modeled, `forward`/`ongoing` bonuses aren't modeled). Modeling in-play menus as options would be the first piece of live-play machinery in the schema, and it would need the roll-result-gated-count concept built to be useful — a real new mechanism serving content the app can't otherwise act on yet. **But this is a product-intent call, not an architecture one**, which is why it's the first question rather than something resolved by precedent: if the eventual vision includes a play-session view where a Hunter marks holds and picks effects live, the answer flips and this phase roughly triples in size.

**Q2 — how should "computed option set" moves be handled?** (Section 2.4, 5 moves.)

Cases like Monstrous's "Take a move from a hunter playbook that is not currently in play" and Spell-Slinger's "Choose two effects available to you under `use magic`" have option sets defined by *reference* to other data (another playbook's moves; a basic move's effect list), not by literal rows. Two of the five are creation-time and permanent, so unlike Q1 they can't be dismissed as play-state.

**My recommendation: leave all five as prose for now, and revisit only if the Hunter UI actually needs to offer the choice interactively.** A real `PlaybookMove`→`PlaybookMove` reference mechanism is buildable (the FK exists, "not currently in play" is a runtime/campaign-scoped condition the schema has no concept of), but "not currently in play" specifically depends on campaign/session state this design has never modeled — so a faithful implementation isn't actually possible today regardless. Flagging rather than resolving because two of these are permanent creation-time picks and a future Hunter form might reasonably want them selectable.

**Q3 — bounded-repeatable free text: extend the existing fields, or leave as prose?** (Section 2.3, 2 instances: Searcher's Network "detail up to five members"; Spell-Slinger's Arcane Reputation "pick three organizations".)

Neither fits cleanly: `FreeTextLabel` captures exactly one value; `BespokeJournal` is unbounded and multi-field. The natural fit is a `FreeTextLabel` Section with `MinInstances`/`MaxInstances` set (Network: 0–5; Arcane Reputation: 3–3) — **a combination the schema permits but no case has ever exercised**, and whose instance-side path is the one already-flagged exception where `HunterBespokeSelection.BespokeOptionId` is null. **My recommendation: adopt it, since it needs no new fields** — but flagging it because it stacks two independently-flagged-as-untested mechanisms on top of each other, and because "leave these two as prose" is a perfectly reasonable cheaper answer.

**Q4 — the inverted pick (small, low-stakes).** Spell-Slinger's Tools and Techniques says "**Cross off one**; you'll need the rest" — you select one of four to *lose*, keeping three. Modeled as an ordinary `MinSelect=1, MaxSelect=1` Section, the stored selection means the opposite of every other selection in the schema.

**My recommendation: model it as an ordinary pick-1 and state the inversion in the Section's `Description`, accepting that the semantics live in prose** — exactly the resolution Skyler already chose for Monstrous's Natural Attacks either/or rule ("leave unenforced, stated in prose only, no new schema"). Raising it only because it's a one-line confirmation and it's the single case in this census where a stored value's *meaning* is inverted rather than just its constraint being unenforced.

## 5. Suggested next steps once Q1–Q4 are answered

Mirroring how Phase 5 actually ran, rather than proposing something new:

1. Skyler answers Q1 (and ideally Q2–Q4, though Q1 is the only true blocker — it determines whether the phase is ~14 moves or ~50).
2. `architecture.md` gains the `BespokeSection.PlaybookMoveId` addition as a new subsection alongside Section 6 (Section 6.7 currently declares Move-internal content explicitly out of scope and points here — that note becomes the pointer to the real model).
3. A `custom-move-catalogue.md` is opened, mirroring `bespoke-ruleset-catalogue.md`'s conventions exactly (one `##` per playbook, one `###` per Move with internal structure, progress tracker, "confirmed none" recorded as a real result). **The 14 rows in 2.1 are its starting worklist** — but per 2.5(b), the extraction tooling needs an inline-list path before authoring the comma/semicolon-separated cases, which is a real prerequisite task, not a detail.
4. One-playbook-at-a-time authoring, same rigor: verify against the source PDF, run the formatting pipeline, escalate rather than guess.

**One sequencing note worth acting on early**: The Crooked is both a Phase 4 pilot playbook *and* now known to carry two creation-time in-move picks. If Phase 4 authors Crooked before this phase resolves, its Artifact and Deal with the Devil content will have to be either deferred or re-authored afterward. Worth knowing before Phase 4 starts, since it was invisible until this census.

## Cross-references

- **`architecture.md` Section 6** — the authoritative bespoke-ruleset schema this proposal reuses wholesale; Section 6.7 is the current out-of-scope declaration for Move-internal content that this doc is intended to supersede.
- **`phases.md` Phase 6** — the phase this supports; its scope boundary, two-pattern framing, and seed-not-census warning are all confirmed by this census (with the pattern count revised upward — see Section 2).
- **`bespoke-ruleset-catalogue.md`** — where the pre-existing (half-complete) trap flags live, in place per playbook.
- **`pdf-extraction-pipeline.md`** / `tools/pdf-extract/` — the extraction mechanism; note the inline-list gap in 2.5(b) before this phase's authoring pass.
