import { VideoType } from './video';

export interface SettingsDto {
  theme: string | null;
  animeSpeedUp: boolean;
  warmCache: boolean;
  randomSort: boolean;
  debug: boolean;
  statisticsMode: boolean;
  videoTypeFilter: VideoType[] | null;
}
