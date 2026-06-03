"use client";
import { GRID_N, type Placed } from "@/lib/fightmap";
import DuelMap from "./DuelMap";

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
      <DuelMap
        image={image}
        points={inZone}
        overlay={
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
        }
      />
    </div>
  );
}
