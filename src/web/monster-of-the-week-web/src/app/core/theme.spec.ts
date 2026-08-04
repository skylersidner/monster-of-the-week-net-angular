import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme';

const STORAGE_KEY = 'motw:theme';

/**
 * This test environment's `window` doesn't come with a working Storage implementation
 * out of the box (and Node's own experimental global `localStorage` is a separate,
 * unrelated object) — install a minimal in-memory one so ThemeService's `window.localStorage`
 * reads/writes have somewhere real to land.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

interface FakeMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  dispatchChange: (matches: boolean) => void;
}

function createFakeMatchMedia(initialMatches: boolean): FakeMediaQueryList {
  const listeners: Array<(event: { matches: boolean }) => void> = [];
  const mql: FakeMediaQueryList = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type, listener) => listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    dispatchChange: (matches) => {
      mql.matches = matches;
      listeners.forEach((listener) => listener({ matches }));
    },
  };
  return mql;
}

describe('ThemeService', () => {
  let fakeMatchMedia: FakeMediaQueryList;

  function stubSystemPrefersDark(matches: boolean): void {
    fakeMatchMedia = createFakeMatchMedia(matches);
    // This test environment's `window` doesn't ship a real `matchMedia` implementation to
    // spy on (unlike a real browser) — assign a fake directly rather than via vi.spyOn().
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue(fakeMatchMedia),
      configurable: true,
      writable: true,
    });
  }

  function createService(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
    stubSystemPrefersDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults preference to "system" when nothing is persisted', () => {
    const service = createService();

    expect(service.preference()).toBe('system');
  });

  it('seeds resolvedTheme from the OS preference when nothing is persisted and preference is "system"', () => {
    stubSystemPrefersDark(true);
    const service = createService();

    expect(service.preference()).toBe('system');
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('resolves preference "light" to resolvedTheme "light" regardless of the OS preference', () => {
    stubSystemPrefersDark(true);
    window.localStorage.setItem(STORAGE_KEY, 'light');
    const service = createService();

    expect(service.preference()).toBe('light');
    expect(service.resolvedTheme()).toBe('light');
  });

  it('resolves preference "dark" to resolvedTheme "dark" regardless of the OS preference', () => {
    stubSystemPrefersDark(false);
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    const service = createService();

    expect(service.preference()).toBe('dark');
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('resolves preference "system" against the live OS preference at read time', () => {
    stubSystemPrefersDark(false);
    window.localStorage.setItem(STORAGE_KEY, 'system');
    const service = createService();

    expect(service.resolvedTheme()).toBe('light');

    fakeMatchMedia.dispatchChange(true);

    expect(service.resolvedTheme()).toBe('dark');
  });

  it('setPreference() updates the signal and persists the choice to localStorage', () => {
    const service = createService();

    service.setPreference('dark');

    expect(service.preference()).toBe('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setPreference() immediately re-resolves resolvedTheme to match the new preference', () => {
    stubSystemPrefersDark(true);
    const service = createService();
    expect(service.resolvedTheme()).toBe('dark');

    service.setPreference('light');
    expect(service.resolvedTheme()).toBe('light');

    service.setPreference('system');
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('ignores a garbage persisted value and falls back to "system"', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-real-theme');
    const service = createService();

    expect(service.preference()).toBe('system');
  });
});
