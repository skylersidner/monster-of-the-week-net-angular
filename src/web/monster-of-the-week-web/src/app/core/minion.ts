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

  getAll(): Observable<MinionListItemResponse[]> {
    return this.apiService.get<MinionListItemResponse[]>(`/api/minions`);
  }

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

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${id}`);
  }

  createAttack(minionId: string, request: UpsertMinionAttackRequest): Observable<MinionAttackResponse> {
    return this.apiService.post<UpsertMinionAttackRequest, MinionAttackResponse>(
      `/api/minions/${minionId}/attacks`,
      request
    );
  }

  updateAttack(minionId: string, attackId: string, request: UpsertMinionAttackRequest): Observable<MinionAttackResponse> {
    return this.apiService.put<UpsertMinionAttackRequest, MinionAttackResponse>(
      `/api/minions/${minionId}/attacks/${attackId}`,
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

  removeAttackWeaponTag(minionId: string, attackId: string, tagId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/attacks/${attackId}/weapon-tags/${tagId}`);
  }

  createPower(minionId: string, request: UpsertMinionPowerRequest): Observable<MinionPowerResponse> {
    return this.apiService.post<UpsertMinionPowerRequest, MinionPowerResponse>(
      `/api/minions/${minionId}/powers`,
      request
    );
  }

  updatePower(minionId: string, powerId: string, request: UpsertMinionPowerRequest): Observable<MinionPowerResponse> {
    return this.apiService.put<UpsertMinionPowerRequest, MinionPowerResponse>(
      `/api/minions/${minionId}/powers/${powerId}`,
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

  updateArmor(minionId: string, armorId: string, request: UpsertMinionArmorRequest): Observable<MinionArmorResponse> {
    return this.apiService.put<UpsertMinionArmorRequest, MinionArmorResponse>(
      `/api/minions/${minionId}/armors/${armorId}`,
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

  updateWeakness(minionId: string, weaknessId: string, request: UpsertMinionWeaknessRequest): Observable<MinionWeaknessResponse> {
    return this.apiService.put<UpsertMinionWeaknessRequest, MinionWeaknessResponse>(
      `/api/minions/${minionId}/weaknesses/${weaknessId}`,
      request
    );
  }

  deleteWeakness(minionId: string, weaknessId: string): Observable<void> {
    return this.apiService.delete(`/api/minions/${minionId}/weaknesses/${weaknessId}`);
  }
}
