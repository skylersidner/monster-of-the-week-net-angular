import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { SearchResultItem } from './models';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private readonly apiService: ApiService) {}

  quick(query: string): Observable<SearchResultItem[]> {
    return this.apiService.get<SearchResultItem[]>(`/api/search/quick?q=${encodeURIComponent(query)}`);
  }
}
