# Theming Architecture & Implementation Plan

**Monster of the Week — Angular Web App**
**Produced by:** Yoshi (Architect) · Squad
**Requested by:** Skyler Sidner
**Date:** 2026-08-01

---

## Overview

This document plans **how theming should work mechanically** in the app — not what the dark palette looks like. Specific token *values* (the dark-mode hex/oklch fills) are Rosalina's deliverable, produced against the token *names/roles* this document defines. Treat this as a workstream that sits on top of `docs/tailwind-migration-plan.md` (now fully complete) rather than a continuation of it: the migration got every template onto literal Tailwind utility classes; this plan re-points those literal classes onto a semantic token layer so a theme switch is possible at all.

**The problem this plan solves:** every component template today uses literal Tailwind palette utilities directly (`bg-white`, `bg-indigo-700`, `text-slate-950`, `border-slate-200`, badge colors, …). Literal palette utilities are inert with respect to a theme switch — `bg-white` does not "know" it should become `bg-slate-900` in dark mode. Nothing in `src/styles.css` today defines a dark variant, a semantic token, or any state that a theme toggle could hook into. A handful of places (the "Soon" nav badge, the API-unavailable modal, the notification toast) bypass Tailwind entirely via inline `style`/`[style]` and would stay light-only forever if untouched.

**The goal:** introduce a semantic CSS-custom-property token layer, re-point every component's literal color classes onto it (phased by domain, same cadence the Tailwind migration used), add a `ThemeService` that toggles a `.dark` scope on `<html>` and persists the user's choice, and add a thin Settings view reachable from the existing user menu.

**Constraint:** no dark-palette color values are chosen in this document. Every `@theme` color block below uses the *current light values* as placeholders so the app is visually unchanged until Rosalina's dark values land — theming infrastructure ships dark-inert, then gets its palette filled in as a separate, low-risk swap.

**Status update (2026-08-02):** Rosalina has completed the dark palette — see `docs/theming/dark-theme-palette.md` for the full value table, badge-hue rationale, modal/overlay/icon/error-state guidance, and accessibility notes. That document surfaced six open questions; Skyler has reviewed and answered all six, and this plan has been updated to fold each decision in at its natural location (Key Architectural Decisions, Token Catalogue, the relevant Phase(s), Risk Register) rather than as a standalone changelog entry. Settled: (1) `--color-accent`/`--color-danger` stay single tokens per role — no button-fill split — resolved via Rosalina's lighten-and-flip mechanism (see Decision B); (2) `--color-on-danger` is added to the Token Catalogue and the confirm-delete modal's hardcoded delete-button text is called out for re-pointing in Phase 2; (3) the monster-archetype badge gets `--color-badge-archetype`/`--color-on-badge-archetype` in the Token Catalogue, called out explicitly in Phase 4 (`monsters-list.html`) and Phase 5 (`monster-detail.html`); (4) the speculative mystery-badge proposal remains a non-committal placeholder — no catalogue row, no phase action, deferred until the feature exists; (5) the brighter toast colors (`emerald-700`/`red-700`) are approved as final, not provisional; (6) the table-striping fix now uses `--color-accent-subtle` for even rows as the plan's actual instruction (Phase 5), not a footnoted override. See the sections below for exactly where each lands.

**Follow-up (2026-08-02):** Luigi's review of this plan (plus Rosalina's palette doc) ahead of Phase 1 implementation raised five further points; Skyler responded to each and this plan has been updated accordingly. Applied directly: (2) Decision D's `resolvedTheme` construction is corrected to a valid Angular pattern (a pure `computed()` reading a `toSignal(fromEvent(matchMedia, 'change'))`-backed signal, not a `computed()` that owns the listener itself), and the zero-flash guarantee (the inline `<head>` script) is decoupled from the core theming mechanism and moved to a new, isolated Phase 8 — Phase 0 still ships a fully working `ThemeService` end-to-end, with a possible, explicitly accepted flash on cold loads until Phase 8 closes that gap; (3) Decision I now explicitly names the existing `CustomSelectComponent` as the Settings picker widget, rather than leaving the control unspecified; (4) the two stale "confirm with Rosalina" bullets in Phase 1 are updated to state her actual, already-published resolutions as decided; (5) Phase 0's scope now includes a grep-grounded test-disabling sweep (one real hit found across the whole app: `search-results.spec.ts`; `page-layout.spec.ts` was a false lead — see Phase 0), with the one affected later phase responsible for re-enabling its own previously-disabled assertions. Now also resolved: (1) whether the Token Catalogue's `-bg`/`-text` naming suffix collides with Tailwind v4's generated utility-class names — Skyler's call (2026-08-02) is to extend the `on-*` convention already used for `--color-on-accent`/`--color-on-danger` to every fill/text pair; every `-bg`/`-text`-suffixed token in the Token Catalogue below has been renamed accordingly and every phase reference updated to match. **This naming decision is final and fully applied** throughout this document and `docs/theming/dark-theme-palette.md` — see the "Resolved (2026-08-02) — token naming vs. Tailwind-generated utility classes" subsection immediately after the Token Catalogue below.

**Correction (2026-08-02) — token→utility mechanism, found while implementing Phase 1.** Beginning Phase 1 implementation, Luigi found — and Skyler independently pushed on, directing a proper fix rather than a workaround — that this plan's Decision B carried an unstated, incorrect assumption about *how* a Tailwind v4 utility class name is generated from a `@theme` token: Tailwind does pure prefix-concatenation with no awareness of "family words," so a token like `--color-text-primary` does not auto-generate the clean `text-primary` class this plan's re-pointing map always assumed — it generates `text-text-primary`, which silently emits no CSS if the clean name is used instead of it. The investigation (grounded in Tailwind's own `/docs/theme`, `/docs/adding-custom-styles`, and `/docs/dark-mode` guidance) also surfaced two further, independent defects of the same "silently or loudly missing CSS" shape: a bare `@theme` block tree-shakes unused tokens out of `:root` while `.dark` always emits in full (fixed via `@theme static`), and component `.scss` files' `@apply` lines fail the build the moment they reference a token while still pointed at `@reference "tailwindcss"` instead of this app's own `styles.css`. All three are corrected in `src/styles.css` and documented in full below — see Decision B's addendum immediately below, the Token Catalogue's naming subsection and new Conventions subsection, and the per-phase `@reference` call-outs added to Phases 2–6. No token was renamed and no phase's target class names changed as a result — see Luigi's full investigation and verification methodology at `.squad/decisions/inbox/luigi-theming-token-utility-mechanism.md`. Phase 1's own scope also grew by one component (`shared/header-search/`), folded in below — it predates this plan and was missed by its original repo scan, not added new work.

**Update (2026-08-02) — `@reference` relative-path fragility resolved via Node subpath imports; build-pipeline correction.** Skyler challenged the per-file relative-path `@reference` fix documented above (e.g. `@reference "../../../styles.css"`, recomputed per file depth) as fragile. Yoshi and Luigi independently confirmed `@reference` itself is Tailwind's own documented mechanism, not a workaround — and Luigi went further, empirically verifying (real `ng build --configuration production` runs, with negative controls, not just doc-reading) that Tailwind's own documented fix for the fragility complaint — a `package.json` Node.js "subpath imports" alias — works end-to-end in this app's actual build. Adopted throughout this document: every `@reference` line is now the single, depth-independent `@reference "#styles.css";`, backed by a `package.json` `imports` entry that is now load-bearing build configuration (Decision B's addendum, immediately below, has the full mechanism and rationale). Separately, and unrelated to this specific question: Luigi also found this app's actual Tailwind build integration is `@tailwindcss/postcss` (via `.postcssrc.json`), not `@tailwindcss/vite` — this document is corrected wherever it described or implied a Vite-plugin-based integration; `@tailwindcss/vite` remains an unused, safely-removable dependency in `package.json` (low priority, not a new phase). See `.squad/decisions/inbox/yoshi-theming-reference-directive-evaluation.md` and `.squad/decisions/inbox/luigi-theming-reference-directive-evaluation.md` for the full investigation and verification evidence.

**Status update (2026-08-02) — `--color-surface-hover` token added to the Catalogue.** Luigi's Phase 2 implementation review surfaced a recurring neutral-hover-fill gap: the app has several `bg-gray-100`/`hover:bg-gray-200`-style neutral secondary-surface fills (e.g. the confirm-delete modal's Cancel button) with no token to map onto, worked around temporarily via `hover:bg-accent-subtle` — semantically wrong, since `--color-accent-subtle` is brand-colored (indigo-tinted), not neutral. Skyler approved a new `--color-surface-hover` token (Category A, lives in the existing `@theme static` block) to close it. A separate, smaller gap Luigi also flagged in the same review — `--color-accent-muted`, for a lost shade distinction on `custom-select`'s sub-label — is deliberately **not** added at this time, Skyler's call. Rosalina is picking `--color-surface-hover`'s dark value next; Luigi then replaces the Phase 2 placeholder and applies the token everywhere it's called out below (Phases 3-5). See the Token Catalogue and `.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`.

---

## Architecture

### Key Architectural Decisions

#### A. Manual toggle vs. `prefers-color-scheme`

The brief for this workstream already implies the answer: a Settings view with a user-facing theme picker only makes sense if the app can hold an explicit preference that overrides the OS. Pure `@media (prefers-color-scheme: dark)` — with no class/attribute hook — cannot be overridden by a UI control at all; it would make the Settings picker a lie.

**Decision:** use Tailwind v4's class-based dark variant (`@custom-variant dark (&:where(.dark, .dark *));`), scoped to `<html>`, as the single source of truth at runtime. `prefers-color-scheme` is not discarded — it is used exactly once, as the **seed value** when no explicit preference has been persisted yet (first visit). Once a user picks a theme in Settings (or the system default is silently adopted), that stored preference wins on every subsequent load, and the OS-level media query is no longer consulted unless the user explicitly selects "Match system" as their preference (see Decision D — the preference type is `'light' | 'dark' | 'system'`, not just a resolved boolean, precisely so "follow the OS" remains an explicit, re-selectable choice rather than a one-time default).

#### B. Semantic tokens vs. sprinkling `dark:` onto every literal class

Two mechanisms were weighed:

1. **Mechanical `dark:` pass** — keep every literal utility (`bg-white`, `text-slate-950`, …) and add a paired `dark:` variant next to each one (`bg-white dark:bg-slate-900`). Zero new abstraction, but every colored class in the app doubles, forever. Any new component added after this plan ships must remember the `dark:` pairing by convention — nothing enforces it. A third theme (sepia, high-contrast, whatever comes next) is structurally impossible without a second variant prefix stacked onto every class a third time (`bg-white dark:bg-slate-900 hc:bg-black`), and the class list on a given badge or button grows without bound as themes are added.
2. **Semantic token layer** — define role-based custom properties in `@theme` (`--color-surface`, `--color-text-primary`, `--color-border`, …), give each Tailwind utility a matching name (`bg-surface`, `text-primary`, `border-default`), and re-point every literal palette class in every template to its semantic equivalent. The *values themselves* are then overridden per theme scope via a plain CSS selector block (`.dark { --color-surface: ...; }`), never via a `dark:` prefix on the utility class in the template at all for anything token-covered.

**Decision: semantic tokens (option 2).** The reasoning that matters here is a Tailwind v4-specific mechanism, not a generic preference:

> Every `@theme` declaration in Tailwind v4 compiles to a **real CSS custom property at `:root`**, and generated utilities reference that property via `var(...)` rather than inlining a literal value at build time (this is the same feature the migration doc already leans on for `--color-indigo-700` and the two `--breakpoint-*` overrides). That means `bg-surface` does not compile to `background-color: #ffffff`; it compiles to `background-color: var(--color-surface)`. If a `.dark` class further up the DOM tree overrides `--color-surface` to a different value, **every element already using `bg-surface` repaints correctly with zero template changes and no `dark:` variant anywhere.** Theme-switching becomes "just CSS custom property cascade" — the `@custom-variant dark` declaration from Decision A is kept only as an escape hatch for the rare non-color, non-token exception (e.g., a one-off shadow or opacity tweak that genuinely differs by theme and isn't worth promoting to a token), not as the primary mechanism.

This resolves the third-theme concern the same motion: a third theme is one more selector block (`.theme-sepia { --color-surface: ...; }`) defining the same property names — zero template changes, because templates only ever reference the semantic utility, never the theme.

**The accepted trade-off:** this is real, upfront, mechanical work — every literal palette class the Tailwind migration just finished inlining into ~19 templates now needs a second pass to re-point it onto a token utility. This is comparable in size and shape to the original migration's per-component passes, and this plan phases it the same way (domain by domain, Goal/Risk/Files/Inspection Points per phase) for the same reason: it's real risk, not a one-shot rewrite. The payoff is that this is the *only* mechanical pass ever required — a second and third theme are pure token-value additions with no template risk at all, and any future component author gets theming for free just by using semantic utilities, the same way the Tailwind migration made spacing/layout consistency "free" via the Pattern catalogue.

**Resolved (2026-08-02) — one token per role, not a split button-fill token:** Rosalina's dark palette raised whether `--color-accent`/`--color-danger` should split into a separate button-fill token, since in dark mode a single token can no longer simultaneously be an unmodified good text-on-surface color *and* an unmodified good button-fill color the way `indigo-600`/`red-600` happen to be in light mode (see `docs/theming/dark-theme-palette.md`, Philosophy #3). **Decision: no split — one token per role stays the design, in both directions.** Skyler's call is explicit: brand consistency of the accent/danger button look across themes (whether the filled button reads as a "straightforwardly darker" version of its light-mode self) is not an important concern; keeping a single token that does double duty is worth more, because it keeps the mechanism simple for adding a third or fourth theme later — one value to define per theme, not two. The way a single token still satisfies both jobs in dark mode is Rosalina's **lighten-and-flip** construction: lighten the base hue for dark mode (`indigo-400`/`red-400`) and flip the paired on-color (`--color-on-accent`/`--color-on-danger`) to a dark neutral, rather than adding a second fill-specific token. This is now the settled mechanism for `--color-accent`/`--color-danger`, and the accepted pattern any future theme's button treatment should follow too — see the Token Catalogue below for the corresponding `--color-on-danger` addition this decision requires.

**Correction (2026-08-02) — the actual token→utility mechanism, verified against a real build.**

Everything above about `@theme` compiling to a real `:root` custom property, referenced via `var()` rather than inlined, remains exactly correct — that is still the entire reason a `.dark` override repaints every consumer with zero template change, and nothing about that mechanism changes here. What was wrong was an unstated assumption about *how the utility class name for that property gets generated*.

Tailwind v4's utility generator does pure prefix concatenation: for every color-consuming family (`bg-`, `text-`, `border-`, `ring-`, `fill-`, `stroke-`, `outline-`, `decoration-`, `accent-`, `caret-`, `divide-`, and more), it glues the family prefix in front of the **entire** remainder of a `--color-*` property's name. It never parses or strips a trailing "family word" out of that remainder, and there is no way to scope a `--color-*` entry to a single family via naming. That single fact splits the Token Catalogue into two mechanically distinct groups:

- **Category A — role-named, genuinely multi-family, stays in `@theme` and relies on automatic generation.** Every token whose role name contains no utility-family word — `surface`, `accent`, `danger`, `on-accent`, `badge-monster`, `sidebar-surface`, `toast-success`, and the rest of the Catalogue's already-role-named tokens — reads correctly under every family it's used with (`bg-accent`, `text-accent`, `border-accent`, `fill-accent` all make sense as names), so automatic generation gives exactly the classes wanted. Nothing about these changes.
- **Category B — the role *is* a single utility family, gets a hand-written `@utility` block instead.** `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-sidebar-text`, and `--color-focus-ring` all have a role that *is* the family (a text color, a border color, a ring color) — the property's own name therefore necessarily contains that family word, and concatenation stutters: `text-text-primary`, `border-border`, `ring-focus-ring`. This is not a bug to route around; it is the documented, correct consequence of naming a token after the very utility family it's meant to be used with. Tailwind's own documented answer for exactly this shape — controlling a utility's class name independently of the custom property behind it (`/docs/adding-custom-styles`, the `@utility` directive) — is to hand-write the utility. A hand-written `@utility` gets the identical variant pipeline (`hover:`, `focus:`, `md:`, `dark:`, arbitrary breakpoints, …) as a generated one; it is simply not *derived* from the property name by string concatenation. `src/styles.css` now hand-defines eight such utilities directly beneath the `@theme static` block (`text-primary`, `text-secondary`, `text-muted`, `border-default`, `border-strong`, `text-sidebar`, `text-sidebar-muted`, `ring-focus`), each documented inline with this same reasoning.

**No token is renamed by this fix, and no class name this document specifies changes.** Every class `@utility` produces above is exactly the name this plan's Phase 1 re-pointing map (and every other phase below) already prescribes — this correction changes *how* those names come to exist, not what they are. Wherever this document's prose previously implied a Category B token's clean class name would come from automatic generation, that assumption is corrected below (Token Catalogue naming subsection, new Conventions subsection, Phase 1's re-pointing map).

**Accepted trade-off:** a hand-written `@utility` does not support Tailwind's slash-opacity modifier (`text-primary/70` emits nothing — confirmed empirically against a real build). Where a translucent variant of a Category B token is genuinely needed, it gets its own named utility with an explicit `color-mix()` rather than a modifier on the base utility — see `text-sidebar-muted` in `styles.css`, which covers the one place Phase 1 needed this (the disabled/muted sidebar nav item); see the Token Catalogue's naming subsection below for the one open question this leaves for Rosalina.

Verified empirically end-to-end — probe build, a 194-class whole-template no-op sweep, and a live two-theme Playwright diff against 13 real shell/header-search elements — see `.squad/decisions/inbox/luigi-theming-token-utility-mechanism.md` §8 for the full methodology.

**Addendum — `@theme` must be declared `static`, or tokens silently vanish from light mode.** A second, independent defect surfaced by the same investigation: by default Tailwind tree-shakes `@theme` custom properties out of `:root`, emitting only the ones a *used* utility (or `@utility` body) actually references. The `.dark { … }` override block, by contrast, is plain hand-written CSS and is always emitted in full, verbatim, regardless of usage. Those two behaviours disagree, and in the Phase-0-as-shipped build they already had: five tokens (`--color-badge-minion`, `--color-badge-archetype`, `--color-weapon-chip`, `--color-danger-subtle`, `--color-success`) were present under `.dark` but silently absent from `:root` — defined in dark mode, undefined in light mode. This is invisible for a Tailwind-generated utility (a token is emitted precisely because some utility needs it) but silently breaks any hand-written CSS that reads a token directly via `var(--color-…)` — exactly Phase 5's admin table row-striping fix, which would have built cleanly and simply rendered unstyled in light mode.

Fixed by declaring `@theme static` in place of a bare `@theme`. This forces every token to be emitted to `:root` regardless of whether a utility currently references it. Verified: all 39 tokens under `.dark` are now also present in `:root` (was 5 missing); cost is 767 bytes of CSS. **This is now load-bearing, not stylistic — any token added to the Catalogue in a future phase, or for a future theme, must go inside the existing `@theme static { … }` block in `styles.css`, never a second, bare `@theme { … }` block**, which would silently reintroduce the identical light/dark asymmetry for whatever tokens land inside it.

**Addendum — `@apply` in component SCSS needs `@reference` pointed at this app's own token source, not at bare `tailwindcss`.** Every component `.scss` file in this app that uses `@apply` opens with `@reference "tailwindcss";`, which loads only Tailwind's own default theme into that file's compilation context — none of this plan's `@theme` tokens or hand-written `@utility` classes exist there. `@apply bg-accent` (or any other token-backed class) under that reference fails the build outright (`Cannot apply unknown utility class 'bg-accent'`) — loud, not silent, but a hard per-file blocker the moment any phase below repoints an `@apply` line onto a token or `@utility` class.

**Why this is Tailwind's documented mechanism, not a hack.** `@reference` pointed at a project's own stylesheet is exactly the pattern Tailwind's `/docs/functions-and-directives` page documents for component-scoped or otherwise isolated-compilation stylesheets — its own examples cover Vue and Svelte `<style>` blocks and CSS Modules, and its prose explicitly names Angular alongside them as sharing the same isolated-compilation shape (a component stylesheet compiled as its own PostCSS unit, with no lexical connection to the global stylesheet). Angular's own getting-started docs (`angular.dev/guide/tailwind`) and Tailwind's Angular framework guide never mention `@apply`, `@reference`, or component-scoped theming at all — for any framework — so that silence is scope (a bare installation walkthrough), not evidence the mechanism is Angular-inapplicable; it's simply why the fix wasn't discoverable from Angular's docs alone. Confirmed independently by both Yoshi and Luigi against Tailwind's primary docs — see `.squad/decisions/inbox/yoshi-theming-reference-directive-evaluation.md` and `.squad/decisions/inbox/luigi-theming-reference-directive-evaluation.md`.

**Fix:** every `@apply`-bearing component `.scss` file's `@reference` must resolve to this app's own `src/styles.css` via a Node.js **subpath import alias**, not a hand-computed relative path. `src/web/monster-of-the-week-web/package.json` declares:
```json
"imports": {
  "#styles.css": "./src/styles.css"
}
```
and every affected file opens with exactly:
```scss
@reference "#styles.css";
```
identical in every file regardless of its folder nesting — no relative-path computation, no per-depth variants, and a file survives being moved without its `@reference` line needing to change. (An earlier revision of this document instead recommended a hand-computed relative path per file, e.g. `@reference "../../../styles.css"`; that recommendation is superseded by the alias above throughout this document.) Verified end-to-end via real `ng build --configuration production` runs — the compiled component rule correctly reads `background-color:var(--color-accent, var(--color-indigo-600))` and repaints correctly in both themes through Angular's emulated encapsulation; negative controls (removing the `imports` entry; reverting to `@reference "tailwindcss"`) each reproduce the exact loud build failure the fix prevents, confirming the alias — not some accidental fallback — is what makes resolution succeed; depth-independence was proven directly at three different folder depths in a single build. See `.squad/decisions/inbox/luigi-theming-reference-directive-evaluation.md` for the full methodology.

**`package.json`'s `imports` field is now load-bearing build configuration, not merely a CSS-file convention.** Every token-consuming `@apply` block in every component stylesheet resolves through this single entry — if a future contributor removes or renames the `#styles.css` alias (e.g. while tidying `package.json`, or renaming `src/styles.css` without updating the map), every one of those files fails the build simultaneously with `Can't resolve '#styles.css'`, not just the file being edited at the time. Treat this entry with the same care as any other build-critical config (`tsconfig.json` paths, `angular.json` builder options) — it is resolved by Angular's own Sass/esbuild resolver (Node subpath-imports resolution), not by Tailwind's PostCSS pass, so it has zero dependency on which Tailwind build integration is active (see the build-pipeline correction immediately below).

**Build-pipeline correction (2026-08-02):** this app's active Tailwind integration is **`@tailwindcss/postcss`**, auto-detected via `.postcssrc.json` (`{ "plugins": { "@tailwindcss/postcss": {} } }`) — confirmed by the absence of any `vite.config.ts` and the absence of any Vite plugin entry in `angular.json`. `@tailwindcss/vite` is listed in `package.json`'s dependencies but is referenced by nothing in the build; it is an unused dependency, likely left over from an earlier setup attempt, and is worth removing at some point (low priority — a one-line cleanup, not a new phase). Anywhere this document previously stated or implied a Vite-plugin-based Tailwind integration, read it as `@tailwindcss/postcss` instead.

**Per-file obligation, confirmed against the actual app (ten `.scss` files use `@apply` today):** every phase below that repoints an `@apply` line onto a token/`@utility` class must make this `@reference` change to that file *first*, not just swap the class name inside the `@apply` — Phase 2 (`custom-select.component.scss`), Phase 3 (`minion-detail.scss`), **Phase 4 (`monsters-list.scss`** — its `.action-btn:hover:not(:disabled)` rule repoints per that phase's own Inspection Points, so Phase 4 is affected too, not only 2/3/5/6 as an earlier framing of this finding assumed), Phase 5 (`monster-detail.scss`, `mystery-detail.scss`, `data-admin.scss`, `weapon-tag-admin.scss`), and Phase 6 (`mystery-create.scss`). The identical `@reference "#styles.css";` line applies in every one of these — there is no per-file path to compute. `header-search.scss` (Phase 1, folded in below) already has this fix applied, using the alias. One further, smaller finding: `search-results.scss` (touched in Phase 4) has an `@apply`-based `mark` highlight rule (`bg-indigo-100 text-indigo-900`) that is literal, not token-backed, and no phase currently directs it to be tokenized — flagged so Phase 7's sweep explicitly also greps `.scss`/`@apply` bodies, not just templates, since a literal color living inside an `@apply` block is exactly the kind of straggler that sweep exists to catch.

#### C. Token scope application point and Angular encapsulation

The `.dark` class is applied to `<html>`, not `<body>` and not a component host:

- It must be an ancestor of the entire document, including `<body>`, so custom property overrides cascade everywhere without exception.
- `<html>` exists in the DOM the instant the browser starts parsing `<head>`, before `<body>` or `app-root` exist — this is what makes the inline FOUC-prevention script in Decision E possible at all (see below). A `<body>`-scoped or component-scoped class could not be set that early.
- **Angular's emulated view encapsulation is a non-issue here**, for the same reason the original Tailwind migration noted Tailwind utilities aren't scoped at all (`docs/tailwind-migration-plan.md`, "Angular 22 + Tailwind v4 Notes"): `bg-surface` is a global utility class regardless of which component's template uses it. The `.dark` scope selector sits on `<html>`, entirely outside any component's shadow-emulated attribute-selector boundary. There is no scenario where a component's encapsulated styles need to "know about" the theme class — they never reference it directly; they reference the semantic utility, and the utility's resolved custom property already differs by theme before the component's styles are ever evaluated.

#### D. `ThemeService` — API surface and initialization

Lives at `src/app/core/theme.ts`, following the same shape as the existing `NotificationService` (`@Injectable({ providedIn: 'root' })`, `signal`-based state, no NgRx — consistent with this codebase's established signals-first convention per `.squad/decisions.md`).

```typescript
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference: Signal<ThemePreference>;   // what the user chose (or 'system' default)
  readonly resolvedTheme: Signal<ResolvedTheme>;   // 'system' resolved against matchMedia, for display purposes only

  setPreference(preference: ThemePreference): void;  // updates signal, persists, re-applies DOM class
  initialize(): void;                                 // reconciles persisted/seeded value with DOM class; called once at bootstrap
}
```

Notes on the surface, not the implementation:
- No plain `toggle()` two-state flip is exposed as the primary API — the Settings picker is a 3-way choice (Light / Dark / Match system), because collapsing "system" into a toggle loses the "explicitly follow the OS" state a user may want to return to. A `toggle()` convenience over `resolvedTheme` may still be added later (e.g. a quick-toggle icon somewhere outside Settings) without changing this surface.
- Persistence is not called directly against `localStorage` inline in the service — see Decision F.

**Correction (2026-08-02) — `resolvedTheme`'s actual construction.** An earlier draft of this document described `resolvedTheme` as a `computed()` that itself owns a `matchMedia` change listener. That is not valid Angular: a `computed()` must be a pure function of other signals — Angular's reactivity graph is free to re-evaluate it any number of times (or not at all, if never read), so it cannot also be the thing that registers a subscription/event listener as a side effect. This is a factual correction, not a judgment call:

```typescript
// imports: toSignal from '@angular/core/rxjs-interop'; fromEvent, map from 'rxjs'

private readonly systemPrefersDark = toSignal(
  fromEvent<MediaQueryListEvent>(
    window.matchMedia('(prefers-color-scheme: dark)'),
    'change'
  ).pipe(map((e) => e.matches)),
  { initialValue: window.matchMedia('(prefers-color-scheme: dark)').matches }
);

readonly resolvedTheme: Signal<ResolvedTheme> = computed(() => {
  const pref = this.preference();
  return pref === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : pref;
});
```

`toSignal(fromEvent(...))` owns the one `matchMedia` listener, registered exactly once when the field initializes (a class field initializer runs inside the constructor's injection context — the same reason `private http = inject(HttpClient)`-style field injection is valid elsewhere in this codebase; `toSignal` ties its subscription lifecycle to that context and tears it down via `DestroyRef` automatically, no manual cleanup needed). `resolvedTheme` itself stays a genuinely pure `computed()` — it only *reads* two other signals (`preference` and `systemPrefersDark`), it never subscribes to anything itself, which is exactly what makes it valid. Nothing else about Decision D's public API changes.

**Initialization timing:** `ThemeService.initialize()` is invoked via `provideAppInitializer` (Angular 22's initializer API; no factory/token boilerplate needed) in `app.config.ts`, so the class is reconciled before the router starts navigating and before the first component renders. This alone does **not** prevent a flash of wrong theme — see Decision E for why an additional, earlier mechanism is required, and for when that mechanism actually ships.

#### E. FOUC prevention — inline script, not just an Angular initializer

This app is confirmed CSR-only: `main.ts` calls `bootstrapApplication` directly with no `provideClientHydration`/server entry point, and `angular.json` defines no `server` builder target — SSR is not a concern, but that also means **there is no server-rendered HTML to paint correctly on first byte**; the browser has an essentially blank `<body><app-root></app-root></body>` until the JS bundle parses, executes, and bootstraps. An `APP_INITIALIZER`-style fix inside Angular still runs *after* that bundle has loaded and executed — on a slow connection or cold cache, that's long enough for the un-themed default to paint first, then snap to the correct theme once Angular boots. That visible snap is the flash this decision prevents.

**Verified (2026-08-02) — the inline-script approach is sound under Angular's actual CSR bootstrap sequence, and doesn't get wiped or fought once Angular boots.** `bootstrapApplication` mounts the root component into whatever DOM node matches `app-root`'s selector, inside `<body>` — it never touches anything outside that subtree. `<html>` (and its `classList`) is parsed and exists in the DOM the instant the browser starts parsing the document — before `<body>`, before `app-root`, before any Angular JS has even been fetched, let alone executed. There is no hydration step (CSR-only, confirmed above) that would diff/reconcile a server-rendered `<html>` against a client render and strip an "unexpected" class — hydration is the one mechanism that could plausibly touch ancestor markup a framework didn't render, and it's entirely absent here. Nothing in Angular's own bootstrap, router, or change detection reads or writes `document.documentElement.classList` for any reason of its own. The only code that will ever touch that class after the inline script sets it is this plan's own `ThemeService` — and `ThemeService.initialize()` is explicitly a *reconciliation*, applying the same resolved value the inline script already computed, not a blind reset. A class the inline script sets pre-bootstrap survives completely untouched through Angular's entire bootstrap and runtime lifecycle unless `ThemeService` itself later changes it in response to a real preference change.

**Decision:** add a tiny synchronous inline `<script>` as the *first* thing in `index.html`'s `<head>`, before the stylesheet `<link>` and before any bundle script tag:

```html
<script>
  (function () {
    var stored = localStorage.getItem('motw:theme'); // 'light' | 'dark' | 'system' | null
    var resolved = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

This executes synchronously during HTML parsing, before `<body>` is even parsed, guaranteeing zero flash regardless of bundle load time. `ThemeService.initialize()` then reconciles Angular's reactive state against whatever the inline script already set on the DOM — the two are not in conflict; the inline script is a *pre-paint mirror* of the same read-persisted-or-seed-from-system logic the service owns, kept intentionally tiny (no framework, no imports) because it must run before any JS module graph is available. Any change to the persistence key or resolution rule must be made in both places — call this out explicitly as a maintenance note wherever this script actually ships (see Sequencing, immediately below).

**Sequencing (updated 2026-08-02, per Skyler): the zero-flash guarantee is deferred to Phase 8, decoupled from the core theming mechanism.** Skyler's read is correct — nothing about how tokens, `ThemeService`, or template re-pointing work depends on *when* the flash gets solved. So: Phase 0 still creates `ThemeService` and calls `initialize()` via `provideAppInitializer` so the app applies the correct theme class reactively as soon as Angular boots — the app **works** end-to-end from Phase 0 onward. What Phase 0 no longer includes is this inline `<head>` script and its "zero flash, verified on a throttled network" bar — that implementation, and the explicit two-place-duplication maintenance note above, move to Phase 8, after all the template re-pointing work is done, so it can be built and verified in isolation without touching or re-touching any phase that repoints templates. Until Phase 8 ships, a cold load may show a brief flash of the wrong theme before Angular's `initialize()` reconciles it — an accepted, tracked gap, not a Phase-0-blocking defect (see Phase 0's Goal and the Risk Register).

#### F. Persistence — `localStorage`, behind a seam, not a backend setting

The app has no auth system, no user model, and no existing persistence layer of any kind (confirmed: no `localStorage`/`sessionStorage` usage anywhere in the app today). Two options exist for storing the preference: client-only `localStorage`, or a per-user setting on the .NET API (`src/api/MonsterOfTheWeek.Api`).

**Decision: `localStorage` now.** A backend-persisted setting requires a `User` concept and an auth boundary that don't exist yet — building either just to ship a theme toggle would be solving a problem this app doesn't have yet, and would block this entire workstream on an unrelated, much larger one. `localStorage` matches the app's current maturity level exactly: single browser, single implicit "user," no cross-device sync expectation.

This is not treated as a permanent architectural dead end: the persistence read/write is isolated behind a narrow interface inside `theme.ts` (e.g., a private `readStoredPreference()` / `writeStoredPreference()` pair, or a small injectable if a second consumer ever needs it) rather than inlined as scattered `localStorage.getItem` calls throughout the service. When auth ships, swapping the backing store to a `PUT /api/users/{id}/preferences`-style call is a change inside that one seam, not a rearchitect of `ThemeService`'s public API or of any component that consumes it. Flagged here explicitly as a known future migration path, not silently deferred.

#### G. Settings view — placement

Two placement conventions exist today: `src/app/features/*` (domain-vertical resources — mysteries, monsters, minions, bystanders, locations, search — each with its own `*.routes.ts` loaded via `loadChildren`, its own list/detail/create pages, and its own domain service) and `src/app/pages/*` (app-level, cross-cutting utility views — `dashboard`, an aggregate view over all domains, and `data-admin`, an app configuration surface for reference data — both registered directly via `loadComponent` in `app.routes.ts`, with no nested routes file of their own).

**Decision: `src/app/pages/settings/`.** Settings has no domain entity, no list/detail/CRUD shape, and no per-item resource — architecturally it is the same shape as `data-admin`: a single cross-cutting page that configures something app-wide. It gets a direct `loadComponent` entry in `app.routes.ts` at `path: 'settings'`, matching the `dashboard`/`data-admin` pattern exactly rather than introducing a `settings.routes.ts` wrapper file that would only ever contain one route.

#### H. User menu integration

`page-layout.html` (~line 108-113) already renders a panel with "Your profile" and "Sign out" — both currently non-functional stub links (`href="#"`). Add a third entry, "Settings", as a `routerLink="/settings"` anchor using the same existing classes as its siblings (`block rounded-[0.4rem] text-slate-950 text-[0.87rem] no-underline px-[0.55rem] py-[0.45rem] hover:bg-indigo-50` — itself due for re-pointing onto tokens in Phase 1 below). This is the first *real* link in that panel; the other two remain placeholders and are out of scope here.

#### I. Settings view — scope

Kept deliberately thin: one control (a theme picker — Light / Dark / Match system) bound to `ThemeService.setPreference()`, reflecting `ThemeService.preference()`. No account fields, no notification prefs, no data-export options — none of that was asked for. The page component itself should be structured so that adding a second, unrelated setting later (e.g., a future notification-preferences toggle) is additive — a second `<section>` in the same template, not a rewrite — but nothing is built ahead of that need today.

**Widget (clarified 2026-08-02, per Skyler):** the picker is the existing `CustomSelectComponent` — a single-select dropdown with three options (Light / Dark / Match system) — not a new inline segmented/radio control. Luigi's original flag wasn't that a dropdown can't do the job — a 3-option dropdown is a perfectly standard control for a 3-way exclusive choice. His actual, narrower point was that no UI control already in this codebase is pre-shaped for a Light/Dark/System-style choice specifically (`CustomSelectComponent` exists, but nothing today already renders one of these), so *whichever* control gets used here — dropdown or a new radio/segmented pattern — is a first usage, not "reuse an established pattern verbatim." Given that's true either way, reusing `CustomSelectComponent` is the better call over inventing a new radio/segmented-control pattern: it matches this section's own "no view space" posture, and it means Phase 1's Settings build is wiring an existing shared component to `ThemeService`, not designing and testing a brand-new UI pattern from scratch.

---

## Token Catalogue (names and roles only — values are Rosalina's)

Derived by scanning every recurring color usage documented in `docs/tailwind-migration-plan.md`'s color table and pattern sections (badges, cards, buttons, sidebar, toast, forms). Each row is a **role**, not a color. The "current light value" column exists only so Rosalina has the light-mode anchor to match/preserve when producing dark fills — it is not new information invented here, it's read directly off the existing app.

| Token | Role | Current light value it replaces |
|---|---|---|
| `--color-surface` | Default card/page background | `bg-white` (list cards, dashboard KPI cards, modals, dropdown panels) |
| `--color-surface-sunken` | Recessed background (shell background, disabled inputs) | `bg-slate-50` |
| `--color-surface-raised` | Elevated overlay surface (modal, dropdown panel, user-menu panel) — may equal `--color-surface` in light, likely diverges in dark | `bg-white` (modal/dropdown variants) |
| `--color-surface-hover` | Neutral hover-state fill for secondary/neutral interactive surfaces (e.g. a Cancel button, a neutral list-item hover) — distinct from the brand-colored `--color-accent-subtle` | Light: `gray-200` (the hover shade only — `gray-100` stays mapped to the existing `--color-surface-sunken` token, unchanged). Dark: `slate-700` (`#334155`) — see `dark-theme-palette.md` for rationale/contrast. |
| `--color-border` | Standard hairline border (cards, inputs, header) | `border-slate-200` / `#e5e9f2` / `#dbe3ef` (already noted in the migration doc as imperceptibly-close aliases) |
| `--color-border-strong` | Form input border (slightly denser than card border) | `#c9d4e6` (detail-page form inputs) |
| `--color-text-primary` | Primary/heading text | `text-slate-950` |
| `--color-text-secondary` | Body/secondary text | `text-slate-600` / `text-gray-700` |
| `--color-text-muted` | Muted/placeholder/meta text | `text-slate-500` / `text-gray-500` / `text-slate-400` |
| `--color-accent` | Brand/primary action color (buttons, links, active states, focus) | `indigo-600` / `indigo-700` family |
| `--color-accent-hover` | Hover state of accent | `indigo-700` / `indigo-800` |
| `--color-accent-subtle` | Low-emphasis accent background (chips, hover backgrounds, selected list option) | `indigo-50` |
| `--color-on-accent` | Text/icon color placed on an accent-filled surface | `white` |
| `--color-focus-ring` | Focus ring color/opacity for inputs and controls | `indigo-500` @ ~20% |
| `--color-danger` | Destructive/error text and icons | `red-600` / `red-800` |
| `--color-danger-hover` | Destructive hover state | `red-700` |
| `--color-danger-subtle` | Low-emphasis danger background (delete-hover chip, error banner) | `red-100` / `red-50` |
| `--color-on-danger` | Text/icon color placed on a danger-filled surface (e.g. the confirm-delete modal's delete button) | `white` |
| `--color-success` | Positive/complete state (wizard complete bubble, success toast) | `emerald-500` / `#1b6f2a` |
| `--color-sidebar-surface` | Sidebar/mobile-nav background (a distinct colored surface, not the page surface) | `indigo-700` |
| `--color-sidebar-text` | Sidebar link/label text | `blue-100` |
| `--color-sidebar-hover` | Sidebar link hover background | `blue-800` @ 40% |
| `--color-sidebar-active` | Sidebar active-link background | `blue-800` @ 65% |
| `--color-toast-success` | Notification toast fill, success kind (currently bypasses Tailwind via inline `[style.background-color]`) | `#1b6f2a` |
| `--color-on-toast-success` | Text/icon color placed on the success toast fill | `white` |
| `--color-toast-error` | Notification toast fill, error kind (same inline-style bypass) | `#a10808` |
| `--color-on-toast-error` | Text/icon color placed on the error toast fill | `white` |
| `--color-badge-mystery` | Mystery type badge fill (if/when mysteries get a type badge) | n/a today — reserved for consistency with the other badges |
| `--color-on-badge-mystery` | Text placed on the mystery type badge fill | n/a today — reserved for consistency with the other badges |
| `--color-badge-monster` | Monster type badge fill | `red-100` |
| `--color-on-badge-monster` | Text placed on the monster type badge fill | `red-700` |
| `--color-badge-minion` | Minion type badge fill | `#fde8d8` |
| `--color-on-badge-minion` | Text placed on the minion type badge fill | `orange-800` |
| `--color-badge-bystander` | Bystander type badge fill | `blue-100` |
| `--color-on-badge-bystander` | Text placed on the bystander type badge fill | `blue-800` |
| `--color-badge-location` | Location type badge fill | `green-100` |
| `--color-on-badge-location` | Text placed on the location type badge fill | `green-900` |
| `--color-badge-archetype` | Monster-archetype badge fill (`monsters-list.html`, `monster-detail.html` — added after both the Tailwind migration and this plan's first draft) | `purple-100` |
| `--color-on-badge-archetype` | Text placed on the monster-archetype badge fill | `purple-700` |
| `--color-weapon-chip` | Weapon tag chip fill (list, detail, wizard) | `indigo-50` |
| `--color-on-weapon-chip` | Text placed on the weapon tag chip fill | `indigo-700` |
| `--color-weapon-chip-line` | Weapon tag chip border — deliberately outside the `on-*` pairing (see naming note below the table) | `indigo-200` |

**Added 2026-08-02 — `--color-surface-hover` (neutral hover-state fill).** Luigi's Phase 2 review (`.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`, item 1) found a genuine Catalogue gap: no token existed for a neutral, non-accent, non-danger hover fill. The confirm-delete modal's Cancel button (base `bg-gray-100`, hover `bg-gray-200`) was the first consumer, and the identical `hover:bg-gray-100`-shaped literal recurs in at least five more places already scheduled for later phases: `minion-detail.scss` (Phase 3); `monsters-list.scss`, `monster-detail.scss` (Phases 4/5); `locations-list.html`, `bystanders-list.html` (Phase 4, row action buttons); `search-results.html` (Phase 4, pager buttons). Skyler's call: add `--color-surface-hover` for the hover shade only — the `gray-100` base stays exactly where it already is, on the existing `--color-surface-sunken` token; nothing about that token changes.

**Category A, confirmed.** The role name (`surface-hover`) contains no utility-family word — `hover` is a Tailwind *variant* prefix (`hover:`), not a color-consuming family like `bg-`/`text-`/`border-`/`ring-`/etc. — so it stays in the single `@theme static` block alongside its `--color-surface*` siblings and lets Tailwind auto-generate `bg-surface-hover`; no hand-written `@utility` is needed, and `hover:bg-surface-hover` composes normally since `hover:` is a variant layered on top of an ordinary generated utility, not a second family word baked into the token's own name.

**Dark value: Rosalina's call.** This token postdates `dark-theme-palette.md` (2026-08-02), so it is not yet in that document's value table — unlike every other row in the Catalogue above, whose dark fills are already resolved, this one is genuinely open. Luigi's Phase 2 stopgap (`hover:bg-accent-subtle` on the confirm-delete modal's Cancel button) is an explicit, flagged placeholder pending this token's dark value landing (see Phase 2 below) — not a second, competing convention for later phases to inherit.

**Considered and deliberately deferred, not a gap needing tracking: `--color-accent-muted`.** The same review (item 4) separately flagged that `custom-select`'s selected-option sub-label lost a lighter-accent shade distinction (previously `text-indigo-500`, one step lighter than the selected label's `text-indigo-700`; both now resolve to `text-accent` since no "lighter accent" token exists) — the sub-label still reads as secondary via font-weight and size, so this is a smaller, cosmetic gap, distinct from and lower-priority than `--color-surface-hover` above. Skyler's call: not adding `--color-accent-muted` at this time. Noted here explicitly so it isn't rediscovered as new; revisit only if a real second consumer or a stakeholder complaint surfaces.

**`--color-accent`/`--color-danger` stay single tokens (resolved 2026-08-02):** see Decision B above for the full reasoning — these two roles remain exactly one token per role, in both light and dark mode. The two duties each serves (plain text-on-surface, and a filled-button background) are reconciled per-theme via Rosalina's lighten-and-flip values (`indigo-400`/`red-400` paired with `--color-on-accent`/`--color-on-danger` flipped to a dark neutral in dark mode), not via a second, button-fill-specific token.

**Why the badges get their own per-domain tokens instead of reusing the generic accent/danger/success roles:** the badges are intentional, semantically-fixed visual identifiers for each domain (monster = red family, location = green family, etc.) — they are not "danger" or "success" states being reused for color variety, they're a legend. Collapsing them onto `--color-danger`/`--color-success`/etc. would be a false equivalence and would break the moment a real danger or success state needed the same red or green a badge already owns. They get a dedicated namespace; Rosalina decides whether dark mode keeps the same hue family per domain (recolored for contrast) or something else — that choice is explicitly hers, this document only guarantees the names exist and are stable.

**Not included on purpose:** raw hex values, oklch values, or a full light/dark mapping table. Every `@theme` block in the Phase Plan below ships with the token's *current light value* as its literal fill (so the app is pixel-identical pre- and post-Phase-0), plus a comment marking it `/* dark: TBD — Rosalina */`.

**Update (2026-08-02):** the dark fills for every token above are now defined — see `docs/theming/dark-theme-palette.md`. The two catalogue gaps that document flagged have been folded into the table above as `--color-on-danger` (light `white`, dark `slate-900`, mirroring `--color-on-accent`) and `--color-badge-archetype`/`--color-on-badge-archetype` (light `purple-100`/`purple-700`, unchanged; dark `purple-950`/`purple-300`, per Rosalina's proposed values). The reserved mystery-badge token (`--color-badge-mystery`/`--color-on-badge-mystery`) stays exactly as originally listed — n/a today, no value committed. Rosalina's speculative `teal-100`/`teal-800` (light) / `teal-950`/`teal-300` (dark) proposal for it in her doc is explicitly a placeholder pending a feature that doesn't exist yet; this plan is not adopting it as a real value and no phase below references it.

### Resolved (2026-08-02) — token naming vs. Tailwind-generated utility classes

**Decision: extend the `on-*` convention already used for `--color-on-accent`/`--color-on-danger` to every token pair in the catalogue that was previously written with a `-bg`/`-text` suffix.** Skyler's call: "I think extending the 'on' naming convention is fine." This is now applied throughout this document and `docs/theming/dark-theme-palette.md` — the table above already reflects the final names; nothing in this document is provisional or illustrative-only with respect to naming anymore.

**Why this was a real problem, not just a style preference:** Tailwind v4 generates a utility's name by taking the literal remainder of a `--color-*` custom property's name after the `--color-` prefix and reusing it under *every* color-consuming utility family (`bg-`, `text-`, `border-`, `ring-`, `outline-`, `fill-`, `stroke-`, `decoration-`, `accent-`, `caret-`, `divide-`, and more) — it does not parse or strip a trailing property word as an indicator of "which utility this token is meant for." A token named `--color-toast-success-bg` did not compile to a utility named `bg-toast-success`; it compiled to `bg-toast-success-bg` — Tailwind literally concatenates the family prefix in front of the *entire* name, "-bg" and all. Writing the shorter, intuitive name (`bg-toast-success`) anywhere in a template — exactly what this plan's own Phase 1 prose did in an earlier draft, before this was caught — silently produces an unstyled element, not a build error, since Tailwind's on-demand generator raises no diagnostic for a class name that doesn't correspond to a real token.

**The final naming rule, applied to every affected pair:**
- `--color-toast-success-bg` → `--color-toast-success` (fill) + `--color-on-toast-success` (text-on-fill)
- `--color-toast-error-bg` → `--color-toast-error` + `--color-on-toast-error`
- `--color-badge-{domain}-bg`/`-text` → `--color-badge-{domain}` + `--color-on-badge-{domain}`, for all six badge rows (mystery, monster, minion, bystander, location, archetype)
- `--color-weapon-chip-bg`/`-text` → `--color-weapon-chip` + `--color-on-weapon-chip`

**The weapon-chip's border token is a deliberate exception to the `on-*` pattern, and is named differently on purpose.** `on-*` models "content color placed on top of a filled surface" — an inherently two-role relationship (a fill, and text/icon sitting on that fill). A chip's border is a third, independent role that isn't "on" the fill in that sense — it traces the fill's edge, it doesn't sit on top of it. Forcing it into the `on-*` shape (e.g. `--color-on-weapon-chip-line`) would stretch a convention that doesn't actually describe what the token is. Instead it is renamed to `--color-weapon-chip-line`, dropping the literal word "border" from the tail entirely — the same name-stutter problem that motivated this whole fix would otherwise resurface here too (`border-weapon-chip-border` stutters exactly like `bg-toast-success-bg` did), so the fix is to avoid the property word, not to force-fit `on-*` where it doesn't semantically apply. This is a judgment call rather than a mechanical extension of the `on-*` rule — flagged here explicitly in case Skyler or Rosalina want a different name for it, though functionally it resolves the same Tailwind-utility-name collision either way.

This is not a new convention invented for this decision — it applies the one already established elsewhere in this same catalogue (`--color-on-accent`, `--color-on-danger`), rather than introducing a second "fill + text" naming shape to sit alongside it. The alternative considered and rejected — keep the `-bg`/`-text` suffix shape but drop only `-bg` from the fill token's name (`--color-toast-success` for fill, keep `--color-toast-success-text` for the on-color) — was passed over for the same reason: it's an asymmetric one-off convention that still wouldn't match the `--color-on-accent`/`--color-on-danger` precedent, leaving two different naming conventions for the same "fill + on-fill-text" shape depending on which pair you're looking at.

**Companion fix, corrected 2026-08-02 — Category B tokens are not renamed by this convention, because renaming can't fix them; see Decision B's addendum, above.** The `on-*` rename above works precisely because those tokens are multi-family by role (a badge fill legitimately wants `bg-`, and its on-color may legitimately want `text-`, `fill-`, or `stroke-` for an icon inside it) — giving the *text-on-fill* half of the pair a role-only name (`on-badge-monster`) sidesteps the collision entirely. That trick does not exist for a token whose role genuinely *is* one family: `--color-text-primary`'s role is inescapably "a text color," so no name for it that keeps its meaning intact can avoid colliding with the `text-` prefix once it's used as a text utility. Those tokens — `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-sidebar-text`, `--color-focus-ring` — are therefore **not renamed**; they keep their most natural, correct Catalogue names, and instead get a hand-written `@utility` block in `styles.css` that names the class independently of the property (Decision B addendum). The two mechanisms are complementary, not competing: `on-*` naming solves the collision for tokens that are genuinely multi-family; `@utility` solves it for tokens that are genuinely single-family. Nothing in the Catalogue table above changed as a result of this — only `styles.css` gained the corresponding `@utility` blocks.

**A second deliberate exception to `on-*`, resolved 2026-08-02 (Yoshi's call): `--color-sidebar-text` stays as-is, not renamed to `--color-on-sidebar-surface`.** Luigi's implementation review flagged that, read strictly, this token has the same "fill + text-on-fill" shape as the pairs renamed above (`--color-sidebar-surface` is the fill) — renaming it would let it auto-generate `text-on-sidebar-surface` (Category A) with no hand-written `@utility` needed, and would keep the slash-opacity modifier that a static `@utility` can't express. **Decision: keep `--color-sidebar-text`, served by the hand-written `text-sidebar` utility (Decision B addendum), not renamed.** Two reasons outweigh the auto-generation/opacity-modifier gain: first, in practice this token is consumed only ever as a text color — including the sidebar SVG icons, which inherit it via `currentColor` from a `text-*` class on an ancestor, never a separate `fill-*` utility (confirmed by inspecting `page-layout.html`) — so it is not actually multi-family the way a badge or toast fill is; it belongs with `text-primary`/`text-secondary`/`text-muted` (single-family, region-scoped text roles, none of which are `on-*` either), not with the fill/on-fill pairs the `on-*` convention exists for. Second, `text-sidebar` is materially shorter and more readable than `text-on-sidebar-surface` across every sidebar template, for a token applied to every nav item. The lost slash-opacity modifier is not a real cost: the one place Phase 1 needed a translucent variant (the disabled nav item) already has its own named utility, `text-sidebar-muted` — see the open item immediately below for that utility's own unresolved question. **Final, not deferred** — reopen only if a genuinely new, multi-family consumer of this color (an icon fill or border, say, distinct from its current text-only usage) ever appears.

**Open for Rosalina, not resolved here: does `text-sidebar-muted` need a real Catalogue token?** Its color is computed inline in `styles.css` via `color-mix(in oklab, var(--color-sidebar-text) 70%, transparent)` rather than reading a dedicated `--color-sidebar-text-muted` Catalogue entry — a deliberate trade-off (Decision B addendum), accepted because a hand-written `@utility` can't express a slash-opacity modifier and this is the only place Phase 1 needed one. The practical effect is that one color value (the 70% mix) currently lives outside the Token Catalogue, computed rather than declared. Left open rather than decided here: if a dedicated token is wanted for Catalogue completeness — for instance so a future theme could tune the disabled-nav contrast independently of the base `sidebar-text` color, rather than always inheriting a fixed 70% — that's a values-and-precedent call that belongs with Rosalina, per this plan's existing mechanism-is-mine/values-are-hers division of labor.

### Conventions for Future Tokens (added 2026-08-02)

Read this before adding any token to the Catalogue or `styles.css`, in either a later phase of this plan or a future theme:

1. **Every token goes in the single `@theme static { … }` block in `styles.css` — never a second, bare `@theme { … }` block.** `static` is load-bearing (Decision B addendum): without it, a token only reaches `:root` if some utility already references it, while `.dark` always emits in full, so an unreferenced-in-light-mode token can end up silently undefined in light mode only.
2. **Decide Category A vs. Category B before writing the token's Catalogue row.** If the role name contains no utility-family word and the token is genuinely used across more than one family (`bg-`/`text-`/`fill-`/…), leave it in `@theme static` and let it auto-generate — this is Category A, the common case. If the role *is* a single utility family (a text color, a border color, a ring color, …), its name will necessarily contain that family's word, and auto-generation will stutter (`text-text-*`, `border-border-*`) — this is Category B: do not rename the token to dodge the collision, add a hand-written `@utility` block instead (Decision B addendum), immediately beneath the existing eight in `styles.css`.
3. **A stuttering name that nothing hand-defines is not a build error.** Tailwind's on-demand generator raises no diagnostic for an unmatched class name — it simply never emits a rule, and the element silently renders unstyled. If a template needs a Category B–shaped class, check the `@utility` list in `styles.css` (or the Category B list in Decision B's addendum) before assuming a "clean" name auto-generates one.
4. **Any component `.scss` file that will `@apply` a token or `@utility` class must first change its `@reference` from `"tailwindcss"` to `"#styles.css"`** — the `package.json` Node subpath-import alias to this app's own `src/styles.css` (Decision B addendum) — otherwise the build fails outright the moment the `@apply` line references it. Never a hand-computed relative path.

---

## Phase Plan

### Phase 0 — Token Infrastructure & Dark-Inert Baseline

**Goal:** The token layer, the `.dark` scope selector, `@custom-variant dark`, `ThemeService`, and its persistence seam all exist and are wired up — but **zero templates are touched**. The app is pixel-identical to today because every token's light-mode value equals the corresponding literal Tailwind color already in use, and no template references any token yet. `ThemeService.initialize()` applies the resolved theme class to `<html>` reactively on every bootstrap, so the app is fully functional end-to-end from this phase forward — **a brief flash of the wrong theme on a cold load is possible and explicitly accepted for now**; the zero-flash guarantee is tracked as a named follow-up in Phase 8, not a Phase-0 requirement (see Decision E, "Sequencing").

**Risk:** Low — additive only; nothing existing is removed or repointed.

**Files changed:** `src/styles.css`, `src/app/core/theme.ts` (new), `src/app/app.config.ts`, plus the test-disabling sweep below (`src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.spec.ts`).

**What happens:**
- `src/styles.css` gains the full token catalogue inside `@theme` (light-value fills, `/* dark: TBD */` comments), a `@custom-variant dark (&:where(.dark, .dark *));` declaration, and a `.dark { ... }` override block (in `@layer base` or immediately after `@theme`) redefining every token's custom property — for now, to the *same* light value, so it is a structural no-op until Phase 1 starts consuming the tokens and Rosalina fills in real dark values.
- `src/app/core/theme.ts` is created per Decision D's (corrected) API surface, with `localStorage` persistence behind the seam from Decision F.
- `app.config.ts` wires `ThemeService.initialize()` via `provideAppInitializer`.
- **Test-disabling sweep (added 2026-08-02, per Skyler).** Because Phases 1–6 repoint literal Tailwind color classes and inline color styles that some existing specs may assert on directly, Phase 0 also includes a grep-driven pass to find and disable any such assertion before it can go red for a reason unrelated to the phase actually in flight. A grounded, whole-app grep (not a guess) for literal Tailwind palette classes (`bg-`/`text-`/`border-` + a palette color name) and color-bearing inline-style/computed-style assertions across every `*.spec.ts` under `src/web/monster-of-the-week-web/src/app` turns up exactly **one** hit: `features/search/pages/search-results/search-results.spec.ts`, whose `'renders the correct domain badge/icon/link for each entityType'` test asserts `monsterBadge.className` contains `'bg-red-100'` and `locationBadge.className` contains `'bg-green-100'` — exactly the badge tokens the Token Catalogue already covers (`--color-badge-monster`, `--color-badge-location`). Those two `expect(...).toContain(...)` lines should be disabled (`it.skip(...)`, Vitest's equivalent of `xit`, on the containing test) with a comment reading "re-enable/rewrite in Phase 4 — see theming-plan.md". This also surfaced a Files-changed gap in the Phase Plan, folded into Phase 4 below.
  - **Correction to an assumption in the original ask:** `page-layout.spec.ts` was flagged as a candidate (its `.sidebar-mobile`/`.api-modal` selectors, and the notification toast) — verified directly against the file, and it needs **no change**. `.sidebar-mobile` and `.api-modal` are plain structural class names unrelated to color — they aren't Tailwind palette utilities and nothing repoints or renames them; they merely sit in the same `class=` attribute as color utilities that will change, but `querySelector('.sidebar-mobile')` doesn't care what else is in that attribute. The toast test in that file only asserts on rendered text content, never on `[style.background-color]` or any color value. Nothing in `page-layout.spec.ts` is fragile against the token repoint — left as-is.
  - **Done-criteria note:** any phase whose templates repoint a class that a disabled test asserted on must rewrite/re-enable that assertion as part of its own "done" criteria — not leave it disabled indefinitely. Today, given the grep above, this applies only to Phase 4 (see its Inspection Points); if a later phase's own work surfaces more disabled assertions, that phase inherits the same obligation for its own findings.

**Inspection Points**
- App is visually indistinguishable from pre-Phase-0 on every page.
- Adding `class="dark"` to `<html>` manually in DevTools produces **no visual change** (confirms the `.dark` override block is currently a no-op, not broken — it will start doing something visible only once Phase 1 re-points real templates).
- Reloading with DevTools' "Emulate CSS prefers-color-scheme: dark" toggled seeds the correct resolved value on first load (no stored preference yet), confirmed via `document.documentElement.classList`.
- `search-results.spec.ts`'s two badge-color assertions are disabled, each with a comment naming the phase (4) that re-enables them; the rest of the test suite remains green.
- `ng build --configuration production` passes.

**Rollback:** revert the three files above and the test-disabling sweep. No template changes exist yet to roll back.

---

### Phase 1 — Shell Layout, User Menu, Settings View

**Goal:** The shell (`page-layout.html`) is re-pointed from literal palette classes to token utilities. The three inline-hardcoded-color spots (Soon badge ×2, API-unavailable modal, notification toast) are converted to token-driven styling. The Settings view exists, is routed, and is reachable from the user menu. Toggling the `.dark` class now visibly changes the shell and Settings page; nothing else in the app is retheme-able yet.

**Risk:** High — same risk profile as the original migration's Phase 2 (shell wraps every page; a regression here is universal). **Execute on a feature branch.**

**Files changed:** `src/app/layout/page-layout/page-layout.html`, `src/app/pages/settings/*` (new: `settings.html`, `settings.ts`, `settings.spec.ts`), `src/app/app.routes.ts`, `src/app/shared/header-search/header-search.html` + `.scss` (folded in — see "`shared/header-search/`" below; this component predates this plan and was missed by its original repo scan, not added new work).

**Re-pointing map (illustrative, not exhaustive):**

| Current literal class | Token utility |
|---|---|
| `bg-slate-50` (shell) | `bg-surface-sunken` |
| `bg-indigo-700 text-blue-100` (sidebar, mobile nav) | `bg-sidebar-surface text-sidebar-text` |
| `hover:bg-blue-800/40` | `hover:bg-sidebar-hover` |
| `bg-blue-800/65` (`routerLinkActive`) | `bg-sidebar-active` |
| `bg-white border-b border-slate-200` (header) | `bg-surface border-b border-default` |
| `bg-white border border-slate-200` (user menu panel) | `bg-surface-raised border border-default` |
| `text-slate-950` (user menu links, various) | `text-primary` |
| `hover:bg-indigo-50` | `hover:bg-accent-subtle` |
| `bg-indigo-600 hover:bg-indigo-700` (quick action button) | `bg-accent hover:bg-accent-hover` |

**Mechanism note (2026-08-02):** in the map above, `bg-surface-sunken`, `bg-sidebar-surface`, `hover:bg-sidebar-hover`, `bg-sidebar-active`, `bg-surface`, `bg-surface-raised`, `hover:bg-accent-subtle`, and `bg-accent`/`hover:bg-accent-hover` are all ordinary Tailwind-generated utilities (Category A, Decision B addendum) — no special handling needed. `text-sidebar`, `text-primary`, and `border-default`, by contrast, are **not** auto-generated: naive concatenation would instead produce `text-sidebar-text`, `text-text-primary`, and `border-border`. These three are hand-written `@utility` classes in `styles.css` (Category B) that produce exactly the clean names this map lists — see Decision B's addendum for why, and the Conventions subsection above the Phase Plan for the rule going forward.

**Converting the three inline-style spots** (these currently bypass the utility-class system entirely and would silently remain light-only forever otherwise):
- **"Soon" nav badge** (both desktop and mobile variants, currently `style="background: rgba(255,255,255,.2); ..."`): **resolved by Rosalina** (`docs/theming/dark-theme-palette.md`, Modals & Overlays) — no dedicated token needed. A translucent-white overlay lightens whatever's beneath it in both themes automatically (works over the light-mode `indigo-700` sidebar today and identically over the dark-mode `indigo-900` sidebar), so this simply moves out of the `style=` attribute and into a plain `bg-white/20` utility class — nothing else changes.
- **Notification toast** (`[style.background-color]="notification.kind === 'error' ? '#a10808' : '#1b6f2a'"`): replace the two hardcoded hex literals with the `--color-toast-error` / `--color-toast-success` tokens (final names — see the naming resolution immediately above the Phase Plan), via a `[class]` binding to `bg-toast-error` / `bg-toast-success`. These are now the real, Tailwind-generated utility names for this pair (no name-stutter, since neither token ends in a property word anymore) — not illustrative placeholders. Prefer the `[class]` swap over a `[style.background-color]` binding to `var(--color-toast-error)`/`var(--color-toast-success)`: with token-backed utilities there's no competing-specificity concern the way the original migration hit in its own Phase 2 (see that doc's Phase 2 notes), since only one of the two toast classes is ever applied at a time via `[class.bg-toast-error]`/`[class.bg-toast-success]`, not both simultaneously. Toast text stays plain white in both themes per Rosalina's palette — `--color-on-toast-error`/`--color-on-toast-success` exist in the Token Catalogue for completeness (matching the `on-*` pattern used everywhere else) but don't require an active template change here since the text was already effectively white.
- **API-unavailable modal** (backdrop `rgba(15,23,42,.58)`, panel `background:#fff`, body text `#334155`, button `background:#4f46e5`, spinner SVG opacities): **backdrop resolved by Rosalina** (`docs/theming/dark-theme-palette.md`, Modals & Overlays) — the scrim stays a fixed, theme-invariant literal overlay in both themes, standardized on `bg-slate-950/55` (matching the confirm-delete modal's own scrim), no token needed, since a scrim's job (dim whatever's behind it) doesn't change by theme. Panel converts to `bg-surface-raised` (corrected 2026-08-02 — see below; an earlier draft of this instruction said `bg-surface`, which conflicted with `dark-theme-palette.md`'s Modals & Overlays guidance, the Token Catalogue's own role description for `--color-surface-raised`, and this same file's two sibling overlay panels), body text to `text-secondary`, button to `bg-accent`. **Also per Rosalina (Icons section):** the spinner's hardcoded `stroke="white"`/`fill="white"` SVG attributes should become `stroke="currentColor"`/`fill="currentColor"` so it inherits `--color-on-accent` from the button the same way every other icon in the app already does — called out there as an implementation gotcha specific to this modal, not a plain color-class swap. The spinner's `opacity: .25`/`.75` values are not colors and are untouched.
  - **Resolved directly, 2026-08-02 (Yoshi's call).** This has been flagged twice now (Luigi's Phase-1 open-items note, twice) as a conflict between an earlier draft of this instruction (`bg-surface`) and both `dark-theme-palette.md`'s Modals & Overlays section and the Catalogue's own `--color-surface-raised` role description (which names "modal" explicitly) — and it's now additionally inconsistent with two sibling overlay panels in the same file (`page-layout.html`'s user-menu panel and the header-search dropdown panel), both correctly on `surface-raised`. There is no case for `bg-surface` here beyond a literal reading of the earlier draft; deferring a third time serves nobody, so the instruction above is corrected rather than re-flagged. **The actual template line in `page-layout.html` still reads `bg-surface` today** — Luigi correctly implemented this plan's literal instruction at the time it was written, and this is a documentation-only pass, so the template is untouched here. The one-word fix (`bg-surface` → `bg-surface-raised`) is a zero-risk follow-up, currently invisible only because both tokens are identical (`white`) until Phase 7's palette swap-in — apply it as a small standalone commit whenever convenient; it does not need to wait for any phase gate.

**`shared/header-search/` (folded into Phase 1, 2026-08-02) — predates this plan, missed by original repo scan.** Confirmed via `git log`: this component shipped in the global search feature's "Phase 2 (UI first pass)" commit, before this theming workstream existed — it was missed by this plan's original repo scan, not added as late scope. It renders inside the shell header, so Phase 1 is its natural home, and it has now been re-pointed alongside the rest of the shell:
- Wrapper icon `text-slate-400` → `text-muted`; input `border-slate-200` → `border-default`, `text-slate-950` → `text-primary`, `focus:border-indigo-500` → `focus:border-accent`, `focus:shadow-[0_0_0_2px_rgba(99,102,241,0.18)]` → `focus:ring-focus`; listbox `bg-white` → `bg-surface-raised`, `border-slate-200` → `border-default`; option `text-slate-950` → `text-primary`; no-results `text-slate-500` → `text-muted`; its SCSS `@apply bg-indigo-600 text-white` → `@apply bg-accent text-on-accent`.
- Three deliberate, sanctioned light-mode shade shifts, each because no token holds the exact old value and the Catalogue names the new one as the correct role: search icon `slate-400`→`slate-500`; focus border `indigo-500`→`indigo-600` (`--color-accent`); focus ring alpha `.18`→`.20` (the Catalogue's own "`indigo-500` @ ~20%").
- The input needs no `bg-*` class and no placeholder token: Tailwind's preflight makes form controls `background-color: transparent`, so it inherits the header's `bg-surface`, and the UA `::placeholder` derives from the element's own `color` at 50% alpha, so it follows `text-primary` automatically. Verified in both themes.
- `header-search.scss`'s `@reference` is changed from `"tailwindcss"` to `"#styles.css"` — the `package.json` subpath-import alias to this app's own `src/styles.css` (Decision B addendum) — already applied and verified end-to-end, including negative-control tests (removed `imports` entry; reverted to `"tailwindcss"`) that each reproduce the exact loud build failure the alias prevents.
- No spec changes needed: `header-search.spec.ts` asserts only on structural classes and text/behavior, never on color utilities.

**Settings view build:**
- `pages/settings/settings.ts`: standalone component, injects `ThemeService`, exposes `preference = this.themeService.preference` and a `choose(pref: ThemePreference)` method calling `setPreference`.
- `pages/settings/settings.html`: a single card (using `--color-surface` / `--color-border` tokens established above) with a labeled `CustomSelectComponent` bound to the three `ThemePreference` options (Light / Dark / Match system) — see Decision I.
- `app.routes.ts`: add `{ path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsPageComponent) }`, following the `dashboard`/`data-admin` direct-`loadComponent` pattern.
- `page-layout.html`: add the "Settings" link to the user menu panel per Decision H.

**Inspection Points**
- Toggling theme in Settings immediately re-colors the shell (sidebar, header, user menu, toast, modal, Soon badge) with no page reload required.
- Reloading the page after choosing "Dark" in Settings preserves dark on next load (a brief flash before `ThemeService.initialize()` reconciles is expected and acceptable until Phase 8 ships the zero-flash guarantee — not a regression to chase down here).
- "Match system" correctly follows a live OS-level theme change (toggle OS/DevTools emulation while the app is open and set to "Match system"; toggling in Settings should immediately follow).
- Mobile menu, desktop sidebar, and both toast kinds all repaint correctly in both themes.
- API-unavailable modal (can be forced by stopping the API) renders correctly in both themes.
- Header-search dropdown (desktop header) repaints correctly in both themes, including its focus ring, listbox panel, and empty-state text.
- Existing "Your profile" / "Sign out" stub links are unaffected; "Settings" is the only new, functional link.
- `ng build --configuration production` passes.

**Rollback:** `git checkout HEAD -- src/app/layout/page-layout/ src/app/pages/settings/ src/app/app.routes.ts` — consequential enough that this should be evaluated on the feature branch before merge, same posture the original migration took for its own Phase 2.

---

### Phase 2 — Shared Components

**Goal:** `confirm-delete-modal`, `custom-select`, and `weapon-tag-select` are re-pointed onto tokens. These are used across nearly every list/detail page and inside the wizard, so getting them token-correct here means every later phase inherits working theming for free wherever these components are reused.

**Risk:** Medium — `custom-select` in particular is used inside the mystery wizard; a regression has wide reach. Its compound-state SCSS (`@apply`) must repoint its literal utility classes (`bg-white`, `border-slate-200`, `text-slate-950`, `bg-indigo-50`, `text-indigo-700`, …) to the token equivalents inside the existing `@apply` rules — no new selectors needed, just swapping which utility name each `@apply` line references.

**Files changed:** `confirm-delete-modal.component.html`, `custom-select.component.html` + `.scss`, `weapon-tag-select.component.html`.

**Re-pointing specifics:**
- `confirm-delete-modal`: beyond its `bg-*`/`border-*`/`text-*` re-pointing, the delete button's hardcoded `text-white` literal is re-pointed to the new `--color-on-danger` token (see Token Catalogue) so its label stays legible once `--color-danger` lightens for dark mode, paired with the button's fill re-pointing to `bg-danger`.
- **`confirm-delete-modal`'s Cancel button is a known placeholder, not the final state:** implemented as `bg-surface-sunken text-secondary hover:bg-accent-subtle`, because no neutral hover-fill token existed at the time (Luigi's review, `.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`, item 1). `hover:bg-accent-subtle` is called out there as semantically wrong for this spot — it's an indigo-tinted brand wash standing in for what should be a neutral gray hover — and is not adopted as the pattern for anything else. **Resolved 2026-08-02:** `--color-surface-hover` has been added to the Token Catalogue for exactly this case (see above). Once Rosalina supplies its dark value, Luigi replaces this button's hover class with `hover:bg-surface-hover`; the base `bg-surface-sunken` is correct as-is and does not change.
- **`@reference` fix required before any `@apply` line is repointed (Decision B addendum):** `custom-select.component.scss` still opens with `@reference "tailwindcss"` — change to `@reference "#styles.css"` first, or the build fails the instant an `@apply` line references a token/`@utility` class (`bg-white`→`bg-surface`, `border-slate-200`→`border-default`, `text-slate-950`→`text-primary`, `bg-indigo-50`→`bg-accent-subtle`, `text-indigo-700`/`text-indigo-600`/`text-indigo-500`→`text-accent`/`ring-focus`, etc.).

**Inspection Points**
- Delete confirmation modal renders correctly in both themes (Bystanders or Locations page), including the delete button's text against its fill in both themes.
- Custom select: trigger, open panel, hover state, selected-option highlight, and disabled state all repaint correctly in both themes.
- Weapon tag chip repaints correctly in both themes, including inside the mystery wizard.

---

### Phase 3 — Simple Detail Pages & the Type Badge Pattern

**Goal:** `bystander-detail`, `location-detail`, `minion-detail` re-pointed using the Detail Form Pattern's token equivalents (`--color-border-strong` for inputs, `--color-accent` family for the save button). This phase also establishes the **type badge token pattern** (`--color-badge-{domain}` fill + `--color-on-badge-{domain}` text, per the `on-*` naming resolved above) in one place before it's reused across every list page in Phase 4.

**Risk:** Low.

**Files changed:** `bystander-detail.html`, `location-detail.html`, `minion-detail.html` (+ its small SCSS stub, whose `@apply` lines also need repointing).

**`@reference` fix required (Decision B addendum):** `minion-detail.scss`'s small SCSS stub still opens with `@reference "tailwindcss"` — change to `@reference "#styles.css"` before its `@apply bg-gray-100` / `@apply bg-red-100 text-red-600` lines are repointed to token classes, or the build fails.

**Neutral hover-fill token now available (closes Luigi's Phase 2 gap):** `minion-detail.scss`'s `.action-btn:hover:not(:disabled) { @apply bg-gray-100; }` rule repoints to `--color-surface-hover` (`@apply bg-surface-hover`), not a `bg-accent-subtle`-style workaround — see the Token Catalogue and `.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`, item 1. Note this is a one-step light-mode shade shift (`gray-100` → the token's light value, `gray-200`), not a strict no-op repoint, since `--color-surface-hover`'s light value is anchored to the confirm-delete modal's `hover:bg-gray-200` (the pattern's original motivating case) rather than to this file's own `gray-100`. Flagged rather than silently absorbed — treat as accepted unless Rosalina/Skyler want the two neutral-hover shades kept distinct.

**Inspection Points**
- Each detail page's form fields, borders, and save button repaint correctly in both themes.
- `minion-detail`'s existing `:hover:not(:disabled)` SCSS remnant repoints cleanly to `bg-surface-hover` inside its `@apply` block, with no new selectors and no `bg-accent-subtle`-style workaround.

---

### Phase 4 — List Pages

**Goal:** All five list pages re-pointed using the List Page / List Item Card / Action Button / Type Badge patterns' token equivalents. Because these patterns are shared verbatim across all five pages, this phase should go quickly once the pattern is proven on the first page.

**Risk:** Low.

**Files changed:** `mysteries-list.html`, `monsters-list.html` (+ its SCSS stub), `minions-list.html` (+ its SCSS stub), `bystanders-list.html`, `locations-list.html`, `search-results.html` (see catalogue-gap catch below).

**Re-pointing specifics:**
- `monsters-list.html` additionally re-points its monster-archetype badge (`bg-purple-100 text-purple-700`, added after both the original Tailwind migration and this plan's first draft) onto the new `--color-badge-archetype`/`--color-on-badge-archetype` tokens (see Token Catalogue) — same badge pattern as the other four type badges, just added to the codebase later than the rest.
- **Catalogue-gap catch (2026-08-02), same category as the archetype badge above:** the global search feature's results page (`src/app/features/search/pages/search-results/search-results.html`), shipped after this plan's original phase list was drafted, independently renders the same monster/location type badges (`bg-red-100`, `bg-green-100`, …) this phase already re-points elsewhere — it simply wasn't in any phase's Files-changed list until now. Folded in here since it's the same Type Badge Pattern, not a new one.
- **`@reference` fix required (Decision B addendum) — this phase is affected too, not only 2/3/5/6:** `monsters-list.scss`'s `.action-btn:hover:not(:disabled) { @apply bg-gray-100; }` rule repoints per this phase's own Inspection Points below, so its `@reference "tailwindcss"` must change to `@reference "#styles.css"` first, same obligation as every other phase touching an `@apply`-bearing SCSS file.
- **Separately flagged, not this phase's responsibility:** `search-results.scss`'s `mark { @apply bg-indigo-100 text-indigo-900 …; }` search-highlight rule is literal, not token-backed, and no Catalogue token covers a search highlight — left for Phase 7's sweep (updated below to also check `.scss`/`@apply` bodies) rather than invented here.
- **Neutral hover-fill token now available (closes Luigi's Phase 2 gap):** `monsters-list.scss`'s `.action-btn:hover:not(:disabled) { @apply bg-gray-100; }` rule, plus `locations-list.html`'s and `bystanders-list.html`'s row action buttons and `search-results.html`'s pager buttons (all currently plain `hover:bg-gray-100` in-template), all repoint to `--color-surface-hover` (`bg-surface-hover` / `hover:bg-surface-hover`) rather than reinventing a `bg-accent-subtle`-style workaround — see the Token Catalogue and `.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`, item 1. Same one-step light-mode shade note as Phase 3: the token's light value (`gray-200`) is one step darker than the `gray-100` literal these four sites currently use, since it's anchored to the confirm-delete modal's hover shade, not to this file's own value — not a strict pixel no-op, flagged as accepted unless told otherwise.

**Inspection Points**
- Each list page's cards, badges, and action buttons repaint correctly in both themes.
- `monsters-list`'s and `minion-detail`'s retained `:hover:not(:disabled)` SCSS remnants repoint cleanly to `bg-surface-hover`; `locations-list`, `bystanders-list`, and `search-results`'s `hover:bg-gray-100` action/pager buttons repaint correctly to `hover:bg-surface-hover` in both themes.
- `monsters-list`'s archetype badge repaints correctly in both themes.
- Search results page's monster/location badges repaint correctly in both themes; `search-results.spec.ts`'s two badge-color assertions (disabled in Phase 0) are rewritten against the new token classes and re-enabled as part of this phase's own "done" criteria.

---

### Phase 5 — Medium Pages & Admin

**Goal:** `mystery-detail`, `monster-detail`, `dashboard`, `data-admin`, `weapon-tag-admin` re-pointed. This phase includes the two admin table components' `nth-child` row-striping remnants, which currently hardcode raw hex with `!important` (`#fff` / `#dbeafe`) entirely outside the utility-class system — same category of problem as the Phase 1 inline styles, and equally invisible to a dark-mode pass unless explicitly caught here.

**Risk:** Medium — most content-dense pages in the app; `mystery-detail`'s and `monster-detail`'s small SCSS stubs (icon-size custom property, `li:last-child`, hover guard) need their `@apply`/inline color references repointed alongside the rest.

**Files changed:** `mystery-detail.html`, `monster-detail.html` (+ SCSS stub), `dashboard.html`, `data-admin.html` (+ `data-admin.scss` striping remnant), `weapon-tag-admin.html` (+ its own striping remnant).

**Re-pointing specifics:**
- `monster-detail.html` re-points its monster-archetype badge (`bg-purple-100 text-purple-700`) onto `--color-badge-archetype`/`--color-on-badge-archetype`, the same tokens introduced for `monsters-list.html` in Phase 4.
- **Neutral hover-fill token now available (closes Luigi's Phase 2 gap):** `monster-detail.scss`'s `.action-btn:hover:not(:disabled) { @apply bg-gray-100; }` rule — same shape as Phases 3/4 — repoints to `--color-surface-hover` (`@apply bg-surface-hover`), not a `bg-accent-subtle`-style workaround. See the Token Catalogue and `.squad/decisions/inbox/luigi-theming-phase2-shared-components.md`, item 1; the same one-step light-mode shade note from Phases 3/4 applies (`gray-100` literal → the token's `gray-200` light value).
- **`@reference` fix required for all four SCSS stubs in this phase (Decision B addendum):** `monster-detail.scss`, `mystery-detail.scss`, `data-admin.scss`, and `weapon-tag-admin.scss` each change to the identical `@reference "#styles.css"` — no per-file path to compute, despite the four files sitting at different folder depths. Each must change before its `@apply` lines are repointed to token classes, or the build fails.

**Table striping fix specifically:**
```scss
/* Before (hardcoded, light-only, invisible to any theme switch) */
.records-table tbody tr:nth-child(odd) > td  { background: #fff !important; }
.records-table tbody tr:nth-child(even) > td { background: #dbeafe !important; }

/* After — token-driven, theme-aware (decided 2026-08-02) */
.records-table tbody tr:nth-child(odd) > td  { background: var(--color-surface) !important; }
.records-table tbody tr:nth-child(even) > td { background: var(--color-accent-subtle) !important; }
```
`--color-accent-subtle` for the even-row tint is the accepted, final choice — not `--color-surface-sunken`, as originally illustrated. Both rules must reference custom properties, never literal hex, from this phase forward. `--color-surface`/`--color-surface-sunken` compute to only ~1.13:1 contrast against each other in dark mode (they were designed for a coarse page-floor-vs-card elevation jump, not a fine per-row alternation) and would collapse the stripe to imperceptible; `--color-accent-subtle` is a translucent tint in dark mode (`indigo-400/16`) that stays visible regardless of what surface it composites over, and it also better matches the *original* light-mode intent — today's even-row fill (`#dbeafe`) was always a pale blue wash, not really `surface-sunken` in spirit. See `docs/theming/dark-theme-palette.md` for the full rationale.

**This fix depends on the `@theme static` correction (Decision B addendum) to work in light mode at all.** These two rules read `var(--color-surface)`/`var(--color-accent-subtle)` directly rather than through a Tailwind utility class — exactly the hand-written-CSS case the tree-shaking bug silently broke (a bare `@theme` only emits a token to `:root` if some utility already references it; nothing here is a utility). `styles.css` now declares `@theme static`, so both tokens are confirmed present in `:root`, not just under `.dark` — verified as part of the same investigation that found the bug. No action needed here beyond knowing why this specific fix was the concrete, real-world case that made the bug worth finding.

**Inspection Points**
- Dashboard KPI cards, recent-mysteries list, and skeleton loading state (`animate-pulse`) repaint correctly in both themes.
- Data admin and weapon-tag admin tables show correct, clearly-distinguishable alternating-row contrast in both themes (the `--color-accent-subtle` even-row fill is the final answer here, not a placeholder to re-check).
- Monster detail's sub-resource grid, weapon-tag chips, archetype badge, and delete-hover guard all repaint correctly; its action-button hover repoints cleanly to `bg-surface-hover` in both themes.

---

### Phase 6 — The Mystery Wizard

**Goal:** `mystery-create` and its six sub-templates re-pointed. The phase-bubble/step-dot compound-state SCSS (`@apply`) and the `fadeSlideIn` keyframe stay exactly as they are structurally (per the Tailwind migration's Decision E/F, still valid here) — only the color utility names *inside* those `@apply` blocks change, from literal (`bg-indigo-600`, `border-emerald-500`, …) to token (`bg-accent`, `border-success`, …). The `subgrid` tracker layout is untouched — it carries no color, only structural grid rules.

**Risk:** High — primary data-entry path for the app, and `mystery-create.ts` uses `ViewEncapsulation.None`, meaning its styles are global (per the migration doc's Phase 7 log) — a mistake here has the widest blast radius of any single phase. **Execute on a feature branch**, same posture the original migration used.

**Files changed:** `mystery-create.scss` (repoint `@apply` targets only — no structural change), `mystery-create.html` + all six phase/dossier/tracker sub-templates.

**`@reference` fix required (Decision B addendum):** `mystery-create.scss` still opens with `@reference "tailwindcss"` — change to `@reference "#styles.css"` before any of its `@apply` targets are repointed to token classes (`bg-indigo-600`→`bg-accent`, `border-emerald-500`→`border-success`, etc.), or the build fails.

**Inspection Points**
- Full wizard walkthrough (all phases, forward and backward via tracker bubbles) in both themes.
- Phase-bubble active/complete/inactive states and step-dot states are visually correct and distinguishable in both themes.
- Dossier section `fadeSlideIn` animation still fires correctly (unrelated to color, but worth re-confirming nothing broke it).
- Weapon-tag chips and countdown grid repaint correctly inside the wizard.
- Complete a full wizard flow end-to-end in dark mode and confirm the mystery is created correctly (functional regression check, not just visual).

---

### Phase 7 — Cleanup, Sweep, and Palette Swap-In

**Goal:** Two things happen here, deliberately kept separate from each other:

1. **Sweep for stragglers.** Grep the app for any remaining literal palette utility (`bg-`, `text-`, `border-` followed by a Tailwind color name rather than a token name) and any remaining `style=`/`[style]` color binding not already covered by Phases 1–6. Confirm the full-app `grep -rn "style="` / `grep -rln "\[style"` result set from this plan's research phase is now empty for anything color-related (the two `mystery-create-monster-phase.html` `style="width: ..."` bindings and `mystery-create-tracker.html`'s `[style.grid-column]` are structural, not color — they are explicitly **not** in scope for this sweep and should remain as-is). **This sweep must also grep inside `.scss` files' `@apply` bodies, not just `.html` templates** — `search-results.scss`'s `mark` highlight rule (flagged in Phase 4 above) is exactly this shape: a literal, non-token color living inside an `@apply` block, easy to miss if the sweep only looks at template `class=` attributes. If it (or anything else this sweep turns up in an SCSS file) gets tokenized here, that file's `@reference` needs the same `"#styles.css"` fix as every other phase (Decision B addendum) before its `@apply` line is repointed.
2. **Palette swap-in.** Once Rosalina delivers real dark values for every token in the Token Catalogue, replace the placeholder `.dark { ... }` block in `styles.css` (currently light-value duplicates from Phase 0) with the real dark fills. Because every template from Phase 1 onward only ever references token names, this is a **single-file change** with no template risk — the whole point of the semantic-token mechanism from Decision B.

**Risk:** Low for the sweep, Low for the palette swap-in specifically because of how Decision B was designed — but budget a full visual pass across every page in both themes before calling this phase done, since it's the first time the *real* dark palette (rather than the light-value placeholder) is visible anywhere.

**Files changed:** `src/styles.css` only, for the palette swap-in. Any files the sweep turns up, for the cleanup half.

**Inspection Points**
- Full-app grep sweep for literal palette classes and color-bearing inline styles (including inside `.scss` `@apply` bodies) returns nothing unexpected.
- Every page, in both themes, visually reviewed once real dark values are in place.
- Contrast spot-check on the admin table striping (now `--color-accent-subtle` for even rows, decided in Phase 5) and the type badges specifically — the four original domain badges plus the monster-archetype badge (Phases 4/5); the reserved mystery badge is out of scope entirely since no such badge exists (see Token Catalogue). Rosalina hand-verified the monster badge's construction (~8.5:1) and extrapolated the rest — this is the checkpoint to confirm minion/bystander/location/archetype badge text hold up with an actual contrast tool, per her Accessibility Notes.

---

### Phase 8 — Zero-Flash Guarantee (FOUC Prevention)

**Goal:** Close the flash-of-un-themed-content gap explicitly accepted since Phase 0. Add the inline synchronous `<head>` script from Decision E to `index.html`, so the correct theme class is present on `<html>` before the browser paints anything, on every load, regardless of bundle load time or network speed. This phase is deliberately isolated from every phase before it — nothing about `ThemeService`, the token layer, or any template's re-pointing changes here; this is purely closing the "when" gap Decision E describes, using the mechanism Decision E already specifies, once all the higher-risk repointing work is safely behind it.

**Risk:** Low — additive, a single file touched (`index.html`), no template or service surface changes.

**Files changed:** `src/index.html` only.

**What happens:**
- `src/index.html` gains the inline FOUC-prevention script from Decision E, as the first element in `<head>`, before the stylesheet `<link>` and before any bundle script tag.
- The script's persistence key (`motw:theme`) and resolution logic (persisted value, else `matchMedia('(prefers-color-scheme: dark)')`) are hand-verified against `ThemeService`'s own implementation to be an exact match — this is the two-place-duplication maintenance note from Decision E, checked explicitly as this phase's own "done" criterion, not left as a standing risk.

**Inspection Points**
- Manually calling `localStorage.setItem('motw:theme','dark')` then hard-reloading shows the `dark` class applied before any visible paint (no flash) — test on a throttled network (DevTools "Slow 3G" or similar) to make the flash window observable if it existed.
- Reloading with DevTools' "Emulate CSS prefers-color-scheme: dark" toggled and no stored preference yet seeds the correct resolved value before paint.
- Every page from Phases 1–7 still renders correctly on load in both themes — this phase changes nothing about template color, so any visual regression here is a signal the inline script and `ThemeService` have drifted out of sync, not a token/template bug.
- `ng build --configuration production` passes.

**Rollback:** revert `src/index.html`. `ThemeService` and every re-pointed template are entirely unaffected by rolling this phase back — the app returns to Phase 0–7's "correct theme, possible flash" behavior, not a broken one.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Flash of un-themed content on load, Phases 0–7 (before the inline script ships) | Medium | Low (visual only, no functional break) | Explicitly deferred and accepted through Phase 7, per Skyler (2026-08-02) — `ThemeService.initialize()` reconciles the correct theme as soon as Angular boots, so the flash window is real but small and non-blocking. Closed out by Phase 8's inline synchronous `<head>` script (Decision E), which runs before any bundle/paint and eliminates the window entirely. |
| Inline script's persistence-key logic drifts out of sync with `ThemeService`'s | Medium | Medium | Both reference the same literal key (`motw:theme`); called out explicitly as a two-place edit in Phase 8's "done" criteria (moved from Phase 0 now that the script itself ships in Phase 8). Consider a build-time constant shared between `index.html` and `theme.ts` if this proves error-prone in practice. |
| `@theme`-declared custom properties don't behave as expected under Angular's build pipeline (a new mechanism this app hasn't used yet, versus the existing static `--color-indigo-700`/breakpoint overrides) | Low | High | Verify in Phase 0 with the manual DevTools `.dark` class + no-op check before any template repointing begins in Phase 1. The active integration is `@tailwindcss/postcss` (auto-detected via `.postcssrc.json`), confirmed via the absence of any `vite.config.ts` or Vite plugin entry in `angular.json` — not `@tailwindcss/vite`, which is present in `package.json` but unused (see Decision B addendum). |
| A future token, or a second bare `@theme` block, bypasses `@theme static` | Low | Medium | All Catalogue tokens live in the single `@theme static` block in `styles.css` (Decision B addendum) — this is now a standing hygiene rule for every future phase or theme, not a one-time Phase 0 fix. Verify a new token renders identically under `:root` and `.dark` in DevTools' computed-styles panel, the same check that caught the original 5-token gap. |
| A phase repoints an `@apply` line onto a token/`@utility` class before fixing that file's `@reference` target | Medium | Medium (loud build failure, not a silent regression) | `@reference` must point at `"#styles.css"` (the `package.json` subpath-import alias), not bare `tailwindcss` and not a hand-computed relative path, before any token-backed `@apply` line is added (Decision B addendum) — the identical alias line is called out directly in Phases 2–6. |
| `package.json`'s `#styles.css` subpath-import alias is removed, renamed, or the target path drifts out of sync with `src/styles.css`'s real location | Low | Medium (loud build failure across every `@apply`-bearing file at once, not silent) | The `imports` field is load-bearing build configuration, not a stylistic convention (Decision B addendum) — treat edits to it with the same care as `tsconfig.json` paths or `angular.json` builder options; a broken alias fails the build with `Can't resolve '#styles.css'` for every affected file simultaneously, which is at least a fast, unambiguous signal. |
| Semantic re-pointing pass (Phases 1–6) accidentally changes visual appearance in light mode | Medium | Medium | Every token's light-mode value is fixed to the *current* literal value before any template repointing starts (Phase 0) — a correct repoint is a no-op change to light mode by construction; any visible light-mode diff during Phases 1–6 is a signal something was mis-mapped. |
| Type badge dark-fill contrast for the three hues Rosalina didn't hand-verify (minion, bystander, location) hasn't been tool-checked | Medium | Medium | Table striping and the archetype/monster badges are resolved (Phase 5 now specifies `--color-accent-subtle` for striping; the monster and archetype badges share a hand-verified ~8.5:1 construction) — remaining exposure is narrowed to a tool-checked contrast pass on the three un-verified badge hues, already a named Phase 7 inspection point. |
| Shell repointing (Phase 1) regresses the highest-traffic surface in the app | Medium | High | Same mitigation the original Tailwind migration used for its own Phase 2 — execute on a feature branch, inspect 3+ distinct pages, both themes, before merging. |
| Wizard repointing (Phase 6) breaks the primary data-entry flow | Low | High | Feature branch; full end-to-end wizard completion test in dark mode is a named inspection point, not just a visual check. |
| `custom-select`'s `@apply`-based compound-state rules (Phase 2) are miswired during token repointing, since the state logic (`is-open`, `is-selected`, …) lives in SCSS rather than the template | Medium | Medium | Repoint only the utility class *names* referenced inside existing `@apply` lines — no new selectors or state logic introduced; treat any behavioral change during this phase as a bug, not an expected side effect. |
| Backend-persisted theme preference is wanted sooner than auth ships | Low | Low | Persistence is already isolated behind a narrow read/write seam in `ThemeService` (Decision F) — swapping the backing store is a contained change, not a rearchitect. |
| A third theme is requested before this plan's token layer exists in full | Low | Low | Not applicable once Phase 0–8 ship — by design, a third theme is one new CSS selector block, zero template changes (Decision B), including for the accent/danger lighten-and-flip mechanism specifically. Flagged here only as a reminder of *why* the extra Phase-0 effort was worth taking on now. |

---

## Summary

Theming in this app is architecturally a two-part problem: **making theme-switching possible at all** (a `.dark`-scoped semantic token layer, replacing every literal palette utility currently in the codebase) and **making it controllable and persistent** (`ThemeService`, a thin Settings view, `localStorage` behind a swappable seam, and an inline pre-paint script so the correct theme is never flashed wrong). Neither half is optional given the Settings-view requirement — a manual toggle needs both a mechanism that can actually repaint the app and a place to live and persist. The two halves are also now explicitly decoupled in sequencing: the app is fully functional (tokens, service, Settings) from Phase 0 onward, and the zero-flash guarantee specifically is closed out on its own, last, in Phase 8 — a possible cold-load flash before then is a named, accepted gap, not a blocker.

The token-layer decision (Decision B) is the load-bearing call in this document: it costs a mechanical re-pointing pass across every template the Tailwind migration just finished, phased identically to that migration (shell first as the highest-risk/highest-reach surface, then shared components, then detail pages, list pages, medium/admin pages, and the wizard last as the highest functional risk). In exchange, it makes the *next* theme — and every theme after that — a palette-only change with no template risk, and it keeps the door open for the color values themselves to be entirely Rosalina's call, made independently of and after this implementation plan. The mechanism itself needed a real correction once Phase 1 implementation began (Decision B's addendum: the Category A/B split, `@theme static`, and the per-file `@reference` fix, now settled on a `package.json` subpath-import alias rather than hand-computed relative paths) — none of it changes what any template's final class names are, only how those classes actually come to exist in the compiled CSS, and it is now verified end-to-end against the shipped build rather than assumed.
