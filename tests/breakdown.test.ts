import { describe, it, expect } from "vitest";
import {
  resultBand,
  buildRegionRows,
  buildDuelRows,
} from "@/lib/fightmap/breakdown";
import type { RegionModel } from "@/lib/fightmap/regionModel";
import type { Placed } from "@/lib/fightmap";

const region = (over: Partial<RegionModel>): RegionModel => ({
  name: "R",
  winRate: 0.5,
  muted: false,
  polygon: null,
  cx: 0.5,
  cy: 0.5,
  ...over,
});

const duel = (over: Partial<Placed>): Placed => ({
  nx: 0.5,
  ny: 0.5,
  won: true,
  side: "attack",
  col: 0,
  row: 0,
  ...over,
});

describe("resultBand", () => {
  it("returns Low sample when muted, regardless of win rate", () => {
    expect(resultBand(0.9, true)).toBe("Low sample");
  });
  it("bands win rate around the even zone 0.45..0.55", () => {
    expect(resultBand(0.4, false)).toBe("Mostly lose");
    expect(resultBand(0.6, false)).toBe("Mostly win");
    expect(resultBand(0.5, false)).toBe("Even");
    expect(resultBand(0.45, false)).toBe("Even");
    expect(resultBand(0.55, false)).toBe("Even");
  });
});

describe("buildRegionRows", () => {
  it("drops zero-duel regions and counts duels from the assignment", () => {
    const regions = [region({ name: "A" }), region({ name: "B" })];
    const rows = buildRegionRows(regions, [0, 0, 0], []); // 3 duels in A, none in B
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("A");
    expect(rows[0].duels).toBe(3);
  });

  it("orders rows in spatial reading order (top band left->right, then down)", () => {
    const regions = [
      region({ name: "bottom", cy: 0.8, cx: 0.5 }), // index 0
      region({ name: "top-right", cy: 0.1, cx: 0.7 }), // index 1
      region({ name: "top-left", cy: 0.1, cx: 0.2 }), // index 2
    ];
    const rows = buildRegionRows(regions, [0, 1, 2], []);
    expect(rows.map((r) => r.index)).toEqual([2, 1, 0]);
  });

  it("builds an accessible label with duels, win %, and result word", () => {
    const rows = buildRegionRows(
      [region({ name: "A Site", winRate: 0.58 })],
      [0, 0],
      [],
    );
    expect(rows[0].label).toBe("A Site, 2 duels, 58% win rate, mostly win");
  });

  it("labels a muted region as low sample", () => {
    const rows = buildRegionRows(
      [region({ name: "Garden", winRate: 1, muted: true })],
      [0],
      [],
    );
    expect(rows[0].label).toBe("Garden, 1 duel, 100% win rate, low sample");
  });

  it("tallies per-region openers and appends them to the label", () => {
    const regions = [region({ name: "A Main", winRate: 0.5 })];
    const points = [
      duel({ won: true, opener: true }),
      duel({ won: false, opener: true }),
      duel({ won: true }), // not an opener
    ];
    const rows = buildRegionRows(regions, [0, 0, 0], points);
    expect(rows[0].openerWon).toBe(1);
    expect(rows[0].openerTotal).toBe(2);
    expect(rows[0].label).toBe(
      "A Main, 3 duels, 50% win rate, even, 1 of 2 openings won",
    );
  });

  it("omits the opener suffix when a region has no openers", () => {
    const rows = buildRegionRows(
      [region({ name: "A Site", winRate: 0.58 })],
      [0, 0],
      [duel({ won: true }), duel({ won: false })],
    );
    expect(rows[0].openerTotal).toBe(0);
    expect(rows[0].label).toBe("A Site, 2 duels, 58% win rate, mostly win");
  });
});

describe("buildDuelRows", () => {
  it("orders by round ascending then kills before deaths, preserving source index", () => {
    const duels = [
      duel({ won: false, round: 3, weapon: "Operator", enemyAgent: "Jett" }), // 0
      duel({ won: true, round: 1, weapon: "Vandal" }), // 1
      duel({ won: false, round: 1 }), // 2
    ];
    const rows = buildDuelRows(duels);
    expect(rows.map((r) => r.index)).toEqual([1, 2, 0]);
  });

  it("sorts round-less duels last", () => {
    const duels = [
      duel({ won: true }), // 0: no round -> last
      duel({ won: false, round: 2 }), // 1
      duel({ won: true, round: 1 }), // 2
    ];
    const rows = buildDuelRows(duels);
    expect(rows.map((r) => r.index)).toEqual([2, 1, 0]);
  });

  it("builds accessible labels, omitting missing weapon/round/enemy", () => {
    const rows = buildDuelRows([
      duel({ won: true, weapon: "Vandal", round: 7, enemyAgent: "Jett" }),
      duel({ won: false, round: 1 }),
    ]);
    expect(rows.find((r) => r.won)!.label).toBe(
      "Kill, Vandal, round 7, vs Jett",
    );
    expect(rows.find((r) => !r.won)!.label).toBe("Death, round 1");
  });

  it("flags opener duels and labels them as opening duels", () => {
    const rows = buildDuelRows([
      duel({ won: true, weapon: "Vandal", round: 1, opener: true }),
      duel({ won: false, round: 2 }),
    ]);
    const kill = rows.find((r) => r.won)!;
    expect(kill.opener).toBe(true);
    expect(kill.label).toBe("Kill, Vandal, round 1, opening duel");
    expect(rows.find((r) => !r.won)!.opener).toBe(false);
  });
});
