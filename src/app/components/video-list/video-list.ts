import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { TagService } from '../../services/tag.service';
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
  readonly debugMode = signal(false);
  readonly activeTags = signal<string[]>([]);
  readonly allTags = signal<string[]>([]);
  readonly showAllTags = signal(false);
  readonly previewingId = signal<string | null>(null);
  readonly expandedTags = signal(new Set<string>());
  readonly previewNonce = signal(Date.now());
  private isTouching = false;
  private destroy$ = new Subject<void>();

  private videoService = inject(VideoService);
  private tagService = inject(TagService);
  private settingsService = inject(SettingsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => this.debugMode.set(s.debug));
    this.tagService.getAll().subscribe(tags => this.allTags.set(tags));

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tagsParam = params['tags'] as string | undefined;
      const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];
      this.activeTags.set(tags);
      const page = Number(params['page']) || 1;
      this.currentPage.set(page);
      this.loadVideos(page, tags);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadVideos(page: number, tags: string[]): void {
    this.loading.set(true);
    this.error.set(null);
    this.previewNonce.set(Date.now());
    const obs = tags.length > 0
      ? this.videoService.getPaged(page, this.pageSize, tags)
      : this.videoService.getPaged(page, this.pageSize);
    obs.subscribe({
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

  toggleAllTags(): void {
    this.showAllTags.update(v => !v);
  }

  toggleTags(videoId: string): void {
    const next = new Set(this.expandedTags());
    if (next.has(videoId)) {
      next.delete(videoId);
    } else {
      next.add(videoId);
    }
    this.expandedTags.set(next);
  }

  isTagActive(tag: string): boolean {
    return this.activeTags().includes(tag);
  }

  toggleTag(tag: string): void {
    const current = this.activeTags();
    const idx = current.indexOf(tag);
    const next = idx > -1 ? current.filter(t => t !== tag) : [...current, tag];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tags: next.length > 0 ? next.join(',') : undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }

  clearTagFilter(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tags: undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }
}
