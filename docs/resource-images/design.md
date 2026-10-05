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

At this confirmed size, image bytes belong directly in **Postgres, as `bytea`** (§2) — object storage isn't warranted at this data volume. A **generated thumbnail** is still worth having for list rows and carousel peeks, reasoned fresh at this size rather than carried over from a larger one (§2.1). **Upload feedback is a single busy spinner, not per-file progress** — Skyler's explicit simplification, applied in §4.4.

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

**The request/response shape per request is a single `POST`, one `{uploaded, rejected}` response — but one drop/pick can mean several such requests.** A batch larger than 10 files is split client-side into sequential `POST`s of at most 10 files each (a request-size limit, independent of the 10-image-per-resource cap in §1.4 even though the two numbers happen to coincide). Each request still gets its own response in the shape above; nothing about this section's response shape changes to accommodate chunking. Merging those responses into one combined result the user sees once is a frontend concern, specified in §4.4 — this section only describes what one request/response pair looks like.

---

## 4. Frontend component breakdown

New shared components, flat in `shared/` (matching the existing convention — `shared/` has no subfolders today; `confirm-delete-modal.component.ts`, `custom-select.component.ts`, etc. all live directly in it):

- **`shared/image-dropzone.component.ts`** (`app-image-dropzone`) — owns the drag-and-drop target, the hidden `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` + visible "Add Images" button fallback, the `POST .../images` call(s) (parametrized by a resource-type/id input, so it's one component wired into all four detail pages with no per-page glue), and the single in-flight spinner state (§4.4). For a batch over 10 files, it sends the sequential chunked requests itself and emits **one** merged upload result (`uploaded`/`rejected` combined across every chunk) for the host page to merge into its image list and render rejection copy — the host page never sees per-chunk results.
- **`shared/image-carousel.component.ts`** (`app-image-carousel`) — the peek carousel (§5). Takes the current image list + primary id as input; emits `setPrimary` and `deleteRequested` events. It does **not** own the confirm-delete-modal itself — per the existing convention (every current delete flow keeps `pendingDelete` state and the one `<app-confirm-delete-modal>` instance at the *page* level, e.g. `monster-detail.ts`'s `requestDeleteAttack`/`pendingDelete()`), the host detail page owns that state and renders the modal, exactly like it already does for Attacks/Powers/Armors/Weaknesses.
- **`shared/resource-thumbnail.component.ts`** (`app-resource-thumbnail`) — the small list-row image, with the placeholder fallback in §5.5 built in (rendered on a null thumbnail URL or an image load error). Takes a resource type (for the placeholder's domain color/icon) and an optional thumbnail URL (§2.1) — list rows always use the thumbnail endpoint, never the original.

### 4.1 Detail pages

One new card section, matching the existing `<article class="bg-surface border border-default rounded-lg p-3">` idiom used for Attacks/Powers/Armors/Weaknesses. **Placement: directly under the title/badge block, above the shared `<app-{x}-form>`** — not folded into the sub-resource grid. Reasoning: Attacks/Powers/etc. are per-domain mechanical data (a Monster's are different in kind from a Location's, which has none of them), while images are a universal, header-level concern for all four types — closer to identity than to stats. Putting it first, right where a reader would expect a "hero" visual near the name, also means it's the first thing that loads above the fold rather than competing for space at the bottom of a four-column grid.

**Confirmed by Skyler:** this placement and its reasoning are agreed — the image is meant to work as an immediate visual identifier for instant recognition when scanning lists, and as part of the creative process during create/edit, both of which line up with treating it as identity-level rather than a stats sub-section.

The whole card is the drop target (not a small sub-box inside it) — dragging a file anywhere over the "Images" section shows a drag-over state (dashed border + `bg-accent-subtle` tint, reusing the token already used for hover/focus affordances elsewhere) so the target is obviously large and forgiving rather than a fiddly small box. A labelled "+ Add Images" button sits in the section header for the file-picker path, in the same position and visual weight as `monster-detail.html`'s existing "+ Add Minion" button (`bg-accent hover:bg-accent-hover rounded-lg text-on-accent ... px-5`, `flex items-center justify-between` header row).

Because the carousel (§5) lives inside this same drop-target card, its `<img>` elements are `draggable="false"` (§5.1) — without that, a mouse drag starting on an image itself would fight the card's own file-drag detection instead of doing nothing, per Luigi's review.

**Persistence is decoupled from the page's Save button**, matching how Attacks/Powers/Armors/Weaknesses already work on this exact page: uploading, deleting, and setting-primary each fire their own request immediately and update the section's own state, entirely independent of `saveMonster()`/the shared form's submit. A user never needs to "Save" to keep an image change.

### 4.2 List pages

Thumbnail on the **left** of each row's content, before the name/badges block — the convention named in the brief and the one already implied by how these rows lay out today (`flex items-center ... gap-4`, content in a `flex-1 min-w-0` block). A `h-16 w-16 shrink-0 rounded-lg object-cover border border-default` image pointed at the **thumbnail** endpoint (§2.1/§3) — never the original — or the placeholder (§5.5), slots in as a new first flex child ahead of the existing `<div class="flex-1 min-w-0">`, with `gap-4` already providing the spacing. Small, additive change to `monsters-list.html`/`minions-list.html`/`locations-list.html`/`bystanders-list.html`, not a restructure.

### 4.3 Surfacing validation errors

- **Pre-flight rejections (wrong type, wrong extension) and per-file batch results** render inline, directly under the dropzone/carousel card — not as a toast, not as a modal. This matches the existing convention that actionable, in-context problems the user can immediately do something about (like a form's `text-danger` inline message) live next to the control that caused them, while toasts (`NotificationKind: 'success' | 'error'`) are reserved for post-navigation, after-the-fact caveats (the create-flow precedent). An upload rejection is neither — the user is still looking straight at the dropzone when it happens.
- Exact copy for each rejection reason is in §7.

### 4.4 Upload feedback — a single spinner, decided

**Settled by Skyler, overriding the per-file progress-bar design this section previously had: no progress bars at all.** Verbatim: *"We need no progress bars at all, only a spinner for the submitted file upload to ensure users are aware of a possibility of delayed interaction, particularly for slower connections."* This also resolves a real contradiction Luigi's review found in the previous version of this section (byte-progress on one multipart `POST` can't actually report "file k is accepted," only "bytes sent," and sits at 100% with nothing visibly happening while the server decodes/validates/thumbnails) — a single spinner for the whole in-flight period sidesteps that gap entirely rather than papering over it.

- **One spinner, not per-file, not byte-progress.** Shown for the full duration an upload is in flight — reuses the existing `icon-spinner` symbol (already shipped for the API-unavailable modal, per `docs/updates/svg-symbol-icons.md`'s inventory), no new icon needed.
- **A batch over 10 files is sent as several sequential requests, and the spinner spans all of them.** Per §3, the client chunks a large drop/pick into `POST`s of at most 10 files each. The spinner appears when the first chunk goes out and stays up across every subsequent chunk — it disappears only once the **last** chunk's response arrives, not after the first. A 14-file drop shows one continuous spinner through both requests, never a flicker between them.
- **Per-file results are merged across chunks into one combined summary, shown once.** Each chunk's response is its own `{uploaded, rejected}` pair (§3), but the user sees a single result after the whole sequence completes — one "X of Y images were added" line (§7.2) and one combined rejection list, not one summary per chunk. E.g. a 14-file drop split into a 10-file and a 4-file request, with 2 total rejections split across both, shows one "12 of 14 images were added" summary listing both rejected files together.
- The "+ Add Images" button and drop target stay disabled for the whole sequence, not just the first chunk (`[disabled]="isUploading()"`), matching the existing `isMutating()` disablement convention already used for every other in-flight mutation on this exact page (e.g. the Attack/Power/Armor/Weakness add-forms).
- No cancel-mid-upload affordance in this pass. Flagged as a reasonable deferred nice-to-have (§8), and as an open question in §9 for what should happen if the user navigates away mid-transfer.

---

## 5. Carousel visual & interaction design

### 5.1 Layout — the peek treatment, and which asset each slide loads

A horizontal flex track, one slide fully visible and centered, with the previous/next slides partially visible at the edges, scaled down and faded. Concretely: active slide `scale-100 opacity-100`, adjacent slides `scale-90 opacity-40` — reusing the literal `opacity-40` value already established in this codebase as "de-emphasized but present" (`.action-btn:disabled { opacity-40 }` in `styles.css`), rather than inventing a new de-emphasis value. `overflow-hidden` on the track container clips anything beyond the immediate neighbors.

**Resolution per slide:** the active/centered slide loads the full original (§3's `/file` endpoint) — it's rendered at full size and is the one place this design shows full detail. The peek (previous/next) slides load the **thumbnail** (§2.1/§3's `/thumbnail` endpoint) — they're rendered at 90% scale and 40% opacity, so pulling a full (up to 2 MB) original for a slide that's visually small and faded would be pure waste. Advancing the carousel promotes what was a thumbnail-backed peek slide into the active position, at which point it (re)requests the original — browsers cache the thumbnail request already made, so this isn't wasted work, just an additional fetch for the now-active slide's full detail.

**At the ends of the list, a peek slot is simply empty rather than wrapping** (no wraparound — §5.4): at the first image there is no previous peek, at the last image there is no next peek. The track just ends; nothing fills the missing slot.

**Every `<img>` in the carousel (active and both peeks) is rendered with `draggable="false"`.** The whole card is the upload drop target (§4.1), so without this, starting a mouse drag on the image itself would be interpreted as a native image-drag rather than doing nothing, fighting the card's file-drop detection — flagged by Luigi's review.

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

- **Carousel, zero images:** rendered inside the same card, as a single centered panel — a dashed-border box (reusing the drag-over treatment's visual language so the empty state itself already looks like a legitimate drop target) containing the resource's own `<app-domain-icon>` at a muted size, the text "No images yet.", and the same "+ Add Images" affordance. The empty state **is** the uploader, not a placeholder blocking access to one — consistent with this codebase's own established split (documented in Rosalina's history) that an empty state should state current status, not just decoration, and should never hide the one action that resolves it.
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

All four checks below are enforced **server-side** (client-side checks are a nice pre-flight courtesy — instant feedback before a request even goes out — but the server is the actual gate; never trust a client-declared MIME type). Exact copy, one line per rejected file, rendered as a list beneath the dropzone:

**Copy, simplified per Skyler** (replacing the earlier, more specific per-reason strings this table had): the wrong-file-type message keeps naming the accepted formats, since that's actionable information the user needs; every other rejection reason collapses to one of two generic sentences. Verbatim: *"The copy for the UI to reject oversized files should be, 'File too large to upload. Images must be 2MB or less in size.' For anything else besides a file type issue, we can use, 'File failed to upload. Please try again.'"*

| Failure | Copy |
|---|---|
| Wrong file type | *"`{fileName}` isn't a supported image type — only JPG, PNG, and WebP are allowed."* |
| Too large | *"File too large to upload. Images must be 2MB or less in size."* |
| Unreadable or oversized decoded dimensions (Bowser's decompression-bomb guard, §3) | *"File failed to upload. Please try again."* |
| Over the 10-image cap | *"`{fileName}` wasn't added — over the 10-image limit."* — **decided**, per Skyler: *"Over-cap message: option b is great."* Resolves the §7.4 tension; this one rejection reason gets its own copy instead of the generic fallback. |

The generic *"File failed to upload. Please try again."* string doesn't name the file — in the rejection list (§4.3), each line still identifies which file it's about by showing the filename as its own list-item label, with the message text next to it (e.g. `swamp-thing-6.webp` — *"File failed to upload. Please try again."*), rather than weaving `{fileName}` into the sentence the way the wrong-type and over-cap copy both do. The over-cap string, by contrast, names `{fileName}` inline the same way the wrong-type row does, since Skyler's chosen wording for it is built around naming the file directly rather than labelling it externally.

### 7.1 Type checking specifics

**Accepted types: JPG/JPEG, PNG, and WebP.** WebP is included per Skyler, since it's the `fal-image-gen` pipeline's native output format (that tool's own README confirms it defaults to WebP, falling back to PNG only if WebP encoding fails) — the app's accepted types need to match what the actual generation pipeline hands back, not just the two most conventional web image formats.

Validate both the file extension (`.jpg`/`.jpeg`/`.png`/`.webp`) and the actual file content (magic-byte sniffing, not the browser-declared `Content-Type` header, which is trivially spoofable) server-side. **WebP needs its own check, not a third case bolted onto JPEG/PNG's.** JPEG and PNG each start with a short, fixed byte sequence, but WebP is a RIFF container — a 4-byte `RIFF` marker, a 4-byte file size, then a 4-byte `WEBP` marker at offset 8 — so a validator that was written assuming "check the first few magic bytes against two known signatures" needs a genuinely distinct check for WebP's container structure, not just a third literal byte-sequence added to the same lookup. Worth calling out explicitly so this isn't discovered as a gap during implementation. This is a genuine security-adjacent detail worth a line to Boo when this design gets a security pass — accepting "whatever the browser says this file is" for something that gets stored and later served back to other users is exactly the kind of gap this app hasn't had to think about yet (§8 notes it as deferred-but-flagged, not resolved here).

### 7.2 Partial-batch failures — the exact-not-hedged case

Drag 5 files, 2 fail (say, one `.gif` and one 3 MB `.png`): the other 3 upload and appear in the carousel immediately; the 2 rejected ones are listed inline with their specific reasons, exactly as in the table above. **This is precise, not hedged**, per §3's reasoning — the server can and does know exactly which files landed. Copy for the summary line above the per-file list: *"3 of 5 images were added."* — factual, no apology needed since 3/5 succeeding isn't a degraded outcome, it's the expected behavior of independent per-file validation.

### 7.3 Wrong-type-only or too-large-only batches

If literally every file in a drop fails, no summary success line is needed — just the rejection list, with the dropzone remaining exactly as it was (nothing to display in the carousel, no page state changed).

### 7.4 Over the cap

If a resource has, say, 8 images and the user drops 5 more (13 total, 3 over): **accept the first 2 (in drop order, by the same `SortOrder` assignment as any other batch) and reject the remaining 3** with a cap-specific reason, rather than rejecting the whole batch of 5. This follows the same "a batch that's partially good ships the good part" principle as §3/§7.2 — hard-failing the entire drop just because it's slightly oversized would be a worse experience than accepting what fits.

**Copy for the 3 rejected files, per §7's table: *"`{fileName}` wasn't added — over the 10-image limit."*** — resolved; Skyler picked this cap-specific string over the generic fallback precisely because "please try again" would have told the user to retry an action that fails identically every time (the resource is at its cap, and nothing about retrying changes that). §7.5's pre-flight block (disabling "+ Add Images" once a resource is already at 10/10) only covers the case where the cap was already hit *before* the drop started; this copy is what covers the other case, where a drop that starts under the cap pushes past it mid-batch.

### 7.5 If the resource is already at 10

The "+ Add Images" button and drop target are `disabled`/inert with a short inline note ("10/10 images — delete one to add another") rather than silently accepting a drop and then rejecting everything from the server round-trip. Client-side awareness of the current count makes this a zero-latency block instead of a wasted request.

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
- **CDN/edge caching.** Not warranted at this data volume — images are served directly from Postgres via the app's own API (§2), not a CDN-fronted bucket, and nothing about this design's confirmed scale argues for adding one. Revisit only if the storage decision itself is ever revisited.
- **Wizard and minion-picker catalogues when pagination lands — soft note, not decided.** These catalogues will probably use typeahead rather than a full catalogue once pagination lands. This is a soft, non-blocking lean, not a firm decision, and nothing in this design depends on it.

---

## 9. Open questions / flagged assumptions

### 9.1 File size and storage — confirmed

Confirmed by Skyler: the cap is **10 images × 2 MB per file**, and images are stored as `bytea` directly in Postgres. This document has been revised throughout to that number and that storage decision (§2, §2.1, §3, §4.4, §5.1, §7).

### 9.2 Exact thumbnail pixel dimensions

Recommended 256×256 (§2.1) on the strength of the fixed 1024×1024 source giving a clean 4× downscale — but this is a low-stakes, easily-tuned implementation parameter, not something that needs sign-off before Bowser/Luigi start building against the rest of this design.

### 9.3 Upload-cancel: is a cancel affordance wanted?

§4.4 is a single spinner with no cancel-mid-upload control for v1. Worth asking whether users will actually want to abort a batch partway through, and separately, what should happen if a user navigates away from the page mid-upload (the in-flight request is simply cancelled by the browser today — no confirmation prompt is proposed, and the next visit's image list reflects server truth regardless of timing). Lower-stakes than it would be at a much larger cap, but still worth a decision rather than a silent default.

### 9.4 Carousel active index — now fully decided

All four cases are settled: initial load = primary image (explicit `PrimaryImageId`, or the §1.2 derived default), post-upload = first image of the just-uploaded batch, post-delete = next in `SortOrder`, post-set-primary = no change (non-event). None require new persisted state — all four are expressed in terms of `SortOrder` and the existing primary-derivation rule. See §5.4.

---

## Appendix: new icons required

Per `docs/updates/svg-symbol-icons.md`'s existing "adding a new icon" recipe (add a `<symbol>` to the sprite, extend the `IconName` union, use `<app-icon name="...">`— no build step), this design needs two icons that don't exist in the sprite today:

- **`star`** — primary-image toggle (§5.3). Filled/solid, matching the existing solid-silhouette family (`icon-trash`, `icon-pencil`), not the outline nav/mystery-section family — this is a state toggle, not navigational chrome.
- **`chevron`** — carousel prev/next (§5.4). One symbol, reused twice with a `rotate-180` utility for the "next" direction rather than authoring a mirrored second symbol.

No new icon is needed for the empty states (§5.5) or the upload-progress indicator (§4.4) — those reuse each resource's existing `<app-domain-icon>` and the existing `icon-spinner`, respectively.
