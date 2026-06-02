"use client";
import { useEffect, useRef } from "react";
import styles from "./home.module.css";
import type { HomeData } from "@/lib/home/types";

function useCountUp(target: number, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    const dur = 1100;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(decimals);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, decimals]);
  return ref;
}

export default function Hero(d: HomeData) {
  const winRef = useCountUp(d.winPct);
  const kdRef = useCountUp(d.kd, 2);
  const matchRef = useCountUp(d.matches);
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "44px 0 28px",
      }}
    >
      <div className={styles.heroBg} />
      <div style={{ position: "relative" }}>
        <div
          className={styles.heroEnter}
          style={{
            animationDelay: "0.05s",
            color: "var(--accent)",
            fontWeight: 800,
            letterSpacing: 2,
            fontSize: 13,
          }}
        >
          ◆ {d.tier.toUpperCase()} · {d.rr} RR
        </div>
        <div
          className={styles.heroEnter}
          style={{
            animationDelay: "0.2s",
            fontWeight: 900,
            fontSize: "clamp(30px,5vw,54px)",
          }}
        >
          {d.name} <span style={{ color: "var(--muted)" }}>#{d.tag}</span>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 16 }}>
          {[
            { ref: winRef, label: "Win %" },
            { ref: kdRef, label: "K/D" },
            { ref: matchRef, label: "Matches" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={styles.heroEnter}
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
            >
              <div
                style={{ fontWeight: 900, fontSize: "clamp(22px,3.4vw,34px)" }}
              >
                <span ref={s.ref}>0</span>
              </div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
