"use client";
import "./ChartSetup";
import { Line } from "react-chartjs-2";
import type { MatchSummary } from "@/lib/types";
export default function KDTrend({ rows }: { rows: MatchSummary[] }) {
  const chrono = [...rows].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const kd = chrono.map((m) =>
    m.deaths ? +(m.kills / m.deaths).toFixed(2) : m.kills,
  );
  const avg = kd.reduce((a, b) => a + b, 0) / (kd.length || 1);
  return (
    <Line
      data={{
        labels: chrono.map((_, i) => i + 1),
        datasets: [
          {
            label: "K/D",
            data: kd,
            borderColor: "#46b6cf",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: "avg",
            data: kd.map(() => +avg.toFixed(2)),
            borderColor: "#ff4655",
            borderWidth: 1,
            borderDash: [6, 4],
            pointRadius: 0,
          },
        ],
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { min: 0 } },
      }}
    />
  );
}
