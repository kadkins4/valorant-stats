import { describe, it, expect } from "vitest";
import { placeDuels, zonesFromPlaced, GRID_N, MIN_DUELS } from "@/lib/fightmap";
import type { MapCalibration } from "@/lib/maps/calibration";
import type { Duel } from "@/lib/types";

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
