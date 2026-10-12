import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { BystanderDetailResponse, MysteryListItemResponse, TypeRefResponse, UpsertBystanderRequest } from '../../../../core/models';
import { BystanderService } from '../../../../core/bystander';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { BYSTANDERS_ROUTES } from '../../bystanders.routes';
import { BystanderFormComponent, BystanderFormSubmit } from '../../shared/bystander-form/bystander-form';
import { BystanderCreateComponent } from './bystander-create';

describe('bystanders route ordering', () => {
  it('registers the literal "new" route before the ":bystanderId" catch-all', () => {
    const paths = BYSTANDERS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':bystanderId'));
  });
});

const bystanderTypes: TypeRefResponse[] = [{ id: 'bystander-type-1', name: 'Shopkeeper', motivation: 'to profit' }];

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

const createdBystander: BystanderDetailResponse = {
  id: 'new-bystander-1',
  mysteryIds: [],
  name: 'Old Man Jenkins',
  description: null,
  bystanderTypeId: 'bystander-type-1',
  bystanderTypeName: 'Shopkeeper',
  bystanderTypeMotivation: 'to profit',
  customMoves: [],
};

const validPayload: UpsertBystanderRequest = {
  name: 'Old Man Jenkins',
  description: null,
  bystanderTypeId: 'bystander-type-1',
};

function submitWith(mysteryIds: string[]): BystanderFormSubmit {
  return { bystander: validPayload, mysteryIds };
}

interface RecordedCalls {
  order: string[];
  create: { mysteryId: string; payload: UpsertBystanderRequest }[];
  createStandalone: UpsertBystanderRequest[];
  linkToMystery: { mysteryId: string; id: string }[];
}

describe('BystanderCreateComponent', () => {
  let fixture: ComponentFixture<BystanderCreateComponent>;
  let component: BystanderCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];

  beforeEach(async () => {
    calls = { order: [], create: [], createStandalone: [], linkToMystery: [] };
    notifications = [];
    navigations = [];

    await TestBed.configureTestingModule({
      imports: [BystanderCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: BystanderService,
          useValue: {
            create: (mysteryId: string, payload: UpsertBystanderRequest) => {
              calls.order.push('create');
              calls.create.push({ mysteryId, payload });
              return of(createdBystander);
            },
            createStandalone: (payload: UpsertBystanderRequest) => {
              calls.order.push('createStandalone');
              calls.createStandalone.push(payload);
              return of(createdBystander);
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
            getBystanderTypes: () => of(bystanderTypes),
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

    fixture = TestBed.createComponent(BystanderCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sharedForm(): BystanderFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(BystanderFormComponent));
    expect(debugElement).toBeTruthy();
    return debugElement.componentInstance as BystanderFormComponent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads bystander types and mysteries on init', () => {
    expect(component.bystanderTypes()).toEqual(bystanderTypes);
    expect(component.mysteries()).toEqual(mysteries);
  });

  it('renders the shared bystander form in create mode with a Create Bystander label', () => {
    const instance = sharedForm();
    expect(instance.bystander).toBeNull();
    expect(instance.submitLabel).toBe('Create Bystander');
  });

  it('owns no bespoke mystery picker of its own — the form carries it now', () => {
    expect((component as unknown as Record<string, unknown>)['mysteryControl']).toBeUndefined();

    const selectsOutsideTheForm = Array.from(
      fixture.nativeElement.querySelectorAll('app-custom-select')
    ).filter((element) => !(element as HTMLElement).closest('app-bystander-form'));

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
    expect(navigations).toEqual([['/bystanders', 'new-bystander-1']]);
    expect(notifications).toEqual([{ kind: 'success', message: 'Bystander created.' }]);
  });

  it('createStandalones then links, and lands on the scoped route, when exactly one mystery is picked', () => {
    component.onCreate(submitWith(['mystery-1']));

    expect(calls.order).toEqual(['createStandalone', 'linkToMystery']);
    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.linkToMystery).toEqual([{ mysteryId: 'mystery-1', id: 'new-bystander-1' }]);
    expect(navigations).toEqual([['/mysteries', 'mystery-1', 'bystanders', 'new-bystander-1']]);
  });

  it('issues one membership PUT per mystery and falls back to the flat route when two are picked', () => {
    component.onCreate(submitWith(['mystery-1', 'mystery-2']));

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(calls.linkToMystery).toEqual([
      { mysteryId: 'mystery-1', id: 'new-bystander-1' },
      { mysteryId: 'mystery-2', id: 'new-bystander-1' },
    ]);
    expect(navigations).toEqual([['/bystanders', 'new-bystander-1']]);
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
    instance.bystanderForm.setValue({
      name: '',
      description: '',
      bystanderTypeId: 'bystander-type-1',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('never reaches onCreate when the shared form is submitted with a blank bystander type', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({
      name: 'Old Man Jenkins',
      description: '',
      bystanderTypeId: '',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('creates through the shared form output when the core fields are valid', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({
      name: 'Old Man Jenkins',
      description: '',
      bystanderTypeId: 'bystander-type-1',
      mysteryIds: [],
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.createStandalone).toEqual([validPayload]);
  });

  it('carries the form picker selection through to the membership PUTs', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({
      name: 'Old Man Jenkins',
      description: '',
      bystanderTypeId: 'bystander-type-1',
      mysteryIds: ['mystery-2'],
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.linkToMystery).toEqual([{ mysteryId: 'mystery-2', id: 'new-bystander-1' }]);
  });

  it('keeps the user on the page with an inline error and a preserved picker selection when the create call fails', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    const instance = sharedForm();
    instance.bystanderForm.controls.mysteryIds.setValue(['mystery-1']);

    component.onCreate(submitWith(['mystery-1']));

    expect(navigations).toEqual([]);
    expect(calls.linkToMystery).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create bystander.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create bystander.' }]);
    expect(instance.bystanderForm.controls.mysteryIds.value).toEqual(['mystery-1']);
  });

  // --- partial membership failure (UX §9.5.1) -----------------------------------------
  //
  // The shipped convention from `monster-create.ts:286-292`: the entity now exists, so a failure
  // past that point is a success with a caveat, not an error. It navigates, toasts, and leaves
  // `errorMessage` null.

  it('navigates anyway when a membership PUT fails, so a second Create cannot duplicate the bystander', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/bystanders', 'new-bystander-1']]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('hedges the caveat copy and does not also claim plain success', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1', 'mystery-2']));

    expect(notifications).toEqual([
      {
        kind: 'error',
        message:
          // **Converged on the shipped monster/minion string in Phase 5d** (§13.6.1 Ruling 1,
          // decision 13), completing the four-page convergence 5c began. A correctness fix rather
          // than a wording preference: "some of its mysteries" became false by omission once a
          // custom-move POST could fail under the same combined flag.
          'Bystander created, but some details may not have saved. Review them on the bystander page.',
      },
    ]);
  });

  it('falls back to the flat route on a partial failure even when exactly one mystery was picked', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'linkToMystery').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    // The scoped route would assert a membership the client cannot know holds.
    expect(navigations).toEqual([['/bystanders', 'new-bystander-1']]);
  });

  it('still reports a total failure as an error when createStandalone itself fails', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(submitWith(['mystery-1']));

    expect(navigations).toEqual([]);
    expect(component.errorMessage()).toBe('Unable to create bystander.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create bystander.' }]);
  });
});
