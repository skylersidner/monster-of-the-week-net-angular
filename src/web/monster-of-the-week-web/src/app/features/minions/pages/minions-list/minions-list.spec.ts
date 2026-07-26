import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MinionService } from '../../../../core/minion';
import { MinionsListComponent } from './minions-list';

describe('MinionsListComponent', () => {
  let component: MinionsListComponent;
  let fixture: ComponentFixture<MinionsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinionsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: MinionService,
          useValue: {
            getAll: () =>
              of([
                {
                  id: '1',
                  monsterId: 'm1',
                  monsterName: 'The Beast',
                  name: 'Grunt',
                  description: null,
                  harmCapacity: 2,
                  minionType: { id: 'mt1', name: 'Torturer', motivation: 'dominate' },
                  powerCount: 0,
                  armorCount: 0,
                  weaknessCount: 0,
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MinionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a minion card after loading', () => {
    expect(component.minions().length).toBe(1);
    expect(component.minions()[0].name).toBe('Grunt');
  });

  it('shows the parent monster name', () => {
    expect(component.minions()[0].monsterName).toBe('The Beast');
  });
});
