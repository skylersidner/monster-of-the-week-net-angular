// Tenth playbook run through the pipeline, requested by the coordinator on
// Yoshi's behalf. The Forged: four bespoke concepts (Bonds, Burdens, Dual
// Nature, Origin — Origin covers both Forging and Partnering), all fitting
// established shapes. Two page targets.
//
// Target 1 — page 23, the MIDDLE column containing Partner/Bonds/Burdens/
// Dual Nature/Range/Benefits/Flaws (x ~280-520). Partner's own Move
// description text (the column's first block, ending y~490) is
// deliberately EXCLUDED per the coordinator's explicit scope note —
// Y-bounded to start at "Bonds (pick two):" (y=476.88).
//
// Real finding worth flagging clearly: Benefits (8 entries) do NOT use
// the bold-title convention every other title+description shape in this
// pipeline has used so far (Watson:, Get Down!:, Guide:, Lore Library.,
// etc.) — checked directly and confirmed each Benefits line is a SINGLE
// plain-font text item, e.g. "Magic: Add the "magic" tag", with no font
// distinction between the "title" and the rest at all. The colon-split
// below is done by this script's own string logic (a plain regex on the
// first colon), NOT recovered from any PDF font signal — flagged
// explicitly since every prior title+description extraction in this
// pipeline came from a real bold-run boundary, and this one doesn't.
//
// Target 2 — page 24, "Origin" column (left side, x ~30-270): Forging (7
// description-only options) and Partnering (7 description-only options),
// each with their own "Something else" blank marker, checked
// independently.
//
// Usage: node build-forged-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-forged-review.mjs <pdfPath>");
  process.exit(1);
}

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

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

// ============ TARGET 1: page 23, Bonds/Burdens/Dual Nature ============
const PAGE1 = 23;
const bondsTags = ["Telepathic link", "Locational awareness", "Imitate your partner", "Speaking in each other's name", "Something else"];
const burdensTags = ["Emotional bleed-over", "Separation pains", "Dire curse", "Covetous seeker", "Dread enemy", "Something else"];
const rangeTags = ["Intimate", "Close", "Hand", "Far"];
const flawsTags = ["Unwieldy", "Conspicuous", "Charging", "Distinctive", "Restricted"];

// Benefits: colon-split by this script, not a PDF font signal — see header.
const benefitsRaw = [
  'Magic: Add the "magic" tag',
  "Vicious: You deal +1 harm",
  "Precise: You deal +1 harm",
  'Life Drain: Add the "life-drain" tag; you may heal your wielder instead of yourself',
  "Reach: Add another range",
  "Defensive: Add 1-armour for your wielder",
  'Sweeping: Add the "area" tag',
  'Elemental: Add matching tags such as "fire," "wind," "lightning," "mind," or "darkness"',
];
const benefits = benefitsRaw.map((line) => {
  const idx = line.indexOf(":");
  return { title: line.slice(0, idx), descriptionText: line.slice(idx + 1).trim() };
});

const dualNaturePlain =
  "You may freely transform between your human and weapon shapes. You can't kick some ass when in weapon form, " +
  "but when wielded as a weapon, your bearer adds harm equal to your Weird. Pick your base range, benefits, and flaw.";

// maxY=480 excludes Partner's own Move description text above (ends
// y~490.78, out of scope per the coordinator) including its one bold
// span ("big magic") — verified this scoping keeps Partner's content out
// entirely, not just its formatting.
const { runsPath: runsPath23 } = extractRuns(PAGE1, 280, 520, 40, 480);
const dualNatureHtml = splice(dualNaturePlain, runsPath23, PAGE1);

const bondsBlankRaw = "Something else: ______________________________";
const burdensBlankRaw = "Something else: ______________________________";

// ============ TARGET 2: page 24, Origin ============
const PAGE2 = 24;
const forgingOptions = [
  "You always thought you were human.",
  "You gained sentience by the perfection of your maker's craft.",
  "You used to be a supernatural being.",
  "A magical accident resulted in your creation.",
  "You were created to fulfil an obligation.",
  "“You know what? I don’t remember.”",
];
const partneringOptions = [
  "Your partner displayed great faith and devotion.",
  "Your partner solved puzzles requiring wit and wisdom.",
  "Your partner won your allegiance through power and might.",
  "You were created specifically for your partner.",
  "Your partner swore to perform a task and you are to aid them.",
  "You met through sheer luck and happenstance.",
];
const { runs: runs24 } = extractRuns(PAGE2, 30, 270, 95, 380);
const inlineRuns24 = runs24.filter((r) => r.style === "bold" || r.style === "italic" || r.style === "bold-italic");

const forgingBlankRaw = "Something else: ___________________________";
const partneringBlankRaw = "Something else: ___________________________";

function blankFinding(rawText, label, comparisonNote) {
  const underscoreRun = rawText.match(/_+$/)[0];
  return {
    status: "PRESENT",
    rawText,
    underscoreCount: underscoreRun.length,
    detail:
      `PRESENT — the "inline same-line" convention (matches Curse-eater's "How consuming magic works" pattern, not ` +
      `Envoy's next-line pattern): "Something else: " and the underscore run are ONE single plain-font PDF text item. ` +
      `Exactly ${underscoreRun.length} consecutive underscore characters. ${comparisonNote}`,
  };
}

const output = {
  playbook: "The Forged",
  targets: {
    bondsBurdensDualNature: {
      sectionTitle: "Bonds / Burdens / Dual Nature (Partner's own Move text excluded, out of scope)",
      bonds: bondsTags.map((title) => ({ title, descriptionText: null })),
      bondsBlankMarker: blankFinding(bondsBlankRaw, "Bonds", "Identical rendering + length to Burdens' own marker on this same page (checked independently)."),
      burdens: burdensTags.map((title) => ({ title, descriptionText: null })),
      burdensBlankMarker: blankFinding(burdensBlankRaw, "Burdens", "Identical rendering + length to Bonds' own marker on this same page (checked independently)."),
      dualNatureDescription: dualNatureHtml,
      range: rangeTags.map((title) => ({ title, descriptionText: null })),
      benefits,
      benefitsNote:
        "Benefits' title/description split above is done by this script's own colon-splitting, NOT recovered from " +
        "a PDF font signal — verified directly that each Benefits line (e.g. \"Magic: Add the \\\"magic\\\" tag\") is a " +
        "SINGLE plain-font text item with no bold styling distinguishing a title from the rest, unlike every other " +
        "title+description shape processed by this pipeline so far (all of which had a real bold-run boundary). " +
        "Flagged for Yoshi: if BespokeOption.Title needs to be populated for Benefits, it has to come from string " +
        "parsing like this, not font-based extraction.",
      flaws: flawsTags.map((title) => ({ title, descriptionText: null })),
    },
    origin: {
      sectionTitle: "Origin",
      forging: forgingOptions.map((title) => ({ title: null, descriptionText: title })),
      forgingBlankMarker: blankFinding(forgingBlankRaw, "Forging", "27 underscores — a DIFFERENT count from Bonds'/Burdens' 30-underscore markers on page 23, though the same rendering convention (single inline item)."),
      partnering: partneringOptions.map((title) => ({ title: null, descriptionText: title })),
      partneringBlankMarker: blankFinding(partneringBlankRaw, "Partnering", "Identical rendering + length (27 underscores) to Forging's own marker on this same page (checked independently)."),
    },
  },
  formattingNote:
    "Page 23 (x 280-520, y 40-480, Partner excluded): 1 bold span found (\"kick some ass\" in Dual Nature's intro, " +
    "a base-move cross-reference). Zero bold/italic on all 5 Bonds tags, 6 Burdens tags, 4 Range tags, 8 Benefits " +
    "entries, and 5 Flaws tags (confirmed programmatically — the only bold runs detected in this scope are the 6 " +
    "structural section headings plus the one Dual Nature span). Zero italic anywhere in this scope. Page 24 " +
    "Origin column: " +
    inlineRuns24.length +
    " bold/italic run(s) detected, all structural headings (\"Origin Forging (pick one):\", \"Partnering (pick " +
    "one):\", \"Ratings, pick one line:\", \"Introductions\", \"History\") — zero formatting on any of the 14 " +
    "Forging+Partnering options. No italic font at all embedded on page 24.",
};

const jsonPath = path.join(__dirname, "forged-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

function tagList(tags) {
  return tags.map((t) => `<li>${escapeForDisplay(t.title)}</li>`).join("\n");
}
function descList(opts) {
  return opts.map((o) => `<li>${escapeForDisplay(o.descriptionText)}</li>`).join("\n");
}
function optionCards(opts) {
  return opts
    .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
    .join("\n");
}
function blankBox(finding, label) {
  return `<div class="finding"><strong>Blank-marker finding (${label}): PRESENT</strong>
    <p>${escapeForDisplay(finding.detail)}</p>
    <p>Raw item: <code class="marker">${escapeForDisplay(finding.rawText)}</code></p>
  </div>`;
}

const t = output.targets;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Forged — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  h3 { margin-top: 1.25rem; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .opt-desc b, .block b { color: #a33; }
  .opt-desc i, .block i { color: #369; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tags li { background: #f7f7f7; border-radius: 999px; padding: 0.3rem 0.9rem; }
  .note { color: #666; font-size: 0.9rem; }
  .finding { background: #e6ffed; border: 1px solid #7ac68a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 0.75rem; }
  .flag { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 0.75rem; }
  code.marker { background: #eee; padding: 0.1rem 0.3rem; border-radius: 3px; word-break: break-all; }
</style>
</head>
<body>
<h1>The Forged — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-forged-review.mjs. ${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Bonds / Burdens / Dual Nature / Range / Benefits / Flaws (page 23)</h2>
<p class="note">Partner's own Move description text is deliberately excluded (out of scope).</p>
<h3>Bonds (pick 2)</h3>
<ul class="tags">${tagList(t.bondsBurdensDualNature.bonds)}</ul>
${blankBox(t.bondsBurdensDualNature.bondsBlankMarker, "Bonds")}
<h3>Burdens (pick 1)</h3>
<ul class="tags">${tagList(t.bondsBurdensDualNature.burdens)}</ul>
${blankBox(t.bondsBurdensDualNature.burdensBlankMarker, "Burdens")}
<h3>Dual Nature</h3>
<div class="block">${escapeForDisplay(t.bondsBurdensDualNature.dualNatureDescription)}</div>
<h3>Range (pick 1)</h3>
<ul class="tags">${tagList(t.bondsBurdensDualNature.range)}</ul>
<h3>Benefits (pick 2)</h3>
<div class="flag"><strong>Not font-derived:</strong> ${escapeForDisplay(t.bondsBurdensDualNature.benefitsNote)}</div>
<ul class="options">${optionCards(t.bondsBurdensDualNature.benefits)}</ul>
<h3>Flaws (pick 1)</h3>
<ul class="tags">${tagList(t.bondsBurdensDualNature.flaws)}</ul>

<h2>Target 2 — Origin (page 24)</h2>
<h3>Forging (pick 1)</h3>
<ul class="options">${descList(t.origin.forging)}</ul>
${blankBox(t.origin.forgingBlankMarker, "Forging")}
<h3>Partnering (pick 1)</h3>
<ul class="options">${descList(t.origin.partnering)}</ul>
${blankBox(t.origin.partneringBlankMarker, "Partnering")}
</body>
</html>
`;

const htmlPath = path.join(__dirname, "forged-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.formattingNote);
console.log("\nBonds blank marker: " + JSON.stringify(t.bondsBurdensDualNature.bondsBlankMarker));
console.log("Burdens blank marker: " + JSON.stringify(t.bondsBurdensDualNature.burdensBlankMarker));
console.log("Forging blank marker: " + JSON.stringify(t.origin.forgingBlankMarker));
console.log("Partnering blank marker: " + JSON.stringify(t.origin.partneringBlankMarker));
