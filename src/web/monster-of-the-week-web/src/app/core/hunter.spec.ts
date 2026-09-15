import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HunterService } from './hunter';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { UpsertHunterRequest } from './models';

const request: UpsertHunterRequest = {
  name: 'Half A Hunter',
  pronouns: null,
  playbookId: 'pb1',
  playbookStatArrayOptionId: null,
  luck: 0,
  harm: 0,
  experience: 0,
  background: null,
  playbookMoveIds: [],
  playbookGearOptionIds: [],
  looks: [],
  extraTracks: [],
  bespokeSelections: [],
  bespokeInstances: [],
  journalEntries: [],
};

describe('HunterService', () => {
  let service: HunterService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HunterService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  // 13.11 item 4 / L9: create and update carry SUPPRESS_ERROR_TOAST so a refused save shows only
  // the page's own message, not a second generic toast from httpErrorInterceptor.
  it('sets SUPPRESS_ERROR_TOAST on create', () => {
    service.create(request).subscribe();
    const req = httpTestingController.expectOne('/api/hunters');
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush({});
  });

  it('sets SUPPRESS_ERROR_TOAST on update', () => {
    service.update('h1', request).subscribe();
    const req = httpTestingController.expectOne('/api/hunters/h1');
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush({});
  });
});
