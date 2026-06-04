import type { Placed, RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";

export interface RegionModel {
  name: string;
  winRate: number;
  muted: boolean;
  polygon: [number, number][] | null; // null for untraced (callout) maps
  cx: number; // normalized centroid 0..1
  cy: number;
}

export interface RegionModelResult {
  regions: RegionModel[];
  assignment: number[]; // region index per input point; -1 only when there are no regions
}

/**
 * Normalize traced (polygon) or untraced (callout) regions into one shape plus a
 * point→region assignment. Indices match the source array order, so they are
 * interchangeable with RegionView's onSelectRegion index.
 */
export function buildRegionModel(
  points: Placed[],
  polyStats: PolyRegionStat[],
  calloutRegions: RegionStat[],
  polyAssignment: number[],
): RegionModelResult {
  if (polyStats.length) {
    const regions: RegionModel[] = polyStats.map((p) => ({
      name: p.name,
      winRate: p.winRate,
      muted: p.muted,
      polygon: p.polygon,
      cx: p.cx,
      cy: p.cy,
    }));
    return { regions, assignment: polyAssignment };
  }

  if (!calloutRegions.length) {
    return { regions: [], assignment: points.map(() => -1) };
  }

  const regions: RegionModel[] = calloutRegions.map((r) => ({
    name: r.regionName,
    winRate: r.winRate,
    muted: r.muted,
    polygon: null,
    cx: r.cx,
    cy: r.cy,
  }));
  const assignment = points.map((p) => {
    let best = 0,
      bestD = Infinity;
    calloutRegions.forEach((r, i) => {
      const d = (r.cx - p.nx) ** 2 + (r.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
  return { regions, assignment };
}
