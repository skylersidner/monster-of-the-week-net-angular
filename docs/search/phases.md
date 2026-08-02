# Global Search — Phased Implementation Plan

See `architecture.md` for the full design rationale behind every decision below; this document is the execution breakdown. Style mirrors `docs/phases/phase-8-minions-ui-flow.md`.

**Status: Phases 1–3 shipped and committed.** Phase 4 (below) is fully specced for review; not yet implemented.

## Decisions

Resolved before implementation begins. Rows marked *(revised 2026-08-01)* were updated after project-owner feedback on the tokenization/matching design; rows marked *(new — Phase 4 spec)* were added when Phase 4 was fully specced (same day, after Phases 1–3 shipped). See `open-questions.md` for the full audit trail on both rounds.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Matching primitive (Phase 1)** *(revised 2026-08-01)* | Four-tier in-memory tier matching (not chained SQL `ILIKE` — see #12): substring (weakest) → boundary-prefix → starts-with → exact (strongest). Substring tier applies only to `Name`-style fields (Section 2, `architecture.md`). No `pg_trgm`/`tsvector`, no persisted index table — dataset is small, single-tenant, flat. |
| 2 | **Endpoint shape** | **Option A — two endpoints**: `GET /api/search/quick` (top 4, dropdown) and `GET /api/search` (paginated, results page). See Architectural Decision below. |
| 3 | **Extensibility mechanism** | `ISearchProvider` per domain + code-level `SearchFieldWeight` tags. No `SearchableField` database table. See Architectural Decision below. |
| 4 | **Ranking** *(revised 2026-08-01)* | `score = MatchStrength (1–4) * Weight (Primary=100 entity Name / Secondary=50 sub-resource Name / Tertiary=25 long text)`, combined top-4 across all domains (not 4-per-domain), tiebreak `Name ASC, EntityType ASC, Id ASC`. |
| 5 | **Icon reuse** | Extract the 5 domain SVGs out of `page-layout.html`'s `@switch (item.icon)` into a new shared `DomainIconComponent`; `page-layout.html` itself switches to using it (no new icons drawn). |
| 6 | **Combobox pattern** | ARIA APG combobox-with-listbox (focus stays on `<input>`, `aria-activedescendant` points into a `role="listbox"` popup). Single `highlightedIndex` signal is the only source of truth for both keyboard and mouse highlighting. |
| 7 | **Debounce / min query length** *(revised 2026-08-01)* | 200ms debounce, **3-character** minimum before a request fires (frontend-only gate; backend never rejects by length — confirmed as shipped). |
| 8 | **Results page pagination** | Query params `?q=&page=&pageSize=`, default `pageSize=20`. |
| 9 | **Excerpt field/length** | Fixed per-domain field, independent of which field matched. Truncated to 160 chars at a word boundary + `…`. Mystery's fallback chain extended in Phase 4a — see #13. |
| 10 | **Substring-match scope** | Unanchored substring matching (tier 1) applies only to `Name`-style fields (Primary/Secondary weight) — entity `Name`, and, as of Phase 4b, sub-resource `Name`. Never applied to long free text (Tertiary weight). See `architecture.md` Section 2. |
| 11 | **Dynamic result view / `snippet` contract** | `SearchResultDetailResponse` carries `snippet: string \| null`, always `null` in Phases 1–3. Phase 4a/4b make it real — see #14/#15/#16. |
| 12 | **Phase 1 backend query strategy (in-memory, not SQL `ILIKE`) — confirmed to continue through Phase 4** *(new — Phase 4 spec)* | Providers fetch full tables (Phase 1–3) / nested sub-resource projections (Phase 4b) via plain `.Select()` projections and run tier matching in C#, not `EF.Functions.ILike`. Deliberate Phase 1 call (SQLite test portability — `.squad/decisions/inbox/bowser-search-phase1-backend.md`), confirmed to still hold for Phase 4's larger per-request row counts. Explicit revisit trigger: ~5,000 total rows fetched per search request, or ~150ms p95 server latency observed in practice — see `architecture.md` Section 1. |
| 13 | **Phase 4 field scope** *(new — Phase 4 spec)* | All four Mystery long-text fields (`Concept`, `Hook`, `Overview`, `Notes` — not just `Hook`/`Concept`) become searchable, Tertiary weight, tiers 2–4. `Description` becomes searchable for Monster/Minion/Location/Bystander, same weight/tiers. Monster/Minion `Attack`/`Power`/`Armor`/`Weakness` `Name` (Secondary, all 4 tiers) and `Description` (Tertiary, tiers 2–4) become searchable. `CustomMove` sub-resources excluded (see Known Gaps). Mystery's fixed `excerpt` fallback chain extends to `Hook → Concept → Overview → Notes`. |
| 14 | **Snippet window size** *(new — Phase 4 spec)* | 70 characters on each side of the primary match (`SearchSnippetBuilder`), trimmed to word boundaries, `…` where truncated. Chosen to land in the same visual range as the existing 160-char `excerpt`. See `architecture.md` Section 7. |
| 15 | **Highlight encoding** *(new — Phase 4 spec)* | Backend returns plain-text `snippet` + structured `matchSpans` (offset/length pairs into `snippet`); frontend builds an ordered segment array and renders `<mark>` in the template — no HTML/markup in the API response, no `[innerHTML]`/sanitizer dependency. See `architecture.md` Section 6/7 for the rejected alternative (embedded markup) and why. |
| 16 | **Multi-span highlighting** *(new — Phase 4 spec)* | One anchor position centers the snippet window; every query token occurrence that lands *within* that window is highlighted (not just the anchor token). No multi-window snippets for tokens that match far apart in the same field. See `architecture.md` Section 7 for the full justification. |
| 17 | **Field/sub-resource label** *(new — Phase 4 spec)* | Extends `MatchedField` (dot convention: `"{Kind}.{Field}"` for sub-resources) rather than a parallel enum; adds `MatchedSubResourceName: string \| null` for the sub-resource's own display name. No label chip shown for `Name` matches (redundant with the title). See `architecture.md` Section 3/6. |
| 18 | **Dedup remains single-highest-field-per-entity** *(new — Phase 4 spec, confirmed not changed)* | An entity matching on multiple fields/sub-resources still surfaces once, backed by its single highest-scoring match. No "matched on N fields" UI. See `architecture.md` Section 3. |
| 19 | **Header dropdown unchanged by Phase 4** *(new — Phase 4 spec, confirmed not changed)* | `HeaderSearchComponent`/`header-search.html` are not modified. The new snippet/highlight/label requirement is explicitly scoped to "full-results-page row" in the product owner's own wording. See `architecture.md` Section 6. |

---

## Architectural Decision: Endpoint Shape

### Option A — Two Endpoints (Recommended, shipped)

`GET /api/search/quick?q=` (fixed top-4, no paging) and `GET /api/search?q=&page=&pageSize=` (paginated, includes `totalCount`, includes `excerpt`/`snippet`).

**Pros:** Each contract is fully specified — no optional fields whose presence depends on which query params were sent. Matches the existing pattern of purpose-built controller actions (`GetAll` vs `GetByMystery` in `MonstersController`). Lets quick-search stay cheap (no `totalCount` computation) independent of how the full-search path evolves.

**Cons:** Two controller actions, two service methods, minor duplication in the ranking/merge call.

**Requires:** `SearchController` with two `[HttpGet]` actions; `SearchService` with two public methods (or one internal method with a `takeTop`/`page` parameter feeding both).

### Option B — One Endpoint, Optional Paging Params

`GET /api/search?q=&page=&pageSize=`. Omit `page`/`pageSize` → server defaults to a top-4, no-total-count response; provide them → paginated response with `totalCount` and `excerpt`.

**Pros:** One frontend method, one controller action.

**Cons:** Response shape becomes conditional on which params were passed — the client has to know that "no paging params" implies a materially different payload (no `excerpt`, no `snippet`, no `totalCount`). That's an implicit contract, harder to keep straight in `SearchResultItem` typing on the frontend and easy to regress silently.

**Recommendation:** Option A. Shipped as designed.

---

## Architectural Decision: Extensibility Mechanism

### Option A — Code-Level `ISearchProvider` Registry (Recommended, shipped)

One `ISearchProvider` implementation per domain, each a thin query over its own table (mirrors how `MonsterRepository` already queries `MotwDbContext` directly). Adding a new searchable field is adding a candidate-field entry and a `Weight` tag inside the relevant provider.

**Pros:** No new persisted state, no migration, no write-time sync mechanism to keep correct. Extending search is a code change reviewed and tested like any other, with zero risk of the index drifting from the source tables (there's nothing to drift — it's a live query). **Confirmed by Phase 4**: adding sub-resource and long-text field matching was exactly the "config/mapping change" this was designed to allow — new `CandidateField` entries per provider, no schema change, no new abstraction layer.

**Cons:** Every query re-fetches the live tables (fine at this scale, see `architecture.md` Section 1 and Decision #12's explicit revisit trigger; would need revisiting if row counts moved into the thousands).

**Requires:** `ISearchProvider` interface + 5 implementations, `ISearchService`/`SearchService` fan-out/merge/rank.

### Option B — Persisted `SearchableField`/Index Table

A `search_index(entity_type, entity_id, field, token, weight)` table, populated by triggers or app-level writes whenever a searchable entity is created/updated/deleted, queried directly (with real indexes) instead of the source tables.

**Pros:** Search queries become simpler and would scale further before needing `pg_trgm`/`tsvector`. Adding a field is a data backfill + a schema-level "this field is searchable" declaration, which is closer to literally what the word "SearchableField" suggests.

**Cons:** Introduces a synchronization problem (every write path — 5 entities × create/update/delete, now also 4 sub-resource kinds × create/update/delete as of Phase 4b — must also write to the index, or a background job must reconcile it) for a performance benefit this app doesn't need yet.

**Recommendation:** Option A. Shipped through Phase 1–3, and Phase 4's field/sub-resource expansion confirms it scales as a code-level change without needing Option B. Revisit only alongside a `pg_trgm`/`tsvector` migration (Decision #12's trigger).

---

## Scope

### What is NOT changing in Phase 4

- Domain entities, EF configuration for existing tables — no schema changes to `Mystery`/`Monster`/`Minion`/`Location`/`Bystander` or their sub-resources.
- The two endpoint contracts' shape (`SearchResultItemResponse` for `/quick`, `SearchResultDetailResponse` for the paginated endpoint) — both gain fields, neither is restructured.
- `HeaderSearchComponent`/`header-search.html` (Decision #19) and `DomainIconComponent`.
- The ranking formula, tier model, weight enum values, and dedup behavior (Decision #18).
- `ApiService`, `SearchService`'s existing methods' signatures.

### What IS changing (Phase 4)

- `Services/Search/ISearchProvider.cs`: `SearchMatchCandidate` gains `MatchedSubResourceName`, `Snippet`, `MatchSpans`.
- New `Services/Search/SearchSnippetBuilder.cs`.
- `Services/Search/SearchTokenizer.cs`: gains `CandidateField` + `PickBestMatch`.
- All 5 `*SearchProvider.cs`: extended candidate-field evaluation (long text in 4a, sub-resources in 4b).
- `Contracts/ApiContracts.cs`/`ApiMappers.cs`: `SearchResultDetailResponse` gains `matchedSubResourceName`, `matchSpans`; excerpt fallback chain extended for Mystery.
- `core/models.ts`: `SearchResultDetailItem` gains `matchSpans`, `matchedSubResourceName`; new `SearchMatchSpan` interface.
- `features/search/pages/search-results/*`: renders highlighted snippet segments + field/sub-resource label chip (4c only).

---

## Sub-Phases

### Phase 1 — Backend Search Endpoints (Names Only) + Contract — **Shipped**

**Goal:** Stand up both endpoints, the four-tier ranking model, and the `ISearchProvider` extensibility seam, matching `Name` only.

Implemented as designed, with one documented deviation: in-memory tier matching over fully-fetched columns instead of `EF.Functions.ILike` (SQLite test-portability — `architecture.md` Section 1, `.squad/decisions/inbox/bowser-search-phase1-backend.md`). 41/41 backend tests green.

---

### Phase 2 — Header Search Dropdown UI — **Shipped**

**Goal:** Wire the header search input to `GET /api/search/quick` via a full ARIA combobox.

Implemented as designed (`HeaderSearchComponent`, `DomainIconComponent`, `SearchService.quick()`). Untouched by Phase 4 (Decision #19).

---

### Phase 3 — Full Search Results Page — **Shipped**

**Goal:** `/search?q=` route with paginated results, excerpts, and domain tag badges.

Implemented as designed (`SearchResultsComponent`, `search-results.html`, `SearchService.search()`). `contextText()` already implements `snippet ?? excerpt`; Phase 4c replaces it with segment/highlight-aware rendering.

---

### Phase 4a — Backend: Entity Long-Text Field Matching + Snippet Generation

**Goal:** Extend all 5 providers to match entity-level long-text fields — `Description` (Monster/Minion/Location/Bystander) and `Concept`/`Hook`/`Overview`/`Notes` (Mystery) — and generate real, windowed, highlight-annotated `Snippet`/`MatchSpans` for whichever field wins per entity. No frontend changes.

**Work:**

- New `SearchSnippetBuilder.Build(string fieldText, IReadOnlyList<string> tokens, int matchStrength) -> (string Snippet, IReadOnlyList<SearchMatchSpan> Spans)` — window radius 70 chars, anchor selection (start-of-field for `StartsWith`/`Exact`; earliest token occurrence for `BoundaryPrefix`/`Substring`), word-boundary trimming + ellipsis at both cut edges, span-finding (case-insensitive `IndexOf` per token within the final window) with overlap/adjacency merging. Full algorithm in `architecture.md` Section 7.
- `SearchTokenizer` gains `CandidateField` (`readonly record struct`) and `PickBestMatch(IReadOnlyList<CandidateField> fields, IReadOnlyList<string> tokens, string rawQuery)`, returning the single highest-scoring candidate field (or `null`). `architecture.md` Section 3.
- `SearchMatchCandidate` (`ISearchProvider.cs`) extended: `MatchedSubResourceName: string?`, `Snippet: string?`, `MatchSpans: IReadOnlyList<SearchMatchSpan>` (new `SearchMatchSpan(int Start, int Length)` record).
- `MysterySearchProvider`: candidate fields become `[Name (Primary, substring-allowed), Concept (Tertiary), Hook (Tertiary), Overview (Tertiary), Notes (Tertiary)]` (Tertiary fields: tiers 2–4 only), via `PickBestMatch`; when the winner isn't `Name`, call `SearchSnippetBuilder`.
- `MonsterSearchProvider`/`MinionSearchProvider`/`LocationSearchProvider`/`BystanderSearchProvider`: candidate fields become `[Name (Primary, substring-allowed), Description (Tertiary)]`, same treatment. (Sub-resource fields land in Phase 4b.)
- `ApiMappers.cs`: extend the excerpt fallback chain for Mystery to `Hook → Concept → Overview → Notes` (first non-empty wins); `ToDetailResponse` passes through `MatchedSubResourceName`/`Snippet`/`MatchSpans` (mapped to `SearchMatchSpanResponse`).
- `ApiContracts.cs`: `SearchResultDetailResponse` gains `MatchedSubResourceName: string?`, `MatchSpans: IReadOnlyList<SearchMatchSpanResponse>`; new `SearchMatchSpanResponse(int Start, int Length)`.
- xUnit tests: `SearchSnippetBuilderTests` (window radius, all 4 anchor cases, word-boundary trimming at both edges, ellipsis placement, span merging for overlapping/adjacent occurrences, multi-token spans within one window); `PickBestMatch` tests (entity `Name` match outscores an entity `Description` match on the same query per the weight table; ties broken deterministically); per-provider tests confirming `Description`/`Concept`/`Hook`/`Overview`/`Notes` matches now surface with the correct `MatchedField`, `Weight = Tertiary`, and — critically — that the substring tier never fires against them (a query that only substring-matches a long-text field, e.g. mid-word, must not match at all, only boundary-prefix-or-stronger does).

**Files created:**
- `src/api/MonsterOfTheWeek.Api/Services/Search/SearchSnippetBuilder.cs`
- `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/SearchSnippetBuilderTests.cs`

**Files modified:**
- `src/api/MonsterOfTheWeek.Api/Services/Search/ISearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/SearchTokenizer.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MysterySearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MonsterSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MinionSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/LocationSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/BystanderSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Contracts/ApiContracts.cs`
- `src/api/MonsterOfTheWeek.Api/Contracts/ApiMappers.cs`
- `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/SearchServiceTests.cs` (extended)

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes; `dotnet test MonsterOfTheWeek.slnx` passes including new snippet-builder/candidate-field tests
- `GET /api/search?q=...` for a query matching only a Monster's `Description` (not `Name`) returns that Monster with `matchedField: "Description"`, non-null `snippet` windowed around the match, non-empty `matchSpans`
- Same for a Mystery matching only via `Notes`
- A Mystery with empty `Hook`/`Concept` but a filled `Overview` now shows non-empty `excerpt` (fallback chain)
- A query matching both a Monster's `Name` and `Description` returns `matchedField: "Name"` (higher score wins — confirms `PickBestMatch`)
- Manual: results page (not yet updated — Phase 4c) renders the new `snippet` text as plain, unhighlighted text via the existing `snippet ?? excerpt` logic — no errors, acceptable intermediate deploy state (see Known Gaps)

---

### Phase 4b — Backend: Sub-Resource Field Matching (Monster/Minion Attack/Power/Armor/Weakness)

**Goal:** Extend `MonsterSearchProvider`/`MinionSearchProvider` to evaluate every Attack/Power/Armor/Weakness's `Name` (Secondary, all 4 tiers) and `Description` (Tertiary, tiers 2–4) as additional candidate fields per entity, using the same `PickBestMatch`/`SearchSnippetBuilder` machinery from 4a. Confirms the in-memory query strategy (Decision #12) by switching these two providers' query shape to nested projections.

**Work:**

- `MonsterSearchProvider`/`MinionSearchProvider`: query shape changes to nested `.Select()` projections (`architecture.md` Section 1) fetching `Id`/`Name`/`Description` for each of `Attacks`/`Powers`/`Armors`/`Weaknesses` alongside the entity's own `Id`/`Name`/`Description` — still `AsNoTracking()`, still no `.Include()`/entity materialization, still portable to the SQLite test suite (plain LINQ projections, no `EF.Functions.ILike`).
- Build the full per-entity `CandidateField` list: own `Name` (Primary) + own `Description` (Tertiary) + each sub-resource instance's `Name` (Secondary) + `Description` (Tertiary), across all 4 sub-resource kinds. Call `PickBestMatch`; when the winner is a sub-resource field, set `MatchedField = "{Kind}.{Field}"` (`Kind ∈ {Attack, Power, Armor, Weakness}`) and `MatchedSubResourceName` to that sub-resource instance's own `Name`.
- `CustomMove` sub-resources (`MonsterCustomMove`/`MinionCustomMove`) explicitly **not** added as candidate fields — Decision #13/Known Gaps.
- xUnit tests: a sub-resource `Name` match (Secondary, e.g. score 200 for an exact match) outranks a same-entity `Description` match (Tertiary, max score 100) for the same query; `MatchedSubResourceName` populated correctly for each of the 4 sub-resource kinds × both `Name` and `Description`; a Monster with multiple matching sub-resources (e.g. both an Attack and a Power match) still returns exactly one candidate for that Monster, backed by the higher-scoring sub-resource; a regression test confirming a term that only appears in a `CustomMove`'s text produces no match for that entity (unless another in-scope field also matches).

**Files modified:**
- `src/api/MonsterOfTheWeek.Api/Services/Search/MonsterSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api/Services/Search/MinionSearchProvider.cs`
- `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/SearchServiceTests.cs` (extended)

**Verification:**
- `dotnet build MonsterOfTheWeek.slnx` passes; `dotnet test MonsterOfTheWeek.slnx` passes including new sub-resource matching tests
- `GET /api/search?q=fire` matching only an Attack named "Fire Breath" (Monster's own `Name`/`Description` don't mention "fire") returns that Monster with `matchedField: "Attack.Name"`, `matchedSubResourceName: "Fire Breath"`
- A Monster matching on both an Attack `Name` and a Power `Name` simultaneously still returns exactly one result, backed by the higher-scoring sub-resource
- A term appearing only in a `CustomMove` produces no match for that entity
- Manual sanity check: search response time against the seeded dev dataset remains fast (no formal perf harness needed at this scale — `architecture.md` Section 1's numeric revisit trigger is the threshold that would require one)

---

### Phase 4c — Frontend: Snippet Highlighting + Field/Sub-Resource Label on Results Page

**Goal:** Render the now-real `snippet`/`matchSpans`/`matchedSubResourceName` on the results page: highlighted matched substrings within the snippet, plus a "Matched in: ..." label. `HeaderSearchComponent` is not touched (Decision #19).

**Work:**

- `models.ts`: add `SearchMatchSpan { start: number; length: number }`; extend `SearchResultDetailItem` with `matchSpans: SearchMatchSpan[]`, `matchedSubResourceName: string | null`.
- `search-results.ts`: add `buildSnippetSegments(snippet: string, spans: SearchMatchSpan[]): SnippetSegment[]` (pure function, colocated here since it has one consumer — promote to a shared module only if a second consumer appears later) and `fieldLabel(item): string | null` (`architecture.md` Section 6: `null` for `matchedField === 'Name'`; `"{field}"` for entity-level matches; `"{Kind} — {matchedSubResourceName}"` for sub-resource matches). Replace `contextText()` with `contextSegments(item): SnippetSegment[]` (`buildSnippetSegments(item.snippet, item.matchSpans)` when `item.snippet` is non-null, else `[{ text: item.excerpt, isMatch: false }]`).
- `search-results.html`: render the label chip (only when `fieldLabel(item)` is non-null) above/alongside the existing title; replace the plain `{{ contextText(item) }}` paragraph with an `@for` over `contextSegments(item)`, wrapping `isMatch` segments in `<mark>`.
- Vitest: `buildSnippetSegments` unit tests (single span, multiple non-overlapping spans, span touching string start/end, empty spans array → one all-plain segment); `fieldLabel` unit tests (all three cases above); `search-results.spec.ts` extended to confirm the chip renders/doesn't render per case and `<mark>` wraps the expected substrings for a mocked `PagedSearchResult`.

**Files modified:**
- `src/web/monster-of-the-week-web/src/app/core/models.ts`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.ts`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.html`
- `src/web/monster-of-the-week-web/src/app/features/search/pages/search-results/search-results.spec.ts`

**Verification:**
- `npm run build` passes; `npm run test -- --watch=false` passes including new segment/label specs
- Manual: a query matching only a Monster's Attack shows a "Matched in: Attack — {name}" chip and a highlighted substring inside the snippet
- Manual: a query matching an entity's own `Name` shows no "Matched in" chip and the plain fixed `excerpt`, same as Phase 1–3 behavior
- Manual: a multi-token query with both tokens close together in one field highlights both within the snippet
- Manual: header dropdown is visibly unchanged — name + icon only, no snippet, no chip, no highlight

---

## Files Affected Summary

| File | Status | Phase | Notes |
|------|--------|-------|-------|
| `src/api/.../Services/Search/ISearchProvider.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds `MatchedSubResourceName`, `Snippet`, `MatchSpans`, `SearchMatchSpan` |
| `src/api/.../Services/Search/SearchTokenizer.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds `CandidateField`, `PickBestMatch` |
| `src/api/.../Services/Search/SearchSnippetBuilder.cs` | **New** | 4a | Window/anchor/span-building logic |
| `src/api/.../Services/Search/MysterySearchProvider.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds Concept/Hook/Overview/Notes |
| `src/api/.../Services/Search/MonsterSearchProvider.cs` | **Shipped** / Modified | 1 / 4a / 4b | Phase 4a adds Description; 4b adds sub-resource fields + nested projection |
| `src/api/.../Services/Search/MinionSearchProvider.cs` | **Shipped** / Modified | 1 / 4a / 4b | Same as Monster |
| `src/api/.../Services/Search/LocationSearchProvider.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds Description |
| `src/api/.../Services/Search/BystanderSearchProvider.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds Description |
| `src/api/.../Services/Search/ISearchService.cs` / `SearchService.cs` | **Shipped**, unchanged by Phase 4 | 1 | Dedup/rank logic confirmed correct as-is (Decision #18) |
| `src/api/.../Controllers/SearchController.cs` | **Shipped**, unchanged by Phase 4 | 1 | No route/action changes |
| `src/api/.../Contracts/ApiContracts.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a adds `MatchedSubResourceName`, `MatchSpans`, `SearchMatchSpanResponse` |
| `src/api/.../Contracts/ApiMappers.cs` | **Shipped** / Modified | 1 / 4a | Phase 4a extends Mystery excerpt fallback chain, maps new fields |
| `src/api/.../Program.cs` | **Shipped**, unchanged by Phase 4 | 1 | No new DI registrations needed |
| `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/*` | **Shipped** / Extended | 1 / 4a / 4b | New `SearchSnippetBuilderTests`; extended provider/service tests |
| `src/web/.../core/search.ts` | **Shipped**, unchanged by Phase 4 | 2, 3 | No method signature changes |
| `src/web/.../core/models.ts` | **Shipped** / Modified | 2, 3 / 4c | Phase 4c adds `SearchMatchSpan`, extends `SearchResultDetailItem` |
| `src/web/.../shared/domain-icon.component.ts` | **Shipped**, unchanged by Phase 4 | 2 | — |
| `src/web/.../shared/header-search/*` | **Shipped**, unchanged by Phase 4 | 2 | Confirmed out of scope — Decision #19 |
| `src/web/.../layout/page-layout/*` | **Shipped**, unchanged by Phase 4 | 2 | — |
| `src/web/.../features/search/pages/search-results/*` | **Shipped** / Modified | 3 / 4c | Phase 4c adds segment/label rendering |
| `src/web/.../app.routes.ts` | **Shipped**, unchanged by Phase 4 | 3 | — |

> All `src/api/...` paths expand to `src/api/MonsterOfTheWeek.Api/`. All `src/web/...` paths expand to `src/web/monster-of-the-week-web/src/app/`.

---

## Known Gaps and Deferred Items

| Gap | Notes | Recommended Action |
|-----|-------|--------------------|
| No persisted search index | Every search hits live tables/projections (Section 1, `architecture.md`) | Fine at current scale; explicit revisit trigger now defined — Decision #12 |
| Unanchored substring tier has no indexed fallback | `ILIKE '%token%'`-equivalent in-memory scan cannot be accelerated by a btree index; would need `pg_trgm` if ever DB-side | Fine at current scale |
| No fuzzy/typo tolerance | Tier matching only — a misspelled query returns nothing | Out of scope until/unless `pg_trgm` is adopted |
| No search analytics / "no results" telemetry | Not requested in the product spec | Not planned |
| `CustomMove` sub-resources excluded from Phase 4 | Not requested; consistent with custom moves being an otherwise-incomplete feature elsewhere in this app (`docs/phases/phase-8-minions-ui-flow.md`) | Deliberate exclusion — revisit only if explicitly requested |
| Long-text substring matching still out of scope | Phase 4's long-text fields use tiers 2–4 only, never substring (Decision #10) — noise + snippet-extraction cost against prose | Would need a dedicated `tsvector`/`ts_headline`-backed design, not a scope-widening of the existing tier |
| Phase 4a-only intermediate deploy state | If 4a ships before 4c, real `snippet` text renders as plain unhighlighted text (existing `snippet ?? excerpt` fallback already handles a non-null `snippet` gracefully, just without highlighting) | Acceptable as a strict improvement over Phase 1–3 (real context text, even unhighlighted); not a blocking dependency between 4a and 4c |
| In-memory query strategy scale ceiling | Explicit revisit trigger: ~5,000 rows fetched per search request, or ~150ms p95 latency observed (Decision #12) | Not needed now; move to DB-side `ILIKE`/`pg_trgm` + resolve SQLite-portability via a Postgres-only integration suite or provider test-double if/when triggered |

---

## Verification Checklist

**Phases 1–3 (shipped):**
- [x] `dotnet build MonsterOfTheWeek.slnx` / `dotnet test MonsterOfTheWeek.slnx` pass
- [x] `npm run build` / `npm run test -- --watch=false` pass
- [x] Header combobox and results page behave per `architecture.md` Sections 2/4/6 (ranking, ARIA combobox behavior, pagination)

**Phase 4a:**
- [ ] `dotnet build`/`dotnet test` pass, including `SearchSnippetBuilderTests` and extended provider tests
- [ ] A query matching only a long-text field (Description/Concept/Hook/Overview/Notes) returns that field in `matchedField`, a non-null windowed `snippet`, and non-empty `matchSpans`
- [ ] The substring tier never fires against a long-text field (a mid-word-only match against `Description` returns no result)
- [ ] Mystery excerpt fallback now reaches `Overview`/`Notes` when `Hook`/`Concept` are both empty
- [ ] A query matching both an entity's `Name` and its `Description` reports `matchedField: "Name"` (higher score wins)

**Phase 4b:**
- [ ] `dotnet build`/`dotnet test` pass, including sub-resource matching tests
- [ ] A query matching only a sub-resource `Name`/`Description` returns `matchedField: "{Kind}.{Field}"` and the correct `matchedSubResourceName`, routed to the *parent* Monster/Minion
- [ ] A sub-resource `Name` match (Secondary) outranks a same-entity `Description` match (Tertiary) for a comparable query
- [ ] Multiple matching sub-resources on one entity still produce exactly one result
- [ ] `CustomMove` content never produces a match on its own

**Phase 4c:**
- [ ] `npm run build`/`npm run test -- --watch=false` pass, including segment/label specs
- [ ] Results page shows a "Matched in: ..." chip for every non-`Name` match, with the correct label (bare field name, or `"{Kind} — {sub-resource name}"`)
- [ ] No chip shown for `Name` matches
- [ ] Matched substrings render inside `<mark>` within the snippet; multi-token queries highlight multiple spans when they land within the same window
- [ ] Header dropdown remains unchanged — no snippet, chip, or highlight ever appears there
- [ ] `docker compose up -d postgres && dotnet run` workflow unaffected
