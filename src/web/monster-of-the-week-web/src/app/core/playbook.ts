import { Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { PlaybookDetailResponse, PlaybookListItemResponse, UpsertPlaybookRequest } from './models';

/**
 * Playbooks are global reference/template data — no mystery scoping, and deliberately no
 * sub-resource calls. Create and update each send the entire nested graph in one request,
 * so there is nothing to sequence the way `MonsterService` has to for Monster's
 * independently-addressable children.
 */
@Injectable({
  providedIn: 'root',
})
export class PlaybookService {
  constructor(private readonly apiService: ApiService) {}

  getAll(): Observable<PlaybookListItemResponse[]> {
    return this.apiService.get<PlaybookListItemResponse[]>('/api/playbooks');
  }

  /**
   * `suppressErrorToast`: for a caller that shows its own message for a failed load, such as the
   * creation wizard's Reload playbook, which says "That playbook no longer exists." on a 404 (L7, L27).
   */
  getById(playbookId: string, options: { suppressErrorToast?: boolean } = {}): Observable<PlaybookDetailResponse> {
    return this.apiService.get<PlaybookDetailResponse>(
      `/api/playbooks/${playbookId}`,
      options.suppressErrorToast ? new HttpContext().set(SUPPRESS_ERROR_TOAST, true) : undefined
    );
  }

  create(request: UpsertPlaybookRequest): Observable<PlaybookDetailResponse> {
    // SUPPRESS_ERROR_TOAST: the admin page already shows the server's message on a refusal,
    // including S11's 409 (13.12 item 14, L9).
    return this.apiService.post<UpsertPlaybookRequest, PlaybookDetailResponse>(
      '/api/playbooks',
      request,
      new HttpContext().set(SUPPRESS_ERROR_TOAST, true)
    );
  }

  update(playbookId: string, request: UpsertPlaybookRequest): Observable<PlaybookDetailResponse> {
    return this.apiService.put<UpsertPlaybookRequest, PlaybookDetailResponse>(
      `/api/playbooks/${playbookId}`,
      request,
      new HttpContext().set(SUPPRESS_ERROR_TOAST, true)
    );
  }

  delete(playbookId: string): Observable<void> {
    return this.apiService.delete(`/api/playbooks/${playbookId}`, new HttpContext().set(SUPPRESS_ERROR_TOAST, true));
  }
}
