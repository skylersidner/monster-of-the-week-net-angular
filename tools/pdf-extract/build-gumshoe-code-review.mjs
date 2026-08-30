// Twelfth playbook run through the pipeline, requested by the coordinator
// on Yoshi's behalf. The Gumshoe's "Gumshoe Code" ruleset: a new shape —
// the player writes one freeform sentence at creation, guided by 6
// illustrative examples — schema call still pending, but raw text
// extraction doesn't depend on that decision.
//
// Page 25, "Gumshoe Code" column (x ~280-520). Shares its column's
// x-range with Moves-intro/Occult Confidential/Naked City content
// directly below it in the page's default reading order — Y-bounded
// (minY=315, maxY=570) to isolate just Gumshoe Code, same technique as
// Curse-eater's Corruption/Consumed Magic split and Forged's
// Partner-text exclusion. Verified the bound doesn't clip anything: the
// "Moves" heading sits at y=310.18, just below minY=315.
//
// Real findings, none predicted going in:
//   - The 6 example codes are rendered as ONE continuous ITALIC run (not
//     individually bulleted/listed in the source) — a first for this
//     pipeline: prior "check a block of options" passes were always
//     either bulleted lists or plain prose, never an italicized run of
//     otherwise-undelimited example sentences.
//   - The consequence paragraph's "manipulate someone" IS bolded,
//     confirmed exactly as the coordinator specifically asked to check —
//     consistent with the established base-move cross-reference pattern.
//   - "The Postman Always Rings Twice" and "The Long Goodbye" — both
//     THIS PLAYBOOK's own bespoke move names, not base moves — ALSO
//     carry bold styling, extending the cross-reference-bolding pattern
//     (previously only seen applied to base moves) to a playbook's own
//     moves referencing each other.
//
// Usage: node build-gumshoe-code-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-gumshoe-code-review.mjs <pdfPath>");
  process.exit(1);
}

const PAGE = 25;
const MIN_X = 280;
const MAX_X = 520;
const MIN_Y = 315; // excludes "Moves" heading (y=310.18) and everything below
const MAX_Y = 570; // includes "Gumshoe Code" heading (y=567.18)

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

const runsOut = execFileSync(
  process.execPath,
  [path.join(__dirname, "extract-runs.mjs"), pdfPath, String(PAGE), String(PAGE), "--json", "--minX", String(MIN_X), "--maxX", String(MAX_X), "--minY", String(MIN_Y), "--maxY", String(MAX_Y)],
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

const framingPlain = "With the agreement of the Keeper, pick a one-sentence Code that your Gumshoe adheres to.";
const examplesPlain =
  "Murders must be punished. Monsters must be destroyed. Innocents must be saved. Laws must be enforced. " +
  "Evil must be exposed. The weak must be protected from the powerful.";
const consequencePlain =
  "This Code defines your Gumshoe. Any time you violate your code you forfeit all Code related moves " +
  "(The Postman Always Rings Twice, The Long Goodbye) and the ability to spend Luck points. These forfeits " +
  "last either until the next mystery or you make amends. As long as you follow the Code people will sense " +
  "your sincerity: you receive +1 ongoing for manipulate someone and you may not be possessed or charmed by " +
  "any sort of supernatural, alien, or demonic entity or item.";

const framingHtml = splice(framingPlain);
const examplesHtml = splice(examplesPlain);
const consequenceHtml = splice(consequencePlain);

// The 6 individual example sentences, split out for convenience — the
// PDF itself renders them as one continuous italic run with no bullets
// or other per-example delimiter, so this split is this script's own
// sentence-boundary parsing (a period followed by a space/end), not a
// structural signal from the PDF. Included alongside the raw block so
// Yoshi can use whichever shape the eventual schema needs.
const exampleSentences = [
  "Murders must be punished.",
  "Monsters must be destroyed.",
  "Innocents must be saved.",
  "Laws must be enforced.",
  "Evil must be exposed.",
  "The weak must be protected from the powerful.",
];

const output = {
  playbook: "The Gumshoe",
  section: "Gumshoe Code",
  framingSentence: framingHtml,
  exampleCodes: {
    rawBlock: examplesHtml,
    note:
      "Rendered in the PDF as ONE continuous italic run, not a bulleted/individually-delimited list — confirmed " +
      "no list-marker glyph (no \"•\") anywhere in this block. The 6-sentence split below is this script's own " +
      "sentence-boundary parsing, not a PDF structural signal.",
    sentences: exampleSentences,
  },
  consequenceParagraph: consequenceHtml,
  formattingNote:
    "6 bold/italic run(s) detected in this column (Y-bounded to exclude Moves/Occult Confidential/Naked City " +
    "below): \"Gumshoe Code\" and \"Example Codes:\" are structural bold labels; the whole 6-sentence Example " +
    "Codes block is one continuous ITALIC run (a new shape for this pipeline — every prior \"check this block of " +
    "text\" pass was either bulleted or plain, never an undelimited italicized run); the consequence paragraph has " +
    "3 bold spans — \"manipulate someone\" (a base-move cross-reference, confirmed present exactly as specifically " +
    "asked), plus \"The Postman Always Rings Twice\" and \"The Long Goodbye\" (both THIS PLAYBOOK's own bespoke " +
    "move names, also bold — extends the base-move-cross-reference-bolding pattern seen throughout this project to " +
    "a playbook's own moves referencing each other, not previously observed). Framing sentence is entirely plain.",
};

const jsonPath = path.join(__dirname, "gumshoe-code-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Gumshoe — Gumshoe Code — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; margin-top: 0.5rem; }
  .block b { color: #a33; }
  .block i { color: #369; }
  .intro { color: #444; margin-bottom: 1rem; }
  .note { color: #666; font-size: 0.9rem; }
  .sentences { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
  .sentences li { background: #f0f4ff; border-radius: 999px; padding: 0.3rem 0.9rem; font-style: italic; }
</style>
</head>
<body>
<h1>The Gumshoe — Gumshoe Code — extraction review (page 25)</h1>
<p class="note">Generated by tools/pdf-extract/build-gumshoe-code-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>

<h2>Framing sentence</h2>
<div class="block">${escapeForDisplay(output.framingSentence)}</div>

<h2>Example Codes</h2>
<p class="note">${escapeForDisplay(output.exampleCodes.note)}</p>
<div class="block">${escapeForDisplay(output.exampleCodes.rawBlock)}</div>
<ul class="sentences">
${output.exampleCodes.sentences.map((s) => `<li>${escapeForDisplay(s)}</li>`).join("\n")}
</ul>

<h2>Consequence paragraph</h2>
<div class="block">${escapeForDisplay(output.consequenceParagraph)}</div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "gumshoe-code-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
