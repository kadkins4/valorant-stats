# FragsMap Zoom "Lean-In" Animation — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design); spec for review
**Scope:** Animate the FragsMap `viewBox` transition between the overview and a zoomed region so it glides instead of snapping. Fast-follow to the spatial-zoom redesign (`2026-06-04-fragsmap-spatial-zoom-design.md`).

## Problem

The spatial-zoom redesign made the SVG `viewBox` the centerpiece interaction of FragsMap: clicking a dot, cluster badge, or region zooms the map into that region's bounding box. Today the `viewBox` changes **instantly** — it snaps. SVG `viewBox` is not CSS-animatable, so the redesign deferred the motion. A snapping zoom reads as unfinished. This adds the "lean-in" glide.

## Solution Overview

Interpolate the `viewBox` over **450ms** with an **ease-in-out cubic** curve, in **both** directions (overview→region and region→overview). The motion is driven by a `requestAnimationFrame` loop in a small hook; the interpolation and easing math are pure functions. `prefers-reduced-motion` users get the existing instant snap.

The feel (450ms ease-in-out cubic) was chosen by the user from a live three-option demo on real Ascent geometry.

## Architecture

Two new units plus a one-spot rewire. The entire feature is contained in `FragMap.tsx` and the two new units; `DuelMap` is untouched.

### Unit 1 — Pure math (extends `lib/fightmap/zoom.ts`)

The file already exports `ViewBox`, `FULL_VIEWBOX`, `regionBounds`, `viewBoxString`. Add:

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

Both pure, no React, unit-tested.

### Unit 2 — rAF hook (`components/fightmap/useAnimatedViewBox.ts`, new)

```ts
export function useAnimatedViewBox(target: ViewBox): string;
```

Returns the **current animated** view box as a string ready for the `<svg viewBox>` attribute.

Behavior:

- Holds the currently-rendered `ViewBox` in a ref (the source of truth for "where we are now") and mirrors it into state so the component re-renders each frame.
- When `target` changes (compared by value — x/y/w/h equality), capture the current animated box as `from`, record a start timestamp, and run a `requestAnimationFrame` loop:
  - `p = min(1, (now - start) / DURATION)` where `DURATION = 450`.
  - `eased = easeInOutCubic(p)`.
  - current = `lerpViewBox(from, target, eased)`; set state.
  - When `p >= 1`, set current exactly to `target` and stop.
- **Interruption-safe:** because `from` is captured as the _current animated box_ (not the previous target) at the moment the target changes, a mid-flight re-target continues smoothly from wherever the animation is — no jump.
- **Reduced motion:** if `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, skip the loop entirely and set current directly to `target` (instant snap). Evaluated when a target change is handled.
- **Mount:** initialize current to the initial `target` with no animation (the overview shows immediately; no zoom-on-load).
- **Cleanup:** cancel any in-flight `requestAnimationFrame` on re-target and on unmount.

### Rewire — `FragMap.tsx`

Today `FragMap` computes a target `viewBox` **string** (`vb`) via `viewBoxString(regionBounds(...))` / `viewBoxString(FULL_VIEWBOX)` and passes it to `DuelMap`. Change:

- Compute the target as a `ViewBox` **object** (`regionBounds(...)` when zoomed, `FULL_VIEWBOX` otherwise) instead of stringifying immediately.
- Pass that object through `useAnimatedViewBox(target)` to get the animated string.
- Pass the animated string to `DuelMap` as it does today.

`DuelMap`'s `viewBox` prop and rendering are unchanged — it still renders whatever string it receives.

## Data Flow

```
zoomedRegion / shownPoints (FragMap state)
  -> target: ViewBox   (regionBounds | FULL_VIEWBOX)
  -> useAnimatedViewBox(target)   (rAF lerp + easing, reduced-motion aware)
  -> animated viewBox string
  -> <DuelMap viewBox={...}>   (renders as-is)
```

## Error Handling / Edge Cases

- **First render / no zoom:** hook initializes to the initial target (`FULL_VIEWBOX`); no animation on mount.
- **Filter change while zoomed:** `FightMap` already resets `zoomedRegion` to null, so the target becomes `FULL_VIEWBOX` and the hook animates back out — same path as Esc/breadcrumb.
- **Rapid re-targets (faster than 450ms):** interruption re-basing from the current animated box handles it with no jump.
- **Reduced motion:** instant snap to target (no rAF), preserving today's behavior for those users.
- **Unmount mid-animation:** rAF cancelled in cleanup; no setState-after-unmount.

## Testing

**Unit (Vitest), `tests/zoom.test.ts` (extend existing):**

- `easeInOutCubic(0) === 0`, `easeInOutCubic(1) === 1`, `easeInOutCubic(0.5) === 0.5` (symmetry).
- `easeInOutCubic` stays within [0,1] for sampled t and is monotonic non-decreasing across sampled points.
- `lerpViewBox(from, to, 0)` deep-equals `from`; `t === 1` deep-equals `to`; `t === 0.5` is the exact midpoint of each component.

**Smoke (Playwright), `tests/smoke.spec.ts` (verify, minimal additions):**

- The existing zoom tests assert the `viewBox` moves off `"0 0 100 100"` to a region bbox and returns to full on exit. These wait for the settled state, so the animation is transparent to them — confirm they still pass unchanged.
- Add one test under emulated `prefers-reduced-motion: reduce` that drives the **Dots-layer** zoom (the animated path, which routes through the hook's reduced-motion branch) and asserts the zoomed `viewBox` is the settled region bbox (not `"0 0 100 100"`) — i.e. it snapped. (Driving the heatmap path here would be meaningless: that path remounts and snaps regardless of motion.)

## Known Limitation — Heatmap-layer zoom-in snaps (accepted, fast-follow)

The lean-in animates on the **default Dots-layer zoom-in** (clicking a duel dot/cluster) and on **all zoom-outs** (Esc / breadcrumb / filter change). It does **not** animate the **Heatmap-layer region click**: `FightMap` renders `RegionView` for the heatmap overview and `FragMap` otherwise, and clicking a heatmap region runs `setZoomedRegion(i); setLayer("dots")`, which **remounts `FragMap` fresh** with the region already set — the hook's mount guard then snaps with no animation.

This was a conscious decision (2026-06-04): ship the animation for the default path now and treat the heatmap-entry snap as a **fast-follow**. Animating it requires keeping `FragMap` mounted across the heatmap→dots switch (or a two-step state transition), which re-touches the redesign's deliberate component split and is out of scope for this change.

## Out of Scope

- Easing/duration controls or user-tunable motion settings (the value is fixed at 450ms ease-in-out cubic).
- Animating anything other than the `viewBox` (dots, dialog, breadcrumb keep their current transitions).
- **Animating the Heatmap-layer region click** (see Known Limitation above — deferred fast-follow).
- Spec 3 (accessible data layer) — separate, next.

## Decisions (resolved during brainstorming)

- **450ms ease-in-out cubic**, chosen by the user from a live three-option demo (Snappy 280 ease-out / Cinematic 450 ease-in-out / Fast 180 ease-out).
- **Symmetric:** the same motion plays on zoom-in and zoom-out (on the Dots path; the Heatmap-entry zoom-in snaps — see Known Limitation).
- **Interruption re-bases from the current animated frame** (no jump on rapid clicks).
- **Reduced motion snaps instantly**, matching the rest of the app.
- **Math is pure + tested; the rAF hook orchestrates.** `DuelMap` stays presentational and untouched.
