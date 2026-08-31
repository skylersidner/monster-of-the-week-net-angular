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

**Out of scope for a standard-sections pass — leave empty:**

- **Moves.** Send `moves: []` and `moveGrantCount: 0`. See "Authoring Moves" below — the
  schema now exists, but it is a separate pass with its own tooling.
- **Bespoke rulesets** (Background, Heat, Underworld, Fate, Mission, Corruption, …).
  Any section on the sheet that is not in the table above is almost certainly bespoke.
  Author from `bespoke-ruleset-catalogue.md`, which already holds all 28 playbooks' content.
- **Pronouns.** A blank line on every sheet with nothing to model at playbook level.

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
- **A playbook's Moves list may span two columns.** Known on Curse-Eater, Forged, and The
  Divine, and probably more. Extract each column separately and concatenate down-column-1-
  then-down-column-2, matching the reading order used for two-column Improvements.

**Always cross-check the extracted move count against the raw source before authoring:**

```bash
pdftotext -raw -f <page> -l <page> "$PDF" - | sed -n '/^Moves/,/^Gear/p' | grep -cE '^b'
```

A count mismatch means one of the two traps above bit. This is the check that caught The
Divine returning four of its seven moves.

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

Playbooks are two pages each and **start on an odd page**. To find one:

```bash
PDF="C:/Users/malev/Downloads/RPGs/Monster of the Week/Monster-of-the-Week-Hunter-Playbooks-Consolidated-2025.pdf"
for p in $(seq 1 58); do
  echo "p$p: $(/mingw64/bin/pdftotext -layout -f $p -l $p "$PDF" - 2>/dev/null | grep -oiE '^\s*THE [A-Z][A-Za-z-]+' | head -1)"
done
```

Known: Chosen 7–8, Crooked 11–12, Divine 15–16.

## Step 2 — Extract twice, always

```bash
/mingw64/bin/pdftotext -layout -f <first> -l <last> "$PDF" <name>.txt      # visual grouping
/mingw64/bin/pdftotext -raw    -f <first> -l <last> "$PDF" <name>-raw.txt  # reading order
```

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

**Mid-word hyphenation.** Column breaks hyphenate words (`complica-tion`, `Addi-tionally`).
Rejoin them. Any surviving `x- y` in stored text is a transcription bug.

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

**Improvements** — one array, `isAdvanced` separates the two lists, and **each list gets its
own `sortOrder` sequence starting at 0**. Expect exactly 10 improvements; advanced is 7–8.
Use `-raw` order.

**Gear** — three shapes, all expressible without new fields:
- *Pick N of M*: `pickCount: N`.
- *Automatic grant* (Divine's divine armour): `pickCount: null`, meaning every listed option
  is granted. **Not `0`** — zero would read as "pick none of these".
- *Optional* (Chosen's "if you want" protective gear): `isOptional: true`, with `pickCount: 1`.

A build-your-own weapon (Chosen's Special Weapon) is just several categories, one per facet,
each with its own pick count. No new concept needed.

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

`scripts/verify.mjs` alongside this file is the Phase 4 verifier; adapt it. It re-reads each
playbook back **from the API** (not from your payload — that would only prove JSON parses)
and checks:

**The three known artifact classes**, each of which has actually occurred:
1. *Stat/move-pairing merge.* Every sheet prints the five rating labels beside the fixed
   list of eight basic moves, which `-layout` fuses into a convincing but false per-stat
   pairing. Assert none of the eight basic-move names appears anywhere in the playbook's
   stored data. They are universal, and live in `BasicMove`.
2. *Page-bleed.* An early read of Chosen pulled in trailing content from the previous
   playbook. Assert the six word-for-word shared advanced improvements are all present, and
   that the wording is `"Change this hunter to a new type"` — the contaminated read said
   `"new playbook"`.
3. *Mid-word column splits.* Assert no stored string matches `/[a-z]-\s+[a-z]/`.

**Content fidelity**: every stored option and improvement string must be findable in the raw
source text (compare on alphanumerics only — the source interleaves bullets and line breaks).

**Ratings**: rebuild each line as `charm±N,cool±N,…` and assert it appears in the source.
Digit-by-digit, not eyeballed.

**Cross-playbook uniformity**: Luck/Harm/Experience box counts should match every other
authored playbook. A mismatch is a finding to report, not to fix silently.

**Scope**: zero `moves` rows and `moveGrantCount === 0`.

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
than improvising. Nothing is currently outstanding.

## Report when done

State: the playbook authored and its id; per-section counts (ratings / gear categories /
look categories / improvements + advanced); verifier results; every deviation surfaced; and
anything you had to judge rather than read directly off the page.
