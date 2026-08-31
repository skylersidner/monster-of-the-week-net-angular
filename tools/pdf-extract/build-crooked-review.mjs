// Concrete worked example: runs the extract-runs.mjs -> splice-formatting.mjs
// pipeline over every option in The Crooked's Background/Heat/Underworld
// bespoke rulesets (pages 11-12 of the source PDF) and emits:
//   - crooked-background-review.json  (title/descriptionText pairs, the
//     actual shape BespokeOption rows would be authored from)
//   - crooked-background-review.html  (human-readable review file for
//     Skyler — open it in a browser, bold text should visually match the PDF)
//
// The plain-text option bodies below are taken verbatim from
// docs/hunter-playbooks/bespoke-ruleset-catalogue.md (already vetted against
// the PDF by the architecture pass) — this script's only job is to prove the
// formatting-preservation splice, not to re-derive the text itself.
//
// Usage: node build-crooked-review.mjs <pdfPath>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node build-crooked-review.mjs <pdfPath>");
  process.exit(1);
}

const background = [
  ["Hoodlum", "You can use Tough instead of Charm to manipulate someone with threats of violence."],
  ["Burglar", "When you break into a secure location, roll +Sharp. On a 10+ pick three, on a 7-9 pick two: you get in undetected, you get out undetected, you don't leave a mess, you find what you were after."],
  ["Grifter", "When you are about to manipulate someone, you can ask the Keeper \"What will convince this person to do what I want?\" The Keeper must answer honestly, but not necessarily completely."],
  ["Fixer", "If you need to buy something, sell something, or hire someone, roll +Charm. On a 10+ you know just the person who will be interested. On a 7-9 you know the only person who can do it, but there's a complication. Pick one: you owe them; they screwed you over; you screwed them over. On a miss, the only person who can help is someone who absolutely hates you."],
  ["Assassin", "When you take your first shot at an unsuspecting target, do +2 Harm."],
  ["Charlatan", "When you want people to think you are using magic, roll +Cool. On a 10 or more, your audience is amazed and fooled by your illusion. On a 7-9 you tripped up a couple of times, maybe someone will notice. You may also manipulate people with fortune telling. When you do that, ask \"What are they hoping for right now?\" as a free question (even on a miss)."],
  ["Pickpocket", "When you steal something small, roll +Charm. On a 10 or more, you get it and they didn't notice you taking it. On a 7-9 either you don't grab it, you grab the wrong thing, or they remember you later: your choice."],
];

// Heat/Underworld carry no bold/italic in the source (verified: page 12 has
// no italic font at all, and the only bold runs on that page are section
// headings, none inside option bodies) — included anyway to show the
// pipeline correctly produces a plain pass-through, not a false positive.
const heat = [
  "A police detective, {{blank}}, has made it a personal goal to put you away.",
  "You have a rival from your background, {{blank}}, who never misses a chance to screw you over.",
  "You pissed off a well-connected criminal, {{blank}}, and they'll do whatever they can to destroy you.",
  "{{blank}} is someone with special powers, a person or monster, who you took advantage of.",
  "{{blank}} is an old partner you betrayed in the middle of a job.",
];

const underworldParents = [
  "The target of a job was a dangerous creature.",
  "You worked with someone who was more than they seemed.",
  "You were hired by something weird.",
  "Things went south on a job, including but not limited to running into.",
];

const scratchDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hp-pdf-"));

function runExtract(firstPage, lastPage, minX, maxX) {
  const out = execFileSync(
    process.execPath,
    [
      path.join(__dirname, "extract-runs.mjs"),
      pdfPath,
      String(firstPage),
      String(lastPage),
      "--json",
      "--minX",
      String(minX),
      "--maxX",
      String(maxX),
    ],
    { encoding: "utf8" }
  );
  const runsPath = path.join(scratchDir, `runs-${firstPage}-${lastPage}-${minX}-${maxX}.json`);
  fs.writeFileSync(runsPath, out);
  return runsPath;
}

function splice(text, runsPath, page) {
  const textPath = path.join(scratchDir, `block-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(textPath, text, "utf8");
  // stdio: pipe stderr away here — splice-formatting.mjs's "run not found"
  // warnings are expected noise in this driver (each option is matched
  // against the WHOLE page's runs, not pre-filtered to its own section), not
  // a correctness problem. Run splice-formatting.mjs directly (see README)
  // to see those warnings when working a real option by hand.
  const result = execFileSync(
    process.execPath,
    [path.join(__dirname, "splice-formatting.mjs"), textPath, runsPath, "--pages", String(page)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.trim();
}

// x-ranges read off dump-page.mjs / list-fonts.mjs output for this specific
// PDF layout: page 11's Background is the middle of 3 columns; page 12's
// Heat/Underworld is the left of 2-3 columns. Column boundaries are stable
// per page layout (this book uses a consistent template) but NOT something
// this script infers automatically — a real per-playbook authoring pass
// reads them off a quick dump-page.mjs run first, same as done here.
const runsPath11 = runExtract(11, 11, 283, 520);
const runsPath12 = runExtract(12, 12, 30, 260);

const backgroundResult = background.map(([title, desc]) => ({
  title,
  descriptionText: splice(desc, runsPath11, 11),
}));

const heatResult = heat.map((desc) => ({
  title: null,
  descriptionText: splice(desc, runsPath12, 12),
}));

const underworldResult = underworldParents.map((desc) => ({
  title: null,
  descriptionText: splice(desc, runsPath12, 12),
}));

const output = {
  playbook: "The Crooked",
  sections: [
    { title: "Background", options: backgroundResult },
    { title: "Heat", options: heatResult },
    { title: "Underworld (top-level options only)", options: underworldResult },
  ],
};

const jsonPath = path.join(__dirname, "crooked-background-review.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

function escapeForDisplay(html) {
  // We WANT <b>/<i> to render, so only escape characters outside that
  // enumerated subset. Cheap approach given the enumerated tag set is
  // fixed and known: escape everything, then un-escape just the 4 tags.
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|ul|li)&gt;/g, "<$1$2>");
}

const htmlSections = output.sections
  .map((section) => {
    const items = section.options
      .map((opt) => {
        const titleHtml = opt.title ? `<div class="opt-title">${escapeForDisplay(opt.title)}</div>` : "";
        return `<li>${titleHtml}<div class="opt-desc">${escapeForDisplay(opt.descriptionText)}</div></li>`;
      })
      .join("\n");
    return `<h2>${section.title}</h2>\n<ul class="options">\n${items}\n</ul>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Crooked — Background/Heat/Underworld — extraction review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; }
  .options { list-style: none; padding: 0; }
  .options > li { margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f7f7f7; border-radius: 6px; }
  .opt-title { font-weight: 700; margin-bottom: 0.25rem; }
  .opt-desc b { color: #a33; }
  .opt-desc i { color: #369; }
  .note { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>The Crooked — extraction review (pages 11-12)</h1>
<p class="note">Generated by tools/pdf-extract/build-crooked-review.mjs. Bold/italic here reflects the actual PDF's formatting, detected via embedded font resolution (pdf.js), not guessed. Bold rendered red and italic blue here purely so they're easy to eyeball against the source PDF side by side — the app itself will style &lt;b&gt;/&lt;i&gt; normally.</p>
${htmlSections}
</body>
</html>
`;

const htmlPath = path.join(__dirname, "crooked-background-review.html");
fs.writeFileSync(htmlPath, html);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);

// Acceptance check, printed for visibility.
const hoodlum = backgroundResult.find((o) => o.title === "Hoodlum");
const expected = "You can use Tough instead of Charm to <b>manipulate someone</b> with threats of violence.";
console.log("\nAcceptance check (Hoodlum):");
console.log("  expected: " + expected);
console.log("  actual:   " + hoodlum.descriptionText);
console.log("  MATCH: " + (hoodlum.descriptionText === expected));
