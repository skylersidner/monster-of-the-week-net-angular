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
  mysteryUsageUnavailableMessage,
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
  /**
   * Whether the mystery list has arrived. Until it has — whether because it failed or because it is
   * still in flight — the dialog says so rather than reporting an unverified zero (§7.7).
   */
  private readonly mysteriesAvailable = signal(false);

  constructor(
    private readonly locationService: LocationService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the locations list itself. It fills the usage block in when it arrives,
   * and until then the dialog says the check has not come back.
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
          this.mysteriesAvailable.set(true);
        },
        // Swallowed on purpose: this failure must not put an error band over a list that loaded.
        error: () => this.mysteriesAvailable.set(false),
      });
  }

  requestDelete(location: LocationListItemResponse): void {
    if (!this.mysteriesAvailable()) {
      this.pendingDelete.set({
        id: location.id,
        name: location.name,
        usage: [],
        usageMessage: mysteryUsageUnavailableMessage('location'),
        footnote: mysteryUsageFootnote(0),
      });
      return;
    }

    // Count from the resolved names, never from `mysteryIds` — see `resolveMysteryNames`.
    const usage = resolveMysteryNames(location.mysteryIds, this.mysteries());
    this.pendingDelete.set({
      id: location.id,
      name: location.name,
      usage,
      usageMessage: mysteryUsageMessage('location', usage.length),
      footnote: mysteryUsageFootnote(usage.length),
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
