import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import {
  MonsterArchetypeResponse,
  MonsterDetailResponse,
  TypeRefResponse,
  UpsertMonsterRequest,
} from '../../../../core/models';

/**
 * Presentational form for a monster's core fields, shared by the monster detail
 * (edit) page and the standalone create page. It owns its own `FormGroup`, validates
 * it, and emits a single `save` event — it never calls `MonsterService` itself; the
 * hosting page owns the create/update call.
 */
@Component({
  selector: 'app-monster-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './monster-form.html',
  host: { class: 'block' },
})
export class MonsterFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() monsterTypes: TypeRefResponse[] = [];
  @Input() monsterArchetypes: MonsterArchetypeResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() monster: MonsterDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Monster';

  @Output() readonly save = new EventEmitter<UpsertMonsterRequest>();

  readonly monsterForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmCapacity: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    monsterTypeId: this.formBuilder.nonNullable.control(''),
    monsterArchetypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['monster']) {
      this.populateMonsterForm(this.monster);
    }
  }

  onSubmit(): void {
    if (this.monsterForm.invalid) {
      this.monsterForm.markAllAsTouched();
      return;
    }

    const payload: UpsertMonsterRequest = {
      name: this.monsterForm.controls.name.value.trim(),
      description: this.toNullable(this.monsterForm.controls.description.value),
      harmCapacity: this.monsterForm.controls.harmCapacity.value,
      monsterTypeId: this.monsterForm.controls.monsterTypeId.value,
      monsterArchetypeId: this.monsterForm.controls.monsterArchetypeId.value,
    };

    this.save.emit(payload);
  }

  private populateMonsterForm(monster: MonsterDetailResponse | null): void {
    if (!monster) {
      this.monsterForm.reset({
        name: '',
        description: '',
        harmCapacity: 0,
        monsterTypeId: '',
        monsterArchetypeId: '',
      });
      return;
    }

    this.monsterForm.reset({
      name: monster.name,
      description: monster.description ?? '',
      harmCapacity: monster.harmCapacity,
      monsterTypeId: monster.monsterTypeId,
      monsterArchetypeId: monster.monsterArchetype.id,
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
