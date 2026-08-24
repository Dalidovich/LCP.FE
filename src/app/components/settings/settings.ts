import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Subject, takeUntil, timer } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { SettingsDto } from '../../models/settings';
import { VideoType } from '../../models/video';

const SAVED_NOTICE_MS = 2000;
const EXPORT_BUSY_MS = 5000;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsComponent implements OnInit, OnDestroy {
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
  readonly importBusy = signal(false);
  readonly importProgress = signal<number | null>(null);
  readonly importResult = signal<string | null>(null);
  readonly pendingImportFile = signal<File | null>(null);
  readonly importAcknowledged = signal(false);

  private destroy$ = new Subject<void>();

  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.get().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.settings.set({ ...s, theme: s.theme ?? 'dark', videoTypeFilter: s.videoTypeFilter ?? [] });
    });
    this.http.get<{ totalBytes: number; videoCount: number; videoBytes: number; systemBytes: number }>('/api/system/export/info')
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => this.backupInfo.set(info));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    this.settingsService.update(payload).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyTheme(payload.theme ?? 'dark');
      this.saved.set(true);
      timer(SAVED_NOTICE_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.saved.set(false));
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
    timer(EXPORT_BUSY_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.exportBusy.set(false));
  }

  selectImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importResult.set(null);
    this.importAcknowledged.set(false);

    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.pendingImportFile.set(null);
      this.importResult.set('Import failed: only .zip backup files can be imported.');
      input.value = '';
      return;
    }

    this.pendingImportFile.set(file);
  }

  cancelImport(input: HTMLInputElement): void {
    this.pendingImportFile.set(null);
    this.importAcknowledged.set(false);
    input.value = '';
  }

  confirmImport(input: HTMLInputElement): void {
    const file = this.pendingImportFile();
    if (!file || !this.importAcknowledged() || this.importBusy()) return;

    this.importBusy.set(true);
    this.importProgress.set(0);
    this.importResult.set(null);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post('/api/system/import', formData, { reportProgress: true, observe: 'events' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.importProgress.set(event.total ? Math.round((event.loaded / event.total) * 100) : null);
          } else if (event.type === HttpEventType.Response) {
            this.importProgress.set(null);
            this.importResult.set('Import completed! Reloading...');
            this.pendingImportFile.set(null);
            this.importAcknowledged.set(false);
            input.value = '';
            window.location.reload();
          }
        },
        error: err => {
          this.importBusy.set(false);
          this.importProgress.set(null);
          this.importAcknowledged.set(false);
          this.pendingImportFile.set(null);
          this.importResult.set('Import failed: ' + (err.error?.error || err.message));
          input.value = '';
        },
      });
  }

  shutdown(): void {
    if (this.shuttingDown()) return;
    if (!confirm('Shut down the backend server?\nIt will be restarted automatically by the startup manager.')) return;
    this.shuttingDown.set(true);
    this.http.post('/api/system/shutdown', {}).pipe(takeUntil(this.destroy$)).subscribe({
      error: () => {
        this.shuttingDown.set(false);
      },
    });
  }
}
