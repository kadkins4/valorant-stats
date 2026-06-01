import { db } from "@/lib/db/client";
import { matches, rankHistory, syncRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { readSnapshot } from "@/lib/snapshot";
import { withFallback } from "@/lib/db/data-source";
import type {
  MatchSummary,
  RankPoint,
  WeaponUsage,
  Duel,
  FightMatch,
} from "@/lib/types";

const rowToSummary = (r: any): MatchSummary => ({
  matchId: r.matchId,
  playedAt: new Date(r.playedAt).toISOString(),
  season: r.season,
  map: r.map,
  agent: r.agent,
  tier: r.tier,
  kills: r.kills,
  deaths: r.deaths,
  assists: r.assists,
  score: r.score,
  shotsHead: r.shotsHead,
  shotsBody: r.shotsBody,
  shotsLeg: r.shotsLeg,
  damageMade: r.damageMade,
  damageReceived: r.damageReceived,
  roundsWon: r.roundsWon,
  roundsLost: r.roundsLost,
  won: r.won,
});

export function getMatches(): Promise<MatchSummary[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(matches)).map(rowToSummary),
    fromSnapshot: () => (readSnapshot()?.matches ?? []).map(rowToSummary),
  });
}

export const rowToRankPoint = (r: any): RankPoint => ({
  matchId: r.matchId,
  // DB rows give a Date; snapshot rows give an ISO string. Normalize to string
  // so consumers (e.g. EloTimeline's localeCompare sort) get a consistent shape.
  playedAt: new Date(r.playedAt).toISOString(),
  tier: r.tier,
  tierName: r.tierName,
  rr: r.rr,
  lastChange: r.lastChange,
  elo: r.elo,
  map: r.map,
});

export function getRankHistory(): Promise<RankPoint[]> {
  return withFallback({
    fromDb: async () =>
      (await db.select().from(rankHistory)).map(rowToRankPoint),
    fromSnapshot: () => (readSnapshot()?.rankHistory ?? []).map(rowToRankPoint),
  });
}

export const rowToFightMatch = (r: any): FightMatch => ({
  matchId: r.matchId,
  map: r.map,
  season: r.season,
  playedAt: new Date(r.playedAt).toISOString(),
  duels: (r.detail?.duels ?? []) as Duel[],
});

export function getFightData(): Promise<FightMatch[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(matches)).map(rowToFightMatch),
    fromSnapshot: () => (readSnapshot()?.matches ?? []).map(rowToFightMatch),
  });
}

export function getAccountMmr(): Promise<{ account: any; mmr: any } | null> {
  return withFallback({
    fromDb: async () => {
      const s = readSnapshot();
      return s ? { account: s.account, mmr: s.mmr } : null;
    },
    fromSnapshot: () => {
      const s = readSnapshot();
      return s ? { account: s.account, mmr: s.mmr } : null;
    },
  });
}

export function topWeapon(detailRows: { detail: any }[]): WeaponUsage | null {
  const counts = new Map<string, number>();
  for (const r of detailRows)
    for (const w of r.detail?.weapons ?? [])
      counts.set(w.weapon, (counts.get(w.weapon) ?? 0) + w.kills);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { weapon: top[0], kills: top[1] } : null;
}

// When the deployed data was last refreshed. The snapshot's generatedAt is
// written at the end of every sync run, so it doubles as the "last updated"
// stamp and works in both DB-primary and snapshot-fallback modes.
export function lastUpdated(): Promise<string | null> {
  return Promise.resolve(readSnapshot()?.generatedAt ?? null);
}

export async function lastSync() {
  try {
    return (
      (
        await db.select().from(syncRuns).orderBy(desc(syncRuns.ranAt)).limit(1)
      )[0] ?? null
    );
  } catch {
    return null;
  }
}
