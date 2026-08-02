# Dark Theme Palette

**Monster of the Week — Angular Web App**
**Produced by:** Rosalina (UX/Design) · Squad
**Requested by:** Skyler Sidner
**Date:** 2026-08-02

---

## Overview

This document fills in *values* for every token name Yoshi's `docs/theming/theming-plan.md` Token Catalogue defines. It does not touch mechanism, phasing, or file lists — those stay exactly as written there. It is meant to be read alongside that document (for the token roles) and `docs/tailwind-migration-plan.md` (for what light mode looks like today, as the anchor this palette needs to feel like a counterpart to, not a replacement for).

Every value below is either a bare Tailwind v4 palette reference (`slate-900`, `indigo-400`) — including Tailwind's own opacity-modifier syntax (`indigo-400/16`) already used elsewhere in this codebase for `bg-white/20`, `hover:bg-blue-800/40`, `bg-black/45`, etc. — or an explicit hex where a value needs pinning for clarity (mirroring how the migration doc pinned `--color-indigo-700: #4338ca`). Nothing here requires a new build dependency or a color system outside what Tailwind v4 already ships.

## Philosophy

Four decisions shape every value in this document:

**1. Desaturated slate, not pure black.** The light theme's neutrals are already `slate-*` (text, borders, shell background) and its brand accent is `indigo-*`. The dark theme reuses the *same* `slate` family for its dark neutrals rather than introducing `zinc`/`neutral`/true black — this is what makes the dark theme read as "the same app with the lights off" instead of a different product skin. Pure black (`#000`) is avoided as a base surface for the standard reason: it maximizes contrast in a way that causes eye strain and makes colored content (badges, accent, danger) vibrate against it. `slate-950`/`slate-900` give a deep, near-black navy that's dark enough to read as "dark mode" while staying soft enough to sit under saturated color.

**2. Elevation via lightness steps, not shadows.** Light mode's three surface roles are almost flat today (`surface` and `surface-raised` are both plain white; `surface-sunken` is a barely-different `slate-50`), with elevation communicated mostly by border + shadow. In dark mode, shadows lose most of their power (a dark shadow on a dark background barely reads), so this palette leans on the standard dark-UI substitute: each elevation step gets its own, slightly lighter, flat fill. From the page shell down to the topmost surface: `surface-sunken` (`slate-950`, darkest — the page's "floor") → `surface` (`slate-900`, cards/lists — one step up) → `surface-raised` (`slate-800`, modals/dropdowns/menus — one step up again, since these visually float above everything else). This monotonic ladder is the load-bearing idea for every surface value below.

**3. Accent and danger both get a "lighten and flip the on-color" treatment for dark mode, not a straight reuse of their light-mode hue.** Yoshi's catalogue gives each of these exactly one token, reused for two different jobs: (a) plain text/link/icon color sitting directly on a surface, and (b) a filled button/chip background with a contrasting color on top. In light mode, `indigo-600`/`red-600` happen to satisfy both jobs at once because they're mid-dark saturated colors sitting on a *white* surface. On a *dark* surface that stops being true — a color dark enough to read as a good button fill is usually too dark to read as legible text, and vice versa. Rather than pick an unhappy middle value that's mediocre at both jobs, this palette lightens `accent`/`danger` for dark mode (`indigo-400`/`red-400`) and flips `on-accent` from white to a dark neutral (`slate-900`). I verified with the WCAG contrast formula (see Accessibility Notes) that this single pair of values comfortably clears AA in *both* roles — as text-on-surface and as a button-fill with the flipped on-color — which is why one token can still do both jobs in dark mode, just via a different mechanism than light mode uses.

**4. Hover moves toward the light, not away from it.** Light mode's hover convention is "darken" (`indigo-600` → `indigo-700`). Once accent/danger are already light tints in dark mode, darkening on hover would reduce contrast and read as a "disabling" cue rather than a "highlighting" one. Dark-mode hover states in this palette instead go one step *lighter* (`indigo-400` → `indigo-300`, `red-400` → `red-300`), which is the more common dark-UI hover convention and reads correctly as "more prominent," matching what darkening communicates in light mode.

---

## Token Value Table

| Token | Light (current) | Dark (proposed) | Notes |
|---|---|---|---|
| `--color-surface` | `white` (`#ffffff`) | `slate-900` (`#0f172a`) | Card/list-item/base surface. Middle of the elevation ladder. |
| `--color-surface-sunken` | `slate-50` (`#f8fafc`) | `slate-950` (`#020617`) | Shell/page background, disabled input fill. Darkest of the three in dark mode — inverted from light mode's "sunken = slightly darker than white cards" because the ladder direction that matters is *relative*, and this keeps `surface` popping above the page floor in both themes. |
| `--color-surface-raised` | `white` (`#ffffff`, same as surface) | `slate-800` (`#1e293b`) | Modal, dropdown panel, user-menu panel. In light mode this coincides with `surface`; in dark mode it deliberately diverges (one step lighter than `surface`) so a modal/dropdown visibly "floats" above the page — light mode gets this same effect for free from its drop-shadow, which dark mode can't rely on as strongly. |
| `--color-border` | `slate-200` (`#e2e8f0`, and near-aliases) | `slate-700` (`#334155`) | Card/header hairline. Intentionally low-contrast against `surface` (~1.7:1) — decorative divider, same posture as light mode's own subtle `slate-200`-on-white hairline. Not relied on to convey information alone. |
| `--color-border-strong` | `#c9d4e6` | `slate-500` (`#64748b`) | Form input border. Deliberately *not* `slate-600` — I computed `slate-600` at only ~2.36:1 against `slate-900`, under the 3:1 non-text-UI-component guideline for an interactive control's boundary; `slate-500` clears it at ~3.75:1. |
| `--color-text-primary` | `slate-950` (`#0f172a`) | `slate-50` (`#f8fafc`) | Headings. ~17:1 against `surface` — no concerns. |
| `--color-text-secondary` | `slate-600` / `gray-700` | `slate-300` (`#cbd5e1`) | Body text. ~12:1 against `surface`. |
| `--color-text-muted` | `slate-500` / `gray-500` / `slate-400` | `slate-400` (`#94a3b8`) | Muted/meta/placeholder text. ~7:1 against `surface` — chose `slate-400` over the visually-closer `slate-500` (~3.3:1) specifically because muted text is still real content (empty-state hints, meta rows) and deserves a real AA margin, not just a "decorative" pass. |
| `--color-accent` | `indigo-600` / `indigo-700` | `indigo-400` (`#818cf8`) | See Philosophy #3. ~5.98:1 both as text-on-`surface` and as a fill with `on-accent` on top. |
| `--color-accent-hover` | `indigo-700` / `indigo-800` | `indigo-300` (`#a5b4fc`) | Lighter, not darker — see Philosophy #4. |
| `--color-accent-subtle` | `indigo-50` (`#eef2ff`) | `indigo-400/16` | Alpha wash rather than a flat dark hex, so it composites correctly no matter which surface token it sits on top of (`surface` in the shell, `surface-raised` inside a dropdown panel). |
| `--color-on-accent` | `white` | `slate-900` (`#0f172a`) | Flips to a dark neutral — see Philosophy #3. ~5.98:1 against `--color-accent`. |
| `--color-focus-ring` | `indigo-500` @ ~20% | `indigo-400/35` | Bumped from ~20%→35% opacity: a translucent ring needs more opacity to stay visible against a dark surface than it does against white. |
| `--color-danger` | `red-600` / `red-800` | `red-400` (`#f87171`) | Same lighten-for-dark-legibility logic as accent. ~6.45:1 against `surface`. |
| `--color-danger-hover` | `red-700` | `red-300` (`#fca5a5`) | Lighter, not darker — see Philosophy #4. |
| `--color-danger-subtle` | `red-100` / `red-50` | `red-500/15` | Alpha wash, same reasoning as `accent-subtle`. Also deliberately *not* a flat `red-950`-style solid — a solid near-black red sitting on a near-black slate surface reads as almost no differentiation at all; a translucent overlay stays visibly "tinted" regardless of what's underneath. |
| `--color-success` | `emerald-500` / `#1b6f2a` | `emerald-400` (`#34d399`) | Wizard-complete bubble / general positive state. Lightened for the same surface-legibility reason as accent/danger. |
| `--color-sidebar-surface` | `indigo-700` (`#4338ca`) | `indigo-900` (`#312e81`) | The sidebar stays a distinct brand-colored surface in both themes (not neutralized to slate) — it's part of the app's identity, not a content surface. Deepened rather than just reused as-is so it doesn't compete for brightness with the lightened accent used elsewhere on the page. |
| `--color-sidebar-text` | `blue-100` (`#dbeafe`) | `indigo-200` (`#c7d2fe`) | ~7.66:1 against `sidebar-surface`. |
| `--color-sidebar-hover` | `blue-800/40` | `indigo-700/40` | `indigo-700` is lighter than the new `indigo-900` base, so the overlay reads as a visible lightening on hover, mirroring the light-theme mechanism exactly. |
| `--color-sidebar-active` | `blue-800/65` | `indigo-700/70` | Same overlay color as hover, higher opacity for the stronger "selected" state — same relationship as light mode's hover/active pair. |
| `--color-toast-success-bg` | `#1b6f2a` | `emerald-700` (`#047857`) | See note below — I checked `emerald-600` first and it only gives white text ~3.77:1 (fails AA); `emerald-700` gives ~5.49:1. |
| `--color-toast-error-bg` | `#a10808` | `red-700` (`#b91c1c`) | ~6.47:1 with white text. Slightly brighter than the current very-dark literal, intentionally — see "Toast brightness" open question below. |
| `--color-badge-mystery-bg` / `-text` | n/a today (reserved) | n/a today (reserved) | See Badges section — I'm proposing an actual value pair now, flagged as an open question since the feature doesn't exist yet. |
| `--color-badge-monster-bg` / `-text` | `red-100` / `red-700` | `red-950` (`#450a0a`) / `red-300` (`#fca5a5`) | ~8.5:1. See Badges section for the hue-preservation rationale, which applies to all four active badges. |
| `--color-badge-minion-bg` / `-text` | `#fde8d8` / `orange-800` | `orange-950` (`#431407`) / `orange-300` (`#fdba74`) | |
| `--color-badge-bystander-bg` / `-text` | `blue-100` / `blue-800` | `blue-950` (`#172554`) / `blue-300` (`#93c5fd`) | |
| `--color-badge-location-bg` / `-text` | `green-100` / `green-900` | `green-950` (`#052e16`) / `green-300` (`#86efac`) | |
| `--color-weapon-chip-bg` / `-border` / `-text` | `indigo-50` / `indigo-200` / `indigo-700` | `indigo-950` (`#1e1b4b`) / `indigo-800` (`#3730a3`) / `indigo-300` (`#a5b4fc`) | Same "deep tinted bg + light tinted text" construction as the badges. |

**A token not yet in Yoshi's catalogue — flagging, not deciding unilaterally:** to make the delete-confirmation button's white text keep working once `--color-danger` lightens for dark mode, this palette needs a `--color-on-danger` token (mirroring `--color-on-accent`): **light = `white`** (unchanged), **dark = `slate-900`**. Today the confirm-delete modal's delete button hardcodes `text-white` rather than referencing a token, so this only becomes load-bearing once that button is re-pointed in Yoshi's Phase 2 — flagging it now so it isn't discovered as a gap mid-phase. See Open Questions.

---

## Badges: hue-preservation decision

**Decision: keep each domain's existing hue family in dark mode** (monster = red, minion = orange, bystander = blue, location = green), just inverted to a deep-tinted background with a light-tinted text color, rather than picking new hues or a neutral scheme.

**Why:** these five badges are a fixed legend a user memorizes across the whole app — "red badge = monster" is muscle memory, not a color choice being made for variety. Per Yoshi's plan, the theme toggle in Settings re-colors the app *live*, with no reload — a user could plausibly flip Light/Dark while looking directly at a list page. If a badge's hue family changed between themes, that same badge would visually "swap identity" mid-toggle, which is a worse experience than the alternative: keep the hue, just re-balance which end of that hue's lightness range is background vs. text (light mode: pale bg + saturated-dark text; dark mode: near-black bg + pale text). This is the same construction already used for `accent-subtle`/`danger-subtle` and the weapon-tag chip, so it's consistent with the rest of this palette, not a one-off treatment invented just for badges. I verified one representative pair (`red-950`/`red-300`) at ~8.5:1 contrast — comfortably AA — and the other three follow the same lightness relationship closely enough that I'd expect similar results, but see Accessibility Notes for which ones I didn't hand-verify.

**Mystery badge (reserved slot):** since mysteries don't have a type badge today, I'm proposing a value pair now so the token isn't dangling if/when one is built: **light = `teal-100`/`teal-800`, dark = `teal-950`/`teal-300`**. Teal was chosen specifically to stay clear of every hue already spoken for: red (monster/danger), orange (minion — note `amber` was considered and rejected here, it sits too close to minion's orange on the hue wheel), blue (bystander), green (location/success), indigo (accent/weapon-chip), and purple (already in use — see the archetype-badge gap below). This is speculative since the feature doesn't exist; flagged as an open question, not a firm commitment.

**A gap this surfaced, outside Yoshi's catalogue:** `monsters-list.html` and `monster-detail.html` now render a **monster-archetype badge** (`bg-purple-100 text-purple-700`) added after the Tailwind migration and theming-plan docs were written — it isn't in Yoshi's Token Catalogue at all and would silently stay light-only through every phase of the theming rollout unless someone adds it. If it follows the same pattern as the other badges, my proposed values would be **`--color-badge-archetype-bg`/`-text`: light `purple-100`/`purple-700` (unchanged), dark `purple-950`/`purple-300`**. Flagging this as a catalogue gap for Yoshi rather than adding it to the catalogue myself, since that document's token list isn't mine to edit.

---

## Modals & Overlays

**Backdrop/scrim: stays a fixed, theme-invariant dark overlay.** Both the confirm-delete modal (`bg-black/45`) and the API-unavailable modal (inline `rgba(15,23,42,.58)`, i.e. roughly `slate-950/58`) already use a translucent near-black scrim in light mode. A scrim's entire job is to dim whatever's behind it regardless of what "behind it" looks like — this is standard practice and doesn't need a dark-mode variant. **Recommendation: leave both as literal `slate-950`-family translucent overlays (e.g. standardize both on `bg-slate-950/55`), unchanged across themes.** No new token is needed for this.

**Modal panel and dropdown/user-menu panels use `--color-surface-raised`.** This is exactly why that token was designed to diverge from `--color-surface` in dark mode (Philosophy #2) — without it, a `slate-900` modal sitting on a `slate-900` page (once the page background is also dark) would have no visual separation at all beyond the scrim. `surface-raised` (`slate-800`) gives the modal a floor-detached feel that doesn't depend on the shadow doing all the work.

**The "Soon" nav badge** (currently a hardcoded `rgba(255,255,255,.2)` inline style, per Yoshi's Phase 1 notes): a translucent-white overlay lightens whatever's beneath it in both themes automatically — it works over the light-mode `indigo-700` sidebar today and will work identically over the dark-mode `indigo-900` sidebar. **Recommendation: no dedicated token needed; keep it as a plain `bg-white/20` utility class once it moves out of the `style=` attribute**, confirming Yoshi's suggestion that this one is fine to leave as-is.

---

## Icons

Per the migration doc, most icons are unfilled inline SVGs that inherit color via `currentColor` from a parent `text-*` utility (action-button icons, sidebar icons, header icons). **This pattern holds in dark mode with zero additional work**: once a parent element's literal `text-slate-500`/`text-red-600`/etc. is re-pointed to `text-muted`/`text-danger`/etc. in Yoshi's phases, every icon inside it repaints automatically — icons never need their own token.

**One exception, flagged as an implementation gotcha, not a design gap:** the API-unavailable modal's loading spinner hardcodes `stroke="white"` / `fill="white"` as raw SVG attributes (not a class, not `currentColor`) on its circle/path. Because this palette flips `--color-on-accent` from `white` (light) to `slate-900` (dark) for the retry button it sits inside, that spinner would become a barely-visible white-on-light-indigo mark in dark mode unless it's fixed. **Recommendation: convert those two attributes to `stroke="currentColor"`/`fill="currentColor"`** so the spinner inherits `on-accent` from the button, the same way every other icon in the app already does. This falls inside Yoshi's Phase 1 (which already touches this exact modal to remove its inline styles) — flagging it explicitly so it isn't missed as "just a color swap."

---

## Error / Unhappy-Path States

The instinct to avoid in dark mode is saturated red directly on a near-black background — that combination is the classic "vibrating"/glowing look. This palette avoids it two ways:

1. **`--color-danger` itself is a *lightened* red (`red-400`), not a saturated `red-600`/`700`.** A lighter, slightly softer red sitting on `slate-900` reads as "clearly red, clearly meaningful" without the high-saturation/high-darkness combination that causes the glow effect.
2. **`--color-danger-subtle` is a low-opacity wash (`red-500/15`), not a flat saturated or flat near-black chip.** The submit-error banner in the wizard and the delete-hover chip both use this — a soft red-tinted wash behind `red-400` text reads as a calm "something needs attention" banner, not an alarm.

This covers: field-level validation text (`.field-error`), the wizard's submit-error banner, the API-unavailable modal's body copy (routes through `--color-text-secondary`, not danger — it's informational, not a validation error, so it correctly stays neutral rather than red), and the delete-hover chip on list-page action buttons. The delete-confirmation button itself (a *filled* danger surface, not danger-as-text) keeps the higher-contrast pairing described in the `--color-on-danger` note above.

---

## A specific recommendation for the admin table striping (flagged in Yoshi's Phase 5)

Yoshi's plan illustrates the `nth-child` row-striping fix as `--color-surface` (odd) / `--color-surface-sunken` (even), explicitly marked as a placeholder pending my review. **I'm recommending against that specific pairing.** I computed the contrast between `--color-surface` (`slate-900`) and `--color-surface-sunken` (`slate-950`) in dark mode at only **~1.13:1** — those two tokens were designed for a coarse "page floor vs. card" jump, not a fine per-row alternation, and at that gap the stripe would collapse to imperceptible, which is exactly the failure mode Yoshi's Phase 5 inspection point already anticipated.

**Recommendation: reuse `--color-accent-subtle` for the even rows instead**, in both themes. This also better preserves the *original* light-mode intent — today's even-row fill is a literal `#dbeafe` (a pale blue wash), not `slate-50`; it was never really "the sunken/shell color" in spirit, just a similar-looking pale tint. `accent-subtle` (`indigo-50` light / `indigo-400/16` dark) is a near-identical pale wash in light mode and, critically, stays clearly visible as a tint in dark mode because it's a translucent overlay rather than two solid near-black neutrals sitting almost on top of each other.

```scss
/* Recommended, overriding the theming-plan's illustrative placeholder: */
.records-table tbody tr:nth-child(odd) > td  { background: var(--color-surface) !important; }
.records-table tbody tr:nth-child(even) > td { background: var(--color-accent-subtle) !important; }
```

---

## Accessibility Notes

Ratios below were computed by hand using the standard WCAG relative-luminance formula against the exact hex values in this document. I'm reasonably confident in the arithmetic, but flag this as worth a quick pass through an actual contrast checker before implementation, per usual practice — especially for anything involving an alpha-composited value, where the *effective* color depends on exactly what's behind it.

**Verified, high confidence (flat colors only):**
- `text-primary` (`slate-50`) on `surface` (`slate-900`): **~17:1**
- `text-secondary` (`slate-300`) on `surface`: **~12:1**
- `text-muted` (`slate-400`) on `surface`: **~6.96:1**
- `accent` (`indigo-400`) on `surface`, as plain text/link: **~5.98:1**
- `on-accent` (`slate-900`) on `accent`-filled background: **~5.98:1** (same pair, same ratio, both roles pass)
- `danger` (`red-400`) on `surface`: **~6.45:1**
- `sidebar-text` (`indigo-200`) on `sidebar-surface` (`indigo-900`): **~7.66:1**
- `badge-monster-text` (`red-300`) on `badge-monster-bg` (`red-950`): **~8.51:1**
- white toast text on `toast-success-bg` (`emerald-700`): **~5.49:1** (rejected `emerald-600` first — only ~3.77:1, fails AA)
- white toast text on `toast-error-bg` (`red-700`): **~6.47:1**
- `border-strong` (`slate-500`) vs. `surface`, non-text UI component: **~3.75:1** (clears the 3:1 guideline; the visually-closer `slate-600` only reaches ~2.36:1 and was rejected for that reason)

**Not individually hand-verified — please double-check with a tool before implementation:**
- `badge-minion-text`/`badge-bystander-text`/`badge-location-text` against their own `-950` backgrounds — I verified the *construction* (deep `-950` bg + `-300` text) once on the monster badge and am extrapolating that the other three hues behave similarly at the same lightness steps, but didn't compute each one.
- Every alpha-composited value (`accent-subtle`, `danger-subtle`, `focus-ring`, `sidebar-hover`, `sidebar-active`) — these depend on what's rendered underneath, which varies by context (a dropdown panel vs. the page shell), so a flat contrast number isn't fully meaningful for them the way it is for a solid fill. Spot-check the actual composited result in the browser, not just the token's own value.
- `weapon-chip-text` (`indigo-300`) on `weapon-chip-bg` (`indigo-950`) — same construction as the badges, same confidence level (should be fine, wasn't independently computed).

---

## Open Questions

Flagging these explicitly rather than deciding silently, per the brief:

1. **Accent/danger "lighten + flip on-color" pattern for dark mode.** This is a real visual-identity choice, not just a technical contrast fix: primary buttons go from "solid saturated indigo with white text" (light) to "pale indigo pill with dark navy text" (dark), rather than staying a straightforwardly-darker version of the same look. I chose this because it's the only way I found to make a *single* `--color-accent` token work well as both plain text-on-surface and a button fill in dark mode (see Philosophy #3) — but if brand consistency of the *button* specifically matters more than that, the alternative is asking Yoshi to split the single `--color-accent` token into a separate button-fill token, which is a mechanism change outside my scope to decide alone. Worth a quick look at the button in isolation before sign-off.
2. **New `--color-on-danger` token.** Needed so the delete-confirmation button's text stays legible once `--color-danger` lightens for dark mode (see the table note). This wasn't in Yoshi's original catalogue — flagging for Yoshi to fold into the token list rather than adding it there myself.
3. **Monster-archetype badge (`purple-100`/`purple-700`) has no token at all.** It postdates both the migration and theming-plan docs and would silently stay light-only through every phase unless it's added to the catalogue. My proposed dark value if/when it's added: `purple-950`/`purple-300`.
4. **Mystery type badge is entirely speculative.** I proposed `teal-100`/`teal-800` (light) and `teal-950`/`teal-300` (dark) purely so the reserved token has *a* value rather than a placeholder, but no such badge exists yet — treat this as a placeholder proposal, not a commitment, until the feature is actually scoped.
5. **Toast colors got noticeably brighter than their current hardcoded hex** (`#1b6f2a`→`emerald-700`, `#a10808`→`red-700`). The originals were very dark/muted even by light-mode standards; I brightened them because a toast needs to visibly "pop" against what's now a dark page background, and because the darker options I checked first failed AA with white text. Worth a quick visual look together with Skyler, since it's a slightly more noticeable color shift than most other tokens in this document.
6. **Table-striping recommendation (reusing `--color-accent-subtle` for even rows) overrides Yoshi's illustrative placeholder** in the theming plan. I'm confident in the reasoning (see the dedicated section above) but flagging since it changes what that section of the implementation plan currently shows.
