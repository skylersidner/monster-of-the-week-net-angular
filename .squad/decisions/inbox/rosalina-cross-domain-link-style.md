# Cross-domain asset link style (`.entity-link`)

**Date:** 2026-09-17
**Author:** Rosalina (Designer)
**Status:** proposed — advisory spec for Luigi to implement

## What

Add one global class family, `.entity-link` (+ `.entity-link--inline`), in
`src/web/monster-of-the-week-web/src/styles.css`, for any anchor that navigates to
another domain entity's detail view. Apply it at 14 call sites. Add a companion
`.back-link` for the "← Back to X" anchors (separately approvable).

## Why

Skyler reported "no hover effects" on the `/mysteries/{id}` asset links. The
underlying problem is bigger than hover: **Tailwind's preflight resets
`a { color: inherit; text-decoration: inherit; }`**, and this app never re-established
an anchor style. There is no `a` rule anywhere — not in `styles.css`, not in any
component `.scss`. So `<a [routerLink]="…">{{ monster.name }}</a>` in
`mystery-detail.html` renders as **plain body text**: no color, no underline, no
weight, no hover. The four asset lists on the mystery detail page look like static
text and are only discoverable by mousing over them for the cursor change.

Three ad-hoc, mutually inconsistent workarounds have grown up around the gap:

| Site | Current treatment |
|---|---|
| `dashboard.html:50` | `text-accent font-semibold no-underline` |
| `minions-list.html:23` | `text-inherit underline` |
| every list page + `mystery-detail` | `font-semibold`, or nothing at all |

This is also a WCAG 1.4.1 (Use of Color) failure at the two in-prose call sites and a
2.4.11 (Focus Not Obscured / Appearance) weak spot everywhere — the only focus
indicator today is the UA default outline.

## Options considered

1. **Global bare `a { }` rule in `@layer base`.** Rejected: it would also hit the eight
   filled-button anchors (`bg-accent … no-underline`), the four sidebar nav anchors, and
   the `action-btn--edit` icon anchor, all of which already own a deliberate hover. Each
   would then need an opt-out class — more churn than opting in.
2. **Per-component SCSS.** Rejected on the precedent already written into
   `styles.css`'s own `.action-btn` comment: a class with zero component-specific content
   belongs in the single global stylesheet, and this app has no shared-partial-`.scss`
   convention to split into.
3. **Row-level `hover:bg-surface-hover` on the containing `<li>`.** Rejected for now. The
   links are inline-width inside variable-width rows; tinting the link itself yields a
   ragged chip, and tinting the whole row is a different (larger) interaction decision
   — it turns the row into the click target, which it currently isn't.
4. **Underline-grow / translate-on-hover motion.** Rejected: these links sit in dense
   list rows where any geometry change reads as jitter.

**Chosen:** opt-in class, accent color at rest, underline fades in on hover/focus.

## The rest state, and why accent

`--color-accent` is the only entity-link color already shipping anywhere in this app
(`dashboard.html:50`), so it is the house precedent rather than an import. Contrast,
hand-checked:

| Pair | Ratio |
|---|---|
| `indigo-600` `#4f46e5` on `surface` `#ffffff` (light rest) | 6.29:1 ✓ AA |
| `indigo-700` `#4338ca` on `#ffffff` (light hover) | 7.90:1 ✓ AA |
| `indigo-400` `#818cf8` on `slate-900` `#0f172a` (dark rest) | 6.11:1 ✓ AA |

The light rest→hover step (indigo-600 → indigo-700) is a real but *subtle* darkening.
On its own it is a weak hover signal, which is precisely why the **underline is the
primary hover affordance** and the color shift is secondary reinforcement.

## Accessibility calls

- **Focus uses `outline`, not the `ring-focus` utility.** `--color-focus-ring` is
  indigo at 20% alpha (35% in dark). Every existing consumer pairs it with
  `focus:border-accent` — the border carries the contrast, the ring is a glow. A bare
  text link has no border, so `ring-focus` alone would be the sole indicator at roughly
  1.3:1 against `--color-surface` and fail 2.4.11/2.4.13. A solid 2px
  `var(--color-accent)` outline is ≥6:1 in both themes. `outline` also handles inline
  fragments across a line wrap correctly, which `box-shadow` does not.
- **Focus also gets the hover underline**, so a keyboard user sees the same state change
  a mouse user does, plus the ring.
- **Never `outline: none`** on these. (The form-input convention of
  `focus:outline-none focus:ring-focus` is correct *there* and wrong here.)
- **No `:visited` styling.** These are SPA router links to the user's own data, revisited
  constantly; a visited state would make the roster look greyed-out and stale inside a
  single session. `:visited` is also privacy-restricted to color properties and never
  resets. Explicitly out.
- **`prefers-reduced-motion`** — the only transition is a color/decoration crossfade with
  no transform or movement, so it is already safe; the guard is included defensively and
  because there is no precedent block in this codebase yet.

## Notable gap found, not fixed here

`hunter-detail.html:12` and `hunters-list.html:20` render `playbookName` as a
`bg-badge-playbook` chip with no link, and there is no `playbooks/:id` route in
`app.routes.ts`. That is the one genuinely cross-*domain* relationship in the app that
has no navigation at all. Out of scope for this pass; flagged as the natural next
`.entity-link` if a playbook detail route ever lands.
