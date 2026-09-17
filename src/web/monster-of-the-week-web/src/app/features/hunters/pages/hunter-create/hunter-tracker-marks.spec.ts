import { HunterEvaluationResponse, HunterOutstandingItem, PlaybookDetailResponse } from '../../../../core/models';
import { WizardTrackerStep } from '../../../../shared/wizard/wizard-tracker';
import { buildPlaybook, option, section } from '../../shared/testing/pick-rule-playbooks';
import { HunterEvaluationState } from './hunter-evaluation';
import { HUNTER_STEP, HunterStepPosition, hunterSteps } from './hunter-step-model';
import { hunterTrackerMarks } from './hunter-tracker-marks';

/** `hunterTrackerMarks` (hunter-creation-wizard.md 12.8 "Tracker marks", 13.9, 13.15 item 5; L4, L5). */

const picks = section('bs-heat', 'Heat', { options: [option('h1', 'A cop')] });
const fixed = section('bs-breed', 'Monster Breed');
const freeText = section('bs-code', 'Code', { freeTextLabel: 'Your code' });
const threeSections = buildPlaybook({ bespokeSections: [picks, fixed, freeText] });

const item = (area: HunterOutstandingItem['area'], sectionId: string | null = null): HunterOutstandingItem => ({ area, sectionId, gearCategoryId: null, message: area });
const answer = (...outstanding: HunterOutstandingItem[]): HunterEvaluationResponse => ({ refusal: null, outstanding });
const ok = (...outstanding: HunterOutstandingItem[]): HunterEvaluationState => ({ kind: 'ok', result: answer(...outstanding) });
const end: HunterStepPosition = { step: HUNTER_STEP.introductions, sub: 0 };

function marks(evaluation: HunterEvaluationState, options: { furthest?: HunterStepPosition; gateOk?: boolean; playbook?: PlaybookDetailResponse } = {}): WizardTrackerStep[] {
  const playbook = options.playbook ?? threeSections;
  return hunterTrackerMarks({
    steps: hunterSteps(playbook),
    furthest: options.furthest ?? end,
    gateOk: options.gateOk ?? true,
    playbook,
    evaluation,
  });
}

const statuses = (steps: WizardTrackerStep[]) => steps.map((step) => step.status);
const rules = (steps: WizardTrackerStep[]) => steps[HUNTER_STEP.rules];

describe('hunterTrackerMarks', () => {
  it('a clean answer with nothing outstanding finishes every visited step and every Rules dot', () => {
    const tracker = marks(ok());
    expect(statuses(tracker)).toEqual(Array(8).fill('finished'));
    expect(rules(tracker).subSteps).toEqual(['finished', 'finished', 'finished']);
  });

  it('keeps Ratings, Moves, Gear and Introductions unfinished while the check has an item in their area (look for Introductions)', () => {
    const tracker = marks(ok(item('ratings'), item('moves'), item('gear'), item('look')));
    expect(statuses(tracker)).toEqual(['finished', 'visited', 'finished', 'finished', 'visited', 'visited', 'finished', 'visited']);
  });

  it('keeps a Rules dot unfinished while an item carries its section id, and the bubble with it', () => {
    const tracker = marks(ok(item('rules', 'bs-code')));
    expect(rules(tracker).subSteps).toEqual(['finished', 'finished', 'visited']);
    expect(rules(tracker).status).toBe('visited');
  });

  it('a move\'s own section item marks only Moves, never a Rules dot', () => {
    const tracker = marks(ok(item('moves', 'bs-network')));
    expect(statuses(tracker)).toEqual(['finished', 'finished', 'finished', 'finished', 'visited', 'finished', 'finished', 'finished']);
  });

  it('never marks a step or a dot the player hasn\'t reached', () => {
    const tracker = marks(ok(), { furthest: { step: HUNTER_STEP.rules, sub: 0 } });
    expect(statuses(tracker)).toEqual(['finished', 'finished', 'finished', 'visited', 'unreached', 'unreached', 'unreached', 'unreached']);
    // The fixed grant is the next dot, not yet reached, so it stays unreached too.
    expect(rules(tracker).subSteps).toEqual(['finished', 'unreached', 'unreached']);
  });

  describe('marks the check never drives', () => {
    it.each<[string, HunterEvaluationState]>([
      ['no check yet', { kind: 'idle' }],
      ['a check loading with no clean answer', { kind: 'loading', lastOk: null }],
      ['a failed check', { kind: 'failed', lastOk: null }],
      ['a refusal', { kind: 'refused', refusal: 'No.', lastOk: answer() }],
    ])('with %s: Playbook follows the gate; Tracks, Improvements and fixed-grant dots are finished once visited; the rest stay unfinished', (_, evaluation) => {
      const tracker = marks(evaluation);
      expect(statuses(tracker)).toEqual(['finished', 'visited', 'finished', 'visited', 'visited', 'visited', 'finished', 'visited']);
      expect(rules(tracker).subSteps).toEqual(['visited', 'finished', 'visited']);
    });

    it('leaves Playbook unfinished while the gate fails', () => {
      expect(marks(ok(), { gateOk: false })[HUNTER_STEP.playbook].status).toBe('visited');
    });
  });

  describe('L5', () => {
    it('while a check loads, marks come from the last clean answer', () => {
      const tracker = marks({ kind: 'loading', lastOk: answer(item('gear')) });
      expect(statuses(tracker)).toEqual(['finished', 'finished', 'finished', 'finished', 'finished', 'visited', 'finished', 'finished']);
    });

    it('after a failed check, marks come from the last clean answer', () => {
      expect(statuses(marks({ kind: 'failed', lastOk: answer() }))).toEqual(Array(8).fill('finished'));
    });

    it('a refusal downgrades every check-driven mark, even with a clean answer before it, and never turns one green', () => {
      const tracker = marks({ kind: 'refused', refusal: 'No.', lastOk: answer() });
      expect(tracker.filter((step) => step.status === 'finished').map((step) => step.label)).toEqual(['Playbook', 'Tracks', 'Improvements']);
    });
  });

  it('a single Rules section marks the bubble with no dots', () => {
    const one = buildPlaybook({ bespokeSections: [picks] });
    expect(rules(marks(ok(), { playbook: one }))).toEqual({ label: 'Rules', status: 'finished', clickable: true, subSteps: [] });
    expect(rules(marks(ok(item('rules', 'bs-heat')), { playbook: one })).status).toBe('visited');
  });

  it('a fixed-grant-only Rules step is finished once visited, whatever the check says', () => {
    const grantsOnly = buildPlaybook({ bespokeSections: [fixed] });
    expect(rules(marks({ kind: 'refused', refusal: 'No.', lastOk: null }, { playbook: grantsOnly })).status).toBe('finished');
  });

  it('leaves a Rules step that doesn\'t apply as not applicable', () => {
    expect(rules(marks(ok(), { playbook: buildPlaybook() }))).toEqual({ label: 'Rules', status: 'notApplicable', clickable: false, subSteps: [] });
  });
});
