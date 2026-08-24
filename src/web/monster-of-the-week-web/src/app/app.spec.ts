import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { App } from './app';
import { HealthService } from './core/health';
import { NotificationService } from './core/notifications';

/**
 * Covers the three app-wide concerns that moved here from PageLayoutComponent when the auth shell
 * was added: the icon sprite, the toast host, and the API-availability probe/modal.
 * architecture.md section 3.5.
 */
describe('App', () => {
  let fixture: ComponentFixture<App>;
  let mockHealthService: { endpoint: string; getLiveness: () => any };

  beforeEach(async () => {
    mockHealthService = {
      endpoint: '/health/live',
      getLiveness: () => of('Healthy'),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: HealthService, useValue: mockHealthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
  });

  it('should create the app', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the app-wide icon sprite so both shells can resolve <use> references', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('symbol#icon-spinner')).toBeTruthy();
  });

  it('shows queued notifications', () => {
    fixture.detectChanges();
    const notificationService = TestBed.inject(NotificationService);
    notificationService.success('Saved successfully');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saved successfully');
  });

  it('shows API unavailable modal when initial health check fails', () => {
    mockHealthService.getLiveness = () => throwError(() => new Error('API unavailable'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('API unavailable');
    expect((element.querySelector('.api-modal button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('retries API health check and closes modal after success', () => {
    const pendingRetry = new Subject<string>();
    let attempts = 0;
    mockHealthService.getLiveness = () => {
      attempts += 1;
      return attempts === 1 ? throwError(() => new Error('API unavailable')) : pendingRetry.asObservable();
    };

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const retryButton = element.querySelector('.api-modal button') as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(retryButton.disabled).toBe(true);
    expect(element.querySelector('.api-modal svg')).toBeTruthy();

    pendingRetry.next('Healthy');
    pendingRetry.complete();
    fixture.detectChanges();

    expect(element.querySelector('.api-modal')).toBeNull();
  });
});
