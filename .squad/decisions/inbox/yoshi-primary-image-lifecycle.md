# Decision: Primary image lifecycle and list thumbnail fetch (resource images)

**Date:** 2026-10-03
**Owner:** Yoshi (Architect)
**Status:** Recommended; Skyler to confirm. Full analysis in `docs/resource-images/thumbnail-and-primary-workflow.md`.

## What

1. **Deleting the primary is always allowed (auto-promote).** No restriction. The DB `SetNull` FK clears `PrimaryImageId`; the replacement is derived at read time as the lowest `SortOrder` image. The delete path performs no app-side primary write.
2. **Setting primary is one write** (`PUT .../primary`, 404 on non-owned id). **No thumbnail regeneration on primary change.** Thumbnails are per-image, created at upload.
3. **The list response carries `PrimaryImageId`, the derived-or-explicit primary,** on all eight list projections. Rows render a native lazy `<img>` at the thumbnail URL. No batch endpoint and no inline bytes.
4. **Placeholder is frontend-only.** `null` URL or `<img>` error renders the domain placeholder. No explicit "no primary" server signal.
5. **Image responses use `Cache-Control: private, max-age=31536000, immutable`** (design §2 said `public`).

## Why

- The derivation lives in one place (SQL in the list, C# in `GET .../images`, agreement-tested), and the write path has no branch for "was this primary", so there is nothing for the four DELETE flows to forget.
- Restriction adds two actions and a disabled-control UX to remove a choice the footnote already lets the user see and make via `PUT .../primary`.
- Thumbnails belong to images, not to the primary role. Regenerating on primary change would require a separate stored "card image", which is a different feature.
- `public` on session-gated bytes lets shared caches hold per-user content; `private` keeps the same browser-caching benefit.

**Accepted trade-off:** after an explicitly chosen primary is deleted, the replacement is the first-uploaded image, not its neighbour. The footnote must name it.
