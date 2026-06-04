import { describe, it, expect } from "vitest";
import {
  regionBounds,
  viewBoxString,
  FULL_VIEWBOX,
  easeInOutCubic,
  lerpViewBox,
} from "@/lib/fightmap/zoom";

describe("regionBounds", () => {
  it("uses the polygon bbox, padded, for a central region", () => {
    const poly: [number, number][] = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ];
    expect(regionBounds(poly, [])).toEqual({ x: 36, y: 36, w: 28, h: 28 });
  });

  it("grows a tiny region to the minimum side, centered", () => {
    const poly: [number, number][] = [
      [0.5, 0.5],
      [0.51, 0.5],
      [0.51, 0.51],
      [0.5, 0.51],
    ];
    const b = regionBounds(poly, []);
    expect(b.w).toBeCloseTo(20);
    expect(b.h).toBeCloseTo(20);
    expect(b.x).toBeCloseTo(40.5);
  });

  it("clamps a corner region inside [0,100]", () => {
    const poly: [number, number][] = [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
      [0, 0.1],
    ];
    const b = regionBounds(poly, []);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(100);
    expect(b.y + b.h).toBeLessThanOrEqual(100);
  });

  it("falls back to the duel bbox when there is no polygon", () => {
    const b = regionBounds(null, [
      { nx: 0.3, ny: 0.3 },
      { nx: 0.5, ny: 0.5 },
    ]);
    expect(b).toEqual({ x: 26, y: 26, w: 28, h: 28 });
  });

  it("viewBoxString formats and FULL_VIEWBOX is the whole map", () => {
    expect(viewBoxString({ x: 1, y: 2, w: 3, h: 4 })).toBe("1 2 3 4");
    expect(viewBoxString(FULL_VIEWBOX)).toBe("0 0 100 100");
  });
});

describe("easeInOutCubic", () => {
  it("pins the endpoints at 0 and 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("is symmetric about the midpoint", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    // f(t) + f(1 - t) === 1 for an ease-in-out curve.
    expect(easeInOutCubic(0.3) + easeInOutCubic(0.7)).toBeCloseTo(1);
  });

  it("stays within [0,1] and is monotonic non-decreasing", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = easeInOutCubic(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("lerpViewBox", () => {
  const from = { x: 0, y: 0, w: 100, h: 100 };
  const to = { x: 20, y: 40, w: 30, h: 50 };

  it("returns from at t=0", () => {
    expect(lerpViewBox(from, to, 0)).toEqual(from);
  });

  it("returns to at t=1", () => {
    expect(lerpViewBox(from, to, 1)).toEqual(to);
  });

  it("returns the exact midpoint of each component at t=0.5", () => {
    expect(lerpViewBox(from, to, 0.5)).toEqual({ x: 10, y: 20, w: 65, h: 75 });
  });
});
