import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth';
import { DomainIconComponent } from '../../shared/domain-icon.component';
import { HeaderSearchComponent } from '../../shared/header-search/header-search';
import { IconComponent } from '../../shared/icons/icon.component';

interface NavItem {
  readonly label: string;
  readonly route: string | null;
  readonly icon: 'dashboard' | 'data-admin' | 'mysteries' | 'monsters' | 'minions' | 'locations' | 'bystanders';
  readonly exactMatch?: boolean;
}

/**
 * Chrome for the authenticated side of the app.
 *
 * The icon sprite, the notification toast host and the API-availability probe/modal used to live
 * here; they moved to App (app.ts / app.html) when the auth shell was added, because all three are
 * app-wide and the login page needs them too. See architecture.md section 3.5.
 */
@Component({
  selector: 'app-page-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DomainIconComponent, HeaderSearchComponent, IconComponent],
  templateUrl: './page-layout.html',
  host: { class: 'block h-full' },
})
export class PageLayoutComponent {
  readonly navItems: readonly NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', exactMatch: true },
    { label: 'Mysteries', route: '/mysteries', icon: 'mysteries', exactMatch: false },
    { label: 'Monsters', route: '/monsters', icon: 'monsters', exactMatch: false },
    { label: 'Minions', route: '/minions', icon: 'minions', exactMatch: false },
    { label: 'Locations', route: '/locations', icon: 'locations', exactMatch: false },
    { label: 'Bystanders', route: '/bystanders', icon: 'bystanders', exactMatch: false },
    { label: 'Data Admin', route: '/data-admin', icon: 'data-admin', exactMatch: true },
  ];

  isShowingUserMenu = false;
  isShowingMobileMenu = false;

  // Constructor injection, matching this file's existing style rather than mixing in inject().
  constructor(private readonly authService: AuthService) {}

  toggleUserMenu(): void {
    this.isShowingUserMenu = !this.isShowingUserMenu;
  }

  closeUserMenu(): void {
    this.isShowingUserMenu = false;
  }

  toggleMobileMenu(): void {
    this.isShowingMobileMenu = !this.isShowingMobileMenu;
  }

  closeMobileMenu(): void {
    this.isShowingMobileMenu = false;
  }

  signOut(): void {
    this.closeUserMenu();
    this.authService.logout();
  }
}
