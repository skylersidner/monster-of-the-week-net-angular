// Shared, already-validated body/option machinery, factored out of
// extract-moves.mjs during the twentieth pass (the Phase 5 inline-pick
// sweep) so that `sweep-inline-picks.mjs` runs the EXACT same detector
// rather than a second copy that could silently drift from it.
//
// Nothing in here is new logic — every function is verbatim what
// extract-moves.mjs contained, with the one genuine change being that
// buildBody() now takes its nested-glyph-bullet predicate as a parameter
// instead of closing over a module-level one (extract-moves.mjs computes
// that predicate from the leftmost bullet indent in its own scoped
// column; the sweep computes it per column of its own). Regression
// against all 19 prior build scripts' committed outputs was re-verified
// byte-for-byte after the move.
//
// The earlier "duplicated rather than shared, to avoid risking a
// regression in the already-validated script" note on classifyStyle
// applied to a spike with one consumer. There are now two real consumers
// of this state machine and a byte-identical regression suite to catch a
// mistake, so sharing is the safer of the two options, not the riskier.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

export function classifyStyle(resolvedName) {
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

export function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

export function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function wrapStyle(style, text) {
  const t = escapeHtml(text);
  if (style === "bold") return `<b>${t}</b>`;
  if (style === "italic") return `<i>${t}</i>`;
  if (style === "bold-italic") return `<b><i>${t}</i></b>`;
  return t;
}

export function textOfPlainRun(items) {
  // Plain concatenation preserving the PDF's own inter-word spacing,
  // joining only at line-wrap boundaries (mirrors extract-runs.mjs).
  let out = "";
  for (const it of items) out += (it.startsLine && out ? " " : "") + it.str;
  return normalize(out);
}

// Open a document once and reuse it across pages — the sweep reads all 58
// pages and re-parsing the file per page is the difference between a
// few seconds and a few minutes.
export async function openDocument(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  return getDocument({ data, useSystemFonts: true }).promise;
}

// The ordered, x/y-scoped, non-empty item list every script in this
// toolkit works from: each item annotated with its resolved style and
// whether it starts a new visual line. Style resolution requires
// getOperatorList() to have run for the page first — calling
// commonObjs.get() straight off getTextContent() returns null.
export async function loadPageItems(doc, pageNum, bounds = {}) {
  const {
    minX = -Infinity,
    maxX = Infinity,
    minY = -Infinity,
    maxY = Infinity,
  } = bounds;
  const page = await doc.getPage(pageNum);
  await page.getOperatorList();
  const textContent = await page.getTextContent();

  const fontCache = new Map();
  function fontFor(fontName) {
    if (fontCache.has(fontName)) return fontCache.get(fontName);
    let resolvedName = null;
    try {
      resolvedName = page.commonObjs.get(fontName)?.name ?? null;
    } catch {
      resolvedName = null;
    }
    const entry = { font: resolvedName, style: classifyStyle(resolvedName) };
    fontCache.set(fontName, entry);
    return entry;
  }

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
      // idea applied vertically, for a column that mixes shapes.
      pendingLineBreak = pendingLineBreak || !!item.hasEOL;
      continue;
    }
    const resolved = fontFor(item.fontName);
    items.push({
      str: item.str,
      x: itemX,
      y: itemY,
      style: resolved.style,
      font: resolved.font,
      startsLine: pendingLineBreak,
    });
    pendingLineBreak = !!item.hasEOL;
  }
  return items;
}

// A FateCoreGlyphs bullet marker — lowercase "b" for an optional entry,
// capital "B" for a Required one.
export function isGlyphBullet(it) {
  return it.style === "symbol" && (it.str === "b" || it.str === "B");
}

// ---------------------------------------------------------------------------
// Token helpers. buildBody() emits, alongside the HTML string it has always
// produced, a parallel flat token stream ({style, text}) for the SAME
// content. Tokens are already space-peeled by flushRun(), so a token is
// either the literal string " " or a trimmed, styled text core — which
// makes plain-text offsets and HTML re-emission trivially consistent with
// each other. Every option-level split below is done by offset over that
// token stream rather than by string surgery on the finished HTML, so a
// <b> span that happens to sit inside one option can never be cut in half.
// ---------------------------------------------------------------------------

export function tokensPlain(tokens) {
  return tokens.map((t) => t.text).join("");
}

export function tokensHtml(tokens) {
  return tokens
    .map((t) => (t.text === " " ? " " : wrapStyle(t.style, t.text)))
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function sliceTokens(tokens, start, end) {
  const out = [];
  let offset = 0;
  for (const t of tokens) {
    const tStart = offset;
    const tEnd = offset + t.text.length;
    offset = tEnd;
    if (tEnd <= start || tStart >= end) continue;
    const text = t.text.slice(Math.max(0, start - tStart), Math.min(t.text.length, end - tStart));
    if (text !== "") out.push({ style: t.style, text });
  }
  return out;
}

// Trim whitespace-only tokens off both ends, so a slice taken at a
// delimiter boundary doesn't carry the delimiter's own padding.
export function trimTokens(tokens) {
  let a = 0;
  let b = tokens.length;
  while (a < b && tokens[a].text.trim() === "") a++;
  while (b > a && tokens[b - 1].text.trim() === "") b--;
  const out = tokens.slice(a, b);
  if (out.length) {
    out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, "") };
    out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.replace(/\s+$/, "") };
  }
  return out.filter((t) => t.text !== "");
}

// The one and only Title/DescriptionText split available for in-move
// option content: delimiter-derived, never font-confirmed. Returns the
// split plus an explicit provenance so the lower confidence is carried in
// the data.
export function splitOptionTitle(tokens) {
  const plain = tokensPlain(tokens);
  const colon = plain.match(/^([^:(]{1,60}?):\s+(\S[\s\S]*)$/);
  if (colon) {
    const cut = colon[1].length;
    return {
      title: colon[1].trim(),
      titleProvenance: "delimiter:colon",
      titleTokens: trimTokens(sliceTokens(tokens, 0, cut)),
      descriptionTokens: trimTokens(sliceTokens(tokens, cut + 1, plain.length)),
    };
  }
  const paren = plain.match(/^([^(]{1,60}?)\s*\(([\s\S]+)\)[.\s]*$/);
  if (paren) {
    const cut = paren[1].length;
    const openAt = plain.indexOf("(", cut);
    const closeAt = plain.lastIndexOf(")");
    return {
      title: paren[1].trim(),
      titleProvenance: "delimiter:paren",
      titleTokens: trimTokens(sliceTokens(tokens, 0, cut)),
      descriptionTokens: trimTokens(sliceTokens(tokens, openAt + 1, closeAt)),
    };
  }
  return {
    title: plain.trim(),
    titleProvenance: "none",
    titleTokens: trimTokens(tokens),
    descriptionTokens: [],
  };
}

// Whether the title run carries a font signal of its own. Measured, not
// assumed — see extract-moves.mjs's header comment for why.
export function titleStyleOf(tokens) {
  const styles = [...new Set(tokens.filter((t) => t.text.trim() !== "").map((t) => t.style))];
  if (styles.length === 0) return "empty";
  if (styles.length > 1) return "mixed";
  return styles[0];
}

export function makeOption(tokens) {
  const trimmed = trimTokens(tokens);
  const split = splitOptionTitle(trimmed);
  const titleStyle = titleStyleOf(split.titleTokens);
  const option = {
    raw: tokensPlain(trimmed),
    rawHtml: tokensHtml(trimmed),
    title: split.title,
    titleHtml: tokensHtml(split.titleTokens),
    descriptionText: tokensPlain(split.descriptionTokens),
    descriptionHtml: tokensHtml(split.descriptionTokens),
    titleProvenance: split.titleProvenance,
    titleStyle,
    titleFontCorroborated: titleStyle === "bold" || titleStyle === "bold-italic" || titleStyle === "italic",
  };
  // The option's own token stream, kept for callers that need to re-scan
  // INSIDE a list item (the Phase 5 sweep does: The Visitor's Expatriation
  // presents three inline comma-lists as three "•" lines, so the option
  // run lives one level down from the flat prose the inline detector
  // normally sees). Non-enumerable so it never lands in any JSON output.
  Object.defineProperty(option, "tokens", { value: trimmed, enumerable: false });
  return option;
}

// The instruction that introduces an option list — the trailing clause
// ending in a colon ("Pick one:", "Then pick two of these:", "Choose its
// type:"). Purely textual; reported so the author can see what the list
// was actually attached to rather than inferring it.
export function deriveInstruction(plainSoFar) {
  const m = plainSoFar.match(/([^.;]{0,160}:)\s*$/);
  return m ? m[1].trim() : "";
}

// Walks a flat item list, merging same-style runs into inline <b>/<i>, and
// detecting nested bullet markers (either the literal "•" character or an
// indented FateCoreGlyphs "b"/"B", per the caller-supplied predicate) as a
// real <ul>/<li> list boundary rather than ordinary prose.
//
// Returns { html, flatTokens, lineStartItems, bulletGroups }: `html` is
// exactly what this function has always returned; everything else is
// additive.
export function buildBody(bodyItems, { isNestedGlyphBullet = () => false } = {}) {
  const htmlParts = [];
  const flatTokens = [];
  const lineStartItems = [];
  const bulletGroups = [];
  let inList = false;
  let liBuffer = [];
  let liTokens = [];
  let ulBuffer = [];
  let ulOptions = [];
  let listMarkerKind = null;
  let listInstruction = "";
  let nestedTextX = null;
  let run = null; // { style, text }

  function flushRun() {
    if (!run) return;
    // Deliberately NOT a blanket .trim(): the single boundary space between
    // two differently-styled adjacent runs can live on either side
    // depending on where the PDF's content stream happened to place the
    // space-only text item. Trimming unconditionally silently swallows
    // whichever side owns it. Instead: collapse internal whitespace, then
    // peel off a single leading/trailing space (if any) as its own
    // unstyled token so it survives the style-tag boundary, and wrap only
    // the actual text core in <b>/<i>.
    const collapsed = run.text.replace(/\s+/g, " ");
    const target = inList ? liBuffer : htmlParts;
    const tokenTarget = inList ? liTokens : flatTokens;
    if (/^ /.test(collapsed)) {
      target.push(" ");
      tokenTarget.push({ style: "regular", text: " " });
    }
    const core = collapsed.trim();
    if (core) {
      target.push(wrapStyle(run.style, core));
      tokenTarget.push({ style: run.style, text: core });
    }
    if (/ $/.test(collapsed)) {
      target.push(" ");
      tokenTarget.push({ style: "regular", text: " " });
    }
    run = null;
  }

  function closeLi() {
    if (liBuffer.length) {
      const content = liBuffer.join("").replace(/ {2,}/g, " ").trim();
      if (content) {
        ulBuffer.push(`<li>${content}</li>`);
        ulOptions.push(makeOption(liTokens));
      }
      liBuffer = [];
      liTokens = [];
    }
  }

  function closeList() {
    closeLi();
    if (ulBuffer.length) {
      htmlParts.push(`<ul>${ulBuffer.join("")}</ul>`);
      if (ulOptions.length) {
        bulletGroups.push({
          presentation: "bulleted",
          markerKind: listMarkerKind,
          delimiter: null,
          instruction: listInstruction,
          options: ulOptions,
        });
      }
      ulBuffer = [];
      ulOptions = [];
    }
    inList = false;
    listMarkerKind = null;
    nestedTextX = null;
  }

  for (const it of bodyItems) {
    let justClosedList = false;

    const nestedMarker = it.str === "•" ? "bullet-char" : isNestedGlyphBullet(it) ? "glyph" : null;
    if (nestedMarker) {
      // Nested sub-bullet marker — structural, not text.
      flushRun();
      closeLi();
      if (!inList) {
        listMarkerKind = nestedMarker;
        listInstruction = deriveInstruction(tokensPlain(flatTokens));
      }
      inList = true;
      continue;
    }

    if (inList && it.startsLine && nestedTextX !== null && Math.abs(it.x - nestedTextX) > 8) {
      // A new line that doesn't align with the nested list's own text
      // indent — the breakdown has ended; resume as ordinary paragraph
      // text after the list.
      flushRun();
      closeList();
      justClosedList = true;
    }

    if (inList && nestedTextX === null && !it.startsLine) {
      // First real content item right after a bullet marker + its space —
      // record its x as "the list's text indent" for the boundary check
      // above.
      if (it.str.trim() !== "") nestedTextX = it.x;
    }

    if (!inList && it.startsLine && it.str.trim() !== "") {
      lineStartItems.push({ x: it.x, y: it.y, str: it.str });
    }

    // A line-wrap boundary normally needs a synthetic joining space (both
    // branches below) — EXCEPT immediately after closing a <ul>: the block
    // already supplies the visual break.
    const needsSpace = it.startsLine && !justClosedList;

    if (run && run.style === it.style) {
      run.text += (needsSpace ? " " : "") + it.str;
    } else {
      // A style change that happens to land exactly at a line-wrap
      // boundary also needs the joining space — otherwise it's silently
      // lost (real bug, caught on Action Scientist's Physics and
      // Cosmology). Prepend it here too; flushRun()'s own leading-space
      // peel-off then carries it through untagged.
      flushRun();
      run = { style: it.style, text: (needsSpace ? " " : "") + it.str };
    }
  }
  flushRun();
  closeList();

  // Safety net: two adjacent runs can each independently contribute a
  // single boundary space (one trailing, one leading) which would produce
  // "word  word" — collapse plain double-spaces and trim the field's own
  // outer edges. Also strip a leading ". " (The Expert's Haven delimits
  // option titles with a period rather than a colon) and a leading ": "
  // (The Monstrous's Curses have a colon-free bold title followed by a
  // regular run that itself starts with the colon).
  const html = htmlParts
    .join("")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/^\.\s+/, "")
    .replace(/^:\s+/, "");

  return { html, flatTokens, lineStartItems, bulletGroups };
}

// ---------------------------------------------------------------------------
// Inline option runs.
//
// Finds a colon at parenthesis depth 0, splits the following run on "," or
// ";" at depth 0, and terminates on either a depth-0 "." or a DEDENT (a
// later line starting more than 8pt left of the run's own first line) —
// the latter only when the run itself begins a line.
// ---------------------------------------------------------------------------

export const PICK_CUE = /\b(pick|choose|select|one of|from the following|as well as)\b/i;

// Style of the last non-space token ending at `offset` — used to spot the
// "Good things:" / "Bad things:" shape, where the introducer carries no
// pick verb of its own but IS a styled label.
export function tokenStyleEndingAt(tokens, offset) {
  let o = 0;
  let last = null;
  for (const t of tokens) {
    const start = o;
    o += t.text.length;
    if (o <= offset && t.text.trim() !== "") last = t.style;
    if (start >= offset) break;
  }
  return last;
}

// True if `s` contains a colon outside any parentheses. Used to prefer the
// INNERMOST introducer when a sentence nests one inside another — The
// Chosen's Special Weapon reads "Material (choose 1): Finally, pick what
// material the business-end is made from: add "steel," "cold iron," ..."
// and anchoring on the first colon splits the wrong sentence.
function hasDepth0Colon(s) {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ":" && depth === 0) return true;
  }
  return false;
}

// `extraCues` (sweep-only, default OFF so extract-moves.mjs's behaviour is
// untouched): also accept a run purely on its SHAPE — four or more short,
// label-like items — when no pick verb and no styled label introduces it.
// The Snoop's "Crew jobs: camera, sound, editing, ..." is the case that
// needs it; a book-wide sweep would rather over-report and let a human
// filter than miss a real option list because its sentence phrasing is
// unusual.
export function inlineOptionGroups(flatTokens, lineStartItems, { extraCues = false } = {}) {
  const plain = tokensPlain(flatTokens);
  const groups = [];
  if (!plain) return groups;

  // Resolve each line-starting item to an offset in `plain` with a
  // forward-only cursor (the items are long and distinctive, and they are
  // visited in document order, so this is unambiguous in practice).
  const lineStarts = [];
  let cursor = 0;
  for (const ls of lineStartItems) {
    const needle = ls.str.trim();
    if (!needle) continue;
    const at = plain.indexOf(needle, cursor);
    if (at === -1) continue;
    lineStarts.push({ offset: at, x: ls.x, y: ls.y });
    cursor = at + 1;
  }

  let searchFrom = 0;
  while (true) {
    // Find the next colon at paren depth 0.
    let depth = 0;
    let colon = -1;
    for (let i = searchFrom; i < plain.length; i++) {
      const ch = plain[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (ch === ":" && depth === 0) {
        colon = i;
        break;
      }
    }
    if (colon === -1) break;
    searchFrom = colon + 1;

    let runStart = colon + 1;
    while (runStart < plain.length && /\s/.test(plain[runStart])) runStart++;
    if (runStart >= plain.length) break;

    // Does the run begin a line of its own? (Gates the dedent terminator.)
    const runLine = lineStarts.find((l) => l.offset === runStart);
    const runLineX = runLine ? runLine.x : null;

    // Scan forward for delimiters and the terminator.
    depth = 0;
    let end = plain.length;
    const cuts = [];
    let semis = 0;
    let commas = 0;
    for (let i = runStart; i < plain.length; i++) {
      if (runLineX !== null) {
        const ls = lineStarts.find((l) => l.offset === i);
        if (ls && i > runStart && ls.x < runLineX - 8) {
          end = i;
          break;
        }
      }
      const ch = plain[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === "." || ch === "?" || ch === "!")) {
        // Sentence end. "?" and "!" are terminators for the same reason
        // "." is — The Professional's Agency framing list ends "…or
        // something else?" and would otherwise run on into the next
        // sentence.
        end = i;
        break;
      } else if (depth === 0 && (ch === "," || ch === ";")) {
        cuts.push({ at: i, ch });
        if (ch === ";") semis++;
        else commas++;
      }
    }

    const delimiter = semis > 0 ? ";" : ",";
    const effectiveCuts = cuts.filter((c) => c.ch === delimiter && c.at < end);
    if (effectiveCuts.length < 2) continue; // fewer than 3 options — not a list

    // Prefer the innermost introducer: if the run this colon opens itself
    // contains another depth-0 colon, this colon is not the one the option
    // list hangs off. Skip it and let the inner one be tried next.
    if (hasDepth0Colon(plain.slice(runStart, end))) continue;

    const instruction = deriveInstruction(plain.slice(0, colon + 1));
    const precedingContext = plain.slice(Math.max(0, colon - 220), colon + 1).trim();
    const labelToken = tokenStyleEndingAt(flatTokens, colon);
    const bounds = [runStart, ...effectiveCuts.map((c) => c.at), end];
    const rawSpans = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      rawSpans.push(plain.slice(k === 0 ? bounds[0] : bounds[k] + 1, bounds[k + 1]).trim());
    }
    const lens = rawSpans.map((s) => s.length).sort((a, b) => a - b);
    const medLen = lens.length ? lens[Math.floor(lens.length / 2)] : Infinity;

    const cueKind = PICK_CUE.test(instruction)
      ? "pick-verb"
      : labelToken && labelToken !== "regular"
        ? "styled-label"
        : extraCues && rawSpans.length >= 4 && medLen <= 30
          ? "option-shape"
          : null;
    if (!cueKind) continue;

    const options = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = k === 0 ? bounds[0] : bounds[k] + 1;
      const b = bounds[k + 1];
      let optTokens = trimTokens(sliceTokens(flatTokens, a, b));
      if (!optTokens.length) continue;
      // "..., or something else" / "..., and X" — the conjunction belongs
      // to the sentence, not to the option's own name.
      const first = optTokens[0];
      const stripped = first.text.replace(/^(?:or|and)\s+/i, "");
      if (stripped !== first.text) optTokens = [{ ...first, text: stripped }, ...optTokens.slice(1)];
      options.push(makeOption(optTokens));
    }
    if (options.length < 3) continue;

    // Approximate page y of the run — the y of the nearest line start at
    // or before it. Used by the sweep to attribute a hit to the section
    // heading above it; not used by extract-moves.mjs.
    let y = null;
    for (const l of lineStarts) {
      if (l.offset <= runStart) y = l.y;
      else break;
    }

    groups.push({
      presentation: "inline",
      markerKind: null,
      delimiter,
      instruction,
      precedingContext,
      cueKind,
      rawRun: plain.slice(runStart, end).trim(),
      terminator: end < plain.length ? (plain[end] === "." ? "sentence-period" : "dedent") : "end-of-block",
      y,
      options,
    });
    searchFrom = end;
  }
  return groups;
}
