import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MysteryService } from '../../core/mystery';
import { MysteryListItemResponse } from '../../core/models';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPageComponent implements OnInit {
  readonly mysteries = signal<MysteryListItemResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly mysteryCount = computed(() => this.mysteries().length);
  readonly totalMonsters = computed(() => this.mysteries().reduce((sum, mystery) => sum + mystery.monsterCount, 0));
  readonly totalLocations = computed(() => this.mysteries().reduce((sum, mystery) => sum + mystery.locationCount, 0));
  readonly totalBystanders = computed(() => this.mysteries().reduce((sum, mystery) => sum + mystery.bystanderCount, 0));
  readonly recentMysteries = computed(() =>
    [...this.mysteries()]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 5)
  );

  constructor(private readonly mysteryService: MysteryService) {}

  ngOnInit(): void {
    this.mysteryService.getMysteries().subscribe({
      next: (mysteries) => {
        this.mysteries.set(mysteries);
        this.errorMessage.set(null);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load dashboard data.');
        this.isLoading.set(false);
      },
    });
  }
}
