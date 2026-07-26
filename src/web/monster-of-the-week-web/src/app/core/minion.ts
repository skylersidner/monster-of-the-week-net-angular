import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  AssignWeaponTagRequest,
  MinionArmorResponse,
  MinionAttackResponse,
  MinionDetailResponse,
  MinionListItemResponse,
  MinionPowerResponse,
  MinionWeaknessResponse,
  UpsertMinionArmorRequest,
  UpsertMinionAttackRequest,
  UpsertMinionPowerRequest,
  UpsertMinionRequest,
  UpsertMinionWeaknessRequest,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class MinionService {
  constructor(private readonly apiService: ApiService) {}

  getByMonster(monsterId: string): Observable<MinionListItemResponse[]> {
    return this.apiService.get<MinionListItemResponse[]>(`/api/monsters/${monsterId}/minions`);
  }

  getById(minionId: string): Observable<MinionDetailResponse> {
    return this.apiService.get<MinionDetailResponse>(`/api/minions/${minionId}`);
  }

  create(monsterId: string, request: UpsertMinionRequest): Observable<MinionDetailResponse> {
    return this.apiService.post<UpsertMinionRequest, MinionDetailResponse>(
      `/api/monsters/${monsterId}/minions`,
      request
    );
  }

  update(minionId: string, request: UpsertMinionRequest): Observable<MinionDetailResponse> {
    return this.apiService.put<UpsertMinionRequest, MinionDetailResponse>(`/api/minions/${minionId}`, request);
  }

  createAttack(minionId: string, request: UpsertMinionAttackRequest): Observable<MinionAttackResponse> {
    return this.apiService.post<UpsertMinionAttackRequest, MinionAttackResponse>(
      `/api/minions/${minionId}/attacks`,
      request
    );
  }

  deleteAttack(minionId: string, attackId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/attacks/${attackId}`);
  }

  assignAttackWeaponTag(minionId: string, attackId: string, weaponTagId: string): Observable<unknown> {
    const request: AssignWeaponTagRequest = { weaponTagId };
    return this.apiService.post<AssignWeaponTagRequest, unknown>(
      `/api/minions/${minionId}/attacks/${attackId}/weapon-tags`,
      request
    );
  }

  createPower(minionId: string, request: UpsertMinionPowerRequest): Observable<MinionPowerResponse> {
    return this.apiService.post<UpsertMinionPowerRequest, MinionPowerResponse>(
      `/api/minions/${minionId}/powers`,
      request
    );
  }

  deletePower(minionId: string, powerId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/powers/${powerId}`);
  }

  createArmor(minionId: string, request: UpsertMinionArmorRequest): Observable<MinionArmorResponse> {
    return this.apiService.post<UpsertMinionArmorRequest, MinionArmorResponse>(
      `/api/minions/${minionId}/armors`,
      request
    );
  }

  deleteArmor(minionId: string, armorId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/armors/${armorId}`);
  }

  createWeakness(minionId: string, request: UpsertMinionWeaknessRequest): Observable<MinionWeaknessResponse> {
    return this.apiService.post<UpsertMinionWeaknessRequest, MinionWeaknessResponse>(
      `/api/minions/${minionId}/weaknesses`,
      request
    );
  }

  deleteWeakness(minionId: string, weaknessId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/weaknesses/${weaknessId}`);
  }
}
