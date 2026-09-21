### 2026-08-02: `@reference` Is the Documented Mechanism, Not a Hack — and Node Subpath Imports Remove the Relative-Path Fragility (Verified in This App's Real Build)
**By:** Luigi (Frontend Developer)

**What:** Skyler challenged whether my `@reference "../../../styles.css";` fix in `header-search.scss` was a fragile hack (hardcoded relative paths, recomputed per file depth, breaks on file move). Two findings: (1) `@reference` is Tailwind v4's own documented directive for exactly this scenario — not a workaround; (2) the relative-path fragility is a *real* complaint with a *documented* fix — Node.js subpath imports — which I have now empirically verified works end-to-end in this app's actual build and have shipped. `header-search.scss` now uses `@reference "#styles.css";`, and `package.json` declares the alias.

---

#### 1. Correction to a premise: this app does NOT use `@tailwindcss/vite`

The task briefing (and my own prior history entry) said this app builds Tailwind via `@tailwindcss/vite`. **That is wrong, and it matters for reading the docs.** Verified:

- `angular.json` has **no** `plugins` array — nothing registers a Vite plugin.
- There is **no** `vite.config.ts` anywhere in the project.
- `.postcssrc.json` exists and contains `{ "plugins": { "@tailwindcss/postcss": {} } }`.
- `@tailwindcss/vite` is in `dependencies` but is referenced by nothing except `package-lock.json` — it is an **unused dependency** (probably a leftover from an earlier setup attempt; worth removing separately, out of scope here).

So the active integration is **`@tailwindcss/postcss`**, auto-detected by `@angular/build:application` via `.postcssrc.json`. This is exactly the setup the Tailwind Angular framework guide describes. Anyone reasoning about "does X work in our pipeline" should reason about the **PostCSS** plugin, not the Vite plugin.

#### 2. Opinion: `@reference` is the documented solution, and Angular's silence is not evidence of incompatibility

**It is not a hack.** `@reference` is a first-class Tailwind v4 directive documented on `tailwindcss.com/docs/functions-and-directives`, and the documented use case is verbatim our situation: styles "compiled in isolation" where `@apply` "can't access your design tokens." The docs explicitly contrast `@reference "tailwindcss"` (built-in defaults only) with `@reference "../../app.css"` (your real stylesheet, including custom `@theme`/`@utility`/`@custom-variant`). We hit precisely the failure the docs predict, and applied precisely the fix the docs prescribe. There is no more-official mechanism being ignored here.

**On Angular's docs saying nothing:** silence is not a contraindication, and I'd argue the opposite reading is unsupportable. `angular.dev/guide/tailwind` and Tailwind's own Angular framework guide are both bare-minimum *installation* walkthroughs — global `styles.css`, use classes in templates, done. Neither one discusses `@apply` **at all**, in any context, let alone rejecting it. A doc that never raises a topic cannot be cited as ruling on it. If Angular's silence meant "unsupported," it would equally mean `@apply` in component SCSS is unsupported, which is plainly false — it has worked in this repo since the Tailwind migration.

**The architectural point that settles it:** Tailwind's docs name "Vue, Svelte, or Angular single-file components with scoped `<style>` blocks, or CSS modules" as the affected class of tools — Angular is *explicitly named*. Angular's `styleUrl` files are the same situation as an SFC `<style scoped>` block: a CSS unit compiled independently, with no lexical connection to the global stylesheet, then scoped via `_ngcontent-*` attribute rewriting. The isolation is identical; only the file layout differs. There is no Angular-specific mechanism that would make `@reference` inappropriate, and empirically (below) Angular's Sass/PostCSS pipeline honors it including the resolver features.

The one thing I'd genuinely call unfortunate is that the correct incantation is discoverable **only** from Tailwind's functions-and-directives page — neither Angular-facing guide mentions it, so a developer following either guide hits "Cannot apply unknown utility class" with no pointer to the fix. That's a documentation gap, not a design problem. Hence documenting it in-repo.

#### 3. Node subpath imports: VERIFIED WORKING in this app's real build

Added to `src/web/monster-of-the-week-web/package.json`:
```json
"imports": {
  "#styles.css": "./src/styles.css"
}
```
and `header-search.scss` line 10 is now `@reference "#styles.css";`.

**Evidence (all via real `ng build --configuration production`, not doc-trust):**

| # | Test | Result |
|---|---|---|
| 1 | Baseline: relative path, capture emitted rule | `.header-search__option.is-highlighted[_ngcontent-%COMP%]{background-color:var(--color-accent, var(--color-indigo-600));color:var(--color-on-accent, var(--color-white))}` |
| 2 | Swap to `@reference "#styles.css"`, rebuild, grep emitted rule | **Byte-identical** to baseline |
| 3 | **Whole-build `diff -r`** of alias build vs. relative build | **Byte-for-byte equal**, including every content-hashed filename |
| 4 | Token *definitions* (`--color-accent:`) leaked into the component chunk? | **0 occurrences** — `@reference` correctly emits no duplicated CSS, as documented |
| 5 | **Negative control:** keep `#styles.css`, delete the `imports` field | **Build FAILS:** `Can't resolve '#styles.css' in '...\shared\header-search' [plugin angular-sass]` |
| 6 | **Negative control:** keep token `@apply`, revert to `@reference "tailwindcss"` | **Build FAILS:** `Cannot apply unknown utility class \`bg-accent\` [plugin angular-sass]` |
| 7 | Development build (`--configuration development`, separate CSS path) | Clean; rule compiles correctly unminified |
| 8 | `npm run test -- --watch=false` | 29 files / 122 passed, 1 skipped — unchanged |
| 9 | `npm pkg get imports` / `npm ls` | npm accepts the manifest, no warnings |

Tests 5 and 6 are the ones that make this non-vacuous: 5 proves the `imports` field is genuinely load-bearing (resolution really goes through Node subpath imports, not some accidental fallback), and 6 proves the alias is genuinely supplying *our* token layer rather than the build succeeding for an unrelated reason.

**Depth independence — the actual claim — proven at three different depths in one build.** The repo has `@apply`-using component SCSS at depths 2, 3, and 5 below `src/`. I temporarily pointed the shallowest (`custom-select.component.scss`, depth 2) and deepest (`mystery-create.scss`, depth 5) at the alias with a probe rule, alongside the real depth-3 `header-search.scss`. All three used the **identical literal** `@reference "#styles.css";` where relative paths would have been `../../`, `../../../`, and `../../../../../` respectively. All three emitted correctly:

```
.luigi-probe-depth2[_ngcontent-%COMP%]{background-color:var(--color-accent, var(--color-indigo-600));color:var(--color-text-primary)}
.luigi-probe-depth5{background-color:var(--color-accent, var(--color-indigo-600));color:var(--color-text-primary)}
```

Both token mechanisms resolve through the alias: `bg-accent` (auto-generated from `@theme static`) and `text-primary` (hand-written `@utility`). Probe files were reverted via `git checkout`; verified no `luigi-probe` remnants anywhere in `src/`.

**Interesting mechanical detail:** the resolution error in test 5 comes from `[plugin angular-sass]`, not from Tailwind. So the `#`-specifier is resolved by **Angular's own Sass/esbuild resolver** (which implements Node resolution semantics, including the `imports` field) before Tailwind's PostCSS pass ever sees it. That is *better* for us than the docs' claim: it doesn't depend on Tailwind's internal resolver behavior at all, and it's the same resolver Angular uses for every other stylesheet specifier. The nearest `package.json` walking up from any component folder is the web project's own `package.json`, so the alias resolves consistently from anywhere in `src/`.

#### 4. The convention (ready for Phases 2/3/4/5/6)

**Every component `.scss` that uses `@apply` against our tokens must start with exactly:**
```scss
@reference "#styles.css";
```
No relative path, no depth counting, identical in every file regardless of nesting, survives moving a component. `@reference "tailwindcss"` is **wrong** for any file that `@apply`s a token/`@utility` class and will fail the build loudly.

The 7 files carrying `@apply` today: `shared/header-search/header-search.scss` (**done**), `shared/custom-select.component.scss`, `features/search/pages/search-results/search-results.scss`, `features/mysteries/pages/mystery-create/mystery-create.scss`, `features/monsters/pages/monsters-list/monsters-list.scss`, `features/monsters/pages/monster-detail/monster-detail.scss`, `features/minions/pages/minion-detail/minion-detail.scss`. The six not-yet-repointed ones still say `@reference "tailwindcss";` and are correct **only** as long as their `@apply` lines use stock Tailwind utilities — each becomes a build failure on the phase that repoints it onto tokens, and that phase should switch it to `#styles.css` in the same edit.

**This supersedes the per-file relative paths Yoshi added to Phases 2-6.** Those paths are correct but should be replaced with the single alias — that's the whole point. Yoshi: the plan text needs one substitution (drop the per-phase computed paths, state the alias once), plus a note that `package.json`'s `imports` field is now load-bearing build config and must not be dropped.

**Alias naming:** `#styles.css` (not the docs' example `#app.css`) so the alias mirrors the real filename `src/styles.css` — one name to learn, not two. Node requires the `#` prefix; the `.css` suffix is conventional, signalling it's a stylesheet and not a TS module alias.

#### 5. Task 1 (separate, trivial): API-modal panel `bg-surface` → `bg-surface-raised`

Applied in `page-layout.html` line 163 per Yoshi's resolution of open item (c) — the file's three overlay panels are now consistently on `surface-raised`. **Zero pixel change today** (`--color-surface` and `--color-surface-raised` are both `var(--color-white)` in both `:root` and `.dark` until Phase 7 lands the real dark fills), so it is a pure role correction that becomes load-bearing in Phase 7. Verified `.bg-surface-raised{background-color:var(--color-surface-raised)}` actually emits in `dist` (per the standing rule that a nonexistent utility name emits nothing, silently), with a bogus-name self-test confirming the check isn't vacuous. This closes item (1) of `luigi-theming-phase1-open-items.md`.

**Why:** Skyler's fragility objection was correct on its merits — per-file relative paths are genuinely bad, and "it's what the docs show" would have been a weak defence given the docs show the subpath-import fix on the same page. Rather than argue the relative path was fine, the right move was to verify the documented refinement actually survives *this* pipeline (PostCSS + Angular Sass, not the Vite plugin the briefing assumed) and ship it. It works, with a byte-identical build artifact as proof, so there is no cost to adopting it and a standing maintenance win for the five remaining phases.

**Files:** `src/web/monster-of-the-week-web/package.json` (`imports` field added), `src/web/monster-of-the-week-web/src/app/shared/header-search/header-search.scss` (alias + updated comment), `src/web/monster-of-the-week-web/src/app/layout/page-layout/page-layout.html` (Task 1 one-word fix).
**Docs for Yoshi:** `docs/theming/theming-plan.md` — Decision B addendum (3), Phases 2-6 per-file relative paths, Conventions subsection.
