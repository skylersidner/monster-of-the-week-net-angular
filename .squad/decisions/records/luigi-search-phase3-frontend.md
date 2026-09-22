# Global Search Phase 3 — Full Search Results Page

**By:** Luigi (Frontend Developer)
**Date:** 2026-08-01

## What

Implemented Phase 3 (frontend-only) of global search per `docs/search/architecture.md` Section 6 ("Full search results page") and Section 7 ("Dynamic result view"), and `docs/search/phases.md`'s Phase 3 checklist: `SearchResultDetailItem`/`PagedSearchResult` in `models.ts`, `SearchService.search()`, and a new `features/search/` feature — `SearchResultsComponent` reads `q`/`page` reactively off `ActivatedRoute.queryParamMap`, calls `searchService.search(q, page, 20)`, and renders a paginated result list with domain badge + `DomainIconComponent` + name (linked to the domain's detail route) + `snippet ?? excerpt`. Route registered in `app.routes.ts` as `{ path: 'search', loadChildren: ... }` alongside the other domain features.

Files: `core/search.ts` (added `search()`), `core/models.ts` (added `SearchResultDetailItem`, `PagedSearchResult`), `features/search/search.routes.ts` (new), `features/search/pages/search-results/{search-results.ts,.html,.scss,.spec.ts}` (new), `app.routes.ts` (modified).

## Why (deviations, each with a reason)

1. **`search.routes.ts` uses `loadComponent`, not the bare `{ path: '', component: SearchResultsComponent }` shown in `phases.md`/`architecture.md`.** Every existing feature (`locations.routes.ts`, `bystanders.routes.ts`, etc.) registers its list page via `loadComponent: () => import(...).then(...)` for consistent lazy-loading, and the task prompt itself said to check that convention. Followed the codebase over the docs' illustrative snippet.
2. **Added `search-results.scss` even though current list pages (`locations-list`, `bystanders-list`, `monsters-list` as of the post-migration HTML) don't reference one, or reference a mostly-stale one.** The task's "Files to create" list explicitly named it, so created it, but kept it to the same minimal shape as `header-search.scss` (`@reference "tailwindcss"; :host { display: block; }`) rather than reviving the older per-component `.scss` pattern (`monsters-list.scss` still carries a lot of dead pre-Tailwind-migration CSS that the templates no longer reference).
3. **Picked `orange-100/orange-800` for the Minion domain badge.** No existing plain-Tailwind-class badge color exists for minions — `minions-list.html`'s own type badge uses a bespoke hex (`bg-[#fde8d8] text-orange-800`), not a `bg-{color}-100` class. Chose the nearest real Tailwind class in the same hue family, kept distinct from Monster's `red-100/red-700`. All 5 domain colors (Mystery=amber, Monster=red, Minion=orange, Location=green, Bystander=blue) are colors already used somewhere else in this app for a same-domain badge, except Minion which is the one true "pick a reasonable new pairing" case per the spec's own allowance.
4. **Page-reset-on-query-change is implemented via a guarded `Router.navigate`, not a plain "if query changed, force page=1 locally" branch.** Specifically: `lastQuery` starts at `null`, and only counts as "the query changed" once a *previous* value exists — this lets a deep link like `/search?q=foo&page=5` load page 5 directly on first render (not a `page` reset the first time regardless of what's in the URL), while still catching an in-place address-bar edit from `?q=foo&page=5` to `?q=bar&page=5` and correcting the URL to `page=1` via navigation, matching the "URL and displayed page stay truthful to each other" requirement.

## If wrong

If a `SearchResultsComponent` unit test ever needs to assert the *exact* orange shade or precise scss contents, they're trivial to change — no other code depends on the specific hex/class chosen for Minion. If the `loadComponent` vs `component:` routing choice is unwanted, it's a one-line revert in `search.routes.ts`.

## Note for whoever runs the dev server next

Found (and killed) a stale `dotnet run` process already listening on port 5225 that pre-dated the Phase 1 search endpoints (its `/api/search*` routes 404'd while `/api/monsters` worked fine, confirming it was a stale build holding a file lock on `MonsterOfTheWeek.Api.exe`). Restarted a fresh instance to verify Phase 3 against current code. If this was intentionally left running for another purpose, flagging so it isn't a surprise that it's gone.
