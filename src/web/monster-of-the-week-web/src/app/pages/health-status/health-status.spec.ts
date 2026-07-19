import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HealthStatus } from './health-status';
import { HealthService } from '../../core/health';

class MockHealthService {
  readonly endpoint = 'http://localhost:5225/health/live';

  getLiveness() {
    return of('Healthy');
  }
}

describe('HealthStatus', () => {
  let component: HealthStatus;
  let fixture: ComponentFixture<HealthStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthStatus],
      providers: [{ provide: HealthService, useClass: MockHealthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthStatus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render liveness response', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('API liveness: Healthy');
  });
});
