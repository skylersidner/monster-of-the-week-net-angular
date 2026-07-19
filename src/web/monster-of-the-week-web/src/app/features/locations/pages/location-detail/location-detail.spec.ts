import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationDetailComponent } from './location-detail';

describe('LocationDetailComponent', () => {
  let component: LocationDetailComponent;
  let fixture: ComponentFixture<LocationDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mysteryId: 'm1', locationId: 'l1' })),
          },
        },
        {
          provide: ApiService,
          useValue: {
            get: () =>
              of({
                id: 'l1',
                mysteryId: 'm1',
                name: 'Location',
                description: null,
                locationTypeId: 'lt1',
                locationTypeName: 'Hub',
                locationTypeMotivation: 'Test',
                customMoves: [],
              }),
            put: () => of({}),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getLocationTypes: () => of([{ id: 'lt1', name: 'Hub', motivation: 'Test' }]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
