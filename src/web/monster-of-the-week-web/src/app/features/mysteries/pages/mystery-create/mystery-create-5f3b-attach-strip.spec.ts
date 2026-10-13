import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../../../core/api';
import { BystanderService } from '../../../../core/bystander';
import { CustomMoveResponse } from '../../../../core/models';
import { CustomMoveService } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateComponent } from './mystery-create';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **5f-3b's rendered surface: the two attach strips, and the `Next` button.**
 *
 * `5f3b-N1` is the one that matters, and it is a **correctness** assertion rather than a polish
 * one. `next()` reads the roster *synchronously*: press it while an attach is still in flight and
 * the phase submits a roster the pick has not joined yet, so a deliberate choice evaporates with
 * no error and nothing on the wire to notice.
 *
 * **Every assertion about the in-flight window holds the fetch open with a `Subject`.** An `of()`
 * stub resolves inside the `subscribe` call, so the window never exists — and a test written
 * against one passes whether the `[disabled]` term is there or not. That is precisely the way this
 * term would fail silently, so it is the way it is tested.
 */
describe('5f-3b — the attach strips and the Next button', () => {
  let fixture: ComponentFixture<MysteryCreateComponent>;
  let store: MysteryCreateStore;
  let element: HTMLElement;
  let pending: Subject<CustomMoveResponse[]> | null;
  let failNext: boolean;

  const CATALOGUE_LOCATION = {
    id: 'loc-a',
    mysteryIds: [],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  };

  async function create(): Promise<void> {
    pending = null;
    failNext = false;

    await TestBed.configureTestingModule({
      imports: [MysteryCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: CustomMoveService,
          useValue: {
            list: vi.fn(() => (failNext ? throwError(() => new Error('boom')) : (pending ?? of([])))),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([]),
            getMonsterTypes: () => of([]),
            getMinionTypes: () => of([]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([]),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            create: () => of({ id: 'mystery-1' }),
            upsertCountdown: () => of({}),
            getMysteries: () => of([{ id: 'mystery-1', name: 'The Hollow Choir' }]),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: { getAll: () => of([CATALOGUE_LOCATION]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
        { provide: ApiService, useValue: { get: () => of([]), post: () => of({}), put: () => of({}), delete: () => of(undefined) } },
        { provide: NotificationService, useValue: { success: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MysteryCreateComponent);
    store = fixture.debugElement.injector.get(MysteryCreateStore);
    element = fixture.nativeElement as HTMLElement;
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(2);
    store.currentStep.set(0);
    await settle();
  }

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const nextButton = (): HTMLButtonElement =>
    Array.from(element.querySelectorAll('button')).find((b) => /Next|Finish|Saving/.test(b.textContent ?? '')) as HTMLButtonElement;
  const busy = (): HTMLElement | null => element.querySelector('[data-location-attach-busy]');
  const attachError = (): HTMLElement | null => element.querySelector('[data-location-attach-error]');
  const picker = (): HTMLElement | null => element.querySelector('#attach-location');

  it('5f3b-N1: Next is disabled while an attach is in flight, and enabled either side of it', async () => {
    await create();

    // Before: enabled. Without this arm the assertion below could pass on a permanently disabled
    // button, which is the other way this test could lie.
    expect(nextButton().disabled).toBe(false);

    pending = new Subject<CustomMoveResponse[]>();
    store.attachLocation('loc-a');
    await settle();

    // **The correctness term.** `next()` reads the roster synchronously, so a press here would
    // submit a phase the pick has not joined — silently, because the pick is still arriving.
    expect(store.locationAttachInFlight()).toBe(true);
    expect(nextButton().disabled).toBe(true);

    pending.next([]);
    pending.complete();
    await settle();

    expect(nextButton().disabled).toBe(false);
  });

  it('5f3b-N2: the window is real — the roster is still empty while the button is disabled', async () => {
    await create();
    pending = new Subject<CustomMoveResponse[]>();

    store.attachLocation('loc-a');
    await settle();

    // Without the held-open subject this is the moment that does not exist, and every assertion
    // about it passes vacuously. Asserted so the fixture's own shape is pinned.
    expect(store.locations()).toEqual([]);
    expect(nextButton().disabled).toBe(true);
  });

  it('5f3b-S1: the strip swaps the picker for a named busy label, then swaps back', async () => {
    await create();
    expect(picker()).not.toBeNull();
    expect(busy()).toBeNull();

    pending = new Subject<CustomMoveResponse[]>();
    store.attachLocation('loc-a');
    await settle();

    expect(busy()).not.toBeNull();
    expect(busy()!.textContent).toContain('Ferris Mill');
    expect(busy()!.querySelector('app-icon')).not.toBeNull();
    // The picker is gone, not merely covered: a second pick during a fetch is the thing this
    // prevents at the surface, with the store's own in-flight guard behind it.
    expect(picker()).toBeNull();

    pending.next([]);
    pending.complete();
    await settle();

    expect(busy()).toBeNull();
    expect(picker()).not.toBeNull();
  });

  it('5f3b-S2: a failed attach shows a local error in the strip, not the wizard’s footer band', async () => {
    await create();
    failNext = true;

    store.attachLocation('loc-a');
    await settle();

    expect(attachError()).not.toBeNull();
    expect(attachError()!.textContent).toContain('Ferris Mill');
    expect(store.submitError()).toBeNull();
    // The strip is usable again immediately — retry is picking it again.
    expect(picker()).not.toBeNull();
    expect(nextButton().disabled).toBe(false);
  });
});
