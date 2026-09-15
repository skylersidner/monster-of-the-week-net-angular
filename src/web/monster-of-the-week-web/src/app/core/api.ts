import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly httpClient: HttpClient) {}

  get<TResponse>(path: string): Observable<TResponse> {
    return this.httpClient.get<TResponse>(this.toUrl(path));
  }

  post<TRequest, TResponse>(path: string, body: TRequest, context?: HttpContext): Observable<TResponse> {
    return this.httpClient.post<TResponse>(this.toUrl(path), body, context ? { context } : undefined);
  }

  put<TRequest, TResponse>(path: string, body: TRequest, context?: HttpContext): Observable<TResponse> {
    return this.httpClient.put<TResponse>(this.toUrl(path), body, context ? { context } : undefined);
  }

  delete(path: string, context?: HttpContext): Observable<void> {
    return this.httpClient.delete<void>(this.toUrl(path), context ? { context } : undefined);
  }

  private toUrl(path: string): string {
    return path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
  }
}
