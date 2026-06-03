export type Pt = [number, number];

/** Midpoint of every edge i -> i+1, wrapping the last edge back to the first. */
export function midpoints(points: Pt[]): Pt[] {
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2] as Pt;
  });
}

/** Replace vertex i with pt. Out-of-range i returns the input unchanged. */
export function moveVertex(points: Pt[], i: number, pt: Pt): Pt[] {
  if (i < 0 || i >= points.length) return points;
  const out = points.slice();
  out[i] = pt;
  return out;
}

/** Insert pt into the edge edgeIndex (i -> i+1), spliced at edgeIndex + 1.
 *  Out-of-range edgeIndex returns the input unchanged (no silent mis-insert). */
export function insertVertex(points: Pt[], edgeIndex: number, pt: Pt): Pt[] {
  if (edgeIndex < 0 || edgeIndex >= points.length) return points;
  const out = points.slice();
  out.splice(edgeIndex + 1, 0, pt);
  return out;
}

/** Remove vertex i and heal. Returns null if the result would have < 3 vertices. */
export function deleteVertex(points: Pt[], i: number): Pt[] | null {
  if (points.length <= 3) return null;
  if (i < 0 || i >= points.length) return points;
  return points.filter((_, idx) => idx !== i);
}
