# Fight Map (Showcase Heatmap) — Design Spec

**Date:** 2026-05-31
**Status:** Approved design → ready for implementation plan
**Feature owner:** Kendall (ST1CCS#STONE)
**Goal:** Turn the `/showcase` stub into a flashy, interactive "Fight Map" that shows
**where on each map Kendall wins vs loses his duels**, answering "I win 60% of fights
here, 30% there" at a glance — the portfolio centerpiece.

---

## 1. Background / current state

- The app already persists competitive match detail in `matches.detail` (jsonb), produced
  by `normalizeDetail(detail, puuid)` in `lib/transform.ts`. **Today that shape is thin:**
  `{ weapons: {weapon,kills}[], killCoords: {x,y}[] }` — only Kendall's _kill_ locations,
  no deaths, no round, no side.
- 137 stored competitive matches exist in Neon, each with `meta.id` retained, so they can be
  **re-fetched and re-normalized** (HenrikDev `v4/match/{region}/{id}`, ~2.2s throttle, free).
- `app/showcase/page.tsx` is a stub ("coming soon").
- Match rows (`lib/db/schema.ts`) carry `season` (e.g. `e10a6`), `playedAt`, `map`, `agent`.

## 2. User flow

`Showcase` → **Fight Map** with three always-visible, live-adjustable filters:

1. **Map** — default: Kendall's most-played map. (Heatmaps cannot blend maps.)
2. **Side** — Attack / Defense / **Both** (default Both).
3. **Time** — default **Current season**; options: All time, each past season present in data,
   and **Last 10 / Last 20 matches** presets. (Season and Last-N are _alternatives_, never stacked.)

Changing any filter instantly re-aggregates the zone grid.

Default layer = **Win-rate Zones** rendered over the real minimap. **Click a zone** to drill in:
the zone expands/highlights and shows that zone's individual **kill (green) / death (red) dots**.
An optional **Heat** glow layer can be toggled. Fully responsive; tap == click on mobile.

## 3. Filters & scope semantics

- A "duel" is included if its match matches the selected **Time** scope, its location bins into
  the selected **Map**, and its `side` matches the **Side** filter (Both = no side filter).
- **Sample-size reality (documented, expected):** ~137 matches across ~12 seasons × 7+ maps × 2
  sides means narrow filters can yield few duels per zone. **All time is the richest view.** The
  min-sample muting (§6) keeps thin zones from rendering misleading colors. This is by design.

## 4. Data layer — the re-capture

Expand the normalized detail shape (no DB schema change; same `matches.detail` jsonb column):

```ts
export interface Duel {
  x: number; // raw Valorant game-world coordinate (victim/death location)
  y: number;
  won: boolean; // true = Kendall's kill (enemy death spot); false = Kendall's death
  side: "attack" | "defense";
  round: number;
}

export interface NormalizedDetail {
  weapons: { weapon: string; kills: number }[]; // unchanged
  duels: Duel[]; // replaces killCoords
}
```

- `won:true` records come from kills where `killer.puuid === puuid`, plotted at the **victim's**
  location. `won:false` records come from kills where `victim.puuid === puuid`, plotted at
  **Kendall's** (the victim's) location.
- `side` is derived from the round number + which side Kendall's team started on
  (first half vs second half vs overtime). **Verify against real match JSON during
  implementation** — confirm the exact HenrikDev v4 fields for team side / round before relying on it.
  If side can't be reliably derived for a match, those duels still count under "Both".
- **Migration of consumers:** `topWeapon` (Home "most-used gun") reads `detail.weapons`, which is
  unchanged → no breakage. Any reader of `killCoords` must move to `duels` (currently none in app).
- **Re-backfill:** update `scripts/backfill.ts` (or a one-off `scripts/recapture.ts`) to re-fetch
  all 137 match IDs and rewrite `detail` with the new shape; then `sync` regenerates `snapshot.json`.
  `sync.ts`'s "deep-detail any new match" path already calls `normalizeDetail`, so going forward new
  matches get the richer shape automatically.

## 5. Map calibration (highest-risk piece — prototype first)

Valorant kill coordinates are game-world (x,y), not minimap pixels. To place them:

- Pull per-map **calibration constants** and the **minimap image** from
  [valorant-api.com](https://valorant-api.com/v1/maps) (free, no key, public): each map provides
  `xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`, and `displayIcon` (square minimap).
- Transform (Valorant's standard formula — note the x/y swap), yielding normalized [0,1]:
  ```
  nx = location.y * xMultiplier + xScalarToAdd
  ny = location.x * yMultiplier + yScalarToAdd
  ```
- **Verify** by plotting one known match's duels and eyeballing that they land in sensible spots.
- Store the constants locally (small JSON keyed by map name) so the app needs no runtime call to
  valorant-api.com. A small script fetches/refreshes them.
- **Graceful degradation:** if a map's image overlay is slightly off, zone binning still works in
  normalized space, so the data view stays correct even if the picture isn't pixel-perfect.

## 6. Aggregation (pure, TDD)

Pure functions in `lib/fightmap.ts`:

- `binDuels(duels, gridN)` → assigns each normalized duel to a `gridN × gridN` cell
  (start **gridN = 6**, tunable constant).
- `zoneStats(duels, gridN)` → per cell `{ wins, total, winRate }`.
- **Min-sample threshold** `MIN_DUELS = 4` (tunable): zones with `total < MIN_DUELS` are flagged
  `muted: true` and rendered faded / "not enough data" instead of a confident color.

## 7. Color mapping (pure, TDD)

`winRateColor(rate: number): string` — continuous interpolation:
`0.0 → red (#b5483d)`, `0.5 → neutral gray (#7a7f8a)`, `1.0 → green (#2e8b57)`, linear between.
Zone labels always display the **fight-win %** (kills ÷ (kills+deaths)), never death %.

## 8. Components

- `app/showcase/page.tsx` (server) — loads matches + their `detail.duels` + map calibration,
  passes to client.
- `components/fightmap/FightMap.tsx` (client) — owns filter state (map/side/time), re-aggregates,
  renders.
- `MapPicker`, `SideToggle`, `TimeSelector` — filter controls.
- `ZoneGrid` — SVG zones over the minimap image; animated fade-in; hover/tap tooltips (win%, n).
- `ZoneDetail` — kill/death dots for the clicked zone.
- `Legend` — the red→gray→green gradient bar.
- Optional `HeatLayer` — blurred density glow toggle.

## 9. Look & feel (global directive)

Flashy, animated, mobile-friendly: zones fade/scale in on load and on filter change, smooth color
transitions, tap targets sized for touch, layout collapses cleanly to one column on phones. This is
the showpiece — it should feel polished.

## 10. Testing

- Unit (Vitest, TDD red-green): coordinate transform (known input → expected normalized),
  `binDuels`, `zoneStats` + min-sample muting, `winRateColor` endpoints and midpoint, `side`
  derivation from round/team.
- Smoke (Playwright): `/showcase` renders the Fight Map; switching a filter updates the grid.

## 11. Scope

**In v1:** sections 2–10 — map/side/time filters, duel re-capture, calibration, zone win-rate
heatmap with gradient, click-to-drill dots, optional heat toggle, animated/responsive UI.

**Out (parked as future toggles):** day-range slider; "entries / first-bloods only" filter;
round-outcome attribution; weapon filter; time-in-round; map-callout polygons (v1 uses a grid).

## 12. Risks / assumptions

- **Calibration accuracy** (§5) is the one real unknown — prototype and verify early.
- **`side` derivation** (§4) depends on confirming HenrikDev v4 fields — verify against real JSON;
  fall back to counting under "Both" if unreliable.
- **Sample size** (§3) — narrow filters give sparse zones; muting + "All time" mitigate. Pool grows
  via the hourly sync.
- No DB schema change required; the re-capture rewrites `detail` content only.
