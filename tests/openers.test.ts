import { describe, it, expect } from "vitest";
import { openerStat, openerByRegion } from "@/lib/fightmap/openers";
import type { Placed } from "@/lib/fightmap";

const p = (over: Partial<Placed>): Placed => ({
  nx: 0.5,
  ny: 0.5,
  won: true,
  side: "attack",
  col: 0,
  row: 0,
  ...over,
});

describe("openerStat", () => {
  it("counts opener duels and wins, ignoring non-openers", () => {
    const stat = openerStat([
      p({ won: true, opener: true }),
      p({ won: false, opener: true }),
      p({ won: true, opener: true }),
      p({ won: true }), // not an opener
    ]);
    expect(stat).toEqual({ won: 2, total: 3, rate: 2 / 3 });
  });

  it("returns zeros (rate 0) when there are no openers", () => {
    expect(openerStat([p({ won: true }), p({ won: false })])).toEqual({
      won: 0,
      total: 0,
      rate: 0,
    });
  });
});

describe("openerByRegion", () => {
  it("tallies opener duels and wins per region index", () => {
    const points = [
      p({ won: true, opener: true }), // region 0
      p({ won: false, opener: true }), // region 0
      p({ won: true, opener: true }), // region 1
      p({ won: true }), // region 1, not opener
      p({ won: false, opener: true }), // region -1, unassigned
    ];
    const assignment = [0, 0, 1, 1, -1];
    expect(openerByRegion(points, assignment, 2)).toEqual([
      { won: 1, total: 2 },
      { won: 1, total: 1 },
    ]);
  });

  it("returns zero tallies for regions with no openers", () => {
    expect(openerByRegion([p({ won: true })], [0], 2)).toEqual([
      { won: 0, total: 0 },
      { won: 0, total: 0 },
    ]);
  });
});
