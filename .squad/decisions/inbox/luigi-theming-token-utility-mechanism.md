### 2026-08-02: Theming — Token→Utility-Class Mechanism (supersedes `luigi-theming-phase1-utility-name-stutter.md`)
**By:** Luigi (Frontend Developer)
**Requested by:** Skyler Sidner — "adhere to [Tailwind's] guidance rather than adjust to accommodate our pattern."

**What:** The token-name→utility-class stutter (`text-text-primary`, `border-border`) is fixed properly, using Tailwind v4's documented `@utility` directive, rather than by living with the stuttering names (which is what my now-superseded earlier note decided) or by renaming tokens. **No token in the Token Catalogue is renamed. `docs/theming/dark-theme-palette.md` is entirely unaffected.** The fix is purely additive in `src/styles.css`.

---

#### 1. The rule

> **A token stays in `@theme` under `--color-*` and relies on Tailwind's automatic utility generation when its role name contains no utility-family word. A token gets a hand-written `@utility` block when its role *is* a single utility family, so that the family word would otherwise appear twice in the generated class name.**

Tailwind generates a color utility's name by concatenating the family prefix (`bg-`, `text-`, `border-`, `ring-`, `fill-`, `stroke-`, …) in front of the **entire** remainder of the `--color-*` property name, for **every** color-consuming family. It never parses or strips a family word out of that remainder, and there is no way to scope a `--color-*` entry to one family via naming. That is the whole mechanism — the stutter is not a bug to work around, it is the documented consequence of naming a token after the utility family you intend to use it with. Tailwind's own convention is therefore "name the token by role/identity only," and `@utility` is the documented escape hatch for the cases where the role genuinely *is* a family.

#### 2. Category A — stays in `@theme`, auto-generated (no change from Phase 0)

These are already role-named and are genuinely multi-family (`bg-accent`, `text-accent`, `border-accent`, `fill-accent` all read correctly), so automatic generation gives exactly the class names we want:

`surface`, `surface-sunken`, `surface-raised`, `accent`, `accent-hover`, `accent-subtle`, `on-accent`, `danger`, `danger-hover`, `danger-subtle`, `on-danger`, `success`, `sidebar-surface`, `sidebar-hover`, `sidebar-active`, `toast-success`, `on-toast-success`, `toast-error`, `on-toast-error`, all six `badge-*` / `on-badge-*` pairs, `weapon-chip`, `on-weapon-chip`, `weapon-chip-line`.

#### 3. Category B — hand-written `@utility` (new, in `src/styles.css`)

| Token (unchanged) | Utility Tailwind would generate | Utility we hand-define |
|---|---|---|
| `--color-text-primary` | `text-text-primary` | **`text-primary`** |
| `--color-text-secondary` | `text-text-secondary` | **`text-secondary`** |
| `--color-text-muted` | `text-text-muted` | **`text-muted`** |
| `--color-border` | `border-border` | **`border-default`** |
| `--color-border-strong` | `border-border-strong` | **`border-strong`** |
| `--color-sidebar-text` | `text-sidebar-text` | **`text-sidebar`** |
| (derived, 70% of the above) | — (see §7) | **`text-sidebar-muted`** |
| `--color-focus-ring` | `ring-focus-ring` | **`ring-focus`** |

**These are exactly the class names `theming-plan.md`'s Phase 1 re-pointing map already prescribes** (`text-primary`, `text-secondary`, `border-default`) — so the plan's map becomes *correct as written* rather than needing amendment. That is a large part of why I chose `@utility` over renaming tokens: the plan's prose, Rosalina's palette table, and the shipped Phase 0 `@theme`/`.dark` blocks all stay valid simultaneously.

#### 4. Yoshi's `on-*` rename was still the right call, and is not superseded by this

`@utility` did *not* make the `-bg`/`-text` → `on-*` rename unnecessary. Those tokens (`--color-toast-success`, `--color-badge-monster`, `--color-on-weapon-chip`, …) are genuinely multi-family — a badge fill is `bg-badge-monster`, and its on-color may legitimately need `text-`, `fill-`, or `stroke-` for an icon inside the badge. Category A is where you *want* automatic generation, and the `on-*` shape is precisely what makes those names stutter-free while staying multi-family. Hand-writing `@utility` for all of them would have thrown away generation for no gain. The two decisions are complementary: `on-*` fixed the multi-family tokens by naming; `@utility` fixes the single-family tokens by mechanism.

**One token Yoshi's `on-*` sweep missed, flagged not changed:** `--color-sidebar-text` is the same "fill + text-on-fill" shape as the pairs that were renamed (`--color-sidebar-surface` is the fill), so under a strict reading of the `on-*` rule it would be `--color-on-sidebar-surface` — which would generate `text-on-sidebar-surface` natively, no `@utility` needed, and would keep slash-opacity support (see §7). I used `@utility text-sidebar` instead, because it needs no token rename and produces a far shorter class name in templates. **Yoshi's call if he'd rather have the rename for catalogue consistency** — it's a one-line change in `styles.css` plus two class names in `page-layout.html`.

#### 5. `@theme` → `@theme static` — a second, separate silent-failure bug found and fixed

By default Tailwind **tree-shakes `@theme` custom properties out of `:root`**, emitting only those referenced by a used utility. The `.dark { … }` block is plain CSS and is emitted **verbatim, in full, always**. Those two behaviours disagree, and in the Phase-0-as-shipped build they already did: `--color-badge-minion`, `--color-badge-archetype`, `--color-weapon-chip`, `--color-danger-subtle`, `--color-success` were present under `.dark` but **absent from `:root`** — i.e. *defined in dark mode and undefined in light mode*.

This is harmless for Tailwind-generated utilities (a token is emitted precisely because a utility needed it) but **silently breaks any hand-written CSS that reads a token directly via `var(--color-…)`** — which is exactly what Phase 5's admin table row-striping fix is specified to do (`background: var(--color-surface) !important` / `var(--color-accent-subtle) !important`). It would have worked in dark mode and fallen back to unstyled in light mode, with a clean build.

**Fixed now by declaring `@theme static`**, which forces every token to be emitted. Verified: all 39 tokens under `.dark` are now also present in `:root`, 0 missing (was 5 missing). Cost is 767 bytes of CSS.

#### 6. `@apply` in component SCSS needs `@reference "…/styles.css"`, not `@reference "tailwindcss"`

All ten component `.scss` files in this app open with `@reference "tailwindcss"`, which loads **only Tailwind's own default theme** — our `@theme` tokens and `@utility` classes do not exist in that context. `@apply bg-accent` under it fails the build with `Cannot apply unknown utility class 'bg-accent'`. This is at least **loud, not silent** — but it is a hard blocker for Phase 2 (`custom-select.component.scss` is the big one) and Phases 3/5/6, all of which repoint `@apply` lines.

**Fix, applied to `header-search.scss` and required for every other `@reference` file as its phase repoints it:** `@reference "../../../styles.css"` (relative depth varies per file). Verified working end-to-end: the compiled component rule is `background-color:var(--color-accent, var(--color-indigo-600))` and repaints correctly in both themes through Angular's emulated encapsulation.

#### 7. Accepted trade-off: `@utility` has no slash-opacity modifier

`text-primary/70` emits **nothing** (confirmed empirically). Generated `--color-*` utilities support the modifier; hand-written static `@utility` classes do not. The one place Phase 1 needed it (`text-sidebar-text/70`, the disabled nav item) is handled by a second named utility, `text-sidebar-muted`, with an explicit `color-mix(in oklab, var(--color-sidebar-text) 70%, transparent)`.

Correction to something I previously wrote: hand-writing the `color-mix` does **not** avoid Tailwind's unguarded baked-literal fallback — Tailwind rewrites `color-mix()` in an `@utility` body the same way it does for a modifier, emitting a light-value-baked `in srgb` rule plus an `@supports (color: color-mix(in lab, …))` override. Symmetric in `:root` and `.dark`, so it's correct in both themes; it only matters for a browser failing that `@supports` test.

#### 8. Empirical verification (the same probe technique as before, extended)

1. **Probe build.** A temporary `@utility` block + throwaway `src/theme-probe.html` containing every candidate class name → `ng build --configuration production` → grep the emitted `dist/**/styles-*.css`. Confirmed: `@utility` emits the exact class name; variants all work (`.hover\:text-primary:hover`, `.focus\:ring-focus:focus`, `.md\:text-secondary`, `.dark\:text-muted:where(.dark,.dark *)`); `text-primary/70` emits nothing; Tailwind's theme-variable usage tracking **does** follow `@utility` bodies (`--color-focus-ring`/`--color-border-strong` were emitted to `:root` solely because an `@utility` referenced them).
2. **Whole-template no-op sweep.** A script extracts every static `class="…"`, `routerLinkActive="…"`, and `[class.x]` name from `page-layout.html`, `settings.html`, and `header-search.html` and asserts each emits a real rule somewhere in the build output (global CSS *and* component styles inlined into JS chunks). **194 class names checked, 0 missing.** The checker was itself self-tested against a file containing `text-text-primary`, `border-border`, and `text-bogus-nonexistent` — it correctly flagged all three, so a pass is meaningful rather than vacuous. This sweep is worth re-running per phase; it is the only thing that catches a silently-dead class name.
3. **Live two-theme diff (Playwright + `ng serve` + real API/Postgres).** Injected Rosalina's real dark values as a runtime `.dark` block and read `getComputedStyle` on 13 shell/header-search elements in both themes. **Every one changed between themes — zero no-deltas.** Also verified: focus ring (`indigo-500/20` light → `indigo-400/35` dark), user-menu panel (`white`/`slate-200`/`slate-950` → `slate-800`/`slate-700`/`slate-50`), API-modal panel and both text roles, header-search dropdown panel, and `.is-highlighted` via the component-SCSS `@apply` path (`indigo-600`+white light → `indigo-400`+`slate-900` dark — **light mode byte-identical to the pre-change literals**).

---

#### 9. What actually changed in the working tree

- `src/styles.css` — `@theme` → `@theme static`; new documented `@utility` block (8 utilities). Token names/values untouched.
- `page-layout.html`, `settings.html` — mechanical rename of the stutter class names to the corrected ones (`text-text-primary`→`text-primary`, `border-border`→`border-default`, `text-sidebar-text`→`text-sidebar`, `text-sidebar-text/70`→`text-sidebar-muted`, …). **Phase 1 was evolved in place, not rolled back** — the stutter was confined to 5 class names across 2 files; everything else in Phase 1 (settings component, route, user-menu link, inline-style conversions, toast `[class.*]` bindings, spinner `currentColor`) was already correct and independently verified, so a rollback would have discarded good work to redo it identically.
- `header-search.html` / `.scss` — newly in scope (see §10).

No spec changes were needed: `page-layout.spec.ts` and `header-search.spec.ts` assert only on structural classes (`.sidebar-mobile`, `.api-modal`, `.is-highlighted`) and text/`href`, never on color utilities.

#### 10. `shared/header-search/` folded into Phase 1

Confirmed via `git log` that it shipped in the search feature's "Phase 2 (UI first pass)" commit, well before the theming branch — it was missed by the plan's original repo scan, not added late. It renders inside the shell header, so Phase 1 is its natural home. Re-pointed: wrapper icon `text-slate-400`→`text-muted`; input `border-slate-200`→`border-default`, `text-slate-950`→`text-primary`, `focus:border-indigo-500`→`focus:border-accent`, `focus:shadow-[0_0_0_2px_rgba(99,102,241,0.18)]`→`focus:ring-focus`; listbox `bg-white`→`bg-surface-raised`, `border-slate-200`→`border-default`; option `text-slate-950`→`text-primary`; no-results `text-slate-500`→`text-muted`; SCSS `@apply bg-indigo-600 text-white`→`@apply bg-accent text-on-accent`.

Three deliberate, sanctioned light-mode shade shifts (each because no token holds the exact old value, and the Catalogue names the new one as the correct role): search icon `slate-400`→`slate-500`; focus border `indigo-500`→`indigo-600` (`--color-accent`); focus ring alpha `.18`→`.20` (the Catalogue's "`indigo-500` @ ~20%").

**The input needs no `bg-*` and no placeholder token** — Tailwind's preflight makes form controls `background-color: transparent`, so it inherits the header's `bg-surface`, and the UA `::placeholder` derives from the element's `color` at 50% alpha, so it follows `text-primary`. Verified in both themes. This also retires the worry in my earlier open-items note that "the search input stays a white box in an otherwise dark header" — it doesn't; it was only white because the header was.

**Why:** Following the plan's re-pointing map literally produced unstyled elements with a clean build, and my earlier decision to live with the stuttering names would have multiplied that shape across every remaining phase. `@utility` is Tailwind's own documented answer for controlling a utility's exact class name independently of the custom property behind it, and it lets the plan's existing names, the `on-*` decision, and Rosalina's palette all stand unchanged. The `@theme static` and `@reference` findings are the same class of defect — silently or loudly missing CSS — surfaced by the same investigation, and both would have landed in later phases.

#### 11. Open for Yoshi / Skyler

1. **`--color-sidebar-text` → `--color-on-sidebar-surface`?** See §4. Consistency with the `on-*` rule vs. shorter class names. My call was the shorter name; either is defensible.
2. **`--color-focus-ring` is now consumed only through `@utility ring-focus`,** which hardcodes the `0 0 0 2px` geometry. If a second focus treatment ever needs a different width, that becomes two utilities or a rename to `--color-focus` (role-only, natively generating `ring-focus`/`border-focus`/`outline-focus`). Fine as-is for now; noting the constraint.
3. **`text-sidebar-muted` is a utility with no token of its own** — its 70% value is computed inline from `--color-sidebar-text`. Deliberate (§7), but it does mean one color value lives outside the Token Catalogue. If that's unacceptable, it wants a real `--color-sidebar-text-muted` token, which is Rosalina's to value.
4. **The stuttering names still resolve if someone writes them.** `text-text-primary` is not an error — it's simply never emitted because nothing uses it. Nothing mechanically prevents a future author from writing it. Worth one line in the plan's conventions section.
5. **`@reference` path fix is a per-file obligation for Phases 2/3/5/6** (§6) — the nine remaining `.scss` files still say `@reference "tailwindcss"` and will fail their phase's build the moment a token appears in an `@apply`. Worth listing as an explicit inspection point on each of those phases.
6. **Still open from my earlier note, unchanged:** the API-unavailable modal panel uses `bg-surface` per the plan's Phase 1 text while `dark-theme-palette.md` and the Catalogue's own role description say modals are `--color-surface-raised`. Now visibly inconsistent with the user-menu panel *and* the header-search dropdown panel in the same file, both of which are `bg-surface-raised`. One-word fix whenever it's decided.

**Docs:** `docs/theming/theming-plan.md` (Token Catalogue; the "Resolved (2026-08-02) — token naming vs. Tailwind-generated utility classes" subsection; Phase 1's re-pointing map; Phase 2/3/5/6 file lists; Phase 5's striping rules), `docs/theming/dark-theme-palette.md` (unaffected), `src/web/monster-of-the-week-web/src/styles.css`.
