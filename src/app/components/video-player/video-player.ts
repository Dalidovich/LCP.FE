import { Component, OnInit, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { SettingsService } from '../../services/settings.service';
import { VideoDto, VideoType } from '../../models/video';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
})
export class VideoPlayerComponent implements OnInit {
  readonly video = signal<VideoDto | null>(null);
  readonly streamUrl = signal('');
  readonly speedLabel = signal('');
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoService = inject(VideoService);
  private settingsService = inject(SettingsService);

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
