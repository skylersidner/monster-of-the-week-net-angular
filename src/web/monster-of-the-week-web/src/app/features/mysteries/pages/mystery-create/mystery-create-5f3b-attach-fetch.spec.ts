import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { CustomMoveOwnerType, CustomMoveResponse } from '../../../../core/models';
import { CustomMoveService, customMovesPath } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **5f-3b — the attach fetch, and the three states it brings with it.**
 *
 * This file is also where **`CustomMoveService.list()` finally gets validated**. It shipped in
 * Phase 4 deliberately uncovered, under Skyler's L-D3 ruling — *"this is not expected to function
 * fully until 5f-3… we just need a note to be sure to validate the functionality in 5f-3 and
 * ensure tests have the correct coverage"* — and §30.5 turned that note into a gate with three
 * items. All three are below:
 *
 * 1. the real caller exercises it, and the fixture is **non-empty** (`5f3b-F1`), because an
 *    `of([])` answer makes the baseline-versus-drafts distinction unobservable;
 * 2. a failed `list()` **admits nothing** to the roster (`5f3b-E1`);
 * 3. the owner type is checked through the real path builder, not against a transcribed string.
 *
 * **The fetch is held open with a `Subject` wherever the in-flight window matters.** An `of()` stub
 * resolves inside the `subscribe` call, so the window never exists and every assertion about it
 * passes for the wrong reason — which is the shape the `Next`-during-attach term is most likely to
 * fail in.
 */
describe('5f-3b — the attach fetch', () => {
  let store: MysteryCreateStore;
  let listCalls: { ownerType: CustomMoveOwnerType; ownerId: string }[];
  /** Set to hold the next `list()` open; resolve or fail it by hand. */
  let pending: Subject<CustomMoveResponse[]> | null;
  let failNext: boolean;

  const SEEDED = [
    { id: 'srv-1', name: 'The Mill Remembers', description: 'Roll +Weird to hear it.' },
    { id: 'srv-2', name: 'Mind the Floorboards', description: null },
  ];

  const CATALOGUE_LOCATION = {
    id: 'loc-a',
    mysteryIds: ['mystery-9'],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const CATALOGUE_BYSTANDER = {
    id: 'bys-a',
    mysteryIds: [],
    name: 'Sheriff Dalton',
    description: null,
    bystanderTypeId: 'bystander-type-1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    listCalls = [];
    pending = null;
    failNext = false;

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        {
          provide: CustomMoveService,
          useValue: {
            list: vi.fn((ownerType: CustomMoveOwnerType, ownerId: string) => {
              listCalls.push({ ownerType, ownerId });
              if (failNext) { return throwError(() => new Error('boom')); }
              if (pending) { return pending; }
              return of(SEEDED);
            }),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: MysteryService,
          useValue: {
            create: vi.fn(() => of({ id: 'mystery-1' })),
            update: vi.fn(() => of({ id: 'mystery-1' })),
            upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
            getMysteries: vi.fn(() => of([{ id: 'mystery-1', name: 'The Hollow Choir' }])),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: { getAll: vi.fn(() => of([CATALOGUE_LOCATION])) } },
        { provide: BystanderService, useValue: { getAll: vi.fn(() => of([CATALOGUE_BYSTANDER])) } },
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
      ],
    });

    store = TestBed.inject(MysteryCreateStore);
    store.init();
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(2);
    store.currentStep.set(0);
  });

  // --- gate item 1: the real caller, with a non-empty answer -------------------------------

  it('5f3b-F1: the attach fetch puts the server’s real moves on the draft', () => {
    store.attachLocation('loc-a');

    const draft = store.locations()[0];
    expect(draft.customMoves.map((move) => move.name)).toEqual(['The Mill Remembers', 'Mind the Floorboards']);
    // `null` arrives as `''`, because the panel binds a non-nullable control.
    expect(draft.customMoves.map((move) => move.description)).toEqual(['Roll +Weird to hear it.', '']);
    // **Drafts and baseline from the same array, in the same step** (H2) — the ids match, and every
    // row has its own key, which is what the panel's `track` needs.
    expect(draft.customMoves.map((move) => move.id)).toEqual(['srv-1', 'srv-2']);
    expect(draft.existingCustomMoves).toEqual(SEEDED);
    expect(new Set(draft.customMoves.map((move) => move.localKey)).size).toBe(2);
    // And the rest of the draft still comes from the catalogue list item, untouched by the fetch.
    expect(draft.name).toBe('Ferris Mill');
    expect(draft.mysteryIds).toEqual(['mystery-9']);
  });

  it('5f3b-F2: it is asked for the right owner, derived through the real path builder', () => {
    store.attachLocation('loc-a');
    store.currentPhase.set(3);
    store.attachBystander('bys-a');

    expect(listCalls.map((call) => call.ownerId)).toEqual(['loc-a', 'bys-a']);
    // Not compared against `'locations'`: a transcribed segment here against a transcribed segment
    // in `OWNER_SEGMENT` could not disagree. The builder is the single source either way.
    expect(customMovesPath(listCalls[0].ownerType, 'x')).toBe(customMovesPath('Location', 'x'));
    expect(customMovesPath(listCalls[1].ownerType, 'x')).toBe(customMovesPath('Bystander', 'x'));
    expect(listCalls[0].ownerType).not.toBe(listCalls[1].ownerType);
  });

  it('5f3b-F3: `list()` is what is called, not `getById()` — the staleness stays characterised', () => {
    const locationService = TestBed.inject(LocationService) as unknown as Record<string, unknown>;

    store.attachLocation('loc-a');

    // §27.2's reason, asserted: the list item already carries every other field, so re-reading the
    // row would quietly repair the page-load staleness `phase4-ledger`'s S2 exists to characterise.
    expect(listCalls).toHaveLength(1);
    expect(locationService['getById']).toBeUndefined();
  });

  // --- the in-flight window, held open so it actually exists ------------------------------

  it('5f3b-B1: while the fetch is open the strip is busy and the roster has not moved', () => {
    pending = new Subject<CustomMoveResponse[]>();

    store.attachLocation('loc-a');

    expect(store.attachingLocationName()).toBe('Ferris Mill');
    expect(store.locationAttachInFlight()).toBe(true);
    expect(store.locationAttachError()).toBeNull();
    // Nothing on the roster yet — a half-attached row with an unknown baseline is the H2 shape.
    expect(store.locations()).toEqual([]);

    pending.next(SEEDED);
    pending.complete();

    expect(store.attachingLocationName()).toBeNull();
    expect(store.locationAttachInFlight()).toBe(false);
    expect(store.locations()).toHaveLength(1);
  });

  it('5f3b-B2: `anyAttachInFlight` is the single term Next reads, and it answers for all three', () => {
    expect(store.anyAttachInFlight()).toBe(false);

    pending = new Subject<CustomMoveResponse[]>();
    store.attachLocation('loc-a');
    expect(store.anyAttachInFlight()).toBe(true);
    pending.next([]);
    pending.complete();
    expect(store.anyAttachInFlight()).toBe(false);

    pending = new Subject<CustomMoveResponse[]>();
    store.currentPhase.set(3);
    store.attachBystander('bys-a');
    expect(store.anyAttachInFlight()).toBe(true);
    pending.next([]);
    pending.complete();
    expect(store.anyAttachInFlight()).toBe(false);
  });

  it('5f3b-B3: a second pick while one is open is ignored rather than queued', () => {
    pending = new Subject<CustomMoveResponse[]>();

    store.attachLocation('loc-a');
    store.attachLocation('loc-a');

    // One request, and the name is still the first pick's. The monster path has the same guard, and
    // the reason is the same: two in-flight attaches would race to append to the same roster.
    expect(listCalls).toHaveLength(1);
    expect(store.attachingLocationName()).toBe('Ferris Mill');
  });

  // --- gate item 2: a failure admits nothing ------------------------------------------------

  it('5f3b-E1: a failed fetch leaves the roster alone and says so in the strip', () => {
    failNext = true;

    store.attachLocation('loc-a');

    // §30.5 gate item 2, and the `attachMonster` rule: **nothing is admitted**. A row whose move
    // baseline is unknown is worse than no row — the next submit would diff against a lie.
    expect(store.locations()).toEqual([]);
    expect(store.locationAttachError()).toContain('Ferris Mill');
    expect(store.locationAttachError()).toContain('Try again');
    expect(store.attachingLocationName()).toBeNull();
    expect(store.locationAttachInFlight()).toBe(false);
    // Local to the control (§17.2) — never the wizard's footer band, which belongs to submits.
    expect(store.submitError()).toBeNull();
  });

  it('5f3b-E2: and retry is simply picking it again, which clears the error', () => {
    failNext = true;
    store.attachLocation('loc-a');
    expect(store.locationAttachError()).not.toBeNull();

    failNext = false;
    store.attachLocation('loc-a');

    expect(store.locationAttachError()).toBeNull();
    expect(store.locations()).toHaveLength(1);
    expect(store.locations()[0].customMoves).toHaveLength(2);
    // The catalogue still offers it, because the failure admitted nothing to compare against.
    expect(listCalls).toHaveLength(2);
  });

  it('5f3b-E3: a bystander failure is its own error, not the locations one', () => {
    failNext = true;
    store.currentPhase.set(3);

    store.attachBystander('bys-a');

    expect(store.bystanderAttachError()).toContain('Sheriff Dalton');
    expect(store.locationAttachError()).toBeNull();
    expect(store.bystanders()).toEqual([]);
  });

  // --- the composer still is not discarded ---------------------------------------------------

  it('5f3b-C1: a composer holding only a custom move still survives the attach', () => {
    store.locationCustomMoveForm.setValue({ name: 'Only A Move', description: '' });
    store.addLocationCustomMove();

    store.attachLocation('loc-a');

    // 5f-3a's `locationComposerDirty` clause, re-checked on the asynchronous path: the collapse now
    // happens inside a `subscribe`, which is a different moment from the one it was written in.
    expect(store.locationComposerOpen()).toBe(true);
    expect(store.locationCustomMoves()).toHaveLength(1);
  });
});
