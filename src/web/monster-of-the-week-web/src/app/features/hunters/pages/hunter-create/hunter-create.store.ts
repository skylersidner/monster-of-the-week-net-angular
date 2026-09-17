import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  concat,
  debounceTime,
  defaultIfEmpty,
  defer,
  filter,
  finalize,
  map,
  of,
  skip,
  switchMap,
  tap,
} from 'rxjs';
import { HunterService } from '../../../../core/hunter';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookService } from '../../../../core/playbook';
import {
  BespokeSectionResponse,
  HunterDetailResponse,
  PlaybookDetailResponse,
  PlaybookListItemResponse,
  UpsertHunterRequest,
} from '../../../../core/models';
import { WizardTrackerStep } from '../../../../shared/wizard/wizard-tracker';
import { HunterDraft } from '../../shared/hunter-draft';
import { countFor, effectiveRange, fits } from '../../shared/hunter-pick-rules';
import { bespokeSectionAnchor, gearCategoryAnchor } from '../../shared/sections/section-anchors';
import { HunterSectionNavigator } from '../../shared/sections/section-navigator';
import {
  HunterCheckOutcome,
  HunterEvaluationState,
  HunterStepLink,
  RECHECK_DEBOUNCE_MS,
  nextEvaluation,
} from './hunter-evaluation';
import {
  HUNTER_LAST_STEP,
  HUNTER_START,
  HUNTER_STEP,
  HUNTER_STEP_TITLES,
  HunterStepPosition,
  hunterEyebrow,
  hunterStepBlurb,
  hunterSteps,
  laterPosition,
  nextPosition,
  previousPosition,
} from './hunter-step-model';
import { hunterTrackerMarks } from './hunter-tracker-marks';

/** A switch waiting on the confirmation (7.4, L13). */
export interface PendingPlaybookSwitch {
  readonly playbookId: string;
  readonly playbookName: string;
  readonly fromName: string;
  readonly items: readonly string[];
}

/** What the error band offers beside a refusal (L7, L27). */
export type HunterBandAction =
  | { readonly kind: 'link'; readonly label: string; readonly link: HunterStepLink }
  | { readonly kind: 'reload'; readonly label: string }
  | { readonly kind: 'choosePlaybook'; readonly label: string };

/**
 * The Hunter creation wizard's store (hunter-creation-wizard.md 7, 13.5, 13.7–13.10; Phase 7). Provided
 * on the wizard page next to its own `HunterDraft`, which holds every piece of hunter state. This store
 * holds what the wizard adds around it:
 * - the playbook list and load, and the switch confirmation (F7);
 * - the step model, where the player is and how far they have got, and the step 1 gate (F5);
 * - the check: `evaluation`, its triggers, tracker marks, the refusal band and step links (F6);
 * - the one Create call.
 *
 * Nothing is saved until Create (Skyler: "submitting at the final step should save the full hunter
 * data and land the user on the Hunters list view."). Only step 1 blocks Next (Q1, "Carry on").
 */
@Injectable()
export class HunterCreateStore implements HunterSectionNavigator {
  private readonly draft = inject(HunterDraft);
  private readonly playbookService = inject(PlaybookService);
  private readonly hunterService = inject(HunterService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ---- Playbook list and the chosen playbook

  readonly playbooks = signal<PlaybookListItemResponse[]>([]);
  readonly isLoadingPlaybooks = signal(false);
  readonly playbooksError = signal<string | null>(null);

  /**
   * The picker's own control, not the draft's `playbookId` (13.7). `CustomSelectComponent` commits
   * the moment an option is clicked, so Cancel on the switch confirmation puts this back without the
   * draft ever having changed.
   */
  readonly playbookPicker = new FormControl('', { nonNullable: true });
  readonly isLoadingPlaybook = signal(false);
  readonly playbookError = signal<string | null>(null);
  readonly pendingSwitch = signal<PendingPlaybookSwitch | null>(null);

  private readonly playbookIdRequests = new Subject<string>();

  // ---- Steps and navigation

  readonly steps = computed(() => hunterSteps(this.draft.playbook()));
  readonly current = signal<HunterStepPosition>(HUNTER_START);
  readonly furthest = signal<HunterStepPosition>(HUNTER_START);

  /**
   * The step 1 gate (L3): a chosen playbook that has finished loading, and a non-blank name. A
   * playbook still loading, or one that failed, doesn't count, or Next would land on steps with
   * nothing to render.
   */
  readonly gateOk = computed(() => {
    const playbook = this.draft.playbook();
    const value = this.draft.formValue();
    return (
      !this.isLoadingPlaybook() &&
      playbook !== null &&
      playbook.id === value.playbookId &&
      value.name.trim().length > 0
    );
  });

  /** Set when Next is pressed on step 1 with the gate unmet, so step 1 can say what is missing. */
  readonly gateAttempted = signal(false);

  readonly isLastStep = computed(() => this.current().step === HUNTER_LAST_STEP);
  readonly canGoBack = computed(() => this.current().step > HUNTER_STEP.playbook || this.current().sub > 0);

  /** Changes on every navigation, including between Rules dots; the layout resets scroll and focus on it. */
  readonly stepKey = computed(() => `${this.current().step}-${this.current().sub}`);

  /** The section on the current Rules dot, or null on any other step. */
  readonly currentRulesSection = computed<BespokeSectionResponse | null>(() => {
    const { step, sub } = this.current();
    return step === HUNTER_STEP.rules ? (this.draft.playbook()?.bespokeSections[sub] ?? null) : null;
  });

  readonly eyebrow = computed(() => hunterEyebrow(this.steps(), this.current(), this.draft.playbook()));

  readonly title = computed(() => {
    const key = this.steps()[this.current().step].key;
    return key === 'rules' ? (this.currentRulesSection()?.title ?? HUNTER_STEP_TITLES.rules) : HUNTER_STEP_TITLES[key];
  });

  readonly blurb = computed(() => hunterStepBlurb(this.steps()[this.current().step].key, this.draft.playbook()));

  /** An element to scroll to once the page has rendered a link's target (a gear list, a look section). */
  readonly pendingAnchor = signal<string | null>(null);

  // ---- The check (F6)

  /** The latest check of the draft (13.9). Only the latest request's answer is ever kept. */
  readonly evaluation = signal<HunterEvaluationState>({ kind: 'idle' });

  /** Q8: an edit on the last step is waiting out its pause before the re-check goes. */
  readonly recheckPending = signal(false);

  /** Reload playbook's progress; `gone` when the reload found the playbook deleted (L27). */
  readonly reloadState = signal<'idle' | 'reloading' | 'gone'>('idle');

  /** Every check request, or `null` to clear the check. One stream, so the latest always wins. */
  private readonly checkRequests = new Subject<UpsertHunterRequest | null>();

  /** What Q8 counts as a change: the request with History notes left out. */
  private readonly checkKey = computed(() => {
    this.draft.formValue();
    return JSON.stringify({ ...this.draft.toRequest(), background: null });
  });

  readonly trackerSteps = computed<WizardTrackerStep[]>(() =>
    hunterTrackerMarks({
      steps: this.steps(),
      furthest: this.furthest(),
      gateOk: this.gateOk(),
      playbook: this.draft.playbook(),
      evaluation: this.evaluation(),
    })
  );

  readonly refusal = computed(() => {
    const evaluation = this.evaluation();
    return evaluation.kind === 'refused' ? evaluation.refusal : null;
  });

  // ---- Create

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  /** Set before navigating away after a successful Create, so the discard guard stands aside (13.10). */
  readonly submitted = signal(false);

  /**
   * The layout's error band. A refusal from the check shows on whichever step is current (13.9, L7).
   * A failed Create shows on the last step, where Create is (L10). A playbook the reload found deleted
   * replaces both (L27).
   */
  readonly error = computed(() => {
    if (this.reloadState() === 'gone') {
      return 'That playbook no longer exists.';
    }
    return this.refusal() ?? (this.isLastStep() ? this.submitError() : null);
  });

  /**
   * L7: beside a refusal, a link to the step or Rules dot whose pick rule the picks don't fit, found
   * with the client's lookup (Y13: it only chooses the link). Otherwise Reload playbook.
   */
  readonly bandAction = computed<HunterBandAction | null>(() => {
    const reload = this.reloadState();
    if (reload === 'gone') {
      return { kind: 'choosePlaybook', label: 'Choose a playbook' };
    }
    if (this.refusal() === null) {
      return null;
    }
    return this.pickRuleLink() ?? { kind: 'reload', label: reload === 'reloading' ? 'Reloading…' : 'Reload playbook' };
  });

  /** The first pick rule the picks fit no alternative of; bespoke rules first, as Validate checks them first. */
  private readonly pickRuleLink = computed<HunterBandAction | null>(() => {
    const triggers = this.draft.sectionLevelPickedOptionIds();
    const rules = [...this.draft.pickRules().rules].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'bespoke' ? -1 : 1));
    const broken = rules.find((indexed) => !fits(indexed.rule, this.draft.targetPicks(indexed), triggers));
    if (!broken) {
      return null;
    }
    if (broken.kind === 'gear') {
      const picks = this.draft.targetPicks(broken);
      const over =
        broken.targetIds.find((id) =>
          broken.rule.alternatives.every((alternative) => {
            const count = countFor(alternative, id);
            return count !== undefined && (picks.get(id) ?? 0) > effectiveRange(count, triggers).max;
          })
        ) ?? broken.targetIds[0];
      return { kind: 'link', label: 'Go to Gear', link: { step: HUNTER_STEP.gear, sub: 0, anchor: gearCategoryAnchor(over) } };
    }
    const sub = (this.draft.playbook()?.bespokeSections ?? []).findIndex((section) => section.id === broken.section?.id);
    return broken.section && sub >= 0
      ? { kind: 'link', label: `Go to ${broken.section.title}`, link: { step: HUNTER_STEP.rules, sub, anchor: null } }
      : null;
  });

  constructor() {
    this.playbookPicker.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((playbookId) => this.requestPlaybook(playbookId));

    // switchMap: a newer choice cancels a fetch still in flight for the previous one, so a slow
    // response can never land after, and overwrite, a later one (13.11 item 5).
    this.playbookIdRequests
      .pipe(
        switchMap((playbookId) => this.fetchPlaybook(playbookId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((outcome) => this.applyPlaybookOutcome(outcome));

    // The check stream (13.9, L6). switchMap: a newer request unsubscribes from the one in flight,
    // which aborts its XHR, so only the latest answer is ever applied, whatever order they arrive in.
    this.checkRequests
      .pipe(
        switchMap((request) => (request === null ? of<HunterCheckOutcome>({ kind: 'reset' }) : this.check(request))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((outcome) => this.evaluation.set(nextEvaluation(this.evaluation(), outcome)));

    // Q8 / L29: on the last step, re-check once the player has stopped changing the draft for 500 ms.
    // History notes never affect what's left (Q4), so a change there alone isn't a change here.
    toObservable(this.checkKey)
      .pipe(
        skip(1),
        filter(() => this.isLastStep() && this.gateOk()),
        tap(() => this.recheckPending.set(true)),
        debounceTime(RECHECK_DEBOUNCE_MS),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        // Cleared by a navigation since the edit: that navigation already checked this draft.
        if (!this.recheckPending()) {
          return;
        }
        this.recheckPending.set(false);
        if (this.isLastStep()) {
          this.requestCheck();
        }
      });
  }

  /** Loads the picker's playbook list. Called once by the page. */
  init(): void {
    this.isLoadingPlaybooks.set(true);
    this.playbooksError.set(null);
    this.playbookService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playbooks) => {
          this.playbooks.set(playbooks);
          this.isLoadingPlaybooks.set(false);
        },
        error: () => {
          this.playbooksError.set('Unable to load playbooks.');
          this.isLoadingPlaybooks.set(false);
        },
      });
  }

  // ---------------------------------------------------------------------------------------
  // Choosing and switching playbook (F7: 7.4, 13.7, L13)
  // ---------------------------------------------------------------------------------------

  /**
   * The picker changed. With nothing yet that belongs to the current playbook, it switches at once.
   * Otherwise it asks first, listing what would be cleared (`draft.playbookScopedSummary()`).
   */
  requestPlaybook(playbookId: string): void {
    if (playbookId === this.draft.form.controls.playbookId.value) {
      return;
    }
    const items = this.draft.playbookScopedSummary();
    if (items.length === 0) {
      this.switchPlaybook(playbookId);
      return;
    }
    this.pendingSwitch.set({
      playbookId,
      playbookName: this.playbooks().find((playbook) => playbook.id === playbookId)?.name ?? 'this playbook',
      fromName: this.draft.playbook()?.name ?? 'your current playbook',
      items,
    });
  }

  confirmSwitch(): void {
    const pending = this.pendingSwitch();
    if (!pending) {
      return;
    }
    this.pendingSwitch.set(null);
    this.switchPlaybook(pending.playbookId);
  }

  /** Puts the picker back on the draft's playbook without emitting, so nothing reloads or clears. */
  cancelSwitch(): void {
    if (!this.pendingSwitch()) {
      return;
    }
    this.pendingSwitch.set(null);
    this.playbookPicker.setValue(this.draft.form.controls.playbookId.value, { emitEvent: false });
  }

  /**
   * Makes `playbookId` the draft's playbook: sets it, loads it, and the load prunes whatever doesn't
   * belong to it (today's `dropSelectionsOutside`, which is what 7.4's and L13's "clear" means). The
   * furthest step reached goes back to step 1, because every later step belonged to the old playbook,
   * and the check is cleared, cancelling one in flight. Name, pronouns and History notes are untouched.
   */
  switchPlaybook(playbookId: string): void {
    this.draft.form.controls.playbookId.setValue(playbookId);
    if (this.playbookPicker.value !== playbookId) {
      this.playbookPicker.setValue(playbookId, { emitEvent: false });
    }
    this.furthest.set(HUNTER_START);
    this.current.set(HUNTER_START);
    this.submitError.set(null);
    this.reloadState.set('idle');
    this.recheckPending.set(false);
    this.checkRequests.next(null);
    this.playbookIdRequests.next(playbookId);
  }

  /** L3's retry after "Unable to load that playbook." */
  retryPlaybook(): void {
    this.playbookIdRequests.next(this.draft.form.controls.playbookId.value);
  }

  // ---------------------------------------------------------------------------------------
  // Navigation (7.2, L4) and step links (F6)
  // ---------------------------------------------------------------------------------------

  next(): void {
    const at = this.current();
    if (at.step === HUNTER_STEP.playbook && !this.gateOk()) {
      this.gateAttempted.set(true);
      this.draft.form.controls.name.markAsTouched();
      return;
    }
    if (at.step === HUNTER_LAST_STEP) {
      return;
    }
    this.moveTo(nextPosition(this.steps(), at));
  }

  /** Always allowed, and never loses anything: every step reads and writes the same draft (7.2). */
  back(): void {
    if (!this.canGoBack()) {
      return;
    }
    this.moveTo(previousPosition(this.steps(), this.current()));
  }

  /**
   * A tracker jump or a step link. Allowed to step 1 always; anywhere else only while the gate holds,
   * to an applicable step no later than the furthest reached (L3, L4). Clicking a bubble lands on its
   * first Rules dot; `sub` is for links that name a dot.
   */
  jumpTo(step: number, sub = 0): void {
    const model = this.steps()[step];
    if (!model || !model.applicable) {
      return;
    }
    if (step !== HUNTER_STEP.playbook && (!this.gateOk() || step > this.furthest().step)) {
      return;
    }
    this.moveTo({ step, sub: Math.min(Math.max(sub, 0), model.subCount - 1) });
  }

  /**
   * Follows a card line, the band's link, or a section's "Go to" (L7, L8, L24, L25). On another step it
   * jumps there; either way the page then scrolls to the link's anchor, if it has one.
   */
  followLink(link: HunterStepLink): void {
    const at = this.current();
    if (at.step !== link.step || at.sub !== link.sub) {
      this.jumpTo(link.step, link.sub);
      const moved = this.current();
      if (moved.step !== link.step || moved.sub !== Math.min(link.sub, this.steps()[link.step].subCount - 1)) {
        return;
      }
    }
    if (link.anchor) {
      this.pendingAnchor.set(link.anchor);
    }
  }

  /** "Go to {section}" under an unfired-adjustment hint: that section's Rules dot. */
  goToSection(sectionId: string): void {
    const sub = (this.draft.playbook()?.bespokeSections ?? []).findIndex((section) => section.id === sectionId);
    if (sub >= 0) {
      this.followLink({ step: HUNTER_STEP.rules, sub, anchor: bespokeSectionAnchor(sectionId) });
    }
  }

  /** "Go to Gear" under a Sect notice: the Gear step, scrolled to that list. */
  goToGear(categoryId: string): void {
    this.followLink({ step: HUNTER_STEP.gear, sub: 0, anchor: gearCategoryAnchor(categoryId) });
  }

  runBandAction(action: HunterBandAction): void {
    switch (action.kind) {
      case 'link':
        this.followLink(action.link);
        return;
      case 'reload':
        this.reloadPlaybook();
        return;
      case 'choosePlaybook':
        this.jumpTo(HUNTER_STEP.playbook);
        return;
    }
  }

  /**
   * L7's Reload playbook: re-fetch it, prune, say what was cleared, and check again. A 404 means the
   * playbook is gone, and the band says so with a link to step 1 (L27).
   */
  reloadPlaybook(): void {
    const playbookId = this.draft.form.controls.playbookId.value;
    if (!playbookId || this.reloadState() === 'reloading') {
      return;
    }
    this.reloadState.set('reloading');
    this.playbookService
      .getById(playbookId, { suppressErrorToast: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playbook) => {
          const before = this.draft.toRequest();
          this.draft.playbook.set(playbook);
          this.draft.prune(playbook);
          this.reloadState.set('idle');
          this.notificationService.success(reloadedMessage(playbook.name, clearedPicks(before, this.draft.toRequest())));
          this.requestCheck();
        },
        error: (error: unknown) => {
          if ((error as { status?: unknown } | null)?.status === 404) {
            this.reloadState.set('gone');
            return;
          }
          this.reloadState.set('idle');
          this.notificationService.error('Unable to reload that playbook. Please try again.');
        },
      });
  }

  // ---------------------------------------------------------------------------------------
  // Create (7.6, 13.10, L10)
  // ---------------------------------------------------------------------------------------

  /**
   * Creates the hunter from `draft.toRequest()`. Returns at once while a Create is in flight; the
   * disabled "Creating…" button is the only other double-submit protection needed (B8). A pending or
   * in-flight check is irrelevant: Create sends its own request.
   */
  create(): void {
    if (this.isSubmitting() || !this.gateOk()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.hunterService
      .create(this.draft.toRequest())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (hunter) => {
          this.submitted.set(true);
          this.notificationService.success(createdMessage(hunter));
          void this.router.navigate(['/hunters']);
        },
        error: (error: unknown) => {
          // The draft stays intact, and the check runs again so the band and card match (13.10).
          this.submitError.set(createErrorMessage(error));
          this.requestCheck();
        },
      });
  }

  /** The one navigation mutation. Every navigation checks the draft afterwards (12.8). */
  private moveTo(position: HunterStepPosition): void {
    this.current.set(position);
    this.furthest.update((furthest) => laterPosition(furthest, position));
    this.recheckPending.set(false);
    this.requestCheck();
  }

  /** A snapshot of the draft at this moment, so later edits never leak into it. Never while the gate fails. */
  private requestCheck(): void {
    if (this.gateOk()) {
      this.checkRequests.next(this.draft.toRequest());
    }
  }

  /** `loading`, then the answer. An error, or an empty stream (a 401 swallowed into EMPTY), is `failed`. */
  private check(request: UpsertHunterRequest): Observable<HunterCheckOutcome> {
    return concat(
      of<HunterCheckOutcome>({ kind: 'started' }),
      defer(() => this.hunterService.evaluate(request)).pipe(
        map((response): HunterCheckOutcome => ({ kind: 'answered', response })),
        defaultIfEmpty<HunterCheckOutcome, HunterCheckOutcome>({ kind: 'failed' }),
        catchError(() => of<HunterCheckOutcome>({ kind: 'failed' }))
      )
    );
  }

  private fetchPlaybook(playbookId: string) {
    if (!playbookId) {
      return of<PlaybookLoadOutcome>({ kind: 'empty' });
    }

    this.isLoadingPlaybook.set(true);
    this.playbookError.set(null);
    return this.playbookService.getById(playbookId).pipe(
      map((playbook): PlaybookLoadOutcome => ({ kind: 'loaded', playbook })),
      catchError(() => of<PlaybookLoadOutcome>({ kind: 'error' }))
    );
  }

  private applyPlaybookOutcome(outcome: PlaybookLoadOutcome): void {
    this.isLoadingPlaybook.set(false);
    if (outcome.kind !== 'loaded') {
      this.draft.playbook.set(null);
      this.playbookError.set(outcome.kind === 'error' ? 'Unable to load that playbook.' : null);
      return;
    }
    this.draft.playbook.set(outcome.playbook);
    this.playbookError.set(null);
    this.draft.prune(outcome.playbook);
  }
}

/** `Hunter "{name}" created.`, plus what is left when the 201 says anything is (L10, B7). */
export function createdMessage(hunter: HunterDetailResponse): string {
  const count = hunter.outstanding.length;
  const base = `Hunter "${hunter.name}" created.`;
  return count === 0 ? base : `${base} ${count} ${count === 1 ? 'thing' : 'things'} still to finish.`;
}

/**
 * L10: the server's `message` when a refusal carries one; "Unable to create hunter." for a 400
 * ProblemDetails without one (B5); "Unable to create hunter. Please try again." for a network error
 * (status 0) or a 5xx.
 */
export function createErrorMessage(error: unknown): string {
  const response = error as { status?: unknown; error?: { message?: unknown } } | null;
  const status = typeof response?.status === 'number' ? response.status : null;
  if (status === 0 || (status !== null && status >= 500)) {
    return 'Unable to create hunter. Please try again.';
  }
  const message = response?.error?.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : 'Unable to create hunter.';
}

/** What a reload's prune removed, in the switch confirmation's vocabulary (13.7). Prune only removes. */
export function clearedPicks(before: UpsertHunterRequest, after: UpsertHunterRequest): string[] {
  const cleared: string[] = [];
  const lost = (noun: string, from: readonly unknown[], to: readonly unknown[]): void => {
    const count = from.length - to.length;
    if (count > 0) {
      cleared.push(`${count} ${noun}${count === 1 ? '' : 's'}`);
    }
  };
  if (before.playbookStatArrayOptionId && !after.playbookStatArrayOptionId) {
    cleared.push('Rating line');
  }
  lost('move', before.playbookMoveIds, after.playbookMoveIds);
  lost('rules answer', [...before.bespokeSelections, ...before.bespokeInstances], [...after.bespokeSelections, ...after.bespokeInstances]);
  lost('gear pick', before.playbookGearOptionIds, after.playbookGearOptionIds);
  lost('look line', before.looks, after.looks);
  return cleared;
}

export function reloadedMessage(playbookName: string, cleared: readonly string[]): string {
  return cleared.length === 0
    ? `Reloaded ${playbookName}. Nothing needed clearing.`
    : `Reloaded ${playbookName}. Cleared: ${cleared.join(', ')}.`;
}

type PlaybookLoadOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'error' }
  | { readonly kind: 'loaded'; readonly playbook: PlaybookDetailResponse };
