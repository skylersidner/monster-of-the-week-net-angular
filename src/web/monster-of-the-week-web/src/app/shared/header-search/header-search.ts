import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { SearchResultItem } from '../../core/models';
import { SearchService } from '../../core/search';
import { DomainIconComponent } from '../domain-icon.component';

/** Frontend-only minimum query length gate (`architecture.md` Section 2) — the backend does not reject short queries. */
const MIN_QUERY_LENGTH = 3;

/** Flat, top-level detail routes per `architecture.md` Section 6 / `phases.md`. */
const DETAIL_ROUTE_SEGMENT: Readonly<Record<string, string>> = {
  Mystery: '/mysteries',
  Monster: '/monsters',
  Minion: '/minions',
  Location: '/locations',
  Bystander: '/bystanders',
};

@Component({
  selector: 'app-header-search',
  standalone: true,
  imports: [DomainIconComponent],
  templateUrl: './header-search.html',
  styleUrl: './header-search.scss',
  host: { class: 'block' },
})
export class HeaderSearchComponent {
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = signal('');
  readonly results = signal<SearchResultItem[]>([]);
  readonly isOpen = signal(false);
  readonly highlightedIndex = signal<number | null>(null);
  readonly isLoading = signal(false);

  readonly listboxId = 'header-search-listbox';

  private readonly querySubject = new Subject<string>();

  constructor() {
    this.querySubject
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        tap((value) => {
          if (value.trim().length < MIN_QUERY_LENGTH) {
            this.results.set([]);
            this.isOpen.set(false);
            this.highlightedIndex.set(null);
            this.isLoading.set(false);
          } else {
            this.isLoading.set(true);
          }
        }),
        filter((value) => value.trim().length >= MIN_QUERY_LENGTH),
        switchMap((value) => this.searchService.quick(value).pipe(catchError(() => of<SearchResultItem[]>([])))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        this.isLoading.set(false);
        this.results.set(results);
        this.highlightedIndex.set(null);
        this.isOpen.set(results.length > 0);
      });
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.querySubject.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlightDown();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlightUp();
        break;
      case 'Enter':
        event.preventDefault();
        this.selectHighlightedOrSearch();
        break;
      case 'Escape':
        // Native <input type="search"> clears its own value on Escape by default —
        // prevent that so the typed text is genuinely preserved, per spec.
        event.preventDefault();
        this.closeAndClearHighlight();
        break;
    }
  }

  onBlur(): void {
    this.isOpen.set(false);
    this.highlightedIndex.set(null);
  }

  setHighlighted(index: number): void {
    this.highlightedIndex.set(index);
  }

  selectResult(result: SearchResultItem, index: number): void {
    this.highlightedIndex.set(index);
    this.navigateToResult(result);
  }

  activeDescendantId(): string | null {
    const index = this.highlightedIndex();
    return index === null ? null : `header-search-option-${index}`;
  }

  private moveHighlightDown(): void {
    if (!this.isOpen()) {
      if (this.results().length > 0) {
        this.isOpen.set(true);
      }
      return;
    }

    const count = this.results().length;
    if (count === 0) {
      return;
    }

    const current = this.highlightedIndex();
    if (current === null) {
      this.highlightedIndex.set(0);
    } else if (current < count - 1) {
      this.highlightedIndex.set(current + 1);
    }
  }

  private moveHighlightUp(): void {
    const count = this.results().length;
    if (count === 0) {
      return;
    }

    const current = this.highlightedIndex();
    if (current === null) {
      this.highlightedIndex.set(count - 1);
    } else if (current > 0) {
      this.highlightedIndex.set(current - 1);
    }
  }

  private selectHighlightedOrSearch(): void {
    const index = this.highlightedIndex();
    if (index !== null) {
      const result = this.results()[index];
      if (result) {
        this.navigateToResult(result);
      }
      return;
    }

    this.isOpen.set(false);
    this.router.navigate(['/search'], { queryParams: { q: this.query() } });
  }

  private navigateToResult(result: SearchResultItem): void {
    this.isOpen.set(false);
    const segment = DETAIL_ROUTE_SEGMENT[result.entityType];
    if (!segment) {
      return;
    }
    this.router.navigate([segment, result.id]);
  }

  private closeAndClearHighlight(): void {
    this.isOpen.set(false);
    this.highlightedIndex.set(null);
  }
}
