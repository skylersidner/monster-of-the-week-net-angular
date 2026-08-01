# Global Search — Architecture

Grounding: `MotwDbContext.cs`, `MonsterRepository.cs`, `MonstersController.cs`, `models.ts`, `api.ts`, `monster.ts`, `page-layout.html/.ts`, `monsters-list.html`. See `docs/phases/phase-8-minions-ui-flow.md` for the doc-style precedent this follows.

---

## 1. Backend search strategy

### Recommendation: dedicated `GET /api/search*` endpoints, server-side, plain `ILIKE`-style prefix/substring matching over the live columns. No new index table, no `pg_trgm`/`tsvector` in Phase 1.

**Why not a maintained inverted-index table.** The natural "extensible search" instinct is a denormalized `search_tokens(entity_type, entity_id, field, token, weight)` table kept in sync on write. That buys nothing here: the dataset is flat, single-tenant, and small (five tables, each realistically in the tens-to-low-hundreds of rows for a homebrew MotW library), so a live `ILIKE`/pattern query across all five tables costs sub-millisecond regardless of indexing. An index table would add a write-time sync mechanism (triggers, or app-level double-writes in every repository's Add/Update/Delete path) and a consistency-drift risk, in exchange for a performance win the app doesn't need yet. That's the over-engineering the brief warns against.

**Why not `pg_trgm`/`tsvector` yet.** Both are the right tool once (a) the matched text is long free-form prose (mystery hook/overview, monster description) where users want typo-tolerant or ranked full-text search, or (b) row counts grow into the thousands and a full-table `ILIKE` scan stops being "fast." Phase 1 matches short `Name` fields only — trigram/tsvector machinery is unjustified complexity for that. The design below is chosen so that swapping the matching primitive later (Section 3) is a change inside each `ISearchProvider`, not a change to the API contract, the ranking model, or the frontend.

**What "fast/responsive" means here, concretely:** the live dropdown is driven by a debounced keystroke (Section 6) hitting a query that touches five small tables with a `WHERE` clause EF can translate to indexed-or-scanned `ILIKE`. At current and foreseeable-near-term scale this comfortably clears sub-50ms server time; the perceived latency budget is dominated by the debounce window, not the query.

**What changes if the dataset grows large enough to matter:** add a functional/trigram index (`CREATE INDEX ... USING gin (name gin_trgm_ops)`) or a generated `tsvector` column per searched field, and change the corresponding `ISearchProvider`'s query construction to use `%` (trigram similarity) or `@@ websearch_to_tsquery` instead of chained `ILIKE`. The `SearchableField` registry, the `ISearchProvider` abstraction, the ranking contract (`MatchStrength` + `Weight` → score), and the two `/api/search*` endpoints are all designed to not need to change when that happens. This is the "don't block it later" requirement — see Section 3.

**Added caveat — unanchored substring matching (Section 2) sharpens this calculus.** Prefix `ILIKE 'token%'` can in principle use a btree index (with `text_pattern_ops`) even though none is created in Phase 1. Unanchored substring (`ILIKE '%token%'`) cannot use a btree index under any collation — Postgres has no choice but to scan every row of the column and test each one. This is exactly the access pattern `pg_trgm`'s GIN/GiST trigram indexes exist to accelerate. At Phase 1's scale (Name-only, tens-to-low-hundreds of rows per table) a full scan is still sub-millisecond, so the "no `pg_trgm` yet" conclusion still holds — but unanchored substring is the first tier in this design with no indexed fallback available at all, and is the strongest signal (stronger than plain row-count growth) that it's time to adopt `pg_trgm`. It's also part of why Section 2 scopes unanchored substring matching to `Name`-style fields only, never to long free text — a full scan of a `Name` column is cheap; substring-searching inside every row of a long `Description`/`Hook` column is a materially different cost, on top of the noise/snippet problems discussed in Section 2.

### API surface: two endpoints, not one

- `GET /api/search/quick?q={query}` — fixed top-4 combined results for the header dropdown. No paging metadata.
- `GET /api/search?q={query}&page={n}&pageSize={n}` — paginated full results for the results page. Includes `totalCount`.

These have different response shapes (quick omits `excerpt`/`snippet`/pagination; full includes them) and different perf profiles (quick is capped and latency-sensitive; full always computes `totalCount`). Modeling them as one endpoint with optional query params would blur two different contracts into one under-specified one. This mirrors the existing codebase pattern of purpose-built controller actions with different query shapes over the same data (`GetAll` vs `GetByMystery` in `MonstersController`). See `open-questions.md` for the one-endpoint alternative if you'd rather keep the frontend surface smaller.

---

## 2. Tokenization and matching rule

**Tokenization (query side):** split the raw query string on one-or-more whitespace or dash characters: `Regex.Split(query, @"[\s-]+")`, discard empty tokens, trim, lowercase. `"sto ann"` → `["sto", "ann"]`. `"self-aware"` → `["self", "aware"]`.

**Matching (per query token against a field) — four tiers, weakest to strongest:**

| Tier | Name | Rule | Example (query `"sto"`) |
|---|---|---|---|
| 1 (weakest) | Substring | Token appears anywhere in the field, case-insensitive, at any position — not anchored to a word boundary | `"Ancestor"` (substring is mid-word) |
| 2 | Boundary-prefix | Token appears at the start of the field, or immediately after a space or dash | `"Stone Circle"`, `"Grave-stone"` |
| 3 | Starts-with | The field starts with the full raw (untokenized) query string | `"Stonefall Ridge"` for query `"sto"` |
| 4 (strongest) | Exact | The field case-insensitively equals the full raw query string | field `"Sto"` |

Tier 1 (substring) is a plain `ILIKE '%token%'`. Tier 2 (boundary-prefix) is the original three-`ILIKE`-alternatives design, still translatable inside EF Core without raw SQL/regex:

```csharp
bool BoundaryPrefixMatches(string token) =>
    EF.Functions.ILike(field, token + "%") ||          // start of field
    EF.Functions.ILike(field, "% " + token + "%") ||    // after a space
    EF.Functions.ILike(field, "%-" + token + "%");      // after a dash

bool SubstringMatches(string token) =>
    EF.Functions.ILike(field, "%" + token + "%");
```

**Resolving a field's overall tier for one query (multi-token queries):** every query token must match at *some* tier against the field — same AND-across-tokens rule as before — but different tokens may clear different tiers. The field's overall `MatchStrength` is the **weakest tier that every token clears**: compute `allBoundaryPrefix = tokens.All(BoundaryPrefixMatches)`; if true, the field is at least tier 2 (then separately check tiers 3/4 against the whole field, which can only raise the score further). If `allBoundaryPrefix` is false, fall back to `allSubstring = tokens.All(SubstringMatches)` (tier 1) as the last resort before excluding the record entirely. This is a deliberate simplification: a query where one token hits boundary-prefix and another only hits substring scores the whole field at the weaker tier 1, not some blended per-token average. Precise enough to implement, and keeps the ranking model in Section 4 a single per-field number rather than a per-token vector.

`"sto ann"` matches `"Stone Anne"` at tier 2 (both tokens hit boundary-prefix, on different words) and matches `"Annette's Ancestor"` at tier 1 only (`"ann"` is boundary-prefix on `"Annette"`, but `"sto"` is only a mid-word substring of `"Ancestor"` — the weaker tier wins for the whole field).

**Scope: which fields get the substring tier.** Tier 1 (substring) is computed **only for `Name`-style fields** — the Primary- and Secondary-weighted fields defined in Section 3/4 (the entity's own `Name`, and, once Phase 4 lands, sub-resource `Name` fields like Attack/Power/Armor/Weakness). It is never computed for long free-text fields (`Description`, `Hook`, `Concept`, `Overview` — Tertiary-weighted); those only ever attempt tiers 2–4. Two independent reasons:

- **Noise/volume.** A 3+ character substring shows up inside a large fraction of any real paragraph of prose; on a short `Name` field the same substring is comparatively rare and still a meaningful (if weak) signal. Weight-tiering (Section 4) pushes noisy matches to the bottom of the *ranking*, but it does not stop them from occupying result slots on a paginated results page — a page-3 result whose only "match" is that the word `"an"` appears somewhere in a 200-word description is a worse browsing experience even when it's correctly ranked last.
- **Snippet quality.** A `Name`-field match — even a weak substring one — can be shown as-is; the whole field *is* the context, no further work needed. A substring match buried in the middle of a long `Hook` needs windowed extraction around the match position to be presentable (Postgres `ts_headline` does this well; naive `ILIKE` does not tell you *where* in the string the match occurred). Scoping substring matching to short `Name`-style fields avoids needing that machinery in Phase 1–3, and defers "should long text get substring/full-text matching" to a dedicated Phase 4 decision (Section 7, `phases.md`), where it can be paired with a proper `tsvector`/`ts_headline` design instead of stretching the `ILIKE`-substring tier built for names onto prose.

This scoping isn't an arbitrary extra rule bolted on — it falls directly out of the `SearchFieldWeight` reassignment in Section 3: Primary and Secondary are, by definition in this design, always short curated "name" fields; Tertiary is always long free text. "Substring tier only applies to Primary/Secondary fields" and "substring tier only applies to name-like fields" are the same rule, expressed as a single guard keyed on the field's weight tag rather than a separate per-field flag.

**Case-insensitivity:** unchanged — `ILIKE` is case-insensitive by construction.

**Minimum query length:** raised from an initially-considered 2 characters to **3 characters** for the header dropdown's client-side gate (Section 6). Once the substring tier is live, a 2-character token (e.g. `"an"`) is a near-universal substring of ordinary English words and would match a large fraction of any real `Name` field, producing dropdown noise even though the ranking model still sorts genuine boundary/exact matches above substring ones — three true prefix/boundary matches buried under a wall of visually-unrelated substring hits is a worse first impression than requiring one more keystroke. 3 characters (matching the product spec's own example, `"sto"`) meaningfully cuts that noise while still supporting short-name lookups. This is a single frontend constant (`HeaderSearchComponent`'s min-length filter); the backend does not reject short queries — the full results page URL must keep working if a user manually edits `?q=an` in the address bar.

---

## 3. Extensibility: the `SearchableField` / `ISearchProvider` design

The goal stated in the brief: adding "hook", "concept", "monster description", or sub-resource fields (attack/power/armor/weakness name+description) later should be a **config/mapping change**, not a rearchitecture.

### Shape (illustrative — not implemented in this phase)

```csharp
public enum SearchFieldWeight
{
    Primary = 100,     // entity's own Name (Mystery/Monster/Minion/Location/Bystander.Name)
    Secondary = 50,    // sub-resource Name (Monster/Minion Attack/Power/Armor/Weakness.Name)
    Tertiary = 25       // long free text: entity Description/Hook/Concept/Overview, and sub-resource Description
}

public sealed record SearchMatchCandidate(
    string EntityType,      // "Mystery" | "Monster" | "Minion" | "Location" | "Bystander"
    Guid EntityId,
    string Name,            // the record's display name (always the entity's own Name, even if the match was on a sub-resource or a different field)
    string MatchedField,    // "Name" | "Description" | "Hook" | "MonsterAttack.Name" | ...
    int MatchStrength,      // 1 = substring, 2 = boundary-prefix, 3 = starts-with, 4 = exact
    SearchFieldWeight Weight
);

public interface ISearchProvider
{
    string EntityType { get; }
    Task<IReadOnlyList<SearchMatchCandidate>> SearchAsync(IReadOnlyList<string> tokens, string rawQuery, CancellationToken ct);
}
```

**Why sub-resource `Name` outranks entity long-text fields.** A curated, deliberately-chosen name (an Attack called "Grimtooth") is a stronger relevance signal than an incidental word inside a paragraph, even a paragraph belonging to the primary entity. Tagging sub-resource `Name` as `Secondary` (grouped with `Name`-style fields) rather than `Tertiary` (grouped with prose) reflects that, and — as noted in Section 2 — this is the exact same grouping used to decide which fields get the substring tier: Primary + Secondary are name-like and get all four tiers; Tertiary is prose and only ever gets tiers 2–4.

One `ISearchProvider` per domain (`MysterySearchProvider`, `MonsterSearchProvider`, `MinionSearchProvider`, `LocationSearchProvider`, `BystanderSearchProvider`), each backed by its existing repository/`DbContext` — no new repository abstraction needed, these can query `MotwDbContext` directly the way `MonsterRepository` does today. Phase 1 providers query only `Name` (`Weight = Primary`, all four tiers per Section 2). `SearchService` (new, `Services/Search/SearchService.cs`, registered in DI alongside the other `I*Service` implementations in `Program.cs`) takes `IEnumerable<ISearchProvider>` via constructor injection, fans out, merges, scores, and ranks (Section 4).

**Extending in Phase 4+ is then additive only:**
- Add `Description`/`Hook`/`Concept` matching inside the relevant provider's query, tagged `Weight = Tertiary`, tiers 2–4 only (no substring — Section 2).
- Add sub-resource matching (e.g. `MonsterAttack.Name`) as an additional `.Where`/`.Select` inside `MonsterSearchProvider`, tagged `Weight = Secondary`, all four tiers (it's a `Name`-style field), with `MatchedField = "MonsterAttack.Name"` and `Name` still set to the *parent* monster's name (a matched attack name should surface the monster, not a nonexistent "attack" detail page — there's no route for that).
- Populate `snippet` (Section 5/7) for these new match types.
- Swap the matching primitive (`ILIKE` → trigram/`tsvector`) inside a provider without touching `SearchService`, the ranking model, or the controllers.

No `SearchableField` database table is introduced — the registry is the set of `ISearchProvider` implementations plus the `Weight` tags on their queries, which is a compile-time/code-level mapping, matching the request that this be "a config/mapping change" in the codebase, not persisted state that needs migration/backfill machinery.

---

## 4. Ranking (combined top-4, and full results ordering)

Score per candidate: `score = MatchStrength * (int)Weight`.

`MatchStrength` (Section 2):

| Value | Meaning |
|---|---|
| 4 | Exact — field equals the raw query (case-insensitive) |
| 3 | Starts-with — field starts with the raw (untokenized) query string |
| 2 | Boundary-prefix — token-boundary match (Section 2) |
| 1 | Substring — unanchored substring match, `Name`-style fields only (Section 2) |

`Weight` (Section 3): `Primary = 100` (entity `Name`), `Secondary = 50` (sub-resource `Name`, Phase 4+), `Tertiary = 25` (long text, Phase 4+).

Worked scores, highest to lowest (illustrative — ties are intentional, not a bug, and are broken by the tiebreak below):

| Field / tier | Score |
|---|---|
| Entity `Name` — exact | 400 |
| Entity `Name` — starts-with | 300 |
| Entity `Name` — boundary-prefix | 200 |
| Sub-resource `Name` — exact | 200 |
| Sub-resource `Name` — starts-with | 150 |
| Entity `Name` — substring | 100 |
| Sub-resource `Name` — boundary-prefix | 100 |
| Long-text field — exact (rarely occurs for prose) | 100 |
| Long-text field — starts-with | 75 |
| Sub-resource `Name` — substring | 50 |
| Long-text field — boundary-prefix | 50 |
| Long-text field — substring | *not computed — Section 2* |

Tertiary (prose) fields never reach tier 1, so their lowest attainable score (boundary-prefix × 25 = 50) sits alongside a Secondary substring match (50) — an intentional similarity: an unanchored substring hit on a sub-resource name and the weakest possible hit on prose are treated as comparably weak signals.

A record can match on multiple fields (once Phase 4 lands); `SearchService` keeps only the **highest-scoring** match per entity (an entity should appear once in results, not once per matched field).

**Ordering:** `score DESC`, then `Name ASC` (ordinal, case-insensitive — matches the `OrderBy(x => x.Name)` convention already used in every repository's list query), then `EntityType ASC`, then `Id ASC` as a final deterministic tiebreak. The dropdown takes the top 4 of this ordering across all five providers combined (not 4-per-domain); the full results page paginates the same ordering.

**Why in-memory merge, not a single SQL `UNION ALL`.** Each provider queries its own table independently (Section 3) and returns already-scored candidates; `SearchService` merges and sorts in C#. This is only valid because total result-set sizes are expected to stay small (tens, not thousands) — see Section 1's scaling note. If a query could realistically return thousands of matches, this should move to a `UNION ALL` SQL query with `ORDER BY ... OFFSET ... LIMIT` computed in Postgres instead of pulled into app memory. Not needed now; flagged so it isn't forgotten later.

---

## 5. API contract sketch

```
GET /api/search/quick?q=sto

200 OK
[
  {
    "entityType": "Location",
    "id": "b3f1...",
    "name": "The Stone Circle",
    "matchedField": "Name"
  },
  ...  // up to 4 items total, combined across all domains
]
```

```
GET /api/search?q=sto&page=1&pageSize=20

200 OK
{
  "items": [
    {
      "entityType": "Location",
      "id": "b3f1...",
      "name": "The Stone Circle",
      "matchedField": "Name",
      "excerpt": "An ancient ring of standing stones on the hill above town, said to hum on the night of a full moon...",
      "snippet": null
    },
    ...
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 7
}
```

`excerpt` is populated from a fixed per-domain "excerpt field" (not necessarily the field that was matched — see `open-questions.md`):

| Domain | Excerpt field | Fallback |
|---|---|---|
| Mystery | `Hook` | `Concept` |
| Monster | `Description` | — |
| Minion | `Description` | — |
| Location | `Description` | — |
| Bystander | `Description` | — |

Truncated to **160 characters**, cut at the nearest preceding word boundary, `…` appended if truncated. 160 is chosen to match the common "meta-description" convention (roughly 2 lines of body text at typical card widths, long enough to give a real sense of content, short enough that five results plus pagination don't turn into a wall of text). See `open-questions.md` for the exact number as a confirmable default.

`snippet` is a `string | null` field reserved for Phase 4+ (Section 7): once matching extends beyond `Name`, `snippet` will hold context sourced from *whichever field or sub-resource actually matched* — a matched Attack's name + description, or a windowed excerpt around a matched `Hook` position — while `excerpt` continues to hold the fixed per-domain fallback. In Phase 1–3, `matchedField` is always `"Name"` and `snippet` is always `null`. The field is added to the contract **now**, unpopulated, specifically so Phase 4 doesn't require a breaking response-shape change later — adding a new field to a JSON response is compatible; restructuring `SearchResultDetailResponse` after the frontend has already shipped against it is not free. The frontend fallback logic (Section 6/7) is built once, in Phase 3, not deferred.

`q` on the results-page URL uses the standard query-string encoding (`?q=some+like+it+hot`), which is what Angular's `Router`/`ActivatedRoute` `queryParams` produce and consume natively — no custom encoding needed.

---

## 6. Frontend design

### `SearchService` (`src/web/monster-of-the-week-web/src/app/core/search.ts`)

Mirrors `MonsterService`'s shape — thin wrapper over `ApiService`:

```typescript
@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private readonly apiService: ApiService) {}

  quick(query: string): Observable<SearchResultItem[]> {
    return this.apiService.get<SearchResultItem[]>(`/api/search/quick?q=${encodeURIComponent(query)}`);
  }

  search(query: string, page: number, pageSize: number): Observable<PagedSearchResult> {
    return this.apiService.get<PagedSearchResult>(
      `/api/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
    );
  }
}
```

`SearchResultItem` / `SearchResultDetailItem` (with `excerpt`/`snippet`) / `PagedSearchResult` added to `models.ts` alongside the other response interfaces.

### `DomainIconComponent` (`src/web/monster-of-the-week-web/src/app/shared/domain-icon.component.ts`)

The five inline SVG `<path>` blocks currently live only inside `page-layout.html`'s `@switch (item.icon)`. The search dropdown and the results page each need the same icon-per-domain rendering in a third and fourth place. Rather than copy-pasting the SVG markup again, extract it into a small standalone component taking a `domain` input and rendering the matching `<svg>` — `page-layout.html` is updated to use it too, so the icon markup exists in exactly one place. This is a refactor-for-reuse, not a new icon set (the path data is copied verbatim from `page-layout.html`, not reinvented).

### `HeaderSearchComponent` (`src/web/monster-of-the-week-web/src/app/shared/header-search/`)

Replaces the disabled `<input placeholder="Search (coming soon)">` block in `page-layout.html` (lines ~163–176) with a self-contained combobox component. `page-layout.html` changes from an inline `<form>` to `<app-header-search />`.

State (signals, no NgRx — consistent with the rest of the app):
```typescript
readonly query = signal('');
readonly results = signal<SearchResultItem[]>([]);
readonly isOpen = signal(false);
readonly highlightedIndex = signal<number | null>(null);
readonly isLoading = signal(false);
```

Pipeline: a `Subject<string>` fed by the input's `(input)` event, piped through `debounceTime(200)`, `distinctUntilChanged()`, filtered to `length >= 3` (Section 2), `switchMap` into `searchService.quick(query)` (switchMap cancels the in-flight request if the user keeps typing — the same rxjs idiom already used for load-on-navigate in `monster-detail.ts`). Results populate `results` and open the dropdown if non-empty.

### WAI-ARIA combobox behavior (single source of truth: `highlightedIndex`)

Following the [ARIA APG combobox-with-listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) (focus stays on the `<input>`; the listbox is a visual/ARIA-linked popup, not a separate focus target):

- `<input role="combobox" aria-expanded aria-controls="header-search-listbox" aria-autocomplete="list" aria-activedescendant>`
- `<ul id="header-search-listbox" role="listbox">` containing `<li role="option" id="header-search-option-{i}" aria-selected>`
- `ArrowDown` — if closed, open with current results; else move `highlightedIndex` to the next item (no wraparound: stays on the last item once there).
- `ArrowUp` — move `highlightedIndex` to the previous item (no wraparound: stays on the first item; moving up from index 0 does *not* clear the highlight, to avoid a confusing "sometimes nothing is highlighted" state during keyboard navigation — only mouse-leave/typing clears it, per spec "no default selection" meaning *initial* state, not "un-highlightable").
- Mouse `mouseenter` on an option sets `highlightedIndex` to that option's index — same signal keyboard navigation writes to, so keyboard and mouse are always in sync (moving the mouse after an arrow-key selection updates the one shared piece of state, no separate "keyboard highlight" vs "hover highlight").
- `Enter` — if `highlightedIndex()` is non-null, navigate to that result's detail route and close the dropdown. If `highlightedIndex()` is null (user has typed but never arrowed/hovered), navigate to `/search?q={query}` instead.
- Click on an option — identical effect to Enter-with-that-option-highlighted.
- `Escape` — close the dropdown, clear `highlightedIndex`, keep the typed text in the input.
- Click outside / blur — close the dropdown (no navigation).
- New results arriving (debounced fetch resolves) reset `highlightedIndex` to `null` — "no default selection" applies on every result-set change, not just on open.

Each result row: `[DomainIconComponent domain]` + `name` — domain conveyed visually via icon plus `aria-label`/visually-hidden text (e.g. "Monster: Grimtooth") for screen readers, since color/icon-only domain identification isn't accessible on its own.

### Full search results page

`features/search/` — new top-level feature, registered as a lazy route alongside `mysteries`/`monsters`/etc. in `app.routes.ts`:

```typescript
{ path: 'search', loadChildren: () => import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES) }
```

`search.routes.ts` → single route `{ path: '', component: SearchResultsComponent }`. `SearchResultsComponent` reads `q`/`page` off `ActivatedRoute.queryParamMap` (not route params — keeps the URL human-editable per the `?q=...` requirement), calls `searchService.search(q, page, pageSize)`, renders a paginated list.

Each result row: domain badge (reusing the **existing** tag styling already used on list views — `monsters-list.html`'s badge classes: `rounded-full text-[0.72rem] font-semibold tracking-[0.02em] px-[0.55rem] py-[0.15rem] whitespace-nowrap bg-{color}-100 text-{color}-700`, one color per domain) + name (linked to the detail route) + `result.snippet ?? result.excerpt` (Section 7). Pagination controls (Prev/Next + page indicator) drive the `page` query param; changing `q` (e.g. user edits the address bar) resets to `page=1`.

Detail route per domain (all top-level, flat — confirmed from each feature's `*.routes.ts`):

| Domain | Route |
|---|---|
| Mystery | `/mysteries/:id` |
| Monster | `/monsters/:monsterId` |
| Minion | `/minions/:minionId` |
| Location | `/locations/:locationId` |
| Bystander | `/bystanders/:bystanderId` |

---

## 7. Dynamic result view (forward design for Phase 4+, contract shaped for it now)

Once matching extends beyond `Name` (Phase 4), a result can be "explained" by a field or sub-resource that the fixed per-domain `excerpt` (Section 5 table) never shows — e.g. a Monster matched because one of its Attacks is named "Grimtooth," but the card only shows the Monster's `Description`, which never mentions "Grimtooth." Without a way to surface *what actually matched*, the result looks unexplained to the user.

**Design:** `matchedField` (already in the contract, Section 5) records *what* matched (`"Name"`, `"MonsterAttack.Name"`, `"Description"`, ...); `snippet` (Section 5) records *context from that specific match*, distinct from the fixed `excerpt`:

- Match on the entity's own `Name` (all of Phase 1–3, and still the majority of Phase 4 matches) → `snippet = null`; frontend falls back to the fixed `excerpt`. The `Name` is already shown as the result's title; it needs no separate excerpt.
- Match on a sub-resource `Name` (Phase 4) → `snippet` = that sub-resource's own name + description (e.g. `"Attack: Grimtooth — a vicious close-quarters claw rake."`). Cheap: sub-resource records are already short, no windowing needed.
- Match on a long-text field (Phase 4, tiers 2–4 only per Section 2) → `snippet` ideally a windowed excerpt centered on the match (Postgres `ts_headline` once `tsvector` is adopted for these fields, per Section 1's caveat). A naive "N characters before/after the match index" is a workable stopgap if `tsvector`/`ts_headline` isn't adopted yet, but is real, currently-unbuilt work — **not** assumed to ship automatically alongside the rest of Phase 4's field-matching expansion; it should be scoped as its own increment when Phase 4 is actually planned.

Frontend rendering (built in Phase 3, so no template change is needed later): `SearchResultsComponent` renders `result.snippet ?? result.excerpt` per row (Section 6). Today `snippet` is always `null`, so this always resolves to today's fixed-field `excerpt` — the fallback branch exists in the code from Phase 3 onward even though it's a no-op (always the same branch) until Phase 4 starts populating `snippet`.

---

## 8. Summary of what does *not* change when Phase 4+ lands

- `SearchService` (backend), `SearchService`/`HeaderSearchComponent`/`SearchResultsComponent` (frontend), the two endpoint contracts, the four-tier `MatchStrength` model, the `Primary`/`Secondary`/`Tertiary` weight scheme, the ranking formula, and the `snippet ?? excerpt` fallback are all stable across phases.
- Only `ISearchProvider` implementations (new `.Where` clauses, new field/tier/weight assignments, new `snippet` population logic) and possibly the underlying matching primitive (`ILIKE` → trigram/`tsvector`, Section 1) change.
