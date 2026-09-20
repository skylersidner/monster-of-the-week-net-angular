import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { MysterySelectComponent } from '../../../../shared/mystery-select.component';
import {
  BystanderDetailResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertBystanderRequest,
} from '../../../../core/models';

/**
 * What `BystanderFormComponent.save` emits. The entity body and its mystery membership
 * are two separate writes on the host — membership is its own resource and is
 * deliberately *not* a field on `UpsertBystanderRequest` (architecture §4.1) — so the
 * form emits them as a pair rather than folding one into the other.
 */
export interface BystanderFormSubmit {
  /** Unchanged shape — exactly what `PUT /api/bystanders/{id}` takes. */
  bystander: UpsertBystanderRequest;
  /** The full *desired* membership set. The host diffs it against the entity's current one. */
  mysteryIds: string[];
}

/**
 * Presentational form for a bystander's core fields, shared by the bystander detail
 * (edit) page and the standalone create page. It owns its own `FormGroup`, validates
 * it, and emits a single `save` event — it never calls `BystanderService` itself; the
 * hosting page owns the create/update call.
 *
 * Note: `bystanderTypeId` carries `Validators.required` here. That is the validator
 * shape `bystander-detail.ts` already had, deliberately preserved field-for-field —
 * it matches `LocationFormComponent` and differs from `MonsterFormComponent`/
 * `MinionFormComponent`, whose type controls have no required validator, and that
 * difference is intentional.
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
  selector: 'app-bystander-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent, MysterySelectComponent],
  templateUrl: './bystander-form.html',
  host: { class: 'block' },
})
export class BystanderFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() bystanderTypes: TypeRefResponse[] = [];
  /** Options for the membership picker. The hosting page loads these. */
  @Input() mysteries: MysteryListItemResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() bystander: BystanderDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Bystander';

  @Output() readonly save = new EventEmitter<BystanderFormSubmit>();

  readonly bystanderForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    bystanderTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
    mysteryIds: this.formBuilder.nonNullable.control<string[]>([]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bystander']) {
      this.populateBystanderForm(this.bystander);
    }
  }

  onSubmit(): void {
    if (this.bystanderForm.invalid) {
      this.bystanderForm.markAllAsTouched();
      return;
    }

    const payload: UpsertBystanderRequest = {
      name: this.bystanderForm.controls.name.value.trim(),
      description: this.toNullable(this.bystanderForm.controls.description.value),
      bystanderTypeId: this.bystanderForm.controls.bystanderTypeId.value,
    };

    this.save.emit({ bystander: payload, mysteryIds: [...this.bystanderForm.controls.mysteryIds.value] });
  }

  private populateBystanderForm(bystander: BystanderDetailResponse | null): void {
    if (!bystander) {
      this.bystanderForm.reset({
        name: '',
        description: '',
        bystanderTypeId: '',
        mysteryIds: [],
      });
      return;
    }

    this.bystanderForm.reset({
      name: bystander.name,
      description: bystander.description ?? '',
      bystanderTypeId: bystander.bystanderTypeId,
      mysteryIds: [...(bystander.mysteryIds ?? [])],
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
