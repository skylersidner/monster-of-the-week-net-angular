import { Component, Input, computed, signal } from '@angular/core';

/**
 * Nav-icon keys used by `page-layout.html`'s `NavItem.icon`. Lowercase, plural.
 */
type NavIconKey = 'dashboard' | 'data-admin' | 'mysteries' | 'monsters' | 'minions' | 'locations' | 'bystanders';

/**
 * Maps a singular, capitalized `entityType` (as returned by the search API,
 * e.g. "Monster") to the plural, lowercase nav icon key that already keys the
 * `@switch` this component was extracted from (e.g. "monsters"). Nav callers
 * already pass the plural lowercase form directly, so it passes through unchanged.
 */
const SINGULAR_ENTITY_TYPE_TO_NAV_KEY: Readonly<Record<string, NavIconKey>> = {
  mystery: 'mysteries',
  monster: 'monsters',
  minion: 'minions',
  location: 'locations',
  bystander: 'bystanders',
};

@Component({
  selector: 'app-domain-icon',
  standalone: true,
  host: { class: 'inline-flex items-center justify-center' },
  template: `
    @switch (normalizedDomain()) {
      @case ('dashboard') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />
        </svg>
      }
      @case ('data-admin') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 7h16M4 12h16M4 17h10" />
          <circle cx="18" cy="17" r="2.5" />
        </svg>
      }
      @case ('mysteries') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35M11 8v3l2 1.5" />
        </svg>
      }
      @case ('monsters') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M7 5l2 3h6l2-3M6 8l-2 11h16L18 8M10 13h4" />
        </svg>
      }
      @case ('minions') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="8" cy="9" r="3" />
          <circle cx="16" cy="9" r="3" />
          <path d="M3 19c0-2.8 2.2-5 5-5M21 19c0-2.8-2.2-5-5-5M8 19c0-2.8 2.2-5 4-5s4 2.2 4 5" />
        </svg>
      }
      @case ('locations') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      }
      @case ('bystanders') {
        <svg class="h-5 w-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
        </svg>
      }
    }
  `,
})
export class DomainIconComponent {
  private readonly domainSignal = signal<string>('');

  @Input({ required: true })
  set domain(value: string) {
    this.domainSignal.set(value);
  }

  get domain(): string {
    return this.domainSignal();
  }

  readonly normalizedDomain = computed<NavIconKey | string>(() => {
    const lower = this.domainSignal().toLowerCase();
    return SINGULAR_ENTITY_TYPE_TO_NAV_KEY[lower] ?? lower;
  });
}
