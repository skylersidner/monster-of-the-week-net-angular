import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NotificationService } from '../../core/notifications';
import { PageLayoutComponent } from './page-layout';

describe('PageLayoutComponent', () => {
  let component: PageLayoutComponent;
  let fixture: ComponentFixture<PageLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageLayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PageLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows queued notifications', () => {
    const notificationService = TestBed.inject(NotificationService);
    notificationService.success('Saved successfully');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saved successfully');
  });
});
