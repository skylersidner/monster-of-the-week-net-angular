import {
  HunterEvaluationResponse,
  HunterOutstandingArea,
  HunterOutstandingItem,
  PlaybookDetailResponse,
} from '../../../../core/models';
import { LOOK_SECTION_ANCHOR, bespokeSectionAnchor, gearCategoryAnchor } from '../../shared/sections/section-anchors';
import { HUNTER_STEP } from './hunter-step-model';

/*
 * The wizard's check (hunter-creation-wizard.md 12.8, 13.9; Phase 7, F6), as pure functions: the
 * state the store keeps for `POST /api/hunters/evaluate`, how each stream outcome moves it, and how
 * the "Still to finish" card groups and links the server's items. The store owns the stream.
 */

/** Q8 / L29: the step 8 re-check waits this long after the last edit. */
export const RECHECK_DEBOUNCE_MS = 500;

/** 13.9's state. `lastOk` is the last clean answer, which L5 and the card fall back on. */
export type HunterEvaluationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly lastOk: HunterEvaluationResponse | null }
  | { readonly kind: 'ok'; readonly result: HunterEvaluationResponse }
  | { readonly kind: 'refused'; readonly refusal: string; readonly lastOk: HunterEvaluationResponse | null }
  | { readonly kind: 'failed'; readonly lastOk: HunterEvaluationResponse | null };

/** What the latest-wins stream emits for one check, or `reset` when the check is cleared. */
export type HunterCheckOutcome =
  | { readonly kind: 'started' }
  | { readonly kind: 'answered'; readonly response: HunterEvaluationResponse }
  | { readonly kind: 'failed' }
  | { readonly kind: 'reset' };

export function lastOkOf(state: HunterEvaluationState): HunterEvaluationResponse | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'ok':
      return state.result;
    default:
      return state.lastOk;
  }
}

export function nextEvaluation(state: HunterEvaluationState, outcome: HunterCheckOutcome): HunterEvaluationState {
  const lastOk = lastOkOf(state);
  switch (outcome.kind) {
    case 'reset':
      return { kind: 'idle' };
    case 'started':
      return { kind: 'loading', lastOk };
    case 'failed':
      return { kind: 'failed', lastOk };
    case 'answered':
      return outcome.response.refusal
        ? { kind: 'refused', refusal: outcome.response.refusal, lastOk }
        : { kind: 'ok', result: outcome.response };
  }
}

/** Where a step link goes: a step, a Rules dot, and optionally an element to scroll to once there. */
export interface HunterStepLink {
  readonly step: number;
  readonly sub: number;
  readonly anchor: string | null;
}

export interface OutstandingLine {
  readonly message: string;
  /** Null for an item whose section isn't in the loaded playbook (L8). */
  readonly link: HunterStepLink | null;
}

export interface OutstandingGroup {
  readonly area: HunterOutstandingArea;
  readonly label: string;
  readonly lines: readonly OutstandingLine[];
}

const GROUPS: readonly { readonly area: HunterOutstandingArea; readonly label: string }[] = [
  { area: 'ratings', label: 'Ratings' },
  { area: 'rules', label: 'Rules' },
  { area: 'moves', label: 'Moves' },
  { area: 'gear', label: 'Gear' },
  { area: 'look', label: 'Look' },
];

/**
 * The card's groups, in wizard step order (13.9): Ratings; Rules, ordered by the section's Rules dot;
 * Moves; Gear; Look. Within a group the server's order is kept, which Y8 makes stable across checks.
 * Empty groups are left out.
 */
export function groupOutstanding(
  items: readonly HunterOutstandingItem[],
  playbook: PlaybookDetailResponse | null
): OutstandingGroup[] {
  const sections = playbook?.bespokeSections ?? [];
  const dotOf = (item: HunterOutstandingItem): number => {
    const dot = sections.findIndex((section) => section.id === item.sectionId);
    return dot < 0 ? Number.MAX_SAFE_INTEGER : dot;
  };

  return GROUPS.map(({ area, label }) => {
    const inArea = items.filter((item) => item.area === area);
    const ordered =
      area === 'rules'
        ? inArea
            .map((item, position) => ({ item, position, dot: dotOf(item) }))
            .sort((a, b) => a.dot - b.dot || a.position - b.position)
            .map(({ item }) => item)
        : inArea;
    return { area, label, lines: ordered.map((item) => ({ message: item.message, link: linkFor(item, playbook) })) };
  }).filter((group) => group.lines.length > 0);
}

/** L8: a section id that isn't in the loaded playbook gets no link. A gear line scrolls to its list. */
export function linkFor(item: HunterOutstandingItem, playbook: PlaybookDetailResponse | null): HunterStepLink | null {
  switch (item.area) {
    case 'ratings':
      return { step: HUNTER_STEP.ratings, sub: 0, anchor: null };
    case 'rules': {
      const dot = (playbook?.bespokeSections ?? []).findIndex((section) => section.id === item.sectionId);
      return dot < 0 ? null : { step: HUNTER_STEP.rules, sub: dot, anchor: null };
    }
    case 'moves': {
      if (item.sectionId === null) {
        return { step: HUNTER_STEP.moves, sub: 0, anchor: null };
      }
      const known = (playbook?.moves ?? []).some((move) => move.bespokeSections.some((section) => section.id === item.sectionId));
      return known ? { step: HUNTER_STEP.moves, sub: 0, anchor: bespokeSectionAnchor(item.sectionId) } : null;
    }
    case 'gear':
      return { step: HUNTER_STEP.gear, sub: 0, anchor: item.gearCategoryId ? gearCategoryAnchor(item.gearCategoryId) : null };
    case 'look':
      return { step: HUNTER_STEP.introductions, sub: 0, anchor: LOOK_SECTION_ANCHOR };
    default:
      return null;
  }
}
