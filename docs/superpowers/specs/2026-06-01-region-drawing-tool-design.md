# Region Drawing Tool — Design

**Date:** 2026-06-01
**Status:** Proposed (pending Kendall's review)

## Goal

A dev-only authoring tool to hand-trace **region polygons** over each map's minimap, exporting a committed `lib/maps/regions.json`. FragsMap then assigns duels by **point-in-polygon** and fills exact shapes — giving the room-accurate regions ("Link = the link box, B-Main = the hallway up to B-Site, zero bleed") that point-only callout data can't.

## Why polygons

Callout data is one point per area, so nearest-callout assignment mis-groups and bleeds. Polygons drawn by hand encode the real room boundaries. Once a map is traced, its regions become exact; untraced maps keep the current rough Voronoi view (graceful fallback).

## Coordinate space

Polygon vertices are stored in **normalized [0,1]** over the minimap displayIcon — the same space duels land in after `transformCoord`. So point-in-polygon is a direct comparison, no extra transform. A vertex = `[nx, ny]`; a region = `{ name: string, points: [number, number][] }`; the file = `{ [mapName]: Region[] }`.

## The tool (`/dev/regions`)

Dev-only (renders the editor only when `process.env.NODE_ENV === "development"`; in prod it shows a short "dev tool" notice). Not linked in Nav.

**Layout:** map picker (reuse `chip`) on top; the minimap rendered large in an SVG (fixed square, viewBox 0..100) with any existing/just-drawn polygons overlaid; a side panel listing regions + the export box.

**Drawing interactions:**

- Click on the map → adds a vertex to the _in-progress_ polygon (shown as connected path + vertex dots).
- **Undo** (button + Cmd/Ctrl-Z) removes the last vertex.
- **Finish region** → closes the polygon, prompts for a name (inline text input), adds it to the region list, clears the in-progress buffer.
- **Esc / Cancel** discards the in-progress polygon.
- Region list: each row shows name + vertex count + a **delete** button; clicking a row highlights that polygon on the map.
- **Seed names:** offer the map's callout `regionName`s as quick-fill suggestions for the name field (so naming is fast/consistent), but free text is allowed.

**Loading existing work:** on map select, pre-load that map's regions from `regions.json` (if present) so tracing can be resumed/edited across sessions.

**Export:** a read-only textarea shows the full `regions.json` (all maps), with **Copy** and **Download** buttons. Kendall saves it to `lib/maps/regions.json` and commits. (No server write — keeps the tool side-effect-free and safe.)

## Consumption in FragsMap

- `lib/maps/regions.ts`: `getRegions(map)` (from `regions.json`, `{}` default), `pointInPolygon(pt, polygon)` (ray-cast), `assignByPolygon(points, regions)` → per-region `{name, wins, total, winRate, muted, polygon, centroid}`. Points outside all polygons are unassigned (not shaded).
- `RegionView`: **if the active map has polygons**, render exact polygon `<path>` fills colored by `winRateColor` (label + `%·count` at each polygon centroid; click a polygon to drill in). **Else** fall back to the current masked-raster Voronoi view. So traced maps upgrade automatically.

## Testing

- Unit: `pointInPolygon` (inside/outside/edge cases), `assignByPolygon` (bucketing + aggregation + unassigned points).
- The editor page is dev-only and interaction-heavy; cover the pure geometry with units, smoke just asserts the page renders in dev.

## Out of scope (v1)

- Multi-vertex drag-editing of an existing polygon (delete + re-trace instead).
- Holes/concave-validation, snapping to callouts, auto-close.
- Server-side file writing (export via download/copy only).

## Open design choices (confirm)

1. **Fallback:** traced maps use polygons, untraced keep the rough raster — agreed? (Recommended.)
2. **Naming seed:** pre-offer callout names as suggestions — useful, or just free text?
3. **One region file** (`regions.json`, all maps) vs per-map files — recommend one file for simplicity.
