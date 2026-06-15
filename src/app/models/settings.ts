export interface SettingsDto {
  theme: string | null;
  animeSpeedUp: boolean;
  warmCache: boolean;
  randomSort: boolean;
  debug: boolean;
  statisticsMode: boolean;
  videoTypeFilter: number[] | null;
}
