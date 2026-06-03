# Region Editing (Effort B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/dev/regions` reshape and rename an existing saved region — move/insert/delete vertices and edit its name — instead of only delete-and-retrace.

**Architecture:** A new React-free `lib/maps/region-edit.ts` holds the four pure geometry helpers (unit-tested). `components/dev/RegionEditor.tsx` gains an edit mode (`editing`/`editVertex`/`editName` state, a `live` ref to keep event handlers stale-free, a per-session `editHistory` undo stack) and SVG pointer wiring for vertex drag, midpoint-insert drag, click-to-select + Delete-to-heal, in-edit rename, and Cmd/Z undo. Save/codegen pipeline untouched.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, Vitest (`@/` alias), Playwright smoke. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-06-02-region-editing-design.md`

---

## File Structure

- **Create** `lib/maps/region-edit.ts` — pure helpers: `midpoints`, `moveVertex`, `insertVertex`, `deleteVertex`.
- **Create** `tests/region-edit.test.ts` — unit tests for the four helpers.
- **Modify** `components/dev/RegionEditor.tsx` — edit-mode state, handlers, render, Edit/Done buttons, name field.
- **Modify** `tests/smoke.spec.ts` — assert the edit UI (handles + name field) appears.

All work happens on the `region-editing` branch (already checked out, spec committed).

---

## Task 1: Pure geometry helpers (`lib/maps/region-edit.ts`)

**Files:**

- Create: `lib/maps/region-edit.ts`
- Test: `tests/region-edit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/region-edit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  midpoints,
  moveVertex,
  insertVertex,
  deleteVertex,
  type Pt,
} from "@/lib/maps/region-edit";

const square: Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

describe("midpoints", () => {
  it("returns one midpoint per edge, including the closing edge", () => {
    expect(midpoints(square)).toEqual([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]);
  });
});

describe("moveVertex", () => {
  it("replaces the vertex at index i", () => {
    expect(moveVertex(square, 1, [2, 2])).toEqual([
      [0, 0],
      [2, 2],
      [1, 1],
      [0, 1],
    ]);
  });
  it("returns the input unchanged for an out-of-range index", () => {
    expect(moveVertex(square, 9, [2, 2])).toBe(square);
  });
  it("does not mutate the input", () => {
    moveVertex(square, 0, [9, 9]);
    expect(square[0]).toEqual([0, 0]);
  });
});

describe("insertVertex", () => {
  it("splices the new point at edgeIndex + 1", () => {
    expect(insertVertex(square, 0, [0.5, 0])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  });
  it("appends when splitting the closing edge", () => {
    expect(insertVertex(square, 3, [0, 0.5])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0.5],
    ]);
  });
});

describe("deleteVertex", () => {
  it("removes the vertex and heals for n > 3", () => {
    expect(deleteVertex(square, 1)).toEqual([
      [0, 0],
      [1, 1],
      [0, 1],
    ]);
  });
  it("returns null when the result would drop below 3 vertices", () => {
    const triangle: Pt[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    expect(deleteVertex(triangle, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/region-edit.test.ts`
Expected: FAIL — cannot resolve `@/lib/maps/region-edit`.

- [ ] **Step 3: Implement the module**

Create `lib/maps/region-edit.ts`:

```ts
export type Pt = [number, number];

/** Midpoint of every edge i -> i+1, wrapping the last edge back to the first. */
export function midpoints(points: Pt[]): Pt[] {
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2] as Pt;
  });
}

/** Replace vertex i with pt. Out-of-range i returns the input unchanged. */
export function moveVertex(points: Pt[], i: number, pt: Pt): Pt[] {
  if (i < 0 || i >= points.length) return points;
  const out = points.slice();
  out[i] = pt;
  return out;
}

/** Insert pt into the edge edgeIndex (i -> i+1), spliced at edgeIndex + 1. */
export function insertVertex(points: Pt[], edgeIndex: number, pt: Pt): Pt[] {
  const out = points.slice();
  out.splice(edgeIndex + 1, 0, pt);
  return out;
}

/** Remove vertex i and heal. Returns null if the result would have < 3 vertices. */
export function deleteVertex(points: Pt[], i: number): Pt[] | null {
  if (points.length <= 3) return null;
  if (i < 0 || i >= points.length) return points;
  return points.filter((_, idx) => idx !== i);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/region-edit.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/maps/region-edit.ts tests/region-edit.test.ts
git commit -m "Add pure region-edit geometry helpers"
```

---

## Task 2: Edit-mode scaffolding in `RegionEditor.tsx`

Adds the edit-mode state, enter/exit, the Edit + Done buttons, the name field, and the SVG handle overlay (rendered but not yet draggable). Drag/delete/undo wiring comes in Tasks 3–4.

**Files:**

- Modify: `components/dev/RegionEditor.tsx`
- Test: `tests/smoke.spec.ts`

- [ ] **Step 1: Write the failing smoke test**

Add to `tests/smoke.spec.ts` (after the existing `region drawing editor renders in dev` test):

```ts
test("region editor enters edit mode with handles and a name field", async ({
  page,
}) => {
  await page.goto("/dev/regions");
  // Ascent loads by default with saved regions; click the first row's Edit.
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  // Name field appears, pre-filled.
  await expect(page.getByPlaceholder("Region name…")).toBeVisible();
  // Vertex/midpoint handles render as SVG circles.
  expect(await page.locator("svg circle").count()).toBeGreaterThan(0);
  // Done exits edit mode.
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByPlaceholder("Region name…")).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec playwright test -g "enters edit mode"`
Expected: FAIL — no `Edit` button / no name field yet.

- [ ] **Step 3: Add edit-mode state and helpers**

In `components/dev/RegionEditor.tsx`, first update the import from `region-edit` and `Pt`. The file already defines `type Pt = [number, number];` locally — keep it. Add this import near the other `@/lib/maps` imports:

```ts
import {
  midpoints,
  moveVertex,
  insertVertex,
  deleteVertex,
} from "@/lib/maps/region-edit";
```

After the existing `const [saveStatus, setSaveStatus] = useState("");` line, add:

```ts
const [editing, setEditing] = useState<number | null>(null);
const [editVertex, setEditVertex] = useState<number | null>(null);
const [editName, setEditName] = useState("");
const editHistory = useRef<{ points: Pt[]; name: string }[]>([]);
const dragging = useRef<number | null>(null);
const moved = useRef(false);
```

Immediately after the `calloutNames` `useMemo` block, add a `live` ref mirror (kept fresh every render) plus the edit helpers:

```ts
// Mirror of edit-relevant state so the window keydown listener and pointer
// handlers always read current values without stale closures.
const live = useRef({ editing, editVertex, regions });
live.current = { editing, editVertex, regions };

const snapshot = () => {
  const { editing, regions } = live.current;
  if (editing === null) return;
  const r = regions[editing];
  editHistory.current.push({
    points: r.points.map((p) => [...p] as Pt),
    name: r.name,
  });
};

const enterEdit = (i: number) => {
  if (buffer.length) return;
  setEditing(i);
  setSelected(i);
  setEditVertex(null);
  setEditName(regions[i].name);
  editHistory.current = [];
};

const exitEdit = () => {
  setEditing(null);
  setEditVertex(null);
  editHistory.current = [];
};

const editUndo = () => {
  const { editing } = live.current;
  const prev = editHistory.current.pop();
  if (!prev || editing === null) return;
  setRegions((r) =>
    r.map((x, idx) =>
      idx === editing ? { name: prev.name, points: prev.points } : x,
    ),
  );
  setEditName(prev.name);
};
```

- [ ] **Step 4: Reset edit state on map switch and on deleting the edited region**

In `selectMap`, after `setSaveStatus("");`, add:

```ts
setEditing(null);
setEditVertex(null);
setEditName("");
editHistory.current = [];
```

Replace the body of `deleteRegion` with a version that also exits/shifts edit state:

```ts
const deleteRegion = (i: number) => {
  setRegions((r) => r.filter((_, idx) => idx !== i));
  setSelected((s) => (s === i ? null : s !== null && s > i ? s - 1 : s));
  if (editing === i) exitEdit();
  else if (editing !== null && editing > i) setEditing(editing - 1);
};
```

- [ ] **Step 5: Render a single shared callout `datalist`**

The `datalist` with `id="callout-names"` currently lives inside the `{naming && (...)}` block, so it is absent in edit mode. Move it out: delete the `<datalist id="callout-names">…</datalist>` element from inside the naming block, and add one copy just inside the top of the returned `<main>` (right after the opening `<main ...>` tag):

```tsx
<datalist id="callout-names">
  {calloutNames.map((n) => (
    <option key={n} value={n} />
  ))}
</datalist>
```

- [ ] **Step 6: Add the edit toolbar (name field + Done) above the canvas**

Directly before the `<div style={{ position: "relative", maxWidth: 640 }}>` that wraps the `<svg>`, add:

```tsx
{
  editing !== null && (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 10,
        padding: 12,
        borderRadius: 8,
        background: "#161b26",
        border: "1px solid #2c3447",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--muted)" }}>Editing</span>
      <input
        list="callout-names"
        value={editName}
        placeholder="Region name…"
        onChange={(e) => onEditNameChange(e.target.value)}
        style={{
          flex: 1,
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid #2c3447",
          background: "#0c0f16",
          color: "#e6e9f0",
          fontSize: 14,
        }}
      />
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        Drag vertices · drag green midpoints to add · click + Delete to remove ·
        ⌘Z undo
      </span>
      <button style={btn("primary")} onClick={exitEdit}>
        Done
      </button>
    </div>
  );
}
```

Note: `onEditNameChange` is defined in Task 4. For this task, temporarily wire `onChange={(e) => { setEditName(e.target.value); setRegions((r) => r.map((x, idx) => (idx === editing ? { ...x, name: e.target.value } : x))); }}` so the field works; Task 4 replaces it with `onEditNameChange` (which adds the undo snapshot). If implementing Tasks 2–4 in one pass, define `onEditNameChange` now and use it directly.

- [ ] **Step 7: Render the handle overlay**

Immediately after the closing `)` of the `{/* Completed regions */}` `regions.map(...)` block (and before `{/* In-progress polygon */}`), add the handle overlay. Handlers `onVertexDown` / `onMidpointDown` are defined in Task 3 — for this task render the circles as static (no `onPointerDown`); Task 3 adds the handlers. If implementing in one pass, include the `onPointerDown` props now.

```tsx
{
  /* Edit-mode handles */
}
{
  editing !== null &&
    regions[editing] &&
    regions[editing].points.length >= 3 && (
      <g>
        {midpoints(regions[editing].points).map((m, e) => (
          <circle
            key={`m${e}`}
            cx={m[0] * 100}
            cy={m[1] * 100}
            r={1.6}
            fill="#0c0f16"
            stroke="#5effa0"
            strokeWidth={0.6}
            style={{ cursor: "copy" }}
            onPointerDown={onMidpointDown(e)}
          />
        ))}
        {regions[editing].points.map((p, vi) => (
          <circle
            key={`v${vi}`}
            cx={p[0] * 100}
            cy={p[1] * 100}
            r={2.2}
            fill={vi === editVertex ? "#fff" : "#7db4ff"}
            stroke="#11151d"
            strokeWidth={0.5}
            style={{ cursor: "grab" }}
            onPointerDown={onVertexDown(vi)}
          />
        ))}
      </g>
    );
}
```

- [ ] **Step 8: Add the Edit button to each region row**

In the region list, inside the row `.map((r, i) => { ... })`, before the existing Delete `<button>`, add an Edit button (only for real polygons, disabled mid-trace):

```tsx
{
  !empty && (
    <button
      style={{
        ...btn(),
        padding: "2px 8px",
        fontSize: 12,
        opacity: buffer.length ? 0.5 : 1,
      }}
      disabled={!!buffer.length}
      onClick={(e) => {
        e.stopPropagation();
        enterEdit(i);
      }}
    >
      {i === editing ? "Editing…" : "Edit"}
    </button>
  );
}
```

- [ ] **Step 9: Guard `handleCanvasClick` while editing**

At the top of `handleCanvasClick`, change `if (naming) return;` to:

```ts
if (naming || editing !== null) return;
```

- [ ] **Step 10: Run typecheck, lint, and the smoke test**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (if `onVertexDown`/`onMidpointDown`/`onEditNameChange` are referenced but defined in Tasks 3–4, either implement those now or stub them as `const onVertexDown = (_i: number) => (_e: React.PointerEvent) => {};` etc. — prefer implementing Tasks 3–4 in the same pass so no stubs are needed.)

Run: `pnpm exec playwright test -g "enters edit mode"`
Expected: PASS — Edit button enters edit mode, name field + circles visible, Done exits.

- [ ] **Step 11: Commit**

```bash
git add components/dev/RegionEditor.tsx tests/smoke.spec.ts
git commit -m "Add region edit-mode scaffolding: enter/exit, name field, handle overlay"
```

---

## Task 3: Vertex drag (move) and midpoint-insert drag

**Files:**

- Modify: `components/dev/RegionEditor.tsx`

- [ ] **Step 1: Add the pointer helpers and drag handlers**

After the `editUndo` definition (Task 2), add:

```ts
// clientX/Y -> normalized [0,1] coords, clamped to the minimap.
const toNorm = (e: { clientX: number; clientY: number }): Pt => {
  const rect = svgRef.current!.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  return [Math.min(1, Math.max(0, nx)), Math.min(1, Math.max(0, ny))];
};

const onVertexDown = (i: number) => (e: React.PointerEvent) => {
  e.stopPropagation();
  setEditVertex(i);
  dragging.current = i;
  moved.current = false;
  svgRef.current?.setPointerCapture(e.pointerId);
};

const onMidpointDown = (edgeIndex: number) => (e: React.PointerEvent) => {
  e.stopPropagation();
  const { editing } = live.current;
  if (editing === null) return;
  snapshot();
  const pt = toNorm(e);
  setRegions((r) =>
    r.map((x, idx) =>
      idx === editing
        ? { ...x, points: insertVertex(x.points, edgeIndex, pt) }
        : x,
    ),
  );
  const newIndex = edgeIndex + 1;
  setEditVertex(newIndex);
  dragging.current = newIndex;
  moved.current = true; // the insert is itself the mutation already snapshotted
  svgRef.current?.setPointerCapture(e.pointerId);
};

const onPointerMove = (e: React.PointerEvent) => {
  const { editing } = live.current;
  if (dragging.current === null || editing === null) return;
  if (!moved.current) {
    snapshot();
    moved.current = true;
  }
  const pt = toNorm(e);
  const vi = dragging.current;
  setRegions((r) =>
    r.map((x, idx) =>
      idx === editing ? { ...x, points: moveVertex(x.points, vi, pt) } : x,
    ),
  );
};

const onPointerUp = () => {
  dragging.current = null;
};
```

- [ ] **Step 2: Wire the SVG pointer events**

On the `<svg ref={svgRef} ...>` element, add `onPointerMove` and `onPointerUp` next to the existing `onClick={handleCanvasClick}`:

```tsx
onClick = { handleCanvasClick };
onPointerMove = { onPointerMove };
onPointerUp = { onPointerUp };
```

(If Task 2 rendered the handle circles without `onPointerDown`, add `onPointerDown={onVertexDown(vi)}` and `onPointerDown={onMidpointDown(e)}` to them now, per the Task 2 Step 7 markup.)

- [ ] **Step 3: Typecheck, lint, build**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/dev/RegionEditor.tsx lib/maps/region-edit.ts`
Expected: PASS.

Run: `pnpm exec playwright test -g "enters edit mode"`
Expected: PASS (still green — drag is exercised manually).

- [ ] **Step 4: Manual verification**

`pnpm dev`, open `/dev/regions`, Edit a region, drag a vertex (it follows the cursor, clamped to the map), drag a green midpoint (a new vertex appears on that edge and follows the cursor). Confirm the export JSON updates live.

- [ ] **Step 5: Commit**

```bash
git add components/dev/RegionEditor.tsx
git commit -m "Add vertex-move and midpoint-insert dragging to region editor"
```

---

## Task 4: Delete-to-heal, rename snapshot, and keyboard routing

**Files:**

- Modify: `components/dev/RegionEditor.tsx`

- [ ] **Step 1: Add delete + rename handlers**

After `onPointerUp` (Task 3), add:

```ts
const deleteSelected = () => {
  const { editing, editVertex, regions } = live.current;
  if (editing === null || editVertex === null) return;
  const next = deleteVertex(regions[editing].points, editVertex);
  if (!next) return; // 3-vertex guard: no-op
  snapshot();
  setRegions((r) =>
    r.map((x, idx) => (idx === editing ? { ...x, points: next } : x)),
  );
  setEditVertex(null);
};

const onEditNameChange = (v: string) => {
  const { editing } = live.current;
  if (editing === null) return;
  snapshot();
  setEditName(v);
  setRegions((r) =>
    r.map((x, idx) => (idx === editing ? { ...x, name: v } : x)),
  );
};
```

If Task 2 Step 6 used the temporary inline `onChange`, replace it with `onChange={(e) => onEditNameChange(e.target.value)}` now.

- [ ] **Step 2: Extend the keyboard handler**

Replace the body of the existing `onKey` function (inside the keydown `useEffect`) with:

```ts
const onKey = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "TEXTAREA") return;
  const { editing, editVertex } = live.current;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (editing !== null) editUndo();
    else if (tag !== "INPUT") undo();
  } else if (e.key === "Escape") {
    if (editing !== null) exitEdit();
    else cancel();
  } else if (
    (e.key === "Delete" || e.key === "Backspace") &&
    editing !== null &&
    editVertex !== null &&
    tag !== "INPUT"
  ) {
    e.preventDefault();
    deleteSelected();
  }
};
```

The effect keeps its empty dependency array (`[]`) — all dynamic values are read from `live.current` and `editHistory`/`dragging` refs, so the single mounted listener stays correct. (`undo`, `cancel`, `editUndo`, `deleteSelected`, `exitEdit` are module-stable enough for this dev tool; if `react-hooks/exhaustive-deps` flags them, add a single `// eslint-disable-next-line react-hooks/exhaustive-deps` above the dependency array, matching the existing pattern in this file.)

- [ ] **Step 3: Typecheck, lint, build**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/dev/RegionEditor.tsx`
Expected: PASS.

Run: `pnpm build`
Expected: PASS (production build compiles).

- [ ] **Step 4: Manual verification**

`pnpm dev`, `/dev/regions`, Edit a region: click a vertex (turns white), press Delete → it's removed and the shape heals; on a triangle, Delete is a no-op. Rename in the field. Press ⌘Z repeatedly → move/insert/delete/rename all step back. Esc exits edit mode. Save and confirm the JSON reflects the edits.

- [ ] **Step 5: Run the full unit + smoke suites**

Run: `pnpm exec vitest run`
Expected: PASS (region-edit suite + existing suites).

Run: `pnpm exec playwright test`
Expected: PASS (all smoke tests including the new edit-mode test).

- [ ] **Step 6: Commit**

```bash
git add components/dev/RegionEditor.tsx
git commit -m "Add delete-to-heal, rename undo, and keyboard routing to region editor"
```

---

## Final verification

- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm exec eslint .` — clean (or only the pre-existing accepted warnings).
- [ ] `pnpm exec vitest run` — all unit tests pass.
- [ ] `pnpm exec playwright test` — all smoke tests pass.
- [ ] `pnpm build` — production build succeeds.
- [ ] Manual: full edit cycle on a real map (move, insert, delete + guard, rename, undo, Done, Save).
