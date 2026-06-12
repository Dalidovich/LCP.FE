import { Location } from '@angular/common';
import { Component, OnInit, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
export class VideoPlayerComponent implements OnInit {

  readonly video = signal<VideoDto | null>(null);
  readonly streamUrl = signal('');
  readonly speedLabel = signal('');
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private accumulatedTime = 0;
  private lastKnownTime: number | null = null;
  private watchTracked = false;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoService = inject(VideoService);
  private settingsService = inject(SettingsService);
  private location = inject(Location);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.videoService.getById(id).subscribe(video => {
      this.video.set(video);
      this.streamUrl.set(this.videoService.getStreamUrl(id));
      this.checkSpeedUp(video);
    });
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

  goBack(): void {
    this.location.back();
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
