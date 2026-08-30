// Extends the extract-runs.mjs technique to a shape extract-runs.mjs alone
// can't produce: a "Moves" list column where each move has a bold title,
// inline bold/italic emphasis in its body, AND (for some moves) a nested
// bulleted roll-result breakdown (10+/7-9/miss) that needs real <ul>/<li>
// structure, not just inline tags.
//
// The body/option state machine itself now lives in `lib-move-body.mjs`,
// shared verbatim with `sweep-inline-picks.mjs` so the two can't drift.
// This file owns argument handling, bullet/segment logic and output shape.
//
// THREE bullet markers are in play in this PDF and must not be confused
// (the third was found during the Phase 6 custom-moves tooling pass):
//   - top-level move bullets: the "b" glyph from the FateCoreGlyphs SYMBOL
//     font (style classifies as "symbol") — marks the start of each move.
//     A CAPITAL "B" in the same symbol font is the same marker for a
//     REQUIRED move (verified across every playbook front page: Changeling's
//     Glamour, Gumshoe's Occult Confidential + The Naked City, Host's
//     Defensive Adaptation, Searcher's First Encounter, Forged's Partner,
//     Spell-Slinger's Tools and Techniques, the Professional's unnamed
//     Agency move — all Required, all "B"). Until this pass the extractor
//     only recognised "b", so every Required move's whole body was silently
//     absorbed into the preceding segment (or into `intro`, when it came
//     first). Both are now bullets; the glyph's case is reported as
//     `required` instead of being thrown away.
//   - nested sub-bullets: a literal "•" (U+2022) character in the ORDINARY
//     body font (WarnockPro-Regular) — real text, not a symbol-font glyph,
//     special-cased by literal character rather than by style.
//   - nested sub-bullets, second form: the SAME FateCoreGlyphs "b" glyph as
//     a top-level move bullet, but INDENTED further right (Host p31's
//     Defensive Adaptation options sit at x=521.2 under a move bullet at
//     x=503.2; Searcher p45's First Encounter, Visitor p55's Something
//     Strange and Forged p23's Partner are the same shape). These are
//     distinguished from top-level bullets ONLY by x-indent — see
//     `topBulletX` below. Before this pass they were mis-split as sibling
//     top-level moves.
//     NOTE, checked rather than assumed: the marker does NOT tell you
//     whether a list is a creation-time pick or an in-play menu. Spell-
//     Slinger's Tools and Techniques (a creation-time pick) uses "•", and
//     Could've Been Worse (in-play) uses "•" too. Both forms are reported;
//     the author decides which is which.
//
// Usage:
//   node extract-moves.mjs <pdfPath> <page> --minX N --maxX N [--minY N] [--maxY N]
//                          [--options] [--topBulletX N] [--bulletTolerance N] [--json]
//
// --minY/--maxY (optional): needed when a column mixes bullet-driven
// title+body entries with OTHER non-bulleted content sandwiched in
// between them (e.g. Covenant's "Type" options are followed by a plain
// "Describe the ally:" lead-in line, itself followed by more bulleted
// content, "Style" tags — without a Y bound, that lead-in line would get
// silently absorbed as trailing body text of the last Type option, since
// segment-splitting only keys off bullet markers). Bound to just the
// item range you actually want; x-scoping alone isn't always enough.
//
// --options (optional, ADDITIVE — off by default so every pre-Phase-6
// invocation's output is byte-identical): adds `required` and
// `optionGroups` to each move, plus `introHeading`/`introOptionGroups`
// for the pre-first-bullet region. `optionGroups` covers BOTH
// presentations:
//   * "bulleted"  — a nested list inside the move (either marker form).
//   * "inline"    — a comma- or semicolon-separated run introduced by a
//                   colon, with no bullets at all. Six of Phase 6's
//                   fourteen in-scope moves are this shape (Crooked's
//                   Artifact and Deal with the Devil, Changeling's Force of
//                   Nature, Gumshoe's The Naked City, Professional's
//                   Mobility, Searcher's Guardian) and the extractor
//                   returned nothing structural for them at all before
//                   this pass — silently, which was the dangerous part.
// When --options is NOT passed but inline candidates ARE detected, a
// warning is printed to stderr, so the silent-nothing failure mode can't
// recur even for a caller that forgets the flag.
//
// --topBulletX / --bulletTolerance (optional): override the automatic
// top-level-bullet indent detection. By default the leftmost glyph bullet
// in scope defines the top level and anything more than `--bulletTolerance`
// (default 6pt) to the right of it is a nested option bullet. Pin
// --topBulletX explicitly if a Y/X bound happens to clip a column so that
// the leftmost bullet in scope is NOT actually a top-level one.
//
// TITLE PROVENANCE. Every in-move option's Title/DescriptionText split
// produced here is DELIMITER-derived (colon or parenthesis), never
// font-derived, and each option carries an explicit `titleProvenance`
// ("delimiter:colon" / "delimiter:paren" / "none") so that is visible in
// the data rather than being an authoring convention someone has to
// remember. Two things worth knowing before trusting it:
//   * "delimiter:paren" ALWAYS needs review. Gumshoe's The Naked City
//     contains "Criminals (organised)" and "Police (local)", where the
//     parenthetical is part of the NAME; Crooked's Artifact has
//     "Protective amulet (1-armour magic recharge)", where it is the
//     description. Same shape, opposite meaning — a real counterexample
//     pair found in this pass, not theorised.
//   * `titleStyle`/`titleFontCorroborated` report whether the source
//     independently styles the title run. custom-moves-ideation.md §2.5(a)
//     expected regular weight EVERYWHERE in this content class ("not an
//     exception, the rule"). That is NOT universally true: The Searcher's
//     First Encounter (p45) has genuinely BOLD option names, verified
//     against the raw item stream. The doc's rule holds for the two cases
//     it checked (Crooked p11, Host p31) and for most others, but it is
//     not safe as a blanket assumption — so it is measured per option
//     here instead of assumed.

import {
  buildBody,
  inlineOptionGroups,
  isGlyphBullet,
  loadPageItems,
  openDocument,
  textOfPlainRun,
} from "./lib-move-body.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const withOptions = args.includes("--options");
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
const topBulletXFlag = takeFlag("--topBulletX", null);
const bulletTolerance = takeFlag("--bulletTolerance", 6);
const [pdfPath, pageArg] = args.filter((a) => !a.startsWith("--"));

if (!pdfPath || !pageArg) {
  console.error(
    "Usage: node extract-moves.mjs <pdfPath> <page> --minX N --maxX N [--minY N] [--maxY N] [--options] [--topBulletX N] [--bulletTolerance N] [--json]"
  );
  process.exit(1);
}
const pageNum = Number(pageArg);

const doc = await openDocument(pdfPath);
const items = await loadPageItems(doc, pageNum, { minX, maxX, minY, maxY });

// Top-level bullets vs. nested option bullets are the SAME glyph and are
// separated only by x-indent. The leftmost bullet in scope defines the top
// level; anything further right than the tolerance is a nested marker.
// (When a column has only one indent level — every pre-Phase-6 invocation
// of this script — every bullet is within tolerance of the minimum, so
// this reduces exactly to the previous behaviour.)
const glyphBullets = items.map((it, i) => ({ it, i })).filter(({ it }) => isGlyphBullet(it));
const topBulletX =
  topBulletXFlag !== null
    ? topBulletXFlag
    : glyphBullets.length
      ? Math.min(...glyphBullets.map((b) => b.it.x))
      : null;
function isTopLevelBullet(it) {
  return isGlyphBullet(it) && topBulletX !== null && it.x <= topBulletX + bulletTolerance;
}
function isNestedGlyphBullet(it) {
  return isGlyphBullet(it) && !isTopLevelBullet(it);
}
const bodyOpts = { isNestedGlyphBullet };

const bulletIdx = glyphBullets.filter(({ it }) => isTopLevelBullet(it)).map(({ i }) => i);

const introItems = items.slice(0, bulletIdx[0] ?? items.length);
const segments = bulletIdx.map((start, i) => items.slice(start, bulletIdx[i + 1] ?? items.length));

function processMove(segItems) {
  let i = 0;
  // Skip the bullet marker glyph + its trailing space (both symbol-styled).
  const marker = segItems[0] && isGlyphBullet(segItems[0]) ? segItems[0].str : null;
  while (i < segItems.length && segItems[i].style === "symbol") i++;

  // Title = the leading bold/bold-italic run.
  const titleItems = [];
  while (i < segItems.length && (segItems[i].style === "bold" || segItems[i].style === "bold-italic")) {
    titleItems.push(segItems[i]);
    i++;
  }
  const title = textOfPlainRun(titleItems).replace(/:\s*$/, "").trim();

  const body = buildBody(segItems.slice(i), bodyOpts);
  const move = { title, descriptionHtml: body.html };
  move._optionGroups = [...body.bulletGroups, ...inlineOptionGroups(body.flatTokens, body.lineStartItems)];
  // "B" marks a Required move, "b" an optional one — see the header
  // comment. Reported, not inferred from position.
  move._required = marker === "B";
  move._y = segItems[0]?.y ?? null;
  return move;
}

const rawMoves = segments.map(processMove);
const moves = rawMoves.map((m) =>
  withOptions
    ? {
        title: m.title,
        required: m._required,
        y: m._y,
        descriptionHtml: m.descriptionHtml,
        optionGroups: m._optionGroups,
      }
    : { title: m.title, descriptionHtml: m.descriptionHtml }
);

// The section's own column heading (e.g. "Moves") is a leading bold run
// ahead of the actual intro sentence — strip it the same way a move's own
// bold title is stripped from its body in processMove(), rather than
// letting it leak into the intro text.
let introStart = 0;
while (introStart < introItems.length && (introItems[introStart].style === "bold" || introItems[introStart].style === "bold-italic")) {
  introStart++;
}
const introHeading = textOfPlainRun(introItems.slice(0, introStart));
const intro = textOfPlainRun(introItems.slice(introStart));

const result = { page: pageNum, intro, moves };

// The pre-first-bullet region can itself carry an inline option run (a
// section-level "Pick two of these: a, b, c" ahead of any bulleted
// entries). `intro` is a plain-text join and can never show that, so
// expose it explicitly under --options. Additive; nothing reads it by
// default.
if (withOptions) {
  const introBody = buildBody(introItems.slice(introStart), bodyOpts);
  result.introHeading = introHeading;
  result.introOptionGroups = [
    ...introBody.bulletGroups,
    ...inlineOptionGroups(introBody.flatTokens, introBody.lineStartItems),
  ];
}

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
// nested-list-aware buildBody() used for each move's own body — this is
// the only way to get real <ul>/<li> structure for a shape like this.
// Never fires for any prior playbook's usage of this script (all of them
// have real top-level bullets, or they wouldn't be using extract-moves.mjs
// over extract-runs.mjs in the first place), so this is purely additive.
if (bulletIdx.length === 0) {
  const flat = buildBody(introItems.slice(introStart), bodyOpts);
  result.flatBodyHtml = flat.html;
  if (withOptions) {
    result.flatOptionGroups = [
      ...flat.bulletGroups,
      ...inlineOptionGroups(flat.flatTokens, flat.lineStartItems),
    ];
  }
}

// The silent-nothing guard: if option structure exists but --options was
// not passed, say so on stderr. stdout (the JSON contract every existing
// build script parses) is untouched, so this cannot change any prior
// output, but the failure mode the Phase 6 census warned about — "the
// extractor returns nothing structural for these, silently" — can no
// longer happen.
if (!withOptions) {
  const total = rawMoves.reduce((n, m) => n + m._optionGroups.length, 0);
  if (total > 0) {
    const inline = rawMoves.reduce(
      (n, m) => n + m._optionGroups.filter((g) => g.presentation === "inline").length,
      0
    );
    console.error(
      `extract-moves: ${total} option group(s) detected (${inline} inline, ${total - inline} bulleted) ` +
        `on page ${pageNum} but --options was not passed, so they are not in the output. ` +
        `Re-run with --options to extract them.`
    );
  }
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Intro: ${intro}`);
  for (const m of moves) {
    console.log(`\n${m.title}${m.required ? " [Required]" : ""}`);
    console.log(`  ${m.descriptionHtml}`);
    for (const g of m.optionGroups ?? []) {
      console.log(`  -- ${g.presentation}${g.delimiter ? ` (${g.delimiter})` : ""} group: ${g.instruction}`);
      for (const o of g.options) {
        console.log(`     * ${o.title}${o.descriptionText ? ` — ${o.descriptionText}` : ""}  [${o.titleProvenance}]`);
      }
    }
  }
}
