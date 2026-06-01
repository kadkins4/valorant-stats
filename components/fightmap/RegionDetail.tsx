"use client";
import type { Placed } from "@/lib/fightmap";

export default function RegionDetail({
  image,
  points,
  regionName,
}: {
  image: string;
  points: Placed[];
  regionName: string;
}) {
  const wins = points.filter((p) => p.won).length;
  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0" }}>
        {regionName} — {points.length} duels · {wins} won
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
        {points.map((p, i) => (
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
