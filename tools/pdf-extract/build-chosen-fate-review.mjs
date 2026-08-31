// Fourth bespoke-ruleset extraction pass (see build-divine-mission-review.mjs
// for the same context/why).
//
// The Chosen's "Fate" ruleset: three mandatory pick-groups — How You Found
// Out (pick 1 of 7), Heroic tags (pick 2 of ~12), Doom tags (pick 2 of
// ~14) — all label-only, no description text (bespoke-ruleset-catalogue.md's
// "Tag Pick" shape). Page 8, left column, x ~30-270 (both the 12/14-item
// tag lists print in two sub-columns within that same overall column
// range, not a separate page column).
//
// Ran extract-runs.mjs first (see docs/hunter-playbooks/pdf-extraction-pipeline.md
// for the full trace) and confirmed directly from the raw PDF item dump:
// all 33 tag labels are plain WarnockPro-Regular text, zero bold/italic.
// The only bold text in this column is structural section headings ("Your
// Fate", "How You Found Out", "Heroic", "Doom") plus one aside sentence
// ("Whenever you mark off a point of Luck, [bold]the Keeper[not bold] will
// throw something from your fate at you.") that isn't part of the
// bespoke ruleset's own option data per bespoke-ruleset-catalogue.md's
// existing scope (it's a rules-explanation footnote, the same category as
// "Crooked special:"/"Divine special:" asides elsewhere, which aren't part
// of any BespokeSection either) — flagged in the report, not included here.
//
// So there's nothing to splice for this ruleset — this script's real job
// is producing the reviewable output that PROVES that (via extract-runs.mjs
// finding zero matches in the tag options), not guessing it, plus
// structuring the confirmed-plain text into the title/descriptionText-null
// "Tag Pick" shape for Skyler/authoring to consume.
//
// Usage: node build-chosen-fate-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-chosen-fate-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 8;
const MIN_X = 30;
const MAX_X = 270;

// Verbatim from bespoke-ruleset-catalogue.md's Chosen / Fate entries.
const howYouFoundOut = [
  "Nightmares and visions",
  "Some weirdo told you",
  "An ancient cult found you",
  "Sought out by your nemesis",
  "Attacked by monsters",
  "Trained from birth",
  "You found the prophecy",
];
const heroicTags = [
  "True love", "Sacrifice", "You are the Champion", "Visions", "Secret training",
  "Magical powers", "Mystical inheritance", "A normal life", "You can save the world",
  "Hidden allies", "The end of monsters", "Divine help",
];
const doomTags = [
  "Death", "You can't save everyone", "Impossible love", "Failure", "A nemesis",
  "No normal life", "Loss of loved ones", "Treachery", "Doubt",
  "Sympathy with the enemy", "Damnation", "Hosts of monsters", "The end of days",
  "The source of Evil",
];

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X)],
  { encoding: "utf8" }
);
const runs = JSON.parse(runsOut);
const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");

// Verify (programmatically, not just by manual read) that none of the
// detected bold/italic runs on this page/column match any tag label —
// i.e. confirm the "these are plain" finding rather than assume it.
const allTags = [...howYouFoundOut, ...heroicTags, ...doomTags];
const collidingRuns = inlineRuns.filter((r) => allTags.some((t) => t === r.text));

const toOption = (title) => ({ title, descriptionText: null });

const output = {
  playbook: "The Chosen",
  sections: [
    { title: "Fate — How You Found Out", options: howYouFoundOut.map(toOption) },
    { title: "Fate — Heroic tags", options: heroicTags.map(toOption) },
    { title: "Fate — Doom tags", options: doomTags.map(toOption) },
  ],
  extractionNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column; ${collidingRuns.length} matched a tag label exactly. ` +
    "All detected runs are section headings (\"Your Fate\", \"How You Found Out\", \"Heroic\", \"Doom\") or the \"Whenever you mark off a point of Luck,\" aside — not part of any tag option, so no <b>/<i> markup applies to Fate's options.",
};

const jsonPath = path.join(__dirname, "chosen-fate-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function renderGroup(title, options) {
  const items = options.map((o) => `<li>${o.title}</li>`).join("\n");
  return `<h2>${title}</h2>\n<ul class="tags">\n${items}\n</ul>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Chosen — Fate — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Chosen — Fate — extraction review (page 8)</h1>
<p class="note">Generated by tools/pdf-extract/build-chosen-fate-review.mjs. Three mandatory pick-groups, all label-only (no description text) per bespoke-ruleset-catalogue.md's "Tag Pick" shape. ${output.extractionNote}</p>
${renderGroup("How You Found Out (pick 1 of 7)", howYouFoundOut.map(toOption))}
${renderGroup("Heroic tags (pick 2 of 12)", heroicTags.map(toOption))}
${renderGroup("Doom tags (pick 2 of 14)", doomTags.map(toOption))}
</body>
</html>
`;

const htmlPath = path.join(__dirname, "chosen-fate-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log(`\nBold/italic runs detected in column: ${inlineRuns.length}`);
console.log(`Runs colliding with a tag label: ${collidingRuns.length} (expected: 0)`);
for (const r of inlineRuns) console.log(`  [${r.style}] ${r.text}`);
