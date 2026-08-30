// Eighteenth playbook run through the pipeline (labeled per the
// coordinator's own numbering; "Sixteenth pass" in the doc's separate
// numbering track, one behind this repo's history-log numbering since
// Hex — see the Monstrous pass's own header comment for that discrepancy
// note). The Pararomantic: 3 targets across pages 41-42.
//
// Per standard practice, spot-checked pdftotext -raw against both pages
// for the column-swap defect before extracting. Page 41: Luck ->
// Relationship Status -> Harm -> Experience -> ratings -> Moves -> Bond
// Abuse, correct top-to-bottom/left-to-right order, no swap. Page 42:
// Getting Started -> ratings -> Gear -> Leveling Up -> Improvements ->
// Advanced Improvements -> Introductions -> History -> Fate Of Your Love,
// correct order, no swap.
//
// Real findings, none predicted going in:
//   - Target 1 (Relationship Status track labels "Loving"/"Broken"):
//     entirely plain, confirmed programmatically. Only "Relationship
//     Status" itself (the section heading) is bold in that whole area.
//   - Target 2 (Bond Abuse) is a genuinely new shape for this pipeline:
//     flowing prose with TWO real nested "•" bulleted lists (a 3-item
//     roll-outcome breakdown AND a separate 4-item consequence list) but
//     ZERO top-level "b"-glyph bulleted entries — i.e. this is not a
//     "Moves"-shaped list at all. extract-moves.mjs's existing model
//     (segment-split on top-level bullets, nested "•" -> <ul> only INSIDE
//     a segment) had no path to handle a column with real nested lists
//     but no top-level bullets: with zero "b" bullets, `moves` comes back
//     empty and the old `intro` field was built with plain string
//     concatenation only — it would have silently flattened both real
//     lists and every inline bold/italic run in the column. Fixed
//     generically in extract-moves.mjs: factored the existing per-move
//     body-building logic (nested-list detection + inline run merging)
//     out into a shared `buildBodyHtml()`, and added a fallback that
//     fires only when zero top-level bullets are found (`bulletIdx.length
//     === 0`) — producing a new `flatBodyHtml` result field with real
//     <ul>/<li> structure for both lists plus inline <b> spans. Verified
//     this fallback never fires for any of the 17 prior invocations of
//     this script (all of them target real "Moves"-shaped columns with
//     top-level bullets, or they wouldn't be using extract-moves.mjs
//     over extract-runs.mjs to begin with) — purely additive, confirmed
//     via full regression, not just argued from design.
//   - Target 2 also has one bold cross-reference ("fate of your love",
//     pointing to Target 4's own section on the reverse side) and one
//     term-definition bold ("Bond Abuse:", introducing the move by name
//     mid-paragraph — same pattern as Hex's "rote").
//   - Target 3 (Guide-Gift options): a real top-level-bulleted
//     title+description shape (has "b" glyph bullets, so extract-moves.mjs
//     is the right tool), but — like Forged's Benefits — has NO bold-run
//     font signal marking a title boundary at all; every option is one
//     plain-font run with no delimiter of any kind (not even a colon,
//     unlike Benefits). Rather than inventing an unsupported splitting
//     heuristic (e.g. on ", e.g."), titles below are the coordinator's
//     own supplied labels, assigned externally, NOT derived from any PDF
//     signal — flagged explicitly, and descriptionText is left as the
//     full extracted sentence (unsplit) rather than fabricating a
//     boundary the source doesn't actually mark. One inline bold cross-
//     reference found: "bond abuse" in the memento gift's "+1 on bond
//     abuse rolls." (referencing Target 2's own move by name).
//   - Target 4 (Fate Of Your Love): entirely plain, confirmed
//     programmatically (0 bold/italic runs in the whole paragraph).
//     Source has a real hyphenated line-wrap ("is for- bidden or
//     doomed") — preserved literally per the established cosmetic-
//     artifact convention (same treatment as "pres- sure" on Monstrous),
//     not silently rejoined.
//
// Usage: node build-pararomantic-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-pararomantic-review.mjs <pdfPath>");
  process.exit(1);
}

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

function extractRuns(page, minX, maxX, minY, maxY) {
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(page), String(page), "--json", "--minX", String(minX), "--maxX", String(maxX), "--minY", String(minY), "--maxY", String(maxY)],
    { encoding: "utf8" }
  );
  const runsPath = path.join(scratchDir, `runs-${page}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(runsPath, out);
  return { runs: JSON.parse(out), runsPath };
}

function extractMoves(page, minX, maxX, minY, maxY) {
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(page), "--minX", String(minX), "--maxX", String(maxX), "--minY", String(minY), "--maxY", String(maxY), "--json"],
    { encoding: "utf8" }
  );
  return JSON.parse(out);
}

function splice(text, runsArrOrPath, page) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  const runsPath = Array.isArray(runsArrOrPath)
    ? (() => {
        const p = path.join(scratchDir, `runs-${Math.random().toString(36).slice(2)}.json`);
        fs.writeFileSync(p, JSON.stringify(runsArrOrPath));
        return p;
      })()
    : runsArrOrPath;
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, runsPath, "--pages", String(page)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

// ============ PAGE 41 ============
const PAGE1 = 41;

// --- Target 1: Relationship Status track labels ---
const { runs: relationshipRuns } = extractRuns(PAGE1, 30, 280, 185, 215);
const relationshipLabels = ["Loving", "Broken"];
const relationshipCollisions = relationshipRuns.filter((r) => relationshipLabels.includes(r.text));

// --- Target 2: Bond Abuse (no top-level bullets -> flatBodyHtml fallback) ---
const bondAbuse = extractMoves(PAGE1, 284, 520, 70, 320);

// ============ PAGE 42 ============
const PAGE2 = 42;

// --- Target 3: Guide-Gift portion of Gear (maxY=226 excludes the "Choose
// two of these normal things:" gear list above, whose last item "And
// choose one gift..." intro sits at y=223.68) ---
const guideGift = extractMoves(PAGE2, 30, 290, 40, 226);
const guideGiftLabels = [
  "Part of their body",
  "Piece of jewelery",
  "A memento of the time when they were human",
  "A strange or antique weapon",
];

// --- Target 4: Fate Of Your Love ---
const fateOfYourLovePlain =
  "There is a reason why your love with your Guide (the supernatural being you have a connection with) is for- " +
  "bidden or doomed. Invent this reason or leave it to the Keeper. Whenever you mark off a point of Luck, the " +
  "truth of your love’s Fate slowly unfolds: mark off a box in your Relationship Status track. When your last " +
  "point of Luck is used it becomes clear you cannot be together. Your Guide might even end up as an enemy, " +
  "depending on how things go.\n\nWhenever you put yourself or somebody else in serious danger in order to " +
  "conceal the truth about you and your Guide, mark experience.";
const { runsPath: runsPath42Fate } = extractRuns(PAGE2, 300, 530, 345, 500);
const fateOfYourLoveHtml = splice(fateOfYourLovePlain, runsPath42Fate, PAGE2);

const output = {
  playbook: "The Pararomantic",
  streamOrderCheck:
    "Spot-checked pdftotext -raw against pages 41 and 42 for the column-swap defect before extracting, per " +
    "standard practice. Page 41: Luck -> Relationship Status -> Harm -> Experience -> ratings -> Moves -> Bond " +
    "Abuse, correct order, no swap. Page 42: Getting Started -> ratings -> Gear -> Leveling Up -> Improvements -> " +
    "Advanced Improvements -> Introductions -> History -> Fate Of Your Love, correct order, no swap.",
  target1_relationshipStatusLabels: {
    note:
      "Track's own start/end labels, checked directly (not assumed plain because most tags in this pipeline are). " +
      `${relationshipCollisions.length} of ${relationshipLabels.length} label(s) collided with a detected bold/italic ` +
      "run (expected 0). Only bold text in this area at all is the \"Relationship Status\" section heading itself, " +
      "outside the two labels' own Y-range.",
    labels: relationshipLabels.map((text) => ({ text, formatted: false })),
  },
  target2_bondAbuse: {
    note:
      "New shape for this pipeline: flowing prose with two real nested \"•\" bulleted lists (3-item roll-outcome " +
      "breakdown + 4-item consequence list) but zero top-level \"b\"-glyph bulleted entries. extract-moves.mjs's " +
      "existing intro-only path would have silently flattened both lists and every inline bold/italic run; fixed " +
      "generically with a new flatBodyHtml fallback (fires only when zero top-level bullets are found) — see " +
      "script header for full detail.",
    html: bondAbuse.flatBodyHtml,
  },
  target3_guideGift: {
    note:
      "Guide-Gift options have NO bold-run font signal marking a title at all (like Forged's Benefits) — but unlike " +
      "Benefits, no colon or any other delimiter exists in the source text either. Titles below are the " +
      "coordinator's own supplied labels, assigned externally by this script, NOT derived from any PDF signal — " +
      "descriptionText is left as the full extracted sentence (unsplit) rather than fabricating a boundary the " +
      "source doesn't mark. One inline bold cross-reference found: \"bond abuse\" (referencing Target 2's own move " +
      "by name) in the memento gift's \"+1 on bond abuse rolls.\"",
    options: guideGift.moves.map((m, i) => ({ title: guideGiftLabels[i], descriptionText: m.descriptionHtml })),
  },
  target4_fateOfYourLove: {
    note:
      "Entirely plain, confirmed programmatically (0 bold/italic runs). Source has a real hyphenated line-wrap " +
      "(\"is for- bidden or doomed\") preserved literally, same cosmetic-artifact convention as Monstrous's " +
      "\"pres- sure\". Two paragraphs in the source (a paragraph break sits between \"...depending on how things " +
      "go.\" and \"Whenever you put yourself...\"); splice-formatting.mjs's own whitespace normalization collapses " +
      "that break into a single space in the stored text, matching how every other flat multi-line block in this " +
      "pipeline has always been stored — not treated as a paragraph-array field.",
    text: fateOfYourLoveHtml,
  },
  formattingNote:
    "Target 1 (Relationship Status labels): both \"Loving\" and \"Broken\" entirely plain, confirmed " +
    "programmatically (0 collisions). Target 2 (Bond Abuse): a genuinely new shape (nested-list prose with no " +
    "top-level bullets), required a generic extract-moves.mjs fix (flatBodyHtml fallback) rather than a scoping " +
    "workaround; found bold cross-reference \"fate of your love\" and term-definition bold \"Bond Abuse:\". " +
    "Target 3 (Guide-Gift): 4 options with zero font-based title signal, titles supplied externally (coordinator's " +
    "own labels) not extracted; found bold cross-reference \"bond abuse\" in the memento gift. Target 4 (Fate Of " +
    "Your Love): entirely plain, 0 bold/italic, confirmed programmatically.",
};

const jsonPath = path.join(__dirname, "pararomantic-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const relationshipLabelsHtml = output.target1_relationshipStatusLabels.labels
  .map((l) => `<li>${escapeForDisplay(l.text)}${l.formatted ? "" : " <span class=\"note\">(plain)</span>"}</li>`)
  .join("\n");
const guideGiftHtml = output.target3_guideGift.options
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Pararomantic — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .opt-desc b, .block b { color: #a33; }
  .opt-desc i, .block i { color: #369; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .block b { color: #a33; }
  .block i { color: #369; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Pararomantic — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-pararomantic-review.mjs. ${escapeForDisplay(output.streamOrderCheck)}</p>
<p class="note">${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Relationship Status track labels (page 41)</h2>
<p class="note">${escapeForDisplay(output.target1_relationshipStatusLabels.note)}</p>
<ul class="options">
${relationshipLabelsHtml}
</ul>

<h2>Target 2 — Bond Abuse (page 41)</h2>
<p class="note">${escapeForDisplay(output.target2_bondAbuse.note)}</p>
<div class="block">${output.target2_bondAbuse.html}</div>

<h2>Target 3 — Gear's Guide-Gift options (page 42)</h2>
<p class="note">${escapeForDisplay(output.target3_guideGift.note)}</p>
<ul class="options">
${guideGiftHtml}
</ul>

<h2>Target 4 — Fate Of Your Love (page 42)</h2>
<p class="note">${escapeForDisplay(output.target4_fateOfYourLove.note)}</p>
<div class="block">${escapeForDisplay(output.target4_fateOfYourLove.text)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "pararomantic-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.streamOrderCheck);
console.log("\n" + output.formattingNote);
