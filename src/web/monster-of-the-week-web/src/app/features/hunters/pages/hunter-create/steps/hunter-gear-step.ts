import { Component, inject } from '@angular/core';
import { HunterDraft } from '../../../shared/hunter-draft';
import { HunterGearSectionComponent } from '../../../shared/sections/hunter-gear-section';

/**
 * Step 6, "What Do They Carry?" (3.3 step 6): the shared gear section, with granted gear read-only
 * (Gap 6) and the Initiate's pick-rule counters, hints and notices (F8b), as on the edit page.
 */
@Component({
  selector: 'app-hunter-gear-step',
  imports: [HunterGearSectionComponent],
  template: `
    @if ((draft.playbook()?.gearCategories?.length ?? 0) > 0) {
      <section appHunterGearSection></section>
    } @else {
      <p class="m-0 text-muted">This playbook has no gear to pick.</p>
    }
  `,
  host: { class: 'block' },
})
export class HunterGearStepComponent {
  readonly draft = inject(HunterDraft);
}
