# Duel-Cluster Fan-Out — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Goal:** In the FragsMap drill-in (`DuelMap`), make overlapping duel dots discoverable and individually selectable: cluster dots whose circles visually overlap into one badge, fan them out on click, and — crucially — keep each duel's engagement geometry anchored to its **real** death location, showing only the **active** duel's gray real-spot marker at a time.

This builds directly on the shipped Bucket C "single-duel focus" (`DuelMap.tsx`): hover shows a duel's engagement (tracer + enemy ring), click focuses it and opens the corner dialog. That interaction is unchanged for lone dots; this effort only adds a clustering/fan-out layer in front of it for overlapping dots.

---

## 1. Problem / context

In the drill-in detail (`components/fightmap/DuelMap.tsx`), each duel renders as a fixed-radius circle (`r=1.6` in the `0 0 100 100` viewBox) at its normalized death location. The drill-in is **cumulative across all matches** for a region/zone, so the same fight area collects many duels. When two or more land close enough that their circles overlap, they stack — only the topmost is visible and clickable; the others are hidden and unreachable.

Empirically the overlaps are **near but never pixel-exact** (death coordinates are fine-grained world units), and — important — **the data changes continuously** (new matches sync hourly). So the design must be **data-agnostic**: clustering is driven purely by a fixed on-screen overlap radius, never by any property of the current dataset. No counts, thresholds, or assumptions derived from today's data appear in the implementation.

---

## 2. Scope

**In:**

- Distance-based clustering of the drill-in duel dots (in `DuelMap`), by on-screen proximity.
- A resting **cluster badge** (one dot + count) for groups of 2+.
- **Click-to-fan**: clicking a cluster fans its members out as individually selectable handles; clicking empty map / Esc collapses.
- **Anchored geometry**: each fanned member's engagement (tracer + enemy ring) and its **single gray real-spot marker** render from the member's real death location, not from the displaced handle.
- **Active-only gray node**: at most one gray real-spot marker is visible — the hovered/focused member's; none at rest.
- The existing hover-preview and click-focus behavior carries through to fanned members unchanged.

**Out:**

- Any data-derived tuning (the radius is a fixed visual constant, not computed from the dataset).
- Touch-specific gestures beyond what click already gives (hover-only effects simply don't fire on touch; click still works).
- Clustering on the main FragsMap heatmap (that view is zone/region polygons, not individual dots — unaffected).
- Changing the dialog contents, the tracer animation, the heatmap, or any data/normalization logic.
- Marker/icon redesign, weapon-class filter, opening-duel markers (separate efforts).

---

## 3. Clustering model (pure, data-agnostic)

A pure helper groups the placed duels by on-screen proximity. Both clustering and fan layout live in pure, unit-tested functions (in `lib/fightmap.ts` or a new `lib/fightmap/cluster.ts`), so `DuelMap` stays a thin renderer.

- **Distance space:** the viewBox is `0..100`; dots have radius `1.6`. Two dots visually overlap when their centers are within roughly a diameter. A named constant `CLUSTER_RADIUS` (starting value ≈ `3.2`, i.e. ~2× dot radius, **tunable** and documented as a pure visual parameter) defines "overlapping."
- **Grouping:** single-linkage — duels within `CLUSTER_RADIUS` of each other join the same cluster (transitive chains allowed). A simple union-find or iterative merge over the `nx*100, ny*100` positions. Order-independent and deterministic.
- **Output:** an array of clusters, each `{ members: number[]; cx: number; cy: number }` where `members` are indices into the placed-points array and `cx,cy` is the cluster centroid (in viewBox units). Clusters of size 1 are returned too (singletons) so the renderer treats everything uniformly.
- **Fan layout:** a pure `fanPositions(cx, cy, n, fanRadius)` returns `n` evenly-spaced points on a circle of radius `FAN_RADIUS` (starting ≈ `6`, tunable) around the centroid — the handle positions when expanded. Deterministic ordering (e.g. starting at top, clockwise) so handles don't reshuffle between renders.

`CLUSTER_RADIUS` and `FAN_RADIUS` are the only two tuning knobs; both are fixed visual constants with explanatory comments. Neither is derived from data.

---

## 4. Interaction states

State added to `DuelMap`: `expanded: number | null` (index of the currently fanned cluster, or null). Existing `hovered` / `focused` (indices into placed points) are reused.

- **Rest:**
  - **Singleton** clusters render exactly as today — a lone dot, hover → engagement, click → focus.
  - **Multi** clusters render as **one badge**: a dot at the centroid plus a small count (gold-bordered pill with the member count, per the approved mockup). Hovering a badge does **not** preview an engagement (ambiguous); it just invites a click.
- **Click a cluster badge → fan:** sets `expanded` to that cluster. Its members render as handles at `fanPositions(...)`, each with a thin faint leader from the centroid to the handle. **No gray real-spot nodes yet.** Other clusters/dots remain as they were (still interactive); clicking a different cluster moves the fan.
- **Hover a fanned handle:** that handle highlights, the other handles in the fan dim (opacity ~0.3, matching today's dim). Exactly one **gray real-spot node** appears at that member's real death location (`nx,ny`), with a leader from the gray node to the handle, and the member's **engagement** (tracer + enemy ring) drawn from the real coordinates (today's `Engagement`, unchanged — it already uses `mnx,mny/enx,eny`). Moving to another handle moves the single gray node; leaving the fan hides it.
- **Click a fanned handle → focus:** today's focus behavior — all other dots (and the other fan handles) are removed, the corner dialog opens, and the focused member keeps its single gray real-spot node + engagement. Re-clicking the focused handle, Esc, or empty-map click unfocuses.
- **Collapse the fan:** clicking empty map or pressing Esc clears `expanded` (and `focused`). Focusing a member also effectively isolates it (others vanish); on unfocus the fan can either restore or fully collapse — **collapse to rest** (simpler, predictable).

At most **one gray real-spot node** is ever visible — the active (hovered or focused) member's. Never a cloud of gray dots.

---

## 5. Geometry correctness

The fanned **handle** is only a click/hover target; it does not represent a location. Everything spatial renders from real coordinates:

- The **gray real-spot node** sits at the member's `nx,ny` (its true death location).
- The **leader** connects that gray node to the handle (so the eye maps handle → real spot).
- The **engagement** `tracer` + enemy ring use the member's real `mnx,mny`/`enx,eny` (unchanged from the shipped `Engagement` component). Because `nx,ny` equals one tracer endpoint (the death location), the tracer naturally emanates from the gray node.

This guarantees the displayed path is always geometrically honest regardless of how far the handle was fanned.

---

## 6. Components / architecture

- **`lib/fightmap.ts`** (or new `lib/fightmap/cluster.ts`): pure `clusterDuels(points, radius)` and `fanPositions(cx, cy, n, fanRadius)` + the `CLUSTER_RADIUS` / `FAN_RADIUS` constants. Fully unit-tested; no React.
- **`components/fightmap/DuelMap.tsx`**: consumes the clusters. Renders singletons (today's path), cluster badges, and — when `expanded` — the fan (handles + leaders) plus the active member's gray node. Reuses the existing `Engagement`, dialog, dim logic, Esc handler, and the `points`-change reset. If `DuelMap` grows unwieldy (it is ~170 lines), extract the cluster/fan rendering into a small `DuelCluster`/`Fan` subcomponent or helper within the same file — but keep one component owning the hover/focus/expanded state.
- **`DuelMap.module.css`**: add classes for the badge (count pill), leaders, gray node; reuse existing `.tracer`. Honor `prefers-reduced-motion` (fan appears instantly, no animated expand; or a brief transform that's disabled under reduced motion).

No changes to `RegionDetail` / `ZoneDetail` (they already render via `DuelMap`); both views get clustering for free.

---

## 7. Edge cases

- **Singletons:** no badge, behave exactly as today.
- **Large cluster (many members):** the fan ring spaces `n` handles around the circle; very large `n` crowds the ring but stays usable. No cap for now (YAGNI); revisit only if real data shows huge piles.
- **Transitive chains:** single-linkage can grow a cluster across a chain of near dots. Acceptable; the badge still communicates "many here," and fanning still works. Not special-cased.
- **Cluster near the map edge:** the fan ring may push handles toward/over the edge. Handles clamp to the viewBox like other coords; acceptable. (The dialog already pins to the opposite corner.)
- **Focused member then `points` change** (zone switch): the existing reset (`points` identity change clears `focused`/`hovered`) must also clear `expanded`.
- **A member lacking positions** (no `mnx/eny` — ~half of real data): hover still shows the gray real-spot node (it's just `nx,ny`); the engagement tracer/enemy ring simply don't draw (today's `hasPos` guard). The dialog still opens with outcome/round/side.
- **Reduced motion:** no animated fan; everything else identical.
- **Touch:** tap badge → fan, tap handle → focus/dialog. Hover previews don't fire (same as today's hover features).

---

## 8. Testing

**Unit (vitest):**

- `clusterDuels`: dots far apart → all singletons; two within `CLUSTER_RADIUS` → one cluster of 2 with correct centroid; a chain A-B-C each within radius → one cluster of 3; empty input → empty; deterministic/order-independent grouping; a singleton far from a pair → 1 cluster of 2 + 1 singleton.
- `fanPositions`: returns `n` points equidistant (`FAN_RADIUS`) from the centroid, deterministic ordering, correct count for n=2..8.

**Smoke (Playwright, `tests/smoke.spec.ts`):**

- Drill into a region whose detail contains a cluster (or inject), assert a **badge** (count) renders; click it → more dots appear (fan); click a fanned dot → the focus dialog opens (KILL/DEATH); Esc or empty-map click collapses. If finding a guaranteed cluster in live data is flaky, lean on the unit tests for clustering correctness and keep the smoke assertion to "badge exists and fans," or scope to a deterministic fixture.

**Manual:** open FragsMap → Regions → a busy zone; confirm badges on piled spots; click to fan; hover handles (one gray node moves, path stays anchored to the real spot, others dim); click for details; collapse via Esc/empty/​re-click; verify reduced-motion shows no fan animation.

---

## 9. Scope guard (YAGNI)

**In:** pure `clusterDuels` + `fanPositions` (+ two fixed visual constants); cluster badge; click-to-fan; anchored engagement geometry; single active gray real-spot node; collapse; the tests above; minor CSS for badge/leader/gray node.

**Out:** any data-derived radius/tuning; large-cluster spiral/pagination; touch gestures; heatmap clustering; dialog/tracer/heatmap/normalization changes; marker redesign; weapon filter; opener markers.
