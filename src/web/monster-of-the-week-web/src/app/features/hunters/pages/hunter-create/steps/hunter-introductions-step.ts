import { Component, inject } from '@angular/core';
import { HunterDraft } from '../../../shared/hunter-draft';
import { HunterHistorySectionComponent } from '../../../shared/sections/hunter-history-section';
import { HunterLookSectionComponent } from '../../../shared/sections/hunter-look-section';
import { HunterStillToFinishComponent } from './hunter-still-to-finish';

/**
 * Step 8, "Who Are They to the Others?", the last step (3.3 step 8; Q2 "Split", Q4 "Prompts + notes
 * box"): the look lines, the Introductions text, the History prompts with the optional History notes
 * box, which saves to `background` and never counts as unfinished, then the "Still to finish" card
 * (7.3, 13.9). Create Hunter is the page's footer button on this step.
 */
@Component({
  selector: 'app-hunter-introductions-step',
  imports: [HunterLookSectionComponent, HunterHistorySectionComponent, HunterStillToFinishComponent],
  templateUrl: './hunter-introductions-step.html',
  host: { class: 'block' },
})
export class HunterIntroductionsStepComponent {
  readonly draft = inject(HunterDraft);
}
