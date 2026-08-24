import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, Renderer2, inject, signal, viewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, Subject, catchError, expand, of, reduce, retry, switchMap, takeUntil, throwError, timer } from 'rxjs';
import { CollectionService } from '../../services/collection.service';
import { VideoService } from '../../services/video.service';
import { SettingsService } from '../../services/settings.service';
import { VideoDto, VideoType } from '../../models/video';

const WATCH_THRESHOLD_SECONDS = 30;
const MAX_DELTA_PER_TICK = 10;
const RETRY_DELAY_MS = 500;
const COLLECTION_PAGE_SIZE = 100;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
})
export class VideoPlayerComponent implements OnInit, OnDestroy {

  readonly video = signal<VideoDto | null>(null);
  readonly error = signal<string | null>(null);
  readonly streamUrl = signal('');
  readonly speedLabel = signal('');
  readonly collectionVideos = signal<VideoDto[]>([]);
  readonly collectionLoading = signal(false);
  readonly collectionError = signal<string | null>(null);
  readonly similarVideos = signal<VideoDto[]>([]);
  readonly similarLoading = signal(false);
  readonly previewingId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');
  readonly collectionScrollEl = viewChild<ElementRef<HTMLElement>>('collectionScroll');
  private isTouching = false;
  private similarPage = 1;
  private similarTotalPages = 1;
  private currentVideoId: string | null = null;

  private accumulatedTime = 0;
  private lastKnownTime: number | null = null;
  private watchTracked = false;
  private destroy$ = new Subject<void>();

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoService = inject(VideoService);
  private collectionService = inject(CollectionService);
  private settingsService = inject(SettingsService);
  private location = inject(Location);
  private renderer = inject(Renderer2);

  ngOnInit(): void {
    if (window.innerWidth > 768) {
      this.renderer.setStyle(document.body, 'overflow', 'hidden');
    }

    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const id = params.get('id')?.trim();
        this.error.set(null);
        if (!id) {
          this.error.set('No video was requested.');
          return of(null);
        }
        return this.fetchVideo(id);
      }),
    ).subscribe(video => {
      if (video) {
        this.loadVideo(video);
      } else {
        this.clearVideo();
      }
    });
  }

  private fetchVideo(id: string): Observable<VideoDto | null> {
    return this.videoService.getById(id).pipe(
      retry({
        count: 1,
        delay: (err: HttpErrorResponse) =>
          this.isTransient(err) ? timer(RETRY_DELAY_MS) : throwError(() => err),
      }),
      catchError((err: HttpErrorResponse) => {
        this.error.set(this.loadErrorMessage(err));
        return of(null);
      }),
    );
  }

  private isTransient(err: HttpErrorResponse): boolean {
    return err.status === 0 || err.status >= 500;
  }

  private loadErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 404) {
      return 'This video is no longer available.';
    }
    return err.message ?? 'Failed to load the video';
  }

  private clearVideo(): void {
    const el = this.videoEl()?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this.video.set(null);
    this.streamUrl.set('');
    this.speedLabel.set('');
    this.currentVideoId = null;
    this.collectionVideos.set([]);
    this.collectionError.set(null);
    this.collectionLoading.set(false);
    this.similarVideos.set([]);
    this.similarPage = 1;
    this.similarTotalPages = 1;
    this.accumulatedTime = 0;
    this.lastKnownTime = null;
    this.watchTracked = false;
  }

  ngOnDestroy(): void {
    this.renderer.removeStyle(document.body, 'overflow');
    const el = this.videoEl()?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadVideo(video: VideoDto): void {
    this.accumulatedTime = 0;
    this.lastKnownTime = null;
    this.watchTracked = false;
    this.speedLabel.set('');

    this.video.set(video);
    this.streamUrl.set(this.videoService.getStreamUrl(video.id));
    this.currentVideoId = video.id;
    this.collectionVideos.set([]);
    this.collectionError.set(null);
    this.similarVideos.set([]);
    this.similarPage = 1;
    this.similarTotalPages = 1;
    this.checkSpeedUp(video);
    this.loadSimilarVideos(1);
    if (video.collectionId) {
      this.loadCollectionVideos(video.collectionId, video.id);
    }
    timer(0).pipe(takeUntil(this.destroy$)).subscribe(() => {
      const el = this.videoEl()?.nativeElement;
      if (el) {
        el.load();
      }
    });
  }

  private loadCollectionVideos(collectionId: string, currentId: string): void {
    this.collectionLoading.set(true);
    this.collectionError.set(null);
    this.fetchAllCollectionVideos(collectionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: videos => {
        this.collectionVideos.set(videos);
        this.collectionLoading.set(false);
        timer(0).pipe(takeUntil(this.destroy$)).subscribe(() => this.scrollToCurrent(currentId));
      },
      error: () => {
        this.collectionVideos.set([]);
        this.collectionLoading.set(false);
        this.collectionError.set('Failed to load the collection.');
      },
    });
  }

  private fetchAllCollectionVideos(collectionId: string): Observable<VideoDto[]> {
    return this.collectionService.getVideos(collectionId, 1, COLLECTION_PAGE_SIZE).pipe(
      expand(result =>
        result.page < result.totalPages
          ? this.collectionService.getVideos(collectionId, result.page + 1, COLLECTION_PAGE_SIZE)
          : EMPTY,
      ),
      reduce((all: VideoDto[], result) => [...all, ...result.items], []),
    );
  }

  private scrollToCurrent(currentId: string): void {
    const el = this.collectionScrollEl()?.nativeElement;
    if (!el) return;
    const active = el.querySelector('.active') as HTMLElement | null;
    if (!active) return;
    const containerRect = el.getBoundingClientRect();
    const cardRect = active.getBoundingClientRect();
    if (cardRect.left < containerRect.left || cardRect.right > containerRect.right) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  private loadSimilarVideos(page: number): void {
    const id = this.currentVideoId;
    if (!id) return;
    this.similarLoading.set(true);
    this.videoService.getSimilar(id, page).pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (page === 1) {
        this.similarVideos.set(result.items);
      } else {
        this.similarVideos.update(v => [...v, ...result.items]);
      }
      this.similarPage = result.page;
      this.similarTotalPages = result.totalPages;
      this.similarLoading.set(false);
    });
  }

  onSimilarScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const threshold = 200;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold && !this.similarLoading() && this.similarPage < this.similarTotalPages) {
      this.loadSimilarVideos(this.similarPage + 1);
    }
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id);
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

  private checkSpeedUp(video: VideoDto): void {
    this.settingsService.get().pipe(takeUntil(this.destroy$)).subscribe(settings => {
      if (settings.animeSpeedUp && video.type === VideoType.Anime) {
        this.speedLabel.set('2x');
      }
    });
  }

  onVideoReady(): void {
    if (this.speedLabel()) {
      const el = this.videoEl()?.nativeElement;
      if (el) el.playbackRate = 2.0;
    }
  }

  onTimeUpdate(): void {
    if (this.watchTracked) return;

    const el = this.videoEl()?.nativeElement;
    if (!el) return;

    const currentTime = el.currentTime;

    if (this.lastKnownTime === null) {
      this.lastKnownTime = currentTime;
      return;
    }

    const delta = currentTime - this.lastKnownTime;
    this.lastKnownTime = currentTime;

    if (delta <= 0) return;

    this.accumulatedTime += Math.min(delta, MAX_DELTA_PER_TICK);

    if (this.accumulatedTime >= WATCH_THRESHOLD_SECONDS) {
      this.watchTracked = true;
      const v = this.video();
      if (v) {
        this.videoService.update(v.id, { lastTimeWatched: new Date().toISOString() })
          .pipe(takeUntil(this.destroy$))
          .subscribe();
      }
    }
  }

  onSeeked(): void {
    this.lastKnownTime = null;
  }

  onCollectionScroll(event: WheelEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  goBack(): void {
    this.location.back();
  }

  navigateToCollection(id: string | null): void {
    if (id) {
      this.router.navigate(['/collections', id]);
    }
  }

  navigateToVideo(id: string): void {
    this.router.navigate(['/videos', id, 'play']);
  }

  navigateToEdit(): void {
    const id = this.currentVideoId;
    if (id) {
      this.router.navigate(['/videos', id]);
    }
  }

  goToTag(tag: string): void {
    this.router.navigate(['/videos'], {
      queryParams: { tags: [tag] },
    });
  }

  goToStudio(studio: string): void {
    this.router.navigate(['/videos'], {
      queryParams: { productionInfo: [studio] },
    });
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
  }

  search(): void {
    const q = this.searchTerm().trim();
    if (q) {
      this.router.navigate(['/videos'], { queryParams: { search: q } });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.search();
    }
  }

  setThumbnailHere(): void {
    const v = this.video();
    const el = this.videoEl()?.nativeElement;
    if (!v || !el) return;

    const timecode = el.currentTime;
    this.videoService.update(v.id, { thumbnailTimecode: timecode }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.router.navigate(['/videos', v.id]);
    });
  }
}
