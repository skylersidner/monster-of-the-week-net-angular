// Extends the extract-runs.mjs technique to a shape extract-runs.mjs alone
// can't produce: a "Moves" list column where each move has a bold title,
// inline bold/italic emphasis in its body, AND (for some moves) a nested
// bulleted roll-result breakdown (10+/7-9/miss) that needs real <ul>/<li>
// structure, not just inline tags.
//
// Two distinct bullet glyphs are in play in this PDF and must not be
// confused:
//   - top-level move bullets: the "b" glyph from the FateCoreGlyphs SYMBOL
//     font (style classifies as "symbol") — marks the start of each move.
//   - nested sub-bullets (roll-result breakdowns): a literal "•" (U+2022)
//     character in the ORDINARY body font (WarnockPro-Regular) — these are
//     real text, not a symbol-font glyph, and must be special-cased by
//     literal character rather than by style.
//
// Usage:
//   node extract-moves.mjs <pdfPath> <page> --minX N --maxX N [--minY N] [--maxY N] [--json]
//
// --minY/--maxY (optional): needed when a column mixes bullet-driven
// title+body entries with OTHER non-bulleted content sandwiched in
// between them (e.g. Covenant's "Type" options are followed by a plain
// "Describe the ally:" lead-in line, itself followed by more bulleted
// content, "Style" tags — without a Y bound, that lead-in line would get
// silently absorbed as trailing body text of the last Type option, since
// segment-splitting only keys off bullet markers). Bound to just the
// item range you actually want; x-scoping alone isn't always enough.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
function takeFlag(name, def = null) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
}
const minX = takeFlag("--minX", -Infinity);
const maxX = takeFlag("--maxX", Infinity);
const minY = takeFlag("--minY", -Infinity);
const maxY = takeFlag("--maxY", Infinity);
const [pdfPath, pageArg] = args.filter((a) => !a.startsWith("--"));

if (!pdfPath || !pageArg) {
  console.error("Usage: node extract-moves.mjs <pdfPath> <page> --minX N --maxX N [--minY N] [--maxY N] [--json]");
  process.exit(1);
}
const pageNum = Number(pageArg);

// Same classifier as extract-runs.mjs — duplicated rather than shared, to
// avoid risking a regression in the already-validated script for this
// second, more experimental pass.
function classifyStyle(resolvedName) {
  if (!resolvedName) return "unknown";
  const name = resolvedName.replace(/^[A-Z]{6}\+/, "");
  if (/FateCoreGlyphs|Glyphs|Symbol|Wingdings|Dingbats/i.test(name)) return "symbol";
  const isBold = /bold/i.test(name);
  const isItalic = /(italic|-it$|-it-|oblique)/i.test(name);
  if (isBold && isItalic) return "bold-italic";
  if (isBold) return "bold";
  if (isItalic) return "italic";
  return "regular";
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(pageNum);
await page.getOperatorList();
const textContent = await page.getTextContent();

const fontStyleCache = new Map();
function styleFor(fontName) {
  if (fontStyleCache.has(fontName)) return fontStyleCache.get(fontName);
  let resolvedName = null;
  try {
    resolvedName = page.commonObjs.get(fontName)?.name ?? null;
  } catch {
    resolvedName = null;
  }
  const style = classifyStyle(resolvedName);
  fontStyleCache.set(fontName, style);
  return style;
}

// Build the ordered, x-scoped, non-empty item list (each item annotated
// with its resolved style and whether it starts a new visual line).
const items = [];
let pendingLineBreak = false;
for (const item of textContent.items) {
  if (typeof item.str !== "string") continue;
  const itemX = item.transform?.[4];
  const itemY = item.transform?.[5];
  if (item.str === "") {
    if (item.hasEOL) pendingLineBreak = true;
    continue;
  }
  if (itemX < minX || itemX > maxX || itemY < minY || itemY > maxY) {
    // Out-of-column text (verified necessary in Crooked's spike: without
    // this, same-page/different-column bold/italic text can text-collide
    // with the section actually being extracted). Y-bound is the same
    // idea applied vertically, for a column that mixes shapes (see the
    // usage comment above).
    pendingLineBreak = pendingLineBreak || !!item.hasEOL;
    continue;
  }
  items.push({ str: item.str, x: itemX, style: styleFor(item.fontName), startsLine: pendingLineBreak });
  pendingLineBreak = !!item.hasEOL;
}

// Split into per-move segments at each top-level ("b" glyph, symbol-font)
// bullet marker. Anything before the first bullet is the section's own
// intro paragraph, not a move.
const bulletIdx = items
  .map((it, i) => (it.style === "symbol" && it.str === "b" ? i : -1))
  .filter((i) => i !== -1);

const introItems = items.slice(0, bulletIdx[0] ?? items.length);
const segments = bulletIdx.map((start, i) => items.slice(start, bulletIdx[i + 1] ?? items.length));

function textOfPlainRun(items) {
  // Plain concatenation preserving the PDF's own inter-word spacing,
  // joining only at line-wrap boundaries (mirrors extract-runs.mjs).
  let out = "";
  for (const it of items) out += (it.startsLine && out ? " " : "") + it.str;
  return normalize(out);
}

function wrapStyle(style, text) {
  const t = escapeHtml(text);
  if (style === "bold") return `<b>${t}</b>`;
  if (style === "italic") return `<i>${t}</i>`;
  if (style === "bold-italic") return `<b><i>${t}</i></b>`;
  return t;
}

// Shared by processMove() (after its own title-stripping) AND, since the
// Pararomantic pass, by the no-top-level-bullet fallback below: walks a
// flat item list, merging same-style runs into inline <b>/<i>, and
// detecting the nested "•" bullet marker (literal character, regular
// style) as a real <ul>/<li> list boundary rather than ordinary prose.
// Extracted out of processMove() rather than duplicated, so both callers
// share one bug surface for this non-trivial state machine.
function buildBodyHtml(bodyItems) {
  const htmlParts = [];
  let inList = false;
  let liBuffer = [];
  let ulBuffer = [];
  let nestedTextX = null;
  let run = null; // { style, text, startsLineHit }

  function flushRun() {
    if (!run) return;
    // Deliberately NOT a blanket .trim(): the single boundary space between
    // two differently-styled adjacent runs can live on either side
    // depending on where the PDF's content stream happened to place the
    // space-only text item (verified both ways in this same move list —
    // "When you" + a separate regular-styled space before bold "protect
    // someone" vs. bold "read a bad situation" itself carrying its own
    // trailing space before regular "to warn..."). Trimming unconditionally
    // silently swallows whichever side owns it. Instead: collapse internal
    // whitespace, then peel off a single leading/trailing space (if any)
    // as its own unstyled token so it survives the style-tag boundary,
    // and wrap only the actual text core in <b>/<i>.
    const collapsed = run.text.replace(/\s+/g, " ");
    const target = inList ? liBuffer : htmlParts;
    if (/^ /.test(collapsed)) target.push(" ");
    const core = collapsed.trim();
    if (core) target.push(wrapStyle(run.style, core));
    if (/ $/.test(collapsed)) target.push(" ");
    run = null;
  }

  function closeLi() {
    if (liBuffer.length) {
      const content = liBuffer.join("").replace(/ {2,}/g, " ").trim();
      if (content) ulBuffer.push(`<li>${content}</li>`);
      liBuffer = [];
    }
  }

  function closeList() {
    closeLi();
    if (ulBuffer.length) {
      htmlParts.push(`<ul>${ulBuffer.join("")}</ul>`);
      ulBuffer = [];
    }
    inList = false;
    nestedTextX = null;
  }

  for (const it of bodyItems) {
    let justClosedList = false;

    if (it.str === "•") {
      // Nested sub-bullet marker — structural, not text.
      flushRun();
      closeLi();
      inList = true;
      continue;
    }

    if (
      inList &&
      it.startsLine &&
      nestedTextX !== null &&
      Math.abs(it.x - nestedTextX) > 8
    ) {
      // A new line that doesn't align with the nested list's own text
      // indent — the roll-result breakdown has ended; resume as ordinary
      // paragraph text after the list. (Verified against this move: after
      // "On a miss, you've offended them." the next paragraph starts ~14pt
      // further left than the list's own text indent.)
      flushRun();
      closeList();
      justClosedList = true;
    }

    if (inList && nestedTextX === null && !it.startsLine) {
      // First real content item right after a bullet marker + its space —
      // record its x as "the list's text indent" for the boundary check
      // above. (The marker's own trailing space item is skipped since it's
      // whitespace-only and normalize() would drop it anyway; capture on
      // the first non-space content.)
      if (it.str.trim() !== "") nestedTextX = it.x;
    }

    // A line-wrap boundary normally needs a synthetic joining space (both
    // branches below) — EXCEPT immediately after closing a <ul>: the block
    // already supplies the visual break, and outputting a literal space
    // right after </ul> just leaves stray whitespace sitting in the stored
    // field for no reason. Suppress only for this one transition.
    const needsSpace = it.startsLine && !justClosedList;

    if (run && run.style === it.style) {
      run.text += (needsSpace ? " " : "") + it.str;
    } else {
      // A style change that happens to land exactly at a line-wrap
      // boundary also needs the joining space — otherwise it's silently
      // lost (real bug, caught on Action Scientist's Physics and Cosmology:
      // "...When you<b>investigate a mystery</b>" with no space, because
      // the space-preservation logic above only fired for same-style
      // continuations across a line wrap, never for the start of a brand
      // new differently-styled run). Prepend it here too; flushRun()'s own
      // leading-space peel-off (below) then carries it through untagged.
      flushRun();
      run = { style: it.style, text: (needsSpace ? " " : "") + it.str };
    }
  }
  flushRun();
  closeList();

  // Safety net: two adjacent runs can each independently contribute a
  // single boundary space (one trailing, one leading) which would produce
  // "word  word" — collapse plain double-spaces (never touches tag syntax,
  // since '<'/'>' are never spaces) and trim the field's own outer edges.
  // Also strip a leading ". " — found on The Expert's Haven options, whose
  // titles are delimited by a period rather than every prior playbook's
  // colon (e.g. "Lore Library. When you hit the books..." vs. "Get
  // Down!: When you protect..."). The title-stripping below already
  // removes a trailing colon that belongs to the title; this is the
  // mirror case — the period belongs to the title as its terminator, not
  // to the description as meaningful leading punctuation, so leaving it
  // in would land a stray ". " at the start of every such description.
  // Also strip a leading ": " — found on The Monstrous's Curses options
  // (Vulnerability/Pure Drive/Dark Master): unlike Feed's title, whose
  // bold run bakes the colon in ("Feed:"), these three have a colon-free
  // bold title ("Vulnerability") followed by a REGULAR-styled run that
  // itself starts with the colon (": Pick a substance..."). Same
  // underlying situation as the period case — the colon delimits the
  // title from the description, it just happens to sit in the wrong
  // run's text this time, in the same source PDF's own Curses section
  // (inconsistent even with its own "Feed:" sibling) — strip it here too
  // rather than adding a third special case per-playbook.
  return htmlParts
    .join("")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/^\.\s+/, "")
    .replace(/^:\s+/, "");
}

function processMove(segItems) {
  let i = 0;
  // Skip the bullet marker glyph + its trailing space (both symbol-styled).
  while (i < segItems.length && segItems[i].style === "symbol") i++;

  // Title = the leading bold/bold-italic run.
  const titleItems = [];
  while (i < segItems.length && (segItems[i].style === "bold" || segItems[i].style === "bold-italic")) {
    titleItems.push(segItems[i]);
    i++;
  }
  const title = textOfPlainRun(titleItems).replace(/:\s*$/, "").trim();

  const descriptionHtml = buildBodyHtml(segItems.slice(i));
  return { title, descriptionHtml };
}

const moves = segments.map(processMove);
// The section's own column heading (e.g. "Moves") is a leading bold run
// ahead of the actual intro sentence — strip it the same way a move's own
// bold title is stripped from its body in processMove(), rather than
// letting it leak into the intro text.
let introStart = 0;
while (introStart < introItems.length && (introItems[introStart].style === "bold" || introItems[introStart].style === "bold-italic")) {
  introStart++;
}
const intro = textOfPlainRun(introItems.slice(introStart));

const result = { page: pageNum, intro, moves };

// Fallback for a column shape found on The Pararomantic's "Bond Abuse"
// text (page 41): flowing prose with real nested "•" bulleted lists (a
// 3-item roll-outcome breakdown AND a separate 4-item consequence list)
// but NO top-level "b"-glyph bulleted entries at all — i.e. bulletIdx is
// empty, so segments/moves above come back empty and intro's plain-text-
// only join() would silently flatten both real lists and every inline
// bold/italic run in the whole column. When that happens, also build a
// single flat HTML block covering the WHOLE column (from the same
// introStart used above, so the column's own standalone heading line is
// excluded the same way, while inline bold like "Bond Abuse:" used as a
// term-definition mid-paragraph is correctly kept) via the same
// nested-list-aware buildBodyHtml() used for each move's own body — this
// is the only way to get real <ul>/<li> structure for a shape like this.
// Never fires for any prior playbook's usage of this script (all of them
// have real top-level bullets, or they wouldn't be using extract-moves.mjs
// over extract-runs.mjs in the first place), so this is purely additive.
if (bulletIdx.length === 0) {
  result.flatBodyHtml = buildBodyHtml(introItems.slice(introStart));
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Intro: ${intro}`);
  for (const m of moves) {
    console.log(`\n${m.title}`);
    console.log(`  ${m.descriptionHtml}`);
  }
}
