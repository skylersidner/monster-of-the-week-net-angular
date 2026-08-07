import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MonsterService } from '../../../../core/monster';
import { MinionService } from '../../../../core/minion';
import { MonsterListItemResponse } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';

@Component({
  selector: 'app-monsters-list',
  imports: [RouterLink, DatePipe, ConfirmDeleteModalComponent, IconComponent],
  templateUrl: './monsters-list.html',
})
export class MonstersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly monsters = signal<MonsterListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDelete = signal<{ id: string; name: string; minions: string[] } | null>(null);
  readonly isLoadingMinions = signal(false);

  constructor(
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
  ) {}

  ngOnInit(): void {
    this.monsterService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (monsters) => {
          this.monsters.set(monsters);
          this.errorMessage.set(null);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load monsters.');
          this.isLoading.set(false);
        },
      });
  }

  requestDelete(id: string, name: string): void {
    this.isLoadingMinions.set(true);
    this.minionService
      .getByMonster(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (minions) => {
          this.isLoadingMinions.set(false);
          this.pendingDelete.set({ id, name, minions: minions.map((m) => m.name) });
        },
        error: () => {
          this.isLoadingMinions.set(false);
          this.pendingDelete.set({ id, name, minions: [] });
        },
      });
  }

  onDeleteConfirmed(): void {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    this.monsterService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.monsters.update((ms) => ms.filter((m) => m.id !== target.id)),
        error: () => this.errorMessage.set('Unable to delete monster.'),
      });
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }
}
