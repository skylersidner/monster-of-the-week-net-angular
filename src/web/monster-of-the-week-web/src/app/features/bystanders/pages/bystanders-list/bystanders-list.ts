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
  mysteryUsageUnavailableMessage,
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
  /**
   * Whether the mystery list has arrived. Until it has — whether because it failed or because it is
   * still in flight — the dialog says so rather than reporting an unverified zero (§7.7).
   */
  private readonly mysteriesAvailable = signal(false);

  constructor(
    private readonly bystanderService: BystanderService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the bystanders list itself. It fills the usage block in when it arrives,
   * and until then the dialog says the check has not come back.
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
          this.mysteriesAvailable.set(true);
        },
        // Swallowed on purpose: this failure must not put an error band over a list that loaded.
        error: () => this.mysteriesAvailable.set(false),
      });
  }

  requestDelete(bystander: BystanderListItemResponse): void {
    if (!this.mysteriesAvailable()) {
      this.pendingDelete.set({
        id: bystander.id,
        name: bystander.name,
        usage: [],
        usageMessage: mysteryUsageUnavailableMessage('bystander'),
        footnote: mysteryUsageFootnote(0),
      });
      return;
    }

    // Count from the resolved names, never from `mysteryIds` — see `resolveMysteryNames`.
    const usage = resolveMysteryNames(bystander.mysteryIds, this.mysteries());
    this.pendingDelete.set({
      id: bystander.id,
      name: bystander.name,
      usage,
      usageMessage: mysteryUsageMessage('bystander', usage.length),
      footnote: mysteryUsageFootnote(usage.length),
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
