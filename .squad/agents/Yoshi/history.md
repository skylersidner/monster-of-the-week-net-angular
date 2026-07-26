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
