import { describe, it, expect } from "vitest";
import {
  storedMatchToRow,
  mmrEntryToRankRow,
  normalizeDetail,
  attackerForRound,
  attackingTeamByRound,
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

describe("normalizeDetail → duels", () => {
  const detail = {
    players: [
      { puuid: "me", team_id: "Red" },
      { puuid: "foe", team_id: "Blue" },
    ],
    rounds: [
      { id: 0, plant: { player: { team: "Red" } } }, // Red attacks first half
      { id: 12, plant: null }, // second half → Red defends
    ],
    kills: [
      {
        round: 0,
        killer: { puuid: "me" },
        victim: { puuid: "foe" },
        location: { x: 10, y: 20 },
        weapon: { name: "Vandal" },
      },
      {
        round: 0,
        killer: { puuid: "foe" },
        victim: { puuid: "me" },
        location: { x: 30, y: 40 },
        weapon: { name: "Phantom" },
      },
      {
        round: 12,
        killer: { puuid: "me" },
        victim: { puuid: "foe" },
        location: { x: 5, y: 6 },
        weapon: { name: "Vandal" },
      },
    ],
  };

  it("records my kills and deaths as duels with correct side", () => {
    const { duels } = normalizeDetail(detail, "me");
    expect(duels).toEqual([
      { x: 10, y: 20, won: true, side: "attack", round: 0 },
      { x: 30, y: 40, won: false, side: "attack", round: 0 },
      { x: 5, y: 6, won: true, side: "defense", round: 12 },
    ]);
  });

  it("counts only my kills toward weapons", () => {
    const { weapons } = normalizeDetail(detail, "me");
    expect(weapons).toEqual([{ weapon: "Vandal", kills: 2 }]);
  });
});

describe("attackerForRound", () => {
  it("first half keeps starting attacker, second half swaps, OT alternates", () => {
    expect(attackerForRound(0, "Red")).toBe("Red");
    expect(attackerForRound(11, "Red")).toBe("Red");
    expect(attackerForRound(12, "Red")).toBe("Blue");
    expect(attackerForRound(23, "Red")).toBe("Blue");
    expect(attackerForRound(24, "Red")).toBe("Red"); // first OT round swaps back
    expect(attackerForRound(25, "Red")).toBe("Blue");
  });
});

describe("attackingTeamByRound", () => {
  it("infers first-half attacker from a first-half plant", () => {
    const rounds = [
      { id: 0, plant: null },
      { id: 2, plant: { player: { team: "Red" } } },
      { id: 12, plant: null },
    ];
    const map = attackingTeamByRound(rounds);
    expect(map[0]).toBe("Red");
    expect(map[2]).toBe("Red");
    expect(map[12]).toBe("Blue");
  });

  it("infers from a second-half plant by inverting", () => {
    const rounds = [
      { id: 0, plant: null },
      { id: 14, plant: { player: { team: "Red" } } }, // Red attacked 2nd half => Blue first half
    ];
    const map = attackingTeamByRound(rounds);
    expect(map[0]).toBe("Blue");
    expect(map[14]).toBe("Red");
  });

  it("defaults to Red when no round has a plant", () => {
    const map = attackingTeamByRound([
      { id: 0, plant: null },
      { id: 1, plant: null },
    ]);
    expect(map[0]).toBe("Red");
    expect(map[1]).toBe("Red");
  });

  it("ignores overtime plants when inferring the first-half attacker", () => {
    const map = attackingTeamByRound([
      { id: 24, plant: { player: { team: "Blue" } } },
    ]);
    // OT plant skipped -> firstHalf defaults Red -> round 24 maps to firstHalf
    expect(map[24]).toBe("Red");
  });
});
