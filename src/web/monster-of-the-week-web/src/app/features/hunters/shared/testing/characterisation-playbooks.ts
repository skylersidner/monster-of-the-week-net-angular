import {
  BespokeJournalResponse,
  BespokeOptionResponse,
  BespokeSectionResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
} from '../../../../core/models';

/*
 * Inputs to the hunter request characterisation specs (hunter-creation-wizard.md 13.15 item 1).
 * Moved verbatim out of `hunter-form.characterisation.spec.ts` in Phase 7 (L17), so the edit-page
 * cases there and the create cases in `hunter-create.characterisation.spec.ts` share one copy. No app
 * code imports this. The expected requests stay in the specs, as literals.
 */

function option(id: string, title: string | null, extra: Partial<BespokeOptionResponse> = {}): BespokeOptionResponse {
  return { id, title, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [], ...extra };
}

function section(id: string, title: string, extra: Partial<BespokeSectionResponse> = {}): BespokeSectionResponse {
  return { id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [], ...extra };
}

/** Under the Required move, like The Searcher's First Encounter. */
export const encounterSection = section('bs-req-encounter', 'First Encounter', { freeTextLabel: 'What happened' });
export const artifactSection = section('bs-mva-artifact', 'Artifact', {
  minSelect: 1,
  maxSelect: 1,
  options: [
    option('bo-artifact-blade', '{{blank}} blade'),
    option('bo-artifact-charm', 'Charm', { descriptionText: 'Wards off {{blank}}' }),
  ],
});
/** Repeatable, under a pickable move, with a free-text line per entry. */
export const networkSection = section('bs-mvb-network', 'Network', {
  freeTextLabel: 'Contact',
  minInstances: 0,
  maxInstances: 3,
  options: [option('bo-net-favour', 'A favour', { descriptionText: 'Owes you {{blank}}' })],
});
/** Playbook-level, nested category plus numeric leaves. */
export const fateSection = section('bs-fate', 'Fate', {
  options: [
    option('cat-doom', 'Doom', {
      minSelect: 1,
      maxSelect: 1,
      children: [option('leaf-doom-betrayed', 'Betrayed'), option('leaf-doom-forgotten', 'Forgotten')],
    }),
    option('bo-favour', 'Infernal Favour', { numericMin: 0, numericMax: 3 }),
    option('bo-debt', 'Debt', { numericMin: 1, numericMax: 4 }),
    option('bo-marks', 'Marks', { numericMin: 0, numericMax: 5 }),
  ],
});
export const notesSection = section('bs-notes', 'Notes', { freeTextLabel: 'Notes' });
/** Playbook-level repeatable, like The Hex's Rotes. */
export const rotesSection = section('bs-rotes', 'Rotes', {
  minInstances: 0,
  options: [
    option('cat-req', 'Requirements', { children: [option('leaf-req-words', 'Words'), option('leaf-req-gestures', 'Gestures')] }),
    option('rote-named', '{{blank}}'),
  ],
});
export const killsJournal: BespokeJournalResponse = {
  id: 'j-kills',
  title: 'Kills',
  description: null,
  effectText: null,
  sortOrder: 0,
  fields: [
    { id: 'jf-what', label: 'What', sortOrder: 0 },
    { id: 'jf-where', label: 'Where', sortOrder: 1 },
  ],
};

export const charPlaybook: PlaybookDetailResponse = {
  id: 'pb-char',
  name: 'The Characterised',
  description: null,
  luckBoxCount: 7,
  luckSpecialText: null,
  harmUnstableThreshold: 4,
  harmBoxCount: 7,
  experienceBoxCount: 5,
  moveGrantCount: 3,
  gettingStartedText: null,
  introductionsText: null,
  levelingUpText: null,
  historyPromptsText: null,
  statArrayOptions: [
    { id: 'sa-1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 },
    { id: 'sa-2', charm: 2, cool: 1, sharp: 0, tough: 1, weird: -1, sortOrder: 1 },
  ],
  moves: [
    { id: 'mv-req', name: 'Required Move', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [encounterSection] },
    { id: 'mv-a', name: 'Move A', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [artifactSection] },
    { id: 'mv-b', name: 'Move B', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [networkSection] },
    { id: 'mv-c', name: 'Move C', descriptionText: null, required: false, isAdvanced: false, sortOrder: 3, bespokeSections: [] },
    { id: 'mv-adv', name: 'Advanced Move', descriptionText: null, required: false, isAdvanced: true, sortOrder: 4, bespokeSections: [] },
  ],
  gearCategories: [
    {
      id: 'gc-weapons',
      label: 'Weapons',
      pickCount: 2,
      isOptional: false,
      sortOrder: 0,
      options: [
        { id: 'go-shotgun', name: 'Shotgun', mechanicalText: null, sortOrder: 0 },
        { id: 'go-machete', name: 'Machete', mechanicalText: null, sortOrder: 1 },
        { id: 'go-pistol', name: 'Pistol', mechanicalText: null, sortOrder: 2 },
      ],
    },
    {
      id: 'gc-granted',
      label: 'You also get',
      pickCount: null,
      isOptional: false,
      sortOrder: 1,
      options: [{ id: 'go-car', name: 'A car', mechanicalText: null, sortOrder: 0 }],
    },
    {
      id: 'gc-extras',
      label: 'Extras',
      pickCount: 1,
      isOptional: true,
      sortOrder: 2,
      options: [{ id: 'go-kit', name: 'First aid kit', mechanicalText: null, sortOrder: 0 }],
    },
  ],
  lookCategories: [
    { id: 'lc-face', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo-face-haggard', text: 'haggard face', sortOrder: 0 }, { id: 'lo-face-bright', text: 'bright face', sortOrder: 1 }] },
    { id: 'lc-clothes', allowsFreeform: true, groupLabel: null, sortOrder: 1, options: [{ id: 'lo-clothes-neat', text: 'neat clothes', sortOrder: 0 }] },
    { id: 'lc-eyes', allowsFreeform: true, groupLabel: null, sortOrder: 2, options: [{ id: 'lo-eyes-cold', text: 'cold eyes', sortOrder: 0 }] },
    { id: 'lc-hands', allowsFreeform: true, groupLabel: null, sortOrder: 3, options: [{ id: 'lo-hands-scarred', text: 'scarred hands', sortOrder: 0 }] },
  ],
  improvements: [],
  bespokeSections: [fateSection, notesSection, rotesSection],
  bespokeJournals: [killsJournal],
  extraTracks: [
    { id: 'tr-corruption', name: 'Corruption', description: null, effectText: null, boxCount: 6, startLabel: null, endLabel: 'lost', sortOrder: 0 },
    { id: 'tr-glory', name: 'Glory', description: null, effectText: null, boxCount: 3, startLabel: null, endLabel: 'legend', sortOrder: 1 },
  ],
  pickRules: [],
};

/** Shares a few ids with `charPlaybook`, so prune's keep-what-is-valid filtering is visible. */
export const otherPlaybook: PlaybookDetailResponse = {
  ...charPlaybook,
  id: 'pb-other',
  name: 'The Other',
  statArrayOptions: [{ id: 'sa-other', charm: 0, cool: 0, sharp: 0, tough: 0, weird: 0, sortOrder: 0 }],
  moves: [
    charPlaybook.moves[1],
    { id: 'mv-x', name: 'Move X', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
  ],
  gearCategories: [{ ...charPlaybook.gearCategories[0], options: [charPlaybook.gearCategories[0].options[0]] }],
  lookCategories: [{ id: 'lc-face', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo-other-face', text: 'weathered face', sortOrder: 0 }] }],
  extraTracks: [charPlaybook.extraTracks[0]],
  bespokeSections: [notesSection],
  bespokeJournals: [],
};

export const playbooksById: Record<string, PlaybookDetailResponse> = { 'pb-char': charPlaybook, 'pb-other': otherPlaybook };

export const playbookList: PlaybookListItemResponse[] = [
  { id: 'pb-char', name: 'The Characterised', statArrayOptionCount: 2, moveCount: 5, bespokeSectionCount: 3 },
  { id: 'pb-other', name: 'The Other', statArrayOptionCount: 1, moveCount: 2, bespokeSectionCount: 1 },
];
