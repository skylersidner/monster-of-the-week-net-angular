import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { authErrorInterceptor } from './auth-error-interceptor';
import { HunterService } from './hunter';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { httpErrorInterceptor } from './http-error-interceptor';
import { UpsertHunterRequest } from './models';
import { NotificationService } from './notifications';

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

  it('posts the draft to the check endpoint with SUPPRESS_ERROR_TOAST (12.8, L9)', () => {
    const answers: unknown[] = [];
    service.evaluate(request).subscribe((answer) => answers.push(answer));

    const req = httpTestingController.expectOne('/api/hunters/evaluate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush({ refusal: null, outstanding: [{ area: 'moves', sectionId: null, gearCategoryId: null, message: 'Moves: 0 of 2 picked.' }] });

    expect(answers).toEqual([{ refusal: null, outstanding: [{ area: 'moves', sectionId: null, gearCategoryId: null, message: 'Moves: 0 of 2 picked.' }] }]);
  });
});

describe('HunterService.evaluate through the app\'s interceptors', () => {
  let service: HunterService;
  let httpTestingController: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor, authErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(HunterService);
    httpTestingController = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it.each([
    ['a 500', 500],
    ['a network error', 0],
  ])('does not toast when the check fails with %s; the wizard says so itself (L9)', (_, status) => {
    let failed = false;
    service.evaluate(request).subscribe({ error: () => (failed = true) });

    httpTestingController.expectOne('/api/hunters/evaluate').flush(null, { status, statusText: 'Failed' });

    expect(failed).toBe(true);
    expect(notifications.notifications()).toEqual([]);
  });
});
