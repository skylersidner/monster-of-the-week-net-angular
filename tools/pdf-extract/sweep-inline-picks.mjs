// Phase 5 inline-pick sweep — detection and reporting ONLY.
//
// Why this exists: until the Phase 6 tooling pass, `extract-moves.mjs`
// segmented purely on bullet glyphs, so a creation-time pick presented as
// an inline comma/semicolon run ("One emotion rules you. Pick from:
// hunger, hate, anger, ...") was invisible to the pipeline — it returned
// nothing structural for it, silently. That blind spot applied to ALL of
// Phase 5's bespoke authoring, not just to Phase 6's Moves. The Monstrous's
// "Pure Drive" turned up incidentally while re-running the regression
// suite; Skyler's call was to sweep the whole book rather than fix that
// one instance.
//
// What this does NOT do: it does not edit `bespoke-ruleset-catalogue.md`
// or any other doc. That catalogue is Yoshi's. This produces a findings
// list for Yoshi to adjudicate case by case.
//
// Coverage, and why it isn't "wherever prior build scripts happened to
// look": every page (1-58) is scanned in full. Columns are detected
// geometrically per page from the line-start x histogram (the layout has a
// ~248pt column pitch, so a 110pt gap threshold separates columns without
// ever splitting one). Within each column the same body/option state
// machine `extract-moves.mjs` uses — imported from `lib-move-body.mjs`, not
// reimplemented — runs over BOTH the bulleted segments and the
// pre-first-bullet prose region, so a section-level inline pick sitting
// ahead of any bullets is caught too.
//
// Attribution: standalone bold lines in a column are its section headings
// (that is exactly how this book marks them). Each hit is attributed to the
// nearest heading above it, falling back to the last heading of a preceding
// column on the same page when a column continues one (the Moves block
// routinely spills across two columns under a single "Moves" heading).
// That attribution is what separates Phase 5 bespoke content from Phase 6
// Moves content, and it is reported so Yoshi can sanity-check it rather
// than take it on trust.
//
// Usage: node sweep-inline-picks.mjs <pdfPath> [--all] [--json]
//   --all   also print the Moves-scope and standard-section hits that are
//           filtered out of the headline list.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBody,
  inlineOptionGroups,
  isGlyphBullet,
  loadPageItems,
  openDocument,
  textOfPlainRun,
} from "./lib-move-body.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const showAll = args.includes("--all");
const pdfPath = args.filter((a) => !a.startsWith("--"))[0];
if (!pdfPath) {
  console.error("Usage: node sweep-inline-picks.mjs <pdfPath> [--all] [--json]");
  process.exit(1);
}

// Column detection. A first attempt used a single gap threshold on the
// line-start x histogram; that merged The Forged's page-23 columns 2 and 3
// (their nearest line starts are only ~120pt apart because column 2 has a
// two-sub-column tag layout at x=412), which then mis-attributed a Moves
// hold-spend list to the "Burdens" heading. Caught by checking a
// suspicious hit against the source, not by trusting the first run.
// Two-stage instead: cluster line starts on a small gap (sub-indents and
// all), then start a NEW column only when a cluster begins at least
// COLUMN_MIN_PITCH to the right of the current column's own origin. The
// real grid pitch is ~248pt (origins ~36 / ~284 / ~532), so 180 separates
// columns while folding every within-column indent back into its parent.
const CLUSTER_GAP = 40;
const COLUMN_MIN_PITCH = 180;
const BULLET_TOLERANCE = 6;

// A roll-outcome or hold-spend framing means the list is chosen fresh
// every time the move/option triggers in play, not once at character
// creation — the exact distinction custom-moves-ideation.md Q1 settled as
// "prose only". Crooked's Burglar ("On a 10+ pick three, on a 7-9 pick
// two: ...") and Fixer ("On a 7-9 ... Pick one: you owe them; ...") both
// look like textbook picks until you read the sentence around them.
const IN_PLAY_CUE = /\bon a (10\+|10 or more|7[-–—]9|miss)\b|\bspend (?:\d+ |your )?hold\b|\bhold \d\b|\bthe keeper chooses\b/i;

// Standard character-sheet blocks identified by their own instruction
// rather than by the bold heading above them. Needed because on a back
// page the Look/Ratings/History blocks sit under whatever bespoke heading
// happens to precede them in the same column — Look would otherwise be
// reported 28 times as a "Sect" / "Weapon (pick one):" / "Your Special
// Weapon" candidate. These are real inline option lists; they are simply
// not bespoke-ruleset content.
const STANDARD_INSTRUCTION =
  /\blook,?\s*pick one from each list\b|\bratings,?\s*pick one line\b|\bpick an improvement from the following list\b|\bfor each (?:of the )?other hunters?\b|\bwhen it.s your turn\b|\bon your turn\b/i;

// Standard character-sheet furniture that is not bespoke-ruleset content.
// Hits under these headings are reported separately rather than dropped —
// "confirmed none here" is a real result in this project, and silently
// discarding a bucket would hide it.
const STANDARD_SECTIONS = new Set(
  [
    "gear",
    "getting started",
    "introductions",
    "history",
    "leveling up",
    "improvements",
    "advanced improvements",
    "ratings",
    "harm",
    "luck",
    "experience",
    "moves",
    "basic moves",
    "the basic moves",
    "get everyone together",
    "sessions",
    "hunter type",
    "look",
    "look, pick one from each list",
    "team",
    "team concept",
  ].map((s) => s.toLowerCase())
);

// Split a bare run on "," / ";" at parenthesis depth 0. Used only for the
// bullet-line shape below, where the run has no colon of its own to anchor
// the library's own scanner on.
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || ch === ";")) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((t) => t.replace(/^(?:or|and)\s+/i, "").trim()).filter(Boolean);
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Confidence read. Deliberately conservative about calling something real:
// a pick verb WITH an explicit count, splitting into short label-shaped
// options, is what an authored `BespokeOption` set actually looks like.
// Long sentence-shaped "options" are almost always ordinary prose that
// happens to contain a colon and commas.
function cleanOption(s) {
  // Presentation-only tidy-up for the report. The extractor's own `raw` is
  // left verbatim; this just strips the stray quote marks a run like
  // The Chosen's `add "steel," "cold iron," "silver,"` leaves on each
  // fragment when the source puts its commas INSIDE the quotes.
  return s
    .replace(/^[\s"'“”‘’,;.]+/, "")
    .replace(/[\s"'“”‘’,;]+$/, "")
    .trim();
}

function scoreCandidate(group) {
  const opts = group.options.map((o) => cleanOption(o.raw)).filter(Boolean);
  const lengths = opts.map((o) => o.length);
  const med = median(lengths);
  const longest = lengths.length ? Math.max(...lengths) : 0;
  const sentencey = opts.filter((o) => /\s(you|they|the|and|to|is|are)\s/i.test(o)).length;
  const sentenceRatio = opts.length ? sentencey / opts.length : 1;

  // The pick verb may live in the sentence BEFORE the colon rather than in
  // the clause the instruction-deriver captured — The Snoop's "Crew jobs:"
  // list is introduced two sentences earlier by "Pick a name and job for
  // each." Look at the surrounding context, not just the instruction.
  const verb = group.cueKind === "pick-verb" || /\b(pick|choose|select|decide)\b/i.test(group.precedingContext || "");
  const inPlay = IN_PLAY_CUE.test(group.precedingContext || "") || IN_PLAY_CUE.test(group.instruction || "");

  const reasons = [];
  let confidence;
  if (verb && med <= 45 && sentenceRatio <= 0.34) {
    confidence = "high";
    reasons.push("a pick instruction governs the run", `short label-shaped options (median ${med} chars)`);
  } else if (verb && med <= 80 && sentenceRatio <= 0.6) {
    confidence = "medium";
    reasons.push("a pick instruction governs the run", `option shape is plausible (median ${med} chars)`);
  } else if (verb) {
    confidence = "low";
    reasons.push("has a pick verb, but the split reads as prose rather than options");
  } else if (group.cueKind === "option-shape" && med <= 30) {
    confidence = "medium";
    reasons.push("no pick verb anywhere nearby — matched on option shape alone (short, uniform items)");
  } else {
    confidence = "low";
    reasons.push(`weak cue (${group.cueKind}) and no pick verb in the surrounding sentence`);
  }
  if (longest > 160) reasons.push(`longest 'option' is ${longest} chars — likely a run-on sentence`);

  // An in-play list is a real list, but Q1 settled that it stays prose —
  // so it is never a Phase 5 remodeling candidate however clean the parse
  // looks. Downgraded rather than dropped, and the reason is stated.
  if (inPlay) {
    reasons.unshift(
      "IN-PLAY: the surrounding sentence is roll-outcome or hold-spend framed, so this is chosen fresh each " +
        "time in play, not once at creation (custom-moves-ideation.md Q1 → prose only)"
    );
    if (confidence === "high") confidence = "medium";
  }

  return {
    confidence,
    reasons,
    timing: inPlay ? "in-play (Q1: prose only)" : "creation-time (likely)",
    medianOptionLength: med,
    longestOptionLength: longest,
    cleanOptions: opts,
  };
}

const doc = await openDocument(pdfPath);
const numPages = doc.numPages;

const pageInfo = [];
const hits = [];

for (let p = 1; p <= numPages; p++) {
  const items = await loadPageItems(doc, p);
  if (!items.length) continue;

  // The playbook title is set in the book's display face (3rdMan) on each
  // front page; back pages inherit the previous page's title.
  const titleItem = items.find((it) => /3rdMan/i.test(it.font || "") && /^The\s+\S/.test(it.str) && it.str.length < 32);
  const playbook = titleItem ? titleItem.str.trim() : pageInfo.length ? pageInfo[pageInfo.length - 1].playbook : "(unknown)";

  // --- column detection ------------------------------------------------
  const startXs = [
    ...new Set(items.filter((it) => it.startsLine && it.str.trim() !== "").map((it) => Math.round(it.x))),
  ].sort((a, b) => a - b);
  // Stage 1: cluster line starts (this separates a column's own sub-indents).
  const clusterStarts = [];
  let prev = null;
  for (const x of startXs) {
    if (prev === null || x - prev > CLUSTER_GAP) clusterStarts.push(x);
    prev = x;
  }
  // Stage 2: fold sub-indent clusters back into their parent column.
  const colStarts = [];
  for (const x of clusterStarts) {
    if (!colStarts.length || x - colStarts[colStarts.length - 1] >= COLUMN_MIN_PITCH) colStarts.push(x);
  }

  const columns = colStarts.map((start, i) => ({
    index: i,
    minX: start - 8,
    maxX: i + 1 < colStarts.length ? colStarts[i + 1] - 3 : Infinity,
  }));

  let carriedHeading = null; // last heading of the previous column, for spill-over
  for (const col of columns) {
    const colItems = items.filter((it) => it.x >= col.minX && it.x < col.maxX);
    if (!colItems.length) continue;

    // --- headings: standalone all-bold lines ---------------------------
    const lines = new Map();
    for (const it of colItems) {
      const key = Math.round(it.y * 2) / 2;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(it);
    }
    const headings = [];
    for (const [y, lineItems] of lines) {
      const meaningful = lineItems.filter((it) => it.str.trim() !== "");
      if (!meaningful.length) continue;
      if (!meaningful.every((it) => it.style === "bold" || it.style === "bold-italic")) continue;
      const text = meaningful.map((it) => it.str).join("").replace(/\s+/g, " ").trim();
      if (!text || text.length > 60) continue;
      headings.push({ y, text });
    }
    headings.sort((a, b) => b.y - a.y);

    function headingAbove(y) {
      let best = null;
      for (const h of headings) {
        if (h.y >= y - 1 && (best === null || h.y < best.y)) best = h;
      }
      return best ? { text: best.text, inherited: false } : { text: carriedHeading, inherited: true };
    }

    // --- same segmentation extract-moves.mjs uses ----------------------
    const glyphBullets = colItems.map((it, i) => ({ it, i })).filter(({ it }) => isGlyphBullet(it));
    const topBulletX = glyphBullets.length ? Math.min(...glyphBullets.map((b) => b.it.x)) : null;
    const isTop = (it) => isGlyphBullet(it) && topBulletX !== null && it.x <= topBulletX + BULLET_TOLERANCE;
    const bodyOpts = { isNestedGlyphBullet: (it) => isGlyphBullet(it) && !isTop(it) };
    const bulletIdx = glyphBullets.filter(({ it }) => isTop(it)).map(({ i }) => i);

    const regions = [];
    let lastBulletedHeading = null;
    const introItems = colItems.slice(0, bulletIdx[0] ?? colItems.length);
    let introStart = 0;
    while (
      introStart < introItems.length &&
      (introItems[introStart].style === "bold" || introItems[introStart].style === "bold-italic")
    ) {
      introStart++;
    }
    regions.push({
      container: "(section prose, before any bulleted entry)",
      items: introItems.slice(introStart),
      // Needed so a hit with no y of its own (a bullet-line run) still
      // attributes to the heading above the region rather than falling
      // through to -Infinity and picking the column's bottom-most heading.
      entryY: introItems[introStart]?.y ?? null,
    });

    for (let k = 0; k < bulletIdx.length; k++) {
      const segItems = colItems.slice(bulletIdx[k], bulletIdx[k + 1] ?? colItems.length);
      let i = 0;
      while (i < segItems.length && segItems[i].style === "symbol") i++;
      const titleItems = [];
      while (i < segItems.length && (segItems[i].style === "bold" || segItems[i].style === "bold-italic")) {
        titleItems.push(segItems[i]);
        i++;
      }
      const title = textOfPlainRun(titleItems).replace(/:\s*$/, "").trim();
      const entryY = segItems[0]?.y ?? null;
      const gov = headingAbove(entryY ?? -Infinity);
      if (gov.text && !gov.inherited) lastBulletedHeading = gov.text;
      regions.push({
        container: title || "(untitled bulleted entry)",
        items: segItems.slice(i),
        entryY,
      });
    }

    for (const region of regions) {
      if (!region.items.length) continue;
      const body = buildBody(region.items, bodyOpts);
      const groups = inlineOptionGroups(body.flatTokens, body.lineStartItems, { extraCues: true }).map((g) => ({
        g,
        container: region.container,
      }));

      // Second sweep, one level down: an inline comma-list can live INSIDE
      // a bulleted item rather than in the flat prose around it. The
      // Visitor's Expatriation is the case that proves this matters — its
      // three "lines" are "•" bullets, each of which is itself a 7-option
      // inline run. Found by cross-checking the sweep against an
      // independent `pdftotext -raw` grep, not by inspection.
      for (const bg of body.bulletGroups) {
        for (const opt of bg.options) {
          if (!opt.tokens) continue;
          for (const g of inlineOptionGroups(opt.tokens, [], { extraCues: true })) {
            groups.push({ g, container: `${region.container} › list item: ${opt.title.slice(0, 40)}`, nested: true });
          }
        }
        // Third shape, and the one Expatriation actually is: the colon-
        // bearing INSTRUCTION sits in the prose above the list, and each
        // bullet line is itself a bare comma-separated run with no colon
        // of its own. Neither the flat-prose scan (the run is inside an
        // <li>) nor the scan just above (no colon inside the <li>) sees
        // it. Only fires when the list's own instruction carries a pick
        // cue, so ordinary bulleted option lists aren't re-reported.
        if (!/\b(pick|choose|select)\b/i.test(bg.instruction || "")) continue;
        // Require the SHAPE to hold across the list, not just on one line.
        // Without this the rule fires on any bulleted entry that happens to
        // contain a prose comma series — e.g. The Hex's rote requirement
        // "An expendable component such as sulfur, sage, or incense, which
        // must be burned, blown, or scattered during the casting." Demanding
        // that most lines look the same way is what separates a real
        // multi-line option grid (Expatriation's three culture lines) from
        // one wordy bullet.
        const shaped = bg.options.filter((o) => {
          const parts = splitTopLevel(o.raw);
          if (parts.length < 3) return false;
          const lens = parts.map((s) => s.length).sort((a, b) => a - b);
          return lens[Math.floor(lens.length / 2)] <= 30;
        });
        if (shaped.length < Math.max(2, Math.ceil(bg.options.length * 0.6))) continue;
        for (const opt of shaped) {
          const parts = splitTopLevel(opt.raw);
          groups.push({
            g: {
              presentation: "inline",
              delimiter: opt.raw.includes(";") ? ";" : ",",
              instruction: bg.instruction,
              precedingContext: bg.instruction,
              cueKind: "pick-verb",
              rawRun: opt.raw,
              terminator: "end-of-list-item",
              y: null,
              options: parts.map((p) => ({ raw: p, title: p, descriptionText: "", titleProvenance: "none" })),
            },
            container: `${region.container} › bullet line: ${opt.raw.slice(0, 40)}`,
            nested: true,
          });
        }
      }

      for (const { g, container, nested } of groups) {
        const y = g.y ?? region.entryY ?? null;
        const attributed = headingAbove(y ?? -Infinity);
        const heading = attributed.text || "(no heading in column)";
        const score = scoreCandidate(g);
        const headingKey = heading.replace(/[:(].*$/, "").trim().toLowerCase();
        const isMoves = headingKey === "moves" || headingKey === "basic moves";
        const isStandardByInstruction =
          STANDARD_INSTRUCTION.test(g.instruction || "") || STANDARD_INSTRUCTION.test(g.precedingContext || "");
        hits.push({
          playbook,
          page: p,
          column: col.index + 1,
          columnX: [Math.round(col.minX), col.maxX === Infinity ? null : Math.round(col.maxX)],
          y: y === null ? null : Math.round(y * 10) / 10,
          sectionHeading: heading,
          headingInherited: attributed.inherited,
          container,
          nestedInBulletItem: !!nested,
          scope: isMoves
            ? "moves (Phase 6)"
            : isStandardByInstruction || STANDARD_SECTIONS.has(headingKey)
              ? "standard sheet section"
              : "bespoke (Phase 5)",
          instruction: g.instruction,
          precedingContext: g.precedingContext,
          cueKind: g.cueKind,
          timing: score.timing,
          delimiter: g.delimiter,
          terminator: g.terminator,
          optionCount: g.options.length,
          options: score.cleanOptions,
          optionsVerbatim: g.options.map((o) => o.raw),
          optionTitles: g.options.map((o) => ({
            title: o.title,
            descriptionText: o.descriptionText,
            titleProvenance: o.titleProvenance,
          })),
          sourceText: g.rawRun,
          confidence: score.confidence,
          confidenceReasons: score.reasons,
          medianOptionLength: score.medianOptionLength,
        });
      }
    }

    // What a following column with no heading of its own inherits. NOT
    // simply the bottom-most heading: a column can end with a prose block
    // or tracker that sits BELOW a bulleted list which is what actually
    // continues into the next column. The Curse-eater's page 13 is the
    // case — its column 2 runs Moves (top), then Corruption, then the
    // Consumed Magic tracker (bottom), while column 3 continues the MOVES
    // list. Inheriting the bottom-most heading attributed a Moves hit to
    // "Consumed MagiC (Power, Downside)" and mis-bucketed it as Phase 5
    // bespoke content. Carry the heading governing the last top-level
    // BULLETED entry instead, since that is the flow that spills.
    if (lastBulletedHeading) carriedHeading = lastBulletedHeading;
    else if (headings.length) carriedHeading = headings[headings.length - 1].text;
  }

  pageInfo.push({ page: p, playbook, columns: columns.length });
}

const bespoke = hits.filter((h) => h.scope === "bespoke (Phase 5)");
const movesScope = hits.filter((h) => h.scope === "moves (Phase 6)");
const standard = hits.filter((h) => h.scope === "standard sheet section");

const byConfidence = (list, c) => list.filter((h) => h.confidence === c);
const order = { high: 0, medium: 1, low: 2 };
bespoke.sort((a, b) => order[a.confidence] - order[b.confidence] || a.page - b.page || (b.y ?? 0) - (a.y ?? 0));

const playbooksCovered = [...new Set(pageInfo.map((p) => p.playbook))];

const output = {
  sweep: "Phase 5 bespoke-content inline-pick sweep",
  generatedBy: "tools/pdf-extract/sweep-inline-picks.mjs",
  detectionOnly:
    "Detection and reporting only. Nothing in bespoke-ruleset-catalogue.md or any other doc under " +
    "docs/hunter-playbooks/ was read from or written to by this sweep — every hit below comes from the source " +
    "PDF. Yoshi adjudicates each one.",
  coverage: {
    pagesScanned: numPages,
    playbooksDetected: playbooksCovered.length,
    playbooks: playbooksCovered,
    method:
      "Every page scanned in full. Columns detected per page from the line-start x histogram (110pt gap " +
      "threshold against a ~248pt column pitch). Within each column, the same body/option state machine " +
      "extract-moves.mjs uses (imported from lib-move-body.mjs, not reimplemented) runs over both the bulleted " +
      "segments and the pre-first-bullet prose region. Hits are attributed to the nearest standalone bold " +
      "heading above them, with spill-over from a preceding column on the same page when a column has no " +
      "heading of its own.",
  },
  totals: {
    allHits: hits.length,
    bespokePhase5: bespoke.length,
    bespokeHigh: byConfidence(bespoke, "high").length,
    bespokeMedium: byConfidence(bespoke, "medium").length,
    bespokeLow: byConfidence(bespoke, "low").length,
    bespokeCreationTime: bespoke.filter((h) => h.timing.startsWith("creation-time")).length,
    bespokeInPlay: bespoke.filter((h) => h.timing.startsWith("in-play")).length,
    movesScopePhase6: movesScope.length,
    standardSheetSections: standard.length,
  },
  candidates: bespoke,
  movesScopeHits: movesScope,
  standardSectionHits: standard,
};

const jsonPath = path.join(__dirname, "phase5-inline-pick-sweep.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function card(h, i) {
  return `<section class="cand ${h.confidence}">
<h3>#${i + 1} &mdash; ${esc(h.playbook)} <span class="pg">p${h.page}, col ${h.column}${
    h.y !== null ? `, y&asymp;${h.y}` : ""
  }</span> <span class="conf conf-${h.confidence}">${h.confidence}</span></h3>
<table class="meta">
<tr><th>Section heading</th><td>${esc(h.sectionHeading)}</td></tr>
<tr><th>Containing entry</th><td>${esc(h.container)}</td></tr>
<tr><th>Instruction</th><td><em>${esc(h.instruction)}</em> <span class="dim">(cue: ${esc(h.cueKind)}, delimiter <code>${esc(
    h.delimiter
  )}</code>, terminator <code>${esc(h.terminator)}</code>)</span></td></tr>
<tr><th>Timing</th><td>${esc(h.timing)}</td></tr>
<tr><th>Parsed options</th><td><strong>${h.optionCount}</strong></td></tr>
<tr><th>Why this confidence</th><td>${h.confidenceReasons.map(esc).join("; ")}</td></tr>
</table>
<p class="src"><strong>Source text (verbatim):</strong> ${esc(h.precedingContext)} ${esc(h.sourceText)}</p>
<ol class="opts">
${h.options.map((o) => `<li>${esc(o)}</li>`).join("\n")}
</ol>
</section>`;
}

function compactRow(h) {
  return `<tr><td>${esc(h.playbook)}</td><td>p${h.page}</td><td>${esc(h.sectionHeading)}</td><td>${esc(
    h.container
  )}</td><td>${esc(h.instruction)}</td><td>${h.optionCount}</td><td>${esc(h.confidence)}</td></tr>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Phase 5 bespoke-content inline-pick sweep</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1040px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2.2rem; border-bottom: 1px solid #ccc; }
  h3 { font-size: 1rem; margin-bottom: 0.4rem; }
  .pg { color: #888; font-weight: normal; font-size: 0.85rem; }
  .note { color: #666; font-size: 0.9rem; }
  .cand { border-left: 4px solid #ccc; padding: 0.6rem 0 0.6rem 1rem; margin: 1.2rem 0; }
  .cand.high { border-left-color: #1a7f37; background: #f4fff7; }
  .cand.medium { border-left-color: #d9a441; background: #fffdf5; }
  .cand.low { border-left-color: #bbb; }
  .conf { font-size: 0.72rem; border-radius: 4px; padding: 0 0.4rem; vertical-align: middle; }
  .conf-high { background: #1a7f37; color: #fff; }
  .conf-medium { background: #d9a441; color: #3a2c00; }
  .conf-low { background: #ddd; color: #444; }
  table { border-collapse: collapse; font-size: 0.9rem; }
  table.meta { width: 100%; margin-bottom: 0.5rem; }
  table.meta th { text-align: left; width: 11rem; color: #555; font-weight: 600; vertical-align: top; padding: 0.15rem 0.6rem 0.15rem 0; }
  table.meta td { padding: 0.15rem 0; vertical-align: top; }
  table.grid { width: 100%; }
  table.grid th, table.grid td { border: 1px solid #ddd; padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
  table.grid th { background: #f2f2f2; }
  .src { background: #f7f7f7; padding: 0.6rem 0.8rem; border-radius: 5px; font-size: 0.92rem; }
  ol.opts { margin: 0.4rem 0 0 1.2rem; font-size: 0.92rem; }
  .desc { color: #444; }
  .prov { color: #999; font-size: 0.78rem; }
  .dim { color: #888; font-size: 0.85rem; }
  .totals { background: #eef3ff; border: 1px solid #7a9ac6; padding: 0.8rem 1rem; border-radius: 6px; }
  .totals li { margin: 0.1rem 0; }
</style>
</head>
<body>
<h1>Phase 5 bespoke-content inline-pick sweep</h1>
<p class="note">Generated by tools/pdf-extract/sweep-inline-picks.mjs. <strong>Detection and reporting only</strong> &mdash; nothing under docs/hunter-playbooks/ was read from or written to; every hit comes from the source PDF. Yoshi adjudicates each candidate.</p>

<div class="totals">
<strong>Coverage and totals</strong>
<ul>
<li>${output.coverage.pagesScanned} pages scanned in full, ${output.coverage.playbooksDetected} playbooks detected.</li>
<li><strong>${output.totals.bespokePhase5} Phase 5 bespoke-scope candidates</strong> &mdash; ${output.totals.bespokeHigh} high confidence, ${output.totals.bespokeMedium} medium, ${output.totals.bespokeLow} low.</li>
<li>Of those, ${output.totals.bespokeCreationTime} read as <strong>creation-time</strong> and ${output.totals.bespokeInPlay} as <strong>in-play</strong> (roll-outcome / hold-spend framed &mdash; real lists, but Q1 settled those as prose, so they are not remodeling candidates).</li>
<li>${output.totals.movesScopePhase6} further hits fall under a &ldquo;Moves&rdquo; heading (Phase 6 scope, listed separately below).</li>
<li>${output.totals.standardSheetSections} fall under standard character-sheet sections (Gear, Getting Started, Improvements&hellip;), also listed separately.</li>
</ul>
</div>

<h2>Phase 5 bespoke-scope candidates (${bespoke.length})</h2>
<p class="note">Ordered high &rarr; low confidence. <strong>High</strong> = an explicit pick instruction carrying a count, splitting into short label-shaped options. <strong>Medium</strong> = a real pick instruction but longer/looser options. <strong>Low</strong> = matched on a styled label only, or the split reads as prose. Confidence is my read, not a verdict.</p>
${bespoke.map(card).join("\n")}

<h2>Moves-scope hits (${movesScope.length}) &mdash; Phase 6, not Phase 5</h2>
<p class="note">Listed for completeness so the sweep's own scope filter is auditable. These sit under a &ldquo;Moves&rdquo; heading and belong to the Phase 6 census, not the bespoke catalogue.</p>
<table class="grid"><thead><tr><th>Playbook</th><th>Page</th><th>Heading</th><th>Containing entry</th><th>Instruction</th><th>Opts</th><th>Conf</th></tr></thead><tbody>
${movesScope.map(compactRow).join("\n")}
</tbody></table>

<h2>Standard sheet-section hits (${standard.length})</h2>
<p class="note">Gear lists, Getting Started instructions, Improvements and the like &mdash; furniture, not bespoke rulesets. Shown so &ldquo;nothing here&rdquo; is a checked result rather than an omission.</p>
<table class="grid"><thead><tr><th>Playbook</th><th>Page</th><th>Heading</th><th>Containing entry</th><th>Instruction</th><th>Opts</th><th>Conf</th></tr></thead><tbody>
${standard.map(compactRow).join("\n")}
</tbody></table>
</body>
</html>
`;

const htmlPath = path.join(__dirname, "phase5-inline-pick-sweep.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log("");
console.log(`Scanned ${numPages} pages, ${playbooksCovered.length} playbooks detected.`);
console.log(
  `Hits: ${hits.length} total — ${bespoke.length} bespoke (Phase 5), ${movesScope.length} moves (Phase 6), ` +
    `${standard.length} standard sheet sections.`
);
console.log("");
console.log(
  `Phase 5 candidates by confidence: high=${byConfidence(bespoke, "high").length}, ` +
    `medium=${byConfidence(bespoke, "medium").length}, low=${byConfidence(bespoke, "low").length}`
);
console.log("");
for (const h of bespoke) {
  if (!showAll && h.confidence === "low") continue;
  console.log(
    `[${h.confidence.toUpperCase()}] ${h.playbook} p${h.page} — ${h.sectionHeading} / ${h.container}\n` +
      `        "${h.instruction}" -> ${h.optionCount} options: ${h.options.slice(0, 6).join(" | ")}${
        h.options.length > 6 ? " | …" : ""
      }`
  );
}
if (!showAll) console.log(`\n(${byConfidence(bespoke, "low").length} low-confidence candidates hidden — pass --all)`);
