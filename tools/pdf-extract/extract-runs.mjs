// Extracts bold/italic "runs" (contiguous spans of same-styled text, in
// reading order) from a page range of the Hunter Playbooks PDF, using
// pdf.js's own font resolution rather than any bold/italic heuristic based
// on visual rendering.
//
// How style is detected: each PDF text item references a font by an
// internal id (e.g. "g_d0_f3"). That id is only resolved to the actual
// embedded font (e.g. "WarnockPro-Bold") after pdf.js has processed the
// page's operator list, via `page.commonObjs.get(fontName)`. IMPORTANT:
// this internal id is *not* stable across pages — "g_d0_f3" is bold on one
// page and a symbol font on another — so every item's style must be
// resolved per-page, never cached/hardcoded globally.
//
// This PDF's body font family is Adobe Warnock Pro, with subset names
// suffixed "-Bold" / "-It" / "-Regular"; the classifier below just pattern
// matches on those suffixes off the resolved PostScript name. This is the
// same technique tools like pdfplumber/PyMuPDF effectively rely on
// (embedded font naming), just via pdf.js instead of a Python lib.
//
// Usage:
//   node extract-runs.mjs <pdfPath> <firstPage> <lastPage> [--json] [--minX N] [--maxX N] [--minY N] [--maxY N]
//
// --minX/--maxX: IMPORTANT for multi-column pages (this whole PDF is
// multi-column). Without an x-range filter, runs from an unrelated column
// on the same page (e.g. the character-sheet sidebar's "Harm"/"Luck"
// track labels, which are also bold) can collide with same-worded text in
// the section you actually care about and get spliced in wrongly — verified
// live: "do +2 Harm" in Crooked's Assassin option got a false-positive <b>
// around "Harm" from the unrelated sidebar heading before this filter was
// added. Scoping to the target column's x-range (read off a dump-page.mjs
// run, or pdftotext -layout's own left-to-right column order) avoids it.
//
// --minY/--maxY: the same idea, vertically — needed when two DIFFERENT
// sections share one column's x-range (common in this PDF: a "Moves" list
// often sits directly above a prose section like "Corruption" in the same
// column). Verified live on Curse-eater's Corruption paragraph: an
// unrelated italic "and" from the Moves section above it, same x-range,
// wrongly matched and got spliced into the Corruption paragraph's own
// "...the power it offers you, and the downside..." before a Y bound was
// added. x-scoping alone does not catch this — same column, same x-range,
// different vertical section.
//
// Default output: one line per run: "<page>\t<style>\t<text>"
// --json: array of {page, style, text} objects instead.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
function takeFlag(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
}
const minX = takeFlag("--minX");
const maxX = takeFlag("--maxX");
const minY = takeFlag("--minY");
const maxY = takeFlag("--maxY");
const [pdfPath, firstArg, lastArg] = args.filter((a) => !a.startsWith("--"));

if (!pdfPath || !firstArg || !lastArg) {
  console.error(
    "Usage: node extract-runs.mjs <pdfPath> <firstPage> <lastPage> [--json]"
  );
  process.exit(1);
}
const first = Number(firstArg);
const last = Number(lastArg);

function classifyStyle(resolvedName) {
  if (!resolvedName) return "unknown";
  // Strip the subset tag pdf.js/PDF producers prepend, e.g. "XJUVMI+".
  const name = resolvedName.replace(/^[A-Z]{6}\+/, "");
  if (/FateCoreGlyphs|Glyphs|Symbol|Wingdings|Dingbats/i.test(name)) {
    return "symbol"; // bullet markers / progress-track boxes, not real text
  }
  const isBold = /bold/i.test(name);
  const isItalic = /(italic|-it$|-it-|oblique)/i.test(name);
  if (isBold && isItalic) return "bold-italic";
  if (isBold) return "bold";
  if (isItalic) return "italic";
  return "regular";
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

const runs = [];

for (let p = first; p <= last; p++) {
  const page = await doc.getPage(p);
  await page.getOperatorList(); // forces font objects to resolve into commonObjs
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

  let current = null; // { style, text }
  let pendingLineBreak = false;

  for (const item of textContent.items) {
    if (typeof item.str !== "string") continue;
    const itemX = item.transform?.[4];
    const itemY = item.transform?.[5];
    if (
      item.str !== "" &&
      ((minX !== null && itemX < minX) ||
        (maxX !== null && itemX > maxX) ||
        (minY !== null && itemY < minY) ||
        (maxY !== null && itemY > maxY))
    ) {
      // Out-of-column/out-of-range text: treat like a style change/break so
      // it can't be silently absorbed into an adjacent in-scope run, but
      // don't emit it.
      if (current && (current.style === "bold" || current.style === "italic" || current.style === "bold-italic")) {
        runs.push({ page: p, style: current.style, text: normalize(current.text) });
      }
      current = null;
      continue;
    }
    if (item.str === "") {
      // Zero-width marker item; pdf.js uses this to signal a line
      // transition via hasEOL, carries no text of its own.
      if (item.hasEOL) pendingLineBreak = true;
      continue;
    }

    const style = styleFor(item.fontName);

    if (current && current.style === style) {
      current.text += (pendingLineBreak ? " " : "") + item.str;
    } else {
      if (current && (current.style === "bold" || current.style === "italic" || current.style === "bold-italic")) {
        runs.push({ page: p, style: current.style, text: normalize(current.text) });
      }
      current = { style, text: item.str };
    }
    if (item.hasEOL) pendingLineBreak = true;
    else pendingLineBreak = false;
  }
  if (current && (current.style === "bold" || current.style === "italic" || current.style === "bold-italic")) {
    runs.push({ page: p, style: current.style, text: normalize(current.text) });
  }
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

const filtered = runs.filter((r) => r.text.length > 0);

if (asJson) {
  console.log(JSON.stringify(filtered, null, 2));
} else {
  for (const r of filtered) {
    console.log(`${r.page}\t${r.style}\t${r.text}`);
  }
}
