import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/api';
import { LocationDetailResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';

@Component({
  selector: 'app-location-detail-component',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './location-detail.html',
  styleUrl: './location-detail.scss',
})
export class LocationDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly location = signal<LocationDetailResponse | null>(null);
  readonly locationTypes = signal<TypeRefResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly mysteryId = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    locationTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
  });

  readonly backLink = computed(() => {
    const id = this.mysteryId();
    return id ? ['/mysteries', id] : ['/mysteries'];
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const mysteryId = params.get('mysteryId');
          const locationId = params.get('locationId');
          if (!mysteryId || !locationId) {
            throw new Error('Mystery id and location id are required.');
          }

          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            location: this.apiService.get<LocationDetailResponse>(`/api/locations/${locationId}`),
            locationTypes: this.referenceDataService.getLocationTypes(),
          });
        })
      )
      .subscribe({
        next: ({ location, locationTypes }) => {
          this.location.set(location);
          this.locationTypes.set(locationTypes);
          this.form.reset({
            name: location.name,
            description: location.description ?? '',
            locationTypeId: location.locationTypeId,
          });
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load location details.');
          this.isLoading.set(false);
        },
      });
  }

  save(): void {
    if (this.form.invalid || !this.location()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: UpsertLocationRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.toNullable(this.form.controls.description.value),
      locationTypeId: this.form.controls.locationTypeId.value,
    };

    this.isSaving.set(true);
    this.apiService
      .put<UpsertLocationRequest, LocationDetailResponse>(`/api/locations/${this.location()!.id}`, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (location) => {
          this.location.set(location);
          this.form.reset({
            name: location.name,
            description: location.description ?? '',
            locationTypeId: location.locationTypeId,
          });
          this.notificationService.success('Location saved.');
          this.errorMessage.set(null);
          this.isSaving.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to save location.');
          this.notificationService.error('Unable to save location.');
          this.isSaving.set(false);
        },
      });
  }

  private toNullable(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
