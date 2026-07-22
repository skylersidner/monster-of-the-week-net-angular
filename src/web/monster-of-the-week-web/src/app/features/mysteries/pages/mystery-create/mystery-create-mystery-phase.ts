import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';

@Component({
  selector: 'app-mystery-create-mystery-phase',
  imports: [ReactiveFormsModule],
  templateUrl: './mystery-create-mystery-phase.html',
})
export class MysteryCreateMysteryPhaseComponent {
  readonly store = inject(MysteryCreateStore);
}
