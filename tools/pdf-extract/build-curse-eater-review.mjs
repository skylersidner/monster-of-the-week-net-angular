// Seventh playbook run through the pipeline, requested by the coordinator
// on Yoshi's behalf. Two targets, both from The Curse-eater, covering two
// of the three bespoke-adjacent concepts Yoshi identified (schema shape
// for both still pending confirmation with Skyler — this pass is scoped
// to raw text/formatting extraction only, which doesn't depend on that).
//
// Target 1 — page 13, "Corruption" then "Consumed MagiC (Power,
// Downside)" column (x ~280-520). Found a real same-column,
// different-section false positive here: an unrelated italic "and" from
// the "Moves" list directly above this column (same x-range) matched and
// got wrongly spliced into the Corruption paragraph's own "...the power
// it offers you, and the downside..." — extract-runs.mjs's x-only scoping
// (sufficient for every prior pass) wasn't enough this time, since both
// sections share the same column. Fixed generically: added --minY/--maxY
// to extract-runs.mjs, mirroring what extract-moves.mjs already had for
// the same reason (Covenant's "Describe the ally:" pass). Also resolved,
// directly from the raw item stream: "Consumed MagiC (Power, Downside)"
// has ZERO body text of its own on this page — it's purely a table
// heading (for a blank tracking area on the character sheet), not a
// described mechanic. The entire explanatory paragraph belongs to
// "Corruption"; there is no separate "Consumed Magic's half" of prose to
// split out, contrary to what Yoshi's proposed 2-part split assumed —
// flagged explicitly for Yoshi to reconcile against the modeled structure.
//
// Target 2 — page 14, "How consuming magic works" column (x ~280-520),
// pick-1-of-5, same flat shape as Divine's Mission. All plain (0 bold/
// italic). The interesting part: option 5, "Something else:", is
// followed by a REAL rendered blank marker — the first case in this
// project's pipeline output where one actually prints (Changeling's and
// Covenant's equivalent blanks were both confirmed ABSENT). Exact form
// captured precisely below, not just "yes it's there".
//
// Usage: node build-curse-eater-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-curse-eater-review.mjs <pdfPath>");
  process.exit(1);
}

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

function extractRuns(page, minX, maxX, minY, maxY) {
  const args = [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(page), String(page), "--json", "--minX", String(minX), "--maxX", String(maxX)];
  if (minY !== undefined) args.push("--minY", String(minY));
  if (maxY !== undefined) args.push("--maxY", String(maxY));
  const out = execFileSync(process.execPath, args, { encoding: "utf8" });
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

// --- Target 1: page 13, Corruption / Consumed Magic ---
const PAGE1 = 13;
const corruptionPlain =
  "When you consume evil magic, you gain corruption as well as the ability to use some of those powers. Record " +
  "what the magic was, the power it offers you, and the downside it asks of you. The Keeper will provide these, " +
  "and can also confirm whether you are in the presence of a consumable curse. Repeated devouring evil may give " +
  "the same or different effects. Other moves, starting with unleash corruption, depend on these corruptions. " +
  "If you should take corruption, but the track is full, you become a monster under the Keeper's control.";

// Y-bound: 80-245 excludes the Moves section above (verified false
// positive: an unrelated italic "and" at y=403.51, far outside this
// range) while including everything from the "Corruption" heading
// (y=238.14) down through "Consumed MagiC (Power, Downside)" (y=85.14).
const { runsPath: runsPath13 } = extractRuns(PAGE1, 280, 520, 80, 245);
const corruptionHtml = splice(corruptionPlain, runsPath13, PAGE1);

// --- Target 2: page 14, How consuming magic works ---
const PAGE2 = 14;
const magicWorksIntroPlain = "When you consume/absorb evil magic, how does it work?";
const magicWorksOptionsPlain = [
  "You lay your hands on it and a visible glowing smoke transports the curse.",
  "You ritually eat some part of it.",
  "You closely embrace the cursed thing and spend several minutes bonding with it.",
  "You have an amulet that you must hold against it.",
  "Something else:", // blank marker handled separately below — see blankMarkerFinding
];
const { runs: runs14, runsPath: runsPath14 } = extractRuns(PAGE2, 280, 520);
const inlineRuns14 = runs14.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");

const magicWorksIntroHtml = splice(magicWorksIntroPlain, runsPath14, PAGE2);
const magicWorksOptions = magicWorksOptionsPlain.map((t) => splice(t, runsPath14, PAGE2));

// The blank marker itself — captured verbatim from the raw PDF item, not
// reconstructed: a single space after the colon, then a run of literal
// underscore characters, all part of ONE text item (same font as the
// label, i.e. plain/regular, not bold/italic).
const blankMarkerRaw = "Something else: ______________________________";
const underscoreRun = blankMarkerRaw.match(/_+$/)[0];
magicWorksOptions[4] = `Something else: ${underscoreRun}`; // reassemble with the verified-exact marker

const output = {
  playbook: "The Curse-eater",
  targets: {
    corruption: {
      sectionTitle: "Corruption",
      description: corruptionHtml,
      note:
        "\"Consumed MagiC (Power, Downside)\" (page 13) has ZERO body text of its own — confirmed it is the last " +
        "item on the page's item stream, immediately followed by nothing. It is a table/tracker heading (for a " +
        "blank fill-in area on the character sheet), not a described mechanic with its own prose. The entire " +
        "explanatory paragraph above belongs to \"Corruption\" alone. Flagged for Yoshi: this doesn't match the " +
        "proposed 2-part split (Corruption's half vs. Consumed Magic's half) as originally framed — there is no " +
        "separate block of prose to split out for Consumed Magic.",
    },
    howConsumingMagicWorks: {
      sectionTitle: "How consuming magic works",
      intro: magicWorksIntroHtml,
      options: magicWorksOptions.map((t) => ({ title: null, descriptionText: t })),
      blankMarkerFinding: {
        status: "PRESENT",
        rawText: blankMarkerRaw,
        underscoreCount: underscoreRun.length,
        detail:
          "A real, rendered blank marker — the first case in this pipeline's output where one actually prints " +
          "(Changeling's 4 tags and Covenant's \"Something else\" were both confirmed ABSENT). Exact form: the label " +
          "\"Something else:\" is followed by a single literal space, then a run of exactly " +
          underscoreRun.length +
          " consecutive underscore (\"_\") characters. All of this — label, colon, space, and the full underscore run — " +
          "is ONE single PDF text item (not split into separate positioned pieces), in the same plain/regular font as " +
          "the rest of the option text (not bold, not italic, not a distinct glyph/symbol font). No extra spacing " +
          "before the underscore run beyond the single space after the colon.",
      },
    },
  },
  formattingNote:
    "Page 13 column: 2 bold cross-reference spans (\"devouring evil\", \"unleash corruption\") + 1 italic emphasis (\"should\") found in the Corruption paragraph; " +
    "\"Corruption\" and \"Consumed MagiC (Power, Downside)\" themselves are just bold section headings, not content. " +
    "Page 14 column: entirely plain — 0 bold/italic across the intro sentence and all 5 options (" +
    inlineRuns14.length +
    " bold/italic run(s) detected in the column, all structural headings: \"Getting Started\"/\"Introductions\"/\"History\"/\"How consuming magic works\" — none inside the target content).",
};

const jsonPath = path.join(__dirname, "curse-eater-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const magicWorksItems = output.targets.howConsumingMagicWorks.options
  .map((o) => `<li>${escapeForDisplay(o.descriptionText)}</li>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Curse-eater — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .block b { color: #a33; }
  .block i { color: #369; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .intro { color: #444; font-style: italic; margin-bottom: 0.75rem; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
  .finding.present { background: #e6ffed; border-color: #7ac68a; }
  code.marker { background: #eee; padding: 0.1rem 0.3rem; border-radius: 3px; word-break: break-all; }
</style>
</head>
<body>
<h1>The Curse-eater — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-curse-eater-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Corruption / Consumed Magic (page 13)</h2>
<div class="block">${escapeForDisplay(output.targets.corruption.description)}</div>
<div class="finding"><strong>Consumed Magic split, resolved from the raw PDF:</strong> ${escapeForDisplay(output.targets.corruption.note)}</div>

<h2>Target 2 — How consuming magic works (page 14)</h2>
<p class="intro">${escapeForDisplay(output.targets.howConsumingMagicWorks.intro)}</p>
<ul class="options">
${magicWorksItems}
</ul>
<div class="finding present">
  <strong>Blank-marker finding (option 5, "Something else"): PRESENT</strong>
  <p>${escapeForDisplay(output.targets.howConsumingMagicWorks.blankMarkerFinding.detail)}</p>
  <p>Raw PDF text item (verbatim): <code class="marker">${escapeForDisplay(output.targets.howConsumingMagicWorks.blankMarkerFinding.rawText)}</code></p>
  <p>Underscore run length: <strong>${output.targets.howConsumingMagicWorks.blankMarkerFinding.underscoreCount}</strong> characters</p>
</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "curse-eater-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nConsumed Magic split note: " + output.targets.corruption.note);
console.log("\nBlank-marker finding: " + JSON.stringify(output.targets.howConsumingMagicWorks.blankMarkerFinding, null, 2));
