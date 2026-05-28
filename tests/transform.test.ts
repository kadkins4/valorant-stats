import { describe, it, expect } from "vitest";
import {
  storedMatchToRow,
  mmrEntryToRankRow,
  normalizeDetail,
} from "@/lib/transform";

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

describe("normalizeDetail", () => {
  it("counts the player's weapon kills and collects kill coords", () => {
    const detail = {
      kills: [
        {
          killer: { puuid: "P" },
          weapon: { name: "Vandal" },
          victim_location: { x: 1, y: 2 },
        },
        {
          killer: { puuid: "P" },
          weapon: { name: "Vandal" },
          victim_location: { x: 3, y: 4 },
        },
        {
          killer: { puuid: "P" },
          weapon: { name: "Sheriff" },
          victim_location: { x: 5, y: 6 },
        },
        {
          killer: { puuid: "X" },
          weapon: { name: "Phantom" },
          victim_location: { x: 7, y: 8 },
        },
      ],
    };
    const n = normalizeDetail(detail, "P");
    expect(n.weapons).toEqual([
      { weapon: "Vandal", kills: 2 },
      { weapon: "Sheriff", kills: 1 },
    ]);
    expect(n.killCoords).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ]);
  });
});
