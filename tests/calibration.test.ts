import { describe, it, expect } from "vitest";
import {
  transformCoord,
  getCalibration,
  getCallouts,
  mapListIcon,
  mapSplash,
  type MapCalibration,
} from "@/lib/maps/calibration";

const calib: MapCalibration = {
  name: "Test",
  image: "x",
  xMultiplier: 0.0001,
  yMultiplier: 0.0001,
  xScalarToAdd: 0.5,
  yScalarToAdd: 0.5,
};

describe("transformCoord", () => {
  it("applies the Valorant formula with x/y swap, normalized", () => {
    // nx = y*xMul + xAdd ; ny = x*yMul + yAdd
    expect(transformCoord(calib, { x: 1000, y: 2000 })).toEqual({
      nx: 0.7,
      ny: 0.6,
    });
  });
});

describe("getCalibration", () => {
  it("looks up a real committed map case-insensitively", () => {
    expect(getCalibration("ascent")?.name).toBe("Ascent");
  });
  it("returns undefined for an unknown map", () => {
    expect(getCalibration("Nonexistent")).toBeUndefined();
  });
});

describe("getCallouts", () => {
  it("returns callouts for a real committed map with numeric coords", () => {
    const callouts = getCallouts("Ascent");
    expect(callouts.length).toBeGreaterThan(0);
    const c = callouts[0];
    expect(typeof c.regionName).toBe("string");
    expect(typeof c.x).toBe("number");
    expect(typeof c.y).toBe("number");
  });
  it("returns [] for an unknown map", () => {
    expect(getCallouts("Nonexistent")).toEqual([]);
  });
});

describe("mapListIcon", () => {
  it("derives the listViewIcon URL from a calibrated map", () => {
    const url = mapListIcon("Ascent");
    expect(url).not.toBeNull();
    expect(url).toContain("listviewicon.png");
    expect(url).not.toContain("displayicon");
    expect(url).toBe(
      getCalibration("Ascent")!.image.replace("displayicon", "listviewicon"),
    );
  });
  it("is case-insensitive on the map name", () => {
    expect(mapListIcon("ascent")).toBe(mapListIcon("Ascent"));
  });
  it("returns null for an unknown map", () => {
    expect(mapListIcon("Nonexistent")).toBeNull();
  });
});

describe("mapSplash", () => {
  it("derives the high-res splash URL from a calibrated map", () => {
    const url = mapSplash("Ascent");
    expect(url).not.toBeNull();
    expect(url).toContain("splash.png");
    expect(url).not.toContain("displayicon");
    expect(url).toBe(
      getCalibration("Ascent")!.image.replace("displayicon", "splash"),
    );
  });
  it("returns null for an unknown map", () => {
    expect(mapSplash("Nonexistent")).toBeNull();
  });
});
