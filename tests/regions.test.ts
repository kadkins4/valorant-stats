import { describe, it, expect } from "vitest";
import {
  pointInPolygon,
  assignByPolygon,
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
