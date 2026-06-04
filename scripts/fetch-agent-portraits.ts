// Fetch agent display-name -> full-portrait image URL from valorant-api.com.
// Mirrors scripts/fetch-map-calibration.ts.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const res = await fetch(
    "https://valorant-api.com/v1/agents?isPlayableCharacter=true",
  );
  if (!res.ok) throw new Error(`valorant-api agents -> HTTP ${res.status}`);
  const json = await res.json();
  const map: Record<string, string> = {};
  for (const a of json.data ?? []) {
    if (a.displayName && a.fullPortrait) {
      map[a.displayName as string] = a.fullPortrait as string;
    }
  }
  const dir = join(process.cwd(), "lib", "agents");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "portraits.json");
  writeFileSync(out, JSON.stringify(map, null, 2));
  console.log(`Wrote ${Object.keys(map).length} agent portraits to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
