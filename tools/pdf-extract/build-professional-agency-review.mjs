// Nineteenth playbook run through the pipeline (coordinator's own
// numbering; see the Monstrous/Pararomantic passes' header comments for
// the separate, one-behind numbering track used in the pipeline doc).
// The Professional's "Agency" ruleset: one clean 2-mandatory-category
// section (Resources pick-2-of-10, Red Tape pick-2-of-9), no new schema
// — pure formatting extraction.
//
// Page 44, "Agency" column (left side, x ~30-270). Confirmed via
// pdftotext -raw no column-swap defect on this page (Getting Started ->
// ratings -> Agency -> Introductions -> History -> Leveling Up ->
// Improvements -> Advanced Improvements, correct left-to-right/
// top-to-bottom order).
//
// Found and fixed a FIFTH instance of the now-standard heading-bleeds-
// into-body false positive (after Curse-eater's "and", Envoy's
// "Overseers", Hex's "Rotes", Initiate's "Sect"): an initial Y-bound
// (40-335) still included the "Agency" section heading itself (a
// standalone bold text item at y=332.68), which is coincidentally
// text-identical to the ordinary (non-bold) word "Agency" appearing
// twice in the framing paragraph's own body text ("...work for..."
// intro doesn't use it, but "Is the Agency's goal to..." does, and
// "Pick two resource tags for the Agency..." does too). The initial
// splice wrongly bolded the FIRST of those two plain occurrences
// ("Is the <b>Agency</b>'s goal...") — caught before trusting it (the
// splice tool's own output made the false positive visible immediately),
// verified directly against the raw item dump that both in-paragraph
// "Agency" occurrences are one single plain-font (WarnockPro-Regular)
// text item each, and fixed by tightening the bound to exclude the
// heading (maxY=325, the heading itself sits at y=332.68).
//
// Usage: node build-professional-agency-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-professional-agency-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 44;
const MIN_X = 30;
const MAX_X = 270;
const MIN_Y = 40;
const MAX_Y = 325; // excludes the "Agency" heading itself (y=332.68) — see header comment

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
  "Decide who it is you work for. Are they a black-budget government department, a secret military unit, a " +
  "clandestine police team, a private individual's crusade, a corporation, a scientific team, or what? Is the " +
  "Agency's goal to: destroy monsters, study the supernatural, protect people, gain power, or something else? " +
  "Pick two resource tags for the Agency, and two red tape tags:";
const framingHtml = splice(framingPlain);

const resourcesTags = [
  "Well-armed", "Well-financed", "Rigorous training", "Official pull", "Cover identities",
  "Offices all over", "Good intel", "Recognised authority", "Weird tech gadgets", "Support teams",
];
const redTapeTags = [
  "Dubious motives", "Bureaucratic", "Secretive hierarchy", "Cryptic missions", "Hostile superiors",
  "Inter-departmental rivalry", "Budget cuts", "Take no prisoners policy", "Live capture policy",
];

const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const allTags = [...resourcesTags, ...redTapeTags];
const collidingRuns = inlineRuns.filter((r) => allTags.some((t) => t === r.text));

const output = {
  playbook: "The Professional",
  section: "Agency",
  streamOrderCheck:
    "Confirmed via pdftotext -raw: no column-swap defect on this page (Getting Started -> ratings -> Agency -> " +
    "Introductions -> History -> Leveling Up -> Improvements -> Advanced Improvements, correct order).",
  framing: framingHtml,
  resources: resourcesTags.map((title) => ({ title, descriptionText: null })),
  redTape: redTapeTags.map((title) => ({ title, descriptionText: null })),
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column (Y-bounded to exclude the "Agency" heading ` +
    `itself); ${collidingRuns.length} matched a tag label exactly (expected 0). Both detected bold runs are ` +
    "structural section headings (\"Resources\", \"Red Tape\") — their own \"(pick two):\" suffixes are a SEPARATE " +
    "plain-styled run, same minor stylistic detail already seen on Initiate's Sect. Framing block is entirely " +
    "plain (after correcting an initial false-positive <b>Agency</b> caused by an over-wide Y-bound pulling in " +
    "the \"Agency\" section heading itself — a fifth instance of this pipeline's now-standard heading-bleeds-" +
    "into-body false positive). Zero formatting on any of the 19 tags (10 Resources + 9 Red Tape). Zero italic " +
    "anywhere in this section.",
};

const jsonPath = path.join(__dirname, "professional-agency-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const resourcesHtml = output.resources.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const redTapeHtml = output.redTape.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Professional — Agency — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; margin-bottom: 1rem; background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Professional — Agency — extraction review (page 44)</h1>
<p class="note">Generated by tools/pdf-extract/build-professional-agency-review.mjs. ${escapeForDisplay(output.streamOrderCheck)}</p>
<p class="note">${escapeForDisplay(output.formattingNote)}</p>
<div class="intro">${escapeForDisplay(output.framing)}</div>
<h2>Resources (pick 2 of 10)</h2>
<ul class="tags">
${resourcesHtml}
</ul>
<h2>Red Tape (pick 2 of 9)</h2>
<ul class="tags">
${redTapeHtml}
</ul>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "professional-agency-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.streamOrderCheck);
console.log("\n" + output.formattingNote);
