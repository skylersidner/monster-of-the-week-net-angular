import { Component, inject } from '@angular/core';

import { MysteryCreateStore } from './mystery-create.store';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create-tracker',
  imports: [MysterySectionIconComponent],
  templateUrl: './mystery-create-tracker.html',
})
export class MysteryCreateTrackerComponent {
  readonly store = inject(MysteryCreateStore);
}
