import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/api';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { MysterySectionIconComponent } from '../../shared/mystery-section-icon';
import { MYSTERY_COUNTDOWN_STAGES } from '../../shared/mystery-countdown-stage';
import {
  BystanderListItemResponse,
  LocationListItemResponse,
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
  readonly pureMonsters = computed(() => this.monsters().filter((m) => m.minionTypeId == null));
  readonly minions = computed(() => this.monsters().filter((m) => m.minionTypeId != null));
  readonly locations = signal<LocationListItemResponse[]>([]);
  readonly bystanders = signal<BystanderListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mysteryService: MysteryService,
    private readonly monsterService: MonsterService,
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
        })
      )
      .subscribe({
        next: ({ mystery, monsters, locations, bystanders }) => {
          this.mystery.set(mystery);
          this.monsters.set(monsters);
          this.locations.set(locations);
          this.bystanders.set(bystanders);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to load mystery details.');
          this.isLoading.set(false);
        },
      });
  }
}
