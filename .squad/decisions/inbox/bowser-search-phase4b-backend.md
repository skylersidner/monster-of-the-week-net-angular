# Global Search Phase 4b — Backend Implementation Notes

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-01

## What

Implemented Phase 4b per `docs/search/phases.md`'s "Phase 4b" sub-phase and `docs/search/architecture.md` Section 3: extended `MonsterSearchProvider`/`MinionSearchProvider` (only these two — the other three domains have no sub-resources) to also evaluate every Attack/Power/Armor/Weakness's `Name` (Secondary, all 4 tiers) and `Description` (Tertiary, tiers 2-4) as additional per-entity candidate fields, via the exact same `SearchTokenizer.PickBestMatch`/`SearchSnippetBuilder` machinery Phase 4a already shipped. `MonsterCustomMove`/`MinionCustomMove` explicitly excluded, per the doc's existing "Excluded from Phase 4 scope" note. Backend-only; `src/web/` untouched. No changes to `SearchTokenizer.cs`, `SearchSnippetBuilder.cs`, `ISearchProvider.cs`, `ApiContracts.cs`, `ApiMappers.cs`, `SearchService.cs`, or `SearchController.cs` — the Phase 4a machinery absorbed the larger per-entity candidate list with zero modification, exactly as the architecture doc predicted.

Files: `Services/Search/MonsterSearchProvider.cs`, `Services/Search/MinionSearchProvider.cs`, `Services.Tests/Search/SearchProvidersTests.cs` (extended, not fragmented — matches Phase 4a's file organization).

## Query shape

Both providers switched from a flat `.Select(x => new { Id, Name, Description })` to a nested projection also pulling `Attacks`/`Powers`/`Armors`/`Weaknesses` as `List<SubResourceProjection>` (a private `sealed record SubResourceProjection(string Name, string? Description)` per provider). Still `AsNoTracking()`, still no `.Include()`, still no `EF.Functions.ILike` — confirmed the nested-collection-projection pattern (`architecture.md` Section 1) translates cleanly against both SQLite (test suite, via `SearchProvidersTests.cs`) and real Postgres (manual `docker compose up -d postgres && dotnet run` smoke test), with identical code and no provider-specific workarounds needed for either.

**Why a named record instead of the anonymous type the prompt's illustrative code used:** the per-kind field-building logic (`AddSubResourceFields`) is shared across all 4 sub-resource kinds via one helper method, which needs a concrete, nameable parameter type. Anonymous types with an identical shape (same property names/types/order) actually do unify into the same compiler-generated type within one compilation, so this wasn't strictly required — but relying on that unification behavior for a cross-call-site parameter type felt like the wrong thing to depend on for readability's sake. A one-line `private sealed record SubResourceProjection(string Name, string? Description)` is clearer and just as translatable.

## Doc inconsistency flagged (not a blocker, implementation follows the machinery, not the example)

`architecture.md` Section 5's worked JSON example pairs `"matchedField": "Attack.Name"` with a `"snippet"` reading like prose from the Attack's *Description* ("…massive lungs capable of a devastating fire breath…"), not its short `Name`. This can't happen with the actual shipped Phase 4a machinery: `SearchSnippetBuilder.Build` is always called with the winning field's own text (`match.Value.Text`), so an `Attack.Name` win only ever produces a snippet windowed from the Name string itself. Confirmed live against Postgres: `?q=Force+of+Silence` → `matchedField: "Attack.Name"`, `snippet: "Force of Silence"` (the Name text verbatim), not Description prose. Treated the doc's example as illustrative/aspirational; followed the real, already-tested Phase 4a behavior instead, which is also what the Phase 4b prompt's own "Snippet building — unchanged logic" section confirmed needed no changes.

## Tests

Extended `SearchProvidersTests.cs` (real SQLite, no fakes — matches Phase 4a's convention) with 15 new tests:
- Sub-resource `Name` (score 200) beats same-entity `Description` (score 100) for the same query.
- 8-case `[Theory]` over all 4 kinds × both fields (`Name`/`Description`) confirming `MatchedField`/`MatchedSubResourceName`/`Weight` are all correct.
- Multiple-simultaneously-matching-sub-resources dedup, one test per provider (Monster: Attack exact beats Power boundary-prefix; Minion: Armor exact beats Weakness boundary-prefix) — still exactly one candidate per entity.
- CustomMove-exclusion regression, one test per provider.
- A "Fire Breath"-style end-to-end test per provider that also calls `.ToDetailResponse()` — the exact mapping `SearchController.Get` calls — since no `WebApplicationFactory`/HTTP integration harness exists anywhere in this repo yet. This is the closest true "hits the controller's code path" test without inventing new test infrastructure this repo hasn't established in any prior phase; flagging as an interpretation call on the prompt's "GET /api/search?q=... end-to-end" wording, not a literal HTTP roundtrip test.

## Verification

90/90 tests green (was 75 after Phase 4a; +15 net), `dotnet build` clean with 0 warnings. Manually verified against real Postgres seed data (`docker compose up -d postgres`, `dotnet run`): `?q=Force+of+Silence` → Monster "All-Father Stillness" via `Attack.Name`; `?q=oppressive+spectral` → same Monster via `Power.Description` with a correctly windowed/spanned snippet; `?q=Loud+Noises` → same Monster via `Weakness.Name` *and* a Minion via `Weakness.Description` simultaneously in one response, confirming Monster/Minion parity live; search latency ~110-130ms per request against Docker Postgres on localhost, well under the 150ms revisit-trigger (`architecture.md` Section 1).

## If wrong

If a future phase wants literal HTTP-roundtrip integration tests (real `WebApplicationFactory<Program>` + `HttpClient`), that's a repo-wide test-infrastructure addition, not something to bolt on ad hoc for one feature — flag to Yoshi/Skyler if `GET /api/search` end-to-end coverage needs to be stronger than "provider + `.ToDetailResponse()`" going forward.
