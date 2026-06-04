import { describe, it, expect } from "vitest";
import { easeOutCubic, countUpValue } from "@/lib/home/countup";

describe("easeOutCubic", () => {
  it("maps endpoints 0→0 and 1→1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("clamps progress outside [0,1]", () => {
    expect(easeOutCubic(-5)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
  });
  it("eases out (fast then slow) — past halfway by p=0.5", () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
});

describe("countUpValue", () => {
  it("formats integers at full progress", () => {
    expect(countUpValue(312, 1, 0)).toBe("312");
  });
  it("formats decimals at full progress", () => {
    expect(countUpValue(1.24, 1, 2)).toBe("1.24");
  });
  it("starts near zero with the right precision", () => {
    expect(countUpValue(100, 0, 0)).toBe("0");
    expect(countUpValue(1.24, 0, 2)).toBe("0.00");
  });
});
