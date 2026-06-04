# Vantage Home v2 — full-screen redesign + live cards

**Date:** 2026-06-04
**Status:** Approved (design)
**Author:** Kenny (with Claude)
**Builds on:** the v1 home redesign (`2026-06-04-vantage-home-redesign-design.md`) and the merged FragsMap data-fidelity fix.

## Context

The v1 home landing shipped (product hero, agent splash, 4 stat cards). Visitors are
imminent. This pass makes the page feel full and alive: edge-to-edge layout, a larger
hero, a reserved Riot ID entry point, and four richer, equal-height cards. Data is
**Competitive-only** (sync uses `storedCompetitive`), so copy should say so.

All data already exists in the repo:

- `byAgent(ms)` → per-agent `{agent, games, winRate}` (sorted by games).
- `byMap(ms)` → per-map `{map, games, winRate}`.
- `currentForm(ms, 20)` → `{games, wins, avgKd, avgHs, avgAdr}`.
- `MatchSummary` carries `shotsHead/shotsBody/shotsLeg`, `kills`, `deaths`, `playedAt`.
- `getCalibration(map).image` → map art URL on `media.valorant-api.com`.
- `agentPortrait(name)` → full-portrait URL (all current top agents, incl. Veto, resolve).

Note: "Veto" is a real (recently added) agent with a portrait — not a data bug.

## Design

### 1. Full-bleed layout

- Home `<main>` drops `maxWidth: 1180` / centering. Content runs edge-to-edge with a
  consistent horizontal padding of **32px** (hero, card strip, nav).
- `components/Nav.tsx` padding bumped to `16px 32px` to match.
- Scope: home page + the shared nav. FragsMap and other pages are out of scope.

### 2. Bigger hero (`components/home/Hero.tsx`)

- Hero is a full-bleed section, `min-height: 62vh`, flex-centered.
- Left content block ~**56%** width: eyebrow, `VANTAGE` wordmark
  (`clamp(64px, 9vw, 120px)`), larger pitch (`clamp(18px, 1.6vw, 22px)`), the Riot ID
  spot (§3), the FragsMap CTA, and the three quick stats (Win % / K/D / Matches) with
  the existing `CountUp`.
- The agent splash (§4) sits behind, bleeding off the **right edge**.

### 3. Riot ID entry spot (reserved, non-functional)

- In the hero, between pitch and CTA: a label "Your stats · Riot ID coming soon" and a
  **disabled / grayed-out** input whose placeholder text is **"Coming soon"**, with a
  dashed accent border + a non-functional "Track →" button. The grayed state signals it's
  intentionally not ready yet.
- This is a reserved placement only; no submission, no routing, no state. Wiring it to
  actually look up an arbitrary Riot ID is a future task, explicitly out of scope here.

### 4. Synced agent cycle (hero splash + Top-3 card)

The hero splash and the Top-3 Agents card cycle through the same top-3 agents in lockstep.

- **Provider:** `components/home/AgentCycleProvider.tsx` (new, client). Receives the
  top-3 agent view-models from the server page and exposes the current index via React
  context. Advances the index every **5000ms**.
- **Reduced motion:** if `prefers-reduced-motion: reduce`, the provider does NOT cycle —
  index stays at 0 (the #1 agent), no fades.
- **Consumers:**
  - `AgentSplash.tsx` (now client) reads the index → shows `agents[i].portrait` with a
    **slow** cross-fade (`opacity` transition ~**1.4s**). If a given agent has no
    portrait, it renders nothing for that beat (graceful; current data always resolves).
  - `AgentsCard.tsx` (new, client) reads the index → shows the agent name, win rate, and
    game count with a **quicker** fade (~**0.45s**), a faded portrait thumbnail, and a
    3-dot position indicator. Hero and card share the index, so they stay in sync while
    using different fade durations.
- **View-model:** the server page builds
  `top3 = byAgent(ms).slice(0,3).map(a => ({ name: a.agent, winRate: a.winRate, games: a.games, portrait: agentPortrait(a.agent) }))`
  and passes it to the provider, which wraps the hero + card region.

### 5. Top 3 Agents card (`AgentsCard.tsx`)

- Replaces the old "Top 3 Agents / N games on #1" StatCard.
- Shows: agent **name** (large), **win rate** + game count (e.g., "62% win rate · 41
  games"), 3-dot indicator, faded duotone thumbnail. Cycles per §4.
- The old "games on #1" subline is removed entirely.

### 6. Best / Worst Map card (`BestWorstMap.tsx`)

- Diagonal-split card via `clip-path`. Best map (highest win rate) on the **left** in
  green; worst on the **right** in red. Each half: map art (`getCalibration(map).image`)
  as a darkened background, the "Best"/"Worst" tag, the map name, and the win %.
- Data: `const sorted = byMap(ms).sort((a,b)=>b.winRate-a.winRate); best = sorted[0]; worst = sorted.at(-1)`.
- Graceful fallback: missing map/art → name shows, no broken image.

### 7. Most-used Gun card (`GunCard.tsx`)

- Shows the gun name (existing `topWeapon`) plus a **hit-location distribution**: a small
  body silhouette (head highlighted) beside Head / Body / Legs percentage bars.
- Data: new aggregation `hitDistribution(ms)` summing `shotsHead/Body/Leg` across all
  matches → `{ head, body, leg }` percentages. This is the player's **overall**
  competitive hit distribution shown on the gun card as accuracy context (not gun-specific
  — we only store per-match shot totals). Raw kills are intentionally omitted (can be
  added later if wanted). A small muted caption (placeholder wording **"all guns"**) sits
  near the distribution to signal it spans all weapons, not just the most-used gun; exact
  wording is to be refined later.
- Fallback: no shot data → bars render at 0 / "—".

### 8. Current Form card (`CurrentFormCard.tsx`)

- Shows the W-L record (e.g., "11-9"), a bare-bones **sparkline** of the last-20 trend,
  and a sub line "KD x.xx · HS y% · ADR z". The "· last 20" text is removed (W+L = 20
  makes it obvious).
- Sparkline: `components/home/Sparkline.tsx` (new) — an SVG polyline from a `number[]`.
  Line is green if trending up (last ≥ first), red if down.
- Data: new aggregation `recentKdSeries(ms, 20)` → per-game K/D for the last 20 matches
  in chronological order. `currentForm(ms, 20)` still supplies record + KD/HS/ADR.

### 9. Equal-height cards

- Card strip is a 4-column grid with `align-items: stretch`; each card is a flex column
  with a shared `min-height`, so all four match the tallest.

### 10. Competitive label

- Card-strip label changes from "Built on real ranked data" to
  **"Built on real competitive data."**

### 11. Sticky footer (`app/layout.tsx`)

- The existing portfolio footer ("← Built by Kendall Adkins") becomes a true sticky
  footer: `<body>` becomes a `min-height: 100vh` flex column, `{children}` is `flex: 1`,
  and the footer sits at the end. On short pages it pins to the viewport bottom; on tall
  pages it only appears after scrolling to the end. It is NOT `position: fixed` (no
  floating).

### 12. Nav reorder (`components/Nav.tsx`)

- Tab order becomes **Home · FragsMap**, then **Track** and **Improve** as disabled
  "Soon" items (unchanged styling from v1).

## New aggregations (`lib/aggregations.ts`)

```
hitDistribution(rows): { head: number; body: number; leg: number }  // percentages, sum≈100
recentKdSeries(rows, n): number[]                                    // per-game K/D, oldest→newest, last n
```

Both are pure functions, unit-tested (mirroring existing aggregation tests).

## Components touched / created

| File                                     | Change                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/home/page.tsx`                      | full-bleed; build top-3 VM, best/worst, hit dist, kd series; wrap hero+card region in `AgentCycleProvider`; competitive label; swap StatCards for new cards |
| `components/Nav.tsx`                     | reorder tabs; 32px padding                                                                                                                                  |
| `components/home/Hero.tsx`               | bigger; Riot ID spot; left block ~56%                                                                                                                       |
| `components/home/AgentCycleProvider.tsx` | **new** client — 5s tick, index context, reduced-motion                                                                                                     |
| `components/home/AgentSplash.tsx`        | now client; consumes index; slow 1.4s cross-fade                                                                                                            |
| `components/home/AgentsCard.tsx`         | **new** client — name + win% + dots + thumb; 0.45s fade                                                                                                     |
| `components/home/BestWorstMap.tsx`       | **new** — diagonal-split map card                                                                                                                           |
| `components/home/GunCard.tsx`            | **new** — gun name + hit-distribution silhouette/bars                                                                                                       |
| `components/home/CurrentFormCard.tsx`    | **new** — record + sparkline + sub                                                                                                                          |
| `components/home/Sparkline.tsx`          | **new** — SVG polyline from number[]                                                                                                                        |
| `components/home/home.module.css`        | full-bleed/hero/cards/splash/diagonal/silhouette styles                                                                                                     |
| `lib/aggregations.ts`                    | add `hitDistribution`, `recentKdSeries` (+ tests)                                                                                                           |
| `app/layout.tsx`                         | sticky-footer flex column                                                                                                                                   |

`StatCard.tsx` is no longer used by the home page after this pass (the four cards become
dedicated components). Leave the file in place unless nothing else references it.

## Out of scope

- Making the Riot ID input functional (lookup/routing/state).
- FragsMap, Track, Improve pages.
- Per-gun (rather than overall) hit distribution.
- Pushing local `main` history reconciliation (handled at finish time).

## Success criteria

- Home is edge-to-edge; hero left block ≥ half width with a larger wordmark.
- Hero splash and Top-3 card cycle the same agents in sync at 5s; hero fades slowly, card
  quicker; no motion under `prefers-reduced-motion`.
- Top-3 card shows name + win% (no "games on #1"); agents resolve incl. Veto.
- Best/Worst is a diagonal card with real map art; Gun card shows head/body/leg; Current
  Form shows W-L + sparkline (no "last 20").
- All four cards equal height; label reads "competitive"; footer pinned to the very bottom.
- No console errors; graceful with missing data; existing tests + new aggregation tests pass.
