import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { WeaponTagSelectComponent } from '../../../../shared/weapon-tag-select.component';

@Component({
  selector: 'app-mystery-create-monster-phase',
  imports: [ReactiveFormsModule, CustomSelectComponent, WeaponTagSelectComponent],
  templateUrl: './mystery-create-monster-phase.html',
})
export class MysteryCreateMonsterPhaseComponent {
  readonly store = inject(MysteryCreateStore);

  tagsForAttack(tagIds: string[]) {
    return this.store.weaponTags().filter((t) => tagIds.includes(t.id));
  }
}
