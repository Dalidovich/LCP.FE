import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
      value: VideoType[label as keyof typeof VideoType] as VideoType,
    })),
  );

  readonly shuttingDown = signal(false);
  readonly exportBusy = signal(false);
  readonly backupInfo = signal<{ totalBytes: number; videoCount: number; videoBytes: number; systemBytes: number } | null>(null);

  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      this.settings.set({ ...s, theme: s.theme ?? 'dark', videoTypeFilter: s.videoTypeFilter ?? [] });
    });
    this.http.get<{ totalBytes: number; videoCount: number; videoBytes: number; systemBytes: number }>('/api/system/export/info')
      .subscribe(info => this.backupInfo.set(info));
  }

  update<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]): void {
    this.settings.update(s => s ? { ...s, [key]: value } : s);
  }

  isVideoTypeFiltered(type: VideoType): boolean {
    return this.settings()?.videoTypeFilter?.includes(type) ?? false;
  }

  toggleVideoTypeFilter(type: VideoType): void {
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

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  exportBackup(): void {
    if (this.exportBusy()) return;
    this.exportBusy.set(true);
    const a = document.createElement('a');
    a.href = '/api/system/export';
    const date = new Date().toISOString().slice(0, 10);
    a.download = `lcp-backup-${date}.zip`;
    a.click();
    setTimeout(() => this.exportBusy.set(false), 5000);
  }

  shutdown(): void {
    if (this.shuttingDown()) return;
    if (!confirm('Shut down the backend server?\nIt will be restarted automatically by the startup manager.')) return;
    this.shuttingDown.set(true);
    this.http.post('/api/system/shutdown', {}).subscribe({
      error: () => {
        this.shuttingDown.set(false);
      },
    });
  }
}
