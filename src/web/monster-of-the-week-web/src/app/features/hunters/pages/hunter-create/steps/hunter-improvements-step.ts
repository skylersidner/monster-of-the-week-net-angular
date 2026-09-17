import { Component, computed, inject } from '@angular/core';
import { PlaybookImprovementResponse } from '../../../../../core/models';
import { HunterDraft } from '../../../shared/hunter-draft';

/**
 * Step 7, "How Will They Grow?" (3.3 step 7). Read-only reference: the playbook's leveling-up text,
 * then its improvements and advanced improvements as two lists in `sortOrder`. The stored text stops
 * before the sheet's sentence about when advanced improvements unlock, and the copy doesn't paraphrase
 * it (Gap 4). No dossier section: nothing here is something the hunter has built.
 */
@Component({
  selector: 'app-hunter-improvements-step',
  templateUrl: './hunter-improvements-step.html',
  host: { class: 'block' },
})
export class HunterImprovementsStepComponent {
  readonly draft = inject(HunterDraft);

  readonly improvements = computed(() => this.sorted(false));
  readonly advancedImprovements = computed(() => this.sorted(true));

  private sorted(isAdvanced: boolean): PlaybookImprovementResponse[] {
    return (this.draft.playbook()?.improvements ?? [])
      .filter((improvement) => improvement.isAdvanced === isAdvanced)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
