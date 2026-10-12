import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/api';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { CustomMoveService } from '../../../../core/custom-moves';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import {
  CustomMoveCommit,
  CustomMoveRow,
  CustomMovesCardComponent,
} from '../../../../shared/custom-moves-card.component';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import {
  BystanderListItemResponse,
  LocationListItemResponse,
  MinionListItemResponse,
  MonsterListItemResponse,
  MysteryDetailResponse,
  UpsertCustomMoveRequest,
} from '../../../../core/models';

@Component({
  selector: 'app-mystery-detail',
  imports: [
    RouterLink,
    MysterySectionIconComponent,
    IconComponent,
    ConfirmDeleteModalComponent,
    CustomMovesCardComponent,
  ],
  templateUrl: './mystery-detail.html',
  styleUrl: './mystery-detail.scss',
})
export class MysteryDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly countdownStages = MYSTERY_COUNTDOWN_STAGES;

  readonly mystery = signal<MysteryDetailResponse | null>(null);
  readonly monsters = signal<MonsterListItemResponse[]>([]);
  readonly minions = signal<MinionListItemResponse[]>([]);
  readonly pureMonsters = computed(() => this.monsters());
  readonly locations = signal<LocationListItemResponse[]>([]);
  readonly bystanders = signal<BystanderListItemResponse[]>([]);
  readonly isLoading = signal(true);

  /**
   * **Load failures only — never a write failure.** This is the deliberate *non*-addition of Phase
   * 5e and the most important constraint in it (R14, §4.1 item 4).
   *
   * `mystery-detail.html` orders `@else if (errorMessage())` **ahead** of its content branch, so
   * setting this after a failed custom-move write would replace the whole mystery with a single red
   * line — the hazard Phase A removed from the other four pages. Those four had to have it taken
   * out; this page has never had a write path, so 5e's job is simply not to introduce one.
   * Custom-move failures go to the toast, exactly as they do on the other four.
   *
   * So across all five detail pages `errorMessage` is now written by the load path only, and this
   * branch means exactly "this mystery could not be loaded" — the only claim its position is
   * correct for.
   */
  readonly errorMessage = signal<string | null>(null);

  // --- The page's first write surface (architecture.md §4.1, §26.2 L12; Phase 5e) ---
  //
  // Before 5e this page had no mutation state, no notifications, no modal and no stored route id:
  // its only control was the *Continue in wizard* link. All five additions below exist because a
  // custom move can now be authored here, and each one is the minimum that requires.

  /** The in-flight mutation, carrying its own message. `monster-detail.ts` is the copy source. */
  readonly activeMutation = signal<string | null>(null);
  readonly isMutating = computed(() => this.activeMutation() !== null);

  /**
   * **One modal for every delete on this page** — which is one flow today, but the shape is the
   * same closure-carrying record the other four carry, so a second never needs a second element
   * (decision 14). This is **the only new confirm-modal call site in the whole plan**, which is why
   * R12's census gate narrowed to this sub-phase: the other four pages already had an element.
   */
  readonly pendingDelete = signal<{ label: string; footnote?: string; perform: () => void } | null>(null);

  /**
   * **The route id, stored.** `ngOnInit` reads `params.get('id')` inside its pipe and never kept it
   * — fine for a read-only page, and not enough to address a `POST` or a refetch at. §4.1's
   * three-item list missed this and the refetch below; §26.2 L12 added them.
   */
  readonly mysteryId = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mysteryService: MysteryService,
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
    private readonly apiService: ApiService,
    private readonly notificationService: NotificationService,
    private readonly customMoveService: CustomMoveService
  ) {}

  /** The card, so a successful commit can reset it and restore focus. */
  @ViewChild(CustomMovesCardComponent) private readonly customMovesCard?: CustomMovesCardComponent;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            throw new Error('Mystery id is required.');
          }

          this.mysteryId.set(id);
          this.isLoading.set(true);
          this.errorMessage.set(null);
          return forkJoin({
            mystery: this.mysteryService.getMystery(id),
            monsters: this.monsterService.getByMystery(id),
            locations: this.apiService.get<LocationListItemResponse[]>(`/api/mysteries/${id}/locations`),
            bystanders: this.apiService.get<BystanderListItemResponse[]>(`/api/mysteries/${id}/bystanders`),
          });
        }),
        switchMap(({ mystery, monsters, locations, bystanders }) => {
          this.mystery.set(mystery);
          this.monsters.set(monsters);
          this.locations.set(locations);
          this.bystanders.set(bystanders);

          if (monsters.length === 0) {
            return of({ minions: [] as MinionListItemResponse[] });
          }

          return forkJoin(
            monsters.map((m) => this.minionService.getByMonster(m.id))
          ).pipe(
            switchMap((minionGroups) => of({ minions: minionGroups.flat() }))
          );
        })
      )
      .subscribe({
        next: ({ minions }) => {
          this.minions.set(minions);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load mystery details.');
          this.isLoading.set(false);
        },
      });
  }

  // --- Custom moves (architecture.md §4.1, §29.1; Phase 5e — the fifth and last detail page) ---

  /** Mapped from the `customMoves` already on `MysteryDetailResponse` — no request on load. */
  readonly customMoveRows = computed<CustomMoveRow[]>(() =>
    (this.mystery()?.customMoves ?? []).map((move) => ({
      key: move.id,
      name: move.name,
      description: move.description,
    }))
  );

  /** Which row the card has open. Bound two-way; the page owns it, the card asks (L-D1). */
  readonly editingCustomMoveKey = signal<string | null>(null);

  /** Add or edit, decided by `commit.key` — `null` means add. */
  commitCustomMove(commit: CustomMoveCommit): void {
    const request: UpsertCustomMoveRequest = { name: commit.name, description: commit.description };
    const { key } = commit;

    this.runCustomMoveWrite(
      (mysteryId) =>
        key === null
          ? this.customMoveService.create('Mystery', mysteryId, request)
          : this.customMoveService.update('Mystery', mysteryId, key, request),
      key === null ? 'Unable to add custom move.' : 'Unable to save custom move.',
      () => this.customMovesCard?.commitSucceeded(),
      key === null ? 'Custom move added.' : 'Custom move saved.'
    );
  }

  /** Through this page's one modal — its first, and the plan's only new census entry (R12). */
  requestDeleteCustomMove(row: CustomMoveRow): void {
    this.pendingDelete.set({
      label: row.name,
      perform: () =>
        this.runCustomMoveWrite(
          (mysteryId) => this.customMoveService.delete('Mystery', mysteryId, row.key),
          'Unable to delete custom move.'
        ),
    });
  }

  onDeleteConfirmed(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.perform();
  }

  onDeleteCancelled(): void {
    this.pendingDelete.set(null);
  }

  /**
   * The other four pages route custom-move writes through their existing `runAndRefresh`. This page
   * has none, so this is it — and it differs from theirs in exactly one way, which is the reason
   * §4.1's three-item list was short by two:
   *
   * **the refetch reloads only the mystery.** The page's load is a four-arm `forkJoin` plus a
   * minion fan-out, and none of monsters, locations, bystanders or minions can change as a result
   * of a custom-move write — so re-running those arms would be both wasteful and wrong, since a
   * failure in one of them would surface as a custom-move failure.
   *
   * **`errorMessage` is deliberately untouched on the error branch.** See its declaration: setting
   * it would unmount the page. The toast is the whole failure surface, which is the same rule the
   * other four now follow after Phase A.
   */
  private runCustomMoveWrite(
    operation: (mysteryId: string) => Observable<unknown>,
    errorMessage: string,
    onSuccess?: () => void,
    successMessage?: string
  ): void {
    const mysteryId = this.mysteryId();
    if (!mysteryId) {
      return;
    }

    this.activeMutation.set('Saving changes...');
    operation(mysteryId)
      .pipe(
        switchMap(() => this.mysteryService.getMystery(mysteryId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (mystery) => {
          this.mystery.set(mystery);
          onSuccess?.();
          this.activeMutation.set(null);
          this.notificationService.success(successMessage ?? 'Changes saved.');
        },
        error: () => {
          this.activeMutation.set(null);
          this.notificationService.error(errorMessage);
        },
      });
  }
}
