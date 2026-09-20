import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { BystanderService } from '../../../../core/bystander';
import { BystanderListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import {
  mysteryUsageFootnote,
  mysteryUsageMessage,
  resolveMysteryNames,
} from '../../../../shared/mystery-usage';

/** What the confirmation modal needs to disclose about the bystander being deleted. */
interface PendingBystanderDelete {
  id: string;
  name: string;
  usage: string[];
  usageMessage: string;
  footnote: string;
}

@Component({
  selector: 'app-bystanders-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './bystanders-list.html',
})
export class BystandersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly bystanders = signal<BystanderListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<PendingBystanderDelete | null>(null);

  private readonly mysteries = signal<MysteryListItemResponse[]>([]);

  constructor(
    private readonly bystanderService: BystanderService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the bystanders list itself. The dialog reports the *count* either way —
   * that comes from each row's own `mysteryIds` — and fills in the names when they arrive (§15.1).
   */
  ngOnInit(): void {
    this.bystanderService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bystanders) => {
          this.bystanders.set(bystanders);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load bystanders.');
          this.isLoading.set(false);
        },
      });

    this.mysteryService
      .getMysteries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mysteries) => {
          this.mysteries.set(mysteries);
        },
        // Swallowed on purpose: this failure must not put an error band over a list that loaded, and
        // the count is not lost with it — it comes from each row's own `mysteryIds` (§15.1).
        error: () => {},
      });
  }

  /**
   * **The count comes from `mysteryIds`, the names from the mystery lookup** (§15.1). They are two
   * facts from two sources, and deriving the count from the names made a failed lookup assert that
   * the entity was in no mystery at all — the opposite of the truth, on an irreversible action.
   *
   * Bullets render only when *every* id resolved, so the number in the sentence and the length of
   * the list can never disagree.
   */
  requestDelete(bystander: BystanderListItemResponse): void {
    const count = bystander.mysteryIds.length;
    const names = resolveMysteryNames(bystander.mysteryIds, this.mysteries());
    const namesResolved = names.length === count;

    this.pendingDelete.set({
      id: bystander.id,
      name: bystander.name,
      usage: namesResolved ? names : [],
      usageMessage: mysteryUsageMessage('bystander', count, namesResolved),
      footnote: mysteryUsageFootnote(count),
    });
  }

  onDeleteConfirmed(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    this.bystanderService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.bystanders.update((bs) => bs.filter((b) => b.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete bystander.'),
      });
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
