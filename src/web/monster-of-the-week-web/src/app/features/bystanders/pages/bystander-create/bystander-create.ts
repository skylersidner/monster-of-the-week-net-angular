import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { BystanderService } from '../../../../core/bystander';
import { MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderFormComponent, BystanderFormSubmit } from '../../shared/bystander-form/bystander-form';

/**
 * Bystander has no interactive sub-resources (see plan doc Resolved Decision 2) — this
 * page is a single form with exactly one create call on submit, followed by a membership
 * `PUT` per selected mystery. No draft arrays, no batched sub-resource submit.
 *
 * The bespoke external `mysteryControl` this page used to carry is gone: the membership
 * picker is now the last field of `BystanderFormComponent`'s own `FormGroup` (UX §9.1), so
 * the page no longer needs `ReactiveFormsModule`, a `FormBuilder`, or its own select.
 */
@Component({
  selector: 'app-bystander-create',
  imports: [RouterLink, BystanderFormComponent],
  templateUrl: './bystander-create.html',
})
export class BystanderCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly router: Router,
    private readonly bystanderService: BystanderService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    forkJoin({
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      mysteries: this.mysteryService.getMysteries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ bystanderTypes, mysteries }) => {
          this.bystanderTypes.set(bystanderTypes);
          this.mysteries.set(mysteries);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load reference data.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Emitted by `BystanderFormComponent` only once its own validation has passed
   * (including its required `bystanderTypeId`), so no core-field validity check is
   * needed here.
   *
   * One code path for zero, one or many mysteries (decision 3): always `createStandalone`,
   * then a membership `PUT` per selection. The accepted trade-off is that creation is two
   * round-trips and non-atomic — a failed link leaves a real, unattached bystander, which
   * is a first-class state under decision 1 and is recoverable from its detail page.
   *
   * The partial-failure handling is the shipped convention from `monster-create.ts:286-292`
   * and `minion-create.ts:333-339`, and UX §9.5.1 requires it here: a membership failure is
   * a **success with a caveat**, not an error. Routing it to `error:` would leave the user on
   * a populated create form whose only control creates a *second* bystander.
   */
  onCreate(submit: BystanderFormSubmit): void {
    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.bystanderService
      .createStandalone(submit.bystander)
      .pipe(
        switchMap((bystander) =>
          // The bystander now exists. A failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          this.runBatch(
            submit.mysteryIds.map((mysteryId) => this.bystanderService.linkToMystery(mysteryId, bystander.id))
          ).pipe(
            map(() => ({ bystanderId: bystander.id, linksFailed: false })),
            catchError(() => of({ bystanderId: bystander.id, linksFailed: true }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ bystanderId, linksFailed }) => {
          this.isSaving.set(false);

          if (linksFailed) {
            // `forkJoin` reports that one call failed, never that all of them did, so the
            // copy hedges. `NotificationKind` has no warning severity, so the caveat spends
            // `.error()` exactly as `monster-create` does.
            this.notificationService.error(
              'Bystander created, but some of its mysteries may not have saved. Review them on the bystander page.'
            );
          } else {
            this.notificationService.success('Bystander created.');
          }

          // On the partial branch the scoped route would assert a membership we no longer
          // know holds, so it is always the flat one (UX §9.5.1, state C6).
          void this.router.navigate(
            linksFailed ? ['/bystanders', bystanderId] : this.detailLink(bystanderId, submit.mysteryIds)
          );
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Unable to create bystander.');
          this.notificationService.error('Unable to create bystander.');
        },
      });
  }

  /**
   * With exactly one mystery selected there is an unambiguous scoped route to land on, and
   * that is the destination this page has always used. Zero or many selections have no
   * single referent, so they fall back to the flat catalog route.
   */
  private detailLink(bystanderId: string, mysteryIds: string[]): unknown[] {
    return mysteryIds.length === 1
      ? ['/mysteries', mysteryIds[0], 'bystanders', bystanderId]
      : ['/bystanders', bystanderId];
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
