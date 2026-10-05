import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import { ResourceImageResponse, ResourceOwnerType } from '../core/models';
import { ResourceImageService } from '../core/resource-images';
import {
  UploadOutcome,
  activeImageIdAfterDelete,
  compareImages,
  derivePrimaryImageId,
  resourceImageDeleteFootnote,
} from './resource-image-rules';

/** What the host page's `<app-confirm-delete-modal>` binds to (design.md §6). */
export interface PendingImageDelete {
  image: ResourceImageResponse;
  /** `''` when the image isn't the primary. The modal renders nothing for an empty footnote. */
  footnote: string;
}

/**
 * State and API calls for one detail page's Images section. Provide it **per page**
 * (`providers: [ResourceImagesStore]`), not in root, so each page gets its own instance and it's
 * torn down with the page. Precedent: `MysteryCreateStore`.
 *
 * It exists so the four detail pages don't each carry this glue (load, upload merge, set-primary,
 * delete, the footnote, the section's inline error). Two of the four (Location, Bystander) have no
 * delete or mutation infrastructure at all today. A page does `store.load(...)`, binds the dropzone
 * and the carousel to these signals, and renders one `<app-confirm-delete-modal>` bound to
 * `pendingDelete()`. Per design.md §4, the page owns the modal and the store owns its state.
 *
 * **Failures are inline, never through the page's `errorMessage`.** Every detail page has an
 * `@else if (errorMessage())` branch that unmounts the whole entity view, so this store's
 * `errorMessage` is local to the section.
 *
 * **`primaryImageId` is always the effective primary, explicit or derived.** It's seeded from the
 * server's `isPrimary`, and after a delete or upload it's re-derived by the server's own rule
 * (`derivePrimaryImageId`), so the list thumbnail and the carousel can't disagree.
 *
 * **`activeImageId` applies design.md §5.4's rules:** on load the primary; after an upload the
 * first new image (lowest `SortOrder` in that upload); after a delete the next image in
 * `SortOrder` (or the new last one); after set-primary, unchanged.
 */
@Injectable()
export class ResourceImagesStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly imageService = inject(ResourceImageService);
  private loadSubscription: Subscription | null = null;

  readonly ownerType = signal<ResourceOwnerType | null>(null);
  readonly ownerId = signal<string | null>(null);
  /** Used in the last-image footnote ("{name} will have no images afterward"). Keep it current after a rename with `setOwnerName`. */
  readonly ownerName = signal('');

  readonly images = signal<ResourceImageResponse[]>([]);
  readonly primaryImageId = signal<string | null>(null);
  readonly activeImageId = signal<string | null>(null);

  readonly isLoading = signal(false);
  /** In-flight mutation label, e.g. "Deleting image...". Same shape as the detail pages' `activeMutation`. */
  readonly activeMutation = signal<string | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<PendingImageDelete | null>(null);

  readonly count = computed(() => this.images().length);

  load(ownerType: ResourceOwnerType, ownerId: string, ownerName: string): void {
    this.loadSubscription?.unsubscribe();
    this.ownerType.set(ownerType);
    this.ownerId.set(ownerId);
    this.ownerName.set(ownerName);
    this.images.set([]);
    this.primaryImageId.set(null);
    this.activeImageId.set(null);
    this.pendingDelete.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(true);

    this.loadSubscription = this.imageService
      .list(ownerType, ownerId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (images) => {
          const ordered = [...images].sort(compareImages);
          const primary = ordered.find((image) => image.isPrimary)?.id ?? derivePrimaryImageId(ordered, null);
          this.images.set(ordered);
          this.primaryImageId.set(primary);
          this.activeImageId.set(primary);
        },
        error: () => this.errorMessage.set('Unable to load images.'),
      });
  }

  setOwnerName(name: string): void {
    this.ownerName.set(name);
  }

  /** The carousel's `activeImageIdChange` (chevrons, arrow keys). */
  setActive(imageId: string): void {
    this.activeImageId.set(imageId);
  }

  /** The dropzone's `uploaded`. One call per pick or drop, after every chunk has resolved. */
  applyUpload(outcome: UploadOutcome): void {
    if (outcome.uploaded.length === 0) {
      return;
    }

    const known = new Set(this.images().map((image) => image.id));
    const added = [...outcome.uploaded].filter((image) => !known.has(image.id)).sort(compareImages);
    const merged = [...this.images(), ...added].sort(compareImages);

    // An upload never changes an existing primary (workflow §2.6). It only creates one when the
    // owner had none.
    const current = this.primaryImageId();
    const primary =
      current && merged.some((image) => image.id === current)
        ? current
        : (outcome.uploaded.find((image) => image.isPrimary)?.id ?? derivePrimaryImageId(merged, null));

    this.images.set(merged);
    this.primaryImageId.set(primary);
    this.errorMessage.set(null);
    if (added.length > 0) {
      this.activeImageId.set(added[0].id);
    }
  }

  /** The carousel's star. The active slide doesn't change (design.md §5.4). */
  setPrimary(imageId: string): void {
    const ownerType = this.ownerType();
    const ownerId = this.ownerId();
    if (!ownerType || !ownerId || this.isMutating() || imageId === this.primaryImageId()) {
      return;
    }

    this.errorMessage.set(null);
    this.activeMutation.set('Setting primary image...');
    this.imageService
      .setPrimary(ownerType, ownerId, imageId)
      .pipe(
        finalize(() => this.activeMutation.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.primaryImageId.set(imageId),
        error: () => this.errorMessage.set('Unable to set the primary image.'),
      });
  }

  /** The carousel's `deleteRequested`. Opens the modal, with the footnote worked out now from current state. */
  requestDelete(image: ResourceImageResponse): void {
    this.pendingDelete.set({
      image,
      footnote: resourceImageDeleteFootnote(this.images(), this.primaryImageId(), image.id, this.ownerName()),
    });
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const pending = this.pendingDelete();
    const ownerType = this.ownerType();
    const ownerId = this.ownerId();
    this.pendingDelete.set(null);
    if (!pending || !ownerType || !ownerId) {
      return;
    }

    const imageId = pending.image.id;
    this.errorMessage.set(null);
    this.activeMutation.set('Deleting image...');
    this.imageService
      .delete(ownerType, ownerId, imageId)
      .pipe(
        finalize(() => this.activeMutation.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.removeImage(imageId),
        error: (error: unknown) => {
          // A 404 means the image is already gone (another tab, or a stale list), so the end
          // state is what the user asked for.
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.removeImage(imageId);
            return;
          }

          this.errorMessage.set('Unable to delete image.');
        },
      });
  }

  private removeImage(imageId: string): void {
    const before = this.images();
    const remaining = before.filter((image) => image.id !== imageId);
    const wasPrimary = derivePrimaryImageId(before, this.primaryImageId()) === imageId;
    const wasActive = this.activeImageId() === imageId;

    this.images.set(remaining);
    if (wasPrimary) {
      // Server side, SetNull has cleared an explicit primary. Derive the replacement with no
      // explicit id: the first-uploaded remaining image, the same one the footnote named.
      this.primaryImageId.set(derivePrimaryImageId(remaining, null));
    }

    if (wasActive) {
      this.activeImageId.set(activeImageIdAfterDelete(before, imageId));
    }
  }
}
