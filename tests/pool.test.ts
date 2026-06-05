import { describe, it, expect } from "vitest";
import { poolMaps, COMPETITIVE_POOL } from "@/lib/maps/pool";

describe("poolMaps", () => {
  it("keeps only pool maps, preserving input order", () => {
    expect(
      poolMaps(["Split", "Ascent", "Pearl", "Bind"], ["Ascent", "Bind"]),
    ).toEqual(["Ascent", "Bind"]);
  });

  it("falls back to all available maps when none are in the pool", () => {
    expect(poolMaps(["Split", "Pearl"], ["Ascent", "Bind"])).toEqual([
      "Split",
      "Pearl",
    ]);
  });

  it("defaults to the live pool and drops non-pool maps", () => {
    // Whatever the live pool is, an unknown map is dropped and the pool kept.
    const got = poolMaps([...COMPETITIVE_POOL, "ZZZNotAMap"]);
    expect(got).toEqual([...COMPETITIVE_POOL]);
  });

  it("exposes a non-empty pool of valid names", () => {
    expect(COMPETITIVE_POOL.length).toBeGreaterThan(0);
    expect(
      COMPETITIVE_POOL.every((m) => typeof m === "string" && m.length > 0),
    ).toBe(true);
  });
});
