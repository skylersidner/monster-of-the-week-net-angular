import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { WizardLayoutComponent } from '../../../../shared/wizard/wizard-layout';
import { WizardStepStatus, WizardTrackerComponent, WizardTrackerStep } from '../../../../shared/wizard/wizard-tracker';
import { MysteryCreateBystandersPhaseComponent } from './mystery-create-bystanders-phase';
import { MysteryCreateDossierComponent } from './mystery-create-dossier';
import { MysteryCreateLocationsPhaseComponent } from './mystery-create-locations-phase';
import { MysteryCreateMonsterPhaseComponent } from './mystery-create-monster-phase';
import { MysteryCreateMysteryPhaseComponent } from './mystery-create-mystery-phase';
import { MysteryCreateStore } from './mystery-create.store';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';

@Component({
  selector: 'app-mystery-create',
  imports: [
    WizardLayoutComponent,
    WizardTrackerComponent,
    MysteryCreateDossierComponent,
    MysteryCreateMysteryPhaseComponent,
    MysteryCreateMonsterPhaseComponent,
    MysteryCreateLocationsPhaseComponent,
    MysteryCreateBystandersPhaseComponent,
    MysterySectionIconComponent,
  ],
  providers: [MysteryCreateStore],
  templateUrl: './mystery-create.html',
  host: { class: 'block h-full' },
})
export class MysteryCreateComponent implements OnInit {
  readonly store = inject(MysteryCreateStore);
  private readonly route = inject(ActivatedRoute);

  /** Changes on every navigation; the shared layout resets scroll and moves focus when it does. */
  readonly stepKey = computed(() => `${this.store.currentPhase()}-${this.store.currentStep()}`);

  /**
   * The store's phase state mapped onto the shared tracker. The access rule is the store's own
   * (`isPhaseAccessible`: current or complete, every phase in edit mode). Mysteries never use
   * `visited`: create mode can't leave a phase without saving it, and an edit-mode phase with no data
   * keeps today's plain, clickable bubble. Dots keep today's rule.
   */
  readonly trackerSteps = computed<WizardTrackerStep[]>(() => {
    const phaseComplete = this.store.phaseComplete();
    const stepComplete = this.store.phaseStepComplete();
    const currentPhase = this.store.currentPhase();
    const currentStep = this.store.currentStep();

    return this.store.phases.map((phase) => ({
      label: phase.name,
      icon: phase.icon,
      status: phaseComplete[phase.index] ? 'finished' : 'unreached',
      clickable: this.store.isPhaseAccessible(phase.index),
      subSteps:
        phase.steps > 1
          ? phase.stepsArray.map<WizardStepStatus>((step) =>
              stepComplete[phase.index]?.[step] || (currentPhase === phase.index && currentStep > step)
                ? 'finished'
                : 'unreached'
            )
          : [],
    }));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? undefined;
    this.store.init(id);
  }
}
