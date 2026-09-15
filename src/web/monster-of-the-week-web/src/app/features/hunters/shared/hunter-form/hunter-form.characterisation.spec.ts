import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BespokeJournalResponse,
  BespokeOptionResponse,
  BespokeSectionResponse,
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterFormComponent } from './hunter-form';

/**
 * Characterisation spec for the hunter request (hunter-creation-wizard.md 13.15 item 1; Phase 4, R4).
 *
 * Written against the form as it stood at efd5309, before `HunterDraft` was extracted, and run
 * green there first. It pins the exact `UpsertHunterRequest` the form builds for fully populated
 * inputs, including the quirks: required move ids only sent when they were loaded from a saved
 * hunter, instance and journal `sortOrder` counted across every section rather than per section,
 * journal fields in the order they were typed, and prune filtering look answers by category only.
 *
 * The expected objects are literals and must not change. Only how a request is obtained may.
 * Since Phase 4 each case also checks that the emitted request is exactly `HunterDraft.toRequest()`.
 */

function option(id: string, title: string | null, extra: Partial<BespokeOptionResponse> = {}): BespokeOptionResponse {
  return { id, title, descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [], ...extra };
}

function section(id: string, title: string, extra: Partial<BespokeSectionResponse> = {}): BespokeSectionResponse {
  return { id, title, description: null, effectText: null, freeTextLabel: null, minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [], ...extra };
}

/** Under the Required move, like The Searcher's First Encounter. */
const encounterSection = section('bs-req-encounter', 'First Encounter', { freeTextLabel: 'What happened' });
const artifactSection = section('bs-mva-artifact', 'Artifact', {
  minSelect: 1,
  maxSelect: 1,
  options: [
    option('bo-artifact-blade', '{{blank}} blade'),
    option('bo-artifact-charm', 'Charm', { descriptionText: 'Wards off {{blank}}' }),
  ],
});
/** Repeatable, under a pickable move, with a free-text line per entry. */
const networkSection = section('bs-mvb-network', 'Network', {
  freeTextLabel: 'Contact',
  minInstances: 0,
  maxInstances: 3,
  options: [option('bo-net-favour', 'A favour', { descriptionText: 'Owes you {{blank}}' })],
});
/** Playbook-level, nested category plus numeric leaves. */
const fateSection = section('bs-fate', 'Fate', {
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
const notesSection = section('bs-notes', 'Notes', { freeTextLabel: 'Notes' });
/** Playbook-level repeatable, like The Hex's Rotes. */
const rotesSection = section('bs-rotes', 'Rotes', {
  minInstances: 0,
  options: [
    option('cat-req', 'Requirements', { children: [option('leaf-req-words', 'Words'), option('leaf-req-gestures', 'Gestures')] }),
    option('rote-named', '{{blank}}'),
  ],
});
const killsJournal: BespokeJournalResponse = {
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

const charPlaybook: PlaybookDetailResponse = {
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
};

/** Shares a few ids with `charPlaybook`, so prune's keep-what-is-valid filtering is visible. */
const otherPlaybook: PlaybookDetailResponse = {
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

const playbooksById: Record<string, PlaybookDetailResponse> = { 'pb-char': charPlaybook, 'pb-other': otherPlaybook };

const playbookList: PlaybookListItemResponse[] = [
  { id: 'pb-char', name: 'The Characterised', statArrayOptionCount: 2, moveCount: 5, bespokeSectionCount: 3 },
  { id: 'pb-other', name: 'The Other', statArrayOptionCount: 1, moveCount: 2, bespokeSectionCount: 1 },
];

/** A fully populated saved hunter, as `GET /api/hunters/{id}` returns it. */
const savedHunter: HunterDetailResponse = {
  id: 'h-char',
  name: 'Fox Mulder',
  pronouns: 'he/him',
  playbookId: 'pb-char',
  playbookName: 'The Characterised',
  playbookStatArrayOptionId: 'sa-1',
  luck: 2,
  harm: 1,
  experience: 3,
  background: 'Sister taken.',
  // mv-gone is no longer in the playbook, so the load's prune drops it before any save.
  playbookMoveIds: ['mv-req', 'mv-a', 'mv-gone'],
  // go-car is granted gear saved before granted gear went read-only (B6): kept, never added.
  playbookGearOptionIds: ['go-machete', 'go-car'],
  looks: [
    { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'rumpled suit' },
    { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-bright', freeformText: null },
  ],
  extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 2 }],
  bespokeSelections: [
    { sectionId: 'bs-fate', bespokeOptionId: 'bo-favour', freeformTitle: null, freeformText: null, numericValue: 1 },
    { sectionId: 'bs-req-encounter', bespokeOptionId: null, freeformTitle: null, freeformText: 'Saw the lights.', numericValue: null },
    { sectionId: 'bs-fate', bespokeOptionId: 'leaf-doom-betrayed', freeformTitle: null, freeformText: null, numericValue: null },
    { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-charm', freeformTitle: null, freeformText: 'iron', numericValue: null },
  ],
  bespokeInstances: [
    {
      id: 'inst-rote-1',
      sectionId: 'bs-rotes',
      name: 'Ward',
      sortOrder: 0,
      selections: [
        { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-gestures', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-rotes', bespokeOptionId: 'rote-named', freeformTitle: 'Salt line', freeformText: null, numericValue: null },
      ],
    },
    { id: 'inst-rote-2', sectionId: 'bs-rotes', name: null, sortOrder: 1, selections: [] },
  ],
  journalEntries: [
    {
      id: 'je-1',
      journalId: 'j-kills',
      sortOrder: 0,
      fields: [
        { journalFieldId: 'jf-what', text: 'A flukeman' },
        { journalFieldId: 'jf-where', text: 'Newark sewers' },
      ],
    },
  ],
  outstanding: [],
  createdAt: '2026-09-14T00:00:00Z',
};

/** What the edit page sends for `savedHunter` when the player changes nothing. */
const EDIT_ROUND_TRIP: UpsertHunterRequest = {
  name: 'Fox Mulder',
  pronouns: 'he/him',
  playbookId: 'pb-char',
  playbookStatArrayOptionId: 'sa-1',
  luck: 2,
  harm: 1,
  experience: 3,
  background: 'Sister taken.',
  playbookMoveIds: ['mv-req', 'mv-a'],
  playbookGearOptionIds: ['go-machete', 'go-car'],
  looks: [
    { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'rumpled suit' },
    { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-bright', freeformText: null },
  ],
  extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 2 }],
  bespokeSelections: [
    { sectionId: 'bs-fate', bespokeOptionId: 'bo-favour', freeformTitle: null, freeformText: null, numericValue: 1 },
    { sectionId: 'bs-fate', bespokeOptionId: 'leaf-doom-betrayed', freeformTitle: null, freeformText: null, numericValue: null },
    { sectionId: 'bs-req-encounter', bespokeOptionId: null, freeformTitle: null, freeformText: 'Saw the lights.', numericValue: null },
    { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-charm', freeformTitle: null, freeformText: 'iron', numericValue: null },
  ],
  bespokeInstances: [
    {
      id: 'inst-rote-1',
      sectionId: 'bs-rotes',
      name: 'Ward',
      sortOrder: 0,
      selections: [
        { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-gestures', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-rotes', bespokeOptionId: 'rote-named', freeformTitle: 'Salt line', freeformText: null, numericValue: null },
      ],
    },
    { id: 'inst-rote-2', sectionId: 'bs-rotes', name: null, sortOrder: 1, selections: [] },
  ],
  journalEntries: [
    {
      id: 'je-1',
      journalId: 'j-kills',
      sortOrder: 0,
      fields: [
        { journalFieldId: 'jf-what', text: 'A flukeman' },
        { journalFieldId: 'jf-where', text: 'Newark sewers' },
      ],
    },
  ],
};

describe('HunterFormComponent request characterisation (13.15 item 1)', () => {
  let fixture: ComponentFixture<HunterFormComponent>;
  let component: HunterFormComponent;
  let emitted: UpsertHunterRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HunterFormComponent],
      providers: [{ provide: PlaybookService, useValue: { getById: (id: string) => of(playbooksById[id]) } }],
    }).compileComponents();
  });

  /** The create page: `hunter` is never bound, so `populate` never runs. */
  function createCreatePage(): void {
    fixture = TestBed.createComponent(HunterFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('playbooks', playbookList);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Hunter');
    fixture.detectChanges();
  }

  /** The edit page: the form is created with its hunter already set, before the first render. */
  function createEditPage(hunter: HunterDetailResponse): void {
    fixture = TestBed.createComponent(HunterFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('playbooks', playbookList);
    fixture.componentRef.setInput('hunter', hunter);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Save changes');
    fixture.detectChanges();
  }

  function choosePlaybook(playbookId: string): void {
    component.hunterForm.controls.playbookId.setValue(playbookId);
    fixture.detectChanges();
  }

  /**
   * Submits once and returns the request. Since Phase 4 that is `HunterDraft.toRequest()`, and the
   * form must emit exactly what it returns.
   */
  function submitAndCapture(): UpsertHunterRequest {
    emitted.length = 0;
    component.onSubmit();
    expect(emitted).toHaveLength(1);
    const fromDraft = component.draft.toRequest();
    expect(emitted[0]).toStrictEqual(fromDraft);
    return fromDraft;
  }

  it('create page: a minimal hunter sends nulls and empty lists, never undefined', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    component.hunterForm.controls.name.setValue('Minimal');
    component.hunterForm.controls.pronouns.setValue('   ');

    expect(submitAndCapture()).toStrictEqual({
      name: 'Minimal',
      pronouns: null,
      playbookId: 'pb-char',
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

  it('create page: a fully populated hunter', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const controls = component.hunterForm.controls;

    // Scalars: free text is trimmed.
    controls.name.setValue('  Dana Scully  ');
    controls.pronouns.setValue('  she/her ');
    controls.playbookStatArrayOptionId.setValue('sa-2');
    controls.luck.setValue(3);
    controls.harm.setValue(2);
    controls.experience.setValue(4);
    controls.background.setValue('  Grew up on a naval base.  ');

    // Moves: ticked in order; Move C ticked then unticked. The Required move is never toggled.
    component.toggleMove('mv-a');
    component.toggleMove('mv-b');
    component.toggleMove('mv-c');
    component.toggleMove('mv-c');

    // Gear: two weapons and the optional extra. Granted gear has no toggle.
    component.toggleGear('go-shotgun');
    component.toggleGear('go-pistol');
    component.toggleGear('go-kit');

    // Looks.
    component.setLookOption('lc-face', 'lo-face-haggard');
    component.setLookFreeform('lc-clothes', '  a borrowed coat ');
    component.setLookFreeform('lc-eyes', 'tired');
    component.setLookOption('lc-eyes', 'lo-eyes-cold'); // replaces the freeform, keeps its place
    component.setLookOption('lc-hands', 'lo-hands-scarred');
    component.setLookOption('lc-hands', 'lo-hands-scarred'); // clicked again: cleared
    component.setLookFreeform('lc-hands', 'scar');
    component.setLookFreeform('lc-hands', '   '); // whitespace: cleared

    // Extra tracks: clamped to the box count; unparseable becomes 0.
    component.setTrackValue('tr-corruption', '9', 6);
    component.setTrackValue('tr-glory', 'abc', 3);

    // Playbook-level bespoke: a nested leaf, and numeric leaves.
    component.toggleBespoke('bs-fate', 'leaf-doom-forgotten');
    component.toggleBespoke('bs-fate', 'bo-favour'); // starts at its NumericMax, 3
    component.toggleBespoke('bs-fate', 'bo-debt'); // starts at 4 ...
    component.setBespokeAnswer('bs-fate', { optionId: 'bo-debt', field: 'numeric', value: '2' }); // ... set to 2
    component.toggleBespoke('bs-fate', 'bo-marks'); // starts at 5 ...
    component.setBespokeAnswer('bs-fate', { optionId: 'bo-marks', field: 'numeric', value: '' }); // ... input cleared
    // An answer against an option that is not ticked is never sent.
    component.setBespokeAnswer('bs-fate', { optionId: 'leaf-doom-betrayed', field: 'text', value: 'orphan' });
    component.setFreeText('bs-notes', '  Owes the Keeper a favour.  ');

    // Move-internal bespoke: under the Required move, and under a picked move.
    component.setFreeText('bs-req-encounter', '  The lights went out.  ');
    component.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    component.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: '  Silver  ' });

    // Repeatable entries, across two sections, with one removed from the middle.
    component.addInstance(rotesSection);
    const rote1 = component.instancesFor(rotesSection).at(-1)!;
    component.addInstance(rotesSection);
    const temp = component.instancesFor(rotesSection).at(-1)!;
    component.addInstance(networkSection);
    const contact = component.instancesFor(networkSection).at(-1)!;
    component.addInstance(rotesSection);
    const rote2 = component.instancesFor(rotesSection).at(-1)!;

    component.setInstanceName(rote1.key, '  Ward  ');
    component.toggleBespoke(rote1.key, 'leaf-req-words');
    component.toggleBespoke(rote1.key, 'rote-named');
    component.setBespokeAnswer(rote1.key, { optionId: 'rote-named', field: 'title', value: '  Circle of salt ' });

    component.toggleBespoke(temp.key, 'leaf-req-gestures');
    component.removeInstance(temp.key);

    component.setInstanceName(contact.key, 'Frohike');
    component.setFreeText(contact.key, '  Knows a guy  ');
    component.toggleBespoke(contact.key, 'bo-net-favour');
    component.setBespokeAnswer(contact.key, { optionId: 'bo-net-favour', field: 'text', value: '   ' });

    component.setInstanceName(rote2.key, '   ');
    component.toggleBespoke(rote2.key, 'leaf-req-words'); // same option as rote1, its own scope
    component.toggleBespoke(rote2.key, 'leaf-req-gestures');

    // Journal entries: fields in typed order, blanks dropped, an all-blank entry still sent.
    component.addJournalEntry(killsJournal);
    component.addJournalEntry(killsJournal);
    const [entry1, entry2] = component.entriesFor(killsJournal);
    component.setJournalField(entry1.key, 'jf-where', '  The docks ');
    component.setJournalField(entry1.key, 'jf-what', 'A ghoul');
    component.setJournalField(entry2.key, 'jf-what', '   ');

    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Dana Scully',
      pronouns: 'she/her',
      playbookId: 'pb-char',
      playbookStatArrayOptionId: 'sa-2',
      luck: 3,
      harm: 2,
      experience: 4,
      background: 'Grew up on a naval base.',
      // Create mode never adds the Required move's id; the server adds it.
      playbookMoveIds: ['mv-a', 'mv-b'],
      playbookGearOptionIds: ['go-shotgun', 'go-pistol', 'go-kit'],
      looks: [
        { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null },
        { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'a borrowed coat' },
        { lookCategoryId: 'lc-eyes', lookOptionId: 'lo-eyes-cold', freeformText: null },
      ],
      extraTracks: [
        { extraTrackId: 'tr-corruption', currentValue: 6 },
        { extraTrackId: 'tr-glory', currentValue: 0 },
      ],
      bespokeSelections: [
        { sectionId: 'bs-fate', bespokeOptionId: 'leaf-doom-forgotten', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-favour', freeformTitle: null, freeformText: null, numericValue: 3 },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-debt', freeformTitle: null, freeformText: null, numericValue: 2 },
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-marks', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-notes', bespokeOptionId: null, freeformTitle: null, freeformText: 'Owes the Keeper a favour.', numericValue: null },
        { sectionId: 'bs-req-encounter', bespokeOptionId: null, freeformTitle: null, freeformText: 'The lights went out.', numericValue: null },
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: 'Silver', freeformText: null, numericValue: null },
      ],
      bespokeInstances: [
        {
          id: null,
          sectionId: 'bs-rotes',
          name: 'Ward',
          sortOrder: 0,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
            { sectionId: 'bs-rotes', bespokeOptionId: 'rote-named', freeformTitle: 'Circle of salt', freeformText: null, numericValue: null },
          ],
        },
        {
          id: null,
          sectionId: 'bs-mvb-network',
          name: 'Frohike',
          sortOrder: 1,
          selections: [
            { sectionId: 'bs-mvb-network', bespokeOptionId: null, freeformTitle: null, freeformText: 'Knows a guy', numericValue: null },
            { sectionId: 'bs-mvb-network', bespokeOptionId: 'bo-net-favour', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
        {
          id: null,
          sectionId: 'bs-rotes',
          name: null,
          sortOrder: 2,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-gestures', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
      ],
      journalEntries: [
        {
          id: null,
          journalId: 'j-kills',
          sortOrder: 0,
          fields: [
            { journalFieldId: 'jf-where', text: 'The docks' },
            { journalFieldId: 'jf-what', text: 'A ghoul' },
          ],
        },
        { id: null, journalId: 'j-kills', sortOrder: 1, fields: [] },
      ],
    } satisfies UpsertHunterRequest);
  });

  it('create page: the same request when the player fills it in through the rendered form', async () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const element = fixture.nativeElement as HTMLElement;

    const type = (input: HTMLInputElement, value: string): void => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const click = (target: HTMLElement): void => {
      target.click();
      fixture.detectChanges();
    };
    const checkboxLabelled = (text: string): HTMLInputElement =>
      Array.from(element.querySelectorAll('label'))
        .find((label) => label.textContent?.includes(text) && label.querySelector('input[type="checkbox"]'))!
        .querySelector('input[type="checkbox"]')!;
    const buttonNamed = (text: string): HTMLButtonElement =>
      Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.trim() === text)!;

    type(element.querySelector('input[formcontrolname="name"]')!, '  Dana Scully ');
    click(element.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0]);
    click(checkboxLabelled('Move A'));
    click(checkboxLabelled('Shotgun'));
    click(buttonNamed('haggard face'));
    type(buttonNamed('neat clothes').closest('div')!.querySelector('input[placeholder="or your own..."]')!, 'in a borrowed coat ');
    type(element.querySelector('input[formcontrolname="luck"]')!, '2');
    const corruption = Array.from(element.querySelectorAll('span.font-semibold')).find((span) => span.textContent?.trim() === 'Corruption')!;
    type(corruption.closest('div.bg-surface')!.querySelector('input[type="number"]')!, '4');

    emitted.length = 0;
    click(element.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await fixture.whenStable();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toStrictEqual(component.draft.toRequest());
    expect(emitted[0]).toStrictEqual({
      name: 'Dana Scully',
      pronouns: null,
      playbookId: 'pb-char',
      playbookStatArrayOptionId: 'sa-1',
      luck: 2,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: ['go-shotgun'],
      looks: [
        { lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null },
        { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'in a borrowed coat' },
      ],
      extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 4 }],
      bespokeSelections: [],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('edit page: a saved hunter round-trips with no edits (ids echoed, stale ids pruned, locked playbookId sent)', () => {
    createEditPage(savedHunter);

    expect(component.hunterForm.controls.playbookId.disabled).toBe(true);
    expect(submitAndCapture()).toStrictEqual(EDIT_ROUND_TRIP);
  });

  it('edit page: edits on a saved hunter, then a re-set hunter input (as after a save) repopulates', () => {
    createEditPage(savedHunter);

    component.hunterForm.controls.name.setValue('Fox William Mulder ');
    component.addInstance(rotesSection);
    const newRote = component.instancesFor(rotesSection).at(-1)!;
    component.toggleBespoke(newRote.key, 'leaf-req-words');
    component.addJournalEntry(killsJournal);
    const newEntry = component.entriesFor(killsJournal).at(-1)!;
    component.setJournalField(newEntry.key, 'jf-what', 'Tooms');
    component.setJournalField('je-1', 'jf-where', '');
    component.toggleMove('mv-a'); // untick: the Artifact answer goes with it
    component.setTrackValue('tr-glory', '1', 3);
    component.setLookFreeform('lc-face', 'grey at the temples');
    component.toggleGear('go-shotgun');
    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Fox William Mulder',
      pronouns: 'he/him',
      playbookId: 'pb-char',
      playbookStatArrayOptionId: 'sa-1',
      luck: 2,
      harm: 1,
      experience: 3,
      background: 'Sister taken.',
      playbookMoveIds: ['mv-req'],
      playbookGearOptionIds: ['go-machete', 'go-car', 'go-shotgun'],
      looks: [
        { lookCategoryId: 'lc-clothes', lookOptionId: null, freeformText: 'rumpled suit' },
        { lookCategoryId: 'lc-face', lookOptionId: null, freeformText: 'grey at the temples' },
      ],
      extraTracks: [
        { extraTrackId: 'tr-corruption', currentValue: 2 },
        { extraTrackId: 'tr-glory', currentValue: 1 },
      ],
      bespokeSelections: [
        { sectionId: 'bs-fate', bespokeOptionId: 'bo-favour', freeformTitle: null, freeformText: null, numericValue: 1 },
        { sectionId: 'bs-fate', bespokeOptionId: 'leaf-doom-betrayed', freeformTitle: null, freeformText: null, numericValue: null },
        { sectionId: 'bs-req-encounter', bespokeOptionId: null, freeformTitle: null, freeformText: 'Saw the lights.', numericValue: null },
      ],
      bespokeInstances: [
        {
          id: 'inst-rote-1',
          sectionId: 'bs-rotes',
          name: 'Ward',
          sortOrder: 0,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-gestures', freeformTitle: null, freeformText: null, numericValue: null },
            { sectionId: 'bs-rotes', bespokeOptionId: 'rote-named', freeformTitle: 'Salt line', freeformText: null, numericValue: null },
          ],
        },
        { id: 'inst-rote-2', sectionId: 'bs-rotes', name: null, sortOrder: 1, selections: [] },
        {
          id: null,
          sectionId: 'bs-rotes',
          name: null,
          sortOrder: 2,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
      ],
      journalEntries: [
        { id: 'je-1', journalId: 'j-kills', sortOrder: 0, fields: [{ journalFieldId: 'jf-what', text: 'A flukeman' }] },
        { id: null, journalId: 'j-kills', sortOrder: 1, fields: [{ journalFieldId: 'jf-what', text: 'Tooms' }] },
      ],
    } satisfies UpsertHunterRequest);

    // hunter-detail re-sets the input with the server's response after a save.
    fixture.componentRef.setInput('hunter', { ...savedHunter });
    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual(EDIT_ROUND_TRIP);
  });

  it('untick clear: unticking a move drops its sections\' entries and answers; re-ticking starts empty', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    component.hunterForm.controls.name.setValue('Untick Tester');

    component.toggleMove('mv-a');
    component.toggleMove('mv-b');
    component.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    component.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: 'Gold' });
    component.addInstance(networkSection);
    const contact = component.instancesFor(networkSection).at(-1)!;
    component.setFreeText(contact.key, 'Byers');
    component.toggleBespoke(contact.key, 'bo-net-favour');
    component.addInstance(rotesSection);
    const rote = component.instancesFor(rotesSection).at(-1)!;
    component.toggleBespoke(rote.key, 'leaf-req-words');

    component.toggleMove('mv-b');
    component.toggleMove('mv-a');
    component.toggleMove('mv-a');
    component.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    fixture.detectChanges();

    expect(submitAndCapture()).toStrictEqual({
      name: 'Untick Tester',
      pronouns: null,
      playbookId: 'pb-char',
      playbookStatArrayOptionId: null,
      luck: 0,
      harm: 0,
      experience: 0,
      background: null,
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: [],
      looks: [],
      extraTracks: [],
      bespokeSelections: [
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: null, freeformText: null, numericValue: null },
      ],
      bespokeInstances: [
        {
          id: null,
          sectionId: 'bs-rotes',
          name: null,
          sortOrder: 0,
          selections: [
            { sectionId: 'bs-rotes', bespokeOptionId: 'leaf-req-words', freeformTitle: null, freeformText: null, numericValue: null },
          ],
        },
      ],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });

  it('prune: switching playbooks keeps only what the new playbook has, and every scalar but an invalid rating', () => {
    createCreatePage();
    choosePlaybook('pb-char');
    const controls = component.hunterForm.controls;
    controls.name.setValue('Switcher');
    controls.pronouns.setValue('they/them');
    controls.background.setValue('Kept history');
    controls.playbookStatArrayOptionId.setValue('sa-1');
    controls.luck.setValue(1);

    component.toggleMove('mv-a');
    component.toggleMove('mv-b');
    component.toggleGear('go-shotgun');
    component.toggleGear('go-pistol');
    component.setLookOption('lc-face', 'lo-face-haggard');
    component.setLookFreeform('lc-clothes', 'a borrowed coat');
    component.setTrackValue('tr-corruption', '3', 6);
    component.setTrackValue('tr-glory', '2', 3);
    component.toggleBespoke('bs-fate', 'bo-favour');
    component.setFreeText('bs-notes', 'Kept note');
    component.toggleBespoke('bs-mva-artifact', 'bo-artifact-blade');
    component.setBespokeAnswer('bs-mva-artifact', { optionId: 'bo-artifact-blade', field: 'title', value: 'Gold' });
    component.addInstance(networkSection);
    component.setFreeText(component.instancesFor(networkSection).at(-1)!.key, 'Langly');
    component.addInstance(rotesSection);
    component.toggleBespoke(component.instancesFor(rotesSection).at(-1)!.key, 'leaf-req-words');
    component.addJournalEntry(killsJournal);
    component.setJournalField(component.entriesFor(killsJournal).at(-1)!.key, 'jf-what', 'A ghoul');

    choosePlaybook('pb-other');

    expect(submitAndCapture()).toStrictEqual({
      name: 'Switcher',
      pronouns: 'they/them',
      playbookId: 'pb-other',
      playbookStatArrayOptionId: null,
      luck: 1,
      harm: 0,
      experience: 0,
      background: 'Kept history',
      playbookMoveIds: ['mv-a'],
      playbookGearOptionIds: ['go-shotgun'],
      // Filtered by category id only: the option id is not checked against the new category.
      looks: [{ lookCategoryId: 'lc-face', lookOptionId: 'lo-face-haggard', freeformText: null }],
      extraTracks: [{ extraTrackId: 'tr-corruption', currentValue: 3 }],
      bespokeSelections: [
        { sectionId: 'bs-notes', bespokeOptionId: null, freeformTitle: null, freeformText: 'Kept note', numericValue: null },
        { sectionId: 'bs-mva-artifact', bespokeOptionId: 'bo-artifact-blade', freeformTitle: 'Gold', freeformText: null, numericValue: null },
      ],
      bespokeInstances: [],
      journalEntries: [],
    } satisfies UpsertHunterRequest);
  });
});
