import { PlaybookDetailResponse } from '../../../../core/models';
import { buildPlaybook, section } from '../../shared/testing/pick-rule-playbooks';
import {
  HUNTER_START,
  HUNTER_STEP,
  HunterStepPosition,
  hunterEyebrow,
  hunterSteps,
  hunterTrackerSteps,
  laterPosition,
  nextPosition,
  previousPosition,
  shortPlaybookName,
} from './hunter-step-model';

/** The wizard's pure step model (hunter-creation-wizard.md 13.15 item 5, the F5 part). */

const withSections = (count: number, name = 'The Crooked'): PlaybookDetailResponse =>
  buildPlaybook({ name, bespokeSections: Array.from({ length: count }, (_, i) => section(`bs-${i}`, `Section ${i + 1}`)) });

const pos = (step: number, sub = 0): HunterStepPosition => ({ step, sub });

describe('hunterSteps', () => {
  it('lists the eight steps in the decided order, with their tracker labels', () => {
    expect(hunterSteps(withSections(1)).map((s) => s.label)).toEqual([
      'Playbook', 'Ratings', 'Tracks', 'Rules', 'Moves', 'Gear', 'Improvements', 'Introductions',
    ]);
  });

  it.each([
    [1, true, 1],
    [2, true, 2],
    [3, true, 3],
  ])('gives Rules one position per playbook-level section (%i sections)', (count, applicable, subCount) => {
    const rules = hunterSteps(withSections(count))[HUNTER_STEP.rules];
    expect(rules.applicable).toBe(applicable);
    expect(rules.subCount).toBe(subCount);
  });

  it.each(['The Celebrity', 'The Flake', 'The Mundane', 'The Searcher'])('marks Rules not applicable for %s, which has no playbook-level sections', (name) => {
    const steps = hunterSteps(withSections(0, name));
    expect(steps[HUNTER_STEP.rules]).toEqual({ key: 'rules', label: 'Rules', applicable: false, subCount: 1 });
    expect(steps.filter((s) => !s.applicable)).toHaveLength(1);
  });

  it('leaves Rules applicable with one position before any playbook has loaded', () => {
    expect(hunterSteps(null)[HUNTER_STEP.rules]).toEqual({ key: 'rules', label: 'Rules', applicable: true, subCount: 1 });
  });
});

describe('nextPosition and previousPosition', () => {
  const three = hunterSteps(withSections(3));
  const none = hunterSteps(withSections(0));

  it.each([
    ['from step 1', three, pos(0), pos(1)],
    ['into Rules at its first dot', three, pos(2), pos(3, 0)],
    ['along the dots', three, pos(3, 1), pos(3, 2)],
    ['off the last dot to Moves', three, pos(3, 2), pos(4)],
    ['over a Rules step that does not apply', none, pos(2), pos(4)],
    ['nowhere past the last step', three, pos(7), pos(7)],
  ])('Next: %s', (_, steps, from, to) => {
    expect(nextPosition(steps, from)).toEqual(to);
  });

  it.each([
    ['back along the dots', three, pos(3, 2), pos(3, 1)],
    ['from the first dot to Tracks', three, pos(3, 0), pos(2)],
    ['from Moves to the last Rules dot', three, pos(4), pos(3, 2)],
    ['over a Rules step that does not apply', none, pos(4), pos(2)],
    ['nowhere before step 1', three, pos(0), pos(0)],
  ])('Back: %s', (_, steps, from, to) => {
    expect(previousPosition(steps, from)).toEqual(to);
  });

  it('keeps the later of two positions, comparing Rules dots within a step', () => {
    expect(laterPosition(pos(3, 1), pos(3, 2))).toEqual(pos(3, 2));
    expect(laterPosition(pos(4), pos(3, 2))).toEqual(pos(4));
    expect(laterPosition(HUNTER_START, pos(2))).toEqual(pos(2));
  });
});

describe('hunterTrackerSteps (F5: current and visited only)', () => {
  const three = hunterSteps(withSections(3));

  it('marks steps visited up to the furthest reached and unreached beyond, with Rules dots per section', () => {
    const tracker = hunterTrackerSteps(three, pos(3, 1), true);

    expect(tracker.map((s) => s.status)).toEqual(['visited', 'visited', 'visited', 'visited', 'unreached', 'unreached', 'unreached', 'unreached']);
    expect(tracker.map((s) => s.clickable)).toEqual([true, true, true, true, false, false, false, false]);
    expect(tracker[HUNTER_STEP.rules].subSteps).toEqual(['visited', 'visited', 'unreached']);
    expect(tracker.filter((s) => s.subSteps.length > 0)).toHaveLength(1);
    // Nothing is ever "finished" in F5: that mark comes from the check in F6.
    expect(tracker.some((s) => s.status === 'finished')).toBe(false);
  });

  it('shows Rules not applicable, unclickable and without dots when it does not apply', () => {
    const tracker = hunterTrackerSteps(hunterSteps(withSections(0)), pos(7), true);
    expect(tracker[HUNTER_STEP.rules]).toEqual({ label: 'Rules', status: 'notApplicable', clickable: false, subSteps: [] });
  });

  it('shows no dots for a single Rules section', () => {
    expect(hunterTrackerSteps(hunterSteps(withSections(1)), pos(4), true)[HUNTER_STEP.rules].subSteps).toEqual([]);
  });

  it('makes only step 1 clickable while the gate fails, even with later steps reached (L3)', () => {
    const tracker = hunterTrackerSteps(three, pos(5), false);
    expect(tracker.map((s) => s.clickable)).toEqual([true, false, false, false, false, false, false, false]);
    expect(tracker[HUNTER_STEP.gear].status).toBe('visited');
  });
});

describe('hunterEyebrow (L21)', () => {
  it.each([
    ['step 1', withSections(3), pos(0), 'Step 1 of 8'],
    ['a Rules dot', withSections(3), pos(3, 1), 'Step 4 of 8 · Crooked rules · 2 of 3'],
    ['a single Rules section', withSections(1, 'The Chosen'), pos(3), 'Step 4 of 8 · Chosen rules'],
    ['Moves when Rules is skipped, with the numbering unshifted', withSections(0, 'The Celebrity'), pos(4), 'Step 5 of 8'],
    ['the last step', withSections(3), pos(7), 'Step 8 of 8'],
  ])('%s', (_, playbook, at, text) => {
    expect(hunterEyebrow(hunterSteps(playbook), at, playbook)).toBe(text);
  });

  it('drops a leading "The" the way the sheets do', () => {
    expect(shortPlaybookName('The Curse-Eater')).toBe('Curse-Eater');
    expect(shortPlaybookName('Theodora')).toBe('Theodora');
  });
});
