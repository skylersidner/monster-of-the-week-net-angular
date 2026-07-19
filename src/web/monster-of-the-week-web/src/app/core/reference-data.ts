import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { ApiService } from './api';
import { TypeRefResponse, WeaponTagRefResponse } from './models';

@Injectable({
  providedIn: 'root',
})
export class ReferenceDataService {
  private monsterTypes$?: Observable<TypeRefResponse[]>;
  private minionTypes$?: Observable<TypeRefResponse[]>;
  private locationTypes$?: Observable<TypeRefResponse[]>;
  private bystanderTypes$?: Observable<TypeRefResponse[]>;
  private weaponTags$?: Observable<WeaponTagRefResponse[]>;

  constructor(private readonly apiService: ApiService) {}

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
}
