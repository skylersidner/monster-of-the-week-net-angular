import { Component, DOCUMENT, Input, inject } from '@angular/core';
import { BespokeSectionResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { BespokeOptionTreeComponent } from '../hunter-form/bespoke-option-tree';
import { IndexedPickRule, StrandedList, doesNotFitNotice, fits, strandedLists } from '../hunter-pick-rules';
import { bespokeSectionAnchor, gearCategoryAnchor, scrollToAnchor } from './section-anchors';
import { HUNTER_SECTION_NAVIGATOR } from './section-navigator';

/**
 * One bespoke section, for both playbook-level rulesets and the ones printed inside a move
 * (hunter-creation-wizard.md 13.6; Phase 5, R5). This was the form's `#bespokeSection` template.
 * One renderer serves both places because only where it renders differs: architecture.md 6.8 says
 * the structure is identical.
 *
 * `mode` only changes the numeric leaf (L14). In `'create'`, the wizard's Rules and Moves steps, it
 * shows as read-only "3 of 3", because the value is play state like Luck. In `'edit'`, the default
 * and the edit page, it stays an input.
 *
 * Under a pick rule (Phase 6, F8c; today Natural Attacks and Combat Magic): the rule's label
 * replaces `sectionProgress`, the governed dividers show "n picked" instead of their own stored
 * range (`governedIds`, L31), and the L30 notice sits under the title when the picks fit no
 * alternative. Locks arrive through `draft.lockedScopes`, on the edit page too, so a level-up pick
 * over the limit stays disabled as extra moves do (Q10).
 *
 * Under the section an adjustment's triggers live in (today the Initiate's Sect), the L24 notice
 * names any gear list that a removed trigger has left over its limit. Nothing is cleared (S5).
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component.
 */
@Component({
  selector: '[appHunterBespokeSection]',
  standalone: true,
  imports: [BespokeOptionTreeComponent],
  templateUrl: './hunter-bespoke-section.html',
  host: { class: 'grid gap-2', '[attr.id]': 'anchor' },
})
export class HunterBespokeSectionComponent {
  readonly draft = inject(HunterDraft);
  private readonly document = inject(DOCUMENT);
  /** Provided by the wizard, where "Go to Gear" is a step link; absent on the edit page, which scrolls. */
  private readonly navigator = inject(HUNTER_SECTION_NAVIGATOR, { optional: true });

  @Input({ required: true }) section!: BespokeSectionResponse;
  @Input() mode: 'create' | 'edit' = 'edit';

  get anchor(): string {
    return bespokeSectionAnchor(this.section.id);
  }

  /** A section with no options and no free-text label is a fixed grant — rules, not a choice. */
  isFixedGrant(section: BespokeSectionResponse): boolean {
    return section.options.length === 0 && section.freeTextLabel === null;
  }

  /** The rule governing this section. Rules never govern repeatable sections (12.9 ValidateGraph). */
  governingRule(): IndexedPickRule | null {
    const indexed = this.draft.pickRules().bySection.get(this.section.id);
    return indexed && !this.draft.isRepeatable(this.section) ? indexed : null;
  }

  governedIds(): ReadonlySet<string> {
    return new Set(this.governingRule()?.targetIds ?? []);
  }

  /** L30 for a several-alternative rule: "These picks don't fit: {rule label}". */
  doesNotFitNotice(): string | null {
    const indexed = this.governingRule();
    if (!indexed) {
      return null;
    }
    const picks = this.draft.targetPicks(indexed);
    return fits(indexed.rule, picks, this.draft.sectionLevelPickedOptionIds()) ? null : doesNotFitNotice(indexed.rule);
  }

  /** L24: gear lists whose adjustment is triggered from this section and that are now over their limit. */
  strandedLists(): StrandedList[] {
    return strandedLists(
      this.draft.pickRules(),
      this.section,
      (indexed) => this.draft.targetPicks(indexed),
      this.draft.sectionLevelPickedOptionIds()
    );
  }

  goToGear(categoryId: string): void {
    if (this.navigator) {
      this.navigator.goToGear(categoryId);
    } else {
      scrollToAnchor(this.document, gearCategoryAnchor(categoryId));
    }
  }
}
