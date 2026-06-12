import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { VideoService } from '../../services/video.service';
import { VideoDto, VideoType } from '../../models/video';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './video-list.html',
  styleUrls: ['./video-list.scss'],
})
export class VideoListComponent implements OnInit, OnDestroy {
  protected readonly VideoType = VideoType;
  readonly videos = signal<VideoDto[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly totalPages = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly previewingId = signal<string | null>(null);
  readonly previewNonce = signal(Date.now());
  private isTouching = false;
  private destroy$ = new Subject<void>();

  private videoService = inject(VideoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const page = Number(params['page']) || 1;
      this.currentPage.set(page);
      this.loadPage();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPage(): void {
    this.loading.set(true);
    this.error.set(null);
    this.previewNonce.set(Date.now());
    this.videoService.getPaged(this.currentPage(), this.pageSize).subscribe({
      next: result => {
        this.videos.set(result.items);
        this.currentPage.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message ?? 'Failed to load videos');
        this.loading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : undefined },
      queryParamsHandling: 'merge',
    });
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id, this.previewNonce());
  }

  onMouseEnter(videoId: string): void {
    if (this.isTouching) return;
    this.previewingId.set(videoId);
  }

  onMouseLeave(): void {
    if (this.isTouching) return;
    this.previewingId.set(null);
  }

  onTouchStart(videoId: string): void {
    this.isTouching = true;
    this.previewingId.set(videoId);
  }

  onTouchEnd(): void {
    this.isTouching = false;
    this.previewingId.set(null);
  }

  playVideo(id: string): void {
    this.router.navigate(['/videos', id, 'play']);
  }
}
