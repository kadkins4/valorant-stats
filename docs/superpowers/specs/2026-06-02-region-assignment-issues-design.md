# Region Assignment Robustness + Issue Surfacing — Design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)
**Goal:** Make FragsMap's polygon region assignment robust and self-auditing: every frag is attributed to exactly one zone (overlaps resolved, outside-frags snapped to the nearest zone), and the cases that needed resolving are surfaced — as a Bugsnag-style issues list under `/dev` and a soft, reassuring notice on `/fragsmap` — so zone polygons can be corrected.

This is **Effort A** of two. Effort B (editing existing region polygons + renaming in `/dev/regions`, vs. today's create/delete only) is a separate spec, built after this.

---

## 1. Problem

Polygon assignment is computed in two places that disagree (`lib/maps/regions.ts` and `components/fightmap/FightMap.tsx`):

- **Heatmap tally** (`assignByPolygon`): a frag inside two overlapping zones is counted once, in whichever zone is **first in array order** (arbitrary); a frag outside every zone is **dropped** (counted nowhere).
- **Drill-in** (`FightMap`'s `regionPoints`): re-tests `pointInPolygon` against the selected zone only, so an overlapping frag shows in **both** zones' drill-ins (double display) and an outside frag shows in none.

So the dots you click into don't match the tally, overlaps are resolved arbitrarily, and outside frags silently vanish. There is no signal that any of this happened.

---

## 2. Experience

- **Overlap:** a frag inside multiple zones is attributed to the **smallest-area** zone (the most specific callout — e.g. "Heaven" nested in "A Site" wins). Resolved consistently for both the tally and the drill-in.
- **Outside:** a frag inside no zone is snapped to the zone with the **nearest polygon edge** (no distance limit — nothing is ever dropped).
- **Self-audit — `/dev/issues`:** a dev-only page listing every assignment issue across all traced maps (overlaps and snapped frags), like an issue tracker, each linking to the editor.
- **Self-audit — `/fragsmap`:** when the currently-viewed map+filter has flagged frags, a soft, dismissible, **non-critical** notice in the Regions view names where those frags were counted and reassures nothing is missing.

All issues are **warnings, never errors** — the data is always fully and consistently counted; the flags are authoring-quality hints that a polygon could be tightened or widened.

---

## 3. Architecture

### 3.1 The assignment engine — `assignFrags` (`lib/maps/regions.ts`)

One pure function is the single source of truth for "which zone owns this frag, and was resolving it noteworthy."

```ts
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

export function assignFrags(
  points: Placed[],
  regions: RegionPoly[],
): FragAssignment;
```

Per point:

1. Collect the indices of all regions whose polygon contains it (`pointInPolygon`).
2. **One** container → that index, no flag.
3. **Multiple** containers → the container with the **smallest polygon area** wins; emit `{ type: "overlap", pointIndex, winner, contenders }` (contenders = all containing indices).
4. **Zero** containers → the region with the **nearest edge** wins; emit `{ type: "snapped", pointIndex, nearest, distance }`.
5. If `regions` is empty, `assignment[i] = -1` and no flags (untraced map; caller falls back to raster — see §3.2).

**Polygon area** via the shoelace formula, computed once per region (a local `const areas = regions.map(polygonArea)`).

**Nearest edge** via point-to-segment distance from the frag to every edge of every polygon; pick the global minimum. Maps have ≤21 regions of ≤21 vertices and at most a few hundred frags, so the O(points × edges) cost is negligible (no spatial index needed — YAGNI).

Two small pure helpers, unit-tested independently:

```ts
export function polygonArea(poly: [number, number][]): number; // shoelace, absolute
function distToSegment(p, a, b): number; // point→segment (module-local)
```

### 3.2 Consumers — one assignment, three reads

`assignFrags` feeds the tally, the drill-in, and the issues, eliminating the divergence.

- **`statsFromAssignment(points, regions, assignment): PolyRegionStat[]`** (new exported helper) — tallies wins/total per region from the assignment array, then builds `PolyRegionStat[]` exactly as `assignByPolygon` does today (centroid, winRate, `muted = total < MIN_DUELS`). Snapped frags now land in their nearest zone; overlaps count once in the winner.
- **`assignByPolygon(points, regions)`** stays exported with its current signature (used by `FightMap` and `tests/regions.test.ts`) but is reimplemented as a thin wrapper: `statsFromAssignment(points, regions, assignFrags(points, regions).assignment)`. Behavior changes (outside frags now included, overlaps resolved by area not order); the contract/return type is unchanged.
- **`FightMap`** computes `assignFrags(points, polys)` **once** (memoized on `[points, polys]`) and derives all three:
  - `polyStats = statsFromAssignment(points, polys, assignment)` → `RegionView`.
  - drill-in `regionPoints` = `points.filter((_, i) => assignment[i] === selectedRegion)` — same source of truth as the tally, so dots match counts; replaces the separate `pointInPolygon` loop (polygon branch only). The raster/callout branch (untraced maps) is unchanged.
  - `flags` → issues for the notice (§3.5).

### 3.3 Issue model (`lib/maps/regions.ts`)

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

export function issuesForMap(
  map: string,
  points: Placed[],
  regions: RegionPoly[],
): RegionIssue[];
```

Derived from `assignFrags(points, regions).flags`:

- **overlap** issues: group `overlap` flags by their **set of contender zone names** (sorted, joined as a key). One issue per distinct overlapping set → `{ zones: [names...], winner: <name>, count }`.
- **snapped** issues: group `snapped` flags by **nearest zone name** → `{ zone, count, points: [frag coords...] }` (coords let the dashboard and editor locate them).

`issuesForMap` returns `[]` when a map is clean. It maps region indices back to names via `regions[i].name`.

### 3.4 `/dev/issues` dashboard

A new dev-gated page (`app/dev/issues/page.tsx`), gated exactly like `app/dev/regions/page.tsx` (renders a "local dev only" message when `NODE_ENV !== "development"`). Cross-linked with `/dev/regions` (a link each way).

- **Data:** a server component calls `getFightData()` (same loader as `/fragsmap`). For every traced map (`Object.keys(REGIONS)`), it builds the full duel set — `placeDuels(collectDuels(matches, { map, side: "both", time: { kind: "all" } }), getCalibration(map))` — and runs `issuesForMap`. (Skip maps with no calibration.) The flattened `RegionIssue[]` is handed to a client list component.
- **Layout:** a header count ("N issues across M maps"), then a scannable list — each row: a warning dot, map, type (Overlap / Snapped), the zones involved, the frag count, and for snapped a compact coordinate list. Each row has an "open editor" link to `/dev/regions` (today that just opens the tool; deep-linking to the specific map is a nice-to-have, not required for Effort A). A clean **zero state** ("No region issues 🎉").

### 3.5 `/fragsmap` notice

A small client component (`components/fightmap/RegionIssueNotice.tsx`) rendered in `FightMap`'s **Regions view only**, above the map, when `issuesForMap(map, points, polys)` (computed from the **currently displayed** filtered points) is non-empty.

- **Tone:** soft and non-critical — muted/accent background, an ⓘ glyph, never a red error. It reassures the data is complete and names where frags went:

  > ⓘ A few frags here landed between zones — we've counted them in the nearest one (5 near **A Main**, 3 in **Heaven**). Nothing's missing; your totals are complete.

  The named zones come from the issues (snapped → nearest zone; overlap → winner). Keep the list short (top few by count).

- **Dismissible per session:** a close control hides it; the dismissal is remembered in `sessionStorage` keyed per map (`fragsmap.issue-notice.dismissed.<map>`), so dismissing on Ascent doesn't suppress Bind's, and it returns next session.
- Covers **both** snapped and overlap frags, framed gently. Full per-issue detail lives in `/dev/issues`.

---

## 4. Edge cases

- **Untraced map (raster mode):** `assignFrags` isn't used (polygon mode only); the raster/callout path is untouched, no notice. (`assignFrags` returning `-1` for empty regions is defensive; `FightMap` only calls it when `polys.length > 0`.)
- **Clean map:** `issuesForMap → []`; no notice on `/fragsmap`, no rows on `/dev/issues`.
- **All frags filtered out** (empty `points`): no flags, no notice.
- **A frag exactly on an edge:** `pointInPolygon` is deterministic (ray cast); whatever it decides is stable. If counted as inside one zone, no flag; the behavior is consistent between tally and drill-in because they share `assignment`.
- **Degenerate polygon** (<3 points): can't happen for saved regions (the editor only saves `points.length >= 3`), but `polygonArea` returns 0 for such input and it would simply never win an overlap — safe.
- **Dismissed notice then filter change** introduces new issues: the per-map dismissal still applies for the session (acceptable; the dev dashboard is the complete record).

---

## 5. Testing

**Unit (vitest), `tests/regions.test.ts`:**

- `polygonArea`: known square / triangle areas.
- `assignFrags`:
  - frag in one zone → that index, no flags.
  - frag in two nested zones → smaller-area index wins; one `overlap` flag with both contenders.
  - frag outside all zones → nearest-edge index; one `snapped` flag.
  - empty regions → all `-1`, no flags.
- `statsFromAssignment` / `assignByPolygon`: outside frag is now counted in its nearest zone (regression guard vs. the old "dropped" behavior); overlap frag counted once in the smaller zone.
- `issuesForMap`: overlaps grouped by contender-set; snapped grouped by nearest zone with coords; clean input → `[]`.

**Smoke (Playwright, `tests/smoke.spec.ts`):**

- `/dev/issues` renders in dev: heading visible, and either issue rows or the zero state (assert the page loads and shows the issues heading).
- `/fragsmap` notice: this depends on real data having a flagged frag on the default/Ascent view; if not reliably reproducible against the snapshot, assert instead that the notice component's dismiss wiring works on a map known to have issues, or cover the notice render path via a unit test of `issuesForMap` + a lightweight component check. (The plan will pick the concrete, non-flaky assertion based on the snapshot.)

**Manual:** open `/dev/issues`, confirm it lists overlaps/snapped per map; open `/fragsmap` Regions on a map with issues, confirm the soft notice names the right zones and dismisses (and stays dismissed on reload, re-appears next session).

---

## 6. Scope guard (YAGNI)

**In:** the `assignFrags` engine (smallest-area overlap, nearest-edge snap) + `polygonArea`; `statsFromAssignment` and the `assignByPolygon`/drill-in refactor onto one assignment; the `RegionIssue` model + `issuesForMap`; the `/dev/issues` dashboard; the `/fragsmap` notice; the two test layers.

**Out (separate efforts / not now):** editing existing region polygons + renaming in `/dev/regions` (**Effort B**); deep-linking `/dev/issues` rows to a specific map in the editor (nice-to-have); severity levels beyond "warning"; auto-fixing/auto-adjusting polygons; persisting issues to a DB or external service (the Bugsnag comparison is about the _list UX_, not a real backend — issues are computed on the fly); changing the Grid view or the raster/untraced path; a distance cap / "orphan" state for snapped frags (we always snap to nearest).
