import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { BystanderDetailResponse, BystanderListItemResponse, UpsertBystanderRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BystanderService {
  constructor(private readonly apiService: ApiService) {}

  getByMystery(mysteryId: string): Observable<BystanderListItemResponse[]> {
    return this.apiService.get<BystanderListItemResponse[]>(`/api/mysteries/${mysteryId}/bystanders`);
  }

  getAll(): Observable<BystanderListItemResponse[]> {
    return this.apiService.get<BystanderListItemResponse[]>('/api/bystanders');
  }

  getById(id: string): Observable<BystanderDetailResponse> {
    return this.apiService.get<BystanderDetailResponse>(`/api/bystanders/${id}`);
  }

  create(mysteryId: string, request: UpsertBystanderRequest): Observable<BystanderDetailResponse> {
    return this.apiService.post<UpsertBystanderRequest, BystanderDetailResponse>(
      `/api/mysteries/${mysteryId}/bystanders`,
      request
    );
  }

  update(id: string, request: UpsertBystanderRequest): Observable<BystanderDetailResponse> {
    return this.apiService.put<UpsertBystanderRequest, BystanderDetailResponse>(`/api/bystanders/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.apiService.delete(`/api/bystanders/${id}`);
  }

  unlinkFromMystery(mysteryId: string, id: string): Observable<void> {
    return this.apiService.delete(`/api/mysteries/${mysteryId}/bystanders/${id}`);
  }
}
