import type { AgentAgg } from "@/lib/types";
const wr = (p: number) =>
  p >= 55 ? "var(--green)" : p >= 45 ? "var(--yellow)" : "var(--red)";
export default function AgentTable({ agents }: { agents: AgentAgg[] }) {
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}
    >
      <thead>
        <tr
          style={{
            color: "var(--muted)",
            fontSize: 11,
            textTransform: "uppercase",
          }}
        >
          <th style={{ textAlign: "left", padding: 9 }}>Agent</th>
          <th>Games</th>
          <th>Win%</th>
          <th>KD</th>
          <th>HS%</th>
          <th>ADR</th>
        </tr>
      </thead>
      <tbody>
        {agents.map((a) => (
          <tr key={a.agent} style={{ borderBottom: "1px solid var(--line)" }}>
            <td style={{ padding: 9 }}>{a.agent}</td>
            <td style={{ textAlign: "right" }}>{a.games}</td>
            <td
              style={{
                textAlign: "right",
                color: wr(a.winRate),
                fontWeight: 700,
              }}
            >
              {a.winRate.toFixed(0)}%
            </td>
            <td style={{ textAlign: "right" }}>{a.avgKd.toFixed(2)}</td>
            <td style={{ textAlign: "right" }}>{a.avgHs.toFixed(1)}%</td>
            <td style={{ textAlign: "right" }}>{Math.round(a.avgAdr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
