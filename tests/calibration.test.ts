import { describe, it, expect } from "vitest";
import {
  transformCoord,
  getCalibration,
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
