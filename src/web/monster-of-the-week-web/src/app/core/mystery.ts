import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  CountdownResponse,
  MysteryDetailResponse,
  MysteryListItemResponse,
  UpsertCountdownRequest,
  UpsertMysteryRequest,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class MysteryService {
  constructor(private readonly apiService: ApiService) {}

  getMysteries(): Observable<MysteryListItemResponse[]> {
    return this.apiService.get<MysteryListItemResponse[]>('/api/mysteries');
  }

  getMystery(id: string): Observable<MysteryDetailResponse> {
    return this.apiService.get<MysteryDetailResponse>(`/api/mysteries/${id}`);
  }

  create(request: UpsertMysteryRequest): Observable<MysteryDetailResponse> {
    return this.apiService.post<UpsertMysteryRequest, MysteryDetailResponse>('/api/mysteries', request);
  }

  update(id: string, request: UpsertMysteryRequest): Observable<MysteryDetailResponse> {
    return this.apiService.put<UpsertMysteryRequest, MysteryDetailResponse>(`/api/mysteries/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/mysteries/${id}`);
  }

  upsertCountdown(id: string, request: UpsertCountdownRequest): Observable<CountdownResponse> {
    return this.apiService.put<UpsertCountdownRequest, CountdownResponse>(`/api/mysteries/${id}/countdown`, request);
  }
}
