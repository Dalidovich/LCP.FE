import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly unlocked = signal(false);

  setUnlocked(value: boolean): void {
    this.unlocked.set(value);
  }
}
