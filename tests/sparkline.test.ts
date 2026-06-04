import { describe, it, expect } from "vitest";
import { sparklineGeometry } from "@/lib/home/sparkline";

describe("sparklineGeometry", () => {
  it("maps values to points across width and flips Y (SVG origin top-left)", () => {
    const g = sparklineGeometry([0, 1, 2], 200, 40);
    expect(g.points).toEqual([
      [0, 40],
      [100, 20],
      [200, 0],
    ]);
  });
  it("reports an up trend when last >= first, down otherwise", () => {
    expect(sparklineGeometry([1, 2, 3], 100, 20).trend).toBe("up");
    expect(sparklineGeometry([3, 2, 1], 100, 20).trend).toBe("down");
  });
  it("handles a flat series without NaN", () => {
    const g = sparklineGeometry([2, 2, 2], 100, 20);
    expect(g.points.every(([, y]) => y === 10)).toBe(true);
    expect(g.trend).toBe("up");
  });
  it("returns empty points for <2 values", () => {
    expect(sparklineGeometry([5], 100, 20).points).toEqual([]);
    expect(sparklineGeometry([], 100, 20).points).toEqual([]);
  });
});
