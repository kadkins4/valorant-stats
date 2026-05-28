import Nav from "@/components/Nav";
import WinRateByMap from "@/components/charts/WinRateByMap";
import KDTrend from "@/components/charts/KDTrend";
import AgentTable from "@/components/charts/AgentTable";
import EloTimeline from "@/components/charts/EloTimeline";
import { getMatches, getRankHistory } from "@/lib/db/queries";
import { byMap, byAgent } from "@/lib/aggregations";

const Panel = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section
    style={{
      background: "var(--panel)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      padding: "18px 20px",
      marginTop: 18,
    }}
  >
    <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>{title}</h2>
    {children}
  </section>
);

export default async function Track() {
  const [ms, ranks] = await Promise.all([getMatches(), getRankHistory()]);
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <Panel title="Elo Timeline">
          <div style={{ height: 300 }}>
            <EloTimeline points={ranks} />
          </div>
        </Panel>
        <Panel title="Win Rate by Map">
          <div style={{ height: 320 }}>
            <WinRateByMap maps={byMap(ms)} />
          </div>
        </Panel>
        <Panel title="K/D Trend">
          <div style={{ height: 280 }}>
            <KDTrend rows={ms} />
          </div>
        </Panel>
        <Panel title="Performance by Agent">
          <AgentTable agents={byAgent(ms)} />
        </Panel>
      </main>
    </>
  );
}
