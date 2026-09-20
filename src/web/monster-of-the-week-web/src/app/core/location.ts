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

  createStandalone(request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.post<UpsertLocationRequest, LocationDetailResponse>('/api/locations', request);
  }

  update(id: string, request: UpsertLocationRequest): Observable<LocationDetailResponse> {
    return this.apiService.put<UpsertLocationRequest, LocationDetailResponse>(`/api/locations/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/locations/${id}`);
  }

  /**
   * Asserts membership of the location in the mystery. `PUT` on the membership URI is the
   * mirror of the `DELETE` below, and is idempotent in effect: re-linking an already linked
   * location is a 204 no-op, never a 409. There is no request body — membership is its own
   * resource, deliberately not a field on `UpsertLocationRequest`, because the wizard calls
   * `update()` with payloads that would carry no `mysteryIds` and would unlink everything.
   */
  linkToMystery(mysteryId: string, id: string): Observable<void> {
    return this.apiService.put<null, void>(`/api/mysteries/${mysteryId}/locations/${id}`, null);
  }

  unlinkFromMystery(mysteryId: string, id: string): Observable<void> {
    return this.apiService.delete(`/api/mysteries/${mysteryId}/locations/${id}`);
  }
}
