import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CustomMoveService } from '../../../../core/custom-moves';
import { LocationDetailResponse, MysteryListItemResponse, TypeRefResponse, UpsertLocationRequest } from '../../../../core/models';
import { LocationService } from '../../../../core/location';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LOCATIONS_ROUTES } from '../../locations.routes';
import { LocationFormComponent, LocationFormSubmit } from '../../shared/location-form/location-form';
import { LocationCreateComponent } from './location-create';

describe('locations route ordering', () => {
  it('registers the literal "new" route before the ":locationId" catch-all', () => {
    const paths = LOCATIONS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':locationId'));
  });
});

const locationTypes: TypeRefResponse[] = [{ id: 'location-type-1', name: 'Diner', motivation: 'to feed' }];

function buildMystery(id: string, name: string): MysteryListItemResponse {
  return {
    id,
    name,
    concept: null,
    hook: null,
    adventureType: { id: 'adv-1', name: 'Haunting', description: '' },
    monsterCount: 0,
    locationCount: 0,
    bystanderCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const mysteries: MysteryListItemResponse[] = [buildMystery('mystery-1', 'The Fog'), buildMystery('mystery-2', 'Dead Air')];

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

function submitWith(mysteryIds: string[]): LocationFormSubmit {
  return { location: validPayload, mysteryIds };
}

interface RecordedCalls {
  order: string[];
  create: { mysteryId: string; payload: UpsertLocationRequest }[];
  createStandalone: UpsertLocationRequest[];
  linkToMystery: { mysteryId: string; id: string }[];
}

describe('LocationCreateComponent', () => {
  let fixture: ComponentFixture<LocationCreateComponent>;
  let component: LocationCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];

  beforeEach(async () => {
    calls = { order: [], create: [], createStandalone: [], linkToMystery: [] };
    notifications = [];
    navigations = [];

    await TestBed.configureTestingModule({
      imports: [LocationCreateComponent],
      providers: [
        /**
         * **F-L9.** `CustomMoveService` is `providedIn: 'root'`, so without this the real one
         * resolves and any stray call becomes a real HTTP request — refused today only because
         * nothing is listening on :5225, and a write against dev the moment something is. This
         * spec drives no custom-move traffic, so the stub says so by throwing.
         */
        {
          provide: CustomMoveService,
          useValue: (() => {
            // Only the service's own four methods. A catch-all `Proxy` refuses `ngOnDestroy()` too,
            // which Angular calls on every provider instance at teardown — 386 tests, one stub.
            const refuse = (method: string) => () => {
              throw new Error(`Unexpected CustomMoveService.${method}() — this spec expects no custom-move traffic.`);
            };
            return { list: refuse('list'), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
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
            linkToMystery: (mysteryId: string, id: string) => {
              calls.order.push('linkToMystery');
              calls.linkToMystery.push({ mysteryId, id });
              return of(undefined as void);
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

  it('owns no bespoke mystery picker of its own — the form carries it now', () => {
    expect((component as unknown as Record<string, unknown>)['mysteryControl']).toBeUndefined();

    const selectsOutsideTheForm = Array.from(
      fixture.nativeElement.querySelectorAll('app-custom-select')
    ).filter((element) => !(element as HTMLElement).closest('app-location-form'));

    expect(selectsOutsideTheForm).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Attach to Mystery');
  });

  it('hands its loaded mysteries to the shared form as picker options', () => {
    expect(sharedForm().mysteries).toEqual(mysteries);
  });

  it('uses createStandalone with no membership calls and the top-level detail route when no mystery is picked', () => {
    component.onCreate(submitWith([]));

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.linkToMystery).toEqual([]);
    expect(navigations).toEqual([['/locations', 'new-location-1']]);
    expect(notifications).toEqual([{ kind: 'success', message: 'Location created.' }]);
  });

  it('createStandalones then links, and lands on the scoped route, when exactly one mystery is picked', () => {
    component.onCreate(submitWith(['mystery-1']));

    expect(calls.order).toEqual(['createStandalone', 'linkToMystery']);
    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.linkToMystery).toEqual([{ mysteryId: 'mystery-1', id: 'new-location-1' }]);
    expect(navigations).toEqual([['/mysteries', 'mystery-1', 'locations', 'new-location-1']]);
  });

  it('issues one membership PUT per mystery and falls back to the flat route when two are picked', () => {
    component.onCreate(submitWith(['mystery-1', 'mystery-2']));

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.linkToMystery).toEqual([
      { mysteryId: 'mystery-1', id: 'new-location-1' },
      { mysteryId: 'mystery-2', id: 'new-location-1' },
    ]);
    expect(navigations).toEqual([['/locations', 'new-location-1']]);
  });

  it('never uses the mystery-scoped create endpoint, whatever is picked', () => {
    component.onCreate(submitWith([]));
    component.onCreate(submitWith(['mystery-1']));
    component.onCreate(submitWith(['mystery-1', 'mystery-2']));

    expect(calls.create).toEqual([]);
    expect(calls.order.filter((call) => call === 'createStandalone')).toHaveLength(3);
  });

  it('never reaches onCreate when the shared form is submitted with a blank name', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: '',
      description: '',
      locationTypeId: 'location-type-1',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('never reaches onCreate when the shared form is submitted with a blank location type', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: 'One Stop Grocery',
      description: '',
      locationTypeId: '',
      mysteryIds: [],
    });

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
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.createStandalone).toEqual([validPayload]);
  });

  it('carries the form picker selection through to the membership PUTs', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: 'One Stop Grocery',
      description: '',
      locationTypeId: 'location-type-1',
      mysteryIds: ['mystery-2'],
    });

    const form = fixture.nativeElement.querySelector('app-location-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.linkToMystery).toEqual([{ mysteryId: 'mystery-2', id: 'new-location-1' }]);
  });

  it('keeps the user on the page with an inline error and a preserved picker selection when the create call fails', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    const instance = sharedForm();
    instance.locationForm.controls.mysteryIds.setValue(['mystery-1']);

    component.onCreate(submitWith(['mystery-1']));

    expect(navigations).toEqual([]);
    expect(calls.linkToMystery).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create location.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create location.' }]);
    expect(instance.locationForm.controls.mysteryIds.value).toEqual(['mystery-1']);
  });

  // --- partial membership failure (UX §9.5.1) -----------------------------------------
  //
  // The shipped convention from `monster-create.ts:286-292`: the entity now exists, so a failure
  // past that point is a success with a caveat, not an error. It navigates, toasts, and leaves
  // `errorMessage` null.

  it('navigates anyway when a membership PUT fails, so a second Create cannot duplicate the location', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/locations', 'new-location-1']]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('hedges the caveat copy and does not also claim plain success', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1', 'mystery-2']));

    // **Converged on the shipped monster/minion string in Phase 5c of domain-custom-moves**
    // (§13.6.1 Ruling 1, decision 13), and a correctness fix rather than a wording preference:
    // the old "some of its mysteries" became false by omission once a custom-move POST could fail
    // under the same combined flag, which would have sent a user whose *move* failed off to check
    // their mysteries. The wording itself is unchanged from the string monster and minion already
    // shipped — "details" is a category word, so it does not go stale with the next type.
    expect(notifications).toEqual([
      {
        kind: 'error',
        message: 'Location created, but some details may not have saved. Review them on the location page.',
      },
    ]);
  });

  it('falls back to the flat route on a partial failure even when exactly one mystery was picked', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    // The scoped route would assert a membership the client cannot know holds.
    expect(navigations).toEqual([['/locations', 'new-location-1']]);
  });

  it('still reports a total failure as an error when createStandalone itself fails', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    expect(navigations).toEqual([]);
    expect(component.errorMessage()).toBe('Unable to create location.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create location.' }]);
  });
});
