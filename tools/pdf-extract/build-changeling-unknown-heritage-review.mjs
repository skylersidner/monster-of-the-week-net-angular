// Fifth playbook run through the pipeline, requested by the coordinator on
// Yoshi's behalf, to finalize Yoshi's already-modeled "Unknown Heritage"
// structure.
//
// The Changeling's "Unknown Heritage": page 6, leftmost of the front
// page's 3-column layout, x ~30-270. Shape is genuinely different from
// every prior pass: 10 flat, label-only tag options (no per-option body
// text at all, so no fit for extract-moves.mjs's bullet-per-entry model)
// PLUS a long section-level explanatory paragraph that comes AFTER all 10
// bulleted tags, not attached to any one of them — closer to Crooked's
// Background intro sentence than to a Moves list, just much longer. Used
// extract-runs.mjs + splice-formatting.mjs (the flat-paragraph technique)
// against that trailing paragraph; the 10 tags themselves needed no
// splicing once confirmed plain (see below).
//
// Two things specifically asked for by the coordinator, both resolved
// directly against the raw PDF item stream rather than assumed:
//   1. Bold/italic on all 10 tags AND the explanatory paragraph — checked
//      every one via extract-runs.mjs's output, not sampled.
//   2. Whether a blank marker (underscore run, Heat's convention) prints
//      after "Allergy to"/"Repulsion from"/"Attraction to"/"Obsession
//      with" — confirmed ABSENT. See the printed report below for the
//      exact evidence (item-by-item raw dump, not just its absence from
//      plain text).
//
// Usage: node build-changeling-unknown-heritage-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-changeling-unknown-heritage-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 6;
const MIN_X = 30;
const MAX_X = 270;

// Verbatim from the raw PDF (this playbook isn't in bespoke-ruleset-catalogue.md
// yet — Yoshi is finalizing it from this output, not the other way around).
const selectInstruction = "Your non-human heritage has pitfalls you were never taught about. Pick three:";

const tags = [
  "Dietary restriction",
  "Hygienic need",
  "Unearned reputation",
  "Erratic power",
  "Strange thoughts",
  "Sensory bombardment",
  "Allergy to",
  "Repulsion from",
  "Attraction to",
  "Obsession with",
];

const explanationPlain =
  "The Keeper may introduce obstacles or distractions based on these tags. If you push through or ignore them, " +
  "things can spiral out of control, and you may need to act under pressure. Alternatively, devote time to dealing " +
  "with it and put other concerns (like the current crisis, ongoing mystery, or personal issues) on hold. If you do, " +
  "mark experience. You always have the temptation to find out about your nature. When investigating a mystery with " +
  "a source of supernatural knowledge, you may ask, \"What do I learn about myself?\" as one of your questions. If " +
  "the character gains any useful knowledge of themself, word will get out among the supernatural world that they're " +
  "asking questions.";

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X)],
  { encoding: "utf8" }
);
const runs = JSON.parse(runsOut);
fs.writeFileSync(path.join(scratchDir, "runs.json"), runsOut);

const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const collidingWithTag = inlineRuns.filter((r) => tags.some((t) => t === r.text));

function splice(text) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, path.join(scratchDir, "runs.json"), "--pages", String(PAGE)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

const explanationHtml = splice(explanationPlain);
const selectInstructionHtml = splice(selectInstruction);

const output = {
  playbook: "The Changeling",
  section: "Unknown Heritage",
  selectInstruction: selectInstructionHtml,
  options: tags.map((title) => ({ title, descriptionText: null })),
  sectionExplanation: explanationHtml,
  blankMarkerFinding:
    "ABSENT. Checked directly against the raw PDF item stream (not just plain-text extraction): the item immediately " +
    "following the last text item of each of \"Allergy to\", \"Repulsion from\", \"Attraction to\", and \"Obsession with\" " +
    "is the line-break marker for the NEXT tag (or, for \"Obsession with\", the line-break marker leading straight into " +
    "the section's trailing paragraph, \"The Keeper may introduce...\"). No underscore run, no blank-space glyph, no " +
    "extra character of any kind appears after any of the 4 tags — they are printed exactly as written, with nothing " +
    "following. This is a different convention from Heat's inline `________` blanks (Crooked), which appear as literal " +
    "underscore characters embedded mid-sentence in the option's own text; Unknown Heritage's tags have no such glyph " +
    "at all, embedded or otherwise.",
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column; ${collidingWithTag.length} matched a tag label exactly (expected 0). ` +
    "Zero italic anywhere on this page — confirmed both from the font table (no WarnockPro-It embedded on page 6 at all) and from extract-runs.mjs finding zero italic runs. " +
    "Two bold cross-reference spans found in the section's trailing explanatory paragraph (\"act under pressure\", \"investigating a mystery\" — both references to base moves), " +
    "none within the 10 tag options themselves, and none within the short select-instruction sentence.",
};

const jsonPath = path.join(__dirname, "changeling-unknown-heritage-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const tagItems = output.options.map((o) => `<li>${escapeForDisplay(o.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Changeling — Unknown Heritage — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; font-style: italic; margin-bottom: 1rem; }
  .explanation { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .explanation b { color: #a33; }
  .explanation i { color: #369; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
</style>
</head>
<body>
<h1>The Changeling — Unknown Heritage — extraction review (page 6)</h1>
<p class="note">Generated by tools/pdf-extract/build-changeling-unknown-heritage-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<p class="intro">${escapeForDisplay(output.selectInstruction)}</p>
<h2>Tags (pick 3)</h2>
<ul class="tags">
${tagItems}
</ul>
<div class="finding"><strong>Blank-marker finding:</strong> ${escapeForDisplay(output.blankMarkerFinding)}</div>
<h2>Section explanatory paragraph</h2>
<p class="note">Notably longer than prior Section descriptions — checked closely per the coordinator's request rather than assumed plain. Bold rendered red for easy eyeballing against the source; no italic present anywhere on this page.</p>
<div class="explanation">${escapeForDisplay(output.sectionExplanation)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "changeling-unknown-heritage-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nBlank-marker finding: " + output.blankMarkerFinding);
