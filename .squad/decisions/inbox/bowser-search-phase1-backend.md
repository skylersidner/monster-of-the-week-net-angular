# Global Search Phase 1 — Backend Implementation Notes

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-01

## What

Implemented Phase 1 of global search per `docs/search/architecture.md` and `docs/search/phases.md`: `GET /api/search/quick` and `GET /api/search`, the four-tier match ranking model, and the `ISearchProvider` extensibility seam (5 providers, Name-only, `Weight = Primary`). Files: `src/api/MonsterOfTheWeek.Api/Services/Search/*`, `Controllers/SearchController.cs`, additions to `Contracts/ApiContracts.cs` / `Contracts/ApiMappers.cs`, DI registration in `Program.cs`. Tests in `src/api/MonsterOfTheWeek.Api.Tests/Services/Search/`.

## Why (three deviations from the docs, each with a concrete reason)

1. **Matching primitive: in-memory tier predicates over a full `Select`, not chained `EF.Functions.ILike` `.Where()` clauses.** `EF.Functions.ILike` is Npgsql-only and doesn't translate against SQLite, which is what this repo's existing repository tests run against (`MonsterRepositoryTests.cs`). Since Phase 1's own architecture doc justifies full-table scans as cheap at this dataset's scale, each provider does one untranslated `.Select(Id, Name, <excerpt field>).ToListAsync()` and `SearchTokenizer`'s tier logic runs as plain C# string comparisons. This is portable (SQLite tests + Postgres prod) and keeps the tier logic itself testable without any database. If row counts ever grow enough to need `pg_trgm`/indexed `ILIKE` (Phase 4+ per the docs), this is a per-provider query change, not a ranking/contract change — so the extensibility promise still holds.

2. **`SearchService.RankAsync` fans out to providers sequentially, not via `Task.WhenAll`.** All 5 `ISearchProvider`s share one scoped `MotwDbContext` per request; concurrent async use of a single `DbContext` throws (`ConcurrencyDetector`). This only surfaced when manually curling the running app against real Postgres — the xUnit `SearchServiceTests` use fake providers backed by `Task.FromResult`, which don't exercise real concurrency. Worth remembering for any future fan-out code sharing one scoped `DbContext`.

3. **Backend enforces the 3-character minimum query length itself**, returning empty results (not an error) below it, matching the task's explicit instruction. This contradicts `architecture.md` Section 2's closing note, which states the min-length gate is frontend-only and "the backend does not reject short queries... the full results page URL must keep working if a user manually edits `?q=an`." Followed the task prompt (repeated the requirement twice, unambiguously) over that note. Flagging in case the architecture doc's intent was meant to override — if so, Phase 1's `SearchService.MinimumQueryLength` check is a one-line removal.

## If wrong

Revisit with Yoshi (architecture) / Skyler if strict `ILIKE`-in-SQL matching or `Task.WhenAll`-style provider parallelism (via per-provider `IDbContextFactory` scopes) is wanted before Phase 4.

## Update (2026-08-01, same day) — deviation #3 resolved

Coordinator confirmed `architecture.md` Section 2's closing note is the approved design: the 3-character minimum is a **frontend-only** gate on `HeaderSearchComponent`'s debounce (Phase 2, not yet built) — the backend must never reject a query by length. Removed `SearchService.MinimumQueryLength` and the length check from `RankAsync`; kept the `tokens.Count == 0` check (empty/whitespace/dash-only queries still correctly return empty — that's "nothing to search for," not a length gate). Updated `SearchServiceTests.cs`: dropped `"an"` from the empty-query theories, added `QuickSearchAsync_DoesNotRejectShortQueries_MinLengthIsFrontendOnly` / `SearchAsync_DoesNotRejectShortQueries_MinLengthIsFrontendOnly` confirming 1-2 char queries return real results. 41/41 tests green, build clean.
