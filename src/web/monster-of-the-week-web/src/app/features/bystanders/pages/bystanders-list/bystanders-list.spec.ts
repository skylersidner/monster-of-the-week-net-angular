import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { BystandersListComponent } from './bystanders-list';

describe('BystandersListComponent', () => {
  let component: BystandersListComponent;
  let fixture: ComponentFixture<BystandersListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BystandersListComponent],
      providers: [
        provideRouter([]),
        {
          provide: BystanderService,
          useValue: {
            getAll: () =>
              of([
                {
                  id: 'b1',
                  mysteryIds: [],
                  name: 'Farmer Joe',
                  description: 'A local farmer.',
                  bystanderTypeId: 'bt1',
                  bystanderTypeName: 'Witness',
                  bystanderTypeMotivation: 'to see and be seen',
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BystandersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a bystander card after loading', () => {
    expect(component.bystanders().length).toBe(1);
    expect(component.bystanders()[0].name).toBe('Farmer Joe');
  });
});
