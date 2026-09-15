import { Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { HunterDetailResponse, HunterListItemResponse, UpsertHunterRequest } from './models';

/**
 * Hunters are player-character instances built from a Playbook template. The list is flat —
 * no mystery scoping, since Hunters aren't Mystery-owned the way Monsters optionally are
 * (docs/hunter-playbooks/architecture.md Section 7).
 *
 * Create and update each send the whole hunter in one request, including its move and gear
 * picks. There are deliberately no sub-resource calls: those picks are FK bridges into the
 * Playbook's rows, not entities with a lifecycle of their own, so there is nothing to sequence
 * the way `MonsterService` has to for Monster's independently-addressable children.
 */
@Injectable({
  providedIn: 'root',
})
export class HunterService {
  constructor(private readonly apiService: ApiService) {}

  getAll(): Observable<HunterListItemResponse[]> {
    return this.apiService.get<HunterListItemResponse[]>('/api/hunters');
  }

  getById(hunterId: string): Observable<HunterDetailResponse> {
    return this.apiService.get<HunterDetailResponse>(`/api/hunters/${hunterId}`);
  }

  create(request: UpsertHunterRequest): Observable<HunterDetailResponse> {
    // SUPPRESS_ERROR_TOAST: the create/detail page already shows the server's message on a
    // refusal (13.11 item 4, L9); without this a rejected save doubles as a generic toast too.
    return this.apiService.post<UpsertHunterRequest, HunterDetailResponse>(
      '/api/hunters',
      request,
      new HttpContext().set(SUPPRESS_ERROR_TOAST, true)
    );
  }

  update(hunterId: string, request: UpsertHunterRequest): Observable<HunterDetailResponse> {
    return this.apiService.put<UpsertHunterRequest, HunterDetailResponse>(
      `/api/hunters/${hunterId}`,
      request,
      new HttpContext().set(SUPPRESS_ERROR_TOAST, true)
    );
  }

  delete(hunterId: string): Observable<void> {
    return this.apiService.delete(`/api/hunters/${hunterId}`);
  }
}
