// One-time: re-fetch every stored match and rewrite detail with the new duel shape.
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
import { henrikPuuid } from "@/lib/henrik-puuid";
import { normalizeDetail } from "@/lib/transform";
import { sql } from "drizzle-orm";

async function main() {
  const puuid = await henrikPuuid();
  const rows = await db.select({ id: matches.matchId }).from(matches);
  console.log(
    `Re-capturing ${rows.length} matches (~${Math.ceil((rows.length * 2.2) / 60)} min)…`,
  );
  let done = 0;
  let failed = 0;
  for (const { id } of rows) {
    try {
      const full = await henrik.matchById(account.region, id);
      await db
        .update(matches)
        .set({ detail: normalizeDetail(full.data, puuid), hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
      if (++done % 10 === 0) console.log(`  ${done}/${rows.length}`);
    } catch (e) {
      failed++;
      console.warn(`  skip ${id}: ${(e as Error).message}`);
    }
  }
  console.log(`Done: ${done} ok, ${failed} failed.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
