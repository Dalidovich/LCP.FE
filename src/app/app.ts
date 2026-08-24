import { Component, OnInit, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';
import { SettingsService } from './services/settings.service';
import { VideoService } from './services/video.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  readonly password = signal('');
  readonly error = signal('');
  readonly checking = signal(false);

  private videoService = inject(VideoService);
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private auth = inject(AuthService);

  readonly unlocked = this.auth.unlocked;

  ngOnInit(): void {
    this.checking.set(true);
    this.settingsService.gateEnabled().subscribe({
      next: enabled => {
        if (enabled) {
          this.restoreSession();
          return;
        }

        this.checking.set(false);
        this.auth.setUnlocked(true);
        this.applyTheme();
      },
      error: () => this.restoreSession(),
    });
  }

  private restoreSession(): void {
    this.settingsService.session().subscribe({
      next: authenticated => {
        this.checking.set(false);
        this.auth.setUnlocked(authenticated);
        if (authenticated) this.applyTheme();
      },
      error: () => {
        this.checking.set(false);
        this.auth.setUnlocked(false);
      },
    });
  }

  openRandomVideo(): void {
    this.videoService.getRandom().subscribe(video => {
      this.router.navigate(['/videos', video.id, 'play']);
    });
  }

  submit(): void {
    const pw = this.password();
    if (!pw) return;

    this.checking.set(true);
    this.error.set('');
    this.settingsService.checkPassword(pw).subscribe({
      next: () => {
        this.checking.set(false);
        this.password.set('');
        this.auth.setUnlocked(true);
        this.applyTheme();
      },
      error: (err: HttpErrorResponse) => {
        this.checking.set(false);
        this.error.set(
          err.status === 401
            ? 'Incorrect password'
            : 'Cannot verify the password. The server is unavailable or misconfigured.',
        );
        this.password.set('');
      },
    });
  }

  private applyTheme(): void {
    this.settingsService.get().subscribe(s => {
      if (s.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    });
  }
}
