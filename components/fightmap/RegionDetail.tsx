"use client";
import { sideSplit, winRateColor, type Placed } from "@/lib/fightmap";

function SideCell({
  label,
  stat,
}: {
  label: string;
  stat: { wins: number; total: number } | null;
}) {
  if (!stat) return null;
  return (
    <div
      style={{
        background: "#161b24",
        border: "1px solid #222a38",
        borderRadius: 9,
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>
        {Math.round((stat.wins / stat.total) * 100)}%
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
          {" "}
          · {stat.wins}/{stat.total}
        </span>
      </div>
    </div>
  );
}

export default function RegionDetail({
  image,
  points,
  regionName,
}: {
  image: string;
  points: Placed[];
  regionName: string;
}) {
  const total = points.length;
  const wins = points.filter((p) => p.won).length;
  const losses = total - wins;
  const wr = total ? wins / total : 0;
  const split = sideSplit(points);

  return (
    <div style={{ maxWidth: 360 }}>
      <h3 style={{ margin: "4px 0 10px", fontSize: 17 }}>{regionName}</h3>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1,
            color: winRateColor(wr),
          }}
        >
          {Math.round(wr * 100)}%
        </span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>win rate</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 13,
          color: "#cfd6e4",
          marginBottom: 10,
        }}
      >
        <span>
          <b style={{ color: "#5fd07a" }}>{wins}</b> won
        </span>
        <span>
          <b style={{ color: "#e35d6a" }}>{losses}</b> lost
        </span>
        <span style={{ color: "var(--muted)" }}>{total} duels</span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 5,
          overflow: "hidden",
          display: "flex",
          marginBottom: 12,
          background: "#1a1f29",
        }}
      >
        <div
          style={{ width: `${Math.round(wr * 100)}%`, background: "#5fd07a" }}
        />
        <div style={{ flex: 1, background: "#e35d6a" }} />
      </div>

      {(split.attack || split.defense) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <SideCell label="⚔ Attack" stat={split.attack} />
          <SideCell label="🛡 Defense" stat={split.defense} />
        </div>
      )}

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
