import { Injectable } from '@angular/core';
import { WatchRecord } from '../models/watch-record';

@Injectable({ providedIn: 'root' })
export class MostWatchedService {
  private baseUrl = '/api/most-watched';

  record(watch: WatchRecord): void {
    fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watch),
      keepalive: true,
    }).catch(() => undefined);
  }
}
