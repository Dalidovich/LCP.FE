import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { CollectionService } from '../../services/collection.service';
import { VideoService } from '../../services/video.service';
import { SettingsService } from '../../services/settings.service';
import { VideoDto, VideoType } from '../../models/video';

const WATCH_THRESHOLD_SECONDS = 30;
const MAX_DELTA_PER_TICK = 10;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [],
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
})
export class VideoPlayerComponent implements OnInit, OnDestroy {

  readonly video = signal<VideoDto | null>(null);
  readonly streamUrl = signal('');
  readonly speedLabel = signal('');
  readonly collectionVideos = signal<VideoDto[]>([]);
  readonly similarVideos = signal<VideoDto[]>([]);
  readonly previewingId = signal<string | null>(null);
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

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

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const id = params.get('id')!;
        return this.videoService.getById(id);
      }),
    ).subscribe(video => {
      this.loadVideo(video);
    });
  }

  ngOnDestroy(): void {
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
    this.similarVideos.set([]);
    this.checkSpeedUp(video);
    this.loadSimilarVideos(video.id);
    if (video.collectionId) {
      this.loadCollectionVideos(video.collectionId, video.id);
    }
    setTimeout(() => {
      const el = this.videoEl()?.nativeElement;
      if (el) {
        el.load();
      }
    });
  }

  private loadCollectionVideos(collectionId: string, currentId: string): void {
    this.collectionService.getVideos(collectionId).subscribe(videos => {
      this.collectionVideos.set(videos.sort((a, b) => a.episodeNumber - b.episodeNumber));
    });
  }

  private loadSimilarVideos(id: string): void {
    this.videoService.getSimilar(id).subscribe(videos => {
      this.similarVideos.set(videos);
    });
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id);
  }

  onMouseEnter(videoId: string): void {
    this.previewingId.set(videoId);
  }

  onMouseLeave(): void {
    this.previewingId.set(null);
  }

  private checkSpeedUp(video: VideoDto): void {
    this.settingsService.get().subscribe(settings => {
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
        this.videoService.update(v.id, { lastTimeWatched: new Date().toISOString() }).subscribe();
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

  navigateToVideo(id: string): void {
    this.router.navigate(['/videos', id, 'play']);
  }

  setThumbnailHere(): void {
    const v = this.video();
    const el = this.videoEl()?.nativeElement;
    if (!v || !el) return;

    const timecode = el.currentTime;
    this.videoService.update(v.id, { thumbnailTimecode: timecode }).subscribe(() => {
      this.router.navigate(['/videos', v.id]);
    });
  }
}
