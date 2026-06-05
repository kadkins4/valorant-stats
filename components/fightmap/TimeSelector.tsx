"use client";
import { chip } from "./MapPicker";
import type { TimeScope } from "@/lib/fightmap";

// Keep the map readable by only ever showing a handful of recent games. More
// than this and dense maps become an unreadable wall of dots.
const OPTIONS: { n: number; label: string }[] = [
  { n: 1, label: "Last game" },
  { n: 3, label: "Last 3 games" },
  { n: 5, label: "Last 5 games" },
];

export default function TimeSelector({
  value,
  onChange,
}: {
  value: TimeScope;
  onChange: (t: TimeScope) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Recent games"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {OPTIONS.map((o) => {
        const active = value.kind === "lastN" && value.n === o.n;
        return (
          <button
            key={o.n}
            type="button"
            aria-pressed={active}
            style={chip(active)}
            onClick={() => onChange({ kind: "lastN", n: o.n })}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
