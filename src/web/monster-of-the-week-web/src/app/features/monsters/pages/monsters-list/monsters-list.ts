import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MonsterService } from '../../../../core/monster';
import { MonsterListItemResponse } from '../../../../core/models';

@Component({
  selector: 'app-monsters-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './monsters-list.html',
  styleUrl: './monsters-list.scss',
})
export class MonstersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly monsters = signal<MonsterListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(private readonly monsterService: MonsterService) {}

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
}
