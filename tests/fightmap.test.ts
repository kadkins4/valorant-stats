import { describe, it, expect } from "vitest";
import {
  placeDuels,
  zonesFromPlaced,
  GRID_N,
  MIN_DUELS,
  collectDuels,
  seasonsOf,
  currentSeasonOf,
  mapsOf,
  mostPlayedMap,
  type TimeScope,
  winRateColor,
} from "@/lib/fightmap";
import type { MapCalibration } from "@/lib/maps/calibration";
import type { Duel, FightMatch } from "@/lib/types";

// Identity-ish calibration: nx = y, ny = x (so we can hand-pick cells).
const calib: MapCalibration = {
  name: "T",
  image: "x",
  xMultiplier: 1,
  yMultiplier: 1,
  xScalarToAdd: 0,
  yScalarToAdd: 0,
};
const duel = (x: number, y: number, won: boolean): Duel => ({
  x,
  y,
  won,
  side: "attack",
  round: 0,
});

describe("placeDuels", () => {
  it("normalizes + assigns grid cells (clamped to [0,gridN-1])", () => {
    const placed = placeDuels(
      [duel(0, 0, true), duel(0.99, 0.99, false)],
      calib,
      6,
    );
    expect(placed[0]).toMatchObject({
      nx: 0,
      ny: 0,
      col: 0,
      row: 0,
      won: true,
    });
    // x=0.99 -> ny=0.99 -> row=floor(5.94)=5 ; y=0.99 -> nx -> col=5
    expect(placed[1]).toMatchObject({ col: 5, row: 5, won: false });
  });
});

describe("zonesFromPlaced", () => {
  it("aggregates win/total per cell and mutes thin zones", () => {
    const placed = placeDuels(
      [duel(0.1, 0.1, true), duel(0.1, 0.1, true), duel(0.1, 0.1, false)], // 3 in one cell
      calib,
      6,
    );
    const zones = zonesFromPlaced(placed);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ wins: 2, total: 3 });
    expect(zones[0].winRate).toBeCloseTo(2 / 3);
    expect(zones[0].muted).toBe(true); // 3 < MIN_DUELS(4)
  });

  it("un-mutes a zone at the threshold", () => {
    const placed = placeDuels(
      Array.from({ length: MIN_DUELS }, () => duel(0.5, 0.5, true)),
      calib,
      GRID_N,
    );
    expect(zonesFromPlaced(placed)[0].muted).toBe(false);
  });
});

const d = (won: boolean, side: "attack" | "defense"): Duel => ({
  x: 0,
  y: 0,
  won,
  side,
  round: 0,
});
const fm = (
  id: string,
  map: string,
  season: string,
  playedAt: string,
  duels: Duel[],
): FightMatch => ({ matchId: id, map, season, playedAt, duels });

const data: FightMatch[] = [
  fm("m1", "Ascent", "e10a3", "2026-05-01T00:00:00.000Z", [
    d(true, "attack"),
    d(false, "defense"),
  ]),
  fm("m2", "Ascent", "e10a2", "2026-04-01T00:00:00.000Z", [d(true, "attack")]),
  fm("m3", "Bind", "e10a3", "2026-05-02T00:00:00.000Z", [d(false, "attack")]),
];

describe("collectDuels", () => {
  it("filters by map", () => {
    const all: TimeScope = { kind: "all" };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: all }),
    ).toHaveLength(3);
  });
  it("filters by side", () => {
    const all: TimeScope = { kind: "all" };
    expect(
      collectDuels(data, { map: "Ascent", side: "defense", time: all }),
    ).toHaveLength(1);
  });
  it("filters by season", () => {
    const t: TimeScope = { kind: "season", season: "e10a2" };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(1);
  });
  it("filters by last-N matches on the selected map (most recent first)", () => {
    const t: TimeScope = { kind: "lastN", n: 1 };
    // Ascent matches: m1 (May) and m2 (Apr) -> last 1 is m1 (2 duels)
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(2);
  });
});

describe("list helpers", () => {
  it("seasonsOf is unique + most-recent-first", () => {
    expect(seasonsOf(data)).toEqual(["e10a3", "e10a2"]);
  });
  it("currentSeasonOf is the most recent match's season", () => {
    expect(currentSeasonOf(data)).toBe("e10a3");
  });
  it("mapsOf is unique; mostPlayedMap is the modal map", () => {
    expect(mapsOf(data).sort()).toEqual(["Ascent", "Bind"]);
    expect(mostPlayedMap(data)).toBe("Ascent");
  });
});

describe("winRateColor", () => {
  it("maps 0 → red, 0.5 → gray, 1 → green", () => {
    expect(winRateColor(0)).toBe("rgb(181,72,61)");
    expect(winRateColor(0.5)).toBe("rgb(122,127,138)");
    expect(winRateColor(1)).toBe("rgb(46,139,87)");
  });
  it("interpolates between stops", () => {
    expect(winRateColor(0.25)).toBe("rgb(152,100,100)");
  });
});
