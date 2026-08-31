// Playbook authoring self-verification. Usage: node verify.mjs <work-dir> [name...]
// <work-dir> must contain cookies.txt (an authenticated session) and <name>-raw.txt per
// playbook. Adapt PLAYBOOKS below when authoring beyond the Phase 4 pilots.
// Phase 4 self-verification. Re-reads each playbook back from the API and checks it
// against the raw PDF text plus the known-artifact checklist from architecture.md §1.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Working directory holding <name>-raw.txt and cookies.txt. Pass as argv[2].
const DIR = process.argv[2] || process.cwd();
const PLAYBOOKS = process.argv.length > 3 ? process.argv.slice(3) : ['chosen', 'crooked', 'divine'];
const TITLES = Object.fromEntries(PLAYBOOKS.map((n) => [n, 'The ' + n[0].toUpperCase() + n.slice(1)]));

const pass = [], fail = [];
const check = (ok, label) => (ok ? pass : fail).push((ok ? 'PASS  ' : 'FAIL  ') + label);

const api = (path) =>
  JSON.parse(execSync(`curl -s -b ${DIR}/cookies.txt http://localhost:5225${path}`, { encoding: 'utf8' }));

// Source text, normalised: the PDF's own line wrapping is not meaningful, and `-raw`
// renders bullets as a leading `b`/`B` glyph that sometimes fuses to the next word.
const norm = (s) => s.replace(/\s+/g, ' ').replace(/[\u2019']/g, "'").replace(/[\u2014\u2013]/g, '-').trim();
const src = Object.fromEntries(
  PLAYBOOKS.map((n) => [n, norm(readFileSync(`${DIR}/${n}-raw.txt`, 'utf8'))])
);

const BASIC_MOVES = [
  'Manipulate Someone', 'Act Under Pressure', 'Help Out', 'Investigate a Mystery',
  'Read a Bad Situation', 'Kick Some Ass', 'Protect Someone', 'Use Magic',
];

const list = api('/api/playbooks');
const byName = Object.fromEntries(PLAYBOOKS.map((n) => [n, list.find((p) => p.name.toLowerCase() === TITLES[n].toLowerCase())]));

const detail = {};
for (const [key, row] of Object.entries(byName)) {
  check(!!row, `${key}: present in the list endpoint`);
  detail[key] = api(`/api/playbooks/${row.id}`);
}

// --- Artifact 1: the stat/move-pairing merge ------------------------------------------
// architecture.md §1: every sheet prints the 5 rating labels beside the fixed 8 basic
// moves, which -layout fuses into a fake per-stat pairing. Basic moves are universal and
// must not have leaked into any playbook's own data.
for (const [key, d] of Object.entries(detail)) {
  const blob = JSON.stringify(d);
  const leaked = BASIC_MOVES.filter((m) => blob.includes(m));
  check(leaked.length === 0, `${key}: no basic-move contamination${leaked.length ? ' — leaked: ' + leaked : ''}`);
  /*
   * Moves consistency, not a scope check.
   *
   * This began as "zero Moves rows, moveGrantCount 0", which encoded Phase 4's scope
   * boundary. Phase 6 legitimately crosses that boundary, so asserting it would now fail on
   * correctly-authored data. What is worth asserting in either phase is that the two agree:
   * a playbook is either Moves-unauthored (no rows, count 0) or Moves-authored (rows AND a
   * real count). The mixed states are the actual bugs — rows with the count still at its
   * placeholder 0, or a count claiming grants that no rows back.
   */
  const movesAuthored = d.moves.length > 0;
  check(
    movesAuthored ? d.moveGrantCount > 0 : d.moveGrantCount === 0,
    `${key}: Moves rows and moveGrantCount agree (${d.moves.length} rows, grant ${d.moveGrantCount})`
  );
}

// --- Artifact 2: page-bleed from the preceding playbook -------------------------------
// The original pass caught a contaminated read of Chosen that said "new playbook" /
// "in addition to this one" — wording that belongs to a different playbook.
const SHARED_ADVANCED = [
  'Get +1 to any rating, max +3.',
  'Change this hunter to a new type.',
  'Create a second hunter to play as well as this one.',
  'Mark two of the basic moves as advanced.',
  'Mark another two of the basic moves as advanced.',
  'Retire this hunter to safety.',
];
for (const [key, d] of Object.entries(detail)) {
  const adv = d.improvements.filter((i) => i.isAdvanced).map((i) => i.text);
  const missing = SHARED_ADVANCED.filter((t) => !adv.includes(t));
  check(missing.length === 0, `${key}: all 6 word-for-word shared advanced improvements present${missing.length ? ' — missing: ' + JSON.stringify(missing) : ''}`);
  check(!JSON.stringify(d).includes('new playbook'), `${key}: no "new playbook" page-bleed wording`);
}

// --- Artifact 3: mid-word column splits ------------------------------------------------
// -raw hyphenates across column breaks ("complica-tion", "Addi-tionally"). Any survivor
// in stored text is a transcription error.
for (const [key, d] of Object.entries(detail)) {
  const texts = [
    d.description, d.gettingStartedText, d.introductionsText, d.levelingUpText,
    d.historyPromptsText, d.luckSpecialText,
    ...d.improvements.map((i) => i.text),
    ...d.lookCategories.flatMap((c) => c.options.map((o) => o.text)),
    ...d.gearCategories.flatMap((c) => [c.label, ...c.options.map((o) => o.name)]),
  ].filter(Boolean);
  const broken = texts.filter((t) => /[a-z]-\s+[a-z]/.test(t) || /\b\w+-\w*\s{2,}/.test(t));
  check(broken.length === 0, `${key}: no mid-word column-split hyphens${broken.length ? ' — ' + JSON.stringify(broken.slice(0, 2)) : ''}`);
}

// --- Content fidelity: every stored string must occur in the source --------------------
for (const [key, d] of Object.entries(detail)) {
  const s = src[key];
  const strings = [
    ...d.improvements.map((i) => i.text),
    ...d.lookCategories.flatMap((c) => c.options.map((o) => o.text)),
    ...d.gearCategories.flatMap((c) => c.options.map((o) => o.name)),
  ];
  // Compare on alphanumerics only: the source interleaves bullet glyphs and line breaks.
  const squash = (t) => norm(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const sq = squash(s);
  const absent = strings.filter((t) => !sq.includes(squash(t)));
  check(absent.length === 0, `${key}: every stored option/improvement string found in source${absent.length ? ' — absent: ' + JSON.stringify(absent) : ''}`);
}

// --- Ratings verified digit-by-digit against the source -------------------------------
for (const [key, d] of Object.entries(detail)) {
  const sq = src[key].toLowerCase().replace(/\s|=/g, '');
  const bad = d.statArrayOptions.filter((r) => {
    const sign = (n) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`);
    return !sq.includes(`charm${sign(r.charm)},cool${sign(r.cool)},sharp${sign(r.sharp)},tough${sign(r.tough)},weird${sign(r.weird)}`);
  });
  check(bad.length === 0, `${key}: all ${d.statArrayOptions.length} rating lines match the source exactly${bad.length ? ' — bad: ' + JSON.stringify(bad) : ''}`);
}

// --- Cross-playbook uniformity (the sections expected to be near-identical) -----------
const tracks = Object.entries(detail).map(([k, d]) => [k, d.luckBoxCount, d.harmBoxCount, d.harmUnstableThreshold, d.experienceBoxCount].join('/'));
check(new Set(tracks.map((t) => t.split('/').slice(1).join('/'))).size === 1,
  `Luck/Harm/Experience identical across all three: ${tracks.join('  ')}`);
for (const [key, d] of Object.entries(detail)) {
  check(!!d.luckSpecialText && !d.luckSpecialText.toLowerCase().startsWith(`${key} special`),
    `${key}: luckSpecialText populated and the "[Playbook] special:" label stripped`);
}

// --- Every in-scope section actually populated ----------------------------------------
for (const [key, d] of Object.entries(detail)) {
  const empty = ['description', 'gettingStartedText', 'introductionsText', 'levelingUpText', 'historyPromptsText']
    .filter((f) => !d[f]);
  check(empty.length === 0, `${key}: all in-scope prose sections populated${empty.length ? ' — empty: ' + empty : ''}`);
  check(d.statArrayOptions.length === 5, `${key}: 5 rating lines`);
  check(d.improvements.filter((i) => !i.isAdvanced).length === 10, `${key}: exactly 10 improvements`);
  check(d.lookCategories.every((c) => c.options.length > 0), `${key}: every look category has options`);
  check(d.gearCategories.every((c) => c.options.length > 0), `${key}: every gear category has options`);
  check(d.gearCategories.every((c) => c.pickCount === null || c.pickCount <= c.options.length),
    `${key}: no gear category picks more options than it lists`);
}

[...pass, ...fail].forEach((l) => console.log(l));
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
