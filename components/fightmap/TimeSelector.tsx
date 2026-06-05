"use client";
import Segmented from "./Segmented";
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
  const current = value.kind === "lastN" ? value.n : -1;
  return (
    <Segmented<number>
      ariaLabel="Recent games"
      value={current}
      onChange={(n) => onChange({ kind: "lastN", n })}
      options={OPTIONS.map((o) => ({ value: o.n, key: o.n, label: o.label }))}
    />
  );
}
