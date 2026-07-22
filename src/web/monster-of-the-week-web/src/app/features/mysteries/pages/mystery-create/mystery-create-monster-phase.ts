import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';
import { CustomSelectComponent } from '../../shared/custom-select.component';

@Component({
  selector: 'app-mystery-create-monster-phase',
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './mystery-create-monster-phase.html',
})
export class MysteryCreateMonsterPhaseComponent {
  readonly store = inject(MysteryCreateStore);
}
