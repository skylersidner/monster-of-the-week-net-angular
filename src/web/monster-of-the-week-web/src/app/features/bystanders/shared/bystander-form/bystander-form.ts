import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { BystanderDetailResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';

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
 */
@Component({
  selector: 'app-bystander-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './bystander-form.html',
  host: { class: 'block' },
})
export class BystanderFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() bystanderTypes: TypeRefResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() bystander: BystanderDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Bystander';

  @Output() readonly save = new EventEmitter<UpsertBystanderRequest>();

  readonly bystanderForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    bystanderTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
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

    this.save.emit(payload);
  }

  private populateBystanderForm(bystander: BystanderDetailResponse | null): void {
    if (!bystander) {
      this.bystanderForm.reset({
        name: '',
        description: '',
        bystanderTypeId: '',
      });
      return;
    }

    this.bystanderForm.reset({
      name: bystander.name,
      description: bystander.description ?? '',
      bystanderTypeId: bystander.bystanderTypeId,
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
