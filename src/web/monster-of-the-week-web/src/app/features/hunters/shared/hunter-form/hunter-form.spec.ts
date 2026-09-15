import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterFormComponent } from './hunter-form';
import { By } from '@angular/platform-browser';
import { HunterMovesSectionComponent } from '../sections/hunter-moves-section';

/**
 * Covers the partial-save posture decided 2026-08-31 (docs/hunter-playbooks/architecture.md
 * Section 9): an unfinished sheet submits, and the shortfalls show up as progress rather than
 * as errors. The complementary server-side cases are in `HunterServiceTests`.
 */

const playbooks: PlaybookListItemResponse[] = [
  { id: 'pb1', name: 'The Test Subject', statArrayOptionCount: 1, moveCount: 3, bespokeSectionCount: 0 },
];

const playbook: PlaybookDetailResponse = {
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
};

function buildHunter(overrides: Partial<HunterDetailResponse> = {}): HunterDetailResponse {
  return {
    id: 'h1',
    name: 'Half A Hunter',
    pronouns: null,
    playbookId: 'pb1',
    playbookName: 'The Test Subject',
    playbookStatArrayOptionId: null,
    luck: 0,
    harm: 0,
    experience: 0,
    background: null,
    playbookMoveIds: ['mv-required'],
    playbookGearOptionIds: [],
    looks: [],
    extraTracks: [],
    bespokeSelections: [],
    bespokeInstances: [],
    journalEntries: [],
    outstanding: ['Choose a rating array.'],
    createdAt: '2026-08-31T00:00:00Z',
    ...overrides,
  };
}

describe('HunterFormComponent', () => {
  let fixture: ComponentFixture<HunterFormComponent>;
  let component: HunterFormComponent;
  let emitted: UpsertHunterRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HunterFormComponent],
      providers: [{ provide: PlaybookService, useValue: { getById: () => of(playbook) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HunterFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('playbooks', playbooks);
    fixture.componentRef.setInput('hunter', null);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Create Hunter');
    fixture.detectChanges();
  });

  function chooseThePlaybook(): void {
    component.draft.form.controls.playbookId.setValue('pb1');
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------------------------
  // playbookId-gated conditional rendering — the Angular behaviour the testing step names.
  // -------------------------------------------------------------------------------------

  it('renders nothing but the playbook picker until a playbook is chosen', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(component.draft.playbook()).toBeNull();
    expect(element.querySelector('app-custom-select')).toBeTruthy();
    // Every other section is a property of *which* playbook, so none of it can render yet.
    // This is the whole reason architecture.md Section 8 had to argue against a wizard.
    expect(element.textContent).not.toContain('Ratings');
    expect(element.textContent).not.toContain('Moves');
    expect(element.querySelector('input[formcontrolname="name"]')).toBeNull();
  });

  it('reveals the rest of the form once a playbook is chosen', () => {
    chooseThePlaybook();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.draft.playbook()?.id).toBe('pb1');
    expect(element.textContent).toContain('Ratings');
    expect(element.textContent).toContain('Moves');
    expect(element.querySelector('input[formcontrolname="name"]')).toBeTruthy();
  });

  it('drops picks that do not belong to a newly chosen playbook', () => {
    chooseThePlaybook();
    component.draft.toggleMove('mv1');
    component.draft.toggleGear('gear1');
    expect(component.draft.isMoveSelected('mv1')).toBe(true);

    // Switching playbooks mid-create: the previous playbook's ids would otherwise stay in the
    // sets, invisible because nothing renders them, and be rejected by the server on submit
    // with an error naming a move the user can no longer see.
    const other: PlaybookDetailResponse = { ...playbook, id: 'pb2', moves: [], gearCategories: [], lookCategories: [] };
    TestBed.inject(PlaybookService).getById = () => of(other);
    component.draft.form.controls.playbookId.setValue('pb2');
    fixture.detectChanges();

    expect(component.draft.isMoveSelected('mv1')).toBe(false);
    expect(component.draft.isGearSelected('gear1')).toBe(false);
  });

  it('locks the playbook control when editing an existing hunter', () => {
    fixture.componentRef.setInput('hunter', buildHunter());
    fixture.detectChanges();

    // Changing a hunter's playbook would discard every pick it has; the API still allows it for
    // a deliberate client, so the lock is a UI decision and lives only here.
    expect(component.draft.form.controls.playbookId.disabled).toBe(true);
    // getRawValue(), not .value: a disabled control is omitted from .value entirely, which
    // would send an empty playbookId and fail server-side validation.
    component.onSubmit();
    expect(emitted[0].playbookId).toBe('pb1');
  });

  // -------------------------------------------------------------------------------------
  // Bespoke reactivity
  // -------------------------------------------------------------------------------------

  it('shows a move-internal section only once the hunter has that move', () => {
    const withMoveSection: PlaybookDetailResponse = {
      ...playbook,
      moves: [
        { ...playbook.moves[0], bespokeSections: [] },
        {
          ...playbook.moves[1],
          bespokeSections: [
            {
              id: 'bs-move', title: 'Artifact', description: null, effectText: null, freeTextLabel: null,
              minSelect: 1, maxSelect: 1, minInstances: null, maxInstances: null, sortOrder: 0,
              options: [{ id: 'bo1', title: 'A power', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
        playbook.moves[2],
      ],
    };
    TestBed.inject(PlaybookService).getById = () => of(withMoveSection);
    chooseThePlaybook();

    expect(component.draft.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(0);

    component.draft.toggleMove('mv1');
    fixture.detectChanges();
    expect(component.draft.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(1);

    // A Required move counts as taken from the start — it is never in the picked set, but the
    // server adds it on save regardless, and five real move-internal sections hang off one.
    expect(component.draft.moveSectionsFor({ ...withMoveSection.moves[0], required: true, bespokeSections: withMoveSection.moves[1].bespokeSections })).toHaveLength(1);
  });

  it('counts an engaged category rather than selection rows for a nested section', () => {
    const nested: PlaybookDetailResponse = {
      ...playbook,
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
    TestBed.inject(PlaybookService).getById = () => of(nested);
    chooseThePlaybook();

    expect(component.draft.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('0 of 1 picked');

    // Ticking a LEAF engages its category, and the section's own count is over categories.
    // Counting rows instead reads every nested section as zero no matter what is filled in.
    component.draft.toggleBespoke('bs1', 'leaf-a1');
    fixture.detectChanges();
    expect(component.draft.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('1 of 1 picked');

    // The category's own maximum of 1 is now met, so its remaining sibling locks.
    expect(component.draft.lockedScopes(nested.bespokeSections[0], 'bs1').has('cat-a')).toBe(true);
  });

  it('keeps two entries of a repeatable section from sharing answers', () => {
    const repeatable: PlaybookDetailResponse = {
      ...playbook,
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
    TestBed.inject(PlaybookService).getById = () => of(repeatable);
    chooseThePlaybook();
    component.draft.form.controls.name.setValue('Rote Keeper');

    component.draft.addInstance(repeatable.bespokeSections[0]);
    component.draft.addInstance(repeatable.bespokeSections[0]);
    const [first, second] = component.draft.instancesFor(repeatable.bespokeSections[0]);

    component.draft.toggleBespoke(first.key, 'rote-a');
    component.draft.toggleBespoke(second.key, 'rote-b');

    // Answers are keyed by scope, not by option id — otherwise the same option ticked in two
    // entries would collapse into one.
    expect(component.draft.picksFor(first.key).has('rote-a')).toBe(true);
    expect(component.draft.picksFor(first.key).has('rote-b')).toBe(false);
    expect(component.draft.picksFor(second.key).has('rote-b')).toBe(true);

    component.onSubmit();
    const instances = emitted[0].bespokeInstances;
    expect(instances).toHaveLength(2);
    expect(instances.map((i) => i.selections.map((s) => s.bespokeOptionId))).toEqual([['rote-a'], ['rote-b']]);

    // Removing an entry takes its answers with it rather than orphaning them.
    component.draft.removeInstance(first.key);
    emitted.length = 0;
    component.onSubmit();
    expect(emitted[0].bespokeInstances).toHaveLength(1);
    expect(emitted[0].bespokeInstances[0].selections.map((s) => s.bespokeOptionId)).toEqual(['rote-b']);
  });

  it('drops a move-internal section entry and its answers when the move is unticked, leaving a different taken move untouched', () => {
    const withMoveSections: PlaybookDetailResponse = {
      ...playbook,
      moves: [
        playbook.moves[0],
        {
          ...playbook.moves[1],
          bespokeSections: [
            {
              id: 'bs-network', title: 'Network', description: null, effectText: null, freeTextLabel: 'Contact',
              minSelect: null, maxSelect: null, minInstances: 0, maxInstances: 5, sortOrder: 0,
              options: [{ id: 'bo-net', title: 'A favor', descriptionText: null, minSelect: null, maxSelect: null, numericMin: null, numericMax: null, sortOrder: 0, children: [] }],
            },
          ],
        },
        {
          ...playbook.moves[2],
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
    TestBed.inject(PlaybookService).getById = () => of(withMoveSections);
    chooseThePlaybook();
    component.draft.form.controls.name.setValue('Networked Hunter');

    component.draft.toggleMove('mv1');
    component.draft.toggleMove('mv2');
    fixture.detectChanges();

    const [networkSection] = withMoveSections.moves[1].bespokeSections;
    const [otherSection] = withMoveSections.moves[2].bespokeSections;

    component.draft.addInstance(networkSection);
    component.draft.addInstance(otherSection);
    const [networkInstance] = component.draft.instancesFor(networkSection);
    const [otherInstance] = component.draft.instancesFor(otherSection);

    component.draft.toggleBespoke(networkInstance.key, 'bo-net');
    component.draft.setBespokeAnswer(networkInstance.key, { optionId: 'bo-net', field: 'text', value: 'A useful contact' });
    component.draft.setFreeText(networkInstance.key, 'A rumor');

    component.draft.toggleBespoke(otherInstance.key, 'bo-other');
    component.draft.setBespokeAnswer(otherInstance.key, { optionId: 'bo-other', field: 'text', value: 'Kept' });

    // Unticking Network's own move drops its entry and answers entirely, the same as removing
    // them by hand — the save must never send state the server now refuses.
    component.draft.toggleMove('mv1');
    fixture.detectChanges();

    component.onSubmit();
    const instances = emitted[0].bespokeInstances;

    expect(instances).toHaveLength(1);
    expect(instances[0].sectionId).toBe('bs-other');
    expect(instances[0].selections.map((s) => s.bespokeOptionId)).toEqual(['bo-other']);

    // Control: a different taken move's section entry and its picks survive the untick.
    expect(component.draft.picksFor(otherInstance.key).has('bo-other')).toBe(true);
    expect(component.draft.picksFor(networkInstance.key).has('bo-net')).toBe(false);
  });

  it('submits a hunter with nothing but a name and a playbook chosen', () => {
    chooseThePlaybook();
    component.draft.form.controls.name.setValue('Half A Hunter');
    fixture.detectChanges();

    component.onSubmit();

    // The whole decision in one assertion: no rating array, no moves, no gear, no looks, and
    // the form still emits rather than swallowing the submit.
    expect(emitted.length).toBe(1);
    expect(emitted[0].playbookStatArrayOptionId).toBeNull();
    expect(emitted[0].playbookMoveIds).toEqual([]);
    expect(emitted[0].playbookGearOptionIds).toEqual([]);
    expect(emitted[0].looks).toEqual([]);
  });

  it('still refuses to submit without the two things a hunter cannot exist without', () => {
    chooseThePlaybook();
    component.onSubmit();

    expect(emitted.length).toBe(0);
    expect(component.draft.form.controls.name.touched).toBe(true);
  });

  it('leaves an unchosen rating array valid, and says so without calling it an error', () => {
    chooseThePlaybook();

    expect(component.draft.form.controls.playbookStatArrayOptionId.valid).toBe(true);
    expect(component.draft.isRatingUnchosen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('you can pick this later');

    component.draft.form.controls.playbookStatArrayOptionId.setValue('sa1');
    fixture.detectChanges();
    expect(component.draft.isRatingUnchosen()).toBe(false);
  });

  it('reports per-section progress for moves, gear and looks', () => {
    chooseThePlaybook();

    expect(component.draft.isMovePickShort()).toBe(true);
    expect(component.draft.isGearPickShort(playbook.gearCategories[0])).toBe(true);
    // Granted outright, not picked, so it can never be short.
    expect(component.draft.isGearPickShort(playbook.gearCategories[1])).toBe(false);
    expect(component.draft.unansweredLookCount()).toBe(2);

    component.draft.toggleMove('mv1');
    component.draft.toggleMove('mv2');
    component.draft.toggleGear('go1');
    component.draft.toggleGear('go2');
    component.draft.setLookOption('lc1', 'lo1');
    component.draft.setLookFreeform('lc2', 'in a borrowed coat');
    fixture.detectChanges();

    expect(component.draft.isMovePickShort()).toBe(false);
    expect(component.draft.isGearPickShort(playbook.gearCategories[0])).toBe(false);
    expect(component.draft.unansweredLookCount()).toBe(0);
  });

  it('reaches the move limit at the budget, not the printed grant total', () => {
    // moveGrantCount is 3 (the printed total, required move included), so the pick budget is
    // 3 - 1 = 2. Ticking both pickable moves fills that budget even though it is one short of
    // moveGrantCount itself.
    chooseThePlaybook();

    expect(component.draft.isMoveLimitReached()).toBe(false);

    component.draft.toggleMove('mv1');
    component.draft.toggleMove('mv2');
    fixture.detectChanges();

    expect(component.draft.isMoveLimitReached()).toBe(true);
  });

  it('imposes no ceiling and no minimum when moveGrantCount is 0 (unspecified)', () => {
    const unspecified: PlaybookDetailResponse = { ...playbook, moveGrantCount: 0 };
    TestBed.inject(PlaybookService).getById = () => of(unspecified);
    chooseThePlaybook();

    // No picks yet: still not "short", because there is no printed total to fall short of.
    expect(component.draft.isMovePickShort()).toBe(false);
    expect(component.draft.isMoveLimitReached()).toBe(false);

    component.draft.toggleMove('mv1');
    component.draft.toggleMove('mv2');
    fixture.detectChanges();

    // Both pickable moves taken: still no ceiling.
    expect(component.draft.isMoveLimitReached()).toBe(false);
  });

  it('keeps the gear ceiling the server also enforces', () => {
    chooseThePlaybook();
    component.draft.toggleGear('go1');
    component.draft.toggleGear('go2');
    fixture.detectChanges();

    // Short is allowed; over is not — the same asymmetry HunterService.Validate applies.
    expect(component.draft.isGearLimitReached(playbook.gearCategories[0])).toBe(true);
  });

  it('repopulates from an existing hunter without its unanswered sections blocking a save', () => {
    fixture.componentRef.setInput('hunter', buildHunter());
    fixture.detectChanges();

    expect(component.draft.form.controls.playbookId.disabled).toBe(true);
    expect(component.draft.form.valid).toBe(true);

    component.onSubmit();
    expect(emitted.length).toBe(1);
    expect(emitted[0].playbookId).toBe('pb1');
  });

  // -------------------------------------------------------------------------------------
  // Phase 2 (13.11 items 1-6): live rendering bugs and request hardening
  // -------------------------------------------------------------------------------------

  it('renders history prompts as text, not HTML (item 1)', () => {
    const withPrompts: PlaybookDetailResponse = { ...playbook, historyPromptsText: 'Line one\n<b>Line two</b>' };
    TestBed.inject(PlaybookService).getById = () => of(withPrompts);
    chooseThePlaybook();

    const element = fixture.nativeElement as HTMLElement;
    // Interpolated as text: the tag characters show up literally, and no <b> element is created.
    expect(element.querySelector('details b')).toBeNull();
    expect(element.textContent).toContain('<b>Line two</b>');
    expect(element.querySelector('details div.whitespace-pre-line')).toBeTruthy();
  });

  it('renders granted gear (null pickCount) as a read-only "You get" list with no checkbox, and leaves pickable gear checkboxed (item 2)', () => {
    chooseThePlaybook();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('You get');

    const carSpan = Array.from(element.querySelectorAll('span.font-medium')).find(
      (el) => el.textContent?.trim() === 'A car'
    );
    expect(carSpan).toBeTruthy();
    // The granted option renders inside a plain div, not the checkbox label the pickable
    // options use, and carries no checkbox of its own.
    expect(carSpan!.closest('div.flex.items-start')?.querySelector('input[type="checkbox"]')).toBeNull();

    const shotgunSpan = Array.from(element.querySelectorAll('span.font-medium')).find(
      (el) => el.textContent?.trim() === 'Shotgun'
    );
    expect(shotgunSpan!.closest('label')?.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('leaves an already-saved granted-gear id alone on save, with nothing left to toggle it off (B6, L15)', () => {
    fixture.componentRef.setInput('hunter', buildHunter({ playbookGearOptionIds: ['go4'] }));
    fixture.detectChanges();

    expect(component.draft.isGearSelected('go4')).toBe(true);
    component.onSubmit();
    expect(emitted[0].playbookGearOptionIds).toContain('go4');
  });

  it('retitles the Background block to History / History notes (item 3)', () => {
    chooseThePlaybook();
    const element = fixture.nativeElement as HTMLElement;

    const headings = Array.from(element.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings).toContain('History');
    expect(headings).not.toContain('Background');
    expect(element.textContent).toContain('History notes');
  });

  it('does not let a slow response for the previous playbook overwrite a newer one (item 5, switchMap)', () => {
    const slow: PlaybookDetailResponse = { ...playbook, id: 'pb-slow', name: 'Slow Playbook' };
    const fast: PlaybookDetailResponse = { ...playbook, id: 'pb-fast', name: 'Fast Playbook' };
    const slow$ = new Subject<PlaybookDetailResponse>();
    const fast$ = new Subject<PlaybookDetailResponse>();
    TestBed.inject(PlaybookService).getById = (id: string) => (id === 'pb-slow' ? slow$ : fast$);

    // Two picker changes in quick succession, the way a user clicking around the list produces.
    component.draft.form.controls.playbookId.setValue('pb-slow');
    component.draft.form.controls.playbookId.setValue('pb-fast');

    // The fast request resolves first...
    fast$.next(fast);
    fast$.complete();
    // ...then the stale one finally arrives. switchMap already cancelled its subscription when
    // the second picker change fired, so this must not be seen.
    slow$.next(slow);
    slow$.complete();

    expect(component.draft.playbook()?.id).toBe('pb-fast');
  });

  it('starts a ticked numeric leaf at NumericMax instead of sending null (item 6, L14)', () => {
    const withNumeric: PlaybookDetailResponse = {
      ...playbook,
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
    TestBed.inject(PlaybookService).getById = () => of(withNumeric);
    chooseThePlaybook();
    component.draft.form.controls.name.setValue('Numeric Tester');

    component.draft.toggleBespoke('bs-numeric', 'opt-favour');
    fixture.detectChanges();
    component.onSubmit();

    const selection = emitted[0].bespokeSelections.find((s) => s.bespokeOptionId === 'opt-favour');
    expect(selection?.numericValue).toBe(3);
  });

  it('keeps a numeric leaf value the player already set, rather than resetting it on re-tick', () => {
    const withNumeric: PlaybookDetailResponse = {
      ...playbook,
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
    TestBed.inject(PlaybookService).getById = () => of(withNumeric);
    chooseThePlaybook();
    component.draft.form.controls.name.setValue('Numeric Tester');

    component.draft.toggleBespoke('bs-numeric', 'opt-favour'); // ticked -> starts at 3
    component.draft.setBespokeAnswer('bs-numeric', { optionId: 'opt-favour', field: 'numeric', value: '1' });
    component.draft.toggleBespoke('bs-numeric', 'opt-favour'); // unticked
    component.draft.toggleBespoke('bs-numeric', 'opt-favour'); // reticked

    component.onSubmit();
    const selection = emitted[0].bespokeSelections.find((s) => s.bespokeOptionId === 'opt-favour');
    expect(selection?.numericValue).toBe(1);
  });

  // Regression: hunter-detail.html only creates <app-hunter-form [hunter]="current"> once
  // hunter() is truthy (an @if, not a later input change), so on the edit page the FIRST
  // ngOnChanges this component ever receives already carries a non-null hunter — and Angular
  // calls ngOnChanges before ngOnInit on that first change detection pass. This fixture builds
  // its own component instance and sets a non-null `hunter` input before the very first
  // detectChanges(), to reproduce that exact ordering rather than the shared beforeEach's
  // hunter:null-then-later-set-real-hunter sequence, which happens to already have ngOnInit's
  // subscriptions wired up by the time a real hunter is set.
  it('loads the playbook on the very first render when hunter-form is created with a hunter already set', () => {
    const freshFixture = TestBed.createComponent(HunterFormComponent);
    freshFixture.componentRef.setInput('playbooks', playbooks);
    freshFixture.componentRef.setInput('hunter', buildHunter());
    freshFixture.componentRef.setInput('isSaving', false);
    freshFixture.componentRef.setInput('submitLabel', 'Save changes');

    freshFixture.detectChanges(); // first CD: ngOnChanges(hunter) fires before ngOnInit

    expect(freshFixture.componentInstance.draft.playbook()?.id).toBe('pb1');
  });

  // -------------------------------------------------------------------------------------
  // Phase 5 (13.6): the page is composed of the shared sections
  // -------------------------------------------------------------------------------------

  it('composes the shared sections in the page\'s existing order, as direct sections of the form, on the form\'s own draft', () => {
    const everything: PlaybookDetailResponse = {
      ...playbook,
      bespokeSections: [
        {
          id: 'bs-code', title: 'Code', description: null, effectText: null, freeTextLabel: 'Your code',
          minSelect: null, maxSelect: null, minInstances: null, maxInstances: null, sortOrder: 0, options: [],
        },
      ],
      bespokeJournals: [{ id: 'j1', title: 'Kills', description: null, effectText: null, sortOrder: 0, fields: [] }],
      extraTracks: [{ id: 'tr1', name: 'Corruption', description: null, effectText: null, boxCount: 5, startLabel: null, endLabel: 'lost', sortOrder: 0 }],
      historyPromptsText: 'Prompts',
    };
    TestBed.inject(PlaybookService).getById = () => of(everything);
    chooseThePlaybook();
    const element = fixture.nativeElement as HTMLElement;

    // No wrapper elements: every block, shared or edit-only, is still a direct <section> of the form.
    const headings = Array.from(element.querySelectorAll('form > section')).map(
      (s) => s.querySelector('h3')?.textContent?.trim()
    );
    expect(headings).toEqual([
      'Playbook', 'Details', 'Ratings', 'Moves', 'Gear', 'Look',
      'The Test Subject tracks', 'Tracks', 'The Test Subject rules', 'Kills', 'History',
    ]);
    expect(element.querySelector('form > section[apphunterratingssection]')).toBeTruthy();
    expect(element.querySelector('form > section[apphunterhistorysection]')).toBeTruthy();
    expect(element.querySelector('form > section > [apphunterbespokesection]')).toBeTruthy();

    const moves = fixture.debugElement.query(By.directive(HunterMovesSectionComponent)).componentInstance as HunterMovesSectionComponent;
    expect(moves.draft).toBe(component.draft);
  });
});
