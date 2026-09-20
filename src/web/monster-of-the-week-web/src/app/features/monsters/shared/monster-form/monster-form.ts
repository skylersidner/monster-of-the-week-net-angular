import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { MysterySelectComponent } from '../../../../shared/mystery-select.component';
import {
  MonsterArchetypeResponse,
  MonsterDetailResponse,
  MysteryListItemResponse,
  TypeRefResponse,
  UpsertMonsterRequest,
} from '../../../../core/models';

/**
 * What `MonsterFormComponent.save` emits. The entity body and its mystery membership are two
 * separate writes on the host — membership is its own resource and is deliberately *not* a field on
 * `UpsertMonsterRequest` (architecture §4.1) — so the form emits them as a pair.
 */
export interface MonsterFormSubmit {
  /** Unchanged shape — exactly what `PUT /api/monsters/{id}` takes. */
  monster: UpsertMonsterRequest;
  /** The full *desired* membership set. The host diffs it against the monster's current one. */
  mysteryIds: string[];
}

/**
 * Presentational form for a monster's core fields, shared by the monster detail
 * (edit) page and the standalone create page. It owns its own `FormGroup`, validates
 * it, and emits a single `save` event — it never calls `MonsterService` itself; the
 * hosting page owns the create/update call.
 */
@Component({
  selector: 'app-monster-form',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent, MysterySelectComponent],
  templateUrl: './monster-form.html',
  host: { class: 'block' },
})
export class MonsterFormComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() monsterTypes: TypeRefResponse[] = [];
  @Input() monsterArchetypes: MonsterArchetypeResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  /** Options for the membership picker. The hosting page loads these. */
  @Input() mysteries: MysteryListItemResponse[] = [];
  /** `null` = create mode. Any change to this input repopulates the form. */
  @Input() monster: MonsterDetailResponse | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save Monster';

  @Output() readonly save = new EventEmitter<MonsterFormSubmit>();

  readonly monsterForm = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    harmCapacity: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    monsterTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
    monsterArchetypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
    /**
     * The form's **last** field (UX §9.1): membership is metadata about the entity's use, not part
     * of its identity, and the form's order is identity-first. Zero mysteries is valid, so no
     * required validator and no asterisk — and no cross-mystery warning copy (decision 4).
     *
     * **This waited for the wizard's monster roster and that was the one hard sequencing constraint
     * in the plan** (§6.2, `5b-L2`): until the roster shipped, attaching a second monster from here
     * would have made monsters 2..N silently absent from the mystery's own editing surface.
     */
    mysteryIds: this.formBuilder.nonNullable.control<string[]>([]),
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

    this.save.emit({ monster: payload, mysteryIds: [...this.monsterForm.controls.mysteryIds.value] });
  }

  private populateMonsterForm(monster: MonsterDetailResponse | null): void {
    if (!monster) {
      this.monsterForm.reset({
        name: '',
        description: '',
        harmCapacity: 0,
        monsterTypeId: '',
        monsterArchetypeId: '',
        mysteryIds: [],
      });
      return;
    }

    this.monsterForm.reset({
      name: monster.name,
      description: monster.description ?? '',
      harmCapacity: monster.harmCapacity,
      monsterTypeId: monster.monsterTypeId,
      monsterArchetypeId: monster.monsterArchetype.id,
      mysteryIds: [...(monster.mysteryIds ?? [])],
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
