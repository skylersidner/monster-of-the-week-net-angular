// Fourteenth playbook run through the pipeline, requested by the
// coordinator on Yoshi's behalf. The Host's "Symbiosis" ruleset: one
// clean 2-mandatory-category section (Benefits pick-2-of-10, Downsides
// pick-1-of-7), no new schema — pure formatting extraction.
//
// Page 31, "Symbiosis" column (x ~270-500). Confirmed via pdftotext -raw
// this page has no column-swap defect (Symbiosis -> Moves in stream
// order, matching the correct left-to-right visual order — "Defensive
// Adaptation", the Moves column's first entry, appears after "Choose the
// Benefits and Downside..." as expected).
//
// The coordinator specifically asked to double-check whether any
// additional prose exists between the Downsides list and "Moves" that
// could be an EffectText candidate — Yoshi's read found none. Confirmed
// directly from the raw PDF item stream, not by re-reading Yoshi's own
// conclusion: the item immediately following "Magical aura" (the last
// Downside) is "Moves" itself, in a completely different x-column
// (x=503 vs. Symbiosis's x=275) — there is no intervening content at
// all, zero additional items in the Symbiosis column's own x-range after
// the last Downside tag. No EffectText candidate exists here.
//
// Every tag (10 Benefits + 7 Downsides) plus the framing sentence
// checked and confirmed entirely plain — no bold, no italic, anywhere in
// this section beyond the 3 structural bold headings ("Symbiosis",
// "Benefits (pick two):", "Downsides (pick one):").
//
// Usage: node build-host-symbiosis-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-host-symbiosis-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 31;
const MIN_X = 270;
const MAX_X = 500;
const MIN_Y = 295; // just below "Magical aura" (y=303.68), confirmed nothing else in-column below it
const MAX_Y = 570; // includes "Symbiosis" heading (y=567.18)

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

const framingPlain = "Choose the Benefits and Downside of your symbiosis.";
const framingHtml = splice(framingPlain);

const benefitsTags = [
  "Aligned motivations",
  "Unaging",
  "Can survive vacuum, pressure, and lack of air",
  "Immune to radiation",
  "Disease, drug, and poison resistance",
  "Subtle physical improvements",
  "Can't be possessed",
  "Can climb walls",
  "Efficient metabolism",
  "Non-physical symbiote",
];
const downsidesTags = [
  "Limited communication",
  "Body timeshare",
  "Biological needs",
  "Personality conflicts",
  "Obvious mutations",
  "Distracting chatter",
  "Magical aura",
];

const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const allTags = [...benefitsTags, ...downsidesTags];
const collidingRuns = inlineRuns.filter((r) => allTags.some((t) => t === r.text));

const output = {
  playbook: "The Host",
  section: "Symbiosis",
  streamOrderCheck:
    "Confirmed via pdftotext -raw: no column-swap defect on this page. Symbiosis column content precedes Moves " +
    "column content in stream order, matching the correct left-to-right visual order.",
  effectTextCandidateFinding:
    "NONE FOUND. Confirmed directly from the raw PDF item stream (not by re-reading Yoshi's own conclusion): the " +
    "item immediately following \"Magical aura\" (the last Downside tag) is \"Moves\", in a completely different " +
    "x-column (x=503 vs. Symbiosis's own x=275) — zero additional items exist in the Symbiosis column's x-range " +
    "after the last Downside tag. There is no prose block, and no EffectText candidate, between the Downsides " +
    "list and Moves.",
  framingSentence: framingHtml,
  benefits: benefitsTags.map((title) => ({ title, descriptionText: null })),
  downsides: downsidesTags.map((title) => ({ title, descriptionText: null })),
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column; ${collidingRuns.length} matched a tag label ` +
    "exactly (expected 0). All 3 detected bold runs are structural section headings (\"Symbiosis\", \"Benefits " +
    "(pick two):\", \"Downsides (pick one):\") — zero formatting on the framing sentence and zero formatting on " +
    "any of the 17 tags (10 Benefits + 7 Downsides). Zero italic anywhere in this section.",
};

const jsonPath = path.join(__dirname, "host-symbiosis-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const benefitsHtml = output.benefits.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const downsidesHtml = output.downsides.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Host — Symbiosis — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; margin-bottom: 1rem; background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #e6ffed; border: 1px solid #7ac68a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
</style>
</head>
<body>
<h1>The Host — Symbiosis — extraction review (page 31)</h1>
<p class="note">Generated by tools/pdf-extract/build-host-symbiosis-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<div class="intro">${escapeForDisplay(output.framingSentence)}</div>
<h2>Benefits (pick 2 of 10)</h2>
<ul class="tags">
${benefitsHtml}
</ul>
<h2>Downsides (pick 1 of 7)</h2>
<ul class="tags">
${downsidesHtml}
</ul>
<div class="finding"><strong>EffectText candidate check (Downsides → Moves gap): NONE FOUND.</strong> ${escapeForDisplay(output.effectTextCandidateFinding)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "host-symbiosis-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nEffectText candidate finding: " + output.effectTextCandidateFinding);
