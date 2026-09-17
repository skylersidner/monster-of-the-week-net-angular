import { Component, computed, inject } from '@angular/core';
import { HunterDraft } from '../../../shared/hunter-draft';
import { HunterCreateStore } from '../hunter-create.store';
import { groupOutstanding } from '../hunter-evaluation';

type CardView = 'waiting' | 'items' | 'done' | 'refused' | 'failed';

/**
 * The "Still to finish" card on the last step (hunter-creation-wizard.md 7.3, 12.8, 13.9, L6, L8, L20,
 * L29; Phase 7, F6), in `hunter-detail.html`'s vocabulary. It reads the store's check and owns nothing.
 *
 * - **Waiting** (no clean result yet): "Checking what's left…".
 * - **Items:** grouped in wizard step order, each line a link to its step or Rules dot. While a check
 *   is running, or a step 8 edit is waiting out its pause, the header adds "Checking…" and the previous
 *   items stay, so the card never flashes empty.
 * - **Done:** nothing left.
 * - **Refused:** the message is in the error band, with its link or offer; the card says it will come
 *   back, rather than listing items that contradict the band.
 * - **Failed:** "Couldn't check what's left", information only, over the last clean items if any.
 *
 * Create Hunter stays enabled in every state. The status line is `aria-live="polite"` and changes only
 * when the number of items does, so repeated checks don't chatter at screen-reader users.
 */
@Component({
  selector: 'app-hunter-still-to-finish',
  templateUrl: './hunter-still-to-finish.html',
  host: { class: 'block' },
})
export class HunterStillToFinishComponent {
  readonly store = inject(HunterCreateStore);
  private readonly draft = inject(HunterDraft);

  /** The result the card lists: the clean one, or the last clean one while loading or after a failure. */
  readonly listed = computed(() => {
    const evaluation = this.store.evaluation();
    switch (evaluation.kind) {
      case 'ok':
        return evaluation.result;
      case 'loading':
      case 'failed':
        return evaluation.lastOk;
      default:
        return null;
    }
  });

  readonly view = computed<CardView>(() => {
    const kind = this.store.evaluation().kind;
    if (kind === 'refused' || kind === 'failed') {
      return kind;
    }
    const listed = this.listed();
    if (!listed) {
      return 'waiting';
    }
    return listed.outstanding.length === 0 ? 'done' : 'items';
  });

  readonly checking = computed(() => {
    const kind = this.store.evaluation().kind;
    return this.store.recheckPending() || kind === 'loading' || kind === 'idle';
  });

  readonly groups = computed(() =>
    this.view() === 'refused' ? [] : groupOutstanding(this.listed()?.outstanding ?? [], this.draft.playbook())
  );

  /** L20: only the count, so the live region speaks when the number of items changes and not otherwise. */
  readonly countText = computed(() => {
    const listed = this.listed();
    if (this.view() === 'refused' || !listed) {
      return '';
    }
    const count = listed.outstanding.length;
    return count === 0 ? 'Nothing left to finish.' : `${count} ${count === 1 ? 'thing' : 'things'} still to finish.`;
  });
}
