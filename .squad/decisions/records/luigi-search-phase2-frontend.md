# Global Search Phase 2 — Header Search Dropdown UI

**By:** Luigi (Frontend Developer)
**Date:** 2026-08-01

## What

Implemented Phase 2 (frontend-only) of global search per `docs/search/architecture.md` Section 6 and `docs/search/phases.md`'s Phase 2 checklist: `SearchService.quick()`, `SearchResultItem` model, `DomainIconComponent` extracted from `page-layout.html`'s inline SVG icon switch, and `HeaderSearchComponent` — a full WAI-ARIA combobox wired to `GET /api/search/quick`. `page-layout.html`/`.ts` updated to use both new components in place of the disabled search input and the two inline `@switch (item.icon)` blocks.

Files: `core/search.ts` (new), `core/models.ts` (added `SearchResultItem`), `shared/domain-icon.component.ts` (new), `shared/header-search/{header-search.ts,.html,.scss,.spec.ts}` (new), `layout/page-layout/page-layout.{html,ts}` (modified).

## Why (deviations, each with a reason)

1. **`DomainIconComponent` is a single file with an inline template, not a `.ts`+`.html` pair.** The task's own "Files to create" list only names `domain-icon.component.ts` — no companion `.html` — unlike `HeaderSearchComponent`, whose four files (including `.html`) are listed explicitly. Took that omission as intentional and used Angular's inline `template:` string instead of `templateUrl`. If a separate `.html` file is actually wanted for consistency with the rest of `shared/`, it's a trivial follow-up.

2. **`DomainIconComponent.domain` accepts two different naming conventions without requiring callers to normalize.** The nav's existing `NavItem.icon` uses lowercase-plural keys (`monsters`, `mysteries`, ...) with two extra keys the search API never produces (`dashboard`, `data-admin`); the search API's `entityType` uses singular-capitalized (`Monster`, `Mystery`, ...). Rather than force one convention or add per-caller adapter code, `DomainIconComponent` normalizes internally (singular→plural map, case-insensitive) so `page-layout.html` and `header-search.html` each just pass their natural value straight through.

3. **Fixed a real bug found only through manual browser verification, not unit tests**: native `<input type="search">` clears its own value on `Escape` by default. jsdom (vitest's environment) doesn't implement this quirk, so the automated spec for "Escape preserves typed text" passed even before the fix — running the actual dev server against a live API via Playwright caught it. Fixed with `event.preventDefault()` in the `Escape` branch of `HeaderSearchComponent.onKeydown`.

4. **Did not fix a pre-existing, unrelated test-suite breakage** that blocks `npm run test -- --watch=false` for anyone right now: `mystery-create.store.spec.ts`'s mocked `ReferenceDataService` is missing `getAdventureTypes`/`getMonsterArchetypes`, and two `setValue()` calls are missing `adventureTypeId`/`monsterArchetypeId` — stale from earlier adventure-type/monster-archetype UI work that never updated this spec. Also causes cascading failures in `mystery-create.spec.ts` and `mystery-detail.spec.ts` (same root cause), plus two independently-broken specs (`page-layout.spec.ts` referencing pre-Tailwind-migration class selectors like `.sidebar-mobile`/`.api-modal`; `monster-detail.spec.ts`'s "deletes attack when confirmed"). Confirmed via `git stash` that all 10 failures are identical on the pre-Phase-2 commit — none are caused by this work. Verified my own new specs pass cleanly by temporarily removing the one blocking file (Angular's Vitest builder type-checks the whole `tsconfig.spec.json` program before running anything, so `--include`/`--exclude` can't route around a compile error), then restored it unmodified (`git diff` confirms zero change to that file).

## If wrong

If the single-file `DomainIconComponent` or the normalization-inside-the-component approach isn't wanted, splitting into `.ts`+`.html` and/or requiring callers to pass the plural-lowercase form directly is a small, isolated change. The pre-existing test breakage (item 4) needs its own pass — recommend assigning whoever owns the Monster Archetype / Adventure Type UI work, since the fix is in that area's test fixtures, not in anything this task touched.
