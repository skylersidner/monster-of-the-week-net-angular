import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { MinionDetailResponse, TypeRefResponse, UpsertMinionRequest } from '../../../../core/models';

/**
 * Presentational form for a minion's core fields, shared by the minion detail
 * (edit) page and the standalone create page. It owns its own `FormGroup`, validates
 * it, and emits a single `save` event — it never calls `MinionService` itself; the
 * hosting page owns the create/update call.
 *
 * The minion's `monsterId` is deliberately not part of this component: it is not a
 * field on `UpsertMinionRequest` at all, and is supplied by the hosting page via the
 * service method's own parameter.
 */
@Component({
  selector: 'app-minion-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './minion-form.html',
  host: { class: 'block' },
})
export class MinionFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() minionTypes: TypeRefResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() minion: MinionDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Minion';

  @Output() readonly save = new EventEmitter<UpsertMinionRequest>();

  readonly minionForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmCapacity: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    minionTypeId: this.formBuilder.nonNullable.control(''),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['minion']) {
      this.populateMinionForm(this.minion);
    }
  }

  onSubmit(): void {
    if (this.minionForm.invalid) {
      this.minionForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMinionRequest = {
      name: this.minionForm.controls.name.value.trim(),
      description: this.toNullable(this.minionForm.controls.description.value),
      harmCapacity: this.minionForm.controls.harmCapacity.value,
      minionTypeId: this.minionForm.controls.minionTypeId.value,
    };

    this.save.emit(payload);
  }

  private populateMinionForm(minion: MinionDetailResponse | null): void {
    if (!minion) {
      this.minionForm.reset({
        name: '',
        description: '',
        harmCapacity: 0,
        minionTypeId: '',
      });
      return;
    }

    this.minionForm.reset({
      name: minion.name,
      description: minion.description ?? '',
      harmCapacity: minion.harmCapacity,
      minionTypeId: minion.minionType.id,
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
