import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { BystanderService } from '../../../../core/bystander';
import { BystanderDetailResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BystanderFormComponent } from '../../shared/bystander-form/bystander-form';

@Component({
  selector: 'app-bystander-detail-component',
  imports: [RouterLink, BystanderFormComponent],
  templateUrl: './bystander-detail.html',
})
export class BystanderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly bystander = signal<BystanderDetailResponse | null>(null);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly mysteryId = signal<string | null>(null);

  readonly backLink = computed(() =>
    this.mysteryId() ? ['/mysteries', this.mysteryId()] : ['/bystanders']
  );
  readonly backLabel = computed(() =>
    this.mysteryId() ? '← Back to mystery' : '← Back to bystanders'
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly bystanderService: BystanderService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const bystanderId = params.get('bystanderId');
          if (!bystanderId) {
            throw new Error('Bystander id is required.');
          }

          const mysteryId = params.get('mysteryId');
          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            bystander: this.bystanderService.getById(bystanderId),
            bystanderTypes: this.referenceDataService.getBystanderTypes(),
          });
        })
      )
      .subscribe({
        next: ({ bystander, bystanderTypes }) => {
          this.bystander.set(bystander);
          this.bystanderTypes.set(bystanderTypes);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load bystander details.');
          this.isLoading.set(false);
        },
      });
  }

  save(payload: UpsertBystanderRequest): void {
    if (!this.bystander()) {
      return;
    }

    this.isSaving.set(true);
    this.bystanderService
      .update(this.bystander()!.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bystander) => {
          this.bystander.set(bystander);
          this.notificationService.success('Bystander saved.');
          this.errorMessage.set(null);
          this.isSaving.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to save bystander.');
          this.notificationService.error('Unable to save bystander.');
          this.isSaving.set(false);
        },
      });
  }
}
