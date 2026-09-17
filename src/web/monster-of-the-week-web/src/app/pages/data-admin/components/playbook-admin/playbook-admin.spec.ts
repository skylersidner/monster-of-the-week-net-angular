import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { httpErrorInterceptor } from '../../../../core/http-error-interceptor';
import { PlaybookDetailResponse, UpsertPlaybookRequest } from '../../../../core/models';
import { NotificationService } from '../../../../core/notifications';
import { PlaybookAdminComponent } from './playbook-admin';

/**
 * A playbook save that clashes with a kept pick rule (hunter-creation-wizard.md 12.9 S11, 13.12
 * item 14, L9). The real `PlaybookService` and the real `httpErrorInterceptor` run, so "once" covers
 * both halves: the page's own handler shows the server's message, and the Phase 2 toast token keeps
 * the generic "Request failed (409)" toast off.
 */

const playbook: PlaybookDetailResponse = {
  id: 'pb-initiate', name: 'The Initiate', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 3,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [],
  bespokeSections: [], bespokeJournals: [], extraTracks: [], pickRules: [],
};

const request: UpsertPlaybookRequest = {
  name: 'The Initiate', description: null, luckBoxCount: 7, luckSpecialText: null,
  harmUnstableThreshold: 4, harmBoxCount: 7, experienceBoxCount: 5, moveGrantCount: 3,
  gettingStartedText: null, introductionsText: null, levelingUpText: null, historyPromptsText: null,
  statArrayOptions: [], moves: [], gearCategories: [], lookCategories: [], improvements: [],
  bespokeSections: [], bespokeJournals: [], extraTracks: [],
};

describe('PlaybookAdminComponent', () => {
  beforeEach(() => {
    // The interceptor logs every HTTP error; keep the run quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({
      imports: [PlaybookAdminComponent],
      providers: [provideHttpClient(withInterceptors([httpErrorInterceptor])), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a 409 naming a kept pick rule once: the server message, and no generic toast (S11, L9)', () => {
    const fixture = TestBed.createComponent(PlaybookAdminComponent);
    const http = TestBed.inject(HttpTestingController);
    const notifications = TestBed.inject(NotificationService);
    fixture.detectChanges();
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/playbooks')).flush([]);

    const component = fixture.componentInstance;
    component.editing.set(playbook);
    component.savePlaybook(request);

    const message = 'The pick rule on "Old-fashioned weapons (pick either two or three, as above)" uses the option "Obsolete gear", which this save removes.';
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/playbooks/pb-initiate'));
    expect(Object.keys(put.request.body as object)).not.toContain('pickRules');
    put.flush({ message }, { status: 409, statusText: 'Conflict' });

    expect(notifications.notifications().map(({ kind, message: text }) => ({ kind, text }))).toEqual([{ kind: 'error', text: message }]);
    expect(component.isSaving()).toBe(false);
    http.verify();
  });
});
