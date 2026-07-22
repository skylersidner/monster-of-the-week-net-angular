import { Component, inject } from '@angular/core';

import { MysteryCreateStore } from './mystery-create.store';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create-dossier',
  imports: [MysterySectionIconComponent],
  templateUrl: './mystery-create-dossier.html',
})
export class MysteryCreateDossierComponent {
  readonly store = inject(MysteryCreateStore);
  readonly countdownStages = MYSTERY_COUNTDOWN_STAGES;
}
