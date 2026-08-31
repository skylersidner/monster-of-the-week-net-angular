import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HunterService } from '../../../../core/hunter';
import { HunterListItemResponse } from '../../../../core/models';

/**
 * Follows `MonstersListComponent`'s shape, minus the delete path: `HunterService` has no
 * `delete()` this phase because `DELETE /api/hunters/{id}` does not exist yet (Phase 10). A
 * delete button here would be a dead control that fails on click, which is worse than the
 * deliberately dead *links* Phase 9 specifies — those at least fall through to the dashboard.
 */
@Component({
  selector: 'app-hunters-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './hunters-list.html',
})
export class HuntersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly hunters = signal<HunterListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

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
}
