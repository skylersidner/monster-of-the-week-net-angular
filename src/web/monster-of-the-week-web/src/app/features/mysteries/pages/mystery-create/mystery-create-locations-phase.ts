import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';

@Component({
  selector: 'app-mystery-create-locations-phase',
  imports: [ReactiveFormsModule],
  templateUrl: './mystery-create-locations-phase.html',
})
export class MysteryCreateLocationsPhaseComponent {
  readonly store = inject(MysteryCreateStore);
}
