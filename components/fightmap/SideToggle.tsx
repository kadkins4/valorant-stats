"use client";
import Segmented from "./Segmented";

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
  const label: Record<Side, string> = {
    both: "Both",
    attack: "Attack",
    defense: "Defense",
  };
  const opts: Side[] = ["both", "attack", "defense"];
  return (
    <Segmented<Side>
      ariaLabel="Side"
      value={value}
      onChange={onChange}
      options={opts.map((o) => ({
        value: o,
        key: o,
        label: (
          <>
            {icon[o]}
            {label[o]}
          </>
        ),
      }))}
    />
  );
}
