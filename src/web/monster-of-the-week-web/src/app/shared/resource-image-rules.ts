import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_FILES_PER_UPLOAD_REQUEST,
  MAX_IMAGE_BYTES,
} from '../core/resource-images';
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

// --- Upload: pre-flight, chunking, merge, copy ---

/**
 * Client-side rejection for a transport failure, such as a network error or a 5xx on one chunk.
 * Not a server enum value: the server never answered for those files. It renders as the generic
 * copy.
 */
export const UPLOAD_FAILED_REASON = 'UploadFailed';

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

/** Splits a pick into sequential `POST`s of at most `size` files, keeping pick order (design.md §3, §4.4). */
export function chunkFiles<T>(files: readonly T[], size: number = MAX_FILES_PER_UPLOAD_REQUEST): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < files.length; start += size) {
    chunks.push(files.slice(start, start + size));
  }
  return chunks;
}

/** One rejected file, in pick order, with the reason that will pick its copy. */
export interface UploadRejection {
  fileName: string;
  reason: string;
}

/**
 * The single combined result of one pick or drop, across every chunk plus the client's own
 * pre-flight rejections (design.md §4.4). This is what the dropzone emits and what the store merges.
 */
export interface UploadOutcome {
  /** Every file the user picked or dropped, the "Y" in "X of Y images were added". */
  attempted: number;
  /** Stored images, in `SortOrder`. */
  uploaded: ResourceImageResponse[];
  /** Rejected files, in pick order. */
  rejected: UploadRejection[];
}

/** A file's position in the original pick, plus its name. Pre-flight rejections leave gaps, so sent files are not contiguous. */
export interface IndexedFileName {
  index: number;
  name: string;
}

/** One chunk's request and its answer. A failed request has `response: null`, and every file in it gets `UploadFailed`. */
export interface ChunkResult {
  files: readonly IndexedFileName[];
  response: ResourceImageUploadResponse | null;
}

/**
 * Merges pre-flight rejections and every chunk's response into one `UploadOutcome`, with
 * rejections in pick order.
 *
 * The server identifies a rejected file only by `fileName`. Inside one chunk, each rejection is
 * matched to the first not-yet-matched file with that name, in order. Two files with the same name
 * in one chunk can therefore swap places in the list. They have the same name, so the user can't
 * tell the difference anyway.
 */
export function mergeUploadOutcome(
  attempted: number,
  preflight: readonly { index: number; rejection: UploadRejection }[],
  chunks: readonly ChunkResult[],
): UploadOutcome {
  const rejectedAt: { index: number; rejection: UploadRejection }[] = [...preflight];
  const uploaded: ResourceImageResponse[] = [];

  for (const chunk of chunks) {
    if (chunk.response === null) {
      chunk.files.forEach((file) =>
        rejectedAt.push({ index: file.index, rejection: { fileName: file.name, reason: UPLOAD_FAILED_REASON } }),
      );
      continue;
    }

    uploaded.push(...chunk.response.uploaded);
    const unmatched: RejectedResourceImageResponse[] = [...chunk.response.rejected];
    for (const file of chunk.files) {
      const match = unmatched.findIndex((rejection) => rejection.fileName === file.name);
      if (match >= 0) {
        const [rejection] = unmatched.splice(match, 1);
        rejectedAt.push({ index: file.index, rejection: { fileName: file.name, reason: rejection.reason } });
      }
    }

    // A rejection whose name matched no file sent in this chunk. That shouldn't happen, but it is
    // still shown, after the chunk's own files, rather than dropped.
    const lastIndex = chunk.files.length > 0 ? chunk.files[chunk.files.length - 1].index : attempted;
    unmatched.forEach((rejection, offset) =>
      rejectedAt.push({ index: lastIndex + (offset + 1) / (unmatched.length + 1), rejection: { ...rejection } }),
    );
  }

  return {
    attempted,
    uploaded: uploaded.sort(compareImages),
    rejected: rejectedAt.sort((a, b) => a.index - b.index).map((entry) => entry.rejection),
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

/**
 * The summary line above the rejection list (design.md §7.2). Shown only when some files were added
 * **and** some were rejected. If every file failed (§7.3) the list stands alone. If every file
 * succeeded, the new images in the carousel already say so.
 */
export function uploadSummaryCopy(outcome: UploadOutcome): string | null {
  if (outcome.uploaded.length === 0 || outcome.rejected.length === 0) {
    return null;
  }

  return `${outcome.uploaded.length} of ${outcome.attempted} images were added.`;
}
