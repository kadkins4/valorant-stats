// Fetch per-map minimap image + coordinate transform constants from valorant-api.com.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const res = await fetch("https://valorant-api.com/v1/maps");
  if (!res.ok) throw new Error(`valorant-api maps -> HTTP ${res.status}`);
  const json = await res.json();
  const calib = (json.data ?? [])
    .filter((m: any) => m.displayIcon && m.xMultiplier != null)
    .map((m: any) => ({
      name: m.displayName as string,
      image: m.displayIcon as string,
      xMultiplier: m.xMultiplier as number,
      yMultiplier: m.yMultiplier as number,
      xScalarToAdd: m.xScalarToAdd as number,
      yScalarToAdd: m.yScalarToAdd as number,
    }));
  const callouts = (json.data ?? [])
    .filter((m: any) => Array.isArray(m.callouts) && m.callouts.length > 0)
    .map((m: any) => ({
      map: m.displayName as string,
      callouts: m.callouts.map((c: any) => ({
        regionName: c.regionName as string,
        superRegionName: c.superRegionName as string,
        x: c.location.x as number,
        y: c.location.y as number,
      })),
    }));
  const dir = join(process.cwd(), "lib", "maps");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "calibration.json");
  writeFileSync(out, JSON.stringify(calib, null, 2));
  console.log(`Wrote ${calib.length} maps to ${out}`);
  const calloutsOut = join(dir, "callouts.json");
  writeFileSync(calloutsOut, JSON.stringify(callouts, null, 2));
  const totalCallouts = callouts.reduce(
    (n: number, c: any) => n + c.callouts.length,
    0,
  );
  console.log(
    `Wrote ${callouts.length} maps (${totalCallouts} callouts) to ${calloutsOut}`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
