import type { MatchSummary, MapAgg, AgentAgg } from "@/lib/types";

const kd = (m: MatchSummary) => (m.deaths ? m.kills / m.deaths : m.kills);
const adr = (m: MatchSummary) => {
  const rounds = m.roundsWon + m.roundsLost;
  return rounds ? m.damageMade / rounds : 0;
};
const hs = (m: MatchSummary) => {
  const s = m.shotsHead + m.shotsBody + m.shotsLeg;
  return s ? (m.shotsHead * 100) / s : 0;
};
const avg = (ns: number[]) =>
  ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows)
    (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
  return m;
}

export function byMap(rows: MatchSummary[]): MapAgg[] {
  return [...groupBy(rows, (r) => r.map).entries()]
    .map(([map, ms]) => ({
      map,
      games: ms.length,
      wins: ms.filter((m) => m.won).length,
      winRate: (ms.filter((m) => m.won).length * 100) / ms.length,
      avgKd: avg(ms.map(kd)),
      avgAdr: avg(ms.map(adr)),
    }))
    .sort((a, b) => b.games - a.games);
}

export function byAgent(rows: MatchSummary[]): AgentAgg[] {
  return [...groupBy(rows, (r) => r.agent).entries()]
    .map(([agent, ms]) => ({
      agent,
      games: ms.length,
      wins: ms.filter((m) => m.won).length,
      winRate: (ms.filter((m) => m.won).length * 100) / ms.length,
      avgKd: avg(ms.map(kd)),
      avgHs: avg(ms.map(hs)),
      avgAdr: avg(ms.map(adr)),
    }))
    .sort((a, b) => b.games - a.games);
}

export function currentForm(rows: MatchSummary[], n: number) {
  const recent = [...rows]
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, n);
  return {
    games: recent.length,
    wins: recent.filter((m) => m.won).length,
    avgKd: avg(recent.map(kd)),
    avgHs: avg(recent.map(hs)),
    avgAdr: avg(recent.map(adr)),
  };
}

export function hitDistribution(rows: MatchSummary[]): {
  head: number;
  body: number;
  leg: number;
} {
  let head = 0,
    body = 0,
    leg = 0;
  for (const m of rows) {
    head += m.shotsHead;
    body += m.shotsBody;
    leg += m.shotsLeg;
  }
  const total = head + body + leg;
  if (!total) return { head: 0, body: 0, leg: 0 };
  return {
    head: (head * 100) / total,
    body: (body * 100) / total,
    leg: (leg * 100) / total,
  };
}

export function recentKdSeries(rows: MatchSummary[], n: number): number[] {
  return [...rows]
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
    .slice(-n)
    .map((m) => (m.deaths ? m.kills / m.deaths : m.kills));
}
