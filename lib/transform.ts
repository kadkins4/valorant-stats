import type { MatchRow, RankRow } from "@/lib/db/schema";
import type { Duel } from "@/lib/types";

type Team = "Red" | "Blue";
const other = (t: Team): Team => (t === "Red" ? "Blue" : "Red");

// Side for a given round, given which team attacked the first half.
// Rounds 0-11 first half, 12-23 second half (swap), 24+ overtime (swap each round).
export function attackerForRound(round: number, firstHalfAttacker: Team): Team {
  if (round < 12) return firstHalfAttacker;
  if (round < 24) return other(firstHalfAttacker);
  return (round - 24) % 2 === 0 ? firstHalfAttacker : other(firstHalfAttacker);
}

// Map each round id to the attacking team, inferred from any plant in the match.
export function attackingTeamByRound(rounds: any[]): Record<number, Team> {
  // Infer the first-half attacker from the first plant in regulation (rounds 0-23).
  // Overtime plants (id >= 24) are skipped — OT side parity can't be inferred from a
  // plant alone. Assumes sequential 0-based round ids.
  let firstHalf: Team | null = null;
  for (const r of rounds ?? []) {
    const planter: Team | undefined = r?.plant?.player?.team;
    if (!planter || r.id >= 24) continue;
    firstHalf = r.id < 12 ? planter : other(planter);
    break;
  }
  firstHalf ??= "Red"; // last-resort; side may be off but duels still count under "Both"
  const out: Record<number, Team> = {};
  for (const r of rounds ?? []) out[r.id] = attackerForRound(r.id, firstHalf);
  return out;
}

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
  duels: Duel[];
}

export function normalizeDetail(detail: any, puuid: string): NormalizedDetail {
  const players = detail.players ?? [];
  const myTeam: Team | undefined = players.find(
    (p: any) => p.puuid === puuid,
  )?.team_id;
  const agentOf = (pid?: string): string | undefined => {
    const p = players.find((x: any) => x.puuid === pid);
    return p?.agent?.name ?? p?.character?.name ?? p?.character ?? undefined;
  };
  const attackBy = attackingTeamByRound(detail.rounds ?? []);
  const kills = detail.kills ?? [];

  // Round's first kill (smallest time_in_round_in_ms) = first-blood. The opener
  // flag below compares kill objects by reference (=== k), so this map and the
  // duel loop must iterate the SAME `kills` array (no cloning in between).
  const firstKillOfRound = new Map<number, any>();
  for (const k of kills) {
    const cur = firstKillOfRound.get(k.round);
    const t = k.time_in_round_in_ms ?? Infinity;
    if (!cur || t < (cur.time_in_round_in_ms ?? Infinity))
      firstKillOfRound.set(k.round, k);
  }

  const counts = new Map<string, number>();
  const duels: Duel[] = [];

  for (const k of kills) {
    const iKilled = k.killer?.puuid === puuid;
    const iDied = k.victim?.puuid === puuid;
    if (iKilled) {
      const w = k.weapon?.name ?? "Unknown";
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    if ((iKilled || iDied) && k.location) {
      const att = attackBy[k.round];
      // Default to "attack" if team/round can't be resolved (rare); such duels
      // still appear correctly under the "Both" side filter.
      const side: "attack" | "defense" =
        myTeam && att ? (att === myTeam ? "attack" : "defense") : "attack";
      const enemyPuuid = iKilled ? k.victim?.puuid : k.killer?.puuid;

      const locs = k.player_locations ?? [];
      const locOf = (pid?: string) =>
        locs.find((l: any) => (l.player_puuid ?? l.puuid) === pid)?.location;
      // On a death I'm the victim, so the death location is my position; only
      // the survivor's position needs player_locations.
      const myLoc = iDied ? k.location : locOf(puuid);
      const enemyLoc = locOf(enemyPuuid);

      const duel: Duel = {
        x: k.location.x,
        y: k.location.y,
        won: iKilled,
        side,
        round: k.round,
      };
      if (myLoc) {
        duel.mx = myLoc.x;
        duel.my = myLoc.y;
      }
      if (enemyLoc) {
        duel.ex = enemyLoc.x;
        duel.ey = enemyLoc.y;
      }
      if (k.weapon?.name) duel.weapon = k.weapon.name;
      const myAgent = agentOf(puuid);
      if (myAgent) duel.agent = myAgent;
      const ea = agentOf(enemyPuuid);
      if (ea) duel.enemyAgent = ea;
      if (firstKillOfRound.get(k.round) === k) duel.opener = true;
      duels.push(duel);
    }
  }

  const weapons = [...counts.entries()]
    .map(([weapon, kills]) => ({ weapon, kills }))
    .sort((a, b) => b.kills - a.kills);

  return { weapons, duels };
}
