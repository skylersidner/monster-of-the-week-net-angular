import { Injectable, Signal, computed, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, map } from 'rxjs';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'motw:theme';

/**
 * Narrow persistence seam (Decision F, docs/theming/theming-plan.md): all localStorage
 * access is isolated behind these two functions so swapping the backing store later
 * (e.g. a per-user backend setting once auth exists) is a change confined to this file.
 */
function readStoredPreference(): ThemePreference | null {
  // window.localStorage, not the bare `localStorage` global — Node 22+'s own experimental
  // webstorage global can otherwise shadow the DOM's (browser/jsdom) localStorage in tests.
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null;
}

function writeStoredPreference(preference: ThemePreference): void {
  window.localStorage.setItem(STORAGE_KEY, preference);
}

function systemPrefersDarkNow(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly preference = signal<ThemePreference>(readStoredPreference() ?? 'system');

  // Owns the one `matchMedia` change listener; ties its subscription lifecycle to this
  // field initializer's injection context and tears it down via DestroyRef automatically.
  private readonly systemPrefersDark = toSignal(
    fromEvent<MediaQueryListEvent>(window.matchMedia('(prefers-color-scheme: dark)'), 'change').pipe(
      map((event) => event.matches)
    ),
    { initialValue: systemPrefersDarkNow() }
  );

  // Pure computed: only reads other signals, never subscribes to anything itself.
  readonly resolvedTheme: Signal<ResolvedTheme> = computed(() => {
    const pref = this.preference();
    return pref === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : pref;
  });

  // Keeps the DOM class in sync whenever resolvedTheme changes for any reason, including a
  // live OS-level theme change while preference is 'system' (nothing else calls
  // applyDomClass() for that case). The explicit applyDomClass() calls in setPreference()/
  // initialize() below are kept anyway so the class is guaranteed correct synchronously,
  // rather than depending on this effect's scheduling — this effect is a no-op re-application
  // in those two cases, and the only path for the live-system-change case.
  private readonly syncDomClass = effect(() => this.applyDomClass());

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    writeStoredPreference(preference);
    this.applyDomClass();
  }

  /** Reconciles persisted/seeded value with the DOM class; called once at bootstrap. */
  initialize(): void {
    this.applyDomClass();
  }

  private applyDomClass(): void {
    document.documentElement.classList.toggle('dark', this.resolvedTheme() === 'dark');
  }
}
