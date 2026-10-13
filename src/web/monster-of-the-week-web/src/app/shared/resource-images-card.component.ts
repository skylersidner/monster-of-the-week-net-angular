import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { ImageOwnerType } from '../core/models';
import { MAX_IMAGES_PER_RESOURCE } from '../core/resource-images';
import { DomainIconComponent } from './domain-icon.component';

/**
 * The Images section's card shell (design.md §4.1, §5.5): the header with "+ Add Images", the
 * 10/10 note, and the zero-image empty state. **Presentational — it never touches a file.**
 *
 * This replaces `image-dropzone.component.ts`. The card is no longer a drop target (Skyler: "Drag
 * and drop is modal only"), so all of that component's drag plumbing, its hidden file input and its
 * upload pipeline are gone — drag-and-drop now lives only in `app-image-upload-modal`. Both reasons
 * the old dropzone wrapped the carousel in `<ng-content>` are gone with it: the empty state needed
 * the dropzone's file input (it now just raises `addImages`), and the card including the carousel
 * was the drop region (it no longer is).
 *
 * The carousel is still projected rather than being a plain child, which is the one place I kept
 * the old structure: it is a slot, not a drop target, so the host page controls what fills it while
 * the header/empty-state/10-of-10 logic stays here instead of being repeated on four detail pages.
 * Phase 6a can flatten this if a real page proves otherwise.
 */
@Component({
  selector: 'app-resource-images-card',
  standalone: true,
  imports: [DomainIconComponent],
  templateUrl: './resource-images-card.component.html',
  host: { class: 'block' },
})
export class ResourceImagesCardComponent {
  @Input({ required: true }) ownerType!: ImageOwnerType;

  /** Read by `computed()`, so signal-backed (the documented `mystery-select.component.ts` bug). */
  @Input()
  set currentCount(value: number) {
    this.countSignal.set(value ?? 0);
  }
  get currentCount(): number {
    return this.countSignal();
  }

  /** Set while another image mutation is in flight, to disable "+ Add Images" alongside it. */
  @Input()
  set disabled(value: boolean) {
    this.disabledSignal.set(!!value);
  }
  get disabled(): boolean {
    return this.disabledSignal();
  }

  /** Both "+ Add Images" buttons raise this; the host opens the upload modal. */
  @Output() addImages = new EventEmitter<void>();

  readonly maxImages = MAX_IMAGES_PER_RESOURCE;

  private readonly countSignal = signal(0);
  private readonly disabledSignal = signal(false);

  /** §7.5: at 10/10 the button is disabled with an inline note, so a modal that could only say "no" never opens. */
  readonly atCap = computed(() => this.countSignal() >= MAX_IMAGES_PER_RESOURCE);
  readonly canAdd = computed(() => !this.atCap() && !this.disabledSignal());
  readonly isEmpty = computed(() => this.countSignal() === 0);
}
