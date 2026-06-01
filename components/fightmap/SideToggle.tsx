"use client";
import { chip } from "./MapPicker";

export type Side = "attack" | "defense" | "both";

export default function SideToggle({
  value,
  onChange,
}: {
  value: Side;
  onChange: (s: Side) => void;
}) {
  const opts: Side[] = ["both", "attack", "defense"];
  const label: Record<Side, string> = {
    both: "Both",
    attack: "Attack",
    defense: "Defense",
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map((o) => (
        <button key={o} style={chip(o === value)} onClick={() => onChange(o)}>
          {label[o]}
        </button>
      ))}
    </div>
  );
}
