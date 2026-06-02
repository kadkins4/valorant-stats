# FragsMap Regions-View Polish — Design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)
**Goal:** Make the FragsMap **Regions** view feel finished — add hover feedback, a richer detail panel, a clear selected-zone marker, and a legend that explains the muted (gray) zones. Scoped to the Regions view; the Grid view is untouched.

---

## 1. Experience

The Regions view renders win-rate–colored zones over a map minimap. Today it has no hover feedback, a minimal click-to-open detail (header line + duel dots), and a bare lose↔win legend that never explains why some zones are gray. This pass adds four polish items.

### 1.1 Hover — spotlight + lift (traced/polygon maps)

- Hovering a zone keeps it at full opacity and gives it a **slight lift**; every **other** zone dims back (lower opacity). Moving off resets all zones.
- A **cursor-following tooltip** shows the zone's **name · win% · W/L · sample** (e.g. `A Site` / `72% win` / `13W / 5L · 18 duels`). Muted zones append `· low sample`.
- Chosen during brainstorming over "brighten + outline" and "accent ring" — spotlight focuses attention on the hovered zone; the lift adds tactility.
- **Reduced motion:** keep the opacity-based spotlight (no motion), drop the lift transition under `prefers-reduced-motion: reduce`.
- **Scope boundary:** hover/spotlight is a **polygon-mode** feature, because it needs real per-zone shapes to highlight. Raster mode (untraced maps, drawn as many small cells) keeps today's behavior — no hover. As maps get traced, they gain the hover automatically.

### 1.2 Enriched detail panel (both modes)

Replaces today's `RegionDetail` header line. When a zone is selected, the side panel shows, top to bottom:

- The zone **name**.
- A large **win%** number, colored by outcome (green-ish high, red-ish low).
- A **W/L split bar** (green won / red lost) with `N won · N lost · N duels`.
- An **Attack vs Defense** breakdown: two small stat cells, each `win% · W/T`. Only rendered for sides that have duels in the current filter (if the SIDE filter is set to a single side, the other cell is omitted).
- The existing **duel-dot mini-map** (green win / red loss) — unchanged.

Placement stays a **side panel** beside the map (the existing responsive grid wraps it below on mobile). Chosen over a modal overlay to keep the scan-zone-to-zone flow with the map always visible.

### 1.3 Selected-zone emphasis (both modes)

The currently selected zone gets an **accent ring** (`--accent` = `#ff4655`) drawn on the map, so it's visually tied to whatever the side panel is describing.

- Polygon mode: the selected polygon gets an accent stroke (thicker than the default `#11151d` hairline).
- Raster mode: there is no single selected shape, but the nearest-callout selection still resolves a region; draw an accent ring/marker at that region's centroid so the selection is visible.

### 1.4 Legend (shared)

Replace the bare gradient with the "proposed" version:

- The same lose↔win gradient bar.
- End labels in plain language: **Mostly lose** / **even** / **Mostly win**, each with the `%` framing underneath (`low win%` / `50%` / `high win%`).
- A new **muted swatch** row below a divider: a gray swatch + "under 4 duels (too few to color)" — the one thing missing today. (4 = `MIN_DUELS`; zones with fewer duels are drawn gray, color suppressed.)

---

## 2. Architecture

### 2.1 Data: thread `side` through `Placed`

`lib/fightmap.ts` — `Placed` currently is `{ nx, ny, won, col, row }`. The per-duel `Duel` carries `side: "attack" | "defense" | "both"`. Extend `Placed` with `side: "attack" | "defense"` (carry `d.side` through `placeDuels`). This is what lets the detail panel compute the Attack/Defense split. `"both"` is a _filter_ value, never an individual duel's side, so per-duel `side` is always `"attack"` or `"defense"` in practice; if a stored duel ever lacks a concrete side, treat it as excluded from the split (it still counts in totals).

A small pure helper computes the split from a `Placed[]`:

```ts
// lib/fightmap.ts
export interface SideSplit {
  attack: { wins: number; total: number } | null;
  defense: { wins: number; total: number } | null;
}
export function sideSplit(points: Placed[]): SideSplit {
  /* tally by side; null when a side has 0 */
}
```

Returning `null` for a side with no duels makes "omit the empty cell" trivial in the component and gives the unit test a crisp contract.

### 2.2 Components

- **`components/fightmap/RegionView.tsx`** (modify) — the largest change. Add:
  - Local `hovered: number | null` state.
  - In polygon mode: per-polygon `onMouseMove` / `onMouseLeave` set `hovered` and the tooltip position; opacity is computed from `(hovered, selected)` — hovered full, others dimmed; selected polygon gets the accent stroke.
  - A cursor-following tooltip rendered as an absolutely-positioned HTML overlay (the SVG is wrapped in a `position: relative` container). Tooltip content from the same `PolyRegionStat`/`RegionStat` the polygon already has.
  - `selectedRegion` is passed in as a new prop (currently `RegionView` only emits `onSelectRegion`); use it to draw the accent ring in both modes.
  - Raster mode: unchanged except for drawing the selected-region accent marker at its centroid.
  - Pseudo-states/transitions (the lift transform + its `prefers-reduced-motion` opt-out) live in a co-located **`RegionView.module.css`** (new), matching the precedent set by `MapPicker.module.css` — inline styles can't express `:hover` transitions or media queries cleanly. The opacity/stroke _values_ stay computed in JS (they depend on hover/selected state); the CSS module holds the transition + reduced-motion rule and the tooltip's visual styling.

- **`components/fightmap/RegionDetail.tsx`** (modify) — render the enriched content (win% number, W/L bar, ATK/DEF cells via `sideSplit`, then the existing dot map). Inputs gain nothing new beyond what it can derive from `points` (it already receives `points: Placed[]` and `regionName`); the split comes from `sideSplit(points)`.

- **`components/fightmap/Legend.tsx`** (modify) — new labels + muted swatch row. Pure presentational, no props.

- **`components/fightmap/FightMap.tsx`** (modify) — pass `selectedRegion` into `RegionView` (it already holds that state). No other change.

### 2.3 Data flow (unchanged shape)

`FightMap` already computes `points`, `regions`/`polyStats`, and holds `selectedRegion`. The only new wire is `selectedRegion` → `RegionView`. `RegionDetail` already receives the selected region's `points`; it now also derives the side split from them.

---

## 3. Error handling / edge cases

- **Untraced map (raster mode):** no hover/spotlight; selected-zone marker still drawn at the region centroid; enriched panel + legend still apply.
- **Single-side filter (SIDE = Attack or Defense):** the opposite side's stat cell is omitted (`sideSplit` returns `null` for it). The win% and W/L bar reflect the filtered set, as today.
- **Muted / low-sample zone:** still rendered gray and non-labeled on the map; its tooltip shows the real numbers plus `· low sample`. The legend swatch explains the gray.
- **Selecting then changing a filter:** existing `onFilter`/`onView` already reset `selectedRegion`; unchanged.
- **Touch devices:** there is no hover; tap still selects (drives the panel + accent ring). The tooltip is a hover affordance only — its absence on touch loses nothing because tapping opens the fuller panel.

---

## 4. Accessibility

- Hover visuals are decorative duplicates of information already available by selecting a zone (which works by tap/click/keyboard). No information is hover-only.
- The accent ring gives a non-color-only selection cue (a distinct ring, not just a hue change).
- Legend text changes are plain-language; the muted swatch pairs the gray color with a text explanation (not color-only).
- Reduced motion honored for the lift.

---

## 5. Testing

- **Unit (vitest), `lib/fightmap.ts`:**
  - `placeDuels` now sets `side` on each `Placed` (carried from the duel).
  - `sideSplit`: tallies attack/defense wins+totals; returns `null` for a side with no duels; counts only concrete-side duels.
- **Smoke (Playwright, `/fragsmap`, Regions view on a traced map):**
  - Selecting a zone shows the enriched panel (assert the win% / "duels" text and the duel-dot `circle`s render) and marks the selected zone (assert the accent-stroked polygon / selection state).
  - Hovering a zone shows the tooltip (assert the tooltip node with the zone name becomes visible). If hover proves flaky in headless, fall back to asserting the selection/ring path, which is the load-bearing interaction.
- **Manual:** load `/fragsmap` → Regions on Ascent; hover zones (spotlight + lift + tooltip), click a zone (accent ring + enriched panel with ATK/DEF), confirm legend reads clearly and the gray swatch is present; switch to an untraced map and confirm raster mode degrades gracefully.

---

## 6. Scope guard (YAGNI)

**In:** hover spotlight+lift+tooltip (polygon mode), `Placed.side` + `sideSplit`, enriched side panel (win%, W/L bar, ATK/DEF, existing dots), selected-zone accent ring (both modes), the improved legend, the two test layers.

**Out (not now):** modal overlay popup; hover for raster mode; round-timing or weapon/agent breakdowns (that's the separate "Bucket C" data-recapture work); animating the spotlight beyond the lift; changing the Grid view; "All maps" aggregation; self-hosting images / `next/Image`.
