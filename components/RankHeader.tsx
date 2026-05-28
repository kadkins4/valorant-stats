import SupportedTeamsChips from "./SupportedTeamsChips";
export default function RankHeader({
  name,
  tag,
  level,
  region,
  tier,
  rr,
  peak,
}: {
  name: string;
  tag: string;
  level: number;
  region: string;
  tier: string;
  rr: number;
  peak: string;
}) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "4px 0 18px",
      }}
    >
      <div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {name} <span style={{ color: "var(--muted)" }}>#{tag}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Level {level} · {region.toUpperCase()}
        </div>
        <SupportedTeamsChips />
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>
          {tier}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {rr} RR · peak {peak}
        </div>
      </div>
    </header>
  );
}
