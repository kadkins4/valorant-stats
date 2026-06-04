import Nav from "@/components/Nav";
import Hero from "@/components/home/Hero";
import AgentSplash from "@/components/home/AgentSplash";
import AgentsCard from "@/components/home/AgentsCard";
import BestWorstMap from "@/components/home/BestWorstMap";
import GunCard from "@/components/home/GunCard";
import CurrentFormCard from "@/components/home/CurrentFormCard";
import AgentCycleProvider, {
  type CycleAgent,
} from "@/components/home/AgentCycleProvider";
import { agentPortrait } from "@/lib/agents/portraits";
import { getCalibration } from "@/lib/maps/calibration";
import type { HomeData } from "@/lib/home/types";
import homeStyles from "@/components/home/home.module.css";
import { getMatches, getAccountMmr, topWeapon } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { matches as matchesTbl } from "@/lib/db/schema";
import {
  byMap,
  byAgent,
  currentForm,
  hitDistribution,
  recentKdSeries,
} from "@/lib/aggregations";

export default async function Home() {
  const [data, ms] = await Promise.all([getAccountMmr(), getMatches()]);
  const a = data?.account,
    mmr = data?.mmr;
  const maps = byMap(ms),
    agents = byAgent(ms),
    form = currentForm(ms, 20);
  const mapsByWin = maps.slice().sort((x, y) => y.winRate - x.winRate);
  const best = mapsByWin[0];
  const worst = mapsByWin.at(-1);
  let gun = null as Awaited<ReturnType<typeof topWeapon>>;
  try {
    gun = topWeapon(
      await db.select({ detail: matchesTbl.detail }).from(matchesTbl),
    );
  } catch {}

  const games = form.games;
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

  const top3: CycleAgent[] = agents.slice(0, 3).map((ag) => ({
    name: ag.agent,
    winRate: ag.winRate,
    games: ag.games,
    portrait: agentPortrait(ag.agent),
  }));
  const dist = hitDistribution(ms);
  const kdSeries = recentKdSeries(ms, 20);
  const bestSide = best
    ? {
        map: best.map,
        winRate: best.winRate,
        image: getCalibration(best.map)?.image ?? null,
      }
    : null;
  const worstSide = worst
    ? {
        map: worst.map,
        winRate: worst.winRate,
        image: getCalibration(worst.map)?.image ?? null,
      }
    : null;

  return (
    <>
      <Nav />
      <main className={homeStyles.main}>
        <AgentCycleProvider agents={top3}>
          <div className={homeStyles.heroWrap}>
            <AgentSplash />
            <Hero {...home} />
          </div>

          <h2 className={homeStyles.stripLabel}>
            Built on real competitive data
          </h2>

          <div className={homeStyles.cards}>
            <AgentsCard />
            <BestWorstMap best={bestSide} worst={worstSide} />
            <GunCard weapon={gun?.weapon ?? null} dist={dist} />
            <CurrentFormCard
              record={home.record}
              kd={form.avgKd}
              hs={form.avgHs}
              adr={form.avgAdr}
              series={kdSeries}
            />
          </div>
        </AgentCycleProvider>
      </main>
    </>
  );
}
