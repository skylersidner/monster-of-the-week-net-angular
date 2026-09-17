import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { HunterService } from '../../../../core/hunter';
import {
  HunterDetailResponse,
  HunterEvaluationResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDraft } from '../../shared/hunter-draft';
import { HunterRatingsSectionComponent } from '../../shared/sections/hunter-ratings-section';
import { INITIATE, buildPlaybook, initiatePlaybook, option, section } from '../../shared/testing/pick-rule-playbooks';
import { HunterCreateComponent } from './hunter-create';
import { HunterCreateStore } from './hunter-create.store';
import { HUNTER_STEP } from './hunter-step-model';

/*
 * The wizard page (hunter-creation-wizard.md 13.15 items 6–7; Phase 7), rendered with its real store,
 * draft, steps, sections, tracker, layout, dossier and modals. Services are faked.
 *
 * Also the new home of create-mode cases retired from `HunterFormComponent` (L17), each marked where it
 * sits: the gate before and after a playbook, the refusal without a name, a Create with only a name and
 * a playbook, the unchosen rating hint, and the Initiate's pick-rule limits (from
 * `hunter-pick-rule-sections.spec.ts`). They assert the same behaviour through the wizard's steps.
 */

const testSubject = buildPlaybook({
  id: 'pb1',
  name: 'The Test Subject',
  moveGrantCount: 3,
  gettingStartedText: 'To make your Test Subject, pick a name.\n\nThen follow the instructions.',
  statArrayOptions: [{ id: 'sa1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 }],
  moves: [
    { id: 'mv-required', name: 'Granted Move', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0, bespokeSections: [] },
    { id: 'mv1', name: 'Pickable Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
    { id: 'mv2', name: 'Other Move', descriptionText: null, required: false, isAdvanced: false, sortOrder: 2, bespokeSections: [] },
  ],
  gearCategories: [
    { id: 'gc1', label: 'Weapons', pickCount: 2, isOptional: false, sortOrder: 0, options: [{ id: 'go1', name: 'Shotgun', mechanicalText: null, sortOrder: 0 }] },
  ],
  lookCategories: [{ id: 'lc1', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo1', text: 'haggard face', sortOrder: 0 }] }],
  bespokeSections: [section('bs-heat', 'Heat', { options: [option('heat-1', 'An enemy')] })],
});
const other = buildPlaybook({ id: 'pb2', name: 'The Other' });
const byId: Record<string, PlaybookDetailResponse> = { [testSubject.id]: testSubject, [other.id]: other, [INITIATE.playbookId]: initiatePlaybook };
const list: PlaybookListItemResponse[] = [
  { id: testSubject.id, name: testSubject.name, statArrayOptionCount: 1, moveCount: 3, bespokeSectionCount: 1 },
  { id: other.id, name: other.name, statArrayOptionCount: 0, moveCount: 0, bespokeSectionCount: 0 },
  { id: INITIATE.playbookId, name: 'The Initiate', statArrayOptionCount: 0, moveCount: 0, bespokeSectionCount: 1 },
];
const clean: HunterEvaluationResponse = { refusal: null, outstanding: [] };

function created(): HunterDetailResponse {
  return {
    id: 'h-new', name: 'Half A Hunter', pronouns: null, playbookId: testSubject.id, playbookName: testSubject.name,
    playbookStatArrayOptionId: null, luck: 0, harm: 0, experience: 0, background: null,
    playbookMoveIds: [], playbookGearOptionIds: [], looks: [], extraTracks: [],
    bespokeSelections: [], bespokeInstances: [], journalEntries: [], outstanding: [], createdAt: '2026-09-15T00:00:00Z',
  };
}

const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

describe('HunterCreateComponent (the wizard page)', () => {
  let fixture: ComponentFixture<HunterCreateComponent>;
  let component: HunterCreateComponent;
  let store: HunterCreateStore;
  let draft: HunterDraft;
  let element: HTMLElement;
  let router: Router;
  let posted: UpsertHunterRequest[];
  let createResponse: () => Observable<HunterDetailResponse>;
  let evaluateResponse: () => Observable<HunterEvaluationResponse>;
  let playbookLoads: string[];

  beforeEach(async () => {
    posted = [];
    playbookLoads = [];
    createResponse = () => of(created());
    evaluateResponse = () => of(clean);
    await TestBed.configureTestingModule({
      imports: [HunterCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: PlaybookService,
          useValue: {
            getAll: () => of(list),
            getById: (id: string) => {
              playbookLoads.push(id);
              return of(byId[id]);
            },
          },
        },
        {
          provide: HunterService,
          useValue: {
            create: (request: UpsertHunterRequest) => {
              posted.push(request);
              return createResponse();
            },
            evaluate: () => evaluateResponse(),
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(HunterCreateComponent);
    component = fixture.componentInstance;
    store = fixture.debugElement.injector.get(HunterCreateStore);
    draft = fixture.debugElement.injector.get(HunterDraft);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const render = (): void => fixture.detectChanges();
  const buttonNamed = (text: string, scope: ParentNode = element): HTMLButtonElement | undefined =>
    Array.from(scope.querySelectorAll('button')).find((button) => squash(button.textContent) === text);
  const next = (): void => {
    buttonNamed('Next →')!.click();
    render();
  };
  const heading = (): string => squash(element.querySelector('section h1')?.textContent);
  const eyebrow = (): string => squash(element.querySelector('section h1')?.previousElementSibling?.textContent);
  const bubbles = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('.phase-bubble'));
  const band = (): HTMLElement | null => element.querySelector('section p.bg-danger-subtle');
  const dialog = (): HTMLElement | null => element.querySelector('[role="dialog"]');
  const card = (): HTMLElement | null => element.querySelector('[data-card="still-to-finish"]');
  /** Validation messages only: the picker's own placeholder also reads "Choose a playbook...". */
  const errors = (): string[] => Array.from(element.querySelectorAll('small.text-danger')).map((e) => squash(e.textContent));
  const notifications = (): string[] => TestBed.inject(NotificationService).notifications().map((n) => n.message);

  function begin(playbookId = testSubject.id, name = 'Half A Hunter'): void {
    store.playbookPicker.setValue(playbookId);
    draft.form.controls.name.setValue(name);
    render();
  }

  function walkTo(step: number): void {
    for (let i = 0; i < 20 && store.current().step < step; i++) {
      next();
    }
  }

  function walkToLastStep(): void {
    walkTo(HUNTER_STEP.introductions);
  }

  it('renders the shell: eight labelled tracker bubbles, step 1\'s eyebrow and title, and the empty dossier', () => {
    expect(bubbles()).toHaveLength(8);
    expect(Array.from(element.querySelectorAll('.tracker-label')).map((l) => squash(l.textContent))).toEqual([
      'Playbook', 'Ratings', 'Tracks', 'Rules', 'Moves', 'Gear', 'Improvements', 'Introductions',
    ]);
    // Labels collapse below lg for the hunter wizard (L18); the current one always shows.
    expect(element.querySelectorAll('.tracker-label')[1].classList).toContain('max-lg:sr-only');
    expect(element.querySelectorAll('.tracker-label')[0].classList).not.toContain('max-lg:sr-only');
    expect(eyebrow()).toBe('Step 1 of 8');
    expect(heading()).toBe('Who Is Your Hunter?');
    expect(squash(element.querySelector('aside')?.textContent)).toBe('Your hunter will take shape here as you work through each step.');
    expect(buttonNamed('← Back')!.disabled).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('renders every step and the dossier inside the theme\'s primary text colour (F9 dark-theme fix)', () => {
    begin();
    // The shared sections set no text colour of their own; they inherit it, as on the edit page.
    const themed = element.querySelector('.wizard-layout')!;
    expect(themed.classList).toContain('text-primary');
    expect(themed.contains(element.querySelector('app-hunter-playbook-step'))).toBe(true);
    expect(themed.contains(element.querySelector('aside'))).toBe(true);

    next();
    expect(themed.contains(element.querySelector('[apphunterratingssection]'))).toBe(true);
  });

  // Moved from hunter-form.spec.ts: 'renders nothing but the playbook picker until a playbook is chosen'.
  it('renders nothing but step 1 until a playbook is chosen, and Next says what is missing', () => {
    expect(element.querySelector('app-custom-select')).toBeTruthy();
    // Every later step is a property of *which* playbook, so none of it can render or be reached yet.
    expect(element.querySelector('[apphunterratingssection]')).toBeNull();
    expect(element.querySelector('[apphuntermovessection]')).toBeNull();
    expect(bubbles().slice(1).every((bubble) => bubble.disabled)).toBe(true);
    expect(errors()).toEqual([]);

    next();

    expect(store.current().step).toBe(HUNTER_STEP.playbook);
    expect(errors()).toEqual(['Choose a playbook.', 'A name is required.']);
  });

  // Moved from hunter-form.spec.ts: 'reveals the rest of the form once a playbook is chosen'.
  it('reveals the rest of the wizard once a playbook is chosen and named', () => {
    begin();

    expect(draft.playbook()?.id).toBe('pb1');
    expect(squash(element.textContent)).toContain('To make your Test Subject, pick a name.');

    next();
    expect(eyebrow()).toBe('Step 2 of 8');
    expect(heading()).toBe('How Do They Handle Trouble?');
    expect(element.querySelector('[apphunterratingssection] h3')?.textContent?.trim()).toBe('Ratings');

    next();
    next();
    next();
    expect(heading()).toBe('What Can They Do?');
    expect(element.textContent).toContain('Moves');
    expect(squash(element.textContent)).toContain('You get all the basic moves, plus 3 Test Subject moves.');
  });

  // Moved from hunter-form.spec.ts: 'still refuses to submit without the two things a hunter cannot exist without'.
  it('still refuses to go on without the two things a hunter cannot exist without', () => {
    store.playbookPicker.setValue(testSubject.id);
    render();

    next();
    store.create();

    expect(store.current().step).toBe(HUNTER_STEP.playbook);
    expect(draft.form.controls.name.touched).toBe(true);
    expect(errors()).toEqual(['A name is required.']);
    expect(posted).toEqual([]);
  });

  // Moved from hunter-form.spec.ts: 'submits a hunter with nothing but a name and a playbook chosen'.
  it('creates a hunter with nothing but a name and a playbook chosen, then lands on the Hunters list', async () => {
    begin();
    walkToLastStep();

    expect(eyebrow()).toBe('Step 8 of 8');
    const create = buttonNamed('Create Hunter')!;
    expect(create.disabled).toBe(false);
    create.click();
    render();
    await fixture.whenStable();

    // The whole decision in one assertion: no rating array, no moves, no gear, no looks, and
    // Create still sends rather than swallowing the request.
    expect(posted).toHaveLength(1);
    expect(posted[0].playbookStatArrayOptionId).toBeNull();
    expect(posted[0].playbookMoveIds).toEqual([]);
    expect(posted[0].playbookGearOptionIds).toEqual([]);
    expect(posted[0].looks).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/hunters']);
    expect(notifications()).toEqual(['Hunter "Half A Hunter" created.']);
    // Create's own navigation passes the discard guard (13.10).
    expect(component.canLeave()).toBe(true);
  });

  // Moved from hunter-form.spec.ts: 'leaves an unchosen rating array valid, and says so without calling it an error'.
  it('leaves an unchosen rating array valid, and says so without calling it an error', () => {
    begin();
    next();

    expect(draft.form.controls.playbookStatArrayOptionId.valid).toBe(true);
    expect(draft.isRatingUnchosen()).toBe(true);
    expect(element.textContent).toContain('you can pick this later');

    draft.form.controls.playbookStatArrayOptionId.setValue('sa1');
    render();
    expect(draft.isRatingUnchosen()).toBe(false);
  });

  // Moved from hunter-pick-rule-sections.spec.ts: 'single-page create: choosing the Initiate applies the same limits and hints'.
  it('choosing the Initiate applies the same limits and hints on the Gear step', () => {
    begin(INITIATE.playbookId, 'Initiate');
    walkTo(HUNTER_STEP.gear);
    const checkboxIn = (scope: HTMLElement, name: string): HTMLInputElement =>
      Array.from(scope.querySelectorAll('label'))
        .find((label) => label.querySelector('span.font-medium')?.textContent?.trim() === name)!
        .querySelector('input[type="checkbox"]')!;

    const old = element.querySelector<HTMLElement>(`#hunter-gear-${INITIATE.oldFashioned}`)!;
    expect(squash(old.querySelector(':scope > div.flex > small')?.textContent)).toBe('0 of 2 picked');
    expect(squash(old.querySelector(':scope > p.text-muted')?.textContent)).toContain('Fighting arts or Obsolete gear (Sect) allow 3.');

    checkboxIn(old, 'Sword').click();
    render();
    checkboxIn(old, 'Axe').click();
    render();
    expect(checkboxIn(old, 'Staff').disabled).toBe(true);
  });

  it('shows a failed Create in the error band on the last step only, and keeps the button usable', () => {
    createResponse = () => throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Moves: too many picks.' } }));
    begin();
    walkToLastStep();

    buttonNamed('Create Hunter')!.click();
    render();

    expect(squash(band()?.textContent)).toBe('Moves: too many picks.');
    expect(band()?.querySelector('button')).toBeNull();
    expect(buttonNamed('Create Hunter')!.disabled).toBe(false);

    buttonNamed('← Back')!.click();
    render();
    expect(band()).toBeNull();
  });

  it('reads "Creating…" and is disabled while Create is in flight', () => {
    const response$ = new Subject<HunterDetailResponse>();
    createResponse = () => response$;
    begin();
    walkToLastStep();

    buttonNamed('Create Hunter')!.click();
    render();

    expect(buttonNamed('Creating…')!.disabled).toBe(true);

    response$.next(created());
    response$.complete();
    render();
    expect(store.submitted()).toBe(true);
  });

  it('jumps back through a tracker bubble, landing on the first Rules dot', () => {
    begin();
    for (let i = 0; i < 3; i++) next();
    expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
    next();
    expect(store.current()).toEqual({ step: HUNTER_STEP.moves, sub: 0 });
    expect(bubbles()[HUNTER_STEP.gear].disabled).toBe(true);

    bubbles()[HUNTER_STEP.ratings].click();
    render();
    expect(heading()).toBe('How Do They Handle Trouble?');

    bubbles()[HUNTER_STEP.rules].click();
    render();
    expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
    expect(heading()).toBe('Heat');
    expect(eyebrow()).toBe('Step 4 of 8 · Test Subject rules');
  });

  it('moves focus to the step heading after Next', async () => {
    begin();
    const h1 = element.querySelector<HTMLElement>('section h1')!;
    expect(document.activeElement).not.toBe(h1);

    next();
    await fixture.whenStable();

    expect(document.activeElement).toBe(h1);
    expect(h1.textContent).toContain('How Do They Handle Trouble?');
  });

  it('provides its own draft, shared by the store, the steps and the sections inside them', () => {
    expect(() => TestBed.inject(HunterDraft)).toThrow();

    begin();
    next();

    const ratings = fixture.debugElement.query(By.directive(HunterRatingsSectionComponent)).componentInstance as HunterRatingsSectionComponent;
    expect(ratings.draft).toBe(draft);
    draft.form.controls.playbookStatArrayOptionId.setValue('sa1');
    render();
    expect(element.querySelector<HTMLInputElement>('input[type="radio"]')!.checked).toBe(true);
  });

  // -------------------------------------------------------------------------------------
  // F6: marks, the card, the band, step links
  // -------------------------------------------------------------------------------------

  describe('the check on the page (F6)', () => {
    it('marks a step the check finds nothing missing on with a tick, and keeps one it does unfinished', () => {
      evaluateResponse = () => of({ refusal: null, outstanding: [{ area: 'ratings', sectionId: null, gearCategoryId: null, message: 'Choose a rating array.' }] });
      begin();
      next();
      next();

      expect(squash(bubbles()[HUNTER_STEP.playbook].textContent)).toBe('✓');
      expect(bubbles()[HUNTER_STEP.ratings].getAttribute('aria-label')).toBe('Step 2, Ratings, unfinished');
      expect(squash(bubbles()[HUNTER_STEP.ratings].textContent)).toBe('2');
    });

    it('lists what is left on the last step, and each line goes to its step or Rules dot', () => {
      evaluateResponse = () =>
        of({
          refusal: null,
          outstanding: [
            { area: 'ratings', sectionId: null, gearCategoryId: null, message: 'Choose a rating array.' },
            { area: 'rules', sectionId: 'bs-heat', gearCategoryId: null, message: 'Heat: 0 of 1 picked.' },
          ],
        });
      begin();
      walkToLastStep();

      expect(Array.from(card()!.querySelectorAll('[data-group]')).map((group) => group.getAttribute('data-group'))).toEqual(['ratings', 'rules']);
      expect(buttonNamed('Create Hunter')!.disabled).toBe(false);

      buttonNamed('Heat: 0 of 1 picked.', card()!)!.click();
      render();
      expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
      expect(heading()).toBe('Heat');
    });

    it('says "Checking…" while the arrival check is in flight, keeping what it last knew', () => {
      begin();
      walkTo(HUNTER_STEP.improvements);
      const response$ = new Subject<HunterEvaluationResponse>();
      evaluateResponse = () => response$;

      next();
      expect(squash(card()?.textContent)).toContain('Checking…');
      expect(squash(card()?.textContent)).toContain('Nothing left to finish.');

      response$.next(clean);
      render();
      expect(squash(card()?.textContent)).not.toContain('Checking…');
    });

    it('a failed check is information only: no toast, no band, and Create still works', () => {
      evaluateResponse = () => throwError(() => new HttpErrorResponse({ status: 500 }));
      begin();
      walkToLastStep();

      expect(squash(card()?.textContent)).toContain("Couldn't check what's left.");
      expect(band()).toBeNull();
      expect(notifications()).toEqual([]);
      expect(buttonNamed('Create Hunter')!.disabled).toBe(false);
    });

    it('shows a refusal in the band with Reload playbook, which reloads and checks again', () => {
      evaluateResponse = () => of({ refusal: 'That move is not in this playbook.', outstanding: [] });
      begin();
      next();

      expect(band()?.firstChild?.textContent).toBe('That move is not in this playbook.');
      const reload = buttonNamed('Reload playbook', band()!)!;

      evaluateResponse = () => of(clean);
      reload.click();
      render();

      expect(playbookLoads).toEqual(['pb1', 'pb1']);
      expect(notifications()).toEqual(['Reloaded The Test Subject. Nothing needed clearing.']);
      expect(band()).toBeNull();
    });

    it('turns the Initiate\'s "Go to Sect" and "Go to Gear" into step links (L24, L25)', () => {
      begin(INITIATE.playbookId, 'Initiate');
      walkTo(HUNTER_STEP.gear);

      buttonNamed('Go to Sect', element.querySelector(`#hunter-gear-${INITIATE.oldFashioned}`)!)!.click();
      render();
      expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
      expect(heading()).toBe('Sect');

      // Pick Fighting arts, take three old-fashioned weapons, then come back and drop Fighting arts.
      draft.toggleBespoke(INITIATE.sect, INITIATE.fightingArts);
      walkTo(HUNTER_STEP.gear);
      ['of-sword', 'of-axe', 'of-staff'].forEach((id) => draft.toggleGear(id));
      store.jumpTo(HUNTER_STEP.rules);
      draft.toggleBespoke(INITIATE.sect, INITIATE.fightingArts);
      render();

      buttonNamed('Go to Gear', element.querySelector(`#hunter-section-${INITIATE.sect}`)!)!.click();
      render();
      expect(store.current()).toEqual({ step: HUNTER_STEP.gear, sub: 0 });
      expect(element.querySelector(`#hunter-gear-${INITIATE.oldFashioned}`)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------------------
  // F7: switching playbook, leaving
  // -------------------------------------------------------------------------------------

  describe('switching playbook (F7, L13)', () => {
    it('asks before clearing picks: title, list, permanence note, and a "Switch playbook" button', () => {
      begin();
      draft.toggleMove('mv1');
      render();

      store.playbookPicker.setValue(other.id);
      render();

      expect(squash(dialog()?.querySelector('h3')?.textContent)).toBe('Switch to "The Other"?');
      expect(squash(dialog()?.textContent)).toContain('These belong to The Test Subject and will be cleared:');
      expect(Array.from(dialog()!.querySelectorAll('li')).map((li) => squash(li.textContent))).toEqual(['1 move']);
      expect(squash(dialog()?.textContent)).toContain('Your name, pronouns and History notes stay.');
      expect(Array.from(dialog()!.querySelectorAll('button')).map((b) => squash(b.textContent))).toEqual(['Cancel', 'Switch playbook']);
    });

    it('Cancel puts the picker back on the current playbook and keeps every pick', () => {
      begin();
      draft.toggleMove('mv1');
      store.playbookPicker.setValue(other.id);
      render();

      buttonNamed('Cancel', dialog()!)!.click();
      render();

      expect(dialog()).toBeNull();
      expect(squash(element.querySelector('.custom-select__trigger')?.textContent)).toContain('The Test Subject');
      expect(draft.playbook()?.id).toBe(testSubject.id);
      expect(draft.isMoveSelected('mv1')).toBe(true);
    });

    it('Switch playbook switches, clearing the old playbook\'s picks and keeping the name', () => {
      begin();
      draft.toggleMove('mv1');
      store.playbookPicker.setValue(other.id);
      render();

      buttonNamed('Switch playbook', dialog()!)!.click();
      render();

      expect(dialog()).toBeNull();
      expect(draft.playbook()?.id).toBe(other.id);
      expect(draft.isMoveSelected('mv1')).toBe(false);
      expect(draft.formValue().name).toBe('Half A Hunter');
    });
  });

  describe('leaving (F7, L12)', () => {
    it('lets a clean wizard go without asking', () => {
      expect(component.canLeave()).toBe(true);
      expect(dialog()).toBeNull();
    });

    it('asks before discarding a dirty draft, and leaves only on Discard', () => {
      begin();
      const answers: boolean[] = [];

      (component.canLeave() as Observable<boolean>).subscribe((answer) => answers.push(answer));
      render();

      expect(squash(dialog()?.querySelector('h3')?.textContent)).toBe('Discard "Half A Hunter"?');
      expect(squash(dialog()?.textContent)).toContain('Nothing has been saved yet.');
      buttonNamed('Discard', dialog()!)!.click();
      render();

      expect(answers).toEqual([true]);
      expect(dialog()).toBeNull();
    });

    it('stays on Cancel, and names an unnamed hunter "New Hunter"', () => {
      store.playbookPicker.setValue(testSubject.id);
      render();
      const answers: boolean[] = [];

      (component.canLeave() as Observable<boolean>).subscribe((answer) => answers.push(answer));
      render();
      expect(squash(dialog()?.querySelector('h3')?.textContent)).toBe('Discard "New Hunter"?');

      buttonNamed('Cancel', dialog()!)!.click();
      render();
      expect(answers).toEqual([false]);
      expect(draft.playbook()?.id).toBe(testSubject.id);
    });

    it('prompts on refresh or tab close only while there is something to lose', () => {
      const unload = (): boolean => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(unload()).toBe(false);

      draft.form.controls.pronouns.setValue('they/them');
      expect(unload()).toBe(true);

      store.submitted.set(true);
      expect(unload()).toBe(false);
    });
  });
});
