import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { LocationDetailResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';

/**
 * Presentational form for a location's core fields, shared by the location detail
 * (edit) page and the standalone create page. It owns its own `FormGroup`, validates
 * it, and emits a single `save` event — it never calls `LocationService` itself; the
 * hosting page owns the create/update call.
 *
 * Note: `locationTypeId` carries `Validators.required` here. That is the validator
 * shape `location-detail.ts` already had, deliberately preserved field-for-field —
 * it differs from `MonsterFormComponent`/`MinionFormComponent`, whose type controls
 * have no required validator, and that difference is intentional.
 */
@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './location-form.html',
  host: { class: 'block' },
})
export class LocationFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() locationTypes: TypeRefResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() location: LocationDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Location';

  @Output() readonly save = new EventEmitter<UpsertLocationRequest>();

  readonly locationForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    locationTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['location']) {
      this.populateLocationForm(this.location);
    }
  }

  onSubmit(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const payload: UpsertLocationRequest = {
      name: this.locationForm.controls.name.value.trim(),
      description: this.toNullable(this.locationForm.controls.description.value),
      locationTypeId: this.locationForm.controls.locationTypeId.value,
    };

    this.save.emit(payload);
  }

  private populateLocationForm(location: LocationDetailResponse | null): void {
    if (!location) {
      this.locationForm.reset({
        name: '',
        description: '',
        locationTypeId: '',
      });
      return;
    }

    this.locationForm.reset({
      name: location.name,
      description: location.description ?? '',
      locationTypeId: location.locationTypeId,
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
