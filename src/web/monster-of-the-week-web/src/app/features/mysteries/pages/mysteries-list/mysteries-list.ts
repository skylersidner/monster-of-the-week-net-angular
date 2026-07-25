import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MysteryService } from '../../../../core/mystery';
import { MysteryListItemResponse } from '../../../../core/models';

@Component({
  selector: 'app-mysteries-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './mysteries-list.html',
  styleUrl: './mysteries-list.scss',
})
export class MysteriesListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

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

  deleteMystery(id: string, name: string): void {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) {
      return;
    }
    this.mysteryService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.mysteries.update((ms) => ms.filter((m) => m.id !== id)),
        error: () => this.errorMessage.set('Unable to delete mystery.'),
      });
  }
}
