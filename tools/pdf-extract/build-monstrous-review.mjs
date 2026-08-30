// Seventeenth playbook run through the pipeline, requested by the
// coordinator on Yoshi's behalf. The Monstrous: three bespoke sections
// (Monster Breed, Curses, Natural Attacks) plus a suggestions appendix,
// spanning page 37 (3 targets) and page 38 (1 target). Page 37's "Moves"
// column is confirmed a standard Move-granting section, out of scope.
//
// Per standard practice, spot-checked pdftotext -raw against both pages
// for the column-swap defect before extracting. Page 37: Monster Breed
// -> Curses -> Natural Attacks -> Moves, correct left-to-right order, no
// swap. Page 38: Gear -> Getting Started -> Introductions (all column 1)
// -> History -> Monster Breed Suggestions (column 2) -> Leveling Up
// (column 3), correct order, no swap.
//
// Real findings, none predicted going in:
//   - Target 1's intro has a genuine typo in the source, "if you you
//     were originally" — preserved EXACTLY as printed per the
//     coordinator's explicit instruction; the correction is a separate
//     content-fidelity call already made on the catalogue side, not
//     something this extraction re-litigates.
//   - Target 1's intro has one italic span ("only" in "These are only
//     suggestions...").
//   - Target 2 (Curses) surfaced a NEW extract-moves.mjs bug, fixed
//     generically: 3 of its 4 options (Vulnerability/Pure Drive/Dark
//     Master) have a colon-free bold title followed by a regular-styled
//     run that itself starts with the colon (": Pick a substance...") —
//     the mirror image of Haven's leading-period bug, and inconsistent
//     even with this same Curses section's own "Feed:" sibling (whose
//     bold run bakes the colon in). Fixed by adding a leading-": " strip
//     alongside the existing leading-". " strip.
//   - Target 2 also needed a tightened Y-bound after an initial pass let
//     "Natural Attacks" (the next section's heading) bleed into Dark
//     Master's description as trailing bold text — the segment-splitting
//     in extract-moves.mjs has no way to know a heading, not a move
//     bullet, ends the range.
//   - Target 3's framing sentence ("Pick a Base and add an extra to it,
//     or two Bases.") is entirely italicized — the whole sentence, not a
//     partial emphasis.
//   - Target 4 (page 38) is a genuinely new shape: 7 archetype entries,
//     each with a bold name followed by 3 consistently-italicized field
//     sub-labels ("Curse", "Natural attacks", "Moves"). Hit the SAME
//     cross-call-run-leakage class of bug found on Hex, but manifesting
//     differently: sharing one unscoped runs list across all 7 splice()
//     calls let an EARLIER, textually-identical run ("Curse", present in
//     every entry) advance the cursor past a LATER entry's own name
//     before that name's run was ever reached, silently dropping 6 of 7
//     archetype names' bold. Fixed by partitioning the runs list into
//     one 4-run scoped set per entry, not sharing the whole column's
//     runs across all 7 calls.
//
// Usage: node build-monstrous-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-monstrous-review.mjs <pdfPath>");
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

function extractMoves(page, minX, maxX, minY, maxY) {
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, "extract-moves.mjs"), pdfPath, String(page), "--minX", String(minX), "--maxX", String(maxX), "--minY", String(minY), "--maxY", String(maxY), "--json"],
    { encoding: "utf8" }
  );
  return JSON.parse(out);
}

function splice(text, runsArrOrPath, page) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  const runsPath = Array.isArray(runsArrOrPath)
    ? (() => {
        const p = path.join(scratchDir, `runs-${Math.random().toString(36).slice(2)}.json`);
        fs.writeFileSync(p, JSON.stringify(runsArrOrPath));
        return p;
      })()
    : runsArrOrPath;
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, runsPath, "--pages", String(page)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

// ============ PAGE 37 ============
const PAGE1 = 37;
const { runsPath: runsPath37 } = extractRuns(PAGE1, 280, 520, 40, 560);

// --- Target 1: Monster Breed intro ---
const monsterBreedIntroPlain =
  "You're half-human, half-monster: decide if you were always this way or if you you were originally human and " +
  "transformed somehow. Now decide if you were always fighting to be good, or if you were evil and changed " +
  "sides. Define your monstrous breed by picking a curse, moves, and natural attacks. Create the monster you " +
  "want to be: whatever you choose defines your breed in the game. Some classic monsters with suggestions for " +
  "picks are listed on the back of this sheet. These are only suggestions: feel free to make a different version!";
const monsterBreedIntroHtml = splice(monsterBreedIntroPlain, runsPath37, PAGE1);

// --- Target 2: Curses (y-bounded to exclude "Natural Attacks" heading, y=168.68) ---
const curses = extractMoves(PAGE1, 280, 520, 180, 400).moves;

// --- Target 3: Natural Attacks ---
const naturalAttacksFramingPlain = "Pick a Base and add an extra to it, or two Bases.";
const naturalAttacksFramingHtml = splice(naturalAttacksFramingPlain, runsPath37, PAGE1);
const naturalAttacksBases = [
  "Base: teeth (3-harm intimate)",
  "Base: claws (2-harm hand)",
  "Base: magical force (1-harm magical close)",
  "Base: life-drain (1-harm intimate life-drain)",
];
const naturalAttacksExtras = [
  "Extra: Add +1 harm to a base",
  "Extra: Add ignore-armour to a base",
  "Extra: Add an extra range to a base (add intimate, hand, or close).",
];

// ============ PAGE 38 ============
const PAGE2 = 38;
const suggestionNames = ["Vampire", "Werewolf", "Ghost", "Faerie", "Demon", "Orc", "Zombie"];
const suggestionPlainText = [
  "Vampire: Curse: feed (blood or life-force). Natural attacks: Base: life-drain or Base: teeth; add +1 harm to base attack. Moves: immortal or unquenchable vitality; mental domination.",
  "Werewolf: Curse: vulnerability (silver). Natural attacks: Base: claws; Base: teeth. Moves: shapeshifter (wolf and/or wolfman); claws of the beast or unholy strength.",
  "Ghost: Curse: vulnerability (rock salt). Natural attacks: Base: magical force; add hand range to magical force. Moves: incorporeal; immortal.",
  "Faerie: Curse: pure drive (joy). Natural attacks: Base: magical force; add ignore-armour to magical force. Moves: flight; preternatural speed.",
  "Demon: Curse: pure drive (cruelty). Natural attacks: Base: claws; +1 harm to claws. Moves: dark negotiator; unquenchable vitality.",
  "Orc: Curse: dark master (the orc overlord). Natural attacks: Base: teeth; add ignore-armour to teeth. Moves: Unholy strength; dark negotiator.",
  "Zombie: Curse: pure drive (hunger), feed (flesh or brains). Natural attacks: Base: teeth; +1 harm to teeth. Moves: immortal; unquenchable vitality.",
];

// Each entry gets its OWN 4-run scoped set (name + Curse + Natural
// attacks + Moves) — see header comment for why sharing one unscoped
// runs list across all 7 calls silently drops 6 of 7 archetype names.
const suggestions = suggestionNames.map((name, i) => {
  const runs = [
    { page: PAGE2, style: "bold", text: name },
    { page: PAGE2, style: "italic", text: "Curse" },
    { page: PAGE2, style: "italic", text: "Natural attacks" },
    { page: PAGE2, style: "italic", text: "Moves" },
  ];
  return { name, html: splice(suggestionPlainText[i], runs, PAGE2) };
});

const output = {
  playbook: "The Monstrous",
  streamOrderCheck:
    "Spot-checked pdftotext -raw against pages 37 and 38 for the column-swap defect before extracting, per " +
    "standard practice. Page 37: Monster Breed -> Curses -> Natural Attacks -> Moves, correct left-to-right " +
    "order, no swap. Page 38: Gear -> Getting Started -> Introductions (column 1) -> History -> Monster Breed " +
    "Suggestions (column 2) -> Leveling Up (column 3), correct order, no swap.",
  target1_monsterBreedIntro: {
    note:
      "Contains a genuine source typo, \"if you you were originally\" — preserved EXACTLY as printed per explicit " +
      "instruction; already corrected on the catalogue side as a separate content-fidelity call, not re-litigated " +
      "here.",
    text: monsterBreedIntroHtml,
  },
  target2_curses: {
    note: "Pick-1 section. The exact source heading is \"Curses, pick one:\" (bold, structural) — no separate \"Pick one.\" sentence exists beyond this heading.",
    options: curses.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
  },
  target3_naturalAttacks: {
    framing: naturalAttacksFramingHtml,
    bases: naturalAttacksBases.map((d) => ({ title: null, descriptionText: d })),
    extras: naturalAttacksExtras.map((d) => ({ title: null, descriptionText: d })),
  },
  target4_monsterBreedSuggestions: suggestions.map((s) => ({ archetype: s.name, text: s.html })),
  formattingNote:
    "Target 1 (Monster Breed intro): 1 italic span (\"only\"). Target 2 (Curses): all 4 options have bold titles " +
    "(3 of 4 needed a generic extract-moves.mjs fix for a leading \": \" left over from a colon-free bold title — " +
    "see script header) and 1 bold cross-reference each (\"act under pressure\"/variant, base-move pattern); " +
    "Dark Master has none beyond its title. Target 3 (Natural Attacks): framing sentence entirely italicized; all " +
    "4 Base and 3 Extra descriptions entirely plain, no bold/italic, no font-based title signal (matches Forged's " +
    "Benefits precedent — these are flat descriptions, not font-derived title+description). Target 4 (page 38): " +
    "all 7 archetype entries have a bold name and exactly 3 italic field sub-labels each (\"Curse\", \"Natural " +
    "attacks\", \"Moves\") — confirmed programmatically for all 7, a consistent, new formatting pattern for this " +
    "pipeline (italicized structural sub-labels within an otherwise plain summary line, distinct from every prior " +
    "bold/italic usage pattern found so far).",
};

const jsonPath = path.join(__dirname, "monstrous-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const cursesHtml = output.target2_curses.options
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");
const basesHtml = output.target3_naturalAttacks.bases.map((o) => `<li>${escapeForDisplay(o.descriptionText)}</li>`).join("\n");
const extrasHtml = output.target3_naturalAttacks.extras.map((o) => `<li>${escapeForDisplay(o.descriptionText)}</li>`).join("\n");
// s.text already begins with the archetype name in <b> (splice output),
// so no separate heading element is needed here — avoids showing the
// name twice in the review.
const suggestionsHtml = output.target4_monsterBreedSuggestions
  .map((s) => `<li><div class="opt-desc">${escapeForDisplay(s.text)}</div></li>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Monstrous — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .opt-desc b, .block b { color: #a33; }
  .opt-desc i, .block i { color: #369; }
  .block { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Monstrous — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-monstrous-review.mjs. ${escapeForDisplay(output.streamOrderCheck)}</p>
<p class="note">${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Monster Breed intro (page 37)</h2>
<p class="note">${escapeForDisplay(output.target1_monsterBreedIntro.note)}</p>
<div class="block">${escapeForDisplay(output.target1_monsterBreedIntro.text)}</div>

<h2>Target 2 — Curses (page 37)</h2>
<p class="note">${escapeForDisplay(output.target2_curses.note)}</p>
<ul class="options">
${cursesHtml}
</ul>

<h2>Target 3 — Natural Attacks (page 37)</h2>
<div class="block">${escapeForDisplay(output.target3_naturalAttacks.framing)}</div>
<h3>Bases</h3>
<ul class="options">${basesHtml}</ul>
<h3>Extras</h3>
<ul class="options">${extrasHtml}</ul>

<h2>Target 4 — Monster Breed Suggestions (page 38)</h2>
<ul class="options">
${suggestionsHtml}
</ul>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "monstrous-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.streamOrderCheck);
console.log("\n" + output.formattingNote);
