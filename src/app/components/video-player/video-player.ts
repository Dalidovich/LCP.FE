import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

  private route = inject(ActivatedRoute);
  private videoService = inject(VideoService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.videoService.getById(id).subscribe(video => {
      this.video.set(video);
      this.streamUrl.set(this.videoService.getStreamUrl(id));
    });
  }
}
