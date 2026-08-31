// Sixth playbook run through the pipeline, requested by the coordinator on
// Yoshi's behalf, to finalize Yoshi's already-modeled "Covenant"/
// "Friendship" ally-selection structure.
//
// Page 9, the RIGHT column headed "Covenant" then "Friendship" — a
// DIFFERENT column from the "Moves" column already extracted from this
// same page earlier (build-covenant-moves-review.mjs, x ~283-520). This
// column is x ~525-760.
//
// Shape is a mix, same lesson as Changeling's Unknown Heritage: two flat
// prose blocks (the "Covenant" special-ability paragraph, the
// "Friendship" intro sentence) each spliced with splice-formatting.mjs;
// 3 "Type" options with real title+description each (Watson/Rolodex/
// Unit), extracted with extract-moves.mjs; and 8 "Style" tags, label-only,
// split visually across two x-sub-columns within this one column but
// confirmed plain and listed directly (no splice needed).
//
// New wrinkle this pass found and fixed generically (not a one-off
// workaround): the "Type" options are immediately followed, before the
// "Style" tags, by a plain (non-bulleted) lead-in line, "Describe the
// ally:" — extract-moves.mjs's segment-splitting only keys off bullet
// markers, so without a Y-bound that line would get silently absorbed as
// trailing body text of "Unit". Added --minY/--maxY to extract-moves.mjs
// (mirroring the existing --minX/--maxX) to scope precisely to the Type
// options' own item range.
//
// Usage: node build-covenant-friendship-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-covenant-friendship-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 9;
const MIN_X = 525;
const MAX_X = 760;

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

// --- Flat prose blocks: Covenant ability + Friendship intro ---
const covenantAbilityPlain =
  "You have a knack for keeping allies safe. Once per session, if an ally would be killed, describe how you help " +
  "them survive and escape. They return, fully or mostly recovered, at the start of the next mystery.";
const friendshipIntroPlain =
  "You start with an ally. Pick a type (Monster of the Week hardcover, page 131) and a style:";

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X)],
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

const covenantAbilityHtml = splice(covenantAbilityPlain);
const friendshipIntroHtml = splice(friendshipIntroPlain);

// --- Type options: Watson / Rolodex / Unit — title+description each ---
// Y-bounded to just this range (see header comment) so the "Describe the
// ally:" lead-in immediately below them doesn't get absorbed into Unit.
const typesOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(PAGE), "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", "415", "--maxY", "465", "--json"],
  { encoding: "utf8" }
);
const types = JSON.parse(typesOut).moves; // [{title, descriptionHtml}]

// --- Style tags: label-only, confirmed plain directly from the runs list ---
// (no splice needed — verified 0 of the 9 detected bold/italic runs on
// this page/column match any style tag; the only runs are structural
// headings + the Type titles + the one italic book-title span, all
// already accounted for above.)
const styleTags = [
  "Loyal retainer",
  "Long-time coworker",
  "Good buddy",
  "Supernatural creature",
  "Romantic interest",
  "Friendly employer",
  "Mutually cursed",
  "Something else",
];
const inlineRuns = runs.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");
const collidingWithTag = inlineRuns.filter((r) => styleTags.some((t) => t === r.text || `${t}:` === r.text));

const output = {
  playbook: "The Covenant",
  section: "Covenant / Friendship",
  covenantAbility: covenantAbilityHtml,
  friendshipIntro: friendshipIntroHtml,
  types: types.map((t) => ({ title: t.title, descriptionText: t.descriptionHtml })),
  styleTags: styleTags.map((title) => ({ title, descriptionText: null })),
  blankMarkerFinding:
    "ABSENT. Checked directly against the raw PDF item stream (not just plain-text extraction): \"Something else:\" " +
    "is the very last item in this column before the page's NEXT unrelated section (\"Gear\") begins — no underscore " +
    "run, no blank-space glyph, no extra character of any kind follows it. Note the label itself DOES end with a " +
    "literal colon in the source text (\"Something else:\", unlike the other 7 style tags which have no trailing " +
    "punctuation) — that colon is the only visual cue a fill-in is expected; nothing is actually rendered after it. " +
    "Same absent-marker finding as Changeling's Unknown Heritage tags, and a different convention from Heat's inline " +
    "`________` blanks (which are embedded mid-sentence in the option's own text, not just implied by a trailing colon).",
  formattingNote:
    `${inlineRuns.length} bold/italic run(s) detected in this column; ${collidingWithTag.length} matched a style-tag label exactly (expected 0). ` +
    "One genuine italic span found: \"Monster of the Week\" (the game's own title, italicized as a cross-reference) inside the Friendship intro sentence — not previously predicted. " +
    "The Covenant ability paragraph is entirely plain (0 bold/italic). All 3 Type options have a bold title (already captured) and a plain description body, no additional inline formatting. All 8 Style tags are plain.",
};

const jsonPath = path.join(__dirname, "covenant-friendship-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const typeItems = output.types
  .map((t) => `<li><div class="opt-title">${escapeForDisplay(t.title)}</div><div class="opt-desc">${escapeForDisplay(t.descriptionText)}</div></li>`)
  .join("\n");
const styleItems = output.styleTags.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Covenant — Covenant/Friendship — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options, .tags { list-style: none; padding: 0; }
  .options > li { margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.25rem; }
  .opt-desc b, .ability b { color: #a33; }
  .opt-desc i, .ability i { color: #369; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .ability, .intro { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; }
</style>
</head>
<body>
<h1>The Covenant — Covenant/Friendship — extraction review (page 9, right column)</h1>
<p class="note">Generated by tools/pdf-extract/build-covenant-friendship-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>
<h2>Covenant (special ability)</h2>
<div class="ability">${escapeForDisplay(output.covenantAbility)}</div>
<h2>Friendship</h2>
<p class="intro">${escapeForDisplay(output.friendshipIntro)}</p>
<h3>Type (pick 1)</h3>
<ul class="options">
${typeItems}
</ul>
<h3>Style (pick 1)</h3>
<ul class="tags">
${styleItems}
</ul>
<div class="finding"><strong>Blank-marker finding (after "Something else"):</strong> ${escapeForDisplay(output.blankMarkerFinding)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "covenant-friendship-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nBlank-marker finding: " + output.blankMarkerFinding);
