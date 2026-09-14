export interface WatchSegment {
  start: number;
  duration: number;
}

export interface WatchRecord {
  videoId: string;
  segments: WatchSegment[];
}
