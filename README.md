# Vantage

A personal, competitive-only Valorant stats web app for `ST1CCS#STONE`. It tracks
rank, form, and per-map / per-agent performance over time, backed by a database
that **accumulates match history beyond what the API exposes** (the HenrikDev API
only retains ~136 competitive games; this app keeps everything it has seen).

Built to be (a) genuinely useful, (b) a portfolio piece, and (c) a low-stakes
place to learn databases.

## Stack

- **Next.js 16** (App Router, React Server Components) + **TypeScript**
- **Neon** serverless Postgres + **Drizzle ORM** (schema-as-code + migrations)
- **Chart.js** via `react-chartjs-2`
- **Vitest** (unit) + **Playwright** (smoke)
- **pnpm**

## Architecture: DB primary, snapshot fallback

```
HenrikDev API ──sync──▶ Neon Postgres (PRIMARY) ──export──▶ data/snapshot.json (BACKUP)
                                  │                                   │
        reads try Neon first ─────┴──── fall back to snapshot if DB unavailable
```

- A server-side **sync** job fetches competitive matches + rank history and
  **upserts** them into Neon (idempotent — never destructive), then exports a
  committed `data/snapshot.json`.
- The app reads through a single accessor (`withFallback`) that tries Neon and
  **falls back to `snapshot.json`** when the DB is unreachable _or unconfigured_.
  The site renders either way — even with no `DATABASE_URL` set.
- `snapshot.json` doubles as a recoverable backup: `pnpm restore` rebuilds the DB
  from it.

The HenrikDev key and `DATABASE_URL` live in env vars and never reach the client.

## Screens

- `/` **Splash** — account identity; auto-advances to `/home`.
- `/home` — rank header + supported-team chips (Team Liquid, 100T) + widgets:
  top-3 agents, best/worst map, most-used gun, current form.
- `/track` — Elo timeline, win-rate by map, K/D trend, per-agent table.
- `/improve` — stub.
- `/fragsmap` — **FragsMap**: duel-win-rate heatmap over the real minimap (the
  portfolio-linkable page). Filters by map/side/season; `Grid | Regions` views.

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in values
```

`.env` keys:

| Key            | What                                                             |
| -------------- | ---------------------------------------------------------------- |
| `VAL_API_KEY`  | HenrikDev Basic key (free) — https://api.henrikdev.xyz/dashboard |
| `DATABASE_URL` | Neon connection string — https://neon.tech                       |
| `RIOT_NAME`    | `ST1CCS`                                                         |
| `RIOT_TAG`     | `STONE`                                                          |
| `REGION`       | `na`                                                             |
| `PLATFORM`     | `pc`                                                             |

## Database + first data load

```bash
pnpm db:generate   # generate SQL migration from lib/db/schema.ts (already committed)
pnpm db:migrate    # apply to Neon (needs DATABASE_URL)
pnpm sync          # fetch matches + rank history → Neon, write snapshot.json
pnpm backfill      # one-time: deep per-match detail (weapons, kill coords) ~5 min
pnpm sync          # re-export snapshot with the new detail
```

No database yet? The repo ships a `data/snapshot.json` seeded from archived data
(`pnpm exec tsx scripts/bootstrap-snapshot.ts`), so the app runs immediately via
the snapshot fallback. Connect Neon and run `pnpm sync` to take over with live,
growing data.

## Develop & test

```bash
pnpm dev      # http://localhost:3000
pnpm test     # vitest unit tests (transforms, aggregations, fallback)
pnpm smoke    # Playwright: boot, splash→home, all routes resolve
pnpm build    # production build
```

## Recovery

```bash
pnpm restore  # rebuild Neon tables from data/snapshot.json
```

Neon branching is handy for throwaway experiments without risking primary data.

## Deploy

- **Vercel**: import the repo; set `VAL_API_KEY` and `DATABASE_URL` as project env
  vars. Pushes to `main` auto-deploy.
- **Scheduled sync** (`.github/workflows/sync.yml`): daily + manual. Requires repo
  **secrets** `VAL_API_KEY` and `DATABASE_URL`. It runs `pnpm sync` and commits the
  refreshed `snapshot.json`, which triggers a redeploy.

## Layout

```
app/         splash (/), home, track, improve, fragsmap
components/  Nav, RankHeader, SupportedTeamsChips, StatCard, charts/*
lib/         henrik (API client), transform, aggregations, snapshot, config,
             db/{schema,client,queries,data-source}
scripts/     sync, backfill, restore, bootstrap-snapshot
drizzle/     generated migrations
data/        snapshot.json (committed backup / fallback)
prototype/   archived original static HTML+Chart.js dashboard
tests/       vitest units + playwright smoke
```

The static prototype this evolved from is preserved under `prototype/`.
