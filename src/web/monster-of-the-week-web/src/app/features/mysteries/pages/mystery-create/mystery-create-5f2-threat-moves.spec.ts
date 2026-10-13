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
 * **5f-2 — custom moves on the monster and minion composers.**
 *
 * §26.2 L6's point, which is this file's whole reason for existing: of the per-owner sites a fifth
 * collection touches, **only two are protected by the type system**. `MonsterDraft` is an interface
 * with required fields, so the two object-literal construction sites stop compiling; the rest are
 * *expressions*, and adding a field to an interface does not force a clause into a boolean, an
 * entry into an inferred `computed` return, a `.set()` into a loader, a clear into a reset or a
 * line into a spread-based writeback.
 *
 * So every assertion below exists to make one silent omission loud. Where §30.4 names an existing
 * model, this file uses it rather than inventing one:
 *
 * | silent site | the assertion, and its model |
 * |---|---|
 * | `monsterComposerPreview` | `5f2-P*` — a composer holding **only** a custom move appears in the preview |
 * | `monsterComposerDirty` | `5f2-D*` — `mystery-create-phase4-ledger.spec.ts:479`'s "a half-filled composer counts as dirty", retargeted |
 * | `editMonsterDraft` | `5f2-E*` — the pencil loads the moves it saved |
 * | `resetMonsterComposer` | `5f2-R*` — a fresh composer after editing shows none |
 * | `writeBackMonsterDrafts` | the `5a-U1` id oracle, **extended in `mystery-create-phase5a-ledger.spec.ts`** rather than duplicated here |
 *
 * **Every fixture that pins a silent site holds nothing but a custom move.** That is not tidiness:
 * a composer with a name or a type in it is dirty, and previews, whether or not the moves are
 * counted — so the assertion would pass in both the correct world and the broken one.
 *
 * The fake echoes what was sent and answers with a sentinel id, per the bar 5f-0 set and 5f-1
 * applied: non-empty is the floor, *distinguishable from what was sent* is the bar.
 */
describe('5f-2 — custom moves on the threat composers', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let ownerTypesSeen: DomainOwnerType[];
  let nextServerId: number;

  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());

  /** A catalogue monster for the attach path, with one custom move on its detail response. */
  const CATALOGUE_MONSTER = {
    id: 'monster-9',
    mysteryIds: [],
    name: 'The Hollow Man',
    description: null,
    harmCapacity: 6,
    monsterType: { id: 'monster-type-1', name: 'Beast', motivation: '' },
    monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
    attackCount: 0,
    powerCount: 0,
    weaknessCount: 0,
    armorCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const DETAIL_MONSTER = {
    id: 'monster-9',
    mysteryIds: [],
    name: 'The Hollow Man',
    description: null,
    harmCapacity: 6,
    monsterTypeId: 'monster-type-1',
    monsterArchetype: { id: 'monster-archetype-1', name: 'Ghost', description: '' },
    attacks: [],
    powers: [],
    weaknesses: [],
    armors: [],
    customMoves: [{ id: 'srv-existing-1', name: 'Walk Through Walls', description: null }],
  };

  beforeEach(() => {
    sent = [];
    ownerTypesSeen = [];
    nextServerId = 0;

    const describeArgs = (args: unknown[]): string =>
      args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(',');

    const record = <T>(name: string, result: (args: unknown[]) => Observable<T>) =>
      vi.fn((...args: unknown[]) => defer(() => { sent.push(`${name}(${describeArgs(args)})`); return result(args); }));

    /** Owner type collected separately, so it can be checked through the real path builder. */
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
            upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
            getMysteries: vi.fn(() => of([{ id: 'mystery-1', name: 'The Hollow Choir' }])),
          },
        },
        {
          provide: MonsterService,
          useValue: {
            getAll: vi.fn(() => of([CATALOGUE_MONSTER])),
            getById: vi.fn(() => of(DETAIL_MONSTER)),
            create: record('monster.create', () => of({ id: 'monster-1' })),
            update: record('monster.update', () => of({ id: 'monster-1' })),
            linkToMystery: record('monster.link', () => of(undefined)),
            unlinkFromMystery: vi.fn(() => of(undefined)),
            delete: vi.fn(() => of(undefined)),
            createAttack: vi.fn(() => of({ id: 'a' })),
            createPower: vi.fn(() => of({ id: 'p' })),
            createWeakness: vi.fn(() => of({ id: 'w' })),
            createArmor: vi.fn(() => of({ id: 'r' })),
          },
        },
        {
          provide: MinionService,
          useValue: {
            getByMonster: vi.fn(() => of([])),
            getById: vi.fn(),
            create: record('minion.create', () => of({ id: 'minion-1' })),
            update: record('minion.update', () => of({ id: 'minion-1' })),
            moveToMonster: vi.fn(() => of(undefined)),
            delete: vi.fn(() => of(undefined)),
            createAttack: vi.fn(() => of({ id: 'a' })),
            createPower: vi.fn(() => of({ id: 'p' })),
            createWeakness: vi.fn(() => of({ id: 'w' })),
            createArmor: vi.fn(() => of({ id: 'r' })),
          },
        },
        { provide: LocationService, useValue: { getAll: () => of([]) } },
        { provide: BystanderService, useValue: { getAll: () => of([]) } },
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
    store.init();
    store.mysteryId.set('mystery-1');
    store.currentPhase.set(1);
    store.currentStep.set(0);
    sent.length = 0;
  });

  /** A monster composer holding **nothing but** one custom move. The non-vacuous fixture. */
  const monsterComposerWithOnlyAMove = (name = 'Conduct the Dead', description = ''): void => {
    store.monsterCustomMoveForm.setValue({ name, description });
    store.addMonsterCustomMove();
  };

  const minionComposerWithOnlyAMove = (name = 'Join the Chorus', description = ''): void => {
    store.minionCustomMoveForm.setValue({ name, description });
    store.addMinionCustomMove();
  };

  const authorMonster = (name: string): void => {
    store.monsterForm.setValue({
      name,
      description: '',
      harmCapacity: 8,
      monsterTypeId: 'monster-type-1',
      monsterArchetypeId: 'monster-archetype-1',
    });
    store.saveMonsterDraftToList();
  };

  // --- site 4: the previews (the dossier's source) ----------------------------------------

  it('5f2-P1: a monster composer holding only a custom move appears in the dossier preview', () => {
    monsterComposerWithOnlyAMove('Conduct the Dead', 'Roll +Weird.');

    // §30.7 flag 1: this is the least visible of the five, because an omission here loses nothing
    // and reports nothing — the moves still save. "Only" is load-bearing: with a name in the
    // composer the dossier entry renders either way.
    expect(store.monsterComposerPreview().name).toBe('');
    expect(store.monsterComposerPreview().customMoves.map((move) => move.name)).toEqual(['Conduct the Dead']);
    expect(store.monsterComposerPreview().customMoves[0].description).toBe('Roll +Weird.');
  });

  it('5f2-P2: and the same one level down, on the minion composer', () => {
    minionComposerWithOnlyAMove();

    expect(store.minionPreview().name).toBe('');
    expect(store.minionPreview().customMoves.map((move) => move.name)).toEqual(['Join the Chorus']);
  });

  // --- site 5: the dirty computeds — a correctness item, not a checklist row ---------------

  it('5f2-D1: a monster composer holding only a custom move counts as dirty', () => {
    expect(store.monsterComposerDirty()).toBe(false);

    monsterComposerWithOnlyAMove();

    // The model is `mystery-create-phase4-ledger.spec.ts:479`'s "a half-filled composer counts as
    // dirty, not just a valid one" — the same property, one collection over.
    expect(store.monsterComposerDirty()).toBe(true);
    expect(store.monsterComposerValid()).toBe(false);
  });

  it('5f2-D2: the same for the minion composer', () => {
    expect(store.minionComposerDirty()).toBe(false);

    minionComposerWithOnlyAMove();

    expect(store.minionComposerDirty()).toBe(true);
  });

  it('5f2-D3: so attaching an existing monster does not silently discard it', () => {
    monsterComposerWithOnlyAMove();
    expect(store.monsterComposerOpen()).toBe(true);

    store.attachMonster('monster-9');

    // `attachMonster` collapses an *untouched* composer (§15.2 R5). Omit the moves from
    // `monsterComposerDirty` and this composer reads untouched, so it collapses — and then
    // `next()`'s commit rule skips a closed composer and the move is gone, with no message and
    // nothing on the wire. This is the one of the five that destroys work rather than hiding it.
    expect(store.monsterComposerOpen()).toBe(true);
    expect(store.monsterCustomMoves().map((move) => move.name)).toEqual(['Conduct the Dead']);
    expect(store.monsterDrafts().map((draft) => draft.name)).toEqual(['The Hollow Man']);
  });

  it('5f2-D4: and Next blocks rather than discarding it, because a nameless monster cannot commit', () => {
    monsterComposerWithOnlyAMove();

    store.next();

    expect(store.currentPhase()).toBe(1);
    expect(store.currentStep()).toBe(0);
    expect(store.monsterCustomMoves()).toHaveLength(1);
    expectLedger([]);
  });

  // --- site 7: the editDraft loaders -------------------------------------------------------

  it('5f2-E1: the pencil loads back the custom moves the card was saved with', () => {
    monsterComposerWithOnlyAMove('Conduct the Dead', 'Roll +Weird.');
    authorMonster('Maestro Vey');

    // Committed to the draft (the compiler-protected site), then cleared from the composer.
    expect(store.monsterDrafts()[0].customMoves.map((move) => move.name)).toEqual(['Conduct the Dead']);
    expect(store.monsterCustomMoves()).toEqual([]);

    store.editMonsterDraft(store.monsterDrafts()[0].localKey);

    expect(store.monsterCustomMoves().map((move) => move.name)).toEqual(['Conduct the Dead']);
    expect(store.monsterCustomMoves()[0].description).toBe('Roll +Weird.');
  });

  it('5f2-E2: and the minion pencil does the same', () => {
    authorMonster('Maestro Vey');
    store.currentStep.set(1);
    minionComposerWithOnlyAMove();
    store.minionForm.patchValue({
      name: 'Choir Thrall',
      description: '',
      harmCapacity: 3,
      minionTypeId: 'minion-type-1',
    });
    store.saveMinionDraftToList();

    expect(store.minionDrafts()[0].customMoves.map((move) => move.name)).toEqual(['Join the Chorus']);

    store.editMinionDraft(store.minionDrafts()[0].localKey);

    expect(store.minionCustomMoves().map((move) => move.name)).toEqual(['Join the Chorus']);
  });

  // --- site 8: the resets — the only silent site with a data consequence -------------------

  it('5f2-R1: a fresh composer opened after editing a monster with moves shows none', () => {
    monsterComposerWithOnlyAMove('Conduct the Dead');
    authorMonster('Maestro Vey');
    store.editMonsterDraft(store.monsterDrafts()[0].localKey);
    expect(store.monsterCustomMoves()).toHaveLength(1);

    store.startNewMonsterDraft();

    // Omit the clear from `resetMonsterComposer` and the previous monster's moves leak into the
    // next composer — and then get *written* to the next monster on submit. Display bug for the
    // other four silent sites; a data bug for this one.
    expect(store.monsterCustomMoves()).toEqual([]);
    expect(store.editingMonsterKey()).toBeNull();
  });

  it('5f2-R2: the add form is cleared with the rows, not left holding half a move', () => {
    store.monsterCustomMoveForm.patchValue({ name: 'Half typed' });

    store.startNewMonsterDraft();

    expect(store.monsterCustomMoveForm.controls.name.value).toBe('');
  });

  it('5f2-R3: and the minion composer resets the same way', () => {
    authorMonster('Maestro Vey');
    store.currentStep.set(1);
    minionComposerWithOnlyAMove();
    store.minionForm.patchValue({ name: 'Choir Thrall', description: '', harmCapacity: 3, minionTypeId: 'minion-type-1' });
    store.saveMinionDraftToList();
    store.editMinionDraft(store.minionDrafts()[0].localKey);
    expect(store.minionCustomMoves()).toHaveLength(1);

    store.startNewMinionDraft();

    expect(store.minionCustomMoves()).toEqual([]);
    expect(store.minionCustomMoveForm.controls.name.value).toBe('');
  });

  // --- the write path, and the owner literals (§35.4) --------------------------------------

  it('5f2-W1: a monster and a minion each write their own moves, to their own owner space', () => {
    monsterComposerWithOnlyAMove('Conduct the Dead', 'Roll +Weird.');
    authorMonster('Maestro Vey');
    store.currentStep.set(1);
    minionComposerWithOnlyAMove('Join the Chorus');
    store.minionForm.patchValue({ name: 'Choir Thrall', description: '', harmCapacity: 3, minionTypeId: 'minion-type-1' });
    store.saveMinionDraftToList();
    sent.length = 0;

    store.next();

    expectLedger([
      'monster.create(mystery-1,{"name":"Maestro Vey","description":null,"harmCapacity":8,"monsterTypeId":"monster-type-1","monsterArchetypeId":"monster-archetype-1"})',
      'move.create(monster-1,{"name":"Conduct the Dead","description":"Roll +Weird."})',
      'minion.create(monster-1,{"name":"Choir Thrall","description":null,"harmCapacity":3,"minionTypeId":"minion-type-1"})',
      'move.create(minion-1,{"name":"Join the Chorus","description":null})',
    ]);

    /**
     * **The only guard on the write half** (§35.4 item 1). The wizard has no `data-owner-type`
     * analogue, so nothing else says a minion's moves went into the minion owner space — and
     * `customMoveSubResource('Monster')` written inside `saveMinionCollections` is one token,
     * compiles, and is invisible until someone opens the monster.
     *
     * Derived through the real path builder rather than compared against the string `'minions'`:
     * a transcribed `'Minion'` here matched against a transcribed `'Minion'` in the expectation
     * could not disagree, and the segment moves with the builder if it is ever renamed.
     */
    // Both writebacks ran, and each row took *its own* server id. Without this the minion half of
    // site 9 has no assertion at all: a dropped `rekeyDrafts` is invisible on the hydrated path,
    // because the id it would have written is the id the draft already had.
    const monsterMoveIds = store.monsterDrafts()[0].customMoves.map((m) => m.id);
    const minionMoveIds = store.minionDrafts()[0].customMoves.map((m) => m.id);
    expect(monsterMoveIds.every((id) => id !== null)).toBe(true);
    expect(minionMoveIds.every((id) => id !== null)).toBe(true);
    expect(new Set([...monsterMoveIds, ...minionMoveIds]).size).toBe(2);

    expect(ownerTypesSeen).toHaveLength(2);
    expect(customMovesPath(ownerTypesSeen[0], 'monster-1')).toBe(customMovesPath('Monster', 'monster-1'));
    expect(customMovesPath(ownerTypesSeen[1], 'minion-1')).toBe(customMovesPath('Minion', 'minion-1'));
    // And the two are **different**, which is the assertion the copy-paste mistake fails.
    expect(ownerTypesSeen[0]).not.toBe(ownerTypesSeen[1]);
    expect(customMovesPath(ownerTypesSeen[0], 'x')).toContain('/monsters/');
    expect(customMovesPath(ownerTypesSeen[1], 'x')).toContain('/minions/');
  });

  it('5f2-W2: a second submit writes nothing — the writeback kept the ids and the baseline in step', () => {
    monsterComposerWithOnlyAMove('Conduct the Dead');
    authorMonster('Maestro Vey');
    // Phase 1 has two steps, so the submit is reached from the minion step — not from step 0,
    // where `next()` merely advances. (5f-1's lesson, one phase over.)
    store.currentStep.set(1);
    store.next();

    // The id came from the server, which is observable only because the fake answers a sentinel.
    expect(store.monsterDrafts()[0].customMoves.map((move) => move.id)).toEqual(['srv-move-1']);

    store.currentPhase.set(1);
    store.currentStep.set(1);
    sent.length = 0;
    store.next();

    // H2. The row matches its baseline, so decision 9's clean branch issues nothing. Omit either
    // half of the writeback and this becomes a DELETE plus a POST on every transition.
    expectLedger([
      'monster.update(monster-1,{"name":"Maestro Vey","description":null,"harmCapacity":8,"monsterTypeId":"monster-type-1","monsterArchetypeId":"monster-archetype-1"})',
      'monster.link(mystery-1,monster-1)',
    ]);
    expect(store.monsterDrafts()[0].customMoves.map((move) => move.id)).toEqual(['srv-move-1']);
  });

  it('5f2-W3: an attached monster arrives with its moves hydrated, and re-submitting writes none', () => {
    store.attachMonster('monster-9');

    // Both halves from one response object — the draft's id and the baseline it came from.
    expect(store.monsterDrafts()[0].customMoves.map((move) => move.id)).toEqual(['srv-existing-1']);
    expect(store.monsterDrafts()[0].customMoves[0].name).toBe('Walk Through Walls');
    sent.length = 0;

    store.currentStep.set(1);
    store.next();

    expectLedger([
      'monster.update(monster-9,{"name":"The Hollow Man","description":null,"harmCapacity":6,"monsterTypeId":"monster-type-1","monsterArchetypeId":"monster-archetype-1"})',
      'monster.link(mystery-1,monster-9)',
    ]);
  });
});
