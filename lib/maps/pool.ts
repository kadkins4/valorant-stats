// The current VALORANT competitive (ranked) map pool. Riot rotates this every
// act, so it's a hand-maintained list — update it whenever the pool changes.
// Names must match the calibration map names. The FragsMap picker only offers
// maps in this pool.
//
export const COMPETITIVE_POOL: readonly string[] = [
  "Abyss",
  "Ascent",
  "Bind",
  "Breeze",
  "Corrode",
  "Fracture",
  "Haven",
  "Icebox",
  "Lotus",
  "Pearl",
  "Split",
  "Sunset",
];

// Restrict available maps to the competitive pool, preserving the input order.
// Falls back to the full list when none of the available maps are in the pool,
// so the picker never renders empty (e.g. if the pool is misconfigured).
export function poolMaps(
  available: string[],
  pool: readonly string[] = COMPETITIVE_POOL,
): string[] {
  const inPool = available.filter((m) => pool.includes(m));
  return inPool.length > 0 ? inPool : available;
}
