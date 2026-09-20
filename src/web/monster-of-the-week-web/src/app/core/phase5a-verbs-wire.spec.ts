import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { MinionService } from './minion';
import { MonsterService } from './monster';

/**
 * **The verbs Phase 5a adds, pinned to their URL and method.**
 *
 * Same argument as `mystery-membership-wire.spec.ts`: the wizard's share of 5a is asserted against
 * mocked services (`mystery-create-phase5a-ledger.spec.ts` says "exactly one `updateAttack`"), and
 * the server's share is asserted against a real host. Composing the two is only sound if the method
 * the store calls produces the URL and method the controller routes. Every other spec in this app
 * mocks these wholesale, so a transposed pair of ids or a singular path segment would be invisible
 * everywhere and would surface only as a 404 in a browser.
 *
 * The literals are written out by hand, to read as a contract rather than a restatement of the
 * implementation.
 */
describe('The Phase 5a verbs, on the wire', () => {
  let http: HttpTestingController;
  const base = environment.apiBaseUrl.replace(/\/$/, '');

  const OWNER = 'a1000000-0000-4000-8000-000000000001';
  const ROW = 'a1000000-0000-4000-8000-000000000002';
  const TAG = 'a1000000-0000-4000-8000-000000000003';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('the minion re-parent verb (5a-P1, 5a-P5)', () => {
    it('moveToMonster is a PUT at the parent-scoped URI, with a null body', () => {
      TestBed.inject(MinionService).moveToMonster(OWNER, ROW).subscribe();

      const request = http.expectOne(`${base}/api/monsters/${OWNER}/minions/${ROW}`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toBeNull();
      request.flush(null, { status: 204, statusText: 'No Content' });
    });

    /**
     * **5a-P5, the frontend half.** The re-parent is a *dedicated verb*, not a field on the minion
     * `PUT` (architecture §6.4). Both documents originally assumed `PUT /api/minions/{id}` could
     * move a minion, and it cannot. This pins the shape of the request that does not: no
     * `monsterId` goes out on it, so a future "just add the field" would fail here rather than
     * silently doing nothing on the server.
     */
    it('a plain update carries no monsterId and does not touch the parent URI', () => {
      TestBed.inject(MinionService)
        .update(ROW, { name: 'Choir Thrall', description: null, harmCapacity: 3, minionTypeId: OWNER })
        .subscribe();

      const request = http.expectOne(`${base}/api/minions/${ROW}`);
      expect(request.request.method).toBe('PUT');
      expect(Object.keys(request.request.body as object)).toEqual([
        'name',
        'description',
        'harmCapacity',
        'minionTypeId',
      ]);
      request.flush({ id: ROW });
    });
  });

  /**
   * The updaters the diff needs. Before 5a the wizard could only create and delete a sub-resource,
   * which is why every submit deleted the lot and recreated it; five of these six methods did not
   * exist on `MonsterService` at all.
   */
  describe('the sub-resource updaters (5a-U3)', () => {
    const cases: { name: string; call: () => void; url: string }[] = [
      {
        name: 'monster attack',
        call: () =>
          TestBed.inject(MonsterService)
            .updateAttack(OWNER, ROW, { name: 'Baton Lash', description: null, harm: 2 })
            .subscribe(),
        url: `${base}/api/monsters/${OWNER}/attacks/${ROW}`,
      },
      {
        name: 'monster power',
        call: () =>
          TestBed.inject(MonsterService).updatePower(OWNER, ROW, { name: 'Shadow Step', description: null }).subscribe(),
        url: `${base}/api/monsters/${OWNER}/powers/${ROW}`,
      },
      {
        name: 'monster weakness',
        call: () =>
          TestBed.inject(MonsterService).updateWeakness(OWNER, ROW, { name: 'Silence', description: null }).subscribe(),
        url: `${base}/api/monsters/${OWNER}/weaknesses/${ROW}`,
      },
      {
        name: 'monster armor',
        call: () =>
          TestBed.inject(MonsterService)
            .updateArmor(OWNER, ROW, {
              name: 'Bone Plate',
              description: null,
              harmSoak: 2,
              isSpecial: false,
              specialDescription: null,
            })
            .subscribe(),
        url: `${base}/api/monsters/${OWNER}/armors/${ROW}`,
      },
      {
        name: 'minion attack',
        call: () =>
          TestBed.inject(MinionService)
            .updateAttack(OWNER, ROW, { name: 'Jagged Hymn', description: null, harm: 1 })
            .subscribe(),
        url: `${base}/api/minions/${OWNER}/attacks/${ROW}`,
      },
    ];

    for (const { name, call, url } of cases) {
      it(`${name} update is a PUT at its own row`, () => {
        call();

        const request = http.expectOne(url);
        expect(request.request.method).toBe('PUT');
        request.flush({ id: ROW });
      });
    }
  });

  /**
   * **5a-U8's missing half.** `assignAttackWeaponTag` shipped; its twin did not, so a tag taken off
   * an attack in the wizard stayed on the server for ever. The assign is included here so the pair
   * is pinned as a pair — they must differ only in method and the trailing segment.
   */
  describe('the weapon-tag pair (5a-U8)', () => {
    it('assign is a POST on the collection, with the id in the body', () => {
      TestBed.inject(MonsterService).assignAttackWeaponTag(OWNER, ROW, TAG).subscribe();

      const request = http.expectOne(`${base}/api/monsters/${OWNER}/attacks/${ROW}/weapon-tags`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ weaponTagId: TAG });
      request.flush({});
    });

    it('remove is a DELETE on the member, with the id in the path', () => {
      TestBed.inject(MonsterService).removeAttackWeaponTag(OWNER, ROW, TAG).subscribe();

      const request = http.expectOne(`${base}/api/monsters/${OWNER}/attacks/${ROW}/weapon-tags/${TAG}`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('the minion pair has the same shape under its own owner segment', () => {
      const minions = TestBed.inject(MinionService);
      minions.assignAttackWeaponTag(OWNER, ROW, TAG).subscribe();
      minions.removeAttackWeaponTag(OWNER, ROW, TAG).subscribe();

      http.expectOne({ method: 'POST', url: `${base}/api/minions/${OWNER}/attacks/${ROW}/weapon-tags` }).flush({});
      http
        .expectOne({ method: 'DELETE', url: `${base}/api/minions/${OWNER}/attacks/${ROW}/weapon-tags/${TAG}` })
        .flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
