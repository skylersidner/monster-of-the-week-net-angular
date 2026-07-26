import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { LocationDetailResponse, LocationListItemResponse, UpsertLocationRequest } from './models';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private readonly apiService: ApiService) {}

  getAll(): Observable<LocationListItemResponse[]> {
    return this.apiService.get<LocationListItemResponse[]>('/api/locations');
  }

  getById(id: string): Observable<LocationDetailResponse> {
    return this.apiService.get<LocationDetailResponse>(`/api/locations/${id}`);
  }

  update(id: string, request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.put<UpsertLocationRequest, LocationDetailResponse>(`/api/locations/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/locations/${id}`);
  }
}
