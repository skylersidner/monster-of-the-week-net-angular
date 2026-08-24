import { Component, Input } from '@angular/core';

/**
 * Generic action/chrome icon names, backed by the unprefixed `icon-{name}` symbols in
 * `icon-sprite.component.ts` (`docs/updates/svg-symbol-icons.md`, "Naming convention").
 * Deliberately scoped to this set only — domain/nav and mystery-section icons are consumed
 * through their own existing components (`DomainIconComponent`/`MysterySectionIconComponent`),
 * not through `IconComponent`, and are namespaced separately in the sprite (`icon-nav-*`/
 * `icon-mystery-*`) to avoid name collisions with these.
 */
export type IconName = 'trash' | 'pencil' | 'close' | 'menu' | 'plus' | 'spinner' | 'search' | 'logo';

/**
 * Typed wrapper around a `<use>` reference into the app-wide icon sprite (`IconSpriteComponent`),
 * mirroring `DomainIconComponent`'s existing "typed icon component" convention. Renders
 * `<svg><use href="#icon-{name}" /></svg>` — callers size it via ordinary Tailwind classes on the
 * host (e.g. `<app-icon name="trash" class="h-5 w-5" />`), same as the inline `<svg>` markup this
 * replaces.
 *
 * Not yet consumed anywhere (Phase 0 is additive-only, `docs/updates/svg-symbol-icons.md`) — call
 * sites are wired up starting Phase 1.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  host: { class: 'inline-flex items-center justify-center' },
  template: `<svg class="h-full w-full" aria-hidden="true"><use [attr.href]="'#icon-' + name" /></svg>`,
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
}
