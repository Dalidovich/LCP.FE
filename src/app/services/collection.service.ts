import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CollectionDto } from '../models/collection';
import { VideoDto, PagedResult } from '../models/video';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private baseUrl = '/api/collections';

  constructor(private http: HttpClient) {}

  getAll(page: number = 1, pageSize: number = 20): Observable<PagedResult<CollectionDto>> {
    return this.http.get<PagedResult<CollectionDto>>(this.baseUrl, {
      params: { page, pageSize },
    });
  }

  getVideos(collectionId: string, page: number = 1, pageSize: number = 20): Observable<PagedResult<VideoDto>> {
    return this.http.get<PagedResult<VideoDto>>(`${this.baseUrl}/${encodeURIComponent(collectionId)}/videos`, {
      params: { page, pageSize },
    });
  }
}
