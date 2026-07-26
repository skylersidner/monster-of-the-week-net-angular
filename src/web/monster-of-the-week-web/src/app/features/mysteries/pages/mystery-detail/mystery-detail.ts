import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/api';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import {
  BystanderListItemResponse,
  LocationListItemResponse,
  MinionListItemResponse,
  MonsterListItemResponse,
  MysteryDetailResponse,
} from '../../../../core/models';

@Component({
  selector: 'app-mystery-detail',
  imports: [RouterLink, MysterySectionIconComponent],
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
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mysteryService: MysteryService,
    private readonly monsterService: MonsterService,
    private readonly minionService: MinionService,
    private readonly apiService: ApiService
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
}
