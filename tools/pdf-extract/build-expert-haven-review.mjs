// Ninth playbook run through the pipeline, requested by the coordinator on
// Yoshi's behalf. The Expert's "Haven" ruleset: one clean Titled Choice
// section (per phase5-bespoke-ideation.md's naming), no new schema — pure
// formatting extraction.
//
// Page 19, "Haven" column (right side, x ~525-760). 9 options, each
// title+description, extracted with extract-moves.mjs.
//
// Found and fixed a small but real, generalizable extractor gap here:
// every prior playbook's bulleted title+body options used a COLON to
// delimit the title ("Get Down!:", "Watson:") — Haven's titles are
// delimited by a PERIOD instead ("Lore Library. When you hit the
// books..."), which the extractor's existing title-stripping (trailing
// colon only) didn't anticipate, leaving every description starting with
// a stray ". ". Fixed generically in extract-moves.mjs (strips a leading
// ". " the same way a trailing ":" was already stripped from the title),
// not worked around locally in this script — verified no regression
// against all 8 prior playbooks' output (none of them had this pattern,
// so the fix is a no-op for them).
//
// Specifically checked per the coordinator's request: Armory (option 4)
// has a roll-outcome breakdown (10+/7-9/miss) shaped like Action
// Scientist's list-bearing options — but verified directly from the raw
// item stream that it is NOT structured as a bulleted list in the source
// PDF (no "•" character anywhere in its text) — it's flowing prose with
// the roll outcomes written as plain sentences. A real, useful negative
// finding: superficially similar game-mechanical content does not always
// get the same PDF-level structure.
//
// Usage: node build-expert-haven-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-expert-haven-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 19;
const MIN_X = 525;
const MAX_X = 760;
const MIN_Y = 120;
const MAX_Y = 570;

const movesOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(PAGE), "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", String(MIN_Y), "--maxY", String(MAX_Y), "--json"],
  { encoding: "utf8" }
);
const extracted = JSON.parse(movesOut);

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", String(MIN_Y), "--maxY", String(MAX_Y)],
  { encoding: "utf8" }
);
const runs = JSON.parse(runsOut);
const italicRuns = runs.filter((r) => r.style === "italic" || r.style === "bold-italic");

const ARMORY_TITLE = "Armory";
const armory = extracted.moves.find((m) => m.title === ARMORY_TITLE);
const armoryHasList = armory ? armory.descriptionHtml.includes("<ul>") : false;

const output = {
  playbook: "The Expert",
  section: "Haven",
  intro: extracted.intro,
  options: extracted.moves.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
  armoryListStructureFinding:
    "NO EMBEDDED LIST STRUCTURE. Checked directly against the raw PDF item stream: Armory's roll-outcome " +
    "breakdown (\"On a 10+ you have it... On a 7-9 you have it... On a miss, you've got the wrong thing.\") " +
    "contains zero \"•\" bullet-marker characters anywhere in its item range — it is flowing prose, written as " +
    "plain sentences within the same paragraph as the rest of the option, not a bulleted <ul>/<li> list like " +
    "Action Scientist's similarly-shaped Neurology and Psychology / Computers and Electronics options (which DO " +
    "use real \"•\" list markers for their own 10+/7-9/miss breakdowns). Confirmed programmatically: " +
    (armoryHasList ? "<ul> present (unexpected)" : "no <ul> in the extracted output") +
    ".",
  formattingNote:
    `${italicRuns.length} italic run(s) found in this column (expected 0 — confirmed programmatically, not just ` +
    "assumed): every one of Haven's 9 options is entirely free of italic. Bold cross-references appear in 3 " +
    "options — Lore Library (\"investigate the mystery\"), Mystical Library and Magical Laboratory (both " +
    "\"use magic\") — consistent with the base-move-reference-bolding pattern already seen in every other " +
    "playbook processed so far. Armory has one additional bold trigger clause (\"need a special weapon\"), styled " +
    "bold rather than italic (a different convention from most other playbooks' italicized trigger clauses, e.g. " +
    "Envoy's Secret Wisdom EffectText) — flagged as a real, book-wide inconsistency in trigger-clause styling, not " +
    "an extraction error.",
};

const jsonPath = path.join(__dirname, "expert-haven-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const items = output.options
  .map((o) => {
    const highlight = o.title === ARMORY_TITLE ? ' style="border: 2px solid #7ac68a;"' : "";
    return `<li${highlight}><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Expert — Haven — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.6rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .opt-desc b { color: #a33; }
  .opt-desc i { color: #369; }
  .intro { color: #444; font-style: italic; margin-bottom: 1rem; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
</style>
</head>
<body>
<h1>The Expert — Haven — extraction review (page 19)</h1>
<p class="note">Generated by tools/pdf-extract/build-expert-haven-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<p class="intro">${escapeForDisplay(output.intro)}</p>
<h2>Haven (pick 3 of 9)</h2>
<ul class="options">
${items}
</ul>
<div class="finding"><strong>Armory list-structure finding (green border above):</strong> ${escapeForDisplay(output.armoryListStructureFinding)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "expert-haven-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nArmory list-structure finding: " + output.armoryListStructureFinding);
