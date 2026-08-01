# Global Search — Phased Implementation Plan

See `architecture.md` for the full design rationale behind every decision below; this document is the execution breakdown. Style mirrors `docs/phases/phase-8-minions-ui-flow.md`.

## Decisions

Resolved before implementation begins. Rows marked *(revised 2026-08-01)* were updated after project-owner feedback on the tokenization/matching design — see `open-questions.md` for the full audit trail.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Matching primitive (Phase 1)** *(revised 2026-08-01)* | Four-tier chained `ILIKE` predicates over live columns: substring (weakest) → boundary-prefix → starts-with → exact (strongest). Substring tier applies only to `Name`-style fields (Section 2, `architecture.md`). No `pg_trgm`/`tsvector`, no persisted index table — dataset is small, single-tenant, flat. |
| 2 | **Endpoint shape** | **Option A — two endpoints**: `GET /api/search/quick` (top 4, dropdown) and `GET /api/search` (paginated, results page). See Architectural Decision below. |
| 3 | **Extensibility mechanism** | `ISearchProvider` per domain + code-level `SearchFieldWeight` tags. No `SearchableField` database table. See Architectural Decision below. |
| 4 | **Ranking** *(revised 2026-08-01)* | `score = MatchStrength (1–4) * Weight (Primary=100 entity Name / Secondary=50 sub-resource Name / Tertiary=25 long text)`, combined top-4 across all domains (not 4-per-domain), tiebreak `Name ASC, EntityType ASC, Id ASC`. |
| 5 | **Icon reuse** | Extract the 5 domain SVGs out of `page-layout.html`'s `@switch (item.icon)` into a new shared `DomainIconComponent`; `page-layout.html` itself switches to using it (no new icons drawn). |
| 6 | **Combobox pattern** | ARIA APG combobox-with-listbox (focus stays on `<input>`, `aria-activedescendant` points into a `role="listbox"` popup). Single `highlightedIndex` signal is the only source of truth for both keyboard and mouse highlighting. |
| 7 | **Debounce / min query length** *(revised 2026-08-01)* | 200ms debounce, **3-character** minimum before a request fires (raised from an initially-considered 2 — see Decision #1/#10 and `open-questions.md`). |
| 8 | **Results page pagination** | Query params `?q=&page=&pageSize=`, default `pageSize=20`. |
| 9 | **Excerpt field/length** | Fixed per-domain field (Mystery→Hook, others→Description), independent of which field matched, for Phase 1–3. Truncated to 160 chars at a word boundary + `…`. Superseded by `snippet` once Phase 4 populates it — see Decision #11. |
| 10 | **Substring-match scope** *(new, 2026-08-01)* | Unanchored substring matching (tier 1) applies only to `Name`-style fields (Primary/Secondary weight) — entity `Name` now, sub-resource `Name` in Phase 4+. Never applied to long free text (`Description`/`Hook`/`Concept`/`Overview`, Tertiary weight). See `architecture.md` Section 2. |
| 11 | **Dynamic result view / `snippet` contract** *(new, 2026-08-01)* | `SearchResultDetailResponse` gains a `snippet: string \| null` field in Phase 1, always `null` until Phase 4 populates it from whichever field/sub-resource actually matched. Frontend renders `snippet ?? excerpt` starting in Phase 3. See `architecture.md` Section 7. |

---

## Architectural Decision: Endpoint Shape

### Option A — Two Endpoints (Recommended)

`GET /api/search/quick?q=` (fixed top-4, no paging) and `GET /api/search?q=&page=&pageSize=` (paginated, includes `totalCount`, includes `excerpt`/`snippet`).

**Pros:** Each contract is fully specified — no optional fields whose presence depends on which query params were sent. Matches the existing pattern of purpose-built controller actions (`GetAll` vs `GetByMystery` in `MonstersController`). Lets quick-search stay cheap (no `totalCount` computation) independent of how the full-search path evolves.

**Cons:** Two controller actions, two service methods, minor duplication in the ranking/merge call.

**Requires:** `SearchController` with two `[HttpGet]` actions; `SearchService` with two public methods (or one internal method with a `takeTop`/`page` parameter feeding both).

### Option B — One Endpoint, Optional Paging Params

`GET /api/search?q=&page=&pageSize=`. Omit `page`/`pageSize` → server defaults to a top-4, no-total-count response; provide them → paginated response with `totalCount` and `excerpt`.

**Pros:** One frontend method, one controller action.

**Cons:** Response shape becomes conditional on which params were passed — the client has to know that "no paging params" implies a materially different payload (no `excerpt`, no `snippet`, no `totalCount`). That's an implicit contract, harder to keep straight in `SearchResultItem` typing on the frontend and easy to regress silently.

**Recommendation:** Option A. Flag for Skyler if the extra controller action is unwanted.

---

## Architectural Decision: Extensibility Mechanism

### Option A — Code-Level `ISearchProvider` Registry (Recommended)

One `ISearchProvider` implementation per domain, each a thin query over its own table (mirrors how `MonsterRepository` already queries `MotwDbContext` directly). Adding a new searchable field is adding a `.Where`/`.Select` clause and a `Weight` tag inside the relevant provider.

**Pros:** No new persisted state, no migration, no write-time sync mechanism to keep correct. Extending search is a code change reviewed and tested like any other, with zero risk of the index drifting from the source tables (there's nothing to drift — it's a live query).

**Cons:** Every query re-scans the live tables (fine at this scale, see `architecture.md` Section 1; would need revisiting if row counts moved into the thousands, and unanchored substring — Decision #10 — has no indexed fallback at all, see `architecture.md` Section 1's added caveat).

**Requires:** `ISearchProvider` interface + 5 implementations, `ISearchService`/`SearchService` fan-out/merge/rank.

### Option B — Persisted `SearchableField`/Index Table

A `search_index(entity_type, entity_id, field, token, weight)` table, populated by triggers or app-level writes whenever a searchable entity is created/updated/deleted, queried directly (with real indexes) instead of the source tables.

**Pros:** Search queries become simpler and would scale further before needing `pg_trgm`/`tsvector`. Adding a field is a data backfill + a schema-level "this field is searchable" declaration, which is closer to literally what the word "SearchableField" suggests.

**Cons:** Introduces a synchronization problem (every write path — 5 entities × create/update/delete — must also write to the index, or a background job must reconcile it) for a performance benefit this app doesn't need yet. This is the over-engineering the brief explicitly warns against for Phase 1.

**Recommendation:** Option A now. Option B becomes worth revisiting only alongside (or instead of) the `pg_trgm`/`tsvector` migration discussed in `architecture.md` Section 1 — i.e., if/when this app's dataset stops being "small single-GM homebrew library" sized. Flag for Skyler if a persisted index is wanted sooner for reasons beyond this doc's scope (e.g., anticipated multi-tenant/large-dataset direction).

---

## Scope

### What is NOT changing in Phases 1–3

- Domain entities, EF configuration for existing tables — no schema changes to `Mystery`/`Monster`/`Minion`/`Location`/`Bystander` or their sub-resources.
- Existing list/detail endpoints and Angular list/detail components — search is additive, not a replacement for any existing browse flow.
- Left-nav `<aside>` structure in `page-layout.html` beyond extracting its SVGs into `DomainIconComponent` (visual output unchanged).

### What IS changing

- New `Services/Search/` folder in the API: `ISearchService`/`SearchService`, `ISearchProvider` + 5 implementations, `SearchTokenizer` (tokenization + tier-matching helpers).
- New `SearchController` (`api/search/quick`, `api/search`).
- New `Contracts/ApiContracts.cs` entries: `SearchResultItemResponse`, `SearchResultDetailResponse` (includes `excerpt` and `snippet`), `PagedSearchResultResponse`.
- New Angular `SearchService` (`core/search.ts`), `SearchResultItem`/`SearchResultDetailItem`/`PagedSearchResult` in `models.ts`.
- New shared `DomainIconComponent`.
- `page-layout.html`/`.ts` modified: disabled search input replaced with `<app-header-search />`; nav icon `@switch` replaced with `<app-domain-icon>`.
- New `HeaderSearchComponent` (combobox).
- New `features/search/` (results page) + route registration in `app.routes.ts`.

---

## Sub-Phases

### Phase 1 — Backend Search Endpoints (Names Only) + Contract

**Goal:** Stand up both endpoints, the four-tier ranking model, and the `ISearchProvider` extensibility seam, matching `Name` only. No frontend changes.

**Work:**

- `SearchTokenizer.Tokenize(string query) -> IReadOnlyList<string>`: split on `[\s-]+`, trim, lowercase, drop empties.
- `SearchTokenizer` also hosts the shared tier-matching predicates used by every provider (`BoundaryPrefixMatches`/`SubstringMatches` per `architecture.md` Section 2) and the "weakest tier every token clears" resolution logic, so each provider's query stays a thin `Where`/`Select` rather than re-implementing tier logic five times.
- `ISearchProvider`:
  ```csharp
  public interface ISearchProvider
  {
      string EntityType { get; }
      Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(
          IReadOnlyList<string> tokens, string rawQuery, CancellationToken ct);
  }
  ```
- Five implementations (`MysterySearchProvider`, `MonsterSearchProvider`, `MinionSearchProvider`, `LocationSearchProvider`, `BystanderSearchProvider`), each querying `MotwDbContext` directly for `Name` only, `Weight = SearchFieldWeight.Primary`, computing all four match tiers (substring/boundary-prefix/starts-with/exact) per `architecture.md` Section 2.
- `ISearchService`/`SearchService`: fan out to all `IEnumerable<ISearchProvider>`, dedupe to highest score per entity, sort (`score DESC, Name ASC, EntityType ASC, Id ASC`), expose:
  ```csharp
  Task<IReadOnlyList<SearchMatchCandidate>> QuickSearchAsync(string query, CancellationToken ct); // top 4
  Task<(IReadOnlyList<SearchMatchCandidate> Items, int TotalCount)> SearchAsync(string query, int page, int pageSize, CancellationToken ct);
  ```
- `SearchController`:
  ```csharp
  [HttpGet("api/search/quick")]
  public async Task<ActionResult<IReadOnlyList<SearchResultItemResponse>>> GetQuick([FromQuery] string q, CancellationToken ct)

  [HttpGet("api/search")]
  public async Task<ActionResult<PagedSearchResultResponse>> Get([FromQuery] string q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct)
  ```
  Excerpt population (per-domain fixed field, 160-char truncation) happens in `Get` only — `GetQuick` never fetches/truncates excerpt text. Every item from `Get` also carries `matchedField` (always `"Name"` in Phase 1) and `snippet` (always `null` in Phase 1 — see Decision #11, `architecture.md` Section 7).
- DI registration in `Program.cs`: `AddScoped<ISearchProvider, MysterySearchProvider>()` ×5, `AddScoped<ISearchService, SearchService>()`.
- xUnit tests in `MonsterOfTheWeek.Api.Tests`: tokenizer edge cases (dash split, multi-space, empty), per-provider tier matching (`"sto"` matches `"Stone"`/`"Stony"` at tier 2 and `"Ancestor"` at tier 1 only, and ranks lower for the latter), the "weakest tier every token clears" rule for mixed-tier multi-token queries, multi-token AND semantics, ranking/tiebreak ordering across all four tiers, excerpt truncation at word boundary, and that `snippet` is always `null` / `matchedField` is always `"Name"` in every Phase 1 response.

**Files created:**
- `src/api/MonsterOfTheWeek.Api/Services/Search/ISearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/SearchTokenizer.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MysterySearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MonsterSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MinionSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/LocationSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/BystanderSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/ISearchService.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/SearchService.cs`
- `src/api/MonsterOfTheWeek.Api/Controllers/SearchController.cs`
- `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/SearchTokenizerTests.cs`
- `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/SearchServiceTests.cs`

**Files modified:**
- `src/api/MonsterOfTheWeek.Api/Contracts/ApiContracts.cs` (add `SearchResultItemResponse`, `SearchResultDetailResponse` [with `excerpt` + `snippet`], `PagedSearchResultResponse`)
- `src/api/MonsterOfTheWeek.Api/Program.cs` (DI registration)

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes
- `dotnet test MonsterOfTheWeek.slnx` passes, including new tokenizer/ranking tests
- `GET /api/search/quick?q=sto` returns ≤4 items, combined across domains, correctly ranked
- `GET /api/search?q=sto&page=1&pageSize=20` returns `items`/`page`/`pageSize`/`totalCount` shape, `excerpt` populated and ≤160 chars, `snippet` present and `null`
- Manual: query with a dash-containing token (e.g. matching a hyphenated name's second half) returns expected matches; multi-token query matches records where different tokens hit different words; a query that only substring-matches (e.g. `"sto"` against `"Ancestor"`) ranks below a query that boundary-prefix-matches (e.g. `"sto"` against `"Stone Circle"`)

---

### Phase 2 — Header Search Dropdown UI

**Goal:** Wire the existing (currently disabled) header search input to `GET /api/search/quick` via a full ARIA combobox. No results page yet — Enter-with-no-highlight can route to `/search?q=` even though that route doesn't exist until Phase 3 (acceptable short-lived gap within this plan, or sequence Phase 3 first if preferred — see Known Gaps).

**Work:**

- `SearchResultItem` interface in `models.ts`: `{ entityType, id, name, matchedField }`.
- `SearchService` (`core/search.ts`): `quick(query): Observable<SearchResultItem[]>`.
- `DomainIconComponent` (`shared/domain-icon.component.ts`): extract the 5 `<svg>` blocks from `page-layout.html`'s enabled-nav `@switch (item.icon)` (lines ~14–56) into a component taking `domain` input; render via `<app-domain-icon [domain]="...">`. Update `page-layout.html` to use it in both the desktop `<aside>` and (optionally) the disabled-item fallback switch, so there is exactly one copy of each path's `d` attribute in the codebase.
- `HeaderSearchComponent` (`shared/header-search/header-search.ts/.html/.scss`): combobox per `architecture.md` Section 6 — `Subject<string>` → `debounceTime(200)` → `distinctUntilChanged()` → **min-length-3** filter → `switchMap(searchService.quick)`; signals `query`, `results`, `isOpen`, `highlightedIndex`, `isLoading`; full keyboard/mouse handling as specified.
- `page-layout.html`: replace the `<form role="search">` block (lines ~163–176) with `<app-header-search />`.

**Files created:**
- `src/web/monster-of-the-week-web/src/app/shared/domain-icon.component.ts`
- `src/web/monster-of-the-week-web/src/app/shared/header-search/header-search.ts`
- `src/web/monster-of-the-week-web/src/app/shared/header-search/header-search.html`
- `src/web/monster-of-the-week-web/src/app/shared/header-search/header-search.scss`
- `src/web/monster-of-the-week-web/src/app/shared/header-search/header-search.spec.ts`
- `src/web/monster-of-the-week-web/src/app/core/search.ts`

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/core/models.ts` (add `SearchResultItem`)
- `src/web/monster-of-the-week-web/src/app/layout/page-layout/page-layout.html` (search input → `<app-header-search />`; nav icon switch → `<app-domain-icon>`)
- `src/web/monster-of-the-week-web/src/app/layout/page-layout/page-layout.ts` (import `HeaderSearchComponent`)

**Verification:**
- `npm run build` passes
- `npm run test -- --watch=false` passes, including new `header-search.spec.ts` covering: debounce firing once per pause in typing, **3-character** min-length gate (2-character input does not fire a request), ArrowDown/ArrowUp highlight movement (no wrap), mouse hover syncing `highlightedIndex`, Enter-with-highlight navigates to the highlighted result's route, Enter-without-highlight attempts navigation to `/search?q=`, Escape closes without navigating
- Manual: typing "sto" shows ≤4 combined results with correct domain icons; arrow keys and mouse hover produce the same visual highlight state when used together

---

### Phase 3 — Full Search Results Page

**Goal:** `/search?q=` route with paginated results, excerpts, and domain tag badges.

**Work:**

- `SearchResultDetailItem` interface in `models.ts` (extends `SearchResultItem` with `excerpt: string`, `snippet: string | null`); `PagedSearchResult` = `{ items: SearchResultDetailItem[], page, pageSize, totalCount }` — matches the backend's two-record contract (`SearchResultItemResponse` vs `SearchResultDetailResponse`) rather than one type with optional fields.
- `SearchService.search(query, page, pageSize): Observable<PagedSearchResult>`.
- `features/search/search.routes.ts`: `{ path: '', component: SearchResultsComponent }`.
- `SearchResultsComponent`: reads `q`/`page` from `ActivatedRoute.queryParamMap`; calls `searchService.search`; renders result list (domain badge using the same badge classes as `monsters-list.html`, one background/text color pair per domain + `DomainIconComponent`, name linked to the domain's detail route per the table in `architecture.md` Section 6, and `result.snippet ?? result.excerpt` as the context text — Section 7 — which today always resolves to `excerpt` since `snippet` is always `null`); Prev/Next pagination writing back to the `page` query param via `Router.navigate` with `queryParamsHandling: 'merge'`.
- `app.routes.ts`: register `{ path: 'search', loadChildren: () => import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES) }`.
- `HeaderSearchComponent`'s Enter-with-no-highlight path (built in Phase 2) now resolves to a real route.

**Files created:**
- `src/web/monster-of-the-week-web/src/app/features/search/search.routes.ts`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.ts`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.html`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.scss`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.spec.ts`

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/core/models.ts` (add `SearchResultDetailItem`, `PagedSearchResult`)
- `src/web/monster-of-the-week-web/src/app/core/search.ts` (add `search()` method)
- `src/web/monster-of-the-week-web/src/app/app.routes.ts` (register `search` route)

**Verification:**
- `npm run build` passes
- `npm run test -- --watch=false` passes, including pagination and `snippet ?? excerpt` rendering specs (with `snippet` mocked as both `null` and a non-null string, to prove the fallback branch works even though it's unreachable with real Phase 1–3 data)
- Navigating to `/search?q=sto` renders paginated results with domain badges styled consistently with `monsters-list.html`
- Editing `?q=` directly in the address bar re-runs the search and resets to page 1
- Excerpt text is truncated at ≤160 chars with a trailing `…` when the source field exceeds it
- Each result links to the correct domain detail route

---

### Phase 4+ — Extend Matching to Long Text and Sub-Resource Fields (Future Work, Not Fully Specced)

**Goal:** Broaden what Phase 1's `ISearchProvider`s match, without touching the ranking model, endpoints, or frontend components built in Phases 1–3.

Indicative scope (to be specced in detail when scheduled):
- Add `Description` (Monster/Minion/Location/Bystander) and `Hook`/`Concept` (Mystery) to the relevant providers, tagged `Weight = Tertiary`, tiers 2–4 only (**no substring tier** — Decision #10, `architecture.md` Section 2: unanchored substring on prose is both noisier and harder to present than on a short `Name` field).
- Add sub-resource matching — Monster/Minion `Attack`/`Power`/`Armor`/`Weakness` `Name` and `Description` — `Name` tagged `Weight = Secondary` with **all four tiers** (it's a `Name`-style field), `Description` tagged `Weight = Tertiary` with tiers 2–4 only, same as other long text. `MatchedField` set to e.g. `"MonsterAttack.Name"`, with the surfaced `Name`/route still pointing at the *parent* Monster/Minion (no detail page exists for a sub-resource on its own).
- Populate `snippet` for these new match types per the dynamic-result-view design (`architecture.md` Section 7): sub-resource `Name` matches populate `snippet` cheaply (the sub-resource's own name + description); long-text field matches ideally use a windowed excerpt around the match position — ship this as `tsvector`/`ts_headline`-backed (paired with the re-evaluation below) rather than a naive character-offset stopgap if at all avoidable, and scope it as its own increment rather than assuming it ships automatically alongside the field-matching expansion above.
- Re-evaluate the `ILIKE` matching primitive against `pg_trgm`/`tsvector` once long free-text fields are in scope (see `architecture.md` Section 1) — this is a per-provider internal change, not a contract change. Note: if the title-only substring-matching scope (Decision #10) is ever revisited to include long text, that is specifically the scenario `pg_trgm` exists for — don't extend the plain `ILIKE '%...%'` tier to prose fields without it.
- Re-evaluate the in-memory cross-domain merge (`architecture.md` Section 4) if total match counts start exceeding what's comfortable to pull into app memory per request.

Not broken into sub-phases here deliberately — per the brief, this is flagged as future work rather than fully planned now.

---

## Files Affected Summary

| File | Status | Phase | Notes |
|------|--------|-------|-------|
| `src/api/.../Services/Search/ISearchProvider.cs` | **New** | 1 | Provider abstraction |
| `src/api/.../Services/Search/SearchTokenizer.cs` | **New** | 1 | Tokenization + shared 4-tier matching predicates |
| `src/api/.../Services/Search/*SearchProvider.cs` (×5) | **New** | 1 | One per domain, `Name` only, all 4 tiers |
| `src/api/.../Services/Search/ISearchService.cs` / `SearchService.cs` | **New** | 1 | Fan-out, merge, rank |
| `src/api/.../Controllers/SearchController.cs` | **New** | 1 | `/api/search/quick`, `/api/search` |
| `src/api/.../Contracts/ApiContracts.cs` | Modified | 1 | Add search response records, incl. `snippet` (always null) |
| `src/api/.../Program.cs` | Modified | 1 | DI registration |
| `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/*` | **New** | 1 | Tokenizer + ranking tests |
| `src/web/.../core/search.ts` | **New** | 2 (extended 3) | `SearchService` |
| `src/web/.../core/models.ts` | Modified | 2, 3 | `SearchResultItem`, `SearchResultDetailItem`, `PagedSearchResult` |
| `src/web/.../shared/domain-icon.component.ts` | **New** | 2 | Extracted from `page-layout.html` |
| `src/web/.../shared/header-search/*` | **New** | 2 | Combobox component, min-length 3 |
| `src/web/.../layout/page-layout/page-layout.html` | Modified | 2 | Search input + icon switch replaced |
| `src/web/.../layout/page-layout/page-layout.ts` | Modified | 2 | Import new components |
| `src/web/.../features/search/*` | **New** | 3 | Results page + route; renders `snippet ?? excerpt` |
| `src/web/.../app.routes.ts` | Modified | 3 | Register `search` route |

> All `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`. All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|-----|-------|--------------------|
| Phase 2 ships before Phase 3's route exists | Enter-with-no-highlight navigates to `/search?q=` which 404s (falls through `app.routes.ts`'s `{ path: '**', redirectTo: '' }`) until Phase 3 lands | Acceptable if phases ship close together; otherwise reorder Phase 3 before Phase 2, or stub an empty `/search` route in Phase 2 |
| No persisted search index | Every search hits live tables (Section 1, `architecture.md`) | Fine at current scale; revisit only if row counts or query volume grow materially |
| Unanchored substring tier has no indexed fallback | `ILIKE '%token%'` cannot use a btree index under any collation (`architecture.md` Section 1) | Fine at current scale; if it ever matters, `pg_trgm` is the fix — not a btree/`text_pattern_ops` index like the prefix tiers could use |
| Sub-resource matches have no detail page | Attacks/powers/armors/weaknesses aren't independently routable | Phase 4+ surfaces sub-resource matches via the *parent* entity's route, never a dedicated sub-resource page |
| No fuzzy/typo tolerance | `ILIKE` matching only — a misspelled query returns nothing (substring tier helps with truncation/prefix typos, not transpositions/misspellings) | Out of scope until/unless `pg_trgm` is adopted (Section 1) |
| No search analytics / "no results" telemetry | Not requested in the product spec | Not planned; add if product wants to see what users search for and don't find |
| Excerpt/snippet on results page | Phase 1–3 always falls back to the fixed per-domain `excerpt`; `snippet` exists in the contract from Phase 1 but is always `null` until Phase 4 (Decision #11) | Confirm with Skyler that the always-null Phase 1–3 `snippet` is acceptable — see `open-questions.md` |
| Long-text substring/full-text matching not designed | Deliberately out of scope through Phase 4's initial cut (Decision #10) — plain `ILIKE` substring doesn't scale semantically to prose (noise + snippet extraction needs `ts_headline`-class tooling) | Scope as its own increment using `tsvector`/`ts_headline` if/when wanted, not lumped into the initial Description/Hook field-matching expansion |

---

## Verification Checklist

- [ ] `dotnet build MonsterOfTheWeek.slnx` passes with no warnings
- [ ] `dotnet test MonsterOfTheWeek.slnx` passes, including new `Search` tests (tokenizer, all 4 match tiers, tiebreak, excerpt truncation)
- [ ] `npm run build` passes with no errors
- [ ] `npm run test -- --watch=false` passes (all new vitest specs green)
- [ ] `GET /api/search/quick?q=` (below min length) and `q=` with only whitespace/dashes return `[]`, not an error
- [ ] `GET /api/search/quick?q=sto` returns ≤4 combined results, ranked per `architecture.md` Section 4
- [ ] `GET /api/search?q=sto&page=2&pageSize=20` returns the correct second page and accurate `totalCount`
- [ ] A substring-only match (e.g. `"sto"` vs `"Ancestor"`) ranks below a boundary-prefix match (e.g. `"sto"` vs `"Stone Circle"`) for the same query
- [ ] Every Phase 1–3 result has `matchedField: "Name"` and `snippet: null`
- [ ] Header combobox: 2-character input does not fire a request; 3-character input does
- [ ] Header combobox: ArrowDown/ArrowUp move highlight without wraparound; mouse hover and keyboard stay in sync
- [ ] Header combobox: Enter with a highlighted option navigates to that option's detail route
- [ ] Header combobox: Enter with nothing highlighted navigates to `/search?q=<query>`
- [ ] Header combobox: clicking a result navigates identically to Enter-with-highlight
- [ ] Header combobox: Escape closes the dropdown without navigating and preserves typed text
- [ ] `/search?q=some+like+it+hot` is directly editable/shareable and re-runs the query on load
- [ ] Results page shows domain badges styled consistently with `monsters-list.html`'s existing tag pattern
- [ ] Results page excerpts are truncated at ≤160 chars on a word boundary with a trailing `…`
- [ ] Results page renders `snippet ?? excerpt` (verified via a spec with a mocked non-null `snippet`, even though real Phase 1–3 data never produces one)
- [ ] Each result on both the dropdown and the results page links to the correct domain detail route (note: minions link to the standalone `/minions/:minionId` route per `docs/phases/phase-8-minions-ui-flow.md`)
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
