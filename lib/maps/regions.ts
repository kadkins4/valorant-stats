import { MIN_DUELS, type Placed } from "@/lib/fightmap";
import { REGIONS } from "./regions/index";

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

// Shoelace area of a normalized polygon (absolute value).
export function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(a) / 2;
}

// Shortest distance from point p to segment a–b (normalized units).
function distToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

// Nearest distance from a point to a polygon's boundary.
function distToPolygon(p: [number, number], poly: [number, number][]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment(p, poly[j], poly[i]);
    if (d < min) min = d;
  }
  return min;
}

export type FragFlag =
  | {
      type: "overlap";
      pointIndex: number;
      winner: number;
      contenders: number[];
    }
  | { type: "snapped"; pointIndex: number; nearest: number; distance: number };

export interface FragAssignment {
  assignment: number[]; // region index per input point; -1 only if regions is empty
  flags: FragFlag[];
}

// The single source of truth: assign each frag to exactly one region.
// In >1 region (overlap) → smallest-area region wins. In 0 regions (outside) →
// nearest-edge region. Both noteworthy cases are recorded as flags.
export function assignFrags(
  points: Placed[],
  regions: RegionPoly[],
): FragAssignment {
  if (regions.length === 0) {
    return { assignment: points.map(() => -1), flags: [] };
  }
  const areas = regions.map((r) => polygonArea(r.points));
  const assignment: number[] = [];
  const flags: FragFlag[] = [];

  points.forEach((p, pointIndex) => {
    const pt: [number, number] = [p.nx, p.ny];
    const inside: number[] = [];
    for (let i = 0; i < regions.length; i++) {
      if (pointInPolygon(pt, regions[i].points)) inside.push(i);
    }

    if (inside.length === 1) {
      assignment.push(inside[0]);
    } else if (inside.length > 1) {
      let winner = inside[0];
      for (const i of inside) if (areas[i] < areas[winner]) winner = i;
      assignment.push(winner);
      flags.push({ type: "overlap", pointIndex, winner, contenders: inside });
    } else {
      let nearest = 0;
      let best = Infinity;
      for (let i = 0; i < regions.length; i++) {
        const d = distToPolygon(pt, regions[i].points);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      assignment.push(nearest);
      flags.push({ type: "snapped", pointIndex, nearest, distance: best });
    }
  });

  return { assignment, flags };
}

// Build per-region stats from a precomputed assignment (one region index per
// point; negative indices are skipped).
export function statsFromAssignment(
  points: Placed[],
  regions: RegionPoly[],
  assignment: number[],
): PolyRegionStat[] {
  const acc = regions.map(() => ({ wins: 0, total: 0 }));
  assignment.forEach((idx, i) => {
    if (idx < 0) return;
    acc[idx].total++;
    if (points[i].won) acc[idx].wins++;
  });
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

// Back-compat convenience: assign then tally in one call.
export function assignByPolygon(
  points: Placed[],
  regions: RegionPoly[],
): PolyRegionStat[] {
  const { assignment } = assignFrags(points, regions);
  return statsFromAssignment(points, regions, assignment);
}

export function getRegions(map: string): RegionPoly[] {
  return REGIONS[map.toLowerCase()] ?? [];
}
