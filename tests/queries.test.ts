import { describe, it, expect } from "vitest";
import { rowToRankPoint, rowToFightMatch } from "@/lib/db/queries";

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

describe("rowToFightMatch", () => {
  it("maps a row + detail.duels into a FightMatch with ISO date", () => {
    const fm = rowToFightMatch({
      matchId: "m1",
      map: "Ascent",
      season: "e10a3",
      playedAt: new Date("2026-05-20T22:29:57.065Z"),
      detail: { duels: [{ x: 1, y: 2, won: true, side: "attack", round: 0 }] },
    });
    expect(fm).toEqual({
      matchId: "m1",
      map: "Ascent",
      season: "e10a3",
      playedAt: "2026-05-20T22:29:57.065Z",
      duels: [{ x: 1, y: 2, won: true, side: "attack", round: 0 }],
    });
  });

  it("defaults duels to [] when detail is missing", () => {
    const fm = rowToFightMatch({
      matchId: "m2",
      map: "Bind",
      season: "e10a3",
      playedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(fm.duels).toEqual([]);
  });
});
