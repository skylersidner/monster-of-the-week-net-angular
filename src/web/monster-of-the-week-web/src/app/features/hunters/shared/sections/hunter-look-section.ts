import { Component, computed, inject } from '@angular/core';
import { PlaybookLookCategoryResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { LOOK_SECTION_ANCHOR } from './section-anchors';

/**
 * One answer per look line: a printed chip or the player's own words (hunter-creation-wizard.md
 * 13.6; Phase 5, R5). Behaviour is unchanged from the single form. The host carries an id so the
 * wizard's "Still to finish" look lines can scroll to it (L8).
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component.
 */
@Component({
  selector: '[appHunterLookSection]',
  standalone: true,
  templateUrl: './hunter-look-section.html',
  host: { class: 'grid gap-[0.6rem]', '[attr.id]': 'anchor' },
})
export class HunterLookSectionComponent {
  readonly anchor = LOOK_SECTION_ANCHOR;

  readonly draft = inject(HunterDraft);

  /**
   * Look categories in sort order, with consecutive runs that share a `groupLabel` collapsed
   * into one group. Only The Forged uses this (its "Human look" / "Weapon look" split), and
   * grouping by consecutive run rather than by distinct label keeps the sheet's own ordering
   * intact instead of reordering lines to gather labels together.
   */
  readonly lookGroups = computed<LookGroup[]>(() => {
    const groups: LookGroup[] = [];
    for (const category of this.draft.playbook()?.lookCategories ?? []) {
      const label = category.groupLabel ?? null;
      const open = groups.at(-1);
      if (open && open.label === label) {
        open.categories.push(category);
      } else {
        groups.push({ label, categories: [category] });
      }
    }
    return groups;
  });
}

interface LookGroup {
  readonly label: string | null;
  readonly categories: PlaybookLookCategoryResponse[];
}
