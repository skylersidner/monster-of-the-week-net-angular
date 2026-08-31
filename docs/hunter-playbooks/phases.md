# Hunter Playbooks — Phases

Numbering matched Skyler's own brief as a baseline through the original Phase 9. **Renumbered 2026-08-29**: a new phase for custom-move modeling is inserted between bespoke rulesets and the first playbook-import phase, per Skyler's explicit request ("just like we did for the bespoke rulesets, to ensure the work is done"). Old Phases 6–9 are now **7–10** — every cross-reference to those phase numbers across `docs/hunter-playbooks/` has been updated accordingly, read and corrected in context rather than blind find-replace. The dependency chain (Admin UI shell → data model → CRUD UI → real data → bespoke rules → custom moves → more real data → remaining playbooks → Hunter list → Hunter create/edit) still sequences correctly with the insertion. Phases 1–4 and 9–10 are fully specified below. Phase 5's **design** is fully specified (`architecture.md` Section 6, validated against all 28 playbooks) — its **implementation**, Phase 6's entire scope (not yet designed at all — see its own note), and Phases 7–8's implementation all remain deferred (see each phase's note).

**Revised 2026-08-30 — implementation opened, and Skyler answered seven questions raised from reading these docs cold.** Work on Phases 1–4 began this day. Changes made across this file and `architecture.md` as a result, each recorded in place at the phase it affects:

- **Phase 4 re-scoped: Moves are out entirely**, moved to Phase 6 along with the formatting-fidelity gate and the dual-column extraction quirk. Skyler identified this as fallout from the 2026-08-29 renumber. Three knock-on effects: the Crooked sequencing flag closes with no action, Phase 4 needs no formatting-preserving extraction at all, and Phase 6's scope grows from "Move-internal picks" to "the whole Moves section."
- **Three new `Playbook` fields** — `GettingStartedText`, `IntroductionsText`, `LevelingUpText` — reversing `architecture.md` Section 2's original exclusion of Introductions/Leveling Up and adding Getting Started, which had never been considered.
- **`PUT` upsert semantics specified** (Phase 3) — Id-based diff, an unspecified gap rather than a deferred call, with a real frontend requirement attached.
- **Phase 2's migration stays standard-tables-only**, as originally written; Phase 5/6's tables ship separately even though their design is now settled.
- **`MoveGrantCount` stays non-nullable at `0`** through Phases 4–5, with the ambiguity that creates stated explicitly.
- **The Q10 Skill is confirmed**, with its location decided against Skyler's initial lean for three concrete mechanical reasons (Phase 4).
- **Testing is a deliberate post-implementation step**, not per-phase — see the closing section of this file.

## Phase 1 — Data Admin restructuring (fully specified)

**What**: Add a tab layer to `pages/data-admin/`. Two tabs: **Types** (today's entire dropdown-driven page, unchanged in behavior) and **Playbooks** (new, placeholder content).

**Files touched**:
- `data-admin.ts`/`.html` — add a tab-selection signal (matching `page-layout.ts`'s existing `isShowingUserMenu`/`isShowingMobileMenu` boolean-signal convention), wrap existing content under the Types tab, add an empty/placeholder block under the Playbooks tab.
- No backend changes.
- No new routes — tabs are client-side state on the existing `/data-admin` route, per `architecture.md` Section 5's reasoning.

**Risk**: low. Existing behavior under the Types tab must not regress — the existing `weapon-tag-admin.spec.ts`/`data-admin.spec.ts` tests should still pass unchanged if the wrap is done as a pure structural nesting.

## Phase 2 — Standard-vs-bespoke data model (fully specified)

**What**: The schema in `architecture.md` Section 3 — `Playbook` + `PlaybookStatArrayOption`/`PlaybookMove`/`PlaybookGearCategory`→`PlaybookGearOption`/`PlaybookLookCategory`→`PlaybookLookOption`/`PlaybookImprovement`/`BasicMove` (resolved 2026-08-25: a real reference table, not optional — Skyler expects to tweak its content over time). One EF Core migration, following the existing `Data/Migrations/` convention.

**Deliverable of this phase is the schema + entity classes + migration only** — no controller/service/repository yet (that's Phase 3, matching the existing per-domain layering: `Data/Entities` → `Repositories` → `Services` → `Controllers` → `Contracts`, same as every other domain in this app).

**Explicit scope note, corrected 2026-08-29 — no placeholder column ships this phase.** An earlier version of this phase shipped `Playbook.UniqueMechanicText` as a nullable, unused placeholder column (the "add a predictably-needed field early as always-null" pattern, matching `snippet` in the search feature), on the assumption Phase 5's eventual shape was unknown. **That assumption no longer holds** — Phase 5's real schema (`BespokeSection`/`BespokeOption`/`BespokeJournal`/`PlaybookExtraTrack`, `architecture.md` Section 6) is now fully specified and validated against all 28 playbooks, and it's a set of new, additive tables with their own `PlaybookId` FK, not a single column on `Playbook` — there was never going to be anything to place a value into on `Playbook` itself. `UniqueMechanicText` has been removed from Phase 2's scope and from `architecture.md`'s `Playbook` entity entirely; Phase 5's tables ship via their own migration when Phase 5 is implemented, with nothing for Phase 2 to anticipate.

**Three fields added, 2026-08-30**: `Playbook.GettingStartedText`, `Playbook.IntroductionsText`, `Playbook.LevelingUpText` — flat free-text scalars, all three in Phase 2's single migration. Added because Skyler put these sections in scope while re-scoping Phase 4 (see Phase 4 below); `architecture.md` Section 2's original "Introductions and Leveling Up skipped — pure gameplay-flow prose, no data" exclusion was reversed there, and Getting Started had never been considered at all despite the catalogue already citing its wording as a structural tell. Verified against real source text before adding, not assumed from the section names.

**Confirmed unchanged, 2026-08-30 — `PlaybookMove` still ships this phase even though Phase 4 no longer populates it.** Phase 4's re-scope moves Moves *authoring* to Phase 6; it does not move the Moves *schema*. `PlaybookMove` and `MoveGrantCount` are built here as originally specified, and simply sit empty/`0` until Phase 6. Splitting the table out into a later migration would gain nothing and would fragment a schema that's already validated. See `architecture.md` Section 3 for why `MoveGrantCount == 0` must not be read as authored data during that window.

**Field renamed, not a schema change, 2026-08-27**: `PlaybookMove.IsAutoGranted` → `Required`, per Skyler's naming preference surfaced during the playbook walkthrough (The Celebrity's "Fakelore" move). The underlying capability — a playbook granting a fixed move automatically alongside a separate pick-N-of-M pool, both at once — was already fully supported (validated originally against Chosen's Fate-adjacent Moves, re-confirmed independently by Celebrity); only the field's name changed. See `architecture.md`'s Moves section for the full trace.

## Phase 3 — Data Admin UI: Playbook create/update (fully specified; **implemented 2026-08-30**)

**Delivered**: `PlaybookContracts` / `IPlaybookRepository`+`PlaybookRepository` / `IPlaybookService`+`PlaybookService` / `PlaybooksController`, DI registered; frontend `PlaybookService`, `PlaybookAdminComponent` (list + orchestration) and `PlaybookFormComponent` (`@Input() playbook | null` / `@Output() save`, the create-edit split `MonsterFormComponent` already uses), rendered under Phase 1's Playbooks tab.

**Verified by driving the real app in a browser**, not just by compiling: create → edit → delete through the actual form, with the Id round-trip asserted against the server's own detail response afterward (edited child kept its id, removed child deleted, added child got a fresh id, untouched children unchanged). Full solution build clean; 172 API tests and 336 Angular tests still pass.

One implementation trap is recorded in `architecture.md` Section 3 (EF classifies a new child in a tracked graph as `Modified` when its `Guid` key is pre-populated, producing a misleading `DbUpdateConcurrencyException` — fixed with `ValueGeneratedNever()`). It cost real debugging time and will recur in any future domain that adopts this upsert-the-graph shape.

**What**: Real content for the Playbooks tab added in Phase 1. `PlaybookAdminComponent` (list + create/edit), backed by `PlaybookRepository`/`PlaybookService`/`PlaybooksController`/`Contracts` — full vertical slice, same layering as every existing domain.

**Frontend shape**: a shared `PlaybookFormComponent` for the core scalar fields (name, tagline, description, luck/harm/experience box counts and thresholds, move grant count, history prompts text) plus editors for each child collection (stat arrays, moves, gear categories+options, look categories+options, improvements), submitted as a **single request carrying the full nested graph** — not `monster-create.ts`'s local-draft-arrays-plus-several-sequential-calls pattern. That pattern exists for Monster because Monster's sub-resources have their own real endpoints (Resolved 2026-08-25, item 3, below) and can partially fail independently; Playbook's single-endpoint contract means one call either creates/updates the whole playbook or it doesn't, so there's no partial-failure state to design UI around the way `monster-create.ts` does.

**Backend shape, resolved 2026-08-25**: `PlaybooksController` with `GET /api/playbooks`, `GET /api/playbooks/{id}`, `POST /api/playbooks`, `PUT /api/playbooks/{id}`, `DELETE /api/playbooks/{id}` — standard CRUD, no mystery-scoping (Playbooks are global reference/template data, not owned by any Mystery). **No sub-resource endpoints of any kind for Playbook's child collections, full stop** — no `POST /api/playbooks/{id}/moves` or equivalent, and no per-child-type `GET`. `POST`/`PUT` each take the entire nested graph (stat arrays, moves, gear categories+options, look categories+options, improvements) in one request body, persisted in one transaction; `GET /api/playbooks/{id}` returns the same full graph back. This replaces the earlier "left as an implementation-time call" framing — Skyler was explicit that no sub-resource CRUD/GET endpoints are needed for this development.

**Upsert semantics, resolved 2026-08-30 — this was an unspecified gap, not a deferred call.** `PUT` reconciles child rows by **Id-based diff**: incoming children carry their `Id` when they already exist and omit it when new; matched rows update in place, unmatched insert, stored rows absent from the payload delete — one transaction. Delete-all-and-reinsert was explicitly rejected: it churns child `Id`s on every save, which breaks the live-link design (`HunterMove` → `PlaybookMove.Id`, `HunterGearSelection` → `PlaybookGearOption.Id`, `Hunter.PlaybookStatArrayOptionId`) under cascade *and* under restrict. **Concrete requirement this places on this phase's frontend**: the `GET` → form → `PUT` round-trip must carry child `Id`s through the form model, not just their values — a real constraint on how the child-collection editors are built, easy to miss until a Hunter exists to break. Rejecting deletion of an in-use child (`409`) is deferred to Phase 9/10, since no `Hunter` row can exist before then. Full reasoning and the rejected alternative: `architecture.md` Section 3, "Persistence semantics for the upsert-the-graph endpoint."

**Risk**: medium-low — simpler than first scoped, since the single-endpoint contract removes the batching/partial-failure concerns Monster's equivalent page has to handle; still the most form-heavy CRUD page in the app by child-collection count. The Id-preserving round-trip above is the one genuinely subtle part.

**Purpose, corrected twice**: this UI is (a) the ordinary way Skyler adds further templates *after* the canonical 28 exist, without a code deploy (`architecture.md` Section 4, "Path B"), and (b) Skyler's own manual-testing surface for the create/update functionality. **Resolved 2026-08-25**: it is explicitly *not* the authoring mechanism for the canonical 28 either — an AI agent authors those via the same API this UI calls, not via the form (`architecture.md` Section 4, Path A). The UI still needs to exist and work correctly, since Phase 4's agent-driven authoring depends on the backend this phase builds — just not on the frontend form itself.

## Phase 4 — Validate the model *and* pin down a repeatable authoring pattern: agent-authored Chosen/Crooked/Divine standard data (fully specified, revised 2026-08-25 twice, formatting pipeline finalized 2026-08-26, **re-scoped 2026-08-30**)

**Executed 2026-08-30 — all three pilots authored and verified.** The Chosen, The Crooked, and The Divine are in the working database, authored through the real `POST /api/playbooks` endpoint (not the admin form, not a direct DB write), each from its own bounded pass over the source pages. Per-section counts, all matching this doc set's prior expectations: Chosen 5 ratings / 4 gear categories / 3 look categories / 10+8 improvements; Crooked 5 / 1 / 2 / 10+7; Divine 5 / 2 / 3 / 10+8. Zero Moves rows and `MoveGrantCount = 0` on all three, per the re-scope below.

**Self-verification: 49 automated checks, all passing** (`.claude/skills/hunter-playbook-authoring/scripts/verify.mjs`). It re-reads each playbook back *from the API* rather than checking the payload, and covers all three known artifact classes (basic-move contamination, page-bleed wording, mid-word column splits), full content fidelity of every stored option/improvement string against the raw source text, digit-by-digit rating-line verification, cross-playbook track uniformity, and the Moves scope boundary. Also confirmed the authored graph round-trips into the Phase 3 edit form in a browser.

**The Skill exists and is registered**: `.claude/skills/hunter-playbook-authoring/`, written *from* this pass rather than in advance, exactly as `open-questions.md` Q10 argued for. `Skill` was added to Bowser's tools list so it can actually invoke it. Phase 8 inherits both.

**Three findings surfaced, not absorbed** — per the standing instruction below. All three are recorded in the Skill's "Known gaps" section so the next 25 playbooks hit a documented decision rather than re-deriving one:
1. **`Playbook.Tagline` has no source to populate it.** Each playbook prints exactly one flavor blurb, which goes to `Description`. `Tagline` is null on all three and is likely to stay null across all 28. Either it should be dropped, or its intended content identified.
2. **Gear has no freeform escape.** `PlaybookLookCategory.AllowsFreeform` exists; `PlaybookGearCategory` has no equivalent. Chosen's Special Weapon Material ends "or anything else you want", stored for now as a literal ninth option — an explicit stopgap, not a modeling decision.
3. **Improvements are stored in `-raw` (column-major) order**, which is the source's own item order but not its visual left-to-right reading order for the two-column layouts. Either is defensible; it needs to be one of them consistently across 28.

**Re-scoped 2026-08-30 by Skyler — Moves are out of this phase entirely.** Skyler identified this as fallout from the 2026-08-29 renumber that inserted Phase 6: "Because the Moves section will not be enacted until Phase 6, they are now out of scope for Phase 4." Phase 4 no longer authors any `PlaybookMove` rows or `MoveGrantCount`. **The sections this phase authors, per Skyler's own list:**

| In scope | Note |
|---|---|
| Ratings | Some playbooks may not have this — **surface the deviation, don't assume** |
| Luck | Near-identical across playbooks except the per-playbook "*[Playbook]* special" trigger text |
| Harm | Near-identical — **surface any deviation rather than normalizing it silently** |
| Experience | Near-identical — same instruction |
| Gear | Similar structure, different content per playbook |
| Getting Started | New field this phase (`GettingStartedText`) |
| Look | Similar structure, different content |
| History | Similar structure, different content |
| Introductions | New field this phase (`IntroductionsText`) |
| Leveling Up | New field this phase (`LevelingUpText`) |
| Improvements | Similar structure, different content |
| Advanced Improvements | Similar structure, different content |

**Out of scope, and not by omission**: **Moves** (all of it — the `PlaybookMove` rows, their `DescriptionText`, `Required`, and `MoveGrantCount`) belong to Phase 6. **Bespoke rulesets** belong to Phase 5. Skyler's framing: "Bespoke rulesets are exclusive to Phase 5 and custom playbook-specific moves are exclusive to Phase 6."

**Standing instruction for this phase, stated by Skyler and worth honoring literally**: where a section is expected to be near-identical across playbooks (Luck's track, Harm, Experience, Ratings' presence), a playbook that deviates is a **finding to surface, not a variation to quietly absorb**. This is the same discipline that caught the two layout artifacts in `architecture.md` Section 1, applied to content rather than extraction.

**Two consequences this re-scope resolves, both previously open:**
- **The Crooked sequencing flag is moot.** Phase 6's own note flagged Crooked as "a Phase 4 pilot *and* carrying two in-scope in-move picks (Artifact, Deal with the Devil)," warning that authoring it before Phase 6's schema shipped would force deferral or re-authoring. With Moves out of Phase 4 entirely, Crooked's Moves are never touched here — there is nothing to re-author. Skyler confirmed the "author standard-only, revisit later" resolution independently, before this re-scope made it automatic.
- **The Moves formatting-fidelity checkpoint moves to Phase 6.** It was Phase 4's hard gate on Phase 5; with no Moves content authored here, it has nothing left to gate at this point in the sequence. It is **not dropped** — see Phase 6.

**Purpose, reframed 2026-08-25 per Skyler's Q9 answer**: this phase is not just "get 3 rows into the database to prove Phase 2's schema works." Its real goal is to use the 3 pilot playbooks to **pin down inconsistencies and nail down a consistent, repeatable authoring pattern** before Phase 8 scales that same process to the remaining 25 — extra rigor here specifically because mistakes in the pattern are cheap to catch and fix against 3 playbooks and expensive to catch and fix after they've already propagated across 28.

**What, revised twice**: this phase is local model validation only — it does **not** deliver a production seed, and it does **not** go through the Phase 3 Admin UI form. An AI agent reads Chosen/Crooked/Divine's extracted content (already done for this pass, `hunter-playbooks.txt`) and authors each one's standard-section data by calling the real `PlaybooksController` Create endpoint against a working/dev database — one bounded agent task per playbook, per `architecture.md` Section 4's granularity recommendation. This exercises Phase 2's schema and Phase 3's backend end-to-end, exactly as originally intended, just with the agent as author instead of a human typing into the form.

**Verification, resolved 2026-08-25 (Q9)**: agent self-verification (against the known-artifact checklist — the stat/move-pairing merge, page-bleed, mid-word column splits — the same checks this pass demonstrated) is sufficient for the agent to consider a given playbook "done." No separate human-diff-against-PDF gate per playbook. Skyler does a manual review pass themselves afterward, across the pilot batch, not as a per-playbook checkpoint blocking the agent's progress.

**New deliverable of this phase, per Q10's recommendation**: the playbook-consumption procedure (read the relevant PDF section → extract standard-section fields → self-verify against the checklist → call the API to create the record) gets packaged as a Claude Code **Skill**, authored and iteratively refined *during* this phase's 3-playbook pass — not written in advance. The Skill is the concrete artifact this phase's pattern-validation purpose produces; see `open-questions.md` Q10 for the full recommendation and reasoning (reusability across Phase 4/8, why a Skill fits better than ad hoc docs, and why its content is deliberately not locked in yet).

**Q10 resolved 2026-08-30 — mechanism confirmed, and its location decided against Skyler's initial lean, for a concrete reason.** Skyler leaned toward scoping the Skill to Bowser (whose accumulated extraction history is real), conditioned explicitly on "if you don't see any problem with it." Three problems were found and reported:
- **Bowser has no `Skill` tool.** Its agent definition lists `Read, Edit, Write, Grep, Glob, Bash, PowerShell` — it cannot invoke a Claude Code Skill at all as defined.
- **`.squad/skills/` is read by nothing.** No squad agent's prompt references it, nor do `routing.md`/`team.md`/`ceremonies.md`. The one file there (`angular-wizard-decomposition/SKILL.md`) is effectively orphaned — a knowledge note, not a loading mechanism. Placing the procedure there would reproduce exactly the per-invocation discovery failure Q10's reasoning rejected.
- **Skill availability is per-session, not per-agent.** There is no mechanism to make a skill visible only to one subagent, so "scoped to Bowser" could only ever be convention, never enforcement.

**Decided**: author it at `.claude/skills/hunter-playbook-authoring/SKILL.md` (real auto-discovery, invokable by name) **and** add `Skill` to Bowser's tools list so Bowser can genuinely invoke it. This separates two things Skyler's question had bundled: the **procedure** lives in the Skill and is general-purpose, while the **role-specific familiarity that accrues over time** continues to live in `.squad/agents/Bowser/history.md`, which is already Bowser-scoped and already works.

**Operational prerequisite, identified 2026-08-30 — the authoring agent needs an authenticated session.** `Program.cs` sets a global fallback authorization policy (`RequireAuthenticatedUser`) with cookie auth (`motw.session`), so every `PlaybooksController` call needs a logged-in session; there is no anonymous path and none should be added. The Skill's procedure must include authenticating via `AuthController` and carrying the cookie. Skyler supplied a local dev account for this. **Credentials are runtime-only and must never be written into the Skill, the repo, or any committed file** — the Skill documents the login step, not the values.

**Explicitly deferred out of this phase, to the end of Phase 8 instead**: converting the authored data into the actual production seed (`Data/Seed/hunter-playbooks.json` + the `MotwDbInitializer` extension). Skyler's instruction was to run that conversion once, via a one-off script, when the full 28-playbook effort — standard and bespoke fields both — is essentially done, not incrementally after each phase. Doing it here for just 3 playbooks would mean re-running it again later for the other 25, which is exactly the "reusable in-app tool" shape Skyler said not to build. See Phase 8's closing step.

**Prerequisite, stated explicitly**: this phase needs Phase 3's backend (a complete, non-interactively-callable Create endpoint) but not its frontend form — the agent never uses the form.

**MOVED TO PHASE 6, 2026-08-30 — retained here for the trace, no longer this phase's gate.** The re-scope above removes all Moves content from Phase 4, so this checkpoint has nothing left to validate at this point in the sequence. It survives unchanged in substance, just relocated to where the content it gates now gets authored. Original text follows:

> **New explicit checkpoint, added 2026-08-26, narrowed same day**: Skyler personally validates that formatting fidelity (bold/italic/bulleted lists, via the constrained HTML subset — `architecture.md` Phase 2/Moves, `phase5-bespoke-ideation.md` Section 4) is being correctly captured across the 3 pilots' **Moves section specifically** (`PlaybookMove.DescriptionText`) before Phase 5 (bespoke rulesets) is allowed to proceed. **Scoped to Moves only, confirmed by Skyler** — every other standard section (ability ratings, luck/harm/experience, gear, pronouns, looks, history, improvements, advanced improvements) stays plain text; the earlier version of this checkpoint read as covering "any Description-type standard field," which overstated the actual requirement. This is a real gate, not a soft suggestion: it exists because the Moves formatting-fidelity requirement was a genuine miss in the original Phase 2 pass, caught only once bespoke-ruleset ideation surfaced it — Phase 4 is where it gets confirmed fixed before more schema builds on top of it.

**Direct consequence of the re-scope, 2026-08-30 — Phase 4 needs no formatting-preserving extraction at all.** Every section now in this phase's scope is plain text by explicit confirmation (`architecture.md` Section 6.3: the constrained HTML subset applies to `BespokeSection`/`BespokeOption`/`BespokeJournal` prose and `PlaybookMove.DescriptionText`, "nowhere else — every other standard-section field stays plain text, confirmed explicitly, not assumed"). Moves were the sole formatting-bearing field in Phase 4's original scope, and they're gone. **Plain `pdftotext -layout` is therefore sufficient for this entire phase**; the pdf.js pipeline below is still the standing mechanism, but Phases 5 and 6 are where it becomes load-bearing. Noted explicitly so nobody re-litigates it as a gap — the paragraph immediately below is retained because it remains correct about the pipeline's status, not because this phase depends on it.

**Extraction mechanism, resolved 2026-08-26 — no longer a spike, part of the defined process.** Skyler approved Bowser's pdf.js-based extraction pipeline (both the Crooked/Background `<b>` test and The Covenant/Moves `<i>`/`<ul>`/`<li>` test passed). Full writeup: `docs/hunter-playbooks/pdf-extraction-pipeline.md`. Concrete tools, standard going forward for every playbook: `tools/pdf-extract/extract-runs.mjs` + `splice-formatting.mjs` for flat description text with only inline emphasis (Background-shaped content — splice `<b>`/`<i>` runs into the existing `pdftotext -layout` plain text); `tools/pdf-extract/extract-moves.mjs` for Moves-shaped content, which reconstructs `{title, descriptionHtml}` directly from the PDF's item stream including any nested `<ul>`/`<li>` roll-result breakdowns. Both require locating the target column's x-range first (`dump-page.mjs`), and both keep the same review discipline already established elsewhere in this phase (self-verify the spliced/reconstructed output before treating it as final — the pipeline's own writeup documents two real false positives/bugs this review step caught during the spike).

## Phase 5 — Bespoke ruleset abstraction (design validated 2026-08-29; **schema implemented 2026-08-30**)

**Implemented 2026-08-30.** Five tables shipped via migration `AddBespokeRulesets`:
`bespoke_sections`, `bespoke_options`, `bespoke_journals`, `bespoke_journal_fields`,
`playbook_extra_tracks` — the full Section 6 spec, entities in `Data/Entities/BespokeEntities.cs`.
All three collections join the existing upsert-the-graph endpoint; no new endpoints, matching
Phase 3's no-sub-resources rule.

**`BespokeOption` is nested on the wire, flat in the database.** The API exposes options as
nested `children`, because the nesting *is* the model and a flat list-plus-parent-ids format
would force every client to rebuild the tree before rendering it. The service flattens to
`ParentOptionId` on write and rebuilds on read. `SectionId` is populated at every depth, so
the repository loads a whole tree of any depth with **one** `Include` — a `ThenInclude` chain
would have capped the supported nesting depth at however many links were written.

**Two pieces of non-obvious implementation, both deliberate:**
- **The self-referencing FK is `NoAction`, not `Cascade`.** Every option already carries
  `SectionId`, so deleting a Section cascades the whole tree in one step regardless of depth;
  declaring the parent link `Cascade` as well would give Postgres two cascade paths to the
  same rows for nothing. Deleting a *subtree* without its Section is therefore handled in
  `PlaybookService.RemoveSubtree`, which walks descendants depth-first before removing the
  parent. Verified directly against the database: removing a parent option leaves **zero**
  orphaned grandchildren and zero dangling `parent_option_id` values anywhere in the table.
- **The admin form round-trips bespoke content verbatim.** It has no bespoke editors — Phase 7
  authors through the API — but the upsert endpoint treats an absent collection as "delete
  everything in it", so a form that simply omitted them would silently destroy every bespoke
  section on a playbook the first time someone edited its name. `PlaybookFormComponent` holds
  them and sends them back unchanged, and renders a read-only summary so the data is visibly
  carried rather than invisibly. **When real editors are built they replace this passthrough,
  not sit beside it.**

**Validated against real catalogued data, not synthetic fixtures.** The Crooked's three actual
rulesets were authored through the API from `bespoke-ruleset-catalogue.md`, chosen because
between them they exercise most of Section 6's shapes: Titled Choice (Background, 1-of-7 with
`<b>` markup preserved), Simple Choice + Blank-Fill with `{{blank}}` tokens at varying
positions (Heat), an uncapped range — `MinSelect=2, MaxSelect=null` (Heat), and two-level
Nested Choice with recursive per-option `MinSelect`/`MaxSelect` over Tag Pick leaves
(Underworld, 4 parents x 4 children). **16 round-trip checks, 11 nested-mutation checks
(including subtree deletion), 10 validation checks, 5 UI passthrough checks — all passing.**
Section 6's model needed no changes to store any of it.

**Deliberately not implemented this phase**: the Hunter-side tables
(`HunterBespokeSelection`, `HunterBespokeSectionInstance`, `HunterJournalEntry`,
`HunterJournalEntryFieldValue`, `HunterExtraTrackValue`). Every one requires a `Hunter` table,
which lands in Phase 9/10; their shapes are specified in Section 6.4 and ship with it.
`BespokeSection.PlaybookMoveId` is likewise not here — it is Phase 6's entire schema delta.

**One judgement call worth flagging**: `SortOrder` was added to `BespokeSection` and
`BespokeOption`, which Section 6's field list omits (though it gives one to
`BespokeJournalField`). Same reasoning already accepted for the gear/look option tables —
these lists are ordered and user-visible, and without the column they return in arbitrary
database order.

### Original entry (design status, retained)

Per Skyler's brief, deferred as an implementation *decision* — but Skyler drove it through a full design/validation pass via a systematic, one-playbook-at-a-time walkthrough (2026-08-26 through 2026-08-29), not just ideation. **The authoritative schema now lives in `architecture.md` Section 6** — complete field-by-field definitions, conventions, and instance-side tables, written to implement directly from without needing to cross-reference the other two files below for the shape itself. Full reasoning history: **`phase5-bespoke-ideation.md`**; the complete, catalogued per-playbook result: **`bespoke-ruleset-catalogue.md`** (status: COMPLETE, all 28 playbooks processed).

- The **explicitly flagged re-validation requirement below (originally logged 2026-08-25) is now closed**: the shared `BespokeSection`/`BespokeOption` model (no rigid shape-kind enum — shape emerges from populated fields, same as Gear) was verified directly against all 28 real playbooks' source text, not just the 3 pilots. It held up structurally across the full set, needing only **additive, precedent-consistent extensions** as genuinely new shapes surfaced — no wholesale rework at any point across 28 rounds:
  - `PlaybookExtraTrack`/`BespokeJournal` (Curse-Eater) — Luck-like tracked resources and growing free-authored entries.
  - `BespokeSection.FreeTextLabel` (Gumshoe) — a single free-authored value with no fixed option list.
  - `BespokeSection.MinInstances`/`MaxInstances` + `HunterBespokeSectionInstance` (Hex's Rotes) — a Section repeatable into multiple per-Hunter instances.
  - `PlaybookExtraTrack.StartLabel` (Pararomantic) — a track whose start state isn't the universal "Okay" default.
  - `BespokeOption.NumericMin`/`NumericMax` + `HunterBespokeSelection.NumericValue` (Spooktacular's Infernal Favour, proposed by Skyler directly) — a bounded numeric resource conditional on one specific option pick.
- **Resolved, not open**: the category-engagement modeling nuance (stored vs. derived) surfaced by The Visitor's Expatriation — Skyler confirmed the derived resolution directly ("I agree that this should be logically derived, so good call"), now written into `architecture.md` Section 6.4 as a standing rule, not just a catalogue footnote.
- **Resolved, not open — now scheduled as Phase 6 (see below).** The standing, deliberately-out-of-scope list of Move-internal-pick-trap instances flagged throughout the catalogue for whoever authors Moves was originally left as "Skyler has indicated a future Moves-focused walkthrough, likely its own phase" — Skyler confirmed 2026-08-29 that this becomes a real, numbered phase (inserted here as Phase 6, between this phase and playbook imports), not just an informal follow-up. Also worth carrying forward: Skyler expects several bespoke rulesets will need custom rendering/validation logic beyond the generic schema to fully support the intended UX (an accepted, expected part of the design, not something to try to eliminate by generalizing the schema further).
- **What Phase 5 still needs before it "lands" in the sense Phases 4/7/8 use that word below**: the actual EF Core entities/migrations/endpoints implementing this now-validated model haven't been built. The catalogue is a real, authoritative content source ready to author from — but it's a design-and-data artifact, not yet running code.

## Phase 6 — Custom Move modeling: internal pick-structure within individual Moves (inserted 2026-08-29; **design settled 2026-08-30** — schema in `architecture.md` Section 6.8, authoring not yet started)

**Design complete and all questions resolved, 2026-08-30.** Census: `custom-moves-ideation.md`. Schema: **`architecture.md` Section 6.8** (implementation-ready). Decision record: `.squad/decisions/inbox/yoshi-hunter-playbooks-phase6-custom-moves-model.md`.

**Implemented 2026-08-30.** Migration `AddMoveInternalBespokeSections` — exactly the single nullable `bespoke_sections.playbook_move_id` FK the design promised, plus its index. Zero changes to `BespokeOption`, zero new tables, zero instance-side changes.

**The reading rule is enforced structurally, not by convention.** Section 6.8 warns that `BespokeSection` becomes polymorphic in its owner, so "any query for a playbook's top-level bespoke rulesets must filter `PlaybookMoveId IS NULL`" — a rule every future read site would have to remember. Rather than rely on that, the API **nests a Move's sections under the Move** in both request and response: `PlaybookDetailResponse.BespokeSections` is playbook-level by construction, and a client cannot mix the two. Server-side, `ReconcileSections` takes the owning Move (or null) and reconciles against only that owner's subset — verified in both directions, since getting the filter wrong either way would silently delete the other kind.

**Validated against real data.** The Crooked's full Moves section was authored through the API from `extract-moves.mjs` output: 8 moves with formatting preserved, `MoveGrantCount` 2, and the two in-scope Move-internal picks the census identified — Artifact (1-of-5, `Name (mechanical text)` options) and Deal with the Devil (a genuine 1–2 **range**). The extractor independently detected exactly those two option groups on the page, corroborating the census. **14 round-trip checks, 12 isolation/cascade checks, 7 UI checks — all passing**, including: a playbook-level edit leaves move-attached sections untouched and vice versa; deleting a move cascades away its embedded section with no orphaned options; and the admin form round-trips move-embedded structures byte-identically.

**One real content-fidelity bug caught by the formatting gate, worth recording.** A first authoring pass split option text from the extractor's plain `raw` field, which silently dropped the `<b>use magic</b>` markup inside Artifact's "Imp stone" option — nothing errored, the content was just quietly poorer. The extractor already emits `descriptionHtml`/`titleHtml` per option; the fix was to use them. This is exactly the failure mode Skyler's Moves formatting checkpoint exists to catch, and it is now a rule in the Skill: **take text from the `*Html` fields, never the plain ones.**

**Verifier updated, not silenced.** The Phase 4 self-verifier asserted "zero Moves rows, `moveGrantCount` 0" — an encoding of Phase 4's scope boundary that Phase 6 legitimately crosses. Replaced with a consistency check that holds in both phases: a playbook is either Moves-unauthored (no rows, count 0) or Moves-authored (rows *and* a real count), with the mixed states — rows whose count is still the placeholder 0 — being the actual bug worth catching.

**Still not authored**: the other 13 in-scope Move-internal picks across 10 playbooks, and every other playbook's Moves content. That is Phase 7 (the remaining two pilots) and Phase 8 (the other 25), both of which now have working schema and a documented procedure.

**Scope grew 2026-08-30 — this phase now owns the entire Moves section, not just Move-internal picks.** Skyler's Phase 4 re-scope ("the Moves section will not be enacted until Phase 6") moved all Moves *authoring* here. Concretely, this phase is now responsible for three things that were previously split across two phases:

1. **The Moves container content itself** — `PlaybookMove` rows (`Name`, `DescriptionText`, `Required`, `SortOrder`) and `Playbook.MoveGrantCount`, for whichever playbooks are in scope at the time. The container *schema* still ships in Phase 2 and needs no change (`custom-moves-ideation.md` §2.0 confirmed all 28 fit it exactly); only the authoring moved.
2. **Move-internal pick-structure** — this phase's original scope, unchanged: the 14 creation-time picks across 11 playbooks, via `BespokeSection.PlaybookMoveId`.
3. **The Moves formatting-fidelity gate, inherited from Phase 4.** Skyler personally validates that bold/italic/bulleted-list fidelity is correctly captured in `PlaybookMove.DescriptionText` via the constrained HTML subset, before the content is treated as final. This is where the pdf.js extraction pipeline (`pdf-extraction-pipeline.md`, `tools/pdf-extract/extract-moves.mjs`) becomes genuinely load-bearing — Phase 4 no longer needs it at all, since every section left in Phase 4's scope is plain text.

Also inherited from Phase 4's own note: the **Curse-Eater/Forged dual-column Moves-layout quirk** (required moves in one column, the pick-pool in another, printed side by side) is a Moves-extraction concern and therefore lands squarely in this phase now, rather than being split between Phase 4 and Phase 8 as previously flagged.

All 28 playbooks' Moves sections were read in full and cross-checked with systematic greps. **Scope: 14 creation-time in-move picks across 11 playbooks** — 7 of them new to the census (the pre-existing flag list was about half complete), **including two on The Crooked, a Phase 4 pilot playbook**. Ruled out of scope by Skyler and *not* left ambiguous: ~35 in-play menus, 5 computed-option-set cases, and ordinary roll-outcome branching all stay **prose**.

**Settled model: a single nullable `BespokeSection.PlaybookMoveId` FK** — reusing `architecture.md` Section 6 wholesale, with zero changes to `BespokeOption`, no new tables, and no instance-side changes. This supersedes the `BespokeOption`-level fork originally sketched below, which the census showed was the wrong attachment point (it can't express the two-mandatory-category shape Forged's Partner and Professional's Mobility both need).

**Tooling prerequisites — built 2026-08-30 by Bowser**, along with two silent bulleted-path bugs this phase's own doc hadn't spotted (a capital-`B` Required-move glyph matching no bullet rule — affecting all 7 Required moves in scope — and in-move option bullets sharing the top-level glyph). `extract-moves.mjs` now has an inline comma/semicolon path behind an additive `--options` flag, and emits per-option title provenance. **One of this phase's own stated findings was also corrected**: option names are *usually* regular weight but not always (The Searcher's First Encounter has bold ones), so title provenance is now measured per option rather than assumed by rule. Detail: Section 6.8 and `custom-moves-ideation.md` §2.5/§5.

**~~Sequencing flag worth acting on before Phase 4 runs~~ — CLOSED 2026-08-30.** The flag read: "The Crooked is a Phase 4 pilot *and* carries two in-scope in-move picks. Authoring it before this phase's schema ships means deferring or re-authoring that content." Skyler's Phase 4 re-scope removes Moves from that phase entirely, so Crooked's Artifact and Deal with the Devil are simply never authored there — no deferral, no re-authoring, no action needed. Recording the closure rather than deleting the flag, since the risk it named was real when written.

**Original scope note, retained below as the phase's own framing** — the census confirmed its scope boundary and its seed-not-census warning, and revised its two-pattern count upward.

**New phase, per Skyler's explicit request**, exact words: "it has become clear as we went through the playbooks exploring the bespoke rulesets that there's a significant amount of nuance and variety in the way the custom playbook moves are implemented, as well. I would like to retrofit the phases to indicate a phase/step in between 5 and 6 to work through the individual custom moves and apply a similar modeling strategy. It may end up being almost identical, as the custom moves use a lot of similar techniques as the bespoke rulesets." Positioned here (between Phase 5 and the first playbook-import phase) because Skyler considers it necessary before any full playbook import, the same way Phase 5's design had to land before bespoke data import.

**This entry records the phase's existence, position, and known scope only** — per Skyler's own instruction, the actual ideation/design work starts when Skyler is ready to begin it, the same way Phase 5 didn't get its own ideation doc (`phase5-bespoke-ideation.md`) until Skyler opened that phase for real. No `custom-moves-ideation.md`/catalogue doc exists yet; this section is what to expand once that work starts.

**Scope boundary, stated explicitly so it isn't re-litigated once work starts**: this phase covers only the **internal pick-structure embedded inside individual Move descriptions** — a Move's own text containing a fixed, enumerated pick-list distinct from ordinary "on a 7-9, pick one of these complications" roll-outcome branching every Move already has (confirmed, not just assumed, as a real third category — see The Wronged's DIY Surgery in the catalogue, the first case explicitly checked against both named patterns and found to be neither). It does **not** revisit the standard Moves container model itself (`PlaybookMove.Required`/`MoveGrantCount`, fully specified in Phase 2) or Move formatting fidelity (already gated in Phase 4's checkpoint).

**Two distinct patterns already identified during the Phase 5 walkthrough, worth carrying forward as the starting frame**:
- **Permanent, creation-time picks** — a fixed, enumerated pick-list embedded in one Move's own text, selected once and locked in at character creation, structurally the closest match to a bespoke `BespokeOption` tree. **8 confirmed instances across 7 playbooks**: Forged's Partner (Bonds/Burdens), Gumshoe's Naked City, Host's Defensive Adaptation, The Searcher's First Encounter, The Spell-Slinger's Tools and Techniques *and* Could've Been Worse, The Professional's Mobility (the first confirmed instance on an *optional*, not Required, Move), and The Visitor's Something Strange.
- **In-play repeatable menus** — a similar-looking embedded pick-list, but chosen fresh each time the Move triggers during play, not a one-time build choice. Confirmed instances: Action Scientist's Physics and Cosmology, Spooktacular's The Game Is Fixed, Spooky's Hex/Tune In/Jinx (three on one playbook), and The Visitor's Taste of Home. These were consistently distinguished from the permanent-pick pattern throughout the walkthrough and should **not** be modeled the same way if/when this phase reaches real schema work.

**The existing trap list is a seed, explicitly not a census — the phase's first real deliverable is a full, systematic pass over every Move on every playbook, not just a review of the list above.** Every instance above was found *opportunistically*, while checking a nearby bespoke Section's own scope boundary or confirming a playbook's `Required`/`MoveGrantCount` — Moves were never independently, systematically reviewed for internal pick-structure the way bespoke rulesets were. A Move with real internal structure but no bespoke Section anywhere nearby on its own playbook may never have been looked at closely. **Also unchecked so far, specifically**: Chosen, Crooked, and Divine (Phase 4's own 3 pilots) — their Moves were read early in this project for the original standard-vs-bespoke split, before the internal-pick-trap pattern was even recognized as a category; whether any of their Moves need this treatment is a real open question this phase needs to answer, not an assumption either way.

**Related, but explicitly a distinct loose end from the pick-structure question above**: Curse-Eater and Forged both have a noted **dual-column Moves-layout quirk** in the source PDF (required moves in one column, the pick-pool in another, printed side by side) — a presentation/extraction detail, not a data-modeling one, already flagged in the catalogue "for Phase 4" but never acted on. Whoever authors Moves (Phase 4's pilots don't include either playbook, so this lands with Phase 8's 25-playbook pass, or with this phase if it ends up touching extraction tooling) needs to account for it; noted here so it isn't lost in the shuffle now that a dedicated phase exists for Move-related nuance.

**Likely deliverable shape, sketched from Phase 5's own template, not yet confirmed**: a new ideation doc (candidate approaches for whether a Move's internal pick-tree reuses `BespokeOption` directly via a nullable `PlaybookMoveId` FK, or needs a structurally-parallel `PlaybookMoveOption` table — the one real architecture fork expected to open this phase, per Skyler's own "almost identical" expectation for everything else: recursive `MinSelect`/`MaxSelect`, `{{blank}}`, the HTML subset, and the instance-side bridge-table pattern all likely reuse `architecture.md` Section 6 as-is); a new catalogue doc mirroring `bespoke-ruleset-catalogue.md`'s conventions (one-playbook-at-a-time walkthrough, progress tracker, "confirmed none" as a real recordable outcome); and, once the architecture fork resolves, a new `architecture.md` subsection alongside Section 6. **Depends on Phase 5's schema as its starting point, not from scratch** — reusing Section 6's conventions is the explicit expectation, not a fresh design exercise.

## Phase 7 — Import bespoke data for the three playbooks (**complete 2026-08-30**)

**All three pilots are now fully authored** — standard sections, bespoke rulesets, and Moves:

| Playbook | Ratings | Gear | Looks | Improvements | Moves | Bespoke | Move-internal |
|---|---|---|---|---|---|---|---|
| The Chosen | 5 | 4 | 3 | 18 | 7 (grant 3, 2 Required) | Fate (36 options) | — |
| The Crooked | 5 | 1 | 2 | 17 | 8 (grant 2) | Background / Heat / Underworld (32) | Artifact, Deal with the Devil |
| The Divine | 5 | 2 | 3 | 18 | 7 (grant 3) | Mission (5 options) | — |

The Crooked was completed during Phase 5/6 validation; this phase added The Chosen's Fate and The Divine's Mission, plus both playbooks' Moves. Bespoke content authored from `bespoke-ruleset-catalogue.md`; Moves from `extract-moves.mjs`, taking text from the `*Html` fields per the Phase 6 rule. **25 verification checks plus the standing 46-check verifier, all passing.**

**Fate exercised the deepest shape in the model and needed no changes**: one Section at `MinSelect=MaxSelect=3` (all three categories mandatory) over three title-only category dividers, each carrying its own recursive count — How You Found Out 1-of-7, Heroic 2-of-12, Doom 2-of-14, 33 title-only tag leaves in total. Mission exercised the opposite end: five description-only options, with option 5's inline italic preserved and options 1–4 confirmed plain rather than over-marked.

**New finding — The Divine has the dual-column Moves layout.** `phases.md` and the catalogue flagged this quirk for Curse-Eater and Forged only. The Divine has it too: its seven moves span two columns on page 15 (x≈284 for Boss from Beyond / Angel Wings / What I Need When I Need It / Smite, then x≈533 for Soothe / Lay On Hands / Cast Out Evil), with Mission printed below the second column. A single-column extraction silently returns **four of seven moves** and then picks up Gear rows as untitled entries — it does not error. Caught by cross-checking the extracted count against the raw source. **Two lessons now recorded in the Skill**: bound the extraction in `y` as well as `x` (Moves and Gear often share a column), and always cross-check the extracted move count against `pdftotext -raw` before authoring. The quirk is likely more widespread than the three playbooks now known to have it, so Phase 8 should assume it rather than be surprised by it.

**Open item raised and resolved, 2026-08-30.** The catalogue's Chosen/Fate entry flagged that Chosen's Luck-spend trigger appears in the source twice, differently worded, and left the call to whoever authored Chosen — pick one, merge them, or treat them as two intentional beats. Surfaced to Skyler with the second wording stored nowhere; **Skyler chose the two-beats reading and directed the aside into Fate's `EffectText`**, with the rationale that "the intent with the second statement is to remind the player that these systems are connected."

This **reverses** the catalogue's original judgment, which had excluded the aside on the grounds that a Luck-spend trigger is `Playbook.LuckSpecialText`-shaped regardless of which column it is printed in. Skyler's reading classifies it by function rather than by rule-type: it sits inside Fate deliberately, telling a player choosing fate tags that Luck will bring those tags into play — which is what `EffectText` is for (Section 6.1). Both beats now exist; neither was moved or merged. The bold span (`<b>Whenever you mark off a point of Luck,</b>`) was verified programmatically against page 8's own font table rather than inferred — worth noting because the sentence spans a line break with "the Keeper" ending the bold line in regular weight, so reading the two visible lines naively drops those two words. Full trail: `bespoke-ruleset-catalogue.md` `## The Chosen`.

### Original entry (deferred status, retained)

Not designed this pass. **Authoring mechanism, once Phase 5 lands, matches Phase 4's**: an AI agent authors the bespoke-section data via the real API (whatever endpoint shape Phase 5's schema implies), not the Admin UI form — same reasoning as Phase 4, per `architecture.md` Section 4. The Phase 4 Skill (above) will need extending to cover bespoke-field extraction once Phase 5's shape exists — expected, not a gap; the Skill was always going to grow with the schema it's driving. **Also depends on Phase 6**: if any of Chosen/Crooked/Divine's own Moves turn out to need Phase 6's internal-pick-structure treatment, this phase's authoring pass needs that schema in hand too, not just Phase 5's — sequencing this after both, not just Phase 5, is why the renumber placed Phase 6 directly before this phase rather than after it.

## Phase 8 — Import the remaining 25 playbooks, then run the one-time production seed conversion (**in progress — group 1 of 4 complete, 2026-08-31**)

**Paced in four groups of seven at Skyler's direction, 2026-08-31**, rather than one 25-playbook run: "this phase has some of the highest risk for error, unforeseen exceptions to assumed patterns, and other issues." That judgment was borne out immediately — see the findings below.

**Group 1 complete: The Action Scientist, The Celebrity, The Changeling, The Chosen, The Covenant, The Crooked, The Curse-Eater.** Chosen and Crooked were already authored (Phases 4–7); the other five were authored this pass through the real `POST /api/playbooks` endpoint, each complete in one pass — standard sections, Moves, and bespoke content together, which is the shape Phase 8 was designed around and the first time it has actually been exercised.

| Playbook | Ratings | Gear | Look | Improv | Moves (grant / required) | Bespoke |
|---|---|---|---|---|---|---|
| Action Scientist | 5 | 3 | 3 | 10 + 9 | 5 (2 / 0) | Area of Study — 7 options |
| Celebrity | 5 | 3 | 3 | 10 + 9 | 8 (3 / 1) | none — confirmed zero |
| Changeling | 5 | 3 | 4 | 10 + 10 | 8 (3 / 1) | Unknown Heritage — 10; Force of Nature (move-internal) — 4 |
| Covenant | 5 | 3 | 3 | 11 + 8 | 7 (2 / 0) | Covenant (zero-option) + Friendship — 2 categories, 11 |
| Curse-Eater | 5 | 3 | 3 | 10 + 9 | 9 (4 / 2) | How Consuming Magic Works — 5; Consumed Magic journal; Corruption track |

**Self-verification: 287 automated checks across all eight authored playbooks, all passing**, plus a browser round-trip of the Curse-Eater through the real admin form (the first playbook carrying both a `BespokeJournal` and a `PlaybookExtraTrack`, so the first real test that the form's passthrough buffers preserve them).

**The main lesson of group 1 is about the verifier, not the playbooks.** Three Phase 4 checks encoded coincidences of the three pilots as universal rules, and each was wrong by the fourth playbook: the source uses **two wording families** for the six "universal" advanced improvements (the old check treated family B's "new playbook" as proof of page-bleed, and would have failed four correct imports); regular improvement counts are **not always 10** (the Covenant prints 11); and the mid-word-hyphen check never looked at Moves or bespoke text, which did not exist when it was written. `scripts/verify.mjs` was rewritten accordingly — 287 checks now, covering move bodies, bespoke/journal/track text, prose fields, `sortOrder` density, and bespoke structural coherence.

**Four pre-existing defects in the Phase 4–7 pilots, found by the strengthened verifier and fixed:** line-wrap hyphens surviving into Moves bodies on the Chosen, the Crooked and the Divine (`imme- diate`, `Addi- tionally`, `any- thing`, `some- thing`, `ban- ished` — five moves in total), and the Crooked's advanced improvements carrying `sortOrder` 10–16 instead of restarting at 0. All corrected in place through `PUT`, so every child row kept its Id.

**Three corrections to `bespoke-ruleset-catalogue.md`**, all found by checking it against the page: the Covenant's Friendship style tags were recorded in an order matching neither a column-major nor a row-major reading of the printed two-column grid; the Curse-Eater's gear line said "2-category" and then listed three; and two of that playbook's gear lists were overcounted. The catalogue remains authoritative for *structure* — but group 1 is the evidence that its *counts and orderings* need cross-checking against the source.

**Four decisions taken by Skyler this pass**, all recorded in the Skill so groups 2–4 hit a documented answer: genuine source typos are corrected on storage rather than preserved (with each correction registered in the verifier's `EXEMPTIONS` table so fidelity is still checked against the real page); the Changeling's single nested improvement stays one row using the existing `<ul>/<li>` subset; the Action Scientist's one-off gear-tag note is dropped; and **multi-column option grids are transcribed column-major**, which settles the general rule for gear, bespoke options and improvements alike.

**Two further decisions, taken after group 1's report, 2026-08-31:**

- **The admin form now partitions improvement `sortOrder` by `isAdvanced`** rather than numbering the combined array 0–N from its FormArray index (Skyler: "I will always want those grouped that way"). The old behaviour silently rewrote the stored numbering of any playbook saved through the UI. Fixed in `playbook-form.ts`; a no-op save of the Curse-Eater through the real form now comes back byte-identical, and all 336 Angular tests still pass. A form-reactivity spec for this belongs to the deferred testing step, not here.
- **Line-width hyphenation is never preserved in stored data** — those words go in whole. Hyphens genuinely part of a word stay. A full scan across all eight authored playbooks found **zero** surviving artifacts, and 30 distinct genuine compounds correctly kept (`Curse-eater`, `fear-based`, `ignore-armour`, `air-supply`, `co-star`, …). The scan is now a permanent verifier check rather than a one-off: a spaced split (`per- ceptions`) is caught by pattern, while a spaceless rejoin (`com-ponent`) is shape-identical to a real compound and is instead settled against the pooled raw corpus — a token printed intact on one line anywhere is genuine, one that only ever straddles a line break is an artifact, and anything matching neither is reported as unattested rather than silently passed. Negative-tested in both directions before being trusted.

**Group 2 complete, 2026-08-31: The Divine, The Envoy, The Expert, The Flake, The Forged, The Gumshoe, The Hex.** The Divine was already authored (Phase 4/7); the other six were authored this pass, complete in one pass each.

| Playbook | Ratings | Gear | Look | Improv | Moves (grant / req / adv) | Bespoke |
|---|---|---|---|---|---|---|
| Envoy | 5 | 2 | 3 | 11 + 9 | 7 (2 / 0 / 0) | Task — 4; Secret Wisdom (zero-option); Overseers — 2 categories, 21 |
| Expert | 5 | 1 | 2 | 10 + 7 | 7 (2 / 0 / 0) | Haven — 9 |
| Flake | 5 | 2 | 2 | 10 + 7 | 8 (3 / 0 / 0) | none — confirmed zero |
| Forged | 5 | 2 | **7** | 11 + 10 | 7 (2 / 1 / 0) | Dual Nature — 3 categories, 17; Origin — 2 categories, 14; Partner (move-internal) — 2 categories, 11 |
| Gumshoe | 5 | 3 | 2 | 9 + 8 | 9 (3 / 2 / 0) | Gumshoe Code (FreeTextLabel); The Naked City (move-internal) — 34 |
| Hex | 5 | 2 | 2 | 11 + 9 | 10 (3 / 1 / **2**) | Temptation — 7; Rotes (repeatable) — 2 categories, 8 |

**540 automated checks across all fourteen authored playbooks, all passing**, plus browser round-trips of the Hex and the Forged through the real admin form.

**Two schema additions, both decided by Skyler after being surfaced, both verified one-offs across all 58 pages** (migration `AddMoveIsAdvancedAndLookGroupLabel`, additive, nullable/defaulted so no existing row changed):
- **`PlaybookLookCategory.GroupLabel`** — The Forged is the only hunter with two physical forms, and prints its seven Look categories under "Human look:" and "Weapon look:". Without this the data could not say which four describe the weapon rather than the person.
- **`PlaybookMove.IsAdvanced`** — The Hex prints two "Advanced Hex Moves" (Apotheosis, Synthesis) reachable only through an improvement. Splits the Moves table into two lists exactly as `PlaybookImprovement.IsAdvanced` already does, each with its own `sortOrder` from 0. The alternative was losing the rules text or letting a creation UI offer moves the rules don't.

**Group 2 broke two of group 1's own replacement rules, which is the pattern worth noting.** Group 1 replaced the "six universal advanced improvements, present exactly once" check after finding two wording families; group 2 then found that a beat can be **absent entirely** (The Forged prints no "Mark another two") and worded differently again (the Gumshoe and Hex print "**Make up** a second hunter"). The check now asserts only that no beat appears *twice* — duplication is the real contamination signal — and reports absences. Two more sample-derived assumptions also fell: playbooks are not always two pages (**the Hex runs 27–30**, its Rotes worksheet being where the actual ruleset content lives), and a playbook need not print a blurb under its title at all (**the Gumshoe and the Hex** put their flavour quotation elsewhere on the spread; Skyler's call was to use it as `description`).

**Three defects found and fixed, two of them in shipped code:**
- **The admin form numbered moves 0–N across the combined array**, so the Hex's two advanced moves came back as sortOrder 8–9 instead of 0–1 — the identical bug fixed for improvements after group 1, in the collection added this pass. Caught by the browser round-trip, not the verifier; fixed in `playbook-form.ts`, and a no-op save now comes back byte-identical.
- **The verifier's content-fidelity check could not match any stored value spanning a bullet boundary.** `pdftotext -raw` renders a checkbox as a literal ASCII `b`, which survives alphanumeric squashing, so the source read `...move.bHerald: When you...` where the stored text read `...move.Herald: When you...`. Surfaced by the Envoy's Secret Wisdom, the first stored value to span four bulleted items. Bullet glyphs are now stripped from the source first — negative-tested in both directions to confirm the check still rejects fabricated text.
- **The hyphen classifier reported genuine compounds as unattested** when the source only ever prints them broken across a line ("mon-\\nster-killing", "too-for-\\nmal"). It now also attests against a healed copy of the corpus; the line-break detection itself is untouched, so real artifacts are still caught.

**A fourth artifact class was added to the checklist**: kerning splits. Heavy letter-spacing on a display title makes the extractor emit spurious spaces *inside* words — The Forged's "Don't Worry About Me" reads as `D on’t Worr y Ab out Me`. No punctuation is left behind, so the only signal is a stranded single letter, which the verifier now flags.

**One judgment worth recording**: The Naked City keeps its instruction sentence in the move's own `DescriptionText`, against the usual rule of dropping it, because it carries a real escape hatch ("or from other areas agreed to between you and the Keeper") that no `MinSelect` expresses and that has no option row to attach to.

**Three further catalogue corrections**, all from checking it against the page: The Forged's Dual Nature Range and Flaws were both recorded row-major where the printed two-column grids read column-major, and the Curse-Eater's gear/improvement counts were wrong (already fixed in group 1). The catalogue remains authoritative for *structure*; its counts and orderings need cross-checking.

**Group 3 complete, 2026-08-31: The Host, The Initiate, The Interface, The Monstrous, The Mundane, The Pararomantic, The Professional.** All seven new; all clean two-page spreads (checked before trusting it, after the Hex).

| Playbook | Ratings | Gear | Look | Improv | Moves (grant / req) | Bespoke |
|---|---|---|---|---|---|---|
| Host | 5 | 2 | 3 | 12 + 10 | 7 (3 / 1) | Symbiosis — 17; Defensive Adaptation (move-internal) — 6 |
| Initiate | 5 | 3 | 2 | 10 + 8 | 9 (4 / 1) | Sect — 2 categories, 25 |
| Interface | 5 | 5 | 3 | 10 + 11 | 6 (3 / 0) | Integration — 3 categories, 20 |
| Monstrous | 5 | 1 | 3 | 10 + 9 | 12 (2 / 0) | Monster Breed (zero-option); Curses — 5 incl. a nested 1-of-11; Natural Attacks — 2 categories, 10 |
| Mundane | 5 | 2 | 3 | 10 + 8 | 8 (3 / 0) | none — confirmed zero |
| Pararomantic | 5 | 1 | 2 | 9 + 10 | 8 (3 / 1) | Guide's Gift — 4; Bond Abuse; Fate of Your Love; Relationship Status track |
| Professional | 5 | 3 | 2 | 10 + 8 | 8 (4 / 1) | Agency — 3 categories, 20; Mobility (move-internal) — 2 categories, 22 |

**806 automated checks across all twenty-one authored playbooks, all passing**, plus browser round-trips of the Pararomantic, Monstrous and Professional through the real admin form — all three byte-identical after a no-op save.

**Two schema changes, both forced by the source rather than chosen** (migrations `MakeExtraTrackDescriptionNullable`, `WidenGearCategoryLabel`):
- **`PlaybookExtraTrack.Description` is now nullable.** The Pararomantic's Relationship Status prints only a header and its box row; the catalogue had already specified `Description: null` for it, but the column was non-nullable, so the schema and the design doc simply disagreed. The alternatives were inventing text or duplicating the Luck trigger sentence into a second field.
- **`PlaybookGearCategory.Label` widened 255 → 512.** The Initiate's Gear block opens with a 280-character conditional paragraph that is the only statement of what its two pick counts actually are — and those counts depend on the **Sect** bespoke ruleset, the first standard-section-depends-on-bespoke case in the corpus. Re-raised rather than dropped, because the Skill's own note from group 1 said a second instance of unhoused gear prose should be. Skyler chose the headroom over a separate `GearNotesText` field; the counts are stored as permissive maxima with the real rule in the label, the same prose-only resolution already accepted for Monstrous's Natural Attacks either/or.

**A third category of stored text was formalised: `SYNTHESIZED`.** Group 3 landed three kinds of deliberately-not-from-the-page content at once — two Required moves the source never names (**"One of Us"**, **"Agency politics"**, both named by Skyler), category labels the source gives only as a full sentence (**"Origin"**) or not at all (**"Agency name:"**), and the Pararomantic's four **Guide's Gift** titles, whose options carry no delimiter of any kind to split on. Rather than loosen the content-fidelity check, each string is now declared in a cited `SYNTHESIZED` set in `verify.mjs`; anything not declared still has to trace to the page.

**Two verifier defects found and fixed, both making it weaker or wronger than it looked:**
- **The hyphen classifier's artifact test was circular.** It attested the joined form against a "healed" copy of the source — but healing `near-\ndeath` manufactures `neardeath`, so every line-break pair attested its own joined form and the test could never fire. Rebuilt to attest only against words the source prints *whole*, which is what actually separates `com-ponent` (because `component` appears elsewhere) from `near-death` (because `neardeath` appears nowhere).
- **Bullet glyphs weren't stripped from the hyphen corpus**, so `bAim-assist` tokenised as `baim-assist` and the genuine compound `aim-assist` was reported unattested. The same strip already applied to the fidelity corpus now applies here too.

The classifier now has **three** verdicts rather than two: genuine, artifact, or *unresolvable — check the page*. That third one is deliberate. A genuine compound whose line break landed exactly on its own hyphen is indistinguishable from an artifact by glyphs alone, and a check that fails on correct data trains the next author to ignore it. Negative-tested in both directions: 5 of 5 genuine compounds kept, 3 of 5 real artifacts failed outright, the remaining 2 surfaced as notes.

**Ten notes, all confirmed source variation, none defects**: improvement counts of 9 (Gumshoe, Pararomantic), 11 (Covenant, Envoy, Forged, Hex) and 12 (Host); the Forged's missing beat; the Pararomantic's absent flavour text; and the Interface's `near-death`.

**One catalogue correction**: the Interface's advanced improvements are 11, not the 7 recorded.

**Group 4 complete, 2026-08-31: The Searcher, The Snoop, The Spell-Slinger, The Spooktacular, The Spooky, The Visitor, The Wronged. ALL 28 PLAYBOOKS ARE NOW AUTHORED.**

| Playbook | Ratings | Gear | Look | Improv | Moves (grant / req) | Bespoke |
|---|---|---|---|---|---|---|
| Searcher | 5 | 3 | 2 | 10 + 9 | 8 (3 / 1) | none at playbook level; First Encounter — 7, Guardian — 5, Network (repeatable free text) — all move-internal |
| Snoop | 5 | 4 | 2 | 10 + 8 | 7 (3 / 0) | Crew; Team Concept: Monster Revelations (both zero-option) |
| Spell-Slinger | 5 | 1 | 2 | 9 + 9 | 11 (4 / 1) | Combat Magic — 2 categories, 10; Tools and Techniques — 4, Arcane Reputation (repeatable free text) — move-internal |
| Spooktacular | 5 | 4 | 3 | 10 + 8 | 6 (2 / 0) | The Show — 5, incl. the numeric-leaf option |
| Spooky | 5 | 2 | 3 | 10 + 8 | 8 (3 / 0) | The Dark Side — 16 |
| Visitor | 5 | 4 | 3 | 11 + 8 | 7 (3 / 0) | Expatriation — 4 categories, 3 levels deep, 37 options; Something Strange — 5 move-internal |
| Wronged | 5 | 4 | 2 | 10 + 9 | 8 (3 / 1) | Who You Lost — 3 categories, 14 |

**1,076 automated checks across all twenty-eight playbooks, all passing**, plus browser round-trips of the Visitor, Spooktacular and Spell-Slinger — all byte-identical after a no-op save. 172 API and 336 Angular tests still pass. **No schema changes were needed for group 4** — the first group of the four to require none, which is the real signal that the model has converged.

**Every schema feature designed across Phases 5–7 is now exercised by real data**, several for the first and only time: `BespokeSection.FreeTextLabel` (Gumshoe's Code, plus the Searcher's and Spell-Slinger's bounded-repeatable free text), `MinInstances`/`MaxInstances` (Hex's Rotes, and now those same two bounded-repeatable cases), `BespokeOption.NumericMin`/`NumericMax` (the Spooktacular's Infernal Favour — the only numeric leaf in the book), `PlaybookExtraTrack` including `StartLabel` (Curse-Eater's Corruption, Pararomantic's Relationship Status), `BespokeJournal` (Curse-Eater's Consumed Magic), `PlaybookMove.IsAdvanced` (the Hex), and `PlaybookLookCategory.GroupLabel` (the Forged).

**The Visitor's Expatriation is the deepest structure in the corpus and the first real test of two predictions the design made in the abstract**: three levels of `BespokeOption` nesting (the adjacency list was only ever exercised two deep before), and a genuine *range* at the category level (`MinSelect=2, MaxSelect=3` — "at least two of the three lines", where every prior nested case was "all N of N"). Both held with no schema change.

**Two verifier defects found, both of which had been hiding behind narrower data:**
- **The nested-category check only looked one level deep**, so the Visitor's Lines — three levels down — were never checked at all. Now recursive.
- **It also rejected uncapped minimums** (`MinSelect` set, `MaxSelect` null), which is the correct shape for every "pick one or more, no stated ceiling" list: Heat, the Visitor's Lines, and both of the Wronged's tag blocks. It only passed before because no such category had ever sat at depth 1.

**Five more catalogue ordering corrections**, all the same class found in groups 1–3 — entries recorded row-major where the sheet prints a column-major grid: the Spooky's 16 Dark Side tags, two of the Visitor's Expatriation sub-blocks, and the Wronged's "Why couldn't you save them?". Plus two count corrections (the Searcher's investigation tools are 7 not 6; the Visitor has 11 regular improvements, not 10). **Across all four groups that is 11 ordering/count errors found in the catalogue by checking it against the page** — its structural decisions held up throughout, but its transcribed orderings and counts did not, and future work should treat those as needing verification rather than trusted.

**Phase 8's closing step is complete, 2026-08-31 — but built as a maintained tool rather than the one-off script this doc originally specified.** Skyler's instruction: *"I want to make sure this is something that's repeatable. If I change anything or discover small adjustments, I want to be able to run the script again so it can capture those changes. I also anticipate there may be more data structure changes over time. If we can find a way to validate the script through some kind of test, that would be ideal."* That reverses `architecture.md` Section 4 items 2 and 5, which are annotated in place.

**What shipped:**

| Piece | What it does |
|---|---|
| `Data/Seed/hunter-playbooks.json` | The canonical 28, 737 KB, ordered by name so re-exports produce reviewable diffs rather than churn |
| `PlaybookSeedExporter` | `dotnet run --project src/api/MonsterOfTheWeek.Api -- export-playbook-seed` — rewrites the file from the connected database |
| `PlaybookSeed.ToEntity` / `ApplyAsync` | Rebuilds the entity graph (ids included) and seeds it, guarded so it only ever fills an empty table |
| `PlaybookSeedTests` | Six tests, described below |

**The design choice that makes it repeatable is the file format: the seed file *is* `PlaybookDetailResponse[]`** — the exact shape `GET /api/playbooks/{id}` already returns. Exporting is therefore "call the read path for every playbook and write the array down", with no second serialisation format that could drift from the contract. A field added to the contract appears in the export automatically; the only thing needing a human is `ToEntity`, and the tests fail until it gets one.

**Ids are preserved rather than regenerated**, matching how every other seeded table uses stable Guids — and mattering more here, because Hunter instances live-link to specific child rows and a future data migration correcting one canonical row has to be able to name it.

**The tests are the part that answers "tell me when something broke":**
- **Round-trip** — a fully-populated fixture goes seed JSON → `ToEntity` → SQLite → the *real* repository and service → JSON, and must come back identical.
- **Contract coverage** — reflection over the response records asserts the fixture gives every property a non-default value, so a newly-added field cannot pass the round-trip by simply never being exercised. This is the test that fires when the schema grows.
- **Committed-file checks** — 28 entries, unique ids and names, name-ordered, and the file loads into a database and re-serialises byte-identically.
- **Seeding behaviour** — populates an empty database, is a no-op on a populated one, and treats a missing file as "nothing to seed" rather than a startup failure.

**Both guards were negative-tested rather than assumed.** Deleting one field (`IsAdvanced`) from `ToEntity` failed 2 tests; blanking one fixture value failed the coverage test with the exact property named. A test that cannot fail is worth nothing, and neither of these was taken on trust.

**Verified end-to-end on real Postgres, not only SQLite.** A scratch database was created empty, the app booted against it (running migrations and seeding for real), and it came up with all 28 playbooks and every edge-case feature intact: 2 advanced moves, 7 look group labels, 1 numeric leaf, 13 move-internal sections, 322 nested options, 1 null track description. Re-exporting from that scratch database produced a file **byte-identical** to the one exported from the dev database — so `dev DB → file → fresh Postgres → file` is lossless. Scratch database dropped afterwards; the dev database was never touched.

179 API tests pass (172 before, 6 new, and `InitializeAsync` gained a `contentRootPath` parameter).

Not designed this pass — the bespoke-section shape's actual EF Core implementation (Phase 5/7) needs to land first, and per Phase 6's own note above, so does Phase 6's Move-internal-pick schema if the 3 pilots demonstrate a need for it. **The reading prerequisite is now satisfied**: all 28 playbooks (not just Chosen/Crooked/Divine) have been read at full depth and catalogued for bespoke content (`bespoke-ruleset-catalogue.md`, complete 2026-08-29) — Phase 8's own authoring/seeding work is still unstarted, but it no longer needs to re-derive the bespoke model's shape playbook-by-playbook the way Phase 5's walkthrough did; it can author directly from the already-verified catalogue. (Phase 6's own equivalent full-playbook read for Move-internal structure is a separate, not-yet-done prerequisite — see Phase 6's note on the existing trap list being a seed, not a census.) Depends on Phases 2–7 having proven out against all 28, not just 3 — per the task brief's own framing, this is explicitly out of scope for this pass.

**Authoring mechanism, already settled by Phase 4's revision, not a new fork**: same as Phase 4 — an AI agent authors each remaining playbook via the real API, one bounded task per playbook (`architecture.md` Section 4's granularity recommendation), standard fields, bespoke fields, and Move-internal fields all three, since Phase 5/6/7's combined pattern will be established by then. **Inherits the Skill built during Phase 4** (extended per Phase 7's note above to cover bespoke fields, and per Phase 6's own deliverable to cover Move-internal fields) rather than re-deriving the procedure from scratch — this is the payoff of Phase 4's extra pattern-validation rigor: Phase 8 runs the same, already-proven, invokable procedure 25 more times instead of discovering the pattern's rough edges for the first time at 25-playbook scale.

**Phase 8's closing step, resolved 2026-08-25, is the actual production seed conversion**: once all 28 playbooks are fully authored (standard + bespoke + Move-internal), run the one-off script (built once, not maintained as ongoing tooling) that reads the working database and produces `Data/Seed/hunter-playbooks.json`, commit it, and extend `MotwDbInitializer` with a `SeedPlaybooksAsync` step guarded by the same blanket `AnyAsync()` pattern every other seeded table uses. This is the one point in the whole initiative where the canonical set actually becomes present in every environment automatically. After this runs, any further canonical-playbook changes go through normal EF Core migrations, not by re-running this script. Full mechanism: `architecture.md` Section 4.

## Phase 9 — Hunter instance list UI (fully specified; **implemented 2026-08-31**)

**Delivered exactly as specified**, plus two additions and one deviation, each recorded below and in `architecture.md` Section 7.

Backend: `Hunter` entity in a new `HunterEntities.cs`, the `AddHunter` migration (one table, `Restrict` FK, `idx_hunters_playbook_id`), `HunterContracts` / `IHunterRepository`+`HunterRepository` / `IHunterService`+`HunterService` / `HuntersController`, DI registered. Frontend: `HunterService.getAll()`, `HUNTERS_ROUTES`, `HuntersListComponent`, the `Hunters` nav entry, the `icon-nav-hunters` sprite symbol, and the `NavIconKey`/`SINGULAR_ENTITY_TYPE_TO_NAV_KEY` additions.

**Deviation — no delete button on the list row**, unlike `MonstersListComponent`. `DELETE /api/hunters/{id}` is Phase 10, so the button would fail on click. The dead *links* this phase specifies are a different thing: those fall through the wildcard to the dashboard, which was verified rather than assumed.

**Addition 1 — one new theme token pair** (`--color-badge-playbook`, light and dark), so the Playbook badge on a hunter row is not borrowing `badge-archetype`, whose own comment names it as Monster's.

**Addition 2, and the one worth reading — `DELETE /api/playbooks/{id}` now returns `409` when Hunters are built from the playbook.** `architecture.md` Section 3 deferred this to "Phase 9/10"; Phase 9 is where it becomes reachable, because `Hunter` is the first row that can reference a Playbook. Left alone, the required FK would have defaulted to `Cascade` and deleting a Playbook would have silently deleted every Hunter built from it. The FK is `Restrict`, and the service guard turns that into an actionable message instead of an unhandled constraint violation. Costs: `ServiceErrorType.Conflict`, and `IPlaybookService.DeleteAsync` returning `ServiceResult<bool>` instead of `bool` (a bare bool cannot distinguish "missing" from "in use"). The **per-child-row** version of this check — a move or gear option a Hunter references — remains Phase 10, since those bridge tables do not exist yet.

**Verified by driving the real app in a browser**, not just by compiling: nav entry and icon symbol resolve, rows render with playbook names in light and dark themes, both dead links land on the dashboard cleanly, the empty state reads correctly, and all three delete outcomes (`204` unreferenced / `409` in use / `404` missing) were checked as distinct. 179 API tests and 337 Angular tests pass. Test hunter rows were removed afterwards; the dev database is back to 28 playbooks and 0 hunters.

**What**: One new `NavItem` in `page-layout.ts` (`{ label: 'Hunters', route: '/hunters', icon: 'hunters', exactMatch: false }`), one new icon symbol (`icon-nav-hunters` in `shared/icons/icon-sprite.component.ts`, plus the `hunters` key added to `DomainIconComponent`'s `NavIconKey` union and `SINGULAR_ENTITY_TYPE_TO_NAV_KEY` map), and a `HuntersListComponent` following `MonstersListComponent`'s shape exactly (flat `GET /api/hunters`-backed list, no mystery-scoping — Hunters aren't Mystery-owned).

**Dead links, as specified**: `routerLink`s to `/hunters/new` and `/hunters/{id}` render, but those routes either don't exist yet or 404 gracefully — wiring lands in Phase 10. This mirrors how earlier standalone-creation phases in this codebase have sequenced list-before-create work.

**Backend needed this phase**: `GET /api/hunters` (flat list) and the underlying `Hunter` entity/migration (minimal shape — enough for a list row: `Id`, `Name`, `PlaybookId`/`PlaybookName`, `CreatedAt`) — full create/edit contract lands in Phase 10.

**Confirmed 2026-08-25**: Hunters will eventually be many-to-many with Mysteries, but not this pass, and it isn't a concern for this phase's schema either — the future bridge table is a pure addition with nothing in this phase's `Hunter` shape that it would need to change (`architecture.md` Section 3).

## Phase 10 — Hunter create/edit UI (fully specified, with recommendation; **implemented 2026-08-31**)

**Delivered**: `AddHunterSheetAndPicks` migration (Hunter gains `Pronouns`/`PlaybookStatArrayOptionId`/`Luck`/`Harm`/`Experience`/`Background`; new `hunter_moves` and `hunter_gear_selections` composite-key bridges), `HunterContracts` / repository / service / `GET`+`POST`+`PUT`+`DELETE /api/hunters`; frontend `HunterFormComponent`, `HunterCreateComponent`, `HunterDetailComponent`, the `new` and `:hunterId` routes, and the delete control the list page deliberately went without in Phase 9.

**`DELETE /api/hunters/{id}` is here even though this phase listed only GET/POST/PUT.** Without it, Phase 9's playbook-delete `409` tells the user to "delete or reassign" hunters they would have no way to delete — a dead end this phase would otherwise create for itself.

**Scope held as Skyler confirmed**: standard fields plus one freeform box. `Hunter.Background` is that box. The bespoke-ruleset instance tables (`architecture.md` 6.4), `HunterExtraTrackValue`, and structured Looks/History capture are **not** built. Worth re-deciding now rather than assuming: the note below was written 2026-08-25 when Phase 5 was only a design, and said the form "gets revisited once Phase 5's bespoke-ruleset solution exists" — it now does, and all 28 playbooks' bespoke data is authored. **That revisit is a follow-on pass, not something folded in here**, and it is the obvious next piece of work.

**Server-side rules the form cannot be the only guard for**, all validated against the *selected playbook* rather than the payload: picks must belong to the playbook; advanced moves are refused outright (never available at creation); non-required picks may not exceed `MoveGrantCount`; gear picks may not exceed a category’s `PickCount` (**added 2026-08-31** — this one had been left to the Angular form alone, which is not enforcement); track values may not exceed the playbook's own box counts. `MoveGrantCount == 0` is treated as "no ceiling stated" rather than "no picks allowed", per `architecture.md` Section 3's warning about that value's ambiguity — otherwise an admin-created playbook with an unauthored Moves section could never have a hunter built from it.

**Two judgement calls worth knowing**: `PlaybookStatArrayOptionId` is **nullable** (a Path-B playbook whose rating arrays are not authored yet would otherwise be impossible to build a hunter from; the form requires a choice whenever the playbook offers one), and the playbook control is **locked in edit mode** (changing it would silently discard every pick).

**Also closed this phase**: the per-child-row half of the deletion guard — `PUT /api/playbooks/{id}` now returns `409` naming a move/gear/rating row a hunter is using rather than letting the Id-based diff delete it. That was the last "deferred to Phase 9/10" item in `architecture.md` Section 3.

**Verified by driving the real app**, plus 8 new `HunterServiceTests`: created a hunter through the form, confirmed the gated sections, the "n of N picked" counter locking further picks, per-category gear limits, the create → detail round-trip (name, pronouns, background, rating, moves, locked playbook), the child-removal `409`, and delete from the list. **Both new guards were negative-tested** — and one of them found a real bug (the EF fixup trap in `architecture.md` Section 8) rather than merely confirming what was already working. 187 API tests and 337 Angular tests pass. Test rows removed; a re-export of the seed came back **byte-identical** to the committed file, so the playbook `PUT` exercised during testing churned no child ids.

### Follow-on 10a — structured Looks and Extra Tracks (**implemented 2026-08-31**)

Skyler split the deferred structured-capture work: do Looks and Extra Tracks now, plan the bespoke rulesets before implementing. This is the first half.

**Two new composite-keyed tables** (`AddHunterLooksAndExtraTracks`): `hunter_look_selections` (hunter + look category → either an option FK or freeform text) and `hunter_extra_track_values` (hunter + track → current value). Both are keyed so that "one answer per line" and "one value per track" are structurally impossible to violate rather than rules someone has to remember.

**`HunterExtraTrackValue` deviates from `architecture.md` 6.4's sketch**, which shows a surrogate `Id`. There is exactly one value per (hunter, track), so the composite key says that directly; a surrogate would need an extra unique index to say the same thing, and would introduce a third convention into a file that already has two composite bridges.

**Design checked against the data, not assumed**: all 77 look categories across the 28 playbooks allow freeform, options run 3–12 per line, and exactly 7 categories carry a `GroupLabel` (The Forged's "Human look"/"Weapon look" split). The form groups by *consecutive run* of matching label rather than by distinct label, so the sheet's own line ordering survives instead of being reordered to gather labels together.

**One answer per look line**, matching how the sheet works — a row of alternatives with one circled. If multiple picks per line ever turn out to be wanted, the composite key is the single thing to change; that is noted on the entity.

**"Exactly one of option / freeform"** is enforced in the service, because no database constraint here expresses it. Both failure directions are tested.

**The playbook-edit guard grew two cases**, and one is genuinely easy to miss: a freeform answer references only the *look category*, with no option id at all, so a guard watching only look options would let a line be deleted out from under everyone who wrote their own text for it. Extra tracks were added to the guard too.

**Verified by driving the app**: The Forged's grouped look lines render as two labelled groups (3 and 4 lines); the Curse-Eater's Corruption track renders with its description and clamps to 7; clicking an option clears that line's custom text; a hunter with one freeform answer, one picked option and a track value at 4 round-trips through save → reload; and dropping the track from the playbook returns `409` naming it. 192 API tests (5 new) and 337 Angular tests pass. **The new guard was negative-tested** by removing only the look-category half — the one test that should fail did, and the neighbouring guard tests still passed.

**Still deferred, and now the only thing left in `Hunter.Background`**: bespoke rulesets (including move-internal ones) and History. Plan first, per Skyler.

### Follow-on 10b — bespoke rulesets on the Hunter sheet (**planned 2026-08-31, not started**)

Skyler asked for a plan before implementation. This is it. Two questions were put to him and both are answered below; one open item remains, flagged at the end.

**Scope: everything bespoke, in one pass** (Skyler's call). That includes move-internal sections, repeatable sections, and the journal — the alternatives (deferring repeatables, or the journal) were offered and declined.

**Move-internal sections are in scope and cost almost nothing extra.** Phase 6 modeled a Move's own pick-structure as `BespokeSection.PlaybookMoveId` — the *same four tables*, owned by a move rather than the playbook (`architecture.md` 6.8). 13 of the 49 sections are move-internal. The instance side is indifferent to who owns a section, so including them is a rendering decision (inline under their move, where the rules text already is), not a parallel mechanism. Excluding them would have been more work, not less.

**What the data contains**, measured rather than estimated:

| | Count |
|---|---|
| Sections | 49 — 13 move-internal, 10 zero-option fixed grants, 3 free-text, 3 repeatable |
| Sections with a pick count | 39 — **all 39 have `MinSelect > 0`** |
| Options | 529 — 207 top-level, 322 nested, 46 carrying their own `MinSelect > 0` |
| Max option-tree depth | 3 (23 options that deep) |
| Numeric leaves | 1 |
| Journals | 1 |

**Schema**: the four instance-side tables exactly as `architecture.md` 6.4 specifies — `HunterBespokeSelection`, `HunterBespokeSectionInstance`, `HunterJournalEntry`, `HunterJournalEntryFieldValue`. Unlike Looks and Extra Tracks these genuinely need surrogate keys (a repeatable section has many instances; a journal has many entries), so 6.4's shape stands as written. The 10 zero-option sections need **no instance rows at all** — the hunter has that ability unconditionally by virtue of the playbook, the same way a `Required` move needs no per-hunter record.

**~~Validation: minimums *and* maximums, enforced recursively~~ — superseded 2026-08-31, see the completeness section below.** The original reasoning is worth keeping, because it is the reasoning that was weighed: every pick-bearing section has a real minimum, so under strict enforcement a hunter could not be saved until each one was fully answered — a Crooked has five such sections — buying a guarantee that no stored hunter ever violates its playbook’s rules, at the cost of no partial progress and no resumable work.

**Revised 2026-08-31 — the maximums stay, the minimums move.** Skyler delegated the direction outright and it was reversed: maximums are refused on save, minimums are derived and reported. What this changes for 10b is only *where each rule goes*, not what it has to know — a section’s `MaxSelect`/`MaxInstances` becomes another case in `HunterService.Validate`, and its `MinSelect` becomes another line in `HunterCompleteness.Evaluate`, which exists and is tested. Nothing about the four instance-side tables, the recursive renderer, or the playbook-edit guard changes. Full reasoning in `architecture.md` Section 9.

**The open item this originally created is closed, and it did not close the way this entry recommended.** The inconsistency was real: lenient move picks beside strict bespoke sections. The resolution brought everything into line with the *lenient* side rather than the strict one — move picks stayed a ceiling, and gear `PickCount`, which was enforced nowhere on the server, became one too.

**UI**: a recursive component rendering an option tree to depth 3, with independent pick limits at each level. "Is this category engaged" stays **derived from leaf picks and never stored** (6.4's existing decision) — there is no flag to keep in sync and therefore no way to reach a category marked engaged with nothing under it. Free-text sections, the single numeric leaf, repeatable-instance add/remove, and journal-entry add/remove are each their own small renderer selected by the same shape-derivation rule the admin form already uses (no discriminator column).

**The playbook-edit guard extends here too**, the same way it just did for looks: a `BespokeOption` a hunter selected must not be removable, and — the analogous easy-to-miss case — a **section** referenced by a free-text answer or a section instance must not be removable either, since those carry no option id.

**Known risk, from `architecture.md` 6.9**: the bounded-repeatable free-text combination (`FreeTextLabel` + `MinInstances`/`MaxInstances`, zero options — the Searcher's Network and the Spell-Slinger's Arcane Reputation) is valid in the model but *has never been exercised*. It is the least-proven part of the design and deserves deliberate verification first, not last.

**Recommendation: single-page reactive form, following the `MonsterFormComponent`/`MonsterCreateComponent` precedent — not a multi-step wizard.** Full reasoning in `architecture.md` Section 8. Summary of the deciding argument: the Mystery wizard's complexity exists to sequence *ordered child-entity creation* (a Monster needs an `Id` before its Attacks can be attached); Hunter has no equivalent — everything is data about the Hunter itself, submittable in one request, the same way Monster's own core fields already are. The one real complication (nothing renders until a Playbook is picked, since every pick-list is Playbook-scoped) is solved with a reactively-gated single page — the same pattern `data-admin.ts`'s table-selector and `monster-create.ts`'s `isSpecial`-conditional validator already use — not a second navigation step, which the standalone-creation initiative's own resolved decisions already rejected for this exact shape of problem.

**Components**: `HunterFormComponent` (shared core-fields form, mirrors `MonsterFormComponent`'s `@Input() hunter | null` / `@Output() save` contract), `HunterCreateComponent`/`HunterDetailComponent` (own the `HunterService.create()`/`.update()` calls), a new `PlaybookService` (mirrors `ReferenceDataService`'s shape) to load the selected Playbook's move/gear/rating/look options reactively off a `playbookId` control's `valueChanges`.

**Backend needed this phase**: `POST /api/hunters`, `PUT /api/hunters/{id}`, `GET /api/hunters/{id}`, and the full `Hunter`/`HunterMove`/`HunterGearSelection` schema from `architecture.md` Section 3 — `Hunter.PlaybookStatArrayOptionId` is a live FK, not a copied set of stat columns (resolved 2026-08-25; see Section 3).

**Resolved 2026-08-25**: what happens to an already-created Hunter's sheet when its Playbook is later edited — Hunters stay live-linked (FK-based) to the Playbook's own rows, not snapshotted. If a template changes, existing Hunters built from it change too; that's the intended behavior, not a bug to design around. This was previously an open question; it's now settled in the schema itself (`architecture.md` Section 3).

**Still not resolved in this pass, per Skyler's confirmation**: the full field-by-field shape of "Looks"/history/background capture on the Hunter form is genuinely deferred, as anticipated — Skyler confirmed the first pass of this form implements only the Phase 2 standard fields plus a placeholder freeform text box, not real bespoke-ruleset support, and that the form gets revisited once Phase 5's bespoke-ruleset solution exists.

## Hunter completeness — a decision spanning Phase 10 and 10b, not a numbered phase (decided and **implemented 2026-08-31**)

**Skyler's call, delegated in full**: asked earlier how strictly the server should enforce a bespoke section's pick counts, he chose the strict option, then handed the whole question over — "have Yoshi make a decision to lean in one direction or the other and implement." The earlier selection was explicitly not binding. It was **reversed**.

**Decided: a hunter is savable and resumable at any stage.** A rule is refused on save only when the stored row would assert something *false* about its playbook — a pick that isn't the playbook's, a duplicate, an advanced move, more picks than a stated ceiling allows, a value past a track's last box. A rule that only says the hunter is *unfinished* — no rating array, too few move picks, a gear category short of its count, unanswered look lines — is computed on read and reported on `HunterDetailResponse.Outstanding`, never enforced. Empty list means ready to play.

**The deciding argument, stated once here and in full in `architecture.md` Section 9**: hunters are live-linked to playbooks, so "every stored hunter satisfies its playbook's minimums" is not an invariant the database can hold — a playbook edit falsifies it for every hunter built from that playbook without touching any of them. Strict enforcement buys a guarantee true only at the instant of the last write, and costs a lockout with no migration path: after such an edit the hunter cannot be saved at all, so its owner cannot fix a typo in its *name* without first finishing rules work. Since completeness has to be recomputed on read to be correct at all, blocking the write adds only the lockout. **Accepted in exchange**: the database will hold hunters that are not legal characters, and every future reader has to cope with that.

**Two shipped inconsistencies closed, in opposite directions.** Gear `PickCount` was enforced only by the Angular form disabling checkboxes — it is now a real server-side ceiling. The rating array was required by the form while the API allowed null — the form now reports it as a shortfall instead, matching the nullable column Phase 10 chose deliberately for Path-B playbooks.

**Deliberately excluded from completeness**: extra tracks and Luck/Harm/Experience. A missing value is indistinguishable from `0`, and `0` is a real starting position, so no answer is being withheld. Their ceilings are still enforced.

**Also deliberately excluded**: `Outstanding` on the hunter *list* row. Computing it per row needs the full template graph for every distinct playbook in the list, to answer a question the user acts on only after opening the hunter.

**What 10b inherits**: one evaluator to extend rather than a rule to invent. Its 39 `MinSelect > 0` sections become lines in `HunterCompleteness.Evaluate`; its `MaxSelect`/`MaxInstances` become cases in `HunterService.Validate`. No schema change either way.

**Verified by driving the real app**, not just by compiling: a Crooked hunter saved with nothing but a name and a playbook; its detail page listed all four outstanding items in sheet order; filling every section in flipped it to a "Ready to play" badge; a hand-made `PUT` over-picking gear came back `400` naming the category; and — the case the whole decision turns on — growing the playbook's `MoveGrantCount` from 2 to 3 made the untouched hunter report "Moves: 2 of 3 picked." while an unrelated rename still saved. Both themes checked. 197 API tests (5 new) and 344 Angular tests (7 new, in the hunters feature's first spec file) pass. **All three new guards were negative-tested**, each failing exactly its own test and no neighbours; a fourth sabotage — putting `Validators.required` back on the rating control — failed exactly the three specs that assert the decision. The dev database is back to 28 playbooks and 0 hunters, and a seed re-export came back byte-identical to the committed file.


## Testing — a deliberate cross-cutting step, not a numbered phase (decided 2026-08-30)

**Skyler's call**: test coverage for the Playbook domain is written **after** Phases 1–4 are implemented and the kinks are ironed out, not incrementally within each phase. Exact reasoning, in Skyler's words: "I am inclined to make this a step that comes later, after we have implemented everything and ironed out the kinks, so we're not constantly fixing code in two+ places. If crafting the tests identifies some latent bug, then we're better for it."

Deliberately **not** given a phase number — the 2026-08-29 renumber already demonstrated how expensive numbered insertions are across this doc set, and this step is cross-cutting rather than sequential.

**Shape, as specified:**
- **Full CRUD unit tests with mocking** — `PlaybookServiceTests`, matching the existing `MonsterServiceTests`/`MysteryServiceTests` convention in `MonsterOfTheWeek.Api.Tests/Services/`.
- **One full CRUD integration test** exercising real behavior end-to-end, including validation. **Explicitly generic, not per-playbook**: it flexes the functionality irrespective of any particular playbook's content. Skyler was direct that exhaustively testing every playbook scenario is unnecessary given proper mocking.
- **Angular specs cover form reactivity only** — no integration concerns from that layer. In practice this means the `playbookId`-gated conditional rendering and the child-collection editors' own reactive behavior, not API round-trips.

**One thing this step should verify specifically, since nothing else will**: that the `GET` → form → `PUT` round-trip preserves child row `Id`s (Phase 3's upsert semantics). It's the subtlest requirement in the whole vertical slice, it has no visible symptom until a `Hunter` row exists to break, and Hunters don't exist until Phase 9 — so a test is the only thing standing between a silent regression here and discovering it several phases later.

**Phase 1 is exempt** and keeps its own inline obligation: the existing `data-admin.spec.ts`/`weapon-tag-admin.spec.ts` must keep passing unchanged, since that phase is a pure structural re-wrap of working UI.
