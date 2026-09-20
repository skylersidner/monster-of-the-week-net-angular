import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  AssignWeaponTagRequest,
  MonsterArmorResponse,
  MonsterAttackResponse,
  MonsterDetailResponse,
  MonsterListItemResponse,
  MonsterPowerResponse,
  MonsterWeaknessResponse,
  UpsertMonsterArmorRequest,
  UpsertMonsterAttackRequest,
  UpsertMonsterPowerRequest,
  UpsertMonsterRequest,
  UpsertMonsterWeaknessRequest,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class MonsterService {
  constructor(private readonly apiService: ApiService) {}

  getByMystery(mysteryId: string): Observable<MonsterListItemResponse[]> {
    return this.apiService.get<MonsterListItemResponse[]>(`/api/mysteries/${mysteryId}/monsters`);
  }

  getAll(): Observable<MonsterListItemResponse[]> {
    return this.apiService.get<MonsterListItemResponse[]>(`/api/monsters`);
  }

  getById(monsterId: string): Observable<MonsterDetailResponse> {
    return this.apiService.get<MonsterDetailResponse>(`/api/monsters/${monsterId}`);
  }

  create(mysteryId: string, request: UpsertMonsterRequest): Observable<MonsterDetailResponse> {
    return this.apiService.post<UpsertMonsterRequest, MonsterDetailResponse>(
      `/api/mysteries/${mysteryId}/monsters`,
      request
    );
  }

  createStandalone(request: UpsertMonsterRequest): Observable<MonsterDetailResponse> {
    return this.apiService.post<UpsertMonsterRequest, MonsterDetailResponse>(`/api/monsters`, request);
  }

  update(monsterId: string, request: UpsertMonsterRequest): Observable<MonsterDetailResponse> {
    return this.apiService.put<UpsertMonsterRequest, MonsterDetailResponse>(`/api/monsters/${monsterId}`, request);
  }

  delete(monsterId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}`);
  }

  createAttack(monsterId: string, request: UpsertMonsterAttackRequest): Observable<MonsterAttackResponse> {
    return this.apiService.post<UpsertMonsterAttackRequest, MonsterAttackResponse>(
      `/api/monsters/${monsterId}/attacks`,
      request
    );
  }

  updateAttack(monsterId: string, attackId: string, request: UpsertMonsterAttackRequest): Observable<MonsterAttackResponse> {
    return this.apiService.put<UpsertMonsterAttackRequest, MonsterAttackResponse>(
      `/api/monsters/${monsterId}/attacks/${attackId}`,
      request
    );
  }

  deleteAttack(monsterId: string, attackId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/attacks/${attackId}`);
  }

  assignAttackWeaponTag(monsterId: string, attackId: string, weaponTagId: string): Observable<unknown> {
    const request: AssignWeaponTagRequest = { weaponTagId };
    return this.apiService.post<AssignWeaponTagRequest, unknown>(
      `/api/monsters/${monsterId}/attacks/${attackId}/weapon-tags`,
      request
    );
  }

  /** The remove half of the weapon-tag diff. Its assign twin shipped; this did not, so a tag taken off an attack in the wizard stayed on the server. */
  removeAttackWeaponTag(monsterId: string, attackId: string, tagId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/attacks/${attackId}/weapon-tags/${tagId}`);
  }

  createPower(monsterId: string, request: UpsertMonsterPowerRequest): Observable<MonsterPowerResponse> {
    return this.apiService.post<UpsertMonsterPowerRequest, MonsterPowerResponse>(
      `/api/monsters/${monsterId}/powers`,
      request
    );
  }

  updatePower(monsterId: string, powerId: string, request: UpsertMonsterPowerRequest): Observable<MonsterPowerResponse> {
    return this.apiService.put<UpsertMonsterPowerRequest, MonsterPowerResponse>(
      `/api/monsters/${monsterId}/powers/${powerId}`,
      request
    );
  }

  deletePower(monsterId: string, powerId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/powers/${powerId}`);
  }

  createArmor(monsterId: string, request: UpsertMonsterArmorRequest): Observable<MonsterArmorResponse> {
    return this.apiService.post<UpsertMonsterArmorRequest, MonsterArmorResponse>(
      `/api/monsters/${monsterId}/armors`,
      request
    );
  }

  updateArmor(monsterId: string, armorId: string, request: UpsertMonsterArmorRequest): Observable<MonsterArmorResponse> {
    return this.apiService.put<UpsertMonsterArmorRequest, MonsterArmorResponse>(
      `/api/monsters/${monsterId}/armors/${armorId}`,
      request
    );
  }

  deleteArmor(monsterId: string, armorId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/armors/${armorId}`);
  }

  createWeakness(monsterId: string, request: UpsertMonsterWeaknessRequest): Observable<MonsterWeaknessResponse> {
    return this.apiService.post<UpsertMonsterWeaknessRequest, MonsterWeaknessResponse>(
      `/api/monsters/${monsterId}/weaknesses`,
      request
    );
  }

  updateWeakness(
    monsterId: string,
    weaknessId: string,
    request: UpsertMonsterWeaknessRequest
  ): Observable<MonsterWeaknessResponse> {
    return this.apiService.put<UpsertMonsterWeaknessRequest, MonsterWeaknessResponse>(
      `/api/monsters/${monsterId}/weaknesses/${weaknessId}`,
      request
    );
  }

  deleteWeakness(monsterId: string, weaknessId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/weaknesses/${weaknessId}`);
  }
}
