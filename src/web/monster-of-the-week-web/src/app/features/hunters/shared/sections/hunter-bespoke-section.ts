import { Component, Input, inject } from '@angular/core';
import { BespokeSectionResponse } from '../../../../core/models';
import { HunterDraft } from '../hunter-draft';
import { BespokeOptionTreeComponent } from '../hunter-form/bespoke-option-tree';

/**
 * One bespoke section, for both playbook-level rulesets and the ones printed inside a move
 * (hunter-creation-wizard.md 13.6; Phase 5, R5). This was the form's `#bespokeSection` template.
 * One renderer serves both places because only where it renders differs: architecture.md 6.8 says
 * the structure is identical.
 *
 * `mode` only changes the numeric leaf (L14). In `'create'` it shows as read-only "3 of 3". That
 * is the Phase 7 wizard, where the value is play state like Luck. In `'edit'`, the default, it
 * stays an input. Today's single-page create page is not the wizard, so it keeps the default
 * until L17 retires it.
 *
 * Phase 6 seam (F8c): for a section that a pick rule governs, the rule label replaces
 * `sectionProgress`, and the tree gains `governedIds` to hide the governed dividers' own hints
 * (L31). The L25 counters and the L30 notice sit under the title, and locks keep arriving through
 * `draft.lockedScopes`. The L24 Sect notice (F8b) also renders here, under its section.
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component.
 */
@Component({
  selector: '[appHunterBespokeSection]',
  standalone: true,
  imports: [BespokeOptionTreeComponent],
  templateUrl: './hunter-bespoke-section.html',
  host: { class: 'grid gap-2' },
})
export class HunterBespokeSectionComponent {
  readonly draft = inject(HunterDraft);

  @Input({ required: true }) section!: BespokeSectionResponse;
  @Input() mode: 'create' | 'edit' = 'edit';

  /** A section with no options and no free-text label is a fixed grant — rules, not a choice. */
  isFixedGrant(section: BespokeSectionResponse): boolean {
    return section.options.length === 0 && section.freeTextLabel === null;
  }
}
