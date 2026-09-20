import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { LocationService } from '../../../../core/location';
import { LocationDetailResponse, MysteryListItemResponse, UpsertLocationRequest } from '../../../../core/models';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { LocationFormComponent, LocationFormSubmit } from '../../shared/location-form/location-form';
import { LocationDetailComponent } from './location-detail';

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

const mysteries: MysteryListItemResponse[] = [
  buildMystery('m1', 'The Quiet'),
  buildMystery('m2', 'Dead Air'),
  buildMystery('m3', 'Cold Open'),
];

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

function submitWith(mysteryIds: string[], location?: UpsertLocationRequest): LocationFormSubmit {
  return {
    location: location ?? { name: 'Location', description: null, locationTypeId: 'lt1' },
    mysteryIds,
  };
}

describe('LocationDetailComponent', () => {
  let component: LocationDetailComponent;
  let fixture: ComponentFixture<LocationDetailComponent>;
  let putSubject: Subject<unknown>;
  let updateCalls: { locationId: string; payload: UpsertLocationRequest }[] = [];
  let linkCalls: { mysteryId: string; id: string }[] = [];
  let unlinkCalls: { mysteryId: string; id: string }[] = [];
  let successCalls = 0;
  let errorMessages: string[] = [];
  /**
   * What `getById` currently answers. Mutable so that a test can open the page against a server
   * that already holds a membership, which is the only way to reach the load path — every other
   * test here sets `component.location` directly and never exercises it.
   */
  let serverLocation: LocationDetailResponse = loadedLocation;
  /** Counts `getById`, so the save-path refetch can be told apart from the initial load. */
  let getByIdCalls = 0;

  beforeEach(async () => {
    putSubject = new Subject();
    serverLocation = loadedLocation;
    getByIdCalls = 0;
    updateCalls = [];
    linkCalls = [];
    unlinkCalls = [];
    successCalls = 0;
    errorMessages = [];

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
            getById: () => {
              getByIdCalls += 1;
              return of(serverLocation);
            },
            update: (locationId: string, payload: UpsertLocationRequest) => {
              updateCalls.push({ locationId, payload });
              return putSubject;
            },
            linkToMystery: (mysteryId: string, id: string) => {
              linkCalls.push({ mysteryId, id });
              return of(undefined as void);
            },
            unlinkFromMystery: (mysteryId: string, id: string) => {
              unlinkCalls.push({ mysteryId, id });
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
            getLocationTypes: () => of([{ id: 'lt1', name: 'Hub', motivation: 'Test' }]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: () => {
              successCalls += 1;
            },
            error: (message: string) => errorMessages.push(message),
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
      mysteryIds: [],
    });
  });

  it('loads the mystery list and hands it to the form as picker options', () => {
    expect(component.mysteries()).toEqual(mysteries);
    expect(sharedForm().mysteries).toEqual(mysteries);
  });

  it('saves through the shared form output when the form is submitted with valid values', () => {
    const instance = sharedForm();
    instance.locationForm.setValue({
      name: 'Renamed',
      description: '',
      locationTypeId: 'lt1',
      mysteryIds: [],
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

    component.save(submitWith([]));

    expect(updateCalls).toEqual([]);
  });

  it('tracks save loading state and sends success toast', () => {
    component.save(submitWith([]));
    expect(component.isSaving()).toBe(true);

    putSubject.next({ ...loadedLocation, mysteryIds: ['m1'] });
    putSubject.complete();

    expect(component.isSaving()).toBe(false);
    expect(successCalls).toBe(1);
  });

  it('leaves the read-only custom moves list rendering', () => {
    expect(fixture.nativeElement.textContent).toContain('Custom Moves');
    expect(fixture.nativeElement.textContent).toContain('No custom moves.');
  });

  // --- membership (mystery-entity-linking.md §4.3) -------------------------------------

  it('issues no membership calls at all when the selection is unchanged', () => {
    component.location.set({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    expect(updateCalls).toHaveLength(1);
    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([]);
  });

  it('PUTs the added memberships and DELETEs the removed ones in a single save', () => {
    component.location.set({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith(['m2', 'm3']));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    expect(linkCalls).toEqual([{ mysteryId: 'm3', id: 'l1' }]);
    expect(unlinkCalls).toEqual([{ mysteryId: 'm1', id: 'l1' }]);
  });

  it('unlinks every mystery when the picker is emptied', () => {
    component.location.set({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    component.save(submitWith([]));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });

    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([
      { mysteryId: 'm1', id: 'l1' },
      { mysteryId: 'm2', id: 'l1' },
    ]);
  });

  it('does not carry mysteryIds in the entity PUT body', () => {
    component.location.set({ ...loadedLocation, mysteryIds: ['m1'] });

    component.save(submitWith(['m1', 'm2']));

    expect(updateCalls[0].payload).toEqual({ name: 'Location', description: null, locationTypeId: 'lt1' });
    expect(Object.keys(updateCalls[0].payload)).not.toContain('mysteryIds');
  });

  it('refetches after a successful save and rehydrates the form from server truth, not from the payload', () => {
    component.location.set({ ...loadedLocation, mysteryIds: ['m1'] });
    const loadCount = getByIdCalls;
    // What the server holds once the save has landed.
    serverLocation = { ...loadedLocation, mysteryIds: ['m2'] };

    component.save(submitWith(['m2']));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1'] });
    fixture.detectChanges();

    expect(getByIdCalls).toBe(loadCount + 1);
    expect(component.location()).toBe(serverLocation);
    expect(sharedForm().locationForm.controls.mysteryIds.value).toEqual(['m2']);
  });

  it('shows what the server actually holds, not what was asked for, when the two differ', () => {
    component.location.set({ ...loadedLocation, mysteryIds: [] });
    // The user asked for m1 and m2; only m1 landed.
    serverLocation = { ...loadedLocation, mysteryIds: ['m1'] };

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedLocation, mysteryIds: [] });
    fixture.detectChanges();

    expect(component.location()?.mysteryIds).toEqual(['m1']);
    expect(sharedForm().locationForm.controls.mysteryIds.value).toEqual(['m1']);
  });

  // "Membership survives a reload", which nothing above reaches: every membership test here
  // starts from component.location.set(...), so they all assume the load already happened. This
  // is the other half of the round trip — the server holds what an earlier save wrote, the page
  // is opened fresh, and the picker must come back ticked from GET /api/locations/{id} rather
  // than from anything left in memory.
  it('hydrates the picker from the loaded location, so saved membership survives a reload', () => {
    serverLocation = { ...loadedLocation, mysteryIds: ['m1', 'm3'] };

    const reloaded = TestBed.createComponent(LocationDetailComponent);
    reloaded.detectChanges();

    const reloadedForm = reloaded.debugElement.query(By.directive(LocationFormComponent))
      .componentInstance as LocationFormComponent;
    expect(reloadedForm.locationForm.controls.mysteryIds.value).toEqual(['m1', 'm3']);

    // And the reloaded page's idea of "already linked" is the loaded set, not an empty one: an
    // untouched save re-issues nothing. Without this, a reload-then-save would re-PUT every
    // existing membership, which is harmless only because the verb happens to be idempotent.
    reloaded.componentInstance.save(submitWith(['m1', 'm3']));
    putSubject.next(serverLocation);

    expect(linkCalls).toEqual([]);
    expect(unlinkCalls).toEqual([]);
  });

  // Toad's characterisation of the concurrent-attachment case, kept, with its second half
  // updated: the page no longer goes stale, because the save now ends in a refetch (UX §9.5.2).
  //
  // The first half is the load-bearing one and is unchanged. With the page diffing against the
  // mysteryIds it loaded, a membership attached elsewhere after this page opened is invisible to
  // it — and the direction matters, being the opposite of the pessimistic reading: removals are
  // drawn from the *loaded* set, so the concurrent attachment is never in `removed` and is not
  // deleted. If that expectation ever fails, removals have been widened beyond the loaded set
  // and this page has started destroying memberships it never knew about.
  //
  // The second half used to be "the page's picture of it goes stale", because the save merged
  // the desired set locally. The refetch replaces that merge with server truth, so the page now
  // picks the concurrent attachment up on the same save rather than needing a reload.
  it('does not unlink a membership attached elsewhere since page open, and now re-reads it', () => {
    // Page opened while the location was in m1 alone. Elsewhere, afterwards, it was also
    // attached to m3 — which this page's picker has no way of knowing.
    component.location.set({ ...loadedLocation, mysteryIds: ['m1'] });
    // Server truth once this save lands: m1 removed, m2 added, m3 still there from elsewhere.
    serverLocation = { ...loadedLocation, mysteryIds: ['m2', 'm3'] };

    // The user swaps m1 for m2 and saves.
    component.save(submitWith(['m2']));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1'] });
    fixture.detectChanges();

    expect(linkCalls).toEqual([{ mysteryId: 'm2', id: 'l1' }]);
    // m1 goes because the user deselected it. m3 is untouched: it was never in the loaded set.
    expect(unlinkCalls).toEqual([{ mysteryId: 'm1', id: 'l1' }]);
    // And the page shows m2 *and* m3 without a reload, rather than the desired set alone.
    expect(component.location()?.mysteryIds).toEqual(['m2', 'm3']);
    expect(sharedForm().locationForm.controls.mysteryIds.value).toEqual(['m2', 'm3']);
  });

  // --- partial membership failure (UX §9.5.2) -----------------------------------------

  it('hedges the caveat copy rather than asserting the whole fan-out failed', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.location.set({ ...loadedLocation, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.next({ ...loadedLocation, mysteryIds: [] });

    expect(component.isSaving()).toBe(false);
    expect(errorMessages).toEqual([
      'Location saved, but some of its mysteries may not have saved. Review them below and save again.',
    ]);
    expect(successCalls).toBe(0);
  });

  it('keeps the caveat to a toast so the form stays mounted and retryable', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.location.set({ ...loadedLocation, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.next({ ...loadedLocation, mysteryIds: [] });
    fixture.detectChanges();

    // `location-detail.html`'s `@else if (errorMessage())` branch precedes the content branch,
    // so a non-null errorMessage here would unmount the form and leave nothing to retry into.
    expect(component.errorMessage()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-location-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-mystery-select')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('refetches after a partial failure too, so the control answers "which ones failed?"', () => {
    const locationService = TestBed.inject(LocationService);
    vi.spyOn(locationService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.location.set({ ...loadedLocation, mysteryIds: [] });
    const loadCount = getByIdCalls;
    // m1 landed before the batch errored; m2 did not.
    serverLocation = { ...loadedLocation, mysteryIds: ['m1'] };

    component.save(submitWith(['m1', 'm2']));
    putSubject.next({ ...loadedLocation, mysteryIds: [] });
    fixture.detectChanges();

    expect(getByIdCalls).toBe(loadCount + 1);
    expect(sharedForm().locationForm.controls.mysteryIds.value).toEqual(['m1']);
  });

  // The regression the refetch exists for. `DELETE` on the membership URI is not idempotent in
  // status code — it 404s on repeat (architecture §4.1) — so a retry that recomputed `removed`
  // from a stale baseline would re-issue an already-applied unlink and fail forever.
  it('does not re-issue an already-applied unlink when the user saves again', () => {
    const locationService = TestBed.inject(LocationService);
    const unlinkSpy = vi
      .spyOn(locationService, 'unlinkFromMystery')
      .mockImplementationOnce((mysteryId: string, id: string) => {
        unlinkCalls.push({ mysteryId, id });
        return of(undefined as void);
      })
      .mockImplementationOnce(() => throwError(() => new Error('nope')));

    // Loaded with m1 and m2; the user clears both. The m1 unlink lands, the m2 unlink fails.
    component.location.set({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });
    serverLocation = { ...loadedLocation, mysteryIds: ['m2'] };

    component.save(submitWith([]));
    putSubject.next({ ...loadedLocation, mysteryIds: ['m1', 'm2'] });
    fixture.detectChanges();

    expect(errorMessages).toHaveLength(1);
    // The refetch has reset the baseline to m2 alone, so the control no longer offers m1.
    expect(sharedForm().locationForm.controls.mysteryIds.value).toEqual(['m2']);

    // The user deselects m2 again and saves. Only m2 is unlinked — m1 is not retried.
    unlinkSpy.mockImplementation((mysteryId: string, id: string) => {
      unlinkCalls.push({ mysteryId, id });
      return of(undefined as void);
    });
    putSubject = new Subject();
    serverLocation = { ...loadedLocation, mysteryIds: [] };

    component.save(submitWith([]));
    putSubject.next(serverLocation);
    fixture.detectChanges();

    expect(unlinkCalls).toEqual([
      { mysteryId: 'm1', id: 'l1' },
      { mysteryId: 'm2', id: 'l1' },
    ]);
    expect(errorMessages).toHaveLength(1);
    expect(successCalls).toBe(1);
  });

  it('reports the plain save failure when the entity PUT itself fails', () => {
    component.location.set({ ...loadedLocation, mysteryIds: [] });

    component.save(submitWith(['m1']));
    putSubject.error(new Error('nope'));

    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to save location.');
    expect(linkCalls).toEqual([]);
  });
});
