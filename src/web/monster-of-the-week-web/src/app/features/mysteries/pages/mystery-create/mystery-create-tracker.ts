import { Component, inject } from '@angular/core';

import { MysteryCreateStore } from './mystery-create.store';

@Component({
  selector: 'app-mystery-create-tracker',
  templateUrl: './mystery-create-tracker.html',
})
export class MysteryCreateTrackerComponent {
  readonly store = inject(MysteryCreateStore);
}
