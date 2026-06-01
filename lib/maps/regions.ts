import { MIN_DUELS, type Placed } from "@/lib/fightmap";

export interface RegionPoly {
  name: string;
  points: [number, number][];
} // points normalized [0,1]

export interface PolyRegionStat {
  name: string;
  polygon: [number, number][];
  cx: number;
  cy: number;
  wins: number;
  total: number;
  winRate: number;
  muted: boolean;
}

export function pointInPolygon(
  pt: [number, number],
  poly: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    const intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function assignByPolygon(
  points: Placed[],
  regions: RegionPoly[],
): PolyRegionStat[] {
  const acc = regions.map(() => ({ wins: 0, total: 0 }));
  for (const p of points) {
    const idx = regions.findIndex((r) =>
      pointInPolygon([p.nx, p.ny], r.points),
    );
    if (idx < 0) continue;
    acc[idx].total++;
    if (p.won) acc[idx].wins++;
  }
  return regions.map((r, i) => {
    const cx = r.points.reduce((s, q) => s + q[0], 0) / r.points.length;
    const cy = r.points.reduce((s, q) => s + q[1], 0) / r.points.length;
    return {
      name: r.name,
      polygon: r.points,
      cx,
      cy,
      wins: acc[i].wins,
      total: acc[i].total,
      winRate: acc[i].total ? acc[i].wins / acc[i].total : 0,
      muted: acc[i].total < MIN_DUELS,
    };
  });
}
