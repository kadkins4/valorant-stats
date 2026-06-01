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
          color: "var(--muted)",
          fontSize: 12,
          marginTop: 4,
        }}
      >
        <span>Lose duels</span>
        <span>50%</span>
        <span>Win duels</span>
      </div>
    </div>
  );
}
