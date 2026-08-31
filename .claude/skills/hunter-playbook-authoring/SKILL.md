---
name: hunter-playbook-authoring
description: Author one Monster of the Week hunter playbook's standard-section data into the app, by extracting it from the source PDF, self-verifying it against the known-artifact checklist, and creating it through the real Playbooks API. Use when importing or re-importing a playbook (Phase 4's three pilots, Phase 8's remaining 25), or when correcting an already-authored playbook's standard sections.
---

# Authoring a hunter playbook

Read the source PDF → extract the standard-section fields → self-verify against the
artifact checklist → create the record through the real API. **One playbook per task.**

Written during Phase 4 while authoring The Chosen, The Crooked, and The Divine; every rule
below comes from something that actually happened in that pass, not from anticipation.
Extend it as later playbooks teach you more — that is the intended lifecycle, and Phase 8
inherits whatever state it is in.

**Completed 2026-08-31 — all 28 playbooks are authored.** This file was extended after each
of Phase 8's four groups, and the single most useful thing in it is not any individual rule
but the pattern those extensions kept revealing: **rules derived from a small sample were
really that sample's coincidences.** Three checks built from the three Phase 4 pilots encoded
their shared accidents as universal facts, and each was wrong by the fourth playbook — one
would have failed four correct imports outright. Group 2 then broke two of the *replacements*.
Group 3 found a verifier test that was circular and could never fire. Group 4 found a check
that only ever looked one level deep.

Sections marked *(group N)* are corrections of that kind. If you are re-importing a playbook
or adding a 29th: when something contradicts this file, suspect the file before you suspect
the page, and prefer a check that reports an oddity over one that asserts a pattern holds.

## Before you start

Confirm three things:

1. **Which playbook**, by name. Never batch. The two layout artifacts this project caught
   were both found by reading one playbook carefully, not by skimming several.
2. **The API is running** and you can authenticate. `Program.cs` sets a global
   `RequireAuthenticatedUser` fallback policy with cookie auth, so every call needs a
   session. There is no anonymous path and you must not add one.
3. **What is in scope this phase.** See "Scope" below — it is narrower than the sheet.

## Scope

**In scope** (the standard sections):

| Section | Field |
|---|---|
| Flavor blurb | `description` |
| Luck | `luckBoxCount`, `luckSpecialText` |
| Harm | `harmBoxCount`, `harmUnstableThreshold` |
| Experience | `experienceBoxCount` |
| Getting Started | `gettingStartedText` |
| Introductions | `introductionsText` |
| Leveling Up | `levelingUpText` |
| History | `historyPromptsText` |
| Ratings | `statArrayOptions[]` |
| Gear | `gearCategories[]` → `options[]` |
| Look | `lookCategories[]` → `options[]` |
| Improvements + Advanced Improvements | `improvements[]` (one table, `isAdvanced` splits them) |

**Also in scope from Phase 8 onward** — a playbook is now authored complete, in one pass:

- **Moves**, as `moves[]` plus a real `moveGrantCount`. See "Authoring Moves" below.
- **Bespoke rulesets** (Background, Heat, Underworld, Fate, Mission, Corruption, …), plus
  `bespokeJournals[]` and `extraTracks[]` where the playbook has them. Any section on the
  sheet not in the table above is almost certainly bespoke. See "Authoring bespoke content".

Send `moves: []` / `moveGrantCount: 0` / empty bespoke arrays **only** if you are deliberately
doing a standard-sections-only pass. The verifier no longer asserts either state; it asserts
that `moves` and `moveGrantCount` *agree with each other*, which is the real invariant.

**Out of scope, permanently:**

- **Pronouns.** A blank line on every sheet with nothing to model at playbook level.

## Authoring bespoke content

**`bespoke-ruleset-catalogue.md` is the authoritative definition** — structure, select
counts, nesting, and the decisions behind them. Read the playbook's entry before you start;
it will usually tell you the shape outright.

**But take the actual option text from `tools/pdf-extract/<playbook>-*-review.json`, not from
the catalogue's markdown *(group 1)*.** Those review files are the pipeline's own verified
output, with real markup and no transcription step between them and you. The catalogue wraps
tags in backticks so they render in Markdown preview, and normalises typography to match the
document's own style — both fine for a document, both wrong to copy into stored data. Restore
the source's typography from the raw text.

**The catalogue is authoritative for structure, but its orderings and counts are not.**
Across all four groups, checking it against the page found **eleven** errors — every one of
them either a list recorded row-major where the sheet prints a column-major grid (Covenant's
Friendship styles, Forged's Range and Flaws, Spooky's 16 Dark Side tags, two of the Visitor's
Expatriation sub-blocks, the Wronged's "Why couldn't you save them?") or a miscount (Curse-
Eater's gear ×3, Interface's advanced improvements, Searcher's investigation tools, Visitor's
improvements). Its *structural* decisions — section boundaries, select counts, nesting,
`{{blank}}` placement — held up throughout and should be followed. Verify every ordering and
every count against the page; when they disagree, the page wins and the catalogue gets fixed.

**Section titles follow the catalogue, not the sheet's capitalisation.** The Curse-Eater
prints "How consuming magic works" in sentence case; every other bespoke section across all
28 is title case, and it is stored as "How Consuming Magic Works" to keep the layer uniform.

**`{{blank}}` marks where the UI renders a stored input — that is the whole test.** Add it on
semantic grounds whether or not the source prints an underscore run (a trailing "Something
else", a grammatically incomplete "Allergy to"). **Do not** add it to blanks inside a move's
prose that are filled fresh each time the move is used — the Changeling's Faerie Gossip prints
two such questions, and nothing is stored per Hunter for them, so the printed underscores stay
literal. The verifier enforces this split: untokenized underscore runs fail everywhere except
move bodies.

## Authoring Moves (Phase 6 schema)

Moves land through the same endpoint, as `moves[]` plus a real `moveGrantCount` read off the
grant sentence ("You get all the basic moves, and **two** Crooked moves").

**Use `tools/pdf-extract/extract-moves.mjs`, not `pdftotext`.** `PlaybookMove.DescriptionText`
is the one standard field carrying the constrained HTML subset, and plain extraction cannot
see bold or italic at all.

**Read the page's geometry before extracting — bound `y` as well as `x`.** Dump every
section heading's coordinates and work out the Moves block's real extent:

```bash
node dump-page.mjs "$PDF" <page> | grep -E '"str":"(Moves|Gear|Mission|Fate|[A-Z][a-z]+)"'
node extract-moves.mjs "$PDF" <page> --minX N --maxX N --minY N --maxY N --options --json > moves.json
```

Two layout traps, both of which fail **silently** — no error, just wrong output:

- **Moves and Gear often share a column**, Gear printed below. Without a `--minY` floor at
  the Gear heading, gear rows are returned as extra moves with empty titles.
- **A playbook's Moves list may span two columns.** Known on Curse-Eater, Divine, Forged,
  Gumshoe and Hex — five of the fourteen authored so far, so assume it until the geometry
  says otherwise. Extract each column separately and concatenate down-column-1-then-
  down-column-2, matching the reading order used for two-column Improvements.
- **The content-stream order can disagree with the visual order** *(group 2)*. On The Forged,
  `-raw` emits the "Then pick one of these:" pool column *before* the Moves heading and its
  Required move, so reading order alone would put the pool first. Extract by coordinates and
  concatenate required-first; do not trust `-raw` to order the columns for you.
- **The Required move and the pool can sit in the same column as unrelated sections.** On
  the Hex, Bad Luck Charm is at the *foot* of a column whose upper half is Temptation's
  options; on the Gumshoe, the two Required moves sit under the Gumshoe Code block. Both
  need a `--maxY` ceiling just below the grant sentence, not just an `x` range.
- **The pool does not always come after the Required move** *(group 3)*. The Professional
  prints "Pick three of these:" first and "And you get this one:" last. Store moves in
  printed order — `Required` is a flag, not a position.

**Two Required moves have no printed name at all** *(group 3)* — The Initiate's and The
Professional's. The extractor returns an empty title, which is the tell. Both were named by
Skyler ("One of Us", "Agency politics"); use those and add them to the verifier's
`SYNTHESIZED` set. Do not invent a name for a third such case — surface it.

**Always cross-check the extracted move count against the raw source before authoring:**

```bash
pdftotext -raw -f <page> -l <page> "$PDF" - | sed -n '/^Moves/,/^Gear/p' | grep -cE '^b'
```

A count mismatch means one of the two traps above bit. This is the check that caught The
Divine returning four of its seven moves.

**Post-process the extracted HTML — two artifacts survive extraction *(group 1)*.** Both are
line-wrap noise the extractor deliberately does not guess at, and both trip the mid-word-split
check:
- A hyphen split across a line break: `per- ceptions`, `con- sumed`, `ban- ished`. Join with
  `s/([a-z])-\s+([a-z])/$1$2/g`. This is safe as written: a genuine compound hyphen is never
  followed by whitespace.
- An em dash followed by the wrap: `happens— usually`. Join with `s/—\s+/—/g`. Also safe —
  MOTW never spaces its em dashes.

Phases 4–7 shipped five moves across the three pilots carrying uncorrected hyphen splits,
because the Phase 4 verifier only scanned prose and option fields and Moves did not exist yet
when it was written. Both are fixed and the check now covers move bodies and bespoke text.

**Watch for kerning splits in display-font titles *(group 2)*.** Heavy letter-spacing makes
the extractor emit spurious spaces *inside* words: The Forged's "Don't Worry About Me" comes
out as `D on’t Worr y Ab out Me`. Unlike a hyphenation break there is no punctuation left
behind, so the only signal is a stranded single letter — and English has exactly two
one-letter words, which is what the verifier keys on. Register the correction in
`EXEMPTIONS`, since the stored text then differs from what naive extraction reads.

**Strip the pool lead-in from the last Required move.** "Then pick two of these:" sits inside
the last Required move's y-band, so the extractor attributes it to that move. It belongs to
neither — the grant structure is already carried by `MoveGrantCount` + `Required`. Seen on
the Celebrity's Fakelore and the Changeling's Glamour; expect it on every playbook that names
Required moves before its pool.

**Take text from the `*Html` fields, never the plain ones.** Each option carries both `raw`
and `rawHtml`, `descriptionText` and `descriptionHtml`. The plain variants have had the
markup stripped. This cost real content once: The Crooked's "Imp stone" contains
`<b>use magic</b>`, and authoring from `raw` dropped it silently — nothing failed, the text
was just quietly poorer. Titles are the exception: use the plain `title`, because Section 6.1
says titles never carry markup.

**A move with an embedded creation-time pick becomes a `BespokeSection` nested under it**
(`moves[].bespokeSections`), using the whole Section 6 apparatus. Only 14 such moves exist
across all 28 playbooks — `custom-moves-ideation.md` §2.1 is the authoritative inventory, so
check it rather than deciding case by case. `extract-moves.mjs --options` detects candidates
and tells you how many it found, which is a useful cross-check against that list.

When you model one:
- The **Section title** is the move's own name; its `Description` stays **null** and the
  printed instruction ("Pick one:") is **dropped entirely** — Section 6.1, redundant with
  `MinSelect`/`MaxSelect`. Read the real counts off that instruction: "Pick one" is 1/1,
  "Pick one or two things" is a genuine 1/2 range.
- **Remove the enumerated run from the move's own `DescriptionText`**, keeping the lead-in
  sentence. The options now live in the Section, and leaving them in both renders the list
  twice.
- **`titleProvenance: delimiter:paren` must be read every time, never auto-accepted.** The
  same shape means opposite things: in Crooked's "Protective amulet (1-armour magic
  recharge)" the parenthetical is the *description*; in Gumshoe's "Criminals (organised)" it
  is part of the *name*.

**In-play menus, computed option sets, and roll-outcome branching all stay prose** in
`DescriptionText`. Only creation-time picks are modelled. That boundary is settled — see
`custom-moves-ideation.md` §2.2 for the ~35 moves examined and deliberately ruled out.

**Surface deviations; do not absorb them.** Where a section is expected to be near-identical
across playbooks (the Luck track wording, Harm, Experience, the presence of Ratings), a
playbook that differs is a finding to report, not a variation to quietly normalise away.

## Step 1 — Locate the pages

Playbooks are **usually** two pages, starting on an odd page — but not always: The Hex runs
27–30, because pages 29–30 are a dedicated "Rotes (The Hex)" worksheet insert, and its real
ruleset content lives on that insert rather than on the playbook proper. Check what follows
the second page before assuming the spread ends there. To find one:

```bash
PDF="C:/Users/malev/Downloads/RPGs/Monster of the Week/Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf"
for p in $(seq 1 58); do
  echo "p$p: $(/mingw64/bin/pdftotext -layout -f $p -l $p "$PDF" - 2>/dev/null | grep -oiE '^\s*THE [A-Z][A-Za-z-]+' | head -1)"
done
```

Known so far: Action Scientist 1–2, Celebrity 3–4, Changeling 5–6, Chosen 7–8, Covenant 9–10,
Crooked 11–12, Curse-Eater 13–14, Divine 15–16, Envoy 17–18, Expert 19–20, Flake 21–22,
Forged 23–24, Gumshoe 25–26, Hex 27–30 (incl. the Rotes insert), Host 31–32, Initiate 33–34, Interface 35–36,
Monstrous 37–38, Mundane 39–40, Pararomantic 41–42, Professional 43–44, Searcher 45–46,
Snoop 47–48, Spell-Slinger 49–50, Spooktacular 51–52, Spooky 53–54, Visitor 55–56,
Wronged 57–58.

## Step 2 — Extract twice, always

```bash
/mingw64/bin/pdftotext -layout -enc UTF-8 -f <first> -l <last> "$PDF" <name>.txt      # visual grouping
/mingw64/bin/pdftotext -raw    -enc UTF-8 -f <first> -l <last> "$PDF" <name>-raw.txt  # reading order
```

**`-enc UTF-8` is not optional *(group 1)*.** Without it, `pdftotext` emits the minus sign in
a ratings line as a bare `0xAD` byte rather than an en dash, so the file is not valid UTF-8,
`Charm–1` reads as garbage, and every rating check fails for reasons that look like a
transcription error and are not. The flag also normalises the curly quotes and em dashes you
are about to transcribe. Nothing warns you; the output just looks subtly wrong.

**You need both, and they disagree in a way that matters.**

- `-layout` preserves the visual column structure, so you can see which heading owns which
  block. Use it to understand the sheet.
- `-raw` gives the item stream in reading order. Use it to transcribe **any multi-column
  list**, above all Improvements.

Concretely: Chosen's Improvements are printed in two columns, and `-layout` interleaves them
into `b Get +1 Charm,   b Take another` — which reads as a single option and is wrong.
`-raw` emits them as a clean sequence. Transcribe lists from `-raw`; understand structure
from `-layout`.

Plain `pdftotext` is sufficient for this phase — every in-scope section is plain text.
The formatting-preserving pdf.js pipeline (`tools/pdf-extract/`) is only needed for Moves
and bespoke content, which are out of scope here.

## Step 3 — Transcribe, applying these conventions

Each of these cost real time to work out. Follow them so the 28 playbooks stay consistent.

**Bullet glyphs.** `-raw` renders checkbox bullets as a leading `b` or `B`, and it
frequently **fuses to the following word**: `bAssault rifle`, `bThe End of Days`,
`bA nemesis`. Strip the glyph; do not let it eat the first letter.

**Line-wrapped items.** A wrapped option spans lines in `-raw`: `b Get +1 Charm,` then
`max +3`. Rejoin into `Get +1 Charm, max +3`. Judge by grammar, not line position.

**Mid-word hyphenation — never preserved.** *(Standing rule, Skyler 2026-08-31.)* The source
hyphenates words purely to make lines fit its columns (`complica-tion`, `Addi-tionally`,
`com-ponent`, `imme-diate`). **Store those words whole.** Hyphens that are genuinely part of
the word stay exactly as printed — `Curse-eater`, `fear-based`, `ignore-armour`, `air-supply`,
`co-star`, `not-in-use`.

Telling the two apart is not something to eyeball, because a rejoin performed *without* a
space (`com-ponent`) is shape-identical to a real compound. The evidence is in the raw text,
and the verifier applies it automatically, with three verdicts:

- **printed intact on one line anywhere in the corpus → genuine, keep the hyphen.** The
  corpus is pooled across every authored playbook and also includes a "healed" copy with
  line-break hyphens joined, so `monster-killing` is vindicated even though the Expert only
  ever prints it as `mon-\nster-killing`.
- **only ever broken across a line, AND the joined form is a word the source prints whole
  somewhere → artifact, join it.** This is what separates `com-ponent` (because `component`
  appears elsewhere) from `near-death` (because `neardeath` appears nowhere).
- **anything else → reported as a note, not a failure.** A genuine compound whose break
  landed exactly on its own hyphen is indistinguishable from an artifact by glyphs alone;
  erring toward a note is deliberate, because a false failure on correct data trains the next
  author to ignore the check. Treat the note as "go look at the page."

The real defence is still the de-hyphenation step during authoring plus the spaced-hyphen
check — this classifier is a reviewable signal, not a proof.

**`luckSpecialText`** — strip the `"<Playbook> special:"` label. It is a heading derivable
from the playbook name, not content. Store only the sentence that follows.

**`description`** — the flavor blurb under the title. Keep its line breaks if it is verse
(The Divine) or a quotation (The Crooked). **Leave `tagline` null**: the source gives one
blurb per playbook, not two fields. See "Known gaps".

**`historyPromptsText`** — include the section's own intro sentence ("Go around the group
again…"), then the prompts as a `-` list. Flat text by explicit instruction; do not model
hunter-to-hunter relationships.

**Look categories** — each comma-separated item is one option. The trailing `__________ eyes`
fill-in is **not** an option row; it is `allowsFreeform: true` on the category. Watch for
categories where the blank is *implied* rather than printed — Chosen's first Look category
ends `burnt-out,  .` and Divine's ends `inhuman, ` with a bare trailing comma. Both are
freeform; set the flag from the meaning, not the glyph.

**Ratings** — five lines, five signed integers each. Notation varies across playbooks:
Crooked writes `Tough 0`, Divine writes `Weird=0`. Both mean zero.

**Typography** — preserve what the source prints: curly quotes and apostrophes (`’ “ ”`), em
and en dashes, ellipses. Do not flatten them to ASCII. (The Crooked's `description` is the
one stored value that was normalised, during the first pilot pass, before this was settled;
it is the exception, not the pattern.)

**Genuine source typos are corrected, not preserved *(group 1, Skyler's call 2026-08-31)*.**
The published sheets contain real errors — a stray word that breaks a sentence, `of` for
`or`, two different misspellings of "suspicious" on one page. Store the corrected text.
Because content fidelity is verified against the raw page, **every correction must be added
to the `EXEMPTIONS` table at the top of `scripts/verify.mjs`**, mapping what you stored to
what the page prints, so the check keeps comparing against the real source instead of being
weakened. Line-wrap artifacts (`com- ponent`) are not typos — those are extraction noise and
are always joined.

**Improvements** — one array, `isAdvanced` separates the two lists, and **each list gets its
own `sortOrder` sequence starting at 0**. Use `-raw` order.

**Improvement counts vary — do not treat 10 as a rule *(group 1)*.** Phase 4 asserted exactly
10 regular improvements because all three pilots had 10. The Covenant prints 11. The verifier
now reports an unusual count instead of failing on it. Advanced lists range 7–10.

**A "universal" advanced improvement can also be absent, or worded differently again
*(group 2)*.** The Forged prints "Mark two of the basic moves as advanced" with **no** "Mark
another two" at all, substituting two "Choose an advanced move you have" entries; the Gumshoe
and the Hex print "**Make up** a second hunter", not "Create". The verifier now asserts only
that no beat appears *twice* — duplication is contamination — and reports absences as notes.

**The six "universal" advanced improvements come in two wording families *(group 1)*.** Both
are correct; which one a playbook uses is just which the publisher typeset:

| | Family A | Family B |
|---|---|---|
| | Chosen, Crooked, Curse-Eater | Action Scientist, Celebrity, Changeling, Covenant |
| | "Change this hunter to a new **type**." | "Change this hunter to a new **playbook**" |
| | "…to play **as well as** this one." | "…to play **in addition to** this one" |
| | trailing periods | no trailing periods |

Transcribe whichever the page uses, verbatim, and **never mix them within one playbook** —
mixing is the actual signature of the page-bleed artifact, and is what the verifier now
checks. Individual playbooks vary further inside their family (the Covenant drops "of the"
from "Mark two basic moves as advanced" and omits "Erase one used Luck mark" entirely). An
earlier version of this file asserted family A's wording as universal and treated the string
"new playbook" as proof of contamination; that would have failed four correct imports.

**Multi-column lists are transcribed column-major — down column 1, then down column 2
*(group 1, Skyler's call 2026-08-31)*.** This is what `pdftotext -raw` emits and what "top to
bottom" means for a grid. It applies to *every* multi-column list, not just Improvements:
gear grids (the Curse-Eater's 3-column Vehicles) and bespoke option grids (the Covenant's
two-column Friendship styles) included. Worth real care, because getting a grid wrong as a
*sequence* while getting it right as a *set* is invisible downstream — content fidelity
passes either way, since every individual string is still on the page. That is exactly how a
wrong order survived in `bespoke-ruleset-catalogue.md` and a review JSON for four days.

**Gear** — three shapes, all expressible without new fields:
- *Pick N of M*: `pickCount: N`.
- *Automatic grant* (Divine's divine armour): `pickCount: null`, meaning every listed option
  is granted. **Not `0`** — zero would read as "pick none of these".
- *Optional* (Chosen's "if you want" protective gear): `isOptional: true`, with `pickCount: 1`.

A build-your-own weapon (Chosen's Special Weapon) is just several categories, one per facet,
each with its own pick count. No new concept needed.

**Set `sortOrder` on gear categories — not just on their options *(group 1)*.** An authoring
helper that leaves every category at `0` stores them all tied, and their returned order
becomes whatever the database feels like; the admin form then silently renumbers them on the
next save. The same applies to look categories, moves, rating lines and bespoke sections.
Ties are the failure mode worth watching for, because nothing else notices — every string is
still correct, only the order is arbitrary. The verifier now asserts a dense `sortOrder` from
0 on every ordered collection.

**A Gear section's opening sentence is only a category when it grants something.** The Action
Scientist's "You have toolkits containing everything you need…" and the Celebrity's "You
always have copies of your work…" are real automatic grants and become `pickCount: null`
categories, following the Divine's divine-armour precedent. The Curse-Eater's "You get some
handy gear, two practical weapons, and a vehicle" is a *summary* of the three categories
printed beneath it and grants nothing they do not — it is not stored. Read which one you have.

## Step 4 — Create through the API

Write the payload to a JSON file, then POST it. Author through the real endpoint, never a
direct database write: it exercises the same validation a human using the admin form hits,
and keeps one source of truth for how a Playbook gets written.

```bash
curl -s -c cookies.txt -X POST http://localhost:5225/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<dev-account>","password":"<password>"}' -o /dev/null

curl -s -b cookies.txt -X POST http://localhost:5225/api/playbooks \
  -H "Content-Type: application/json" -d @payload-<name>.json -w "\nHTTP %{http_code}\n"
```

Expect `201`. Credentials are runtime-only — **never write them into any file in the repo,
including this one.** Ask for them if you do not have them.

Every child object takes `"id": null` on create. The `id` field exists for the update path,
where it drives a row-matching diff; sending a wrong id on create is not possible, but
sending one on update to the wrong row silently rewrites it.

Common `400`s, all real rules and not to be worked around:
- `harmUnstableThreshold` may not exceed `harmBoxCount`.
- A gear category may not pick more options than it lists.
- Playbook names are unique — a duplicate means it is already authored. Use `PUT` to correct
  an existing one, and include each child's real `id` so the diff updates rows in place
  instead of replacing them.

## Step 5 — Self-verify

Agent self-verification is sufficient for a playbook to count as done — there is no
per-playbook human gate. That makes this step the only thing standing between a
transcription error and the production seed. Do not skip it.

`scripts/verify.mjs` alongside this file runs the whole corpus at once. Add your playbook's
key to its `PLAYBOOKS` list (and to `TITLES` if the stored `Name` is not simply
`"The " + Key`), put `<name>-raw.txt` in the working directory alongside `cookies.txt`, and
run it. It re-reads every playbook back **from the API** — not from your payload, which would
only prove JSON parses — and it re-checks the whole corpus each time, so a regression in an
earlier playbook surfaces while you are working on a later one. That is not incidental: this
is how group 1 found four pre-existing defects in the Phase 4–7 pilots.

```bash
node scripts/verify.mjs <work-dir>
```

What it covers:

**The three known artifact classes**, each of which has actually occurred:
1. *Stat/move-pairing merge.* Every sheet prints the five rating labels beside the fixed list
   of eight basic moves, which `-layout` fuses into a convincing but false per-stat pairing.
   Asserts no move is *named* for a basic move. (Deliberately not a substring search over the
   whole record: a move body may legitimately cross-reference one — "you never need to **act
   under pressure** to resist fear".)
2. *Page-bleed.* Asserts each of the six universal advanced improvements appears exactly once,
   and that the playbook's wording family is internally consistent. Mixing families is the
   real signature — see the two-family table above for why the old exact-string check was
   wrong, and would have failed four correct imports.
3. *Mid-word column splits.* Two checks, because the two shapes need different evidence: a
   spaced split (`per- ceptions`) is caught by pattern, while a spaceless rejoin
   (`com-ponent`) is shape-identical to a real compound and is settled against the raw
   corpus instead — see "Mid-word hyphenation" above. Both now cover move bodies and bespoke
   text, which is where the pipeline reintroduces them.

**Content fidelity** — every stored string traced back to the raw page, comparing on
alphanumerics only with HTML tags, `{{blank}}` and the source's bullet glyphs stripped.
(That last one matters: `-raw` renders a checkbox as a literal ASCII `b`, sometimes fused
onto the next word, so alphanumeric squashing does *not* remove it and any stored value
spanning a bullet boundary fails to match. The Envoy's Secret Wisdom was the first.) Covers options, improvements, move
names, all six prose fields, every move body, and all bespoke/journal/track text. Two
deliberate accommodations: the `EXEMPTIONS` table (approved departures from the printed page),
and a two-piece allowance for text whose enumerated run was lifted out into a nested structure.

**Ratings** — each line rebuilt as `charm±N,cool±N,…` and matched digit-by-digit.

**Ordering** — every ordered collection has a dense `sortOrder` from 0, and each improvement
list restarts its own at 0. Ties are what this catches.

**Structural coherence** — bespoke select counts valid (both null, both set, or an uncapped
minimum), nested categories' counts within their children, no move-internal section leaking to
playbook level, Required moves not exceeding `moveGrantCount`, and `{{blank}}` used instead of
raw underscore runs everywhere except move bodies.

**Cross-playbook uniformity** — Luck/Harm/Experience box counts match across every authored
playbook. A mismatch is a finding to report, not to fix silently.

**Reported, not asserted** — an unusual improvement count prints as a NOTE. The source is the
authority there; the verifier's job is to make you look, not to overrule the page.

**Also drive the real admin form in a browser** when your playbook is the first to use a
schema feature (the Curse-Eater was the first with a `BespokeJournal` and a
`PlaybookExtraTrack`). Open it for edit, save with no changes, and diff the graph. Because the
upsert endpoint treats an absent child as a delete, a form that fails to round-trip a
collection destroys it silently on the first save — the verifier cannot see that, only a real
round-trip can.

## Settled by decision — apply, do not re-litigate

- **There is no `tagline` field.** It was dropped from the schema on 2026-08-30 once Phase 4
  established that each playbook prints exactly one flavor blurb (prose, a quotation, or
  verse depending on the playbook) and that blurb is `description`. Do not look for a second
  short line, and do not propose re-adding the field.
- **Gear has no freeform escape, and that is accepted for now.** `PlaybookLookCategory` has
  `allowsFreeform`; `PlaybookGearCategory` deliberately does not. Where a gear category ends
  with an open-ended escape — Chosen's Special Weapon Material says "or anything else you
  want" — **store that escape as a final literal option** carrying the source's own wording.
  Skyler's call: this is easy to add properly later if it turns out to matter, and not worth
  a schema change now. Keep doing it the same way so the 28 stay consistent.
- **Look categories have no label.** The category name is carried inside each option's own
  text ("Hard eyes", "friendly eyes"). Confirmed intentional, not an omission.

## Improvement ordering — the one rule with a required escalation

Store improvements **in the order printed on the playbook, top to bottom, all regular ones
first and all advanced ones after.** `isAdvanced` separates them within the single array,
and **each list restarts its own `sortOrder` at 0.**

Most playbooks print Improvements in one column, where this is unambiguous.

**When the layout makes reading order genuinely ambiguous, stop and ask Skyler. Do not
pick.** This is an explicit standing instruction, not a suggestion — it has already been
exercised once and the answer was not the one a literal reading would have produced.

The Chosen prints its Improvements in two sub-columns. Read literally down the left column
then the right, its two "Take a move from another playbook" entries land 6th and 7th — but
every other playbook puts them last. Skyler chose the cross-playbook pattern:

> stat boosts → take-another-*playbook*-move ×2 → bespoke grant(s) → take-a-move-from-another-playbook ×2

which is also the order `pdftotext -raw` emits. Use that precedent to recognise the shape,
**not** to resolve the next ambiguity silently — surface that one too.

## Other gaps — report, do not invent

If your playbook hits something with no clean representation, note it in your report rather
than improvising.

**Outstanding, raised in group 1 and awaiting Skyler's call:**

- **A Gear section's trailing prose has nowhere to live.** The Action Scientist ends its Gear
  block with a note explaining the "batteries" and "autonomous" tags. Skyler's call for that
  instance was to drop it; it appears on no other sheet (grepped across all 58 pages). If a
  second instance turns up, that changes the calculus — raise it rather than dropping again
  by default.

**Settled in group 4, no longer open:**

- **Bounded-repeatable free text uses `FreeTextLabel` + `MinInstances`/`MaxInstances`.** The
  Searcher's Network ("detail up to five members") is 0–5; the Spell-Slinger's Arcane
  Reputation ("pick three organizations") is 3–3. Neither has a printed option list at all,
  which is what separates this from an ordinary pick.
- **A gear pick-list can end with a printed blank slot** (the Snoop's Recording devices and
  Detectors). Store it as an option named `{{blank}}` — the first use of the token outside
  the bespoke layer, and the right one: the token means "the UI renders an input here", which
  is exactly what the printed underscore run says.
- **The Spell-Slinger's Tools and Techniques is stored as its positive equivalent.** The
  source says "Cross off one; you'll need the rest" — an inverted pick. Skyler directed it be
  stored as "pick three of the four". It is the only non-literal rewrite in the Moves layer;
  the reworded sentence is declared in `SYNTHESIZED`.
- **A move title can swallow its trigger clause.** Where the source bolds the move name and
  the trigger as one run (the Spooky's Premonitions, Hunches), the extractor's bold-derived
  title takes both. Split at the first colon and re-wrap the trigger in `<b>` — the emphasis
  is real, it just is not part of the name.

**Settled in group 3, no longer open:**

- **A playbook may print no flavour text at all.** The Pararomantic has neither a blurb under
  its title nor a quotation anywhere on its spread, so its `description` is a real null. Check
  the whole spread before concluding either way — the Gumshoe and Hex *do* have one, just not
  where you would look first. The verifier reports a null `description` instead of failing.
- **`PlaybookExtraTrack.Description` is nullable.** The Pararomantic's Relationship Status
  prints only a header and its box row; the mechanics that drive it live in Luck's special
  text and in Fate of Your Love and are stored there. Do not duplicate them onto the track.
- **`PlaybookGearCategory.Label` holds up to 512 characters.** The Initiate's Gear block opens
  with a 280-character conditional paragraph that is the only statement of what its two pick
  counts are — and those counts depend on a *bespoke* ruleset (the Sect's Traditions), the
  first standard-section-depends-on-bespoke case in the corpus. Skyler's call was the
  headroom over a separate notes field. Store the permissive maxima and let the label carry
  the real rule, the same prose-only resolution as Monstrous's Natural Attacks either/or.
- **Declare synthesized text in the verifier's `SYNTHESIZED` set.** Some stored strings are
  legitimately not on the page: two Required moves the source never names ("One of Us",
  "Agency politics"), category labels the source gives only as a sentence ("Origin") or not
  at all ("Agency name:"), and the Pararomantic's four Guide's Gift titles, which have no
  delimiter of any kind to split on. Adding a string there is a deliberate, cited act —
  never loosen the fidelity check itself to let invented text through.

**Settled in group 2, no longer open:**

- **A playbook with no blurb under its title uses its flavour quotation instead.** The
  Gumshoe prints one at the very foot of its last column, the Hex at the foot of its Moves
  column; both go in `description` (Skyler, 2026-08-31). Check the whole spread before
  concluding a playbook has no blurb.
- **`PlaybookLookCategory.GroupLabel`** carries the heading a sheet prints above a run of
  Look categories. Null on 27 of 28; The Forged's "Human look:" / "Weapon look:" is the only
  instance, and the reason the column exists.
- **`PlaybookMove.IsAdvanced`** marks a move reachable only through an advanced improvement,
  never granted and never in the pick pool. Only The Hex's Apotheosis/Synthesis. It splits
  the Moves table into two lists exactly as `IsAdvanced` already splits improvements —
  **each with its own `sortOrder` sequence from 0** — and the two flags are mutually
  exclusive with `Required`.
- **A gear category's auto-grant option must be named in the source's own words.** The Hex's
  grant sentence names no item, and "Magical items or amulets used to perform magic" —
  invented to fill the slot — failed content fidelity. "Magical items or amulets" is on the
  page and passes. If you find yourself composing an option name, you have left the source.

**Settled in group 1, no longer open:**

- **Improvement `sortOrder` restarts at 0 per list, and the admin form now does this too.**
  The form previously numbered the combined array 0–N from its FormArray index, silently
  rewriting the stored numbering of any playbook saved through the UI. Fixed in
  `playbook-form.ts` (Skyler: "I will always want those grouped that way"), and confirmed by
  a no-op save through the real form coming back byte-identical.
- **A nested improvement** (the Changeling's "You find a home. Pick one:" with three
  sub-options — the only one in all 28) stays a single row, with the sub-options in the same
  constrained `<ul>/<li>` subset used elsewhere. It is one pick, so it is one row.
- **A playbook's stored `Name` may differ from the sheet's title block.** "The Curse-Eater" is
  stored capitalised though the sheet prints "The Curse-eater"; its *body* text keeps the
  printed form ("Curse-eater move", "Society of Curse-eaters"), which is quoted content rather
  than the playbook's label. Add any such playbook to the verifier's `TITLES` map.

## Report when done

State: the playbook authored and its id; per-section counts (ratings / gear categories /
look categories / improvements + advanced); verifier results; every deviation surfaced; and
anything you had to judge rather than read directly off the page.
