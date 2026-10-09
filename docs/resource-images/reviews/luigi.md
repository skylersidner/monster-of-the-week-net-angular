# Resource Images — Frontend Review (Luigi)

**Date:** 2026-10-04
**Scope:** Review only. No application code changed. Covers `design.md`, `phases.md` (Phases 5–8, and 1–4 as contracts), and `thumbnail-and-primary-workflow.md`, checked against the current Angular code.
**Code read:** `app.config.ts`, `core/{api,credentials-interceptor,http-error-interceptor,auth-error-interceptor,self-handled-request,http-context-tokens}.ts`, `shared/{custom-select,mystery-select,confirm-delete-modal,domain-icon}.component.ts`, `shared/icons/{icon,icon-sprite}.component.ts`, `confirm-delete-modal.call-sites.spec.ts`, `styles.css` (whole file), all eight list/detail templates and their `.ts` files, `core/models.ts` list DTOs, `search-results.ts` (domain colour map), `data-admin.ts` (the only arrow-key precedent), `environments/environment.ts`, `proxy.conf.json`.

Settled decisions are not reopened here. Where the code shows a settled call has a structural problem, the item says so explicitly.

---

## 1. Component API fit with this codebase's conventions

**Verdict: the three-component split works. The input/output shapes need five corrections.**

### 1.1 Conventions the new components must follow (verified)

- **Decorator `@Input()` / `@Output() x = new EventEmitter<T>()` everywhere.** The app has zero uses of signal `input()`/`output()`. Don't introduce them here.
- **Any `@Input` that a `computed()` reads needs a signal-backed setter.** `mystery-select.component.ts` documents the bug (a `computed` that reads a plain `@Input` field freezes), and `domain-icon.component.ts` uses the same setter pattern. This applies to the carousel's `images`/`primaryImageId` (active-index clamping, which slide is primary) and the thumbnail's `thumbnailUrl` (the `failedUrl !== thumbnailUrl` comparison from workflow §2.9). A plain field would bring back the exact bug that file describes.
- **The app is zoneless.** There's no `zone.js` in `package.json`/`main.ts`/`angular.json`. Progress events written to signals are fine. Anything written to a plain field from an XHR callback won't re-render.
- **Shared components are presentational today.** HTTP lives in `core/*.ts` services that wrap `ApiService`. design.md §4 has `app-image-dropzone` making the `POST` itself. That works, but put the HTTP in a new `core/resource-images.ts` (an `ownerType` → `/api/{segment}/{id}/images` mapping, plus the URL builders for `/file` and `/thumbnail`) and inject it, rather than calling `HttpClient` inside `shared/`.

### 1.2 Corrections to the proposed APIs

1. **The dropzone and the carousel's empty state both claim the file picker.** design.md §4.1 makes the whole card the drop target and puts "+ Add Images" in the card header. §5.5 puts a second "+ Add Images" inside the carousel's zero-image state ("the empty state **is** the uploader"). If these are sibling components, the carousel can't open the dropzone's hidden `<input type="file">`. **Fix:** `app-image-dropzone` is the card shell. It holds the header, button, hidden input, drag-over state, progress list, rejection list and the zero-image empty state, and projects `<app-image-carousel>` through `<ng-content>` only when there's at least one image. This splits on the submission boundary (the upload unit), not on the visual layout.
2. **The dropzone needs `currentCount` as an input.** design.md §7.5's zero-latency "10/10 images" block and the pre-trim before a chunked POST both need the owner's current count. The input set is `ownerType`, `ownerId`, `currentCount`, `disabled`. The output is one merged `uploaded` event (see §6.4).
3. **The carousel's inputs are under-listed.** It needs `ownerType` + `ownerId` (to build the `/file` and `/thumbnail` URLs), `ownerName` (design.md §8's alt text "{name} image {n} of {count}"), `images`, `primaryImageId`, and `busy`. Outputs are `setPrimary(imageId)` and `deleteRequested(image)`. Use **one** source of truth for primary state. `GET .../images` returns `isPrimary` per row, but after a `PUT .../primary` (204, no body) the client has to update it locally. Hold a single `primaryImageId` signal, seeded from whichever row has `isPrimary`, and pass that down. Don't keep two flags that can disagree.
4. **The thumbnail placeholder's domain classes have to appear as literals.** `'bg-badge-' + type + '/40'` never reaches Tailwind's scanner. Use a static map, the same shape as `search-results.ts`'s `Record<string, string>` domain map. The `/40` modifier does work here, because the badge tokens are `@theme`-generated, not `@utility`.
5. **`app-domain-icon` can't be resized from outside.** Its template hardcodes `class="h-5 w-5"` on the inner `<svg>`, and a host class doesn't override that. h-5 works inside the `h-16` list placeholder. The carousel empty state's "muted size" icon, and a placeholder filling a full-size slide, can't get bigger. A small change to `DomainIconComponent` (a size input, or `h-full w-full` on the svg with the size moved to the host) needs to go in Phase 5, and it has to be checked against the nav and search-results call sites.

### 1.3 Delete-flow wiring: the four detail pages are not alike

design.md §4 cites `monster-detail.ts`'s `pendingDelete` as the convention every host follows. That holds for **two of the four** pages:

| Page | `pendingDelete` | `<app-confirm-delete-modal>` | `activeMutation`/`isMutating` | Badge row |
|---|---|---|---|---|
| monster-detail | yes, `{ label, perform }` | yes, name-only | yes | yes, **then a Minions block before the form** |
| minion-detail | yes, `{ label, perform }` | yes, name-only | yes | no ("Belongs to" line) |
| location-detail | **none** | **none** | **none** (`isSaving` only) | no (bare `<h2>`) |
| bystander-detail | **none** | **none** | **none** | no |

Consequences:
- On location-detail and bystander-detail the delete infrastructure has to be built from scratch, not reused.
- On monster-detail and minion-detail, `pendingDelete`'s shape has no footnote field, so it has to be extended and the modal binding gains `[footnote]`.
- **`confirm-delete-modal.call-sites.spec.ts` asserts the census "16 in 14 templates", and records monster-detail/minion-detail as the `name-only` shape.** Phase 6 changes both. Plan for the update, or Phase 6's gate fails on a test that has nothing to do with images.
- **Placement is ambiguous on monster-detail.** "Directly under title/badges, above the form" has a Minions section sitting between the two. The section goes above Minions to honour "under the badges". That needs Rosalina's confirmation before anyone builds it.
- **Don't route image failures through the page's `errorMessage`.** On all four pages `@else if (errorMessage())` comes before the entity branch, so setting it unmounts the whole page (location-detail.ts's own comment on `save()` documents this). Image errors need their own inline signal inside the section.

**Recommendation (keeps the three settled components):** put the per-page orchestration in a component-scoped injectable, `ResourceImagesStore`, provided in each detail page's `providers`. It owns load, upload merge, set-primary, delete, the `pendingDelete`-for-images state, the pure footnote helper, and the section's inline error. `mystery-create.store.ts` is the precedent. Each page then adds one `providers` entry, one section block, and (on location and bystander) one modal instance. Without the store you get four copies of that glue, with two of them starting from nothing, and that's the drift risk Phase 8 only audits after the fact.

---

## 2. The two new icons (`star`, `chevron`)

**Verdict: the recipe in `docs/updates/svg-symbol-icons.md` ("Adding a new icon": add a `<symbol>`, extend `IconName`, use `<app-icon>`) is accurate for `chevron`. It does not cover `star`'s filled/outline toggle, and following the doc's suggested "solid-silhouette family" literally makes that toggle impossible.**

- `IconName` in `icon.component.ts` is currently `'trash' | 'pencil' | 'close' | 'menu' | 'plus' | 'spinner' | 'search' | 'logo' | 'wizard'`. design.md's list of seven is out of date, but that doesn't affect the work.
- **`chevron`**: no problems. A stroke symbol in the `icon-close`/`icon-plus` idiom (`viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"`). `rotate-180` on the `<app-icon>` host works because the host is `inline-flex`, so transforms apply.
- **`star`**: design.md §5.3 asks for a filled star in the `icon-trash`/`icon-pencil` family, toggled filled vs outline. Those symbols declare `fill="currentColor"` **on the `<symbol>` element**. In the `<use>` shadow tree that presentation attribute beats inherited CSS `fill`, so one symbol built that way always renders filled. `IconComponent` also has no input for fill or stroke. Two options that work:
  - **(a, recommended)** One `icon-star` symbol with `stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"` and **no `fill` attribute anywhere**. The call site sets `class="fill-current"` (primary) or `class="fill-none"` (not primary) on the `<app-icon>` host, and CSS `fill` inherits through `<use>`. The outline state must set `fill-none` explicitly, because the initial value of `fill` is black.
  - (b) Two symbols, `star` and `star-outline`. That's simpler to reason about but goes against the design's one-symbol intent.
  - Either way, add a comment to the sprite symbol saying its fill is deliberately left unset. Otherwise the next person "fixes" it to match its neighbours.
- `IconComponent` renders `aria-hidden="true"` on its svg, so both star states and both chevrons need `aria-label` on the wrapping `<button>`, as design.md §5.3 and §5.4 already specify. For the star, `aria-pressed` is the better semantic for a toggle. If the "already primary" state is a no-op, use `aria-disabled` or plain text instead of a button that does nothing.

---

## 3. `--color-image-primary-indicator` and the `color-mix` glow

**Verdict: the token doesn't exist yet. The `color-mix` precedent is real, but the design applies it somewhere the precedent doesn't, and the glow as specified would be clipped.**

- `--color-image-primary-indicator` isn't in `styles.css`. `--color-focus-ring` exists in `@theme static` (`color-mix(in oklab, var(--color-indigo-500) 20%, transparent)`) and in `.dark` (indigo-400 at 35%). The technique can be copied.
- **Aliasing one semantic token to another (`var(--color-accent)`) has no precedent.** Every existing token points at a palette value and gets an explicit `.dark` row. `--color-badge-playbook`, which the design cites, is `var(--color-indigo-100)` plus its own `.dark` override, so it isn't an alias of `--color-accent`. The alias still resolves correctly in dark mode: `ThemeService` toggles `.dark` on `document.documentElement`, which is the same element as `:root`, so `var(--color-accent)` resolves against the dark value. **Still add a `.dark` row anyway** (`--color-image-primary-indicator: var(--color-accent);`). That matches the file's "every token in both scopes" convention, and it keeps the alias correct if `.dark` ever moves off `<html>`.
- **Where the `color-mix` sits.** The precedent puts `color-mix` inside the token, and the utility (`ring-focus`) only does `box-shadow: 0 0 0 2px var(--color-focus-ring)`. The design puts `color-mix` in the usage. Follow the precedent: add a hand-written `@utility image-primary-glow { outline: 2px solid var(--color-image-primary-indicator); box-shadow: 0 0 16px color-mix(in oklab, var(--color-image-primary-indicator) 45%, transparent); }` next to `ring-focus`. Don't use an arbitrary `shadow-[0_0_16px_color-mix(...)]` class at the call site.
- **Clipping:** design.md §5.1 puts `overflow-hidden` on the track, and §5.2 puts a 16px glow on the active slide. The glow gets cut off unless the track has padding of at least 16px (or the slide is inset). Name this in Phase 5 so it isn't found during the Playwright check.
- **The focus-ring precedent doesn't transfer to the carousel's focus state.** design.md §5.4 says the carousel region uses `ring-focus`. `styles.css`'s own `.entity-link:focus-visible` comment records that `ring-focus` without a bordered element is about 1.3:1 and fails WCAG 2.4.11. The carousel region isn't a bordered input. Use the `.entity-link` treatment instead (`outline: 2px solid var(--color-accent); outline-offset: 2px` on `:focus-visible`). That's a correction to a settled detail of §5.4, and the reason is the codebase's own documented contrast finding.

---

## 4. Phase ordering and scope

**Recommendation: keep phasing by layer (don't switch to per-resource), but split Phase 6 into a pilot and a rollout, fold Phase 8 into the rollout, and make Phase 5 build the store as well as the components.**

Why not phase by resource type:
- Phases 1–4 are layered, and Phase 4 is one projection change across eight sites. A per-resource frontend phase would still have to wait for all of Phase 4.
- Phase 7 (list wiring) is small: four templates, about five lines each, plus the URL helper. Splitting it four ways adds four commits and four gates for very little work.

Why Phase 6 as one heading is mis-sized:
- It isn't four times the same work. §1.3 above shows two of the four detail pages have no delete or mutation infrastructure, and monster-detail has the placement ambiguity. The real API-shape risk is concentrated in **the first page wired against the live backend**. That's where Phase 5's fixture-built component APIs either hold or get reworked.
- Phase 5 builds against fixtures with "no real HTTP call needed". The tricky parts of item 6 below (the 400 body arriving as `HttpErrorResponse.error`, toast suppression, chunk merging, progress-event mapping) only show up against the real endpoint.

Proposed shape (phase numbers change, so this needs Skyler's OK under the commit-per-phase rule):
- **Phase 5:** the three components + `ResourceImagesStore` + `core/resource-images.ts` (service and URL helpers) + icons + token/utility + the `DomainIconComponent` size change + the footnote pure function with its unit tests.
- **Phase 6a (pilot):** **monster-detail** end to end against the real Phase 3 API. It's the hardest host: the Minions block, an existing name-only modal whose shape changes, and `activeMutation` interplay. Any component API correction lands here, once.
- **Phase 6b (rollout):** minion-detail, location-detail and bystander-detail (two of them get modal and pendingDelete infrastructure from scratch), the modal census spec update, and the cross-page copy and footnote audit that was Phase 8. With a shared store and component, the audit is a short checklist, not a phase.
- **Phase 7:** the four list pages, unchanged. `loading="lazy"`, `decoding="async"`, and `width`/`height` attributes on the `<img>` to avoid layout shift.

**One scope gap to raise:** Phase 4 adds `primaryImageId` to the by-monster and by-mystery projections, but no frontend phase uses them. monster-detail's own Minions block renders `MinionListItemResponse` rows, and mystery-detail lists monsters, locations and bystanders. Either add thumbnails there (Phase 7) or say explicitly that they're out of scope. Right now it's silent.

**One blocker for Phase 6:** phases.md §1 item 7 adds an `UnreadableOrOversizedDimensions` rejection reason and says it "needs ... §7's copy table before Phase 6 can render it". design.md §7 still has no copy for it. Rosalina needs to supply the string before Phase 5's dropzone tests can assert it verbatim.

---

## 5. Carousel interaction: what's underspecified

There's **no gesture precedent in this app at all.** A grep for `pointerdown`/`touchstart`/`pointermove`/`dragover`/`(drop)` finds nothing, and the only arrow-key handler is `data-admin.ts`'s tablist roving focus. All of the following needs deciding before Phase 5, not during it:

1. **Swipe mechanics.** Use Pointer Events (not separate touch and mouse handlers), with `touch-action: pan-y` on the track so vertical page scroll still works on mobile. Commit on a stated threshold (suggested: 50px or 20% of slide width, whichever is smaller). Decide whether a mouse drag swipes; I'd make it touch/pen only, because on desktop the chevrons are better and mouse-drag fights text selection.
2. **Native image drag vs. the card-level dropzone.** A mouse drag on a carousel `<img>` starts a native image drag, which fires `dragenter`/`dragover` on the surrounding dropzone card. Without guards the card shows "drop files here" for a drag of its own image. Two fixes: `draggable="false"` on carousel images, and the dropzone only reacts when `event.dataTransfer.types.includes('Files')`. Track an enter/leave counter, or ignore `dragleave` into child elements, so the highlight doesn't flicker over child elements.
3. **Ends of the list.** Wrap or not? With 2 images, wrapping shows the same image as both peeks. Recommend no wrap: chevrons disabled at the ends, empty peek slot at index 0 and at the last index. With 1 image, no chevrons and no swipe.
4. **Active index after mutations.** Not specified. Proposal: on load, start at the **primary** (not index 0), so the hero is the identifying image. After an upload, move to the first newly added image. After a delete, keep the same index clamped to the new length. After set-primary, stay put.
5. **The delete control has no placement.** The carousel emits `deleteRequested`, but §5.3 only places the star. Suggestion: an `action-btn action-btn--delete` trash button in the opposite bottom corner of the active slide, active slide only, like the star.
6. **Peek slides.** §5.2 calls them non-interactive. Confirm that clicking a peek slide does *not* navigate, or make it do so explicitly. Either way, take them out of the tab order and hide them from assistive tech (`aria-hidden="true"`, `inert`).
7. **ARIA beyond `role="group"`.** Follow the APG carousel pattern: `aria-roledescription="carousel"` on the region; each slide `role="group" aria-roledescription="slide" aria-label="{n} of {count}"`; a polite live region announcing "Image {n} of {count}" on chevron or arrow navigation. ArrowLeft/ArrowRight are handled on the region, but should not fire when the event target is a button inside it that already uses arrows (none do today, so it's safe for now).
8. **Reduced motion.** The scale, opacity and translate transitions need a `motion-reduce:transition-none` (or a `prefers-reduced-motion` block). `styles.css` notes there's no reduced-motion precedent yet. This would be the first one that matters, because this one actually moves things.
9. **Active slide loading.** A newly active slide requests the original (up to 2 MiB). Its thumbnail is already cached, so render the thumbnail underneath and swap the original in on `load`, so the screen doesn't flash blank. The error fallback (placeholder) applies to the original too.

---

## 6. Upload progress via `reportProgress`, and the per-file vs. single-POST gap

### 6.1 The HTTP setup supports progress (confirmed), with three requirements

- **`provideHttpClient(withInterceptors([...]))` has no `withFetch()`**, so the app uses the XHR backend, which emits `HttpEventType.UploadProgress`. **The Fetch backend does not emit upload progress.** If someone adds `withFetch()` later, the progress bars stop working with no error. Add a comment in `app.config.ts`, plus a test that asserts an `UploadProgress` event reaches the dropzone through the real interceptor chain.
- **All three interceptors pass progress events through untouched.** `credentialsInterceptor` only clones the request, and `httpErrorInterceptor`/`authErrorInterceptor` only add `catchError`. They don't filter or map the event stream.
- **`ApiService` has no `observe: 'events'` / `reportProgress` method**, and its `toUrl` is private. Add an `ApiService.postWithProgress()` (or similar). Don't call `HttpClient` directly in a way that duplicates the base-URL logic.

### 6.2 Error paths that would fire the wrong UI today

- **The all-rejected 400 would show a generic toast on top of the inline rejection list.** design.md §3 returns `400 { uploaded: [], rejected: [...] }` when every file fails. `httpErrorInterceptor` turns any 400 into "Request failed (400) for POST /api/…", which contradicts §4.3 ("inline, not as a toast"). The upload request must set the existing `SUPPRESS_ERROR_TOAST` context token. The 401 bounce still works under it, as that token's doc comment explains. The dropzone must also read the `{ uploaded, rejected }` body from `HttpErrorResponse.error` on the 400 path. That isn't the success path.
- **Client-side size checking is mandatory, not optional.** design.md §7 calls client checks "a nice pre-flight courtesy". Under Phase 3's 24 MiB request cap they aren't optional. Ten 3 MB files (30 MB) get a framework 413 before the per-file logic runs, so there are no per-file reasons to show. The client must pre-reject files over 2,097,152 bytes and unsupported extensions/MIME types before building the POST. The server stays the real gate, and the client check is what keeps every POST under 24 MiB.

### 6.3 The real gap: per-file progress bars vs. one multipart POST

**design.md §4.4 contradicts itself.** Bullet 1 promises "a per-file progress list (filename + a progress bar/percentage)". Bullet 4 and §3 say the bar "communicates *how far the request has gotten*, not a stream of individually-resolving files", over one POST. XHR upload progress reports `loaded`/`total` for **the whole multipart body**. It doesn't report per-file progress. So:

- **Per-file bars can only be derived, not measured.** `FormData` serialises parts in append order, so cumulative `file.size` offsets map `loaded` onto "file k is sending / done sending", with about 1% error from part headers and boundaries. That's feasible, but what it measures is **bytes sent**, not **file accepted**. A bar can reach 100% and then be rejected by magic-byte sniffing, the dimension guard, or the cap.
- **There's a dead period after 100%.** After the last byte is sent, the server runs magic-byte checks, a SkiaSharp header read, a decode and a 256×256 thumbnail for each of up to 10 files, then a single `SaveChangesAsync`. Every bar sits at 100% with nothing happening until the response arrives. The design has no "Processing…" state for this. It needs one: the last `UploadProgress` at `loaded === total`, then a spinner until `HttpEventType.Response`.
- **On localhost the bars won't animate.** A few MB arrive in one or two progress events, so the bars jump from 0 to 100. Phase 5/6's "UI check" will look broken on the dev server even when it's correct. Test it with a DevTools network throttle, or with a unit test that feeds synthetic `UploadProgress` events.
- **Chunking adds a queued state.** Phase 3 requires the client to send at most 10 files per POST, in sequence. A 14-file drop means files 11–14 show "queued" at 0% while chunk 1 is in flight, and the §7.2/§7.4 summary ("3 of 5 images were added", "Only 2 more images could be added…") has to be **merged across chunk responses plus client-side pre-rejections** before it's shown. Neither design.md nor phases.md says who merges this. It belongs in the dropzone, which emits one merged outcome.
- **Truly per-file progress means N single-file POSTs.** I don't recommend that. It gives up the one-`SaveChangesAsync`-per-batch atomicity Phase 2 chose, and it makes the §7.4 cap summary purely client-side. Run in parallel, it also brings back the §3.3 race as something we'd be causing ourselves. Run sequentially, it's slower and still needs the same merge code.

**My recommendation, for Rosalina/Skyler to decide because it changes a settled detail:** keep one POST per chunk of up to 10 files. Show **one aggregate progress bar per in-flight request**, and a per-file **status** list (queued → sending → processing → added / rejected with reason) instead of per-file percentage bars. If per-file bars must stay, derive them from cumulative byte offsets, label them as transfer progress, and add the processing state. In both cases the "Processing…" state and the cross-chunk merge are new requirements the design doesn't have yet.

### 6.4 Smaller points

- Mapping results back to files uses `fileName` (the `rejected` entries and `ImageResponse.FileName`). Two files with the same name in one drop are ambiguous. Match by position within the chunk if the server keeps order, or accept the ambiguity. Either way, decide it.
- Navigating away mid-upload: a component-scoped `takeUntilDestroyed` cancels the XHR. That's consistent with design §9.3's "simply cancelled by the browser", but whether the server has already committed depends on timing. The next visit's `GET .../images` will show the truth, and that's acceptable.

---

## Summary of what needs a decision before Phase 5 starts

1. Per-file progress: aggregate bar + per-file status list (recommended), or derived per-file bars. Either way, add a processing state and a cross-chunk merge (§6.3).
2. Copy for `UnreadableOrOversizedDimensions` (§4).
3. Images section placement relative to monster-detail's Minions block (§1.3).
4. Carousel behaviour: wrap, initial and post-mutation active index, delete-button placement, swipe threshold, mouse drag (§5).
5. Phase 6 split into pilot + rollout, with Phase 8 folded in (§4). Phase numbering changes, so Skyler confirms.
6. Whether the by-monster and by-mystery list consumers (monster-detail's Minions block, mystery-detail) get thumbnails or are explicitly excluded (§4).
