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
    draft.populate(null);
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

  it('populate(null) clears every pick and re-enables the playbook picker', () => {
    loadSaved();

    draft.populate(null);

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
