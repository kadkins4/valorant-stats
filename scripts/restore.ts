// rebuild DB tables from snapshot.json
import "dotenv/config";
import { db } from "@/lib/db/client";
import { matches, rankHistory } from "@/lib/db/schema";
import { readSnapshot } from "@/lib/snapshot";

async function main() {
  const snap = readSnapshot();
  if (!snap) {
    console.error("No snapshot.json found.");
    process.exit(1);
  }
  await db.delete(matches);
  await db.delete(rankHistory);
  if (snap.matches.length) await db.insert(matches).values(snap.matches);
  if (snap.rankHistory.length)
    await db.insert(rankHistory).values(snap.rankHistory);
  console.log(
    `Restored ${snap.matches.length} matches, ${snap.rankHistory.length} rank pts from snapshot.`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
