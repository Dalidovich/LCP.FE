import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoDto, UpdateVideoRequest, PagedResult } from '../models/video';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private baseUrl = '/api/videos';

  constructor(private http: HttpClient) {}

  getAll(): Observable<VideoDto[]> {
    return this.http.get<VideoDto[]>(this.baseUrl);
  }

  getPaged(page: number = 1, pageSize: number = 20): Observable<PagedResult<VideoDto>> {
    return this.http.get<PagedResult<VideoDto>>(`${this.baseUrl}/paged`, {
      params: { page, pageSize },
    });
  }

  getById(id: string): Observable<VideoDto> {
    return this.http.get<VideoDto>(`${this.baseUrl}/${id}`);
  }

  update(id: string, request: UpdateVideoRequest): Observable<VideoDto> {
    return this.http.patch<VideoDto>(`${this.baseUrl}/${id}`, request);
  }

  softDelete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getSimilar(id: string): Observable<VideoDto[]> {
    return this.http.get<VideoDto[]>(`${this.baseUrl}/${id}/similar`);
  }

  getStreamUrl(id: string): string {
    return `${this.baseUrl}/${id}/stream`;
  }

  regenerateSlices(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/regenerate-slices`, {});
  }

  getPreviewUrl(id: string, v?: number): string {
    let url = `${this.baseUrl}/${id}/preview?resolution=0`;
    if (v !== undefined) url += `&v=${v}`;
    return url;
  }

  getThumbnailUrl(id: string, t?: number, v?: number): string {
    let url = `${this.baseUrl}/${id}/thumbnail`;
    const params: string[] = [];
    if (t !== undefined) params.push(`t=${t}`);
    if (v !== undefined) params.push(`v=${v}`);
    if (params.length) url += `?${params.join('&')}`;
    return url;
  }
}
