import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HunterDetailResponse, UpsertHunterRequest } from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { killsJournal, playbookList, playbooksById, rotesSection } from '../testing/characterisation-playbooks';
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
 *
 * Phase 7 (L17): the form is edit-only, so the edit-page cases stay here. The five create cases moved,
 * with their titles and expected literals unchanged, to `pages/hunter-create/hunter-create.characterisation.spec.ts`,
 * where the wizard obtains the request. The playbook inputs both files share moved to
 * `../testing/characterisation-playbooks.ts`, unchanged.
 */

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

  it('edit page: a saved hunter round-trips with no edits (ids echoed, stale ids pruned, locked playbookId sent)', () => {
    createEditPage(savedHunter);

    expect(component.draft.form.controls.playbookId.disabled).toBe(true);
    expect(submitAndCapture()).toStrictEqual(EDIT_ROUND_TRIP);
  });

  it('edit page: edits on a saved hunter, then a re-set hunter input (as after a save) repopulates', () => {
    createEditPage(savedHunter);

    component.draft.form.controls.name.setValue('Fox William Mulder ');
    component.draft.addInstance(rotesSection);
    const newRote = component.draft.instancesFor(rotesSection).at(-1)!;
    component.draft.toggleBespoke(newRote.key, 'leaf-req-words');
    component.draft.addJournalEntry(killsJournal);
    const newEntry = component.draft.entriesFor(killsJournal).at(-1)!;
    component.draft.setJournalField(newEntry.key, 'jf-what', 'Tooms');
    component.draft.setJournalField('je-1', 'jf-where', '');
    component.draft.toggleMove('mv-a'); // untick: the Artifact answer goes with it
    component.draft.setTrackValue('tr-glory', '1', 3);
    component.draft.setLookFreeform('lc-face', 'grey at the temples');
    component.draft.toggleGear('go-shotgun');
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
});
