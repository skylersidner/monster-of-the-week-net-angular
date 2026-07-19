import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  readonly endpoint = `${environment.apiBaseUrl}/health/live`;

  constructor(private readonly httpClient: HttpClient) {}

  getLiveness(): Observable<string> {
    return this.httpClient.get(this.endpoint, { responseType: 'text' });
  }
}
