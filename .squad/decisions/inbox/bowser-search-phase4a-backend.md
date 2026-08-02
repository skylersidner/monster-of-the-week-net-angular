# Global Search Phase 4a — Backend Implementation Notes

**By:** Bowser (Backend Developer / DevOps)
**Date:** 2026-08-01

## What

Implemented Phase 4a per `docs/search/architecture.md` (Sections 1, 3, 5, 7) and `docs/search/phases.md`'s "Phase 4a" sub-phase: extended all 5 `ISearchProvider` implementations to match entity-level long-text fields (`Description` for Monster/Minion/Location/Bystander; `Concept`/`Hook`/`Overview`/`Notes` for Mystery) and generate real windowed, highlight-span-annotated `Snippet`/`MatchSpans` for whichever field wins per entity via a new `SearchTokenizer.PickBestMatch` + `SearchSnippetBuilder`. `MatchedSubResourceName` was added to the contract now (per the task's explicit instruction) but is always `null` in this phase's actual behavior — sub-resource matching is Phase 4b. Backend-only; `src/web/` untouched. Files: `Services/Search/SearchSnippetBuilder.cs` (new), `Services/Search/SearchTokenizer.cs`, `Services/Search/ISearchProvider.cs`, all 5 `*SearchProvider.cs`, `Contracts/ApiContracts.cs`/`ApiMappers.cs`. Tests: new `SearchSnippetBuilderTests.cs`, new `SearchProvidersTests.cs` (real-SQLite provider integration tests), extended `SearchTokenizerTests.cs` and `SearchServiceTests.cs`.

## One deviation from the task prompt's literal file attribution (not a behavior deviation)

The task prompt (and `phases.md`) list `ApiMappers.cs` as the place to "extend the excerpt fallback chain" for Mystery (`Hook → Concept` to `Hook → Concept → Overview → Notes`). But `ApiMappers.TruncateExcerpt` only ever truncates an already-resolved `ExcerptSource` string — it has no domain-specific field-selection logic, and never did: Phase 1's original `Hook → Concept` fallback was already computed inside `MysterySearchProvider.SearchAsync`, not `ApiMappers`. Extended the fallback chain in the same place (`MysterySearchProvider`) for consistency with the codebase's existing separation of concerns — `ApiMappers` stays domain-agnostic (mapping/truncation only), providers stay where domain-specific field selection lives. The resulting **behavior** matches the spec exactly (`Hook → Concept → Overview → Notes`, first non-empty wins); only the file differs from the prompt's literal wording. Flagging per the task's own "if you find a genuine conflict... flag it explicitly" instruction, though I'm confident this is the right call given the established pattern.

## Design notes worth remembering

- **`PickBestMatch` tie-break:** first-listed `CandidateField` wins on an exact score tie (the loop only replaces the running best on a strictly-greater score). Deterministic since every provider builds its field list in a fixed order (`Name` always first). Not spec'd explicitly in the docs beyond "deterministic," so this is the concrete rule now in place if it's ever load-bearing.
- **`SearchSnippetBuilder`'s StartsWith/Exact anchor uses an approximated match length** (`sum(token lengths) + (tokenCount - 1)`, i.e. single-space joins) rather than the true raw-query span, because `SearchTokenizer.Tokenize` discards the original whitespace/dash separator characters and `Build`'s signature (per the task spec) only takes `tokens`, not `rawQuery`. This only affects how much trailing context is padded after the match — never match correctness — and is exact for the common single-space-separated-tokens case.
- **Word-boundary trimming mirrors `ApiMappers.TruncateExcerpt`'s existing trailing-edge technique exactly, applied symmetrically to both edges.** One consequence worth knowing: if a raw window cut happens to land precisely at a word boundary that isn't visible *within* the window itself (e.g. the terminating space is the very next character just outside the window), the algorithm still conservatively drops that boundary-adjacent word — same "can't peek outside the substring it's trimming" behavior `TruncateExcerpt` already has for its single edge, not a new asymmetry introduced here.
- **Provider-level EF query shape is unchanged from Phase 1–3** (`AsNoTracking().Select(...).ToListAsync()`, no `.Include()`) — Phase 4a only widened the projected columns (added the long-text fields), consistent with `architecture.md`'s Decision #12 (in-memory matching stays through Phase 4, revisit only past the ~5,000-row/150ms triggers).

## Verification

75/75 tests green (was 39 after Phase 1; +36 net for Phase 4a), `dotnet build` clean with 0 warnings. Manually verified against real Postgres seed data: Name-vs-Description precedence (`?q=stillness`), substring tier genuinely disabled for long text in production data (`?q=hind` → 0 results vs `?q=ind` → boundary match), and general snippet/span correctness across Description/Concept fields. Seed data has no Mystery with empty Hook+Concept currently, so the Overview-fallback path was validated via the new SQLite integration test (`SearchProvidersTests.MysterySearchProvider_ExcerptFallsBackToOverview_WhenHookAndConceptEmpty`) rather than live Postgres.

## If wrong

Revisit with Yoshi (architecture) / Skyler if the excerpt-fallback-chain logic should be physically relocated into `ApiMappers.cs` (e.g. if a future phase wants `ApiMappers` to own more domain-shaped logic than it currently does) — straightforward to move since it's currently just a few `IsNullOrWhiteSpace` checks in `MysterySearchProvider.SearchAsync`.
