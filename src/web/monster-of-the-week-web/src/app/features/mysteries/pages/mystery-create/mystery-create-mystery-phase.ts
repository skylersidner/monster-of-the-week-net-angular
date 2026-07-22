import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MysteryCreateStore } from './mystery-create.store';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create-mystery-phase',
  imports: [ReactiveFormsModule, MysterySectionIconComponent],
  templateUrl: './mystery-create-mystery-phase.html',
})
export class MysteryCreateMysteryPhaseComponent {
  readonly store = inject(MysteryCreateStore);
  readonly countdownStages = MYSTERY_COUNTDOWN_STAGES;
}
