import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationDetailComponent } from './location-detail';

describe('LocationDetailComponent', () => {
  let component: LocationDetailComponent;
  let fixture: ComponentFixture<LocationDetailComponent>;
  let putSubject: Subject<unknown>;
  let successCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    successCalls = 0;

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
                mysteryIds: ['m1'],
                name: 'Location',
                description: null,
                locationTypeId: 'lt1',
                locationTypeName: 'Hub',
                locationTypeMotivation: 'Test',
                customMoves: [],
              }),
            put: () => putSubject,
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getLocationTypes: () => of([{ id: 'lt1', name: 'Hub', motivation: 'Test' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {
              successCalls += 1;
            },
            error: () => {},
            notifications: () => [],
            dismiss: () => {},
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

  it('tracks save loading state and sends success toast', () => {
    component.save();
    expect(component.isSaving()).toBe(true);

    putSubject.next({
      id: 'l1',
      mysteryIds: ['m1'],
      name: 'Location',
      description: null,
      locationTypeId: 'lt1',
      locationTypeName: 'Hub',
      locationTypeMotivation: 'Test',
      customMoves: [],
    });
    putSubject.complete();

    expect(component.isSaving()).toBe(false);
    expect(successCalls).toBe(1);
  });
});
