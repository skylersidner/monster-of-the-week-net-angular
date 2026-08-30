// Phase 6 custom-moves TOOLING pass — not a per-playbook authoring pass.
//
// Validates the two extract-moves.mjs paths added for Phase 6 against the
// exact seven targets named in docs/hunter-playbooks/custom-moves-ideation.md
// Section 5 ("Tooling prerequisites") and Section 2.5:
//
//   INLINE (comma/semicolon runs, no bullets — the gap the census named):
//     1. The Crooked / Artifact             p11  1 of 5
//     2. The Crooked / Deal with the Devil  p11  1-2 of 5
//     3. The Changeling / Force of Nature   p5   1 of 3 + open slot
//     4. The Gumshoe / The Naked City       p25  4 of 34
//     5. The Professional / Mobility        p43  Good 2 of 14 + Bad 1 of 8
//     6. The Searcher / Guardian            p45  1 of 5
//
//   BULLETED (the known-verified in-move bulleted case, plus one more
//   added during the pass because it is the counterexample to the ideation
//   doc's "no font-derived Title boundary anywhere" claim):
//     7. The Host / Defensive Adaptation    p31  1 of 6
//     8. The Searcher / First Encounter     p45  1 of 7  (BOLD option names)
//
// Expected option counts below come from the census table in
// custom-moves-ideation.md Section 2.1 and are asserted, not eyeballed —
// this script fails loudly if the extractor's counts drift.
//
// Two REAL gaps in the BULLETED path were found during this pass, neither
// of which the ideation doc predicted (it only flagged the inline gap):
//
//   (a) A capital "B" FateCoreGlyphs glyph marks a REQUIRED move. The
//       extractor only recognised lowercase "b", so every Required move's
//       entire body was silently absorbed into the preceding segment (or
//       into `intro` when it came first). On this page-31 target the old
//       tool put all of Defensive Adaptation into `intro`, glyph and all
//       ("...You get this one: B Defensive Adaptation: Your symbiote
//       protects you. Pick one:"), and then emitted its 6 options as 6
//       separate title-less top-level "moves".
//   (b) In-move option bullets use the SAME "b" glyph as a top-level move
//       bullet, indented further right (Host p31: options at x=521.2 under
//       a move bullet at x=503.2). Distinguished now by x-indent only.
//
// Usage: node build-custom-moves-tooling-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-custom-moves-tooling-review.mjs <pdfPath>");
  process.exit(1);
}

// One extraction per (page, column) — x-ranges read off dump-page.mjs, the
// same workflow every prior pass used. Note Changeling's column runs to
// x~555, wider than the 530 a first guess used: a regular-styled run at
// x=540.7 (", act as if you" in They Are My People) was clipped by the
// narrower bound, which is the usual "read the output, don't trust the
// first x-range" check this pipeline already insists on.
const COLUMNS = [
  { key: "crooked", playbook: "The Crooked", page: 11, minX: 525, maxX: 780 },
  { key: "changeling", playbook: "The Changeling", page: 5, minX: 270, maxX: 580 },
  { key: "gumshoe", playbook: "The Gumshoe", page: 25, minX: 280, maxX: 520 },
  { key: "professional", playbook: "The Professional", page: 43, minX: 280, maxX: 520 },
  { key: "searcher", playbook: "The Searcher", page: 45, minX: 525, maxX: 780 },
  { key: "searcher-left", playbook: "The Searcher", page: 45, minX: 275, maxX: 520 },
  { key: "host", playbook: "The Host", page: 31, minX: 500, maxX: 780 },
];

const TARGETS = [
  { column: "crooked", move: "Artifact", presentation: "inline", expected: [5], censusShape: "1 of 5" },
  { column: "crooked", move: "Deal with the Devil", presentation: "inline", expected: [5], censusShape: "1-2 of 5 (a real range)" },
  { column: "changeling", move: "Force of Nature", presentation: "inline", expected: [4], censusShape: "1 of 3 + open-ended slot" },
  { column: "gumshoe", move: "The Naked City", presentation: "inline", expected: [34], censusShape: "4 of 34" },
  { column: "professional", move: "Mobility", presentation: "inline", expected: [14, 8], censusShape: "Good 2 of 14, Bad 1 of 8" },
  { column: "searcher", move: "Guardian", presentation: "inline", expected: [5], censusShape: "1 of 5" },
  { column: "host", move: "Defensive Adaptation", presentation: "bulleted", expected: [6], censusShape: "1 of 6" },
  // Added during the pass, not part of the original brief: a SECOND
  // bulleted in-move case, included because it is the counterexample to
  // custom-moves-ideation.md §2.5(a)'s "no font-derived Title boundary
  // anywhere in this content class" — its 7 option names are genuinely
  // bold.
  { column: "searcher-left", move: "First Encounter", presentation: "bulleted", expected: [7], censusShape: "1 of 7" },
];

const extracted = new Map();
for (const col of COLUMNS) {
  const out = execFileSync(
    process.execPath,
    [
      path.join(__dirname, "extract-moves.mjs"),
      pdfPath,
      String(col.page),
      "--minX",
      String(col.minX),
      "--maxX",
      String(col.maxX),
      "--options",
      "--json",
    ],
    { encoding: "utf8" }
  );
  extracted.set(col.key, JSON.parse(out));
}

const results = [];
const failures = [];

for (const target of TARGETS) {
  const col = COLUMNS.find((c) => c.key === target.column);
  const doc = extracted.get(target.column);
  const move = doc.moves.find((m) => m.title === target.move);
  if (!move) {
    failures.push(`${col.playbook} / ${target.move}: move not found in page ${col.page} extraction`);
    continue;
  }
  // Only the groups matching the target's own presentation are the pick
  // being validated. A move can legitimately carry both — Changeling's
  // Force of Nature has an inline creation-time pick AND a "•" roll-result
  // "Extras" list, and only the former is in Phase 6 scope (Q1: in-play
  // menus stay prose).
  const groups = move.optionGroups.filter((g) => g.presentation === target.presentation);
  const counts = groups.map((g) => g.options.length);
  const ok = counts.length === target.expected.length && counts.every((n, i) => n === target.expected[i]);
  if (!ok) {
    failures.push(
      `${col.playbook} / ${target.move}: expected option counts [${target.expected.join(", ")}] ` +
        `per the census, got [${counts.join(", ")}]`
    );
  }
  results.push({
    playbook: col.playbook,
    page: col.page,
    move: target.move,
    required: move.required,
    presentation: target.presentation,
    censusShape: target.censusShape,
    optionCounts: counts,
    matchesCensus: ok,
    descriptionHtml: move.descriptionHtml,
    optionGroups: groups,
    otherGroups: move.optionGroups.filter((g) => g.presentation !== target.presentation),
  });
}

const provenanceTally = {};
const styleTally = {};
for (const r of results) {
  for (const g of r.optionGroups) {
    for (const o of g.options) {
      provenanceTally[o.titleProvenance] = (provenanceTally[o.titleProvenance] || 0) + 1;
      styleTally[o.titleStyle] = (styleTally[o.titleStyle] || 0) + 1;
    }
  }
}

const output = {
  pass: "Phase 6 custom-moves extraction tooling",
  scope:
    "Tooling validation, not content authoring. Covers the 6 inline moves named in custom-moves-ideation.md " +
    "Section 5, the known-verified bulleted in-move case (Host p31), and one further bulleted case added during " +
    "the pass (Searcher p45's First Encounter) because it contradicts the doc's font-signal claim.",
  titleProvenanceFinding:
    "Every Title/DescriptionText split below is DELIMITER-derived (colon or parenthesis) — the extractor never " +
    "derives a title boundary from a font run for in-move content, exactly as custom-moves-ideation.md Section " +
    "5 item 2 requires. titleProvenance tally across all validated groups: " +
    Object.entries(provenanceTally)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") +
    ". titleStyle tally (whether the SOURCE independently styles the title run): " +
    Object.entries(styleTally)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") +
    ".",
  ideationDocCorrections: [
    "Section 2.5(a) / Section 5 item 2 says no font-derived Title boundary exists ANYWHERE in this content class " +
      "— \"not an exception, it's the rule for this entire content class\". That is NOT universally true. The " +
      "Searcher's First Encounter (page 45, one of the 14 in-scope moves, Required) has genuinely BOLD option " +
      "names — \"Cryptid Sighting\" is g_d0_f2 = WarnockPro-Bold on that page, verified against the raw item " +
      "stream, not inferred from the extractor's own classification. The doc's claim was verified on exactly two " +
      "cases (Crooked p11 inline, Host p31 bulleted) and generalised; it holds for those two and for most others, " +
      "but it is not safe as a blanket assumption. The tooling therefore MEASURES it per option (titleStyle / " +
      "titleFontCorroborated) instead of assuming it, while still deriving the boundary itself from the " +
      "delimiter — which is the right split even where a font signal exists, because the whole option is often " +
      "one text item and a bold run alone cannot say where the title ends.",
    "Professional's Mobility has two CATEGORY labels (\"Good things\", \"Bad things\") that ARE font-signalled, " +
      "in ITALIC (WarnockPro-It). These are category headings rather than option titles, so they do not " +
      "contradict the doc's rule about option names — but they matter to the tooling, because Mobility carries no " +
      "pick verb immediately before its colons, and that italic label is what the inline detector keys on " +
      "instead.",
  ],
  parenSplitCaveat:
    "titleProvenance \"delimiter:paren\" ALWAYS needs review before authoring. Real counterexample found on this " +
    "pass, not theorised: Gumshoe's The Naked City contains \"Criminals (organised)\", \"Criminals (street)\", " +
    "\"Police (local)\" and \"Police (national)\", where the parenthetical is part of the contact type's NAME, not " +
    "a description. The extractor still reports the split (with provenance) rather than guessing, because on " +
    "Crooked's Artifact the same paren form IS the mechanical description (\"Protective amulet (1-armour magic " +
    "recharge)\").",
  bulletedPathGapsFound: [
    "A capital \"B\" FateCoreGlyphs glyph marks a REQUIRED move; the extractor only recognised lowercase \"b\". " +
      "Every Required move's whole body was therefore silently absorbed into the preceding segment (or into " +
      "`intro`, when it came first). Verified against the pre-change extractor on this exact page-31 target: it " +
      "put all of Defensive Adaptation into `intro` with the literal glyph still in the text, then emitted the " +
      "move's 6 options as 6 title-less top-level \"moves\". Now recognised, with the glyph's case reported as " +
      "`required`.",
    "In-move option bullets use the SAME \"b\" glyph as a top-level move bullet, distinguished only by x-indent " +
      "(Host p31: options at x=521.2 under a move bullet at x=503.2; same shape on Searcher p45's First " +
      "Encounter, Visitor p55's Something Strange, Forged p23's Partner). Top-level is now taken as the leftmost " +
      "glyph bullet in scope; anything further right than --bulletTolerance (6pt) is a nested option marker.",
    "Checked and found FALSE, so recorded as a negative result: the marker form does NOT tell you whether a list " +
      "is a creation-time pick or an in-play menu. Spell-Slinger's Tools and Techniques (creation-time, p49) uses " +
      "\"•\", and Could've Been Worse (in-play, same page) uses \"•\" too. Both marker forms are reported and the " +
      "author decides.",
  ],
  incidentalFinding:
    "Not asked for, surfaced by the new inline path while re-running the existing regression suite: The " +
    "Monstrous's Curses option \"Pure Drive\" (page 37, an already-authored Phase 5 BESPOKE option, not a Move) " +
    "contains its own creation-time inline pick — \"One emotion rules you. Pick from: hunger, hate, anger, fear, " +
    "jealousy, greed, joy, pride, envy, lust, or cruelty.\" That is a pick nested inside a bespoke option, which " +
    "is outside the Phase 6 census's scope (Section 2.1 covers picks inside Moves) and is not recorded as a " +
    "structured pick anywhere. Flagged for Yoshi/Skyler, not acted on here.",
  targets: results,
};

const jsonPath = path.join(__dirname, "custom-moves-tooling-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const cards = results
  .map((r) => {
    const groups = r.optionGroups
      .map((g) => {
        const rows = g.options
          .map(
            (o) =>
              `<tr><td>${escapeForDisplay(o.titleHtml)}</td><td>${
                o.descriptionHtml ? escapeForDisplay(o.descriptionHtml) : "<span class=\"none\">—</span>"
              }</td><td class="prov prov-${o.titleProvenance.replace(":", "-")}">${escapeText(
                o.titleProvenance
              )}</td><td class="prov">${escapeText(o.titleStyle)}${
                o.titleFontCorroborated ? " <strong>(font-corroborated)</strong>" : ""
              }</td></tr>`
          )
          .join("\n");
        return `<div class="group">
<p class="ginfo"><strong>${escapeText(g.presentation)}</strong>${
          g.delimiter ? ` &middot; delimiter <code>${escapeText(g.delimiter)}</code>` : ""
        }${g.markerKind ? ` &middot; marker <code>${escapeText(g.markerKind)}</code>` : ""}${
          g.terminator ? ` &middot; terminator <code>${escapeText(g.terminator)}</code>` : ""
        } &middot; ${g.options.length} option(s)</p>
<p class="instr">Instruction: <em>${escapeText(g.instruction || "(none — list not colon-introduced)")}</em></p>
<table><thead><tr><th>Title</th><th>DescriptionText</th><th>title provenance</th><th>title style in source</th></tr></thead><tbody>
${rows}
</tbody></table>
</div>`;
      })
      .join("\n");
    const other = r.otherGroups.length
      ? `<p class="note">Also present, deliberately NOT part of this validation: ${r.otherGroups.length} ${
          r.presentation === "inline" ? "bulleted" : "inline"
        } group(s) — e.g. an in-play roll-result list, which Q1 settled as prose only.</p>`
      : "";
    return `<section>
<h2>${escapeText(r.playbook)} &mdash; ${escapeText(r.move)} <span class="pg">p${r.page}</span>${
      r.required ? ' <span class="req">Required</span>' : ""
    }</h2>
<p class="note">Census shape: <strong>${escapeText(r.censusShape)}</strong> &middot; extracted option counts: <strong>[${r.optionCounts.join(", ")}]</strong> &middot; ${
      r.matchesCensus ? '<span class="ok">matches census</span>' : '<span class="bad">DOES NOT MATCH CENSUS</span>'
    }</p>
<div class="body">${escapeForDisplay(r.descriptionHtml)}</div>
${groups}
${other}
</section>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Phase 6 custom-moves extraction tooling — review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 980px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .pg { color: #888; font-weight: normal; font-size: 0.85rem; }
  .req { background: #ffe9c7; border: 1px solid #d9a441; border-radius: 4px; padding: 0 0.4rem; font-size: 0.75rem; vertical-align: middle; }
  .note { color: #666; font-size: 0.9rem; }
  .ok { color: #1a7f37; font-weight: 600; }
  .bad { color: #b42318; font-weight: 600; }
  .body { background: #f7f7f7; padding: 0.9rem 1.1rem; border-radius: 6px; margin: 0.6rem 0; }
  .body b, td b { color: #b42318; }
  .body i, td i { color: #1f4fd8; }
  .group { border-left: 3px solid #7ac68a; padding-left: 0.9rem; margin: 1rem 0; }
  .ginfo, .instr { margin: 0.2rem 0; font-size: 0.9rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; font-size: 0.92rem; }
  th, td { border: 1px solid #ddd; padding: 0.35rem 0.6rem; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  .none { color: #aaa; }
  .prov { white-space: nowrap; font-size: 0.82rem; }
  .prov-delimiter-colon { color: #1a7f37; }
  .prov-delimiter-paren { color: #9a6700; font-weight: 600; }
  .prov-none { color: #666; }
  .flag { border-radius: 6px; padding: 0.75rem 1rem; margin-top: 1rem; }
  .flag-amber { background: #fff8e5; border: 1px solid #d9a441; }
  .flag-green { background: #e6ffed; border: 1px solid #7ac68a; }
  .flag-blue { background: #eef3ff; border: 1px solid #7a9ac6; }
  ul.findings li { margin-bottom: 0.5rem; }
</style>
</head>
<body>
<h1>Phase 6 custom-moves extraction tooling &mdash; review</h1>
<p class="note">Generated by tools/pdf-extract/build-custom-moves-tooling-review.mjs. Tooling validation, not content authoring. Bold rendered red, italic blue, purely to make them easy to eyeball against the source PDF.</p>

<div class="flag flag-green"><strong>Title provenance &mdash; every in-move split is delimiter-derived.</strong> ${escapeText(
  output.titleProvenanceFinding
)}</div>

<div class="flag flag-amber"><strong>Corrections to custom-moves-ideation.md, found by running the tooling against the source.</strong>
<ul class="findings">
${output.ideationDocCorrections.map((f) => `<li>${escapeText(f)}</li>`).join("\n")}
</ul>
</div>

<div class="flag flag-amber"><strong>Parenthesis splits always need review.</strong> ${escapeText(
  output.parenSplitCaveat
)}</div>

<div class="flag flag-amber"><strong>Two real gaps found in the BULLETED path &mdash; not predicted by the ideation doc, which only flagged the inline gap.</strong>
<ul class="findings">
${output.bulletedPathGapsFound.map((f) => `<li>${escapeText(f)}</li>`).join("\n")}
</ul>
</div>

<div class="flag flag-blue"><strong>Incidental finding, flagged not acted on.</strong> ${escapeText(
  output.incidentalFinding
)}</div>

${cards}
</body>
</html>
`;

const htmlPath = path.join(__dirname, "custom-moves-tooling-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("");
for (const r of results) {
  console.log(
    `${r.matchesCensus ? "OK  " : "FAIL"} ${r.playbook} / ${r.move} (p${r.page}, ${r.presentation}) — ` +
      `census "${r.censusShape}", extracted [${r.optionCounts.join(", ")}]${r.required ? " [Required]" : ""}`
  );
}
console.log("");
console.log("Title provenance tally across validated groups: " + JSON.stringify(provenanceTally));
console.log("Title style-in-source tally:                     " + JSON.stringify(styleTally));
if (failures.length) {
  console.error("\nVALIDATION FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll ${results.length} targets match the census's own option counts.`);
