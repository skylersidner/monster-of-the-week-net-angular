import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { LocationDetailResponse, LocationListItemResponse, UpsertLocationRequest } from './models';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private readonly apiService: ApiService) {}

  getByMystery(mysteryId: string): Observable<LocationListItemResponse[]> {
    return this.apiService.get<LocationListItemResponse[]>(`/api/mysteries/${mysteryId}/locations`);
  }

  getAll(): Observable<LocationListItemResponse[]> {
    return this.apiService.get<LocationListItemResponse[]>('/api/locations');
  }

  getById(id: string): Observable<LocationDetailResponse> {
    return this.apiService.get<LocationDetailResponse>(`/api/locations/${id}`);
  }

  create(mysteryId: string, request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.post<UpsertLocationRequest, LocationDetailResponse>(
      `/api/mysteries/${mysteryId}/locations`,
      request
    );
  }

  update(id: string, request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.put<UpsertLocationRequest, LocationDetailResponse>(`/api/locations/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/locations/${id}`);
  }

  unlinkFromMystery(mysteryId: string, id: string): Observable<void> {
    return this.apiService.delete(`/api/mysteries/${mysteryId}/locations/${id}`);
  }
}
