import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LocationService } from '../../../../core/location';
import { LocationListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import {
  mysteryUsageFootnote,
  mysteryUsageMessage,
  resolveMysteryNames,
} from '../../../../shared/mystery-usage';

/** What the confirmation modal needs to disclose about the location being deleted. */
interface PendingLocationDelete {
  id: string;
  name: string;
  usage: string[];
  usageMessage: string;
  footnote: string;
}

@Component({
  selector: 'app-locations-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './locations-list.html',
})
export class LocationsListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly locations = signal<LocationListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<PendingLocationDelete | null>(null);

  private readonly mysteries = signal<MysteryListItemResponse[]>([]);

  constructor(
    private readonly locationService: LocationService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the locations list itself. The dialog reports the *count* either way —
   * that comes from each row's own `mysteryIds` — and fills in the names when they arrive (§15.1).
   */
  ngOnInit(): void {
    this.locationService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => {
          this.locations.set(locations);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load locations.');
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
  requestDelete(location: LocationListItemResponse): void {
    const count = location.mysteryIds.length;
    const names = resolveMysteryNames(location.mysteryIds, this.mysteries());
    const namesResolved = names.length === count;

    this.pendingDelete.set({
      id: location.id,
      name: location.name,
      usage: namesResolved ? names : [],
      usageMessage: mysteryUsageMessage('location', count, namesResolved),
      footnote: mysteryUsageFootnote(count),
    });
  }

  onDeleteConfirmed(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    this.locationService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.locations.update((ls) => ls.filter((l) => l.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete location.'),
      });
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
