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
