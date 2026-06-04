import { describe, it, expect } from "vitest";
import { regionBounds, viewBoxString, FULL_VIEWBOX } from "@/lib/fightmap/zoom";

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
