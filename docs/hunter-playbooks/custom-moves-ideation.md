# Hunter Playbooks — Phase 6 Custom Moves: Census and Settled Modeling Approach

**Status: SETTLED, 2026-08-30 — all four open questions answered by Skyler the same day this census was produced.** The census (Section 2) is the verified inventory; the modeling approach (Section 3) is now decided, not a proposal. **The implementation-ready schema lives in `architecture.md` Section 6.8** — this file holds the census, the reasoning, and the decision history, the same division of labour `phase5-bespoke-ideation.md` has with `architecture.md` Section 6.

**All four questions resolved 2026-08-30** (full detail in Section 4):
- **Q1 — in-play menus → prose only.** Phase 6 stays at the **14 creation-time in-move picks**; the ~35 in-play menus are formatted prose in `PlaybookMove.DescriptionText`, nothing stored per Hunter.
- **Q2 — computed option sets → prose only.** All 5 stay prose; no reference mechanism.
- **Q3 — bounded-repeatable free text → model them.** Both cases use `FreeTextLabel` + `MinInstances`/`MaxInstances`; no new schema.
- **Q4 — the inverted pick → ordinary pick, reworded** to "Pick 3 of the 4" (`MinSelect=MaxSelect=3`), an explicitly Skyler-directed, non-source-literal rewrite.

**Net schema delta for all of Phase 6: one nullable FK** — `BespokeSection.PlaybookMoveId`. Zero changes to `BespokeOption`, zero new tables, zero instance-side changes.

**Amended 2026-08-30 after Bowser's tooling pass** — both tooling prerequisites are now built, and **two factual claims in this doc were wrong and have been corrected**: Section 2.5(a)'s font-signal claim was overgeneralized from two samples (The Searcher's First Encounter is a real exception with bold option names), and §5 wrongly assumed the bulleted extraction path already worked for in-move content (it had two silent bugs, one affecting all 7 Required moves). Both corrections are marked in place. The adjacent scope gap this doc raised — creation-time picks nested inside *bespoke options* rather than Moves — was subsequently swept across all 28 playbooks with Skyler's sanction and **closed**: one genuine gap found (The Monstrous's Pure Drive), now corrected in `bespoke-ruleset-catalogue.md`. See the end of §5.

**Filename note**: topic-named (`custom-moves-ideation.md`), not phase-numbered, deliberately — `phase5-bespoke-ideation.md` bakes in a number, and phases were just renumbered on 2026-08-29 (old 6–9 → 7–10). Keeping new filenames topic-named avoids the same fragility recurring. Its role is exactly parallel to the Phase 5 ideation doc.

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
| Spell-Slinger | Tools and Techniques | Required | **3 of 4** *(source says "Cross off one"; reworded by Skyler — see Q4)* | bulleted, `Name: description` |
| Spell-Slinger | **Practitioner** | optional | **2 from an externally-defined list** | "Choose two effects available to you under `use magic`" — the option set lives on a *basic move*, not printed here |
| Visitor | Something Strange | optional | 1 of 5 | bulleted, incl. "Something else (with the group's agreement):" |

**Bolded rows are new findings this census surfaced** — not previously flagged anywhere in `bespoke-ruleset-catalogue.md`.

Notable structural facts:
- **Both category-pair cases (Forged's Partner, Professional's Mobility) are structurally identical to a bespoke Section with two mandatory nested categories**, each carrying its own independent pick count. This is the single strongest piece of evidence behind the settled approach in Section 3 — it's what ruled out attaching at the `BespokeOption` level.
- **Ranges occur** (Crooked's "one or two things") — same `MinSelect < MaxSelect` shape The Visitor's Expatriation established for bespoke Sections.
- **Presentation varies independently of structure**: bulleted lists, comma-separated inline runs, and semicolon-separated inline runs all encode the same underlying pick. Presentation should not drive modeling.
- **Three distinct "open slot" conventions**, all meaning the same thing: a real `Something else: ______` option row (Forged), a labeled option with no printed blank (Visitor), and an escape hatch stated only in the instruction prose (Gumshoe). The first two map to `{{blank}}` cleanly; the third has no option row to attach a token to (see Q3).

### 2.2 In-play menus — examined and ruled out of scope (Q1: prose only)

**Resolved 2026-08-30: these stay as formatted prose in `PlaybookMove.DescriptionText`, using the existing `<ul>/<li>` HTML subset. Nothing here is modeled or stored per Hunter.** The inventory below is retained as the record of what was examined and ruled out — the same way `bespoke-ruleset-catalogue.md` records "confirmed none" as a real, checked result rather than an omission. It is **not** a deferred-work backlog and shouldn't be read as one; if a live-play feature is ever designed, this is a useful starting survey, but no commitment exists.

These look structurally similar to 2.1 but are **not** character-creation picks: the player (or sometimes the Keeper) chooses fresh from the list *every time the move triggers during play*. That's the distinction that decided the scope question — 2.1 produces a permanent answer that belongs on a character sheet; these produce a different answer every time the move is used, so there's nothing per-Hunter to store. Read across all 28, they fall into four sub-shapes:

- **Roll-result-gated pick count** — the count itself varies by outcome ("On a 10+ pick three, on a 7-9 pick one"). Found on Action Scientist (Doors of Perception), Celebrity (Fakelore), Changeling (Force of Nature's "Extras"), Gumshoe (Jessica Jones Entry — three tiers including a *miss* tier that still grants a pick; Hacker with a Dragon Tattoo), Interface (Technomancer, Virus Whisperer). **This is a shape the bespoke model has no equivalent for at all** — `MinSelect`/`MaxSelect` are static.
- **Roll-outcome-embedded single pick** — "On a 7-9, choose one: X, Y, Z", usually inline. Found on Curse-Eater (Ropes of Fate), Expert (It Wasn't As Bad As It Looked), Flake (Often Overlooked), Mundane (Trust Me — **chosen by the Keeper, not the player**), Pararomantic (Spirit Touched), Professional (Medic), Spell-Slinger (Could've Been Worse), Spooktacular (Put On A Show), Wronged (DIY Surgery).
- **Hold-spend menus** — "hold N … spend your hold to:" + a list. Found on Flake (Connect the Dots), Gumshoe ("Just one more thing"), Hex (Cast the Bones), Initiate (Fortunes), Mundane (What Could Go Wrong?), Pararomantic (Bonding Time, Monster Empathy), Spooky (Tune In, Jinx).
- **Additive question/effect lists** — a permanent *expansion* of a base move's own option pool ("you may ask these as well as the usual questions"). Found on Changeling (Faerie Gossip — **two of its three questions contain `{{blank}}`**), Curse-Eater (Curse Whispers, Reach), Envoy (Too Much Has Been Lost), Host (Open Your Mind), Interface (Expert Troll), Spell-Slinger (Forensic Divination), Spooktacular (The Game Is Fixed), Spooky (Hex), Visitor (Taste of Home — **chosen by the other hunter**).

Roughly 35 moves carry one of these — **2–3× the size of the creation-time population**, which is why this was the question that most affected the phase's size. With Q1 resolved as prose, Phase 6's actual worklist is the 14 rows in 2.1, not ~50.

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

**(a) In-move option names are *usually* regular weight — a strong default, but not a guarantee.** *(Corrected 2026-08-30 after Bowser's verification pass; the original version of this note overgeneralized from two samples and would have caused real authoring errors — see the correction note below.)*

Across the seven in-scope moves whose option-name styling has now been checked directly against the raw item stream, three distinct levels turn out to be styled independently:

| Move | Move name | Category-divider label | Option names |
|---|---|---|---|
| Crooked / Artifact | bold | — | regular |
| Crooked / Deal with the Devil | bold | — | regular |
| Host / Defensive Adaptation | bold | — | regular |
| Visitor / Something Strange | bold | — | regular |
| Forged / Partner | bold | **bold** ("Bonds (pick two):") | regular |
| Professional / Mobility | bold | *italic* ("Good things") | regular |
| **Searcher / First Encounter** | bold | — | **bold** — all 7 |

**The Searcher's First Encounter is a genuine exception**: its option names ("Cryptid Sighting", "Zone of Strangeness", …) are `WarnockPro-Bold`, verified directly. Bowser's independent tally across eight validated targets was 81 regular / 7 bold, the 7 being exactly these.

**Two consequences for authoring, both differing from what this doc originally said:**
- **Do not record "not font-derived" as a blanket default.** The extraction tooling now *measures* this per option (`titleStyle`, `titleFontCorroborated`), so authoring should read the measured value rather than apply a rule. Recording the blanket default would have wrongly downgraded the provenance of the one playbook where the source genuinely corroborates the title.
- **Deriving the boundary from the delimiter stays correct regardless**, including where a font signal exists — an option is often a single text item, and a bold run alone can't say where the title ends. Font signal *corroborates* a delimiter-derived split; it doesn't replace it.
- **The category-divider level has its own styling, independent of both the Move name and the option names** (bold on Forged, italic on Professional). Worth knowing before treating any single observed weight as "the" in-move convention.

**Correction note, kept deliberately**: the original claim here — "not an exception, it's the rule for this entire content class" — was generalized from exactly two samples (Crooked p11 inline, Host p31 bulleted). Both samples were correct; the generalization wasn't. Recording this because the failure mode is worth remembering, not just the corrected fact: a two-sample check is enough to establish a *default* and never enough to establish a *rule*, and the doc stated it as the latter.

**(b) Presentation is not a reliable structural signal inside Moves.** The same pick structure appears bulleted (Host, Visitor, Forged, Searcher), comma-separated inline (Crooked, Changeling, Searcher's Guardian, Gumshoe), and semicolon-separated inline (Professional). Also confirmed as a checked negative: **the marker form does not distinguish a creation-time pick from an in-play menu** — Spell-Slinger's Tools and Techniques (creation-time) and Could've Been Worse (in-play) use the same `•` on the same page. Structure must be read from the wording, never inferred from the glyph.

### 2.6 The seed-vs-census warning was correct, concretely

`phases.md` Phase 6 flagged that the existing trap list was found opportunistically and that Chosen/Crooked/Divine had never been checked. Confirmed: **The Crooked has two creation-time in-move picks (Artifact, Deal with the Devil), neither previously flagged anywhere** — and Crooked is one of the three pilot playbooks Phase 4 authors first. Three further new instances turned up on already-walked playbooks (Changeling's Force of Nature, Searcher's Guardian, Spell-Slinger's Practitioner), plus Monstrous's Something Borrowed and Pararomantic's Supernatural Guide binary. That's **7 of 14 creation-time instances new to this census** — the prior list was exactly half complete. (Chosen and Divine are genuinely clean, checked directly.)

## 3. The settled model

**Now in `architecture.md` Section 6.8 as the implementation-ready spec.** This section holds the reasoning; that one holds the definition.

### 3.1 The architecture fork, re-derived — and my own earlier framing of it was wrong

`phases.md` Phase 6 named the expected fork as: reuse `BespokeOption` directly via a nullable `PlaybookMoveId` FK (**A**), or build a parallel `PlaybookMoveOption` table (**B**). Having read the real content, **both are the wrong attachment point** — worth saying plainly rather than picking the better of two options I framed before doing the census.

The deciding evidence is Forged's Partner and Professional's Mobility: each is **two named categories under one Move, each category with its own independent pick count**. Under option A, those categories would have to be top-level `BespokeOption` rows with `PlaybookMoveId` set — but then "how many of my direct categories are mandatory" has nowhere to live, because that field is `BespokeSection.MinSelect`, one level up. Option A would need a new field invented immediately to express something the existing schema already expresses perfectly well one level higher.

**Adopted — option C: a nullable `BespokeSection.PlaybookMoveId`.**

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

### 3.2 Final disposition of every census category

| Census section | Disposition | Mechanism |
|---|---|---|
| **2.0** grant shape | Already modeled, unchanged | `Playbook.MoveGrantCount` + `PlaybookMove.Required` (Phase 2) |
| **2.1** creation-time picks (14) | **Modeled — the whole of Phase 6's worklist** | `BespokeSection` with `PlaybookMoveId` set + its `BespokeOption` tree |
| **2.2** in-play menus (~35) | **Prose only** (Q1) | `PlaybookMove.DescriptionText` + `<ul>/<li>` |
| **2.3** free-text authoring (10) | 8 prose; **2 modeled** (Q3) | Prose, except Searcher's Network + Spell-Slinger's Arcane Reputation → `FreeTextLabel` + `MinInstances`/`MaxInstances` |
| **2.4** computed option sets (5) | **Prose only** (Q2) | `PlaybookMove.DescriptionText` |
| ordinary roll-outcome branching | Prose (never in scope) | `PlaybookMove.DescriptionText` + `<ul>/<li>` |

**Nothing in the census is left without a disposition.** The two modeled categories (2.1 and the two 2.3 cases) share the same single mechanism; everything else is prose.

**The two Q3 cases, concretely**: a `BespokeSection` with `PlaybookMoveId` set, `FreeTextLabel` populated, zero `BespokeOption` rows, and `MinInstances`/`MaxInstances` bounding the repeat count — Searcher's Network `0`/`5`, Spell-Slinger's Arcane Reputation `3`/`3`. Instance side uses `HunterBespokeSectionInstance` (one row per entry) plus `HunterBespokeSelection` with `BespokeOptionId` null and the value in `FreeformText` — the already-documented single exception to that FK being required. **This stacks two independently-flagged-as-untested mechanisms** (`FreeTextLabel`'s null-FK instance path, and `MinInstances`/`MaxInstances` on a zero-option Section); worth a deliberate look when these two are actually authored, not because either is wrong but because nothing has exercised them together.

## 4. Questions for Skyler

**Status, 2026-08-30: all four resolved.** Skyler answered Q2 and Q4 first, then asked for concrete worked examples of Q1 and Q3 before answering those — a useful correction on my part, noted at the end of this section.

**Q1 — are in-play menus in scope for modeling, or do they stay prose?** (Section 2.2, ~35 moves.) — **RESOLVED: prose only**, per Skyler, matching the recommendation below. Phase 6's worklist is the 14 creation-time picks in 2.1. The 2.2 inventory stays in this doc as the record of what was examined and ruled out — explicitly *not* a deferred-work backlog.

**Worked example that unblocked the answer** (The Visitor has one of each in adjacent moves, which made the distinction visible without needing either category name):
- *Creation-time, in scope* — **Something Strange**: "You have an odd adaptation natural to you. **Pick one:**" + 5 options. Chosen once at character creation; it's part of who the Hunter is from then on.
- *In-play, out of scope* — **Taste of Home**: "…**The other hunter picks one:**" + 3 options. Nobody picks at creation; a (different) player chooses fresh every time the move comes up. Use it three times in a session, get three different answers. There is no "my answer" to store.

These are lists a player chooses from *repeatedly during play*, not at character creation — "spend your hold to ask one of these questions," "on a 10+ pick three effects." Two paths:

- **(a) Leave them as prose** inside `PlaybookMove.DescriptionText`, using the existing `<ul>/<li>` HTML subset. They render as a readable list on the Hunter sheet; nothing is tracked. **Zero new schema.** This is what Phase 5 effectively assumed by excluding all Move content.
- **(b) Model them as real option rows**, so the app could render them as interactive controls and potentially track selections/hold-spends during play.

**Recommendation (a), adopted.** Reasoning: the app's current scope (per `architecture.md` Section 8 and Phase 10) is Hunter *creation and editing* — a character sheet, not a live play-session tracker. Nothing else in the design tracks in-play state (holds aren't modeled, roll outcomes aren't modeled, `forward`/`ongoing` bonuses aren't modeled). Modeling in-play menus as options would be the first piece of live-play machinery in the schema, and it would need the roll-result-gated-count concept built to be useful — a real new mechanism serving content the app can't otherwise act on yet. **But this is a product-intent call, not an architecture one**, which is why it's the first question rather than something resolved by precedent: if the eventual vision includes a play-session view where a Hunter marks holds and picks effects live, the answer flips and this phase roughly triples in size.

**Q2 — how should "computed option set" moves be handled?** (Section 2.4, 5 moves.) — **RESOLVED 2026-08-30: prose only**, per Skyler ("Prose only"), matching the recommendation below. All five stay in `PlaybookMove.DescriptionText` with no option rows and no reference mechanism. No further discussion needed.

Cases like Monstrous's "Take a move from a hunter playbook that is not currently in play" and Spell-Slinger's "Choose two effects available to you under `use magic`" have option sets defined by *reference* to other data (another playbook's moves; a basic move's effect list), not by literal rows. Two of the five are creation-time and permanent, so unlike Q1 they can't be dismissed as play-state.

*Original recommendation, adopted*: leave all five as prose for now, and revisit only if the Hunter UI actually needs to offer the choice interactively. A real `PlaybookMove`→`PlaybookMove` reference mechanism is buildable (the FK exists), but "not currently in play" specifically depends on campaign/session state this design has never modeled — so a faithful implementation isn't actually possible today regardless.

**Q3 — bounded-repeatable free text: extend the existing fields, or leave as prose?** (Section 2.3, 2 instances.) — **RESOLVED: model them**, per Skyler, matching the recommendation below. Mechanism and the untested-combination caveat are in Section 3.2.

**The two cases, verbatim** (both ask the player to *invent* several separate pieces of content, with a specific count and no list to choose from):
- **The Searcher / Network**: "You may gain an ally group of others who had experiences similar to your first encounter—perhaps they're a support group or hobbyist club. **Detail up to five members** with useful skills related to what happened to them."
- **The Spell-Slinger / Arcane Reputation**: "**Pick three big organizations or groups** in the supernatural community, which can include some of the more sociable types of monsters."

Neither fits an existing shape: `FreeTextLabel` alone captures exactly *one* value (Gumshoe's Code); `BespokeJournal` is *unbounded* and multi-field (Curse-Eater's Consumed Magic, Power + Downside, added all campaign long). These sit in the gap — a fixed small number of simple free-text entries, set once at creation.

**The asymmetry with Q1 that decided this one, surfaced only while writing the plain-language examples**: for Q1, "leave as prose" loses nothing storable — an in-play menu is reference text, and there's no per-Hunter answer to record. For Q3 the opposite is true: the player authors permanent character content at creation, so "leave as prose" means **the answer has nowhere on the Hunter sheet to live** (it would fall into the catch-all `Hunter.Background` box, or nowhere). Same nominal cheap answer, materially different cost — which wasn't visible when I first raised Q1 and Q3 side by side as though they were parallel trade-offs.

**Q4 — the inverted pick.** — **RESOLVED 2026-08-30, with a modification that supersedes my recommendation.**

The source (Spell-Slinger's Required Move, Tools and Techniques) reads: "To use your combat magic effectively, you rely on a collection of tools and techniques. **Cross off one; you'll need the rest.**" followed by exactly 4 bulleted items — Consumables, Foci, Gestures, Incantations. I'd recommended modeling it as a pick-1 with the inversion explained in prose (the Natural Attacks precedent).

**Skyler's decision instead** (exact words): *"Let's do an ordinary pick-1, and alter the text to instead say, 'Pick 3 of the 4.'"* — i.e. flip the instruction to positive framing rather than preserving the source's inverted wording. **Adopted.**

**Equivalence verified against the source before applying**: the list has exactly 4 items; crossing off 1 leaves 3, so "pick 3 of the 4" produces an identical outcome. Since the framing flips, the stored values flip with it — this becomes **`MinSelect=3, MaxSelect=3`**, not a pick-1, and the three selected rows are the ones the Hunter *keeps* (consistent with every other selection in the schema) rather than the one they lose.

**Supporting find that makes this more than merely equivalent**: the same playbook's own optional move **Advanced Arcane Training** already reads "If you have two of **your three** Tools and Techniques at the ready, you may ignore the third one." The source itself already treats the result as three kept items — so the positive framing is *more* internally consistent with the playbook's own language than the printed instruction it replaces. That's a genuine argument for the rewrite, not just an acceptable substitution.

**Recorded as a Skyler-directed rewording, explicitly not source-literal** — the same convention already used for Skyler-assigned Move names ("One of Us," "Agency politics") and for normalized inconsistent wording (Underworld's "(choose one)"). Whoever authors this content must know the stored `Description` intentionally differs from the printed page.

**One out-of-scope consequence, flagged not resolved**: Spell-Slinger's Advanced Improvements include "You may cross off another option from your Tools and Techniques" — under positive framing that's "reduce your kept count from 3 to 2." A level-up concern, out of scope here exactly like every other level-up reference in this project, but it will need the same mental translation whenever leveling is designed.

**Process note worth keeping, since it recurred**: two of these four questions came back not as answers but as "I have no idea what this refers to" / "I'm not sure what this refers to" — both the ones where I'd named a category I coined during analysis ("in-play menu," "bounded-repeatable free text") and described it by its properties without quoting the actual playbook text it was abstracted from. Skyler knows the playbooks intimately; the abstraction was the barrier, not the content. Both were answered immediately once a verbatim same-playbook example was supplied. **For any future question about an analyst-coined category: lead with the real quoted source text, let the category name come second or not at all.** (This is the second round in a row this exact failure occurred — the first was the Expatriation derived-vs-stored explanation.)

## 5. Next steps

Mirroring how Phase 5 actually ran, rather than proposing something new:

1. ~~Skyler answers Q1–Q4~~ — **done, 2026-08-30.**
2. ~~`architecture.md` gains the `BespokeSection.PlaybookMoveId` addition~~ — **done: Section 6.8.** Section 6.7 (which declared Move-internal content out of scope) now points there.
3. **Extend the extraction tooling first — a real prerequisite, not a detail.** See "Tooling prerequisites" directly below. Authoring the inline comma/semicolon cases before this is done means hand-transcribing them and losing the pipeline's verification.
4. Open a `custom-move-catalogue.md`, mirroring `bespoke-ruleset-catalogue.md`'s conventions exactly (one `##` per playbook, one `###` per Move with internal structure, progress tracker, "confirmed none" recorded as a real result). **The 14 rows in 2.1 are its complete worklist** — the census is done, so unlike Phase 5 this catalogue starts with its scope already known rather than discovering it playbook by playbook.
5. One-playbook-at-a-time authoring, same rigor: verify against the source PDF, run the formatting pipeline, escalate rather than guess.

### Tooling prerequisites — **BUILT 2026-08-30 by Bowser** (`.squad/decisions/inbox/bowser-hunter-playbooks-phase6-inmove-option-extraction.md`)

Both prerequisites this doc named are now implemented in `extract-moves.mjs`, behind an additive `--options` flag (all 19 prior build scripts' outputs verified byte-identical). **In building them, Bowser found this doc's own description of the starting state was wrong on one count** — corrected below.

1. **Inline comma/semicolon option path — built.** As stated: 6 of the 14 in-scope moves present options as inline runs with no bullets (Crooked ×2, Changeling's Force of Nature, Gumshoe's The Naked City, Professional's Mobility, Searcher's Guardian), and the extractor previously returned nothing structural for them. Now handled; and when option structure is detected without `--options`, the script says so on **stderr** rather than staying silent — the defect this doc named was the silence, not the absence.
2. **The bulleted path was also broken — this doc wrongly assumed it already worked.** *(Correction, 2026-08-30.)* Two independent real bugs, both silent and both producing plausible-looking output:
   - A **capital `B` FateCoreGlyphs glyph marks a Required move** and wasn't recognized as a bullet at all, so every Required move's entire body was silently absorbed into the preceding segment (or into `intro` when it came first). Demonstrated against the pre-change extractor on Host p31. **7 of the 14 in-scope moves are Required**, so this was load-bearing, not marginal.
   - **In-move option bullets use the same `b` glyph as top-level move bullets**, separated only by x-indent (Host p31: 521.2 vs 503.2; same on Searcher p45, Visitor p55, Forged p23) — so option rows were being emitted as title-less top-level "moves."
3. **Title provenance is now measured, not assumed.** Every extracted option carries `titleStyle` and `titleFontCorroborated` (per 2.5(a) above), plus `titleProvenance` — `delimiter:colon`, `delimiter:paren`, or `none`.

### Standing authoring note: `delimiter:paren` always needs a human decision

**Never auto-accept a parenthesis-derived title split.** The counterexample pair is real and sits inside this same content class, not hypothetical:

- **Gumshoe / The Naked City** — "Criminals **(organised)**" and "Criminals **(street)**": the parenthetical is part of the *name*, disambiguating two sibling options. Splitting it out would produce two options both titled "Criminals."
- **Crooked / Artifact** — "Protective amulet **(1-armour magic recharge)**": the parenthetical *is* the description. Not splitting it would bury the entire mechanical effect inside the title.

Identical shape, opposite meaning. Colon-derived splits are safe to accept by default; parenthesis-derived ones require reading the actual content every time.

### Adjacent scope gap — raised, swept, and closed (2026-08-30)

Bowser's new inline path also fired on **The Monstrous's "Pure Drive"** (p37) — an *already-authored Phase 5 bespoke option* containing its own creation-time inline pick ("One emotion rules you. **Pick from:** hunger, hate, anger, …"). That's a pick nested inside a **bespoke option**, not inside a Move, so it falls outside this phase's scope as defined in 2.1.

**Resolved: Skyler sanctioned reopening the completed Phase 5 catalogue and sweeping all 28 playbooks' bespoke content with the new tooling.** Result: 123 raw hits → 14 in Phase 5 scope → **exactly one genuine gap, Pure Drive itself**, now remodeled as nested options in `bespoke-ruleset-catalogue.md`. Everything else was already modeled, a deliberate stakeholder decision, out of bespoke scope, or correctly prose — full adjudication table in that file's status block.

**What this means for this doc's own completeness claim**: Section 2.1 is complete for what it scopes — creation-time picks inside **Moves**. The parallel question for picks inside **bespoke options** has now been answered independently by that sweep, so the gap this note originally flagged is closed rather than outstanding. Neither scope makes a claim about the other; both have now been swept with the same tooling.

**Sequencing note worth acting on before Phase 4 starts**: The Crooked is both a Phase 4 pilot playbook *and* now known to carry two creation-time in-move picks (Artifact, Deal with the Devil). If Phase 4 authors Crooked before Phase 6's schema ships, that content has to be either deferred or re-authored afterward. This was invisible until this census — it's the single most actionable consequence of having run it.

## Cross-references

- **`architecture.md` Section 6.8** — the implementation-ready spec for `BespokeSection.PlaybookMoveId`; Section 6.7 is the scope-boundary note that now points to it. Sections 6.1–6.6 are the bespoke-ruleset schema this reuses wholesale.
- **`phases.md` Phase 6** — the phase this supports; its scope boundary and seed-not-census warning are both confirmed by this census (its two-pattern framing is revised — see Section 2).
- **`bespoke-ruleset-catalogue.md`** — where the pre-existing (half-complete) trap flags live, in place per playbook. Section 2.1 here supersedes that set as the authoritative inventory.
- **`pdf-extraction-pipeline.md`** / `tools/pdf-extract/` — the extraction mechanism; the inline-list gap above is a prerequisite against it.
- **`.squad/decisions/inbox/yoshi-hunter-playbooks-phase6-custom-moves-model.md`** — the decision record for this phase's settled approach.
