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
  type Placed,
  winRateColor,
  formatSeason,
  assignRegions,
  sideSplit,
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
  it("filters by a single season", () => {
    const t: TimeScope = { kind: "seasons", seasons: ["e10a2"] };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(1);
  });
  it("unions duels across multiple selected seasons", () => {
    // Ascent: m1 (e10a3, 2 duels) + m2 (e10a2, 1 duel) = 3
    const t: TimeScope = { kind: "seasons", seasons: ["e10a3", "e10a2"] };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(3);
  });
  it("returns [] for an empty seasons selection", () => {
    const t: TimeScope = { kind: "seasons", seasons: [] };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toEqual([]);
  });
  it("filters by last-N matches on the selected map (most recent first)", () => {
    const t: TimeScope = { kind: "lastN", n: 1 };
    // Ascent matches: m1 (May) and m2 (Apr) -> last 1 is m1 (2 duels)
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(2);
  });
  it("last-N spans the 2 most-recent matches", () => {
    const t: TimeScope = { kind: "lastN", n: 2 };
    // Ascent: m1 (2 duels) + m2 (1 duel) = 3
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(3);
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

describe("formatSeason", () => {
  it("formats episode/act codes", () => {
    expect(formatSeason("e4a3")).toBe("E4 A3");
    expect(formatSeason("e11a1")).toBe("E11 A1");
  });
  it("uppercases unrecognized input", () => {
    expect(formatSeason("weird")).toBe("WEIRD");
  });
});

describe("assignRegions", () => {
  const callouts = [
    { regionName: "A Site", superRegionName: "A", cx: 0.2, cy: 0.2 },
    { regionName: "B Site", superRegionName: "B", cx: 0.8, cy: 0.8 },
  ];
  const placed = (nx: number, ny: number, won: boolean): Placed => ({
    nx,
    ny,
    won,
    side: "attack",
    col: 0,
    row: 0,
  });

  it("buckets each duel to its nearest callout and tallies win/total", () => {
    const points: Placed[] = [
      // 5 near callout 0 (A): 3 wins, 2 losses
      placed(0.18, 0.22, true),
      placed(0.22, 0.18, true),
      placed(0.25, 0.25, true),
      placed(0.15, 0.15, false),
      placed(0.21, 0.19, false),
      // 2 near callout 1 (B): 1 win, 1 loss
      placed(0.82, 0.78, true),
      placed(0.79, 0.83, false),
    ];
    const regions = assignRegions(points, callouts);
    expect(regions).toHaveLength(2);

    const a = regions[0];
    expect(a.regionName).toBe("A Site");
    expect(a.superRegionName).toBe("A");
    expect(a.cx).toBe(0.2);
    expect(a.cy).toBe(0.2);
    expect(a).toMatchObject({ wins: 3, total: 5 });
    expect(a.winRate).toBeCloseTo(3 / 5);
    expect(a.muted).toBe(false); // 5 >= MIN_DUELS(4)

    const b = regions[1];
    expect(b).toMatchObject({ wins: 1, total: 2 });
    expect(b.winRate).toBeCloseTo(1 / 2);
    expect(b.muted).toBe(true); // 2 < MIN_DUELS(4)
  });

  it("yields zeroed, muted stats for callouts with no nearby duels", () => {
    const regions = assignRegions([placed(0.2, 0.2, true)], callouts);
    expect(regions[1]).toMatchObject({
      wins: 0,
      total: 0,
      winRate: 0,
      muted: true,
    });
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

const TEST_CALIB = calib;

const duelSide = (
  x: number,
  y: number,
  won: boolean,
  side: "attack" | "defense",
): Duel => ({ x, y, won, side, round: 0 });

describe("placeDuels side", () => {
  it("carries each duel's side onto the placed point", () => {
    const placed = placeDuels(
      [duelSide(0, 0, true, "attack"), duelSide(0.5, 0.5, false, "defense")],
      calib,
      6,
    );
    expect(placed[0].side).toBe("attack");
    expect(placed[1].side).toBe("defense");
  });
});

describe("sideSplit", () => {
  const p = (won: boolean, side: "attack" | "defense"): Placed => ({
    nx: 0,
    ny: 0,
    won,
    side,
    col: 0,
    row: 0,
  });

  it("tallies wins and totals per side", () => {
    const s = sideSplit([
      p(true, "attack"),
      p(false, "attack"),
      p(true, "defense"),
    ]);
    expect(s.attack).toEqual({ wins: 1, total: 2 });
    expect(s.defense).toEqual({ wins: 1, total: 1 });
  });

  it("returns null for a side with no duels", () => {
    const s = sideSplit([p(true, "attack")]);
    expect(s.attack).toEqual({ wins: 1, total: 1 });
    expect(s.defense).toBeNull();
  });

  it("returns null for both sides when empty", () => {
    expect(sideSplit([])).toEqual({ attack: null, defense: null });
  });
});

describe("placeDuels Bucket C passthrough", () => {
  it("normalizes both positions and passes metadata through", () => {
    const d: Duel = {
      x: 0,
      y: 0,
      won: true,
      side: "attack",
      round: 3,
      mx: 10,
      my: 20,
      ex: 10,
      ey: 120,
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      opener: true,
    };
    const [p] = placeDuels([d], TEST_CALIB);
    // TEST_CALIB is unit-scale and swaps axes (nx = y, ny = x).
    expect(p).toMatchObject({ mnx: 20, mny: 10, enx: 120, eny: 10 });
    // Duelists are 100 world-units apart; / WORLD_PER_METER (100) = 1 m.
    expect(p.dist).toBe(1);
    expect(p).toMatchObject({
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      round: 3,
      opener: true,
    });
  });
  it("leaves positions undefined when absent", () => {
    const d: Duel = { x: 0, y: 0, won: false, side: "defense", round: 1 };
    const [p] = placeDuels([d], TEST_CALIB);
    expect(p.mnx).toBeUndefined();
    expect(p.enx).toBeUndefined();
    expect(p.dist).toBeUndefined();
  });
});
