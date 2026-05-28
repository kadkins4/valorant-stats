// one-time deep detail for all matches lacking it
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
  const rows = await db
    .select({ id: matches.matchId })
    .from(matches)
    .where(sql`${matches.hasDetail} = false`);
  console.log(
    `Backfilling ${rows.length} matches (~${Math.ceil((rows.length * 2.2) / 60)} min)…`,
  );
  let done = 0;
  for (const { id } of rows) {
    try {
      const full = await henrik.matchById(account.region, id);
      await db
        .update(matches)
        .set({ detail: normalizeDetail(full.data, puuid), hasDetail: true })
        .where(sql`${matches.matchId} = ${id}`);
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${rows.length}`);
    } catch (e) {
      console.warn(`  skip ${id}: ${(e as Error).message}`);
    }
  }
  console.log(`Backfill complete: ${done}/${rows.length}.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
