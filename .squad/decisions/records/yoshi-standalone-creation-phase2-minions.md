# Standalone Creation Phase 2 (Minions) — Architecture Decisions

**By:** Yoshi (Architect)
**Date:** 2026-08-05

**What:**
- **No backend work needed.** `POST /api/monsters/{monsterId}/minions` already requires and validates a real `monsterId` — exactly the shape a required-attachment create flow needs. Unlike Monster (which needed a new mysteryless endpoint because its attachment was optional), Minion's attachment is mandatory (`Minion.MonsterId` is a non-nullable FK, confirmed at the entity, migration, and service-validation layers), so there's no analog to Phase 1's `createStandalone()` gap.
- Shared `MinionFormComponent` (`features/minions/shared/minion-form/`), extracted from `minion-detail.ts`, mirroring `MonsterFormComponent`'s shape exactly (4 core fields, own `FormGroup`, single `save` emit). `monsterId` stays entirely outside it — not just a create-only concern (Monster's reasoning) but because `UpsertMinionRequest` has no `monsterId` field at all; there's no code path where the component could meaningfully hold one.
- One `MinionCreateComponent`, registered at two routes (`/minions/new` with a required monster dropdown, `/monsters/:monsterId/minions/new` with the monster locked from the route param) — reusing the exact param-presence-driven pattern `minion-detail.ts` already uses for `mysteryId`/`monsterId` context, not new machinery.
- Sub-resource authoring: local draft arrays + single batched submit, inherited unmodified from Phase 1's now-established, Skyler-approved pattern — not re-derived, since nothing about Minion's required-parent constraint touches the "children don't exist until the parent does" reasoning that decided it for Monster.
- `MinionFormComponent` wired into `minion-detail.ts` in this same phase (not left as a question) — Skyler's explicit Phase 1 precedent for the identical shape of decision, re-applied rather than re-asked.

**Why:**
- Always re-verify a shipped phase's doc against the actual committed code before treating it as a template — Phase 1's sub-resource design changed materially between an early pass and its final shipped form (local drafts, not core-fields-only), and the coordinator's summary of "what shipped" needed independent confirmation (which it got: read `monster-create.ts`, `monster-form.ts`, `monster-detail.ts`, `monsters.routes.ts` directly, all matched).
- The central product question this phase surfaces (entry point) is a genuine fork, not a repeat of Phase 1's mystery-scoping question, because the underlying constraint is opposite in kind: Monster's parent attachment is optional (M:N, defaults blank), Minion's is mandatory (1:N, no blank state exists) — this changes which entry-point shapes are even coherent (a *required* dropdown over every monster in the system is a meaningfully worse experience than an *optional* one, which is why the monster-scoped entry point matters more here than the top-level one did relatively for Monster).
- Separated the entry-point *mechanism* (architecture call: one component, two routes, param-driven — decided) from the entry-point *scope* (product call: which route(s) actually ship — left open) explicitly, so the open question doesn't block or gate the underlying component design.

**Open question left to Skyler:** which entry point(s) ship — top-level `/minions/new` only, monster-detail-scoped only, or both (my recommendation: both; if forced to cut one, cut the top-level dropdown-only option, not the monster-scoped one).

**Docs:** `docs/updates/standalone-creation-phase2-minions.md`.
