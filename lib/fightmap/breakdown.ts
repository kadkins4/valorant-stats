import type { Placed } from "@/lib/fightmap";
import type { RegionModel } from "@/lib/fightmap/regionModel";
import { openerByRegion } from "@/lib/fightmap/openers";

export type Result = "Mostly win" | "Even" | "Mostly lose" | "Low sample";

export interface RegionRow {
  index: number; // index into the regions array (== zoom target / RegionView index)
  name: string;
  duels: number;
  winRate: number; // 0..1
  muted: boolean; // low-sample
  result: Result;
  openerWon: number;
  openerTotal: number;
  label: string; // accessible button name
}

export interface DuelRow {
  index: number; // index into the zoomed-region duel array (aligns with the rendered dot)
  won: boolean;
  weapon: string | null;
  round: number | null;
  enemyAgent: string | null;
  opener: boolean;
  label: string; // accessible button name
}

// Even band centered on the legend's "Even = 50%"; muted (below MIN_DUELS) => "Low sample".
export function resultBand(winRate: number, muted: boolean): Result {
  if (muted) return "Low sample";
  if (winRate < 0.45) return "Mostly lose";
  if (winRate > 0.55) return "Mostly win";
  return "Even";
}

// Coarse vertical bands over the 0..1 centroid space, so a roughly-horizontal row of
// regions reads left->right before dropping to the next band (spatial reading order).
const READING_BANDS = 5;

// Regions with >= 1 duel, in spatial reading order (centroid top->bottom band, then left->right).
export function buildRegionRows(
  regions: RegionModel[],
  assignment: number[],
  points: Placed[],
): RegionRow[] {
  const counts = new Array(regions.length).fill(0);
  for (const a of assignment) {
    if (a >= 0 && a < counts.length) counts[a]++;
  }
  const openers = openerByRegion(points, assignment, regions.length);
  const rows: RegionRow[] = [];
  regions.forEach((r, index) => {
    const duels = counts[index];
    if (duels < 1) return;
    const result = resultBand(r.winRate, r.muted);
    const pct = Math.round(r.winRate * 100);
    const op = openers[index];
    const base = `${r.name}, ${duels} duel${duels === 1 ? "" : "s"}, ${pct}% win rate, ${result.toLowerCase()}`;
    rows.push({
      index,
      name: r.name,
      duels,
      winRate: r.winRate,
      muted: r.muted,
      result,
      openerWon: op.won,
      openerTotal: op.total,
      label: op.total ? `${base}, ${op.won} of ${op.total} openings won` : base,
    });
  });
  rows.sort((a, b) => {
    const ra = regions[a.index];
    const rb = regions[b.index];
    const band =
      Math.round(ra.cy * READING_BANDS) - Math.round(rb.cy * READING_BANDS);
    return band !== 0 ? band : ra.cx - rb.cx;
  });
  return rows;
}

// The zoomed region's duels. `index` is the source position (aligns with the rendered dot);
// display order is round ascending (nulls last), then kills before deaths.
export function buildDuelRows(duels: Placed[]): DuelRow[] {
  const rows: DuelRow[] = duels.map((d, index) => {
    const weapon = d.weapon ?? null;
    const round = d.round ?? null;
    const enemyAgent = d.enemyAgent ?? null;
    const opener = !!d.opener;
    const parts = [d.won ? "Kill" : "Death"];
    if (weapon) parts.push(weapon);
    if (round != null) parts.push(`round ${round}`);
    if (enemyAgent) parts.push(`vs ${enemyAgent}`);
    if (opener) parts.push("opening duel");
    return {
      index,
      won: d.won,
      weapon,
      round,
      enemyAgent,
      opener,
      label: parts.join(", "),
    };
  });
  return rows.sort((a, b) => {
    const ra = a.round ?? Infinity;
    const rb = b.round ?? Infinity;
    if (ra !== rb) return ra - rb;
    if (a.won !== b.won) return a.won ? -1 : 1;
    return a.index - b.index;
  });
}
