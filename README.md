# valorant-stats

Pulls my Valorant stats from the **HenrikDev unofficial Valorant API** and renders a
local dashboard. Exploration repo — used to see what data is available before deciding
what to build.

Riot's official Valorant API is gated (production keys are rarely granted to individuals),
so this uses HenrikDev, which proxies the same data with a free key.

## Setup

1. Get a free **Basic** API key (instant approval): join `discord.gg/HenrikDev`, then
   create a key at https://api.henrikdev.xyz/dashboard/ (30 req/min).
2. `cp .env.example .env` and paste your key into `VAL_API_KEY`. `.env` is gitignored.

## Usage

```bash
./scripts/fetch.sh                 # pull fresh JSON into data/raw/ (uses .env)
./scripts/build-data.sh            # regenerate viz/data.js from data/raw/
open viz/index.html                # view the dashboard (double-click also works)
```

Fetch a different account: `./scripts/fetch.sh NAME TAG REGION PLATFORM` then
`./scripts/build-data.sh NAME`.

## Layout

```
data/raw/        raw API responses (account, mmr, matches, mmr_history, lifetime)
scripts/fetch.sh       re-pull raw data from the API
scripts/build-data.sh  curate data/raw/*.json -> viz/data.js
viz/index.html         dashboard (Chart.js via CDN; opens over file://)
viz/data.js            generated; window.VAL_DATA consumed by the dashboard
```

> The dashboard loads Chart.js from a CDN, so the graphs need an internet connection.
> Everything else works offline.

## What the API exposes

| Endpoint              | Data                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `v2/account`          | puuid, level, region, card/title, platforms                                                                                                      |
| `v3/mmr`              | current tier + RR + elo, peak, per-act seasonal win/game/end-tier history                                                                        |
| `v2/mmr-history`      | per-rated-game RR delta, elo, map, date                                                                                                          |
| `v4/matches`          | full match detail — per-player K/D/A, shots, damage, economy, ability casts; per-round stats + plant/defuse; full kill feed with map coordinates |
| `v1/lifetime/matches` | paginated summary list (map, mode, agent, KDA)                                                                                                   |

The granular per-round + coordinate-tagged kill feed in `v4/matches` is the richest
source (heatmaps, clutch detection, ADR/ACS/KAST, eco-round win rates, agent/map splits).

## Project ideas

See the project note in Obsidian: `WeDev/Valorant Stats`.
