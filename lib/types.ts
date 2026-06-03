// Curated domain types the app/components consume.
export interface MatchSummary {
  matchId: string;
  playedAt: string;
  season: string;
  map: string;
  agent: string;
  tier: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  shotsHead: number;
  shotsBody: number;
  shotsLeg: number;
  damageMade: number;
  damageReceived: number;
  roundsWon: number;
  roundsLost: number;
  won: boolean;
}
export interface RankPoint {
  matchId: string;
  playedAt: string;
  tier: number;
  tierName: string;
  rr: number;
  lastChange: number;
  elo: number;
  map: string;
}
export interface MapAgg {
  map: string;
  games: number;
  wins: number;
  winRate: number;
  avgKd: number;
  avgAdr: number;
}
export interface AgentAgg {
  agent: string;
  games: number;
  wins: number;
  winRate: number;
  avgKd: number;
  avgHs: number;
  avgAdr: number;
}
export interface WeaponUsage {
  weapon: string;
  kills: number;
}

export interface Duel {
  x: number; // raw Valorant game-world coordinate of the death location
  y: number;
  won: boolean; // true = Kendall's kill (enemy died), false = Kendall's death
  side: "attack" | "defense";
  round: number;
  // Bucket C (optional; absent on un-recaptured matches)
  mx?: number; // my world position at kill time
  my?: number;
  ex?: number; // enemy duelist world position at kill time
  ey?: number;
  weapon?: string;
  agent?: string;
  enemyAgent?: string;
  opener?: boolean; // round's first kill (first-blood)
}

export interface FightMatch {
  matchId: string;
  map: string;
  season: string;
  playedAt: string; // ISO string
  duels: Duel[];
}
