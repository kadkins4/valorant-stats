# Valorant Competitive Tracker — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js + Neon Postgres competitive-Valorant tracker that accumulates match history beyond the API's 136-game cap, with a Splash → Home → Track flow.

**Architecture:** A server-side sync pipeline fetches competitive matches from the HenrikDev API and upserts them into Neon Postgres (via Drizzle), exporting a committed `snapshot.json` as backup and runtime fallback. Next.js (App Router, RSC) reads the data layer (DB primary, snapshot fallback) and renders the screens.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Neon serverless Postgres · Drizzle ORM · Chart.js via react-chartjs-2 · Vitest · Playwright · pnpm.

---

## File Structure

```
valorant-stats/
  app/
    layout.tsx                 root layout + top nav
    page.tsx                   Splash (auto-advances to /home)
    home/page.tsx              Home dashboard
    track/page.tsx             Track tab
    improve/page.tsx           stub
    showcase/page.tsx          stub (public)
  components/
    Nav.tsx  RankHeader.tsx  SupportedTeamsChips.tsx  StatCard.tsx
    charts/  EloTimeline.tsx  WinRateByAct.tsx  RankJourney.tsx
             WinRateByMap.tsx  KDTrend.tsx  AgentTable.tsx  MatchList.tsx
  lib/
    config.ts                  account/region from env
    henrik.ts                  HenrikDev client (server-only) + throttle
    types.ts                   shared domain types
    transform.ts               pure: raw → rows  (TDD)
    rank.ts                    pure: tier name ↔ index helpers (TDD)
    snapshot.ts                export/import snapshot.json
    db/
      schema.ts                Drizzle tables
      client.ts                Neon connection
      queries.ts               aggregations (TDD against test rows)
      data-source.ts           DB-primary / snapshot-fallback accessor (TDD)
  scripts/
    sync.ts  backfill.ts  restore.ts
  drizzle/                     generated migrations
  data/snapshot.json           committed backup / fallback
  prototype/                   archived static prototype (old viz/, *.sh)
  tests/                       vitest unit + playwright smoke
  .github/workflows/sync.yml
  drizzle.config.ts  next.config.ts  vitest.config.ts  playwright.config.ts
  tsconfig.json  package.json  .env  .env.example  README.md
```

Each `lib/*` file has one responsibility. Pure logic (`transform.ts`, `rank.ts`, `queries.ts`, `data-source.ts`) is unit-tested. Components take typed props and render from data the page passes in.

---

## Phase 0 — Scaffold

### Task 0.1: Archive the prototype

**Files:**

- Move: `viz/`, `scripts/fetch.sh`, `scripts/build-data.sh`, `data/raw/` → `prototype/`

- [ ] **Step 1: Move prototype files**

```bash
cd valorant-stats
mkdir -p prototype
git mv viz prototype/viz
git mv scripts/fetch.sh prototype/fetch.sh
git mv scripts/build-data.sh prototype/build-data.sh
git mv data/raw prototype/raw
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Archive static prototype under prototype/"
```

### Task 0.2: Initialize Next.js + TypeScript

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`.

- [ ] **Step 1: Scaffold Next.js into the existing repo**

Run (non-interactive, into current dir):

```bash
pnpm dlx create-next-app@latest . --ts --app --no-tailwind --no-src-dir --import-alias "@/*" --eslint --use-pnpm
```

When prompted that the directory is non-empty, keep existing files (the prototype/ and docs/ stay). Expected: `app/`, `package.json`, `tsconfig.json` created.

- [ ] **Step 2: Verify dev server boots**

Run: `pnpm dev` then visit `http://localhost:3000`. Expected: Next.js starter page renders. Stop the server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js + TypeScript app"
```

### Task 0.3: Install project dependencies

**Files:** Modify `package.json`.

- [ ] **Step 1: Add runtime + dev deps**

```bash
pnpm add drizzle-orm @neondatabase/serverless chart.js react-chartjs-2 dotenv
pnpm add -D drizzle-kit vitest @vitejs/plugin-react tsx @playwright/test @types/node
pnpm exec playwright install chromium
```

- [ ] **Step 2: Add scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"sync": "tsx scripts/sync.ts",
"backfill": "tsx scripts/backfill.ts",
"restore": "tsx scripts/restore.ts",
"test": "vitest run",
"test:watch": "vitest",
"smoke": "playwright test"
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add project dependencies and scripts"
```

### Task 0.4: Config files

**Files:** Create `.env.example`, `vitest.config.ts`, `drizzle.config.ts`, `lib/config.ts`. Update `.env`.

- [ ] **Step 1: Write `.env.example`**

```bash
# .env.example
VAL_API_KEY=HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DATABASE_URL=postgres://USER:PASSWORD@HOST/db?sslmode=require
RIOT_NAME=ST1CCS
RIOT_TAG=STONE
REGION=na
PLATFORM=pc
```

- [ ] **Step 2: Add real values to `.env`** (gitignored — already created in prototype phase)

Append `DATABASE_URL` (from Neon dashboard → connection string) to the existing `.env`. Keep `VAL_API_KEY`, `RIOT_NAME`, etc.

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Write `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: Write `lib/config.ts`**

```ts
export const account = {
  name: process.env.RIOT_NAME ?? "ST1CCS",
  tag: process.env.RIOT_TAG ?? "STONE",
  region: process.env.REGION ?? "na",
  platform: process.env.PLATFORM ?? "pc",
};
```

- [ ] **Step 6: Commit**

```bash
git add .env.example vitest.config.ts drizzle.config.ts lib/config.ts
git commit -m "Add config: env example, vitest, drizzle, account config"
```

---

## Phase 1 — Database (Drizzle + Neon)

### Task 1.1: Define the schema

**Files:** Create `lib/db/schema.ts`.

- [ ] **Step 1: Write the schema**

```ts
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

export const matches = pgTable("matches", {
  matchId: text("match_id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  season: text("season").notNull(),
  map: text("map").notNull(),
  agent: text("agent").notNull(),
  tier: integer("tier").notNull(),
  kills: integer("kills").notNull(),
  deaths: integer("deaths").notNull(),
  assists: integer("assists").notNull(),
  score: integer("score").notNull(),
  shotsHead: integer("shots_head").notNull(),
  shotsBody: integer("shots_body").notNull(),
  shotsLeg: integer("shots_leg").notNull(),
  damageMade: integer("damage_made").notNull(),
  damageReceived: integer("damage_received").notNull(),
  roundsWon: integer("rounds_won").notNull(),
  roundsLost: integer("rounds_lost").notNull(),
  won: boolean("won").notNull(),
  detail: jsonb("detail"),
  hasDetail: boolean("has_detail").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rankHistory = pgTable("rank_history", {
  matchId: text("match_id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  tier: integer("tier").notNull(),
  tierName: text("tier_name").notNull(),
  rr: integer("rr").notNull(),
  lastChange: integer("last_change").notNull(),
  elo: integer("elo").notNull(),
  map: text("map").notNull(),
});

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  matchesAdded: integer("matches_added").notNull().default(0),
  ranksAdded: integer("ranks_added").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  note: text("note"),
});

export type MatchRow = typeof matches.$inferInsert;
export type RankRow = typeof rankHistory.$inferInsert;
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/schema.ts
git commit -m "Add Drizzle schema: matches, rank_history, sync_runs"
```

### Task 1.2: DB client

**Files:** Create `lib/db/client.ts`.

- [ ] **Step 1: Write the client**

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/client.ts
git commit -m "Add Neon DB client"
```

### Task 1.3: Generate and apply the migration

**Files:** Create `drizzle/` migration files.

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected: a new SQL file under `drizzle/` defining the three tables.

- [ ] **Step 2: Apply to Neon**

Run: `pnpm db:migrate`
Expected: "migrations applied" with no error (requires `DATABASE_URL` in `.env`).

- [ ] **Step 3: Verify tables exist**

Run: `pnpm tsx -e "import {db} from './lib/db/client'; import {syncRuns} from './lib/db/schema'; db.select().from(syncRuns).then(r=>{console.log('rows:',r.length); process.exit(0)})"`
Expected: `rows: 0` (table exists, empty).

- [ ] **Step 4: Commit**

```bash
git add drizzle
git commit -m "Generate and apply initial DB migration"
```

---

## Phase 2 — Domain types, transforms, and API client

### Task 2.1: Shared types

**Files:** Create `lib/types.ts`.

- [ ] **Step 1: Write types**

```ts
// Curated domain types the app/components consume.
export interface MatchSummary {
  matchId: string;
  playedAt: string;
  season: string;
  map: string;
  agent: string;
  tier: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  shotsHead: number;
  shotsBody: number;
  shotsLeg: number;
  damageMade: number;
  damageReceived: number;
  roundsWon: number;
  roundsLost: number;
  won: boolean;
}
export interface RankPoint {
  matchId: string;
  playedAt: string;
  tier: number;
  tierName: string;
  rr: number;
  lastChange: number;
  elo: number;
  map: string;
}
export interface MapAgg {
  map: string;
  games: number;
  wins: number;
  winRate: number;
  avgKd: number;
  avgAdr: number;
}
export interface AgentAgg {
  agent: string;
  games: number;
  wins: number;
  winRate: number;
  avgKd: number;
  avgHs: number;
  avgAdr: number;
}
export interface WeaponUsage {
  weapon: string;
  kills: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "Add shared domain types"
```

### Task 2.2: Transform stored-match → row (TDD)

**Files:** Create `tests/transform.test.ts`, `lib/transform.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform.test.ts
import { describe, it, expect } from "vitest";
import { storedMatchToRow } from "@/lib/transform";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/transform.test.ts`
Expected: FAIL — "storedMatchToRow is not a function".

- [ ] **Step 3: Implement**

```ts
// lib/transform.ts
import type { MatchRow, RankRow } from "@/lib/db/schema";

export function storedMatchToRow(m: any): MatchRow {
  const team = m.stats.team as "Red" | "Blue";
  const roundsWon = team === "Red" ? m.teams.red : m.teams.blue;
  const roundsLost = team === "Red" ? m.teams.blue : m.teams.red;
  return {
    matchId: m.meta.id,
    playedAt: new Date(m.meta.started_at),
    season: m.meta.season.short,
    map: m.meta.map.name,
    agent: m.stats.character.name,
    tier: m.stats.tier,
    kills: m.stats.kills,
    deaths: m.stats.deaths,
    assists: m.stats.assists,
    score: m.stats.score,
    shotsHead: m.stats.shots.head,
    shotsBody: m.stats.shots.body,
    shotsLeg: m.stats.shots.leg,
    damageMade: m.stats.damage.made,
    damageReceived: m.stats.damage.received,
    roundsWon,
    roundsLost,
    won: roundsWon > roundsLost,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/transform.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/transform.test.ts lib/transform.ts
git commit -m "Add storedMatchToRow transform with tests"
```

### Task 2.3: Transform mmr-history → rank row (TDD)

**Files:** Modify `tests/transform.test.ts`, `lib/transform.ts`.

- [ ] **Step 1: Add the failing test**

```ts
// append to tests/transform.test.ts
import { mmrEntryToRankRow } from "@/lib/transform";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/transform.test.ts`
Expected: FAIL — "mmrEntryToRankRow is not a function".

- [ ] **Step 3: Implement**

```ts
// append to lib/transform.ts
export function mmrEntryToRankRow(e: any): RankRow {
  return {
    matchId: e.match_id,
    playedAt: new Date(e.date),
    tier: e.tier.id,
    tierName: e.tier.name,
    rr: e.rr,
    lastChange: e.last_change,
    elo: e.elo,
    map: e.map.name,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/transform.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/transform.test.ts lib/transform.ts
git commit -m "Add mmrEntryToRankRow transform with test"
```

### Task 2.4: Normalize match detail (weapons + coords) (TDD)

**Files:** Modify `tests/transform.test.ts`, `lib/transform.ts`.

- [ ] **Step 1: Add the failing test**

```ts
// append to tests/transform.test.ts
import { normalizeDetail } from "@/lib/transform";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/transform.test.ts`
Expected: FAIL — "normalizeDetail is not a function".

- [ ] **Step 3: Implement**

```ts
// append to lib/transform.ts
export interface NormalizedDetail {
  weapons: { weapon: string; kills: number }[];
  killCoords: { x: number; y: number }[];
}

export function normalizeDetail(detail: any, puuid: string): NormalizedDetail {
  const mine = (detail.kills ?? []).filter(
    (k: any) => k.killer?.puuid === puuid,
  );
  const counts = new Map<string, number>();
  const killCoords: { x: number; y: number }[] = [];
  for (const k of mine) {
    const w = k.weapon?.name ?? "Unknown";
    counts.set(w, (counts.get(w) ?? 0) + 1);
    if (k.victim_location)
      killCoords.push({ x: k.victim_location.x, y: k.victim_location.y });
  }
  const weapons = [...counts.entries()]
    .map(([weapon, kills]) => ({ weapon, kills }))
    .sort((a, b) => b.kills - a.kills);
  return { weapons, killCoords };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/transform.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/transform.test.ts lib/transform.ts
git commit -m "Add normalizeDetail (weapon usage + kill coords) with test"
```

### Task 2.5: HenrikDev API client

**Files:** Create `lib/henrik.ts`.

- [ ] **Step 1: Implement the client with throttling**

```ts
// lib/henrik.ts — server-only
import "dotenv/config";

const BASE = "https://api.henrikdev.xyz/valorant";
const KEY = () => process.env.VAL_API_KEY!;

// Basic tier = 30 req/min. Throttle ~2.2s between calls to stay safe.
let last = 0;
async function throttle() {
  const wait = 2200 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

async function get<T>(path: string): Promise<T> {
  await throttle();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: KEY() },
  });
  if (!res.ok) throw new Error(`HenrikDev ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const henrik = {
  account: (name: string, tag: string) =>
    get<any>(`/v2/account/${name}/${tag}`),
  mmr: (r: string, p: string, name: string, tag: string) =>
    get<any>(`/v3/mmr/${r}/${p}/${name}/${tag}`),
  mmrHistory: (r: string, p: string, name: string, tag: string) =>
    get<any>(`/v2/mmr-history/${r}/${p}/${name}/${tag}`),
  storedCompetitive: (r: string, name: string, tag: string, size = 200) =>
    get<any>(
      `/v1/stored-matches/${r}/${name}/${tag}?mode=competitive&size=${size}`,
    ),
  matchById: (r: string, id: string) => get<any>(`/v4/match/${r}/${id}`),
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/henrik.ts
git commit -m "Add HenrikDev API client with rate-limit throttle"
```

---

## Phase 3 — Pipeline scripts

### Task 3.1: Snapshot export/import

**Files:** Create `lib/snapshot.ts`.

- [ ] **Step 1: Implement export/import**

```ts
// lib/snapshot.ts
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PATH = join(process.cwd(), "data", "snapshot.json");

export interface Snapshot {
  generatedAt: string;
  account: any;
  mmr: any;
  matches: any[];
  rankHistory: any[];
}

export function writeSnapshot(s: Snapshot) {
  writeFileSync(PATH, JSON.stringify(s, null, 2));
}

export function readSnapshot(): Snapshot | null {
  if (!existsSync(PATH)) return null;
  return JSON.parse(readFileSync(PATH, "utf8")) as Snapshot;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/snapshot.ts
git commit -m "Add snapshot export/import"
```

### Task 3.2: Sync script

**Files:** Create `scripts/sync.ts`.

- [ ] **Step 1: Implement the sync**

```ts
// scripts/sync.ts
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches, rankHistory, syncRuns } from "@/lib/db/schema";
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
import {
  storedMatchToRow,
  mmrEntryToRankRow,
  normalizeDetail,
} from "@/lib/transform";
import { writeSnapshot } from "@/lib/snapshot";
import { sql } from "drizzle-orm";

async function main() {
  const { name, tag, region, platform } = account;
  const acc = await henrik.account(name, tag);
  const puuid = acc.data.puuid;
  const mmr = await henrik.mmr(region, platform, name, tag);
  const hist = await henrik.mmrHistory(region, platform, name, tag);
  const stored = await henrik.storedCompetitive(region, name, tag);

  const matchRows = stored.data.map(storedMatchToRow);
  const rankRows = (hist.data.history ?? []).map(mmrEntryToRankRow);

  // Count new rows by diffing existing ids (robust across drivers).
  const existingMatchIds = new Set(
    (await db.select({ id: matches.matchId }).from(matches)).map((r) => r.id),
  );
  const existingRankIds = new Set(
    (await db.select({ id: rankHistory.matchId }).from(rankHistory)).map(
      (r) => r.id,
    ),
  );
  const newMatches = matchRows.filter((r) => !existingMatchIds.has(r.matchId));
  const newRanks = rankRows.filter((r) => !existingRankIds.has(r.matchId));

  if (newMatches.length)
    await db.insert(matches).values(newMatches).onConflictDoNothing();
  if (newRanks.length)
    await db.insert(rankHistory).values(newRanks).onConflictDoNothing();

  const matchesAdded = newMatches.length;
  const ranksAdded = newRanks.length;

  // Deep-detail any NEW matches missing detail (throttled inside henrik client).
  const need = await db
    .select({ id: matches.matchId })
    .from(matches)
    .where(sql`${matches.hasDetail} = false`);
  for (const { id } of need) {
    try {
      const full = await henrik.matchById(region, id);
      const detail = normalizeDetail(full.data, puuid);
      await db
        .update(matches)
        .set({ detail, hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
    } catch (e) {
      console.warn(`detail fetch failed for ${id}:`, (e as Error).message);
    }
  }

  await db.insert(syncRuns).values({
    matchesAdded,
    ranksAdded,
    ok: true,
    note: `synced ${matchRows.length} matches, ${rankRows.length} rank pts`,
  });

  // Export snapshot (full DB state) for backup + fallback.
  const allMatches = await db.select().from(matches);
  const allRanks = await db.select().from(rankHistory);
  writeSnapshot({
    generatedAt: new Date().toISOString(),
    account: acc.data,
    mmr: mmr.data,
    matches: allMatches,
    rankHistory: allRanks,
  });

  console.log(
    `Sync OK: +${matchesAdded} matches, +${ranksAdded} rank pts. Snapshot written.`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the sync against Neon**

Run: `pnpm sync`
Expected: `Sync OK: +136 matches, +N rank pts. Snapshot written.` and `data/snapshot.json` created. (First run inserts all 136; re-running prints `+0`.)

- [ ] **Step 3: Verify idempotency**

Run: `pnpm sync` again.
Expected: `Sync OK: +0 matches, +0 rank pts.` (upsert dedupes).

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.ts data/snapshot.json
git commit -m "Add idempotent sync script + initial snapshot"
```

### Task 3.3: Backfill script

**Files:** Create `scripts/backfill.ts`.

- [ ] **Step 1: Implement**

```ts
// scripts/backfill.ts — one-time deep detail for all matches lacking it
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
import { henrikPuuid } from "@/lib/henrik-puuid"; // helper below
import { normalizeDetail } from "@/lib/transform";
import { sql } from "drizzle-orm";

async function main() {
  const puuid = await henrikPuuid();
  const rows = await db
    .select({ id: matches.matchId })
    .from(matches)
    .where(sql`${matches.hasDetail} = false`);
  console.log(
    `Backfilling ${rows.length} matches (~${Math.ceil((rows.length * 2.2) / 60)} min)…`,
  );
  let done = 0;
  for (const { id } of rows) {
    try {
      const full = await henrik.matchById(account.region, id);
      await db
        .update(matches)
        .set({ detail: normalizeDetail(full.data, puuid), hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${rows.length}`);
    } catch (e) {
      console.warn(`  skip ${id}: ${(e as Error).message}`);
    }
  }
  console.log(`Backfill complete: ${done}/${rows.length}.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the puuid helper**

```ts
// lib/henrik-puuid.ts
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
export async function henrikPuuid(): Promise<string> {
  const acc = await henrik.account(account.name, account.tag);
  return acc.data.puuid;
}
```

- [ ] **Step 3: Run the backfill**

Run: `pnpm backfill`
Expected: progress to `Backfill complete: 136/136` (~5 min).

- [ ] **Step 4: Re-export snapshot with detail and commit**

```bash
pnpm sync
git add scripts/backfill.ts lib/henrik-puuid.ts data/snapshot.json
git commit -m "Add one-time deep-detail backfill script"
```

### Task 3.4: Restore script

**Files:** Create `scripts/restore.ts`.

- [ ] **Step 1: Implement**

```ts
// scripts/restore.ts — rebuild DB tables from snapshot.json
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches, rankHistory } from "@/lib/db/schema";
import { readSnapshot } from "@/lib/snapshot";

async function main() {
  const snap = readSnapshot();
  if (!snap) {
    console.error("No snapshot.json found.");
    process.exit(1);
  }
  await db.delete(matches);
  await db.delete(rankHistory);
  if (snap.matches.length) await db.insert(matches).values(snap.matches);
  if (snap.rankHistory.length)
    await db.insert(rankHistory).values(snap.rankHistory);
  console.log(
    `Restored ${snap.matches.length} matches, ${snap.rankHistory.length} rank pts from snapshot.`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/restore.ts
git commit -m "Add restore-from-snapshot script"
```

---

## Phase 4 — Queries + data-source fallback (TDD)

### Task 4.1: Aggregations (TDD)

**Files:** Create `tests/aggregations.test.ts`, `lib/aggregations.ts`.

These are **pure functions** over `MatchSummary[]` so they're trivially testable; `queries.ts` (Task 4.3) just fetches rows and calls them.

- [ ] **Step 1: Write the failing test**

```ts
// tests/aggregations.test.ts
import { describe, it, expect } from "vitest";
import { byMap, byAgent, currentForm } from "@/lib/aggregations";
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/aggregations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/aggregations.ts
import type { MatchSummary, MapAgg, AgentAgg } from "@/lib/types";

const kd = (m: MatchSummary) => (m.deaths ? m.kills / m.deaths : m.kills);
const adr = (m: MatchSummary) => {
  const rounds = m.roundsWon + m.roundsLost;
  return rounds ? m.damageMade / rounds : 0;
};
const hs = (m: MatchSummary) => {
  const s = m.shotsHead + m.shotsBody + m.shotsLeg;
  return s ? (m.shotsHead * 100) / s : 0;
};
const avg = (ns: number[]) =>
  ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows)
    (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
  return m;
}

export function byMap(rows: MatchSummary[]): MapAgg[] {
  return [...groupBy(rows, (r) => r.map).entries()]
    .map(([map, ms]) => ({
      map,
      games: ms.length,
      wins: ms.filter((m) => m.won).length,
      winRate: (ms.filter((m) => m.won).length * 100) / ms.length,
      avgKd: avg(ms.map(kd)),
      avgAdr: avg(ms.map(adr)),
    }))
    .sort((a, b) => b.games - a.games);
}

export function byAgent(rows: MatchSummary[]): AgentAgg[] {
  return [...groupBy(rows, (r) => r.agent).entries()]
    .map(([agent, ms]) => ({
      agent,
      games: ms.length,
      wins: ms.filter((m) => m.won).length,
      winRate: (ms.filter((m) => m.won).length * 100) / ms.length,
      avgKd: avg(ms.map(kd)),
      avgHs: avg(ms.map(hs)),
      avgAdr: avg(ms.map(adr)),
    }))
    .sort((a, b) => b.games - a.games);
}

export function currentForm(rows: MatchSummary[], n: number) {
  const recent = [...rows]
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, n);
  return {
    games: recent.length,
    wins: recent.filter((m) => m.won).length,
    avgKd: avg(recent.map(kd)),
    avgHs: avg(recent.map(hs)),
    avgAdr: avg(recent.map(adr)),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/aggregations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/aggregations.test.ts lib/aggregations.ts
git commit -m "Add pure aggregation functions with tests"
```

### Task 4.2: Data-source with fallback (TDD)

**Files:** Create `tests/data-source.test.ts`, `lib/db/data-source.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data-source.test.ts
import { describe, it, expect } from "vitest";
import { withFallback } from "@/lib/db/data-source";

describe("withFallback", () => {
  it("returns the DB result when the loader succeeds", async () => {
    const out = await withFallback({
      fromDb: async () => "db",
      fromSnapshot: () => "snap",
    });
    expect(out).toBe("db");
  });

  it("falls back to the snapshot when the DB loader throws", async () => {
    const out = await withFallback({
      fromDb: async () => {
        throw new Error("DB down");
      },
      fromSnapshot: () => "snap",
    });
    expect(out).toBe("snap");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/data-source.test.ts`
Expected: FAIL — "withFallback is not a function".

- [ ] **Step 3: Implement (injectable loaders keep it testable)**

```ts
// lib/db/data-source.ts
// Generic DB-primary / snapshot-fallback helper. The concrete loaders
// (getMatches, getRankHistory, …) live in queries.ts and call this.
interface Loaders<T> {
  fromDb: () => Promise<T>;
  fromSnapshot: () => T;
}

export async function withFallback<T>(loaders: Loaders<T>): Promise<T> {
  try {
    return await loaders.fromDb();
  } catch (e) {
    console.warn("DB unavailable, using snapshot:", (e as Error).message);
    return loaders.fromSnapshot();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/data-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/data-source.test.ts lib/db/data-source.ts
git commit -m "Add DB→snapshot fallback accessor with tests"
```

### Task 4.3: Queries (DB + snapshot loaders)

**Files:** Create `lib/db/queries.ts`.

- [ ] **Step 1: Implement loaders that wire DB/snapshot into the fallback**

```ts
// lib/db/queries.ts
import { db } from "@/lib/db/client";
import { matches, rankHistory, syncRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { readSnapshot } from "@/lib/snapshot";
import { withFallback } from "@/lib/db/data-source";
import type { MatchSummary, RankPoint, WeaponUsage } from "@/lib/types";

const rowToSummary = (r: any): MatchSummary => ({
  matchId: r.matchId,
  playedAt: new Date(r.playedAt).toISOString(),
  season: r.season,
  map: r.map,
  agent: r.agent,
  tier: r.tier,
  kills: r.kills,
  deaths: r.deaths,
  assists: r.assists,
  score: r.score,
  shotsHead: r.shotsHead,
  shotsBody: r.shotsBody,
  shotsLeg: r.shotsLeg,
  damageMade: r.damageMade,
  damageReceived: r.damageReceived,
  roundsWon: r.roundsWon,
  roundsLost: r.roundsLost,
  won: r.won,
});

export function getMatches(): Promise<MatchSummary[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(matches)).map(rowToSummary),
    fromSnapshot: () => (readSnapshot()?.matches ?? []).map(rowToSummary),
  });
}

export function getRankHistory(): Promise<RankPoint[]> {
  return withFallback({
    fromDb: async () => (await db.select().from(rankHistory)) as any,
    fromSnapshot: () => (readSnapshot()?.rankHistory ?? []) as any,
  });
}

export function getAccountMmr(): Promise<{ account: any; mmr: any } | null> {
  return withFallback({
    fromDb: async () => {
      const s = readSnapshot();
      return s ? { account: s.account, mmr: s.mmr } : null;
    },
    fromSnapshot: () => {
      const s = readSnapshot();
      return s ? { account: s.account, mmr: s.mmr } : null;
    },
  });
}

export function topWeapon(detailRows: { detail: any }[]): WeaponUsage | null {
  const counts = new Map<string, number>();
  for (const r of detailRows)
    for (const w of r.detail?.weapons ?? [])
      counts.set(w.weapon, (counts.get(w.weapon) ?? 0) + w.kills);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { weapon: top[0], kills: top[1] } : null;
}

export async function lastSync() {
  try {
    return (
      (
        await db.select().from(syncRuns).orderBy(desc(syncRuns.ranAt)).limit(1)
      )[0] ?? null
    );
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Smoke-check queries against the synced DB**

Run: `pnpm tsx -e "import {getMatches} from './lib/db/queries'; getMatches().then(m=>{console.log('matches:',m.length); process.exit(0)})"`
Expected: `matches: 136` (or current count).

- [ ] **Step 3: Commit**

```bash
git add lib/db/queries.ts
git commit -m "Add query loaders wiring DB + snapshot fallback"
```

---

## Phase 5 — App shell, Splash, Home

### Task 5.1: Root layout + nav

**Files:** Create `components/Nav.tsx`, `app/globals.css` (theme), modify `app/layout.tsx`.

- [ ] **Step 1: Write the theme variables** into `app/globals.css` (port palette from `prototype/viz/index.html`):

```css
:root {
  --bg: #0e1015;
  --panel: #1a1f2b;
  --panel2: #222838;
  --line: #2c3344;
  --text: #ece8e1;
  --muted: #8b93a7;
  --accent: #ff4655;
  --green: #2ecc71;
  --red: #ff5b6e;
  --yellow: #e7c84b;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
}
a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 2: Write `components/Nav.tsx`**

```tsx
import Link from "next/link";
const tabs = [
  ["/home", "Home"],
  ["/track", "Track"],
  ["/improve", "Improve"],
  ["/showcase", "Showcase"],
] as const;
export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: 8,
        padding: "14px 20px",
        borderBottom: "2px solid var(--accent)",
      }}
    >
      {tabs.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          style={{ padding: "4px 14px", borderRadius: 6 }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Modify `app/layout.tsx`** to import `./globals.css` and render `{children}` inside `<body>`. (Nav is rendered per-page except Splash, so do NOT put it in the root layout.)

```tsx
import "./globals.css";
export const metadata = { title: "Valorant Competitive Tracker" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/Nav.tsx app/layout.tsx
git commit -m "Add theme, nav, and root layout"
```

### Task 5.2: Splash screen (auto-advance)

**Files:** Modify `app/page.tsx`, create `app/Splash.tsx`.

- [ ] **Step 1: Write the client splash** `app/Splash.tsx`

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Splash({
  name,
  tag,
  level,
  region,
}: {
  name: string;
  tag: string;
  level: number;
  region: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/home"), 1500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800 }}>
        {name} <span style={{ color: "var(--muted)" }}>#{tag}</span>
      </div>
      <div style={{ color: "var(--muted)", marginTop: 6 }}>
        Level {level} · {region.toUpperCase()}
      </div>
      <div style={{ color: "var(--muted)", marginTop: 24, fontSize: 13 }}>
        loading your competitive data…
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the server `app/page.tsx`** that loads account and renders Splash

```tsx
import Splash from "./Splash";
import { getAccountMmr } from "@/lib/db/queries";
export default async function Page() {
  const data = await getAccountMmr();
  const a = data?.account ?? {
    name: "ST1CCS",
    tag: "STONE",
    account_level: 0,
    region: "na",
  };
  return (
    <Splash
      name={a.name}
      tag={a.tag}
      level={a.account_level}
      region={a.region}
    />
  );
}
```

- [ ] **Step 3: Verify** `pnpm dev`, visit `/` → shows identity, redirects to `/home` after ~1.5s.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/Splash.tsx
git commit -m "Add auto-advancing splash screen"
```

### Task 5.3: Home widgets + components

**Files:** Create `components/RankHeader.tsx`, `components/SupportedTeamsChips.tsx`, `components/StatCard.tsx`, `app/home/page.tsx`.

- [ ] **Step 1: `components/StatCard.tsx`**

```tsx
export default function StatCard({
  title,
  big,
  sub,
  color,
}: {
  title: string;
  big: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--muted)",
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{big}</div>
      {sub && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `components/SupportedTeamsChips.tsx`** (placement A — under profile)

```tsx
const TEAMS = [
  { name: "Team Liquid", abbr: "TL", bg: "#0b2a6b" },
  { name: "100 Thieves", abbr: "100T", bg: "#c8102e" },
];
export default function SupportedTeamsChips() {
  return (
    <div
      style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}
    >
      <span style={{ fontSize: 10, color: "var(--muted)" }}>supporting</span>
      {TEAMS.map((t) => (
        <span
          key={t.abbr}
          title={t.name}
          style={{
            background: t.bg,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {t.abbr}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `components/RankHeader.tsx`**

```tsx
import SupportedTeamsChips from "./SupportedTeamsChips";
export default function RankHeader({
  name,
  tag,
  level,
  region,
  tier,
  rr,
  peak,
}: {
  name: string;
  tag: string;
  level: number;
  region: string;
  tier: string;
  rr: number;
  peak: string;
}) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "4px 0 18px",
      }}
    >
      <div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {name} <span style={{ color: "var(--muted)" }}>#{tag}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Level {level} · {region.toUpperCase()}
        </div>
        <SupportedTeamsChips />
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>
          {tier}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {rr} RR · peak {peak}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: `app/home/page.tsx`** (server component; computes widgets)

```tsx
import Nav from "@/components/Nav";
import RankHeader from "@/components/RankHeader";
import StatCard from "@/components/StatCard";
import { getMatches, getAccountMmr, topWeapon } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { matches as matchesTbl } from "@/lib/db/schema";
import { byMap, byAgent, currentForm } from "@/lib/aggregations";

export default async function Home() {
  const [data, ms] = await Promise.all([getAccountMmr(), getMatches()]);
  const a = data?.account,
    mmr = data?.mmr;
  const maps = byMap(ms),
    agents = byAgent(ms),
    form = currentForm(ms, 20);
  const best = maps.slice().sort((x, y) => y.winRate - x.winRate)[0];
  const worst = maps.slice().sort((x, y) => x.winRate - y.winRate)[0];
  let gun = null as Awaited<ReturnType<typeof topWeapon>>;
  try {
    gun = topWeapon(
      await db.select({ detail: matchesTbl.detail }).from(matchesTbl),
    );
  } catch {}

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <RankHeader
          name={a?.name ?? ""}
          tag={a?.tag ?? ""}
          level={a?.account_level ?? 0}
          region={a?.region ?? "na"}
          tier={mmr?.current?.tier?.name ?? "—"}
          rr={mmr?.current?.rr ?? 0}
          peak={mmr?.peak?.tier?.name ?? "—"}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
            gap: 16,
          }}
        >
          <StatCard
            title="Top 3 Agents"
            big={
              agents
                .slice(0, 3)
                .map((x) => x.agent)
                .join(" · ") || "—"
            }
            sub={`${agents[0]?.games ?? 0} games on #1`}
          />
          <StatCard
            title="Best / Worst Map"
            big={`${best?.map ?? "—"} / ${worst?.map ?? "—"}`}
            sub={`${best?.winRate.toFixed(0) ?? 0}% vs ${worst?.winRate.toFixed(0) ?? 0}%`}
          />
          <StatCard
            title="Most-used Gun"
            big={gun?.weapon ?? "—"}
            sub={gun ? `${gun.kills} kills` : "run backfill"}
          />
          <StatCard
            title="Current Form"
            big={`${form.wins}-${form.games - form.wins}`}
            sub={`KD ${form.avgKd.toFixed(2)} · HS ${form.avgHs.toFixed(0)}% · ADR ${form.avgAdr.toFixed(0)}`}
          />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Verify** `pnpm dev`, visit `/home` → rank header with team chips + four populated widgets.

- [ ] **Step 6: Commit**

```bash
git add components/RankHeader.tsx components/SupportedTeamsChips.tsx components/StatCard.tsx app/home/page.tsx
git commit -m "Add Home dashboard with rank header, team chips, and widgets"
```

---

## Phase 6 — Track tab (chart components)

Charts are thin client wrappers around react-chartjs-2; data is computed server-side and passed as props. Port chart configs from `prototype/viz/index.html`.

### Task 6.1: Chart registration helper + WinRateByMap + KDTrend + AgentTable

**Files:** Create `components/charts/ChartSetup.ts`, `components/charts/WinRateByMap.tsx`, `components/charts/KDTrend.tsx`, `components/charts/AgentTable.tsx`.

- [ ] **Step 1: `components/charts/ChartSetup.ts`**

```ts
"use client";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);
Chart.defaults.color = "#8b93a7";
Chart.defaults.borderColor = "#2c3344";
```

- [ ] **Step 2: `components/charts/WinRateByMap.tsx`**

```tsx
"use client";
import "./ChartSetup";
import { Bar } from "react-chartjs-2";
import type { MapAgg } from "@/lib/types";
const hex = (p: number) =>
  p >= 55 ? "#2ecc71" : p >= 45 ? "#e7c84b" : "#ff5b6e";
export default function WinRateByMap({ maps }: { maps: MapAgg[] }) {
  return (
    <Bar
      data={{
        labels: maps.map((m) => m.map),
        datasets: [
          {
            data: maps.map((m) => +m.winRate.toFixed(1)),
            backgroundColor: maps.map((m) => hex(m.winRate)),
          },
        ],
      }}
      options={{
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 100 } },
      }}
    />
  );
}
```

- [ ] **Step 3: `components/charts/KDTrend.tsx`**

```tsx
"use client";
import "./ChartSetup";
import { Line } from "react-chartjs-2";
import type { MatchSummary } from "@/lib/types";
export default function KDTrend({ rows }: { rows: MatchSummary[] }) {
  const chrono = [...rows].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const kd = chrono.map((m) =>
    m.deaths ? +(m.kills / m.deaths).toFixed(2) : m.kills,
  );
  const avg = kd.reduce((a, b) => a + b, 0) / (kd.length || 1);
  return (
    <Line
      data={{
        labels: chrono.map((_, i) => i + 1),
        datasets: [
          {
            label: "K/D",
            data: kd,
            borderColor: "#46b6cf",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: "avg",
            data: kd.map(() => +avg.toFixed(2)),
            borderColor: "#ff4655",
            borderWidth: 1,
            borderDash: [6, 4],
            pointRadius: 0,
          },
        ],
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { min: 0 } },
      }}
    />
  );
}
```

- [ ] **Step 4: `components/charts/AgentTable.tsx`**

```tsx
import type { AgentAgg } from "@/lib/types";
const wr = (p: number) =>
  p >= 55 ? "var(--green)" : p >= 45 ? "var(--yellow)" : "var(--red)";
export default function AgentTable({ agents }: { agents: AgentAgg[] }) {
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}
    >
      <thead>
        <tr
          style={{
            color: "var(--muted)",
            fontSize: 11,
            textTransform: "uppercase",
          }}
        >
          <th style={{ textAlign: "left", padding: 9 }}>Agent</th>
          <th>Games</th>
          <th>Win%</th>
          <th>KD</th>
          <th>HS%</th>
          <th>ADR</th>
        </tr>
      </thead>
      <tbody>
        {agents.map((a) => (
          <tr key={a.agent} style={{ borderBottom: "1px solid var(--line)" }}>
            <td style={{ padding: 9 }}>{a.agent}</td>
            <td style={{ textAlign: "right" }}>{a.games}</td>
            <td
              style={{
                textAlign: "right",
                color: wr(a.winRate),
                fontWeight: 700,
              }}
            >
              {a.winRate.toFixed(0)}%
            </td>
            <td style={{ textAlign: "right" }}>{a.avgKd.toFixed(2)}</td>
            <td style={{ textAlign: "right" }}>{a.avgHs.toFixed(1)}%</td>
            <td style={{ textAlign: "right" }}>{Math.round(a.avgAdr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/charts/
git commit -m "Add Track chart components: WinRateByMap, KDTrend, AgentTable"
```

### Task 6.2: EloTimeline + Track page

**Files:** Create `components/charts/EloTimeline.tsx`, `app/track/page.tsx`.

- [ ] **Step 1: `components/charts/EloTimeline.tsx`**

```tsx
"use client";
import "./ChartSetup";
import { Line } from "react-chartjs-2";
import type { RankPoint } from "@/lib/types";
export default function EloTimeline({ points }: { points: RankPoint[] }) {
  const chrono = [...points].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt),
  );
  return (
    <Line
      data={{
        labels: chrono.map((p) => new Date(p.playedAt).toLocaleDateString()),
        datasets: [
          {
            label: "Elo",
            data: chrono.map((p) => p.elo),
            borderColor: "#ff4655",
            backgroundColor: "rgba(255,70,85,.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      }}
      options={{ plugins: { legend: { display: false } } }}
    />
  );
}
```

- [ ] **Step 2: `app/track/page.tsx`**

```tsx
import Nav from "@/components/Nav";
import WinRateByMap from "@/components/charts/WinRateByMap";
import KDTrend from "@/components/charts/KDTrend";
import AgentTable from "@/components/charts/AgentTable";
import EloTimeline from "@/components/charts/EloTimeline";
import { getMatches, getRankHistory } from "@/lib/db/queries";
import { byMap, byAgent } from "@/lib/aggregations";

const Panel = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section
    style={{
      background: "var(--panel)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      padding: "18px 20px",
      marginTop: 18,
    }}
  >
    <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>{title}</h2>
    {children}
  </section>
);

export default async function Track() {
  const [ms, ranks] = await Promise.all([getMatches(), getRankHistory()]);
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <Panel title="Elo Timeline">
          <div style={{ height: 300 }}>
            <EloTimeline points={ranks} />
          </div>
        </Panel>
        <Panel title="Win Rate by Map">
          <div style={{ height: 320 }}>
            <WinRateByMap maps={byMap(ms)} />
          </div>
        </Panel>
        <Panel title="K/D Trend">
          <div style={{ height: 280 }}>
            <KDTrend rows={ms} />
          </div>
        </Panel>
        <Panel title="Performance by Agent">
          <AgentTable agents={byAgent(ms)} />
        </Panel>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify** `pnpm dev`, visit `/track` → four panels render with charts/table.

- [ ] **Step 4: Commit**

```bash
git add components/charts/EloTimeline.tsx app/track/page.tsx
git commit -m "Add Track tab with elo, map, KD, and agent panels"
```

---

## Phase 7 — Stubs

### Task 7.1: Improve + Showcase stub pages

**Files:** Create `app/improve/page.tsx`, `app/showcase/page.tsx`.

- [ ] **Step 1: Write both stubs**

```tsx
// app/improve/page.tsx
import Nav from "@/components/Nav";
export default function Improve() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px" }}>
        <h1>Improve</h1>
        <p style={{ color: "var(--muted)" }}>
          Coming soon — weak-map/agent signals, ban &amp; dodge suggestions,
          agent-pool gaps.
        </p>
      </main>
    </>
  );
}
```

```tsx
// app/showcase/page.tsx
import Nav from "@/components/Nav";
export default function Showcase() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px" }}>
        <h1>Showcase</h1>
        <p style={{ color: "var(--muted)" }}>
          Coming soon — kill/death heatmaps from match coordinates.
        </p>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/improve/page.tsx app/showcase/page.tsx
git commit -m "Add Improve and Showcase stub pages"
```

---

## Phase 8 — Smoke test + automation + docs

### Task 8.1: Playwright smoke

**Files:** Create `playwright.config.ts`, `tests/smoke.spec.ts`.

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 2: `tests/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
test("splash redirects to home and widgets render", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/home");
  await expect(page.getByText("Current Form")).toBeVisible();
});
test("nav routes resolve", async ({ page }) => {
  for (const path of ["/home", "/track", "/improve", "/showcase"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
  }
});
```

- [ ] **Step 3: Run the smoke test**

Run: `pnpm smoke`
Expected: 2 passed. (Requires `snapshot.json` present so Home has data.)

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/smoke.spec.ts
git commit -m "Add Playwright smoke test"
```

### Task 8.2: GitHub Action for scheduled sync

**Files:** Create `.github/workflows/sync.yml`.

- [ ] **Step 1: Write the workflow**

```yaml
name: sync
on:
  schedule: [{ cron: "0 9 * * *" }] # daily 09:00 UTC
  workflow_dispatch: {}
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm sync
        env:
          VAL_API_KEY: ${{ secrets.VAL_API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          RIOT_NAME: ST1CCS
          RIOT_TAG: STONE
          REGION: na
          PLATFORM: pc
      - name: Commit snapshot if changed
        run: |
          git config user.name "valorant-sync-bot"
          git config user.email "bot@users.noreply.github.com"
          git add data/snapshot.json
          git diff --staged --quiet || git commit -m "chore: refresh match snapshot"
          git push
```

- [ ] **Step 2: Document required GitHub secrets** in README (`VAL_API_KEY`, `DATABASE_URL`).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync.yml
git commit -m "Add scheduled sync GitHub Action"
```

### Task 8.3: README + deploy notes

**Files:** Rewrite `README.md`.

- [ ] **Step 1: Write the README** covering: project summary; setup (`pnpm install`, `.env` with `VAL_API_KEY` + Neon `DATABASE_URL`); DB (`pnpm db:migrate`); first data load (`pnpm sync` then `pnpm backfill`); run (`pnpm dev`); tests (`pnpm test`, `pnpm smoke`); deploy (Vercel + env vars + GitHub secrets for the Action); the DB-primary/snapshot-fallback design and `pnpm restore` recovery path.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Rewrite README for the Next.js tracker"
```

- [ ] **Step 3: Final verification**

Run: `pnpm test && pnpm smoke && pnpm build`
Expected: unit tests pass, smoke passes, Next.js production build succeeds.

---

## Done criteria

- `pnpm sync` + `pnpm backfill` populate Neon and write `data/snapshot.json`.
- `/` → `/home` auto-advance; Home shows rank, team chips, and four populated widgets.
- `/track` renders elo timeline, win-rate-by-map, K/D trend, and agent table.
- `/improve`, `/showcase` are reachable stubs.
- Unit tests (transform, aggregations, fallback) and the Playwright smoke pass; `pnpm build` succeeds.
- Killing the DB (bad `DATABASE_URL`) still renders pages from `snapshot.json`.
