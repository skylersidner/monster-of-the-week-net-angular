import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocationService } from '../../../../core/location';
import { LocationListItemResponse } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';

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
  readonly pendingDelete = signal<{ id: string; name: string } | null>(null);

  constructor(private readonly locationService: LocationService) {}

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
  }

  requestDelete(id: string, name: string): void {
    this.pendingDelete.set({ id, name });
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
