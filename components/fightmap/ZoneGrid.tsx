"use client";
import { GRID_N, winRateColor, type Zone } from "@/lib/fightmap";

export default function ZoneGrid({
  image,
  zones,
  selected,
  onSelect,
}: {
  image: string;
  zones: Zone[];
  selected: { col: number; row: number } | null;
  onSelect: (z: Zone) => void;
}) {
  const cell = 100 / GRID_N; // percent units in a 0..100 viewBox
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
        opacity="0.55"
        preserveAspectRatio="xMidYMid slice"
      />
      {zones.map((z) => {
        const isSel = selected?.col === z.col && selected?.row === z.row;
        return (
          <g
            key={`${z.col},${z.row}`}
            onClick={() => onSelect(z)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={z.col * cell}
              y={z.row * cell}
              width={cell}
              height={cell}
              fill={z.muted ? "#3a3f4b" : winRateColor(z.winRate)}
              opacity={z.muted ? 0.3 : isSel ? 0.95 : 0.78}
              stroke={isSel ? "#fff" : "#11151d"}
              strokeWidth={isSel ? 0.8 : 0.3}
              style={{ transition: "opacity 0.2s, fill 0.2s" }}
            >
              <title>
                {z.muted
                  ? `${z.total} duels (low sample)`
                  : `${Math.round(z.winRate * 100)}% over ${z.total} duels`}
              </title>
            </rect>
            {!z.muted && (
              <text
                x={z.col * cell + cell / 2}
                y={z.row * cell + cell / 2 + 2}
                textAnchor="middle"
                fontSize="5"
                fontWeight="800"
                fill="#fff"
                stroke="#11151d"
                strokeWidth="0.3"
                style={{ paintOrder: "stroke", pointerEvents: "none" }}
              >
                {Math.round(z.winRate * 100)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
