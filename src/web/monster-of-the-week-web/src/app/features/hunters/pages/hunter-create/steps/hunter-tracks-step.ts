import { Component, computed, inject } from '@angular/core';
import { HunterDraft } from '../../../shared/hunter-draft';
import { shortPlaybookName } from '../hunter-step-model';

/*
 * The rule text every sheet prints around its tracks. None of it is stored, so it lives here as
 * fixed web-app text (Q4; hunter-creation-wizard.md 8 Gap 2, 12.4, 12.13).
 *
 * - Harm and Experience print identically on all 28 sheets. The Harm sentence's number is the
 *   playbook's `harmUnstableThreshold` (4 on all 28 today), so an edited threshold can't contradict the
 *   box row; only the wording is fixed.
 * - Luck prints two wordings (22 long, 6 short: The Expert, Flake, Initiate, Monstrous, Mundane and
 *   Professional). Skyler chose "Longer wording for all" on 2026-09-14, so this one sentence shows for
 *   every playbook.
 * - The start and end labels are as printed on the sheets ("Okay … Doomed", "Okay … Dying"), and
 *   "Okay" is also the start label for an extra track that stores none (3.3 step 3).
 */
export const LUCK_RULE = 'Mark luck to change a roll to 12 or avoid all harm from an injury.';
export function harmRule(unstableThreshold: number): string {
  return `When you reach ${unstableThreshold} or more, mark unstable.`;
}
export const EXPERIENCE_RULE = 'Whenever you roll and get a total of 6 or less, or when a move tells you to, mark an experience box.';
export const TRACK_START_LABEL = 'Okay';
export const LUCK_END_LABEL = 'Doomed';
export const HARM_END_LABEL = 'Dying';

/**
 * Step 3, "What Keeps Them Alive?" (3.3; Phase 7, F5). Read-only: Luck, Harm, Experience, any extra
 * tracks and the journal, with nothing to choose (13.6's `HunterTracksReference`). The edit page keeps
 * its inputs for these; this is a separate component on purpose (13.13).
 *
 * Nothing here writes to the draft. Luck, Harm and Experience go out as the draft's 0s, and extra
 * tracks are left out of the request, which the server reads as 0.
 */
@Component({
  selector: 'app-hunter-tracks-step',
  templateUrl: './hunter-tracks-step.html',
  host: { class: 'block' },
})
export class HunterTracksStepComponent {
  readonly draft = inject(HunterDraft);

  readonly rules = { luck: LUCK_RULE, experience: EXPERIENCE_RULE };
  readonly harmRule = harmRule;
  readonly labels = { start: TRACK_START_LABEL, luckEnd: LUCK_END_LABEL, harmEnd: HARM_END_LABEL };

  readonly shortName = computed(() => shortPlaybookName(this.draft.playbook()?.name ?? ''));

  boxes(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_, index) => index);
  }
}
