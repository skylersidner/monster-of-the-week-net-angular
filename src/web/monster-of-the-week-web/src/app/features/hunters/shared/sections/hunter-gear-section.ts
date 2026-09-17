import { Component, DOCUMENT, inject } from '@angular/core';
import { PlaybookGearCategoryResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import {
  countFor,
  dependsOnSentence,
  doesNotFitNotice,
  effectiveRange,
  fits,
  formatRange,
  isShort,
  overLimitNotice,
  unansweredTriggerSections,
  unfiredAdjustmentHint,
} from '../hunter-pick-rules';
import { bespokeSectionAnchor, gearCategoryAnchor, scrollToAnchor } from './section-anchors';
import { HUNTER_SECTION_NAVIGATOR } from './section-navigator';

/** What a gear category governed by a pick rule shows under its printed heading (L25, L30, L31). */
export interface GearRuleView {
  /** "2 of 3 picked", "1 of 1–2 picked"; "n picked" under a several-alternative rule. */
  readonly counter: string;
  readonly over: boolean;
  readonly short: boolean;
  /** L25: "Fighting arts or Obsolete gear (Sect) allow 3." while the adjustment hasn't fired. */
  readonly hint: string | null;
  /** Y16: "This depends on your Sect picks.", one per trigger section with no picks yet. */
  readonly dependsOn: readonly { readonly sectionId: string; readonly sectionTitle: string; readonly sentence: string }[];
  /** L30: "Only 2 allowed with your Sect picks." Picked options stay enabled; nothing is cleared. */
  readonly notice: string | null;
}

/**
 * Gear categories in order (hunter-creation-wizard.md 13.6; Phase 5, R5). A category with a
 * `pickCount` is a choice with a hint, a counter and a ceiling. A null `pickCount` means every
 * option is granted, so it renders as a read-only "You get" list with no checkbox, and the
 * draft never sends those ids (Gap 6, B6, L15). The label renders as stored, including the
 * Initiate's armour paragraph (Q11).
 *
 * Under a pick rule (Phase 6, F8b; today the Initiate's two weapons lists): the printed heading
 * stays as it is, `gearCategoryHint`'s "Pick 3" / "Pick 2" is hidden (L31), and the counter and
 * the lock come from the effective range (`draft.gearHasRoom`), not the stored `pickCount`. The
 * L25 hint and the L30 notice sit under the heading. No rule or alternative labels. Every word
 * of those comes from the playbook's own titles (L33).
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component.
 */
@Component({
  selector: '[appHunterGearSection]',
  standalone: true,
  templateUrl: './hunter-gear-section.html',
  host: { class: 'grid gap-[0.6rem]' },
})
export class HunterGearSectionComponent {
  readonly draft = inject(HunterDraft);
  private readonly document = inject(DOCUMENT);
  /** Provided by the wizard, where "Go to {section}" is a Rules-dot link; absent on the edit page, which scrolls. */
  private readonly navigator = inject(HUNTER_SECTION_NAVIGATOR, { optional: true });

  readonly gearAnchor = gearCategoryAnchor;

  gearCategoryHint(category: PlaybookGearCategoryResponse): string {
    const limit = category.pickCount === null ? 'any number' : `${category.pickCount}`;
    return category.isOptional ? `Optional — pick ${limit}` : `Pick ${limit}`;
  }

  /** Null for a category no pick rule governs, which keeps its Phase 5 hint and counter. */
  ruleView(category: PlaybookGearCategoryResponse): GearRuleView | null {
    const indexed = this.draft.gearRuleFor(category);
    if (!indexed) {
      return null;
    }
    const picks = this.draft.targetPicks(indexed);
    const triggers = this.draft.sectionLevelPickedOptionIds();
    const picked = picks.get(category.id) ?? 0;
    const short = isShort(indexed.rule, category.id, picks, triggers);

    const count = indexed.rule.alternatives.length === 1 ? countFor(indexed.rule.alternatives[0], category.id) : undefined;
    if (!count) {
      // Several alternatives on gear: no seeded rule has this shape. Count, and say when it doesn't fit.
      return {
        counter: `${picked} picked`,
        over: false,
        short,
        hint: null,
        dependsOn: [],
        notice: fits(indexed.rule, picks, triggers) ? null : doesNotFitNotice(indexed.rule),
      };
    }

    const index = this.draft.pickRules();
    const range = effectiveRange(count, triggers);
    const over = picked > range.max;
    return {
      counter: `${picked} of ${formatRange(range)} picked`,
      over,
      short,
      hint: unfiredAdjustmentHint(index, count, triggers),
      dependsOn: unansweredTriggerSections(index, count, triggers, (sectionId) => this.draft.picksFor(sectionId).size > 0).map(
        (section) => ({ ...section, sentence: dependsOnSentence(section.sectionTitle) })
      ),
      notice: over ? overLimitNotice(index, count, triggers) : null,
    };
  }

  goToSection(sectionId: string): void {
    if (this.navigator) {
      this.navigator.goToSection(sectionId);
    } else {
      scrollToAnchor(this.document, bespokeSectionAnchor(sectionId));
    }
  }
}
