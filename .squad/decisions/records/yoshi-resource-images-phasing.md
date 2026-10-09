### 2026-09-26: Resource Images — Phasing Pass (`docs/resource-images/phases.md`)

**By:** Yoshi (Architect)

**What:** Phased implementation plan breaking `docs/resource-images/design.md` (Rosalina, settled) into
8 backend/frontend phases with dependencies, for Bowser/Luigi to review before implementation. No app
code written. Full detail in `docs/resource-images/phases.md`.

**The one finding worth citing if this doc is never read in full:** Rosalina's design fully specs six
new nested per-resource image endpoints (§3) but never touches the four *existing* list endpoints
(`GET /api/monsters` etc.), and `design.md` §4.2 still has list rows rendering a thumbnail. Checked
`ApiContracts.cs` directly — `MonsterListItemResponse`/`MinionListItemResponse`/
`LocationListItemResponse`/`BystanderListItemResponse` carry nothing that identifies an image. Without a
fix this is an N+1 per list row. Fix: extend the four list-item response contracts with
`PrimaryImageId: Guid?`, sourced from the owning entity's own column — filed as its own phase (Phase 4)
since it's independent of the nested-endpoint work (Phase 3) and blocks list-page frontend wiring
(Phase 7). **This is the one decision Bowser/Luigi should confirm before Phase 5 (frontend shared
components) locks in `app-resource-thumbnail`'s input contract** — a naming mismatch here reaches
backward into already-built frontend work.

**Other concrete mechanism calls made (not re-litigating Rosalina's settled decisions, filling gaps she
correctly left to Bowser/architecture):**
- `Monster.PrimaryImageId`/etc. are real, enforceable FKs into `ResourceImage.Id` (unlike `OwnerId`,
  which can't FK to four tables) — configure `DeleteBehavior.SetNull` and Rosalina's "deleting the
  primary falls back automatically" behavior (§1.2) is a DB-level guarantee, zero app-side special case.
- `ResourceImage.Id` follows the default-generated-key convention (`Monster`, `MonsterAttack`), not the
  `ValueGeneratedNever()` convention (`Playbook`, `Hunter*`) — it's written via a dedicated upload
  endpoint's `DbSet.Add()`, never attached through an already-tracked parent graph. Getting this backward
  reproduces the exact `DbUpdateConcurrencyException` failure mode `MotwDbContext.cs`'s own comment
  documents for the other family.
- Composite index on `(OwnerType, OwnerId)` on `ResourceImage` — every cap-check/list/primary-derivation
  query filters on this pair; absent from `design.md`'s data model (§1.1).
- Controllers take `IResourceImageService` as a second constructor dependency (direct, not threaded
  through `IMonsterService` et al.) — matches every existing controller's one-domain-service-per-action
  shape plus `design.md` §3's own "thin wrapper" framing.
- Owner-existence validation (§1.1's "validated at the service layer") lives inside
  `IResourceImageService` itself via a switch on `OwnerType` against `MotwDbContext` — it already needs
  the context for the cap-check and the write, so this doesn't add a dependency.

**Risks flagged, not resolved (Bowser/Luigi's calls):** multipart upload handling is entirely new
infrastructure for this app (grepped — zero `IFormFile`/`FormOptions` usage anywhere), sized only by
inherited Kestrel/ASP.NET defaults today, untested against Railway's edge; the cap-check +
`SortOrder`-assignment race has no transaction/unique-constraint backing (recommended: accept as
low-severity given single-realistic-actor usage, but as a stated accept, not a silent gap); ImageSharp's
Six Labors Split License vs. SkiaSharp (MIT) as an alternative for thumbnail generation, given this is a
new dependency + Linux (Railway) deployment target.

**Filed to `records/` directly per `.squad/decisions/README.md`'s current convention** (the
`decisions/inbox/` path referenced in some generic instructions does not exist in this repo — `records/`
is where agents write, and promotion to the index is a separate, deliberate act this record is not
claiming).
