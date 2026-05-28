// One-time: seed data/snapshot.json from the archived prototype raw API
// captures, using the same transforms the live sync uses. This gives the app a
// real dataset (136 competitive matches + rank history) and a committed
// backup/fallback before the Neon database is provisioned. Once `pnpm sync`
// runs against Neon it supersedes this and adds per-match detail via backfill.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storedMatchToRow, mmrEntryToRankRow } from "@/lib/transform";
import { writeSnapshot } from "@/lib/snapshot";

const raw = (f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "prototype", "raw", f), "utf8"));

const account = raw("account.json").data;
const mmr = raw("mmr.json").data;
const stored = raw("stored_competitive.json").data as any[];
const history = (raw("mmr_history.json").data.history ?? []) as any[];

writeSnapshot({
  generatedAt: new Date().toISOString(),
  account,
  mmr,
  matches: stored.map(storedMatchToRow),
  rankHistory: history.map(mmrEntryToRankRow),
});

console.log(
  `Snapshot seeded: ${stored.length} matches, ${history.length} rank pts -> data/snapshot.json`,
);
