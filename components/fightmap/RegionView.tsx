"use client";
import { winRateColor, type RegionStat } from "@/lib/fightmap";

const RASTER_N = 40; // tiles per axis (40x40 = 1600 rects)

export default function RegionView({
  image,
  regions,
}: {
  image: string;
  regions: RegionStat[];
}) {
  const cell = 100 / RASTER_N; // percent units in a 0..100 viewBox
  const tiles: { x: number; y: number; r: RegionStat }[] = [];
  if (regions.length) {
    for (let row = 0; row < RASTER_N; row++) {
      for (let col = 0; col < RASTER_N; col++) {
        // cell center in normalized [0,1]
        const cnx = (col + 0.5) / RASTER_N;
        const cny = (row + 0.5) / RASTER_N;
        let best = regions[0];
        let bestD = Infinity;
        for (const r of regions) {
          const d = (r.cx - cnx) ** 2 + (r.cy - cny) ** 2;
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        tiles.push({ x: col * cell, y: row * cell, r: best });
      }
    }
  }

  return (
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
          shapeRendering="crispEdges"
        />
      ))}
      {regions.map((r, i) => (
        <text
          key={i}
          x={r.cx * 100}
          y={r.cy * 100}
          textAnchor="middle"
          fontSize="2.5"
          fontWeight="700"
          fill="#fff"
          stroke="#11151d"
          strokeWidth="0.4"
          opacity={r.muted ? 0.35 : 1}
          style={{ paintOrder: "stroke", pointerEvents: "none" }}
        >
          {r.superRegionName} {r.regionName}
        </text>
      ))}
    </svg>
  );
}
