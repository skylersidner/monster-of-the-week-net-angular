import { Component } from '@angular/core';
import { HunterRatingsSectionComponent } from '../../../shared/sections/hunter-ratings-section';

/** Step 2, "How Do They Handle Trouble?": the shared ratings section, as on the edit page (3.3, 13.6). */
@Component({
  selector: 'app-hunter-ratings-step',
  imports: [HunterRatingsSectionComponent],
  template: `<section appHunterRatingsSection></section>`,
  host: { class: 'block' },
})
export class HunterRatingsStepComponent {}
