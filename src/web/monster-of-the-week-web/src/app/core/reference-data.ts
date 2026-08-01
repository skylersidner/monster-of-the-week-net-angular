import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { ApiService } from './api';
import {
  AdventureTypeResponse,
  CreateTypeRefRequest,
  CreateWeaponTagRequest,
  ReferenceTypeTable,
  TypeRefResponse,
  WeaponTagRefResponse,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class ReferenceDataService {
  private adventureTypes$?: Observable<AdventureTypeResponse[]>;
  private monsterTypes$?: Observable<TypeRefResponse[]>;
  private minionTypes$?: Observable<TypeRefResponse[]>;
  private locationTypes$?: Observable<TypeRefResponse[]>;
  private bystanderTypes$?: Observable<TypeRefResponse[]>;
  private weaponTags$?: Observable<WeaponTagRefResponse[]>;

  constructor(private readonly apiService: ApiService) {}

  getAdventureTypes(): Observable<AdventureTypeResponse[]> {
    this.adventureTypes$ ??= this.apiService
      .get<AdventureTypeResponse[]>('/api/adventure-types')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.adventureTypes$;
  }

  getMonsterTypes(): Observable<TypeRefResponse[]> {
    this.monsterTypes$ ??= this.apiService
      .get<TypeRefResponse[]>('/api/monster-types')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.monsterTypes$;
  }

  getMinionTypes(): Observable<TypeRefResponse[]> {
    this.minionTypes$ ??= this.apiService
      .get<TypeRefResponse[]>('/api/minion-types')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.minionTypes$;
  }

  getLocationTypes(): Observable<TypeRefResponse[]> {
    this.locationTypes$ ??= this.apiService
      .get<TypeRefResponse[]>('/api/location-types')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.locationTypes$;
  }

  getBystanderTypes(): Observable<TypeRefResponse[]> {
    this.bystanderTypes$ ??= this.apiService
      .get<TypeRefResponse[]>('/api/bystander-types')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.bystanderTypes$;
  }

  getWeaponTags(): Observable<WeaponTagRefResponse[]> {
    this.weaponTags$ ??= this.apiService
      .get<WeaponTagRefResponse[]>('/api/weapon-tags')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.weaponTags$;
  }

  getTypesByTable(table: ReferenceTypeTable): Observable<TypeRefResponse[]> {
    switch (table) {
      case ReferenceTypeTable.MonsterTypes:
        return this.getMonsterTypes();
      case ReferenceTypeTable.MinionTypes:
        return this.getMinionTypes();
      case ReferenceTypeTable.LocationTypes:
        return this.getLocationTypes();
      case ReferenceTypeTable.BystanderTypes:
        return this.getBystanderTypes();
      case ReferenceTypeTable.WeaponTags:
        throw new Error('Weapon tags are not a type reference table.');
    }
  }

  createType(table: ReferenceTypeTable, request: CreateTypeRefRequest): Observable<TypeRefResponse> {
    switch (table) {
      case ReferenceTypeTable.MonsterTypes:
        this.monsterTypes$ = undefined;
        return this.apiService.post<CreateTypeRefRequest, TypeRefResponse>('/api/monster-types', request);
      case ReferenceTypeTable.MinionTypes:
        this.minionTypes$ = undefined;
        return this.apiService.post<CreateTypeRefRequest, TypeRefResponse>('/api/minion-types', request);
      case ReferenceTypeTable.LocationTypes:
        this.locationTypes$ = undefined;
        return this.apiService.post<CreateTypeRefRequest, TypeRefResponse>('/api/location-types', request);
      case ReferenceTypeTable.BystanderTypes:
        this.bystanderTypes$ = undefined;
        return this.apiService.post<CreateTypeRefRequest, TypeRefResponse>('/api/bystander-types', request);
      case ReferenceTypeTable.WeaponTags:
        throw new Error('Weapon tags use createWeaponTag.');
    }
  }

  createWeaponTag(request: CreateWeaponTagRequest): Observable<WeaponTagRefResponse> {
    this.weaponTags$ = undefined;
    return this.apiService.post<CreateWeaponTagRequest, WeaponTagRefResponse>('/api/weapon-tags', request);
  }
}
