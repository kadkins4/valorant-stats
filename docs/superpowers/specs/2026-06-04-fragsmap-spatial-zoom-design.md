# FragsMap Spatial-Zoom Redesign — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design); spec for review
**Scope:** Replace the cramped side-by-side FragsMap with a single full-bleed map that has a Dots/Heatmap layer toggle and zooms into a region (via SVG `viewBox`) for detail. Deprecate the Grid view. The accessible data layer is a separate spec (Spec 3) built on the zoomed view created here.

## Problem

Today the FragsMap shows a full-map overview (ZoneGrid or RegionView) on the left and, after clicking a zone/region, a separate `DuelMap` panel on the right. The two share width ~50/50, so individual duel dots are tiny and overlapping dots are hard to read. Users can't get enough real estate to see what happened in a region.

## Solution Overview

One full-bleed map. A **Dots ↔ Heatmap** layer toggle replaces the current Grid/Regions toggle. Clicking a dot, cluster badge, or area zooms the map into that **region** — implemented by animating the SVG `viewBox` to the region's bounding box, which enlarges that slice of the actual minimap and spreads the dots apart. A breadcrumb and Esc return to the overview.

Because every coordinate (image, dots, polygons) already lives in a `0..100` SVG user space, zoom needs no re-projection: only the `viewBox` changes.

## Information Architecture

- **Single map component** replaces the left/right split. It fills the available width (no detail panel beside it).
- **Layer toggle (Dots / Heatmap):** a `role="group"` segmented control, `aria-pressed` per button, default **Dots**.
  - _Dots:_ every duel rendered as a kill-circle / death-✕ (the existing `DuelMap` dot + cluster + engagement logic), across the whole map.
  - _Heatmap:_ win%-colored regions (the existing `RegionView` polygon/raster rendering).
- **Filters unchanged:** Map picker, Side toggle, Seasons selector keep working and reset zoom when changed.
- **Grid view deprecated:** the Grid/Regions view toggle is removed. `ZoneGrid.tsx` and `ZoneDetail.tsx` stay in the repo (not deleted) but are no longer rendered or reachable from the default UI. Zone helpers they import remain.

## Zoom Mechanics

**State:** `zoomedRegion: number | null` on the orchestrator (index into the region list). `null` = overview.

**viewBox:** The map `<svg>` `viewBox` is:

- Overview: `"0 0 100 100"`.
- Zoomed: the region's bounding box scaled to `0..100`, padded, and clamped to `[0,100]`. A CSS transition on `viewBox` (or an animated interpolation) gives the "lean-in" feel. Target ~`0.3s ease`.

**Region bounds (`regionBounds(region, duels)` helper, new in `lib/fightmap/zoom.ts`):**

- Traced map (has `polygon`): bbox of the polygon points.
- Untraced map (callout region, no polygon): bbox of the duels assigned to that region.
- Apply padding = 8% of the bbox's larger dimension (min padding 4 user units), then clamp each edge to `[0,100]`.
- Enforce a minimum bbox side of 20 user units so a tiny region doesn't zoom to an extreme magnification; expand symmetrically around the center if needed, then re-clamp.
- Returns `{ x, y, w, h }` for the `viewBox` string `"x y w h"`.

**Click semantics:**

- _Overview, Dots layer:_ clicking a dot, cluster badge, or empty area → resolve the region containing that point (reuse the existing point→region assignment: polygon `assignFrags` for traced, nearest-callout otherwise) and set `zoomedRegion`. Clicking a cluster badge zooms rather than fanning (zoom supersedes the fan-out at overview scale).
- _Overview, Heatmap layer:_ clicking a colored region → set `zoomedRegion` to it.
- _Zoomed (either layer):_ the Dots layer is active and shows only that region's duels. Clicking a dot opens the detail dialog (existing `focused` behavior). Clicking empty space inside the zoom does nothing (does not unzoom — use the breadcrumb/Esc, to avoid accidental exits).

**Return to overview:** a breadcrumb (`◀ All regions / <Region name>`) above the map, clickable; and Esc. Both clear `zoomedRegion`, the dialog, and any cluster fan state.

## Layers

**Dots layer.** Reuses the `DuelMap` rendering (dots, cluster badges, engagement tracer, detail dialog) with these changes:

- It no longer lives in a side panel; it is the map.
- Overview shows **all** duels for the current filters. Zoomed shows only the zoomed region's duels (filtered the same way `regionPoints` is computed today).
- _Dim/hide siblings (bug fix):_ when zoomed, only the region's duels are present, so unrelated dots are gone entirely — resolving the "can't see anything when a cluster is expanded" complaint. Within a zoom, hover-dim of other dots stays as-is.
- _Engagement on hover (already fixed):_ the data-fidelity fix (shipped) means ~100% of dots now have a populated engagement tracer.

**Heatmap layer.** Reuses `RegionView`'s polygon/raster coloring (`winRateColor`, per-region win% + count labels). It is an **overview-only** layer: clicking a region while on Heatmap sets `zoomedRegion` **and** switches the active layer to Dots, so the zoom always shows individual duels (the heatmap's job is the at-a-glance overview, not the zoomed detail). There is therefore no "zoomed heatmap" state to define.

## Component Architecture

- **`FightMap.tsx` (orchestrator, modified):** drops `view`/`selected`/`selectedRegion`; adds `layer: "dots" | "heatmap"` and `zoomedRegion: number | null`. Renders the filter controls, the layer toggle, the breadcrumb (when zoomed), and a single new map component. Computes the region list (poly or callout) and the point→region assignment once, passes down.
- **`FragMap.tsx` (new):** the single full-bleed map. Owns the `<svg>` + `viewBox` (driven by `zoomedRegion` + `regionBounds`), renders the minimap `<image>`, and switches between the Dots and Heatmap layer renderers. Owns zoom/click orchestration and the breadcrumb hook. Delegates dot rendering to the existing `DuelMap` internals and heatmap rendering to the existing `RegionView` internals (extract their inner render bodies into layer subcomponents if cleaner, without changing their visuals).
- **`lib/fightmap/zoom.ts` (new):** pure `regionBounds(...)` + a small `viewBoxString(...)` helper. Unit-tested.
- **`RegionView.tsx` / `DuelMap.tsx`:** refactored so their rendering can run inside `FragMap`'s single `<svg>` and respond to the shared `viewBox`/zoom. Keep their existing visual output.
- **Deprecated (kept, unwired):** `ZoneGrid.tsx`, `ZoneDetail.tsx`, and the Grid branch of `FightMap`.

## Data Flow

`FightMap` already computes `points` (Placed[]), `polyStats`/`regions`, and the point→region assignment (`frags.assignment` for traced, nearest-callout otherwise). The redesign reuses all of it:

- Overview Dots: render all `points`.
- Zoom target on click: map the clicked point/region to a region index using the existing assignment.
- Zoomed Dots: `points` filtered to `zoomedRegion` (same logic as today's `regionPoints`).
- `regionBounds(region, regionPoints)` → `viewBox`.

## Error Handling / Edge Cases

- **No calibration / no duels:** unchanged messaging ("No minimap calibration…" / "No duels for this filter…").
- **Untraced map:** no polygons → callout regions; zoom uses the duel-bbox fallback. If a clicked area has no nearby region, ignore the click (no zoom).
- **Region with 1 duel:** min-bbox rule prevents extreme zoom; the single dot sits centered.
- **Muted (low-sample) region:** still zoomable; the dialog and dots behave normally. Heatmap keeps the muted styling.
- **Filter change while zoomed:** resets `zoomedRegion` to null (back to overview) since indices may shift.

## Testing

**Unit (Vitest), `tests/zoom.test.ts` (new):**

- `regionBounds` for a traced polygon returns the padded, clamped bbox.
- Min-bbox enforcement expands a tiny region to the floor size, centered.
- Clamping keeps a corner region's bbox within `[0,100]`.
- Untraced fallback uses the duel bbox.

**Smoke (Playwright), `tests/smoke.spec.ts` (updated/added):**

- The map renders with a Dots/Heatmap toggle exposing pressed state.
- Default layer is Dots; the map shows duel markers (`svg [data-duel]`).
- Switching to Heatmap shows colored regions; switching back shows dots.
- Clicking a duel/region zooms in: the breadcrumb appears and the region name is shown. (Assert the `viewBox` is no longer `"0 0 100 100"`, or that the breadcrumb/region-name node is visible.)
- The breadcrumb (and Esc) returns to the overview (`viewBox` back to full; breadcrumb gone).
- Existing FragsMap smoke tests are migrated to the new structure (no Grid/Regions buttons; use the layer toggle).

## Out of Scope (Spec 3 — Accessible Data Layer)

The keyboard/screen-reader equivalent of the dots — a `<table>` breakdown of the zoomed region's duels, focusable duel rows that two-way-sync with the dots (`aria-current`), and marking decorative SVG `aria-hidden` — is a separate spec built on the zoomed view defined here. Spec 3 supersedes the earlier Phase-2 accessibility spec.

## Decisions (resolved during brainstorming)

- True spatial zoom (crop into the region), not full-width-same-scale.
- Overview shows individual dots (plus cluster badges); zoom declutters.
- Win% heatmap kept as a **toggle layer** on the same map.
- Zoom target snaps to the **region** containing the click.
- Grid view **deprecated, not deleted**; new dots/zoom is the default.
