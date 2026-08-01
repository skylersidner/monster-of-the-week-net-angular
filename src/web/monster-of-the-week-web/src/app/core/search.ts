import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { PagedSearchResult, SearchResultItem } from './models';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private readonly apiService: ApiService) {}

  quick(query: string): Observable<SearchResultItem[]> {
    return this.apiService.get<SearchResultItem[]>(`/api/search/quick?q=${encodeURIComponent(query)}`);
  }

  search(query: string, page: number, pageSize: number): Observable<PagedSearchResult> {
    return this.apiService.get<PagedSearchResult>(
      `/api/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
    );
  }
}
