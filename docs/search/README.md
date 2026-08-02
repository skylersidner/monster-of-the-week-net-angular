# Global Search

Design docs for turning the header's currently-disabled "Search (coming soon)" input into a live global search across Mysteries, Monsters, Minions, Locations, and Bystanders, plus a full paginated results page.

**Status: Phases 1–3 shipped and committed.** Phase 4 (long text + sub-resource matching, real highlighted snippets, field/sub-resource labels) is fully specced below, pending product-owner review before implementation.

- **`architecture.md`** — the design itself: backend search strategy (including the in-memory-matching deviation from the original `EF.Functions.ILike` plan, and why it still holds through Phase 4), the tokenization/matching rule, the `ISearchProvider`/`SearchableField`-weight extensibility seam, ranking, the API contract, the frontend combobox/results-page design (ARIA combobox pattern), and the Phase 4 snippet/highlight/dynamic-result-view design.
- **`phases.md`** — the phased implementation plan in this repo's standard phase-doc format: resolved decisions (now 19, spanning both rounds of revision), the real Option A/B architectural forks, sub-phases with file-level detail (Phases 1–3 marked shipped; 4a/4b/4c fully specced), files-affected summary, known gaps, and a verification checklist.
- **`open-questions.md`** — the defaults picked (debounce, min query length, excerpt length, pagination size, snippet window size, highlight encoding, etc.) that should be confirmed or overridden, plus pointers to the two forks that got full Option A/B treatment in `phases.md` rather than a unilateral pick.

## Phase summary

1. **Backend search endpoints (names only)** — *Shipped.* `GET /api/search/quick` (top 4, dropdown) and `GET /api/search` (paginated, results page), both backed by a per-domain `ISearchProvider` fan-out over `Name` only.
2. **Header search dropdown UI** — *Shipped.* Wires the existing header input to `/api/search/quick` via a full ARIA combobox (keyboard + mouse, single `highlightedIndex` source of truth). Unaffected by Phase 4.
3. **Full search results page** — *Shipped.* `/search?q=` route, paginated, with excerpts and the existing list-view tag-badge styling.
4. **Extend matching to long text and sub-resource fields, with real highlighted snippets** — *Fully specced, not yet implemented.* Split into three sub-phases:
   - **4a — Backend: entity long-text fields.** Monster/Minion/Location/Bystander `Description`, and all four Mystery long-text fields (`Concept`/`Hook`/`Overview`/`Notes`) become searchable (`Tertiary` weight, tiers 2–4), with real windowed/highlight-annotated snippets generated via a new `SearchSnippetBuilder`.
   - **4b — Backend: sub-resource fields.** Monster/Minion `Attack`/`Power`/`Armor`/`Weakness` `Name` (`Secondary` weight, all 4 tiers) and `Description` (`Tertiary`, tiers 2–4) become searchable, routed to the parent entity.
   - **4c — Frontend: snippet highlighting + field label.** Results page renders highlighted matched substrings (`<mark>`, built from structured offsets — no markup in the API response) and a "Matched in: ..." label per row. The header dropdown is explicitly unchanged.

No application code has been written or modified as part of producing these docs — this is planning only.
