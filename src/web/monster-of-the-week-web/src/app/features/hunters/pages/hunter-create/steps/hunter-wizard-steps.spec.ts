import { HttpErrorResponse } from '@angular/common/http';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { HunterService } from '../../../../../core/hunter';
import { PlaybookDetailResponse } from '../../../../../core/models';
import { PlaybookService } from '../../../../../core/playbook';
import { HunterDraft } from '../../../shared/hunter-draft';
import { buildPlaybook, option, section } from '../../../shared/testing/pick-rule-playbooks';
import { HunterCreateStore } from '../hunter-create.store';
import { HUNTER_STEP } from '../hunter-step-model';
import { HunterGearStepComponent } from './hunter-gear-step';
import { HunterImprovementsStepComponent } from './hunter-improvements-step';
import { HunterIntroductionsStepComponent } from './hunter-introductions-step';
import { HunterMovesStepComponent } from './hunter-moves-step';
import { HunterPlaybookStepComponent } from './hunter-playbook-step';
import { HunterRulesStepComponent } from './hunter-rules-step';
import { EXPERIENCE_RULE, HunterTracksStepComponent, LUCK_RULE, harmRule } from './hunter-tracks-step';

/*
 * The wizard's step components, each rendered on its own with a real store and draft (13.15 item 4,
 * the F5 part). Step components own no state (L2), so every case drives the store or the draft.
 */

const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
/** The start and end labels either side of a box row. Angular drops the whitespace between them, so they are read apart. */
const trackLabels = (scope: HTMLElement): string[] =>
  Array.from(scope.querySelectorAll('[role="img"] > span:not(.flex)')).map((label) => squash(label.textContent));
/** Validation messages only: the picker's own placeholder also reads "Choose a playbook...". */
const errors = (scope: HTMLElement): string[] => Array.from(scope.querySelectorAll('small.text-danger')).map((e) => squash(e.textContent));

describe('Hunter wizard steps', () => {
  let store: HunterCreateStore;
  let draft: HunterDraft;
  let getById: (id: string) => Observable<PlaybookDetailResponse>;

  function setUp(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        HunterDraft,
        HunterCreateStore,
        { provide: PlaybookService, useValue: { getAll: () => of([]), getById: (id: string) => getById(id) } },
        { provide: HunterService, useValue: {} },
      ],
    });
    store = TestBed.inject(HunterCreateStore);
    draft = TestBed.inject(HunterDraft);
  }

  function renderStep<T>(component: Type<T>, playbook: PlaybookDetailResponse | null): { fixture: ComponentFixture<T>; element: HTMLElement } {
    getById = () => of(playbook!);
    setUp();
    if (playbook) {
      store.playbookPicker.setValue(playbook.id);
      draft.form.controls.name.setValue('Tester');
    }
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  // -------------------------------------------------------------------------------------
  // Step 1
  // -------------------------------------------------------------------------------------

  describe('step 1, playbook and name', () => {
    it('shows the chosen playbook\'s flavour text and Getting Started text as plain text', () => {
      const book = buildPlaybook({ id: 'pb-a', description: 'You\'re <em>good</em> at this.', gettingStartedText: 'Pick a name.\n\nThen pick a look.' });
      const { element } = renderStep(HunterPlaybookStepComponent, book);

      expect(element.querySelector('em')).toBeNull();
      expect(element.textContent).toContain('You\'re <em>good</em> at this.');
      const panel = Array.from(element.querySelectorAll('div.bg-surface-sunken')).find((p) => p.textContent?.includes('Getting started'))!;
      expect(panel.querySelector('div.whitespace-pre-line')?.textContent).toBe('Pick a name.\n\nThen pick a look.');
    });

    it('leaves out the flavour text when a playbook has none (the Pararomantic)', () => {
      const { element } = renderStep(HunterPlaybookStepComponent, buildPlaybook({ id: 'pb-b', description: null }));
      expect(element.querySelector('p.whitespace-pre-line')).toBeNull();
    });

    it('binds name and pronouns to the draft', () => {
      const { fixture, element } = renderStep(HunterPlaybookStepComponent, null);
      const [name, pronouns] = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="text"]'));

      name.value = 'Dana';
      name.dispatchEvent(new Event('input'));
      pronouns.value = 'she/her';
      pronouns.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(draft.formValue().name).toBe('Dana');
      expect(draft.formValue().pronouns).toBe('she/her');
      expect(name.maxLength).toBe(255);
    });

    it('lets the name and pronouns row shrink inside the narrow column, and stack below lg (F9 overflow fix)', () => {
      // jsdom does no layout, so this pins the classes that keep Pronouns inside the 42% column.
      const { element } = renderStep(HunterPlaybookStepComponent, null);
      const row = element.querySelector<HTMLElement>('.name-pronouns')!;

      expect(Array.from(row.classList)).toEqual(expect.arrayContaining(['grid-cols-1', 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]']));
      expect(Array.from(row.classList).some((name) => /^(?:[a-z]+:)?grid-cols-\[2fr/.test(name))).toBe(false);
      for (const label of Array.from(row.querySelectorAll(':scope > label'))) {
        expect(label.classList).toContain('min-w-0');
        expect(Array.from(label.querySelector('input')!.classList)).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
      }
    });

    it('says "Unable to load that playbook." with a retry that loads it again (L3)', () => {
      getById = () => throwError(() => new HttpErrorResponse({ status: 500 }));
      setUp();
      const fixture = TestBed.createComponent(HunterPlaybookStepComponent);
      store.playbookPicker.setValue('pb-c');
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.textContent).toContain('Unable to load that playbook.');

      getById = () => of(buildPlaybook({ id: 'pb-c', gettingStartedText: 'Loaded now.' }));
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retry')!.click();
      fixture.detectChanges();

      expect(element.textContent).not.toContain('Unable to load that playbook.');
      expect(element.textContent).toContain('Loaded now.');
    });

    it('says what the gate still needs only once Next has been pressed', () => {
      const { fixture, element } = renderStep(HunterPlaybookStepComponent, null);
      expect(errors(element)).toEqual([]);

      store.next();
      fixture.detectChanges();

      expect(errors(element)).toEqual(['Choose a playbook.', 'A name is required.']);
    });
  });

  // -------------------------------------------------------------------------------------
  // Step 3, read-only tracks
  // -------------------------------------------------------------------------------------

  describe('step 3, tracks (read-only)', () => {
    const trackSection = (element: HTMLElement, kind: string): HTMLElement[] =>
      Array.from(element.querySelectorAll<HTMLElement>(`section[data-track="${kind}"]`));

    it.each(['The Expert', 'The Flake', 'The Initiate', 'The Monstrous', 'The Mundane', 'The Professional', 'The Crooked'])(
      'shows the one long Luck sentence for %s, including the six whose sheets print the short one (12.13)',
      (name) => {
        const { element } = renderStep(HunterTracksStepComponent, buildPlaybook({ id: 'pb-luck', name }));
        const text = squash(element.textContent);

        expect(LUCK_RULE).toBe('Mark luck to change a roll to 12 or avoid all harm from an injury.');
        expect(text).toContain(LUCK_RULE);
        expect(text.split('Mark luck').length - 1).toBe(1);
      }
    );

    it('shows the box rows as printed, the Harm and Experience sentences, and the playbook\'s Luck special, with nothing to choose', () => {
      const { element } = renderStep(
        HunterTracksStepComponent,
        buildPlaybook({ id: 'pb-t', name: 'The Crooked', luckSpecialText: 'Whenever you spend a Luck point,\nsomeone from your past re-appears.' })
      );
      const [luck] = trackSection(element, 'luck');
      const [harm] = trackSection(element, 'harm');
      const [experience] = trackSection(element, 'experience');

      expect(squash(element.textContent)).toContain('Nothing to choose here — this is what your hunter lives with.');
      expect(luck.querySelectorAll('.track-box')).toHaveLength(7);
      expect(trackLabels(luck)).toEqual(['Okay', 'Doomed']);
      expect(squash(luck.querySelector('.bg-accent-subtle')?.textContent)).toContain('Crooked special');
      expect(luck.querySelector('.bg-accent-subtle .whitespace-pre-line')?.textContent).toBe('Whenever you spend a Luck point,\nsomeone from your past re-appears.');

      expect(harm.querySelectorAll('.track-box')).toHaveLength(7);
      // "Okay bbb|bbbb Dying": the divider sits before the 4th box.
      const row = Array.from(harm.querySelector('[role="img"] > span.flex')!.children);
      expect(row.findIndex((child) => child.classList.contains('unstable-divider'))).toBe(3);
      expect(harmRule(4)).toBe('When you reach 4 or more, mark unstable.');
      expect(squash(harm.textContent)).toContain(harmRule(4));
      expect(trackLabels(harm)).toEqual(['Okay', 'Dying · unstable at 4']);

      expect(experience.querySelectorAll('.track-box')).toHaveLength(5);
      expect(squash(experience.textContent)).toContain(EXPERIENCE_RULE);

      expect(element.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
    });

    it('fills the Harm sentence and the divider from the playbook\'s own unstable threshold', () => {
      const { element } = renderStep(HunterTracksStepComponent, buildPlaybook({ id: 'pb-t5', harmUnstableThreshold: 5, harmBoxCount: 8 }));
      const [harm] = trackSection(element, 'harm');

      expect(squash(harm.textContent)).toContain('When you reach 5 or more, mark unstable.');
      expect(trackLabels(harm)).toEqual(['Okay', 'Dying · unstable at 5']);
      const row = Array.from(harm.querySelector('[role="img"] > span.flex')!.children);
      expect(row.findIndex((child) => child.classList.contains('unstable-divider'))).toBe(4);
      expect(harm.querySelectorAll('.track-box')).toHaveLength(8);
    });

    it('leaves out the special callout when a playbook has none', () => {
      const { element } = renderStep(HunterTracksStepComponent, buildPlaybook({ id: 'pb-t2', luckSpecialText: null }));
      expect(element.querySelector('.bg-accent-subtle')).toBeNull();
    });

    it('shows an extra track with "Okay" when it stores no start label, and a journal\'s fields with no way to add entries', () => {
      const { element } = renderStep(
        HunterTracksStepComponent,
        buildPlaybook({
          id: 'pb-ce',
          name: 'The Curse-Eater',
          extraTracks: [
            { id: 'tr-c', name: 'Corruption', description: '<p>Mark corruption.</p>', effectText: null, boxCount: 7, startLabel: null, endLabel: 'Lost', sortOrder: 0 },
            { id: 'tr-r', name: 'Relationship Status', description: null, effectText: null, boxCount: 4, startLabel: 'Loving', endLabel: 'Broken', sortOrder: 1 },
          ],
          bespokeJournals: [
            { id: 'j1', title: 'Consumed Magic', description: null, effectText: null, sortOrder: 0, fields: [{ id: 'f1', label: 'What the magic was', sortOrder: 0 }, { id: 'f2', label: 'The downside', sortOrder: 1 }] },
          ],
        })
      );
      const [corruption, relationship] = trackSection(element, 'extra');
      const [journal] = trackSection(element, 'journal');

      expect(trackLabels(corruption)).toEqual(['Okay', 'Lost']);
      expect(corruption.querySelectorAll('.track-box')).toHaveLength(7);
      expect(corruption.querySelector('p')?.textContent).toBe('Mark corruption.');
      expect(trackLabels(relationship)).toEqual(['Loving', 'Broken']);
      expect(Array.from(journal.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['What the magic was', 'The downside']);
      expect(journal.textContent).toContain('Entries are added during play.');
      expect(draft.toRequest().extraTracks).toEqual([]);
      expect(draft.toRequest().journalEntries).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------------------
  // Steps 4–6
  // -------------------------------------------------------------------------------------

  describe('step 4, Rules', () => {
    const show = buildPlaybook({
      id: 'pb-spook',
      name: 'The Spooktacular',
      bespokeSections: [
        section('bs-look', 'Look of the Show', { options: [option('opt-glam', 'Glam')] }),
        section('bs-show', 'The Show', { options: [option('opt-favour', 'Infernal Favour', { numericMin: 0, numericMax: 3 })] }),
      ],
    });

    it('renders only the current dot\'s section, in create mode: a picked numeric leaf reads "3 of 3" with no input (L14)', () => {
      const { fixture, element } = renderStep(HunterRulesStepComponent, show);
      store.next();
      store.next();
      store.next();
      fixture.detectChanges();
      expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
      expect(element.textContent).toContain('Glam');
      expect(element.textContent).not.toContain('Infernal Favour');

      store.next();
      draft.toggleBespoke('bs-show', 'opt-favour');
      fixture.detectChanges();

      expect(element.textContent).not.toContain('Glam');
      expect(squash(element.textContent)).toContain('3 of 3');
      expect(element.querySelector('input[type="number"]')).toBeNull();
    });
  });

  describe('step 5, Moves', () => {
    it('says how many moves the playbook gives, and renders move-internal sections in create mode', () => {
      const { fixture, element } = renderStep(
        HunterMovesStepComponent,
        buildPlaybook({
          id: 'pb-m',
          name: 'The Chosen',
          moveGrantCount: 3,
          moves: [
            {
              id: 'mv-req', name: 'Destiny', descriptionText: null, required: true, isAdvanced: false, sortOrder: 0,
              bespokeSections: [section('bs-num', 'Favour', { options: [option('opt-n', 'Favour points', { numericMin: 0, numericMax: 2 })] })],
            },
          ],
        })
      );

      expect(squash(element.querySelector('p')?.textContent)).toBe('You get all the basic moves, plus 3 Chosen moves.');

      draft.toggleBespoke('bs-num', 'opt-n');
      fixture.detectChanges();
      expect(squash(element.textContent)).toContain('2 of 2');
      expect(element.querySelector('input[type="number"]')).toBeNull();
    });

    it.each([
      [0, 'You get all the basic moves.'],
      [1, 'You get all the basic moves, plus 1 Test Subject move.'],
    ])('with a grant of %i says "%s"', (moveGrantCount, line) => {
      const { element } = renderStep(HunterMovesStepComponent, buildPlaybook({ id: 'pb-g', moveGrantCount }));
      expect(squash(element.querySelector('p')?.textContent)).toBe(line);
    });
  });

  describe('step 6, Gear', () => {
    it('renders the shared gear section, or says so when the playbook has no gear', () => {
      const { element } = renderStep(
        HunterGearStepComponent,
        buildPlaybook({ id: 'pb-gear', gearCategories: [{ id: 'gc', label: 'Weapons', pickCount: 1, isOptional: false, sortOrder: 0, options: [{ id: 'go', name: 'Knife', mechanicalText: null, sortOrder: 0 }] }] })
      );
      expect(element.querySelector('[apphuntergearsection]')).toBeTruthy();
      expect(element.textContent).toContain('Knife');

      TestBed.resetTestingModule();
      const empty = renderStep(HunterGearStepComponent, buildPlaybook({ id: 'pb-nogear' }));
      expect(empty.element.querySelector('[apphuntergearsection]')).toBeNull();
      expect(empty.element.textContent).toContain('This playbook has no gear to pick.');
    });
  });

  // -------------------------------------------------------------------------------------
  // Steps 7–8
  // -------------------------------------------------------------------------------------

  describe('step 7, Improvements (read-only)', () => {
    it('shows the leveling-up text, then improvements and advanced improvements as two lists in sort order', () => {
      const { element } = renderStep(
        HunterImprovementsStepComponent,
        buildPlaybook({
          id: 'pb-i',
          levelingUpText: 'When you have filled all five experience boxes, you level up.\nPick an improvement from the following list:',
          improvements: [
            { id: 'i2', text: 'Get +1 Cool, max +2', isAdvanced: false, sortOrder: 1 },
            { id: 'a1', text: 'Retire your hunter to safety.', isAdvanced: true, sortOrder: 0 },
            { id: 'i1', text: 'Get +1 Sharp, max +3', isAdvanced: false, sortOrder: 0 },
          ],
        })
      );

      expect(squash(element.textContent)).toContain('Nothing to choose here — this is how your hunter grows during play.');
      expect(element.querySelector('[data-panel="leveling-up"] .whitespace-pre-line')?.textContent).toBe(
        'When you have filled all five experience boxes, you level up.\nPick an improvement from the following list:'
      );
      expect(Array.from(element.querySelectorAll('[data-list="improvements"] li')).map((li) => li.textContent)).toEqual(['Get +1 Sharp, max +3', 'Get +1 Cool, max +2']);
      expect(Array.from(element.querySelectorAll('[data-list="advanced"] li')).map((li) => li.textContent)).toEqual(['Retire your hunter to safety.']);
      expect(element.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
    });
  });

  describe('step 8, Introductions', () => {
    it('shows the look lines, the Introductions text, and the History prompts with an optional notes box that saves to background', () => {
      const { fixture, element } = renderStep(
        HunterIntroductionsStepComponent,
        buildPlaybook({
          id: 'pb-intro',
          introductionsText: 'Go around the group.\nIntroduce your hunter by name and look.',
          historyPromptsText: 'Go around the group again.\n- One of them saved your life.',
          lookCategories: [{ id: 'lc1', allowsFreeform: true, groupLabel: null, sortOrder: 0, options: [{ id: 'lo1', text: 'haggard face', sortOrder: 0 }] }],
        })
      );

      expect(element.querySelector('[apphunterlooksection]')).toBeTruthy();
      expect(element.querySelector('[data-panel="introductions"] .whitespace-pre-line')?.textContent).toBe('Go around the group.\nIntroduce your hunter by name and look.');
      expect(element.querySelector('[data-panel="history"] .whitespace-pre-line')?.textContent).toBe('Go around the group again.\n- One of them saved your life.');
      expect(squash(element.querySelector('[apphunterhistorysection] label')?.textContent)).toBe('History notes (optional)');

      const notes = element.querySelector('textarea')!;
      notes.value = 'Saved Dana once.';
      notes.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(draft.toRequest().background).toBe('Saved Dana once.');
    });
  });
});
