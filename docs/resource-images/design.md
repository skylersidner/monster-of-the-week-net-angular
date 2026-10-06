# Resource Images — UX / Visual Design

**Prepared by:** Rosalina (Designer)
**Requested by:** Skyler Sidner
**Status:** Design only, not implemented. For review before Yoshi (architecture/phasing), Bowser (backend), and Luigi (frontend) weigh in.
**Scope:** Image upload/display for Monsters, Minions, Bystanders, Locations. Mystery Wizard integration is explicitly deferred (§8).

Grounded in the current codebase, verified directly rather than assumed:
`monsters/pages/monster-detail/monster-detail.html`, `monsters/pages/monsters-list/monsters-list.html`, `shared/confirm-delete-modal.component.ts`, `styles.css`, `docs/updates/svg-symbol-icons.md`, `Controllers/MonstersController.cs`, `Data/Entities/DomainEntities.cs`, `Contracts/ApiContracts.cs`, `Program.cs`, `tools/fal-image-gen/README.md`. Tone/structure follows `docs/updates/mystery-entity-linking-ux.md` and `docs/hunter-playbooks/architecture.md`.

---

## 0. The one fact that shapes almost everything below

The cap is confirmed at **10 images × 2 MB each**. Two further facts hold regardless of the exact cap: every image is produced externally by an AI imaging API at a **fixed 1024×1024 square**, and Skyler's own testing against the real generation pipeline (`tools/fal-image-gen`) is landing consistently **under 500 KB per image** — the 2 MB cap is a ceiling well above typical output, not the expected size.

At this confirmed size, image bytes belong directly in **Postgres, as `bytea`** (§2) — object storage isn't warranted at this data volume. A **generated thumbnail** is still worth having for list rows and carousel peeks, reasoned fresh at this size rather than carried over from a larger one (§2.1). **Uploading is a button that opens a modal: files are staged and validated in the browser, then submitted in one request**, with a single busy spinner and no per-file progress (§4.4).

---

## 1. Data model (conceptual)

### 1.1 The image row

One row per uploaded file:

| Field | Notes |
|---|---|
| `Id` | Guid, same convention as every other entity. |
| `OwnerType` | Discriminator — `Monster` \| `Minion` \| `Bystander` \| `Location`. See §1.3. |
| `OwnerId` | The owning resource's Id. No database-level foreign key — a discriminator + id pair can't reference four different tables — so ownership is validated at the service layer on write (the owner must exist, and be the type it claims to be) rather than enforced by the schema. Accepted tradeoff of the single-table decision in §1.3, not an oversight. |
| `FileName` | Original filename as uploaded, for display in the delete-confirmation modal and as a fallback `alt`. |
| `ContentType` | `image/jpeg`, `image/png`, or `image/webp` — validated server-side (§7), not trusted from the client. |
| `SizeBytes` | int. Enforces and documents the 2 MB cap after the fact; also lets a future admin view total storage without re-reading blobs. |
| `Width`, `Height` | Stored explicitly rather than assumed, even though every image is expected to arrive at 1024×1024 today (the AI-generation source, per Skyler). If that upstream fact ever changes, nothing here has silently hardcoded 1024 anywhere it would need un-picking. |
| `ImageBytes` | `bytea` — the original file's bytes, stored directly on the row (§2). |
| `ThumbnailBytes` | `bytea` — the generated thumbnail's bytes (§2.1), a second, smaller derived blob on the same row, not a resize-on-read. |
| `SortOrder` | int, assigned as `(current max for this owner) + 1` at upload time, incrementing per file **within** a batch in drop/pick order. This is what makes carousel order and "first-uploaded" deterministic even when several files land in the same request and could otherwise tie on a timestamp. |
| `CreatedAt` | Single timestamp field — images are immutable once stored (replace = delete + re-upload), so there's no `UpdatedAt` to carry the way `ITimestamped` gives every other entity; that interface doesn't fit here and I wouldn't force it on. |

No `IsPrimary` boolean on the row. See §1.2.

### 1.2 Primary image

A boolean-per-row flag needs an application-enforced "at most one true per owner" invariant, which is exactly the kind of thing that drifts (two rows both `true` after a bad concurrent write, or zero after a bad delete). Instead: **a nullable `PrimaryImageId` FK on the owning entity itself** (`Monster.PrimaryImageId`, and the same shape on Minion/Bystander/Location).

- `PrimaryImageId == null` → no explicit choice has been made. Primary is **derived**: the image with the lowest `SortOrder` for that owner (i.e., first uploaded), exactly matching the requirement that first-uploaded is the default.
- `PrimaryImageId` set → that image is primary, full stop, regardless of `SortOrder`.
- Deleting the image currently acting as primary (whether by explicit choice or by default) clears `PrimaryImageId` back to `null` if it pointed at the deleted row, which lets the derivation rule pick the first-uploaded remaining image (lowest `SortOrder`) automatically — no special-case code needed for "the primary got deleted," it just falls through to the same default rule new resources start with.

**Confirmed by Skyler:** no dead/null primary state is intended — falling back to the next remaining image automatically (where one exists) is exactly the wanted behavior, not a placeholder pending a decision.

This is the same "nullable column signals applicability, no separate discriminator flag" shape already used elsewhere in this codebase's own schema conventions (e.g. hunter-playbooks' `StartLabel`/`MaxSelect` null-vs-populated pattern) — reused here rather than invented.

### 1.3 One table — decided

**Settled: a single `ResourceImage` table**, discriminated by `OwnerType` + `OwnerId` (§1.1), not four parallel per-domain tables. This is a real departure from this codebase's usual convention of duplicating parallel concept-tables per domain (`MonsterAttack`/`MinionAttack`, `LocationCustomMove`/`BystanderCustomMove` are all separately-declared tables for conceptually identical concerns) — worth naming explicitly rather than pretending it's consistent with that pattern, because it isn't, and that's fine: Attacks/Powers/CustomMoves are genuinely different *data* per domain (a Monster's stats aren't a Location's), whereas an image row is identical in every field regardless of which resource type owns it, and — per Skyler — every image is produced the same way (the same AI imaging API, the same fixed 1024×1024 dimensions) regardless of owner type. There's no per-domain content here to duplicate a table for.

Accepted tradeoff, stated plainly: the discriminator+id pair is not a real foreign key, so referential integrity against the four possible owner tables is enforced at the service layer, not the schema. Given this decision is now settled, that's simply the shape to build against — not a live risk to keep re-litigating.

One consequence worth flagging for Bowser: validation logic (type/size/cap checks, §7) already only needed to live in one place under either table shape, and a single table makes that a near-inevitability rather than something to remember to consolidate — one service, one set of rules, called identically regardless of caller.

### 1.4 The 10-image cap

Enforced at write time in the upload service: reject (with a reason, not silently) any file that would push the owner's image count past 10, queried by `(OwnerType, OwnerId)` rather than a per-domain FK. See §7.4 for exactly how a batch that partially exceeds the cap behaves — this is not "reject the whole batch."

---

## 2. Storage approach — decided: Postgres `bytea`

**Confirmed by Skyler: image bytes are stored directly in Postgres, in a `bytea` column on the image row** — not object storage, not the application server's filesystem.

- **Grounded in real output data, not just the size cap.** The actual generation pipeline this feature exists to receive output from (`tools/fal-image-gen`) is landing consistently under 500 KB per image at the fixed 1024×1024 size — confirmed directly in that tool's own README, which found "WebP re-encoding keeps every model under ~200KB even at 1024." The 2 MB cap is a ceiling well above typical real output, not the expected size. Worst case, 10 images × 2 MB = 20 MB per resource; typical case, closer to 10 × <500 KB ≈ 5 MB or less. Across this app's actual scale, that's a small, bounded addition to a Postgres database that's already the system of record for everything else — nowhere near the "unbounded binary growth" concern that would argue for pulling it out.
- **Filesystem storage is still ruled out**, on the same grounds as at any other size: Railway containers are ephemeral — anything written to local disk is lost on the next redeploy unless a persistent Volume is explicitly provisioned, which is new infrastructure nobody has set up and which doesn't scale past one instance.
- **Object storage would still work technically, but nothing here argues for it over `bytea` at this confirmed size and real-world output.** It would add a new external dependency (bucket, credentials, CDN config, a second system of record) for a data volume that doesn't need one. It also would have raised a real question about whether stored images end up on public/CDN URLs or behind an auth-gated proxy — that question is moot now: there's no external bucket, so every image is served the same cookie-authenticated way as every other same-origin request in this app, with no separate access-control decision to make.
- **Serving:** `GET /api/{resource}/{id}/images/{imageId}/file` reads the `ImageBytes` column and streams it with `Content-Type` set from the stored `ContentType` and `Cache-Control: private, max-age=31536000, immutable`. `private` means only the user's browser may cache the response; `public` would let any shared cache store it too. Because these endpoints are session-gated, shared caches must not store them. `immutable` is honest here because an image row is never edited in place — a "changed" image is always a new row with a new `Id` (delete + re-upload), so a cached response for a given `imageId` never goes stale.

### 2.1 Thumbnails — reconsidered at 2 MB, still recommended

Still worth generating a smaller derived asset at upload time, but the case is less dramatic than it would be at a much larger cap, and it's worth reasoning about honestly at the confirmed number rather than carrying over urgency that doesn't hold at this size.

- **Why it's still worth it:** even at "typically under 500 KB, capped at 2 MB," a list page renders one image per row, and rows can number in the dozens. Loading a full original for every row just to render a 64px thumbnail is real, avoidable bandwidth on what's likely the most-visited, most-repeatedly-loaded page type in this app — not the "hundreds of megabytes" case that made this an easy call at a 10 MB cap, but not negligible either, especially on an uncached first visit.
- **The fixed 1024×1024 square input is unaffected by the storage decision and still makes this cheap.** Every source image is a guaranteed square, so the resize step stays a plain downscale — never a crop-and-choose-a-focal-point decision. That's still the main reason this is a straightforward recommendation rather than a maybe.
- **Recommended thumbnail size: 256×256** — a clean 4× downscale of the fixed 1024×1024 source, comfortably sharp for a 64px list-row thumbnail even at 2× pixel density, and large enough to still read clearly as a carousel peek slide. Flagged lightly in §9 as a tunable parameter, not a load-bearing decision.
- **Generated synchronously, during the upload request**, using a standard server-side image-resizing library (something like ImageSharp is the common .NET choice — a new backend dependency, since nothing like it exists in this app today; Bowser's call on the specific library). Batches are capped at 10 files and the source is always a bounded, already-small 1024×1024 square, so there's no need for a background job/queue here unless implementation reveals otherwise.
- **Re-encoded as JPEG** regardless of the original's format (JPG, PNG, or WebP alike). Thumbnails are navigational/decorative, not archival, and nothing in this design composites a thumbnail over content that needs transparency (the empty-state placeholders in §5.5 are a separate, non-photographic treatment), so JPEG's smaller footprint is the better tradeoff at thumbnail size.
- **Used for:** every list-row thumbnail (§4.2) and the carousel's peek — i.e. non-active — slides (§5.1). The carousel's active/centered slide loads the full original; that's the one place in this whole design where showing full resolution is the actual point.
- **Failure mode:** if thumbnail generation fails for some reason but the original upload otherwise succeeded, don't fail the whole upload over it — fall back to serving the original at the thumbnail URL (slower, never broken) rather than surfacing a missing-thumbnail state to the user.
- Stored as `ThumbnailBytes` on the same row as the original (§1.1) — a second `bytea` column, not a separate table, since it's never queried independently of its parent image. Same `Cache-Control: private, max-age=31536000, immutable` treatment applies (session-gated, so shared caches must not store it).

---

## 3. API surface (conceptual)

Added to each of the four existing controllers (`MonstersController`, `MinionsController`, `BystandersController`, `LocationsController`), following the exact nested-resource shape already used for Attacks/Powers/Armors/Weaknesses/CustomMoves on these same controllers — not a new fifth cross-cutting controller, to match how this app already organizes per-domain sub-resources. (The single shared `ResourceImage` table from §1.3 lives behind a shared service; the controllers stay per-domain for consistency with the existing convention, thin wrappers that pass `OwnerType`/`OwnerId` through.)

| Verb & path | Purpose |
|---|---|
| `GET /api/{resource}/{id}/images` | List images for this owner, ordered by `SortOrder`. Returns each image's metadata (§1.1 fields) plus a computed `isPrimary` bool (derived per §1.2) — the client never has to re-derive the default-primary rule itself. |
| `GET /api/{resource}/{id}/images/{imageId}/file` | The original asset, read from `ImageBytes`. `Content-Type` set, cache headers per §2. What the carousel's active slide points at. |
| `GET /api/{resource}/{id}/images/{imageId}/thumbnail` | The generated 256×256 derivative, read from `ThumbnailBytes` (§2.1). What list-row thumbnails and carousel peek slides point at. |
| `POST /api/{resource}/{id}/images` | Multipart, one or more files. Returns a **per-file** result, not a single pass/fail — see below. |
| `DELETE /api/{resource}/{id}/images/{imageId}` | 204/404, existing `ServiceResult`/`ToErrorResult` convention. Re-derives `PrimaryImageId` per §1.2 if the deleted image was primary. |
| `PUT /api/{resource}/{id}/images/{imageId}/primary` | Sets `PrimaryImageId` on the owner to this image. 204/404 — same shape as the existing `PUT api/mysteries/{mysteryId}/monsters/{id}` link-toggle endpoints, which already use a bare `PUT` for "set this relationship" rather than a body-carrying update. |

**Upload response shape — this is the one place I'm deliberately diverging from the app's existing partial-failure voice, and saying why.** The shipped pattern for a partial failure (`monster-create.ts`'s post-create membership `forkJoin`, documented in `.squad/decisions/records/rosalina-partial-failure-copy-entity-linking.md`) hedges — *"…may not have saved"* — because a `forkJoin` genuinely cannot tell the client which of several parallel calls failed, only that at least one did. **File validation has no such fog.** Each file in a batch is checked independently and synchronously in the same request; the server knows exactly which files landed and which didn't and why. So the response should be exact, not hedged:

```
{
  uploaded: [ ImageResponse, ImageResponse, ... ],
  rejected: [ { fileName: "swamp-thing.bmp", reason: "UnsupportedType" }, ... ]
}
```
`reason` as a small enum (`UnsupportedType`, `TooLarge`, `CapExceeded`, `UnreadableOrOversizedDimensions`) the frontend maps to the exact copy in §7. `UnreadableOrOversizedDimensions` is Bowser's decompression-bomb guard — a 2 MB PNG or WebP can declare a canvas large enough to decode to well over a gigabyte, so the server checks decoded dimensions before ever decoding the full image, and rejects above a cap. HTTP status: `201` if `uploaded` is non-empty (even if `rejected` also has entries — a batch that's 3-for-5 is a success with detail, not an error); `400` only if `uploaded` is empty and every file was rejected. This mirrors the create-flow precedent's underlying *principle* ("a failure past this point must not look like a total failure") while using more precise language than that precedent's copy, because the precedent's hedge was a response to a specific ambiguity (`forkJoin`) that doesn't exist here.

**One submit is exactly one `POST`, with one `{uploaded, rejected}` response.** There is no client-side request chunking and no multi-request merge: the upload modal (§4.4) stages at most `min(remaining slots, 10)` files and refuses to stage past that, so a submitted payload is ≤10 files by construction. Decided by Skyler — *"Delete the chunking logic; it will not be needed."* Keep the two underlying constants separate and separately commented even though the chunking is gone (`MAX_FILES_PER_UPLOAD_REQUEST`, a 24 MiB request-size concern, versus `MAX_IMAGES_PER_RESOURCE`, a data rule) — they coincide at 10 today, and the "stage up to the minimum of the two" rule above is what keeps that coincidence from becoming an assumption.

**How the `rejected` array is surfaced changed with the modal rework, though the contract did not.** Pre-submit, the browser has already shown per-file errors for everything it can judge (§4.4), so a non-empty `rejected` in a response now means one of: a server-only reason the browser doesn't pre-check (`UnreadableOrOversizedDimensions`, or an `UnsupportedType` that passed extension/MIME but failed magic-byte sniffing), a cap race between two tabs, or a direct API call that bypassed the UI entirely. Those surface as toasts (§7.6), not as the inline per-file list the pre-modal design used. The server keeps reporting per-file detail regardless — that detail is what lets the partial-failure toast name the files that didn't make it.

---

## 4. Frontend component breakdown

New shared components, flat in `shared/` (matching the existing convention — `shared/` has no subfolders today; `confirm-delete-modal.component.ts`, `custom-select.component.ts`, etc. all live directly in it):

- **`shared/image-upload-modal.component.ts`** (`app-image-upload-modal`) — the whole upload interaction, spec'd in §4.4: a modal holding the drag-and-drop target, the `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` picker, the staged-file list with per-file validation errors, the submit button and its in-flight spinner, and the close-confirmation step. Parametrized by resource type/id plus the owner's current image count (it needs that to compute remaining slots, §7.4). Emits one upload outcome (`uploaded`/`rejected`) for the host page to merge into its image list. **This replaces the earlier `image-dropzone.component.ts`** — drag-and-drop is modal-only now (§4.1), so the component that existed to make the whole card a drop target has no remaining job.
- **Expect Luigi's dropzone-wrapping-carousel structure to unwind.** The `<ng-content>` projection she built existed for two reasons, and the modal removes both: the carousel's empty state needed the dropzone's hidden file input (the empty state now renders a button that opens the modal — no shared input element, §5.5), and the card-including-carousel was the drop target (it no longer is). The Images card becomes a plain card with the carousel as a sibling, and the upload modal as a second sibling alongside `<app-confirm-delete-modal>`. Phase 6 hasn't wired any page templates yet, so this lands as simplification rather than rework.
- **`shared/image-carousel.component.ts`** (`app-image-carousel`) — the peek carousel (§5). Takes the current image list + primary id as input; emits `setPrimary` and `deleteRequested` events. It does **not** own the confirm-delete-modal itself — per the existing convention (every current delete flow keeps `pendingDelete` state and the one `<app-confirm-delete-modal>` instance at the *page* level, e.g. `monster-detail.ts`'s `requestDeleteAttack`/`pendingDelete()`), the host detail page owns that state and renders the modal, exactly like it already does for Attacks/Powers/Armors/Weaknesses.
- **`shared/resource-thumbnail.component.ts`** (`app-resource-thumbnail`) — the small list-row image, with the placeholder fallback in §5.5 built in (rendered on a null thumbnail URL or an image load error). Takes a resource type (for the placeholder's domain color/icon) and an optional thumbnail URL (§2.1) — list rows always use the thumbnail endpoint, never the original.

### 4.1 Detail pages

One new card section, matching the existing `<article class="bg-surface border border-default rounded-lg p-3">` idiom used for Attacks/Powers/Armors/Weaknesses. **Placement: directly under the title/badge block, above the shared `<app-{x}-form>`** — not folded into the sub-resource grid. Reasoning: Attacks/Powers/etc. are per-domain mechanical data (a Monster's are different in kind from a Location's, which has none of them), while images are a universal, header-level concern for all four types — closer to identity than to stats. Putting it first, right where a reader would expect a "hero" visual near the name, also means it's the first thing that loads above the fold rather than competing for space at the bottom of a four-column grid.

**Confirmed by Skyler:** this placement and its reasoning are agreed — the image is meant to work as an immediate visual identifier for instant recognition when scanning lists, and as part of the creative process during create/edit, both of which line up with treating it as identity-level rather than a stats sub-section.

#### 4.1.1 Ordering against existing sections — the Minions-block collision, ruled

`monster-detail.html` is the only one of the four detail pages with anything already occupying the title-to-form range: a **Minions** block (`mt-6`, its own header row with a "+ Add Minion" CTA, then a roster of minion rows). Verified against the current file, plus all three siblings: `minion-detail`, `location-detail` and `bystander-detail` go straight from title/badges to their shared form, with Custom Moves *below* the form on the latter two. So this is one collision on one page, not a general contest.

**Ruling: Images goes first, directly under the title/badges. The Minions block moves down one position, to sit between the Images card and the form.**

**The principle, stated so it generalizes rather than reading as "Images wins because it's new":** sections above the form are ordered by *what they are about*. The Images card is about **this** record — it is the same object the title and the badges name, and together those three form one continuous identity header (name → type badges → picture). The Minions block is about **other** records: every row is an `entity-link` to a different page that has its own title, badges, images and form, and its own CTA navigates away to a create page. A roster of links to elsewhere interrupting the name-and-picture cluster is the thing to avoid, so:

> **Identity header (title → badges → Images) → rosters of related entities → the edit form → owned sub-resources.**

That ordering already describes every shipped detail page; monster-detail is simply the one place where the new card lands inside it rather than at the end of it.

**On the counter-argument, which is real:** a monster's minions are thematically part of the threat it represents, so "identity-adjacent" isn't wrong. The test that settles it is whether the block renders an *attribute of this record* or *navigation to other records*. If minions appeared as a count or a sentence (the way `monsters-list` renders "Minions: 3"), they'd belong in the identity cluster; as a navigable roster with a link per row, they don't. Worth noting the cost honestly: this does move an existing page's established block, which is a change rather than a pure addition — but it moves by exactly one section, keeps its position relative to the form and the sub-resource grid, and the Images card above it is short (one header row plus one carousel), so nothing is pushed out of easy reach.

**What Luigi applies four times:** the rule is *not* "Images is unconditionally the first section, pushing everything down" — it's the ordering above. In practice the two coincide today: for Monster the displacement clause fires once (Minions moves down), and for Minion, Location and Bystander there is nothing in range, so Images lands directly under title/badges exactly as §4.1 already said. The distinction matters only if a domain later grows a section that genuinely *is* about the record itself (a stat summary, say) — that would belong in the identity cluster and would need ordering against Images on its own merits, which "Images is always first" would have silently pre-decided wrongly.

**The card itself is not a drop target. The only entry point is a labelled "+ Add Images" button in the section header, which opens the upload modal (§4.4).** Decided by Skyler: *"Drag and drop is modal only."* The button takes the same position and visual weight as `monster-detail.html`'s existing "+ Add Minion" button (`bg-accent hover:bg-accent-hover rounded-lg text-on-accent ... px-5`, `flex items-center justify-between` header row). It is `disabled` with an inline note when the resource is already at 10/10 (§7.5).

**This still satisfies the original drag-and-drop-*or*-file-picker requirement** — both paths exist, both live in the modal, and the cost is one click before dragging. What it buys is a single validation surface and a single submission path: with the card no longer accepting drops, there is exactly one place where files enter the browser and exactly one place where per-file errors render, rather than two code paths that have to agree.

The carousel's `<img>` elements (§5.1) keep `draggable="false"`, but the original reason for it is withdrawn: it was there to stop a mouse drag on an image from fighting the card's own file-drag detection, and the card no longer has any. It stays only as a small nicety — dragging a carousel image does nothing useful, so suppressing the browser's native drag ghost on it is tidier than allowing it — and as cheap insurance if card-level drop ever returns. Not load-bearing either way now.

**Persistence is decoupled from the page's Save button**, matching how Attacks/Powers/Armors/Weaknesses already work on this exact page: uploading, deleting, and setting-primary each fire their own request immediately and update the section's own state, entirely independent of `saveMonster()`/the shared form's submit. A user never needs to "Save" to keep an image change.

### 4.2 List pages

Thumbnail on the **left** of each row's content on desktop, before the name/badges block — the convention named in the brief and the one already implied by how these rows lay out today (`flex items-center ... gap-4`, content in a `flex-1 min-w-0` block). It points at the **thumbnail** endpoint (§2.1/§3) — never the original — or the placeholder (§5.5), and slots in as a new first flex child ahead of the existing `<div class="flex-1 min-w-0">`, with `gap-4` already providing the spacing. Small, additive change to `monsters-list.html`/`minions-list.html`/`locations-list.html`/`bystanders-list.html`, not a restructure.

#### 4.2.1 Thumbnail size: 128px, and it lives in the component

**The list-row thumbnail is a 128px square**, doubled from its original 64px at Skyler's request (*"can we double the visual size of the thumbnail on the list page?"*). Implemented as the shared component's own default — `size="row"`, which also carries the box and the border — so **all four domains inherit it by rendering the component; there is no per-call-site number to keep in sync.** The carousel opts out with `size="fill"`. The placeholder's domain icon scales with it, to `xl`/48px.

**128px is the ceiling, not a preference.** The stored thumbnail is 256×256 (§2.1), so a 128px box is pixel-exact at 2× DPR and anything larger would upscale. If a bigger row thumbnail is ever wanted, the stored thumbnail dimension has to move first.

#### 4.2.2 Mobile: stack the row, and clamp the description

Skyler's follow-up after seeing 128px rows on a phone: *"Let's stack the image above and centered, leaving the 128px resolution for now… the amount of copy displayed on the screen for the description of the resource on mobile sizes can easily become too much. I would like to apply the elipsis trimming measure we used elsewhere here for mobile screens… And while this should definitely happen for the smallest snap point, even the tablet sizing still seems a bit verbose, so we should probably apply this to tablets as well."*

**Two independent thresholds, and they are deliberately not the same number:**

- **Rows stack below `sm` (540px):** thumbnail above and centred, text full width, delete action at the trailing edge. 540px is the last width at which a horizontal row still leaves the text a workable column (282px); below it the column collapses — 132px at a 390px phone, 102px at 360px — which is what made stacking necessary rather than cosmetic.
- **Descriptions clamp to two lines below `lg` (1024px):** full text from desktop up. **Releasing at `lg` rather than `md` is the point, not an accident** — a `md` release would have left tablet verbose, which is precisely what Skyler flagged.

**Watch the breakpoint numbers: this project overrides Tailwind's defaults.** `sm` is **540px** (not 640) and `xl` is **1200px** (not 1280), per the `@theme static` block in `styles.css`; `md` (768) and `lg` (1024) are standard. Anyone reasoning about these rules from Tailwind's documented defaults will be wrong about `sm` by 100px.

**The clamp is by lines, not words — which answers Skyler's open question rather than picking a number.** He asked how many words to show and left it to Luigi; the better answer is that `line-clamp-2` clamps by *rendered* lines, so the cutoff tracks the actual column width at every breakpoint instead of a word count that would be too long at 360px and too short at 768px. It also isn't new vocabulary: `line-clamp-2` is already used in `hunter-sheet-preview.html` and the wizard's rosters, so this is reuse, and two lines matches every existing use in the app. It lands around 90–110 characters at these widths — and notably, two lines is also roughly what a long description already occupies on a wide desktop row, so the clamped shape matches what desktop users already see rather than inventing a second visual language for small screens.

**Scope correction worth stating so it doesn't read as an oversight: the clamp applies to three of the four lists.** `minions-list` renders no description at all — its second line is "Belongs to: {monster}", a short link — so there is nothing there to clamp. Luigi added a spec asserting that absence deliberately.

**A pre-existing layout bug was fixed in the same pass**, and it's worth recording because it looked like a thumbnail regression and wasn't: the list `<ul>` is a grid, grid items default to `min-width: auto`, so rows claimed their min-content width and overflowed their track — a 488px row in a 358px track on a 390px phone, which scrolled the page horizontally and pushed the delete button off-screen. `min-w-0` on the `<li>` fixes it, applied to all four list templates with a regression test. Verified by stash that it predates this feature's work entirely.

**Measured outcome:** at 390px a long-description row goes 726px → 414px (text column 132 → 324px, description 19 rendered lines → 2); at 768px tablet, 289 → 193px; desktop unchanged at both 1024 and 1440. Residual horizontal overflow is gone.

### 4.3 Where validation errors surface — two surfaces, split by when they're knowable

- **Pre-submit, inside the modal, per staged file.** Everything the browser can cheaply judge — wrong type (by extension/MIME), over 2 MiB, and over the 10-image cap — renders next to that file's name in the staged list, before any request goes out (§4.4). This is the better home than the old inline-under-the-card list for a plain reason: at that moment the error is still *actionable* — the user can remove the file, pick a different one, or delete an existing image to free a slot — rather than being a report on something already attempted. Copy per reason: §7's table, unchanged.
- **Post-submit, as a toast.** Anything the browser couldn't pre-judge comes back in the response and surfaces as a toast, not inline copy (§7.6 for exact strings). There is no inline post-submit rejection list under the card any more; it had nothing left to show that the modal hadn't already shown.
- **Nothing on the happy path.** A clean submit closes the modal and the new images simply appear in the carousel, with the active slide jumping to the first of them (§5.4). No success toast — consistent with the delete flow (§6), where the visible result *is* the feedback.
- Toast severity is `error` in both failure cases. `NotificationKind` is `'success' | 'error'` only (`core/notifications.ts`) — there is no warning severity, and the house move for a success-with-caveat is to spend `.error()` on it rather than invent a third kind (the `monster-create` precedent, `.squad/decisions/records/rosalina-partial-failure-copy-entity-linking.md`). The partial case is exactly that shape, so it goes out as `.error()`.

### 4.4 The upload modal — stage, then submit

**Decided by Skyler, replacing the earlier drop-on-the-card-and-it-uploads flow.** Verbatim: *"I was hoping we would have a button to upload files, which would produce a modal for drag and drop/file-system uploading. This modal would capture the browser portion of the process and dole out error messages based on content: too large, too many, wrong file type, etc. Then, once the files have been added to the browser, the user can submit."* The structural change is that an upload now has an intermediate state it didn't before: **files are staged in the browser, visible and editable, before any request exists.**

**Anatomy, top to bottom:**

1. **Title:** "Add images".
2. **Drop area + picker.** A dashed-border drop target filling the modal's upper area, with a drag-over state (`bg-accent-subtle` tint, same token as the card's hover/focus affordances). Inside it: the prompt "Drag images here, or choose files" with "choose files" as the button that opens the native picker. This is the only drag-and-drop surface in the feature.
3. **Staged file list — names only.** Decided by Skyler: *"Just a list of file names."* One row per staged file: the filename, a remove button (`action-btn action-btn--delete`, existing convention), and — for an invalid file — its error message from §7's copy table on the same row in `text-danger`. **No thumbnail previews**, which also keeps object-URL lifecycle out of the modal entirely.
4. **Footer:** "Upload" (primary, `bg-accent`) and "Cancel".

**Staging rules:**

- **Validation runs on every add and remove, not at submit.** Type (extension/MIME), size (2 MiB), then cap — in that order, matching the server's own ordering so an invalid file never consumes a cap slot (§7). Files are accepted into the list in pick/drop order.
- **The cap counts existing images plus staged ones.** With 8 already on the resource, the modal stages 2 and flags the rest as over-limit (§7.4). It will not stage past `min(remaining slots, 10)`.
- **"Upload" is disabled unless at least one staged file is valid.** An all-invalid staging state can't be submitted; the user removes or replaces files first.
- **Invalid files are never submitted** — only the valid subset goes into the request, so §3's payload is clean by construction.

**Submit:**

- One `POST` for the whole staged payload (§3), with the spinner on the "Upload" button for the duration — reusing the existing `icon-spinner` symbol (already shipped for the API-unavailable modal), no new icon. No progress bars and no per-file progress: *"We need no progress bars at all, only a spinner for the submitted file upload to ensure users are aware of a possibility of delayed interaction, particularly for slower connections."*
- **"Upload" and "Cancel"/close are both disabled while the request is in flight.** Confirmed by Skyler: *"Close button should be disabled when request is in flight."* Closing a modal mid-request would cancel an upload the server may already have committed, so the modal holds until the response arrives. Matches the app's existing `isMutating()` disablement convention.
- **The in-flight treatment is the implementer's choice among three Skyler named**, all acceptable to him: *"We should either display a spinner with a click-shield, or replace the view entirely with a spinner; this can be in the upload modal, or dropping the modal and displaying the spinner; either is acceptable."* So: (a) the modal stays as-is with a spinner plus a click-shield over its contents, (b) the modal's view is replaced entirely by a spinner, or (c) the modal closes and the spinner shows on the page. Luigi is picking one and will report which. The only requirement common to all three is that the user cannot cancel or re-submit while the request is open, and that *something* visibly indicates work in progress.
- **On a response where at least one file landed, the modal closes**; the new images appear in the carousel and the active slide jumps to the first of them (§5.4). If some files were rejected, the partial-failure toast reports them (§7.6).
- **On a response where nothing landed, the modal stays open with the staged list intact**, so the generic toast (§7.6) has the files it's talking about still on screen next to it, and a retry doesn't require re-picking anything. My call, not Skyler's words — it's what makes an intentionally vague message tolerable.

**Closing with files staged asks first.** Decided by Skyler: *"Yes, the modal can be closed before submission, but after files have been added. We should produce an alert to confirm closing the modal."* Copy and mechanism are in §4.5.

No cancel-mid-upload affordance in this pass (§8).

### 4.5 Discarding a staged selection — the close confirmation

Triggered by "Cancel", the modal's close affordance, the backdrop, or Escape, **whenever at least one file is staged**:

> **Discard selected files?**
> {n} files haven't been uploaded yet. Closing this window will discard them.
>
> [ Keep files ] [ Discard files ]

- Singular form at `n == 1`: "1 file hasn't been uploaded yet. Closing this window will discard it."
- **"Discard files"** carries the destructive styling (`bg-danger`/`text-on-danger`, as the confirm-delete modal's confirm button does); **"Keep files"** returns to staging with the list untouched.
- **Both buttons name their action.** Deliberately no bare "Cancel" here: on a dialog *about* cancelling, "Cancel" is genuinely ambiguous — it could plausibly mean "cancel the close" or "cancel the upload." Two explicit verbs cost nothing and remove the ambiguity.
- **With nothing staged, closing is immediate — no prompt.** There is nothing to lose, and a confirmation for discarding zero files would be pure friction.
- **Escape does not bypass the confirmation.** With files staged, the first Escape raises this confirmation; a second Escape (or "Discard files") closes the modal. Worth stating because the app has two cross-cutting Escape specs (`shared/escape-nesting.spec.ts`, `shared/custom-select-escape-surfaces.spec.ts`) that a new overlay surface has to be consistent with.
- **Mechanism: a state swap inside the upload modal — not a stacked dialog, and not a native browser `confirm()`. Confirmed by Skyler** (*"I'll take the recommendation of the in-modal step for now"*), after he'd initially leaned toward a browser alert on consistency grounds: *"I do not want stacked modals... I think a browser alert may be the most co[n]sistent way to do this among our forms."* The modal's body and footer are replaced by the confirmation above; "Keep files" swaps them back.
- **The convention that settles it, recorded so it isn't re-litigated: in-app confirmations for in-app navigation; the browser's own prompt only for browser-level events.** The premise behind the browser-alert instinct was that this app had no dirty-form guard to be consistent with. It does: `features/hunters/pages/hunter-create/hunter-create.ts` guards an unsaved hunter draft with a **custom in-app confirmation** (`canLeave()` / `isConfirmingDiscard` / a `Subject<boolean>`, wired through `hunter-draft.guard.ts`), and reserves `beforeunload` — the browser's own dialog — for refresh and tab-close only. So a native `confirm()` here would have been the *inconsistent* choice, not the consistent one. An in-modal view swap is also not a stacked modal, which was the actual thing to avoid. Routing it through `<app-confirm-delete-modal>` would have been — and would additionally add four call sites to a census-tested component (`shared/confirm-delete-modal.call-sites.spec.ts`).

---

## 5. Carousel visual & interaction design

### 5.1 Layout — the peek treatment, and which asset each slide loads

A horizontal flex track, one slide fully visible and centered, with the previous/next slides partially visible at the edges, scaled down and faded. Concretely: active slide `scale-100 opacity-100`, adjacent slides `scale-90 opacity-40` — reusing the literal `opacity-40` value already established in this codebase as "de-emphasized but present" (`.action-btn:disabled { opacity-40 }` in `styles.css`), rather than inventing a new de-emphasis value. `overflow-hidden` on the track container clips anything beyond the immediate neighbors.

**Resolution per slide:** the active/centered slide loads the full original (§3's `/file` endpoint) — it's rendered at full size and is the one place this design shows full detail. The peek (previous/next) slides load the **thumbnail** (§2.1/§3's `/thumbnail` endpoint) — they're rendered at 90% scale and 40% opacity, so pulling a full (up to 2 MB) original for a slide that's visually small and faded would be pure waste. Advancing the carousel promotes what was a thumbnail-backed peek slide into the active position, at which point it (re)requests the original — browsers cache the thumbnail request already made, so this isn't wasted work, just an additional fetch for the now-active slide's full detail.

**At the ends of the list, a peek slot is simply empty rather than wrapping** (no wraparound — §5.4): at the first image there is no previous peek, at the last image there is no next peek. The track just ends; nothing fills the missing slot.

#### 5.1.1 Vertical size: capped by width, not height

**The carousel region is capped at `max-w-xl` (576px) and centred.** Requested by Skyler after reviewing Phase 6a on the dev server — *"I would like the carousel to take up about half of the vertical space it currently does… The mobile scaling looks perfect as is. This should be the same across all of the image carousel domains."*

**The rule, in one line (Luigi's):** a slide is `basis-1/2` of the region inside an `aspect-square` frame, so its height is derived as roughly half the region's width — which makes a width cap the way to control height, and makes a breakpoint unnecessary, since a max-width is inert below its own threshold.

The non-obvious parts, recorded so they don't get "fixed" later:

- **The height is derived, never set.** Nothing in the carousel declares a height; it falls out of `basis-1/2` × `aspect-square`. Halving the width cap is therefore what halves the height.
- **A `vh`-based cap would have been actively wrong, not merely different.** Measurement showed 1440×2560 and 1440×900 rendering identically (651px) — viewport *height* never enters the formula at all. `max-h-[50vh]` would compute to 1280px on Skyler's tall screen (no constraint whatsoever) and 450px at 1080p (a hard clamp), i.e. backwards in both directions.
- **A max-height would also letterbox the images**, cropping the square 1024×1024 source through `object-cover` — the one thing a square-source carousel shouldn't do.
- **The cap belongs on the outer carousel region, not the inner scroll viewport**, because the star/trash overlay (§5.3) and the chevrons (§5.4) are absolutely positioned against the outer element; capping the inner one would decouple the controls from the frame they're meant to sit on.
- **Measured result:** a flat 304px from 1024px viewport width upward (down from 651px at 1440 and 891px at 1920); phones byte-identical; the 768px tablet case moves by 11px. That's 47% rather than exactly 50% because `max-w-xl` is a named Tailwind scale step and the next step up lands at 54% — the named step is worth more than hitting the number precisely.
- **All four domains inherit this**, since it lives on the shared `app-image-carousel`. That's what Skyler asked for ("the same across all of the image carousel domains"), and 6b–6d get it without any per-page work.

**Every `<img>` in the carousel (active and both peeks) is rendered with `draggable="false"`.** The original reason for this — that a mouse drag on an image would fight the card's own file-drop detection — no longer applies, since drag-and-drop is modal-only and the card accepts no drops (§4.1). It's kept as a small nicety (dragging a carousel image does nothing useful, so suppressing the native drag ghost is tidier) rather than as a requirement.

**Motion:** advancing between slides (chevron press or keyboard) animates as a slide transition. Under `prefers-reduced-motion: reduce`, that transition is disabled — the slide change becomes instant rather than animated. The static peek treatment itself (the `scale-90 opacity-40` de-emphasis on neighboring slides, above) is unaffected either way, since it's a steady-state visual treatment, not an animation. This is my default per the app's existing reduced-motion precedent (`.entity-link`/`.back-link` in `styles.css` disable their own transitions the same way); Skyler hasn't objected when it was explained in chat, but it's noted here as a default pending final confirmation, not a verbatim instruction.

### 5.2 Primary-image indicator

New semantic token, aliased rather than a new hue — consistent with how e.g. `--color-badge-playbook` aliases an existing indigo rather than inventing a color:

```
--color-image-primary-indicator: var(--color-accent);
```
(same value in both `:root` and `.dark`, since it's a pure alias — if a future design wants the primary indicator to read as visually distinct from the accent color generally, this token gives Luigi one place to change it without a template sweep).

Applied to the **active/centered slide only** (peek slides aren't the thing being indicated, and adding chrome to a faded, non-interactive neighbor would be noise): a `2px solid var(--color-image-primary-indicator)` outline plus a soft glow, constructed the same way `--color-focus-ring` already is — `box-shadow: 0 0 16px color-mix(in oklab, var(--color-image-primary-indicator) 45%, transparent)`. This gives the "outline or soft glow" ask from the brief using the exact construction technique (`color-mix` alpha ring) already established in this file for `--color-focus-ring`, rather than a new mechanism.

### 5.3 Primary-selection and delete controls

A small button overlaid on the bottom corner of the **active slide only** — a star, filled when this image is primary, outline when it isn't, with `title`/`aria-label` of "Primary image" (already primary, informational — could be non-interactive or a no-op) vs. "Set as primary image" (not primary, calls `PUT .../primary`). No star icon exists in the sprite today (`IconName` is currently `trash | pencil | close | menu | plus | spinner | search` per `docs/updates/svg-symbol-icons.md`) — this needs a new symbol added following that doc's own two-step recipe (`<symbol id="icon-star">` + extend `IconName`). Recommend a **filled** star (matching the existing solid-silhouette family `icon-trash`/`icon-pencil` belong to, not the outline nav/mystery-section family), toggled by swapping fill vs. an unfilled/outline rendering at the two states, since this is a binary on/off toggle icon rather than navigational chrome.

**The delete trigger sits next to the star, not elsewhere on the page.** Per Skyler: *"the delete button should sit near wherever the button to make an image the primary is (because we should be using a confirmation modal for deletes, this shouldn't be high risk for lost content)."* Placement: the opposite bottom corner of the same active slide, a trash icon reusing the existing `action-btn action-btn--delete` convention (already shipped elsewhere on these same detail pages for Attack/Power/Armor/Weakness deletes). No new icon needed — `icon-trash` already exists. Clicking it opens the confirm-delete-modal per §6, as before; this section only fixes where the trigger lives, not what it does. Both controls — star and trash — appear on the active slide only, never on a peek slide.

### 5.4 Navigation

- **Buttons only — no swipe gesture.** Decided, per Skyler: *"No swipe behavior (buttons only)."* Small chevron buttons on either side of the active slide, `aria-label="Previous image"` / `"Next image"`, are the only pointer/touch navigation — a tap on a touch device activates the button the same as a click, there's no drag/swipe gesture layered on top of it. No chevron icon exists in the sprite either — recommend adding **one** `icon-chevron` symbol and reusing it twice with a `rotate-180` utility on the "next" instance, rather than authoring two mirrored symbols.
- **No wraparound.** Decided, per Skyler: *"no wraparound (there are a max of 10 images, which isn't onerous for the user to navigate)."* At the first image, the "previous" chevron is disabled (greyed out, same `.action-btn:disabled` treatment used elsewhere — `opacity-40`, `cursor-not-allowed`); at the last image, the "next" chevron is disabled the same way. Neither button cycles back around. The corresponding peek slot is simply empty at that end (§5.1).
- **Keyboard:** the carousel is a single `tabindex="0"` region (`role="group"`, labelled "Image carousel"), with `ArrowLeft`/`ArrowRight` moving the active slide when it has focus — same no-wraparound behavior as the buttons, `ArrowLeft` at the first image and `ArrowRight` at the last do nothing. Focus indication uses the existing `ring-focus` utility, consistent with every other focusable non-text control in the app. Home/End (jump to first/last) is a nice-to-have, not required for v1.
- No modal/lightbox — the carousel *is* the full viewer per the brief; advancing to a slide loads its original (§5.1), so there's no larger asset to zoom into beyond what the active slide already shows.
- **Active slide after an upload.** Decided, per Skyler: *"the active image after an upload can just be the earliest in the array of uploads, i.e.: if the user uploads 5 images, then comes back later and uploads images 6-10, show number 6."* After any successful upload (including a multi-chunk one, §4.4), the carousel's active slide jumps to the first newly-added image (lowest `SortOrder` among the images from that upload) — not the first image overall, and not wherever the user happened to be before uploading.
- **Active slide after a delete.** Decided, per Skyler: *"on delete should go to next in array."* The active slide moves to the next image in `SortOrder` order after the one just deleted (or, if the deleted image was last in the array, to the new last image). This is purely about which slide is *displayed* — a separate concern from which image becomes the new **primary** (§1.2's derivation rule, first-uploaded remaining by lowest `SortOrder`). The two don't have to name the same image: deleting a middle image makes its neighbor active, while primary status is unaffected unless the deleted image was itself primary.
- **Active slide after setting a new primary.** Decided, per Skyler — a non-event, not a rule: *"isn't an issue because the user is already on that image (so why would we move away?)"* The primary toggle (§5.3) is a star on the currently-active slide, so setting primary never changes which slide is active — only the primary indicator (§5.2) updates in place.
- **Active slide on initial page load.** Decided, per Skyler: *"The initial load of the view should always have the primary image as the active slide. We do not need to track which image was uploaded first overall."* On load, the carousel's active slide is the resource's **primary** image — the explicit `PrimaryImageId` if one is set, otherwise the same derived-default rule §1.2 already defines (first-uploaded, lowest `SortOrder`). No new state: this reuses exactly the same primary-derivation logic (and the same `primaryImageId` the list response already carries, §3) that picks the list-row thumbnail, just applied here to picking the initially-active slide instead.

### 5.5 Empty states

- **Carousel, zero images:** rendered inside the same card, as a single centered panel containing the resource's own `<app-domain-icon>` at a muted size, the text "No images yet.", and an "+ Add Images" button that opens the upload modal (§4.4). **No dashed-border drop-target treatment here any more** — the card isn't a drop target (§4.1), so dressing the empty state to look droppable would advertise an interaction that doesn't exist; the dashed border now lives inside the modal, where dropping actually works. The empty state still offers the action that resolves it rather than hiding it — the principle holds, it just hands off to the modal instead of being the uploader itself. Mechanically this is also what frees the empty state from needing the old dropzone's hidden file input, which is half of why the projection structure unwinds (§4).
- **List-row thumbnail, zero images:** not a generic gray box or broken-image icon. Render the resource's own domain badge color at low opacity as the fill (`bg-badge-monster/40`, `bg-badge-minion/40`, etc. — these are plain Tailwind-generated color utilities from the `@theme` block, not hand-written `@utility` classes, so the `/40` opacity modifier works normally, unlike `text-primary`-style tokens which explicitly don't support it per `styles.css`'s own documented trade-off) with the matching `<app-domain-icon>` centered inside at reduced size. This keeps every row visually identifiable by type even with zero images uploaded, rather than every empty row looking identical and content-free.
- **Fallback placeholder — required, on both list rows and detail views.** The same placeholder is the fallback for any thumbnail or image that cannot be shown. It renders when the thumbnail URL is `null` (the owner has no images), or when the image fails to load for any reason (the `<img>` `error` event). On list rows it is the `app-resource-thumbnail` fallback; on detail views it fills the carousel slot (active or peek) at the slide's size. Failures are **silent**: no toast, modal, or inline message. This includes session-expiry 401s on image requests, which do not pass through the HTTP interceptor.

---

## 6. Delete confirmation UX

Reuses `<app-confirm-delete-modal>` exactly as-is — no new inputs needed on the component itself.

- `verb`: default (`"Delete"`) — unlike the wizard's `"Remove"`, deleting an image is genuinely, immediately destructive (no draft/undo state), so the default is correct as-is.
- `itemName`: the image's original `FileName`, since it's the most identifying thing a user can glance at (more useful than "Image 3 of 7").
- `message`: **leave at its default**, `"This cannot be undone."` — and this is a case where that default happens to be simply true, not one of the false-by-default traps found elsewhere in this component's history. No custom `message` needed.
- `items`/`usageMessage`/`usage`: left empty. Images aren't referenced anywhere else in the system the way a Monster's minions or a shared entity's mystery memberships are — there's no cascade and no "used elsewhere" fact to disclose.
- `footnote`: **used conditionally.** If the image being deleted is currently primary (explicit or derived-default), pass a footnote stating the consequence plainly: *"This is the current primary image. After it's deleted, {fileName} becomes primary instead."*, where `{fileName}` is the first-uploaded remaining image (lowest `SortOrder` among the images left after this delete), computed by the same rule as the server. The footnote always names that image, so the replacement is never described loosely. This follows the same principle established for the wizard's cascade footnote — tell the user what the system is about to do as a fact, not as a second decision they need to make. Naming applies even when exactly one image is left after this delete, so the single-image wording ("...the remaining image becomes primary") is dropped; if this is the *last* image, the footnote should say the resource will have no images afterward rather than mention "primary" at all.
- **After confirm:** the image is removed from the carousel/list immediately on success, matching the existing pattern for Attack/Power/Armor/Weakness deletes on `monster-detail.html` (no success toast — deletion of a sub-item is its own visible feedback). A failure surfaces the existing inline `text-danger` treatment, not a toast, consistent with how mutation failures are already shown on this page.

---

## 7. Validation & error messaging

**All four checks below are enforced server-side. Two of the four are *also* genuinely enforced client-side, and the split is not the same for every check** — worth stating precisely, because "the client checks too" means something different for the cap than it does for type and size:

- **Type and size: checked in the modal at staging time (§4.4), server-authoritative.** The modal checks extension and declared MIME, and byte length against 2 MiB, which is enough to catch every ordinary mistake before a request exists. The server re-checks both regardless, since a declared MIME type is trivially spoofable.
- **The 10-image cap: enforced in the browser, at staging time, per Skyler** — *"The 10 image cap should be enforced client-side. If we're holding them in the browser this way prior to submitting, we should instead be producing the error state of having added too many files."* The modal won't stage past the remaining slots and flags the excess (§7.4); those files are **never sent**. The server's own `CapExceeded` check remains in place as the authoritative backstop, not as the primary mechanism (§7.4 again — and it must not be "simplified away" as redundant).
- **Magic-byte signature and decoded dimensions: server-only, by explicit decision.** The browser *could* pre-check both (reading the first 12 bytes, and decoding to read `naturalWidth`/`naturalHeight`), and Yoshi recommended doing so for full client/server parity. Skyler declined — *"Generic toast is fine."* So a file that passes extension/MIME and size but fails the server's deeper checks produces a **generic post-submit toast** (§7.6) rather than per-file copy naming the real reason.
  **This is a knowingly accepted tradeoff, not an oversight.** It was put to Skyler explicitly that a legitimately odd but good-faith file — a `.png` that isn't really a PNG (a renamed file, a truncated download, an HEIC exported with a `.jpg` extension), or a flat-colour/upscaled image above 4096×4096 but under 2 MiB — will get a vague "something went wrong, try again" for a failure that will recur identically on every retry. That's the same retry-is-futile property that got the generic copy rejected for the over-cap case in §7.4, and it's accepted here because these files are rare in the actual workflow (images arrive from one generation pipeline at a fixed 1024×1024, §0) and the alternative costs two more duplicated validation rules plus an asynchronous "checking…" staging state in the modal. If those files turn out to be less rare in practice, the fix is to add the two client-side checks and give them their real per-file copy — recorded here so that path is obvious rather than rediscovered.

**Ordering matters, and client and server use the same order: the cap check runs last, against only the otherwise-valid files.** Bowser implemented the server that way deliberately so an invalid file never consumes a cap slot, and the modal must match it — otherwise a mixed selection (say, one `.gif` plus enough valid files to brush the cap) would have the modal and the server disagreeing about *which* file gets *which* rejection reason, even while agreeing on the count.

Exact copy, one line per rejected file, rendered on that file's row in the modal's staged list (§4.4):

**Copy, simplified per Skyler** (replacing the earlier, more specific per-reason strings this table had): the wrong-file-type message keeps naming the accepted formats, since that's actionable information the user needs; every other rejection reason collapses to one of two generic sentences. Verbatim: *"The copy for the UI to reject oversized files should be, 'File too large to upload. Images must be 2MB or less in size.' For anything else besides a file type issue, we can use, 'File failed to upload. Please try again.'"*

| Failure | Copy |
|---|---|
| Wrong file type | *"`{fileName}` isn't a supported image type — only JPG, PNG, and WebP are allowed."* |
| Too large | *"File too large to upload. Images must be 2MB or less in size."* |
| Unreadable or oversized decoded dimensions (Bowser's decompression-bomb guard, §3) | *"File failed to upload. Please try again."* |
| Over the 10-image cap | *"`{fileName}` wasn't added — over the 10-image limit."* — **decided**, per Skyler: *"Over-cap message: option b is great."* Resolves the §7.4 tension; this one rejection reason gets its own copy instead of the generic fallback. |

**Where this table's copy renders: in the modal's staged list, pre-submit, on the row for that file (§4.4).** The first two rows plus the cap row are all reachable in the browser, so in practice those three strings are the ones a user actually sees. The dimension-guard row is server-only (it can't be judged at staging time, per §7 above) and therefore never renders in the staged list — when it occurs, it arrives in a response and surfaces as a toast instead (§7.6). It stays in this table because the reason still exists in the API contract (§3) and the mapping has to be defined somewhere.

The generic *"File failed to upload. Please try again."* string doesn't name the file — where it renders on a staged row, the row already shows the filename next to it. The wrong-type and over-cap strings name `{fileName}` inline, since both were written around naming the file directly.

### 7.1 Type checking specifics

**Accepted types: JPG/JPEG, PNG, and WebP.** WebP is included per Skyler, since it's the `fal-image-gen` pipeline's native output format (that tool's own README confirms it defaults to WebP, falling back to PNG only if WebP encoding fails) — the app's accepted types need to match what the actual generation pipeline hands back, not just the two most conventional web image formats.

**The modal checks extension and declared MIME; the server checks the bytes.** At staging time the browser judges `.jpg`/`.jpeg`/`.png`/`.webp` by extension plus the `File.type` the browser reports, which catches every ordinary wrong-format mistake. It deliberately does *not* read magic bytes (§7's third bullet — Skyler's call), so a file that lies convincingly about its format passes staging and is caught server-side instead, surfacing as a generic toast (§7.6).

Server-side, validate both the file extension and the actual file content (magic-byte sniffing, not the browser-declared `Content-Type` header, which is trivially spoofable). **WebP needs its own check, not a third case bolted onto JPEG/PNG's.** JPEG and PNG each start with a short, fixed byte sequence, but WebP is a RIFF container — a 4-byte `RIFF` marker, a 4-byte file size, then a 4-byte `WEBP` marker at offset 8 — so a validator that was written assuming "check the first few magic bytes against two known signatures" needs a genuinely distinct check for WebP's container structure, not just a third literal byte-sequence added to the same lookup. Worth calling out explicitly so this isn't discovered as a gap during implementation. This is a genuine security-adjacent detail worth a line to Boo when this design gets a security pass — accepting "whatever the browser says this file is" for something that gets stored and later served back to other users is exactly the kind of gap this app hasn't had to think about yet (§8 notes it as deferred-but-flagged, not resolved here).

### 7.2 A mixed selection, pre-submit — the modal just shows it

Drop 5 files where 2 are invalid (say, one `.gif` and one 3 MiB `.png`): all 5 appear in the staged list, the 2 invalid ones carrying their own error text from the table above, the 3 valid ones plain. The user can remove the bad two, or leave them — either way **only the 3 valid files are submitted** (§4.4), and the 2 invalid ones are never sent. **This is precise, not hedged**, in the same spirit §3 argued for: the browser knows exactly which file failed which rule, so it says so, per file, right where the file is listed.

**The "X of Y images were added" summary line is retired as an inline element.** It existed to head a post-submit inline rejection list that no longer exists: pre-submit, the staged list already shows which files are invalid and why, in more detail than a count; post-submit, the only thing left to report is a server-side failure, which goes out as a toast. The count survives *inside* the partial-failure toast (§7.6), which is the one remaining place a user needs to be told "some but not all of that worked." So the information isn't lost — it just has one home instead of two, and that home is the only surface where it's still news.

*(Implementation note, corrected after Luigi's implementation found it contradicted §7.6: the old `uploadSummaryCopy` string — "{k} of {n} images were added." — is **retired along with the inline summary line it belonged to**. §7.6's "Added {k} of {n} images." is the only surviving form, and §7.6's spelled-out forms for 1, 2–3 and 4+ failures are authoritative over anything implied here. What remains genuinely reusable is that function's **gating**, not its wording: it returns `null` unless both some files landed and some were rejected, which is exactly the condition under which the partial toast should fire at all — silent on the happy path by construction, and silent on total failure, which §7.6 gives its own separate string.)*

### 7.3 Nothing valid to submit

Two distinct cases, and they end differently:

- **Everything staged is invalid** (every file wrong type/oversized, or the resource has no free slots left): the "Upload" button stays disabled (§4.4). Nothing is sent, nothing changes, and each row carries its own reason — there's no summary line and no toast, because nothing was attempted.
- **Everything submitted was rejected by the server**: a `400` with an empty `uploaded` array (§3). The modal stays open with the staged list intact and a generic error toast fires (§7.6). Rare by construction, since the browser already filtered everything it could judge.

### 7.4 Over the cap — flagged at staging time, in the modal

**Per Skyler, the browser produces the over-cap error state itself rather than sending the files and letting the server reject them** — *"The 10 image cap should be enforced client-side. If we're holding them in the browser this way prior to submitting, we should instead be producing the error state of having added too many files."* (Luigi found during Phase 5 that the client was uploading over-cap files and relying on the server's rejection.) Under the modal flow this lands even earlier than "before upload": it's one of the "too many" errors the modal doles out **at staging time**, before a request exists at all.

Worked example, now entirely within the modal: a resource has 8 images and the user drops 5 more (13 total, 3 over). The modal takes the files **in drop order up to the remaining slots — 2 of them — and flags the excess 3 as over-limit** on their own rows. Only those 2 are submitted; the 3 flagged files are **never sent**. This keeps the same "a batch that's partially good ships the good part" principle as §3/§7.2 — refusing the whole selection because it's slightly oversized would be a worse experience than taking what fits — and now the user sees the split *before* committing to it, with the option to remove files or free a slot first.

**Copy for the 3 rejected files is unchanged, per §7's table: *"`{fileName}` wasn't added — over the 10-image limit."*** Skyler picked this cap-specific string over the generic fallback precisely because "please try again" would tell the user to retry something that fails identically every time, and that reasoning holds just as well now that the rejection is produced locally — arguably more so, since there is no longer even a server response involved to make a retry look plausible.

**The server's `CapExceeded` check stays, as the authoritative backstop — this is defense-in-depth, not a relocation of the source of truth.** The server continues to enforce the cap independently, on every request, regardless of what the client sent or claims to have filtered. Stated explicitly so a future reader doesn't look at the two checks and "simplify" the server one away as redundant: the client check exists to produce a fast, honest error state for the user; the server check exists because the cap is a data-integrity rule and the client is not trustworthy for enforcing those. A `CapExceeded` rejection arriving from the server in normal operation now indicates either a client bug or a race (two tabs/sessions uploading to the same resource concurrently), both of which are real and neither of which the client can prevent on its own.

§7.5's pre-flight block covers the adjacent case — a resource that is *already* at 10/10 before any selection begins. This section covers the case §7.5 never addressed: a selection that starts under the cap and runs past it partway through.

### 7.5 If the resource is already at 10

**The "+ Add Images" button is `disabled`, with a short inline note next to it: "10/10 images — delete one to add another."** Confirmed by Skyler: *"Yes, disable when 10 images are present."* The modal never opens in this state, which is the point — opening a modal whose only possible answer is "no" is worse than a disabled button that says why. Unchanged in substance from before the modal rework; it just attaches to the button now rather than to a button-and-drop-target pair, since the card no longer accepts drops (§4.1).

### 7.6 Post-submit toasts — exact copy

Two strings, both `error` severity (§4.3), for the two outcomes the browser couldn't prevent. Neither is reachable on a clean submit, which is why the happy path is silent.

**Partial rejection — some files landed, some didn't.** Decided by Skyler: *"Partial rejection should keep the successful image uploads and produce an error toast identifying the files by name that failed."* The uploads that succeeded are kept; nothing is rolled back.

> **"Added {k} of {n} images. These couldn't be added: {fileName}, {fileName}, {fileName} and {m} more."**

- `{k}` is the number uploaded, `{n}` the number submitted (not the number staged — removed files were never part of the attempt, so counting them would make the sentence read as a bigger failure than it was).
- **The name list truncates at three, then summarizes the remainder** — e.g. *"Added 2 of 9 images. These couldn't be added: a.png, b.png, c.png and 4 more."* Decided with Skyler. The reason is a real constraint Yoshi found rather than a style preference: `NotificationService` renders one string for four seconds, so seven filenames in a toast is unreadable in the time it's on screen. Three names plus a count keeps it scannable while still answering "which ones?" for the common small case.
- Names are comma-separated in submission order, no serial comma before "and", full stop at the end.
- **Exact forms by failure count**, so this needs no interpretation at implementation time:
  - 1: *"Added 4 of 5 images. This one couldn't be added: a.png."*
  - 2–3: all names listed, no remainder clause — *"Added 3 of 5 images. These couldn't be added: a.png, b.png."*
  - 4+: first three names, then ` and {m} more.` where `{m}` is the count beyond those three — *"...: a.png, b.png, c.png and 4 more."* (`{m}` of 1 renders "and 1 more.")
- **It leads with what worked, then names what didn't.** The successes are real, persisted, and already visible in the carousel, so opening with a bare failure statement would misrepresent the outcome — the same principle as the app's shipped partial-failure precedent ("a failure past this point must not look like a total failure"), but stated exactly rather than hedged, because unlike that precedent's `forkJoin` the server told us precisely which files failed.
- No reason is given per file. That's the §7-third-bullet tradeoff: by the time a file fails here it failed for a reason the browser can't explain in user terms, so the toast names the file and stops.

**Total failure — nothing landed, or the request itself failed.** Covers a `400` with every file rejected, a transport error, and a `5xx`. Skyler's description: *"...or server-side issues, which would result in an error toast that something went wrong and to try again."*

> **"Something went wrong and your images weren't added. Please try again."**

- The modal stays open with the staged files intact (§4.4), so the user can retry without re-picking, and so the vague message has its subject still on screen.
- **No filenames here**, unlike the partial case — and the asymmetry is deliberate rather than an inconsistency. Naming files earns its place in the partial toast because it answers a question the user genuinely has ("which ones didn't make it?"). When nothing landed, there's no ambiguity to resolve: every file in the attempt failed, and they're all still listed in the open modal immediately behind the toast.
- "Please try again" is honest for the cases this string actually covers in practice (transport blips, `5xx`), and knowingly wrong for the rare magic-byte/dimension file that will fail identically forever — see §7's third bullet, where that tradeoff is recorded as accepted with its reasoning, so this isn't read later as the same mistake §7.4 specifically avoided.

---

## 8. Deferred to a later phase

- **Mystery Wizard integration** (explicit, per the brief). The wizard authors an entity via a multi-phase draft before it has a persisted `Id` — the roster/composer pattern the wizard already uses for Attacks/Powers/etc. on draft monsters holds off any server write until submit. Images need an owner `Id` to attach to from the very first upload (there's no draft-image concept proposed here), which is a materially different problem from "upload to an entity that already exists." Not designed here at all, on purpose.
- **Direct fal.ai integration into the application.** Skyler explicitly flagged a desire to bring the `fal-image-gen` tooling (`tools/fal-image-gen`, and its accompanying Claude skill) into the app itself — generating a resource's image via fal.ai from inside the app, rather than the current out-of-band workflow (generate locally with the tool, then drag the result into the upload path this document designs). Explicitly out of scope for this pass, per Skyler. This design's upload path (§3, §4) is the landing surface that workflow would eventually feed into, but nothing here assumes or designs for generation happening in-app.
- **Reordering images within the carousel.** `SortOrder` exists as a field (§1.1) specifically so this is addable later without a schema change, but no drag-to-reorder UI is specified now — v1 order is upload order, full stop.
- **Editing an image in place** (crop/rotate) — out of scope; delete-and-re-upload is the only path to "fix" an image.
- **Captions/alt text per image — confirmed unnecessary for this pass.** `alt` attributes fall back to `"{resource name} image {n} of {count}"`. Skyler confirmed generic alt text is sufficient and no per-image caption field is needed, so `FileName` and derived alt text are the only per-image text this design carries — no `Caption` field belongs in §1.1.
- **Bulk delete** (multi-select, delete several images at once) — no requirement given; v1 is one image, one confirm, one delete.
- **Content moderation / malicious-file scanning** beyond the type/magic-byte check in §7.1 — flagged for Boo's eventual security pass, not designed here.
- **Cancel-mid-upload.** No affordance to abort an in-flight batch in this pass (§4.4) — reasonable to add later, not required for v1 given the moderate batch sizes involved.
- **No refresh/`beforeunload` guard for staged-but-unsubmitted files.** §4.5's confirmation covers closing the modal from inside the app; it does not cover the browser-level case. Skyler, explicitly: *"This doesn't prevent the user from accidentally refreshing and losing work, but I'll address this at a later time."* When it's picked up, the precedent to follow is `hunter-create.ts`'s `window:beforeunload` `@HostListener` — the same split §4.5 describes (in-app confirmation for in-app navigation, browser prompt for browser-level events), just filling in the half this pass leaves open.
- **CDN/edge caching.** Not warranted at this data volume — images are served directly from Postgres via the app's own API (§2), not a CDN-fronted bucket, and nothing about this design's confirmed scale argues for adding one. Revisit only if the storage decision itself is ever revisited.
- **Wizard and minion-picker catalogues when pagination lands — soft note, not decided.** These catalogues will probably use typeahead rather than a full catalogue once pagination lands. This is a soft, non-blocking lean, not a firm decision, and nothing in this design depends on it.

---

## 9. Open questions / flagged assumptions

### 9.1 File size and storage — confirmed

Confirmed by Skyler: the cap is **10 images × 2 MB per file**, and images are stored as `bytea` directly in Postgres. This document has been revised throughout to that number and that storage decision (§2, §2.1, §3, §4.4, §5.1, §7).

### 9.2 Exact thumbnail pixel dimensions

Recommended 256×256 (§2.1) on the strength of the fixed 1024×1024 source giving a clean 4× downscale — but this is a low-stakes, easily-tuned implementation parameter, not something that needs sign-off before Bowser/Luigi start building against the rest of this design.

### 9.3 Upload-cancel: is a cancel affordance wanted?

Narrower than it was, now that in-flight close is settled (disabled — §4.4). What's still undecided is whether a **deliberate** cancel affordance is ever wanted, and what should happen if a user navigates away from the page entirely mid-upload (the in-flight request is simply cancelled by the browser today — no confirmation prompt is proposed, and the next visit's image list reflects server truth regardless of timing). Both are lower-stakes than they would be at a much larger cap, and both are deferred in §8 rather than specified — worth a decision eventually rather than a silent default.

### 9.4 Carousel active index — now fully decided

All four cases are settled: initial load = primary image (explicit `PrimaryImageId`, or the §1.2 derived default), post-upload = first image of the just-uploaded batch, post-delete = next in `SortOrder`, post-set-primary = no change (non-event). None require new persisted state — all four are expressed in terms of `SortOrder` and the existing primary-derivation rule. See §5.4.

### 9.5 Modal behaviour during and around an upload — all confirmed, nothing open

Both inferences this section previously flagged have been confirmed by Skyler, and both are now specified in place rather than held here:

- **Close is disabled while a request is in flight** (§4.4), with the visual treatment left to the implementer among the three options Skyler named. My inference was right, so nothing changed in the spec — only its status.
- **The close confirmation is an in-modal state swap** (§4.5), not a stacked dialog and not a native browser `confirm()`. The reasoning, including the `hunter-create` dirty-state convention that decided it, is recorded in §4.5 itself so it travels with the spec.

The one adjacent gap left open is deliberate and sits in §8: no `beforeunload`/refresh guard for staged files in this pass, deferred by Skyler.

---

## Appendix: new icons required

Per `docs/updates/svg-symbol-icons.md`'s existing "adding a new icon" recipe (add a `<symbol>` to the sprite, extend the `IconName` union, use `<app-icon name="...">`— no build step), this design needs two icons that don't exist in the sprite today:

- **`star`** — primary-image toggle (§5.3). Filled/solid, matching the existing solid-silhouette family (`icon-trash`, `icon-pencil`), not the outline nav/mystery-section family — this is a state toggle, not navigational chrome.
- **`chevron`** — carousel prev/next (§5.4). One symbol, reused twice with a `rotate-180` utility for the "next" direction rather than authoring a mirrored second symbol.

No new icon is needed for the empty states (§5.5) or the upload modal's submit spinner (§4.4) — those reuse each resource's existing `<app-domain-icon>` and the existing `icon-spinner`, respectively. The modal's per-file remove buttons reuse `icon-trash` (§4.4), also already in the sprite.
