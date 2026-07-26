import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MinionService } from '../../../../core/minion';
import { MinionListItemResponse } from '../../../../core/models';

@Component({
  selector: 'app-minions-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './minions-list.html',
})
export class MinionsListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly minions = signal<MinionListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

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
}
