# Global Search — Architecture

Grounding: `MotwDbContext.cs`, `MonsterRepository.cs`, `MonstersController.cs`, `models.ts`, `api.ts`, `monster.ts`, `page-layout.html/.ts`, `monsters-list.html` (Phase 1 grounding), plus the actual Phase 1–3 implementation (`Services/Search/*.cs`, `Controllers/SearchController.cs`, `Contracts/ApiContracts.cs`/`ApiMappers.cs`, `features/search/`, `shared/header-search/`, `core/search.ts`, `core/models.ts`) for Phase 4. See `docs/phases/phase-8-minions-ui-flow.md` for the doc-style precedent this follows, and `.squad/decisions/inbox/bowser-search-phase1-backend.md` for the Phase 1 implementation notes referenced throughout (particularly Section 1).

**This document now describes what's actually built (Phases 1–3, shipped) plus the fully specced Phase 4 design (not yet implemented).** Where the original draft's illustrative code differed from what shipped, this revision corrects it to match reality — see the Section 1 callout below.

---

## 1. Backend search strategy

### As shipped (Phases 1–3): dedicated `GET /api/search*` endpoints, in-memory tier matching over fully-fetched columns. Not `EF.Functions.ILike` as originally drafted — see below.

**Original recommendation vs. what shipped.** This doc originally called for chained `EF.Functions.ILike` `.Where()` clauses translated to SQL. Phase 1's implementation deviates: each provider does one untranslated `.Select(x => new { x.Id, x.Name, ... }).ToListAsync()` (the whole table into memory) and runs `SearchTokenizer`'s tier logic as plain C# string comparisons (`string.Contains`/`StartsWith`, not `EF.Functions.ILike`). **Reason:** `EF.Functions.ILike` is Npgsql-only and does not translate against SQLite, which is what this repo's existing repository tests run against; keeping the tier logic as plain C# makes it testable without any database at all, and portable across the SQLite test suite and Postgres production. This was a deliberate Phase 1 call (`.squad/decisions/inbox/bowser-search-phase1-backend.md`), not an oversight, and the rest of this document's reasoning about scale (dataset is small, full scans are cheap) applies to it identically — a full in-memory scan of a small table costs about the same as a full unindexed `ILIKE` scan of the same table; the win from `EF.Functions.ILike` in Phase 1 was never "fewer rows examined" (nothing is indexed either way at this dataset size), it was "the DB engine does the string comparison instead of the app process," which doesn't move the needle at these row counts.

**Why this still holds for Phase 4 (sub-resource + long-text fields).** Phase 4 adds Monster/Minion sub-resource collections (`Attacks`/`Powers`/`Armors`/`Weaknesses`, each with `Name`+`Description`) and four more Mystery fields (`Concept`/`Hook`/`Overview`/`Notes`) to the in-memory fetch. This is still additive `.Select()` projections — never `.Include()` (which would materialize full tracked entity graphs, adding change-tracking and over-fetching overhead this design has no reason to pay for) — using **nested collection projections**, e.g.:

```csharp
var monsters = await dbContext.Monsters
    .AsNoTracking()
    .Select(x => new
    {
        x.Id, x.Name, x.Description,
        Attacks = x.Attacks.Select(a => new { a.Id, a.Name, a.Description }).ToList(),
        Powers = x.Powers.Select(p => new { p.Id, p.Name, p.Description }).ToList(),
        Armors = x.Armors.Select(a => new { a.Id, a.Name, a.Description }).ToList(),
        Weaknesses = x.Weaknesses.Select(w => new { w.Id, w.Name, w.Description }).ToList(),
    })
    .ToListAsync(cancellationToken);
```

This is still plain LINQ over projections — no `EF.Functions.ILike`, no raw SQL — so it stays portable to SQLite for tests exactly like Phase 1's queries, without needing a test-double or Postgres-only integration suite. Total rows pulled into memory per search request becomes (entity row count) + (sum of that entity's sub-resource row counts) across all five providers; for a single-GM homebrew library this is still expected to land in the hundreds, not thousands.

**Explicit revisit trigger (so this isn't left as a vague "revisit later" the way it was in Phase 1).** Move to real DB-side filtering (`EF.Functions.ILike` per tier, or `pg_trgm`/`tsvector` per Section 1's original scaling note) if **either**:
- Total rows fetched across all providers for one search request is expected to exceed roughly **5,000 rows**, or
- Observed p95 server-side search latency exceeds roughly **150ms** in practice.

At that point, also resolve the SQLite-portability problem the in-memory approach was chosen to sidestep — either a Postgres-only integration suite (e.g. Testcontainers) for the SQL-translated matching logic, or restructuring providers so the tier-matching logic is tested independently of the ORM via a fake `ISearchProvider`/`DbContext` seam. Not needed now; flagged so it isn't forgotten a second time.

**Sequential provider fan-out is unaffected by Phase 4.** `SearchService.RankAsync` fans out to all `IEnumerable<ISearchProvider>` sequentially, not via `Task.WhenAll` — all providers share one scoped `MotwDbContext` per request, and EF Core's `DbContext` is not safe for concurrent use (`ConcurrencyDetector` throws; this was found and fixed during Phase 1). Phase 4 makes each provider's individual query heavier (more columns, nested collections) but does not change the concurrency constraint — sequential fan-out remains correct and necessary regardless of how much each provider fetches.

**Why not `pg_trgm`/`tsvector` yet, even with long text now in scope.** Phase 4's long-text matching only ever uses tiers 2–4 (boundary-prefix/starts-with/exact — see Section 2's scoping rule, unchanged), never unanchored substring on prose. `pg_trgm` exists specifically to accelerate unanchored substring/similarity search; since Phase 4 deliberately doesn't do that against long text, adopting it now would still be solving a problem this design doesn't have. The trigger for adopting it is unchanged from the original doc: row-count growth (this section) or a future decision to extend substring matching to long text (Section 2).

### API surface: two endpoints, not one (unchanged)

- `GET /api/search/quick?q={query}` — fixed top-4 combined results for the header dropdown. Name + icon only — no excerpt, snippet, highlight, or field label. Confirmed unchanged by Phase 4 (Section 6/7).
- `GET /api/search?q={query}&page={n}&pageSize={n}` — paginated full results for the results page. Includes `totalCount`, `excerpt`, and — as of Phase 4 — real `snippet`/`matchSpans`/`matchedSubResourceName`.

---

## 2. Tokenization and matching rule

**As shipped**, `SearchTokenizer` (`Services/Search/SearchTokenizer.cs`) implements exactly the four-tier model this section originally specified, as plain C# rather than SQL:

```csharp
public static class SearchMatchTier
{
    public const int Substring = 1;
    public const int BoundaryPrefix = 2;
    public const int StartsWith = 3;
    public const int Exact = 4;
}

public static bool SubstringMatches(string field, string token) =>
    field.Contains(token, StringComparison.OrdinalIgnoreCase);

public static bool BoundaryPrefixMatches(string field, string token) =>
    field.StartsWith(token, StringComparison.OrdinalIgnoreCase)
    || field.Contains(" " + token, StringComparison.OrdinalIgnoreCase)
    || field.Contains("-" + token, StringComparison.OrdinalIgnoreCase);

public static bool StartsWithMatches(string field, string rawQuery) =>
    field.StartsWith(rawQuery, StringComparison.OrdinalIgnoreCase);

public static bool ExactMatches(string field, string rawQuery) =>
    string.Equals(field, rawQuery, StringComparison.OrdinalIgnoreCase);
```

`ComputeMatchStrength(field, tokens, rawQuery, includeSubstringTier)` resolves a field's overall tier exactly as originally specified (every token must clear at least the substring tier when `includeSubstringTier` is true; the field's tier is the weakest tier every token clears; tiers 3/4 are only checked once tier 2 already holds, which is a valid short-circuit since Exact/StartsWith both imply BoundaryPrefix). `includeSubstringTier` is the code-level form of the scoping rule below — callers pass `true` for `Name`-style fields, `false` for long text.

**Scope: which fields get the substring tier — unchanged.** Only `Name`-style fields (`Primary`/`Secondary` weight): entity `Name` (all domains) and, as of Phase 4, sub-resource `Name` (Attack/Power/Armor/Weakness). Never long free text (`Tertiary` weight: `Description`, and Mystery's `Concept`/`Hook`/`Overview`/`Notes`, plus sub-resource `Description`) — noise and snippet-quality reasons unchanged from the original design (Section 2 of the prior revision; restated in Section 7 below now that snippet quality is a concrete, shipped concern rather than a hypothetical one).

**Minimum query length — unchanged, 3 characters, frontend-only.** `HeaderSearchComponent`'s debounce pipeline gates on `value.trim().length >= 3` before firing; the backend's `RankAsync` never rejects a query by length, only by "zero tokens" (empty/whitespace/dash-only). Confirmed correctly implemented as designed (`.squad/decisions/inbox/bowser-search-phase1-backend.md`'s "deviation #3" note documents this was briefly implemented backend-side and then corrected to match this doc).

---

## 3. Extensibility: the `SearchableField` / `ISearchProvider` design

### As shipped, `SearchMatchCandidate` (`Services/Search/ISearchProvider.cs`):

```csharp
public enum SearchFieldWeight { Primary = 100, Secondary = 50, Tertiary = 25 }

public sealed record SearchMatchCandidate(
    string EntityType,
    Guid EntityId,
    string Name,
    string MatchedField,
    int MatchStrength,
    SearchFieldWeight Weight,
    string? ExcerptSource)
{
    public int Score => MatchStrength * (int)Weight;
}
```

`ExcerptSource` is the fixed per-domain excerpt field (Section 5) — independent of what actually matched, used only to build the always-present `Excerpt` fallback. One `ISearchProvider` per domain, unchanged; `SearchService` fans out, dedupes to the single highest-scoring candidate per `(EntityType, EntityId)`, and ranks (Section 4).

### Phase 4 extensions to `SearchMatchCandidate`

```csharp
public sealed record SearchMatchSpan(int Start, int Length);

public sealed record SearchMatchCandidate(
    string EntityType,
    Guid EntityId,
    string Name,
    string MatchedField,              // "Name" | "Description" | "Concept" | "Hook" | "Overview" | "Notes" | "Attack.Name" | "Attack.Description" | "Power.Name" | "Power.Description" | "Armor.Name" | "Armor.Description" | "Weakness.Name" | "Weakness.Description"
    string? MatchedSubResourceName,   // e.g. "Fire Breath" when MatchedField is a sub-resource field; null for entity-level fields
    int MatchStrength,
    SearchFieldWeight Weight,
    string? ExcerptSource,
    string? Snippet,                  // windowed, highlight-span-annotated text from MatchedField's own content — null when MatchedField == "Name" (Section 7)
    IReadOnlyList<SearchMatchSpan> MatchSpans) // offsets into Snippet; empty when Snippet is null
{
    public int Score => MatchStrength * (int)Weight;
}
```

`MatchedField`'s naming convention: bare field name for entity-level fields (`"Name"`, `"Description"`, `"Concept"`, `"Hook"`, `"Overview"`, `"Notes"`); `"{Kind}.{Field}"` for sub-resource fields, where `Kind ∈ {Attack, Power, Armor, Weakness}` and `Field ∈ {Name, Description}` — no redundant entity-type prefix (e.g. `"MonsterAttack.Name"`), since `EntityType` already disambiguates Monster vs. Minion and the sub-resource kind names don't collide between them.

### `SearchFieldWeight` reassignment (`open-questions.md` rows 11/13, already decided, now realized)

```csharp
public enum SearchFieldWeight
{
    Primary = 100,     // entity's own Name (all 5 domains)
    Secondary = 50,    // sub-resource Name (Monster/Minion Attack/Power/Armor/Weakness.Name) — Phase 4
    Tertiary = 25       // long free text: entity Description/Concept/Hook/Overview/Notes, and sub-resource Description — Phase 4
}
```

### One provider still emits at most one candidate per entity — the field-selection now happens *inside* the provider

Phase 1–3's dedup (`SearchService.RankAsync`'s `GroupBy((EntityType, EntityId)).Select(highest Score).First()`) was trivially a no-op in practice, since only one field (`Name`) ever produced a candidate. **Phase 4 makes this matter for real**, and the reduction now happens in two places with two different jobs:

1. **Inside each provider, per entity**: evaluate every candidate field for that entity (its own `Name`, its own long-text fields, and — for Monster/Minion — every sub-resource instance's `Name` and `Description`), compute `(MatchStrength, Weight)` → `Score` for each one that matches at all, and keep only the single highest-scoring field. This is new work Phase 4 adds to each provider (Section 4's "candidate field" helper below) — the provider still emits **one `SearchMatchCandidate` per matching entity**, exactly like Phase 1–3, just backed by a smarter per-entity field-selection step.
2. **`SearchService.RankAsync`'s existing dedup** (unchanged) remains the safety net across *providers* — not needed for within-entity field selection anymore (that's step 1's job), but still correct and still necessary as-is (nothing about it needs to change).

**Confirmed: no "matched on N fields" UI.** An entity that matches on two sub-resources, or on both its `Name` and its `Description`, still surfaces as one result, backed by whichever single field scored highest. Deliberately not surfacing "also matched via Description" as a secondary note — the added UI complexity (which snippet to show if more than one? do you list every matched field?) isn't worth it for a low-value edge case, and the weight/tier model already guarantees the *most legible* match (highest score) is the one shown.

### Shared per-provider helper (new in Phase 4, avoids 5x-duplicated field-selection logic)

```csharp
public readonly record struct CandidateField(
    string FieldName, string? Text, SearchFieldWeight Weight, bool AllowSubstringTier, string? SubResourceName = null);

// In SearchTokenizer:
public static (string FieldName, string? SubResourceName, int MatchStrength, SearchFieldWeight Weight, string? Text)?
    PickBestMatch(IReadOnlyList<CandidateField> fields, IReadOnlyList<string> tokens, string rawQuery)
```

Each provider builds its per-entity `List<CandidateField>` (own `Name` with `AllowSubstringTier: true`; own long-text fields with `AllowSubstringTier: false`; each sub-resource's `Name`/`Description` likewise), calls `PickBestMatch`, and — if non-null — builds the `SearchMatchCandidate` (including `Snippet`/`MatchSpans` via `SearchSnippetBuilder`, Section 7) from the winning field. This is the Phase 4 equivalent of Phase 1's shared `ComputeMatchStrength` — one implementation, five call sites, not five copies.

**Excluded from Phase 4 scope: `CustomMove` sub-resources.** `MonsterCustomMove`/`MinionCustomMove`/`LocationCustomMove`/`BystanderCustomMove`/`MysteryCustomMove` are not added as candidate fields. Not requested in the Phase 4 brief, and consistent with how custom moves are treated elsewhere in this app as a still-incomplete feature (e.g. minion custom moves have no create/edit API per `docs/phases/phase-8-minions-ui-flow.md`). Flagged explicitly in `open-questions.md` so it reads as a deliberate exclusion, not an oversight.

---

## 4. Ranking (combined top-4, and full results ordering) — formula unchanged, now fully in effect

Score per candidate: `score = MatchStrength * (int)Weight`. `MatchStrength` (1 substring – 4 exact, Section 2) and `Weight` (`Primary`/`Secondary`/`Tertiary`, Section 3) are unchanged from the original design; Phase 4 is what finally makes `Secondary` and `Tertiary` candidates possible in practice (Phase 1–3 only ever produced `Primary`).

Worked scores, highest to lowest (unchanged table from the prior revision, now real rather than illustrative):

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

Ordering (`score DESC, Name ASC, EntityType ASC, Id ASC`) and the in-memory cross-domain merge rationale are unchanged (Section 1's revisit trigger now gives that merge an explicit numeric ceiling too, not just a vague "if it grows").

---

## 5. API contract sketch

### As shipped (Phases 1–3):

```
GET /api/search/quick?q=sto
200 OK
[ { "entityType": "Location", "id": "b3f1...", "name": "The Stone Circle", "matchedField": "Name" }, ... ]
```

```
GET /api/search?q=sto&page=1&pageSize=20
200 OK
{
  "items": [
    { "entityType": "Location", "id": "b3f1...", "name": "The Stone Circle", "matchedField": "Name",
      "excerpt": "An ancient ring of standing stones...", "snippet": null }
  ],
  "page": 1, "pageSize": 20, "totalCount": 7
}
```

### Phase 4: `SearchResultDetailResponse` gains `matchedSubResourceName` and `matchSpans`; `snippet` becomes real

```csharp
public sealed record SearchMatchSpanResponse(int Start, int Length);

public sealed record SearchResultDetailResponse(
    string EntityType,
    Guid Id,
    string Name,
    string MatchedField,
    string? MatchedSubResourceName,
    string Excerpt,
    string? Snippet,
    IReadOnlyList<SearchMatchSpanResponse> MatchSpans);
```

Worked examples — a Monster matched via one of its Attacks, two ways:

**Matched on the Attack's `Description`** (the illustrative case — a real windowed/highlighted snippet from prose):

```json
{
  "entityType": "Monster",
  "id": "9c21...",
  "name": "The Ashwood Stalker",
  "matchedField": "Attack.Description",
  "matchedSubResourceName": "Fire Breath",
  "excerpt": "A skeletal figure wreathed in cold flame, said to haunt the old orchard...",
  "snippet": "…massive lungs capable of a devastating fire breath that scorches everything in a ten-foot cone…",
  "matchSpans": [ { "start": 32, "length": 12 } ]
}
```

**Matched on the Attack's `Name` itself** — as shipped, `SearchSnippetBuilder` always builds `snippet` from the *winning field's own text* (Section 7), so a `Name`-field sub-resource match produces a short snippet that's just that name, highlighted in full — **confirmed as the intended behavior** (product-owner review, 2026-08-01), not a gap to fix in Phase 4c:

```json
{
  "entityType": "Monster",
  "id": "9c21...",
  "name": "The Ashwood Stalker",
  "matchedField": "Attack.Name",
  "matchedSubResourceName": "Fire Breath",
  "excerpt": "A skeletal figure wreathed in cold flame, said to haunt the old orchard...",
  "snippet": "Fire Breath",
  "matchSpans": [ { "start": 0, "length": 11 } ]
}
```

This snippet is short and reads as redundant with the "Matched in: Attack — Fire Breath" label chip Phase 4c renders alongside it (Section 6) — that redundancy is fine and deliberate. The alternative (falling back to the Attack's `Description`, if any, when the match itself was on `Name`) was considered and explicitly rejected: it would show text that didn't actually match the query, which is more misleading than a short, honest, exact-match snippet. No special-casing needed in Phase 4c — `SearchSnippetBuilder`'s existing "snippet the field that actually won" behavior already produces the right result with zero additional code.

`excerpt` remains the always-present, fixed per-domain fallback — unchanged mechanism, but its **source field selection is extended** for Mystery now that all four long-text fields are known-searchable: `Hook → Concept → Overview → Notes` (first non-empty wins), up from `Hook → Concept` only. This closes a real (if minor) gap: a Mystery with empty `Hook` and `Concept` but a filled-in `Overview` previously showed a blank excerpt; now it doesn't. Monster/Minion/Location/Bystander's excerpt source is unchanged (`Description`).

`snippet`/`matchSpans` are populated **whenever `MatchedField != "Name"`** (the entity's own bare `Name`, e.g. `"Name"` — not to be confused with a sub-resource's `{Kind}.Name`, e.g. `"Attack.Name"`, which *does* get a snippet, per the example above) — i.e. whenever there's a specific field/sub-resource whose own text is more informative than the fixed `excerpt`. When `MatchedField == "Name"` (the entity's own name), both stay `null`/`[]`, and the frontend falls back to `excerpt` exactly as designed in the original Section 7 — the entity's title already shows the match; a separate windowed excerpt of the entity's own `Name` field would be redundant. **Confirms** rather than changes the original Phase 1–3 design intent (Section 7 always said this, this is the first phase where it's exercised for real).

`matchSpans` offsets are relative to `snippet` (including its leading `…` if present, so the frontend can index directly into the string it renders — no need to also know about the original field's un-windowed text). Snippet-building details (window size, anchor selection, span-finding, merging) are in Section 7.

`q` encoding, pagination params — unchanged.

---

## 6. Frontend design

### As shipped

`SearchService` (`core/search.ts`), `DomainIconComponent`, `HeaderSearchComponent` (combobox — Section headers below), `SearchResultsComponent`/`search-results.html` (results page) are all implemented as originally designed. `SearchResultsComponent.contextText(item)` already returns `item.snippet ?? item.excerpt` (Section 7) — currently always `excerpt` since `snippet` is always `null`. `SearchResultItem`/`SearchResultDetailItem`/`PagedSearchResult` in `models.ts` match the shipped contract.

### Confirmed: the header dropdown does not grow snippet/highlight/field-label rendering in Phase 4

The new requirement is explicit: "each **full-results-page row** must show a snippet... with the matched substring highlighted... a label... the resource's title, and a link." This is scoped to the results page by its own wording, and matches the boundary already established in Phase 2/3 (dropdown = fast title-only triage; results page = fuller context) and the original product spec's own framing (the dropdown "should probably only have the top 4 results," the results page has "a little more info"). `HeaderSearchComponent`/`header-search.html` are **not modified** by Phase 4 — confirmed, not left ambiguous; see `open-questions.md` for the explicit sign-off row.

### Phase 4 additions to `models.ts`

```typescript
export interface SearchMatchSpan {
  start: number;
  length: number;
}

export interface SearchResultDetailItem extends SearchResultItem {
  excerpt: string;
  snippet: string | null;
  matchSpans: SearchMatchSpan[];
  matchedSubResourceName: string | null;
}
```

(`SearchResultItem` — the dropdown's shape — is untouched: `entityType`, `id`, `name`, `matchedField`, nothing more, per the confirmation above.)

### Rendering: highlighted snippet segments, built via a pure function (no `[innerHTML]`)

The backend never returns markup — `snippet` is plain text, `matchSpans` are structured offsets. The frontend turns `(snippet, matchSpans)` into an ordered array of `{ text: string; isMatch: boolean }` segments and the template `@for`s over them, rendering `<mark>` for matched segments and plain interpolated text otherwise. **Why not embed `<mark>` (or a custom delimiter) directly in the API response and bind via `[innerHTML]`:** it would require relying on Angular's HTML sanitizer allowing `<mark>` through its allowlist (an implementation detail not worth depending on) and would put markup concerns in the API contract, which this codebase's existing services (`MonsterService`, etc.) never do — data in, presentation in the component, kept separate. The segment-array approach is a pure, easily-unit-testable function and stays entirely within ordinary Angular template interpolation (auto-escaped, no sanitizer involved at all).

```typescript
export interface SnippetSegment {
  text: string;
  isMatch: boolean;
}

export function buildSnippetSegments(snippet: string, spans: SearchMatchSpan[]): SnippetSegment[] {
  // spans are assumed pre-sorted and non-overlapping (backend merges overlapping/adjacent
  // spans before returning them — Section 7); walk the string once, alternating
  // non-match/match segments.
}
```

`search-results.html` renders, per result row (in addition to the existing icon/badge/title/link, unchanged):

```html
@if (fieldLabel(item); as label) {
  <span class="...small muted chip...">Matched in: {{ label }}</span>
}
<p class="my-1">
  @for (segment of contextSegments(item); track $index) {
    @if (segment.isMatch) { <mark>{{ segment.text }}</mark> } @else { {{ segment.text }} }
  }
</p>
```

`contextSegments(item)`: if `item.snippet` is non-null, `buildSnippetSegments(item.snippet, item.matchSpans)`; otherwise `[{ text: item.excerpt, isMatch: false }]` (the existing fixed-excerpt fallback, now rendered through the same segment machinery so the template has one rendering path, not two).

### Field/sub-resource label (task requirement #4)

```typescript
function fieldLabel(item: SearchResultDetailItem): string | null {
  if (item.matchedField === 'Name') return null; // redundant with the title — no chip shown
  const [kind, field] = item.matchedField.includes('.') ? item.matchedField.split('.') : [null, item.matchedField];
  return kind && item.matchedSubResourceName ? `${kind} — ${item.matchedSubResourceName}` : field;
}
```

Produces `"Description"`, `"Hook"`, `"Overview"`, etc. for entity-level matches, and `"Attack — Fire Breath"` for sub-resource matches — exactly the two examples in the Phase 4 brief.

Detail route mapping, badge colors, pagination — unchanged from Phases 1–3.

---

## 7. Dynamic result view — the real, final design (was "forward design," now specced for implementation)

The original Section 7 sketched the intent without committing to window size, anchor selection, or multi-span behavior; those are now concrete.

**When `snippet`/`matchSpans` are populated:** whenever `MatchedField != "Name"` (Section 5) — i.e. every Phase 4 match type (entity long text, sub-resource `Name`, sub-resource `Description`). Never for `Name` matches (unchanged rationale: the title already shows it).

**Window size: 70 characters on each side of the primary match, via `SearchSnippetBuilder` (new, `Services/Search/SearchSnippetBuilder.cs`).** Chosen so the resulting snippet (≈70 + match length + 70 ≈ 145–190 chars for typical short query tokens) lands in the same visual range as the existing 160-character `excerpt`, keeping result-row heights consistent regardless of which text a given row happens to show. Independently tunable (a single constant) if it proves too tight or too loose in practice.

**Anchor selection (which position the window centers on):**
- `MatchStrength` is `StartsWith` (3) or `Exact` (4) → anchor = 0 (the match is the field's start, or the whole field) — window is effectively "from the start," converging with how `excerpt`'s truncation already behaves for this case.
- `MatchStrength` is `BoundaryPrefix` (2) or `Substring` (1, `Name`-style fields only — moot for long text since it never reaches tier 1) → anchor = the earliest case-insensitive occurrence, among all query tokens, of a match satisfying whichever tier won. Leftmost-wins is a simple, deterministic, reading-order-natural tiebreak.

**Building the window:** clamp `[anchor − 70, anchor + tokenLength + 70]` to the field's bounds, trim each cut edge back to the nearest preceding/following word boundary (same technique `TruncateExcerpt` already uses, applied at both ends instead of just the end), and prepend/append `"…"` if that edge was actually cut short of the field's start/end (i.e. never add an ellipsis when the window already reaches the field boundary on that side).

**Multi-span highlighting — deliberately partial, and here's why that's the right simplification.** A multi-token query (`"sto ann"`) can match at two separate positions that may be far apart in a long field — too far apart for one ~150-character window to contain both. Rather than trying to build multiple disjoint windows (real added complexity — variable-length snippets, "…gap…" rendering, unclear value for a search feature) or only ever highlighting the single anchor token (leaving other genuinely-matched tokens unhighlighted even when they're visibly present in the shown text), the design is: **pick one anchor position to center the window (as above), then scan the resulting window text for every occurrence of every query token and highlight all of them that land inside it.** For the common case — tokens close together, e.g. "Stone Anne" matching "sto ann" — this naturally highlights both. For tokens far apart, only the anchor's token (and whichever others happen to also appear nearby) get highlighted; a second token that matched somewhere outside the visible window simply isn't visible to highlight, which isn't a bug — the snippet is honestly showing what's actually in the window, not implying a highlight exists somewhere off-screen.

Span-finding within the window: case-insensitive `IndexOf` per query token (not gated by which tier "won" — for highlighting purposes, showing every literal token occurrence that's visible is more helpful than replicating the tier logic here), collecting `(start, length)` pairs local to the final `snippet` string (including any leading `"…"`). **Overlapping or adjacent spans are merged into one contiguous span** before being returned, so the frontend's segment-building (Section 6) can assume a simple sorted, non-overlapping list and never has to reason about overlap itself.

**Frontend rendering** (Section 6) is unchanged in intent from the original Section 7 — `snippet ?? excerpt` — just now genuinely exercised, and now rendering through the segment/`<mark>` machinery rather than plain text.

---

## 8. What stays stable beyond Phase 4

`SearchService`'s public contract, the two endpoints, the four-tier `MatchStrength` model, the `Primary`/`Secondary`/`Tertiary` weight scheme, the ranking formula, the `ISearchProvider` interface, and the frontend's `SearchService`/`HeaderSearchComponent`/`SearchResultsComponent` component boundaries are all unaffected by Phase 4 and expected to remain unaffected by any future field additions (e.g. `MysteryCustomMove`/etc. if ever brought into scope) or by a future move to DB-side matching (Section 1's revisit trigger) — those remain per-provider/per-query internal changes, not contract or ranking-model changes, exactly as promised in the original design.
