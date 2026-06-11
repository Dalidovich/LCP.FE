import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { SettingsDto } from '../../models/settings';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsComponent implements OnInit {
  readonly theme = signal('dark');
  readonly animeSpeedUp = signal(false);
  readonly saved = signal(false);

  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      this.theme.set(s.theme ?? 'dark');
      this.animeSpeedUp.set(s.animeSpeedUp);
    });
  }

  save(): void {
    const payload: SettingsDto = {
      theme: this.theme(),
      animeSpeedUp: this.animeSpeedUp(),
    };
    this.settingsService.update(payload).subscribe(() => {
      this.applyTheme(payload.theme ?? 'dark');
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
    });
  }

  private applyTheme(t: string): void {
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  }
}
