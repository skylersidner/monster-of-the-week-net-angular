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
import { By } from '@angular/platform-browser';
import { HunterMovesSectionComponent } from '../sections/hunter-moves-section';

/**
 * Covers the partial-save posture decided 2026-08-31 (docs/hunter-playbooks/architecture.md
 * Section 9): an unfinished sheet submits, and the shortfalls show up as progress rather than
 * as errors. The complementary server-side cases are in `HunterServiceTests`.
 *
 * Edit page only since Phase 7 (hunter-creation-wizard.md L17). Every case mounts the form the way
 * `hunter-detail.html` does, with its hunter already set. The create-mode cases moved:
 * - to `pages/hunter-create/` (the wizard): nothing but step 1 until a playbook is chosen, the rest
 *   once it is, the refusal without a name, a Create with only a name and a playbook, the unchosen
 *   rating hint, dropping another playbook's picks, and the playbook-load race;
 * - to `../hunter-draft.spec.ts` (draft logic that only used the create page to reach it): move
 *   sections, engaged categories, repeatable entries, the untick drop, progress, move budget and
 *   unspecified grant, gear ceiling, and the numeric leaf.
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
  pickRules: [],
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
  });

  /** The edit page: the form is created with its hunter already set, before the first render. */
  function mount(hunter: HunterDetailResponse = buildHunter(), book: PlaybookDetailResponse = playbook): void {
    TestBed.inject(PlaybookService).getById = () => of(book);
    fixture = TestBed.createComponent(HunterFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('playbooks', playbooks);
    fixture.componentRef.setInput('hunter', hunter);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('submitLabel', 'Save changes');
    fixture.detectChanges();
  }

  it('should create', () => {
    mount();
    expect(component).toBeTruthy();
  });

  it('locks the playbook control when editing an existing hunter', () => {
    mount();

    // Changing a hunter's playbook would discard every pick it has; the API still allows it for
    // a deliberate client, so the lock is a UI decision and lives only here.
    expect(component.draft.form.controls.playbookId.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("A hunter's playbook can't be changed");
    // getRawValue(), not .value: a disabled control is omitted from .value entirely, which
    // would send an empty playbookId and fail server-side validation.
    component.onSubmit();
    expect(emitted[0].playbookId).toBe('pb1');
  });

  it('repopulates from an existing hunter without its unanswered sections blocking a save', () => {
    mount();

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
    mount(buildHunter(), withPrompts);

    const element = fixture.nativeElement as HTMLElement;
    // Interpolated as text: the tag characters show up literally, and no <b> element is created.
    expect(element.querySelector('details b')).toBeNull();
    expect(element.textContent).toContain('<b>Line two</b>');
    expect(element.querySelector('details div.whitespace-pre-line')).toBeTruthy();
  });

  it('renders granted gear (null pickCount) as a read-only "You get" list with no checkbox, and leaves pickable gear checkboxed (item 2)', () => {
    mount();
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
    mount(buildHunter({ playbookGearOptionIds: ['go4'] }));

    expect(component.draft.isGearSelected('go4')).toBe(true);
    component.onSubmit();
    expect(emitted[0].playbookGearOptionIds).toContain('go4');
  });

  it('retitles the Background block to History / History notes (item 3)', () => {
    mount();
    const element = fixture.nativeElement as HTMLElement;

    const headings = Array.from(element.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings).toContain('History');
    expect(headings).not.toContain('Background');
    expect(element.textContent).toContain('History notes');
  });

  // Regression: hunter-detail.html only creates <app-hunter-form [hunter]="current"> once
  // hunter() is truthy (an @if, not a later input change), so on the edit page the FIRST
  // ngOnChanges this component ever receives already carries a non-null hunter — and Angular
  // calls ngOnChanges before ngOnInit on that first change detection pass. This fixture builds
  // its own component instance and sets the `hunter` input before the very first
  // detectChanges(), to reproduce that exact ordering.
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
    mount(buildHunter(), everything);
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
