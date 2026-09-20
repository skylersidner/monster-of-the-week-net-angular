import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { MonsterService } from '../../../../core/monster';
import { MinionService } from '../../../../core/minion';
import { MonsterListItemResponse, MysteryListItemResponse } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import {
  mysteryUsageFootnote,
  mysteryUsageMessage,
  mysteryUsageUnavailableMessage,
  resolveMysteryNames,
} from '../../../../shared/mystery-usage';

/**
 * What the confirmation modal needs about the monster being deleted. Two independent lists, not
 * one (UX §7.1): `usage` answers *where is this used*, `minions` answers *what gets destroyed with
 * it*. The minion cascade already shipped here and is the precedent for the whole treatment; usage
 * is added above it rather than displacing it.
 */
interface PendingMonsterDelete {
  id: string;
  name: string;
  minions: string[];
  usage: string[];
  usageMessage: string;
  footnote: string;
}

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
  readonly pendingDelete = signal<PendingMonsterDelete | null>(null);
  readonly isLoadingMinions = signal(false);

  private readonly mysteries = signal<MysteryListItemResponse[]>([]);
  /**
   * Whether the mystery list has arrived. Until it has — whether because it failed or because it is
   * still in flight — the dialog says so rather than reporting an unverified zero (§7.7).
   */
  private readonly mysteriesAvailable = signal(false);

  constructor(
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the monsters list itself. It fills the usage block in when it arrives,
   * and until then the dialog says the check has not come back.
   */
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

  requestDelete(monster: MonsterListItemResponse): void {
    this.isLoadingMinions.set(true);
    this.minionService
      .getByMonster(monster.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (minions) => {
          this.isLoadingMinions.set(false);
          this.pendingDelete.set(this.toPending(monster, minions.map((m) => m.name)));
        },
        error: () => {
          this.isLoadingMinions.set(false);
          this.pendingDelete.set(this.toPending(monster, []));
        },
      });
  }

  private toPending(monster: MonsterListItemResponse, minions: string[]): PendingMonsterDelete {
    if (!this.mysteriesAvailable()) {
      return {
        id: monster.id,
        name: monster.name,
        minions,
        usage: [],
        usageMessage: mysteryUsageUnavailableMessage('monster'),
        footnote: mysteryUsageFootnote(0),
      };
    }

    // Count from the resolved names, never from `mysteryIds` — see `resolveMysteryNames`.
    const usage = resolveMysteryNames(monster.mysteryIds, this.mysteries());
    return {
      id: monster.id,
      name: monster.name,
      minions,
      usage,
      usageMessage: mysteryUsageMessage('monster', usage.length),
      footnote: mysteryUsageFootnote(usage.length),
    };
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
