import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MysteryService } from '../../../../core/mystery';
import { MysteryListItemResponse } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';

@Component({
  selector: 'app-mysteries-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent],
  templateUrl: './mysteries-list.html',
})
export class MysteriesListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<{ id: string; name: string } | null>(null);

  constructor(private readonly mysteryService: MysteryService) {}

  ngOnInit(): void {
    this.mysteryService
      .getMysteries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mysteries) => {
          this.mysteries.set(mysteries);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load mysteries.');
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
    this.mysteryService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.mysteries.update((ms) => ms.filter((m) => m.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete mystery.'),
      });
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
