import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { ResourceImageResponse, ImageOwnerType } from '../core/models';
import { resourceImageFileUrl, resourceImageThumbnailUrl } from '../core/resource-images';
import { IconComponent } from './icons/icon.component';
import { ResourceThumbnailComponent } from './resource-thumbnail.component';
import { compareImages, derivePrimaryImageId } from './resource-image-rules';

/**
 * The peek carousel (design.md §5). Purely presentational. It never calls the API. The star and
 * the trash emit `setPrimary`/`deleteRequested`, and the host (`ResourceImagesStore` through the
 * detail page) makes the requests and owns the confirm-delete modal (design.md §4).
 *
 * **Active slide: controlled, with `[(activeImageId)]` banana-box binding.** The store applies
 * design.md §5.4's rules (on load the primary, after an upload the first new image, after a delete
 * the next image, and no change on set-primary), because those rules respond to API results.
 * Navigation inside the carousel (chevrons, arrow keys) changes the slide locally and emits
 * `activeImageIdChange`, so it also works with no binding at all. An `activeImageId` that isn't
 * in the list falls back to the primary, then to the first image.
 *
 * **Layout.** All slides sit in one flex track. Each slide is half the viewport wide, and the
 * track is translated so the active slide is centred, with half of each neighbour showing
 * (`translateX(25% - index × 50%)`; translate percentages are relative to the track, which is
 * viewport-wide). The viewport is `overflow-hidden` with `py-5` padding. The padding is
 * load-bearing: the primary glow spreads 16px (styles.css `image-primary-glow`), and without the
 * padding the clip cuts it off. Moving the track is the slide transition, so
 * `motion-reduce:transition-none` turns off only that animation. The steady-state peek treatment
 * (`scale-90 opacity-40`) is untouched (design.md §5.1).
 *
 * **Resolution per slide.** The active slide stacks the original (`/file`) on top of the
 * thumbnail. The thumbnail is usually cached already from when the slide was a peek, so it shows
 * through while the original loads; that way nothing flashes blank. Peek slides render only the
 * thumbnail. Slides further away render nothing, so they make no request.
 *
 * **The controls sit outside the slides.** The star, the trash, and the chevrons are overlaid on
 * the viewport and not rendered per slide. Arrow-key navigation re-renders the slides, and a
 * control inside a slide that just stopped being active would be destroyed, taking keyboard
 * focus with it. The controls persist, so focus stays put.
 */
@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [IconComponent, ResourceThumbnailComponent],
  templateUrl: './image-carousel.component.html',
  host: { class: 'block' },
})
export class ImageCarouselComponent {
  @Input({ required: true }) ownerType!: ImageOwnerType;
  @Input({ required: true }) ownerId!: string;
  /** For alt text: "{ownerName} image {n} of {count}" (design.md §8). */
  @Input() ownerName = '';

  // The next three are read by computed(), so they are signal-backed (the mystery-select.component.ts pattern).
  @Input()
  set images(value: readonly ResourceImageResponse[] | null | undefined) {
    this.imagesSignal.set(value ?? []);
  }
  get images(): readonly ResourceImageResponse[] {
    return this.imagesSignal();
  }

  @Input()
  set primaryImageId(value: string | null | undefined) {
    this.primarySignal.set(value ?? null);
  }
  get primaryImageId(): string | null {
    return this.primarySignal();
  }

  @Input()
  set activeImageId(value: string | null | undefined) {
    this.activeSignal.set(value ?? null);
  }
  get activeImageId(): string | null {
    return this.activeSignal();
  }

  /** An image mutation is in flight. Disables the star and the trash, but not navigation. */
  @Input() busy = false;

  @Output() activeImageIdChange = new EventEmitter<string>();
  @Output() setPrimary = new EventEmitter<string>();
  @Output() deleteRequested = new EventEmitter<ResourceImageResponse>();

  private readonly imagesSignal = signal<readonly ResourceImageResponse[]>([]);
  private readonly primarySignal = signal<string | null>(null);
  private readonly activeSignal = signal<string | null>(null);

  /** Originals that failed to load. Each one is hidden, so the thumbnail (or its placeholder) beneath shows. */
  private readonly failedFileUrls = signal<ReadonlySet<string>>(new Set());

  readonly ordered = computed(() => [...this.imagesSignal()].sort(compareImages));
  readonly count = computed(() => this.ordered().length);

  /** The effective primary: the explicit id if it's in the list, else the first by `SortOrder` (same rule as the server). */
  readonly primaryId = computed(() => derivePrimaryImageId(this.ordered(), this.primarySignal()));

  readonly activeIndex = computed(() => {
    const ordered = this.ordered();
    const byActive = ordered.findIndex((image) => image.id === this.activeSignal());
    if (byActive >= 0) {
      return byActive;
    }

    const byPrimary = ordered.findIndex((image) => image.id === this.primaryId());
    return byPrimary >= 0 ? byPrimary : 0;
  });

  readonly activeImage = computed<ResourceImageResponse | null>(() => this.ordered()[this.activeIndex()] ?? null);
  readonly activeIsPrimary = computed(() => {
    const active = this.activeImage();
    return active !== null && active.id === this.primaryId();
  });

  readonly hasPrevious = computed(() => this.activeIndex() > 0);
  readonly hasNext = computed(() => this.activeIndex() < this.count() - 1);

  readonly trackTransform = computed(() => `translateX(calc(25% - ${this.activeIndex()} * 50%))`);

  /** `'active' | 'peek' | 'far'`. Picks what a slide renders, and makes it queryable in tests. */
  slideRole(index: number): 'active' | 'peek' | 'far' {
    const distance = Math.abs(index - this.activeIndex());
    return distance === 0 ? 'active' : distance === 1 ? 'peek' : 'far';
  }

  altFor(index: number): string {
    const name = this.ownerName || 'Resource';
    return `${name} image ${index + 1} of ${this.count()}`;
  }

  fileUrl(image: ResourceImageResponse): string {
    return resourceImageFileUrl(this.ownerType, this.ownerId, image.id);
  }

  thumbnailUrl(image: ResourceImageResponse): string | null {
    return resourceImageThumbnailUrl(this.ownerType, this.ownerId, image.id);
  }

  fileFailed(image: ResourceImageResponse): boolean {
    return this.failedFileUrls().has(this.fileUrl(image));
  }

  onFileError(image: ResourceImageResponse): void {
    const url = this.fileUrl(image);
    this.failedFileUrls.update((failed) => new Set(failed).add(url));
  }

  previous(): void {
    this.move(-1);
  }

  next(): void {
    this.move(1);
  }

  /**
   * ArrowLeft/ArrowRight while focus is anywhere in the carousel region. No wraparound: at either
   * end the key does nothing and isn't consumed, matching the disabled chevron (design.md §5.4).
   */
  onKeydown(event: KeyboardEvent): void {
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (delta === 0 || !this.canMove(delta)) {
      return;
    }

    event.preventDefault();
    this.move(delta);
  }

  /** The star. Already primary means a no-op: it's informational, and there's nothing to set. */
  onStar(): void {
    const active = this.activeImage();
    if (!active || this.busy || this.activeIsPrimary()) {
      return;
    }

    this.setPrimary.emit(active.id);
  }

  onDelete(): void {
    const active = this.activeImage();
    if (!active || this.busy) {
      return;
    }

    this.deleteRequested.emit(active);
  }

  private canMove(delta: number): boolean {
    const target = this.activeIndex() + delta;
    return target >= 0 && target < this.count();
  }

  private move(delta: number): void {
    if (!this.canMove(delta)) {
      return;
    }

    const target = this.ordered()[this.activeIndex() + delta];
    this.activeSignal.set(target.id);
    this.activeImageIdChange.emit(target.id);
  }
}
