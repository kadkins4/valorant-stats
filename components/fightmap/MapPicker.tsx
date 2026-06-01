"use client";

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px",
  borderRadius: 14,
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  cursor: "pointer",
  border: "none",
  background: active ? "var(--accent)" : "#222a38",
  color: active ? "#fff" : "#aeb6c6",
  transition: "background 0.15s",
});

export default function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {maps.map((m) => (
        <button key={m} style={chip(m === value)} onClick={() => onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  );
}

export { chip };
