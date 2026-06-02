# Regions-View Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the FragsMap **Regions** view: spotlight+lift hover with a tooltip (traced maps), a richer detail panel (win% / W-L bar / Attack-Defense split / duel dots), an accent ring on the selected zone, and a legend that explains the gray muted zones.

**Architecture:** Thread per-duel `side` through `Placed` and add a pure `sideSplit` helper in `lib/fightmap.ts`. Enrich the presentational components (`RegionDetail`, `Legend`) and add hover/spotlight/tooltip/selected-ring to `RegionView` (with a co-located CSS module for transitions and reduced-motion). `FightMap` passes the existing `selectedRegion` down so the map can mark it. Hover/spotlight is polygon-mode only; the rest works in both modes.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Vitest (`@/` alias), Playwright smoke (`pnpm smoke`). Package manager: pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-02-regions-view-polish-design.md`

---

## File Structure

- `lib/fightmap.ts` (modify) — add `side` to `Placed`, carry it in `placeDuels`, add `SideSplit` type + `sideSplit()` helper.
- `tests/fightmap.test.ts` (modify) — unit tests for `Placed.side` and `sideSplit`.
- `components/fightmap/Legend.tsx` (modify) — plain-language end labels + muted swatch row.
- `components/fightmap/RegionDetail.tsx` (modify) — enriched stats (win% number, W/L bar, ATK/DEF cells, existing dot map).
- `components/fightmap/RegionView.tsx` (modify) — hover spotlight + lift + cursor tooltip (polygon mode), selected-zone accent ring (both modes); new `selected` prop.
- `components/fightmap/RegionView.module.css` (create) — `.poly` transition, `.lift` transform, tooltip styling, reduced-motion.
- `components/fightmap/FightMap.tsx` (modify) — pass `selected={selectedRegion}` to `RegionView`.
- `tests/smoke.spec.ts` (modify) — a `gotoRegions` helper + smoke tests for the legend, the enriched panel, and the hover tooltip.

**Context the implementer needs:**

- `Placed` (in `lib/fightmap.ts`) is currently `{ nx, ny, won, col, row }`. `Duel` (in `lib/types.ts`) is `{ x, y, won, side: "attack" | "defense", round }`. `placeDuels` maps `Duel[] → Placed[]`.
- `RegionStat` and `PolyRegionStat` BOTH already expose `{ cx, cy, wins, total, winRate, muted }`. `RegionStat` names the region `regionName`; `PolyRegionStat` names it `name`. `RegionView` already branches on `mode` (`"raster"` uses `regions: RegionStat[]`, `"polygon"` uses `polyRegions: PolyRegionStat[]`).
- `winRateColor(w: number)` is exported from `lib/fightmap.ts` and returns the red→gray→green color used on the map.
- `--accent` is the global CSS variable `#ff4655`. SVG presentation attributes do **not** resolve `var()`, so use the hex `#ff4655` directly in SVG `stroke`/inline style.
- `FightMap` holds `selectedRegion: number | null` and already passes `onSelectRegion={setSelectedRegion}` to `RegionView`. Filters reset selection via `onFilter`/`onView` — unchanged.
- The picker shows only **played** maps; **Ascent** is traced (polygon mode) and played, so the smoke tests use it under the "All time" filter. If Ascent is ever absent from the picker, substitute another traced+played map (Bind, Split, or Fracture).
- Follow the existing inline-style convention in these components; only `RegionView` gets a CSS module (for `:hover`-style transitions and the reduced-motion media query — same precedent as `MapPicker.module.css`).

---

### Task 1: `Placed.side` + `sideSplit` helper

**Files:**

- Modify: `lib/fightmap.ts` (the `Placed` interface ~line 8, the `placeDuels` return ~line 33, and add `SideSplit`/`sideSplit` after `placeDuels`)
- Test: `tests/fightmap.test.ts` (add two `describe` blocks)

- [ ] **Step 1: Write the failing tests**

In `tests/fightmap.test.ts`, add `sideSplit` to the existing import from `@/lib/fightmap`:

```ts
import {
  placeDuels,
  zonesFromPlaced,
  GRID_N,
  MIN_DUELS,
  collectDuels,
  seasonsOf,
  currentSeasonOf,
  mapsOf,
  mostPlayedMap,
  type TimeScope,
  type Placed,
  winRateColor,
  formatSeason,
  assignRegions,
  sideSplit,
} from "@/lib/fightmap";
```

Then add these blocks at the end of the file:

```ts
const duelSide = (
  x: number,
  y: number,
  won: boolean,
  side: "attack" | "defense",
): Duel => ({ x, y, won, side, round: 0 });

describe("placeDuels side", () => {
  it("carries each duel's side onto the placed point", () => {
    const placed = placeDuels(
      [duelSide(0, 0, true, "attack"), duelSide(0.5, 0.5, false, "defense")],
      calib,
      6,
    );
    expect(placed[0].side).toBe("attack");
    expect(placed[1].side).toBe("defense");
  });
});

describe("sideSplit", () => {
  const p = (won: boolean, side: "attack" | "defense"): Placed => ({
    nx: 0,
    ny: 0,
    won,
    side,
    col: 0,
    row: 0,
  });

  it("tallies wins and totals per side", () => {
    const s = sideSplit([
      p(true, "attack"),
      p(false, "attack"),
      p(true, "defense"),
    ]);
    expect(s.attack).toEqual({ wins: 1, total: 2 });
    expect(s.defense).toEqual({ wins: 1, total: 1 });
  });

  it("returns null for a side with no duels", () => {
    const s = sideSplit([p(true, "attack")]);
    expect(s.attack).toEqual({ wins: 1, total: 1 });
    expect(s.defense).toBeNull();
  });

  it("returns null for both sides when empty", () => {
    expect(sideSplit([])).toEqual({ attack: null, defense: null });
  });
});
```

(`Duel` is already imported at the top of this test file via `import type { Duel, FightMatch } from "@/lib/types";`, and `calib` is already defined.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/fightmap.test.ts`
Expected: FAIL — `sideSplit` is not exported (import error) and `placed[0].side` is `undefined`.

- [ ] **Step 3: Add `side` to `Placed`**

In `lib/fightmap.ts`, change the `Placed` interface (around line 8) to:

```ts
export interface Placed {
  nx: number;
  ny: number;
  won: boolean;
  side: "attack" | "defense";
  col: number;
  row: number;
}
```

- [ ] **Step 4: Carry `side` in `placeDuels`**

In the `placeDuels` return object (around line 35), add the `side` field:

```ts
return {
  nx,
  ny,
  won: d.won,
  side: d.side,
  col: clampCell(nx, gridN),
  row: clampCell(ny, gridN),
};
```

- [ ] **Step 5: Add `SideSplit` + `sideSplit`**

In `lib/fightmap.ts`, immediately after the `placeDuels` function, add:

```ts
export interface SideSplit {
  attack: { wins: number; total: number } | null;
  defense: { wins: number; total: number } | null;
}

// Tally wins/totals per side from already-placed duels. A side with no duels
// in the set is null, so callers can omit its cell (e.g. when the SIDE filter
// is one-sided). Per-duel side is always "attack" or "defense".
export function sideSplit(points: Placed[]): SideSplit {
  const tally = (s: "attack" | "defense") => {
    const pts = points.filter((p) => p.side === s);
    if (pts.length === 0) return null;
    return { wins: pts.filter((p) => p.won).length, total: pts.length };
  };
  return { attack: tally("attack"), defense: tally("defense") };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run tests/fightmap.test.ts`
Expected: PASS (new blocks green; existing `placeDuels` tests still green — `toMatchObject` ignores the new `side` field).

- [ ] **Step 7: Commit**

```bash
git add lib/fightmap.ts tests/fightmap.test.ts
git commit -m "Adds side to Placed and a sideSplit helper"
```

---

### Task 2: Legend — clearer labels + muted swatch

**Files:**

- Modify: `components/fightmap/Legend.tsx` (replace entire contents)
- Test: `tests/smoke.spec.ts` (add one test)

- [ ] **Step 1: Write the failing smoke test**

Add this test to the end of `tests/smoke.spec.ts`:

```ts
test("fragsmap legend explains the muted zones", async ({ page }) => {
  await page.goto("/fragsmap");
  // The legend renders under the map on initial load (grid view).
  await expect(page.getByText(/under 5 duels/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "legend explains the muted zones"`
Expected: FAIL — the current legend has no "under 5 duels" text.

- [ ] **Step 3: Replace `Legend.tsx`**

Replace the entire contents of `components/fightmap/Legend.tsx` with:

```tsx
const subLabel: React.CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontWeight: 400,
};

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
          color: "#cfd6e4",
          fontSize: 12,
          fontWeight: 600,
          marginTop: 5,
        }}
      >
        <span>
          Mostly lose
          <span style={subLabel}>low win%</span>
        </span>
        <span style={{ textAlign: "center" }}>
          even
          <span style={subLabel}>50%</span>
        </span>
        <span style={{ textAlign: "right" }}>
          Mostly win
          <span style={subLabel}>high win%</span>
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 13,
          paddingTop: 12,
          borderTop: "1px solid #1e2530",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: "#3a3f4b",
            opacity: 0.45,
            flex: "0 0 auto",
          }}
        />
        <span>Gray = under 5 duels (too few to color)</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "legend explains the muted zones"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/fightmap/Legend.tsx tests/smoke.spec.ts
git commit -m "Clarifies Regions legend and explains muted zones"
```

---

### Task 3: Enriched RegionDetail panel

**Files:**

- Modify: `components/fightmap/RegionDetail.tsx` (replace entire contents)
- Test: `tests/smoke.spec.ts` (add a `gotoRegions` helper + one test)

- [ ] **Step 1: Write the failing smoke test**

In `tests/smoke.spec.ts`, add this helper near the top (after the imports, before the first `test(`):

```ts
// Drive the Regions view on a traced map with data. "All time" guarantees the
// traced map (Ascent) has duels regardless of the current season.
async function gotoRegions(page: import("@playwright/test").Page) {
  await page.goto("/fragsmap");
  await page.getByRole("button", { name: "All time" }).click();
  await page.getByRole("button", { name: "Ascent", exact: true }).click();
  await page.getByRole("button", { name: "Regions" }).click();
}
```

Then add this test at the end of the file:

```ts
test("fragsmap region detail shows enriched stats", async ({ page }) => {
  await gotoRegions(page);
  // Selecting a zone opens the enriched panel.
  await page.locator("svg polygon").first().click();
  await expect(page.getByText("win rate")).toBeVisible();
  await expect(page.getByText(/\d+ duels/)).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "region detail shows enriched stats"`
Expected: FAIL — the current `RegionDetail` renders neither a "win rate" label nor an "N duels" string in that form (its header is "`<name> — N duels · N won`", which has "duels" but no standalone "win rate" label; the `win rate` assertion fails).

- [ ] **Step 3: Replace `RegionDetail.tsx`**

Replace the entire contents of `components/fightmap/RegionDetail.tsx` with:

```tsx
"use client";
import { sideSplit, winRateColor, type Placed } from "@/lib/fightmap";

function SideCell({
  label,
  stat,
}: {
  label: string;
  stat: { wins: number; total: number } | null;
}) {
  if (!stat) return null;
  return (
    <div
      style={{
        background: "#161b24",
        border: "1px solid #222a38",
        borderRadius: 9,
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>
        {Math.round((stat.wins / stat.total) * 100)}%
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
          {" "}
          · {stat.wins}/{stat.total}
        </span>
      </div>
    </div>
  );
}

export default function RegionDetail({
  image,
  points,
  regionName,
}: {
  image: string;
  points: Placed[];
  regionName: string;
}) {
  const total = points.length;
  const wins = points.filter((p) => p.won).length;
  const losses = total - wins;
  const wr = total ? wins / total : 0;
  const split = sideSplit(points);

  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0 10px", fontSize: 17 }}>{regionName}</h3>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1,
            color: winRateColor(wr),
          }}
        >
          {Math.round(wr * 100)}%
        </span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>win rate</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 13,
          color: "#cfd6e4",
          marginBottom: 10,
        }}
      >
        <span>
          <b style={{ color: "#5fd07a" }}>{wins}</b> won
        </span>
        <span>
          <b style={{ color: "#e35d6a" }}>{losses}</b> lost
        </span>
        <span style={{ color: "var(--muted)" }}>{total} duels</span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 5,
          overflow: "hidden",
          display: "flex",
          marginBottom: 12,
          background: "#1a1f29",
        }}
      >
        <div
          style={{ width: `${Math.round(wr * 100)}%`, background: "#5fd07a" }}
        />
        <div style={{ flex: 1, background: "#e35d6a" }} />
      </div>

      {(split.attack || split.defense) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <SideCell label="⚔ Attack" stat={split.attack} />
          <SideCell label="🛡 Defense" stat={split.defense} />
        </div>
      )}

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
        {points.map((p, i) => (
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

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "region detail shows enriched stats"`
Expected: PASS — the panel shows the "win rate" label and an "N duels" string.

- [ ] **Step 5: Commit**

```bash
git add components/fightmap/RegionDetail.tsx tests/smoke.spec.ts
git commit -m "Enriches Regions detail panel with win rate, split, and sides"
```

---

### Task 4: RegionView hover + spotlight + tooltip + selected ring

**Files:**

- Create: `components/fightmap/RegionView.module.css`
- Modify: `components/fightmap/RegionView.tsx` (replace entire contents)
- Modify: `components/fightmap/FightMap.tsx` (pass the new `selected` prop)
- Test: `tests/smoke.spec.ts` (add one test; reuses the `gotoRegions` helper from Task 3)

- [ ] **Step 1: Write the failing smoke test**

Add this test at the end of `tests/smoke.spec.ts` (the `gotoRegions` helper already exists from Task 3 — do not redefine it):

```ts
test("fragsmap region hover shows a tooltip", async ({ page }) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  // SVG polygons need dispatchEvent to reliably fire React's synthetic
  // onMouseMove (mirrors the click handling in the detail test above).
  await page.locator("svg polygon").first().dispatchEvent("mousemove");
  await expect(page.getByRole("tooltip")).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "region hover shows a tooltip"`
Expected: FAIL — the current `RegionView` renders no element with `role="tooltip"`.

- [ ] **Step 3: Create the CSS module**

Create `components/fightmap/RegionView.module.css`:

```css
.wrap {
  position: relative;
}

.poly {
  cursor: pointer;
  transition:
    opacity 0.14s,
    transform 0.14s;
  transform-box: fill-box;
  transform-origin: center;
}

.lift {
  transform: scale(1.04);
}

.tooltip {
  position: fixed;
  z-index: 30;
  pointer-events: none;
  background: rgba(17, 21, 29, 0.95);
  border: 1px solid #2a3242;
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.66);
  min-width: 120px;
}

.tipName {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 2px;
}

.tipWin {
  font-weight: 700;
}

.tipSub {
  color: var(--muted);
}

.swatch {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 5px;
  vertical-align: middle;
}

@media (prefers-reduced-motion: reduce) {
  .poly {
    transition: opacity 0.14s;
  }
  .lift {
    transform: none;
  }
}
```

- [ ] **Step 4: Replace `RegionView.tsx`**

Replace the entire contents of `components/fightmap/RegionView.tsx` with:

```tsx
"use client";
import { useState } from "react";
import { winRateColor, type Placed, type RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";
import styles from "./RegionView.module.css";

const RASTER_N = 80; // tiles per axis — finer raster for tighter blobs
const MASK_R = 0.04;
const MASK_R2 = MASK_R * MASK_R;
const ACCENT = "#ff4655"; // --accent (SVG attrs can't resolve var())

type TipData = {
  name: string;
  color: string;
  winRate: number;
  wins: number;
  total: number;
  muted: boolean;
};
type Tip = { x: number; y: number; data: TipData } | null;

export default function RegionView({
  image,
  mode,
  regions,
  polyRegions,
  points,
  selected,
  onSelectRegion,
}: {
  image: string;
  mode: "raster" | "polygon";
  regions: RegionStat[];
  polyRegions?: PolyRegionStat[];
  points: Placed[];
  selected: number | null;
  onSelectRegion: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip>(null);

  // Spotlight: hovered zone stays prominent, others dim. No hover → base.
  const polyOpacity = (i: number, muted: boolean) => {
    const base = muted ? 0.25 : 0.55;
    if (hovered == null) return base;
    if (i === hovered) return muted ? 0.4 : 0.9;
    return muted ? 0.08 : 0.18;
  };

  if (mode === "polygon") {
    const polys = polyRegions ?? [];
    return (
      <div className={styles.wrap}>
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
            style={{ pointerEvents: "none" }}
          />
          {polys.map((r, i) => (
            <polygon
              key={i}
              className={`${styles.poly} ${i === hovered ? styles.lift : ""}`}
              points={r.polygon
                .map((p) => `${p[0] * 100},${p[1] * 100}`)
                .join(" ")}
              fill={r.muted ? "#3a3f4b" : winRateColor(r.winRate)}
              style={{
                opacity: polyOpacity(i, r.muted),
                stroke: i === selected ? ACCENT : "#11151d",
                strokeWidth: i === selected ? 0.8 : 0.3,
              }}
              onMouseMove={(e) => {
                setHovered(i);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  data: {
                    name: r.name,
                    color: r.muted ? "#3a3f4b" : winRateColor(r.winRate),
                    winRate: r.winRate,
                    wins: r.wins,
                    total: r.total,
                    muted: r.muted,
                  },
                });
              }}
              onMouseLeave={() => {
                setHovered(null);
                setTip(null);
              }}
              onClick={() => onSelectRegion(i)}
            />
          ))}
          {polys.map((r, i) =>
            r.muted ? null : (
              <g key={i} style={{ pointerEvents: "none" }}>
                <text
                  x={r.cx * 100}
                  y={r.cy * 100}
                  textAnchor="middle"
                  fontSize="2.2"
                  fontWeight="700"
                  fill="#fff"
                  stroke="#11151d"
                  strokeWidth="0.4"
                  style={{ paintOrder: "stroke" }}
                >
                  {r.name}
                </text>
                <text
                  x={r.cx * 100}
                  y={r.cy * 100 + 2.6}
                  textAnchor="middle"
                  fontSize="1.9"
                  fontWeight="600"
                  fill="#fff"
                  stroke="#11151d"
                  strokeWidth="0.35"
                  style={{ paintOrder: "stroke" }}
                >
                  {Math.round(r.winRate * 100)}% · {r.total}
                </text>
              </g>
            ),
          )}
        </svg>
        {tip && (
          <div
            className={styles.tooltip}
            role="tooltip"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
          >
            <div className={styles.tipName}>{tip.data.name}</div>
            <div>
              <span
                className={styles.swatch}
                style={{ background: tip.data.color }}
              />
              <span className={styles.tipWin}>
                {Math.round(tip.data.winRate * 100)}% win
              </span>
            </div>
            <div className={styles.tipSub}>
              {tip.data.wins}W / {tip.data.total - tip.data.wins}L ·{" "}
              {tip.data.total} duels{tip.data.muted ? " · low sample" : ""}
            </div>
          </div>
        )}
      </div>
    );
  }

  const cell = 100 / RASTER_N;
  const tiles: { x: number; y: number; r: RegionStat }[] = [];
  if (regions.length && points.length) {
    const pointRegion = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < regions.length; i++) {
        const d = (regions[i].cx - p.nx) ** 2 + (regions[i].cy - p.ny) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    });

    for (let row = 0; row < RASTER_N; row++) {
      for (let col = 0; col < RASTER_N; col++) {
        const cnx = (col + 0.5) / RASTER_N;
        const cny = (row + 0.5) / RASTER_N;
        let nearestD = Infinity;
        let nearestI = -1;
        for (let k = 0; k < points.length; k++) {
          const d = (points[k].nx - cnx) ** 2 + (points[k].ny - cny) ** 2;
          if (d < nearestD) {
            nearestD = d;
            nearestI = k;
          }
        }
        if (nearestI < 0 || nearestD > MASK_R2) continue;
        tiles.push({
          x: col * cell,
          y: row * cell,
          r: regions[pointRegion[nearestI]],
        });
      }
    }
  }

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    let best = -1;
    let bestD = Infinity;
    regions.forEach((r, i) => {
      if (r.muted) return;
      const d = (r.cx - nx) ** 2 + (r.cy - ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) onSelectRegion(best);
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      onClick={handleClick}
      style={{
        display: "block",
        borderRadius: 10,
        border: "1px solid #222a38",
        aspectRatio: "1 / 1",
        cursor: "pointer",
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
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width={cell}
          height={cell}
          fill={t.r.muted ? "#3a3f4b" : winRateColor(t.r.winRate)}
          opacity={t.r.muted ? 0.25 : 0.6}
        />
      ))}
      {regions.map((r, i) =>
        r.muted ? null : (
          <g key={i} style={{ pointerEvents: "none" }}>
            <text
              x={r.cx * 100}
              y={r.cy * 100}
              textAnchor="middle"
              fontSize="2.2"
              fontWeight="700"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.4"
              style={{ paintOrder: "stroke" }}
            >
              {r.regionName}
            </text>
            <text
              x={r.cx * 100}
              y={r.cy * 100 + 2.6}
              textAnchor="middle"
              fontSize="1.9"
              fontWeight="600"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.35"
              style={{ paintOrder: "stroke" }}
            >
              {Math.round(r.winRate * 100)}% · {r.total}
            </text>
          </g>
        ),
      )}
      {selected != null && regions[selected] && (
        <circle
          cx={regions[selected].cx * 100}
          cy={regions[selected].cy * 100}
          r="4"
          fill="none"
          stroke={ACCENT}
          strokeWidth="0.8"
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}
```

(Note: the raster `handleClick` now computes `nx`/`ny` directly in [0,1] — functionally identical to the prior `clickX/100` math, just without the redundant ×100÷100 round-trip.)

- [ ] **Step 5: Pass `selected` from `FightMap`**

In `components/fightmap/FightMap.tsx`, update the `<RegionView ... />` element (around line 201) to pass the new prop:

```tsx
<RegionView
  image={calib.image}
  mode={polygonMode ? "polygon" : "raster"}
  regions={regions}
  polyRegions={polyStats}
  points={points}
  selected={selectedRegion}
  onSelectRegion={setSelectedRegion}
/>
```

- [ ] **Step 6: Run the smoke test to verify it passes**

Run: `pnpm smoke -- tests/smoke.spec.ts -g "region hover shows a tooltip"`
Expected: PASS — hovering a polygon renders the `role="tooltip"` element.

- [ ] **Step 7: Run lint, build, and full test suites**

Run: `pnpm lint`
Expected: no errors (a `@next/next/no-img-element` warning is not raised here; the SVG `<image>` is fine).

Run: `pnpm build`
Expected: build succeeds — `RegionView`'s new `selected` prop is provided by `FightMap`; all types check.

Run: `pnpm test`
Expected: all vitest suites pass (58+ tests).

Run: `pnpm smoke`
Expected: all Playwright smoke tests pass (existing + the three new ones).

- [ ] **Step 8: Commit**

```bash
git add components/fightmap/RegionView.tsx components/fightmap/RegionView.module.css components/fightmap/FightMap.tsx tests/smoke.spec.ts
git commit -m "Adds hover spotlight, tooltip, and selected ring to Regions view"
```

---

## Self-Review

**1. Spec coverage:**

- §1.1 Hover spotlight + lift + tooltip (polygon only) → Task 4 (`polyOpacity`, `styles.lift`, `role="tooltip"` element). ✓
- §1.1 reduced motion → Task 4 CSS `@media (prefers-reduced-motion: reduce)`. ✓
- §1.2 enriched panel (win%, W/L bar, ATK/DEF, dots) → Task 3 (`RegionDetail` + `sideSplit`). ✓
- §1.2 one-sided filter omits empty cell → Task 3 (`SideCell` returns null on null stat; `sideSplit` returns null). ✓
- §1.3 selected-zone accent ring (both modes) → Task 4 (polygon stroke = ACCENT when `i === selected`; raster `<circle>` at centroid). ✓
- §1.4 legend labels + muted swatch → Task 2. ✓
- §2.1 `Placed.side` + `sideSplit` → Task 1. ✓
- §2.2 `RegionView.module.css`, `selected` prop, `FightMap` wiring → Task 4. ✓
- §5 tests: unit (`Placed.side`, `sideSplit`) → Task 1; smoke (legend, panel select, hover tooltip) → Tasks 2–4. ✓
- §6 scope guard (no modal, no raster hover, no Grid changes) → honored; raster keeps current behavior + only adds the selection ring. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**3. Type consistency:** `Placed.side: "attack" | "defense"` (Task 1) matches `Duel.side` and is consumed by `sideSplit` (Task 1) and `RegionDetail` (Task 3). `SideSplit` shape (`{ attack, defense }`, each `{ wins, total } | null`) is consumed identically by `SideCell`. `RegionView` gains `selected: number | null` (Task 4) and `FightMap` passes `selectedRegion` of the same type (Task 4). Tooltip uses `r.wins`/`r.total`/`r.winRate`/`r.name`, all present on `PolyRegionStat`. ✓
