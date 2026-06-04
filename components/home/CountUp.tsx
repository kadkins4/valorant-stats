"use client";
import { useEffect, useRef } from "react";
import { countUpValue } from "@/lib/home/countup";

export default function CountUp({
  to,
  decimals = 0,
  durationMs = 1100,
  className,
}: {
  to: number;
  decimals?: number;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = to.toFixed(decimals);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      el.textContent = countUpValue(to, p, decimals);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, decimals, durationMs]);

  // SSR/no-JS and pre-hydration render the final value (correct, accessible).
  return (
    <span ref={ref} className={className}>
      {to.toFixed(decimals)}
    </span>
  );
}
