import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { BystanderService } from './bystander';
import { LocationService } from './location';

/**
 * **The seam between the two halves of A5, A8, D6 and D7.**
 *
 * The wizard's share of those criteria is asserted against mocked services
 * (`mystery-create-phase4-ledger.spec.ts`: "a detach sends exactly one `unlinkFromMystery`"), and
 * the server's share is asserted against a real Kestrel host
 * (`MysteryMembershipVisibilityTests`: "that `DELETE` removes it from the other mystery too").
 * Composing the two is only sound if the method name the wizard calls produces the URL and verb the
 * controller routes — and **nothing tested that**, on either side. Every wizard, create-page and
 * detail-page spec in the app mocks these three methods wholesale, so a typo in the path template
 * (`/location/` for `/locations/`, or the two ids transposed) would be invisible to all of them and
 * would only ever show up as a 404 in a browser.
 *
 * Four lines of production code, and they are the entire reason a live-stack run would have been
 * needed. Pinned here instead. The literals below are written out by hand to match the controller
 * attributes — `[HttpPut("api/mysteries/{mysteryId:guid}/locations/{id:guid}")]` and siblings — so
 * this file reads as a contract rather than as a restatement of the implementation.
 */
describe('The membership verbs, on the wire', () => {
  let http: HttpTestingController;
  const base = environment.apiBaseUrl.replace(/\/$/, '');

  const MYSTERY = 'e6b3f3a0-0000-4000-8000-000000000001';
  const ENTITY = 'e6b3f3a0-0000-4000-8000-000000000002';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const collections: {
    name: string;
    segment: string;
    service: () => { linkToMystery: Function; unlinkFromMystery: Function; delete: Function };
  }[] = [
    { name: 'locations', segment: 'locations', service: () => TestBed.inject(LocationService) },
    { name: 'bystanders', segment: 'bystanders', service: () => TestBed.inject(BystanderService) },
    // **No monsters row, and that is a finding rather than an omission.** Phase 1 shipped
    // `PUT/DELETE /api/mysteries/{id}/monsters/{id}` and `MysteryLinkEndpointTests` exercises all
    // three collections from the wire — but Angular's `MonsterService` has no `linkToMystery` or
    // `unlinkFromMystery` at all, so the monster half of the verb has no client. Correct for
    // Phase 4 (monsters are Phase 5, architecture §6.2) and harmless today; noted because §9's
    // Phase 5 list names *five* missing `MonsterService` methods — the sub-resource updaters — and
    // these two are not among them.
  ];

  for (const { name, segment, service } of collections) {
    describe(name, () => {
      it('linkToMystery is PUT on the membership URI, with a null body', () => {
        service().linkToMystery(MYSTERY, ENTITY).subscribe();

        const request = http.expectOne(`${base}/api/mysteries/${MYSTERY}/${segment}/${ENTITY}`);
        expect(request.request.method).toBe('PUT');
        // §4.1: "No request body, therefore no new DTO." The endpoint tolerates one
        // (`Put_Returns204_WhenAClientSendsABodyAnyway`) but the client must not invent a shape.
        expect(request.request.body).toBeNull();
        request.flush(null, { status: 204, statusText: 'No Content' });
      });

      it('unlinkFromMystery is DELETE on the same URI — the asymmetry rule 2 exists for', () => {
        service().unlinkFromMystery(MYSTERY, ENTITY).subscribe();

        const request = http.expectOne(`${base}/api/mysteries/${MYSTERY}/${segment}/${ENTITY}`);
        expect(request.request.method).toBe('DELETE');
        request.flush(null, { status: 204, statusText: 'No Content' });
      });

      it('delete is DELETE on the flat catalogue URI, with no mystery in it at all', () => {
        service().delete(ENTITY).subscribe();

        // The whole difference between the two buttons is this one URL. A Delete that accidentally
        // carried a mystery segment would be a detach wearing a Delete label — the single most
        // dangerous confusion available in this feature, and silent on both sides of the seam.
        const request = http.expectOne(`${base}/api/${segment}/${ENTITY}`);
        expect(request.request.method).toBe('DELETE');
        request.flush(null, { status: 204, statusText: 'No Content' });
      });
    });
  }

  it('the two URIs differ only by the mystery prefix, which is what makes them confusable', () => {
    const location = TestBed.inject(LocationService);

    location.unlinkFromMystery(MYSTERY, ENTITY).subscribe();
    location.delete(ENTITY).subscribe();

    const detach = http.expectOne(`${base}/api/mysteries/${MYSTERY}/locations/${ENTITY}`);
    const destroy = http.expectOne(`${base}/api/locations/${ENTITY}`);
    expect([detach.request.method, destroy.request.method]).toEqual(['DELETE', 'DELETE']);
    expect(detach.request.url).not.toBe(destroy.request.url);
    detach.flush(null, { status: 204, statusText: 'No Content' });
    destroy.flush(null, { status: 204, statusText: 'No Content' });
  });
});
