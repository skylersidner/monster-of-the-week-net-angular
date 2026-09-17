import { Component, computed, inject } from '@angular/core';
import { HunterDraft } from '../../../shared/hunter-draft';
import { HunterMovesSectionComponent } from '../../../shared/sections/hunter-moves-section';
import { shortPlaybookName } from '../hunter-step-model';

/**
 * Step 5, "What Can They Do?" (3.3 step 5): the shared moves section, with its counter against the
 * pick budget (B1), under one line about the basic moves. Basic moves are a single line because they
 * aren't reachable yet (Gap 3). Move-internal sections render in `'create'` mode, as on step 4.
 */
@Component({
  selector: 'app-hunter-moves-step',
  imports: [HunterMovesSectionComponent],
  template: `
    <p class="m-0 mb-4 text-primary text-[0.9rem]">{{ grantLine() }}</p>
    <section appHunterMovesSection mode="create"></section>
  `,
  host: { class: 'block' },
})
export class HunterMovesStepComponent {
  readonly draft = inject(HunterDraft);

  /** "You get all the basic moves, plus 3 Chosen moves." The count is the printed total (Q1). */
  readonly grantLine = computed(() => {
    const playbook = this.draft.playbook();
    const count = playbook?.moveGrantCount ?? 0;
    if (!playbook || count === 0) {
      return 'You get all the basic moves.';
    }
    return `You get all the basic moves, plus ${count} ${shortPlaybookName(playbook.name)} ${count === 1 ? 'move' : 'moves'}.`;
  });
}
