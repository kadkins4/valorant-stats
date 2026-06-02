# Region Assignment Robustness + Issue Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FragsMap one canonical per-frag region assignment (overlap → smallest-area zone; outside → nearest-edge zone), shared by the heatmap tally and the drill-in, and surface the resolved cases as a `/dev/issues` list and a soft `/fragsmap` notice.

**Architecture:** A pure `assignFrags(points, regions)` in `lib/maps/regions.ts` returns one region index per frag plus `flags` describing overlaps/snaps. `statsFromAssignment` and the `FightMap` drill-in both read that one assignment (killing today's divergence); `issuesForMap`/`issuesFromFlags` turn flags into `RegionIssue[]` consumed by a dev dashboard page and a client notice component.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), React 19, TypeScript, Vitest (`@/` alias), Playwright smoke (`pnpm exec playwright test`). Package manager: pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-02-region-assignment-issues-design.md`

---

## File Structure

- `lib/maps/regions.ts` (modify) — add `polygonArea`, module-local `distToSegment`/`distToPolygon`, `FragFlag`, `FragAssignment`, `assignFrags`, `statsFromAssignment`, `RegionIssue`, `issuesFromFlags`, `issuesForMap`; reimplement `assignByPolygon` as a wrapper.
- `tests/regions.test.ts` (modify) — unit tests for the above; update the one test that asserts the old "drop outside frags" behavior.
- `components/fightmap/FightMap.tsx` (modify) — compute `assignFrags` once; derive `polyStats` (via `statsFromAssignment`), the drill-in (via `assignment`), and the notice issues.
- `app/dev/issues/page.tsx` (create) — dev-gated server page; computes issues for all traced maps.
- `components/dev/IssuesList.tsx` (create) — client list + zero state.
- `components/dev/RegionEditor.tsx` (modify) — add a cross-link to `/dev/issues`.
- `components/fightmap/RegionIssueNotice.tsx` (create) — the soft, dismissible notice.
- `tests/smoke.spec.ts` (modify) — smoke for the dashboard and the notice.

**Context the implementer needs:**

- `RegionPoly = { name: string; points: [number, number][] }`, `Placed` has `{ nx, ny, won, side, col, row }`, `PolyRegionStat = { name, polygon, cx, cy, wins, total, winRate, muted }`. `MIN_DUELS = 4`. All in `lib/fightmap.ts` / `lib/maps/regions.ts`.
- Existing `pointInPolygon(pt, poly)` (ray cast) stays as-is and is reused.
- `getCalibration(map)` (in `@/lib/maps/calibration`) lowercases its arg and returns `{ name, image, ... } | undefined`; `cal.name` is the **proper-case** map name (e.g. "Ascent").
- `collectDuels(matches, { map, side, time })` matches `m.map === map` **case-sensitively** — pass `cal.name`, not the lowercase registry slug.
- `REGIONS` (from `@/lib/maps/regions/index`) is `Record<lowercaseSlug, RegionPoly[]>`; `getRegions(map)` lowercases and looks up.
- `getFightData()` (from `@/lib/db/queries`) is the async match loader used by `app/fragsmap/page.tsx`.
- Dev gate pattern: see `app/dev/regions/page.tsx` — render a "local dev only" `<main>` when `process.env.NODE_ENV !== "development"`.
- `--accent` is `#ff4655`. Follow the codebase's inline-style convention; `React.CSSProperties` resolves without importing React.

---

### Task 1: `polygonArea` + `assignFrags` engine

**Files:**

- Modify: `lib/maps/regions.ts` (add after `pointInPolygon`, before `assignByPolygon`)
- Test: `tests/regions.test.ts` (add two `describe` blocks)

- [ ] **Step 1: Write the failing tests**

In `tests/regions.test.ts`, extend the import from `@/lib/maps/regions` to add `polygonArea`, `assignFrags`:

```ts
import {
  pointInPolygon,
  assignByPolygon,
  polygonArea,
  assignFrags,
  type RegionPoly,
} from "@/lib/maps/regions";
```

Add these blocks at the end of the file (the `placed` helper and `square` already exist at the top):

```ts
describe("polygonArea", () => {
  it("computes the area of a unit square", () => {
    expect(
      polygonArea([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBeCloseTo(1);
  });
  it("computes the area of a right triangle", () => {
    expect(
      polygonArea([
        [0, 0],
        [1, 0],
        [0, 1],
      ]),
    ).toBeCloseTo(0.5);
  });
});

describe("assignFrags", () => {
  const big: RegionPoly = {
    name: "Big",
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
  const small: RegionPoly = {
    name: "Small",
    points: [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ],
  };

  it("assigns a frag in exactly one region with no flag", () => {
    const r = assignFrags([placed(0.1, 0.1, true)], [big]);
    expect(r.assignment).toEqual([0]);
    expect(r.flags).toEqual([]);
  });

  it("resolves an overlap to the smallest-area region and flags it", () => {
    // (0.5,0.5) is inside both big and small; small (index 1) wins.
    const r = assignFrags([placed(0.5, 0.5, true)], [big, small]);
    expect(r.assignment).toEqual([1]);
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatchObject({
      type: "overlap",
      winner: 1,
      contenders: [0, 1],
    });
  });

  it("snaps an outside frag to the nearest region and flags it", () => {
    // (0.9,0.1) is outside `small`; snapped to it (only region).
    const r = assignFrags([placed(0.9, 0.1, true)], [small]);
    expect(r.assignment).toEqual([0]);
    const f = r.flags[0];
    expect(f.type).toBe("snapped");
    if (f.type === "snapped") expect(f.distance).toBeGreaterThan(0);
  });

  it("returns -1 assignments and no flags when there are no regions", () => {
    const r = assignFrags([placed(0.5, 0.5, true)], []);
    expect(r.assignment).toEqual([-1]);
    expect(r.flags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: FAIL — `polygonArea` / `assignFrags` are not exported.

- [ ] **Step 3: Implement the geometry + engine**

In `lib/maps/regions.ts`, add immediately after the `pointInPolygon` function (it ends around line 34) and before `assignByPolygon`:

```ts
// Shoelace area of a normalized polygon (absolute value).
export function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(a) / 2;
}

// Shortest distance from point p to segment a–b (normalized units).
function distToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

// Nearest distance from a point to a polygon's boundary.
function distToPolygon(p: [number, number], poly: [number, number][]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment(p, poly[j], poly[i]);
    if (d < min) min = d;
  }
  return min;
}

export type FragFlag =
  | {
      type: "overlap";
      pointIndex: number;
      winner: number;
      contenders: number[];
    }
  | { type: "snapped"; pointIndex: number; nearest: number; distance: number };

export interface FragAssignment {
  assignment: number[]; // region index per input point; -1 only if regions is empty
  flags: FragFlag[];
}

// The single source of truth: assign each frag to exactly one region.
// In >1 region (overlap) → smallest-area region wins. In 0 regions (outside) →
// nearest-edge region. Both noteworthy cases are recorded as flags.
export function assignFrags(
  points: Placed[],
  regions: RegionPoly[],
): FragAssignment {
  if (regions.length === 0) {
    return { assignment: points.map(() => -1), flags: [] };
  }
  const areas = regions.map((r) => polygonArea(r.points));
  const assignment: number[] = [];
  const flags: FragFlag[] = [];

  points.forEach((p, pointIndex) => {
    const pt: [number, number] = [p.nx, p.ny];
    const inside: number[] = [];
    for (let i = 0; i < regions.length; i++) {
      if (pointInPolygon(pt, regions[i].points)) inside.push(i);
    }

    if (inside.length === 1) {
      assignment.push(inside[0]);
    } else if (inside.length > 1) {
      let winner = inside[0];
      for (const i of inside) if (areas[i] < areas[winner]) winner = i;
      assignment.push(winner);
      flags.push({ type: "overlap", pointIndex, winner, contenders: inside });
    } else {
      let nearest = 0;
      let best = Infinity;
      for (let i = 0; i < regions.length; i++) {
        const d = distToPolygon(pt, regions[i].points);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      assignment.push(nearest);
      flags.push({ type: "snapped", pointIndex, nearest, distance: best });
    }
  });

  return { assignment, flags };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: PASS for the new blocks. (The existing `assignByPolygon` "ignores points inside no polygon" test still passes here — `assignByPolygon` is unchanged until Task 2.)

- [ ] **Step 5: Commit**

```bash
git add lib/maps/regions.ts tests/regions.test.ts
git commit -m "Adds assignFrags engine with overlap and snap resolution"
```

---

### Task 2: `statsFromAssignment` + refactor `assignByPolygon`

**Files:**

- Modify: `lib/maps/regions.ts` (add `statsFromAssignment`; replace the body of `assignByPolygon`)
- Test: `tests/regions.test.ts` (update one test, add one)

- [ ] **Step 1: Update the tests to the new behavior**

In `tests/regions.test.ts`, **replace** the existing test that asserts the old drop behavior:

```ts
it("ignores points inside no polygon", () => {
  const points = [placed(5, 5, true)];
  const stats = assignByPolygon(points, [left, right]);
  expect(stats[0].total).toBe(0);
  expect(stats[1].total).toBe(0);
});
```

with these two tests (outside frags are now snapped; overlaps count once in the smaller zone):

```ts
it("snaps a point outside every polygon to the nearest one", () => {
  // (5,5) is far outside both; nearest edge is Right's corner (1,1).
  const points = [placed(5, 5, true)];
  const stats = assignByPolygon(points, [left, right]);
  expect(stats[0].total).toBe(0); // Left
  expect(stats[1].total).toBe(1); // Right (nearest)
});

it("counts an overlapping point once, in the smaller zone", () => {
  const big: RegionPoly = {
    name: "Big",
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
  const small: RegionPoly = {
    name: "Small",
    points: [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ],
  };
  const stats = assignByPolygon([placed(0.5, 0.5, true)], [big, small]);
  expect(stats[0].total).toBe(0); // Big
  expect(stats[1].total).toBe(1); // Small
});
```

- [ ] **Step 2: Run the tests to verify the updated one fails**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: FAIL — "snaps a point outside every polygon" fails (current `assignByPolygon` drops the outside point, so `stats[1].total` is 0, not 1).

- [ ] **Step 3: Add `statsFromAssignment` and rewrite `assignByPolygon`**

In `lib/maps/regions.ts`, **replace the entire `assignByPolygon` function** (the current `acc`/`findIndex`/`continue` implementation) with:

```ts
// Build per-region stats from a precomputed assignment (one region index per
// point; negative indices are skipped).
export function statsFromAssignment(
  points: Placed[],
  regions: RegionPoly[],
  assignment: number[],
): PolyRegionStat[] {
  const acc = regions.map(() => ({ wins: 0, total: 0 }));
  assignment.forEach((idx, i) => {
    if (idx < 0) return;
    acc[idx].total++;
    if (points[i].won) acc[idx].wins++;
  });
  return regions.map((r, i) => {
    const cx = r.points.reduce((s, q) => s + q[0], 0) / r.points.length;
    const cy = r.points.reduce((s, q) => s + q[1], 0) / r.points.length;
    return {
      name: r.name,
      polygon: r.points,
      cx,
      cy,
      wins: acc[i].wins,
      total: acc[i].total,
      winRate: acc[i].total ? acc[i].wins / acc[i].total : 0,
      muted: acc[i].total < MIN_DUELS,
    };
  });
}

// Back-compat convenience: assign then tally in one call.
export function assignByPolygon(
  points: Placed[],
  regions: RegionPoly[],
): PolyRegionStat[] {
  const { assignment } = assignFrags(points, regions);
  return statsFromAssignment(points, regions, assignment);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: PASS — the snap + overlap tests pass; the existing bucketing/winRate/muted/centroid tests still pass (their points sit inside exactly one polygon, so behavior is unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/maps/regions.ts tests/regions.test.ts
git commit -m "Routes polygon tally through the shared assignment"
```

---

### Task 3: `RegionIssue` model + `issuesForMap`

**Files:**

- Modify: `lib/maps/regions.ts` (add `RegionIssue`, `issuesFromFlags`, `issuesForMap`)
- Test: `tests/regions.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

In `tests/regions.test.ts`, extend the import to add `issuesForMap`:

```ts
import {
  pointInPolygon,
  assignByPolygon,
  polygonArea,
  assignFrags,
  issuesForMap,
  type RegionPoly,
} from "@/lib/maps/regions";
```

Add at the end of the file:

```ts
describe("issuesForMap", () => {
  const big: RegionPoly = {
    name: "Big",
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
  const small: RegionPoly = {
    name: "Small",
    points: [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ],
  };

  it("returns [] for a clean map", () => {
    expect(issuesForMap("Test", [placed(0.1, 0.1, true)], [big])).toEqual([]);
  });

  it("reports an overlap grouped by contender zones", () => {
    const issues = issuesForMap(
      "Test",
      [placed(0.5, 0.5, true), placed(0.5, 0.5, false)],
      [big, small],
    );
    const ov = issues.find((i) => i.kind === "overlap");
    expect(ov).toMatchObject({
      kind: "overlap",
      zones: ["Big", "Small"],
      winner: "Small",
      count: 2,
    });
  });

  it("reports snapped frags grouped by nearest zone with coords", () => {
    // (0.1,0.1) is outside Small → snapped to Small (only region).
    const issues = issuesForMap("Test", [placed(0.1, 0.1, true)], [small]);
    const sn = issues.find((i) => i.kind === "snapped");
    expect(sn?.kind).toBe("snapped");
    if (sn?.kind === "snapped") {
      expect(sn.zone).toBe("Small");
      expect(sn.count).toBe(1);
      expect(sn.points).toEqual([[0.1, 0.1]]);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: FAIL — `issuesForMap` is not exported.

- [ ] **Step 3: Implement the issue model**

In `lib/maps/regions.ts`, add after `assignByPolygon`:

```ts
export type RegionIssue =
  | {
      kind: "overlap";
      map: string;
      zones: string[];
      winner: string;
      count: number;
    }
  | {
      kind: "snapped";
      map: string;
      zone: string;
      count: number;
      points: [number, number][];
    };

// Group raw flags into human-facing issues. Pure; used by the live notice
// (which already holds flags) and by issuesForMap (the dashboard convenience).
export function issuesFromFlags(
  map: string,
  points: Placed[],
  regions: RegionPoly[],
  flags: FragFlag[],
): RegionIssue[] {
  const overlaps = new Map<
    string,
    { zones: string[]; winner: string; count: number }
  >();
  const snaps = new Map<
    string,
    { count: number; points: [number, number][] }
  >();

  for (const f of flags) {
    if (f.type === "overlap") {
      const zones = f.contenders.map((i) => regions[i].name).sort();
      const key = zones.join(" ⨯ ");
      const g = overlaps.get(key) ?? {
        zones,
        winner: regions[f.winner].name,
        count: 0,
      };
      g.count++;
      overlaps.set(key, g);
    } else {
      const zone = regions[f.nearest].name;
      const g = snaps.get(zone) ?? { count: 0, points: [] };
      g.count++;
      const p = points[f.pointIndex];
      g.points.push([p.nx, p.ny]);
      snaps.set(zone, g);
    }
  }

  const issues: RegionIssue[] = [];
  for (const g of overlaps.values()) {
    issues.push({
      kind: "overlap",
      map,
      zones: g.zones,
      winner: g.winner,
      count: g.count,
    });
  }
  for (const [zone, g] of snaps) {
    issues.push({
      kind: "snapped",
      map,
      zone,
      count: g.count,
      points: g.points,
    });
  }
  return issues;
}

// Convenience for the dashboard: assign + group in one call.
export function issuesForMap(
  map: string,
  points: Placed[],
  regions: RegionPoly[],
): RegionIssue[] {
  return issuesFromFlags(
    map,
    points,
    regions,
    assignFrags(points, regions).flags,
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/regions.test.ts`
Expected: PASS (all `issuesForMap` cases green; earlier blocks still green).

- [ ] **Step 5: Commit**

```bash
git add lib/maps/regions.ts tests/regions.test.ts
git commit -m "Adds region issue model derived from assignment flags"
```

---

### Task 4: Route FightMap through the shared assignment

**Files:**

- Modify: `components/fightmap/FightMap.tsx`

- [ ] **Step 1: Swap the imports**

In `components/fightmap/FightMap.tsx`, change the import from `@/lib/maps/regions` (currently `getRegions, assignByPolygon, pointInPolygon`) to:

```ts
import {
  getRegions,
  assignFrags,
  statsFromAssignment,
} from "@/lib/maps/regions";
```

- [ ] **Step 2: Replace the `polyStats` and `regionPoints` blocks**

Replace this current block:

```tsx
// Hand-traced polygons for this map (empty for untraced maps → raster).
const polys = useMemo(() => getRegions(map), [map]);
const polyStats = useMemo(
  () => (polys.length ? assignByPolygon(points, polys) : []),
  [points, polys],
);
const polygonMode = polys.length > 0;

// Duels whose nearest callout is the selected region, for the drill-in.
const regionPoints = useMemo(() => {
  if (selectedRegion == null) return [];
  // Polygon mode: filter by point-in-polygon against the selected region.
  if (polygonMode) {
    const sel = polyStats[selectedRegion];
    if (!sel) return [];
    return points.filter((p) => pointInPolygon([p.nx, p.ny], sel.polygon));
  }
  if (!transformedCallouts.length) return [];
  return points.filter((p) => {
    let best = 0;
    let bestD = Infinity;
    transformedCallouts.forEach((c, i) => {
      const d = (c.cx - p.nx) ** 2 + (c.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best === selectedRegion;
  });
}, [points, transformedCallouts, selectedRegion, polygonMode, polyStats]);
```

with:

```tsx
// Hand-traced polygons for this map (empty for untraced maps → raster).
const polys = useMemo(() => getRegions(map), [map]);
// One canonical assignment feeds the tally AND the drill-in (no divergence).
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
const polygonMode = polys.length > 0;

// Duels attributed to the selected region, for the drill-in.
const regionPoints = useMemo(() => {
  if (selectedRegion == null) return [];
  // Polygon mode: same assignment that drives the tally — dots match counts.
  if (polygonMode) {
    return points.filter((_, i) => frags.assignment[i] === selectedRegion);
  }
  if (!transformedCallouts.length) return [];
  return points.filter((p) => {
    let best = 0;
    let bestD = Infinity;
    transformedCallouts.forEach((c, i) => {
      const d = (c.cx - p.nx) ** 2 + (c.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best === selectedRegion;
  });
}, [points, transformedCallouts, selectedRegion, polygonMode, frags]);
```

- [ ] **Step 3: Typecheck, build, and run the full suites**

Run: `pnpm exec tsc --noEmit` → Expected: clean (no unused `assignByPolygon`/`pointInPolygon` imports remain; `frags` is used).
Run: `pnpm build` → Expected: succeeds.
Run: `pnpm test` → Expected: all vitest suites pass.
Run: `pnpm exec playwright test` → Expected: all smoke tests pass — including the existing "fragsmap region detail shows enriched stats" (the drill-in now reads `assignment`, but clicking a polygon still opens the panel; the contract is preserved).

This task is a behavior-preserving refactor for the in-zone case (and a correctness improvement for outside/overlap frags); it is covered by the unit tests from Tasks 1–3 plus the existing smoke. No new test here.

- [ ] **Step 4: Commit**

```bash
git add components/fightmap/FightMap.tsx
git commit -m "Routes FightMap tally and drill-in through one assignment"
```

---

### Task 5: `/dev/issues` dashboard

**Files:**

- Create: `app/dev/issues/page.tsx`
- Create: `components/dev/IssuesList.tsx`
- Modify: `components/dev/RegionEditor.tsx` (cross-link)
- Test: `tests/smoke.spec.ts` (add one test)

- [ ] **Step 1: Write the failing smoke test**

Add to the end of `tests/smoke.spec.ts`:

```ts
test("dev region issues page renders", async ({ page }) => {
  // Dev-gated; the smoke server runs in development.
  await page.goto("/dev/issues");
  await expect(
    page.getByRole("heading", { name: "Region issues" }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test tests/smoke.spec.ts -g "region issues page renders"`
Expected: FAIL — `/dev/issues` does not exist (404, no heading).

- [ ] **Step 3: Create the client list component**

Create `components/dev/IssuesList.tsx`:

```tsx
"use client";
import type { RegionIssue } from "@/lib/maps/regions";

export default function IssuesList({ issues }: { issues: RegionIssue[] }) {
  if (issues.length === 0) {
    return (
      <p style={{ color: "var(--muted)", marginTop: 24 }}>
        No region issues 🎉
      </p>
    );
  }
  const maps = new Set(issues.map((i) => i.map));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
        {issues.length} issue{issues.length === 1 ? "" : "s"} across {maps.size}{" "}
        map
        {maps.size === 1 ? "" : "s"}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {issues.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#0e1218",
              border: "1px solid #222a38",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            <span aria-hidden style={{ color: "#e0a23c" }}>
              ⚠
            </span>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{it.map}</span>
            <span style={{ color: "var(--muted)", minWidth: 64 }}>
              {it.kind === "overlap" ? "Overlap" : "Snapped"}
            </span>
            <span style={{ flex: 1 }}>
              {it.kind === "overlap" ? (
                <>
                  {it.zones.join(" ⨯ ")} · {it.count} frag
                  {it.count === 1 ? "" : "s"} → {it.winner}
                </>
              ) : (
                <>
                  {it.count} frag{it.count === 1 ? "" : "s"} outside zones →{" "}
                  {it.zone}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the dev-gated page**

Create `app/dev/issues/page.tsx`:

```tsx
import Link from "next/link";
import { getFightData } from "@/lib/db/queries";
import { getCalibration } from "@/lib/maps/calibration";
import { collectDuels, placeDuels } from "@/lib/fightmap";
import { REGIONS } from "@/lib/maps/regions/index";
import { getRegions, issuesForMap, type RegionIssue } from "@/lib/maps/regions";
import IssuesList from "@/components/dev/IssuesList";

export default async function RegionIssuesPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
        <p style={{ color: "var(--muted)" }}>
          This authoring tool is only available in local dev.
        </p>
      </main>
    );
  }

  const matches = await getFightData();
  const issues: RegionIssue[] = [];
  for (const slug of Object.keys(REGIONS)) {
    const cal = getCalibration(slug);
    if (!cal) continue;
    const regions = getRegions(slug);
    if (!regions.length) continue;
    const points = placeDuels(
      collectDuels(matches, {
        map: cal.name,
        side: "both",
        time: { kind: "all" },
      }),
      cal,
    );
    issues.push(...issuesForMap(cal.name, points, regions));
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ marginBottom: 4 }}>Region issues</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
        Dev-only. Frags resolved by overlap, or snapped in from outside a zone —
        adjust polygons in the{" "}
        <Link href="/dev/regions" style={{ color: "var(--accent)" }}>
          region editor
        </Link>
        .
      </p>
      <IssuesList issues={issues} />
    </main>
  );
}
```

- [ ] **Step 5: Add the reverse cross-link in the editor**

In `components/dev/RegionEditor.tsx`, immediately after the dev-only description paragraph (the `<p>` that ends `...export per-map JSON.</p>`, around line 188), insert:

```tsx
<p style={{ marginTop: 8, fontSize: 13 }}>
  <a href="/dev/issues" style={{ color: "var(--accent)" }}>
    View region issues →
  </a>
</p>
```

- [ ] **Step 6: Run the smoke test + typecheck**

Run: `pnpm exec playwright test tests/smoke.spec.ts -g "region issues page renders"`
Expected: PASS — the heading renders.
Run: `pnpm exec tsc --noEmit` → Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/dev/issues/page.tsx components/dev/IssuesList.tsx components/dev/RegionEditor.tsx tests/smoke.spec.ts
git commit -m "Adds dev region issues dashboard"
```

---

### Task 6: `/fragsmap` issue notice

**Files:**

- Create: `components/fightmap/RegionIssueNotice.tsx`
- Modify: `components/fightmap/FightMap.tsx` (compute `issues`, render the notice in the Regions view)
- Test: `tests/smoke.spec.ts` (add one test)

- [ ] **Step 1: Write the failing smoke test**

Add to the end of `tests/smoke.spec.ts` (reuses the `gotoRegions` helper defined earlier in the file):

```ts
test("fragsmap shows a non-critical region-issue notice", async ({ page }) => {
  // Ascent all-time almost always has frags that fall between/over zones.
  // (If a future trace fully tiles Ascent, swap to another map that /dev/issues
  // reports as having issues.)
  await gotoRegions(page);
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  // Dismiss hides it.
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toBeHidden();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test tests/smoke.spec.ts -g "non-critical region-issue notice"`
Expected: FAIL — no `role="status"` notice exists yet.

- [ ] **Step 3: Create the notice component**

Create `components/fightmap/RegionIssueNotice.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { RegionIssue } from "@/lib/maps/regions";

export default function RegionIssueNotice({
  map,
  issues,
}: {
  map: string;
  issues: RegionIssue[];
}) {
  const key = `fragsmap.issue-notice.dismissed.${map}`;
  // Start hidden so SSR/first paint never flashes; reveal after reading session.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(key) === "1");
  }, [key]);

  if (issues.length === 0 || dismissed) return null;

  // Short "where it went" summary (top few by appearance).
  const parts = issues
    .map((i) =>
      i.kind === "snapped"
        ? `${i.count} near ${i.zone}`
        : `${i.count} in ${i.winner}`,
    )
    .slice(0, 3);

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "rgba(255,70,85,0.08)",
        border: "1px solid rgba(255,70,85,0.28)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 12,
        fontSize: 13,
        color: "#cfd6e4",
      }}
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: "18px" }}>
        ⓘ
      </span>
      <span style={{ flex: 1 }}>
        A few frags here landed between zones — we&rsquo;ve counted them in the
        nearest one{parts.length ? <> ({parts.join(", ")})</> : null}.
        Nothing&rsquo;s missing; your totals are complete.
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem(key, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: "16px",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Compute issues + render the notice in `FightMap`**

In `components/fightmap/FightMap.tsx`:

(a) Extend the `@/lib/maps/regions` import (from Task 4) to also bring in the issue helpers:

```ts
import {
  getRegions,
  assignFrags,
  statsFromAssignment,
  issuesFromFlags,
  type RegionIssue,
} from "@/lib/maps/regions";
```

(b) Add the import for the notice component (near the other `./` component imports):

```ts
import RegionIssueNotice from "./RegionIssueNotice";
```

(c) After the `polyStats` memo, add an `issues` memo (reuses the already-computed `frags.flags` — no second assignment pass):

```tsx
const issues = useMemo<RegionIssue[]>(
  () => (polys.length ? issuesFromFlags(map, points, polys, frags.flags) : []),
  [map, points, polys, frags],
);
```

(d) In the `view === "regions"` branch of the returned JSX, wrap it so the notice renders above the grid. Change:

```tsx
      ) : view === "regions" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
```

to:

```tsx
      ) : view === "regions" ? (
        <>
          <RegionIssueNotice map={map} issues={issues} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
```

and add a matching closing `</>` after that grid `</div>` (before the `) : (` that begins the grid-view branch):

```tsx
          </div>
        </>
      ) : (
```

- [ ] **Step 5: Run the smoke test**

Run: `pnpm exec playwright test tests/smoke.spec.ts -g "non-critical region-issue notice"`
Expected: PASS — the notice shows on Ascent (Regions, all-time) and hides on dismiss.

If it FAILS only because Ascent has no flagged frags against the current snapshot (the notice never appears): open `/dev/issues` (or check the `issuesForMap` output) to find a traced map that does have issues, and use that map in the test's `gotoRegions`-equivalent navigation instead. Report this substitution as a DONE_WITH_CONCERNS note.

- [ ] **Step 6: Run the full gate**

Run: `pnpm exec tsc --noEmit` → clean.
Run: `pnpm lint` → no errors (a `@next/next/no-img-element` warning elsewhere is accepted).
Run: `pnpm build` → succeeds.
Run: `pnpm test` → all vitest pass.
Run: `pnpm exec playwright test` → all smoke pass.

- [ ] **Step 7: Commit**

```bash
git add components/fightmap/RegionIssueNotice.tsx components/fightmap/FightMap.tsx tests/smoke.spec.ts
git commit -m "Adds non-critical region-issue notice to FragsMap"
```

---

## Self-Review

**1. Spec coverage:**

- §3.1 `assignFrags` (smallest-area overlap, nearest-edge snap, `-1` for empty), `polygonArea`, point-to-segment → Task 1. ✓
- §3.2 `statsFromAssignment`, `assignByPolygon` wrapper, FightMap one-assignment drill-in/tally → Tasks 2 + 4. ✓
- §3.3 `RegionIssue`, `issuesFromFlags`/`issuesForMap` grouping → Task 3. ✓
- §3.4 `/dev/issues` dev-gated page (all maps, all-time/both-side via `getFightData`), list + zero state, editor cross-link → Task 5. ✓
- §3.5 `/fragsmap` soft, dismissible-per-session notice naming zones, Regions view only, both issue types → Task 6. ✓
- §5 tests: unit (`polygonArea`, `assignFrags`, snap/overlap tally, `issuesForMap`) → Tasks 1–3; smoke (dashboard renders, notice shows+dismisses) → Tasks 5–6; the old "drop" test updated → Task 2. ✓
- §6 scope: no region editing (Effort B), no deep-linking, no severity levels, no distance cap, raster path untouched — honored. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. The Task 6 notice test has a documented data-contingency (with a concrete fallback procedure), not a placeholder. ✓

**3. Type consistency:** `assignFrags → { assignment: number[]; flags: FragFlag[] }` (Task 1) is consumed by `statsFromAssignment(points, regions, assignment)` (Task 2), `issuesFromFlags(map, points, regions, flags)` (Task 3), and `FightMap` (Tasks 4, 6). `RegionIssue` (Task 3) is consumed by `IssuesList` (Task 5) and `RegionIssueNotice` (Task 6). `issuesForMap(map, points, regions)` (Task 3) is called by the dashboard with `cal.name` (Task 5). Names match across tasks. ✓
