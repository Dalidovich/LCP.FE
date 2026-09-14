import { WatchSegment } from '../models/watch-record';

const SEEK_SPLIT_TOLERANCE_SECONDS = 1;

export class WatchTracker {
  private readonly segments: WatchSegment[] = [];
  private openStart: number | null = null;
  private openEnd = 0;
  private skipped = 0;
  private lastPosition: number | null = null;
  private resumeFrom: number | null = null;
  private seekPending = false;

  constructor(readonly videoId: string) {}

  seek(): void {
    this.seekPending = true;
  }

  progress(position: number, seeking: boolean): void {
    const previous = this.lastPosition;
    this.lastPosition = position;

    if (previous === null || seeking || this.seekPending) {
      this.seekPending = false;
      this.resumeFrom = position;
      return;
    }
    if (position <= previous) return;

    if (this.resumeFrom !== null) {
      this.beginRun(this.resumeFrom);
      this.resumeFrom = null;
    }
    this.openEnd = Math.max(this.openEnd, position);
  }

  finish(): WatchSegment[] {
    this.closeOpenSegment();
    return this.segments;
  }

  private beginRun(start: number): void {
    if (this.openStart !== null) {
      const gap = start - this.openEnd;
      const continuesSegment =
        gap >= 0
          ? this.skipped + gap < SEEK_SPLIT_TOLERANCE_SECONDS
          : -gap < SEEK_SPLIT_TOLERANCE_SECONDS;
      if (continuesSegment) {
        this.skipped += Math.max(0, gap);
        return;
      }
      this.closeOpenSegment();
    }
    this.openStart = start;
    this.openEnd = start;
    this.skipped = 0;
  }

  private closeOpenSegment(): void {
    if (this.openStart !== null && this.openEnd > this.openStart) {
      this.segments.push({ start: this.openStart, duration: this.openEnd - this.openStart });
    }
    this.openStart = null;
  }
}
