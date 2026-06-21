import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TagInfo } from '../models/video';

@Injectable({ providedIn: 'root' })
export class TagService {
  private baseUrl = '/api/tags';

  constructor(private http: HttpClient) {}

  getAll(): Observable<string[]> {
    return this.http.get<string[]>(this.baseUrl);
  }

  getInfo(): Observable<TagInfo[]> {
    return this.http.get<TagInfo[]>(`${this.baseUrl}/info`);
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
