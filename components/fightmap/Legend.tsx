const subLabel: React.CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontWeight: 400,
};

export default function Legend() {
  return (
    <div style={{ maxWidth: 360, margin: "8px 0" }}>
      <div
        style={{
          height: 14,
          borderRadius: 7,
          background: "linear-gradient(to right,#b5483d,#7a7f8a 50%,#2e8b57)",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#cfd6e4",
          fontSize: 12,
          fontWeight: 600,
          marginTop: 5,
        }}
      >
        <span>
          Mostly lose
          <span style={subLabel}>low win%</span>
        </span>
        <span style={{ textAlign: "center" }}>
          even
          <span style={subLabel}>50%</span>
        </span>
        <span style={{ textAlign: "right" }}>
          Mostly win
          <span style={subLabel}>high win%</span>
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 13,
          paddingTop: 12,
          borderTop: "1px solid #1e2530",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: "#3a3f4b",
            opacity: 0.45,
            flex: "0 0 auto",
          }}
        />
        <span>Gray = under 5 duels (too few to color)</span>
      </div>
    </div>
  );
}
