import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HealthService } from '../../core/health';
import { NotificationService } from '../../core/notifications';

interface NavItem {
  readonly label: string;
  readonly route: string | null;
  readonly icon: 'dashboard' | 'data-admin' | 'mysteries' | 'monsters' | 'minions' | 'locations' | 'bystanders';
  readonly exactMatch?: boolean;
}

@Component({
  selector: 'app-page-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './page-layout.html',
  host: { class: 'block h-full' },
})
export class PageLayoutComponent implements OnInit {
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
  readonly isCheckingApiAvailability = signal(false);
  readonly isApiUnavailable = signal(false);

  constructor(
    readonly notificationService: NotificationService,
    private readonly healthService: HealthService
  ) {}

  ngOnInit(): void {
    this.checkApiAvailability();
  }

  toggleUserMenu(): void {
    this.isShowingUserMenu = !this.isShowingUserMenu;
  }

  toggleMobileMenu(): void {
    this.isShowingMobileMenu = !this.isShowingMobileMenu;
  }

  closeMobileMenu(): void {
    this.isShowingMobileMenu = false;
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
