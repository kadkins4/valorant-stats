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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
