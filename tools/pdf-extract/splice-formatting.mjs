// Takes a plain-text block (normally hand-copied by the authoring
// agent/human from this project's established `pdftotext -layout` output
// for one option/section) plus the JSON run list produced by
// extract-runs.mjs, and re-inserts the enumerated HTML subset
// (<b>/<i>) at the matched spans, producing the final DescriptionText
// value for that option.
//
// Deliberately dumb and literal: does forward-only sequential substring
// matching (after whitespace normalization) against the plain-text block,
// consuming runs in the order pdf.js emitted them (== the PDF's own
// reading order for that block). No fuzzy matching, no reordering. If a
// run can't be found it's skipped and reported on stderr — a human/agent
// reviews the output either way per this project's workflow, so a silent
// wrong guess would be worse than a visible gap.
//
// Usage:
//   node splice-formatting.mjs <plainTextFile> <runsJsonFile> [--pages 11,12]
//
// <plainTextFile>: plain text for ONE option/section (not a whole page —
//   scoping narrowly avoids accidentally matching a same-worded phrase
//   from an unrelated option elsewhere on the page).
// <runsJsonFile>: output of `extract-runs.mjs ... --json`.
// --pages: optional comma-separated page filter into the runs file.

import fs from "node:fs";

const args = process.argv.slice(2);
const pagesIdx = args.indexOf("--pages");
let pageFilter = null;
if (pagesIdx !== -1) {
  pageFilter = new Set(args[pagesIdx + 1].split(",").map(Number));
  args.splice(pagesIdx, 2);
}
const [textPath, runsPath] = args;
if (!textPath || !runsPath) {
  console.error(
    "Usage: node splice-formatting.mjs <plainTextFile> <runsJsonFile> [--pages 11,12]"
  );
  process.exit(1);
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

const rawText = fs.readFileSync(textPath, "utf8");
let block = normalize(rawText);

let runs = JSON.parse(fs.readFileSync(runsPath, "utf8"));
if (pageFilter) runs = runs.filter((r) => pageFilter.has(r.page));
runs = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");

const tagFor = { bold: ["<b>", "</b>"], italic: ["<i>", "</i>"], "bold-italic": ["<b><i>", "</i></b>"] };

let cursor = 0;
let result = "";
const unmatched = [];

for (const run of runs) {
  const needle = normalize(run.text);
  if (!needle) continue;
  const idx = block.indexOf(needle, cursor);
  if (idx === -1) {
    unmatched.push(run);
    continue;
  }
  const [open, close] = tagFor[run.style];
  result += block.slice(cursor, idx) + open + needle + close;
  cursor = idx + needle.length;
}
result += block.slice(cursor);

if (unmatched.length) {
  console.error(
    `Warning: ${unmatched.length} run(s) not found in the supplied text block (expected if the block is scoped to a different option — review output either way):`
  );
  for (const r of unmatched) console.error(`  [p${r.page} ${r.style}] ${r.text}`);
}

process.stdout.write(result + "\n");
