import type { RegionIssue } from "@/lib/maps/regions";

export default function IssuesList({ issues }: { issues: RegionIssue[] }) {
  if (issues.length === 0) {
    return (
      <p style={{ color: "var(--muted)", marginTop: 24 }}>
        No region issues 🎉
      </p>
    );
  }
  const maps = new Set(issues.map((i) => i.map));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
        {issues.length} issue{issues.length === 1 ? "" : "s"} across {maps.size}{" "}
        map
        {maps.size === 1 ? "" : "s"}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {issues.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#0e1218",
              border: "1px solid #222a38",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            <span aria-hidden style={{ color: "#e0a23c" }}>
              ⚠️
            </span>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{it.map}</span>
            <span style={{ color: "var(--muted)", minWidth: 64 }}>
              {it.kind === "overlap" ? "Overlap" : "Snapped"}
            </span>
            <span style={{ flex: 1 }}>
              {it.kind === "overlap" ? (
                <>
                  {it.zones.join(" ⨯ ")} · {it.count} frag
                  {it.count === 1 ? "" : "s"} → {it.winner}
                </>
              ) : (
                <>
                  {it.count} frag{it.count === 1 ? "" : "s"} outside zones →{" "}
                  {it.zone}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
