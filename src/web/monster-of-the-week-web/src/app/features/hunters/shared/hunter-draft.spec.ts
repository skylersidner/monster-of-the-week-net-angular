import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BespokeOptionResponse,
  BespokeSectionResponse,
  HunterDetailResponse,
  PlaybookDetailResponse,
  UpsertHunterRequest,
} from '../../../core/models';
import { PlaybookService } from '../../../core/playbook';
import { HunterDraft } from './hunter-draft';
import { HunterFormComponent } from './hunter-form/hunter-form';

/**
 * `HunterDraft` on its own, with no component (hunter-creation-wizard.md 13.15 item 2, the parts
 * Phase 4 builds). The end-to-end request is pinned by `hunter-form.characterisation.spec.ts`.
 */

function option(id: string, title: string, extra: Partial<BespokeOptionResponse> = {}): BespokeOptionResponse {
  return { id, title, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [], ...extra };
}

function section(id: string, title: string, extra: Partial<BespokeSectionResponse> = {}): BespokeSectionResponse {
  return { id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [], ...extra };
}

const moveEntries = section('bs-move-entries', 'Contacts', { freeTextLabel: 'Contact', minInstances: 0, options: [option('bo-move-entry', 'A favour')] });
const moveFlat = section('bs-move-flat', 'Artifact', { options: [option('bo-move-flat', 'A blade')] });
const numericSection = section('bs-numeric', 'The Show', { options: [option('bo-num', 'Infernal Favour', { numericMin: 0, numericMax: 3 })] });
const rotes = section('bs-rotes', 'Rotes', { minInstances: 0, options: [option('rote-a', 'Words')] });

const playbook: PlaybookDetailResponse = {
  id: 'pb1',
  name: 'The Test Subject',
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
  statArrayOptions: [{ id: 'sa1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 }],
  moves: [
    { id: 'mv-req', name: 'Granted', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [] },
    { id: 'mv1', name: 'With sections', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [moveEntries, moveFlat] },
    { id: 'mv2', name: 'Plain', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [] },
  ],
  gearCategories: [
    {
      id: 'gc-pick',
      label: 'Weapons',
      pickCount: 1,
      isOptional: false,
      sortOrder: 0,
      options: [
        { id: 'go1', name: 'Shotgun', mechanicalText: null, sortOrder: 0 },
        { id: 'go2', name: 'Machete', mechanicalText: null, sortOrder: 1 },
      ],
    },
    {
      id: 'gc-granted',
      label: 'You get',
      pickCount: null,
      isOptional: false,
      sortOrder: 1,
      options: [{ id: 'go-granted', name: 'A car', mechanicalText: null, sortOrder: 0 }],
    },
  ],
  lookCategories: [{ id: 'lc1', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo1', text: 'haggard', sortOrder: 0 }] }],
  improvements: [],
  bespokeSections: [numericSection, rotes],
  bespokeJournals: [{ id: 'j1', title: 'Journal', description: null, effectText: null, sortOrder: 0, fields: [{ id: 'jf1', label: 'What', sortOrder: 0 }] }],
  extraTracks: [{ id: 'tr1', name: 'Corruption', description: null, effectText: null, boxCount: 5, startLabel: null, endLabel: 'lost', sortOrder: 0 }],
  pickRules: [],
};

const hunter: HunterDetailResponse = {
  id: 'h1',
  name: 'Saved',
  pronouns: 'they/them',
  playbookId: 'pb1',
  playbookName: 'The Test Subject',
  playbookStatArrayOptionId: 'sa1',
  luck: 1,
  harm: 2,
  experience: 3,
  background: 'Notes',
  playbookMoveIds: ['mv-req', 'mv1'],
  playbookGearOptionIds: ['go-granted', 'go2'],
  looks: [{ lookCategoryId: 'lc1', lookOptionId: null, freeformText: 'tall' }],
  extraTracks: [{ extraTrackId: 'tr1', currentValue: 4 }],
  bespokeSelections: [{ sectionId: 'bs-numeric', bespokeOptionId: 'bo-num', freeformTitle: null, freeformText: null, numericValue: 2 }],
  bespokeInstances: [
    {
      id: 'inst-1',
      sectionId: 'bs-rotes',
      name: 'Ward',
      sortOrder: 0,
      selections: [{ sectionId: 'bs-rotes', bespokeOptionId: 'rote-a', freeformTitle: null, freeformText: null, numericValue: null }],
    },
  ],
  journalEntries: [{ id: 'je-1', journalId: 'j1', sortOrder: 0, fields: [{ journalFieldId: 'jf1', text: 'A ghoul' }] }],
  outstanding: [],
  createdAt: '2026-09-14T00:00:00Z',
};

describe('HunterDraft', () => {
  let draft: HunterDraft;

  beforeEach(() => {
    draft = TestBed.runInInjectionContext(() => new HunterDraft());
  });

  /** What a consumer does on the edit page: populate, then the load sets the playbook and prunes. */
  function loadSaved(): void {
    draft.populate(hunter);
    draft.playbook.set(playbook);
    draft.prune(playbook);
  }

  it('reads the form through getRawValue, so a populated hunter\'s disabled playbookId is still read and sent', () => {
    draft.populate(hunter);

    expect(draft.form.controls.playbookId.disabled).toBe(true);
    // The trap: .value drops a disabled control entirely.
    expect(draft.form.value.playbookId).toBeUndefined();
    expect(draft.formValue().playbookId).toBe('pb1');
    expect(draft.toRequest().playbookId).toBe('pb1');
  });

  it('keeps formValue in step with form writes, and isRatingUnchosen follows it rather than a control', () => {
    draft.playbook.set(playbook);
    expect(draft.isRatingUnchosen()).toBe(true);

    draft.form.controls.playbookStatArrayOptionId.setValue('sa1');
    expect(draft.formValue().playbookStatArrayOptionId).toBe('sa1');
    expect(draft.isRatingUnchosen()).toBe(false);

    draft.form.controls.name.setValue('Typed');
    expect(draft.formValue().name).toBe('Typed');

    // No playbook, no rating arrays to choose from.
    draft.playbook.set(null);
    expect(draft.isRatingUnchosen()).toBe(false);
  });

  it('builds the request with no component: a saved hunter round-trips through populate and prune', () => {
    loadSaved();

    expect(draft.toRequest()).toStrictEqual({
      name: 'Saved',
      pronouns: 'they/them',
      playbookId: 'pb1',
      playbookStatArrayOptionId: 'sa1',
      luck: 1,
      harm: 2,
      experience: 3,
      background: 'Notes',
      playbookMoveIds: ['mv-req', 'mv1'],
      playbookGearOptionIds: ['go-granted', 'go2'],
      looks: [{ lookCategoryId: 'lc1', lookOptionId: null, freeformText: 'tall' }],
      extraTracks: [{ extraTrackId: 'tr1', currentValue: 4 }],
      bespokeSelections: [{ sectionId: 'bs-numeric', bespokeOptionId: 'bo-num', freeformTitle: null, freeformText: null, numericValue: 2 }],
      bespokeInstances: [
        {
          id: 'inst-1',
          sectionId: 'bs-rotes',
          name: 'Ward',
          sortOrder: 0,
          selections: [{ sectionId: 'bs-rotes', bespokeOptionId: 'rote-a', freeformTitle: null, freeformText: null, numericValue: null }],
        },
      ],
      journalEntries: [{ id: 'je-1', journalId: 'j1', sortOrder: 0, fields: [{ journalFieldId: 'jf1', text: 'A ghoul' }] }],
    } satisfies UpsertHunterRequest);
  });

  it('keeps every saved pick when the edit page re-applies the same playbook', () => {
    draft.playbook.set(playbook);
    draft.populate(hunter);
    const before = draft.toRequest();

    draft.prune(playbook);

    expect(draft.toRequest()).toStrictEqual(before);
  });

  it('a fresh draft is the empty hunter the wizard starts from, with the playbook picker enabled', () => {
    // `populate(null)` was the single-page create's reset; it went with create mode (L17).
    expect(draft.form.controls.playbookId.enabled).toBe(true);
    expect(draft.playbook()).toBeNull();
    expect(draft.toRequest()).toStrictEqual({
      name: '',
      pronouns: null,
      playbookId: '',
      playbookStatArrayOptionId: null,
      luck: 0,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: [],
      playbookGearOptionIds: [],
      looks: [],
      extraTracks: [],
      bespokeSelections: [],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('starts a freshly ticked numeric leaf at NumericMax, and keeps a value the player set on re-tick (L14)', () => {
    draft.playbook.set(playbook);

    draft.toggleBespoke('bs-numeric', 'bo-num');
    expect(draft.answersFor('bs-numeric').get('bo-num')).toStrictEqual({ freeformTitle: '', freeformText: '', numericValue: 3 });

    draft.setBespokeAnswer('bs-numeric', { optionId: 'bo-num', field: 'numeric', value: '1' });
    draft.toggleBespoke('bs-numeric', 'bo-num');
    draft.toggleBespoke('bs-numeric', 'bo-num');

    expect(draft.toRequest().bespokeSelections).toStrictEqual([
      { sectionId: 'bs-numeric', bespokeOptionId: 'bo-num', freeformTitle: null, freeformText: null, numericValue: 1 },
    ]);
  });

  it('untick clear: drops the unticked move\'s section entries, picks, answers and free text, and nothing else', () => {
    draft.playbook.set(playbook);
    draft.toggleMove('mv1');

    draft.addInstance(moveEntries);
    const [entry] = draft.instancesFor(moveEntries);
    draft.toggleBespoke(entry.key, 'bo-move-entry');
    draft.setBespokeAnswer(entry.key, { optionId: 'bo-move-entry', field: 'text', value: 'owed' });
    draft.setFreeText(entry.key, 'Byers');
    draft.toggleBespoke('bs-move-flat', 'bo-move-flat');
    draft.toggleBespoke('bs-numeric', 'bo-num');
    draft.addInstance(rotes);
    const [rote] = draft.instancesFor(rotes);
    draft.toggleBespoke(rote.key, 'rote-a');

    // A move with no sections clears nothing when unticked.
    draft.toggleMove('mv2');
    draft.toggleMove('mv2');
    expect(draft.picksFor('bs-move-flat').has('bo-move-flat')).toBe(true);

    draft.toggleMove('mv1');

    expect(draft.instancesFor(moveEntries)).toEqual([]);
    expect(draft.picksFor(entry.key).size).toBe(0);
    expect(draft.answersFor(entry.key).size).toBe(0);
    expect(draft.freeTextFor(entry.key)).toBe('');
    expect(draft.picksFor('bs-move-flat').size).toBe(0);
    // Playbook-level scopes are untouched.
    expect(draft.picksFor('bs-numeric').has('bo-num')).toBe(true);
    expect(draft.picksFor(rote.key).has('rote-a')).toBe(true);

    // Re-ticking starts empty; nothing is restored.
    draft.toggleMove('mv1');
    expect(draft.instancesFor(moveEntries)).toEqual([]);
    expect(draft.picksFor('bs-move-flat').size).toBe(0);
  });

  it('prune on a playbook switch keeps what the new playbook has, drops the rest, and clears a rating it does not offer', () => {
    loadSaved();
    const other: PlaybookDetailResponse = {
      ...playbook,
      id: 'pb2',
      statArrayOptions: [{ ...playbook.statArrayOptions[0], id: 'sa2' }],
      moves: [playbook.moves[1]],
      gearCategories: [playbook.gearCategories[1]],
      lookCategories: [],
      extraTracks: [],
      bespokeSections: [numericSection],
      bespokeJournals: [],
    };

    draft.playbook.set(other);
    draft.prune(other);

    expect(draft.form.controls.playbookStatArrayOptionId.value).toBe('');
    const request = draft.toRequest();
    expect(request.name).toBe('Saved');
    expect(request.luck).toBe(1);
    expect(request.playbookStatArrayOptionId).toBeNull();
    expect(request.playbookMoveIds).toEqual(['mv1']);
    expect(request.playbookGearOptionIds).toEqual(['go-granted']);
    expect(request.looks).toEqual([]);
    expect(request.extraTracks).toEqual([]);
    expect(request.bespokeSelections).toEqual([
      { sectionId: 'bs-numeric', bespokeOptionId: 'bo-num', freeformTitle: null, freeformText: null, numericValue: 2 },
    ]);
    expect(request.bespokeInstances).toEqual([]);
    expect(request.journalEntries).toEqual([]);
  });

  it('never adds granted gear ids, and leaves an already-saved one alone (B6, L15)', () => {
    draft.playbook.set(playbook);
    draft.toggleGear('go1');

    expect(draft.toRequest().playbookGearOptionIds).toEqual(['go1']);
    expect(draft.isGearPickShort(playbook.gearCategories[1])).toBe(false);

    loadSaved();
    expect(draft.toRequest().playbookGearOptionIds).toEqual(['go-granted', 'go2']);
  });

  it('gives two new entries of the same section distinct local keys and no server id', () => {
    draft.playbook.set(playbook);
    draft.addInstance(rotes);
    draft.addInstance(rotes);

    const [first, second] = draft.instancesFor(rotes);
    expect(first.key).not.toBe(second.key);
    expect(draft.toRequest().bespokeInstances.map((i) => i.id)).toEqual([null, null]);
  });
});

describe('HunterDraft provisioning', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HunterFormComponent],
      providers: [{ provide: PlaybookService, useValue: { getById: () => of(playbook) } }],
    }).compileComponents();
  });

  it('is not a root singleton: each HunterFormComponent provides and uses its own draft', () => {
    expect(() => TestBed.inject(HunterDraft)).toThrow();

    const first = TestBed.createComponent(HunterFormComponent);
    const second = TestBed.createComponent(HunterFormComponent);
    const firstDraft = first.debugElement.injector.get(HunterDraft);

    expect(firstDraft).toBe(first.componentInstance.draft);
    expect(firstDraft).not.toBe(second.debugElement.injector.get(HunterDraft));

    first.componentInstance.draft.form.controls.name.setValue('Only here');
    expect(second.componentInstance.draft.form.controls.name.value).toBe('');
  });
});

describe('HunterDraft: dirty state and the playbook-scoped summary (Phase 7, F7; L12, L13)', () => {
  let draft: HunterDraft;

  beforeEach(() => {
    draft = TestBed.runInInjectionContext(() => new HunterDraft());
  });

  it('is dirty once a playbook is chosen or a name or pronouns are typed, and not for whitespace', () => {
    expect(draft.isDirty()).toBe(false);

    draft.form.controls.name.setValue('   ');
    draft.form.controls.pronouns.setValue(' ');
    expect(draft.isDirty()).toBe(false);

    draft.form.controls.pronouns.setValue('they/them');
    expect(draft.isDirty()).toBe(true);
    draft.form.controls.pronouns.setValue('');

    draft.form.controls.name.setValue('Rook');
    expect(draft.isDirty()).toBe(true);
    draft.form.controls.name.setValue('');

    draft.form.controls.playbookId.setValue('pb1');
    expect(draft.isDirty()).toBe(true);
  });

  it('lists what belongs to the playbook in the confirmation\'s order, and never name, pronouns, History notes or tracks', () => {
    draft.playbook.set(playbook);
    draft.form.controls.playbookId.setValue('pb1');
    draft.form.controls.name.setValue('Kept');
    draft.form.controls.pronouns.setValue('they/them');
    draft.form.controls.background.setValue('Kept');
    draft.form.controls.luck.setValue(2);
    expect(draft.playbookScopedSummary()).toEqual([]);

    draft.form.controls.playbookStatArrayOptionId.setValue('sa1');
    draft.toggleMove('mv1');
    draft.toggleMove('mv2');
    draft.toggleBespoke('bs-numeric', 'bo-num');
    draft.addInstance(rotes);
    draft.toggleGear('go1');
    draft.setLookFreeform('lc1', 'tall');

    expect(draft.playbookScopedSummary()).toEqual(['Rating line', '2 moves', 'The Show, Rotes', '1 gear pick', '1 look line']);
  });
});

/*
 * Moved from `hunter-form/hunter-form.spec.ts` when create mode was retired from the form (Phase 7,
 * L17). These cases only used the single-page create to reach draft logic, so they now drive the draft
 * directly: `choose` stands in for picking a playbook (the id, the load, then prune), and
 * `draft.toRequest()` for the form's emitted request. Titles and assertions are as they were.
 */
describe('HunterDraft (cases moved from hunter-form.spec.ts, L17)', () => {
  const testSubject: PlaybookDetailResponse = {
    id: 'pb1',
    name: 'The Test Subject',
    description: null,
    luckBoxCount: 7,
    luckSpecialText: null,
    harmUnstableThreshold: 5,
    harmBoxCount: 7,
    experienceBoxCount: 5,
    moveGrantCount: 3,
    gettingStartedText: null,
    introductionsText: null,
    levelingUpText: null,
    historyPromptsText: null,
    statArrayOptions: [{ id: 'sa1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 }],
    moves: [
      { id: 'mv-required', name: 'Granted Move', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [] },
      { id: 'mv1', name: 'Pickable Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
      { id: 'mv2', name: 'Other Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [] },
    ],
    gearCategories: [
      {
        id: 'gc1',
        label: 'Weapons',
        pickCount: 2,
        isOptional: false,
        sortOrder: 0,
        options: [
          { id: 'go1', name: 'Shotgun', mechanicalText: null, sortOrder: 0 },
          { id: 'go2', name: 'Machete', mechanicalText: null, sortOrder: 1 },
          { id: 'go3', name: 'Pistol', mechanicalText: null, sortOrder: 2 },
        ],
      },
      // Granted outright rather than picked, so it can never owe anything.
      {
        id: 'gc2',
        label: 'Also you get',
        pickCount: null,
        isOptional: false,
        sortOrder: 1,
        options: [{ id: 'go4', name: 'A car', mechanicalText: null, sortOrder: 0 }],
      },
    ],
    lookCategories: [
      { id: 'lc1', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo1', text: 'haggard face', sortOrder: 0 }] },
      { id: 'lc2', allowsFreeform: true, groupLabel: null, sortOrder: 1, options: [{ id: 'lo2', text: 'neat clothes', sortOrder: 0 }] },
    ],
    improvements: [],
    bespokeSections: [],
    bespokeJournals: [],
    extraTracks: [],
    pickRules: [],
  };

  let draft: HunterDraft;

  beforeEach(() => {
    draft = TestBed.runInInjectionContext(() => new HunterDraft());
  });

  /** What choosing a playbook did on the single-page create: the id, then the load, then prune. */
  function choose(book: PlaybookDetailResponse = testSubject): void {
    draft.form.controls.playbookId.setValue(book.id);
    draft.playbook.set(book);
    draft.prune(book);
  }

  it('shows a move-internal section only once the hunter has that move', () => {
    const withMoveSection: PlaybookDetailResponse = {
      ...testSubject,
      moves: [
        { ...testSubject.moves[0], bespokeSections: [] },
        {
          ...testSubject.moves[1],
          bespokeSections: [
            {
              id: 'bs-move', title: 'Artifact', description: null, effectText: null, freeTextLabel: null,
              minSelect: 1, maxSelect: 1, minInstances: null, maxInstances: null, sortOrder: 0,
              options: [{ id: 'bo1', title: 'A power', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
        testSubject.moves[2],
      ],
    };
    choose(withMoveSection);

    expect(draft.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(0);

    draft.toggleMove('mv1');
    expect(draft.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(1);

    // A Required move counts as taken from the start — it is never in the picked set, but the
    // server adds it on save regardless, and five real move-internal sections hang off one.
    expect(draft.moveSectionsFor({ ...withMoveSection.moves[0], required: true, bespokeSections: withMoveSection.moves[1].bespokeSections })).toHaveLength(1);
  });

  it('counts an engaged category rather than selection rows for a nested section', () => {
    const nested: PlaybookDetailResponse = {
      ...testSubject,
      bespokeSections: [
        {
          id: 'bs1', title: 'Fate', description: null, effectText: null, freeTextLabel: null,
          minSelect: 1, maxSelect: 2, minInstances: null, maxInstances: null, sortOrder: 0,
          options: [
            {
              id: 'cat-a', title: 'Doom', descriptionText: null, minSelect: 1, maxSelect: 1,
              numericMin: null, numericMax: null, sortOrder: 0,
              children: [
                { id: 'leaf-a1', title: 'Betrayed', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] },
                { id: 'leaf-a2', title: 'Forgotten', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 1, children: [] },
              ],
            },
          ],
        },
      ],
    };
    choose(nested);

    expect(draft.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('0 of 1 picked');

    // Ticking a LEAF engages its category, and the section's own count is over categories.
    // Counting rows instead reads every nested section as zero no matter what is filled in.
    draft.toggleBespoke('bs1', 'leaf-a1');
    expect(draft.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('1 of 1 picked');

    // The category's own maximum of 1 is now met, so its remaining sibling locks.
    expect(draft.lockedScopes(nested.bespokeSections[0], 'bs1').has('cat-a')).toBe(true);
  });

  it('keeps two entries of a repeatable section from sharing answers', () => {
    const repeatable: PlaybookDetailResponse = {
      ...testSubject,
      bespokeSections: [
        {
          id: 'bs-rep', title: 'Rotes', description: null, effectText: null, freeTextLabel: null,
          minSelect: 1, maxSelect: 1, minInstances: 0, maxInstances: null, sortOrder: 0,
          options: [
            { id: 'rote-a', title: 'Words', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] },
            { id: 'rote-b', title: 'Gestures', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 1, children: [] },
          ],
        },
      ],
    };
    choose(repeatable);
    draft.form.controls.name.setValue('Rote Keeper');

    draft.addInstance(repeatable.bespokeSections[0]);
    draft.addInstance(repeatable.bespokeSections[0]);
    const [first, second] = draft.instancesFor(repeatable.bespokeSections[0]);

    draft.toggleBespoke(first.key, 'rote-a');
    draft.toggleBespoke(second.key, 'rote-b');

    // Answers are keyed by scope, not by option id — otherwise the same option ticked in two
    // entries would collapse into one.
    expect(draft.picksFor(first.key).has('rote-a')).toBe(true);
    expect(draft.picksFor(first.key).has('rote-b')).toBe(false);
    expect(draft.picksFor(second.key).has('rote-b')).toBe(true);

    const instances = draft.toRequest().bespokeInstances;
    expect(instances).toHaveLength(2);
    expect(instances.map((i) => i.selections.map((s) => s.bespokeOptionId))).toEqual([['rote-a'], ['rote-b']]);

    // Removing an entry takes its answers with it rather than orphaning them.
    draft.removeInstance(first.key);
    expect(draft.toRequest().bespokeInstances).toHaveLength(1);
    expect(draft.toRequest().bespokeInstances[0].selections.map((s) => s.bespokeOptionId)).toEqual(['rote-b']);
  });

  it('drops a move-internal section entry and its answers when the move is unticked, leaving a different taken move untouched', () => {
    const withMoveSections: PlaybookDetailResponse = {
      ...testSubject,
      moves: [
        testSubject.moves[0],
        {
          ...testSubject.moves[1],
          bespokeSections: [
            {
              id: 'bs-network', title: 'Network', description: null, effectText: null, freeTextLabel: 'Contact',
              minSelect: null, maxSelect: null, minInstances: 0, maxInstances: 5, sortOrder: 0,
              options: [{ id: 'bo-net', title: 'A favor', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
        {
          ...testSubject.moves[2],
          bespokeSections: [
            {
              id: 'bs-other', title: 'Other Section', description: null, effectText: null, freeTextLabel: 'Note',
              minSelect: null, maxSelect: null, minInstances: 0, maxInstances: null, sortOrder: 0,
              options: [{ id: 'bo-other', title: 'A pick', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
      ],
    };
    choose(withMoveSections);
    draft.form.controls.name.setValue('Networked Hunter');

    draft.toggleMove('mv1');
    draft.toggleMove('mv2');

    const [networkSection] = withMoveSections.moves[1].bespokeSections;
    const [otherSection] = withMoveSections.moves[2].bespokeSections;

    draft.addInstance(networkSection);
    draft.addInstance(otherSection);
    const [networkInstance] = draft.instancesFor(networkSection);
    const [otherInstance] = draft.instancesFor(otherSection);

    draft.toggleBespoke(networkInstance.key, 'bo-net');
    draft.setBespokeAnswer(networkInstance.key, { optionId: 'bo-net', field: 'text', value: 'A useful contact' });
    draft.setFreeText(networkInstance.key, 'A rumor');

    draft.toggleBespoke(otherInstance.key, 'bo-other');
    draft.setBespokeAnswer(otherInstance.key, { optionId: 'bo-other', field: 'text', value: 'Kept' });

    // Unticking Network's own move drops its entry and answers entirely, the same as removing
    // them by hand — the save must never send state the server now refuses.
    draft.toggleMove('mv1');

    const instances = draft.toRequest().bespokeInstances;

    expect(instances).toHaveLength(1);
    expect(instances[0].sectionId).toBe('bs-other');
    expect(instances[0].selections.map((s) => s.bespokeOptionId)).toEqual(['bo-other']);

    // Control: a different taken move's section entry and its picks survive the untick.
    expect(draft.picksFor(otherInstance.key).has('bo-other')).toBe(true);
    expect(draft.picksFor(networkInstance.key).has('bo-net')).toBe(false);
  });

  it('reports per-section progress for moves, gear and looks', () => {
    choose();

    expect(draft.isMovePickShort()).toBe(true);
    expect(draft.isGearPickShort(testSubject.gearCategories[0])).toBe(true);
    // Granted outright, not picked, so it can never be short.
    expect(draft.isGearPickShort(testSubject.gearCategories[1])).toBe(false);
    expect(draft.unansweredLookCount()).toBe(2);

    draft.toggleMove('mv1');
    draft.toggleMove('mv2');
    draft.toggleGear('go1');
    draft.toggleGear('go2');
    draft.setLookOption('lc1', 'lo1');
    draft.setLookFreeform('lc2', 'in a borrowed coat');

    expect(draft.isMovePickShort()).toBe(false);
    expect(draft.isGearPickShort(testSubject.gearCategories[0])).toBe(false);
    expect(draft.unansweredLookCount()).toBe(0);
  });

  it('reaches the move limit at the budget, not the printed grant total', () => {
    // moveGrantCount is 3 (the printed total, required move included), so the pick budget is
    // 3 - 1 = 2. Ticking both pickable moves fills that budget even though it is one short of
    // moveGrantCount itself.
    choose();

    expect(draft.isMoveLimitReached()).toBe(false);

    draft.toggleMove('mv1');
    draft.toggleMove('mv2');

    expect(draft.isMoveLimitReached()).toBe(true);
  });

  it('imposes no ceiling and no minimum when moveGrantCount is 0 (unspecified)', () => {
    const unspecified: PlaybookDetailResponse = { ...testSubject, moveGrantCount: 0 };
    choose(unspecified);

    // No picks yet: still not "short", because there is no printed total to fall short of.
    expect(draft.isMovePickShort()).toBe(false);
    expect(draft.isMoveLimitReached()).toBe(false);

    draft.toggleMove('mv1');
    draft.toggleMove('mv2');

    // Both pickable moves taken: still no ceiling.
    expect(draft.isMoveLimitReached()).toBe(false);
  });

  it('keeps the gear ceiling the server also enforces', () => {
    choose();
    draft.toggleGear('go1');
    draft.toggleGear('go2');

    // Short is allowed; over is not — the same asymmetry HunterService.Validate applies.
    expect(draft.isGearLimitReached(testSubject.gearCategories[0])).toBe(true);
  });

  it('starts a ticked numeric leaf at NumericMax instead of sending null (item 6, L14)', () => {
    const withNumeric: PlaybookDetailResponse = {
      ...testSubject,
      bespokeSections: [
        {
          id: 'bs-numeric', title: 'The Show', description: null, effectText: null, freeTextLabel: null,
          minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0,
          options: [
            { id: 'opt-favour', title: 'Infernal Favour', descriptionText: null, minSelect: null, maxSelect: null, numericMin: 0, numericMax: 3, sortOrder: 0, children: [] },
          ],
        },
      ],
    };
    choose(withNumeric);
    draft.form.controls.name.setValue('Numeric Tester');

    draft.toggleBespoke('bs-numeric', 'opt-favour');

    const selection = draft.toRequest().bespokeSelections.find((s) => s.bespokeOptionId === 'opt-favour');
    expect(selection?.numericValue).toBe(3);
  });

  it('keeps a numeric leaf value the player already set, rather than resetting it on re-tick', () => {
    const withNumeric: PlaybookDetailResponse = {
      ...testSubject,
      bespokeSections: [
        {
          id: 'bs-numeric', title: 'The Show', description: null, effectText: null, freeTextLabel: null,
          minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0,
          options: [
            { id: 'opt-favour', title: 'Infernal Favour', descriptionText: null, minSelect: null, maxSelect: null, numericMin: 0, numericMax: 3, sortOrder: 0, children: [] },
          ],
        },
      ],
    };
    choose(withNumeric);
    draft.form.controls.name.setValue('Numeric Tester');

    draft.toggleBespoke('bs-numeric', 'opt-favour'); // ticked -> starts at 3
    draft.setBespokeAnswer('bs-numeric', { optionId: 'opt-favour', field: 'numeric', value: '1' });
    draft.toggleBespoke('bs-numeric', 'opt-favour'); // unticked
    draft.toggleBespoke('bs-numeric', 'opt-favour'); // reticked

    const selection = draft.toRequest().bespokeSelections.find((s) => s.bespokeOptionId === 'opt-favour');
    expect(selection?.numericValue).toBe(1);
  });
});
