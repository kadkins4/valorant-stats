import { describe, it, expect } from "vitest";
import { storedMatchToRow } from "@/lib/transform";
import { mmrEntryToRankRow } from "@/lib/transform";

const stored = {
  meta: {
    id: "m1",
    map: { name: "Ascent" },
    mode: "Competitive",
    started_at: "2026-05-20T22:29:57.065Z",
    season: { short: "e11a3" },
  },
  stats: {
    team: "Red",
    tier: 21,
    score: 4121,
    kills: 14,
    deaths: 10,
    assists: 7,
    shots: { head: 12, body: 30, leg: 10 },
    damage: { made: 2789, received: 1583 },
    character: { name: "Cypher" },
  },
  teams: { red: 13, blue: 7 },
};

describe("storedMatchToRow", () => {
  it("maps fields and derives won from team scores", () => {
    const r = storedMatchToRow(stored);
    expect(r.matchId).toBe("m1");
    expect(r.map).toBe("Ascent");
    expect(r.agent).toBe("Cypher");
    expect(r.roundsWon).toBe(13);
    expect(r.roundsLost).toBe(7);
    expect(r.won).toBe(true);
    expect(r.shotsHead).toBe(12);
  });

  it("marks a loss when the player's team scored fewer rounds", () => {
    const loss = { ...stored, stats: { ...stored.stats, team: "Blue" } };
    expect(storedMatchToRow(loss).won).toBe(false);
  });
});

describe("mmrEntryToRankRow", () => {
  it("maps an mmr-history entry to a rank row", () => {
    const e = {
      match_id: "m1",
      date: "2026-05-20T22:29:57.065Z",
      tier: { id: 21, name: "Ascendant 1" },
      rr: 78,
      last_change: 18,
      elo: 1878,
      map: { name: "Ascent" },
    };
    const r = mmrEntryToRankRow(e);
    expect(r.matchId).toBe("m1");
    expect(r.tier).toBe(21);
    expect(r.tierName).toBe("Ascendant 1");
    expect(r.rr).toBe(78);
    expect(r.lastChange).toBe(18);
    expect(r.elo).toBe(1878);
    expect(r.map).toBe("Ascent");
  });
});
