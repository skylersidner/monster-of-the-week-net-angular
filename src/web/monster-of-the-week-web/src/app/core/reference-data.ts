import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { ApiService } from './api';
import {
  AdventureTypeResponse,
  CreateAdventureTypeRequest,
  CreateMonsterArchetypeRequest,
  CreateNameDescriptionRequest,
  CreateTypeRefRequest,
  CreateWeaponTagRequest,
  MonsterArchetypeResponse,
  NameDescriptionRefResponse,
  NameDescriptionTable,
  ReferenceTypeTable,
  TypeRefResponse,
  TypeRefTable,
  WeaponTagRefResponse,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class ReferenceDataService {
  private adventureTypes$?: Observable<AdventureTypeResponse[]>;
  private monsterArchetypes$?: Observable<MonsterArchetypeResponse[]>;
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

  getMonsterArchetypes(): Observable<MonsterArchetypeResponse[]> {
    this.monsterArchetypes$ ??= this.apiService
      .get<MonsterArchetypeResponse[]>('/api/monster-archetypes')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.monsterArchetypes$;
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

  /**
   * Routes to the list endpoint for a Name + Motivation table. The parameter is narrowed to
   * `TypeRefTable` so the Name + Description tables are rejected at compile time rather than
   * throwing at runtime, and so this switch stays provably exhaustive.
   */
  getTypesByTable(table: TypeRefTable): Observable<TypeRefResponse[]> {
    switch (table) {
      case ReferenceTypeTable.MonsterTypes:
        return this.getMonsterTypes();
      case ReferenceTypeTable.MinionTypes:
        return this.getMinionTypes();
      case ReferenceTypeTable.LocationTypes:
        return this.getLocationTypes();
      case ReferenceTypeTable.BystanderTypes:
        return this.getBystanderTypes();
    }
  }

  /** Routes to the list endpoint for a Name + Description table. */
  getNameDescriptionsByTable(table: NameDescriptionTable): Observable<NameDescriptionRefResponse[]> {
    switch (table) {
      case ReferenceTypeTable.WeaponTags:
        return this.getWeaponTags();
      case ReferenceTypeTable.AdventureTypes:
        return this.getAdventureTypes();
      case ReferenceTypeTable.MonsterArchetypes:
        return this.getMonsterArchetypes();
    }
  }

  createType(table: TypeRefTable, request: CreateTypeRefRequest): Observable<TypeRefResponse> {
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
    }
  }

  /** Routes to the create endpoint for a Name + Description table. */
  createNameDescription(
    table: NameDescriptionTable,
    request: CreateNameDescriptionRequest
  ): Observable<NameDescriptionRefResponse> {
    switch (table) {
      case ReferenceTypeTable.WeaponTags:
        return this.createWeaponTag(request);
      case ReferenceTypeTable.AdventureTypes:
        return this.createAdventureType(request);
      case ReferenceTypeTable.MonsterArchetypes:
        return this.createMonsterArchetype(request);
    }
  }

  createWeaponTag(request: CreateWeaponTagRequest): Observable<WeaponTagRefResponse> {
    this.weaponTags$ = undefined;
    return this.apiService.post<CreateWeaponTagRequest, WeaponTagRefResponse>('/api/weapon-tags', request);
  }

  createAdventureType(request: CreateAdventureTypeRequest): Observable<AdventureTypeResponse> {
    this.adventureTypes$ = undefined;
    return this.apiService.post<CreateAdventureTypeRequest, AdventureTypeResponse>('/api/adventure-types', request);
  }

  createMonsterArchetype(request: CreateMonsterArchetypeRequest): Observable<MonsterArchetypeResponse> {
    this.monsterArchetypes$ = undefined;
    return this.apiService.post<CreateMonsterArchetypeRequest, MonsterArchetypeResponse>(
      '/api/monster-archetypes',
      request
    );
  }
}
