# Region Editing (Effort B) — Design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)
**Goal:** Let the dev-only `/dev/regions` editor reshape and rename an existing saved region — move/insert/delete its vertices and edit its name — instead of only delete-and-retrace.

This is **Effort B** of two. Effort A (region assignment robustness + issue surfacing) shipped 2026-06-02 (commit 251f57a).

---

## 1. Problem

`components/dev/RegionEditor.tsx` can trace a new polygon, name it, select-to-highlight a saved region, and delete a whole region. It **cannot** modify a saved region: a vertex in the wrong spot, a missing corner, or a typo'd name all force a full delete-and-retrace. The Effort A issue surfaces (`/dev/issues`, `/fragsmap` notice) point at zones that need tightening — but there's no way to tighten them short of redrawing.

---

## 2. Experience

Each region row in the list gets an **Edit** button (beside Delete). Clicking it enters **edit mode** for that region:

- Trace mode is suspended (canvas clicks no longer add trace vertices).
- The polygon renders **draggable vertex handles** (solid dots) and **hollow midpoint handles** (one per edge).
- A **name field** appears above the canvas, pre-filled with the region's name (callout autocomplete via the existing `datalist`).

Gestures in edit mode:

- **Move:** drag a solid vertex handle → that vertex follows the cursor (normalized 0–1).
- **Insert:** drag a hollow midpoint handle → a new vertex splits _that one edge_, wired to the two vertices that defined it; the rest of the polygon is untouched. The new vertex becomes the selected vertex so it can be nudged further.
- **Delete:** click a vertex (turns white = selected), press Delete/Backspace → the vertex is removed and its two neighbors join directly (the shape heals and stays closed). **Guard:** disabled when the polygon has only 3 vertices (delete the whole region instead).
- **Rename:** edit the name field → updates the region's name in place.
- **Undo:** Cmd/Ctrl+Z steps back through edit actions (move, insert, delete, rename) within the current edit session.
- **Exit:** a **Done** button, or Esc, exits edit mode.

Save / Copy / Download are unchanged — they already derive from live region state, so edits are reflected immediately. Switching maps or regions exits edit mode and discards edit-session undo history (the geometry itself is kept in `regions` state until Save, exactly as today).

---

## 3. Architecture

### 3.1 Pure helper module — `lib/maps/region-edit.ts`

Geometry operations live in a React-free, unit-tested module. `Pt = [number, number]`.

```ts
export type Pt = [number, number];

// Midpoint of each edge i -> i+1 (wrapping last -> first). Length === points.length.
export function midpoints(points: Pt[]): Pt[];

// Replace vertex i with pt. Returns a new array; out-of-range i returns input unchanged.
export function moveVertex(points: Pt[], i: number, pt: Pt): Pt[];

// Insert pt as a new vertex splitting edge `edgeIndex` (edge i -> i+1),
// i.e. spliced in at index edgeIndex + 1. Returns a new array.
export function insertVertex(points: Pt[], edgeIndex: number, pt: Pt): Pt[];

// Remove vertex i and heal (neighbors join). Returns null if the result
// would have < 3 vertices (caller keeps the polygon unchanged).
export function deleteVertex(points: Pt[], i: number): Pt[] | null;
```

- `midpoints` returns one point per edge, including the closing edge (last → first), matching how the polygon renders closed.
- `insertVertex(points, edgeIndex, pt)` splices `pt` at `edgeIndex + 1` so it sits between the two endpoints of that edge.
- `deleteVertex` returns `null` (not a mutated array) when `points.length <= 3`, so the component can no-op cleanly.
- All return new arrays (no mutation), so they slot into React state and the undo stack directly.

### 3.2 `RegionEditor.tsx` state additions

- `editing: number | null` — index of the region in edit mode. Mutually exclusive with the trace `buffer` (you can't trace a new polygon while editing one). Entering edit mode requires `buffer.length === 0`; if a trace is in progress, the Edit buttons are disabled.
- `editVertex: number | null` — index of the currently selected vertex within the editing polygon (for delete). Set on vertex click; cleared on exit / region switch / after delete.
- `editName: string` — the in-progress name in edit mode (seeded from the region's name on enter; commits to `regions[editing].name` on change).
- `editHistory: { points: Pt[]; name: string }[]` — snapshot stack for the current edit session. A snapshot of the editing region (points + name) is pushed **before** each mutating action (drag start, insert, delete, rename keystroke-batch). `editUndo()` pops the last snapshot and restores it. Cleared on `enterEdit` (starts empty), `exitEdit`, region switch, and map switch.

### 3.3 Interaction wiring (SVG)

- **Enter edit mode** (`enterEdit(i)`): set `editing = i`, `editName = regions[i].name`, clear `editVertex` and `editHistory`. Guarded by `buffer.length === 0`.
- **Vertex handles:** rendered only for `regions[editing]`. Each `<circle>` gets `onPointerDown` → push undo snapshot, set `editVertex`, begin drag (capture pointer); a window/SVG `pointermove` updates that vertex via `moveVertex`; `pointerup` ends the drag. A pointer-down that doesn't move (click) just selects the vertex (white).
- **Midpoint handles:** rendered from `midpoints(regions[editing].points)`. `onPointerDown` → push undo snapshot, `insertVertex` at that edge, set `editVertex` to the new index, and immediately begin dragging the new vertex (same drag path as above).
- **Pointer→normalized coords:** reuse the existing `getBoundingClientRect` normalization from `handleCanvasClick` (extract a small `toNorm(e)` helper).
- **`handleCanvasClick`:** early-returns when `editing !== null` so background clicks don't add trace vertices.
- **Keyboard** (extend the existing `keydown` handler): when `editing !== null` and focus is not in an INPUT/TEXTAREA — Cmd/Ctrl+Z → `editUndo()`; Esc → `exitEdit()`; Delete/Backspace → delete the selected vertex (`deleteVertex` guarded). When not editing, today's behavior (buffer undo / cancel) is unchanged.
- **Name field:** an `<input>` above the canvas, shown only in edit mode, wired to `editName` with the callout `datalist`; `onChange` pushes an undo snapshot (debounced/coalesced is not required — a per-keystroke snapshot is acceptable at this scale) and updates `regions[editing].name`.
- **Done button:** `exitEdit()` — clears `editing`, `editVertex`, `editHistory`.
- Other (non-editing) polygons keep rendering as today; the editing polygon renders with handles instead of the plain fill.

### 3.4 Data flow / persistence

No change to Save. Edits mutate `regions` state (via the helpers), `exportRegions`/`exportJson` derive from it, and Save POSTs to the existing dev API (`/api/dev/regions`). The codegen/index pipeline is untouched.

---

## 4. Edge cases

- **Trace in progress:** Edit buttons disabled while `buffer.length > 0` (finish or cancel the trace first). Keeps the two modes from colliding.
- **Triangle delete:** `deleteVertex` returns `null`; the component no-ops and the vertex stays. (User deletes the whole region via the existing Delete button if they truly want it gone.)
- **Undo past the start of the session:** `editUndo()` on an empty `editHistory` is a no-op.
- **Switching map/region mid-edit:** `exitEdit()` runs first (existing `selectMap` already resets transient state; extend it to also clear edit state). Geometry edits already applied to `regions` persist in state (consistent with how a finished trace persists pre-Save).
- **Empty/seeded regions** (`points.length < 3`, from "Seed callout names"): the Edit button is hidden/disabled for point-less regions — there's nothing to reshape. They're traced fresh as today.
- **Dragging a vertex outside 0–1:** clamp normalized coords to `[0, 1]` so handles can't leave the minimap.

---

## 5. Testing

**Unit (vitest), `tests/region-edit.test.ts`:**

- `midpoints`: square → 4 midpoints at edge centers including the closing edge.
- `moveVertex`: replaces the right index; out-of-range index returns input; original array not mutated.
- `insertVertex`: inserts at `edgeIndex + 1`; new point lands between the correct two neighbors; length grows by 1.
- `deleteVertex`: removes the index and heals; returns `null` when input has 3 vertices; returns a length-`n-1` array for `n > 3`.

**Smoke (Playwright, `tests/smoke.spec.ts`):**

- `/dev/regions` edit affordance: open the page, click a region row's **Edit** button, assert vertex handles render (e.g. `svg circle` count > 0 for the editing polygon) and the name field is visible. (Drag simulation over SVG is brittle; assert the edit-mode UI appears rather than a full drag — geometry correctness is covered by the unit tests.)

**Manual:** open `/dev/regions`, Edit a region, drag a vertex, insert via a midpoint, delete a vertex (and confirm the 3-vertex guard), rename, Cmd/Z through it, Done, then Save and confirm the JSON reflects the edits.

---

## 6. Scope guard (YAGNI)

**In:** the `region-edit` pure helpers (move/insert/delete/midpoints) + their tests; edit-mode state and SVG drag/click wiring in `RegionEditor.tsx`; in-edit rename; per-session undo stack; the Edit button + Done button + keyboard routing; the smoke affordance test.

**Out (not now):** curved/bezier edges; box-select or multi-region editing; drag-the-whole-polygon translate; numeric coordinate inputs per vertex; persistent cross-session/redo history (undo is per edit session, no redo); snapping/grid; any change to the Save/codegen pipeline, the `/fragsmap` runtime, or `/dev/issues`.
