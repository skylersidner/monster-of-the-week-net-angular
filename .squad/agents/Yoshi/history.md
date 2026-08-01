## Learnings

### 2026-07-26 — Tailwind v4 Architectural Phasing

- Angular's emulated encapsulation shields component styles from Tailwind preflight — import full Tailwind immediately, coexistence is safe
- Phasing order: infrastructure → global → layout shell → shared components → simple detail pages → list pages → medium pages → wizard last
- Phase 2 (shell layout) is highest risk — should run in a feature branch
- Phase 7 (mystery wizard) is highest functional risk — test in a feature branch
- `custom-select.component.scss`: `@apply` is correct choice over Tailwind `group` modifier (avoids template restructuring for an already-programmatic widget)
- Tailwind v4 uses `oklch()` for colors in DevTools; `@theme` override pins hex for clarity
- Component style budget should only be tightened after Phase 7 is fully complete

### Phase 8 Planning — Minions UI Flow (2026-07-25)

- **No flat list API endpoint**: `GET /api/minions` does not exist. Only `GET /api/monsters/{monsterId}/minions` is available. Any top-level Minions list view requires adding a new API endpoint — this is the primary architectural fork (Option A vs B).
- **MinionService update gap**: The Angular `MinionService` is missing 5 update methods (`updateAttack`, `removeAttackWeaponTag`, `updatePower`, `updateArmor`, `updateWeakness`) despite the corresponding PUT endpoints existing on `MinionsController`. These must be added regardless of navigation option chosen.
- **Two navigation options**: Option A (top-level `/minions` flat list, new API endpoint) vs Option B (minions embedded in monster detail, no new API endpoint). Option B is architecturally honest; Option A has better UX if cross-monster browsing is needed. Deferred to Skyler to decide.
- **Custom moves ambiguity**: `MinionDetailResponse` includes a `customMoves` field but `MinionsController` has no create/edit endpoints for minion custom moves. Plan defers these to a future phase and renders the field read-only.
- **Pattern to follow**: `features/monsters/` — signal-based state, `forkJoin` for detail load, reactive forms, 5 sub-resource panels (attacks with weapon tags, powers, armors, weaknesses, custom moves). Minions omit mysteries section and add `harmCapacity` as a form field.
- **Key file paths**: `src/web/monster-of-the-week-web/src/app/core/minion.ts` (service), `src/web/monster-of-the-week-web/src/app/app.routes.ts` (route registration), new feature at `src/web/.../features/minions/`.

### Global Search Planning (2026-08-01)

- **Dataset is small/flat/single-tenant**: 5 domains, no auth/campaign scoping, realistically tens-to-hundreds of rows each. This ruled out `pg_trgm`/`tsvector`/persisted index tables for Phase 1 — plain `ILIKE` chains per token beat any indexed alternative on cost/benefit at this scale. Revisit only if row counts or query volume grow materially.
- **Word-boundary prefix match without a token column**: `ILIKE 'token%' OR ILIKE '% token%' OR ILIKE '%-token%'` per query token (AND across tokens) gives "prefix of any word, split on space/dash" semantics fully inside EF Core's LINQ→SQL translation — no raw SQL/regex needed. Reusable pattern for any future "match at word boundaries" requirement in this codebase.
- **Extensibility without a schema**: `ISearchProvider`-per-domain + code-level weight tags (not a persisted `SearchableField` table) is the right call whenever "make X configurable later" doesn't yet have a real scale/ops reason to warrant persisted state — a compile-time registry is strictly simpler and driftless. Only reach for the persisted-table version alongside a real full-text-search migration.
- **Icon reuse pattern**: `page-layout.html`'s nav icons are inline `@switch` SVGs with no shared component — any new UI needing the same 5 domain icons (search dropdown, results page, likely future features) should extract to a `DomainIconComponent` rather than re-copy path data a 3rd/4th time.
- **Route precedent confirmed**: all 5 domain detail routes are flat/top-level (`/mysteries/:id`, `/monsters/:monsterId`, `/minions/:minionId`, `/locations/:locationId`, `/bystanders/:bystanderId`) — useful lookup table for any future cross-domain linking feature.
- **Docs**: `docs/search/README.md`, `architecture.md`, `phases.md`, `open-questions.md`.

### Global Search — Matching Design Revision (2026-08-01, same day as initial plan)

- Owner feedback pattern worth remembering: when a stakeholder floats "maybe X only applies to titles, not sure about long text" as their own tentative idea, the right architect move is confirming it with concrete reasoning (noise + snippet-extraction cost, not just "sounds right") rather than either rubber-stamping or overriding — then extend it into a clean rule if one falls out naturally (here: substring-tier scope = weight-tier scope, once sub-resource names were promoted to Secondary and prose fields correspondingly demoted to Tertiary).
- When a response contract will predictably need a new field in a later phase (here: `snippet` for "what actually matched"), add it now as always-null/optional rather than deferring — cost of adding early is ~zero, cost of adding after the frontend ships against the narrower shape is a real component rework.
- `ILIKE '%token%'` (unanchored) vs `ILIKE 'token%'` (prefix): prefix can use a btree index later (`text_pattern_ops`); unanchored substring never can, under any collation — pg_trgm is the only indexed path for substring/fuzzy matching in Postgres. Worth remembering any time "search" or "contains" comes up again in this codebase.
