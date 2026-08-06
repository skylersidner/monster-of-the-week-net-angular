import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BystanderService } from '../../../../core/bystander';
import { MysteryListItemResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { CustomSelectComponent } from '../../../../shared/custom-select.component';
import { BystanderFormComponent } from '../../shared/bystander-form/bystander-form';

/**
 * Bystander has no interactive sub-resources (see plan doc Resolved Decision 2) — this
 * page is a single 3-field form plus an optional mystery picker, with exactly one API
 * call on submit. No draft arrays, no batched sub-resource submit.
 */
@Component({
  selector: 'app-bystander-create',
  imports: [ReactiveFormsModule, RouterLink, BystanderFormComponent, CustomSelectComponent],
  templateUrl: './bystander-create.html',
})
export class BystanderCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly bystanderTypes = signal<TypeRefResponse[]>([]);
  readonly mysteries = signal<MysteryListItemResponse[]>([]);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Optional "attach to mystery" picker. Blank is the valid "create unattached" path. */
  readonly mysteryControl = this.formBuilder.nonNullable.control('');

  constructor(
    private readonly router: Router,
    private readonly bystanderService: BystanderService,
    private readonly mysteryService: MysteryService,
    private readonly referenceDataService: ReferenceDataService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    forkJoin({
      bystanderTypes: this.referenceDataService.getBystanderTypes(),
      mysteries: this.mysteryService.getMysteries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ bystanderTypes, mysteries }) => {
          this.bystanderTypes.set(bystanderTypes);
          this.mysteries.set(mysteries);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load reference data.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Emitted by `BystanderFormComponent` only once its own validation has passed
   * (including its required `bystanderTypeId`), so no core-field validity check is
   * needed here.
   */
  onCreate(payload: UpsertBystanderRequest): void {
    const mysteryId = this.mysteryControl.value;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const create$ = mysteryId
      ? this.bystanderService.create(mysteryId, payload)
      : this.bystanderService.createStandalone(payload);

    create$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (bystander) => {
        this.isSaving.set(false);
        this.notificationService.success('Bystander created.');
        void this.router.navigate(this.detailLink(bystander.id, mysteryId));
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMessage.set('Unable to create bystander.');
        this.notificationService.error('Unable to create bystander.');
      },
    });
  }

  private detailLink(bystanderId: string, mysteryId: string): unknown[] {
    return mysteryId ? ['/mysteries', mysteryId, 'bystanders', bystanderId] : ['/bystanders', bystanderId];
  }
}
