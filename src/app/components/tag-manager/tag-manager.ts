import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TagService } from '../../services/tag.service';

@Component({
  selector: 'app-tag-manager',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './tag-manager.html',
  styleUrls: ['./tag-manager.scss'],
})
export class TagManagerComponent implements OnInit, OnDestroy {
  readonly tags = signal<string[]>([]);
  readonly tagCounts = signal<Map<string, number>>(new Map());
  readonly newTag = signal('');
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly filteredTags = computed(() => {
    const query = this.searchTerm().toLowerCase();
    return query ? this.tags().filter(t => t.toLowerCase().includes(query)) : this.tags();
  });

  private destroy$ = new Subject<void>();
  private tagService = inject(TagService);

  ngOnInit(): void {
    this.loadTags();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTags(): void {
    this.tagService.getAll().pipe(takeUntil(this.destroy$)).subscribe(tags => this.tags.set(tags));
    this.tagService.getInfo().pipe(takeUntil(this.destroy$)).subscribe(info => {
      this.tagCounts.set(new Map(info.map(i => [i.tag, i.usageCount])));
    });
  }

  addTag(): void {
    const tag = this.newTag().trim();
    if (!tag || this.tags().includes(tag)) return;
    this.adding.set(true);
    this.error.set(null);
    this.tagService.add(tag).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.newTag.set('');
        this.adding.set(false);
        this.loadTags();
      },
      error: () => {
        this.adding.set(false);
        this.error.set('Failed to add tag');
      },
    });
  }

  removeTag(tag: string): void {
    this.error.set(null);
    this.tagService.remove(tag).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadTags(),
      error: () => {
        this.error.set(`Failed to remove tag: ${tag}`);
      },
    });
  }
}
