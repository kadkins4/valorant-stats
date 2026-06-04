# FragsMap Spatial-Zoom Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped side-by-side FragsMap with one full-bleed map that has a Dots/Heatmap layer toggle and zooms into a region (via SVG `viewBox`) for detail; deprecate the Grid view.

**Architecture:** Every coordinate already lives in a `0..100` SVG user space, so zoom = changing the `<svg>` `viewBox` to a region's bounding box. A new pure `lib/fightmap/zoom.ts` computes bounds; a new pure `lib/fightmap/regionModel.ts` normalizes traced/untraced regions into one shape + a point→region assignment. A new presentational `FragMap.tsx` owns the dots layer + zoom + breadcrumb, reusing the existing `DuelMap` (given a `viewBox` and an `onZoom` callback). `FightMap` renders `RegionView` directly for the heatmap overview (heatmap is overview-only) and `FragMap` otherwise.

**Tech Stack:** Next.js (App Router, client components), React 19, TypeScript, Vitest (`pnpm exec vitest run`), Playwright (`pnpm exec playwright test`).

---

### Task 1: Zoom geometry helpers (`lib/fightmap/zoom.ts`)

**Files:**

- Create: `lib/fightmap/zoom.ts`
- Test: `tests/zoom.test.ts`

Context: coordinates are normalized `0..1` on `Placed` (`nx,ny`) and on `PolyRegionStat.polygon`; the SVG user space is `0..100`. `regionBounds` takes a region polygon (or `null`) plus the region's duels and returns a padded, min-sized, clamped box in `0..100` space.

- [ ] **Step 1: Write the failing tests**

Create `tests/zoom.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { regionBounds, viewBoxString, FULL_VIEWBOX } from "@/lib/fightmap/zoom";

describe("regionBounds", () => {
  it("uses the polygon bbox, padded, for a central region", () => {
    const poly: [number, number][] = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ];
    // bbox 40..60 (w/h 20); pad = max(4, 0.08*20=1.6) = 4 → 36..64 (w/h 28)
    expect(regionBounds(poly, [])).toEqual({ x: 36, y: 36, w: 28, h: 28 });
  });

  it("grows a tiny region to the minimum side, centered", () => {
    const poly: [number, number][] = [
      [0.5, 0.5],
      [0.51, 0.5],
      [0.51, 0.51],
      [0.5, 0.51],
    ];
    // bbox 50..51 (w1); pad 4 → 46..55 (w9); min-side 20 about center 50.5 → 40.5..60.5
    const b = regionBounds(poly, []);
    expect(b.w).toBeCloseTo(20);
    expect(b.h).toBeCloseTo(20);
    expect(b.x).toBeCloseTo(40.5);
  });

  it("clamps a corner region inside [0,100]", () => {
    const poly: [number, number][] = [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
      [0, 0.1],
    ];
    const b = regionBounds(poly, []);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(100);
    expect(b.y + b.h).toBeLessThanOrEqual(100);
  });

  it("falls back to the duel bbox when there is no polygon", () => {
    const b = regionBounds(null, [
      { nx: 0.3, ny: 0.3 },
      { nx: 0.5, ny: 0.5 },
    ]);
    // bbox 30..50 (w20); pad 4 → 26..54 (w28)
    expect(b).toEqual({ x: 26, y: 26, w: 28, h: 28 });
  });

  it("viewBoxString formats and FULL_VIEWBOX is the whole map", () => {
    expect(viewBoxString({ x: 1, y: 2, w: 3, h: 4 })).toBe("1 2 3 4");
    expect(viewBoxString(FULL_VIEWBOX)).toBe("0 0 100 100");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/zoom.test.ts`
Expected: FAIL — module `@/lib/fightmap/zoom` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `lib/fightmap/zoom.ts`:

```ts
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_VIEWBOX: ViewBox = { x: 0, y: 0, w: 100, h: 100 };

// Minimum side length (user units) so a tiny region doesn't zoom to extreme magnification.
const MIN_SIDE = 20;

/**
 * Bounding box (in 0..100 SVG user space) to zoom to for a region.
 * Sources points from the polygon when traced, else from the region's duels.
 * Pads, enforces a minimum side, and clamps inside [0,100].
 */
export function regionBounds(
  polygon: [number, number][] | null,
  duels: { nx: number; ny: number }[],
): ViewBox {
  const pts: [number, number][] =
    polygon && polygon.length ? polygon : duels.map((d) => [d.nx, d.ny]);
  if (!pts.length) return { ...FULL_VIEWBOX };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // Normalize 0..1 → 0..100 user units.
  let x0 = minX * 100,
    y0 = minY * 100,
    x1 = maxX * 100,
    y1 = maxY * 100;

  const pad = Math.max(4, 0.08 * Math.max(x1 - x0, y1 - y0));
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;

  // Grow each axis to MIN_SIDE about its center.
  const grow = (a: number, b: number): [number, number] => {
    if (b - a >= MIN_SIDE) return [a, b];
    const c = (a + b) / 2;
    return [c - MIN_SIDE / 2, c + MIN_SIDE / 2];
  };
  [x0, x1] = grow(x0, x1);
  [y0, y1] = grow(y0, y1);

  // Clamp inside the map.
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(100, x1);
  y1 = Math.min(100, y1);

  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function viewBoxString(b: ViewBox): string {
  return `${b.x} ${b.y} ${b.w} ${b.h}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/zoom.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap/zoom.ts tests/zoom.test.ts
git commit -m "Add region zoom geometry helpers"
```

---

### Task 2: Region model normalization (`lib/fightmap/regionModel.ts`)

**Files:**

- Create: `lib/fightmap/regionModel.ts`
- Test: `tests/regionModel.test.ts`

Context: `FightMap` already computes `polyStats: PolyRegionStat[]` (traced; `[]` if untraced), `regions: RegionStat[]` (callout-based), and `frags.assignment: number[]` (region index per point for traced maps). This helper collapses those into one uniform `RegionModel[]` plus a point→region `assignment`, so `FragMap` has a single shape regardless of map.

- [ ] **Step 1: Write the failing tests**

Create `tests/regionModel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRegionModel } from "@/lib/fightmap/regionModel";
import type { Placed, RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";

const pt = (nx: number, ny: number): Placed =>
  ({ nx, ny, won: true, side: "attack", col: 0, row: 0 }) as Placed;

describe("buildRegionModel", () => {
  it("uses traced polygons and the supplied assignment", () => {
    const poly: PolyRegionStat[] = [
      {
        name: "A",
        polygon: [[0, 0]],
        cx: 0.2,
        cy: 0.2,
        wins: 1,
        total: 2,
        winRate: 0.5,
        muted: false,
      },
      {
        name: "B",
        polygon: [[1, 1]],
        cx: 0.8,
        cy: 0.8,
        wins: 1,
        total: 1,
        winRate: 1,
        muted: true,
      },
    ] as PolyRegionStat[];
    const { regions, assignment } = buildRegionModel(
      [pt(0.2, 0.2), pt(0.8, 0.8), pt(0.2, 0.2)],
      poly,
      [],
      [0, 1, 0],
    );
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({
      name: "A",
      polygon: [[0, 0]],
      muted: false,
    });
    expect(assignment).toEqual([0, 1, 0]);
  });

  it("falls back to nearest callout when there are no polygons", () => {
    const callouts: RegionStat[] = [
      {
        regionName: "Left",
        superRegionName: "",
        cx: 0.1,
        cy: 0.1,
        wins: 0,
        total: 1,
        winRate: 0,
        muted: true,
      },
      {
        regionName: "Right",
        superRegionName: "",
        cx: 0.9,
        cy: 0.9,
        wins: 1,
        total: 1,
        winRate: 1,
        muted: true,
      },
    ];
    const { regions, assignment } = buildRegionModel(
      [pt(0.15, 0.15), pt(0.85, 0.85)],
      [],
      callouts,
      [],
    );
    expect(regions.map((r) => r.name)).toEqual(["Left", "Right"]);
    expect(regions[0].polygon).toBeNull();
    expect(assignment).toEqual([0, 1]);
  });

  it("assigns -1 to every point when there are no regions", () => {
    const { regions, assignment } = buildRegionModel(
      [pt(0.5, 0.5)],
      [],
      [],
      [],
    );
    expect(regions).toEqual([]);
    expect(assignment).toEqual([-1]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/regionModel.test.ts`
Expected: FAIL — module `@/lib/fightmap/regionModel` does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/fightmap/regionModel.ts`:

```ts
import type { Placed, RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";

export interface RegionModel {
  name: string;
  winRate: number;
  muted: boolean;
  polygon: [number, number][] | null; // null for untraced (callout) maps
  cx: number; // normalized centroid 0..1
  cy: number;
}

export interface RegionModelResult {
  regions: RegionModel[];
  assignment: number[]; // region index per input point; -1 only when there are no regions
}

/**
 * Normalize traced (polygon) or untraced (callout) regions into one shape plus a
 * point→region assignment. Indices match the source array order, so they are
 * interchangeable with RegionView's onSelectRegion index.
 */
export function buildRegionModel(
  points: Placed[],
  polyStats: PolyRegionStat[],
  calloutRegions: RegionStat[],
  polyAssignment: number[],
): RegionModelResult {
  if (polyStats.length) {
    const regions: RegionModel[] = polyStats.map((p) => ({
      name: p.name,
      winRate: p.winRate,
      muted: p.muted,
      polygon: p.polygon,
      cx: p.cx,
      cy: p.cy,
    }));
    return { regions, assignment: polyAssignment };
  }

  if (!calloutRegions.length) {
    return { regions: [], assignment: points.map(() => -1) };
  }

  const regions: RegionModel[] = calloutRegions.map((r) => ({
    name: r.regionName,
    winRate: r.winRate,
    muted: r.muted,
    polygon: null,
    cx: r.cx,
    cy: r.cy,
  }));
  const assignment = points.map((p) => {
    let best = 0,
      bestD = Infinity;
    calloutRegions.forEach((r, i) => {
      const d = (r.cx - p.nx) ** 2 + (r.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
  return { regions, assignment };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/regionModel.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/fightmap/regionModel.ts tests/regionModel.test.ts
git commit -m "Add region model normalization helper"
```

---

### Task 3: Give `DuelMap` a `viewBox` and an `onZoom` callback

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`

Context: `DuelMap` renders duel dots, cluster badges, the engagement tracer, and the detail dialog inside a hardcoded `viewBox="0 0 100 100"` svg. The redesign needs it to (a) render at an arbitrary `viewBox` (for zoom) and (b) when used as the overview, intercept dot/badge clicks to request a zoom instead of opening the dialog or fanning. Both new props are optional and default to today's behavior, so existing callers and smoke tests keep working.

- [ ] **Step 1: Add the two optional props to the component signature**

In `components/fightmap/DuelMap.tsx`, change the props destructuring/type from:

```tsx
export default function DuelMap({
  image,
  points,
  overlay,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
}) {
```

to:

```tsx
export default function DuelMap({
  image,
  points,
  overlay,
  viewBox = "0 0 100 100",
  onZoom,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
  viewBox?: string;
  onZoom?: (pointIndex: number) => void;
}) {
```

- [ ] **Step 2: Use the `viewBox` prop on the svg**

In the same file, change the map svg opening tag from:

```tsx
      <svg
        viewBox="0 0 100 100"
        width="100%"
        className={styles.svg}
        onClick={() => {
          setFocused(null);
          setExpanded(null);
        }}
      >
```

to:

```tsx
      <svg
        viewBox={viewBox}
        width="100%"
        className={styles.svg}
        onClick={() => {
          setFocused(null);
          setExpanded(null);
        }}
      >
```

- [ ] **Step 3: Intercept the dot click for zoom**

In the `dot(i)` helper's `onClick`, change:

```tsx
        onClick={(e) => {
          e.stopPropagation();
          if (focused === i) {
            setFocused(null);
            setExpanded(null); // collapse on unfocus
          } else {
            setFocused(i);
          }
        }}
```

to:

```tsx
        onClick={(e) => {
          e.stopPropagation();
          if (onZoom) {
            onZoom(i); // overview: a dot click requests a zoom, not the dialog
            return;
          }
          if (focused === i) {
            setFocused(null);
            setExpanded(null); // collapse on unfocus
          } else {
            setFocused(i);
          }
        }}
```

- [ ] **Step 4: Intercept the cluster badge click for zoom**

In the collapsed-cluster branch (the `<g>` with `key={`b${ci}`}`), change its `onClick` from:

```tsx
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(ci);
                  }}
```

to:

```tsx
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onZoom) {
                      onZoom(c.members[0]); // overview: zoom into the cluster's region
                      return;
                    }
                    setExpanded(ci);
                  }}
```

- [ ] **Step 5: Typecheck, run unit + existing smoke for DuelMap**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no type errors.

Run: `pnpm exec vitest run`
Expected: PASS — full unit suite green (no behavior change for existing callers).

Note: DuelMap is still used by `RegionDetail`/`ZoneDetail` at this point (rewired in Task 4), so the app remains functional.

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/DuelMap.tsx
git commit -m "Add viewBox and onZoom props to DuelMap"
```

---

### Task 4: New `FragMap` + rewire `FightMap` to the layer toggle and zoom

**Files:**

- Create: `components/fightmap/FragMap.tsx`
- Modify: `components/fightmap/FightMap.tsx`
- Modify: `tests/smoke.spec.ts` (the interactive FragsMap tests)

Context: `FightMap` currently has a Grid/Regions view toggle and renders a left map + right detail panel (`ZoneGrid`+`ZoneDetail` or `RegionView`+`RegionDetail`). This task replaces that with a single map: a Dots/Heatmap **layer** toggle, a `zoomedRegion` state, and either `RegionView` (heatmap overview) or the new `FragMap` (dots + zoom).

- [ ] **Step 1: Create `FragMap.tsx`**

Create `components/fightmap/FragMap.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import type { Placed } from "@/lib/fightmap";
import type { RegionModel } from "@/lib/fightmap/regionModel";
import { regionBounds, viewBoxString, FULL_VIEWBOX } from "@/lib/fightmap/zoom";
import DuelMap from "./DuelMap";

export default function FragMap({
  image,
  points,
  regions,
  assignment,
  zoomedRegion,
  onZoom,
  onExitZoom,
}: {
  image: string;
  points: Placed[];
  regions: RegionModel[];
  assignment: number[];
  zoomedRegion: number | null;
  onZoom: (regionIndex: number) => void;
  onExitZoom: () => void;
}) {
  // Esc exits the zoom.
  useEffect(() => {
    if (zoomedRegion == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedRegion, onExitZoom]);

  const zoomed = zoomedRegion != null;
  const shownPoints = zoomed
    ? points.filter((_, i) => assignment[i] === zoomedRegion)
    : points;
  const vb = zoomed
    ? viewBoxString(
        regionBounds(regions[zoomedRegion]?.polygon ?? null, shownPoints),
      )
    : viewBoxString(FULL_VIEWBOX);

  return (
    <div>
      {zoomed && (
        <button
          type="button"
          onClick={onExitZoom}
          style={{
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            background: "transparent",
            border: "none",
            color: "#ffd166",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 0",
            marginBottom: 6,
          }}
        >
          ◀ All regions /{" "}
          <b style={{ color: "#ece8e1" }}>
            {regions[zoomedRegion]?.name ?? "Region"}
          </b>
        </button>
      )}
      <DuelMap
        image={image}
        points={shownPoints}
        viewBox={vb}
        onZoom={zoomed ? undefined : (i) => onZoom(assignment[i])}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewire `FightMap.tsx`**

Replace the entire contents of `components/fightmap/FightMap.tsx` with:

```tsx
"use client";
import { useMemo, useState } from "react";
import type { FightMatch } from "@/lib/types";
import {
  getCalibration,
  getCallouts,
  transformCoord,
} from "@/lib/maps/calibration";
import {
  collectDuels,
  placeDuels,
  assignRegions,
  mapsOf,
  mostPlayedMap,
  seasonsOf,
  currentSeasonOf,
  type TimeScope,
} from "@/lib/fightmap";
import {
  getRegions,
  assignFrags,
  statsFromAssignment,
  issuesFromFlags,
  type RegionIssue,
} from "@/lib/maps/regions";
import { buildRegionModel } from "@/lib/fightmap/regionModel";
import MapPicker, { chip } from "./MapPicker";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import RegionView from "./RegionView";
import RegionIssueNotice from "./RegionIssueNotice";
import FragMap from "./FragMap";
import Legend from "./Legend";

export default function FightMap({ matches }: { matches: FightMatch[] }) {
  const maps = useMemo(() => mapsOf(matches), [matches]);
  const seasons = useMemo(() => seasonsOf(matches), [matches]);
  const currentSeason = useMemo(() => currentSeasonOf(matches), [matches]);
  const [map, setMap] = useState(() => {
    const inSeason = matches.filter((m) => m.season === currentSeason);
    return mostPlayedMap(inSeason) || mostPlayedMap(matches) || maps[0] || "";
  });
  const [side, setSide] = useState<Side>("both");
  const [time, setTime] = useState<TimeScope>(() => ({
    kind: "seasons",
    seasons: [currentSeason],
  }));
  const [layer, setLayer] = useState<"dots" | "heatmap">("dots");
  const [zoomedRegion, setZoomedRegion] = useState<number | null>(null);

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(collectDuels(matches, { map, side, time }), calib);
  }, [matches, map, side, time, calib]);
  const transformedCallouts = useMemo(() => {
    if (!calib) return [];
    return getCallouts(map).map((c) => {
      const t = transformCoord(calib, c);
      return {
        regionName: c.regionName,
        superRegionName: c.superRegionName,
        cx: t.nx,
        cy: t.ny,
      };
    });
  }, [map, calib]);
  const calloutRegions = useMemo(
    () => assignRegions(points, transformedCallouts),
    [points, transformedCallouts],
  );

  const polys = useMemo(() => getRegions(map), [map]);
  const frags = useMemo(
    () =>
      polys.length
        ? assignFrags(points, polys)
        : { assignment: [] as number[], flags: [] },
    [points, polys],
  );
  const polyStats = useMemo(
    () =>
      polys.length ? statsFromAssignment(points, polys, frags.assignment) : [],
    [points, polys, frags],
  );
  const issues = useMemo<RegionIssue[]>(
    () =>
      polys.length ? issuesFromFlags(map, points, polys, frags.flags) : [],
    [map, points, polys, frags],
  );
  const polygonMode = polys.length > 0;

  const { regions: regionModel, assignment } = useMemo(
    () => buildRegionModel(points, polyStats, calloutRegions, frags.assignment),
    [points, polyStats, calloutRegions, frags],
  );

  // Filters change the dataset (and region indices) — drop back to the overview.
  const onFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setZoomedRegion(null);
    };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            MAP
          </div>
          <MapPicker maps={maps} value={map} onChange={onFilter(setMap)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            SIDE
          </div>
          <SideToggle value={side} onChange={onFilter(setSide)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            SEASONS
          </div>
          <TimeSelector
            seasons={seasons}
            value={time}
            onChange={onFilter(setTime)}
          />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            LAYER
          </div>
          <div
            role="group"
            aria-label="Layer"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <button
              type="button"
              aria-pressed={layer === "dots"}
              style={chip(layer === "dots")}
              onClick={() => setLayer("dots")}
            >
              Dots
            </button>
            <button
              type="button"
              aria-pressed={layer === "heatmap"}
              style={chip(layer === "heatmap")}
              onClick={() => {
                setLayer("heatmap");
                setZoomedRegion(null);
              }}
            >
              Heatmap
            </button>
          </div>
        </div>
      </div>

      {!calib ? (
        <p style={{ color: "var(--muted)" }}>
          No minimap calibration for {map} yet.
        </p>
      ) : points.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No duels for this filter — try &ldquo;All time&rdquo; or a different
          map.
        </p>
      ) : (
        <>
          {polygonMode && (
            <RegionIssueNotice key={map} map={map} issues={issues} />
          )}
          <div>
            {layer === "heatmap" && zoomedRegion == null ? (
              <RegionView
                image={calib.image}
                mode={polygonMode ? "polygon" : "raster"}
                regions={calloutRegions}
                polyRegions={polyStats}
                points={points}
                selected={null}
                onSelectRegion={(i) => {
                  setZoomedRegion(i);
                  setLayer("dots");
                }}
              />
            ) : (
              <FragMap
                image={calib.image}
                points={points}
                regions={regionModel}
                assignment={assignment}
                zoomedRegion={zoomedRegion}
                onZoom={(ri) => setZoomedRegion(ri)}
                onExitZoom={() => setZoomedRegion(null)}
              />
            )}
            <Legend />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and build**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (`ZoneGrid`, `ZoneDetail`, `RegionDetail` are no longer imported here — they still exist as files; that's fine.)

Run: `pnpm exec vitest run`
Expected: PASS — unit suite unaffected.

- [ ] **Step 4: Migrate the interactive smoke tests**

In `tests/smoke.spec.ts`, replace the `gotoRegions` helper with a `gotoAscent` helper (dots is the default layer, so no view click):

```ts
// Drive a traced map with data. "All time" guarantees the traced map (Ascent)
// has duels regardless of the current season. Dots is the default layer.
async function gotoAscent(page: import("@playwright/test").Page) {
  await page.goto("/fragsmap");
  await page.getByRole("button", { name: "All time" }).click();
  await page.getByRole("button", { name: "Ascent", exact: true }).click();
  await page.waitForLoadState("networkidle");
}
```

Replace the `"FragsMap filter controls expose pressed state"` test with:

```ts
test("FragsMap filter controls expose pressed state", async ({ page }) => {
  await gotoAscent(page);
  // The Layer toggle reflects the active layer via aria-pressed (Dots default).
  await expect(page.getByRole("button", { name: "Dots" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Heatmap" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // The Side group is labelled and its options are toggle buttons.
  await expect(
    page
      .getByRole("group", { name: "Side" })
      .getByRole("button", { name: "Both" }),
  ).toHaveAttribute("aria-pressed", "true");
});
```

Replace the `"clicking a duel dot opens and closes the focus dialog"` test with a version that zooms first (a dot click on the overview zooms; the dialog opens on a dot click **inside** the zoom):

```ts
test("zooming into a region then clicking a dot opens the focus dialog", async ({
  page,
}) => {
  await gotoAscent(page);
  // Overview: a dot click zooms into its region — the breadcrumb appears.
  await page.locator("svg [data-duel]").first().dispatchEvent("click");
  const crumb = page.getByRole("button", { name: /All regions/ });
  await expect(crumb).toBeVisible();
  // Inside the zoom: if dots are clustered, expand a badge first.
  const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
  if ((await badge.count()) > 0) {
    await badge.first().dispatchEvent("click");
  }
  // Click a dot → details dialog opens with focus on Close, then closes.
  await page.locator("svg [data-duel]").last().dispatchEvent("click");
  await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
  // Breadcrumb exits the zoom.
  await crumb.click();
  await expect(page.getByRole("button", { name: /All regions/ })).toHaveCount(
    0,
  );
});
```

Replace the `"overlapping duels cluster into a badge that fans out and opens details"` test with a version that fans **inside a zoom** (badges zoom at the overview; they fan only when zoomed). It zooms via the Heatmap layer so it can try regions one at a time:

```ts
test("inside a zoom, an overlapping cluster fans out and opens details", async ({
  page,
}) => {
  await gotoAscent(page);
  // Switch to Heatmap so we can zoom into regions one at a time.
  await page.getByRole("button", { name: "Heatmap" }).click();
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  let opened = false;
  for (let i = 0; i < n; i++) {
    // Click a region polygon → zooms in (switches to Dots).
    await polys.nth(i).dispatchEvent("click");
    const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
    if ((await badge.count()) > 0) {
      await badge.first().dispatchEvent("click"); // fan out
      const dots = page.locator("svg [data-duel]");
      await expect(dots.first()).toBeVisible();
      await dots.last().dispatchEvent("click");
      await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
      opened = true;
      break;
    }
    // No cluster here — exit the zoom and go back to Heatmap for the next region.
    await page.getByRole("button", { name: /All regions/ }).click();
    await page.getByRole("button", { name: "Heatmap" }).click();
  }
  expect(opened).toBe(true);
});
```

- [ ] **Step 5: Run the full smoke suite**

Run: `pnpm exec playwright test`
Expected: The three migrated tests pass. (Tests still referencing the old Regions/Grid model — `fragsmap region detail shows enriched stats`, `fragsmap region hover shows a tooltip`, `fragsmap shows a non-critical region-issue notice`, `fragsmap legend explains the muted zones` — are migrated in Task 5. They may fail here; that is expected and fixed next.)

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/FragMap.tsx components/fightmap/FightMap.tsx tests/smoke.spec.ts
git commit -m "Full-bleed FragMap with layer toggle and region zoom"
```

---

### Task 5: Deprecate Grid, migrate remaining smoke tests, final green

**Files:**

- Modify: `tests/smoke.spec.ts` (heatmap-dependent tests + legend)
- Verify: `components/fightmap/ZoneGrid.tsx`, `ZoneDetail.tsx`, `RegionDetail.tsx` remain in the repo but unreferenced.

Context: the Grid view and the side-panel drill-ins (`ZoneGrid`, `ZoneDetail`, `RegionDetail`) are no longer rendered. Per the spec they stay in the repo (not deleted), just unwired. The remaining smoke tests that assumed the old Regions side-panel need to move onto the Heatmap layer / new structure.

- [ ] **Step 1: Confirm the deprecated components are unreferenced (kept, not deleted)**

Run: `grep -rn "ZoneGrid\|ZoneDetail\|RegionDetail" components/ app/`
Expected: matches only inside the component files' own definitions (`ZoneGrid.tsx`, `ZoneDetail.tsx`, `RegionDetail.tsx`) — no imports/usages elsewhere. If any stray import remains (e.g. in `FightMap`), remove it. Do not delete the files.

- [ ] **Step 2: Migrate the heatmap tooltip test**

In `tests/smoke.spec.ts`, replace `"fragsmap region hover shows a tooltip"` with a version that selects the Heatmap layer first:

```ts
test("heatmap region hover shows a tooltip", async ({ page }) => {
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
  // SVG polygons need dispatchEvent to reliably fire React's synthetic onMouseMove.
  await page.locator("svg polygon").first().dispatchEvent("mousemove");
  await expect(page.getByRole("tooltip")).toBeVisible();
});
```

- [ ] **Step 3: Migrate the region-issue-notice test**

The notice now renders above the map on `/fragsmap` whenever the map is traced, regardless of layer. Replace `"fragsmap shows a non-critical region-issue notice"` with:

```ts
test("fragsmap shows a non-critical region-issue notice", async ({ page }) => {
  await gotoAscent(page);
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toBeHidden();
});
```

- [ ] **Step 4: Replace the obsolete region-detail test**

The side-panel "enriched stats" (`win rate` / `N duels`) is gone (it becomes the accessible breakdown in Spec 3). Replace `"fragsmap region detail shows enriched stats"` with a test that the **zoom** works from the heatmap:

```ts
test("clicking a heatmap region zooms in", async ({ page }) => {
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
  await page.locator("svg polygon").first().dispatchEvent("click");
  // Zoom shows the breadcrumb and individual duel dots.
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  await expect(page.locator("svg [data-duel]").first()).toBeVisible();
});
```

- [ ] **Step 5: Fix the legend test comment/expectation**

`"fragsmap legend explains the muted zones"` still passes (the Legend renders under the map). Update only its stale comment from "grid view" to "default dots view":

```ts
test("fragsmap legend explains the muted zones", async ({ page }) => {
  await page.goto("/fragsmap");
  // The legend renders under the map on initial load (default dots view).
  await expect(page.getByText(/under 4 duels/i)).toBeVisible();
});
```

- [ ] **Step 6: Full gate — typecheck, lint, unit, smoke, build**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

Run: `pnpm exec eslint .`
Expected: PASS (only the pre-existing MapPicker warning, if any — no new errors).

Run: `pnpm exec vitest run`
Expected: PASS — full unit suite.

Run: `pnpm exec playwright test`
Expected: PASS — all smoke tests green (home-reveal note: if it is still red from the unrelated pre-existing issue, confirm it is unrelated to FragsMap; do not fix it here).

Run: `pnpm build`
Expected: PASS — production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "Deprecate Grid view and migrate FragsMap smoke tests"
```

---

## Notes

- The accessible data layer (a `<table>` breakdown of the zoomed region + focusable duel rows that two-way-sync with the dots, plus `aria-hidden` on decorative SVG) is **Spec 3**, built on this zoomed view.
- Exiting a zoom returns to the Dots overview (not back to Heatmap) by design — the user can re-toggle Heatmap. This keeps the state model simple.
- `WORLD_PER_METER` and cluster constants are untouched.
