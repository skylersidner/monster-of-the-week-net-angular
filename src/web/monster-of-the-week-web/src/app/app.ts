import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HealthService } from './core/health';
import { NotificationService } from './core/notifications';
import { IconComponent } from './shared/icons/icon.component';
import { IconSpriteComponent } from './shared/icons/icon-sprite.component';

/**
 * Application root, and the host for the three concerns that are app-wide rather than
 * shell-specific: the icon sprite, the notification toast host, and the API-availability probe and
 * its modal.
 *
 * All three previously lived in PageLayoutComponent, which was fine while there was exactly one
 * shell. With the auth shell added they have to sit above both, or the login page gets: icons that
 * render blank (a <use> pointing at a sprite that is not in the document — no error, no console
 * warning), toasts that render nowhere and auto-dismiss after 4s, and no way at all to tell the
 * user the API is unreachable. The last of those also removes the only way to verify the dev
 * proxy's /health rule, whose whole defining property is that it fails silently.
 *
 * Owner-confirmed 2026-08-18. docs/simple-authentication-update/architecture.md section 3.5,
 * open-questions.md #5.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IconSpriteComponent, IconComponent],
  templateUrl: './app.html',
  host: { class: 'block h-full' },
})
export class App implements OnInit {
  readonly notificationService = inject(NotificationService);
  private readonly healthService = inject(HealthService);

  readonly isCheckingApiAvailability = signal(false);
  readonly isApiUnavailable = signal(false);

  ngOnInit(): void {
    this.checkApiAvailability();
  }

  checkApiAvailability(): void {
    this.isCheckingApiAvailability.set(true);
    this.healthService.getLiveness().subscribe({
      next: () => {
        this.isCheckingApiAvailability.set(false);
        this.isApiUnavailable.set(false);
      },
      error: () => {
        this.isCheckingApiAvailability.set(false);
        this.isApiUnavailable.set(true);
      },
    });
  }
}
