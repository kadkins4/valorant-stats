# FragsMap Zoom "Lean-In" Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate the FragsMap SVG `viewBox` between overview and a zoomed region (450ms ease-in-out cubic, both directions, interruption-safe, reduced-motion snaps) instead of snapping instantly.

**Architecture:** Two pure functions (`easeInOutCubic`, `lerpViewBox`) added to the existing `lib/fightmap/zoom.ts`, consumed by a new `requestAnimationFrame` hook `useAnimatedViewBox`. `FragMap.tsx` computes the target as a `ViewBox` object and feeds it through the hook to get the animated `viewBox` string it passes to the untouched `DuelMap`.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, Vitest (node env, `@/` alias, `tests/**/*.test.ts`), Playwright smoke (`tests/smoke.spec.ts`). pnpm.

**Key constraints for the implementer:**

- The worktree shares localhost port 3000 with the user's main dev server. Run Playwright with `TEST_PORT=3001 pnpm exec playwright test` (the config reads `process.env.TEST_PORT ?? "3000"`).
- `timeout` is not available on macOS — never wrap commands in it.
- Vitest runs in a **node** environment with **no jsdom / React-hook testing infra**. Do NOT add a unit test that renders the hook. The pure math is unit-tested (Task 1); the hook is verified by `tsc` + Playwright smoke (Task 2). Do not add new test dependencies.
- `ViewBox`, `FULL_VIEWBOX`, `regionBounds`, `viewBoxString` already exist in `lib/fightmap/zoom.ts`. Reuse them; do not redefine.

---

### Task 1: Pure interpolation + easing math

**Files:**

- Modify: `lib/fightmap/zoom.ts` (append two exported functions)
- Test: `tests/zoom.test.ts` (append a new `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `tests/zoom.test.ts` (keep the existing `regionBounds` describe block above it). Add the two new symbols to the existing import on line 2 so it reads:

```ts
import {
  regionBounds,
  viewBoxString,
  FULL_VIEWBOX,
  easeInOutCubic,
  lerpViewBox,
} from "@/lib/fightmap/zoom";
```

Then append this block at the end of the file:

```ts
describe("easeInOutCubic", () => {
  it("pins the endpoints at 0 and 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("is symmetric about the midpoint", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    // f(t) + f(1 - t) === 1 for an ease-in-out curve.
    expect(easeInOutCubic(0.3) + easeInOutCubic(0.7)).toBeCloseTo(1);
  });

  it("stays within [0,1] and is monotonic non-decreasing", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = easeInOutCubic(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("lerpViewBox", () => {
  const from = { x: 0, y: 0, w: 100, h: 100 };
  const to = { x: 20, y: 40, w: 30, h: 50 };

  it("returns from at t=0", () => {
    expect(lerpViewBox(from, to, 0)).toEqual(from);
  });

  it("returns to at t=1", () => {
    expect(lerpViewBox(from, to, 1)).toEqual(to);
  });

  it("returns the exact midpoint of each component at t=0.5", () => {
    expect(lerpViewBox(from, to, 0.5)).toEqual({ x: 10, y: 20, w: 65, h: 75 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/zoom.test.ts`
Expected: FAIL — the new tests error on the missing imports `easeInOutCubic` / `lerpViewBox` (the existing `regionBounds` tests still pass).

- [ ] **Step 3: Implement the two functions**

Append to `lib/fightmap/zoom.ts` (after the existing `viewBoxString` function):

```ts
// Ease-in-out cubic. t in [0,1] -> eased [0,1]. Endpoints fixed at 0 and 1.
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Component-wise linear interpolation between two view boxes at parameter t in [0,1].
export function lerpViewBox(from: ViewBox, to: ViewBox, t: number): ViewBox {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/zoom.test.ts`
Expected: PASS — all `regionBounds`, `easeInOutCubic`, and `lerpViewBox` tests green.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/fightmap/zoom.ts tests/zoom.test.ts
git commit -m "Add viewBox lerp + ease-in-out cubic helpers"
```

---

### Task 2: Animated viewBox hook + FragMap rewire

**Files:**

- Create: `components/fightmap/useAnimatedViewBox.ts`
- Modify: `components/fightmap/FragMap.tsx` (lines ~35-43 target computation; line ~73 `viewBox` prop)
- Modify: `tests/smoke.spec.ts` (append one reduced-motion guard test)

**Context:** `FragMap` today computes a target `viewBox` **string** named `vb` and passes it to `DuelMap`. After this task it computes the target as a `ViewBox` **object**, runs it through `useAnimatedViewBox`, and passes the animated string to `DuelMap`. `DuelMap` is not modified — it renders whatever `viewBox` string it receives.

- [ ] **Step 1: Create the hook**

Create `components/fightmap/useAnimatedViewBox.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import {
  type ViewBox,
  lerpViewBox,
  easeInOutCubic,
  viewBoxString,
} from "@/lib/fightmap/zoom";

const DURATION = 450; // ms

const sameBox = (a: ViewBox, b: ViewBox) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * Animates the SVG viewBox toward `target` over DURATION ms with an
 * ease-in-out cubic curve. Returns the current (animated) viewBox as a string.
 *
 * - Interruption-safe: a mid-flight target change re-bases the animation from
 *   the current frame, so it continues smoothly with no jump.
 * - Respects prefers-reduced-motion by snapping instantly (no rAF).
 * - No animation on mount: starts already at the initial target.
 */
export function useAnimatedViewBox(target: ViewBox): string {
  // `current` (state) is what we render; `currentRef` mirrors it so the effect
  // can read the latest frame to re-base from on an interruption.
  const [current, setCurrent] = useState<ViewBox>(target);
  const currentRef = useRef<ViewBox>(target);
  const rafRef = useRef<number | null>(null);

  // IMPORTANT: depend on the target's VALUE (its string), not its object
  // reference. The consumer recomputes a fresh `target` object every render
  // (regionBounds returns a new object), and the rAF loop calls setCurrent each
  // frame, which re-renders. Keying the effect on the reference would cancel and
  // restart the animation every frame (stall). Keying on the string means the
  // effect only re-runs when the target actually changes value.
  const key = viewBoxString(target);

  useEffect(() => {
    // Already settled here (covers mount, where current was initialized to target).
    if (sameBox(currentRef.current, target)) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      currentRef.current = target;
      setCurrent(target);
      return;
    }

    const from = currentRef.current; // re-bases from the current frame on interrupt
    const start = performance.now();

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const next = lerpViewBox(from, target, easeInOutCubic(p));
      currentRef.current = next;
      setCurrent(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setCurrent(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // `target` is intentionally read via the value key; see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return viewBoxString(current);
}
```

- [ ] **Step 2: Typecheck the hook in isolation**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (There is no isolated unit test — vitest runs in a node env without React-hook testing infra. The hook is verified through FragMap by the smoke tests below.)

- [ ] **Step 3: Rewire FragMap to use the hook**

In `components/fightmap/FragMap.tsx`:

Update the import on line 5 to add `useAnimatedViewBox` and keep only what's used. Replace:

```ts
import { regionBounds, viewBoxString, FULL_VIEWBOX } from "@/lib/fightmap/zoom";
```

with:

```ts
import { regionBounds, FULL_VIEWBOX } from "@/lib/fightmap/zoom";
import { useAnimatedViewBox } from "./useAnimatedViewBox";
```

Then replace the target-computation block (currently lines ~35-43):

```ts
const zoomed = zoomedRegion != null;
const shownPoints = zoomed
  ? points.filter((_, i) => assignment[i] === zoomedRegion)
  : points;
const vb = zoomed
  ? viewBoxString(
      regionBounds(regions[zoomedRegion]?.polygon ?? null, shownPoints),
    )
  : viewBoxString(FULL_VIEWBOX);
```

with:

```ts
const zoomed = zoomedRegion != null;
const shownPoints = zoomed
  ? points.filter((_, i) => assignment[i] === zoomedRegion)
  : points;
const target = zoomed
  ? regionBounds(regions[zoomedRegion]?.polygon ?? null, shownPoints)
  : FULL_VIEWBOX;
const vb = useAnimatedViewBox(target);
```

The `<DuelMap viewBox={vb} ... />` usage (line ~73) is unchanged — `vb` is still the string it expects.

- [ ] **Step 4: Typecheck the integration**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Add the reduced-motion smoke guard**

Append to `tests/smoke.spec.ts` (the `gotoAscent` helper already exists at the top of the file; reuse it):

```ts
test("reduced motion still zooms into a region", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoAscent(page);
  await page.getByRole("button", { name: "Heatmap" }).click();
  // Click polygons until one triggers a zoom (some regions may have no duels).
  const polys = page.locator("svg polygon");
  const n = await polys.count();
  let zoomed = false;
  for (let i = 0; i < n; i++) {
    await polys.nth(i).dispatchEvent("click");
    if (await page.getByRole("button", { name: /All regions/ }).isVisible()) {
      zoomed = true;
      break;
    }
  }
  expect(zoomed).toBe(true);
  // With reduced motion the viewBox snaps; it must no longer be the full map.
  const vb = await page.locator("svg").last().getAttribute("viewBox");
  expect(vb).not.toBe("0 0 100 100");
});
```

- [ ] **Step 6: Run the zoom smoke tests (default motion + the new guard)**

Run: `TEST_PORT=3001 pnpm exec playwright test -g "zoom"`
Expected: PASS — the existing zoom tests ("clicking a heatmap region zooms in", "zooming into a region then clicking a dot opens the focus dialog", "inside a zoom, an overlapping cluster fans out and opens details") still pass with the animation in place (they wait on the breadcrumb, which is animation-independent), and the new "reduced motion still zooms into a region" guard passes.

- [ ] **Step 7: Run the full unit + smoke suite**

Run: `pnpm exec vitest run`
Expected: PASS (all unit tests).

Run: `TEST_PORT=3001 pnpm exec playwright test`
Expected: PASS for every FragsMap/zoom test. (Note: a pre-existing `home reveals hero and dashboard` test may be red on this base due to the concurrent home-page rework — that is unrelated to this change. If it fails, confirm it also fails on the base commit before this branch and report it as pre-existing; do not attempt to fix it here.)

- [ ] **Step 8: Commit**

```bash
git add components/fightmap/useAnimatedViewBox.ts components/fightmap/FragMap.tsx tests/smoke.spec.ts
git commit -m "Animate FragsMap viewBox zoom with eased lerp"
```

---

## Notes for the reviewer / human

- The **glide feel** (450ms ease-in-out cubic) cannot be reliably asserted in CI without timing flake, so it is verified visually by the human at the end, not by an automated test. The user already confirmed this exact curve from a live demo.
- Everything testable in isolation (the interpolation + easing math) is unit-tested in Task 1; the hook's integration and the reduced-motion snap path are guarded by Playwright in Task 2.
