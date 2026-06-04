# FragsMap Accessible Data Layer (Spec 3) — Design

**Date:** 2026-06-04
**Status:** Approved (design); spec for review
**Scope:** Give FragsMap a complete keyboard / screen-reader path via a single context-aware breakdown table that mirrors the map, two-way selection sync between the table and the dots, and `aria-hidden` on the decorative SVG. Built on the spatial-zoom redesign (`2026-06-04-fragsmap-spatial-zoom-design.md`). Supersedes the Phase-2 portion of the earlier accessibility spec (`2026-06-03-fragsmap-accessibility-design.md`).

## Problem

The spatial-zoom redesign made the map a zoom-and-drill interaction, but every interactive target is pointer-only SVG with no role, name, or `tabindex`:

- **Overview region selection** is pointer-only: duel dots and cluster badges (`FragMap`/`DuelMap`) in the Dots layer, region polygons (`RegionView`) in the Heatmap layer.
- **Zoomed duel selection** is pointer-only: the region's dots in `DuelMap`.
- The decorative map `<svg>` is not `aria-hidden`, so a screen reader gets hundreds of nameless shapes and no coherent model.

A keyboard-only user cannot zoom into a region or open a duel; a screen-reader user gets essentially nothing from the map.

**Already shipped (Phase 1 — out of scope here):** the duel dialog already has `role="dialog"` / `aria-modal` / `aria-labelledby` + focus-in-on-open + focus-return-on-close + a Tab trap; death dots already render as `✕` shape-coding (color-independent); the Layer toggle, `TimeSelector`, and `MapPicker` already expose `aria-pressed`; a global `:focus-visible` ring exists. The one remaining Phase-1 gap, `SideToggle` lacking `aria-pressed`, is folded into this spec (§5) because leaving a filter inaccessible while building SR tables would be inconsistent.

## Solution Overview

One **context-aware breakdown table** rendered in `FightMap`, below the map (next to `<Legend/>`), present in all three states (Dots-overview, Heatmap-overview, Zoomed). Its content follows `zoomedRegion`:

- **Overview** (`zoomedRegion == null`) → **region rows**; activating a row zooms into that region.
- **Zoomed** (`zoomedRegion != null`) → **duel rows** for that region; activating a row opens that duel's dialog.

The table is the keyboard/SR equivalent of the map. The map stays the pointer/visual layer (behavior unchanged) and is marked `aria-hidden` so the table carries the semantics.

## Architecture

### State (single sources of truth, in `FightMap`)

- `zoomedRegion: number | null` — already exists; selects the table's mode and the zoom target.
- `focusedDuel: number | null` — **new**; the selected duel within the zoomed region. Shared by the table rows and `DuelMap`'s dots, threaded `FightMap → FragMap → DuelMap`. Cleared whenever `zoomedRegion` changes or a filter changes.

### Index alignment

The zoomed region's duel list is derived **once** in `FightMap` as `zoomedDuels = points.filter((_, i) => assignment[i] === zoomedRegion)` (order preserved) and passed down to `FragMap` as `shownPoints`, which forwards it to `DuelMap`. The same array feeds `buildDuelRows`. So a `focusedDuel` index `i` refers to the same duel in the table row and the rendered dot. `FragMap` no longer recomputes `shownPoints` for the zoomed case (it still uses the full `points` + `assignment` for the overview dot→region zoom mapping).

### Unit 1 — Pure row builders (`lib/fightmap/breakdown.ts`, new)

```ts
import type { Placed } from "@/lib/fightmap";
import type { RegionModel } from "@/lib/fightmap/regionModel";

export type Result = "Mostly win" | "Even" | "Mostly lose" | "Low sample";

export interface RegionRow {
  index: number; // index into the regions array (== zoom target / RegionView index)
  name: string;
  duels: number;
  winRate: number; // 0..1
  muted: boolean; // low-sample
  result: Result;
  label: string; // accessible button name, e.g. "A Site, 24 duels, 58% win rate, mostly win"
}

export interface DuelRow {
  index: number; // index into the zoomed-region duel array (aligns with the rendered dot)
  won: boolean;
  weapon: string | null;
  round: number | null;
  enemyAgent: string | null;
  label: string; // accessible button name, e.g. "Kill, Vandal, round 7, vs Jett"
}

// Even band centered on the legend's "Even = 50%"; muted (below MIN_DUELS) => "Low sample".
export function resultBand(winRate: number, muted: boolean): Result;

// Regions with >= 1 duel, in spatial reading order (centroid top->bottom, then left->right).
// Duel count derived by counting assignment[i] === region index.
export function buildRegionRows(
  regions: RegionModel[],
  assignment: number[],
): RegionRow[];

// The zoomed region's duels, stable order: round ascending (nulls last), then kills before deaths.
export function buildDuelRows(duels: Placed[]): DuelRow[];
```

All pure, no React, unit-tested. `resultBand`: `muted → "Low sample"`; else `winRate < 0.45 → "Mostly lose"`, `winRate > 0.55 → "Mostly win"`, otherwise `"Even"`. The label strings are built here (not in the component) so they are testable and the wording stays in one place.

**Spatial order detail:** sort region rows by centroid using a coarse vertical bucket then horizontal position, so a roughly-horizontal band reads left→right. Concretely: sort by `(round(cy * 5), cx)` ascending — a 5-band vertical bucketing then left→right within a band. (Bucket count is an implementation constant; the test asserts a known small fixture's order, not the constant.)

**Win % display:** `Math.round(winRate * 100)`. Muted regions still show the percentage but the row reads "low sample" in the Result column and label.

### Unit 2 — `components/fightmap/BreakdownTable.tsx` (new)

Thin presentational component. Props:

```ts
{
  expanded: boolean;
  onToggle: () => void;
  // Exactly one mode is active:
  regionRows?: RegionRow[];          // overview mode
  duelRows?: DuelRow[];              // zoomed mode
  regionName?: string;               // zoomed mode caption
  focusedDuel?: number | null;       // zoomed mode: which row is aria-current
  onSelectRegion?: (index: number) => void;
  onSelectDuel?: (index: number) => void;
}
```

Renders:

- A disclosure `<button>` ("Hide breakdown" / "Show breakdown", `aria-expanded`), **default expanded**. When collapsed, the table is removed from the DOM (or `hidden`); the disclosure button stays.
- A `<table>` with `<caption>`:
  - **Overview:** caption "Region breakdown". Columns `<th scope="col">`: Region, Duels, Win %, Result. Each row's first cell is a `<button>` with accessible name = `RegionRow.label`; `onClick` → `onSelectRegion(index)`.
  - **Zoomed:** caption "{regionName} duels". Columns: Outcome, Weapon, Round, Enemy. Each row's first cell is a `<button>` named `DuelRow.label`; `onClick` → `onSelectDuel(index)`. The row whose `index === focusedDuel` gets `aria-current="true"` and a visible highlight class.
- Empty cells render a muted "—".

The component holds no business logic; ordering, naming, and counts come from the row builders.

### Rewire — `FightMap.tsx`

- Add `const [focusedDuel, setFocusedDuel] = useState<number | null>(null)`.
- Derive `zoomedDuels` (the filtered, order-preserving duel list) and, when zoomed, `duelRows = buildDuelRows(zoomedDuels)`; always derive `regionRows = buildRegionRows(regionModel, assignment)`.
- Clear `focusedDuel`: in the `onFilter` helper (alongside `setZoomedRegion(null)`) and whenever `zoomedRegion` changes (a small effect, or fold into the same setters that change `zoomedRegion`).
- Pass `zoomedDuels` to `FragMap` as `shownPoints`, plus `focusedDuel` and `onFocusDuel={setFocusedDuel}`.
- Render `BreakdownTable` below the map branch (inside the `points.length > 0` block, after `<Legend/>`):
  - Overview (`zoomedRegion == null`): `regionRows` + `onSelectRegion={(i) => { setZoomedRegion(i); setLayer("dots"); }}` (always lands in the zoomed dots view, matching the Heatmap pointer path).
  - Zoomed: `duelRows`, `regionName`, `focusedDuel`, `onSelectDuel={setFocusedDuel}`.
- Add `const [breakdownOpen, setBreakdownOpen] = useState(true)` for the disclosure.

### Rewire — `FragMap.tsx`

- Accept `shownPoints`, `focusedDuel`, `onFocusDuel` props. `FightMap` always passes `shownPoints={zoomedDuels}` (empty when not zoomed, since the `assignment === null` filter matches nothing). `FragMap` removes its own `shownPoints` `useMemo` and renders `zoomed ? shownPoints : points` — the prop drives the zoomed render, `points` drives the overview. (`FragMap` still uses the full `points` + `assignment` for the overview dot→region zoom mapping in `onZoom`.)
- Forward `focused={focusedDuel}` and `onFocusChange={onFocusDuel}` to `DuelMap`.

### Rewire — `DuelMap.tsx`

- Make the focused-duel selection **controlled**: add props `focused?: number | null` and `onFocusChange?: (i: number | null) => void`. Replace internal `setFocused(...)` calls in the dot/dialog handlers with `onFocusChange(...)`; read `focused` from the prop. Keep `hovered` and `expanded` internal. The existing focus-in-on-open / focus-return-on-close effect and Tab trap key off the prop and are unchanged in behavior. (When `onFocusChange` is absent — no current caller — fall back to internal state so `DuelMap` stays usable standalone.)
- Mark the `<svg>` `aria-hidden="true"`. The dialog `<div role="dialog">` is a sibling outside the svg and stays reachable.

### Rewire — `RegionView.tsx`

- Mark its `<svg>` `aria-hidden="true"` (the region table is the keyboard path for the Heatmap overview). Pointer `onClick`/`onSelectRegion` unchanged.

### Rewire — `SideToggle.tsx`

- Add `aria-pressed` reflecting the selected side and an accessible name per option ("Attack" / "Defense" / "Both"); group labelled "Side". Decorative icons stay `aria-hidden`. (Phase-1 gap closeout.)

## Data Flow

```
zoomedRegion (FightMap state)
  ├─ null  -> regionRows = buildRegionRows(regionModel, assignment)
  │           BreakdownTable (overview) -> onSelectRegion(i)
  │             -> setZoomedRegion(i); setLayer("dots")
  └─ i     -> zoomedDuels = points.filter(assignment === i)
              ├─ FragMap shownPoints -> DuelMap dots
              └─ duelRows = buildDuelRows(zoomedDuels)
                  BreakdownTable (zoomed) <-> focusedDuel <-> DuelMap focused
                    row activate -> setFocusedDuel(i) -> dialog opens
                    dot click    -> onFocusChange(i) -> setFocusedDuel(i) -> row aria-current
                    dialog close -> setFocusedDuel(null) -> aria-current clears
```

## Error Handling / Edge Cases

- **No duels for the filter:** `FightMap` already renders the empty-state text instead of the map; the table is inside that same `points.length > 0` branch, so it does not render either. No empty-table crash.
- **Region with all position-less duels:** still listed in both modes; opening a duel shows the dialog without an engagement tracer (existing graceful degradation).
- **Untraced / callout maps (`polygon == null`):** `RegionModel` still carries `name`, `winRate`, `muted`, `cx`, `cy`, so region rows build normally; zoom still works (`regionBounds` falls back to the duel bbox).
- **Filter change while zoomed:** the existing `onFilter` resets `zoomedRegion → null` and now also clears `focusedDuel`; the table returns to region mode for the new dataset.
- **Selection sync on dialog close:** Esc / `✕` / click-away all route through `onFocusChange(null)`, clearing `focusedDuel` and the row's `aria-current`.
- **Collapsed table:** the disclosure button persists so SR users can re-expand; collapsing does not affect map behavior.
- **Reduced motion:** unaffected (the table is static).

## Components / Files

- **Create `lib/fightmap/breakdown.ts`** — `buildRegionRows`, `buildDuelRows`, `resultBand`, the row types. Pure, tested.
- **Create `components/fightmap/BreakdownTable.tsx`** — context-aware table + disclosure; presentational.
- **Modify `components/fightmap/FightMap.tsx`** — `focusedDuel` + `breakdownOpen` state; derive rows + `zoomedDuels`; render and wire `BreakdownTable` both directions; clear `focusedDuel` on zoom/filter change.
- **Modify `components/fightmap/FragMap.tsx`** — thread `shownPoints` / `focusedDuel` / `onFocusDuel`; forward focus to `DuelMap`.
- **Modify `components/fightmap/DuelMap.tsx`** — controlled `focused` / `onFocusChange`; `aria-hidden` on `<svg>`.
- **Modify `components/fightmap/RegionView.tsx`** — `aria-hidden` on `<svg>`.
- **Modify `components/fightmap/SideToggle.tsx`** — `aria-pressed` + accessible names.

Each new file is single-responsibility; the pure builders keep the table component thin.

## Testing

**Unit (Vitest), `tests/breakdown.test.ts` (new):**

- `resultBand`: `muted` → "Low sample"; `0.40` → "Mostly lose"; `0.50` → "Even"; `0.60` → "Mostly win"; boundary `0.45`/`0.55` → "Even".
- `buildRegionRows`: drops zero-duel regions; duel counts match `assignment`; spatial order on a fixture with known centroids (top band left→right before lower band); `label` contains "N duels" and "M% win rate" and the result word.
- `buildDuelRows`: order is round-ascending then kills-before-deaths on a mixed fixture; `label` reads "Kill, <weapon>, round <n>" / "Death, ...", with "vs <enemyAgent>" appended when present and graceful omission of missing weapon/round.

**Smoke (Playwright), `tests/smoke.spec.ts` (additions):**

- In overview, a Region-breakdown row `<button>` exists with an accessible name matching `/\d+ duels, \d+% win rate/`; activating it zooms in (breadcrumb appears / `viewBox` ≠ `"0 0 100 100"`).
- When zoomed, the table shows duel rows; a duel row `<button>` matches `/(Kill|Death),/`; activating it opens a `role="dialog"`, focus lands inside it, and that row has `aria-current="true"`.
- Clicking a dot (`dispatchEvent("click")`) sets `aria-current="true"` on the matching duel row (two-way sync).
- The map `<svg>` exposes `aria-hidden="true"`.
- `SideToggle` options expose `aria-pressed`.

**Manual:** keyboard-only walkthrough (Tab to a region row, Enter to zoom, Tab to a duel row, Enter to open the dialog, Esc to close and return focus); a VoiceOver pass confirming the table conveys the map; confirm the decorative svg is skipped by SR.

## Out of Scope

- A **sortable** breakdown table, column sorting, or filtering within the table.
- **Arrow-key roving** over the raw SVG shapes (the table is the keyboard interface instead).
- Home / Nav / Charts page a11y; an app-wide automated axe gate.
- Any change to heatmap math, tallies, region assignment, or the zoom/animation behavior.
- The deferred heatmap-layer zoom-in animation (separate fast-follow).

## Decisions (resolved during brainstorming)

- **One context-aware table** (regions in overview, duels when zoomed) rather than a duels-only table or two separate tables — a single component carries the whole keyboard path and follows the "table is the equivalent control" pattern.
- **`focusedDuel` lifted to `FightMap`** as the single source of truth for two-way dot↔row sync; `DuelMap`'s focus becomes controlled.
- **Activating a region row always lands in the zoomed Dots view** (`setLayer("dots")`), uniform across the current layer.
- **Decorative SVG is `aria-hidden`**; the table is the SR source of truth.
- **`SideToggle` `aria-pressed`** folded in as the last Phase-1 control gap.
