import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PagedSearchResult, SearchResultDetailItem } from '../../../../core/models';
import { SearchService } from '../../../../core/search';
import { DomainIconComponent } from '../../../../shared/domain-icon.component';
import { SearchResultsComponent } from './search-results';

describe('SearchResultsComponent', () => {
  let fixture: ComponentFixture<SearchResultsComponent>;
  let component: SearchResultsComponent;
  let searchSpy: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let queryParamMapSubject: BehaviorSubject<ParamMap>;

  const monsterItem: SearchResultDetailItem = {
    entityType: 'Monster',
    id: 'monster-1',
    name: 'Stoneheart',
    matchedField: 'Name',
    excerpt: 'A creature of the deep earth.',
    snippet: null,
  };
  const locationItem: SearchResultDetailItem = {
    entityType: 'Location',
    id: 'location-1',
    name: 'Stonefall Ridge',
    matchedField: 'Name',
    excerpt: 'A windswept ridge overlooking the valley.',
    snippet: null,
  };

  function pagedResult(overrides: Partial<PagedSearchResult> = {}): PagedSearchResult {
    return {
      items: [monsterItem, locationItem],
      page: 1,
      pageSize: 20,
      totalCount: 2,
      ...overrides,
    };
  }

  async function setUp(initialParams: Record<string, string>): Promise<void> {
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap(initialParams));
    searchSpy = vi.fn().mockReturnValue(of(pagedResult()));

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders results from a mocked SearchService.search() response', async () => {
    await setUp({ q: 'sto' });

    expect(searchSpy).toHaveBeenCalledWith('sto', 1, 20);
    expect(component.items()).toEqual([monsterItem, locationItem]);

    const names = fixture.nativeElement.querySelectorAll('a.font-semibold');
    expect(names.length).toBe(2);
    expect(names[0].textContent).toContain('Stoneheart');
    expect(names[1].textContent).toContain('Stonefall Ridge');
  });

  it('renders the correct domain badge/icon/link for each entityType', async () => {
    await setUp({ q: 'sto' });

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(2);

    const monsterBadge = items[0].querySelector('span');
    expect(monsterBadge.textContent.trim()).toBe('Monster');
    expect(monsterBadge.className).toContain('bg-red-100');

    const icons = fixture.debugElement.queryAll(By.directive(DomainIconComponent));
    expect((icons[0].componentInstance as DomainIconComponent).domain).toBe('Monster');
    expect((icons[1].componentInstance as DomainIconComponent).domain).toBe('Location');

    const monsterLink = items[0].querySelector('a.font-semibold');
    expect(monsterLink.getAttribute('href')).toBe('/monsters/monster-1');

    const locationBadge = items[1].querySelector('span');
    expect(locationBadge.textContent.trim()).toBe('Location');
    expect(locationBadge.className).toContain('bg-green-100');

    const locationLink = items[1].querySelector('a.font-semibold');
    expect(locationLink.getAttribute('href')).toBe('/locations/location-1');
  });

  it('renders excerpt when snippet is null (the real Phase 1-3 case)', async () => {
    await setUp({ q: 'sto' });

    const paragraphs = fixture.nativeElement.querySelectorAll('li p');
    expect(paragraphs[0].textContent).toContain('A creature of the deep earth.');
  });

  it('renders snippet instead of excerpt when snippet is a non-null string (fallback branch, unreachable with real Phase 1-3 data)', async () => {
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'sto' }));
    searchSpy = vi.fn().mockReturnValue(
      of(
        pagedResult({
          items: [{ ...monsterItem, snippet: 'Attack: Grimtooth — a vicious claw rake.' }],
          totalCount: 1,
        })
      )
    );

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const paragraph = fixture.nativeElement.querySelector('li p');
    expect(paragraph.textContent).toContain('Attack: Grimtooth — a vicious claw rake.');
    expect(paragraph.textContent).not.toContain('A creature of the deep earth.');
  });

  it('disables Prev on page 1 and enables Next when more pages remain', async () => {
    searchSpy = vi.fn().mockReturnValue(of(pagedResult({ page: 1, totalCount: 25 })));
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'sto' }));

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.hasPrev()).toBe(false);
    expect(component.hasNext()).toBe(true);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('disables Next on the last page', async () => {
    searchSpy = vi.fn().mockReturnValue(of(pagedResult({ page: 2, totalCount: 25 })));
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'sto', page: '2' }));

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.hasPrev()).toBe(true);
    expect(component.hasNext()).toBe(false);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
  });

  it('changing the page query param triggers a new search call with the right page', async () => {
    await setUp({ q: 'sto', page: '1' });
    expect(searchSpy).toHaveBeenCalledWith('sto', 1, 20);

    queryParamMapSubject.next(convertToParamMap({ q: 'sto', page: '2' }));

    expect(searchSpy).toHaveBeenCalledWith('sto', 2, 20);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('clicking Next navigates with the page query param merged, leaving q untouched', async () => {
    searchSpy = vi.fn().mockReturnValue(of(pagedResult({ page: 1, totalCount: 25 })));
    await setUp({ q: 'sto', page: '1' });
    searchSpy.mockReturnValue(of(pagedResult({ page: 1, totalCount: 25 })));

    component.goToPage(2);

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 2 }, queryParamsHandling: 'merge' })
    );
  });

  it('changing q resets to page 1 via navigation rather than silently fetching page 1', async () => {
    await setUp({ q: 'sto', page: '3' });
    expect(searchSpy).toHaveBeenCalledWith('sto', 3, 20);
    searchSpy.mockClear();

    queryParamMapSubject.next(convertToParamMap({ q: 'ann', page: '3' }));

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { q: 'ann', page: 1 }, queryParamsHandling: 'merge' })
    );
    // The reset navigates rather than fetching page 3 for the new query directly.
    expect(searchSpy).not.toHaveBeenCalledWith('ann', 3, 20);
  });

  it('renders "No results" when items is empty', async () => {
    searchSpy = vi.fn().mockReturnValue(of(pagedResult({ items: [], totalCount: 0 })));
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'zzz' }));

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("No results for 'zzz'");
  });

  it('renders a lighter prompt when there is no query at all', async () => {
    await setUp({});

    expect(searchSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a search term above');
  });

  it('shows a loading state while the request is in flight', async () => {
    const searchSubject = new Subject<PagedSearchResult>();
    searchSpy = vi.fn().mockReturnValue(searchSubject);
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'sto' }));

    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject } },
        { provide: SearchService, useValue: { search: searchSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Searching');

    searchSubject.next(pagedResult());
    searchSubject.complete();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
  });
});
