import { Component, inject } from '@angular/core';
import { HunterBespokeSectionComponent } from '../../../shared/sections/hunter-bespoke-section';
import { HunterCreateStore } from '../hunter-create.store';

/**
 * Step 4, the playbook's rules: one playbook-level section per Rules dot, in the playbook's order
 * (3.3 step 4, Q3 "Rules, then Moves"). The renderers are the edit page's, in `'create'` mode, so the
 * numeric leaf reads "3 of 3" rather than offering an input (13.6, L14). Move-internal sections are
 * not here; they render under their move on step 5.
 */
@Component({
  selector: 'app-hunter-rules-step',
  imports: [HunterBespokeSectionComponent],
  template: `
    @if (store.currentRulesSection(); as section) {
      <div appHunterBespokeSection [section]="section" mode="create"></div>
    }
  `,
  host: { class: 'block' },
})
export class HunterRulesStepComponent {
  readonly store = inject(HunterCreateStore);
}
