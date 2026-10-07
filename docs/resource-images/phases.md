# Resource Images — Phased Implementation Plan

**Prepared by:** Yoshi (Architect)
**Input:** `docs/resource-images/design.md` (Rosalina, finalized/Skyler-approved). This document does not
re-litigate that design's settled calls (single `ResourceImage` table, `bytea` storage, nullable
`PrimaryImageId`, 10×2MB cap, JPG/PNG/WebP, no Mystery Wizard integration). It breaks the design into
implementable phases, names what blocks what, and surfaces the structural gaps a phasing pass is
supposed to catch before Bowser and Luigi start building.
**Status (2026-10-07): built end to end. All eleven planned commits have landed on `resource-images`.**
This document is now a record of what was built rather than a plan for what to build. Phase sections keep
their original reasoning — that is the point of the record — with a **Landed** line naming the commit. The
branch has not been merged to `main`; Skyler reviews and merges manually (Git workflow below). What remains
is in Phase 7, and it is two in-flight follow-ups rather than feature work.

| Commit | Phase | What landed |
|---|---|---|
| `aa75d9e` | 1 | `ResourceImage` schema and migration |
| `7cf5e17` | 2 | Backend service layer (`IResourceImageService`) |
| `eb1911e` | 3 | API surface, multipart upload, owner-delete cleanup |
| `9d9b054` | 4 | Derived `primaryImageId` on the four main list endpoints |
| `a040ebc` | 5 | Shared components, store, and core service |
| `8921029` | 5r | Inline dropzone replaced by the staging upload modal |
| `93d719e` | 6a | Monster: images section + row thumbnails (pilot) |
| `2cb7d87` | 6b | Minion |
| `78b9626` | 6c | Bystander |
| `624aa3e` | 6d | Location, plus the cross-domain consistency comparison (Phase 7 below) |

Skyler-requested adjustments, landed between phases: `624eef0` client-side cap enforcement (folded into
Phase 5's record), `2606e09` carousel desktop height halved via a width cap, `dcb2acf` list thumbnail
doubled to 128px with the row allowed to shrink, `767f1ae` mobile row stacking and description clamp,
`1c1a580` Minion list-row description added. Each of these was followed by a record-keeping commit
(`7e17cf0`, `3cc1632`, `b8f6115`, `a661cbd`) putting the reasoning in `design.md` and Luigi's `.squad`
history, so the *why* behind each visual adjustment sits with the design rather than only in a diff.
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
**Revised 2026-10-05 (Skyler — modal upload rework, decided):** The upload becomes a button → modal →
staged list → submit flow, replacing the committed drop-to-upload card. Phases 1–5 are already committed on
`resource-images`, so this is a rework of shipped frontend code; Skyler answered all nine of the assessment's
questions and placed the rework **before Phase 6a** as its own commit, **Phase 5r**. Headlines: drag-and-drop
is modal-only, which unwinds Luigi's dropzone-wraps-carousel projection; the staged list is filenames only;
magic-byte and dimension rejections stay server-side and surface as a generic toast (a knowing tradeoff); a
partial rejection keeps the successful uploads and toasts the failed filenames; closing with staged files
prompts for confirmation; the multi-request chunking is deleted, closing design.md §9.5; **zero API
changes**. Full detail, all nine answers verbatim, and the work list: the **Phase 5 modal upload rework**
section after §2 (R1–R11). The Git workflow commit list and the per-phase gate above are updated for it.
Rosalina is updating design.md's UX/copy side in parallel.

---

## Git workflow

Decided by Skyler, 2026-10-03: "I want to commit after each phase on the current branch and I'll review the state
of things before manually merging the branch into main."

- **One commit per completed phase, all on a single feature branch.** After the 2026-10-04 restructure (§2
  Phase 6) and the 2026-10-05 modal upload rework (which Skyler placed before Phase 6a — "Land this rework
  now, before phase 6"), that is: Phases 1, 2, 3, 4, 5, **5r (modal upload rework)**, 6a (Monster),
  6b (Minion), 6c (Bystander), 6d (Location), and 7 — **eleven commits**, not eight and no longer ten.
- **Skyler reviews the branch and merges to `main` manually.** There is no intermediate merge or PR checkpoint
  between the backend phases (1–4) and the frontend phases (5, 5r, 6a–6d, 7).
- **Branch requirement — decided 2026-10-04:** Skyler confirmed the feature branch is `resource-images`
  (already checked out, one commit ahead of `main` with the fal.ai image-gen tooling). Phase 1 commits land
  there, not on `main`.
- Commits land in order: 1, 2, 3, 4, 5, **5r**, 6a, 6b, 6c, 6d, 7. Phases that can run in parallel (for
  example 5 with 1–4) may be worked concurrently, but their commits follow this order so each gate runs
  against the state the previous commit left.
- **Done as of 2026-10-07: all eleven landed in that order**, each past its own gate, plus five
  Skyler-requested adjustment commits and their record-keeping commits (see the header table). Phase 7 held
  no feature work in the end — see its section. **The branch is unmerged and awaiting Skyler's review**,
  which is the checkpoint this workflow was built around.

## Per-phase verification gate

Each phase's commit must pass the gate below before the next phase starts. The phase's own verification list
still applies in addition.

**Retrospective (2026-10-07): the gate held for all eleven commits** — each landed green, and the Playwright
dev-server check on 6a–6d is what surfaced the TypeScript-interface gap (§5(a)), the mobile grid overflow
(§5(b)) and Minion's missing description (§5(c)). None of those three would have been caught by `npm run
test` alone, which is the argument for having required a real-browser check per domain rather than only at
the end.

- **Backend phases (1–4):** `dotnet build` and `dotnet test` green. Phase 1 also requires
  `dotnet ef migrations has-pending-model-changes` to return clean and a migration that applies to a fresh
  local Postgres.
- **Frontend phases (5, 5r, 6a–6d, 7):** `npm run build` and `npm run test -- --watch=false` green, plus a relevant UI check:
  - Phase 5: each new component rendered in isolation (scratch route or test harness).
  - **Phase 5r (modal upload rework):** the upload modal exercised on the dev server for the three
    post-submit outcomes, the close-with-staged-files confirm, and the 10/10 disabled state; plus
    `shared/escape-nesting.spec.ts` and `shared/confirm-delete-modal.call-sites.spec.ts` still green, since
    a new overlay surface is exactly what those two census specs exist to catch. No detail page is wired
    yet, so the UI check runs against a scratch route. Full list: the **Phase 5 modal upload rework**
    section, R11.
  - Phases 6a–6d: that domain's detail page *and* list page exercised on the dev server (Playwright
    self-check against the real dev server), plus that domain's copy/footnote correctness.
  - Phase 7: whatever cross-cutting check remains (see Phase 7 below) exercised across all four resource types.

---

## Gate — review focus before implementation starts

**Historical (both reviews happened, 2026-10-04 and 2026-10-05).** Bowser's backend review is folded into
Phases 1–4 and §1 items 7–12; Luigi's frontend review produced the per-domain restructure and the
`ResourceImagesStore`, and her reviews are at `docs/resource-images/reviews/bowser.md` and
`.../luigi.md`. Kept for the record of who was asked to check what.

| Reviewer | Focus |
|---|---|
| **Bowser** (Backend) | §1 (new architectural calls this pass makes, all backend), Phases 1–4 below, and the risks in §3 items 1, 2, 3, 5, 6, 7 (and the two backend-only additions, §3.6–§3.7) |
| **Luigi** (Frontend) | Phase 5, **Phase 5r (the modal upload rework section, R1–R11)**, Phase 6 (sub-phases 6a–6d), and Phase 7 below, and the risks in §3 items 1 (client half) and 4 |

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
| 8 | Multipart/file-upload request handling — does anything in this app already do this? | **No.** Grepped the whole API project: no `IFormFile`, no `[FromForm]`, no `MultipartBodyLengthLimit`, no `FormOptions` configuration anywhere. This is a genuinely new request-handling pattern for this codebase, not an extension of an existing one — see §3.2 below. Decided concretely (Bowser's review): `[RequestSizeLimit(24 * 1024 * 1024)]` and `[RequestFormLimits(MultipartBodyLengthLimit = 24 * 1024 * 1024)]` on the upload action (10 files × 2 MiB = 20 MiB, plus headroom for multipart overhead), a 2 MiB (2,097,152-byte) per-file cap enforced server-side, and the client capping each POST at 10 files so a large drop is chunked into sequential requests rather than tripping a framework-level rejection before the per-file `{ uploaded, rejected }` logic ever runs. **Confirmed in Phase 3 (not 413 as originally assumed):** a body over the 24 MiB ceiling returns **400 Bad Request** via ASP.NET Core's automatic ProblemDetails ("Request body too large..."), rejected immediately — never a hang, never a 500 — just the wrong status code named here originally. |
| 9 | Owner-delete leaves orphaned image bytes — **new, not addressed anywhere in `design.md` or the original phasing pass. Flagged in Bowser's review as the highest-priority gap.** | `ResourceImage` has no FK to its owner (§1.3's accepted tradeoff), so deleting a Monster, Minion, Bystander, or Location does nothing to that owner's `resource_images` rows — they become permanently unreachable but still occupy `bytea` storage. This is worse than it looks for Monsters specifically: deleting a Monster already cascades to its Minions **at the database level** (`Minion.MonsterId` is `OnDelete(Cascade)`), so a Monster delete silently orphans its Minions' images too, through a path that runs no application code at all. None of the four existing delete flows (`MonsterRepository.DeleteMonsterAsync`, the Minion/Location/Bystander equivalents, all `ExecuteDeleteAsync`) know `ResourceImage` exists. Fixed in Phase 3's work list below. |
| 10 | Index naming and the four FK indexes — **correction to item 2 above. Flagged in Bowser's review.** | Phases §1 item 2's `HasIndex(...)` has no explicit name, but every other index in `MotwDbContext.cs` is named `idx_<table>_<columns>` (`idx_minions_monster_id`, `idx_hunters_playbook_id`, …). Name it `idx_resource_images_owner_sort`. Separately, Postgres does not index a referencing column automatically, and this codebase indexes every FK column by convention — add `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`, `idx_bystanders_primary_image_id`, `idx_locations_primary_image_id` on the four new `PrimaryImageId` columns; `SetNull` on an image delete scans these otherwise. |
| 11 | `OwnerType` as a string-backed enum — is this an existing convention? **Correction. Flagged in Bowser's review.** | **No — it would be new.** Phase 1's original text said storing `OwnerType` as a string-backed enum matches "how this codebase already prefers explicit string/enum discriminators over magic ints elsewhere," but a grep of `MotwDbContext.cs` turns up no `HasConversion` anywhere and no existing enum-typed column. State this plainly as a first-of-its-kind decision rather than precedent: `.HasConversion<string>()` with `.HasMaxLength(16)` is still the right call (readable raw SQL, no magic ints), just a new one, not an inherited one. |
| 12 | `ResourceImage.CreatedAt` — does `ApplyTimestamps()` set it? **Correction. Flagged in Bowser's review.** | **No.** `MotwDbContext.ApplyTimestamps()` only iterates `ChangeTracker.Entries<ITimestamped>()`, and `design.md` §1.1 deliberately does not give `ResourceImage` an `UpdatedAt` (images are immutable; delete-and-re-upload replaces them), so it correctly does not implement `ITimestamped`. That means `CreatedAt` is **never** set automatically — `IResourceImageService` must set it explicitly when constructing each row, or every image silently gets `default(DateTimeOffset)`. Add a test asserting `CreatedAt != default`. |

---

## 2. Phase breakdown

### Phase 1 — Schema & Migration (Bowser)

**Landed: `aa75d9e`.** Gate passed. The opt-in real-Postgres migration test this phase called for exists as
`ResourceImageMigrationPostgresTests`, so "the migration applies" is asserted rather than assumed.

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

**Landed: `7cf5e17`.** Gate passed. Both halves of this phase's test strategy were built: SQLite for the
service tests, plus the opt-in trait-gated `ResourceImageServicePostgresTests`. Binary fixtures came in as
`ResourceImageTestFixtures` — SkiaSharp-encoded at test time (`TinyJpeg`, `TinyWebp`,
`OversizedDimensionJpeg`, `TruncatedJpeg`, `GifBytes`, `RiffWaveBytes`) rather than the committed/base64
files §3.5 suggested. Same intent (self-contained, no external assets), better coverage: the RIFF-WAVE case
proves the WebP container check rejects a non-WebP RIFF file, which a hand-written byte array would have
been unlikely to exercise.

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

**Landed: `eb1911e`.** Gate passed, with one correction committed separately (`c680918`): an oversized
upload returns **400, not 413**, so the doc's own numbers matched the framework's behaviour. The owner-delete
orphan fix (§3.6) and the `Program.cs` registration both landed here as planned. **Still outstanding by
decision, not by omission:** the Railway 24 MiB multipart test is a post-deploy item (§3.2), as is the
Linux-container SkiaSharp smoke test (§1 item 6) — neither is reachable before the branch deploys.

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
  leaves a gap the client must close, not the server:** a body over 24 MiB is rejected with **400 Bad
  Request** (ASP.NET Core's automatic ProblemDetails, confirmed in Phase 3 — not 413) before the controller
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
headers confirmed on both `/file` and `/thumbnail`; a body over 24 MiB returns 400 Bad Request (confirmed
in Phase 3; not 413) rather than hanging or 500ing; deleting a Monster with an imaged Minion leaves zero
`resource_images` rows for either; `dotnet
test` green for controller-level tests.

---

### Phase 4 — Backend: List-Response Thumbnail Data (Bowser)

**Landed: `9d9b054`.** Gate passed. **One thing this phase's work list got wrong, and it cost time in all
four Phase 6 sub-phases:** it enumerated the four C# response records and no TypeScript interfaces, so
`primaryImageId` existed server-side and was invisible to the client until each domain sub-phase noticed and
added it. See §5(a) — this is the finding from this feature most worth carrying forward.

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

**Landed: `a040ebc`**, plus `624eef0` for client-side cap enforcement. Gate passed. **This phase's upload
mechanism was then reworked in Phase 5r (`8921029`)** — button → modal → staged list → submit, replacing the
drop-to-upload card described above. `app-image-dropzone` no longer exists: it was replaced by
`app-resource-images-card` (presentational) and `app-image-upload-modal`, and all card-level drag plumbing
was deleted. **The description of the dropzone above is therefore historical** — kept because the rest of
this phase's reasoning (component split, the icons, the token, `ResourceImagesStore`, the pure rules) is
what actually shipped and is still accurate. See the **Phase 5 modal upload rework** section after §2
(R1–R11) for what replaced it.

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

**Landed: `93d719e`.** Gate passed, Playwright-verified on the real dev server. **The pilot did its job:**
every Skyler-requested visual adjustment landed here, on one page, *before* 6b started — section ordering
(`7e17cf0`), carousel height halved via a width cap (`2606e09`, reasoning in `3cc1632`), the 128px list
thumbnail (`dcb2acf`), and mobile row stacking with a description clamp (`767f1ae`, reasoning in `b8f6115`).
Minion, Bystander and Location inherited all four through the shared components without re-deciding
anything. That is the specific payoff the pilot-then-rollout structure was chosen for.

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

**Landed: `2cb7d87`.** Gate passed, Playwright-verified. One finding came out of this one and it was not a
domain difference: `minions-list` rows had **no description at all**, where the other three did. Fixed in
`1c1a580`, with the record corrected in `a661cbd`. A spec had encoded the absence as if it were intended,
and passed while the UI was wrong — see §5(c).

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

**Landed: `78b9626`.** Gate passed, Playwright-verified. The delete/modal infrastructure this page lacked
was built from the 6a pattern as planned, with no new pattern invented for it.

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

**Landed: `624aa3e`.** Gate passed, Playwright-verified. **This sub-phase also ran the cross-domain
consistency comparison that Phase 7 had been scoped to perform** — a normalised hash comparison of the four
domains' images sections and list rows. Result: the card and carousel blocks collapsed to two hashes
differing by exactly the one intentional line (modal ownership), while the upload modal, row classes and
thumbnail block were byte-identical across all four; one real misplacement was found and fixed. Because the
last sub-phase was in a position to compare all four, the audit happened where the evidence was, rather than
in a later phase. See Phase 7 for what that leaves.

**Goal:** Same two halves for `location-detail` and `locations-list`.

**Work:** both halves per the Phase 6 umbrella above. Like Bystander, `location-detail` has no delete/modal
infrastructure today and builds it from scratch on the Phase 6a pattern. This is the last domain sub-phase,
so it is also where any residual drift across the three prior sub-phases should be visible first.

**Depends on:** Phase 5, Phase 3, Phase 4 (Location's `GetAllAsync` site only — by-mystery is out of
scope), Phase 6a (pattern proven).

**Verification:** manual upload/delete/set-primary flow on `location-detail`; `locations-list` renders real
thumbnails; `npm run test` green; §7's rejection strings verbatim.

---

### Phase 7 — Resolved: the audit already happened in 6d; two follow-ups remain

**Resolved 2026-10-07 (Luigi's position, accepted by Skyler). No feature work is left in this phase.**

This phase was scoped — twice — as the cross-cutting consistency audit across the four domains. **Phase 6d
ran it** (see above): a normalised hash comparison of each domain's images section and list row, which came
back consistent. The card and carousel blocks collapsed to two hashes differing by exactly the one
intentional line (modal ownership); the upload modal, row classes and thumbnail block were byte-identical
across all four domains; one real misplacement was found and fixed in that sub-phase. Re-running that
comparison as its own phase would assert the same thing twice.

**Why it landed there instead of here, worth keeping as a structural lesson:** the last per-domain sub-phase
is the first moment all four implementations exist, so it is also the cheapest moment to compare them —
and the comparison is most useful *while* the fourth is being written, when a drift finding is a correction
rather than a bug report. A terminal audit phase, on this shape of work, schedules the check later than the
evidence appears. If a future feature is phased per-domain, put the comparison in the last sub-phase by
design rather than in a phase after it.

**What actually remains, both in flight and neither blocking a merge:**

1. **A standing drift-guard spec (Luigi).** 6d's hash comparison was a one-off command. Turning it into a
   committed spec makes the invariant enforceable on every future change instead of true once. The natural
   first thing for it to cover is the gap noted in the rework section: the upload modal is absent from
   `shared/escape-nesting.spec.ts` and `shared/custom-select-escape-surfaces.spec.ts`, so the app's newest
   overlay surface is not in the cross-surface Escape census even though its own spec asserts its behaviour.
2. **A `design.md` staleness pass (Rosalina).** The design document accumulated corrections and additions
   throughout implementation (§4.5 and §7.6 for the modal rework; the carousel width cap, 128px thumbnail,
   mobile stacking and description notes from 6a's adjustments). It needs one read-through for passages the
   implementation has since overtaken — particularly anything still describing the inline drop-to-upload
   flow that Phase 5r replaced.

**Depends on:** Phases 6a–6d (all landed). **Blocks:** nothing. Neither follow-up is a gate on Skyler's
review or on merging the branch; both improve what the next change to this feature costs.

---

## Phase 5 modal upload rework

**Landed: `8921029`** ("phase 5r: replace the inline dropzone with a staging upload modal"), with the design
and phasing record in `de12713`. Gate passed. Built as specified in R11, and the pieces are now
`shared/image-upload-modal.component.ts` (in-modal drag-and-drop plus picker, filenames-only staged list,
inline close-confirmation, single `POST`) and `shared/resource-images-card.component.ts` (presentational;
carousel as a plain child, not `<ng-content>`). The chunking is gone — no `chunkFiles`, `ChunkResult` or
`IndexedFileName` remain — and `uploadSummaryCopy` was replaced by the two toast builders
(`uploadPartialFailureToast` plus the total-failure string), which is design.md §7.6's copy.

**What the implementation changed relative to R11, worth recording:** the Escape pairing. R4(b) said the new
overlay's Escape behaviour "belongs in the nesting spec"; it ended up asserted in the modal's **own** spec
(`'Escape does not bypass the confirmation: first press asks, second closes'`) plus a `stopPropagation` whose
comment names the two cross-cutting specs — but `shared/escape-nesting.spec.ts` and
`shared/custom-select-escape-surfaces.spec.ts` were **not extended** to include the upload modal. The
behaviour is covered; the cross-surface census is not. That is the clearest candidate for Luigi's standing
drift-guard spec (Phase 7).

The rest of this section is the decision record for the rework: R10 holds Skyler's nine answers verbatim,
R11 the work list it was built from. Rosalina's parallel `design.md` pass carried the UX/copy half (§4.5,
§7.6).

**Skyler's description, verbatim:**

> "Maybe I need to be sure I understand the upload image mechanism: I was hoping we would have a button to
> upload files, which would produce a modal for drag and drop/file-system uploading. This modal would capture
> the browser portion of the process and dole out error messages based on content: too large, too many, wrong
> file type, etc. Then, once the files have been added to the browser, the user can submit. This fires off the
> API call with the payload, which should also validate, but we can assume at that point a happy path unless a
> user is doing something weird/bad, and reject only bad faith attempts (like someone attempting to hit the API
> endpoint directly with 12 files, etc.) or server-side issues, which would result in an error toast that
> something went wrong and to try again.
>
> This may be a departure from the plan, but I don't think it's a difficult one; I would assume only minor API
> changes might be required, even if there are a larger number of browser ones. Have Yoshi consider this
> approach and come back to me with any questions he has. We can amend the Phase 5 document with this
> information and his perspective as a 'Phase 5 modal upload rework' section."

### R1. What actually changes: drop-is-submit becomes stage-then-submit

The one structural change is that **an upload acquires an intermediate state the committed code has nowhere
to put**: a staged file list, per-file valid/invalid, that the user can see and change before any request
goes out. Everything else follows from that.

Today (`shared/image-dropzone.component.ts`) a pick or drop calls `upload(files)`, which calls `planUpload`,
fires the request(s), and renders the result. The plan is computed and thrown away inside one method; there
is no moment at which a file is "added to the browser" but not yet sent. The rework makes that plan the
modal's own state, recomputed on every add and remove, and moves the request behind a submit button.

**What is reusable as-is, and this is most of it.** The validation rules are already pure functions in
`shared/resource-image-rules.ts`, with their own tests and no Angular or HTTP in them:
`preflightRejectionReason` (type, size), `planUpload` (type/size then cap, in the server's own order) and
`uploadRejectionCopy` (§7's copy table) all carry over untouched. The modal calls exactly the same functions
the dropzone calls today, on each staging change instead of once per submit. Those rules do not change;
their *consumer* and their *timing* change. (`uploadSummaryCopy` is the one exception — it is replaced by the
toast-copy function, R5, because the surface it was written for no longer exists.) `derivePrimaryImageId`, the delete footnote, `compareImages`,
`activeImageIdAfterDelete`, the carousel, the thumbnail component and `core/resource-images.ts` are all
untouched by this rework.

**Decided: `UploadOutcome` stays the modal's output contract.** `ResourceImagesStore.applyUpload`
takes an `UploadOutcome` and merges it into carousel state; if the modal emits the same shape the dropzone
emits today, the store and all 231 lines of its spec are untouched. That seam is worth preserving
deliberately, not by accident — it is what keeps this rework inside one component instead of spreading into
page state.

### R2. API changes required: none. Verified against the controller, not inferred

Checked `MonstersController.UploadImages` (and its three siblings) and `ResourceImageService.UploadAsync`
directly:

- The action is already `[FromForm] IFormFileCollection files` with `[RequestSizeLimit(24 MiB)]` /
  `[RequestFormLimits]`. A staged submit of ≤10 pre-validated files is a strictly easier request than what
  it accepts today.
- It already returns per-file `{ uploaded, rejected }` with reason enum names, 201 when anything landed and
  400 only when every file was rejected. A payload the client believes is clean produces a 201 with an empty
  `rejected` array — the happy path Skyler describes, with no contract change.
- It already validates independently (size → magic-byte sniff → `SKBitmap.DecodeBounds` dimension guard →
  cap). That *is* the "reject bad faith attempts" backstop; a direct POST of 12 files still gets
  `CapExceeded` per file past the cap regardless of what any client did.

So Skyler's "only minor API changes might be required" is right, and the answer is zero. The shift is
entirely in how the frontend *interprets* a rejection: from "render §7's per-file copy inline under the card"
to "this shouldn't normally happen, show a generic error toast." Nothing server-side needs to know that the
client changed its mind about staging.

### R3. Two server-only rejections stay server-only — a knowing tradeoff, decided

"Assume the happy path after the browser validates" is only exactly true for the checks a browser can make.
Of the four rejection reasons, **the browser as currently written can only pre-check two**:

| Reason | Client today | Can the browser check it? |
|---|---|---|
| `TooLarge` | yes (`file.size`) | yes |
| `CapExceeded` | yes (`planUpload`, since `624eef0`) | yes, except for a genuine two-tab race |
| `UnsupportedType` | **extension + declared MIME only** | yes, but only by reading magic bytes (`file.slice(0,12).arrayBuffer()`) |
| `UnreadableOrOversizedDimensions` | **no check at all** | yes, via `createImageBitmap` / `<img>.naturalWidth` |

A `.png` that is not really a PNG (a renamed file, a truncated download, an HEIC exported with a `.jpg`
extension) and a flat-colour or upscaled image above 4096×4096 but under 2 MB are both ordinary user files,
not attacks. Each therefore reaches the server, is rejected there, and comes back as toast text for a file
that will fail identically on every retry — which is the same shape as the failure mode Skyler rejected for
the over-cap copy in design.md §7.4 ("'please try again' would tell the user to retry something that fails
identically every time"). That was the case for pre-checking them in the browser. It was put to Skyler with
that consequence stated, and declined:

**Decided (Skyler, 2026-10-05): "Generic toast is fine."** The modal does **not** pre-check magic bytes or
decoded dimensions. My recommendation was to add both checks for 4-of-4 client/server parity; Skyler
declined after being shown the consequence, so this is a knowing tradeoff, not an oversight: **a legitimately
odd file — a `.png` that isn't really a PNG, or a 6000×6000 image under 2 MB — gets a vague "something went
wrong" message naming the file rather than a specific reason, and retrying will fail the same way.** Accepted
because those files are rare in a `fal-image-gen`-fed workflow where images arrive as 1024×1024 WebP.

**What this buys, and it is not nothing:** staging stays synchronous. No per-file "checking…" state, no
`createImageBitmap`, no object-URL or `arrayBuffer` lifecycle in the modal, and `preflightRejectionReason`
stays the pure, synchronous, already-tested function it is today. Client-side checks remain exactly the two
the browser can do cheaply (size, type-by-extension/MIME) plus the cap.

**Consequence to hold onto:** the server keeps all four checks and stays authoritative (design.md §7.4's
"defense-in-depth, not a relocation of the source of truth" still holds literally). The rejection reasons
`UnsupportedType`-by-magic-bytes and `UnreadableOrOversizedDimensions` are now **reachable only as
post-submit toast text**, never as modal-side per-file copy. `uploadRejectionCopy`'s generic default branch
is what renders them — keep that branch, and keep the reason strings flowing from the server, because the
toast still has to name *which* file failed (R5).

### R4. The three structural decisions, settled

**(a) Drag-and-drop is modal-only. Decided (Skyler, 2026-10-05): "Drag and drop is modal only."**

This is the load-bearing answer, and it unwinds Luigi's dropzone-wraps-carousel projection. That projection
existed for two reasons: the carousel's zero-image empty state needed access to the dropzone's hidden file
input, and the whole card including the carousel was the drop target (design.md §4.1). **A button-plus-modal
dissolves the first reason** (two buttons that both call `openUpload()` share a method, not an `<input>`),
and **modal-only drop dissolves the second** (there is no card-level drag region left to enclose the
carousel). Both reasons are gone, so:

- `image-dropzone.component.ts` is **replaced**, not shrunk. All of its drag plumbing goes: `onDragEnter`/
  `onDragOver`/`onDragLeave`/`onDrop`, the `dragDepth` enter/leave counter, the `carriesFiles` guard, the
  `isDragOver` signal and the template's six drag-state class bindings. The hidden `<input type="file">`,
  `openPicker`, `onFilesPicked`, the upload pipeline and the inline result rendering all move to (or die
  with) the modal.
- The card becomes **presentational**: a header with "+ Add Images", the 10/10 note, the empty state, the
  carousel, and nothing that handles a file. The carousel is a plain child, not `<ng-content>`.
  Whether that card stays a component (`app-resource-images-card`) or becomes markup in each of the four
  detail pages is a Phase 6a call, not this commit's — but this commit should leave it as a component, since
  four pages rendering the same header/empty-state/10-of-10 logic is exactly the drift Phase 5's shared
  components exist to prevent.
- The carousel's `draggable="false"` on its `<img>`s (design.md §4.1, §5.1) was added so a mouse drag
  starting on an image wouldn't fight the card's file-drag detection. With no card-level detection left,
  it is no longer load-bearing — **keep it anyway**, since dragging an image out of a carousel is still not
  a gesture this UI wants, and removing it is a change with no upside.

**What it accepts:** the drag path costs one extra click (open the modal, then drop), on what is plausibly
the common case — dragging a generated image from the file manager onto the resource's page. Skyler chose
the simpler, single-surface model over saving that click, and the simplification is real: one place where
files enter the app, one validation surface, no page-level drag state at all.

**(b) The modal can be closed before submission, with a confirmation. Decided (Skyler, 2026-10-05):**
"Yes, the modal can be closed before submission, but after files have been added. We should produce an alert
to confirm closing the modal." (Question 6, on discarding staged files, answered with "See my answer to 5.")

So: closing with files staged and not yet submitted is allowed and **prompts for confirmation** — the
opposite of my "discard silently" recommendation, which is withdrawn. Closing with nothing staged needs no
prompt.

*Implementation shape — my call, within his decision: the confirmation is an inline step inside the upload
modal (its footer swaps to a "discard these files?" confirm/cancel pair), not a second dialog on top of the
first and not a native `window.confirm`.* It satisfies "an alert to confirm closing" without introducing a
modal-over-modal pattern this app has never had, keeps Escape handling single-surface (one overlay, one
Escape owner), and avoids a blocking native dialog that doesn't match the app's visual language anywhere
else. **What it accepts:** a modal with two footer states is a small new micro-pattern, rather than reuse of
`ConfirmDeleteModalComponent`'s shell — which is the right trade here anyway, since the copy is not
delete-flavoured.

*Correcting my own earlier estimate:* I previously said a confirmation would add "four new
`<app-confirm-delete-modal>` call sites." That was wrong — the upload modal is one shared component, so even
the nested-dialog version would have been **+1** call site in +1 template for
`shared/confirm-delete-modal.call-sites.spec.ts`'s census. The inline-step version is **+0**. Either way the
cost argument against it was overstated; the real reason to prefer the inline step is Escape ownership and
the absence of a nesting precedent.

**Close *during* an in-flight upload is a separate thing, and stays blocked.** Skyler's answer is scoped to
"before submission"; **it does not say an in-flight upload is cancellable, and I am not reading one into
it.** My R4(b) recommendation stands unless Skyler says otherwise: submit and close are both disabled while
the request is in flight, with the spinner on the submit button. The reason is mechanical, not stylistic — a
closed modal is a destroyed component, `takeUntilDestroyed` cancels the request, and **the server may already
have committed it**, so a cancelled-looking upload could still land. Allowing in-flight close would mean
moving the request and its state out of the modal into `ResourceImagesStore` (which outlives the modal but
not the page) and putting a spinner back on the card; that is a bigger change than it looks and nothing in
the answers asks for it. Flagged here as a one-line correction if that reading is wrong.

**Escape-behaviour specs — plan for them, don't discover them.** A new overlay surface interacts with
`shared/escape-nesting.spec.ts` and `shared/custom-select-escape-surfaces.spec.ts`, the two cross-cutting
Escape specs. The upload modal must close on Escape like every other surface; with the inline-confirm shape
above, Escape with files staged should route to the same confirm step rather than closing straight through
(otherwise Escape bypasses the very prompt his answer asks for). That pairing belongs in the nesting spec.
Small, but it is a gate-failing surprise if nobody plans for it.

### R5. Where errors render now: two surfaces, split at submit

**Pre-submit, in the modal, per file.** §7's per-file copy keeps a home and arguably a better one: next to
each staged file, where the user can act on it (remove it, pick a different one) instead of reading it after
the fact. The reasons reachable here are exactly the three the browser can judge — `UnsupportedType` (by
extension/MIME), `TooLarge`, `CapExceeded` — rendered by the existing `uploadRejectionCopy`, which already
has copy for all three. These are Skyler's "too large, too many, wrong file type, etc."

**Post-submit, as one toast.** design.md §4.3's inline-under-the-card rejection list is gone. The partial
case is now settled — **decided (Skyler, 2026-10-05): "Partial rejection should keep the successful image
uploads and produce an error toast identifying the files by name that failed."**

That gives three post-submit outcomes, and the first two were not in the original description:

| Response | Images kept | User sees | Modal |
|---|---|---|---|
| 201, nothing rejected | all | nothing (the new images appear in the carousel — that *is* the feedback) | closes |
| 201, some rejected | **the successful ones, kept** | **one error toast naming the failed files** | closes |
| 400, all rejected | none | one error toast (same shape, names every file) | **stays open**, files still staged — see below |

**On the 400/all-rejected case:** nothing landed, so closing would throw away a selection the user has to
rebuild just to retry — and "try again" is the message. Keeping the modal open with the files still staged
is my call within Skyler's answers rather than something he specified; flag it if he wants the modal to
close there too.

**The toast is a single auto-dismissed string, and that constrains the copy.** `NotificationService.error()`
takes one `message: string` and dismisses it after **4 seconds** (`core/notifications.ts`). Naming up to ten
filenames in one 4-second toast is more than can be read, and this would be the app's first toast that has
to convey a *list*. Architecturally that means: **one pure function in `resource-image-rules.ts` builds the
toast string from an `UploadOutcome`** (testable, no Angular, same convention as every other rule here), and
it should truncate the enumeration rather than concatenate ten names. Exact wording and the truncation
threshold are Rosalina's copy call, not mine — the structural requirement is just that the toast names files
and that the string is produced by a tested pure function.

**`uploadSummaryCopy` is replaced, not kept.** Its "X of Y images were added" sentence was built for the
inline card surface that no longer exists, and its guard (render only when some landed *and* some failed) is
now exactly the toast's trigger condition. Fold it into the new toast-copy function rather than keeping two
near-identical copy builders; its existing tests migrate to the new function's name.

**Who fires the toast: the modal, not the store.** The modal owns the request, so it raises
`NotificationService.error(...)` on the response and still emits the same `UploadOutcome` for the store to
merge. That preserves R1's seam — `ResourceImagesStore.applyUpload` keeps its early-return-on-nothing-
uploaded shape and its spec stays untouched — and it keeps notification concerns out of a store whose job is
carousel state.

**Keep `SUPPRESS_ERROR_TOAST` on the upload request.** `core/resource-images.ts` sets it so the generic
`httpErrorInterceptor` toast ("Request failed (400) for POST /api/…") never fires for uploads. Now that
uploads *do* raise a toast, a future reader may see the suppression as obsolete and remove it — that would
produce two toasts for one failure, one of them useless. The suppression stays; the specific toast is raised
deliberately by the modal.

### R6. This subsumes the open chunking question (design.md §9.5)

Yes, and more strongly than client-side cap enforcement did on its own. Today the multi-request path is
unreachable because `remainingSlots ≤ 10` happens to equal the per-request limit. Under staging the modal
**refuses to stage** past the remaining slots — that is Skyler's "too many" error, produced at add time — so
the submitted set is ≤10 by construction *and the user has seen the over-cap files flagged before pressing
submit*. The chunk loop, `ChunkResult`, `IndexedFileName`'s index-gap bookkeeping, `mergeUploadOutcome`'s
per-chunk reconciliation and design.md §4.4's "spinner spans all chunks" all become unreachable together.

**Decided (Skyler, 2026-10-05): "Delete the chunking logic; it will not be needed."** This closes
design.md §9.5 and reverses Luigi's "keep it with an explanatory comment" recommendation. Her reasoning —
it costs little and stops being dead the moment the two caps move independently — is sound for stable
shipped code, but the cross-chunk merge is the most intricate logic in `resource-image-rules.ts` (~70 lines
of name-matching rejections to files, with duplicate-name caveats), and carrying it through a rework that
rewrites its only caller is a different trade than leaving it alone.

**Deleted:** `chunkFiles`, `ChunkResult`, `IndexedFileName`, and `mergeUploadOutcome`'s per-chunk loop
(including the unmatched-rejection fractional-index bookkeeping). The upload becomes one request, so
matching the server's `rejected[]` back to submitted files is a single pass over one response.

**What it accepts, and the mitigation:** if `MAX_FILES_PER_UPLOAD_REQUEST` (a 24 MiB request-size concern)
ever diverges from `MAX_IMAGES_PER_RESOURCE` (a per-owner data rule), multi-request upload has to be
rebuilt. The two constants in `core/resource-images.ts` therefore **stay separate and distinctly
commented** even with the loop gone, and the modal stages up to `min(remainingSlots,
MAX_FILES_PER_UPLOAD_REQUEST)` so the invariant lives in one expression. Today both are 10, so that `min`
is a no-op — which is the point: it documents why one request is always enough instead of leaving it to
coincidence.

### R7. Test impact: mostly relocation, one spec substantially reworked

Committed image specs, 1,272 lines across six files:

| Spec | Lines | Impact |
|---|---|---|
| `resource-image-rules.spec.ts` | 298 | **Survives nearly whole.** Every pure-rule test (type/size, the 8+5→2/3 cap math, the three per-reason copy strings, derivation, footnote, active-index, ordering) is unchanged, because the rules are unchanged. `chunkFiles` and the multi-chunk `mergeUploadOutcome` cases are **deleted** (R6); `uploadSummaryCopy`'s cases **migrate** to the new toast-copy function (R5). |
| `image-dropzone.component.spec.ts` | 323, 18 tests | **Replaced by `image-upload-modal.component.spec.ts` plus a small card spec.** ~6 validation/cap tests move to the modal spec with the same assertions on the same rules; ~4 shell tests (empty state, 10/10 block, host disablement, projection→plain child) move to the card spec; the **4 drag tests are deleted outright** (R4(a): no card-level drag exists to test); ~4 tests about the spinner, the merged outcome and "never more than one request" are rewritten as single-request submit tests or deleted with chunking. **New** coverage this spec never had: staged-list add/remove, the close-with-staged-files confirm step, Escape routing to that confirm, and the three post-submit outcomes in R5's table. |
| `resource-images.store.spec.ts` | 231 | **Untouched** — R1's `UploadOutcome` seam is kept deliberately so this stays true. |
| `image-carousel.component.spec.ts` | 242 | Untouched. |
| `core/resource-images.spec.ts` | 100 | Untouched — including the 400-unwrapping test, since the 400 path is still how an all-rejected response reaches the toast. |
| `resource-thumbnail.component.spec.ts` | 78 | Untouched. |

Plus two cross-cutting specs to check rather than rewrite: `shared/escape-nesting.spec.ts` (the new overlay
surface, R4(b)) and `shared/confirm-delete-modal.call-sites.spec.ts` (unchanged by the inline-confirm shape —
census stays at "16 in 14 templates" for this commit; Phase 6a still updates it for the delete footnote).

No backend test changes, since there are no backend changes. The honest summary: one spec file is replaced
and grows new coverage, one loses its chunking cases and migrates one copy function's, four are untouched,
and most of what looks like "lost" dropzone coverage is the same assertions re-hosted in the modal.

### R8. Impact on Phase 6, and sequencing

**Small, and modal-only drop makes it smaller than Phase 6 currently assumes.** Each per-domain sub-phase
(6a–6d) still binds the store, the card and the carousel; it now also renders a second modal instance for
upload alongside `<app-confirm-delete-modal>`. The upload modal is self-contained (it owns its own
open/close and staged state, and needs no `pendingDelete`-style host state), so for Bystander and Location —
the two pages with no modal infrastructure at all — this is one more element and one more `openUpload()`
call, not a second new pattern. And with no card-level drag, the page templates lose the drag-state wiring
Phase 6 would otherwise have had to get right four times.

**Sequencing — decided (Skyler, 2026-10-05): "Land this rework now, before phase 6."** This is commit
**Phase 5r**, between Phase 5 and Phase 6a, with its own gate. The Git workflow commit list (now eleven
commits) and the per-phase verification gate section have been amended accordingly. Phase 6a stays the pilot
and gets *more* valuable for it: the modal is new UX built after Phase 5 shipped, so Monster is the first
real-page proof of it, and any correction lands once rather than four times.

### R9. Cost relative to what is committed

- **New:** `shared/image-upload-modal.component.ts` + `.html` + spec — the real new work, and the only
  genuinely new component. Staged-list state, per-file validity rendering, the submit call, the
  close-confirm step, and the post-submit toast. Synchronous throughout, since R3 declined the async
  signature/dimension checks.
- **Replaced:** `image-dropzone.component.ts` → a presentational `app-resource-images-card` (header,
  "+ Add Images", 10/10 note, empty state, carousel as a plain child). All drag plumbing deleted (R4(a)).
- **Shrinks:** `resource-image-rules.ts` loses `chunkFiles`, `ChunkResult`, `IndexedFileName` and
  `mergeUploadOutcome`'s per-chunk loop (~70 lines), and swaps `uploadSummaryCopy` for the toast-copy
  function (R5). Gains nothing: staged state lives in the modal, computed from the `planUpload` that already
  exists.
- **One-line change:** `core/resource-images.ts` — the `upload()` doc comment stops saying chunking is "the
  caller's job." Constants, paths, suppression and the 400-unwrapping all stay exactly as they are.
- **Untouched:** all four controllers, `ResourceImageService`, the migration, every backend test,
  `ResourceImagesStore`, the carousel, the thumbnail component.

Frontend-only, one new component, one component replaced by a simpler one, ~70 lines of rules deleted, no
contract change, no data change, no backend change. Skyler's read that this is "not a difficult one" matches
what the code shows.

### R10. Decisions — Skyler's answers, verbatim (2026-10-05)

All nine questions from this section's previous revision are answered. Quoted exactly, in the original
numbering, with where each one is applied. Two of my recommendations were accepted (8 and 9) and two were
overruled (3 and 6); the overrules are recorded as such rather than smoothed over.

| # | The question it answers | Skyler, verbatim | Applied in |
|---|---|---|---|
| 1 | Does drag-and-drop onto the card survive, or is it modal-only? | "Drag and drop is modal only." | R4(a) — **the load-bearing one**: Luigi's dropzone-wraps-carousel projection unwinds, all card-level drag plumbing is deleted |
| 2 | Previews of staged files, or just names? | "Just a list of file names." | R11 — no object-URL lifecycle, no `<img>` decode in the modal; the staged list is text |
| 3 | Should the modal pre-check magic bytes and dimensions, or is a generic toast acceptable? | "Generic toast is fine." | R3 — **my recommendation overruled, knowingly**: the two server-only reasons stay server-only and surface as a vague toast; staging stays synchronous |
| 4 | What happens on a partial server rejection (3 of 5 landed)? | "Partial rejection should keep the successful image uploads and produce an error toast identifying the files by name that failed." | R5 — new post-submit path the original description didn't cover; successes are kept, one toast names the failures |
| 5 | Is the modal closable mid-upload? | "Yes, the modal can be closed before submission, but after files have been added. We should produce an alert to confirm closing the modal." | R4(b) — closing **before submission** is allowed with a confirm step; in-flight close is *not* addressed by this answer and stays blocked |
| 6 | Discard staged files silently on close? | "See my answer to 5." | R4(b) — **my "discard silently" recommendation withdrawn**; a confirmation is required |
| 7 | Keep "+ Add Images" disabled at 10/10? | "Yes, disable when 10 images are present." | R11 — design.md §7.5 as already built, carried over to the card |
| 8 | Delete the chunking, or keep it with a comment? | "Delete the chunking logic; it will not be needed." | R6 — **recommendation accepted**; closes design.md §9.5 and reverses Luigi's keep-it call |
| 9 | Before Phase 6a, or after? | "Land this rework now, before phase 6." | R8 — **recommendation accepted**; commit Phase 5r, between 5 and 6a |

**One thing these answers do not settle, flagged rather than assumed:** answer 5 scopes closability to
"before submission." Whether an upload already in flight can be abandoned is a different question with a
real mechanical consequence (R4(b)), and I have not read an answer into it — in-flight close stays disabled
until Skyler says otherwise. Likewise, the 400/all-rejected case keeps the modal open with files staged
(R5), which is my call inside his answers, not his words.

### R11. Work list for the Phase 5r commit

Implementable as written. Copy wording comes from Rosalina's design.md pass; everything below is structure.

**New — `shared/image-upload-modal.component.ts` / `.html` / `.spec.ts`:**
- Inputs `ownerType`, `ownerId`, `currentCount`, `visible`; output `uploaded` (an `UploadOutcome`, per R1's
  seam) plus a `closed` event. Decorator `@Input()`/`@Output()` with signal-backed setters for anything a
  `computed()` reads, per Luigi's review §1.1 and `mystery-select.component.ts`'s documented bug.
- Drag-and-drop **inside the modal** (the only drop surface in the app now) plus the hidden
  `<input type="file" multiple>` and a "choose files" button. The `carriesFiles`/`dragDepth` logic moves here
  from the dropzone rather than being rewritten.
- **Staged list is filenames only** (answer 2), each row with its validity and, when invalid,
  `uploadRejectionCopy`'s message for its reason; a remove control per row. Re-run `planUpload` over the
  staged set on every add/remove, so the cap arithmetic and the type/size checks stay the single source
  they already are. Stage up to `min(remainingSlots, MAX_FILES_PER_UPLOAD_REQUEST)` (R6).
- Submit: one `POST` via the untouched `ResourceImageService.upload`, spinner on the submit button, submit
  and close both disabled while in flight (R4(b)). Emit one `UploadOutcome`; raise the toast per R5's table.
- Close: with nothing staged, close immediately; with files staged, swap the footer to the confirm step
  (R4(b)). Escape routes to the same step rather than closing through it.

**Replaced — `image-dropzone.component.ts` → `shared/resource-images-card.component.ts` (+ `.html`, spec):**
- Header with "+ Add Images" (opens the modal; **disabled at 10/10** with the existing inline note, answer 7),
  the zero-image empty state whose button also opens the modal, and the carousel as a **plain child, not
  `<ng-content>`**. No file input, no drag handlers, no upload pipeline, no inline result list.

**Trimmed — `shared/resource-image-rules.ts`:**
- Delete `chunkFiles`, `ChunkResult`, `IndexedFileName`, and `mergeUploadOutcome`'s per-chunk loop; reduce
  the merge to a single-response pass (R6).
- Replace `uploadSummaryCopy` with the toast-copy function (R5); keep `preflightRejectionReason`,
  `planUpload`, `uploadRejectionCopy` (all three branches, including the generic default that R3 now relies
  on) and every non-upload rule exactly as they are.

**Untouched on purpose:** `ResourceImagesStore` (and its spec), `core/resource-images.ts` apart from one doc
comment, the carousel, the thumbnail component, and the entire backend.

**Verification for this commit's gate:** `npm run build` and `npm run test -- --watch=false` green;
`shared/escape-nesting.spec.ts` and `shared/confirm-delete-modal.call-sites.spec.ts` still green; the modal
exercised on the dev server (Playwright self-check) for the three post-submit outcomes in R5's table, the
close-with-staged-files confirm, and the 10/10 disabled state. Since no detail page is wired until Phase 6a,
the dev-server check needs a scratch route or the Phase 6a pilot page in a throwaway state — note which was
used in the commit message.

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

1. **Feature-branch name — resolved 2026-10-04.** Skyler: "Continue with this branch." The feature branch is
   `resource-images`. See Git workflow above.
2. **In-flight close — shipped as disabled; never explicitly ruled on, and that is fine.** Skyler's answer 5
   scoped closability to "before submission," so whether an upload *already in flight* can be abandoned was
   never answered. It shipped the way R4(b) recommended: submit and close are both disabled while the
   request is in flight, because a closed modal is a destroyed component and `takeUntilDestroyed` would
   cancel a request the server may already have committed. **Not open in any blocking sense** — the
   behaviour exists, is tested, and only needs revisiting if Skyler wants a cancel affordance (which
   design.md §8/§9.3 already hold as a deferred nice-to-have).

**Nothing in this section blocks Skyler's review or the merge.** The two genuinely outstanding items are
post-deploy checks (Phase 3's Railway upload test and the Linux-container SkiaSharp smoke test, both
deferred by decision) and Phase 7's two in-flight follow-ups.

(Item 3, "ImageSharp vs. SkiaSharp," is decided — see §1 item 6 and §4a below. The former item 2's subject,
Minion's `GetByMonsterIdAsync`, is resolved — see §4a and the header revision notes. The nine modal-rework
questions that were item 2 in the previous revision are all answered — see the rework section's R10.)

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
- **Modal upload rework — nine answers, 2026-10-05 (Phase 5r):** recorded verbatim in the **Phase 5 modal
  upload rework** section's R10 table rather than duplicated here, since each answer needs its surrounding
  assessment to be actionable. In brief: drag-and-drop is modal-only (which unwinds Luigi's
  dropzone/carousel projection), the staged list is filenames only, the two server-only rejection reasons
  surface as a generic toast (a knowing tradeoff, my recommendation overruled), a partial rejection keeps
  the successful uploads and toasts the failed filenames, closing with staged files prompts for
  confirmation (my "discard silently" recommendation overruled), "+ Add Images" stays disabled at 10/10,
  the chunking is deleted outright, and the rework lands before Phase 6a as commit Phase 5r.
- **Phase restructure (§2 Phase 6, 2026-10-04):** Skyler confirmed Luigi's pilot-then-rollout idea and
  extended it to a sub-phase per domain object: "this is an excellent idea, and I actually think we should
  add a sub-phase for each domain object, starting with Monster as the pilot." Old Phases 6, 7, and 8 are
  replaced by Phase 6a (Monster) → 6b (Minion) → 6c (Bystander) → 6d (Location), each wiring that domain's
  detail and list halves together, plus a small Phase 7 for any genuinely cross-cutting leftover.

---

## 5. Findings that outlived their phases

Three things this feature turned up that are **not** about resource images, and are worth more than the
sub-phase notes they were found in. Recorded here because the next feature will meet them again.

### 5(a) A contract change needs both sides enumerated, because nothing links the two artifacts

Phase 4's work list named four C# records (`MonsterListItemResponse` and its three siblings in
`ApiContracts.cs`) and **zero TypeScript interfaces**. The field was added server-side, the phase's gate went
green — backend tests pass, the JSON is correct — and the client simply never saw `primaryImageId`, because
`core/models.ts`'s list DTOs were a separate, unmentioned artifact. **The gap then recurred in all four
domain sub-phases**: each one rediscovered it, independently, as "the thumbnail is null and the API says it
isn't."

This is a tooling gap, not carelessness. There is no generated client, no shared schema and no test that can
fail when a C# record and a TypeScript interface disagree — the two files are joined only by convention and
by whoever remembers. **The practice: any plan item that adds or changes a field across the API boundary
lists the C# record *and* the TypeScript interface in the same work-list bullet, and its verification step
asserts the value arrives in the browser, not merely that the endpoint returns it.** "Add `X` to the response"
is only half a task in this repo. Recurrence across four sub-phases is the evidence that one reminder in one
phase is not enough — it belongs in the work-list line itself.

### 5(b) The list `<ul>`'s grid rows overflowed their track on mobile — a pre-existing bug, fixed here

The four list templates put each row in a grid track, and grid items default to `min-width: auto`, so a row
whose content could not shrink below its intrinsic width pushed past the track instead of wrapping. The
visible symptom was the **delete button sliding off-screen** on a phone, on all four lists. It had nothing
to do with images — adding a 128px thumbnail to each row simply made an existing overflow impossible to
miss. Fixed across all four templates during 6a's adjustment pass (`dcb2acf`, `767f1ae`), with the reasoning
in `b8f6115`.

Two things to carry: **`min-width: 0` (or an equivalent shrink allowance) is required on grid/flex children
that hold unbounded text**, and this is the kind of defect that only surfaces at a viewport nobody checks by
default. The feature that exposes a latent layout bug is rarely the feature that caused it; budget for
fixing it there anyway, because the alternative is shipping a known-broken row.

### 5(c) A spec that encodes an absence will pass while the UI is wrong

`minions-list` rows rendered no description, where Monster, Bystander and Location rows all did. It read as
a deliberate domain difference for long enough to be written into the plan's record as one — and a spec
asserted the row's contents in a shape that was satisfied by the description's absence, so the suite stayed
green while the page was wrong. It was simply an oversight, corrected in `1c1a580` and the record set
straight in `a661cbd`.

**The lesson is about what a passing test proves.** A spec written from the implementation rather than from
the intent locks in whatever the implementation happened to do, including nothing. Where four domains are
meant to be alike, "each page renders what it should" is weaker than "these four pages render the same
fields" — the second kind of assertion is exactly what Phase 7's drift-guard spec is for, and the Minion
description is the concrete case that argues for it.

---

## Verification Checklist

**Where the evidence comes from.** Each box below was verified at its own phase's gate before the next phase
started (that was the point of the per-phase gate): `dotnet build`/`dotnet test` for Phases 1–4, `npm run
build`/`npm run test -- --watch=false` for 5, 5r and 6a–6d. **Phases 6a–6d were additionally
Playwright-verified against the real dev server on seeded data**, with throwaway records created and deleted
so the checks exercised the actual endpoints and the actual DB rather than fixtures. The artifact-existence
items (test classes, fixtures, deleted functions, component files) were re-confirmed by code inspection
during this closing pass, 2026-10-07. Unchecked boxes below are unchecked on purpose and say why.

**Phase 1** — `aa75d9e`:
- [x] `dotnet ef migrations has-pending-model-changes` returns clean after `AddResourceImages`; migration
      applies to a fresh DB (app starts against an empty `docker compose up -d postgres` database)
- [x] `PrimaryImageId` FKs configured `SetNull` on all four owner entities, via `HasOne<ResourceImage>().WithMany()`
- [x] Composite index on `(OwnerType, OwnerId, SortOrder)`, named `idx_resource_images_owner_sort`, present on `ResourceImage`
- [x] Four FK indexes present: `idx_monsters_primary_image_id`, `idx_minions_primary_image_id`,
      `idx_bystanders_primary_image_id`, `idx_locations_primary_image_id`
- [x] `OwnerType` stored via `.HasConversion<string>()`, documented as a new pattern (no existing `HasConversion` elsewhere)
- [x] Opt-in real-Postgres test (`Category=Postgres`) runs `MigrateAsync()` against the compose Postgres and
      passes — `ResourceImageMigrationPostgresTests`

**Phase 2** — `7cf5e17`:
- [x] All four rejection reasons (§7.1) unit-tested, including WebP RIFF-container detection specifically
      (`ResourceImageTestFixtures.RiffWaveBytes` proves a non-WebP RIFF file is rejected)
- [x] Decompression-bomb dimension guard unit-tested (oversized declared dimensions rejected before full decode)
- [x] Cap partial-accept math tested (8+5→2 accepted/3 rejected, per §7.4's worked example)
- [x] Primary derivation tested, including the `SortOrder`-then-`Id` tie-break: null-default, explicit-set,
      delete-current-primary (confirms `SetNull` FK), duplicate-`SortOrder` tie resolved deterministically
- [x] `ResourceImage.CreatedAt` is set explicitly and asserted `!= default` in a test
- [x] Batch upload is a single `SaveChangesAsync()` call, not one per file
- [x] Opt-in `Category=Postgres` test confirms `SetNull` and the derivation projection against real Postgres —
      `ResourceImageServicePostgresTests`

**Phase 3** — `eb1911e`:
- [x] All six endpoints present on all four controllers
- [x] `IResourceImageService` registered in `Program.cs`
- [x] `[RequestSizeLimit(24 MiB)]`/`[RequestFormLimits(MultipartBodyLengthLimit = 24 MiB)]` set on the upload
      action; a body over 24 MiB returns 400 Bad Request (confirmed in Phase 3; not 413, corrected in
      `c680918`) rather than hanging or 500ing
- [x] `/file` and `/thumbnail` responses carry correct `Content-Type` and `private, ... immutable` cache headers
- [x] `/file` and `/thumbnail` return 404 when `imageId` does not belong to `{id}`; `PUT .../primary` 404s on a non-owned id
- [x] **Owner-delete cleanup:** deleting a Monster, Minion, Bystander, or Location also deletes that owner's
      images in the same transaction; deleting a Monster with an imaged Minion leaves zero `resource_images`
      rows for either
- [ ] **Post-deploy, still outstanding (deferred by decision, §3.2):** manual batch upload test against a
      real Railway deploy. Not reachable until the branch deploys; deferred by Skyler, not dropped.
- [ ] **Post-deploy, still outstanding (§1 item 6):** Linux-container SkiaSharp smoke test. A missing or
      mismatched native library is a runtime `DllNotFoundException` on first upload, which no amount of
      Windows-side `dotnet test` can catch. Same bucket as the Railway check: do both on first deploy.

**Phase 4** — `9d9b054`:
- [x] The four main `GetAllAsync` list endpoints return `PrimaryImageId`, correct for both zero-image and
      populated resources — **by-mystery variants (`GetMonstersByMysteryIdAsync`,
      `GetByMysteryAsync`×2) are out of scope (scope cut, 2026-10-04) and do not carry the field**
- [x] Four projection sites carry the field: Monster's, Minion's, Location's, and Bystander's `GetAllAsync`
      (Minion's `GetByMonsterIdAsync` out of scope, per Skyler)
- [x] Derived primary (null column → lowest `SortOrder`, then lowest `Id`) returned by the list; agreement
      test against `IResourceImageService`'s derivation (not over HTTP) passes for the four cases in
      workflow doc §2.2, for all four owner types
- [ ] **Never in this phase's list, and that was the defect:** the matching TypeScript interfaces. Added
      later, per domain, in 6a–6d. Left unchecked deliberately as the standing record of §5(a).

**Phase 5** — `a040ebc` (+ `624eef0`):
- [x] `app-image-dropzone`, `app-image-carousel`, `app-resource-thumbnail` unit-tested against `design.md`
      §3's response shapes — **the dropzone was then replaced in 5r**; the carousel and thumbnail stand
- [x] `app-resource-thumbnail`: `thumbnailUrl: string | null`; placeholder on null and on `<img>` error; error
      state resets when the URL changes
- [x] `star`/`chevron` icons added per the sprite recipe; `--color-image-primary-indicator` token added
- [x] `ResourceImagesStore` and `core/resource-images.ts` built and unit-tested against fixtures; no page
      wiring yet

**Phase 5r (modal upload rework — see the rework section, R11)** — `8921029`:
- [x] `app-image-upload-modal` built: in-modal drag-and-drop plus file picker, staged list of **filenames
      only**, per-file validity from `planUpload`/`uploadRejectionCopy`, remove-per-row, one `POST` on submit
- [x] `app-image-dropzone` replaced by a presentational card (`app-resource-images-card`): no file input, no
      drag handlers, no upload pipeline; carousel is a plain child, **not `<ng-content>`**; "+ Add Images"
      disabled at 10/10 with the existing inline note
- [x] Post-submit behaviour matches R5's table: all-good silent, partial keeps successes and toasts the
      failed filenames, all-rejected toasts and leaves the modal open with files staged
- [x] Closing with files staged shows the inline confirm step; Escape routes to it rather than closing
      through it; submit and close both disabled while a request is in flight
- [x] Chunking deleted: `chunkFiles`, `ChunkResult`, `IndexedFileName` and `mergeUploadOutcome`'s per-chunk
      loop gone; `uploadSummaryCopy` replaced by `uploadPartialFailureToast` and the total-failure string
      (design.md §7.6), with its tests migrated
- [x] `SUPPRESS_ERROR_TOAST` still set on the upload request (one toast, raised by the modal — not two)
- [x] `ResourceImagesStore` and its spec untouched (the `UploadOutcome` seam held);
      `confirm-delete-modal.call-sites.spec.ts` and `escape-nesting.spec.ts` still green
- [ ] **Partially done:** the upload modal is **not** represented in `escape-nesting.spec.ts` or
      `custom-select-escape-surfaces.spec.ts`. Its Escape behaviour is asserted in its own spec and it
      `stopPropagation`s correctly, so behaviour is covered — the cross-surface census is not. First
      candidate for Phase 7's drift-guard spec.

**Phase 6a (Monster, pilot)** — `93d719e`:
- [x] `monster-detail`: upload/delete/set-primary work end-to-end against the real API (Playwright, dev
      server, seeded data); Minions-block placement resolved with Rosalina before building, principle
      recorded in `7e17cf0`
- [x] `monsters-list` renders real thumbnails and the domain-badge empty state
- [x] All three footnote cases (§6) reachable and correctly worded; all §7 rejection strings render verbatim
- [x] `confirm-delete-modal.call-sites.spec.ts` census updated for monster-detail's new `[footnote]` shape

**Phase 6b (Minion)** — `2cb7d87`:
- [x] `minion-detail`: upload/delete/set-primary work end-to-end; `minions-list` renders real thumbnails
- [x] Footnote cases and §7 rejection strings verbatim; modal census spec updated for minion-detail
- [x] Nested Minions-list-in-monster-detail shows no thumbnail (explicitly out of scope for this pass, per Skyler)
- [x] List-row description added (`1c1a580`) — found here, not a domain difference; see §5(c)

**Phase 6c (Bystander)** — `78b9626`:
- [x] `bystander-detail`: delete/modal infrastructure built from scratch; upload/delete/set-primary work end-to-end
- [x] `bystanders-list` renders real thumbnails; footnote cases and §7 rejection strings verbatim

**Phase 6d (Location)** — `624aa3e`:
- [x] `location-detail`: delete/modal infrastructure built from scratch; upload/delete/set-primary work end-to-end
- [x] `locations-list` renders real thumbnails; footnote cases and §7 rejection strings verbatim
- [x] **Cross-domain consistency comparison run here** (the check Phase 7 was scoped for): normalised hashes
      consistent across all four domains — card/carousel collapse to two hashes differing by exactly the
      intentional modal-ownership line; upload modal, row classes and thumbnail block byte-identical; one
      real misplacement found and fixed

**Phase 7 (resolved — see the Phase 7 section):**
- [x] Shared icon/token work and cross-domain consistency confirmed — by 6d's hash comparison, not by a
      separate pass
- [x] Upload behaviour identical across all four domains — guaranteed structurally, since all four render the
      same `app-image-upload-modal` instance rather than four copies (the comparison confirms it)
- [ ] **In flight (Luigi):** standing drift-guard spec, turning 6d's one-off comparison into an enforceable
      invariant; first target is the Escape-census gap above
- [ ] **In flight (Rosalina):** `design.md` staleness pass for passages the implementation overtook
