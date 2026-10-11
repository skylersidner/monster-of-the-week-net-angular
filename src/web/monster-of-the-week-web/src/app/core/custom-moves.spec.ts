import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { CustomMoveOwnerType, UpsertCustomMoveRequest } from './models';
import { MysteryService } from './mystery';
import { resourceImagesPath } from './resource-images';
import { CustomMoveService, createCustomMoveDraftKey, customMovesPath } from './custom-moves';

/**
 * `core/custom-moves.ts` — Phase 4 of `docs/domain-custom-moves/architecture.md` (§27, §31.1).
 *
 * The one client service for all five owner types. Three things are worth asserting here and the
 * third is the only one that cannot rot:
 *
 *  1. **The URL, verb and body of all four methods, for all five owners** — a 4 × 5 table, twenty
 *     requests, rather than four. A segment typo must not be able to hide behind a method that
 *     happens to have been checked with a different owner.
 *  2. **`SUPPRESS_ERROR_TOAST` on every one of those twenty.** Not theoretical: Phase A's browser
 *     work measured the interceptor's raw `"Request failed (500) for PUT /api/monsters/{guid}"`
 *     toast firing beside the page's own message on the four existing sub-resource types, which
 *     omit this token. 14-R3 / F-R2.
 *  3. **The five segments, derived rather than transcribed.** See the block below.
 */

const OWNERS: readonly CustomMoveOwnerType[] = ['Mystery', 'Monster', 'Minion', 'Location', 'Bystander'];

/** Deliberately not a GUID: these never reach a server, and a readable id makes a failure legible. */
const OWNER_ID = 'owner-1';
const MOVE_ID = 'move-1';
const body: UpsertCustomMoveRequest = { name: 'Reach Through', description: 'On a 10+, choose two.' };

describe('customMovesPath', () => {
  /**
   * The five literal paths. These document the contract legibly — they are what a reader checks
   * against Swagger — but they are **not the guard**: five human-typed strings compared against
   * five human-typed strings is the shape `confirm-delete-modal.call-sites.spec.ts` records as
   * having rotted ("a written-down N needs something derived to check it against"). The derived
   * assertions below are the guard.
   */
  it('maps each owner type to its controller segment', () => {
    expect(customMovesPath('Mystery', 'm1')).toBe('/api/mysteries/m1/custom-moves');
    expect(customMovesPath('Monster', 'mo1')).toBe('/api/monsters/mo1/custom-moves');
    expect(customMovesPath('Minion', 'mn1')).toBe('/api/minions/mn1/custom-moves');
    expect(customMovesPath('Location', 'l1')).toBe('/api/locations/l1/custom-moves');
    expect(customMovesPath('Bystander', 'b1')).toBe('/api/bystanders/b1/custom-moves');
  });

  /**
   * **The guard, and it transcribes nothing** (architecture.md §26.2 L11).
   *
   * A wrong segment is rejected by the route constraint before any application code runs, so the
   * client gets a 404 with no body — diagnosable from the network tab, but on a create page it
   * surfaces only as the hedged "some details may not have saved" caveat, which is *true*. So the
   * typo hides exactly where it costs most, and a spec that re-types the five strings cannot see it.
   *
   * Four of the five are free, because the images feature already ships and works in production
   * against the same four controller segments: `resourceImagesPath` is a **live-proven** map, and
   * it is exported, so the segments can be read back out of it rather than written down again.
   */
  it('agrees with the shipped resource-images segments on all four shared owner types', () => {
    const segmentOf = (path: string): string => path.split('/')[2];

    for (const owner of ['Monster', 'Minion', 'Bystander', 'Location'] as const) {
      expect(
        segmentOf(customMovesPath(owner, OWNER_ID)),
        `${owner}: segment disagrees with the shipped resource-images segment`
      ).toBe(segmentOf(resourceImagesPath(owner, OWNER_ID)));
    }
  });

  /**
   * And the fifth, which has no images twin, derived from `MysteryService`'s own shipped URL rather
   * than from a literal — read off the wire through `HttpTestingController` so that the thing being
   * compared is the string the application actually sends when it loads a mystery.
   */
  it('nests the mystery segment under the same path MysteryService already uses', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const mysteryService = TestBed.inject(MysteryService);
    const http = TestBed.inject(HttpTestingController);

    mysteryService.getMystery(OWNER_ID).subscribe();
    const shipped = http.expectOne((request) => request.method === 'GET').request.url;

    expect(shipped).toBe(`/api/mysteries/${OWNER_ID}`);
    expect(customMovesPath('Mystery', OWNER_ID)).toBe(`${shipped}/custom-moves`);

    http.verify();
  });
});

describe('CustomMoveService', () => {
  let service: CustomMoveService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomMoveService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * The 4 × 5 table. `request` is what each method should put on the wire for a given owner; the
   * loop below asserts method, URL, body and the context token for all twenty.
   *
   * `list` is in here and gets exactly this much and no more: URL, verb and token are properties of
   * the builder and are worth pinning the moment it exists, but it has no behaviour to cover until
   * 5f-3 supplies its caller (L-D3). A spec asserting it returns what the backend sent would be
   * covering `ApiService`. §30.5's gate is what closes that, not this file.
   */
  const methods: readonly {
    readonly name: 'list' | 'create' | 'update' | 'delete';
    readonly verb: string;
    readonly call: (owner: CustomMoveOwnerType) => void;
    readonly url: (owner: CustomMoveOwnerType) => string;
    readonly body: unknown;
  }[] = [
    {
      name: 'list',
      verb: 'GET',
      call: (owner) => service.list(owner, OWNER_ID).subscribe(),
      url: (owner) => customMovesPath(owner, OWNER_ID),
      body: null,
    },
    {
      name: 'create',
      verb: 'POST',
      call: (owner) => service.create(owner, OWNER_ID, body).subscribe(),
      url: (owner) => customMovesPath(owner, OWNER_ID),
      body,
    },
    {
      name: 'update',
      verb: 'PUT',
      call: (owner) => service.update(owner, OWNER_ID, MOVE_ID, body).subscribe(),
      url: (owner) => `${customMovesPath(owner, OWNER_ID)}/${MOVE_ID}`,
      body,
    },
    {
      name: 'delete',
      verb: 'DELETE',
      call: (owner) => service.delete(owner, OWNER_ID, MOVE_ID).subscribe(),
      url: (owner) => `${customMovesPath(owner, OWNER_ID)}/${MOVE_ID}`,
      body: null,
    },
  ];

  for (const { name, verb, call, url, body: expectedBody } of methods) {
    for (const owner of OWNERS) {
      it(`${name}() issues ${verb} against the ${owner} segment, with the generic toast suppressed`, () => {
        call(owner);

        const request = http.expectOne(url(owner));
        expect(request.request.method).toBe(verb);
        expect(request.request.body).toEqual(expectedBody);
        // The whole point of the token. A dropped one is invisible in review and loud in use.
        expect(request.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);

        request.flush(name === 'delete' ? null : { id: MOVE_ID, ...body });
      });
    }
  }

  /**
   * Guards the table above against going vacuous: twenty is the number of cases it claims to
   * generate, and a `methods` entry silently dropped (or an `OWNERS` member removed) would shrink
   * it with every remaining case still green.
   */
  it('covers all four methods against all five owners — twenty requests, not four', () => {
    expect(methods).toHaveLength(4);
    expect(OWNERS).toHaveLength(5);
    expect(methods.length * OWNERS.length).toBe(20);
  });

  /**
   * `POST` answers `200` and not `201`, and `DELETE` answers `204` — the server's shipped codes,
   * measured against the running API. Asserted here so the client is on record as tolerating them:
   * a `create` that only worked on `201`, or a `delete` that treated `204` as a failure, would both
   * be the kind of thing that passes a URL test and breaks in use.
   */
  it('accepts the shipped status codes: 200 from POST, 204 from DELETE', () => {
    let created: { id: string } | undefined;
    let deleted = false;

    service.create('Monster', OWNER_ID, body).subscribe((move) => (created = move));
    http.expectOne(customMovesPath('Monster', OWNER_ID)).flush({ id: MOVE_ID, ...body }, { status: 200, statusText: 'OK' });

    service.delete('Monster', OWNER_ID, MOVE_ID).subscribe(() => (deleted = true));
    http
      .expectOne(`${customMovesPath('Monster', OWNER_ID)}/${MOVE_ID}`)
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(created).toEqual({ id: MOVE_ID, ...body });
    expect(deleted).toBe(true);
  });

  /**
   * A failure reaches the caller as an error rather than being swallowed. `SUPPRESS_ERROR_TOAST`
   * silences the *interceptor's* toast only — if it also hid the error from the caller, every host
   * would silently report success on a failed write, which is the opposite of the intent.
   */
  it('still surfaces failures to the caller, having only suppressed the toast', () => {
    const statuses: number[] = [];

    service.create('Mystery', OWNER_ID, body).subscribe({ error: (error) => statuses.push(error.status) });
    http.expectOne(customMovesPath('Mystery', OWNER_ID)).flush(null, { status: 500, statusText: 'Server Error' });

    service.delete('Bystander', OWNER_ID, MOVE_ID).subscribe({ error: (error) => statuses.push(error.status) });
    http
      .expectOne(`${customMovesPath('Bystander', OWNER_ID)}/${MOVE_ID}`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(statuses).toEqual([500, 404]);
  });
});

describe('createCustomMoveDraftKey', () => {
  it('mints distinct, prefixed keys', () => {
    const keys = [createCustomMoveDraftKey(), createCustomMoveDraftKey(), createCustomMoveDraftKey()];

    expect(new Set(keys).size).toBe(3);
    for (const key of keys) {
      expect(key).toMatch(/^move-\d+$/);
    }
  });
});
