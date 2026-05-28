import "dotenv/config";
import { db } from "@/lib/db/client";
import {
  matches,
  rankHistory,
  syncRuns,
  type MatchRow,
  type RankRow,
} from "@/lib/db/schema";
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
import {
  storedMatchToRow,
  mmrEntryToRankRow,
  normalizeDetail,
} from "@/lib/transform";
import { writeSnapshot } from "@/lib/snapshot";
import { sql } from "drizzle-orm";

async function main() {
  const { name, tag, region, platform } = account;
  const acc = await henrik.account(name, tag);
  const puuid = acc.data.puuid;
  const mmr = await henrik.mmr(region, platform, name, tag);
  const hist = await henrik.mmrHistory(region, platform, name, tag);
  const stored = await henrik.storedCompetitive(region, name, tag);

  const matchRows: MatchRow[] = stored.data.map(storedMatchToRow);
  const rankRows: RankRow[] = (hist.data.history ?? []).map(mmrEntryToRankRow);

  // Count new rows by diffing existing ids (robust across drivers).
  const existingMatchIds = new Set(
    (await db.select({ id: matches.matchId }).from(matches)).map((r) => r.id),
  );
  const existingRankIds = new Set(
    (await db.select({ id: rankHistory.matchId }).from(rankHistory)).map(
      (r) => r.id,
    ),
  );
  const newMatches = matchRows.filter((r) => !existingMatchIds.has(r.matchId));
  const newRanks = rankRows.filter((r) => !existingRankIds.has(r.matchId));

  if (newMatches.length)
    await db.insert(matches).values(newMatches).onConflictDoNothing();
  if (newRanks.length)
    await db.insert(rankHistory).values(newRanks).onConflictDoNothing();

  const matchesAdded = newMatches.length;
  const ranksAdded = newRanks.length;

  // Deep-detail any NEW matches missing detail (throttled inside henrik client).
  const need = await db
    .select({ id: matches.matchId })
    .from(matches)
    .where(sql`${matches.hasDetail} = false`);
  for (const { id } of need) {
    try {
      const full = await henrik.matchById(region, id);
      const detail = normalizeDetail(full.data, puuid);
      await db
        .update(matches)
        .set({ detail, hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
    } catch (e) {
      console.warn(`detail fetch failed for ${id}:`, (e as Error).message);
    }
  }

  await db.insert(syncRuns).values({
    matchesAdded,
    ranksAdded,
    ok: true,
    note: `synced ${matchRows.length} matches, ${rankRows.length} rank pts`,
  });

  // Export snapshot (full DB state) for backup + fallback.
  const allMatches = await db.select().from(matches);
  const allRanks = await db.select().from(rankHistory);
  writeSnapshot({
    generatedAt: new Date().toISOString(),
    account: acc.data,
    mmr: mmr.data,
    matches: allMatches,
    rankHistory: allRanks,
  });

  console.log(
    `Sync OK: +${matchesAdded} matches, +${ranksAdded} rank pts. Snapshot written.`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
