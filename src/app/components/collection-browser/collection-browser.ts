import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CollectionService } from '../../services/collection.service';
import { VideoService } from '../../services/video.service';
import { CollectionDto } from '../../models/collection';
import { VideoDto, VideoType } from '../../models/video';

@Component({
  selector: 'app-collection-browser',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './collection-browser.html',
  styleUrls: ['./collection-browser.scss'],
})
export class CollectionBrowserComponent implements OnInit {
  protected readonly VideoType = VideoType;
  readonly collections = signal<CollectionDto[]>([]);
  readonly videos = signal<VideoDto[]>([]);
  readonly selectedCollection = signal<string | null>(null);
  readonly loading = signal(true);
  readonly collectionPreviews = signal<Map<string, VideoDto>>(new Map());
  readonly previewingCol = signal<string | null>(null);
  readonly previewingVideoId = signal<string | null>(null);
  readonly previewNonce = signal(Date.now());

  private isTouching = false;
  private isTouchingVideo = false;
  private collectionService = inject(CollectionService);
  private videoService = inject(VideoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    const collectionId = this.route.snapshot.paramMap.get('id');
    if (collectionId) {
      this.selectedCollection.set(collectionId);
      this.loadVideos(collectionId);
    } else {
      this.loadCollections();
    }
  }

  private loadCollections(): void {
    this.loading.set(true);
    this.collectionService.getAll().subscribe({
      next: result => {
        this.collections.set(result);
        this.loadPreviews(result);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadPreviews(collections: CollectionDto[]): void {
    if (collections.length === 0) {
      this.loading.set(false);
      return;
    }
    const requests = collections.map(col =>
      this.collectionService.getVideos(col.id).pipe(
        catchError(() => of([] as VideoDto[])),
      ),
    );
    forkJoin(requests).subscribe({
      next: results => {
        const map = new Map<string, VideoDto>();
        for (let i = 0; i < collections.length; i++) {
          const colVideos = results[i];
          if (colVideos.length > 0) {
            const idx = Math.floor(Math.random() * colVideos.length);
            map.set(collections[i].id, colVideos[idx]);
          }
        }
        this.collectionPreviews.set(map);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadVideos(collectionId: string): void {
    this.loading.set(true);
    this.collectionService.getVideos(collectionId).subscribe({
      next: result => {
        this.videos.set([...result].sort((a, b) => a.episodeNumber - b.episodeNumber));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectCollection(id: string): void {
    this.router.navigate(['/collections', id]);
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id, this.previewNonce());
  }

  onMouseEnter(colId: string): void {
    if (this.isTouching) return;
    this.previewingCol.set(colId);
  }

  onMouseLeave(): void {
    if (this.isTouching) return;
    this.previewingCol.set(null);
  }

  onTouchStart(colId: string): void {
    this.isTouching = true;
    this.previewingCol.set(colId);
  }

  onTouchEnd(): void {
    this.isTouching = false;
    this.previewingCol.set(null);
  }

  onVideoMouseEnter(videoId: string): void {
    if (this.isTouchingVideo) return;
    this.previewingVideoId.set(videoId);
  }

  onVideoMouseLeave(): void {
    if (this.isTouchingVideo) return;
    this.previewingVideoId.set(null);
  }

  onVideoTouchStart(videoId: string): void {
    this.isTouchingVideo = true;
    this.previewingVideoId.set(videoId);
  }

  onVideoTouchEnd(): void {
    this.isTouchingVideo = false;
    this.previewingVideoId.set(null);
  }
}
