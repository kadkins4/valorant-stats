"use client";
import "./ChartSetup";
import { Line } from "react-chartjs-2";
import type { RankPoint } from "@/lib/types";
export default function EloTimeline({ points }: { points: RankPoint[] }) {
  const chrono = [...points].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt),
  );
  return (
    <Line
      data={{
        labels: chrono.map((p) => new Date(p.playedAt).toLocaleDateString()),
        datasets: [
          {
            label: "Elo",
            data: chrono.map((p) => p.elo),
            borderColor: "#ff4655",
            backgroundColor: "rgba(255,70,85,.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      }}
      options={{ plugins: { legend: { display: false } } }}
    />
  );
}
