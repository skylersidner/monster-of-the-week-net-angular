import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { MysterySelectComponent } from '../../../../shared/mystery-select.component';
import {
  LocationDetailResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertLocationRequest,
} from '../../../../core/models';

/**
 * What `LocationFormComponent.save` emits. The entity body and its mystery membership
 * are two separate writes on the host — membership is its own resource and is
 * deliberately *not* a field on `UpsertLocationRequest` (architecture §4.1) — so the
 * form emits them as a pair rather than folding one into the other.
 */
export interface LocationFormSubmit {
  /** Unchanged shape — exactly what `PUT /api/locations/{id}` takes. */
  location: UpsertLocationRequest;
  /** The full *desired* membership set. The host diffs it against the entity's current one. */
  mysteryIds: string[];
}

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
 *
 * `mysteryIds` is the form's **last** field (UX doc §9.1): membership is metadata about
 * the entity's use, not part of its identity, and the form's existing order is
 * identity-first. It lives inside this `FormGroup` so it participates in dirty/valid
 * state and is committed by the single existing Save button — replacing the bolted-on
 * external `mysteryControl` the create pages used to carry. Zero mysteries is valid, so
 * it has no required validator and no asterisk, and there is no cross-mystery warning
 * copy anywhere (decision 4 — sharing is known and does not need narrating).
 */
@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent, MysterySelectComponent],
  templateUrl: './location-form.html',
  host: { class: 'block' },
})
export class LocationFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() locationTypes: TypeRefResponse[] = [];
  /** Options for the membership picker. The hosting page loads these. */
  @Input() mysteries: MysteryListItemResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() location: LocationDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Location';

  @Output() readonly save = new EventEmitter<LocationFormSubmit>();

  readonly locationForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    locationTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
    mysteryIds: this.formBuilder.nonNullable.control<string[]>([]),
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

    this.save.emit({ location: payload, mysteryIds: [...this.locationForm.controls.mysteryIds.value] });
  }

  private populateLocationForm(location: LocationDetailResponse | null): void {
    if (!location) {
      this.locationForm.reset({
        name: '',
        description: '',
        locationTypeId: '',
        mysteryIds: [],
      });
      return;
    }

    this.locationForm.reset({
      name: location.name,
      description: location.description ?? '',
      locationTypeId: location.locationTypeId,
      mysteryIds: [...(location.mysteryIds ?? [])],
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
