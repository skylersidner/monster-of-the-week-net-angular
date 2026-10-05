import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '../core/resource-images';
import { RejectedResourceImageResponse, ResourceImageResponse, ResourceImageUploadResponse } from '../core/models';

/**
 * Pure rules for resource images. No Angular and no HTTP, so each one is tested directly.
 * The components and `ResourceImagesStore` call these and never re-implement them; that keeps the
 * four detail pages from drifting apart.
 */

/** Carousel/list order: `SortOrder`, then `Id`. The same order the server uses (phases.md Phase 2). */
export function compareImages(a: ResourceImageResponse, b: ResourceImageResponse): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  // Ties only come from the accepted concurrent-upload race (phases.md §3.3). Ordinal string order
  // is a deterministic tie-break, but not guaranteed to match Postgres's uuid order. When the two
  // disagree, the server's `isPrimary` wins, because the store seeds primary state from it.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The primary image's id, by the same rule as the server (design.md §1.2): the explicit id if it is
 * still in the list, else the first image by `SortOrder` (then `Id`). `null` only when there are no
 * images.
 */
export function derivePrimaryImageId(
  images: readonly ResourceImageResponse[],
  explicitPrimaryId: string | null,
): string | null {
  if (explicitPrimaryId && images.some((image) => image.id === explicitPrimaryId)) {
    return explicitPrimaryId;
  }

  return [...images].sort(compareImages)[0]?.id ?? null;
}

/**
 * The confirm-delete modal's footnote (design.md §6, thumbnail-and-primary-workflow.md §2.8). Three
 * branches:
 *
 * - **Not the primary:** `''`, no footnote.
 * - **The last image:** the resource will have no images afterward. The footnote doesn't mention
 *   "primary" at all.
 * - **The primary, with others left:** names the replacement by `fileName`. The replacement is the
 *   first-uploaded remaining image, **not** the neighbour. After the delete the server's `SetNull`
 *   clears an explicit primary, so derivation runs with no explicit id. That holds whether the
 *   deleted primary was explicit or derived.
 *
 * Deleting the primary is always allowed. There is no restriction branch.
 */
export function resourceImageDeleteFootnote(
  images: readonly ResourceImageResponse[],
  primaryImageId: string | null,
  deletingImageId: string,
  ownerName: string,
): string {
  const currentPrimary = derivePrimaryImageId(images, primaryImageId);
  if (deletingImageId !== currentPrimary) {
    return '';
  }

  const remaining = images.filter((image) => image.id !== deletingImageId);
  if (remaining.length === 0) {
    return `This is the last image. ${ownerName || 'This resource'} will have no images afterward.`;
  }

  const replacementId = derivePrimaryImageId(remaining, null);
  const replacement = remaining.find((image) => image.id === replacementId)!;
  return `This is the current primary image. After it's deleted, ${replacement.fileName} becomes primary instead.`;
}

/**
 * Which slide becomes active after a delete (design.md §5.4, "next in array"): the image that
 * followed the deleted one in `SortOrder`. If the deleted image was last, the new last image.
 * `null` when nothing is left.
 */
export function activeImageIdAfterDelete(
  images: readonly ResourceImageResponse[],
  deletedImageId: string,
): string | null {
  const ordered = [...images].sort(compareImages);
  const index = ordered.findIndex((image) => image.id === deletedImageId);
  const remaining = ordered.filter((image) => image.id !== deletedImageId);
  if (remaining.length === 0) {
    return null;
  }

  if (index < 0) {
    return remaining[0].id;
  }

  return (remaining[index] ?? remaining[remaining.length - 1]).id;
}

// --- Upload: staging validation, outcome, copy ---

/**
 * Pre-flight type/size check (design.md §7: courtesy, not the gate). The **size** half is still
 * required: without it a pick of 3 MB files can push a `POST` past the 24 MiB request limit, and
 * that request then fails before any per-file result exists. Returns the server's enum name, so
 * client and server rejections render through the same copy.
 */
export function preflightRejectionReason(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const lowerName = file.name.toLowerCase();
  const extensionOk = ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  // An empty `type` is common (the OS has no mapping), so the extension decides then. The server
  // sniffs magic bytes regardless.
  const typeOk = file.type === '' || ACCEPTED_IMAGE_MIME_TYPES.includes(file.type);
  if (!extensionOk || !typeOk) {
    return 'UnsupportedType';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'TooLarge';
  }

  return null;
}

/** What `planUpload` decided for one pick: which files to send, and which to reject without sending. */
export interface UploadPlan {
  /** Files to send, in pick order, each with its index in the original pick. */
  accepted: { index: number; file: File }[];
  /** Files rejected in the browser, each with its index in the original pick. */
  rejected: { index: number; rejection: UploadRejection }[];
}

/**
 * Decides, for one pick or drop, which files are worth sending (design.md §7, §7.4).
 *
 * **Check order: type and size first, then the cap — deliberately matching
 * `ResourceImageService.UploadAsync`'s own order.** The server checks the cap last, against files
 * that are otherwise valid, so an invalid file never consumes a cap slot. The client does the same,
 * which is what makes the two agree on which reason each file gets in a mixed batch. Reverse the
 * order and a resource with 9 images that gets a `.gif` and a valid `.webp` would call the `.gif`
 * `CapExceeded` here while the server calls it `UnsupportedType`.
 *
 * **The cap trim rejects in the browser rather than sending files already known to be doomed**
 * (Skyler, 2026-10-05). `remainingSlots` is `10 - currentCount`. Files past it are rejected in pick
 * order with the same `CapExceeded` reason and copy the server would have used. Server-side
 * enforcement is untouched and stays authoritative: this only avoids spending an upload on files
 * that cannot land.
 *
 * §7.5's "already at 10" block covers the case where the resource was full before the drop started.
 * This covers a drop that starts under the cap and goes partway past it.
 */
export function planUpload(files: readonly File[], remainingSlots: number): UploadPlan {
  const plan: UploadPlan = { accepted: [], rejected: [] };
  let slotsLeft = Math.max(0, remainingSlots);

  files.forEach((file, index) => {
    const reason = preflightRejectionReason(file);
    if (reason) {
      plan.rejected.push({ index, rejection: { fileName: file.name, reason } });
      return;
    }

    if (slotsLeft <= 0) {
      plan.rejected.push({ index, rejection: { fileName: file.name, reason: 'CapExceeded' } });
      return;
    }

    plan.accepted.push({ index, file });
    slotsLeft -= 1;
  });

  return plan;
}

/** One rejected file, in submission order, with the reason that picks its copy. */
export interface UploadRejection {
  fileName: string;
  reason: string;
}

/**
 * The result of one submit. Still the modal's output contract and the store's input, unchanged in
 * shape from the dropzone era so `ResourceImagesStore.applyUpload` and its spec are untouched
 * (phases.md R1).
 */
export interface UploadOutcome {
  /** How many files were **submitted** — not how many were staged. Invalid staged files were never part of the attempt. */
  attempted: number;
  /** Stored images, in `SortOrder`. */
  uploaded: ResourceImageResponse[];
  /** Files the server rejected, in submission order. */
  rejected: UploadRejection[];
}

/**
 * Turns one response into an `UploadOutcome` (phases.md R6: one request, so one pass — the
 * per-chunk reconciliation this used to do is deleted along with the chunking).
 *
 * The server identifies a rejected file only by `fileName`, so each rejection is matched to the
 * first not-yet-matched submitted file with that name, in submission order. Two submitted files
 * with the same name can swap places in the list; they have the same name, so it isn't observable.
 */
export function buildUploadOutcome(
  submittedFileNames: readonly string[],
  response: ResourceImageUploadResponse,
): UploadOutcome {
  const unmatched: RejectedResourceImageResponse[] = [...response.rejected];
  const rejected: UploadRejection[] = [];

  for (const fileName of submittedFileNames) {
    const match = unmatched.findIndex((rejection) => rejection.fileName === fileName);
    if (match >= 0) {
      const [rejection] = unmatched.splice(match, 1);
      rejected.push({ fileName, reason: rejection.reason });
    }
  }

  // A rejection naming a file we didn't submit shouldn't happen, but it is shown rather than
  // dropped — silently losing a server-reported failure is the worse failure mode.
  rejected.push(...unmatched.map((rejection) => ({ ...rejection })));

  return {
    attempted: submittedFileNames.length,
    uploaded: [...response.uploaded].sort(compareImages),
    rejected,
  };
}

/**
 * Copy for one rejected file (design.md §7, Skyler's simplified table). `inlineName` says whether
 * the sentence already names the file. When it doesn't, the rejection list shows the filename as
 * a separate label next to the message.
 */
export function uploadRejectionCopy(rejection: UploadRejection): { message: string; inlineName: boolean } {
  switch (rejection.reason) {
    case 'UnsupportedType':
      return {
        message: `${rejection.fileName} isn't a supported image type — only JPG, PNG, and WebP are allowed.`,
        inlineName: true,
      };
    case 'TooLarge':
      return { message: 'File too large to upload. Images must be 2MB or less in size.', inlineName: false };
    case 'CapExceeded':
      return { message: `${rejection.fileName} wasn't added — over the 10-image limit.`, inlineName: true };
    default:
      // UnreadableOrOversizedDimensions, UploadFailed, and any reason added later.
      return { message: 'File failed to upload. Please try again.', inlineName: false };
  }
}

/** How many rejected filenames the partial-failure toast names before summarizing (design.md §7.6). */
const TOAST_NAME_LIMIT = 3;

/**
 * The total-failure toast (design.md §7.6): a 400 where every file was rejected, a transport error,
 * or a 5xx. Deliberately names no files — every file in the attempt failed, and they are all still
 * listed in the modal behind the toast.
 */
export const UPLOAD_TOTAL_FAILURE_TOAST = "Something went wrong and your images weren't added. Please try again.";

/**
 * The partial-failure toast (design.md §7.6), replacing the retired inline "X of Y" summary line
 * (§7.2). `null` on a clean submit and when nothing landed — the first needs no toast at all, the
 * second uses `UPLOAD_TOTAL_FAILURE_TOAST` instead.
 *
 * **It leads with what worked, then names what didn't.** The successes are persisted and already
 * visible in the carousel, so opening with the failure would misstate the outcome.
 *
 * **The name list truncates at three.** `NotificationService` renders one string for four seconds
 * (`core/notifications.ts`), so enumerating ten filenames is unreadable in the time it is on
 * screen. Three names plus a remainder count stays scannable and still answers "which ones?" for
 * the common small case.
 */
export function uploadPartialFailureToast(outcome: UploadOutcome): string | null {
  if (outcome.uploaded.length === 0 || outcome.rejected.length === 0) {
    return null;
  }

  const lead = `Added ${outcome.uploaded.length} of ${outcome.attempted} images.`;
  const names = outcome.rejected.map((rejection) => rejection.fileName);

  if (names.length === 1) {
    return `${lead} This one couldn't be added: ${names[0]}.`;
  }

  if (names.length <= TOAST_NAME_LIMIT) {
    return `${lead} These couldn't be added: ${names.join(', ')}.`;
  }

  const shown = names.slice(0, TOAST_NAME_LIMIT).join(', ');
  return `${lead} These couldn't be added: ${shown} and ${names.length - TOAST_NAME_LIMIT} more.`;
}
