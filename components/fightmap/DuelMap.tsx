"use client";
import { useEffect, useState } from "react";
import type { Placed } from "@/lib/fightmap";
import styles from "./DuelMap.module.css";

const GREEN = "#5fd07a";
const RED = "#e35d6a";
const ENEMY = "#ff8e5e";
const GOLD = "#ffd166";

const hasPos = (p?: Placed) =>
  !!p && p.mnx != null && p.mny != null && p.enx != null && p.eny != null;

export default function DuelMap({
  image,
  points,
  overlay,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);

  // Esc unfocuses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset selection when the dot set changes (e.g. switching zones), so a stale
  // index can't orphan the focus and hide every dot. Render-time adjustment is
  // React's recommended pattern for "reset state when a prop changes".
  const [prevPoints, setPrevPoints] = useState(points);
  if (points !== prevPoints) {
    setPrevPoints(points);
    setFocused(null);
    setHovered(null);
  }

  const active = focused ?? hovered;
  const fp = focused != null ? points[focused] : null;

  // Dialog pins to the corner opposite the engagement centroid.
  const ex = fp ? (hasPos(fp) ? (fp.mnx! + fp.enx!) / 2 : fp.nx) : 0.5;
  const ey = fp ? (hasPos(fp) ? (fp.mny! + fp.eny!) / 2 : fp.ny) : 0.5;
  const corner: React.CSSProperties = {
    [ex < 0.5 ? "right" : "left"]: 10,
    [ey < 0.5 ? "bottom" : "top"]: 10,
  };

  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        className={styles.svg}
        onClick={() => setFocused(null)}
      >
        <image
          href={image}
          x="0"
          y="0"
          width="100"
          height="100"
          opacity="0.5"
          preserveAspectRatio="xMidYMid slice"
        />
        {overlay}
        {points.map((p, i) => {
          if (focused != null && i !== focused) return null;
          const dim = focused == null && hovered != null && hovered !== i;
          return (
            <circle
              key={i}
              cx={p.nx * 100}
              cy={p.ny * 100}
              r="1.6"
              fill={p.won ? GREEN : RED}
              stroke="#11151d"
              strokeWidth="0.3"
              opacity={dim ? 0.18 : 1}
              style={{ cursor: "pointer", transition: "opacity .12s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                setFocused((f) => (f === i ? null : i));
              }}
            />
          );
        })}
        {active != null && hasPos(points[active]) && (
          <Engagement p={points[active]} />
        )}
      </svg>
      {fp && (
        <div className={styles.dialog} style={corner}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => setFocused(null)}
          >
            ✕
          </button>
          <span className={styles.out} data-win={fp.won}>
            {fp.won ? "KILL" : "DEATH"}
          </span>
          <Row
            k="Round"
            v={`${fp.round ?? "—"} · ${fp.side === "attack" ? "⚔ Attack" : "🛡 Defense"}`}
          />
          {fp.weapon && <Row k="Weapon" v={fp.weapon} />}
          {fp.dist != null && <Row k="Distance" v={`${fp.dist} m`} />}
          {(fp.agent || fp.enemyAgent) && <div className={styles.sep} />}
          {fp.agent && <Row k="You" v={fp.agent} />}
          {fp.enemyAgent && <Row k="Enemy" v={fp.enemyAgent} />}
        </div>
      )}
    </div>
  );
}

function Engagement({ p }: { p: Placed }) {
  // Dashes flow from survivor toward the loser. won → loser is the enemy.
  const survivor = p.won ? [p.mnx!, p.mny!] : [p.enx!, p.eny!];
  const loser = p.won ? [p.enx!, p.eny!] : [p.mnx!, p.mny!];
  return (
    <g pointerEvents="none">
      <line
        x1={survivor[0] * 100}
        y1={survivor[1] * 100}
        x2={loser[0] * 100}
        y2={loser[1] * 100}
        stroke={GOLD}
        strokeWidth="0.6"
        className={styles.tracer}
      />
      <circle
        cx={p.mnx! * 100}
        cy={p.mny! * 100}
        r="1.6"
        fill={GREEN}
        stroke="#11151d"
        strokeWidth="0.3"
      />
      <circle
        cx={p.enx! * 100}
        cy={p.eny! * 100}
        r="2"
        fill="none"
        stroke={ENEMY}
        strokeWidth="0.9"
      />
    </g>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rk}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
