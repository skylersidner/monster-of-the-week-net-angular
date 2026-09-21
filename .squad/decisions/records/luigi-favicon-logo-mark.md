### 2026-08-23: Favicon + Unified Sidebar Logo Mark — Implementation
**By:** Luigi (Frontend Developer)

**What:** Replaced the stock, never-customized Angular CLI `favicon.ico` placeholder and the translucent "MOTW" text pill (`page-layout.html`, desktop sidebar + mobile drawer) with a single unified brand mark, per Rosalina's approved design: an indigo-600 (`#4f46e5`) rounded-square chip with a solid white monster-head glyph.

- `src/web/monster-of-the-week-web/public/favicon.svg` — new standalone SVG favicon (24x24 viewBox, `<rect rx="6">` chip + `<path>` glyph).
- `src/index.html` — added `<link rel="icon" type="image/svg+xml" href="favicon.svg">` ahead of the existing `favicon.ico` link. `.ico` kept as-is, untouched, as a legacy fallback for browsers/crawlers that don't support SVG favicons — did not attempt to hand-regenerate it.
- `shared/icons/icon-sprite.component.ts` — new `icon-logo` symbol (unprefixed, generic-icon namespace — see naming rationale below), path data kept byte-identical to `favicon.svg`.
- `shared/icons/icon.component.ts` — added `'logo'` to `IconName`. Reused the existing generic `IconComponent` (`<app-icon name="logo" />`) rather than introducing a new component, since the naming convention documented at the top of that file (unprefixed `icon-{name}` symbols consumed via `<app-icon>`) already fits this mark exactly, and `IconComponent`'s template already wraps the `<use>` in an `aria-hidden="true"` `<svg>` — no wrapper markup needed.
- `layout/page-layout/page-layout.html` — both `MOTW` pill `<div>`s (desktop ~line 5, mobile ~line 52) replaced with `<app-icon name="logo" class="self-center h-9 w-9 mt-6" />` (desktop) / `<app-icon name="logo" class="self-center h-8 w-8 mt-3 mb-1" />` (mobile), keeping each location's original margin classes.

**Glyph design (redraw, not export):** Single closed filled path (`M7 5 9 8 15 8 17 5 18 8 20 19 4 19 6 8Z`) built from the *same coordinate language* as `icon-nav-monsters`'s stroke art (`M7 5l2 3h6l2-3M6 8l-2 11h16L18 8M10 13h4`) — same horn-tip and body-corner coordinates — but traced as one continuous silhouette (two horn peaks, valley at the forehead, widening shoulders into a wide trapezoid body) instead of two separate 1.8px stroked subpaths, and with the `M10 13h4` mouth line dropped entirely (per spec — it disappears at favicon sizes). This is a genuine redraw of the existing icon's visual language, not a copy/export of it.

**Colors are hardcoded, not theme tokens:** the chip is fixed `#4f46e5` (matches `--color-accent`'s *light*-mode value in `styles.css`) and the glyph is fixed white, in both `favicon.svg` and the `icon-logo` sprite symbol, regardless of `.dark` class state. This was a deliberate call, confirmed by live Playwright verification against both the light sidebar (`indigo-700`) and a `.dark`-class-injected sidebar (`indigo-900`) — the solid indigo-600 chip reads with sufficient contrast against both, so no dark-mode variant was needed. (`--color-accent` itself *does* flip to `indigo-400` in dark mode, but the brand mark is a fixed asset, not an accent-colored UI element — same treatment already given to the sidebar surface's own fixed indigo-700/900 duality, which doesn't follow the accent token either.)

**Accessibility:** kept `aria-hidden="true"` behavior (now implicit via `IconComponent`'s template, previously explicit on the pill `<div>`) — confirmed non-regressive because every sidebar nav item already carries its own visible text label (`{{ item.label }}`) in both desktop and mobile markup; the logo mark itself conveys no unique information a screen reader user would otherwise miss.

**Tooling constraint that shaped the favicon format decision:** this machine has no SVG rasterizer (no ImageMagick/`magick`, no Inkscape, no `rsvg-convert`/`cairosvg`; the `convert.exe` on `PATH` is Windows' unrelated FAT→NTFS conversion tool). Hand-fabricating a binary `.ico` byte-by-byte was ruled out as too error-prone. Shipped `favicon.svg` as the primary favicon (modern Chrome/Firefox/Edge + Safari 16.4+ all support `<link rel="icon" type="image/svg+xml">`, and since it's vector art it renders crisply at 16x16 with zero raster exports needed) and kept the existing stock `favicon.ico` as a secondary link for legacy fallback only. No new npm dependencies added.

**Bug caught during verification, worth flagging for anyone else hand-writing SVG comments:** my first draft of `favicon.svg`'s explanatory `<!-- -->` comment referenced a CSS custom property name (`--color-accent`) literally inside the comment body. XML/SVG comments cannot contain a `--` sequence anywhere in their content (not just at the boundaries) — this produced a fatal XML parse error, and the browser rendered its "This page contains the following errors" XML-parse-failure page instead of the icon. Caught only by actually loading `favicon.svg` in a real browser engine (Playwright/Chromium), not by `ng build` (which doesn't parse `public/` assets as XML) or by eyeballing the file. Fixed by rewording the comment to avoid literal `--` sequences. Any future SVG (or XML) file with hand-written comments referencing CSS custom properties, `--`-prefixed flags, or em-dash-adjacent double-hyphens should be checked the same way — build success is not sufficient verification for static SVG assets.

**Verification:** `npm run build` clean (same 2 pre-existing unrelated component-style budget warnings). `npm run test -- --watch=false`: 38 files / 278 tests, all green, no regressions (no spec referenced the old "MOTW" text). Live-verified via `ng serve` + Playwright: desktop sidebar chip renders at 36x36 in the correct position; mobile drawer chip renders correctly (routed around the unrelated API-unavailable modal via a mocked `/health/live` response, since no backend was running for this check); `.dark`-class-injected sidebar still renders correctly; `favicon.svg` served with `Content-Type: image/svg+xml` and renders as the intended chip+glyph once the XML-comment bug above was fixed.

**Files:**
- New: `src/web/monster-of-the-week-web/public/favicon.svg`
- Modified: `src/index.html`, `src/app/shared/icons/icon-sprite.component.ts`, `src/app/shared/icons/icon.component.ts`, `src/app/layout/page-layout/page-layout.html`

---

### 2026-08-23 addendum: grin added post-ship

**By:** Luigi (Frontend Developer)

Per Rosalina's follow-up design call, added a grin to the mark: a filled purple crescent
(`<path d="M8,14 C9,17.5 15,17.5 16,14 C15,14.5 9,14.5 8,14 Z" fill="#7e22ce" />`), "empty" (no
teeth). Added as a third element, after the white glyph path, in both `favicon.svg` and the
`icon-logo` symbol in `icon-sprite.component.ts` — kept byte-identical between the two, same
invariant as the original mark. `#7e22ce` is the existing `purple-700` value (`styles.css`'s
`--color-on-badge-archetype` token resolves to it) reused deliberately rather than inventing a
new purple, so the mark now carries three hardcoded colors (indigo-600 chip, white glyph,
purple-700 grin) instead of two.

Both explanatory comments were updated to note the addition and color provenance. Ran into the
exact same XML-comment bug documented above in the original entry: my first draft of the
`favicon.svg` comment referenced the token name with its literal `--` prefix
(`--color-on-badge-archetype`), which is an invalid `--` sequence inside an XML comment and again
produced a fatal parse error, caught only via a live Playwright render of `favicon.svg` (not by
`ng build`). Fixed by rewording to `purple-700 (on-badge-archetype)` with no literal `--`. Applied
the same rewording in the `icon-sprite.component.ts` comment for consistency, even though that one
lives inside a TS template literal (Angular's HTML comment parsing is lenient enough that it
likely wouldn't have broken there) — worth remembering for any future comment mentioning a
CSS-custom-property name in either file.

**Verification:** `npm run build` clean (same 2 pre-existing unrelated budget warnings).
`npm run test -- --watch=false`: 38 files / 278 tests, all green. Live-verified via `ng serve` +
Playwright: grin renders correctly as a smiling purple crescent when the icon is scaled up (300px
render), sidebar/drawer renders at native size (36x36 desktop, 32x32 mobile) show no
misalignment or clipping, `.dark`-class-injected sidebar unaffected (grin color is hardcoded, not
themed), and the fixed `favicon.svg` re-parses and renders correctly standalone.

---

### 2026-08-23 addendum: `favicon.ico` was still winning in Chrome — SVG-first link order does NOT work around it

**By:** Luigi (Frontend Developer)

**Bug:** Skyler tested locally post-ship and the browser tab was still requesting/showing
`favicon.ico` (the stale, never-customized Angular CLI default), not the new `favicon.svg` mark —
despite the SVG `<link>` being listed first in `index.html`, which I'd assumed (incorrectly) was
sufficient per typical "first matching link wins" favicon-resolution folklore.

**Root cause (confirmed via web research):** this is a documented Chromium bug/behavior,
[crbug 1162276](https://crbug.com/1162276). When a page declares both an `.ico` and an `.svg`
favicon via `<link rel="icon">`, Chrome prefers the ICO by default **regardless of the order the
links appear in the document**. Document order is not the tiebreaker people assume it is; the
type/format itself is. This has nothing to do with browser caching of the old default — it
reproduced in a fresh, uncached Playwright context every time.

**Fix:** add `sizes="any"` to the `.ico` link (dropping its `type="image/x-icon"`, which is now
redundant/misleading once `sizes` is doing the signaling work) — this tells Chrome the ICO isn't
an ideal fit for the tab's actual favicon size, so it falls back to the SVG instead. Reordered so
the `.ico` link comes first and the `.svg` link (with its `type="image/svg+xml"` preserved) comes
second, matching the pattern used in sources that document this specific workaround:

```html
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
```

**This is the correct, load-bearing markup — do not "clean it up" back to the more intuitive-looking
symmetric `type="image/svg+xml"` / `type="image/x-icon"` pair from the original entry above.** That
version looks more consistent and is what I shipped originally, but it silently reintroduces this
bug. The asymmetry (`sizes="any"` on the ico link, no `type` on it; `type` present on the svg link,
no `sizes` on it) is intentional and specific to working around crbug 1162276, not an oversight.

**Verification:** Confirmed via a throwaway Playwright script (headed Chromium — headless Chromium
does not fetch favicons at all, since there's no tab-strip UI to render them in, so headless gives
a false negative/empty result either way; had to launch with `headless: false` to observe real
favicon-fetch behavior) against a live `ng serve`, fresh/uncached browser context: only
`GET /favicon.svg` (200, `Content-Type: image/svg+xml`) was ever requested by the browser;
`favicon.ico` was never requested at all post-fix. Script was deleted after use, not committed.
`npm run build` re-verified clean afterward (same 2 pre-existing unrelated budget warnings).

**Files:** Modified: `src/web/monster-of-the-week-web/src/index.html` (lines 8-9 only).

---

### 2026-08-23 addendum: `sizes="any"` workaround still didn't hold — dropped the `.ico` link and its source file entirely

**By:** Luigi (Frontend Developer)

**What happened:** despite the `sizes="any"` fix above, and clearing the last hour of cached images in Chrome, Skyler still saw the stale default `favicon.ico` in the tab. Manually deleting the `<link rel="icon" href="favicon.ico" sizes="any">` line from `index.html` (leaving only the `favicon.svg` link) fixed it immediately. The crbug 1162276 workaround documented in the addendum above is real but apparently not reliably load-bearing in practice — even the source that documented it gave two different `sizes` values (`any` in one place, `48x48` in another) for the supposedly-same fix, which in hindsight was a signal the behavior is finicky/version-dependent rather than a clean, stable rule to build on.

**Fix:** removed the `.ico` `<link>` from `index.html` entirely — the page now declares only `<link rel="icon" href="favicon.svg" type="image/svg+xml">`. This sidesteps the ico-vs-svg precedence question altogether instead of trying to out-guess it. SVG favicons are supported by all current major browsers (Chrome, Firefox, Edge, Safari 16.4+); the only cost is that a browser/crawler with no SVG favicon support and no implicit `/favicon.ico`-probing fallback shows no icon at all, which is a fine degrade.

**Also deleted `public/favicon.ico` (the source file, git-tracked, stock never-customized Angular CLI default) entirely.** Reason: Angular's asset config (`angular.json`, `"glob": "**/*", "input": "public"`) copies every file in `public/` into `dist/` regardless of whether `index.html` references it — so even with the `<link>` removed, the stale ico kept reappearing in every build output. Since nothing in the codebase references `favicon.ico` anymore (confirmed via repo-wide grep), there's no reason to keep shipping it. Verified via a clean rebuild (`rm -rf dist && npm run build`) that `dist/.../browser/` now contains only `favicon.svg`, no `.ico`.

**Do not re-add a `favicon.ico` link or file to "restore legacy fallback"** without a real need — this was tried twice (untouched-default, then `sizes="any"`-patched) and both reintroduced the exact bug this addendum fixes.

**Verification:** `npm run build` clean from a fully deleted `dist/` (same 2 pre-existing unrelated budget warnings). `dist/monster-of-the-week-web/browser/` confirmed to contain only `favicon.svg`, no `favicon.ico`.

**Files:** Modified: `src/web/monster-of-the-week-web/src/index.html`. Deleted: `src/web/monster-of-the-week-web/public/favicon.ico`.
