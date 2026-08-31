import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';
import { PlaybookService } from '../../../../core/playbook';
import { HunterFormComponent } from './hunter-form';

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
  moveGrantCount: 2,
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
    component.hunterForm.controls.playbookId.setValue('pb1');
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

    expect(component.playbook()).toBeNull();
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
    expect(component.playbook()?.id).toBe('pb1');
    expect(element.textContent).toContain('Ratings');
    expect(element.textContent).toContain('Moves');
    expect(element.querySelector('input[formcontrolname="name"]')).toBeTruthy();
  });

  it('drops picks that do not belong to a newly chosen playbook', () => {
    chooseThePlaybook();
    component.toggleMove('mv1');
    component.toggleGear('gear1');
    expect(component.isMoveSelected('mv1')).toBe(true);

    // Switching playbooks mid-create: the previous playbook's ids would otherwise stay in the
    // sets, invisible because nothing renders them, and be rejected by the server on submit
    // with an error naming a move the user can no longer see.
    const other: PlaybookDetailResponse = { ...playbook, id: 'pb2', moves: [], gearCategories: [], lookCategories: [] };
    TestBed.inject(PlaybookService).getById = () => of(other);
    component.hunterForm.controls.playbookId.setValue('pb2');
    fixture.detectChanges();

    expect(component.isMoveSelected('mv1')).toBe(false);
    expect(component.isGearSelected('gear1')).toBe(false);
  });

  it('locks the playbook control when editing an existing hunter', () => {
    fixture.componentRef.setInput('hunter', buildHunter());
    fixture.detectChanges();

    // Changing a hunter's playbook would discard every pick it has; the API still allows it for
    // a deliberate client, so the lock is a UI decision and lives only here.
    expect(component.hunterForm.controls.playbookId.disabled).toBe(true);
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

    expect(component.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(0);

    component.toggleMove('mv1');
    fixture.detectChanges();
    expect(component.moveSectionsFor(withMoveSection.moves[1])).toHaveLength(1);

    // A Required move counts as taken from the start — it is never in the picked set, but the
    // server adds it on save regardless, and five real move-internal sections hang off one.
    expect(component.moveSectionsFor({ ...withMoveSection.moves[0], required: true, bespokeSections: withMoveSection.moves[1].bespokeSections })).toHaveLength(1);
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

    expect(component.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('0 of 1 picked');

    // Ticking a LEAF engages its category, and the section's own count is over categories.
    // Counting rows instead reads every nested section as zero no matter what is filled in.
    component.toggleBespoke('bs1', 'leaf-a1');
    fixture.detectChanges();
    expect(component.sectionProgress(nested.bespokeSections[0], 'bs1')).toBe('1 of 1 picked');

    // The category's own maximum of 1 is now met, so its remaining sibling locks.
    expect(component.lockedScopes(nested.bespokeSections[0], 'bs1').has('cat-a')).toBe(true);
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
    component.hunterForm.controls.name.setValue('Rote Keeper');

    component.addInstance(repeatable.bespokeSections[0]);
    component.addInstance(repeatable.bespokeSections[0]);
    const [first, second] = component.instancesFor(repeatable.bespokeSections[0]);

    component.toggleBespoke(first.key, 'rote-a');
    component.toggleBespoke(second.key, 'rote-b');

    // Answers are keyed by scope, not by option id — otherwise the same option ticked in two
    // entries would collapse into one.
    expect(component.picksFor(first.key).has('rote-a')).toBe(true);
    expect(component.picksFor(first.key).has('rote-b')).toBe(false);
    expect(component.picksFor(second.key).has('rote-b')).toBe(true);

    component.onSubmit();
    const instances = emitted[0].bespokeInstances;
    expect(instances).toHaveLength(2);
    expect(instances.map((i) => i.selections.map((s) => s.bespokeOptionId))).toEqual([['rote-a'], ['rote-b']]);

    // Removing an entry takes its answers with it rather than orphaning them.
    component.removeInstance(first.key);
    emitted.length = 0;
    component.onSubmit();
    expect(emitted[0].bespokeInstances).toHaveLength(1);
    expect(emitted[0].bespokeInstances[0].selections.map((s) => s.bespokeOptionId)).toEqual(['rote-b']);
  });

  it('submits a hunter with nothing but a name and a playbook chosen', () => {
    chooseThePlaybook();
    component.hunterForm.controls.name.setValue('Half A Hunter');
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
    expect(component.hunterForm.controls.name.touched).toBe(true);
  });

  it('leaves an unchosen rating array valid, and says so without calling it an error', () => {
    chooseThePlaybook();

    expect(component.hunterForm.controls.playbookStatArrayOptionId.valid).toBe(true);
    expect(component.isRatingUnchosen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('you can pick this later');

    component.hunterForm.controls.playbookStatArrayOptionId.setValue('sa1');
    fixture.detectChanges();
    expect(component.isRatingUnchosen()).toBe(false);
  });

  it('reports per-section progress for moves, gear and looks', () => {
    chooseThePlaybook();

    expect(component.isMovePickShort()).toBe(true);
    expect(component.isGearPickShort(playbook.gearCategories[0])).toBe(true);
    // Granted outright, not picked, so it can never be short.
    expect(component.isGearPickShort(playbook.gearCategories[1])).toBe(false);
    expect(component.unansweredLookCount()).toBe(2);

    component.toggleMove('mv1');
    component.toggleMove('mv2');
    component.toggleGear('go1');
    component.toggleGear('go2');
    component.setLookOption('lc1', 'lo1');
    component.setLookFreeform('lc2', 'in a borrowed coat');
    fixture.detectChanges();

    expect(component.isMovePickShort()).toBe(false);
    expect(component.isGearPickShort(playbook.gearCategories[0])).toBe(false);
    expect(component.unansweredLookCount()).toBe(0);
  });

  it('keeps the gear ceiling the server also enforces', () => {
    chooseThePlaybook();
    component.toggleGear('go1');
    component.toggleGear('go2');
    fixture.detectChanges();

    // Short is allowed; over is not — the same asymmetry HunterService.Validate applies.
    expect(component.isGearLimitReached(playbook.gearCategories[0])).toBe(true);
  });

  it('repopulates from an existing hunter without its unanswered sections blocking a save', () => {
    fixture.componentRef.setInput('hunter', buildHunter());
    fixture.detectChanges();

    expect(component.hunterForm.controls.playbookId.disabled).toBe(true);
    expect(component.hunterForm.valid).toBe(true);

    component.onSubmit();
    expect(emitted.length).toBe(1);
    expect(emitted[0].playbookId).toBe('pb1');
  });
});
