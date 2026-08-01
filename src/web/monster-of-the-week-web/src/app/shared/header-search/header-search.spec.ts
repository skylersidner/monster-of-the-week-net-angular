import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { SearchResultItem } from '../../core/models';
import { SearchService } from '../../core/search';
import { HeaderSearchComponent } from './header-search';

describe('HeaderSearchComponent', () => {
  let fixture: ComponentFixture<HeaderSearchComponent>;
  let component: HeaderSearchComponent;
  let quickSpy: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const mysteryResult: SearchResultItem = {
    entityType: 'Mystery',
    id: 'mystery-1',
    name: 'The Stone Circle Mystery',
    matchedField: 'Name',
  };
  const monsterResult: SearchResultItem = {
    entityType: 'Monster',
    id: 'monster-1',
    name: 'Stoneheart',
    matchedField: 'Name',
  };
  const locationResult: SearchResultItem = {
    entityType: 'Location',
    id: 'location-1',
    name: 'Stonefall Ridge',
    matchedField: 'Name',
  };

  function setInputValue(value: string): void {
    const input = fixture.nativeElement.querySelector('#header-search-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function dispatchKey(key: string): void {
    const input = fixture.nativeElement.querySelector('#header-search-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    quickSpy = vi.fn().mockReturnValue(of([]));
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [HeaderSearchComponent],
      providers: [
        { provide: SearchService, useValue: { quick: quickSpy } },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire a request for a 2-character query', () => {
    setInputValue('st');
    vi.advanceTimersByTime(200);

    expect(quickSpy).not.toHaveBeenCalled();
    expect(component.results()).toEqual([]);
    expect(component.isOpen()).toBe(false);
  });

  it('fires a request for a 3-character query', () => {
    quickSpy.mockReturnValue(of([mysteryResult]));

    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(quickSpy).toHaveBeenCalledWith('sto');
  });

  it('debounces so a burst of keystrokes only fires one request', () => {
    quickSpy.mockReturnValue(of([mysteryResult]));

    setInputValue('s');
    vi.advanceTimersByTime(50);
    setInputValue('st');
    vi.advanceTimersByTime(50);
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(quickSpy).toHaveBeenCalledTimes(1);
    expect(quickSpy).toHaveBeenCalledWith('sto');
  });

  it('opens the dropdown and populates results on a non-empty response', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult]));

    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(component.results()).toEqual([mysteryResult, monsterResult]);
    expect(component.isOpen()).toBe(true);
  });

  it('stays closed when the response is empty', () => {
    quickSpy.mockReturnValue(of([]));

    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(component.results()).toEqual([]);
    expect(component.isOpen()).toBe(false);
  });

  it('moves highlightedIndex down with ArrowDown and does not wrap past the last item', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult, locationResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(component.highlightedIndex()).toBeNull();

    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(0);

    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(1);

    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(2);

    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(2);
  });

  it('moves highlightedIndex up with ArrowUp and does not wrap or clear past the first item', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult, locationResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    dispatchKey('ArrowDown');
    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(1);

    dispatchKey('ArrowUp');
    expect(component.highlightedIndex()).toBe(0);

    dispatchKey('ArrowUp');
    expect(component.highlightedIndex()).toBe(0);
  });

  it('mouse mouseenter on an option sets the same highlightedIndex signal keyboard uses', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult, locationResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    options[2].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(component.highlightedIndex()).toBe(2);

    dispatchKey('ArrowUp');
    expect(component.highlightedIndex()).toBe(1);
  });

  it('Enter with a highlighted Monster result navigates to its detail route', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    dispatchKey('ArrowDown');
    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(1);

    dispatchKey('Enter');

    expect(navigateSpy).toHaveBeenCalledWith(['/monsters', 'monster-1']);
    expect(component.isOpen()).toBe(false);
  });

  it('Enter with a highlighted Location result navigates to its detail route', () => {
    quickSpy.mockReturnValue(of([locationResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(0);

    dispatchKey('Enter');

    expect(navigateSpy).toHaveBeenCalledWith(['/locations', 'location-1']);
  });

  it('Enter with a highlighted Mystery result navigates to its detail route', () => {
    quickSpy.mockReturnValue(of([mysteryResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    dispatchKey('ArrowDown');
    dispatchKey('Enter');

    expect(navigateSpy).toHaveBeenCalledWith(['/mysteries', 'mystery-1']);
  });

  it('Enter with no highlight navigates toward /search with the query as a query param', () => {
    quickSpy.mockReturnValue(of([mysteryResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);

    expect(component.highlightedIndex()).toBeNull();

    dispatchKey('Enter');

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'sto' } });
  });

  it('clicking a result row has the same effect as Enter-with-highlight', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    options[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/monsters', 'monster-1']);
    expect(component.isOpen()).toBe(false);
  });

  it('Escape closes the dropdown, clears the highlight, and preserves the typed value', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);
    dispatchKey('ArrowDown');

    expect(component.isOpen()).toBe(true);
    expect(component.highlightedIndex()).toBe(0);

    dispatchKey('Escape');

    expect(component.isOpen()).toBe(false);
    expect(component.highlightedIndex()).toBeNull();
    expect(component.query()).toBe('sto');
  });

  it('resets highlightedIndex to null whenever a new result set arrives', () => {
    quickSpy.mockReturnValue(of([mysteryResult, monsterResult]));
    setInputValue('sto');
    vi.advanceTimersByTime(200);
    dispatchKey('ArrowDown');
    dispatchKey('ArrowDown');
    expect(component.highlightedIndex()).toBe(1);

    quickSpy.mockReturnValue(of([locationResult]));
    setInputValue('ston');
    vi.advanceTimersByTime(200);

    expect(component.highlightedIndex()).toBeNull();
    expect(component.results()).toEqual([locationResult]);
  });
});
