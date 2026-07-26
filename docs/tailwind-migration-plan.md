# Tailwind CSS v4 Migration Plan

**Monster of the Week — Angular Web App**  
**Produced by:** Luigi (Frontend Developer) & Yoshi (Architect) · Squad v0.9.1  
**Requested by:** Skyler Sidner  
**Date:** 2026-07-26

---

## Overview

This document is the end-to-end plan for introducing Tailwind CSS v4 into the Angular 22 web application and replacing the current custom SCSS styling. The migration covers all 19 SCSS files across the app.

**The goal:** Use Tailwind utility classes as the primary styling approach, supplementing with raw CSS only where no utility equivalent exists. Consistency over pixel-perfection. A component migrated to Tailwind should look good and coherent — not necessarily identical to what it replaced.

**The constraint:** The app must remain usable throughout the migration. Temporary layout imprecision between phases is acceptable; broken navigation or unreadable text is not.

**End state:** 17 of 19 SCSS files deleted. The two survivors are `styles.scss` (the Tailwind entry point) and `mystery-create.scss` (a ~20-line remnant for a CSS `subgrid` layout that has no Tailwind equivalent).

---

## Architecture

### Coexistence Strategy

During the transition, Tailwind v4 and the existing SCSS coexist in the same running application. This works cleanly because:

1. **Angular's emulated encapsulation** wraps component styles with attribute selectors (e.g., `[_ngcontent-xxx]`), making them more specific than Tailwind's element-level preflight selectors. Preflight cannot override a component's scoped styles.
2. **Tailwind utilities use `@layer utilities`**, which has lower specificity than explicit SCSS class selectors. Old `.sidebar` rules beat Tailwind utilities on any element that still uses them — no conflicts during migration.
3. **Migration is atomic per component.** When a component is migrated, its SCSS classes are removed from the SCSS file and Tailwind classes are added to the HTML template. There is never a state where both `.sidebar` and `bg-indigo-700` apply to the same element.

The migration strategy is: import full Tailwind (including preflight) from Phase 0, then re-establish global rules via `@layer base`. Unmigrated components continue using their existing SCSS without interference.

### Key Architectural Decisions

#### A. Preflight

Import full Tailwind from Phase 0 including preflight. Do not defer it — splitting the import adds complexity with no benefit given Angular's encapsulation model. Move the existing `styles.scss` body reset inside `@layer base` so our overrides win.

#### B. Color Palette

**The existing color palette is an almost-exact match to Tailwind defaults.** No custom `@theme` color tokens are required. Every hex value in the SCSS maps directly to a Tailwind color class:

| Current hex | Used for | Tailwind class |
|-------------|----------|----------------|
| `#4338ca` | Sidebar background | `bg-indigo-700` |
| `#dbeafe` | Sidebar text/links | `text-blue-100` |
| `#4f46e5` | Active wizard bubble, focus rings | `bg-indigo-600` / `border-indigo-600` |
| `#6366f1` | Input focus border | `border-indigo-500` |
| `#10b981` | Complete state (wizard) | `bg-emerald-500` |
| `#0f172a` | Primary text | `text-slate-950` |
| `#475569` | Secondary text | `text-slate-600` |
| `#64748b` | Muted text | `text-slate-500` |
| `#6b7280` | Icon/placeholder color | `text-gray-500` |
| `#374151` | Body text | `text-gray-700` |
| `#e2e8f0` | Input/card borders | `border-slate-200` |
| `#e5e9f2` | Component borders | `border-slate-200` (imperceptibly close) |
| `#dbe3ef` | Dashboard card borders | `border-slate-200` |
| `#f8fafc` | Shell/page background | `bg-slate-50` |
| `#dc2626` | Error text | `text-red-600` |
| `#b91c1c` | Error hover | `text-red-700` |
| `#1d4ed8` | Primary button | `bg-blue-700` |
| `#1e40af` | Primary button hover | `bg-blue-800` |
| `#1d3557` | Save button | `bg-blue-900` |
| `#dbeafe` | Bystander badge | `bg-blue-100` |
| `#1e40af` | Bystander badge text | `text-blue-800` |
| `#dcfce7` | Location badge | `bg-green-100` |
| `#14532d` | Location badge text | `text-green-900` |
| `#eef2ff` | Weapon tag chip | `bg-indigo-50` |
| `#c7d2fe` | Weapon tag chip border | `border-indigo-200` |
| `#4338ca` | Weapon tag chip text | `text-indigo-700` |
| `#fee2e2` | Monster badge | `bg-red-100` |
| `#b91c1c` | Monster badge text | `text-red-700` |
| `#fde8d8` | Minion badge | `bg-orange-100` |
| `#9a3412` | Minion badge text | `text-orange-800` |
| `rgba(255,255,255,0.2)` | Brand badge bg | `bg-white/20` |
| `rgba(30,64,175,0.4)` | Sidebar hover | `hover:bg-blue-800/40` |
| `rgba(30,64,175,0.65)` | Sidebar active | `bg-blue-800/65` |

One `@theme` override IS recommended — to pin the brand indigo to its exact hex value, since Tailwind v4 generates colors in `oklch()` by default (which renders identically in all modern browsers but shows differently in DevTools):

```css
@theme {
  --color-indigo-700: #4338ca;
}
```

#### C. Breakpoints

The app uses three custom breakpoints. Define them as `@theme` custom breakpoints so you can use readable Tailwind prefixes instead of arbitrary `[@media(...)]` variants:

| SCSS variable | Value | Tailwind prefix (after @theme) |
|---------------|-------|-------------------------------|
| `$bp-sm` | 540px | `sm:` (overrides Tailwind's default 640px) |
| `$bp-form` | 768px | `md:` (exact match — no override needed) |
| `$bp-lg` | 1200px | `xl:` (overrides Tailwind's default 1280px) |

```css
@theme {
  --breakpoint-sm: 540px;
  --breakpoint-xl: 1200px;
}
```

After Phase 0, Tailwind's `max-sm:`, `max-md:`, and `max-xl:` variants replace all `@include bp.below(...)` calls. `_breakpoints.scss` is deleted.

#### D. The `:host` Pattern

Angular's `:host` pseudo-class targets the component's host element and cannot be replaced with template-level Tailwind classes. Components where `:host` is the *only* SCSS content can migrate to Angular's `host` metadata instead:

```typescript
// Before: 3-line SCSS file
// After: no SCSS file at all
@Component({
  host: { class: 'block h-full' },
})
```

This eliminates the SCSS file entirely. Use this approach for `app.scss` (Phase 1) and `page-layout.scss` (Phase 2).

#### E. The Wizard Tracker's `subgrid` Layout

`mystery-create.scss` uses `grid-template-rows: subgrid` on `.tracker-phase`. CSS `subgrid` rows have no Tailwind utility equivalent. This is a permanent, intentional SCSS remnant — not a migration failure.

**Do not try to replace it with an arbitrary Tailwind value.** `[grid-template-rows:subgrid]` as an arbitrary class is fragile and un-scannable. The ~20-line SCSS block is cleaner and more maintainable. It stays forever.

#### F. Patterns That Must Stay in SCSS

The following patterns cannot be expressed as inline Tailwind classes and will remain as SCSS (using `@apply` where possible):

| Pattern | Reason | Affected files |
|---------|--------|----------------|
| `:host { display: block }` | Angular shadow DOM — outside template control | Migrated via `host` metadata; remnant only in files with complex SCSS |
| `--mystery-section-icon-size` CSS custom property | Contextual design token with no Tailwind equivalent | `mystery-create.scss`, `mystery-detail.scss` |
| Tracker `subgrid` layout | `grid-template-rows: subgrid` has no Tailwind utility | `mystery-create.scss` |
| `@keyframes` animations | Custom keyframe animations must be in SCSS | `custom-select.scss` (dropdown-fade), `mystery-create.scss` (fadeSlideIn) |
| Child combinator selectors | e.g. `.search-wrapper input`, `.sidebar-link-icon svg` | `page-layout.scss`, various |
| `.selector.is-open .trigger` compound selectors | `group` modifier alternative requires template restructuring | `custom-select.scss` |
| `:hover:not(:disabled)` | `hover:` in Tailwind applies regardless of disabled state | `monsters-list.scss`, `minion-detail.scss` |
| `:nth-child` table rows with `!important` | `tr:nth-child(even) > td` cannot be driven from parent class | `data-admin.scss`, `weapon-tag-admin.scss` |
| `li:last-child { border-bottom: 0 }` | Pseudo-class on a non-control element | `monster-detail.scss` |

---

## Recurring Patterns

These patterns appear across multiple components. Establish a canonical Tailwind rendering for each and apply it consistently.

### Pattern 1: List Page Header

Used in: mysteries-list, monsters-list, minions-list, bystanders-list, locations-list

```html
<div class="flex items-center justify-between mb-5">
  <h2 class="m-0">Mysteries</h2>
  <a class="bg-blue-700 hover:bg-blue-800 rounded-lg text-white text-sm font-semibold
             px-5 py-2.5 no-underline transition-colors whitespace-nowrap">
    New Mystery
  </a>
</div>
```

### Pattern 2: List Item Card

Used in: all five list pages

```html
<li class="flex items-center bg-white border border-slate-200 rounded-lg gap-4
            justify-between p-4">
  <div class="flex-1 min-w-0">
    <!-- name row, meta -->
  </div>
  <div class="flex items-center flex-shrink-0 gap-1">
    <!-- action buttons -->
  </div>
</li>
```

### Pattern 3: Action Button

Used in: all list pages and detail pages

```html
<!-- base -->
<button class="flex items-center justify-center bg-transparent border-none rounded-md
               text-gray-500 cursor-pointer p-1.5 transition-colors">
  <svg class="h-5 w-5">...</svg>
</button>

<!-- edit variant (add to base) -->
class="hover:bg-violet-100 hover:text-indigo-600"

<!-- delete variant (add to base) -->
class="hover:bg-red-100 hover:text-red-600"
```

Note: The `:hover:not(:disabled)` guard (monsters-list, minion-detail) must remain in SCSS since `hover:` in Tailwind does not respect disabled state.

### Pattern 4: Type Badge

Used in: monsters-list, minions-list, bystanders-list, locations-list

```html
<!-- base -->
<span class="rounded-full text-[0.72rem] font-semibold tracking-[0.02em]
             px-[0.55rem] py-[0.15rem] whitespace-nowrap">

<!-- per-type colors (add one) -->
<!-- monster   --> bg-red-100 text-red-700
<!-- minion    --> bg-orange-100 text-orange-800
<!-- bystander --> bg-blue-100 text-blue-800
<!-- location  --> bg-green-100 text-green-900
```

### Pattern 5: Entity Card

Used in: dashboard, data-admin, detail pages

```html
<div class="bg-white border border-slate-200 rounded-lg p-4">
  <!-- content -->
</div>
```

### Pattern 6: Detail Page Form

Used in: bystander-detail, location-detail, minion-detail, monster-detail

```html
<form class="grid gap-[0.6rem] my-4 max-w-[30rem]">
  <label class="grid font-medium gap-1">
    Field Name
    <input class="border border-[#c9d4e6] rounded-[0.35rem]
                  px-[0.6rem] py-[0.45rem] font-[inherit] w-full">
  </label>
  <button class="bg-blue-900 border-0 rounded-[0.35rem] text-white
                  cursor-pointer px-3 py-[0.45rem] w-fit font-[inherit]">
    Save
  </button>
</form>
```

---

## Phase Plan

### Phase 0 — Infrastructure & Coexistence Baseline

**Goal:** Tailwind v4 is installed. The Vite plugin is active. Utilities are available across the app. Nothing visually breaks.

**Risk:** Medium  
**Files changed:** `package.json`, `angular.json` or `vite.config.ts`, `src/styles.scss`

#### Installation

```bash
npm install tailwindcss @tailwindcss/vite
```

#### Vite Plugin — Path A (preferred)

In `angular.json`, under the `build > options` block:

```json
"options": {
  "plugins": ["@tailwindcss/vite"],
  "browser": "src/main.ts",
  "tsConfig": "tsconfig.app.json",
  ...
}
```

#### Vite Plugin — Path B (fallback if Path A fails)

Create `src/web/monster-of-the-week-web/vite.config.ts`:

```typescript
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss()],
};
```

Angular 22 picks this up automatically. No `angular.json` change needed.

Try Path A first. If the build fails with a plugin resolution error, use Path B.

#### Update `src/styles.scss`

Replace the existing content entirely:

```scss
@import "tailwindcss";

@theme {
  /* Pin brand color to hex for DevTools clarity */
  --color-indigo-700: #4338ca;

  /* Font stack — defines the `font-sans` utility */
  --font-sans: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  /* Custom breakpoints matching the existing SCSS variables */
  --breakpoint-sm: 540px;   /* was $bp-sm — overrides Tailwind default 640px */
  --breakpoint-xl: 1200px;  /* was $bp-lg — overrides Tailwind default 1280px */
  /* --breakpoint-md is already 768px in Tailwind — no override needed */
}

@layer base {
  html,
  body {
    height: 100%;
  }

  body {
    margin: 0;
    overflow: hidden;
    font-family: theme(--font-sans);
  }
}
```

**No PostCSS config is needed.** `@tailwindcss/vite` handles everything internally.

#### Smoke Test

1. Add `class="text-red-500"` to any throwaway element in `app.html`
2. Verify it renders red in the browser
3. Remove the class

#### Inspection Points
- App loads and is visually identical to pre-migration
- Sidebar, header, and nav links are unchanged
- Manually check one list page and one detail page
- `ng build --configuration production` passes without errors
- A Tailwind class applied manually renders correctly

#### Rollback
```bash
npm uninstall tailwindcss @tailwindcss/vite
```
Revert `angular.json` and `styles.scss`. No template files were changed — rollback is under one minute.

---

### Phase 1 — Global Foundations

**Goal:** `app.scss` is eliminated. `styles.scss` is the clean Tailwind entry point. `_breakpoints.scss` is deleted.

**Risk:** Low  
**Files changed:** `src/app/app.scss` (deleted), `src/app/app.ts`, `src/styles/_breakpoints.scss` (deleted)

#### Migrate `app.scss`

`app.scss` is a 3-line file:
```scss
:host { display: block; height: 100%; }
```

Move this to the component decorator:

```typescript
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  // styleUrl: './app.scss',  ← remove this line
  host: { class: 'block h-full' },
})
export class App { ... }
```

Delete `app.scss`.

#### Delete `_breakpoints.scss`

All `@include bp.below(...)` calls are replaced by Tailwind's responsive variants in later phases. Delete `src/styles/_breakpoints.scss` now — it's no longer needed.

Any remaining component files that have `@use 'breakpoints' as bp;` will break on `ng build`. Verify none exist yet (they will be addressed in their respective phases). If any are found, leave `_breakpoints.scss` until those components are migrated.

#### Inspection Points
- `app-root` element in DevTools has `display: block` and fills viewport height
- Shell layout intact — sidebar and content area fill the screen
- `ng build` passes

#### Rollback
Restore `app.scss`, re-add `styleUrl` to the decorator. Two-minute operation.

---

### Phase 2 — Shell Layout

**Goal:** `page-layout.scss` is migrated to Tailwind. The sidebar, navigation, mobile menu, top header, user menu, and content area all use utility classes. The SCSS file is deleted.

**Risk:** High — this wraps every page. A regression here affects the entire app.

**Files changed:** `page-layout.scss` (deleted), `page-layout.html`, `page-layout.ts`

#### Tailwind Class Mapping

**Shell & Sidebar**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.shell` | `flex h-full bg-slate-50` |
| `.sidebar` | `flex flex-col bg-indigo-700 text-blue-100` |
| `.sidebar-desktop` | `hidden xl:flex w-28` |
| `.brand-badge` | `self-center bg-white/20 rounded-full text-white text-xs font-bold tracking-wide mt-6 px-2.5 py-1.5` |
| `.sidebar-nav` | `flex flex-col flex-1 gap-1.5 mt-5 px-2 pb-3` |
| `.sidebar-link` | `flex flex-col items-center rounded-[0.55rem] text-blue-100 no-underline gap-1.5 py-2.5 px-1.5 hover:bg-blue-800/40` |
| `.sidebar-link-active` | `bg-blue-800/65` (applied via `routerLinkActive`) |
| `.sidebar-link-icon` | `inline-flex items-center justify-center h-[1.4rem] w-[1.4rem]` |
| `.sidebar-link-label` | `text-[0.72rem] font-semibold` |

**Note:** `.sidebar-link-icon svg` uses a child combinator (`svg { height: 100%; width: 100%; }`). This must stay in SCSS or the classes must be added directly to each `<svg>` in the template (`class="h-full w-full"`). Adding to the SVG in the template is preferred.

**Mobile Menu**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.mobile-menu-backdrop` | `fixed inset-0 z-20` |
| `.mobile-menu-overlay` | `absolute inset-0 h-full w-full bg-slate-950/40 border-0 cursor-pointer` |
| `.sidebar-mobile` | `relative z-10 max-w-xs pt-3 flex flex-col bg-indigo-700 text-blue-100` |

**Top Header**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.shell-content` | `flex flex-1 flex-col min-w-0` |
| `.top-header` | `flex items-center bg-white border-b border-slate-200 shadow-sm min-h-16 px-4 gap-3` |
| `.menu-open-button` | `inline-flex items-center justify-center bg-transparent border-0 text-slate-500 cursor-pointer h-9 w-9 xl:hidden` |
| `.search-wrapper` | `relative flex items-center text-slate-400 w-full` |
| `.search-icon` | `absolute left-3 pointer-events-none h-4 w-4` |
| `.header-actions` | `flex items-center gap-3` |

The `.search-wrapper input` and `.search-wrapper input:focus` child combinator + pseudo-class rules must remain in SCSS using `@apply`:

```scss
// Remnant in page-layout.scss (if not putting classes directly on the input in the template)
.search-wrapper input {
  @apply border border-slate-200 rounded-[0.55rem] text-slate-950 text-[0.94rem];
  @apply py-[0.58rem] pl-[2.2rem] pr-3 w-full font-[inherit];
}
.search-wrapper input:focus {
  @apply border-indigo-500 ring-2 ring-indigo-500/20 outline-none;
}
```

Alternatively, add the classes and focus classes directly on the `<input>` element in the template (preferred for full cleanup).

**User Menu**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.user-menu` | `relative` |
| `.avatar-button` | `inline-flex items-center justify-center bg-indigo-50 border-0 rounded-full text-blue-900 cursor-pointer font-semibold h-8 w-8` |
| `.user-menu-panel` | `absolute right-0 top-[calc(100%+0.4rem)] z-10 grid bg-white border border-slate-200 rounded-lg shadow-lg p-1 w-40` |
| `.quick-action-button` | `inline-flex items-center justify-center bg-indigo-600 border-0 rounded-full text-white cursor-pointer h-8 w-8 hover:bg-indigo-700` |

`.user-menu-panel a` and `.user-menu-panel a:hover` need SCSS or template classes on each `<a>`:
```html
<a class="block rounded-[0.4rem] text-slate-950 text-[0.87rem] no-underline px-2 py-[0.45rem] hover:bg-indigo-50">
```

**Page Content & Toast**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.page-content` | `flex-1 min-h-0 overflow-auto p-4` |
| `.sr-only` | Use Tailwind's built-in `sr-only` class — delete the SCSS rule |
| `.toast-stack` | `fixed bottom-4 right-4 grid gap-2 w-[min(24rem,calc(100vw-2rem))]` |
| `.toast` | `flex items-center justify-between bg-[#1b6f2a] text-white rounded-lg px-3 py-2.5` |
| `.toast-error` | `bg-red-800` |

**After migration:** Add `host: { class: 'block h-full' }` to `page-layout.ts` and delete `page-layout.scss`.

#### Inspection Points
- Desktop (≥1200px): sidebar visible at `w-28`, content fills remaining space
- Tablet (768px–1199px): sidebar visible, content area fills
- Mobile (<768px): sidebar hidden, hamburger button visible
- Mobile menu opens as overlay with backdrop, close button works
- Active nav link has the indigo highlight
- Top header: border, shadow, search input all render correctly
- Toast notifications appear in bottom-right
- `sr-only` elements remain hidden visually

#### Rollback
`git checkout HEAD -- src/app/layout/page-layout/`

This is the most consequential rollback in the plan. **Consider executing Phase 2 on a feature branch.**

---

### Phase 3 — Shared Components

**Goal:** All three shared components are migrated. Delete confirmation, custom dropdown, and weapon tag selector all use Tailwind.

**Risk:** Medium — `custom-select` is used in the mystery wizard; a regression has wide impact.

**Files changed:** `confirm-delete-modal.component.scss` (deleted), `custom-select.component.scss` (shrinks), `weapon-tag-select.component.scss` (deleted or stub only), plus corresponding HTML/TS files.

#### `confirm-delete-modal` — Full deletion

Every class can move inline. This is the cleanest migration in the codebase.

| SCSS class | Tailwind inline |
|------------|----------------|
| `.modal-backdrop` | `fixed inset-0 z-[1000] flex items-center justify-center bg-black/45` |
| `.modal` | `bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] max-w-[420px] w-[90%] p-8` |
| `.modal-title` | `text-blue-900 text-xl font-bold mb-2 break-words` |
| `.modal-message` | `text-gray-500 text-[0.95rem] mb-3` |
| `.modal-items` | `bg-gray-50 border border-gray-200 rounded-md text-gray-700 text-[0.9rem] list-disc mx-0 mb-3 max-h-[150px] overflow-y-auto py-2 pr-2 pl-7` |
| `.modal-warning` | `text-gray-400 text-sm mb-6` |
| `.modal-actions` | `flex justify-end gap-3` |
| `.modal-btn` | `border-none rounded-md cursor-pointer text-[0.9rem] font-semibold px-5 py-2 transition-colors` |
| `.modal-btn--cancel` | `bg-gray-100 text-gray-700 hover:bg-gray-200` |
| `.modal-btn--delete` | `bg-red-600 text-white hover:bg-red-700` |

Delete `confirm-delete-modal.component.scss` entirely.

#### `weapon-tag-select` — Near-full deletion

| SCSS class | Tailwind inline |
|------------|----------------|
| `.weapon-tag-select` | `flex flex-col gap-[0.35rem]` |
| `.weapon-tag-chips` | `flex flex-wrap gap-[0.35rem]` |
| `.weapon-tag-chip` | `bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs leading-none px-[0.6rem] py-1` |
| `.weapon-tag-label` | `text-inherit text-sm font-medium` |

Keep a minimal stub if `:host { display: block; }` is needed, otherwise add `host: { class: 'block' }` to the component and delete the SCSS file.

#### `custom-select` — Significant shrinkage, cannot be fully deleted

This component has compound state selectors (`.custom-select.is-open .trigger`) and a `@keyframes` animation that must stay in SCSS. The SCSS file shrinks from ~200 lines to ~60-70 lines using `@apply`:

```scss
/* Keepers — everything else moves to template inline classes */

:host { display: block; width: 100%; }

.custom-select__trigger {
  @apply flex items-center justify-between bg-white border border-slate-200;
  @apply rounded-[0.6rem] text-slate-950 cursor-pointer font-[inherit] px-3 py-[0.7rem] w-full;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover { @apply border-slate-300; }
}

.custom-select.is-open .custom-select__trigger {
  @apply border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.18)];
}

.custom-select.is-disabled .custom-select__trigger {
  @apply bg-slate-50 text-slate-500 cursor-not-allowed;
}

.custom-select.is-open .custom-select__caret {
  @apply text-indigo-600 rotate-180;
}

.custom-select__search input {
  @apply bg-slate-50 border border-slate-200 rounded-lg font-[inherit] px-[0.65rem] py-[0.55rem] w-full box-border;

  &:focus {
    @apply border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.16)] outline-none;
  }
}

.custom-select__option {
  @apply flex items-center gap-[0.6rem] bg-transparent border-0 text-slate-950 cursor-pointer px-3 py-[0.7rem] text-left transition-colors;

  &:hover { @apply bg-slate-50; }

  &.is-selected {
    @apply bg-indigo-50 text-indigo-700 font-semibold;
  }
}

@keyframes dropdown-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.custom-select__panel {
  animation: dropdown-fade 180ms ease;
}
```

Everything else (`__label`, `__caret`, `__panel` base, `__options`, `__option-body`, etc.) moves to inline classes in the template.

#### Inspection Points
- Delete confirmation modal opens correctly on Bystanders or Locations pages
- Custom select: trigger renders, dropdown opens/closes, keyboard navigation works, selected value displays
- Weapon tag select: chip pills display, toggle works
- Test both components in the mystery wizard (where they coexist)

---

### Phase 4 — Simple Detail Pages

**Goal:** The three simplest detail pages are migrated, establishing the Detail Form Pattern for Phase 5.

**Risk:** Low  
**Files changed:** `bystander-detail.scss`, `location-detail.scss`, `minion-detail.scss` (all deleted or reduced to stubs)

Migrate `bystander-detail` first, inspect and approve, then apply the same pattern to `location-detail` and `minion-detail`.

#### `bystander-detail` and `location-detail` — Full deletion

These two files are identical — the Detail Page Form Pattern with `.error` and `.mutating`. All classes move inline:

| SCSS class | Tailwind inline |
|------------|----------------|
| `.error` | `text-red-800` |
| `.mutating` | `text-blue-900 font-semibold` |
| `form` (element) | `grid gap-[0.6rem] my-4 max-w-[30rem]` |
| `label` (element) | `grid font-medium gap-1` |
| `input, select, textarea` | `border border-[#c9d4e6] rounded-[0.35rem] px-[0.6rem] py-[0.45rem] font-[inherit] w-full` |
| `button` | `bg-blue-900 border-0 rounded-[0.35rem] text-white cursor-pointer px-3 py-[0.45rem] w-fit font-[inherit]` |

Since these use element selectors in SCSS (`form`, `label`, `input`), the migration involves replacing those with explicit `class=` attributes on each element in the HTML template. This is the preferred long-term approach.

#### `minion-detail` — Shrinks, cannot be fully deleted

`minion-detail` has the same form pattern plus a responsive sub-resource grid and a `@use 'breakpoints'` import. The responsive grid maps cleanly:

```html
<!-- Before: SCSS with @include bp.below($bp-lg) and @include bp.below($bp-sm) -->
<!-- After: Tailwind with custom @theme breakpoints -->
<div class="grid gap-4 grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
```

The name-row responsive grid:
```html
<div class="grid gap-[0.6rem] grid-cols-[2fr_1fr_1fr] max-md:grid-cols-1">
```

Remove `@use 'breakpoints' as bp;` and all `@include bp.below(...)` calls. If `li:last-child { border-bottom: 0 }` appears, keep it as a 2-line SCSS remnant (pseudo-class on non-control elements can't be expressed inline).

#### Inspection Points
- Each detail page loads with all fields visible
- Edit actions work (if inline edit is present)
- Test at 540px viewport for mobile layout correctness
- `ng build` passes

---

### Phase 5 — List Pages

**Goal:** All five list pages are migrated using the List Page Pattern.

**Risk:** Low  
**Files changed:** `mysteries-list.scss`, `monsters-list.scss`, `minions-list.scss`, `bystanders-list.scss`, `locations-list.scss` (all deleted or reduced to minimal stubs)

Migrate `bystanders-list` first (fewest entity relationships). Once it's approved, apply the same pattern to all four remaining list pages — they are structurally identical.

#### `bystanders-list` and `locations-list` — Full deletion

Use List Page Pattern (Patterns 1–4 above). Add `class="h-5 w-5"` directly on each `<svg>` inside action buttons to handle the child combinator. All patterns expressible inline.

#### `mysteries-list` — Full deletion or minimal stub

Same as above. The `.create-btn` is already Pattern 1's "New" button. The `.mystery-info a` child-of-info link gets `class="text-lg font-semibold"` directly on the `<a>`.

#### `monsters-list` and `minions-list` — Minimal stub or full deletion

The `:hover:not(:disabled)` guard on action buttons requires a 4-line SCSS remnant if the disabled state protection is important to keep:

```scss
/* monsters-list.component.scss — intentional remnant */
.action-btn:hover:not(:disabled) {
  @apply bg-gray-100;
}
.action-btn:disabled {
  @apply cursor-not-allowed opacity-40;
}
```

If the disabled hover protection is considered low priority, add `class="h-5 w-5"` to SVGs, delete the SCSS file, and use `disabled:cursor-not-allowed disabled:opacity-40` inline.

#### Inspection Points
- Each list page renders with correct item cards
- "New" button navigates to the create/wizard page (mysteries)
- Empty state message displays when list is empty
- List items link to their detail pages
- List scrolls inside the shell (not the whole page)
- Type badges display with correct color per entity type
- Edit/delete action buttons work; delete opens the confirm modal

---

### Phase 6 — Medium Pages & Admin

**Goal:** Mystery detail, monster detail, data admin, weapon-tag admin, and dashboard are migrated.

**Risk:** Medium — these pages have the most content sections and relationship data.

**Files changed:** `mystery-detail.scss`, `monster-detail.scss`, `data-admin.scss`, `weapon-tag-admin.scss`, `dashboard.scss` (most deleted, some with small remnants)

Migrate in this order: `mystery-detail` → `monster-detail` → `dashboard` → `data-admin` → `weapon-tag-admin`.

#### `mystery-detail` — Minimal remnant (~10 lines)

| SCSS class | Tailwind inline |
|------------|----------------|
| `.mystery-narrative` | `bg-white border border-slate-200 rounded-lg my-4 px-5 py-4` |
| `.heading-with-icon` | `inline-flex items-center gap-[0.45rem]` |
| `.countdown-list` | `bg-white border border-slate-200 rounded-lg list-none m-0 px-4 py-3` |
| `.countdown-stage-entry` | `flex flex-wrap items-center gap-[0.45rem]` |
| `.countdown-stage-label` | `inline-flex items-center gap-[0.35rem]` |
| `.linked-entities` | `grid gap-4 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] mt-4` |
| `.linked-entities article` | `bg-white border border-slate-200 rounded-lg p-3` |
| `.error` | `text-red-800` |

Keep a ~10-line SCSS stub for `--mystery-section-icon-size` CSS custom property on `.heading-with-icon` and `.countdown-stage-label`. The `h3` and `p` elements inside `.mystery-narrative` get explicit `class=` attributes in the template.

#### `monster-detail` — Shrinks significantly

Same as `minion-detail` pattern plus weapon tag chips. The responsive sub-resource grid maps to:
```html
<div class="grid gap-4 grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
```

Keep a remnant for `li:last-child { border-bottom: 0 }` and the `:hover:not(:disabled)` action button guard if needed.

#### `dashboard` — Full deletion (with `animate-pulse` swap)

The skeleton animation in `dashboard.scss` uses a custom `@keyframes pulse`. Tailwind has `animate-pulse` built in — switch to it and the custom keyframes disappear:

```html
<!-- skeleton line -->
<div class="bg-gray-200 rounded-full h-[0.65rem] w-[55%] animate-pulse"></div>
<div class="bg-gray-200 rounded-full h-[0.65rem] w-[85%] animate-pulse mt-[0.65rem]"></div>
```

The rest of the dashboard:

| SCSS class | Tailwind inline |
|------------|----------------|
| `.dashboard` | `text-slate-950 grid gap-4` |
| `.dashboard-header` | `flex items-center justify-between gap-4` |
| `.kpi-grid` | `grid gap-[0.8rem] grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]` |
| `.kpi-card` | `bg-white border border-slate-200 rounded-[0.65rem] p-[0.9rem]` |
| `.dashboard-body` | `grid gap-4 grid-cols-1 lg:grid-cols-[1fr_22rem]` |
| `.recent-card`, `.notes-card` | Entity Card Pattern |
| `.recent-card ul` | `grid gap-2 list-none m-0 p-0` |
| `.recent-card li` | `flex items-center justify-between gap-[0.6rem]` |
| `.recent-card a` | `text-indigo-900 font-semibold no-underline` |
| `.dashboard-error` | `text-red-800` |
| `.kpi-loading` | `min-h-[4.5rem]` |

Note: The dashboard body uses `lg:` (Tailwind's standard 1024px), which is NOT one of the custom breakpoints — use `lg:` as-is.

#### `data-admin` and `weapon-tag-admin` — Small remnant for table striping

Alternating table row colors (`tr:nth-child(odd) > td` with `!important`) cannot be expressed as Tailwind inline classes. Keep a 6-line SCSS remnant:

```scss
/* data-admin.component.scss — intentional remnant */
.records-table tbody tr:nth-child(odd) > td  { background: #fff !important; }
.records-table tbody tr:nth-child(even) > td { background: #dbeafe !important; }
```

Everything else moves inline using Pattern 5 (Entity Card) and Pattern 6 (Detail Form).

#### Inspection Points
- Mystery detail: all sections visible (overview, countdown, linked entities grid)
- Monster detail: stats, weapons, and associated minions render
- Delete actions trigger the confirm-delete modal correctly
- Dashboard KPI cards display in auto-fit grid, recent mysteries list shows
- Weapon tag admin: table shows all tags, add form works, inline edit/delete works
- Data admin type selector, form, and records table all render

---

### Phase 7 — The Wizard (`mystery-create.scss`)

**Goal:** `mystery-create.scss` is migrated to Tailwind as comprehensively as possible. The tracker's `subgrid` layout is intentionally preserved as a ~20-line SCSS remnant. Everything else uses inline Tailwind.

**Risk:** High — this is the primary data entry path for the entire application. Execute in a feature branch.

**Files changed:** `mystery-create.scss` (reduced to ~20 lines), `mystery-create.html`, `mystery-create.ts`

#### Part A — Migrate Everything Outside the Tracker

**Form Panel & Dossier Panel**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.mystery-create.wizard` | `flex flex-col h-full` |
| `.content-area` | `flex flex-1 min-h-0` |
| `.form-panel` | `bg-white border-r border-slate-200 flex flex-col overflow-y-auto p-8 w-[42%]` |
| `.dossier-panel` | `bg-slate-50 flex-1 overflow-y-auto p-8` |
| `.step-label` | `text-slate-500 text-[0.8rem] font-semibold tracking-wide mb-[0.4rem] uppercase` |
| `.step-title` | `text-slate-950 text-[1.4rem] font-bold leading-[1.3] mb-3` |
| `.step-blurb` | `text-slate-500 text-[0.95rem] leading-[1.65] mb-7` |
| `.field` | `mb-4` |
| `.field-error` | `text-red-600 block text-[0.8rem] mt-1` |
| `.required` | `text-red-600` |
| `.btn-add` | `bg-transparent border border-indigo-600 rounded-md text-indigo-600 cursor-pointer font-[inherit] text-sm font-semibold mt-2 px-[0.9rem] py-[0.45rem] hover:bg-indigo-50 transition-colors` |
| `.btn-back` | `bg-transparent border border-slate-300 rounded-lg text-slate-500 cursor-pointer font-[inherit] text-[0.9rem] px-5 py-[0.55rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40` |
| `.btn-next` | `bg-indigo-600 border-0 rounded-lg text-white cursor-pointer font-[inherit] text-[0.9rem] font-semibold px-6 py-[0.55rem] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 transition-colors` |
| `.submit-error` | `bg-red-50 border border-red-200 rounded-md text-red-600 text-sm mb-3 px-3 py-[0.6rem]` |

**Phase Bubbles & Step Dots** — use `@apply` in SCSS (compound state selectors):

```scss
.mystery-create .phase-bubble {
  @apply inline-flex items-center justify-center bg-transparent border-2 border-slate-300;
  @apply rounded-full text-slate-500 cursor-default text-sm font-bold h-9 w-9;
  transition: background 0.2s, border-color 0.2s, color 0.2s;

  &.active  { @apply bg-indigo-600 border-indigo-600 text-white; }
  &.complete { @apply bg-emerald-500 border-emerald-500 text-white cursor-pointer; }
  &:disabled { @apply cursor-not-allowed opacity-50; }
}

.mystery-create .step-dot {
  @apply inline-block bg-slate-200 rounded-full h-[7px] w-[7px] transition-colors;
  &.active   { @apply bg-indigo-600; }
  &.complete { @apply bg-emerald-500; }
}
```

**Dossier Sections** — keep `@keyframes fadeSlideIn` in SCSS; the animation name cannot move inline:

```scss
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Apply on the element: style="animation: fadeSlideIn 0.2s ease" or @apply in SCSS */
```

**`--mystery-section-icon-size`** — replace with explicit sizing on the `<svg>` element in the template using `class="h-[0.95rem] w-[0.95rem]"` etc. The CSS custom property is no longer needed.

**Dossier Row Patterns**

| SCSS class | Tailwind inline |
|------------|----------------|
| `.dossier-section` | `bg-white border border-slate-200 rounded-lg mb-5 p-5` |
| `.dossier-heading` | `border-b border-slate-200 text-indigo-600 text-[0.8rem] font-bold tracking-[0.06em] mb-[0.85rem] pb-2 uppercase` |
| `.added-item-row` | `flex items-center bg-slate-50 border border-slate-200 rounded-md text-[0.9rem] justify-between px-3 py-2` |
| `.empty-hint` | `text-slate-400 text-sm italic` |
| `.remove-btn` | `bg-transparent border-0 text-red-600 cursor-pointer text-[1.1rem] leading-none px-1` |
| `.weapon-tag-chip` (in wizard) | `bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs leading-none px-[0.6rem] py-1` |
| `.heading-with-icon` (in wizard) | `inline-flex items-center gap-[0.45rem]` |

#### Part B — Preserve the Tracker's Subgrid

After migrating Part A, the file retains only this structural skeleton:

```scss
/* mystery-create.component.scss */
/* Intentional SCSS remnant — CSS subgrid has no Tailwind utility equivalent. */
/* All other wizard styles use Tailwind classes in the template. */

app-mystery-create {
  display: block;
  height: 100%;
}

.mystery-create .tracker {
  display: grid;
  grid-template-columns: auto 3rem auto 3rem auto 3rem auto;
  grid-template-rows: auto auto auto;
  justify-content: center;
  justify-items: center;
  row-gap: 0.35rem;
}

.mystery-create .tracker-phase {
  display: grid;
  grid-row: 1 / 4;
  grid-template-rows: subgrid;
  justify-items: center;
}

.mystery-create .tracker-line {
  align-self: center;
  grid-row: 1;
  height: 2px;
  justify-self: stretch;
}
```

The tracker's colors, padding, shadow, and min-height all move to Tailwind. Only the structural subgrid row assignments stay in SCSS.

#### Final Budget Adjustment

After Phase 7, update `angular.json`:

```json
{
  "type": "anyComponentStyle",
  "maximumWarning": "1kB",
  "maximumError": "4kB"
}
```

Any component SCSS file above 1kB after migration is worth investigating.

#### Inspection Points
- Navigate through all wizard phases with the Next button
- Navigate backward using tracker bubble click
- Tracker bubbles: correct active/complete/inactive states at each step
- Tracker lines: correct complete/incomplete color between phases
- Step dots below each bubble reflect sub-step progress
- Form validation errors display in red below fields
- Countdown stage grid renders correctly
- Adding a sub-item (countdown entry, associated monster, etc.) works
- Weapon tag select within the wizard is functional
- Complete a full wizard flow end-to-end and confirm the mystery is created in the app

#### Rollback
`git checkout HEAD -- src/app/features/mysteries/pages/mystery-create/`

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tailwind preflight visually shifts unstyled elements in unmigrated components | High | Low–Medium | Angular emulated encapsulation shields component element styles. `@layer base` re-establishes global rules. |
| `@tailwindcss/vite` incompatible with `@angular/build:application` | Low | High | Verified in Phase 0 before any template changes. Path B fallback (`vite.config.ts`) available. |
| Custom breakpoints not mapped to named Tailwind prefixes | Medium | Low | Defined in `@theme` during Phase 0. |
| `oklch` color divergence from expected hex in DevTools | Low | Low | `--color-indigo-700: #4338ca` override in `@theme`. |
| Specificity conflict between old SCSS and Tailwind on same element | Medium | Medium | Migration rule: never apply both to the same element. Migrate atomically. |
| `grid-template-rows: subgrid` broken in wizard | Low | High | Explicitly documented as a SCSS remnant. Tested as Phase 7 inspection point. |
| Mobile overlay stacking context broken by Tailwind reset | Low | Medium | Phase 2 inspection includes mobile menu open/close verification. |
| `--mystery-section-icon-size` CSS custom property lost | Medium | Low | Replaced with explicit Tailwind sizing utilities on icon elements. Covered in Phase 7 Part A. |
| Shell layout regression (Phase 2) discovered late | Medium | High | Execute Phase 2 in a feature branch. Inspection covers 3+ different pages before merging. |
| `@use 'breakpoints'` import in a file fails after `_breakpoints.scss` deletion | Low | Low | Only delete `_breakpoints.scss` once all remaining `@include bp.below()` calls are confirmed migrated. |
| Component style budget warning during migration | Low | Low | Budget only enforces in production build. Migrate atomically — a component uses either old SCSS or Tailwind, never both simultaneously. |

---

## What Gets Deleted

### Fully Deleted

| File | Phase |
|------|-------|
| `src/styles/_breakpoints.scss` | Phase 1 |
| `src/app/app.scss` | Phase 1 |
| `src/app/layout/page-layout/page-layout.scss` | Phase 2 |
| `src/app/shared/confirm-delete-modal.component.scss` | Phase 3 |
| `src/app/shared/weapon-tag-select.component.scss` | Phase 3 |
| `src/app/features/bystanders/pages/bystander-detail/bystander-detail.scss` | Phase 4 |
| `src/app/features/locations/pages/location-detail/location-detail.scss` | Phase 4 |
| `src/app/features/mysteries/pages/mysteries-list/mysteries-list.scss` | Phase 5 |
| `src/app/features/monsters/pages/monsters-list/monsters-list.scss` | Phase 5 |
| `src/app/features/minions/pages/minions-list/minions-list.scss` | Phase 5 |
| `src/app/features/bystanders/pages/bystanders-list/bystanders-list.scss` | Phase 5 |
| `src/app/features/locations/pages/locations-list/locations-list.scss` | Phase 5 |
| `src/app/features/mysteries/pages/mystery-detail/mystery-detail.scss` | Phase 6 |
| `src/app/pages/dashboard/dashboard.scss` | Phase 6 |

### Shrinks Significantly, Not Deleted

| File | Phase | Remnant Reason |
|------|-------|---------------|
| `src/app/shared/custom-select.component.scss` | Phase 3 | Compound state selectors, `@keyframes dropdown-fade` |
| `src/app/features/minions/pages/minion-detail/minion-detail.scss` | Phase 4 | `li:last-child`, `:hover:not(:disabled)` |
| `src/app/features/monsters/pages/monsters-list/monsters-list.scss` | Phase 5 | `:hover:not(:disabled)` |
| `src/app/features/minions/pages/minions-list/minions-list.scss` | Phase 5 | `.minion-parent a` child combinator |
| `src/app/features/monsters/pages/monster-detail/monster-detail.scss` | Phase 6 | `li:last-child`, `:hover:not(:disabled)` |
| `src/app/pages/data-admin/data-admin.scss` | Phase 6 | Table row striping with `!important` |
| `src/app/pages/data-admin/components/weapon-tag-admin/weapon-tag-admin.scss` | Phase 6 | Table row striping with `!important` |

### Permanent Survivors

| File | Why it stays |
|------|-------------|
| `src/styles.scss` | The Tailwind entry point — becomes the `@import` + `@theme` + `@layer base` host |
| `src/app/features/mysteries/pages/mystery-create/mystery-create.scss` | CSS `subgrid` rows — no Tailwind utility exists. The ~20-line remnant is correct and permanent. |

---

## Angular 22 + Tailwind v4 Notes

**No PostCSS config.** `@tailwindcss/vite` handles everything internally. Do not create `postcss.config.js`.

**`inlineStyleLanguage: "scss"` is unaffected.** This setting remains as-is throughout the migration.

**`stylePreprocessorOptions.includePaths` stays active.** Keep `["src/styles"]` in `angular.json` for any remaining SCSS files. Remove it only if every SCSS file is eventually gone.

**Tailwind utilities are not scoped.** When you add `class="bg-indigo-700"` to a component template, Tailwind's global rule applies to that element regardless of component. This is correct behavior — Tailwind's model is global utilities applied via HTML classes.

**HMR works.** The `@tailwindcss/vite` plugin supports full Hot Module Replacement. Adding a class to a template updates the browser instantly without a page reload.

**Import order in `styles.scss` is mandatory.** `@import "tailwindcss"` must be the first CSS statement. `@theme` and `@layer base` must appear after it.

**Style budget enforcement.** The `anyComponentStyle` budget only runs in production configuration. Development builds are unaffected. Wait until Phase 7 is complete before tightening the budget.

**Recommended per-component workflow:**
1. Keep old SCSS, commit as baseline
2. Open HTML template and SCSS side-by-side
3. For each SCSS class: find elements using it, add Tailwind equivalents, remove old class from both template and SCSS
4. When SCSS is empty (or `:host`-only): migrate `:host` to `host` metadata, delete the file
5. `ng serve` in development, inspect visually
6. Commit atomically: `feat: migrate {component-name} to Tailwind v4`
7. `ng build --configuration production` before moving to next component
