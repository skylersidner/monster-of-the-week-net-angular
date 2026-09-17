import {
  BespokeOptionResponse,
  BespokeSectionResponse,
  PlaybookDetailResponse,
  PlaybookPickRuleCountResponse,
} from '../../../../core/models';

/*
 * Spec fixtures shaped like the three playbooks a pick rule governs (hunter-creation-wizard.md
 * 12.9). Used by `hunter-pick-rules.spec.ts` and the section and form specs; no app code imports it.
 *
 * The governed targets, the trigger traditions, their sections and the rule labels carry the
 * seed's own ids and titles (12.9 "Migration and data delivery"), and the rules carry 12.9's data
 * tables exactly, so a failing spec reads straight against the real data. Everything else is
 * trimmed, with short ids. The seed's Natural Attacks leaves have no titles (their text is in the
 * description); here they get titles so specs can find their checkboxes.
 */

export function option(id: string, title: string | null, extra: Partial<BespokeOptionResponse> = {}): BespokeOptionResponse {
  return { id, title, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [], ...extra };
}

export function section(id: string, title: string, extra: Partial<BespokeSectionResponse> = {}): BespokeSectionResponse {
  return { id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [], ...extra };
}

export function buildPlaybook(overrides: Partial<PlaybookDetailResponse> = {}): PlaybookDetailResponse {
  return {
    id: 'pb-test', name: 'The Test Subject', description: null, luckBoxCount: 7, luckSpecialText: null,
    harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 0,
    gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
    statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [],
    bespokeSections: [], bespokeJournals: [], extraTracks: [], pickRules: [],
    ...overrides,
  };
}

function gearCount(id: string, min: number, max: number, adjustment: PlaybookPickRuleCountResponse['adjustment'] = null): PlaybookPickRuleCountResponse {
  return { gearCategoryId: id, bespokeOptionId: null, minCount: min, maxCount: max, adjustment };
}

function bespokeCount(id: string, min: number, max: number): PlaybookPickRuleCountResponse {
  return { gearCategoryId: null, bespokeOptionId: id, minCount: min, maxCount: max, adjustment: null };
}

// ---------------------------------------------------------------------------------------
// The Initiate: weapons, adjusted by Sect traditions (Q12)
// ---------------------------------------------------------------------------------------

export const INITIATE = {
  playbookId: 'a0c2b1dd-75e9-4c62-913a-e652e5f23df2',
  armour: 'b804a4e6-07b1-43cb-8c8a-a42c5aa3d6f7',
  oldFashioned: '4740273a-f878-4719-8c0e-2626cac2566f',
  modern: '524d08ca-da76-4d4e-8353-2317ab30419a',
  sect: '4807e089-a934-4e6c-8054-0ff246ac99d9',
  good: '3390c186-80b6-42eb-946d-15e8ed243628',
  bad: 'f03ceb1e-ce50-4367-bb24-513044fc2fb8',
  knowledgable: 'a15427cf-9396-4c2f-a497-d12bdcd291db',
  fightingArts: 'ceecaf7f-c871-422b-afa1-68ce91229274',
  modernised: 'ad188960-40d2-48f3-8782-3a8caded1ae2',
  niftyGadgets: '9e5b2d72-c55b-45d0-9e91-2f89ce29e798',
  dubiousMotives: '8cc66eb3-1acb-47d6-af3d-0b66ecdefe67',
  obsoleteGear: '86965ce9-cbb5-479b-985a-5a7bda562de2',
} as const;

export const OLD_FASHIONED_LABEL = 'Old-fashioned weapons (pick either two or three, as above)';
export const MODERN_LABEL = 'Modern weapons (pick either one or two, as above)';

export const initiatePlaybook: PlaybookDetailResponse = buildPlaybook({
  id: INITIATE.playbookId,
  name: 'The Initiate',
  gearCategories: [
    {
      id: INITIATE.armour, pickCount: null, isOptional: false, sortOrder: 0,
      label: 'If your Sect has fighting arts or obsolete gear (see next page) then pick three old-fashioned weapons. You also get old-fashioned armour (1-armour heavy).',
      options: [{ id: 'go-armour', name: 'Old-fashioned armour', mechanicalText: '1-armour heavy', sortOrder: 0 }],
    },
    {
      id: INITIATE.oldFashioned, label: OLD_FASHIONED_LABEL, pickCount: 3, isOptional: false, sortOrder: 1,
      options: [
        { id: 'of-sword', name: 'Sword', mechanicalText: null, sortOrder: 0 },
        { id: 'of-axe', name: 'Axe', mechanicalText: null, sortOrder: 1 },
        { id: 'of-staff', name: 'Staff', mechanicalText: null, sortOrder: 2 },
        { id: 'of-crossbow', name: 'Crossbow', mechanicalText: null, sortOrder: 3 },
      ],
    },
    {
      id: INITIATE.modern, label: MODERN_LABEL, pickCount: 2, isOptional: false, sortOrder: 2,
      options: [
        { id: 'mw-pistol', name: 'Pistol', mechanicalText: null, sortOrder: 0 },
        { id: 'mw-shotgun', name: 'Shotgun', mechanicalText: null, sortOrder: 1 },
        { id: 'mw-rifle', name: 'Rifle', mechanicalText: null, sortOrder: 2 },
      ],
    },
  ],
  bespokeSections: [
    section(INITIATE.sect, 'Sect', {
      minSelect: 2, maxSelect: 2,
      options: [
        option(INITIATE.good, 'Good Traditions', {
          minSelect: 2, maxSelect: 2, sortOrder: 0,
          children: [
            option(INITIATE.knowledgable, 'Knowledgable', { sortOrder: 0 }),
            option(INITIATE.fightingArts, 'Fighting arts', { sortOrder: 3 }),
            option(INITIATE.modernised, 'Modernised', { sortOrder: 4 }),
            option(INITIATE.niftyGadgets, 'Nifty gadgets', { sortOrder: 11 }),
          ],
        }),
        option(INITIATE.bad, 'Bad Traditions', {
          minSelect: 1, maxSelect: 1, sortOrder: 1,
          children: [
            option(INITIATE.dubiousMotives, 'Dubious motives', { sortOrder: 0 }),
            option(INITIATE.obsoleteGear, 'Obsolete gear', { sortOrder: 10 }),
          ],
        }),
      ],
    }),
  ],
  pickRules: [
    {
      id: 'rule-initiate', label: null, sortOrder: 0,
      alternatives: [
        {
          id: 'alt-initiate', label: null, sortOrder: 0,
          counts: [
            gearCount(INITIATE.oldFashioned, 2, 2, { triggerOptionIds: [INITIATE.fightingArts, INITIATE.obsoleteGear], minCount: 3, maxCount: 3 }),
            gearCount(INITIATE.modern, 1, 1, { triggerOptionIds: [INITIATE.modernised, INITIATE.niftyGadgets], minCount: 1, maxCount: 2 }),
          ],
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------------------
// The Monstrous: Natural Attacks (Q5)
// ---------------------------------------------------------------------------------------

export const MONSTROUS = {
  playbookId: '2a1efd73-1c2d-4472-9ace-3c30d9ec9300',
  naturalAttacks: 'ad9481a1-da22-4b26-bae2-0722dbef31bf',
  base: 'a6f63a15-cd9d-405d-a0a5-c25dab5ff742',
  extra: 'acbda577-8524-4905-8f0b-f53d74034cb8',
} as const;

export const NATURAL_ATTACKS_LABEL = 'Pick a Base and add an extra to it, or two Bases.';

export const monstrousPlaybook: PlaybookDetailResponse = buildPlaybook({
  id: MONSTROUS.playbookId,
  name: 'The Monstrous',
  bespokeSections: [
    section(MONSTROUS.naturalAttacks, 'Natural Attacks', {
      minSelect: 2, maxSelect: 2,
      options: [
        option(MONSTROUS.base, 'Base', {
          minSelect: 1, maxSelect: 2, sortOrder: 0,
          children: [
            option('nb-teeth', 'Teeth', { sortOrder: 0 }),
            option('nb-claws', 'Claws', { sortOrder: 1 }),
            option('nb-drain', 'Life-drain', { sortOrder: 2 }),
            option('nb-spit', 'Spit', { sortOrder: 3 }),
            option('nb-own-1', '{{blank}}', { sortOrder: 4 }),
            option('nb-own-2', '{{blank}}', { sortOrder: 5 }),
          ],
        }),
        option(MONSTROUS.extra, 'Extra', {
          minSelect: 0, maxSelect: 1, sortOrder: 1,
          children: [
            option('ne-harm', '+1 harm', { sortOrder: 0 }),
            option('ne-armour', 'Ignore armour', { sortOrder: 1 }),
            option('ne-reach', 'Long reach', { sortOrder: 2 }),
            option('ne-own', '{{blank}}', { sortOrder: 3 }),
          ],
        }),
      ],
    }),
  ],
  pickRules: [
    {
      id: 'rule-monstrous', label: NATURAL_ATTACKS_LABEL, sortOrder: 0,
      alternatives: [
        { id: 'alt-monstrous-1', label: null, sortOrder: 0, counts: [bespokeCount(MONSTROUS.base, 1, 1), bespokeCount(MONSTROUS.extra, 1, 1)] },
        { id: 'alt-monstrous-2', label: null, sortOrder: 1, counts: [bespokeCount(MONSTROUS.base, 2, 2), bespokeCount(MONSTROUS.extra, 0, 0)] },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------------------
// The Spell-Slinger: Combat Magic (Q5)
// ---------------------------------------------------------------------------------------

export const SPELL_SLINGER = {
  playbookId: '6bd4946f-05aa-4c5b-a8d9-a634f95a1033',
  combatMagic: '2ced7a94-a54b-42ae-bbb6-986dc379ccbd',
  bases: '37b4d08c-d079-4c71-a4d1-3e84eebad8b1',
  effects: '22e7c964-efe0-4f2b-af92-986fb1184aed',
} as const;

export const COMBAT_MAGIC_LABEL = 'Pick three (with at least one base).';

export const spellSlingerPlaybook: PlaybookDetailResponse = buildPlaybook({
  id: SPELL_SLINGER.playbookId,
  name: 'The Spell-Slinger',
  bespokeSections: [
    section(SPELL_SLINGER.combatMagic, 'Combat Magic', {
      minSelect: 2, maxSelect: 2,
      options: [
        option(SPELL_SLINGER.bases, 'Bases', {
          minSelect: 1, maxSelect: 3, sortOrder: 0,
          children: [
            option('cb-blast', 'Blast', { sortOrder: 0 }),
            option('cb-ball', 'Ball', { sortOrder: 1 }),
            option('cb-missile', 'Missile', { sortOrder: 2 }),
            option('cb-wall', 'Wall', { sortOrder: 3 }),
          ],
        }),
        option(SPELL_SLINGER.effects, 'Effects', {
          minSelect: 0, maxSelect: 3, sortOrder: 1,
          children: [
            option('ce-fire', 'Fire', { sortOrder: 0 }),
            option('ce-force', 'Force or Wind', { sortOrder: 1 }),
            option('ce-lightning', 'Lightning or Entropy', { sortOrder: 2 }),
            option('ce-frost', 'Frost or Ice', { sortOrder: 3 }),
            option('ce-earth', 'Earth', { sortOrder: 4 }),
            option('ce-necro', 'Necromantic', { sortOrder: 5 }),
          ],
        }),
      ],
    }),
  ],
  pickRules: [
    {
      id: 'rule-spell-slinger', label: COMBAT_MAGIC_LABEL, sortOrder: 0,
      alternatives: [
        { id: 'alt-ss-1', label: null, sortOrder: 0, counts: [bespokeCount(SPELL_SLINGER.bases, 3, 3), bespokeCount(SPELL_SLINGER.effects, 0, 0)] },
        { id: 'alt-ss-2', label: null, sortOrder: 1, counts: [bespokeCount(SPELL_SLINGER.bases, 2, 2), bespokeCount(SPELL_SLINGER.effects, 1, 1)] },
        { id: 'alt-ss-3', label: null, sortOrder: 2, counts: [bespokeCount(SPELL_SLINGER.bases, 1, 1), bespokeCount(SPELL_SLINGER.effects, 2, 2)] },
      ],
    },
  ],
});
