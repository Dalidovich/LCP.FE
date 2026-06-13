import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  readonly unlocked = signal(false);
  readonly password = signal('');
  readonly error = signal('');
  readonly checking = signal(false);

  private settingsService = inject(SettingsService);

  private readonly STORAGE_KEY = 'lcp_password';

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      if (s.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    });

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.checking.set(true);
      this.settingsService.checkPassword(stored).subscribe({
        next: ok => {
          this.checking.set(false);
          if (ok) this.unlocked.set(true);
          else localStorage.removeItem(this.STORAGE_KEY);
        },
        error: () => {
          this.checking.set(false);
          localStorage.removeItem(this.STORAGE_KEY);
        },
      });
    }
  }

  submit(): void {
    const pw = this.password();
    if (!pw) return;

    this.checking.set(true);
    this.error.set('');
    this.settingsService.checkPassword(pw).subscribe({
      next: ok => {
        this.checking.set(false);
        if (ok) {
          localStorage.setItem(this.STORAGE_KEY, pw);
          this.unlocked.set(true);
        } else {
          this.error.set('Incorrect password');
          this.password.set('');
        }
      },
      error: () => {
        this.checking.set(false);
        this.error.set('Failed to verify password');
      },
    });
  }
}
