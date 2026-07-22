import { Component, inject } from '@angular/core';

import { MysteryCreateStore } from './mystery-create.store';

@Component({
  selector: 'app-mystery-create-dossier',
  templateUrl: './mystery-create-dossier.html',
})
export class MysteryCreateDossierComponent {
  readonly store = inject(MysteryCreateStore);
}
