import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { MysteryDetailResponse, MysteryListItemResponse } from './models';

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
}
