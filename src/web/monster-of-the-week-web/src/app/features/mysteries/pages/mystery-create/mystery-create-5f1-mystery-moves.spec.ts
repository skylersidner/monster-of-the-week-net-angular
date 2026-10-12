import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of } from 'rxjs';

import { BystanderService } from '../../../../core/bystander';
import { CustomMoveOwnerType, UpsertCustomMoveRequest } from '../../../../core/models';
import { CustomMoveService, customMovesPath } from '../../../../core/custom-moves';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **Step `0-4` — the mystery's own custom moves (5f-1).**
 *
 * The request half is an exact ledger in the shape `mystery-create-phase4-ledger.spec.ts`
 * established: recorded at **subscribe** rather than at method call, because `HttpClient` is cold
 * and a ledger written when the method is invoked over-counts a request that was built and dropped.
 *
 * **The fake echoes what was sent, and that is load-bearing** — the standing decision
 * `toad-fake-repositories-must-mirror-real-return-semantics`, with the sharpening 5f-0 added: a
 * non-empty return is the floor, and *distinguishable from what was sent* is the bar. Two halves
 * here:
 *
 * - The id is a **sentinel** (`srv-move-N`), never the draft's key, so "the draft took the server's
 *   id" is an observable fact rather than an assumption.
 * - The name and description are **echoed**, because the real API returns the saved row and
 *   `applySubResourceDiff` makes that response the next baseline. A fake that answered
 *   `{ name: '' }` would make every row read as dirty on the following submit, and `S-5f1-4`
 *   ("a second submit sends nothing") would fail for a reason that has nothing to do with the code.
 */
describe('Step 0-4 — the mystery’s own custom moves', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let ownerTypesSeen: CustomMoveOwnerType[];
  let nextServerId: number;

  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());

  const HYDRATED_MOVES = [
    { id: 'srv-existing-1', name: 'Call the Choir', description: 'Roll +Weird to summon the dead chorus.' },
    { id: 'srv-existing-2', name: 'Read the Hymnal', description: null },
  ];

  function configure(hydratedMoves: { id: string; name: string; description: string | null }[] = []): void {
    sent = [];
    ownerTypesSeen = [];
    nextServerId = 0;

    const describeArgs = (args: unknown[]): string =>
      args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(',');

    const record = <T>(name: string, result: (args: unknown[]) => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          sent.push(`${name}(${describeArgs(args)})`);
          return result(args);
        }),
      );

    /**
     * The custom-move recorder. **The owner type is kept out of the ledger line on purpose** and
     * collected separately: in the line it would be a transcribed `'Mystery'` matched against a
     * transcribed `'Mystery'` in the expectation, which cannot disagree. `ownerTypesSeen` goes
     * through the real path builder instead, which can.
     */
    const recordMove = <T>(name: string, result: (args: unknown[]) => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          ownerTypesSeen.push(args[0] as CustomMoveOwnerType);
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
            list: vi.fn(),
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
            upsertCountdown: record('mystery.countdown', () => of({ id: 'countdown-1' })),
            getMystery: vi.fn(() =>
              of({
                id: 'mystery-1',
                name: 'The Hollow Choir',
                concept: null,
                hook: null,
                overview: null,
                countdown: null,
                adventureType: { id: 'adventure-type-1', name: 'Haunting', description: '' },
                customMoves: hydratedMoves,
              }),
            ),
            getMysteries: vi.fn(() => of([{ id: 'mystery-1', name: 'The Hollow Choir' }])),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), getByMystery: () => of([]) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: { getAll: () => of([]), getByMystery: () => of([]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]), getByMystery: () => of([]) } },
        {
          provide: ReferenceDataService,
          useValue: {
            getAdventureTypes: () => of([{ id: 'adventure-type-1', name: 'Haunting', description: '' }]),
            getMonsterArchetypes: () => of([{ id: 'monster-archetype-1', name: 'Ghost', description: '' }]),
            getMonsterTypes: () => of([{ id: 'monster-type-1', name: 'Beast', motivation: '' }]),
            getMinionTypes: () => of([{ id: 'minion-type-1', name: 'Cultist', motivation: '' }]),
            getLocationTypes: () => of([{ id: 'location-type-1', name: 'Lair', motivation: '' }]),
            getBystanderTypes: () => of([{ id: 'bystander-type-1', name: 'Witness', motivation: '' }]),
            getWeaponTags: () => of([]),
          },
        },
      ],
    });

    store = TestBed.inject(MysteryCreateStore);
  }

  /** Create mode: no id yet, so the first submit creates the mystery and then its moves. */
  function createMode(): void {
    configure();
    store.init();
    store.conceptForm.setValue({ name: 'The Hollow Choir', concept: '', adventureTypeId: 'adventure-type-1' });
    store.currentStep.set(4);
    sent.length = 0;
  }

  /** Edit mode: the mystery and its two moves are hydrated from the detail response. */
  function editMode(): void {
    configure(HYDRATED_MOVES);
    store.init('mystery-1');
    store.currentStep.set(4);
    sent.length = 0;
  }

  const addMove = (name: string, description = ''): void => {
    store.mysteryCustomMoveForm.setValue({ name, description });
    store.addMysteryCustomMove();
  };

  // --- the step itself ---------------------------------------------------------------------

  it('5f1-S1: every step the tracker renders has a title and a blurb — derived, so a missing 0-4 fails here', () => {
    createMode();

    // **Derived rather than transcribed** (§26.2 L11's shape). Asserting `stepTitle` at `'0-4'`
    // would prove only that someone wrote the same string twice. Walking `phases` means the day a
    // sixth step is added without its copy, this fails — and it is the only guard on that, because
    // a missing entry resolves to `''` and renders as a blank heading rather than erroring.
    const missing: string[] = [];
    for (const phase of store.phases) {
      for (const step of phase.stepsArray) {
        store.currentPhase.set(phase.index);
        store.currentStep.set(step);
        if (store.stepTitle().trim().length === 0) { missing.push(`title ${phase.index}-${step}`); }
        if (store.stepBlurb().trim().length === 0) { missing.push(`blurb ${phase.index}-${step}`); }
      }
    }

    expect(missing).toEqual([]);
    // And the new one is really in the set that was walked, not an empty loop passing vacuously.
    expect(store.phases[0].stepsArray).toEqual([0, 1, 2, 3, 4]);
    expect(store.phases[0].steps).toBe(5);
  });

  it('5f1-S2: step 0-4 keeps the phase icon — the deliberate non-change', () => {
    createMode();

    // `currentSectionIcon` has an arm for `0-3` (countdown) and `1-1` (minions). `0-4` deliberately
    // has none: a custom move is the mystery's own, so the Mystery icon is the right answer and an
    // arm would be a worse one. Asserted so "we forgot" and "we decided" are distinguishable.
    store.currentPhase.set(0);
    store.currentStep.set(4);
    expect(store.currentSectionIcon()).toBe('mystery');

    store.currentStep.set(3);
    expect(store.currentSectionIcon()).toBe('countdown');
  });

  it('5f1-S3: the step dot means "has content", like the other eight (J3)', () => {
    createMode();

    expect(store.phaseStepComplete()[0]).toHaveLength(5);
    expect(store.phaseStepComplete()[0][4]).toBe(false);

    addMove('Call the Choir');
    expect(store.phaseStepComplete()[0][4]).toBe(true);

    store.removeMysteryCustomMove(store.mysteryCustomMoves()[0].localKey);
    expect(store.phaseStepComplete()[0][4]).toBe(false);
  });

  // --- the write path ---------------------------------------------------------------------

  it('5f1-W1: one staged move, one POST — and the owner segment is derived, not transcribed', () => {
    createMode();
    addMove('Call the Choir', 'Roll +Weird to summon the dead chorus.');

    store.next();

    expectLedger([
      'mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})',
      'move.create(mystery-1,{"name":"Call the Choir","description":"Roll +Weird to summon the dead chorus."})',
    ]);

    // **The only guard on the write half** (§35.4 item 1). There is no `data-owner-type` attribute
    // in the wizard, so nothing else checks that the mystery's moves are written into the mystery's
    // owner space. The segment comes from the real builder rather than the string `'mysteries'`, so
    // a renamed segment moves this assertion with it instead of breaking it.
    expect(ownerTypesSeen).toHaveLength(1);
    expect(customMovesPath(ownerTypesSeen[0], 'mystery-1')).toBe(customMovesPath('Mystery', 'mystery-1'));
    expect(customMovesPath(ownerTypesSeen[0], 'mystery-1')).toContain('/mysteries/mystery-1/');
  });

  it('5f1-W2: the moves are a forkJoin sibling of the countdown, so neither hides the other', () => {
    createMode();
    addMove('Call the Choir');

    store.next();

    // Both went out on the same transition. Chaining the moves after the countdown would make a
    // countdown failure swallow the move write silently, which is the §30.3 argument — asserted
    // here as "both are in one ledger" because order is not what is being claimed.
    expect(sent.filter((call) => call.startsWith('mystery.countdown'))).toHaveLength(1);
    expect(sent.filter((call) => call.startsWith('move.create'))).toHaveLength(1);
  });

  it('5f1-W3: an empty collection still advances, and issues nothing', () => {
    createMode();

    store.next();

    // The case `forkJoin([])` would turn into a hang rather than a failure: `applySubResourceDiff`
    // over an empty collection has to *emit* for the subscriber to run at all. If it did not, the
    // phase would never advance and `clearDrainedRemovals` would never fire.
    expectLedger(['mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})']);
    expect(store.currentPhase()).toBe(1);
  });

  it('5f1-W4: the writeback sets the id and the baseline together, so a second submit sends nothing', () => {
    createMode();
    addMove('Call the Choir', 'Roll +Weird.');

    store.next();

    // The id came from the server, not from the draft key — which is only observable because the
    // fake answers with a sentinel.
    expect(store.mysteryCustomMoves().map((move) => move.id)).toEqual(['srv-move-1']);

    store.currentPhase.set(0);
    store.currentStep.set(4);
    sent.length = 0;
    store.next();

    // **H2.** The id and the baseline were written from the same diff result, so the row matches its
    // baseline and the diff issues nothing. Refreshing one without the other is the failure this
    // catches: the draft would never match again and every submit would delete and recreate it.
    expectLedger(['mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})']);
  });

  // --- edit mode, where the baseline is real ------------------------------------------------

  it('5f1-E1: hydration gives the drafts the ids of the rows the baseline was built from', () => {
    editMode();

    expect(store.mysteryCustomMoves().map((move) => move.id)).toEqual(['srv-existing-1', 'srv-existing-2']);
    expect(store.mysteryCustomMoves().map((move) => move.name)).toEqual(['Call the Choir', 'Read the Hymnal']);
    // `null` arrives as `''`, because the panel binds a non-nullable control.
    expect(store.mysteryCustomMoves().map((move) => move.description)).toEqual([
      'Roll +Weird to summon the dead chorus.',
      '',
    ]);
    // Every draft has its own key, including the hydrated ones (14-R4's wizard twin).
    expect(new Set(store.mysteryCustomMoves().map((move) => move.localKey)).size).toBe(2);
  });

  it('5f1-E2: a no-op submit on hydrated moves rotates no id and sends no move request', () => {
    editMode();

    store.next();

    expectLedger(['mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})']);
    expect(store.mysteryCustomMoves().map((move) => move.id)).toEqual(['srv-existing-1', 'srv-existing-2']);
  });

  it('5f1-E3: editing one hydrated move sends exactly one PUT, and nothing for the other', () => {
    editMode();

    // The panel has no row edit (§13.5.3), so the user's route to a changed row is remove-and-re-add
    // — which the diff answers with a DELETE and a POST, not a PUT. The PUT path is reached by a
    // *hydrated* row whose values change, which is what a later surface will do; it is exercised
    // here directly so the adapter's `isDirty` and `update` are not dead code until then.
    store.mysteryCustomMoves.update((moves) =>
      moves.map((move) => (move.id === 'srv-existing-2' ? { ...move, description: 'Roll +Sharp instead.' } : move)),
    );

    store.next();

    expectLedger([
      'mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})',
      'move.update(mystery-1,srv-existing-2,{"name":"Read the Hymnal","description":"Roll +Sharp instead."})',
    ]);
  });

  it('5f1-E4: removing a hydrated move sends exactly one DELETE, and adding one sends one POST', () => {
    editMode();

    store.removeMysteryCustomMove(store.mysteryCustomMoves()[0].localKey);
    addMove('Sing It Back');

    store.next();

    expectLedger([
      'mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})',
      'move.delete(mystery-1,srv-existing-1)',
      'move.create(mystery-1,{"name":"Sing It Back","description":null})',
    ]);

    // The survivor kept its id and the new row took the server's.
    expect(store.mysteryCustomMoves().map((move) => move.id)).toEqual(['srv-existing-2', 'srv-move-1']);
  });

  // --- commit-on-advance -------------------------------------------------------------------

  it('5f1-C1: a valid but uncommitted add form is committed by Next rather than discarded', () => {
    createMode();

    // Typed and not added. The four neighbour panels inside the monster composer discard this; a
    // panel that *is* a step cannot, because Next is the only commit point there is.
    store.mysteryCustomMoveForm.setValue({ name: 'Call the Choir', description: 'Roll +Weird.' });

    store.next();

    expectLedger([
      'mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})',
      'move.create(mystery-1,{"name":"Call the Choir","description":"Roll +Weird."})',
    ]);
    expect(store.currentPhase()).toBe(1);
  });

  it('5f1-C2: a started-but-invalid add form blocks the advance and issues nothing', () => {
    createMode();

    // A description with no name — the only invalid state the form has.
    store.mysteryCustomMoveForm.patchValue({ description: 'Roll +Weird.' });

    store.next();

    expectLedger([]);
    expect(store.currentPhase()).toBe(0);
    expect(store.currentStep()).toBe(4);
    expect(store.submitError()).toBe("Finish or clear the custom move you're adding before continuing.");
  });

  it('5f1-C3: an untouched add form advances silently — the empty case is not the blocked case', () => {
    createMode();

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(store.submitError()).toBeNull();
    expect(store.mysteryCustomMoves()).toEqual([]);
  });
});
