"use client";
import "./ChartSetup";
import { Bar } from "react-chartjs-2";
import type { MapAgg } from "@/lib/types";
const hex = (p: number) =>
  p >= 55 ? "#2ecc71" : p >= 45 ? "#e7c84b" : "#ff5b6e";
export default function WinRateByMap({ maps }: { maps: MapAgg[] }) {
  return (
    <Bar
      data={{
        labels: maps.map((m) => m.map),
        datasets: [
          {
            data: maps.map((m) => +m.winRate.toFixed(1)),
            backgroundColor: maps.map((m) => hex(m.winRate)),
          },
        ],
      }}
      options={{
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 100 } },
      }}
    />
  );
}
