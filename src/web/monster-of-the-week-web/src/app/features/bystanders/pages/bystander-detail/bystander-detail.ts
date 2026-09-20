import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { BystanderService } from '../../../../core/bystander';
import { BystanderDetailResponse, MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderFormComponent, BystanderFormSubmit } from '../../shared/bystander-form/bystander-form';

@Component({
  selector: 'app-bystander-detail-component',
  imports: [RouterLink, BystanderFormComponent],
  templateUrl: './bystander-detail.html',
})
export class BystanderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly bystander = signal<BystanderDetailResponse | null>(null);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  /** Options for the form's membership picker — this page is also the edit form. */
  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly mysteryId = signal<string | null>(null);

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
    private readonly notificationService: NotificationService
  ) {}

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

    this.isSaving.set(true);
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
          this.errorMessage.set(null);
          this.isSaving.set(false);

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
          this.isSaving.set(false);
        },
      });
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
