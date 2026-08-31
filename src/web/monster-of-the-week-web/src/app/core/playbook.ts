import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
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

  getById(playbookId: string): Observable<PlaybookDetailResponse> {
    return this.apiService.get<PlaybookDetailResponse>(`/api/playbooks/${playbookId}`);
  }

  create(request: UpsertPlaybookRequest): Observable<PlaybookDetailResponse> {
    return this.apiService.post<UpsertPlaybookRequest, PlaybookDetailResponse>('/api/playbooks', request);
  }

  update(playbookId: string, request: UpsertPlaybookRequest): Observable<PlaybookDetailResponse> {
    return this.apiService.put<UpsertPlaybookRequest, PlaybookDetailResponse>(
      `/api/playbooks/${playbookId}`,
      request
    );
  }

  delete(playbookId: string): Observable<void> {
    return this.apiService.delete(`/api/playbooks/${playbookId}`);
  }
}
