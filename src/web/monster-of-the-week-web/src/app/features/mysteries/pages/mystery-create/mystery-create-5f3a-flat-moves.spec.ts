import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { DomainOwnerType, UpsertCustomMoveRequest } from '../../../../core/models';
import { CustomMoveService, customMovesPath } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **5f-3a — custom moves on the locations and bystanders composers.**
 *
 * The headline here is `5f3a-G1`, and it is the gate §35.1 makes a condition of splitting 5f-3 at
 * all. Yoshi *traced* that an attached location arrives with empty drafts and an empty baseline, so
 * `applySubResourceDiff` produces no deletes and no saves and the location's real moves survive
 * untouched. That trace is why the split is safe; this file is what keeps it true, because a trace
 * is a claim about today's code and an assertion is a claim about tomorrow's.
 *
 * The fake answers with sentinel ids and echoes name and description — non-empty is the floor,
 * *distinguishable from what was sent* is the bar (5f-0, applied since).
 */
describe('5f-3a — custom moves on the flat composers', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let ownerTypesSeen: DomainOwnerType[];
  let nextServerId: number;

  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());
  const moveCalls = (): string[] => sent.filter((call) => call.startsWith('move.'));

  /**
   * **The catalogue item is a *list* response and carries no `customMoves`** — which is the whole
   * origin of the interim state. The location really does have two moves on the server; the wizard
   * has no way to know, and must not act as though it does.
   */
  /**
   * **What the server already holds for the attached rows.** Until 5f-3b the wizard could not see
   * these and the panel said so; now `list()` fetches exactly them.
   */
  const SEEDED_LOCATION_MOVES = [
    { id: 'srv-loc-1', name: 'The Mill Remembers', description: 'Roll +Weird to hear it.' },
    { id: 'srv-loc-2', name: 'Mind the Floorboards', description: null },
  ];
  const SEEDED_BYSTANDER_MOVES = [{ id: 'srv-bys-1', name: 'Call for Backup', description: null }];

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

  const CATALOGUE_BYSTANDER = {
    id: 'bys-a',
    mysteryIds: [],
    name: 'Sheriff Dalton',
    description: 'Tired and stubborn.',
    bystanderTypeId: 'bystander-type-1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    sent = [];
    ownerTypesSeen = [];
    nextServerId = 0;

    const describeArgs = (args: unknown[]): string =>
      args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(',');

    const record = <T>(name: string, result: () => Observable<T>) =>
      vi.fn((...args: unknown[]) => defer(() => { sent.push(`${name}(${describeArgs(args)})`); return result(); }));

    const recordMove = <T>(name: string, result: (args: unknown[]) => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          ownerTypesSeen.push(args[0] as DomainOwnerType);
          sent.push(`${name}(${describeArgs(args.slice(1))})`);
          return result(args);
        }),
      );

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        {
          provide: CustomMoveService,
          useValue: {
            // **Non-empty, and it is 5f-3b's gate that makes it so** (§30.5 item 3). An `of([])`
            // fixture would make every assertion below about an attached row's moves vacuous —
            // the baseline-versus-drafts distinction would never render. These two rows are what
            // `list()` has been waiting for since Phase 4 shipped it uncovered.
            list: recordMove('move.list', (args) =>
              of(args[1] === 'loc-a' ? SEEDED_LOCATION_MOVES : args[1] === 'bys-a' ? SEEDED_BYSTANDER_MOVES : []),
            ),
            create: recordMove('move.create', (args) => {
              const request = args[2] as UpsertCustomMoveRequest;
              return of({ id: `srv-move-${++nextServerId}`, name: request.name, description: request.description });
            }),
            update: recordMove('move.update', (args) => {
              const request = args[3] as UpsertCustomMoveRequest;
              return of({ id: args[2] as string, name: request.name, description: request.description });
            }),
            delete: recordMove('move.delete', () => of(undefined)),
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
        {
          provide: LocationService,
          useValue: {
            getAll: vi.fn(() => of([CATALOGUE_LOCATION])),
            create: record('location.create', () => of({ id: 'loc-created' })),
            update: record('location.update', () => of({ id: 'loc-updated' })),
            linkToMystery: record('location.link', () => of(undefined)),
            unlinkFromMystery: record('location.unlink', () => of(undefined)),
            delete: record('location.delete', () => of(undefined)),
          },
        },
        {
          provide: BystanderService,
          useValue: {
            getAll: vi.fn(() => of([CATALOGUE_BYSTANDER])),
            create: record('bystander.create', () => of({ id: 'bys-created' })),
            update: record('bystander.update', () => of({ id: 'bys-updated' })),
            linkToMystery: record('bystander.link', () => of(undefined)),
            unlinkFromMystery: record('bystander.unlink', () => of(undefined)),
            delete: record('bystander.delete', () => of(undefined)),
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
      ],
    });

    store = TestBed.inject(MysteryCreateStore);
    store.init();
    store.mysteryId.set('mystery-1');
    store.isEditMode.set(true);
    store.currentPhase.set(2);
    store.currentStep.set(0);
    sent.length = 0;
  });

  const authorLocation = (name: string): void => {
    store.addLocationForm.setValue({ name, description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
  };

  const addLocationMove = (name: string, description = ''): void => {
    store.locationCustomMoveForm.setValue({ name, description });
    store.addLocationCustomMove();
  };

  const addBystanderMove = (name: string, description = ''): void => {
    store.bystanderCustomMoveForm.setValue({ name, description });
    store.addBystanderCustomMove();
  };

  // --- THE GATE ---------------------------------------------------------------------------

  it('5f3a-G1: attaching a location and pressing Next deletes none of its custom moves', () => {
    store.attachLocation('loc-a');

    // **5f-3b closed the interim state this test was written against.** It used to assert that the
    // draft arrived empty and unloaded; it now arrives with the server's two rows, from the fetch.
    // The gate's claim is unchanged and is the one that always mattered: *nothing is destroyed.*
    expect(store.locations()[0].customMoves.map((move) => move.id)).toEqual(['srv-loc-1', 'srv-loc-2']);
    expect(store.locations()[0].existingCustomMoves).toEqual(SEEDED_LOCATION_MOVES);
    expect(store.locations()[0].customMovesLoaded).toBe(true);

    store.next();

    // **The assertion §35.1 asks for, in place of the trace.** Drafts and baseline agree, so
    // decision 9's clean branch issues nothing — no delete, no create, no update. Asserted as "the
    // only move traffic is the attach's read", which is stronger than "no delete": it also catches
    // a write that happened to be a create.
    expect(moveCalls()).toEqual(['move.list(loc-a)']);
    expectLedger([
      'move.list(loc-a)',
      'location.update(loc-a,{"name":"Ferris Mill","description":"Rust and river damp.","locationTypeId":"location-type-1"})',
      'location.link(mystery-1,loc-a)',
    ]);
  });

  it('5f3a-G2: and the same for an attached bystander', () => {
    store.currentPhase.set(3);
    store.attachBystander('bys-a');

    expect(store.bystanders()[0].customMovesLoaded).toBe(true);
    expect(store.bystanders()[0].customMoves.map((move) => move.name)).toEqual(['Call for Backup']);

    store.next();

    expect(moveCalls()).toEqual(['move.list(bys-a)']);
  });

  it('5f3a-G3: adding one to an attached location creates it and still deletes nothing', () => {
    store.attachLocation('loc-a');
    store.editLocationDraft(store.locations()[0].localKey);
    addLocationMove('Mind the Floorboards');
    store.saveLocationDraft();

    store.next();

    // **No longer "a sixth rather than editing one of five"** — the fetch means the composer was
    // showing the real two, so this is a genuine third alongside them, and the other two are
    // carried forward untouched by decision 9's clean branch.
    expect(moveCalls()).toEqual([
      'move.list(loc-a)',
      'move.create(loc-a,{"name":"Mind the Floorboards","description":null})',
    ]);
    expect(store.locations()[0].customMoves.map((move) => move.name)).toEqual([
      'The Mill Remembers',
      'Mind the Floorboards',
      'Mind the Floorboards',
    ]);
  });

  // --- the composer's own state -------------------------------------------------------------

  it('5f3a-D1: a composer holding only a custom move counts as dirty', () => {
    expect(store.locationComposerDirty()).toBe(false);

    addLocationMove('Mind the Floorboards');

    expect(store.locationComposerDirty()).toBe(true);
    expect(store.addLocationForm.invalid).toBe(true);
  });

  it('5f3a-D2: so attaching does not silently discard it', () => {
    addLocationMove('Mind the Floorboards');
    expect(store.locationComposerOpen()).toBe(true);

    store.attachLocation('loc-a');

    expect(store.locationComposerOpen()).toBe(true);
    expect(store.locationCustomMoves().map((move) => move.name)).toEqual(['Mind the Floorboards']);
  });

  it('5f3a-D3: the bystander composer behaves the same', () => {
    store.currentPhase.set(3);
    expect(store.bystanderComposerDirty()).toBe(false);

    addBystanderMove('Call for Backup');

    expect(store.bystanderComposerDirty()).toBe(true);

    store.attachBystander('bys-a');

    expect(store.bystanderComposerOpen()).toBe(true);
    expect(store.bystanderCustomMoves()).toHaveLength(1);
  });

  it('5f3a-E1: the pencil loads back the moves the card was saved with', () => {
    addLocationMove('Mind the Floorboards', 'Roll +Cool or the floor gives.');
    authorLocation('The Old Mill');

    expect(store.locations()[0].customMoves.map((move) => move.name)).toEqual(['Mind the Floorboards']);
    expect(store.locationCustomMoves()).toEqual([]);

    store.editLocationDraft(store.locations()[0].localKey);

    expect(store.locationCustomMoves().map((move) => move.name)).toEqual(['Mind the Floorboards']);
    expect(store.locationCustomMoves()[0].description).toBe('Roll +Cool or the floor gives.');
  });

  it('5f3a-R1: a fresh composer after editing shows none, and its add form is clear', () => {
    addLocationMove('Mind the Floorboards');
    authorLocation('The Old Mill');
    store.editLocationDraft(store.locations()[0].localKey);
    expect(store.locationCustomMoves()).toHaveLength(1);

    store.startNewLocationDraft();

    // The one with a data consequence: leak these and they are written to the *next* location.
    expect(store.locationCustomMoves()).toEqual([]);
    expect(store.locationCustomMoveForm.controls.name.value).toBe('');
  });

  it('5f3a-R2: and the bystander composer resets the same way', () => {
    store.currentPhase.set(3);
    addBystanderMove('Call for Backup');
    store.addBystanderForm.setValue({ name: 'Deputy Rhodes', description: '', bystanderTypeId: 'bystander-type-1' });
    store.saveBystanderDraft();
    store.editBystanderDraft(store.bystanders()[0].localKey);
    expect(store.bystanderCustomMoves()).toHaveLength(1);

    store.startNewBystanderDraft();

    expect(store.bystanderCustomMoves()).toEqual([]);
    expect(store.bystanderCustomMoveForm.controls.name.value).toBe('');
  });

  // --- the write path, and the owner literals (§35.4) ---------------------------------------

  it('5f3a-W1: an authored location writes its own moves, into its own owner space', () => {
    addLocationMove('Mind the Floorboards', 'Roll +Cool or the floor gives.');
    authorLocation('The Old Mill');

    store.next();

    expectLedger([
      'location.create(mystery-1,{"name":"The Old Mill","description":null,"locationTypeId":"location-type-1"})',
      'move.create(loc-created,{"name":"Mind the Floorboards","description":"Roll +Cool or the floor gives."})',
    ]);

    // **The only guard on the write half** (§35.4 item 1): no `data-owner-type` exists in the
    // wizard, and the segment is derived through the real builder rather than transcribed.
    expect(ownerTypesSeen).toHaveLength(1);
    expect(customMovesPath(ownerTypesSeen[0], 'x')).toBe(customMovesPath('Location', 'x'));
    expect(customMovesPath(ownerTypesSeen[0], 'x')).toContain('/locations/');
  });

  it('5f3a-W2: and a bystander writes into a different one — the copy-paste mistake fails here', () => {
    store.currentPhase.set(3);
    addBystanderMove('Call for Backup');
    store.addBystanderForm.setValue({ name: 'Deputy Rhodes', description: '', bystanderTypeId: 'bystander-type-1' });
    store.saveBystanderDraft();

    store.next();

    expect(ownerTypesSeen).toHaveLength(1);
    expect(customMovesPath(ownerTypesSeen[0], 'x')).toBe(customMovesPath('Bystander', 'x'));
    expect(customMovesPath(ownerTypesSeen[0], 'x')).toContain('/bystanders/');
  });

  it('5f3a-W3: the writeback keeps the id and the baseline in step, so a second submit sends none', () => {
    addLocationMove('Mind the Floorboards');
    authorLocation('The Old Mill');
    store.next();

    // The id came from the server — observable only because the fake answers a sentinel.
    expect(store.locations()[0].customMoves.map((move) => move.id)).toEqual(['srv-move-1']);
    expect(store.locations()[0].existingCustomMoves.map((move) => move.name)).toEqual(['Mind the Floorboards']);

    store.currentPhase.set(2);
    store.currentStep.set(0);
    sent.length = 0;
    store.next();

    expect(moveCalls()).toEqual([]);
  });

  // --- the interim marker -------------------------------------------------------------------

  it('5f3a-L1: `customMovesLoaded` is false where the wizard has not seen the server, true where it has', () => {
    authorLocation('The Old Mill');
    expect(store.locations()[0].customMovesLoaded).toBe(true);

    store.attachLocation('loc-a');
    // **5f-3b sets it at attach**, which is the one switch 5f-3a was built to leave: the fetch has
    // answered by the time the draft is built, so there is nothing the panel cannot show.
    expect(store.locations()[1].customMovesLoaded).toBe(true);

    store.next();

    expect(store.locations().map((draft) => draft.customMovesLoaded)).toEqual([true, true]);
  });

  it('5f3a-L2: the composer reports the flag of the row it is editing, and true for a new one', () => {
    store.attachLocation('loc-a');

    // Nothing loaded: a new draft knows its own moves because there are none to miss.
    expect(store.locationComposerMovesLoaded()).toBe(true);

    store.editLocationDraft(store.locations()[0].localKey);
    expect(store.locationComposerMovesLoaded()).toBe(true);

    // The *hydrated* case is what still answers false — `getByMystery` is a list route too, and
    // 5f-3b did not add a per-row fetch to edit-mode load (F-L10).
    store.locations.update((items) => items.map((item) => ({ ...item, customMovesLoaded: false })));
    expect(store.locationComposerMovesLoaded()).toBe(false);

    store.startNewLocationDraft();
    expect(store.locationComposerMovesLoaded()).toBe(true);
  });
});
