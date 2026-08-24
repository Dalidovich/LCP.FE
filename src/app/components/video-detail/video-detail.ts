import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil, timer } from 'rxjs';
import { VideoService } from '../../services/video.service';
import { TagService } from '../../services/tag.service';
import { ProductionInfoService } from '../../services/production-info.service';
import { CollectionService } from '../../services/collection.service';
import { VideoDto, UpdateVideoRequest, VideoType } from '../../models/video';

const PREVIEW_DEBOUNCE_MS = 300;
const SAVED_NOTICE_MS = 2000;

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './video-detail.html',
  styleUrls: ['./video-detail.scss'],
})
export class VideoDetailComponent implements OnInit, OnDestroy {
  protected readonly VideoType = VideoType;
  readonly video = signal<VideoDto | null>(null);
  readonly availableTags = signal<string[]>([]);
  readonly tagSearch = signal('');
  readonly filteredTags = computed(() => {
    const query = this.tagSearch().toLowerCase();
    return query ? this.availableTags().filter(t => t.toLowerCase().includes(query)) : this.availableTags();
  });
  readonly availableProductionInfo = signal<string[]>([]);
  readonly productionInfoSearch = signal('');
  readonly filteredProductionInfo = computed(() => {
    const query = this.productionInfoSearch().toLowerCase();
    return query ? this.availableProductionInfo().filter(s => s.toLowerCase().includes(query)) : this.availableProductionInfo();
  });
  readonly collections = signal<string[]>([]);

  readonly nameEn = signal<string | null>(null);
  readonly nameLocal = signal<string | null>(null);
  readonly collectionId = signal<string | null>(null);
  readonly episodeNumber = signal<number | null>(null);
  readonly type = signal<VideoType | null>(null);
  readonly tags = signal<string[] | null>(null);
  readonly productionInfo = signal<string[] | null>(null);
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

  private timecodeInput$ = new Subject<number | null>();
  private destroy$ = new Subject<void>();
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly videoService = inject(VideoService);
  private tagService = inject(TagService);
  private productionInfoService = inject(ProductionInfoService);
  private collectionService = inject(CollectionService);
  private location = inject(Location);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.videoService.getById(id).pipe(takeUntil(this.destroy$)).subscribe(video => {
      this.video.set(video);
      this.nameEn.set(video.nameEn);
      this.nameLocal.set(video.nameLocal);
      this.collectionId.set(video.collectionId);
      this.episodeNumber.set(video.episodeNumber);
      this.type.set(video.type);
      this.tags.set([...video.tags]);
      this.productionInfo.set([...video.productionInfo]);
      this.thumbnailTimecode.set(video.thumbnailTimecode);
      this.previewTimecode.set(video.thumbnailTimecode);
    });

    this.tagService.getAll().pipe(takeUntil(this.destroy$)).subscribe(tags => this.availableTags.set(tags));
    this.productionInfoService.getAll().pipe(takeUntil(this.destroy$))
      .subscribe(studios => this.availableProductionInfo.set(studios));
    this.collectionService.getAll(1, 999).pipe(takeUntil(this.destroy$))
      .subscribe(cols => this.collections.set(cols.items.map(c => c.id)));

    this.timecodeInput$.pipe(
      debounceTime(PREVIEW_DEBOUNCE_MS),
      takeUntil(this.destroy$),
    ).subscribe(value => this.previewTimecode.set(value));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCollectionChange(value: string): void {
    this.collectionId.set(value || null);
  }

  onTimecodeChange(value: string): void {
    const num = value === '' ? null : Number(value);
    this.thumbnailTimecode.set(num);
    this.timecodeInput$.next(num);
  }

  toggleTag(tag: string): void {
    this.tags.update(tags => {
      const current = tags ?? [];
      const idx = current.indexOf(tag);
      if (idx > -1) return current.filter(t => t !== tag);
      return [...current, tag];
    });
  }

  toggleProductionInfo(studio: string): void {
    this.productionInfo.update(studios => {
      const current = studios ?? [];
      const idx = current.indexOf(studio);
      if (idx > -1) return current.filter(s => s !== studio);
      return [...current, studio];
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
    if (JSON.stringify(this.productionInfo()) !== JSON.stringify(currentVideo?.productionInfo)) payload.productionInfo = this.productionInfo();
    if (this.thumbnailTimecode() !== currentVideo?.thumbnailTimecode) payload.thumbnailTimecode = this.thumbnailTimecode();

    this.videoService.update(id, payload).pipe(takeUntil(this.destroy$)).subscribe(updated => {
      this.video.set(updated);
      this.nameEn.set(updated.nameEn);
      this.nameLocal.set(updated.nameLocal);
      this.collectionId.set(updated.collectionId);
      this.episodeNumber.set(updated.episodeNumber);
      this.type.set(updated.type);
      this.tags.set([...updated.tags]);
      this.productionInfo.set([...updated.productionInfo]);
      this.thumbnailTimecode.set(updated.thumbnailTimecode);
      this.previewTimecode.set(updated.thumbnailTimecode);
      this.thumbVersion.update(v => v + 1);
      this.showSaved.set(true);
      timer(SAVED_NOTICE_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.showSaved.set(false));
    });
  }

  regenerateSlices(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.regenerating.set(true);
    this.videoService.regenerateSlices(id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.regenerating.set(false);
      this.previewVersion.update(v => v + 1);
    });
  }

  goBack(): void {
    this.location.back();
  }
}
