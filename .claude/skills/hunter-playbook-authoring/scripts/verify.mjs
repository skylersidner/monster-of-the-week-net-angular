// Playbook authoring self-verification. Usage: node verify.mjs <work-dir> [name...]
// <work-dir> must contain cookies.txt (an authenticated session) and <name>-raw.txt per
// playbook, extracted with `pdftotext -raw -enc UTF-8` (the encoding flag matters — without
// it the minus sign in a ratings line comes out as a bare 0xAD byte, not an en dash, and
// every rating check fails).
//
// Re-reads each playbook back FROM THE API — never from the payload, which would only prove
// that JSON parses — and checks it against the raw PDF text plus the known-artifact
// checklist from architecture.md §1.
//
// Revised during Phase 8 group 1 (2026-08-31). Three Phase 4 assumptions turned out to hold
// only for the three pilots and have been replaced; each is marked in place. The pattern is
// worth remembering: a check derived from a 3-playbook sample encodes that sample's
// coincidences as rules, and the failure is silent until the 4th playbook.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const DIR = process.argv[2] || process.cwd();
const PLAYBOOKS = process.argv.length > 3 ? process.argv.slice(3) : [
  'action-scientist', 'celebrity', 'changeling', 'chosen', 'covenant', 'crooked',
  'curse-eater', 'divine', 'envoy', 'expert', 'flake', 'forged', 'gumshoe', 'hex',
  'host', 'initiate', 'interface', 'monstrous', 'mundane', 'pararomantic', 'professional',
  'searcher', 'snoop', 'spell-slinger', 'spooktacular', 'spooky', 'visitor', 'wronged',
];

// Stored Name per source-file key. Not derivable from the key: "The Curse-Eater" is stored
// capitalised (Skyler, 2026-08-31) though the sheet's title block prints "The Curse-eater".
const TITLES = {
  'action-scientist': 'The Action Scientist',
  'curse-eater': 'The Curse-Eater',
  // The sheet prints 'Spell-slinger' in body text but 'The SpeLl-Slinger' in its display
  // title block; stored with both words capitalised.
  'spell-slinger': 'The Spell-Slinger',
};
const titleOf = (n) => TITLES[n] || 'The ' + n[0].toUpperCase() + n.slice(1);

// Deliberate, Skyler-approved departures from the printed sheet. Each entry maps what is
// stored back to what the source actually prints, so the content-fidelity check below still
// compares against the real page instead of being weakened to a blanket exemption. Keep this
// list short and cited — it is the one place stored data is allowed to disagree with the PDF.
const EXEMPTIONS = [
  // Genuine typos in the published source, corrected on storage (Skyler, 2026-08-31).
  ['point of Luck, some gadget', 'point of Luck, you some gadget'],   // Action Scientist, Luck
  ['Pocket knife or multitool (1-harm hand useful small)', 'Pocket knife of multitool (1-harm hand useful small)'], // Changeling, Gear
  ['You’re suspicious of their powers', 'You’re suspsicious of their powers'],  // Curse-Eater, History
  ['They’re suspicious of your powers', 'They’re suspicioius of your powers'],  // Curse-Eater, History
  // Crooked / Underworld option 4: reworded to match its three siblings' "Pick one:"
  // phrasing, per Skyler's explicit instruction that this exact example be corrected during
  // import. See bespoke-ruleset-catalogue.md ## The Crooked, "Normalization applied".
  ['Things went south on a job, including but not limited to running into. Pick one:',
   'Things went south on a job—including, but not limited to, running into (choose one):'],
  // Group 2. Another published typo, same standing rule.
  ['Medical Practitioners', 'Medical Practioners'],                       // Gumshoe, Naked City
  // A kerning artifact, not a typo: the PDF's letter-spacing on this move title makes the
  // extractor read spurious spaces mid-word. The page itself reads "Don't Worry About Me".
  ['Don’t Worry About Me', 'D on’t Worr y Ab out Me'],                    // Forged, Moves
  // Group 3. More published typos, same standing rule.
  ['Mark another two basic moves as advanced', 'Mark another two basic moves advanced'],  // Host, Advanced
  ['if you were originally human', 'if you you were originally human'],   // Monstrous, Monster Breed
  ['and pick history.', 'and pick history..'],                            // Pararomantic, Getting Started
  // Group 4. More published typos, same standing rule.
  ['investigating separate mysteries', 'investigating seperate mysteries'],   // Searcher, History
  ['nose into your business.', 'nose into your business..'],                  // Spell-Slinger, Luck
  ['could be bad, who knows?', 'could be bad, who knows?.'],                  // Spooktacular, Luck
];

/*
 * Strings that are deliberately NOT from the source, with the reason each exists. The
 * fidelity check skips exactly these and nothing else — the point is that invented text has
 * to be declared here to pass, rather than quietly slipping through a loosened check.
 *
 * Added 2026-08-31 (group 3), when three separate kinds of synthesized text landed at once.
 */
const SYNTHESIZED = new Set([
  // Two Required moves the source never names. Both named by Skyler; see
  // bespoke-ruleset-catalogue.md under The Initiate and The Professional.
  'One of Us',            // Initiate — no bold label precedes its description on page 33
  'Agency politics',      // Professional — same shape on page 44
  // Category labels the source states only as a full sentence, or not at all.
  'Origin',               // Interface — source says "Then pick how you gained these abilities."
  'Agency name:',         // Professional — Skyler's fix so the Section's own question has an answer slot
  // The Pararomantic's Guide's Gift option titles: these four options carry no delimiter of
  // any kind in the source — no colon, no font boundary — so the short labels are authored,
  // while each DescriptionText is the full unsplit sentence exactly as printed.
  'Part of their body',
  'Piece of jewelery',
  'A memento of the time when they were human',
  'A strange or antique weapon',
  // The Visitor's Expatriation sub-block and Line labels: the source names the block only
  // by its question and calls the three lists nothing but 'lines'.
  'Home Culture', 'Line 1', 'Line 2', 'Line 3',
  // The Searcher's and Spell-Slinger's bounded-repeatable free-text labels, and the
  // Spooktacular's numeric-leaf label, all synthesized for the UI.
  'Member', 'Organization',
  // Spell-Slinger / Tools and Techniques: Skyler directed the source's inverted instruction
  // ('Cross off one; you'll need the rest') be stored as its positive equivalent.
  'Pick three of the four; you’ll need the ones you pick.',
]);

const pass = [], fail = [], notes = [];
const check = (ok, label) => (ok ? pass : fail).push((ok ? 'PASS  ' : 'FAIL  ') + label);
const note = (label) => notes.push('NOTE  ' + label);

const api = (path) =>
  JSON.parse(execSync(`curl -s -b ${DIR}/cookies.txt http://localhost:5225${path}`, { encoding: 'utf8', maxBuffer: 1 << 26 }));

const norm = (s) => s.replace(/\s+/g, ' ').replace(/[’‘']/g, "'").replace(/[—–]/g, '-').trim();

/*
 * Strip `-raw`'s bullet glyphs from the SOURCE before anything else looks at it.
 *
 * pdftotext renders the checkbox glyph as a literal ASCII "b" (capital "B" for a Required
 * move), either followed by a space or fused straight onto the next word — "bAssault rifle".
 * Alphanumeric squashing therefore does NOT remove it, and any stored string that spans a
 * bullet boundary fails to match: the source reads "...move.bHerald: When you..." where the
 * stored text reads "...move.Herald: When you...". That bit on The Envoy's Secret Wisdom,
 * the first stored value to span four bulleted items.
 *
 * Only a line-initial b/B followed by whitespace or an uppercase letter is treated as a
 * glyph, which is exactly how the source renders them and cannot match an ordinary word:
 * "But..." and "Bad Luck Charm" both continue with a lowercase letter.
 */
const stripBullets = (s) => s.replace(/^[bB](?=[\s“"'A-Z])/gm, '');

const raw = Object.fromEntries(PLAYBOOKS.map((n) => [n, readFileSync(`${DIR}/${n}-raw.txt`, 'utf8')]));
const src = Object.fromEntries(PLAYBOOKS.map((n) => [n, norm(stripBullets(raw[n]))]));

const BASIC_MOVES = [
  'Manipulate Someone', 'Act Under Pressure', 'Help Out', 'Investigate a Mystery',
  'Read a Bad Situation', 'Kick Some Ass', 'Protect Someone', 'Use Magic',
];

const list = api('/api/playbooks');
const detail = {};
for (const key of PLAYBOOKS) {
  const row = list.find((p) => p.name === titleOf(key));
  check(!!row, `${key}: present in the list endpoint as "${titleOf(key)}"`);
  if (row) detail[key] = api(`/api/playbooks/${row.id}`);
}

// Every stored string that should be traceable to the source page, by playbook.
//
// Two deliberate exclusions, both because the field is editorial by construction rather than
// transcribed. Gear category LABELS: several are synthesized (the Chosen's "Your Special
// Weapon — Form (choose 1)" comes from a build-your-own-weapon block that prints no such
// heading). And gear name/mechanicalText are checked SEPARATELY rather than recombined into
// "Name (tags)" — the Chosen's protective gear prints as "protective gear worth 1-armour",
// so the parenthesised form the split produces never appears on the page even though both
// halves do.
const storedStrings = (d) => [
  ...d.improvements.map((i) => i.text),
  ...d.lookCategories.flatMap((c) => c.options.map((o) => o.text)),
  ...d.gearCategories.flatMap((c) => c.options.flatMap((o) => [o.name, o.mechanicalText])),
  ...d.moves.map((m) => m.name),
].filter(Boolean);
const proseFields = ['description', 'gettingStartedText', 'introductionsText', 'levelingUpText', 'historyPromptsText', 'luckSpecialText'];

// Bespoke option text, walked recursively — Phase 5/6 content the Phase 4 verifier never saw.
const walkOptions = (opts, out = []) => {
  for (const o of opts) {
    if (o.title) out.push(o.title);
    if (o.descriptionText) out.push(o.descriptionText);
    walkOptions(o.children || [], out);
  }
  return out;
};
const bespokeStrings = (d) => [
  ...d.bespokeSections.flatMap((s) => [s.title, s.description, s.effectText, ...walkOptions(s.options)]),
  ...d.moves.flatMap((m) => m.bespokeSections.flatMap((s) => [s.description, s.effectText, ...walkOptions(s.options)])),
  ...d.bespokeJournals.flatMap((j) => [j.description, j.effectText, ...j.fields.map((f) => f.label)]),
  ...d.extraTracks.flatMap((t) => [t.name, t.description, t.effectText, t.startLabel, t.endLabel]),
].filter(Boolean);

// --- Artifact 1: the stat/move-pairing merge ------------------------------------------
// architecture.md §1: every sheet prints the 5 rating labels beside the fixed 8 basic
// moves, which -layout fuses into a fake per-stat pairing. Basic moves are universal and
// must not have leaked into any playbook's own data. Move NAMES only — a move body may
// legitimately cross-reference a basic move ("you never need to act under pressure").
for (const [key, d] of Object.entries(detail)) {
  const leaked = BASIC_MOVES.filter((m) => d.moves.some((x) => x.name === m));
  check(leaked.length === 0, `${key}: no basic-move contamination${leaked.length ? ' — leaked: ' + leaked : ''}`);

  // Moves consistency, not a scope check. This began as "zero Moves rows, moveGrantCount 0",
  // which encoded Phase 4's scope boundary; Phase 6 legitimately crosses it. What holds in
  // either phase is that the two agree — the mixed states are the actual bugs.
  const movesAuthored = d.moves.length > 0;
  check(
    movesAuthored ? d.moveGrantCount > 0 : d.moveGrantCount === 0,
    `${key}: Moves rows and moveGrantCount agree (${d.moves.length} rows, grant ${d.moveGrantCount})`
  );
  const required = d.moves.filter((m) => m.required).length;
  check(required <= d.moveGrantCount,
    `${key}: Required moves (${required}) do not exceed moveGrantCount (${d.moveGrantCount})`);
  // An advanced-only move is reached through an improvement, never granted or picked at
  // creation, so the two flags are mutually exclusive by definition.
  const bothFlags = d.moves.filter((m) => m.required && m.isAdvanced).map((m) => m.name);
  check(bothFlags.length === 0, `${key}: no move is both Required and advanced${bothFlags.length ? ' — ' + bothFlags : ''}`);
}

// --- Artifact 2: page-bleed from the preceding playbook -------------------------------
// REPLACED 2026-08-31. The Phase 4 version asserted six word-for-word advanced improvements
// and the absence of the string "new playbook". Both were sample artifacts: the source has
// TWO wording families for the same six beats, and Chosen/Crooked/Divine all happen to be
// family A. Family B ("new playbook" / "in addition to this one", no trailing periods) is
// used by the Action Scientist, Celebrity, Changeling and Covenant and is perfectly correct
// there — the old check would have failed all four.
//
// What actually detected the original Chosen contamination was families being MIXED within
// one playbook, so that is what is asserted now: each beat present exactly once, and the
// two family-discriminating phrases agreeing with each other.
//
// REVISED AGAIN 2026-08-31 (group 2). "Present exactly once" was still too strong in two
// ways. The Gumshoe and the Hex print "Make up a second hunter", not "Create"; and The
// Forged prints "Mark two of the basic moves as advanced" with no "Mark another two" at all,
// substituting two "Choose an advanced move you have" entries. So a beat may legitimately be
// absent. What must never happen is a beat appearing TWICE — that is duplication or
// contamination — so that is what is asserted, and absences are reported instead.
const BEATS = [
  [/^get \+1 to any rating, max ?\+3\.?$/i, 'get +1 to any rating'],
  [/^change this hunter to a new (type|playbook)\.?$/i, 'change this hunter to a new type/playbook'],
  [/^(create|make up) a second hunter to play (as well as|in addition to) this one\.?$/i, 'create a second hunter'],
  [/^mark two (of the )?basic moves as advanced\.?$/i, 'mark two basic moves as advanced'],
  [/^mark another two (of the )?basic moves as advanced\.?$/i, 'mark another two basic moves as advanced'],
  [/^retire this hunter to safety\.?$/i, 'retire this hunter to safety'],
];
for (const [key, d] of Object.entries(detail)) {
  const adv = d.improvements.filter((i) => i.isAdvanced).map((i) => i.text);
  const duplicated = BEATS.filter(([re]) => adv.filter((t) => re.test(t)).length > 1).map(([, n]) => n);
  check(duplicated.length === 0,
    `${key}: no universal advanced improvement appears twice${duplicated.length ? ' — duplicated: ' + JSON.stringify(duplicated) : ''}`);
  const absent = BEATS.filter(([re]) => !adv.some((t) => re.test(t))).map(([, n]) => n);
  if (absent.length) note(`${key}: advanced list omits ${JSON.stringify(absent)} — confirmed against the source`);

  const blob = adv.join(' | ');
  const family = /new type/i.test(blob) ? 'A' : /new playbook/i.test(blob) ? 'B' : '?';
  const consistent =
    family === 'A' ? /as well as this one/i.test(blob) && !/in addition to this one/i.test(blob)
    : family === 'B' ? /in addition to this one/i.test(blob) && !/as well as this one/i.test(blob)
    : false;
  check(consistent, `${key}: advanced-improvement wording family internally consistent (family ${family})`);
}

// --- Artifact 3: mid-word column splits ------------------------------------------------
// -raw and the pdf.js pipeline both hyphenate across column breaks ("complica-tion",
// "per- ceptions", "com- ponent"). Skyler's standing rule (2026-08-31): hyphenation the
// source applies purely for line width is NEVER preserved — those words are stored whole.
// Hyphens that are part of the word stay ("Curse-eater", "fear-based", "ignore-armour").
//
// Two checks, because the two failure shapes need different evidence.
//
// (a) `word- word` — a hyphen followed by whitespace. Unambiguous: no genuine compound is
//     ever written with a space after its hyphen. A plain pattern settles it.
for (const [key, d] of Object.entries(detail)) {
  const texts = [
    ...proseFields.map((f) => d[f]),
    ...storedStrings(d),
    ...d.moves.map((m) => m.descriptionText),
    ...bespokeStrings(d),
    ...d.gearCategories.map((c) => c.label),
  ].filter(Boolean);
  const broken = texts.filter((t) => /[a-z]-\s+[a-z]/.test(t));
  check(broken.length === 0, `${key}: no spaced mid-word column-split hyphens${broken.length ? ' — ' + JSON.stringify(broken.slice(0, 2)) : ''}`);
}

// (b) `word-word` — a rejoin done WITHOUT a space, which is shape-identical to a real
//     compound and so cannot be caught by a pattern at all. The evidence lives in the raw
//     text: a genuine compound is printed intact on one line somewhere, while a line-width
//     break only ever appears as "part1-" ending a line with "part2" starting the next.
//
//     The intact corpus is pooled across every playbook being verified, not just the one
//     under test: a compound like "fear-based" may be split at a line break in the one
//     playbook that uses it, and pooling means any other page printing it whole vindicates
//     it. The check therefore gets stronger as more playbooks are authored.
const WORD = String.raw`[A-Za-z][A-Za-z’']*`;
const hyphenated = (s) => [...s.replace(/<[^>]+>/g, ' ').matchAll(new RegExp(`${WORD}(?:-${WORD})+`, 'g'))].map((m) => m[0].toLowerCase());

const intactCorpus = new Set();
const wordCorpus = new Set();
const splitByKey = {};
for (const key of PLAYBOOKS) {
  // Bullet glyphs have to go first here too, or "bAim-assist" tokenises as "baim-assist"
  // and the real compound "aim-assist" is never attested.
  const text = stripBullets(raw[key]);
  const lines = text.split(/\r?\n/);
  for (const line of lines) hyphenated(line).forEach((t) => intactCorpus.add(t));
  // Also attest against a "healed" copy with line-break hyphens joined. A compound can be
  // real and yet never appear whole on any single line, because the break landed inside one
  // of its own words: the Expert prints "mon-\nster-killing" and the Hex "too-for-\nmal", so
  // "monster-killing" and "too-formal" are correct but unattestable from the lines alone.
  // This only adds attestations; the line-break detection below is untouched, so a genuine
  // artifact is still caught by it.
  hyphenated(text.replace(/-\s*\r?\n\s*/g, '')).forEach((t) => intactCorpus.add(t));
  // Every word the source prints WHOLE on some line — deliberately not from the healed copy,
  // which would be circular: healing "near-\ndeath" manufactures "neardeath", so every
  // line-break pair would attest its own joined form and the test below could never fail.
  for (const line of lines) {
    for (const m of line.matchAll(/[A-Za-z][A-Za-z’']*/g)) wordCorpus.add(m[0].toLowerCase());
  }
  const split = new Set();
  for (let i = 0; i < lines.length - 1; i++) {
    const a = new RegExp(`(${WORD})-\\s*$`).exec(lines[i]);
    const b = /^\s*([A-Za-z]+)/.exec(lines[i + 1]);
    if (a && b) split.add((a[1] + '-' + b[1]).toLowerCase());
  }
  splitByKey[key] = split;
}

for (const [key, d] of Object.entries(detail)) {
  const texts = [
    ...proseFields.map((f) => d[f]),
    ...storedStrings(d),
    ...d.moves.map((m) => m.descriptionText),
    ...bespokeStrings(d),
    ...d.gearCategories.map((c) => c.label),
  ].filter(Boolean);
  /*
   * Three verdicts, not two.
   *
   * A token the source only ever prints across a line break is ambiguous on its face: the
   * break may have landed inside one of the words ("com-\nponent" — an artifact, store
   * "component") or exactly on the compound's own hyphen ("near-\ndeath" — genuine, store
   * "near-death"). Nothing in the glyphs distinguishes them.
   *
   * What does distinguish them is whether the de-hyphenated form is a word this corpus uses
   * elsewhere. "component" appears whole on other pages, so "com-ponent" is an artifact and
   * fails. "neardeath" appears nowhere, so "near-death" is reported for a human look rather
   * than asserted wrong. Erring toward a note here is deliberate: a false FAIL on correct
   * data trains the next author to ignore this check.
   */
  const artifacts = [], unresolved = [];
  for (const t of new Set(texts.flatMap(hyphenated))) {
    if (intactCorpus.has(t)) continue;
    const joined = t.replace(/-/g, '');
    if (splitByKey[key].has(t) && wordCorpus.has(joined)) artifacts.push(`${t} -> "${joined}"`);
    else unresolved.push(t);
  }
  check(artifacts.length === 0, `${key}: no line-width hyphen survived into stored text${artifacts.length ? ' — ' + JSON.stringify(artifacts) : ''}`);
  if (unresolved.length) note(`${key}: hyphenated token(s) the source only ever prints broken across a line — read as genuine compounds, check the page if in doubt: ${JSON.stringify(unresolved)}`);
}

// --- Artifact 4: kerning splits (group 2) ----------------------------------------------
// A fourth artifact class, found on The Forged: heavy letter-spacing on a display title
// makes the extractor emit spurious spaces INSIDE words — "D on’t Worr y Ab out Me" for
// "Don't Worry About Me". Unlike a hyphenation break it leaves no punctuation behind, so
// the only signal is a stranded single letter. English has exactly two one-letter words, so
// any other lone letter is an artifact.
for (const [key, d] of Object.entries(detail)) {
  const texts = [
    ...proseFields.map((f) => d[f]),
    ...storedStrings(d),
    ...d.moves.map((m) => m.descriptionText),
    ...bespokeStrings(d),
    ...d.gearCategories.map((c) => c.label),
  ].filter(Boolean);
  const stranded = texts.filter((t) => /(^|\s)[B-HJ-Zb-hj-z](\s|$)/.test(t.replace(/<[^>]+>/g, ' ')));
  check(stranded.length === 0, `${key}: no stranded single letters from kerning splits${stranded.length ? ' — ' + JSON.stringify(stranded.slice(0, 2)) : ''}`);
}

// --- Content fidelity: every stored string must occur in the source --------------------
// Compare on alphanumerics only: the source interleaves bullet glyphs, line breaks and
// mid-word hyphenation, none of which are meaningful. HTML tags and {{blank}} tokens are
// stripped first — both are ours, not the source's.
const squash = (t) => norm(t).toLowerCase().replace(/<[^>]+>/g, '').replace(/\{\{blank\}\}/g, '').replace(/[^a-z0-9]/g, '');
const sourceFor = (key) => {
  let s = src[key];
  for (const [stored, printed] of EXEMPTIONS) s = s.split(norm(printed)).join(norm(stored));
  return squash(s);
};

// How many contiguous runs of the source it takes to account for `text`.
//
// One is the normal answer. Two is correct — and expected — where a creation-time pick was
// lifted out of the middle of a move's or option's own body into a BespokeSection: the Skill
// requires the enumerated run be removed so the options aren't rendered twice, which leaves
// the surrounding text discontinuous on the page (Changeling's Force of Nature). Anything
// more means the text genuinely does not track the source.
//
// The prefix test is monotone — if a longer prefix is a substring, every shorter one is too
// — so the longest match can be found by binary search rather than scanned.
const piecesNeeded = (sq, text) => {
  let rest = squash(text), pieces = 0;
  while (rest.length) {
    let lo = 1, hi = rest.length, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sq.includes(rest.slice(0, mid))) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best === 0) return Infinity;
    pieces++;
    rest = rest.slice(best);
  }
  return pieces;
};
for (const [key, d] of Object.entries(detail)) {
  const sq = sourceFor(key);
  const absent = storedStrings(d).filter((t) => !SYNTHESIZED.has(t) && !sq.includes(squash(t)));
  check(absent.length === 0, `${key}: every stored option/improvement/move-name found in source${absent.length ? ' — absent: ' + JSON.stringify(absent) : ''}`);

  const proseAbsent = proseFields.filter((f) => d[f] && !sq.includes(squash(d[f])));
  check(proseAbsent.length === 0, `${key}: every prose section found in source${proseAbsent.length ? ' — absent: ' + proseAbsent : ''}`);

  // Bespoke text and move bodies allow a 2-piece match where a pick-run was lifted out into
  // a nested structure (see piecesNeeded); everything else must match in one run.
  const allowance = (hasNested) => (hasNested ? 2 : 1);
  const bespokeAbsent = [];
  for (const s of [...d.bespokeSections, ...d.moves.flatMap((m) => m.bespokeSections)]) {
    // A Section's own Description gets the same 2-piece allowance as an option's when the
    // Section has options: the printed enumeration is lifted out of the prose into those
    // options, which leaves the surrounding sentences discontinuous on the page (The Hex's
    // Rotes explanation is the clearest case — its 5 requirements sit mid-paragraph).
    for (const t of [s.title, s.description, s.effectText].filter(Boolean)) {
      if (SYNTHESIZED.has(t)) continue;
      if (piecesNeeded(sq, t) > allowance(s.options.length > 0)) bespokeAbsent.push(t);
    }
    const walk = (opts) => opts.forEach((o) => {
      for (const t of [o.title, o.descriptionText].filter(Boolean)) {
        if (SYNTHESIZED.has(t)) continue;
        if (piecesNeeded(sq, t) > allowance(o.children.length > 0)) bespokeAbsent.push(t);
      }
      walk(o.children);
    });
    walk(s.options);
  }
  for (const t of [...d.bespokeJournals.flatMap((j) => [j.description, j.effectText, ...j.fields.map((f) => f.label)]),
                   ...d.extraTracks.flatMap((t2) => [t2.name, t2.description, t2.effectText, t2.startLabel, t2.endLabel])].filter(Boolean)) {
    if (piecesNeeded(sq, t) > 1) bespokeAbsent.push(t);
  }
  check(bespokeAbsent.length === 0, `${key}: all bespoke/journal/track text traces to the source${bespokeAbsent.length ? ' — absent: ' + JSON.stringify(bespokeAbsent.slice(0, 3)) : ''}`);

  const moveAbsent = d.moves
    .filter((m) => m.descriptionText && piecesNeeded(sq, m.descriptionText) > allowance(m.bespokeSections.length > 0))
    .map((m) => m.name);
  check(moveAbsent.length === 0, `${key}: every move body traces to the source${moveAbsent.length ? ' — absent: ' + JSON.stringify(moveAbsent) : ''}`);
}

// --- Ratings verified digit-by-digit against the source -------------------------------
for (const [key, d] of Object.entries(detail)) {
  const sq = src[key].toLowerCase().replace(/[\s=]/g, '');
  const bad = d.statArrayOptions.filter((r) => {
    const sign = (n) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`);
    return !sq.includes(`charm${sign(r.charm)},cool${sign(r.cool)},sharp${sign(r.sharp)},tough${sign(r.tough)},weird${sign(r.weird)}`);
  });
  check(bad.length === 0, `${key}: all ${d.statArrayOptions.length} rating lines match the source exactly${bad.length ? ' — bad: ' + JSON.stringify(bad) : ''}`);
}

// --- Blank tokens ----------------------------------------------------------------------
// A raw underscore run in stored data means a printed blank marker was transcribed instead
// of tokenized. Move bodies are exempt: Changeling's Faerie Gossip prints two in-play
// questions with literal blanks that are filled fresh each use, not stored per Hunter, so
// {{blank}} (which means "render an input here") would be wrong for them.
for (const [key, d] of Object.entries(detail)) {
  const leaked = [...storedStrings(d), ...bespokeStrings(d), ...proseFields.map((f) => d[f])]
    .filter(Boolean).filter((t) => /_{3,}/.test(t));
  check(leaked.length === 0, `${key}: no untokenized blank markers${leaked.length ? ' — ' + JSON.stringify(leaked.slice(0, 2)) : ''}`);
}

// --- Cross-playbook uniformity (the sections expected to be near-identical) -----------
const tracks = Object.entries(detail).map(([k, d]) => [k, [d.luckBoxCount, d.harmBoxCount, d.harmUnstableThreshold, d.experienceBoxCount].join('/')]);
const distinct = new Set(tracks.map(([, t]) => t));
check(distinct.size === 1,
  `Luck/Harm/Experience identical across all ${tracks.length} playbooks (${[...distinct].join('  ')})${distinct.size > 1 ? ' — ' + JSON.stringify(tracks) : ''}`);
for (const [key, d] of Object.entries(detail)) {
  check(!!d.luckSpecialText && !/^(the )?[a-z-]+ special/i.test(d.luckSpecialText),
    `${key}: luckSpecialText populated and the "[Playbook] special:" label stripped`);
}

// --- Every in-scope section actually populated ----------------------------------------
for (const [key, d] of Object.entries(detail)) {
  // description is reported, not asserted: The Pararomantic prints no flavour text
  // anywhere on its spread, so null is the correct stored value there.
  const empty = proseFields.filter((f) => f !== 'description' && !d[f]);
  check(empty.length === 0, `${key}: all in-scope prose sections populated${empty.length ? ' — empty: ' + empty : ''}`);
  if (!d.description) note(`${key}: no description — confirmed the sheet prints no flavour text at all`);
  check(d.statArrayOptions.length === 5, `${key}: 5 rating lines`);
  check(d.lookCategories.every((c) => c.options.length > 0), `${key}: every look category has options`);
  check(d.gearCategories.every((c) => c.options.length > 0), `${key}: every gear category has options`);
  check(d.gearCategories.every((c) => c.pickCount === null || c.pickCount <= c.options.length),
    `${key}: no gear category picks more options than it lists`);

  // REPORTED, NOT ASSERTED, from 2026-08-31. The Phase 4 check demanded exactly 10 regular
  // improvements; the Covenant genuinely prints 11 and the Curse-Eater's own list repeats
  // two entries verbatim in its advanced list. A count outside 10 is a thing to look at, not
  // a failure — the source is the authority.
  const reg = d.improvements.filter((i) => !i.isAdvanced).length;
  const adv = d.improvements.filter((i) => i.isAdvanced).length;
  if (reg !== 10) note(`${key}: ${reg} regular improvements (10 is typical) — confirmed against the source`);
  check(reg >= 8 && reg <= 12 && adv >= 6 && adv <= 12, `${key}: improvement counts plausible (${reg} regular + ${adv} advanced)`);

  // Each list restarts its own sortOrder at 0 and is dense — the ordering contract Phase 4
  // settled and the one thing a careless re-author would silently break.
  for (const [flag, label] of [[false, 'regular'], [true, 'advanced']]) {
    const orders = d.improvements.filter((i) => i.isAdvanced === flag).map((i) => i.sortOrder);
    check(orders.every((o, i) => o === i), `${key}: ${label} improvements have a dense sortOrder from 0`);
  }

  // Added 2026-08-31 after an authoring helper left every gear category tied at sortOrder 0,
  // which made their returned order a database detail. Ties are the failure mode worth
  // catching: display order silently becomes arbitrary and nothing else notices, because
  // every individual string is still correct.
  const dense = (rows, what) => {
    const orders = rows.map((r) => r.sortOrder).sort((a, b) => a - b);
    check(orders.every((o, i) => o === i), `${key}: ${what} sortOrder is dense from 0 (${rows.map((r) => r.sortOrder).join(',')})`);
  };
  dense(d.gearCategories, 'gear categories');
  dense(d.lookCategories, 'look categories');
  // Moves split into two independent sequences the same way improvements do, once a
  // playbook has advanced-only moves (The Hex).
  dense(d.moves.filter((m) => !m.isAdvanced), 'creation-time moves');
  if (d.moves.some((m) => m.isAdvanced)) dense(d.moves.filter((m) => m.isAdvanced), 'advanced moves');
  dense(d.statArrayOptions, 'rating lines');
  dense(d.bespokeSections, 'playbook-level bespoke sections');
  d.gearCategories.forEach((c) => dense(c.options, `gear options in "${c.label.slice(0, 24)}"`));
  d.lookCategories.forEach((c, i) => dense(c.options, `look options in category ${i}`));
}

// --- Bespoke structural sanity ---------------------------------------------------------
for (const [key, d] of Object.entries(detail)) {
  const sections = [...d.bespokeSections, ...d.moves.flatMap((m) => m.bespokeSections)];
  // Three legitimate shapes: both null (the Covenant's zero-option degenerate case), both
  // set, or an uncapped minimum — min set with max null, which is how the Crooked's Heat
  // models "pick at least two of these" with no stated ceiling. A max with no min is the
  // only incoherent combination.
  const bad = sections.filter((s) =>
    (s.minSelect === null && s.maxSelect !== null) ||
    (s.maxSelect !== null && s.maxSelect < s.minSelect) ||
    (s.maxSelect !== null && s.options.length > 0 && s.maxSelect > s.options.length));
  check(bad.length === 0, `${key}: bespoke select counts coherent${bad.length ? ' — ' + JSON.stringify(bad.map((s) => s.title)) : ''}`);

  // Every option that HAS children is a category and needs a coherent count — at any depth.
  // Only checking depth 1 missed The Visitor's Lines entirely, which sit three levels down.
  //
  // The legal shapes mirror the Section-level rule: a fixed count, or an uncapped minimum
  // (min set, max null) for the "pick one or more, no stated ceiling" lists — Heat, the
  // Visitor's Lines, and the Wronged's two tag blocks all print exactly that. A max with no
  // min, or a max exceeding the children available, is the real incoherence.
  const categories = [];
  const collect = (opts) => opts.forEach((o) => { if (o.children.length > 0) categories.push(o); collect(o.children); });
  sections.forEach((s) => collect(s.options));
  const badNest = categories.filter((o) =>
    o.minSelect === null ||
    (o.maxSelect !== null && (o.maxSelect < o.minSelect || o.maxSelect > o.children.length)));
  check(badNest.length === 0, `${key}: every nested category (any depth) has a coherent select count${badNest.length ? ' — ' + JSON.stringify(badNest.map((o) => o.title)) : ''}`);

  // Playbook-level BespokeSections must never carry a move's sections — the read rule is
  // structural (architecture.md §6.8), and a leak here would double-render them.
  const moveTitles = new Set(d.moves.map((m) => m.name));
  const leaked = d.bespokeSections.filter((s) => moveTitles.has(s.title) && d.moves.find((m) => m.name === s.title).bespokeSections.length > 0);
  check(leaked.length === 0, `${key}: no move-internal section duplicated at playbook level`);
}

[...pass, ...fail, ...notes].forEach((l) => console.log(l));
console.log(`\n${pass.length} passed, ${fail.length} failed, ${notes.length} notes`);
process.exit(fail.length ? 1 : 0);
