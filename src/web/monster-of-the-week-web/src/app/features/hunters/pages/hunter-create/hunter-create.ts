import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { HunterService } from '../../../../core/hunter';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookService } from '../../../../core/playbook';
import { PlaybookListItemResponse, UpsertHunterRequest } from '../../../../core/models';
import { HunterFormComponent } from '../../shared/hunter-form/hunter-form';

/**
 * Owns the `create` call and nothing else — the form owns the form. Same create/edit split
 * every other domain uses (`MonsterCreateComponent` / `MonsterDetailComponent`).
 *
 * The only thing loaded here is the playbook *list* for the picker; the form fetches the
 * selected playbook's own graph itself, since that has to happen again on every change.
 */
@Component({
  selector: 'app-hunter-create',
  imports: [RouterLink, HunterFormComponent],
  templateUrl: './hunter-create.html',
})
export class HunterCreateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly playbooks = signal<PlaybookListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly hunterService: HunterService,
    private readonly playbookService: PlaybookService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.playbookService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playbooks) => {
          this.playbooks.set(playbooks);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load playbooks.');
          this.isLoading.set(false);
        },
      });
  }

  onSave(request: UpsertHunterRequest): void {
    this.isSaving.set(true);
    this.hunterService
      .create(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hunter) => {
          this.isSaving.set(false);
          this.notificationService.success(`Hunter "${hunter.name}" created.`);
          this.router.navigate(['/hunters', hunter.id]);
        },
        // Surfaces the server's own message: every rejection here is a rules violation the
        // user can act on ("that is an advanced move", "this playbook allows 2 picks"), not a
        // generic failure.
        error: (error: { error?: { message?: string } }) => {
          this.isSaving.set(false);
          this.notificationService.error(error?.error?.message ?? 'Unable to create hunter.');
        },
      });
  }
}
