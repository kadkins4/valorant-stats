"use client";
import { useState } from "react";
import { winRateColor, type Placed, type RegionStat } from "@/lib/fightmap";
import type { PolyRegionStat } from "@/lib/maps/regions";
import styles from "./RegionView.module.css";

const RASTER_N = 80; // tiles per axis — finer raster for tighter blobs
const MASK_R = 0.04;
const MASK_R2 = MASK_R * MASK_R;
const ACCENT = "#ff4655"; // --accent (SVG attrs can't resolve var())

type TipData = {
  name: string;
  color: string;
  winRate: number;
  wins: number;
  total: number;
  muted: boolean;
};
type Tip = { x: number; y: number; data: TipData } | null;

export default function RegionView({
  image,
  mode,
  regions,
  polyRegions,
  points,
  selected,
  onSelectRegion,
}: {
  image: string;
  mode: "raster" | "polygon";
  regions: RegionStat[];
  polyRegions?: PolyRegionStat[];
  points: Placed[];
  selected: number | null;
  onSelectRegion: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip>(null);

  // Spotlight: hovered zone stays prominent, others dim. No hover → base.
  const polyOpacity = (i: number, muted: boolean) => {
    const base = muted ? 0.25 : 0.55;
    if (hovered == null) return base;
    if (i === hovered) return muted ? 0.4 : 0.9;
    return muted ? 0.08 : 0.18;
  };

  if (mode === "polygon") {
    const polys = polyRegions ?? [];
    return (
      <div className={styles.wrap}>
        <svg
          viewBox="0 0 100 100"
          width="100%"
          style={{
            display: "block",
            borderRadius: 10,
            border: "1px solid #222a38",
            aspectRatio: "1 / 1",
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
            style={{ pointerEvents: "none" }}
          />
          {polys.map((r, i) => (
            <polygon
              key={i}
              className={`${styles.poly} ${i === hovered ? styles.lift : ""}`}
              points={r.polygon
                .map((p) => `${p[0] * 100},${p[1] * 100}`)
                .join(" ")}
              fill={r.muted ? "#3a3f4b" : winRateColor(r.winRate)}
              style={{
                opacity: polyOpacity(i, r.muted),
                stroke: i === selected ? ACCENT : "#11151d",
                strokeWidth: i === selected ? 0.8 : 0.3,
              }}
              onMouseMove={(e) => {
                setHovered(i);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  data: {
                    name: r.name,
                    color: r.muted ? "#3a3f4b" : winRateColor(r.winRate),
                    winRate: r.winRate,
                    wins: r.wins,
                    total: r.total,
                    muted: r.muted,
                  },
                });
              }}
              onMouseLeave={() => {
                setHovered(null);
                setTip(null);
              }}
              onClick={() => onSelectRegion(i)}
            />
          ))}
          {polys.map((r, i) =>
            r.muted ? null : (
              <g key={i} style={{ pointerEvents: "none" }}>
                <text
                  x={r.cx * 100}
                  y={r.cy * 100}
                  textAnchor="middle"
                  fontSize="2.2"
                  fontWeight="700"
                  fill="#fff"
                  stroke="#11151d"
                  strokeWidth="0.4"
                  style={{ paintOrder: "stroke" }}
                >
                  {r.name}
                </text>
                <text
                  x={r.cx * 100}
                  y={r.cy * 100 + 2.6}
                  textAnchor="middle"
                  fontSize="1.9"
                  fontWeight="600"
                  fill="#fff"
                  stroke="#11151d"
                  strokeWidth="0.35"
                  style={{ paintOrder: "stroke" }}
                >
                  {Math.round(r.winRate * 100)}% · {r.total}
                </text>
              </g>
            ),
          )}
        </svg>
        {tip && (
          <div
            className={styles.tooltip}
            role="tooltip"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
          >
            <div className={styles.tipName}>{tip.data.name}</div>
            <div>
              <span
                className={styles.swatch}
                style={{ background: tip.data.color }}
              />
              <span className={styles.tipWin}>
                {Math.round(tip.data.winRate * 100)}% win
              </span>
            </div>
            <div className={styles.tipSub}>
              {tip.data.wins}W / {tip.data.total - tip.data.wins}L ·{" "}
              {tip.data.total} duels{tip.data.muted ? " · low sample" : ""}
            </div>
          </div>
        )}
      </div>
    );
  }

  const cell = 100 / RASTER_N;
  const tiles: { x: number; y: number; r: RegionStat }[] = [];
  if (regions.length && points.length) {
    const pointRegion = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < regions.length; i++) {
        const d = (regions[i].cx - p.nx) ** 2 + (regions[i].cy - p.ny) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    });

    for (let row = 0; row < RASTER_N; row++) {
      for (let col = 0; col < RASTER_N; col++) {
        const cnx = (col + 0.5) / RASTER_N;
        const cny = (row + 0.5) / RASTER_N;
        let nearestD = Infinity;
        let nearestI = -1;
        for (let k = 0; k < points.length; k++) {
          const d = (points[k].nx - cnx) ** 2 + (points[k].ny - cny) ** 2;
          if (d < nearestD) {
            nearestD = d;
            nearestI = k;
          }
        }
        if (nearestI < 0 || nearestD > MASK_R2) continue;
        tiles.push({
          x: col * cell,
          y: row * cell,
          r: regions[pointRegion[nearestI]],
        });
      }
    }
  }

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    let best = -1;
    let bestD = Infinity;
    regions.forEach((r, i) => {
      if (r.muted) return;
      const d = (r.cx - nx) ** 2 + (r.cy - ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) onSelectRegion(best);
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      onClick={handleClick}
      style={{
        display: "block",
        borderRadius: 10,
        border: "1px solid #222a38",
        aspectRatio: "1 / 1",
        cursor: "pointer",
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
        style={{ pointerEvents: "none" }}
      />
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width={cell}
          height={cell}
          fill={t.r.muted ? "#3a3f4b" : winRateColor(t.r.winRate)}
          opacity={t.r.muted ? 0.25 : 0.6}
        />
      ))}
      {regions.map((r, i) =>
        r.muted ? null : (
          <g key={i} style={{ pointerEvents: "none" }}>
            <text
              x={r.cx * 100}
              y={r.cy * 100}
              textAnchor="middle"
              fontSize="2.2"
              fontWeight="700"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.4"
              style={{ paintOrder: "stroke" }}
            >
              {r.regionName}
            </text>
            <text
              x={r.cx * 100}
              y={r.cy * 100 + 2.6}
              textAnchor="middle"
              fontSize="1.9"
              fontWeight="600"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.35"
              style={{ paintOrder: "stroke" }}
            >
              {Math.round(r.winRate * 100)}% · {r.total}
            </text>
          </g>
        ),
      )}
      {selected != null && regions[selected] && (
        <circle
          cx={regions[selected].cx * 100}
          cy={regions[selected].cy * 100}
          r="4"
          fill="none"
          stroke={ACCENT}
          strokeWidth="0.8"
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}
