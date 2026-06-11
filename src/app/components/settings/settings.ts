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
  readonly settings = signal<SettingsDto | null>(null);
  readonly saved = signal(false);

  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      this.settings.set({ ...s, theme: s.theme ?? 'dark' });
    });
  }

  update<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]): void {
    this.settings.update(s => s ? { ...s, [key]: value } : s);
  }

  save(): void {
    const payload = this.settings();
    if (!payload) return;
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
