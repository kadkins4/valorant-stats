// Codegen: build a static REGIONS registry from lib/maps/regions/*.json.
import { join } from "node:path";
import { regenerateIndex } from "@/lib/maps/regions/_codegen";

async function main() {
  const count = await regenerateIndex();
  const out = join(process.cwd(), "lib", "maps", "regions", "index.ts");
  console.log(`Wired ${count} map(s) into ${out}`);
}

main();
