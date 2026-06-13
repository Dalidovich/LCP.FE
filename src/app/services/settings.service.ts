import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SettingsDto } from '../models/settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private baseUrl = '/api/Settings';

  constructor(private http: HttpClient) {}

  get(): Observable<SettingsDto> {
    return this.http.get<SettingsDto>(this.baseUrl);
  }

  update(settings: SettingsDto): Observable<SettingsDto> {
    return this.http.put<SettingsDto>(this.baseUrl, settings);
  }

  checkPassword(password: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/check-password`, { password });
  }
}
