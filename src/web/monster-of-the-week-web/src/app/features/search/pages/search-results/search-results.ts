import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PagedSearchResult, SearchMatchSpan, SearchResultDetailItem } from '../../../../core/models';
import { SearchService } from '../../../../core/search';
import { DomainIconComponent } from '../../../../shared/domain-icon.component';

const PAGE_SIZE = 20;

/** One rendered chunk of a snippet — either plain text or a highlighted match, in reading order. */
export interface SnippetSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Turns `(snippet, matchSpans)` into an ordered array of plain/matched segments for template
 * rendering. `matchSpans` are assumed pre-sorted and non-overlapping (the backend merges any
 * overlapping/adjacent spans before returning them — `architecture.md` Section 7). Colocated
 * here rather than a shared module since `SearchResultsComponent` is its only consumer today
 * (`phases.md`'s Phase 4c work item) — promote only if a second consumer appears later.
 */
export function buildSnippetSegments(snippet: string, spans: SearchMatchSpan[]): SnippetSegment[] {
  if (spans.length === 0) {
    return [{ text: snippet, isMatch: false }];
  }

  const segments: SnippetSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: snippet.slice(cursor, span.start), isMatch: false });
    }
    segments.push({ text: snippet.slice(span.start, span.start + span.length), isMatch: true });
    cursor = span.start + span.length;
  }

  if (cursor < snippet.length) {
    segments.push({ text: snippet.slice(cursor), isMatch: false });
  }

  return segments;
}

/**
 * The "Matched in: ..." chip label. `null` for a `Name` match (redundant with the already-linked
 * title — no chip). Bare field name (`"Description"`, `"Hook"`, ...) for entity-level long-text
 * matches; `"{Kind} — {sub-resource name}"` (e.g. `"Attack — Fire Breath"`) for sub-resource
 * matches. `architecture.md` Section 6.
 */
export function fieldLabel(item: SearchResultDetailItem): string | null {
  if (item.matchedField === 'Name') return null;
  const [kind, field] = item.matchedField.includes('.') ? item.matchedField.split('.') : [null, item.matchedField];
  return kind && item.matchedSubResourceName ? `${kind} — ${item.matchedSubResourceName}` : field;
}

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

  contextSegments(item: SearchResultDetailItem): SnippetSegment[] {
    return item.snippet !== null
      ? buildSnippetSegments(item.snippet, item.matchSpans)
      : [{ text: item.excerpt, isMatch: false }];
  }

  /** Exposes the standalone `fieldLabel` function for the template. */
  readonly fieldLabel = fieldLabel;

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
