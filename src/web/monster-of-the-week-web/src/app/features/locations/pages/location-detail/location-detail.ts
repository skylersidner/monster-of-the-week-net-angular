import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LocationService } from '../../../../core/location';
import {
  LocationDetailResponse,
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
import { LocationFormComponent, LocationFormSubmit } from '../../shared/location-form/location-form';

@Component({
  selector: 'app-location-detail-component',
  imports: [
    RouterLink,
    LocationFormComponent,
    ConfirmDeleteModalComponent,
    CustomMovesCardComponent,
    ResourceImagesCardComponent,
    ImageCarouselComponent,
    ImageUploadModalComponent,
  ],
  // Component-scoped, as on the other three detail pages: the section's state dies with the page.
  providers: [ResourceImagesStore],
  templateUrl: './location-detail.html',
})
export class LocationDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly location = signal<LocationDetailResponse | null>(null);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  /** Options for the form's membership picker — this page is also the edit form. */
  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /**
   * **The in-flight mutation, as a message rather than a boolean** — the `monster-detail` /
   * `minion-detail` shape, adopted here in Phase 5c (architecture.md §26.2 L4).
   *
   * It replaced a plain `isSaving` boolean, and the reason is the banner below it: the template
   * printed a hard-coded *"Saving location..."* whenever that flag was set, so the moment a second
   * kind of write existed on this page it would have announced the wrong thing. Carrying the text
   * in the state makes the banner correct for every write instead of for one.
   */
  readonly activeMutation = signal<string | null>(null);

  /** What the custom-moves card and the entity form bind. Matches `monster-detail`'s name. */
  readonly isMutating = computed(() => this.activeMutation() !== null);

  /**
   * **Retained as an alias, not as state.** **Five** assertions in two shipped specs outside this
   * phase's scope read `isSaving()` — four in `location-detail.spec.ts` and one in
   * `location-detail.images.spec.ts` — and silently editing specs this phase was not scoped to
   * touch is exactly what the 5c hard stop exists to prevent. Same value, same meaning, so every
   * one of them keeps passing.
   *
   * Collapsing it into `isMutating` touches **six places in those two files**: those five
   * assertions plus one test *name* (`it('image writes stay clear of the page's own isSaving')`).
   * Counted by removing the alias and reading the compiler's list, rather than by grepping — the
   * grep over-counted the assertions by including that name. No behaviour change either way; worth
   * doing deliberately rather than smuggled in here, so it is a follow-up.
   */
  readonly isSaving = this.isMutating;

  readonly mysteryId = signal<string | null>(null);

  /**
   * The Images section's state (design.md §4.1).
   *
   * **This page now owns its delete-modal state, as of Phase 5c.** It used to let the store own it
   * (`requestDelete`/`pendingDelete`/`confirmDelete`/`cancelDelete`) because images were the only
   * delete flow here, and the note that used to sit on this field said in as many words: *"If this
   * page ever grows a second delete flow (Custom Moves is read-only here today), it should move to
   * the page-owned pattern."* Custom moves are that second flow, so this is that migration — the
   * instruction is discharged, not overridden.
   *
   * The deciding rule is unchanged and is worth keeping stated, because it is what a sixth domain
   * would be judged against: **the store-owned wrapper is right when a page has no `pendingDelete`
   * of its own to be ambiguous with; the page-owned record is right once it does.** Two delete
   * concepts on one page is the ambiguity, not two API shapes.
   *
   * The store still computes the image footnote (`deleteFootnoteFor`) and performs the delete
   * (`deleteImage`); only the *pending* state moved. That split exists precisely so a host can
   * choose who owns it (resource-images §6a).
   */
  readonly imagesStore = inject(ResourceImagesStore);
  readonly isUploadingImages = signal(false);

  /**
   * **One modal for every delete on this page**, carrying the variant as a closure so the confirm
   * handler never branches on which kind of delete is pending (decision 14). Literal copy of
   * `monster-detail.ts`'s, including the `footnote?` that only the image flow populates.
   */
  readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);

  readonly backLink = computed(() =>
    this.mysteryId() ? ['/mysteries', this.mysteryId()] : ['/locations']
  );
  readonly backLabel = computed(() =>
    this.mysteryId() ? '← Back to mystery' : '← Back to locations'
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly locationService: LocationService,
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
          const locationId = params.get('locationId');
          if (!locationId) {
            throw new Error('Location id is required.');
          }

          const mysteryId = params.get('mysteryId');
          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            location: this.locationService.getById(locationId),
            locationTypes: this.referenceDataService.getLocationTypes(),
            mysteries: this.mysteryService.getMysteries(),
          });
        })
      )
      .subscribe({
        next: ({ location, locationTypes, mysteries }) => {
          // Deliberately outside the forkJoin above: the images section loads independently and
          // renders its own inline error, so a failing image list must not fail the whole page.
          this.imagesStore.load('Location', location.id, location.name);
          this.location.set(location);
          this.locationTypes.set(locationTypes);
          this.mysteries.set(mysteries);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load location details.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * The entity body and its mystery membership are two separate writes: `PUT /api/locations/{id}`
   * for the fields, then one membership `PUT` per newly selected mystery and one membership
   * `DELETE` per deselected one, batched through the `runBatch` idiom. Membership deliberately
   * does not ride along in `UpsertLocationRequest` — see `LocationService.linkToMystery`.
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
   * **The membership caveat is a toast only; `errorMessage` stays `null`.** `location-detail.html`
   * puts its `@else if (errorMessage())` branch ahead of `@else if (location())`, so setting it
   * unmounts the form, the picker and the custom-moves list — leaving nothing to retry into.
   */
  save(submit: LocationFormSubmit): void {
    const current = this.location();
    if (!current) {
      return;
    }

    const locationId = current.id;
    const desired = submit.mysteryIds;
    const existing = current.mysteryIds ?? [];
    const added = desired.filter((mysteryId) => !existing.includes(mysteryId));
    const removed = existing.filter((mysteryId) => !desired.includes(mysteryId));

    this.activeMutation.set('Saving location...');
    this.locationService
      .update(locationId, submit.location)
      .pipe(
        switchMap(() =>
          // The fields are saved. A membership failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          this.runBatch<void>([
            ...added.map((mysteryId) => this.locationService.linkToMystery(mysteryId, locationId)),
            ...removed.map((mysteryId) => this.locationService.unlinkFromMystery(mysteryId, locationId)),
          ]).pipe(
            map(() => false),
            catchError(() => of(true))
          )
        ),
        switchMap((membershipFailed) =>
          this.locationService
            .getById(locationId)
            .pipe(map((location) => ({ location, membershipFailed })))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ location, membershipFailed }) => {
          this.location.set(location);
          // The one write here that can rename the location, and the §6 last-image footnote quotes
          // that name ("{name} will have no images afterward").
          this.imagesStore.setOwnerName(location.name);
          this.errorMessage.set(null);
          this.activeMutation.set(null);

          if (membershipFailed) {
            // `forkJoin` reports that one call failed, never that all of them did, so the copy
            // hedges. The next step is the re-rendered control directly above the Save button.
            this.notificationService.error(
              'Location saved, but some of its mysteries may not have saved. Review them below and save again.'
            );
          } else {
            this.notificationService.success('Location saved.');
          }
        },
        error: () => {
          this.errorMessage.set('Unable to save location.');
          this.notificationService.error('Unable to save location.');
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
   * store's own pending signals — new in Phase 5c, and the other half of R13's migration. The store
   * still computes the footnote and performs the delete; only the pending state is the page's.
   * Literal copy of `monster-detail.ts`'s `requestDeleteImage`.
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

  // --- Custom moves (architecture.md §29.1, §29.3; Phase 5c) ---
  //
  // The three detail-host members, copied from the pilot with the owner type and noun changed.
  // What is *not* copied is everything above: this page needed the `activeMutation` and
  // `pendingDelete` migrations first, which is why 5c is the expensive pair's first half.

  /** Mapped from the `customMoves` already on `LocationDetailResponse` — no request on load. */
  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    (this.location()?.customMoves ?? []).map((move) => ({
      key: move.id,
      name: move.name,
      description: move.description,
    }))
  );

  /** Which row the card has open. Bound two-way; the page owns it, the card asks (L-D1). */
  readonly editingCustomMoveKey = signal<string | null>(null);

  /** Add or edit, decided by `commit.key` — `null` means add. See `monster-detail`'s twin. */
  commitCustomMove(commit: CustomMoveCommit): void {
    const request: UpsertCustomMoveRequest = { name: commit.name, description: commit.description };
    const { key } = commit;

    this.runAndRefresh(
      (locationId) =>
        key === null
          ? this.customMoveService.create('Location', locationId, request)
          : this.customMoveService.update('Location', locationId, key, request),
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
          (locationId) => this.customMoveService.delete('Location', locationId, row.key),
          'Unable to delete custom move.'
        ),
    });
  }

  /**
   * **New on this page in 5c**, because it had no per-row write pipeline — its only write was the
   * entity save. Identical to `monster-detail.ts`'s post-Phase-A version, including the property
   * that matters most: **a failure is a toast and `errorMessage` is never set.** This template puts
   * `@else if (errorMessage())` ahead of its content branch, and `save()` above already documents
   * why that makes it unusable as a write surface.
   */
  private runAndRefresh(
    operation: (locationId: string) => Observable<unknown>,
    errorMessage: string,
    onSuccess?: () => void,
    successMessage?: string
  ): void {
    const current = this.location();
    if (!current) {
      return;
    }

    const locationId = current.id;
    this.activeMutation.set('Saving changes...');
    operation(locationId)
      .pipe(
        switchMap(() => this.locationService.getById(locationId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (location) => {
          this.location.set(location);
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
