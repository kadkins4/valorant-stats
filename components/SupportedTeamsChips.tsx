const TEAMS = [
  { name: "Team Liquid", abbr: "TL", bg: "#0b2a6b" },
  { name: "100 Thieves", abbr: "100T", bg: "#c8102e" },
];
export default function SupportedTeamsChips() {
  return (
    <div
      style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}
    >
      <span style={{ fontSize: 10, color: "var(--muted)" }}>supporting</span>
      {TEAMS.map((t) => (
        <span
          key={t.abbr}
          title={t.name}
          style={{
            background: t.bg,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {t.abbr}
        </span>
      ))}
    </div>
  );
}
