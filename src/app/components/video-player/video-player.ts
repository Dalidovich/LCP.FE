import { Component, OnInit, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '../../models/video';

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
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoService = inject(VideoService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.videoService.getById(id).subscribe(video => {
      this.video.set(video);
      this.streamUrl.set(this.videoService.getStreamUrl(id));
    });
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
