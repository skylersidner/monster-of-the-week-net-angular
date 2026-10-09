import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MinionService } from '../../../../core/minion';
import { MinionListItemResponse } from '../../../../core/models';
import { resourceImageThumbnailUrl } from '../../../../core/resource-images';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ResourceThumbnailComponent } from '../../../../shared/resource-thumbnail.component';

@Component({
  selector: 'app-minions-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent, IconComponent, ResourceThumbnailComponent],
  templateUrl: './minions-list.html',
})
export class MinionsListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly minions = signal<MinionListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<{ id: string; name: string } | null>(null);

  constructor(private readonly minionService: MinionService) {}

  ngOnInit(): void {
    this.minionService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (minions) => {
          this.minions.set(minions);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load minions.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * The row's thumbnail URL, or `null` when the minion has no images — which is what makes
   * `app-resource-thumbnail` render the domain placeholder (design.md §4.2, §5.5).
   *
   * `primaryImageId` rides along on the list response (Phase 4), so this costs no extra request per
   * row; `loading="lazy"` then keeps the fetches proportional to the rows on screen.
   */
  thumbnailUrl(minion: MinionListItemResponse): string | null {
    return resourceImageThumbnailUrl('Minion', minion.id, minion.primaryImageId);
  }

  requestDelete(id: string, name: string): void {
    this.pendingDelete.set({ id, name });
  }

  onDeleteConfirmed(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    this.minionService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.minions.update((ms) => ms.filter((m) => m.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete minion.'),
      });
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
