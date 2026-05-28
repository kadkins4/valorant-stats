import { describe, it, expect } from "vitest";
import { rowToRankPoint } from "@/lib/db/queries";

describe("rowToRankPoint", () => {
  const base = {
    matchId: "m1",
    tier: 21,
    tierName: "Ascendant 1",
    rr: 78,
    lastChange: 18,
    elo: 1878,
    map: "Ascent",
  };

  it("normalizes a Date playedAt (DB row) to an ISO string", () => {
    const r = rowToRankPoint({
      ...base,
      playedAt: new Date("2026-05-20T22:29:57.065Z"),
    });
    expect(typeof r.playedAt).toBe("string");
    expect(r.playedAt).toBe("2026-05-20T22:29:57.065Z");
  });

  it("passes a string playedAt (snapshot row) through unchanged", () => {
    const r = rowToRankPoint({
      ...base,
      playedAt: "2026-05-20T22:29:57.065Z",
    });
    expect(typeof r.playedAt).toBe("string");
    expect(r.playedAt).toBe("2026-05-20T22:29:57.065Z");
  });
});
