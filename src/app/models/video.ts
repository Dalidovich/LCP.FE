export enum VideoType {
  Anime = 0,
  Film = 1,
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
  isDeleted: boolean;
  thumbnailTimecode: number;
}

export interface UpdateVideoRequest {
  nameEn?: string | null;
  nameLocal?: string | null;
  collectionId?: string | null;
  episodeNumber?: number | null;
  type?: VideoType | null;
  tags?: string[] | null;
  thumbnailTimecode?: number | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
