import { Component, Input, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HunterDraft } from '../hunter-draft';

/**
 * History notes and the playbook's history prompts (hunter-creation-wizard.md 13.6; Phase 5, R5).
 * The notes save to `Hunter.Background`. The prompts are plain text with `\n` paragraphs, so they
 * render through interpolation with `whitespace-pre-line`, never `[innerHTML]` (Gap 5, 13.11 item 1).
 * The "History" / "History notes" wording shipped in Phase 2 (L16).
 *
 * `mode` changes only the layout, never what is saved. `'edit'`, the default, is the edit page: a
 * "History" heading, the notes, then the prompts in a `<details>`. `'create'` is the wizard's last step
 * (3.3 step 8, Q4 "Prompts + notes box"): the prompts in a reference panel headed "History", with the
 * notes box, labelled "History notes (optional)", directly under them.
 *
 * See `HunterRatingsSectionComponent` for why this is an attribute component, and why the
 * textarea binds `[formControl]`.
 */
@Component({
  selector: '[appHunterHistorySection]',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './hunter-history-section.html',
  host: { class: 'grid gap-[0.6rem]' },
})
export class HunterHistorySectionComponent {
  readonly draft = inject(HunterDraft);

  @Input() mode: 'create' | 'edit' = 'edit';
}
