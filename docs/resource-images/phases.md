# Resource Images — Phased Implementation Plan

**Prepared by:** Yoshi (Architect)
**Input:** `docs/resource-images/design.md` (Rosalina, finalized/Skyler-approved). This document does not
re-litigate that design's settled calls (single `ResourceImage` table, `bytea` storage, nullable
`PrimaryImageId`, 10×2MB cap, JPG/PNG/WebP, no Mystery Wizard integration). It breaks the design into
implementable phases, names what blocks what, and surfaces the structural gaps a phasing pass is
supposed to catch before Bowser and Luigi start building.
**Status:** Not started. For Bowser (backend) and Luigi (frontend) review before implementation begins.
**Revised 2026-10-03:** Thumbnail fetch strategy, primary-image lifecycle, and the §3.2/§3.3 decisions were
revisited in `docs/resource-images/thumbnail-and-primary-workflow.md`. Where this document changed, the
affected section says so and points there. Summary of changes: index now includes `SortOrder`; `Cache-Control`
on image responses is `private`; Phase 4 is rewritten (the list must resolve the derived primary, not pass
through a null column); the primary-delete path is auto-promote, with no restriction and no primary write on
delete; §3.2 is deferred to post-deploy and §3.3 is accepted.
**Git workflow and per-phase gate:** see the two sections immediately below the header. One commit per
completed phase on a single feature branch; each commit must pass its gate before the next phase starts.
**Revised 2026-10-04 (Bowser's review):** Bowser's backend review (`docs/resource-images/reviews/bowser.md`) is folded in
throughout Phases 1–4: the thumbnail-library open item is decided (SkiaSharp, §1 item 6); an owner-delete
orphaned-image-bytes gap, a decompression-bomb guard, index-naming/FK-index corrections, a derivation
tie-break, concrete request-size limits, a missing `Program.cs` registration, a correction to which
list-projection sites actually need rework, a dependency fix on Phase 4's agreement test, and a
Postgres-backed test addition are all now part of the phase text below rather than listed separately.
**Revised 2026-10-04 (Skyler — scope cut and phase restructure):** Two decisions from Skyler, on top of
Luigi's frontend review (`docs/resource-images/reviews/luigi.md`):
1. **Scope cut:** by-mystery thumbnail support is removed from Phase 4 entirely. Skyler: "As for the list of
   Mysteries, this can be removed. I'm not anticipating a need for photos related to a mystery specifically,
   just minions, monsters, locations, and bystanders." `GetMonstersByMysteryIdAsync`,
   `LocationService.GetByMysteryAsync`/`GetLocationsByMysteryIdAsync`, and `BystanderService.GetByMysteryAsync`
   no longer carry `PrimaryImageId`. Combined with Skyler's resolution of Minion's `GetByMonsterIdAsync`
   (below), this drops the projection-site count from eight to **four**. See Phase 4 below.
2. **Phase restructure:** Skyler confirmed Luigi's pilot-then-rollout idea and extended it — "this is an
   excellent idea, and I actually think we should add a sub-phase for each domain object, starting with
   Monster as the pilot." Phases 6 and 7 (detail wiring, list wiring) are replaced by four domain sub-phases
   under Phase 6 (Monster, then Minion, then Bystander, then Location), each wiring **both** its detail-page
   images section and its list-page thumbnail in one sub-phase, each its own commit and gate. Old Phase 8's
   cross-cutting polish is distributed into each domain sub-phase (that domain's own copy/footnote
   correctness) plus a small final Phase 7 for anything genuinely still cross-cutting afterward. See §2 Phase
   6 below.
3. **Minion's `GetByMonsterIdAsync` resolved:** Skyler, verbatim: "Minion image on monster view: out of
   scope for this pass." The nested Minions list inside `monster-detail` does not get
   `PrimaryImageId`/thumbnail support in this pass. This was the one open projection-site question; it is
   now resolved "no," settling the projection-site count at four (the main `GetAllAsync` for each of
   Monster, Minion, Location, Bystander).

---

## Git workflow

Decided by Skyler, 2026-10-03: "I want to commit after each phase on the current branch and I'll review the state
of things before manually merging the branch into main."

- **One commit per completed phase, all on a single feature branch.** After the 2026-10-04 restructure (§2
  Phase 6) that is: Phases 1, 2, 3, 4, 5, 6a (Monster), 6b (Minion), 6c (Bystander), 6d (Location), and 7 —
  ten commits, not eight.
- **Skyler reviews the branch and merges to `main` manually.** There is no intermediate merge or PR checkpoint
  between the backend phases (1–4) and the frontend phases (5, 6a–6d, 7).
- **Branch requirement:** Phase 1 must not start on `main`. A feature branch has to exist before Phase 1 begins.
  This document does not create it. The branch name is open (§4, item 1).
- Commits land in order: 1, 2, 3, 4, 5, 6a, 6b, 6c, 6d, 7. Phases that can run in parallel (for example 5 with
  1–4) may be worked concurrently, but their commits follow this order so each gate runs against the state
  the previous commit left.

## Per-phase verification gate

Each phase's commit must pass the gate below before the next phase starts. The phase's own verification list
still applies in addition.

- **Backend phases (1–4):** `dotnet build` and `dotnet test` green. Phase 1 also requires
  `dotnet ef migrations has-pending-model-changes` to return clean and a migration that applies to a fresh
  local Postgres.
- **Frontend phases (5, 6a–6d, 7):** `npm run build` and `npm run test -- --watch=false` green, plus a relevant UI check:
  - Phase 5: each new component rendered in isolation (scratch route or test harness).
  - Phases 6a–6d: that domain's detail page *and* list page exercised on the dev server (Playwright
    self-check against the real dev server), plus that domain's copy/footnote correctness.
  - Phase 7: whatever cross-cutting check remains (see Phase 7 below) exercised across all four resource types.

---

## Gate — review focus before implementation starts

| Reviewer | Focus |
|---|---|
| **Bowser** (Backend) | §1 (new architectural calls this pass makes, all backend), Phases 1–4 below, and the risks in §3 items 1, 2, 3, 5, 6, 7 (and the two backend-only additions, §3.6–§3.7) |
| **Luigi** (Frontend) | Phase 5, Phase 6 (sub-phases 6a–6d), and Phase 7 below, and the risks in §3 items 1 (client half) and 4 |

---

## 1. New architectural calls this pass makes

Rosalina's design is settled at the product/UX/data-model level (§0–§9 of `design.md`). It deliberately
left several backend-mechanics questions to "Bowser's call" or left them unaddressed because they're
below a designer's altitude. Phasing this out surfaced concrete answers for most of them — stated here
as recommendations, not re-opened decisions, so Bowser can confirm or override in one pass rather than
rediscovering each one mid-implementation.

| # | Question `design.md` left open | Recommendation |
|---|---|---|
| 1 | How does `PrimaryImageId` actually clear itself when the primary image is deleted? (§1.2 describes the *behavior*, not the mechanism.) | `Monster.PrimaryImageId` / `Minion.PrimaryImageId` / `Bystander.PrimaryImageId` / `Location.PrimaryImageId` are each a **real FK** into `ResourceImage.Id` (this one is enforceable — unlike `OwnerId`, a `PrimaryImageId` always points at one specific row, not one of four possible tables). Configure each with `.OnDelete(DeleteBehavior.SetNull)`. This gives §1.2's described behavior for free at the database level — no app-side "if this was the primary, null it out" code path needed, no risk of forgetting it on one of the four DELETE flows. |
| 2 | Does `ResourceImage` need a DB-level index for the cap-check / list-by-owner query? | Yes — **`HasIndex(e => new { e.OwnerType, e.OwnerId, e.SortOrder })`** (revised 2026-10-03 from the two-column form). Every list read, every cap check (§1.4), and every primary-derivation query filters by owner, and the derivation ("lowest `SortOrder` for this owner") needs to read that owner's rows in order. The third column makes derivation an index seek rather than a sort. Cheap to add at migration time, easy to forget since `design.md`'s data model (§1.1) doesn't mention indexing at all. See `thumbnail-and-primary-workflow.md` §2.4. **Index name and the four FK indexes this implies: see item 10 below.** |
| 3 | Does `ResourceImage.Id` follow the `Guid.NewGuid()`-default-generated convention (`Monster`, `MonsterAttack`, ...) or the `ValueGeneratedNever()` convention (`Playbook`, `BespokeSection`, `Hunter*`)? | **Default-generated**, matching `MonsterAttack`/`MonsterPower`/etc. `MotwDbContext.cs`'s own comment block (around `ConfigurePlaybooks`) explains *why* the two conventions exist: `ValueGeneratedNever()` is only needed for entities added to an **already-tracked parent graph** via an upsert-the-graph endpoint (Playbook, Hunter sub-picks). `ResourceImage` rows are created by a dedicated upload endpoint writing directly via `DbSet<ResourceImage>.Add(...)`, never attached through a parent's navigation — same shape as `MonsterAttack`, not `PlaybookMove`. Getting this backwards produces exactly the `DbUpdateConcurrencyException` failure mode that comment documents. |
| 4 | Where does the "owner must exist and be the type it claims to be" check (§1.1) actually run, given `IResourceImageService` is shared across four domains? | Inside `IResourceImageService` itself, via a `switch` on `OwnerType` that queries the right `DbSet` (`Monsters`/`Minions`/`Bystanders`/`Locations`) for `AnyAsync(x => x.Id == ownerId)`. The service already needs `MotwDbContext` for the cap-check and the write, so this doesn't add a new dependency — it keeps validation in the one place `design.md` §1.3 already says validation belongs, rather than splitting it across four controllers pre-checking existence through their own `IMonsterService`-style dependency before calling in. |
| 5 | Do the four controllers depend on `IResourceImageService` directly, or does it get threaded through `IMonsterService`/`IMinionService`/etc.? | **Directly.** Every existing controller (`MonstersController(IMonsterService monsterService)`, etc.) takes exactly one domain service today; adding `IResourceImageService imageService` as a second constructor parameter is a small, visible, additive change and matches `design.md` §3's own framing ("thin wrappers that pass `OwnerType`/`OwnerId` through"). Threading it through each domain service instead would mean `MonsterService` calling into `IResourceImageService` on the image endpoints and its own repository on every other endpoint — two different plumbing styles in one class for no benefit. |
| 6 | Thumbnail library — **decided (Skyler, 2026-10-03).** | **`SkiaSharp`, paired with [`SkiaSharp.NativeAssets.Linux`](https://www.nuget.org/packages/SkiaSharp.NativeAssets.Linux/) for the Linux container target.** This replaces the earlier "Bowser's call, ImageSharp vs SkiaSharp" open item — Skyler: "It sounds like we will just need the NativeAssets library for SkiaSharp to work in a linux box," choosing SkiaSharp (MIT) over ImageSharp (Six Labors Split License) and sidestepping the license question entirely rather than resolving it. `SkiaSharp` alone resolves native assets per-RID via its own dependency graph, which is normally enough, but this app's `Dockerfile` publishes for Linux from a Windows dev box, so the explicit `SkiaSharp.NativeAssets.Linux` package is needed to guarantee the Linux-specific native library is actually restored and published, not just the one implied by the dev machine's own RID. **A Linux-container smoke test (build the image, exercise one real upload against the running container) is still worth doing even with the native-assets package explicitly referenced** — a missing or mismatched native library is a runtime `DllNotFoundException` on first use, not a build-time failure, which is exactly the failure mode this package exists to prevent and exactly the kind of thing that looks fine in `dotnet build`/`dotnet test` on Windows and only fails in the deployed container. Use `Image.Identify` / `SKBitmap.DecodeBounds` (whichever `SkiaSharp` exposes for a header-only read) for both the stored `Width`/`Height` and the decompression-bomb guard in item 8 below — one decode-adjacent read, not two. |
| 7 | Decompression-bomb guard — **new, not in `design.md` at all. Flagged in Bowser's review.** | A 2 MB PNG or WebP can declare an enormous canvas (for example 16,000×16,000), which decodes to well over 1 GB in memory even though the file itself is under the cap. The magic-byte check in §7.1 only confirms the container format; it says nothing about the declared dimensions. Phase 2 must read dimensions from the header (see item 6) **before** any full decode and reject above a stated cap — recommend 4096×4096, comfortably above the fixed 1024×1024 the design expects from `fal-image-gen`, with real headroom for a manually-sourced image, but nowhere near "declared size, no limit." This needs its own rejection reason, since it doesn't fit `UnsupportedType`/`TooLarge`/`CapExceeded` from `design.md` §3 — add `UnreadableOrOversizedDimensions` (exact name negotiable) to that enum and to §7's copy table. |
| 8 | Multipart/file-upload request handling — does anything in this app already do this? | **No.** Grepped the whole API project: no `IFormFile`, no `[FromForm]`, no `MultipartBodyLengthLimit`, no `FormOptions` configuration anywhere. This is a genuinely new request-handling pattern for this codebase, not an extension of an existing one — see §3.2 below. Decided concretely (Bowser's review): `[RequestSizeLimit(24 * 1024 * 1024)]` and `[RequestFormLimits(MultipartBodyLengthLimit = 24 * 1024 * 1024)]` on the upload action (10 files × 2 MiB = 20 MiB, plus headroom for multipart overhead), a 2 MiB (2,097,152-byte) per-file cap enforced server-side, and the client capping each POST at 10 files so a large drop is chunked into sequential requests rather than tripping a framework-level 413 before the per-file `{ uploaded, rejected }` logic ever runs. |
| 9 | Owner-delete leaves orphaned image bytes — **new, not addressed anywhere in `design.md` or the original phasing pass. Flagged in Bowser's review as the highest-priority gap.** | `ResourceImage` has no FK to its owner (§1.3's accepted tradeoff), so deleting a Monster, Minion, Bystander, or Location does nothing to that owner's `resource_images` rows — they become permanently unreachable but still occupy `bytea` storage. This is worse than it looks for Monsters specifically: deleting a Monster already cascades to its Minions **at the database level** (`Minion.MonsterId` is `OnDelete(Cascade)`), so a Monster delete silently orphans its Minions' images too, through a path that runs no application code at all. None of the four existing delete flows (`MonsterRepository.DeleteMonsterAsync`, the Minion/Location/Bystander equivalents, all `ExecuteDeleteAsync`) know `ResourceImage` exists. Fixed in Phase 3's work list below. |
| 10 | Index naming and the four FK indexes — **correction to item 2 above. Flagged in Bowser's review.** | Phases §1 item 2's `HasIndex(...)` has no explicit name, but every other index in `MotwDbContext.cs` is named `idx_<table>_<columns>` (`idx_minions_monster_id`, `idx_hunters_playbook_id`, …). Name it `idx_resource_images_owner_sort`. Separately, Postgres does not index a referencing column automatically, and this codebase indexes every FK column by convention — add `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`, `idx_bystanders_primary_image_id`, `idx_locations_primary_image_id` on the four new `PrimaryImageId` columns; `SetNull` on an image delete scans these otherwise. |
| 11 | `OwnerType` as a string-backed enum — is this an existing convention? **Correction. Flagged in Bowser's review.** | **No — it would be new.** Phase 1's original text said storing `OwnerType` as a string-backed enum matches "how this codebase already prefers explicit string/enum discriminators over magic ints elsewhere," but a grep of `MotwDbContext.cs` turns up no `HasConversion` anywhere and no existing enum-typed column. State this plainly as a first-of-its-kind decision rather than precedent: `.HasConversion<string>()` with `.HasMaxLength(16)` is still the right call (readable raw SQL, no magic ints), just a new one, not an inherited one. |
| 12 | `ResourceImage.CreatedAt` — does `ApplyTimestamps()` set it? **Correction. Flagged in Bowser's review.** | **No.** `MotwDbContext.ApplyTimestamps()` only iterates `ChangeTracker.Entries<ITimestamped>()`, and `design.md` §1.1 deliberately does not give `ResourceImage` an `UpdatedAt` (images are immutable; delete-and-re-upload replaces them), so it correctly does not implement `ITimestamped`. That means `CreatedAt` is **never** set automatically — `IResourceImageService` must set it explicitly when constructing each row, or every image silently gets `default(DateTimeOffset)`. Add a test asserting `CreatedAt != default`. |

---

## 2. Phase breakdown

### Phase 1 — Schema & Migration (Bowser)

**Goal:** `ResourceImage` table and the four `PrimaryImageId` columns exist, migrated, and match every
existing convention in `MotwDbContext.cs`.

**Work:**
- `Data/Entities/DomainEntities.cs`: new `ResourceImage` entity (§1.1 of `design.md` — `Id`, `OwnerType`
  enum, `OwnerId`, `FileName`, `ContentType`, `SizeBytes`, `Width`, `Height`, `ImageBytes` (`byte[]`),
  `ThumbnailBytes` (`byte[]`), `SortOrder`, `CreatedAt`). `OwnerType` as a string-backed enum column
  (`Monster`/`Minion`/`Bystander`/`Location`) via `.HasConversion<string>().HasMaxLength(16)`. **This is a
  new pattern for this codebase, not an existing one — correction, see §1 item 11.** A grep of
  `MotwDbContext.cs` turns up no `HasConversion` anywhere today; say so plainly in the migration/commit
  rather than describing it as matching precedent. `ResourceImage` does **not** implement `ITimestamped` —
  it has no `UpdatedAt` by design, but that also means `ApplyTimestamps()` will never set its `CreatedAt`
  automatically; `IResourceImageService` (Phase 2) must set it explicitly. See §1 item 12.
- `Monster`/`Minion`/`Bystander`/`Location`: add nullable `PrimaryImageId` (`Guid?`).
- `MotwDbContext.cs`: `DbSet<ResourceImage> ResourceImages`, `OnModelCreating` block for `ResourceImage`
  (snake_case columns, composite index **named `idx_resource_images_owner_sort`** per §1 items 2 and 10
  above — the earlier unnamed `HasIndex(...)` did not match this codebase's `idx_<table>_<columns>`
  convention), and the four `PrimaryImageId` FK configurations per §1 item 1 above
  (`.HasOne<ResourceImage>().WithMany().HasForeignKey(...).OnDelete(DeleteBehavior.SetNull)`, matching the
  `Hunter` → `Playbook` `WithMany()`-with-no-navigation shape). **Also add the four FK indexes** —
  `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`, `idx_bystanders_primary_image_id`,
  `idx_locations_primary_image_id` — per §1 item 10; Postgres does not index a referencing column
  automatically, and every other FK column in this codebase is indexed.
- `dotnet ef migrations add AddResourceImages`, matching the existing naming convention
  (`AddHunterSheetAndPicks`, `AddPickRules`, ...).

**Depends on:** nothing. **Blocks:** Phases 2, 3, 4.

**Verification:** `dotnet ef migrations has-pending-model-changes` returns clean (a stronger, automated
gate than eyeballing the diff); `dotnet build`/`dotnet test` pass; migration applies cleanly starting the
app against an empty `docker compose up -d postgres` database (the repo's existing compose Postgres;
`MotwDbInitializer.InitializeAsync` calls `Database.MigrateAsync()` on every startup, so "applies cleanly"
means the app starts and serves `GET /api/monsters`). **Add a real-Postgres migration test** (env-gated,
see Phase 2's test-strategy note below) that runs `MigrateAsync()` against the compose Postgres — nothing
in the existing SQLite-based suite runs a migration at all, so this is the only thing that actually proves
the migration applies.

---

### Phase 2 — Backend Service Layer (Bowser)

**Goal:** `IResourceImageService` — the single shared service `design.md` §1.3 calls for — fully
implemented and unit-tested, with **no HTTP surface yet**. This is deliberately its own phase: the
validation/cap/primary-derivation logic (§1.2, §1.4, §7) is the highest-value, most reusable, most
test-dense part of this feature, and reviewing it in isolation from routing/multipart concerns is worth
the phase boundary.

**Work:**
- `IResourceImageService`/`ResourceImageService`: owner-existence validation (§1 item 4 above), the
  per-file type/size/magic-byte checks (§7.1 — including the WebP RIFF-container check called out
  explicitly as needing its own code path, not a third literal added to a JPEG/PNG lookup), the
  decompression-bomb dimension guard (§1 item 7 — read dimensions from the header before any full decode,
  reject above 4096×4096 with its own `UnreadableOrOversizedDimensions` rejection reason), the 10-image
  cap with partial-accept behavior (§7.4), `SortOrder` assignment (`current max + 1`, incrementing within
  a batch), thumbnail generation (256×256, JPEG, via `SkiaSharp` per §1 item 6), and primary derivation
  (lowest `SortOrder`, **then lowest `Id` as a tie-break**, when `PrimaryImageId` is null — see the
  derivation-rule note below).
- **Set `CreatedAt` explicitly when constructing each `ResourceImage` row** (§1 item 12). `MotwDbContext.ApplyTimestamps()`
  only iterates `ITimestamped` entries, and `ResourceImage` deliberately isn't one, so nothing sets this
  automatically. Add a test asserting `CreatedAt != default`.
- `IResourceImageService` also exposes `DeleteAllForOwnerAsync(OwnerType, OwnerId, ct)`, used by Phase 3's
  owner-delete cleanup fix (see Phase 3 below) so the four existing domain delete flows don't each
  reimplement the query.
- **The whole batch write is one `SaveChangesAsync()` call.** EF's `SaveChanges`/`SaveChangesAsync` is
  atomic per invocation — this app has no precedent anywhere for explicit
  `BeginTransactionAsync`/`IDbContextTransaction` (grepped, none exists), so the simplest way to keep a
  multi-file batch from landing partially-persisted on a mid-batch exception is to accumulate all
  accepted files' `ResourceImage` entities via `Add()` and call `SaveChangesAsync()` once at the end,
  not once per file.
- Unit tests: every rejection reason (§7.1–§7.5) including the WebP magic-byte case and the
  decompression-bomb dimension case specifically, cap partial-accept math (8 existing + 5 dropped → 2
  accepted/3 rejected), primary derivation (null → lowest `SortOrder` with the `Id` tie-break; explicit
  set; delete-current-primary → falls through to next `SortOrder` via the `SetNull` FK behavior from
  Phase 1), `CreatedAt` set on every created row.

**Depends on:** Phase 1. **Blocks:** Phases 3, 4. **Can run in parallel with:** Phase 5.

- **One derivation rule, stated once** (added 2026-10-03, tie-break added 2026-10-04 per Bowser's review):
  "explicit `PrimaryImageId` if set, else lowest `SortOrder` for the owner, then lowest `Id` as a
  deterministic tie-break." The tie-break matters because §3.3's accepted race can produce duplicate
  `SortOrder` values for the same owner — without it, the service's derivation and Phase 4's list
  projection can pick different rows for the same owner and the agreement test becomes flaky rather than
  reliably green. It lives in `IResourceImageService`. Phase 4's list projection implements the same rule
  (in SQL for Monster/Minion, see Phase 4 below); a test asserts the two agree
  (`thumbnail-and-primary-workflow.md` §2.3).
- **Delete-primary semantics** (decided 2026-10-03, auto-promote): deleting the primary is always allowed.
  After an *explicitly chosen* primary is deleted, the replacement is the first-uploaded remaining image
  (lowest `SortOrder` among the remaining rows, the same rule as derivation), not the neighbour. Skyler:
  "First uploaded image as the next default is good." Test this case explicitly; it is the one that surprises people.
- **Test strategy — correction, Bowser's review.** The test harness uses SQLite (`UseSqlite` across the
  API test project) with `Database.EnsureCreatedAsync()`, which builds the schema from the EF model and
  **never runs a migration** — the `AddPickRules` migration's own comment says as much about its
  Postgres-only data step, and the same gap applies here. Keep SQLite for all Phase 2/3 service and
  controller tests; it is fast and it is this codebase's convention. **Add one opt-in real-Postgres test
  class** (for example `ResourceImagePostgresTests`, tagged `[Trait("Category", "Postgres")]`), run locally
  with `dotnet test --filter "Category=Postgres"` against the repo's existing `docker compose up -d
  postgres`, that: runs the real `MigrateAsync()` path (Phase 1's migration test), confirms `DELETE` on the
  primary image clears `primary_image_id` on Postgres specifically, and confirms the derivation projection
  from Phase 4 returns the same id as `IResourceImageService` for each of the four cases in workflow §2.2.
  No Testcontainers — it needs Docker on Windows and is a new dependency the compose Postgres already
  makes unnecessary. Also add one assertion in the first SetNull test that `PRAGMA foreign_keys` reads 1
  on the SQLite connection, so that test cannot pass vacuously if FK enforcement were ever off.

**Verification:** `dotnet test` green including new `ResourceImageServiceTests`; a delete-the-primary
test confirms the *database* clears `PrimaryImageId` (proving the `SetNull` FK, not app code, did it); the
opt-in `Category=Postgres` suite green when run locally against the compose Postgres. **Do not run
`dotnet test` with `--artifacts-path`** — `PickRuleTable.ApiProjectRoot()`'s upward directory walk fails
~184 unrelated tests under that flag (see Bowser's `.squad` history); run `dotnet test
MonsterOfTheWeek.slnx` plainly.

---

### Phase 3 — Backend API Surface: Nested Endpoints + Multipart Handling (Bowser)

**Goal:** The six endpoints from `design.md` §3, wired onto all four controllers, with multipart request
handling actually configured (not just defaulted into) for the first time in this app.

**Work:**
- `MonstersController`/`MinionsController`/`BystandersController`/`LocationsController`: add
  `GET .../images`, `GET .../images/{imageId}/file`, `GET .../images/{imageId}/thumbnail`,
  `POST .../images`, `DELETE .../images/{imageId}`, `PUT .../images/{imageId}/primary`, per §3. Each
  controller gains `IResourceImageService` as a second constructor dependency (§1 item 5 above).
- **Register `IResourceImageService` in `Program.cs`.** Missing from the plan until this revision —
  add `builder.Services.AddScoped<IResourceImageService, ResourceImageService>();` alongside the other
  `AddScoped<I*Service, *Service>()` registrations. Easy to miss because it's DI wiring rather than a
  controller or migration change, and the app fails at first request (not at build) without it.
- `POST .../images`: `[FromForm] IFormFileCollection files` (or equivalent), returning the
  `{ uploaded, rejected }` shape from §3 — this is a deliberate divergence from the
  `ToActionResult<T>(ServiceResult<T>)` convention every other action in these controllers uses, since
  the response is precise-per-file rather than pass/fail (§3's own stated reasoning). Worth a one-line
  comment in the controller saying so, so a future reader doesn't "fix" it to match the others.
- **Multipart/request-size configuration — new to this codebase, concrete numbers decided (Bowser's
  review).** `[RequestSizeLimit(24 * 1024 * 1024)]` and `[RequestFormLimits(MultipartBodyLengthLimit = 24
  * 1024 * 1024)]` on the `POST .../images` action only (10 files × a 2 MiB / 2,097,152-byte per-file cap =
  20 MiB, plus ~4 MiB headroom for multipart overhead). `RequestSizeLimit` can raise the per-request limit
  above Kestrel's ~28.6 MB (30,000,000-byte) default, which is the one that actually governs here. **This
  leaves a gap the client must close, not the server:** a body over 24 MiB 413s before the controller
  runs at all, so a drop of more files than the 24 MiB ceiling allows never reaches the per-file
  `{ uploaded, rejected }`/`CapExceeded` logic in §7.4 — the frontend (Phase 6) must cap each `POST` at 10
  files and chunk a larger drop into sequential requests; the server still independently enforces the
  10-image cap per owner regardless of what the client sends. See risk §3.2 below for the Railway-side
  (deferred) half of this.
- **Fix the owner-delete orphaned-image-bytes gap (new, highest-priority correction from Bowser's
  review).** `ResourceImage` has no FK to its owner (§1.3's accepted tradeoff), so today's four delete
  flows — `MonsterRepository.DeleteMonsterAsync`, and the Minion/Location/Bystander equivalents, all
  `ExecuteDeleteAsync` — do nothing to that owner's `resource_images` rows, which become permanently
  unreachable but keep occupying `bytea` storage. Worse for Monsters specifically: deleting a Monster
  already cascades to its Minions **at the database level** (`Minion.MonsterId` is `OnDelete(Cascade)`),
  so a Monster delete silently orphans its Minions' images too, through a path that runs no application
  code. Fix: each of the four owner-delete paths must also delete that owner's images — for
  `MonsterService.DeleteAsync`, that means the Monster's own images *and* the images of every Minion it
  owns — using the `IResourceImageService.DeleteAllForOwnerAsync` method from Phase 2, wrapped in **one
  transaction** per delete (`BeginTransactionAsync`/`IDbContextTransaction` — the first explicit
  transaction anywhere in this codebase; call that out plainly in the commit rather than letting it read
  as an unexplained first). Add a test that deletes a Monster with a Minion that has images and asserts
  no `resource_images` rows remain for either.
- `GET .../file` and `GET .../thumbnail`: stream `ImageBytes`/`ThumbnailBytes` with the stored
  `ContentType` and **`Cache-Control: private, max-age=31536000, immutable`** (revised 2026-10-03: these responses sit behind the global authenticated fallback policy, so a shared cache must not
  hold them; see `thumbnail-and-primary-workflow.md` §2.5). Both handlers must also confirm that `imageId`
  belongs to the `{id}` in the URL, returning 404 otherwise.
- `PUT .../images/{imageId}/primary`: 404 if the image does not belong to the owner, or was deleted between
  the client's last read and this request. Do not let that surface as an FK violation.
- `DELETE .../images/{imageId}`: the only write is the row delete. Do **not** add an app-side "if this was
  primary, clear it" branch; the `SetNull` FK does that. Auto-promote is the rule (no restriction on
  deleting the primary) — see `thumbnail-and-primary-workflow.md` §2.8.

**Depends on:** Phase 2. **Blocks:** Phase 6. **Can run in parallel with:** Phase 4, Phase 5.

**Verification:** manual multipart upload via `curl`/Swagger for each of the four resource types,
including a batch that mixes valid/invalid/oversized/over-cap files; `Cache-Control`/`Content-Type`
headers confirmed on both `/file` and `/thumbnail`; a body over 24 MiB returns 413 rather than hanging or
500ing; deleting a Monster with an imaged Minion leaves zero `resource_images` rows for either; `dotnet
test` green for controller-level tests.

---

### Phase 4 — Backend: List-Response Thumbnail Data (Bowser)

**Goal:** Close the gap in §3.1 below — give the four list pages a way to know, per row, whether an
image exists and what to fetch for the thumbnail, without an N+1 request per row.

**Decided (Skyler, 2026-10-03, "Confirmed."):** the list field is `primaryImageId`, and it carries the derived
value (lowest `SortOrder` when the column is null). The list projection computes that derivation at the
projection sites listed below.

**Scope cut (Skyler, 2026-10-04):** "As for the list of Mysteries, this can be removed. I'm not anticipating
a need for photos related to a mystery specifically, just minions, monsters, locations, and bystanders."
The three by-mystery projection variants — `GetMonstersByMysteryIdAsync`,
`LocationService.GetByMysteryAsync`/`GetLocationsByMysteryIdAsync`, and `BystanderService.GetByMysteryAsync`
(or its repository equivalent) — are **out of scope**. They do not get `PrimaryImageId` and need no
derivation work. This also removes them from Phase 6's per-domain list-wiring work below.

**Work (rewritten 2026-10-03; mechanism corrected 2026-10-04 per Bowser's review — see
`thumbnail-and-primary-workflow.md` §1 and §2.3):**
- Add `PrimaryImageId: Guid?` to `MonsterListItemResponse`, `MinionListItemResponse`,
  `LocationListItemResponse`, `BystanderListItemResponse` in `ApiContracts.cs`.
- **The value is the derived primary, not the raw column.** The projection is
  `x.PrimaryImageId ?? (ResourceImages for this owner, ordered by SortOrder then Id, first Id)` — the
  `Id` tie-break (Phase 2's one-derivation-rule note) matters here too, for the same reason: without it,
  this projection and `IResourceImageService`'s derivation can disagree on a tied `SortOrder` and the
  agreement test flakes. A bare pass-through of the nullable column would return `null` for every
  resource whose primary is derived, which is most of them, and the list would show placeholders for
  resources that have images. The earlier "plain column pass-through" wording was wrong and is withdrawn.
- **Four projection sites, not eight (count settled 2026-10-04: three by-mystery sites cut per the scope
  cut above; Minion's `GetByMonsterIdAsync` resolved out of scope, see header revision note).** Checked
  directly against the current code, not assumed:

  | Owner | Sites | How it is projected today |
  |---|---|---|
  | Monster | `MonsterRepository.GetAllAsync` | **SQL** — `.Select(...)` on an `IQueryable` |
  | Minion | `MinionRepository.GetAllAsync` (`GetByMonsterIdAsync` is out of scope — Skyler: "Minion image on monster view: out of scope for this pass") | **SQL** |
  | Location | `LocationService.GetAllAsync` | **In-memory** — `.Select(...)` over `Include`d entities already materialized by `ToListAsync` |
  | Bystander | `BystanderService.GetAllAsync` | **In-memory** |

  `GetMonstersByMysteryIdAsync` (Monster), `GetByMysteryAsync`/`GetLocationsByMysteryIdAsync` (Location), and
  `GetByMysteryAsync` (Bystander) are cut from scope — no `PrimaryImageId`, no derivation work, no rework.

  **Monster and Minion can use the correlated-subquery form directly** (`dbContext.ResourceImages.Where(i
  => i.OwnerType == … && i.OwnerId == x.Id).OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => (Guid?)i.Id).FirstOrDefault()`,
  coalesced with the raw column) — it runs inside the existing SQL projection and EF translates it to a
  correlated subquery (confirm the generated SQL once with EF logging; not yet verified against this EF
  version). **Location and Bystander cannot use that form as written**, because their `.Select(...)` runs
  in memory after the entities are already loaded — a per-row subquery there would mean issuing it
  against an in-memory collection, which doesn't work. Fix either by (a) converting the Location/Bystander
  reads to SQL projections in their repositories, matching Monster/Minion (the cleaner fix, worth its own
  sub-task in this phase), or (b) adding one grouped query per list —
  `ResourceImages.Where(i => i.OwnerType == X).GroupBy(i => i.OwnerId).Select(g => new { OwnerId = g.Key,
  Id = g.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Id).First() })` — and merging the result
  in memory. Either way, **two of the four sites need real rework** — Location's and Bystander's
  `GetAllAsync` — **not a uniform one-line change applied to all of them.**
- Test: for each of the four cases in `thumbnail-and-primary-workflow.md` §2.2, the list's `primaryImageId`
  equals the `isPrimary` image from `GET .../images`. This is the guard against the two implementations
  drifting.
- Do not add `primaryImageId` to the detail responses. The carousel gets primary state from `GET .../images`.
- The additive field is safe for the wizard's catalogue loads and the minion picker, which share these endpoints.

**Depends on:** Phase 1 (needs `PrimaryImageId` columns and the `(OwnerType, OwnerId, SortOrder)` index)
and Phase 2 (the one derivation rule, including its `Id` tie-break, must be settled before this phase
encodes the same rule a second time). **Dependency corrected 2026-10-04:** this phase is a projection in
the repositories and services, not an `IResourceImageService` *call*, but its own verification — the
agreement test against `GET .../images` — needs that rule to already exist somewhere to agree with.
**Run the agreement test against `IResourceImageService`'s derivation directly (Phase 2's output), not
over HTTP** — that keeps this phase's true dependency at Phase 2 rather than incorrectly waiting on
Phase 3's controllers, which the original "independent of Phases 2/3" wording implied but which the
verification step (below) contradicted. **Blocks:** Phase 6 (the list-thumbnail half of each domain
sub-phase needs this phase's field).

**Verification:** `GET /api/monsters`, `/api/minions`, `/api/locations`, `/api/bystanders` return
`primaryImageId: null` for a resource with no images, the explicit id when one is set, and the lowest-
`SortOrder`-then-`Id` image's id when the primary is derived; the by-mystery variants return no such field
(cut from scope, confirm they were not touched); agreement test against `IResourceImageService`'s
derivation passes for all four owner types, including the two (Location, Bystander) that needed the
projection rework above; `dotnet test` green.

---

### Phase 5 — Frontend: Shared Components (Luigi)

**Goal:** `app-image-dropzone`, `app-image-carousel`, `app-resource-thumbnail` (§4 of `design.md`),
plus the two new icons and the primary-indicator token, built and unit-tested against the **contract
shapes** from `design.md` §3 — not against a live backend.

**Work:**
- `shared/image-dropzone.component.ts`, `shared/image-carousel.component.ts`,
  `shared/resource-thumbnail.component.ts` — flat in `shared/`, matching
  `shared/confirm-delete-modal.component.ts`'s existing placement.
- `star` and `chevron` symbols added to `shared/icons/icon-sprite.component.ts`,
  `IconName` extended in `shared/icons/icon.component.ts`, per
  `docs/updates/svg-symbol-icons.md`'s existing two-step recipe (design.md Appendix).
- `--color-image-primary-indicator` token in `styles.css` (§5.2).
- Component-level unit tests (dropzone progress states, carousel keyboard nav/ARIA per §5.4, primary
  star toggle, empty-state rendering per §5.5) against hand-built fixture data matching the `§3`
  response shapes — no real HTTP call needed for this phase.

**Depends on:** nothing from the backend — only needs the **response shapes already fully specified**
in `design.md` §3. **Can run fully in parallel with Phases 1–4.** **Blocks:** Phase 6 (all sub-phases).

**Extended scope (Skyler confirmed Luigi's recommendation, `docs/resource-images/reviews/luigi.md` §4,
2026-10-04):** this phase also builds `ResourceImagesStore` (a component-scoped injectable, provided per
detail page, owning load/upload-merge/set-primary/delete/the pure footnote helper/the section's inline
error — precedent: `mystery-create.store.ts`) and `core/resource-images.ts` (the `ownerType` → endpoint
mapping and the `/file`/`/thumbnail` URL builders), plus the `DomainIconComponent` size-input change Luigi's
review flags as a Phase 5 item. Building the store once here is what lets each of Phase 6's domain
sub-phases add only `providers` + a section block + (where missing) a modal instance, instead of
reimplementing the glue four times.

**Decided (Skyler, 2026-10-03, "Confirmed."):** the `app-resource-thumbnail` input is `thumbnailUrl: string | null`.
The list response carries `primaryImageId` (Phase 4), and the list row derives `thumbnailUrl` from it, so the
component takes the computed URL rather than the raw id.

**Verification:** `npm run test -- --watch=false` green for all three new components; `npm run build`
passes; Storybook-less manual check (open each component in isolation via a scratch route, if that's
faster than waiting for Phase 6/7 wiring) recommended but not required.

---

### Phase 6 — Frontend: Per-Domain Wiring, Monster Pilot Then Rollout (Luigi)

**Restructured 2026-10-04 (Skyler), extending Luigi's review (`docs/resource-images/reviews/luigi.md` §4).**
Luigi recommended a Monster-detail pilot (6a) then a batch rollout to the other three (6b), with the old
Phase 7 (list wiring) staying a single later phase and Phase 8 folding into the rollout. Skyler took that
further — verbatim: "this is an excellent idea, and I actually think we should add a sub-phase for each
domain object, starting with Monster as the pilot." So instead of pilot-then-batch, **each domain object
gets its own sub-phase**, and each sub-phase wires **both halves of that domain's work** — the detail-page
Images section (old Phase 6) and the list-page thumbnail (old Phase 7) — because both have to work before
the pattern is proven for that domain. Old Phase 8's cross-cutting audit is distributed: each sub-phase
below ends with that domain's own copy/footnote correctness check, and only a genuinely cross-cutting
leftover (if any) moves to Phase 7.

Order, per Skyler's explicit sequence: **Monster (6a, pilot) → Minion (6b) → Bystander (6c) → Location
(6d)**. Monster goes first because it is also the hardest host (see 6a below) — any component-API
correction from Phase 5 lands once, here, rather than being discovered piecemeal across four pages.

Each sub-phase, in both halves:
- **Detail half** — per `design.md` §4.1: card placement above the form, whole-card drop target,
  persistence decoupled from the page Save button (matching Attacks/Powers/Armors/Weaknesses),
  delete-confirmation wiring per §6, using `ResourceImagesStore` (Phase 5) and, where the page has none
  today, new `pendingDelete`/`<app-confirm-delete-modal>` infrastructure (see Luigi's review §1.3 — this
  applies to Bystander and Location, not Monster or Minion).
- **Footnote logic** (`thumbnail-and-primary-workflow.md` §2.8): one pure helper, built once in Phase 5,
  taking the image list and primary id, same rule as the server (explicit id, else lowest `SortOrder`, with
  the image being deleted excluded). Three branches: still-has-images (names the replacement, the
  first-uploaded remaining image, by `fileName`), last-image (resource will have no images), and not-primary
  (no footnote). Deleting the primary is always allowed; no restriction, no "set another primary first" flow.
- **List half** — per `design.md` §4.2: `app-resource-thumbnail` slotted in as first flex child on that
  domain's list page, thumbnail endpoint only (never original), empty-state domain-badge treatment (§5.5),
  `loading="lazy"` on the `<img>` (keeps request count proportional to rows on screen and gives
  pagination-readiness for free, `thumbnail-and-primary-workflow.md` §1.5). **Only the main list page** —
  the by-mystery list views are out of scope per the 2026-10-04 scope cut (Phase 4 above), so there is no
  by-mystery thumbnail to wire for any domain.
- **That domain's copy/footnote correctness check** (old Phase 8, distributed): confirm §7's rejection
  strings render verbatim on this domain's detail page, the three footnote cases are reachable and
  correctly worded, and the "already at 10" disabled state (§7.5) works — for this domain only.

**Depends on (whole Phase 6):** Phase 3 (real endpoints), Phase 4 (list `primaryImageId`), Phase 5 (shared
components + store). **Blocks:** nothing structural — Phase 7 only runs if something cross-cutting is left.

---

#### Phase 6a — Monster, pilot (Luigi)

**Goal:** Prove the pattern end-to-end on the hardest host, both halves at once: `monster-detail`'s Images
section and `monsters-list`'s thumbnail column.

**Why Monster is the pilot, not an arbitrary first pick (Luigi's review §1.3, §4):** `monster-detail` has
an existing `pendingDelete`/`<app-confirm-delete-modal>` (name-only shape, which `confirm-delete-modal.call
-site.spec.ts` census-tests) that must grow a `[footnote]` binding, an `activeMutation`/`isMutating` pattern
the new store must interoperate with, and a Minions block whose placement relative to the new Images
section is ambiguous ("under the badges" vs. "above the form") and needs Rosalina's confirmation before
this sub-phase starts. Any correction to Phase 5's component APIs is expected to surface here first.

**Work:** both halves per the Phase 6 umbrella above, specifically for Monster; extend `pendingDelete`'s
shape with a footnote field and update `confirm-delete-modal.call-sites.spec.ts`'s census for
monster-detail's new shape; resolve the Minions-block placement question before building.

**Depends on:** Phase 5, Phase 3, Phase 4 (Monster's `GetAllAsync` site only — the by-mystery variant is
out of scope). **Blocks:** 6b (any component-API correction found here should land before Minion starts).

**Verification:** manual upload/delete/set-primary flow on `monster-detail`; `monsters-list` renders real
thumbnails and the domain-badge placeholder; `npm run test` green including the updated modal census spec;
§7's rejection strings render verbatim.

---

#### Phase 6b — Minion (Luigi)

**Goal:** Same two halves for `minion-detail` and `minions-list`.

**Work:** both halves per the Phase 6 umbrella above. `minion-detail` already has `pendingDelete`/the modal
(name-only, same census-spec update as Monster) and `activeMutation`, so this sub-phase reuses Phase 6a's
pattern directly rather than building delete infrastructure from scratch. **Resolved (Skyler, 2026-10-04):**
"Minion image on monster view: out of scope for this pass." `minions-list` as rendered inside
`monster-detail`'s own Minions block (the `GetByMonsterIdAsync` projection) does not get a thumbnail in
this pass. This sub-phase's list half covers only the standalone Minions list page.

**Depends on:** Phase 5, Phase 3, Phase 4 (Minion's `GetAllAsync` only), Phase 6a (pattern proven, any
corrections already applied).

**Verification:** manual upload/delete/set-primary flow on `minion-detail`; `minions-list` (and the nested
Minions block, if in scope) renders real thumbnails; `npm run test` green; §7's rejection strings verbatim.

---

#### Phase 6c — Bystander (Luigi)

**Goal:** Same two halves for `bystander-detail` and `bystanders-list`.

**Work:** both halves per the Phase 6 umbrella above. `bystander-detail` has **no** `pendingDelete`,
modal, or mutation state today (Luigi's review §1.3) — this sub-phase builds that infrastructure from
scratch using the Phase 6a pattern, rather than extending something that exists.

**Depends on:** Phase 5, Phase 3, Phase 4 (Bystander's `GetAllAsync` site only — by-mystery is out of
scope), Phase 6a (pattern proven).

**Verification:** manual upload/delete/set-primary flow on `bystander-detail`; `bystanders-list` renders
real thumbnails; `npm run test` green; §7's rejection strings verbatim.

---

#### Phase 6d — Location (Luigi)

**Goal:** Same two halves for `location-detail` and `locations-list`.

**Work:** both halves per the Phase 6 umbrella above. Like Bystander, `location-detail` has no delete/modal
infrastructure today and builds it from scratch on the Phase 6a pattern. This is the last domain sub-phase,
so it is also where any residual drift across the three prior sub-phases should be visible first.

**Depends on:** Phase 5, Phase 3, Phase 4 (Location's `GetAllAsync` site only — by-mystery is out of
scope), Phase 6a (pattern proven).

**Verification:** manual upload/delete/set-primary flow on `location-detail`; `locations-list` renders real
thumbnails; `npm run test` green; §7's rejection strings verbatim.

---

### Phase 7 — Final Cross-Resource Check (Luigi, light Bowser involvement)

**Restructured 2026-10-04:** with each domain sub-phase (6a–6d) already ending in its own copy/footnote
correctness check, most of the old Phase 8 is gone. This phase is **small and only runs if something is
genuinely still cross-cutting** after 6a–6d — for example, confirming the shared icon/token work (star,
chevron, `--color-image-primary-indicator`) renders identically now that all four domains use it, or
confirming upload-progress behaves identically across all four dropzones (shared component should make
this automatic; this is the check that it actually is). If 6a–6d's per-domain checks already cover
everything, this phase is a short confirmation pass, not new work.

**Depends on:** Phases 6a, 6b, 6c, 6d. **Blocks:** nothing — this is the last phase before merge.

**Verification:** the phased-implementation verification checklist at the bottom of this document, all
boxes checked, across all four resource types.

---

## 3. Architectural risks and gaps

### 3.1 List-page thumbnail data source — not addressed in `design.md` at all (highest-priority finding)

`design.md` §4.2 says list rows render a thumbnail "pointed at the thumbnail endpoint... or the
placeholder." But the thumbnail endpoint (§3) is
`GET /api/{resource}/{id}/images/{imageId}/thumbnail` — it needs an `imageId`, specifically the
*primary* image's id. **Nothing in `design.md`'s API surface (§3) touches the existing list endpoints**
(`GET /api/monsters`, `/api/minions`, `/api/locations`, `/api/bystanders`) at all — I checked
`ApiContracts.cs` directly: `MonsterListItemResponse`/`MinionListItemResponse`/
`LocationListItemResponse`/`BystanderListItemResponse` carry `Id`, `Name`, `Description`, and a handful
of domain-specific fields, and nothing that identifies an image.

Without a fix, a list page rendering N rows would need N additional round-trips (one `GET .../images` per
row, just to learn whether a primary image exists and what its id is) before it could even construct a
thumbnail `<img src>` — an N+1 pattern this codebase has specifically avoided elsewhere (the search
feature's whole `ISearchProvider` design exists partly to avoid this shape). This is exactly the kind of
gap that would surface mid-implementation as "wait, how does the list page know what to fetch" if it
weren't caught now.

**Decided (Skyler, 2026-10-03, "Confirmed."):** extend the four list-item response contracts with a
single `PrimaryImageId: Guid?` field, carrying the **derived-or-explicit** primary. The list endpoint resolves
the derivation (a null column means "lowest `SortOrder`," which requires a query against `ResourceImage`), so
the frontend never re-derives it. One extra scalar per list row, zero extra round-trips. The earlier wording
("sourced directly from the owning entity's own `PrimaryImageId` column, no join needed") was wrong for the
null case and is withdrawn. Full comparison of fetch strategies, including why batch endpoints and inline
bytes were rejected: `thumbnail-and-primary-workflow.md` §1.

### 3.2 Multipart upload handling is entirely new infrastructure for this app

**Status: Railway concern deferred to post-deploy (Skyler, 2026-10-03). Not a blocker.** Skyler will address Railway
request-size and proxy issues if and when they appear after deployment. Local functionality is the immediate
priority. The Railway-specific bullet below and the Phase 3 "Manual batch upload test against a real Railway
deploy" checklist item are therefore post-deploy items, not gates on Phases 1–8. The local-Kestrel limit
(explicit `RequestFormLimits` on the upload action) is still in scope, since it is local behaviour.
The merge-checkpoint question is settled in the Git workflow section above.

Confirmed by grep: no `IFormFile`, no `[FromForm]`, no explicit `FormOptions`/`MaxRequestBodySize`
configuration anywhere in `src/api`. Kestrel's default `MaxRequestBodySize` is ~28.6 MB (30,000,000
bytes) and ASP.NET Core's default multipart `FormOptions.MultipartBodyLengthLimit` is 128 MB — the
worst-case batch this design produces (10 files × 2 MB = 20 MB) fits under both **defaults**, but
"fits under an unexamined default" is not the same as "was deliberately sized for this feature."

**Decided (Bowser's review, 2026-10-04):** `[RequestSizeLimit(24 * 1024 * 1024)]` and
`[RequestFormLimits(MultipartBodyLengthLimit = 24 * 1024 * 1024)]` on the upload action, a 24 MiB stated
ceiling rather than an inherited framework default. See Phase 3's work list above for the full reasoning,
including the client-side 10-files-per-`POST` chunking rule this implies. One item remains genuinely open:
- **Railway's own edge/proxy may impose a request body size limit that nothing in this repo models.**
  `Program.cs`'s `ForwardedHeaders` configuration (with its extensive comments about Railway's proxy
  behavior) shows this app has already been bitten once by an assumption about how Railway's edge
  behaves that turned out to need explicit handling. A 24 MiB multipart POST is worth a real test against
  the deployed Railway environment. Post-deploy item only (deferred, see status above); local Kestrel
  behaviour is what gates the Phase 3 commit.

### 3.3 Cap-check and `SortOrder` assignment have an unaddressed race condition

**Status: accepted, no hardening (Skyler, 2026-10-03).** "Race condition is a non-issue for now." No hardening work in scope.
The unique index on `(OwnerType, OwnerId, SortOrder)` in §1 item 2 is a read-path index and is not a
concurrency fix; it does not make this race impossible, and it should not be presented as one.

`IResourceImageService`'s cap check ("count < 10") and `SortOrder` assignment ("current max + 1") both
read-then-write against `ResourceImage` rows filtered by `(OwnerType, OwnerId)`, with no unique
constraint backing either invariant and no transaction isolation stronger than EF's default (`Read
Committed` on Postgres). Two concurrent uploads to the same resource (two browser tabs, or a retry racing
the original request) could both read "8 images, room for 2 more," both accept files, and land at 11 or
12 total — or two files could land with the same `SortOrder`, which only affects tie-break ordering, not
data loss.

Given this app has exactly one realistic concurrent actor (Skyler, possibly with two tabs open) rather
than multiple simultaneous users, the actual blast radius is low and the failure mode is soft (a mildly
over-cap resource, or a rare ordering tie) rather than data corruption. **Recommendation: accept this
as a documented, low-severity risk rather than adding transaction/retry machinery this app has no
existing precedent for** — but it should be an explicit accept, stated in the PR/commit that lands Phase
2, not a silent gap discovered later. If it ever needs hardening, a unique index on
`(OwnerType, OwnerId, SortOrder)` with a retry-on-conflict loop is the standard fix.

### 3.4 Detail-page footnote/copy logic is four-times-repeated by construction

Not a backend risk — a frontend one. Previously flagged for a dedicated Phase 8 audit; after the
2026-10-04 restructure, each domain sub-phase (6a–6d, §2 Phase 6) ends with this check for its own domain,
so the risk is caught incrementally rather than in one batch at the end. `design.md` §6's three-way footnote
branch (still-has-images / one-remaining / last-one) and §7's four rejection-reason strings both need to
render identically across four otherwise-independent detail pages built from a shared component. The
shared components (Phase 5) should own this logic once rather than have each of the four page components
reimplement the branch — worth confirming during Phase 6 that the footnote-string logic lives in
`image-carousel.component.ts` (which already owns `deleteRequested`/knows the full image list) or a
small shared pure function, not copy-pasted into `monster-detail.ts`, `minion-detail.ts`, etc.

### 3.5 Test fixture strategy for image bytes is unaddressed

Backend tests for this feature (magic-byte validation, thumbnail generation, upload/reject batches) need
real, valid, minimal image byte arrays — a 1×1 JPEG, a 1×1 PNG, a 1×1 WebP, and at least one deliberately
invalid/corrupt file. Nothing in the existing test project (`MonsterOfTheWeek.Api.Tests`) has needed
binary test fixtures before — this app's other tests all work against structured data (EF entities,
JSON). Recommend small embedded test-only byte arrays (base64-decoded inline, or tiny committed fixture
files under the test project) rather than reaching for an external image on disk at test time, matching
this codebase's general preference for self-contained tests.

### 3.6 Owner-delete orphaned image bytes (new, Bowser's review — highest-priority backend finding)

Backend-only, fixed in Phase 3's work list above. `ResourceImage` has no FK to its owner by design (§1.3),
so none of the four existing owner-delete flows know it exists, and deleting a Monster, Minion, Bystander,
or Location leaves that owner's images permanently unreachable but still stored. The Monster→Minion
cascade is DB-level, so a Monster delete orphans its Minions' images too, with no application code in that
path at all. Full detail and the fix (one transaction per delete, using a new
`IResourceImageService.DeleteAllForOwnerAsync`) is in Phase 2/Phase 3 above.

### 3.7 Decompression-bomb dimension guard (new, Bowser's review)

Backend-only, fixed in Phase 2's work list above. A file within the 2 MiB cap can still declare an
enormous canvas and exhaust memory on decode. §7.1's magic-byte check only confirms the container format,
not the declared dimensions. Needs a header-only dimension read before any full decode, a stated cap
(4096×4096 recommended), and its own rejection reason not currently in `design.md` §3's enum.

---

## 4. Open questions

1. **Feature-branch name.** Phase 1 cannot start on `main`, and the branch must exist before Phase 1 begins
   (see Git workflow). The session-start git status showed `resource-images` as the checked-out branch; the
   Architect direction for this pass said `main`. Skyler to confirm: use `resource-images` as the feature branch,
   or create a new one off `main`?
(Item 2, "ImageSharp vs. SkiaSharp," is decided — see §1 item 6 and §4a below. Item 2's former subject,
Minion's `GetByMonsterIdAsync`, is resolved — see §4a and the header revision notes.)

## 4a. Decisions recorded from Skyler's answers (2026-10-03, Bowser's review 2026-10-04, and Skyler's 2026-10-04 restructure)

These are settled and applied in the sections named. Listed here so the reasoning stays in one place.

- **Replacement after deleting an explicit primary (§2 Phase 2, Phase 6):** "First uploaded image as the next
  default is good." The replacement is the first-uploaded remaining image.
- **Cache-Control (§2 Phase 3, §3.2 context):** Skyler asked for the difference between `public` and `private`
  and was answered in chat; `private` was accepted. Decided header:
  `Cache-Control: private, max-age=31536000, immutable`. This replaces the design's `public` (see
  `thumbnail-and-primary-workflow.md` §2.5).
- **List field and thumbnail input (§2 Phase 4, §3.1, Phase 5):** "Confirmed."
- **Wizard and minion picker under pagination (soft, non-blocking, deferred):** "I will probably do typeahead, but
  this is a soft decision for now." Typeahead is the leaning. Revisit when pagination is scoped; nothing in
  this plan depends on it.
- **Session-expiry 401 on an image request (Phase 5's component, wired in each Phase 6 sub-phase):** "Silent placeholder is acceptable."
- **Merge checkpoint (Git workflow):** "I want to commit after each phase on the current branch and I'll review the
  state of things before manually merging the branch into main."
- **Thumbnail size estimate (`thumbnail-and-primary-workflow.md` §1.3(d), §5 item 5, deferred):** "I think the estimate
  is fine and I'll deal with any loading concerns after the phases are complete." Not a gate on any phase.
- **Railway request-size concern (§3.2):** deferred to post-deploy. Local `RequestFormLimits` remains in scope.
- **Cap-check and `SortOrder` race (§3.3):** accepted, no hardening.
- **Thumbnail-generation-failure fallback (§2.1):** read-time conditional (`ThumbnailBytes is null → stream
  ImageBytes`), carried from the earlier pass. Bowser implements it. No write on primary change.
- **Thumbnail library (§1 item 6):** `SkiaSharp` + `SkiaSharp.NativeAssets.Linux`. Skyler: "It sounds like
  we will just need the NativeAssets library for SkiaSharp to work in a linux box." Decided over
  ImageSharp specifically to avoid the Six Labors Split License question — the repo has no LICENSE file,
  so ImageSharp's free tier would have rested on a revenue-based reading Skyler would have had to confirm
  anyway. A Linux-container smoke test is still recommended even with the native-assets package explicitly
  referenced, since a missing/mismatched native library fails at runtime, not at build time.
- **Owner-delete orphaned image bytes (§3.6):** backend-only fix, folded into Phase 2 (new
  `DeleteAllForOwnerAsync`) and Phase 3 (wiring it into the four existing delete flows, in a transaction).
  Not Skyler-facing; recorded here because it changes behavior of four existing endpoints, not just new ones.
- **Decompression-bomb guard (§3.7):** backend-only fix, folded into Phase 2. Needs a new rejection reason
  added to `design.md` §3's enum and §7's copy table before Phase 6 can render it.
- **Index naming, FK indexes, `OwnerType` conversion, `CreatedAt`:** all corrections to Phase 1's original
  text, not new decisions — see §1 items 10, 11, 12 and Phase 1's work list above.
- **Request-size limits (§3.2):** 24 MiB `[RequestSizeLimit]`/`[RequestFormLimits]`, 2 MiB per-file cap,
  client caps each `POST` at 10 files. Folded into Phase 3.
- **Test strategy:** SQLite stays for service/controller tests; one opt-in, trait-gated real-Postgres test
  class is added (Phase 2) to actually exercise `SetNull`, the migration, and the derivation against
  Postgres. No Testcontainers.
- **By-mystery thumbnail scope cut (§2 Phase 4, 2026-10-04):** "As for the list of Mysteries, this can be
  removed. I'm not anticipating a need for photos related to a mystery specifically, just minions, monsters,
  locations, and bystanders." `GetMonstersByMysteryIdAsync`, `LocationService.GetByMysteryAsync`/
  `GetLocationsByMysteryIdAsync`, and `BystanderService.GetByMysteryAsync` are out of scope.
- **Minion's `GetByMonsterIdAsync` resolved out of scope (§2 Phase 4, Phase 6b, 2026-10-04):** "Minion image
  on monster view: out of scope for this pass." Combined with the by-mystery cut above, this settles the
  projection-site count at four: the main `GetAllAsync` for Monster, Minion, Location, and Bystander.
- **Phase restructure (§2 Phase 6, 2026-10-04):** Skyler confirmed Luigi's pilot-then-rollout idea and
  extended it to a sub-phase per domain object: "this is an excellent idea, and I actually think we should
  add a sub-phase for each domain object, starting with Monster as the pilot." Old Phases 6, 7, and 8 are
  replaced by Phase 6a (Monster) → 6b (Minion) → 6c (Bystander) → 6d (Location), each wiring that domain's
  detail and list halves together, plus a small Phase 7 for any genuinely cross-cutting leftover.

---

## Verification Checklist

**Phase 1:**
- [ ] `dotnet ef migrations has-pending-model-changes` returns clean after `AddResourceImages`; migration
      applies to a fresh DB (app starts against an empty `docker compose up -d postgres` database)
- [ ] `PrimaryImageId` FKs configured `SetNull` on all four owner entities, via `HasOne<ResourceImage>().WithMany()`
- [ ] Composite index on `(OwnerType, OwnerId, SortOrder)`, named `idx_resource_images_owner_sort`, present on `ResourceImage`
- [ ] Four FK indexes present: `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`,
      `idx_bystanders_primary_image_id`, `idx_locations_primary_image_id`
- [ ] `OwnerType` stored via `.HasConversion<string>()`, documented as a new pattern (no existing `HasConversion` elsewhere)
- [ ] Opt-in real-Postgres test (`Category=Postgres`) runs `MigrateAsync()` against the compose Postgres and passes

**Phase 2:**
- [ ] All four rejection reasons (§7.1) unit-tested, including WebP RIFF-container detection specifically
- [ ] Decompression-bomb dimension guard unit-tested (oversized declared dimensions rejected before full decode)
- [ ] Cap partial-accept math tested (8+5→2 accepted/3 rejected, per §7.4's worked example)
- [ ] Primary derivation tested, including the `SortOrder`-then-`Id` tie-break: null-default, explicit-set,
      delete-current-primary (confirms `SetNull` FK), duplicate-`SortOrder` tie resolved deterministically
- [ ] `ResourceImage.CreatedAt` is set explicitly and asserted `!= default` in a test
- [ ] Batch upload is a single `SaveChangesAsync()` call, not one per file
- [ ] Opt-in `Category=Postgres` test confirms `SetNull` and the derivation projection against real Postgres

**Phase 3:**
- [ ] All six endpoints present on all four controllers
- [ ] `IResourceImageService` registered in `Program.cs`
- [ ] `[RequestSizeLimit(24 MiB)]`/`[RequestFormLimits(MultipartBodyLengthLimit = 24 MiB)]` set on the upload
      action; a body over 24 MiB returns 413 rather than hanging or 500ing
- [ ] `/file` and `/thumbnail` responses carry correct `Content-Type` and `private, ... immutable` cache headers
- [ ] `/file` and `/thumbnail` return 404 when `imageId` does not belong to `{id}`; `PUT .../primary` 404s on a non-owned id
- [ ] **Owner-delete cleanup:** deleting a Monster, Minion, Bystander, or Location also deletes that owner's
      images in the same transaction; deleting a Monster with an imaged Minion leaves zero `resource_images`
      rows for either
- [ ] Post-deploy only (deferred, §3.2): manual batch upload test against a real Railway deploy

**Phase 4:**
- [ ] The four main `GetAllAsync` list endpoints return `PrimaryImageId`, correct for both zero-image and
      populated resources — **by-mystery variants (`GetMonstersByMysteryIdAsync`,
      `GetByMysteryAsync`×2) are out of scope (scope cut, 2026-10-04) and must not carry the field**
- [ ] Four projection sites carry the field: Monster's, Minion's, Location's, and Bystander's `GetAllAsync`
      (Minion's `GetByMonsterIdAsync` is out of scope for this pass, per Skyler) — **Monster and Minion via
      a SQL correlated subquery; Location and Bystander via a reworked SQL projection or a grouped query,
      not the in-memory `.Select` they use today**
- [ ] Derived primary (null column → lowest `SortOrder`, then lowest `Id`) returned by the list; agreement
      test against `IResourceImageService`'s derivation (not over HTTP) passes for the four cases in
      workflow doc §2.2, for all four owner types

**Phase 5:**
- [ ] `app-image-dropzone`, `app-image-carousel`, `app-resource-thumbnail` unit-tested against `design.md`
      §3's response shapes
- [ ] `app-resource-thumbnail`: `thumbnailUrl: string | null`; placeholder on null and on `<img>` error; error
      state resets when the URL changes
- [ ] `star`/`chevron` icons added per the sprite recipe; `--color-image-primary-indicator` token added
- [ ] `ResourceImagesStore` and `core/resource-images.ts` built and unit-tested against fixtures; no page
      wiring yet

**Phase 6a (Monster, pilot):**
- [ ] `monster-detail`: upload/delete/set-primary work end-to-end against the real API; Minions-block
      placement resolved with Rosalina before building
- [ ] `monsters-list` renders real thumbnails and the domain-badge empty state
- [ ] All three footnote cases (§6) reachable and correctly worded; all §7 rejection strings render verbatim
- [ ] `confirm-delete-modal.call-sites.spec.ts` census updated for monster-detail's new `[footnote]` shape

**Phase 6b (Minion):**
- [ ] `minion-detail`: upload/delete/set-primary work end-to-end; `minions-list` renders real thumbnails
- [ ] Footnote cases and §7 rejection strings verbatim; modal census spec updated
- [ ] Nested Minions-list-in-monster-detail shows no thumbnail (explicitly out of scope for this pass, per Skyler)

**Phase 6c (Bystander):**
- [ ] `bystander-detail`: delete/modal infrastructure built from scratch; upload/delete/set-primary work end-to-end
- [ ] `bystanders-list` renders real thumbnails; footnote cases and §7 rejection strings verbatim

**Phase 6d (Location):**
- [ ] `location-detail`: delete/modal infrastructure built from scratch; upload/delete/set-primary work end-to-end
- [ ] `locations-list` renders real thumbnails; footnote cases and §7 rejection strings verbatim

**Phase 7 (final cross-resource check):**
- [ ] Shared icon/token work (star, chevron, primary-indicator glow) confirmed consistent across all four domains
- [ ] Upload-progress behaves identically across all four dropzones
- [ ] Full checklist above green across all four resource types before merge
