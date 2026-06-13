import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { SettingsDto } from '../../models/settings';
import { VideoType } from '../../models/video';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsComponent implements OnInit {
  protected readonly VideoType = VideoType;
  readonly settings = signal<SettingsDto | null>(null);
  readonly saved = signal(false);
  readonly videoTypeOptions = computed(() =>
    (Object.values(VideoType).filter(v => typeof v === 'string') as string[]).map(label => ({
      label,
      value: VideoType[label as keyof typeof VideoType] as number,
    })),
  );

  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      this.settings.set({ ...s, theme: s.theme ?? 'dark', videoTypeFilter: s.videoTypeFilter ?? [] });
    });
  }

  update<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]): void {
    this.settings.update(s => s ? { ...s, [key]: value } : s);
  }

  isVideoTypeFiltered(type: number): boolean {
    return this.settings()?.videoTypeFilter?.includes(type) ?? false;
  }

  toggleVideoTypeFilter(type: number): void {
    this.settings.update(s => {
      if (!s) return s;
      const current = s.videoTypeFilter ?? [];
      const idx = current.indexOf(type);
      const next = idx > -1 ? current.filter(t => t !== type) : [...current, type];
      return { ...s, videoTypeFilter: next };
    });
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
