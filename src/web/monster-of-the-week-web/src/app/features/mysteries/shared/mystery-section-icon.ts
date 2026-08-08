import { Component, Input } from '@angular/core';
import { MysteryCountdownStageIconKind } from './mystery-countdown-stage';

export type MysterySectionIconKind =
  | 'mystery'
  | 'countdown'
  | 'monster'
  | 'minions'
  | 'locations'
  | 'bystanders'
  | MysteryCountdownStageIconKind;

/**
 * Domain kinds that share art with the left toolbar nav (`DomainIconComponent`,
 * `shared/domain-icon.component.ts`). Maps this component's `kind` values to the
 * `icon-nav-{key}` symbol they now render, mirroring `DomainIconComponent`'s
 * `SINGULAR_ENTITY_TYPE_TO_NAV_KEY` lookup. Kinds not listed here (`countdown` and
 * the 6 countdown-stage kinds) keep rendering their own `icon-mystery-{kind}` symbol.
 */
const DOMAIN_KIND_TO_NAV_KEY: Readonly<Partial<Record<MysterySectionIconKind, string>>> = {
  mystery: 'mysteries',
  monster: 'monsters',
  minions: 'minions',
  locations: 'locations',
  bystanders: 'bystanders',
};

/**
 * Renders via a `<use>` reference into the app-wide icon sprite (`shared/icons/icon-sprite.component.ts`,
 * mounted once in `page-layout.html`) rather than an inline `@switch` of hand-copied `<svg>` markup —
 * `docs/updates/svg-symbol-icons.md`, Phase 4. Domain kinds (`mystery`, `monster`, `minions`,
 * `locations`, `bystanders`) render the same `icon-nav-{key}` symbol as the left toolbar nav —
 * those two icon sets were deliberately drawn differently in the Phase 4 migration but have since
 * been repointed to share art. `countdown` and the 6 countdown-stage kinds still render their own
 * `icon-mystery-{kind}` symbol. Either way, every symbol shares the same
 * `viewBox`/`fill`/`stroke`/`stroke-width` attributes this `<svg>` wrapper still declares (this
 * wrapper additionally declares `stroke-linecap`/`stroke-linejoin`, which apply to whichever path
 * data is referenced regardless of symbol set). The `:host`/`.icon` sizing rules below (the
 * `--mystery-section-icon-size` custom property) size this wrapper `<svg>` itself, not its contents.
 * The component's public `kind` input is unchanged.
 */
@Component({
  selector: 'app-mystery-section-icon',
  template: `
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.8"
      aria-hidden="true">
      <use [attr.href]="'#' + symbolId" />
    </svg>
  `,
  styles: [
    `
      :host {
        align-items: center;
        color: inherit;
        display: inline-flex;
        flex: 0 0 auto;
        height: var(--mystery-section-icon-size, 1rem);
        justify-content: center;
        width: var(--mystery-section-icon-size, 1rem);
      }

      .icon {
        display: block;
        height: 100%;
        overflow: visible;
        width: 100%;
      }
    `,
  ],
})
export class MysterySectionIconComponent {
  @Input({ required: true }) kind!: MysterySectionIconKind;

  get symbolId(): string {
    const navKey = DOMAIN_KIND_TO_NAV_KEY[this.kind];
    return navKey ? `icon-nav-${navKey}` : `icon-mystery-${this.kind}`;
  }
}
