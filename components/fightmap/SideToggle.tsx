"use client";
import { chip } from "./MapPicker";

export type Side = "attack" | "defense" | "both";

const SwordIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: "block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
    <path d="m13 19 6-6" />
    <path d="m16 16 4 4" />
    <path d="m19 21 2-2" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: "block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const icon: Record<Side, React.ReactNode> = {
  both: null,
  attack: <SwordIcon />,
  defense: <ShieldIcon />,
};

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
    <div style={{ display: "flex", gap: 8 }} role="group" aria-label="Side">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          style={{
            ...chip(o === value),
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            lineHeight: 1,
          }}
          onClick={() => onChange(o)}
        >
          {icon[o]}
          {label[o]}
        </button>
      ))}
    </div>
  );
}
