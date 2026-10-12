import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { BystanderService } from '../../../../core/bystander';
import {
  BystanderDetailResponse,
  MysteryListItemResponse,
  ResourceImageResponse,
  TypeRefResponse,
  UpsertCustomMoveRequest,
} from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import {
  CustomMoveCommit,
  CustomMoveRow,
  CustomMovesCardComponent,
} from '../../../../shared/custom-moves-card.component';
import { CustomMoveService } from '../../../../core/custom-moves';
import { ImageCarouselComponent } from '../../../../shared/image-carousel.component';
import { ImageUploadModalComponent } from '../../../../shared/image-upload-modal.component';
import { ResourceImagesCardComponent } from '../../../../shared/resource-images-card.component';
import { ResourceImagesStore } from '../../../../shared/resource-images.store';
import { BystanderFormComponent, BystanderFormSubmit } from '../../shared/bystander-form/bystander-form';

@Component({
  selector: 'app-bystander-detail-component',
  imports: [
    RouterLink,
    BystanderFormComponent,
    ConfirmDeleteModalComponent,
    CustomMovesCardComponent,
    ResourceImagesCardComponent,
    ImageCarouselComponent,
    ImageUploadModalComponent,
  ],
  // Component-scoped, as on the other detail pages: the section's state dies with the page.
  providers: [ResourceImagesStore],
  templateUrl: './bystander-detail.html',
})
export class BystanderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly bystander = signal<BystanderDetailResponse | null>(null);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  /** Options for the form's membership picker — this page is also the edit form. */
  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /**
   * **The in-flight mutation, as a message rather than a boolean** — the shape monster, minion and
   * location-detail all use (architecture.md §26.2 L4). Adopted here in Phase 5d for the reason the
   * banner below makes concrete: it printed a hard-coded *"Saving bystander..."* whenever a plain
   * `isSaving` flag was set, so a second kind of write on this page would have announced the wrong
   * thing. Carrying the text in the state makes it correct for every write.
   */
  readonly activeMutation = signal<string | null>(null);

  /** What the custom-moves card and the entity form bind. Matches the other four detail pages. */
  readonly isMutating = computed(() => this.activeMutation() !== null);

  /**
   * **Retained as an alias, not as state** — identical to `location-detail`'s, and for the same
   * reason: assertions in shipped specs outside this phase's scope read `isSaving()`, and editing
   * specs a phase was not scoped to touch is what the 5c hard stop exists to prevent.
   *
   * Collapsing both pages' aliases into `isMutating` is one follow-up, deliberately not split
   * across 5c and 5d: it is a rename with no behaviour change, and doing the two pages in one pass
   * is how it stays reviewable. See §29.6.
   */
  readonly isSaving = this.isMutating;

  readonly mysteryId = signal<string | null>(null);

  /**
   * The Images section's state (design.md §4.1).
   *
   * **This page owns its delete-modal state as of Phase 5d**, and with it the last of the four
   * image-bearing pages moves across — after this, no page uses the store's
   * `requestDelete`/`confirmDelete`/`cancelDelete` wrapper at all.
   *
   * The note that used to sit here said: *"If this page ever grows a second delete flow (Custom
   * Moves is read-only here today), it should move to the page-owned pattern."* Custom moves are
   * that second flow. The instruction is discharged, not overridden.
   *
   * **The general rule, which is what survives the migration** (Skyler, 2026-10-11): *a page that
   * gains a second kind of object to manage is better served moving state to the locus of control
   * than hooking into multiple stores — otherwise you end up hooked into several, when moving the
   * state would have been more straightforward.* Decision 14 and the old note above were each that
   * principle stated about one page and one modal; this is the form that still answers the question
   * when there is a third object.
   *
   * The store still computes the footnote (`deleteFootnoteFor`) and performs the delete
   * (`deleteImage`) — only the *pending* state moved, which is what made this a rebinding rather
   * than a rewrite. That split exists precisely so a host can choose who owns it.
   */
  readonly imagesStore = inject(ResourceImagesStore);
  readonly isUploadingImages = signal(false);

  /**
   * **One modal for every delete on this page**, carrying the variant as a closure so the confirm
   * handler never branches on which kind of delete is pending (decision 14). Literal copy of
   * `monster-detail.ts`'s, via `location-detail`.
   */
  readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);

  readonly backLink = computed(() =>
    this.mysteryId() ? ['/mysteries', this.mysteryId()] : ['/bystanders']
  );
  readonly backLabel = computed(() =>
    this.mysteryId() ? '← Back to mystery' : '← Back to bystanders'
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly bystanderService: BystanderService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService,
    private readonly customMoveService: CustomMoveService
  ) {}

  /** The card, so a successful commit can reset it and restore focus. */
  @ViewChild(CustomMovesCardComponent) private readonly customMovesCard?: CustomMovesCardComponent;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const bystanderId = params.get('bystanderId');
          if (!bystanderId) {
            throw new Error('Bystander id is required.');
          }

          const mysteryId = params.get('mysteryId');
          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            bystander: this.bystanderService.getById(bystanderId),
            bystanderTypes: this.referenceDataService.getBystanderTypes(),
            mysteries: this.mysteryService.getMysteries(),
          });
        })
      )
      .subscribe({
        next: ({ bystander, bystanderTypes, mysteries }) => {
          // Deliberately outside the forkJoin above: the images section loads independently and
          // renders its own inline error, so a failing image list must not fail the whole page.
          this.imagesStore.load('Bystander', bystander.id, bystander.name);
          this.bystander.set(bystander);
          this.bystanderTypes.set(bystanderTypes);
          this.mysteries.set(mysteries);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load bystander details.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * The entity body and its mystery membership are two separate writes: `PUT /api/bystanders/{id}`
   * for the fields, then one membership `PUT` per newly selected mystery and one membership
   * `DELETE` per deselected one, batched through the `runBatch` idiom. Membership deliberately
   * does not ride along in `UpsertBystanderRequest` — see `BystanderService.linkToMystery`.
   *
   * Unchanged membership issues no calls at all, so the common "just renamed it" save is still
   * two round-trips (the `PUT` and the refetch below) rather than three or more.
   *
   * Two properties from UX §9.5.2, both load-bearing:
   *
   * **It ends in a refetch, on both branches**, rather than merging `desired` into the entity
   * locally — the `runAndRefresh` idiom of `monster-detail.ts:315-346`. Two jobs. It makes the
   * re-rendered membership control itself the answer to "which mysteries failed?", with no name
   * lookup or list formatting. And it resets the diff baseline to server truth, which is what
   * stops a retry from re-issuing an already-applied unlink: `DELETE` on the membership URI is
   * **not** idempotent in status code — it 404s on repeat (architecture §4.1) — so without the
   * refetch, "save again" after a partial failure would fail permanently.
   *
   * **The membership caveat is a toast only; `errorMessage` stays `null`.** `bystander-detail.html`
   * puts its `@else if (errorMessage())` branch ahead of `@else if (bystander())`, so setting it
   * unmounts the form, the picker and the custom-moves list — leaving nothing to retry into.
   */
  save(submit: BystanderFormSubmit): void {
    const current = this.bystander();
    if (!current) {
      return;
    }

    const bystanderId = current.id;
    const desired = submit.mysteryIds;
    const existing = current.mysteryIds ?? [];
    const added = desired.filter((mysteryId) => !existing.includes(mysteryId));
    const removed = existing.filter((mysteryId) => !desired.includes(mysteryId));

    this.activeMutation.set('Saving bystander...');
    this.bystanderService
      .update(bystanderId, submit.bystander)
      .pipe(
        switchMap(() =>
          // The fields are saved. A membership failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          this.runBatch<void>([
            ...added.map((mysteryId) => this.bystanderService.linkToMystery(mysteryId, bystanderId)),
            ...removed.map((mysteryId) => this.bystanderService.unlinkFromMystery(mysteryId, bystanderId)),
          ]).pipe(
            map(() => false),
            catchError(() => of(true))
          )
        ),
        switchMap((membershipFailed) =>
          this.bystanderService
            .getById(bystanderId)
            .pipe(map((bystander) => ({ bystander, membershipFailed })))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ bystander, membershipFailed }) => {
          this.bystander.set(bystander);
          // The one write here that can rename the bystander, and the §6 last-image footnote quotes
          // that name ("{name} will have no images afterward").
          this.imagesStore.setOwnerName(bystander.name);
          this.errorMessage.set(null);
          this.activeMutation.set(null);

          if (membershipFailed) {
            // `forkJoin` reports that one call failed, never that all of them did, so the copy
            // hedges. The next step is the re-rendered control directly above the Save button.
            this.notificationService.error(
              'Bystander saved, but some of its mysteries may not have saved. Review them below and save again.'
            );
          } else {
            this.notificationService.success('Bystander saved.');
          }
        },
        error: () => {
          this.errorMessage.set('Unable to save bystander.');
          this.notificationService.error('Unable to save bystander.');
          this.activeMutation.set(null);
        },
      });
  }

  /**
   * Opens the upload modal. Every image write goes straight to `imagesStore` and updates the
   * section's own state, independent of `save()` — a user never saves to keep an image change, and
   * an image failure stays inside the section rather than touching `errorMessage`, which this
   * template's `@else if` would use to unmount the page.
   */
  openImageUpload(): void {
    this.isUploadingImages.set(true);
  }

  /**
   * The carousel's `deleteRequested`, routed through **this page's** single modal rather than the
   * store's own pending signals — the other half of R13's migration, and the last page to make it.
   */
  requestDeleteImage(image: ResourceImageResponse): void {
    this.pendingDelete.set({
      label: image.fileName,
      footnote: this.imagesStore.deleteFootnoteFor(image),
      perform: () => this.imagesStore.deleteImage(image),
    });
  }

  onDeleteConfirmed(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.perform();
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }

  // --- Custom moves (architecture.md §29.1, §29.6; Phase 5d) ---

  /** Mapped from the `customMoves` already on `BystanderDetailResponse` — no request on load. */
  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    (this.bystander()?.customMoves ?? []).map((move) => ({
      key: move.id,
      name: move.name,
      description: move.description,
    }))
  );

  /** Which row the card has open. Bound two-way; the page owns it, the card asks (L-D1). */
  readonly editingCustomMoveKey = signal<string | null>(null);

  /** Add or edit, decided by `commit.key` — `null` means add. */
  commitCustomMove(commit: CustomMoveCommit): void {
    const request: UpsertCustomMoveRequest = { name: commit.name, description: commit.description };
    const { key } = commit;

    this.runAndRefresh(
      (bystanderId) =>
        key === null
          ? this.customMoveService.create('Bystander', bystanderId, request)
          : this.customMoveService.update('Bystander', bystanderId, key, request),
      key === null ? 'Unable to add custom move.' : 'Unable to save custom move.',
      () => this.customMovesCard?.commitSucceeded(),
      key === null ? 'Custom move added.' : 'Custom move saved.'
    );
  }

  /** Through the page's single modal, which now serves both images and custom moves. */
  requestDeleteCustomMove(row: CustomMoveRow): void {
    this.pendingDelete.set({
      label: row.name,
      perform: () =>
        this.runAndRefresh(
          (bystanderId) => this.customMoveService.delete('Bystander', bystanderId, row.key),
          'Unable to delete custom move.'
        ),
    });
  }

  /**
   * **New on this page in 5d**, because its only write was the entity save. Identical to the other
   * four pages', including the property that matters most: **a failure is a toast and
   * `errorMessage` is never set**, because this template puts `@else if (errorMessage())` ahead of
   * its content branch (§26.2 L1 / Phase A).
   */
  private runAndRefresh(
    operation: (bystanderId: string) => Observable<unknown>,
    errorMessage: string,
    onSuccess?: () => void,
    successMessage?: string
  ): void {
    const current = this.bystander();
    if (!current) {
      return;
    }

    const bystanderId = current.id;
    this.activeMutation.set('Saving changes...');
    operation(bystanderId)
      .pipe(
        switchMap(() => this.bystanderService.getById(bystanderId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (bystander) => {
          this.bystander.set(bystander);
          onSuccess?.();
          this.activeMutation.set(null);
          this.notificationService.success(successMessage ?? 'Changes saved.');
        },
        error: () => {
          this.activeMutation.set(null);
          this.notificationService.error(errorMessage);
        },
      });
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
