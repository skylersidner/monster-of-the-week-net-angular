import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PagedSearchResult, SearchResultDetailItem } from '../../../../core/models';
import { SearchService } from '../../../../core/search';
import { DomainIconComponent } from '../../../../shared/domain-icon.component';

const PAGE_SIZE = 20;

/** Flat, top-level detail routes — mirrors `HeaderSearchComponent`'s `DETAIL_ROUTE_SEGMENT` (`architecture.md` Section 6). */
const DETAIL_ROUTE_SEGMENT: Readonly<Record<string, string>> = {
  Mystery: '/mysteries',
  Monster: '/monsters',
  Minion: '/minions',
  Location: '/locations',
  Bystander: '/bystanders',
};

/**
 * One distinct `bg-{color}-100 text-{color}-700`-family pairing per domain, reused from
 * existing per-domain badge colors already present elsewhere in the app where one exists
 * (mystery adventure-type badge, monster type badge, location type badge, bystander type
 * badge); minion picks a nearby unused orange shade since minions-list uses a bespoke hex
 * rather than a plain Tailwind color class.
 */
const DOMAIN_BADGE_CLASSES: Readonly<Record<string, string>> = {
  Mystery: 'bg-amber-100 text-amber-700',
  Monster: 'bg-red-100 text-red-700',
  Minion: 'bg-orange-100 text-orange-800',
  Location: 'bg-green-100 text-green-900',
  Bystander: 'bg-blue-100 text-blue-800',
};

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [RouterLink, DomainIconComponent],
  templateUrl: './search-results.html',
  styleUrl: './search-results.scss',
})
export class SearchResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = PAGE_SIZE;

  readonly query = signal('');
  readonly page = signal(1);
  readonly items = signal<SearchResultDetailItem[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** `null` until the first `queryParamMap` emission, so the very first load never looks like a "query changed" reset. */
  private lastQuery: string | null = null;
  private searchRequestId = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const q = params.get('q') ?? '';
      const page = this.parsePage(params.get('page'));

      const queryChanged = this.lastQuery !== null && q !== this.lastQuery;
      this.lastQuery = q;

      if (queryChanged && page !== 1) {
        // Query changed via a fresh navigation (e.g. address-bar edit) while an old page
        // number is still present — reset to page 1 by navigating, so the URL and the
        // displayed page stay truthful to each other rather than silently fetching page 1.
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q, page: 1 },
          queryParamsHandling: 'merge',
        });
        return;
      }

      this.query.set(q);
      this.page.set(page);
      this.runSearch(q, page);
    });
  }

  detailRoute(item: SearchResultDetailItem): string[] {
    const segment = DETAIL_ROUTE_SEGMENT[item.entityType];
    return segment ? [segment, item.id] : [];
  }

  badgeClasses(entityType: string): string {
    return DOMAIN_BADGE_CLASSES[entityType] ?? 'bg-slate-100 text-slate-700';
  }

  contextText(item: SearchResultDetailItem): string {
    // Section 7 of architecture.md: today `snippet` is always null, so this always
    // resolves to `excerpt` — the fallback branch is built now so no template change
    // is needed once Phase 4 starts populating `snippet`.
    return item.snippet ?? item.excerpt;
  }

  hasPrev(): boolean {
    return this.page() > 1;
  }

  hasNext(): boolean {
    return this.page() * this.pageSize < this.totalCount();
  }

  goToPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  resultRangeText(): string {
    const total = this.totalCount();
    if (total === 0) {
      return '';
    }
    const start = (this.page() - 1) * this.pageSize + 1;
    const end = Math.min(this.page() * this.pageSize, total);
    return `${start}–${end} of ${total}`;
  }

  private parsePage(rawPage: string | null): number {
    const parsed = rawPage ? Number.parseInt(rawPage, 10) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private runSearch(q: string, page: number): void {
    if (!q.trim()) {
      this.items.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      this.errorMessage.set(null);
      return;
    }

    const requestId = ++this.searchRequestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.searchService
      .search(q, page, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: PagedSearchResult) => {
          if (requestId !== this.searchRequestId) return;
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          if (requestId !== this.searchRequestId) return;
          this.errorMessage.set('Unable to load search results.');
          this.isLoading.set(false);
        },
      });
  }
}
