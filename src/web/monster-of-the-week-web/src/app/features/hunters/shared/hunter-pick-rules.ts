import {
  BespokeOptionResponse,
  BespokeSectionResponse,
  PlaybookDetailResponse,
  PlaybookPickRuleAlternativeResponse,
  PlaybookPickRuleCountResponse,
  PlaybookPickRuleResponse,
} from '../../../core/models';

/**
 * Pick rules on the client (hunter-creation-wizard.md 13.5, following 12.9; Phase 6, R6).
 *
 * The one deliberate client copy of 12.9's evaluation, and a narrow one. It only decides which
 * options are disabled and what the counters, hints and notices say. It never sets a tracker mark
 * or a "Still to finish" line, and it never clears a pick: those come from the server (12.8). If
 * this lookup and the server ever disagree, the server's refusal on save is what the player sees.
 *
 * Pure: no Angular and no signals. `HunterDraft` feeds it picks, and the section components turn
 * its answers into markup. Every name in a message comes from the playbook's own titles, so a rule
 * authored for another playbook reads correctly without a code change (Y9, L33).
 */

/** An allowed number of picks, inclusive at both ends. */
export interface PickRange {
  readonly min: number;
  readonly max: number;
}

/** Picks per governed target: a gear category id, or a top-level bespoke divider id. */
export type TargetPicks = ReadonlyMap<string, number>;

/** An adjustment's trigger option, resolved to its title and its section's title. */
export interface PickRuleTrigger {
  readonly optionId: string;
  readonly title: string;
  readonly sectionId: string;
  readonly sectionTitle: string;
}

export interface PickRuleTriggerSection {
  readonly sectionId: string;
  readonly sectionTitle: string;
}

export interface IndexedPickRule {
  readonly rule: PlaybookPickRuleResponse;
  /** `gear` when its targets are gear categories, otherwise `bespoke` (12.9: never mixed). */
  readonly kind: 'gear' | 'bespoke';
  /** The governed section of a bespoke rule, found through its counts' `bespokeOptionId`. */
  readonly section: BespokeSectionResponse | null;
  /** Governed target ids, in wire order (Y7: by the target's `SortOrder`, then id). */
  readonly targetIds: readonly string[];
  /** The gear category's label, or the divider's title. */
  readonly targetNames: ReadonlyMap<string, string>;
}

export interface PickRuleIndex {
  readonly rules: readonly IndexedPickRule[];
  readonly byTarget: ReadonlyMap<string, IndexedPickRule>;
  /** Bespoke rules only, keyed by the section they govern. */
  readonly bySection: ReadonlyMap<string, IndexedPickRule>;
  readonly triggers: ReadonlyMap<string, PickRuleTrigger>;
}

/** Counts carry no id on the wire; within an alternative a target appears once, so its id keys it. */
export function targetIdOf(count: PlaybookPickRuleCountResponse): string {
  return count.gearCategoryId ?? count.bespokeOptionId ?? '';
}

export function countFor(
  alternative: PlaybookPickRuleAlternativeResponse,
  targetId: string
): PlaybookPickRuleCountResponse | undefined {
  return alternative.counts.find((count) => targetIdOf(count) === targetId);
}

/** Computed once per loaded playbook. A null playbook, or one sent without `pickRules`, has no rules. */
export function indexPickRules(playbook: PlaybookDetailResponse | null): PickRuleIndex {
  const rules: IndexedPickRule[] = [];
  const byTarget = new Map<string, IndexedPickRule>();
  const bySection = new Map<string, IndexedPickRule>();
  const triggers = new Map<string, PickRuleTrigger>();
  if (!playbook) {
    return { rules, byTarget, bySection, triggers };
  }

  // Rules and triggers live only in playbook-level sections (12.9 ValidateGraph, S2).
  const sections = playbook.bespokeSections;
  const gearLabels = new Map(playbook.gearCategories.map((category) => [category.id, category.label]));

  for (const rule of playbook.pickRules ?? []) {
    const targetIds: string[] = [];
    for (const alternative of rule.alternatives) {
      for (const count of alternative.counts) {
        const id = targetIdOf(count);
        if (id && !targetIds.includes(id)) {
          targetIds.push(id);
        }
      }
    }

    const kind = rule.alternatives.some((a) => a.counts.some((c) => c.gearCategoryId !== null)) ? 'gear' : 'bespoke';
    const section =
      kind === 'bespoke' ? (sections.find((s) => s.options.some((o) => targetIds.includes(o.id))) ?? null) : null;
    const targetNames = new Map(
      targetIds.map((id) => [
        id,
        kind === 'gear' ? (gearLabels.get(id) ?? '') : optionTitle(section?.options.find((o) => o.id === id)),
      ])
    );

    const indexed: IndexedPickRule = { rule, kind, section, targetIds, targetNames };
    rules.push(indexed);
    targetIds.forEach((id) => byTarget.set(id, indexed));
    if (section) {
      bySection.set(section.id, indexed);
    }

    for (const alternative of rule.alternatives) {
      for (const count of alternative.counts) {
        for (const optionId of count.adjustment?.triggerOptionIds ?? []) {
          const found = triggers.has(optionId) ? null : findOption(sections, optionId);
          if (found) {
            triggers.set(optionId, {
              optionId,
              title: optionTitle(found.option),
              sectionId: found.section.id,
              sectionTitle: found.section.title,
            });
          }
        }
      }
    }
  }

  return { rules, byTarget, bySection, triggers };
}

// ---------------------------------------------------------------------------------------
// Evaluation (12.9 steps 1–3)
// ---------------------------------------------------------------------------------------

/** Step 1: the adjusted range if any of the count's triggers is picked, otherwise its own (S1). */
export function effectiveRange(count: PlaybookPickRuleCountResponse, triggerIds: ReadonlySet<string>): PickRange {
  const adjustment = count.adjustment;
  if (adjustment && adjustment.triggerOptionIds.some((id) => triggerIds.has(id))) {
    return { min: adjustment.minCount, max: adjustment.maxCount };
  }
  return { min: count.minCount, max: count.maxCount };
}

export function hasFired(count: PlaybookPickRuleCountResponse, triggerIds: ReadonlySet<string>): boolean {
  return count.adjustment?.triggerOptionIds.some((id) => triggerIds.has(id)) ?? false;
}

/** Steps 2–3: some alternative (all are always allowed) has picks ≤ its effective maximum on every target. */
export function fits(rule: PlaybookPickRuleResponse, picks: TargetPicks, triggerIds: ReadonlySet<string>): boolean {
  return rule.alternatives.some((alternative) => alternativeFits(alternative, picks, triggerIds));
}

/** Some alternative has every target within its effective range. */
export function isMet(rule: PlaybookPickRuleResponse, picks: TargetPicks, triggerIds: ReadonlySet<string>): boolean {
  return rule.alternatives.some((alternative) =>
    alternative.counts.every((count) => {
      const range = effectiveRange(count, triggerIds);
      const picked = picksOn(picks, targetIdOf(count));
      return picked >= range.min && picked <= range.max;
    })
  );
}

/**
 * Whether one more pick on this target still fits some alternative, given the picks on the rule's
 * other targets. For a one-alternative rule this is simply "picks below the effective maximum".
 * Unpicked options under a target with no room are disabled; picked ones always stay enabled.
 */
export function hasRoomFor(
  rule: PlaybookPickRuleResponse,
  targetId: string,
  picks: TargetPicks,
  triggerIds: ReadonlySet<string>
): boolean {
  return rule.alternatives.some(
    (alternative) =>
      countFor(alternative, targetId) !== undefined &&
      alternative.counts.every((count) => {
        const id = targetIdOf(count);
        const picked = picksOn(picks, id) + (id === targetId ? 1 : 0);
        return picked <= effectiveRange(count, triggerIds).max;
      })
  );
}

/**
 * Counter styling only: no alternative is met, and this target is below its effective minimum in
 * every alternative that still fits. When none fits (over the limit), every alternative is
 * considered instead, so the other list of an over-limit rule isn't styled short for no reason.
 */
export function isShort(
  rule: PlaybookPickRuleResponse,
  targetId: string,
  picks: TargetPicks,
  triggerIds: ReadonlySet<string>
): boolean {
  if (isMet(rule, picks, triggerIds)) {
    return false;
  }
  const fitting = rule.alternatives.filter((alternative) => alternativeFits(alternative, picks, triggerIds));
  const candidates = fitting.length > 0 ? fitting : rule.alternatives;
  const picked = picksOn(picks, targetId);
  return candidates.every((alternative) => {
    const count = countFor(alternative, targetId);
    return count !== undefined && picked < effectiveRange(count, triggerIds).min;
  });
}

// ---------------------------------------------------------------------------------------
// Wording, all built from data (L24, L25, L30, L33; Y9, Y16)
// ---------------------------------------------------------------------------------------

/** "2" when min = max, otherwise "1–2" (L25). */
export function formatRange(range: PickRange): string {
  return range.min === range.max ? `${range.max}` : `${range.min}–${range.max}`;
}

/**
 * L25, in the same form as the server's refusal suffix (12.9 step 3): the trigger titles joined
 * with "or", their section's title in brackets, and the adjusted range, e.g.
 * "Fighting arts or Obsolete gear (Sect) allow 3." Null once the adjustment has fired.
 */
export function unfiredAdjustmentHint(
  index: PickRuleIndex,
  count: PlaybookPickRuleCountResponse,
  triggerIds: ReadonlySet<string>
): string | null {
  const adjustment = count.adjustment;
  if (!adjustment || hasFired(count, triggerIds)) {
    return null;
  }
  const phrase = triggerGroups(index, adjustment.triggerOptionIds)
    .map((group) => `${group.titles.join(' or ')} (${group.sectionTitle})`)
    .join(' or ');
  return phrase ? `${phrase} allow ${formatRange({ min: adjustment.minCount, max: adjustment.maxCount })}.` : null;
}

/**
 * Y16, shared with 12.9 step 4: while the adjustment hasn't fired, the trigger sections that have
 * no section-level picks at all. Local on purpose: the edit page never calls the check (Y14).
 */
export function unansweredTriggerSections(
  index: PickRuleIndex,
  count: PlaybookPickRuleCountResponse,
  triggerIds: ReadonlySet<string>,
  hasSectionPicks: (sectionId: string) => boolean
): PickRuleTriggerSection[] {
  if (!count.adjustment || hasFired(count, triggerIds)) {
    return [];
  }
  return triggerGroups(index, count.adjustment.triggerOptionIds)
    .filter((group) => !hasSectionPicks(group.sectionId))
    .map(({ sectionId, sectionTitle }) => ({ sectionId, sectionTitle }));
}

export function dependsOnSentence(sectionTitle: string): string {
  return `This depends on your ${sectionTitle} picks.`;
}

/** L30 for a one-alternative rule's list: "Only 2 allowed with your Sect picks." */
export function overLimitNotice(
  index: PickRuleIndex,
  count: PlaybookPickRuleCountResponse,
  triggerIds: ReadonlySet<string>
): string {
  const max = effectiveRange(count, triggerIds).max;
  const titles = triggerGroups(index, count.adjustment?.triggerOptionIds ?? []).map((g) => g.sectionTitle);
  return titles.length > 0 ? `Only ${max} allowed with your ${titles.join(' and ')} picks.` : `Only ${max} allowed.`;
}

/** L30 for a several-alternative rule: "These picks don't fit: {rule label}". */
export function doesNotFitNotice(rule: PlaybookPickRuleResponse): string {
  return rule.label ? `These picks don't fit: ${rule.label}` : "These picks don't fit.";
}

export interface StrandedList {
  readonly targetId: string;
  readonly message: string;
}

/**
 * L24 / 13.7: the one-alternative gear lists whose adjustment is triggered from this section and
 * which are now above their effective maximum, e.g. "Old-fashioned weapons (pick either two or
 * three, as above): 3 picked, but your Sect picks now allow 2." Adding a trigger only widens a
 * range (Q12), so in practice this appears only after one is removed. Nothing is cleared.
 */
export function strandedLists(
  index: PickRuleIndex,
  section: BespokeSectionResponse,
  picksOf: (rule: IndexedPickRule) => TargetPicks,
  triggerIds: ReadonlySet<string>
): StrandedList[] {
  const out: StrandedList[] = [];
  for (const indexed of index.rules) {
    if (indexed.kind !== 'gear' || indexed.rule.alternatives.length !== 1) {
      continue;
    }
    const picks = picksOf(indexed);
    for (const count of indexed.rule.alternatives[0].counts) {
      const fromHere = (count.adjustment?.triggerOptionIds ?? []).some(
        (id) => index.triggers.get(id)?.sectionId === section.id
      );
      const targetId = targetIdOf(count);
      const picked = picksOn(picks, targetId);
      const max = effectiveRange(count, triggerIds).max;
      if (fromHere && picked > max) {
        out.push({
          targetId,
          message: `${indexed.targetNames.get(targetId) ?? ''}: ${picked} picked, but your ${section.title} picks now allow ${max}.`,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Bespoke engagement
// ---------------------------------------------------------------------------------------

/**
 * architecture.md 6.4's rule, client-side: a leaf is engaged when it is ticked, and a category
 * divider is engaged when anything beneath it is. Dividers are never ticked themselves.
 */
export function isEngaged(option: BespokeOptionResponse, picked: ReadonlySet<string>): boolean {
  return option.children.length === 0
    ? picked.has(option.id)
    : option.children.some((child) => isEngaged(child, picked));
}

/** What a bespoke count counts: the divider's engaged direct children (`BespokeEngagement.CountUnder`). */
export function engagedChildCount(option: BespokeOptionResponse, picked: ReadonlySet<string>): number {
  return option.children.filter((child) => isEngaged(child, picked)).length;
}

// ---------------------------------------------------------------------------------------

function picksOn(picks: TargetPicks, targetId: string): number {
  return picks.get(targetId) ?? 0;
}

function alternativeFits(
  alternative: PlaybookPickRuleAlternativeResponse,
  picks: TargetPicks,
  triggerIds: ReadonlySet<string>
): boolean {
  return alternative.counts.every(
    (count) => picksOn(picks, targetIdOf(count)) <= effectiveRange(count, triggerIds).max
  );
}

/** Trigger titles grouped by section, keeping trigger order (Y7 orders them by option `SortOrder`). */
function triggerGroups(
  index: PickRuleIndex,
  triggerOptionIds: readonly string[]
): { sectionId: string; sectionTitle: string; titles: string[] }[] {
  const groups: { sectionId: string; sectionTitle: string; titles: string[] }[] = [];
  for (const id of triggerOptionIds) {
    const trigger = index.triggers.get(id);
    if (!trigger) {
      continue;
    }
    let group = groups.find((g) => g.sectionId === trigger.sectionId);
    if (!group) {
      group = { sectionId: trigger.sectionId, sectionTitle: trigger.sectionTitle, titles: [] };
      groups.push(group);
    }
    group.titles.push(trigger.title);
  }
  return groups;
}

function optionTitle(option: BespokeOptionResponse | undefined): string {
  return (option?.title ?? '').replace(/\{\{blank\}\}/g, '______').trim();
}

function findOption(
  sections: readonly BespokeSectionResponse[],
  optionId: string
): { section: BespokeSectionResponse; option: BespokeOptionResponse } | null {
  const search = (options: readonly BespokeOptionResponse[]): BespokeOptionResponse | null => {
    for (const option of options) {
      if (option.id === optionId) {
        return option;
      }
      const found = search(option.children);
      if (found) {
        return found;
      }
    }
    return null;
  };
  for (const section of sections) {
    const option = search(section.options);
    if (option) {
      return { section, option };
    }
  }
  return null;
}
