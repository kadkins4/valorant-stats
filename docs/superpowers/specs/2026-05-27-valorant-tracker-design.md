# Valorant Competitive Tracker — Design Spec

**Date:** 2026-05-27
**Repo:** `valorant-stats` (evolved from the static prototype)
**Status:** Approved design, ready for implementation planning.

## 1. Goal

A personal, competitive-only Valorant stats web app for `ST1CCS#STONE`. Tracks rank,
form, and per-map / per-agent performance over time, backed by a real database that
**accumulates match history beyond what the API exposes**. Built to (a) be genuinely
useful to me, (b) be a portfolio piece, and (c) be a low-stakes place to learn databases.

Three product pillars — **Track** (build first), **Improve**, **Showcase**. This spec
covers **v1 = data pipeline + app shell + Home + Track**. Improve and Showcase ship as
stub pages. A VCT/esports tab is a separate future project.

## 2. Background & constraints (verified)

- Riot's official Valorant API is gated; we use the **HenrikDev unofficial API**
  (`api.henrikdev.xyz`), free **Basic** key, **30 req/min**. Key is secret.
- **True lifetime comp games = 1,504** (per-act seasonal totals are accurate).
- **Match-level detail caps at 136** via `stored-matches` (pagination dead-ends).
  Sparse/uneven, back to 2022. The rest is unrecoverable from the API.
- `v4/matches` list caps at 10, BUT **full detail is fetchable per `match_id`** for any
  stored match (confirmed: 24 rounds, 169 kills w/ coords on a 2023 game).
- `mmr-history` returns only ~5 recent rated games — so RR/elo timeline must be persisted
  on each sync to grow.
- **Implication:** to grow history we must store matches + rank history ourselves.
  We can't recover the missing past; we stop losing the future.

## 3. Decisions

| Area        | Decision                                                                               |
| ----------- | -------------------------------------------------------------------------------------- |
| Framework   | **Next.js (App Router) + TypeScript**                                                  |
| Database    | **Neon serverless Postgres** (free tier; branchable for safe experiments)              |
| DB access   | **Drizzle ORM** — schema-as-code, migrations, SQL-like typed queries                   |
| Persistence | **DB = primary**, **committed JSON snapshot = backup + runtime fallback**              |
| Sync        | Idempotent upsert by `match_id`; **GitHub Action (daily) + manual**; never destructive |
| Repo        | **Evolve `valorant-stats`**; archive current static prototype under `prototype/`       |
| Deploy      | **Vercel** (Next.js native); Neon via `DATABASE_URL`; secrets in env / GH secrets      |
| Auth        | None — single hardcoded account (configurable via env); Showcase is public read-only   |

## 4. Architecture & data flow

```
HenrikDev API  ──fetch comp matches + mmr──▶  Sync job (Node/TS, idempotent)
                                                  │
                         upsert by match_id       │       export
                         (never deletes)          ▼          │
                                            🟢 Neon Postgres  │
                                              (PRIMARY)       ▼
                                                       🟡 data/snapshot.json
                                                          (committed BACKUP)
                                                  │             │
       read primary ──────────────────────────────┘             │
       fall back to snapshot if DB unreachable ◀────────────────┘
                                                  │
                                                  ▼
                                       Next.js (App Router, RSC)
                                       key never reaches client
                                                  │
                         ┌────────────┬───────────┴────┬──────────┬───────────┐
                       Splash       Home             Track      Improve     Showcase
                    (auto-advance) (dashboard)    (v1 focus)   (stub)    (stub, public)
```

- The sync job and DB access run **server-side only**. The HenrikDev key and
  `DATABASE_URL` live in env vars (Vercel + GitHub Action secrets); never bundled to client.
- **Fallback:** a single data-access layer tries Neon; on connection error it reads
  `data/snapshot.json`. The site renders either way.
- **Safe experimentation:** Neon branching for throwaway DB copies; `restore.ts` rebuilds
  the DB from `snapshot.json` if it's wiped or corrupted.

## 5. Data model (Drizzle / Postgres)

**`matches`** — one row per competitive game.

- `match_id` text PK
- `played_at` timestamptz, `season` text, `map` text, `agent` text, `tier` int
- `kills` `deaths` `assists` `score` int
- `shots_head` `shots_body` `shots_leg` int
- `damage_made` `damage_received` int
- `rounds_won` `rounds_lost` int, `won` boolean
- `detail` jsonb null (weapons, kill coords, per-round — populated by backfill)
- `has_detail` boolean default false
- `synced_at` timestamptz default now()

**`rank_history`** — one row per rated game (accumulates beyond the API's 5-game window).

- `match_id` text PK, `played_at` timestamptz
- `tier` int, `tier_name` text, `rr` int, `last_change` int, `elo` int, `map` text

**`sync_runs`** — audit log + "last updated" stamp.

- `id` serial PK, `ran_at` timestamptz default now()
- `matches_added` int, `ranks_added` int, `ok` boolean, `note` text

Account + current/peak/seasonal MMR are **current-state**, not time series — fetched live
per request from HenrikDev (small, fast) and mirrored into `snapshot.json` for fallback.

## 6. Data pipeline (`scripts/` + `lib/`)

- `lib/henrik.ts` — typed HenrikDev client (account, mmr, mmr-history, stored-matches,
  match-by-id). Server-only. Respects 30 req/min (throttle helper).
- `lib/transform.ts` — pure functions: raw stored-match → `matches` row;
  mmr-history entry → `rank_history` row; raw detail → normalized `detail` JSONB
  (weapon kill counts, kill coordinates, per-round summary). **Pure → unit-tested.**
- `scripts/sync.ts` — fetch account/mmr/mmr-history + stored comp matches → upsert
  `matches` & `rank_history` (dedupe by `match_id`) → deep-fetch detail for NEW matches
  lacking it → write `sync_runs` row → export `snapshot.json`. Incremental; safe to re-run.
- `scripts/backfill.ts` — one-time: deep-fetch detail for ALL stored `match_id`s without
  detail (~136 calls, throttled, ~5 min). Sets `has_detail=true`.
- `lib/snapshot.ts` — export full DB (account+mmr+matches+rank_history) → `data/snapshot.json`;
  import for restore.
- `scripts/restore.ts` — rebuild DB from `snapshot.json`.
- `lib/db/queries.ts` — aggregations as SQL (Drizzle): WR/KD/ADR by map, by agent;
  current form (last N); rank/elo timeline; most-used weapon (from `detail`).
- `lib/db/data-source.ts` — single accessor: try Neon, fall back to `snapshot.json`.

## 7. Screens & features (v1)

- **Splash** (`/`) — account identity (name#tag, card art, level, region); auto-advances
  to `/home` after data loads.
- **Home** (`/home`) — rank header (current tier, RR bar, peak) + **supported-teams chips**
  under the profile (Team Liquid, 100 Thieves; static in v1, can graduate to a "My Teams"
  widget when VCT lands). Widgets: **Top 3 agents**, **best/worst map**, **most-used gun**
  (needs backfill), **current form** (last-20 W-L, KD/HS%/ADR).
- **Track** (`/track`) — port the prototype into components: rank/RR & elo timeline (from
  `rank_history`), WR by act, rank journey, **WR by map**, **per-agent table**, **K/D trend**,
  competitive match list.
- **Improve** (`/improve`) & **Showcase** (`/showcase`) — nav tabs present, "coming soon"
  stub pages. Showcase route is public for portfolio linking. Backfilled `detail` is stored
  so heatmaps can be built later without re-fetching.

## 8. Components

`SplashScreen`, `RankHeader`, `SupportedTeamsChips`, `StatCard`, and chart components
(`EloTimeline`, `WinRateByAct`, `RankJourney`, `WinRateByMap`, `KDTrend`, `AgentTable`,
`MatchList`). Charts reuse the prototype's Chart.js config, wrapped as React components.
Each component takes typed props and is independently renderable from snapshot data.

## 9. Project structure

```
valorant-stats/
  app/            layout.tsx, page.tsx (splash), home/, track/, improve/, showcase/
  components/     RankHeader, SupportedTeamsChips, StatCard, charts/*
  lib/            henrik.ts, transform.ts, snapshot.ts, db/{schema,client,queries,data-source}.ts
  scripts/        sync.ts, backfill.ts, restore.ts
  drizzle/        migrations
  data/           snapshot.json (committed backup)
  prototype/      archived static HTML+Chart.js prototype (current viz/, build-data.sh, fetch.sh)
  tests/          unit (vitest) + smoke (playwright)
  .github/workflows/sync.yml
  drizzle.config.ts, next.config.js, package.json, tsconfig.json
  .env (gitignored), .env.example, README.md
```

## 10. Testing strategy

- **TDD** for pure logic. **Vitest** units:
  - `transform.ts` — raw match → row; mmr entry → rank row; detail normalization.
  - `queries` aggregations — WR/KD/ADR by map & agent, form, most-used gun (against a
    seeded fixture / test DB or in-memory rows).
  - `data-source.ts` — returns DB data normally; returns snapshot on simulated DB failure.
- **Playwright** smoke: app boots, Home renders from a snapshot fixture, all nav routes
  resolve (incl. stubs).

## 11. Security

- HenrikDev key + `DATABASE_URL` only in env (Vercel + GitHub Action secrets). Never in
  client bundles or committed files. `.env` gitignored; `.env.example` documents keys.
- Sync is idempotent and non-destructive (upsert only). `snapshot.json` is a recoverable
  backup. Public Showcase exposes only my own already-public match stats.

## 12. Deployment & automation

- **Vercel** project on the repo (matches existing setup). `DATABASE_URL` + Henrik key as
  Vercel env vars. Pushes to `main` auto-deploy.
- **GitHub Action** (`sync.yml`): scheduled (daily) + manual dispatch → runs `sync.ts`
  with secrets → commits updated `snapshot.json` → push triggers Vercel redeploy. Sync can
  also be run locally anytime.

## 13. Out of scope (future)

- **Improve** logic (ban/dodge signals, weak-spot trends, agent-pool gaps).
- **Showcase** heatmaps & flashy match visuals (data is banked via backfill).
- **VCT tab** — own VLR.gg-style team/player rankings; separate data source
  (vlrggapi or VLR scrape) + its own spec.
- "My Teams" widget graduation (live VCT results) once VCT data exists.

## 14. Assumptions

- Single account, hardcoded/configurable via env (no multi-user, no auth).
- Free tiers (Neon, Vercel, GitHub Actions) are sufficient at this scale.
- "Most-used gun" derives from backfilled `detail` weapon-kill counts (proxy for usage;
  true rounds-held data isn't available — documented as a known approximation).
