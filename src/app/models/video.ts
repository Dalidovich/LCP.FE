export enum VideoType {
  Anime = 0,
  Film = 1,
}

export interface PreviewSlice {
  start: number;
  duration: number;
}

export interface VideoDto {
  id: string;
  relativePath: string;
  systemName: string;
  nameEn: string;
  nameLocal: string;
  collectionId: string | null;
  episodeNumber: number;
  type: VideoType;
  tags: string[];
  thumbnailTimecode: number;
  duration: number;
  lastTimeWatched: string | null;
  previewSlices: PreviewSlice[] | null;
}

export interface UpdateVideoRequest {
  nameEn?: string | null;
  nameLocal?: string | null;
  collectionId?: string | null;
  episodeNumber?: number | null;
  type?: VideoType | null;
  tags?: string[] | null;
  thumbnailTimecode?: number | null;
  lastTimeWatched?: string | null;
}

export interface TagInfo {
  tag: string;
  usageCount: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
