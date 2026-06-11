import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CollectionDto } from '../models/collection';
import { VideoDto } from '../models/video';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private baseUrl = '/api/Collections';

  constructor(private http: HttpClient) {}

  getAll(): Observable<CollectionDto[]> {
    return this.http.get<CollectionDto[]>(this.baseUrl);
  }

  getVideos(collectionId: string): Observable<VideoDto[]> {
    return this.http.get<VideoDto[]>(`${this.baseUrl}/${encodeURIComponent(collectionId)}/videos`);
  }
}
