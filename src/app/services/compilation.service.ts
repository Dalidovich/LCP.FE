import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Compilation } from '../models/compilation';

@Injectable({ providedIn: 'root' })
export class CompilationService {
  private baseUrl = '/api/compilation';
  private http = inject(HttpClient);

  build(rebuild = false): Observable<Compilation> {
    return this.http.post<Compilation>(this.baseUrl, {}, { params: { rebuild } });
  }

  getStreamUrl(id: string): string {
    return `${this.baseUrl}/${id}/stream`;
  }
}
