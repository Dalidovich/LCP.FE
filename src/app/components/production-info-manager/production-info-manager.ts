import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ProductionInfoService } from '../../services/production-info.service';

@Component({
  selector: 'app-production-info-manager',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './production-info-manager.html',
  styleUrls: ['./production-info-manager.scss'],
})
export class ProductionInfoManagerComponent implements OnInit, OnDestroy {
  readonly studios = signal<string[]>([]);
  readonly studioCounts = signal<Map<string, number>>(new Map());
  readonly newStudio = signal('');
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly filteredStudios = computed(() => {
    const query = this.searchTerm().toLowerCase();
    return query ? this.studios().filter(s => s.toLowerCase().includes(query)) : this.studios();
  });

  private destroy$ = new Subject<void>();
  private productionInfoService = inject(ProductionInfoService);

  ngOnInit(): void {
    this.loadStudios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStudios(): void {
    this.productionInfoService.getAll().pipe(takeUntil(this.destroy$))
      .subscribe(studios => this.studios.set(studios));
    this.productionInfoService.getInfo().pipe(takeUntil(this.destroy$)).subscribe(info => {
      this.studioCounts.set(new Map(info.map(i => [i.name, i.usageCount])));
    });
  }

  addStudio(): void {
    const studio = this.newStudio().trim();
    if (!studio || this.studios().includes(studio)) return;
    this.adding.set(true);
    this.error.set(null);
    this.productionInfoService.add(studio).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.newStudio.set('');
        this.adding.set(false);
        this.loadStudios();
      },
      error: () => {
        this.adding.set(false);
        this.error.set('Failed to add studio');
      },
    });
  }

  removeStudio(studio: string): void {
    this.error.set(null);
    this.productionInfoService.remove(studio).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadStudios(),
      error: () => {
        this.error.set(`Failed to remove studio: ${studio}`);
      },
    });
  }
}
