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

  constructor(
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
    private readonly mysteryService: MysteryService,
  ) {}

  /**
   * Two independent loads, deliberately not a `forkJoin`. The mystery list is **disclosure data for
   * the delete dialog, not page data**, so gating `isLoading` on it would let a slow
   * `/api/mysteries` delay the monsters list itself. The dialog reports the *count* either way —
   * that comes from each row's own `mysteryIds` — and fills in the names when they arrive (§15.1).
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
        },
        // Swallowed on purpose: this failure must not put an error band over a list that loaded, and
        // the count is not lost with it — it comes from each row's own `mysteryIds` (§15.1).
        error: () => {},
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

  /**
   * **The count comes from `mysteryIds`, the names from the mystery lookup** (§15.1). They are two
   * facts from two sources, and deriving the count from the names made a failed lookup assert that
   * the monster was in no mystery at all — the opposite of the truth, on an irreversible action.
   *
   * Bullets render only when *every* id resolved, so the number in the sentence and the length of
   * the list can never disagree.
   */
  private toPending(monster: MonsterListItemResponse, minions: string[]): PendingMonsterDelete {
    const count = monster.mysteryIds.length;
    const names = resolveMysteryNames(monster.mysteryIds, this.mysteries());
    const namesResolved = names.length === count;

    return {
      id: monster.id,
      name: monster.name,
      minions,
      usage: namesResolved ? names : [],
      usageMessage: mysteryUsageMessage('monster', count, namesResolved),
      footnote: mysteryUsageFootnote(count),
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
