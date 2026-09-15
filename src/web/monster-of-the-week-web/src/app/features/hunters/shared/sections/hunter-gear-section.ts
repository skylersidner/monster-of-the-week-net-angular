import { Component, inject } from '@angular/core';
import { PlaybookGearCategoryResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';

/**
 * Gear categories in order (hunter-creation-wizard.md 13.6; Phase 5, R5). A category with a
 * `pickCount` is a choice with a hint, a counter and a ceiling. A null `pickCount` means every
 * option is granted, so it renders as a read-only "You get" list with no checkbox, and the
 * draft never sends those ids (Gap 6, B6, L15). The label renders as stored, including the
 * Initiate's armour paragraph (Q11).
 *
 * Phase 6 seam (F8b): for a category that a pick rule governs, `gearCategoryHint` is hidden (L31),
 * and the limit and counter come from `hasRoomFor` / `isShort` and the effective range, not from
 * `draft.isGearLimitReached` / `draft.isGearPickShort` and the stored `pickCount`. The L25 hint and
 * the L30 notice go under the category heading. Nothing is governed until then.
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

  gearCategoryHint(category: PlaybookGearCategoryResponse): string {
    const limit = category.pickCount === null ? 'any number' : `${category.pickCount}`;
    return category.isOptional ? `Optional — pick ${limit}` : `Pick ${limit}`;
  }
}
