import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of, throwError } from 'rxjs';

import { CustomMoveService } from '../../../../core/custom-moves';
import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * Phase 4's store contract — attach, re-edit, and the removal disposition — against Peach's
 * acceptance criteria in `docs/updates/mystery-entity-linking-acceptance.md`. Criterion ids are
 * cited per test so a failure names the requirement, not just the behaviour.
 *
 * The phase components' half (the variant table, the modal bindings, focus) is in
 * `mystery-create-phase4.spec.ts`.
 */

const CATALOGUE_LOCATIONS = [
  {
    id: 'loc-existing',
    mysteryIds: ['mystery-9', 'mystery-8'],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-other',
    mysteryIds: [],
    name: 'The Diner',
    description: '',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const CATALOGUE_BYSTANDERS = [
  {
    id: 'bys-existing',
    mysteryIds: ['mystery-9'],
    name: 'Sheriff Dalton',
    description: 'Tired and stubborn.',
    bystanderTypeId: 'bystander-type-1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

function notFound(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
}

describe('MysteryCreateStore · Phase 4 — attach, re-edit, removal', () => {
  let store: MysteryCreateStore;
  let calls: string[];
  let locationService: Record<string, ReturnType<typeof vi.fn>>;
  let bystanderService: Record<string, ReturnType<typeof vi.fn>>;
  let mysteryService: Record<string, ReturnType<typeof vi.fn>>;

  /**
   * Exact, complete, order-insensitive — **and multiplicity-sensitive**. Toad found that a
   * `toContain` assertion plus a "and not the other verb" negative still passes when the right call
   * goes out *twice*, which is what reverting `idsToRemove`'s disposition exclusion does on the
   * detach path. A duplicate unlink is worse than a duplicate delete: the drain's copy maps 404 to
   * success and the diff's copy does not, so the second one fails the whole phase.
   */
  const expectLedger = (expected: string[]): void => expect([...calls].sort()).toEqual([...expected].sort());

  beforeEach(() => {
    calls = [];
    // Recorded at **subscribe**, not at method call: `HttpClient` is cold, so a request built and
    // dropped never reaches the wire and must not reach the ledger either.
    const record = <T>(name: string, result: () => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          calls.push(`${name}(${args.join(',')})`);
          return result();
        }),
      );

    locationService = {
      getAll: vi.fn(() => of(CATALOGUE_LOCATIONS)),
      create: record('location.create', () => of({ id: 'loc-created' })),
      update: record('location.update', () => of({ id: 'loc-updated' })),
      linkToMystery: record('location.link', () => of(undefined)),
      unlinkFromMystery: record('location.unlink', () => of(undefined)),
      delete: record('location.delete', () => of(undefined)),
    };
    bystanderService = {
      getAll: vi.fn(() => of(CATALOGUE_BYSTANDERS)),
      create: record('bystander.create', () => of({ id: 'bys-created' })),
      update: record('bystander.update', () => of({ id: 'bys-updated' })),
      linkToMystery: record('bystander.link', () => of(undefined)),
      unlinkFromMystery: record('bystander.unlink', () => of(undefined)),
      delete: record('bystander.delete', () => of(undefined)),
    };
    mysteryService = {
      create: vi.fn(() => of({ id: 'mystery-1' })),
      update: vi.fn(() => of({ id: 'mystery-1' })),
      upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
      getMysteries: vi.fn(() =>
        of([
          { id: 'mystery-1', name: 'The Hollow Choir' },
          { id: 'mystery-9', name: 'Dust Bowl Nights' },
          { id: 'mystery-8', name: 'The Long Drive Home' },
        ]),
      ),
    };

    TestBed.configureTestingModule({
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
            /**
             * **`list` answers; the three writes still refuse** (5f-3b).
             *
             * F-L9's stub refused everything, and that is exactly how this file announced the new
             * call: 26 tests failed naming `CustomMoveService.list()` the moment attach started
             * fetching. Softening the whole stub would have thrown that away. Only the read is
             * allowed, so this file still fails loudly if an attach ever starts *writing*.
             *
             * `of([])` is right **here** and would be wrong as the only fixture anywhere: an empty
             * answer makes the baseline-versus-drafts distinction unobservable, which is §30.5's
             * gate item 3. This file is about attach bookkeeping, not about moves; the non-empty
             * fixture lives in `mystery-create-5f3b-attach-fetch.spec.ts`.
             */
            return { list: () => of([]), create: refuse('create'), update: refuse('update'), delete: refuse('delete') };
          })(),
        },
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        { provide: MysteryService, useValue: mysteryService },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: vi.fn(() => of({ id: 'monster-1' })) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: locationService },
        { provide: BystanderService, useValue: bystanderService },
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
    store.currentPhase.set(2);
    store.currentStep.set(0);
    calls.length = 0;
  });

  const locationKeys = (): string[] => store.locations().map((draft) => draft.localKey);
  const names = (): string[] => store.locations().map((draft) => draft.name);

  function authorLocation(name: string): void {
    store.addLocationForm.setValue({ name, description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();
  }

  /** Submits phase 2 and puts the wizard back on it, as `Back` would. */
  function submitLocations(): void {
    store.next();
    store.currentPhase.set(2);
    store.currentStep.set(0);
  }

  // --- A: attach -----------------------------------------------------------------------

  it('A2: offers every catalogue entity not already on the roster, and stops offering one once attached', () => {
    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-existing', 'loc-other']);

    store.attachLocation('loc-existing');

    expect(names()).toEqual(['Ferris Mill']);
    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-other']);
  });

  it('A2: attaching copies the catalogue values onto the draft, including its other memberships', () => {
    store.attachLocation('loc-existing');

    const draft = store.locations()[0];
    expect(draft.id).toBe('loc-existing');
    expect(draft.name).toBe('Ferris Mill');
    expect(draft.description).toBe('Rust and river damp.');
    expect(draft.locationTypeId).toBe('location-type-1');
    // §7.2 — retained through hydration and attach, and the modal's only source for "used by".
    expect(draft.mysteryIds).toEqual(['mystery-9', 'mystery-8']);
    expect(draft.localKey).toBeTruthy();
  });

  it('A4: attaching issues no request at all, so abandoning the wizard changes nothing', () => {
    store.attachLocation('loc-existing');
    store.attachBystander('bys-existing');

    expect(calls).toEqual([]);
  });

  it('A3: an empty catalogue is reported so the strip can hide itself', () => {
    expect(store.locationCatalogEmpty()).toBe(false);

    store.attachLocation('loc-existing');
    store.attachLocation('loc-other');

    // Catalogue non-empty but entirely on the roster: still not "empty", so the strip stays and
    // shows its own empty state instead.
    expect(store.locationCatalogEmpty()).toBe(false);
    expect(store.attachableLocations()).toEqual([]);
  });

  it('A5: attach then Next links the entity to the mystery — the load-bearing one', () => {
    store.attachLocation('loc-existing');

    store.next();

    expect(calls).toContain('location.link(mystery-1,loc-existing)');
  });

  it('A6: an untouched attached entity is written back with its own field values', () => {
    // Asserts the values, not the absence of a PUT: a no-op PUT of identical values is expected in
    // Phase 4 — the dirty check that suppresses it is Phase 5 and monsters-only (§5.4, §14.4).
    store.attachLocation('loc-existing');

    store.next();

    expect(locationService['update']).toHaveBeenCalledWith('loc-existing', {
      name: 'Ferris Mill',
      description: 'Rust and river damp.',
      locationTypeId: 'location-type-1',
    });
  });

  it('A7: re-submitting an unchanged phase completes and surfaces no error', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.next();

    expect(store.submitError()).toBeNull();
    expect(calls).toContain('location.link(mystery-1,loc-existing)');
  });

  it('5b-T9: the Locations phase attaches with zero requests, and gains no busy or error state', () => {
    // UX §17.5: the monster strip's two transient states are monsters-only, because only a monster
    // needs a fetch before its card can exist. A state that can never trigger is dead code.
    expect(store.monsterAttachInFlight()).toBe(false);
    expect(store.monsterAttachError()).toBeNull();
  });

  // **A9 is retired, not weakened.** It asserted `attachableMonsters` and `attachMonster` did not
  // exist, which was Phase 4's way of pinning "monster attach is Phase 5's job." Phase 5b built them,
  // so the criterion has been overtaken; what survives it is `5b-T9` above, which pins the part that
  // is still true — the *locations* strip gains nothing from the monster work.

  // --- R: re-edit ----------------------------------------------------------------------

  it('R1: editing a card writes back into the same slot and never produces a second card', () => {
    store.attachLocation('loc-existing');
    authorLocation('The Chapel');
    const key = locationKeys()[0];

    expect(store.editLocationDraft(key)).toBe(true);
    expect(store.editingLocationKey()).toBe(key);
    expect(store.addLocationForm.controls.name.value).toBe('Ferris Mill');

    store.addLocationForm.controls.name.setValue('Ferris Mill (rebuilt)');
    store.saveLocationDraft();

    expect(names()).toEqual(['Ferris Mill (rebuilt)', 'The Chapel']);
    expect(locationKeys()[0]).toBe(key);
    // The server id survives the round trip, or the submit would create a duplicate entity.
    expect(store.locations()[0].id).toBe('loc-existing');
  });

  it('R2: cancel discards the composer, leaves the roster alone and clears the editing state', () => {
    authorLocation('The Chapel');
    const key = locationKeys()[0];
    store.editLocationDraft(key);
    store.addLocationForm.controls.name.setValue('Something else');

    store.cancelLocationComposer();

    expect(names()).toEqual(['The Chapel']);
    expect(store.editingLocationKey()).toBeNull();
    expect(store.addLocationForm.controls.name.value).toBe('');
  });

  it('R4: Next commits a valid uncommitted composer, then submits', () => {
    store.addLocationForm.setValue({ name: 'The Chapel', description: '', locationTypeId: 'location-type-1' });

    store.next();

    expect(names()).toEqual(['The Chapel']);
    expect(calls.some((call) => call.startsWith('location.create'))).toBe(true);
  });

  it('R4: Next blocks on a started-but-invalid composer, with that phase’s own message and no request', () => {
    store.addLocationForm.setValue({ name: 'Half typed', description: '', locationTypeId: '' });

    store.next();

    expect(store.submitError()).toBe("Finish or clear the location you're editing before continuing.");
    expect(calls).toEqual([]);
    expect(store.currentPhase()).toBe(2);
  });

  it('R4: the bystander phase blocks with its own noun', () => {
    store.currentPhase.set(3);
    store.addBystanderForm.setValue({ name: 'Half typed', description: '', bystanderTypeId: '' });

    store.next();

    expect(store.submitError()).toBe("Finish or clear the bystander you're editing before continuing.");
    expect(calls).toEqual([]);
  });

  it('R5: the composer is open on an empty roster and collapses after a save', () => {
    expect(store.locationComposerOpen()).toBe(true);

    authorLocation('The Chapel');

    expect(store.locationComposerOpen()).toBe(false);
    expect(store.startNewLocationDraft()).toBe(true);
    expect(store.locationComposerOpen()).toBe(true);
  });

  // --- D: the removal contract ---------------------------------------------------------

  it('D1/G3: the variant predicate is the baseline, not the id', () => {
    // An authored draft has no id at all.
    authorLocation('The Chapel');
    expect(store.persistedForRemoval('locations', store.locations()[0].id)).toBe(false);

    // An *attached* draft has an id immediately — and still no membership. This is the case the
    // intuitive `id !== null` predicate gets wrong, by offering Delete for a mis-click.
    store.attachLocation('loc-existing');
    expect(store.locations()[1].id).toBe('loc-existing');
    expect(store.persistedForRemoval('locations', 'loc-existing')).toBe(false);

    // Only a successful submit makes it true.
    submitLocations();
    expect(store.persistedForRemoval('locations', 'loc-existing')).toBe(true);
  });

  it('D1/G3: removing a draft with no persisted membership records nothing and calls nothing', () => {
    authorLocation('The Chapel');
    store.attachLocation('loc-existing');

    store.removeLocationDraft(locationKeys()[0], 'delete');
    store.removeLocationDraft(locationKeys()[0], 'delete');

    expect(store.locations()).toEqual([]);
    expect(store.pendingRemovals()).toEqual([]);

    store.next();

    // The catalogue entity the user attached by mistake is untouched.
    expect(calls.some((call) => call.startsWith('location.delete'))).toBe(false);
    expect(calls.some((call) => call.startsWith('location.unlink'))).toBe(false);
  });

  it('D5: confirming a removal issues no request — it records a disposition', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'delete');

    expect(store.locations()).toEqual([]);
    expect(store.pendingRemovals()).toEqual([{ collection: 'locations', id: 'loc-existing', action: 'delete' }]);
    expect(calls).toEqual([]);
  });

  it('D6: a detach disposition unlinks on submit and never deletes', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'detach');
    store.next();

    // The whole batch, exactly: one unlink and nothing else. `pendingRemovals` owns the removal and
    // `idsToRemove` must not fire a second, racing one for the same id.
    expectLedger(['location.unlink(mystery-1,loc-existing)']);
  });

  it('D7: a delete disposition hard-deletes on submit and does not also unlink', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'delete');
    store.next();

    // The whole batch, exactly. `pendingRemovals` is authoritative; `idsToRemove` is the consistency
    // check, so it must not fire a second, racing removal for the same id.
    expectLedger(['location.delete(loc-existing)']);
  });

  it('D8: confirming and then abandoning the wizard applies nothing', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'delete');

    expect(calls).toEqual([]);
    expect(store.pendingRemovals()).toHaveLength(1);
  });

  it('D9: re-attaching before submit cancels a pending delete — the worst outcome in this feature', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'delete');
    store.attachLocation('loc-existing');

    expect(store.pendingRemovals()).toEqual([]);

    store.next();

    expect(calls.some((call) => call.startsWith('location.delete'))).toBe(false);
    expect(calls).toContain('location.link(mystery-1,loc-existing)');
  });

  it('D9: the same holds for a pending detach', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'detach');
    store.attachLocation('loc-existing');
    store.next();

    expect(calls.some((call) => call.startsWith('location.unlink'))).toBe(false);
  });

  it('D10: a replayed disposition treats 404 as success, so the retry completes', () => {
    // Two on the roster, so something survives the removal for the failing call to attach to —
    // a fan-out where *some* of it landed is the realistic partial failure rule 2 exists for.
    store.attachLocation('loc-existing');
    store.attachLocation('loc-other');
    submitLocations();
    store.removeLocationDraft(locationKeys()[0], 'detach');

    // First attempt: the unlink lands, then a sibling call in the same batch fails the phase.
    locationService['update'].mockReturnValueOnce(throwError(() => new Error('network')));
    store.next();
    expect(calls).toContain('location.unlink(mystery-1,loc-existing)');
    expect(store.submitError()).toBe('Could not save locations. Please try again.');
    expect(store.pendingRemovals()).toHaveLength(1);

    // Second attempt: the membership is already gone, so the replay 404s — and must not fail.
    locationService['unlinkFromMystery'].mockReturnValue(throwError(() => notFound()));
    store.next();

    expect(store.submitError()).toBeNull();
    expect(store.currentPhase()).toBe(3);
    expect(store.pendingRemovals()).toEqual([]);
  });

  it('D11: a successful submit clears the dispositions, so a re-entry replays nothing', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    store.removeLocationDraft(locationKeys()[0], 'delete');
    submitLocations();
    calls.length = 0;

    store.next();

    expect(store.pendingRemovals()).toEqual([]);
    expect(calls.some((call) => call.startsWith('location.delete'))).toBe(false);
    expect(calls.some((call) => call.startsWith('location.unlink'))).toBe(false);
  });

  it('D12: rule 2 is scoped to the removal path — a non-404 failure still fails the phase', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    store.removeLocationDraft(locationKeys()[0], 'delete');

    locationService['delete'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.next();

    expect(store.submitError()).toBe('Could not save locations. Please try again.');
    expect(store.pendingRemovals()).toHaveLength(1);
  });

  it('D12: and it does not reach the link path, where a 404 means the opposite', () => {
    // A 404 on detach means "already not in this mystery" — the requested post-condition. A 404 on
    // link means the thing being linked does not exist, and reporting that as success would claim a
    // membership that was never created (§7.6).
    store.attachLocation('loc-existing');
    locationService['linkToMystery'].mockReturnValue(throwError(() => notFound()));

    store.next();

    expect(store.submitError()).toBe('Could not save locations. Please try again.');
    expect(store.currentPhase()).toBe(2);
  });

  // --- G1: the wizard-scoped drain -----------------------------------------------------

  it('G1: a confirmed removal survives an edit-mode tracker jump and is applied by the next submit', () => {
    // The exact sequence from Peach's G1: Locations → trash → confirm Delete → tracker to
    // Bystanders → Finish. `jumpToPhase` does not submit, so a phase-scoped disposition would be
    // silently discarded and the location would survive a dialog that promised otherwise.
    store.isEditMode.set(true);
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'delete');
    store.jumpToPhase(3);
    expect(store.currentPhase()).toBe(3);
    expect(store.pendingRemovals()).toHaveLength(1);

    store.next();

    expect(calls).toContain('location.delete(loc-existing)');
    expect(store.pendingRemovals()).toEqual([]);
  });

  it('G1: a jump backwards drains too — every phase submit applies the whole list', () => {
    store.isEditMode.set(true);
    store.attachLocation('loc-existing');
    submitLocations();
    calls.length = 0;

    store.removeLocationDraft(locationKeys()[0], 'detach');
    store.jumpToPhase(0);
    store.currentStep.set(4);
    store.next();

    expect(calls).toContain('location.unlink(mystery-1,loc-existing)');
    expect(store.pendingRemovals()).toEqual([]);
  });

  it('G1 bookkeeping: a drain applied elsewhere drops the id from the owning baseline', () => {
    // Otherwise phase 2's own `idsToRemove()` later sees an id in the baseline and not in the
    // drafts and fires a duplicate removal — harmless, because rule 2 swallows the 404, but it is
    // a duplicate request produced by stale state.
    store.isEditMode.set(true);
    store.attachLocation('loc-existing');
    submitLocations();
    expect(store.persistedForRemoval('locations', 'loc-existing')).toBe(true);

    store.removeLocationDraft(locationKeys()[0], 'detach');
    store.jumpToPhase(3);
    store.next();
    calls.length = 0;

    expect(store.persistedForRemoval('locations', 'loc-existing')).toBe(false);

    store.currentPhase.set(2);
    store.currentStep.set(0);
    store.next();

    expect(calls.some((call) => call.startsWith('location.unlink'))).toBe(false);
    expect(calls.some((call) => call.startsWith('location.delete'))).toBe(false);
  });

  it('§7.6: a deleted entity stops being offered by the attach picker', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    store.removeLocationDraft(locationKeys()[0], 'delete');

    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-existing', 'loc-other']);

    store.next();

    // Without this, a `Back` re-offers a row that no longer exists, and attaching it fails the whole
    // phase on a link 404 that rule 2 deliberately does not cover.
    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-other']);
  });

  it('§7.6: a detached entity is still offered, because it still exists', () => {
    store.attachLocation('loc-existing');
    submitLocations();
    store.removeLocationDraft(locationKeys()[0], 'detach');
    store.next();

    expect(store.attachableLocations().map((item) => item.id)).toEqual(['loc-existing', 'loc-other']);
  });

  // --- bystanders: the same contract, one noun over -------------------------------------

  it('the bystander phase carries the same attach and disposition contract', () => {
    store.currentPhase.set(3);
    store.attachBystander('bys-existing');

    expect(store.bystanders().map((draft) => draft.name)).toEqual(['Sheriff Dalton']);
    expect(store.attachableBystanders()).toEqual([]);
    expect(calls).toEqual([]);

    store.next();
    expect(calls).toContain('bystander.link(mystery-1,bys-existing)');

    store.currentPhase.set(3);
    store.currentStep.set(0);
    store.removeBystanderDraft(store.bystanders()[0].localKey, 'detach');
    expect(store.pendingRemovals()).toEqual([
      { collection: 'bystanders', id: 'bys-existing', action: 'detach' },
    ]);

    calls.length = 0;
    store.next();
    expect(calls).toContain('bystander.unlink(mystery-1,bys-existing)');
  });

  // --- G2: the deferral clause ----------------------------------------------------------

  it('G2: the deferral clause names Finish on the last phase and the next step everywhere else', () => {
    store.currentPhase.set(2);
    expect(store.deferredChangeTail()).toBe('when you continue to the next step');

    store.currentPhase.set(store.lastPhaseIndex);
    expect(store.deferredChangeTail()).toBe('when you press Finish');

    // Phase 1 is never last, so the minion note's shipped wording is unchanged by the branch.
    store.currentPhase.set(1);
    expect(store.deferredChangeTail()).toBe('when you continue to the next step');
  });
});
