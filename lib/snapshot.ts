import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PATH = join(process.cwd(), "data", "snapshot.json");

export interface Snapshot {
  generatedAt: string;
  account: any;
  mmr: any;
  matches: any[];
  rankHistory: any[];
}

export function writeSnapshot(s: Snapshot) {
  writeFileSync(PATH, JSON.stringify(s, null, 2));
}

export function readSnapshot(): Snapshot | null {
  if (!existsSync(PATH)) return null;
  return JSON.parse(readFileSync(PATH, "utf8")) as Snapshot;
}
