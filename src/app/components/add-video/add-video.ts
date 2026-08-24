import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { VideoService } from '../../services/video.service';

@Component({
  selector: 'app-add-video',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './add-video.html',
  styleUrls: ['./add-video.scss'],
})
export class AddVideoComponent implements OnDestroy {
  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);

  private destroy$ = new Subject<void>();
  private videoService = inject(VideoService);
  private router = inject(Router);

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.error.set(null);
    }
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);

    this.videoService.add(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: video => {
        this.uploading.set(false);
        this.router.navigate(['/videos', video.id]);
      },
      error: err => {
        this.uploading.set(false);
        this.error.set(err.message ?? 'Failed to upload video');
      },
    });
  }
}
