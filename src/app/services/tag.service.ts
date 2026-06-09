import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TagService {
  private baseUrl = '/api/tags';

  constructor(private http: HttpClient) {}

  getAll(): Observable<string[]> {
    return this.http.get<string[]>(this.baseUrl);
  }

  add(tag: string): Observable<void> {
    return this.http.post<void>(this.baseUrl, JSON.stringify(tag), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  remove(tag: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(tag)}`);
  }
}
