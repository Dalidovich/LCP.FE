import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, NgZone, Renderer2, computed, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
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
const WHEEL_LOCK_MS = 400;
const SWIPE_THRESHOLD_PX = 50;
const CARD_PREVIEW_DELAY_MS = 300;
const CARD_DRAG_TOLERANCE_PX = 8;
const SIMILAR_PREFETCH_PX = 200;
const CONTROLS_IDLE_MS = 3000;
const ACTIVITY_THROTTLE_MS = 200;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
};

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
  readonly isFullscreen = signal(false);
  readonly panelOpen = signal(false);
  readonly controlsVisible = signal(true);
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');
  readonly collectionScrollEl = viewChild<ElementRef<HTMLElement>>('collectionScroll');
  readonly wrapperEl = viewChild<ElementRef<HTMLElement>>('videoWrapper');
  readonly panelCollectionEl = viewChild<ElementRef<HTMLElement>>('panelCollectionStrip');

  readonly panelCollectionVisible = computed(
    () => this.collectionLoading() || this.collectionVideos().length > 0,
  );
  readonly panelHasContent = computed(
    () => this.panelCollectionVisible() || this.similarVideos().length > 0,
  );

  private isTouching = false;
  private wheelLockedUntil = 0;
  private touchTracking = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartedInPanel = false;
  private cardTouchX = 0;
  private cardTouchY = 0;
  private cardTouchMoved = false;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt = 0;
  private activityCleanup: (() => void) | null = null;
  private gestureCleanup: Array<() => void> = [];
  private fullscreenCleanup: (() => void) | null = null;
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
  private zone = inject(NgZone);

  constructor() {
    effect(onCleanup => {
      const wrapper = this.wrapperEl()?.nativeElement;
      if (!wrapper) return;
      this.attachActivityHandlers(wrapper);
      onCleanup(() => this.detachActivityHandlers());
    });
  }

  ngOnInit(): void {
    if (window.innerWidth > 768) {
      this.renderer.setStyle(document.body, 'overflow', 'hidden');
    }

    this.fullscreenCleanup = this.renderer.listen('document', 'fullscreenchange', () =>
      this.onFullscreenChange(),
    );

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
    this.detachGestureHandlers();
    this.detachActivityHandlers();
    this.clearPreviewTimer();
    this.clearControlsHideTimer();
    this.fullscreenCleanup?.();
    this.fullscreenCleanup = null;
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
    this.collectionLoading.set(false);
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
    return this.videoService.getThumbnailUrl(video.id);
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

  toggleFullscreen(): void {
    const wrapper = this.wrapperEl()?.nativeElement;
    if (!wrapper) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      wrapper.requestFullscreen().then(() => this.lockLandscape()).catch(() => undefined);
    }
  }

  private lockLandscape(): void {
    const video = this.videoEl()?.nativeElement;
    if (!video || video.videoWidth <= video.videoHeight) return;
    const orientation = screen.orientation as LockableOrientation | undefined;
    orientation?.lock?.('landscape').catch(() => undefined);
  }

  private unlockOrientation(): void {
    const orientation = screen.orientation as LockableOrientation | undefined;
    orientation?.unlock?.();
  }

  private attachActivityHandlers(wrapper: HTMLElement): void {
    this.detachActivityHandlers();
    const onActivity = () => this.registerActivity();
    this.zone.runOutsideAngular(() => {
      wrapper.addEventListener('pointermove', onActivity, { passive: true });
      wrapper.addEventListener('pointerdown', onActivity, { passive: true });
      wrapper.addEventListener('touchstart', onActivity, { passive: true });
    });
    this.activityCleanup = () => {
      wrapper.removeEventListener('pointermove', onActivity);
      wrapper.removeEventListener('pointerdown', onActivity);
      wrapper.removeEventListener('touchstart', onActivity);
    };
  }

  private detachActivityHandlers(): void {
    this.activityCleanup?.();
    this.activityCleanup = null;
  }

  private registerActivity(): void {
    const now = Date.now();
    if (this.controlsVisible() && now - this.lastActivityAt < ACTIVITY_THROTTLE_MS) return;
    this.lastActivityAt = now;
    this.zone.run(() => this.revealControls());
  }

  private revealControls(): void {
    this.controlsVisible.set(true);
    this.clearControlsHideTimer();
    if (this.videoEl()?.nativeElement.paused !== false) return;
    this.controlsHideTimer = setTimeout(() => {
      this.controlsHideTimer = null;
      this.controlsVisible.set(false);
    }, CONTROLS_IDLE_MS);
  }

  private clearControlsHideTimer(): void {
    if (this.controlsHideTimer !== null) {
      clearTimeout(this.controlsHideTimer);
      this.controlsHideTimer = null;
    }
  }

  onPlaybackStateChanged(): void {
    this.revealControls();
  }

  private onFullscreenChange(): void {
    const wrapper = this.wrapperEl()?.nativeElement;
    const active = !!wrapper && document.fullscreenElement === wrapper;
    this.isFullscreen.set(active);
    if (active && wrapper) {
      this.attachGestureHandlers(wrapper);
    } else {
      this.detachGestureHandlers();
      this.clearPreviewTimer();
      this.previewingId.set(null);
      this.panelOpen.set(false);
      this.unlockOrientation();
    }
    this.revealControls();
  }

  private attachGestureHandlers(wrapper: HTMLElement): void {
    this.detachGestureHandlers();

    const onWheel = (event: WheelEvent) => this.onFullscreenWheel(event);
    const onTouchStart = (event: TouchEvent) => this.onFullscreenTouchStart(event);
    const onTouchEnd = (event: TouchEvent) => this.onFullscreenTouchEnd(event);
    const onTouchCancel = () => {
      this.touchTracking = false;
    };

    wrapper.addEventListener('wheel', onWheel, { passive: false });
    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: true });
    wrapper.addEventListener('touchcancel', onTouchCancel, { passive: true });

    this.gestureCleanup = [
      () => wrapper.removeEventListener('wheel', onWheel),
      () => wrapper.removeEventListener('touchstart', onTouchStart),
      () => wrapper.removeEventListener('touchend', onTouchEnd),
      () => wrapper.removeEventListener('touchcancel', onTouchCancel),
    ];
  }

  private detachGestureHandlers(): void {
    this.gestureCleanup.forEach(dispose => dispose());
    this.gestureCleanup = [];
    this.touchTracking = false;
  }

  private onFullscreenWheel(event: WheelEvent): void {
    event.preventDefault();
    const target = event.target as HTMLElement | null;
    const strip = target?.closest('.fs-strip') as HTMLElement | null;
    if (strip) {
      strip.scrollLeft += event.deltaY + event.deltaX;
      return;
    }
    if (target?.closest('.fs-panel')) return;
    if (Date.now() < this.wheelLockedUntil) return;
    if (event.deltaY > 0) {
      this.openPanel();
    } else if (event.deltaY < 0) {
      this.closePanel();
    }
  }

  private onFullscreenTouchStart(event: TouchEvent): void {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    if (!touch) {
      this.touchTracking = false;
      return;
    }
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartedInPanel = !!(event.target as HTMLElement | null)?.closest('.fs-panel');
    this.touchTracking = true;
  }

  private onFullscreenTouchEnd(event: TouchEvent): void {
    if (!this.touchTracking) return;
    this.touchTracking = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    if (Math.abs(dy) <= Math.abs(dx) || Math.abs(dy) <= SWIPE_THRESHOLD_PX) return;
    if (dy < 0) {
      if (!this.touchStartedInPanel) this.openPanel();
    } else {
      this.closePanel();
    }
  }

  private openPanel(): void {
    if (this.panelOpen() || !this.panelHasContent()) return;
    this.panelOpen.set(true);
    this.wheelLockedUntil = Date.now() + WHEEL_LOCK_MS;
    this.scrollPanelToCurrent();
  }

  private closePanel(): void {
    if (!this.panelOpen()) return;
    this.panelOpen.set(false);
    this.wheelLockedUntil = Date.now() + WHEEL_LOCK_MS;
  }

  private scrollPanelToCurrent(): void {
    timer(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const el = this.panelCollectionEl()?.nativeElement;
        if (!el) return;
        const active = el.querySelector('.active') as HTMLElement | null;
        if (!active) return;
        const containerRect = el.getBoundingClientRect();
        const cardRect = active.getBoundingClientRect();
        if (cardRect.left < containerRect.left || cardRect.right > containerRect.right) {
          active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });
  }

  onVideoEnded(): void {
    if (this.isFullscreen()) {
      this.openPanel();
    }
  }

  onPanelSimilarScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (
      el.scrollLeft + el.clientWidth >= el.scrollWidth - SIMILAR_PREFETCH_PX &&
      !this.similarLoading() &&
      this.similarPage < this.similarTotalPages
    ) {
      this.loadSimilarVideos(this.similarPage + 1);
    }
  }

  onPanelCardTouchStart(videoId: string, event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch) return;
    this.isTouching = true;
    this.cardTouchX = touch.clientX;
    this.cardTouchY = touch.clientY;
    this.cardTouchMoved = false;
    this.clearPreviewTimer();
    this.previewTimer = setTimeout(() => this.previewingId.set(videoId), CARD_PREVIEW_DELAY_MS);
  }

  onPanelCardTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch || this.cardTouchMoved) return;
    if (
      Math.abs(touch.clientX - this.cardTouchX) > CARD_DRAG_TOLERANCE_PX ||
      Math.abs(touch.clientY - this.cardTouchY) > CARD_DRAG_TOLERANCE_PX
    ) {
      this.cardTouchMoved = true;
      this.clearPreviewTimer();
      this.previewingId.set(null);
    }
  }

  onPanelCardTouchEnd(id: string, event: TouchEvent): void {
    const moved = this.cardTouchMoved;
    this.onPanelCardTouchCancel();
    if (event.cancelable) {
      event.preventDefault();
    }
    if (!moved) {
      this.switchToVideo(id);
    }
  }

  onPanelCardTouchCancel(): void {
    this.clearPreviewTimer();
    this.cardTouchMoved = false;
    this.isTouching = false;
    this.previewingId.set(null);
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  switchToVideo(id: string): void {
    this.closePanel();
    this.router.navigate(['/videos', id, 'play'], { replaceUrl: true });
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
