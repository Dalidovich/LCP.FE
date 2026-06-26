import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductionInfoDto {
  name: string;
  usageCount: number;
}

@Injectable({ providedIn: 'root' })
export class ProductionInfoService {
  private baseUrl = '/api/production-info';

  constructor(private http: HttpClient) {}

  getAll(filterByType: boolean = false): Observable<string[]> {
    const params = filterByType ? { filterByType: 'true' } : undefined;
    return this.http.get<string[]>(this.baseUrl, { params });
  }

  getInfo(filterByType: boolean = false): Observable<ProductionInfoDto[]> {
    const params = filterByType ? { filterByType: 'true' } : undefined;
    return this.http.get<ProductionInfoDto[]>(`${this.baseUrl}/info`, { params });
  }

  add(studio: string): Observable<void> {
    return this.http.post<void>(this.baseUrl, JSON.stringify(studio), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  remove(studio: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(studio)}`);
  }
}
