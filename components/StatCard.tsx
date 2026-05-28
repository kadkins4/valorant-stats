export default function StatCard({
  title,
  big,
  sub,
  color,
}: {
  title: string;
  big: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--muted)",
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{big}</div>
      {sub && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
