"use client";
import { GRID_N, type Placed } from "@/lib/fightmap";

export default function ZoneDetail({
  image,
  points,
  zone,
}: {
  image: string;
  points: Placed[];
  zone: { col: number; row: number };
}) {
  const inZone = points.filter((p) => p.col === zone.col && p.row === zone.row);
  const wins = inZone.filter((p) => p.won).length;
  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0" }}>
        {inZone.length} duels · {wins} won
      </h3>
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
        <rect
          x={(zone.col * 100) / GRID_N}
          y={(zone.row * 100) / GRID_N}
          width={100 / GRID_N}
          height={100 / GRID_N}
          fill="none"
          stroke="#fff"
          strokeWidth="0.5"
          opacity="0.6"
        />
        {inZone.map((p, i) => (
          <circle
            key={i}
            cx={p.nx * 100}
            cy={p.ny * 100}
            r="1.4"
            fill={p.won ? "#5fd07a" : "#e35d6a"}
            stroke="#11151d"
            strokeWidth="0.3"
          />
        ))}
      </svg>
    </div>
  );
}
