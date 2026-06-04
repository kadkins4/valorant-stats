import Nav from "@/components/Nav";
import StatCard from "@/components/StatCard";
import Hero from "@/components/home/Hero";
import AgentSplash from "@/components/home/AgentSplash";
import CountUp from "@/components/home/CountUp";
import { agentPortrait } from "@/lib/agents/portraits";
import type { HomeData } from "@/lib/home/types";
import homeStyles from "@/components/home/home.module.css";
import { getMatches, getAccountMmr, topWeapon } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { matches as matchesTbl } from "@/lib/db/schema";
import { byMap, byAgent, currentForm } from "@/lib/aggregations";

export default async function Home() {
  const [data, ms] = await Promise.all([getAccountMmr(), getMatches()]);
  const a = data?.account,
    mmr = data?.mmr;
  const maps = byMap(ms),
    agents = byAgent(ms),
    form = currentForm(ms, 20);
  const best = maps.slice().sort((x, y) => y.winRate - x.winRate)[0];
  const worst = maps.slice().sort((x, y) => x.winRate - y.winRate)[0];
  let gun = null as Awaited<ReturnType<typeof topWeapon>>;
  try {
    gun = topWeapon(
      await db.select({ detail: matchesTbl.detail }).from(matchesTbl),
    );
  } catch {}

  const games = form.games;
  const topAgentPortrait = agentPortrait(agents[0]?.agent);
  const winPct = games ? Math.round((form.wins / games) * 100) : 0;
  const home: HomeData = {
    name: a?.name ?? "ST1CCS",
    tag: a?.tag ?? "STONE",
    region: a?.region ?? "na",
    level: a?.account_level ?? 0,
    tier: mmr?.current?.tier?.name ?? "—",
    rr: mmr?.current?.rr ?? 0,
    peak: mmr?.peak?.tier?.name ?? "—",
    winPct,
    record: `${form.wins}-${games - form.wins}`,
    kd: Number(form.avgKd.toFixed(2)),
    matches: ms.length,
  };

  return (
    <>
      <Nav />
      <main
        style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px 24px" }}
      >
        <div className={homeStyles.heroWrap}>
          {topAgentPortrait && <AgentSplash src={topAgentPortrait} />}
          <Hero {...home} />
        </div>

        <h2
          style={{
            margin: "8px 0 16px",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--muted)",
          }}
        >
          Built on real ranked data
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
            gap: 16,
          }}
        >
          {[
            <StatCard
              key="agents"
              title="Top 3 Agents"
              big={
                agents
                  .slice(0, 3)
                  .map((x) => x.agent)
                  .join(" · ") || "—"
              }
              sub={
                <>
                  <CountUp to={agents[0]?.games ?? 0} /> games on #1
                </>
              }
            />,
            <StatCard
              key="maps"
              title="Best / Worst Map"
              big={`${best?.map ?? "—"} / ${worst?.map ?? "—"}`}
              sub={
                <>
                  <CountUp to={best?.winRate || 0} />% vs{" "}
                  <CountUp to={worst?.winRate || 0} />%
                </>
              }
            />,
            <StatCard
              key="gun"
              title="Most-used Gun"
              big={gun?.weapon ?? "—"}
              sub={
                gun ? (
                  <>
                    <CountUp to={gun.kills} /> kills
                  </>
                ) : (
                  "run backfill"
                )
              }
            />,
            <StatCard
              key="form"
              title="Current Form"
              big={`${form.wins}-${form.games - form.wins}`}
              sub={
                <>
                  KD <CountUp to={form.avgKd} decimals={2} /> · HS{" "}
                  <CountUp to={form.avgHs} />% · ADR{" "}
                  <CountUp to={form.avgAdr} />
                </>
              }
            />,
          ].map((card, i) => (
            <div
              key={i}
              className={homeStyles.cardEnter}
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              {card}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
