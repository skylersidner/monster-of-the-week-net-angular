import { Component, Input, computed, signal } from '@angular/core';

/**
 * Nav-icon keys used by `page-layout.html`'s `NavItem.icon`. Lowercase, plural.
 */
type NavIconKey =
  | 'dashboard'
  | 'data-admin'
  | 'mysteries'
  | 'monsters'
  | 'minions'
  | 'locations'
  | 'bystanders'
  | 'hunters';

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
  // No HunterSearchProvider exists yet, so nothing produces entityType "Hunter" today. Mapped
  // anyway because the alternative is a silent failure: an unmapped key passes through
  // unchanged and renders `#icon-nav-hunter` (singular), which is not a symbol in the sprite —
  // a blank icon, no error. Costs one line now versus a puzzling gap later.
  hunter: 'hunters',
};

export type DomainIconSize = 'sm' | 'md' | 'lg' | 'xl';

const DOMAIN_ICON_SIZE_CLASSES: Readonly<Record<DomainIconSize, string>> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * Renders via a `<use>` reference into the app-wide icon sprite (`shared/icons/icon-sprite.component.ts`,
 * mounted once in `page-layout.html`) rather than an inline `@switch` of hand-copied `<svg>` markup —
 * `docs/updates/svg-symbol-icons.md`, Phase 4. Every `icon-nav-{key}` symbol shares the same
 * `viewBox="0 0 24 24"`/`fill="none"`/`stroke="currentColor"`/`stroke-width="1.8"` attributes this
 * `<svg>` wrapper still declares, so this is a visual no-op versus the prior per-case markup — only
 * *where* the path data lives changed, not the component's public `domain` input or its normalization
 * logic below.
 */
@Component({
  selector: 'app-domain-icon',
  standalone: true,
  host: { class: 'inline-flex items-center justify-center' },
  template: `
    <svg [attr.class]="sizeClass" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <use [attr.href]="'#icon-nav-' + normalizedDomain()" />
    </svg>
  `,
})
export class DomainIconComponent {
  /**
   * The svg's size. It's set on the inner `<svg>`, so a class on the host can't resize it; that's
   * why this is an input. `'md'` (h-5 w-5) is the original fixed size, so every existing call
   * site renders unchanged. The larger sizes are for the resource-image placeholders (a full-size
   * carousel slide, the carousel's empty state). Literal class strings, so Tailwind's scanner
   * sees each one.
   */
  @Input() size: DomainIconSize = 'md';

  get sizeClass(): string {
    return DOMAIN_ICON_SIZE_CLASSES[this.size] ?? DOMAIN_ICON_SIZE_CLASSES.md;
  }

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
