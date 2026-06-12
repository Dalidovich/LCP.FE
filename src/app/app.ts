import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  readonly unlocked = signal(false);
  readonly password = signal('');
  readonly error = signal('');
  readonly checking = signal(false);

  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      if (s.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    });

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isRefresh = nav?.type === 'reload';

    if (!isRefresh && localStorage.getItem('lcp_unlocked') === 'true') {
      this.unlocked.set(true);
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'lcp_unlocked' && e.newValue === 'true') {
        this.unlocked.set(true);
      }
    });
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
          localStorage.setItem('lcp_unlocked', 'true');
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
