import type { MatchRow, RankRow } from "@/lib/db/schema";

export function storedMatchToRow(m: any): MatchRow {
  const team = m.stats.team as "Red" | "Blue";
  const roundsWon = team === "Red" ? m.teams.red : m.teams.blue;
  const roundsLost = team === "Red" ? m.teams.blue : m.teams.red;
  return {
    matchId: m.meta.id,
    playedAt: new Date(m.meta.started_at),
    season: m.meta.season.short,
    map: m.meta.map.name,
    agent: m.stats.character.name,
    tier: m.stats.tier,
    kills: m.stats.kills,
    deaths: m.stats.deaths,
    assists: m.stats.assists,
    score: m.stats.score,
    shotsHead: m.stats.shots.head,
    shotsBody: m.stats.shots.body,
    shotsLeg: m.stats.shots.leg,
    damageMade: m.stats.damage.made,
    damageReceived: m.stats.damage.received,
    roundsWon,
    roundsLost,
    won: roundsWon > roundsLost,
  };
}

export function mmrEntryToRankRow(e: any): RankRow {
  return {
    matchId: e.match_id,
    playedAt: new Date(e.date),
    tier: e.tier.id,
    tierName: e.tier.name,
    rr: e.rr,
    lastChange: e.last_change,
    elo: e.elo,
    map: e.map.name,
  };
}

export interface NormalizedDetail {
  weapons: { weapon: string; kills: number }[];
  killCoords: { x: number; y: number }[];
}

export function normalizeDetail(detail: any, puuid: string): NormalizedDetail {
  const mine = (detail.kills ?? []).filter(
    (k: any) => k.killer?.puuid === puuid,
  );
  const counts = new Map<string, number>();
  const killCoords: { x: number; y: number }[] = [];
  for (const k of mine) {
    const w = k.weapon?.name ?? "Unknown";
    counts.set(w, (counts.get(w) ?? 0) + 1);
    if (k.victim_location)
      killCoords.push({ x: k.victim_location.x, y: k.victim_location.y });
  }
  const weapons = [...counts.entries()]
    .map(([weapon, kills]) => ({ weapon, kills }))
    .sort((a, b) => b.kills - a.kills);
  return { weapons, killCoords };
}
