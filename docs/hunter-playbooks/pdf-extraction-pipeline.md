# Hunter Playbooks — PDF Formatting-Preserving Extraction Pipeline

**Status: spike complete and approved, 2026-08-26; now in active use across
playbooks beyond the original 3 pilots.** Validated against the concrete
acceptance test (Crooked/Background/Hoodlum, `<b>` only) — Skyler reviewed
`crooked-background-review.html` and confirmed it's sufficient, no Angular
preview needed. A second validation pass (same day, coordinator request)
confirmed `<i>` and `<ul>`/`<li>` on a different playbook/section (The
Covenant's Moves, page 9) — see "Second validation pass" below. A third
pass, after Yoshi confirmed `bespoke-ruleset-catalogue.md` is real
source-of-truth content (not just a structural reference), ran the
pipeline against the two remaining pilot playbooks' bespoke rulesets — The
Chosen's Fate and The Divine's Mission — see "Third pass: the remaining
pilot rulesets" below. A fourth pass ran the pipeline for real
authoring/modeling work (The Action Scientist's Area of Study, requested
by Yoshi via the coordinator) — see "Fourth pass" below. A fifth pass (The
Changeling's Unknown Heritage) introduced a genuinely new content shape —
flat label-only tags with zero body text, plus a long section-level
explanatory paragraph that isn't attached to any single option — and
resolved a specific schema-relevant open question (whether a blank marker
prints after 4 of the tags) directly against the raw PDF rather than
inferring it — see "Fifth pass" below. A sixth pass (The Covenant's
"Covenant"/"Friendship" ally-selection ruleset, a different column on a
page already partly extracted) added Y-range scoping to
`extract-moves.mjs` to handle a column that mixes bullet-driven
title+description entries with a plain lead-in line sandwiched between
two bulleted groups — see "Sixth pass" below. A seventh pass (The
Curse-eater, two targets) found the same same-column-different-section
false-positive risk in the *flat-prose* splice path this time (not just
`extract-moves.mjs`'s bullet-list path), so added the identical
`--minY`/`--maxY` scoping to `extract-runs.mjs` too — and delivered the
first case in this pipeline's whole run so far where a blank marker is
genuinely **present** in the source (every prior "blank marker" check had
come back absent) — see "Seventh pass" below. An eighth pass (The Envoy,
two targets) found a *second* independent case of two "Something else"
blank markers both genuinely present — but rendered via a third distinct
convention, different from both Changeling/Covenant's absent markers and
Curse-eater's single-line inline marker — and caught another instance of
the same-text-different-section false positive, this time a section
heading ("Overseers") colliding with the identical ordinary word inside
its own section's prose — see "Eighth pass" below. A ninth pass (The
Expert's Haven) found a small but real, generalizable extractor gap — one
playbook's title delimiter is a period rather than every prior
playbook's colon — fixed generically in `extract-moves.mjs`, plus a
concrete negative finding: an option that superficially matches a
list-bearing shape seen elsewhere turned out to have no actual list
structure in the source — see "Ninth pass" below. A tenth pass (The
Forged, two targets) found a title+description shape (Benefits) with no
bold-run signal at all to key off — the title/description split there is
this pipeline's own string parsing, not a font-derived extraction, a
first for this pipeline and flagged explicitly — plus two more
independently-confirmed-present blank markers matching the already-known
inline convention but with a different underscore count than any prior
case — see "Tenth pass" below. **A follow-up integrity check (same day)
confirmed The Forged's pages have a genuine PDF-generation defect —
columns 2 and 3 are swapped in the underlying text-stream order, found
independently by Skyler — and directly verified this pipeline's
x/y-coordinate-based extraction is immune to it by construction, with
no re-extraction needed for any playbook processed so far** — see
"Pipeline-integrity check" below. **A separate addendum (same day)
independently re-confirmed the swap via `pdftotext -raw`, confirmed
Yoshi's own page-level structural reads (bare `pdftotext`/`-layout`,
never `-raw`) already reconstruct correct order on the affected page
regardless of the underlying defect, and spot-checked all 11
previously-processed playbooks' raw stream order with zero further
instances found** — see "Addendum: Yoshi's structural-read risk
assessment" below. An eleventh pass (The Gumshoe's "Gumshoe Code") found
a genuinely new content shape — 6 example sentences rendered as one
continuous, undelimited italic run rather than a bulleted list or plain
prose — plus a first-of-its-kind bold cross-reference to a playbook's
own bespoke move names, not just base moves — see "Eleventh pass"
below. A twelfth pass (The Hex, spanning 4 pages) found two new false-
positive classes on top of the already-known ones — cross-call run
leakage when one flow is split across multiple `splice()` calls sharing
one runs file, and a mixed-styling repeated phrase defeating sequential
matching even within a single call — the latter hand-corrected against
the raw item dump rather than trusted from the automated splice, flagged
explicitly rather than glossed over — see "Twelfth pass" below. A
thirteenth pass (The Host's "Symbiosis") confirmed a clean, entirely
plain section and independently re-verified (not just trusted from
Yoshi's own read) that no `EffectText`-candidate prose exists between
the Downsides list and Moves — see "Thirteenth pass" below. A
fourteenth pass (The Initiate's "Sect") hit a fourth documented instance
of the heading-bleeds-into-body false positive (the section's own
heading text reappearing as an ordinary word in its own body prose) —
now common enough to be a standing checklist item, not a one-off — see
"Fourteenth pass" below. A fifteenth pass (The Interface's "Integration")
was a clean run with no new findings — a useful confirmation that the
established technique set now handles this class of shape on the first
try — see "Fifteenth pass" below. A sixteenth pass (The Monstrous, three
bespoke sections plus a suggestions appendix, spanning pages 37 and 38)
found a real generalizable `extract-moves.mjs` bug — 3 of 4 Curses
options have a colon-free bold title followed by a regular-styled run
that itself starts with the colon, the mirror image of Haven's
leading-period bug, fixed the same way — plus a *second* independent
instance of cross-call run leakage (after Hex's), this time via an
out-of-order shared-runs-list mechanism rather than Hex's repeated-word
mechanism, fixed by scoping each of page 38's 7 archetype entries to its
own 4-run set rather than sharing one runs file across all 7 splice()
calls — see "Sixteenth pass" below. A seventeenth pass (The
Pararomantic, 3 targets across pages 41-42) found a genuinely new
content shape — flowing prose with real nested "•" bulleted lists but
zero top-level bulleted entries at all, which `extract-moves.mjs`'s
existing model had no path to handle — fixed generically by factoring
its per-entry body-building logic into a shared function and adding a
fallback that produces real `<ul>`/`<li>` structure for a column like
this; also confirmed a Guide-Gift options shape with no title-delimiting
signal in the source at all (not even a colon, unlike Forged's Benefits)
— see "Seventeenth pass" below. An eighteenth pass (The Professional's
"Agency", page 44) was otherwise a clean 2-mandatory-category section
but caught a fifth instance of the heading-bleeds-into-body false
positive (after Curse-eater's "and", Envoy's "Overseers", Hex's
"Rotes", Initiate's "Sect") — the "Agency" section heading's own bold
run wrongly matched the plain word "Agency" used twice in the framing
paragraph's own body text, fixed with a tighter Y-bound, same technique
as every prior instance of this class — see "Eighteenth pass" below.
Recommended as the extraction technique for Phase 4/6/7 authoring going
forward.

## The problem

This project's established extraction tool, `pdftotext -layout` (poppler),
is reliable for plain text and column layout but **discards all
bold/italic/font-weight information** — it has no representation for it at
all. `bespoke-ruleset-catalogue.md`'s own working notes flagged this
explicitly: Crooked's Background options each have a bolded
mechanical-effect phrase in the source PDF that the plain-text extraction
cannot see or verify. `phase5-bespoke-ideation.md` (Yoshi, architecture)
settled on storing formatted description text as a small enumerated HTML
subset — `<b>`, `<i>`, `<ul>`, `<li>` only — chosen because Angular's
built-in `DomSanitizer` renders exactly that tag set safely by default,
with zero new frontend dependency. This spike's job was to find a free,
scriptable way to actually populate that markup from the PDF, not just
design the schema for it.

## What was checked and ruled out

- **`pdftohtml`** (poppler's own HTML exporter, which *does* preserve
  bold/italic) — not present in this environment. This machine's poppler
  install (Git Bash's `/mingw64/bin`) ships only `pdftotext.exe`; the
  other poppler utilities (`pdftohtml`, `pdftoppm`, `pdfinfo`, …) aren't
  bundled with it. Installing a fuller poppler distribution just for this
  one-time-per-playbook task felt like more environment surface than
  warranted when a pure-npm option (below) does the job with zero
  installation friction.
- **Python (`pdfplumber`/`PyMuPDF`)** — no usable Python in this
  environment. `python`/`python3` on PATH are Microsoft Store stub
  shims that refuse to run without an interactive install prompt (not
  scriptable). The only real Python binary found anywhere on the machine
  is pgAdmin 4's private bundled interpreter
  (`AppData\Local\Programs\pgAdmin 4\python\python.exe`) — deliberately
  **not** touched or `pip install`-ed into, since it's another app's
  private dependency, not a general-purpose environment Python. Installing
  a real Python (`winget install Python.Python.3.x`) was considered but
  not pursued: this repo's own prior history
  (`.squad/agents/Bowser/history.md`, `winget` entry) already documents
  that `winget` needs an **elevated, interactive** shell on this machine
  with no non-interactive workaround — not something this spike can do
  itself, and unnecessary given the Node-based option below worked cleanly.
- **`pdftohtmljs`** (the npm package Skyler flagged as unvetted) — checked
  directly (`npm view`). It is a thin `shelljs` wrapper around
  **`pdf2htmlEX`**, a separate native C++ binary (poppler + FontForge)
  that isn't installed and has no simple Windows install path (it's a
  Linux-first tool, typically obtained via a Docker image). The npm
  package itself has zero real dependencies — it just shells out — so it
  buys nothing without `pdf2htmlEX` already present. Not pursued.

## What worked: `pdfjs-dist` (Mozilla's PDF.js), driven from Node

**Recommendation: `pdfjs-dist`, installed as a standalone dev tool in
`tools/pdf-extract/` (its own `package.json`, not touching
`src/web/package.json`).** Pure JavaScript, no native/binary dependencies,
same behavior on any OS, and Node is already a first-class part of this
project's toolchain (Angular).

### How style detection actually works

Each PDF text item references a font by an internal per-page id (e.g.
`g_d0_f3`). pdf.js only resolves that id to the actual **embedded font**
(`page.commonObjs.get(fontName)`) after the page's operator list has been
processed (`await page.getOperatorList()` first). The resolved object's
`.name` is the real embedded PostScript font name — for this PDF, Adobe
Warnock Pro, subset-tagged like `XJUVMI+WarnockPro-Bold` /
`XJUVMI+WarnockPro-It` / `XJUVMI+WarnockPro-Regular`, plus a dedicated
symbol font (`FateCoreGlyphs`) used for bullet markers and the
track-box glyphs. Classifying `-Bold`/`-It`/`Italic`/`Oblique` suffixes in
that resolved name gives a **ground-truth** style read — it reflects which
font the PDF's own content stream actually selected, not a guess from
rendered pixels.

**Verified, load-bearing gotcha: the font id -> style mapping is NOT
stable across pages.** `g_d0_f3` is the bold font on page 11 and the
`FateCoreGlyphs` symbol font on page 12. Every text item's style must be
resolved per-page; a global font-id table would silently mis-tag text on
different pages. `tools/pdf-extract/extract-runs.mjs` resolves fonts fresh
per page for this reason — flagged prominently in its own comments too.

### Design: pdf.js for style, `pdftotext -layout` stays authoritative for text/layout

Rather than reimplementing this PDF's multi-column reading order in
JavaScript (error-prone, and this project already has a proven tool for
it), the pipeline is a **two-step splice**:

1. **`extract-runs.mjs`** walks a page range's text items in the PDF's own
   content-stream order (which — verified directly — already matches
   left-to-right visual column order for this document's layout: a whole
   column's items are emitted contiguously before the next column starts)
   and merges consecutive same-styled items into "runs" — e.g. the bold
   run `manipulate someone`. Output is a flat JSON list of
   `{page, style, text}`.
2. **`splice-formatting.mjs`** takes a plain-text block for **one specific
   option/section** (the same kind of plain text this project already
   produces via `pdftotext -layout`, e.g. what's already sitting in
   `bespoke-ruleset-catalogue.md`) plus the runs JSON, and does
   forward-only substring matching to wrap each run in `<b>`/`<i>` at the
   right spot.

This keeps `pdftotext -layout`'s already-proven column/line reconstruction
as the single source of truth for *what the text says and in what order*;
pdf.js is only ever asked the narrower question of *which spans are
bold/italic*.

### A real false positive, found and fixed

Initially fed each option's plain text against the *whole page's* runs
(unscoped). This produced two wrong results: `do +2 Harm` in the
**Assassin** option got a spurious `<b>` around "Harm", and `sell
something, or hire someone` in **Fixer** got a spurious `<i>` around "or".
Root cause, confirmed by re-reading the raw per-item font dump: this PDF
is multi-column, and the character-sheet sidebar on the *same page* has
its own bold "Harm" track-label heading, and an unrelated italicized "or"
in a flavor-text line elsewhere on the page — both coincidentally
text-identical to plain (non-bold/italic) words inside Assassin's and
Fixer's actual option text. Sequential substring matching against an
unscoped runs list can't tell those apart.

**Fix: `extract-runs.mjs` takes `--minX`/`--maxX`**, scoping extraction to
the target column's x-coordinate range (read off a `dump-page.mjs` dump of
the page first). Re-running with the Background column's actual x-range
(283–520 on page 11) eliminated both false positives with no other
changes — verified in
`tools/pdf-extract/crooked-background-review.json`. This is the one real
methodological lesson from this spike worth carrying into every future
playbook: **always scope extraction to the specific column**, never run
runs-matching against a whole multi-column page unscoped.

## Acceptance test — passed exactly

Target (from the task brief):

```
title: Hoodlum
descriptionText: You can use Tough instead of Charm to <b>manipulate someone</b> with threats of violence.
```

Actual output from the pipeline (`tools/pdf-extract/build-crooked-review.mjs`, reproducible any time):

```
title: Hoodlum
descriptionText: You can use Tough instead of Charm to <b>manipulate someone</b> with threats of violence.
MATCH: true
```

## Does it generalize past bold?

Yes — confirmed with a second, targeted validation pass (below), not just
argued from theory.

- **Italic**: yes, same mechanism — `extract-runs.mjs` correctly
  identifies italic runs elsewhere on the same pages as the Crooked test
  (e.g. the flavor-text quote, move-name subheadings like "Manipulate
  Someone"/"Act Under Pressure") via the `WarnockPro-It` embedded font,
  confirmed present on multiple other pages of the document (checked pages
  5, 11, 20, 50). **Now also confirmed inside actual move body text**,
  not just headings/flavor text — see below.
- **Bulleted lists (`<ul>`/`<li>`)**: **confirmed**, via a new script,
  `extract-moves.mjs` (see below) — not left as a theoretical follow-up.

## Second validation pass — The Covenant's Moves section (page 9)

Requested by the coordinator after Skyler approved the Crooked review, to
specifically exercise `<i>` and `<ul>`/`<li>`, which the Hoodlum test
didn't touch (bold-only). Target: The Covenant playbook (a different
playbook than the 3 pilots — purely a tool-validation exercise, not a
scope expansion of the modeling/authoring pilot), Moves section, page 9,
middle column (x 283–520, found the same way as Crooked's Background
column: `dump-page.mjs`/`list-fonts.mjs` first).

**Why a new script instead of reusing `splice-formatting.mjs`**: this
section's shape doesn't fit "flat paragraph with inline tags spliced in."
Two of its seven moves (`Fast Friends`, `Smash Cut`) have a nested
bulleted roll-result breakdown (10+/7–9/miss) embedded *inside* their
description, which needs real `<ul><li>` block structure, not just inline
`<b>`/`<i>` spans. Rather than force that into the splice technique, wrote
`extract-moves.mjs`, which reconstructs HTML directly from the PDF's item
stream (position + resolved font per item), producing `{title,
descriptionHtml}` per move directly — no hand-copied plain text step.

**Two distinct bullet glyphs, easy to conflate, verified apart**: the
top-level move bullet is the `b` glyph from the `FateCoreGlyphs` *symbol*
font (same one already excluded from bold/italic classification in
`extract-runs.mjs`) — it marks where each move starts. The nested
roll-result bullet is a **literal `•` (U+2022) character in the ordinary
body font** (`WarnockPro-Regular`) — real text, not a symbol-font glyph.
Conflating the two would either miss nested lists entirely or wrongly
split a move into fragments at every roll-result line. `extract-moves.mjs`
special-cases each by its own actual signal (font-class for one, literal
character for the other), not a shared heuristic.

**Results — all three tag types confirmed present and correct** (full
output: `tools/pdf-extract/covenant-moves-review.json`):

```
Fast Friends: "When you meet a new being and <i>spend time befriending
them</i>, roll +Charm.<ul><li>On a 10+, they become your ally.</li>
<li>On a 7–9, they become your ally until the end of the mystery.</li>
<li>On a miss, you've offended them.</li></ul>You can only gain one
permanent ally per mystery with this move (a second 10+ makes them an
ally for the rest of the mystery)."
```

- `<ul>`/`<li>`: 2 of 7 moves (`Fast Friends`, `Smash Cut`) produce real
  nested lists, each with 3 correctly-separated `<li>` roll-result items.
- `<i>`: both of those same two moves also carry inline italic emphasis
  in their trigger clause (`<i>spend time befriending them</i>`, `<i>reveal
  you asked an ally to do something for you</i>`) — confirmed inside
  ordinary body prose, not just headings/quotes.
- `<b>`: move names (`Get Down!`, `Fast Friends`, …) and inline trigger
  phrases (`<b>protect someone</b>`, `<b>read a bad situation</b>`,
  appearing twice for `The Geek in the Chair`) — same mechanism as
  Crooked, now exercised on a second playbook.
- The remaining 3 moves (`Acolyte`, `Who Said I Was Alone?`, `Opening
  Doors`) correctly produce plain, untagged text — verified from the raw
  item dump that their bodies genuinely have no bold/italic/bullets in
  the source, so the pass-through is the *correct* result, not a gap
  (same reasoning already applied to Crooked's Heat/Underworld).

**One real bug found and fixed in this pass, not present in the first**:
initial output dropped or misplaced the single boundary space between two
differently-styled adjacent runs (e.g. `"you<b>protect"` instead of `"you
<b>protect"`) — because a straight `.trim()` on each run's text silently
discards whichever side of the boundary happens to own the space
character, and it varies (verified both ways in the same move list: one
boundary's space lived in the plain-text run before the bold span,
another's lived inside the bold span itself, trailing). Fixed by peeling
off a single leading/trailing space as its own unstyled token before
wrapping the run's actual text core in `<b>`/`<i>`, plus a final
double-space collapse as a safety net. Verified fixed by re-running and
inspecting the joined output character-by-character against the source
item dump.

**One known, accepted cosmetic limitation, not a bug**: `The Geek in the
Chair`'s description contains `"pre- venting 2 harm"` — a genuine
soft-hyphen line-wrap in the source PDF (the word "preventing" splits
across two lines). `pdftotext -layout` has this exact same limitation on
hyphenated line-wraps (already true for the original Crooked pass too,
just not visible there since none of Background's options happened to
hit a hyphenated word). Left as-is and documented inline in the review
HTML rather than attempting generic dehyphenation — automatically
stripping a trailing `-` before a line-wrap join risks silently breaking
genuine hyphenated compound words that happen to fall at a line break, a
worse failure mode than an occasional visible artifact a human/agent
authoring pass fixes during review (the same review discipline already
established, and the same discipline that caught the false positives in
both passes of this spike).

## Third pass: the remaining pilot rulesets — The Chosen's Fate, The Divine's Mission

Coordinator follow-up once Yoshi confirmed `bespoke-ruleset-catalogue.md`
is real source-of-truth content, not just a structural reference — every
bespoke ruleset entry needs its actual formatting run through this
pipeline, including the two pilot rulesets Crooked's and Covenant's
passes hadn't touched yet. Both playbooks needed locating and inspecting
from scratch (neither had been examined for formatting before this pass).

**The Divine's Mission** (page 15, right column — flat, description-only,
pick 1; same shape as Crooked's Heat, so reused `extract-runs.mjs` +
`splice-formatting.mjs` unchanged, no new script needed). One real finding:
**option 5 has genuine inline italic** — "…protect them at `<i>any</i>`
cost." — not previously visible in the catalogue's plain text. The other 4
options are correctly plain, confirmed from the raw PDF item dump, not
merely assumed. One layout wrinkle worth noting: Mission's column shares
its x-range with the Divine's Moves section directly above it on the same
page (unlike Crooked/Covenant's cleanly-separated columns) — extraction
picked up several long, specific bold move-name/trigger-phrase runs from
Moves in the same x-scoped pull, but none of them collided with Mission's
short, unrelated option text during splicing (verified: zero unexpected
tags in the output). Script: `build-divine-mission-review.mjs`.

**The Chosen's Fate** (page 8, left column — three mandatory pick-groups:
How You Found Out pick 1 of 7, Heroic tags pick 2 of ~12, Doom tags pick 2
of ~14, all label-only per the catalogue's "Tag Pick" shape — no
description text at all). **Finding: zero bold/italic anywhere across all
33 tag labels** — confirmed two ways, not just eyeballed once: (1) manually
read every item's resolved font in the raw `dump-page.mjs` output for the
whole column, and (2) ran `extract-runs.mjs` over the same column and
programmatically checked its detected bold/italic runs against every tag
label string, finding **0 collisions** (`build-chosen-fate-review.mjs`
prints this check's result directly, not just an eyeballed conclusion).
The 5 bold runs the extractor *did* find in that column are all structural
— the "Your Fate"/"How You Found Out"/"Heroic"/"Doom" section headings —
plus one aside sentence, "**Whenever you mark off a point of Luck,** the
Keeper will throw something from your fate at you." **Flagged, not
included as bespoke-ruleset content**: that aside reads as a rules-
explanation footnote in the same category as "Crooked special:"/"Divine
special:" callouts already established elsewhere in this document as
outside any `BespokeSection`'s own option data — left out of the JSON
output on that basis, but worth Yoshi/Peach confirming that reading is
correct rather than this script silently deciding it for them.

**Net result: Crooked's Background/Heat/Underworld, Covenant's Moves,
Divine's Mission, and Chosen's Fate — all 3 pilot playbooks' bespoke
rulesets — have now been run through the pipeline.** Two produced real
formatting to preserve (Crooked's Background `<b>`, Covenant's Moves
`<b>`/`<i>`/`<ul>`/`<li>`, Divine's Mission one `<i>`); two rulesets
(Crooked's Heat/Underworld, Chosen's Fate) confirmed genuinely plain —
every one of those "no formatting" conclusions came from actually running
the extractor and inspecting its output, not from assuming absence.

## Fourth pass: The Action Scientist's Area of Study — real authoring use, and a real extractor bug found

First use of this pipeline for a playbook outside the original 3 pilots,
requested by Yoshi (via the coordinator) to finalize a structure Yoshi had
already modeled. Page 1 (the front page), "Area of Study" — the middle of
the front page's 3-column layout, x ~280–525, immediately left of "Moves".
7 options, 3 with an embedded bulleted sub-list — the same shape
`extract-moves.mjs` was built for, so reused directly rather than the flat
`splice-formatting.mjs` path (correctly predicted by the coordinator's
request from the shape alone, without needing to build anything new).

**Checked all 7 options directly against the PDF rather than trusting the
request's own shape summary — and this mattered.** The coordinator's
message described 4 options as "plain mechanical grant, no roll" (Biology
and Chemistry, Violence, Mechanics and Engineering) plus Space. Actually
checking found **3 of those 4 have real inline formatting the summary
didn't anticipate**:

- Physics and Cosmology: bold `investigate a mystery` (a cross-reference
  to the base "investigate a mystery" move, mid-sentence) *in addition to*
  its expected 3-item bulleted list.
- Biology and Chemistry: italic `examine a mysterious substance,` — not
  flagged as having any formatting at all in the request.
- Violence: bold `kick some ass` — same, not flagged.
- Mechanics and Engineering: **two separate italic spans** (`fix
  machinery`, `combine any two devices, rebuilding them together`) — same,
  not flagged.
- Neurology and Psychology / Computers and Electronics: italic trigger
  clauses (`talking to someone and assessing their motives,` / `access a
  secure computer system or electronic device, or change what it does`)
  *in addition to* their expected roll-result breakdown lists.
- **Space is the only option that's genuinely plain** — confirmed from
  the raw PDF, not assumed, and it's the only one of the four "plain"
  predictions that actually held.

This is a direct, concrete argument for the "check everything, don't
assume from shape" discipline this whole pipeline has followed since the
first false positive in the Crooked pass — a plausible-sounding shape
summary got 3 of 4 "plain" calls wrong here, and the only way to know was
running the extractor and reading the output.

**A real extractor bug found and fixed in this pass**: the very first raw
run produced `"...When you<b>investigate a mystery</b>"` — missing the
space before the bold span. Root cause: the leading/trailing-space
peel-off fix from the Covenant pass only covered a style change that
happens *mid-line* (an explicit space-only text item between two
differently-styled runs); it didn't cover a style change that happens to
land exactly *at* a line-wrap boundary (previous item ends a line and the
next item, on the new line, is a different style with no explicit
space-only item at all — the line-wrap itself is the only signal that a
joining space is needed, and nothing was inserting one for a **brand
new** run, only for continuations of an *existing* run across a wrap).
Fixed by prepending the line-wrap's implied space to a newly-started run
too, not just an ongoing one. **Fixing this immediately introduced a
second, smaller bug**, caught by re-running the Covenant regression
check rather than assuming the fix was clean: the same unconditional
line-wrap space now also fired right after closing a `<ul>` (`"...offended
them.</ul> You can only gain..."` — stray space right after the closing
tag), because closing a list is *also* a line-wrap-boundary-adjacent
transition. Fixed by suppressing the synthetic space specifically for the
"text immediately following a just-closed list" case — the block-level
`<ul>` already supplies the visual break, so no additional space belongs
there. Both fixes are in `extract-moves.mjs`; re-ran the full Covenant
regression check afterward and confirmed it's back to exactly its
previously-approved output.

Script: `build-action-scientist-area-of-study-review.mjs`. Full per-option
formatting summary (bold/italic/list presence) printed directly by the
script, not just visible in the JSON.

## Fifth pass: The Changeling's Unknown Heritage — a new content shape, and a schema-relevant question resolved from the raw PDF

Page 6, leftmost of the front page's 3-column layout, x ~30–270. This
ruleset's shape doesn't match anything the pipeline had handled before:
**10 flat, label-only tag options with zero body text at all** (no colon,
no continuation sentence — just the label, full stop), plus **a long
section-level explanatory paragraph that comes after all 10 bulleted
tags, attached to none of them individually**. Neither
`extract-moves.mjs` (built for bullet-per-entry title+body, not a fit when
there's no body) nor a single flat splice over the whole column (the tags
and the trailing paragraph are different kinds of content) applied
cleanly on their own — used `extract-runs.mjs` once over the whole column
to get every bold/italic run in one pass, then `splice-formatting.mjs`
against just the trailing paragraph's plain text (a flat-paragraph fit,
same technique as Divine's Mission), and confirmed the 10 tags directly
from the same runs list rather than splicing them (nothing to splice —
see below).

**All 10 tags checked, not sampled**: Dietary restriction, Hygienic need,
Unearned reputation, Erratic power, Strange thoughts, Sensory
bombardment, Allergy to, Repulsion from, Attraction to, Obsession with —
**zero bold/italic on any of them**, confirmed the same programmatic way
as Chosen's Fate tags (diffed every detected inline run against every tag
label, 0 collisions). The short section-level "Pick three" instruction
sentence is also plain. **Page 6 has no italic font embedded at all** — a
useful shortcut this pass found: checking the font table first
(`list-fonts.mjs`) immediately rules out `<i>` for an entire page before
even running the extractor, which is a cheap sanity check worth doing
early on any new page.

**The trailing explanatory paragraph — "notably longer than prior Section
descriptions," per the coordinator's own flag not to assume plain —
turned out to have real formatting**: two bold cross-reference spans,
`<b>act under pressure</b>` and `<b>investigating a mystery</b>`, both
references to base moves (the same pattern as Action Scientist's bold
`investigate a mystery` cross-reference). No italic, no bulleted list —
the paragraph's several sentences read as continuous prose in the source,
not a `<ul>`, so no list markup applies here despite the extra
left-indent visual paragraph breaks in the printed layout (that indent is
a print-layout convention, not a bullet marker — verified no `•` glyph
appears anywhere in this block, unlike Covenant's real nested lists).

**The specific schema-relevant question, resolved directly from the raw
PDF, not inferred**: does a blank marker (Heat's `________`-style
convention) print after "Allergy to" / "Repulsion from" / "Attraction to"
/ "Obsession with"? **No — confirmed absent.** Checked item-by-item in
the raw PDF text stream: the item immediately following each of those 4
tags' own text is the line-break marker for the *next* tag (or, for
"Obsession with", the line-break marker leading straight into the
trailing paragraph) — no underscore run, no blank-space glyph, nothing at
all appended. This is a **different convention from Heat's**, where the
blank is a literal `________` character run embedded *inside* the
option's own sentence (e.g. "A police detective, `________`, has made
it..."); Unknown Heritage's 4 tags have no such glyph anywhere, embedded
or otherwise — they're printed exactly as written, full stop. This
matters because the two conventions imply different schema handling if
Yoshi wants to preserve the "this tag needs a fill-in" semantic at all —
flagged as a real open question for Yoshi to resolve (e.g. whether
`{{blank}}` still gets used here despite no PDF-rendered marker existing,
since the *game rule itself* clearly implies a fill-in for these 4 tags
even though the page layout doesn't print one), not something this pass
decided unilaterally.

**Also flagged, not resolved here**: this ruleset's `Description` field
(if `BespokeSection` gets one value per the existing schema) has two
distinct blocks of section-level prose — the short "Pick three"
instruction and the much longer trailing explanatory paragraph — and
whether both belong in one concatenated `Description`, or whether the
trailing paragraph is really a different kind of content entirely (it
reads like rules commentary about *how the tags function during play*,
closer in spirit to the "Crooked special:"/"Divine special:" callouts
already established elsewhere as outside any `BespokeSection`'s own data,
except this one has no "X special:" label at all). Both blocks are
included in the JSON output, clearly separated
(`selectInstruction`/`sectionExplanation`), so Yoshi can decide the
mapping rather than this pass silently picking one.

Script: `build-changeling-unknown-heritage-review.mjs`. Prints the
formatting summary and the full blank-marker finding directly to the
console, not just buried in JSON.

## Sixth pass: The Covenant's "Covenant"/"Friendship" ally-selection ruleset — Y-range scoping added to `extract-moves.mjs`

Page 9, the **right** column headed "Covenant" then "Friendship" — a
different column on the same page already partly extracted (the
"Moves" column, `build-covenant-moves-review.mjs`, x ~283–520). Located
this column's own x-range separately via `dump-page.mjs` rather than
reusing the earlier one, per the coordinator's explicit instruction —
confirmed x ~525–760.

**Shape is a mix, same lesson as Changeling's Unknown Heritage**: two
flat prose blocks (the "Covenant" special-ability paragraph, the
"Friendship" intro sentence), 3 "Type" options with real title+
description each (Watson/Rolodex/Unit — a genuine fit for
`extract-moves.mjs`'s bullet-driven title+body model), and 8 "Style" tags,
label-only, visually split across two x-sub-columns within this one wider
column but confirmed plain and listed directly (no splice needed, same
technique as Chosen's Fate / Changeling's tags).

**A new wrinkle this pass found and fixed generically**: the 3 Type
options are followed, before the 8 Style tags, by a plain (non-bulleted)
lead-in line, `"Describe the ally:"`. `extract-moves.mjs`'s
segment-splitting only keys off bullet markers — without a way to bound
the item range, that lead-in line would have been silently absorbed as
trailing body text of `"Unit"`'s description (verified this would
actually happen before fixing it, not just theorized). **Added
`--minY`/`--maxY` to `extract-moves.mjs`**, mirroring the already-existing
`--minX`/`--maxX`, so a column that mixes shapes can be scoped precisely
to just the sub-range that fits the bullet-driven model. Verified via
regression: default (unbounded) behavior unchanged for every prior
script that doesn't pass the new flags (Covenant's own Moves column,
re-run and confirmed byte-identical to its previously-approved output).

**Findings, checked directly rather than predicted**:

- **Covenant ability paragraph**: entirely plain — 0 bold/italic.
- **Friendship intro sentence**: one genuine italic span, `<i>Monster of
  the Week</i>` (the game's own title, italicized as a bibliographic
  cross-reference — "Pick a type (*Monster of the Week* hardcover, page
  131)...") — not previously predicted, found only by running the
  extractor over the actual text.
- **Watson / Rolodex / Unit**: bold titles (the expected, already-handled
  shape) plus fully plain description bodies — no additional inline
  formatting inside any of the three descriptions.
- **All 8 Style tags**: plain, confirmed programmatically (0 collisions
  between detected bold/italic runs and any style-tag label), same
  technique as Chosen's Fate/Changeling's tags.

**Blank-marker question — resolved directly from the raw PDF, matching
the Changeling pass's discipline**: does anything print after `"Something
else"`? **Absent**, confirmed the same way — the item immediately
following it in the stream is the page's next, unrelated section
("Gear"), no underscore run or blank glyph of any kind. One detail worth
flagging precisely, since the coordinator asked for the exact look: the
label itself **does** end with a literal colon in the source text
(`"Something else:"`, unlike the other 7 style tags, which have no
trailing punctuation at all) — that colon is the *only* visual cue a
fill-in is implied; nothing is actually rendered after it. Same
underlying finding as Changeling's 4 tags (a game-rule-implied blank with
no corresponding PDF-rendered marker, different from Heat's literal
`________` convention), now confirmed on a second, independent ruleset.

Script: `build-covenant-friendship-review.mjs`.

## Seventh pass: The Curse-eater — two targets, `--minY`/`--maxY` added to `extract-runs.mjs`, and the first confirmed-PRESENT blank marker

Two targets from The Curse-eater, per two of the three bespoke-adjacent
concepts Yoshi identified (schema shape for both still pending
confirmation with Skyler — out of scope here, since raw text/formatting
extraction doesn't depend on it).

**Target 1 — page 13, "Corruption" then "Consumed MagiC (Power,
Downside)" (x ~280–520).** Found the *same class* of false positive
`extract-moves.mjs` hit on Covenant's page, but this time in the **flat
prose splice path**, not the bullet-list path: an unrelated italic `"and"`
from the "Moves" list directly above this column (same x-range, different
vertical section) matched and got wrongly spliced into the Corruption
paragraph's own `"...the power it offers you, and the downside..."`.
`extract-runs.mjs`'s x-only scoping — sufficient for every one of the six
prior passes — wasn't enough here, since both sections share one column.
**Added `--minY`/`--maxY` to `extract-runs.mjs`**, mirroring the identical
flags already added to `extract-moves.mjs` for the same underlying reason
last pass; same implementation shape, applied to the script that needed
it this time. Verified regression-safe: all 7 prior scripts (none of
which pass the new flags) re-run afterward with byte-identical output.

With that fixed, the actual formatting found: 2 bold cross-reference
spans (`<b>devouring evil</b>`, `<b>unleash corruption</b>`, both
references to other Curse-eater moves) and 1 italic emphasis (`<i>should</i>`,
in "If you *should* take corruption, but the track is full..."). Also
resolved directly from the raw item stream, not assumed: **"Consumed
MagiC (Power, Downside)" has zero body text of its own** — it's the very
last item on the page, immediately followed by nothing; it's a
table/tracker heading for a blank fill-in area on the character sheet,
not a described mechanic with its own prose. **This doesn't match Yoshi's
proposed 2-part split** (Corruption's half vs. Consumed Magic's half) as
originally framed — there is no separate block of Consumed-Magic prose to
split out; the entire explanatory paragraph belongs to "Corruption"
alone. Flagged explicitly for Yoshi to reconcile against the modeled
structure, not resolved unilaterally here.

**Target 2 — page 14, "How consuming magic works" (x ~280–520),
pick-1-of-5, same flat shape as Divine's Mission.** Entirely plain — 0
bold/italic across the intro sentence and all 5 options, confirmed
programmatically (the only bold runs detected in the column are 4
structural headings elsewhere on the page — "Getting Started",
"Introductions", "History", the section's own title — none inside the
target content).

**The interesting part, and the first case of its kind across all seven
passes**: option 5, `"Something else:"`, is followed by a **genuinely
rendered blank marker** — every prior "does a blank print here" check
(Changeling's 4 tags, Covenant's own "Something else") came back
**absent**. Captured precisely, per the coordinator's explicit ask for
the exact form rather than just yes/no: the raw PDF text item is a single
item, `"Something else: ______________________________"` — the label,
colon, one literal space, then a run of **exactly 30** consecutive
underscore (`_`) characters, all in the plain/regular font (not bold, not
italic, not a distinct glyph/symbol font — a real typed underscore run,
not a special character). No extra spacing beyond the one space after the
colon. This is corroborating, concrete evidence for how the `{{blank}}`
convention (`phase5-bespoke-ideation.md`) should map onto this specific
kind of source rendering — a genuine `________`-style marker, same
category as Heat's blanks, unlike Changeling's/Covenant's implied-but-
unrendered fill-ins.

Script: `build-curse-eater-review.mjs`.

## Eighth pass: The Envoy — Task/Secret Wisdom, Overseers, a second blank-marker convention, and another same-column heading collision

Two targets, both fitting already-established schema shapes per Yoshi (no
new modeling this round).

**Target 1 — page 17, "Task" then "Secret Wisdom" (right column, x
~525–760).** Task is 4 straightforward title+description options
(Guide/Herald/Watcher/Witness) — all plain, bold titles only, extracted
with `extract-moves.mjs`. Secret Wisdom follows the coordinator's proposed
`Description`/`EffectText` split cleanly: `Description` is the roll+Cool
mechanic paragraph (flat prose, spliced — found one italic span, `<i>At
the start of each session</i>`, not predicted); `EffectText` is 4
Task-dependent hold-spending sub-entries, each with a bold title AND real
inline formatting — every one of the 4 has both an italic trigger clause
and at least one bold cross-reference span (Guide's entry has *two*
separate bold `help out` spans). **A real structural trap here, avoided
by Y-bounding rather than discovered as a bug**: Task and EffectText reuse
**identical labels** (Guide/Herald/Watcher/Witness) for two conceptually
different lists in the same column — without tight Y-bounds on each
extraction separately, they would merge into one incorrect 8-entry list
or bleed into each other. Bounded each to its own item range up front,
verified both came out exactly as expected with no cross-contamination.

**Target 2 — page 18, "Overseers" (left column, x ~30–270).** Intro
sentence, 11 Values options and 10 Concerns options (two x-sub-columns
within one column, same pattern as Covenant's Style tags), a trailing
paragraph, and two independent blank-marker checks. **Another false
positive found and fixed, same underlying class as Curse-eater's, this
time a section heading rather than a Moves-list bleed-through**: the bold
`"Overseers"` section heading collided with the ordinary word
"Overseers" appearing naturally in both the intro and trailing prose (the
Envoy's Overseers are *called* "Overseers" throughout the text) —
narrowed the Y bound to exclude the heading itself, same
scope-more-tightly fix used throughout this pipeline. With that fixed:
intro is plain; trailing paragraph has one bold cross-reference,
`<b>use magic</b>` (consistent with every other playbook's pattern of
bolding base-move references); all 21 Values+Concerns tag labels are
plain, confirmed programmatically (0 collisions).

**Blank markers — a second, independently-confirmed case of PRESENT, and
a third distinct rendering convention.** Both "Something else" entries
(Values' and Concerns') have a real marker, checked independently per the
coordinator's request rather than assumed identical from one finding:
both are **exactly 21 underscore characters**, and both use the **same
convention as each other** — but a genuinely different convention from
either prior case. Unlike Curse-eater's single text item (`"Something
else: " + 30 underscores`, all inline on one line), here `"Something
else:"` is its own complete text item ending its line, and the
underscore run is a **separate text item on the next line**, left-aligned
under the label's own x-position (not appended after the colon).
Three distinct blank-marker renderings now confirmed across this
project's playbooks: absent entirely (Changeling, Covenant), inline
same-line (Curse-eater), and label-then-next-line (Envoy's Values and
Concerns, identical to each other). Concrete, corroborating variety for
whatever normalization Yoshi settles on for the `{{blank}}` convention.

Script: `build-envoy-review.mjs`.

## Ninth pass: The Expert's Haven — a title-delimiter gap fixed generically, and a real negative finding on list structure

One clean Titled Choice section, no new schema (per Yoshi) — page 19,
"Haven" column (right side, x ~525–760), 9 options, each with a real
title+description.

**A small but real, generalizable extractor gap, found and fixed in
`extract-moves.mjs` itself rather than worked around in this script.**
Every prior playbook's bulleted title+body options delimited the title
with a **colon** (`"Get Down!:"`, `"Watson:"`) — Haven's titles are
delimited by a **period** instead (`"Lore Library. When you hit the
books..."`). The extractor's existing title-stripping only handled a
trailing colon, so every one of Haven's 9 descriptions came out with a
stray leading `". "` before the actual sentence started. Fixed by
stripping a leading `". "` from the description the same way a trailing
`":"` is already stripped from the title — the mirror-image case of an
existing, already-established technique, not a new one. Verified
regression-safe: the fix is a no-op against all 9 prior playbooks'
output (none of them have this period-delimited-title pattern), re-run
and confirmed unchanged.

**A concrete negative finding, specifically checked per the
coordinator's request rather than assumed**: option 4, Armory, has a
roll-outcome breakdown (10+/7–9/miss) shaped superficially like Action
Scientist's Neurology and Psychology / Computers and Electronics options
— but checked directly against the raw PDF item stream and confirmed
**it contains zero `•` bullet-marker characters anywhere**. It's flowing
prose, the roll outcomes written as plain sentences in the same
paragraph as the rest of the option, not a real `<ul>`/`<li>` list like
Action Scientist's genuinely-bulleted equivalents. Worth remembering as
a project-wide lesson: matching game-mechanical *content* shape (a
10+/7–9/miss breakdown) does not reliably predict matching PDF-level
*structure* — this has to be checked per option, every time, not
inferred from a similar-looking case elsewhere in the book.

Also confirmed: zero italic anywhere in the column (programmatically, 0
italic runs detected). 3 options carry bold cross-reference spans (Lore
Library → `investigate the mystery`; Mystical Library and Magical
Laboratory → `use magic`, each), consistent with every other playbook's
base-move-reference-bolding pattern. Armory's own trigger clause (`need a
special weapon`) is styled **bold**, not italic — worth flagging as a
real, book-wide inconsistency in how trigger clauses get styled (most
other playbooks italicize them), not an extraction error.

Script: `build-expert-haven-review.mjs`.

## Tenth pass: The Forged — Bonds/Burdens/Dual Nature/Range/Benefits/Flaws, Origin, a title split with no font signal, and blank markers with a new underscore count

Four bespoke concepts (Bonds, Burdens, Dual Nature, Origin), all fitting
established shapes per Yoshi. Two page targets.

**Target 1 — page 23, the column containing Partner/Bonds/Burdens/Dual
Nature/Range/Benefits/Flaws (x ~280–520).** Partner's own Move
description text — the column's first block — was deliberately excluded
via a Y bound, per the coordinator's explicit scope note; verified the
bound (`maxY=480`) cleanly excludes it, including its own one bold span
(`big magic`), which never entered the extraction at all.

With that excluded: Bonds (5 tags), Burdens (6 tags), Range (4 tags), and
Flaws (5 tags) are all plain — confirmed programmatically, zero
collisions. Dual Nature's intro has one bold cross-reference,
`<b>kick some ass</b>` (a base-move reference, the same pattern seen
throughout this project). Both Bonds' and Burdens' "Something else"
blank markers are present, identical to each other, and match
Curse-eater's inline single-item convention — `"Something else: "` + 30
underscores, one plain-font text item.

**A genuine first for this pipeline, found in Benefits (8 entries)**:
every prior title+description shape extracted so far — Watson:, Get
Down!:, Guide:, even Haven's period-delimited titles — had a REAL font
signal marking the title boundary (a bold run). Benefits has **none at
all**: each line (e.g. `"Magic: Add the "magic" tag"`) is a single
plain-font text item start to finish, with nothing distinguishing
`"Magic"` from the rest except the colon in the text itself. The
title/description split in this pass's output is this script's own
string parsing (split on the first colon) — **not** recovered from any
PDF-level signal, unlike every prior case. Flagged explicitly, not
silently presented as equivalent to the font-derived splits elsewhere:
if `BespokeOption.Title` needs populating for Benefits, it has to come
from parsing like this, and Yoshi should treat that as a qualitatively
different (still reliable, since the colon convention is fully
consistent across all 8 entries, but not font-verified) kind of
extraction than everything before it.

**Target 2 — page 24, "Origin" column (left side, x ~30–270).** Forging
(6 named options + "Something else") and Partnering (6 named options +
"Something else") are both fully description-only, no titles, entirely
plain — confirmed programmatically, 0 bold/italic on any of the 14
options, and page 24 has no italic font embedded at all. Both "Something
else" blank markers are present, identical to each other, and match the
same inline single-item convention as Bonds/Burdens/Curse-eater — but
**27 underscores this time, not 30**. Same rendering convention, third
distinct underscore count now observed across the project (30 on
Curse-eater and Bonds/Burdens, 21 on Envoy's Values/Concerns, 27 here) —
worth keeping in mind that even within the same *convention* (inline,
same-line), the exact underscore count is not fixed and needs checking
per instance, same discipline already applied to which convention is
used at all.

Script: `build-forged-review.mjs`.

## Pipeline-integrity check: The Forged's column-2/column-3 stream-order swap (2026-08-27)

Skyler found that The Forged's pages have a real PDF-generation defect:
the 3-column layout **renders** correctly, but the underlying
text-stream/reading order has **columns 2 and 3 swapped** — dragging to
select text gives Col1 → Col3 → Col2, not left-to-right. This caused a
real misclassification on Yoshi's structural-analysis side. The
coordinator asked for a direct assessment of whether this pipeline's own
extraction is exposed, rather than assuming it isn't — this section is
that assessment, not a restatement of Skyler's or Yoshi's findings.

**1. Confirmed independently, from raw `pdf.js` item data, not assumed
from Skyler's report.** Checked both Forged pages actually used in the
Tenth pass:

- **Page 23**: item index 103 (`"Then pick one of these:"`, x=532 — the
  visually-rightmost, third column) appears in the stream **before**
  item index 253 (`"Moves"`, x=280.96 — the visually-middle, second
  column, heading the Bonds/Burdens/Dual Nature block). Stream order is
  Col1 (items 1–~100) → Col3 (items ~103–~252) → Col2 (items 253–415) —
  exactly the swap Skyler described, confirmed by reading the items'
  own embedded x-coordinates directly, independent of anyone's claim.
- **Page 24**: same pattern. `"Leveling Up"` (x=545.29, third column)
  is item index 140; `"Getting Started"` (x=257.13, second column) is
  item index 266 — Col3 before Col2 again. (Target 2, "Origin" itself,
  sits at x=36 — column 1 — entirely outside the swapped pair either
  way, but checked the swap's existence on this page too since it's one
  of the two pages this pass touched.)

**2. This pipeline's own extraction is confirmed unaffected — verified
directly against the actual Forged output, not inferred from the
scripts' design alone.** Two independent mechanisms, both checked:

- **Column selection never depends on stream order.** `extract-runs.mjs`
  and `extract-moves.mjs` both iterate `textContent.items` (pdf.js's
  array, i.e. stream order) but every inclusion decision reads
  `item.transform[4]`/`[5]` — the item's own embedded x/y position — and
  compares it against `--minX`/`--maxX`/`--minY`/`--maxY`. There is no
  code path anywhere in this pipeline that reasons about "the Nth block
  in the stream" or "whichever column comes first" — column identity is
  determined by *where the text physically sits on the page*, read off
  via `dump-page.mjs`/`list-fonts.mjs` by locating specific known label
  text (e.g. "Bonds (pick two):") and reading *that item's own*
  coordinates. A column-order swap has literally nothing to filter on
  in this design, by construction, not by luck.
- **Within a selected column, item order is still correct — checked, not
  assumed.** Even with column *selection* immune, correct *sentence
  reconstruction* inside a column still depends on the surviving,
  filtered items appearing in top-to-bottom order relative to each
  other (the `hasEOL`-driven line-joining logic in both extractors
  assumes this). Verified directly: page 23's middle-column block (items
  253–415, all sharing the swap-affected x-range) has **strictly
  decreasing y** from 567.18 down to 60.78 with zero interleaving from
  either other column. **The swap operates at the whole-column-block
  level — one contiguous run of items relocated ahead of another — not
  as an item-by-item scramble.** That's *why* it doesn't corrupt
  within-column reconstruction: each column's own internal item order
  survived intact, only the relative order of the two blocks was
  disturbed, and this pipeline never reads that relative order.
- Both of the above are also visible empirically: the actual
  Bonds/Burdens/Dual Nature/Range/Benefits/Flaws and Forging/Partnering
  text produced in the Tenth pass (`forged-review.json`) reads as
  coherent, correctly-ordered English throughout, and specifically shows
  **zero cross-contamination** from the third column's Moves content
  (Tactical Advice/My Outlet/To My Side/Ritual Use, x≈532–620) despite
  that content sitting immediately adjacent in the stream, before it,
  right where a stream-order-dependent method would have been most
  likely to leak it in.

**3. `pdftotext -layout` (the diagnostic/page-finding step, not this
pipeline's extraction source) also happened to render true visual
order for this specific page** — worth noting, not over-claiming. The
`full.txt` dump used to *locate* page 23 (before any `dump-page.mjs`/
`extract-*.mjs` work began) already showed "Moves" positioned before
"Then pick one of these:" in left-to-right print order, i.e. the
*correct* visual order, not the corrupted stream order — consistent
with poppler's `-layout` mode doing its own geometric column
reconstruction rather than following the content stream literally. This
is stated as an observation for this one page, not a general guarantee
about poppler's internals; it isn't load-bearing for this pipeline's
integrity either way, since (per the workflow documented throughout this
file) `pdftotext -layout` is only ever used here to find *which page* a
playbook is on — every actual extracted `descriptionText`/title in this
pipeline's output is produced from `dump-page.mjs`/`extract-runs.mjs`/
`extract-moves.mjs` reading items' own coordinates directly, or (for
flat-splice sections) from plain text transcribed by directly reading
those same coordinate-ordered item dumps — never copied from
`pdftotext -layout`'s reflowed text.

**4. Net conclusion: this pipeline's technique is immune to this
specific class of bug, by construction — x/y-coordinate-based column
selection has nothing for a stream-order swap to corrupt.** This means
**all previously-extracted formatting content across every playbook
processed so far by this pipeline remains trustworthy** with respect to
this specific defect, even though Yoshi's separate page-level structural
reads (which do appear to have followed logical/stream order in at least
one case) may need re-checking on affected playbooks. This is a property
of the *technique*, not a one-off fact about Forged — the same reasoning
applies to any future page found to have the same defect, and is exactly
why this pipeline was built on `pdf.js`'s per-item embedded coordinates
in the first place rather than any order- or stream-following method.
One caveat stated plainly, not glossed over: "immune by construction"
covers column *selection* and *within-column reconstruction* given the
swap's observed *block-level* character; it does not by itself prove
every not-yet-encountered PDF-generation defect is equally harmless —
each new page still gets the same "does the extracted text read as
coherent, correctly-ordered English" sanity check this pass used to
confirm it, as already standard practice throughout this pipeline's
review discipline.

## Addendum: Yoshi's structural-read risk assessment against the column-swap defect (2026-08-27)

The coordinator asked for a direct check of whether the same defect Bowser
confirmed above (Forged's Col1→Col3→Col2 stream-order swap) could have
corrupted Yoshi's own **page-level structural reads** — `pdftotext -f N -l
N` (bare, no flags) and occasionally `-layout`, used throughout this
walkthrough to read each playbook's two pages and derive section/option
structure. This is a different question from Bowser's pipeline-integrity
check above (which covers `pdf.js`-based formatting extraction, immune by
construction) — Yoshi's page-level reads have no x/y-coordinate scoping at
all, just poppler's own text output, so this needed checking directly, not
assumed safe by analogy.

**1. Independently re-confirmed the swap exists, via `pdftotext -raw`
(literal content-stream order, poppler's own equivalent of pdf.js's raw
item stream) on both Forged pages.** Page 23: `Then pick one of these:`
(the third-column pick-pool) appears in the raw stream **before** `Moves`
/ `Partner` / `Bonds` / `Burdens` / `Dual Nature` (the second-column
content) — the swap Skyler described, confirmed directly rather than
taken on trust. Page 24: raw stream order is normal (Gear → Origin →
Ratings → Leveling Up/Improvements → Getting Started → History), no swap
— the defect is page-23-specific, not both Forged pages.

**2. Confirmed the specific tool Yoshi actually used (bare `pdftotext`,
no `-raw`) already reconstructs the correct visual order on the affected
page, independent of the underlying stream defect.** Running plain
`pdftotext -f 23 -l 23` (no flags) produces `Moves` → `Partner` → `Bonds`
→ `Burdens` → `Dual Nature` → `Then pick one of these:`, in the correct
left-to-right order — matching what Yoshi originally transcribed, and
matching Bowser's separate finding above that `-layout` mode also
happened to render true visual order for this page. Poppler's default
(non-`-raw`) mode does its own geometric reading-order reconstruction; it
does not follow the literal content stream. This means the swap, while
real, did not actually corrupt the *content or order* of what Yoshi read
for Forged — the Bonds/Burdens/Dual Nature/Origin structure and the 1
required + pick-1-of-6 Moves count were all read correctly from the
source. (Skyler's Bonds/Burdens correction was a scoping/categorization
call — Move content vs. bespoke ruleset — not a misread caused by the
swap; worth stating plainly since the two are easy to conflate but are
independent problems.)

**3. Spot-checked `pdftotext -raw` against every one of the 11
previously-processed playbooks' actual pages** (1, 3, 5, 7, 8, 9, 11, 13,
15, 17, 19, 21 — Action Scientist, Celebrity, Changeling, Chosen ×2,
Covenant, Crooked, Curse-eater, Divine, Envoy, Expert, Flake) **— zero
instances of the swap found.** Checked specifically for the swap's own
signature (a `Then pick`/pick-pool marker or any later-column heading
appearing in the stream before an earlier-column heading it should
follow): every page's raw stream order matches normal left-to-right
column order, `Moves`/required-move content always preceding any
"Then pick..." pool, `Gear`/later sections always following. Curse-eater
(page 13), the playbook with the most similar dual-column Moves layout to
Forged, was checked in full and is clean.

**4. Conclusion: the defect is isolated to Forged page 23, confirmed by
direct re-verification of all 11 other pages actually used for structural
reads, not assumed clean by extrapolation.** No re-checking is warranted
for any of the 11 previously-processed playbooks on this specific basis.
Going forward, any future page showing an unusually "jumbled" or
suspicious structural read is worth a `pdftotext -raw` cross-check before
trusting the default output, the same way this pass did — cheap
insurance, now a known failure mode for this specific source PDF rather
than a hypothetical one.

## Eleventh pass: The Gumshoe's "Gumshoe Code" — a freeform-sentence ruleset, and a genuinely new content shape (italicized example block)

A new shape — the player writes one freeform sentence at creation,
guided by 6 illustrative examples — schema call still pending with
Yoshi/Skyler, but raw text extraction doesn't depend on that decision.

Page 25, "Gumshoe Code" column (x ~280–520). Shares its column's x-range
with Moves-intro/Occult Confidential/Naked City content directly below
it in the page's default reading order — Y-bounded (`minY=315,
maxY=570`) to isolate just Gumshoe Code, the same technique as
Curse-eater's Corruption/Consumed Magic split and Forged's Partner-text
exclusion. Verified the bound doesn't clip anything real: the "Moves"
heading sits at y=310.18, just below `minY=315`.

**Checked everything asked, no predictions, three real findings:**

- **The framing sentence** ("With the agreement of the Keeper, pick a
  one-sentence Code...") is entirely plain.
- **The 6 example codes are rendered as ONE continuous ITALIC run**, not
  individually bulleted or otherwise delimited in the source — confirmed
  no `•` list-marker glyph anywhere in the block. This is a genuinely new
  shape for this pipeline: every prior "check this block of text" pass
  has been either a real bulleted list or plain prose, never an
  undelimited italicized run of otherwise-unstructured example
  sentences. Output includes both the raw italic block (matching the PDF
  exactly) and a 6-sentence split for convenience — the split is this
  script's own sentence-boundary parsing, not a PDF structural signal,
  stated explicitly the same way Forged's Benefits title-split was.
- **The consequence paragraph**: confirmed exactly what was specifically
  asked — `<b>manipulate someone</b>` is bolded, matching the established
  base-move cross-reference pattern. **Also confirmed, not assumed**:
  `<b>The Postman Always Rings Twice</b>` and `<b>The Long Goodbye</b>` —
  both this *playbook's own* bespoke move names, not base moves — are
  *also* bold. This extends the base-move-cross-reference-bolding pattern
  already seen throughout this project (Action Scientist, Changeling,
  Curse-eater, Haven, etc. all bold references to *base* moves like
  `investigate a mystery`) to a playbook referencing its *own* bespoke
  moves by name — the first time this pipeline has seen that specific
  case, worth keeping in mind for future playbooks with internal move
  cross-references.

Script: `build-gumshoe-code-review.mjs`.

## Twelfth pass: The Hex — a 4-page playbook, a mixed-styling repeated-phrase false positive, and two new bold-usage patterns

The Hex spans 4 pages (27 front, 28 back, 29–30 a dedicated "Rotes"
worksheet insert). Two targets, both ready regardless of a still-pending
schema question on Rotes' exact field structure — raw extraction doesn't
depend on that.

**Per standard practice, spot-checked `pdftotext -raw` against pages 27,
29, and 30 for the column-swap defect (Skyler's Forged finding) before
extracting.** Page 27: raw stream order is Rotes → Temptation →
(Vengeance…) → Moves → "Then pick one of these:" — correct left-to-right
order, no swap. Pages 29–30 (a worksheet-insert layout, not the 3-column
character-sheet template) show no swap signature either. Clean on all 3
pages.

**Target 1 — Temptation (page 27, x ~280–520).** Framing paragraph
plain; consequence paragraph has one bold cross-reference,
`<b>act under pressure</b>`; all 7 options (Vengeance/Power/Addiction/
Callousness/Carnage/Secrets/Glory) have bold titles and fully plain
descriptions.

**Target 2 — Rotes prose (page 27 blurb + page 29 full explanation +
Requirements' two forms + worksheet field labels).** Two real bugs found
and fixed during assembly, on top of a third repeat of the already-known
Y-bound-too-loose class:

1. **Y-bound too loose, again** (same lesson as every prior pass, not
   new): an initial bound for the page 27 Rotes blurb pulled in the
   "Rotes" section heading itself, producing a false-positive
   `<b>Rotes</b>` around the unrelated phrase "See the separate Rotes
   sheet" — caught by inspecting the generated `runs.json` before
   trusting the splice output (it had 3 entries where only 2 were
   expected), not by trusting the first result.
2. **New: cross-call run leakage.** Splitting one continuous logical
   flow (page 29's explanation) into 3 separate `splice()` calls that
   all shared the *same* full runs list let a run already "consumed" by
   an earlier call match again in a later, unrelated call, purely
   because the same word happened to reappear there too as plain text.
   Fixed by manually partitioning the runs array per paragraph before
   calling `splice()`, rather than reusing one shared runs file across
   multiple calls covering the same page/column — documented as a
   pattern to watch for whenever a page's prose gets split across
   multiple splice calls for convenience.
3. **New, and deeper: mixed-styling repeats defeat sequential
   matching even within ONE call.** Page 29's "rest" paragraph has three
   `use magic` substrings, but only the 1st and 3rd are actually bold —
   the 2nd (`"...a specialised version of use magic, which is built with
   the Keeper"`) is plain. Forward-only substring matching has no way to
   know "skip this occurrence, it's unstyled" — it matched the correct
   1st bold run, then matched its 2nd run entry against the *plain* 2nd
   occurrence instead of the truly-bold 3rd one. **Not silently
   patched over**: verified the correct placement directly against the
   raw `pdf.js` item dump (item 55 bold, item 62 plain, item 68 bold)
   and hand-corrected that one paragraph's HTML rather than trusting the
   automated splice — flagged prominently in both the script and the
   JSON output (`restCorrectionNote`), not glossed over as equivalent to
   every other splice-derived field in this pipeline's output.

**Two new bold-usage patterns observed, beyond the established
base-move-cross-reference pattern**: `<b>rote</b>` is bolded on its
*first mention* in both the page 27 blurb and page 29's explanation — a
**term-definition bold** (introducing a key rules term), not a
cross-reference to another move. And the worksheet's own `"Rote:"` field
label uses a **distinct decorative display font** ("3rdMan", the same
family used for playbook titles) — visually reads as styled but is
neither bold nor italic by this pipeline's classification, correctly
excluded from `<b>`/`<i>` since it's a structural label, not semantic
emphasis (flagged explicitly so it isn't mistaken for a missed bold).
Requirements' long-form list (page 29) is a genuine bulleted `<ul>`,
all 5 items plain; the worksheet's short-form list (repeats identically
8 times across pages 29–30, verified via `pdftotext -raw` byte-matching
rather than re-checking every instance individually) is also plain.
Worksheet field labels: `"Requirements, pick two:"`/`"Effect:"` bold,
`"On a 10+"`/`"On a 7-9:"`/`"On a miss:"` plain despite being
roll-outcome labels. Zero italic anywhere across all 3 pages for this
playbook's Hex-specific content.

Script: `build-hex-review.mjs`.

## Thirteenth pass: The Host's "Symbiosis" — a clean section, and an independent confirmation of Yoshi's "no EffectText candidate" read

One clean 2-mandatory-category section (Benefits pick-2-of-10, Downsides
pick-1-of-7), no new schema per Yoshi — pure formatting extraction plus
one specific double-check.

Page 31, "Symbiosis" column (x ~270–500). Confirmed via `pdftotext -raw`
this page has no column-swap defect — Symbiosis content precedes Moves
content in stream order, matching the correct visual left-to-right
order.

**Entirely plain**: the framing sentence, all 10 Benefits tags, and all
7 Downsides tags — confirmed programmatically (0 collisions between
detected bold/italic runs and any tag label). The only bold text in the
whole section is the 3 structural section headings ("Symbiosis",
"Benefits (pick two):", "Downsides (pick one):"). Zero italic anywhere.

**The specific double-check the coordinator asked for**: does any prose
block exist between the Downsides list and "Moves" that could be an
`EffectText` candidate? **Confirmed none — independently, not by
re-reading Yoshi's own conclusion.** The raw PDF item stream shows the
item immediately following "Magical aura" (the last Downside tag) is
"Moves" itself, in a completely different x-column (x=503 vs.
Symbiosis's own x=275) — zero additional items exist in the Symbiosis
column's own x-range after the last Downside tag. There is genuinely
nothing there to have missed.

Script: `build-host-symbiosis-review.mjs`.

## Fourteenth pass: The Initiate's "Sect" — another clean section, and a fourth instance of the heading-bleeds-into-body false positive

One clean 2-mandatory-category section (Good Traditions pick-2-of-13,
Bad Traditions pick-1-of-12), no new schema per Yoshi. Page 33's Moves
content (including an unusual unnamed Required move) was explicitly out
of scope for this dispatch, per the coordinator — not touched.

Page 34, "Sect" column (left side, x ~30–270). Confirmed via
`pdftotext -raw` no column-swap defect (Getting Started → Introductions
→ Leveling Up, correct left-to-right order).

**Found and fixed the now-familiar heading-bleeds-into-body false
positive, a fourth documented instance of the same class** (Curse-eater's
"and", Envoy's "Overseers", Hex's "Rotes" — all the same underlying
mechanism): an initial Y-bound still included the "Sect" section heading
itself, coincidentally text-identical to the word "Sect" appearing later
in the framing paragraph's own body text ("...pick the Sect's
traditions..."), producing a false-positive `<b>Sect</b>`. Caught before
trusting the splice output; tightened the bound and re-verified clean.
This particular class of bug is now common enough across enough
playbooks that it's worth treating as a standing checklist item — after
any Y-bound is set, sanity-check whether the section's OWN heading text
reappears anywhere in the body being spliced, and if so, verify the
bound actually excludes the heading before trusting the first result.

With that fixed: the framing/flavor-question block is entirely plain;
both `"Good Traditions"` and `"Bad Traditions"` headings are bold, but
(a minor stylistic detail, not content-affecting) their own
`"(pick two):"`/`"(pick one):"` suffixes are a *separate*, plain-styled
run rather than part of the same bold phrase, unlike some other
playbooks where the whole `"Heading (pick N):"` reads as one bold run —
noted since headings aren't persisted either way, so it doesn't change
any output. All 13 Good Traditions tags and all 12 Bad Traditions tags
are entirely plain, confirmed programmatically (0 collisions). Zero
italic anywhere in the section.

Script: `build-initiate-sect-review.mjs`.

## Fifteenth pass: The Interface's "Integration" — a clean 3-category section, no new findings beyond the established patterns

One clean 3-mandatory-category section (Upgrades pick-2-of-8, Faults
pick-2-of-7, Origin pick-1-of-5 title+description), no new schema per
Yoshi. Page 35, "Integration" column (x ~280–505). Confirmed via
`pdftotext -raw` no column-swap defect on this page.

Shape mix handled with the two now-established techniques: the framing
sentence and the two label-only tag lists (Upgrades/Faults, side-by-side
sub-columns within the one column) via `extract-runs.mjs` +
`splice-formatting.mjs`; the Origin section (a transition sentence + 5
real title+description options) via `extract-moves.mjs`, matching its
bullet-driven model exactly (bold `"Label:"` titles, plain descriptions).

**Entirely plain**: the framing sentence, the transition sentence
("Then pick how you gained these abilities.", specifically checked per
the coordinator's request), all 8 Upgrades tags, all 7 Faults tags, and
all 5 Origin descriptions (beyond their own bold titles). Zero italic
anywhere in the section. No new false-positive classes or bold-usage
patterns found this pass — a useful confirmation that the established
technique set (x/y-bounded splice + bullet-driven extraction) now
handles this kind of shape cleanly on the first pass, without needing
any new script capability.

Script: `build-interface-integration-review.mjs`.

## Sixteenth pass: The Monstrous — Monster Breed, Curses, Natural Attacks, and a suggestions appendix; a second colon-delimiter gap and a second cross-call-leakage mechanism

Three bespoke sections (Monster Breed, Curses, Natural Attacks) plus a
suggestions appendix, spanning page 37 (3 targets) and page 38 (1
target). Page 37's "Moves" column is confirmed a standard Move-granting
section, out of scope for this catalogue. Per standard practice,
spot-checked `pdftotext -raw` against both pages for the column-swap
defect before extracting: page 37 is `Monster Breed -> Curses -> Natural
Attacks -> Moves`, page 38 is `Gear -> Getting Started -> Introductions
(column 1) -> History -> Monster Breed Suggestions (column 2) ->
Leveling Up (column 3)` — correct left-to-right order on both, no swap.

**Target 1 — Monster Breed intro (page 37).** The source has a genuine
typo, "if you you were originally" — preserved EXACTLY as printed per
explicit instruction, since the correction is a separate content-
fidelity call already made on the catalogue side, not re-litigated by
this extraction. One italic span found: "only" in "These are `<i>only</i>`
suggestions: feel free to make a different version!"

**Target 2 — Curses (page 37).** The exact source heading is "Curses,
pick one:" (bold, structural) — no separate "Pick one." sentence exists
beyond this heading. All 4 options (Feed, Vulnerability, Pure Drive, Dark
Master) have bold titles and, for 3 of 4, one bold cross-reference each
("act under pressure"/variant, base-move pattern); Dark Master has none
beyond its title. Found and fixed a real `extract-moves.mjs` gap: 3 of
the 4 options (Vulnerability, Pure Drive, Dark Master) have a colon-free
bold title run followed by a REGULAR-styled run that itself starts with
the colon (": Pick a substance...") — unlike Feed's title, whose colon is
baked into the bold run itself ("Feed:") — inconsistent even with its own
sibling in the same Curses section. This is the mirror image of Haven's
leading-period bug (Ninth pass); fixed the same way, by adding a generic
leading-`": "` strip alongside the existing leading-`". "` strip, verified
as a no-op against all 16 prior playbooks via full regression. Also
needed a tightened `--minY` (170→180) after an initial pass let "Natural
Attacks" (the next section's own heading, not a move bullet) bleed into
Dark Master's description as trailing bold text — `extract-moves.mjs`'s
segment-splitting has no way to know a heading, rather than a move
bullet, ends a section's range.

**Target 3 — Natural Attacks (page 37).** The framing sentence ("Pick a
Base and add an extra to it, or two Bases.") is entirely italicized — the
whole sentence, not a partial emphasis. All 4 Base and 3 Extra
descriptions are entirely plain, single PDF text items with no font-based
title signal at all — same treatment as Forged's Benefits (Tenth pass):
presented as flat descriptions, not a font-derived title+description
split, and flagged as such rather than presented as equivalent to the
other pick-lists in this pass.

**Target 4 — Monster Breed Suggestions (page 38).** A genuinely new
shape: 7 archetype entries (Vampire, Werewolf, Ghost, Faerie, Demon, Orc,
Zombie), each with a bold archetype name followed by exactly 3
consistently-italicized field sub-labels ("Curse", "Natural attacks",
"Moves") within an otherwise plain summary line — confirmed
programmatically across all 7, a new formatting pattern distinct from
every prior bold/italic usage pattern found in this pipeline so far. Hit
a *second* independent instance of the cross-call-run-leakage class of
bug first found on Hex (Twelfth pass), but via a different mechanism this
time: sharing one unscoped runs list (7 entries × 4 runs each, in order)
across all 7 `splice()` calls let an EARLIER, textually-identical run
("Curse", present verbatim in every entry) match and advance the
forward-only cursor within a LATER entry's own text before that later
entry's own name-run — which appears EARLIER in that entry's own text —
could ever be reached; only entry 1 (Vampire) escaped the bug by luck of
being first. Fixed by partitioning the runs list into one 4-run scoped
set per entry (name + Curse + Natural attacks + Moves, in that entry's
own order) rather than sharing the whole column's runs across all 7
calls — the same fix shape as Hex's, applied to a different root cause.
Worth remembering as a standing rule alongside Hex's finding: **never
share one runs.json across multiple `splice()` calls covering
structurally-repeated content**, regardless of which specific mechanism
(repeated word vs. repeated multi-run group) would trigger the leakage.

Script: `build-monstrous-review.mjs`.

## Seventeenth pass: The Pararomantic — a genuinely new no-top-level-bullet list shape, and a title-delimiter-free options shape

Three targets across pages 41-42. Per standard practice, spot-checked
`pdftotext -raw` against both pages for the column-swap defect before
extracting: page 41 is `Luck -> Relationship Status -> Harm -> Experience
-> ratings -> Moves -> Bond Abuse`, page 42 is `Getting Started ->
ratings -> Gear -> Leveling Up -> Improvements -> Advanced Improvements
-> Introductions -> History -> Fate Of Your Love` — correct order on
both, no swap.

**Target 1 — Relationship Status track labels (page 41).** The track's
own start/end labels ("Loving"/"Broken") are entirely plain, confirmed
programmatically (0 of 2 collided with a detected bold/italic run). The
only bold text anywhere in that area is the "Relationship Status"
section heading itself, outside the two labels' own Y-range.

**Target 2 — Bond Abuse (page 41).** A genuinely new content shape for
this pipeline: flowing prose with TWO real nested "•" bulleted lists (a
3-item roll-outcome breakdown plus a separate 4-item consequence list)
but ZERO top-level "b"-glyph bulleted entries at all — i.e. not a
"Moves"-shaped list. `extract-moves.mjs`'s existing model only builds
`<ul>`/`<li>` structure INSIDE a bullet-delimited segment; with zero
top-level bullets, `moves` comes back empty and the old `intro` field
was plain string concatenation only — it would have silently flattened
both real lists and every inline bold/italic run in the column. **Fixed
generically, not worked around locally**: factored the existing
per-move body-building logic (nested-list detection + inline run
merging) out of `processMove()` into a shared `buildBodyHtml()`
function, and added a fallback — fires only when `bulletIdx.length ===
0` — that runs the same logic over the whole column and exposes the
result as a new `flatBodyHtml` field. Verified this fallback is purely
additive: it never fires for any of this script's 17 prior invocations
(every one of them targets a real "Moves"-shaped column with top-level
bullets, or it wouldn't be using `extract-moves.mjs` over
`extract-runs.mjs` to begin with) — confirmed via a full regression
re-run of all 17 prior build scripts, byte-identical output before and
after. Also found: one bold cross-reference ("fate of your love",
pointing forward to Target 4's own section on the reverse side) and one
term-definition bold ("Bond Abuse:", introducing the move by name
mid-paragraph — same pattern as Hex's "rote").

**Target 3 — Gear's Guide-Gift options (page 42).** A real top-level-
bulleted title+description shape (has "b" glyph bullets, so
`extract-moves.mjs` is the right tool) — but like Forged's Benefits, has
NO bold-run font signal marking a title boundary. Unlike Benefits,
there's no colon or any other delimiter in the source text either (each
option reads as one continuous sentence, e.g. "Part of their body, e.g.
a vial of blood..."). Rather than inventing an unsupported splitting
heuristic (e.g. on ", e.g."), titles in this pass's output are the
coordinator's own supplied labels, assigned externally by the build
script and explicitly flagged as NOT derived from any PDF signal;
`descriptionText` is left as the full extracted sentence, unsplit,
rather than fabricating a boundary the source doesn't actually mark —
a stricter caveat than Benefits', which at least had a real (if
non-font) delimiter to split on. One inline bold cross-reference found:
"bond abuse" in the memento gift's "+1 on bond abuse rolls." (Target
2's own move, referenced by name).

**Target 4 — Fate Of Your Love (page 42).** Entirely plain, confirmed
programmatically (0 bold/italic runs in the whole paragraph). Source has
a real hyphenated line-wrap ("is for- bidden or doomed") preserved
literally per the established cosmetic-artifact convention (same
treatment as Monstrous's "pres- sure"), not silently rejoined. The
source has a visible paragraph break, which `splice-formatting.mjs`'s
own whitespace normalization collapses into a single space in the
stored text — matching how every other flat multi-line block in this
pipeline has always been stored, not treated as a paragraph-array field.

Script: `build-pararomantic-review.mjs`.

## Eighteenth pass: The Professional's "Agency" — a fifth instance of the heading-bleeds-into-body false positive

One clean 2-mandatory-category section (Resources pick-2-of-10, Red Tape
pick-2-of-9), no new schema — pure formatting extraction. Page 44,
"Agency" column (left side, x ~30-270). Confirmed via `pdftotext -raw`
no column-swap defect on this page (Getting Started -> ratings -> Agency
-> Introductions -> History -> Leveling Up -> Improvements -> Advanced
Improvements, correct order).

**A fifth documented instance of the heading-bleeds-into-body false
positive** (Curse-eater's "and", Envoy's "Overseers", Hex's "Rotes",
Initiate's "Sect", now Professional's "Agency"): an initial Y-bound
still included the "Agency" section heading itself (a standalone bold
text item), which is coincidentally text-identical to the ordinary
(non-bold) word "Agency" used twice in the framing paragraph's own body
text ("Is the Agency's goal to..." and "...resource tags for the
Agency..."). The first splice attempt wrongly bolded the first of those
two plain occurrences — caught immediately in the splice output before
trusting it, verified directly against the raw item dump that both
in-paragraph "Agency" occurrences are plain WarnockPro-Regular text, and
fixed the same way as every prior instance: tightened the Y-bound to
exclude the heading.

With that fixed: framing block entirely plain. Both "Resources"/"Red
Tape" headings are bold, with their own "(pick two):" suffixes as a
separate plain-styled run — same minor stylistic detail already seen on
Initiate's Sect. All 10 Resources tags and all 9 Red Tape tags entirely
plain, confirmed programmatically (0 collisions). Zero italic anywhere
in the section (confirmed both via the runs check and by checking the
whole page for any italic font at all in this x-range — none).

Script: `build-professional-agency-review.mjs`.

## Reviewable output for Skyler

`tools/pdf-extract/crooked-background-review.html` — open directly in a
browser. Covers all 7 Background options (title + bold-marked description)
plus Heat and Underworld's top-level options (both correctly render with
no bold/italic — verified from the source that page 12 has no italic font
at all and its only bold text is section headings, none inside option
bodies, so the plain pass-through is the *correct* result there, not a
gap). Bold is shown in red and italic in blue purely to make them easy to
eyeball at a glance next to the PDF — the real app will style `<b>`/`<i>`
normally once this data is imported.

`tools/pdf-extract/crooked-background-review.json` is the same data as the
actual `title`/`descriptionText` shape `BespokeOption` rows would be
authored from.

`tools/pdf-extract/covenant-moves-review.html`/`.json` — the second
validation pass's output, same style, covering all 7 of The Covenant's
Moves. Skyler approved the first file's format directly ("no Angular
preview needed"), so this one follows it exactly rather than introducing
a new review format.

`tools/pdf-extract/divine-mission-review.html`/`.json` — the third pass's
first file, all 5 Mission options, same visual style (the one italicized
"any" is easy to spot in blue).

`tools/pdf-extract/chosen-fate-review.html`/`.json` — the third pass's
second file, all 33 tags across the three pick-groups (How You Found Out /
Heroic / Doom), rendered as plain pill-style tags since there's no
description text or inline formatting to show for this shape — the file's
own note states the extractor's zero-collision check result directly
rather than silently asserting "nothing to see here."

`tools/pdf-extract/action-scientist-area-of-study-review.html`/`.json` —
the fourth pass's output, all 7 Area of Study options. The review note at
the top states directly which of the 4 "expected plain" options actually
turned out to have real formatting, rather than leaving that discovery
buried in the JSON for Skyler to notice unprompted.

`tools/pdf-extract/changeling-unknown-heritage-review.html`/`.json` — the
fifth pass's output: all 10 tags, the select instruction, the trailing
explanatory paragraph (bold cross-references visible in red), and a
highlighted callout box in the HTML stating the blank-marker finding
in full, exactly as it needs to reach Yoshi, not just as a JSON field.

`tools/pdf-extract/covenant-friendship-review.html`/`.json` — the sixth
pass's output: the Covenant ability paragraph, the Friendship intro
(italic book title visible in blue), all 3 Type options with their
descriptions, all 8 Style tags, and the same style of highlighted
blank-marker callout box as the Changeling review.

`tools/pdf-extract/curse-eater-review.html`/`.json` — the seventh pass's
output, both targets: the Corruption paragraph (2 bold spans, 1 italic
span visible) with the Consumed-Magic-split finding in a callout box, and
the "How consuming magic works" pick-1-of-5 list with a **green**
(present, not the usual amber-for-absent) callout box giving the exact
blank-marker text and underscore count for "Something else".

`tools/pdf-extract/envoy-review.html`/`.json` — the eighth pass's output,
both targets: Task's 4 options, Secret Wisdom split into Description
(italic visible) and EffectText (both bold and italic visible per entry),
and Overseers' intro/Values/Concerns/trailing paragraph with two
independent green PRESENT callout boxes (one per "Something else"),
each stating its own exact underscore count and rendering convention.

`tools/pdf-extract/expert-haven-review.html`/`.json` — the ninth pass's
output, all 9 Haven options (Armory outlined in green to draw the eye to
its list-structure callout box), clean descriptions (no stray leading
". " thanks to the `extract-moves.mjs` fix), bold cross-references
visible in red.

`tools/pdf-extract/forged-review.html`/`.json` — the tenth pass's
output, both targets: Bonds/Burdens/Range/Flaws tags, Dual Nature's
description (bold visible), Benefits with an amber flag box making the
"not font-derived" caveat visible right next to the option cards rather
than only in the JSON, and Origin's Forging/Partnering options with two
more green PRESENT blank-marker boxes.

`tools/pdf-extract/gumshoe-code-review.html`/`.json` — the eleventh
pass's output: the framing sentence, the Example Codes block shown both
as the raw italic run (blue) and as individual pill-style sentences, and
the consequence paragraph with all 3 bold spans visible (including the
two in-playbook move-name cross-references, not just the base-move one).

`tools/pdf-extract/hex-review.html`/`.json` — the twelfth pass's output:
Temptation's framing + all 7 options, the Rotes blurb, the full page-29
explanation (with the hand-corrected paragraph called out in its own
amber flag box, not silently blended in with the spliced text), the
worksheet's short Requirements form, and a plain-language table of every
worksheet field label's exact formatting (or lack of it).

`tools/pdf-extract/host-symbiosis-review.html`/`.json` — the thirteenth
pass's output: the framing sentence, all 10 Benefits and 7 Downsides
tags, and a green callout box stating the EffectText-candidate
double-check's result directly.

`tools/pdf-extract/initiate-sect-review.html`/`.json` — the fourteenth
pass's output: the framing/flavor-question block, all 13 Good Traditions
and 12 Bad Traditions tags, and a flag box noting page 33's Moves is
explicitly out of scope for this pass.

`tools/pdf-extract/interface-integration-review.html`/`.json` — the
fifteenth pass's output: the framing sentence, all 8 Upgrades and 7
Faults tags, and the Origin section's transition sentence plus all 5
title+description options.

`tools/pdf-extract/monstrous-review.html`/`.json` — the sixteenth pass's
output: the Monster Breed intro (typo preserved, italic "only" visible in
blue), all 4 Curses options, the Natural Attacks framing sentence plus
all 4 Base and 3 Extra descriptions, and all 7 Monster Breed Suggestions
archetype entries with their bold names and italic field sub-labels.

`tools/pdf-extract/pararomantic-review.html`/`.json` — the seventeenth
pass's output: the Relationship Status track's two labels, the Bond
Abuse block with its two real `<ul>`/`<li>` lists rendered inline (the
new `flatBodyHtml` shape), all 4 Guide-Gift options (titles flagged as
externally-supplied, not PDF-derived), and the Fate Of Your Love
paragraph.

`tools/pdf-extract/professional-agency-review.html`/`.json` — the
eighteenth pass's output: the Agency framing block (correctly plain
after fixing the false-positive `<b>Agency</b>`), all 10 Resources tags,
and all 9 Red Tape tags.

## Recommended workflow for Phase 4/6/7 authoring (going forward, per playbook)

**For flat description text with only inline emphasis** (Crooked's
Background-shaped content):

1. Keep using `pdftotext -layout` first, exactly as already established,
   to find the page(s) and get the authoritative plain text — this stays
   the primary tool, unchanged.
2. `node tools/pdf-extract/dump-page.mjs <pdf> <page>` to read off the
   x-coordinate range of the column you're about to author from.
3. `node tools/pdf-extract/extract-runs.mjs <pdf> <firstPage> <lastPage> --json --minX N --maxX N > runs.json`
4. Per option/section: save its plain text (already being hand-copied into
   `bespoke-ruleset-catalogue.md` today) to a small `.txt` file, run
   `node tools/pdf-extract/splice-formatting.mjs option.txt runs.json --pages N`,
   and use the result as `descriptionText`.
5. **This is a splice, not a black box — always have a human or the
   authoring agent read the stderr warnings and the final result before
   it goes in the catalogue**, the same review discipline already applied
   to the plain-text-only entries there. The false positive documented
   above (found *because* the output was actually inspected, not assumed
   correct) is the concrete argument for keeping that review step, not
   dropping it once formatting is involved.

**For Moves-shaped content (bold titles, possible nested roll-result
lists)**, per the second validation pass above:

1. `node tools/pdf-extract/dump-page.mjs <pdf> <page>` to find the target
   column's x-range.
2. `node tools/pdf-extract/extract-moves.mjs <pdf> <page> --minX N --maxX N --json`
   — produces `{title, descriptionHtml}` per move directly, `<ul><li>`
   included where the source has it, no separate splice step.
3. Same review discipline as above — read the output, don't assume it's
   correct. The real spacing bug caught and fixed during this pass (see
   above) was found this way, not by trusting the first run.

Full usage details for every script: `tools/pdf-extract/README.md`.

## Flagged, not acted on in this pass

Same cross-reference `phase5-bespoke-ideation.md` already raised and
deliberately left un-actioned as a *modeling/schema* decision (this task
stayed a tooling validation, not a scope expansion): **`PlaybookMove.
DescriptionText`** (an existing Phase 2 field) likely needs the same
constrained-HTML-subset treatment for its roll-result bullet breakdowns.
**The extraction technique for exactly that shape is no longer
theoretical** — `extract-moves.mjs`, built and validated in this pass
against The Covenant's actual Moves section, produces precisely this
`<ul><li>`-breakdown output today. Picking up `PlaybookMove.
DescriptionText` for real authoring needs no new extraction approach, just
running the already-built tool.

## Where everything lives

- `tools/pdf-extract/` — the whole POC: `package.json` (only
  `pdfjs-dist`, isolated from `src/web`'s dependencies), `dump-page.mjs`,
  `list-fonts.mjs`, `extract-runs.mjs` (now with optional
  `--minY`/`--maxY`), `splice-formatting.mjs`, `extract-moves.mjs` (same
  optional `--minY`/`--maxY`), `build-crooked-review.mjs`,
  `build-covenant-moves-review.mjs`, `build-divine-mission-review.mjs`,
  `build-chosen-fate-review.mjs`,
  `build-action-scientist-area-of-study-review.mjs`,
  `build-changeling-unknown-heritage-review.mjs`,
  `build-covenant-friendship-review.mjs`,
  `build-curse-eater-review.mjs`, `build-envoy-review.mjs`,
  `build-expert-haven-review.mjs`, `build-forged-review.mjs`,
  `build-gumshoe-code-review.mjs`, `build-hex-review.mjs`,
  `build-host-symbiosis-review.mjs`, `build-initiate-sect-review.mjs`,
  `build-interface-integration-review.mjs`, `build-monstrous-review.mjs`,
  `build-pararomantic-review.mjs`, `build-professional-agency-review.mjs`,
  `README.md`, plus the
  thirty-eight review-output files (`crooked-background-review.json`/`.html`,
  `covenant-moves-review.json`/`.html`,
  `divine-mission-review.json`/`.html`,
  `chosen-fate-review.json`/`.html`,
  `action-scientist-area-of-study-review.json`/`.html`,
  `changeling-unknown-heritage-review.json`/`.html`,
  `covenant-friendship-review.json`/`.html`,
  `curse-eater-review.json`/`.html`,
  `envoy-review.json`/`.html`,
  `expert-haven-review.json`/`.html`,
  `forged-review.json`/`.html`,
  `gumshoe-code-review.json`/`.html`,
  `hex-review.json`/`.html`,
  `host-symbiosis-review.json`/`.html`,
  `initiate-sect-review.json`/`.html`,
  `interface-integration-review.json`/`.html`,
  `monstrous-review.json`/`.html`,
  `pararomantic-review.json`/`.html`,
  `professional-agency-review.json`/`.html`).
- This file.
