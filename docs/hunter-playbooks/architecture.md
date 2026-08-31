# Hunter Playbooks — Architecture

## 0. What carried over from the deleted prior pass, and what changed

The prior pass (`hunter-playbooks-plan.md`, 2026-08-24, deleted) scoped all 28 playbooks at once and committed to a schema before the brief's phasing was settled. This pass has a narrower, sequenced brief from Skyler (Data Admin restructuring first, standard-vs-bespoke split second, 3-playbook validation before the other 25). Two findings from that prior pass are reused as-is because they're facts about the environment/PDF, not design conclusions:

- **The PDF's actual playbook count is 28** (confirmed by a full extraction last time; a naive anchor grep undercounts due to column-layout artifacts). Not re-verified this pass since only 3 playbooks were read in depth, but nothing in this pass contradicts it.
- **`pdftotext -layout` (available via Git Bash `/mingw64/bin/pdftotext`) is the right extraction tool** — the `Read` tool's PDF path needs poppler page-rendering, not installed here.

Everything else — the data model, the seeding/deployment recommendation, and the standard-vs-bespoke split — is derived fresh in this doc from directly reading The Chosen, The Crooked, and The Divine, and from re-scanning the current Data Admin/sidebar/Monster-form/Mystery-wizard code (not from the deleted doc's conclusions). Where a conclusion below differs materially from the prior pass, it's called out explicitly (Section 4, seeding).

**Revised 2026-08-25**: the first version of Section 4 below was wrong and has been rewritten, not patched. It concluded Playbooks should be ordinary Admin-UI-authored CRUD rows with no seed mechanism, reasoning from Phase 3/4's Admin UI requirement alone. Skyler corrected this directly: the canonical 28-playbook set is standard content expected in *every* environment automatically, the same way the static lookup tables already are — the Admin UI's actual purpose is (a) letting Skyler add further templates later without a code deploy, and (b) giving Phases 2–4 a working surface to validate the data model, not the mechanism for the initial import. Section 4 now reflects that.

**Revised again 2026-08-25, same day**: Skyler answered the follow-up open questions this correction raised, and one answer changed a second load-bearing assumption in Section 4 — the *authoring* mechanism (who/what actually produces the canonical 28's data) was still wrong even after the first revision. It assumed a human types each playbook into the Phase 3 Admin UI form; Skyler's actual intent is an AI agent authors each playbook via the real API, with the form serving as a testing/manual-tweak surface only. Section 4 (Path A) and Section 3 (`BasicMove`, the `Hunter` live-link design) were both revised again — see each section's own "Resolved"/"Revised" markers for what changed and why.

## 1. Column-layout sanity checks (per the task's explicit warning)

The PDF is laid out in 2–3 vertical columns per page-spread, and `pdftotext -layout` places text by row position, not by logical grouping. Two checks were run against Chosen/Crooked/Divine specifically:

**Suspicious stat/move pairing — confirmed artifact, not real data.** Every playbook's front sheet shows `CHARM / COOL / SHARP / TOUGH / WEIRD` (blank rating boxes) immediately to the left of a list of exactly 8 move names. Naively read line-by-line, this looks like each stat is paired with a move (e.g. "CHARM — Manipulate Someone", "SHARP — Act Under Pressure"). This is spurious: the 8-move list is the **same list, in the same order, word-for-word**, on Chosen, Crooked, Divine, and every other playbook glimpsed in the extraction (Curse-eater, Envoy, Expert) — Manipulate Someone, Act Under Pressure, Help Out, Investigate a Mystery, Read a Bad Situation, Kick Some Ass, Protect Someone, Use Magic. It's the fixed 8 basic moves everyone gets, printed as a static reference list next to the (unrelated) rating boxes — not a per-playbook or per-stat pairing. `pdftotext -layout` merged two unrelated columns onto matching line numbers by coincidence of vertical position. **No schema implication**: basic moves are universal, not playbook data (confirms Skyler's own guess).

**Page-bleed contamination — caught and discarded.** An early read of the raw offset range around Chosen's title header pulled in trailing content from the previous playbook in the PDF (apparently "Changeling" — "Unknown Heritage tag" references) because the page-spread rows overlapped. This was caught by cross-checking wording (Chosen's real Advanced Improvements list says "Change this hunter to a new type" / "Create a second hunter to play as well as this one," matching Crooked's and Divine's wording exactly — the contaminated read said "new playbook" / "in addition to this one," which turned out to belong to the other playbook). Re-read from the correct offset resolved it. Flagged here because it's a second instance of exactly the layout-artifact risk the task called out, and the wrong version would have overstated Chosen's Advanced Improvements list by 3 items.

No other suspicious pairings were found in Chosen/Crooked/Divine.

## 2. Standard vs. bespoke — section by section

Reading order follows Skyler's own list of standard-rule sections.

**Revised 2026-08-30 — Getting Started, Introductions, and Leveling Up are now in scope, reversing this section's original exclusion.** The original pass skipped Introductions and Leveling Up per the brief ("pure gameplay-flow prose, no data") and never considered Getting Started at all. Skyler put all three in scope while re-scoping Phase 4, and the exclusion was wrong on the facts for at least two of them — verified directly against The Crooked's pages 11–12:

- **Getting Started** genuinely varies per playbook, and not just in flavor: it names that playbook's own sections in order, bespoke ones included. Crooked's reads "To make your Crooked, pick a name. Then follow the instructions in this playbook to decide your look, ratings, background, heat, underworld, moves, and gear. Finally, introduce yourself and pick history." A playbook with different bespoke sections lists different words here. The catalogue had already noticed this independently and used it as a structural tell (see `bespoke-ruleset-catalogue.md`'s Spooky and Monstrous entries, which cite Getting Started's own wording as evidence for what counts as a peer section).
- **Introductions** and **Leveling Up** are short, near-uniform prose blocks that name the playbook and restate its own numbers ("introduce your Crooked by name and look"; "When you have filled all five experience boxes, you level up"). Closer to the original "no data" read than Getting Started is — but they're still per-playbook strings that a Hunter sheet has to render, and there's no reason to treat them differently from `LuckSpecialText`, which is exactly the same shape.

All three model as flat free-text scalars on `Playbook` — `GettingStartedText`, `IntroductionsText`, `LevelingUpText` — with no structure to decompose. See Section 3.

### Ability ratings — standard, verified fully uniform in shape

Every playbook: 5 stats (`Charm`/`Cool`/`Sharp`/`Tough`/`Weird`), and "Ratings, pick one line" — 5 preset arrays of 5 signed integers each. Chosen and Divine have 5 lines; Crooked has 5 lines. Values differ per playbook (not asserted to sum to a fixed total — not checked, and not needed for the model). **Model as a child table**, one row per preset array, 5 int columns.

### Luck — standard track, bespoke trigger text

Track shape is **word-for-word identical** across all three: "Mark luck to change a roll to 12 or avoid all harm from an injury," 7 boxes Okay→Doomed. What happens when a Luck point is spent is playbook-specific flavor text ("Chosen special," "Crooked special," "Divine special") — one sentence each, different content, same structural role (a trigger description, not a mechanic with its own sub-fields). Per Skyler's instruction, the 7-box count is a real field on `Playbook`, not a hardcoded constant, even though it's identical in all three read so far.

### Harm — standard, fully uniform in the three sampled

"When you reach 4 or more, mark unstable." 3 Okay boxes + 4 more to Dying (7 total), 1 Unstable box. Identical text and box counts across Chosen/Crooked/Divine. Still modeled as real fields (unstable threshold, box count) per Skyler's instruction, since a later playbook among the other 25 could vary this.

### Experience — standard, fully uniform in the three sampled

5 boxes, "Whenever you roll and get a total of 6 or less, or when a move tells you to, mark an experience box." Identical across all three. Same treatment: real fields, not hardcoded.

### Extra Tracks — new finding, 2026-08-27 (Curse-Eater's "Corruption"), additive-only, doesn't touch Luck/Harm/Experience

Curse-Eater has a fourth tracked stat — "Corruption" (7 boxes, "Okay"→"Lost," a different end-label than Luck's "Doomed" or Harm's "Dying"/"Unstable") — playbook-specific, not universal like Luck/Harm/Experience. Real architectural question this raised: Luck/Harm/Experience are hardcoded fields directly on `Playbook` (`LuckBoxCount`/`LuckSpecialText`/`HarmUnstableThreshold`/`HarmBoxCount`/`ExperienceBoxCount`), not a normalized table — bolting on one-off `Corruption*` columns the same way would work for this one playbook but risks needing a new column set for every future one-off track a playbook turns out to have.

**Resolved, approved by Skyler**: a new, purely additive `PlaybookExtraTrack` table, **not** a migration of the existing three fields into a unified table. Luck/Harm/Experience stay exactly as already built — zero rework, zero disruption to the already-"fully specified" Phase 2 schema.

```
PlaybookExtraTrack
  Id, PlaybookId, Name ("Corruption"), Description, EffectText (nullable — reuses BespokeSection's exact Description/EffectText role split rather than inventing a third field name/shape)
  BoxCount (int), StartLabel (nullable string, e.g. "Loving" — added 2026-08-28, see below), EndLabel (string, e.g. "Lost")
```

**`StartLabel`, added 2026-08-28 — The Pararomantic's "Relationship Status" track.** Every track modeled so far (Luck, Harm, Corruption) uses the same generic "Okay" as its start label — never a real per-playbook value, just the universal default, so no field existed to hold it. Relationship Status is the first track whose start label carries actual thematic meaning ("Loving `bbbbbbb` Broken," not "Okay `bbbbbbb` Broken"). Rather than hardcoding "Okay" as a UI constant forever, added a nullable `StartLabel` column: `null` means "render the implicit 'Okay' default" (every existing row, including Corruption, stays `null` — no retroactive change), a populated value overrides it. Same nullable-column-signals-applicability pattern already used throughout this schema (`BespokeSection.MinSelect`/`MaxSelect` null vs. populated, `FreeTextLabel` null vs. populated) rather than a second discriminator flag.

Instance side needs a small parallel, since an extra track can't be a fixed column on `Hunter` the way Luck/Harm/Experience are (not every Playbook has one): `HunterExtraTrackValue (Id, HunterId, ExtraTrackId, CurrentValue)`.

**Deliberate inconsistency, stated explicitly rather than glossed over**: this means Luck/Harm/Experience and Corruption end up modeled differently from each other (3 hardcoded fields on `Playbook`, 1 normalized table) rather than uniformly. Accepted trade-off: correctness/consistency later (a full `PlaybookTrack` unification) would cost a real migration against an already-built schema now, for a benefit (one shape instead of two) that isn't worth that cost yet, given only one playbook so far needs the extra-track shape at all.

**Content-fidelity split, corrected 2026-08-27 after Bowser's extraction contradicted the original proposal.** The original version of this note proposed a 3-way split, attributing "Record what the magic was, the power it offers you, and the downside it asks of you. The Keeper will provide these, and can also confirm whether you are in the presence of a consumable curse." to the Consumed Magic journal (`BespokeJournal.Description`) on semantic grounds — the sentences are clearly *about* recording magic/power/downside. **Bowser verified directly against the PDF item stream that this is wrong as a matter of source fact, not just a judgment call to revisit**: "Consumed MagiC (Power, Downside)" has zero body text of its own on the page — it's the last item in the column's item stream, a bare table heading with nothing following it, not a described mechanic with its own prose. The entire paragraph, including those two sentences, sits under "Corruption" alone.

**Resolved**: the whole paragraph belongs to Corruption. `BespokeJournal.Description` (Consumed Magic) is genuinely **null** — the source provides no separate framing prose for it beyond its own bare heading, which already supplies the Journal's `Title` ("Consumed Magic") and its two `BespokeJournalField` labels ("Power", "Downside"). This is a real, honest null, not a placeholder to fill in later — inventing framing text the source doesn't have would be the same category of fabrication already declined for bold-span guessing back when Background was first modeled.

**Why this reading, not stretching the semantically-relevant sentences across the header boundary anyway**: Covenant already established the precedent for exactly this shape of question (prose whose *subject matter* points at a nearby differently-headed structure) — Skyler's answer there was to respect the source's own header boundaries (a standalone zero-option Section) rather than stretch a field's role across them. Applying the same precedent here rather than re-opening it: content stays with the header it's actually printed under, even when its subject matter also relates to something else nearby.

Corruption's own `Description`/`EffectText` split, using the now-corrected full paragraph and Bowser's real markup:
- **`Description`**: "When you consume evil magic, you gain corruption as well as the ability to use some of those powers. Record what the magic was, the power it offers you, and the downside it asks of you. The Keeper will provide these, and can also confirm whether you are in the presence of a consumable curse."
- **`EffectText`**: "Repeated `<b>`devouring evil`</b>` may give the same or different effects. Other moves, starting with `<b>`unleash corruption`</b>`, depend on these corruptions. If you `<i>`should`</i>` take corruption, but the track is full, you become a monster under the Keeper's control." Both bold spans are cross-references to this playbook's own Required moves (Devour Evil, Unleash Corruption) — the same "bold marks a move cross-reference" pattern already seen in Action Scientist and Changeling.

### Moves — standard container, playbook-specific content and pick-count

Every playbook: "You get all the basic moves, plus/and **N** [Playbook] moves," then a list of named moves to choose from. N varies (Chosen 3, Crooked 2, Divine 3). Within Chosen's list, 2 moves are explicitly pre-granted ("You get these two:") and don't count against the pick budget — the remaining N−2 are chosen from an optional list. Crooked and Divine have no pre-granted moves; all N are chosen from the full list. **This generalizes cleanly**: `Playbook.MoveGrantCount` (int) + child rows each flagged `Required` (bool, renamed 2026-08-27 from `IsAutoGranted` — same field, clearer name, see note below). A playbook with 0 required moves and one with 2 both fit the same shape.

**Renamed, not newly added, 2026-08-27 — Celebrity re-validated this exact shape, didn't reveal a gap.** Walking The Celebrity (the 5th playbook processed, first outside the original 3 pilots + Action Scientist) surfaced its "Fakelore" move as always-granted ("You get this one:") alongside a separate pick-2-of-7 pool (Scream Queen, The Price of Fame, I Have People, I Do My Own Stunts, Disarming, But I Play One on TV, Acting, My Dear Boy — 7 named options, not 6). This was flagged as a possible new schema gap and traced back carefully: it isn't one. It's the identical shape already modeled for Chosen's Fate-adjacent Moves back in this section's original pass (2 pre-granted + pick 1 of 5 = 3 total) — Celebrity is just a second, independent confirmation of a shape the schema already handled (1 required + pick 2 of 7 = 3 total), not a new case. The only actual change here is renaming `IsAutoGranted` → `Required` to match Skyler's proposed name, which reads more directly as "is this move mandatory" — a documentation/naming clarity pass, zero functional or schema change.

The 8 basic moves themselves are universal (Section 1) — not playbook data. **Resolved 2026-08-25**: a real `BasicMove` DB reference table, not a frontend constant — Skyler expects to tweak the content/representation over time and wants that living in the database, matching every other reference-table convention in this app, even though it's only 8 rows today.

**Scope gap confirmed 2026-08-26, narrowed same day**: `PlaybookMove.DescriptionText` specifically needs the formatting-fidelity treatment worked out for bespoke option descriptions in `phase5-bespoke-ideation.md` Section 4 — a small constrained HTML subset (`<b>`/`<i>`/`<ul>`/`<li>`), not plain text. Real example: many playbooks' custom-move sections use bulleted lists for roll-result breakdowns (10+/7–9/miss), which plain text would flatten and lose. This was a genuine miss in this section's original pass, not something deferred on purpose — caught only once bespoke-ruleset ideation surfaced the same underlying need. **Confirmed scoped to Moves only, not a general rule across every standard field**: Skyler reviewed the other standard sections (ability ratings, luck/harm/experience, gear, pronouns, looks, history, improvements, advanced improvements) and confirmed plain text is sufficient for all of them — the earlier version of this note read as a broader "every Description-type field" requirement (naming `PlaybookGearOption.MechanicalText`/`PlaybookImprovement.Text` as likely examples too), which overstated it; corrected here.

**Extraction mechanism, resolved 2026-08-26 — no longer an open concern.** Skyler approved Bowser's pdf.js-based extraction pipeline (`docs/hunter-playbooks/pdf-extraction-pipeline.md`, tools in `tools/pdf-extract/`) after both the Crooked/Background `<b>` acceptance test and a second validation pass against The Covenant's Moves section (confirming `<i>` and nested `<ul>`/`<li>` roll-result breakdowns) passed. `tools/pdf-extract/extract-moves.mjs` specifically produces `{title, descriptionHtml}` per move directly from the PDF, `<ul><li>` included where the source has it — this is the concrete mechanism `PlaybookMove.DescriptionText` gets populated from, not a theoretical requirement waiting on tooling. Validation: Phase 4's checkpoint (`phases.md` Phase 4) confirms this is captured correctly for the 3 pilots' Moves content specifically before Phase 5 proceeds.

### Gear — standard container, more varied shape than Skyler's own guess

Skyler's working guess was "named presets of weapon tags." Verified against the three:

- **Crooked**: "Effective weapons, pick three" from 9 named presets, each with parenthetical mechanical text (`.22 revolver (1-harm close reload small)`) — matches the guess exactly.
- **Divine**: "Pick one divine weapon" from 5 named presets with the same parenthetical shape, **plus** a fixed, no-choice grant ("You also get divine armour (1-armour holy)") — a *zero-choice* category, not a pick-from-list one.
- **Chosen**: a genuine build-your-own weapon — pick 1 of 4 "forms," pick 3 of 7 "business-end" modifiers, pick 1 material (from a list or freeform), **plus** an optional "protective gear worth 1-armour, if you want" category (pick 0 or 1). This is not a flat preset list.

Chosen's build-your-own weapon still decomposes cleanly into the same shape as the others: it's just **three separate gear categories** (Form, Business-end, Material) under one logical "Special Weapon" grouping, each with its own pick count. No new concept needed — just a nullable pick-count and an "optional" flag:

- `PlaybookGearCategory`: `Id`, `PlaybookId`, `Label` (e.g. "Effective weapons," "Business-end (choose 3 options)"), `PickCount` (int, nullable — **null means every listed option is granted automatically**, covering Divine's fixed armor), `IsOptional` (bool, covers Chosen's "if you want" protective gear), `SortOrder`.
- `PlaybookGearOption`: `Id`, `CategoryId`, `Name`, `MechanicalText` (nullable free text, e.g. `"1-harm close reload small"` or `"add the magic tag"`).

**Mechanical detail stays free text, confirmed again this pass, not just assumed from last time**: some options carry full weapon-tag-style stats, some carry none at all (Divine's "Resources: Communication devices — Cell phone" has zero harm/range/tags — it's a pure narrative item). No uniform taxonomy exists across playbooks' gear to decompose into structured columns, and there's still no play-state consumer that would need to query gear mechanically (that's Hunter-instance combat math, out of scope here).

### Pronouns — not Playbook-level data at all

Every playbook sheet has a blank "Pronouns: ___" line. There's nothing to model at the `Playbook` level — no options, no structure. This confirms `Hunter.Pronouns: string?` should exist as a **Hunter-instance** field (Phase 10), with zero Playbook schema needed.

### Looks — standard, 2–3 categories per playbook, always freeform-capable

"Look, pick one from each list" — Chosen has 3 categories (age/vibe, face, clothes), Crooked has 2 (eyes, clothes), Divine has 3 (embodiment, eyes, clothes). Each category lists several preset text options and, in every category sampled, ends with a blank-fill option (`__________ eyes`). **Model**: `PlaybookLookCategory` (`Id`, `PlaybookId`, `SortOrder`, `AllowsFreeform` bool, `GroupLabel` string?) → `PlaybookLookOption` (`Id`, `CategoryId`, `Text`). `AllowsFreeform` was true in every category sampled — still a real column rather than an assumed UI constant, per Skyler's instruction, in case a later playbook's category is closed-list-only.

**`GroupLabel` added 2026-08-31 (Phase 8 group 2).** Nullable, and null on 27 of the 28 playbooks. The Forged is the only hunter with two physical forms: its seven Look categories are printed under "Human look:" and "Weapon look:", and without a label the data cannot say which four describe the weapon rather than the person. Put on the category rather than in a separate group table deliberately — the label is a heading repeated across consecutive categories, not an entity with any content of its own, and a grouping table would add a join for one playbook.

### History — deferred exactly as instructed; modeled as flat text

Each playbook has 6–9 unique relationship prompts ("go around the group, pick one for each other hunter"). Per Skyler's explicit instruction to list these as text and not model relationships, `Playbook.HistoryPromptsText` is a single free-text field holding the full prompt list, not a normalized per-hunter-relationship table. (A row-per-prompt child table is a cheap, non-blocking alternative if finer-grained display is wanted later — noted, not treated as an open question, since Skyler's instruction already resolves the harder relational-modeling question.)

### Improvements / Advanced Improvements — standard container, content-level variation only

This is the section Skyler predicted would be "some standard, some playbook-specific," and that's confirmed **at the option level**, but the **section itself is 100% standard in shape** across all three:

- Every playbook's Improvements list has exactly 10 numbered options; Advanced Improvements has 7–8.
- A near-universal core repeats near-verbatim across all three: 4–5 "Get +1 [Stat], max +N" options (Crooked is missing a Weird option — 4 stats, not 5, a real confirmed deviation, not assumed), 2× "Take another [Playbook] move," 2× "Take a move from another playbook" (**literally identical text** in all three), and exactly one bespoke grant unique to the playbook (Chosen: "Gain an ally"; Crooked: "Gain an ally: one of your old crew" + a second bespoke "Recover a stash of money..."; Divine: "Gain a lesser divine being as an ally...").
- Advanced Improvements: 6 items are **word-for-word identical** across all three ("Get +1 to any rating, max +3," "Change this hunter to a new type," "Create a second hunter to play as well as this one," "Mark two of the basic moves as advanced," "Mark another two of the basic moves as advanced," "Retire this hunter to safety"), a 7th near-universal one varies only in wording ("Erase one used Luck mark from your playbook" vs. Chosen's "Get back one used Luck point" — same effect, different text), and Chosen/Divine each add exactly one bespoke 8th item (Crooked has none).

Because the variation is entirely in **which text appears**, not in any structural shape the container needs to support, this doesn't need semantic sub-typing (no `IsStatBoost`/`IsMoveGrant`/`IsBespoke` columns) — that would be over-fitting a taxonomy to 3 samples and risks breaking on playbook #4. **Model as one flat table**: `PlaybookImprovement` (`Id`, `PlaybookId`, `Text`, `IsAdvanced` bool, `SortOrder`). This is the cleanest finding in this pass — a section predicted to be a data-modeling problem turns out not to be one at all once its real shape is read directly.

## 3. Proposed data model

Extends the existing `MonsterArchetype`/`MonsterType`/`WeaponTag` + `MonsterAttackWeaponTag` bridge-table precedent (`Data/Entities/DomainEntities.cs`) — a reference/lookup entity with normalized child tables, matching the only shape this codebase already uses at scale. No JSON columns anywhere in this API project (`HasColumnType`/`HasConversion`/`jsonb` all absent) — not introduced here either.

```
Playbook
  Id, Name, Description
  LuckBoxCount (int), LuckSpecialText (free text)
  HarmUnstableThreshold (int), HarmBoxCount (int)
  ExperienceBoxCount (int)
  MoveGrantCount (int)                 -- non-nullable; stays 0 until Phase 6 authors Moves, see below
  GettingStartedText (free text)       -- added 2026-08-30, see Section 2
  IntroductionsText (free text)        -- added 2026-08-30, see Section 2
  LevelingUpText (free text)           -- added 2026-08-30, see Section 2
  HistoryPromptsText (free text)       -- includes the section's own intro sentence, not just the prompt list

PlaybookStatArrayOption      (Id, PlaybookId, Charm, Cool, Sharp, Tough, Weird, SortOrder)
PlaybookMove                 (Id, PlaybookId, Name, DescriptionText, Required, IsAdvanced, SortOrder)
PlaybookGearCategory         (Id, PlaybookId, Label [512 chars, widened 2026-08-31], PickCount [nullable], IsOptional, SortOrder)
PlaybookGearOption           (Id, CategoryId, Name, MechanicalText [nullable])
PlaybookLookCategory         (Id, PlaybookId, SortOrder, AllowsFreeform)
PlaybookLookOption           (Id, CategoryId, Text)
PlaybookImprovement          (Id, PlaybookId, Text, IsAdvanced, SortOrder)   -- one table; IsAdvanced splits the two printed lists, each with its own SortOrder sequence
PlaybookExtraTrack           (Id, PlaybookId, Name, Description [nullable, 2026-08-31], EffectText [nullable], BoxCount, StartLabel [nullable, added 2026-08-28], EndLabel)   -- added 2026-08-27, see Section 2 "Extra Tracks"; additive only, not a rework of Luck/Harm/Experience above

BespokeSection                (Id, PlaybookId, PlaybookMoveId [nullable FK — Phase 6, see Section 6.8], Title, Description, EffectText [nullable], FreeTextLabel [nullable], MinSelect [nullable], MaxSelect [nullable], MinInstances [nullable], MaxInstances [nullable])   -- Phase 5, see Section 6 for full field-by-field spec
BespokeOption                 (Id, SectionId, ParentOptionId [nullable, self-ref], Title [nullable], DescriptionText [nullable], MinSelect [nullable], MaxSelect [nullable], NumericMin [nullable], NumericMax [nullable])   -- Phase 5, see Section 6
BespokeJournal                 (Id, PlaybookId, Title, Description [nullable], EffectText [nullable])   -- Phase 5, see Section 6
BespokeJournalField           (Id, JournalId, Label, SortOrder)   -- Phase 5, see Section 6

BasicMove                    (Id, Name, DescriptionText)   -- real reference table, 8 rows, see Section 2 "Moves"
```

Every child table follows the existing `MonsterAttack`/`MonsterPower`-style shape (owning-entity FK, no further nesting beyond one level except gear category→option, which mirrors `MonsterAttack`→`MonsterAttackWeaponTag` in spirit though not in exact bridge-table form, since gear options aren't a shared reference vocabulary the way weapon tags are).

**`Playbook.Tagline` removed 2026-08-30, after Phase 4 proved it had nothing to hold.** The original schema gave `Playbook` both a `Tagline` ("short flavor line") and a `Description`, on the assumption the sheets carry both. Authoring all three pilots showed they do not: each playbook prints exactly **one** flavor blurb under its title — prose for The Chosen, a quotation for The Crooked, verse for The Divine — and that single blurb is `Description`. `Tagline` was null on all three and had no plausible source across the remaining 25. Dropped at Skyler's direction via migration `DropPlaybookTagline`, rather than left as a permanently-null column that every future authoring pass would have to re-decide about. **There is no short-flavor-line field on `Playbook`; do not add one back without a source that needs it.**

**Improvement ordering, decided 2026-08-30**: stored in the order printed on the playbook, top to bottom, **all regular improvements first, then all advanced** — `IsAdvanced` separates them within the one table, and each list carries its own `SortOrder` sequence starting at 0. Most playbooks print Improvements in a single column, where this is unambiguous. **Where a playbook's layout makes the reading order genuinely ambiguous, it is surfaced for Skyler to decide, never guessed.** That has already happened once: The Chosen prints its Improvements in two sub-columns (measured at x=64 and x=88), where a literal column-by-column read puts its two "Take a move from another playbook" entries 6th and 7th, while the pattern both other pilots use in their unambiguous single-column lists puts them last. Skyler chose the latter — stat boosts → take-another-playbook-move ×2 → bespoke grants → take-a-move-from-another-playbook ×2 — which is also what `pdftotext -raw`'s item stream emits.

**`PlaybookMove.IsAdvanced` added 2026-08-31 (Phase 8 group 2).** Non-nullable bool defaulting to false. Marks a move that can only ever be taken through an advanced improvement — never granted, never in the pick pool, and so never offered at Hunter creation. The Hex is the only playbook of the 28 that has any (Apotheosis and Synthesis, behind its "Choose one advanced Hex move" improvement), verified across all 58 pages rather than assumed; the alternative was either dropping that rules text or letting a creation UI offer moves the rules do not. It splits the one table into two lists exactly as `PlaybookImprovement.IsAdvanced` does, with the same consequences: **each list keeps its own `SortOrder` sequence starting at 0**, reads back ordered `IsAdvanced` then `SortOrder`, and is mutually exclusive with `Required`.

**`MoveGrantCount` carries a known-wrong value between Phase 4 and Phase 6, deliberately (decided 2026-08-30).** Skyler re-scoped Phase 4 to exclude the entire Moves section, which leaves this column — a non-nullable `int` on `Playbook`, not on `PlaybookMove` — with no correct value to hold at authoring time. Three options were weighed (author just the integer; make the column nullable; leave it non-nullable at `0`); Skyler chose to leave it non-nullable and default to `0`. Stated plainly because it has a real consequence: between Phase 4 and Phase 6, `MoveGrantCount == 0` is **indistinguishable from a playbook that genuinely grants zero moves**, so nothing in that window should branch on it or treat it as authored data. Phase 6 populates it alongside the `PlaybookMove` rows themselves.

### Persistence semantics for the upsert-the-graph endpoint (decided 2026-08-30)

`PUT /api/playbooks/{id}` carries the entire nested graph in one request (Section 4, `phases.md` Phase 3). How child rows are reconciled against what's already stored was never specified and is load-bearing, because Section 3's own live-link decision makes child row **identity** the thing Hunters depend on: `HunterMove` points at a `PlaybookMove.Id`, `HunterGearSelection` at a `PlaybookGearOption.Id`, `Hunter.PlaybookStatArrayOptionId` at a `PlaybookStatArrayOption.Id`, and `HunterBespokeSelection` at a `BespokeOption.Id`.

**Decided: Id-based diff.** Incoming children carry their `Id` when they already exist and omit it when new. The service updates matched rows in place, inserts unmatched ones, and deletes stored rows absent from the payload — all in one transaction. Direct requirement this places on Phase 3's frontend: the `GET` → form → `PUT` round-trip must preserve child `Id`s through the form model, not just their values. Creates and agent-authored payloads simply carry no `Id`s, which is the same code path as "all children are new."

**Rejected: delete-all-and-reinsert.** It churns every child `Id` on every save, which breaks in both available FK configurations — cascade silently wipes an edited playbook's Hunters' picks with nothing surfacing the loss, restrict makes any playbook uneditable the moment one Hunter uses it. It also undercuts Section 4 step 5's "further changes ship as row-targeted EF Core migrations," which assumes stable `Id`s in the committed seed.

**Implementation trap found while building this, 2026-08-30 — worth recording, because it fails loudly but for a misleading reason.** The Playbook entities populate `Id` inline (`= Guid.NewGuid()`), matching every other entity in this codebase. Under EF's default `ValueGeneratedOnAdd` for `Guid` keys, a *new* child added to an *already-tracked* parent graph carries a non-default key, which EF reads as "this row already exists" — so it classifies the entity `Modified` and emits an `UPDATE` matching zero rows. The surfaced symptom is `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0`, which reads like a concurrency problem and is nothing of the sort. Fix: `ValueGeneratedNever()` on every key in `ConfigurePlaybooks`, which is simply the truth about these keys and makes EF decide Added-vs-Modified from whether the entity is tracked. Model-side metadata only — no DDL, no migration (`dotnet ef migrations has-pending-model-changes` confirms none). The pre-existing entities never hit this because none of them add children to a tracked graph; they all go through `Add()` on the root, which marks the whole graph Added regardless of key values. **Any future domain that adopts this upsert-the-graph pattern needs the same declaration.**

**Deferred to Phase 9/10, not dropped**: rejecting (`409`) the deletion of a child row a Hunter still references, rather than letting the FK cascade it away. Under an Id-based diff this is a strict addition — a usage-count query per removed child plus an error path in the admin form — and no `Hunter` row can exist until Phase 9 creates the table, so it is unimplementable and untestable before then. `DELETE /api/playbooks/{id}` inherits the same question at the same time. Until then, the residual sharp edge is real and accepted: removing a child row from a playbook silently removes any Hunter selections pointing at it.

**Half-resolved 2026-08-31 (Phase 9) — the whole-Playbook case is done; the per-child case is still Phase 10.** `DELETE /api/playbooks/{id}` now refuses with `409` and a message naming how many Hunters are built from the playbook. This was brought forward from "Phase 9/10" because Phase 9 is what makes it reachable: `Hunter` is the first row that can reference a Playbook, and the EF default for its required FK would have been `Cascade` — deleting a Playbook would have silently destroyed every Hunter built from it, an entire top-level user record rather than one pick. The FK is `Restrict` instead, and the service guard exists so that shows up as an actionable 409 rather than an unhandled constraint violation. Three outcomes were verified as genuinely distinct, since a guard that swallows one into another is the easy mistake here: `204` unreferenced, `409` in use, `404` missing.

Two knock-on changes: `ServiceErrorType` gained a `Conflict` member (every other controller's error switch falls to its own default for it, which is correct — none of them produce it), and `IPlaybookService.DeleteAsync` returns `ServiceResult<bool>` rather than `bool`, because the bare bool could not distinguish "no such playbook" from "in use".

**Fully resolved 2026-08-31 (Phase 10) — the per-child case now works too.** `PUT /api/playbooks/{id}` computes which child rows its Id-based diff would delete and refuses with `409` if any Hunter still points at one, naming it: *Cannot remove an entry that a hunter is using: move "Destiny's Plaything". Update those hunters first.* Three kinds are checked, because they are the only ones anything can reference — `PlaybookStatArrayOption`, `PlaybookMove`, `PlaybookGearOption` — and all three FKs from the Hunter side are `Restrict`. Looks, improvements, bespoke rows and journals stay freely removable; they have no instance-side table yet.

The check runs before any mutation, so a rejected edit leaves the tracked graph untouched (asserted). It is one query regardless of how many rows an edit removes, and it returns ids rather than a count specifically so the message can name the row — *"3 entries are in use"* would be an error the user cannot act on.

**The sharp edge described above is now closed**, and with it the last of the "deferred to Phase 9/10" items in this section.

`Hunter` (Phase 9/10, sketched here for completeness, not fully speced — see `phases.md` Phase 10):

```
Hunter
  Id, PlaybookId (FK), Name, Pronouns
  PlaybookStatArrayOptionId (FK)     -- which preset rating array was picked; live-linked, not copied
  Luck, Harm, Experience              -- current, mutable, instance state
  Background (free text)              -- catch-all for looks/bespoke-pick/history answers, Phase 10 scope
HunterMove            (HunterId, PlaybookMoveId)         -- bridge, the moves this Hunter actually picked
HunterGearSelection   (HunterId, PlaybookGearOptionId)   -- bridge, the gear this Hunter actually picked
HunterExtraTrackValue (Id, HunterId, ExtraTrackId, CurrentValue)   -- added 2026-08-27; can't be a fixed Hunter column like Luck/Harm/Experience since not every Playbook has one
HunterBespokeSelection       (Id, HunterId, BespokeOptionId [required — one documented exception, see Section 6], FreeformText [nullable], NumericValue [nullable], SectionInstanceId [nullable FK])   -- Phase 5, see Section 6
HunterBespokeSectionInstance (Id, HunterId, SectionId [FK], Name [nullable], SortOrder)   -- Phase 5, see Section 6
HunterJournalEntry           (Id, HunterId, JournalId, SortOrder)   -- Phase 5, see Section 6
HunterJournalEntryFieldValue (Id, EntryId, JournalFieldId, Text)   -- Phase 5, see Section 6
```

**Resolved 2026-08-25 — live-linked, not snapshotted.** The original version of this section proposed copying chosen stat values directly onto `Hunter` (plain `Charm`/`Cool`/`Sharp`/`Tough`/`Weird` int columns) specifically so an edited Playbook wouldn't retroactively change an already-created Hunter's sheet. Skyler corrected this: Hunters should stay live-linked to their Playbook template via FK, not snapshotted. Skyler doesn't expect playbooks to change much if ever, and if a template *does* change meaningfully, existing Hunters built from it are expected to change too — that's the intended behavior of the live link, not a problem to design around. `HunterMove`/`HunterGearSelection` were already modeled this way (FK bridges to `PlaybookMove`/`PlaybookGearOption`, not copies) and needed no change; the correction is `Hunter.PlaybookStatArrayOptionId` replacing the five copied int columns. Rating *improvements* gained later via leveling up (an Improvement option that grants `+1` to a stat) are a future concern this pass's schema doesn't address — consistent with "Leveling Up" being explicitly out of scope as gameplay-flow prose per Skyler's original brief, not a gap introduced by this correction.

**Confirmed 2026-08-25 — no Hunter–Mystery relationship this pass, and none is anticipated to conflict later.** Skyler confirmed Hunters will eventually be many-to-many with Mysteries (a Hunter plays across multiple Mysteries; a Mystery has multiple Hunters) — but that relationship is strictly between Hunter *instances* and Mysteries, never between Playbooks and anything. No schema for it is added this pass, and none is needed defensively: a future `HunterMystery` bridge table is a pure addition (new table, new FK pair) with nothing in the `Playbook`/`Hunter` shape above that it would need to change.

## 4. Cloud deployment / seeding — two distinct paths, not one

**The mistake in the first version of this section**: it collapsed two different questions — "how does the canonical 28-playbook ruleset get into every environment" and "what is the Admin UI for" — into one answer ("the Admin UI is the answer to both"). They're not the same question. Corrected below.

**Re-verified, still accurate**: `Program.cs` calls `MotwDbInitializer.InitializeAsync(dbContext)` unconditionally on every app startup, in every environment including the Railway production deploy — no separate deploy step, no manual step. Inside it, `Database.MigrateAsync()` applies schema, then `SeedLookupTablesAsync()` idempotently inserts each static lookup table's fixed rows (`AdventureType`, `MonsterArchetype`, `MonsterType`, `MinionType`, `LocationType`, `BystanderType`, `WeaponTag`), guarded per-table by `if (!await dbContext.X.AnyAsync())`. This — not manual Admin UI entry per environment — is genuinely how static reference data reaches every environment today, confirming Skyler's belief.

### Path A — the canonical playbook set (the primary path; what Phase 4/8 actually need)

**Recommendation: extend `MotwDbInitializer` to seed Playbooks from a checked-in JSON file, the same "runs automatically on every startup, every environment" mechanism already used for the static tables.**

This re-adopts the shape of the prior (deleted) pass's JSON-seed-file idea, but for a different and more specific reason than volume alone: it's not "1,000+ rows is a lot to hand-write as C# object literals" (true, but not the deciding reason) — it's that **canonical template data has the same distribution requirement as the existing static lookup tables** (present automatically, identically, in every environment, without a per-environment manual step), and `MotwDbInitializer` is this codebase's only existing mechanism that does that. A Data Admin UI, however good, cannot satisfy that requirement by itself — every environment's database is independent, so 28 playbooks entered anywhere stay wherever they were entered until something explicitly propagates them elsewhere. Skyler said exactly this: "I prefer not to manually enter every playbook in."

**Revised again 2026-08-25, same day — the authoring mechanism itself was also wrong.** The version of this section immediately prior assumed a human (Skyler, or an agent standing in for Skyler at a keyboard) authors each canonical playbook by typing into the Phase 3 Admin UI form. Skyler corrected this directly: an AI agent digests each playbook's extracted content and authors it — the Admin UI's Create/Update form is a **testing/manual-tweak surface** ("possibly using similar data to test the create/update functionality manually"), not the mechanism the canonical 28 actually go through.

**Concretely, how the PDF's extracted content becomes the seed** (the part Skyler explicitly asked to be concrete about, now corrected):

1. **An AI agent authors each canonical playbook, calling the real `PlaybooksController` Create/Update endpoints**, against a working/dev database — not the Admin UI form, not a direct database write. **Recommendation, stated directly**: author via the real API, not a bypass mechanism, for two reasons — it exercises the exact same validation/persistence code path a human using the Admin UI later would (catching data-shape problems at authoring time, not after a raw write skips every constraint the API enforces), and it keeps one source of truth for "how a Playbook gets written" instead of two paths that can drift (API for humans, something else for agents). **Real sequencing implication**: Phase 4 depends on Phase 3's **backend** — a complete, non-interactively-callable Create/Update API — but not on Phase 3's **frontend form** being built or polished, since the agent never touches it. Worth stating explicitly since it loosens what "Phase 3 done" needs to mean to unblock Phase 4.
   - **Recommendation on granularity: one playbook per bounded agent task, not one continuous session across all 28, and not a single bulk-parse-all-28 prompt.** Skyler's own instinct (one-by-one is safer for catching inconsistencies) matches what this pass's own work already demonstrated — the two layout artifacts caught in Section 1 were only caught by reading each playbook individually and cross-checking it, not by skimming many at once. That doesn't have to mean one unbroken, ever-growing conversation across all 28, which is exactly what risks the context-window degradation Skyler flagged as the counter-consideration — the two concerns resolve together, not against each other: give each playbook its own fresh, bounded task (read this playbook's pages, produce its structured record, verify it, author it via the API), carrying forward only a small fixed context (the confirmed schema, and a short checklist of the artifact classes already known to occur — the stat/move-pairing merge, page-bleed, mid-word column splits) rather than the accumulated raw text of every prior playbook. This generalizes the exact shape of work this pass already did for 3 playbooks to 28 bounded passes, not one growing one.
**REVISED 2026-08-31 — the conversion is a maintained, re-runnable tool, not a one-off script.** Skyler reversed items 2 and 5 below when the seed work was actually built: "I want to make sure this is something that's repeatable. If I change anything or discover small adjustments, I want to be able to run the script again so it can capture those changes. I also anticipate there may be more data structure changes over time. If we can find a way to validate the script through some kind of test, that would be ideal." What shipped: `PlaybookSeedExporter` (a `dotnet run --project src/api/MonsterOfTheWeek.Api -- export-playbook-seed` command living inside the API project, so it reuses the app's own configuration, connection string and DI rather than duplicating all three); a seed file whose format **is** `PlaybookDetailResponse[]` — the read contract itself, so there is no second serialisation format that can drift from it, and a field added to the contract appears in the export automatically; and `PlaybookSeedTests`, which fails when a new contract field is not carried through `PlaybookSeed.ToEntity`. Item 5's "further changes go through normal EF Core migrations, not by re-running the conversion" no longer holds: re-exporting is now the expected way to refresh the shipped data. Item 4's blanket `AnyAsync()` guard is unchanged and still correct — re-exporting updates what *ships*, while an environment that already has playbook rows (possibly edited, possibly linked to by Hunters) is never rewritten underneath itself.

2. **Once the full 28-playbook effort is essentially done — standard fields (Phase 2/4's model), Move-internal fields (Phase 6's model), and bespoke fields (Phase 5/7's model) all three — run a one-off script that converts the locally-authored data into the production seed.** Per Skyler's explicit call, this is a one-off script, not a reusable in-app tool or admin action — built to run once, not maintained as ongoing tooling with a polished UX. It reads the working database the agent authored into and produces `Data/Seed/hunter-playbooks.json`, checked into the API project. This step is **not** part of Phase 4 itself — Phase 4's own 3-playbook pass is pure local model validation; the conversion happens once, later, logically at the end of Phase 8 (see `phases.md`).
3. **Commit the JSON file into the API project.** From this point it's ordinary source-controlled data, reviewable like code.
4. **Extend `MotwDbInitializer` with a `SeedPlaybooksAsync` step** that loads and deserializes the file and inserts it, guarded by the **same blanket `if (!await dbContext.Playbooks.AnyAsync())` pattern every other lookup table already uses** — not a per-playbook incremental check. (An earlier version of this section proposed a per-playbook guard, reasoning the canonical set would grow incrementally across separately-seeded phases. That's no longer the design: the conversion now happens exactly once, after all 28 are already authored, so there's no partial state across phases to reconcile — the existing blanket-guard convention is sufficient as-is.) Every environment gets the full set automatically on next deploy/startup — dev, staging, production — with no manual re-entry anywhere.
5. **After that one-time seed, further changes to canonical playbook data (a fix, a 29th playbook, etc.) go through normal EF Core migrations** — a dedicated migration that updates or inserts specific rows, the same way any other one-off data change would ship in this codebase — **not** by re-running the conversion script, and not picked up by `SeedPlaybooksAsync` (its blanket guard means it won't try; that's now intentional). This is Skyler's explicit instruction and the direct reason the per-playbook guard from the earlier version is actively wrong now, not merely unneeded.

**Resolved 2026-08-25 (open-questions.md Q9)**: agent self-verification against the known-artifact checklist (as this pass did) is sufficient per playbook — no human diff-against-PDF gate required before the agent moves to the next one. Skyler does a manual review pass afterward, across the batch, not per-playbook. Extra rigor applies specifically to Phase 4's 3 pilot playbooks, whose purpose is to pin down a consistent, repeatable pattern before Phase 8 scales it to 25 more (`phases.md` Phase 4).

**New, per Skyler's follow-up (open-questions.md Q10, recommendation given, not yet Skyler-confirmed)**: the read → extract → self-verify → author-via-API procedure above should be packaged as a Claude Code Skill, authored and refined during Phase 4's pilot pass rather than written in advance, then reused unchanged (or lightly extended for bespoke and Move-internal fields) through Phase 8. Full reasoning in `open-questions.md` Q10.

**Rejected alternative, stated for completeness**: a fully automated PDF-to-JSON conversion script with no agent judgment involved. Rejected because the extraction genuinely requires judgment at multiple points (Section 1's two caught layout artifacts, Section 2's pick-count/auto-grant/category-grouping calls) that would be expensive and risky to encode reliably in a rule-based parser for a one-time, 28-playbook transcription task — the cost of building and trusting such a parser is not obviously lower than the cost of one bounded, self-verifying agent pass per playbook via the real API.

### Path B — Skyler's own future additions via the Admin UI, after the canonical set exists

The Phase 3 Admin UI's stated purpose stands, tightened: once built, it's (a) the ordinary way Skyler adds *further* templates going forward (home-brew or personal playbooks beyond the official 28) without needing a code change or deploy, and (b) Skyler's own manual-testing surface for the create/update functionality. Adding a Path-B playbook is genuinely no different from how adding a new `WeaponTag` via the existing Data Admin form already works today: a normal CRUD write against whichever database the running app happens to be pointed at, **not** expected to auto-propagate to other environments. That's the correct, already-established behavior for admin-authored one-offs in this app, and it's fine for Path B specifically because this content isn't "standard" the way the official 28 are.

**Confirmed 2026-08-25**: nothing beyond the 28 canonical playbooks auto-propagates to other environments, for now — no promotion mechanism is designed or needed this pass. If a Path-B playbook later needs to become part of the transferable/canonical set, Skyler will work with an agent at that time to identify and handle it; the underlying mechanism is already known (fold it into the next data migration/seed conversion) but deliberately not built ahead of an actual need.

### What this means concretely

- `MotwDbInitializer` gains a new `SeedPlaybooksAsync` step, loading `Data/Seed/hunter-playbooks.json`, guarded by the same blanket per-table `AnyAsync()` pattern as every other seeded table — no special-casing.
- The JSON seed file lives inside the API project (not `docs/seeds/*.sql`) because, unlike everything currently under `docs/seeds/`, it **is** read by the running app — it's the actual seeding mechanism, not a dev-reference-only mirror. `docs/seeds/*.sql`'s existing dev-reference-only convention is unaffected and not used for this domain.
- Schema (the tables in Section 3) still ships via an ordinary EF Core migration under `Data/Migrations/`, unchanged from the original reasoning — `MigrateAsync()` already runs on every startup including production.
- The Admin UI (Phase 3) is still built as originally scoped — its purpose is Path B (future one-off additions) plus Skyler's own manual verification of the create/update functionality. It is not the authoring mechanism for the canonical 28 (an agent, via the API, is) and not the distribution mechanism either (the one-time seed conversion is).

## 5. Data Admin restructuring (Phase 1)

Current state, verified by reading the live code (`pages/data-admin/data-admin.ts`/`.html`): a single flat page. A `CustomSelectComponent` dropdown picks a `ReferenceTypeTable` (Monster Types / Minion Types / Location Types / Bystander Types / Weapon Tags), and the page conditionally renders either the generic name+motivation form/table (four of the five) or `WeaponTagAdminComponent` (the fifth, which has a different shape: name+description, not name+motivation). This conditional-component-swap pattern (`@if (isWeaponTagSelected()) { <app-weapon-tag-admin /> } @else { ...generic form... }`) is the existing precedent for "one page, multiple sub-shapes selected by a control."

**Recommendation**: add a tab layer above the existing dropdown-driven content, not a route split. Two tabs: **Types** (today's entire page, unchanged — dropdown + generic form/table + `WeaponTagAdminComponent`, moved as a unit into a `TypesAdminComponent` or left inline under a tab condition) and **Playbooks** (new, placeholder content this phase — a `PlaybookAdminComponent` stub, wired for real in Phase 3). Tabs stay client-side state on `/data-admin` (a signal, matching `isShowingUserMenu`/`isShowingMobileMenu`'s existing pattern in `page-layout.ts`), not separate routes — there's no deep-linking need for "which Data Admin tab" the way there is for, say, a specific Monster's detail page, and keeping it route-free avoids adding a second router layer under a page that isn't itself a `features/*` domain vertical (matches the `pages/` vs `features/*` split already established: `pages/` = single cross-cutting views with no CRUD-per-route needs).

This is a small, low-risk phase: it adds one signal + one conditional block to `data-admin.ts`/`.html`, extracts the existing content into (or wraps it in) a component if not already cleanly separable, and adds an empty placeholder for the new tab. No backend changes.

## 6. Bespoke rulesets — Phase 5 data model (fully specified, validated against all 28 playbooks 2026-08-29; **implemented 2026-08-30**)

**Implementation status, 2026-08-30**: the playbook-side tables defined in 6.1, 6.2 and 6.6 are built and migrated (`AddBespokeRulesets`, entities in `Data/Entities/BespokeEntities.cs`), exposed through the existing upsert-the-graph endpoint, and validated against real catalogued content rather than synthetic fixtures. Two implementation details are worth knowing before touching this code, both explained in full in `phases.md` Phase 5:

- **`BespokeOption` is nested on the wire but flat in the database.** The API exposes `children`; the service flattens to `ParentOptionId` on write and rebuilds the tree on read. `SectionId` is populated at every depth, which is what lets the repository load a tree of any depth with a single `Include`.
- **The self-referencing FK is `NoAction`, deliberately.** Section-level cascade already removes a whole tree; subtree deletion without deleting the Section is handled explicitly in `PlaybookService.RemoveSubtree`. Verified to leave no orphans.

The instance-side tables in 6.4 are **not** built — every one requires a `Hunter` table, which lands in Phase 9/10. `BespokeSection.PlaybookMoveId` (6.8) is also not built; it is Phase 6's entire schema delta.

**Status: this is the authoritative schema. No ambiguity remains at the shape level.** This section originally (2026-08-25) flagged Phase 5 as deferred, with a preliminary hypothesis drawn from Crooked alone ("a single free-text `UniqueMechanicText` field per playbook" was already known to be insufficient, and a `PlaybookBespokeSection` shape was floated as a starting guess). That hypothesis was worked through in detail in `phase5-bespoke-ideation.md` and then **verified directly against all 28 real playbooks** via a systematic one-playbook-at-a-time walkthrough (2026-08-26 through 2026-08-29), recorded per-playbook in `bespoke-ruleset-catalogue.md`. The `UniqueMechanicText` placeholder column has been removed from `Playbook` (Section 3) — it's fully superseded by the schema below, which is real and complete, not a placeholder.

**This section is written to be self-sufficient**: another agent should be able to implement Phase 5's entities/migrations directly from what's here, without needing to read `phase5-bespoke-ideation.md` (the design-reasoning archive — *why* each piece exists, alternatives considered and declined, the chronological order things were discovered in) or `bespoke-ruleset-catalogue.md` (the per-playbook instantiation — *which* of the shapes below each of the 28 playbooks actually uses, with real transcribed content) to understand the shape itself. Consult those two files for reasoning history and real data respectively, not for the schema definition.

**Core design philosophy, applied throughout**: no `ShapeKind`/discriminator column anywhere. Which "shape" a `BespokeSection` or `BespokeOption` row represents is always derived from which nullable fields are populated — the same pattern Gear already uses (`PlaybookGearCategory.PickCount`/`IsOptional` rather than a `GearShapeKind` enum). A named vocabulary for the shapes exists (6.5 below) purely for docs/conversation/admin-UI grouping — it is never stored.

### 6.1 Core shape — `BespokeSection` / `BespokeOption`

The umbrella concept (one row per named bespoke ruleset, e.g. "Background," "Fate," "Combat Magic") and its pickable content (one shared table for every option shape found across all 28 playbooks — title-only, description-only, both, blank-fill, nested, numeric):

```
BespokeSection
  Id, PlaybookId
  Title, Description (nullable), EffectText (nullable), FreeTextLabel (nullable)
  MinSelect, MaxSelect (nullable ints)
  MinInstances, MaxInstances (nullable ints)

BespokeOption
  Id, SectionId
  ParentOptionId (nullable, self-referencing — null = top-level option, set = nested under another option, any depth)
  Title (nullable)
  DescriptionText (nullable)
  MinSelect, MaxSelect (nullable — same meaning as the Section-level pair, scoped to this option's own children)
  NumericMin, NumericMax (nullable ints)
```

**Field-by-field meaning:**

- **`Description`** — the intro/framing prose: what you're picking and why, read once at character creation. Nullable — genuinely `null` when a Section is a pure umbrella over sub-blocks that each carry their own framing (e.g. an umbrella Section whose real content lives one level down in its category-divider options).
- **`EffectText`** — a *semantically distinct* second prose field, not a second framing statement: what having made these picks *means going forward, during ongoing play* (consequence/follow-through), not what you're about to pick. **Split criterion**: applies only when the source presents this as a genuinely, separately-positioned block after the options — not any sentence with forward-looking wording inside one continuous paragraph. Pick-count restatements ("Pick one or more of:", "Then pick two of these:") are never `EffectText` and never `Description` either — they're dropped entirely, fully redundant with `MinSelect`/`MaxSelect`.
- **`FreeTextLabel`** — populated only for a Section with **zero `BespokeOption` rows** whose entire content is one player-authored value with no fixed list to pick from (e.g. a one-sentence personal code, illustrative examples only, not real options). When populated, `MinSelect`/`MaxSelect` are both `null` and the UI renders a single free-text input labeled by this value instead of a pick control.
- **`MinSelect`/`MaxSelect` (Section level)** — how many of this Section's direct top-level options must/may be picked. **Both `null`** is a valid, expected state (not `0`/`0`): it means "there is no option set to pick from at all" (a fixed always-active ability, or a `FreeTextLabel` Section) — `0`/`0` would wrongly read as "a real, empty option set." Default to `1`/`1` unless source wording implies otherwise; genuinely ambiguous wording is a per-playbook judgment call made during authoring, not something the schema resolves generically. A `MinSelect < MaxSelect` range is valid and expected wherever the source states "at least N, no stated cap" (`MaxSelect = null`) or "at least N of M categories, not all M mandatory."
- **`MinInstances`/`MaxInstances`** — "how many times can this Section's whole option-tree be instantiated per Hunter," the same idiom as `MinSelect`/`MaxSelect` one level up. Both `null` (the default, and every Section's value until a real case demonstrated otherwise) means "the concept doesn't apply, exactly one instance." A populated pair means the Section is repeatable (e.g. a Hunter can end up with several independent instances of the same pick-structure, each with its own answers that must not collide with each other's).
- **`ParentOptionId`** — a plain adjacency-list self-reference. Generalizes to any nesting depth for free (confirmed via real 3-level nesting: Section → category divider → sub-category → tag item) — sub-options follow exactly the same rules as top-level options at any depth, no special-casing.
- **`Title`/`DescriptionText` (option level)** — independently nullable, not a package deal. Real data has title-only (label tags), description-only (flat prose options), both-populated (a named option with its own explanation), and neither-populated-but-has-children (a pure category divider whose own children carry the content) cases. **Titles never carry markup** — even when a source option's label is printed bold, `Title` is stored as a plain string; only `DescriptionText`/`Description`/`EffectText` carry the constrained HTML subset (6.3).
- **`MinSelect`/`MaxSelect` (option level)** — identical meaning to the Section-level pair, scoped to *this option's own children*. Only populated on options that have children. The recursive "pick N of my children" concept is what makes multi-level nesting (Underworld's parent/sub-pick, Fate's 3-mandatory-categories-each-with-their-own-count, Combat Magic's 2-mandatory-categories-with-independent-bounds) fall out of one mechanism with zero extra schema.
- **`NumericMin`/`NumericMax`** — a bounded numeric value a Hunter records and *mutates during play* (not a one-time pick), attached to a leaf option. Distinct from `MinSelect`/`MaxSelect` (which govern a pick-count on this option's *children*) — a leaf numeric option has no children, so its own `MinSelect`/`MaxSelect` stay `null`. Used for a Luck-like spend/restore resource that's conditional on one specific option being picked (e.g. a track that only exists for the subset of Hunters who chose a particular specialty) — attaching the bounds directly to the gating option makes that conditionality automatic, with no separate FK needed to express "only exists if this was picked." Modeled via the same single-mandatory-child attachment pattern as a `{{blank}}`-only leaf (e.g. a parent option with `MinSelect=1, MaxSelect=1` and exactly one child carrying `NumericMin`/`NumericMax`) — not a new attachment mechanism. No `StartLabel`/`EndLabel` exist on this leaf shape (unlike `PlaybookExtraTrack` below) — not built speculatively; add them only if a real instance demonstrates a labeled-boundary need.
- **Zero-option `BespokeSection`s are valid and expected**, not an edge case: a fixed, always-active mechanical grant with no picks at all. `MinSelect`/`MaxSelect` both `null`, zero `BespokeOption` rows, and — direct consequence — **zero `HunterBespokeSelection` rows are ever needed for it**. The Hunter has the ability unconditionally by virtue of the Playbook, the same shape as a `Required` Move needing no per-Hunter selection record.
- **`Required`, deliberately not added to `BespokeOption`.** The standard Moves model has `PlaybookMove.Required` (Section 2). No bespoke pick-list processed across all 28 playbooks has ever needed the equivalent — every case is either "pick N of M, no option individually mandatory" or "pick all N of N" (which `MinSelect == MaxSelect == count` already covers with no per-option flag). Left out deliberately; add only if a future case demonstrates a genuine need, per this schema's standing "don't force a taxonomy the source material doesn't have yet" discipline.

### 6.2 `BespokeJournal` / `BespokeJournalField` — growing, freeform-labeled entries

A structurally different concept from `BespokeSection`, for content that isn't a fixed pick from a predefined list at all: the Keeper and player invent new entries live, repeatedly, throughout play, and the template only defines a **field shape** (e.g. every entry always has a "Power" field and a "Downside" field), never predefined option content. Forcing this into `BespokeOption` would be a category error — `BespokeOption` rows are things a Hunter selects *from*; there's nothing to select from here.

```
BespokeJournal
  Id, PlaybookId, Title
  Description (nullable), EffectText (nullable)   -- same Description/EffectText role split as BespokeSection, reused rather than inventing a third field shape

BespokeJournalField
  Id, JournalId, Label, SortOrder
```

`BespokeJournalField` is a real normalized child table (not hardcoded `Field1Label`/`Field2Label` columns), matching every other multi-item concept in this schema, and generalizing to a playbook needing more or differently-labeled fields with zero schema change. **A journal's `Description` can be genuinely `null`** — checked directly against the source, not assumed — when the source gives it nothing beyond its own bare heading (which already supplies `Title` and every `BespokeJournalField.Label`).

**Do not confuse a repeatable `BespokeSection` (6.1's `MinInstances`/`MaxInstances`) with `BespokeJournal`.** The distinguishing test: does the *content itself* have real, described structure (a genuine pick-list, mandatory labeled slots with real option text) that simply needs to exist in multiple independent copies per Hunter — that's a repeatable `BespokeSection`. Or does the content have **no structure at all**, just a fixed set of bare free-text field labels with nothing enumerable or pickable — that's `BespokeJournal`. Both shapes "grow" per Hunter; only one of them has anything a Hunter picks *from*.

### 6.3 Formatting and fill-in conventions

**`{{blank}}` — a literal placeholder token embedded directly in `DescriptionText`** (or, for a title-only tag option, directly in `Title`), marking exactly where the UI renders a free-text input. Not a boolean flag or a separate field — the token's position within the surrounding text is itself the information ("Allergy to `{{blank}}`" vs. a whole-field blank). Confirmed non-colliding with Angular's own `{{ }}` interpolation syntax (Angular only compiles `{{ }}` appearing in a template's own static markup, never inside a bound data string's *value*).

**Add `{{blank}}` on semantic/functional grounds, not only when the source prints a literal marker glyph.** Confirmed as a real, recurring MOTW typesetting convention (independently reproduced across multiple playbooks, not a one-off interpretation): the source frequently implies a fill-in — a trailing colon, a grammatically incomplete phrase ("Allergy to ___"), a bare trailing comma with nothing after it — without actually printing an underscore run or any glyph. Check the raw item stream directly before concluding a marker is absent (verify, don't assume); when a marker genuinely is absent but the fill-in is functionally required, add `{{blank}}` anyway, reasoning from the token's real purpose ("marks where the UI renders an input") rather than from whether the source happened to render one.

**A small, enumerated HTML subset for inline formatting — `<b>`/`<strong>`, `<i>`/`<em>`, `<ul>`/`<li>` only, not Markdown.** Applies to every `BespokeSection`/`BespokeOption`/`BespokeJournal` prose field (`Description`, `EffectText`, `DescriptionText`) and, per Section 2's Moves note, `PlaybookMove.DescriptionText` — nowhere else (every other standard-section field stays plain text, confirmed explicitly, not assumed). Chosen over Markdown because Angular's `[innerHTML]` + `DomSanitizer` already safely renders exactly this tag set with zero new dependency, and this codebase has no Markdown parser anywhere. The set stays deliberately small and enumerated (no links, headers, tables, code blocks) both to avoid becoming a general-purpose rich-text field and to keep server-side validation straightforward if ever added as defense-in-depth. Sourced via the formatting-preserving extraction pipeline (`pdf-extraction-pipeline.md`, `tools/pdf-extract/`) — `pdftotext -layout` alone cannot see bold/italic/font-weight. Plain/tagless text is only correct for a given field when the source genuinely has no formatting to preserve there (verified per-field, not assumed from the option's shape — real cases have been found where a "safe-looking" plain option turned out to have real inline emphasis).

**Normalize inconsistent source wording during authoring; don't preserve it literally.** Where the PDF's own wording is internally inconsistent within one ruleset (e.g. one option says "(choose one)" while every sibling says "Pick one:"), normalize to consistent phrasing, working from assumed intent. This is authoring guidance, not a schema concern.

### 6.4 Hunter instance side

```
HunterBespokeSelection
  Id, HunterId, BespokeOptionId, FreeformText (nullable), NumericValue (nullable int), SectionInstanceId (nullable FK -> HunterBespokeSectionInstance)

HunterBespokeSectionInstance
  Id, HunterId, SectionId (FK), Name (nullable — per-instance free text, e.g. a repeated entry's own name), SortOrder

HunterJournalEntry
  Id, HunterId, JournalId, SortOrder

HunterJournalEntryFieldValue
  Id, EntryId, JournalFieldId, Text
```

- **`HunterBespokeSelection.BespokeOptionId` is required, not nullable, with exactly one documented exception**: a `FreeTextLabel` Section's answer (there's no option being selected, just a value recorded against the Section itself) — that's the only case where this FK is expected `null`. Every other confirmed selection across all 28 playbooks attaches to a real predefined option.
- **`FreeformText`** is populated only when the selected option's `DescriptionText`/`Title` contains a `{{blank}}` token — one row per selected option, its own blank's answer scoped to that row. A parent-option-plus-sub-option pick (e.g. Underworld's nested shape) is simply **two rows** — one selecting the parent, one selecting the sub-option — no special "nested pick" mechanism needed.
- **`NumericValue`** is populated only on the row for a `BespokeOption` that itself has `NumericMin`/`NumericMax` set. It's the one field on this table that's genuinely **mutable throughout play**, not fixed once at creation (every other field here is set once, when the pick is made). Initialization convention for spend/restore-shaped resources: start at `NumericMax`, spend down toward `NumericMin` — an authoring/UI convention, not a schema mechanism.
- **`SectionInstanceId`** is populated only for a repeatable `BespokeSection` (`MinInstances`/`MaxInstances` non-null) — every selection belonging to the same repeated instance carries the same `SectionInstanceId`, which is what keeps instance #1's picks from colliding with instance #2's. `null` for every non-repeatable Section, unchanged from today.
- **`HunterBespokeSectionInstance`** exists as its own row (not a bare `InstanceNumber` int on the selection rows) so a freshly-added, not-yet-filled-in instance (zero selections yet) is representable, and so the instance's own free-text name (when the source asks for one, e.g. "give this a name") has somewhere to live that isn't a `BespokeOption`.
- **Whether a category-divider option counts as "engaged" is always a derived fact, never a separately stored one.** For a Section/option whose own `MinSelect < MaxSelect` (not every child mandatory — e.g. "at least 2 of 3 sub-categories"), a given child counts as "used" if and only if at least one of *its own* children has a `HunterBespokeSelection` row. There is no separate flag or row recording "this category is engaged" — it's computed on demand from the leaf-level picks that already have to be recorded anyway. This keeps the data from ever reaching a self-contradictory state (a category marked "engaged" with zero actual picks under it, e.g. after an edit removes the last pick from a category without a second, easy-to-miss step updating a separate flag) and requires no extra field.
- **`HunterJournalEntry`/`HunterJournalEntryFieldValue`** are the one Hunter-side concept that stores genuinely free-authored, growing content rather than an FK-only reference to a predefined template row (`HunterMove`/`HunterGearSelection`/`HunterBespokeSelection` are all bridges to template rows; these two are not) — one row per entry, one row per field-value within an entry, since the entry's actual text has to live somewhere and there's no template row to point at instead.
- **Persistence is a bridge table throughout, never JSON** — no JSON columns exist anywhere in this API project, and `Hunter` already has two other pick-list persistence mechanisms in this exact shape (`HunterMove`, `HunterGearSelection`, both live-linked FK bridges) that a JSON column would be inconsistent with internally, on top of losing FK-enforced referential integrity and SQL joinability.

### 6.5 Named shapes (vocabulary only — never stored, never a discriminator)

Useful for docs, conversation, and admin-UI grouping. A shape is always derived from which fields above are populated:

- **Titled Choice** — `Title` + `DescriptionText` both populated on every option (a named pick with its own explanation).
- **Simple Choice** — `DescriptionText` only, no `Title` (a flat description-only pick, the simplest shape).
- **Tag Pick** — `Title` only, no `DescriptionText` (short label tags, nothing to explain).
- **Blank-Fill Choice** — `DescriptionText` populated with an embedded `{{blank}}` token mid-sentence.
- **Nested Choice** — one or more options have `ParentOptionId` set, at any depth.
- **Mandatory multi-category umbrella** — a Section (or option) whose `MinSelect == MaxSelect == direct-child count`, i.e. every direct child is mandatory (Fate's 3 categories, Combat Magic's 2 categories).
- **Zero-option Section** — `MinSelect`/`MaxSelect` both `null`, zero `BespokeOption` children (6.1).
- **Free-text Section** — `FreeTextLabel` populated (6.1).
- **Repeatable Section** — `MinInstances`/`MaxInstances` populated (6.1, 6.4).
- **Numeric leaf** — `NumericMin`/`NumericMax` populated on a leaf option (6.1).

**`Description` made nullable 2026-08-31 (Phase 8 group 3).** The Pararomantic's Relationship Status prints only its header and its box row — no explanatory paragraph at all. The two mechanics that drive it (the Luck spend-trigger and Fate of Your Love's unravelling) are printed and stored in their own places, so attributing either here would duplicate stored text rather than describe the track. The catalogue had specified `null` for this track since 2026-08-28; the column simply had not caught up.

### 6.6 Extra Tracks — cross-reference, not a duplicate definition

A Luck-like tracked resource **universal to every Hunter of a playbook** (as opposed to conditional on one specific bespoke pick, which is the numeric-leaf shape in 6.1) is `PlaybookExtraTrack`, already fully specified in Section 2 ("Extra Tracks") — `Id, PlaybookId, Name, Description, EffectText [nullable], BoxCount, StartLabel [nullable], EndLabel`, instance side `HunterExtraTrackValue (Id, HunterId, ExtraTrackId, CurrentValue)`. Reuses the same `Description`/`EffectText` role split defined in 6.1 rather than inventing a third field shape. Kept as its own table, deliberately not merged with `BespokeSection`/`BespokeOption` — a track's shape (a numeric range with start/end labels, no pick involved at all) is different enough from a pick-list that forcing them into one table would cost more than the two tables' current small duplication of concepts.

### 6.7 Scope boundary — why Move content isn't in 6.1–6.6 (and where it is: 6.8)

Some individual Moves (not `BespokeSection`s) embed their own fixed, enumerated pick-list directly in `PlaybookMove.DescriptionText`'s prose — e.g. a Required Move that says "cross off one of the following four" or "pick a category, take the associated effect." This was deliberately excluded from every `BespokeSection`/`BespokeOption` definition throughout this walkthrough, even when it would have fit the shape cleanly, because it's Move content, not a bespoke ruleset — the same category-before-shape discipline that corrected a real miscategorization mid-walkthrough (Forged's Bonds/Burdens, originally modeled here and later removed once traced back to belonging to a Move). **This has its own dedicated phase — Phase 6 (`phases.md`), and it is now designed: see 6.8 directly below for the schema, and `custom-moves-ideation.md` for the census and reasoning.** The census read all 28 playbooks' Moves in full and found **14 creation-time in-move picks across 11 playbooks** — 7 of them not previously flagged anywhere, including two on The Crooked, a Phase 4 pilot playbook. `custom-moves-ideation.md` Section 2.1 is the authoritative inventory; the flags scattered through `bespoke-ruleset-catalogue.md` are a roughly half-complete earlier pass, superseded by it.

**What stays out of scope, decided by Skyler 2026-08-30 and not left ambiguous**: in-play menus (a list chosen fresh each time a move triggers — ~35 moves), computed option sets (options defined by reference to other playbooks' moves — 5 moves), and ordinary roll-outcome branching all remain **prose** in `PlaybookMove.DescriptionText` using the constrained HTML subset (6.3). Nothing about them is stored per Hunter. That's a deliberate scope decision, not an unresolved gap.

### 6.8 Move-internal pick-structure — `BespokeSection.PlaybookMoveId` (Phase 6, settled and **implemented** 2026-08-30)

**Implementation note.** Shipped as migration `AddMoveInternalBespokeSections` — the single nullable FK described below, nothing more. The "must filter `PlaybookMoveId IS NULL`" reading rule stated further down is **enforced structurally rather than by convention**: the API nests a Move's sections under the Move in both request and response, so `PlaybookDetailResponse.BespokeSections` is playbook-level by construction and a client cannot conflate the two. See `phases.md` Phase 6.

Some individual Moves embed their own fixed, enumerated, **character-creation-time** pick-list inside their own text — e.g. The Host's Defensive Adaptation ("Your symbiote protects you. Pick one:" + 6 options), or The Forged's Partner ("pick two bonds and one burden" — two named categories, each with its own count). 14 such moves exist across 11 playbooks. **These are modeled with the exact apparatus defined in 6.1–6.6, attached one level lower**, via a single new nullable FK:

```
BespokeSection
  Id, PlaybookId
  PlaybookMoveId (nullable FK -> PlaybookMove)   -- null = a playbook-level bespoke ruleset (every Phase 5 row);
                                                 -- set  = this Section's pick-structure lives inside that Move
  ... all other fields exactly as defined in 6.1 ...
```

**That is the entire schema delta for Phase 6.** Zero changes to `BespokeOption`, zero new tables, zero instance-side changes. A Move's internal structure gets the full `BespokeOption` tree (recursive `MinSelect`/`MaxSelect`, `ParentOptionId` nesting, `NumericMin`/`NumericMax`), `Description`/`EffectText`, `FreeTextLabel`, `MinInstances`/`MaxInstances`, `{{blank}}`, the constrained HTML subset, and the derived-engagement rule — all unchanged.

**Why the Section level and not the Option level** (worth recording, since the Option level was the originally-expected attachment point): The Forged's Partner and The Professional's Mobility are each *two named categories under one Move, each with its own independent pick count*. Attaching at the Option level leaves "how many of my direct categories are mandatory" with nowhere to live — that's `BespokeSection.MinSelect`, one level up. The Option-level design would have needed a new field invented immediately to express something the schema already handles.

**Reading rule this introduces, and the trade-off accepted**: `BespokeSection` is now polymorphic in its owner — a Section belongs to a Playbook *and optionally* to one of that Playbook's Moves. **Any query for a playbook's top-level bespoke rulesets must filter `PlaybookMoveId IS NULL`.** That's a real (small) ongoing cost at every read site, accepted in exchange for not duplicating a validated four-table apparatus for content that is structurally identical. `PlaybookId` stays populated on the row even when `PlaybookMoveId` is set — derivable through the Move, but keeping it makes "everything for this playbook" a single flat query, matching how `HunterBespokeSectionInstance.SectionId` is already stored directly rather than derived transitively.

**How the census's shapes map** (all reuse existing mechanisms; none needed new ones):
- Single-category pick → a Section with `MinSelect`/`MaxSelect` + flat options (Host, Visitor, Searcher's First Encounter, Crooked ×2, Changeling, Searcher's Guardian).
- Two mandatory categories → the multi-category umbrella shape already proven by Fate/Combat Magic/Expatriation (Forged's Partner, Professional's Mobility).
- A range → `MinSelect < MaxSelect` (Crooked's Deal with the Devil, "one or two things": `1`/`2`).
- Open "something else" slot → `{{blank}}` per 6.3 (Forged, Visitor).
- Binary choice → a 1-of-2 Section (Pararomantic's Supernatural Guide, "secret or not").
- **Bounded-repeatable free text** → `FreeTextLabel` + `MinInstances`/`MaxInstances`, zero options: Searcher's Network ("detail up to five members") `0`/`5`; Spell-Slinger's Arcane Reputation ("pick three organizations") `3`/`3`. Instance side uses `HunterBespokeSectionInstance` (one row per entry) with `HunterBespokeSelection.BespokeOptionId` null and the value in `FreeformText` — the already-documented single exception in 6.4. **This combination is valid but has never been exercised**; worth deliberate verification when these two are authored.

**One content rewrite, Skyler-directed and deliberately not source-literal**: Spell-Slinger's Tools and Techniques prints "**Cross off one**; you'll need the rest" over 4 items — an inverted selection where the stored value would mean the opposite of every other selection in this schema. Per Skyler (2026-08-30), the stored `Description` is reworded to "**Pick 3 of the 4**" and modeled as an ordinary `MinSelect=3, MaxSelect=3`, with the selected rows being the ones *kept*. Verified equivalent (4 items, cross off 1 → keep 3) and corroborated by the same playbook's own Advanced Arcane Training, which already says "your **three** Tools and Techniques." Flagged here because the stored text intentionally differs from the printed page — same convention as Skyler-assigned Move names ("One of Us," "Agency politics").

**Authoring/tooling notes** (detail and full reasoning in `custom-moves-ideation.md` 2.5 and §5):

1. **Extraction tooling is built** — `tools/pdf-extract/extract-moves.mjs` gained an inline comma/semicolon option path plus delimiter-derived title splitting, behind an additive `--options` flag (2026-08-30, Bowser). Needed because 6 of the 14 in-scope moves present options as inline runs with no bullets, and because the bulleted path was independently broken for in-move content in two silent ways (a capital-`B` Required-move glyph that matched no bullet rule — affecting 7 of the 14, which are Required; and in-move option bullets sharing the same glyph as top-level move bullets, distinguishable only by x-indent).
2. **`Title` boundaries are delimiter-derived, and font signal is *measured per option*, not assumed.** Option names are regular weight in most in-scope moves but **not all** — The Searcher's First Encounter has genuinely bold option names (verified against the raw item stream). Extraction emits `titleStyle` / `titleFontCorroborated` / `titleProvenance` per option; authoring should read those rather than apply a blanket rule. Delimiter-derived splitting stays correct either way (an option is often one text item; a bold run alone can't say where the title ends) — a font signal corroborates the split rather than replacing it. The category-divider level is styled independently again (bold on Forged's "Bonds (pick two):", italic on Professional's "Good things").
3. **`titleProvenance: delimiter:paren` must never be auto-accepted.** Real counterexample pair inside this content class: Gumshoe's "Criminals (organised)" — parenthetical is part of the *name* — vs. Crooked's "Protective amulet (1-armour magic recharge)" — parenthetical *is* the description. Same shape, opposite meaning. Colon-derived splits are safe by default; parenthesis-derived ones need a content read every time.
4. **Marker form does not indicate creation-time vs. in-play** — Spell-Slinger's Tools and Techniques (creation-time) and Could've Been Worse (in-play) use the same `•` on the same page. Scope must be read from the wording.

**Adjacent gap, raised and since closed (2026-08-30)**: at least one *bespoke option* (The Monstrous's "Pure Drive") contained its own creation-time inline pick recorded as prose. Skyler sanctioned reopening the completed Phase 5 catalogue and re-sweeping all 28 playbooks' bespoke content with the new inline-detection tooling — 123 raw hits, 14 in Phase 5 scope, **one genuine gap (Pure Drive), now remodeled as nested options** with no new schema. 6.8 covers picks inside **Moves**; picks inside **bespoke options** are covered by Section 6.1's existing nested-option shape and have now been swept to the same standard. Adjudication table: `bespoke-ruleset-catalogue.md` status block.

### 6.9 Where to look next

- **`bespoke-ruleset-catalogue.md`** — the complete, per-playbook instantiation of everything above: every one of the 28 playbooks' actual bespoke content (real titles, real descriptions with real markup, real `MinSelect`/`MaxSelect` values), organized by playbook. This is where an authoring agent gets the actual data to write, not the shape.
- **`phase5-bespoke-ideation.md`** — the full reasoning history: candidate approaches considered (a generic EAV model, per-shape tables) and why this shape won, every alternative considered and declined for each field above, and the chronological order each piece was discovered in. Consult only if the *why* behind a field matters, not to re-derive the *what* — that's fully captured here.
- **`custom-moves-ideation.md`** — the same division of labour for 6.8: the full 28-playbook Moves census (including the ~35 in-play menus examined and ruled out of scope), the per-move inventory Phase 6 authors from, and the reasoning behind the Section-level attachment point. Consult it for *which moves* and *why*; 6.8 above is the *what*.

## 7. Hunter list UI (Phase 9, **implemented 2026-08-31**)

**What shipped, and the two places it differs from the sketch below.** Everything described here was built as specified: the `NavItem` entry, the `icon-nav-hunters` symbol, the `NavIconKey` addition, and a `HuntersListComponent` on the `MonstersListComponent` shape. Two deviations, both deliberate:

- **No delete control on the list row.** `MonstersListComponent` has one; `HuntersListComponent` does not, because `DELETE /api/hunters/{id}` is Phase 10 and a button that fails on click is worse than the dead *links* this phase intends — those at least fall through the wildcard to the dashboard, which was verified rather than assumed.
- **One new theme token pair**, `--color-badge-playbook` / `--color-on-badge-playbook` (indigo, light + dark), so the row's Playbook badge is not borrowing `badge-archetype`, whose comment names it as Monster's. Same construction as every badge token beside it.

`Hunter` shipped as the minimal list shape (`Id`, `PlaybookId`, `Name`, `CreatedAt`, `UpdatedAt`) in its own `HunterEntities.cs` — not appended to `PlaybookEntities.cs`, which holds template data, and not to `DomainEntities.cs`, already the largest entity file. Phase 10's six instance-side tables belong in that new file. `ITimestamped` was included: Hunter is user content, matching `Mystery`/`Monster`/`Bystander` rather than the untimestamped reference tables. The Playbook FK carries no inverse navigation on `Playbook` (`WithMany()` with no property) — template data has no business holding a collection of the instances built from it.

**Verified by driving the real app**, not by compiling: nav entry and icon symbol resolve, the list renders seeded rows with their playbook names in both themes, both dead links land on the dashboard without a crash, the empty state reads "No hunters yet.", and the delete-conflict path below returns all three of its outcomes correctly. Test rows were removed afterwards; the dev database is back to 28 playbooks and 0 hunters.

Current sidebar (`layout/page-layout/page-layout.ts` `NavItem[]` + `page-layout.html`) is a flat array rendered as either a real `routerLink` or a disabled "Soon" badge — no restructuring needed, just one more `NavItem` entry (`{ label: 'Hunters', route: '/hunters', icon: 'hunters', exactMatch: false }`) once a route exists, matching exactly how Mysteries/Monsters/Minions/Locations/Bystanders are already registered. Icon needs one new symbol in `shared/icons/icon-sprite.component.ts` (`icon-nav-hunters`) plus the `hunters` key added to `DomainIconComponent`'s `NavIconKey` union — both are the same two-file edit every existing domain icon already required.

List page follows the `MonstersListComponent` shape exactly (flat `GET /api/hunters`-backed list, no mystery-scoping needed since Hunters aren't mystery-owned the way Monsters optionally are) — this phase's own scope is explicitly "dead links to create/edit," so the route/component exist and render a list, but Create/Edit routes aren't wired until Phase 10 lands.

## 8. Hunter create/edit — flow vs. form (Phase 10, **implemented 2026-08-31**)

**Built as recommended below**: one reactively-gated page, no wizard. `HunterFormComponent` + `HunterCreateComponent`/`HunterDetailComponent`, with `HunterService` gaining `getById`/`create`/`update`/`delete`. The predicted shape held up — nothing about the gating needed a second navigation step.

**Three things the recommendation did not anticipate:**

1. **The form loads the playbook; the pages do not pass it in.** This section already specified that, but it is worth flagging as a real departure from `MonsterFormComponent`, which is purely presentational and receives its options as `@Input`s. The reason it is right here: the option lists must be re-fetched on every `playbookId` change, and putting that subscription in the pages would duplicate it identically in both of them.

2. **The playbook control is locked in edit mode.** Changing a hunter's playbook invalidates every move, gear and rating pick it has, and silently discarding those behind a dropdown is not acceptable. The API still accepts a changed `PlaybookId` from a deliberate client with a consistent payload — the lock is a UI decision, not a contract one. (Consequence worth knowing: the submit path reads `getRawValue()`, since a disabled control is omitted from `.value` entirely.)

3. **Required moves are added server-side whether or not the client sends them.** A playbook that grants a move outright grants it to every hunter built from it, so leaving that to the caller would let a hunter exist without a move the rules say it always has. The form renders those checked-and-disabled and excludes them from the `MoveGrantCount` tally.

**One genuine EF trap, caught by a test and worth reading before touching this code.** Removing a `HunterMove` from `Hunter.Moves` marks it `Deleted` — but only until the next `DetectChanges` re-runs navigation fixup, and assigning *any* FK on the Hunter (which `UpdateAsync` does, since the playbook is allowed to change) triggers exactly that. Fixup sees a tracked `HunterMove` whose `HunterId` still points at the hunter, puts it back into the collection, and the pending orphan-delete evaporates with no error anywhere. The naive version works right up until an unrelated line assigns an FK. The fix is an explicit `RemoveRange` through the repository, which fixup does not undo. This is the same class of trap as the `ValueGeneratedNever()` one in Section 3 and will recur in any future bridge table edited this way.

**Follow-on 10a, 2026-08-31 — Looks and Extra Tracks are now structured.** `HunterLookSelection (HunterId, LookCategoryId, LookOptionId?, FreeformText?)` and `HunterExtraTrackValue (HunterId, ExtraTrackId, CurrentValue)`, both composite-keyed. The latter deviates from 6.4's sketch, which shows a surrogate `Id`: there is exactly one value per (hunter, track), and the composite key states that directly instead of needing a unique index alongside a surrogate.

Two things worth carrying forward from that work. **A freeform look answer references the category, not an option** — so the playbook-edit guard has to watch look *categories* as well as look options, or a line can be deleted out from under everyone who wrote their own text for it. And **"exactly one of option / freeform" has no database expression**, so it lives in the service with both failure directions tested.

**Follow-on 10b, 2026-08-31 — the bespoke instance tables are built.** All four of 6.4's tables ship as specified, with two departures forced by real data and recorded in `phases.md`: `HunterBespokeSelection` carries `SectionId` (without it, a free-text answer on a *non-repeatable* section — the Gumshoe Code — has nothing to attach to), and it carries `FreeformTitle` alongside `FreeformText` (four options put a `{{blank}}` in both of the template's text fields).

**One implementation trap, promoted here because it is a reading error waiting to recur.** 6.4's derived-engagement rule is not a UI nicety, it is how pick-counts are *counted*: a category divider is never selected, so a section's `MinSelect`/`MaxSelect` counts **engaged** top-level options — dividers reached through their children, plus directly-picked leaves — and never selection rows. Counting rows reads every nested section as zero picks regardless of what is filled in. Both the refuse tier and the completeness tier now share one `BespokeEngagement` helper, because two implementations that drift could call the same hunter over its maximum and under its minimum at once.

**`Hunter.Background` is now History and nothing else** — the one section Section 2 deliberately models as flat prose, per the brief's exclusion of hunter-to-hunter relationship modelling. Every other section of every playbook has structured capture.

**Recommendation: a single-page reactive form, following the `MonsterFormComponent`/`MonsterCreateComponent` precedent — not a multi-step wizard.**

**The deciding factor, stated directly**: the Mystery wizard (`mystery-create.store.ts` + 6 phase components + a dedicated tracker, ~10 files) exists because Mystery creation involves **real child domain entities created via separate, ordered API calls** — a Monster can't get its Attacks assigned until the Monster itself has an `Id` from a prior `POST`, and the wizard's phase-transition submission model exists specifically to sequence that. Hunter creation has no equivalent: everything a Hunter needs (which Playbook, which rating array, which moves, which gear, name/pronouns/looks/background) is data *about the Hunter itself*, not independently-addressable child entities with their own lifecycle. A single `UpsertHunterRequest` can carry all of it in one `POST`/`PUT`, the same way `MonsterFormComponent` carries all of Monster's core fields in one request — there is no ordering dependency a wizard's phased persistence would be solving.

**The one real complication — a Playbook-gated form, not a wizard-shaped one**: none of the pick-lists (ratings, moves, gear, looks) can render until a Playbook is chosen, since they're all properties of *which* Playbook. This is a genuine two-stage dependency, but it's the same shape as a pattern already used twice in this codebase, not a new one: `data-admin.ts`'s `referenceTypeTable` control conditionally swapping which panel renders, and `monster-create.ts`'s `armorDraftForm.controls.isSpecial`-driven conditional validator/visibility. A `playbookId` control whose `valueChanges` drives which sections of the same page render (still one page, one submit, reactively gated) satisfies this without introducing a second navigation step — which matters concretely here, since the standalone-creation initiative's own resolved decision (`docs/updates/standalone-creation-phase1-monsters.md`) already rejected "silently reveal more UI after a hidden intermediate step" in favor of true single-page flows for exactly this kind of case.

**Trade-off being accepted**: a Hunter create page will have more visible form surface at once than Monster's (rating-array picker, a longer move checklist, a gear picker, look-category pickers, all live once a Playbook is chosen) — a wizard would spread that over several smaller screens. This is accepted deliberately: Monster's own create page already carries 4 kinds of sub-resource drafts (attacks/powers/armor/weaknesses) on one page via local `signal<T[]>` draft arrays + a single batched submit (`monster-create.ts`), and that precedent already proves this codebase's established pattern scales to "one page, several distinct pickable sections, one submit" without needing a wizard. Hunter's sections (mostly single/multi-select from a fixed, Playbook-scoped list, not free-form add/remove-many like Monster's attacks) are structurally simpler than what Monster already does on one page, not more complex — reinforcing that a wizard would be solving a problem Hunter doesn't have.

Concretely: `HunterFormComponent` (shared, presentational, mirrors `MonsterFormComponent`'s `@Input() hunter: HunterDetailResponse | null` / `@Output() save` contract for create/edit sharing) owns the reactive form; a `playbookId`-driven `computed()`/`valueChanges` subscription swaps in the selected Playbook's move/gear/rating/look options (loaded via a new `PlaybookService`, mirroring `ReferenceDataService`'s existing shape); `HunterCreateComponent`/`HunterDetailComponent` own the actual `HunterService.create()`/`.update()` calls, matching the create/edit split every other domain already uses. Create and Update genuinely share almost everything here, same as Skyler expects — the only per-mode difference is which service method fires and whether the form starts populated.

## 9. Correctness vs. completeness — partial hunters are savable (decided and **implemented 2026-08-31**)

**The question**: should creating or editing a Hunter require a complete, rules-valid character sheet, or should partial progress be savable and resumable? Skyler had earlier picked the strict reading for bespoke sections ("a hunter can't be saved until every section is fully and correctly answered"), then delegated the direction outright — confirm or reverse — because Phase 10 had shipped two inconsistencies with it: move picks treat `MoveGrantCount` as a ceiling only, and gear `PickCount` was not enforced server-side at all.

**Decided: partial saves. A hunter is savable at any stage; what it still owes its playbook is derived on read and reported, never enforced.** The earlier strict selection is reversed, deliberately.

### The split this creates

Two tiers, and the line between them is *what the stored row asserts*:

| | Refused (`400`) | Reported |
|---|---|---|
| **Rule** | The row would assert something **false** about the playbook | The row is merely **unfinished** |
| **Examples** | a pick that isn't this playbook's; a duplicate; an advanced move; more picks than `MoveGrantCount`/`PickCount` allows; a track value past its last box; a look line with both an option and custom text, or neither | no rating array chosen; fewer move picks than `MoveGrantCount`; a gear category short of its `PickCount`; unanswered look lines |
| **Lives in** | `HunterService.Validate` | `HunterCompleteness.Evaluate` |
| **Can it lock a hunter out of being saved?** | No — every violation is fixable by *removing* something | Never — it does not block |

`HunterDetailResponse.Outstanding` carries the second tier: an ordered, human-readable list, empty when the hunter is ready to play. It is returned by `GET /api/hunters/{id}`, `POST` and `PUT`.

### Why, in one argument

**Because Hunters are live-linked to Playbooks (Section 3), "every stored hunter satisfies its playbook's minimums" is not an invariant the database can hold.** A playbook edit can falsify it for every hunter built from that playbook without any of them being touched. Strict save-time enforcement therefore buys a guarantee that is true only at the instant of the last write — while costing a hard lockout: after such an edit the hunter cannot be saved at all, so its owner cannot fix a typo in its *name* without first finishing rules work they may not be ready to do, and there is no migration path for the hunters already in that state. Since the completeness answer has to be recomputed at read time to be correct at all, blocking the write adds nothing except the lockout.

Three supporting facts, all measured rather than assumed:

- **Nothing consumes completeness yet.** There is no play view, no dice roller, no rendered sheet. The guarantee would protect no reader today, while its cost — lost work — lands on the user immediately.
- **The wall is real, not hypothetical.** The Crooked needs 1 rating array + 2 move picks + 3 gear picks + 2 look lines + 5 bespoke sections answered before anything at all could be persisted. Across the 28, `MoveGrantCount` runs 2–4, non-optional gear picks 0–7, look lines 2–7, and 39 of the 49 bespoke sections carry `MinSelect > 0`.
- **Authored data is not uniformly trustworthy.** Section 3 already documents that `MoveGrantCount == 0` is indistinguishable from an unauthored Moves section, which is exactly the state an admin-created (Path B) playbook sits in. Strict minimums make such a playbook impossible to build a hunter from.

**The argument against, accepted rather than dismissed**: the database will hold hunters that are not legal characters, so every future consumer — a play view, a printed sheet, anything that reads a rating array — must handle a hunter with no rating array and no moves rather than trusting the row. That is a permanent tax on every downstream reader, and it is the price of this decision. It is mitigated only by the fact that the live link imposes almost the same tax anyway.

### Why an explicit completeness concept, rather than simply being permissive

Three reasons, in order of weight:

1. **The minimums are authored data with nowhere else to go.** All 39 pick-bearing bespoke sections carry `MinSelect > 0`; someone read them off the sheets on purpose. Pure permissiveness drops that on the floor and leaves the rules unrepresented anywhere in the software.
2. **Follow-on 10b needs a home for 39 more of these.** Defining the mechanism now makes 10b an extension of one evaluator rather than a fresh invention under time pressure — the failure mode being a second, subtly different notion of "done".
3. **It is the only shape that can be correct.** A stored flag or column would be silently falsified by a playbook edit. Section 6.4 already reached this conclusion for bespoke category engagement ("always a derived fact, never a separately stored one"); this reuses that precedent rather than contradicting it.

### Deliberate boundaries

- **Extra tracks contribute nothing to completeness.** `PlaybookExtraTrack` has a `BoxCount` but no starting value, so a missing `HunterExtraTrackValue` is indistinguishable from one holding `0` — and `0` is an ordinary starting position (the Curse-Eater's Corruption starts empty). There is no answer being withheld. `Luck`/`Harm`/`Experience` have the same property. Their *ceilings* are still enforced, in the first tier.
- **A gear category with a null `PickCount` owes nothing**, because null means every option is granted outright rather than picked (`PlaybookGearCategory.PickCount`) — there is no choice to leave unmade. Neither does an `IsOptional` category.
- **`Outstanding` is not on `HunterListItemResponse`.** Computing it per row would need the full template graph for every distinct playbook in the list, to answer a question the user acts on only after opening the hunter. If a "which of my hunters are unfinished" view is wanted later, that is a deliberate addition with a known cost, not an oversight.
- **`GetByIdAsync` makes two round trips**, reusing `GetPlaybookForValidationAsync` rather than widening the hunter query's includes. That keeps completeness and validation reading the *same* graph, which is what stops them drifting apart.

### What this changed in shipped Phase 10 behaviour

- **Gear `PickCount` is now enforced server-side as a ceiling.** It previously existed only as the Angular form disabling further checkboxes, which is not enforcement. This is a genuine gap closed, and it is in the first tier because owning more gear than the sheet allows is a false statement, not an unfinished one.
- **The rating array is no longer required by the form.** The API always allowed null (Phase 10's own judgement call, for Path B playbooks); the form contradicted it. It is now a reported shortfall, which is the consistent reading.
- **Move picks are unchanged** — the ceiling stays, the minimum was never enforced and now has somewhere to be reported.
- **Follow-on 10b's "minimums *and* maximums, enforced recursively" is superseded**: its maximums land in the first tier and its 39 minimums in the second. Nothing about the four instance-side tables changes.
