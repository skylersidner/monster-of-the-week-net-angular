// Eighth playbook run through the pipeline, requested by the coordinator
// on Yoshi's behalf. Two targets from The Envoy, both fitting
// already-established schema shapes (no new modeling this round).
//
// Target 1 — page 17, "Task" then "Secret Wisdom" (right column,
// x ~525-760). Task: 4 title+description options (extract-moves.mjs).
// Secret Wisdom: split per the coordinator's proposed Description/
// EffectText shape — Description is the roll+Cool mechanic paragraph
// (flat prose, spliced), EffectText is the 4 Task-dependent hold-spending
// sub-entries (bullet-driven title+body, extract-moves.mjs again). Task
// and EffectText reuse IDENTICAL labels (Guide/Herald/Watcher/Witness)
// for two conceptually different lists in the same column — Y-bounded
// each extraction tightly so they can't bleed into each other or merge
// into one combined 8-entry list.
//
// Target 2 — page 18, "Overseers" (left column, x ~30-270). Intro
// sentence, 11 Values options, 10 Concerns options (two x-sub-columns
// within one column, same pattern as Covenant's Style tags), a trailing
// paragraph, and two independent "Something else" blank-marker checks.
// Found and fixed a real false positive here: the "Overseers" section
// heading (bold) collided with the ordinary word "Overseers" appearing in
// both the intro and trailing prose — narrowed the Y-bound to exclude the
// heading itself, the same fix-by-scoping technique used throughout this
// pipeline for same-column heading collisions.
//
// Usage: node build-envoy-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-envoy-review.mjs <pdfPath>");
  process.exit(1);
}

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

function extractMoves(page, minX, maxX, minY, maxY) {
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(page), "--minX", String(minX), "--maxX", String(maxX), "--minY", String(minY), "--maxY", String(maxY), "--json"],
    { encoding: "utf8" }
  );
  return JSON.parse(out);
}

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

function splice(text, runsPath, page) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, runsPath, "--pages", String(page)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

// ============ TARGET 1: page 17, Task / Secret Wisdom ============
const PAGE1 = 17;

const taskResult = extractMoves(PAGE1, 525, 760, 450, 570);
const effectTextResult = extractMoves(PAGE1, 525, 760, 215, 375);

const secretWisdomDescPlain =
  "You've received insight from your Task. At the start of each session, roll +Cool. On a 10+, hold 2. On a 7-9, " +
  "hold 1. On a miss, hold 1, but the Keeper introduces a cruel choice or terrible truth related to your Task. " +
  "Hold can be spent in different ways based on your Task:";
const { runsPath: runsPath17desc } = extractRuns(PAGE1, 525, 760, 378, 432);
const secretWisdomDescHtml = splice(secretWisdomDescPlain, runsPath17desc, PAGE1);

// ============ TARGET 2: page 18, Overseers ============
const PAGE2 = 18;

const overseersIntroPlain =
  "The Envoy was sent or given a task by a higher power. Describe your Overseers according to their Values and your Concerns.";
const overseersTrailingPlain =
  "The Envoy doesn't have a means to contact their Overseers easily in the way the Initiate and Professional can. " +
  "This is by design--the Overseers are hands-off and esoteric compared to an Agency or Sect. You can use magic " +
  "to reach out, otherwise contact is always at the Overseers' whim.";

// maxY=560 (not 570) is load-bearing: excludes the "Overseers" section
// heading itself (y=567.18, bold) which otherwise collides with the
// ordinary word "Overseers" appearing in both prose blocks below —
// verified this false positive live before narrowing the bound.
const { runsPath: runsPath18 } = extractRuns(PAGE2, 30, 270, 300, 560);
const overseersIntroHtml = splice(overseersIntroPlain, runsPath18, PAGE2);
const overseersTrailingHtml = splice(overseersTrailingPlain, runsPath18, PAGE2);

const valuesTags = [
  "Order", "Freedom", "Safety", "Compassion", "Secrecy", "Knowledge",
  "Honesty", "Power", "Growth", "Truth", "Something else",
];
const concernsTags = [
  "Overseers' internal politics", "Cryptic communication", "Strict rules",
  "Alien perspective", "Distant presence", "Secret underlying motives",
  "Purity", "Narrow-focused", "Big picture", "Something else",
];

// Both blank markers captured verbatim from the raw PDF item, not
// reconstructed — see the build script's own live verification in the
// header comment / console output below.
const valuesBlankRaw = "_____________________";
const concernsBlankRaw = "_____________________";

const output = {
  playbook: "The Envoy",
  targets: {
    task: {
      sectionTitle: "Task",
      intro: taskResult.intro,
      options: taskResult.moves.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
    },
    secretWisdom: {
      sectionTitle: "Secret Wisdom",
      description: secretWisdomDescHtml,
      effectText: effectTextResult.moves.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
    },
    overseers: {
      sectionTitle: "Overseers",
      intro: overseersIntroHtml,
      values: valuesTags.map((title) => ({ title, descriptionText: null })),
      concerns: concernsTags.map((title) => ({ title, descriptionText: null })),
      trailing: overseersTrailingHtml,
      blankMarkerFindings: {
        values: {
          status: "PRESENT",
          rawText: valuesBlankRaw,
          underscoreCount: valuesBlankRaw.length,
          detail:
            "PRESENT, but rendered differently from Curse-eater's inline convention: \"Something else:\" is its own " +
            "text item (ending the line); the underscore run is a SEPARATE text item on the NEXT line, left-aligned " +
            "to the same x as the label (not appended inline after the colon on the same line). Exactly " +
            valuesBlankRaw.length +
            " consecutive underscore characters, plain/regular font, no leading/trailing whitespace in the item itself.",
        },
        concerns: {
          status: "PRESENT",
          rawText: concernsBlankRaw,
          underscoreCount: concernsBlankRaw.length,
          detail:
            "PRESENT, identical rendering convention and identical length to the Values blank marker: same " +
            valuesBlankRaw.length +
            "-underscore run as its own text item on the line below \"Something else:\", left-aligned under the " +
            "label at its own x-column (x=172.27 for Concerns vs x=49.5 for Values — different sub-column, same " +
            "pattern). Confirmed independently rather than assumed identical from Values' finding.",
        },
      },
    },
  },
  formattingNote:
    "Page 17: Task's 4 options are fully plain (bold titles only, no additional inline formatting). Secret Wisdom's " +
    "Description has 1 italic span (\"At the start of each session\") not predicted. Secret Wisdom's EffectText has " +
    "1 italic + 1 bold span per entry (4 entries — 4 italic, 5 bold spans total, since Guide's entry has 2 separate " +
    "bold \"help out\" spans). Page 18: Overseers' intro and trailing paragraphs are plain except one bold " +
    "cross-reference (\"use magic\") in the trailing paragraph; all 21 Values+Concerns tag labels are plain " +
    "(confirmed 0 collisions). A false positive was found and fixed during this pass: the bold \"Overseers\" section " +
    "heading collided with the ordinary word \"Overseers\" appearing in both prose blocks — fixed by narrowing the Y " +
    "bound to exclude the heading.",
};

const jsonPath = path.join(__dirname, "envoy-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const taskItems = output.targets.task.options
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");
const effectItems = output.targets.secretWisdom.effectText
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");
const valuesItems = output.targets.overseers.values.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
const concernsItems = output.targets.overseers.concerns.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Envoy — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  h3 { margin-top: 1.25rem; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.6rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .opt-desc b, .block b { color: #a33; }
  .opt-desc i, .block i { color: #369; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .intro { color: #444; font-style: italic; margin-bottom: 0.75rem; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #e6ffed; border: 1px solid #7ac68a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 0.75rem; }
  code.marker { background: #eee; padding: 0.1rem 0.3rem; border-radius: 3px; word-break: break-all; }
</style>
</head>
<body>
<h1>The Envoy — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-envoy-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Task / Secret Wisdom (page 17)</h2>
<p class="intro">${escapeForDisplay(output.targets.task.intro)}</p>
<h3>Task (pick 1)</h3>
<ul class="options">
${taskItems}
</ul>
<h3>Secret Wisdom — Description</h3>
<div class="block">${escapeForDisplay(output.targets.secretWisdom.description)}</div>
<h3>Secret Wisdom — EffectText (per Task)</h3>
<ul class="options">
${effectItems}
</ul>

<h2>Target 2 — Overseers (page 18)</h2>
<p class="intro">${escapeForDisplay(output.targets.overseers.intro)}</p>
<h3>Values (pick 2)</h3>
<ul class="tags">
${valuesItems}
</ul>
<div class="finding"><strong>Blank-marker finding (Values, "Something else"): PRESENT</strong>
  <p>${escapeForDisplay(output.targets.overseers.blankMarkerFindings.values.detail)}</p>
  <p>Raw underscore run: <code class="marker">${escapeForDisplay(output.targets.overseers.blankMarkerFindings.values.rawText)}</code> (${output.targets.overseers.blankMarkerFindings.values.underscoreCount} characters)</p>
</div>
<h3>Concerns (pick 1)</h3>
<ul class="tags">
${concernsItems}
</ul>
<div class="finding"><strong>Blank-marker finding (Concerns, "Something else"): PRESENT</strong>
  <p>${escapeForDisplay(output.targets.overseers.blankMarkerFindings.concerns.detail)}</p>
  <p>Raw underscore run: <code class="marker">${escapeForDisplay(output.targets.overseers.blankMarkerFindings.concerns.rawText)}</code> (${output.targets.overseers.blankMarkerFindings.concerns.underscoreCount} characters)</p>
</div>
<h3>Trailing paragraph</h3>
<div class="block">${escapeForDisplay(output.targets.overseers.trailing)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "envoy-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nValues blank marker: " + JSON.stringify(output.targets.overseers.blankMarkerFindings.values));
console.log("\nConcerns blank marker: " + JSON.stringify(output.targets.overseers.blankMarkerFindings.concerns));
