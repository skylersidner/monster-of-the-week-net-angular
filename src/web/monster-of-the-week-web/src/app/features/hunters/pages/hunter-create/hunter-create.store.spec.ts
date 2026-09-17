import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EMPTY, Observable, Subject, of, throwError } from 'rxjs';

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
import {
  INITIATE,
  MONSTROUS,
  buildPlaybook,
  initiatePlaybook,
  monstrousPlaybook,
  option,
  section,
} from '../../shared/testing/pick-rule-playbooks';
import { HunterCreateStore, createErrorMessage } from './hunter-create.store';
import { RECHECK_DEBOUNCE_MS } from './hunter-evaluation';
import { HUNTER_LAST_STEP, HUNTER_START, HUNTER_STEP } from './hunter-step-model';

/**
 * `HunterCreateStore` (hunter-creation-wizard.md 13.15 item 6; F5: L3, L4, L10, L21; F6: 13.9, L5–L8,
 * L29; F7: 7.4, L13).
 */

const crooked = buildPlaybook({
  id: 'pb-crooked',
  name: 'The Crooked',
  moveGrantCount: 2,
  statArrayOptions: [{ id: 'sa-1', charm: 1, cool: 0, sharp: 2, tough: -1, weird: 1, sortOrder: 0 }],
  moves: [
    { id: 'mv-1', name: 'Artful', descriptionText: null, required: false, isAdvanced: false, sortOrder: 0, bespokeSections: [] },
    { id: 'mv-2', name: 'Burglar', descriptionText: null, required: false, isAdvanced: false, sortOrder: 1, bespokeSections: [] },
  ],
  bespokeSections: [
    section('bs-background', 'Background', { options: [option('bg-1', 'Hitman')] }),
    section('bs-heat', 'Heat', { options: [option('heat-1', 'A cop')] }),
    section('bs-underworld', 'Underworld'),
  ],
});
const celebrity = buildPlaybook({ id: 'pb-celebrity', name: 'The Celebrity' });
const chosen = buildPlaybook({ id: 'pb-chosen', name: 'The Chosen', bespokeSections: [section('bs-fate', 'Fate')] });
const byId: Record<string, PlaybookDetailResponse> = {
  [crooked.id]: crooked,
  [celebrity.id]: celebrity,
  [chosen.id]: chosen,
  [INITIATE.playbookId]: initiatePlaybook,
  [MONSTROUS.playbookId]: monstrousPlaybook,
};
const list: PlaybookListItemResponse[] = Object.values(byId).map((p) => ({
  id: p.id, name: p.name, statArrayOptionCount: 0, moveCount: p.moves.length, bespokeSectionCount: p.bespokeSections.length,
}));

const clean: HunterEvaluationResponse = { refusal: null, outstanding: [] };
const ratingsShort: HunterEvaluationResponse = {
  refusal: null,
  outstanding: [{ area: 'ratings', sectionId: null, gearCategoryId: null, message: 'Choose a rating array.' }],
};
const refused = (message: string) => (): Observable<HunterEvaluationResponse> => of({ refusal: message, outstanding: [] });

function created(overrides: Partial<HunterDetailResponse> = {}): HunterDetailResponse {
  return {
    id: 'h-new', name: 'Rook', pronouns: null, playbookId: crooked.id, playbookName: crooked.name,
    playbookStatArrayOptionId: null, luck: 0, harm: 0, experience: 0, background: null,
    playbookMoveIds: [], playbookGearOptionIds: [], looks: [], extraTracks: [],
    bespokeSelections: [], bespokeInstances: [], journalEntries: [], outstanding: [], createdAt: '2026-09-15T00:00:00Z',
    ...overrides,
  };
}

describe('HunterCreateStore', () => {
  let store: HunterCreateStore;
  let draft: HunterDraft;
  let router: Router;
  let notifications: NotificationService;
  let getById: (id: string) => Observable<PlaybookDetailResponse>;
  let createResponse: () => Observable<HunterDetailResponse>;
  let createCalls: UpsertHunterRequest[];
  let evaluateResponse: (request: UpsertHunterRequest) => Observable<HunterEvaluationResponse>;
  let evaluateCalls: UpsertHunterRequest[];

  beforeEach(() => {
    getById = (id) => of(byId[id]);
    createResponse = () => of(created());
    createCalls = [];
    evaluateResponse = () => of(clean);
    evaluateCalls = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        HunterDraft,
        HunterCreateStore,
        { provide: PlaybookService, useValue: { getAll: () => of(list), getById: (id: string) => getById(id) } },
        {
          provide: HunterService,
          useValue: {
            create: (request: UpsertHunterRequest) => {
              createCalls.push(request);
              return createResponse();
            },
            evaluate: (request: UpsertHunterRequest) => {
              evaluateCalls.push(request);
              return evaluateResponse(request);
            },
          },
        },
      ],
    });
    store = TestBed.inject(HunterCreateStore);
    draft = TestBed.inject(HunterDraft);
    router = TestBed.inject(Router);
    notifications = TestBed.inject(NotificationService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function start(playbookId = crooked.id, name = 'Rook'): void {
    store.playbookPicker.setValue(playbookId);
    draft.form.controls.name.setValue(name);
  }

  function walkToLastStep(): void {
    for (let i = 0; i < 20 && !store.isLastStep(); i++) {
      store.next();
    }
  }

  function walkTo(step: number): void {
    for (let i = 0; i < 20 && store.current().step < step; i++) {
      store.next();
    }
  }

  function subjects(): Subject<HunterEvaluationResponse>[] {
    const made: Subject<HunterEvaluationResponse>[] = [];
    evaluateResponse = () => {
      const response = new Subject<HunterEvaluationResponse>();
      made.push(response);
      return response;
    };
    return made;
  }

  // -------------------------------------------------------------------------------------
  // The step 1 gate (L3)
  // -------------------------------------------------------------------------------------

  describe('the step 1 gate (L3)', () => {
    it('blocks Next with no playbook chosen, and records the attempt so step 1 can say why', () => {
      draft.form.controls.name.setValue('Rook');

      store.next();

      expect(store.current()).toEqual(HUNTER_START);
      expect(store.gateOk()).toBe(false);
      expect(store.gateAttempted()).toBe(true);
    });

    it('blocks Next with a blank or whitespace name, and marks the name touched', () => {
      start(crooked.id, '   ');

      store.next();

      expect(store.current()).toEqual(HUNTER_START);
      expect(draft.form.controls.name.touched).toBe(true);
    });

    it('blocks Next while the playbook is still loading and after it failed, and lets a retry through', () => {
      const load$ = new Subject<PlaybookDetailResponse>();
      getById = () => load$;
      start();

      expect(store.isLoadingPlaybook()).toBe(true);
      expect(store.gateOk()).toBe(false);
      store.next();
      expect(store.current()).toEqual(HUNTER_START);

      load$.error(new HttpErrorResponse({ status: 500 }));
      expect(store.isLoadingPlaybook()).toBe(false);
      expect(store.playbookError()).toBe('Unable to load that playbook.');
      expect(store.gateOk()).toBe(false);
      store.next();
      expect(store.current()).toEqual(HUNTER_START);

      getById = (id) => of(byId[id]);
      store.retryPlaybook();
      expect(store.playbookError()).toBeNull();
      expect(store.gateOk()).toBe(true);
      store.next();
      expect(store.current()).toEqual({ step: HUNTER_STEP.ratings, sub: 0 });
    });

    it('blocks Next while a newly chosen playbook loads, though the previous one is still in the draft', () => {
      start();
      expect(store.gateOk()).toBe(true);
      const load$ = new Subject<PlaybookDetailResponse>();
      getById = () => load$;

      store.playbookPicker.setValue(celebrity.id);

      // The draft still holds the old playbook until the new one arrives: "chosen" is not "loaded".
      expect(draft.playbook()?.id).toBe(crooked.id);
      expect(store.gateOk()).toBe(false);
      store.next();
      expect(store.current()).toEqual(HUNTER_START);

      load$.next(celebrity);
      load$.complete();
      expect(store.gateOk()).toBe(true);
    });

    it('holds only on step 1: with nothing else chosen, Next walks every step to the last (Carry on)', () => {
      start();
      const visited: number[] = [];

      for (let i = 0; i < 20 && !store.isLastStep(); i++) {
        store.next();
        visited.push(store.current().step);
      }

      expect(visited).toEqual([1, 2, 3, 3, 3, 4, 5, 6, 7]);
      expect(draft.toRequest().playbookMoveIds).toEqual([]);
    });

    it('blocks tracker jumps out of step 1 while it fails, even to steps already reached', () => {
      start();
      store.next();
      store.next();
      store.jumpTo(HUNTER_STEP.playbook);
      draft.form.controls.name.setValue('');

      store.jumpTo(HUNTER_STEP.ratings);

      expect(store.current()).toEqual(HUNTER_START);
      expect(store.trackerSteps().map((s) => s.clickable)).toEqual([true, false, false, false, false, false, false, false]);
    });
  });

  // -------------------------------------------------------------------------------------
  // Navigation (7.2, L4)
  // -------------------------------------------------------------------------------------

  describe('navigation', () => {
    it('walks Rules dot by dot, then on to Moves; Back returns through the dots from the last one', () => {
      start();
      const walk = (move: () => void, times: number) => Array.from({ length: times }, () => (move(), store.current()));

      expect(walk(() => store.next(), 6)).toEqual([
        { step: 1, sub: 0 }, { step: 2, sub: 0 }, { step: 3, sub: 0 }, { step: 3, sub: 1 }, { step: 3, sub: 2 }, { step: 4, sub: 0 },
      ]);
      expect(walk(() => store.back(), 5)).toEqual([
        { step: 3, sub: 2 }, { step: 3, sub: 1 }, { step: 3, sub: 0 }, { step: 2, sub: 0 }, { step: 1, sub: 0 },
      ]);
    });

    it('skips Rules both ways when the playbook has no playbook-level sections', () => {
      start(celebrity.id);
      store.next();
      store.next();

      store.next();
      expect(store.current()).toEqual({ step: HUNTER_STEP.moves, sub: 0 });

      store.back();
      expect(store.current()).toEqual({ step: HUNTER_STEP.tracks, sub: 0 });
    });

    it('never loses anything going Back: every step reads and writes the same draft', () => {
      start();
      store.next();
      draft.form.controls.playbookStatArrayOptionId.setValue('sa-1');
      for (let i = 0; i < 5; i++) store.next();
      draft.toggleMove('mv-1');
      draft.toggleBespoke('bs-heat', 'heat-1');
      const before = draft.toRequest();

      for (let i = 0; i < 10; i++) store.back();

      expect(store.current()).toEqual(HUNTER_START);
      expect(store.canGoBack()).toBe(false);
      expect(draft.toRequest()).toStrictEqual(before);
    });

    it('stays on the last step on Next', () => {
      start();
      walkToLastStep();

      store.next();

      expect(store.current()).toEqual({ step: HUNTER_LAST_STEP, sub: 0 });
      expect(store.isLastStep()).toBe(true);
    });

    it('records the furthest position reached, per Rules dot, and never moves it back', () => {
      start();
      for (let i = 0; i < 4; i++) store.next();
      expect(store.furthest()).toEqual({ step: 3, sub: 1 });

      store.back();
      store.back();
      store.back();

      expect(store.current()).toEqual({ step: 1, sub: 0 });
      expect(store.furthest()).toEqual({ step: 3, sub: 1 });
    });

    it('jumps to any applicable step up to the furthest step reached, landing on the first Rules dot', () => {
      start();
      for (let i = 0; i < 6; i++) store.next();
      expect(store.current()).toEqual({ step: 4, sub: 0 });

      store.jumpTo(HUNTER_STEP.rules);
      expect(store.current()).toEqual({ step: 3, sub: 0 });

      store.jumpTo(HUNTER_STEP.gear);
      expect(store.current()).toEqual({ step: 3, sub: 0 });

      store.jumpTo(HUNTER_STEP.moves);
      expect(store.current()).toEqual({ step: 4, sub: 0 });

      store.jumpTo(HUNTER_STEP.playbook);
      expect(store.current()).toEqual(HUNTER_START);

      // A link naming a dot lands on that dot.
      store.jumpTo(HUNTER_STEP.rules, 2);
      expect(store.current()).toEqual({ step: 3, sub: 2 });
    });

    it('never jumps to a Rules step that does not apply', () => {
      start(celebrity.id);
      for (let i = 0; i < 3; i++) store.next();

      store.jumpTo(HUNTER_STEP.rules);

      expect(store.current()).toEqual({ step: HUNTER_STEP.moves, sub: 0 });
    });

    it('drops picks that do not belong to a newly chosen playbook', () => {
      start();
      draft.toggleMove('mv-1');
      draft.toggleBespoke('bs-heat', 'heat-1');
      expect(draft.isMoveSelected('mv-1')).toBe(true);

      // Switching playbooks: the previous playbook's ids would otherwise stay in the sets, invisible
      // because nothing renders them, and be rejected by the server on Create. With picks in place
      // the switch asks first (F7); confirming is what prunes.
      store.playbookPicker.setValue(celebrity.id);
      store.confirmSwitch();

      expect(draft.playbook()?.id).toBe(celebrity.id);
      expect(draft.isMoveSelected('mv-1')).toBe(false);
      expect(draft.picksFor('bs-heat').size).toBe(0);
    });

    it('does not let a slow response for the previous playbook overwrite a newer one (item 5, switchMap)', () => {
      const slow$ = new Subject<PlaybookDetailResponse>();
      const fast$ = new Subject<PlaybookDetailResponse>();
      getById = (id) => (id === crooked.id ? slow$ : fast$);

      // Two picker changes in quick succession, the way a user clicking around the list produces.
      store.playbookPicker.setValue(crooked.id);
      store.playbookPicker.setValue(celebrity.id);

      // The fast request resolves first...
      fast$.next(celebrity);
      fast$.complete();
      // ...then the stale one finally arrives. switchMap already cancelled its subscription.
      slow$.next(crooked);
      slow$.complete();

      expect(draft.playbook()?.id).toBe(celebrity.id);
      expect(store.isLoadingPlaybook()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------------------
  // Tracker, eyebrow, titles
  // -------------------------------------------------------------------------------------

  describe('tracker, eyebrow and titles', () => {
    it('maps the store onto the tracker: marks from the gate, visits and the check, unreached beyond the furthest', () => {
      evaluateResponse = () =>
        of({ refusal: null, outstanding: [{ area: 'rules', sectionId: 'bs-background', gearCategoryId: null, message: 'Background: 0 of 1 picked.' }] });
      start();
      for (let i = 0; i < 4; i++) store.next();

      const tracker = store.trackerSteps();
      expect(tracker.map((s) => s.status)).toEqual(['finished', 'finished', 'finished', 'visited', 'unreached', 'unreached', 'unreached', 'unreached']);
      expect(tracker[HUNTER_STEP.rules].subSteps).toEqual(['visited', 'finished', 'unreached']);
    });

    it('titles Rules by its section and numbers the eyebrow with fixed 8-step numbering (L21)', () => {
      start();
      for (let i = 0; i < 4; i++) store.next();

      expect(store.eyebrow()).toBe('Step 4 of 8 · Crooked rules · 2 of 3');
      expect(store.title()).toBe('Heat');
      expect(store.blurb()).toContain('Crooked');
      expect(store.stepKey()).toBe('3-1');

      store.next();
      expect(store.stepKey()).toBe('3-2');
      expect(store.title()).toBe('Underworld');

      store.next();
      expect(store.eyebrow()).toBe('Step 5 of 8');
      expect(store.title()).toBe('What Can They Do?');
      expect(store.currentRulesSection()).toBeNull();
    });

    it('keeps Moves at step 5 of 8 when Rules is skipped', () => {
      start(celebrity.id);
      for (let i = 0; i < 3; i++) store.next();

      expect(store.eyebrow()).toBe('Step 5 of 8');
      expect(store.trackerSteps()[HUNTER_STEP.rules].status).toBe('notApplicable');
    });
  });

  // -------------------------------------------------------------------------------------
  // The check (F6: 12.8, 13.9, L5, L6)
  // -------------------------------------------------------------------------------------

  describe('the check', () => {
    it('checks on Next, Back, tracker jumps and arriving at the last step, each with the draft as it is at that moment', () => {
      start();
      expect(evaluateCalls).toHaveLength(0);

      store.next();
      expect(evaluateCalls).toHaveLength(1);

      draft.form.controls.playbookStatArrayOptionId.setValue('sa-1');
      store.back();
      expect(evaluateCalls).toHaveLength(2);
      expect(evaluateCalls[0].playbookStatArrayOptionId).toBeNull();
      expect(evaluateCalls[1].playbookStatArrayOptionId).toBe('sa-1');

      store.jumpTo(HUNTER_STEP.ratings);
      expect(evaluateCalls).toHaveLength(3);

      walkToLastStep();
      expect(evaluateCalls.at(-1)).toStrictEqual(draft.toRequest());
      expect(store.evaluation()).toEqual({ kind: 'ok', result: clean });
    });

    it('never checks while the step 1 gate fails', () => {
      draft.form.controls.name.setValue('No Playbook Yet');
      store.next();
      store.jumpTo(HUNTER_STEP.playbook);
      expect(evaluateCalls).toHaveLength(0);

      start();
      store.next();
      store.jumpTo(HUNTER_STEP.playbook);
      expect(evaluateCalls).toHaveLength(2);

      draft.form.controls.name.setValue('');
      store.jumpTo(HUNTER_STEP.playbook);
      store.next();
      expect(evaluateCalls).toHaveLength(2);
    });

    it('loads with the last clean answer kept, and applies only the latest answer when they arrive out of order', () => {
      const responses = subjects();
      start();
      store.next();
      responses[0].next(ratingsShort);
      responses[0].complete();
      expect(store.evaluation()).toEqual({ kind: 'ok', result: ratingsShort });

      store.next();
      expect(store.evaluation()).toEqual({ kind: 'loading', lastOk: ratingsShort });

      store.next();
      expect(responses[1].observed).toBe(false);

      responses[2].next(clean);
      responses[2].complete();
      responses[1].next({ refusal: 'Too late to count.', outstanding: [] });
      expect(store.evaluation()).toEqual({ kind: 'ok', result: clean });
    });

    it('reads an error, and a request that ends with no answer (a swallowed 401), as failed, keeping the last clean answer and never toasting', () => {
      evaluateResponse = () => of(ratingsShort);
      start();
      store.next();

      evaluateResponse = () => throwError(() => new HttpErrorResponse({ status: 500 }));
      store.next();
      expect(store.evaluation()).toEqual({ kind: 'failed', lastOk: ratingsShort });

      evaluateResponse = () => EMPTY;
      store.next();
      expect(store.evaluation()).toEqual({ kind: 'failed', lastOk: ratingsShort });

      expect(store.error()).toBeNull();
      expect(notifications.notifications()).toEqual([]);
    });

    it('a refusal shows in the band on whichever step is current, and a clean answer clears it', () => {
      evaluateResponse = refused('That is an advanced move.');
      start();
      store.next();

      expect(store.error()).toBe('That is an advanced move.');
      expect(store.bandAction()).toEqual({ kind: 'reload', label: 'Reload playbook' });

      evaluateResponse = () => of(clean);
      store.next();
      expect(store.error()).toBeNull();
      expect(store.bandAction()).toBeNull();
    });

    it('checks again after a failed Create (13.10)', () => {
      createResponse = () => throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'No.' } }));
      start();
      walkToLastStep();
      const calls = evaluateCalls.length;

      store.create();

      expect(evaluateCalls).toHaveLength(calls + 1);
    });

    it('a playbook switch clears the check and cancels one in flight', () => {
      const responses = subjects();
      start();
      store.next();
      store.jumpTo(HUNTER_STEP.playbook);
      expect(responses[1].observed).toBe(true);

      store.playbookPicker.setValue(celebrity.id);

      expect(store.evaluation()).toEqual({ kind: 'idle' });
      expect(responses[1].observed).toBe(false);
      responses[1].next(clean);
      expect(store.evaluation()).toEqual({ kind: 'idle' });
    });
  });

  // -------------------------------------------------------------------------------------
  // The step 8 re-check (Q8, L29)
  // -------------------------------------------------------------------------------------

  describe('the step 8 re-check (Q8, L29)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const edit = (change: () => void): void => {
      change();
      TestBed.tick();
    };

    function onLastStep(): number {
      start();
      walkToLastStep();
      TestBed.tick();
      return evaluateCalls.length;
    }

    it('does not re-check for edits on any other step', () => {
      start();
      walkTo(HUNTER_STEP.moves);
      TestBed.tick();
      const calls = evaluateCalls.length;

      edit(() => draft.toggleMove('mv-1'));
      // Not even pending: an edit off the last step never starts the pause.
      expect(store.recheckPending()).toBe(false);
      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS * 2);

      expect(evaluateCalls).toHaveLength(calls);
      expect(store.recheckPending()).toBe(false);
    });

    it('re-checks once, 500 ms after the last of several quick edits, and says it is pending meanwhile', () => {
      const calls = onLastStep();

      edit(() => draft.setLookFreeform('lc-none', 'ignored, no such line'));
      edit(() => draft.form.controls.pronouns.setValue('she/her'));
      vi.advanceTimersByTime(300);
      edit(() => draft.form.controls.playbookStatArrayOptionId.setValue('sa-1'));
      expect(store.recheckPending()).toBe(true);

      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS - 1);
      expect(evaluateCalls).toHaveLength(calls);

      vi.advanceTimersByTime(1);
      expect(evaluateCalls).toHaveLength(calls + 1);
      expect(evaluateCalls.at(-1)?.playbookStatArrayOptionId).toBe('sa-1');
      expect(store.recheckPending()).toBe(false);
    });

    it('does not re-check for an edit to History notes alone (Q4)', () => {
      const calls = onLastStep();

      edit(() => draft.form.controls.background.setValue('Grew up rough.'));
      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS * 2);

      expect(evaluateCalls).toHaveLength(calls);
      expect(store.recheckPending()).toBe(false);
    });

    it('does not re-check if the player leaves the last step before the pause ends', () => {
      const calls = onLastStep();

      edit(() => draft.form.controls.pronouns.setValue('he/him'));
      vi.advanceTimersByTime(200);
      store.back();
      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS * 2);

      // Only Back's own check.
      expect(evaluateCalls).toHaveLength(calls + 1);
      expect(store.recheckPending()).toBe(false);
    });

    it('a navigation cancels a re-check already in flight', () => {
      onLastStep();
      const responses = subjects();

      edit(() => draft.form.controls.pronouns.setValue('he/him'));
      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS);
      expect(responses).toHaveLength(1);
      expect(responses[0].observed).toBe(true);

      store.back();
      expect(responses).toHaveLength(2);
      expect(responses[0].observed).toBe(false);

      responses[0].next({ refusal: 'Stale.', outstanding: [] });
      responses[1].next(clean);
      expect(store.evaluation()).toEqual({ kind: 'ok', result: clean });
    });

    it('a re-check cancels a navigation check still in flight', () => {
      start();
      walkTo(HUNTER_STEP.improvements);
      TestBed.tick();
      const responses = subjects();

      store.next();
      expect(store.isLastStep()).toBe(true);
      expect(responses[0].observed).toBe(true);

      edit(() => draft.form.controls.pronouns.setValue('they/them'));
      vi.advanceTimersByTime(RECHECK_DEBOUNCE_MS);

      expect(responses).toHaveLength(2);
      expect(responses[0].observed).toBe(false);
      responses[1].next(ratingsShort);
      expect(store.evaluation()).toEqual({ kind: 'ok', result: ratingsShort });
    });
  });

  // -------------------------------------------------------------------------------------
  // The refusal band and step links (L7, L24, L25, L27)
  // -------------------------------------------------------------------------------------

  describe('the refusal band and step links', () => {
    it('links to Gear when the Initiate\'s weapons fit no alternative, scrolling to the list that is over', () => {
      evaluateResponse = refused('"Old-fashioned weapons" allows 2 picks, but 3 were made.');
      start(INITIATE.playbookId);
      walkTo(HUNTER_STEP.gear);
      ['of-sword', 'of-axe', 'of-staff'].forEach((id) => draft.toggleGear(id));
      store.next();

      const action = store.bandAction();
      expect(action).toEqual({ kind: 'link', label: 'Go to Gear', link: { step: HUNTER_STEP.gear, sub: 0, anchor: `hunter-gear-${INITIATE.oldFashioned}` } });

      store.runBandAction(action!);
      expect(store.current()).toEqual({ step: HUNTER_STEP.gear, sub: 0 });
      expect(store.pendingAnchor()).toBe(`hunter-gear-${INITIATE.oldFashioned}`);
    });

    it('links to the Rules dot when Natural Attacks fit no alternative', () => {
      evaluateResponse = refused('"Natural Attacks" allows: Pick a Base and add an extra to it, or two Bases.');
      start(MONSTROUS.playbookId);
      walkTo(HUNTER_STEP.rules);
      ['nb-teeth', 'nb-claws', 'ne-harm'].forEach((id) => draft.toggleBespoke(MONSTROUS.naturalAttacks, id));
      store.next();

      expect(store.bandAction()).toEqual({ kind: 'link', label: 'Go to Natural Attacks', link: { step: HUNTER_STEP.rules, sub: 0, anchor: null } });
      store.runBandAction(store.bandAction()!);
      expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
    });

    it('offers Reload playbook for any other refusal: it re-fetches, prunes, says what it cleared and checks again', () => {
      evaluateResponse = refused('That move is not in this playbook.');
      start();
      store.next();
      draft.toggleMove('mv-1');
      draft.toggleMove('mv-2');
      store.next();
      expect(store.bandAction()).toEqual({ kind: 'reload', label: 'Reload playbook' });

      getById = () => of({ ...crooked, moves: [crooked.moves[1]] });
      evaluateResponse = () => of(clean);
      const calls = evaluateCalls.length;
      store.runBandAction(store.bandAction()!);

      expect(draft.isMoveSelected('mv-1')).toBe(false);
      expect(draft.isMoveSelected('mv-2')).toBe(true);
      expect(notifications.notifications().map((n) => n.message)).toEqual(['Reloaded The Crooked. Cleared: 1 move.']);
      expect(evaluateCalls).toHaveLength(calls + 1);
      expect(store.error()).toBeNull();
    });

    it('says the playbook no longer exists when the reload finds it gone, and links back to step 1 (L27)', () => {
      evaluateResponse = refused('The playbook for this hunter no longer exists.');
      start();
      store.next();
      store.next();
      getById = () => throwError(() => new HttpErrorResponse({ status: 404 }));

      store.reloadPlaybook();

      expect(store.error()).toBe('That playbook no longer exists.');
      expect(store.bandAction()).toEqual({ kind: 'choosePlaybook', label: 'Choose a playbook' });
      expect(notifications.notifications()).toEqual([]);

      store.runBandAction(store.bandAction()!);
      expect(store.current()).toEqual(HUNTER_START);
    });

    it('turns the sections\' "Go to" buttons into step and Rules-dot links (goToSection, goToGear)', () => {
      start(INITIATE.playbookId);
      walkTo(HUNTER_STEP.gear);

      store.goToSection(INITIATE.sect);
      expect(store.current()).toEqual({ step: HUNTER_STEP.rules, sub: 0 });
      expect(store.pendingAnchor()).toBe(`hunter-section-${INITIATE.sect}`);

      store.goToGear(INITIATE.oldFashioned);
      expect(store.current()).toEqual({ step: HUNTER_STEP.gear, sub: 0 });
      expect(store.pendingAnchor()).toBe(`hunter-gear-${INITIATE.oldFashioned}`);

      store.goToSection('not-a-section');
      expect(store.current()).toEqual({ step: HUNTER_STEP.gear, sub: 0 });
    });

    it('a link to the current step only scrolls, and a link past the furthest step does nothing', () => {
      start();
      walkTo(HUNTER_STEP.moves);
      const calls = evaluateCalls.length;

      store.followLink({ step: HUNTER_STEP.moves, sub: 0, anchor: 'hunter-section-x' });
      expect(store.pendingAnchor()).toBe('hunter-section-x');
      expect(evaluateCalls).toHaveLength(calls);

      store.pendingAnchor.set(null);
      store.followLink({ step: HUNTER_STEP.introductions, sub: 0, anchor: 'hunter-look' });
      expect(store.current()).toEqual({ step: HUNTER_STEP.moves, sub: 0 });
      expect(store.pendingAnchor()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------------------
  // The playbook-switch confirmation (F7: 7.4, 13.7, L13)
  // -------------------------------------------------------------------------------------

  describe('the playbook-switch confirmation', () => {
    it('switches at once when nothing belongs to the current playbook yet', () => {
      start();
      draft.form.controls.pronouns.setValue('she/her');

      store.playbookPicker.setValue(celebrity.id);

      expect(store.pendingSwitch()).toBeNull();
      expect(draft.playbook()?.id).toBe(celebrity.id);
    });

    it('asks first when picks belong to the current playbook, listing what would be cleared', () => {
      store.init();
      start();
      draft.form.controls.playbookStatArrayOptionId.setValue('sa-1');
      draft.toggleMove('mv-1');
      draft.toggleBespoke('bs-heat', 'heat-1');

      store.playbookPicker.setValue(chosen.id);

      expect(store.pendingSwitch()).toEqual({ playbookId: chosen.id, playbookName: 'The Chosen', fromName: 'The Crooked', items: ['Rating line', '1 move', 'Heat'] });
      expect(draft.playbook()?.id).toBe(crooked.id);
      expect(draft.formValue().playbookId).toBe(crooked.id);
    });

    it('Cancel puts the picker back without emitting, and changes nothing', () => {
      start();
      draft.toggleMove('mv-1');
      store.playbookPicker.setValue(chosen.id);
      const emitted: string[] = [];
      const subscription = store.playbookPicker.valueChanges.subscribe((value) => emitted.push(value));

      store.cancelSwitch();
      subscription.unsubscribe();

      expect(store.pendingSwitch()).toBeNull();
      expect(store.playbookPicker.value).toBe(crooked.id);
      expect(emitted).toEqual([]);
      expect(draft.playbook()?.id).toBe(crooked.id);
      expect(draft.isMoveSelected('mv-1')).toBe(true);
    });

    it('Confirm prunes the old playbook\'s picks, resets the furthest step, clears the check, and keeps name, pronouns and History notes', () => {
      start();
      draft.form.controls.pronouns.setValue('she/her');
      draft.form.controls.background.setValue('Grew up rough.');
      for (let i = 0; i < 6; i++) store.next();
      draft.toggleMove('mv-1');
      store.jumpTo(HUNTER_STEP.playbook);
      expect(store.evaluation().kind).toBe('ok');

      store.playbookPicker.setValue(chosen.id);
      store.confirmSwitch();

      expect(store.pendingSwitch()).toBeNull();
      expect(store.furthest()).toEqual(HUNTER_START);
      expect(store.current()).toEqual(HUNTER_START);
      expect(store.evaluation()).toEqual({ kind: 'idle' });
      expect(store.trackerSteps().map((s) => s.status)).toEqual(['finished', 'unreached', 'unreached', 'unreached', 'unreached', 'unreached', 'unreached', 'unreached']);
      const request = draft.toRequest();
      expect([request.playbookId, request.name, request.pronouns, request.background, request.playbookMoveIds]).toEqual([chosen.id, 'Rook', 'she/her', 'Grew up rough.', []]);
    });
  });

  // -------------------------------------------------------------------------------------
  // Create (7.6, 13.10, L10)
  // -------------------------------------------------------------------------------------

  describe('Create', () => {
    it('sends draft.toRequest(), sets submitted before navigating to /hunters, and toasts', () => {
      let submittedWhenNavigating: boolean | null = null;
      vi.mocked(router.navigate).mockImplementation(() => {
        submittedWhenNavigating = store.submitted();
        return Promise.resolve(true);
      });
      start();
      draft.form.controls.pronouns.setValue('he/him');
      walkToLastStep();

      store.create();

      expect(createCalls).toEqual([draft.toRequest()]);
      expect(submittedWhenNavigating).toBe(true);
      expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/hunters']);
      expect(notifications.notifications().map((n) => [n.kind, n.message])).toEqual([['success', 'Hunter "Rook" created.']]);
      expect(store.isSubmitting()).toBe(false);
    });

    it.each([
      [['Moves: 0 of 2 picked.'], 'Hunter "Rook" created. 1 thing still to finish.'],
      [['Moves: 0 of 2 picked.', 'Look: 2 of 2 lines are unanswered.'], 'Hunter "Rook" created. 2 things still to finish.'],
    ])('adds the outstanding count to the toast when the created hunter has any (B7)', (outstanding, message) => {
      createResponse = () => of(created({ outstanding }));
      start();

      store.create();

      expect(notifications.notifications().map((n) => n.message)).toEqual([message]);
    });

    it('shows a refusal\'s own message in the band on the last step, keeps the draft, and does not navigate', () => {
      createResponse = () => throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'That is an advanced move.' } }));
      start();
      draft.toggleMove('mv-1');
      walkToLastStep();
      const before = draft.toRequest();

      store.create();

      expect(store.submitError()).toBe('That is an advanced move.');
      expect(store.error()).toBe('That is an advanced move.');
      expect(store.submitted()).toBe(false);
      expect(store.isSubmitting()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(notifications.notifications()).toEqual([]);
      expect(draft.toRequest()).toStrictEqual(before);

      // A failed Create belongs to the last step, where Create is (L10).
      store.back();
      expect(store.error()).toBeNull();
      store.next();
      expect(store.error()).toBe('That is an advanced move.');
    });

    it('falls back to "Unable to create hunter." for a 400 ProblemDetails with no message (B5)', () => {
      createResponse = () =>
        throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'One or more validation errors occurred.', status: 400, errors: { Name: ['Too long.'] } } }));
      start();

      store.create();

      expect(store.submitError()).toBe('Unable to create hunter.');
      expect(store.isSubmitting()).toBe(false);
    });

    it.each([
      ['a network error (status 0)', 0],
      ['a 500', 500],
      ['a 503', 503],
    ])('says "Unable to create hunter. Please try again." for %s', (_, status) => {
      createResponse = () => throwError(() => new HttpErrorResponse({ status, error: { message: 'ignored' } }));
      start();

      store.create();

      expect(store.submitError()).toBe('Unable to create hunter. Please try again.');
      expect(store.isSubmitting()).toBe(false);
    });

    it('ignores a second Create while one is in flight, and clears isSubmitting when it settles', () => {
      const response$ = new Subject<HunterDetailResponse>();
      createResponse = () => response$;
      start();

      store.create();
      store.create();

      expect(createCalls).toHaveLength(1);
      expect(store.isSubmitting()).toBe(true);

      response$.next(created());
      response$.complete();
      expect(store.isSubmitting()).toBe(false);
      expect(store.submitted()).toBe(true);
    });

    it('clears isSubmitting when the request ends with no response (a 401 the auth interceptor swallowed)', () => {
      createResponse = () => EMPTY;
      start();

      store.create();

      expect(store.isSubmitting()).toBe(false);
      expect(store.submitted()).toBe(false);
      expect(store.submitError()).toBeNull();
    });

    it('does not create while the step 1 gate fails', () => {
      draft.form.controls.name.setValue('No Playbook');

      store.create();

      expect(createCalls).toEqual([]);
    });

    it('reads a non-HTTP error as a plain failure', () => {
      expect(createErrorMessage(new Error('boom'))).toBe('Unable to create hunter.');
      expect(createErrorMessage(null)).toBe('Unable to create hunter.');
    });
  });

  // -------------------------------------------------------------------------------------
  // The playbook list
  // -------------------------------------------------------------------------------------

  it('loads the playbook list on init, and says so when it cannot', () => {
    store.init();
    expect(store.playbooks()).toEqual(list);
    expect(store.isLoadingPlaybooks()).toBe(false);

    TestBed.inject(PlaybookService).getAll = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    store.init();
    expect(store.playbooksError()).toBe('Unable to load playbooks.');
    expect(store.isLoadingPlaybooks()).toBe(false);
  });
});
