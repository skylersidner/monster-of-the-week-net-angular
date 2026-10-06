import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LocationService } from '../../../../core/location';
import { LocationDetailResponse, MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
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
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly mysteryId = signal<string | null>(null);

  /**
   * The Images section's state (design.md §4.1). **This page lets the store own the delete-modal
   * state too** — `requestDelete`/`pendingDelete`/`confirmDelete`/`cancelDelete` — rather than the
   * `deleteFootnoteFor`/`deleteImage` pair that `monster-detail` and `minion-detail` use.
   *
   * The rule, same as `bystander-detail`: the page-owned pair is for a page that already owns a
   * `pendingDelete` serving other delete flows, where a second pending-delete concept would be
   * ambiguous. This page has none, so there is nothing to coordinate with, and letting the store
   * hold it keeps the page free of a signal, two handler methods and a shape to keep in sync — the
   * template just binds — while inheriting the store's already-tested behaviour.
   *
   * If this page ever grows a second delete flow (Custom Moves is read-only here today), it should
   * move to the page-owned pattern, for exactly the reason the other two use it.
   */
  readonly imagesStore = inject(ResourceImagesStore);
  readonly isUploadingImages = signal(false);

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
    private readonly notificationService: NotificationService
  ) {}

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

    this.isSaving.set(true);
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
          this.isSaving.set(false);

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
          this.isSaving.set(false);
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

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
