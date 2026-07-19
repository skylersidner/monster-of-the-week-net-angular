import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DashboardPageComponent } from './dashboard';
import { MysteryService } from '../../core/mystery';

class MockMysteryService {
  getMysteries() {
    return of([
      {
        id: 'm1',
        name: 'The Hollow Choir',
        concept: null,
        hook: null,
        monsterCount: 2,
        locationCount: 3,
        bystanderCount: 4,
        createdAt: '2026-07-18T12:00:00Z',
      },
      {
        id: 'm2',
        name: 'Rust in the Fog',
        concept: null,
        hook: null,
        monsterCount: 1,
        locationCount: 2,
        bystanderCount: 1,
        createdAt: '2026-07-19T12:00:00Z',
      },
    ]);
  }
}

describe('DashboardPageComponent', () => {
  let component: DashboardPageComponent;
  let fixture: ComponentFixture<DashboardPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideRouter([]), { provide: MysteryService, useClass: MockMysteryService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders aggregated mystery totals', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Mysteries');
    expect(element.textContent).toContain('2');
    expect(element.textContent).toContain('3');
    expect(element.textContent).toContain('5');
  });
});
