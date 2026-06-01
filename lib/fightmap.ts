import type { Duel } from "@/lib/types";
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
