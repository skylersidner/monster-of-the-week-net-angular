import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BystanderService } from '../../../../core/bystander';
import { BystanderListItemResponse } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';

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
  readonly pendingDelete = signal<{ id: string; name: string } | null>(null);

  constructor(private readonly bystanderService: BystanderService) {}

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
  }

  requestDelete(id: string, name: string): void {
    this.pendingDelete.set({ id, name });
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
