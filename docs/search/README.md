# Global Search

Design docs for turning the header's currently-disabled "Search (coming soon)" input into a live global search across Mysteries, Monsters, Minions, Locations, and Bystanders, plus a full paginated results page.

- **`architecture.md`** — the design itself: backend search strategy and why it doesn't need `pg_trgm`/`tsvector` or a persisted index yet, the tokenization/matching rule, the `ISearchProvider`/`SearchableField`-weight extensibility seam, ranking, the API contract, and the frontend combobox/results-page design (ARIA combobox pattern).
- **`phases.md`** — the phased implementation plan in this repo's standard phase-doc format: resolved decisions, the two real Option A/B architectural forks, sub-phases with file-level detail, files-affected summary, known gaps, and a verification checklist.
- **`open-questions.md`** — the defaults picked (debounce, min query length, excerpt length, pagination size, etc.) that should be confirmed or overridden, plus pointers to the two forks that got full Option A/B treatment in `phases.md` rather than a unilateral pick.

## Phase summary

1. **Backend search endpoints (names only)** — `GET /api/search/quick` (top 4, dropdown) and `GET /api/search` (paginated, results page), both backed by a per-domain `ISearchProvider` fan-out over `Name` only.
2. **Header search dropdown UI** — wires the existing header input to `/api/search/quick` via a full ARIA combobox (keyboard + mouse, single `highlightedIndex` source of truth).
3. **Full search results page** — `/search?q=` route, paginated, with excerpts and the existing list-view tag-badge styling.
4. **Extend matching to long text and sub-resource fields** (future work, not fully specced) — broaden `ISearchProvider`s to match `Description`/`Hook`/`Concept` and Attack/Power/Armor/Weakness name+description, without touching the ranking model, endpoints, or frontend built in Phases 1–3.

No application code has been written or modified as part of producing these docs — this is planning only.
