import { db } from "@/lib/db/client";
import { matches, rankHistory, syncRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { readSnapshot } from "@/lib/snapshot";
import { withFallback } from "@/lib/db/data-source";
import type { MatchSummary, RankPoint, WeaponUsage } from "@/lib/types";

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

export function getRankHistory(): Promise<RankPoint[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(rankHistory)) as any,
    fromSnapshot: () => (readSnapshot()?.rankHistory ?? []) as any,
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
