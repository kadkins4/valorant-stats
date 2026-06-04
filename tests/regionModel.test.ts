import { describe, it, expect } from "vitest";
import { buildRegionModel } from "@/lib/fightmap/regionModel";
import type { Placed, RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";

const pt = (nx: number, ny: number): Placed =>
  ({ nx, ny, won: true, side: "attack", col: 0, row: 0 }) as Placed;

describe("buildRegionModel", () => {
  it("uses traced polygons and the supplied assignment", () => {
    const poly: PolyRegionStat[] = [
      {
        name: "A",
        polygon: [[0, 0]],
        cx: 0.2,
        cy: 0.2,
        wins: 1,
        total: 2,
        winRate: 0.5,
        muted: false,
      },
      {
        name: "B",
        polygon: [[1, 1]],
        cx: 0.8,
        cy: 0.8,
        wins: 1,
        total: 1,
        winRate: 1,
        muted: true,
      },
    ] as PolyRegionStat[];
    const { regions, assignment } = buildRegionModel(
      [pt(0.2, 0.2), pt(0.8, 0.8), pt(0.2, 0.2)],
      poly,
      [],
      [0, 1, 0],
    );
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({
      name: "A",
      polygon: [[0, 0]],
      muted: false,
    });
    expect(assignment).toEqual([0, 1, 0]);
  });

  it("falls back to nearest callout when there are no polygons", () => {
    const callouts: RegionStat[] = [
      {
        regionName: "Left",
        superRegionName: "",
        cx: 0.1,
        cy: 0.1,
        wins: 0,
        total: 1,
        winRate: 0,
        muted: true,
      },
      {
        regionName: "Right",
        superRegionName: "",
        cx: 0.9,
        cy: 0.9,
        wins: 1,
        total: 1,
        winRate: 1,
        muted: true,
      },
    ];
    const { regions, assignment } = buildRegionModel(
      [pt(0.15, 0.15), pt(0.85, 0.85)],
      [],
      callouts,
      [],
    );
    expect(regions.map((r) => r.name)).toEqual(["Left", "Right"]);
    expect(regions[0].polygon).toBeNull();
    expect(assignment).toEqual([0, 1]);
  });

  it("assigns -1 to every point when there are no regions", () => {
    const { regions, assignment } = buildRegionModel(
      [pt(0.5, 0.5)],
      [],
      [],
      [],
    );
    expect(regions).toEqual([]);
    expect(assignment).toEqual([-1]);
  });
});
