import { Component, Input, computed, signal } from '@angular/core';
import { ResourceOwnerType } from '../core/models';
import { DomainIconComponent, DomainIconSize } from './domain-icon.component';

/**
 * The domain-coloured placeholder fill (design.md §5.5). Written out as literal class strings, never
 * built as `'bg-badge-' + type + '/40'`, because Tailwind only generates classes that appear
 * verbatim in the source. The `/40` modifier works because the badge colours are
 * `@theme`-generated, not `@utility`. Same domain-colour-map shape as `search-results.ts`.
 */
const PLACEHOLDER_CLASSES: Readonly<Record<ResourceOwnerType, string>> = {
  Monster: 'bg-badge-monster/40 text-on-badge-monster',
  Minion: 'bg-badge-minion/40 text-on-badge-minion',
  Bystander: 'bg-badge-bystander/40 text-on-badge-bystander',
  Location: 'bg-badge-location/40 text-on-badge-location',
};

/**
 * One resource image, with the placeholder fallback built in (design.md §5.5,
 * thumbnail-and-primary-workflow.md §2.9).
 *
 * Shows the domain placeholder when `thumbnailUrl` is `null` (the owner has no images) or when the
 * `<img>` fails to load for any reason: 404, a 401 from an expired session (image requests bypass
 * the HTTP interceptors), 5xx, a network error, or an undecodable file. Failures are silent.
 *
 * **The failure is remembered per URL, not as a boolean.** `failedUrl` holds the URL that failed,
 * and the image shows again as soon as `thumbnailUrl` differs from it. A row whose primary changes
 * from a broken image to a working one tries the new URL without an explicit reset, and an
 * unchanged broken URL isn't retried on every change-detection pass.
 *
 * The host sizes it (`class="h-16 w-16 rounded-lg ..."` on a list row, or the full slide in the
 * carousel). The image and the placeholder both fill the host.
 */
@Component({
  selector: 'app-resource-thumbnail',
  standalone: true,
  imports: [DomainIconComponent],
  host: { class: 'block overflow-hidden' },
  template: `
    @if (showImage()) {
      <img
        class="block h-full w-full object-cover"
        [src]="url()"
        [alt]="alt"
        [attr.loading]="loading"
        decoding="async"
        draggable="false"
        (error)="onError($event)"
      />
    } @else {
      <div
        class="flex h-full w-full items-center justify-center"
        [class]="placeholderClass"
        data-placeholder
        [attr.role]="alt ? 'img' : null"
        [attr.aria-label]="alt || null"
        [attr.aria-hidden]="alt ? null : 'true'"
      >
        <app-domain-icon [domain]="ownerType" [size]="iconSize" />
      </div>
    }
  `,
})
export class ResourceThumbnailComponent {
  /** Picks the placeholder's colour and icon. */
  @Input({ required: true }) ownerType!: ResourceOwnerType;

  /** Read by `computed()`, so it is signal-backed (the `mystery-select` pattern). A plain field would freeze `showImage`. */
  @Input()
  set thumbnailUrl(value: string | null | undefined) {
    this.urlSignal.set(value ?? null);
  }
  get thumbnailUrl(): string | null {
    return this.urlSignal();
  }

  @Input() alt = '';

  /** `lazy` for list rows, so fetches track the rows on screen (workflow §1.5). */
  @Input() loading: 'lazy' | 'eager' = 'lazy';

  @Input() iconSize: DomainIconSize = 'md';

  private readonly urlSignal = signal<string | null>(null);
  private readonly failedUrl = signal<string | null>(null);

  readonly url = this.urlSignal.asReadonly();
  readonly showImage = computed(() => {
    const url = this.urlSignal();
    return url !== null && url !== this.failedUrl();
  });

  get placeholderClass(): string {
    return PLACEHOLDER_CLASSES[this.ownerType] ?? '';
  }

  /**
   * Records the URL that actually failed, read from the element's own `src` attribute rather than
   * the current input. An error event that arrives late, after the input has moved on, then can't
   * mark the new URL as failed.
   */
  onError(event: Event): void {
    const target = event.target;
    const failed = target instanceof HTMLImageElement ? target.getAttribute('src') : null;
    this.failedUrl.set(failed ?? this.urlSignal());
  }
}
