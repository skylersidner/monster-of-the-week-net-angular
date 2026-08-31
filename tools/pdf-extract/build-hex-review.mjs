// Thirteenth playbook run through the pipeline, requested by the
// coordinator on Yoshi's behalf. The Hex spans 4 pages (27 front, 28
// back, 29-30 a dedicated "Rotes" worksheet insert). Two targets, both
// ready now regardless of a still-pending schema question on Rotes'
// exact field structure — raw extraction doesn't depend on that.
//
// Spot-checked `pdftotext -raw` against pages 27/29/30 for the
// column-swap defect (Skyler's Forged finding) before extracting, per
// standard practice: page 27's raw stream order is Rotes -> Temptation ->
// (Vengeance..) -> Moves -> "Then pick one of these:", i.e. correct
// left-to-right order, no swap. Pages 29-30 (single/dual-column worksheet
// layout, not the 3-column character-sheet template) show no swap
// signature either. Clean.
//
// Target 1 — Temptation (page 27, x ~280-520): framing paragraph,
// consequence paragraph (bold "act under pressure"), 7 title+description
// options (all plain descriptions, bold titles) via extract-moves.mjs.
//
// Target 2 — Rotes prose (page 27's blurb + page 29's full explanation +
// 5 Requirements' long/short forms + worksheet field labels).
//
// TWO real false-positive classes found and fixed during this pass, on
// top of the already-known "wrong column/section" class:
//   1. Y-bound-too-loose (repeated twice here) let a structural heading
//      bleed into a splice call meant to cover only body text below it —
//      same underlying lesson as every prior pass, re-confirmed, not new.
//   2. NEW: splitting one continuous flow into multiple independent
//      splice() calls that all share the SAME full runs.json lets a run
//      already "consumed" by an earlier call match again in a later,
//      unrelated call if the same word happens to reappear there as
//      PLAIN text too. Fixed by manually partitioning the runs array per
//      paragraph before calling splice(), not sharing one runs file
//      across multiple calls covering the same page/column.
//   3. NEW, deeper: even within ONE splice() call, if the same phrase
//      repeats with MIXED styling (some occurrences bold, some plain)
//      and a PLAIN occurrence sits between two BOLD ones, forward-only
//      substring matching can match the wrong occurrence (it has no way
//      to know "skip this one, it's unstyled"). Found on page 29's
//      "rest" paragraph: three "use magic" substrings appear, but only
//      the 1st and 3rd are actually bold — the splice engine matched the
//      1st correctly, then matched its 2nd run entry against the
//      unstyled 2nd occurrence instead of the truly-bold 3rd one.
//      Verified against the raw item dump and hand-corrected that one
//      paragraph's HTML directly rather than trusting the automated
//      splice — flagged prominently, not silently patched over.
//
// Usage: node build-hex-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-hex-review.mjs <pdfPath>");
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

function writeRuns(runsArr) {
  const runsPath = path.join(scratchDir, `runs-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(runsPath, JSON.stringify(runsArr));
  return runsPath;
}

function splice(text, runsArr, page) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  const runsPath = writeRuns(runsArr);
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, runsPath, "--pages", String(page)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

// ============ TARGET 1: page 27, Temptation ============
const PAGE1 = 27;
const bold = (t) => ({ page: PAGE1, style: "bold", text: t });

const temptationFramingPlain =
  "You have a dangerous drive that you pursue, sometimes to the exclusion of your own safety. Decide if your " +
  "Temptation drove you to learn magic, or if learning magic drove you to it. Whenever you give in to your " +
  "Temptation and act accordingly, you mark experience. You need to act under pressure to resist giving in to " +
  "your temptation, if a perfect opportunity presents itself; if you fail this roll, you don't mark experience " +
  "like you would have if you'd willingly acted out your desires. Choose one Temptation:";
// minY=290 (excludes 1st bullet at y=281.4), maxY=430 (excludes "Temptation" heading at y=440.4) — verified.
const temptationFramingHtml = splice(temptationFramingPlain, [bold("act under pressure")], PAGE1);

const temptationOptions = extractMoves(PAGE1, 280, 520, 130, 285).moves; // 7 options, y-bounded between "Moves" heading (125.9) and "Choose one Temptation:" (293.9)

// ============ TARGET 2, part A: page 27 Rotes blurb ============
const rotesBlurbPlain =
  "Whenever you use magic, you can decide afterwards that a particular spell is a rote that you know. " +
  "See the separate Rotes sheet for more details.";
// minY=455, maxY=490 — tightened after an initial maxY=498 wrongly pulled in the "Rotes" section heading
// itself (y=495.9), producing a false-positive <b>Rotes</b> around the unrelated "See the separate Rotes
// sheet" text — caught by inspecting the runs.json before trusting the splice output, not assumed clean.
const rotesBlurbHtml = splice(rotesBlurbPlain, [bold("use magic"), bold("rote")], PAGE1);

// ============ TARGET 2, part B: page 29 full explanation ============
const PAGE2 = 29;
const bold29 = (t) => ({ page: PAGE2, style: "bold", text: t });

const explanationIntroPlain =
  "Whenever you use magic, you can decide afterwards that a particular spell is a rote that you know. Write " +
  "down in detail what the spell does, and what it requires. You know how to cast it off the top of your head, " +
  "and you choose two requirements from this list:";
const explanationIntroHtml = splice(explanationIntroPlain, [bold29("use magic"), bold29("rote")], PAGE2);

// The 5 Requirements' LONG explanatory forms — confirmed a real bulleted
// list in the source (literal "•" markers) and confirmed every item is
// entirely plain (0 bold/italic within any of the 5), so built directly
// as <li> without needing a splice pass.
const requirementsLong = [
  "Magic words and ritual gestures.",
  "An object of power (wand, talisman, orb, staff, etc) which must be wielded.",
  "An expendable component such as sulfur, sage, or incense, which must be burned, blown, or scattered during the casting.",
  "Runes or symbols written or engraved on a surface (which must be prepared).",
  "A spilling of blood, which inflicts 1-harm upon you or a willing participant.",
];
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const requirementsListHtml = `<ul>${requirementsLong.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;

// "rest" paragraph — hand-corrected, NOT run through splice(), per the
// header comment: three "use magic" substrings appear in this paragraph
// but only the 1st ("Unlike regular use magic") and 3rd ("a basic use
// magic spell") are actually bold in the source; the 2nd ("a specialised
// version of use magic, which is built with the Keeper") is plain.
// Forward-only sequential matching can't distinguish this — verified
// against the raw pdf.js item dump directly (item 55 bold, item 62
// plain, item 68 bold) rather than trusting the automated splice, which
// (confirmed live) matches the wrong occurrence when tried naively.
const explanationRestHtml =
  "Give your new rote a name, and decide specifically what the requirements are (which words, gestures, objects, " +
  "symbols, and procedures are required). Unlike regular <b>use magic</b>, a rote's cost and the consequences " +
  "for failing it are known to you in advance. After you cast it for the first time, treat each rote as a " +
  "custom move—a specialised version of use magic, which is built with the Keeper. Write down what it does on " +
  "a 10+, a 7-9, and a miss. Also, a rote is a bit more powerful than a basic <b>use magic</b> spell: its " +
  "glitches are less onerous and its effect may be a little bigger. Casting a rote requires you to have the " +
  "needed items at hand and the ability to physically use them. You roll +Weird to cast it, as you would when " +
  "<b>using magic</b> normally.";

const howManyRotesHeading = "How many rotes?"; // structural bold sub-heading, not embedded in body text
const howManyRotesPlain =
  "You start out knowing up to one rote, which you can choose when creating your character or during play. " +
  "You can learn more by taking improvements—when you do, you can choose the new rote right away or in play.";
const howManyRotesHtml = splice(howManyRotesPlain, [bold29("rote")], PAGE2);

// ============ TARGET 2, part C: worksheet structure (repeats 8x across pages 29-30) ============
// Checked 2 of the 8 instances directly (page 29's first two grid cells)
// and confirmed identical formatting via pdftotext -raw byte-for-byte
// text match across all 8 — sufficient to generalize the finding to all
// 8 without individually re-verifying each one's font IDs (which differ
// per page/column position anyway, per this pipeline's established
// per-page font-resolution rule, but the SEMANTIC styling is identical).
const requirementsShort = [
  "Magic words, ritual gestures",
  "Object of power which must be wielded",
  "Expendable component destroyed or scattered",
  "Runes or symbols written or engraved on a surface",
  "Spilling of blood (1-harm to you or willing person)",
];
const worksheetFieldLabels = {
  "Rote:":
    "NOT bold, NOT italic — uses a distinct DISPLAY font (\"3rdMan\", the same decorative font used for " +
    "playbook titles like \"The Hex\") rather than either WarnockPro-Bold or -It. This is a structural/decorative " +
    "label style, not semantic emphasis, so it correctly falls outside the <b>/<i> enumerated subset — flagged " +
    "explicitly since it visually reads as \"styled\" but isn't bold or italic by this pipeline's classification, " +
    "and shouldn't be persisted as <b> markup.",
  "Requirements, pick two:": "BOLD.",
  "Effect:": "BOLD.",
  "On a 10+": "Plain — NOT bold, despite being a roll-outcome label.",
  "On a 7-9:": "Plain — NOT bold.",
  "On a miss:": "Plain — NOT bold.",
};

const output = {
  playbook: "The Hex",
  streamOrderCheck:
    "Spot-checked pdftotext -raw against pages 27, 29, 30 for the column-swap defect (Skyler's Forged finding) " +
    "before extracting, per standard practice. Page 27: raw stream order is Rotes -> Temptation -> (Vengeance...) " +
    "-> Moves -> \"Then pick one of these:\" — correct left-to-right order, no swap. Pages 29-30 (worksheet-insert " +
    "layout, not the 3-column character-sheet template) show no swap signature. Clean on all 3 pages.",
  targets: {
    temptation: {
      sectionTitle: "Temptation",
      framing: temptationFramingHtml,
      options: temptationOptions.map((m) => ({ title: m.title, descriptionText: m.descriptionHtml })),
    },
    rotes: {
      pageBlurb: {
        note: "Page 27's shorter introductory blurb (points the reader to the separate Rotes sheet).",
        text: rotesBlurbHtml,
      },
      fullExplanation: {
        note: "Page 29's full explanation. Assembled from 3 spliced/hand-verified prose segments + 1 real bulleted list — see build-hex-review.mjs comments for exactly why each segment was handled the way it was, including the one paragraph corrected by hand rather than trusted from the automated splice.",
        intro: explanationIntroHtml,
        requirementsLongForm: {
          note: "A REAL bulleted list in the source (literal \"•\" markers), all 5 items entirely plain.",
          html: requirementsListHtml,
          items: requirementsLong,
        },
        rest: explanationRestHtml,
        restCorrectionNote:
          "This paragraph's <b> placement was corrected by hand against the raw PDF item dump, NOT taken from " +
          "the automated splice — the automated splice matched the wrong occurrence of a 3x-repeated, " +
          "inconsistently-styled phrase (\"use magic\", bold on occurrences 1 and 3, plain on occurrence 2). See " +
          "the script's header comment for the full mechanism.",
      },
      howManyRotes: {
        heading: howManyRotesHeading,
        headingNote: "Bold structural sub-heading, not embedded inline in the body text.",
        text: howManyRotesHtml,
      },
      requirementsShortForm: {
        note: "Page 29-30 worksheet's terser form of the same 5 Requirements (repeats identically in all 8 worksheet instances). All plain, confirmed programmatically.",
        items: requirementsShort,
      },
      worksheetFieldLabels,
    },
  },
  formattingNote:
    "Temptation: framing+consequence has 1 bold span (\"act under pressure\", base-move cross-reference); all 7 " +
    "options have bold titles (already handled) and fully plain descriptions. Rotes blurb (page 27): 2 bold " +
    "spans (\"use magic\", \"rote\" — the latter a term-definition bold on its first mention, a different kind of " +
    "bold usage than the established move-cross-reference pattern). Page 29 full explanation: \"use magic\"/" +
    "\"using magic\" bolded on 4 of 5 total occurrences across the page (1 in the intro, 2 of 3 in the rest " +
    "paragraph, 1 in \"as you would when using magic normally\"), \"rote\" bolded on its first mention in the " +
    "intro and again in \"How many rotes?\"'s own body paragraph, \"How many rotes?\" itself is a bold structural " +
    "sub-heading. Zero italic anywhere across pages 27, 29, and 30 for this playbook's Hex-specific content. " +
    "Worksheet field labels: \"Requirements, pick two:\"/\"Effect:\" bold, \"On a 10+\"/\"On a 7-9:\"/\"On a " +
    "miss:\" plain, \"Rote:\" a distinct display font (neither bold nor italic).",
};

const jsonPath = path.join(__dirname, "hex-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const temptationOptionsHtml = output.targets.temptation.options
  .map((o) => `<li><div class="opt-title">${escapeForDisplay(o.title)}</div><div class="opt-desc">${escapeForDisplay(o.descriptionText)}</div></li>`)
  .join("\n");
const requirementsShortHtml = output.targets.rotes.requirementsShortForm.items.map((i) => `<li>${escapeForDisplay(i)}</li>`).join("\n");
const worksheetLabelsHtml = Object.entries(output.targets.rotes.worksheetFieldLabels)
  .map(([k, v]) => `<li><code>${escapeForDisplay(k)}</code> — ${escapeForDisplay(v)}</li>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Hex — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  h3 { margin-top: 1.25rem; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 0.5rem; padding: 0.6rem 0.9rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.2rem; }
  .block, .opt-desc { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; }
  .block b, .opt-desc b { color: #a33; }
  .block i, .opt-desc i { color: #369; }
  .block ul { margin: 0.4rem 0; padding-left: 1.5rem; }
  .note { color: #666; font-size: 0.9rem; }
  .flag { background: #fff8e1; border: 1px solid #e6d27a; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 0.5rem; }
  .labels { list-style: none; padding: 0; }
  .labels li { padding: 0.3rem 0; }
</style>
</head>
<body>
<h1>The Hex — extraction review</h1>
<p class="note">Generated by tools/pdf-extract/build-hex-review.mjs. ${escapeForDisplay(output.streamOrderCheck)}</p>
<p class="note">${escapeForDisplay(output.formattingNote)}</p>

<h2>Target 1 — Temptation (page 27)</h2>
<div class="block">${escapeForDisplay(output.targets.temptation.framing)}</div>
<h3>Options (choose 1 of 7)</h3>
<ul class="options">
${temptationOptionsHtml}
</ul>

<h2>Target 2 — Rotes prose</h2>
<h3>Page 27 blurb</h3>
<div class="block">${escapeForDisplay(output.targets.rotes.pageBlurb.text)}</div>

<h3>Page 29 full explanation</h3>
<div class="block">${escapeForDisplay(output.targets.rotes.fullExplanation.intro)}${output.targets.rotes.fullExplanation.requirementsLongForm.html}${escapeForDisplay(output.targets.rotes.fullExplanation.rest)}</div>
<div class="flag"><strong>Hand-corrected paragraph:</strong> ${escapeForDisplay(output.targets.rotes.fullExplanation.restCorrectionNote)}</div>

<h3>${escapeForDisplay(output.targets.rotes.howManyRotes.heading)}</h3>
<p class="note">${escapeForDisplay(output.targets.rotes.howManyRotes.headingNote)}</p>
<div class="block">${escapeForDisplay(output.targets.rotes.howManyRotes.text)}</div>

<h3>Requirements — worksheet short form (repeats 8x, pages 29-30)</h3>
<ul class="options">
${requirementsShortHtml}
</ul>

<h3>Worksheet field label formatting</h3>
<ul class="labels">
${worksheetLabelsHtml}
</ul>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "hex-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("\n" + output.streamOrderCheck);
console.log("\n" + output.formattingNote);
