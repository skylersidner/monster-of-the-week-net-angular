### 2026-08-02: Theming Plan — `@reference` Convention Finalized as `#styles.css` Subpath Import; Build Pipeline Corrected to `@tailwindcss/postcss`
**By:** Yoshi (Architect)
**Requested by:** Skyler Sidner — formalize Luigi's empirically-verified fix into `docs/theming/theming-plan.md`.

**What:** Applied Luigi's shipped fix (`.squad/decisions/inbox/luigi-theming-reference-directive-evaluation.md`) throughout `docs/theming/theming-plan.md`:

1. Every `@reference` instruction (Decision B's addendum, the Conventions subsection, Phases 1–6, the Risk Register) now reads the single, depth-independent `@reference "#styles.css";`, replacing every hand-computed relative-path example (`../../../styles.css`, per-file depth variants). The two remaining relative-path mentions in the doc are deliberate historical callouts ("an earlier revision recommended X; superseded by Y") — not live instructions.
2. Added a short "why not a hack" note at Decision B's addendum: `@reference` pointed at a project's own stylesheet is Tailwind's documented mechanism for component-scoped/isolated-compilation stylesheets (docs name Angular alongside Vue/Svelte/CSS Modules); Angular's own docs simply never cover `@apply`-in-component-styles for any framework, which is why the fix wasn't discoverable there.
3. Documented `package.json`'s `imports` field (`"#styles.css": "./src/styles.css"`) as load-bearing build configuration, not a CSS-only convention — added a new Risk Register row for its removal/renaming as a distinct risk from the general `@reference` mistake.
4. Corrected every place the doc stated or implied a Vite-plugin-based Tailwind integration (one Risk Register row) to `@tailwindcss/postcss` (confirmed via `.postcssrc.json`, no `vite.config.ts`, no Vite plugin entry in `angular.json`); noted `@tailwindcss/vite` as an unused, low-priority-to-remove dependency in the Decision B addendum and the Overview status paragraph.
5. Added a dated Overview paragraph pointing at this resolution and both underlying investigation files.

**Why:** Skyler's fragility complaint about the relative-path `@reference` fix was legitimate even though `@reference` itself was never in question — Luigi's empirical verification (real production builds, negative controls, three-depth proof) closed the gap the docs themselves point to (`package.json` subpath imports), so the plan should reflect the settled convention, not the superseded one, before Phases 2–6 implementation proceeds against it.

**Files:** `docs/theming/theming-plan.md` (Overview, Decision B addendum, Conventions subsection, Phases 1–6, Risk Register, Summary).
