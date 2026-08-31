import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HunterService } from '../../../../core/hunter';
import { HunterListItemResponse } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';

/** Follows `MonstersListComponent`'s shape, minus the sub-resource lookup its delete needs. */
@Component({
  selector: 'app-hunters-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './hunters-list.html',
})
export class HuntersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly hunters = signal<HunterListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<HunterListItemResponse | null>(null);

  constructor(private readonly hunterService: HunterService) {}

  ngOnInit(): void {
    this.hunterService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hunters) => {
          this.hunters.set(hunters);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load hunters.');
          this.isLoading.set(false);
        },
      });
  }

  requestDelete(hunter: HunterListItemResponse): void {
    this.pendingDelete.set(hunter);
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }

  onDeleteConfirmed(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    this.hunterService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.hunters.update((hunters) => hunters.filter((h) => h.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete hunter.'),
      });
  }
}
