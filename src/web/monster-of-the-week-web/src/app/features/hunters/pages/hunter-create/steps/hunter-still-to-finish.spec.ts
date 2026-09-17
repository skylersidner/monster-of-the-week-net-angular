import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HunterService } from '../../../../../core/hunter';
import { HunterEvaluationResponse, HunterOutstandingItem } from '../../../../../core/models';
import { PlaybookService } from '../../../../../core/playbook';
import { HunterDraft } from '../../../shared/hunter-draft';
import { buildPlaybook, option, section } from '../../../shared/testing/pick-rule-playbooks';
import { HunterCreateStore } from '../hunter-create.store';
import { HUNTER_STEP } from '../hunter-step-model';
import { HunterStillToFinishComponent } from './hunter-still-to-finish';

/** The "Still to finish" card's states (hunter-creation-wizard.md 12.8, 13.9, 13.15 item 5; L6, L8, L20). */

const book = buildPlaybook({ id: 'pb-card', bespokeSections: [section('bs-heat', 'Heat', { options: [option('h1', 'A cop')] })] });
const item = (area: HunterOutstandingItem['area'], message: string, sectionId: string | null = null): HunterOutstandingItem => ({ area, message, sectionId, gearCategoryId: null });
const twoItems: HunterEvaluationResponse = { refusal: null, outstanding: [item('look', 'Look: 1 of 2 lines are unanswered.'), item('rules', 'Heat: 0 of 1 picked.', 'bs-heat')] };
const clean: HunterEvaluationResponse = { refusal: null, outstanding: [] };

describe('HunterStillToFinishComponent', () => {
  let fixture: ComponentFixture<HunterStillToFinishComponent>;
  let store: HunterCreateStore;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        HunterDraft,
        HunterCreateStore,
        { provide: PlaybookService, useValue: { getAll: () => of([]), getById: () => of(book) } },
        { provide: HunterService, useValue: {} },
      ],
    });
    store = TestBed.inject(HunterCreateStore);
    store.playbookPicker.setValue(book.id);
    fixture = TestBed.createComponent(HunterStillToFinishComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const render = (): void => fixture.detectChanges();
  const squash = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
  const state = (): string | null => element.querySelector('[data-state]')?.getAttribute('data-state') ?? null;
  const checking = (): boolean => element.querySelector('[data-status="checking"]') !== null;
  const live = (): HTMLElement => element.querySelector<HTMLElement>('[aria-live]')!;
  const groups = (): string[][] =>
    Array.from(element.querySelectorAll('[data-group]')).map((group) => [
      squash(group.querySelector('span')?.textContent),
      ...Array.from(group.querySelectorAll('li')).map((li) => squash(li.textContent)),
    ]);

  it('before any answer: "Checking what\'s left…"', () => {
    expect(state()).toBe('waiting');
    expect(checking()).toBe(true);
    expect(live().textContent?.trim()).toBe('');
  });

  it('lists items grouped in step order, each a link to its step or Rules dot', () => {
    store.evaluation.set({ kind: 'ok', result: twoItems });
    render();
    const follow = vi.spyOn(store, 'followLink').mockImplementation(() => {});

    expect(state()).toBeNull();
    expect(checking()).toBe(false);
    expect(groups()).toEqual([['Rules', 'Heat: 0 of 1 picked.'], ['Look', 'Look: 1 of 2 lines are unanswered.']]);

    element.querySelector<HTMLButtonElement>('[data-group="rules"] button')!.click();
    expect(follow).toHaveBeenCalledWith({ step: HUNTER_STEP.rules, sub: 0, anchor: null });
  });

  it('says nothing is left when the answer is empty', () => {
    store.evaluation.set({ kind: 'ok', result: clean });
    render();

    expect(state()).toBe('done');
    expect(squash(element.textContent)).toContain('Nothing left to finish. This hunter is ready to play.');
    expect(live().textContent?.trim()).toBe('Nothing left to finish.');
  });

  it('while checking, keeps the previous items with "Checking…", and the live line unchanged (L6, L20)', () => {
    store.evaluation.set({ kind: 'ok', result: twoItems });
    render();
    expect(live().textContent?.trim()).toBe('2 things still to finish.');

    store.evaluation.set({ kind: 'loading', lastOk: twoItems });
    render();
    expect(checking()).toBe(true);
    expect(groups()).toHaveLength(2);
    expect(live().textContent?.trim()).toBe('2 things still to finish.');

    store.evaluation.set({ kind: 'ok', result: { refusal: null, outstanding: [twoItems.outstanding[1]] } });
    render();
    expect(checking()).toBe(false);
    expect(live().getAttribute('aria-live')).toBe('polite');
    expect(live().textContent?.trim()).toBe('1 thing still to finish.');
  });

  it('shows "Checking…" while a step 8 edit waits out its pause (Q8, L29)', () => {
    store.evaluation.set({ kind: 'ok', result: twoItems });
    store.recheckPending.set(true);
    render();

    expect(checking()).toBe(true);
    expect(groups()).toHaveLength(2);
  });

  it('a failed check is information only, over the last clean items', () => {
    store.evaluation.set({ kind: 'failed', lastOk: null });
    render();
    expect(state()).toBe('failed');
    expect(squash(element.textContent)).toContain("Couldn't check what's left.");
    expect(groups()).toEqual([]);

    store.evaluation.set({ kind: 'failed', lastOk: twoItems });
    render();
    expect(state()).toBe('failed');
    expect(groups()).toHaveLength(2);
  });

  it('a refusal lists nothing: the message and its link are in the error band', () => {
    store.evaluation.set({ kind: 'refused', refusal: 'No.', lastOk: twoItems });
    render();

    expect(state()).toBe('refused');
    expect(groups()).toEqual([]);
    expect(element.textContent).not.toContain('No.');
    expect(live().textContent?.trim()).toBe('');
  });
});
