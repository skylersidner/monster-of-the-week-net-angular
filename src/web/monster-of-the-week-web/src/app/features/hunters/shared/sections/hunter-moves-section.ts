import { Component, inject } from '@angular/core';
import { HunterDraft } from '../hunter-draft';
import { HunterBespokeSectionComponent } from './hunter-bespoke-section';

/**
 * Required moves, the pick pool with its counter against the budget (B1), and each move's own
 * sections through `HunterBespokeSectionComponent` (hunter-creation-wizard.md 13.6; Phase 5, R5).
 *
 * Advanced moves are never offered: `HunterDraft.pickableMoves` leaves them out. Unticking a move
 * clears its sections' state inside the draft (`toggleMove`), not here.
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component.
 */
@Component({
  selector: '[appHunterMovesSection]',
  standalone: true,
  imports: [HunterBespokeSectionComponent],
  templateUrl: './hunter-moves-section.html',
  host: { class: 'grid gap-[0.6rem]' },
})
export class HunterMovesSectionComponent {
  readonly draft = inject(HunterDraft);
}
