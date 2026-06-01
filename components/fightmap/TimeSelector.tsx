"use client";
import { chip } from "./MapPicker";
import type { TimeScope } from "@/lib/fightmap";

function key(t: TimeScope): string {
  return t.kind === "season"
    ? `s:${t.season}`
    : t.kind === "lastN"
      ? `n:${t.n}`
      : "all";
}

export default function TimeSelector({
  seasons,
  value,
  onChange,
}: {
  seasons: string[];
  value: TimeScope;
  onChange: (t: TimeScope) => void;
}) {
  const options: { label: string; scope: TimeScope }[] = [
    ...seasons.map((s, i) => ({
      label: i === 0 ? `${s} (current)` : s,
      scope: { kind: "season", season: s } as TimeScope,
    })),
    { label: "All time", scope: { kind: "all" } },
    { label: "Last 10", scope: { kind: "lastN", n: 10 } },
    { label: "Last 20", scope: { kind: "lastN", n: 20 } },
  ];
  const active = key(value);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={key(o.scope)}
          style={chip(key(o.scope) === active)}
          onClick={() => onChange(o.scope)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
