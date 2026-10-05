import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, finalize, from, map, of, toArray } from 'rxjs';
import { ResourceOwnerType } from '../core/models';
import { IMAGE_INPUT_ACCEPT, MAX_IMAGES_PER_RESOURCE, ResourceImageService } from '../core/resource-images';
import { DomainIconComponent } from './domain-icon.component';
import { IconComponent } from './icons/icon.component';
import {
  ChunkResult,
  IndexedFileName,
  UploadOutcome,
  UploadRejection,
  chunkFiles,
  mergeUploadOutcome,
  preflightRejectionReason,
  uploadRejectionCopy,
  uploadSummaryCopy,
} from './resource-image-rules';

/** One line of the rejection list. `label` is set when the copy itself doesn't name the file (design.md §7). */
interface RejectionLine {
  label: string | null;
  message: string;
}

/**
 * The detail page's Images card, and the upload unit (design.md §4, §4.1, §4.4, §7). This is the
 * card shell: header, "+ Add Images", the hidden file input, the whole-card drop target, the
 * spinner, the 10/10 block, the zero-image empty state, and the inline result. The carousel is
 * projected into it through `<ng-content>`.
 *
 * **Why the carousel is projected and not a sibling.** The zero-image empty state "is the
 * uploader" (design.md §5.5), and its "+ Add Images" opens this component's file input. The whole
 * card, carousel included, is the drop target (§4.1). Both need the carousel inside this
 * component's boundary. That's the submission boundary: everything that submits together, one
 * component. When `currentCount` is 0 the empty state renders instead of the projected content.
 *
 * **Upload.** Pre-flight check (type, plus size, which is required to stay under the 24 MiB
 * request limit), then sequential `POST`s of at most 10 files (`concatMap`, never parallel), with
 * one spinner across the whole run. The result of every chunk plus the pre-flight rejections is
 * merged into **one** `UploadOutcome`, rendered once and emitted once (§4.4). A chunk whose
 * request fails outright (network, 5xx) marks each of its files with the generic copy, and the run
 * carries on with the next chunk. An all-rejected chunk's 400 isn't a failure:
 * `ResourceImageService.upload` turns it back into a per-file result, and its toast is suppressed.
 */
@Component({
  selector: 'app-image-dropzone',
  standalone: true,
  imports: [DomainIconComponent, IconComponent],
  templateUrl: './image-dropzone.component.html',
  host: { class: 'block' },
})
export class ImageDropzoneComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly imageService = inject(ResourceImageService);

  @Input({ required: true }) ownerType!: ResourceOwnerType;
  @Input({ required: true }) ownerId!: string;

  /** The owner's image count now. Drives the §7.5 10/10 block and the empty state. */
  @Input()
  set currentCount(value: number) {
    this.countSignal.set(value ?? 0);
  }
  get currentCount(): number {
    return this.countSignal();
  }

  /** Host-level disablement, e.g. while a delete or set-primary is in flight. */
  @Input()
  set disabled(value: boolean) {
    this.disabledSignal.set(!!value);
  }
  get disabled(): boolean {
    return this.disabledSignal();
  }

  /** One merged outcome per pick or drop, across every chunk (design.md §4.4). */
  @Output() uploaded = new EventEmitter<UploadOutcome>();

  @ViewChild('fileInput') private readonly fileInput?: ElementRef<HTMLInputElement>;

  readonly accept = IMAGE_INPUT_ACCEPT;
  readonly maxImages = MAX_IMAGES_PER_RESOURCE;

  private readonly countSignal = signal(0);
  private readonly disabledSignal = signal(false);
  private dragDepth = 0;

  readonly isUploading = signal(false);
  readonly isDragOver = signal(false);
  readonly outcome = signal<UploadOutcome | null>(null);

  readonly atCap = computed(() => this.countSignal() >= MAX_IMAGES_PER_RESOURCE);
  readonly canAdd = computed(() => !this.disabledSignal() && !this.isUploading() && !this.atCap());
  readonly isEmpty = computed(() => this.countSignal() === 0);

  readonly summary = computed(() => {
    const outcome = this.outcome();
    return outcome ? uploadSummaryCopy(outcome) : null;
  });

  readonly rejectionLines = computed<RejectionLine[]>(() =>
    (this.outcome()?.rejected ?? []).map((rejection) => {
      const copy = uploadRejectionCopy(rejection);
      return { label: copy.inlineName ? null : rejection.fileName, message: copy.message };
    }),
  );

  openPicker(): void {
    if (!this.canAdd()) {
      return;
    }

    this.fileInput?.nativeElement.click();
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Clear the input so picking the same file again still fires `change`.
    input.value = '';
    this.upload(files);
  }

  // --- Drag and drop ---
  //
  // Reacts only to drags that carry files. A drag that starts on an image inside the card (the
  // carousel's <img>s are draggable="false" too, as a second guard) or on selected text is
  // ignored. The enter/leave counter keeps the highlight steady as the pointer crosses child
  // elements. A file drag is always preventDefault-ed on dragover and drop, even when adding is
  // blocked. Otherwise the browser's default for a dropped file is to navigate away and open it.

  onDragEnter(event: DragEvent): void {
    if (!carriesFiles(event)) {
      return;
    }

    event.preventDefault();
    this.dragDepth += 1;
    this.isDragOver.set(this.canAdd());
  }

  onDragOver(event: DragEvent): void {
    if (!carriesFiles(event)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.canAdd() ? 'copy' : 'none';
    }
  }

  onDragLeave(event: DragEvent): void {
    if (!carriesFiles(event)) {
      return;
    }

    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.isDragOver.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    if (!carriesFiles(event)) {
      return;
    }

    event.preventDefault();
    this.dragDepth = 0;
    this.isDragOver.set(false);
    if (!this.canAdd()) {
      return;
    }

    this.upload(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Public so a test can drive it without synthesizing a `FileList`. */
  upload(files: readonly File[]): void {
    if (files.length === 0 || !this.canAdd()) {
      return;
    }

    this.outcome.set(null);

    const preflight: { index: number; rejection: UploadRejection }[] = [];
    const accepted: { index: number; file: File }[] = [];
    files.forEach((file, index) => {
      const reason = preflightRejectionReason(file);
      if (reason) {
        preflight.push({ index, rejection: { fileName: file.name, reason } });
      } else {
        accepted.push({ index, file });
      }
    });

    if (accepted.length === 0) {
      this.finish(mergeUploadOutcome(files.length, preflight, []));
      return;
    }

    const ownerType = this.ownerType;
    const ownerId = this.ownerId;
    this.isUploading.set(true);

    from(chunkFiles(accepted))
      .pipe(
        concatMap((chunk) => {
          const names: IndexedFileName[] = chunk.map(({ index, file }) => ({ index, name: file.name }));
          return this.imageService
            .upload(
              ownerType,
              ownerId,
              chunk.map(({ file }) => file),
            )
            .pipe(
              map((response): ChunkResult => ({ files: names, response })),
              catchError(() => of<ChunkResult>({ files: names, response: null })),
            );
        }),
        toArray(),
        finalize(() => this.isUploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((chunks) => this.finish(mergeUploadOutcome(files.length, preflight, chunks)));
  }

  private finish(outcome: UploadOutcome): void {
    this.outcome.set(outcome);
    this.uploaded.emit(outcome);
  }
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
