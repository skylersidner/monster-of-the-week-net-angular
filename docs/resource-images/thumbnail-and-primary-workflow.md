# Resource Images — Thumbnail Fetch Strategy and Primary-Image Lifecycle

**Prepared by:** Yoshi (Architect)
**Date:** 2026-10-03
**Input:** `docs/resource-images/design.md` (Rosalina), `docs/resource-images/phases.md` (Yoshi, 2026-09-26), and the current code: the four list endpoints and their repositories, `ApiContracts.cs`, the four list templates, `core/api.ts`, `mystery-create.store.ts`, `Program.cs` auth wiring, and the test harness.
**Scope:** A focused follow-up pass on two questions from Skyler. No app code. Pagination is out of scope for this work and is discussed only for what it means for the decisions made here.
**Status:** Recommendations for Skyler to confirm. The phases.md updates that follow from them are applied in the same pass.

---

## 0. Summary of calls

| Question | Call |
|---|---|
| Q1 — how list rows get their thumbnails | **Option (c): the list response carries `primaryImageId`; each row renders a native `<img loading="lazy">` pointed at the thumbnail URL.** No batch endpoint, no N+1, no inline bytes. The browser's own image pipeline is the batching mechanism. |
| Q4 — primary image on delete | **Auto-promote by derivation, with no restriction.** Deleting the primary is always allowed. The only write on delete is the DELETE itself; the database `SetNull` FK clears the pointer and the read-time rule (lowest `SortOrder`) picks the next primary. |
| Q4 — primary change | **One write (`PUT .../primary`), no thumbnail work.** Thumbnails belong to images, not to the primary role, so nothing is regenerated. The user's "generate a new thumbnail when the primary changes" model can be dropped. |
| Q4 — placeholder | **Frontend-only.** A `null` thumbnail URL or an `<img>` `error` event renders the domain placeholder. The server never needs an explicit "no primary" signal. |

Two corrections to the existing phases.md came out of this pass, both of which matter before Bowser starts Phase 1 and 4:

1. **Phase 4 as written is wrong for the null-primary case.** It says the list column is "a plain column pass-through" with "no join against `ResourceImage`." A null `PrimaryImageId` means "derive the lowest `SortOrder`," and that derivation requires a query against `ResourceImage`. The list projection must resolve it, and the phase's own §3.1 text already says so. The two passages contradict each other.
2. **Phase 4 undercounts the projection sites.** The list DTOs are built in eight places, not four: each of the four types has a `GetAll` projection and a by-mystery (or by-monster) projection. Details in §1.4 below.

---

## 1. Q1 — Thumbnail fetch strategy

### 1.1 What the code does today

- **The list endpoints are unpaginated bare arrays.** `GET /api/monsters` returns `IReadOnlyList<MonsterListItemResponse>` from `MonsterRepository.GetAllAsync`: `OrderBy(Name)`, no `Skip`/`Take`, one `ToListAsync`. The other three types behave the same way.
- **The list pages load everything once.** `monsters-list.ts` calls `monsterService.getAll()` in `ngOnInit`, sets a signal, and renders with `@for (monster of monsters(); track monster.id)`. There is no paging, no virtual scrolling, and no per-row fetch today.
- **The list endpoints are shared with non-list consumers.** `mystery-create.store.ts` calls `locationService.getAll()`, `bystanderService.getAll()`, and `monsterService.getAll()` to populate its attach catalogues, and `minion-create.ts` calls `monsterService.getAll()` for its monster picker. Any change to these payloads is seen by the wizard too, and any future pagination will break these callers unless it is planned for.
- **The frontend HTTP layer is thin.** `core/api.ts` wraps `HttpClient` with `get/post/put/delete` and a `toUrl` that prefixes `environment.apiBaseUrl`. There is no interceptor-level cache and no batching layer. In production `apiBaseUrl` is `''`, so requests are same-origin.
- **The API is cookie-authenticated everywhere.** `Program.cs` sets a global fallback policy of `RequireAuthenticatedUser()`, and the session cookie is `motw.session` with `SameSite=Lax`. Image requests will go through the same policy as every other endpoint.
- **The search endpoint already has a pagination shape.** `SearchService` takes `page` and `pageSize` and uses `Skip`/`Take` with clamping. Any future list pagination should copy that shape rather than invent one.
- **Current `DbContext` test harness is SQLite.** The API tests run `UseSqlite` (for example `MonsterRepositoryTests.cs`), not Postgres and not the EF InMemory provider. Production is Postgres.

### 1.2 The question, stated precisely

A list row needs two things to render a thumbnail: (1) the id of the image to show, and (2) the bytes. Every option below has to pay for (2). The thumbnail is binary, so unless it is inlined into JSON it is a separate GET for each row, and no batching strategy changes that. What the options actually compete on is how (1) is delivered, and what each option does to caching, payload size, and pagination.

Once (1) is in the list response, the N row thumbnail requests happen anyway, and they are the same requests in every option except (d).

### 1.3 The options

**(a) Per-row `GET /api/{resource}/{id}/images` after the list loads (N+1).**

Each row calls the images list to learn its primary image id, then requests the thumbnail.

- Requests for a 50-row list: 50 metadata calls plus 50 thumbnail calls, for 100 total, against 50 with (c).
- Latency: the metadata calls cannot start until the list is back. Browsers allow about six concurrent connections per host on HTTP/1.1. Fifty metadata calls therefore take about nine sequential round-trip waves before any thumbnail URL is known. At an assumed 100 ms round-trip to Railway, that is roughly 0.9 s of added latency before the first thumbnail is requested. This is an estimate; the real figure depends on the connection and on whether Railway serves HTTP/2 to the client.
- Pagination: no change in shape, but the cost scales with rows on screen, multiplied by two.
- **Reject.** It doubles the request count to deliver information the list endpoint can carry for 56 bytes per row.

**(b) A batch endpoint, e.g. `GET /api/monsters/primary-images?ids=...`.**

The list page sends the ids it has and gets back `{ ownerId → primaryImageId }`, then requests thumbnails.

- URL length: a GUID plus separator is 37 characters. Kestrel's default request-line limit is 8 KB, so the ceiling is roughly 210 to 220 ids before the request fails outright. A practical cap is 100 ids (about 3.7 KB), which has to be enforced and chunked above that. Railway's own proxy limit is not modelled anywhere in this repo.
- It solves a problem the list response already solves. The ids are known to the client from the list itself, so asking for them again is a second round-trip for the same facts.
- It does not reduce byte requests. Thumbnails are still one GET each.
- Pagination: the id list follows the visible page, so it is bounded by page size, but the endpoint must then be kept in step with the list's own paging parameters.
- **Reject as the primary mechanism.** Viable only as a fallback if the list response ever cannot carry the field.

**(c) Carry `primaryImageId` in the list response; each row renders `<img loading="lazy" src="/api/{resource}/{id}/images/{primaryImageId}/thumbnail">`.**

- Payload: `"primaryImageId":"<36 chars>",` is about 56 bytes per row. 500 rows add about 28 KB, which is negligible.
- Requests: one list call, plus one thumbnail GET per visible row. No coordination code, no loading state for the id, and no second data source to reconcile.
- Caching: the URL contains the `imageId`, and an image row is never edited in place (design §2). A `Cache-Control` of `immutable` is therefore honest. When the primary changes, the URL changes with it, so there is no stale-cache problem to manage.
- Lazy loading: `loading="lazy"` makes the browser fetch only rows that are near the viewport. For a one-screen list that is about eight thumbnails, not fifty. No code in the app has to implement windowing.
- Shared consumers: the wizard's catalogues and the minion picker receive one extra optional field. Harmless, and the wizard ignores it.
- Pagination: unchanged in the thumbnail path. The list envelope changes, the row contract does not.
- **Recommend.** This is the Phase 4 approach, and it holds. The Phase 4 text needs the derivation correction in §2.3.

**(d) Embed thumbnail bytes or data-URIs in the list response.**

Estimate, not measured: a 256×256 JPEG from a 1024 source is roughly 15 to 30 KB. Base64 adds a third. Using 20 KB as the midpoint:

| Rows in one response | Binary | JSON (base64) |
|---|---|---|
| 25 (one page) | ~500 KB | ~670 KB |
| 100 | ~2 MB | ~2.7 MB |
| 500 | ~10 MB | ~13 MB |

Costs beyond size:

- **Caching.** The list response becomes one large, non-URL-addressable blob. Each list refresh re-downloads every thumbnail. The `immutable` model in design §2 does not apply, because the bytes are no longer addressable at all.
- **Shared consumers pay.** The mystery wizard's three catalogue loads and the minion picker would download every thumbnail just to populate a dropdown, from the same endpoint.
- **Pagination.** Inlining makes page size a byte budget, not a row count, and every page refresh re-sends its images.
- **Reject.** The honest case for (d) is one request for a small, fixed list. This app's lists are neither.

**(e) A separate batch-by-owner-type endpoint called in parallel with the list.**

For example, `GET /api/monsters/images/primary` returns the primary image id for every monster, and the page joins it client-side.

- It is (b) without the id list, so it returns the primary map for the entire table. Unpaginated, its size grows with total data, not with what is on screen.
- If it is paginated, it has to take the same page parameters as the list. That means two endpoints that must stay in sync, and a client-side join that has to handle one of them arriving first.
- The parallel call also creates a loading-state question the list does not have today: the rows exist but their thumbnails do not, until the second call returns.
- **Reject.** It is (c) with the join moved to the client and a second paginated contract added.

### 1.4 Projection sites that carry the field (correction to Phase 4)

Phase 4 names "the four `GetAllAsync` implementations." There are eight projection sites producing list DTOs:

| DTO | Projection sites |
|---|---|
| `MonsterListItemResponse` | `MonsterRepository.cs` line 29 (`GetAllAsync`), line 50 (`GetMonstersByMysteryIdAsync`) |
| `MinionListItemResponse` | `MinionRepository.cs` line 27 (`GetAllAsync`), line 47 (by-monster) |
| `LocationListItemResponse` | `LocationService.cs` line 13 (`GetAllAsync`), line 34 (by-mystery) |
| `BystanderListItemResponse` | `BystanderService.cs` line 13 (`GetAllAsync`), line 34 (by-mystery) |

Every projection needs the field, or the mystery-scoped lists and the minion-by-monster list will silently return a null thumbnail for resources that have images. The change is additive, so it is safe to make everywhere at once.

### 1.5 Recommendation

**Option (c).** Add `PrimaryImageId: Guid?` (resolved to the derived primary, see §2.3) to all eight list projections. The Luigi side renders a native lazy `<img>` per row. Use no batch endpoint and no inline bytes.

**What this accepts:** the list endpoint now does one correlated subquery per row to resolve the derived primary. At current and pagination-sized page counts that is cheap, provided the index in §2.4 exists. The cost is also visible in the list projection, which is more coupled to image rules than it is today.

**What it means for pagination later.**

*Needed now:*
- The `primaryImageId` field in every list projection (Phase 4).
- Thumbnail responses with `immutable` caching, and with `private` rather than `public` (see §2.5).
- `loading="lazy"` on list-row `<img>` elements.

*Later, when pagination is prioritised:*
- The list envelope changes (for example `{ items, totalCount }`, or `page`/`pageSize` query parameters following the search endpoint's shape). The thumbnail path does not change.
- The wizard catalogue and minion picker call the same unpaginated list endpoints. They will need either a full-catalogue endpoint kept separate from the paged list, or a typeahead search. This is the real pagination cost, and it is not a thumbnail question. It should be raised when pagination is scoped, so those callers are not broken by it.
- Browser lazy loading gives windowing for thumbnails with no further work. Virtual scrolling of the rows themselves would be a separate decision, and is not needed at this scale.

---

## 2. Q4 — Primary image lifecycle

### 2.1 The mechanism as designed, verified against design §1.2 and phases §1 item 1

- `Monster.PrimaryImageId` (and the same on Minion, Bystander, Location) is a nullable FK to `ResourceImage.Id`, configured `DeleteBehavior.SetNull`.
- **`SetNull` only clears the pointer. It does not choose a replacement.** When the referenced `ResourceImage` row is deleted, the database sets the owner's `PrimaryImageId` to `NULL` and stops there. Nothing in the FK says "promote the next image."
- A null `PrimaryImageId` means the primary is derived: the image with the lowest `SortOrder` for that owner.

So the chain on delete is: the DELETE removes the row, the database nulls the pointer, and the next read derives the new primary. The "re-assignment" is a read-time calculation, not a write.

### 2.2 Does the derivation alone produce the right answer? Yes, with one behaviour to decide

Walking through the cases:

| Starting state | Action | Result |
|---|---|---|
| Null primary, images [A, B, C] by SortOrder | Delete A (derived primary) | Pointer already null, nothing to clear. Derivation now yields B. |
| Explicit primary = C, images [A, B, C] | Delete C | `SetNull` clears the pointer. Derivation yields **A**, the first uploaded, not B. |
| Explicit primary = B, images [A, B, C] | Delete A | Pointer unchanged (still B). |
| One image [A], primary derived | Delete A | Zero images. Pointer null, no write needed. |
| Zero images | Upload X | X is the derived primary. No primary write. |
| Explicit primary = B | Upload D | Primary stays B. |

The one row that matters is the third from the bottom of the explicit-primary pair. After deleting an explicitly chosen primary, the replacement is **the first uploaded image**, not the image next to it in the list. That follows directly from design §1.2's "falls through to the same default rule new resources start with." It is defensible (it is the same rule every resource starts with, so there is one rule to explain), but the confirmation footnote must say which image takes over, and it must be computed by the same rule, not described loosely. Design §6's "[next image's context] becomes primary" is ambiguous on this point and should be made concrete. See open question 1.

### 2.3 Where the derivation has to live, and where it breaks

**The list endpoint must resolve the derived id itself.** This is the break point for a naive read. If the list projection is a bare `x.PrimaryImageId`, a null pointer yields no thumbnail for any resource whose primary is derived, which is most resources. The list response must compute:

- `x.PrimaryImageId ?? (the lowest-SortOrder image for this owner)`

and that is a query against `ResourceImage`, filtered by `OwnerType` and `OwnerId`, ordered by `SortOrder`, first row. In EF terms it is a correlated subquery in the projection, which EF Core can translate to SQL. Bowser should confirm the generated SQL once; I have not verified the translation against this EF version.

**Two implementations of one rule is a drift risk.** The detail endpoints (`GET .../images`, `isPrimary`) compute the derivation in C#, and the list projections compute it in SQL. If they disagree, the list shows one thumbnail and the carousel marks a different image as primary. Recommend:

- one documented rule (explicit id, else lowest `SortOrder`), stated once in `IResourceImageService`;
- a test that asserts the list projection and `GET .../images` agree on `isPrimary` for each of the four cases in §2.2.

### 2.4 Index correction (phases §1 item 2)

Phases §1 item 2 specifies `HasIndex(e => new { e.OwnerType, e.OwnerId })`. The derivation is a "lowest `SortOrder` for this owner" query, so with that index it still needs a sort over the owner's rows. The index should be **`(OwnerType, OwnerId, SortOrder)`**. It covers the cap count, the list, the derivation, and the ordered `GET .../images`, and the cost is nothing at migration time.

### 2.5 Thumbnail URL caching correction (design §2, phases Phase 3)

Design §2 specifies `Cache-Control: public, max-age=31536000, immutable` on both `/file` and `/thumbnail`. These endpoints sit behind the global authenticated fallback policy, so every response is per-user session data. `public` tells any shared cache (a proxy, an edge, or anything Railway might add later) that it may store and serve the bytes to any requester. That is the wrong default for authenticated content.

**Recommend `Cache-Control: private, max-age=31536000, immutable`.** `private` keeps the response in the browser's own cache, which is all the design needs, and `immutable` remains honest for the same reason it did before: the `imageId` is never reused for different bytes. This is a deliberate deviation from design §2, and it should be recorded as one.

Also: the `/thumbnail` and `/file` handlers must confirm that `imageId` belongs to the `{id}` in the URL. Without that check, `/api/monsters/{A}/images/{imageOfB}/thumbnail` works. Not a security hole for a single-tenant app, but a correctness gap that a future multi-user change would turn into one.

### 2.6 Writes, per operation

| Operation | Writes | Notes |
|---|---|---|
| Upload (`POST .../images`) | `ResourceImage` rows only | Never writes the owner's primary. A new image becomes derived primary when it is the only one, and otherwise changes nothing. |
| Delete (`DELETE .../images/{imageId}`) | The one `ResourceImage` row. The owner's `PrimaryImageId` is cleared by the database `SetNull` if it pointed there. | No app-side primary write, and no "if this was primary" branch. Nothing for any of the four DELETE flows to forget. |
| Set primary (`PUT .../primary`) | One `UPDATE` to the owner's `PrimaryImageId` | Must check that the image belongs to the owner, and return 404 if it does not. A race where the image is deleted between the client's last read and this PUT would otherwise surface as an FK violation. |
| Thumbnail regeneration on primary change | **None** | See §2.7. |

### 2.7 Thumbnail regeneration on primary change: not needed

Thumbnails are generated once, at upload, and stored on the image row as `ThumbnailBytes` (design §2.1, phases Phase 2). Each image has its own thumbnail whether or not it is primary.

Nothing about being primary changes the image's bytes, its dimensions, or its thumbnail. "Primary" is a pointer on the owner, so when it moves, the list's `primaryImageId` changes and the browser fetches that image's thumbnail, which already exists.

The user's mental model ("generate a new thumbnail whenever a new primary is selected") would be true only under a different design: a separate stored "card image" per owner, cropped or sized differently from the peek thumbnail. That would make the primary a copy, not a pointer, and introduce the write-on-primary-change that does not exist today. Nothing in the current design asks for that, and the design's own purpose statement says the carousel is the full viewer. **Recommend simplifying this away.** Revisit only if a primary-specific crop is ever wanted (for example, a wider header banner), at which point it is a new feature with its own storage, not a thumbnail step.

Implementation note: the design's fallback (design §2.1, phases open question 2) also needs no write. If `ThumbnailBytes` is null, the `/thumbnail` handler streams `ImageBytes`. The primary-change path therefore has no failure mode that depends on thumbnail state.

### 2.8 Restrict versus auto-promote

**Option 1: restrict.** A primary cannot be deleted while other images exist. The user must first set another primary.

- *UX friction:* deleting the primary is the common case ("I'm done with this picture"). Under restrict it takes at least two actions: set another primary, then delete. The delete button on the primary would need to be disabled or redirect, with a tooltip explaining why. That is a disabled-control UX, which this codebase tends to avoid for destructive actions.
- *Confirm copy:* the modal would need an unusual message ("Set another image as primary before deleting this one"), and a 409 path for any client that did not check first.
- *Interaction with "delete the last image":* the rule is clean. The last image is always primary by definition, and the restriction only fires when another image exists, so the last-image case is always allowed. No conflict, but it means the restriction has an exception that a reader has to understand.
- *Benefit:* the user controls which image replaces the deleted one. That control is also available under auto-promote, through the footnote plus an optional `PUT .../primary` before deleting, and under auto-promote the user is told what will happen before confirming.
- *Cost:* one more server rule, one more error path, and one more frontend state, all to remove a choice the user can already make.

**Option 2: auto-promote by derivation.** Deleting the primary is always allowed. The database clears the pointer, and the next read derives the replacement.

- *UX:* one click, as expected. The footnote names the replacement (from the same rule as §2.2), so the consequence is visible before confirming.
- *Cost:* the replacement is the first-uploaded image, not a neighbour, after an explicit choice is deleted (§2.2). That is a behaviour to name, not a defect.

**Recommend Option 2.** It is the design the system already has (design §1.2 was written this way and Skyler confirmed it), it needs no extra writes, and the restrict option's only benefit is one that the footnote and an explicit `PUT` already deliver.

Confirm-modal footnote, under auto-promote, computed client-side from the loaded list (which is already ordered by `SortOrder`):

- If the deleted image is the primary and others remain: "This is the current primary image. After it's deleted, *{fileName of the derived replacement}* becomes the primary image."
- If it is the last image: "This is the last image. {Name} will have no images afterward."
- If it is not the primary: no footnote.

The footnote text must be computed by the same rule as the server (explicit id, else lowest `SortOrder`), with the deleted image excluded. Phases Phase 6 already calls for one shared helper for these branches. That helper should take the image list and the primary id as inputs, so it is testable as a pure function.

### 2.9 The placeholder

**Where it shows.**

- *List row:* when the list's `primaryImageId` is null. This is the zero-image case, and it is detectable from the list response with no extra request. The row renders `app-resource-thumbnail` with the domain-badge placeholder from design §5.5.
- *Detail carousel, zero images:* the empty state in design §5.5 already covers this. It is the uploader, not a dead end.
- *Detail carousel, active slide or peek slide fails to load:* the same placeholder inside the slide, sized to the slide.

**What triggers the fallback on image failure.** The `<img>` `(error)` event, handled inside `app-resource-thumbnail`. This is a frontend concern only. It covers:

- 404: the image was deleted after the list was loaded (another tab, or a delete from this page), or the id is stale.
- 401 or a login redirect: the session expired. Image requests do not go through `HttpClient`, so `auth-error-interceptor` never sees them. The fallback is the only thing that reacts. The page's own JSON request is what will trigger the login redirect, so this is covered in practice but should be checked.
- 5xx and network errors.
- Decode failure: a stored byte array that the browser cannot render.

**Implementation detail that matters.** The component must reset its failed state when its input changes. Otherwise a row whose primary was changed to a working image would keep showing a placeholder that it had set on the previous, failed one. Key the state on the URL: a signal `failedUrl` that is compared to the current `thumbnailUrl`, so a new URL is tried again without any explicit reset.

**Does the server need to return an explicit "no primary" signal?** No. `null` is sufficient. The list's `primaryImageId: null` means "this owner has no images." It is not ambiguous, because the derivation returns null only when there are no images. Adding an explicit sentinel or a status field would duplicate information the null already carries, and would add a second meaning for null to keep consistent. The server's only job is to return a valid id or null.

---

## 3. Corrections to existing documents

These are applied to phases.md in the same pass. Listed here so the reasoning is in one place.

1. **Phase 1, index** (§1 item 2, phases.md): `(OwnerType, OwnerId, SortOrder)`, per §2.4.
2. **Phase 2, tests**: add that the derivation rule is in one place, and that `PUT .../primary` rejects an image that does not belong to the owner (§2.6). The delete-primary test should confirm `SetNull` against SQLite, which the test harness uses (it enforces foreign keys by default under EF), and be confirmed once against Postgres, which is production.
3. **Phase 3, caching and endpoints**: `Cache-Control` is `private, ...immutable` (§2.5). `/file` and `/thumbnail` check `imageId` belongs to `{id}`. `PUT .../primary` returns 404 for a non-owned or deleted image.
4. **Phase 4**: rewritten. It is not a plain column pass-through. The projection resolves the derived primary (§2.3), applies to all eight projection sites (§1.4), and is verified against `GET .../images` for agreement (§2.3).
5. **Phase 5**: `app-resource-thumbnail` takes `thumbnailUrl: string | null`, renders the placeholder on null or on error, and resets its error state when the URL changes (§2.9).
6. **Phase 6**: the footnote helper takes the image list and primary id and is computed by the same rule as the server (§2.8). No restriction logic.
7. **Phase 7**: list-row `<img>` elements carry `loading="lazy"` (§1.5).

Corrections to the design document itself, to be recorded there rather than silently diverged from:

- design §2: `Cache-Control` becomes `private` (§2.5).
- design §6: footnote wording made concrete per §2.8.
- design §4.2 / §5.5: no change, placeholder behaviour is consistent with §2.9.

---

## 4. Phase 2 and Phase 3 risk items: decided by Skyler, reflected here

- **Railway request-size and proxy concern (phases §3.2):** deferred to post-deploy, per Skyler. It is not a blocker for this work. It stays on the list for the first real deploy of a multipart upload.
- **Cap-check and `SortOrder` race (phases §3.3):** accepted as a documented low-severity risk, per Skyler. No hardening work in scope.

---

## 5. Open questions

1. **After an explicitly chosen primary is deleted, should the replacement be the first-uploaded image (the default rule, as designed) or the image next to it?** Recommendation: first-uploaded, for one rule with no special case. The footnote has to name it, so this is the decision the footnote copy depends on.
2. **Do the wizard's attach catalogues and the minion picker keep the full unpaginated list, or move to a separate full-catalogue or typeahead endpoint when pagination lands?** Not needed now, but it determines what "pagination" actually costs, so it should be raised when pagination is scoped.
3. **Should `Cache-Control` be `private` (recommended, §2.5), against the design's `public`?** Confirm before Bowser builds the handlers.
4. **Is session expiry on an image request acceptable as a silent placeholder?** The page's JSON request will redirect to login, so in practice this is covered. Confirm that is the intended experience.
5. **Thumbnail size estimate (15 to 30 KB) is unmeasured.** The inline-bytes rejection in §1.3(d) does not depend on it. Worth one measurement against real `fal-image-gen` output once Phase 2 exists, as a check on the 256×256 choice (design §9.2), not as a gate on this design.
