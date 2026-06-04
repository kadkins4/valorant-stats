# Duel-Cluster Fan-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cluster near-overlapping duel dots in the FragsMap drill-in into a count badge, fan them out on click as individually selectable handles, and keep each duel's engagement geometry + a single gray marker anchored to its real death location.

**Architecture:** A pure, data-agnostic `lib/cluster.ts` groups placed duels by a fixed on-screen overlap radius (`clusterDuels`) and lays fanned handles on a ring (`fanPositions`). `DuelMap.tsx` consumes the clusters: singletons render as today; multi-member clusters render a badge that, when clicked, fans its members out (handles + faint leaders from each duel's real spot), with the hovered/focused member's single gray real-spot node and the existing `Engagement` (which already draws from real coordinates). No data-derived tuning anywhere.

**Tech Stack:** Next.js 16 + React 19 + TS, Vitest (`@/` alias), Playwright smoke, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-03-duel-cluster-fanout-design.md`

---

## File Structure

- **Create** `lib/cluster.ts` — `CLUSTER_RADIUS`, `FAN_RADIUS`, `Cluster`, `clusterDuels(points, radius?)`, `fanPositions(cx, cy, n, fanRadius?)`. Pure, no React.
- **Create** `tests/cluster.test.ts` — unit tests for both functions.
- **Modify** `components/fightmap/DuelMap.tsx` — render clusters (badge / fan), active gray node, reuse `Engagement` + dialog + Esc/reset.
- **Modify** `tests/smoke.spec.ts` — cluster fan-out smoke; confirm the existing focus-dialog smoke still passes.

No CSS changes: the new badge/leader/gray-node visuals use inline SVG attributes (matching how `DuelMap` already inlines dot styling); the existing `DuelMap.module.css` classes (`.tracer`, `.dialog`, etc.) are reused unchanged.

Work happens on the `duel-cluster-fanout` branch (already checked out; spec committed at `03fd214`).

---

## Task 1: Pure clustering module

**Files:**

- Create: `lib/cluster.ts`
- Test: `tests/cluster.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/cluster.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { clusterDuels, fanPositions, CLUSTER_RADIUS } from "@/lib/cluster";

// Points carry normalized nx,ny in 0..1; clustering happens in viewBox units (×100).
const P = (nx: number, ny: number) => ({ nx, ny });

describe("clusterDuels", () => {
  it("returns one singleton cluster per isolated dot", () => {
    const cs = clusterDuels([P(0.1, 0.1), P(0.8, 0.8)]);
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.members.length === 1)).toBe(true);
  });

  it("groups two dots within CLUSTER_RADIUS into one cluster with the centroid", () => {
    // (50,50) and (51,50) in viewBox units → distance 1 < CLUSTER_RADIUS
    const cs = clusterDuels([P(0.5, 0.5), P(0.51, 0.5)]);
    expect(cs).toHaveLength(1);
    expect(cs[0].members).toEqual([0, 1]);
    expect(cs[0].cx).toBeCloseTo(50.5, 5);
    expect(cs[0].cy).toBeCloseTo(50, 5);
  });

  it("keeps dots beyond the radius separate", () => {
    // (50,50) and (60,50) → distance 10 > CLUSTER_RADIUS
    const cs = clusterDuels([P(0.5, 0.5), P(0.6, 0.5)]);
    expect(cs).toHaveLength(2);
  });

  it("single-links a chain A-B-C into one cluster of 3", () => {
    // each adjacent pair within radius (2 units apart), ends 4 apart
    const cs = clusterDuels([P(0.5, 0.5), P(0.52, 0.5), P(0.54, 0.5)]);
    expect(cs).toHaveLength(1);
    expect(cs[0].members).toEqual([0, 1, 2]);
  });

  it("separates a far singleton from a near pair", () => {
    const cs = clusterDuels([P(0.5, 0.5), P(0.51, 0.5), P(0.9, 0.9)]);
    const sizes = cs.map((c) => c.members.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it("handles empty input", () => {
    expect(clusterDuels([])).toEqual([]);
  });

  it("is deterministic: clusters sorted by first member index, members ascending", () => {
    const cs = clusterDuels([P(0.9, 0.9), P(0.1, 0.1), P(0.11, 0.1)]);
    // member 0 is the lone far dot; members 1,2 are the near pair
    expect(cs[0].members).toEqual([0]);
    expect(cs[1].members).toEqual([1, 2]);
  });
});

describe("fanPositions", () => {
  it("returns n points equidistant (FAN_RADIUS) from the center", () => {
    const pts = fanPositions(50, 50, 4);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      const d = Math.hypot(p.x - 50, p.y - 50);
      expect(d).toBeCloseTo(6, 5); // default FAN_RADIUS
    }
  });

  it("starts at the top and goes clockwise", () => {
    const [first] = fanPositions(50, 50, 2);
    expect(first.x).toBeCloseTo(50, 5);
    expect(first.y).toBeCloseTo(44, 5); // top = cy - FAN_RADIUS
  });

  it("collapses to the center for n<=1", () => {
    expect(fanPositions(10, 20, 1)).toEqual([{ x: 10, y: 20 }]);
  });

  it("respects an explicit fanRadius", () => {
    const [p] = fanPositions(0, 0, 2, 10);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5);
  });
});

it("CLUSTER_RADIUS is a fixed visual constant (~2× dot radius)", () => {
  expect(CLUSTER_RADIUS).toBeCloseTo(3.2, 5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/cluster.test.ts`
Expected: FAIL (module `@/lib/cluster` not found).

- [ ] **Step 3: Implement** (`lib/cluster.ts`)

```ts
// Pure, data-agnostic clustering of FragsMap duel dots by on-screen proximity.
// All distances are in the SVG viewBox space (0..100); points come in with
// normalized nx,ny (0..1) and are scaled by 100 here.

// Two dots (radius 1.6 in viewBox units) visually overlap when their centers are
// within ~2× the radius. This is a fixed visual constant — NOT derived from data.
export const CLUSTER_RADIUS = 3.2;

// Ring radius used to fan a cluster's handles out when expanded. Fixed visual constant.
export const FAN_RADIUS = 6;

export interface Cluster {
  members: number[]; // indices into the source points array
  cx: number; // centroid x in viewBox units (0..100)
  cy: number; // centroid y in viewBox units (0..100)
}

// Single-linkage union-find: any two points within `radius` join the same cluster
// (transitive chains allowed). Deterministic: members ascending, clusters sorted by
// first member index. Singletons are returned as clusters of length 1.
export function clusterDuels(
  points: { nx: number; ny: number }[],
  radius = CLUSTER_RADIUS,
): Cluster[] {
  const n = points.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const px = points.map((p) => p.nx * 100);
  const py = points.map((p) => p.ny * 100);
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = px[i] - px[j];
      const dy = py[i] - py[j];
      if (dx * dx + dy * dy <= r2) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(i);
    else groups.set(root, [i]);
  }

  const clusters: Cluster[] = [...groups.values()].map((members) => {
    members.sort((a, b) => a - b);
    let sx = 0;
    let sy = 0;
    for (const i of members) {
      sx += px[i];
      sy += py[i];
    }
    return { members, cx: sx / members.length, cy: sy / members.length };
  });
  clusters.sort((a, b) => a.members[0] - b.members[0]);
  return clusters;
}

// n evenly-spaced points on a circle of radius `fanRadius` around (cx,cy),
// starting at the top and going clockwise. Deterministic ordering.
export function fanPositions(
  cx: number,
  cy: number,
  n: number,
  fanRadius = FAN_RADIUS,
): { x: number; y: number }[] {
  if (n <= 1) return [{ x: cx, y: cy }];
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    out.push({
      x: cx + fanRadius * Math.cos(a),
      y: cy + fanRadius * Math.sin(a),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/cluster.test.ts` → PASS. Then `pnpm exec tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/cluster.ts tests/cluster.test.ts
git commit -m "Add pure duel-cluster + fan-position helpers"
```

---

## Task 2: DuelMap clustering, badge, and fan-out

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`

This task replaces the dot-rendering portion of `DuelMap` with cluster-aware rendering. The `hasPos` guard, `Engagement`, `Row`, the dialog block, the corner-placement math, the Esc handler, and the `points`-change reset all stay — only the rendering of dots and the new `expanded` state are added. Below is the COMPLETE new file.

- [ ] **Step 1: Replace `components/fightmap/DuelMap.tsx` with:**

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import type { Placed } from "@/lib/fightmap";
import { clusterDuels, fanPositions } from "@/lib/cluster";
import styles from "./DuelMap.module.css";

const GREEN = "#5fd07a";
const RED = "#e35d6a";
const ENEMY = "#ff8e5e";
const GOLD = "#ffd166";
const GRAY = "#5a6273";

const hasPos = (p?: Placed) =>
  !!p && p.mnx != null && p.mny != null && p.enx != null && p.eny != null;

export default function DuelMap({
  image,
  points,
  overlay,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null); // cluster index

  // Esc unfocuses and collapses any fan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocused(null);
        setExpanded(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clusters = useMemo(() => clusterDuels(points), [points]);

  // Reset selection/fan when the dot set changes (e.g. switching zones). Render-time
  // adjustment is React's recommended pattern for "reset state when a prop changes".
  const [prevPoints, setPrevPoints] = useState(points);
  if (points !== prevPoints) {
    setPrevPoints(points);
    setFocused(null);
    setHovered(null);
    setExpanded(null);
  }

  // Handle positions for the currently expanded cluster (index -> viewBox point).
  const handlePos = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    const c = expanded != null ? clusters[expanded] : undefined;
    if (c) {
      const pts = fanPositions(c.cx, c.cy, c.members.length);
      c.members.forEach((idx, k) => map.set(idx, pts[k]));
    }
    return map;
  }, [expanded, clusters]);

  const renderPos = (i: number) => {
    const h = handlePos.get(i);
    return h
      ? { x: h.x, y: h.y }
      : { x: points[i].nx * 100, y: points[i].ny * 100 };
  };

  const active = focused ?? hovered;
  const fp = focused != null ? points[focused] : null;

  // Dialog pins to the corner opposite the engagement centroid.
  const ex = fp ? (hasPos(fp) ? (fp.mnx! + fp.enx!) / 2 : fp.nx) : 0.5;
  const ey = fp ? (hasPos(fp) ? (fp.mny! + fp.eny!) / 2 : fp.ny) : 0.5;
  const corner: React.CSSProperties = {
    [ex < 0.5 ? "right" : "left"]: 10,
    [ey < 0.5 ? "bottom" : "top"]: 10,
  };

  const dot = (i: number) => {
    const p = points[i];
    const { x, y } = renderPos(i);
    const dim = focused == null && hovered != null && hovered !== i;
    return (
      <circle
        key={i}
        cx={x}
        cy={y}
        r="1.6"
        fill={p.won ? GREEN : RED}
        stroke="#11151d"
        strokeWidth="0.3"
        opacity={dim ? 0.18 : 1}
        style={{ cursor: "pointer", transition: "opacity .12s" }}
        onMouseEnter={() => setHovered(i)}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (focused === i) {
            setFocused(null);
            setExpanded(null); // collapse on unfocus
          } else {
            setFocused(i);
          }
        }}
      />
    );
  };

  // Gray real-spot node + leader for a displaced (fanned) member.
  const grayNode = (i: number) => (
    <g pointerEvents="none">
      <line
        x1={points[i].nx * 100}
        y1={points[i].ny * 100}
        x2={renderPos(i).x}
        y2={renderPos(i).y}
        stroke="#2c3447"
        strokeWidth="0.5"
      />
      <circle
        cx={points[i].nx * 100}
        cy={points[i].ny * 100}
        r="0.9"
        fill={GRAY}
      />
    </g>
  );

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        className={styles.svg}
        onClick={() => {
          setFocused(null);
          setExpanded(null);
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
        {overlay}

        {focused != null ? (
          <>
            {handlePos.has(focused) && grayNode(focused)}
            {dot(focused)}
          </>
        ) : (
          clusters.map((c, ci) => {
            if (c.members.length === 1) return dot(c.members[0]);
            if (expanded !== ci) {
              return (
                <g
                  key={`b${ci}`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(ci);
                  }}
                >
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r="2.5"
                    fill="#161b26"
                    stroke={GOLD}
                    strokeWidth="0.5"
                  />
                  <text
                    x={c.cx}
                    y={c.cy}
                    dy="0.95"
                    fontSize="2.8"
                    fill={GOLD}
                    textAnchor="middle"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {c.members.length}
                  </text>
                </g>
              );
            }
            // expanded: leaders from each real spot to its handle, active gray node, handles
            return (
              <g key={`c${ci}`}>
                {c.members.map((idx) => (
                  <line
                    key={`l${idx}`}
                    x1={points[idx].nx * 100}
                    y1={points[idx].ny * 100}
                    x2={renderPos(idx).x}
                    y2={renderPos(idx).y}
                    stroke="#222a38"
                    strokeWidth="0.4"
                    pointerEvents="none"
                  />
                ))}
                {active != null &&
                  c.members.includes(active) &&
                  grayNode(active)}
                {c.members.map((idx) => dot(idx))}
              </g>
            );
          })
        )}

        {active != null && hasPos(points[active]) && (
          <Engagement p={points[active]} />
        )}
      </svg>
      {fp && (
        <div className={styles.dialog} style={corner}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => {
              setFocused(null);
              setExpanded(null);
            }}
          >
            ✕
          </button>
          <span className={styles.out} data-win={fp.won}>
            {fp.won ? "KILL" : "DEATH"}
          </span>
          <Row
            k="Round"
            v={`${fp.round ?? "—"} · ${fp.side === "attack" ? "⚔ Attack" : "🛡 Defense"}`}
          />
          {fp.weapon && <Row k="Weapon" v={fp.weapon} />}
          {fp.dist != null && <Row k="Distance" v={`${fp.dist} m`} />}
          {(fp.agent || fp.enemyAgent) && <div className={styles.sep} />}
          {fp.agent && <Row k="You" v={fp.agent} />}
          {fp.enemyAgent && <Row k="Enemy" v={fp.enemyAgent} />}
        </div>
      )}
    </div>
  );
}

function Engagement({ p }: { p: Placed }) {
  // Dashes flow from survivor toward the loser. won → loser is the enemy.
  const survivor = p.won ? [p.mnx!, p.mny!] : [p.enx!, p.eny!];
  const loser = p.won ? [p.enx!, p.eny!] : [p.mnx!, p.mny!];
  return (
    <g pointerEvents="none">
      <line
        x1={survivor[0] * 100}
        y1={survivor[1] * 100}
        x2={loser[0] * 100}
        y2={loser[1] * 100}
        stroke={GOLD}
        strokeWidth="0.6"
        className={styles.tracer}
      />
      <circle
        cx={p.mnx! * 100}
        cy={p.mny! * 100}
        r="1.6"
        fill={GREEN}
        stroke="#11151d"
        strokeWidth="0.3"
      />
      <circle
        cx={p.enx! * 100}
        cy={p.eny! * 100}
        r="2"
        fill="none"
        stroke={ENEMY}
        strokeWidth="0.9"
      />
    </g>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rk}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec eslint components/fightmap/DuelMap.tsx`
Expected: clean. (Note: React 19 lint forbids `setState` inside an effect and ref-mutation during render — this file uses neither; the `points`-reset is render-time, as before.)

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add components/fightmap/DuelMap.tsx
git commit -m "Cluster overlapping duel dots into a badge that fans out"
```

---

## Task 3: Smoke test — cluster badge fans out

**Files:**

- Modify: `tests/smoke.spec.ts`

- [ ] **Step 1: Add the test** (uses the existing `gotoRegions` helper)

```ts
test("overlapping duels cluster into a badge that fans out and opens details", async ({
  page,
}) => {
  await gotoRegions(page);
  await page.waitForLoadState("networkidle");
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  // Open regions until one shows a cluster badge (gold-stroked circle in the detail).
  let opened = false;
  for (let i = 0; i < n; i++) {
    await polys.nth(i).dispatchEvent("click");
    const badge = page.locator('svg circle[stroke="#ffd166"]');
    if ((await badge.count()) > 0) {
      const dotsBefore = await page
        .locator('svg circle[fill="#5fd07a"], svg circle[fill="#e35d6a"]')
        .count();
      await badge.first().dispatchEvent("click");
      // Fan revealed at least one selectable duel dot.
      const dots = page.locator(
        'svg circle[fill="#5fd07a"], svg circle[fill="#e35d6a"]',
      );
      await expect(dots.first()).toBeVisible();
      expect(await dots.count()).toBeGreaterThanOrEqual(dotsBefore);
      // Click a fanned dot → details dialog opens, then closes.
      await dots.last().dispatchEvent("click");
      await expect(page.getByText(/^(KILL|DEATH)$/).first()).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText(/^(KILL|DEATH)$/)).toHaveCount(0);
      opened = true;
      break;
    }
  }
  expect(opened).toBe(true);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec playwright test -g "fans out"`
Expected: PASS. If the gold-stroke selector matches a non-badge circle (e.g. a legend swatch), scope it to the detail panel (e.g. by clicking a polygon first, the detail SVG is the one containing the dots) or filter more specifically; adjust until green. If NO region on the default map yields a badge (unlikely given near-overlaps), iterate the map picker to a busier map (e.g. Split) before the loop.

- [ ] **Step 3: Confirm the existing focus-dialog smoke still passes**

The earlier "clicking a duel dot opens and closes the focus dialog" test clicks a filled green/red dot directly; singletons remain directly clickable, so it should still pass. Verify:

Run: `pnpm exec playwright test -g "focus dialog"`
Expected: PASS. If it fails because its region now renders that dot inside a badge, update that test to click `svg circle[stroke="#ffd166"]` (the badge) first, then click a revealed dot.

- [ ] **Step 4: Run the full suites**

Run: `pnpm exec vitest run` and `pnpm exec playwright test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "Smoke-test the duel cluster fan-out"
```

---

## Final verification

- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm exec eslint .` — clean (or only the pre-existing accepted `MapPicker` `no-img-element` warning).
- [ ] `pnpm exec vitest run` — all unit tests pass (cluster + transform + fightmap + existing).
- [ ] `pnpm exec playwright test` — all smoke pass incl. the new fan-out test and the existing focus-dialog test.
- [ ] `pnpm build` — production build succeeds.
- [ ] Manual: FragsMap → Regions → a busy zone shows count badges on piled spots; click a badge → handles fan out; hover a handle → exactly one gray real-spot node + the engagement drawn from the real spot, other handles dim; click a handle → details dialog; collapse via Esc / empty-map / re-click. Reduced motion unaffected (no fan animation).
