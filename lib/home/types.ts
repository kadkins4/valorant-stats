export interface HomeData {
  name: string;
  tag: string;
  region: string;
  level: number;
  tier: string; // rank tier name, e.g. "Radiant"
  rr: number;
  peak: string;
  winPct: number; // 0..100
  record: string; // "12-8"
  kd: number;
  matches: number;
}
