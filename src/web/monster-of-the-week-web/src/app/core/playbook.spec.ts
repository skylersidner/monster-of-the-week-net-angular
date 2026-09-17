import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PlaybookService } from './playbook';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { UpsertPlaybookRequest } from './models';

const request: UpsertPlaybookRequest = {
  name: 'The Test Subject',
  description: null,
  luckBoxCount: 7,
  luckSpecialText: null,
  harmUnstableThreshold: 5,
  harmBoxCount: 7,
  experienceBoxCount: 5,
  moveGrantCount: 3,
  gettingStartedText: null,
  introductionsText: null,
  levelingUpText: null,
  historyPromptsText: null,
  statArrayOptions: [],
  moves: [],
  gearCategories: [],
  lookCategories: [],
  improvements: [],
  bespokeSections: [],
  bespokeJournals: [],
  extraTracks: [],
};

describe('PlaybookService', () => {
  let service: PlaybookService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlaybookService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  // 13.12 item 14 / L9: the admin playbook save and delete carry SUPPRESS_ERROR_TOAST too — a
  // refusal, including S11's 409, already shows the server's message (playbook-admin.ts).
  it('sets SUPPRESS_ERROR_TOAST on create', () => {
    service.create(request).subscribe();
    const req = httpTestingController.expectOne('/api/playbooks');
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush({});
  });

  it('sets SUPPRESS_ERROR_TOAST on update', () => {
    service.update('pb1', request).subscribe();
    const req = httpTestingController.expectOne('/api/playbooks/pb1');
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush({});
  });

  it('leaves getById toasting by default, and suppresses the toast only when the caller asks (the wizard\'s Reload playbook, L27)', () => {
    service.getById('pb1').subscribe();
    const plain = httpTestingController.expectOne('/api/playbooks/pb1');
    expect(plain.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(false);
    plain.flush({});

    service.getById('pb1', { suppressErrorToast: true }).subscribe();
    const quiet = httpTestingController.expectOne('/api/playbooks/pb1');
    expect(quiet.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    quiet.flush({});
  });

  it('sets SUPPRESS_ERROR_TOAST on delete', () => {
    service.delete('pb1').subscribe();
    const req = httpTestingController.expectOne('/api/playbooks/pb1');
    expect(req.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    req.flush(null);
  });
});
