import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HunterService } from '../../../../core/hunter';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookService } from '../../../../core/playbook';
import { HunterDetailResponse, PlaybookListItemResponse, UpsertHunterRequest } from '../../../../core/models';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { HunterFormComponent } from '../../shared/hunter-form/hunter-form';

/**
 * Owns the `update` and `delete` calls; the form is the same component the create page uses,
 * populated from `hunter`. The only per-mode differences are which service method fires and
 * that the playbook control is locked (see `HunterFormComponent.populate`).
 */
@Component({
  selector: 'app-hunter-detail',
  imports: [RouterLink, HunterFormComponent, ConfirmDeleteModalComponent],
  templateUrl: './hunter-detail.html',
})
export class HunterDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  readonly hunter = signal<HunterDetailResponse | null>(null);
  readonly playbooks = signal<PlaybookListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isConfirmingDelete = signal(false);

  constructor(
    private readonly hunterService: HunterService,
    private readonly playbookService: PlaybookService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const hunterId = this.route.snapshot.paramMap.get('hunterId');
    if (!hunterId) {
      this.errorMessage.set('No hunter was requested.');
      this.isLoading.set(false);
      return;
    }

    forkJoin({
      hunter: this.hunterService.getById(hunterId),
      playbooks: this.playbookService.getAll(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ hunter, playbooks }) => {
          this.playbooks.set(playbooks);
          this.hunter.set(hunter);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load this hunter.');
          this.isLoading.set(false);
        },
      });
  }

  onSave(request: UpsertHunterRequest): void {
    const current = this.hunter();
    if (!current) {
      return;
    }

    this.isSaving.set(true);
    this.hunterService
      .update(current.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hunter) => {
          this.isSaving.set(false);
          // Re-setting the input repopulates the form from what the server actually stored —
          // which matters here, because the server adds any Required moves the payload omitted.
          this.hunter.set(hunter);
          this.notificationService.success(`Hunter "${hunter.name}" saved.`);
        },
        error: (error: { error?: { message?: string } }) => {
          this.isSaving.set(false);
          this.notificationService.error(error?.error?.message ?? 'Unable to save hunter.');
        },
      });
  }

  requestDelete(): void {
    this.isConfirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.isConfirmingDelete.set(false);
  }

  confirmDelete(): void {
    const current = this.hunter();
    if (!current) {
      return;
    }

    this.isConfirmingDelete.set(false);
    this.hunterService
      .delete(current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationService.success(`Hunter "${current.name}" deleted.`);
          this.router.navigate(['/hunters']);
        },
        error: () => this.notificationService.error(`Unable to delete "${current.name}".`),
      });
  }
}
