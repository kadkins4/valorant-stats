"use client";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./home.module.css";
import {
  REVEAL_MIN_MS,
  REVEAL_MAX_MS,
  REVEAL_KEY,
  shouldReveal,
} from "@/lib/home/reveal";

const useIsoLayout = typeof window === "undefined" ? () => {} : useLayoutEffect;

export default function HomeReveal({
  name,
  tag,
  meta,
  children,
}: {
  name: string;
  tag: string;
  meta: string; // e.g. "RADIANT · 847 RR · NA"
  children: React.ReactNode;
}) {
  // Server renders overlay visible; client decides before paint to avoid flash.
  const [hidden, setHidden] = useState(false);
  const startedRef = useRef(false);

  useIsoLayout(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const alreadyRevealed = sessionStorage.getItem(REVEAL_KEY) === "1";

    if (!shouldReveal({ reducedMotion, alreadyRevealed })) {
      setHidden(true); // instant final state, no flash (layout effect)
      return;
    }

    const start = performance.now();
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      sessionStorage.setItem(REVEAL_KEY, "1");
      setHidden(true);
    };

    // data is server-inline → ready at 0; fonts gate the blur-resolve.
    const ready = (document as Document & { fonts?: FontFaceSet }).fonts;
    (ready ? ready.ready : Promise.resolve()).then(() => {
      const fontsReadyAt = performance.now() - start;
      const wait = Math.min(
        REVEAL_MAX_MS,
        Math.max(REVEAL_MIN_MS, 0, fontsReadyAt),
      );
      const remaining = Math.max(0, wait - (performance.now() - start));
      setTimeout(finish, remaining);
    });

    // hard cap: fail open even if fonts.ready never resolves
    const cap = setTimeout(finish, REVEAL_MAX_MS);
    return () => clearTimeout(cap);
  }, []);

  const letters = `${name}#${tag}`;

  return (
    <>
      <div
        className={`${styles.overlay} ${hidden ? styles.overlayHidden : ""}`}
        aria-hidden="true"
      >
        <svg className={styles.ring} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" />
        </svg>
        <div>
          <div className={styles.revealHandle}>
            {[...letters].map((c, i) => (
              <span key={i} style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
                {c}
              </span>
            ))}
          </div>
          <div className={styles.revealMeta}>{meta}</div>
        </div>
      </div>
      {children}
    </>
  );
}
