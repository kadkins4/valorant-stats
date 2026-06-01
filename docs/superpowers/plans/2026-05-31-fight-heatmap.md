# Fight Map (Showcase Heatmap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/showcase` stub with an interactive "Fight Map" that shows where on each map Kendall wins vs loses duels (win-rate zone heatmap over the real minimap, with map/side/time filters and click-to-drill kill/death dots).

**Architecture:** Re-capture richer per-duel data into the existing `matches.detail` jsonb (no schema change), pull per-map minimap images + transform constants from valorant-api.com, aggregate duels into a grid of win-rate zones with pure functions (TDD), and render a client `FightMap` with SVG zones over the minimap. DB-primary with snapshot fallback, same as the rest of the app.

**Tech Stack:** Next.js 16 (App Router, RSC) · TypeScript · Drizzle/Neon · Vitest (unit) · Playwright (smoke) · SVG (no new chart deps).

**Reference spec:** `docs/superpowers/specs/2026-05-31-fight-heatmap-design.md`

**Conventions for every task:** run commands from the repo root. Tests resolve `@/` to the repo root (see `vitest.config.ts`). `pnpm test` runs Vitest once. Pure logic is TDD red→green. Commit after each task. The `@typescript-eslint/no-explicit-any` rule is already scoped off for `lib/transform.ts`, `lib/db/queries.ts`, and `scripts/**/*.ts`; **new files that use `any` (e.g. `lib/maps/calibration.ts`) must be added to that override list in `eslint.config.mjs` — Task 4 covers this.**

---

## File structure

**Data layer**

- `lib/types.ts` — add `Duel`, `FightMatch` (modify).
- `lib/transform.ts` — rewrite `normalizeDetail` to emit `duels`; add `attackerForRound`, `attackingTeamByRound` (modify).
- `scripts/recapture.ts` — re-fetch all stored match IDs and rewrite `detail` (create).

**Calibration**

- `scripts/fetch-map-calibration.ts` — fetch valorant-api.com maps → `calibration.json` (create).
- `lib/maps/calibration.json` — committed per-map constants + minimap image URLs (generated).
- `lib/maps/calibration.ts` — `getCalibration`, `transformCoord` (create).

**Aggregation (pure)**

- `lib/fightmap.ts` — `placeDuels`, `zonesFromPlaced`, `collectDuels`, `winRateColor`, list helpers, `TimeScope`, `Zone`, `Placed` (create).

**Queries**

- `lib/db/queries.ts` — add `getFightData` + `rowToFightMatch` (modify).

**UI**

- `components/fightmap/Legend.tsx`, `MapPicker.tsx`, `SideToggle.tsx`, `TimeSelector.tsx`, `ZoneGrid.tsx`, `ZoneDetail.tsx`, `FightMap.tsx` (create).
- `app/showcase/page.tsx` — load data + render `FightMap` (modify).

**Tests**

- `tests/transform.test.ts` — extend with duel/side tests (modify).
- `tests/calibration.test.ts`, `tests/fightmap.test.ts` (create).
- `tests/smoke.spec.ts` — add a Fight Map smoke test (modify).

**Config**

- `package.json` — add `recapture` + `maps:calibrate` scripts (modify).
- `eslint.config.mjs` — add `lib/maps/calibration.ts` to the `any` override (modify).

---

## Task 1: Duel types + side-derivation pure functions

**Files:**

- Modify: `lib/types.ts`
- Modify: `lib/transform.ts`
- Test: `tests/transform.test.ts`

- [ ] **Step 1: Add the new types to `lib/types.ts`**

Append to `lib/types.ts`:

```ts
export interface Duel {
  x: number; // raw Valorant game-world coordinate of the death location
  y: number;
  won: boolean; // true = Kendall's kill (enemy died), false = Kendall's death
  side: "attack" | "defense";
  round: number;
}

export interface FightMatch {
  matchId: string;
  map: string;
  season: string;
  playedAt: string; // ISO string
  duels: Duel[];
}
```

- [ ] **Step 2: Write the failing test for side derivation**

Add to `tests/transform.test.ts` (keep existing tests; add imports at top if missing):

```ts
import { attackerForRound, attackingTeamByRound } from "@/lib/transform";

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
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test tests/transform.test.ts`
Expected: FAIL — `attackerForRound is not a function` / `attackingTeamByRound is not a function`.

- [ ] **Step 4: Implement the helpers in `lib/transform.ts`**

Add near the top of `lib/transform.ts` (after the imports):

```ts
type Team = "Red" | "Blue";
const other = (t: Team): Team => (t === "Red" ? "Blue" : "Red");

// Side for a given round, given which team attacked the first half.
// Rounds 0-11 first half, 12-23 second half (swap), 24+ overtime (swap each round).
export function attackerForRound(round: number, firstHalfAttacker: Team): Team {
  if (round < 12) return firstHalfAttacker;
  if (round < 24) return other(firstHalfAttacker);
  return (round - 24) % 2 === 0 ? firstHalfAttacker : other(firstHalfAttacker);
}

// Map each round id to the attacking team, inferred from any plant in the match.
export function attackingTeamByRound(rounds: any[]): Record<number, Team> {
  let firstHalf: Team | null = null;
  for (const r of rounds ?? []) {
    const planter: Team | undefined = r?.plant?.player?.team;
    if (!planter) continue;
    firstHalf = r.id < 12 ? planter : other(planter);
    break;
  }
  firstHalf ??= "Red"; // last-resort; side may be off but duels still count under "Both"
  const out: Record<number, Team> = {};
  for (const r of rounds ?? []) out[r.id] = attackerForRound(r.id, firstHalf);
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test tests/transform.test.ts`
Expected: PASS (new tests green; existing transform tests still green).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/transform.ts tests/transform.test.ts
git commit -m "Add Duel types + round side-derivation helpers"
```

---

## Task 2: Rewrite `normalizeDetail` to emit duels

**Files:**

- Modify: `lib/transform.ts`
- Test: `tests/transform.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/transform.test.ts`:

```ts
import { normalizeDetail } from "@/lib/transform";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/transform.test.ts`
Expected: FAIL — current `normalizeDetail` returns `killCoords`, not `duels`; `duels` is `undefined`.

- [ ] **Step 3: Replace `NormalizedDetail` + `normalizeDetail` in `lib/transform.ts`**

Replace the existing `NormalizedDetail` interface and `normalizeDetail` function with:

```ts
import type { Duel } from "@/lib/types";

export interface NormalizedDetail {
  weapons: { weapon: string; kills: number }[];
  duels: Duel[];
}

export function normalizeDetail(detail: any, puuid: string): NormalizedDetail {
  const myTeam: Team | undefined = (detail.players ?? []).find(
    (p: any) => p.puuid === puuid,
  )?.team_id;
  const attackBy = attackingTeamByRound(detail.rounds ?? []);

  const counts = new Map<string, number>();
  const duels: Duel[] = [];

  for (const k of detail.kills ?? []) {
    const iKilled = k.killer?.puuid === puuid;
    const iDied = k.victim?.puuid === puuid;
    if (iKilled) {
      const w = k.weapon?.name ?? "Unknown";
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    if ((iKilled || iDied) && k.location) {
      const att = attackBy[k.round];
      const side: "attack" | "defense" =
        myTeam && att ? (att === myTeam ? "attack" : "defense") : "attack";
      duels.push({
        x: k.location.x,
        y: k.location.y,
        won: iKilled,
        side,
        round: k.round,
      });
    }
  }

  const weapons = [...counts.entries()]
    .map(([weapon, kills]) => ({ weapon, kills }))
    .sort((a, b) => b.kills - a.kills);

  return { weapons, duels };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/transform.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify nothing else references the removed `killCoords`**

Run: `grep -rn "killCoords\|victim_location" lib app components scripts`
Expected: no matches (the old field was a latent no-op). If any appear, they are dead code — remove them.

- [ ] **Step 6: Commit**

```bash
git add lib/transform.ts tests/transform.test.ts
git commit -m "Rewrite normalizeDetail to emit per-duel records"
```

---

## Task 3: Re-capture script + repopulate detail

**Files:**

- Create: `scripts/recapture.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/recapture.ts`**

```ts
// One-time: re-fetch every stored match and rewrite detail with the new duel shape.
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
import { henrikPuuid } from "@/lib/henrik-puuid";
import { normalizeDetail } from "@/lib/transform";
import { sql } from "drizzle-orm";

async function main() {
  const puuid = await henrikPuuid();
  const rows = await db.select({ id: matches.matchId }).from(matches);
  console.log(
    `Re-capturing ${rows.length} matches (~${Math.ceil((rows.length * 2.2) / 60)} min)…`,
  );
  let done = 0;
  let failed = 0;
  for (const { id } of rows) {
    try {
      const full = await henrik.matchById(account.region, id);
      await db
        .update(matches)
        .set({ detail: normalizeDetail(full.data, puuid), hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
      if (++done % 10 === 0) console.log(`  ${done}/${rows.length}`);
    } catch (e) {
      failed++;
      console.warn(`  skip ${id}: ${(e as Error).message}`);
    }
  }
  console.log(`Done: ${done} ok, ${failed} failed.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the script to `package.json`**

In the `"scripts"` block, add:

```json
    "recapture": "tsx scripts/recapture.ts",
```

- [ ] **Step 3: Run the re-capture (requires `.env` with `VAL_API_KEY` + `DATABASE_URL`)**

Run: `pnpm recapture`
Expected: progress logs `10/137 … 130/137`, ends `Done: N ok, M failed.` (a few failures are tolerable; most should succeed).

- [ ] **Step 4: Regenerate the committed snapshot from the updated DB**

Run: `pnpm sync`
Expected: `Sync OK: +… matches, +… rank pts. Snapshot written.`

- [ ] **Step 5: Sanity-check the new snapshot actually has duels**

Run: `node -e "const s=require('./data/snapshot.json');const d=s.matches.flatMap(m=>m.detail?.duels??[]);console.log('duels:',d.length,'sample:',JSON.stringify(d[0]))"`
Expected: a non-zero duel count and a sample object with `x,y,won,side,round`.

- [ ] **Step 6: Commit**

```bash
git add scripts/recapture.ts package.json data/snapshot.json
git commit -m "Re-capture matches into per-duel detail + refresh snapshot"
```

---

## Task 4: Fetch map calibration constants

**Files:**

- Create: `scripts/fetch-map-calibration.ts`
- Create: `lib/maps/calibration.json` (generated)
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/fetch-map-calibration.ts`**

```ts
// Fetch per-map minimap image + coordinate transform constants from valorant-api.com.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const res = await fetch("https://valorant-api.com/v1/maps");
  if (!res.ok) throw new Error(`valorant-api maps -> HTTP ${res.status}`);
  const json = await res.json();
  const calib = (json.data ?? [])
    .filter((m: any) => m.displayIcon && m.xMultiplier != null)
    .map((m: any) => ({
      name: m.displayName as string,
      image: m.displayIcon as string,
      xMultiplier: m.xMultiplier as number,
      yMultiplier: m.yMultiplier as number,
      xScalarToAdd: m.xScalarToAdd as number,
      yScalarToAdd: m.yScalarToAdd as number,
    }));
  const dir = join(process.cwd(), "lib", "maps");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "calibration.json");
  writeFileSync(out, JSON.stringify(calib, null, 2));
  console.log(`Wrote ${calib.length} maps to ${out}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the script to `package.json`**

In `"scripts"`, add:

```json
    "maps:calibrate": "tsx scripts/fetch-map-calibration.ts",
```

- [ ] **Step 3: Generate the calibration file**

Run: `pnpm maps:calibrate`
Expected: `Wrote N maps to …/lib/maps/calibration.json` (N ≥ 10).

- [ ] **Step 4: Add `lib/maps/calibration.ts` to the eslint `any` override**

In `eslint.config.mjs`, find the override block whose `files` array lists `lib/transform.ts` etc., and add `"lib/maps/calibration.ts"` to that `files` array.

- [ ] **Step 5: Verify the generated file shape**

Run: `node -e "const c=require('./lib/maps/calibration.json');console.log(c.length, JSON.stringify(c.find(m=>m.name==='Ascent')))"`
Expected: a count and an Ascent object with `image`, `xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-map-calibration.ts lib/maps/calibration.json package.json eslint.config.mjs
git commit -m "Fetch + commit per-map minimap calibration constants"
```

---

## Task 5: Coordinate transform (`lib/maps/calibration.ts`)

**Files:**

- Create: `lib/maps/calibration.ts`
- Test: `tests/calibration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calibration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/calibration.test.ts`
Expected: FAIL — module `@/lib/maps/calibration` not found.

- [ ] **Step 3: Implement `lib/maps/calibration.ts`**

```ts
import calibrations from "./calibration.json";

export interface MapCalibration {
  name: string;
  image: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
}

const ALL = calibrations as MapCalibration[];

export function getCalibration(map: string): MapCalibration | undefined {
  const key = map.toLowerCase();
  return ALL.find((c) => c.name.toLowerCase() === key);
}

// Valorant minimap transform. Game (x,y) -> normalized [0,1] over displayIcon.
// Note the x/y swap; this is the documented community formula.
export function transformCoord(
  c: MapCalibration,
  loc: { x: number; y: number },
): { nx: number; ny: number } {
  return {
    nx: loc.y * c.xMultiplier + c.xScalarToAdd,
    ny: loc.x * c.yMultiplier + c.yScalarToAdd,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/calibration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/maps/calibration.ts tests/calibration.test.ts
git commit -m "Add map coordinate transform + lookup"
```

---

## Task 6: Aggregation core — place + bin duels

**Files:**

- Create: `lib/fightmap.ts`
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/fightmap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { placeDuels, zonesFromPlaced, GRID_N, MIN_DUELS } from "@/lib/fightmap";
import type { MapCalibration } from "@/lib/maps/calibration";
import type { Duel } from "@/lib/types";

// Identity-ish calibration: nx = y, ny = x (so we can hand-pick cells).
const calib: MapCalibration = {
  name: "T",
  image: "x",
  xMultiplier: 1,
  yMultiplier: 1,
  xScalarToAdd: 0,
  yScalarToAdd: 0,
};
const duel = (x: number, y: number, won: boolean): Duel => ({
  x,
  y,
  won,
  side: "attack",
  round: 0,
});

describe("placeDuels", () => {
  it("normalizes + assigns grid cells (clamped to [0,gridN-1])", () => {
    const placed = placeDuels(
      [duel(0, 0, true), duel(0.99, 0.99, false)],
      calib,
      6,
    );
    expect(placed[0]).toMatchObject({
      nx: 0,
      ny: 0,
      col: 0,
      row: 0,
      won: true,
    });
    // x=0.99 -> ny=0.99 -> row=floor(5.94)=5 ; y=0.99 -> nx -> col=5
    expect(placed[1]).toMatchObject({ col: 5, row: 5, won: false });
  });
});

describe("zonesFromPlaced", () => {
  it("aggregates win/total per cell and mutes thin zones", () => {
    const placed = placeDuels(
      [duel(0.1, 0.1, true), duel(0.1, 0.1, true), duel(0.1, 0.1, false)], // 3 in one cell
      calib,
      6,
    );
    const zones = zonesFromPlaced(placed);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ wins: 2, total: 3 });
    expect(zones[0].winRate).toBeCloseTo(2 / 3);
    expect(zones[0].muted).toBe(true); // 3 < MIN_DUELS(4)
  });

  it("un-mutes a zone at the threshold", () => {
    const placed = placeDuels(
      Array.from({ length: MIN_DUELS }, () => duel(0.5, 0.5, true)),
      calib,
      GRID_N,
    );
    expect(zonesFromPlaced(placed)[0].muted).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/fightmap.test.ts`
Expected: FAIL — module `@/lib/fightmap` not found.

- [ ] **Step 3: Implement the core in `lib/fightmap.ts`**

```ts
import type { Duel } from "@/lib/types";
import { transformCoord, type MapCalibration } from "@/lib/maps/calibration";

export const GRID_N = 6;
export const MIN_DUELS = 4;

export interface Placed {
  nx: number;
  ny: number;
  won: boolean;
  col: number;
  row: number;
}

export interface Zone {
  col: number;
  row: number;
  wins: number;
  total: number;
  winRate: number;
  muted: boolean;
}

const clampCell = (v: number, gridN: number) =>
  Math.min(gridN - 1, Math.max(0, Math.floor(v * gridN)));

export function placeDuels(
  duels: Duel[],
  calib: MapCalibration,
  gridN = GRID_N,
): Placed[] {
  return duels.map((d) => {
    const { nx, ny } = transformCoord(calib, d);
    return {
      nx,
      ny,
      won: d.won,
      col: clampCell(nx, gridN),
      row: clampCell(ny, gridN),
    };
  });
}

export function zonesFromPlaced(placed: Placed[]): Zone[] {
  const cells = new Map<
    string,
    { col: number; row: number; wins: number; total: number }
  >();
  for (const p of placed) {
    const key = `${p.col},${p.row}`;
    const cur = cells.get(key) ?? { col: p.col, row: p.row, wins: 0, total: 0 };
    cur.total++;
    if (p.won) cur.wins++;
    cells.set(key, cur);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    winRate: c.wins / c.total,
    muted: c.total < MIN_DUELS,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/fightmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Add duel placement + zone aggregation with min-sample muting"
```

---

## Task 7: Filters (map / side / time) + list helpers

**Files:**

- Modify: `lib/fightmap.ts`
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/fightmap.test.ts`:

```ts
import {
  collectDuels,
  seasonsOf,
  currentSeasonOf,
  mapsOf,
  mostPlayedMap,
  type TimeScope,
} from "@/lib/fightmap";
import type { FightMatch } from "@/lib/types";

const d = (won: boolean, side: "attack" | "defense"): Duel => ({
  x: 0,
  y: 0,
  won,
  side,
  round: 0,
});
const fm = (
  id: string,
  map: string,
  season: string,
  playedAt: string,
  duels: Duel[],
): FightMatch => ({ matchId: id, map, season, playedAt, duels });

const data: FightMatch[] = [
  fm("m1", "Ascent", "e10a3", "2026-05-01T00:00:00.000Z", [
    d(true, "attack"),
    d(false, "defense"),
  ]),
  fm("m2", "Ascent", "e10a2", "2026-04-01T00:00:00.000Z", [d(true, "attack")]),
  fm("m3", "Bind", "e10a3", "2026-05-02T00:00:00.000Z", [d(false, "attack")]),
];

describe("collectDuels", () => {
  it("filters by map", () => {
    const all: TimeScope = { kind: "all" };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: all }),
    ).toHaveLength(3);
  });
  it("filters by side", () => {
    const all: TimeScope = { kind: "all" };
    expect(
      collectDuels(data, { map: "Ascent", side: "defense", time: all }),
    ).toHaveLength(1);
  });
  it("filters by season", () => {
    const t: TimeScope = { kind: "season", season: "e10a2" };
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(1);
  });
  it("filters by last-N matches on the selected map (most recent first)", () => {
    const t: TimeScope = { kind: "lastN", n: 1 };
    // Ascent matches: m1 (May) and m2 (Apr) -> last 1 is m1 (2 duels)
    expect(
      collectDuels(data, { map: "Ascent", side: "both", time: t }),
    ).toHaveLength(2);
  });
});

describe("list helpers", () => {
  it("seasonsOf is unique + most-recent-first", () => {
    expect(seasonsOf(data)).toEqual(["e10a3", "e10a2"]);
  });
  it("currentSeasonOf is the most recent match's season", () => {
    expect(currentSeasonOf(data)).toBe("e10a3");
  });
  it("mapsOf is unique; mostPlayedMap is the modal map", () => {
    expect(mapsOf(data).sort()).toEqual(["Ascent", "Bind"]);
    expect(mostPlayedMap(data)).toBe("Ascent");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/fightmap.test.ts`
Expected: FAIL — `collectDuels`/`seasonsOf`/etc. not exported.

- [ ] **Step 3: Implement in `lib/fightmap.ts`**

Append:

```ts
import type { FightMatch } from "@/lib/types";

export type TimeScope =
  | { kind: "season"; season: string }
  | { kind: "all" }
  | { kind: "lastN"; n: number };

export interface FilterOpts {
  map: string;
  side: "attack" | "defense" | "both";
  time: TimeScope;
}

export function collectDuels(matches: FightMatch[], o: FilterOpts): Duel[] {
  let ms = matches.filter((m) => m.map === o.map);
  if (o.time.kind === "season") {
    const s = o.time.season;
    ms = ms.filter((m) => m.season === s);
  } else if (o.time.kind === "lastN") {
    ms = [...ms]
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, o.time.n);
  }
  let duels = ms.flatMap((m) => m.duels);
  if (o.side !== "both") duels = duels.filter((x) => x.side === o.side);
  return duels;
}

// Seasons present, most-recent-first (ranked by each season's latest match).
export function seasonsOf(matches: FightMatch[]): string[] {
  const latest = new Map<string, string>();
  for (const m of matches) {
    const cur = latest.get(m.season);
    if (!cur || m.playedAt > cur) latest.set(m.season, m.playedAt);
  }
  return [...latest.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([s]) => s);
}

export function currentSeasonOf(matches: FightMatch[]): string {
  return seasonsOf(matches)[0] ?? "";
}

export function mapsOf(matches: FightMatch[]): string[] {
  return [...new Set(matches.map((m) => m.map))];
}

export function mostPlayedMap(matches: FightMatch[]): string {
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.map, (counts.get(m.map) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/fightmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Add fight-map filters + season/map list helpers"
```

---

## Task 8: Win-rate color

**Files:**

- Modify: `lib/fightmap.ts`
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/fightmap.test.ts`:

```ts
import { winRateColor } from "@/lib/fightmap";

describe("winRateColor", () => {
  it("maps 0 → red, 0.5 → gray, 1 → green", () => {
    expect(winRateColor(0)).toBe("rgb(181,72,61)");
    expect(winRateColor(0.5)).toBe("rgb(122,127,138)");
    expect(winRateColor(1)).toBe("rgb(46,139,87)");
  });
  it("interpolates between stops", () => {
    expect(winRateColor(0.25)).toBe("rgb(152,100,100)");
  });
});
```

(0.25 is halfway red→gray: r=round(181+(122-181)*0.5)=152, g=round(72+(127-72)*0.5)=100, b=round(61+(138-61)\*0.5)=100.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/fightmap.test.ts`
Expected: FAIL — `winRateColor` not exported.

- [ ] **Step 3: Implement in `lib/fightmap.ts`**

Append:

```ts
const RED = [181, 72, 61];
const GRAY = [122, 127, 138];
const GREEN = [46, 139, 87];
const lerp = (a: number[], b: number[], t: number) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function winRateColor(rate: number): string {
  const c =
    rate <= 0.5
      ? lerp(RED, GRAY, rate / 0.5)
      : lerp(GRAY, GREEN, (rate - 0.5) / 0.5);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/fightmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Add red→gray→green win-rate color mapping"
```

---

## Task 9: `getFightData` query

**Files:**

- Modify: `lib/db/queries.ts`
- Test: `tests/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/queries.test.ts`:

```ts
import { rowToFightMatch } from "@/lib/db/queries";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/queries.test.ts`
Expected: FAIL — `rowToFightMatch` not exported.

- [ ] **Step 3: Implement in `lib/db/queries.ts`**

Add the import for the type at the top (extend the existing `@/lib/types` import):

```ts
import type {
  MatchSummary,
  RankPoint,
  WeaponUsage,
  Duel,
  FightMatch,
} from "@/lib/types";
```

Add near the other exports:

```ts
export const rowToFightMatch = (r: any): FightMatch => ({
  matchId: r.matchId,
  map: r.map,
  season: r.season,
  playedAt: new Date(r.playedAt).toISOString(),
  duels: (r.detail?.duels ?? []) as Duel[],
});

export function getFightData(): Promise<FightMatch[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(matches)).map(rowToFightMatch),
    fromSnapshot: () => (readSnapshot()?.matches ?? []).map(rowToFightMatch),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries.ts tests/queries.test.ts
git commit -m "Add getFightData query + row mapper"
```

---

## Task 10: Filter controls + legend components

**Files:**

- Create: `components/fightmap/MapPicker.tsx`, `SideToggle.tsx`, `TimeSelector.tsx`, `Legend.tsx`

- [ ] **Step 1: Create `components/fightmap/Legend.tsx`**

```tsx
export default function Legend() {
  return (
    <div style={{ maxWidth: 360, margin: "8px 0" }}>
      <div
        style={{
          height: 14,
          borderRadius: 7,
          background: "linear-gradient(to right,#b5483d,#7a7f8a 50%,#2e8b57)",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "var(--muted)",
          fontSize: 12,
          marginTop: 4,
        }}
      >
        <span>Lose duels</span>
        <span>50%</span>
        <span>Win duels</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create a shared chip style + `MapPicker.tsx`**

```tsx
"use client";

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px",
  borderRadius: 14,
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  cursor: "pointer",
  border: "none",
  background: active ? "var(--accent)" : "#222a38",
  color: active ? "#fff" : "#aeb6c6",
  transition: "background 0.15s",
});

export default function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {maps.map((m) => (
        <button key={m} style={chip(m === value)} onClick={() => onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  );
}

export { chip };
```

- [ ] **Step 3: Create `components/fightmap/SideToggle.tsx`**

```tsx
"use client";
import { chip } from "./MapPicker";

export type Side = "attack" | "defense" | "both";

export default function SideToggle({
  value,
  onChange,
}: {
  value: Side;
  onChange: (s: Side) => void;
}) {
  const opts: Side[] = ["both", "attack", "defense"];
  const label: Record<Side, string> = {
    both: "Both",
    attack: "Attack",
    defense: "Defense",
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map((o) => (
        <button key={o} style={chip(o === value)} onClick={() => onChange(o)}>
          {label[o]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/fightmap/TimeSelector.tsx`**

```tsx
"use client";
import { chip } from "./MapPicker";
import type { TimeScope } from "@/lib/fightmap";

function key(t: TimeScope): string {
  return t.kind === "season"
    ? `s:${t.season}`
    : t.kind === "lastN"
      ? `n:${t.n}`
      : "all";
}

export default function TimeSelector({
  seasons,
  value,
  onChange,
}: {
  seasons: string[];
  value: TimeScope;
  onChange: (t: TimeScope) => void;
}) {
  const options: { label: string; scope: TimeScope }[] = [
    ...seasons.map((s, i) => ({
      label: i === 0 ? `${s} (current)` : s,
      scope: { kind: "season", season: s } as TimeScope,
    })),
    { label: "All time", scope: { kind: "all" } },
    { label: "Last 10", scope: { kind: "lastN", n: 10 } },
    { label: "Last 20", scope: { kind: "lastN", n: 20 } },
  ];
  const active = key(value);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={key(o.scope)}
          style={chip(key(o.scope) === active)}
          onClick={() => onChange(o.scope)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/Legend.tsx components/fightmap/MapPicker.tsx components/fightmap/SideToggle.tsx components/fightmap/TimeSelector.tsx
git commit -m "Add fight-map filter controls + legend"
```

---

## Task 11: ZoneGrid (SVG zones over the minimap)

**Files:**

- Create: `components/fightmap/ZoneGrid.tsx`

- [ ] **Step 1: Create `components/fightmap/ZoneGrid.tsx`**

```tsx
"use client";
import { GRID_N, winRateColor, type Zone } from "@/lib/fightmap";

export default function ZoneGrid({
  image,
  zones,
  selected,
  onSelect,
}: {
  image: string;
  zones: Zone[];
  selected: { col: number; row: number } | null;
  onSelect: (z: Zone) => void;
}) {
  const cell = 100 / GRID_N; // percent units in a 0..100 viewBox
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      style={{
        display: "block",
        borderRadius: 10,
        border: "1px solid #222a38",
        aspectRatio: "1 / 1",
      }}
    >
      <image
        href={image}
        x="0"
        y="0"
        width="100"
        height="100"
        opacity="0.55"
        preserveAspectRatio="xMidYMid slice"
      />
      {zones.map((z) => {
        const isSel = selected?.col === z.col && selected?.row === z.row;
        return (
          <g
            key={`${z.col},${z.row}`}
            onClick={() => onSelect(z)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={z.col * cell}
              y={z.row * cell}
              width={cell}
              height={cell}
              fill={z.muted ? "#3a3f4b" : winRateColor(z.winRate)}
              opacity={z.muted ? 0.3 : isSel ? 0.95 : 0.78}
              stroke={isSel ? "#fff" : "#11151d"}
              strokeWidth={isSel ? 0.8 : 0.3}
              style={{ transition: "opacity 0.2s, fill 0.2s" }}
            >
              <title>
                {z.muted
                  ? `${z.total} duels (low sample)`
                  : `${Math.round(z.winRate * 100)}% over ${z.total} duels`}
              </title>
            </rect>
            {!z.muted && (
              <text
                x={z.col * cell + cell / 2}
                y={z.row * cell + cell / 2 + 2}
                textAnchor="middle"
                fontSize="5"
                fontWeight="800"
                fill="#fff"
                stroke="#11151d"
                strokeWidth="0.3"
                style={{ paintOrder: "stroke", pointerEvents: "none" }}
              >
                {Math.round(z.winRate * 100)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/fightmap/ZoneGrid.tsx
git commit -m "Add ZoneGrid SVG heatmap component"
```

---

## Task 12: ZoneDetail (kill/death dots for the clicked zone)

**Files:**

- Create: `components/fightmap/ZoneDetail.tsx`

- [ ] **Step 1: Create `components/fightmap/ZoneDetail.tsx`**

```tsx
"use client";
import { GRID_N, type Placed } from "@/lib/fightmap";

export default function ZoneDetail({
  image,
  points,
  zone,
}: {
  image: string;
  points: Placed[];
  zone: { col: number; row: number };
}) {
  const inZone = points.filter((p) => p.col === zone.col && p.row === zone.row);
  const wins = inZone.filter((p) => p.won).length;
  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0" }}>
        Zone {zone.col + 1},{zone.row + 1} — {inZone.length} duels · {wins} won
      </h3>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        style={{
          display: "block",
          borderRadius: 10,
          border: "1px solid #222a38",
          aspectRatio: "1 / 1",
        }}
      >
        <image
          href={image}
          x="0"
          y="0"
          width="100"
          height="100"
          opacity="0.5"
          preserveAspectRatio="xMidYMid slice"
        />
        <rect
          x={(zone.col * 100) / GRID_N}
          y={(zone.row * 100) / GRID_N}
          width={100 / GRID_N}
          height={100 / GRID_N}
          fill="none"
          stroke="#fff"
          strokeWidth="0.5"
          opacity="0.6"
        />
        {inZone.map((p, i) => (
          <circle
            key={i}
            cx={p.nx * 100}
            cy={p.ny * 100}
            r="1.4"
            fill={p.won ? "#5fd07a" : "#e35d6a"}
            stroke="#11151d"
            strokeWidth="0.3"
          />
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/fightmap/ZoneDetail.tsx
git commit -m "Add ZoneDetail drill-in dots component"
```

---

## Task 13: FightMap orchestrator + wire into Showcase

**Files:**

- Create: `components/fightmap/FightMap.tsx`
- Modify: `app/showcase/page.tsx`

- [ ] **Step 1: Create `components/fightmap/FightMap.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import type { FightMatch } from "@/lib/types";
import { getCalibration } from "@/lib/maps/calibration";
import {
  collectDuels,
  placeDuels,
  zonesFromPlaced,
  mapsOf,
  mostPlayedMap,
  seasonsOf,
  currentSeasonOf,
  type TimeScope,
  type Zone,
} from "@/lib/fightmap";
import MapPicker from "./MapPicker";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import ZoneGrid from "./ZoneGrid";
import ZoneDetail from "./ZoneDetail";
import Legend from "./Legend";

export default function FightMap({ matches }: { matches: FightMatch[] }) {
  const maps = useMemo(() => mapsOf(matches), [matches]);
  const seasons = useMemo(() => seasonsOf(matches), [matches]);
  const currentSeason = useMemo(() => currentSeasonOf(matches), [matches]);
  // Default to the most-played map *within the current season* so the default
  // view (current season) is populated; fall back to overall most-played.
  const [map, setMap] = useState(() => {
    const inSeason = matches.filter((m) => m.season === currentSeason);
    return mostPlayedMap(inSeason) || mostPlayedMap(matches) || maps[0] || "";
  });
  const [side, setSide] = useState<Side>("both");
  const [time, setTime] = useState<TimeScope>(() => ({
    kind: "season",
    season: currentSeason,
  }));
  const [selected, setSelected] = useState<Zone | null>(null);

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(collectDuels(matches, { map, side, time }), calib);
  }, [matches, map, side, time, calib]);
  const zones = useMemo(() => zonesFromPlaced(points), [points]);

  // Reset drill-in when filters change the dataset.
  const onFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setSelected(null);
    };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            MAP
          </div>
          <MapPicker maps={maps} value={map} onChange={onFilter(setMap)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            SIDE
          </div>
          <SideToggle value={side} onChange={onFilter(setSide)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            TIME
          </div>
          <TimeSelector
            seasons={seasons}
            value={time}
            onChange={onFilter(setTime)}
          />
        </div>
      </div>

      {!calib ? (
        <p style={{ color: "var(--muted)" }}>
          No minimap calibration for {map} yet.
        </p>
      ) : points.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No duels for this filter — try “All time” or a different map.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <ZoneGrid
              image={calib.image}
              zones={zones}
              selected={selected}
              onSelect={setSelected}
            />
            <Legend />
          </div>
          {selected ? (
            <ZoneDetail image={calib.image} points={points} zone={selected} />
          ) : (
            <p style={{ color: "var(--muted)", alignSelf: "center" }}>
              Tap a zone to see the individual kills (green) and deaths (red)
              there.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/showcase/page.tsx`**

```tsx
import Nav from "@/components/Nav";
import FightMap from "@/components/fightmap/FightMap";
import { getFightData } from "@/lib/db/queries";

export default async function Showcase() {
  const matches = await getFightData();
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ marginBottom: 4 }}>Fight Map</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Where I win and lose my duels. Green zones = I win fights there; red =
          I lose them.
        </p>
        <FightMap matches={matches} />
      </main>
    </>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: compiles; `/showcase` listed in the route output.

- [ ] **Step 4: Manual check**

Run: `pnpm dev` then open `http://localhost:3000/showcase`. Confirm: map/side/time chips render, the minimap shows colored zones with %, clicking a zone shows dots. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add components/fightmap/FightMap.tsx app/showcase/page.tsx
git commit -m "Wire FightMap into the Showcase page"
```

---

## Task 14: Smoke test + final verification

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1: Add a Fight Map smoke test**

Add to `tests/smoke.spec.ts`:

```ts
test("showcase renders the fight map", async ({ page }) => {
  await page.goto("/showcase");
  await expect(page.getByRole("heading", { name: "Fight Map" })).toBeVisible();
  // Filter controls always render regardless of data/remote image load.
  await expect(page.getByRole("button", { name: "Both" })).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test**

Run: `pnpm smoke`
Expected: all smoke tests PASS (Playwright boots `pnpm dev` automatically).

- [ ] **Step 3: Full green gate**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint && pnpm build`
Expected: unit tests pass, no type errors, no lint errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "Add Showcase fight-map smoke test"
```

---

## Definition of done

- `/showcase` shows the Fight Map: pick **map → side → time**, see win-rate **zones** (red→gray→green, % labels, muted thin zones) over the real minimap, **click a zone** to see kill/death dots.
- Data flows DB-primary with snapshot fallback; the 137 matches carry the new `duels` shape; snapshot committed.
- All pure logic is unit-tested; `/showcase` has a smoke test; `pnpm test`, `tsc`, `lint`, `build` all green.
- Parked (future): day-slider, entries-only, weapon filter, round-outcome mode, Heat glow layer, map-callout polygons.

```

```
