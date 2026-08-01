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
