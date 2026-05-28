import Nav from "@/components/Nav";
import RankHeader from "@/components/RankHeader";
import StatCard from "@/components/StatCard";
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

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <RankHeader
          name={a?.name ?? ""}
          tag={a?.tag ?? ""}
          level={a?.account_level ?? 0}
          region={a?.region ?? "na"}
          tier={mmr?.current?.tier?.name ?? "—"}
          rr={mmr?.current?.rr ?? 0}
          peak={mmr?.peak?.tier?.name ?? "—"}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
            gap: 16,
          }}
        >
          <StatCard
            title="Top 3 Agents"
            big={
              agents
                .slice(0, 3)
                .map((x) => x.agent)
                .join(" · ") || "—"
            }
            sub={`${agents[0]?.games ?? 0} games on #1`}
          />
          <StatCard
            title="Best / Worst Map"
            big={`${best?.map ?? "—"} / ${worst?.map ?? "—"}`}
            sub={`${best?.winRate.toFixed(0) ?? 0}% vs ${worst?.winRate.toFixed(0) ?? 0}%`}
          />
          <StatCard
            title="Most-used Gun"
            big={gun?.weapon ?? "—"}
            sub={gun ? `${gun.kills} kills` : "run backfill"}
          />
          <StatCard
            title="Current Form"
            big={`${form.wins}-${form.games - form.wins}`}
            sub={`KD ${form.avgKd.toFixed(2)} · HS ${form.avgHs.toFixed(0)}% · ADR ${form.avgAdr.toFixed(0)}`}
          />
        </div>
      </main>
    </>
  );
}
