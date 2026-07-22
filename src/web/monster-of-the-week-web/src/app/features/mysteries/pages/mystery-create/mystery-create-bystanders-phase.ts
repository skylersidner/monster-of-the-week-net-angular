import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';

@Component({
  selector: 'app-mystery-create-bystanders-phase',
  imports: [ReactiveFormsModule],
  templateUrl: './mystery-create-bystanders-phase.html',
})
export class MysteryCreateBystandersPhaseComponent {
  readonly store = inject(MysteryCreateStore);
}
