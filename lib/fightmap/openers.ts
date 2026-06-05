import type { Placed } from "@/lib/fightmap";

export interface OpenerStat {
  won: number;
  total: number;
  rate: number; // won / total, 0 when total === 0
}

// Aggregate entry (opening-duel) success across a placed set.
export function openerStat(points: Placed[]): OpenerStat {
  let won = 0;
  let total = 0;
  for (const p of points) {
    if (!p.opener) continue;
    total++;
    if (p.won) won++;
  }
  return { won, total, rate: total ? won / total : 0 };
}

// Per-region opener tally, indexed 0..n-1. Points with assignment -1 (or out of
// range) are ignored, matching buildRegionRows' defensive counting.
export function openerByRegion(
  points: Placed[],
  assignment: number[],
  n: number,
): { won: number; total: number }[] {
  const out = Array.from({ length: n }, () => ({ won: 0, total: 0 }));
  points.forEach((p, i) => {
    if (!p.opener) return;
    const r = assignment[i];
    if (r < 0 || r >= n) return;
    out[r].total++;
    if (p.won) out[r].won++;
  });
  return out;
}
