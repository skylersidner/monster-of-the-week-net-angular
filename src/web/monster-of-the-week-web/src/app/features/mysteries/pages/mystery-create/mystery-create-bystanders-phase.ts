import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';

@Component({
  selector: 'app-mystery-create-bystanders-phase',
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './mystery-create-bystanders-phase.html',
})
export class MysteryCreateBystandersPhaseComponent {
  readonly store = inject(MysteryCreateStore);
}
