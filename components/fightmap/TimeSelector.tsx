"use client";
import { chip } from "./MapPicker";
import { formatSeason, type TimeScope } from "@/lib/fightmap";

function selectedSeasons(value: TimeScope): string[] {
  return value.kind === "seasons" ? value.seasons : [];
}

function summaryLabel(selected: string[]): string {
  if (selected.length === 0) return "—";
  if (selected.length === 1) return formatSeason(selected[0]);
  return `${selected.length} seasons`;
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
  const selected = selectedSeasons(value);

  const toggleSeason = (s: string) => {
    const next = selected.includes(s)
      ? selected.filter((x) => x !== s)
      : [...selected, s];
    onChange({ kind: "seasons", seasons: next });
  };

  return (
    <div
      role="group"
      aria-label="Seasons"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <details style={{ position: "relative" }}>
        <summary
          aria-label={`Choose seasons${selected.length ? `, ${selected.length} selected` : ""}`}
          style={{
            ...chip(value.kind === "seasons" && selected.length > 0),
            listStyle: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
          }}
        >
          {summaryLabel(selected)}
          <span aria-hidden style={{ fontSize: 10, opacity: 0.8 }}>
            ▾
          </span>
        </summary>
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 6,
            minWidth: 160,
            padding: 8,
            borderRadius: 10,
            background: "#1a212c",
            border: "1px solid #2a3340",
            boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
            display: "grid",
            gap: 4,
          }}
        >
          {seasons.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px",
                borderRadius: 8,
                fontSize: 13,
                color: "#aeb6c6",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={value.kind === "seasons" && selected.includes(s)}
                onChange={() => toggleSeason(s)}
              />
              {formatSeason(s)}
            </label>
          ))}
        </div>
      </details>

      <button
        type="button"
        aria-pressed={value.kind === "all"}
        style={chip(value.kind === "all")}
        onClick={() => onChange({ kind: "all" })}
      >
        All time
      </button>
      <button
        type="button"
        aria-pressed={value.kind === "lastN" && value.n === 10}
        style={chip(value.kind === "lastN" && value.n === 10)}
        onClick={() => onChange({ kind: "lastN", n: 10 })}
      >
        Last 10
      </button>
      <button
        type="button"
        aria-pressed={value.kind === "lastN" && value.n === 20}
        style={chip(value.kind === "lastN" && value.n === 20)}
        onClick={() => onChange({ kind: "lastN", n: 20 })}
      >
        Last 20
      </button>
    </div>
  );
}
