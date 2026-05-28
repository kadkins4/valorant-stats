import { describe, it, expect } from "vitest";
import { byMap, currentForm } from "@/lib/aggregations";
import type { MatchSummary } from "@/lib/types";

const M = (over: Partial<MatchSummary>): MatchSummary => ({
  matchId: "x",
  playedAt: "2026-05-01T00:00:00Z",
  season: "e11a3",
  map: "Ascent",
  agent: "Cypher",
  tier: 21,
  kills: 10,
  deaths: 10,
  assists: 5,
  score: 3000,
  shotsHead: 20,
  shotsBody: 70,
  shotsLeg: 10,
  damageMade: 2400,
  damageReceived: 2000,
  roundsWon: 13,
  roundsLost: 11,
  won: true,
  ...over,
});

describe("byMap", () => {
  it("aggregates games, win rate, avg kd and adr per map", () => {
    const rows = [
      M({
        map: "Ascent",
        won: true,
        kills: 12,
        deaths: 6,
        damageMade: 2400,
        roundsWon: 13,
        roundsLost: 11,
      }),
      M({
        map: "Ascent",
        won: false,
        kills: 6,
        deaths: 12,
        damageMade: 1200,
        roundsWon: 9,
        roundsLost: 13,
      }),
    ];
    const [a] = byMap(rows);
    expect(a.map).toBe("Ascent");
    expect(a.games).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.winRate).toBe(50);
    expect(a.avgKd).toBeCloseTo((2 + 0.5) / 2, 2);
  });
});

describe("currentForm", () => {
  it("summarizes the last N matches", () => {
    const rows = [M({ won: true }), M({ won: false }), M({ won: true })];
    const f = currentForm(rows, 20);
    expect(f.games).toBe(3);
    expect(f.wins).toBe(2);
  });
});
