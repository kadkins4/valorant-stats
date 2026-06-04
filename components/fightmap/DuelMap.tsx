"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Placed } from "@/lib/fightmap";
import { clusterDuels, fanPositions } from "@/lib/cluster";
import styles from "./DuelMap.module.css";

const GREEN = "#5fd07a";
const RED = "#e35d6a";
const ENEMY = "#ff8e5e";
const GOLD = "#ffd166";
const GRAY = "#5a6273";

const hasPos = (p?: Placed) =>
  !!p && p.mnx != null && p.mny != null && p.enx != null && p.eny != null;

export default function DuelMap({
  image,
  points,
  overlay,
  viewBox = "0 0 100 100",
  onZoom,
}: {
  image: string;
  points: Placed[];
  overlay?: React.ReactNode;
  viewBox?: string;
  onZoom?: (pointIndex: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null); // cluster index
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog when it opens; restore it when it closes.
  useEffect(() => {
    if (focused == null) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [focused]);

  // Esc unfocuses and collapses any fan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocused(null);
        setExpanded(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clusters = useMemo(() => clusterDuels(points), [points]);

  // Reset selection/fan when the dot set changes (e.g. switching zones). Render-time
  // adjustment is React's recommended pattern for "reset state when a prop changes".
  const [prevPoints, setPrevPoints] = useState(points);
  if (points !== prevPoints) {
    setPrevPoints(points);
    setFocused(null);
    setHovered(null);
    setExpanded(null);
  }

  // Handle positions for the currently expanded cluster (index -> viewBox point).
  const handlePos = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    const c = expanded != null ? clusters[expanded] : undefined;
    if (c) {
      const pts = fanPositions(c.cx, c.cy, c.members.length);
      c.members.forEach((idx, k) => map.set(idx, pts[k]));
    }
    return map;
  }, [expanded, clusters]);

  const renderPos = (i: number) => {
    const h = handlePos.get(i);
    return h
      ? { x: h.x, y: h.y }
      : { x: points[i].nx * 100, y: points[i].ny * 100 };
  };

  const active = focused ?? hovered;
  const fp = focused != null ? points[focused] : null;

  // Dialog pins to the corner opposite the engagement centroid.
  const ex = fp ? (hasPos(fp) ? (fp.mnx! + fp.enx!) / 2 : fp.nx) : 0.5;
  const ey = fp ? (hasPos(fp) ? (fp.mny! + fp.eny!) / 2 : fp.ny) : 0.5;
  const corner: React.CSSProperties = {
    [ex < 0.5 ? "right" : "left"]: 10,
    [ey < 0.5 ? "bottom" : "top"]: 10,
  };

  const dot = (i: number) => {
    const p = points[i];
    const { x, y } = renderPos(i);
    const dim = focused == null && hovered != null && hovered !== i;
    const color = p.won ? GREEN : RED;
    return (
      <g
        key={i}
        data-duel={p.won ? "kill" : "death"}
        opacity={dim ? 0.18 : 1}
        style={{ cursor: "pointer", transition: "opacity .12s" }}
        onMouseEnter={() => setHovered(i)}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (onZoom) {
            onZoom(i); // overview: a dot click requests a zoom, not the dialog
            return;
          }
          if (focused === i) {
            setFocused(null);
            setExpanded(null); // collapse on unfocus
          } else {
            setFocused(i);
          }
        }}
      >
        {/* Transparent hit area keeps the whole dot easy to target. */}
        <circle cx={x} cy={y} r="2.4" fill="transparent" />
        {p.won ? (
          // Kill = filled circle.
          <circle
            cx={x}
            cy={y}
            r="1.6"
            fill={color}
            stroke="#11151d"
            strokeWidth="0.3"
          />
        ) : (
          // Death = ✕ (dark halo behind the colored strokes for legibility).
          <g strokeLinecap="round">
            <line
              x1={x - 1.5}
              y1={y - 1.5}
              x2={x + 1.5}
              y2={y + 1.5}
              stroke="#11151d"
              strokeWidth="1.7"
            />
            <line
              x1={x - 1.5}
              y1={y + 1.5}
              x2={x + 1.5}
              y2={y - 1.5}
              stroke="#11151d"
              strokeWidth="1.7"
            />
            <line
              x1={x - 1.5}
              y1={y - 1.5}
              x2={x + 1.5}
              y2={y + 1.5}
              stroke={color}
              strokeWidth="0.9"
            />
            <line
              x1={x - 1.5}
              y1={y + 1.5}
              x2={x + 1.5}
              y2={y - 1.5}
              stroke={color}
              strokeWidth="0.9"
            />
          </g>
        )}
      </g>
    );
  };

  // Gray real-spot node + leader for a displaced (fanned) member.
  const grayNode = (i: number) => (
    <g pointerEvents="none">
      <line
        x1={points[i].nx * 100}
        y1={points[i].ny * 100}
        x2={renderPos(i).x}
        y2={renderPos(i).y}
        stroke="#2c3447"
        strokeWidth="0.5"
      />
      <circle
        cx={points[i].nx * 100}
        cy={points[i].ny * 100}
        r="0.9"
        fill={GRAY}
      />
    </g>
  );

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={viewBox}
        width="100%"
        className={styles.svg}
        onClick={() => {
          setFocused(null);
          setExpanded(null);
        }}
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

        {focused != null ? (
          <>
            {handlePos.has(focused) && grayNode(focused)}
            {dot(focused)}
          </>
        ) : (
          clusters.map((c, ci) => {
            if (c.members.length === 1)
              return <g key={`s${ci}`}>{dot(c.members[0])}</g>;
            if (expanded !== ci) {
              return (
                <g
                  key={`b${ci}`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onZoom) {
                      onZoom(c.members[0]); // overview: zoom into the cluster's region
                      return;
                    }
                    setExpanded(ci);
                  }}
                >
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r="2.5"
                    fill="#161b26"
                    stroke={GOLD}
                    strokeWidth="0.5"
                  />
                  <text
                    x={c.cx}
                    y={c.cy}
                    dy="0.95"
                    fontSize={c.members.length >= 10 ? "2.1" : "2.8"}
                    fill={GOLD}
                    textAnchor="middle"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {c.members.length}
                  </text>
                </g>
              );
            }
            // expanded: leaders from each real spot to its handle, active gray node, handles
            return (
              <g key={`c${ci}`}>
                {c.members.map((idx) => (
                  <line
                    key={`l${idx}`}
                    x1={points[idx].nx * 100}
                    y1={points[idx].ny * 100}
                    x2={renderPos(idx).x}
                    y2={renderPos(idx).y}
                    stroke="#222a38"
                    strokeWidth="0.4"
                    pointerEvents="none"
                  />
                ))}
                {active != null && handlePos.has(active) && grayNode(active)}
                {c.members.map((idx) => dot(idx))}
              </g>
            );
          })
        )}

        {active != null && hasPos(points[active]) && (
          <Engagement p={points[active]} />
        )}
      </svg>
      {fp && (
        <div
          className={styles.dialog}
          style={corner}
          role="dialog"
          aria-modal="true"
          aria-labelledby="duel-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Tab") e.preventDefault(); // trap: only the ✕ is focusable
          }}
        >
          <button
            ref={closeRef}
            className={styles.close}
            aria-label="Close"
            onClick={() => {
              setFocused(null);
              setExpanded(null);
            }}
          >
            ✕
          </button>
          <span id="duel-dialog-title" className={styles.out} data-win={fp.won}>
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
