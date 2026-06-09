import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TagService } from '../../services/tag.service';

@Component({
  selector: 'app-tag-manager',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './tag-manager.html',
  styleUrls: ['./tag-manager.scss'],
})
export class TagManagerComponent implements OnInit {
  readonly tags = signal<string[]>([]);
  readonly newTag = signal('');

  private tagService = inject(TagService);

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.tagService.getAll().subscribe(tags => this.tags.set(tags));
  }

  addTag(): void {
    const tag = this.newTag().trim();
    if (!tag || this.tags().includes(tag)) return;
    this.tagService.add(tag).subscribe(() => {
      this.newTag.set('');
      this.loadTags();
    });
  }

  removeTag(tag: string): void {
    this.tagService.remove(tag).subscribe(() => this.loadTags());
  }
}
