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

  getById(monsterId: string): Observable<MonsterDetailResponse> {
    return this.apiService.get<MonsterDetailResponse>(`/api/monsters/${monsterId}`);
  }

  create(mysteryId: string, request: UpsertMonsterRequest): Observable<MonsterDetailResponse> {
    return this.apiService.post<UpsertMonsterRequest, MonsterDetailResponse>(
      `/api/mysteries/${mysteryId}/monsters`,
      request
    );
  }

  update(monsterId: string, request: UpsertMonsterRequest): Observable<MonsterDetailResponse> {
    return this.apiService.put<UpsertMonsterRequest, MonsterDetailResponse>(`/api/monsters/${monsterId}`, request);
  }

  createAttack(monsterId: string, request: UpsertMonsterAttackRequest): Observable<MonsterAttackResponse> {
    return this.apiService.post<UpsertMonsterAttackRequest, MonsterAttackResponse>(
      `/api/monsters/${monsterId}/attacks`,
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

  createPower(monsterId: string, request: UpsertMonsterPowerRequest): Observable<MonsterPowerResponse> {
    return this.apiService.post<UpsertMonsterPowerRequest, MonsterPowerResponse>(
      `/api/monsters/${monsterId}/powers`,
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

  deleteArmor(monsterId: string, armorId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/armors/${armorId}`);
  }

  createWeakness(monsterId: string, request: UpsertMonsterWeaknessRequest): Observable<MonsterWeaknessResponse> {
    return this.apiService.post<UpsertMonsterWeaknessRequest, MonsterWeaknessResponse>(
      `/api/monsters/${monsterId}/weaknesses`,
      request
    );
  }

  deleteWeakness(monsterId: string, weaknessId: string): Observable<void> {
    return this.apiService.delete(`/api/monsters/${monsterId}/weaknesses/${weaknessId}`);
  }
}
