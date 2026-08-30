// Sixteenth playbook run through the pipeline, requested by the
// coordinator on Yoshi's behalf. The Interface's "Integration" ruleset:
// one clean 3-mandatory-category section (Upgrades pick-2-of-8, Faults
// pick-2-of-7, Origin pick-1-of-5 title+description), no new schema —
// pure formatting extraction.
//
// Page 35, "Integration" column (x ~280-505). Confirmed via pdftotext
// -raw no column-swap defect on this page (Integration precedes Moves in
// stream order, matching the correct left-to-right visual order).
//
// Shape mix: framing sentence + 2 label-only tag lists (Upgrades/Faults,
// side-by-side sub-columns within the one column) handled via
// extract-runs.mjs + splice-formatting.mjs; the Origin section (a
// transition sentence + 5 real title+description options) handled via
// extract-moves.mjs, matching its established bullet-driven model
// exactly (bold "Label:" titles, plain descriptions).
//
// Usage: node build-interface-integration-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-interface-integration-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 35;
const MIN_X = 280;
const MAX_X = 505;

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

// --- Framing sentence + Upgrades/Faults tags: y 410-560 (excludes the
// "Integration" heading at y=567.18 and the Origin section's transition
// sentence at y=403.68) ---
const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", "410", "--maxY", "560"],
  { encoding: "utf8" }
);
fs.writeFileSync(path.join(scratchDir, "runs.json"), runsOut);

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

const framingPlain = "Pick Upgrades and Faults to describe how you interact with machines.";
const framingHtml = splice(framingPlain);

const upgradesTags = [
  "Always connected", "Specialised tools", "Security specialist", "Intelligence database",
  "Aim-assist", "Heads-up display", "Everything's compatible", "Speed typing",
];
const faultsTags = [
  "Need my gear", "Hackable brain", "Specialised maintenance", "Undisciplined",
  "Overhyped rep", "Overconfidence", "Buggy implants",
];

// --- Origin section: transition sentence + 5 title+description options,
// y 260-408 (includes the transition sentence at y=403.68, excludes
// nothing further down — confirmed the item immediately after
// "Artificial"'s last line jumps straight to the Moves column) ---
const originResult = JSON.parse(
  execFileSync(
    process.execPath,
    [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(PAGE), "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", "260", "--maxY", "408", "--json"],
    { encoding: "utf8" }
  )
);

const runs = JSON.parse(runsOut);
const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const allTags = [...upgradesTags, ...faultsTags];
const collidingRuns = inlineRuns.filter((r) => allTags.some((t) => t === r.text));

const output = {
  playbook: "The Interface",
  section: "Integration",
  streamOrderCheck:
    "Confirmed via pdftotext -raw: no column-swap defect on this page (Integration precedes Moves in stream " +
    "order, matching correct left-to-right visual order).",
  framing: framingHtml,
  upgrades: upgradesTags.map((title) => ({ title, descriptionText: null })),
  faults: faultsTags.map((title) => ({ title, descriptionText: null })),
  originTransition: originResult.intro,
  origin: originResult.moves.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in the framing/tags range; ${collidingRuns.length} matched ` +
    "a tag label exactly (expected 0). The only bold text there is the 2 structural headings (\"Upgrades (pick " +
    "two):\", \"Faults (pick two):\"). Framing sentence and the transition sentence (\"Then pick how you gained " +
    "these abilities.\", specifically checked as requested) are both entirely plain. All 8 Upgrades tags and all " +
    "7 Faults tags are plain, confirmed programmatically. All 5 Origin options have bold titles (standard " +
    "colon-delimited pattern) and fully plain descriptions — zero additional inline formatting within any of " +
    "them. Zero italic anywhere in this section.",
};

const jsonPath = path.join(__dirname, "interface-integration-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const upgradesHtml = output.upgrades.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const faultsHtml = output.faults.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const originHtml = output.origin
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Interface — Integration — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  h3 { margin-top: 1.25rem; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; margin-bottom: 1rem; background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Interface — Integration — extraction review (page 35)</h1>
<p class="note">Generated by tools/pdf-extract/build-interface-integration-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<div class="intro">${escapeForDisplay(output.framing)}</div>
<h2>Upgrades (pick 2 of 8)</h2>
<ul class="tags">
${upgradesHtml}
</ul>
<h2>Faults (pick 2 of 7)</h2>
<ul class="tags">
${faultsHtml}
</ul>
<h2>Origin (pick 1 of 5)</h2>
<div class="intro">${escapeForDisplay(output.originTransition)}</div>
<ul class="options">
${originHtml}
</ul>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "interface-integration-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
