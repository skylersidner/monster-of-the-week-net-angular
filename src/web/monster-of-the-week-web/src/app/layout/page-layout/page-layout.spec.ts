import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { HealthService } from '../../core/health';
import { NotificationService } from '../../core/notifications';
import { PageLayoutComponent } from './page-layout';

describe('PageLayoutComponent', () => {
  let component: PageLayoutComponent;
  let fixture: ComponentFixture<PageLayoutComponent>;
  let mockHealthService: { endpoint: string; getLiveness: () => any };

  beforeEach(async () => {
    mockHealthService = {
      endpoint: 'http://localhost:5225/health/live',
      getLiveness: () => of('Healthy'),
    };

    await TestBed.configureTestingModule({
      imports: [PageLayoutComponent],
      providers: [provideRouter([]), { provide: HealthService, useValue: mockHealthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PageLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows queued notifications', () => {
    fixture.detectChanges();
    const notificationService = TestBed.inject(NotificationService);
    notificationService.success('Saved successfully');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saved successfully');
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
