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
    expect(duels).toMatchObject([
      { x: 10, y: 20, won: true, side: "attack", round: 0 },
      { x: 30, y: 40, won: false, side: "attack", round: 0 },
      { x: 5, y: 6, won: true, side: "defense", round: 12 },
    ]);
  });

  it("counts only my kills toward weapons", () => {
    const { weapons } = normalizeDetail(detail, "me");
    expect(weapons).toEqual([{ weapon: "Vandal", kills: 2 }]);
  });

  it("drops kills with no location but still counts the weapon", () => {
    const d = {
      players: [{ puuid: "me", team_id: "Red" }],
      rounds: [{ id: 0, plant: { player: { team: "Red" } } }],
      kills: [
        {
          round: 0,
          killer: { puuid: "me" },
          victim: { puuid: "foe" },
          weapon: { name: "Vandal" },
        }, // no location
      ],
    };
    const { duels, weapons } = normalizeDetail(d, "me");
    expect(duels).toEqual([]);
    expect(weapons).toEqual([{ weapon: "Vandal", kills: 1 }]);
  });
});

const ME = "me";
const detail2 = {
  players: [
    { puuid: "me", team_id: "Red", agent: { name: "Jett" } },
    { puuid: "foe", team_id: "Blue", agent: { name: "Reyna" } },
    { puuid: "ally", team_id: "Red", agent: { name: "Omen" } },
  ],
  rounds: [{ id: 0, plant: { player: { team: "Red" } } }, { id: 1 }],
  kills: [
    {
      round: 0,
      time_in_round_in_ms: 8000,
      killer: { puuid: "ally" },
      victim: { puuid: "foe2" },
      location: { x: 1, y: 1 },
      weapon: { name: "Spectre" },
      player_locations: [],
    },
    {
      round: 0,
      time_in_round_in_ms: 3000,
      killer: { puuid: "me" },
      victim: { puuid: "foe" },
      location: { x: 500, y: 600 },
      weapon: { name: "Vandal" },
      player_locations: [
        { player_puuid: "me", location: { x: 100, y: 120 } },
        { player_puuid: "foe", location: { x: 500, y: 600 } },
      ],
    },
    {
      round: 1,
      time_in_round_in_ms: 5000,
      killer: { puuid: "foe" },
      victim: { puuid: "me" },
      location: { x: 900, y: 950 },
      weapon: { name: "Operator" },
      player_locations: [
        { player_puuid: "me", location: { x: 900, y: 950 } },
        { player_puuid: "foe", location: { x: 300, y: 200 } },
      ],
    },
  ],
};

describe("normalizeDetail Bucket C", () => {
  const { duels } = normalizeDetail(detail2, ME);

  it("captures only my kills/deaths", () => {
    expect(duels).toHaveLength(2);
  });

  it("captures my kill with positions, weapon, agents, opener", () => {
    const k = duels.find((d) => d.won)!;
    expect(k).toMatchObject({
      won: true,
      weapon: "Vandal",
      agent: "Jett",
      enemyAgent: "Reyna",
      mx: 100,
      my: 120,
      ex: 500,
      ey: 600,
      opener: true,
    });
  });

  it("captures my death: I am at the death location, enemy elsewhere", () => {
    const d = duels.find((x) => !x.won)!;
    expect(d).toMatchObject({
      won: false,
      weapon: "Operator",
      enemyAgent: "Reyna",
      mx: 900,
      my: 950,
      ex: 300,
      ey: 200,
    });
  });

  it("degrades when player_locations is missing", () => {
    const legacy = {
      ...detail2,
      kills: [
        {
          round: 0,
          killer: { puuid: "me" },
          victim: { puuid: "foe" },
          location: { x: 5, y: 6 },
          weapon: { name: "Sheriff" },
        },
      ],
    };
    const { duels: ld } = normalizeDetail(legacy, ME);
    expect(ld[0].mx).toBeUndefined();
    expect(ld[0].ex).toBeUndefined();
    expect(ld[0].weapon).toBe("Sheriff");
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
