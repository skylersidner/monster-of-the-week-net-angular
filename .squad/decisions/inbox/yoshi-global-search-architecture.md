### 2026-08-01: Global Search — Architecture (Phased Plan Written, Not Implemented)
**By:** Yoshi (Architect)
**What:** Designed and documented (in `docs/search/`) a phased global-search feature covering Mysteries, Monsters, Minions, Locations, and Bystanders. Key calls:
- **No persisted search index / no `pg_trgm`/`tsvector` in Phase 1.** Dataset is flat, single-tenant, small — live `ILIKE`-chain queries per token (word-boundary prefix match, split on space/dash) over each domain's own table are fast enough. Swapping to trigram/full-text later is scoped as a change *inside* each `ISearchProvider`, not a contract change.
- **Two endpoints, not one:** `GET /api/search/quick` (top-4 combined, no paging) and `GET /api/search?page=&pageSize=` (paginated, with excerpt + totalCount). Different-enough response shapes that one endpoint with optional params would blur the contract.
- **Extensibility = code-level `ISearchProvider`-per-domain registry with `SearchFieldWeight` tags**, not a persisted `SearchableField` table. Adding Phase 4+ fields (Description/Hook, sub-resource name/description) is additive query changes inside existing providers — no migration/sync machinery.
- **Ranking:** `score = MatchStrength(1-3) * Weight`, tiebreak `Name ASC, EntityType ASC, Id ASC`. Combined top-4 across domains, not 4-per-domain.
- **Frontend:** ARIA APG combobox-with-listbox pattern; single `highlightedIndex` signal is the only source of truth for both keyboard and mouse hover, avoiding desync. New `DomainIconComponent` extracted from `page-layout.html`'s inline SVG `@switch` so the same 5 icons render in the nav, the dropdown, and the results page from one place.
- Excerpt (results page only) is a **fixed per-domain field** (Mystery→Hook, others→Description), not "whichever field matched" — since Phase 1-3 only ever match `Name`, there's nothing else to excerpt from yet. Flagged explicitly as an assumption to confirm before Phase 4 changes what's matched.

**Why:** Matches the brief's instruction not to over-engineer Phase 1 for a scale problem that doesn't exist, while keeping the extensibility seam (`ISearchProvider`) and API contract stable across all future phases — only the matching primitive and provider queries change later, never the ranking model, endpoints, or frontend components.

**Docs:** `docs/search/README.md`, `docs/search/architecture.md`, `docs/search/phases.md`, `docs/search/open-questions.md`.

---

### 2026-08-01 (revision): Substring-Match Tier, Weight Reassignment, and `snippet` Contract
**By:** Yoshi (Architect) — revised per project-owner feedback
**What:**
- Added a 4th (weakest) match tier — unanchored substring (`ILIKE '%token%'`) — below the original 3-tier model, so e.g. "sto" now weakly matches "Ancestor" in addition to strongly matching "Stone"/"The Store". `MatchStrength` is now 1 (substring) – 4 (exact).
- **Scoped the substring tier to `Name`-style fields only** (never long text like Description/Hook/Concept/Overview) — noise (a short substring hits most real prose) and snippet-extraction cost (windowed excerpting needs `ts_headline`-class tooling, not plain `ILIKE`) both argue against extending it to prose. This ships in Phase 1 itself since Phase 1 is titles-only anyway.
- Raised the header dropdown's min query length from 2 to 3 characters — the substring tier makes 2-char tokens too noisy.
- Reassigned `SearchFieldWeight`: sub-resource `Name` (Attack/Power/Armor/Weakness) moved from `Tertiary`→`Secondary`, and entity long-text fields (Description/Hook/Concept) moved from `Secondary`→`Tertiary`, per owner request. This conveniently makes "gets the substring tier" and "is Primary/Secondary weight" the same rule.
- Added `snippet: string | null` to `SearchResultDetailResponse` **now** (Phase 1), always `null` until Phase 4 populates it from whichever field/sub-resource actually matched — avoids a breaking contract change later. Frontend renders `snippet ?? excerpt` starting Phase 3, dead-branch until Phase 4.

**Why:** All of the owner's feedback was architecturally sound and implemented as requested; no pushback needed. The one place I extended their ask rather than just complying: reassigning long-text fields to `Tertiary` (they only explicitly asked to bump sub-resource names up) — chosen because it produces a single clean rule (Primary/Secondary = name-like = gets substring tier; Tertiary = prose = doesn't) rather than two independently-tracked concerns.

**Docs updated:** `docs/search/architecture.md`, `docs/search/phases.md`, `docs/search/open-questions.md` (rows 3, 6, 11, 12, 13).

---

### 2026-08-01 (Phase 4 spec): Long Text + Sub-Resource Matching, Real Snippets, Highlighting, Field Labels
**By:** Yoshi (Architect) — Phase 4 fully specced after Phases 1–3 shipped, per new project-owner requirement
**What:**
- **Corrected a load-bearing doc/code gap first**: Phase 1 shipped in-memory tier matching (full `.Select()` into memory, C# string comparisons) instead of the originally-documented `EF.Functions.ILike`, deliberately, for SQLite test portability (`.squad/decisions/inbox/bowser-search-phase1-backend.md`). Confirmed this still holds for Phase 4's heavier per-request fetch (adds Monster/Minion sub-resource collections via nested `.Select()` projections, never `.Include()`) and set an explicit numeric revisit trigger (~5,000 rows/request or ~150ms p95) instead of leaving it a vague "later."
- **New match tiers unlocked**: all 4 Mystery long-text fields (Concept/Hook/Overview/Notes, not just Hook/Concept), Description for Monster/Minion/Location/Bystander, and Monster/Minion Attack/Power/Armor/Weakness Name+Description — using the `Secondary`(sub-resource Name)/`Tertiary`(all long text) weighting already decided in the prior revision. `CustomMove` sub-resources explicitly excluded (not requested, matches how custom moves are treated elsewhere as an incomplete feature).
- **Snippet generation, finally concrete**: `SearchSnippetBuilder`, 70-char window each side of the matched position (sized to match the existing 160-char excerpt's visual footprint), anchor = start-of-field for starts-with/exact tiers, earliest token occurrence for boundary-prefix/substring tiers, word-boundary trimming + ellipsis at both cut edges.
- **Highlight encoding**: backend returns plain-text `snippet` + structured `matchSpans` (offset/length), frontend builds `{text, isMatch}` segments and renders `<mark>` in the template — explicitly rejected embedding `<mark>`/markup in the API response + `[innerHTML]` (depends on Angular's sanitizer allowlist, puts presentation concerns in the API contract, which nothing else in this codebase does).
- **Multi-span within one window only**: one anchor centers the snippet; every token occurrence *inside* that window gets highlighted; tokens matching far outside the window aren't shown/highlighted — deliberately not building multi-window snippets (real complexity, low value).
- **`MatchedField` extended with a dot convention** (`"Attack.Name"` etc.) + new `MatchedSubResourceName` field, rather than a parallel taxonomy — per the owner's own suggested direction. No label chip for `Name` matches (redundant with the title).
- **Confirmed, not re-decided**: dedup keeps collapsing multi-field matches to one result (highest score wins, no "matched on N fields" UI); header dropdown stays completely unchanged (product owner's own wording scoped the new requirement to "full-results-page row" — not ambiguous).
- Phase split: 4a (entity long-text backend), 4b (sub-resource backend), 4c (frontend highlighting) — each independently shippable, 4a/4b are strict improvements even before 4c lands (real snippet text, just unhighlighted).

**Why:** Same principle as the prior revision — ship exactly what's requested, but ground every judgment call in the actual shipped code (not the original aspirational doc) and make implicit assumptions (dedup behavior, dropdown scope) explicit confirmations rather than silent carryovers.

**Docs updated:** `docs/search/architecture.md` (Sections 1, 2, 3, 5, 6, 7 revised to match shipped code + Phase 4 design), `docs/search/phases.md` (Phase 4+ placeholder replaced with 4a/4b/4c, Decisions table extended to #19), `docs/search/open-questions.md` (rows 14–21 added), `docs/search/README.md` (phase summary updated).
