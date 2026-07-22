import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';

import { MysteryCreateBystandersPhaseComponent } from './mystery-create-bystanders-phase';
import { MysteryCreateDossierComponent } from './mystery-create-dossier';
import { MysteryCreateLocationsPhaseComponent } from './mystery-create-locations-phase';
import { MysteryCreateMonsterPhaseComponent } from './mystery-create-monster-phase';
import { MysteryCreateMysteryPhaseComponent } from './mystery-create-mystery-phase';
import { MysteryCreateStore } from './mystery-create.store';
import { MysteryCreateTrackerComponent } from './mystery-create-tracker';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create',
  imports: [
    MysteryCreateTrackerComponent,
    MysteryCreateDossierComponent,
    MysteryCreateMysteryPhaseComponent,
    MysteryCreateMonsterPhaseComponent,
    MysteryCreateLocationsPhaseComponent,
    MysteryCreateBystandersPhaseComponent,
    MysterySectionIconComponent,
  ],
  providers: [MysteryCreateStore],
  templateUrl: './mystery-create.html',
  styleUrl: './mystery-create.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MysteryCreateComponent implements OnInit {
  readonly store = inject(MysteryCreateStore);

  ngOnInit(): void {
    this.store.init();
  }
}
