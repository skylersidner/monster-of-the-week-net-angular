import {
  BespokeSectionResponse,
  HunterEvaluationResponse,
  HunterOutstandingArea,
  PlaybookDetailResponse,
} from '../../../../core/models';
import { WizardStepStatus, WizardTrackerStep } from '../../../../shared/wizard/wizard-tracker';
import { HunterEvaluationState } from './hunter-evaluation';
import { HunterStepKey, HunterStepModel, HunterStepPosition, hunterTrackerSteps } from './hunter-step-model';

/*
 * The tracker's finished marks (hunter-creation-wizard.md 4.2, 12.8 "Tracker marks", 13.9, L4, L5;
 * Phase 7, F6), as one pure function over the F5 tracker mapping.
 *
 * Steps not yet reached, and a Rules step that doesn't apply, are left exactly as F5 maps them. A
 * visited step becomes finished when:
 * - Playbook: the step 1 gate holds.
 * - Tracks and Improvements: always, once visited. Nothing on them can be left unfinished.
 * - A Rules dot for a fixed grant (no options, no free text): always, once visited.
 * - Ratings, Moves, Gear, Introductions: the check has no item in that area (`look` for Introductions).
 * - Any other Rules dot: the check has no item carrying that section's id.
 *
 * The first three never read the check, so loading, failure and refusal can't change them. The rest
 * follow L5: they read the latest clean result, or the last one while a check is loading or failed;
 * a refusal, or no clean result yet, leaves them at "visited, unfinished". A refusal never turns a
 * mark green. The Rules bubble is finished only when every one of its dots is.
 */

export interface HunterTrackerMarksInput {
  readonly steps: readonly HunterStepModel[];
  readonly furthest: HunterStepPosition;
  readonly gateOk: boolean;
  readonly playbook: PlaybookDetailResponse | null;
  readonly evaluation: HunterEvaluationState;
}

const AREA_OF: Partial<Record<HunterStepKey, HunterOutstandingArea>> = {
  ratings: 'ratings',
  moves: 'moves',
  gear: 'gear',
  introductions: 'look',
};

/** The same test `HunterBespokeSectionComponent.isFixedGrant` uses to render "Always active". */
export function isFixedGrantSection(section: BespokeSectionResponse): boolean {
  return section.options.length === 0 && section.freeTextLabel === null;
}

/** L5: the result check-driven marks may be read from, or null when they must stay unfinished. */
export function markSource(evaluation: HunterEvaluationState): HunterEvaluationResponse | null {
  switch (evaluation.kind) {
    case 'ok':
      return evaluation.result;
    case 'loading':
    case 'failed':
      return evaluation.lastOk;
    default:
      return null;
  }
}

export function hunterTrackerMarks(input: HunterTrackerMarksInput): WizardTrackerStep[] {
  const { steps, furthest, gateOk, playbook, evaluation } = input;
  const source = markSource(evaluation);
  const sections = playbook?.bespokeSections ?? [];
  const finished = (tracker: WizardTrackerStep): WizardTrackerStep => ({ ...tracker, status: 'finished' });

  return hunterTrackerSteps(steps, furthest, gateOk).map((tracker, index) => {
    const model = steps[index];
    if (tracker.status !== 'visited') {
      return tracker;
    }

    switch (model.key) {
      case 'playbook':
        return gateOk ? finished(tracker) : tracker;
      case 'tracks':
      case 'improvements':
        return finished(tracker);
      case 'rules': {
        const dots = Array.from({ length: model.subCount }, (_, dot): WizardStepStatus => {
          if (index === furthest.step && dot > furthest.sub) {
            return 'unreached';
          }
          const section = sections[dot];
          if (!section) {
            return 'visited';
          }
          if (isFixedGrantSection(section)) {
            return 'finished';
          }
          return source && !source.outstanding.some((item) => item.sectionId === section.id) ? 'finished' : 'visited';
        });
        return {
          ...tracker,
          status: dots.every((dot) => dot === 'finished') ? 'finished' : 'visited',
          subSteps: model.subCount > 1 ? dots : [],
        };
      }
      default: {
        const area = AREA_OF[model.key];
        return area && source && !source.outstanding.some((item) => item.area === area) ? finished(tracker) : tracker;
      }
    }
  });
}
