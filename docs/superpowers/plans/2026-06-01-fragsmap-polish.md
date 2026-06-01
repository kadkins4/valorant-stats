# FragsMap Iteration 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the duel heatmap to FragsMap and ship polish + a cumulative season multi-select + a callout-region prototype, with no data recapture.

**Architecture:** Existing Next.js 16 App Router app. Feature lives in `app/fragsmap/` + `components/fightmap/*` + `lib/fightmap.ts` + `lib/maps/*`. Pure per-duel data (`{x,y,won,side,round}`). Region prototype uses static callout data fetched from valorant-api.

**Tech Stack:** Next.js 16, React 19, TypeScript, vitest, Playwright, pnpm. CSS-first animations, inline SVG icons (project perf preference).

---

### Task 1: Route + brand rename (showcase → fragsmap)

**Files:**

- Create: `app/fragsmap/page.tsx` (content of old showcase page, h1 "FragsMap", updated blurb)
- Delete: `app/showcase/page.tsx` (and the now-empty `app/showcase/` dir)
- Modify: `components/Nav.tsx` (tab `["/showcase","Showcase"]` → `["/fragsmap","FragsMap"]`)
- Modify: `tests/smoke.spec.ts` (any `/showcase` path → `/fragsmap`)

- [ ] **Step 1:** Create `app/fragsmap/page.tsx` mirroring the old showcase page but with `export default async function FragsMap()`, `<h1>FragsMap</h1>`, and blurb "Where my gunfights happen — green = I win duels there, red = I lose them."
- [ ] **Step 2:** Delete `app/showcase/page.tsx`.
- [ ] **Step 3:** Update `components/Nav.tsx` tabs array entry to `["/fragsmap", "FragsMap"]`.
- [ ] **Step 4:** Update `tests/smoke.spec.ts` to visit `/fragsmap`; add an assertion that the FragsMap heading/controls render.
- [ ] **Step 5:** Run `pnpm smoke` — expect the FragsMap smoke test to pass.
- [ ] **Step 6:** Commit: `feat: rename showcase route to /fragsmap`.

---

### Task 2: `formatSeason` helper

**Files:**

- Modify: `lib/fightmap.ts`
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1 (failing test):** In `tests/fightmap.test.ts`, assert `formatSeason("e4a3") === "E4 A3"`, `formatSeason("e11a1") === "E11 A1"`, and `formatSeason("weird") === "WEIRD"` (fallback uppercases).
- [ ] **Step 2:** Run the test, expect failure (not defined).
- [ ] **Step 3:** Implement in `lib/fightmap.ts`:

```ts
export function formatSeason(s: string): string {
  const m = /^e(\d+)a(\d+)$/i.exec(s);
  return m ? `E${m[1]} A${m[2]}` : s.toUpperCase();
}
```

- [ ] **Step 4:** Run the test, expect pass.
- [ ] **Step 5:** Commit: `feat: add formatSeason display helper`.

---

### Task 3: TimeScope → cumulative seasons model

**Files:**

- Modify: `lib/fightmap.ts` (`TimeScope`, `collectDuels`)
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1 (failing test):** Add tests: `collectDuels` with `{kind:"seasons",seasons:["e11a1","e10a6"]}` returns duels from both seasons (union) for the chosen map; `{kind:"seasons",seasons:[]}` returns `[]`; `{kind:"all"}` returns all; `{kind:"lastN",n:2}` returns duels from the 2 most-recent matches. (Build small fixture `FightMatch[]`.)
- [ ] **Step 2:** Run, expect failures.
- [ ] **Step 3:** Change `TimeScope` to:

```ts
export type TimeScope =
  | { kind: "seasons"; seasons: string[] }
  | { kind: "all" }
  | { kind: "lastN"; n: number };
```

Update `collectDuels` season branch to `ms = ms.filter((m) => o.time.kind === "seasons" && o.time.seasons.includes(m.season));` (keep `all` and `lastN` branches).

- [ ] **Step 4:** Run, expect pass.
- [ ] **Step 5:** Update `components/fightmap/FightMap.tsx` default state to `{ kind: "seasons", seasons: [currentSeason] }` and fix the `TimeSelector` prop types if needed (full UI in Task 4 — here just keep it compiling). Run `pnpm exec tsc --noEmit`.
- [ ] **Step 6:** Commit: `feat: cumulative multi-season time scope`.

---

### Task 4: Seasons multi-select dropdown + All/Last10/Last20 toggles

**Files:**

- Rewrite: `components/fightmap/TimeSelector.tsx`
- Modify: `components/fightmap/FightMap.tsx` (label `TIME` → `SEASONS`)

**Behavior:**

- A dropdown (details/summary or a button-revealed panel) listing every season as a **checkbox**, labeled via `formatSeason`. Checking/unchecking toggles membership in `time.seasons` (cumulative). Summary shows count, e.g. "2 seasons" or the single formatted season.
- Below/beside it, three mutually-exclusive toggle buttons: **All time**, **Last 10**, **Last 20**. Selecting one sets `time` to that kind and visually deselects the season checkboxes (they're a different axis).
- Selecting any season checkbox switches `time.kind` back to `"seasons"`.

- [ ] **Step 1:** Rewrite `TimeSelector.tsx` to accept `seasons: string[]`, `value: TimeScope`, `onChange`. Render checkbox dropdown + the three toggle chips (reuse `chip` from MapPicker for the toggles). Use `formatSeason` for season labels. Pure CSS for the dropdown open/close (`<details>` element preferred — no JS).
- [ ] **Step 2:** In `FightMap.tsx`, change the `SEASONS` label text (was `TIME`).
- [ ] **Step 3:** Run `pnpm exec tsc --noEmit` + `pnpm smoke`; expect green.
- [ ] **Step 4:** Commit: `feat: seasons multi-select dropdown + scope toggles`.

---

### Task 5: Pill label spacing

**Files:**

- Modify: `components/fightmap/FightMap.tsx`

- [ ] **Step 1:** Add breathing room between each section label and its pill row — give the `.label` divs `marginBottom: 6` (and confirm the outer per-section gap reads cleanly). Keep it consistent across MAP / SIDE / SEASONS.
- [ ] **Step 2:** Run `pnpm smoke`; commit: `style: space filter labels from their pills`.

---

### Task 6: Side icons (sword / shield)

**Files:**

- Modify: `components/fightmap/SideToggle.tsx`

- [ ] **Step 1:** Add small inline SVG icons before the labels: a sword for **Attack**, a shield for **Defense**; **Both** stays text-only (or a subtle combined glyph). Icons inherit `currentColor`, ~14px, `aria-hidden`. Keep the existing `chip` styling.
- [ ] **Step 2:** Run `pnpm smoke`; commit: `feat: sword/shield icons on side toggle`.

---

### Task 7: Zone sample size + drop "4,4" heading

**Files:**

- Modify: `components/fightmap/ZoneGrid.tsx` (sample count under %)
- Modify: `components/fightmap/ZoneDetail.tsx` (drop zone coords from heading)

- [ ] **Step 1:** In `ZoneGrid.tsx`, under the win-rate `%` text, add a second smaller `<text>` showing the count, e.g. `n={z.total}` rendered as `${z.total}` at ~`fontSize 3`, muted fill, `pointerEvents:none`. Keep it legible against zone colors (stroke paint-order as the % text does).
- [ ] **Step 2:** In `ZoneDetail.tsx`, change the `<h3>` from `Zone {col+1},{row+1} — {n} duels · {wins} won` to `{inZone.length} duels · {wins} won` (no coordinates).
- [ ] **Step 3:** Run `pnpm smoke`; commit: `feat: show zone sample size; drop zone coords from drill-in`.

---

### Task 8: Fetch callout data

**Files:**

- Modify: `scripts/fetch-map-calibration.ts` (also emit callouts)
- Create: `lib/maps/callouts.json` (generated)
- Modify: `lib/maps/calibration.ts` (add `Callout` type + `getCallouts`)
- Test: `tests/calibration.test.ts`

- [ ] **Step 1:** Extend the fetch script: for each map with callouts, emit `{ map: displayName, callouts: [{ regionName, superRegionName, x: location.x, y: location.y }] }` to `lib/maps/callouts.json`.
- [ ] **Step 2:** Run `pnpm tsx scripts/fetch-map-calibration.ts` (or the project's runner) to generate both JSONs. Confirm Ascent has ~22 callouts.
- [ ] **Step 3 (failing test):** In `tests/calibration.test.ts`, assert `getCallouts("Ascent").length > 0` and that an entry has `regionName` + numeric `x`/`y`.
- [ ] **Step 4:** Add to `lib/maps/calibration.ts`:

```ts
export interface Callout {
  regionName: string;
  superRegionName: string;
  x: number;
  y: number;
}
import calloutData from "./callouts.json";
const CALLOUTS = calloutData as { map: string; callouts: Callout[] }[];
export function getCallouts(map: string): Callout[] {
  const key = map.toLowerCase();
  return CALLOUTS.find((c) => c.map.toLowerCase() === key)?.callouts ?? [];
}
```

- [ ] **Step 5:** Run the test, expect pass.
- [ ] **Step 6:** Commit: `feat: fetch + expose map callouts`.

---

### Task 9: Region aggregation logic

**Files:**

- Modify: `lib/fightmap.ts` (add region helpers)
- Test: `tests/fightmap.test.ts`

- [ ] **Step 1 (failing test):** With a 2-callout fixture and a few `Placed`-style points near each, assert `assignRegions` buckets each duel to the nearest callout and computes `winRate`/`total`/`muted` correctly.
- [ ] **Step 2:** Run, expect failure.
- [ ] **Step 3:** Implement:

```ts
export interface RegionStat {
  regionName: string;
  superRegionName: string;
  cx: number;
  cy: number; // normalized callout position
  wins: number;
  total: number;
  winRate: number;
  muted: boolean;
}
// callouts already transformed to normalized {cx,cy}; points are Placed (nx,ny,won)
export function assignRegions(
  points: Placed[],
  callouts: {
    regionName: string;
    superRegionName: string;
    cx: number;
    cy: number;
  }[],
): RegionStat[] {
  const acc = new Map<number, { wins: number; total: number }>();
  for (const p of points) {
    let best = 0,
      bestD = Infinity;
    callouts.forEach((c, i) => {
      const d = (c.cx - p.nx) ** 2 + (c.cy - p.ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const cur = acc.get(best) ?? { wins: 0, total: 0 };
    cur.total++;
    if (p.won) cur.wins++;
    acc.set(best, cur);
  }
  return callouts.map((c, i) => {
    const a = acc.get(i) ?? { wins: 0, total: 0 };
    return {
      regionName: c.regionName,
      superRegionName: c.superRegionName,
      cx: c.cx,
      cy: c.cy,
      wins: a.wins,
      total: a.total,
      winRate: a.total ? a.wins / a.total : 0,
      muted: a.total < MIN_DUELS,
    };
  });
}
```

- [ ] **Step 4:** Run, expect pass.
- [ ] **Step 5:** Commit: `feat: callout-region win-rate aggregation`.

---

### Task 10: Region view component + Grid|Regions toggle ⏸ PAUSE FOR REVIEW

**Files:**

- Create: `components/fightmap/RegionView.tsx`
- Modify: `components/fightmap/FightMap.tsx` (transform callouts, view toggle, render)

- [ ] **Step 1:** In `FightMap.tsx`, compute `callouts` for the active map and transform each via `transformCoord(calib, {x,y})` → `{regionName, superRegionName, cx, cy}`; pass `assignRegions(points, transformed)` to the new view. Add a `view` state (`"grid" | "regions"`) with a small toggle (reuse `chip`).
- [ ] **Step 2:** Create `RegionView.tsx`: an SVG over `0..100` viewBox with the minimap image, then a raster (40×40) where each cell is filled with `winRateColor` of the region whose callout is nearest the cell center (muted regions → faded gray). Draw region labels (`superRegionName` + `regionName`) at `cx*100,cy*100`, muted-faded for low-sample regions. Reuse `winRateColor`.
- [ ] **Step 3:** Wire the toggle so `view==="regions"` renders `RegionView`, else `ZoneGrid`. Keep `ZoneDetail` drill-in working for the grid view.
- [ ] **Step 4:** Run `pnpm exec tsc --noEmit` + `pnpm smoke`. Commit: `feat: callout-region prototype view + toggle`.
- [ ] **Step 5: ⏸ PAUSE.** Capture screenshots of Grid and Regions (default map, current season). Report to Kendall for a look before finalizing the zone model. Do not merge past this point without his nod.

---

### Task 11: Full gate + verify + PR

- [ ] **Step 1:** Run the full gate: `pnpm test`, `pnpm smoke`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`. All green.
- [ ] **Step 2:** Visual check `/fragsmap` (controls spacing, SEASONS dropdown, side icons, sample sizes, both views). Confirm `/showcase` 404s.
- [ ] **Step 3:** Push branch `fragsmap-polish`; open PR (or merge to main per Kendall's call). Update Obsidian + memory if the feature notes change.

---

## Self-review notes

- Type consistency: `TimeScope.seasons` used in Tasks 3/4; `Placed` (nx,ny,won) feeds `assignRegions` in Task 9/10; `winRateColor`/`MIN_DUELS` reused. `formatSeason` defined Task 2, consumed Task 4.
- Spec coverage: rename (T1), spacing (T5), label rename (T4), season format (T2/T4), multi-select (T3/T4), side icons (T6), sample size + drop coords (T7), callout-region prototype (T8/T9/T10). All spec items mapped.
- Deferred (not in any task, intentionally): positions/weapon/agent/first-blood/facing/interpolation (Bucket C), map icons, glow layer.

## Backlog (added during iteration)

- **Custom favicon** — replace default `app/favicon.ico` with a FragsMap mark. Wiring: drop `app/icon.png` (and optional `app/apple-icon.png`) — Next.js App Router auto-serves them. Asset TBD: Kendall may pixel-art it, or generate from a chosen concept (reticle / heat-grid / etc.). Concept sheet rendered 2026-06-01. Fold in once art is picked.
