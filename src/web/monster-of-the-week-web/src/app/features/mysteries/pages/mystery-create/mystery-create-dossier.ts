import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';

import { MysteryCreateStore } from './mystery-create.store';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create-dossier',
  imports: [NgTemplateOutlet, MysterySectionIconComponent],
  templateUrl: './mystery-create-dossier.html',
})
export class MysteryCreateDossierComponent {
  readonly store = inject(MysteryCreateStore);
  readonly countdownStages = MYSTERY_COUNTDOWN_STAGES;

  /** Type badge copy for a collapsed roster entry. Drafts carry a type ID, not a resolved type. */
  minionTypeName(minionTypeId: string): string {
    return this.store.minionTypes().find((item) => item.id === minionTypeId)?.name ?? '';
  }

  monsterTypeName(monsterTypeId: string): string {
    return this.store.monsterTypes().find((item) => item.id === monsterTypeId)?.name ?? '';
  }

  /** §17.2: derived from the wizard's own drafts, never a list response's `minionCount`. */
  minionCountFor(monsterKey: string): number {
    return this.store.minionDrafts().filter((minion) => minion.monsterKey === monsterKey).length;
  }
}
