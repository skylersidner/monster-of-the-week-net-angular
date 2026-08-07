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
 * Renders via a `<use>` reference into the app-wide icon sprite (`shared/icons/icon-sprite.component.ts`,
 * mounted once in `page-layout.html`) rather than an inline `@switch` of hand-copied `<svg>` markup —
 * `docs/updates/svg-symbol-icons.md`, Phase 4. Every `icon-mystery-{kind}` symbol shares the same
 * `viewBox`/`fill`/`stroke`/`stroke-linecap`/`stroke-linejoin`/`stroke-width` attributes this `<svg>`
 * wrapper still declares, so this is a visual no-op versus the prior per-case markup. The `:host`/`.icon`
 * sizing rules below (the `--mystery-section-icon-size` custom property) size this wrapper `<svg>`
 * itself, not its contents — unaffected by what's inside it, whether that's a `@switch`-selected inline
 * `<path>` or a `<use>` reference. The component's public `kind` input is unchanged.
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
      <use [attr.href]="'#icon-mystery-' + kind" />
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
}
