import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LocationService } from '../../../../core/location';
import { LocationDetailResponse, MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationFormComponent, LocationFormSubmit } from '../../shared/location-form/location-form';

@Component({
  selector: 'app-location-detail-component',
  imports: [RouterLink, LocationFormComponent],
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

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
