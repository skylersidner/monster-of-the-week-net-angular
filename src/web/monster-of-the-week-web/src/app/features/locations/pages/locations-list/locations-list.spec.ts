import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LocationService } from '../../../../core/location';
import { LocationsListComponent } from './locations-list';

describe('LocationsListComponent', () => {
  let component: LocationsListComponent;
  let fixture: ComponentFixture<LocationsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: LocationService,
          useValue: {
            getAll: () =>
              of([
                {
                  id: 'l1',
                  mysteryIds: [],
                  name: 'The Old Mill',
                  description: 'Creaky and ominous.',
                  locationTypeId: 'lt1',
                  locationTypeName: 'Hub',
                  locationTypeMotivation: 'to be a crossroads',
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a location card after loading', () => {
    expect(component.locations().length).toBe(1);
    expect(component.locations()[0].name).toBe('The Old Mill');
  });
});
