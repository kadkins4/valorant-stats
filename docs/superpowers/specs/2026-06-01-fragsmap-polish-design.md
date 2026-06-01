# FragsMap Iteration 1 — Polish + Seasons Filter + Callout-Region Prototype

**Date:** 2026-06-01
**Status:** Approved (scope agreed in conversation)

## Goal

Rename the duel-heatmap feature to **FragsMap** and ship a first polish/iteration pass: tidy the filter UI, rework the season filter into a cumulative multi-select, add side icons, surface zone sample sizes, and prototype a **callout-region** view of the heatmap so Kendall can compare it against the rigid grid.

No data recapture in this iteration — everything here works off the existing per-duel records (`{x,y,won,side,round}`). The richer per-duel fields (positions, weapon, agent, first-blood, facing) are a **later batch** (Bucket C) and are explicitly out of scope here.

## Naming & route

- Feature name: **FragsMap** (one word, capital F + M).
- Route: **`/fragsmap`**. The old `/showcase` route is **removed entirely** (no redirect). Kendall will repoint the portfolio link to `/fragsmap` himself.
- Nav tab label + page `<h1>`: "FragsMap".

## In scope

1. **Route/brand rename** — `app/showcase` → `app/fragsmap`; Nav tab; h1; blurb copy.
2. **Pill label spacing** — clear separation between each section label (`MAP` / `SIDE` / `SEASONS`) and its pill row.
3. **`TIME` → `SEASONS`** section label.
4. **Season formatting** — display `e4a3` as `E4 A3` (uppercase, space between episode and act). Underlying season value is unchanged; only the display label is formatted.
5. **Seasons multi-select** — seasons become a **cumulative multi-select dropdown** (pick several → union of their matches). Separate, mutually-exclusive toggles for **All time**, **Last 10**, **Last 20**. Default = current season selected.
6. **Side icons** — inline SVG sword (Attack) + shield (Defense); Both keeps a neutral/combined treatment. SVG-first per project perf preference.
7. **Zone sample size** — show the duel count (`N`) in small text beneath the win-rate % on each zone.
8. **Drop the "Zone 4,4" heading** in the drill-in; replace with a coordinate-free summary (`N duels · W won`).
9. **Callout-region prototype** — fetch callouts from valorant-api, assign each duel to its nearest callout, aggregate win-rate per region, and render a **Regions** view that tiles the full minimap (nearest-callout raster = Voronoi-style), with region labels. A **Grid | Regions** view toggle lets Kendall compare. **This is a prototype; pause for his eyes before finalizing.**

## Out of scope (deferred)

- Recapture-dependent depth: enemy/own positions, connecting lines, facing direction, weapon, agent, round-time, first-blood, snapshot-interpolation animation. (Bucket C.)
- Map icons via `listViewIcon` — optional stretch only if cheap; otherwise next iteration.
- Density/glow heat layer — cut per decision.
- Home redesign, Improve tab, shareable images — later buckets.

## Data: callouts

`valorant-api.com/v1/maps[].callouts[]` provides `{regionName, superRegionName, location:{x,y}}` in game coordinates — the same space as kill locations, so the existing `transformCoord` maps them to normalized `[0,1]`. Extend the existing fetch script to also emit a committed `lib/maps/callouts.json` (no auth, static, like `calibration.json`).

## Region model

- `getCallouts(map)` → `{ regionName, superRegionName, x, y }[]` (case-insensitive lookup, mirrors `getCalibration`).
- `assignRegions(duels, callouts, calib)` → per-region `{ regionName, superRegionName, wins, total, winRate, muted }`, where each duel is bucketed to the **nearest callout** by Euclidean distance in normalized space; `muted` when `total < MIN_DUELS`.
- Rendering: a fixed raster (e.g. 40×40) over the `0..100` viewBox; each cell filled with the win-rate color of the region whose callout is nearest that cell's center → produces Voronoi-style regions covering the whole map. Region labels drawn at each callout's transformed position (label `superRegionName` + `regionName`, e.g. "A Tree"). No new dependencies.

## TimeScope model change

```ts
export type TimeScope =
  | { kind: "seasons"; seasons: string[] } // cumulative; [] = empty result
  | { kind: "all" }
  | { kind: "lastN"; n: number };
```

`collectDuels` filters `o.time.seasons.includes(m.season)` for the `seasons` kind. Default state = `{ kind: "seasons", seasons: [currentSeason] }`.

## Testing

- Unit (vitest): `formatSeason`, `collectDuels` (multi-season union / all / lastN), `assignRegions` (nearest-callout bucketing + win-rate aggregation), `getCallouts` lookup.
- Smoke (Playwright): `/fragsmap` 200 + renders controls; `/showcase` is gone (404). Existing smoke updated to new path.
- Visual gate: screenshot Grid and Regions views before merge; Kendall reviews the Regions prototype.

## Risks

- **"Fill 100%" perception** — the Regions raster tiles the whole map, directly addressing it. The 6×6 Grid stays sparse by nature (reflects where fights actually happen); we leave Grid as-is and let Kendall pick the primary view after seeing Regions.
- **Callout label crowding** — 22 callouts/map can clutter; mitigate by labeling `superRegion` only, or muting labels for low-sample regions. Tunable during the prototype review.
