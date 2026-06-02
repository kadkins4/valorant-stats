import { describe, it, expect } from "vitest";
import {
  pointInPolygon,
  assignByPolygon,
  polygonArea,
  assignFrags,
  type RegionPoly,
} from "@/lib/maps/regions";
import { MIN_DUELS, type Placed } from "@/lib/fightmap";

const square: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const placed = (nx: number, ny: number, won: boolean): Placed => ({
  nx,
  ny,
  won,
  side: "attack",
  col: 0,
  row: 0,
});

describe("pointInPolygon", () => {
  it("returns true for a point inside a unit square", () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
  });

  it("returns false for a point outside a unit square", () => {
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false);
  });
});

describe("assignByPolygon", () => {
  const left: RegionPoly = {
    name: "Left",
    points: [
      [0, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
    ],
  };
  const right: RegionPoly = {
    name: "Right",
    points: [
      [0.5, 0],
      [1, 0],
      [1, 1],
      [0.5, 1],
    ],
  };

  it("buckets points into the polygon that contains them", () => {
    const points = [
      placed(0.25, 0.5, true),
      placed(0.25, 0.5, false),
      placed(0.75, 0.5, true),
    ];
    const stats = assignByPolygon(points, [left, right]);
    expect(stats[0].total).toBe(2);
    expect(stats[0].wins).toBe(1);
    expect(stats[1].total).toBe(1);
    expect(stats[1].wins).toBe(1);
  });

  it("computes winRate", () => {
    const points = [placed(0.25, 0.5, true), placed(0.25, 0.5, false)];
    const stats = assignByPolygon(points, [left]);
    expect(stats[0].winRate).toBeCloseTo(0.5);
  });

  it("marks muted when total < MIN_DUELS", () => {
    const points = Array.from({ length: MIN_DUELS - 1 }, () =>
      placed(0.25, 0.5, true),
    );
    const stats = assignByPolygon(points, [left]);
    expect(stats[0].muted).toBe(true);
  });

  it("is not muted when total >= MIN_DUELS", () => {
    const points = Array.from({ length: MIN_DUELS }, () =>
      placed(0.25, 0.5, true),
    );
    const stats = assignByPolygon(points, [left]);
    expect(stats[0].muted).toBe(false);
  });

  it("computes centroid as average of vertices", () => {
    const stats = assignByPolygon([], [left]);
    expect(stats[0].cx).toBeCloseTo(0.25);
    expect(stats[0].cy).toBeCloseTo(0.5);
  });

  it("ignores points inside no polygon", () => {
    const points = [placed(5, 5, true)];
    const stats = assignByPolygon(points, [left, right]);
    expect(stats[0].total).toBe(0);
    expect(stats[1].total).toBe(0);
  });
});

describe("polygonArea", () => {
  it("computes the area of a unit square", () => {
    expect(
      polygonArea([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBeCloseTo(1);
  });
  it("computes the area of a right triangle", () => {
    expect(
      polygonArea([
        [0, 0],
        [1, 0],
        [0, 1],
      ]),
    ).toBeCloseTo(0.5);
  });
});

describe("assignFrags", () => {
  const big: RegionPoly = {
    name: "Big",
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
  const small: RegionPoly = {
    name: "Small",
    points: [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ],
  };

  it("assigns a frag in exactly one region with no flag", () => {
    const r = assignFrags([placed(0.1, 0.1, true)], [big]);
    expect(r.assignment).toEqual([0]);
    expect(r.flags).toEqual([]);
  });

  it("resolves an overlap to the smallest-area region and flags it", () => {
    // (0.5,0.5) is inside both big and small; small (index 1) wins.
    const r = assignFrags([placed(0.5, 0.5, true)], [big, small]);
    expect(r.assignment).toEqual([1]);
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatchObject({
      type: "overlap",
      winner: 1,
      contenders: [0, 1],
    });
  });

  it("snaps an outside frag to the nearest region and flags it", () => {
    // (0.9,0.1) is outside `small`; snapped to it (only region).
    const r = assignFrags([placed(0.9, 0.1, true)], [small]);
    expect(r.assignment).toEqual([0]);
    const f = r.flags[0];
    expect(f.type).toBe("snapped");
    if (f.type === "snapped") expect(f.distance).toBeGreaterThan(0);
  });

  it("returns -1 assignments and no flags when there are no regions", () => {
    const r = assignFrags([placed(0.5, 0.5, true)], []);
    expect(r.assignment).toEqual([-1]);
    expect(r.flags).toEqual([]);
  });
});
