import { PlaybookDetailResponse } from '../../../../core/models';
import { WizardStepStatus, WizardTrackerStep } from '../../../../shared/wizard/wizard-tracker';

/*
 * The Hunter creation wizard's step model, as pure functions (hunter-creation-wizard.md 3.1, 4.3,
 * 7.2, 13.5; Phase 7, F5). `HunterCreateStore` reads these; nothing here holds state.
 *
 * Steps are 0-based indices into a fixed list of eight. The doc numbers them 1–8, and so does the
 * eyebrow, which keeps fixed 8-step numbering even when Rules is skipped (L21).
 */

export const HUNTER_STEP = {
  playbook: 0,
  ratings: 1,
  tracks: 2,
  rules: 3,
  moves: 4,
  gear: 5,
  improvements: 6,
  introductions: 7,
} as const;

export type HunterStepKey = keyof typeof HUNTER_STEP;

export const HUNTER_STEP_COUNT = 8;
export const HUNTER_LAST_STEP = HUNTER_STEP.introductions;

/** Where the player is, or the furthest they have reached. `sub` is a Rules dot; 0 on every other step. */
export interface HunterStepPosition {
  readonly step: number;
  readonly sub: number;
}

export const HUNTER_START: HunterStepPosition = { step: HUNTER_STEP.playbook, sub: 0 };

export interface HunterStepModel {
  readonly key: HunterStepKey;
  /** Tracker label (4.3). */
  readonly label: string;
  /** False only for Rules on a playbook with no playbook-level sections (3.3 step 4). */
  readonly applicable: boolean;
  /** Positions inside the step: one per Rules section, 1 everywhere else. */
  readonly subCount: number;
}

const LABELS: Record<HunterStepKey, string> = {
  playbook: 'Playbook',
  ratings: 'Ratings',
  tracks: 'Tracks',
  rules: 'Rules',
  moves: 'Moves',
  gear: 'Gear',
  improvements: 'Improvements',
  introductions: 'Introductions',
};

const KEYS = Object.keys(HUNTER_STEP) as HunterStepKey[];

/**
 * The eight steps for a playbook (13.15 item 5). Rules gets one sub-step per playbook-level section,
 * in the order the playbook lists them, and is not applicable when there are none (The Celebrity,
 * The Flake, The Mundane, The Searcher). With no playbook loaded yet, Rules is left applicable with
 * one position: nothing past step 1 can be reached until the gate passes anyway.
 */
export function hunterSteps(playbook: PlaybookDetailResponse | null): HunterStepModel[] {
  const sectionCount = playbook?.bespokeSections.length ?? null;
  return KEYS.map((key) => {
    if (key !== 'rules') {
      return { key, label: LABELS[key], applicable: true, subCount: 1 };
    }
    return {
      key,
      label: LABELS[key],
      applicable: sectionCount === null || sectionCount > 0,
      subCount: Math.max(1, sectionCount ?? 1),
    };
  });
}

export function comparePositions(a: HunterStepPosition, b: HunterStepPosition): number {
  return a.step !== b.step ? a.step - b.step : a.sub - b.sub;
}

export function laterPosition(a: HunterStepPosition, b: HunterStepPosition): HunterStepPosition {
  return comparePositions(a, b) >= 0 ? a : b;
}

/** `Next →` (7.2): the next Rules dot, else the next applicable step. Stays put on the last step. */
export function nextPosition(steps: readonly HunterStepModel[], at: HunterStepPosition): HunterStepPosition {
  if (at.sub < steps[at.step].subCount - 1) {
    return { step: at.step, sub: at.sub + 1 };
  }
  let target = at.step + 1;
  while (target < steps.length && !steps[target].applicable) {
    target++;
  }
  return target < steps.length ? { step: target, sub: 0 } : at;
}

/**
 * `← Back` (7.2): the previous Rules dot, else the previous applicable step. Arriving at Rules from
 * Moves lands on its last dot, as the Mystery wizard lands on a phase's last step. Stays put on step 1.
 */
export function previousPosition(steps: readonly HunterStepModel[], at: HunterStepPosition): HunterStepPosition {
  if (at.sub > 0) {
    return { step: at.step, sub: at.sub - 1 };
  }
  let target = at.step - 1;
  while (target >= 0 && !steps[target].applicable) {
    target--;
  }
  return target >= 0 ? { step: target, sub: steps[target].subCount - 1 } : at;
}

/**
 * The tracker's inputs for F5: current, visited and not applicable only (4.2, L4).
 *
 * - **Visited** means at or before the furthest position reached, counted per Rules dot.
 * - **Clickable** means applicable and no later than the furthest step. While the step 1 gate fails,
 *   only step 1 itself is clickable, so the gate also blocks tracker jumps (L3).
 * - Rules shows dots only when it has more than one section.
 *
 * F6 seam: finished and unfinished marks come from the check (`hunterTrackerMarks`, 13.9, L5). F6
 * layers those onto this result; nothing here reads an evaluation.
 */
export function hunterTrackerSteps(
  steps: readonly HunterStepModel[],
  furthest: HunterStepPosition,
  gateOk: boolean
): WizardTrackerStep[] {
  return steps.map((model, index) => {
    if (!model.applicable) {
      return { label: model.label, status: 'notApplicable', clickable: false, subSteps: [] };
    }
    const visited = index <= furthest.step;
    const subSteps: WizardStepStatus[] =
      model.subCount > 1
        ? Array.from({ length: model.subCount }, (_, dot) =>
            index < furthest.step || (index === furthest.step && dot <= furthest.sub) ? 'visited' : 'unreached'
          )
        : [];
    return {
      label: model.label,
      status: visited ? 'visited' : 'unreached',
      clickable: index === HUNTER_STEP.playbook || (gateOk && visited),
      subSteps,
    };
  });
}

/** "Crooked" for "The Crooked": how the sheets name a playbook in "Crooked rules" and "Crooked special". */
export function shortPlaybookName(name: string): string {
  return name.replace(/^The\s+/i, '');
}

/**
 * "Step 4 of 8", or on Rules "Step 4 of 8 · Crooked rules · 2 of 3" (L21). The numbering never
 * shifts when Rules doesn't apply. The "n of m" part is left off when Rules has a single section.
 */
export function hunterEyebrow(
  steps: readonly HunterStepModel[],
  at: HunterStepPosition,
  playbook: PlaybookDetailResponse | null
): string {
  const base = `Step ${at.step + 1} of ${steps.length}`;
  const model = steps[at.step];
  if (model.key !== 'rules' || !playbook) {
    return base;
  }
  const parts = [base, `${shortPlaybookName(playbook.name)} rules`];
  if (model.subCount > 1) {
    parts.push(`${at.sub + 1} of ${model.subCount}`);
  }
  return parts.join(' · ');
}

/** Question-style titles (3.3). Rules uses the current section's own title instead. */
export const HUNTER_STEP_TITLES: Record<HunterStepKey, string> = {
  playbook: 'Who Is Your Hunter?',
  ratings: 'How Do They Handle Trouble?',
  tracks: 'What Keeps Them Alive?',
  rules: 'Rules',
  moves: 'What Can They Do?',
  gear: 'What Do They Carry?',
  improvements: 'How Will They Grow?',
  introductions: 'Who Are They to the Others?',
};

export function hunterStepBlurb(key: HunterStepKey, playbook: PlaybookDetailResponse | null): string {
  const short = playbook ? shortPlaybookName(playbook.name) : 'hunter';
  switch (key) {
    case 'playbook':
      return 'Choose a playbook and give your hunter a name. Every step after this one belongs to the playbook you pick.';
    case 'ratings':
      return 'Every playbook prints a few rating lines. Pick the one that fits how your hunter deals with trouble.';
    case 'tracks':
      return 'Luck, harm and experience work the same way for every hunter, but each playbook puts its own twist on luck.';
    case 'rules':
      return `Part of what makes your ${short} who they are. Anything you leave short can be finished later.`;
    case 'moves':
      return 'Pick the moves your hunter starts with. A move that asks for more shows its choices right under it.';
    case 'gear':
      return 'Pick what your hunter carries into a hunt.';
    case 'improvements':
      return 'This is how your hunter will grow as they level up during play.';
    case 'introductions':
      return 'Describe how your hunter looks, then introduce them to the group and settle their history with the other hunters.';
  }
}
