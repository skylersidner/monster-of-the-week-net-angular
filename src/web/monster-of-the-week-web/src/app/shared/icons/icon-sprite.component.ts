import { Component } from '@angular/core';

/**
 * Sprite source of truth for every SVG icon in the app (`docs/updates/svg-symbol-icons.md`,
 * "Source of truth" / Phase 0). Renders a single, invisible (`display:none`) `<svg>` containing
 * one `<symbol>` per icon; nothing else in the app references `#icon-*` yet — this component is
 * additive/dead code until Phase 1 starts consuming it via `<app-icon>` (and later phases via
 * `DomainIconComponent`/`MysterySectionIconComponent`).
 *
 * Mounted exactly once, in `layout/page-layout/page-layout.html` (the app shell — the one
 * component guaranteed to render on every route), so every `<use href="#icon-...">` elsewhere in
 * the DOM has something to resolve against before any routed page's icons render.
 *
 * Symbol IDs are namespaced by source, per the plan doc's "Naming convention":
 * - Generic action/chrome icons (the `IconComponent`/`IconName` set consumed via `<app-icon>`):
 *   unprefixed `icon-{kebab-case-name}`.
 * - Domain/nav icons (extracted from `shared/domain-icon.component.ts`'s `@switch`, for that
 *   component's own future internal use — Phase 4, not consumed directly yet): `icon-nav-{key}`,
 *   one per `NavIconKey`.
 * - Mystery-section icons (extracted from `features/mysteries/shared/mystery-section-icon.ts`'s
 *   `@switch`, likewise for that component's own future internal use — Phase 4):
 *   `icon-mystery-{kind}`, one per non-domain `MysterySectionIconKind` (`countdown` plus the 6
 *   countdown-stage kinds). Domain kinds (`mystery`, `monster`, `minions`, `locations`,
 *   `bystanders`) were repointed to reuse the `icon-nav-{key}` symbols above instead, so they have
 *   no `icon-mystery-*` symbol of their own.
 *
 * Every symbol's markup (`viewBox`, `fill`/`stroke` presentation attributes, `<path>`/`<circle>`
 * data) is copied verbatim from the existing inline `<svg>` it replaces, so a `<use>` reference
 * renders pixel-identical to today's inline markup once a later phase switches a call site over.
 */
@Component({
  selector: 'app-icon-sprite',
  standalone: true,
  template: `
    <svg style="display:none" aria-hidden="true">
      <!-- ============================== -->
      <!-- Action / chrome icons (icon-*) -->
      <!-- ============================== -->

      <!-- Delete/trash — from minions-list.html, locations-list.html, bystanders-list.html,
           monsters-list.html, mysteries-list.html, monster-detail.html (x4), minion-detail.html (x4) -->
      <symbol id="icon-trash" viewBox="0 40 32 32" fill="currentColor">
        <path
          d="m 12.914062,42 c -1.381598,0 -2.52539,1.143791 -2.52539,2.525391 V 46 H 4.1171875 c -0.5522847,0 -1,0.447715 -1,1 0,0.552285 0.4477153,1 1,1 h 0.9160156 c 0.652035,6.357819 1.2452954,12.725162 1.859375,19.095703 C 7.0390694,68.615433 8.2408945,70 9.8886719,70 H 21.888672 c 1.64695,0 2.84373,-1.384481 2.99414,-2.900391 C 25.52557,60.724696 26.108614,54.352916 26.791016,48 h 1.091796 c 0.552285,0 1,-0.447715 1,-1 0,-0.552285 -0.447715,-1 -1,-1 h -6.49414 V 44.525391 C 21.388672,43.143791 20.24488,42 18.863281,42 Z m 0,2 h 5.949219 c 0.309346,0 0.525391,0.216051 0.525391,0.525391 V 46 h -7 V 44.525391 C 12.388672,44.216051 12.604717,44 12.914062,44 Z M 7.0410156,48 H 24.783203 C 24.080881,54.566226 23.453671,61.351887 22.89967,66.895477 22.832032,67.58378 22.456762,68 21.888672,68 H 9.8886719 C 9.3204493,68 8.9508971,67.590347 8.8847656,66.904297 8.2777498,60.607037 7.6860333,54.3022 7.0410156,48 Z"
        />
      </symbol>

      <!-- Edit/pencil — from mysteries-list.html -->
      <symbol id="icon-pencil" viewBox="0 0 100 100" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="m76.699 64.445v28.754c0 1.3242-1.0742 2.3984-2.3984 2.3984l-67.496 0.003906c-1.3242 0-2.3984-1.0742-2.3984-2.3984l-0.003906-71.754 0.74219-1.7383 15.09-14.977c0.35547-0.21094 0.77344-0.33594 1.2188-0.33594h52.848c1.3242 0 2.3984 1.0742 2.3984 2.3984v24.02c5.8594-10.145 4.0664-9.707 12.496-4.8281l5.1992 3.0078c1.1602 0.66797 1.5391 2.168 0.87891 3.2695l0.003906 0.003906zm-56.125-24.875v4.8008h39.949v-4.8008zm0 30.113v4.8008h26.867v-4.8008zm0-15.059v4.8008h31.559v-4.8008zm-7.9766-35.574h6.4531v-6.4531zm59.301 20.086v-29.938h-48.047v12.25c0 1.3242-1.0742 2.3984-2.3984 2.3984h-12.25v66.953h62.695v-18.039c-1.0664 1.8477-2.0586 4.2539-3.418 4.7891l-9.1172 3.9414c-1.4609 0.63281-3.1445-0.36719-3.3203-1.9219h-0.007813l-1.1602-10.012c-0.066406-0.56641 0.074219-1.1133 0.35938-1.5586zm-11.473 36.691 5.5625-2.4062 23.949-41.48-6.2695-3.6133-23.941 41.469z"
        />
      </symbol>

      <!-- Close (X) — from page-layout.html's mobile sidebar close button -->
      <symbol id="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 6l12 12M18 6l-12 12" />
      </symbol>

      <!-- Hamburger menu — from page-layout.html's "Open sidebar" button -->
      <symbol id="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </symbol>

      <!-- Plus — from page-layout.html's header "Quick action" button -->
      <symbol id="icon-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 6v12M6 12h12" />
      </symbol>

      <!-- Loading spinner — from page-layout.html's API-unavailable modal retry button -->
      <symbol id="icon-spinner" viewBox="0 0 24 24" fill="none">
        <circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
        <path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </symbol>

      <!-- Search / magnifying glass — from shared/header-search/header-search.html -->
      <symbol id="icon-search" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
          clip-rule="evenodd"
        />
      </symbol>

      <!--
        Brand logo mark — the unified favicon + sidebar mark (see
        .squad/decisions/inbox/luigi-favicon-logo-mark.md). Redrawn (not exported) from
        icon-nav-monsters' horns+trapezoid silhouette below, as a single filled shape instead of
        1.8px strokes, with the mouth line dropped (per Rosalina's design decision — it smudges
        away at favicon sizes). Colors are hardcoded (indigo-600 #4f46e5 chip, white glyph)
        rather than currentColor/theme tokens — this is a fixed brand mark, not a themed icon,
        and is deliberately identical in both light and dark mode. A filled purple crescent
        grin was added after initial ship, per Rosalina's follow-up design call; its color
        (#7e22ce) reuses the existing purple-700 (on-badge-archetype) token value rather than
        introducing a new purple. Path data (viewBox, chip rx, glyph/grin
        coordinates) is kept byte-identical to public/favicon.svg's inline markup so the two
        stay visually in sync; public/favicon.svg can't reference this symbol directly since
        it's loaded by the browser as a standalone file, outside the Angular DOM this sprite
        mounts into.
      -->
      <symbol id="icon-logo" viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#4f46e5" />
        <path d="M7 5 9 8 15 8 17 5 18 8 20 19 4 19 6 8Z" fill="#fff" />
        <path d="M8,14 C9,17.5 15,17.5 16,14 C15,14.5 9,14.5 8,14 Z" fill="#7e22ce" />
      </symbol>

      <!-- ================================================================ -->
      <!-- Domain / nav icons (icon-nav-*), extracted from                  -->
      <!-- shared/domain-icon.component.ts — not yet consumed (Phase 4)     -->
      <!-- ================================================================ -->

      <symbol id="icon-nav-dashboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />
      </symbol>

      <symbol id="icon-nav-data-admin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="18" cy="17" r="2.5" />
      </symbol>

      <symbol id="icon-nav-mysteries" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35M11 8v3l2 1.5" />
      </symbol>

      <symbol id="icon-nav-monsters" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M7 5l2 3h6l2-3M6 8l-2 11h16L18 8M10 13h4" />
      </symbol>

      <symbol id="icon-nav-minions" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="9" r="3" />
        <path d="M3 19c0-2.8 2.2-5 5-5M21 19c0-2.8-2.2-5-5-5M8 19c0-2.8 2.2-5 4-5s4 2.2 4 5" />
      </symbol>

      <symbol id="icon-nav-locations" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </symbol>

      <symbol id="icon-nav-bystanders" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      </symbol>

      <!-- ============================================================================ -->
      <!-- Mystery-section / countdown-stage icons (icon-mystery-*), consumed by         -->
      <!-- features/mysteries/shared/mystery-section-icon.ts for its non-domain kinds    -->
      <!-- (countdown + the 6 countdown-stage kinds). Its domain kinds (mystery,         -->
      <!-- monster, minions, locations, bystanders) were repointed to reuse the          -->
      <!-- icon-nav-* symbols above instead of a separate icon-mystery-* symbol, so       -->
      <!-- icon-mystery-mystery/monster/minions/locations/bystanders no longer exist.    -->
      <!-- ============================================================================ -->

      <symbol
        id="icon-mystery-countdown"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.8V12l3 1.9" />
        <path d="M12 3.5v1.7" />
        <path d="M20.5 12h-1.7" />
        <path d="M5.2 12H3.5" />
        <path d="M12 20.5v-1.7" />
      </symbol>

      <symbol
        id="icon-mystery-day"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 4.5v2" />
        <path d="M12 17.5v2" />
        <path d="M4.5 12h2" />
        <path d="M17.5 12h2" />
        <path d="m6.7 6.7 1.4 1.4" />
        <path d="m15.9 15.9 1.4 1.4" />
        <path d="m17.3 6.7-1.4 1.4" />
        <path d="m8.1 15.9-1.4 1.4" />
      </symbol>

      <symbol
        id="icon-mystery-shadows"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 7.8a4.2 4.2 0 0 1 0 8.4" />
        <path d="M12 4.2v1.8" />
        <path d="M12 18v1.8" />
        <path d="M4.2 12H6" />
        <path d="M18 12h1.8" />
        <path d="m6.7 6.7 1.2 1.2" />
        <path d="m16.1 16.1 1.2 1.2" />
      </symbol>

      <symbol
        id="icon-mystery-sunset"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <path d="M4 15.5h16" />
        <path d="M8 15.5a4 4 0 0 1 8 0" />
        <path d="M12 6.5v2" />
        <path d="m7.2 9.2 1.4 1.1" />
        <path d="m16.8 9.2-1.4 1.1" />
        <path d="M5.5 12h2" />
        <path d="M16.5 12h2" />
      </symbol>

      <symbol
        id="icon-mystery-dusk"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <path d="M4 16h11" />
        <path d="M17.8 7.2 18.4 9l1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
        <path d="M7 16a5 5 0 0 1 10 0" />
      </symbol>

      <symbol
        id="icon-mystery-nightfall"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <path d="M15.8 5.4a6.8 6.8 0 1 0 0 13.2 5.7 5.7 0 1 1 0-13.2z" />
      </symbol>

      <symbol
        id="icon-mystery-midnight"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      >
        <path d="M14.8 5.6a6.2 6.2 0 1 0 0 12 5.3 5.3 0 1 1 0-12z" />
        <path d="m17.6 5.8.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" />
        <path d="m18.3 11.8.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" />
      </symbol>

    </svg>
  `,
})
export class IconSpriteComponent {}
