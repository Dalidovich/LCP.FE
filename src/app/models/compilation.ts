export interface CompilationMoment {
  videoId: string;
  nameEn: string;
  offset: number;
  start: number;
  duration: number;
}

export interface Compilation {
  id: string;
  duration: number;
  moments: CompilationMoment[];
}
