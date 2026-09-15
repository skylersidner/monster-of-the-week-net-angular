import { PlaybookDetailResponse } from '../../../core/models';
import {
  TargetPicks,
  doesNotFitNotice,
  effectiveRange,
  engagedChildCount,
  fits,
  formatRange,
  hasRoomFor,
  indexPickRules,
  isMet,
  isShort,
  overLimitNotice,
  strandedLists,
  unansweredTriggerSections,
  unfiredAdjustmentHint,
} from './hunter-pick-rules';
import {
  COMBAT_MAGIC_LABEL,
  INITIATE,
  MODERN_LABEL,
  MONSTROUS,
  NATURAL_ATTACKS_LABEL,
  OLD_FASHIONED_LABEL,
  SPELL_SLINGER,
  initiatePlaybook,
  monstrousPlaybook,
  spellSlingerPlaybook,
} from './testing/pick-rule-playbooks';

/*
 * `hunter-pick-rules.ts`, driven from 12.9's build tables (13.15 item 3). Bowser's `PickRulesTests`
 * use the same rows, so both copies of the rule are checked against one source.
 *
 * "finished" = fits and met; "reported" = fits (accepted on save) but not met; "refused" = fits no
 * alternative.
 */

type Build = readonly [number, number];

const set = (...ids: string[]): ReadonlySet<string> => new Set(ids);

function outcome(rule: PlaybookDetailResponse['pickRules'][number], picks: TargetPicks, triggers: ReadonlySet<string>): string {
  if (!fits(rule, picks, triggers)) return 'refused';
  return isMet(rule, picks, triggers) ? 'finished' : 'reported';
}

// ---------------------------------------------------------------------------------------
// The Initiate
// ---------------------------------------------------------------------------------------

describe('pick rules: the Initiate (12.9, Q12)', () => {
  const rule = initiatePlaybook.pickRules[0];
  const [oldCount, modernCount] = rule.alternatives[0].counts;
  const weapons = ([old, modern]: Build): TargetPicks => new Map([[INITIATE.oldFashioned, old], [INITIATE.modern, modern]]);

  const rows = [
    {
      sect: 'none of the four, including a Sect not yet answered',
      traditions: [set(), set(INITIATE.knowledgable, INITIATE.dubiousMotives)],
      old: '2–2', modern: '1–1',
      finished: [[2, 1]], reported: [[1, 1], [2, 0]], refused: [[3, 1], [2, 2]],
    },
    {
      sect: 'Fighting arts or Obsolete gear, but not Modernised or Nifty gadgets',
      traditions: [set(INITIATE.fightingArts), set(INITIATE.obsoleteGear), set(INITIATE.fightingArts, INITIATE.obsoleteGear)],
      old: '3–3', modern: '1–1',
      finished: [[3, 1]], reported: [[2, 1], [3, 0]], refused: [[3, 2]],
    },
    {
      sect: 'Modernised or Nifty gadgets, but not Fighting arts or Obsolete gear',
      traditions: [set(INITIATE.modernised), set(INITIATE.niftyGadgets), set(INITIATE.modernised, INITIATE.niftyGadgets)],
      old: '2–2', modern: '1–2',
      finished: [[2, 1], [2, 2]], reported: [[1, 2], [2, 0]], refused: [[3, 1]],
    },
    {
      sect: 'traditions from both groups',
      traditions: [set(INITIATE.fightingArts, INITIATE.modernised), set(INITIATE.niftyGadgets, INITIATE.obsoleteGear)],
      old: '3–3', modern: '1–2',
      finished: [[3, 1], [3, 2]], reported: [[2, 2], [3, 0]], refused: [],
    },
  ] as const;

  const range = (r: { min: number; max: number }): string => `${r.min}–${r.max}`;

  describe.each(rows)('Sect has $sect', (row) => {
    it.each(row.traditions.map((t) => [[...t].length, t] as const))('effective ranges with %i tradition(s) picked', (_n, traditions) => {
      expect(range(effectiveRange(oldCount, traditions))).toBe(row.old);
      expect(range(effectiveRange(modernCount, traditions))).toBe(row.modern);
    });

    it('classifies every build in the row as the table does', () => {
      for (const traditions of row.traditions) {
        for (const build of row.finished) expect(outcome(rule, weapons(build), traditions), `${build}`).toBe('finished');
        for (const build of row.reported) expect(outcome(rule, weapons(build), traditions), `${build}`).toBe('reported');
        for (const build of row.refused) expect(outcome(rule, weapons(build), traditions), `${build}`).toBe('refused');
      }
    });
  });

  it('with traditions from both groups, refuses nothing within the category caps (3 and 2)', () => {
    for (let old = 0; old <= 3; old++) {
      for (let modern = 0; modern <= 2; modern++) {
        expect(fits(rule, weapons([old, modern]), set(INITIATE.fightingArts, INITIATE.modernised))).toBe(true);
      }
    }
  });

  it('with Modernised: 2 + 1 and 2 + 2 fit, 1 + 2 is short on old-fashioned only, 3 + 1 does not fit (13.15)', () => {
    const modernised = set(INITIATE.modernised);
    expect(fits(rule, weapons([2, 1]), modernised)).toBe(true);
    expect(fits(rule, weapons([2, 2]), modernised)).toBe(true);
    expect(isShort(rule, INITIATE.oldFashioned, weapons([1, 2]), modernised)).toBe(true);
    expect(isShort(rule, INITIATE.modern, weapons([1, 2]), modernised)).toBe(false);
    expect(fits(rule, weapons([3, 1]), modernised)).toBe(false);
  });

  it('isShort: nothing is short on a finished build, and an over-limit list does not make the other one short', () => {
    expect(isShort(rule, INITIATE.oldFashioned, weapons([2, 1]), set())).toBe(false);
    expect(isShort(rule, INITIATE.modern, weapons([2, 1]), set())).toBe(false);
    expect(isShort(rule, INITIATE.modern, weapons([3, 1]), set())).toBe(false);
    expect(isShort(rule, INITIATE.modern, weapons([3, 0]), set())).toBe(true);
  });

  it('hasRoomFor is "picks below this list\'s effective maximum"', () => {
    expect(hasRoomFor(rule, INITIATE.oldFashioned, weapons([2, 0]), set())).toBe(false);
    expect(hasRoomFor(rule, INITIATE.modern, weapons([2, 0]), set())).toBe(true);
    expect(hasRoomFor(rule, INITIATE.modern, weapons([1, 1]), set())).toBe(false);
    expect(hasRoomFor(rule, INITIATE.oldFashioned, weapons([2, 1]), set(INITIATE.obsoleteGear))).toBe(true);
    expect(hasRoomFor(rule, INITIATE.oldFashioned, weapons([3, 1]), set(INITIATE.obsoleteGear))).toBe(false);
    expect(hasRoomFor(rule, INITIATE.modern, weapons([2, 1]), set(INITIATE.niftyGadgets))).toBe(true);
    expect(hasRoomFor(rule, INITIATE.modern, weapons([2, 2]), set(INITIATE.niftyGadgets))).toBe(false);
    expect(hasRoomFor(rule, 'not-a-target', weapons([0, 0]), set())).toBe(false);
  });

  it('adding a trigger tradition never makes a build stop fitting; removing one can (S5, L24)', () => {
    const triggers = [INITIATE.fightingArts, INITIATE.obsoleteGear, INITIATE.modernised, INITIATE.niftyGadgets];
    for (let mask = 0; mask < 16; mask++) {
      const before = new Set(triggers.filter((_, i) => mask & (1 << i)));
      for (const added of triggers.filter((t) => !before.has(t))) {
        const after = new Set([...before, added]);
        for (let old = 0; old <= 3; old++) {
          for (let modern = 0; modern <= 2; modern++) {
            if (fits(rule, weapons([old, modern]), before)) {
              expect(fits(rule, weapons([old, modern]), after)).toBe(true);
            }
          }
        }
      }
    }

    expect(fits(rule, weapons([3, 1]), set(INITIATE.fightingArts))).toBe(true);
    expect(fits(rule, weapons([3, 1]), set())).toBe(false);
    expect(fits(rule, weapons([2, 2]), set(INITIATE.modernised))).toBe(true);
    expect(fits(rule, weapons([2, 2]), set(INITIATE.knowledgable))).toBe(false);
  });

  describe('wording, built from data (L25, L30, L24; Y16)', () => {
    const index = indexPickRules(initiatePlaybook);
    const sect = initiatePlaybook.bespokeSections[0];

    it('names the traditions that would allow more while an adjustment has not fired, and nothing once it has', () => {
      expect(unfiredAdjustmentHint(index, oldCount, set())).toBe('Fighting arts or Obsolete gear (Sect) allow 3.');
      expect(unfiredAdjustmentHint(index, modernCount, set())).toBe('Modernised or Nifty gadgets (Sect) allow 1–2.');
      expect(unfiredAdjustmentHint(index, oldCount, set(INITIATE.obsoleteGear))).toBeNull();
      expect(unfiredAdjustmentHint(index, modernCount, set(INITIATE.obsoleteGear))).not.toBeNull();
    });

    it('adds "This depends on your Sect picks." only while the Sect has no picks at all, not when partly answered (Y16)', () => {
      expect(unansweredTriggerSections(index, oldCount, set(), () => false)).toEqual([{ sectionId: INITIATE.sect, sectionTitle: 'Sect' }]);
      // One non-trigger Good tradition: partly answered, so the sentence goes.
      expect(unansweredTriggerSections(index, oldCount, set(INITIATE.knowledgable), () => true)).toEqual([]);
      expect(unansweredTriggerSections(index, oldCount, set(INITIATE.fightingArts), () => true)).toEqual([]);
    });

    it('L30: "Only 2 allowed with your Sect picks."', () => {
      expect(overLimitNotice(index, oldCount, set())).toBe('Only 2 allowed with your Sect picks.');
      expect(overLimitNotice(index, modernCount, set(INITIATE.modernised))).toBe('Only 2 allowed with your Sect picks.');
    });

    it('L24: names each list a Sect change has stranded, and nothing when a tradition allows the picks', () => {
      const picksOf = (build: Build) => () => weapons(build);

      expect(strandedLists(index, sect, picksOf([3, 1]), set())).toEqual([
        { targetId: INITIATE.oldFashioned, message: `${OLD_FASHIONED_LABEL}: 3 picked, but your Sect picks now allow 2.` },
      ]);
      expect(strandedLists(index, sect, picksOf([3, 2]), set(INITIATE.fightingArts))).toEqual([
        { targetId: INITIATE.modern, message: `${MODERN_LABEL}: 2 picked, but your Sect picks now allow 1.` },
      ]);
      expect(strandedLists(index, sect, picksOf([3, 2]), set(INITIATE.fightingArts, INITIATE.niftyGadgets))).toEqual([]);
      expect(strandedLists(indexPickRules(monstrousPlaybook), monstrousPlaybook.bespokeSections[0], picksOf([3, 2]), set())).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------------------
// Natural Attacks and Combat Magic
// ---------------------------------------------------------------------------------------

describe('pick rules: Natural Attacks (12.9, Q5)', () => {
  const rule = monstrousPlaybook.pickRules[0];
  const attacks = ([base, extra]: Build): TargetPicks => new Map([[MONSTROUS.base, base], [MONSTROUS.extra, extra]]);

  it.each<[Build, string]>([
    [[1, 1], 'finished'],
    [[2, 0], 'finished'],
    [[1, 0], 'reported'],
    [[0, 1], 'reported'],
    [[0, 0], 'reported'],
    [[2, 1], 'refused'],
    [[3, 0], 'refused'],
    [[0, 2], 'refused'],
  ])('Base + Extra %j is %s', (build, expected) => {
    expect(outcome(rule, attacks(build), set())).toBe(expected);
  });

  it('hasRoomFor looks across both alternatives: a second Base or an Extra after one Base, and nothing after 1 + 1 or 2 + 0', () => {
    expect(hasRoomFor(rule, MONSTROUS.base, attacks([1, 0]), set())).toBe(true);
    expect(hasRoomFor(rule, MONSTROUS.extra, attacks([1, 0]), set())).toBe(true);
    expect(hasRoomFor(rule, MONSTROUS.base, attacks([0, 1]), set())).toBe(true);
    expect(hasRoomFor(rule, MONSTROUS.extra, attacks([0, 1]), set())).toBe(false);
    for (const build of [[1, 1], [2, 0]] as const) {
      expect(hasRoomFor(rule, MONSTROUS.base, attacks(build), set())).toBe(false);
      expect(hasRoomFor(rule, MONSTROUS.extra, attacks(build), set())).toBe(false);
    }
  });

  it('counts write-your-own Base slots like any other option (BespokeEngagement.CountUnder)', () => {
    const base = monstrousPlaybook.bespokeSections[0].options[0];
    const picked = set('nb-own-1', 'nb-own-2');

    expect(engagedChildCount(base, picked)).toBe(2);
    expect(outcome(rule, attacks([engagedChildCount(base, picked), 0]), set())).toBe('finished');
  });

  it('L30: "These picks don\'t fit: {rule label}"', () => {
    expect(doesNotFitNotice(rule)).toBe(`These picks don't fit: ${NATURAL_ATTACKS_LABEL}`);
  });
});

describe('pick rules: Combat Magic (12.9, Q5)', () => {
  const rule = spellSlingerPlaybook.pickRules[0];
  const spells = ([bases, effects]: Build): TargetPicks => new Map([[SPELL_SLINGER.bases, bases], [SPELL_SLINGER.effects, effects]]);

  it.each<[Build, string]>([
    [[3, 0], 'finished'],
    [[2, 1], 'finished'],
    [[1, 2], 'finished'],
    [[1, 1], 'reported'],
    [[2, 0], 'reported'],
    [[1, 0], 'reported'],
    [[0, 2], 'reported'],
    [[0, 1], 'reported'],
    [[0, 3], 'refused'],
    [[3, 1], 'refused'],
    [[2, 2], 'refused'],
    [[1, 3], 'refused'],
    [[3, 3], 'refused'],
  ])('Bases + Effects %j is %s', (build, expected) => {
    expect(outcome(rule, spells(build), set())).toBe(expected);
  });

  it('a fourth spell has no room anywhere (Q10: a level-up pick stays disabled)', () => {
    for (const build of [[3, 0], [2, 1], [1, 2]] as const) {
      expect(hasRoomFor(rule, SPELL_SLINGER.bases, spells(build), set())).toBe(false);
      expect(hasRoomFor(rule, SPELL_SLINGER.effects, spells(build), set())).toBe(false);
    }
    expect(hasRoomFor(rule, SPELL_SLINGER.effects, spells([1, 1]), set())).toBe(true);
    expect(hasRoomFor(rule, SPELL_SLINGER.bases, spells([0, 2]), set())).toBe(true);
    expect(hasRoomFor(rule, SPELL_SLINGER.effects, spells([0, 2]), set())).toBe(false);
  });

  it('isShort only where every fitting alternative wants more on that target', () => {
    expect(isShort(rule, SPELL_SLINGER.bases, spells([0, 2]), set())).toBe(true);
    expect(isShort(rule, SPELL_SLINGER.effects, spells([0, 2]), set())).toBe(false);
    expect(isShort(rule, SPELL_SLINGER.bases, spells([1, 1]), set())).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------------------

describe('indexPickRules (13.5)', () => {
  it('classifies a gear rule, names its lists from their labels, and resolves each trigger to its title and section', () => {
    const index = indexPickRules(initiatePlaybook);

    expect(index.rules).toHaveLength(1);
    expect(index.rules[0].kind).toBe('gear');
    expect(index.rules[0].section).toBeNull();
    expect(index.rules[0].targetIds).toEqual([INITIATE.oldFashioned, INITIATE.modern]);
    expect([...index.rules[0].targetNames.values()]).toEqual([OLD_FASHIONED_LABEL, MODERN_LABEL]);
    expect(index.byTarget.get(INITIATE.modern)).toBe(index.rules[0]);
    expect(index.bySection.size).toBe(0);
    expect(index.triggers.get(INITIATE.obsoleteGear)).toEqual({
      optionId: INITIATE.obsoleteGear, title: 'Obsolete gear', sectionId: INITIATE.sect, sectionTitle: 'Sect',
    });
    expect(index.triggers.size).toBe(4);
  });

  it('classifies a bespoke rule and finds its section through the counts\' bespokeOptionId', () => {
    const index = indexPickRules(spellSlingerPlaybook);

    expect(index.rules[0].kind).toBe('bespoke');
    expect(index.rules[0].section?.id).toBe(SPELL_SLINGER.combatMagic);
    expect(index.bySection.get(SPELL_SLINGER.combatMagic)?.rule.label).toBe(COMBAT_MAGIC_LABEL);
    expect([...index.rules[0].targetNames.values()]).toEqual(['Bases', 'Effects']);
    expect(index.triggers.size).toBe(0);
  });

  it('has no rules for no playbook, or for a playbook response without pickRules', () => {
    expect(indexPickRules(null).rules).toEqual([]);
    const withoutKey = { ...monstrousPlaybook, pickRules: undefined } as unknown as PlaybookDetailResponse;
    expect(indexPickRules(withoutKey).rules).toEqual([]);
  });

  it('formatRange: a single number when min = max, otherwise an en-dash range', () => {
    expect(formatRange({ min: 3, max: 3 })).toBe('3');
    expect(formatRange({ min: 1, max: 2 })).toBe('1–2');
  });
});
