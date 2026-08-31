import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { HunterListItemResponse } from './models';

/**
 * Hunters are player-character instances built from a Playbook template. The list is flat —
 * no mystery scoping, since Hunters aren't Mystery-owned the way Monsters optionally are
 * (docs/hunter-playbooks/architecture.md Section 7).
 *
 * Phase 9 ships `getAll()` and nothing else; `getById`/`create`/`update`/`delete` arrive with
 * the create/edit form in Phase 10, alongside the endpoints that back them.
 */
@Injectable({
  providedIn: 'root',
})
export class HunterService {
  constructor(private readonly apiService: ApiService) {}

  getAll(): Observable<HunterListItemResponse[]> {
    return this.apiService.get<HunterListItemResponse[]>('/api/hunters');
  }
}
