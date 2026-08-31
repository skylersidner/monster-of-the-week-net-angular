import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlaybookDetailResponse, PlaybookListItemResponse, UpsertPlaybookRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookService } from '../../../../core/playbook';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { PlaybookFormComponent } from './playbook-form/playbook-form';

/**
 * List + create/edit for Playbooks, rendered under the Data Admin "Playbooks" tab.
 *
 * Owns the service calls and list state; `PlaybookFormComponent` owns the form itself, the
 * same split `MonsterCreateComponent`/`MonsterFormComponent` already uses.
 *
 * Editing loads the full graph via `getById` rather than reusing the list row, because the
 * list response deliberately carries only summary counts — and because the child row ids
 * the form must round-trip back on save only exist in the detail response.
 */
@Component({
  selector: 'app-playbook-admin',
  imports: [PlaybookFormComponent, ConfirmDeleteModalComponent],
  templateUrl: './playbook-admin.html',
})
export class PlaybookAdminComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly records = signal<PlaybookListItemResponse[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);

  /** Null while the list is showing; set to a playbook (or `null` inside `isFormOpen`) when editing. */
  readonly editing = signal<PlaybookDetailResponse | null>(null);
  readonly isFormOpen = signal(false);

  /** Set when Delete is clicked, cleared on confirm/cancel; drives the shared confirm-delete modal. */
  readonly pendingDelete = signal<PlaybookListItemResponse | null>(null);

  constructor(
    private readonly playbookService: PlaybookService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadRecords();
  }

  startCreate(): void {
    this.editing.set(null);
    this.isFormOpen.set(true);
  }

  startEdit(record: PlaybookListItemResponse): void {
    this.playbookService
      .getById(record.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playbook) => {
          this.editing.set(playbook);
          this.isFormOpen.set(true);
        },
        error: () => this.notificationService.error(`Unable to load "${record.name}".`),
      });
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editing.set(null);
  }

  savePlaybook(request: UpsertPlaybookRequest): void {
    const existing = this.editing();
    this.isSaving.set(true);

    const request$ = existing
      ? this.playbookService.update(existing.id, request)
      : this.playbookService.create(request);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.closeForm();
        this.loadRecords();
        this.notificationService.success(`Playbook "${saved.name}" ${existing ? 'updated' : 'created'}.`);
      },
      error: (error: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        // The server returns a specific message for its cross-field rules (duplicate name,
        // harm threshold, gear over-pick); surface it rather than a generic failure.
        this.notificationService.error(error?.error?.message ?? 'Unable to save playbook.');
      },
    });
  }

  requestDelete(record: PlaybookListItemResponse): void {
    this.pendingDelete.set(record);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const record = this.pendingDelete();
    if (!record) {
      return;
    }
    this.pendingDelete.set(null);

    this.playbookService
      .delete(record.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadRecords();
          this.notificationService.success(`Playbook "${record.name}" deleted.`);
        },
        // Surfaces the server's own message the way the save path already does, because as of
        // Phase 9 the delete can fail for a reason the user can act on: a 409 naming how many
        // Hunters are built from this playbook. A generic failure string would hide that.
        error: (error: { error?: { message?: string } }) =>
          this.notificationService.error(error?.error?.message ?? `Unable to delete "${record.name}".`),
      });
  }

  private loadRecords(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.playbookService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.records.set(records);
          this.isLoading.set(false);
        },
        error: () => {
          this.records.set([]);
          this.loadError.set('Unable to load playbooks.');
          this.isLoading.set(false);
        },
      });
  }
}
