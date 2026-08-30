# Hunter Playbooks PDF formatting extraction — spike/POC tools

Standalone, one-off tooling. **Not a dependency of the deployed app** — this
directory has its own `package.json`/`node_modules`, separate from
`src/web`'s. Nothing here is wired into the Angular or .NET build.

Purpose: extract bold/italic (and, with more per-playbook effort, bulleted
lists) from `Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf`
into the small HTML subset (`<b>`, `<i>`, `<ul>`, `<li>`) the app's
`DescriptionText`-shaped fields are meant to store. `pdftotext -layout`
(this project's established extraction tool) cannot see this — bold/italic
information is discarded by `-layout` mode.

See `docs/hunter-playbooks/pdf-extraction-pipeline.md` for the full writeup
(what was tried, why this approach, how to run it per-playbook going
forward).

**Immune to PDF stream-order defects (verified against a real one, on The
Forged's pages — see the pipeline doc's "Pipeline-integrity check"
section).** Column selection here is always by physical x/y coordinate
(`--minX`/`--maxX`/`--minY`/`--maxY`, read off `dump-page.mjs`), never by
which block comes first in the PDF's internal text-stream order. A page
whose columns 2 and 3 are swapped in stream order (a real defect found
by Skyler, likely a PDF-generation artifact) has no effect on this
pipeline's output — it only matters for tools/workflows that follow
logical/stream order (drag-select in a viewer, naive concatenation of
`textContent.items` without a coordinate filter).

## Setup

```
npm install
```

(`pdfjs-dist` only — no native/binary dependencies, works the same on
Windows/macOS/Linux since it's pure JS.)

## Scripts

- **`dump-page.mjs <pdfPath> <pageNumber>`** — diagnostic. Dumps every raw
  text item on a page (text, x/y position, font id) as JSONL. Use this
  first on a new page to find the x-coordinate ranges of the columns you
  care about (needed for `--minX`/`--maxX` below) and to sanity-check
  which font ids are in play.

- **`list-fonts.mjs <pdfPath> <firstPage> <lastPage>`** — diagnostic.
  Resolves every font id used across a page range to its actual embedded
  PostScript name (e.g. `WarnockPro-Bold`). Confirms the font-naming
  convention holds before trusting `extract-runs.mjs`'s classification.
  **Font ids are NOT stable across pages** — `g_d0_f3` is bold on one page
  and a symbol/bullet font on another. Never hardcode a font id -> style
  mapping; always resolve per page (both scripts already do this).

- **`extract-runs.mjs <pdfPath> <firstPage> <lastPage> [--json] [--minX N] [--maxX N] [--minY N] [--maxY N]`**
  — the real extractor. Produces contiguous bold/italic/bold-italic text
  runs in reading order, classified by pattern-matching the resolved
  embedded font's PostScript name (`-Bold`, `-It`/`Italic`/`Oblique`
  suffixes). **Always pass `--minX`/`--maxX`** scoped to the column you're
  extracting from — this PDF is multi-column throughout, and without an
  x-range filter, bold/italic text from an unrelated column on the same
  page (e.g. a character-sheet sidebar heading) can text-collide with the
  section you actually want and get spliced in wrongly. Read the x-range
  off a `dump-page.mjs` run for that page. **`--minY`/`--maxY`** (added
  for Curse-eater's Corruption paragraph): the same idea vertically —
  needed when a "Moves" list and a prose section (e.g. "Corruption") sit
  in the *same* column, since x-scoping alone can't tell them apart; an
  unrelated italic "and" from the Moves section above wrongly spliced
  into the Corruption paragraph's own text before this was added.

- **`splice-formatting.mjs <plainTextFile> <runsJsonFile> [--pages N,M]`**
  — takes a plain-text block for ONE option/section (not a whole page —
  copy it out of your existing `pdftotext -layout` output, the same way
  `bespoke-ruleset-catalogue.md` entries were authored) and the JSON runs
  file, and re-inserts `<b>`/`<i>` tags by sequential substring matching.
  Warns on stderr about any run it couldn't find in the block (harmless if
  the block is deliberately narrower than the runs file's page range).

- **`build-crooked-review.mjs <pdfPath>`** — worked example / regression
  check. Runs the full pipeline over every option in The Crooked's
  Background/Heat/Underworld (pages 11-12), using the already-vetted plain
  text from `bespoke-ruleset-catalogue.md`, and writes
  `crooked-background-review.json` (title/descriptionText pairs — the
  actual `BespokeOption` shape) and `crooked-background-review.html` (open
  in a browser to eyeball against the PDF — bold rendered red, italic
  blue, purely to make them easy to spot side by side with the source).
  Re-run any time to confirm the pipeline still produces the Hoodlum
  acceptance-test string exactly (printed at the end of the run).
  **Validates `<b>` only** — this playbook/section has no italic or
  bulleted-list content to exercise those tags against.

- **`extract-moves.mjs <pdfPath> <page> --minX N --maxX N [--minY N] [--maxY N] [--json]`**
  — a second extraction primitive, needed for shapes `splice-formatting.mjs`
  can't handle: a "Moves"-style list column where entries have a bold
  title, inline bold/italic body emphasis, AND (for some entries) a
  nested bulleted roll-result breakdown that needs real `<ul>`/`<li>`
  structure. Reconstructs full HTML directly from the PDF's item stream
  (position + resolved font per item) rather than splicing tags into
  hand-copied plain text. Distinguishes the top-level move bullet (the
  `b` glyph from the FateCoreGlyphs *symbol* font) from nested
  sub-bullets (a literal `•` character in the *ordinary* body font) —
  these are visually similar but structurally different signals, and
  conflating them would either miss nested lists entirely or wrongly
  split moves at every roll-result line. `--minY`/`--maxY` (added for
  Covenant's "Type" options): scope to just a sub-range of a column's
  items when a plain, non-bulleted line is sandwiched between two
  bulleted groups — without it, that line silently gets absorbed as
  trailing body text of whichever bulleted entry precedes it, since
  segment-splitting only keys off bullet markers. **`flatBodyHtml`**
  (added for The Pararomantic's "Bond Abuse" text): when a column has
  ZERO top-level `b`-glyph bullets at all (just flowing prose with real
  nested `•` lists, or none), `moves` comes back empty and `intro` alone
  can't produce `<ul>`/`<li>` structure or preserve inline bold/italic —
  in that case the result also includes a `flatBodyHtml` field built by
  the same nested-list-aware body logic each move's own description
  uses, applied to the whole column. Only fires when no top-level
  bullets are found; every prior invocation of this script targets a
  column that does have them, so this is purely additive.

- **`build-covenant-moves-review.mjs <pdfPath>`** — worked example over
  The Covenant's Moves section (page 9), chosen specifically to validate
  `<ul>`/`<li>` and `<i>` (Crooked's Background test only exercised
  `<b>`). Writes `covenant-moves-review.json`/`.html` in the same style as
  the Crooked review. Confirmed: 2 of 7 moves (`Fast Friends`, `Smash Cut`)
  produce real `<ul><li>` roll-result breakdowns, 2 moves carry inline
  `<i>` emphasis, and move names/trigger phrases carry `<b>` — all three
  enumerated inline/list tags exercised in one section.

- **`build-divine-mission-review.mjs <pdfPath>`** — The Divine's Mission
  (page 15), flat/description-only/pick-1, same shape as Crooked's Heat —
  reuses `extract-runs.mjs`/`splice-formatting.mjs` unchanged. Writes
  `divine-mission-review.json`/`.html`. Found one genuine inline italic
  (option 5: "…protect them at `<i>any</i>` cost."); the other 4 options
  are correctly plain, confirmed from the raw PDF, not assumed.

- **`build-chosen-fate-review.mjs <pdfPath>`** — The Chosen's Fate (page
  8): three mandatory pick-groups, all label-only (no description text).
  Writes `chosen-fate-review.json`/`.html`. Runs `extract-runs.mjs` and
  programmatically checks every detected bold/italic run against every one
  of the 33 tag labels — **0 collisions**, confirming the tags are
  genuinely plain rather than just eyeballing the PDF once and assuming
  so. Prints this check's result directly.

- **`build-action-scientist-area-of-study-review.mjs <pdfPath>`** — The
  Action Scientist's Area of Study (page 1, front page, middle column, x
  ~280-525), 7 options, 3 with a nested bulleted sub-list — uses
  `extract-moves.mjs`, same as Covenant. First real (non-pilot) authoring
  use of this pipeline. Checking all 7 options directly (not trusting a
  shape summary) found real inline formatting in 3 options that had been
  assumed plain — see the doc for the full trace. Also the pass that found
  and fixed two real spacing bugs in `extract-moves.mjs` itself (a missing
  space at a style-change-exactly-at-line-wrap boundary, and a follow-on
  stray space right after a closed `<ul>`) — both fixes verified against a
  full Covenant regression re-run, not just the new playbook.

- **`build-changeling-unknown-heritage-review.mjs <pdfPath>`** — The
  Changeling's Unknown Heritage (page 6, leftmost column, x ~30-270). A
  new shape: 10 flat label-only tags with zero body text (no fit for
  `extract-moves.mjs`'s title+body model) plus a long section-level
  explanatory paragraph attached to none of the tags individually — uses
  `extract-runs.mjs` once over the column plus `splice-formatting.mjs`
  against just that trailing paragraph. Found 2 bold cross-reference spans
  in the paragraph, zero formatting on all 10 tags (checked
  programmatically, same technique as Chosen's Fate). Also resolves a
  specific schema-relevant question directly from the raw PDF: **no blank
  marker prints after "Allergy to"/"Repulsion from"/"Attraction
  to"/"Obsession with"** (different from Heat's inline `________`
  convention) — printed in full by the script, not just a yes/no.

- **`build-covenant-friendship-review.mjs <pdfPath>`** — The Covenant's
  "Covenant"/"Friendship" ally-selection ruleset (page 9, **right**
  column, x ~525-760 — a different column than
  `build-covenant-moves-review.mjs`'s Moves column on this same page).
  Another mixed shape: 2 flat prose blocks (spliced), 3 title+description
  "Type" options (`extract-moves.mjs`, using the new `--minY`/`--maxY` to
  avoid absorbing the plain "Describe the ally:" lead-in line that sits
  between the Type options and the Style tags), and 8 label-only "Style"
  tags (confirmed plain, listed directly). Found one genuine italic span
  (`Monster of the Week`, a book-title cross-reference) and confirmed the
  same "blank marker absent despite a trailing colon implying a fill-in"
  finding as Changeling's tags, this time after "Something else".

- **`build-curse-eater-review.mjs <pdfPath>`** — two targets from The
  Curse-eater. Page 13's "Corruption"/"Consumed MagiC (Power, Downside)"
  column (x ~280-520, y-bounded 80-245 to exclude the Moves section
  sharing the same column) — found and fixed the same same-column
  false-positive class as Covenant's pass, this time in
  `extract-runs.mjs`'s flat-splice path rather than `extract-moves.mjs`'s
  bullet path, via the same `--minY`/`--maxY` fix applied to
  `extract-runs.mjs` too. Also confirms "Consumed MagiC (Power,
  Downside)" has zero body text of its own (just a tracker heading) —
  contradicts the proposed 2-part paragraph split, flagged for Yoshi.
  Page 14's "How consuming magic works" (x ~280-520, flat pick-1-of-5,
  entirely plain) — includes the **first confirmed-PRESENT blank marker**
  in this pipeline's output: `"Something else: "` + exactly 30 literal
  underscore characters, all one plain-font PDF text item.

- **`build-envoy-review.mjs <pdfPath>`** — two targets from The Envoy.
  Page 17's "Task"/"Secret Wisdom" (right column, x ~525-760) — Task and
  Secret Wisdom's EffectText reuse **identical labels**
  (Guide/Herald/Watcher/Witness) for two different lists in the same
  column, so both are Y-bounded tightly to their own item ranges to avoid
  merging/bleeding into each other; Secret Wisdom's Description
  (roll+Cool paragraph) is spliced separately per the coordinator's
  proposed Description/EffectText field split. Page 18's "Overseers"
  (left column, x ~30-270) — found and fixed another same-text
  false-positive: the bold "Overseers" section heading collided with the
  ordinary word "Overseers" naturally occurring in its own section's
  prose; fixed by narrowing the Y bound to exclude the heading. Confirms
  a **third distinct blank-marker rendering convention** on the two
  "Something else" entries (Values and Concerns, checked independently):
  both present, both 21 underscores, but as a *separate text item on the
  next line* rather than Curse-eater's single-line inline form.

- **`build-expert-haven-review.mjs <pdfPath>`** — The Expert's Haven
  (page 19, right column, x ~525-760), 9 title+description options, one
  clean Titled Choice section, no new schema. Found and fixed a real
  extractor gap in `extract-moves.mjs`: Haven's titles are delimited by a
  **period** (`"Lore Library. When you..."`) rather than every prior
  playbook's colon, which left a stray leading `". "` on every
  description until fixed (mirrors the existing trailing-colon strip on
  titles). Also a concrete negative finding, specifically checked rather
  than assumed: Armory's roll-outcome breakdown looks like Action
  Scientist's bulleted 10+/7-9/miss options but has **zero** `•`
  bullet-marker characters in the source — it's flowing prose, not a real
  list, despite the similar game-mechanical shape.

- **`build-forged-review.mjs <pdfPath>`** — two targets from The Forged.
  Page 23's Bonds/Burdens/Dual Nature/Range/Benefits/Flaws column (x
  ~280-520, Y-bounded to exclude Partner's own Move text, out of scope
  per the coordinator). **A first for this pipeline**: Benefits (8
  entries) has no bold-run signal distinguishing a title at all — every
  line is one plain-font text item — so its title/description split is
  this script's own colon-splitting, not a font-derived extraction like
  every prior title+description shape; flagged explicitly, not presented
  as equivalent. Page 24's Origin column (Forging + Partnering, 14
  description-only options total) is fully plain. Confirms two more
  present blank markers (Bonds', Burdens' — 30 underscores, matching
  Curse-eater's convention) plus two more (Forging's, Partnering's — 27
  underscores, same convention, different count) — a third distinct
  underscore count now observed within the same "inline single-item"
  rendering convention.

- **`build-gumshoe-code-review.mjs <pdfPath>`** — The Gumshoe's "Gumshoe
  Code" (page 25, x ~280-520, Y-bounded to exclude Moves-intro/Occult
  Confidential/Naked City content sharing the same x-range below it). A
  new shape (freeform sentence, schema still pending). **A first for
  this pipeline**: the 6 example codes render as ONE continuous ITALIC
  run with no bullets or other delimiter — every prior "block of
  options" pass was either a real bulleted list or plain prose. Output
  includes both the raw italic block and a convenience 6-sentence split
  (this script's own sentence-boundary parsing, not a PDF signal, same
  caveat treatment as Forged's Benefits). Confirmed `<b>manipulate
  someone</b>` bolded as specifically asked, **plus** confirmed the
  playbook's own bespoke move names (`The Postman Always Rings Twice`,
  `The Long Goodbye`) are *also* bold — the base-move-cross-reference
  pattern extended to a playbook referencing its own moves, not seen
  before.

- **`build-hex-review.mjs <pdfPath>`** — The Hex, spanning 4 pages (27
  front, 28 back, 29-30 a dedicated "Rotes" worksheet insert). Spot-checks
  `pdftotext -raw` for the column-swap defect before extracting, per
  standard practice — clean on all 3 pages actually used. Found two new
  false-positive classes, both documented in the script's own header
  comment and worth knowing before splitting a page's prose across
  multiple `splice()` calls: **(1) cross-call run leakage** — sharing one
  runs.json across multiple independent `splice()` calls covering the
  same flow lets an already-consumed run match again in a later call if
  the word reappears there as plain text; fixed by manually partitioning
  the runs array per paragraph. **(2) mixed-styling repeats defeat
  matching even within one call** — if the same phrase repeats with a
  PLAIN occurrence sandwiched between two BOLD ones, forward-only
  substring matching picks the wrong one; found on page 29's "rest"
  paragraph (3x "use magic", only the 1st and 3rd bold), verified against
  the raw item dump and **hand-corrected rather than trusted from the
  splice** — flagged explicitly in both the script and the JSON output,
  not silently patched over. Also: `<b>rote</b>` bolded on first mention
  (a term-definition bold, distinct from the established move-
  cross-reference pattern), and the worksheet's `"Rote:"` field label
  uses a decorative display font that is neither bold nor italic by this
  pipeline's classification — correctly excluded from `<b>`, flagged so
  it isn't mistaken for a missed one.

- **`build-host-symbiosis-review.mjs <pdfPath>`** — The Host's
  "Symbiosis" (page 31, x ~270-500). One clean, entirely plain section:
  framing sentence, 10 Benefits tags, and 7 Downsides tags all confirmed
  0 bold/italic (only the 3 structural section headings are bold).
  Includes an independent (not just trusted from Yoshi's own read)
  re-confirmation, straight from the raw PDF item stream, that no
  `EffectText`-candidate prose exists between the Downsides list and
  "Moves" — the item immediately after the last Downside is "Moves"
  itself, in a different x-column, nothing in between.

- **`build-initiate-sect-review.mjs <pdfPath>`** — The Initiate's "Sect"
  (page 34, x ~30-270). Another clean, entirely plain section (framing
  block + 13 Good Traditions + 12 Bad Traditions tags, 0 bold/italic).
  Hit a **fourth documented instance** of the heading-bleeds-into-body
  false positive (after Curse-eater's "and", Envoy's "Overseers", Hex's
  "Rotes"): the "Sect" section heading collided with the ordinary word
  "Sect" in the framing paragraph's own body text. Fixed by tightening
  the Y-bound. This class of bug now happens often enough to be a
  standing checklist item — after setting any Y-bound, check whether the
  section's own heading text reappears in the body being spliced.

- **`build-interface-integration-review.mjs <pdfPath>`** — The
  Interface's "Integration" (page 35, x ~280-505): Upgrades pick-2-of-8,
  Faults pick-2-of-7 (both label-only, side-by-side sub-columns, via
  `extract-runs.mjs`/`splice-formatting.mjs`), Origin pick-1-of-5
  title+description (via `extract-moves.mjs`). A clean pass with no new
  false-positive classes or bold-usage patterns — confirms the
  established technique set now handles this shape on the first try.

- **`build-monstrous-review.mjs <pdfPath>`** — The Monstrous: Monster
  Breed intro (page 37, x ~280-520, spliced — 1 italic span, source typo
  preserved verbatim per instruction), Curses pick-1 (page 37, same
  column, `extract-moves.mjs` with `--minY 180 --maxY 400` to exclude
  "Natural Attacks"' own heading bleeding into Dark Master's description),
  Natural Attacks (page 37, entirely-italic framing sentence + 4 Base/3
  Extra descriptions, all plain, no font-based title signal — same
  treatment as Forged's Benefits), and Monster Breed Suggestions (page
  38, 7 archetype entries, each a bold name + 3 italic field sub-labels —
  a new shape). Found and fixed two real bugs, both in the script's own
  header comment: (1) `extract-moves.mjs` needed a generic leading-`": "`
  strip (3 of 4 Curses options have a colon-free bold title followed by a
  regular run starting with the colon — the mirror image of Haven's
  leading-period bug), verified as a no-op against all 16 prior playbooks
  via full regression; (2) a *second* independent instance of cross-call
  run leakage (after Hex's) on page 38's 7 archetype entries, this time
  via an out-of-order shared-runs-list mechanism (an earlier, repeated
  run like "Curse" consuming the forward-only cursor before a later
  entry's own name-run — which appears earlier in that entry's own text —
  could be reached) rather than Hex's repeated-plain-word mechanism —
  fixed by scoping each entry to its own 4-run set instead of sharing one
  runs file across all 7 `splice()` calls.

- **`build-pararomantic-review.mjs <pdfPath>`** — The Pararomantic:
  Relationship Status track labels (page 41, both plain, confirmed
  programmatically), Bond Abuse (page 41, flowing prose with two real
  nested `•` lists but zero top-level bullets — the new `flatBodyHtml`
  fallback in `extract-moves.mjs`, added this pass, is what makes this
  extractable at all), Gear's Guide-Gift options (page 42, 4 options with
  zero title-delimiting signal of any kind in the source — titles in the
  output are the coordinator's own supplied labels, explicitly flagged
  as not PDF-derived, a stricter caveat than Forged's Benefits since
  Benefits at least had a real colon to split on), and Fate Of Your Love
  (page 42, entirely plain, confirmed programmatically). Found bold
  cross-references both directions between Bond Abuse and the memento
  Guide-Gift option ("fate of your love" / "bond abuse").

- **`build-professional-agency-review.mjs <pdfPath>`** — The
  Professional's "Agency" ruleset (page 44, x ~30-270): a clean
  2-mandatory-category section (Resources pick-2-of-10, Red Tape
  pick-2-of-9), no new schema. Caught a fifth instance of the
  heading-bleeds-into-body false positive (after Curse-eater's "and",
  Envoy's "Overseers", Hex's "Rotes", Initiate's "Sect") — the "Agency"
  section heading's own bold run wrongly matched the plain word "Agency"
  used twice in the framing paragraph's own body text; fixed with a
  tighter Y-bound (maxY=325, below the heading at y=332.68), same fix
  shape as every prior instance. With that fixed: framing block and all
  19 tags (10 Resources + 9 Red Tape) entirely plain, confirmed
  programmatically (0 collisions). Zero italic anywhere in the section.

## Recommended per-playbook workflow (see the doc for full reasoning)

Two content shapes need two different scripts — pick based on what the
section actually looks like:

**Flat description text with only inline emphasis (no nested lists)** —
e.g. Crooked's Background options:

1. `pdftotext -layout` the PDF as usual to identify the page(s) and get the
   authoritative plain text (already this project's established step).
2. `node dump-page.mjs <pdf> <page>` to find the x-range of the column(s)
   you're working in.
3. `node extract-runs.mjs <pdf> <firstPage> <lastPage> --json --minX N --maxX N > runs.json`
4. Per option/section: save its plain text (from step 1) to a small `.txt`
   file, then `node splice-formatting.mjs option.txt runs.json --pages N`
   to get the HTML-marked `descriptionText`.
5. Human/agent review — this is a splice, not a black box; check the
   stderr warnings and read the result before it goes in the catalogue.

**Move-style lists with bold titles and/or nested bulleted roll-result
breakdowns** — e.g. any playbook's Moves section (validated against The
Covenant's):

1. `node dump-page.mjs <pdf> <page>` to find the target column's x-range.
2. `node extract-moves.mjs <pdf> <page> --minX N --maxX N --json` — produces
   `{title, descriptionHtml}` per entry directly, including any `<ul><li>`
   structure, no separate splice step needed.
3. Human/agent review, same as above — this technique reconstructs HTML
   directly from item positions and is more sensitive to layout quirks
   than the splice approach; a known cosmetic (not correctness) artifact
   is that real soft-hyphen line-wraps in the source (e.g. "preventing"
   split as "pre- venting" across two lines) come through literally, same
   limitation `pdftotext -layout` already has — fix during review, don't
   try to solve it generically in the extractor.
