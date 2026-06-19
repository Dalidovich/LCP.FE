import { Location } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../services/video.service';
import { TagService } from '../../services/tag.service';
import { CollectionService } from '../../services/collection.service';
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
  readonly tagSearch = signal('');
  readonly filteredTags = computed(() => {
    const query = this.tagSearch().toLowerCase();
    return query ? this.availableTags().filter(t => t.toLowerCase().includes(query)) : this.availableTags();
  });
  readonly collections = signal<string[]>([]);

  readonly nameEn = signal<string | null>(null);
  readonly nameLocal = signal<string | null>(null);
  readonly collectionId = signal<string | null>(null);
  readonly episodeNumber = signal<number | null>(null);
  readonly type = signal<VideoType | null>(null);
  readonly tags = signal<string[] | null>(null);
  readonly thumbnailTimecode = signal<number | null>(null);
  readonly showSaved = signal(false);
  readonly regenerating = signal(false);
  readonly previewVersion = signal(0);
  readonly thumbVersion = signal(0);
  readonly previewTimecode = signal<number | null>(null);
  readonly thumbnailUrl = computed(() => {
    const id = this.route.snapshot.paramMap.get('id')!;
    return this.videoService.getThumbnailUrl(id, this.previewTimecode() ?? undefined, this.thumbVersion());
  });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly videoService = inject(VideoService);
  private tagService = inject(TagService);
  private collectionService = inject(CollectionService);
  private location = inject(Location);

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
      this.thumbnailTimecode.set(video.thumbnailTimecode);
      this.previewTimecode.set(video.thumbnailTimecode);
    });

    this.tagService.getAll().subscribe(tags => this.availableTags.set(tags));
    this.collectionService.getAll(1, 999).subscribe(cols => this.collections.set(cols.items.map(c => c.id)));
  }

  onCollectionChange(value: string): void {
    this.collectionId.set(value || null);
  }

  onTimecodeChange(value: string): void {
    const num = value === '' ? null : Number(value);
    this.thumbnailTimecode.set(num);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.previewTimecode.set(num);
    }, 300);
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
    if (this.thumbnailTimecode() !== currentVideo?.thumbnailTimecode) payload.thumbnailTimecode = this.thumbnailTimecode();

    this.videoService.update(id, payload).subscribe(updated => {
      this.video.set(updated);
      this.nameEn.set(updated.nameEn);
      this.nameLocal.set(updated.nameLocal);
      this.collectionId.set(updated.collectionId);
      this.episodeNumber.set(updated.episodeNumber);
      this.type.set(updated.type);
      this.tags.set([...updated.tags]);
      this.thumbnailTimecode.set(updated.thumbnailTimecode);
      this.previewTimecode.set(updated.thumbnailTimecode);
      this.thumbVersion.update(v => v + 1);
      this.showSaved.set(true);
      setTimeout(() => this.showSaved.set(false), 2000);
    });
  }

  regenerateSlices(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.regenerating.set(true);
    this.videoService.regenerateSlices(id).subscribe(() => {
      this.regenerating.set(false);
      this.previewVersion.update(v => v + 1);
    });
  }

  goBack(): void {
    this.location.back();
  }
}
