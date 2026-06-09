import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../services/video.service';
import { TagService } from '../../services/tag.service';
import { VideoDto, UpdateVideoRequest, VideoType } from '../../models/video';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './video-detail.html',
  styleUrls: ['./video-detail.scss'],
})
export class VideoDetailComponent implements OnInit {
  protected readonly VideoType = VideoType;
  readonly video = signal<VideoDto | null>(null);
  readonly availableTags = signal<string[]>([]);

  readonly nameEn = signal<string | null>(null);
  readonly nameLocal = signal<string | null>(null);
  readonly collectionId = signal<string | null>(null);
  readonly episodeNumber = signal<number | null>(null);
  readonly type = signal<VideoType | null>(null);
  readonly tags = signal<string[] | null>(null);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoService = inject(VideoService);
  private tagService = inject(TagService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.videoService.getById(id).subscribe(video => {
      this.video.set(video);
      this.nameEn.set(video.nameEn);
      this.nameLocal.set(video.nameLocal);
      this.collectionId.set(video.collectionId);
      this.episodeNumber.set(video.episodeNumber);
      this.type.set(video.type);
      this.tags.set([...video.tags]);
    });

    this.tagService.getAll().subscribe(tags => this.availableTags.set(tags));
  }

  toggleTag(tag: string): void {
    this.tags.update(tags => {
      const current = tags ?? [];
      const idx = current.indexOf(tag);
      if (idx > -1) return current.filter(t => t !== tag);
      return [...current, tag];
    });
  }

  save(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const currentVideo = this.video();
    const payload: UpdateVideoRequest = {};
    if (this.nameEn() !== currentVideo?.nameEn) payload.nameEn = this.nameEn();
    if (this.nameLocal() !== currentVideo?.nameLocal) payload.nameLocal = this.nameLocal();
    if (this.collectionId() !== currentVideo?.collectionId) payload.collectionId = this.collectionId();
    if (this.episodeNumber() !== currentVideo?.episodeNumber) payload.episodeNumber = this.episodeNumber();
    if (this.type() !== currentVideo?.type) payload.type = this.type();
    if (JSON.stringify(this.tags()) !== JSON.stringify(currentVideo?.tags)) payload.tags = this.tags();

    this.videoService.update(id, payload).subscribe(() => this.router.navigate(['/videos']));
  }

  deleteVideo(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    if (confirm('Delete this video?')) {
      this.videoService.softDelete(id).subscribe(() => this.router.navigate(['/videos']));
    }
  }
}
