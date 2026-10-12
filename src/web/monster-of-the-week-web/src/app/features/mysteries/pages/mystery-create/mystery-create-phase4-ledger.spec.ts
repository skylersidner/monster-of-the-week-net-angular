import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, defer, of, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { BystanderService } from '../../../../core/bystander';
import { LocationService } from '../../../../core/location';
import { MinionService } from '../../../../core/minion';
import { MonsterService } from '../../../../core/monster';
import { MysteryService } from '../../../../core/mystery';
import { NotificationService } from '../../../../core/notifications';
import { ReferenceDataService } from '../../../../core/reference-data';
import { MysteryCreateStore } from './mystery-create.store';

/**
 * **What a phase submit sends — the whole of it, as an ordered-insensitive exact set.**
 *
 * `mystery-create-phase4.store.spec.ts` asserts the same flows with `toContain` and
 * `some(...).toBe(false)`. That shape has a known blind spot, and Phase 4 already produced the bug
 * that lives in it: a confirmed **Delete** used to issue *two* calls for one removal — the drain's
 * `DELETE /api/locations/{id}` and `idsToRemove()`'s blind `DELETE /api/mysteries/{m}/locations/{id}`
 * — racing in one `forkJoin`, with the unlink liable to 404 against the row the delete had just
 * destroyed and fail the whole phase. It was caught only because D7 happened to be written as
 * *"delete is issued **and** unlink is not."*
 *
 * **Its twin was not protected.** D6 (detach) asserts `toContain('location.unlink(…)')` and that no
 * delete went out — both of which stay true if the unlink is issued *twice*, which is precisely
 * what the same `idsToRemove()` regression would do on the detach path. And a duplicate unlink is
 * worse than a duplicate delete: the drain's copy maps 404 to success (§7.3 rule 2) but the diff's
 * copy does not, so the second one 404s and fails the phase with the generic error band.
 *
 * So this file asserts the **complete** ledger for every flow where two calls could be issued for
 * one intention. A duplicate of anything, or a call for an entity the flow should not have touched,
 * fails here by construction rather than by someone having remembered to write the negative half.
 *
 * **Recorded at subscribe, not at method call.** `HttpClient` is cold — a request is not sent until
 * something subscribes — so a ledger written when the service method is *invoked* over-counts a
 * request that was built and dropped. `defer()` moves the record to the honest moment, which also
 * makes the partial-failure characterisation (S3) mean what it says.
 */

const CATALOGUE_LOCATIONS = [
  {
    id: 'loc-a',
    mysteryIds: ['mystery-9', 'mystery-8'],
    name: 'Ferris Mill',
    description: 'Rust and river damp.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-b',
    mysteryIds: [],
    name: 'The Diner',
    description: 'Coffee and fluorescent hum.',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-c',
    mysteryIds: [],
    name: 'The Chapel',
    description: '',
    locationTypeId: 'location-type-1',
    locationTypeName: 'Lair',
    locationTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const CATALOGUE_BYSTANDERS = [
  {
    id: 'bys-a',
    mysteryIds: ['mystery-9'],
    name: 'Sheriff Dalton',
    description: 'Tired and stubborn.',
    bystanderTypeId: 'bystander-type-1',
    bystanderTypeName: 'Witness',
    bystanderTypeMotivation: '',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('The wizard’s phase submit — the complete request ledger', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let locationService: Record<string, ReturnType<typeof vi.fn>>;
  let bystanderService: Record<string, ReturnType<typeof vi.fn>>;

  /**
   * `[a, b]` and `[b, a]` are the same batch — `forkJoin` gives no order guarantee worth asserting,
   * so both sides are sorted. **Multiplicity is not sorted away**, which is the whole point: a
   * duplicate stays a second element and still fails the comparison.
   */
  const expectLedger = (expected: string[]): void => expect([...sent].sort()).toEqual([...expected].sort());

  beforeEach(() => {
    sent = [];

    const describeArg = (arg: unknown): string =>
      typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg);

    /** Records at *subscribe*, which is when `HttpClient` would actually put a request on the wire. */
    const record = <T>(name: string, result: () => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          sent.push(`${name}(${args.map(describeArg).join(',')})`);
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

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        {
          provide: MysteryService,
          useValue: {
            create: vi.fn(() => of({ id: 'mystery-1' })),
            update: vi.fn(() => of({ id: 'mystery-1' })),
            upsertCountdown: record('mystery.countdown', () => of({ id: 'countdown-1' })),
            getMysteries: vi.fn(() =>
              of([
                { id: 'mystery-1', name: 'The Hollow Choir' },
                { id: 'mystery-9', name: 'Dust Bowl Nights' },
                { id: 'mystery-8', name: 'The Long Drive Home' },
              ]),
            ),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: record('monster.create', () => of({ id: 'monster-1' })) } },
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
    store.isEditMode.set(true);
    store.currentPhase.set(2);
    store.currentStep.set(0);
    sent.length = 0;
  });

  const keyOf = (name: string): string =>
    store.locations().find((draft) => draft.name === name)?.localKey ?? `no draft named ${name}`;

  /** Submits the locations phase and puts the wizard back on it, as `Back` would. */
  function submitLocations(): void {
    store.next();
    store.currentPhase.set(2);
    store.currentStep.set(0);
  }

  /**
   * The payload `submitPhase2` actually builds. Note the empty description arrives as `null`, not
   * `''` — `toNullable` normalises it on the way out, which is worth having spelled out in a test
   * that claims to assert byte-for-byte values.
   */
  const update = (id: string, name: string, description: string): string =>
    `location.update(${id},${JSON.stringify({
      name,
      description: description === '' ? null : description,
      locationTypeId: 'location-type-1',
    })})`;

  // --- attach ----------------------------------------------------------------------------

  it('A5/A6: attaching and pressing Next sends the membership PUT and the value PUT, and nothing else', () => {
    store.attachLocation('loc-a');

    store.next();

    // A6 is a *value* assertion on purpose (§14.4): a no-op PUT of identical values is expected and
    // correct in Phase 4, so the criterion is "the fields are what they were", never "no PUT went
    // out". The payload is spelled out here rather than probed, so a field dropped in hydration
    // fails as a diff instead of as a silently narrower object.
    expectLedger([update('loc-a', 'Ferris Mill', 'Rust and river damp.'), 'location.link(mystery-1,loc-a)']);
  });

  it('A5: attaching two and pressing Next links both — once each, with no create for either', () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');

    store.next();

    expectLedger([
      'location.link(mystery-1,loc-a)',
      'location.link(mystery-1,loc-b)',
      update('loc-a', 'Ferris Mill', 'Rust and river damp.'),
      update('loc-b', 'The Diner', 'Coffee and fluorescent hum.'),
    ]);
  });

  it('A2/G3: attaching and then trashing it before Next sends nothing at all', () => {
    store.attachLocation('loc-a');
    store.removeLocationDraft(keyOf('Ferris Mill'), 'delete');

    store.next();

    // Not "no delete" — *nothing*. A stray unlink here would be a `DELETE` against a membership
    // that was never created, which 404s outside the drain's rule-2 catch and fails the phase.
    expectLedger([]);
  });

  // --- removal ---------------------------------------------------------------------------

  it('D6: a confirmed Detach sends exactly one unlink — the twin the delete bug would also have had', () => {
    store.attachLocation('loc-a');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('Ferris Mill'), 'detach');
    store.next();

    // One. `toContain` cannot tell one from two, and two is exactly what a regression of
    // `idsToRemove`'s disposition exclusion produces on this path — the drain's unlink plus the
    // diff's, the second of which 404s *without* rule 2's catch and fails the whole phase.
    expectLedger(['location.unlink(mystery-1,loc-a)']);
  });

  it('D7: a confirmed Delete sends exactly one delete and no unlink', () => {
    store.attachLocation('loc-a');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('Ferris Mill'), 'delete');
    store.next();

    expectLedger(['location.delete(loc-a)']);
  });

  it('D9: re-attaching a pending Delete before Next cancels it — and re-links rather than half-doing both', () => {
    store.attachLocation('loc-a');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('Ferris Mill'), 'delete');
    store.attachLocation('loc-a');
    store.next();

    expectLedger([update('loc-a', 'Ferris Mill', 'Rust and river damp.'), 'location.link(mystery-1,loc-a)']);
  });

  it('a mixed roster sends one call per intention: keep, author, detach, delete', () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');
    store.attachLocation('loc-c');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('The Diner'), 'detach');
    store.removeLocationDraft(keyOf('The Chapel'), 'delete');
    store.addLocationForm.setValue({ name: 'The Bridge', description: '', locationTypeId: 'location-type-1' });
    store.saveLocationDraft();

    store.next();

    expectLedger([
      'location.create(mystery-1,{"name":"The Bridge","description":null,"locationTypeId":"location-type-1"})',
      'location.delete(loc-c)',
      'location.link(mystery-1,loc-a)',
      'location.unlink(mystery-1,loc-b)',
      update('loc-a', 'Ferris Mill', 'Rust and river damp.'),
    ]);
  });

  it('G1: the tracker-jump drain sends the delete once, from the phase that did not record it', () => {
    store.attachLocation('loc-a');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('Ferris Mill'), 'delete');
    store.jumpToPhase(3);
    store.next();

    // Phase 3's own submit is an empty bystander roster, so the whole ledger is the drained
    // removal — issued once, by a phase that owns neither the collection nor the disposition.
    expectLedger(['location.delete(loc-a)']);
    expect(store.pendingRemovals()).toEqual([]);
  });

  it('G1: and a jump *backwards* drains it from the mystery phase, still exactly once', () => {
    store.attachLocation('loc-a');
    submitLocations();
    sent.length = 0;

    store.removeLocationDraft(keyOf('Ferris Mill'), 'detach');
    store.jumpToPhase(0);
    store.currentStep.set(4);
    store.next();

    // The mystery phase's own submit is one countdown upsert; the unlink rides along with it.
    expectLedger([
      'mystery.countdown(mystery-1,{"day":null,"shadows":null,"sunset":null,"dusk":null,"nightfall":null,"midnight":null})',
      'location.unlink(mystery-1,loc-a)',
    ]);
  });

  it('D11: after a successful drain, re-entering the phase replays no removal', () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');
    submitLocations();

    store.removeLocationDraft(keyOf('Ferris Mill'), 'delete');
    submitLocations();
    sent.length = 0;

    store.next();

    // The baseline lost `loc-a` with the drain, so the diff has nothing to re-fire and the only
    // traffic is the surviving row's own no-op pair.
    expectLedger([update('loc-b', 'The Diner', 'Coffee and fluorescent hum.'), 'location.link(mystery-1,loc-b)']);
  });

  it('a bystander disposition drained by the locations phase is sent once, and not again by its own phase', () => {
    store.attachLocation('loc-a');
    store.attachBystander('bys-a');
    submitLocations();
    store.currentPhase.set(3);
    store.next();
    store.currentPhase.set(3);
    store.currentStep.set(0);
    sent.length = 0;

    const bystanderKey = store.bystanders()[0].localKey;
    store.removeBystanderDraft(bystanderKey, 'detach');
    store.currentPhase.set(2);
    store.currentStep.set(0);

    // The locations phase drains the *bystander* removal — that is decision 15's whole point.
    store.next();
    expectLedger([
      'bystander.unlink(mystery-1,bys-a)',
      update('loc-a', 'Ferris Mill', 'Rust and river damp.'),
      'location.link(mystery-1,loc-a)',
    ].sort());

    // And the owning phase does not re-send it, because the drain pruned its baseline too.
    sent.length = 0;
    store.currentPhase.set(3);
    store.currentStep.set(0);
    store.next();
    expectLedger([]);
  });

  // --- the accepted states, characterised rather than merely absent -----------------------

  it('S2: the submit writes back the values loaded at attach, clobbering an edit made elsewhere', () => {
    store.attachLocation('loc-a');

    // Somebody renames it from the location's own detail page while the wizard sits open. The
    // wizard never re-reads, so its draft still holds the page-load snapshot.
    CATALOGUE_LOCATIONS[0].name = 'Ferris Mill (renamed elsewhere)';
    try {
      store.next();

      // Accepted, deliberately not engineered against (§5.1, S2): single-user tool, pre-existing
      // for edit-mode revisits. Asserted so the day it stops being acceptable, this test is the
      // one that has to be changed on purpose.
      expectLedger([update('loc-a', 'Ferris Mill', 'Rust and river damp.'), 'location.link(mystery-1,loc-a)']);
    } finally {
      CATALOGUE_LOCATIONS[0].name = 'Ferris Mill';
    }
  });

  it('S4: every persisted draft is written on every transition, touched or not — three rows, six calls', () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');
    store.attachLocation('loc-c');
    submitLocations();
    sent.length = 0;

    store.next();

    // Write amplification, expected in Phase 4 and shipped behaviour today; the derived dirty check
    // that suppresses it is Phase 5 and monsters-only (decision 9). For flat entities the cost is
    // one no-op PUT per row, which is why it was not worth a mechanism. Pinned at N=3 so the ratio
    // is visible: the day someone adds the dirty check here, this is the test that says so.
    expectLedger([
      'location.link(mystery-1,loc-a)',
      'location.link(mystery-1,loc-b)',
      'location.link(mystery-1,loc-c)',
      update('loc-a', 'Ferris Mill', 'Rust and river damp.'),
      update('loc-b', 'The Diner', 'Coffee and fluorescent hum.'),
      update('loc-c', 'The Chapel', ''),
    ]);
  });

  it('S5: detaching the only membership leaves the entity attachable again, not cleaned up', () => {
    store.attachLocation('loc-b');
    submitLocations();

    store.removeLocationDraft(keyOf('The Diner'), 'detach');
    submitLocations();

    // A catalogue entity in no mystery is a first-class state — the same one standalone creation
    // produces — so the picker must still offer it. Contrast §7.6: a *deleted* one is dropped.
    expect(store.attachableLocations().map((item) => item.id)).toContain('loc-b');
    expect(store.persistedForRemoval('locations', 'loc-b')).toBe(false);
  });

  it('S1: a stale mysteryIds snapshot changes the modal’s wording and never which buttons it has', () => {
    store.attachLocation('loc-a');
    submitLocations();

    // `mysteryIds` is a page-load snapshot (§7.2). Go as stale as it can go — emptied entirely —
    // and the predicate that picks the variant is untouched, because it reads the baseline, not
    // this field. That is why S1 is accepted: there is no branch to get wrong.
    store.locations.update((items) => items.map((item) => ({ ...item, mysteryIds: [] })));

    expect(store.persistedForRemoval('locations', 'loc-a')).toBe(true);
  });

  it('R5: attaching onto an empty roster collapses an untouched composer', () => {
    // Was a characterised deviation: `attachLocation` did not re-derive composer-open, so in create
    // mode the first attach left a non-empty roster *and* an open "Add a Location" composer — two
    // live "add" affordances at once. §15.2 makes attach re-derive it.
    expect(store.locations()).toEqual([]);
    expect(store.locationComposerOpen()).toBe(true);

    store.attachLocation('loc-a');

    expect(store.locations()).toHaveLength(1);
    expect(store.locationComposerOpen()).toBe(false);
  });

  it('R5: but a *dirty* composer survives the attach untouched — work outranks the tidiness rule', () => {
    // The flow that makes the naive fix worse than the bug: start typing "the old mill", realise you
    // already made one, pick it from the strip. Collapsing would silently discard what was typed,
    // which breaks the rule the composer has followed since the minion work — nothing discards its
    // contents implicitly (§15.2).
    store.addLocationForm.controls.name.setValue('the old mill');
    expect(store.locationComposerDirty()).toBe(true);

    store.attachLocation('loc-a');

    expect(store.locationComposerOpen()).toBe(true);
    expect(store.addLocationForm.controls.name.value).toBe('the old mill');
  });

  it('R5: a half-filled composer counts as dirty, not just a valid one', () => {
    // The dirtiness test is the one the composer already owns for `Next`, so "started but not
    // saveable" is protected too — which is the case most likely to be lost.
    store.addLocationForm.controls.locationTypeId.setValue('location-type-1');
    expect(store.addLocationForm.invalid).toBe(true);
    expect(store.locationComposerDirty()).toBe(true);

    store.attachLocation('loc-a');

    expect(store.locationComposerOpen()).toBe(true);
  });

  it('R5: attach only ever collapses — it never opens a composer that was closed', () => {
    store.attachLocation('loc-a');
    expect(store.locationComposerOpen()).toBe(false);

    store.attachLocation('loc-b');
    expect(store.locationComposerOpen()).toBe(false);
    expect(store.locations()).toHaveLength(2);

    // And not even when the collapsed composer is somehow holding something. "Re-derive open from
    // dirtiness" is the tempting one-liner and it is wrong in this direction: attaching must never
    // surface a panel the user had closed.
    store.addLocationForm.controls.name.setValue('stray text');
    expect(store.locationComposerDirty()).toBe(true);

    store.attachLocation('loc-c');

    expect(store.locationComposerOpen()).toBe(false);
  });

  // --- the invariant the baseline diff now rests on ---------------------------------------

  it('every removal of a persisted draft records a disposition — the diff can no longer be the one that fires', () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');
    submitLocations();

    store.removeLocationDraft(keyOf('Ferris Mill'), 'detach');
    store.removeLocationDraft(keyOf('The Diner'), 'delete');

    // With `pendingRemovals` authoritative and `idsToRemove()` excluding anything it has a
    // disposition for, the baseline diff is now unreachable for these two collections: every
    // persisted draft that leaves the roster leaves a record behind. That is what §7.3 asked for —
    // but it also means the diff is no longer a safety net, so *this* invariant is the safety net.
    // A future path that splices a persisted draft out without recording one would leave the
    // entity silently linked, and this is the test that would notice.
    expect(store.pendingRemovals()).toEqual([
      { collection: 'locations', id: 'loc-a', action: 'detach' },
      { collection: 'locations', id: 'loc-b', action: 'delete' },
    ]);
  });
});

/**
 * S3, which needs requests that fail *after* their siblings have gone out. Everything above is
 * synchronous, where a `forkJoin` source that errors on subscribe stops its later siblings from
 * ever being subscribed — an artifact of the stubs, not of the wizard. One asynchronous failure
 * reproduces the real shape: the whole fan-out is on the wire, and then one of them comes back bad.
 */
describe('The wizard’s phase submit — S3, a fan-out failure is never "none of it landed"', () => {
  let store: MysteryCreateStore;
  let sent: string[];
  let failUpdatesFor: Set<string>;
  /** Membership rows the fake server holds. An unlink of something absent is a 404, as it is in real life. */
  let memberships: Set<string>;

  beforeEach(() => {
    sent = [];
    failUpdatesFor = new Set();
    memberships = new Set();

    const record = <T>(name: string, result: (args: unknown[]) => Observable<T>) =>
      vi.fn((...args: unknown[]) =>
        defer(() => {
          sent.push(`${name}(${args.join(',')})`);
          return result(args);
        }),
      );

    const locationService = {
      getAll: vi.fn(() => of(CATALOGUE_LOCATIONS)),
      create: record('location.create', () => of({ id: 'loc-created' })),
      update: record('location.update', (args) =>
        failUpdatesFor.has(args[0] as string)
          ? // Asynchronous on purpose: the siblings subscribe first, exactly as real requests are
            // all dispatched before any of them answers.
            timer(0).pipe(switchMap(() => throwError(() => new HttpErrorResponse({ status: 500 }))))
          : of({ id: 'loc-updated' }),
      ),
      linkToMystery: record('location.link', (args) => {
        memberships.add(String(args[1]));
        return of(undefined);
      }),
      // The asymmetry Phase 1 pinned: `PUT` on an existing membership is 204, but `DELETE` on an
      // absent one is **404**. That is what makes a replayed detach need rule 2 rather than merely
      // tolerate it, so the fake has to reproduce it or D10 proves nothing.
      unlinkFromMystery: record('location.unlink', (args) =>
        memberships.delete(String(args[1]))
          ? of(undefined)
          : throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
      ),
      delete: record('location.delete', () => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        MysteryCreateStore,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        {
          provide: MysteryService,
          useValue: {
            create: vi.fn(() => of({ id: 'mystery-1' })),
            update: vi.fn(() => of({ id: 'mystery-1' })),
            upsertCountdown: vi.fn(() => of({ id: 'countdown-1' })),
            getMysteries: vi.fn(() => of([{ id: 'mystery-1', name: 'The Hollow Choir' }])),
          },
        },
        { provide: MonsterService, useValue: { getAll: () => of([]), create: vi.fn(() => of({ id: 'monster-1' })) } },
        { provide: MinionService, useValue: {} },
        { provide: LocationService, useValue: locationService },
        {
          provide: BystanderService,
          useValue: {
            getAll: vi.fn(() => of(CATALOGUE_BYSTANDERS)),
            create: vi.fn(() => of({ id: 'bys-created' })),
            update: vi.fn(() => of({ id: 'bys-updated' })),
            linkToMystery: vi.fn(() => of(undefined)),
            unlinkFromMystery: vi.fn(() => of(undefined)),
            delete: vi.fn(() => of(undefined)),
          },
        },
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
    store.isEditMode.set(true);
    store.currentPhase.set(2);
    store.currentStep.set(0);
    sent.length = 0;
  });

  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

  it('the removal lands, the phase still fails, and pressing Next again completes it (D10 · S3)', async () => {
    store.attachLocation('loc-a');
    store.attachLocation('loc-b');
    store.next();
    await flush();
    store.currentPhase.set(2);
    store.currentStep.set(0);

    const key = store.locations().find((draft) => draft.id === 'loc-a')!.localKey;
    store.removeLocationDraft(key, 'detach');
    failUpdatesFor.add('loc-b');
    sent.length = 0;

    store.next();
    await flush();

    // S3: "it failed" does not mean "none of it landed". The unlink was dispatched and the fake
    // server applied it — it is only the sibling PUT that failed.
    expect(sent).toContain('location.unlink(mystery-1,loc-a)');
    expect(memberships.has('loc-a')).toBe(false);
    expect(store.submitError()).toBe('Could not save locations. Please try again.');
    expect(store.currentPhase()).toBe(2);

    // …and the disposition survives, because only a successful submit clears it. Which is the
    // reason rule 2 has to exist: the retry replays a detach whose membership is already gone.
    expect(store.pendingRemovals()).toEqual([{ collection: 'locations', id: 'loc-a', action: 'detach' }]);

    // D10: the replayed detach hits a membership that is already gone, so the fake server answers
    // 404 — rule 2 maps it to success and the phase completes. This is the case rule 1 cannot
    // cover, and it is the reason rule 2 exists.
    failUpdatesFor.clear();
    sent.length = 0;
    store.next();
    await flush();

    expect(sent).toContain('location.unlink(mystery-1,loc-a)');
    expect(store.submitError()).toBeNull();
    expect(store.currentPhase()).toBe(3);
    expect(store.pendingRemovals()).toEqual([]);
  });
});
