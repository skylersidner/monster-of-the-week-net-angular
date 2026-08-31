import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
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
    return this.apiService.post<UpsertHunterRequest, HunterDetailResponse>('/api/hunters', request);
  }

  update(hunterId: string, request: UpsertHunterRequest): Observable<HunterDetailResponse> {
    return this.apiService.put<UpsertHunterRequest, HunterDetailResponse>(`/api/hunters/${hunterId}`, request);
  }

  delete(hunterId: string): Observable<void> {
    return this.apiService.delete(`/api/hunters/${hunterId}`);
  }
}
