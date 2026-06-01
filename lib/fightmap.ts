import type { Duel } from "@/lib/types";
import type { FightMatch } from "@/lib/types";
import { transformCoord, type MapCalibration } from "@/lib/maps/calibration";

export const GRID_N = 6;
export const MIN_DUELS = 4;

export interface Placed {
  nx: number;
  ny: number;
  won: boolean;
  col: number;
  row: number;
}

export interface Zone {
  col: number;
  row: number;
  wins: number;
  total: number;
  winRate: number;
  muted: boolean;
}

const clampCell = (v: number, gridN: number) =>
  Math.min(gridN - 1, Math.max(0, Math.floor(v * gridN)));

export function placeDuels(
  duels: Duel[],
  calib: MapCalibration,
  gridN = GRID_N,
): Placed[] {
  return duels.map((d) => {
    const { nx, ny } = transformCoord(calib, d);
    return {
      nx,
      ny,
      won: d.won,
      col: clampCell(nx, gridN),
      row: clampCell(ny, gridN),
    };
  });
}

export type TimeScope =
  | { kind: "season"; season: string }
  | { kind: "all" }
  | { kind: "lastN"; n: number };

export interface FilterOpts {
  map: string;
  side: "attack" | "defense" | "both";
  time: TimeScope;
}

export function collectDuels(matches: FightMatch[], o: FilterOpts): Duel[] {
  let ms = matches.filter((m) => m.map === o.map);
  if (o.time.kind === "season") {
    const s = o.time.season;
    ms = ms.filter((m) => m.season === s);
  } else if (o.time.kind === "lastN") {
    ms = [...ms]
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, o.time.n);
  }
  let duels = ms.flatMap((m) => m.duels);
  if (o.side !== "both") duels = duels.filter((x) => x.side === o.side);
  return duels;
}

export function seasonsOf(matches: FightMatch[]): string[] {
  const latest = new Map<string, string>();
  for (const m of matches) {
    const cur = latest.get(m.season);
    if (!cur || m.playedAt > cur) latest.set(m.season, m.playedAt);
  }
  return [...latest.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([s]) => s);
}

export function currentSeasonOf(matches: FightMatch[]): string {
  return seasonsOf(matches)[0] ?? "";
}

export function mapsOf(matches: FightMatch[]): string[] {
  return [...new Set(matches.map((m) => m.map))];
}

export function mostPlayedMap(matches: FightMatch[]): string {
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.map, (counts.get(m.map) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

const RED = [181, 72, 61];
const GRAY = [122, 127, 138];
const GREEN = [46, 139, 87];
const lerp = (a: number[], b: number[], t: number) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function winRateColor(rate: number): string {
  const c =
    rate <= 0.5
      ? lerp(RED, GRAY, rate / 0.5)
      : lerp(GRAY, GREEN, (rate - 0.5) / 0.5);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function zonesFromPlaced(placed: Placed[]): Zone[] {
  const cells = new Map<
    string,
    { col: number; row: number; wins: number; total: number }
  >();
  for (const p of placed) {
    const key = `${p.col},${p.row}`;
    const cur = cells.get(key) ?? { col: p.col, row: p.row, wins: 0, total: 0 };
    cur.total++;
    if (p.won) cur.wins++;
    cells.set(key, cur);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    winRate: c.wins / c.total,
    muted: c.total < MIN_DUELS,
  }));
}
