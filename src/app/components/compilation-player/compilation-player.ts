import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Compilation, CompilationMoment } from '../../models/compilation';
import { CompilationService } from '../../services/compilation.service';

@Component({
  selector: 'app-compilation-player',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './compilation-player.html',
  styleUrls: ['./compilation-player.scss'],
})
export class CompilationPlayerComponent implements OnInit, OnDestroy {
  readonly compilation = signal<Compilation | null>(null);
  readonly building = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentIndex = signal(-1);
  readonly streamUrl = computed(() => {
    const c = this.compilation();
    return c ? this.compilationService.getStreamUrl(c.id) : null;
  });
  readonly currentMoment = computed(() => this.compilation()?.moments[this.currentIndex()] ?? null);

  private destroy$ = new Subject<void>();
  private compilationService = inject(CompilationService);
  private location = inject(Location);

  ngOnInit(): void {
    this.build(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.location.back();
  }

  build(rebuild: boolean): void {
    this.building.set(true);
    this.error.set(null);
    this.compilation.set(null);
    this.currentIndex.set(-1);

    this.compilationService
      .build(rebuild)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: compilation => {
          this.building.set(false);
          this.compilation.set(compilation);
        },
        error: (err: HttpErrorResponse) => {
          this.building.set(false);
          this.error.set(
            err.status === 404
              ? 'Not enough watch data for a compilation yet.'
              : 'Failed to build the compilation.',
          );
        },
      });
  }

  onTimeUpdate(el: HTMLVideoElement): void {
    const moments = this.compilation()?.moments ?? [];
    const time = el.currentTime;
    const index = moments.findIndex(m => time >= m.offset && time < m.offset + m.duration);
    this.currentIndex.set(index === -1 && moments.length > 0 ? moments.length - 1 : index);
  }

  seekTo(el: HTMLVideoElement, moment: CompilationMoment): void {
    el.currentTime = moment.offset;
    el.play().catch(() => undefined);
  }

  formatTime(seconds: number): string {
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }
}
