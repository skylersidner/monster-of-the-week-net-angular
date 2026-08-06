import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';

import { LocationService } from '../../../../core/location';
import { LocationDetailResponse, UpsertLocationRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationFormComponent } from '../../shared/location-form/location-form';
import { LocationDetailComponent } from './location-detail';

const loadedLocation: LocationDetailResponse = {
  id: 'l1',
  mysteryIds: [],
  name: 'Location',
  description: null,
  locationTypeId: 'lt1',
  locationTypeName: 'Hub',
  locationTypeMotivation: 'Test',
  customMoves: [],
};

describe('LocationDetailComponent', () => {
  let component: LocationDetailComponent;
  let fixture: ComponentFixture<LocationDetailComponent>;
  let putSubject: Subject<unknown>;
  let updateCalls: { locationId: string; payload: UpsertLocationRequest }[] = [];
  let successCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    updateCalls = [];
    successCalls = 0;

    await TestBed.configureTestingModule({
      imports: [LocationDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ locationId: 'l1' })),
          },
        },
        {
          provide: LocationService,
          useValue: {
            getById: () => of(loadedLocation),
            update: (locationId: string, payload: UpsertLocationRequest) => {
              updateCalls.push({ locationId, payload });
              return putSubject;
            },
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

  function sharedForm(): LocationFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(LocationFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as LocationFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the shared location form instead of its own core-fields form', () => {
    expect(fixture.nativeElement.querySelector('app-location-form')).toBeTruthy();
    expect((component as unknown as Record<string, unknown>)['form']).toBeUndefined();
  });

  it('passes the loaded location and a Save Location label down to the shared form', () => {
    const instance = sharedForm();
    expect(component.location()).not.toBeNull();
    expect(instance.location).toBe(loadedLocation);
    expect(instance.submitLabel).toBe('Save Location');
    expect(instance.locationTypes).toEqual([{ id: 'lt1', name: 'Hub', motivation: 'Test' }]);
    expect(instance.locationForm.getRawValue()).toEqual({
      name: 'Location',
      description: '',
      locationTypeId: 'lt1',
    });
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: 'Renamed',
      description: '',
      locationTypeId: 'lt1',
    });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateCalls).toEqual([
      {
        locationId: 'l1',
        payload: {
          name: 'Renamed',
          description: null,
          locationTypeId: 'lt1',
        },
      },
    ]);
  });

  it('does not call update when no location has been loaded', () => {
    component.location.set(null);

    component.save({ name: 'Renamed', description: null, locationTypeId: 'lt1' });

    expect(updateCalls).toEqual([]);
  });

  it('tracks save loading state and sends success toast', () => {
    component.save({ name: 'Location', description: null, locationTypeId: 'lt1' });
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

  it('leaves the read-only custom moves list rendering', () => {
    expect(fixture.nativeElement.textContent).toContain('Custom Moves');
    expect(fixture.nativeElement.textContent).toContain('No custom moves.');
  });
});
