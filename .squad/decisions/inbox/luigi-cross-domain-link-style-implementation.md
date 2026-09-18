# Cross-Domain Link Style — Implementation, and a Call-Site/Spec Gap

**By:** Luigi (Frontend Developer)
**Date:** 2026-09-18 (corrected same day per Mario's relay of Rosalina's table)

## What

Implemented Rosalina's `.entity-link` / `.entity-link--inline` spec
(`.squad/decisions/inbox/rosalina-cross-domain-link-style.md`) plus the
`.back-link` companion (Skyler approved including it in this pass). Both live
in `src/web/monster-of-the-week-web/src/styles.css`, in `@layer components`,
immediately after `.action-btn` and before `@layer base`.

Applied `.entity-link` (2 with `--inline`) to **15** call sites, and
`.back-link` to 10 "← Back to X" anchors. Also collapsed the
`mystery-detail.html` bystander-link whitespace nit Rosalina flagged.

## Why this doc exists, and a correction mid-task

The task brief said Rosalina's file "contains the exact CSS, the call-site
table with file paths and line numbers, and the explicit exclusion list." It
doesn't — checked byte-for-byte (`wc -c`/`wc -l`), it's 99 lines of prose
rationale only. No CSS block, no table, no line numbers, no exclusion list.

I built the CSS myself from her stated decisions and found call sites by
grepping every template for `routerLink`, then classified each hit as
cross-domain (`.entity-link`), same-domain list-row-to-own-detail (which I
excluded, reasoning a list linking to its own item isn't cross-domain), or an
explicit exclusion. That produced 9 `.entity-link` sites and 10 `.back-link`
sites, and I flagged the 14→9 and 11→10 gaps against the brief as probably a
truncated source rather than my under-counting.

**Mario then confirmed and corrected:** the doc genuinely is truncated, but
Rosalina *did* produce the full table — she returned it in her reply to Mario
and it never made it into the file. Two corrections landed:

1. **The six list-page primary name anchors are in scope**, overriding my
   intra-domain exclusion. Rosalina's table treats "a bare list-page name
   link" as the same underlying gap as the four `mystery-detail` asset links
   (all were bare `font-semibold`-or-nothing), not as out-of-scope
   same-domain navigation. Added `.entity-link` to all six, keeping each
   page's existing weight/size utilities. This brings the total to Rosalina's
   real number: **15** rows, matching her table (her prose said "fourteen",
   her table has 15 — Mario said to follow the table). `search-results.html:22`
   was **not** my own addition as I'd flagged — it's genuinely in her table.
2. **`.back-link` rest color is `--color-text-secondary`**, not
   `--color-text-muted` as I'd chosen. Rosalina made this call deliberately.
   Switched it; hand-checked contrast against `--color-surface` first per
   Mario's instruction to keep muted only if secondary failed: **7.59:1 light**
   (slate-600 on white), **12.02:1 dark** (slate-300 on slate-900) — both
   clear AA, no reason to diverge.

**Caveat for the next reader:** even after this correction, I still do not
have Rosalina's literal original CSS text or the literal text of her 15-row
table — only Mario's relay of the two deltas against what I'd already built.
The CSS below is still my own text (now corrected on the one property she was
explicit about); the table below is my call-site list as corrected, not a
verbatim transcription of hers. If a literal copy of her table/CSS ever
surfaces, it should replace this section rather than be reconciled against it.

## Call sites — `.entity-link` (15)

| File:Line (before edit) | Relationship | Notes |
|---|---|---|
| `dashboard.html:50` | dashboard → mystery | replaced `text-accent font-semibold no-underline` |
| `mysteries-list.html:19` | mysteries list → mystery | kept `text-[1.1rem] font-semibold` |
| `monsters-list.html:19` | monsters list → monster | kept `font-semibold` |
| `minions-list.html:19` | minions list → minion | kept `font-semibold` |
| `minions-list.html:23` | minion → monster | `--inline`; replaced `text-inherit underline` |
| `locations-list.html:19` | locations list → location | kept `font-semibold` |
| `bystanders-list.html:19` | bystanders list → bystander | kept `font-semibold` |
| `hunters-list.html:19` | hunters list → hunter | kept `font-semibold` |
| `minion-detail.html:11` | minion → monster | `--inline`; had no class before |
| `mystery-detail.html:88` | mystery → monster | added `font-semibold` to match list-page weight |
| `mystery-detail.html:108` | mystery → minion | added `font-semibold` |
| `mystery-detail.html:129` | mystery → location | added `font-semibold` |
| `mystery-detail.html:149-151` | mystery → bystander | added `font-semibold`; also collapsed the anchor onto one line (whitespace nit) |
| `monster-detail.html:31` | monster → minion (nested route) | added alongside existing `font-semibold` |
| `search-results.html:22` | search (any domain) → that domain's detail | confirmed in Rosalina's table |

## Call sites — `.back-link` (10)

6 detail pages (`bystander-detail.html`, `location-detail.html`,
`monster-detail.html`, `minion-detail.html`, `mystery-detail.html`,
`hunter-detail.html`) + 4 create pages (`bystander-create.html`,
`location-create.html`, `monster-create.html`, `minion-create.html`).
Confirmed `hunter-create.html` and `mystery-create.html` have no such anchor
— their "← Back" is the wizard-step `<button>`, correctly left alone.

## `.entity-link` / `.entity-link--inline` / `.back-link` — implemented CSS

Lives in `src/web/monster-of-the-week-web/src/styles.css`, `@layer
components`, immediately after `.action-btn` and before `@layer base`:

```css
@layer components {
  .entity-link {
    color: var(--color-accent);
    text-decoration-line: underline;
    text-decoration-color: transparent;
    @apply transition-colors;
  }

  .entity-link:hover,
  .entity-link:focus-visible {
    color: var(--color-accent-hover);
    text-decoration-color: currentColor;
  }

  .entity-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .entity-link--inline {
    text-decoration-color: currentColor;
  }

  .back-link {
    color: var(--color-text-secondary);
    text-decoration-line: underline;
    text-decoration-color: transparent;
    @apply transition-colors;
  }

  .back-link:hover,
  .back-link:focus-visible {
    color: var(--color-accent);
    text-decoration-color: currentColor;
  }

  .back-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .entity-link,
    .back-link {
      transition: none;
    }
  }
}
```

(See `styles.css` itself for the full explanatory comments — color/focus/
layering/no-`:visited`/no-`font-weight` rationale, each attributed to
Rosalina's prose decisions.)

## Verified

`npm run build` succeeds (pre-existing budget warnings on
`wizard-tracker.scss`/`custom-select.component.scss`, unrelated). `npm test`
(Vitest): 73 files / 735 tests, all passing — both before and after this
correction pass.
