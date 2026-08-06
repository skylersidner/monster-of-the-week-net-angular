import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LocationDetailResponse, MysteryListItemResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';
import { LocationService } from '../../../../core/location';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LOCATIONS_ROUTES } from '../../locations.routes';
import { LocationFormComponent } from '../../shared/location-form/location-form';
import { LocationCreateComponent } from './location-create';

describe('locations route ordering', () => {
  it('registers the literal "new" route before the ":locationId" catch-all', () => {
    const paths = LOCATIONS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':locationId'));
  });
});

const locationTypes: TypeRefResponse[] = [{ id: 'location-type-1', name: 'Diner', motivation: 'to feed' }];

const mysteries: MysteryListItemResponse[] = [
  {
    id: 'mystery-1',
    name: 'The Fog',
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const createdLocation: LocationDetailResponse = {
  id: 'new-location-1',
  mysteryIds: [],
  name: 'One Stop Grocery',
  description: null,
  locationTypeId: 'location-type-1',
  locationTypeName: 'Diner',
  locationTypeMotivation: 'to feed',
  customMoves: [],
};

const validPayload: UpsertLocationRequest = {
  name: 'One Stop Grocery',
  description: null,
  locationTypeId: 'location-type-1',
};

interface RecordedCalls {
  order: string[];
  create: { mysteryId: string; payload: UpsertLocationRequest }[];
  createStandalone: UpsertLocationRequest[];
}

describe('LocationCreateComponent', () => {
  let fixture: ComponentFixture<LocationCreateComponent>;
  let component: LocationCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];

  beforeEach(async () => {
    calls = { order: [], create: [], createStandalone: [] };
    notifications = [];
    navigations = [];

    await TestBed.configureTestingModule({
      imports: [LocationCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: LocationService,
          useValue: {
            create: (mysteryId: string, payload: UpsertLocationRequest) => {
              calls.order.push('create');
              calls.create.push({ mysteryId, payload });
              return of(createdLocation);
            },
            createStandalone: (payload: UpsertLocationRequest) => {
              calls.order.push('createStandalone');
              calls.createStandalone.push(payload);
              return of(createdLocation);
            },
          },
        },
        {
          provide: MysteryService,
          useValue: { getMysteries: () => of(mysteries) },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getLocationTypes: () => of(locationTypes),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: (message: string) => notifications.push({ kind: 'success', message }),
            error: (message: string) => notifications.push({ kind: 'error', message }),
            notifications: () => [],
            dismiss: () => {},
          },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((commands: readonly unknown[]) => {
      navigations.push([...commands]);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(LocationCreateComponent);
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

  it('loads location types and mysteries on init', () => {
    expect(component.locationTypes()).toEqual(locationTypes);
    expect(component.mysteries()).toEqual(mysteries);
  });

  it('renders the shared location form in create mode with a Create Location label', () => {
    const instance = sharedForm();
    expect(instance.location).toBeNull();
    expect(instance.submitLabel).toBe('Create Location');
  });

  it('uses createStandalone and the top-level detail route when the mystery picker is blank', () => {
    component.onCreate(validPayload);

    expect(calls.create).toEqual([]);
    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/locations', 'new-location-1']]);
    expect(notifications).toEqual([{ kind: 'success', message: 'Location created.' }]);
  });

  it('uses the mystery-scoped create and detail route when a mystery is selected', () => {
    component.mysteryControl.setValue('mystery-1');

    component.onCreate(validPayload);

    expect(calls.createStandalone).toEqual([]);
    expect(calls.create).toEqual([{ mysteryId: 'mystery-1', payload: validPayload }]);
    expect(navigations).toEqual([['/mysteries', 'mystery-1', 'locations', 'new-location-1']]);
  });

  it('never reaches onCreate when the shared form is submitted with a blank name', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({ name: '', description: '', locationTypeId: 'location-type-1' });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('never reaches onCreate when the shared form is submitted with a blank location type', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({ name: 'One Stop Grocery', description: '', locationTypeId: '' });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('creates through the shared form output when the core fields are valid', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: 'One Stop Grocery',
      description: '',
      locationTypeId: 'location-type-1',
    });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.createStandalone).toEqual([validPayload]);
  });

  it('keeps the user on the page with an inline error and preserved mystery selection when the create call fails', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'create').mockReturnValue(throwError(() => new Error('nope')));

    component.mysteryControl.setValue('mystery-1');

    component.onCreate(validPayload);

    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create location.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create location.' }]);
    expect(component.mysteryControl.value).toBe('mystery-1');
  });

  it('keeps the user on the page with an inline error when the standalone create call fails', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(validPayload);

    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create location.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create location.' }]);
    expect(component.mysteryControl.value).toBe('');
  });
});
