import { Component, Input, Output, EventEmitter, computed } from '@angular/core';

type PageItem = number | '...';

@Component({
  selector: 'app-paginator',
  standalone: true,
  templateUrl: './paginator.html',
  styleUrls: ['./paginator.scss'],
})
export class PaginatorComponent {
  @Input({ required: true }) currentPage!: number;
  @Input({ required: true }) totalPages!: number;
  @Output() pageChange = new EventEmitter<number>();

  readonly pages = computed<PageItem[]>(() => {
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 3) {
      return [1, 2, 3, 4, 5, '...' as const, total];
    }

    if (current >= total - 2) {
      return [1, '...' as const, total - 4, total - 3, total - 2, total - 1, total];
    }

    const start = Math.max(1, current - 3);
    const end = Math.min(total, current + 3);
    const items: PageItem[] = [];

    if (start > 1) {
      items.push(1);
      if (start > 2) {
        items.push('...');
      }
    }

    for (let i = start; i <= end; i++) {
      items.push(i);
    }

    if (end < total) {
      if (end < total - 1) {
        items.push('...');
      }
      items.push(total);
    }

    return items;
  });

  goTo(page: number): void {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }
}
