import type { Duel } from "@/lib/types";
import type { FightMatch } from "@/lib/types";
import { transformCoord, type MapCalibration } from "@/lib/maps/calibration";

export const GRID_N = 6;
export const MIN_DUELS = 4;

// Approximate Valorant world-units per meter. Tune during the feasibility spike
// so close/long-range duels read sensibly; only used for the dialog's distance.
export const WORLD_PER_METER = 100;

export interface Placed {
  nx: number;
  ny: number;
  won: boolean;
  side: "attack" | "defense";
  col: number;
  row: number;
  mnx?: number;
  mny?: number; // my position, normalized
  enx?: number;
  eny?: number; // enemy position, normalized
  dist?: number; // approx meters between duelists
  weapon?: string;
  agent?: string;
  enemyAgent?: string;
  round?: number;
  opener?: boolean;
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
    const hasM = d.mx != null && d.my != null;
    const hasE = d.ex != null && d.ey != null;
    // Plot each duel at MY position when we have it (Bucket C) so the marker is
    // "where I was standing" — my identity, not the enemy's death spot. Falls
    // back to the death location for legacy duels that lack my coordinates.
    const { nx, ny } = transformCoord(calib, hasM ? { x: d.mx!, y: d.my! } : d);
    const placed: Placed = {
      nx,
      ny,
      won: d.won,
      side: d.side,
      col: clampCell(nx, gridN),
      row: clampCell(ny, gridN),
      weapon: d.weapon,
      agent: d.agent,
      enemyAgent: d.enemyAgent,
      round: d.round,
      opener: d.opener,
    };
    if (hasM) {
      const m = transformCoord(calib, { x: d.mx!, y: d.my! });
      placed.mnx = m.nx;
      placed.mny = m.ny;
    }
    if (hasE) {
      const e = transformCoord(calib, { x: d.ex!, y: d.ey! });
      placed.enx = e.nx;
      placed.eny = e.ny;
    }
    if (hasM && hasE) {
      placed.dist = Math.round(
        Math.hypot(d.mx! - d.ex!, d.my! - d.ey!) / WORLD_PER_METER,
      );
    }
    return placed;
  });
}

// Marching-tracer direction for an engagement line that is always drawn
// you→enemy. The animation shows the kill direction (killer → victim): on a
// kill it flows you→enemy ("reverse" the default), on a death enemy→you.
export function tracerDirection(won: boolean): "reverse" | "normal" {
  return won ? "reverse" : "normal";
}

export interface SideSplit {
  attack: { wins: number; total: number } | null;
  defense: { wins: number; total: number } | null;
}

// Tally wins/totals per side from already-placed duels. A side with no duels
// in the set is null, so callers can omit its cell (e.g. when the SIDE filter
// is one-sided). Per-duel side is always "attack" or "defense".
export function sideSplit(points: Placed[]): SideSplit {
  const tally = (s: "attack" | "defense") => {
    const pts = points.filter((p) => p.side === s);
    if (pts.length === 0) return null;
    return { wins: pts.filter((p) => p.won).length, total: pts.length };
  };
  return { attack: tally("attack"), defense: tally("defense") };
}

export type TimeScope =
  | { kind: "seasons"; seasons: string[] }
  | { kind: "all" }
  | { kind: "lastN"; n: number };

export interface FilterOpts {
  map: string;
  side: "attack" | "defense" | "both";
  time: TimeScope;
  openersOnly?: boolean;
}

export function collectDuels(matches: FightMatch[], o: FilterOpts): Duel[] {
  let ms = matches.filter((m) => m.map === o.map);
  if (o.time.kind === "seasons") {
    const sel = o.time.seasons;
    ms = ms.filter((m) => sel.includes(m.season));
  } else if (o.time.kind === "lastN") {
    ms = [...ms]
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, o.time.n);
  }
  let duels = ms.flatMap((m) => m.duels);
  if (o.side !== "both") duels = duels.filter((x) => x.side === o.side);
  if (o.openersOnly) duels = duels.filter((x) => x.opener);
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

export function formatSeason(s: string): string {
  const m = /^e(\d+)a(\d+)$/i.exec(s);
  return m ? `E${m[1]} A${m[2]}` : s.toUpperCase();
}

// The two map layers want opposite amounts of data: Dots stays forensic and
// sparse (a few recent games), Heatmap aggregates so larger windows — up to
// all-time — stay readable. The time options are therefore driven by the layer.
export type Layer = "dots" | "heatmap";

export interface TimeOption {
  key: string;
  label: string;
  scope: TimeScope;
}

export function timeOptionsFor(
  layer: Layer,
  currentSeason: string,
): TimeOption[] {
  if (layer === "dots") {
    return [
      { key: "n1", label: "Last game", scope: { kind: "lastN", n: 1 } },
      { key: "n3", label: "Last 3 games", scope: { kind: "lastN", n: 3 } },
      { key: "n5", label: "Last 5 games", scope: { kind: "lastN", n: 5 } },
    ];
  }
  const opts: TimeOption[] = [
    { key: "n10", label: "Last 10 games", scope: { kind: "lastN", n: 10 } },
    { key: "n20", label: "Last 20 games", scope: { kind: "lastN", n: 20 } },
  ];
  if (currentSeason) {
    opts.push({
      key: "season",
      label: "This season",
      scope: { kind: "seasons", seasons: [currentSeason] },
    });
  }
  opts.push({ key: "all", label: "All time", scope: { kind: "all" } });
  return opts;
}

// Maps a TimeScope back to its option key so the selector can highlight it.
export function timeScopeKey(scope: TimeScope): string {
  if (scope.kind === "all") return "all";
  if (scope.kind === "seasons") return "season";
  return `n${scope.n}`;
}

// The window a layer resets to when you switch into it.
export function defaultTimeFor(layer: Layer, currentSeason: string): TimeScope {
  if (layer === "dots") return { kind: "lastN", n: 5 };
  return currentSeason
    ? { kind: "seasons", seasons: [currentSeason] }
    : { kind: "all" };
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

export interface RegionStat {
  regionName: string;
  superRegionName: string;
  cx: number;
  cy: number; // normalized [0,1] callout position
  wins: number;
  total: number;
  winRate: number;
  muted: boolean;
}

export function assignRegions(
  points: Placed[],
  callouts: {
    regionName: string;
    superRegionName: string;
    cx: number;
    cy: number;
  }[],
): RegionStat[] {
  const acc = new Map<number, { wins: number; total: number }>();
  for (const p of points) {
    let best = 0,
      bestD = Infinity;
    callouts.forEach((c, i) => {
      const d = (c.cx - p.nx) ** 2 + (c.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const cur = acc.get(best) ?? { wins: 0, total: 0 };
    cur.total++;
    if (p.won) cur.wins++;
    acc.set(best, cur);
  }
  return callouts.map((c, i) => {
    const a = acc.get(i) ?? { wins: 0, total: 0 };
    return {
      regionName: c.regionName,
      superRegionName: c.superRegionName,
      cx: c.cx,
      cy: c.cy,
      wins: a.wins,
      total: a.total,
      winRate: a.total ? a.wins / a.total : 0,
      muted: a.total < MIN_DUELS,
    };
  });
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
