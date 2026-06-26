import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoDto, UpdateVideoRequest, PagedResult } from '../models/video';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private baseUrl = '/api/videos';

  constructor(private http: HttpClient) {}

  getRandom(): Observable<VideoDto> {
    return this.http.get<VideoDto>(`${this.baseUrl}/random`);
  }

  getAll(): Observable<VideoDto[]> {
    return this.http.get<VideoDto[]>(this.baseUrl);
  }

  getPaged(page: number = 1, pageSize: number = 20, tags?: string[], productionInfo?: string[], search?: string): Observable<PagedResult<VideoDto>> {
    let params: any = { page, pageSize };
    if (tags && tags.length > 0) {
      params['tags'] = tags;
    }
    if (productionInfo && productionInfo.length > 0) {
      params['productionInfo'] = productionInfo;
    }
    if (search) {
      params['search'] = search;
    }
    return this.http.get<PagedResult<VideoDto>>(`${this.baseUrl}/paged`, { params });
  }

  getById(id: string): Observable<VideoDto> {
    return this.http.get<VideoDto>(`${this.baseUrl}/${id}`);
  }

  update(id: string, request: UpdateVideoRequest): Observable<VideoDto> {
    return this.http.patch<VideoDto>(`${this.baseUrl}/${id}`, request);
  }

  getSimilar(id: string, page: number = 1, pageSize: number = 20): Observable<PagedResult<VideoDto>> {
    return this.http.get<PagedResult<VideoDto>>(`${this.baseUrl}/${id}/similar`, {
      params: { page, pageSize },
    });
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

  add(file: File): Observable<VideoDto> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<VideoDto>(`${this.baseUrl}/new`, fd);
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
