import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LocationService } from '../../../../core/location';
import { MysteryListItemResponse, TypeRefResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationFormComponent, LocationFormSubmit } from '../../shared/location-form/location-form';
import {
  CustomMoveCommit,
  CustomMoveRow,
  CustomMovesCardComponent,
} from '../../../../shared/custom-moves-card.component';
import { CustomMoveService, createCustomMoveDraftKey } from '../../../../core/custom-moves';

/** A staged custom move. Same shape as `monster-create`'s — see that file for the id/key reasoning. */
export interface CustomMoveDraft {
  key: string;
  name: string;
  description: string | null;
}

/**
 * **This page gained its first sub-resource in Phase 5c of domain-custom-moves**, and the comment
 * that used to sit here said the opposite in as many words — *"Location has no interactive
 * sub-resources… No draft arrays, no batched sub-resource submit."* True until custom moves, false
 * now, and §2.10 item 2 predicted exactly this: the create-time cost is *"one more `runBatch` arm"*
 * on Monster and Minion and **first-of-kind** here.
 *
 * What that actually came to, which is less than §13.1 item 3 budgeted: the draft list, the second
 * `forkJoin` arm, and the combined failure flag are new — but **the draft *surface* was free**,
 * because `app-custom-moves-card` owns its own form. So this page still needs no
 * `ReactiveFormsModule` and no `FormBuilder` of its own, which is the one thing the old comment
 * said that is still true and worth keeping:
 *
 * The bespoke external `mysteryControl` this page used to carry is gone: the membership picker is
 * the last field of `LocationFormComponent`'s own `FormGroup` (UX §9.1), so the page does not need
 * reactive-forms plumbing to render an authoring surface.
 */
@Component({
  selector: 'app-location-create',
  imports: [RouterLink, LocationFormComponent, CustomMovesCardComponent],
  templateUrl: './location-create.html',
})
export class LocationCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly router: Router,
    private readonly locationService: LocationService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService,
    private readonly customMoveService: CustomMoveService
  ) {}

  /** The card, so a commit can return it to its add state. See `monster-create`'s twin. */
  @ViewChild(CustomMovesCardComponent) private readonly customMovesCard?: CustomMovesCardComponent;

  // --- Custom moves, staged (architecture.md §29.2; Phase 5c — first-of-kind on this page) ---

  readonly customMoveDrafts = signal<CustomMoveDraft[]>([]);
  readonly editingCustomMoveKey = signal<string | null>(null);

  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    this.customMoveDrafts().map((draft) => ({
      key: draft.key,
      name: draft.name,
      description: draft.description,
    }))
  );

  /** Add or edit a staged move — local only, no request. `key === null` is an add. */
  commitCustomMoveDraft(commit: CustomMoveCommit): void {
    const { key, name, description } = commit;

    this.customMoveDrafts.update((drafts) =>
      key === null
        ? [...drafts, { key: createCustomMoveDraftKey(), name, description }]
        : drafts.map((draft) => (draft.key === key ? { ...draft, name, description } : draft))
    );

    this.customMovesCard?.commitSucceeded();
  }

  /** A local splice and no modal — nothing is persisted yet, so there is nothing to confirm. */
  removeCustomMoveDraft(row: CustomMoveRow): void {
    this.customMoveDrafts.update((drafts) => drafts.filter((draft) => draft.key !== row.key));
    if (this.editingCustomMoveKey() === row.key) {
      this.editingCustomMoveKey.set(null);
    }
  }

  ngOnInit(): void {
    forkJoin({
      locationTypes: this.referenceDataService.getLocationTypes(),
      mysteries: this.mysteryService.getMysteries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ locationTypes, mysteries }) => {
          this.locationTypes.set(locationTypes);
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
   * Emitted by `LocationFormComponent` only once its own validation has passed
   * (including its required `locationTypeId`), so no core-field validity check is
   * needed here.
   *
   * One code path for zero, one or many mysteries (decision 3): always `createStandalone`,
   * then a membership `PUT` per selection. The accepted trade-off is that creation is two
   * round-trips and non-atomic — a failed link leaves a real, unattached location, which
   * is a first-class state under decision 1 and is recoverable from its detail page.
   *
   * The partial-failure handling is the shipped convention from `monster-create.ts:286-292`
   * and `minion-create.ts:333-339`, and UX §9.5.1 requires it here: a membership failure is
   * a **success with a caveat**, not an error. Routing it to `error:` would leave the user on
   * a populated create form whose only control creates a *second* location.
   */
  onCreate(submit: LocationFormSubmit): void {
    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.locationService
      .createStandalone(submit.location)
      .pipe(
        switchMap((location) =>
          // The location now exists. A failure past this point must not look like a
          // total failure, so it is caught here rather than reaching the error handler.
          //
          // **Two arms now, not one** (Phase 5c, §29.2). The memberships were this page's only
          // post-create batch; custom moves join them as a sibling, which is why `linksFailed`
          // became `draftsFailed` — one combined flag, because `forkJoin` reports that *one* call
          // failed and never which, so a flag per arm would be a distinction the data cannot
          // support.
          forkJoin({
            links: this.runBatch(
              submit.mysteryIds.map((mysteryId) => this.locationService.linkToMystery(mysteryId, location.id))
            ),
            customMoves: this.runBatch(
              this.customMoveDrafts().map((move) =>
                this.customMoveService.create('Location', location.id, {
                  name: move.name,
                  description: move.description,
                })
              )
            ),
          }).pipe(
            map(() => ({ locationId: location.id, draftsFailed: false })),
            catchError(() => of({ locationId: location.id, draftsFailed: true }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ locationId, draftsFailed }) => {
          this.isSaving.set(false);

          if (draftsFailed) {
            // `forkJoin` reports that one call failed, never that all of them did, so the
            // copy hedges. `NotificationKind` has no warning severity, so the caveat spends
            // `.error()` exactly as `monster-create` does.
            //
            // **"some details", not "some of its mysteries"** — converged in Phase 5c, and a
            // correctness fix rather than a wording preference (§13.6.1 Ruling 1, decision 13).
            // The old string became false by omission the moment a custom-move POST could fail
            // under this same flag: a user whose move failed and whose memberships landed would
            // have been sent to check their mysteries. The surviving wording is the shipped
            // monster/minion string, verbatim — "details" is deliberately a *category* word, so it
            // does not go stale with the next sub-resource type.
            this.notificationService.error(
              'Location created, but some details may not have saved. Review them on the location page.'
            );
          } else {
            this.notificationService.success('Location created.');
          }

          // On the partial branch the scoped route would assert a membership we no longer
          // know holds, so it is always the flat one (UX §9.5.1, state C6).
          void this.router.navigate(
            draftsFailed ? ['/locations', locationId] : this.detailLink(locationId, submit.mysteryIds)
          );
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Unable to create location.');
          this.notificationService.error('Unable to create location.');
        },
      });
  }

  /**
   * With exactly one mystery selected there is an unambiguous scoped route to land on, and
   * that is the destination this page has always used. Zero or many selections have no
   * single referent, so they fall back to the flat catalog route.
   */
  private detailLink(locationId: string, mysteryIds: string[]): unknown[] {
    return mysteryIds.length === 1
      ? ['/mysteries', mysteryIds[0], 'locations', locationId]
      : ['/locations', locationId];
  }

  private runBatch<T>(requests: Observable<T>[]): Observable<T[]> {
    return requests.length > 0 ? forkJoin(requests) : of<T[]>([]);
  }
}
