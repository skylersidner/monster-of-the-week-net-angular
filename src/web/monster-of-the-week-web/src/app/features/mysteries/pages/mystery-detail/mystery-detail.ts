import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { MysteryService } from '../../../../core/mystery';
import { MysteryDetailResponse } from '../../../../core/models';

@Component({
  selector: 'app-mystery-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './mystery-detail.html',
  styleUrl: './mystery-detail.scss',
})
export class MysteryDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly mystery = signal<MysteryDetailResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mysteryService: MysteryService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            throw new Error('Mystery id is required.');
          }

          this.isLoading.set(true);
          this.errorMessage.set(null);
          return this.mysteryService.getMystery(id);
        })
      )
      .subscribe({
        next: (mystery) => {
          this.mystery.set(mystery);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load mystery details.');
          this.isLoading.set(false);
        },
      });
  }
}
