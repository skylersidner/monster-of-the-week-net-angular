import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth';
import { PageLayoutComponent } from './page-layout';

/** Stand-in for the real settings page so the user-menu link has a route to resolve. */
@Component({ template: '' })
class StubSettingsPageComponent {}

/**
 * The notification-toast and API-availability tests that used to live here moved to app.spec.ts
 * when those concerns were hoisted to App — see architecture.md section 3.5.
 */
describe('PageLayoutComponent', () => {
  let component: PageLayoutComponent;
  let fixture: ComponentFixture<PageLayoutComponent>;
  let httpTestingController: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageLayoutComponent],
      providers: [
        provideRouter([{ path: 'settings', component: StubSettingsPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(PageLayoutComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders dashboard nav entry', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Dashboard');
  });

  it('renders data admin nav entry', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Data Admin');
  });

  it('renders nav entries for all entity routes', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Hunters');
    expect(element.textContent).toContain('Monsters');
    expect(element.textContent).toContain('Minions');
    expect(element.textContent).toContain('Locations');
    expect(element.textContent).toContain('Bystanders');
  });

  it('opens and closes the mobile menu', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const openButton = element.querySelector('button[aria-label="Open sidebar"]') as HTMLButtonElement;
    openButton.click();
    fixture.detectChanges();

    expect(element.querySelector('.sidebar-mobile')).toBeTruthy();

    const closeButton = element.querySelector('button[aria-label="Close sidebar"]') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(element.querySelector('.sidebar-mobile')).toBeNull();
  });

  it('links to the settings page from the user menu and closes the menu on navigation', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a[href="/settings"]')).toBeNull();

    (element.querySelector('button[aria-label="Open user menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const settingsLink = element.querySelector('a[href="/settings"]') as HTMLAnchorElement;
    expect(settingsLink).toBeTruthy();
    expect(settingsLink.textContent).toContain('Settings');
    expect(element.textContent).toContain('Your profile');
    expect(element.textContent).toContain('Sign out');

    settingsLink.click();
    fixture.detectChanges();

    expect(element.querySelector('a[href="/settings"]')).toBeNull();
  });

  it('signs out from the user menu, ending the session and returning to /login', () => {
    const authService = TestBed.inject(AuthService);
    authService.login('test@local.dev', 'pw').subscribe();
    httpTestingController.expectOne('/api/auth/login').flush({ id: 'u1', email: 'test@local.dev' });

    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('button[aria-label="Open user menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const signOutButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Sign out'
    ) as HTMLButtonElement;
    expect(signOutButton).toBeTruthy();

    signOutButton.click();
    httpTestingController
      .expectOne('/api/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(authService.user()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(component.isShowingUserMenu).toBe(false);
  });

  // "Your profile" is dead today and stays dead in this pass — there is no profile page for it to
  // point at. Asserted so it is not mistaken for an oversight.
  it('leaves "Your profile" as a dead link', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('button[aria-label="Open user menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const profileLink = Array.from(element.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Your profile')
    ) as HTMLAnchorElement;

    expect(profileLink.getAttribute('href')).toBe('#');
  });
});
