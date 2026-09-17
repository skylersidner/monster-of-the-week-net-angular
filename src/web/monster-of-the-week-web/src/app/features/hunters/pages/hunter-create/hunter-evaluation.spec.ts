import { HunterEvaluationResponse, HunterOutstandingItem } from '../../../../core/models';
import { buildPlaybook, option, section } from '../../shared/testing/pick-rule-playbooks';
import { HunterEvaluationState, groupOutstanding, lastOkOf, linkFor, nextEvaluation } from './hunter-evaluation';
import { HUNTER_STEP } from './hunter-step-model';

/** The check's state and the card's grouping (hunter-creation-wizard.md 13.9, 13.15 item 5; L5, L6, L8). */

const item = (area: HunterOutstandingItem['area'], message: string, ids: Partial<Pick<HunterOutstandingItem, 'sectionId' | 'gearCategoryId'>> = {}): HunterOutstandingItem => ({
  area, message, sectionId: ids.sectionId ?? null, gearCategoryId: ids.gearCategoryId ?? null,
});

const clean: HunterEvaluationResponse = { refusal: null, outstanding: [] };
const short: HunterEvaluationResponse = { refusal: null, outstanding: [item('ratings', 'Choose a rating array.')] };

describe('nextEvaluation (13.9, L6)', () => {
  it.each<[string, HunterEvaluationState, Parameters<typeof nextEvaluation>[1], HunterEvaluationState]>([
    ['starting from nothing', { kind: 'idle' }, { kind: 'started' }, { kind: 'loading', lastOk: null }],
    ['starting after a clean answer keeps it as lastOk', { kind: 'ok', result: short }, { kind: 'started' }, { kind: 'loading', lastOk: short }],
    ['a clean answer', { kind: 'loading', lastOk: short }, { kind: 'answered', response: clean }, { kind: 'ok', result: clean }],
    ['a refusal keeps the last clean answer', { kind: 'loading', lastOk: short }, { kind: 'answered', response: { refusal: 'No.', outstanding: [] } }, { kind: 'refused', refusal: 'No.', lastOk: short }],
    ['a failure keeps the last clean answer', { kind: 'loading', lastOk: short }, { kind: 'failed' }, { kind: 'failed', lastOk: short }],
    ['a refusal after a refusal keeps the clean answer from before both', { kind: 'refused', refusal: 'No.', lastOk: short }, { kind: 'started' }, { kind: 'loading', lastOk: short }],
    ['a reset clears everything', { kind: 'ok', result: short }, { kind: 'reset' }, { kind: 'idle' }],
  ])('%s', (_, state, outcome, expected) => {
    expect(nextEvaluation(state, outcome)).toEqual(expected);
  });

  it('reads lastOk from every state', () => {
    expect(lastOkOf({ kind: 'idle' })).toBeNull();
    expect(lastOkOf({ kind: 'ok', result: clean })).toBe(clean);
    expect(lastOkOf({ kind: 'failed', lastOk: short })).toBe(short);
  });
});

describe('groupOutstanding and linkFor (13.9, L8)', () => {
  const playbook = buildPlaybook({
    bespokeSections: [section('bs-background', 'Background'), section('bs-heat', 'Heat', { options: [option('h1', 'A cop')] })],
    moves: [{ id: 'mv-1', name: 'Network', descriptionText: null, required: false, isAdvanced: false, sortOrder: 0, bespokeSections: [section('bs-network', 'Network')] }],
  });

  it('groups in wizard step order, orders Rules by dot and keeps the server\'s order within a group', () => {
    const groups = groupOutstanding(
      [
        item('look', 'Look: 1 of 3 lines are unanswered.'),
        item('gear', 'Gear — Weapons: 0 of 2 picked.', { gearCategoryId: 'gc-weapons' }),
        item('rules', 'Heat: 0 of 2 picked.', { sectionId: 'bs-heat' }),
        item('moves', 'Moves: 0 of 2 picked.'),
        item('rules', 'Background: 0 of 1 picked.', { sectionId: 'bs-background' }),
        item('rules', 'Heat: name the people involved.', { sectionId: 'bs-heat' }),
        item('ratings', 'Choose a rating array.'),
        item('moves', 'Network: add a contact.', { sectionId: 'bs-network' }),
      ],
      playbook
    );

    expect(groups.map((group) => [group.label, group.lines.map((line) => line.message)])).toEqual([
      ['Ratings', ['Choose a rating array.']],
      ['Rules', ['Background: 0 of 1 picked.', 'Heat: 0 of 2 picked.', 'Heat: name the people involved.']],
      ['Moves', ['Moves: 0 of 2 picked.', 'Network: add a contact.']],
      ['Gear', ['Gear — Weapons: 0 of 2 picked.']],
      ['Look', ['Look: 1 of 3 lines are unanswered.']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupOutstanding([item('gear', 'Gear: 0 of 1 picked.')], playbook).map((group) => group.area)).toEqual(['gear']);
    expect(groupOutstanding([], playbook)).toEqual([]);
  });

  it.each<[string, HunterOutstandingItem, ReturnType<typeof linkFor>]>([
    ['ratings go to the Ratings step', item('ratings', 'x'), { step: HUNTER_STEP.ratings, sub: 0, anchor: null }],
    ['a rules line goes to its section\'s dot', item('rules', 'x', { sectionId: 'bs-heat' }), { step: HUNTER_STEP.rules, sub: 1, anchor: null }],
    ['the move count goes to Moves', item('moves', 'x'), { step: HUNTER_STEP.moves, sub: 0, anchor: null }],
    ['a move\'s own section goes to Moves and scrolls to it', item('moves', 'x', { sectionId: 'bs-network' }), { step: HUNTER_STEP.moves, sub: 0, anchor: 'hunter-section-bs-network' }],
    ['a gear line goes to Gear and scrolls to its list', item('gear', 'x', { gearCategoryId: 'gc-old' }), { step: HUNTER_STEP.gear, sub: 0, anchor: 'hunter-gear-gc-old' }],
    ['a gear line with no list goes to Gear', item('gear', 'x'), { step: HUNTER_STEP.gear, sub: 0, anchor: null }],
    ['a look line goes to the last step\'s look section', item('look', 'x'), { step: HUNTER_STEP.introductions, sub: 0, anchor: 'hunter-look' }],
    ['a rules line for a section not in the playbook gets no link', item('rules', 'x', { sectionId: 'bs-gone' }), null],
    ['a moves line for a section not in the playbook gets no link', item('moves', 'x', { sectionId: 'bs-gone' }), null],
  ])('%s', (_, outstanding, link) => {
    expect(linkFor(outstanding, playbook)).toEqual(link);
  });

  it('lists an unknown section\'s line under its area with no link, after the known ones', () => {
    const [rules] = groupOutstanding([item('rules', 'Gone: 0 of 1.', { sectionId: 'bs-gone' }), item('rules', 'Heat.', { sectionId: 'bs-heat' })], playbook);
    expect(rules.lines).toEqual([
      { message: 'Heat.', link: { step: HUNTER_STEP.rules, sub: 1, anchor: null } },
      { message: 'Gone: 0 of 1.', link: null },
    ]);
  });
});
