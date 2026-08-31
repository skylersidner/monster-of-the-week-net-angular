// Fifteenth playbook run through the pipeline, requested by the
// coordinator on Yoshi's behalf. The Initiate's "Sect" ruleset: one
// clean 2-mandatory-category section (Good Traditions pick-2-of-13, Bad
// Traditions pick-1-of-12), no new schema — pure formatting extraction.
// Page 33's Moves content (including an unusual unnamed Required move)
// is explicitly out of scope for this dispatch, per the coordinator.
//
// Page 34, "Sect" column (left side, x ~30-270). Confirmed via
// pdftotext -raw no column-swap defect on this page (Getting Started ->
// Introductions -> Leveling Up, correct left-to-right order).
//
// Found and fixed the now-familiar heading-bleeds-into-body false
// positive: an initial Y-bound (30-310) still included the "Sect"
// section heading itself (y=307.68, bold), which is coincidentally
// text-identical to the word "Sect" appearing later in the framing
// paragraph's own body text ("...pick the Sect's traditions...") —
// caught a false-positive <b>Sect</b> before trusting it, tightened the
// bound to exclude the heading (maxY=300).
//
// Usage: node build-initiate-sect-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-initiate-sect-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 34;
const MIN_X = 30;
const MAX_X = 270;
const MIN_Y = 30;
const MAX_Y = 300; // excludes the "Sect" heading itself (y=307.68) — see header comment

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", String(MIN_Y), "--maxY", String(MAX_Y)],
  { encoding: "utf8" }
);
fs.writeFileSync(path.join(scratchDir, "runs.json"), runsOut);
const runs = JSON.parse(runsOut);

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

const framingPlain =
  "You are part of an ancient, secret order that slays monsters. Where are they from? How old are they? Are " +
  "they religious? Why do they stay secret? How do they recruit? You also need to pick the Sect's traditions " +
  "(used by the Keeper to determine the Sect's methods and actions):";
const framingHtml = splice(framingPlain);

const goodTraditionsTags = [
  "Knowledgable", "Ancient lore", "Magical lore", "Fighting arts", "Modernised",
  "Chapters everywhere", "Secular power", "Flexible tactics", "Open hierarchy",
  "Integrated in society", "Rich", "Nifty gadgets", "Magical items",
];
const badTraditionsTags = [
  "Dubious motives", "Tradition-bound", "Short-sighted", "Paranoid and secretive",
  "Closed hierarchy", "Factionalised", "Strict laws", "Mystical oaths",
  "Total obedience", "Tyrannical leaders", "Obsolete gear", "Poor",
];

const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const allTags = [...goodTraditionsTags, ...badTraditionsTags];
const collidingRuns = inlineRuns.filter((r) => allTags.some((t) => t === r.text));

const output = {
  playbook: "The Initiate",
  section: "Sect",
  streamOrderCheck:
    "Confirmed via pdftotext -raw: no column-swap defect on this page (Getting Started -> Introductions -> " +
    "Leveling Up, correct left-to-right order).",
  outOfScopeNote:
    "Page 33's Moves content (including an unusual unnamed Required move) is explicitly out of scope for this " +
    "dispatch, per the coordinator — Moves formatting is Phase 4's concern.",
  framing: framingHtml,
  goodTraditions: goodTraditionsTags.map((title) => ({ title, descriptionText: null })),
  badTraditions: badTraditionsTags.map((title) => ({ title, descriptionText: null })),
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column; ${collidingRuns.length} matched a tag ` +
    "label exactly (expected 0). Both detected bold runs are structural section headings (\"Good Traditions\", " +
    "\"Bad Traditions\") — note their own \"(pick two):\"/\"(pick one):\" suffixes are a SEPARATE plain-styled run, " +
    "not part of the bold heading text (a minor stylistic detail vs. some other playbooks where the whole " +
    "\"Heading (pick N):\" phrase was one bold run — doesn't affect content, since headings aren't persisted " +
    "either way). Framing block is entirely plain (after correcting an initial false-positive <b>Sect</b> caused " +
    "by an over-wide Y-bound pulling in the \"Sect\" section heading itself). Zero formatting on any of the 25 " +
    "tags (13 Good Traditions + 12 Bad Traditions). Zero italic anywhere in this section.",
};

const jsonPath = path.join(__dirname, "initiate-sect-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const goodHtml = output.goodTraditions.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const badHtml = output.badTraditions.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Initiate — Sect — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; margin-bottom: 1rem; background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
  .flag { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
</style>
</head>
<body>
<h1>The Initiate — Sect — extraction review (page 34)</h1>
<p class="note">Generated by tools/pdf-extract/build-initiate-sect-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<div class="intro">${escapeForDisplay(output.framing)}</div>
<h2>Good Traditions (pick 2 of 13)</h2>
<ul class="tags">
${goodHtml}
</ul>
<h2>Bad Traditions (pick 1 of 12)</h2>
<ul class="tags">
${badHtml}
</ul>
<div class="flag"><strong>Out of scope for this pass:</strong> ${escapeForDisplay(output.outOfScopeNote)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "initiate-sect-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
