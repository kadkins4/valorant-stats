// Pure, data-agnostic clustering of FragsMap duel dots by on-screen proximity.
// All distances are in the SVG viewBox space (0..100); points come in with
// normalized nx,ny (0..1) and are scaled by 100 here.

// Two dots (radius 1.6 in viewBox units) visually overlap when their centers are
// within ~2× the radius. This is a fixed visual constant — NOT derived from data.
export const CLUSTER_RADIUS = 3.2;

// Ring radius used to fan a cluster's handles out when expanded. Fixed visual constant.
export const FAN_RADIUS = 6;

export interface Cluster {
  members: number[]; // indices into the source points array
  cx: number; // centroid x in viewBox units (0..100)
  cy: number; // centroid y in viewBox units (0..100)
}

// Single-linkage union-find: any two points within `radius` join the same cluster
// (transitive chains allowed). Deterministic: members ascending, clusters sorted by
// first member index. Singletons are returned as clusters of length 1.
export function clusterDuels(
  points: { nx: number; ny: number }[],
  radius = CLUSTER_RADIUS,
): Cluster[] {
  const n = points.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const px = points.map((p) => p.nx * 100);
  const py = points.map((p) => p.ny * 100);
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = px[i] - px[j];
      const dy = py[i] - py[j];
      if (dx * dx + dy * dy <= r2) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(i);
    else groups.set(root, [i]);
  }

  const clusters: Cluster[] = [...groups.values()].map((members) => {
    members.sort((a, b) => a - b);
    let sx = 0;
    let sy = 0;
    for (const i of members) {
      sx += px[i];
      sy += py[i];
    }
    return { members, cx: sx / members.length, cy: sy / members.length };
  });
  clusters.sort((a, b) => a.members[0] - b.members[0]);
  return clusters;
}

// n evenly-spaced points on a circle of radius `fanRadius` around (cx,cy),
// starting at the top and going clockwise. Deterministic ordering.
export function fanPositions(
  cx: number,
  cy: number,
  n: number,
  fanRadius = FAN_RADIUS,
): { x: number; y: number }[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    out.push({
      x: cx + fanRadius * Math.cos(a),
      y: cy + fanRadius * Math.sin(a),
    });
  }
  return out;
}
