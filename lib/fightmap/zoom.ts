export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_VIEWBOX: ViewBox = { x: 0, y: 0, w: 100, h: 100 };

// Minimum side length (user units) so a tiny region doesn't zoom to extreme magnification.
const MIN_SIDE = 20;

/**
 * Bounding box (in 0..100 SVG user space) to zoom to for a region.
 * Sources points from the polygon when traced, else from the region's duels.
 * Pads, enforces a minimum side, and clamps inside [0,100].
 */
export function regionBounds(
  polygon: [number, number][] | null,
  duels: { nx: number; ny: number }[],
): ViewBox {
  const pts: [number, number][] =
    polygon && polygon.length ? polygon : duels.map((d) => [d.nx, d.ny]);
  if (!pts.length) return { ...FULL_VIEWBOX };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // Scale normalized 0..1 coords into the 0..100 SVG user space.
  let x0 = minX * 100,
    y0 = minY * 100,
    x1 = maxX * 100,
    y1 = maxY * 100;

  const pad = Math.max(4, 0.08 * Math.max(x1 - x0, y1 - y0));
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;

  // Grow each axis to MIN_SIDE about its center.
  const grow = (a: number, b: number): [number, number] => {
    if (b - a >= MIN_SIDE) return [a, b];
    const c = (a + b) / 2;
    return [c - MIN_SIDE / 2, c + MIN_SIDE / 2];
  };
  [x0, x1] = grow(x0, x1);
  [y0, y1] = grow(y0, y1);

  // Clamp inside the map.
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(100, x1);
  y1 = Math.min(100, y1);

  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function viewBoxString(b: ViewBox): string {
  return `${b.x} ${b.y} ${b.w} ${b.h}`;
}

// Ease-in-out cubic. t in [0,1] -> eased [0,1]. Endpoints fixed at 0 and 1.
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Component-wise linear interpolation between two view boxes at parameter t in [0,1].
export function lerpViewBox(from: ViewBox, to: ViewBox, t: number): ViewBox {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  };
}
