import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of, combineLatest } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { CollectionService } from '../../services/collection.service';
import { VideoService } from '../../services/video.service';
import { CollectionDto } from '../../models/collection';
import { VideoDto, VideoType } from '../../models/video';
import { PaginatorComponent } from '../paginator/paginator';

@Component({
  selector: 'app-collection-browser',
  standalone: true,
  imports: [RouterLink, FormsModule, PaginatorComponent],
  templateUrl: './collection-browser.html',
  styleUrls: ['./collection-browser.scss'],
})
export class CollectionBrowserComponent implements OnInit, OnDestroy {
  protected readonly VideoType = VideoType;
  readonly collections = signal<CollectionDto[]>([]);
  readonly videos = signal<VideoDto[]>([]);
  readonly selectedCollection = signal<string | null>(null);
  readonly loading = signal(true);
  readonly collectionPreviews = signal<Map<string, VideoDto>>(new Map());
  readonly previewingCol = signal<string | null>(null);
  readonly previewingVideoId = signal<string | null>(null);
  readonly expandedTags = signal(new Set<string>());

  readonly collectionsPage = signal(1);
  readonly collectionsTotalPages = signal(1);
  readonly videosPage = signal(1);
  readonly videosTotalPages = signal(1);
  readonly searchTerm = signal('');

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private isTouching = false;
  private isTouchingVideo = false;
  private destroy$ = new Subject<void>();
  private collectionService = inject(CollectionService);
  private videoService = inject(VideoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap,
      this.route.queryParams,
    ]).pipe(takeUntil(this.destroy$)).subscribe(([params, queryParams]) => {
      const collectionId = params.get('id');
      const page = Number(queryParams['page']) || 1;
      const search = (queryParams['search'] as string) || '';
      this.searchTerm.set(search);
      this.selectedCollection.set(collectionId);
      if (collectionId) {
        this.videosPage.set(page);
        this.loadVideos(collectionId, page, search);
      } else {
        this.collectionsPage.set(page);
        this.loadCollections(page, search);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCollections(page: number, search?: string): void {
    this.loading.set(true);
    this.collectionService.getAll(page, 20, search).subscribe({
      next: result => {
        this.collections.set(result.items);
        this.collectionsPage.set(result.page);
        this.collectionsTotalPages.set(result.totalPages);
        this.loadPreviews(result.items);
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
      this.collectionService.getVideos(col.id, 1, 1).pipe(
        catchError(() => of({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0 })),
      ),
    );
    forkJoin(requests).subscribe({
      next: results => {
        const map = new Map<string, VideoDto>();
        for (let i = 0; i < collections.length; i++) {
          if (results[i].items.length > 0) {
            map.set(collections[i].id, results[i].items[0]);
          }
        }
        this.collectionPreviews.set(map);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadVideos(collectionId: string, page: number, search?: string): void {
    this.loading.set(true);
    this.collectionService.getVideos(collectionId, page, 20, search).subscribe({
      next: result => {
        this.videos.set(result.items);
        this.videosPage.set(result.page);
        this.videosTotalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToCollectionsPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : undefined },
      queryParamsHandling: 'merge',
    });
  }

  goToVideosPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : undefined },
      queryParamsHandling: 'merge',
    });
  }

  goBack(): void {
    this.location.back();
  }

  selectCollection(id: string): void {
    this.router.navigate(['/collections', id]);
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id);
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

  playVideo(id: string): void {
    this.router.navigate(['/videos', id, 'play']);
  }

  goToTag(tag: string): void {
    this.router.navigate(['/videos'], {
      queryParams: { tag },
    });
  }

  goToStudio(studio: string): void {
    this.router.navigate(['/videos'], {
      queryParams: { productionInfo: studio },
    });
  }

  onSearchInput(value: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { search: value || undefined, page: undefined },
        queryParamsHandling: 'merge',
      });
    }, 400);
  }

  clearSearch(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }

  toggleTags(videoId: string): void {
    const next = new Set(this.expandedTags());
    if (next.has(videoId)) {
      next.delete(videoId);
    } else {
      next.add(videoId);
    }
    this.expandedTags.set(next);
  }
}
