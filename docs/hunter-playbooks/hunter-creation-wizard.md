# Hunter Playbooks — Hunter Creation Wizard

**Status: DECIDED, 2026-09-13. Phases 0–7 implemented and verified as of 2026-09-15** (Toad's F9 browser pass; see `hunter-creation-wizard-phases.md`). Written 2026-09-12.
- My four design questions are resolved in Section 10.
- Bowser's backend review (Section 12) and Luigi's frontend review (Section 13) are in.
- Their questions are numbered separately, Q1–Q12, and resolved in those sections; Yoshi decided their Q2.
- Yoshi's architecture review (2026-09-14) is Section 14.
- The phased implementation plan is `hunter-creation-wizard-phases.md` (2026-09-14).

UX and interaction design, advisory only. No application code has been changed.

**Stakeholder note: existing hunters are test data (2026-09-14).** Skyler, verbatim: "any existing hunters in the DB are just test data and should be wiped before the work begins." *Coordinator's reading, not Skyler's words:* the hunter rows in any database are wiped before R1. Nothing in this doc needs to protect, audit, backfill or migrate existing hunters. Where Sections 8, 11, 12, 13 or 14 plan audit queries for existing hunters, or warn that existing hunters will be refused on their next save, the wipe replaces that. Playbook data is not covered by this note.

**Prepared by:** Rosalina (Designer)

**What this supersedes, stated rather than left implicit.** `architecture.md` Section 8 recommended a single-page form for Hunter creation and explicitly rejected a wizard; Phase 10 shipped that. Skyler's request below reverses the **UX** half of that recommendation. The **persistence** half still holds and this design keeps it: a Hunter is one request, so the wizard saves once, at the end. `architecture.md` Section 9 (a hunter is savable while unfinished; minimums are reported, not refused) is unchanged and still in force. Section 7.3 and decision Q1 cover how the wizard lines up with it.

---

## 0. The request

Skyler, verbatim:

> I would like to identify a wizard for Hunter creation that flows similar to how Mystery creation does.  It doesn't need to be exactly the same, but if it's useful to rebuild the mystery tracker to support Hunter creation as well, then that might be useful.  Likewise, I do think the "side by side" window view we have for Mysteries could be similarly useful for Hunters.  Obviously some aspects of Hunter creation are rote (like Experience or Harm) but some of the lesser aspects do vary by playbook (all playbooks found at file:///C:/Users/malev/Downloads/RPGs/Monster%20of%20the%20Week/Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf).  Like Luck, which seems to have a unique rule for every playbook.  I think the Wizard should walk the user through the steps in a consistent order, even if they're not necessarily presented this way on the playbook.  A rough suggestion would be: 1) Ratings (with the preset suggestion groups), 2) Luck, Harm, & Experience, which do not have mechanical choices, but the hunter should be shown so they know them, 3) Moves, 4) Bespoke rulesets, in order, 5) Gear, 6) Improvements/Advanced Improvements; again: no mechanical choices yet, just to inform, and 7) Introductions & History to inform.
>
> In general, I think hunter creation does not need to be saved at each step; this differs from Mysteries, which are composed of several different domain objects, whereas the Hunter is all just one domain.  For now, submitting at the final step should save the full hunter data and land the user on the Hunters list view.

Everything outside that quote is my analysis, not Skyler's words.

---

## 1. Method, and what was checked against the PDF

Read in full: the Mystery wizard (`features/mysteries/pages/mystery-create/` — page, store, tracker, dossier, all four phase templates, SCSS), `mystery-detail`, the Hunter feature (`hunters.routes.ts`, `hunter-create`, `hunter-detail`, `hunters-list`, `hunter-form.ts`/`.html`, `bespoke-option-tree`), `core/hunter.ts` and `core/playbook.ts`, `HunterContracts.cs`, `PlaybookContracts.cs`, `HunterService.Validate`, `HunterCompleteness.cs`, the theme tokens in `styles.css`, `ConfirmDeleteModalComponent`, every doc in `docs/hunter-playbooks/`, `docs/updates/multi-minion-wizard-design.md`, `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md`, the relevant `.squad/decisions/records/` records, and `.squad/skills/angular-wizard-decomposition/SKILL.md`.

**The PDF: first pass, then checked.**

*First pass (2026-09-12).* The PDF could not be opened: the `Read` tool's PDF path needs poppler (`pdftoppm`), which is not installed, and no shell was available for `pdftotext`. That pass took its content claims from two sources:
- `src/api/MonsterOfTheWeek.Api/Data/Seed/hunter-playbooks.json` — all 28 playbooks, authored from the PDF and checked against it in Phase 8 (1,076 automated checks; `phases.md` Phase 8);
- the direct-from-PDF readings in `architecture.md` Section 2 and `bespoke-ruleset-catalogue.md`.

*2026-09-13.* The coordinator extracted the PDF with Git Bash's `pdftotext` 4.00, as plain and layout text dumps. Bowser and Luigi checked specific pages against it in their reviews (Sections 12 and 13). I then checked these claims in Sections 0–11 against the plain dump, across all 28 playbooks unless named:
- **Getting Started text**, including the 22 / 3 / 3 split of rules listed before moves, after moves, or not at all (Q3): confirmed.
- **Introductions text:** corrected in 3.2 and Q2. 9 of 28 say "by name, pronouns, and look"; 19 say "by name and look".
- **History section heading and opening line:** the Envoy note in 3.3 (step 8) is resolved; the Q4 quote is corrected to note its small wording variants.
- **"Ratings, pick one line":** printed on every sheet. Confirmed.
- **Harm and Experience rule sentences:** identical on all 28. The Luck sentence has two printed wordings; Skyler decided on 2026-09-14 to show the longer one on every playbook (Gap 2, 12.13).
- **The advanced-improvements sentence** missing from `LevelingUpText`: printed on all 28; now quoted in Gap 4.
- **Single quotes:** The Crooked's Underworld and Heat, the Pararomantic's Luck special, the Curse-Eater's Corruption paragraph, the Initiate's gear paragraph — confirmed.

I did not re-check Gap 1's `MoveGrantCount` examples; Section 12.3 covers them.

---

## 2. What exists today

### 2.1 Hunter creation

| Concern | Where | Today |
|---|---|---|
| Create route | `hunters.routes.ts:10-13` | `/hunters/new` → `HunterCreateComponent` → `HunterFormComponent`, one page |
| Gating | `hunter-form.html:24` | Everything below the playbook picker renders only once a playbook has loaded |
| Save | `hunter-create.ts:53-72` | One `POST /api/hunters` carrying the whole hunter; on success navigates to **`/hunters/:id`** (Skyler wants the list instead) |
| Required to save | `HunterContracts.cs` `UpsertHunterRequest` | `Name` and `PlaybookId` only |
| Refused on save | `HunterService.Validate` | Anything that would assert something false: a pick from another playbook, a duplicate, an advanced move, more picks than a ceiling, a track value past its last box, a blank filled where no blank exists, an answer under a move the hunter hasn't taken |
| Reported, not refused | `HunterCompleteness.Evaluate` → `HunterDetailResponse.Outstanding` | No rating line, too few moves/gear, unanswered look lines, bespoke minimums |
| Edit | `hunter-detail.html` | Same `HunterFormComponent`, plus a "Still to finish" card (`:32-41`) and a "Ready to play" badge |
| Stale picks on playbook switch | `hunter-form.ts:702-738` `dropSelectionsOutside` | Silently cleared |
| Untick a move with in-move answers | `hunter-form.ts:175-185` | Its section state is cleared, no restore (the 2026-09-11 fix) |

### 2.2 The Mystery wizard — tracker and side-by-side view

| Concern | Where | Today |
|---|---|---|
| Store | `mystery-create.ts:24`, `mystery-create.store.ts` | `MysteryCreateStore`, provided on the page component, owns navigation, drafts, reference data and all submissions |
| Structure | `store.ts:246-251` | 4 phases (Mystery 4 steps, Monsters 2, Locations 1, Bystanders 1) |
| Saving | `store.ts:1185-1203`, `:1596-1602` | Each phase is POSTed/PUT when you leave it (`submitPhaseN` → `advancePhase`); the last phase navigates to the mystery |
| Tracker | `mystery-create-tracker.ts/.html` | Numbered phase bubbles with icon + label, connector lines, step dots under multi-step phases |
| Tracker coupling | `tracker.ts:12`; `mystery-create.scss:17-24` | Injects `MysteryCreateStore` directly; the grid is hard-coded to exactly four phases (`grid-template-columns: auto 3rem auto 3rem auto 3rem auto`) |
| Tracker access rule | `store.ts:877-882` | A bubble is clickable only if it's the current phase or already complete (everything in edit mode) |
| Known tracker bug, still present | `mystery-create.scss:50-51` | `.complete` is declared after `.active` at equal specificity, so a finished phase you jump back into shows green with no "you are here" state (reported in `luigi-theming-phase6-mystery-wizard.md` §6, never fixed) |
| Side-by-side layout | `mystery-create.html:4-45` | Left: `w-[42%]` `bg-surface` scrolling column — eyebrow, question-style `h1`, blurb, step content, error band, `← Back` / `Next →` footer. Right: `flex-1 bg-surface-sunken` dossier |
| Dossier | `mystery-create-dossier.html` | Live preview; one `dossier-section` card per built thing, uppercase accent header with icon, `fadeSlideIn` entrance (`mystery-create.scss:66-73`) |

---

## 3. Recommended step structure

### 3.1 The steps at a glance

| # | Tracker label | Step | Skyler's list | Kind | The user decides |
|---|---|---|---|---|---|
| 1 | Playbook | Playbook & name | *not in the list — added* | Choice | playbook\*, name\*, pronouns |
| 2 | Ratings | Ratings | 1 | Choice | one rating line |
| 3 | Tracks | Luck, Harm & Experience | 2 | **Read-only** | nothing |
| 4 | Rules | *{Playbook}* rules — one sub-step per section | 4 | Choice (a few sub-steps read-only) | each section's picks |
| 5 | Moves | Moves | 3 | Choice | move picks, plus any picks inside a move |
| 6 | Gear | Gear | 5 | Choice | gear picks |
| 7 | Improvements | Improvements & Advanced Improvements | 6 | **Read-only** | nothing |
| 8 | Introductions | Look, Introductions & History | 7 (+ Look) | Mixed | look lines; optional history notes |

\* The API refuses a hunter without these.

This is the decided order: Skyler's list with step 1 added in front, Rules moved ahead of Moves (Q3), and Look on the last step (Q2). Both were resolved 2026-09-13.

### 3.2 Changes from Skyler's order, and why

1. **A step 1 for Playbook & name.** Skyler's list starts at Ratings, but every step after it is a property of the chosen playbook, and the API requires a name. This isn't a reordering — it's a prerequisite the list left implicit. Name and pronouns sit here too; look does not (Q2).
2. **Rules before Moves (Q3).** 22 of the 28 sheets' own Getting Started text puts the bespoke rules before moves, and The Crooked's Underworld tells the player to.
3. **Look joins the last step (Q2).** Every playbook's Introductions text asks the player to introduce the hunter by name and look. Checked against the PDF 2026-09-13:
   - 19 of 28 say "by name and look".
   - 9 say "by name, pronouns, and look": The Action Scientist, Celebrity, Changeling, Covenant ("your Covenant and ally"), Envoy, Forged, Host, Interface and Visitor. These are the same nine whose Getting Started says "pick a name and pronouns".
4. **Extra tracks and the one journal sit on step 3.** The Curse-Eater's Corruption and the Pararomantic's Relationship Status are box tracks, the same shape as Luck and Harm, and have no creation-time choice. The Pararomantic's Luck rule itself reads "When you spend a point of Luck, also mark off one of your relationship status boxes." — the two belong on the same screen. The Curse-Eater's Consumed Magic journal goes with Corruption, because the source prints its instructions under Corruption ("Record what the magic was, the power it offers you, and the downside it asks of you. The Keeper will provide these…").
5. **Picks printed inside a move stay with the move.** The 13 move-internal sections render inline under their move on step 5, as the form does today; step 4 covers only playbook-level sections. This is the same split the API already makes (`PlaybookMoveResponse.BespokeSections` vs `PlaybookDetailResponse.BespokeSections`).

### 3.3 Step by step

Titles follow the Mystery wizard's question-style voice (`store.ts:561-575`). The copy is a suggestion; the structure is the recommendation.

**Step 1 — "Who Is Your Hunter?" (choice)**
- **Shows:** the searchable playbook picker (`app-custom-select`, as today). Once a playbook is chosen: its flavour blurb (`Description`, plain text; the Pararomantic's is null, so the block is omitted) and its Getting Started text in a reference panel.
- **Decides:** playbook, name, pronouns.
- **Done when:** playbook and name are both set. This is the one hard gate in the wizard (Q1), because the server requires both.
- **Dossier:** header card — name, pronouns, `bg-badge-playbook` playbook badge.

**Step 2 — "How Do They Handle Trouble?" (choice)**
- **Shows:** the playbook's rating lines as radio cards. I'm reading Skyler's "preset suggestion groups" as these lines: every sheet prints "Ratings, pick one line" with five unlabelled arrays (`architecture.md` §2), so there are no group names to show.
- **Layout change from today:** lay each card out as a 5-column grid (`grid grid-cols-5`) with the stat name as a small muted label above a signed value (`formatStat`, `hunter-form.ts:427`). The lines then compare as a table, which is the whole task on this step. Today's `flex flex-wrap gap-4` (`hunter-form.html:51`) puts the values at different x-positions from line to line.
- **Decides:** one line.
- **Dossier:** Charm / Cool / Sharp / Tough / Weird as five compact columns.

**Step 3 — "What Keeps Them Alive?" (read-only)**
- **Marker under the blurb:** "Nothing to choose here — this is what your hunter lives with." (same phrase family as the existing "Always active — nothing to choose.", `hunter-form.html:402`).
- **Luck:** a row of `LuckBoxCount` empty boxes with the start/end labels, the Luck rule sentence "Mark luck to change a roll to 12 or avoid all harm from an injury." (the same on every playbook; Gap 2), then the playbook's own rule in a callout headed "*{Playbook}* special" (`LuckSpecialText`). This callout is the thing Skyler singled out, and the data holds a distinct rule for all 28.
- **Harm:** `HarmBoxCount` boxes with the `HarmUnstableThreshold` point marked ("unstable at 4").
- **Experience:** `ExperienceBoxCount` boxes and the experience trigger sentence.
- **Extra tracks, where the playbook has one:** a box row with `StartLabel ?? "Okay"` and `EndLabel`, then `Description` and `EffectText` (constrained HTML, as today).
- **Journal, where the playbook has one:** its title and field labels, with "Entries are added during play." No entry authoring at creation.
- **Values sent:** Luck, Harm and Experience 0; extra tracks omitted (the server treats a missing value as 0, `architecture.md` §9).
- **Dossier:** one line per track ("Luck 0 of 7", "Harm 0 of 7 · unstable at 4", …).

**Step 4 — *{Playbook}* rules (choice), one sub-step per playbook-level section**
- **Sub-steps:** one per `PlaybookDetailResponse.BespokeSections` row in `SortOrder` — 0 to 3 per playbook, 36 in total across 24 playbooks. Eyebrow: "Step 4 of 8 · Crooked rules · 2 of 3". Title: the section's own title (e.g. "Heat"). Sub-steps map directly onto the tracker's existing step-dot vocabulary.
- **Renderers are today's, unchanged:** option tree (`BespokeOptionTreeComponent`, to depth 3), free text (the Gumshoe Code), repeatable entries (the Hex's Rotes, `+ Add`), and fixed grants shown read-only (7 sections — among them the Covenant's Covenant, the Envoy's Secret Wisdom, the Monstrous's Monster Breed, the Snoop's Crew and Team Concept). `Description` above, `EffectText` below.
- **The Chosen's Fate** carries the second Luck beat in its `EffectText` by Skyler's 2026-08-30 call (`phases.md` Phase 7). It shows here, where Skyler intended the reminder to land.
- **Numeric leaf** (the Spooktacular's Infernal Favour, 0–3): starts at its maximum the moment the option is picked, per `architecture.md` §6.4's start-at-max convention. It is shown as "3 of 3", not as an input — it's play state, exactly like Luck.
- **Playbooks with no playbook-level sections** (The Celebrity, The Flake, The Mundane, The Searcher): the step is skipped, and the tracker shows it as not applicable (Section 4.3). The Searcher's First Encounter, Guardian and Network are move-internal and appear on step 5.
- **Dossier:** one "Rules" card, with a sub-block per section listing the picked option titles (or description text with each `{{blank}}` replaced by its answer, `line-clamp-2`).

**Step 5 — "What Can They Do?" (choice)**
- **Shows:** a heading line such as "You get all the basic moves, plus 3 Chosen moves." Required moves come first, checked and disabled with the "Always granted" badge (as today). The pick pool follows with an "n of N picked" counter. Advanced moves stay hidden (as today). A move's own section renders indented under it once the move is ticked or required (as today).
- **The counter is wrong today for 14 playbooks — see Gap 1.** It must read "picks beyond the required moves", which is not what the current code computes against the authored data.
- **Basic moves:** a single line, not a list; the data isn't reachable (Gap 3).
- **Dossier:** required and picked move names, with in-move answers indented beneath their move.

**Step 6 — "What Do They Carry?" (choice)**
- **Shows:** categories in `SortOrder`, each with its label and "n of N picked" (as today).
- **One correction to today's form:** a category with a null `PickCount` means every option is granted outright (`architecture.md` §2). The form currently renders those as optional checkboxes hinted "Pick any number" (`hunter-form.ts:431-434`), which misstates the rules. Render them as a read-only "You get" list, the same treatment as required moves.
- **The Initiate:** its pick counts depend on the Sect ruleset and exist only as prose in the category label ("If your Sect has fighting arts or obsolete gear (see next page) then pick three old-fashioned weapons…"). Gear already comes after Rules in both orders, so the player reads this with their Sect decided. No special handling. *(Superseded 2026-09-13: see 12.9.)*
- **Dossier:** "*Category*: item, item" per category.

**Step 7 — "How Will They Grow?" (read-only)**
- **Shows:** `LevelingUpText`, then two reference lists, "Improvements" and "Advanced improvements", each in `SortOrder`. Same "nothing to choose here" marker as step 3.
- **Gap 4 applies:** the stored text stops before the sheet's "After you have leveled up five times, you qualify for advanced improvements in addition to these." Don't paraphrase it in UI copy; show it once it is in the data.
- **Dossier:** no section — this is reference, not something the hunter has built.

**Step 8 — "Who Are They to the Others?" (mixed; the final step)**
- **Shows:**
  - The look lines: chips plus "or your own…" per line, grouped by `GroupLabel` for The Forged (as today).
  - `IntroductionsText` and `HistoryPromptsText` in reference panels.
  - An optional **History notes** textarea directly under the prompts (Q4). It uses the choice-card input treatment, labelled "History notes (optional)". It saves to the hunter's existing History field (`Hunter.Background`, sent as `UpsertHunterRequest.Background`) and never counts toward "Still to finish".
  - The "Still to finish" summary (Section 7.3).
  - The primary button, **Create Hunter**.
- **Rendering fix:** `HistoryPromptsText`, `IntroductionsText` and `GettingStartedText` are plain text containing `\n\n` paragraphs and `- ` bullet lines. `hunter-form.html:351` currently binds the history prompts through `[innerHTML]`, which collapses every newline and turns the prompt list into one run-on paragraph. Render these as text with `whitespace-pre-line`; `architecture.md` §6.3 confirms they are not HTML fields.
- **Envoy wording, checked against the PDF 2026-09-13:** the Envoy's Getting Started ends "…introduce yourself and pick a story". Its sheet still heads the section "History", which opens "Go around the group again. On your turn, pick one for each of the other hunters:". "Story" is Getting Started wording only. So the step title needs no special case, and the history reference panel can be headed "History" for every playbook.
- **Dossier:** a "Look" line under the header card.

---

## 4. The tracker — reuse or rebuild

### 4.1 Options

- **A. Copy it.** Duplicate `mystery-create-tracker` and its SCSS into the hunters feature. No risk to the Mystery wizard, but two trackers drift — and the precedence bug gets copied too.
- **B. Extract a shared, presentational tracker, and migrate the Mystery wizard onto it. (Recommended.)** A `WizardTrackerComponent` in app-wide `shared/`. It takes inputs — per step a label, optional icon, sub-step count and status; the current step and sub-step — and emits a jump event. It does not inject any store. Each wizard maps its own state onto those inputs; the Mystery wizard keeps its "complete or current" access rule by mapping it.
- **C. Rebuild the Mystery store into a generic wizard engine both use. (Rejected.)** Nearly all of `MysteryCreateStore`'s weight is per-phase submission and ordering child-entity creation — exactly what Skyler says Hunters don't need. A shared engine would couple two very different lifecycles to share the ~40 lines of navigation that are actually common.

**Trade-off accepted with B:** it touches a working, spec-covered wizard. Make the Mystery migration its own first sub-phase. It should be a no-op apart from the precedence fix below, verified by `mystery-create.spec.ts` and `mystery-create.store.spec.ts` and a two-theme visual check. *(Q9 adds the shell fixes to both wizards: see 13.4.)*

### 4.2 States

Five states, one ladder, all existing tokens:

| State | Bubble | Content |
|---|---|---|
| Current | `bg-accent border-accent text-on-accent` | number, or ✓ if also finished |
| Finished | `bg-success border-success text-on-success` | ✓ |
| Visited, unfinished (Q1: the user may carry on past it) | `bg-transparent border-accent text-accent` | number |
| Not reached | `border-strong text-muted`, disabled, `opacity-50` | number |
| Not applicable (Rules step, zero sections) | `border-dashed border-strong text-muted`, not clickable | – |

**Current always wins.** This fixes `mystery-create.scss:50-51` for both wizards. That is a deliberate visible change to the Mystery wizard: a finished phase you jump back into shows accent with a ✓ instead of plain green.

Connector lines keep today's rule: `bg-success` once the step before them is finished. Step dots use the same ladder (`bg-accent` / `bg-success` / `bg-border`).

No warning hue exists in the token set (`styles.css:43-105`), and none is introduced. "Unfinished" is the outline-accent treatment the wizard already uses for secondary actions (`mystery-create-locations-phase.html:28`).

### 4.3 Layout, labels and sub-steps

- **Grid columns come from the step count.** They replace the hard-coded four-phase template; connectors become `minmax(1.5rem, 3rem)`.
- **Eight labels:** Playbook, Ratings, Tracks, Rules, Moves, Gear, Improvements, Introductions — none longer than 13 characters at `text-xs`. Below `lg`, only the current step's label is shown; the rest are `sr-only`.
- **Icons:** optional in the shared component. The Mystery wizard keeps passing its kinds. Hunter v1 is labels only, since no hunter step symbols exist in the sprite; drawing eight is separate work.
- **Rules sub-steps:** the Rules bubble carries one dot per section. `Next`/`Back` walk the dots; clicking the bubble lands on the first dot (the `jumpToPhase` precedent, `store.ts:868-875`).
- **Clickable bubbles:** any step up to the furthest reached. Bubbles beyond that stay disabled, which preserves Skyler's "consistent order" without trapping anyone behind a save.
- **Accessibility:** `aria-current="step"` on the current bubble; an `aria-label` such as "Step 4, Rules, unfinished"; dots are `aria-hidden`, with the eyebrow carrying "2 of 3" in text.

---

## 5. The side-by-side view — reuse or rebuild

**Recommendation: share the shell, build a new Hunter dossier, and keep the 42% column.**

- **Shell.** Extract `mystery-create.html:1-45` into a presentational `WizardLayoutComponent`: a tracker on top, the left column with eyebrow/title/blurb inputs and projected content, the error band, a footer slot, and the aside with projected content. The `app-mystery-create { display:block; height:100% }` host rule and the `fadeSlideIn` keyframe move with it. Add a `prefers-reduced-motion` override, which the current SCSS lacks. The shell is small, but sharing it is what keeps column width, scroll behaviour, footer placement and error-band position identical across both wizards. That consistency is the reason Skyler raised the view at all.
- **Column width stays `w-[42%]`.** I checked this against the densest content, the Moves step. At a 1280px viewport the left column gives roughly 370px of text width, about 48 characters at the form's `0.85rem` description size. At 1440px it's about 440px, around 55 characters. Both sit inside a comfortable reading measure, so nothing justifies departing from the Mystery wizard. The tightest case is a depth-3 option tree (each level adds `border-l-2 pl-3`), and it still fits.
- **Dossier.** A new `HunterSheetPreviewComponent`, domain-specific, reusing the existing dossier vocabulary verbatim: the `dossier-section bg-surface border border-default rounded-lg mb-5 p-5` cards, the `text-accent text-[0.8rem] font-bold tracking-[0.06em] uppercase` header, and the `text-muted text-[0.75rem] … uppercase` field labels (`mystery-create-dossier.html:6-13`).
  - Empty state: "Your hunter will take shape here as you work through each step." (mirroring `:1-3`).
  - Sections appear once their step has been visited, in step order: header → Ratings → Tracks → Rules → Moves → Gear → Look.
- **Step content** (for Luigi/Yoshi to confirm). `HunterFormComponent` already contains every renderer the wizard needs, but as one template plus state held in the component. Split its section blocks into section components (ratings, moves, gear, look, tracks, bespoke section). Move its draft signals and its `onSubmit` request mapping into a shared draft class. Both the wizard steps and the existing edit page then consume the same pieces, and the two surfaces can't drift on either rendering or wire shape. *(See 13.5–13.6.)*

---

## 6. Visual grammar — choice versus read-only

Skyler's list mixes steps with real choices and steps that only inform. The user should be able to tell which kind they're on at a glance, without reading the blurb.

| Element | Treatment | Source of the vocabulary |
|---|---|---|
| Choice card (unselected) | `flex items-start gap-3 bg-surface border border-default rounded-lg p-3`, whole card is the label | `hunter-form.html:109` |
| Choice card (selected) | add `border-accent bg-accent-subtle` | the "Editing" card, `multi-minion-wizard-design.md` §1.1 |
| Choice card (at limit) | `opacity-60`, control disabled | `hunter-form.html:111` |
| Progress counter | `text-[0.8rem] font-semibold text-muted` "n of N picked" | `hunter-form.html:71-77` |
| Reference panel (read-only text) | `bg-surface-sunken rounded-lg p-4`, **no border**, uppercase muted label, body `text-primary text-[0.9rem] leading-[1.65] whitespace-pre-line` | one step down the elevation ladder, `multi-minion-wizard-design.md` §1.2 |
| Playbook-special callout | `bg-accent-subtle rounded-lg p-4`, label "*{Playbook}* special" in `text-accent` | accent-subtle wash, as above |
| Box row | `inline-block h-4 w-4 rounded-sm border border-strong`, `gap-1`, muted start/end labels | `border-strong` is the form-control line colour |
| Read-only marker | `text-muted text-[0.8rem] italic` | `hunter-form.html:402` |
| Error band | `bg-danger-subtle border border-default rounded-md text-danger text-sm px-3 py-[0.6rem]` | `mystery-create.html:31` |
| Back / Next / Create Hunter | the two footer class strings, unchanged; last step reads **Create Hunter** / "Creating…" | `mystery-create.html:35-37` |

**The rule:** anything with a border and a control is a decision; anything on a sunken, borderless panel is something to read. `Next →` / `Create Hunter` stays the only filled accent control in the column (`rosalina-multi-minion-wizard-design.md` item 2). Any secondary action (`+ Add` entry) uses the outline-accent button.

---

## 7. State and navigation, with nothing saved until the end

### 7.1 One draft, one store

A `HunterCreateStore`, provided on the page component (the `MysteryCreateStore` precedent and `.squad/skills/angular-wizard-decomposition/SKILL.md`). It holds:

- the playbook list and the loaded playbook;
- the draft (the signal shapes `HunterFormComponent` already uses — moves, gear, look answers, bespoke picks/answers/free text/instances);
- navigation: current step, current sub-step, furthest step reached;
- `isSubmitting`, `submitError`;
- a computed status per step.

There is no per-step submission. That single difference from the Mystery store is the entire consequence of Skyler's "one domain" point.

### 7.2 Moving between steps

- **`Next →`:** validates the step (7.3), then advances. It skips the Rules step when the playbook has no sections, and walks Rules dot by dot otherwise.
- **`← Back`:** always allowed, never loses anything.
- **Tracker:** jump to any step up to the furthest reached (4.3).

### 7.3 Per-step validation

**Decided 2026-09-13 (Q1): soft everywhere except step 1.**

- `Next` is blocked only on step 1 (playbook + name).
- Every other step can be left short. Its bubble takes the "visited, unfinished" state.
- Ceilings stay enforced inline, as they already are (disabled options at the limit), so nothing the server would refuse can be built.
- The last step shows a **"Still to finish"** card in the `hunter-detail.html:33-40` vocabulary. Each line is an outline-accent link that jumps to its step. **Create Hunter** stays enabled.

Each step's "finished" test mirrors a line `HunterCompleteness.Evaluate` already produces, so the wizard and the hunter page never phrase the same gap two ways ("Moves: 1 of 2 picked.", "Heat: 1 of 2 picked."):

| Step | Finished when |
|---|---|
| Playbook | playbook and name set |
| Ratings | a line chosen (or the playbook has none) |
| Tracks, Improvements | visited |
| Rules sub-step | section minimum met — engaged top-level count ≥ `MinSelect`, engaged categories at their own minimum, free text filled, `MinInstances` met; fixed grants: visited |
| Moves | picks beyond required = the playbook's pick budget (after Gap 1 is fixed), and every taken move's own section at its minimum |
| Gear | every non-optional category with a `PickCount` is full |
| Introductions | every look line answered (History notes never count, Q4) |

*Superseded in part 2026-09-13 (Q2, decided by Yoshi): step marks and the "Still to finish" card come from the server check, and this table now describes what the server's items mean. See 12.8.*

### 7.4 When an earlier choice changes

- **Switching playbook after picking anything that belongs to the old one.** This is the one choice that invalidates later steps wholesale, and in a wizard those later steps can be several screens of work. Confirm first, reusing `ConfirmDeleteModalComponent`:
  - `verb="Switch to"` and `itemName` = the new playbook, so the title reads *Switch to "The Hex"?*;
  - `message` = "These belong to The Crooked and will be cleared:";
  - `items` = what goes (e.g. "Rating line", "2 moves", "Background, Heat", "3 gear picks", "2 look lines");
  - `permanenceNote` = "Your name and pronouns stay."

  One small tweak is needed: the modal uses `verb` as the confirm button's label too, and "Switch to" is a poor button. Add an optional `confirmLabel` input ("Switch playbook").

  On confirm, clear the playbook-scoped draft (today's `dropSelectionsOutside`) and reset "furthest reached" to step 1. On cancel, the picker must revert to the previous playbook rather than keep the new value.
- **Unticking a move that has in-move answers.** Keep today's behaviour: cleared, no confirm (`hunter-form.ts:175-185`). The section renders directly under its move, so its disappearance is visible at the point of the click, and a confirm on a checkbox would fire constantly.
- **Changing a Rules pick that later steps depend on.** The only such dependency in the data is the Initiate's Sect → gear counts. It exists as prose, with permissive stored maxima, so nothing downstream becomes invalid. No handling. *(Superseded 2026-09-13: see 12.9; frontend handling in 13.7.)*
- **Name, pronouns, rating line, look:** nothing depends on them.

### 7.5 Leaving mid-flow

- **In-app navigation** (sidebar, the `← Back to hunters` link, browser back). If the draft is dirty — a playbook chosen or anything typed — a `canDeactivate` guard opens `ConfirmDeleteModalComponent`:
  - `verb="Discard"`, `itemName` = the name so far, or "New Hunter";
  - `message` = "Nothing has been saved yet.", `permanenceNote=''`.

  The guard stands down after a successful create. It is the first `canDeactivate` guard in the app (none exists today). *(Session expiry and sign-out: see 13.8.)*
- **Refresh or tab close:** the browser's native `beforeunload` prompt.
- **No draft persistence in v1** (the skill doc's `persist()`/`restore()` sketch is not used). Skyler asked for no mid-flow saving. Restoring a draft after a playbook edit would also need the same stale-id pass as a playbook switch. It's additive later if wanted.

### 7.6 Final submit

1. **Create Hunter** builds the same `UpsertHunterRequest` the form builds today and calls `POST /api/hunters`; the button shows "Creating…" and is disabled while the request is in flight.
2. **Success:** the existing toast (`Hunter "{name}" created.`), then navigate to **`/hunters`**, per Skyler. That replaces today's `/hunters/:id` (`hunter-create.ts:62`).
3. **Refusal (400):** the server's own message goes in the error band on the last step (today's handler already surfaces `error.error.message`). The draft stays intact, and the user can jump via the tracker to fix it. With ceilings enforced inline this should not normally happen. *(Today it is two toasts, not one: see 13.2 and 13.10.)*

### 7.7 Editing an existing hunter

Create-only. `/hunters/new` becomes the wizard, replacing the single-page create. `/hunters/:hunterId` keeps `HunterFormComponent` for edits, unchanged. Skyler asked about creation only, and the section-component split in Section 5 keeps the two surfaces rendering from the same pieces.

---

## 8. Data gaps

| # | Gap | Step | Severity | Handling |
|---|---|---|---|---|
| 1 | **`MoveGrantCount` means two different things.** The seed stores the sheet's total, required moves included: The Chosen 3 (2 required + pick 1), The Celebrity 3 (1 + pick 2), The Curse-Eater 4 (2 + "Then pick two"), The Spell-Slinger 4 (1 + "Plus pick three") — `architecture.md` §2, `bespoke-ruleset-catalogue.md`. The code treats it as picks *beyond* required moves: `HunterService.cs:177-194` ("MoveGrantCount is how many moves a hunter picks beyond the ones the playbook grants outright"), `HunterCompleteness.cs:54-63`, `hunter-form.ts:119-140`. For the **14 playbooks with required moves** (Celebrity, Changeling, Chosen, Curse-Eater, Forged, Gumshoe, Hex, Host, Initiate, Pararomantic, Professional, Searcher, Spell-Slinger, Wronged), the ceiling allows too many picks by the required count, and a correctly built hunter is reported unfinished (a Chosen with its one pick reads "Moves: 1 of 3 picked."). The completeness verification in `phases.md` used The Crooked, which has no required moves, so this was never exercised. | Moves | **High — the only gap that blocks a correct step.** A shipped bug, not wizard-specific, but the wizard puts its counter and step status front and centre. | Bowser: audit all 14 against the page, then fix one side (code subtracting required moves is the smaller change, if the audit confirms the seed is consistently "total"). Must land before the Moves step. |
| 2 | The universal Luck, Harm and Experience rule sentences and the standard tracks' start/end labels aren't stored — only box counts, the unstable threshold and `LuckSpecialText`. | Tracks | Low | UI constants. Checked against the PDF 2026-09-13:<br>• **Harm** ("When you reach 4 or more, mark unstable.") is identical on all 28.<br>• **Experience** ("Whenever you roll and get a total of 6 or less, or when a move tells you to, mark an experience box.") is identical on all 28.<br>• **Luck is not.** 22 print "Mark luck to change a roll to 12 or avoid all harm from an injury." The Expert, Flake, Initiate, Monstrous, Mundane and Professional print "Mark luck to change a roll to 12 or avoid all harm."<br>**Decided 2026-09-14 by Skyler, option "Longer wording for all":** every playbook shows "Mark luck to change a roll to 12 or avoid all harm from an injury." as one constant. Skyler chose it with no comment; see 12.13 for the record. |
| 3 | Basic moves aren't reachable: `BasicMove` has an entity, a `DbSet` and a `BasicMoveResponse`, but no endpoint and no frontend reference, and `PlaybookDetailResponse` carries none. | Moves | Low | One line ("You get all the basic moves"); list them once the data is seeded and exposed. |
| 4 | `LevelingUpText` stops at "…pick an improvement from the following list:" / "…from the list below." on all 28, so the sheet's sentence about when advanced improvements unlock isn't stored. The PDF prints it on all 28 (checked 2026-09-13): "After you have leveled up five times, you qualify for advanced improvements in addition to these." A few add a short tail, such as "They're below." | Improvements | Low | Show the two lists under headings; don't paraphrase the rule in copy. Getting the sentence into the data is Bowser's call (see 12.4, Gap 4). |
| 5 | `HistoryPromptsText` / `IntroductionsText` / `GettingStartedText` are newline-formatted plain text, and the current form renders the history prompts through `[innerHTML]`, collapsing them into one paragraph (`hunter-form.html:351`). | Playbook, Introductions | Low (live rendering bug) | `whitespace-pre-line` text rendering in both the wizard and the edit form. |
| 6 | Granted-outright gear categories (null `PickCount`) render as optional checkboxes "Pick any number" (`hunter-form.ts:431-434`). | Gear | Low (live UX bug) | Read-only "You get" list. |
| 7 | Gear has no freeform escape; The Chosen's Material "anything else you want" is a literal option (`phases.md` Phase 4 finding 2). | Gear | Low | Unchanged; noted so nobody expects an input. |
| 8 | The Initiate's gear counts depend on Sect, stored only as label prose with permissive maxima. | Gear | Low | Order already puts Rules first. *Superseded 2026-09-13: see 12.9.* |
| 9 | No hunter step icons exist in the sprite. | Tracker | Low | Labels only in v1. |

**Nothing structural is missing.** Every step's content is stored for all 28 playbooks: rating lines, `LuckSpecialText` (28 distinct), box counts, moves with required/advanced flags and in-move sections, bespoke sections in order, gear, improvements (both lists), Getting Started, Introductions, history prompts, looks, extra tracks and the journal. Gap 1 is the only one that makes a step show the wrong answer. *(Superseded 2026-09-13: see 12.4 Gap 8 and 12.9.)*

**Not a gap: the History notes box (Q4).** It needs no new field. `Hunter.Background` already exists and has held History and nothing else since Follow-on 10b (`architecture.md` Section 8; `phases.md` Follow-on 10b). It travels as `UpsertHunterRequest.Background` and is already edited by the textarea on `/hunters/:hunterId`. The wizard's box binds to the same field, so there is no schema, contract or migration change.

---

## 9. Proposed defaults — decided here, not questions

1. The wizard is create-only and replaces the single-page create at `/hunters/new`; editing stays on `/hunters/:hunterId` (7.7).
2. Step 1 is the one hard gate: playbook and name (3.3, 7.3).
3. Rules get one sub-step per playbook-level section; the step is skipped and shown as not applicable for The Celebrity, The Flake, The Mundane and The Searcher (3.3, 4.2).
4. Extra tracks and the Curse-Eater's journal are read-only on step 3; no journal entries at creation (3.2, 3.3).
5. Luck, Harm, Experience start at 0; extra tracks are omitted; the numeric leaf starts at its maximum (3.3).
6. Granted gear is a read-only list, not checkboxes (3.3, Gap 6).
7. Tracker bubbles are clickable up to the furthest step reached; "current" always wins; the Mystery wizard's precedence bug is fixed in the shared tracker (4.2, 4.3).
8. Switching playbook with picks in place asks first; name and pronouns survive (7.4).
9. Unticking a move keeps today's silent clear (7.4).
10. Leaving a dirty draft asks first (guard plus `beforeunload`); no draft persistence in v1 (7.5).
11. Create Hunter → toast → `/hunters`; refusals show in the error band and keep the draft (7.6).
12. Share the tracker and the layout shell with the Mystery wizard; keep the 42% column; build a new Hunter dossier (4, 5).
13. Plain-text playbook prose renders with `whitespace-pre-line`, never `innerHTML` (Gap 5).
14. Selected choice cards get `border-accent bg-accent-subtle`; read-only content sits on borderless sunken panels (6).

---

## 10. Decisions (formerly Open Questions for Skyler)

**All four resolved 2026-09-13. Skyler selected the recommended option on each and added no comments.** The reasoning under each is mine, kept as the record of why that option was recommended. The questions are listed in their original rank order, by how much the answer changed the design, and the options are as they were shown.

**Q1 — When a step isn't finished, can the user carry on?** **RESOLVED 2026-09-13: A, "Carry on".** Applied in Sections 4.2 and 7.3.

Concrete case: The Crooked's Heat says "Pick at least two of these and name the people involved." A player who can think of one enemy so far reaches Next.

- **A. Yes, carry on (recommended; chosen).** Only step 1 (playbook and name) blocks. Unfinished steps are marked on the tracker, the last step lists what's left with links back, and Create Hunter always works. The hunter lands with its "Still to finish" list, exactly as a half-built hunter does today (`architecture.md` §9).
- **B. No — each step blocks Next until it's finished.** The simplest mental model, but with nothing saved mid-flow, one undecided section means abandoning the whole hunter.
- **C. Move freely, but Create Hunter stays disabled until everything is finished.** Same lockout as B, just discovered at the end instead of in the moment.

*Why A:* the server already accepts unfinished hunters and reports what's owed; B and C would re-impose, in the browser, the lockout that decision removed — and here the cost is worse, since leaving loses everything.

**Q2 — Where do name, pronouns and look go?** **RESOLVED 2026-09-13: B, "Split".** Applied in Sections 3.1–3.3.

Your list starts at Ratings. The sheets say, e.g. The Crooked: "To make your Crooked, pick a name. Then follow the instructions in this playbook to decide your look, ratings, background, heat, underworld, moves, and gear. Finally, introduce yourself and pick history." And every Introductions text asks for name and look, e.g. The Action Scientist: "Go around the group. On your turn, introduce your Action Scientist by name, pronouns, and look, and tell the group what they know about you."

*Corrected 2026-09-13 against the PDF.* As first shown, this line said every Introductions text asks for "name, pronouns, and look". In fact 9 of 28 add pronouns, as the Action Scientist does, and the other 19 say "by name and look". The options and the answer below are unchanged.

- **A. All up front:** playbook, name, pronouns and look together on step 1, matching Getting Started.
- **B. Playbook, name and pronouns on step 1; look on the last step, beside Introductions (recommended; chosen).**
- **C. Playbook alone on step 1; name, pronouns and look all on the last step.**

*Why B:* step 1 stays a clean "commit to a playbook" decision — the one choice that wipes everything later — and look is picked right where the sheet asks the player to describe it. The name stays early because it's required and heads the live preview. (C would leave the preview nameless for the whole walk.)

**Q3 — Should the playbook's own rules come before Moves?** **RESOLVED 2026-09-13: B, "Rules, then Moves".** Applied in Sections 3.1–3.3.

Your list has Moves (3) then Bespoke rulesets (4). The sheets mostly go the other way: 22 of 28 Getting Started texts list the bespoke rules before moves, 3 list them after (The Hex: "…decide your look, ratings, moves, Temptation, and gear."; The Initiate; The Spooky), and 3 have none. The Crooked's Underworld says outright: "Pick how you discovered about the real underworld. Keep this in mind when you select your moves in the next section, so that everything fits together."

- **A. Keep your order — Moves, then Rules.**
- **B. Rules, then Moves (recommended; chosen).**

*Why B:* the rules are usually who the hunter is (a background, a fate, a mission), and moves are picked to fit. Either order still gives every playbook the same sequence. Picks printed inside a move stay with that move in both options.

**Q4 — On the last step, can the player write down their history picks?** **RESOLVED 2026-09-13: B, "Prompts + notes box".** Applied in Sections 3.3 (step 8) and 7.3. The box writes to the existing `Hunter.Background` field (see the note under Section 8).

Your list says "Introductions & History to inform." Each sheet's history section opens with a close variant of "Go around the group again. On your turn, pick one for each of the other hunters:" followed by the prompts.

*Corrected 2026-09-13 against the PDF.* As first shown, this line quoted that opener as if every sheet printed it word for word. The wording varies slightly: "When it's your turn", "for each other hunter", and The Spooky's "for each hunter". The options and the answer below are unchanged. The hunter already has a free-text History field, used on its edit page today.

- **A. Read-only.** Show the prompts; the player records history later from the hunter's page.
- **B. Show the prompts, plus an optional "History notes" box underneath (recommended; chosen).**

*Why B:* players tend to pick history while the prompts are in front of them. The field already exists. An empty box costs nothing and doesn't count toward "Still to finish", while leaving it out guarantees a second trip into the edit page straight after creating.

---

## 11. Handoff notes for Luigi and Bowser

- **Luigi (frontend), in suggested order:** *(Superseded in part 2026-09-13: see 13.16.)*
  1. Extract `WizardTrackerComponent` + `WizardLayoutComponent` and migrate the Mystery wizard, a no-op apart from the precedence fix.
  2. Split `HunterFormComponent` into section components plus a shared draft/request class, with the edit page unchanged in behaviour.
  3. Build `HunterCreateStore`, the eight steps and `HunterSheetPreviewComponent`. The step 8 History notes textarea binds to the draft's existing `background` value (Q4). While in `hunter-form.html:345`, retitle the edit page's stale Background hint ("History, and anything else this playbook asks for — a structured version of this section comes later.") to "History notes". Every other section has been structured since Follow-on 10b.
  4. Add the playbook-switch confirm (with a `confirmLabel` on the modal) and the discard guard.
  5. Fix Gaps 5 and 6 in the shared section components.
- **Bowser (backend):** no new endpoint or contract change is needed — `POST /api/hunters` already takes the whole hunter. That includes Q4's History notes, which persist to the existing `Hunter.Background` column, so no new field or migration is needed. **Gap 1 needs an audit and a fix before the Moves step ships.** Gap 4 is an optional seed correction. Gap 3 (exposing basic moves) is optional and only affects one line of copy. *(Superseded in part 2026-09-13: see 12.8 and 12.9.)*
- `.squad/ceremonies.md` lists a design-review (Rosalina facilitating, Luigi and Peach participating) before UI work begins; Skyler named Luigi and Bowser as reviewers for this doc; both reviews are in (Sections 12 and 13).

---

## 12. Backend review — Bowser

**2026-09-13. Review only. No application code, seed, migration or test was changed.** Sections 0–11 are Rosalina's and are left as written; where I disagree, I say so here. At first the playbook PDF could not be rendered (no poppler), so the first pass rested on `hunter-playbooks.json`, `docs/hunter-playbooks/`, the authoring skill and verifier, and the test suites, and marked points only the printed page could settle as **PDF-only**. Later on 2026-09-13 the PDF turned out to be readable with Git Bash's `pdftotext` 4.00. Those points are now checked against the pages and the markers replaced with what the pages print (12.3, 12.4, 12.6 B10, 12.9, 12.12).

**Updated 2026-09-13 with Skyler's answers to Q1–Q4 (12.7), Q5–Q7 (12.10), Q10–Q11 (12.11) and Q12 (12.12, which supersedes Q6 and Q7 after the PDF check), and Yoshi's decision on Q2 (12.8).** Skyler selected options and added no comments, so no reasoning in this section is Skyler's. Skyler delegated Q2 and Yoshi decided it; the reasoning in 12.8 is Yoshi's, and my notes on it (12.8.1) are marked as mine. Q3 and Q5 produced the pick-rule design in 12.9. Its two follow-up questions, Q10 and Q11, were answered the same day (12.11). Luigi's frontend review is Section 13; his asks of me are answered in 12.8.1 (O4) and 12.9.

### 12.1 In brief

- **Hunter persistence needs no change.** One `POST /api/hunters` still carries everything the wizard collects and saves once. Section 10's Q1 "Carry on" rule (only playbook and name block) is already how the server behaves. `UpsertHunterRequest` and `HunterDetailResponse` keep their shapes.
- **Gap 1 decided (Q1): the printed number is the total.** The fix is code only, with no data change, and ships as its own bug fix ahead of the wizard (12.3).
- **Q2, decided by Yoshi under Skyler's delegation: a check-only `POST /api/hunters/evaluate`, called on every step change** (12.8). Its answer drives both the tracker marks and "Still to finish"; nothing is saved. I agree with it (12.8.1). Skyler's Q8 (Section 13) adds debounced re-checks on step 8; that needs no endpoint change (O3).
- **Pick rules (Q3, Q5, Q12): one data-driven mechanism for three rules:** the Initiate's Sect-dependent weapons, The Monstrous's Natural Attacks and The Spell-Slinger's Combat Magic (12.9). Four additive playbook tables, one guarded data migration, `pickRules` on the playbook contract, and no hunter-side schema. After the PDF check, the Initiate starts from 2 old-fashioned + 1 modern, and its traditions adjust each list separately (Q12, superseding Q6 and Q7). So conditions now sit on each count rather than on whole alternatives. Everything still resolves from picked option ids with no priority rules. A playbook save without `pickRules` leaves rules unchanged, which closes Luigi's stale-admin-tab hazard.
- **Q10 and Q11 decided (12.11).** A levelled-up hunter's extra Natural Attacks or Combat Magic pick is refused as over the limit, the same as extra moves (Q10). The Initiate's weapons paragraph stays where it is, as the label of the category that holds its armour, with no data change (Q11).
- **Universal track text stays fixed text in the web app (Q4).**
- **Yoshi's architecture review (Section 14, 2026-09-14): I agree with the four points put to me,** each checked against the code:
  - the 12.9 backend ships in release R6 with F8a–F8c, not before them (S10);
  - kept rules are validated after the stored playbook loads, and a conflict with a kept rule is a 409 (S11);
  - `HunterCompleteness` gets a total order (O2);
  - pick-rule wording is built from data (S12).

  I also adopt his other 12.9 corrections (Y5–Y7, Y12) and his Postgres hunter-delete check (Y4).
- **Existing hunters are test data (stakeholder note at the top, 2026-09-14).** They're wiped before R1, so the existing-hunter audits (B2, S7) and the "refused on its next save" consequences for them are gone. The wipe is written up as a proposed step in B2.
- Everything else is small hardening, recorded as proposed defaults (12.6).

### 12.2 The create contract and flow

| Question | Finding |
|---|---|
| Does one final submit carry everything? | **Yes.** `UpsertHunterRequest` (`HunterContracts.cs:160-175`) has name, pronouns, playbook, rating line, the three tracks, `Background`, move ids, gear ids, looks, extra tracks, bespoke selections, repeatable entries with their own nested selections, and journal entries. Step 3's zeros and omitted extra tracks are fine (`HunterService.CheckTrack`, the extra-track comment in `HunterCompleteness.cs`). **One detail for step 4:** the numeric leaf's start-at-max convention is real (`architecture.md` §6.4, "start at `NumericMax`"). The server doesn't apply it, though, and today's form sends `numericValue: null` unless a number is typed. The wizard must send `NumericMax` itself when the option is picked. |
| Is "Carry on" enforced server-side? | **Already, with nothing to add.** Only two things are required: `Name` (`[Required, MinLength(1)]`, so whitespace-only is refused, then trimmed) and a `PlaybookId` that exists. I walked every refusal in `HunterService.Validate` against a partially built draft. Assuming ceilings are enforced inline and unanswered things are omitted rather than sent blank (as the form does today), none of them fires. Every minimum lives in `HunterCompleteness` and is reported, never refused (`architecture.md` §9). |
| Which refusals can the wizard actually hit? | Three: (a) a ceiling the UI failed to enforce (a bug); (b) **a stale playbook**, edited or deleted in another tab during a long wizard session, so ids no longer belong ("Move {guid} does not belong to playbook…", "Playbook {guid} does not exist."); (c) oversized text (next row). No wizard step can fix (b); the fix is to reload the playbook. |
| Can a refusal send the user back to the right step? | **Not reliably.** A refusal is one string, first violation only, with no field or step key, and several embed raw GUIDs. Model-binding 400s (blank name, malformed id) come back as ProblemDetails `{ title, errors }` with **no `message`**, so today's handler shows the generic "Unable to create hunter." The handler is also a toast (`hunter-create.ts:67-70`), not an error band. *(Two toasts, not one: see 13.2 and 13.10.)* Section 7.6's plan is still right for v1: show the message in the last step's error band and keep the draft. With ceilings inline, the reachable refusals are the stale-data kind that no step link would fix. Proposed default B5. |
| Text lengths | `hunters.name` and `hunters.pronouns` are `varchar(255)` (`MotwDbContext.cs:778-779`), and so is a repeatable entry's `name` (`hunter_bespoke_section_instances`). The request puts no `[MaxLength]` on any of them. The form caps name and pronouns (`maxlength="255"`) but not the entry name. Anything longer is a Postgres 22001, which surfaces as a **500**. The SQLite test harness does not enforce lengths, so no test catches this. Proposed default B4. |
| Landing on `/hunters` | `POST` returns 201 with the full `HunterDetailResponse`, including `Outstanding`. The list row deliberately carries no completeness (`architecture.md` §9, "Deliberate boundaries"). The success toast can use `outstanding.length` for free ("created, 4 things still to finish"). Proposed default B7. |
| Double submit | `POST` is not idempotent; the disabled "Creating…" button is the only guard. That is enough with a single final submit, since the Mystery wizard's duplicate-creation bug came from per-phase submits. Proposed default B8. |
| Session expiry | The cookie is 24h sliding (`Program.cs:64-65`). *Updated for 12.8:* the check-only endpoint is called on every step change and renews the cookie, so a session now lapses mid-flow only if the user sits idle on one step for about a day. When it does, the next call gets a 401. `authErrorInterceptor` then navigates to `/login`, and the new `canDeactivate` guard (7.5) will intercept that navigation. **For Luigi:** decide which wins *(decided in 13.8)*. No backend change. Unlikely, but when it happens the draft is lost. |

### 12.3 `MoveGrantCount` (Gap 1): confirmed, fix in code (decided 2026-09-13, Q1)

**The seed is consistently "total, required moves included" on every playbook that has required moves.** The 14 names in Gap 1 match the seed exactly. For each one, `MoveGrantCount` = required count + the sheet's pool picks:

| Playbook | `MoveGrantCount` | Required | Pool picks | Evidence |
|---|---|---|---|---|
| The Celebrity | 3 | 1 | 2 | `architecture.md` §2: "1 required + pick 2 of 7 = 3 total" |
| The Changeling | 3 | 1 | 2 | catalogue: Glamour required "plus a pick-2-of-7 pool" |
| The Chosen | 3 | 2 | 1 | `architecture.md` §2: "the remaining N−2 are chosen"; "2 pre-granted + pick 1 of 5 = 3 total" |
| The Curse-Eater | 4 | 2 | 2 | "…and four Curse-eater moves. You get these two: … Then pick two of these" |
| The Forged | 2 | 1 | 1 | "…plus two Forged moves. You get this one: … Then pick one of these" |
| The Gumshoe | 3 | 2 | 1 | "You get three Gumshoe moves. You get these two: … Then pick one of these" |
| The Hex | 3 | 1 | 2 | "You have three Hex moves. You have this one: … Plus pick two of these" |
| The Host | 3 | 1 | 2 | "…plus three Host moves. You get this one: … Then pick two of these" |
| The Initiate | 4 | 1 | 3 | "…plus four Initiate moves. You get this one: … Then pick three of these" |
| The Pararomantic | 3 | 1 | 2 | "…plus three Pararomantic moves. You get this one: … Then pick two of these" |
| The Professional | 4 | 1 | 3 | "…plus four Professional moves. Pick three of these: … And you get this one" |
| The Searcher | 3 | 1 | 2 | "…plus three Searcher moves. You get this one: … Then pick two of these" |
| The Spell-Slinger | 4 | 1 | 3 | "…and four Spell-slinger moves. You have this one: … Plus pick three of these" |
| The Wronged | 3 | 1 | 2 | "…plus three Wronged moves. You get this one: … Then pick two of these" |

Quotes come from `bespoke-ruleset-catalogue.md`, which took them from the PDF during authoring. For the other 14 playbooks, with no required moves, both readings give the same number, so they are unaffected. **Confirmed against the PDF (2026-09-13, `pdftotext`).** The three grant sentences the catalogue recorded only as structure print as:
- p3: "You get all the basic moves, plus three Celebrity moves. You get this one: … Then pick two of these";
- p5: "You get all the basic moves, plus three Changeling moves. You get this one: … Then pick two of these";
- p7: "You get all of the basic moves, plus three Chosen moves. You get these two … Then pick one of these".

I then checked every playbook's grant sentence (odd pages p1–p57) against the seed. All 28 print `MoveGrantCount` as the total. Each of the 14 with required moves prints exactly the seed's required count ("You get this one", "You get these two", "You have this one"; The Professional prints its pool first, then "And you get this one"). The Q1 code-only fix stands.

**The authoring toolchain also assumes "total".** `verify.mjs:192-193` asserts `required <= moveGrantCount`, a check that means nothing under the "beyond" reading. `SKILL.md:111-112` says to read the value "off the grant sentence". `custom-moves-ideation.md` §2.0 says all 28 "fit `MoveGrantCount` + `Required` exactly".

**Where "beyond" came from.** The `PlaybookMove.Required` doc comment (`PlaybookEntities.cs:114`) says a required move "does not count against `MoveGrantCount`". `architecture.md` §2 meant "doesn't use up a pick"; Phase 10 implemented it as "left out of the count". Four places now carry that reading: `HunterService.cs:177-194`, `HunterCompleteness.cs:48-63`, `hunter-form.ts:123-140` and `architecture.md` §8 item 3. **The tests encode the same reading, which is why the suite is green on the bug.** `HunterServiceTests` uses a fixture of `MoveGrantCount = 1` plus one required move and expects one extra pick to be allowed (`:113-127`, fixture `:832-836`). Its completeness test raises the count to 2 and expects "Moves: 1 of 2 picked." (`:346-350`). `hunter-form.spec.ts` uses `moveGrantCount: 2` plus one required move and expects two picks to count as not short (`:32-39`, `:407-424`). `PlaybookSeedTests` only round-trips the value.

**Fix options**

- **A. Code (recommended; chosen 2026-09-13, Q1).** Define the pick budget as `max(0, MoveGrantCount − number of Required moves)` (Required and IsAdvanced are mutually exclusive). Changes:
  - `HunterService.Validate`: check the ceiling against the budget, and name it in the message, e.g. "The Chosen allows 1 move pick besides its 2 granted moves, but 2 were made."
  - `HunterCompleteness`: report only when the budget is above 0.
  - `hunter-form.ts`/`.html:70-77`: counter and limit against the budget. This must go in **the same change** or the form and server disagree.
  - Comments: fix the `HunterService` comment, the `PlaybookMove.Required` doc comment and `architecture.md` §8 item 3.
  - Add a `PlaybookService` graph check: Required count ≤ `MoveGrantCount` when the count is above 0. The verifier checks this, but the admin UI path doesn't, so an admin-authored playbook could produce a negative budget.

  The "plus 3 Chosen moves" heading on step 5 keeps using `MoveGrantCount` directly, since that number *is* the total. **No migration, no seed change, no contract change.**
- **B. Seed.** Rewrite 14 values to mean "picks beyond required". `PlaybookSeed` only inserts into an empty table (the `AnyAsync` guard), so every existing database would also need either a per-playbook admin `PUT` or a data migration keyed on stable ids. It would also invert the verifier, the authoring skill and every catalogue entry, and leave the admin field no longer matching the number printed on the sheet. Rejected.
- **C. Schema.** Rename or split the column (e.g. `MovePickCount`). This touches a migration plus the playbook contract, admin form, seed key and exporter, and buys only naming clarity, which fixing the doc comment gives for free. Rejected.

**Test changes for A.**
- `HunterServiceTests`: fixture count 1 → 2, so the refusal test keeps its intent. The completeness test raises to 3 and still expects "Moves: 1 of 2 picked."
- **New:** a seed-driven theory over the 14 playbooks. A hunter with exactly (grant − required) picks has no "Moves:" line, and one more pick is refused. This is what stops the bug coming back.
- `PlaybookServiceTests`: required > grant is refused.
- `hunter-form.spec.ts`: fixture 2 → 3, plus a limit-reached case.

**Existing data.** *Superseded 2026-09-14 by the stakeholder note at the top:* existing hunters are test data and are wiped before R1. So no hunter can be over its move budget when B1 deploys, and there's nothing to audit. The wipe is B2. *(This paragraph previously proposed an over-budget audit query to run before deploying B1.)*

### 12.4 Section 8 gaps and Section 11 handoff items

| Item | Verdict | Backend note |
|---|---|---|
| Gap 1 | **Agree; decided 2026-09-13 (Q1)** | Audit done. Code fix, no data change, ships ahead of the wizard. See 12.3. |
| Gap 2: universal track text as UI constants | **Decided 2026-09-13 (Q4): fixed text in the web app; Luck wording settled 2026-09-14 (12.13)** | No backend work. The sentences aren't all uniform in print: Harm and Experience are identical on all 28 sheets, but Luck has a long wording (22 sheets) and a short one (6). One agreed Luck sentence is used everywhere (12.13). My note, not part of the decision: on 2026-08-25 the eight basic moves went into a database table rather than frontend constants, because that content is expected to be tweaked over time (`architecture.md` §2). The same reasoning could apply to these sentences, so they could move into the database once basic moves are exposed. |
| Gap 3: basic moves unreachable | **Agree, and it goes further** | They aren't just unexposed: the table is **empty**. `BasicMove` has no seed rows and no `HasData`, and `BasicMoveResponse` is referenced nowhere. Exposing them means authoring 8 rows from the PDF (readable with `pdftotext` since 2026-09-13; not extracted here), a seed path (`PlaybookSeed` covers playbooks only) and a `GET` endpoint. Not wizard scope. |
| Gap 4: `LevelingUpText` truncated | **Agree, but the fix is bigger than "optional seed fix"** | All 28 stop at the "pick an improvement" sentence. The missing sentence has to come from the PDF (readable with `pdftotext` since 2026-09-13; not extracted here). Editing the JSON reaches no existing database (the `AnyAsync` guard), so the correction needs 28 admin `PUT`s or a data migration by stable id, then a re-export. Not wizard scope. |
| Gap 5 | Agree | Frontend only. `architecture.md` §6.3 confirms these fields are plain text. |
| Gap 6: granted gear | **Agree with the UI change** | All 13 null-`PickCount` categories are non-optional and read as outright grants. Unlike Required moves, which `ApplyPicks` adds server-side, granted gear is never auto-stored. Proposed default B6. |
| Gap 7 | Agree | — |
| Gap 8: the Initiate's Sect-dependent gear | **Disagree with "No handling"; decided 2026-09-13 (Q3): model the rule, design in 12.9** | Section 7.4 says nothing downstream becomes invalid. That's true for refusals and false for completeness. "Old-fashioned weapons" (`PickCount` 3) and "Modern weapons" (`PickCount` 2) are both non-optional. *Corrected 2026-09-13 after the PDF check (Q12):* the legal combinations are 2 + 1, 3 + 1, 2 + 2 or 3 + 2, depending on the Sect. Today `HunterCompleteness` reports every one of them unfinished except 3 + 2, and it reports 3 + 2 finished for any Sect, including Sects where it's illegal. So Section 7.3's Gear test misreports almost every Initiate. The bug is live today. Q3, Q12. |
| Gap 9 | n/a | — |
| History notes need no new field | **Agree** | `hunters.background` is unbounded text, carried on both request and response and normalised to trimmed-or-null. No schema, contract or migration change. **One refinement:** two comments still call the field a placeholder for bespoke answers: the `Hunter.Background` doc comment (`HunterEntities.cs:92-98`) and the template comment above the textarea in `hunter-form.html`. Both contradict the file header and `phases.md` Follow-on 10b ("History and nothing else"). Fix them alongside Luigi's retitle. Hunters saved before 10b may have non-History prose in the column, but that's data, not schema. Proposed default B9. |
| §11: no new endpoint or contract change needed | **Agree for persistence; superseded otherwise (2026-09-13)** | Q2, decided by Yoshi, adds `POST /api/hunters/evaluate` (12.8). Q3 adds four playbook tables, a data migration and `PickRules` on the playbook contract (12.9). `UpsertHunterRequest` and `HunterDetailResponse` keep their shapes. Separately, B4 adds `[MaxLength]`. That is additive, and only refuses what the database already fails on with a 500. |
| §11: Gap 1 before the Moves step ships | **Agree, and sooner** | It's a live bug, so ship it now as a standalone fix. |
| Data claims checked against the seed | **All correct** | 36 playbook-level sections across 24 playbooks. 13 move-internal sections. 7 fixed grants. No playbook-level sections for the Celebrity, Flake, Mundane or Searcher. 28 distinct `LuckSpecialText`. The Pararomantic's `Description` is null. The Hex is the only playbook with advanced moves. |

**Withdrawn design:** nothing in Sections 0–11 references or reintroduces the withdrawn 2026-09-12 hunter advancement / hunter sheet decisions.

### 12.5 What the doc misses

1. **Where step status and "Still to finish" come from: decided by Yoshi under Skyler's delegation (Q2), see 12.8.** What follows was the input to that call. The endpoint sketch in its second paragraph is superseded by 12.8, which differs in the ways 12.8 lists. Section 7.3's per-step "finished" tests, plus a pre-submit summary phrased like `HunterCompleteness`, amount to re-implementing that evaluator in TypeScript. That includes `BespokeEngagement`'s engaged-category counting and per-entry shortfalls, which the form doesn't compute today: `sectionProgress` counts only a section's top level. The 2026-08-31 completeness work kept the aggregate list server-only on purpose (`hunter-form.ts:35-36`: the list "comes back from the server on `HunterDetailResponse.outstanding`, so the rule lives in exactly one place"). There's a second problem too: `Outstanding` is `string[]` with no step key, so "each line links to its step" would mean parsing prose.

   A backend option that keeps the rules in one place is a check-only `POST /api/hunters/evaluate`. It takes an `UpsertHunterRequest` and runs the same `GetPlaybookForValidationAsync` and `Validate`. It then builds the hunter in memory with `ApplyScalars`/`ApplyPicks`, skipping `AddHunterAsync`/`SaveChangesAsync`, and returns `{ refusal, outstanding: [{ area, sectionId?, message }] }`, where `area` is Ratings, Moves, Gear, Look or Bespoke. A bespoke line maps to Moves when its section has a `PlaybookMoveId`, otherwise to its Rules sub-step. The same structured items could go onto `HunterDetailResponse` additively, keeping the `Outstanding` strings. Nothing is saved, so this stays within "hunter creation does not need to be saved at each step". It needs a SQLite test proving no rows are written. Q2.
2. **The Initiate's gear is misreported** (Gap 8 above, corrected after the PDF check). Decided (Q3, then Q12): model the rule. Design in 12.9.
3. **No API-side guard on Required ≤ `MoveGrantCount`** (12.3, B3).
4. **Oversized text returns a 500** (12.2, B4).
5. **Session expiry versus the discard guard** (12.2, for Luigi). Much less likely under 12.8, since every step change renews the cookie.
6. **The wizard must send the numeric leaf's starting value itself** (12.2).
7. **The Monstrous's Natural Attacks and The Spell-Slinger's Combat Magic misreport completeness** (found while designing 12.9). Decided (Q5): covered by the pick rules in 12.9.

### 12.6 Proposed defaults (backend): decided here, not questions

- **B1.** Fix `MoveGrantCount` in code (12.3 option A) as a standalone bug fix ahead of the wizard, with the form's counter in the same change. *Decided 2026-09-13 (Q1).*
- **B2. Wipe existing hunters before R1** (stakeholder note at the top, 2026-09-14; replaces the earlier pre-B1 audit). **Proposed step only; nothing has been run.** On each database that holds hunters, in one transaction:
  ```sql
  BEGIN;
  -- Selections first, so the wipe doesn't depend on how Postgres orders the two-route cascade
  -- across the NoAction section_instance_id FK (the case behind Yoshi's Y4).
  DELETE FROM hunter_bespoke_selections;
  -- Cascades to hunter_moves, hunter_gear_selections, hunter_look_selections,
  -- hunter_extra_track_values, hunter_bespoke_section_instances and hunter_journal_entries
  -- (whose field values cascade from their entry).
  DELETE FROM hunters;
  SELECT COUNT(*) FROM hunters;  -- expect 0
  COMMIT;
  ```
  - **Playbook data is untouched.** Every FK from a hunter table into the playbook tables is `Restrict` and points from the hunter row to the template row, so deleting hunters can't remove template rows. Nothing the pick-rule migration or seed relies on is affected.
  - Once hunters are gone, the playbook-delete guard (409 while hunters exist) no longer blocks deleting a playbook. That's worth knowing; it isn't a step.
  - **Hunters created after the wipe,** between R1 and R6, are the team's own test data, and no audit is planned for them. One that doesn't fit a new limit is refused on save and shows Luigi's L30 notice on the edit page. A second wipe before R6 is optional.
- **B3.** `PlaybookService` refuses a playbook whose Required move count exceeds a non-zero `MoveGrantCount`.
- **B4.** Add `[param: MaxLength(255)]` to `UpsertHunterRequest.Name`, `.Pronouns` and `HunterBespokeInstanceModel.Name`, matching the 2026-08-06 required-field convention. The wizard's inputs keep `maxlength="255"`, and the entry-name input gains it.
- **B5.** No error-code contract in v1. The last step's error band shows `message`, falling back to fixed copy when the 400 is a ProblemDetails body with no `message`.
- **B6.** Granted gear (null `PickCount`) is derived from the playbook, never stored. The wizard sends no ids for those categories, and the server is unchanged; ids the current form already saved stay valid and harmless. Any future sheet view must merge in granted categories.
- **B7.** No completeness on the list endpoint. The create toast may use the `POST` response's `outstanding.length`.
- **B8.** No idempotency key on `POST /api/hunters`.
- **B9.** No rename of `Background` to History, since that would be a migration and contract change for a label. Fix the two stale comments.
- **B10.** Basic moves (Gap 3) and the `LevelingUpText` correction (Gap 4) stay out of wizard scope. Both need content taken from the PDF (now readable with `pdftotext`) and a data path to existing databases.

### 12.7 Decisions (formerly Open Questions for Skyler)

**Q1–Q4 answered 2026-09-13. Q5–Q7 (asked in 12.10), Q10–Q11 (asked in 12.11) and Q12 (put to Skyler by the coordinator after the PDF check, 12.12) were answered the same day and added to the table. Q12 supersedes Q6 and Q7.** Skyler selected an option on each and added no comments, except Q11, where Skyler wrote a comment instead of selecting an option. The questions and options are kept below, and in 12.10, as they were shown, ranked by how much the answer changed the work. Any reasoning under them is mine.

| Question | Answer, as shown | Where applied |
|---|---|---|
| Q1: move count | **"Total, picks 1"** (A). The printed number includes the granted moves; code only, no data change; ships as its own bug fix ahead of the wizard. | 12.3, 12.4, 12.6 B1 |
| Q2: unfinished list | **"Let Yoshi decide."** Delegated to Yoshi, as with the 2026-08-31 completeness call. **Decided by Yoshi 2026-09-13: option C, with the check called when moving between steps.** | 12.8 |
| Q3: Initiate weapons | **"Model the Sect rule"** (C): new schema, migration and UI for Sect-dependent weapons, for one playbook. Not the option I recommended (B). | 12.9; new questions Q5–Q7 in 12.10 |
| Q4: rule text | **"Fixed text in web app"** (A), as Rosalina proposes. My own suggestion, not part of the decision: move it into the database later, when basic moves are exposed. The Luck sentence's wording was settled separately on 2026-09-14 (below). | 12.4 Gap 2, 12.13 |
| Q5: Natural Attacks and Combat Magic | **"Include both now"** (B): same tables with one extra target type. Reopens the catalogue's earlier "leave unenforced" calls. | 12.9, 12.10 |
| Q6: a Sect matching both weapons rules | **"Either; picks decide"** (B): either matching rule is legal, and the player's weapon picks decide which applies. *Superseded 2026-09-13 by Q12.* | 12.10, 12.12 |
| Q7: "may pick two modern weapons" | **"Two modern or usual mix"** (B): two modern weapons, or the usual two old-fashioned plus one modern. *Superseded 2026-09-13 by Q12.* | 12.10, 12.12 |
| Q10: level-up picks | **"Refuse, as designed"** (A): "Same as moves today; no extra work." Level-up picks for Natural Attacks and Combat Magic are refused as over the limit, the same as extra moves. | 12.9, 12.11 |
| Q11: Initiate armour label | **No option selected.** Skyler wrote: "For the Initiate, the Armour is an aspect of their gear and can remain as part of the Gear section description for the Initiate Playbook." Recorded as no change to the label; my reading against the data is in 12.11. | 12.9, 12.11 |
| Q12: Initiate weapons, after the PDF check | **"Traits adjust 2+1"**: "Matches both the paragraph and the list labels. Start from 2 old + 1 modern; Fighting arts/Obsolete gear raises old-fashioned to 3; Modernised/Nifty gadgets lets modern go to 2 ('may'); both groups: 3 old + 1 or 2 modern. Replaces the Q6/Q7 answers." Selected with no comment. | 12.9, 12.12 |
| Luck rule sentence (2026-09-14) | **"Longer wording for all"**: "'…or avoid all harm from an injury.' on every playbook, reading the short version as the same rule cut for space. One constant, as Q4 intended. Rosalina's current default." Selected with no comment. | 12.4 Gap 2, 12.13 |

**Q1. When a playbook says "You get all the basic moves, plus three Chosen moves", do the three include the two moves it grants outright?** In other words, does a new Chosen pick 1 more move, or 3? **RESOLVED 2026-09-13: A, "Total, picks 1".**
- **A. Yes, the printed number is the total, so a Chosen picks 1 (recommended).** This matches every grant sentence recorded during authoring, for all 14 playbooks with granted moves, and the authoring verifier. The fix is a code change (12.3 A) with no data change.
- **B. No, the number is picks on top of the granted moves, so a Chosen picks 3.** The code would then be right and the data wrong on 14 playbooks. That means a seed rewrite, a data fix on every existing database, and changes to the authoring tooling and docs.

**Q2. Where should the wizard get its "what's still unfinished" information?** Today only the server works this out, and only for a saved hunter. **DELEGATED 2026-09-13: "Let Yoshi decide". Decided by Yoshi 2026-09-13: C, called when moving between steps; see 12.8.**
- **A. The browser works it out itself.** No backend work, but there would be two copies of the completeness rules (about 150 lines, including nested-category counting) to keep in step. It also reverses the 2026-08-31 choice to keep that list in one place.
- **B. A new check-only endpoint (recommended).** The wizard sends its unsaved draft and the server replies with what's unfinished, grouped by step, plus whether anything would be refused. Nothing is saved. It feeds the last step's "Still to finish" card. The tracker's per-step dots keep using the per-section counters the form already has. Cost: one small endpoint and structured lines.
- **C. The same endpoint as B, called on every step change**, so the tracker dots come from the server too. The most consistent option and the most round trips.

*(If you'd rather not decide this one, it could go to Yoshi, like the 2026-08-31 completeness call.)*

**Q3. The Initiate's weapons can never show as finished.** Its sheet says pick three old-fashioned, or two modern, or two plus one depending on the Sect. The app stores two separate required lists capped at 3 and 2, and no legal choice fills both. So every Initiate is permanently shown as unfinished, today and in the wizard. **RESOLVED 2026-09-13: C, "Model the Sect rule". Design in 12.9.**
- **A. Leave it.** Every Initiate always shows a weapons line in "Still to finish", and its Gear step never goes green.
- **B. Mark both Initiate weapon lists as optional (recommended).** A data-only edit: through the admin screen on existing databases, plus a seed re-export. The caps stay, and the label text still explains the Sect rule. The only loss is the "short on weapons" reminder for this one playbook.
- **C. Model the Sect-dependent weapons rule properly.** A new schema concept tying the weapons allowance to the Sect picks, with a migration, validation and UI. Accurate, but the most work, for one playbook.

**Q4. Where should the standard Luck, Harm and Experience rule sentences live?** They're the same on every playbook and aren't stored anywhere today. **RESOLVED 2026-09-13: A, "Fixed text in web app".**
- **A. Fixed text in the web app, as Section 8 Gap 2 proposes (recommended for now).** No backend work; changing the wording needs a deploy.
- **B. In the database alongside the basic moves, editable like other reference data.** This is consistent with the 2026-08-25 decision to keep basic moves in the database, but it adds a table, seed and endpoint, and the basic-moves table itself is still empty and unexposed. My suggestion: take A now and fold these sentences into B when basic moves are exposed.

*Correction 2026-09-14 to Q4's context:* "the same on every playbook" isn't accurate for Luck. The PDF prints "Mark luck to change a roll to 12 or avoid all harm from an injury." on 22 sheets, and "Mark luck to change a roll to 12 or avoid all harm." on 6 (the Expert, Flake, Initiate, Monstrous, Mundane and Professional). The Harm and Experience sentences are identical on all 28. Q4's answer still stands; the Luck wording was settled separately (12.13).

### 12.8 Q2, decided by Yoshi: the check-only endpoint

**Decided 2026-09-13 by Yoshi (Architect), under Skyler's delegation of Q2.** Yoshi chose option C ("endpoint on every step") with one change: the wizard calls the check when the user moves between steps, not on every edit. The decision, reasoning and shape below are Yoshi's, lightly condensed. Yoshi raised no questions for Skyler. My notes are in 12.8.1.

**Decision.** A check-only endpoint, called when the user moves between steps. Its answer, grouped by sheet area, drives both the tracker's finished/unfinished marks and the "Still to finish" card. The form's counters stay as in-step hints and limits only. The trade-off: one server call per step change, and a tracker mark updates on the move, not on every tick.

**Yoshi's reasoning.**
- **Option B still creates a second copy of the rules.** Section 7.3 counts a step finished only when it has no gaps at all: nested-category minimums, per-entry gaps in repeatable entries, and minimums of sections inside taken moves. `sectionProgress` counts only a section's top level. Marks built from form counters would either contradict the step 8 card, or `HunterCompleteness` would have to be ported to TypeScript.
- **It fits the 2026-08-31 decision.** That decision kept the overall "what's left" answer on the server and allowed form counters only as local progress. A step's finished mark is an overall answer. Checking an unsaved draft applies the same compute-don't-store rule before the save.
- **The Sect rule tips it further.** In the browser, that cross-section rule would live in three places; with the server check it lives in one server helper.
- **Refusals and unfinished items stay separate.** A refusal means the draft states something false, so it returns no unfinished list.
- **Cost is small:** one playbook read per step change, no hunter read or write. Each call also renews the 24h sliding login cookie.
- **Nothing is saved,** so there is still one save, at the end.
- **Testable:** a server parity test shows the check and Create return identical messages; on the frontend, mapping the answer to step marks is a pure function tested from sample responses.

**Shape: `POST /api/hunters/evaluate`**
- **Body:** the same `UpsertHunterRequest` Create takes, built by the shared draft class. The app-wide sign-in requirement covers it.
- **Status codes:** 200 whenever the request is well-formed; 400 only when it's malformed (blank name, bad id).
- **Contract:**
  ```
  HunterEvaluationResponse(string? Refusal, IReadOnlyList<HunterOutstandingItem> Outstanding)
  HunterOutstandingItem(string Area, Guid? SectionId, Guid? GearCategoryId, string Message)
  ```
- **`Area`** is one of `ratings`, `rules`, `moves`, `gear`, `look`, sent as strings. `Program.cs` has no string-enum converter, so a C# enum would serialize as numbers.
- **The server assigns the area.** A bespoke section without a `PlaybookMoveId` is `rules`; one with a `PlaybookMoveId` is `moves`. The server knows sheet areas, not wizard step numbers.
- **Ids on items:** repeatable-entry lines carry their section's id; gear lines carry their category id. `GearCategoryId` may be null for a Sect-rule line covering both Initiate weapon lists. *(After Q12 the Initiate's lines are per list and carry their category id; see 12.9.)*
- **Refusals:** when `Refusal` is set, `Outstanding` is empty. A missing playbook is also a refusal.
- **Implementation:**
  - One shared build step: `Validate`, then a new `Hunter`, then `ApplyScalars` and `ApplyPicks`. Create adds and saves the result; Evaluate passes it to `HunterCompleteness.Evaluate`.
  - The entities self-assign ids (`Guid.NewGuid()`), so unsaved repeatable entries won't merge.
  - `HunterCompleteness` returns structured items. `HunterDetailResponse.Outstanding` stays a list of strings built from their messages; no structured items on the detail response yet.
  - Because the check reuses `HunterCompleteness`, it picks up the Q1 move-count fix automatically.

**Wizard use (Luigi).** *(Frontend design and two refinements: see 13.9 and 13.13.)*
- **When it calls:** the store keeps an `evaluation` signal and calls on Next, Back, tracker jumps, and arriving at step 8; only the latest response counts. It never calls while step 1's gate fails, and that gate also blocks tracker jumps out of step 1. *(Q8 adds a debounced re-check on step 8: see 13.9.)*
- **Tracker marks:** steps not yet reached are unchanged. Playbook is decided by the step 1 gate. Tracks, Improvements, and Rules dots for fixed grants are finished once visited. Ratings, Moves, Gear and Introductions are finished when visited and the evaluation has no item in that area. Other Rules dots are finished when no item carries that `SectionId`.
- **"Still to finish" card:** items grouped in wizard step order, each linking to its step or Rules dot. Four states: loading; refusal (message in the error band, with an offer to reload the playbook); check failed ("Couldn't check what's left", information only); empty. **Create Hunter** is always enabled.
- **Form counters** ("n of N picked", disabling options at their limit, showing a move's sections once taken) stay as they are. They're local to a section and never set a step's mark. A "2 of 2" counter beside an unfinished step is expected.
- **7.3's "Finished when" table** becomes a description of what the server's items mean; those checks are not built in TypeScript.
- **The Initiate's weapon limits:** Luigi copies the allowance from the new playbook data as a simple lookup, used only to disable options (the same standing `lockedScopes` has today). If the two disagree, a refusal appears at the next step change.
- Luigi still has to decide whether the discard guard or the login redirect wins when the session expires. *(Decided in 13.8.)*

**Backend, as Yoshi set it.**
- Replaces Section 11's "no new endpoint" and my 12.7 option B. Differences from my sketch in 12.5 item 1: the server classifies move sections, so areas are ratings/rules/moves/gear/look; a refusal returns no unfinished list; areas are strings; `HunterDetailResponse` gets no structured items; Create and Evaluate share one build step.
- **Sect rule:** the effective weapon allowance lives in one helper that both `Validate` (the ceiling) and `HunterCompleteness` (the minimum) use, like `BespokeEngagement`. It is exposed on `PlaybookDetailResponse` as data the client can resolve from picked option ids, with no priority rules to work out. Its unfinished lines use area `gear`. Folded into 12.9.
- **Tests:** the check writes no rows; the check and Create return the same messages; area and section tagging, including a move's section and a repeatable-entry line; a refusal returns no list; a malformed request gets a 400; the Initiate's three legal weapon combinations (3+0, 0+2, 2+1) each produce no gear item. *(Superseded 2026-09-13 by Q12: the Initiate's legal combinations are now 2 + 1, 3 + 1, 2 + 2 and 3 + 2, depending on the Sect; see 12.9's build table.)*

#### 12.8.1 Bowser's notes on Yoshi's design (mine: open points, not changes to it)

I agree with the decision and the shape, and 12.9 is built to fit it. Two gaps are worth closing before Luigi builds against it:

- **O1. Tracker marks when the latest response is a refusal, or the check failed.** A refusal carries an empty `Outstanding` by design. Read literally, "visited and no item in that area" would then mark every visited step finished at the moment the draft is wrong. I suggest the store keep the last marks from a non-refusal response, or show visited steps as unknown, until a clean response arrives. For Yoshi and Luigi to settle; no backend change. *(Settled in 13.9, L5.)*
- **O2. Message order in the parity test.** `HunterCompleteness` walks a section's repeatable entries in collection order without sorting (`HunterCompleteness.cs:126`). In Evaluate that's request order; after Create's re-read it's whatever order the database returns. With two or more entries under one section, "the check and Create return the same messages" can fail on order alone. Ordering entries by `SortOrder` inside `HunterCompleteness`, as part of the shared-build extraction, closes that one.

  *Extended 2026-09-14 (Yoshi 14.4, agreed; sorting entries alone isn't enough).* There are two more sources of unstable order today, both confirmed in the code and seed:
  - `Shortfalls` yields category lines by iterating the `engaged` `HashSet` (`HunterCompleteness.cs:192`), whose order follows the picked ids.
  - `EvaluateBespoke` orders move-internal sections by `SortOrder` alone (`:118`), and the seed ties them at 0 in The Crooked, The Searcher and The Spell-Slinger.

  So `HunterCompleteness` applies a total order (Y8):
  - playbook-level sections by `SortOrder`, then id;
  - move-internal sections by their move's order (`IsAdvanced`, then `SortOrder`), then section `SortOrder`, then id;
  - category lines by option `SortOrder`, then id;
  - repeatable entries by `SortOrder`, then id.

  Pick-rule items (12.9) take the place of the lines they replace, so they inherit that order. The parity test adds a build with two short categories in one section (Fate), and a Searcher with answers under two move sections. *(Two more ordering sources: see 14.4.)*
- **O3. What Skyler's Q8 ("Re-check on last step", recorded by Luigi in Section 13) means for the endpoint: no contract or endpoint change.** Each check is a pure function of its request body: one `GetPlaybookForValidationAsync` read (the whole playbook graph), an in-memory build, no writes and no server-side state. Debounced step 8 calls therefore add only read load, a handful per visit at this app's scale, and ordering is entirely the client's latest-wins (13.9). No rate limiting is needed. Two implementation points:
  - The `Evaluate` action takes the request `CancellationToken`, like its neighbours, so an aborted check normally stops at the database query rather than running to the end. This refines 13.9's "the server still finishes"; either way nothing is written.
  - The action should log nothing per call beyond the framework defaults, since step 8 can now produce bursts of them.
- **O4. Luigi's contract asks (13.14), answered:**
  - camelCase JSON and the exact lowercase `area` strings: agreed.
  - Refusals stay plain strings: agreed.
  - Pick-rule lines with area `rules` carry the governed section's `SectionId`: adopted (12.9).
  - The `pickRules` JSON shape: pinned in 12.9, and re-pinned there on 2026-09-13 for Q12.
  - The stale-admin-tab hazard: decided in 12.9 (S9). A missing `pickRules` leaves rules unchanged; it is not refused.
  - Shortening the Initiate's armour label went to Skyler as Q11. Decided: not shortened (12.11).

### 12.9 Pick rules: the Initiate's weapons, Natural Attacks and Combat Magic (Q3, Q5, Q12)

**Scope, decided 2026-09-13.** Q3 chose to model the Initiate's Sect-dependent weapons. Q5 extended the same mechanism to The Monstrous's Natural Attacks and The Spell-Slinger's Combat Magic. Q12, answered after the PDF became readable, replaced Q6 and Q7's reading of the Initiate: start from 2 old-fashioned + 1 modern, and let the Sect's traditions adjust each list. That changed the shape of the rule model, since conditions now sit on each count rather than on whole alternatives. The design is mine, built to fit Yoshi's 12.8.

**The three rules, checked against the PDF (2026-09-13, `pdftotext`).** For all three, the seed's wording matches the printed pages.

1. **The Initiate: weapons** (gear on p33; Sect on p34). The page prints three things:
   - the paragraph "If your Sect has fighting arts or obsolete gear (see next page) then pick three old-fashioned weapons. If the Sect has modernised or nifty gadgets, you may pick two modern weapons. Otherwise, pick two old-fashioned weapons and one modern weapon.";
   - "You also get old-fashioned armour (1-armour heavy).";
   - the list headings "Old-fashioned weapons (pick either two or three, as above):" and "Modern weapons (pick either one or two, as above):".

   The seed stores the paragraph plus the armour sentence as the label of the granted armour category (kept, Q11), and the two headings as the weapons categories' labels (`PickCount` 3 and 2). Neither heading allows zero, which is what the earlier Initiate alternatives (3 + 0 and 0 + 2) got wrong. The conditions are Sect options on p34: Fighting arts, Modernised and Nifty gadgets under "Good Traditions (pick two):", and Obsolete gear under "Bad Traditions (pick one):".
2. **The Monstrous: Natural Attacks** (bespoke section, p37): "Pick a Base and add an extra to it, or two Bases." The breed suggestions on p38 fit it (Werewolf: "Base: claws; Base: teeth"; Vampire: "Base: life-drain or Base: teeth; add +1 harm to base attack"). The rule governs Base (`MinSelect` 1, `MaxSelect` 2; four printed bases plus two write-your-own slots) and Extra (0–1; three printed extras plus one write-your-own slot). The section itself is 2/2.
3. **The Spell-Slinger: Combat Magic** (bespoke section, p49): "Combat magic, pick three (with at least one base):", after "Your combat spells can combine any of your base spells with any of your effects." Nothing printed qualifies the count. The rule governs Bases (1–3; Blast, Ball, Missile, Wall) and Effects (0–3; six effects). The section itself is 2/2.

Both bespoke rules were deliberately left unenforced during the catalogue walkthrough: Natural Attacks on 2026-08-28, and Combat Magic in `yoshi-hunter-playbooks-spell-slinger-combat-magic-pick-shape.md`. Q5 reopens those calls. The implementing change should add a note pointing here to those catalogue entries and that decision record.

**Nothing else in the 28 works like this.** I swept the seed (every gear label and option, bespoke description, effect and option text, look option, Getting Started text and move text) and cross-checked the catalogue walkthrough. A separate scan for sections whose minimum needs more engaged categories than are mandatory found only rules 2 and 3. The Initiate is the only pick count that depends on another section (`phases.md` group 3 calls it the first such case). The other "if" hits are play-time effects, or optional categories already modelled with `IsOptional`. The Professional's "either a flak vest or combat armour" is an ordinary pick-1 category.

**Representation.** Hard-coding seed ids in `HunterService` would need no schema, but it isn't what Q3 chose, and it would break silently if a playbook were re-authored. So the rules are stored as data.
- A *rule* is a set of *alternatives*.
- Each alternative has one *count* for each target the rule governs. A target is a gear category (the Initiate) or a top-level bespoke category divider (Q5).
- A count is an allowed range, plus at most one *adjustment*: a different range that applies when any of its *triggers* (bespoke options) is picked.

Four additive tables, all playbook-owned template data:

```
PlaybookPickRule              (Id, PlaybookId, Label [nullable, plain text], SortOrder)
PlaybookPickRuleAlternative   (Id, RuleId, Label [nullable, plain text], SortOrder)
PlaybookPickRuleCount         (Id, AlternativeId, GearCategoryId [nullable], BespokeOptionId [nullable],
                               MinCount, MaxCount, AdjustedMinCount [nullable], AdjustedMaxCount [nullable])
                              -- exactly one target set; Id is storage-only, not on the wire
PlaybookPickRuleCountTrigger  (CountId, BespokeOptionId)   -- composite key; rows only when an adjusted range is set
```

- **Why the shape changed for Q12.** My earlier model put "any of" triggers on whole alternatives and allowed the union of the matched ones. Q12 makes the Initiate's two lists independent: Fighting arts or Obsolete gear sets old-fashioned to 3, and, separately, Modernised or Nifty gadgets lets modern be 1 or 2. A Sect with both groups must allow 3 + 2. A union of a "3 + 1" alternative and a "2 + 1 / 2 + 2" alternative can't express that without enumerating every combination of trigger groups, while a per-count adjustment states it directly. No rule uses alternative-level triggers any more, so they're gone. Natural Attacks and Combat Magic need no conditions and keep their enumerated alternatives.
- **What a count counts:** for a gear category, the picked options in it; for a bespoke category, its picked direct children (`BespokeEngagement.CountUnder`), so write-your-own slots count like any other option.
- **Check constraints.** These are plain SQL that both Postgres and SQLite accept, so the test suite's `EnsureCreatedAsync` still works:
  - `("gear_category_id" IS NULL) <> ("bespoke_option_id" IS NULL)`;
  - `"min_count" <= "max_count"`;
  - `("adjusted_min_count" IS NULL) = ("adjusted_max_count" IS NULL)`.

  Two plain unique indexes, `(alternative_id, gear_category_id)` and `(alternative_id, bespoke_option_id)`, stop a target appearing twice in one alternative. Both providers treat NULLs as distinct, so neither needs a filter (Yoshi's Y5, agreed 2026-09-14; this replaces my earlier service-only check). `PlaybookService` still reports duplicates first, with a readable message. It also enforces the adjusted range's order, and that triggers exist exactly when an adjusted range does.
- **Labels** hold printed plain text. A rule's label holds its section's instruction where it has one. The Initiate's rule needs no labels at all, because its two lists already carry their printed headings.
- **Targets keep their own stored caps:** the Initiate's `PickCount` 3 and 2, Base ≤ 2, Extra ≤ 1, Bases ≤ 3, Effects ≤ 3. Every range and adjusted range is validated to fit under them, so today's cap checks stay true and harmless (S8). The Initiate's caps are exactly its largest adjusted ranges.
- **Foreign keys:** all Cascade, as every other playbook child does, so deleting a playbook can't trip on cascade order:
  - rule → playbook, alternative → rule, count → alternative, trigger → count;
  - trigger → `bespoke_options`, count → gear category, count → `bespoke_options`.

  `PlaybookService` validation, not `Restrict`, stops an edit from silently losing a rule. *(Where that validation has to run, and the test that backs it: see 14.3.1–14.3.2.)*
- **Hunter side: no new table or column.** The gear picks and bespoke selections a hunter already stores are the entire input.

**The data**, as the migration and seed carry it.

*The Initiate* (one rule, one alternative, no labels; Q12):

| Target | Range | Adjustment triggers (any of) | Adjusted range |
|---|---|---|---|
| Old-fashioned weapons | 2–2 | Fighting arts, Obsolete gear | 3–3 |
| Modern weapons | 1–1 | Modernised, Nifty gadgets | 1–2 |

*Natural Attacks* (rule label "Pick a Base and add an extra to it, or two Bases."; exact ranges, no adjustments):

| Alternative | Base | Extra |
|---|---|---|
| 1 | 1 | 1 |
| 2 | 2 | 0 |

*Combat Magic* (rule label "Pick three (with at least one base).", adapted from the printed "Combat magic, pick three (with at least one base):"; exact ranges, no adjustments):

| Alternative | Bases | Effects |
|---|---|---|
| 1 | 3 | 0 |
| 2 | 2 | 1 |
| 3 | 1 | 2 |

Alternative labels are null for all three rules.

**Evaluation: one shared static helper (`PickRules`, next to `BespokeEngagement`),** used by `Validate` for ceilings and `HunterCompleteness` for minimums, as 12.8 requires. For each rule:
1. **Effective range of each count:** its adjusted range if any of its triggers is among the hunter's section-level picked option ids; otherwise its own range. Triggers are leaf options (S2), so this is plain set membership, and a count has at most one adjustment, so there is nothing to order. **So Q12 resolves from picked option ids with no priority rules,** as 12.8 asks: each list is adjusted by its own traditions, independently.
   - A Sect with Fighting arts and Modernised gives old-fashioned 3–3 and modern 1–2.
   - With no "Sect undecided" state (S1), an unanswered Sect gives 2–2 and 1–1, so a third old-fashioned weapon stays disabled until Fighting arts or Obsolete gear is picked. The wizard puts Rules before Gear, so that's the normal order anyway.
2. **Allowed alternatives:** all of a rule's alternatives, always. The Initiate has one, Natural Attacks two, Combat Magic three.
3. **Refuse** (`Validate`) when the picks fit under **no** alternative, meaning that for every target, picks ≤ the effective maximum. Partial picks that fit some alternative pass, so §9's "fixable by removing" property holds. Gear rules run after `ValidateBespoke`, since triggers must first be known to be this playbook's options. Bespoke rules run in the section-level selection scope, after that section's existing checks. Messages:
   - **A one-alternative rule (the Initiate):** the existing gear ceiling message, with the effective maximum, e.g. `"Old-fashioned weapons (pick either two or three, as above)" allows 2 picks, but 3 were made.` When an adjustment that hasn't fired would allow more, it adds a suffix built from data: the trigger options' titles joined with "or", their section's title in brackets, and the adjusted maximum, e.g. `Fighting arts or Obsolete gear (Sect) allow 3.` No playbook or section name is hard-coded (Yoshi's Y9, agreed 2026-09-14; S12).
   - **Several alternatives:** e.g. `"Natural Attacks" allows: Pick a Base and add an extra to it, or two Bases. 2 Base and 1 Extra were picked.`

   In the wizard these surface as 12.8's refusal state.
4. **Report** (`HunterCompleteness`): a governed target drops its own minimum line, and a bespoke rule also drops its section's own `MinSelect` line (S8). If no alternative is then met (every target within its effective range):
   - **One alternative (the Initiate):** one item per list that is below its effective minimum, in the existing gear format with that minimum, e.g. `Gear — Modern weapons (pick either one or two, as above): 0 of 1 picked.` It has `Area = "gear"`, `GearCategoryId` = that list's category, and `SectionId = null`. If the list has an adjustment that hasn't fired and its trigger section has no section-level picks, the message adds `This depends on your {section title} picks.`, e.g. `This depends on your Sect picks.` (S12). *(Condition aligned with L25 on 2026-09-14, per Yoshi's Y16: it replaces "the trigger's section still has shortfalls", which the client can't evaluate without re-implementing completeness.)*
   - **Several alternatives (Natural Attacks, Combat Magic):** one item, with `Area = "rules"`, `SectionId` = the governed section (Luigi's 13.14 ask), and message `{section title}: {rule label}`.

**The 2/2 section minimums and maximums stored today stay unchanged (S8).** The section `MinSelect` of 2 is what misreports legal builds, and under a rule it is simply not consulted. The section `MaxSelect` of 2 and the category caps stay as ceilings, and every alternative fits under them. Editing the stored numbers instead (e.g. a section minimum of 1) would add data updates to the migration without fixing anything: any per-category number is still wrong for some legal build, which is why the rule exists.

**Builds and outcomes.** These are also the test tables. "Today" is current behaviour. Per Q10, the refusals apply on every save, including when a levelled-up hunter records an extra Natural Attacks or Combat Magic pick, just as extra moves are refused today.

*Natural Attacks* (Base + Extra):

| Build | Save | Still to finish | Today |
|---|---|---|---|
| 1 + 1 | accepted | finished | finished |
| 2 + 0 (either Base may be write-your-own) | accepted | finished | "1 of 2 picked" forever |
| 1 + 0, 0 + 1, 0 + 0 | accepted | reported | reported |
| 2 + 1 | **refused** | — | accepted, reported finished |
| 3 + 0, 0 + 2 | refused by the existing category caps | — | same |

*Combat Magic* (Bases + Effects):

| Build | Save | Still to finish | Today |
|---|---|---|---|
| 3 + 0 | accepted | finished | "1 of 2 picked" forever |
| 2 + 1, 1 + 2 | accepted | finished | finished |
| 1 + 1 | accepted | reported | **reported finished** (only two spells) |
| 2 + 0, 1 + 0, 0 + 2, 0 + 1 | accepted | reported | reported |
| 0 + 3, 3 + 1, 2 + 2, 1 + 3, 3 + 3 | **refused** | — | accepted |

*The Initiate* (old-fashioned + modern), by which trigger traditions the Sect has (Q12):

| Sect has | Effective ranges (old; modern) | Finished | Accepted and reported (examples) | Refused (examples) |
|---|---|---|---|---|
| none of the four (including a Sect not yet answered) | 2; 1 | 2 + 1 | 1 + 1, 2 + 0 | 3 + 1, 2 + 2 |
| Fighting arts or Obsolete gear, but not Modernised or Nifty gadgets | 3; 1 | 3 + 1 | 2 + 1, 3 + 0 | 3 + 2 |
| Modernised or Nifty gadgets, but not Fighting arts or Obsolete gear | 2; 1–2 | 2 + 1, 2 + 2 | 1 + 2, 2 + 0 | 3 + 1 |
| traditions from both groups | 3; 1–2 | 3 + 1, 3 + 2 | 2 + 2, 3 + 0 | nothing within the category caps |

Today only 3 + 2 is reported finished, whatever the Sect, and anything up to 3 + 2 saves.

**`PlaybookService` and the playbook contract.**
- **JSON shape (camelCase) for Luigi's F8a/F8b (13.14), re-pinned 2026-09-13 for Q12.** `PlaybookDetailResponse.pickRules` and `UpsertPlaybookRequest.pickRules` share it. In a request, `id` is null for a new rule or alternative.
  ```
  pickRules: [{
    id, label, sortOrder,
    alternatives: [{
      id, label, sortOrder,
      counts: [{
        gearCategoryId: guid | null, bespokeOptionId: guid | null,
        minCount, maxCount,
        adjustment: { triggerOptionIds: [guid], minCount, maxCount } | null
      }]
    }]
  }]
  ```
  **What changed from the first pin:** alternatives no longer carry `triggerOptionIds`; counts replace `pickCount` and `isOptional` with `minCount` and `maxCount`, and gain `adjustment`. Rules and alternatives carry ids and go through the existing Id-based diff, so seed re-exports stay stable. Counts and adjustments carry no ids on the wire and are replaced wholesale within their alternative; nothing outside the rule references them. A client finds a bespoke rule's section through its counts' `bespokeOptionId`. `ToDetailResponse` orders counts by their target's `SortOrder`, then target id, and `triggerOptionIds` by option `SortOrder`, then id (Yoshi's Y7, agreed 2026-09-14). The admin summary, the client lookup and the seed file then see one order, and the byte-identical re-export check doesn't depend on database row order.
- **A missing `pickRules` means "leave rules unchanged" (S9, decided here on Luigi's 13.14 ask).** `UpsertPlaybookRequest` gains `IReadOnlyList<UpsertPlaybookPickRuleRequest>? PickRules = null` as its **last** positional parameter:
  - null or absent: stored rules are untouched;
  - `[]`: every rule is removed;
  - a list: Id-based diff.

  This is a deliberate exception to the other child collections, which treat null as empty (`request.Moves ?? []` and so on), and it is documented on the record.
  - **Why not refuse with a 400:** a stale admin tab's user would lose the unsaved edits in that tab for no safety gain, and every existing C# construction site would have to change. With the default, those sites compile unchanged and mean "unchanged", so `HunterServiceTests.ToUpsert` and the other helpers no longer risk deleting rules.
  - `PlaybookDetailResponse` also gains `PickRules` as its last parameter; an older seed file without it deserializes as no rules.
- **Kept rules are validated after the stored playbook loads (S11; Yoshi's Y3, agreed 2026-09-14).** This corrects my earlier text, which said graph validation checks the rules that will exist after the save, whether sent or kept. That can't work where I put it: `ValidateGraph(request)` runs before `GetForUpdateAsync` (`PlaybookService.cs:55-61`), so under S9 it never sees kept rules. Instead:
  - **Sent rules** are checked in `ValidateGraph`. A problem there is a 400.
  - **After the load,** one pass beside `CheckRemovedChildrenAreUnusedAsync` checks the rules that will exist (sent or kept) against the request's children. A conflict with a **kept** rule is a **409** naming the rule, like that method's existing conflicts. It catches:
    - a removed target or trigger;
    - a governed `PickCount` or `MaxSelect` lowered below a rule's range;
    - a trigger that stops being a leaf, or moves into a repeatable or move-internal section;
    - a new top-level option in a governed section, which the rule's dividers then no longer cover.

    Fix that method's summary ("stay freely removable", `:130-133`) while extending it.
  - `GetForUpdateAsync`, `GetPlaybookForValidationAsync` and `BuildFullGraph` all include the rules.

  Rule rows removed in the same save go before options and categories, so foreign keys can't fail mid-save.
- **`ValidateGraph` adds:**
  - triggers and targets belong to this playbook;
  - triggers are leaf options in playbook-level, non-repeatable sections, and never in a section the same rule governs;
  - a rule's targets are either all gear categories, or all top-level category dividers of one playbook-level, non-repeatable section that together cover every top-level option of that section;
  - every alternative has exactly one count for every target of its rule;
  - `0 ≤ minCount ≤ maxCount`, and the same for an adjustment, with every maximum within its target's cap (`PickCount`, or the category's `MaxSelect`) where one is set;
  - an adjustment has at least one trigger, and a count has at most one adjustment;
  - a rule has at least one alternative and one target, and a target or a bespoke section is governed by at most one rule;
  - a gear target has a non-null `PickCount` and isn't `IsOptional` (these last two: Yoshi's Y6, agreed 2026-09-14).

  These run on sent rules in `ValidateGraph`, and on sent-or-kept rules after the load (S11).

  Earlier drafts' alternative-level triggers, and their "unconditional" fallback, are gone (Q12).
- **Constraint:** rules reference existing rows by id, and new children carry no id until saved, so a rule can only be authored against a playbook that's already saved, in a second save. That's fine for migration and seed data, which carry fixed ids.
- `HunterContracts`: no change beyond 12.8. `Outstanding` wording changes for affected hunters only.

**Migration and data delivery.**
- **`AddPickRules`** creates the four tables, their indexes and the check constraint. Additive; `Down` drops them.
- **Existing databases** get all three rules from the same migration. It uses `migrationBuilder.Sql` with guarded `INSERT … SELECT … WHERE EXISTS` statements keyed on the seed's stable ids, with fixed new ids for the rule and alternative rows, shared with the seed. **Each playbook has its own guard.** A playbook's rule is inserted only when every row it references exists and that playbook has no rule yet. A database where one of the three was edited or deleted through the admin screen skips that one rule and still gets the others, rather than failing the deploy. `PlaybookSeed`'s own comment anticipates this kind of id-keyed data migration.
  - **The Initiate:** playbook `a0c2b1dd-75e9-4c62-913a-e652e5f23df2`; categories `4740273a-f878-4719-8c0e-2626cac2566f` (old-fashioned) and `524d08ca-da76-4d4e-8353-2317ab30419a` (modern); triggers `ceecaf7f-c871-422b-afa1-68ce91229274` (Fighting arts), `86965ce9-cbb5-479b-985a-5a7bda562de2` (Obsolete gear), `ad188960-40d2-48f3-8782-3a8caded1ae2` (Modernised) and `9e5b2d72-c55b-45d0-9e91-2f89ce29e798` (Nifty gadgets).
  - **The Monstrous:** playbook `2a1efd73-1c2d-4472-9ace-3c30d9ec9300`; section `ad9481a1-da22-4b26-bae2-0722dbef31bf`; categories `a6f63a15-cd9d-405d-a0a5-c25dab5ff742` (Base) and `acbda577-8524-4905-8f0b-f53d74034cb8` (Extra).
  - **The Spell-Slinger:** playbook `6bd4946f-05aa-4c5b-a8d9-a634f95a1033`; section `2ced7a94-a54b-42ae-bbb6-986dc379ccbd`; categories `37b4d08c-d079-4c71-a4d1-3e84eebad8b1` (Bases) and `22e7c964-efe0-4f2b-af92-986fb1184aed` (Effects).
- **No stored numbers change (S8):** nothing touches either section's 2/2 or any category cap. The Initiate's armour label isn't edited either (Q11), so the migration only inserts pick-rule rows.
- **Fresh databases** get the rules from the seed. `MotwDbInitializer` runs `MigrateAsync` before `PlaybookSeed.ApplyAsync`, so on an empty database the guarded inserts find nothing, and the seed then inserts all 28 playbooks with their rules. The seed file is `PlaybookDetailResponse[]`, so once the contract carries `pickRules`, a re-export from a migrated dev database writes the three rules into `hunter-playbooks.json` with the same fixed ids. Both paths end with identical rows, and a second re-export should come back byte-identical.
- **No automated test runs the guarded SQL.** It is Postgres-only, and the suite builds SQLite schemas with `EnsureCreatedAsync`, never migrations. Verify by hand on Postgres: a database at the previous migration with all three playbooks, one with one of them removed, and a fresh database.
- **Delivery (Yoshi's 14.3.7 and Y12, agreed 2026-09-14):**
  - **One commit** carries the migration, the `ToEntity` mapping, the fixture update and the re-exported seed. A seed without rules would leave a fresh database silently without them.
  - The release notes carry a **post-deploy query** confirming that each of the three playbooks that exists has exactly one rule, so a guard that skipped in production gets noticed.
  - It all ships in release R6 (S10).
- **Existing hunters:** *superseded 2026-09-14 by the stakeholder note at the top.* Hunters are wiped before R1 (B2), so R6 has no pre-existing hunters to audit, and no per-hunter listing queries are kept. Test hunters created after the wipe follow the normal rules: a build that doesn't fit is refused on save and shows L30's notice. *(This bullet previously carried an S7 audit and two listing queries.)*

**Frontend** (Luigi's F8a/F8b; 13.14, 13.16, 13.18).
- `core/models.ts` gains the `pickRules` types in the shape above.
- **Limits (12.8's simple lookup):** from `pickRules` and the picked option ids, compute each count's effective range exactly as in step 1. An option under a governed target is enabled when some alternative's effective maximum still has room for one more pick there, given the picks on the rule's other targets. For the Initiate that is simply "picks below this list's effective maximum". The same lookup feeds `lockedScopes` and the section progress text for Natural Attacks and Combat Magic. It only disables options and shows hints; step marks and card lines come from the server. If the lookup and the server disagree, a refusal appears at the next check.
- **Several alternatives at once now happens only for Natural Attacks and Combat Magic,** which show their rule label rather than a single "n of N". The Initiate always has one alternative, so each weapons list shows an ordinary counter against its effective range under its own printed heading ("n of 3", or "n of 1–2" for a Modernised Sect's modern list), with no rule or alternative labels.
- **Order:** the Sect (Rules, step 4) comes before Gear (step 6), and Natural Attacks and Combat Magic govern only their own sub-step, so the wizard never asks for a governed pick before its rule can be resolved. Under "Carry on" (Section 10 Q1) an unanswered Sect leaves the base ranges (2 + 1) in force until the player goes back.
- **Section 7.4's "No handling" no longer holds for the Initiate** (S5). Natural Attacks and Combat Magic depend on no earlier choice, so nothing can strand their picks.
- **Admin playbook form (F8a):** it lists rules read-only and **omits** `pickRules` from its save request, so S9 leaves the stored rules untouched (S3, settled with Luigi 2026-09-13). Old and new admin bundles therefore behave the same. *Release grouping settled 2026-09-14 (Yoshi's 14.6 and Y2, agreed; replaces my earlier "F8a can ship with the 12.9 deploy or after it"):* the 12.9 backend, F8a, and F8b and F8c on the shared sections all ship together in release R6 (S10). One image carries both halves and migrates at startup (`Dockerfile`; `MotwDbInitializer.cs:14`). If the backend went first, the live create and edit forms would offer picks the server then refuses on save.
- **Authoring skill and `verify.mjs`:** add known-artifact checks for the three rules.

**Tests.**
- **New `PickRulesTests` (pure):**
  - effective ranges for every row of the Initiate table: each trigger on its own, both triggers of one group, both groups, and an unanswered Sect;
  - the "This depends on your Sect picks." suffix appears with an unanswered Sect, and not with a partly answered one (e.g. one non-trigger Good tradition picked), matching L25 (Y16);
  - removing a trigger tradition strands a third old-fashioned weapon or a second modern one (refused), while adding one never refuses;
  - every Natural Attacks and Combat Magic build in the tables above, for both save and report;
  - partial picks accepted;
  - governed targets' own minimums, and the governed sections' `MinSelect`, suppressed;
  - write-your-own Base slots counted.
- **`HunterServiceTests`:** a refused build for each rule, with its message. An update that changes the Sect and strands the weapons is refused. An untouched Monstrous with two Bases re-reads as finished.
- **Through the 12.8 check, from the real seed:** every "finished" build in the three tables produces no item for its area (`gear` for the Initiate; `rules` with the section's id for the other two), and every "reported" build produces exactly one. This is the regression proof. For the Initiate it replaces Yoshi's three combinations (12.8) with the finished builds in the four Sect rows.
- **`PlaybookServiceTests`:**
  - each new graph check;
  - the Id-diff round trip keeps rules;
  - a request without `pickRules` keeps them, and `[]` removes them;
  - for each of the three playbooks, a save with `pickRules` omitted that removes a governed target or a trigger is a **409** naming the rule, and leaves the rule rows unchanged (Y4); a sent rule with a bad reference is a 400;
  - deleting each of the three playbooks cascades cleanly.
- **Fixtures:** the `PlaybookSeedTests` fully-populated fixture gains a rule with both target kinds; the `PlaybookIntegrationTests` export/import includes rules.
- **Frontend:** lookup cases for the Initiate's effective ranges in each Sect row, several alternatives (Natural Attacks, Combat Magic), and "room for one more"; `playbook-form.spec.ts` asserts the emitted save request has no `pickRules` key.
- **Manual, in R6's Postgres pass:**
  - the three migration paths above;
  - a byte-identical re-export;
  - deleting a Hex hunter with a picked Rotes entry (Yoshi's Y4). This is an existing hunter delete that reaches `hunter_bespoke_selections` by two routes across the NoAction `section_instance_id` FK, and the SQLite suite can't show how Postgres orders it.

**Proposed defaults for this design (not questions)**
- **S1.** No "Sect undecided" state: each count's own range applies until one of its triggers is picked (to fit 12.8's no-priority lookup).
- **S2.** Triggers are leaf options in playbook-level, non-repeatable sections, never in a section their own rule governs, and a count has at most one adjustment.
- **S3.** The admin form lists rules read-only and **omits** `pickRules` when it saves, so S9 leaves them unchanged. No rule editor in v1: three rules, fixed data. *Settled 2026-09-13 with Luigi (13.13), replacing my earlier "echoes them on save".* Counts and adjustments carry no ids and are replaced wholesale, so an echo that dropped or mangled one would silently rewrite a rule into data that is still valid, and no refusal would catch it. Omitting can't do that. When a rule editor exists, the form sends `pickRules` again, and that change brings its own round-trip test.
- **S4.** Data arrives by guarded migration plus seed re-export, sharing fixed ids, with one guard per playbook.
- **S5.** Changing the Sect after weapons are picked keeps the picks. The next step change returns a refusal naming the rule, shown in the error band, until the extra weapons are unticked. No auto-clear. Rosalina and Luigi own the treatment. Under Q12 a refusal comes only from *removing* a trigger tradition (stranding a third old-fashioned weapon or a second modern one); adding a tradition only widens a range. *(Frontend treatment: 13.7, L24.)*
- **S6.** Per the printed list headings (Q12), neither list ever goes below its heading's minimum. Old-fashioned is exactly 2, or exactly 3 with Fighting arts or Obsolete gear. Modern is exactly 1, or 1 or 2 with Modernised or Nifty gadgets.
- **S7.** *Superseded 2026-09-14:* no existing-hunter audit. Hunters are wiped before R1 (B2, stakeholder note at the top); later test hunters follow the normal refusal and L30's notice.
- **S8.** Stored section and category numbers stay as they are. A rule overrides the minimums it governs and leaves the caps in force.
- **S9.** A playbook save without `pickRules` leaves rules unchanged; `[]` removes them. Not refused.
- **S10.** The 12.9 backend ships in release R6 with F8a, and with F8b and F8c on the shared sections (Yoshi's Y1–Y2, agreed 2026-09-14). It does not go ahead of them.
- **S11.** Rules that will exist after a save, whether sent or kept, are validated after the stored playbook loads. A conflict with a kept rule is a 409 naming the rule; a problem in sent rules is a 400 (Y3).
- **S12.** Pick-rule messages name no playbook or section in code. Trigger and section titles come from the data (Y9).

### 12.10 Round 2 decisions (formerly Open Questions for Skyler)

**All three answered 2026-09-13.** Skyler selected an option on each and added no comments. The questions and options are kept below as they were shown, ranked by how much the answer changed the work. Any reasoning under them is mine. Q5 is applied in 12.9. Q6 and Q7 were superseded the same day by Q12 (12.12) and no longer apply.

**Q5. Should the same mechanism also fix The Monstrous's Natural Attacks and The Spell-Slinger's Combat Magic?** Both sheets have an either/or pick rule that was deliberately left unenforced during the catalogue walkthrough, before "still to finish" reporting existed. Today a Monstrous with two Bases, and a Spell-Slinger with three Bases, are shown as unfinished forever even though both are legal. A Spell-Slinger with one Base and one Effect (two spells, not three) is shown as finished. Over-limit combinations also save. **RESOLVED 2026-09-13: B, "Include both now".** (Luigi estimates about a day of extra frontend work, 13.18.)
- **A. Initiate only, as chosen.** Those two keep the wrong reports; adding them later means a second migration.
- **B. Include both now (recommended).** Same tables; the count row gains a second kind of target (a bespoke category), and their lines use area `rules` in 12.8's contract. This reopens the earlier "leave unenforced" calls for these two sections.

**Q6. An Initiate's Sect can match both weapons rules,** for example Fighting arts with Modernised (both Good Traditions), or Nifty gadgets with the Bad Tradition Obsolete gear. Which weapons does it get? **RESOLVED 2026-09-13: B, "Either; picks decide". Superseded 2026-09-13 by Q12 (12.12).**
- **A. The first rule printed wins: three old-fashioned weapons.** This adds an ordering rule to the weapons lookup, which Yoshi's design (12.8) asks to keep free of priorities.
- **B. Either matching rule; the player's weapon picks decide (recommended).** No extra stored choice and no ordering.
- **C. Neither: use the "otherwise" mix** (two old-fashioned, one modern).

**Q7. The sheet says a Sect with Modernised or Nifty gadgets "may pick two modern weapons". What does "may" allow?**
- **A. Exactly two modern weapons and no old-fashioned ones.**
- **B. Two modern weapons, or the usual mix of two old-fashioned and one modern (recommended).**
- **C. Up to two modern weapons, and fewer is fine.**

**Q7 RESOLVED 2026-09-13: B, "Two modern or usual mix". Superseded 2026-09-13 by Q12 (12.12).** Each Q7 answer was a data difference within the design as it then stood; that design's Initiate alternatives no longer exist (12.9).

### 12.11 Round 3 decisions (formerly Open Questions for Skyler)

**Both answered 2026-09-13.** For Q10, Skyler selected an option and added no comment. For Q11, Skyler wrote a comment instead of selecting an option; it is quoted exactly below, followed by how I've applied it. The questions and options are kept as they were shown, numbered after Luigi's Q8–Q9 (13.19).

**Q10. When a Monstrous or Spell-Slinger levels up, should the app accept the extra pick?** The Monstrous has the improvement "Take a natural attacks pick". The Spell-Slinger has "Take another Combat Magic pick", once as an improvement and once as an advanced improvement. Hunters don't record improvements yet, so the hunter's edit page is the only place to write that extra pick down. Under the new rules, a Monstrous's third natural attack or a Spell-Slinger's fourth combat spell would be refused as over the limit. Extra moves from "Take another … move" are already refused the same way today, on all 28 playbooks. **RESOLVED 2026-09-13: A, "Refuse, as designed".**
- **A. Refuse it, as designed (recommended).** This keeps one rule, the same one moves follow: saving checks the limits a new hunter starts with, and level-up picks wait until hunters record improvements. No extra work.
- **B. For Natural Attacks and Combat Magic, report the rule but don't refuse.** Level-up picks within today's per-category caps would save. Illegal starting combinations (such as two Bases plus an Extra) would save too, and a levelled-up hunter would show those sections as unfinished. A small code difference: these two rules skip the refusal step.

**Q11. Should the Initiate's armour line get a short label?** Its granted-armour gear category is labelled with the whole weapons paragraph ("If your Sect has fighting arts or obsolete gear … You also get old-fashioned armour."). `phases.md` group 3 records the choice to widen that column and keep the paragraph in the label rather than add a separate notes field, since nothing else could hold the rule. The pick rules now hold it, so the Gear step would show the rule twice. Luigi suggested a shorter label (13.14).
- **A. Keep the paragraph.** No data change; the Gear step shows it above the rule's own labels.
- **B. Shorten it to the printed sentence "You also get old-fashioned armour." (recommended).** This is the sheet's own wording, not new copy. It needs one guarded update in the same migration, applied only when the label still exactly matches the stored paragraph, plus a seed re-export.
- **C. Shorten it to "Armour", as Luigi suggested.** Same delivery as B, but new wording rather than the sheet's.

**Q11 DECIDED 2026-09-13. Skyler selected no option and wrote:**
> For the Initiate, the Armour is an aspect of their gear and can remain as part of the Gear section description for the Initiate Playbook.

**How I've applied it (my reading of the data, not Skyler's words): no change, which in effect is option A.**
- The data has no gear-section-level description. The Initiate's gear prose lives only in the label of its first gear category: the granted category whose one option is "Old-fashioned armour" (`b804a4e6-07b1-43cb-8c8a-a42c5aa3d6f7`). `phases.md` group 3 records the earlier choice to widen that label rather than add a separate gear-notes field. So for the paragraph to "remain" part of the Gear description, that label stays as it is. The words ask for nothing new, so no field is added.
- There is no guarded label update and no seed re-export for it; the 12.9 migration inserts pick-rule rows only.
- **What the player sees (12.9, as updated for Q12):** the Gear step shows the paragraph as that category's label, with Old-fashioned armour in its read-only "You get" list (B6). Then come the two weapons lists under their own printed headings, with counters at the Sect-adjusted numbers. The Initiate's rule no longer has labels, so nothing repeats the paragraph. *(Updated 2026-09-13: this bullet previously said the instruction appeared twice.)*

### 12.12 Initiate weapons after the PDF check (Q12)

**Context.** Later on 2026-09-13 the playbook PDF turned out to be readable with Git Bash's `pdftotext` 4.00. The Initiate's pages (p33–34, quoted in 12.9) print weapons-list headings that allow two or three old-fashioned weapons and one or two modern ones, never zero. That contradicted the Initiate alternatives the Q6 and Q7 answers had produced (3 + 0 and 0 + 2). The coordinator put the PDF text to Skyler with three options. I didn't draft this question; the chosen option's text is recorded as shown, and the other two as the coordinator described them.

**Q12. How should the Initiate's weapons rule read, given the printed list headings?**
- **"Keep current design":** 3 + 0, 0 + 2 or 2 + 1 by Sect, otherwise 2 + 1.
- **"Traits adjust 2+1":** "Matches both the paragraph and the list labels. Start from 2 old + 1 modern; Fighting arts/Obsolete gear raises old-fashioned to 3; Modernised/Nifty gadgets lets modern go to 2 ('may'); both groups: 3 old + 1 or 2 modern. Replaces the Q6/Q7 answers."
- **"Labels only, no Sect rule":** any 2–3 old-fashioned and 1–2 modern, whatever the Sect.

**RESOLVED 2026-09-13: "Traits adjust 2+1".** Skyler selected it with no comment. It supersedes Q6 and Q7 (12.10), which stay as a record.

**How I've applied it (mine):**
- Each weapons list has its own range and its own tradition-triggered adjustment (12.9's data table). The finished builds are:
  - 2 + 1 with neither group;
  - 3 + 1 with Fighting arts or Obsolete gear;
  - 2 + 1 or 2 + 2 with Modernised or Nifty gadgets;
  - 3 + 1 or 3 + 2 with both.
- It changed the shape of the rule model ("Why the shape changed for Q12" in 12.9) and the pinned `pickRules` JSON.
- It doesn't touch Yoshi's 12.8 contract (`HunterEvaluationResponse`, `HunterOutstandingItem`, the areas) or the property that everything resolves from picked option ids with no priority rules.
- Two things in 12.8 were written against the old reading, and are marked there: Yoshi's three Initiate test combinations, and the note that the Initiate's line might carry no `GearCategoryId`.

### 12.13 The Luck rule sentence after the PDF check (2026-09-14)

**Context.** Rosalina found, and the coordinator checked against the PDF text, that the universal Luck sentence isn't uniform across the sheets:
- 22 print "Mark luck to change a roll to 12 or avoid all harm from an injury.";
- 6 print "Mark luck to change a roll to 12 or avoid all harm.": the Expert, Flake, Initiate, Monstrous, Mundane and Professional.

The Harm and Experience sentences are identical on all 28. This corrects Q4's context (12.7). The coordinator put the counts to Skyler with three options. I didn't draft this question; the chosen option's text is recorded as shown, and the other two as the coordinator described them.
- **"Each sheet's own wording":** two fixed variants in the web app, chosen per playbook.
- **"Longer wording for all":** "'…or avoid all harm from an injury.' on every playbook, reading the short version as the same rule cut for space. One constant, as Q4 intended. Rosalina's current default."
- **"Shorter wording for all".**

**RESOLVED 2026-09-14: "Longer wording for all".** Skyler selected it with no comment.

**Backend effect (mine): none.** Q4 still stands as fixed text in the web app, now with one agreed Luck sentence. Nothing is stored or seeded, and no playbook data changes.

---

## 13. Frontend review — Luigi

**2026-09-13, updated 2026-09-14. Review only. No application code, spec, style or other file was changed.** Sections 0–12 are Rosalina's and Bowser's, and Section 14 is Yoshi's; all are left as written. I've added only a few one-line "see 13.x" pointers, and where I disagree, I say so here (13.13).

**Updated 2026-09-13 with Skyler's answers and Bowser's final Section 12, and 2026-09-14 for the Luck sentence:**
- **My Q8 and Q9 (13.19):** Skyler chose "Re-check on last step" and "Both wizards".
- **Bowser's rounds 2 and 3 (12.10, 12.11):**
  - Q5 "Include both now";
  - Q10 "Refuse, as designed";
  - Q11: Skyler wrote a comment instead of choosing an option. Bowser quotes it in 12.11 and reads it as "no label change". That reading is his.
  - Q6 "Either; picks decide" and Q7 "Two modern or usual mix" were **superseded the same day by Q12**.
- **Q12 (12.12):** after the PDF check, Skyler chose "Traits adjust 2+1" for the Initiate's weapons.
- **The Luck sentence (2026-09-14):** Skyler chose "Longer wording for all". The Tracks step uses "Mark luck to change a roll to 12 or avoid all harm from an injury." on every playbook. The decision is recorded in the other sections; this section applies it in 13.6.

  Skyler added no comments on any of these except Q11, so no reasoning here is attributed to Skyler.
- **Reconciled** with 12.8 (Yoshi's check-only endpoint), 12.8.1 (O1–O4), 12.9 (pick rules, S1–S12, with the `pickRules` contract as re-pinned for Q12), 12.12, and Yoshi's Section 14 (releases R1–R7, data-built wording, the draft's form).
- **Release timing (2026-09-14):** Yoshi decided that the 12.9 backend ships in R6 together with the client limits. The coordinator put it to Skyler, who picked "Ship together in R6" with no comment (13.16).

**What I read:**
- The whole web app tree: the Mystery wizard (page, store, all phase components, tracker, dossier, SCSS, both specs), the hunter feature (routes, create, detail, list, `HunterFormComponent`, `BespokeOptionTreeComponent`, the form spec), `core/` (API, auth, guards, both error interceptors, `self-handled-request`, notifications, models), `app.config.ts`, `app.routes.ts`, `page-layout`, `ConfirmDeleteModalComponent`, `CustomSelectComponent` and the admin `playbook-form`.
- On the API side: `HunterContracts.cs`, `HunterCompleteness.cs` and `HunterService.Validate`.
- The seed (`hunter-playbooks.json`, queried directly).
- `architecture.md` §8–9, the angular-wizard-decomposition skill, and the relevant `.squad` decisions and history.

**The PDF is readable** with Git Bash's `pdftotext`. I checked the Initiate's gear on p33 in the plain-text dump: the paragraph, "You also get old-fashioned armour (1-armour heavy).", and the headings "Old-fashioned weapons (pick either two or three, as above):" and "Modern weapons (pick either one or two, as above):" match 12.9's quotes. The other printed wordings rest on Bowser's check in 12.9.

**Withdrawn design:** nothing in Sections 0–12 references or reintroduces the withdrawn 2026-09-12 hunter advancement / hunter sheet decisions. A repo-wide search for them only turned up unrelated uses of "review step" in authoring docs.

### 13.1 In brief

- **Tracker: generalise it.** Extract a presentational `WizardTrackerComponent` and move the Mystery wizard onto it, as Rosalina's option B proposes. The tracker's visible change to Mysteries is "current always wins" (13.3).
- **Side-by-side view: share the shell, build a new dossier.** Extract a thin `WizardLayoutComponent` and keep the 42% column. **Per Q9, both wizards get the shell's scroll, focus and narrow-screen fixes,** including a compact tracker on narrow screens (13.4).
- **Draft: one injectable `HunterDraft`,** provided separately by the edit page and the wizard page. It owns every piece of hunter state and the single `UpsertHunterRequest` builder, which Evaluate, Create and the edit page's Save all use. This extraction is the highest-risk step in the plan: a mistake there silently damages saved hunters on the live edit page (13.5).
- **Evaluate (Q8):**
  - The check runs on every step change, as Yoshi decided.
  - On step 8 only, it also runs about 500 ms after the player stops clicking or typing. Edits to History notes don't count.
  - Every trigger feeds one latest-wins stream (13.9).
- **Tracker marks under a refusal (Bowser's O1), settled (L5):**
  - While a check is loading or has failed, marks keep the last clean result.
  - A refusal turns the finished marks on the steps the check covers back to "visited, unfinished".
- **Pick rules: three rules, two kinds of target, one client lookup** that follows 12.9 as re-pinned for Q12.
  - **The Initiate** is a single alternative. Each weapons list has its own effective range, which a picked tradition can adjust. Its lists show ordinary counters ("n of 3", "n of 1–2") under their printed headings, with no rule labels.
  - **Natural Attacks and Combat Magic** are the only rules with several alternatives at once. They show their rule label and "n picked" counters.
  - The lookup drives limits, hints and counters in `HunterGearSection` and `HunterBespokeSection`, on both the wizard and the edit page (13.5, 13.6, L25). Under Q10 the edit page applies the same limits, so a level-up pick stays disabled, just as extra moves already are.
- **Changing an Initiate's Sect after picking weapons:** I adopt Bowser's S5 (keep the picks; the check refuses until they fit). Under Q12 only *removing* a trigger tradition can strand picks, meaning a third old-fashioned weapon or a second modern one. The frontend handling:
  - an inline notice under the Sect section at the moment of the change;
  - an over-limit notice on the affected weapons list;
  - a "Go to Gear" link on the refusal band instead of "Reload playbook" (13.7, L24).
- **Admin playbook form (F8a): lists pick rules read-only and omits `pickRules` on save.** Bowser agreed on 2026-09-13 (12.9 S3). S9 treats an omitted `pickRules` as "unchanged", so old and new admin tabs behave the same. **F8a ships in R6 with the 12.9 backend** (13.13, 13.16).
- **Three live frontend bugs the doc doesn't list:**
  - Every refused create or save fires **two** error toasts today.
  - If nothing changes, evaluate failures would toast on every check.
  - The playbook load can race when the picker changes quickly (13.11).
- **My call on session expiry: the login redirect wins over the discard guard** (13.8).
- **Releases (Yoshi's 14.6, agreed):** the phases ship as R1–R7. F8a, F8b and F8c ship in R6 with the 12.9 backend; the wizard, with its pick-rule band links, ships in R7 (13.16).
- **No open questions for Skyler, and no open disagreements.** Q8 and Q9 are decided (13.19). The admin-form point with Bowser and Yoshi's Section 14 points are resolved (13.13).

### 13.2 Frontend claims checked against the code

| Claim | Verdict |
|---|---|
| §2.1 / §2.2 file and line references: create navigates to `/hunters/:id`, `dropSelectionsOutside`, the untick clear, the store's phases, `jumpToPhase` and `isPhaseAccessible`, the tracker injecting the store, the hard-coded four-phase grid, the `.complete`/`.active` precedence bug, the shell and dossier lines | **Correct** as of `25e491d`. |
| §7.6 / Bowser 12.2: today's create error is "a toast" | **Incomplete. It's two toasts.** `httpErrorInterceptor` toasts `Request failed (400) for POST /api/hunters` for every non-401 error (`http-error-interceptor.ts:16-33`). `hunter-create.ts:67-70` then toasts the server's message on top. `hunter-detail.ts:84-87` does the same on save. |
| §7.4: `ConfirmDeleteModalComponent` needs a `confirmLabel` | **Correct.** `verb` is the title (`.html:10`) and the confirm button label (`:26`). The confirm button is always `bg-danger` red, which suits both Discard and Switch playbook. `message` shows either way; `items` and `permanenceNote` only render when `items` isn't empty (`:11-23`). |
| §7.5: "the first `canDeactivate` guard" | **Correct.** The app also has no `beforeunload` handler, no `HttpContext` usage, and no router config beyond `provideRouter(routes)` (`app.config.ts:35`). |
| §3.3 step 4 / 12.2: the numeric leaf "shown as 3 of 3" | **Needs code.** The tree renders a number input showing `numericMin ?? 0` (`bespoke-option-tree.ts:76-78`, `.html:42-55`) and sends `null`. There is exactly **one** numeric option in the seed: The Spooktacular → The Show → Infernal Favour, 0–3. |
| Gap 5: the playbook prose fields are plain text | **Confirmed from the seed.** None of `gettingStartedText`, `introductionsText`, `historyPromptsText`, `levelingUpText`, `luckSpecialText` or `description` contains an HTML tag on any of the 28 playbooks. |
| Gap 6: granted gear | **Confirmed.** 13 of 73 gear categories have a null `PickCount`. One is the Initiate's first category: its only option is "Old-fashioned armour", and its label is the printed weapons paragraph plus the armour sentence. **Under Q11 (12.11) that label stays,** so the Gear step shows the paragraph as stored above the armour's "You get" list. Then come the two weapons lists under their own printed headings. The Initiate's rule has no labels (12.9), so nothing repeats the paragraph. |
| §5: "`HunterFormComponent` already contains every renderer the wizard needs" | **Mostly.** Luck, Harm, Experience and extra tracks are number inputs (`hunter-form.html:230-279`) and journals are editable entries (`:290-335`). The wizard shows all of these read-only, so they don't belong to a shared section (13.6). |
| §5: the shell at `mystery-create.html:1-45` can be extracted | **Correct.** `mystery-create.spec.ts` is tied to its markup in two places. `:142-143` counts 4 `.phase-bubble` and 5 `app-mystery-section-icon`. `:200-201` reads the first `section` as the step panel and `aside` as the dossier. The extraction keeps all of these (13.3, 13.4). |
| §11 / `hunter-form.html:345`: the stale Background hint | **Correct.** The template comment above it (`:339-343`) and the `<h3>Background</h3>` heading (`:338`) are stale too. |
| 12.9: the admin form and `pickRules` | **The pattern exists.** `playbook-form.ts` already captures content it can't edit (`captureBespoke`, `:338-378`), lists it read-only in `bespokeSummary`, and sends it back in `toRequest` (`:279-281`). Rules are listed the same way, and aren't sent back (12.9 S3). |
| 12.9: "`core/models.ts` gains the `pickRules` types" | **Correct, with a knock-on effect.** Two fixture literals typed `PlaybookDetailResponse` stop compiling until they gain `pickRules: []`: `hunter-form.spec.ts:23` (the other fixtures spread from it) and `playbook-form.spec.ts:15`. |
| 12.9: governed targets' existing hints and limits | **Needs code on both kinds of target.** Each of these reads a stored number that a rule overrides (S8), so shown as it is it would contradict the rule (L31):<br>- **Bespoke:** `BespokeOptionTreeComponent.hint()` (`bespoke-option-tree.ts:89-100`) prints each divider's own range: "pick 1–2" on Base, "pick 0–1" on Extra, "pick 1–3" on Bases, "pick 0–3" on Effects. `sectionProgress` prints "n of 2 picked" from the section's 2/2.<br>- **Gear:** `gearCategoryHint` (`hunter-form.ts:431-434`, shown at `hunter-form.html:145`) prints "Pick 3" and "Pick 2" from the weapons categories' stored `PickCount`. `isGearLimitReached` and `isGearPickShort` (`hunter-form.ts:196-210`) limit against those same caps. An untriggered Sect allows 2 and 1. |

### 13.3 The tracker: generalise it

**Recommendation: Rosalina's option B.** Extract a presentational `shared/wizard/wizard-tracker` component and move the Mystery wizard onto it. Copying it (A) would duplicate the precedence bug, and a generic engine (C) couples two very different lifecycles. I agree with rejecting both.

**Shape:**
- **Inputs** use `@Input()` decorators, the house style:
  - `steps: WizardTrackerStep[]`. Each step has a `label`, a `status` (`'unreached' | 'visited' | 'finished' | 'notApplicable'`), `clickable`, and `subSteps: WizardStepStatus[]` (empty when the step has no dots).
  - `currentIndex` and `currentSubIndex`.
  - An optional `iconTemplate: TemplateRef<{ $implicit: WizardTrackerStep }>`.
  - `collapseLabelsBelowLg`.
- **Output:** `jump(index)`.
- "Current" comes from `currentIndex`, not from a status class. That makes "current always wins" structural rather than a matter of CSS source order, which fixes the bug at `mystery-create.scss:50-51` for both wizards.
- `grid-template-columns` is built from the step count, with connectors at `minmax(1.5rem, 3rem)`. The subgrid rules and the `.phase-bubble` / `.step-dot` / `.tracker-line` class names move with the component.
- **Below `md` (Q9, both wizards), the tracker goes compact:**
  - labels collapse to the current step's only;
  - bubbles shrink from `h-9 w-9` to `h-7 w-7`;
  - connectors to `minmax(0.5rem, 1.5rem)`;
  - padding to `px-4`.

  Eight hunter bubbles then need about 280px, which fits a 375px phone inside the page and tracker padding (L28).
- **Icons are projected through the template, not imported.** A `shared/` component can't import `features/mysteries/shared/mystery-section-icon`. The Mystery page passes a template that renders `<app-mystery-section-icon [kind]>`, so the spec's icon count of 5 still holds. The hunter wizard passes none.

**Mystery migration:**
- `MysteryCreateComponent` builds `trackerSteps` from the store's existing `phases`, `phaseComplete`, `phaseStepComplete` and `isPhaseAccessible`. Dots keep today's rule: `phaseStepComplete[p][s] || (currentPhase === p && currentStep > s)`.
- `(jump)` calls `store.jumpToPhase`.
- Delete `mystery-create-tracker.ts/.html` and the tracker block in `mystery-create.scss`. The store doesn't change, so `mystery-create.store.spec.ts` (including the Bug 2 revisit test) runs unchanged.

**Cost:** about a day, including the compact narrow-screen variant. Roughly 150 lines of component, SCSS and spec, a 25-line adapter, and three deleted files.

**Risk to Mysteries: low to medium.**
- The intended visible changes are:
  - accent with ✓ on a finished phase you jump back into;
  - on narrow screens, the compact tracker.
- The real risks are the generated grid columns, the dot mapping, and edit mode (`/mysteries/:id/edit`, where every bubble is clickable).
- **Mitigations:**
  - the two existing Mystery specs must stay green with no assertion changes;
  - a new tracker spec covering the whole status ladder, including current plus finished, and not-applicable bubbles, which can't be clicked;
  - a two-theme screenshot comparison of all four phases, in create and edit, at desktop width and at 375px.

### 13.4 The side-by-side view: share the shell

**Recommendation: agree with Rosalina §5.**
- Extract `shared/wizard/wizard-layout`:
  - **Inputs:** `eyebrow`, `title`, `blurb`, `error`, and a `stepKey` that changes on every navigation.
  - **Content slots:** `[wizardTracker]`, `[wizardTitleIcon]`, the default slot for step content, `[wizardFooter]` and `[wizardAside]`.
- Keep the `<section>` / `<aside>` elements, the 42% column, the error-band markup and the footer classes exactly as they are.
- Move the `fadeSlideIn` keyframes and the `.dossier-section` animation under a `.wizard-layout` scope, and add the `prefers-reduced-motion` override.
- Build a new `HunterSheetPreviewComponent` that injects the store and draft and reuses the dossier card vocabulary.

**Three shell fixes. Decided 2026-09-13 (Q9, "Both wizards"): the Hunter and Mystery wizards both get them.**
1. **Scroll position carries over between steps.** The left `<section>` stays in place across the `@switch`, so pressing Next from the bottom of a long step lands you at the bottom of the next one. This happens in the Mystery wizard today. Fix: reset `scrollTop` when `stepKey` changes.
2. **Focus stays on the Next button** when the step changes, so screen readers don't announce the new step. Fix: give the step `h1` `tabindex="-1"` and focus it when `stepKey` changes. **Not on first render,** so opening a wizard doesn't take focus away from the page (L22).
3. **No narrow-screen layout.** `w-[42%]` has no breakpoint (`mystery-create.html:5`), so on a phone the column is roughly 150px wide. Fix: below `md`, the column goes full width and the aside is hidden (L23), and the tracker goes compact (13.3, L28).

**What this means for the Mystery wizard:**
- **Mystery `stepKey`:** `` `${currentPhase}-${currentStep}` ``.
- **Visible changes** (none in the store or in data): the tracker's "current always wins"; the column scrolling back to the top and focus moving to the heading on every step change; single-column layout and a compact tracker below `md`.
- **Mystery test changes:** no existing assertion changes in `mystery-create.spec.ts` or `mystery-create.store.spec.ts`. The shell keeps the first `section`, the `aside`, `.phase-bubble` and the icon count, and scrolling or focusing doesn't disturb the dossier or composer assertions. **New tests:**
  - a `WizardLayoutComponent` spec: a changed `stepKey` resets `scrollTop` and focuses the heading; the first render doesn't focus;
  - one `mystery-create.spec.ts` case: after `store.next()`, `document.activeElement` is the step `h1`;
  - the Mystery browser check at 375px (13.15 item 10), because jsdom doesn't lay anything out.

**Cost:** about a day with the three fixes (half a day before them). **Risk to Mysteries: low.** The projected phase components don't change and the spec's element queries still match.

### 13.5 Draft state

**`HunterDraft`:** `@Injectable()`, not root, in `features/hunters/shared/`.
- **Provided** by `HunterFormComponent` (the edit surface) and by the wizard page next to `HunterCreateStore`. Section components inject it, so neither surface passes 30 inputs and outputs down.
- **Owns:**
  - `playbook`;
  - a `FormGroup` for the scalars (name, pronouns, playbookId, rating line, luck, harm, experience, background);
  - every pick signal the form holds today (moves, gear, look answers, track values, bespoke picks/answers/free text/instances, journal entries).
- **Methods moved verbatim from the form:**
  - `toggleMove` together with `clearBespokeSections`;
  - `toggleGear`, the look setters and the bespoke setters;
  - `lockedScopes` (now merged with the pick-rule locks below), `sectionProgress` and `moveSectionsFor`;
  - `populate(hunter)`;
  - `prune(playbook)` (today's `dropSelectionsOutside`).
- **New methods:**
  - `toRequest(): UpsertHunterRequest`, the only request builder;
  - `isDirty`;
  - `playbookScopedSummary()`, the "Rating line", "2 moves"… item list for the switch confirmation;
  - `sectionLevelPickedOptionIds`, the input to trigger matching (12.9 step 1). Triggers are leaf options in playbook-level, non-repeatable sections (S2), so this is the union of `bespokePicks` for those section ids.
- **Why a FormGroup inside the draft:** `MysteryCreateStore` sets the precedent (forms inside the store, read through `toSignal`). Two standing records say otherwise:
  - `angular-wizard-decomposition/SKILL.md:29` says stores don't own forms;
  - `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` 2026-07-21 says "ReactiveForm instances stay in phase components".

  Both exist to stop form state leaking between sibling steps of a multi-phase wizard. This draft is submitted once and shared by one surface's sections, so there are no siblings to leak into. It's a limited supersession of both records ("a draft submitted once may own its form"), written into them as a doc update in R4 (Yoshi's 14.5, 14.8).
  - **Gotcha to build in from day one:** read the scalars through `valueChanges.pipe(map(() => form.getRawValue()), startWith(form.getRawValue()))`, not through `.value`. The edit page disables `playbookId`, and a disabled control is dropped from `.value`.
  - Anything computed reads that signal, never a control directly. That is the `isRatingUnchosen` lesson.
- **Wire-shape rules `toRequest` must keep** (all live today, most untested):
  - required move ids are sent;
  - unanswered look lines are left out;
  - instance and journal `serverId`s are echoed back, because dropping them recreates those rows on every save;
  - instance-scoped selections nest under their instance;
  - free text and blanks are trimmed, and empty values become null.
- **Two additions:**
  - Ticking a numeric leaf with no stored value sets `numericValue = numericMax` (12.2; L14).
  - The draft never adds ids for granted gear, and leaves any already-saved ids alone (B6; L15).
- **Playbook loading** stays with each consumer (the form component, the wizard store), but both use `switchMap`, which fixes the race in 13.11.

**Pick rules on the client.** A pure module, `hunter-pick-rules.ts`, sits beside the draft with its own spec. It follows 12.9's contract as re-pinned for Q12:

```
pickRules[] → { id, label, sortOrder,
  alternatives[] → { id, label, sortOrder,
    counts[] → { gearCategoryId | bespokeOptionId, minCount, maxCount,
                 adjustment: { triggerOptionIds[], minCount, maxCount } | null } } }
```

It's used only for disabling options, hints, counters and notices. It never sets a mark.
- **`indexPickRules(playbook)`**, computed once per loaded playbook:
  - Classifies each rule as `gear` (targets are gear categories) or `bespoke`. A bespoke rule's section is found through its counts' `bespokeOptionId`, as 12.9 says.
  - Records each target's display name, the set of governed target ids, and each adjustment's trigger option titles, their section's title and its Rules dot, for hints and links (L25, L31). No playbook, section or option name is hard-coded in the client (Yoshi's Y9, L33).
- **`effectiveRange(count, triggerIds)`**, literally 12.9 step 1: the count's `adjustment` range if any of its `triggerOptionIds` is in `sectionLevelPickedOptionIds`; otherwise its own `minCount`–`maxCount`.
  - There's no ordering and no "undecided" state (S1), and **every alternative of a rule is always allowed** (step 2).
  - Each Initiate list is adjusted by its own traditions, independently. With Fighting arts and Modernised, old-fashioned is 3–3 and modern is 1–2. An unanswered Sect gives 2–2 and 1–1.
- **`pickedCount(target)`:**
  - gear: picked options in the category;
  - bespoke: engaged direct children of the category in the section-level scope. This matches `BespokeEngagement.CountUnder`, so write-your-own slots count like any other option.
- **`fits(rule)`:** some alternative has `picked ≤ effective max` on every target.
- **`hasRoomFor(target)`:** some alternative has room for one more pick on this target, given the picks on the rule's other targets. For the Initiate, with one alternative, that's simply "picks below this list's effective maximum". Unpicked options under a target with no room are disabled; picked ones always stay enabled so they can be unticked.
- **`isShort(target)`**, for counter styling only: no alternative is met, and this target is below its effective minimum in every alternative that still fits.
- **Where the locks land:**
  - `HunterGearSection` replaces `isGearLimitReached` and `isGearPickShort` for governed categories with `hasRoomFor` and `isShort`. The stored `PickCount` (3 and 2) stays only as the server's cap (S8).
  - `HunterDraft.lockedScopes(section, scopeKey)` adds a governed category's id when `!hasRoomFor`. `BespokeOptionTreeComponent` already disables a locked scope's unpicked children, so it needs no change for limits.
  - Pick rules never apply inside repeatable or move-internal sections (12.9 `ValidateGraph`), so the lock merge touches only these two sections.

**The new count/adjustment shape causes no frontend problem.**
- Counts carry no ids on the wire, so the lookup keys them by target id, which is unique within an alternative (12.9 `ValidateGraph`).
- A count has at most one adjustment, so resolution needs no ordering.
- The one knock-on effect was on the admin form's echo, settled as omit (12.9 S3, 13.13).

**`HunterCreateStore`:** provided on the wizard page.
- **Holds:**
  - the playbook list and playbook load state;
  - a `steps` model computed from the playbook (8 steps; Rules gets one dot per `bespokeSections` row, or is not applicable when there are none);
  - `current` and `furthest` as `{step, sub}`;
  - the `gateOk` computed;
  - `next`, `back` and `jumpTo`;
  - the `evaluation` state, the step 8 re-check trigger, and `trackerSteps` (13.9);
  - `isSubmitting`, `submitError`, `submitted` and `create()`;
  - the step titles and blurbs.
- **Step components** (one per step) are display-only and own no state. The whole wizard submits as one unit, so the steps are a display concern, not an architectural boundary.

### 13.6 Shared sections

Split into `features/hunters/shared/sections/`. The edit page's `HunterFormComponent` becomes a composition of these plus its own edit-only blocks.

| Section | Used by | Notes |
|---|---|---|
| `HunterRatingsSection` | both | Rosalina's 5-column grid applies to both surfaces (L16). |
| `HunterMovesSection` | both | Required moves, the pick pool, the counter against the budget (B1), and move-internal sections through `HunterBespokeSection`. |
| `HunterGearSection` | both | A read-only "You get" list for null `PickCount` (Gap 6); the Initiate's armour category keeps its paragraph label (Q11). **For gear categories a pick rule governs** (the Initiate's weapons): the printed heading as it is; `gearCategoryHint` hidden (L31); disabling through `hasRoomFor`; the counter against the effective range; the unfired-adjustment hint (L25); the L30 over-limit notice. There are no rule or alternative labels. |
| `HunterLookSection` | both | Unchanged behaviour. |
| `HunterBespokeSection` | both | Today's `#bespokeSection` template. A `mode: 'create' \| 'edit'` input only changes the numeric leaf: read-only "3 of 3" in the wizard, the input on the edit page. Hosts the L24 notice under the Sect section. **For a section a pick rule governs** (Natural Attacks, Combat Magic): the rule label replaces `sectionProgress`; `BespokeOptionTreeComponent` gains a `governedIds` input that hides the governed dividers' own "pick n–m" hints (L31); L25 counters; the L30 over-limit notice; locks through `lockedScopes`. |
| `HunterHistorySection` | both | The History notes textarea plus prompts rendered as `whitespace-pre-line` text (Gap 5). |
| Luck / Harm / Experience / extra tracks / journals | edit only | Stay in `HunterFormComponent` as inputs. The wizard's step 3 has its own read-only `HunterTracksReference`, which renders the Q4 rule sentences as web-app constants. Harm and Experience print identically on all 28 sheets; Luck doesn't (22 print the long wording, 6 the short). Per Skyler's 2026-09-14 "Longer wording for all", one Luck constant serves every playbook: "Mark luck to change a roll to 12 or avoid all harm from an injury." |
| Playbook picker + name, Improvements, Introductions / Getting Started panels, "Still to finish" card | wizard only | — |

### 13.7 When an earlier choice changes

- **Switching playbook** (step 1):
  - The picker binds to its own `FormControl`, not to the draft's `playbookId`. That's because `CustomSelectComponent` commits through `onChange` the moment an option is clicked (`custom-select.component.ts:121-124`).
  - `store.requestPlaybook(id)` opens the confirmation only when `draft.playbookScopedSummary()` isn't empty.
  - **Cancel** runs `picker.setValue(currentId, { emitEvent: false })`; `writeValue` repaints the trigger.
  - **Confirm** sets the id, loads with `switchMap`, prunes, resets `furthest` to step 1, and clears `evaluation`.
  - Name, pronouns and History notes survive: `prune` has never touched `background`, and the text is about the other hunters. The permanence note names them (L13).
- **Unticking a move whose sections have answers:** today's silent clear moves into the draft unchanged. That was Skyler's 2026-09-11 call.
- **Changing an Initiate's Sect tradition after picking weapons: Bowser's S5, with this frontend handling (L24).** Nothing is cleared.
  - Under Q12, **adding** a tradition only widens a range: Fighting arts or Obsolete gear raises old-fashioned to 3, and Modernised or Nifty gadgets lets modern go to 2. So it never strands a pick.
  - **Removing** the last trigger tradition for a list can: a third old-fashioned weapon without Fighting arts or Obsolete gear, or a second modern one without Modernised or Nifty gadgets. Swapping a trigger tradition for a non-trigger one counts as removing it.
  1. **At the click.** When a tick or untick in the Sect section leaves a weapons list above its effective maximum (`!fits`), a notice built from data appears directly under the Sect section, naming the list, e.g. "Old-fashioned weapons (pick either two or three, as above): 3 picked, but your Sect picks now allow 2." The wizard adds a "Go to Gear" link; the edit page scrolls to the gear section. The problem is visible where it was caused, which is the reasoning behind the untick precedent, without losing any picks.
  2. **On Gear.**
     - The affected list's counter reads e.g. "3 of 2" with the L30 notice.
     - Picked weapons stay enabled so they can be unticked; unpicked ones are disabled.
     - The unfired-adjustment hint says which traditions would allow the extra pick (L25).
  3. **At the next check.** The check returns Bowser's ceiling refusal for that list, e.g. `"Old-fashioned weapons (pick either two or three, as above)" allows 2 picks, but 3 were made. Fighting arts or Obsolete gear (Sect) allow 3.`, with the suffix built from data (12.9 step 3, S12). The band shows it with a **"Go to Gear"** link rather than "Reload playbook", because the lookup confirms a pick-rule violation (L7). Marks follow L5.
  4. **On Create or Save.** The same refusal, shown in the wizard's band or as the edit page's single toast.
- **Natural Attacks and Combat Magic depend on no earlier choice,** so nothing on another step can strand their picks. They only go over their rule through data saved before 12.9, or through a level-up pick on the edit page.
  - **Q10, "Refuse, as designed":** on the edit page the same `hasRoomFor` lock applies. A Monstrous's third natural attack or a Spell-Slinger's fourth combat spell stays disabled, as extra moves already are. No hint is added, which matches moves.
  - **Existing hunters saved before 12.9** whose picks don't fit (S7), on any of the three playbooks, open on the edit page with the L30 notice. Nothing is auto-cleared, and saving is refused until picks are removed. *Superseded in part 2026-09-14: hunters from before R1 are wiped (stakeholder note at the top; 12.6 B2), so this only reaches test hunters created between R1 and R6.*
- **A refusal with "Reload playbook"** (Yoshi's refusal state, now only when the lookup finds no pick-rule violation):
  1. Re-fetch the playbook.
  2. Prune.
  3. If anything was pruned, show which picks were cleared, using the same summary.
  4. Evaluate again.

  If the re-fetch returns 404 (a missing playbook is also a refusal, per 12.8), the band says the playbook no longer exists and links to step 1 (L27).
- **Rating line, look answers, name, pronouns:** nothing depends on them.

### 13.8 Leaving mid-flow, and discard guard vs login redirect

- **Guard:**
  - `canDeactivate: [hunterDraftGuard]` on the `new` route. The functional guard calls `component.canLeave()`.
  - It returns `true` when any of these holds: `store.submitted()`, `!draft.isDirty()`, or `!authService.isAuthenticated()`.
  - Otherwise it opens the discard modal and returns `Observable<boolean>` from a subject that the modal's `confirmed` / `cancelled` outputs resolve (`take(1)`).
- **Dirty** means a playbook has been chosen, or the name or pronouns aren't blank. Anything else needs a playbook first.
- **Refresh or tab close:** `@HostListener('window:beforeunload')` calls `preventDefault()` under the same condition.
- **Browser Back:** when a guard cancels a popstate navigation, the router's default `canceledNavigationResolution: 'replace'` leaves browser history one entry out of step, so the user's next Back skips a page. Proposed: add `withRouterConfig({ canceledNavigationResolution: 'computed' })`. It's app-wide, but no other route cancels navigation today (the `canMatch` guards fall through, they don't cancel). Verify in the browser during F7.
- **My call, which Yoshi left to me: the login redirect wins.** When `authErrorInterceptor` handles a 401, it runs `authService.clear()` and then navigates to `/login` (`auth-error-interceptor.ts:47-55`). The guard sees that no one is signed in and lets the navigation through. Why:
  1. **Cancelling would strand the user.** The session is already cleared, so every later request 401s. The interceptor only navigates while `isAuthenticated()` is still true, and swallows everything else as `EMPTY`. Create would then neither succeed nor fail, and would sit on "Creating…". The draft couldn't be saved anyway.
  2. **It's rare.** Bowser's 12.2 agrees: every check renews the 24h sliding cookie, so expiry needs about a day idle on one step.
  3. **Accepted consequence:** a deliberate Sign out on a dirty wizard also discards the draft without asking. `endSession()` clears the user before navigating, so the guard can't tell the two cases apart. No draft rescue across re-login in v1, which is consistent with §7.5's "no persistence".
- **Defensive:** Create wraps the request in `finalize(() => isSubmitting.set(false))` whatever happens.

### 13.9 Evaluate calls: ordering, cancellation, errors, marks

- **Service:** `HunterService.evaluate(request)`, carrying the toast opt-out context token (L9).
- **TypeScript contract,** mirroring 12.8:
  - `HunterEvaluationResponse { refusal: string | null; outstanding: HunterOutstandingItem[] }`
  - `HunterOutstandingItem { area: 'ratings' | 'rules' | 'moves' | 'gear' | 'look'; sectionId: string | null; gearCategoryId: string | null; message: string }`
- **Triggers:**
  - **Navigation** (Yoshi's 12.8 rule, unchanged): `next`, `back` and `jumpTo` push a request after the navigation mutation, including when arriving at step 8.
  - **Step 8 edits. Decided 2026-09-13 (Q8, "Re-check on last step"):** while `current.step` is 8, draft changes feed a `debounceTime(500)` source.
    - **What counts as a change:** the request with `background` removed, compared with `distinctUntilChanged`. History notes never affect "Still to finish" (Q4), so typing there doesn't call the server.
    - When the debounce fires, the request is sent only if the player is still on step 8.
    - Every other step keeps Yoshi's rule: no checks on edits.
  - **Gate:** nothing is sent while `gateOk()` is false.
- **Stream:**
  - Navigation and debounced triggers merge into one `Subject<UpsertHunterRequest>` inside the store.
  - Each request is a snapshot taken at the moment of the trigger (the debounce's moment, for step 8 edits), so edits made while it's in flight don't leak into it.
  - **Latest wins through `switchMap`.** A navigation that arrives while a step 8 check is in flight cancels it, and so does a newer debounced edit.
  - Unsubscribing aborts the XHR. The server's `Evaluate` action takes the request `CancellationToken`, so an aborted check normally stops at its database query rather than running to the end (12.8.1 O3). Either way nothing is written, and the endpoint needs no rate limiting or per-call logging.
  - Inside: emit `loading`, then map the response to `refused` or `ok`. `catchError` produces `failed`, and `defaultIfEmpty` also produces `failed` for the case where a 401 was swallowed into `EMPTY`.

  The state the card and tracker read:

  ```ts
  type HunterEvaluationState =
    | { kind: 'idle' }
    | { kind: 'loading'; lastOk: HunterEvaluationResponse | null }
    | { kind: 'ok'; result: HunterEvaluationResponse }
    | { kind: 'refused'; refusal: string; lastOk: HunterEvaluationResponse | null }
    | { kind: 'failed'; lastOk: HunterEvaluationResponse | null };
  ```

- **Marks: pure `hunterTrackerMarks(steps, current, furthest, playbook, evaluation)`**, with its own table-driven spec. It follows Yoshi's 12.8 rules for `ok` results.
  - Natural Attacks and Combat Magic lines carry their `SectionId` (12.9), so those Rules dots stay unfinished while a line is outstanding.
  - The Initiate's lines use area `gear`, one per list below its effective minimum, each with that list's `gearCategoryId` (12.9 step 4). They mark only the Gear step.

  **Bowser's O1 (12.8.1), settled here (L5):**
  - **`loading` and `failed`** use the marks from `lastOk`. A check in progress or a network blip shouldn't flicker or alarm.
  - **`refused` downgrades.** Every mark the check drives, meaning Ratings, Moves, Gear, Introductions and the non-fixed-grant Rules dots, shows at most "visited, unfinished" until an `ok` result arrives. The step 1 gate, Tracks, Improvements and fixed-grant dots aren't affected.
    - **Why not keep the last marks?** Under S5, going back and removing a Sect tradition after picking weapons is the normal way to reach a refusal. A frozen green Gear bubble beside a band saying the weapons don't fit would contradict it.
    - **Why not "unknown"?** Rosalina's five-state ladder has no unknown state, and "visited, unfinished" already means "go look".
  - **With no `lastOk`**, visited steps the check covers show "visited, unfinished".
  - **"Visited"** means at or before `furthest`, counted per Rules dot. Tracker jumps only go up to `furthest`, and walking through Rules via Next passes every dot.
- **The "Still to finish" card:** Yoshi's four states, plus the case where items are listed.
  - **On step 8 (Q8):** from the first edit that will trigger a re-check until its response arrives, the card keeps its current items and shows "Checking…" in its header. The player can see the card is catching up. Answering the last look line clears its item about half a second after the player stops.
  - While a check is running after a navigation and an earlier result exists, the card likewise keeps the previous items with "Checking…", so it doesn't flash to a skeleton on every Next.
  - Items are grouped in step order: Ratings; Rules in section `SortOrder`; Moves; Gear; Look. Each links to `jumpTo(step, sub)`.
  - Within a group the card keeps the server's order. Bowser's O2 fix (sorting repeatable entries by `SortOrder`) also keeps that order stable across checks, which matters more now that step 8 re-checks often.
  - A `sectionId` that isn't in the loaded playbook is listed under its area with no link (L8).
  - A `gear` item links to the Gear step and scrolls to its `gearCategoryId`, so each Initiate weapons line lands on its own list.
  - The card's status line is `aria-live="polite"`. It announces only when the item count changes, not on every "Checking…", so debounced checks don't chatter at screen-reader users.
- **Refusal:** the message appears in the layout's error band **on whichever step is current**, because it means Create will fail. The band links to the governed step or Rules dot, or offers Reload playbook (13.7, L7). A step 8 re-check can raise or clear the band while the player is on that step.

### 13.10 Submit

- `create()`:
  - Returns immediately if `isSubmitting` is already set.
  - Calls `HunterService.create(draft.toRequest())` with the toast opt-out token, wrapped in `finalize`.
  - A step 8 re-check still pending or in flight is irrelevant to Create, which sends its own request.
- **On success:**
  1. `submitted.set(true)` **before** navigating, so the guard stands aside.
  2. Toast `Hunter "{name}" created.`, adding ` {n} things still to finish.` when the 201's `outstanding` is non-empty (B7; L10).
  3. `router.navigate(['/hunters'])`. The list re-fetches on init.
- **On failure:** the draft stays intact, and the store evaluates again.
  - A 400 with `message` shows that message in the step 8 error band.
  - A 400 ProblemDetails body without `message` shows "Unable to create hunter." (B5).
  - Status 0 or 5xx shows "Unable to create hunter. Please try again."
- The "Creating…" disabled button is the only protection against a double submit (B8). That's enough with a single final submit.

### 13.11 Live rendering bugs and the stale hint

All of these fix the current page. Ship them in F1, ahead of the wizard.

1. **History prompts through `[innerHTML]`** (`hunter-form.html:351`). Switch to text interpolation with `whitespace-pre-line`; the seed has no HTML in these fields (13.2). The other `[innerHTML]` bindings (move, section, track and option descriptions, effect text) are constrained-HTML fields under `architecture.md` §6.3, and stay as they are.
2. **Granted gear shown as optional checkboxes** (`hunter-form.html:153-172`, `hunter-form.ts:431-434`). Render a read-only "You get" list with no checkbox, and send no ids for those categories (B6).
3. **The stale Background block** (`:338-345`). The heading becomes "History", the stale comment goes, and the hint becomes the label "History notes". Fix the matching `Hunter.Background` doc comment at the same time (B9).
4. **Double error toasts** (13.2). Add an `HttpContextToken` that only `httpErrorInterceptor` checks, and set it on hunter create and update so only the page's own message shows (L9). I deliberately don't extend `isSelfHandledRequest`: it also turns off the 401 bounce, and these calls still need that.
5. **Playbook load race** (`hunter-form.ts:668-692`). Each change subscribes independently, so a slow response for the previous playbook can arrive after the new one's and overwrite it. Use `switchMap`.
6. **The numeric leaf sends `null`** (13.2). Start it at `NumericMax` when ticked.

### 13.12 What the doc misses (frontend)

1. **Evaluate failures would toast on every check** through `httpErrorInterceptor`, which is worse now that step 8 re-checks on edits. That contradicts Yoshi's information-only "Couldn't check what's left" state. Fixed by the context token (L9).
2. **Tracker marks under a refusal.** Bowser raised this independently as O1; settled by L5.
3. **Step 8's card went stale.** Decided by Q8 (13.9).
4. **Session expiry strands a cancelled user,** and Sign out bypasses the guard (13.8).
5. **Browser Back with a guard that cancels corrupts browser history** unless `canceledNavigationResolution` is `'computed'` (13.8).
6. **The step 1 gate has to include "playbook loaded"**, not just "playbook chosen". Otherwise Next can land on steps with nothing to render while the graph is still loading, or after the load failed (L3).
7. **Scroll, focus and narrow screens.** Decided for both wizards by Q9 (13.4). The tracker needs a compact variant to fit on phones (L28).
8. **Under S5, "Reload playbook" is the wrong remedy for the refusal players are most likely to hit** (13.7, L7).
9. **The admin `pickRules` stale-bundle hazard** is closed server-side by S9: a missing `pickRules` leaves rules unchanged. The form omits `pickRules` (12.9 S3), so old and new admin tabs behave the same. F8a ships in R6 with the 12.9 backend, ahead of F8b in that release because F8b uses its types (14.6, 13.16).
10. **Governed targets' existing hints and limits contradict the rule** under S8. On bespoke sections that's the dividers' "pick n–m" and the section's "n of 2". On the Initiate's gear it's "Pick 3" / "Pick 2" and the limits against the stored caps (13.2, L31).
11. **An untriggered Initiate list's counter needs a reason.** The printed heading says "pick either two or three", but with no Fighting arts or Obsolete gear the counter reads "n of 2". Without a hint that names the traditions, it looks like a bug (L25).
12. **After the swap, `HunterFormComponent`'s create mode is dead code:** `populate(null)`, the enabled picker branch, `submitLabel="Create Hunter"`, and most of the "nothing but the picker until a playbook is chosen" spec cases. Retire it in F5 and move those cases to draft and wizard specs (L17).
13. **The Hunter create, detail and list pages have no spec files.** The feature's only spec is `hunter-form.spec.ts`, and it never checks `serverId` round-tripping, journal entries, extra tracks or free-text looks in the emitted payload. That gap is why F2 is high risk.
14. **An admin save that clashes with a kept pick rule returns a 409 naming the rule** (Bowser's S11, Yoshi's Y3), the same status as the existing removed-rows conflict. `playbook-admin.ts:86-90` already shows the server's `message` on a failed save, so it needs no new handling. It double-toasts like the hunter pages, though, so F1's opt-out token is also set on the admin playbook save and delete (L9).

### 13.13 Where I disagree

**Recorded, not contested** (corrections nobody has disputed; neither needs a decision):
- **Rosalina §5: "tracks" as a shared section component.** The wizard shows them read-only; the edit page edits them. They aren't the same component (13.6).
- **Rosalina §7.6 and Bowser 12.2: the create error "is a toast".** It's two (13.2). The wizard plan (error band) is still right, but it needs the toast opt-out token, or the band arrives with a generic toast on top.

**Resolved:**
- **Yoshi (12.8), no check on edits:** resolved by Q8, a re-check on step 8 only.
- **Yoshi (12.8), a refusal always offers "Reload playbook":** under S5 the likeliest refusal is a pick rule, which a reload can't fix, so the frontend links to the governed step instead (L7). Yoshi agrees, with a limit (14.4, Y13): the lookup only chooses a link, and if routing grows, structured refusal fields go on `HunterEvaluationResponse`.
- **Rosalina §4.1 / §11, the Mystery migration as a "no-op apart from the precedence fix":** resolved by Q9. The Mystery wizard gets the shell fixes too.
- **Bowser 12.9 (S3), whether the admin form echoes `pickRules` on save:** resolved as omit. My concern was that counts and adjustments are replaced wholesale on every save, so an echo that dropped one `adjustment` would silently pin the Initiate at 2 + 1. The form lists rules read-only and omits `pickRules`, which S9 treats as "unchanged", so old and new admin tabs behave the same.
  - *Resolved 2026-09-13: Bowser agrees; see 12.9 S3.*
- **Yoshi 14.6 (with Bowser 12.9 S10), 13.16's "F8a–F8c can ship with the 12.9 deploy or after it":** resolved as ship together in R6. One image carries both halves and migrations run at startup, so "after" would have meant a live stretch where the current forms offer picks the server refuses on save. 13.16 now follows R1–R7, and Skyler confirmed "Ship together in R6" on 2026-09-14.
- **Yoshi 14.3.6, the hard-coded "Sect traditions" wording in L25:** resolved. Client hints and notices are built from trigger, target and section titles (L25, L30, L33).
  - **One refinement of mine:** L25's "This depends on your {section title} picks" now fires when the trigger section has no picks, instead of reading the last check. The edit page never calls the check (Y14), and R6 ships before the wizard, so a check-based condition would never fire where the hint first goes live.
- **Yoshi 14.5, the draft's form also contradicting `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` 2026-07-21:** agreed, and recorded in 13.5. The limited supersession is a doc update in R4 (14.8).

**Agreed:**
- The rest of 12.9 as reworked for Q12: the per-count adjustment shape, S1, S3 (as updated), S5, S6 and S8–S12. The frontend needs nothing more from the new shape (13.5).
- 12.8.1 O2–O4, with Yoshi's Y8 extending O2 to a full deterministic order.
- 12.12.
- Yoshi's Section 14 as it touches the frontend: Y1, Y2, Y9, Y10, Y11, Y13 and Y14.

### 13.14 Dependencies and asks for Bowser (all answered)

| Ask | Answer |
|---|---|
| Evaluate contract: camelCase JSON, exact lowercase `area` strings, refusals as plain strings | **Agreed** (12.8.1 O4). The frontend tells a pick-rule refusal apart through its own lookup (L7). |
| Rule lines with area `rules` carry the governed section's `SectionId` | **Adopted** (12.9 step 4). The Initiate's `gear` lines are now one per list, each with its `gearCategoryId`. |
| Pin the `pickRules` JSON shape | **Pinned, then re-pinned for Q12** (12.9). Rules and alternatives carry `id`, and rules have their own `label`. Alternatives have no triggers. Counts are `{ gearCategoryId \| bespokeOptionId, minCount, maxCount, adjustment: { triggerOptionIds, minCount, maxCount } \| null }`. The F8a/F8b types follow it as written (13.5). |
| Close the stale-admin-tab hazard | **Closed** (S9): a missing `pickRules` leaves rules unchanged, and `[]` removes them. |
| Shorten the Initiate's armour label | **Declined** (Q11, as Bowser reads it in 12.11). The Gear step shows the paragraph as stored, not shortened or hidden. The Initiate's rule has no labels, so nothing repeats it. |
| Message order stable across checks | Bowser's O2 fix, extended by Yoshi's Y8 to a full deterministic order in `HunterCompleteness` (14.4). The card depends on it for a stable order. |
| How an admin save that clashes with a kept rule fails | **A 409 naming the rule** (S11, Y3). The admin page already surfaces the server's `message` (`playbook-admin.ts:86-90`); F1's toast token keeps it to one toast (13.12 item 14). |

No frontend-to-backend points remain open. The echo-versus-omit proposal was resolved as omit on 2026-09-13 (12.9 S3, 13.13).

### 13.15 Test strategy

Runner: `ng test` (Vitest). The app is zoneless, so specs set inputs with `fixture.componentRef.setInput`, never by mutating `componentInstance`, which doesn't re-render (Luigi history, 2026-08-06).

1. **Characterisation first, before F2.** Extend `hunter-form.spec.ts` with a full populate → submit round-trip covering:
   - saved instance and journal `serverId`s;
   - instance-scoped selections;
   - free-text looks;
   - extra tracks;
   - a numeric answer;
   - the required move id.

   Compare the emitted `UpsertHunterRequest` as one exact object. This spec is the safety net for the extraction; F2 isn't finished until it passes unchanged against `HunterDraft.toRequest()`.

   **Plus Yoshi's Y10, on what the server stored.** Before and after F2, save three fully populated hunters through the edit page and diff their `GET /api/hunters/{id}` responses:
   - The Hex, with Rotes entries;
   - The Curse-Eater, with a journal entry and a Corruption value;
   - The Forged, with a freeform look.

   This catches a field the client silently stopped sending, which the server would then delete.
2. **`HunterDraft` unit specs** (inside `TestBed.runInInjectionContext`):
   - prune on a playbook switch;
   - untick clear;
   - numeric start-at-max;
   - no granted-gear ids;
   - `getRawValue` with a disabled `playbookId`;
   - `isDirty`;
   - `playbookScopedSummary`;
   - `sectionLevelPickedOptionIds` excluding repeatable and move-internal scopes;
   - `lockedScopes` adding governed categories without room, and leaving every other section's locks unchanged.
3. **`hunter-pick-rules.ts`, table-driven from 12.9's own tables.** Bowser calls them the test tables, so both sides test the same rows.
   - **The Initiate, `effectiveRange` per Sect row:**
     - none of the four, including an unanswered Sect: 2–2 and 1–1;
     - Fighting arts alone, and Obsolete gear alone: 3–3 and 1–1;
     - Modernised alone, and Nifty gadgets alone: 2–2 and 1–2;
     - both of one group together;
     - traditions from both groups: 3–3 and 1–2.
   - **The Initiate, `fits` / `hasRoomFor` / `isShort`** on each row's finished, accepted-and-reported and refused builds. For example, with Modernised: 2 + 1 and 2 + 2 fit, 1 + 2 is short, 3 + 1 doesn't fit.
   - **Adding a tradition never makes `fits` false; removing one can.**
   - **Natural Attacks:** every build (1 + 1, 2 + 0, 1 + 0, 0 + 1 and 0 + 0 fit; 2 + 1 doesn't; 3 + 0 and 0 + 2 hit the caps).
   - **Combat Magic:** every build (3 + 0, 2 + 1, 1 + 2, 1 + 1 and the partial builds fit; 0 + 3, 3 + 1, 2 + 2, 1 + 3 and 3 + 3 don't).
   - Write-your-own Base slots counted.
   - `indexPickRules` classifying gear and bespoke rules, finding a bespoke rule's section, and resolving trigger titles.
4. **Section component specs** (DOM level):
   - granted gear renders no checkbox, and the Initiate armour label renders as stored;
   - `HunterTracksReference` renders the one long Luck sentence (2026-09-14) for every playbook, including the six whose sheets print the short one (Expert, Flake, Initiate, Monstrous, Mundane, Professional);
   - history prompts keep their line breaks (`whitespace-pre-line`, no `innerHTML`);
   - numeric leaf read-only in create mode, input in edit mode;
   - move counter against the budget (B1);
   - the L24 notice appears when a trigger tradition is removed, and not when one is added;
   - the Initiate's single-alternative counters: "n of 2" and the data-built unfired-adjustment hint ("Fighting arts or Obsolete gear (Sect) allow 3") with no trigger, "n of 3" with Fighting arts, "n of 1–2" on modern with Modernised, and no `gearCategoryHint`;
   - the same hint and notice rendered from a fixture whose section, options and lists are renamed, proving no title is hard-coded (L33); and the "This depends on your {section title} picks" suffix appearing on the edit page with no check call (L25);
   - Natural Attacks and Combat Magic's several-alternative counters ("n picked" under the rule label), with governed divider hints hidden (L31);
   - the L30 over-limit notice with picked options still enabled;
   - on the edit page, a levelled-up extra Natural Attacks pick disabled (Q10).
5. **Pure functions, table-driven:**
   - `hunterSteps(playbook)`: dot counts, and Rules not applicable for The Celebrity, The Flake, The Mundane and The Searcher;
   - `hunterTrackerMarks(...)`: every 12.8 rule, plus L5's loading, failed and refused cases with and without `lastOk`, unknown `sectionId`, a `rules` item with a `SectionId` keeping its dot unfinished, and per-list Initiate `gear` items marking only Gear;
   - the card's grouping order, and gear items scrolling to their `gearCategoryId`.
6. **`HunterCreateStore` specs** (Vitest fake timers for the debounce):
   - the gate blocks Next and jumps from step 1, including while the playbook is loading or failed;
   - walking through Rules dots, skipping Rules, and Back never losing anything;
   - evaluate called on Next, Back, jump and arriving at step 8; never while the gate fails;
   - **Q8:** no call for edits on steps other than 8; on step 8, one call 500 ms after the last of several quick edits; no call for History-notes-only edits; no call if the player left step 8 before the debounce fired; a debounced call cancelled by a navigation that follows it, and the reverse;
   - latest wins, using subject-controlled fakes that resolve out of order;
   - `failed` on error and on `EMPTY`;
   - the refusal band's link picks the governed step, the Rules dot, or Reload playbook correctly;
   - Create success sets `submitted`, toasts and navigates to `['/hunters']`;
   - Create refusal fills the band, with the ProblemDetails fallback;
   - `isSubmitting` reset in all three cases.
7. **Guard and interceptor specs:**
   - the guard for clean, dirty, submitted and unauthenticated;
   - the context token suppresses the toast while a 401 still bounces;
   - the existing "401 → zero notifications" spec still passes.
8. **Admin playbook form (F8a):**
   - `playbook-form.spec.ts` checks that rules appear in the read-only summary, and that the emitted save request has no `pickRules` key (12.9 S3);
   - fixture literals gain `pickRules: []` (13.2);
   - a new `playbook-admin` spec: a 409 on save shows the server's message, once (S11, L9).
9. **Mystery migration (F4):**
   - both existing Mystery specs green with **no assertion edits**;
   - a new `WizardTrackerComponent` spec for the status ladder;
   - a new `WizardLayoutComponent` spec for scroll reset and heading focus on a `stepKey` change, with no focus on first render;
   - one new `mystery-create.spec.ts` case: after `store.next()`, focus is on the step `h1` (13.4).
10. **Browser (Playwright, both themes):**
    - the Mystery wizard in create and edit, at desktop width and at 375px (single column, compact tracker, scroll reset);
    - the hunter wizard at both widths on these shapes:
      - The Crooked (multi-section Rules);
      - The Hex (repeatable Rotes);
      - The Spooktacular (numeric leaf);
      - The Initiate (a finished build for each Sect row in 12.9, plus removing Fighting arts after picking three old-fashioned weapons);
      - The Monstrous and The Spell-Slinger (every finished build from 12.9's tables, and the disabled over-limit option);
      - The Forged (grouped looks);
      - The Celebrity (Rules skipped);
      - The Searcher (sections under a required move);
    - step 8: answer the last look line and see its item clear without leaving the step;
    - **a scripted pass over all 28 playbooks, filling each choice to a legal build, not simply to its ceiling.** Filling to ceilings gives 3 + 2 for the Initiate (refused unless its Sect has traditions from both groups), 2 + 1 for Natural Attacks and 3 + 3 for Combat Magic, all refused. For those three playbooks it uses a finished build from 12.9's tables: for the Initiate, a Sect row's finished build with that row's traditions picked (none: 2 + 1; Fighting arts: 3 + 1; Modernised: 2 + 2; both groups: 3 + 2); for Natural Attacks, 1 + 1 or 2 + 0; for Combat Magic, 3 + 0, 2 + 1 or 1 + 2. The pass checks evaluate returns no refusal and an empty `outstanding`, then creates the hunter (201). A second pass on those three playbooks posts one refused build each straight to the evaluate endpoint and expects its refusal: Initiate 3 + 1 with no trigger traditions, Natural Attacks 2 + 1, Combat Magic 2 + 2;
    - **in R6, before the wizard exists:** the single-page create and the edit page enforce all three rules with their counters, hints and notices, and none of 12.9's refused builds can be put together through them;
    - an admin save of each of the three playbooks that keeps its rule, adjustments included, and an admin save that removes a trigger option and shows the 409 message once;
    - an existing over-limit hunter on the edit page showing the L30 notice;
    - Back button with the guard, and refresh prompting.

    Selector gotcha: `button.bg-accent` also matches the shell's Quick action button, so select footer buttons by text.

### 13.16 Implementation phases

Phases ship in **Yoshi's seven releases (14.6, Y1)**, and I agree with every placement. The Dockerfile builds the web app into the API image and migrations run at startup, so what's live is decided by a phase's release, not its merge order. Skyler confirmed the R6 grouping on 2026-09-14 ("Ship together in R6"): the 12.9 backend and the client limits ship together, so the live forms never offer picks the server then refuses on save.

| Release | Frontend phases | Ships with (backend) | Frontend notes |
|---|---|---|---|
| **R1** Move count | F0 | B1, B3 | — |
| **R2** Live form fixes | F1 | B4, B9 | F1's toast token is also set on the admin playbook save and delete (13.12 item 14). |
| **R3** Shared wizard shell | F4 alone (Y11) | — | Visible Mystery changes by design (Q9). Any time before R7; earlier is better. |
| **R4** Draft extraction | F2 alone | — | Characterisation spec plus Yoshi's Y10 `GET` diff (13.15 item 1). The limited supersession of `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` 2026-07-21 and the skill doc is written down in this release (13.5). |
| **R5** Shared sections | F3 | 12.8 check endpoint, live but unused until R7 | F3 changes the edit page visibly (L16), so its release note says so. |
| **R6** Pick rules, end to end | F8a, then F8b and F8c on the shared sections, without the wizard's band links | 12.9 backend (`AddPickRules`, services, contract, re-exported seed) | The edit page and the still-live single-page create get the limits in the same deploy as the server rule. L25's hints don't depend on the check, so they work there too. |
| **R7** Hunter wizard | F5, F6, F7 and F9, including the pick-rule band links and L24's Go to Gear link | — | Replaces `/hunters/new`. F5, F6 and F7 release together, because without F6 the tracker marks and "Still to finish" card aren't there. |

Estimates are working days for one developer, including specs.

| Phase | Scope | Depends on | Est. | Risk |
|---|---|---|---|---|
| **F0** (R1) | Frontend slice of B1: counter and limit against `max(0, MoveGrantCount − required)`; spec fixture 2 → 3 plus a limit-reached case. Ships in the same change as Bowser's server fix. | — | 0.5 | **Low** |
| **F1** (R2) | Live form fixes on the current page: 13.11 items 1–6, including the toast opt-out context token, also set on the admin playbook save and delete. | F0 (R1, same file) | 1 | **Low** |
| **F2** (R4, alone) | Extract `HunterDraft` (state, prune, untick clear, `toRequest`). `HunterFormComponent` delegates to it with zero behaviour change. Characterisation spec first, then Yoshi's Y10 before/after `GET` diff. | F1 | 2 | **High**: the only phase that can silently damage saved hunters on the edit page |
| **F3** (R5) | Shared section components (13.6); the edit page composes them. | F2 | 1.5 | **Medium** |
| **F4** (R3, alone) | `WizardTrackerComponent` (with the compact narrow variant) + `WizardLayoutComponent` (with scroll reset, heading focus and narrow layout, Q9); Mystery migration plus the precedence fix; new tracker, layout and Mystery focus specs. | — | 2 | **Medium**: visible Mystery changes by design |
| **F5** (R7) | Wizard core: route swap, `HunterCreateStore`, step model, 8 step components, gate, Rules dots and skip, furthest-reached navigation, read-only steps, `HunterSheetPreviewComponent`, Create → toast → `/hunters` with error band. Retire `HunterFormComponent` create mode. | F3, F4 | 3 | **Medium** |
| **F6** (R7) | Evaluate: service and types, merged navigation and step 8 debounced triggers with latest-wins (Q8), `hunterTrackerMarks` (with L5) and spec, "Still to finish" card including its step 8 "Checking…" behaviour and per-list gear links, refusal band with Go to / Reload playbook, including the pick-rule band links (Gear, Rules dot) and L24's Go to Gear link, moved here from F8b and F8c. | F5, F8b, F8c; the 12.8 endpoint is live from R5 | 2.5 | **Medium** |
| **F7** (R7) | Leaving and switching: playbook-switch confirmation (`confirmLabel`, picker revert), discard guard, `beforeunload`, auth stand-down, `canceledNavigationResolution: 'computed'`. | F5 | 1.5 | **Medium** |
| **F8a** (R6) | Admin playbook form: `pickRules` types in `core/models.ts` as re-pinned in 12.9, fixture updates, rules listed read-only in the summary, save request omits `pickRules` (12.9 S3), spec asserting no `pickRules` key. | **Bowser's 12.9 backend, same release** | 0.5 | **Low**: S9 makes an omitted `pickRules` safe |
| **F8b** (R6) | Pick rules for gear on both surfaces (the Initiate): `hunter-pick-rules.ts` (index, `effectiveRange`, `fits`, `hasRoomFor`, `isShort`) with 12.9's table specs; `HunterGearSection` limits and counters against effective ranges under the printed headings, `gearCategoryHint` hidden, data-built unfired-adjustment hint, L30 notice; the L24 Sect notice. | F3, F8a; **12.9 backend, same release** | 1.25 | **Medium** |
| **F8c** (R6) | Pick rules for Natural Attacks and Combat Magic on both surfaces (Q5): merge rule locks into `lockedScopes`, `governedIds` hint suppression in `BespokeOptionTreeComponent`, rule label and "n picked" counters in `HunterBespokeSection`, L30 notice, Q10's level-up lock on the edit page. | F8b | 1.25 | **Medium**: touches the lock and hint path every bespoke section uses |
| **F9** (R7) | Verification: the 13.15 item 10 browser pass, including the legal-build pass over all 28 playbooks, and an accessibility spot check. | F5–F8c | 1.5 | **Low** |

**Total: about 18.5 working days, unchanged by the R1–R7 grouping.** Moving the band links into F6 shifts a quarter-day each from F8b and F8c to F6, and Y10's `GET` diff fits inside F2's two days. Q12 had already taken half a day off F8b:
- **Removed:** the Initiate no longer needs a several-alternatives display, alternative labels, or tests for overlapping trigger groups.
- **Added:** effective-range counters under the printed headings, the unfired-adjustment hint, and replacing today's gear hint and limits for governed categories.

The rest of the earlier growth stands: Q9's shell fixes and compact tracker (+1), Q8's debounced re-check (+0.5), Q5's bespoke rules (+1.5, now split between F8c and F6), the 12.9 test tables (+0.5) and the legal-build browser pass (+1).

### 13.17 Proposed defaults (frontend): decided here, not questions

- **L1.** `HunterDraft` is an `@Injectable()` provided by each surface. Scalars live in a `FormGroup` and are read through a `getRawValue`-based signal. `toRequest()` is the only request builder, used by evaluate, create and update.
- **L2.** Wizard step components are display-only. All state lives in `HunterDraft` and `HunterCreateStore`.
- **L3.** The step 1 gate requires a chosen **and loaded** playbook plus a non-blank name. It blocks Next and tracker jumps. A failed load shows "Unable to load that playbook." with a retry.
- **L4.** "Visited" means at or before furthest reached, counted per Rules dot. Jumps go up to the furthest step reached. Clicking the Rules bubble lands on its first dot.
- **L5 (settles Bowser's O1).** While a check is loading or has failed, marks come from the last `ok` result. A refusal shows every mark the check drives as at most "visited, unfinished" until an `ok` result arrives. With no `ok` result yet, visited steps the check covers show "visited, unfinished". A refusal never turns a mark green.
- **L6.** Evaluate takes a snapshot of the request, keeps only the latest response (`switchMap`), and treats an empty stream as failed. The card keeps its previous items with "Checking…" rather than flashing.
- **L7.** A refusal shows in the error band on the current step. If the pick-rules lookup finds a rule the picks don't fit, the band links to that rule's step (Gear) or Rules dot. Otherwise it offers Reload playbook, which re-fetches, prunes, lists what was cleared, and checks again.
- **L8.** An outstanding item whose `sectionId` isn't in the loaded playbook is listed under its area with no link. A `gear` item links to the Gear step and scrolls to its `gearCategoryId` when it has one.
- **L9.** A new `HttpContextToken` suppresses only `httpErrorInterceptor`'s generic toast; the 401 bounce is unaffected. It's set on evaluate, wizard Create, edit-page create and update, and the admin playbook save and delete, whose errors (including S11's 409) already carry a message. `isSelfHandledRequest` is not extended.
- **L10.** On Create success: `submitted` is set before navigating to `/hunters`; the toast reads `Hunter "{name}" created.`, plus the outstanding count when it isn't zero (B7). A 400 without `message` shows "Unable to create hunter."; a network error or 5xx shows "Unable to create hunter. Please try again."
- **L11.** Session expiry: the login redirect beats the discard guard. A deliberate Sign out also discards a dirty draft without asking. No draft rescue in v1.
- **L12.** Discard guard: dirty means a playbook chosen or name/pronouns typed. The modal uses verb "Discard", item name = the name so far or "New Hunter", message "Nothing has been saved yet." `beforeunload` uses the same condition. The router gets `canceledNavigationResolution: 'computed'`.
- **L13.** Playbook switch: the picker is its own control; Cancel reverts it without emitting. Confirm clears everything playbook-scoped, resets furthest reached to step 1 and clears the check. Name, pronouns and History notes survive, and the permanence note says so. `ConfirmDeleteModalComponent` gains an optional `confirmLabel` that defaults to `verb`, so existing call sites don't change.
- **L14.** A numeric leaf starts at `NumericMax` when ticked, on both surfaces. The wizard shows "3 of 3" read-only; the edit page keeps the input.
- **L15.** Granted gear is a read-only "You get" list on both surfaces. The draft never adds those ids and leaves saved ones alone (B6). The Initiate's armour category keeps its paragraph label as stored (Q11).
- **L16.** Shared sections look the same on the edit page, including the 5-column ratings grid and the "History" / "History notes" retitle.
- **L17.** Once the wizard ships, `HunterFormComponent` is edit-only. Create-mode code is removed, and its spec cases move to the draft and wizard specs.
- **L18.** Tracker: `@Input()` decorators; icon through an optional template; `.phase-bubble` / `.step-dot` / `.tracker-line` kept; grid columns generated from the step count; `collapseLabelsBelowLg` on for the hunter wizard, off for Mysteries at desktop widths (both collapse below `md`, L28).
- **L19.** No hunter step icons in v1 (Rosalina, Gap 9).
- **L20.** Accessibility: `aria-current="step"` and a status `aria-label` on each bubble; dots `aria-hidden`; the card's status line `aria-live="polite"`, announcing only changes in the item count.
- **L21.** The Rules eyebrow keeps fixed 8-step numbering ("Step 4 of 8 · Crooked rules · 2 of 3"). When Rules doesn't apply, its bubble shows as not applicable and the numbering doesn't shift.
- **L22 (both wizards, Q9).** On every step change after the first render, the shell resets the left column's scroll position and moves focus to the step heading.
- **L23 (both wizards, Q9).** Below `md`, the column is full width and the dossier is hidden.
- **L24 (frontend handling of Bowser's S5).** A Sect change never clears weapon picks. When removing a trigger tradition leaves a weapons list above its effective maximum:
  - a notice naming that list appears under the Sect section on both surfaces, with a Go to Gear link in the wizard;
  - the list shows the L30 notice;
  - the refusal band links to Gear.

  Adding a tradition never raises the notice, because under Q12 it only widens a range.
- **L25.** Counters for targets a pick rule governs, on both surfaces:
  - **The Initiate (one alternative):** each weapons list keeps its printed heading and shows "n of N picked" against its effective range. N is a single number when min = max ("n of 2", "n of 3") and a range otherwise ("n of 1–2" for a Modernised or Nifty gadgets Sect's modern list). The counter is muted while `isShort`. There are no rule or alternative labels, and the Initiate never uses the several-alternatives display.
    - **Unfired adjustment:** when a list's adjustment hasn't fired, a muted hint built from data, in the same form as Bowser's server suffix (12.9 step 3): `{trigger titles joined with "or"} ({section title}) allow {adjusted range}`. For example, "Fighting arts or Obsolete gear (Sect) allow 3" under old-fashioned, and "Modernised or Nifty gadgets (Sect) allow 1–2" under modern. No playbook, section or option name is hard-coded (Yoshi's Y9, L33).
    - **Trigger section not yet answered:** when the adjustment's trigger section has no picks at all, the hint adds `This depends on your {section title} picks.` (e.g. "This depends on your Sect picks."). In the wizard it links to that section's Rules dot; on the edit page it scrolls to the section. The condition is local on purpose. The edit page never calls the check (Yoshi's Y14), and R6 ships these hints before the wizard exists, so a condition read from the last check would never fire where the hint first goes live.
  - **Natural Attacks and Combat Magic (several alternatives, always):** the rule label shows once above the governed categories, and each category shows only "n picked".
- **L26.** The admin playbook form lists pick rules read-only in its existing bespoke summary, as "{rule or section} — pick rule, n alternative(s)". There is no rule editor (S3).
- **L27.** If "Reload playbook" finds the playbook deleted (404), the band says it no longer exists and links to step 1, where the normal switch flow applies.
- **L28 (both wizards, Q9).** Below `md` the tracker goes compact: only the current step's label shows, bubbles are `h-7 w-7`, connectors `minmax(0.5rem, 1.5rem)` and padding `px-4`. That fits eight bubbles in about 280px.
- **L29 (Q8).** The step 8 re-check waits 500 ms after the last change, ignores `background`-only changes, fires only if the player is still on step 8, and shares the latest-wins stream with navigation checks. The card shows "Checking…" from that first edit until the response arrives.
- **L30.** When a rule's picks don't fit, the governed list or lists show a `text-danger` notice. Picked options stay enabled so they can be unticked; unpicked ones are disabled. This covers the wizard, a Sect change, and an existing hunter opened on the edit page. Nothing is auto-cleared.
  - **The Initiate:** `Only {effective max} allowed with your {section title} picks`, e.g. "Only 2 allowed with your Sect picks".
  - **Natural Attacks and Combat Magic:** "These picks don't fit: {rule label}".
- **L31.** Under a pick rule, the stored-number hints for governed targets are hidden, and the L25 counters and hints replace them. Every other section and category is unchanged.
  - **Bespoke:** the dividers' own "pick n–m" and the section's `sectionProgress`.
  - **Gear:** `gearCategoryHint`'s "Pick 3" / "Pick 2".
- **L32 (agreed with Bowser 2026-09-13, 12.9 S3).** The admin playbook form omits `pickRules` from its save request while it has no rule editor.
- **L33 (Yoshi's Y9, agreed 2026-09-14).** Every client hint and notice about a pick rule is built from the playbook's own titles: trigger options, target lists and categories, sections and rule labels. A spec renders them from a fixture with renamed titles to prove nothing is hard-coded.

**Implementation notes (2026-09-15, Phase 7).** Three calls I made while building F5–F7. They read the defaults above; they don't change them.
- **L13's "clears everything playbook-scoped" is the prune.** 7.4 defines the switch's clear as today's `dropSelectionsOutside`, and 13.7 says Confirm prunes. L13 summarises that same step. Real playbooks share no ids, so the prune does clear every playbook-scoped pick. The moved prune characterisation case keeps its expected value; it now confirms the switch first.
- **Marks the check doesn't drive** (12.8 "Tracker marks"):
  - step 1 is finished whenever the gate holds;
  - Tracks, Improvements and fixed-grant Rules dots are finished once visited.

  None of these reads the evaluation, so L5's loading, failed and refused states can't change them. Every other mark needs a clean result, as L5 says.
- **The Harm sentence** keeps Q4's fixed wording, with its number taken from `HarmUnstableThreshold`: "When you reach {n} or more, mark unstable." All 28 seeded playbooks have 4, so the text reads as printed today, and an edited threshold can't contradict the box row.

### 13.18 What Bowser's decided questions (12.10–12.12) changed in the frontend work

- **Q5, "Include both now":** Natural Attacks and Combat Magic join the lookup as bespoke targets. That's the phase F8c (+1.5 days): `lockedScopes` merge, divider hint suppression, rule label and "n picked" counters in `HunterBespokeSection`, and Rules dot marks from `rules` items carrying `SectionId`. They're now the only rules with several alternatives.
- **Q6 and Q7:** superseded by Q12; their impact notes no longer apply.
- **Q12, "Traits adjust 2+1":**
  - **Simpler for the Initiate:** one alternative, and a per-count `effectiveRange` instead of a set of allowed alternatives. `hasRoomFor` becomes "below this list's effective maximum". Counters are ordinary ("n of 3", "n of 1–2") under the printed headings, with no alternative labels.
  - **New work:** replacing today's gear hint and limits for governed categories (L31), and an unfired-adjustment hint (L25) so "n of 2" under "pick either two or three" makes sense.
  - **Removing a trigger tradition is the only way to strand picks** (L24).
  - **Types:** the `pickRules` types follow the re-pinned shape.
  - **Net:** F8b drops from 2 to 1.5 days.
- **Q10, "Refuse, as designed":** no extra work. The edit page applies the same `hasRoomFor` limits, so a level-up pick for Natural Attacks or Combat Magic stays disabled (or is refused if forced), like extra moves today. Existing over-limit hunters show L30 on the edit page.
- **Q11 (Skyler's comment; "no label change" is Bowser's reading):** the Initiate's armour category label stays the full paragraph and renders as stored. The Initiate's rule has no labels, so nothing repeats the paragraph.

### 13.19 Open Questions for Skyler

**Both answered 2026-09-13.** Skyler chose an option on each and added no comments. The questions and options are kept as they were shown, ranked by how much the answer changed the work.

**Q8. On the last step, should "Still to finish" update as the player fills things in on that step?** **DECIDED 2026-09-13: A, "Re-check on last step".** On the last step only, re-check shortly after the player stops clicking or typing; every other step keeps Yoshi's rule. Applied in 13.9, L29 and F6.
Yoshi decided the wizard checks what's left only when you move between steps, not on every edit. The last step is where you pick your look, and it's also where the "Still to finish" card sits. So after answering your last look line, the card still says "Look: 1 of 3 lines are unanswered" until you leave the step and come back.
- **A. Re-check on the last step only, shortly after the player stops clicking or typing (recommended; chosen).** Every other step keeps Yoshi's rule. It costs one debounced call on that step and keeps the card truthful where it's read.
- **B. Keep checking only on step changes, and add a "Check again" link to the card.**
- **C. Keep Yoshi's rule exactly.** The card can be out of date on the last step until you move away and back.

**Q9. Should the Mystery wizard also get three small fixes that come with the shared wizard layout?** **DECIDED 2026-09-13: A, "Both wizards".** The Hunter and Mystery wizards both get the scroll, focus and narrow-screen fixes. Applied in 13.3, 13.4, L22, L23, L28 and F4.
The Hunter wizard will share its layout with the Mystery wizard. The plan was for the Mystery wizard to look and behave the same apart from the tracker's "you are here" fix. The shared layout can also:
- jump the left column back to the top when you change step (today it stays scrolled down);
- move keyboard and screen-reader focus to the new step's heading;
- stack into one column on narrow screens (today the 42% column is unusable on a phone).

- **A. Yes, both wizards get them (recommended; chosen).** One layout, one behaviour.
- **B. Hunter wizard only.** The Mystery wizard stays exactly as it is apart from the tracker fix.

**No new questions.** Everything the later updates raised is a proposed default (L24–L33), and the points with Bowser and Yoshi (13.13) are resolved.

---

## 14. Architecture review — Yoshi

**2026-09-14. Review only.** No application code, seed, migration, test or other file was changed. This section and five one-line "see 14.x" pointers elsewhere are the only edits. Sections 0–13 belong to Rosalina, Bowser and Luigi and stay as written. Where I disagree, I say so here, as my own view (14.9).

**Closed out 2026-09-14.** Bowser and Luigi responded to every point, and I checked their changes against my text. All five disagreements are resolved (14.9). Luigi's hint refinement raised one small follow-up, Y16, which Bowser agreed the same day (14.3.6, 12.9). Skyler confirmed the R6 release call (14.6, 14.11).

**The request.** Skyler's words: "Have Yoshi review." The coordinator suggested the focus areas; Skyler didn't. What to cover was my call. Skyler added no reasoning to any decision in this doc except the Q11 comment, so nothing here attributes reasoning to Skyler.

**What I read and checked.**
- This whole doc.
- The full repo tree:
  - `src/api`: contracts, services, repositories, `MotwDbContext`, migrations, seed and exporter, `Program.cs`;
  - the API test project;
  - `src/web`: the hunter and mystery features, `core/` and `shared/`;
  - `Dockerfile` and `railway.toml`.
- Every doc in `docs/hunter-playbooks/`, and `docs/updates/multi-minion-wizard-design.md`.
- `.squad/decisions/README.md` (the index of standing decisions) and the relevant `.squad/decisions/records/` records.
- Both skills: `.squad/skills/angular-wizard-decomposition` and `.claude/skills/hunter-playbook-authoring`.
- I checked claims against the code before agreeing with them (14.2).
- I didn't re-read the PDF. Nothing here depends on printed wording, and Bowser and Luigi already checked 12.9's quotes.

**Withdrawn design.** Nothing in Sections 0–13 reintroduces the hunter advancement / hunter sheet decisions withdrawn on 2026-09-12. Two passages could be misread as doing so, and neither does:
- Step 8 is a content step (look, introductions, history) that also carries the "Still to finish" card. It isn't a separate review step.
- 12.11 Q10's "until hunters record improvements" describes what the app can't do today. It isn't a design for it.

### 14.1 In brief

- **The design holds together.** No finding reverses a decision Skyler made. No two sections contradict each other on anything that changes the build. The check-only endpoint (12.8) still stands after Q8, O1–O4 and Luigi's refinements (14.4).
- **12.9's pick-rule model has the right shape and the right level of generality.** That covers the four tables, enumerated alternatives, per-count adjustments, "omitted means unchanged", and the guarded migration plus seed. Five corrections and one added test, none of which changes the contract Luigi builds against (14.3):
  - validating rules that a save keeps can't happen where 12.9 puts it;
  - "a target once per alternative" can be a plain unique index;
  - four more graph checks;
  - counts and triggers need a fixed order on the wire, or the seed re-export won't be byte-identical;
  - server messages and client hints hard-code the Initiate's "Sect traditions" in a mechanism meant to be data-driven;
  - Cascade stays, but a test has to prove a rule can't be lost silently. One existing two-path hunter delete also needs a Postgres check.
- **O2 doesn't fully close the ordering gap in the parity test.** `HunterCompleteness` has two more sources of unstable order today, both confirmed in code and seed (14.4).
- **Frontend and backend ship as one image, and migrations run at startup.** So "F8b/F8c can follow 12.9" means a live period where the form offers picks the server refuses. I've grouped the work into seven releases, and 12.9's backend ships in the same release as the client limits (14.6). **Confirmed by Skyler, 2026-09-14: "Ship together in R6".**
- **Frontend structure: I agree** with `HunterDraft`, the shared sections and the F4 extraction. F2 and F4 each ship alone (14.5).
- **Standing records need updates.** `HunterDraft` owning a `FormGroup` contradicts `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` (2026-07-21), not just the skill doc Luigi cites, and that has to be written down. The pick-rule schema belongs in `architecture.md` Section 6 once it's built (14.7, 14.8).
- **No open questions for Skyler.** One call of mine had a cost players can see: holding 12.9's backend for R6. The coordinator put it to Skyler, who confirmed it on 2026-09-14 (14.11).
- **Close-out, 2026-09-14:**
  - Bowser and Luigi agreed with every point that concerned them, and all five disagreements are resolved (14.9).
  - The one follow-up, Y16, is resolved. The card line and L25's hint now add "This depends on your {section title} picks." under the same condition, and Bowser applied it in 12.9 (14.3.6).

### 14.2 Claims checked against the code

| Claim | Verdict |
|---|---|
| 12.9, 13.16: F8a, F8b and F8c can ship "with the 12.9 deploy or after it" | **The frontend and backend don't deploy separately.** `Dockerfile` stage 1 builds the web app into the API's `wwwroot`, and stage 2 publishes both as one image. At startup, `Program.cs:194` calls `MotwDbInitializer.cs:14`, which runs `MigrateAsync`. So merge order is deploy order, and a migration ships with whatever frontend is on `main`. See 14.6. |
| 12.9: "Graph validation checks the rules that will exist after the save, whether sent or kept" | **It can't run where 12.9 puts it.** `ValidateGraph(request)` runs before the stored playbook loads (`PlaybookService.cs:55-61`), so under S9 it never sees kept rules. The existing checks against stored state live in `CheckRemovedChildrenAreUnusedAsync`, which runs after the load and returns **409**, not 400 (`:72-76`). See 14.3.1. |
| 12.9: all rule FKs Cascade, "so deleting a playbook can't trip on cascade order" | **Right conclusion. The precedents need care.** Playbook delete is a single `ExecuteDeleteAsync` statement (`PlaybookRepository.cs:122-125`), and it reaches trigger and count rows by two routes: through rules, and through sections and options or gear categories. The two existing NoAction FKs don't show a non-cascade FK is safe there. The options' self-reference is removed in one statement (`MotwDbContext.cs:709-720`). `hunter_bespoke_selections.section_instance_id` is NoAction for a different reason, "a provider can reject" a second cascade path (`:897-902`). See 14.3.2. |
| 12.9: check constraints that work on both Postgres and SQLite | **Correct.** Every playbook, bespoke and hunter column is mapped with an explicit snake_case `HasColumnName`. So the SQL names match in Postgres and in the SQLite schema the tests build with `EnsureCreatedAsync`. The model has no check constraints yet, so these will be the first. |
| 12.9: guarded data migration keyed on stable ids | **Holds, and has precedent.** `ExtractMinionsToOwnTable` already uses `migrationBuilder.Sql`. `PlaybookSeed.ToEntity` keeps ids. `MigrateAsync` runs before `PlaybookSeed.ApplyAsync`, and the `AnyAsync` guard stops the seed touching a migrated database. |
| 12.9: "a second re-export should come back byte-identical" | **Only if counts and triggers have a fixed order.** `ToDetailResponse` orders every collection by `SortOrder` (`PlaybookService.cs:799-869`), and `PlaybookSeedTests` compares the serialized JSON exactly (`:56`, `:208`). Counts have no `SortOrder` and triggers are a set, so they come back in whatever order the database returns. See 14.3.5. |
| 12.8.1 O2: sorting repeatable entries by `SortOrder` makes the check's and Create's messages match | **Needed, but not enough.** Two more sources of unstable order (14.4):<br>• `Shortfalls` yields category lines by iterating the `engaged` `HashSet` (`HunterCompleteness.cs:192`). Its order follows the picked ids: request order in Evaluate, database order after Create.<br>• `EvaluateBespoke` orders move-internal sections by `SortOrder` alone (`:118`), and the seed has ties. The Crooked (Artifact, Deal with the Devil), The Searcher (First Encounter, Guardian, Network) and The Spell-Slinger (Tools and Techniques, Arcane Reputation) all sit at 0, so their order comes from an unordered split query. |
| 12.8: Create and Evaluate share one build step; unsaved entries don't merge | **Correct.** Hunter entities assign their own `Guid.NewGuid()`. For a new hunter, `ApplyPicks`' repository `Remove*` calls get empty lists, so building in memory tracks nothing. |
| 13.5: a `FormGroup` inside `HunterDraft`, because "the code has moved past" the skill doc | **It also contradicts a standing decision the section doesn't cite:** `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` 2026-07-21, "ReactiveForm instances stay in phase components" (`:26-29`). That's in addition to `SKILL.md:29`. See 14.5 and 14.7. |
| 13.11, L9: an `HttpContextToken` that suppresses `httpErrorInterceptor`'s toast | **Consistent** with `luigi-interceptor-order-error-direction.md` (2026-08-18). Interceptor order is unchanged, and the 401 path is untouched. |
| 12.8: the app-wide sign-in requirement covers the check | **Correct.** Hunters have no owner column, so the endpoint exposes nothing across users. |

### 14.3 Pick rules (12.9) as architecture

**Where I agree, and why.**
- **Tables, not a JSON column.** Targets and triggers point at template rows that hunters live-link to, and the Id-based diff exists to protect those rows. A JSON column would move every reference check into hand-written code, with no referential integrity from the database.
- **Enumerated alternatives, not "a range per target plus a group total".** I checked that smaller shape, and it does express all three rules:
  - Natural Attacks: total 2, Base 1–2, Extra 0–1.
  - Combat Magic: total 3, Bases 1–3, Effects 0–2.

  It saves one table, but it can't express a set with gaps (the pre-Q12 Initiate reading, 3 + 0 or 0 + 2, was one). And "Option 1 / Option 2" is how the sheets print these rules and how a future editor would show them. Keep 12.9's shape.
- **A per-count adjustment** is the smallest thing that can state Q12 without listing every combination of trigger groups. It also keeps 12.8's rule that everything resolves from picked ids with no priority rules.
- **S3 and S9 (the admin form omits `pickRules`, and omitted means unchanged).** This is a deliberate exception to "null means empty", and it's the right one: counts are replaced wholesale, so echoing them back risks corrupting a rule silently. It only holds if kept rules are validated (14.3.1).
- **Guarded migration plus seed re-export, one guard per playbook.** Right for three fixed rules.
- **Room for a rule editor later: yes.** An editor inherits two constraints, and neither needs a schema change:
  - Rules reference saved rows, so rules are authored against a saved playbook.
  - Alternatives are sent whole, since counts have no ids.

  What an editor would add is validation messages addressed to a specific rule or alternative instead of plain strings. That's additive.

**14.3.1 Validate kept rules after the playbook loads, against the request's children.** Under S9, a save without `pickRules` keeps rules that `ValidateGraph(request)` never sees. So one pass runs after `GetForUpdateAsync`, over the request's children and the rules that will exist (sent or kept). It catches:
- a target or trigger removed;
- a governed category's `PickCount` or `MaxSelect` lowered below a rule's range;
- a trigger that stops being a leaf, or moves into a repeatable or move-internal section;
- a new top-level option in a governed section, which the rule's dividers then no longer cover.

Status codes:
- A problem in *sent* rules is a 400, like the rest of `ValidateGraph`.
- A conflict between the request and *kept* rules is a **409** naming the rule, like `CheckRemovedChildrenAreUnusedAsync`. That method already builds kept-id sets for bespoke sections, options and journals (`:205-223`), though its summary says they "stay freely removable" (`:130-133`). Fix the summary while extending it.

Includes:
- `GetForUpdateAsync`, `GetPlaybookForValidationAsync` and `BuildFullGraph` each need the rule includes.
- Three separate include lists can drift apart. 12.9's test "through the 12.8 check, from the real seed" is what catches a missing include on the validation query, so it has to use seeded playbooks, not fixtures.

*Resolved 2026-09-14: Bowser agrees; see 12.9 ("Kept rules are validated after the stored playbook loads", S11).*

**14.3.2 Keep Cascade on every rule FK. Guard against losing a rule with a test, not a foreign key.** I considered NoAction for the three FKs that point into template rows: count to gear category, count to bespoke option, trigger to bespoke option. It would have been a database-level guard against a save silently deleting part of a rule. I rejected it for two reasons:
- Playbook delete reaches those rows by two routes in one statement (14.2).
- Postgres implements both referential actions and FK checks as internal triggers. I haven't verified that a NoAction check on an option always fires after the other route has deleted the trigger rows. Cascade doesn't depend on that order, which is 12.9's point.

The cost of Cascade: if 14.3.1's check ever missed a case, an admin save that removed a referenced option would silently delete trigger or count rows. A lost trigger pins the Initiate at 2 + 1. A lost count leaves an alternative missing a target, which 12.9's evaluation doesn't define. So the guard is a test in `PlaybookServiceTests`, for each of the three playbooks:
- save with `pickRules` omitted and a governed target removed;
- save with `pickRules` omitted and a trigger removed;
- assert a 409, and that the rule rows are unchanged.

**A related, existing risk I found (not caused by this design).** Hunter delete is also a single `ExecuteDeleteAsync` (`HunterRepository.cs:92-93`). It reaches `hunter_bespoke_selections` by two routes, with the NoAction instance FK between them. The SQLite suite can't show how Postgres orders that. Add one case to R6's manual Postgres pass: delete a Hex hunter that has a Rotes entry with picks. The wizard will create exactly those hunters.

**14.3.3 "A target once per alternative" is two plain unique indexes:** `(alternative_id, gear_category_id)` and `(alternative_id, bespoke_option_id)`. Postgres and SQLite both treat NULLs as distinct in unique indexes. So neither index needs a filter, and the rule stays provider-neutral, as 12.9 wanted. `PlaybookService` still reports duplicates first, with a readable message; the index is the backstop.

**14.3.4 Four more graph checks,** run on sent and kept rules (14.3.1):
- a rule has at least one alternative and at least one target;
- a target is governed by at most one rule, and a bespoke section by at most one rule. Two rules on one target would make both the ceiling and the reported minimum ambiguous.
- a gear target has a non-null `PickCount`. Null means granted outright, and B6 never stores those ids, so a rule on such a category could never be met.
- a gear target isn't `IsOptional`. The rule's `minCount` sets the minimum, and an optional flag beside it would contradict it.

The Initiate's two weapons categories pass all four.

**14.3.5 A fixed wire order for counts and triggers.**
- Counts within an alternative: by their target's own `SortOrder` (gear category or bespoke option), then target id.
- `triggerOptionIds`: by option `SortOrder`, then id.
- `ToDetailResponse` applies both orders. Then the admin summary, Luigi's lookup, the seed file and `PlaybookSeedTests` all see the same order, and the byte-identical re-export check no longer depends on database row order.

**14.3.6 No playbook-specific wording in the mechanism.** These all name the Initiate's section and categories in code:
- 12.9 step 3's refusal: "Your Sect's traditions need Fighting arts or Obsolete gear for 3.";
- 12.9 step 4's suffix: "This depends on your Sect traditions.";
- L25's matching hint.

Build them from data instead: the trigger options' titles and their section's title. For example, `Fighting arts or Obsolete gear (Sect) allow 3.` and `This depends on your Sect picks.` Bowser and Luigi own the exact wording. The rule is that no playbook name or section noun is hard-coded, so a rule authored through the admin screen reads correctly without a code change.

*Resolved 2026-09-14 for the server messages: Bowser agrees; see 12.9 steps 3–4 and S12. L25's hint is Luigi's.*

*Resolved 2026-09-14: Luigi agrees; see 13.17 (L25, L30, L33) and 13.13.*

**Close-out gap: Luigi's hint condition versus 12.9 step 4 (2026-09-14).**
- **Luigi's refinement (L25).** The hint adds "This depends on your {section title} picks." when the adjustment's trigger section has no picks at all, instead of reading the last check. His reason holds: the edit page never calls the check (Y14), and R6 ships the hint before the wizard exists. It doesn't conflict with 12.8. It's a lookup on picked ids, the same kind as trigger matching, not a completeness rule, and it never sets a mark.
- **The gap.** 12.9 step 4 adds the same sentence to the "Still to finish" line under a different condition: "the trigger's section still has shortfalls". The two disagree whenever that section is partly answered. For example, a Sect with only one non-trigger Good tradition shows the sentence in "Still to finish" but not under the weapons list. That's one gap phrased two ways, which is what 7.3 set out to avoid.
- **Resolution (Y16): the server adopts the client's condition.** The client can't adopt the server's without computing section completeness in TypeScript, which 12.8 exists to avoid. Nothing useful is lost: while no trigger is picked, the unfired-adjustment hint and the refusal suffix already name the triggers. It also stops a gear line in `HunterCompleteness` depending on another section's shortfalls.
- *Resolved 2026-09-14: Bowser agrees. 12.9 step 4 and its tests now use this condition, including a test with a partly answered Sect.*

**14.3.7 Delivering the migration.**
- **One commit** carries the migration, the `ToEntity` mapping, the fixture update and the re-exported seed. On a fresh database the guarded inserts find nothing, so a seed without rules would leave that environment without them, and nothing would report an error.
- **The guard skips silently by design.** Add a post-deploy query to the release notes: each of the three playbooks that exists has exactly one rule. Then a skip in production gets noticed right away.
- **`AddPickRules` is the only migration anywhere in this plan.** B1, B4 and 12.8 change no schema, so migrations can't conflict on order. Generate it on top of `main` at merge time.
- **Rolling back the image after the migration has run is safe.** The migration only adds tables, and the previous image simply doesn't read them.

### 14.4 The check-only endpoint (12.8) after Q8 and the refinements

**It still holds.** Q8 only changes when the check runs on step 8. The contract and the reason the endpoint exists, keeping one copy of the rules, are unchanged. O3 shows the extra load is small and read-only.

- **O1, settled as L5 (a refusal downgrades marks; loading and failed keep the last clean marks): agree.** It follows from "a refusal returns no unfinished list". A refusal means the draft states something false, and a green mark beside it would contradict that.
- **L7 (the band links to the governed step when the client lookup finds a pick-rule violation; otherwise it offers Reload playbook): agree, with a limit.**
  - The lookup only chooses a link. It never sets a mark or clears a pick, so a wrong guess costs one misdirected link.
  - If more kinds of refusal need routing later, add structured fields (area, section, category) to `HunterEvaluationResponse` instead of growing the client's guesswork. That's additive, and B5 is unaffected.
- **O2, extended.** `HunterCompleteness` needs a full, deterministic order, applied as part of extracting the shared build:
  - playbook-level sections by `SortOrder`, then id;
  - move-internal sections by their move's order (`IsAdvanced`, then `SortOrder`, as `ToDetailResponse` orders moves), then section `SortOrder`, then id;
  - category lines within a section by option `SortOrder`, then id, not by `HashSet` iteration order;
  - repeatable entries by `SortOrder`, then id (O2).

  The parity test then needs builds that exercise each rule: two short categories in one section (Fate), and The Searcher with answers under two move sections. This is also what L6's "stable order across checks" relies on.
  - *Resolved 2026-09-14: Bowser agrees; see 12.8.1 O2.*
- **O3 (pass the cancellation token, no per-call logging): agree.**
- **Ordering and cancellation (13.9): agree.** One latest-wins stream, a request snapshot taken at trigger time, and an empty stream treated as a failure.
- **Shared build step: agree.** The missing-playbook refusal text belongs inside it too, so Create and Evaluate can't word it differently.
- **One boundary, written down so nobody "fixes" it by accident:** the edit page doesn't call the check (7.7). Its "Still to finish" card keeps refreshing on save, as it does today.

### 14.5 Frontend structure

- **`HunterDraft` (F2): agree with the shape, including the `FormGroup` inside it.**
  - The 2026-07-21 rule (forms stay in phase components) and `SKILL.md:29` both exist to stop form state leaking between sibling steps in a multi-phase wizard. This hunter draft is submitted once and shared by one surface's sections, so there are no siblings for state to leak into.
  - That makes it a justified exception. It still contradicts two standing records, so it has to be written down there (14.8).
  - Luigi's rule to read the scalars through a `getRawValue` signal is the part that matters most. It's the `isRatingUnchosen` trap, generalised.

  **Proposed default Y10: F2 ships alone, and gets a second check on what the server stored.** The characterisation spec checks the request the client builds. The risk in F2 is the client silently dropping a field, which the server would then delete. So, before and after F2, save a fully populated hunter through the edit page and diff the two `GET /api/hunters/{id}` responses. Use:
  - The Hex, with Rotes entries;
  - The Curse-Eater, with a journal entry and a Corruption value;
  - The Forged, with a freeform look.
- **Shared sections (F3): agree.** L16 makes F3 a visible change on the edit page (the ratings grid and the History retitle), so it isn't a no-op. Say so in its release note.
- **Tracker and shell (F4): agree,** including the icon passed in as a template, and "current" driven by `currentIndex`. **Proposed default Y11:** F4 ships alone, before F5, so any Mystery regression traces to F4 and not to the Hunter wizard.
- **`hunter-pick-rules.ts`: agree.** It's the one deliberate client copy of the rules, and 12.8 limits it to disabling options and hints, never marks. 13.15 item 3 tests it from 12.9's own tables, so both copies are checked against the same rows.
- **Session expiry (L11) and `canceledNavigationResolution: 'computed'`: agree.** The router setting is app-wide, but no route cancels navigation today.

*Resolved 2026-09-14: Luigi agrees; see 13.5 (the form-in-draft supersession), 13.15 item 1 (Y10) and 13.16 (Y11).*

### 14.6 Sequencing and deploys

The image carries both halves and runs migrations at startup, so what matters is which release a change ships in, not its phase. My grouping, with Bowser's and Luigi's phases slotted in:

| Release | Contents | After | Before deploying | Notes |
|---|---|---|---|---|
| **R1** Move count | B1, B3, F0 | — | B2 audit | No migration. A hunter over its move budget is refused on its next save until picks are removed (§9's "fixable by removing"). *Superseded 2026-09-14: hunters are wiped before R1, so B2 is now that wipe and no hunter can be over budget; see the stakeholder note at the top and 12.6 B2.* |
| **R2** Live form fixes | F1, B4, B9 | R1 (same file) | — | No migration. |
| **R3** Shared wizard shell (Mysteries) | F4 | — | Mystery check in both themes, desktop and 375px | Visible Mystery changes by design (Q9). Can ship any time before R7; earlier is better. |
| **R4** Draft extraction | F2 alone | R2 | Characterisation spec green | Stored-state diff afterwards (Y10). |
| **R5** Shared sections and the check endpoint | F3; 12.8 backend (shared build, structured items, full ordering) | R4 | — | The endpoint goes live unused until R7, so F6 builds against real code. |
| **R6** Pick rules, end to end | 12.9 backend (`AddPickRules`, services, contract, re-exported seed); F8a; F8b and F8c on the shared sections, without the wizard's band links | R5 | S7 audit *(superseded 2026-09-14: no audit; see the stakeholder note at the top and 12.9 S7)* | The edit page and the still-live single-page create get the limits in the same deploy as the server rule. Afterwards: the post-deploy rule query (14.3.7), plus the manual Postgres pass with the hunter-delete case (14.3.2). |
| **R7** Hunter wizard | F5; F6, which now includes the pick-rule band links and L24's Go to Gear link (Luigi moved them from F8b and F8c); F7; F9 | R3, R6 | — | Replaces `/hunters/new`. |

**Why R6 bundles 12.9 with the client limits. This is where I disagreed with 12.9's and 13.16's "or after".**
- If 12.9's backend deploys first, the live forms (the single-page create and the edit page) keep their stored caps. They offer Natural Attacks 2 + 1, Combat Magic up to 3 + 3 and an Initiate at 3 + 2, and the server refuses each of those on save.
- 13.16 described that as "only the in-form limits and hints lag". In practice, saves fail after the player has built the hunter.
- Holding 12.9 costs the time of R4 and R5. The misreport it fixes has been live since 2026-08-31, and the hunter page is its only reader.
- *Resolved 2026-09-14: Bowser agrees (12.9 S10). Luigi agrees, and 13.16 now follows R1–R7.*
- **Confirmed by Skyler, 2026-09-14.** The coordinator put this call to Skyler, who chose "Ship together in R6" with no comment.
  - **Chosen, option text as shown:** "Yoshi's call. Corrected reports arrive later, but the live form never offers picks the server then refuses on save."
  - **Not chosen, "Backend first", as the coordinator described it:** corrected reports about 7 working days sooner, but until the frontend follows, the current hunter form can offer Initiate, Natural Attacks and Combat Magic picks that the server refuses on save.
  - The reasoning above is mine; Skyler added none.

**Other couplings, none of them blocking:**
- Admin tabs left open across R6 are covered by S9.
- Edit-page tabs left open across R1 or R6 get the server's refusal message on save. That's acceptable, and unavoidable without versioned bundles.
- 12.8's contract doesn't change in R6. Only the `Outstanding` text for affected hunters does.
- Every release only adds to the database, so rolling back to the previous image is safe.

### 14.7 Consistency with standing records

- **`architecture.md` Section 8 (single-page form, wizard rejected).** Reversed on the UX half only, and this doc says so up front, in the "What this supersedes" paragraph under the status. Section 8's argument was that a wizard exists to sequence saves phase by phase. That's still right, and this wizard saves once, so reversing the UX doesn't reopen how hunters are saved. Its item 3, "excludes them from the `MoveGrantCount` tally", is the Gap 1 reading and changes with R1.
- **`architecture.md` Section 9 and the 2026-08-31 completeness decision: consistent.**
  - The check endpoint applies that decision's compute-don't-store rule before a save instead of after.
  - Pick rules pass its "fixable by removing" test: every refusal is on a maximum, and zero picks fits every alternative.
  - Q10 adds a boundary the section should state: correctness is judged against creation-time limits until the app records improvements. That describes today; it isn't a design.
- **2026-08-25, basic moves in the database, versus Q4's fixed text: not a silent contradiction.** Q4's option B named that decision, and Skyler chose A. Nothing to do now. Bowser's note (move the sentences into the database once basic moves are exposed) is the right moment to revisit.
- **The 2026-08-29 Combat Magic record, and the 2026-08-28 Natural Attacks catalogue call: 12.9 carries them out rather than reversing them.**
  - The Combat Magic record kept Skyler's nested categories. It said whoever builds validation "needs to enforce the total-and-floor constraint explicitly".
  - The categories stay (S8), and the constraint is now enforced. Only their "unenforced" status changes.
- **`.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` (2026-07-21 decomposition entry) and `angular-wizard-decomposition/SKILL.md`: contradicted** by `HunterDraft`'s `FormGroup` (14.5). Record it as a supersession limited to this case: a draft that is submitted once may own its form.
- **2026-08-18 interceptor order:** consistent with L9.
- **The 2026-08-29 convention that `architecture.md` Section 6 is the authoritative schema** (`README.md`). 12.9's tables are schema. When R6 is built they move into a new Section 6 subsection, and 12.9 stays as the reasoning record. That's the same split `phase5-bespoke-ideation.md` already has with Section 6.

### 14.8 Docs to update when this lands

| Doc | Change | Release |
|---|---|---|
| `docs/hunter-playbooks/architecture.md` | §2 and §8 item 3: `MoveGrantCount` is the total | R1 |
| | §9: the check endpoint, structured items, pick rules in both tiers, the Q10 boundary | R5, R6 |
| | New §6 subsection: the pick-rule schema (14.7) | R6 |
| | §8: dated note that create is now the wizard, and edit stays the form | R7 |
| `docs/hunter-playbooks/phases.md` | • A cross-cutting entry for the wizard, covering R1–R7<br>• "Hunter completeness" gains the check endpoint and structured items<br>• Phase 10 notes that the create page was replaced<br>• Follow-on 10b notes that Natural Attacks and Combat Magic are now enforced | R1 onward |
| `docs/hunter-playbooks/README.md` | The status line (still at Phases 1–7), and the doc index, which doesn't list `hunter-creation-wizard.md` | now |
| `docs/hunter-playbooks/bespoke-ruleset-catalogue.md` | The Initiate (gear, Sect), The Monstrous (Natural Attacks) and The Spell-Slinger (Combat Magic): now enforced by pick rules, pointing to the new Section 6 subsection | R6 |
| `.claude/skills/hunter-playbook-authoring/SKILL.md`, `scripts/verify.mjs` | How to author pick rules (a second save, against saved ids), and known-artifact checks for the three rules | R6 |
| `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` (2026-07-21 decomposition), `.squad/skills/angular-wizard-decomposition/SKILL.md` | A limited supersession: a draft submitted once may own its form | R4 |
| `.squad/decisions/records/yoshi-hunter-playbooks-hunter-completeness-partial-saves.md` | Dated update: the check endpoint, structured items, pick rules | R5 |
| `.squad/decisions/records/yoshi-hunter-playbooks-spell-slinger-combat-magic-pick-shape.md` | Dated note: the constraint is now enforced (Q5) | R6 |
| `.squad/decisions/records/luigi-theming-phase6-mystery-wizard.md` §6 | The tracker precedence bug is fixed | R3 |
| `docs/updates/multi-minion-wizard-design.md` | Its layout constraints table (a 42% column at every width) no longer holds below `md` | R3 |
| This doc | The status line, once it's built | R7 |

Code comments that describe the old behaviour are updated in the same change as the code, not as separate doc work:
- the `hunter-form.ts` header (Section 8 "rejected a wizard"; `:35-36`);
- `HunterService`'s move-count comment;
- the `PlaybookMove.Required` and `Hunter.Background` doc comments;
- the `HunterCompleteness` header;
- `PlaybookService.cs:130-133`.

### 14.9 Where I disagree

These are all my positions. The last column records how each was resolved. I checked every resolution against my text on 2026-09-14.

| With | Point | My position | Resolution (2026-09-14) |
|---|---|---|---|
| Bowser (12.9) and Luigi (13.16) | 12.9's backend can deploy before F8b and F8c | Ship them in the same release (R6), because one image carries both halves (14.6) | **Resolved.** Bowser's S10; 13.16 now follows R1–R7. Confirmed by Skyler: "Ship together in R6". |
| Bowser (12.9) | Kept rules are checked in graph validation, with a 400 | Check after the load, against sent or kept rules; a conflict with kept rules is a 409 (14.3.1) | **Resolved.** S11 and 12.9's "Kept rules are validated after the stored playbook loads" carry the same four catches, the 400/409 split, the three includes and the summary fix. |
| Bowser (12.8.1 O2) | Sorting repeatable entries closes the ordering gap in the parity test | There are two more sources; `HunterCompleteness` needs a full, deterministic order (14.4) | **Resolved.** O2 now applies Y8's order, and the parity builds cover Fate and The Searcher. |
| Bowser (12.9 steps 3–4) and Luigi (L25) | The "Sect traditions" wording | Build it from the trigger and section titles (14.3.6) | **Resolved.** Server messages are built from data (S12). So are client hints and notices, with a renamed-titles spec (L25, L30, L33). The one condition mismatch this turned up is closed by Y16, which Bowser applied in 12.9. |
| Luigi (13.5) | Cites only the skill doc for the form-in-draft exception | It also supersedes `.squad/decisions/records/luigi-mystery-create-wizard-2026-07-21-decisions-md.md` 2026-07-21. No design change (14.5) | **Resolved.** 13.5 cites both records, and the supersession is written into them in R4. |

**Agreed, not disagreements:**
- Bowser's adoption of Y4–Y7 and Y12 in 12.9, as written;
- Luigi's L25 hint condition (it fires when the trigger section has no picks), with Y16 bringing the server into line;
- Luigi's extension of L9's toast token to the admin playbook save and delete. Both handlers already show the server's message with a fallback (`playbook-admin.ts:86-90`, `:118-122`), so each failure still produces exactly one toast;
- 12.9's all-Cascade FKs, with the test in 14.3.2 as the guard;
- L5, L6, L7 (with 14.4's limit) and L11;
- O1, O3 and O4;
- S1–S9, apart from the points above;
- Q8's debounce;
- the risk ratings for F2 and F4.

### 14.10 Proposed defaults (architecture): decided here, not questions

- **Y1.** Seven releases, R1–R7, grouped and ordered as in 14.6.
- **Y2.** 12.9's backend ships in the same release (R6) as F8a, and as F8b and F8c on the shared sections. The wizard-only band links ship with R7.
- **Y3.** Pick rules that will exist after a save, whether sent or kept, are validated after the stored playbook loads, against the request's children.
  - A problem in sent rules is a 400.
  - A conflict with kept rules is a 409 that names the rule.
  - `GetForUpdateAsync`, `GetPlaybookForValidationAsync` and `BuildFullGraph` all include the rules.
- **Y4.** Rule FKs stay Cascade, as in 12.9. `PlaybookServiceTests` covers each of the three playbooks: a save that removes a governed target or a trigger, with `pickRules` omitted, is refused with a 409 and leaves the rule rows unchanged. R6's manual Postgres pass also deletes a Hex hunter with a picked Rotes entry.
- **Y5.** Unique indexes on `(alternative_id, gear_category_id)` and `(alternative_id, bespoke_option_id)`.
- **Y6.** Graph checks:
  - at least one alternative and one target per rule;
  - at most one rule per target, and per section;
  - gear targets have a non-null `PickCount` and aren't `IsOptional`.
- **Y7.** `ToDetailResponse` orders counts by their target's `SortOrder` then id, and triggers by option `SortOrder` then id.
- **Y8.** `HunterCompleteness` applies a full, deterministic order:
  - sections: playbook-level first, then by move order, then section `SortOrder`, then id;
  - category lines: option `SortOrder`, then id;
  - repeatable entries: `SortOrder`, then id.

  The parity test covers multi-category shortfalls like Fate's, and The Searcher's move sections.
- **Y9.** No playbook or section names in pick-rule messages or hints. They come from trigger and section titles.
- **Y10.** F2 ships alone. It's verified by the characterisation spec, plus a before/after `GET` diff of three fully populated hunters (14.5).
- **Y11.** F4 ships alone, before F5.
- **Y12.** `AddPickRules`, the `ToEntity` mapping, the fixtures and the re-exported seed go in one commit. A post-deploy query confirms each of the three playbooks that exists has its rule.
- **Y13.** Routing a refusal to a step stays a client-side link choice (L7). If that grows, structured refusal fields are added to `HunterEvaluationResponse`.
- **Y14.** The edit page doesn't call the check. Its "Still to finish" card keeps refreshing on save.
- **Y15.** When R6 is built, the pick-rule schema moves into `architecture.md` Section 6, and 12.9 stays as the reasoning record.
- **Y16 (close-out, 2026-09-14).** Both sides add "This depends on your {section title} picks." under one condition: the adjustment hasn't fired, and its trigger section has no section-level picks. 12.9 step 4 uses this condition in place of "the trigger's section still has shortfalls", matching L25 (14.3.6).
  - *Resolved 2026-09-14: Bowser agrees; see 12.9.*

### 14.11 Open Questions for Skyler

**None open.** Everything above falls within Skyler's decisions (Section 10; 12.7 and 12.10–12.13; 13.19) and within the technical calls the team makes itself.

**Decided 2026-09-14: release timing for the pick rules (Y2).**
- I made this call as a technical default. It has a cost players can see, so the coordinator put it to Skyler.
- **Skyler chose "Ship together in R6"**, with no comment.
  - **Chosen, option text as shown:** "Yoshi's call. Corrected reports arrive later, but the live form never offers picks the server then refuses on save."
  - **Not chosen, "Backend first", as the coordinator described it:** corrected reports about 7 working days sooner, but until the frontend follows, the current hunter form can offer Initiate, Natural Attacks and Combat Magic picks that the server refuses on save.
- The delay is about 7 working days of frontend work: F2, F3 and F8a–F8c, by Luigi's estimates.
- The reasoning is mine (14.6); Skyler added none.

---

## Cross-references

- `architecture.md` Section 8 (the single-page recommendation this reverses on UX only), Section 9 (partial saves, still in force), Sections 6.1–6.8 (the bespoke shapes step 4 renders).
- `phases.md` Phase 10, Follow-on 10a/10b (what the current form renders and why), Phase 8 (the verification the seed carries).
- `bespoke-ruleset-catalogue.md` (per-playbook rules content; Underworld, Heat, Curse-Eater quoted above).
- `docs/updates/multi-minion-wizard-design.md` (the wizard's layout constraints and the selected-card / sunken-panel vocabulary reused here).
- `.squad/decisions/records/luigi-theming-phase6-mystery-wizard.md` §6 (the tracker precedence bug).
