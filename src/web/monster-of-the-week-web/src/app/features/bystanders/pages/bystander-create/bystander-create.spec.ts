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
import { BystanderFormComponent } from '../../shared/bystander-form/bystander-form';
import { BystanderCreateComponent } from './bystander-create';

describe('bystanders route ordering', () => {
  it('registers the literal "new" route before the ":bystanderId" catch-all', () => {
    const paths = BYSTANDERS_ROUTES.map((route) => route.path);

    expect(paths).toContain('new');
    expect(paths.indexOf('new')).toBeLessThan(paths.indexOf(':bystanderId'));
  });
});

const bystanderTypes: TypeRefResponse[] = [{ id: 'bystander-type-1', name: 'Shopkeeper', motivation: 'to profit' }];

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

interface RecordedCalls {
  order: string[];
  create: { mysteryId: string; payload: UpsertBystanderRequest }[];
  createStandalone: UpsertBystanderRequest[];
}

describe('BystanderCreateComponent', () => {
  let fixture: ComponentFixture<BystanderCreateComponent>;
  let component: BystanderCreateComponent;
  let calls: RecordedCalls;
  let notifications: { kind: string; message: string }[];
  let navigations: unknown[][];

  beforeEach(async () => {
    calls = { order: [], create: [], createStandalone: [] };
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

  it('uses createStandalone and the top-level detail route when the mystery picker is blank', () => {
    component.onCreate(validPayload);

    expect(calls.create).toEqual([]);
    expect(calls.createStandalone).toEqual([validPayload]);
    expect(navigations).toEqual([['/bystanders', 'new-bystander-1']]);
    expect(notifications).toEqual([{ kind: 'success', message: 'Bystander created.' }]);
  });

  it('uses the mystery-scoped create and detail route when a mystery is selected', () => {
    component.mysteryControl.setValue('mystery-1');

    component.onCreate(validPayload);

    expect(calls.createStandalone).toEqual([]);
    expect(calls.create).toEqual([{ mysteryId: 'mystery-1', payload: validPayload }]);
    expect(navigations).toEqual([['/mysteries', 'mystery-1', 'bystanders', 'new-bystander-1']]);
  });

  it('never reaches onCreate when the shared form is submitted with a blank name', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({ name: '', description: '', bystanderTypeId: 'bystander-type-1' });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.order).toEqual([]);
    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
  });

  it('never reaches onCreate when the shared form is submitted with a blank bystander type', () => {
    const instance = sharedForm();
    instance.bystanderForm.setValue({ name: 'Old Man Jenkins', description: '', bystanderTypeId: '' });

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
    });

    const form = fixture.nativeElement.querySelector('app-bystander-form form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(calls.createStandalone).toEqual([validPayload]);
  });

  it('keeps the user on the page with an inline error and preserved mystery selection when the create call fails', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'create').mockReturnValue(throwError(() => new Error('nope')));

    component.mysteryControl.setValue('mystery-1');

    component.onCreate(validPayload);

    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create bystander.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create bystander.' }]);
    expect(component.mysteryControl.value).toBe('mystery-1');
  });

  it('keeps the user on the page with an inline error when the standalone create call fails', () => {
    const bystanderService = TestBed.inject(BystanderService);
    vi.spyOn(bystanderService, 'createStandalone').mockReturnValue(throwError(() => new Error('nope')));

    component.onCreate(validPayload);

    expect(navigations).toEqual([]);
    expect(component.isSaving()).toBe(false);
    expect(component.errorMessage()).toBe('Unable to create bystander.');
    expect(notifications).toEqual([{ kind: 'error', message: 'Unable to create bystander.' }]);
    expect(component.mysteryControl.value).toBe('');
  });
});
