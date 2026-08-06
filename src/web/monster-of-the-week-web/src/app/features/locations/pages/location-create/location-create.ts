import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LocationService } from '../../../../core/location';
import { MysteryListItemResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { LocationFormComponent } from '../../shared/location-form/location-form';

/**
 * Location has no interactive sub-resources (see plan doc Resolved Decision 2) — this
 * page is a single 3-field form plus an optional mystery picker, with exactly one API
 * call on submit. No draft arrays, no batched sub-resource submit.
 */
@Component({
  selector: 'app-location-create',
  imports: [ReactiveFormsModule, RouterLink, LocationFormComponent, CustomSelectComponent],
  templateUrl: './location-create.html',
})
export class LocationCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Optional "attach to mystery" picker. Blank is the valid "create unattached" path. */
  readonly mysteryControl = this.formBuilder.nonNullable.control('');

  constructor(
    private readonly router: Router,
    private readonly locationService: LocationService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

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
   */
  onCreate(payload: UpsertLocationRequest): void {
    const mysteryId = this.mysteryControl.value;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const create$ = mysteryId
      ? this.locationService.create(mysteryId, payload)
      : this.locationService.createStandalone(payload);

    create$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (location) => {
        this.isSaving.set(false);
        this.notificationService.success('Location created.');
        void this.router.navigate(this.detailLink(location.id, mysteryId));
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMessage.set('Unable to create location.');
        this.notificationService.error('Unable to create location.');
      },
    });
  }

  private detailLink(locationId: string, mysteryId: string): unknown[] {
    return mysteryId ? ['/mysteries', mysteryId, 'locations', locationId] : ['/locations', locationId];
  }
}
