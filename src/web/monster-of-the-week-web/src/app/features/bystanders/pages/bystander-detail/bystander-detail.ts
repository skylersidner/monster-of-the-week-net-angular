import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/api';
import { BystanderDetailResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';

@Component({
  selector: 'app-bystander-detail-component',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bystander-detail.html',
  styleUrl: './bystander-detail.scss',
})
export class BystanderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly bystander = signal<BystanderDetailResponse | null>(null);
  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly mysteryId = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required]),
    description: this.formBuilder.control(''),
    bystanderTypeId: this.formBuilder.nonNullable.control('', [Validators.required]),
  });

  readonly backLink = computed(() => {
    const id = this.mysteryId();
    return id ? ['/mysteries', id] : ['/mysteries'];
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const mysteryId = params.get('mysteryId');
          const bystanderId = params.get('bystanderId');
          if (!mysteryId || !bystanderId) {
            throw new Error('Mystery id and bystander id are required.');
          }

          this.mysteryId.set(mysteryId);
          this.isLoading.set(true);
          this.errorMessage.set(null);

          return forkJoin({
            bystander: this.apiService.get<BystanderDetailResponse>(`/api/bystanders/${bystanderId}`),
            bystanderTypes: this.referenceDataService.getBystanderTypes(),
          });
        })
      )
      .subscribe({
        next: ({ bystander, bystanderTypes }) => {
          this.bystander.set(bystander);
          this.bystanderTypes.set(bystanderTypes);
          this.form.reset({
            name: bystander.name,
            description: bystander.description ?? '',
            bystanderTypeId: bystander.bystanderTypeId,
          });
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load bystander details.');
          this.isLoading.set(false);
        },
      });
  }

  save(): void {
    if (this.form.invalid || !this.bystander()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: UpsertBystanderRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.toNullable(this.form.controls.description.value),
      bystanderTypeId: this.form.controls.bystanderTypeId.value,
    };

    this.isSaving.set(true);
    this.apiService
      .put<UpsertBystanderRequest, BystanderDetailResponse>(
        `/api/bystanders/${this.bystander()!.id}`,
        payload
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bystander) => {
          this.bystander.set(bystander);
          this.form.reset({
            name: bystander.name,
            description: bystander.description ?? '',
            bystanderTypeId: bystander.bystanderTypeId,
          });
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

  private toNullable(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
