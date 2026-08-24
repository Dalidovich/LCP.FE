import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { TagService } from '../../services/tag.service';
import { ProductionInfoService } from '../../services/production-info.service';
import { VideoService } from '../../services/video.service';
import { VideoDto, VideoType, TagInfo } from '../../models/video';
import { PaginatorComponent } from '../paginator/paginator';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [RouterLink, FormsModule, PaginatorComponent],
  templateUrl: './video-list.html',
  styleUrls: ['./video-list.scss'],
})
export class VideoListComponent implements OnInit, OnDestroy {
  protected readonly VideoType = VideoType;
  readonly videos = signal<VideoDto[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly totalPages = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly debugMode = signal(false);
  readonly activeTags = signal<string[]>([]);
  readonly searchTerm = signal('');
  readonly allTags = signal<string[]>([]);
  readonly tagSearch = signal('');
  readonly filteredTags = computed(() => {
    const query = this.tagSearch().toLowerCase();
    return query ? this.allTags().filter(t => t.toLowerCase().includes(query)) : this.allTags();
  });
  readonly tagInfo = signal<TagInfo[]>([]);
  readonly tagInfoMap = computed(() => new Map(this.tagInfo().map(ti => [ti.tag, ti.usageCount])));
  readonly showAllTags = signal(false);
  readonly allProductionInfo = signal<string[]>([]);
  readonly activeProductionInfo = signal<string[]>([]);
  readonly piSearch = signal('');
  readonly filteredProductionInfo = computed(() => {
    const query = this.piSearch().toLowerCase();
    return query ? this.allProductionInfo().filter(s => s.toLowerCase().includes(query)) : this.allProductionInfo();
  });
  readonly piInfoMap = signal<Map<string, number>>(new Map());
  readonly showAllProductionInfo = signal(false);
  readonly previewingId = signal<string | null>(null);
  readonly expandedTags = signal(new Set<string>());
  private isTouching = false;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private destroy$ = new Subject<void>();

  private videoService = inject(VideoService);
  private tagService = inject(TagService);
  private productionInfoService = inject(ProductionInfoService);
  private settingsService = inject(SettingsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.settingsService.get().subscribe(s => {
      this.debugMode.set(s.debug);
      const hasFilter = !!(s.videoTypeFilter?.length);
      this.tagService.getAll(hasFilter).subscribe(tags => this.allTags.set(tags));
      this.tagService.getInfo(hasFilter).subscribe(info => this.tagInfo.set(info));
      this.productionInfoService.getAll(hasFilter).subscribe(studios => this.allProductionInfo.set(studios));
      this.productionInfoService.getInfo(hasFilter).subscribe(info => {
        this.piInfoMap.set(new Map(info.map(i => [i.name, i.usageCount])));
      });
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tagsParam = params['tags'] as string | undefined;
      const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];
      this.activeTags.set(tags);
      const piParam = params['productionInfo'] as string | undefined;
      const pi = piParam ? piParam.split(',').filter(Boolean) : [];
      this.activeProductionInfo.set(pi);
      const searchParam = params['search'] as string | undefined;
      this.searchTerm.set(searchParam ?? '');
      const page = Number(params['page']) || 1;
      this.currentPage.set(page);
      this.loadVideos(page, tags, pi, searchParam);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadVideos(page: number, tags: string[], productionInfo?: string[], search?: string): void {
    this.loading.set(true);
    this.error.set(null);
    const obs = this.videoService.getPaged(
      page, this.pageSize,
      tags.length > 0 ? tags : undefined,
      productionInfo && productionInfo.length > 0 ? productionInfo : undefined,
      search);
    obs.subscribe({
      next: result => {
        this.videos.set(result.items);
        this.currentPage.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message ?? 'Failed to load videos');
        this.loading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : undefined },
      queryParamsHandling: 'merge',
    });
  }

  thumbnailUrl(video: VideoDto): string {
    return this.videoService.getThumbnailUrl(video.id, video.thumbnailTimecode);
  }

  getPreviewUrl(video: VideoDto): string {
    return this.videoService.getPreviewUrl(video.id);
  }

  onMouseEnter(videoId: string): void {
    if (this.isTouching) return;
    this.previewingId.set(videoId);
  }

  onMouseLeave(): void {
    if (this.isTouching) return;
    this.previewingId.set(null);
  }

  onTouchStart(videoId: string): void {
    this.isTouching = true;
    this.previewingId.set(videoId);
  }

  onTouchEnd(): void {
    this.isTouching = false;
    this.previewingId.set(null);
  }

  playVideo(id: string): void {
    this.router.navigate(['/videos', id, 'play']);
  }

  toggleAllTags(): void {
    this.showAllTags.update(v => !v);
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

  isTagActive(tag: string): boolean {
    return this.activeTags().includes(tag);
  }

  toggleTag(tag: string): void {
    const current = this.activeTags();
    const idx = current.indexOf(tag);
    const next = idx > -1 ? current.filter(t => t !== tag) : [...current, tag];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tags: next.length > 0 ? next.join(',') : undefined, page: undefined },
      queryParamsHandling: 'merge',
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

  clearTagFilter(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tags: undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }

  isProductionInfoActive(studio: string): boolean {
    return this.activeProductionInfo().includes(studio);
  }

  toggleProductionInfo(studio: string): void {
    const current = this.activeProductionInfo();
    const idx = current.indexOf(studio);
    const next = idx > -1 ? current.filter(s => s !== studio) : [...current, studio];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productionInfo: next.length > 0 ? next.join(',') : undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }

  clearProductionInfoFilter(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productionInfo: undefined, page: undefined },
      queryParamsHandling: 'merge',
    });
  }

  toggleAllProductionInfo(): void {
    this.showAllProductionInfo.update(v => !v);
  }
}
