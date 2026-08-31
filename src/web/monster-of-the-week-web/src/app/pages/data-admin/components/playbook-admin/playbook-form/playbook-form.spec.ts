import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybookDetailResponse, UpsertPlaybookRequest } from '../../../../../core/models';
import { PlaybookFormComponent } from './playbook-form';

/**
 * Form-reactivity coverage only, per the testing step's scope: the child-collection editors'
 * own behaviour and what `submit()` builds. No API round-trips — those are the API project's
 * `PlaybookIntegrationTests`.
 *
 * Two of these guard bugs that have actually shipped in this form and been fixed:
 * `sortOrder` partitioning by `isAdvanced` (which regressed a second time in `moves` after
 * being fixed in `improvements`), and gear categories all being written with `sortOrder: 0`.
 */
function buildPlaybook(overrides: Partial<PlaybookDetailResponse> = {}): PlaybookDetailResponse {
  return {
    id: 'pb1',
    name: 'The Test Subject',
    description: 'A synthetic playbook.',
    luckBoxCount: 7,
    luckSpecialText: null,
    harmUnstableThreshold: 5,
    harmBoxCount: 7,
    experienceBoxCount: 5,
    moveGrantCount: 2,
    gettingStartedText: null,
    introductionsText: null,
    levelingUpText: null,
    historyPromptsText: null,
    statArrayOptions: [
      { id: 'sa1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 },
      { id: 'sa2', charm: 0, cool: 1, sharp: 1, tough: 1, weird: -1, sortOrder: 1 },
    ],
    moves: [
      { id: 'mv1', name: 'Granted Move', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [] },
      { id: 'mv2', name: 'Pickable Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
      { id: 'mv3', name: 'Advanced Move', descriptionText: null, required: false, isAdvanced: true, sortOrder: 0, bespokeSections: [] },
    ],
    gearCategories: [
      { id: 'gc1', label: 'Weapons', pickCount: 1, isOptional: false, sortOrder: 0, options: [{ id: 'go1', name: 'Shotgun', mechanicalText: null, sortOrder: 0 }] },
      { id: 'gc2', label: 'Vehicles', pickCount: 1, isOptional: true, sortOrder: 1, options: [{ id: 'go2', name: 'Van', mechanicalText: null, sortOrder: 0 }] },
    ],
    lookCategories: [
      { id: 'lc1', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo1', text: 'haggard face', sortOrder: 0 }] },
    ],
    improvements: [
      { id: 'im1', text: 'Get +1 Sharp', isAdvanced: false, sortOrder: 0 },
      { id: 'im2', text: 'Get +1 Cool', isAdvanced: false, sortOrder: 1 },
      { id: 'im3', text: 'Change playbooks', isAdvanced: true, sortOrder: 0 },
    ],
    bespokeSections: [],
    bespokeJournals: [],
    extraTracks: [],
    ...overrides,
  };
}

describe('PlaybookFormComponent', () => {
  let fixture: ComponentFixture<PlaybookFormComponent>;
  let component: PlaybookFormComponent;
  let emitted: UpsertPlaybookRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlaybookFormComponent] }).compileComponents();

    fixture = TestBed.createComponent(PlaybookFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('playbook', null);
    fixture.detectChanges();
  });

  function loadExisting(overrides: Partial<PlaybookDetailResponse> = {}): PlaybookDetailResponse {
    const playbook = buildPlaybook(overrides);
    fixture.componentRef.setInput('playbook', playbook);
    fixture.detectChanges();
    return playbook;
  }

  it('starts empty in create mode', () => {
    expect(component.isEditing()).toBe(false);
    expect(component.statArrayOptions.length).toBe(0);
    expect(component.moves.length).toBe(0);
  });

  it('populates every child collection from the playbook it is given', () => {
    loadExisting();

    expect(component.isEditing()).toBe(true);
    expect(component.statArrayOptions.length).toBe(2);
    expect(component.moves.length).toBe(3);
    expect(component.gearCategories.length).toBe(2);
    expect(component.lookCategories.length).toBe(1);
    expect(component.improvements.length).toBe(3);
    expect(component.gearOptions(component.gearCategories.at(0)).length).toBe(1);
  });

  it('refuses to submit an invalid form and emits nothing', () => {
    component.form.controls.name.setValue('');
    component.submit();

    expect(emitted).toHaveLength(0);
    expect(component.hasSubmitted()).toBe(true);
  });

  it('flags a harm threshold above the harm box count', () => {
    component.form.controls.harmBoxCount.setValue(7);
    component.form.controls.harmUnstableThreshold.setValue(9);

    expect(component.harmThresholdExceedsBoxes()).toBe(true);

    component.form.controls.harmUnstableThreshold.setValue(5);
    expect(component.harmThresholdExceedsBoxes()).toBe(false);
  });

  // -------------------------------------------------------------------------------------
  // The Id round-trip — the form half of the requirement the testing step calls out.
  // -------------------------------------------------------------------------------------

  it('carries every child row id through GET -> form -> PUT', () => {
    const playbook = loadExisting();

    component.submit();

    const request = emitted[0];
    expect(request).toBeDefined();
    // An id dropped here reads as "delete and reinsert" to the server's Id-based diff, which
    // silently churns the rows Hunters live-link to. Nothing else in this layer would notice.
    expect(request.statArrayOptions.map((x) => x.id)).toEqual(['sa1', 'sa2']);
    expect(request.moves.map((x) => x.id)).toEqual(['mv1', 'mv2', 'mv3']);
    expect(request.gearCategories.map((x) => x.id)).toEqual(['gc1', 'gc2']);
    expect(request.gearCategories[0].options.map((o) => o.id)).toEqual(['go1']);
    expect(request.lookCategories.map((x) => x.id)).toEqual(['lc1']);
    expect(request.lookCategories[0].options.map((o) => o.id)).toEqual(['lo1']);
    expect(request.improvements.map((x) => x.id)).toEqual(['im1', 'im2', 'im3']);
  });

  it('sends a null id for a row added in the form, which is how an insert is expressed', () => {
    loadExisting();
    component.addMove();
    component.moves.at(3).controls['name'].setValue('Brand New Move');

    component.submit();

    const moves = emitted[0].moves;
    expect(moves).toHaveLength(4);
    expect(moves[3].id).toBeNull();
    expect(moves[3].name).toBe('Brand New Move');
  });

  it('drops a removed row from the payload entirely, which is how a delete is expressed', () => {
    loadExisting();
    component.removeAt(component.moves, 1);

    component.submit();

    expect(emitted[0].moves.map((x) => x.id)).toEqual(['mv1', 'mv3']);
  });

  // -------------------------------------------------------------------------------------
  // sortOrder — the bug that shipped twice
  // -------------------------------------------------------------------------------------

  it('numbers improvements and advanced improvements as separate sequences from 0', () => {
    loadExisting();

    component.submit();

    const improvements = emitted[0].improvements;
    // Each list keeps its own sequence: reading back orders by isAdvanced then sortOrder, so a
    // single continuous 0..N would interleave the two lists on the next load.
    expect(improvements.filter((x) => !x.isAdvanced).map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(improvements.filter((x) => x.isAdvanced).map((x) => x.sortOrder)).toEqual([0]);
  });

  it('numbers regular and advanced moves as separate sequences from 0', () => {
    loadExisting();

    component.submit();

    const moves = emitted[0].moves;
    // The identical bug reappeared here after being fixed in improvements, and was caught by a
    // browser round-trip rather than a test. This is that test.
    expect(moves.filter((x) => !x.isAdvanced).map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(moves.filter((x) => x.isAdvanced).map((x) => x.sortOrder)).toEqual([0]);
  });

  it('numbers gear categories and their options by position rather than leaving them all at 0', () => {
    loadExisting();

    component.submit();

    // All-zero sortOrders leave the display order down to whatever the database returns.
    expect(emitted[0].gearCategories.map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(emitted[0].statArrayOptions.map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(emitted[0].lookCategories.map((x) => x.sortOrder)).toEqual([0]);
  });

  it('renumbers the survivors after a removal, leaving no gap', () => {
    loadExisting();
    component.removeAt(component.statArrayOptions, 0);

    component.submit();

    expect(emitted[0].statArrayOptions.map((x) => x.sortOrder)).toEqual([0]);
    expect(emitted[0].statArrayOptions.map((x) => x.id)).toEqual(['sa2']);
  });

  // -------------------------------------------------------------------------------------
  // Bespoke content the form does not edit
  // -------------------------------------------------------------------------------------

  it('passes bespoke sections, journals and tracks through untouched', () => {
    // The form has no editors for these, so it must hand back exactly what it was given —
    // otherwise every save through this UI would silently delete a playbook's bespoke rules.
    const playbook = loadExisting({
      bespokeSections: [
        {
          id: 'bs1', title: 'Fate', description: null, effectText: null, freeTextLabel: null,
          minSelect: 1, maxSelect: 2, minInstances: null, maxInstances: null, sortOrder: 0,
          options: [
            {
              id: 'bo1', title: 'Doom', descriptionText: null, minSelect: 1, maxSelect: 1,
              numericMin: null, numericMax: null, sortOrder: 0,
              children: [{ id: 'bo2', title: 'Betrayed', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
      ],
      extraTracks: [
        { id: 'et1', name: 'Corruption', description: null, effectText: null, boxCount: 7, startLabel: null, endLabel: 'Lost', sortOrder: 0 },
      ],
    });

    component.submit();

    const request = emitted[0];
    expect(request.bespokeSections.map((s) => s.id)).toEqual(['bs1']);
    expect(request.bespokeSections[0].options.map((o) => o.id)).toEqual(['bo1']);
    // Including the nested child, which a shallow copy would drop.
    expect(request.bespokeSections[0].options[0].children.map((c) => c.id)).toEqual(['bo2']);
    expect(request.extraTracks.map((t) => t.id)).toEqual(['et1']);
    expect(playbook.bespokeSections[0].options[0].children[0].id).toBe('bo2');
  });

  it('resets cleanly when switched from an existing playbook back to create mode', () => {
    loadExisting();
    expect(component.moves.length).toBe(3);

    fixture.componentRef.setInput('playbook', null);
    fixture.detectChanges();

    expect(component.isEditing()).toBe(false);
    expect(component.moves.length).toBe(0);
    expect(component.improvements.length).toBe(0);
    expect(component.form.controls.name.value).toBe('');
  });
});
