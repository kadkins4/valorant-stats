# FragsMap Accessible Data Layer (Spec 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FragsMap a complete keyboard / screen-reader path via one context-aware breakdown table that mirrors the map (regions in overview, duels when zoomed), two-way selection sync between the table and the dots, and `aria-hidden` on the decorative SVG.

**Architecture:** A new pure module (`lib/fightmap/breakdown.ts`) builds the table rows + accessible label strings. A thin presentational `BreakdownTable` renders them. `FightMap` owns the new `focusedDuel` state, derives the rows, renders the table, and threads the focused-duel selection through `FragMap` into `DuelMap`, whose focus becomes controlled. The zoomed duel list is derived with the _identical_ pure filter in `FightMap` (for the table) and `FragMap` (for the dots), so a row index and a dot index always refer to the same duel.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), React 19, TypeScript, Vitest (node env, `@/` alias = repo root), Playwright smoke. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-06-04-fragsmap-accessible-data-layer-design.md`

**Commands:**

- Targeted unit test: `pnpm exec vitest run tests/breakdown.test.ts`
- Full unit suite: `pnpm exec vitest run`
- Typecheck: `pnpm exec tsc --noEmit`
- Smoke: `TEST_PORT=3001 pnpm exec playwright test` (the Playwright config reads `process.env.TEST_PORT ?? "3000"`; the worktree shares localhost 3000 with the main dev server, so always set `TEST_PORT=3001`)

**Testing note (read before Task 2):** Vitest runs in the **node** environment with no jsdom/RTL, so React components cannot be rendered in unit tests — only pure functions are unit-tested. All component behavior is verified by `pnpm exec tsc --noEmit` (types) and by the Playwright smoke tests in Task 5. This is the established pattern in this repo; do not add jsdom or React Testing Library.

---

### Task 1: Pure row builders (`lib/fightmap/breakdown.ts`)

**Files:**

- Create: `lib/fightmap/breakdown.ts`
- Test: `tests/breakdown.test.ts`

Context: `RegionModel` (in `lib/fightmap/regionModel.ts`) is `{ name: string; winRate: number; muted: boolean; polygon: [number,number][] | null; cx: number; cy: number }` where `cx`/`cy` are the normalized centroid (0..1) and `muted` means below `MIN_DUELS` (= 4) duels. `assignment: number[]` gives the region index per point (`-1` only when there are no regions). `Placed` (in `lib/fightmap.ts`) has `{ won: boolean; weapon?: string; round?: number; enemyAgent?: string; ... }`. The builders are pure and produce both the data and the accessible-name strings so the table component stays logic-free.

- [ ] **Step 1: Write the failing test**

Create `tests/breakdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resultBand,
  buildRegionRows,
  buildDuelRows,
} from "@/lib/fightmap/breakdown";
import type { RegionModel } from "@/lib/fightmap/regionModel";
import type { Placed } from "@/lib/fightmap";

const region = (over: Partial<RegionModel>): RegionModel => ({
  name: "R",
  winRate: 0.5,
  muted: false,
  polygon: null,
  cx: 0.5,
  cy: 0.5,
  ...over,
});

const duel = (over: Partial<Placed>): Placed => ({
  nx: 0.5,
  ny: 0.5,
  won: true,
  side: "attack",
  col: 0,
  row: 0,
  ...over,
});

describe("resultBand", () => {
  it("returns Low sample when muted, regardless of win rate", () => {
    expect(resultBand(0.9, true)).toBe("Low sample");
  });
  it("bands win rate around the even zone 0.45..0.55", () => {
    expect(resultBand(0.4, false)).toBe("Mostly lose");
    expect(resultBand(0.6, false)).toBe("Mostly win");
    expect(resultBand(0.5, false)).toBe("Even");
    expect(resultBand(0.45, false)).toBe("Even");
    expect(resultBand(0.55, false)).toBe("Even");
  });
});

describe("buildRegionRows", () => {
  it("drops zero-duel regions and counts duels from the assignment", () => {
    const regions = [region({ name: "A" }), region({ name: "B" })];
    const rows = buildRegionRows(regions, [0, 0, 0]); // 3 duels in A, none in B
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("A");
    expect(rows[0].duels).toBe(3);
  });

  it("orders rows in spatial reading order (top band left->right, then down)", () => {
    const regions = [
      region({ name: "bottom", cy: 0.8, cx: 0.5 }), // index 0
      region({ name: "top-right", cy: 0.1, cx: 0.7 }), // index 1
      region({ name: "top-left", cy: 0.1, cx: 0.2 }), // index 2
    ];
    const rows = buildRegionRows(regions, [0, 1, 2]);
    expect(rows.map((r) => r.index)).toEqual([2, 1, 0]);
  });

  it("builds an accessible label with duels, win %, and result word", () => {
    const rows = buildRegionRows(
      [region({ name: "A Site", winRate: 0.58 })],
      [0, 0],
    );
    expect(rows[0].label).toBe("A Site, 2 duels, 58% win rate, mostly win");
  });
});

describe("buildDuelRows", () => {
  it("orders by round ascending then kills before deaths, preserving source index", () => {
    const duels = [
      duel({ won: false, round: 3, weapon: "Operator", enemyAgent: "Jett" }), // 0
      duel({ won: true, round: 1, weapon: "Vandal" }), // 1
      duel({ won: false, round: 1 }), // 2
    ];
    const rows = buildDuelRows(duels);
    expect(rows.map((r) => r.index)).toEqual([1, 2, 0]);
  });

  it("builds accessible labels, omitting missing weapon/round/enemy", () => {
    const rows = buildDuelRows([
      duel({ won: true, weapon: "Vandal", round: 7, enemyAgent: "Jett" }),
      duel({ won: false, round: 1 }),
    ]);
    expect(rows.find((r) => r.won)!.label).toBe(
      "Kill, Vandal, round 7, vs Jett",
    );
    expect(rows.find((r) => !r.won)!.label).toBe("Death, round 1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/breakdown.test.ts`
Expected: FAIL — cannot resolve `@/lib/fightmap/breakdown` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/fightmap/breakdown.ts`:

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
  label: string; // accessible button name
}

export interface DuelRow {
  index: number; // index into the zoomed-region duel array (aligns with the rendered dot)
  won: boolean;
  weapon: string | null;
  round: number | null;
  enemyAgent: string | null;
  label: string; // accessible button name
}

// Even band centered on the legend's "Even = 50%"; muted (below MIN_DUELS) => "Low sample".
export function resultBand(winRate: number, muted: boolean): Result {
  if (muted) return "Low sample";
  if (winRate < 0.45) return "Mostly lose";
  if (winRate > 0.55) return "Mostly win";
  return "Even";
}

// Regions with >= 1 duel, in spatial reading order (centroid top->bottom band, then left->right).
export function buildRegionRows(
  regions: RegionModel[],
  assignment: number[],
): RegionRow[] {
  const counts = new Array(regions.length).fill(0);
  for (const a of assignment) {
    if (a >= 0 && a < counts.length) counts[a]++;
  }
  const rows: RegionRow[] = [];
  regions.forEach((r, index) => {
    const duels = counts[index];
    if (duels < 1) return;
    const result = resultBand(r.winRate, r.muted);
    const pct = Math.round(r.winRate * 100);
    rows.push({
      index,
      name: r.name,
      duels,
      winRate: r.winRate,
      muted: r.muted,
      result,
      label: `${r.name}, ${duels} duels, ${pct}% win rate, ${result.toLowerCase()}`,
    });
  });
  // Vertical band bucket (5 bands) then left->right within a band.
  rows.sort((a, b) => {
    const ra = regions[a.index];
    const rb = regions[b.index];
    const band = Math.round(ra.cy * 5) - Math.round(rb.cy * 5);
    return band !== 0 ? band : ra.cx - rb.cx;
  });
  return rows;
}

// The zoomed region's duels. `index` is the source position (aligns with the rendered dot);
// display order is round ascending (nulls last), then kills before deaths.
export function buildDuelRows(duels: Placed[]): DuelRow[] {
  const rows: DuelRow[] = duels.map((d, index) => {
    const weapon = d.weapon ?? null;
    const round = d.round ?? null;
    const enemyAgent = d.enemyAgent ?? null;
    const parts = [d.won ? "Kill" : "Death"];
    if (weapon) parts.push(weapon);
    if (round != null) parts.push(`round ${round}`);
    if (enemyAgent) parts.push(`vs ${enemyAgent}`);
    return {
      index,
      won: d.won,
      weapon,
      round,
      enemyAgent,
      label: parts.join(", "),
    };
  });
  return rows.sort((a, b) => {
    const ra = a.round ?? Infinity;
    const rb = b.round ?? Infinity;
    if (ra !== rb) return ra - rb;
    if (a.won !== b.won) return a.won ? -1 : 1;
    return a.index - b.index;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/breakdown.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/fightmap/breakdown.ts tests/breakdown.test.ts
git commit -m "Adds pure breakdown-row builders for the accessible data layer"
```

---

### Task 2: BreakdownTable component (`components/fightmap/BreakdownTable.tsx`)

**Files:**

- Create: `components/fightmap/BreakdownTable.tsx`

Context: a thin, presentational client component. It is context-aware: when `duelRows` is provided it is in **zoomed** mode (duel rows); otherwise **overview** mode (region rows). It holds no business logic — labels, ordering, and counts all come from Task 1's builders. No unit test (node-env Vitest cannot render React); verified by `tsc` here and by smoke tests in Task 5. Inline styles match the app's existing palette (muted text `#8b93a3`, borders `#222a38`, gold accents `#ffd166`), consistent with sibling components that use inline styles.

- [ ] **Step 1: Write the component**

Create `components/fightmap/BreakdownTable.tsx`:

```tsx
"use client";
import type { CSSProperties } from "react";
import type { RegionRow, DuelRow } from "@/lib/fightmap/breakdown";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
  fontSize: 13,
};
const captionStyle: CSSProperties = {
  textAlign: "left",
  color: "var(--muted)",
  fontSize: 12,
  marginBottom: 6,
};
const th: CSSProperties = {
  textAlign: "left",
  color: "var(--muted)",
  fontWeight: 600,
  padding: "4px 8px",
  borderBottom: "1px solid #222a38",
};
const td: CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid #161b26",
};
const cellButton: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ece8e1",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};
const rowActive: CSSProperties = { background: "#1b2230" };
const disclosure: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ffd166",
  font: "inherit",
  fontSize: 13,
  cursor: "pointer",
  padding: "4px 0",
};

export default function BreakdownTable({
  expanded,
  onToggle,
  regionRows,
  duelRows,
  regionName,
  focusedDuel,
  onSelectRegion,
  onSelectDuel,
}: {
  expanded: boolean;
  onToggle: () => void;
  regionRows?: RegionRow[];
  duelRows?: DuelRow[];
  regionName?: string;
  focusedDuel?: number | null;
  onSelectRegion?: (index: number) => void;
  onSelectDuel?: (index: number) => void;
}) {
  const zoomed = duelRows != null;
  const caption = zoomed
    ? `${regionName ?? "Region"} duels`
    : "Region breakdown";

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        style={disclosure}
      >
        {expanded ? "Hide breakdown" : "Show breakdown"}
      </button>
      {expanded && (
        <table style={tableStyle}>
          <caption style={captionStyle}>{caption}</caption>
          {zoomed ? (
            <>
              <thead>
                <tr>
                  <th scope="col" style={th}>
                    Outcome
                  </th>
                  <th scope="col" style={th}>
                    Weapon
                  </th>
                  <th scope="col" style={th}>
                    Round
                  </th>
                  <th scope="col" style={th}>
                    Enemy
                  </th>
                </tr>
              </thead>
              <tbody>
                {duelRows!.map((row) => (
                  <tr
                    key={row.index}
                    aria-current={
                      row.index === focusedDuel ? "true" : undefined
                    }
                    style={row.index === focusedDuel ? rowActive : undefined}
                  >
                    <td style={td}>
                      <button
                        type="button"
                        aria-label={row.label}
                        onClick={() => onSelectDuel?.(row.index)}
                        style={cellButton}
                      >
                        {row.won ? "Kill" : "Death"}
                      </button>
                    </td>
                    <td style={td}>{row.weapon ?? "—"}</td>
                    <td style={td}>{row.round ?? "—"}</td>
                    <td style={td}>{row.enemyAgent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th scope="col" style={th}>
                    Region
                  </th>
                  <th scope="col" style={th}>
                    Duels
                  </th>
                  <th scope="col" style={th}>
                    Win %
                  </th>
                  <th scope="col" style={th}>
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {(regionRows ?? []).map((row) => (
                  <tr key={row.index}>
                    <td style={td}>
                      <button
                        type="button"
                        aria-label={row.label}
                        onClick={() => onSelectRegion?.(row.index)}
                        style={cellButton}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td style={td}>{row.duels}</td>
                    <td style={td}>{Math.round(row.winRate * 100)}%</td>
                    <td
                      style={{
                        ...td,
                        color: row.muted ? "#8b93a3" : undefined,
                      }}
                    >
                      {row.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (The component is not yet rendered anywhere, so nothing else changes.)

- [ ] **Step 3: Commit**

```bash
git add components/fightmap/BreakdownTable.tsx
git commit -m "Adds context-aware BreakdownTable component"
```

---

### Task 3: Make DuelMap focus controlled + hide the SVG (`components/fightmap/DuelMap.tsx`)

**Files:**

- Modify: `components/fightmap/DuelMap.tsx`

Context: `DuelMap` currently owns the `focused` duel as internal state (`const [focused, setFocused] = useState<number | null>(null)`). To enable two-way sync with the breakdown table, lift `focused` to a **controlled** prop pair while keeping a standalone fallback. `hovered` and `expanded` stay internal. The existing focus-in-on-open / focus-return-on-close effect and the Tab trap key off the resolved `focused` value and keep working unchanged. Also mark the decorative `<svg>` `aria-hidden` — the dialog is a sibling `<div>` outside the svg and stays reachable. This task makes no caller pass the new props yet, so behavior is identical and the existing smoke tests stay green.

- [ ] **Step 1: Add the controlled props to the signature**

In `components/fightmap/DuelMap.tsx`, change the props destructuring + type (currently lines ~16-28) to add `focused` (aliased) and `onFocusChange`:

```tsx
export default function DuelMap({
  image,
  points,
  overlay,
  viewBox = "0 0 100 100",
  onZoom,
  focused: focusedProp,
  onFocusChange,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
  viewBox?: string;
  onZoom?: (pointIndex: number) => void;
  focused?: number | null;
  onFocusChange?: (i: number | null) => void;
}) {
```

- [ ] **Step 2: Replace the internal `focused` state with controlled-or-internal resolution**

Replace this line (currently ~line 30):

```tsx
const [focused, setFocused] = useState<number | null>(null);
```

with:

```tsx
const [focusedInternal, setFocusedInternal] = useState<number | null>(null);
const focused = focusedProp !== undefined ? focusedProp : focusedInternal;
const setFocused = (i: number | null) => {
  if (onFocusChange) onFocusChange(i);
  else setFocusedInternal(i);
};
```

(Leave `hovered`, `expanded`, and `closeRef` as they are. All existing `setFocused(...)` calls in the click/dialog handlers now route through this wrapper.)

- [ ] **Step 3: Stop the render-time reset from updating a controlled parent**

The render-time reset guard (currently ~lines 58-64) calls `setFocused(null)` during render, which would update the parent mid-render when controlled. In controlled mode the parent (`FightMap`) already clears the focused duel on region/filter change, so only reset the internal state when uncontrolled. Replace:

```tsx
const [prevPoints, setPrevPoints] = useState(points);
if (points !== prevPoints) {
  setPrevPoints(points);
  setFocused(null);
  setHovered(null);
  setExpanded(null);
}
```

with:

```tsx
const [prevPoints, setPrevPoints] = useState(points);
if (points !== prevPoints) {
  setPrevPoints(points);
  if (onFocusChange === undefined) setFocusedInternal(null);
  setHovered(null);
  setExpanded(null);
}
```

- [ ] **Step 4: Mark the decorative SVG aria-hidden**

In the `<svg>` opening tag (currently ~lines 197-205), add `aria-hidden="true"`:

```tsx
      <svg
        viewBox={viewBox}
        width="100%"
        className={styles.svg}
        aria-hidden="true"
        onClick={() => {
          setFocused(null);
          setExpanded(null);
        }}
      >
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the existing smoke suite to confirm no behavior change**

Run: `TEST_PORT=3001 pnpm exec playwright test`
Expected: all existing tests PASS (the dialog-open/close and reduced-motion tests still pass; `dispatchEvent("click")` fires on elements regardless of `aria-hidden`).

- [ ] **Step 7: Commit**

```bash
git add components/fightmap/DuelMap.tsx
git commit -m "Makes DuelMap focus controllable and hides the decorative svg"
```

---

### Task 4: Thread focus through FragMap + hide RegionView SVG (`components/fightmap/FragMap.tsx`, `components/fightmap/RegionView.tsx`)

**Files:**

- Modify: `components/fightmap/FragMap.tsx`
- Modify: `components/fightmap/RegionView.tsx`

Context: `FragMap` is the wrapper that renders `DuelMap` for both the Dots overview and the zoomed view. It already derives `shownPoints` (the zoomed region's duels) with a `useMemo` — keep that exactly as-is, because `FightMap` will derive the same list with the same filter for the table, so the indices align. Add pass-through props for the focused duel. `RegionView` (the Heatmap overview) has two `<svg>` elements (polygon mode and raster mode); mark both `aria-hidden` since the region breakdown table is the keyboard path there. No caller passes the new FragMap props yet (FightMap is wired in Task 5), so `focusedDuel`/`onFocusDuel` are `undefined` here and `DuelMap` falls back to internal focus — behavior unchanged.

- [ ] **Step 1: Add pass-through props to FragMap**

In `components/fightmap/FragMap.tsx`, add `focusedDuel` and `onFocusDuel` to the props destructuring + type:

```tsx
export default function FragMap({
  image,
  points,
  regions,
  assignment,
  zoomedRegion,
  onZoom,
  onExitZoom,
  focusedDuel,
  onFocusDuel,
}: {
  image: string;
  points: Placed[];
  regions: RegionModel[];
  assignment: number[];
  zoomedRegion: number | null;
  onZoom: (regionIndex: number) => void;
  onExitZoom: () => void;
  focusedDuel?: number | null;
  onFocusDuel?: (i: number | null) => void;
}) {
```

- [ ] **Step 2: Forward the focus props to DuelMap**

In the same file, update the `<DuelMap .../>` element (currently ~lines 76-88) to forward the focus props:

```tsx
<DuelMap
  image={image}
  points={shownPoints}
  viewBox={vb}
  focused={focusedDuel}
  onFocusChange={onFocusDuel}
  onZoom={
    zoomed
      ? undefined
      : (i) => {
          const ri = assignment[i];
          if (ri !== -1) onZoom(ri); // ignore points with no region
        }
  }
/>
```

- [ ] **Step 3: Mark both RegionView SVGs aria-hidden**

In `components/fightmap/RegionView.tsx`, add `aria-hidden="true"` to **both** `<svg>` opening tags.

First svg (polygon mode, currently ~lines 54-56):

```tsx
        <svg
          viewBox="0 0 100 100"
          width="100%"
          aria-hidden="true"
```

Second svg (raster mode, currently ~lines 225-228):

```tsx
    <svg
      viewBox="0 0 100 100"
      width="100%"
      aria-hidden="true"
      onClick={handleClick}
```

(Leave all other attributes and the `onClick`/`onSelectRegion` handlers unchanged.)

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the existing smoke suite**

Run: `TEST_PORT=3001 pnpm exec playwright test`
Expected: all existing tests PASS (region click/zoom and tooltip tests use `dispatchEvent`, unaffected by `aria-hidden`).

- [ ] **Step 6: Commit**

```bash
git add components/fightmap/FragMap.tsx components/fightmap/RegionView.tsx
git commit -m "Threads focused-duel through FragMap and hides RegionView svgs"
```

---

### Task 5: Wire the table into FightMap + smoke tests (`components/fightmap/FightMap.tsx`, `tests/smoke.spec.ts`)

**Files:**

- Modify: `components/fightmap/FightMap.tsx`
- Modify: `tests/smoke.spec.ts`

Context: this is the integration task. `FightMap` gains `focusedDuel` and `breakdownOpen` state, a `goToRegion` helper that clears the focused duel whenever the zoomed region changes, derives the rows, renders `BreakdownTable` in both modes, and threads the focus props into `FragMap`. Then add Playwright smoke tests that drive the full keyboard path. Current relevant structure: state at lines ~43-49; the `onFilter` helper at lines ~99-104; the Heatmap button `onClick` at lines ~164-167; `RegionView` `onSelectRegion` at lines ~198-201; `FragMap` `onZoom`/`onExitZoom` at lines ~210-211; `<Legend />` at line ~214.

- [ ] **Step 1: Write the failing smoke tests**

Append to `tests/smoke.spec.ts` (the `gotoAscent` helper already exists at the top of the file):

```ts
test("region breakdown table zooms into a region", async ({ page }) => {
  await gotoAscent(page); // dots overview by default
  const row = page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
});

test("zoomed breakdown lists duels and activating one opens the dialog with aria-current", async ({
  page,
}) => {
  await gotoAscent(page);
  await page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  const duelRow = page.getByRole("button", { name: /^(Kill|Death),/ }).first();
  await expect(duelRow).toBeVisible();
  await duelRow.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
});

test("clicking a dot marks the matching breakdown row aria-current", async ({
  page,
}) => {
  await gotoAscent(page);
  await page
    .getByRole("button", { name: /\d+ duels, \d+% win rate/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /All regions/ })).toBeVisible();
  // The region's duels may render as a cluster badge; fan it out first (same
  // pattern as the existing focus-dialog test) so an individual dot is clickable.
  const badge = page.locator('svg circle[fill="#161b26"][stroke="#ffd166"]');
  if ((await badge.count()) > 0) {
    await badge.first().dispatchEvent("click");
  }
  await page.locator("svg [data-duel]").first().dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
});

test("the decorative map svg is hidden from assistive tech", async ({
  page,
}) => {
  await gotoAscent(page);
  await expect(page.locator("svg").last()).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
```

- [ ] **Step 2: Run the new smoke tests to verify they fail**

Run: `TEST_PORT=3001 pnpm exec playwright test -g "breakdown|decorative map svg"`
Expected: FAIL — no breakdown-table buttons exist yet, and the svg has no `aria-hidden` from FightMap's perspective (the DuelMap svg got it in Task 3, so that one test may already pass; the three breakdown tests fail).

- [ ] **Step 3: Add state and the goToRegion helper**

In `components/fightmap/FightMap.tsx`, add to the imports near the other `./` imports:

```tsx
import BreakdownTable from "./BreakdownTable";
import { buildRegionRows, buildDuelRows } from "@/lib/fightmap/breakdown";
```

After the existing `const [zoomedRegion, setZoomedRegion] = useState<number | null>(null);` (line ~49), add:

```tsx
const [focusedDuel, setFocusedDuel] = useState<number | null>(null);
const [breakdownOpen, setBreakdownOpen] = useState(true);

// Changing region (or filters, which reset the region) clears the focused duel.
const goToRegion = (i: number | null) => {
  setZoomedRegion(i);
  setFocusedDuel(null);
};
```

- [ ] **Step 4: Route every region change through goToRegion**

Replace `setZoomedRegion(null)` in the `onFilter` helper (line ~103):

```tsx
const onFilter =
  <T,>(setter: (v: T) => void) =>
  (v: T) => {
    setter(v);
    goToRegion(null);
  };
```

In the Heatmap button `onClick` (line ~164-167):

```tsx
              onClick={() => {
                setLayer("heatmap");
                goToRegion(null);
              }}
```

In `RegionView`'s `onSelectRegion` (line ~198-201):

```tsx
                onSelectRegion={(i) => {
                  goToRegion(i);
                  setLayer("dots");
                }}
```

In the `FragMap` `onZoom`/`onExitZoom` (line ~210-211):

```tsx
                onZoom={(ri) => goToRegion(ri)}
                onExitZoom={() => goToRegion(null)}
```

- [ ] **Step 5: Derive the rows and pass focus props to FragMap**

Add the row derivations after the `regionModel`/`assignment` memo (after line ~96):

```tsx
const regionRows = useMemo(
  () => buildRegionRows(regionModel, assignment),
  [regionModel, assignment],
);
const zoomedDuels = useMemo(
  () =>
    zoomedRegion == null
      ? []
      : points.filter((_, i) => assignment[i] === zoomedRegion),
  [points, assignment, zoomedRegion],
);
const duelRows = useMemo(() => buildDuelRows(zoomedDuels), [zoomedDuels]);
```

Add two attributes to the `<FragMap .../>` element (the same element whose `onZoom`/`onExitZoom` you changed in Step 4) so the full element now reads:

```tsx
<FragMap
  image={calib.image}
  points={points}
  regions={regionModel}
  assignment={assignment}
  zoomedRegion={zoomedRegion}
  onZoom={(ri) => goToRegion(ri)}
  onExitZoom={() => goToRegion(null)}
  focusedDuel={focusedDuel}
  onFocusDuel={setFocusedDuel}
/>
```

- [ ] **Step 6: Render the BreakdownTable**

Immediately after `<Legend />` (line ~214), inside the same `<div>`, add:

Pass every prop directly (no conditional spread, which trips up the JSX type-checker). `BreakdownTable` selects its mode from whether `duelRows` is defined, so pass `duelRows`/`regionRows` conditionally and leave the two callbacks always bound (each is a no-op in the other mode):

```tsx
<BreakdownTable
  expanded={breakdownOpen}
  onToggle={() => setBreakdownOpen((o) => !o)}
  regionRows={zoomedRegion == null ? regionRows : undefined}
  onSelectRegion={(i) => {
    goToRegion(i);
    setLayer("dots");
  }}
  duelRows={zoomedRegion == null ? undefined : duelRows}
  regionName={
    zoomedRegion == null
      ? undefined
      : (regionModel[zoomedRegion]?.name ?? "Region")
  }
  focusedDuel={focusedDuel}
  onSelectDuel={setFocusedDuel}
/>
```

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the full smoke suite**

Run: `TEST_PORT=3001 pnpm exec playwright test`
Expected: all tests PASS, including the four new ones.

- [ ] **Step 9: Run the full unit suite**

Run: `pnpm exec vitest run`
Expected: all tests PASS (Task 1's breakdown tests included).

- [ ] **Step 10: Commit**

```bash
git add components/fightmap/FightMap.tsx tests/smoke.spec.ts
git commit -m "Wires the accessible breakdown table into FightMap"
```

---

## Final Verification

After all tasks, run the full gate and confirm green before finishing:

- `pnpm exec tsc --noEmit` — no errors
- `pnpm exec vitest run` — all unit tests pass
- `TEST_PORT=3001 pnpm exec playwright test` — all smoke tests pass

Then a manual keyboard pass on `/fragsmap` (Tab to a region row, Enter to zoom, Tab to a duel row, Enter to open the dialog, Esc to close and confirm focus returns), and a VoiceOver spot-check that the table conveys the map while the svg is skipped.
