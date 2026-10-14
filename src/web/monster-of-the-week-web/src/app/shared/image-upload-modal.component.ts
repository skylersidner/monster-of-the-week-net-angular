import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ImageOwnerType } from '../core/models';
import {
  IMAGE_INPUT_ACCEPT,
  MAX_FILES_PER_UPLOAD_REQUEST,
  MAX_IMAGES_PER_RESOURCE,
  ResourceImageService,
} from '../core/resource-images';
import { NotificationService } from '../core/notifications';
import { FocusReturnTracker, FocusTrapDirective } from './focus-trap.directive';
import { IconComponent } from './icons/icon.component';
import {
  UPLOAD_TOTAL_FAILURE_TOAST,
  UploadOutcome,
  buildUploadOutcome,
  planUpload,
  uploadPartialFailureToast,
  uploadRejectionCopy,
} from './resource-image-rules';

/** One row of the staged list: the filename, and when invalid, the §7 copy for its reason. */
interface StagedRow {
  file: File;
  valid: boolean;
  /** `null` when the file is valid. */
  message: string | null;
}

/** Module-scoped so two instances on one page cannot collide on `aria-labelledby`. */
let nextInstanceId = 0;

/**
 * The upload interaction, end to end (design.md §4.4, §4.5). Stage, then submit.
 *
 * **It is the app's only drag-and-drop surface.** The Images card is not a drop target (§4.1,
 * Skyler: "Drag and drop is modal only"), so the drag plumbing that used to live on the card moved
 * in here — `carriesFiles`, the enter/leave depth counter, and the drag-over tint.
 *
 * **Staging is synchronous.** Validation runs on every add and remove through the same
 * `planUpload` the server's own order mirrors (type/size, then the cap against what is left). It
 * deliberately does not read magic bytes or decode dimensions (§7, Skyler: "Generic toast is
 * fine"), so there is no asynchronous "checking..." state and no object-URL lifecycle. The two
 * checks the browser can't make are the server's, and they surface as a toast.
 *
 * **Staged rows are filenames only** (Skyler: "Just a list of file names") — no thumbnail previews.
 *
 * **Only valid files are submitted**, so the request is clean by construction. One `POST`, never
 * several: the modal refuses to accept more than `min(remainingSlots, MAX_FILES_PER_UPLOAD_REQUEST)`
 * files, which is why the chunking this feature used to carry is gone (phases.md R6).
 *
 * **Close with files staged swaps the footer to a confirm step** rather than stacking a second
 * dialog or using `window.confirm` (§4.5). That keeps one overlay and one Escape owner, and follows
 * the spirit of this app's only other dirty-state guard (`hunter-create.ts`'s `isConfirmingDiscard`
 * signal), which likewise confirms in-app and reserves the browser prompt for refresh/tab-close.
 *
 * **In-flight, the whole body is replaced by a spinner panel** and both footer buttons go away, so
 * there is nothing to click and no click-shield needed. Closing mid-request is blocked because a
 * destroyed modal cancels a request the server may already have committed (§9.5).
 *
 * No `beforeunload` guard for staged files — deliberately out of scope (Skyler).
 */
@Component({
  selector: 'app-image-upload-modal',
  standalone: true,
  imports: [IconComponent, FocusTrapDirective],
  templateUrl: './image-upload-modal.component.html',
})
export class ImageUploadModalComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly imageService = inject(ResourceImageService);
  private readonly notificationService = inject(NotificationService);
  /** Injected, never called: it must be alive before this modal opens. See its own doc comment. */
  private readonly focusReturn = inject(FocusReturnTracker);

  @Input({ required: true }) ownerType!: ImageOwnerType;
  @Input({ required: true }) ownerId!: string;

  /**
   * Read by `computed()`, so signal-backed (the documented `mystery-select.component.ts` bug). A
   * plain field would freeze the remaining-slot arithmetic.
   */
  @Input()
  set currentCount(value: number) {
    this.countSignal.set(value ?? 0);
  }
  get currentCount(): number {
    return this.countSignal();
  }

  @Input()
  set visible(value: boolean) {
    const next = !!value;
    const was = this.visibleSignal();
    this.visibleSignal.set(next);
    // Opening always starts clean: no files from a previous session, no confirm step left showing.
    if (next && !was) {
      this.reset();
    }
  }
  get visible(): boolean {
    return this.visibleSignal();
  }

  /** One outcome per submit, the same shape `ResourceImagesStore.applyUpload` already takes. */
  @Output() uploaded = new EventEmitter<UploadOutcome>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('fileInput') private readonly fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chooseFiles') private readonly chooseFiles?: ElementRef<HTMLButtonElement>;
  @ViewChild('discardKeep') private readonly discardKeep?: ElementRef<HTMLButtonElement>;

  /**
   * Where `appFocusTrap` puts focus when this modal opens, and after each state swap.
   *
   * "Choose files" rather than the first focus stop: it is the action the modal exists for, and the
   * first stop would be whatever happens to be earliest in the markup. On the discard-confirmation
   * step it is "Keep files" instead — the non-destructive option, matching the confirm dialog's own
   * least-destructive rule. In flight there are no controls at all, and the trap parks focus on the
   * dialog itself.
   *
   * An arrow property so `this` survives being passed as a function.
   */
  readonly resolveInitialFocus = (): HTMLElement | null =>
    (this.isConfirmingDiscard() ? this.discardKeep?.nativeElement : this.chooseFiles?.nativeElement) ?? null;

  readonly accept = IMAGE_INPUT_ACCEPT;
  readonly titleId = `image-upload-title-${++nextInstanceId}`;

  private readonly countSignal = signal(0);
  private readonly visibleSignal = signal(false);
  private dragDepth = 0;

  readonly staged = signal<readonly File[]>([]);
  readonly isUploading = signal(false);
  readonly isDragOver = signal(false);
  readonly isConfirmingDiscard = signal(false);

  /**
   * How many more files this resource can take. `min` of the per-owner cap's remainder and the
   * per-request file limit: the two constants are separate rules (a data rule and a 24 MiB
   * request-size concern) that both happen to be 10 today, and this expression is what makes one
   * request always enough rather than leaving it to coincidence (phases.md R6).
   */
  readonly remainingSlots = computed(() =>
    Math.min(Math.max(0, MAX_IMAGES_PER_RESOURCE - this.countSignal()), MAX_FILES_PER_UPLOAD_REQUEST),
  );

  /** Recomputed on every add and remove, so the cap arithmetic has one home. */
  private readonly plan = computed(() => planUpload(this.staged(), this.remainingSlots()));

  readonly rows = computed<StagedRow[]>(() => {
    const { accepted, rejected } = this.plan();
    const messageByIndex = new Map(
      rejected.map((entry) => [entry.index, uploadRejectionCopy(entry.rejection).message] as const),
    );
    const acceptedIndexes = new Set(accepted.map((entry) => entry.index));

    return this.staged().map((file, index) => ({
      file,
      valid: acceptedIndexes.has(index),
      message: messageByIndex.get(index) ?? null,
    }));
  });

  readonly validFiles = computed(() => this.plan().accepted.map((entry) => entry.file));
  readonly hasStagedFiles = computed(() => this.staged().length > 0);
  readonly canSubmit = computed(() => this.validFiles().length > 0 && !this.isUploading());

  readonly discardPrompt = computed(() => {
    const count = this.staged().length;
    return count === 1
      ? "1 file hasn't been uploaded yet. Closing this window will discard it."
      : `${count} files haven't been uploaded yet. Closing this window will discard them.`;
  });

  openPicker(): void {
    if (!this.isUploading()) {
      this.fileInput?.nativeElement.click();
    }
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Cleared so re-picking the same file still fires `change`.
    input.value = '';
    this.stage(files);
  }

  /** Appends to the staged list; validity is recomputed over the whole set, never per add. */
  stage(files: readonly File[]): void {
    if (files.length === 0 || this.isUploading()) {
      return;
    }

    this.staged.update((current) => [...current, ...files]);
  }

  removeAt(index: number): void {
    if (this.isUploading()) {
      return;
    }

    this.staged.update((current) => current.filter((_, i) => i !== index));
    if (this.staged().length === 0) {
      // Nothing left to discard, so a confirm step that is open becomes meaningless.
      this.isConfirmingDiscard.set(false);
    }
  }

  // --- Drag and drop (modal-only) ---

  onDragEnter(event: DragEvent): void {
    if (!carriesFiles(event) || this.isUploading()) {
      return;
    }

    event.preventDefault();
    this.dragDepth += 1;
    this.isDragOver.set(true);
  }

  onDragOver(event: DragEvent): void {
    if (!carriesFiles(event) || this.isUploading()) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
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

    // Prevented even while uploading: the browser's default for a dropped file is to navigate away
    // and open it, which would abandon the page mid-request.
    event.preventDefault();
    this.dragDepth = 0;
    this.isDragOver.set(false);
    this.stage(Array.from(event.dataTransfer?.files ?? []));
  }

  // --- Submit ---

  submit(): void {
    const files = this.validFiles();
    if (files.length === 0 || this.isUploading()) {
      return;
    }

    const submittedNames = files.map((file) => file.name);
    this.isUploading.set(true);
    this.isConfirmingDiscard.set(false);

    this.imageService
      .upload(this.ownerType, this.ownerId, files)
      .pipe(
        finalize(() => this.isUploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const outcome = buildUploadOutcome(submittedNames, response);
          this.uploaded.emit(outcome);

          if (outcome.uploaded.length === 0) {
            // Nothing landed. Stay open with the files still staged, so a retry costs no re-picking
            // and the deliberately vague message has its subject on screen (§4.4, §7.6).
            this.notificationService.error(UPLOAD_TOTAL_FAILURE_TOAST);
            return;
          }

          const partial = uploadPartialFailureToast(outcome);
          if (partial) {
            this.notificationService.error(partial);
          }

          this.close();
        },
        error: () => this.notificationService.error(UPLOAD_TOTAL_FAILURE_TOAST),
      });
  }

  // --- Closing ---

  /** Cancel, the close button, and the backdrop. Routes through the confirm step when files are staged. */
  requestClose(): void {
    if (this.isUploading()) {
      return;
    }

    if (this.hasStagedFiles()) {
      this.isConfirmingDiscard.set(true);
      return;
    }

    this.close();
  }

  /** "Keep files" — back to staging, list untouched. */
  keepFiles(): void {
    this.isConfirmingDiscard.set(false);
  }

  /** "Discard files" — the confirmed close. */
  discardFiles(): void {
    this.close();
  }

  /**
   * Escape must not bypass the confirmation (§4.5). With files staged the first press raises the
   * confirm step; a second press, now that the step is showing, closes.
   *
   * On `document`, matching `ConfirmDeleteModalComponent`: a click on the dialog's own non-focusable
   * text drops focus to `<body>`, and a keydown there never reaches this element. `stopPropagation`
   * keeps one Escape from also closing an enclosing surface, which is what the two cross-cutting
   * Escape specs check for.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.visibleSignal() || event.key !== 'Escape') {
      return;
    }

    // Yield to a dialog stacked above this one, so Escape only ever closes the topmost surface.
    //
    // This cannot be done with `stopPropagation()`, which is how the `CustomSelect`-inside-a-dialog
    // pair solves the same problem: that works because the select's handler sits on its own host,
    // below `document`, so it runs first during bubbling. This handler and
    // `ConfirmDeleteModalComponent`'s are *both* on `document`, and `stopPropagation` does not stop
    // other listeners on the same node — only `stopImmediatePropagation` does, and that would still
    // leave the outcome dependent on which component registered first. Checking for the other
    // overlay is order-independent.
    //
    // **Kept deliberately after the focus trap landed, and not redundant — the justification for it
    // changed, so read this before deleting either.** The path that originally made stacking
    // reachable was keyboard: this modal had no Tab trap, so a user could tab out to the carousel's
    // delete button behind it and raise the confirm dialog on top. `appFocusTrap` closed that path
    // (proved by a Playwright control: 30 Tab presses cannot reach that button).
    //
    // But the trap closes one *route* to the state, while this closes the *state*: two overlays
    // open at once is still expressible in code — any future path that sets a confirm dialog
    // visible while this modal is open, from an async result or a page-level handler, reaches it
    // without any tabbing. Belt and braces, on two different mechanisms, is the right level here
    // for something whose failure mode is one keypress silently dismissing two surfaces.
    if (document.querySelector('[role="dialog"]:not([data-upload-modal])')) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    if (this.isUploading()) {
      return;
    }

    if (this.hasStagedFiles() && !this.isConfirmingDiscard()) {
      this.isConfirmingDiscard.set(true);
      return;
    }

    this.close();
  }

  private close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.staged.set([]);
    this.isConfirmingDiscard.set(false);
    this.isDragOver.set(false);
    this.dragDepth = 0;
  }
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
