import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HunterDraft } from '../hunter-draft';

/**
 * The playbook's rating lines, one radio card per line (hunter-creation-wizard.md 13.6; Phase 5, R5).
 * Used by the edit page now, and by the wizard's Ratings step in Phase 7.
 *
 * Each card is a 5-column grid, the stat name above its signed value, so the lines read as a
 * table (Rosalina 3.3 step 2, L16). The old `flex flex-wrap` put the values at different
 * x-positions from line to line.
 *
 * Every shared section is an attribute component on the element the page already renders
 * (`<section appHunterRatingsSection>`), so recomposing the page adds no wrapper element and the
 * surrounding grid, the page's DOM and its `form > section` structure stay as they were.
 *
 * State comes from the surface's own `HunterDraft`, injected rather than passed down (13.5). The
 * radio binds `[formControl]` to the draft's control rather than `formControlName`: a child
 * component can't see the page's `[formGroup]`, and the wizard may not have one at all.
 */
@Component({
  selector: '[appHunterRatingsSection]',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './hunter-ratings-section.html',
  host: { class: 'grid gap-[0.6rem]' },
})
export class HunterRatingsSectionComponent {
  readonly draft = inject(HunterDraft);

  readonly stats = STATS;

  /** Ratings are always written signed on a playbook sheet, including `+0`. */
  formatStat(value: number): string {
    return value < 0 ? `${value}` : `+${value}`;
  }
}

const STATS: readonly { readonly key: 'charm' | 'cool' | 'sharp' | 'tough' | 'weird'; readonly label: string }[] = [
  { key: 'charm', label: 'Charm' },
  { key: 'cool', label: 'Cool' },
  { key: 'sharp', label: 'Sharp' },
  { key: 'tough', label: 'Tough' },
  { key: 'weird', label: 'Weird' },
];
